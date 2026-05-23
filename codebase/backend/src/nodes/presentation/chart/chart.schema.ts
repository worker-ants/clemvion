import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';
import { validateButtons } from '../_shared/button.types';

// Mirror: ButtonDef in _shared/button.types.ts — keep fields in sync.
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
    userMessage: z
      .string()
      .max(500)
      .optional()
      .meta({
        ui: {
          label: 'User Message',
          widget: 'expression',
          placeholder: '클릭 시 chat 발화 텍스트 (생략 시 자동 합성: label)',
          visibleWhen: { field: 'type', equals: 'port' },
        },
        description:
          'AI Agent render_* tool 모드에서 type="port" 버튼 클릭 시 chat 에 발화될 user message. 미설정 시 frontend 가 자동 합성 (label). type="link" 에서는 무시.',
      }),
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
    xAxis: xAxisSchema.default({ field: '' }).meta({ ui: { label: 'X Axis' } }),
    yAxis: yAxisSchema.default({ field: '' }).meta({ ui: { label: 'Y Axis' } }),
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

/**
 * Imperative escape hatch — global `buttons` validation only (delegated to
 * the shared `validateButtons`). Single-field axis / chart-type "is it set?"
 * checks live in `warningRules` above so they fire the canvas badge.
 */
export function validateChartConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  return validateButtons(c);
}

export const chartMetadata: NodeComponentMetadata = {
  type: 'chart',
  category: 'presentation',
  label: 'Chart',
  description: 'Visualize as chart',
  icon: 'BarChart3',
  color: '#EC4899',
  executionMetadata: { kind: 'standard' },
  isContainer: false,
  isDynamicPorts: true,
  dynamicPorts: {
    kind: 'presentation-buttons',
    continueId: 'continue',
  },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `chartSummary` warnings (chartType missing, axis fields
  //    missing) — note the legacy formatter read top-level `xAxisField` /
  //    `yAxisField`, but the canonical schema paths are `xAxis.field` /
  //    `yAxis.field`. We use the schema paths so the SSOT matches the
  //    actual config shape and the formatter will be aligned in Step 4.
  //  - backend handler.validate's chartType + xAxis.field checks
  warningRules: [
    {
      id: 'chart:no-chart-type',
      when: '!chartType',
      message: 'Chart type must be selected.',
    },
    {
      id: 'chart:no-x-axis-field',
      when: '!xAxis.field',
      message: 'X-axis field must be entered.',
    },
    {
      id: 'chart:no-y-axis-field',
      when: '!yAxis.field',
      message: 'Y-axis field must be entered.',
    },
  ],
  validateConfig: validateChartConfig,
};
