import type { Response } from 'express';
import { writeSseFrame } from './interaction-stream.controller';
import type { ExecutionChannelEvent } from '../websocket/websocket.service';

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
