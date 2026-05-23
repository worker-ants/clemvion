import { z } from 'zod';
import { evaluateWarnings } from '@workflow/node-summary';
import {
  chartConfigSchema,
  chartMetadata,
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
