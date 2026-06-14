import { metrics, type ObservableResult } from '@opentelemetry/api';
import { BusinessMetricsService } from './business-metrics.service';

/**
 * 이름별 instrument 스텁을 기록하는 mock meter.
 * createObservableGauge 의 addCallback 콜백을 캡처해 직접 호출할 수 있게 한다.
 */
function makeMockMeter() {
  const counters: Record<string, { add: jest.Mock }> = {};
  const histograms: Record<string, { record: jest.Mock }> = {};
  let gaugeCallback: ((r: ObservableResult) => unknown) | null = null;
  const meter = {
    createCounter: (name: string) => (counters[name] = { add: jest.fn() }),
    createHistogram: (name: string) =>
      (histograms[name] = { record: jest.fn() }),
    createObservableGauge: () => ({
      addCallback: (cb: (r: ObservableResult) => unknown) => {
        gaugeCallback = cb;
      },
    }),
  };
  return {
    meter,
    counters,
    histograms,
    runGauge: (r: ObservableResult) => gaugeCallback?.(r),
  };
}

describe('BusinessMetricsService (NF-OB-07)', () => {
  let mock: ReturnType<typeof makeMockMeter>;
  let service: BusinessMetricsService;

  beforeEach(() => {
    mock = makeMockMeter();
    jest
      .spyOn(metrics, 'getMeter')
      .mockReturnValue(
        mock.meter as unknown as ReturnType<typeof metrics.getMeter>,
      );
    service = new BusinessMetricsService();
  });

  afterEach(() => jest.restoreAllMocks());

  it('recordExecutionTerminal → execution.total{status} += 1', () => {
    service.recordExecutionTerminal('completed');
    expect(mock.counters['clemvion.execution.total'].add).toHaveBeenCalledWith(
      1,
      { status: 'completed' },
    );
  });

  it('recordExecutionError → execution.errors{error_code} += 1', () => {
    service.recordExecutionError('NODE_TIMEOUT');
    expect(mock.counters['clemvion.execution.errors'].add).toHaveBeenCalledWith(
      1,
      { error_code: 'NODE_TIMEOUT' },
    );
  });

  it('recordLlmTokens → type 별로 누적, 0 은 건너뜀', () => {
    service.recordLlmTokens('gpt-4o', {
      inputTokens: 100,
      outputTokens: 0,
      thinkingTokens: 7,
    });
    const add = mock.counters['clemvion.llm.tokens'].add;
    expect(add).toHaveBeenCalledWith(100, { model: 'gpt-4o', type: 'input' });
    expect(add).toHaveBeenCalledWith(7, { model: 'gpt-4o', type: 'thinking' });
    // output=0 은 미기록.
    expect(add).not.toHaveBeenCalledWith(0, {
      model: 'gpt-4o',
      type: 'output',
    });
    expect(add).toHaveBeenCalledTimes(2);
  });

  it('recordNodeDuration → node.duration histogram 기록', () => {
    service.recordNodeDuration('ai_agent', 'completed', 1234);
    expect(
      mock.histograms['clemvion.node.duration'].record,
    ).toHaveBeenCalledWith(1234, {
      node_type: 'ai_agent',
      status: 'completed',
    });
  });

  it('queue gauge: 등록된 provider 를 폴링해 state 라벨별로 observe', async () => {
    service.registerQueueDepthProvider(async () => [
      { queue: 'execution-run', waiting: 3, active: 1, delayed: 2, failed: 0 },
    ]);
    const observe = jest.fn();
    await mock.runGauge({ observe } as unknown as ObservableResult);
    expect(observe).toHaveBeenCalledWith(3, {
      queue: 'execution-run',
      state: 'waiting',
    });
    expect(observe).toHaveBeenCalledWith(1, {
      queue: 'execution-run',
      state: 'active',
    });
    expect(observe).toHaveBeenCalledWith(2, {
      queue: 'execution-run',
      state: 'delayed',
    });
    expect(observe).toHaveBeenCalledWith(0, {
      queue: 'execution-run',
      state: 'failed',
    });
  });

  it('queue gauge: provider 실패는 해당 주기만 건너뛴다 (throw 안 함)', async () => {
    service.registerQueueDepthProvider(async () => {
      throw new Error('redis down');
    });
    service.registerQueueDepthProvider(async () => [
      { queue: 'q2', waiting: 1, active: 0, delayed: 0, failed: 0 },
    ]);
    const observe = jest.fn();
    await expect(
      mock.runGauge({ observe } as unknown as ObservableResult),
    ).resolves.not.toThrow();
    // 두 번째 provider 는 정상 관측됨.
    expect(observe).toHaveBeenCalledWith(1, { queue: 'q2', state: 'waiting' });
  });
});
