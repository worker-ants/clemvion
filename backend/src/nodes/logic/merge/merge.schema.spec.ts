import { evaluateWarnings } from '@workflow/node-summary';
import { mergeNodeMetadata } from './merge.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('mergeNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      mergeNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('merge:no-strategy', () => {
    it('fires when strategy is missing', () => {
      expect(firedIds({})).toContain('merge:no-strategy');
    });

    it('fires when strategy is empty string', () => {
      expect(firedIds({ strategy: '' })).toContain('merge:no-strategy');
    });

    it('does NOT fire when strategy is set', () => {
      expect(firedIds({ strategy: 'wait_all' })).not.toContain(
        'merge:no-strategy',
      );
    });
  });

  // W-8: dormant 필드가 설정되면 캔버스 배지로 노출.
  describe('merge:timeout-dormant', () => {
    it('fires when timeout > 0', () => {
      expect(firedIds({ strategy: 'wait_all', timeout: 60 })).toContain(
        'merge:timeout-dormant',
      );
    });

    it('does NOT fire when timeout=0', () => {
      expect(firedIds({ strategy: 'wait_all', timeout: 0 })).not.toContain(
        'merge:timeout-dormant',
      );
    });
  });

  describe('merge:partial-on-timeout-dormant', () => {
    it('fires when partialOnTimeout=true', () => {
      expect(
        firedIds({ strategy: 'wait_all', partialOnTimeout: true }),
      ).toContain('merge:partial-on-timeout-dormant');
    });

    it('does NOT fire when partialOnTimeout=false', () => {
      expect(
        firedIds({ strategy: 'wait_all', partialOnTimeout: false }),
      ).not.toContain('merge:partial-on-timeout-dormant');
    });
  });
});

describe('evaluateMetadataBlockingErrors integration (merge)', () => {
  it('emits the warning when strategy is missing', () => {
    expect(evaluateMetadataBlockingErrors(mergeNodeMetadata, {})).toEqual([
      'Merge strategy must be selected.',
    ]);
  });

  it('returns [] when strategy is set', () => {
    expect(
      evaluateMetadataBlockingErrors(mergeNodeMetadata, {
        strategy: 'wait_all',
      }),
    ).toEqual([]);
  });
});
