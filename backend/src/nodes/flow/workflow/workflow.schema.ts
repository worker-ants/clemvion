import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const workflowNodeConfigSchema = z.object({}).passthrough();
export type WorkflowConfig = z.infer<typeof workflowNodeConfigSchema>;

export const workflowNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const workflowNodeMetadata: NodeComponentMetadata = {
  type: 'workflow',
  category: 'flow',
  label: 'Sub-Workflow',
  description: 'Call another workflow',
  icon: 'Workflow',
  color: '#8B5CF6',

  defaultConfig: {},
};
