// 근거: [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA#sse-스트림), NERV Task `CLE-T-Z35F7P`.
// 키 접두 `eia:` 는 이 모듈이 이미 쓰는 접두다([Redis 키 명명 규약 「규칙」](CLE-ENG-REDIS#규칙) 규칙 6).
// EIA SSE 가 쓰는 Redis 키와 채널 이름. `sse-fanout.service.ts` 가 다시 내보낸다.

/** 트리거 단위 토큰 스트림 닫기 신호를 모든 서버 인스턴스에 알리는 채널. */
export const SSE_CLOSE_CHANNEL = 'eia:sse:close';

/** 실행별 실시간 전달 채널의 접두. */
export const SSE_LIVE_CHANNEL_PREFIX = 'eia:sse:live:';

/** 실행별 replay 버퍼(Redis Stream) 키. */
export function sseBufferKey(executionId: string): string {
  return `eia:sse:buf:${executionId}`;
}

/** 실행별 실시간 전달 채널. */
export function sseLiveChannel(executionId: string): string {
  return `${SSE_LIVE_CHANNEL_PREFIX}${executionId}`;
}

/** 실행별 연결 상한 ZSET 키. member 는 구독 id, 점수는 마지막 heartbeat 시각(ms)이다. */
export function sseConnectionSlotsKey(executionId: string): string {
  return `eia:sse:subs:${executionId}`;
}
