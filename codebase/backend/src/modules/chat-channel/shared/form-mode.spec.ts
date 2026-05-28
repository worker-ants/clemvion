import { decideFormMode, extractFormFields } from './form-mode';
import type { FormModalField } from '../types';

/** Slack: file 외 전부 modal 수용. */
const slackCompatible = (f: FormModalField): boolean => f.type !== 'file';
/** Discord: text 계열만 (select/radio/checkbox/file 불가). */
const discordCompatible = (f: FormModalField): boolean =>
  ['text', 'textarea', 'email', 'number', 'date', 'phone'].includes(f.type);

const field = (over: Partial<FormModalField> = {}): FormModalField => ({
  name: 'n',
  label: 'L',
  type: 'text',
  ...over,
});

describe('decideFormMode', () => {
  it('formMode=multi_step → 항상 multi_step (opt-out)', () => {
    expect(
      decideFormMode({
        formMode: 'multi_step',
        supportsNativeForm: true,
        fields: [field()],
        isFieldModalCompatible: slackCompatible,
      }),
    ).toBe('multi_step');
  });

  it('supportsNativeForm=false → multi_step (Telegram)', () => {
    expect(
      decideFormMode({
        formMode: 'auto',
        supportsNativeForm: false,
        fields: [field()],
        isFieldModalCompatible: () => true,
      }),
    ).toBe('multi_step');
  });

  it('fields ≤ 5 & 전 필드 수용 & auto → native_modal', () => {
    expect(
      decideFormMode({
        formMode: 'auto',
        supportsNativeForm: true,
        fields: [field(), field({ name: 'b' })],
        isFieldModalCompatible: slackCompatible,
      }),
    ).toBe('native_modal');
  });

  it('fields > 5 → multi_step (modal 5 한계)', () => {
    const six = Array.from({ length: 6 }, (_, i) => field({ name: `f${i}` }));
    expect(
      decideFormMode({
        formMode: 'native_modal',
        supportsNativeForm: true,
        fields: six,
        isFieldModalCompatible: slackCompatible,
      }),
    ).toBe('multi_step');
  });

  it('fields 0 → multi_step', () => {
    expect(
      decideFormMode({
        formMode: 'auto',
        supportsNativeForm: true,
        fields: [],
        isFieldModalCompatible: slackCompatible,
      }),
    ).toBe('multi_step');
  });

  it('Discord: select 포함 시 multi_step (modal TEXT_INPUT only)', () => {
    expect(
      decideFormMode({
        formMode: 'auto',
        supportsNativeForm: true,
        fields: [field(), field({ name: 's', type: 'select' })],
        isFieldModalCompatible: discordCompatible,
      }),
    ).toBe('multi_step');
  });

  it('Slack: file 포함 시 multi_step / file 없으면 native_modal', () => {
    expect(
      decideFormMode({
        formMode: 'auto',
        supportsNativeForm: true,
        fields: [field({ name: 'f', type: 'file' })],
        isFieldModalCompatible: slackCompatible,
      }),
    ).toBe('multi_step');
    expect(
      decideFormMode({
        formMode: 'auto',
        supportsNativeForm: true,
        fields: [field(), field({ name: 'sel', type: 'select' })],
        isFieldModalCompatible: slackCompatible,
      }),
    ).toBe('native_modal');
  });
});

describe('extractFormFields', () => {
  it('formConfig.fields[] 직접 shape 정규화', () => {
    const fields = extractFormFields({
      fields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'note', type: 'textarea', description: 'optional note' },
      ],
    });
    expect(fields).toEqual([
      { name: 'email', label: 'Email', type: 'email', required: true },
      {
        name: 'note',
        label: 'note',
        type: 'textarea',
        description: 'optional note',
      },
    ]);
  });

  it('nodeOutput wrapping shape ({ config: { fields } }) 수용', () => {
    const fields = extractFormFields({
      config: { fields: [{ name: 'a', label: 'A', type: 'text' }] },
    });
    expect(fields).toHaveLength(1);
    expect(fields[0].name).toBe('a');
  });

  it('select options 정규화 (string / {label,value} 혼합)', () => {
    const fields = extractFormFields({
      fields: [
        {
          name: 's',
          label: 'S',
          type: 'select',
          options: ['x', { label: 'Y', value: 'y' }, { value: 1 }],
        },
      ],
    });
    expect(fields[0].options).toEqual([
      { label: 'x', value: 'x' },
      { label: 'Y', value: 'y' },
      { label: '1', value: '1' },
    ]);
  });

  it('name 없는 필드 / 잘못된 shape skip', () => {
    expect(
      extractFormFields({ fields: [{ label: 'no name' }, null, 3] }),
    ).toEqual([]);
    expect(extractFormFields(null)).toEqual([]);
    expect(extractFormFields({})).toEqual([]);
  });
});
