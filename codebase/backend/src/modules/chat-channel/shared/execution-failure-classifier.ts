import { Logger } from '@nestjs/common';
import type { EiaFailedEvent } from '../types';

/**
 * Execution Failed 분류 helper — provider-invariant pure function.
 *
 * SoT:
 *   - spec/conventions/chat-channel-adapter.md §3.1 (분류 매핑 표 + type-guard 책임)
 *   - spec/5-system/15-chat-channel.md §3.5 CCH-ERR-01~05 (시스템 의무)
 *   - spec/5-system/3-error-handling.md §1.4 / §3.2 (입력 enum SoT — ErrorCode)
 *
 * 입력 화이트리스트 (CCH-ERR-02): `event.error.code` + `event.error.details?.statusCode` 만.
 * 다른 필드 (`error.message`, `nodeId`, `executionId`, `details.url` 등) 는 분류 결정에
 * 사용하지 않으며 반환값에도 포함하지 않는다 (CCH-ERR-03).
 *
 * Side-effect free except diagnostic warn log:
 *   unknown code fallback 시 NestJS Logger.warn (CCH-ERR-04) — structured log.
 */

const logger = new Logger('ChatChannelFailureClassifier');

export interface ExecutionFailureClass {
  /** languageHints lookup key — Spec Chat Channel §4.1 의 6 키 중 1개. */
  key:
    | 'executionFailedThirdParty4xx'
    | 'executionFailedThirdParty5xx'
    | 'executionFailedThirdParty'
    | 'executionFailedTimeout'
    | 'executionFailedRateLimit'
    | 'executionFailedInternal';
  /** i18n template placeholder 치환값. 화이트리스트 = `{statusCode}` 1종 (정수). */
  placeholders: { statusCode?: number };
}

const TIMEOUT_CODES = new Set([
  'HTTP_TIMEOUT',
  'LLM_TIMEOUT',
  'EXECUTION_TIMEOUT',
  'CODE_TIMEOUT',
]);

const THIRD_PARTY_CODES = new Set([
  'HTTP_TRANSPORT_FAILED',
  'LLM_CALL_FAILED',
  'LLM_RESPONSE_INVALID',
  'MAX_COLLECTION_RETRIES_EXCEEDED',
  'EMAIL_SEND_FAILED',
]);

const INTERNAL_CODES = new Set([
  'CODE_EXECUTION_FAILED',
  'SUB_WORKFLOW_FAILED',
  'DB_QUERY_FAILED',
  'DB_CONNECTION_ERROR',
  'DB_CONSTRAINT_VIOLATION',
  'DB_PERMISSION_DENIED',
  'RECURSION_DEPTH_EXCEEDED',
  'MAX_ITERATIONS_EXCEEDED',
  'CYCLE_DETECTED',
  'INVALID_EXPRESSION',
  'VARIABLE_NOT_FOUND',
  'TYPE_MISMATCH',
  'ERROR_PORT_FALLBACK',
]);

/**
 * `details: unknown` runtime type-guard — Convention §3.1 의 의무.
 * `details.statusCode` 가 안전한 정수일 때만 추출. 아니면 undefined.
 */
function extractStatusCode(details: unknown): number | undefined {
  if (
    typeof details === 'object' &&
    details !== null &&
    'statusCode' in details
  ) {
    const v = (details as { statusCode: unknown }).statusCode;
    if (typeof v === 'number' && Number.isInteger(v)) {
      return v;
    }
  }
  return undefined;
}

export function classifyExecutionFailure(
  event: EiaFailedEvent,
): ExecutionFailureClass {
  const code = event.error?.code ?? '';
  const statusCode = extractStatusCode(event.error?.details);

  // HTTP 4xx / 5xx — statusCode placeholder 우선 케이스.
  if (code === 'HTTP_4XX') {
    return {
      key: 'executionFailedThirdParty4xx',
      placeholders: statusCode !== undefined ? { statusCode } : {},
    };
  }
  if (code === 'HTTP_5XX') {
    return {
      key: 'executionFailedThirdParty5xx',
      placeholders: statusCode !== undefined ? { statusCode } : {},
    };
  }

  if (code === 'LLM_RATE_LIMIT') {
    return { key: 'executionFailedRateLimit', placeholders: {} };
  }
  if (TIMEOUT_CODES.has(code)) {
    return { key: 'executionFailedTimeout', placeholders: {} };
  }
  if (THIRD_PARTY_CODES.has(code)) {
    return { key: 'executionFailedThirdParty', placeholders: {} };
  }
  if (INTERNAL_CODES.has(code)) {
    return { key: 'executionFailedInternal', placeholders: {} };
  }

  // Unknown — fallback to internal + structured warn log (CCH-ERR-04).
  logger.warn(
    JSON.stringify({
      kind: 'chat_channel_unknown_failure_code',
      code,
      triggerId: event.triggerId,
      hasDetails: event.error?.details !== undefined,
    }),
  );
  return { key: 'executionFailedInternal', placeholders: {} };
}
