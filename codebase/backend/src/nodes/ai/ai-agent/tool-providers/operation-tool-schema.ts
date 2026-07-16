/**
 * cafe24·makeshop 이커머스 MCP tool provider 가 공유하는 operation→JSON Schema
 * 매핑 + `enabledTools` allowlist 필터 (순수·무상태).
 *
 * 두 provider 의 metadata 모델(`Cafe24OperationMetadata`/`MakeshopOperationMetadata`)
 * 은 의도적으로 동형이라(makeshop `metadata/types.ts`: "Form is isomorphic to the
 * Cafe24 metadata model" · constraint 정의는 "Copied verbatim from the Cafe24
 * model"), operation→ToolDef 의 `parameters` 스키마 생성과 allowlist 판정 로직이
 * 두 provider 에서 라인 단위로 동일했다(ai-review PR#955 항목 A W4). 본 모듈이 그
 * 단일 진실을 보유해 두 provider 가 공유한다 — 한쪽만 고쳐 스키마가 어긋나는 drift
 * 를 구조적으로 제거한다.
 *
 * 구조적 타입(`OperationSchemaSource`)만 의존하므로 cafe24/makeshop metadata 를
 * 어느 쪽도 import 하지 않는다 — 순환 없음. 두 concrete metadata 타입은 이
 * 부분집합 인터페이스에 구조적으로 대입 가능하다.
 *
 * SoT: `spec/conventions/cafe24-api-metadata.md` §2 "constraints 의 의미" /
 *      "MCP·JSON Schema 매핑" (`makeshop-api-metadata.md` §2 가 이를 참조).
 */

/**
 * `buildOperationJsonSchema` 가 읽는 최소 field spec — cafe24/makeshop `FieldSpec`
 * 의 공통 부분집합(`location` 등 스키마 매핑에 불필요한 필드는 제외). 두 concrete
 * `FieldSpec` 이 이 형상에 구조적으로 대입된다.
 */
export interface OperationFieldSpec {
  /** `'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum'`. */
  type: string;
  enum?: string[];
  description?: string;
  default?: unknown;
}

/**
 * `buildOperationJsonSchema` 가 읽는 최소 operation 형상 — 양 provider metadata 의
 * 구조적 상위형. `constraints` 는 `kind: 'oneOf'` 만 JSON Schema 로 변환하고 나머지
 * kind(`allOrNone`/`implies`/`impliesValue`)는 런타임 검증에 맡긴다(그들의 `not`
 * 인코딩은 LLM tool-call validator 를 오작동시킨다 — spec §2).
 */
export interface OperationSchemaSource {
  fields: Record<string, OperationFieldSpec>;
  requiredFields: string[];
  constraints?: ReadonlyArray<{ kind: string; fields?: readonly string[] }>;
}

/**
 * operation → LLM 도구 `parameters` JSON Schema. cafe24/makeshop 공통.
 *
 * - field type: `enum`→`{type:'string', enum}`, `array`→`{type:'array', items:{type:'string'}}`,
 *   `object`→`{type:'object', additionalProperties:true}`, 그 외는 `type` 그대로.
 * - `required` + `oneOf` 조합:
 *   - oneOf 제약 없음 → 최상위 `required` 만.
 *   - oneOf 제약 있음 → `allOf` 로 래핑: requiredFields 의 AND 와 각 oneOf(자신은
 *     single-field `required` 들의 `anyOf` = at-least-one)의 AND 가 깔끔히 합성된다.
 *     JSON Schema 의 `oneOf`("정확히 하나")가 아니라 의도적으로 `anyOf`("적어도 하나").
 */
export function buildOperationJsonSchema(
  op: OperationSchemaSource,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const [name, spec] of Object.entries(op.fields)) {
    const prop: Record<string, unknown> = {};
    if (spec.type === 'enum') {
      prop.type = 'string';
      if (spec.enum) prop.enum = spec.enum;
    } else if (spec.type === 'array') {
      prop.type = 'array';
      prop.items = { type: 'string' };
    } else if (spec.type === 'object') {
      prop.type = 'object';
      prop.additionalProperties = true;
    } else {
      prop.type = spec.type;
    }
    if (spec.description) prop.description = spec.description;
    if (spec.default !== undefined) prop.default = spec.default;
    properties[name] = prop;
  }
  const schema: Record<string, unknown> = {
    type: 'object',
    properties,
  };

  const oneOfConstraints = (op.constraints ?? []).filter(
    (c) => c.kind === 'oneOf',
  );
  const requiredClause =
    op.requiredFields.length > 0 ? { required: [...op.requiredFields] } : null;

  if (oneOfConstraints.length === 0) {
    if (requiredClause) schema.required = requiredClause.required;
  } else {
    const anyOfClauses = oneOfConstraints.map((c) => ({
      anyOf: (c.fields ?? []).map((f) => ({ required: [f] })),
    }));
    const allOf = requiredClause
      ? [requiredClause, ...anyOfClauses]
      : anyOfClauses;
    schema.allOf = allOf;
  }

  return schema;
}

/**
 * `enabledTools` allowlist → operationId 필터 함수. 빈 배열/미설정/`*` 포함 시 전체
 * 허용, 그 외는 명시된 id 집합만 허용. cafe24/makeshop 공통(구 provider별
 * `apply*Allowlist` 인스턴스 메서드에서 통합).
 */
export function makeEnabledToolsFilter(
  enabledTools: string[] | undefined,
): (id: string) => boolean {
  if (!enabledTools || enabledTools.length === 0) return () => true;
  if (enabledTools.includes('*')) return () => true;
  const set = new Set(enabledTools);
  return (id: string) => set.has(id);
}
