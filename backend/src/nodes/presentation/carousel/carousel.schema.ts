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
      .meta({ ui: { label: 'Title', widget: 'expression' } }),
    description: z
      .string()
      .optional()
      .meta({ ui: { label: 'Description', widget: 'expression' } }),
    image: z
      .string()
      .optional()
      .meta({ ui: { label: 'Image URL', widget: 'expression' } }),
    buttons: z
      .array(buttonDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Item Buttons',
          widget: 'field-array',
          itemLabel: 'Button',
        },
      }),
  })
  .passthrough();

export const carouselNodeConfigSchema = z
  .object({
    mode: z
      .enum(['static', 'dynamic'])
      .default('dynamic')
      .meta({ ui: { label: 'Mode', widget: 'select' } }),
    items: z
      .array(itemDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Items',
          widget: 'field-array',
          itemLabel: 'Item',
          visibleWhen: { field: 'mode', equals: 'static' },
        },
      }),
    source: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Source',
          widget: 'expression',
          placeholder: '{{ $input.items }}',
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),
    titleField: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Title Field',
          widget: 'text',
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),
    descriptionField: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Description Field',
          widget: 'text',
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),
    imageField: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Image Field',
          widget: 'text',
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
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),
    itemButtons: z
      .array(buttonDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Item Buttons',
          widget: 'field-array',
          itemLabel: 'Button',
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),
    layout: z
      .enum(['card', 'image', 'minimal'])
      .default('card')
      .meta({ ui: { label: 'Layout', widget: 'select' } }),
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
