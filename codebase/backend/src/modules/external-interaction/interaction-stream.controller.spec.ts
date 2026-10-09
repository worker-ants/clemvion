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
  } {
    const subject = new Subject<ExecutionChannelEvent>();
    const adapter = new SseAdapter({
      executionEvents$: subject.asObservable(),
    } as unknown as WebsocketService);
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
    return { adapter, end };
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
    adapter.closeTriggerTokenStreams(['trg-1']);
    expect(jest.getTimerCount()).toBe(0);
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
