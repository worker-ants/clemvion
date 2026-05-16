import { evaluateWarnings } from '@workflow/node-summary';
import { formNodeMetadata, optionSchema } from './form.schema';
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

describe('optionSchema (select/radio/checkbox 옵션)', () => {
  it('value 가 누락되면 빈 문자열로 default (undefined → "")', () => {
    const parsed = optionSchema.parse({ label: 'Yes' });
    expect(parsed.value).toBe('');
    expect(parsed.value).not.toBeUndefined();
  });

  it('label 이 누락되면 빈 문자열로 default', () => {
    const parsed = optionSchema.parse({});
    expect(parsed.label).toBe('');
    expect(parsed.value).toBe('');
  });

  it('명시적으로 설정한 value 는 보존 (boolean/number/string 모두)', () => {
    expect(optionSchema.parse({ value: true }).value).toBe(true);
    expect(optionSchema.parse({ value: 42 }).value).toBe(42);
    expect(optionSchema.parse({ value: 'opt-1' }).value).toBe('opt-1');
    expect(optionSchema.parse({ value: null }).value).toBeNull();
  });

  it('passthrough — 추가 메타 필드 보존', () => {
    const parsed = optionSchema.parse({
      label: 'A',
      value: 'a',
      description: 'extra',
      // Zod passthrough 는 런타임에 추가 필드를 보존하지만 추론 타입에는
      // 미반영되므로 cast 가 불가피.
    } as Record<string, unknown>);
    expect((parsed as Record<string, unknown>).description).toBe('extra');
  });
});

describe('evaluateMetadataBlockingErrors integration (form)', () => {
  it('returns the Korean warning message for an empty form', () => {
    expect(evaluateMetadataBlockingErrors(formNodeMetadata, {})).toEqual([
      'At least one field must be defined.',
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
