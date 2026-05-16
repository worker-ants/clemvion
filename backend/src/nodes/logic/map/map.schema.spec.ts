import { evaluateWarnings } from '@workflow/node-summary';
import { mapNodeMetadata } from './map.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('mapNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      mapNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('map:no-input-field', () => {
    it('fires when inputField is missing', () => {
      expect(firedIds({})).toContain('map:no-input-field');
    });

    it('fires when inputField is empty string', () => {
      expect(firedIds({ inputField: '' })).toContain('map:no-input-field');
    });

    it('does NOT fire when inputField is set', () => {
      expect(firedIds({ inputField: '$input.items' })).not.toContain(
        'map:no-input-field',
      );
    });
  });
});

describe('evaluateMetadataBlockingErrors integration (map)', () => {
  it('emits the Korean warning when inputField is missing', () => {
    expect(evaluateMetadataBlockingErrors(mapNodeMetadata, {})).toEqual([
      'Input field must be entered.',
    ]);
  });

  it('returns [] when inputField is set', () => {
    expect(
      evaluateMetadataBlockingErrors(mapNodeMetadata, {
        inputField: '$input.items',
      }),
    ).toEqual([]);
  });
});
