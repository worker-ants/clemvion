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
});

describe('evaluateMetadataBlockingErrors integration (merge)', () => {
  it('emits the Korean warning when strategy is missing', () => {
    expect(evaluateMetadataBlockingErrors(mergeNodeMetadata, {})).toEqual([
      'Merge strategy 를 선택해야 합니다.',
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
