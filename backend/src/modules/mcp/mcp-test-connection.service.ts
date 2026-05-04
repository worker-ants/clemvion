import { Injectable } from '@nestjs/common';
import {
  McpAuthError,
  McpClientService,
  McpConnectParams,
  McpHttpsRequiredError,
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

export type McpFailureCode =
  | 'MCP_HTTPS_REQUIRED'
  | 'MCP_AUTH_FAILED'
  | 'MCP_CONNECT_FAILED'
  | 'MCP_INITIALIZE_FAILED'
  | 'MCP_LIST_FAILED';

/**
 * Performs a one-shot connect → initialize → optional tools/list probe
 * against an MCP server, then disconnects. Any error along the way is
 * normalized to the {@link McpFailureCode} vocabulary so the integrations
 * UI can render a stable message regardless of which phase failed.
 *
 * The session opened here is **always** closed (success or failure) so the
 * test endpoint can be invoked aggressively from the registration UI without
 * leaking connections.
 */
@Injectable()
export class McpTestConnectionService {
  constructor(private readonly client: McpClientService) {}

  async test(params: McpConnectParams): Promise<TestConnectionResult> {
    let session: Awaited<ReturnType<McpClientService['connect']>> | null = null;
    try {
      session = await this.client.connect(params);
    } catch (err) {
      return this.classifyConnectError(err);
    }

    const capabilities = session.capabilities;
    const serverInfo = session.serverInfo;
    let toolCount: number | undefined;

    try {
      if (capabilities.tools !== undefined) {
        const list = await session.listTools();
        toolCount = list.tools.length;
      }
    } catch (err) {
      await session.close().catch(() => undefined);
      return {
        success: false,
        code: 'MCP_LIST_FAILED',
        message: this.errorMessage(err, 'Failed to list MCP tools'),
      };
    }

    await session.close().catch(() => undefined);

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
  }

  private classifyConnectError(err: unknown): TestConnectionResult {
    if (err instanceof McpHttpsRequiredError) {
      return {
        success: false,
        code: 'MCP_HTTPS_REQUIRED',
        message: err.message,
      };
    }
    if (err instanceof McpAuthError) {
      return {
        success: false,
        code: 'MCP_AUTH_FAILED',
        message: err.message,
      };
    }
    return {
      success: false,
      code: 'MCP_CONNECT_FAILED',
      message: this.errorMessage(err, 'Failed to connect to MCP server'),
    };
  }

  private errorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === 'string') return err;
    return fallback;
  }
}
