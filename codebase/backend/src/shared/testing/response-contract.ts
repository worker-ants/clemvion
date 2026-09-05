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
 * 앞 세 행은 `spec/5-system/2-api-convention.md` §5.4 를 그대로 옮긴 것이고, **넷째 행은
 * §5.4 에 없는 이 검증자의 확장**이다 — spec 은 "부재를 어떻게 표기하는가" 를 정할 뿐
 * "선언되지 않은 키가 응답에 있으면 안 된다" 고는 말하지 않는다. 그 행이 잡는 것이
 * 엔티티 패스스루의 과다 노출이므로 여기서만 더 엄격하게 문다.
 *
 * | 스키마 선언 | 응답에 요구하는 것 | 출처 |
 * |---|---|---|
 * | `required` + `nullable` 아님 | 키가 있고 값이 `null`/`undefined` 가 아니다 | §5.4 |
 * | `required` + `nullable` | 키가 있다. 값은 `null` 이어도 된다 | §5.4 |
 * | `required` 아님 (키 생략형) | 키가 없어도 된다. 있으면 `null` 이 아니어야 한다 — **단 스키마가 `nullable` 도 함께 선언했으면 `null` 을 허용한다** | §5.4 |
 * | 스키마에 없는 키 | 응답이 **문서화되지 않은 필드**를 싣고 있다 | 이 검증자의 확장 |
 *
 * 마지막 행이 반대 방향이다. 위반은 "선언이 과하다"(required 인데 없다) 와 "선언이
 * 모자라다"(응답에 있는데 선언에 없다) **양쪽으로** 난다.
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

/** `$ref` 또는 `allOf` 안의 `$ref` 가 가리키는 DTO 이름. 없으면 `undefined`. */
function referencedName(prop: PropertyContract): string | undefined {
  if (prop.$ref) return prop.$ref.split('/').pop();
  for (const member of prop.allOf ?? []) {
    const name = referencedName(member);
    if (name) return name;
  }
  return undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
 * 순환 참조(`A.b: B`, `B.a: A`)에서 무한히 내려가지 않도록 **현재 경로에서 이미 밟은 DTO
 * 이름**을 들고 다닌다. 형제 가지는 서로 막지 않는다 — 같은 DTO 가 여러 필드에 나오는
 * 것은 순환이 아니다.
 */
function descend(
  value: unknown,
  prop: PropertyContract,
  path: string,
  walk: Walk,
  seen: readonly string[],
): void {
  if (Array.isArray(value)) {
    const itemProp = prop.items;
    if (!itemProp) return;
    value.forEach((element, i) =>
      descend(element, itemProp, `${path}[${i}]`, walk, seen),
    );
    return;
  }

  const name = referencedName(prop);
  if (!name || seen.includes(name)) return;
  const nested = walk.contract.schemas[name];
  if (!nested || !isPlainObject(value)) return;

  visit(value, nested, path, walk, [...seen, name]);
}

function visit(
  body: Record<string, unknown>,
  schema: SwaggerSchemaObject,
  prefix: string,
  walk: Walk,
  seen: readonly string[],
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

    descend(value, prop, path, walk, seen);
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
  visit(payload, contract.schema, '', walk, [contract.name]);
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
