import { UnauthorizedException } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { Response } from 'express';
import {
  InteractionStreamController,
  writeSseFrame,
} from './interaction-stream.controller';
import { SseAdapter, type SseSubscriber } from './sse-adapter.service';
import { SseFanoutService } from './sse-fanout.service';
import type {
  ExternalInteractionRequestContext,
  InteractionGuard,
  RequestWithInteraction,
} from './interaction.guard';
import type { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';
import type { WebsocketService } from '../websocket/websocket.service';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';

const ITK_CTX: ExternalInteractionRequestContext = {
  executionId: 'exec-1',
  tokenFamily: 'itk',
  triggerId: 'trg-1',
};
const IEXT_CTX: ExternalInteractionRequestContext = {
  executionId: 'exec-1',
  tokenFamily: 'iext',
  triggerId: null,
};

interface Harness {
  adapter: SseAdapter;
  subject: Subject<ExecutionChannelEvent>;
  guard: {
    reverifyTriggerToken: jest.Mock<Promise<void>, [RequestWithInteraction]>;
    rejectTriggerToken: jest.Mock<never, [RequestWithInteraction]>;
  };
  controller: InteractionStreamController;
  /** 어댑터의 메모리 버퍼 정리 타이머 수. heartbeat 가 돌면 여기에 1 이 더해진다. */
  baseTimers: number;
}

/** 메모리 모드 어댑터와 가드 대역으로 컨트롤러를 만든다. 가짜 타이머를 먼저 켜야 타이머 수를 셀 수 있다. */
function makeHarness(): Harness {
  const subject = new Subject<ExecutionChannelEvent>();
  const adapter = new SseAdapter(
    { executionEvents$: subject.asObservable() } as unknown as WebsocketService,
    new SseFanoutService({
      getClientOrNull: () => null,
    } as unknown as RedisConnectionProvider),
  );
  adapter.onModuleInit();
  const guard = {
    reverifyTriggerToken: jest.fn<Promise<void>, [RequestWithInteraction]>(() =>
      Promise.resolve(),
    ),
    rejectTriggerToken: jest.fn<never, [RequestWithInteraction]>(() => {
      throw new UnauthorizedException({
        error: { code: 'TOKEN_INVALID', message: 'Token rejected' },
      });
    }),
  };
  const controller = new InteractionStreamController(
    adapter,
    guard as unknown as InteractionGuard,
  );
  return {
    adapter,
    subject,
    guard,
    controller,
    baseTimers: jest.getTimerCount(),
  };
}

interface OpenedStream {
  /** `stream()` 의 Promise. 401 · 오류면 거부된다. */
  done: Promise<void>;
  res: {
    setHeader: jest.Mock;
    flushHeaders: jest.Mock;
    write: jest.Mock;
    end: jest.Mock;
    status: jest.Mock;
    json: jest.Mock;
  };
  /** 클라이언트가 연결을 끊는다. */
  disconnect: () => void;
}

function openStream(
  h: Harness,
  ctx: ExternalInteractionRequestContext,
  opts: { header?: string; query?: Record<string, string> } = {},
): OpenedStream {
  const res = {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(() => true),
    end: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  let onClose: (() => void) | null = null;
  const req = {
    interaction: ctx,
    query: opts.query ?? {},
    on: jest.fn((event: string, cb: () => void) => {
      if (event === 'close') onClose = cb;
    }),
  } as unknown as RequestWithInteraction;
  const done = h.controller.stream(
    ctx.executionId,
    req,
    res as unknown as Response,
    opts.header,
  );
  return { done, res, disconnect: () => onClose?.() };
}

function sentSseHeaders(res: OpenedStream['res']): boolean {
  return res.setHeader.mock.calls.some(
    ([name, value]) => name === 'Content-Type' && value === 'text/event-stream',
  );
}

// 근거: [EIA 데이터와 흐름 「트리거 단위 토큰」](CLE-EIA-DATA#트리거-단위-토큰) — 트리거 단위 토큰이 무효가 되면
// 그 토큰으로 연 스트림을 서버가 닫는다(응답 종료). 실행 단위 토큰으로 연 스트림은 닫지 않는다.
describe('InteractionStreamController.stream — 트리거 단위 토큰 무효 때 닫기', () => {
  let h: Harness;
  beforeEach(() => {
    jest.useFakeTimers();
    h = makeHarness();
  });
  afterEach(() => {
    h.adapter.onModuleDestroy();
    jest.useRealTimers();
  });

  it('트리거 단위 토큰으로 연 스트림은 그 트리거를 닫으면 응답을 끝낸다', async () => {
    const { done, res } = openStream(h, ITK_CTX);
    await done;
    expect(h.adapter.subscriberCount('exec-1')).toBe(1);
    expect(h.adapter.closeTriggerTokenStreams(['trg-1'])).toBe(1);
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(h.adapter.subscriberCount('exec-1')).toBe(0);
  });

  it('실행 단위 토큰으로 연 스트림은 닫지 않는다', async () => {
    const { done, res } = openStream(h, IEXT_CTX);
    await done;
    expect(h.adapter.closeTriggerTokenStreams(['trg-1'])).toBe(0);
    expect(res.end).not.toHaveBeenCalled();
    expect(h.adapter.subscriberCount('exec-1')).toBe(1);
  });

  it('닫은 뒤에는 heartbeat 를 쓰지 않는다', async () => {
    const { done } = openStream(h, ITK_CTX);
    await done;
    // 사전 조건 — heartbeat 타이머가 실제로 돌고 있었다. 이게 없으면 아래 값은 «처음부터 없었다» 와 구분되지 않는다.
    expect(jest.getTimerCount()).toBe(h.baseTimers + 1);
    h.adapter.closeTriggerTokenStreams(['trg-1']);
    expect(jest.getTimerCount()).toBe(h.baseTimers);
  });
});

// 근거: [EIA 데이터와 흐름 「트리거 단위 토큰」](CLE-EIA-DATA#트리거-단위-토큰), NERV Task `CLE-T-EQDYC1` — 가드를 통과한 뒤
// 구독을 등록하기 전에 토큰이 무효가 되면 닫기 신호가 그 구독자를 지나친다. 등록 뒤에 토큰을 다시 확인한다.
describe('InteractionStreamController.stream — 구독 등록 뒤 토큰 재확인', () => {
  let h: Harness;
  beforeEach(() => {
    jest.useFakeTimers();
    h = makeHarness();
  });
  afterEach(() => {
    h.adapter.onModuleDestroy();
    jest.useRealTimers();
  });

  it('구독자를 등록한 뒤에 다시 확인한다', async () => {
    let registeredAtCheck = -1;
    h.guard.reverifyTriggerToken.mockImplementation(() => {
      registeredAtCheck = h.adapter.subscriberCount('exec-1');
      return Promise.resolve();
    });
    const { done, res } = openStream(h, ITK_CTX);
    await done;
    expect(h.guard.reverifyTriggerToken).toHaveBeenCalledTimes(1);
    expect(registeredAtCheck).toBe(1);
    expect(sentSseHeaders(res)).toBe(true);
  });

  it('토큰이 무효면 401 을 던지고 구독을 풀고 SSE 를 시작하지 않는다', async () => {
    const rejected = new UnauthorizedException({
      error: { code: 'TOKEN_INVALID', message: 'Token rejected' },
    });
    h.guard.reverifyTriggerToken.mockRejectedValue(rejected);
    const { done, res } = openStream(h, ITK_CTX);
    await expect(done).rejects.toBe(rejected);
    expect(h.adapter.subscriberCount('exec-1')).toBe(0);
    expect(sentSseHeaders(res)).toBe(false);
    expect(res.flushHeaders).not.toHaveBeenCalled();
    // 응답은 예외 필터가 쓴다. 컨트롤러는 끝내지 않는다.
    expect(res.end).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(h.baseTimers);
  });

  it('다시 확인하다 DB 오류가 나면 구독을 풀고 그 오류를 그대로 던진다', async () => {
    const dbError = new Error('db down');
    h.guard.reverifyTriggerToken.mockRejectedValue(dbError);
    const { done, res } = openStream(h, ITK_CTX);
    await expect(done).rejects.toBe(dbError);
    expect(h.adapter.subscriberCount('exec-1')).toBe(0);
    expect(sentSseHeaders(res)).toBe(false);
  });

  it('다시 확인하는 사이 닫기 신호가 오면 401 이다', async () => {
    h.guard.reverifyTriggerToken.mockImplementation(() => {
      h.adapter.closeTriggerTokenStreams(['trg-1']);
      return Promise.resolve();
    });
    const { done, res } = openStream(h, ITK_CTX);
    await expect(done).rejects.toBeInstanceOf(UnauthorizedException);
    expect(h.guard.rejectTriggerToken).toHaveBeenCalledTimes(1);
    expect(h.adapter.subscriberCount('exec-1')).toBe(0);
    expect(sentSseHeaders(res)).toBe(false);
    expect(jest.getTimerCount()).toBe(h.baseTimers);
  });

  it('연결 상한을 세는 사이 닫기 신호가 오면 다시 확인하지 않고 401 이다', async () => {
    const { done, res } = openStream(h, ITK_CTX);
    // `stream()` 은 등록까지 동기로 마치고 연결 상한 결과를 기다린다.
    h.adapter.closeTriggerTokenStreams(['trg-1']);
    await expect(done).rejects.toBeInstanceOf(UnauthorizedException);
    expect(h.guard.reverifyTriggerToken).not.toHaveBeenCalled();
    expect(sentSseHeaders(res)).toBe(false);
  });

  it('실행 단위 토큰은 다시 확인하지 않는다', async () => {
    const { done, res } = openStream(h, IEXT_CTX);
    await done;
    expect(h.guard.reverifyTriggerToken).not.toHaveBeenCalled();
    expect(sentSseHeaders(res)).toBe(true);
  });

  it('연결 상한이면 429 이고 다시 확인하지 않는다', async () => {
    for (let i = 0; i < 3; i++) {
      const sub: SseSubscriber = {
        id: `other-${i}`,
        executionId: 'exec-1',
        token: { family: 'iext' },
        push: jest.fn(),
        close: jest.fn(),
      };
      expect(await h.adapter.admit(sub)).toBe(true);
    }
    const { done, res } = openStream(h, ITK_CTX);
    await done;
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: 'TOO_MANY_CONNECTIONS' }),
    });
    expect(h.guard.reverifyTriggerToken).not.toHaveBeenCalled();
    expect(sentSseHeaders(res)).toBe(false);
    expect(h.adapter.subscriberCount('exec-1')).toBe(3);
  });

  it('연결 상한을 세는 사이 클라이언트가 끊으면 아무것도 쓰지 않고 끝낸다', async () => {
    const { done, res, disconnect } = openStream(h, ITK_CTX);
    disconnect();
    await done;
    expect(h.adapter.subscriberCount('exec-1')).toBe(0);
    expect(h.guard.reverifyTriggerToken).not.toHaveBeenCalled();
    expect(sentSseHeaders(res)).toBe(false);
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(h.baseTimers);
  });
});

describe('InteractionStreamController.stream — heartbeat 와 Last-Event-Id', () => {
  let h: Harness;
  beforeEach(() => {
    jest.useFakeTimers();
    h = makeHarness();
  });
  afterEach(() => {
    h.adapter.onModuleDestroy();
    jest.useRealTimers();
  });

  it('15초마다 heartbeat 를 쓰고 연결 상한 자리를 갱신한다', async () => {
    const touch = jest.spyOn(h.adapter, 'touch');
    const { done, res } = openStream(h, IEXT_CTX);
    await done;
    jest.advanceTimersByTime(14_999);
    expect(touch).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(res.write).toHaveBeenCalledWith(': heartbeat\n\n');
    expect(touch).toHaveBeenCalledTimes(1);
    expect(touch.mock.calls[0][0]).toMatchObject({ executionId: 'exec-1' });
  });

  it.each([
    ['헤더', { header: '5' }, 5],
    ['쿼리', { query: { lastEventId: '7' } }, 7],
    ['헤더가 쿼리보다 먼저', { header: '3', query: { lastEventId: '9' } }, 3],
    ['숫자가 아님', { header: 'abc' }, undefined],
    ['빈 값', { header: '' }, undefined],
    ['없음', {}, undefined],
  ])(
    'Last-Event-Id 를 읽어 replay 를 시작한다 — %s',
    async (_l, opts, want) => {
      const start = jest.spyOn(h.adapter, 'start');
      const { done } = openStream(h, IEXT_CTX, opts);
      await done;
      expect(start).toHaveBeenCalledTimes(1);
      expect(start.mock.calls[0][1]).toBe(want);
    },
  );
});

// 종료 이벤트 뒤 자동 종료는 어댑터가 구독을 풀고 다음 턴에 `close` 를 부르는 경로다. 그 경로가 응답을 끝내고
// heartbeat 를 멈추는지 지켜 둔다.
describe('InteractionStreamController.stream — terminal 이벤트 뒤 자동 종료', () => {
  let h: Harness;
  beforeEach(() => {
    jest.useFakeTimers();
    h = makeHarness();
  });
  afterEach(() => {
    h.adapter.onModuleDestroy();
    jest.useRealTimers();
  });

  function emit(eventType: string, seq: number): void {
    h.subject.next({
      executionId: 'exec-1',
      eventType,
      seq,
      payload: {},
    });
  }

  it.each(['execution.completed', 'execution.failed', 'execution.cancelled'])(
    '%s 를 보내면 응답을 한 번 끝내고 구독을 해제하고 heartbeat 를 멈춘다',
    async (eventType) => {
      const { done, res } = openStream(h, IEXT_CTX);
      await done;
      expect(h.adapter.subscriberCount('exec-1')).toBe(1);
      expect(jest.getTimerCount()).toBe(h.baseTimers + 1);

      emit(eventType, 1);
      // 이벤트를 쓴 직후가 아니라 다음 턴에 끝낸다.
      expect(res.end).not.toHaveBeenCalled();
      jest.runOnlyPendingTimers();

      expect(res.end).toHaveBeenCalledTimes(1);
      expect(h.adapter.subscriberCount('exec-1')).toBe(0);
      expect(jest.getTimerCount()).toBe(h.baseTimers);
    },
  );

  it('terminal 이 아닌 이벤트는 응답을 끝내지 않는다 (대조군)', async () => {
    const { done, res } = openStream(h, IEXT_CTX);
    await done;
    emit('execution.started', 1);
    jest.runOnlyPendingTimers();
    expect(res.end).not.toHaveBeenCalled();
    expect(h.adapter.subscriberCount('exec-1')).toBe(1);
  });
});

function fakeRes(): { res: Response; out: () => string } {
  const chunks: string[] = [];
  const res = {
    write: (s: string) => {
      chunks.push(s);
      return true;
    },
  } as unknown as Response;
  return { res, out: () => chunks.join('') };
}

function frameLines(out: string): string[] {
  return out.split('\n');
}

describe('writeSseFrame (§5.2 SSE frame `id:` 규약)', () => {
  it('실행-scope monotonic seq(>0) 이벤트는 id: 라인 포함', () => {
    const { res, out } = fakeRes();
    const event: ExecutionChannelEvent = {
      executionId: 'e',
      eventType: 'execution.started',
      seq: 3,
      payload: { a: 1 },
    };
    writeSseFrame(res, event);
    const lines = frameLines(out());
    expect(lines).toContain('event: execution.started');
    expect(lines).toContain('id: 3');
    expect(lines).toContain('data: {"a":1}');
  });

  it('control frame(execution.replay_unavailable, seq=0)은 id: 라인 생략', () => {
    const { res, out } = fakeRes();
    const event: ExecutionChannelEvent = {
      executionId: 'e',
      eventType: 'execution.replay_unavailable',
      seq: 0,
      payload: { executionId: 'e', lastEventId: 5 },
    };
    writeSseFrame(res, event);
    const lines = frameLines(out());
    expect(lines).toContain('event: execution.replay_unavailable');
    // seq<=0 → id: 라인 없음 (client Last-Event-Id 오염 방지)
    expect(lines.some((l) => l.startsWith('id:'))).toBe(false);
    expect(lines).toContain('data: {"executionId":"e","lastEventId":5}');
  });

  it('frame 은 빈 줄로 종료 (SSE 프레임 구분자)', () => {
    const { res, out } = fakeRes();
    writeSseFrame(res, {
      executionId: 'e',
      eventType: 'execution.completed',
      seq: 9,
      payload: {},
    });
    expect(out().endsWith('\n\n')).toBe(true);
  });
});
