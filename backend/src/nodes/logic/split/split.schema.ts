import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const splitNodeOutputSchema = z
  .object({
    config: z
      .object({
        fieldPath: z.unknown().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .array(
        z
          .object({
            index: z.number(),
            value: z.unknown(),
          })
          .passthrough(),
      )
      .optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const splitNodeConfigSchema = z
  .object({
    fieldPath: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Field Path',
          widget: 'expression',
          placeholder: '$input.items',
          hint: 'Dot-path or inline expression returning an array',
        },
      }),
  })
  .passthrough();
export type SplitConfig = z.infer<typeof splitNodeConfigSchema>;

export const splitNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const splitNodeMetadata: NodeComponentMetadata = {
  type: 'split',
  category: 'logic',
  label: 'Split',
  description: 'Split array items',
  icon: 'Split',
  color: '#3B82F6',
  // `summaryTemplate.warnWhen` retained for backward compat — `warningRules`
  // is the new SSOT.
  summaryTemplate: {
    template: '{{fieldPath}}',
    warnWhen: '!fieldPath',
    warnMessage: 'Field path not set',
  },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - legacy `summaryTemplate.warnWhen` (fieldPath missing)
  //  - backend handler.validate's "fieldPath is required" rule.
  warningRules: [
    {
      id: 'split:no-field-path',
      when: '!fieldPath',
      message: 'Field path 를 입력해야 합니다.',
    },
  ],
};
