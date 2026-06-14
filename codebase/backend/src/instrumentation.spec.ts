/**
 * NF-OB-02 메트릭 파이프라인 — Prometheus scrape 포트 해석 로직 검증.
 *
 * instrumentation.ts 의 부트스트랩 부수효과(NodeSDK 시작 + Prometheus 서버 기동)는
 * `OTEL_ENABLED==='true'` 일 때만 실행되며, 테스트 환경에선 미설정이라 import 만으로
 * 서버가 뜨지 않는다. 따라서 순수 헬퍼 `resolvePrometheusPort` 만 독립 검증한다.
 */
import {
  resolvePrometheusPort,
  DEFAULT_PROMETHEUS_PORT,
} from './instrumentation';

describe('resolvePrometheusPort (NF-OB-02)', () => {
  it('defaults to 9464 when unset', () => {
    expect(resolvePrometheusPort(undefined)).toBe(DEFAULT_PROMETHEUS_PORT);
    expect(DEFAULT_PROMETHEUS_PORT).toBe(9464);
  });

  it('defaults when empty / whitespace-only', () => {
    expect(resolvePrometheusPort('')).toBe(DEFAULT_PROMETHEUS_PORT);
    expect(resolvePrometheusPort('   ')).toBe(DEFAULT_PROMETHEUS_PORT);
  });

  it('parses a valid port', () => {
    expect(resolvePrometheusPort('9100')).toBe(9100);
    expect(resolvePrometheusPort('1')).toBe(1);
    expect(resolvePrometheusPort('65535')).toBe(65535);
  });

  it('falls back to the default on non-numeric / out-of-range / non-integer input', () => {
    expect(resolvePrometheusPort('abc')).toBe(DEFAULT_PROMETHEUS_PORT);
    expect(resolvePrometheusPort('0')).toBe(DEFAULT_PROMETHEUS_PORT);
    expect(resolvePrometheusPort('-5')).toBe(DEFAULT_PROMETHEUS_PORT);
    expect(resolvePrometheusPort('70000')).toBe(DEFAULT_PROMETHEUS_PORT);
    expect(resolvePrometheusPort('80.5')).toBe(DEFAULT_PROMETHEUS_PORT);
  });
});
