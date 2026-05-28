import {
  decideFormMode,
  extractFormFields,
  validateFormSubmission,
} from './form-mode';
import { isNativeFormAdapter } from '../types';
import type { ChatChannelAdapter, FormModalField } from '../types';

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

describe('validateFormSubmission', () => {
  it('required 필드 누락/공백 → 필수 입력 오류', () => {
    const defs = [field({ name: 'email', type: 'email', required: true })];
    expect(validateFormSubmission({}, defs)).toEqual({
      field: 'email',
      message: '필수 입력 항목입니다.',
    });
    expect(validateFormSubmission({ email: '   ' }, defs)).toEqual({
      field: 'email',
      message: '필수 입력 항목입니다.',
    });
  });

  it('email — 잘못된 형식 → 오류 / 올바른 형식 → null', () => {
    const defs = [field({ name: 'email', type: 'email' })];
    expect(validateFormSubmission({ email: 'bad-email' }, defs)).toEqual({
      field: 'email',
      message: '올바른 이메일 형식이 아닙니다.',
    });
    expect(validateFormSubmission({ email: 'a@b.io' }, defs)).toBeNull();
  });

  it('number — 비숫자 → 오류 / 숫자 → null', () => {
    const defs = [field({ name: 'age', type: 'number' })];
    expect(validateFormSubmission({ age: 'abc' }, defs)).toEqual({
      field: 'age',
      message: '숫자만 입력해 주세요.',
    });
    expect(validateFormSubmission({ age: '42' }, defs)).toBeNull();
    expect(validateFormSubmission({ age: '-3.14' }, defs)).toBeNull();
  });

  it('select — options 밖 값 → 오류 / options 안 값 → null', () => {
    const defs = [
      field({
        name: 'plan',
        type: 'select',
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
      }),
    ];
    expect(validateFormSubmission({ plan: 'z' }, defs)).toEqual({
      field: 'plan',
      message: '유효한 선택지가 아닙니다.',
    });
    expect(validateFormSubmission({ plan: 'a' }, defs)).toBeNull();
  });

  it('radio — options 밖 값 → 오류', () => {
    const defs = [
      field({
        name: 'r',
        type: 'radio',
        options: [{ label: 'Yes', value: 'y' }],
      }),
    ];
    expect(validateFormSubmission({ r: 'n' }, defs)).toEqual({
      field: 'r',
      message: '유효한 선택지가 아닙니다.',
    });
  });

  it('모든 필드 유효 → null', () => {
    const defs = [
      field({ name: 'email', type: 'email', required: true }),
      field({ name: 'age', type: 'number' }),
    ];
    expect(
      validateFormSubmission({ email: 'a@b.io', age: '30' }, defs),
    ).toBeNull();
  });

  it('빈 optional 필드는 형식 검증 skip', () => {
    const defs = [field({ name: 'email', type: 'email' })];
    expect(validateFormSubmission({ email: '' }, defs)).toBeNull();
    expect(validateFormSubmission({}, defs)).toBeNull();
  });

  it('FIRST 오류만 반환 (def 순서)', () => {
    const defs = [
      field({ name: 'email', type: 'email' }),
      field({ name: 'age', type: 'number' }),
    ];
    expect(
      validateFormSubmission({ email: 'bad', age: 'alsobad' }, defs),
    ).toEqual({ field: 'email', message: '올바른 이메일 형식이 아닙니다.' });
  });
});

describe('isNativeFormAdapter', () => {
  const base = {
    provider: 'x',
    setupChannel: jest.fn(),
    teardownChannel: jest.fn(),
    parseUpdate: jest.fn(),
    renderNode: jest.fn(),
    sendMessage: jest.fn(),
    ackInteraction: jest.fn(),
  };

  it('supportsNativeForm:true + 두 메서드 모두 함수 → true', () => {
    const adapter = {
      ...base,
      supportsNativeForm: true,
      openFormModal: jest.fn(),
      buildFormSubmissionResponse: jest.fn(),
    } as unknown as ChatChannelAdapter;
    expect(isNativeFormAdapter(adapter)).toBe(true);
  });

  it('supportsNativeForm:false → false', () => {
    const adapter = {
      ...base,
      supportsNativeForm: false,
      openFormModal: jest.fn(),
      buildFormSubmissionResponse: jest.fn(),
    } as unknown as ChatChannelAdapter;
    expect(isNativeFormAdapter(adapter)).toBe(false);
  });

  it('메서드 누락 시 → false', () => {
    const adapter = {
      ...base,
      supportsNativeForm: true,
    } as unknown as ChatChannelAdapter;
    expect(isNativeFormAdapter(adapter)).toBe(false);
  });
});
