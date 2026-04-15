import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const variableModificationNodeConfigSchema = z.object({}).passthrough();
export type VariableModificationConfig = z.infer<
  typeof variableModificationNodeConfigSchema
>;

export const variableModificationNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const variableModificationNodeMetadata: NodeComponentMetadata = {
  type: 'variable_modification',
  category: 'logic',
  label: 'Set Variable',
  description: 'Modify variables',
  icon: 'PenLine',
  color: '#3B82F6',

  defaultConfig: { modifications: [] },
};
