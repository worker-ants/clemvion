import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';
import { CAFE24_RESOURCES } from './metadata/index';

/**
 * Cafe24 node — single-node, metadata-driven Cafe24 Admin API caller.
 * spec/4-nodes/4-integration/4-cafe24.md.
 */

const RESOURCE_ENUM = z.enum(CAFE24_RESOURCES as unknown as [string, ...string[]]);

export const cafe24PaginationSchema = z
  .object({
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
    cursor: z.string().optional(),
  })
  .partial()
  .passthrough();

export const cafe24NodeConfigSchema = z
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
        integrationServiceType: 'cafe24',
      }),
    resource: RESOURCE_ENUM.meta({
      ui: {
        label: 'Resource',
        widget: 'select',
        order: 2,
      },
    }),
    operation: z
      .string()
      .min(1)
      .meta({
        ui: { label: 'Operation', widget: 'select', order: 3 },
      }),
    fields: z
      .record(z.string(), z.unknown())
      .default({})
      .meta({ ui: { label: 'Fields', widget: 'dynamic-object', order: 4 } }),
    pagination: cafe24PaginationSchema.optional().meta({
      ui: { label: 'Pagination', widget: 'pagination', order: 5 },
    }),
  })
  .passthrough();

export type Cafe24Config = z.infer<typeof cafe24NodeConfigSchema>;

export const cafe24NodeOutputSchema = z
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
            cursor: z.string().optional(),
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
        callUsage: z.number().optional(),
        callRemain: z.number().optional(),
        callLimit: z.string().optional(),
        timeUsage: z.number().optional(),
        timeRemain: z.number().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    port: z.enum(['success', 'error']).optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const cafe24NodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'success', label: 'Success', type: 'data' },
    { id: 'error', label: 'Error', type: 'error' },
  ],
};

export const cafe24NodeMetadata: NodeComponentMetadata = {
  type: 'cafe24',
  category: 'integration',
  label: 'Cafe24',
  description: 'Call any Cafe24 Admin API endpoint via resource/operation',
  icon: 'ShoppingBag',
  color: '#2F3E4D',
  executionMetadata: { kind: 'standard' },
  summaryTemplate: {
    template: '{{resource}} · {{operation}}',
    warnWhen: '!resource || !operation',
    warnMessage: 'Resource / operation 미선택',
  },
  warningRules: [
    {
      id: 'cafe24:no-integration',
      when: '!integrationId',
      message: 'Integration 을 선택해야 합니다.',
    },
    {
      id: 'cafe24:no-resource',
      when: '!resource',
      message: 'Resource 를 선택해야 합니다.',
    },
    {
      id: 'cafe24:no-operation',
      when: '!operation',
      message: 'Operation 을 선택해야 합니다.',
    },
  ],
};
