import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';
import { validateButtons } from '../_shared/button.types';

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

/**
 * Template renders a resolved string into `output.rendered`. With buttons,
 * the engine decorates `output.interaction.{type, data, receivedAt}` on
 * click. Shape is fully static — no enricher needed.
 */
export const templateNodeOutputSchema = z
  .object({
    config: z
      .object({
        template: z.string().optional(),
        outputFormat: z.enum(['html', 'markdown', 'text']).optional(),
        buttons: z.array(buttonDefSchema).optional(),
        buttonConfig: z.record(z.string(), z.unknown()).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .object({
        rendered: z.string().optional(),
        interaction: z
          .object({
            type: z.string().optional(),
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
        interactionType: z.string().optional(),
        durationMs: z.number().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    port: z.string().optional(),
    status: z.string().optional(),
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

/**
 * Imperative escape hatch — global `buttons` validation only (delegated to
 * the shared `validateButtons`). Single-field "is template set?" check lives
 * in `warningRules` above so it fires the canvas badge.
 */
export function validateTemplateConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  return validateButtons(c);
}

export const templateNodeMetadata: NodeComponentMetadata = {
  type: 'template',
  category: 'presentation',
  label: 'Template',
  description: 'Render templates',
  icon: 'FileText',
  color: '#EC4899',
  executionMetadata: { kind: 'standard' },
  isDynamicPorts: true,
  dynamicPorts: {
    kind: 'presentation-buttons',
    continueId: 'continue',
  },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `templateSummary` warning (template missing)
  //  - backend handler.validate's structural string check is already covered
  //    by zod (.default('')), so the only domain rule worth surfacing is the
  //    "template is empty" warning.
  warningRules: [
    {
      id: 'template:no-template',
      when: '!template',
      message: 'Template body must be entered.',
    },
  ],
  validateConfig: validateTemplateConfig,
};
