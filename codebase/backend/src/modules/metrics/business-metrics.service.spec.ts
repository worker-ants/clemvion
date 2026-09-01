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

  /**
   * `audit-logs.spec.ts` 는 이 메서드를 `jest.fn()` 스텁으로 대체하므로 **구현 자체는
   * 어느 테스트도 실행하지 않았다** — 아래 `recordRedisFailOpen` 주석이 이미 적어 둔 그
   * 함정에 그대로 빠졌다. 카운터 이름 오탈자·라벨 키 뒤바뀜·클램핑 누락이 전부 조용히
   * 통과한다.
   */
  it('recordAuditWriteFailed → audit.write_failed{resource_type} += 1', () => {
    service.recordAuditWriteFailed('auth_config');
    expect(
      mock.counters['clemvion.audit.write_failed'].add,
    ).toHaveBeenCalledWith(1, { resource_type: 'auth_config' });
  });

  it('recordAuditWriteFailed → 라벨을 64자로 클램핑한다 (cardinality 방어)', () => {
    // 65자를 넣어야 64 경계가 갈린다 — 64자를 넣으면 자르든 안 자르든 같은 값이라
    // 클램핑을 제거해도 통과한다(분기를 못 가르는 fixture).
    const long = 'x'.repeat(65);
    service.recordAuditWriteFailed(long);
    const [, labels] = mock.counters['clemvion.audit.write_failed'].add.mock
      .calls[0] as [number, { resource_type: string }];
    expect(labels.resource_type).toHaveLength(64);
  });

  /**
   * 인터셉터 쪽 테스트는 이 메서드를 `jest.fn()` 스텁으로 대체하므로, **이 구현 자체는
   * 어느 테스트도 실행하지 않았다** — 카운터 이름 오탈자·라벨 키 뒤바뀜·`add` 누락이
   * 전부 조용히 통과한다. 형제 `record*` 메서드가 모두 여기 테스트를 갖는 이유와 같다.
   */
  it('recordRedisFailOpen → redis.fail_open{component,reason} += 1', () => {
    service.recordRedisFailOpen('idempotency', 'get_failed');
    expect(mock.counters['clemvion.redis.fail_open'].add).toHaveBeenCalledWith(
      1,
      { component: 'idempotency', reason: 'get_failed' },
    );
  });

  /**
   * **타입 캐너리** — `recordRedisFailOpen` 의 라벨 인자가 리터럴 유니온으로 좁혀진 채
   * 유지되는지 고정한다.
   *
   * `ts-jest` 는 타입을 strip 하므로 **이 테스트를 실행하는 것만으로는 아무것도 검사되지
   * 않는다**(아래 두 호출은 런타임엔 그냥 통과한다 — 그래서 호출 횟수를 단언해 이 블록이
   * vacuous 하지 않음을 표시한다). 실제 감시자는
   * `scripts/check-backend-typecheck-ratchet.py` 다 — `tsc --noEmit -p tsconfig.json`
   * (spec 포함)의 **파일별** 진단 수를 baseline 과 대조해 양방향 변화에 실패한다.
   *
   * 라벨이 `string` 으로 다시 넓어지면 `@ts-expect-error` 가 **소비되지 않아** TS2578 이
   * 되고, 이 파일의 진단 수가 baseline(0)에서 올라 CI 가 막는다. 좁힘을 한 번 확인하는 것과
   * 좁힌 채로 유지되게 하는 것은 다른 일이다.
   *
   * **타입 별칭이 아니라 호출 시그니처를 겨눈다.** 처음엔 `const r: RedisFailOpenReason = s`
   * 형태로 썼는데, 그러면 별칭은 그대로 두고 `reason: string` 으로 되돌리는 회귀가 그대로
   * 통과한다(뮤테이션으로 실측 — 생존 2건). 보장의 주체는 별칭이 아니라 메서드다.
   */
  it('타입 캐너리: 임의 문자열은 라벨로 못 들어간다', () => {
    const s = 'anything' as string;
    // @ts-expect-error reason 이 string 으로 넓어지면 이 지시자가 안 쓰여 TS2578 이 된다
    service.recordRedisFailOpen('idempotency', s);
    // @ts-expect-error component 축도 같은 방식으로 고정한다
    service.recordRedisFailOpen(s, 'get_failed');
    // 타입만 보는 캐너리가 아니라 **호출 시그니처**를 본다 — 별칭만 검사하면
    // `reason: string` 으로 되돌리는 회귀가 그대로 통과한다(실측 확인).
    expect(mock.counters['clemvion.redis.fail_open'].add).toHaveBeenCalledTimes(
      2,
    );
  });

  it('recordRedisFailOpen → reason 이 호출마다 그대로 갈린다', () => {
    service.recordRedisFailOpen('idempotency', 'entry_corrupt');
    service.recordRedisFailOpen('idempotency', 'payload_corrupt');
    const add = mock.counters['clemvion.redis.fail_open'].add;
    // 두 손상 갈래를 한 라벨로 뭉개는 회귀는 "총량" 만 보면 안 잡힌다.
    expect(add).toHaveBeenNthCalledWith(1, 1, {
      component: 'idempotency',
      reason: 'entry_corrupt',
    });
    expect(add).toHaveBeenNthCalledWith(2, 1, {
      component: 'idempotency',
      reason: 'payload_corrupt',
    });
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
