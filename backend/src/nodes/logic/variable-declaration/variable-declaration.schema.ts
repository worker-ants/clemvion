import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const variableDeclarationNodeConfigSchema = z.object({}).passthrough();
export type VariableDeclarationConfig = z.infer<
  typeof variableDeclarationNodeConfigSchema
>;

export const variableDeclarationNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const variableDeclarationNodeMetadata: NodeComponentMetadata = {
  type: 'variable_declaration',
  category: 'logic',
  label: 'Variable',
  description: 'Declare variables',
  icon: 'Variable',
  color: '#3B82F6',

  defaultConfig: { variables: [] },
};
