import { AiAgentHandler } from './ai-agent.handler';
import { NodeComponent } from '../../core/node-component.interface';
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
    new AiAgentHandler(deps.llmService, deps.ragSearchService),
};
