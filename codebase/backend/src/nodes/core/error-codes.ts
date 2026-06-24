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
