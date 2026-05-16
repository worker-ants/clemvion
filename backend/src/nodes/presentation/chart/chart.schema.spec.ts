import { evaluateWarnings } from '@workflow/node-summary';
import { chartMetadata, validateChartConfig } from './chart.schema';
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
  it('emits Korean warning messages for axis-field omissions', () => {
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
