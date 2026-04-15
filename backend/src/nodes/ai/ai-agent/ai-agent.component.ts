import { AiAgentHandler } from '../../../modules/execution-engine/handlers/ai/ai-agent.handler';
import { NodeComponent } from '../../core/node-component.interface';
import {
  aiAgentNodeConfigSchema,
  aiAgentNodeMetadata,
  aiAgentNodePorts,
} from './ai-agent.schema';

export const aiAgentNodeComponent: NodeComponent = {
  metadata: aiAgentNodeMetadata,
  ports: aiAgentNodePorts,
  configSchema: aiAgentNodeConfigSchema,
  createHandler: (deps) =>
    new AiAgentHandler(deps.llmService, deps.ragSearchService),
};
