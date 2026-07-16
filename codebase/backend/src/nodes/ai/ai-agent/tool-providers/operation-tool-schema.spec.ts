import {
  buildOperationJsonSchema,
  makeEnabledToolsFilter,
  type OperationSchemaSource,
} from './operation-tool-schema';

/** 최소 operation source 헬퍼 — 테스트별 필요한 필드만 덮어쓴다. */
function op(overrides: Partial<OperationSchemaSource>): OperationSchemaSource {
  return {
    fields: {},
    requiredFields: [],
    ...overrides,
  };
}

describe('buildOperationJsonSchema (cafe24/makeshop 공유 매핑)', () => {
  it('scalar field type 을 그대로 매핑한다 (string/number/boolean)', () => {
    const schema = buildOperationJsonSchema(
      op({
        fields: {
          a: { type: 'string' },
          b: { type: 'number' },
          c: { type: 'boolean' },
        },
      }),
    );
    expect(schema).toEqual({
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'number' },
        c: { type: 'boolean' },
      },
    });
  });

  it('enum → {type:string, enum}, enum 미지정이면 enum 키 생략', () => {
    const schema = buildOperationJsonSchema(
      op({
        fields: {
          withEnum: { type: 'enum', enum: ['x', 'y'] },
          bareEnum: { type: 'enum' },
        },
      }),
    );
    const props = schema.properties as Record<string, unknown>;
    expect(props.withEnum).toEqual({ type: 'string', enum: ['x', 'y'] });
    expect(props.bareEnum).toEqual({ type: 'string' });
  });

  it('array → items:{type:string}, object → additionalProperties:true', () => {
    const schema = buildOperationJsonSchema(
      op({
        fields: {
          arr: { type: 'array' },
          obj: { type: 'object' },
        },
      }),
    );
    const props = schema.properties as Record<string, unknown>;
    expect(props.arr).toEqual({ type: 'array', items: { type: 'string' } });
    expect(props.obj).toEqual({ type: 'object', additionalProperties: true });
  });

  it('description 을 전달하고, default 는 정의됐을 때만(falsy 포함) 전달한다', () => {
    const schema = buildOperationJsonSchema(
      op({
        fields: {
          described: { type: 'string', description: 'hello' },
          withDefault: { type: 'number', default: 0 },
          withFalseDefault: { type: 'boolean', default: false },
          noDefault: { type: 'string' },
        },
      }),
    );
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.described.description).toBe('hello');
    // default: 0 / false 는 undefined 가 아니므로 전달돼야 한다(`!== undefined` 판정).
    expect(props.withDefault.default).toBe(0);
    expect(props.withFalseDefault.default).toBe(false);
    expect('default' in props.noDefault).toBe(false);
  });

  it('requiredFields 있고 oneOf 없으면 최상위 required 만 낸다', () => {
    const schema = buildOperationJsonSchema(
      op({ fields: { a: { type: 'string' } }, requiredFields: ['a'] }),
    );
    expect(schema.required).toEqual(['a']);
    expect(schema.allOf).toBeUndefined();
  });

  it('requiredFields·oneOf 모두 없으면 required 키 자체를 생략한다', () => {
    const schema = buildOperationJsonSchema(
      op({ fields: { a: { type: 'string' } } }),
    );
    expect('required' in schema).toBe(false);
    expect('allOf' in schema).toBe(false);
  });

  it('oneOf 제약 → allOf 로 래핑(requiredFields 절 + anyOf 절)', () => {
    const schema = buildOperationJsonSchema(
      op({
        fields: {
          a: { type: 'string' },
          b: { type: 'string' },
          c: { type: 'string' },
        },
        requiredFields: ['a'],
        constraints: [{ kind: 'oneOf', fields: ['b', 'c'] }],
      }),
    );
    // 최상위 required 는 allOf 로 이동(oneOf 존재 시).
    expect(schema.required).toBeUndefined();
    expect(schema.allOf).toEqual([
      { required: ['a'] },
      { anyOf: [{ required: ['b'] }, { required: ['c'] }] },
    ]);
  });

  it('oneOf 만 있고 requiredFields 없으면 allOf 는 anyOf 절만', () => {
    const schema = buildOperationJsonSchema(
      op({
        fields: { b: { type: 'string' }, c: { type: 'string' } },
        constraints: [{ kind: 'oneOf', fields: ['b', 'c'] }],
      }),
    );
    expect(schema.allOf).toEqual([
      { anyOf: [{ required: ['b'] }, { required: ['c'] }] },
    ]);
  });

  it('oneOf 여러 개 → 각각 anyOf 절로 allOf 에 누적', () => {
    const schema = buildOperationJsonSchema(
      op({
        fields: {
          a: { type: 'string' },
          b: { type: 'string' },
          c: { type: 'string' },
          d: { type: 'string' },
        },
        constraints: [
          { kind: 'oneOf', fields: ['a', 'b'] },
          { kind: 'oneOf', fields: ['c', 'd'] },
        ],
      }),
    );
    expect(schema.allOf).toEqual([
      { anyOf: [{ required: ['a'] }, { required: ['b'] }] },
      { anyOf: [{ required: ['c'] }, { required: ['d'] }] },
    ]);
  });

  it('oneOf 이외 kind(allOrNone/implies)는 JSON Schema 로 변환하지 않는다', () => {
    const schema = buildOperationJsonSchema(
      op({
        fields: { a: { type: 'string' }, b: { type: 'string' } },
        requiredFields: ['a'],
        constraints: [
          { kind: 'allOrNone', fields: ['a', 'b'] },
          { kind: 'implies' } as { kind: string },
        ],
      }),
    );
    // oneOf 가 하나도 없으므로 allOf 미생성, requiredFields 는 최상위 required.
    expect(schema.allOf).toBeUndefined();
    expect(schema.required).toEqual(['a']);
  });
});

describe('makeEnabledToolsFilter (cafe24/makeshop 공유 allowlist)', () => {
  it('undefined / 빈 배열 → 전체 허용', () => {
    expect(makeEnabledToolsFilter(undefined)('anything')).toBe(true);
    expect(makeEnabledToolsFilter([])('anything')).toBe(true);
  });

  it("'*' 포함 → 전체 허용(다른 항목과 섞여 있어도)", () => {
    expect(makeEnabledToolsFilter(['*'])('anything')).toBe(true);
    expect(makeEnabledToolsFilter(['a', '*'])('zzz')).toBe(true);
  });

  it('명시 목록 → 집합 멤버만 허용', () => {
    const f = makeEnabledToolsFilter(['a', 'b']);
    expect(f('a')).toBe(true);
    expect(f('b')).toBe(true);
    expect(f('c')).toBe(false);
  });
});
