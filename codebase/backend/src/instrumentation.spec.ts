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

describe('instrumentation bootstrap (OTEL_ENABLED=true)', () => {
  const ORIGINAL_ENV = process.env;

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetModules();
    jest.restoreAllMocks();
  });

  /**
   * OTel 모듈을 전부 mock 한 뒤 OTEL_ENABLED=true 로 모듈을 격리 재실행해
   * `if (enabled)` 부트스트랩 분기를 검증한다. 실제 서버는 뜨지 않는다.
   */
  function loadEnabled(env: Record<string, string>) {
    const startMock = jest.fn();
    const shutdownMock = jest.fn().mockResolvedValue(undefined);
    const stopServerMock = jest.fn().mockResolvedValue(undefined);
    const NodeSDKMock = jest.fn(() => ({
      start: startMock,
      shutdown: shutdownMock,
    }));
    const PrometheusExporterMock = jest.fn(() => ({
      stopServer: stopServerMock,
    }));

    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, OTEL_ENABLED: 'true', ...env };
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    jest.doMock('@opentelemetry/sdk-node', () => ({ NodeSDK: NodeSDKMock }));
    jest.doMock('@opentelemetry/exporter-prometheus', () => ({
      PrometheusExporter: PrometheusExporterMock,
    }));
    jest.doMock('@opentelemetry/auto-instrumentations-node', () => ({
      getNodeAutoInstrumentations: jest.fn(() => []),
    }));
    jest.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
      OTLPTraceExporter: jest.fn(),
    }));
    jest.doMock('@opentelemetry/resources', () => ({
      resourceFromAttributes: jest.fn(() => ({})),
    }));
    jest.doMock('@opentelemetry/semantic-conventions', () => ({
      ATTR_SERVICE_NAME: 'service.name',
    }));

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./instrumentation');
    });

    return { NodeSDKMock, PrometheusExporterMock, startMock, stopServerMock };
  }

  it('constructs the PrometheusExporter with loopback host + resolved port and starts the SDK', () => {
    const { NodeSDKMock, PrometheusExporterMock, startMock } = loadEnabled({
      OTEL_PROMETHEUS_PORT: '9999',
    });
    expect(PrometheusExporterMock).toHaveBeenCalledWith({
      host: '127.0.0.1',
      port: 9999,
    });
    expect(NodeSDKMock).toHaveBeenCalledTimes(1);
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it('honors OTEL_PROMETHEUS_HOST override', () => {
    const { PrometheusExporterMock } = loadEnabled({
      OTEL_PROMETHEUS_HOST: '0.0.0.0',
    });
    expect(PrometheusExporterMock).toHaveBeenCalledWith({
      host: '0.0.0.0',
      port: 9464,
    });
  });

  it('stops the exporter server when sdk.start() throws (no leaked port)', () => {
    // Re-mock NodeSDK so start() throws, and assert the exporter is cleaned up.
    const startMock = jest.fn(() => {
      throw new Error('start failed');
    });
    const stopServerMock = jest.fn().mockResolvedValue(undefined);
    const NodeSDKMock = jest.fn(() => ({
      start: startMock,
      shutdown: jest.fn().mockResolvedValue(undefined),
    }));
    const PrometheusExporterMock = jest.fn(() => ({
      stopServer: stopServerMock,
    }));

    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, OTEL_ENABLED: 'true' };
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    jest.doMock('@opentelemetry/sdk-node', () => ({ NodeSDK: NodeSDKMock }));
    jest.doMock('@opentelemetry/exporter-prometheus', () => ({
      PrometheusExporter: PrometheusExporterMock,
    }));
    jest.doMock('@opentelemetry/auto-instrumentations-node', () => ({
      getNodeAutoInstrumentations: jest.fn(() => []),
    }));
    jest.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
      OTLPTraceExporter: jest.fn(),
    }));
    jest.doMock('@opentelemetry/resources', () => ({
      resourceFromAttributes: jest.fn(() => ({})),
    }));
    jest.doMock('@opentelemetry/semantic-conventions', () => ({
      ATTR_SERVICE_NAME: 'service.name',
    }));

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./instrumentation');
    });

    expect(stopServerMock).toHaveBeenCalledTimes(1);
    // 에러 메시지만 로깅(원본 Error 객체 직접 출력 금지).
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('failed to start'),
      'start failed',
    );
  });
});
