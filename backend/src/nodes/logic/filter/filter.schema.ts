import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const filterNodeConfigSchema = z.object({}).passthrough();
export type FilterConfig = z.infer<typeof filterNodeConfigSchema>;

export const filterNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'match', label: 'Match', type: 'data' },
    { id: 'unmatched', label: 'Unmatched', type: 'data' },
  ],
};

export const filterNodeMetadata: NodeComponentMetadata = {
  type: 'filter',
  category: 'logic',
  label: 'Filter',
  description: 'Filter array by conditions',
  icon: 'Filter',
  color: '#3B82F6',

  defaultConfig: {},
};
