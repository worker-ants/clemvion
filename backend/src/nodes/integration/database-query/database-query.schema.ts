import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const databaseQueryNodeConfigSchema = z
  .object({
    integrationId: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Integration',
          widget: 'integration-selector',
          order: 1,
        },
      }),
    queryType: z
      .enum(['select', 'insert', 'update', 'delete', 'raw'])
      .default('select')
      .meta({ ui: { label: 'Query Type', widget: 'select', order: 2 } }),
    query: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'SQL',
          widget: 'code',
          language: 'sql',
          order: 3,
        },
      }),
    parameters: z
      .array(z.unknown())
      .default([])
      .meta({
        ui: {
          label: 'Parameters',
          widget: 'field-array',
          itemLabel: 'Param',
          order: 4,
        },
      }),
  })
  .passthrough();
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
};
