import { describe, it, expect, beforeAll } from '@jest/globals';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';

import {
  buildSwaggerDocument,
  schemasOf,
  type SwaggerSchemaObject,
} from '../../../../shared/testing/swagger-probe';
import { ExecutionDto } from './execution-response.dto';

/**
 * `ExecutionDto` 의 OpenAPI 스키마 표현 회귀 가드.
 *
 * ## 왜 스키마 레벨이 따로 필요한가
 *
 * `execution.e2e` 계열이 **실 응답 vs 선언**을 대조하지만(`assertMatchesContract`), 그것은
 * **선언을 기준**으로 값을 본다. 데코레이터와 TS 타입을 **동시에** optional 로 되돌리는
 * 회귀는 선언 자체가 함께 움직이므로 그 대조를 그대로 통과한다 — AST 가드도 `tsc` 도
 * 못 잡는다. 그래서 선언 자체를 고정하는 층이 하나 더 있어야 한다.
 *
 * `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 *"2단계 착수 시
 * `execution-status-response.dto.spec.ts` 패턴으로 신설한다"* 고 적어 둔 자리이고,
 * `ExecutionDto` 배선이 그 2단계 착수분이다 (`review/consistency/2026/09/05/15_31_43` W2).
 *
 * 계약 SoT: [API 규약 §5.4](../../../../../../../spec/5-system/2-api-convention.md) ·
 * [Swagger 규약](../../../../../../../spec/conventions/swagger.md)
 */
@Controller('stub')
class StubController {
  @Get()
  @ApiOkResponse({ type: ExecutionDto })
  find(): ExecutionDto {
    return null as never;
  }
}

/** `@ApiProperty()` — 키가 상시 존재하고 값도 `null` 이 아니다. */
const REQUIRED_NON_NULLABLE = [
  'completedNodeCount',
  'dryRun',
  'executionPath',
  'failedNodeCount',
  'id',
  'recursionDepth',
  'startedAt',
  'status',
  'totalNodeCount',
  'triggerSource',
  'workflowId',
];

/** `@ApiProperty({ nullable: true })` — §5.4 의 기본형(키 present, 값은 `null` 가능). */
const REQUIRED_NULLABLE = ['triggerLabel'];

/**
 * `@ApiPropertyOptional({ nullable: true })` — **§5.4 가 응답 바디에서 금지하는 조합**이다
 * (키 생략형에는 `| null` 을 붙이지 않는다). 이 10개는 트래커가 §5.4 drift 로 추적 중인
 * 기존 상태이고, 이 가드는 **고치는 것이 아니라 고정한다** — 값이 바뀌면 그것이 의도된
 * 정정인지 사고인지 이 목록의 diff 로 드러난다.
 *
 * > **저장소 전체 판은 따로 있다** — `repo-guards/__tests__/swagger-dto-contract.spec.ts`
 * > 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 가 응답 DTO **전수**를 훑어 같은 조합을 고정한다
 * > (78건). 아래 10개는 그 부분집합이므로, **한쪽만 상환하면 다른 쪽이 조용히 낡는다** —
 * > `ExecutionDto` 의 drift 를 갚을 때는 두 목록을 함께 줄여야 한다
 * > (`review/consistency/2026/09/05/19_08_19` W5).
 * >
 * > 이 목록을 남겨 두는 이유: 전수 래칫은 `<파일>:<클래스>.<필드>` 키만 고정하고
 * > **required/nullable 의 정확한 형태**는 보지 않는다. 아래 스펙은 그 형태까지 단언한다.
 */
const OPTIONAL_NULLABLE_DRIFT = [
  'chainId',
  'durationMs',
  'error',
  'executedBy',
  'finishedAt',
  'inputData',
  'outputData',
  'parentExecutionId',
  'reRunOf',
  'triggerId',
];

describe('ExecutionDto — OpenAPI 스키마 (§5.4)', () => {
  let schemas: Record<string, SwaggerSchemaObject>;
  let execution: SwaggerSchemaObject;
  let properties: Record<string, SwaggerSchemaObject>;

  beforeAll(async () => {
    const doc: OpenAPIObject = await buildSwaggerDocument({
      controllers: [StubController],
    });
    schemas = schemasOf(doc);
    execution = schemas.ExecutionDto;
    properties = (execution.properties ?? {}) as Record<
      string,
      SwaggerSchemaObject
    >;
  });

  /**
   * 아래 단언들이 전부 통과해도 스키마가 **비어 있으면** 아무것도 고정하지 않은 것이다.
   * 세 목록의 합이 광고된 프로퍼티 전체와 같은지를 먼저 묻는다.
   */
  it('[전제] 세 목록이 광고된 프로퍼티를 빠짐없이 덮는다', () => {
    expect(Object.keys(properties).sort()).toEqual(
      [
        ...REQUIRED_NON_NULLABLE,
        ...REQUIRED_NULLABLE,
        ...OPTIONAL_NULLABLE_DRIFT,
      ].sort(),
    );
  });

  it('required 목록이 정확히 12개다 — 하나라도 optional 로 되돌아가면 여기서 걸린다', () => {
    expect((execution.required ?? []).slice().sort()).toEqual(
      [...REQUIRED_NON_NULLABLE, ...REQUIRED_NULLABLE].sort(),
    );
  });

  it('nullable 선언이 붙은 필드가 정확히 11개다', () => {
    const nullable = Object.entries(properties)
      .filter(([, v]) => v.nullable === true)
      .map(([k]) => k)
      .sort();
    expect(nullable).toEqual(
      [...REQUIRED_NULLABLE, ...OPTIONAL_NULLABLE_DRIFT].sort(),
    );
  });

  it.each(REQUIRED_NON_NULLABLE)(
    '%s 는 required 이고 nullable 선언이 없다',
    (name) => {
      expect(execution.required).toContain(name);
      expect(properties[name].nullable).toBeUndefined();
    },
  );

  it.each(REQUIRED_NULLABLE)(
    '%s 는 required + nullable — §5.4 의 기본형(null-present)',
    (name) => {
      expect(execution.required).toContain(name);
      expect(properties[name].nullable).toBe(true);
    },
  );

  it.each(OPTIONAL_NULLABLE_DRIFT)(
    '%s 는 optional + nullable — §5.4 drift 로 추적 중인 기존 상태',
    (name) => {
      expect(execution.required ?? []).not.toContain(name);
      expect(properties[name].nullable).toBe(true);
    },
  );

  it('status 는 enum 참조로 광고된다 — 문자열로 넓어지면 소비자 narrowing 이 사라진다', () => {
    expect(Object.keys(schemas)).toContain('ExecutionStatus');
  });
});
