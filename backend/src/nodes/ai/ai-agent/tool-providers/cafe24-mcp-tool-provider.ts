import { Logger } from '@nestjs/common';
import {
  ToolCall,
  ToolDef,
} from '../../../../modules/llm/interfaces/llm-client.interface.js';
import {
  AgentToolProvider,
  AgentToolResult,
  ProviderBuildCtx,
  ProviderCleanupCtx,
  ProviderExecCtx,
} from './agent-tool-provider.interface.js';
import { IntegrationsService } from '../../../../modules/integrations/integrations.service.js';
import {
  Cafe24ApiClient,
  Cafe24AuthFailedError,
  Cafe24RateLimitedError,
  Cafe24TransportFailedError,
} from '../../../integration/cafe24/cafe24-api.client.js';
import {
  Cafe24OperationMetadata,
  Cafe24Resource,
  listAllCafe24Operations,
} from '../../../integration/cafe24/metadata/index.js';
import { Integration } from '../../../../modules/integrations/entities/integration.entity.js';

/**
 * Cafe24 MCP Tool Provider — surfaces Cafe24 Admin API operations to the
 * AI Agent as MCP-style tools (`mcp_<sid>__<operation_id>`) via the
 * in-process Internal Bridge transport. spec/5-system/11-mcp-client.md §2.3
 * + spec/4-nodes/4-integration/4-cafe24.md §8.
 *
 * Coexists with the existing McpToolProvider (which handles external HTTP
 * MCP servers, `service_type='mcp'`):
 *  - This provider is registered BEFORE McpToolProvider so `matches()` can
 *    win for Cafe24-owned sids.
 *  - matches() returns true only for sids that buildTools has registered
 *    for cafe24 — other `mcp_*` names fall through to McpToolProvider.
 */
export class Cafe24McpToolProvider implements AgentToolProvider {
  readonly key = 'cafe24-mcp';
  private readonly logger = new Logger(Cafe24McpToolProvider.name);

  // Set of sids belonging to cafe24 Integrations registered via buildTools.
  // Used by matches() so an external mcp_<sid>__ name doesn't accidentally
  // route here. Execution-scoped state is stored on `executionState`.
  private readonly ownedSids = new Set<string>();

  // executionId -> per-execution lookup tables (integrations + operations).
  // sidToOpMap: sid -> operation id -> { resource, operation } pair so that
  // an integration can expose many (resource, operation) tuples under one sid.
  private readonly executionState = new Map<
    string,
    {
      sidToIntegration: Map<string, Integration>;
      sidToOpMap: Map<
        string,
        Map<string, { resource: Cafe24Resource; operation: Cafe24OperationMetadata }>
      >;
    }
  >();

  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly cafe24ApiClient: Cafe24ApiClient,
  ) {}

  matches(toolName: string): boolean {
    if (!toolName.startsWith('mcp_')) return false;
    const sid = this.extractSid(toolName);
    return sid !== null && this.ownedSids.has(sid);
  }

  async buildTools(ctx: ProviderBuildCtx): Promise<ToolDef[]> {
    if (!ctx.executionId) {
      this.logger.warn(
        'Cafe24McpToolProvider.buildTools called without executionId — skipping',
      );
      return [];
    }
    const mcpServers = this.extractMcpServers(ctx.config);
    if (mcpServers.length === 0) return [];

    const tools: ToolDef[] = [];
    const state = this.ensureState(ctx.executionId);

    for (const ref of mcpServers) {
      if (!ref.integrationId) continue;

      let integration: Integration;
      try {
        integration = await this.integrationsService.getForExecution(
          ref.integrationId,
          ctx.workspaceId,
        );
      } catch (err) {
        this.logger.warn(
          `Cafe24 integration ${ref.integrationId} lookup failed: ${this.errMsg(err)}`,
        );
        continue;
      }

      // Only react to cafe24 — other service_types belong to McpToolProvider.
      if (integration.serviceType !== 'cafe24') continue;
      if (integration.status !== 'connected') {
        this.logger.warn(
          `Cafe24 integration ${integration.id} not connected (status=${integration.status}) — skipped`,
        );
        continue;
      }

      const sid = sanitizeSid(integration.id);
      const enabled = this.applyAllowlist(ref.enabledTools);

      const opMap = new Map<
        string,
        { resource: Cafe24Resource; operation: Cafe24OperationMetadata }
      >();
      for (const { resource, operation } of listAllCafe24Operations()) {
        if (!enabled(operation.id)) continue;
        opMap.set(operation.id, { resource, operation });
        tools.push({
          name: `mcp_${sid}__${operation.id}`,
          description: `${operation.description}\n\n(Cafe24 ${operation.method} ${operation.path} — via Internal Bridge: ${integration.name})`,
          parameters: this.buildJsonSchema(operation),
        });
      }
      state.sidToIntegration.set(sid, integration);
      state.sidToOpMap.set(sid, opMap);
      this.ownedSids.add(sid);
    }

    return tools;
  }

  async execute(
    call: ToolCall,
    ctx: ProviderExecCtx,
  ): Promise<AgentToolResult> {
    const sid = this.extractSid(call.name);
    const operationId = this.extractOperationId(call.name);
    if (!sid || !operationId) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: { code: 'CAFE24_MCP_TOOL_NAME_INVALID', name: call.name },
        }),
        status: 'error',
        error: `Invalid tool name: ${call.name}`,
      };
    }

    const state = ctx.executionId
      ? this.executionState.get(ctx.executionId)
      : undefined;
    if (!state) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: {
            code: 'CAFE24_MCP_NO_SESSION',
            message: 'buildTools was not called for this execution',
          },
        }),
        status: 'error',
        error: 'No active cafe24 MCP session',
      };
    }
    const integration = state.sidToIntegration.get(sid);
    const opMap = state.sidToOpMap.get(sid);
    if (!integration || !opMap) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: { code: 'CAFE24_MCP_INTEGRATION_UNKNOWN', sid },
        }),
        status: 'error',
        error: `Unknown sid ${sid}`,
      };
    }
    const opEntry = opMap.get(operationId);
    if (!opEntry) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: {
            code: 'CAFE24_UNKNOWN_OPERATION',
            operation: operationId,
          },
        }),
        status: 'error',
        error: `Unknown cafe24 operation ${operationId}`,
      };
    }
    const { operation } = opEntry;

    let args: Record<string, unknown> = {};
    try {
      args = call.arguments
        ? (JSON.parse(call.arguments) as Record<string, unknown>)
        : {};
    } catch {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: { code: 'CAFE24_MCP_TOOL_ARGS_INVALID' },
        }),
        status: 'error',
        error: 'Tool arguments are not valid JSON',
      };
    }

    // Required field check.
    const missing = operation.requiredFields.filter(
      (k) => args[k] === undefined || args[k] === null || args[k] === '',
    );
    if (missing.length > 0) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: {
            code: 'CAFE24_MISSING_FIELDS',
            missing,
          },
        }),
        status: 'error',
        error: `Missing required fields: ${missing.join(', ')}`,
      };
    }

    // Split args into path/query/body per metadata.
    let path = operation.path;
    const query: Record<string, unknown> = {};
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args)) {
      if (v === undefined || v === null) continue;
      const spec = operation.fields[k];
      if (!spec) continue;
      if (spec.location === 'path') {
        path = path.replace(
          new RegExp(`\\{${k}\\}`, 'g'),
          encodeURIComponent(String(v)),
        );
      } else if (spec.location === 'query') {
        query[k] = v;
      } else {
        body[k] = v;
      }
    }

    const startedAt = Date.now();
    try {
      const result = await this.cafe24ApiClient.call(integration, {
        method: operation.method as 'GET' | 'POST' | 'PUT' | 'DELETE',
        path,
        query,
        body:
          Object.keys(body).length > 0 && operation.method !== 'GET'
            ? body
            : undefined,
      });

      // Usage log — success.
      if (ctx.nodeExecutionId && ctx.workflowId) {
        await this.integrationsService.logUsage({
          integrationId: integration.id,
          nodeExecutionId: ctx.nodeExecutionId,
          workflowId: ctx.workflowId,
          status: result.status >= 400 ? 'failed' : 'success',
          durationMs: Date.now() - startedAt,
          error:
            result.status >= 400
              ? {
                  code: this.codeForStatus(result.status),
                  message: `Cafe24 API returned ${result.status}`,
                }
              : null,
        });
      }

      const status: 'success' | 'error' =
        result.status >= 400 ? 'error' : 'success';
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          status: result.status,
          response: result.body,
        }),
        status,
      };
    } catch (err) {
      const errInfo = this.classifyError(err);
      if (ctx.nodeExecutionId && ctx.workflowId) {
        await this.integrationsService
          .logUsage({
            integrationId: integration.id,
            nodeExecutionId: ctx.nodeExecutionId,
            workflowId: ctx.workflowId,
            status: 'failed',
            durationMs: Date.now() - startedAt,
            error: { code: errInfo.code, message: errInfo.message },
          })
          .catch(() => undefined);
      }
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: {
            code: errInfo.code,
            message: errInfo.message,
          },
        }),
        status: 'error',
        error: errInfo.message,
      };
    }
  }

  async cleanup(ctx: ProviderCleanupCtx): Promise<void> {
    if (!ctx.executionId) {
      // Cleanup all — used by tests.
      for (const state of this.executionState.values()) {
        for (const sid of state.sidToIntegration.keys()) this.ownedSids.delete(sid);
      }
      this.executionState.clear();
      return;
    }
    const state = this.executionState.get(ctx.executionId);
    if (!state) return;
    for (const sid of state.sidToIntegration.keys()) this.ownedSids.delete(sid);
    this.executionState.delete(ctx.executionId);
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private ensureState(executionId: string): {
    sidToIntegration: Map<string, Integration>;
    sidToOpMap: Map<
      string,
      Map<string, { resource: Cafe24Resource; operation: Cafe24OperationMetadata }>
    >;
  } {
    let s = this.executionState.get(executionId);
    if (!s) {
      s = {
        sidToIntegration: new Map(),
        sidToOpMap: new Map(),
      };
      this.executionState.set(executionId, s);
    }
    return s;
  }

  private extractMcpServers(
    config: Record<string, unknown>,
  ): Array<{
    integrationId?: string;
    enabledTools?: string[];
  }> {
    const raw = config.mcpServers;
    if (!Array.isArray(raw)) return [];
    return raw as Array<{ integrationId?: string; enabledTools?: string[] }>;
  }

  private extractSid(toolName: string): string | null {
    // mcp_<sid>__<rest>. Split on the first `__`.
    if (!toolName.startsWith('mcp_')) return null;
    const afterPrefix = toolName.slice(4);
    const idx = afterPrefix.indexOf('__');
    if (idx <= 0) return null;
    return afterPrefix.slice(0, idx);
  }

  private extractOperationId(toolName: string): string | null {
    const afterPrefix = toolName.slice(4);
    const idx = afterPrefix.indexOf('__');
    if (idx <= 0) return null;
    return afterPrefix.slice(idx + 2);
  }

  private applyAllowlist(
    enabledTools: string[] | undefined,
  ): (id: string) => boolean {
    if (!enabledTools || enabledTools.length === 0) return () => true;
    if (enabledTools.includes('*')) return () => true;
    const set = new Set(enabledTools);
    return (id: string) => set.has(id);
  }

  private buildJsonSchema(op: Cafe24OperationMetadata): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(op.fields)) {
      const prop: Record<string, unknown> = {};
      if (spec.type === 'enum') {
        prop.type = 'string';
        if (spec.enum) prop.enum = spec.enum;
      } else if (spec.type === 'array') {
        prop.type = 'array';
        prop.items = { type: 'string' };
      } else if (spec.type === 'object') {
        prop.type = 'object';
        prop.additionalProperties = true;
      } else {
        prop.type = spec.type;
      }
      if (spec.description) prop.description = spec.description;
      if (spec.default !== undefined) prop.default = spec.default;
      properties[name] = prop;
    }
    const required = op.requiredFields.length > 0 ? op.requiredFields : undefined;
    const schema: Record<string, unknown> = {
      type: 'object',
      properties,
    };
    if (required) schema.required = required;
    return schema;
  }

  private codeForStatus(status: number): string {
    if (status === 404) return 'CAFE24_404';
    if (status === 422) return 'CAFE24_422';
    if (status >= 500 && status < 600) return 'CAFE24_5XX';
    if (status === 401 || status === 403) return 'CAFE24_AUTH_FAILED';
    if (status === 429) return 'CAFE24_RATE_LIMITED';
    return 'CAFE24_4XX';
  }

  private classifyError(err: unknown): { code: string; message: string } {
    if (err instanceof Cafe24AuthFailedError) {
      return { code: 'CAFE24_AUTH_FAILED', message: err.message };
    }
    if (err instanceof Cafe24RateLimitedError) {
      return { code: 'CAFE24_RATE_LIMITED', message: err.message };
    }
    if (err instanceof Cafe24TransportFailedError) {
      return { code: 'CAFE24_TRANSPORT_FAILED', message: err.message };
    }
    return {
      code: 'CAFE24_CALL_FAILED',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * Compute the sid for a tool name from an Integration id. Mirrors
 * `McpToolProvider.sidFor` so cafe24 and external MCP sids cannot
 * accidentally collide on the wire (both use the same 8-char strip rule).
 */
export function sanitizeSid(integrationId: string): string {
  return integrationId.slice(0, 8).replace(/[^a-z0-9]/gi, '_');
}
