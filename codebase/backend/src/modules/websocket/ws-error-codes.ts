/**
 * Canonical WS-transport-level ack error codes (review W11).
 *
 * These surface in WebSocket command ack payloads (예: `execution.retry_last_turn.ack`
 * 의 nested `error.code`) for transport / auth / ownership 실패 — node-handler
 * `output.error.code` ([`nodes/core/error-codes.ts`](../../nodes/core/error-codes.ts))
 * 및 retry 도메인 코드(`RETRY_STATE_NOT_FOUND` 등, 같은 `ErrorCode` enum)와는
 * 계층이 다르다. 분산돼 있던 코드 문자열을 한 곳에 모아 ack 응답 전반의 단일
 * 진실로 둔다.
 */
export const WsErrorCode = {
  /** 인증 안 됨 — socket 에 userId 없음. */
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  /** 권한 없음 (일반). IDOR 차단 핸들러는 존재 추론을 막기 위해 의도적으로 NOT_FOUND 를 쓴다. */
  FORBIDDEN: 'FORBIDDEN',
  /** 리소스 부재 또는 소유 검증 실패 (verifyOwnership 은 Forbidden 대신 NotFound 로 통일). */
  NOT_FOUND: 'NOT_FOUND',
  /** 서버/transport 내부 실패 (enqueue 실패 등) — client 재시도 유도. */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type WsErrorCodeValue = (typeof WsErrorCode)[keyof typeof WsErrorCode];
