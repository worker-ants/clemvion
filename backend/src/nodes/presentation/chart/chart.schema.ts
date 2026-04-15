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

const xAxisSchema = z
  .object({
    field: z
      .string()
      .default('')
      .meta({ ui: { label: 'Field', widget: 'text' } }),
    label: z
      .string()
      .optional()
      .meta({ ui: { label: 'Label', widget: 'text' } }),
  })
  .passthrough();

const yAxisSchema = z
  .object({
    field: z
      .string()
      .default('')
      .meta({ ui: { label: 'Field', widget: 'text' } }),
    label: z
      .string()
      .optional()
      .meta({ ui: { label: 'Label', widget: 'text' } }),
    aggregation: z
      .enum(['sum', 'count', 'avg', 'min', 'max'])
      .optional()
      .meta({ ui: { label: 'Aggregation', widget: 'select' } }),
  })
  .passthrough();

export const chartConfigSchema = z
  .object({
    chartType: z
      .enum(['bar', 'line', 'pie', 'donut', 'area'])
      .default('bar')
      .meta({ ui: { label: 'Chart Type', widget: 'select' } }),
    dataField: z
      .string()
      .default('')
      .meta({ ui: { label: 'Data Field', widget: 'text' } }),
    xAxis: xAxisSchema
      .default({ field: '' })
      .meta({ ui: { label: 'X Axis' } }),
    yAxis: yAxisSchema
      .default({ field: '' })
      .meta({ ui: { label: 'Y Axis' } }),
    groupBy: z
      .string()
      .optional()
      .meta({ ui: { label: 'Group By', widget: 'text' } }),
    title: z
      .string()
      .optional()
      .meta({ ui: { label: 'Title', widget: 'text' } }),
    colors: z
      .array(z.string())
      .optional()
      .meta({
        ui: {
          label: 'Colors',
          widget: 'field-array',
          itemLabel: 'Color',
        },
      }),
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

export type ChartConfig = z.infer<typeof chartConfigSchema>;

export const chartInputSchema = z.unknown();

export const chartOutputSchema = z.object({
  type: z.literal('chart'),
  chartType: z.enum(['bar', 'line', 'pie', 'donut', 'area']),
  title: z.string().optional(),
  data: z.array(z.record(z.string(), z.unknown())),
});

export const chartPorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

export const chartMetadata: NodeComponentMetadata = {
  type: 'chart',
  category: 'presentation',
  label: 'Chart',
  description: 'Visualize as chart',
  icon: 'BarChart3',
  color: '#EC4899',
  isContainer: false,
};
