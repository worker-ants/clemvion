import { AiAgentHandler } from './ai-agent.handler';
import { NodeComponent } from '../../core/node-component.interface';
import { KbToolProvider } from './tool-providers/kb-tool-provider';
import { McpToolProvider } from './tool-providers/mcp-tool-provider';
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
  createHandler: (deps) =>
    new AiAgentHandler(
      deps.llmService,
      [
        new KbToolProvider(deps.ragSearchService, deps.knowledgeBaseService),
        new McpToolProvider(deps.mcpClientService, deps.integrationsService),
      ],
      deps.websocketService,
    ),
};
