import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { ButtonDef } from '../_shared/button.types.js';
import { CHART_TYPES, chartMetadata } from './chart.schema.js';

/** `groupBy` 로 시리즈를 나누는 차트 유형. pie · donut 은 원 하나에 시리즈 하나라 쓰지 않는다. */
const SERIES_CHART_TYPES: ReadonlySet<string> = new Set([
  'bar',
  'line',
  'area',
]);

type ChartPoint = { x: unknown; y?: unknown; series?: string };

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

/**
 * 데이터 배열을 고른다(CLE-NODE-CHART 실행 로직 1단계).
 * `dataField`(입력이 객체일 때) → 저장된 호환 키 `dataSource` → 입력 자체 순서다.
 * `dataSource` 의 `undefined` · `null` · 빈 문자열은 값이 없는 것으로 본다.
 */
function selectChartRows(
  input: unknown,
  config: Record<string, unknown>,
): unknown[] {
  const dataField = config.dataField;
  if (typeof dataField === 'string' && dataField !== '') {
    if (typeof input === 'object' && input !== null) {
      const rows = (input as Record<string, unknown>)[dataField];
      return Array.isArray(rows) ? rows : [];
    }
  } else if (isPresent(config.dataSource)) {
    const dataSource = config.dataSource;
    return Array.isArray(dataSource) ? dataSource : [dataSource];
  }
  return Array.isArray(input) ? input : [input];
}

function fieldOf(item: unknown, field: string): unknown {
  return typeof item === 'object' && item !== null
    ? (item as Record<string, unknown>)[field]
    : undefined;
}

export class ChartHandler implements NodeHandler {
  metadata = chartMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers chartType /
    // xAxis.field / yAxis.field / global buttons. Handler retains the
    // chartType enum-membership guard because the warningRule only catches
    // missing values; an invalid string like 'scatter' must still be
    // rejected explicitly.
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];

    const validTypes: readonly string[] = CHART_TYPES;
    if (
      config.chartType !== undefined &&
      (typeof config.chartType !== 'string' ||
        !validTypes.includes(config.chartType))
    ) {
      errors.push(
        `chartType is required and must be one of: ${validTypes.join(', ')}`,
      );
    }

    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const xAxis = config.xAxis as { field: string };
    const yAxis = config.yAxis as
      { field: string; aggregation?: string } | undefined;
    const groupBy =
      typeof config.groupBy === 'string' &&
      config.groupBy !== '' &&
      SERIES_CHART_TYPES.has(config.chartType as string)
        ? config.groupBy
        : undefined;

    const data = selectChartRows(input, config).map((item) => {
      const point: ChartPoint = { x: fieldOf(item, xAxis.field) };
      if (yAxis) {
        point.y = fieldOf(item, yAxis.field);
      }
      if (groupBy !== undefined) {
        // 스펙이 `String(item[groupBy] ?? '')` 로 정했다. 객체 값은 '[object Object]' 가 된다.
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        point.series = String(fieldOf(item, groupBy) ?? '');
      }
      return point;
    });

    const chartData = yAxis?.aggregation
      ? this.aggregate(data, yAxis.aggregation)
      : data;

    // D1 (2026-05-17) — explicit enumeration baseline. Echo every non-sensitive
    // schema field unconditionally; `dataField` / `groupBy` / `colors` were
    // previously missing.
    const rawConfig = context.rawConfig ?? config;
    const payload: Record<string, unknown> = { data: chartData };
    const configEcho: Record<string, unknown> = {
      chartType: rawConfig.chartType,
      title: rawConfig.title,
      dataField: rawConfig.dataField,
      xAxis: rawConfig.xAxis ?? xAxis,
      yAxis: rawConfig.yAxis ?? yAxis,
      groupBy: rawConfig.groupBy,
      colors: rawConfig.colors,
    };

    const buttons = config.buttons as ButtonDef[] | undefined;
    const rawButtons =
      (rawConfig.buttons as ButtonDef[] | undefined) ?? buttons;
    if (Array.isArray(buttons) && buttons.length > 0) {
      return Promise.resolve({
        config: {
          ...configEcho,
          buttons: rawButtons,
          buttonConfig: {
            buttons,
          },
        },
        output: payload,
        status: 'waiting_for_input',
        meta: { interactionType: 'buttons', durationMs: 0 },
      });
    }

    return Promise.resolve({ config: configEcho, output: payload });
  }

  /** (series, X) 묶음마다 Y 를 집계한다. 결과 순서는 묶음이 처음 나온 순서다. */
  private aggregate(data: ChartPoint[], aggregation: string): ChartPoint[] {
    const groups: { x: unknown; series?: string; values: number[] }[] = [];
    const bySeries = new Map<string | undefined, Map<unknown, number[]>>();

    for (const point of data) {
      let byX = bySeries.get(point.series);
      if (!byX) {
        byX = new Map();
        bySeries.set(point.series, byX);
      }
      let values = byX.get(point.x);
      if (!values) {
        values = [];
        byX.set(point.x, values);
        groups.push({ x: point.x, series: point.series, values });
      }
      const val = Number(point.y);
      values.push(isNaN(val) ? 0 : val);
    }

    return groups.map(({ x, series, values }) => {
      let y: number;
      switch (aggregation) {
        case 'sum':
          y = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          y = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'count':
          y = values.length;
          break;
        case 'min':
          y = Math.min(...values);
          break;
        case 'max':
          y = Math.max(...values);
          break;
        default:
          y = values.reduce((a, b) => a + b, 0);
      }
      return series === undefined ? { x, y } : { x, y, series };
    });
  }
}
