import { evaluateWarnings } from '@workflow/node-summary';
import { ifElseMetadata, validateIfElseConfig } from './if-else.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('ifElseMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      ifElseMetadata.warningRules,
    ).map((w) => w.id);

  describe('if_else:no-conditions', () => {
    it('fires when conditions is missing entirely', () => {
      expect(firedIds({})).toContain('if_else:no-conditions');
    });

    it('fires when conditions is an empty array', () => {
      expect(firedIds({ conditions: [] })).toContain('if_else:no-conditions');
    });

    it('does NOT fire when at least one condition is defined', () => {
      expect(
        firedIds({ conditions: [{ field: 'x', operator: 'eq', value: 1 }] }),
      ).not.toContain('if_else:no-conditions');
    });
  });

  describe('if_else:first-condition-field-empty', () => {
    it('fires when first condition has no field', () => {
      expect(
        firedIds({ conditions: [{ operator: 'eq', value: 1 }] }),
      ).toContain('if_else:first-condition-field-empty');
    });

    it('does NOT fire when first condition has a field', () => {
      expect(
        firedIds({ conditions: [{ field: 'x', operator: 'eq' }] }),
      ).not.toContain('if_else:first-condition-field-empty');
    });

    it('does NOT fire when conditions array is empty (covered by no-conditions)', () => {
      expect(firedIds({ conditions: [] })).not.toContain(
        'if_else:first-condition-field-empty',
      );
    });
  });
});

describe('validateIfElseConfig (imperative)', () => {
  it('returns [] when no conditions configured', () => {
    expect(validateIfElseConfig({ conditions: [] })).toEqual([]);
  });

  it('rejects condition without field', () => {
    expect(
      validateIfElseConfig({ conditions: [{ operator: 'eq' }] }),
    ).toContain('conditions[0].field is required and must be a string');
  });

  it('rejects condition with unknown operator', () => {
    const errors = validateIfElseConfig({
      conditions: [{ field: 'x', operator: 'sploosh' }],
    });
    expect(errors.some((e) => e.startsWith('conditions[0].operator'))).toBe(
      true,
    );
  });

  it('accepts a fully-formed condition', () => {
    expect(
      validateIfElseConfig({
        conditions: [{ field: 'x', operator: 'eq', value: 1 }],
      }),
    ).toEqual([]);
  });
});

describe('evaluateMetadataBlockingErrors integration (if_else)', () => {
  it('emits both warnings on a freshly-created node', () => {
    const errors = evaluateMetadataBlockingErrors(ifElseMetadata, {});
    expect(errors).toContain('At least one condition must be added.');
  });

  it('returns [] when configured with a valid first condition', () => {
    expect(
      evaluateMetadataBlockingErrors(ifElseMetadata, {
        conditions: [{ field: 'x', operator: 'eq', value: 1 }],
      }),
    ).toEqual([]);
  });
});
