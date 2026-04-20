import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

/**
 * Database Query output shape varies by driver and query type (SELECT vs
 * INSERT/UPDATE/DELETE). Row columns are user-query-dependent and opaque.
 * Tier 3 per node-jazzy-liskov plan.
 */
export const databaseQueryNodeOutputSchema = z
  .object({
    config: z
      .object({
        integrationId: z.string().optional(),
        query: z.string().optional(),
        queryType: z
          .enum(['select', 'insert', 'update', 'delete', 'raw'])
          .optional(),
        parameters: z.union([z.array(z.unknown()), z.string()]).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .object({
        rows: z.array(z.record(z.string(), z.unknown())).optional(),
        rowCount: z.number().optional(),
        insertId: z.number().optional(),
        fields: z
          .array(
            z
              .object({
                name: z.string().optional(),
                dataTypeID: z.number().optional(),
              })
              .passthrough(),
          )
          .optional(),
        error: z
          .object({
            code: z.string().optional(),
            message: z.string().optional(),
          })
          .partial()
          .passthrough()
          .optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    meta: z
      .object({
        durationMs: z.number().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    port: z.enum(['success', 'error']).optional(),
    status: z.string().optional(),
  })
  .passthrough();

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
      .union([z.array(z.unknown()), z.string()])
      .default([])
      .meta({
        ui: {
          label: 'Parameters',
          widget: 'expression',
          order: 4,
          hint: 'JSON array of values bound to $1, $2, ...',
        },
      }),
  })
  .passthrough();
export type DatabaseQueryConfig = z.infer<typeof databaseQueryNodeConfigSchema>;

export const databaseQueryNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'success', label: 'Success', type: 'data' },
    { id: 'error', label: 'Error', type: 'error' },
  ],
};

export const databaseQueryNodeMetadata: NodeComponentMetadata = {
  type: 'database_query',
  category: 'integration',
  label: 'Database',
  description: 'Execute SQL queries',
  icon: 'Database',
  color: '#F97316',
};
