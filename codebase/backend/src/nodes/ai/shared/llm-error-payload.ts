import { ErrorCode } from '../../core/error-codes';
import { sanitizeLastErrorMessage } from '../../../shared/utils/sanitize-error-message';
import { extractRetryAfterMs } from '../../../shared/utils/retry-after';

/**
 * network/timeout 분류용 패턴 상수. errno 코드
 * (`err.code`) 와 메시지 본문을 각각 매칭한다. `extractAiTurnErrorPayload` /
 * `classifyLlmError` 가 공유.
 */
const NETWORK_ERRNO_PATTERN =
  /^(ECONNRESET|ETIMEDOUT|ECONNREFUSED|ECONNABORTED|EAI_AGAIN|ENOTFOUND|EPIPE)$/;

const NETWORK_MESSAGE_PATTERN =
  /\b(timed?\s*out|timeout|etimedout|econnreset|econnrefused|socket hang up|network error|fetch failed|connection (?:error|reset|refused))\b/i;

/**
 * provider SDK 에러에서 HTTP status code 추출. Anthropic / OpenAI `APIError`
 * 는 `.status`, axios 풍은 `.response.status`, 일부 래퍼는 `.statusCode`.
 */
function extractHttpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown } | null;
  };
  const raw =
    e.status ??
    e.statusCode ??
    (e.response && typeof e.response === 'object'
      ? e.response.status
      : undefined);
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

/**
 * `extractAiTurnErrorPayload` 의 분기 트리를 분리한
 * 순수 분류 함수. HTTP status / explicit code / message 만 보고 [AI 에이전트
 * 「에러 코드」](CLE-NODE-AGENT#에러-코드) 의 `{ code, retryable }` 를 도출한다.
 *
 *  - 429 / rate-limit → `LLM_RATE_LIMIT` (retryable)
 *  - 401 / 403 (auth) → `LLM_CALL_FAILED` (non-retryable — 재시도해도 동일 실패)
 *  - 5xx / network / timeout → `LLM_CALL_FAILED` (retryable — 일시 회복 가능)
 *  - 그 외 명시 code (예: `LLM_RESPONSE_INVALID`) → 보존, non-retryable
 *  - 분류 불가 → `LLM_CALL_FAILED` (보수적 non-retryable fallback —
 *    CLE-NODE-AGENT 「에러 코드」 는 별도 `AI_*` fallback 코드를 두지 않고
 *    LLM 단일 taxonomy 를 유지한다)
 *
 * client SSE 계층의 `LLM_CONNECTION_ERROR`([LLM 클라이언트](CLE-AI-LLM)) 는 AI 에이전트
 * 경로에 도달하지 않으나, 누출 대비 network 로 매핑한다.
 */
function classifyLlmError(
  status: number | undefined,
  explicitCode: unknown,
  rawMessage: string,
): { code: string; retryable: boolean } {
  const lowerMsg = rawMessage.toLowerCase();
  const isAuth = status === 401 || status === 403;
  const is5xx = typeof status === 'number' && status >= 500 && status <= 599;
  const is429 =
    status === 429 ||
    explicitCode === 'LLM_RATE_LIMIT' ||
    lowerMsg.includes('429') ||
    lowerMsg.includes('rate limit');
  const isNetwork =
    explicitCode === 'LLM_CONNECTION_ERROR' ||
    (typeof explicitCode === 'string' &&
      NETWORK_ERRNO_PATTERN.test(explicitCode)) ||
    NETWORK_MESSAGE_PATTERN.test(rawMessage);

  if (is429) {
    return { code: ErrorCode.LLM_RATE_LIMIT, retryable: true };
  }
  if (isAuth) {
    return { code: ErrorCode.LLM_CALL_FAILED, retryable: false };
  }
  if (is5xx || isNetwork) {
    return { code: ErrorCode.LLM_CALL_FAILED, retryable: true };
  }
  if (typeof explicitCode === 'string' && explicitCode.length > 0) {
    return { code: explicitCode, retryable: false };
  }
  // 분류 불가 fallback — CLE-NODE-AGENT 「에러 코드」 는 별도 AI_* 코드 없이
  // LLM_CALL_FAILED (non-retryable) 로 통합한다. 재시도 안전성이 확인되지 않은 미상 throw.
  return { code: ErrorCode.LLM_CALL_FAILED, retryable: false };
}

/**
 * Turns a failed AI agent LLM call into the `{ code, message, details }` that
 * goes into `output.error`.
 *
 * Both AI agent paths use it. A multi-turn resume reaches it through
 * `AiTurnOrchestrator.handleAiTurnError`. A single turn calls it in
 * `AiTurnExecutor.buildSingleTurnLlmErrorOutput` and returns the payload on
 * the `error` port. One function keeps the two paths on the same `code` and
 * `details.retryable`. It sits under `nodes/` so the executor can call it
 * without a runtime import of an `execution-engine` service.
 */
export function extractAiTurnErrorPayload(err: unknown): {
  code: string;
  message: string;
  details?: unknown;
} {
  // Error 가 아닌 throw (string / number / 비-Error 객체) 도 들어올 수 있어
  // typeof 로 안전하게 분기. `String({})` 가 `[object Object]` 가 되는 base
  // stringification 함정을 회피.
  let rawMessage: string;
  if (err instanceof Error) {
    rawMessage = err.message;
  } else if (typeof err === 'string') {
    rawMessage = err;
  } else if (err === null || err === undefined) {
    rawMessage = 'unknown error';
  } else if (
    typeof err === 'number' ||
    typeof err === 'boolean' ||
    typeof err === 'bigint'
  ) {
    rawMessage = String(err);
  } else {
    // Circular-reference or other non-serializable objects: fall back to a
    // safe placeholder rather than letting JSON.stringify throw and re-enter
    // the WAITING_FOR_INPUT regression path.
    try {
      rawMessage = JSON.stringify(err);
    } catch {
      rawMessage = '[non-serializable error object]';
    }
  }
  const message = sanitizeLastErrorMessage(rawMessage);
  const explicitCode = (err as { code?: unknown } | null | undefined)?.code;
  const status = extractHttpStatus(err);

  // CLE-NODE-AGENT 「에러 코드」 — HTTP status 기반 분류 (스펙이 SoT).
  // retryable 은 코드 문자열 집합이 아니라 status/조건으로 도출 (Principle 3.2.1).
  const { code, retryable } = classifyLlmError(
    status,
    explicitCode,
    rawMessage,
  );
  const rawDetails = (err as { details?: unknown } | null | undefined)?.details;
  let baseDetails: Record<string, unknown> | undefined;
  if (rawDetails !== undefined) {
    // JSON.stringify → sanitize → JSON.parse chain: strips secret tokens from
    // nested details fields. Wrapped in try/catch because rawDetails may be
    // non-serializable (circular refs, BigInt, etc.).
    try {
      const parsed = JSON.parse(
        sanitizeLastErrorMessage(JSON.stringify(rawDetails)),
      ) as unknown;
      baseDetails =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : { details: parsed };
    } catch {
      baseDetails = { details: '[serialization error]' };
    }
  }

  // Retry-After 헤더 → retryAfterSec. ms → s 정수 변환. invariant: retryable
  // === true 일 때만 set (Principle 3.2.1).
  let retryAfterSec: number | undefined;
  if (retryable) {
    const retryAfterMs = extractRetryAfterMs(err);
    if (retryAfterMs !== null && retryAfterMs > 0) {
      retryAfterSec = Math.ceil(retryAfterMs / 1000);
    }
  }

  const mergedDetails: Record<string, unknown> = {
    ...(baseDetails ?? {}),
    retryable,
    ...(retryAfterSec !== undefined ? { retryAfterSec } : {}),
  };

  return { code, message, details: mergedDetails };
}
