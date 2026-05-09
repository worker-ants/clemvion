import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { ButtonDef } from '../_shared/button.types.js';
import { chartMetadata } from './chart.schema.js';

export class ChartHandler implements NodeHandler {
  metadata = chartMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers chartType /
    // xAxis.field / yAxis.field / global buttons. Handler retains the
    // chartType enum-membership guard because the warningRule only catches
    // missing values; an invalid string like 'scatter' must still be
    // rejected explicitly.
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];

    const validTypes = ['bar', 'line', 'pie'];
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
      | { field: string; aggregation?: string }
      | undefined;
    const dataField = config.dataField as string | undefined;

    let inputArray: unknown[];
    if (config.dataSource !== undefined && config.dataSource !== null) {
      inputArray = Array.isArray(config.dataSource)
        ? (config.dataSource as unknown[])
        : [config.dataSource];
    } else if (dataField && typeof input === 'object' && input !== null) {
      inputArray = (input as Record<string, unknown>)[dataField] as unknown[];
      if (!Array.isArray(inputArray)) inputArray = [];
    } else {
      inputArray = Array.isArray(input) ? input : [input];
    }

    const data = inputArray.map((item: Record<string, unknown>) => {
      const point: Record<string, unknown> = {
        x: item[xAxis.field],
      };
      if (yAxis) {
        point.y = item[yAxis.field];
      }
      return point;
    });

    const chartData = yAxis?.aggregation
      ? this.aggregate(data, yAxis.aggregation)
      : data;

    // CONVENTIONS Principle 7 — config echoes raw chartType / title / xAxis
    // / yAxis (`title` may include `{{ ... }}` templates the engine resolved
    // before dispatch). evaluated chart data lives in output.
    const rawConfig = context.rawConfig ?? config;
    const payload: Record<string, unknown> = { data: chartData };
    const configEcho: Record<string, unknown> = {
      chartType: rawConfig.chartType,
      title: rawConfig.title,
      xAxis: rawConfig.xAxis ?? xAxis,
      yAxis: rawConfig.yAxis ?? yAxis,
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

  private aggregate(
    data: Record<string, unknown>[],
    aggregation: string,
  ): Record<string, unknown>[] {
    const groups = new Map<unknown, number[]>();

    for (const point of data) {
      const key = point.x;
      const val = Number(point.y);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(isNaN(val) ? 0 : val);
    }

    return Array.from(groups.entries()).map(([x, values]) => {
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
      return { x, y };
    });
  }
}
