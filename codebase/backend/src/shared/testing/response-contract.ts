import { Controller, Get, type Type } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';

import {
  buildSwaggerDocument,
  schemasOf,
  schemaOf,
  type SwaggerSchemaObject,
} from './swagger-probe';

/**
 * **실제 응답 1건**을 그 엔드포인트가 광고하는 DTO 스키마와 대조한다.
 *
 * ## 왜 있나 — 문서가 강제되지 않는 자리가 있다
 *
 * 컨트롤러가 엔티티를 **그대로 반환**하는 경로에서는 `@ApiProperty` 선언이 **아무것도
 * 강제하지 않는 순수 문서**다. 반환 타입 표기가 없으니 `tsc` 가 DTO 와 대조할 지점이
 * 없고, DTO 가 `required: true` 라고 주장해도 그 주장을 확인하는 것이 없다.
 * `spec-draft-nullable-notation-followups.md` 가 그런 필드를 **78곳** 세었다.
 *
 * 반환 타입을 DTO 로 명시하는 안은 **실측으로 반증됐다** — 엔티티와 응답 DTO 를 전수
 * 대조하니 불일치 59건 중 46건이 `Date` → `string`(JSON 직렬화의 정상 동작)이었다.
 * DTO 는 **직렬화된 wire** 를, 엔티티는 **메모리 안의 값**을 기술하므로 타입 수준
 * 검증자는 그 간극을 원리적으로 못 넘는다. 남은 길은 **직렬화를 거친 뒤를 보는 것**이다.
 *
 * ## 왜 엔드포인트마다 단언을 쓰지 않나
 *
 * 78곳을 개별 단언으로 덮으면 스펙이 78번 늘어난다. 그 대신 **"응답 1건 vs DTO 선언"**
 * 을 일반적으로 대조해, 엔드포인트당 **한 줄**로 그 DTO 의 모든 필드를 한꺼번에 문다.
 *
 * ## 판정 규칙
 *
 * **이 도구는 "응답 값 vs 그 필드의 선언" 을 본다.** 선언 자체가 §5.4 를 지키는지는 다른
 * 층(`repo-guards/swagger-dto-contract` + 트래커의 drift 항목)이 본다. 표의 출처 열이
 * 그 경계를 표시한다.
 *
 * | 스키마 선언 | 응답에 요구하는 것 | 출처 |
 * |---|---|---|
 * | `required` + `nullable` 아님 | 키가 있고 값이 `null`/`undefined` 가 아니다 | §5.4 |
 * | `required` + `nullable` | 키가 있다. 값은 `null` 이어도 된다 | §5.4 |
 * | `required` 아님 (키 생략형) | 키가 없어도 된다. 있으면 `null` 이 아니어야 한다 | §5.4 |
 * | 위 행 + `nullable` 도 선언됨 | `null` 을 허용한다 | **§5.4 아님** — 아래 참조 |
 * | 스키마에 없는 키 | 응답이 **문서화되지 않은 필드**를 싣고 있다 | **§5.4 아님** — 이 검증자의 확장 |
 *
 * **넷째 행을 §5.4 로 적었던 것은 틀렸다** (`review/code/2026/09/05/14_39_31` W5). §5.4 는
 * 응답 바디에서 키 생략 필드에 `| null` 을 **금지**한다 — 그 조합이 정당한 것은 요청
 * 바디(PATCH tri-state)뿐이다. 그러니 응답 DTO 가 그 조합을 선언하고 있다면 그것 자체가
 * 선언 층의 §5.4 위반이고, **이 도구가 판정할 대상이 아니다.** 값 검사기가 선언을 무시하고
 * `null` 을 위반이라 부르면 이미 알려진 선언 drift 마다 거짓 위반이 쏟아진다.
 *
 * 다섯째 행도 §5.4 에 없다 — spec 은 "부재를 어떻게 표기하는가" 를 정할 뿐 "선언되지 않은
 * 키가 응답에 있으면 안 된다" 고는 말하지 않는다. 그 행이 잡는 것이 엔티티 패스스루의 과다
 * 노출이므로 여기서만 더 엄격하게 문다. 이 행은 반대 방향이다 — 위반은 "선언이
 * 과하다"(required 인데 없다) 와 "선언이 모자라다"(응답에 있는데 선언에 없다) **양쪽으로**
 * 난다.
 *
 * ## 중첩 DTO 까지 내려간다
 *
 * 최상위 키만 보면 **가장 위험한 형태를 통째로 놓친다.** 실제로 `GET /api/audit-logs` 는
 * `AuditLogUserDto`(id·name·email 3필드)를 광고하면서 raw `User` 엔티티를 실어
 * `passwordHash`·`totpRecoveryCodes`·`passwordResetToken` 등 **26개 키**를 응답에
 * 내보내고 있었다. 최상위에서 보면 `user` 키 하나가 선언대로 있을 뿐이라 통과한다.
 *
 * 그래서 프로퍼티 스키마가 `$ref`(또는 `allOf` 안의 `$ref`)로 다른 DTO 를 가리키면 그
 * DTO 의 스키마로 **내려가서** 같은 규칙을 적용한다. 배열이면 원소마다 내려간다. 위반의
 * `property` 에는 `user.passwordHash` · `items[0].id` 처럼 경로가 찍힌다.
 *
 * 판별자 없는 `oneOf`/`anyOf`(저장소가 `ExecutionStatusDto.context` 에서 쓰는 형태)는 **약한
 * 판정**을 쓴다 — 어느 변형인지 모르므로 `required` 는 강제하지 않고 **어느 변형에도 없는
 * 키**만 문다. 과다 노출은 정확히 그 형태라 이 판정으로도 걸린다.
 */
export type ContractViolationKind =
  | 'missing' // required 인데 키가 없다
  | 'null' // null 이 허용되지 않는데 null 이다
  | 'undeclared' // 스키마가 모르는 키가 응답에 있다
  | 'invalid-payload'; // 대조 대상이 애초에 객체가 아니다

export interface ContractViolation {
  /** 최상위는 필드명, 중첩은 `user.passwordHash` · `items[0].id` 같은 경로. */
  readonly property: string;
  readonly kind: ContractViolationKind;
  readonly detail: string;
}

/** 프로퍼티 스키마에서 이 검증자가 의존하는 축만 추린 뷰. */
interface PropertyContract {
  readonly nullable?: boolean;
  readonly $ref?: string;
  readonly allOf?: readonly PropertyContract[];
  readonly oneOf?: readonly PropertyContract[];
  readonly anyOf?: readonly PropertyContract[];
  readonly items?: PropertyContract;
}

export interface ContractCheckOptions {
  /**
   * 스키마에 없는 키를 위반으로 보지 않을 이름들. 중첩은 경로로 적는다(`user.legacy`).
   *
   * **넓게 쓰지 말 것** — 이 목록에 넣는 순간 그 필드는 "문서화되지 않았다" 는 사실이
   * 가려진다. 정당한 용례는 응답 래퍼가 얹는 필드처럼 **그 DTO 의 계약이 아닌** 키다.
   */
  readonly allowUndeclared?: readonly string[];
}

/**
 * DTO 하나의 계약 — **이름과 스키마와 `$ref` 해소용 스키마 맵**을 함께 들고 다닌다.
 *
 * 이름을 여기 담는 이유: 호출부가 DTO 클래스와 문자열을 **두 번** 적으면 클래스를
 * 리네임해도 컴파일러가 문자열 불일치를 못 잡아 실패 메시지가 조용히 낡는다. 이름은
 * `Dto.name` 에서 파생할 수 있는 값이므로 호출부에서 받지 않는다.
 */
export interface DtoContract {
  readonly name: string;
  readonly schema: SwaggerSchemaObject;
  /** 생성 문서의 `components.schemas` 전체 — 중첩 `$ref` 를 해소하는 데 쓴다. */
  readonly schemas: Readonly<Record<string, SwaggerSchemaObject>>;
}

function propertiesOf(
  schema: SwaggerSchemaObject,
): Record<string, PropertyContract> {
  return schema.properties ?? {};
}

/**
 * 이 프로퍼티가 가리키는 DTO 이름들.
 *
 * `$ref` 와 `allOf` 는 **하나**를 낸다(합성이라 한 형태로 수렴한다). `oneOf`/`anyOf` 는
 * **여럿**을 낸다 — 판별자가 없으면 어느 변형인지 알 수 없으므로 호출부가 그 사실을 알고
 * 약한 판정을 쓴다.
 */
function referencedNames(prop: PropertyContract): string[] {
  if (prop.$ref) {
    const name = prop.$ref.split('/').pop();
    return name ? [name] : [];
  }
  for (const member of prop.allOf ?? []) {
    const names = referencedNames(member);
    if (names.length > 0) return names;
  }
  const union = prop.oneOf ?? prop.anyOf;
  if (union) return union.flatMap((m) => referencedNames(m));
  return [];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 순회 내내 바뀌지 않는 것들 + 누산기.
 *
 * `out` 의 `readonly` 는 **재대입 금지**이지 불변이 아니다 — 순회가 여기에 `push` 한다.
 */
interface Walk {
  readonly contract: DtoContract;
  readonly allowUndeclared: ReadonlySet<string>;
  readonly out: ContractViolation[];
}

function join(prefix: string, name: string): string {
  return prefix ? `${prefix}.${name}` : name;
}

/**
 * 프로퍼티 값이 다른 DTO 를 가리키면 그 스키마로 내려간다.
 *
 * **무한 재귀를 막는 것은 payload 이지 스키마가 아니다.** 재귀는 payload 를 따라 내려가고
 * HTTP 응답은 파싱된 JSON 이라 비순환·유한이므로 스스로 끝난다. 자기참조 스키마
 * (`A.a: A`)는 그 자체로 순환이 아니다 — 값이 어느 깊이에서 반드시 끊긴다.
 *
 * 처음엔 **스키마 이름**을 방문 집합으로 썼는데, 그러면 자기참조 DTO 의 중첩이 "이미 밟은
 * 것" 으로 취급돼 **내부가 통째로 검사되지 않고 통과**했다 (`review/code/2026/09/05/14_39_31`
 * C1 — 실측: 1단계·2단계 위반 모두 `[]`). 검증자가 조용히 거짓 통과를 내는 것은 이 도구가
 * 애초에 잡으려던 결함과 같은 클래스다.
 *
 * 그래서 방문 집합은 **현재 경로에 있는 payload 객체의 동일성**으로 둔다. 이것이 진짜
 * 위험(메모리 안에서 만든 자기참조 객체)을 막으면서 스키마 재귀는 열어 둔다.
 */
function descend(
  value: unknown,
  prop: PropertyContract,
  path: string,
  walk: Walk,
  onPath: ReadonlySet<object>,
): void {
  if (Array.isArray(value)) {
    const itemProp = prop.items;
    if (!itemProp) return;
    value.forEach((element, i) =>
      descend(element, itemProp, `${path}[${i}]`, walk, onPath),
    );
    return;
  }

  if (!isPlainObject(value) || onPath.has(value)) return;

  const names = referencedNames(prop);
  if (names.length === 0) return;

  const nested = names
    .map((n) => walk.contract.schemas[n])
    .filter((x): x is SwaggerSchemaObject => Boolean(x));
  if (nested.length === 0) return;

  const deeper = new Set(onPath).add(value);

  if (nested.length === 1) {
    visit(value, nested[0], path, walk, deeper);
    return;
  }

  // `oneOf`/`anyOf` — 어느 변형인지 판별자 없이는 알 수 없다. 그래서 `required` 는 강제하지
  // 않고, **어느 변형에도 없는 키**만 undeclared 로 문다. 이 도구가 잡으려는 엔티티 패스스루
  // 과다 노출은 어느 변형에도 없는 키로 나타나므로 이 약한 판정으로도 걸린다.
  visitUnion(value, nested, path, walk, deeper);
}

function visit(
  body: Record<string, unknown>,
  schema: SwaggerSchemaObject,
  prefix: string,
  walk: Walk,
  onPath: ReadonlySet<object>,
): void {
  const props = propertiesOf(schema);
  const required = new Set(schema.required ?? []);

  for (const [name, prop] of Object.entries(props)) {
    const path = join(prefix, name);
    const present = Object.hasOwn(body, name);
    const value = body[name];
    const nullable = prop.nullable === true;
    const isRequired = required.has(name);

    if (!present || value === undefined) {
      if (isRequired) {
        walk.out.push({
          property: path,
          kind: 'missing',
          detail: 'required 로 선언됐는데 응답에 없다',
        });
      }
      // 키 생략형은 없어도 된다 (§5.4).
      continue;
    }

    if (value === null) {
      if (!nullable) {
        walk.out.push({
          property: path,
          kind: 'null',
          detail: isRequired
            ? 'nullable 선언 없이 null 이다 (§5.4)'
            : '키 생략형(required 아님)인데 null 이 왔다 — §5.4 는 이 조합을 금지한다',
        });
      }
      continue;
    }

    descend(value, prop, path, walk, onPath);
  }

  for (const name of Object.keys(body)) {
    const path = join(prefix, name);
    if (name in props || walk.allowUndeclared.has(path)) continue;
    walk.out.push({
      property: path,
      kind: 'undeclared',
      detail: '응답에 있는데 DTO 가 선언하지 않았다',
    });
  }
}

/**
 * 판별자 없는 `oneOf`/`anyOf` 아래를 본다.
 *
 * 어느 변형인지 모르므로 `required` 는 **강제하지 않는다** — 변형 A 의 required 를 변형 B
 * 인 값에 요구하면 거짓 위반이 난다. 대신 **어느 변형에도 선언되지 않은 키**만 문다.
 * 이 도구가 잡으려는 엔티티 패스스루 과다 노출은 정확히 그 형태로 나타난다.
 *
 * 더 내려가지는 않는다 — 어느 변형의 스키마로 내려가야 하는지가 정해지지 않기 때문이다.
 */
function visitUnion(
  body: Record<string, unknown>,
  variants: readonly SwaggerSchemaObject[],
  prefix: string,
  walk: Walk,
  _onPath: ReadonlySet<object>,
): void {
  const declared = new Set(
    variants.flatMap((v) => Object.keys(propertiesOf(v))),
  );
  for (const name of Object.keys(body)) {
    const path = join(prefix, name);
    if (declared.has(name) || walk.allowUndeclared.has(path)) continue;
    walk.out.push({
      property: path,
      kind: 'undeclared',
      detail: 'oneOf/anyOf 의 어느 변형에도 선언되지 않은 키다',
    });
  }
}

/**
 * 위반 목록을 돌려준다 — 비어 있으면 응답이 선언과 맞는다.
 *
 * 단언이 아니라 **목록**을 돌려주는 이유: 한 응답에서 여러 필드가 어긋날 수 있고, 첫
 * 위반에서 멈추면 나머지를 보려고 테스트를 여러 번 돌려야 한다.
 *
 * 반환 순서는 **`property` 알파벳순**이다. 발견 순서로 내면 스키마 프로퍼티 순서에
 * 실패 메시지가 흔들려 diff 를 읽기 어렵다.
 */
export function findContractViolations(
  payload: unknown,
  contract: DtoContract,
  options: ContractCheckOptions = {},
): ContractViolation[] {
  if (!isPlainObject(payload)) {
    const shape =
      payload === null
        ? 'null'
        : Array.isArray(payload)
          ? 'array'
          : typeof payload;
    return [
      {
        property: '(payload)',
        kind: 'invalid-payload',
        detail: `객체가 아니다: ${shape}`,
      },
    ];
  }

  const walk: Walk = {
    contract,
    allowUndeclared: new Set(options.allowUndeclared ?? []),
    out: [],
  };
  visit(payload, contract.schema, '', walk, new Set([payload]));
  return walk.out.sort((a, b) => a.property.localeCompare(b.property));
}

/** 위반 목록을 사람이 읽는 한 덩어리로. 실패 메시지가 곧 진단이 되게 한다. */
export function formatViolations(
  dtoName: string,
  violations: readonly ContractViolation[],
): string {
  const lines = violations.map(
    (v) => `  - ${v.property} [${v.kind}] ${v.detail}`,
  );
  return `${dtoName} 응답이 선언과 어긋난다 (${violations.length}건):\n${lines.join('\n')}`;
}

/**
 * 어긋나면 **무엇이 왜 어긋났는지**를 담아 던진다.
 *
 * 호출부가 `expect(findContractViolations(...)).toEqual([])` 를 쓰면 실패 메시지가 객체
 * 배열 diff 로 나온다 — 읽을 수는 있지만 필드가 여럿이면 눈으로 훑기 어렵다. 이 함수는
 * 한 줄로 쓰면서 실패 메시지가 곧 진단이 되게 한다.
 */
export function assertMatchesContract(
  payload: unknown,
  contract: DtoContract,
  options: ContractCheckOptions = {},
): void {
  const violations = findContractViolations(payload, contract, options);
  if (violations.length > 0) {
    throw new Error(formatViolations(contract.name, violations));
  }
}

/**
 * DTO 하나의 **생성된 OpenAPI 계약**을 얻는다.
 *
 * 스텁 컨트롤러를 세우는 보일러플레이트가 스펙마다 반복되지 않도록 여기서 감싼다 —
 * 호출부는 DTO 클래스만 넘긴다. `buildSwaggerDocument` 가 스키마 생성의 SoT 이고 이
 * 함수는 그 위의 편의다.
 *
 * **`beforeAll` 에서 한 번 부르고 결과를 재사용할 것.** 호출마다 Nest 테스트 모듈을
 * 통째로 부트스트랩하므로 `it()` 안에서 반복 호출하면 값이 같은데도 비용만 든다.
 */
export async function contractForDto(Dto: Type<unknown>): Promise<DtoContract> {
  @Controller('__contract_probe__')
  class ProbeController {
    @Get()
    @ApiOkResponse({ type: Dto })
    probe(): unknown {
      return null;
    }
  }

  const doc = await buildSwaggerDocument({ controllers: [ProbeController] });
  return {
    name: Dto.name,
    schema: schemaOf(doc, Dto.name),
    schemas: schemasOf(doc),
  };
}
