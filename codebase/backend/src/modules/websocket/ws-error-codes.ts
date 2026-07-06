/**
 * Canonical WS-transport-level ack/error 코드 (review W11 + Spec §7.1).
 *
 * WebSocket ack payload(예: `execution.retry_last_turn.ack` 의 nested `error.code`),
 * 구독 거부 ack(§3.3/§3.4 의 `subscribed.code`), 그리고 연결 레벨 `error` 이벤트
 * (`{ code, message }`)로 surface 되는 transport / auth / ownership / **메시지 검증 /
 * 구독 한도 / rate-limit** 실패 코드다 — node-handler `output.error.code`
 * ([`nodes/core/error-codes.ts`](../../nodes/core/error-codes.ts)) 및 retry 도메인
 * 코드(`RETRY_STATE_NOT_FOUND` 등, 같은 `ErrorCode` enum)와는 계층이 다르다. 분산돼
 * 있던 코드 문자열을 한 곳에 모아 ack/error 응답 전반의 단일 진실로 둔다.
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
  /** 메시지 형식 오류 — 필수 필드 누락 / 유효하지 않은 채널 등 (§3.3/§7.1). */
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  /** 알 수 없는 메시지 type — 미등록 이벤트 (Socket.IO 가 silent drop 하던 것, §7.1). */
  UNKNOWN_TYPE: 'UNKNOWN_TYPE',
  /** 구독 한도(20) 초과 (§3.4/§7.1). */
  SUBSCRIPTION_LIMIT_EXCEEDED: 'SUBSCRIPTION_LIMIT_EXCEEDED',
  /** WS 명령 빈도 제한(60 msg/min per socket) 초과 (§7.1). */
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type WsErrorCodeValue = (typeof WsErrorCode)[keyof typeof WsErrorCode];
