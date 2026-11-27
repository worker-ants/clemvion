// 근거: [EIA 수신 API와 SSE 「스트림 규칙」](CLE-EIA-INBOUND-STREAM#스트림-규칙), NERV Task `CLE-T-FHG7MT` · `CLE-T-8PYFDB`.
// 재연결 replay 와 구독 공백 따라잡기의 판정을 상태 없는 함수로 둔다. 전달과 구독자 상태는 `SseAdapter` 가 맡는다.

import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';
import type { BufferedSseEvent } from './sse-fanout.service';
import { SSE_REPLAY_WINDOW_MS } from './sse.constants';

/** 버퍼를 읽은 결과. `complete` 는 버퍼를 다 읽었는지다. Redis 로 동작하는데 읽지 못했으면 `false` 다. */
export interface SseBufferSnapshot {
  events: BufferedSseEvent[];
  /** Redis 버퍼에서 요청한 순번 이하라 파싱하지 않고 센 항목 수. */
  skipped: number;
  complete: boolean;
}

/**
 * replay 판정.
 * - `replay`: `events` 를 순서대로 다시 보낸다.
 * - `unavailable`: `execution.replay_unavailable` 을 보낸다.
 * - `up_to_date`: 클라이언트가 최신까지 받았다. 아무것도 보내지 않는다.
 * - `check_counter`: 버퍼만으로 정할 수 없다. 실행의 순번 카운터와 견줘 {@link mayHaveMissed} 로 정한다.
 */
export type SseReplayPlan =
  | { kind: 'replay'; events: ExecutionChannelEvent[] }
  | { kind: 'unavailable' }
  | { kind: 'up_to_date' }
  | { kind: 'check_counter' };

/**
 * `lastEventId` 이후를 버퍼로 다시 보낼 수 있는지 정한다.
 *
 * 그 이후 항목이 버퍼에 있으면 5분 안의 항목이 `lastEventId + 1` 부터 빈 순번 없이 이어지고 모두 이벤트 전체일 때만
 * 다시 보낸다. 만료나 개수 상한으로 앞쪽이 빠졌거나 중간이 비었거나 생략 표시만 남은 항목이 있으면(이벤트 전체가 다른
 * 서버 인스턴스의 메모리에만 있음) 일부만 보내지 않고 `unavailable` 이다.
 *
 * 그 이후 항목이 없을 때는 둘로 갈린다. 버퍼를 다 읽었고 비어 있지 않으면 버퍼에 그 실행의 마지막 이벤트가 있으므로
 * `up_to_date` 다. 버퍼 키가 사라졌거나(마지막 이벤트 뒤 5분) Redis 를 읽지 못했으면 `check_counter` 다.
 */
export function planReplay(
  buffer: SseBufferSnapshot,
  lastEventId: number,
  now: number,
): SseReplayPlan {
  // 클라이언트가 아직 못 받은 항목. 만료됐지만 아직 버퍼에 남은 항목도 센다.
  const wanted = buffer.events.filter((e) => e.seq > lastEventId);
  if (wanted.length === 0) {
    return buffer.complete && (buffer.events.length > 0 || buffer.skipped > 0)
      ? { kind: 'up_to_date' }
      : { kind: 'check_counter' };
  }
  const cutoff = now - SSE_REPLAY_WINDOW_MS;
  const replayable = wanted
    .filter((e) => e.receivedAt >= cutoff)
    .sort((a, b) => a.seq - b.seq);
  // 순번은 단조 증가라 만료 · 상한 폐기는 앞쪽부터 일어난다. 앞쪽뿐 아니라 중간이 빈 경우(`[6,7,9]`)도 끊긴 것으로 본다.
  const events: ExecutionChannelEvent[] = [];
  for (const [i, item] of replayable.entries()) {
    const expected = i === 0 ? lastEventId + 1 : replayable[i - 1].seq + 1;
    if (item.seq !== expected || item.event === null) break;
    events.push(item.event);
  }
  if (events.length === 0 || events.length !== replayable.length) {
    return { kind: 'unavailable' };
  }
  return { kind: 'replay', events };
}

/**
 * 버퍼 없이 놓쳤는지 정한다. 카운터를 읽지 못하면(키가 없음 · Redis 장애 · 메모리 모드) 근거가 없으므로 놓쳤을 수 있다고
 * 본다. 카운터가 `lastEventId` 보다 크면 그 사이 순번 중 replay 를 기다리며 모은 이벤트에 없는 것이 있을 때 놓친 것이다.
 *
 * @param collectedSeqs replay 를 기다리며 모은 이벤트의 순번. 생략 표시는 받은 이벤트가 아니므로 넣지 않는다.
 */
export function mayHaveMissed(
  collectedSeqs: Iterable<number>,
  lastEventId: number,
  latest: number | null,
): boolean {
  if (latest === null) return true;
  if (latest <= lastEventId) return false;
  const collected = new Set<number>();
  for (const seq of collectedSeqs) {
    if (seq > lastEventId && seq <= latest) collected.add(seq);
  }
  return collected.size < latest - lastEventId;
}
