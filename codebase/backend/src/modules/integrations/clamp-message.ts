import { MCP_ERROR_MESSAGE_MAX_LEN } from '../mcp/mcp-error-codes';

/**
 * Clamp a free-form error message to {@link MCP_ERROR_MESSAGE_MAX_LEN} so a
 * misbehaving external server cannot inflate the `last_error` JSONB column.
 * The same bound is applied to `IntegrationUsageLog.error.message` and to the
 * connection-test result messages (email · database · http testers) for
 * consistency.
 */
export function clampMessage(raw: string | undefined): string {
  if (!raw) return 'Unknown error';
  return raw.length > MCP_ERROR_MESSAGE_MAX_LEN
    ? raw.slice(0, MCP_ERROR_MESSAGE_MAX_LEN)
    : raw;
}
