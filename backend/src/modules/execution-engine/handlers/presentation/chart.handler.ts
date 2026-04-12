import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';
import { ButtonDef, validateButtons } from '../../types/button.types.js';

export class ChartHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    const validTypes = ['bar', 'line', 'pie'];
    if (
      !config.chartType ||
      typeof config.chartType !== 'string' ||
      !validTypes.includes(config.chartType)
    ) {
      errors.push(
        `chartType is required and must be one of: ${validTypes.join(', ')}`,
      );
    }

    const xAxis = config.xAxis as Record<string, unknown> | undefined;
    if (!xAxis || !xAxis.field || typeof xAxis.field !== 'string') {
      errors.push('xAxis.field is required and must be a string');
    }

    errors.push(...validateButtons(config));

    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: ExecutionContext,
  ): Promise<unknown> {
    const chartType = config.chartType as string;
    const xAxis = config.xAxis as { field: string };
    const yAxis = config.yAxis as
      | { field: string; aggregation?: string }
      | undefined;
    const title = config.title as string | undefined;
    const dataField = config.dataField as string | undefined;

    let inputArray: unknown[];
    if (dataField && typeof input === 'object' && input !== null) {
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

    const payload = {
      type: 'chart',
      chartType,
      title,
      data: chartData,
    };
    const configEcho: Record<string, unknown> = {
      chartType,
      title,
      xAxis,
      yAxis,
    };

    const buttons = config.buttons as ButtonDef[] | undefined;
    if (Array.isArray(buttons) && buttons.length > 0) {
      return Promise.resolve({
        config: {
          ...configEcho,
          buttonConfig: {
            buttons,
            buttonTimeout: config.buttonTimeout,
            buttonTimeoutAction: config.buttonTimeoutAction ?? 'continue',
          },
        },
        output: payload,
        status: 'waiting_for_input',
        meta: { interactionType: 'buttons' },
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
