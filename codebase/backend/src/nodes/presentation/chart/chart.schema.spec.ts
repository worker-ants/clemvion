import { z } from 'zod';
import { evaluateWarnings } from '@workflow/node-summary';
import {
  chartConfigSchema,
  chartMetadata,
  chartOutputSchema,
  validateChartConfig,
} from './chart.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';
import { ChartHandler } from './chart.handler';
import type { ExecutionContext } from '../../core/node-handler.interface';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

describe('chartMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      chartMetadata.warningRules,
    ).map((w) => w.id);

  describe('chart:no-chart-type', () => {
    it('fires when chartType is missing', () => {
      expect(firedIds({})).toContain('chart:no-chart-type');
    });

    it('does NOT fire when chartType is set', () => {
      expect(
        firedIds({
          chartType: 'bar',
          xAxis: { field: 'a' },
          yAxis: { field: 'b' },
        }),
      ).not.toContain('chart:no-chart-type');
    });
  });

  describe('chart:no-x-axis-field', () => {
    it('fires when xAxis.field is missing or empty', () => {
      expect(firedIds({ chartType: 'bar', xAxis: {} })).toContain(
        'chart:no-x-axis-field',
      );
      expect(firedIds({ chartType: 'bar', xAxis: { field: '' } })).toContain(
        'chart:no-x-axis-field',
      );
    });

    it('fires when xAxis is missing entirely', () => {
      expect(firedIds({ chartType: 'bar' })).toContain('chart:no-x-axis-field');
    });

    it('does NOT fire when xAxis.field is set', () => {
      expect(
        firedIds({
          chartType: 'bar',
          xAxis: { field: 'a' },
          yAxis: { field: 'b' },
        }),
      ).not.toContain('chart:no-x-axis-field');
    });
  });

  describe('chart:no-y-axis-field', () => {
    it('fires when yAxis.field is missing or empty', () => {
      expect(
        firedIds({ chartType: 'bar', xAxis: { field: 'a' }, yAxis: {} }),
      ).toContain('chart:no-y-axis-field');
    });

    it('does NOT fire when yAxis.field is set', () => {
      expect(
        firedIds({
          chartType: 'bar',
          xAxis: { field: 'a' },
          yAxis: { field: 'b' },
        }),
      ).not.toContain('chart:no-y-axis-field');
    });
  });
});

describe('validateChartConfig (imperative)', () => {
  it('returns [] when no buttons configured', () => {
    expect(
      validateChartConfig({
        chartType: 'bar',
        xAxis: { field: 'a' },
        yAxis: { field: 'b' },
      }),
    ).toEqual([]);
  });

  it('forwards global buttons errors via shared validateButtons', () => {
    const errors = validateChartConfig({
      chartType: 'bar',
      xAxis: { field: 'a' },
      yAxis: { field: 'b' },
      buttons: [{ id: '', label: '', type: 'port' }],
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'buttons[0].id is required',
        'buttons[0].label is required and must be a string',
      ]),
    );
  });
});

describe('evaluateMetadataBlockingErrors integration (chart)', () => {
  it('emits warning messages for axis-field omissions', () => {
    const errors = evaluateMetadataBlockingErrors(chartMetadata, {
      chartType: 'bar',
      xAxis: {},
      yAxis: {},
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'X-axis field must be entered.',
        'Y-axis field must be entered.',
      ]),
    );
  });
});

/**
 * buttonDefSchema.userMessage — 검증 스위트
 *
 * SoT: spec/4-nodes/6-presentation/0-common.md §1 (ButtonDef 필드 정의),
 *      §10.8 (AI Agent render_* tool 모드 user-message 합성 우선순위).
 * `userMessage` 필드는 LLM 이 명시하는 chat 발화 텍스트 override.
 * 미설정 시 frontend 가 label 기반 합성. type="link" 에서는 클릭 시 무시.
 */
describe('buttonDefSchema — userMessage (spec/4-nodes/6-presentation/0-common.md §1, §10.8)', () => {
  it('preserves userMessage on global buttons and exposes it in JSON Schema', () => {
    const result = chartConfigSchema.parse({
      chartType: 'bar',
      xAxis: { field: 'x' },
      yAxis: { field: 'y' },
      buttons: [
        {
          id: 'a',
          label: 'Drill',
          type: 'port',
          userMessage: 'Drill into A',
        },
      ],
    });
    expect(result.buttons[0].userMessage).toBe('Drill into A');

    const jsonSchema = z.toJSONSchema(chartConfigSchema) as unknown as {
      properties?: {
        buttons?: {
          items?: { properties?: Record<string, { type?: string }> };
        };
      };
    };
    expect(
      jsonSchema.properties?.buttons?.items?.properties?.userMessage,
    ).toBeDefined();
  });
});

// CLE-NODE-CHART 「출력 스키마(자동완성)」 — 노드 출력 다섯 필드 형태.
describe('chartOutputSchema', () => {
  type JsonNode = {
    properties?: Record<string, JsonNode>;
    items?: JsonNode;
  };
  const json = z.toJSONSchema(chartOutputSchema) as unknown as JsonNode;

  it('declares the node output envelope fields only', () => {
    expect(Object.keys(json.properties ?? {}).sort()).toEqual([
      'config',
      'meta',
      'output',
      'port',
      'status',
    ]);
  });

  it('does not declare the legacy discriminator or literal config in output', () => {
    const output = json.properties?.output?.properties ?? {};
    expect(output.type).toBeUndefined();
    expect(output.chartType).toBeUndefined();
    expect(output.title).toBeUndefined();
    expect(json.properties?.type).toBeUndefined();
    expect(json.properties?.chartType).toBeUndefined();
  });

  it('declares output.data as { x, y?, series? }[] and output.interaction', () => {
    const output = json.properties?.output?.properties ?? {};
    expect(Object.keys(output.data?.items?.properties ?? {}).sort()).toEqual([
      'series',
      'x',
      'y',
    ]);
    expect(Object.keys(output.interaction?.properties ?? {}).sort()).toEqual([
      'data',
      'receivedAt',
      'type',
    ]);
  });

  it('declares every config echo field', () => {
    expect(
      Object.keys(json.properties?.config?.properties ?? {}).sort(),
    ).toEqual([
      'buttonConfig',
      'buttons',
      'chartType',
      'colors',
      'dataField',
      'groupBy',
      'title',
      'xAxis',
      'yAxis',
    ]);
  });

  describe('against real ChartHandler outputs', () => {
    const handler = new ChartHandler();
    const context: ExecutionContext = {
      executionId: 'schema-exec',
      workflowId: 'schema-wf',
      variables: {},
      nodeOutputCache: {},
      structuredOutputCache: {},
      engineResolvedConfigCache: {},
      conversationThread: createEmptyConversationThread(),
      recursionDepth: 0,
    };
    const sales = [
      { month: 'Jan', region: 'Seoul', revenue: 700 },
      { month: 'Jan', region: 'Busan', revenue: 800 },
      { month: 'Feb', region: 'Seoul', revenue: 1500 },
    ];
    const base = {
      chartType: 'bar',
      xAxis: { field: 'month' },
      yAxis: { field: 'revenue', aggregation: 'sum' },
    };
    const run = async (config: Record<string, unknown>) =>
      (await handler.execute(sales, config, context)) as unknown;

    it('accepts a display-only output', async () => {
      const result = await run(base);
      expect(chartOutputSchema.safeParse(result).success).toBe(true);
    });

    it('accepts a multi-series output and keeps series as a string', async () => {
      const result = (await run({
        ...base,
        chartType: 'line',
        groupBy: 'region',
        colors: ['#111111', '#222222'],
      })) as { output: { data: Array<{ series?: string }> } };
      expect(result.output.data.map((p) => p.series)).toEqual([
        'Seoul',
        'Busan',
        'Seoul',
      ]);
      expect(chartOutputSchema.safeParse(result).success).toBe(true);
    });

    it('accepts a waiting_for_input output with buttons and buttonConfig', async () => {
      const result = (await run({
        ...base,
        buttons: [{ id: 'ok', label: 'OK', type: 'port' }],
      })) as { status: string; config: Record<string, unknown> };
      expect(result.status).toBe('waiting_for_input');
      expect(result.config).toHaveProperty('buttonConfig');
      expect(chartOutputSchema.safeParse(result).success).toBe(true);
    });

    it('accepts the resumed output the engine builds from a waiting one', async () => {
      const waiting = (await run({
        ...base,
        buttons: [{ id: 'ok', label: 'OK', type: 'port' }],
      })) as { output: Record<string, unknown> };
      const resumed = {
        ...waiting,
        output: {
          ...waiting.output,
          interaction: {
            type: 'button_click',
            data: { buttonId: 'ok', buttonLabel: 'OK' },
            receivedAt: '2026-04-19T12:34:56.000Z',
          },
        },
        port: 'ok',
        status: 'resumed',
      };
      expect(chartOutputSchema.safeParse(resumed).success).toBe(true);
    });

    it.each([
      ['a non-string series', { output: { data: [{ x: 'a', series: 3 }] } }],
      ['a chartType outside the enum', { config: { chartType: 'scatter' } }],
      ['a non-array data', { output: { data: { x: 'a' } } }],
      ['non-string colors', { config: { colors: [1, 2] } }],
    ])('rejects %s', (_label, bad) => {
      expect(chartOutputSchema.safeParse(bad).success).toBe(false);
    });
  });
});
