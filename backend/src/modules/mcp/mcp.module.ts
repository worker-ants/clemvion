import { Module } from '@nestjs/common';
import { McpClientService } from './mcp-client.service';
import { McpTestConnectionService } from './mcp-test-connection.service';

/**
 * Foundation module for the MCP (Model Context Protocol) integration.
 *
 * Exports:
 * - {@link McpClientService} — connect/list/call wrapper for the official SDK
 * - {@link McpTestConnectionService} — preview-test for new MCP integrations
 *
 * Stage 2 will add `McpToolProvider` (consumed by AI Agent's
 * `AgentToolProvider` array). That provider lives in `nodes/ai/ai-agent/...`
 * not here, but it injects `McpClientService` from this module.
 */
@Module({
  providers: [McpClientService, McpTestConnectionService],
  exports: [McpClientService, McpTestConnectionService],
})
export class McpModule {}
