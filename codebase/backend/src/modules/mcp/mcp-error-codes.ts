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
 * Strip control chars from a free-form error message and clamp to the max
 * length. Used for both DB writes and `logger.warn` so external content can
 * never break log aggregator parsers (newlines) or bloat persisted error
 * blobs.
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
  return msg.replace(/[\r\n\t]+/g, ' ').slice(0, MCP_ERROR_MESSAGE_MAX_LEN);
}
