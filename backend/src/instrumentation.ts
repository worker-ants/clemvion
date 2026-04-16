/**
 * OpenTelemetry 부트스트랩.
 * `main.ts`보다 먼저 import해야 자동 계측이 정확히 적용된다.
 *
 * 환경 변수:
 *   - `OTEL_ENABLED=true` 일 때만 활성 (기본 비활성)
 *   - `OTEL_EXPORTER_OTLP_ENDPOINT` (기본: http://localhost:4318/v1/traces)
 *   - `OTEL_SERVICE_NAME` (기본: idea-workflow-backend)
 *
 * Collector 운영 예시: Jaeger / Tempo / Grafana Agent.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const enabled = process.env.OTEL_ENABLED === 'true';

if (enabled) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]:
        process.env.OTEL_SERVICE_NAME ?? 'idea-workflow-backend',
    }),
    traceExporter: new OTLPTraceExporter({
      url:
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
        'http://localhost:4318/v1/traces',
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // fs 계측은 노이즈가 너무 많아 끔
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });
  try {
    sdk.start();

    console.log('[otel] tracing enabled');
  } catch (err) {
    console.warn('[otel] failed to start tracing:', err);
  }
  process.on('SIGTERM', () => {
    sdk.shutdown().catch(() => undefined);
  });
}
