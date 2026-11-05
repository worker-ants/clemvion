import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ChartHandler } from './chart.handler.js';
import { chartConfigSchema } from './chart.schema.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

/**
 * 시리즈 묶음 규칙의 공유 사례. 에디터 · 웹채팅 위젯 렌더러 테스트도 같은 파일을 읽는다
 * (codebase/shared-fixtures/chart/series.json, NERV Task CLE-T-NRN1RR).
 */
interface SharedSeriesCase {
  name: string;
  points: Array<{ x: unknown; y?: unknown; series?: unknown }>;
  render: { series: string[] };
  sum: unknown[];
}
// 이 파일(codebase/backend/src/nodes/presentation/chart/)에서 다섯 단계 위가 codebase/ 다.
const SHARED_SERIES_FIXTURE = resolve(
  __dirname,
  '../../../../../shared-fixtures/chart/series.json',
);
const sharedSeriesCases = (
  JSON.parse(readFileSync(SHARED_SERIES_FIXTURE, 'utf8')) as {
    cases: SharedSeriesCase[];
  }
).cases;

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
      structuredOutputCache: {},
      engineResolvedConfigCache: {},
      conversationThread: createEmptyConversationThread(),
      recursionDepth: 0,
    };
  });

  describe('validate', () => {
    it('should return valid for minimal correct config (bar)', () => {
      const result = handler.validate({
        chartType: 'bar',
        xAxis: { field: 'category' },
        yAxis: { field: 'value' },
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    // 설정 스키마 enum · 프런트엔드 렌더러 · REQ-CHART-001 이 받는 다섯 유형을 실행 검증도 받는다.
    // 예전 핸들러는 `bar`·`line`·`pie` 만 받아 `area`·`donut` 노드가 실행 전에 막혔다.
    it.each(['bar', 'line', 'area', 'pie', 'donut'])(
      'should accept chartType %s',
      (chartType) => {
        const result = handler.validate({
          chartType,
          xAxis: { field: 'x' },
          yAxis: { field: 'y' },
        });
        expect(result.errors).toEqual([]);
        expect(result.valid).toBe(true);
      },
    );

    it('should agree with the config schema enum on which chartType is valid', () => {
      const schemaChartType = chartConfigSchema.shape.chartType;
      for (const chartType of [
        'bar',
        'line',
        'area',
        'pie',
        'donut',
        'scatter',
      ]) {
        const handlerValid = handler.validate({
          chartType,
          xAxis: { field: 'x' },
          yAxis: { field: 'y' },
        }).valid;
        expect([chartType, handlerValid]).toEqual([
          chartType,
          schemaChartType.safeParse(chartType).success,
        ]);
      }
    });

    it('should reject missing chartType', () => {
      const result = handler.validate({ xAxis: { field: 'x' } });
      expect(result.valid).toBe(false);
      // Schema warningRule fires when chartType is missing.
      expect(result.errors.some((e) => e.includes('Chart type'))).toBe(true);
    });

    it('should reject invalid chartType', () => {
      const result = handler.validate({
        chartType: 'scatter',
        xAxis: { field: 'x' },
      });
      expect(result.valid).toBe(false);
      // Handler-only enum guard fires for an invalid (non-listed) chartType.
      expect(result.errors).toContain(
        'chartType is required and must be one of: bar, line, pie, donut, area',
      );
    });

    it('should reject non-string chartType', () => {
      const result = handler.validate({
        chartType: 123,
        xAxis: { field: 'x' },
      });
      expect(result.valid).toBe(false);
    });

    it('should reject missing xAxis', () => {
      const result = handler.validate({ chartType: 'bar' });
      expect(result.valid).toBe(false);
      // Schema warningRule "X-axis field must be entered." fires.
      expect(result.errors.some((e) => e.includes('X-axis'))).toBe(true);
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
        yAxis: { field: 'y' },
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
        const result = (await handler.execute(
          input,
          config,
          context,
        )) as unknown as {
          output: { data: unknown[] };
        };
        expect(result.output.data).toMatchObject([
          { x: 'A', y: 10 },
          { x: 'B', y: 20 },
        ]);
      });

      it('should wrap non-array input in array', async () => {
        const input = { category: 'A', value: 5 };
        const result = (await handler.execute(
          input,
          config,
          context,
        )) as unknown as {
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
        )) as unknown as { output: { data: unknown[] } };
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
        )) as unknown as { output: { data: unknown[] } };
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
        )) as unknown as { output: { data: unknown[] } };
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
        )) as unknown as { output: { data: unknown[] } };
        expect(result.output.data).toMatchObject([]);
      });

      it('should ignore dataSource === null and use input', async () => {
        const input = [{ category: 'A', value: 1 }];
        const result = (await handler.execute(
          input,
          { ...config, dataSource: null },
          context,
        )) as unknown as { output: { data: unknown[] } };
        expect(result.output.data).toMatchObject([{ x: 'A', y: 1 }]);
      });
    });

    // CLE-NODE-CHART 실행 로직 1단계 — dataField → 저장된 dataSource → 입력 순서.
    describe('data source priority (REQ-CHART-009 · 010 · 018)', () => {
      const stats = [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
      ];
      const legacy = [{ category: 'L', value: 9 }];

      it('prefers dataField over a stored dataSource when input is an object', async () => {
        const result = (await handler.execute(
          { stats },
          { ...config, dataField: 'stats', dataSource: legacy },
          context,
        )) as unknown as { output: { data: unknown[] } };
        expect(result.output.data).toEqual([
          { x: 'A', y: 1 },
          { x: 'B', y: 2 },
        ]);
      });

      it('does not read dataSource when dataField is set but input is not an object', async () => {
        const result = (await handler.execute(
          'raw',
          { ...config, dataField: 'stats', dataSource: legacy },
          context,
        )) as unknown as { output: { data: unknown[] } };
        // 마지막 규칙: [input]. 문자열 항목에는 축 필드가 없다.
        expect(result.output.data).toEqual([{ x: undefined, y: undefined }]);
      });

      it('falls back to [] when dataField points to a non-array even if dataSource exists', async () => {
        const result = (await handler.execute(
          { stats: 'not-array' },
          { ...config, dataField: 'stats', dataSource: legacy },
          context,
        )) as unknown as { output: { data: unknown[] } };
        expect(result.output.data).toEqual([]);
      });

      it('reads the stored dataSource when dataField is empty', async () => {
        const result = (await handler.execute(
          { stats },
          { ...config, dataField: '', dataSource: legacy },
          context,
        )) as unknown as { output: { data: unknown[] } };
        expect(result.output.data).toEqual([{ x: 'L', y: 9 }]);
      });

      it('treats an empty-string dataSource as absent and uses the input', async () => {
        const result = (await handler.execute(
          stats,
          { ...config, dataField: '', dataSource: '' },
          context,
        )) as unknown as { output: { data: unknown[] } };
        expect(result.output.data).toEqual([
          { x: 'A', y: 1 },
          { x: 'B', y: 2 },
        ]);
      });

      it('treats a null dataSource as absent when dataField is empty', async () => {
        const result = (await handler.execute(
          { category: 'Solo', value: 3 },
          { ...config, dataSource: null },
          context,
        )) as unknown as { output: { data: unknown[] } };
        expect(result.output.data).toEqual([{ x: 'Solo', y: 3 }]);
      });

      it('does not throw on non-object items', async () => {
        const result = (await handler.execute(
          [null, { category: 'A', value: 1 }],
          config,
          context,
        )) as unknown as { output: { data: unknown[] } };
        expect(result.output.data).toEqual([
          { x: undefined, y: undefined },
          { x: 'A', y: 1 },
        ]);
      });

      it('does not throw on null input', async () => {
        const result = (await handler.execute(
          null,
          config,
          context,
        )) as unknown as {
          output: { data: unknown[] };
        };
        expect(result.output.data).toEqual([{ x: undefined, y: undefined }]);
      });
    });

    // 렌더러와 같은 사례를 백엔드 집계로 돌린다. 렌더러는 같은 (series, X) 의 마지막 값을,
    // 핸들러는 묶은 값을 쓰므로 기대값은 사례의 `sum` 이다.
    describe('공유 시리즈 사례 (codebase/shared-fixtures/chart/series.json)', () => {
      it('사례를 읽었다 (vacuous 방지)', () => {
        expect(sharedSeriesCases.length).toBeGreaterThanOrEqual(8);
      });

      it.each(sharedSeriesCases.map((c) => [c.name, c] as const))(
        '%s',
        async (_name, c) => {
          const rows = c.points.map((p) => ({
            month: p.x,
            revenue: p.y,
            ...('series' in p ? { region: p.series } : {}),
          }));
          const result = (await handler.execute(
            rows,
            {
              chartType: 'bar',
              xAxis: { field: 'month' },
              yAxis: { field: 'revenue', aggregation: 'sum' },
              ...(c.render.series.length > 0 ? { groupBy: 'region' } : {}),
            },
            context,
          )) as unknown as { output: { data: unknown[] } };
          expect(result.output.data).toEqual(c.sum);
        },
      );
    });

    // CLE-NODE-CHART 실행 로직 2~4단계 — 긴 형식 다중 시리즈.
    describe('groupBy series (REQ-CHART-003 · 011 · 017)', () => {
      const sales = [
        { month: 'Jan', region: 'Seoul', revenue: 700 },
        { month: 'Jan', region: 'Busan', revenue: 800 },
        { month: 'Jan', region: 'Seoul', revenue: 500 },
        { month: 'Feb', region: 'Seoul', revenue: 1500 },
        { month: 'Feb', region: 'Busan', revenue: 900 },
      ];
      const base = {
        xAxis: { field: 'month' },
        yAxis: { field: 'revenue', aggregation: 'sum' },
        groupBy: 'region',
      };

      it.each(['bar', 'line', 'area'])(
        'aggregates by (series, X) in first-appearance order for %s',
        async (chartType) => {
          const result = (await handler.execute(
            sales,
            { ...base, chartType },
            context,
          )) as unknown as { output: { data: unknown[] } };
          expect(result.output.data).toEqual([
            { x: 'Jan', y: 1200, series: 'Seoul' },
            { x: 'Jan', y: 800, series: 'Busan' },
            { x: 'Feb', y: 1500, series: 'Seoul' },
            { x: 'Feb', y: 900, series: 'Busan' },
          ]);
        },
      );

      it('counts rows per (series, X)', async () => {
        const result = (await handler.execute(
          sales,
          {
            ...base,
            chartType: 'bar',
            yAxis: { field: 'revenue', aggregation: 'count' },
          },
          context,
        )) as unknown as { output: { data: unknown[] } };
        expect(result.output.data).toEqual([
          { x: 'Jan', y: 2, series: 'Seoul' },
          { x: 'Jan', y: 1, series: 'Busan' },
          { x: 'Feb', y: 1, series: 'Seoul' },
          { x: 'Feb', y: 1, series: 'Busan' },
        ]);
      });

      it('attaches series to every raw point when aggregation is absent', async () => {
        const result = (await handler.execute(
          sales.slice(0, 3),
          { ...base, chartType: 'bar', yAxis: { field: 'revenue' } },
          context,
        )) as unknown as { output: { data: unknown[] } };
        expect(result.output.data).toEqual([
          { x: 'Jan', y: 700, series: 'Seoul' },
          { x: 'Jan', y: 800, series: 'Busan' },
          { x: 'Jan', y: 500, series: 'Seoul' },
        ]);
      });

      it('stringifies group values so 1 and "1" share one series', async () => {
        const result = (await handler.execute(
          [
            { month: 'Jan', grade: 1, revenue: 10 },
            { month: 'Jan', grade: '1', revenue: 5 },
          ],
          { ...base, chartType: 'bar', groupBy: 'grade' },
          context,
        )) as unknown as { output: { data: unknown[] } };
        expect(result.output.data).toEqual([{ x: 'Jan', y: 15, series: '1' }]);
      });

      it('groups null / undefined group values into the empty-string series', async () => {
        const result = (await handler.execute(
          [
            { month: 'Jan', region: null, revenue: 1 },
            { month: 'Jan', revenue: 2 },
            { month: 'Jan', region: 'Seoul', revenue: 4 },
          ],
          { ...base, chartType: 'line' },
          context,
        )) as unknown as { output: { data: unknown[] } };
        expect(result.output.data).toEqual([
          { x: 'Jan', y: 3, series: '' },
          { x: 'Jan', y: 4, series: 'Seoul' },
        ]);
      });

      it.each(['pie', 'donut'])(
        'ignores groupBy for %s and aggregates a single series',
        async (chartType) => {
          const result = (await handler.execute(
            sales,
            { ...base, chartType },
            context,
          )) as unknown as {
            output: { data: Record<string, unknown>[] };
            config: Record<string, unknown>;
          };
          expect(result.output.data).toEqual([
            { x: 'Jan', y: 2000 },
            { x: 'Feb', y: 2400 },
          ]);
          // 설정 에코에는 남는다(쓰지 않을 뿐이다).
          expect(result.config.groupBy).toBe('region');
        },
      );

      it('keeps the single-series output when groupBy is empty', async () => {
        const result = (await handler.execute(
          sales,
          { ...base, chartType: 'bar', groupBy: '' },
          context,
        )) as unknown as { output: { data: Record<string, unknown>[] } };
        expect(result.output.data).toEqual([
          { x: 'Jan', y: 2000 },
          { x: 'Feb', y: 2400 },
        ]);
        expect(result.output.data.some((p) => 'series' in p)).toBe(false);
      });

      it('carries series into the waiting_for_input snapshot', async () => {
        const result = (await handler.execute(
          sales.slice(0, 2),
          {
            ...base,
            chartType: 'bar',
            buttons: [{ id: 'ok', label: 'OK', type: 'port' }],
          },
          context,
        )) as unknown as { status: string; output: { data: unknown[] } };
        expect(result.status).toBe('waiting_for_input');
        expect(result.output.data).toEqual([
          { x: 'Jan', y: 700, series: 'Seoul' },
          { x: 'Jan', y: 800, series: 'Busan' },
        ]);
      });
    });

    describe('axis mapping', () => {
      it('should include y field only when yAxis is set', async () => {
        const input = [{ category: 'A', value: 10 }];
        const result = (await handler.execute(
          input,
          { chartType: 'pie', xAxis: { field: 'category' } },
          context,
        )) as unknown as { output: { data: Record<string, unknown>[] } };
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
        )) as unknown as { output: { data: { x: unknown; y: number }[] } };
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
        )) as unknown as { output: { data: { x: unknown; y: number }[] } };
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
        )) as unknown as { output: { data: { x: unknown; y: number }[] } };
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
        )) as unknown as { output: { data: { x: unknown; y: number }[] } };
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
        )) as unknown as { output: { data: { x: unknown; y: number }[] } };
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
        )) as unknown as { output: { data: { x: unknown; y: number }[] } };
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
        )) as unknown as { output: { data: { x: unknown; y: number }[] } };
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
        )) as unknown as {
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
        )) as unknown as { status?: string };
        expect(result.status).toBeUndefined();
      });

      it('should NOT wait when buttons is not an array', async () => {
        const result = (await handler.execute(
          [{ category: 'A', value: 1 }],
          { ...config, buttons: 'nope' },
          context,
        )) as unknown as { status?: string };
        expect(result.status).toBeUndefined();
      });
    });

    describe('output shape', () => {
      it('should include runtime-aggregated data in output and literal config in config', async () => {
        const result = (await handler.execute(
          [{ category: 'A', value: 1 }],
          { ...config, title: 'My Chart' },
          context,
        )) as unknown as {
          output: Record<string, unknown>;
          config: Record<string, unknown>;
        };
        // Discriminator + literal config fields are no longer echoed in output (Principle 1.1).
        expect(result.output.type).toBeUndefined();
        expect(result.output.chartType).toBeUndefined();
        expect(result.output.title).toBeUndefined();
        expect(Array.isArray(result.output.data)).toBe(true);
        // Literal config lives in config.*
        expect(result.config).toMatchObject({
          chartType: 'bar',
          title: 'My Chart',
        });
      });

      it('should echo axes in config', async () => {
        const result = (await handler.execute(
          [{ category: 'A', value: 1 }],
          config,
          context,
        )) as unknown as { config: Record<string, unknown> };
        expect(result.config).toMatchObject({
          chartType: 'bar',
          xAxis: { field: 'category' },
          yAxis: { field: 'value' },
        });
      });
    });

    describe('edge cases', () => {
      it('should handle empty array input', async () => {
        const result = (await handler.execute(
          [],
          config,
          context,
        )) as unknown as {
          output: { data: unknown[] };
        };
        expect(result.output.data).toMatchObject([]);
      });
    });
  });
});
