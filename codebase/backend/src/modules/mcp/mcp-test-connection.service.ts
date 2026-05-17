import { Injectable } from '@nestjs/common';
import { withTimeout } from '../../common/utils/with-timeout';
import {
  McpAuthError,
  McpClientService,
  McpConnectParams,
  McpHttpsRequiredError,
  McpInvalidHeaderError,
  McpSession,
  ServerCapabilities,
  ServerInfo,
} from './mcp-client.service';

/**
 * Result returned to the integrations preview-test endpoint when the user
 * registers a new `service_type='mcp'` Integration. Mirrors the shape spec'd
 * in `spec/5-system/11-mcp-client.md §9`.
 */
export interface TestConnectionResult {
  success: boolean;
  message: string;
  /** Populated on success for the registration UI's capability preview. */
  capabilities?: ServerCapabilities;
  serverInfo?: ServerInfo;
  preview?: ConnectionPreview;
  /** Populated on failure with an `MCP_*` vocabulary code. */
  code?: McpFailureCode;
}

export interface ConnectionPreview {
  /** Only present when the server reports `tools` capability. */
  toolCount?: number;
  resourceSupported: boolean;
  promptSupported: boolean;
}

/**
 * Vocabulary surfaced to the registration UI. `MCP_INITIALIZE_FAILED` is
 * intentionally absent — the SDK fuses transport connect + JSON-RPC
 * initialize into a single call so distinguishing them is not actionable
 * for the user. Both surface as `MCP_CONNECT_FAILED`. See spec §8.2.
 */
export type McpFailureCode =
  | 'MCP_HTTPS_REQUIRED'
  | 'MCP_AUTH_FAILED'
  | 'MCP_CONNECT_FAILED'
  | 'MCP_LIST_FAILED';

/** Generic message bodies — keeps internal IPs / paths out of API responses. */
const GENERIC_CONNECT_FAILURE_MESSAGE =
  'Failed to connect to the MCP server. Verify the URL is reachable and the credentials are correct.';
const GENERIC_LIST_FAILURE_MESSAGE =
  'Connected to the MCP server but failed to list tools.';

const LIST_TIMEOUT_MS = Number(process.env.MCP_LIST_TIMEOUT_MS) || 10_000;

/**
 * Performs a one-shot connect → optional tools/list probe against an MCP
 * server, then disconnects. Any error along the way is normalized to the
 * {@link McpFailureCode} vocabulary so the integrations UI can render a
 * stable code regardless of which phase failed.
 *
 * The session opened here is **always** closed (success or failure) so the
 * test endpoint can be invoked aggressively from the registration UI without
 * leaking connections or open SSE streams.
 *
 * Internal error messages are NOT echoed verbatim — the SDK can include
 * resolved IPs / file paths / stack frames in its error strings, which
 * would be a network reconnaissance leak if returned to the client. The
 * detail is logged server-side; the response is generic.
 */
@Injectable()
export class McpTestConnectionService {
  constructor(private readonly client: McpClientService) {}

  async test(params: McpConnectParams): Promise<TestConnectionResult> {
    let session: McpSession | null = null;
    try {
      try {
        session = await this.client.connect(params);
      } catch (err) {
        return this.classifyConnectError(err);
      }

      const capabilities = session.capabilities;
      const serverInfo = session.serverInfo;
      let toolCount: number | undefined;

      if (capabilities.tools !== undefined) {
        try {
          const list = await withTimeout(
            session.listTools(),
            LIST_TIMEOUT_MS,
            'tools/list',
          );
          toolCount = list.tools.length;
        } catch (err) {
          this.logInternal('MCP_LIST_FAILED', err);
          return {
            success: false,
            code: 'MCP_LIST_FAILED',
            message: GENERIC_LIST_FAILURE_MESSAGE,
          };
        }
      }

      return {
        success: true,
        message: 'Connection successful',
        capabilities,
        serverInfo,
        preview: {
          toolCount,
          resourceSupported: capabilities.resources !== undefined,
          promptSupported: capabilities.prompts !== undefined,
        },
      };
    } finally {
      if (session) {
        await session.close().catch(() => undefined);
      }
    }
  }

  private classifyConnectError(err: unknown): TestConnectionResult {
    if (err instanceof McpHttpsRequiredError) {
      return {
        success: false,
        code: 'MCP_HTTPS_REQUIRED',
        // McpHttpsRequiredError messages are deterministic and don't carry
        // network detail — safe to echo to the client.
        message: err.message,
      };
    }
    if (err instanceof McpAuthError || err instanceof McpInvalidHeaderError) {
      return {
        success: false,
        code: 'MCP_AUTH_FAILED',
        message: err.message,
      };
    }
    this.logInternal('MCP_CONNECT_FAILED', err);
    return {
      success: false,
      code: 'MCP_CONNECT_FAILED',
      message: GENERIC_CONNECT_FAILURE_MESSAGE,
    };
  }

  private logInternal(code: McpFailureCode, err: unknown): void {
    const detail = err instanceof Error ? err.message : String(err);

    console.warn(`[mcp:test] ${code}: ${detail}`);
  }
}
