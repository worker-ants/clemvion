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

const columnDefSchema = z
  .object({
    field: z
      .string()
      .default('')
      .meta({ ui: { label: 'Field', widget: 'expression' } }),
    label: z
      .string()
      .default('')
      .meta({ ui: { label: 'Label', widget: 'expression' } }),
    width: z
      .string()
      .optional()
      .meta({ ui: { label: 'Width', widget: 'text' } }),
    sortable: z
      .boolean()
      .optional()
      .meta({ ui: { label: 'Sortable', widget: 'checkbox' } }),
    format: z
      .string()
      .optional()
      .meta({ ui: { label: 'Format', widget: 'text' } }),
  })
  .passthrough();

const rowDefSchema = z.record(z.string(), z.string()).default({});

export const tableNodeConfigSchema = z
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
            { value: 'dynamic', label: 'Dynamic (from data)' },
            { value: 'static', label: 'Static (manual)' },
          ],
        },
      }),
    dataSource: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Data Source',
          widget: 'expression',
          placeholder: '{{ $node["Node"].output }} or {{ $var.list }}',
          hint: 'Array data source (leave empty for previous node input)',
          order: 1,
          visibleWhen: { field: 'mode', equals: 'dynamic' },
        },
      }),
    columns: z
      .array(columnDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Columns',
          widget: 'field-array',
          itemLabel: 'Column',
          order: 2,
          group: 'Columns',
        },
      }),
    rows: z
      .array(rowDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Rows',
          widget: 'field-array',
          itemLabel: 'Row',
          order: 3,
          group: 'Rows',
          visibleWhen: { field: 'mode', equals: 'static' },
        },
      }),
    pagination: z
      .boolean()
      .default(true)
      .meta({
        ui: { label: 'Enable Pagination', widget: 'checkbox', order: 10 },
      }),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(200)
      .default(20)
      .meta({
        ui: {
          label: 'Page Size',
          widget: 'number',
          order: 11,
          visibleWhen: { field: 'pagination', equals: true },
        },
      }),
    sortBy: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Default Sort Column',
          widget: 'expression',
          placeholder: 'Optional field to sort by',
          order: 12,
        },
      }),
    sortOrder: z
      .enum(['asc', 'desc'])
      .default('asc')
      .meta({
        ui: {
          label: 'Sort Order',
          widget: 'select',
          order: 13,
          options: [
            { value: 'asc', label: 'Ascending' },
            { value: 'desc', label: 'Descending' },
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
          order: 20,
          group: 'Buttons',
          collapsible: true,
        },
      }),
  })
  .passthrough();
export type TableConfig = z.infer<typeof tableNodeConfigSchema>;

export const tableNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const tableNodeMetadata: NodeComponentMetadata = {
  type: 'table',
  category: 'presentation',
  label: 'Table',
  description: 'Display as table',
  icon: 'Table',
  color: '#EC4899',
};
