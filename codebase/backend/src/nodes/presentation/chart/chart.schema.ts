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

/** 차트 유형 허용 목록. 설정 · 출력 스키마 enum 과 `ChartHandler.validate` 가 함께 쓴다. */
export const CHART_TYPES = ['bar', 'line', 'pie', 'donut', 'area'] as const;

export const chartConfigSchema = z
  .object({
    chartType: z
      .enum(CHART_TYPES)
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

/**
 * Chart 노드 `output.data` 와 `render_chart` 도구 `data` 의 포인트 모양 표기
 * (CLE-NODE-CHART 「출력 스키마」 · 「표시 도구 페이로드」). LLM 에 주는 도구 설명과
 * 시스템 안내가 이 문자열 하나를 함께 쓴다.
 */
export const CHART_DATA_SHAPE = '{ x, y?, series? }[]';

/**
 * Chart runtime output — 표현식 자동완성 힌트(CLE-NODE-CHART 「출력 스키마」).
 * Table · Carousel 과 같은 노드 출력 다섯 필드 형태다. `output.data` 는 런타임
 * 집계 결과 `{ x, y?, series? }[]` 이고 `series` 는 `groupBy` 를 쓴 bar · line ·
 * area 에만 있다. 리터럴 설정(`chartType` · `title`)과 옛 판별자 `type: 'chart'`
 * 는 출력 값에 두지 않는다(노드 출력 규약 Principle 1.1). 버튼을 누르면 엔진이
 * `output.interaction.{type, data, receivedAt}` 을 채운다.
 */
export const chartOutputSchema = z
  .object({
    config: z
      .object({
        chartType: z.enum(CHART_TYPES).optional(),
        title: z.string().optional(),
        dataField: z.string().optional(),
        xAxis: xAxisSchema.optional(),
        yAxis: yAxisSchema.optional(),
        groupBy: z.string().optional(),
        colors: z.array(z.string()).optional(),
        buttons: z.array(buttonDefSchema).optional(),
        buttonConfig: z.record(z.string(), z.unknown()).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .object({
        data: z
          .array(
            z
              .object({
                x: z.unknown(),
                y: z.unknown().optional(),
                series: z.string().optional(),
              })
              .passthrough(),
          )
          .optional(),
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
