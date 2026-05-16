import { evaluateWarnings } from '@workflow/node-summary';
import { foreachNodeMetadata } from './foreach.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('foreachNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      foreachNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('foreach:no-array-field', () => {
    it('fires when arrayField is missing', () => {
      expect(firedIds({})).toContain('foreach:no-array-field');
    });

    it('fires when arrayField is empty string', () => {
      expect(firedIds({ arrayField: '' })).toContain('foreach:no-array-field');
    });

    it('does NOT fire when arrayField is set', () => {
      expect(firedIds({ arrayField: '$input.items' })).not.toContain(
        'foreach:no-array-field',
      );
    });
  });
});

describe('evaluateMetadataBlockingErrors integration (foreach)', () => {
  it('emits the Korean warning when arrayField is missing', () => {
    expect(evaluateMetadataBlockingErrors(foreachNodeMetadata, {})).toEqual([
      'Array field must be entered.',
    ]);
  });

  it('returns [] when configured', () => {
    expect(
      evaluateMetadataBlockingErrors(foreachNodeMetadata, {
        arrayField: '$input.items',
      }),
    ).toEqual([]);
  });
});
