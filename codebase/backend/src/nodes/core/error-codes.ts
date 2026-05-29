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
  // Email
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  // SMTP host 가 사설/loopback 대역이라 SSRF 가드에 차단된 경우 (기본 ON,
  // `ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out). connection test / 발송 양쪽 공통.
  EMAIL_HOST_BLOCKED: 'EMAIL_HOST_BLOCKED',
  // LLM
  LLM_CALL_FAILED: 'LLM_CALL_FAILED',
  LLM_RATE_LIMITED: 'LLM_RATE_LIMITED',
  LLM_RESPONSE_INVALID: 'LLM_RESPONSE_INVALID',
  LLM_TIMEOUT: 'LLM_TIMEOUT',
  MAX_COLLECTION_RETRIES_EXCEEDED: 'MAX_COLLECTION_RETRIES_EXCEEDED',
  // Code execution
  CODE_EXECUTION_FAILED: 'CODE_EXECUTION_FAILED',
  CODE_TIMEOUT: 'CODE_TIMEOUT',
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
  // Interaction / blocking — user-cancellation & timeout on presentation
  // or AI-conversation waits. Presentation node engine paths raise these
  // when a `waitFor*` promise is rejected externally.
  USER_CANCELLED: 'USER_CANCELLED',
  INTERACTION_TIMEOUT: 'INTERACTION_TIMEOUT',
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
