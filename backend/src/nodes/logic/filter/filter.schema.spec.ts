import { evaluateWarnings } from '@workflow/node-summary';
import { filterNodeMetadata, validateFilterConfig } from './filter.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('filterNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      filterNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('filter:no-input-field', () => {
    it('fires when inputField is missing', () => {
      expect(firedIds({})).toContain('filter:no-input-field');
    });

    it('does NOT fire when inputField is set', () => {
      expect(firedIds({ inputField: '$input.items' })).not.toContain(
        'filter:no-input-field',
      );
    });
  });

  describe('filter:no-conditions', () => {
    it('fires when conditions is empty', () => {
      expect(
        firedIds({ inputField: '$input.items', conditions: [] }),
      ).toContain('filter:no-conditions');
    });

    it('does NOT fire when conditions is non-empty', () => {
      expect(
        firedIds({
          inputField: '$input.items',
          conditions: [{ field: 'x', operator: 'eq' }],
        }),
      ).not.toContain('filter:no-conditions');
    });
  });
});

describe('validateFilterConfig (imperative)', () => {
  it('returns [] when no conditions', () => {
    expect(validateFilterConfig({ inputField: 'a' })).toEqual([]);
  });

  it('rejects condition without field', () => {
    expect(
      validateFilterConfig({
        inputField: 'a',
        conditions: [{ operator: 'eq' }],
      }),
    ).toContain('conditions[0].field is required and must be a string');
  });

  it('rejects unknown operator', () => {
    const errors = validateFilterConfig({
      inputField: 'a',
      conditions: [{ field: 'x', operator: 'sploosh' }],
    });
    expect(errors.some((e) => e.startsWith('conditions[0].operator'))).toBe(
      true,
    );
  });

  it('accepts a fully-formed condition', () => {
    expect(
      validateFilterConfig({
        inputField: 'a',
        conditions: [{ field: 'x', operator: 'eq' }],
      }),
    ).toEqual([]);
  });
});

describe('evaluateMetadataBlockingErrors integration (filter)', () => {
  it('emits both Korean warnings when nothing is configured', () => {
    const errors = evaluateMetadataBlockingErrors(filterNodeMetadata, {});
    expect(errors).toContain('Input 필드를 입력해야 합니다.');
    expect(errors).toContain('최소 1개 이상의 조건을 추가해야 합니다.');
  });

  it('returns [] when fully configured', () => {
    expect(
      evaluateMetadataBlockingErrors(filterNodeMetadata, {
        inputField: '$input.items',
        conditions: [{ field: 'x', operator: 'eq', value: 1 }],
      }),
    ).toEqual([]);
  });
});
