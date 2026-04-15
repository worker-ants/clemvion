import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const databaseQueryNodeConfigSchema = z.object({}).passthrough();
export type DatabaseQueryConfig = z.infer<typeof databaseQueryNodeConfigSchema>;

export const databaseQueryNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const databaseQueryNodeMetadata: NodeComponentMetadata = {
  type: 'database_query',
  category: 'integration',
  label: 'Database',
  description: 'Execute SQL queries',
  icon: 'Database',
  color: '#F97316',

  defaultConfig: { parameters: [], queryType: 'select' },
};
