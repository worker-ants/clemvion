import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

/**
 * Single select/radio/checkbox option. `value` 는 zod 가 unknown 으로 두지만
 * 빈 옵션 추가 시 UI 가 controlled-input warning 을 내지 않도록 default 를
 * 빈 문자열로 둔다 — 사용자가 후속에 boolean/number 등으로 덮어쓰면 그 값을
 * 그대로 보존 (z.unknown 의 default 는 강제 변환을 하지 않음).
 */
export const optionSchema = z
  .object({
    label: z.string().default(''),
    value: z.unknown().default(''),
  })
  .passthrough();

const validationRuleSchema = z
  .object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

const formFieldSchema = z
  .object({
    name: z
      .string()
      .default('')
      .meta({ ui: { label: 'Name', widget: 'text' } }),
    type: z
      .enum([
        'text',
        'number',
        'email',
        'textarea',
        'select',
        'checkbox',
        'radio',
        'date',
        'file',
      ])
      .default('text')
      .meta({ ui: { label: 'Type', widget: 'select' } }),
    label: z
      .string()
      .default('')
      .meta({ ui: { label: 'Label', widget: 'text' } }),
    required: z
      .boolean()
      .optional()
      .meta({ ui: { label: 'Required', widget: 'checkbox' } }),
    options: z
      .array(optionSchema)
      .optional()
      .meta({
        ui: {
          label: 'Options',
          widget: 'field-array',
          itemLabel: 'Option',
        },
      }),
    defaultValue: z.unknown().optional(),
    validation: validationRuleSchema.optional(),
    allowedMimeTypes: z.array(z.string()).optional(),
    maxFileSize: z.number().optional(),
    maxTotalSize: z.number().optional(),
    maxFiles: z.number().optional(),
  })
  .passthrough();

/**
 * Runtime shape after the user submits the form (CONVENTIONS §4.3 / §4.5).
 * The handler only writes `output: {}` at the waiting tick; the engine fills
 * `output.interaction.{type, data, receivedAt}` on resume. User-declared
 * fields inside `interaction.data` are projected by the frontend enricher
 * `enrichFormOutputSchema` from `config.fields[].name`.
 */
export const formNodeOutputSchema = z
  .object({
    config: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        submitLabel: z.string().optional(),
        fields: z.array(formFieldSchema).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .object({
        interaction: z
          .object({
            type: z.literal('form_submitted').optional(),
            data: z.record(z.string(), z.unknown()).optional(),
            receivedAt: z.string().optional(),
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
        interactionType: z.literal('form').optional(),
        durationMs: z.number().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const formNodeConfigSchema = z
  .object({
    title: z
      .string()
      .default('')
      .meta({ ui: { label: 'Title', widget: 'text' } }),
    description: z
      .string()
      .optional()
      .meta({ ui: { label: 'Description', widget: 'textarea' } }),
    submitLabel: z
      .string()
      .default('Submit')
      .meta({ ui: { label: 'Submit Label', widget: 'text' } }),
    fields: z
      .array(formFieldSchema)
      .default([])
      .meta({
        ui: {
          label: 'Fields',
          widget: 'field-array',
          itemLabel: 'Field',
        },
      }),
  })
  .passthrough();
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
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `formSummary` warning (no fields)
  //  - backend handler.validate's `fields` non-empty check
  // Form has no buttons array on its config, so no `validateConfig` is
  // needed at this step — every active rule expresses cleanly in the
  // mini-DSL.
  warningRules: [
    {
      id: 'form:no-fields',
      when: 'length(fields) == 0',
      message: '최소 1개 이상의 필드를 정의해야 합니다.',
    },
  ],
};
