import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const mapNodeConfigSchema = z.object({}).passthrough();
export type MapConfig = z.infer<typeof mapNodeConfigSchema>;

export const mapNodePorts: NodePorts = {
  inputs: [
    { id: 'in', label: 'Input', type: 'data' },
    { id: 'emit', label: 'Emit', type: 'data' },
  ],
  outputs: [
    { id: 'body', label: 'Body', type: 'data' },
    { id: 'done', label: 'Done', type: 'data' },
  ],
};

export const mapNodeMetadata: NodeComponentMetadata = {
  type: 'map',
  category: 'logic',
  label: 'Map',
  description: 'Transform array items via body subgraph',
  icon: 'Map',
  color: '#3B82F6',
  isContainer: true,
  defaultConfig: { errorPolicy: 'stop' },
};
