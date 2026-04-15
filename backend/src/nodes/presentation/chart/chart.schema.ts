import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

const buttonDefSchema = z
  .object({
    id: z.string().optional(),
    label: z.string().optional(),
    value: z.unknown().optional(),
  })
  .passthrough();

export const chartConfigSchema = z
  .object({
    chartType: z.enum(['bar', 'line', 'pie']),
    title: z.string().optional(),
    xAxis: z.object({ field: z.string() }),
    yAxis: z
      .object({
        field: z.string(),
        aggregation: z.enum(['sum', 'avg', 'count', 'min', 'max']).optional(),
      })
      .optional(),
    dataField: z.string().optional(),
    dataSource: z.unknown().optional(),
    buttons: z.array(buttonDefSchema).optional(),
  })
  .passthrough();

export type ChartConfig = z.infer<typeof chartConfigSchema>;

export const chartInputSchema = z.unknown();

export const chartOutputSchema = z.object({
  type: z.literal('chart'),
  chartType: z.enum(['bar', 'line', 'pie']),
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
  defaultConfig: { chartType: 'bar', xAxis: { field: '' } },
};
