import {
  decideFormMode,
  extractFormFields,
  extractFormTitle,
  validateFormSubmission,
  validateFileField,
  DEFAULT_FILE_ALLOWED_MIME_TYPES,
  DEFAULT_FILE_MAX_FILE_SIZE_MB,
  DEFAULT_FILE_MAX_TOTAL_SIZE_MB,
  DEFAULT_FILE_MAX_FILES,
  MB_IN_BYTES,
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

  it('§3.3 field.validation.{minLength,maxLength} 정규화', () => {
    const fields = extractFormFields({
      fields: [
        {
          name: 'pw',
          label: 'PW',
          type: 'text',
          validation: { minLength: 8, maxLength: 32 },
        },
        // 무효 값(음수 max·비숫자)은 미반영.
        {
          name: 'bad',
          label: 'Bad',
          type: 'text',
          validation: { minLength: -1, maxLength: 0, foo: 'x' },
        },
        { name: 'plain', label: 'Plain', type: 'text' },
      ],
    });
    expect(fields[0].minLength).toBe(8);
    expect(fields[0].maxLength).toBe(32);
    expect(fields[1].minLength).toBeUndefined();
    expect(fields[1].maxLength).toBeUndefined();
    expect(fields[2].minLength).toBeUndefined();
  });

  it('§3.3 minLength=0 은 허용(>=0), maxLength=0 은 거부(>0)', () => {
    const fields = extractFormFields({
      fields: [
        {
          name: 'z',
          label: 'Z',
          type: 'text',
          validation: { minLength: 0, maxLength: 0 },
        },
      ],
    });
    expect(fields[0].minLength).toBe(0);
    expect(fields[0].maxLength).toBeUndefined();
  });

  it('§6.2 field.validation.{min,max,pattern} 정규화', () => {
    const fields = extractFormFields({
      fields: [
        {
          name: 'age',
          label: 'Age',
          type: 'number',
          validation: { min: 0, max: 120 },
        },
        {
          name: 'code',
          label: 'Code',
          type: 'text',
          validation: { pattern: '^[A-Z]{3}$' },
        },
        // 무효 값(비숫자 min·NaN max·빈 pattern)은 미반영.
        {
          name: 'bad',
          label: 'Bad',
          type: 'number',
          validation: { min: 'x', max: NaN, pattern: '' },
        },
      ],
    });
    expect(fields[0].min).toBe(0);
    expect(fields[0].max).toBe(120);
    expect(fields[0].pattern).toBeUndefined();
    expect(fields[1].pattern).toBe('^[A-Z]{3}$');
    expect(fields[2].min).toBeUndefined();
    expect(fields[2].max).toBeUndefined();
    expect(fields[2].pattern).toBeUndefined();
  });

  it('§6.2 min/max — Infinity/-Infinity 는 비유한수라 거부', () => {
    const fields = extractFormFields({
      fields: [
        {
          name: 'n',
          label: 'N',
          type: 'number',
          validation: { min: -Infinity, max: Infinity },
        },
      ],
    });
    expect(fields[0].min).toBeUndefined();
    expect(fields[0].max).toBeUndefined();
  });

  it('§6.2 min/max — 논리 역전(min>max)은 두 경계 모두 무시', () => {
    const fields = extractFormFields({
      fields: [
        {
          name: 'n',
          label: 'N',
          type: 'number',
          validation: { min: 100, max: 10 },
        },
        // min==max 는 유효(단일 값 허용) → 유지.
        {
          name: 'eq',
          label: 'Eq',
          type: 'number',
          validation: { min: 5, max: 5 },
        },
      ],
    });
    expect(fields[0].min).toBeUndefined();
    expect(fields[0].max).toBeUndefined();
    expect(fields[1].min).toBe(5);
    expect(fields[1].max).toBe(5);
  });

  it('§1 file 필드 — 미설정 시 공유 기본값 주입 (file-type 한정)', () => {
    const fields = extractFormFields({
      fields: [{ name: 'doc', label: 'Doc', type: 'file' }],
    });
    expect(fields[0].allowedMimeTypes).toEqual(DEFAULT_FILE_ALLOWED_MIME_TYPES);
    expect(fields[0].maxFileSize).toBe(DEFAULT_FILE_MAX_FILE_SIZE_MB);
    expect(fields[0].maxTotalSize).toBe(DEFAULT_FILE_MAX_TOTAL_SIZE_MB);
    expect(fields[0].maxFiles).toBe(DEFAULT_FILE_MAX_FILES);
  });

  it('§1 file 필드 — 명시 설정은 보존, 무효 값(0/음수/비배열)은 기본값 fallback', () => {
    const fields = extractFormFields({
      fields: [
        {
          name: 'a',
          label: 'A',
          type: 'file',
          allowedMimeTypes: ['image/png'],
          maxFileSize: 2,
          maxTotalSize: 8,
          maxFiles: 3,
        },
        {
          name: 'b',
          label: 'B',
          type: 'file',
          allowedMimeTypes: [],
          maxFileSize: 0,
          maxTotalSize: -1,
          maxFiles: 0,
        },
      ],
    });
    expect(fields[0].allowedMimeTypes).toEqual(['image/png']);
    expect(fields[0].maxFileSize).toBe(2);
    expect(fields[0].maxTotalSize).toBe(8);
    expect(fields[0].maxFiles).toBe(3);
    // 무효 값 → 기본값.
    expect(fields[1].allowedMimeTypes).toEqual(DEFAULT_FILE_ALLOWED_MIME_TYPES);
    expect(fields[1].maxFileSize).toBe(DEFAULT_FILE_MAX_FILE_SIZE_MB);
    expect(fields[1].maxTotalSize).toBe(DEFAULT_FILE_MAX_TOTAL_SIZE_MB);
    expect(fields[1].maxFiles).toBe(DEFAULT_FILE_MAX_FILES);
  });

  it('§1 file 필드 — NaN/Infinity 숫자 제약은 비유한수라 기본값 fallback', () => {
    const fields = extractFormFields({
      fields: [
        {
          name: 'a',
          label: 'A',
          type: 'file',
          maxFileSize: NaN,
          maxTotalSize: Infinity,
          maxFiles: Infinity,
        },
      ],
    });
    // Number.isFinite 가드 — NaN·Infinity 모두 거부하고 기본값 적용(무제한 size 회귀 차단).
    expect(fields[0].maxFileSize).toBe(DEFAULT_FILE_MAX_FILE_SIZE_MB);
    expect(fields[0].maxTotalSize).toBe(DEFAULT_FILE_MAX_TOTAL_SIZE_MB);
    expect(fields[0].maxFiles).toBe(DEFAULT_FILE_MAX_FILES);
  });

  it('§1 Principle 1.1 — 비-file 필드에는 file 제약 미주입', () => {
    const fields = extractFormFields({
      fields: [{ name: 't', label: 'T', type: 'text' }],
    });
    expect(fields[0].allowedMimeTypes).toBeUndefined();
    expect(fields[0].maxFileSize).toBeUndefined();
    expect(fields[0].maxTotalSize).toBeUndefined();
    expect(fields[0].maxFiles).toBeUndefined();
  });
});

describe('extractFormTitle', () => {
  it('직접 shape ({ title }) + nodeOutput wrapping ({ config: { title } })', () => {
    expect(extractFormTitle({ title: 'Approval' })).toBe('Approval');
    expect(extractFormTitle({ config: { title: 'Nested' } })).toBe('Nested');
  });
  it('title 과 config.title 동시 존재 → 직접 title 우선', () => {
    expect(extractFormTitle({ title: 'A', config: { title: 'B' } })).toBe('A');
  });
  it('빈/비문자열/부재 → undefined', () => {
    expect(extractFormTitle({ title: '  ' })).toBeUndefined();
    expect(extractFormTitle({ title: 123 })).toBeUndefined();
    expect(extractFormTitle({})).toBeUndefined();
    expect(extractFormTitle(null)).toBeUndefined();
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

  it('§3.3 minLength/maxLength — 서버측 길이 검증', () => {
    const defs = [
      field({ name: 'pw', type: 'text', minLength: 8, maxLength: 12 }),
    ];
    expect(validateFormSubmission({ pw: 'short' }, defs)).toEqual({
      field: 'pw',
      message: '최소 8자 이상 입력해 주세요.',
    });
    expect(validateFormSubmission({ pw: 'waaaytoolongvalue' }, defs)).toEqual({
      field: 'pw',
      message: '최대 12자까지 입력할 수 있습니다.',
    });
    expect(validateFormSubmission({ pw: 'goodpass' }, defs)).toBeNull();
  });

  it('§6.2 min/max — number 범위 서버측 검증', () => {
    const defs = [field({ name: 'age', type: 'number', min: 18, max: 65 })];
    expect(validateFormSubmission({ age: '10' }, defs)).toEqual({
      field: 'age',
      message: '최솟값은 18 이상이어야 합니다.',
    });
    expect(validateFormSubmission({ age: '70' }, defs)).toEqual({
      field: 'age',
      message: '최댓값은 65 이하여야 합니다.',
    });
    expect(validateFormSubmission({ age: '18' }, defs)).toBeNull();
    expect(validateFormSubmission({ age: '65' }, defs)).toBeNull();
  });

  it('§6.2 min/max — 음수·소수 경계', () => {
    const defs = [field({ name: 'temp', type: 'number', min: -10, max: 0 })];
    expect(validateFormSubmission({ temp: '-10' }, defs)).toBeNull();
    expect(validateFormSubmission({ temp: '0.5' }, defs)).toEqual({
      field: 'temp',
      message: '최댓값은 0 이하여야 합니다.',
    });
  });

  it('§6.2 min/max — 숫자 형식 오류가 범위보다 우선 (FIRST)', () => {
    const defs = [field({ name: 'age', type: 'number', min: 18 })];
    expect(validateFormSubmission({ age: 'abc' }, defs)).toEqual({
      field: 'age',
      message: '숫자만 입력해 주세요.',
    });
  });

  it('§6.2 min/max — max 단독(min 없음) 독립 동작', () => {
    const defs = [field({ name: 'score', type: 'number', max: 100 })];
    expect(validateFormSubmission({ score: '101' }, defs)).toEqual({
      field: 'score',
      message: '최댓값은 100 이하여야 합니다.',
    });
    expect(validateFormSubmission({ score: '100' }, defs)).toBeNull();
    expect(validateFormSubmission({ score: '-5' }, defs)).toBeNull();
  });

  it('§6.2 min/max — min:0 하한(falsy 경계) 정상 적용', () => {
    const defs = [field({ name: 'qty', type: 'number', min: 0 })];
    expect(validateFormSubmission({ qty: '-1' }, defs)).toEqual({
      field: 'qty',
      message: '최솟값은 0 이상이어야 합니다.',
    });
    expect(validateFormSubmission({ qty: '0' }, defs)).toBeNull();
  });

  it('§6.2 pattern — regex 미일치 → 오류 / 일치 → null', () => {
    const defs = [field({ name: 'code', type: 'text', pattern: '^[A-Z]{3}$' })];
    expect(validateFormSubmission({ code: 'abc' }, defs)).toEqual({
      field: 'code',
      message: '형식이 올바르지 않습니다.',
    });
    expect(validateFormSubmission({ code: 'ABC' }, defs)).toBeNull();
  });

  it('§6.2 pattern — 빈 optional 값은 skip', () => {
    const defs = [field({ name: 'code', type: 'text', pattern: '^[A-Z]{3}$' })];
    expect(validateFormSubmission({ code: '' }, defs)).toBeNull();
  });

  it('§6.2 pattern — 잘못된 regex 는 방어적으로 통과', () => {
    // '[' 는 미완성 character class → new RegExp throw → 컴파일 실패 시 방어적 통과.
    const defs = [field({ name: 'code', type: 'text', pattern: '[' })];
    expect(validateFormSubmission({ code: 'anything' }, defs)).toBeNull();
  });

  it('§6.2 pattern — 과길이 패턴(>512자)은 컴파일 skip(방어적 통과)', () => {
    const defs = [
      field({ name: 'code', type: 'text', pattern: 'a'.repeat(513) }),
    ];
    // 513자 'aaa...' 패턴은 'b' 와 미일치하지만, 길이 cap 으로 컴파일 자체를 skip → 통과.
    expect(validateFormSubmission({ code: 'b' }, defs)).toBeNull();
  });

  it('§6.2 minLength 가 min/max·pattern 보다 우선 (FIRST 순서)', () => {
    const defs = [
      field({ name: 'pw', type: 'text', minLength: 8, pattern: '^[A-Z]+$' }),
    ];
    expect(validateFormSubmission({ pw: 'abc' }, defs)).toEqual({
      field: 'pw',
      message: '최소 8자 이상 입력해 주세요.',
    });
  });

  it('§6.2 maxLength 가 pattern 보다 우선 (FIRST 순서)', () => {
    const defs = [
      field({ name: 'pw', type: 'text', maxLength: 5, pattern: '^[A-Z]+$' }),
    ];
    // 6자 입력: maxLength 위반이 pattern(대문자) 위반보다 먼저 표면.
    expect(validateFormSubmission({ pw: 'abcdef' }, defs)).toEqual({
      field: 'pw',
      message: '최대 5자까지 입력할 수 있습니다.',
    });
  });
});

describe('validateFileField', () => {
  const fileDef = (over: Partial<FormModalField> = {}): FormModalField => ({
    name: 'doc',
    label: 'Doc',
    type: 'file',
    allowedMimeTypes: ['image/png', 'application/pdf'],
    maxFileSize: 10,
    maxTotalSize: 50,
    maxFiles: 3,
    ...over,
  });
  const meta = (over: Record<string, unknown> = {}) => ({
    name: 'f.png',
    size: 1024,
    type: 'image/png',
    lastModified: 0,
    ...over,
  });

  it('통과 — 허용 MIME · 크기/개수 이내', () => {
    expect(validateFileField([meta()], fileDef())).toBeNull();
  });

  it('required + 파일 있음(충족) → null (양방향 검증)', () => {
    expect(validateFileField([meta()], fileDef({ required: true }))).toBeNull();
  });

  it('required 빈 배열/누락 → 필수 입력 오류', () => {
    expect(validateFileField([], fileDef({ required: true }))).toEqual({
      field: 'doc',
      message: '필수 입력 항목입니다.',
    });
    expect(validateFileField(undefined, fileDef({ required: true }))).toEqual({
      field: 'doc',
      message: '필수 입력 항목입니다.',
    });
  });

  it('optional 빈 배열 → 통과', () => {
    expect(validateFileField([], fileDef())).toBeNull();
    expect(validateFileField(undefined, fileDef())).toBeNull();
  });

  it('MIME 미허용 → 형식 오류 (첫 위반)', () => {
    expect(
      validateFileField(
        [meta({ type: 'application/x-msdownload' })],
        fileDef(),
      ),
    ).toEqual({ field: 'doc', message: '허용되지 않은 파일 형식입니다.' });
  });

  it('per-file size 초과 → 크기 오류', () => {
    expect(
      validateFileField(
        [meta({ size: 11 * MB_IN_BYTES })],
        fileDef({ maxFileSize: 10 }),
      ),
    ).toEqual({ field: 'doc', message: '파일 크기는 10MB 이하여야 합니다.' });
  });

  it('total size 초과 → 합계 오류 (개별은 통과)', () => {
    expect(
      validateFileField(
        [meta({ size: 6 * MB_IN_BYTES }), meta({ size: 6 * MB_IN_BYTES })],
        fileDef({ maxFileSize: 10, maxTotalSize: 10 }),
      ),
    ).toEqual({
      field: 'doc',
      message: '전체 파일 크기는 10MB 이하여야 합니다.',
    });
  });

  it('count 초과 → 개수 오류', () => {
    expect(
      validateFileField([meta(), meta(), meta()], fileDef({ maxFiles: 2 })),
    ).toEqual({ field: 'doc', message: '최대 2개까지 업로드할 수 있습니다.' });
  });

  it('FIRST 오류 순서 — MIME 가 size 보다 먼저 표면', () => {
    // 첫 파일 MIME 위반 + 둘째 파일 size 위반 동시 → MIME 먼저.
    expect(
      validateFileField(
        [meta({ type: 'text/x-evil' }), meta({ size: 999 * MB_IN_BYTES })],
        fileDef({ maxFileSize: 10 }),
      ),
    ).toEqual({ field: 'doc', message: '허용되지 않은 파일 형식입니다.' });
  });

  it('방어적 — size/type 미보유 shape(Slack 등)는 해당 체크 skip → 통과', () => {
    // Slack 어댑터 file payload shape: { fileId, mimeType, ... } (size/type 부재).
    expect(
      validateFileField(
        [{ fileId: 'F123', mimeType: 'application/x-evil' }],
        fileDef(),
      ),
    ).toBeNull();
  });

  it('방어적 — 비배열/비객체 element 는 무시', () => {
    expect(validateFileField('not-array', fileDef())).toBeNull();
    expect(validateFileField([null, 3, meta()], fileDef())).toBeNull();
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
