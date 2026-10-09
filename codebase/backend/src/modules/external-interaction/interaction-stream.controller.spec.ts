import { Subject } from 'rxjs';
import type { Response } from 'express';
import {
  InteractionStreamController,
  writeSseFrame,
} from './interaction-stream.controller';
import { SseAdapter } from './sse-adapter.service';
import type { RequestWithInteraction } from './interaction.guard';
import type { ExternalInteractionRequestContext } from './interaction.guard';
import type { WebsocketService } from '../websocket/websocket.service';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';

// 근거: [EIA 데이터와 흐름 「트리거 단위 토큰」](CLE-EIA-DATA#트리거-단위-토큰) — 트리거 단위 토큰이 무효가 되면
// 그 토큰으로 연 스트림을 서버가 닫는다(응답 종료). 실행 단위 토큰으로 연 스트림은 닫지 않는다.
describe('InteractionStreamController.stream — 트리거 단위 토큰 무효 때 닫기', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function openStream(ctx: ExternalInteractionRequestContext): {
    adapter: SseAdapter;
    end: jest.Mock;
    subject: Subject<ExecutionChannelEvent>;
  } {
    const subject = new Subject<ExecutionChannelEvent>();
    const adapter = new SseAdapter({
      executionEvents$: subject.asObservable(),
    } as unknown as WebsocketService);
    // 실행 이벤트 구독을 연다 — 이벤트를 `subject.next` 로 흘려 보내는 테스트가 쓴다.
    adapter.onModuleInit();
    const controller = new InteractionStreamController(adapter);
    const end = jest.fn();
    const res = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(() => true),
      end,
      status: jest.fn(() => ({ json: jest.fn(), end: jest.fn() })),
    } as unknown as Response;
    const req = {
      interaction: ctx,
      query: {},
      on: jest.fn(),
    } as unknown as RequestWithInteraction;
    controller.stream(ctx.executionId, req, res);
    return { adapter, end, subject };
  }

  it('트리거 단위 토큰으로 연 스트림은 그 트리거를 닫으면 응답을 끝낸다', () => {
    const { adapter, end } = openStream({
      executionId: 'exec-1',
      tokenFamily: 'itk',
      triggerId: 'trg-1',
    });
    expect(adapter.subscriberCount('exec-1')).toBe(1);
    expect(adapter.closeTriggerTokenStreams(['trg-1'])).toBe(1);
    expect(end).toHaveBeenCalledTimes(1);
    expect(adapter.subscriberCount('exec-1')).toBe(0);
  });

  it('실행 단위 토큰으로 연 스트림은 닫지 않는다', () => {
    const { adapter, end } = openStream({
      executionId: 'exec-1',
      tokenFamily: 'iext',
      triggerId: null,
    });
    expect(adapter.closeTriggerTokenStreams(['trg-1'])).toBe(0);
    expect(end).not.toHaveBeenCalled();
    expect(adapter.subscriberCount('exec-1')).toBe(1);
  });

  it('닫은 뒤에는 heartbeat 를 쓰지 않는다', () => {
    const { adapter } = openStream({
      executionId: 'exec-1',
      tokenFamily: 'itk',
      triggerId: 'trg-1',
    });
    // 사전 조건 — heartbeat 타이머가 실제로 돌고 있었다. 이게 없으면 아래 0 은 «처음부터 없었다» 와 구분되지 않는다.
    expect(jest.getTimerCount()).toBe(1);
    adapter.closeTriggerTokenStreams(['trg-1']);
    expect(jest.getTimerCount()).toBe(0);
  });
});

// 스트림 컨트롤러의 정리를 `end` 하나로 뽑으면서 terminal 이벤트 뒤 자동 종료도 같은 `end` 를 쓰게 됐다. 그 경로를
// 지켜 둔다: `setImmediate(end)` 를 비워도 다른 테스트는 모두 통과했다.
describe('InteractionStreamController.stream — terminal 이벤트 뒤 자동 종료', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function openStreamWithEvents(): {
    adapter: SseAdapter;
    end: jest.Mock;
    emit: (eventType: string) => void;
  } {
    const subject = new Subject<ExecutionChannelEvent>();
    const adapter = new SseAdapter({
      executionEvents$: subject.asObservable(),
    } as unknown as WebsocketService);
    adapter.onModuleInit();
    const controller = new InteractionStreamController(adapter);
    const end = jest.fn();
    const res = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(() => true),
      end,
      status: jest.fn(() => ({ json: jest.fn(), end: jest.fn() })),
    } as unknown as Response;
    const req = {
      interaction: {
        executionId: 'exec-1',
        tokenFamily: 'iext',
        triggerId: null,
      },
      query: {},
      on: jest.fn(),
    } as unknown as RequestWithInteraction;
    controller.stream('exec-1', req, res);
    let seq = 0;
    return {
      adapter,
      end,
      emit: (eventType) =>
        subject.next({
          executionId: 'exec-1',
          eventType,
          seq: ++seq,
          payload: {},
        } as ExecutionChannelEvent),
    };
  }

  it.each(['execution.completed', 'execution.failed', 'execution.cancelled'])(
    '%s 를 보내면 응답을 한 번 끝내고 구독을 해제하고 heartbeat 를 멈춘다',
    (eventType) => {
      const { adapter, end, emit } = openStreamWithEvents();
      expect(adapter.subscriberCount('exec-1')).toBe(1);
      expect(jest.getTimerCount()).toBe(1);

      emit(eventType);
      // `setImmediate(end)` — 이벤트를 쓴 직후가 아니라 다음 턴에 끝낸다.
      expect(end).not.toHaveBeenCalled();
      jest.runOnlyPendingTimers();

      expect(end).toHaveBeenCalledTimes(1);
      expect(adapter.subscriberCount('exec-1')).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  it('terminal 이 아닌 이벤트는 응답을 끝내지 않는다 (대조군)', () => {
    const { adapter, end, emit } = openStreamWithEvents();
    emit('execution.started');
    jest.runOnlyPendingTimers();
    expect(end).not.toHaveBeenCalled();
    expect(adapter.subscriberCount('exec-1')).toBe(1);
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
