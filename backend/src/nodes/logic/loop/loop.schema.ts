import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const loopNodeConfigSchema = z.object({}).passthrough();
export type LoopConfig = z.infer<typeof loopNodeConfigSchema>;

export const loopNodePorts: NodePorts = {
  inputs: [
    { id: 'in', label: 'Input', type: 'data' },
    { id: 'emit', label: 'Emit', type: 'data' },
  ],
  outputs: [
    { id: 'body', label: 'Body', type: 'data' },
    { id: 'done', label: 'Done', type: 'data' },
  ],
};

export const loopNodeMetadata: NodeComponentMetadata = {
  type: 'loop',
  category: 'logic',
  label: 'Loop',
  description: 'Repeat N times',
  icon: 'Repeat',
  color: '#3B82F6',
  isContainer: true,
  defaultConfig: { count: 1, maxIterations: 1000 },
};
