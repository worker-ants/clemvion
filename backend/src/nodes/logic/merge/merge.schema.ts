import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const mergeNodeConfigSchema = z.object({}).passthrough();
export type MergeConfig = z.infer<typeof mergeNodeConfigSchema>;

export const mergeNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const mergeNodeMetadata: NodeComponentMetadata = {
  type: 'merge',
  category: 'logic',
  label: 'Merge',
  description: 'Combine inputs',
  icon: 'Merge',
  color: '#3B82F6',

  defaultConfig: { strategy: 'wait_all', outputFormat: 'array', timeout: 300 },
};
