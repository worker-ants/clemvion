/**
 * OpenTelemetry 부트스트랩.
 * `main.ts`보다 먼저 import해야 자동 계측이 정확히 적용된다.
 *
 * NF-OB-02 (메트릭, Prometheus 호환) + NF-OB-03 (분산 트레이싱) 을 함께 부트스트랩한다.
 * 메트릭은 `PrometheusExporter` 가 별도 HTTP 서버(기본 :9464)의 `/metrics` 로 노출하며,
 * NodeSDK 의 MeterProvider 에 연결되면 auto-instrumentation 의 HTTP 서버 메트릭과
 * `instrumentation-runtime-node` 의 런타임(event loop·GC·heap) 메트릭이 자동 수집된다.
 * 비즈니스 커스텀 메트릭(실행 수·큐 깊이·LLM 사용량 등)은 본 파이프라인 위에서 후속 추가.
 *
 * 환경 변수:
 *   - `OTEL_ENABLED=true` 일 때만 활성 (기본 비활성) — traces + metrics 동시 토글
 *   - `OTEL_EXPORTER_OTLP_ENDPOINT` (기본: http://localhost:4318/v1/traces)
 *   - `OTEL_SERVICE_NAME` (기본: clemvion-backend)
 *   - `OTEL_PROMETHEUS_PORT` (기본: 9464) — Prometheus scrape 서버 포트, `/metrics`
 *   - `OTEL_PROMETHEUS_HOST` (기본: 127.0.0.1) — scrape 서버 bind 주소. 기본은 loopback
 *     으로 외부 노출을 막는다(secure-by-default). 컨테이너/원격 scrape 시 `0.0.0.0` 등으로
 *     override 하되, 네트워크 ACL·reverse proxy 로 scraper 만 접근하도록 제한할 것.
 *
 * Collector 운영 예시: Jaeger / Tempo / Grafana Agent (traces) + Prometheus (metrics scrape).
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

/**
 * PrometheusExporter 의 기본 등록 포트 (Prometheus default-port-allocations).
 * @internal — export 는 단위 테스트 전용. 애플리케이션 코드에서 직접 쓰지 말 것.
 */
export const DEFAULT_PROMETHEUS_PORT = 9464;

/** scrape 서버 기본 bind 주소 — loopback 으로 외부 노출 차단(secure-by-default). */
const DEFAULT_PROMETHEUS_HOST = '127.0.0.1';

/**
 * `OTEL_PROMETHEUS_PORT` 를 파싱한다. 미설정·비숫자·범위 밖(1–65535) 이면
 * {@link DEFAULT_PROMETHEUS_PORT} 로 폴백한다. 부트스트랩 코드라 던지지 않고
 * 안전한 기본값으로 수렴시킨다.
 * @internal — export 는 단위 테스트 전용.
 */
export function resolvePrometheusPort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_PROMETHEUS_PORT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return DEFAULT_PROMETHEUS_PORT;
  }
  return parsed;
}

const enabled = process.env.OTEL_ENABLED === 'true';

if (enabled) {
  const prometheusPort = resolvePrometheusPort(
    process.env.OTEL_PROMETHEUS_PORT,
  );
  const prometheusHost =
    process.env.OTEL_PROMETHEUS_HOST?.trim() || DEFAULT_PROMETHEUS_HOST;
  // PrometheusExporter 는 생성 시 별도 HTTP 서버를 띄워 `/metrics` 를 노출한다.
  // host 는 기본 loopback — 외부 노출은 명시적 override 시에만 (secure-by-default).
  const prometheusExporter = new PrometheusExporter({
    host: prometheusHost,
    port: prometheusPort,
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'clemvion-backend',
    }),
    traceExporter: new OTLPTraceExporter({
      url:
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
        'http://localhost:4318/v1/traces',
    }),
    // MeterProvider 에 Prometheus reader 를 연결 — HTTP 서버 메트릭 +
    // runtime-node 메트릭이 이 reader 로 수집·노출된다.
    metricReaders: [prometheusExporter],
    instrumentations: [
      getNodeAutoInstrumentations({
        // fs 계측은 노이즈가 너무 많아 끔
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });
  try {
    sdk.start();

    console.log(
      `[otel] tracing + metrics enabled (Prometheus ${prometheusHost}:${prometheusPort}/metrics)`,
    );
  } catch (err) {
    // PrometheusExporter 는 생성 시점에 이미 listen 중이므로, sdk.start() 가 실패하면
    // scrape 서버가 포트를 점유한 채 잔류한다 — 명시적으로 정리한다.
    prometheusExporter.stopServer().catch(() => undefined);
    // 에러 메시지만 남긴다(스택/내부 경로/엔드포인트 URL 의 로그 노출 방지).
    console.warn(
      '[otel] failed to start tracing/metrics:',
      err instanceof Error ? err.message : String(err),
    );
  }
  // once — 모듈 재실행(테스트 isolateModules 등) 시 SIGTERM 핸들러 중복 등록 방지.
  process.once('SIGTERM', () => {
    sdk.shutdown().catch(() => undefined);
  });
}
