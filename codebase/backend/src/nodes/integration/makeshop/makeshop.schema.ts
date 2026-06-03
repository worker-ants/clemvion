import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';
import { MAKESHOP_RESOURCES } from './metadata/index';

/**
 * MakeShop node — single-node, metadata-driven MakeShop Shop API caller.
 * spec/4-nodes/4-integration/5-makeshop.md.
 */

const RESOURCE_ENUM = z.enum(
  MAKESHOP_RESOURCES as unknown as [string, ...string[]],
);

// spec §1 — pagination is standardised `{ limit?, offset? }`, separate from
// `fields`. cursor pagination support is unconfirmed (§9.7) — limit/offset only.
export const makeshopPaginationSchema = z
  .object({
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
  })
  .partial()
  .passthrough();

export const makeshopNodeConfigSchema = z
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
        integrationServiceType: 'makeshop',
      }),
    resource: RESOURCE_ENUM.optional().meta({
      ui: {
        label: 'Resource',
        widget: 'select',
        order: 2,
      },
    }),
    operation: z
      .string()
      .optional()
      .meta({
        ui: { label: 'Operation', widget: 'select', order: 3 },
      }),
    fields: z
      .record(z.string(), z.unknown())
      .default({})
      .meta({ ui: { label: 'Fields', widget: 'dynamic-object', order: 4 } }),
    pagination: makeshopPaginationSchema.optional().meta({
      ui: { label: 'Pagination', widget: 'pagination', order: 5 },
    }),
  })
  .passthrough();

export type MakeshopConfig = z.infer<typeof makeshopNodeConfigSchema>;

export const makeshopNodeOutputSchema = z
  .object({
    config: z
      .object({
        integrationId: z.string().optional(),
        resource: z.string().optional(),
        operation: z.string().optional(),
        fields: z.record(z.string(), z.unknown()).optional(),
        pagination: z
          .object({
            limit: z.number().optional(),
            offset: z.number().optional(),
          })
          .partial()
          .passthrough()
          .optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .object({
        response: z.unknown().optional(),
        error: z
          .object({
            code: z.string().optional(),
            message: z.string().optional(),
            details: z.record(z.string(), z.unknown()).optional(),
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
        statusCode: z.number().optional(),
        durationMs: z.number().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    port: z.enum(['success', 'error']).optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const makeshopNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'success', label: 'Success', type: 'data' },
    { id: 'error', label: 'Error', type: 'error' },
  ],
};

export const makeshopNodeMetadata: NodeComponentMetadata = {
  type: 'makeshop',
  category: 'integration',
  label: 'MakeShop',
  description: 'Call any MakeShop Shop API endpoint via resource/operation',
  icon: '🛒',
  color: '#2563EB',
  executionMetadata: { kind: 'standard' },
  // Re-run dry-run (spec/5-system/13-replay-rerun.md §7) — makeshop is an
  // external side-effect Integration node. In dry-run, the handler mocks WRITE
  // operations (POST) and passes READ operations (GET) through unchanged.
  supportsDryRun: true,
  summaryTemplate: {
    template: '{{resource}} · {{operation}}',
    warnWhen: '!resource || !operation',
    warnMessage: 'Resource / operation not selected',
  },
  warningRules: [
    {
      id: 'makeshop:no-integration',
      when: '!integrationId',
      message: 'Integration must be selected.',
    },
    {
      id: 'makeshop:no-resource',
      when: '!resource',
      message: 'Resource must be selected.',
    },
    {
      id: 'makeshop:no-operation',
      when: '!operation',
      message: 'Operation must be selected.',
    },
  ],
};
