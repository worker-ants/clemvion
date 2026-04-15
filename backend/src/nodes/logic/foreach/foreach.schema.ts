import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const foreachNodeConfigSchema = z.object({}).passthrough();
export type ForEachConfig = z.infer<typeof foreachNodeConfigSchema>;

export const foreachNodePorts: NodePorts = {
  inputs: [
    { id: 'in', label: 'Input', type: 'data' },
    { id: 'emit', label: 'Emit', type: 'data' },
  ],
  outputs: [
    { id: 'body', label: 'Body', type: 'data' },
    { id: 'done', label: 'Done', type: 'data' },
  ],
};

export const foreachNodeMetadata: NodeComponentMetadata = {
  type: 'foreach',
  category: 'logic',
  label: 'ForEach',
  description: 'Iterate over array',
  icon: 'ListOrdered',
  color: '#3B82F6',
  isContainer: true,
  defaultConfig: { errorPolicy: 'stop' },
};
