import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';
import type { BufferedSseEvent } from './sse-replay-buffer';
import {
  mayHaveMissed,
  planReplay,
  type SseBufferSnapshot,
} from './sse-replay-plan';
import { SSE_REPLAY_WINDOW_MS } from './sse.constants';

const NOW = 1_000_000_000;

function event(seq: number): ExecutionChannelEvent {
  return {
    executionId: 'exec-1',
    eventType: 'execution.node_started',
    seq,
    payload: {},
  };
}

function item(seq: number, receivedAt = NOW, full = true): BufferedSseEvent {
  return { seq, receivedAt, event: full ? event(seq) : null };
}

function snapshot(
  events: BufferedSseEvent[],
  over: Partial<SseBufferSnapshot> = {},
): SseBufferSnapshot {
  return { events, skipped: 0, complete: true, ...over };
}

describe('planReplay', () => {
  it('lastEventId 다음부터 빈 순번 없이 이어지면 순서대로 다시 보낸다', () => {
    const plan = planReplay(snapshot([item(7), item(5), item(6)]), 4, NOW);
    expect(plan).toEqual({
      kind: 'replay',
      events: [event(5), event(6), event(7)],
    });
  });

  it('lastEventId 이하 항목은 보내지 않는다', () => {
    const plan = planReplay(snapshot([item(3), item(4), item(5)]), 4, NOW);
    expect(plan).toEqual({ kind: 'replay', events: [event(5)] });
  });

  it.each([
    ['앞쪽이 빠졌다', [item(6), item(7)]],
    ['중간이 비었다', [item(5), item(6), item(8)]],
    ['생략 표시만 남은 항목이 있다', [item(5), item(6, NOW, false), item(7)]],
    [
      '5분이 지난 항목만 있다',
      [
        item(5, NOW - SSE_REPLAY_WINDOW_MS - 1),
        item(6, NOW - SSE_REPLAY_WINDOW_MS - 1),
      ],
    ],
    [
      '만료된 앞쪽 뒤에 남은 항목이 있다',
      [item(5, NOW - SSE_REPLAY_WINDOW_MS - 1), item(6)],
    ],
  ])('%s → unavailable', (_label, events) => {
    expect(planReplay(snapshot(events), 4, NOW)).toEqual({
      kind: 'unavailable',
    });
  });

  it('그 이후 항목이 없고 버퍼를 다 읽었고 비어 있지 않으면 up_to_date', () => {
    expect(planReplay(snapshot([item(3), item(4)]), 4, NOW)).toEqual({
      kind: 'up_to_date',
    });
    expect(planReplay(snapshot([], { skipped: 4 }), 4, NOW)).toEqual({
      kind: 'up_to_date',
    });
  });

  it('버퍼가 비었거나 다 읽지 못했으면 check_counter', () => {
    expect(planReplay(snapshot([]), 4, NOW)).toEqual({
      kind: 'check_counter',
    });
    expect(
      planReplay(snapshot([item(4)], { complete: false }), 4, NOW),
    ).toEqual({ kind: 'check_counter' });
  });
});

describe('mayHaveMissed', () => {
  it('카운터를 읽지 못하면 놓쳤을 수 있다고 본다', () => {
    expect(mayHaveMissed([], 4, null)).toBe(true);
  });

  it('카운터가 lastEventId 이하면 놓치지 않았다', () => {
    expect(mayHaveMissed([], 4, 4)).toBe(false);
    expect(mayHaveMissed([], 4, 2)).toBe(false);
  });

  it('그 사이 순번을 모두 모았으면 놓치지 않았다', () => {
    expect(mayHaveMissed([5, 6, 6, 9], 4, 6)).toBe(false);
  });

  it('그 사이 순번 중 하나라도 없으면 놓쳤다', () => {
    expect(mayHaveMissed([5, 7], 4, 7)).toBe(true);
  });
});
