/**
 * Single source of truth for MCP failure vocabulary surfaced to:
 *   - LLM tool_result content (`output.error.code`)
 *   - IntegrationUsageLog rows
 *   - Integration.status_reason transitions
 *
 * Imported by both `McpToolProvider` (write-side) and `IntegrationsService.logUsage`
 * (read-side) so a typo in either place is a compile error rather than a
 * silent runtime mismatch.
 *
 * Mirrors the codes documented in `spec/5-system/11-mcp-client.md §8.2`.
 */
import { SECRET_LEAK_PATTERNS } from '../../shared/utils/sanitize-error-message';

export const MCP_ERROR_CODES = {
  HTTPS_REQUIRED: 'MCP_HTTPS_REQUIRED',
  AUTH_FAILED: 'MCP_AUTH_FAILED',
  CONNECT_FAILED: 'MCP_CONNECT_FAILED',
  LIST_FAILED: 'MCP_LIST_FAILED',
  CALL_FAILED: 'MCP_CALL_FAILED',
  TOOL_ERROR: 'MCP_TOOL_ERROR',
  TIMEOUT: 'MCP_TIMEOUT',
  RESPONSE_TOO_LARGE: 'MCP_RESPONSE_TOO_LARGE',
  UNKNOWN_TOOL: 'MCP_UNKNOWN_TOOL',
  INVALID_TOOL_ARGUMENTS: 'INVALID_TOOL_ARGUMENTS',
} as const;

export type McpErrorCode =
  (typeof MCP_ERROR_CODES)[keyof typeof MCP_ERROR_CODES];

/**
 * Cap on free-form error messages persisted to `Integration.last_error` /
 * `IntegrationUsageLog.error`. External MCP servers can return arbitrarily
 * long messages; the bound keeps a single bad server from inflating the
 * `last_error` JSONB column or pushing aggregator log lines off-spec.
 */
export const MCP_ERROR_MESSAGE_MAX_LEN = 2048;

/**
 * MCP 전용 추가 마스킹 패턴 — 공용 {@link SECRET_LEAK_PATTERNS} 가 다루지 않는
 * 케이스만 담는다 (secret-redaction SoT 파편화 방지). **현재는 비어 있다.**
 *
 * 이 배열은 두 번 비워졌고 두 번 다 같은 이유였다 — 공용 SoT 가 그 형태를 흡수했다:
 *
 * - 2026-07-10 — connect URL userinfo(`scheme://user:pass@host`). 공용이 동형(scheme 보존
 *   `scheme://***@host`)으로 흡수.
 * - 2026-08-17 — 쿼리스트링 bare `token=`. 공용 labelled 패턴이 `token` **계열 전체**
 *   (`[A-Za-z0-9_-]*token`)로 넓어져 흡수. 무수정 프로브로 동치 확인 —
 *   `?token=abc&foo=bar` 가 공용만으로도 `?***&foo=bar` 가 된다.
 *
 * 훅을 남겨 두는 이유: MCP 서버는 제3자 구현이라 공용이 모르는 형태를 언제든 되돌려줄 수
 * 있다. 그때 여기 한 줄을 얹는 것이 공용 SoT 를 MCP 사정으로 넓히는 것보다 안전하다.
 */
const MCP_EXTRA_SECRET_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [];

/**
 * Redact credential-shaped spans from a free-form error string before it is
 * persisted / surfaced (`mcpDiagnostics.errors[].message`, `IntegrationUsageLog`,
 * `Integration.last_error`). External MCP servers can echo the request URL,
 * `Authorization` header, or query string back inside their error text; without
 * this a bearer token / api key / URL-embedded password could leak into
 * user-visible node meta. Defense-in-depth — no known leak path, but the sink
 * is now user-facing (spec-sync mcp-client follow-up, task_fa96e218).
 *
 * **재사용**: bearer 토큰·`Authorization` 헤더·URL userinfo(`scheme://***@host`)·bare JWT·
 * labelled secret(`client_secret`/`api_key`/`password`/… + `token` **계열 전체**) 는 전부 공용
 * {@link SECRET_LEAK_PATTERNS}(여러 모듈이 이미 소비하는 SoT)가 덮는다 — 2026-08-17 기준
 * {@link MCP_EXTRA_SECRET_PATTERNS} 는 **비어 있고** 이 함수는 사실상 공용 SoT 의 얇은
 * 래퍼다. cap 은 `sanitizeMcpErrorMessage` 가 §8.2 의 2048(공용 200 과 별개 — MCP 서버
 * 에러가 더 길 수 있음)로 적용한다.
 */
export function redactMcpSecrets(msg: string): string {
  let out = msg;
  for (const [pattern, replacement] of MCP_EXTRA_SECRET_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  for (const pattern of SECRET_LEAK_PATTERNS) {
    out = out.replace(pattern, '***');
  }
  return out;
}

/**
 * Strip control chars from a free-form error message, redact credential-shaped
 * spans, and clamp to the max length. Used for both DB writes and `logger.warn`
 * so external content can never break log aggregator parsers (newlines), leak
 * secrets, or bloat persisted error blobs.
 */
export function sanitizeMcpErrorMessage(raw: unknown): string {
  let msg: string;
  if (raw instanceof Error) {
    msg = raw.message;
  } else if (typeof raw === 'string') {
    msg = raw;
  } else if (raw == null) {
    msg = '';
  } else {
    // Avoid implicit Object stringification ('[object Object]'). For unknown
    // shapes prefer JSON; on circular structures fall back to a stub.
    try {
      msg = JSON.stringify(raw);
    } catch {
      msg = '[unserializable error]';
    }
  }
  // Redact before clamping so a truncated tail can't leave a token half-exposed.
  return redactMcpSecrets(msg.replace(/[\r\n\t]+/g, ' ')).slice(
    0,
    MCP_ERROR_MESSAGE_MAX_LEN,
  );
}
