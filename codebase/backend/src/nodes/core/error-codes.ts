/**
 * Canonical error-code enum for node handlers' `output.error.code`.
 *
 * CONVENTIONS §3.2 — runtime failures emitted by a node handler follow
 * the shape `{ code, message, details? }` and route to the `error` port.
 * Codes are UPPER_SNAKE_CASE and grouped by node category for grep-ability.
 */
export const ErrorCode = {
  // HTTP
  HTTP_TRANSPORT_FAILED: 'HTTP_TRANSPORT_FAILED',
  HTTP_4XX: 'HTTP_4XX',
  HTTP_5XX: 'HTTP_5XX',
  HTTP_TIMEOUT: 'HTTP_TIMEOUT',
  // SSRF block (private/loopback/link-local/CGNAT target or redirect-hop /
  // non-http(s) scheme). Applies to ALL auth methods (refactor 04 C-3).
  // 가드 정책의 SoT 는 `http-request/http-safety.ts` (HTTP/DB/Email 공용); 기본 ON,
  // `ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out (EMAIL_HOST_BLOCKED 와 대칭).
  HTTP_BLOCKED: 'HTTP_BLOCKED',
  // Database
  // `DB_QUERY_FAILED` is the fallback / generic SQL execution failure.
  // The other three are mapped from driver-specific error codes
  // (PostgreSQL SQLSTATE / MySQL error code strings) so workflow authors
  // can branch on retry-worthy connection issues vs permanent constraint
  // / permission failures. See `database-query.handler.ts#mapDbError`.
  DB_QUERY_FAILED: 'DB_QUERY_FAILED',
  DB_CONNECTION_ERROR: 'DB_CONNECTION_ERROR',
  DB_CONSTRAINT_VIOLATION: 'DB_CONSTRAINT_VIOLATION',
  DB_PERMISSION_DENIED: 'DB_PERMISSION_DENIED',
  // DB host 가 사설/loopback/link-local/CGNAT 대역으로 해석돼 SSRF 가드에 차단된 경우
  // (기본 ON, `ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out). 가드 SoT 는 공용
  // `http-request/http-safety.ts`. HTTP(`HTTP_BLOCKED`)·Email(`EMAIL_HOST_BLOCKED`)과 대칭.
  DB_HOST_BLOCKED: 'DB_HOST_BLOCKED',
  // Email
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  // SMTP host 가 사설/loopback 대역이라 SSRF 가드에 차단된 경우 (기본 ON,
  // `ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out). connection test / 발송 양쪽 공통.
  EMAIL_HOST_BLOCKED: 'EMAIL_HOST_BLOCKED',
  // LLM
  LLM_CALL_FAILED: 'LLM_CALL_FAILED',
  LLM_RATE_LIMIT: 'LLM_RATE_LIMIT',
  LLM_RESPONSE_INVALID: 'LLM_RESPONSE_INVALID',
  LLM_TIMEOUT: 'LLM_TIMEOUT',
  MAX_COLLECTION_RETRIES_EXCEEDED: 'MAX_COLLECTION_RETRIES_EXCEEDED',
  // Code execution
  CODE_EXECUTION_FAILED: 'CODE_EXECUTION_FAILED',
  CODE_TIMEOUT: 'CODE_TIMEOUT',
  // Code node isolate (isolated-vm) exceeded its memory hard limit (default
  // 128MB, CODE_NODE_MEMORY_LIMIT_MB env-tunable) — distinct from CODE_TIMEOUT
  // so authors can branch on resource cause.
  CODE_MEMORY_LIMIT: 'CODE_MEMORY_LIMIT',
  // Workflow / sub-workflow
  // SUB_WORKFLOW_FAILED is the generic fallback. The other three express
  // distinct failure modes so workflow authors can branch on cause: a
  // missing target workflow, a synchronous timeout, or an async-queue
  // enqueue failure. The Sub-Workflow handler picks the right code based
  // on the executor's thrown message.
  SUB_WORKFLOW_FAILED: 'SUB_WORKFLOW_FAILED',
  SUB_WORKFLOW_NOT_FOUND: 'SUB_WORKFLOW_NOT_FOUND',
  SUB_WORKFLOW_TIMEOUT: 'SUB_WORKFLOW_TIMEOUT',
  SUB_WORKFLOW_QUEUE_FAILED: 'SUB_WORKFLOW_QUEUE_FAILED',
  // WORKFLOW_FORBIDDEN_WORKSPACE: cross-workspace sub-workflow call blocked
  // (W-6 fail-closed). assertSameWorkspace throws WorkflowForbiddenWorkspaceError
  // when the target workflow belongs to a different workspace, or when the caller
  // workspace context is missing (deny-by-default). Surfaced at the Sub-Workflow
  // node's error port. spec/4-nodes/2-flow/1-workflow.md §2 W-6.
  WORKFLOW_FORBIDDEN_WORKSPACE: 'WORKFLOW_FORBIDDEN_WORKSPACE',
  // Execution Engine — engine-level limits (spec/5-system/4-execution-engine.md §8).
  // EXECUTION_TIME_LIMIT_EXCEEDED: a single Execution exceeded its max **active-running**
  // cumulative time (default 30min; waiting_for_input park time excluded). Distinct from
  // `EXECUTION_TIMEOUT`, which is the Code node's *script* timeout — see
  // spec/5-system/3-error-handling.md §1.4. The two MUST be branched explicitly
  // (e.g. chat-channel/shared/execution-failure-classifier.ts).
  EXECUTION_TIME_LIMIT_EXCEEDED: 'EXECUTION_TIME_LIMIT_EXCEEDED',
  // Continuation ack — client-safe boundary codes (spec/5-system/4-execution-engine.md
  // §7.5.2). These surface in the WS continuation ack's flat `errorCode` field.
  //  - EXECUTION_INTERNAL_ERROR: generic fallback for any NON-typed error reaching the
  //    continuation ack builder. The internal `error.message`/stack is logged server-side
  //    only and NEVER sent to the client (leak-block security gate) — the ack carries a
  //    fixed generic string instead.
  //  - EXECUTION_MESSAGE_TOO_LONG: `submit_message` exceeded the max message length
  //    (publisher-side sync validation, typed `MessageTooLongError`).
  //  - EXECUTION_ENQUEUE_FAILED: continuation publish (BullMQ enqueue) failed — Redis
  //    dependency outage. Surfaced synchronously as `queued:false`; the REST `stop()`
  //    WAITING cancel path maps it to 503 (retryable upstream failure). C-1 (06-concurrency).
  EXECUTION_INTERNAL_ERROR: 'EXECUTION_INTERNAL_ERROR',
  EXECUTION_MESSAGE_TOO_LONG: 'EXECUTION_MESSAGE_TOO_LONG',
  EXECUTION_ENQUEUE_FAILED: 'EXECUTION_ENQUEUE_FAILED',
  // Interaction / blocking — user-cancellation & timeout on presentation
  // or AI-conversation waits. Presentation node engine paths raise these
  // when a `waitFor*` promise is rejected externally.
  USER_CANCELLED: 'USER_CANCELLED',
  INTERACTION_TIMEOUT: 'INTERACTION_TIMEOUT',
  // AI Agent multi-turn `execution.retry_last_turn` (spec/5-system/
  // 6-websocket-protocol.md §4.2). These surface in the WS ack's nested
  // `error: { code, message }` object (not a node `output.error.code`), but
  // live here so the canonical code strings have one source of truth.
  //  - RETRY_STATE_NOT_FOUND: `_retryState` missing / expired / already consumed.
  //  - NODE_NOT_RETRYABLE: error not retryable (retryable !== true) or node did
  //    not terminate on a retryable error.
  //  - RETRY_TOO_EARLY: `retryAfterSec` countdown has not elapsed yet.
  RETRY_STATE_NOT_FOUND: 'RETRY_STATE_NOT_FOUND',
  NODE_NOT_RETRYABLE: 'NODE_NOT_RETRYABLE',
  RETRY_TOO_EARLY: 'RETRY_TOO_EARLY',
  // VALIDATION_ERROR: API 공통 400 검증 실패 코드 (prefix 없는 시스템 전역 공용 —
  // spec/conventions/error-codes.md). submit_form field 검증(publisher 측 동기 검증,
  // spec/4-nodes/6-presentation/4-form.md §4·§6.2 / EIA §5.1)도 이 코드를 재사용하며
  // `FormValidationError.code` 값과 일치해야 한다.
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  // INVALID_FIELD: VALIDATION_ERROR 응답 `details[].code` — 개별 field 검증 실패 사유.
  INVALID_FIELD: 'INVALID_FIELD',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * **엔진 레이어** 에러 코드 — 노드 핸들러가 아니라 **엔진 자신이** `Execution.error` /
 * `NodeExecution.error` 봉투에 싣는 값.
 *
 * ## 왜 별 const 인가 (같은 파일 안에서)
 *
 * 위 `ErrorCode` 는 docstring 이 스스로 범위를 *"node handlers' `output.error.code`"* 로
 * 못박는다. 엔진 코드를 거기 섞으면 그 계약이 조용히 넓어진다. 그렇다고 **파일을 나누면**
 * 같은 파일이 이미 명시한 *"canonical code strings 는 one source of truth"* 원칙이 깨진다
 * (그래서 WS ack 용 `RETRY_*` 도 여기 산다). 그래서 **파일은 하나, const 는 둘** —
 * 레이어는 타입에 드러나고 SoT 는 하나로 남는다.
 *
 * ## 여기 있는 것 / 없는 것
 *
 * 여기 있는 넷은 전부 **맨 문자열이었다**(2026-08-31 실측: 5지점). DB 에 영속되고
 * FE·알림이 값으로 분기하는데 앵커가 없어 **오탈자가 조용히 통과**했다.
 *
 * 반면 아래 **셋**은 **이미 타입 앵커가 있어** 옮기지 않았다 — 옮기면 앵커가 두 개가 된다:
 *  - `INVALID_EXECUTION_STATE` / `ERROR_PORT_FALLBACK` — 에러 클래스의 `readonly code`
 *  - trigger 파라미터 검증 4종 — `TriggerParameterErrorDetail['code']` 유니온
 *    (규약 §4.2 가 소유하는 `details[].code` 레이어이며 봉투 `code` 가 아니다)
 *  - `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE` —
 *    `RehydrationError.code` 리터럴 유니온으로 **생성자 positional 인자**로 넘어간다
 *    (리뷰 `20_43_35` W1 이 드러낸 형태. `RESUME_FAILED` 는 일반 메서드 인자로만 쓰여
 *    가드 스캔 표면 밖이라 예외 목록에 두지 않았다 — 아래 경계 문단 참조)
 *
 * 형제 가드 `repo-guards/__tests__/engine-error-code-anchor-guard.ts` 가 이 구분을
 * 강제한다 — 엔진 모듈에서 `code`/`errorCode` 에 바인딩되거나 `new XxxError('X', …)` 로
 * 넘어가는 맨 문자열이 생기면 RED. (그 **다섯 형태**가 가드가 실제로 훑는 범위다.
 * 처음엔 "새 맨 문자열 코드가 생기면 RED" 라 적었는데 생성자 인자를 안 보고 있었다 —
 * 리뷰 `20_43_35` W1. 보장을 좁히는 대신 스캔을 넓혔다.)
 */
export const EngineErrorCode = {
  /**
   * Execution 이 admission(큐 대기)에서 한도를 넘겨 시작조차 못 한 경우.
   * `started_at` 이 admission 이전 시각이라 `durationMs` 는 **큐 대기 시간**이다
   * (`14-external-interaction-api.md` §6 durationMs 행).
   */
  EXECUTION_QUEUE_WAIT_TIMEOUT: 'EXECUTION_QUEUE_WAIT_TIMEOUT',
  /**
   * 활성 세그먼트 워커의 terminal 실패 → Execution `failed`. 이름의 "HEARTBEAT" 는
   * 별도 heartbeat 채널을 암시하지만 그런 채널은 없다 — 2026-07-04 부터 의미가
   * "BullMQ stalled-job 재배달 소진" 으로 재정의됐고 **코드명은 유지**(rename = breaking).
   * SoT: [`spec/conventions/error-codes.md` §3](../../../../../spec/conventions/error-codes.md).
   */
  WORKER_HEARTBEAT_TIMEOUT: 'WORKER_HEARTBEAT_TIMEOUT',
  /**
   * SIGTERM grace 가 끝났는데 in-flight 노드가 남아 강제 마감된 경우
   * (`shutdown-state.service.ts`). Execution·NodeExecution 양쪽 봉투에 실린다.
   */
  SERVER_INTERRUPTED: 'SERVER_INTERRUPTED',
  /**
   * 공개 웹채팅 위젯이 입력 대기 상태로 idle 한도를 넘겨 reaper 가 취소한 경우.
   * `failed` 가 아니라 `cancelled` 로 마감된다.
   */
  WEBCHAT_IDLE_TIMEOUT: 'WEBCHAT_IDLE_TIMEOUT',
} as const;

export type EngineErrorCodeValue =
  (typeof EngineErrorCode)[keyof typeof EngineErrorCode];

/**
 * Build a standardized runtime-error `output.error` envelope. `details` is
 * free-form per node; callers should ensure it's JSON-serializable.
 */
export function buildErrorEnvelope(
  code: ErrorCodeValue,
  message: string,
  details?: Record<string, unknown>,
): {
  code: ErrorCodeValue;
  message: string;
  details?: Record<string, unknown>;
} {
  return details === undefined ? { code, message } : { code, message, details };
}

/**
 * Truncate a user-supplied string before embedding it in an error envelope's
 * `details`. LLM prompts, emails, form inputs etc. may exceed reasonable
 * envelope sizes or leak PII when echoed verbatim. Default cap is 500 chars.
 */
export function truncateForErrorDetails(
  value: unknown,
  maxLen = 500,
): string | undefined {
  if (value === null || value === undefined) return undefined;
  let str: string;
  if (typeof value === 'string') {
    str = value;
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    str = String(value);
  } else {
    // Fallback for objects/arrays — JSON serialise so the result is
    // readable and doesn't end up as "[object Object]".
    try {
      str = JSON.stringify(value);
    } catch {
      str = '[unserializable]';
    }
  }
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}…(+${str.length - maxLen} chars truncated)`;
}

/**
 * Mask an email address for error `details`. Keeps the first character of
 * the local-part + domain suffix so operators can recognise the account
 * without exposing the full identifier. `alice@example.com` → `a***@example.com`.
 */
export function maskEmailForErrorDetails(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const masked = local.length <= 1 ? '***' : `${local[0]}***`;
  return `${masked}@${domain}`;
}
