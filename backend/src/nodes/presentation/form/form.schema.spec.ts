import { evaluateWarnings } from '@workflow/node-summary';
import { formNodeMetadata } from './form.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('formNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      formNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('form:no-fields', () => {
    it('fires when fields is empty', () => {
      expect(firedIds({ fields: [] })).toContain('form:no-fields');
    });

    it('fires when fields is missing entirely', () => {
      expect(firedIds({})).toContain('form:no-fields');
    });

    it('does NOT fire when at least one field is defined', () => {
      expect(
        firedIds({ fields: [{ name: 'email', type: 'email' }] }),
      ).not.toContain('form:no-fields');
    });
  });
});

describe('evaluateMetadataBlockingErrors integration (form)', () => {
  it('returns the Korean warning message for an empty form', () => {
    expect(evaluateMetadataBlockingErrors(formNodeMetadata, {})).toEqual([
      '최소 1개 이상의 필드를 정의해야 합니다.',
    ]);
  });

  it('returns [] when configured', () => {
    expect(
      evaluateMetadataBlockingErrors(formNodeMetadata, {
        fields: [{ name: 'email', type: 'email' }],
      }),
    ).toEqual([]);
  });
});
