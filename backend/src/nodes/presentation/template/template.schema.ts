import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

const buttonDefSchema = z
  .object({
    id: z.string().optional(),
    label: z
      .string()
      .default('')
      .meta({ ui: { label: 'Label', widget: 'expression' } }),
    type: z
      .enum(['link', 'port'])
      .default('port')
      .meta({ ui: { label: 'Type', widget: 'select' } }),
    url: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'URL',
          widget: 'expression',
          visibleWhen: { field: 'type', equals: 'link' },
        },
      }),
    style: z
      .enum(['primary', 'secondary', 'outline', 'danger'])
      .default('secondary')
      .meta({ ui: { label: 'Style', widget: 'select' } }),
  })
  .passthrough();

export const templateNodeConfigSchema = z
  .object({
    template: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Template',
          widget: 'code',
          language: 'handlebars',
        },
      }),
    outputFormat: z
      .enum(['html', 'markdown', 'text'])
      .default('html')
      .meta({ ui: { label: 'Output Format', widget: 'select' } }),
    helpers: z
      .boolean()
      .default(true)
      .meta({ ui: { label: 'Enable Built-in Helpers', widget: 'checkbox' } }),
    buttons: z
      .array(buttonDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Buttons',
          widget: 'field-array',
          itemLabel: 'Button',
        },
      }),
  })
  .passthrough();
export type TemplateConfig = z.infer<typeof templateNodeConfigSchema>;

export const templateNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const templateNodeMetadata: NodeComponentMetadata = {
  type: 'template',
  category: 'presentation',
  label: 'Template',
  description: 'Render templates',
  icon: 'FileText',
  color: '#EC4899',
};
