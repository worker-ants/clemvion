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

const itemDefSchema = z
  .object({
    title: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Title',
          widget: 'expression',
          placeholder: 'Slide title',
        },
      }),
    description: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Description',
          widget: 'expression',
          placeholder: 'Slide description (optional)',
        },
      }),
    image: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Image URL',
          widget: 'expression',
          placeholder: 'https://... (optional)',
        },
      }),
    buttons: z
      .array(buttonDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Item Buttons',
          widget: 'button-list',
          collapsible: true,
        },
      }),
  })
  .passthrough();

export const carouselNodeConfigSchema = z
  .object({
    mode: z
      .enum(['static', 'dynamic'])
      .default('dynamic')
      .meta({
        ui: {
          label: 'Mode',
          widget: 'select',
          order: 0,
          options: [
            { value: 'static', label: 'Static Items' },
            { value: 'dynamic', label: 'Dynamic (from input)' },
          ],
          // Intentionally does NOT include `items` or `itemButtons`: those hold
          // user-authored content and would cause silent data loss on mode
          // switch. They're already hidden via `visibleWhen` in the opposite
          // mode, so preservation is safe.
        },
      }),

    // ── Static mode fields ──
    items: z
      .array(itemDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Items',
          widget: 'field-array',
          itemLabel: 'Item',
          order: 1,
          group: 'Items',
          visibleWhen: { field: 'mode', equals: 'static' },
        },
      }),

    // ── Dynamic mode fields ──
    source: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Source',
          widget: 'expression',
          placeholder: '{{ $input.items }}',
          hint: 'Expression that returns the array to display',
          order: 10,
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),
    titleField: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Title Field',
          widget: 'expression',
          placeholder: 'title',
          hint: 'Field path for slide title',
          order: 11,
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),
    descriptionField: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Description Field',
          widget: 'expression',
          placeholder: 'description',
          order: 12,
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),
    imageField: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Image Field',
          widget: 'expression',
          placeholder: 'imageUrl (optional)',
          order: 13,
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),
    maxItems: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .meta({
        ui: {
          label: 'Max Items',
          widget: 'number',
          order: 14,
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),
    itemButtons: z
      .array(buttonDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Item Buttons',
          widget: 'button-list',
          order: 15,
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),

    // ── Common fields ──
    layout: z
      .enum(['card', 'image', 'minimal'])
      .default('card')
      .meta({
        ui: {
          label: 'Layout',
          widget: 'select',
          order: 20,
          options: [
            { value: 'card', label: 'Card' },
            { value: 'image', label: 'Image' },
            { value: 'minimal', label: 'Minimal' },
          ],
        },
      }),
    buttons: z
      .array(buttonDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Buttons',
          widget: 'button-list',
          order: 30,
          group: 'Buttons',
          collapsible: true,
        },
      }),
  })
  .passthrough();
export type CarouselConfig = z.infer<typeof carouselNodeConfigSchema>;

export const carouselNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const carouselNodeMetadata: NodeComponentMetadata = {
  type: 'carousel',
  category: 'presentation',
  label: 'Carousel',
  description: 'Display as slides',
  icon: 'GalleryHorizontal',
  color: '#EC4899',
};
