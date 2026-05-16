import { evaluateWarnings } from '@workflow/node-summary';
import { splitNodeMetadata } from './split.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('splitNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      splitNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('split:no-field-path', () => {
    it('fires when fieldPath is missing', () => {
      expect(firedIds({})).toContain('split:no-field-path');
    });

    it('fires when fieldPath is empty string', () => {
      expect(firedIds({ fieldPath: '' })).toContain('split:no-field-path');
    });

    it('does NOT fire when fieldPath is set', () => {
      expect(firedIds({ fieldPath: '$input.items' })).not.toContain(
        'split:no-field-path',
      );
    });
  });
});

describe('evaluateMetadataBlockingErrors integration (split)', () => {
  it('emits the Korean warning when fieldPath is missing', () => {
    expect(evaluateMetadataBlockingErrors(splitNodeMetadata, {})).toEqual([
      'Field path must be entered.',
    ]);
  });

  it('returns [] when fieldPath is set', () => {
    expect(
      evaluateMetadataBlockingErrors(splitNodeMetadata, {
        fieldPath: '$input.items',
      }),
    ).toEqual([]);
  });
});
