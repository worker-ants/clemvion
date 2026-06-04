import { AiAgentHandler } from './ai-agent.handler';
import { NodeComponent } from '../../core/node-component.interface';
import { KbToolProvider } from './tool-providers/kb-tool-provider';
import { McpToolProvider } from './tool-providers/mcp-tool-provider';
import { Cafe24McpToolProvider } from './tool-providers/cafe24-mcp-tool-provider';
import { MakeshopMcpToolProvider } from './tool-providers/makeshop-mcp-tool-provider';
import { RenderToolProvider } from './tool-providers/render-tool-provider';
import type { AgentToolProvider } from './tool-providers/agent-tool-provider.interface';
import {
  aiAgentNodeConfigSchema,
  aiAgentNodeMetadata,
  aiAgentNodeOutputSchema,
  aiAgentNodePorts,
} from './ai-agent.schema';

export const aiAgentNodeComponent: NodeComponent = {
  metadata: aiAgentNodeMetadata,
  ports: aiAgentNodePorts,
  configSchema: aiAgentNodeConfigSchema,
  outputSchema: aiAgentNodeOutputSchema,
  createHandler: (deps) => {
    const providers: AgentToolProvider[] = [
      new KbToolProvider(deps.ragSearchService, deps.knowledgeBaseService),
    ];
    // Cafe24 Internal Bridge MUST come BEFORE the external HTTP MCP
    // provider so its sid-aware matches() can claim cafe24 tools before
    // McpToolProvider's broad `mcp_*` matcher swallows them. The cafe24
    // provider is only registered when its ApiClient was wired in
    // (HandlerDependencies.cafe24ApiClient is optional).
    if (deps.cafe24ApiClient) {
      providers.push(
        new Cafe24McpToolProvider(
          deps.integrationsService,
          deps.cafe24ApiClient,
        ),
      );
    }
    // MakeShop Internal Bridge — same ordering rationale as cafe24: its
    // sid-aware matches() must claim makeshop-owned sids BEFORE the external
    // HTTP McpToolProvider's broad `mcp_*` matcher swallows them. Registered
    // only when its ApiClient was wired in (HandlerDependencies.makeshopApiClient
    // is optional, mirroring cafe24ApiClient).
    if (deps.makeshopApiClient) {
      providers.push(
        new MakeshopMcpToolProvider(
          deps.integrationsService,
          deps.makeshopApiClient,
        ),
      );
    }
    providers.push(
      new McpToolProvider(deps.mcpClientService, deps.integrationsService),
    );
    // Presentation tool family (`render_*`) — spec/4-nodes/3-ai/1-ai-agent.md §4.1.
    // Empty `presentationTools` config keeps the provider quiescent (no tools
    // exposed). Ordering: place after KB/MCP so render_* tool name lookup is
    // independent — matches() prefix sets don't overlap.
    providers.push(new RenderToolProvider());
    return new AiAgentHandler(
      deps.llmService,
      providers,
      deps.eventEmitter,
      deps.conversationThreadService,
      deps.agentMemoryService,
    );
  },
};
