import { Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { Response } from 'express';
import {
  SseAdapter,
  type SseStreamToken,
  type SseSubscriber,
} from './sse-adapter.service';
import {
  SseFanoutService,
  sseBufferKey,
  sseConnectionSlotsKey,
  sseLiveChannel,
} from './sse-fanout.service';
import { writeSseFrame } from './interaction-stream.controller';
import { FakeRedisServer } from './__test-utils__/fake-redis-streams';
import type { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';
import type { WebsocketService } from '../websocket/websocket.service';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';

interface Instance {
  adapter: SseAdapter;
  fanout: SseFanoutService;
  subject: Subject<ExecutionChannelEvent>;
}

function makeInstance(fanout: SseFanoutService): Instance {
  const subject = new Subject<ExecutionChannelEvent>();
  const ws = {
    executionEvents$: subject.asObservable(),
  } as unknown as WebsocketService;
  const adapter = new SseAdapter(ws, fanout);
  adapter.onModuleInit();
  return { adapter, fanout, subject };
}

/** Redis 없이 부팅한 서버 인스턴스. 메모리로만 동작한다. */
function memoryInstance(): Instance {
  return makeInstance(
    new SseFanoutService({
      getClientOrNull: () => null,
    } as unknown as RedisConnectionProvider),
  );
}

/** `server` 를 나눠 쓰는 서버 인스턴스. 여럿 만들면 서버 인스턴스 여럿을 흉내 낸다. */
function redisInstance(server: FakeRedisServer): Instance {
  const fanout = new SseFanoutService(server.provider());
  fanout.onModuleInit();
  return makeInstance(fanout);
}

async function destroy(instance: Instance): Promise<void> {
  instance.adapter.onModuleDestroy();
  await instance.fanout.onModuleDestroy();
}

let subCounter = 0;

function makeSub(
  executionId: string,
  token: SseStreamToken = { family: 'iext' },
): { sub: SseSubscriber; pushed: ExecutionChannelEvent[]; close: jest.Mock } {
  const pushed: ExecutionChannelEvent[] = [];
  const close = jest.fn();
  subCounter += 1;
  return {
    pushed,
    close,
    sub: {
      id: `sub-${subCounter}`,
      executionId,
      token,
      push: (e) => pushed.push(e),
      close,
    },
  };
}

/** 컨트롤러와 같은 순서로 연다. 연결 상한에 걸리면 `false` 다. */
async function open(
  adapter: SseAdapter,
  sub: SseSubscriber,
  lastEventId?: number,
): Promise<boolean> {
  const admitted = await adapter.admit(sub);
  if (admitted) await adapter.start(sub, lastEventId);
  return admitted;
}

/** microtask 와 setImmediate 를 한 바퀴 돌린다. pub/sub 메시지와 Redis 쓰기의 후속 처리가 끝난다. */
function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** 남은 TTL 이 `ms` 로 막 설정됐는지. 실제 시계로 도니 몇 ms 의 차이는 둔다. */
function expectTtlNear(pttl: number | null, ms: number): void {
  expect(pttl).not.toBeNull();
  expect(pttl).toBeLessThanOrEqual(ms);
  expect(pttl).toBeGreaterThan(ms - 1_000);
}

function ev(
  executionId: string,
  eventType: string,
  seq: number,
): ExecutionChannelEvent {
  return {
    executionId,
    eventType,
    seq,
    payload: { executionId, eventType, seq },
  };
}

const REPLAY_UNAVAILABLE = 'execution.replay_unavailable';
const TRIGGER_1 = '11111111-1111-4111-8111-111111111111';
const TRIGGER_2 = '22222222-2222-4222-8222-222222222222';
const TRIGGER_3 = '33333333-3333-4333-8333-333333333333';

// W-3 주석: SseAdapter 는 executionEvents$(Subject) 로부터 받은 ExecutionChannelEvent
// 를 payload 수정 없이 SSE 구독자에게 passthrough 한다. llmCalls strip 은 upstream
// fanout seam(WebsocketService.emitExecutionEvent / emitNodeEvent) 에서 수행되므로
// SseAdapter 단독 단위 테스트로는 strip 동작이 보이지 않는다. Strip egress 회귀 보호는
// websocket.service.spec.ts 의 'llmCalls strip — 외부 fanout 수신자 보호' describe 가
// 담당한다. 본 파일의 'payload passthrough' 테스트는 어댑터가 payload 를 변형하지
// 않음(변형하면 strip 이 우회될 수 있음)을 보장한다.

describe('SseAdapter — 메모리 모드(Redis 없이 부팅)', () => {
  let adapter: SseAdapter;
  let subject: Subject<ExecutionChannelEvent>;

  beforeEach(() => {
    ({ adapter, subject } = memoryInstance());
  });
  afterEach(() => adapter.onModuleDestroy());

  it('연 뒤의 이벤트를 바로 보낸다', async () => {
    const { sub, pushed } = makeSub('exec-1');
    await open(adapter, sub);
    subject.next(ev('exec-1', 'execution.started', 1));
    subject.next(ev('exec-1', 'execution.node.started', 2));
    expect(pushed.map((e) => e.seq)).toEqual([1, 2]);
  });

  it('다른 execution 이벤트는 격리', async () => {
    const { sub: s1, pushed: p1 } = makeSub('exec-1');
    const { sub: s2, pushed: p2 } = makeSub('exec-2');
    await open(adapter, s1);
    await open(adapter, s2);
    subject.next(ev('exec-1', 'execution.started', 1));
    subject.next(ev('exec-2', 'execution.started', 1));
    expect(p1.length).toBe(1);
    expect(p2.length).toBe(1);
    expect(p1[0].executionId).toBe('exec-1');
    expect(p2[0].executionId).toBe('exec-2');
  });

  it('admit 과 start 사이에 온 이벤트는 모았다가 start 때 보낸다', async () => {
    const { sub, pushed } = makeSub('exec-1');
    expect(await adapter.admit(sub)).toBe(true);
    subject.next(ev('exec-1', 'execution.started', 1));
    subject.next(ev('exec-1', 'execution.node.started', 2));
    expect(pushed).toEqual([]);
    await adapter.start(sub);
    expect(pushed.map((e) => e.seq)).toEqual([1, 2]);
  });

  it('replay 와 모은 이벤트가 겹치면 seq 마다 한 번만 보낸다', async () => {
    subject.next(ev('exec-1', 'execution.started', 1));
    subject.next(ev('exec-1', 'execution.node.started', 2));
    const { sub, pushed } = makeSub('exec-1');
    await adapter.admit(sub);
    // 버퍼에도 들어가고 구독자의 대기 목록에도 들어간다.
    subject.next(ev('exec-1', 'execution.node.completed', 3));
    await adapter.start(sub, 1);
    expect(pushed.map((e) => e.seq)).toEqual([2, 3]);
  });

  it('모은 이벤트가 상한을 넘으면 replay_unavailable 을 먼저 보낸다', async () => {
    const { sub, pushed } = makeSub('exec-1');
    await adapter.admit(sub);
    for (let i = 1; i <= 1001; i++) {
      subject.next(ev('exec-1', 'execution.node.started', i));
    }
    await adapter.start(sub);
    expect(pushed[0].eventType).toBe(REPLAY_UNAVAILABLE);
    expect(pushed[0].seq).toBe(0);
    expect(pushed.slice(1).map((e) => e.seq)).toEqual(
      Array.from({ length: 1000 }, (_, i) => i + 2),
    );
  });

  it('start(lastEventId) — buffer 에서 lastEventId 이후만 replay', async () => {
    subject.next(ev('exec-1', 'execution.started', 1));
    subject.next(ev('exec-1', 'execution.node.started', 2));
    subject.next(ev('exec-1', 'execution.node.completed', 3));
    expect(adapter.bufferSize('exec-1')).toBe(3);

    const { sub, pushed } = makeSub('exec-1');
    await open(adapter, sub, 1);
    expect(pushed.map((e) => e.seq)).toEqual([2, 3]);
  });

  it('start(lastEventId) — lastEventId 가 buffer 최신값보다 크면 replay 없음', async () => {
    subject.next(ev('exec-1', 'execution.started', 1));
    const { sub, pushed } = makeSub('exec-1');
    await open(adapter, sub, 100);
    expect(pushed).toEqual([]);
  });

  it('unsubscribe 후 이벤트 미수신', async () => {
    const { sub, pushed } = makeSub('exec-1');
    await open(adapter, sub);
    subject.next(ev('exec-1', 'execution.started', 1));
    adapter.unsubscribe(sub);
    subject.next(ev('exec-1', 'execution.node.started', 2));
    expect(pushed.map((e) => e.seq)).toEqual([1]);
  });

  it('admit 뒤 start 전에 해제하면 start 가 아무것도 보내지 않는다', async () => {
    subject.next(ev('exec-1', 'execution.started', 1));
    const { sub, pushed } = makeSub('exec-1');
    await adapter.admit(sub);
    adapter.unsubscribe(sub);
    await adapter.start(sub, 0);
    expect(pushed).toEqual([]);
    expect(adapter.subscriberCount('exec-1')).toBe(0);
  });

  it('subscriberCount — execution 별 구독자 수 추적', async () => {
    expect(adapter.subscriberCount('exec-1')).toBe(0);
    const { sub: s1 } = makeSub('exec-1');
    const { sub: s2 } = makeSub('exec-1');
    await open(adapter, s1);
    await open(adapter, s2);
    expect(adapter.subscriberCount('exec-1')).toBe(2);
    adapter.unsubscribe(s1);
    expect(adapter.subscriberCount('exec-1')).toBe(1);
    adapter.unsubscribe(s2);
    expect(adapter.subscriberCount('exec-1')).toBe(0);
  });

  it('연결 상한 — 이 서버 인스턴스 안에서 실행당 3개까지 받는다', async () => {
    const subs = [1, 2, 3, 4].map(() => makeSub('exec-1'));
    expect(await adapter.admit(subs[0].sub)).toBe(true);
    expect(await adapter.admit(subs[1].sub)).toBe(true);
    expect(await adapter.admit(subs[2].sub)).toBe(true);
    expect(await adapter.admit(subs[3].sub)).toBe(false);
    expect(adapter.subscriberCount('exec-1')).toBe(3);
    // 다른 실행은 따로 센다.
    expect(await adapter.admit(makeSub('exec-2').sub)).toBe(true);
    adapter.unsubscribe(subs[0].sub);
    expect(await adapter.admit(makeSub('exec-1').sub)).toBe(true);
  });

  it('buffer 상한 — 1000개를 넘으면 오래된 것부터 폐기', () => {
    for (let i = 1; i <= 1010; i++) {
      subject.next(ev('exec-1', 'execution.node.started', i));
    }
    expect(adapter.bufferSize('exec-1')).toBe(1000);
  });

  it('push 시 listener throw 해도 다른 구독자에 전파', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      const throwing = makeSub('exec-1');
      throwing.sub.push = () => {
        throw new Error('boom');
      };
      const { sub: ok, pushed: okPushed } = makeSub('exec-1');
      await open(adapter, throwing.sub);
      await open(adapter, ok);
      subject.next(ev('exec-1', 'execution.started', 1));
      expect(okPushed.length).toBe(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('boom'));
    } finally {
      warn.mockRestore();
    }
  });

  it('종료 이벤트를 보낸 뒤 구독을 해제하고 다음 턴에 close 를 부른다', async () => {
    const { sub, pushed, close } = makeSub('exec-1');
    await open(adapter, sub);
    subject.next(ev('exec-1', 'execution.completed', 1));
    expect(pushed.map((e) => e.eventType)).toEqual(['execution.completed']);
    expect(adapter.subscriberCount('exec-1')).toBe(0);
    expect(close).not.toHaveBeenCalled();
    await flush();
    expect(close).toHaveBeenCalledTimes(1);
    subject.next(ev('exec-1', 'execution.node.started', 2));
    expect(pushed).toHaveLength(1);
  });

  it('onModuleDestroy — 구독자/버퍼 모두 해제', async () => {
    const { sub } = makeSub('exec-1');
    await open(adapter, sub);
    subject.next(ev('exec-1', 'execution.started', 1));
    adapter.onModuleDestroy();
    expect(adapter.subscriberCount('exec-1')).toBe(0);
    expect(adapter.bufferSize('exec-1')).toBe(0);
  });

  describe('execution.replay_unavailable — 버퍼 gap 시 재조회 신호 (§5.2 / EIA-IN-07 / EIA-NF-03)', () => {
    it('cap 폐기로 gap → replay_unavailable 1회 emit, 부분 replay 안 함', async () => {
      // seq 1..1010 → 상한(1000)으로 seq 1..10 폐기, buffer=[11..1010]
      for (let i = 1; i <= 1010; i++) {
        subject.next(ev('exec-1', 'execution.node.started', i));
      }
      const { sub, pushed } = makeSub('exec-1');
      await open(adapter, sub, 5); // 클라는 seq>5 원하나 6..10 은 폐기됨
      expect(pushed).toHaveLength(1);
      expect(pushed[0].eventType).toBe(REPLAY_UNAVAILABLE);
      expect(pushed[0].seq).toBe(0);
      expect(pushed[0].payload).toMatchObject({
        executionId: 'exec-1',
        lastEventId: 5,
      });
    });

    it('버퍼 만료(>5분)로 gap → replay_unavailable emit', async () => {
      jest.useFakeTimers({ doNotFake: ['setInterval', 'setImmediate'] });
      try {
        jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        subject.next(ev('exec-1', 'execution.started', 1));
        subject.next(ev('exec-1', 'execution.node.started', 2));
        jest.setSystemTime(new Date('2026-01-01T00:06:00Z')); // 6분 경과 → 5분 buffer 만료
        const { sub, pushed } = makeSub('exec-1');
        await open(adapter, sub, 1); // seq>1 원하나 seq2 만료
        expect(pushed).toHaveLength(1);
        expect(pushed[0].eventType).toBe(REPLAY_UNAVAILABLE);
      } finally {
        jest.useRealTimers();
      }
    });

    it('연속(contiguous) buffer → 정상 replay, replay_unavailable 미emit', async () => {
      subject.next(ev('exec-1', 'execution.started', 1));
      subject.next(ev('exec-1', 'execution.node.started', 2));
      subject.next(ev('exec-1', 'execution.node.completed', 3));
      const { sub, pushed } = makeSub('exec-1');
      await open(adapter, sub, 1);
      expect(pushed.map((e) => e.seq)).toEqual([2, 3]);
      expect(pushed.some((e) => e.eventType === REPLAY_UNAVAILABLE)).toBe(
        false,
      );
    });

    it('lastEventId=0 첫 연결 seed — buffer 가 seq1 부터면 gap 아님, 전체 replay', async () => {
      subject.next(ev('exec-1', 'execution.started', 1));
      subject.next(ev('exec-1', 'execution.node.started', 2));
      const { sub, pushed } = makeSub('exec-1');
      await open(adapter, sub, 0);
      expect(pushed.map((e) => e.seq)).toEqual([1, 2]);
      expect(pushed.some((e) => e.eventType === REPLAY_UNAVAILABLE)).toBe(
        false,
      );
    });

    it('lastEventId=0 인데 초기 이벤트가 폐기됐으면 gap → replay_unavailable', async () => {
      for (let i = 1; i <= 1010; i++) {
        subject.next(ev('exec-1', 'execution.node.started', i));
      }
      const { sub, pushed } = makeSub('exec-1');
      await open(adapter, sub, 0); // seq1 부터의 전체 seed 불가(buffer=[11..1010])
      expect(pushed).toHaveLength(1);
      expect(pushed[0].eventType).toBe(REPLAY_UNAVAILABLE);
    });

    it('클라이언트가 최신까지 수신했으면(wanted 없음) replay_unavailable 미emit', async () => {
      subject.next(ev('exec-1', 'execution.started', 1));
      const { sub, pushed } = makeSub('exec-1');
      await open(adapter, sub, 1); // seq>1 없음 → 누락 아님
      expect(pushed).toEqual([]);
    });

    // 근거가 없으면 놓쳤을 수 있다고 본다. 메모리 모드에는 순번 카운터를 읽을 길이 없다.
    it('버퍼가 비었는데 lastEventId 가 있으면 replay_unavailable', async () => {
      const { sub, pushed } = makeSub('exec-1');
      await open(adapter, sub, 3);
      expect(pushed).toHaveLength(1);
      expect(pushed[0].eventType).toBe(REPLAY_UNAVAILABLE);
      expect(pushed[0].payload).toMatchObject({ lastEventId: 3 });
    });

    it('lastEventId 가 없으면 버퍼가 비어도 신호를 보내지 않는다', async () => {
      const { sub, pushed } = makeSub('exec-1');
      await open(adapter, sub);
      expect(pushed).toEqual([]);
    });

    it('소수 lastEventId 는 floor 로 정규화 — 연속 buffer 오탐 없이 정상 replay', async () => {
      subject.next(ev('exec-1', 'execution.started', 1));
      subject.next(ev('exec-1', 'execution.node.started', 2));
      subject.next(ev('exec-1', 'execution.node.completed', 3));
      const { sub, pushed } = makeSub('exec-1');
      await open(adapter, sub, 1.5); // floor(1.5)=1 → seq>1 replay
      expect(pushed.map((e) => e.seq)).toEqual([2, 3]);
      expect(pushed.some((e) => e.eventType === REPLAY_UNAVAILABLE)).toBe(
        false,
      );
    });

    it('배열 중간 hole(seq 유실) 도 gap 으로 판정 → replay_unavailable', async () => {
      // 연속이 아닌 seq 를 직접 주입(3 유실) — 선두만 보는 판정이면 놓칠 케이스.
      subject.next(ev('exec-1', 'execution.started', 1));
      subject.next(ev('exec-1', 'execution.node.started', 2));
      subject.next(ev('exec-1', 'execution.node.completed', 4));
      const { sub, pushed } = makeSub('exec-1');
      await open(adapter, sub, 0); // 재생가능 [1,2,4] — 1→2 연속이나 2→4 hole
      expect(pushed).toHaveLength(1);
      expect(pushed[0].eventType).toBe(REPLAY_UNAVAILABLE);
    });

    it('wiring — seq=0 replay_unavailable 가 writeSseFrame 통과 시 `id:` 없는 프레임', async () => {
      for (let i = 1; i <= 1010; i++) {
        subject.next(ev('exec-1', 'execution.node.started', i));
      }
      const chunks: string[] = [];
      const res = {
        write: (s: string) => {
          chunks.push(s);
          return true;
        },
      } as unknown as Response;
      const { sub } = makeSub('exec-1');
      sub.push = (e) => writeSseFrame(res, e); // 실제 컨트롤러 직렬화 경로
      await open(adapter, sub, 5); // cap 폐기 gap
      const lines = chunks.join('').split('\n');
      expect(lines).toContain(`event: ${REPLAY_UNAVAILABLE}`);
      expect(lines.some((l) => l.startsWith('id:'))).toBe(false);
    });
  });

  // W-3 passthrough 검증: SseAdapter 는 executionEvents$ 에서 받은 payload 를
  // 수정 없이 구독자에게 전달한다. 어댑터가 payload 를 변형하면 upstream strip 이
  // 우회될 수 있으므로, 이 테스트로 "어댑터 = 순수 passthrough" 를 보장한다.
  // llmCalls strip 자체의 회귀 보호는 websocket.service.spec.ts 가 담당한다.
  it('payload passthrough — 어댑터는 수신한 payload 를 변형하지 않고 구독자에게 전달 (W-3)', async () => {
    const { sub, pushed } = makeSub('exec-pt');
    await open(adapter, sub);
    const customPayload = {
      executionId: 'exec-pt',
      eventType: 'execution.ai_message',
      seq: 7,
      customField: 'preserved',
    };
    const channelEvent: ExecutionChannelEvent = {
      executionId: 'exec-pt',
      eventType: 'execution.ai_message',
      seq: 7,
      payload: customPayload,
    };
    subject.next(channelEvent);
    expect(pushed).toHaveLength(1);
    // payload 참조가 그대로 보존 — 어댑터가 payload 를 clone/변형하지 않음을 확인
    expect(pushed[0].payload).toBe(customPayload);
    expect(pushed[0].payload.customField).toBe('preserved');
  });
});

// 근거: NERV Task `CLE-T-EQDYC1` — Redis 를 쓸 수 없을 때 메모리 버퍼가 끝없이 남지 않게 한다.
describe('SseAdapter — 메모리 버퍼 정리', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('마지막 이벤트 뒤 5분이 지난 실행의 버퍼를 지운다', () => {
    const { adapter, subject } = memoryInstance();
    subject.next(ev('exec-old', 'execution.started', 1));
    jest.advanceTimersByTime(4 * 60_000);
    subject.next(ev('exec-new', 'execution.started', 1));
    jest.advanceTimersByTime(2 * 60_000);
    expect(adapter.bufferSize('exec-old')).toBe(0);
    expect(adapter.bufferSize('exec-new')).toBe(1);
    jest.advanceTimersByTime(4 * 60_000);
    expect(adapter.bufferSize('exec-new')).toBe(0);
    adapter.onModuleDestroy();
  });

  it('5분 안에 이벤트가 이어지면 지우지 않는다', () => {
    const { adapter, subject } = memoryInstance();
    for (let i = 1; i <= 8; i++) {
      subject.next(ev('exec-1', 'execution.node.started', i));
      jest.advanceTimersByTime(60_000);
    }
    // 5분이 지난 앞쪽 2개만 다음 이벤트 때 걸러졌다. 실행 버퍼 자체는 남는다.
    expect(adapter.bufferSize('exec-1')).toBe(6);
    adapter.onModuleDestroy();
  });

  it('onModuleDestroy 가 정리 타이머를 멈춘다', () => {
    const { adapter } = memoryInstance();
    expect(jest.getTimerCount()).toBe(1);
    adapter.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });
});

// 근거: [EIA 데이터와 흐름 「트리거 단위 토큰」](CLE-EIA-DATA#트리거-단위-토큰) — 트리거 단위 토큰이 무효가 되면
// (재발급 · 전략 변경으로 지움 · 인터랙션 끄기 · 트리거 삭제) 그 토큰으로 연 SSE 스트림을 서버가 닫는다. 실행 단위 토큰으로
// 연 스트림은 닫지 않는다.
describe('SseAdapter.closeTriggerTokenStreams — 이 서버 인스턴스', () => {
  let adapter: SseAdapter;
  let subject: Subject<ExecutionChannelEvent>;

  beforeEach(() => {
    ({ adapter, subject } = memoryInstance());
  });
  afterEach(() => adapter.onModuleDestroy());

  function itk(executionId: string, triggerId: string) {
    return makeSub(executionId, { family: 'itk', triggerId });
  }

  it('지정한 트리거의 itk 스트림만 닫고 닫은 수를 돌려준다', async () => {
    const itk1 = itk('exec-a', TRIGGER_1);
    const itk2 = itk('exec-b', TRIGGER_2);
    const iext = makeSub('exec-a');
    await open(adapter, itk1.sub);
    await open(adapter, itk2.sub);
    await open(adapter, iext.sub);

    expect(adapter.closeTriggerTokenStreams([TRIGGER_1])).toBe(1);

    expect(itk1.close).toHaveBeenCalledTimes(1);
    expect(itk2.close).not.toHaveBeenCalled();
    expect(iext.close).not.toHaveBeenCalled();
    expect(adapter.subscriberCount('exec-a')).toBe(1);
    expect(adapter.subscriberCount('exec-b')).toBe(1);
  });

  it('닫은 구독자에게는 이후 이벤트를 보내지 않는다', async () => {
    const s = itk('exec-a', TRIGGER_1);
    await open(adapter, s.sub);
    adapter.closeTriggerTokenStreams([TRIGGER_1]);
    subject.next(ev('exec-a', 'execution.node_completed', 1));
    expect(s.pushed).toHaveLength(0);
  });

  it('여러 트리거를 한 번에 닫는다', async () => {
    const a = itk('exec-a', TRIGGER_1);
    const b = itk('exec-a', TRIGGER_1);
    const c = itk('exec-c', TRIGGER_3);
    await open(adapter, a.sub);
    await open(adapter, b.sub);
    await open(adapter, c.sub);
    expect(adapter.closeTriggerTokenStreams([TRIGGER_1, TRIGGER_3])).toBe(3);
    expect(adapter.subscriberCount('exec-a')).toBe(0);
    expect(adapter.subscriberCount('exec-c')).toBe(0);
  });

  it('close 가 던져도 나머지 스트림을 계속 닫는다', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      const bad = itk('exec-a', TRIGGER_1);
      bad.close.mockImplementation(() => {
        throw new Error('socket gone');
      });
      const good = itk('exec-b', TRIGGER_1);
      await open(adapter, bad.sub);
      await open(adapter, good.sub);
      expect(adapter.closeTriggerTokenStreams([TRIGGER_1])).toBe(2);
      expect(good.close).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('빈 목록이면 아무것도 닫지 않는다', async () => {
    const s = itk('exec-a', TRIGGER_1);
    await open(adapter, s.sub);
    expect(adapter.closeTriggerTokenStreams([])).toBe(0);
    expect(s.close).not.toHaveBeenCalled();
  });

  // 컨트롤러는 SSE 헤더를 보내기 전에 받은 close 를 401 로 바꾼다.
  it('admit 만 한 구독자도 닫는다', async () => {
    const s = itk('exec-a', TRIGGER_1);
    await adapter.admit(s.sub);
    expect(adapter.closeTriggerTokenStreams([TRIGGER_1])).toBe(1);
    expect(s.close).toHaveBeenCalledTimes(1);
    await adapter.start(s.sub);
    subject.next(ev('exec-a', 'execution.started', 1));
    expect(s.pushed).toEqual([]);
  });
});

// 근거: [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA#sse-스트림), NERV Task `CLE-T-Z35F7P` — 서버 인스턴스가 여럿이어도
// 구독자가 어느 인스턴스에 붙든 이벤트를 받고, 다른 인스턴스로 다시 연결해도 replay 가 되고, 닫기와 연결 상한이 모든
// 인스턴스에 걸린다. 서버 인스턴스 둘이 Redis 대역 하나를 나눠 쓴다.
describe('SseAdapter — 서버 인스턴스 둘이 Redis 를 나눠 쓸 때', () => {
  let server: FakeRedisServer;
  let a: Instance;
  let b: Instance;

  beforeEach(() => {
    server = new FakeRedisServer();
    a = redisInstance(server);
    b = redisInstance(server);
  });
  afterEach(async () => {
    await destroy(a);
    await destroy(b);
  });

  it('한 인스턴스의 이벤트를 다른 인스턴스의 구독자가 받는다', async () => {
    const onA = makeSub('exec-1');
    const onB = makeSub('exec-1');
    await open(a.adapter, onA.sub);
    await open(b.adapter, onB.sub);

    a.subject.next(ev('exec-1', 'execution.started', 1));
    // 자기 인스턴스의 구독자는 Redis 를 거치지 않고 바로 받는다.
    expect(onA.pushed.map((e) => e.seq)).toEqual([1]);
    await flush();
    expect(onB.pushed.map((e) => e.seq)).toEqual([1]);
    expect(onA.pushed.map((e) => e.seq)).toEqual([1]);
    expect(a.adapter.bufferSize('exec-1')).toBe(0);
  });

  // seq 가 0 인 이벤트는 seq 로 거르지 못한다. 자기가 보낸 live 메시지를 건너뛰어야 한 번만 받는다.
  it('자기가 발행한 live 메시지는 다시 전달하지 않는다', async () => {
    const onA = makeSub('exec-1');
    const onB = makeSub('exec-1');
    await open(a.adapter, onA.sub);
    await open(b.adapter, onB.sub);
    a.subject.next(ev('exec-1', 'execution.control', 0));
    await flush();
    expect(onA.pushed).toHaveLength(1);
    expect(onB.pushed).toHaveLength(1);
  });

  it('다른 인스턴스로 다시 연결해도 replay 한다', async () => {
    a.subject.next(ev('exec-1', 'execution.started', 1));
    a.subject.next(ev('exec-1', 'execution.node.started', 2));
    a.subject.next(ev('exec-1', 'execution.node.completed', 3));
    await flush();
    expect(server.streams.get(sseBufferKey('exec-1'))).toHaveLength(3);
    expectTtlNear(server.pttl(sseBufferKey('exec-1')), 300_000);

    const onB = makeSub('exec-1');
    await open(b.adapter, onB.sub, 1);
    expect(onB.pushed.map((e) => e.seq)).toEqual([2, 3]);
  });

  it('replay 를 읽는 사이 live 로 온 이벤트와 겹쳐도 seq 마다 한 번만 보낸다', async () => {
    a.subject.next(ev('exec-1', 'execution.started', 1));
    a.subject.next(ev('exec-1', 'execution.node.started', 2));
    await flush();
    server.beforeXrange = async () => {
      server.beforeXrange = null;
      // B 가 live 채널을 구독한 뒤 버퍼를 읽기 전에 A 가 이벤트를 낸다. 버퍼와 live 양쪽에 있다.
      a.subject.next(ev('exec-1', 'execution.node.completed', 3));
      await flush();
    };
    const onB = makeSub('exec-1');
    await open(b.adapter, onB.sub, 1);
    await flush();
    expect(onB.pushed.map((e) => e.seq)).toEqual([2, 3]);
  });

  // 구독 확인 전에 버퍼를 읽으면 그 사이 다른 인스턴스가 낸 이벤트는 버퍼에도 live 에도 없다.
  it('live 채널 구독이 확인된 뒤에 버퍼를 읽는다', async () => {
    a.subject.next(ev('exec-1', 'execution.started', 1));
    await flush();
    const liveChannel = sseLiveChannel('exec-1');
    server.beforeSubscribe = async (channels) => {
      if (!channels.includes(liveChannel)) return;
      server.beforeSubscribe = null;
      await flush();
      // 구독이 등록되기 전이라 live 로는 오지 않는다. 버퍼에는 들어간다.
      a.subject.next(ev('exec-1', 'execution.node.started', 2));
      await flush();
    };
    const onB = makeSub('exec-1');
    await open(b.adapter, onB.sub, 0);
    await flush();
    expect(onB.pushed.map((e) => e.seq)).toEqual([1, 2]);
  });

  it('live 채널은 로컬 구독자가 있는 동안만 한 번 구독한다', async () => {
    const channel = sseLiveChannel('exec-1');
    const s1 = makeSub('exec-1');
    const s2 = makeSub('exec-1');
    expect(server.subscriberCount(channel)).toBe(0);
    await open(b.adapter, s1.sub);
    await open(b.adapter, s2.sub);
    expect(server.subscriberCount(channel)).toBe(1);
    b.adapter.unsubscribe(s1.sub);
    expect(server.subscriberCount(channel)).toBe(1);
    b.adapter.unsubscribe(s2.sub);
    await flush();
    expect(server.subscriberCount(channel)).toBe(0);
  });

  it('닫기 신호로 다른 인스턴스의 itk 스트림도 닫는다', async () => {
    const onA = makeSub('exec-1', { family: 'itk', triggerId: TRIGGER_1 });
    const onB = makeSub('exec-1', { family: 'itk', triggerId: TRIGGER_1 });
    // 실행당 연결 상한이 3 이라 다른 트리거의 스트림은 다른 실행에 연다.
    const otherTrigger = makeSub('exec-2', {
      family: 'itk',
      triggerId: TRIGGER_2,
    });
    const iextOnB = makeSub('exec-1');
    expect(await open(a.adapter, onA.sub)).toBe(true);
    expect(await open(b.adapter, onB.sub)).toBe(true);
    expect(await open(b.adapter, otherTrigger.sub)).toBe(true);
    expect(await open(b.adapter, iextOnB.sub)).toBe(true);

    // 돌려주는 수는 이 인스턴스에서 닫은 수다.
    expect(a.adapter.closeTriggerTokenStreams([TRIGGER_1])).toBe(1);
    expect(onA.close).toHaveBeenCalledTimes(1);
    await flush();
    expect(onB.close).toHaveBeenCalledTimes(1);
    expect(otherTrigger.close).not.toHaveBeenCalled();
    expect(iextOnB.close).not.toHaveBeenCalled();
    expect(onA.close).toHaveBeenCalledTimes(1);
    expect(b.adapter.subscriberCount('exec-1')).toBe(1);
    expect(b.adapter.subscriberCount('exec-2')).toBe(1);
  });

  it('admit 을 기다리는 사이 닫히면 false 이고 잡은 자리를 돌려준다', async () => {
    const s = makeSub('exec-1', { family: 'itk', triggerId: TRIGGER_1 });
    const admitting = b.adapter.admit(s.sub);
    b.adapter.closeTriggerTokenStreams([TRIGGER_1]);
    expect(s.close).toHaveBeenCalledTimes(1);
    expect(await admitting).toBe(false);
    expect(server.zsets.get(sseConnectionSlotsKey('exec-1'))?.size ?? 0).toBe(
      0,
    );
  });

  it('replay 를 읽는 사이 닫히면 아무것도 보내지 않는다', async () => {
    a.subject.next(ev('exec-1', 'execution.started', 1));
    await flush();
    const s = makeSub('exec-1', { family: 'itk', triggerId: TRIGGER_1 });
    server.beforeXrange = () => {
      server.beforeXrange = null;
      b.adapter.closeTriggerTokenStreams([TRIGGER_1]);
      return Promise.resolve();
    };
    await open(b.adapter, s.sub, 0);
    expect(s.pushed).toEqual([]);
    expect(s.close).toHaveBeenCalledTimes(1);
    expect(server.subscriberCount(sseLiveChannel('exec-1'))).toBe(0);
  });

  describe('연결 상한', () => {
    const key = sseConnectionSlotsKey('exec-1');

    it('모든 인스턴스를 합쳐 실행당 3개까지 받는다', async () => {
      const a1 = makeSub('exec-1');
      expect(await a.adapter.admit(a1.sub)).toBe(true);
      expect(await a.adapter.admit(makeSub('exec-1').sub)).toBe(true);
      expect(await b.adapter.admit(makeSub('exec-1').sub)).toBe(true);
      const rejected = makeSub('exec-1');
      expect(await b.adapter.admit(rejected.sub)).toBe(false);
      expect(await a.adapter.admit(makeSub('exec-1').sub)).toBe(false);
      expect(b.adapter.subscriberCount('exec-1')).toBe(1);
      expect(server.zsets.get(key)?.has(rejected.sub.id)).toBe(false);
      expectTtlNear(server.pttl(key), 45_000);

      a.adapter.unsubscribe(a1.sub);
      expect(await b.adapter.admit(makeSub('exec-1').sub)).toBe(true);
    });

    it('heartbeat 가 45초 넘게 끊긴 자리는 세지 않는다', async () => {
      const stale = makeSub('exec-1');
      await a.adapter.admit(stale.sub);
      await a.adapter.admit(makeSub('exec-1').sub);
      await a.adapter.admit(makeSub('exec-1').sub);
      server.zsets.get(key)!.set(stale.sub.id, Date.now() - 46_000);
      expect(await b.adapter.admit(makeSub('exec-1').sub)).toBe(true);
      expect(server.zsets.get(key)?.has(stale.sub.id)).toBe(false);
    });

    it('touch 가 자리의 시각과 키 TTL 을 갱신한다', async () => {
      const s = makeSub('exec-1');
      await a.adapter.admit(s.sub);
      server.zsets.get(key)!.set(s.sub.id, 0);
      server.expiresAt.set(key, Date.now() + 1_000);
      a.adapter.touch(s.sub);
      await flush();
      expect(server.zsets.get(key)?.get(s.sub.id)).toBeGreaterThan(
        Date.now() - 1_000,
      );
      expectTtlNear(server.pttl(key), 45_000);
    });

    it('종료 이벤트 뒤 자리를 돌려준다', async () => {
      const s = makeSub('exec-1');
      await open(a.adapter, s.sub);
      expect(server.zsets.get(key)?.has(s.sub.id)).toBe(true);
      a.subject.next(ev('exec-1', 'execution.failed', 1));
      expect(server.zsets.get(key)?.has(s.sub.id)).toBe(false);
      expect(server.subscriberCount(sseLiveChannel('exec-1'))).toBe(0);
    });

    it('onModuleDestroy 가 잡은 자리를 돌려준다', async () => {
      const s = makeSub('exec-1');
      await open(a.adapter, s.sub);
      a.adapter.onModuleDestroy();
      expect(server.zsets.get(key)?.has(s.sub.id)).toBe(false);
    });
  });

  // 근거: NERV Task `CLE-T-Z35F7P` — 버퍼 키는 마지막 이벤트 뒤 5분에 사라진다. 그 뒤 재연결은 실행의 순번 카운터와 견준다.
  describe('버퍼 키가 없을 때 재연결', () => {
    const seqKey = 'exec:seq:exec-1';

    it('카운터가 lastEventId 와 같으면 놓친 이벤트가 없다', async () => {
      server.strings.set(seqKey, '5');
      const s = makeSub('exec-1');
      await open(b.adapter, s.sub, 5);
      expect(s.pushed).toEqual([]);
    });

    it('카운터가 lastEventId 보다 크면 replay_unavailable', async () => {
      server.strings.set(seqKey, '7');
      const s = makeSub('exec-1');
      await open(b.adapter, s.sub, 5);
      expect(s.pushed.map((e) => e.eventType)).toEqual([REPLAY_UNAVAILABLE]);
      expect(s.pushed[0].payload).toMatchObject({ lastEventId: 5 });
    });

    it('카운터도 없으면(종료 뒤 지움 · 만료) replay_unavailable', async () => {
      const s = makeSub('exec-1');
      await open(b.adapter, s.sub, 5);
      expect(s.pushed.map((e) => e.eventType)).toEqual([REPLAY_UNAVAILABLE]);
    });

    it('버퍼를 읽는 사이 live 로 받은 이벤트가 빈 구간을 다 채우면 신호를 보내지 않는다', async () => {
      server.strings.set(seqKey, '6');
      server.beforeXrange = async () => {
        server.beforeXrange = null;
        a.subject.next(ev('exec-1', 'execution.node.started', 6));
        await flush();
        // 버퍼 키가 그 사이 만료됐다.
        server.streams.delete(sseBufferKey('exec-1'));
      };
      const s = makeSub('exec-1');
      await open(b.adapter, s.sub, 5);
      expect(s.pushed.map((e) => e.seq)).toEqual([6]);
    });

    it('버퍼를 다 읽었고 비어 있지 않으면 카운터를 보지 않는다', async () => {
      a.subject.next(ev('exec-1', 'execution.started', 1));
      a.subject.next(ev('exec-1', 'execution.node.started', 2));
      await flush();
      // 카운터가 없어도(읽었다면 신호) 버퍼의 마지막이 lastEventId 다.
      const s = makeSub('exec-1');
      await open(b.adapter, s.sub, 2);
      expect(s.pushed).toEqual([]);
    });
  });

  // 근거: NERV Task `CLE-T-Z35F7P` — Redis 명령이 실패해도 요청은 실패하지 않는다. 이 서버 인스턴스의 메모리로 동작한다.
  describe('Redis 장애', () => {
    let warn: jest.SpyInstance;
    let log: jest.SpyInstance;

    beforeEach(() => {
      warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
    });
    afterEach(async () => {
      // 바깥 afterEach 의 정리가 경고를 남기지 않게 먼저 되돌린다.
      server.failing = false;
      await flush();
      warn.mockRestore();
      log.mockRestore();
    });

    function warnings(op: string): unknown[][] {
      return warn.mock.calls.filter(([m]) => String(m).includes(op));
    }

    it('버퍼에 넣지 못하면 로컬 구독자에게는 그대로 보내고 메모리 버퍼에 둔다', async () => {
      const onA = makeSub('exec-1');
      await open(a.adapter, onA.sub);
      server.failing = true;
      a.subject.next(ev('exec-1', 'execution.started', 1));
      a.subject.next(ev('exec-1', 'execution.node.started', 2));
      expect(onA.pushed.map((e) => e.seq)).toEqual([1, 2]);
      await flush();
      expect(a.adapter.bufferSize('exec-1')).toBe(2);
      expect(warnings('버퍼 쓰기')).toHaveLength(1);

      server.failing = false;
      a.subject.next(ev('exec-1', 'execution.node.completed', 3));
      await flush();
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('버퍼 쓰기 복구'),
      );

      // 같은 인스턴스로 다시 연결하면 메모리 버퍼와 Redis 버퍼를 합쳐 replay 한다.
      const again = makeSub('exec-1');
      await open(a.adapter, again.sub, 1);
      expect(again.pushed.map((e) => e.seq)).toEqual([2, 3]);

      // 다른 인스턴스는 메모리에 남은 이벤트를 모른다. 구간이 비므로 재조회 신호를 보낸다.
      const onB = makeSub('exec-1');
      await open(b.adapter, onB.sub, 1);
      expect(onB.pushed.map((e) => e.eventType)).toEqual([REPLAY_UNAVAILABLE]);
    });

    // XADD 만 실패하면 버퍼에 없으므로 메모리 버퍼가 받는다. 그래야 같은 인스턴스로 다시 연결했을 때 replay 에서 빠지지 않는다.
    it('XADD 만 실패하면 메모리 버퍼에 두고 PEXPIRE · PUBLISH 만 실패하면 두지 않는다', async () => {
      server.failPipelineCommands.add('xadd');
      a.subject.next(ev('exec-1', 'execution.started', 1));
      await flush();
      expect(a.adapter.bufferSize('exec-1')).toBe(1);
      expect(warnings('버퍼 쓰기')).toHaveLength(1);

      server.failPipelineCommands.clear();
      server.failPipelineCommands.add('pexpire');
      server.failPipelineCommands.add('publish');
      a.subject.next(ev('exec-1', 'execution.node.started', 2));
      await flush();
      // Redis 버퍼에 들어갔으니 메모리 버퍼는 그대로 1건이다.
      expect(a.adapter.bufferSize('exec-1')).toBe(1);
      expect(server.streams.get(sseBufferKey('exec-1'))).toHaveLength(1);

      // 같은 인스턴스로 다시 연결하면 두 버퍼를 합쳐 빠짐없이 replay 한다.
      server.failPipelineCommands.clear();
      const again = makeSub('exec-1');
      await open(a.adapter, again.sub, 0);
      expect(again.pushed.map((e) => e.seq)).toEqual([1, 2]);
    });

    it('exec() 가 결과 없이 끝나도 메모리 버퍼에 둔다', async () => {
      server.pipelineExecReturnsNull = true;
      a.subject.next(ev('exec-1', 'execution.started', 1));
      await flush();
      expect(a.adapter.bufferSize('exec-1')).toBe(1);
    });

    // `append` 는 던지지 않는 계약이라 `JSON.stringify` 가 던지는 payload(BigInt)도 `false` 로 끝난다.
    it('JSON 으로 바꾸지 못하는 이벤트도 로컬 구독자에게 보내고 메모리 버퍼에 둔다', async () => {
      const onA = makeSub('exec-1');
      await open(a.adapter, onA.sub);
      a.subject.next({
        executionId: 'exec-1',
        eventType: 'execution.node.started',
        seq: 1,
        payload: { big: BigInt(1) },
      });
      expect(onA.pushed.map((e) => e.seq)).toEqual([1]);
      await flush();
      expect(a.adapter.bufferSize('exec-1')).toBe(1);
      expect(server.streams.get(sseBufferKey('exec-1'))).toBeUndefined();
    });

    it('append 가 계약을 어기고 거부돼도 메모리 버퍼에 둔다', async () => {
      const appendSpy = jest
        .spyOn(a.fanout, 'append')
        .mockRejectedValueOnce(new Error('append 가 던졌다'));
      a.subject.next(ev('exec-1', 'execution.started', 1));
      await flush();
      expect(appendSpy).toHaveBeenCalledTimes(1);
      expect(a.adapter.bufferSize('exec-1')).toBe(1);
      appendSpy.mockRestore();
    });

    it('연결 상한을 세지 못하면 이 서버 인스턴스 안에서 센다', async () => {
      server.failing = true;
      expect(await a.adapter.admit(makeSub('exec-1').sub)).toBe(true);
      expect(await a.adapter.admit(makeSub('exec-1').sub)).toBe(true);
      expect(await a.adapter.admit(makeSub('exec-1').sub)).toBe(true);
      expect(await a.adapter.admit(makeSub('exec-1').sub)).toBe(false);
      expect(warnings('연결 상한')).toHaveLength(1);
    });

    it('버퍼를 읽지 못하면 replay_unavailable 을 보내고 실시간 전달은 이어 간다', async () => {
      server.failing = true;
      const s = makeSub('exec-1');
      await open(a.adapter, s.sub, 3);
      expect(s.pushed.map((e) => e.eventType)).toEqual([REPLAY_UNAVAILABLE]);
      a.subject.next(ev('exec-1', 'execution.node.started', 4));
      expect(s.pushed.map((e) => e.seq)).toEqual([0, 4]);
    });
  });
});
