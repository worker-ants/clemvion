import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const codeNodeConfigSchema = z.object({}).passthrough();
export type CodeConfig = z.infer<typeof codeNodeConfigSchema>;

export const codeNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const codeNodeMetadata: NodeComponentMetadata = {
  type: 'code',
  category: 'data',
  label: 'Code',
  description: 'Run JavaScript code',
  icon: 'Code',
  color: '#06B6D4',

  defaultConfig: {},
};
