import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const aiAgentNodeConfigSchema = z.object({}).passthrough();
export type AiAgentConfig = z.infer<typeof aiAgentNodeConfigSchema>;

export const aiAgentNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const aiAgentNodeMetadata: NodeComponentMetadata = {
  type: 'ai_agent',
  category: 'ai',
  label: 'AI Agent',
  description: 'Chat with LLM using RAG context',
  icon: 'Brain',
  color: '#10B981',

  defaultConfig: {
    mode: 'single_turn',
    responseFormat: 'text',
    knowledgeBases: [],
    ragTopK: 5,
    ragThreshold: 0.7,
    toolNodeIds: [],
    toolOverrides: [],
    maxToolCalls: 10,
    conversationHistory: 'none',
    maxTurns: 20,
    conditions: [],
  },
};
