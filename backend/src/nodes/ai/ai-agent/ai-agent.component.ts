import { AiAgentHandler } from './ai-agent.handler';
import { NodeComponent } from '../../core/node-component.interface';
import { KbToolProvider } from './tool-providers/kb-tool-provider';
import { McpToolProvider } from './tool-providers/mcp-tool-provider';
import { Cafe24McpToolProvider } from './tool-providers/cafe24-mcp-tool-provider';
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
    providers.push(
      new McpToolProvider(deps.mcpClientService, deps.integrationsService),
    );
    return new AiAgentHandler(
      deps.llmService,
      providers,
      deps.websocketService,
    );
  },
};
