import { Controller, Get, type Type } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';

import {
  buildSwaggerDocument,
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
 * ## 판정 규칙 — `spec/5-system/2-api-convention.md` §5.4 를 그대로 옮긴 것
 *
 * | 스키마 선언 | 응답에 요구하는 것 |
 * |---|---|
 * | `required` + `nullable` 아님 | 키가 있고 값이 `null`/`undefined` 가 아니다 |
 * | `required` + `nullable` | 키가 있다. 값은 `null` 이어도 된다 |
 * | `required` 아님 (키 생략형) | 키가 없어도 된다. **있으면 `null` 이 아니어야 한다** — §5.4 가 키 생략 필드에 `\| null` 을 금지한다 |
 * | 스키마에 없는 키 | 응답이 **문서화되지 않은 필드**를 싣고 있다 |
 *
 * 마지막 행이 반대 방향이다. §5.4 위반은 "선언이 과하다"(required 인데 없다) 와
 * "선언이 모자라다"(응답에 있는데 선언에 없다) **양쪽으로** 난다.
 */
export type ContractViolationKind =
  | 'missing' // required 인데 키가 없다
  | 'null' // null 이 허용되지 않는데 null 이다
  | 'undeclared'; // 스키마가 모르는 키가 응답에 있다

export interface ContractViolation {
  readonly property: string;
  readonly kind: ContractViolationKind;
  readonly detail: string;
}

export interface ContractCheckOptions {
  /**
   * 스키마에 없는 키를 위반으로 보지 않을 이름들.
   *
   * **넓게 쓰지 말 것** — 이 목록에 넣는 순간 그 필드는 "문서화되지 않았다" 는 사실이
   * 가려진다. 정당한 용례는 응답 래퍼가 얹는 필드처럼 **그 DTO 의 계약이 아닌** 키다.
   */
  readonly allowUndeclared?: readonly string[];
}

/**
 * 위반 목록을 돌려준다 — 비어 있으면 응답이 선언과 맞는다.
 *
 * 단언이 아니라 **목록**을 돌려주는 이유: 한 응답에서 여러 필드가 어긋날 수 있고, 첫
 * 위반에서 멈추면 나머지를 보려고 테스트를 여러 번 돌려야 한다.
 */
export function findContractViolations(
  payload: unknown,
  schema: SwaggerSchemaObject,
  options: ContractCheckOptions = {},
): ContractViolation[] {
  if (payload === null || typeof payload !== 'object') {
    return [
      {
        property: '(payload)',
        kind: 'missing',
        detail: `객체가 아니다: ${payload === null ? 'null' : typeof payload}`,
      },
    ];
  }

  const body = payload as Record<string, unknown>;
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const allowUndeclared = new Set(options.allowUndeclared ?? []);
  const out: ContractViolation[] = [];

  for (const [name, prop] of Object.entries(props)) {
    const present = Object.hasOwn(body, name);
    const value = body[name];
    const nullable = prop.nullable === true;

    if (required.has(name)) {
      if (!present || value === undefined) {
        out.push({
          property: name,
          kind: 'missing',
          detail: 'required 로 선언됐는데 응답에 없다',
        });
        continue;
      }
      if (value === null && !nullable) {
        out.push({
          property: name,
          kind: 'null',
          detail: 'nullable 선언 없이 null 이다 (§5.4)',
        });
      }
      continue;
    }

    // 키 생략형: 없어도 되지만, 있으면 null 이 아니어야 한다 (§5.4 가 `| null` 을 금지).
    if (present && value === null && !nullable) {
      out.push({
        property: name,
        kind: 'null',
        detail:
          '키 생략형(required 아님)인데 null 이 왔다 — §5.4 는 이 조합을 금지한다',
      });
    }
  }

  for (const name of Object.keys(body)) {
    if (name in props || allowUndeclared.has(name)) continue;
    out.push({
      property: name,
      kind: 'undeclared',
      detail: '응답에 있는데 DTO 가 선언하지 않았다',
    });
  }

  return out.sort((a, b) => a.property.localeCompare(b.property));
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
export function assertMatchesDtoSchema(
  payload: unknown,
  schema: SwaggerSchemaObject,
  dtoName: string,
  options: ContractCheckOptions = {},
): void {
  const violations = findContractViolations(payload, schema, options);
  if (violations.length > 0) {
    throw new Error(formatViolations(dtoName, violations));
  }
}

/**
 * DTO 하나의 **생성된 OpenAPI 스키마**를 얻는다.
 *
 * 스텁 컨트롤러를 세우는 보일러플레이트가 스펙마다 반복되지 않도록 여기서 감싼다 —
 * 호출부는 DTO 클래스만 넘긴다. `buildSwaggerDocument` 가 스키마 생성의 SoT 이고 이
 * 함수는 그 위의 편의다.
 */
export async function schemaForDto(
  Dto: Type<unknown>,
): Promise<SwaggerSchemaObject> {
  @Controller('__contract_probe__')
  class ProbeController {
    @Get()
    @ApiOkResponse({ type: Dto })
    probe(): unknown {
      return null;
    }
  }

  const doc = await buildSwaggerDocument({ controllers: [ProbeController] });
  return schemaOf(doc, Dto.name);
}
