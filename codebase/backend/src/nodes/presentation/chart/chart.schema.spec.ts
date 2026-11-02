import { z } from 'zod';
import { evaluateWarnings } from '@workflow/node-summary';
import {
  chartConfigSchema,
  chartMetadata,
  chartOutputSchema,
  validateChartConfig,
} from './chart.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

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
    expect(
      Object.keys(output.interaction?.properties ?? {}).sort(),
    ).toEqual(['data', 'receivedAt', 'type']);
  });

  it('declares every config echo field', () => {
    expect(Object.keys(json.properties?.config?.properties ?? {}).sort()).toEqual(
      [
        'buttonConfig',
        'buttons',
        'chartType',
        'colors',
        'dataField',
        'groupBy',
        'title',
        'xAxis',
        'yAxis',
      ],
    );
  });

  it('accepts display, multi-series and resumed handler outputs', () => {
    const shapes = [
      {
        config: { chartType: 'bar', xAxis: { field: 'm' } },
        output: { data: [{ x: 'Jan', y: 1 }] },
      },
      {
        config: { chartType: 'line', groupBy: 'region' },
        output: { data: [{ x: 'Jan', y: 1, series: 'Seoul' }] },
      },
      {
        config: { chartType: 'bar', buttons: [{ id: 'ok', label: 'OK' }] },
        output: {
          data: [{ x: 'Jan', y: 1 }],
          interaction: {
            type: 'button_click',
            data: { buttonId: 'ok', buttonLabel: 'OK' },
            receivedAt: '2026-04-19T12:34:56.000Z',
          },
        },
        meta: { interactionType: 'buttons', durationMs: 5 },
        port: 'ok',
        status: 'resumed',
      },
    ];
    for (const shape of shapes) {
      expect(chartOutputSchema.safeParse(shape).success).toBe(true);
    }
  });
});
