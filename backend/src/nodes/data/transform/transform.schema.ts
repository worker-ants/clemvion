import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const transformNodeConfigSchema = z.object({}).passthrough();
export type TransformConfig = z.infer<typeof transformNodeConfigSchema>;

export const transformNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const transformNodeMetadata: NodeComponentMetadata = {
  type: 'transform',
  category: 'data',
  label: 'Transform',
  description: 'Transform data',
  icon: 'ArrowRightLeft',
  color: '#06B6D4',

  defaultConfig: {},
};
