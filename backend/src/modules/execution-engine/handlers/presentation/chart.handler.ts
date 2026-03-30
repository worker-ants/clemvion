import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';

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

    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
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

    if (yAxis?.aggregation) {
      return {
        type: 'chart',
        chartType,
        title,
        data: this.aggregate(data, yAxis.aggregation),
        config: { xAxis, yAxis, title },
      };
    }

    return {
      type: 'chart',
      chartType,
      title,
      data,
      config: { xAxis, yAxis, title },
    };
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
