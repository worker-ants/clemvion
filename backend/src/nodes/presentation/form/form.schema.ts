import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const formNodeConfigSchema = z.object({}).passthrough();
export type FormConfig = z.infer<typeof formNodeConfigSchema>;

export const formNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const formNodeMetadata: NodeComponentMetadata = {
  type: 'form',
  category: 'presentation',
  label: 'Form',
  description: 'User input form',
  icon: 'FileInput',
  color: '#EC4899',

  defaultConfig: {},
};
