import { ChartHandler } from './chart.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';

describe('ChartHandler', () => {
  let handler: ChartHandler;
  let context: ExecutionContext;

  beforeEach(() => {
    handler = new ChartHandler();
    context = {
      executionId: 'test-exec-1',
      workflowId: 'test-wf-1',
      variables: {},
      nodeOutputCache: {},
    };
  });

  describe('validate', () => {
    it('should return valid for minimal correct config (bar)', () => {
      const result = handler.validate({
        chartType: 'bar',
        xAxis: { field: 'category' },
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept line and pie chart types', () => {
      expect(
        handler.validate({ chartType: 'line', xAxis: { field: 'x' } }).valid,
      ).toBe(true);
      expect(
        handler.validate({ chartType: 'pie', xAxis: { field: 'x' } }).valid,
      ).toBe(true);
    });

    it('should reject missing chartType', () => {
      const result = handler.validate({ xAxis: { field: 'x' } });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'chartType is required and must be one of: bar, line, pie',
      );
    });

    it('should reject invalid chartType', () => {
      const result = handler.validate({
        chartType: 'scatter',
        xAxis: { field: 'x' },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'chartType is required and must be one of: bar, line, pie',
      );
    });

    it('should reject non-string chartType', () => {
      const result = handler.validate({
        chartType: 123 as unknown,
        xAxis: { field: 'x' },
      });
      expect(result.valid).toBe(false);
    });

    it('should reject missing xAxis', () => {
      const result = handler.validate({ chartType: 'bar' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'xAxis.field is required and must be a string',
      );
    });

    it('should reject xAxis without field', () => {
      const result = handler.validate({ chartType: 'bar', xAxis: {} });
      expect(result.valid).toBe(false);
    });

    it('should reject xAxis.field as non-string', () => {
      const result = handler.validate({
        chartType: 'bar',
        xAxis: { field: 42 },
      });
      expect(result.valid).toBe(false);
    });

    it('should collect multiple errors', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should propagate button validation errors', () => {
      const result = handler.validate({
        chartType: 'bar',
        xAxis: { field: 'x' },
        buttons: [{ label: 'No id', type: 'link', url: 'https://a.com' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('id'))).toBe(true);
    });

    it('should accept valid buttons config', () => {
      const result = handler.validate({
        chartType: 'bar',
        xAxis: { field: 'x' },
        buttons: [{ id: 'b1', label: 'Next', type: 'port' }],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('execute', () => {
    const config = {
      chartType: 'bar',
      xAxis: { field: 'category' },
      yAxis: { field: 'value' },
    };

    describe('input resolution', () => {
      it('should use array input directly', async () => {
        const input = [
          { category: 'A', value: 10 },
          { category: 'B', value: 20 },
        ];
        const result = (await handler.execute(input, config, context)) as {
          output: { data: unknown[] };
        };
        expect(result.output.data).toMatchObject([
          { x: 'A', y: 10 },
          { x: 'B', y: 20 },
        ]);
      });

      it('should wrap non-array input in array', async () => {
        const input = { category: 'A', value: 5 };
        const result = (await handler.execute(input, config, context)) as {
          output: { data: unknown[] };
        };
        expect(result.output.data).toMatchObject([{ x: 'A', y: 5 }]);
      });

      it('should use dataSource when provided (array)', async () => {
        const result = (await handler.execute(
          null,
          {
            ...config,
            dataSource: [
              { category: 'X', value: 1 },
              { category: 'Y', value: 2 },
            ],
          },
          context,
        )) as { output: { data: unknown[] } };
        expect(result.output.data).toMatchObject([
          { x: 'X', y: 1 },
          { x: 'Y', y: 2 },
        ]);
      });

      it('should wrap non-array dataSource in array', async () => {
        const result = (await handler.execute(
          null,
          {
            ...config,
            dataSource: { category: 'Z', value: 9 },
          },
          context,
        )) as { output: { data: unknown[] } };
        expect(result.output.data).toMatchObject([{ x: 'Z', y: 9 }]);
      });

      it('should read nested dataField from input', async () => {
        const input = {
          stats: [
            { category: 'A', value: 1 },
            { category: 'B', value: 2 },
          ],
        };
        const result = (await handler.execute(
          input,
          { ...config, dataField: 'stats' },
          context,
        )) as { output: { data: unknown[] } };
        expect(result.output.data).toMatchObject([
          { x: 'A', y: 1 },
          { x: 'B', y: 2 },
        ]);
      });

      it('should fall back to empty array when dataField points to non-array', async () => {
        const input = { stats: 'not-array' };
        const result = (await handler.execute(
          input,
          { ...config, dataField: 'stats' },
          context,
        )) as { output: { data: unknown[] } };
        expect(result.output.data).toMatchObject([]);
      });

      it('should ignore dataSource === null and use input', async () => {
        const input = [{ category: 'A', value: 1 }];
        const result = (await handler.execute(
          input,
          { ...config, dataSource: null },
          context,
        )) as { output: { data: unknown[] } };
        expect(result.output.data).toMatchObject([{ x: 'A', y: 1 }]);
      });
    });

    describe('axis mapping', () => {
      it('should include y field only when yAxis is set', async () => {
        const input = [{ category: 'A', value: 10 }];
        const result = (await handler.execute(
          input,
          { chartType: 'pie', xAxis: { field: 'category' } },
          context,
        )) as { output: { data: Record<string, unknown>[] } };
        expect(result.output.data[0]).toEqual({ x: 'A' });
        expect(result.output.data[0].y).toBeUndefined();
      });
    });

    describe('aggregation', () => {
      const input = [
        { category: 'A', value: 2 },
        { category: 'A', value: 4 },
        { category: 'B', value: 10 },
      ];

      it('should aggregate via sum', async () => {
        const result = (await handler.execute(
          input,
          {
            ...config,
            yAxis: { field: 'value', aggregation: 'sum' },
          },
          context,
        )) as { output: { data: { x: unknown; y: number }[] } };
        expect(result.output.data).toMatchObject([
          { x: 'A', y: 6 },
          { x: 'B', y: 10 },
        ]);
      });

      it('should aggregate via avg', async () => {
        const result = (await handler.execute(
          input,
          {
            ...config,
            yAxis: { field: 'value', aggregation: 'avg' },
          },
          context,
        )) as { output: { data: { x: unknown; y: number }[] } };
        expect(result.output.data).toMatchObject([
          { x: 'A', y: 3 },
          { x: 'B', y: 10 },
        ]);
      });

      it('should aggregate via count', async () => {
        const result = (await handler.execute(
          input,
          {
            ...config,
            yAxis: { field: 'value', aggregation: 'count' },
          },
          context,
        )) as { output: { data: { x: unknown; y: number }[] } };
        expect(result.output.data).toMatchObject([
          { x: 'A', y: 2 },
          { x: 'B', y: 1 },
        ]);
      });

      it('should aggregate via min', async () => {
        const result = (await handler.execute(
          input,
          {
            ...config,
            yAxis: { field: 'value', aggregation: 'min' },
          },
          context,
        )) as { output: { data: { x: unknown; y: number }[] } };
        expect(result.output.data).toMatchObject([
          { x: 'A', y: 2 },
          { x: 'B', y: 10 },
        ]);
      });

      it('should aggregate via max', async () => {
        const result = (await handler.execute(
          input,
          {
            ...config,
            yAxis: { field: 'value', aggregation: 'max' },
          },
          context,
        )) as { output: { data: { x: unknown; y: number }[] } };
        expect(result.output.data).toMatchObject([
          { x: 'A', y: 4 },
          { x: 'B', y: 10 },
        ]);
      });

      it('should fall back to sum for unknown aggregation', async () => {
        const result = (await handler.execute(
          input,
          {
            ...config,
            yAxis: { field: 'value', aggregation: 'unknown' },
          },
          context,
        )) as { output: { data: { x: unknown; y: number }[] } };
        expect(result.output.data).toMatchObject([
          { x: 'A', y: 6 },
          { x: 'B', y: 10 },
        ]);
      });

      it('should coerce non-numeric y to 0', async () => {
        const result = (await handler.execute(
          [
            { category: 'A', value: 'bad' },
            { category: 'A', value: 5 },
          ],
          {
            ...config,
            yAxis: { field: 'value', aggregation: 'sum' },
          },
          context,
        )) as { output: { data: { x: unknown; y: number }[] } };
        expect(result.output.data[0]).toEqual({ x: 'A', y: 5 });
      });
    });

    describe('button interaction', () => {
      it('should return waiting_for_input when buttons are set', async () => {
        const input = [{ category: 'A', value: 1 }];
        const result = (await handler.execute(
          input,
          {
            ...config,
            buttons: [{ id: 'b1', label: 'Next', type: 'port' }],
          },
          context,
        )) as {
          status: string;
          meta: Record<string, unknown>;
          config: Record<string, unknown>;
        };
        expect(result.status).toBe('waiting_for_input');
        expect(result.meta).toMatchObject({ interactionType: 'buttons' });
        expect(result.config).toHaveProperty('buttonConfig');
      });

      it('should NOT wait when buttons is empty array', async () => {
        const result = (await handler.execute(
          [{ category: 'A', value: 1 }],
          { ...config, buttons: [] },
          context,
        )) as { status?: string };
        expect(result.status).toBeUndefined();
      });

      it('should NOT wait when buttons is not an array', async () => {
        const result = (await handler.execute(
          [{ category: 'A', value: 1 }],
          { ...config, buttons: 'nope' },
          context,
        )) as { status?: string };
        expect(result.status).toBeUndefined();
      });
    });

    describe('output shape', () => {
      it('should include chart type, title, and data in output payload', async () => {
        const result = (await handler.execute(
          [{ category: 'A', value: 1 }],
          { ...config, title: 'My Chart' },
          context,
        )) as { output: Record<string, unknown> };
        expect(result.output).toMatchObject({
          type: 'chart',
          chartType: 'bar',
          title: 'My Chart',
        });
      });

      it('should echo axes in config', async () => {
        const result = (await handler.execute(
          [{ category: 'A', value: 1 }],
          config,
          context,
        )) as { config: Record<string, unknown> };
        expect(result.config).toMatchObject({
          chartType: 'bar',
          xAxis: { field: 'category' },
          yAxis: { field: 'value' },
        });
      });
    });

    describe('edge cases', () => {
      it('should handle empty array input', async () => {
        const result = (await handler.execute([], config, context)) as {
          output: { data: unknown[] };
        };
        expect(result.output.data).toMatchObject([]);
      });
    });
  });
});
