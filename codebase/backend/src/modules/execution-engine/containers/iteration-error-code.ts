import { EngineErrorCode, ErrorCode } from '../../../nodes/core/error-codes';
import { MCP_ERROR_CODES } from '../../mcp/mcp-error-codes';

/**
 * 에러 클래스가 스스로 싣는 `code` 값. 클래스 필드 `readonly code = '…'`, 생성자 인자의
 * 리터럴 유니온, `new IntegrationError('…', …)` 처럼 생성자 첫 인자로 넘기는 리터럴이다.
 * `ErrorCode.X` 로 싣는 클래스(`ExecutionTimeLimitError` 등)는 아래 `ErrorCode` 값이 덮는다.
 *
 * 새 에러 클래스가 이 목록에 없으면 그 값이 `UNKNOWN_ERROR` 로 바뀐다. 그래서
 * `iteration-error-code.spec.ts` 가 소스의 클래스 `code` 리터럴이 모두 여기 있는지,
 * 여기 있는 값이 아직 소스에 있는지 본다.
 */
export const ERROR_CLASS_CODES = [
  // 통합 노드 클라이언트 (`cafe24-api.client.ts` · `makeshop-api.client.ts`)
  'CAFE24_RATE_LIMITED',
  'CAFE24_AUTH_FAILED',
  'CAFE24_TRANSPORT_FAILED',
  'MAKESHOP_RATE_LIMITED',
  'MAKESHOP_AUTH_FAILED',
  'MAKESHOP_TRANSPORT_FAILED',
  'INTEGRATION_INCOMPLETE',
  // `IntegrationError` 생성자 첫 인자 (통합 노드 핸들러)
  'INTEGRATION_TYPE_MISMATCH',
  'INTEGRATION_NOT_CONNECTED',
  'INTEGRATION_SERVICE_UNAVAILABLE',
  'INTEGRATION_CALL_FAILED',
  'CAFE24_INVALID_MALL_ID',
  'CAFE24_MISSING_FIELDS',
  'CAFE24_UNKNOWN_OPERATION',
  'MAKESHOP_INVALID_PAGINATION',
  'MAKESHOP_INVALID_SHOP_UID',
  'MAKESHOP_MISSING_FIELDS',
  'MAKESHOP_UNKNOWN_OPERATION',
  'INVALID_PARAMETERS',
  // AI 에이전트 노드 (`tool-payload-budget.ts`)
  'TOOL_DEFINITION_PAYLOAD_EXCEEDED',
  // 실행 엔진 (`workflow-errors.ts` · `execution-engine.service.ts` · `ai-conversation-helpers.ts`)
  'INVALID_EXECUTION_STATE',
  'ERROR_PORT_FALLBACK',
  'RESUME_CHECKPOINT_MISSING',
  'RESUME_FAILED',
  'RESUME_INCOMPATIBLE_STATE',
] as const;

/**
 * 실패 회차 · 분기의 `error.code` 로 그대로 내보내는 코드. 백엔드가 직접 싣는 코드만 담는다.
 * Node 런타임 · DB 드라이버가 싣는 `ECONNREFUSED` · `ERR_INVALID_URL` · `ER_DUP_ENTRY` 같은
 * 값은 모양이 같아도 카탈로그에 없으므로 담지 않는다.
 */
export const ITERATION_PASSTHROUGH_CODES: ReadonlySet<string> = new Set<string>(
  [
    ...Object.values(ErrorCode),
    ...Object.values(EngineErrorCode),
    ...Object.values(MCP_ERROR_CODES),
    ...ERROR_CLASS_CODES,
  ],
);

/** ERRCODES §3 예외 등록 코드. 취소로 끝난 회차 · 분기를 가린다. */
const ABORT_ERROR = 'AbortError';

/**
 * ForEach · Map · Parallel 이 실패 회차 · 분기의 `error.code` 를 고르는 공용 규칙
 * (NERV Task `CLE-T-REC4X3`, 규칙의 정의는 NERV CLE-NODE-LOGIC-COMMON).
 *
 * 1. `Error` 가 아닌 값은 `UNKNOWN_ERROR` 다.
 * 2. `name` 이 `AbortError` 면 `AbortError` 다. Node 의 AbortError 가 싣는 `code: 'ABORT_ERR'`
 *    보다 먼저 본다.
 * 3. 문자열 `code` 가 {@link ITERATION_PASSTHROUGH_CODES} 에 있으면 그 값이다.
 * 4. 그 밖(평범한 `Error` · `TypeError`, 런타임 · 드라이버 code)은 `UNKNOWN_ERROR` 다.
 */
export function resolveIterationErrorCode(err: unknown): string {
  if (!(err instanceof Error)) return ErrorCode.UNKNOWN_ERROR;
  if (err.name === ABORT_ERROR) return ABORT_ERROR;
  const code: unknown = (err as { code?: unknown }).code;
  if (typeof code === 'string' && ITERATION_PASSTHROUGH_CODES.has(code)) {
    return code;
  }
  return ErrorCode.UNKNOWN_ERROR;
}
