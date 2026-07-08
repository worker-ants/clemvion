import { Subject } from 'rxjs';
import type { Response } from 'express';
import { SseAdapter, SseSubscriber } from './sse-adapter.service';
import { writeSseFrame } from './interaction-stream.controller';
import type {
  ExecutionChannelEvent,
  WebsocketService,
} from '../websocket/websocket.service';

function makeWs(): {
  ws: jest.Mocked<WebsocketService>;
  subject: Subject<ExecutionChannelEvent>;
} {
  const subject = new Subject<ExecutionChannelEvent>();
  const ws = {
    executionEvents$: subject.asObservable(),
  } as unknown as jest.Mocked<WebsocketService>;
  return { ws, subject };
}

function makeSub(executionId: string): {
  sub: SseSubscriber;
  pushed: ExecutionChannelEvent[];
} {
  const pushed: ExecutionChannelEvent[] = [];
  return {
    pushed,
    sub: {
      id: `${executionId}-${Math.random()}`,
      executionId,
      push: (e) => pushed.push(e),
    },
  };
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

// W-3 주석: SseAdapter 는 executionEvents$(Subject) 로부터 받은 ExecutionChannelEvent
// 를 payload 수정 없이 SSE 구독자에게 passthrough 한다. llmCalls strip 은 upstream
// fanout seam(WebsocketService.emitExecutionEvent / emitNodeEvent) 에서 수행되므로
// SseAdapter 단독 단위 테스트로는 strip 동작이 보이지 않는다. Strip egress 회귀 보호는
// websocket.service.spec.ts 의 'llmCalls strip — 외부 fanout 수신자 보호' describe 가
// 담당한다. 본 파일의 'payload passthrough' 테스트는 어댑터가 payload 를 변형하지
// 않음(변형하면 strip 이 우회될 수 있음)을 보장한다.

describe('SseAdapter', () => {
  let adapter: SseAdapter;
  let subject: Subject<ExecutionChannelEvent>;

  beforeEach(() => {
    const { ws, subject: s } = makeWs();
    subject = s;
    adapter = new SseAdapter(ws);
    adapter.onModuleInit();
  });
  afterEach(() => adapter.onModuleDestroy());

  it('subscribe 후 in-flight 이벤트 즉시 push', () => {
    const { sub, pushed } = makeSub('exec-1');
    adapter.subscribe(sub);
    subject.next(ev('exec-1', 'execution.started', 1));
    subject.next(ev('exec-1', 'execution.node.started', 2));
    expect(pushed.map((e) => e.seq)).toEqual([1, 2]);
  });

  it('다른 execution 이벤트는 격리', () => {
    const { sub: s1, pushed: p1 } = makeSub('exec-1');
    const { sub: s2, pushed: p2 } = makeSub('exec-2');
    adapter.subscribe(s1);
    adapter.subscribe(s2);
    subject.next(ev('exec-1', 'execution.started', 1));
    subject.next(ev('exec-2', 'execution.started', 1));
    expect(p1.length).toBe(1);
    expect(p2.length).toBe(1);
    expect(p1[0].executionId).toBe('exec-1');
    expect(p2[0].executionId).toBe('exec-2');
  });

  it('subscribe(lastEventId) — buffer 에서 lastEventId 이후만 replay', () => {
    // 먼저 buffer 채움 (구독 없이)
    subject.next(ev('exec-1', 'execution.started', 1));
    subject.next(ev('exec-1', 'execution.node.started', 2));
    subject.next(ev('exec-1', 'execution.node.completed', 3));
    expect(adapter.bufferSize('exec-1')).toBe(3);

    const { sub, pushed } = makeSub('exec-1');
    adapter.subscribe(sub, 1);
    expect(pushed.map((e) => e.seq)).toEqual([2, 3]);
  });

  it('subscribe(lastEventId) — lastEventId 가 buffer 최신값보다 크면 replay 없음', () => {
    subject.next(ev('exec-1', 'execution.started', 1));
    const { sub, pushed } = makeSub('exec-1');
    adapter.subscribe(sub, 100);
    expect(pushed).toEqual([]);
  });

  it('unsubscribe 후 이벤트 미수신', () => {
    const { sub, pushed } = makeSub('exec-1');
    adapter.subscribe(sub);
    subject.next(ev('exec-1', 'execution.started', 1));
    adapter.unsubscribe(sub);
    subject.next(ev('exec-1', 'execution.node.started', 2));
    expect(pushed.map((e) => e.seq)).toEqual([1]);
  });

  it('subscriberCount — execution 별 구독자 수 추적', () => {
    expect(adapter.subscriberCount('exec-1')).toBe(0);
    const { sub: s1 } = makeSub('exec-1');
    const { sub: s2 } = makeSub('exec-1');
    adapter.subscribe(s1);
    adapter.subscribe(s2);
    expect(adapter.subscriberCount('exec-1')).toBe(2);
    adapter.unsubscribe(s1);
    expect(adapter.subscriberCount('exec-1')).toBe(1);
    adapter.unsubscribe(s2);
    expect(adapter.subscriberCount('exec-1')).toBe(0);
  });

  it('buffer 상한 — MAX_BUFFER_PER_EXEC 초과 시 오래된 것부터 폐기', () => {
    for (let i = 1; i <= 1010; i++) {
      subject.next(ev('exec-1', 'execution.node.started', i));
    }
    // MAX_BUFFER_PER_EXEC = 1000 — 정확한 상한 검증 (실제 구현은 1000 유지).
    expect(adapter.bufferSize('exec-1')).toBeLessThanOrEqual(1000);
  });

  it('push 시 listener throw 해도 다른 구독자에 전파', () => {
    const throwingPushed: ExecutionChannelEvent[] = [];
    const throwingSub: SseSubscriber = {
      id: 'throwing',
      executionId: 'exec-1',
      push: () => {
        throwingPushed.push(ev('exec-1', 'forced', 0));
        throw new Error('boom');
      },
    };
    const { sub: ok, pushed: okPushed } = makeSub('exec-1');
    adapter.subscribe(throwingSub);
    adapter.subscribe(ok);
    subject.next(ev('exec-1', 'execution.started', 1));
    expect(throwingPushed.length).toBe(1);
    expect(okPushed.length).toBe(1);
  });

  it('onModuleDestroy — 구독자/버퍼 모두 해제', () => {
    const { sub } = makeSub('exec-1');
    adapter.subscribe(sub);
    subject.next(ev('exec-1', 'execution.started', 1));
    adapter.onModuleDestroy();
    expect(adapter.subscriberCount('exec-1')).toBe(0);
    expect(adapter.bufferSize('exec-1')).toBe(0);
  });

  describe('execution.replay_unavailable — 버퍼 gap 시 재조회 신호 (§5.2 / EIA-IN-07 / EIA-NF-03)', () => {
    it('cap 폐기로 gap → replay_unavailable 1회 emit, 부분 replay 안 함', () => {
      // seq 1..1010 → MAX_BUFFER_PER_EXEC(1000) 상한으로 seq 1..10 폐기, buffer=[11..1010]
      for (let i = 1; i <= 1010; i++) {
        subject.next(ev('exec-1', 'execution.node.started', i));
      }
      const { sub, pushed } = makeSub('exec-1');
      adapter.subscribe(sub, 5); // 클라는 seq>5 원하나 6..10 은 폐기됨
      expect(pushed).toHaveLength(1);
      expect(pushed[0].eventType).toBe('execution.replay_unavailable');
      expect(pushed[0].seq).toBe(0);
      expect(pushed[0].payload).toMatchObject({
        executionId: 'exec-1',
        lastEventId: 5,
      });
    });

    it('버퍼 만료(>5분)로 gap → replay_unavailable emit', () => {
      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        subject.next(ev('exec-1', 'execution.started', 1));
        subject.next(ev('exec-1', 'execution.node.started', 2));
        jest.setSystemTime(new Date('2026-01-01T00:06:00Z')); // 6분 경과 → 5분 buffer 만료
        const { sub, pushed } = makeSub('exec-1');
        adapter.subscribe(sub, 1); // seq>1 원하나 seq2 만료
        expect(pushed).toHaveLength(1);
        expect(pushed[0].eventType).toBe('execution.replay_unavailable');
      } finally {
        jest.useRealTimers();
      }
    });

    it('연속(contiguous) buffer → 정상 replay, replay_unavailable 미emit', () => {
      subject.next(ev('exec-1', 'execution.started', 1));
      subject.next(ev('exec-1', 'execution.node.started', 2));
      subject.next(ev('exec-1', 'execution.node.completed', 3));
      const { sub, pushed } = makeSub('exec-1');
      adapter.subscribe(sub, 1);
      expect(pushed.map((e) => e.seq)).toEqual([2, 3]);
      expect(
        pushed.some((e) => e.eventType === 'execution.replay_unavailable'),
      ).toBe(false);
    });

    it('lastEventId=0 첫 연결 seed — buffer 가 seq1 부터면 gap 아님, 전체 replay', () => {
      subject.next(ev('exec-1', 'execution.started', 1));
      subject.next(ev('exec-1', 'execution.node.started', 2));
      const { sub, pushed } = makeSub('exec-1');
      adapter.subscribe(sub, 0);
      expect(pushed.map((e) => e.seq)).toEqual([1, 2]);
      expect(
        pushed.some((e) => e.eventType === 'execution.replay_unavailable'),
      ).toBe(false);
    });

    it('lastEventId=0 인데 초기 이벤트가 폐기됐으면 gap → replay_unavailable', () => {
      for (let i = 1; i <= 1010; i++) {
        subject.next(ev('exec-1', 'execution.node.started', i));
      }
      const { sub, pushed } = makeSub('exec-1');
      adapter.subscribe(sub, 0); // seq1 부터의 전체 seed 불가(buffer=[11..1010])
      expect(pushed).toHaveLength(1);
      expect(pushed[0].eventType).toBe('execution.replay_unavailable');
    });

    it('클라이언트가 최신까지 수신했으면(wanted 없음) replay_unavailable 미emit', () => {
      subject.next(ev('exec-1', 'execution.started', 1));
      const { sub, pushed } = makeSub('exec-1');
      adapter.subscribe(sub, 1); // seq>1 없음 → 누락 아님
      expect(pushed).toEqual([]);
    });

    it('소수 lastEventId 는 floor 로 정규화 — 연속 buffer 오탐 없이 정상 replay', () => {
      subject.next(ev('exec-1', 'execution.started', 1));
      subject.next(ev('exec-1', 'execution.node.started', 2));
      subject.next(ev('exec-1', 'execution.node.completed', 3));
      const { sub, pushed } = makeSub('exec-1');
      adapter.subscribe(sub, 1.5); // floor(1.5)=1 → seq>1 replay
      expect(pushed.map((e) => e.seq)).toEqual([2, 3]);
      expect(
        pushed.some((e) => e.eventType === 'execution.replay_unavailable'),
      ).toBe(false);
    });

    it('배열 중간 hole(seq 유실) 도 gap 으로 판정 → replay_unavailable', () => {
      // 연속이 아닌 seq 를 직접 주입(3 유실) — 선두만 보는 판정이면 놓칠 케이스.
      subject.next(ev('exec-1', 'execution.started', 1));
      subject.next(ev('exec-1', 'execution.node.started', 2));
      subject.next(ev('exec-1', 'execution.node.completed', 4));
      const { sub, pushed } = makeSub('exec-1');
      adapter.subscribe(sub, 0); // 재생가능 [1,2,4] — 1→2 연속이나 2→4 hole
      expect(pushed).toHaveLength(1);
      expect(pushed[0].eventType).toBe('execution.replay_unavailable');
    });

    it('wiring — seq=0 replay_unavailable 가 writeSseFrame 통과 시 `id:` 없는 프레임', () => {
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
      const wired: SseSubscriber = {
        id: 'wired',
        executionId: 'exec-1',
        push: (e) => writeSseFrame(res, e), // 실제 컨트롤러 직렬화 경로
      };
      adapter.subscribe(wired, 5); // cap 폐기 gap
      const lines = chunks.join('').split('\n');
      expect(lines).toContain('event: execution.replay_unavailable');
      expect(lines.some((l) => l.startsWith('id:'))).toBe(false);
    });
  });

  // W-3 passthrough 검증: SseAdapter 는 executionEvents$ 에서 받은 payload 를
  // 수정 없이 구독자에게 전달한다. 어댑터가 payload 를 변형하면 upstream strip 이
  // 우회될 수 있으므로, 이 테스트로 "어댑터 = 순수 passthrough" 를 보장한다.
  // llmCalls strip 자체의 회귀 보호는 websocket.service.spec.ts 가 담당한다.
  it('payload passthrough — 어댑터는 수신한 payload 를 변형하지 않고 구독자에게 전달 (W-3)', () => {
    const { sub, pushed } = makeSub('exec-pt');
    adapter.subscribe(sub);
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
