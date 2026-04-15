import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

const optionSchema = z
  .object({
    label: z.string().default(''),
    value: z.unknown().optional(),
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
};
