import { describe, it, expect, beforeAll } from '@jest/globals';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';

import {
  buildSwaggerDocument,
  schemasOf,
  type SwaggerSchemaObject,
} from '../../../../shared/testing/swagger-probe';
import { ExecutionDetailDto, ExecutionDto } from './execution-response.dto';
import * as path from 'node:path';
import { findOptionalNullableResponseFields } from '../../../../repo-guards/__tests__/swagger-dto-contract-guard';

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
 * 계약 SoT: [HTTP API 규약 「부재 표현: null 과 키 생략」](CLE-API-CONV#55-부재-표현-null-과-키-생략) ·
 * [OpenAPI 문서화](CLE-API-SWAGGER)
 */
@Controller('stub')
class StubController {
  @Get()
  @ApiOkResponse({ type: ExecutionDto })
  find(): ExecutionDto {
    return null as never;
  }

  @Get('detail')
  @ApiOkResponse({ type: ExecutionDetailDto })
  detail(): ExecutionDetailDto {
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

/**
 * `@ApiProperty({ nullable: true })` — §5.5 의 기본형(키는 늘 있고 값은 `null` 일 수 있다).
 *
 * 2026-11-14 까지 `triggerLabel` 을 뺀 10개는 `@ApiPropertyOptional({ nullable: true })`
 * (§5.5 가 응답 바디에서 금지하는 조합)였고 이 파일이 그 drift 를 고정했다. 다섯 응답
 * (목록 · 상세 · 중지 · 체인 · 재실행)이 모두 `ExecutionsService.toResponseExecution` 으로
 * 키를 빠짐없이 조립하게 되면서 기본형으로 갚았다(CLE-T-GA8ZXQ).
 */
const REQUIRED_NULLABLE = [
  'activeRunningMs',
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
  'triggerLabel',
];

describe('ExecutionDto — OpenAPI 스키마 (§5.5)', () => {
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
  it('[전제] 두 목록이 광고된 프로퍼티를 빠짐없이 덮는다', () => {
    expect(Object.keys(properties).sort()).toEqual(
      [...REQUIRED_NON_NULLABLE, ...REQUIRED_NULLABLE].sort(),
    );
  });

  /**
   * 저장소 전수 래칫(`swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT`)이
   * 쓰는 바로 그 스캐너를 이 파일에 물린다. 이 파일의 어느 클래스든 금지 조합이 다시
   * 들어오면 여기서 걸린다. 0건 단언만으로는 스캐너가 이 파일을 건너뛰어도 통과하므로
   * 같은 스캐너가 양성 대조군 fixture 에서는 위반을 집는지 함께 묻는다.
   */
  it('전수 래칫 스캐너가 이 파일에서 금지 조합을 하나도 보지 않는다', () => {
    const srcRoot = path.resolve(__dirname, '..', '..', '..', '..');
    expect(
      findOptionalNullableResponseFields(
        [path.join(__dirname, 'execution-response.dto.ts')],
        srcRoot,
      ),
    ).toEqual([]);

    const fixture = path.join(
      srcRoot,
      'repo-guards',
      '__tests__',
      'fixtures',
      'dto',
      'responses',
      'optional-nullable.fixture.ts',
    );
    expect(
      findOptionalNullableResponseFields([fixture], srcRoot).length,
    ).toBeGreaterThan(0);
  });

  it('required 목록이 프로퍼티 전체다 — 하나라도 optional 로 되돌아가면 여기서 걸린다', () => {
    expect((execution.required ?? []).slice().sort()).toEqual(
      [...REQUIRED_NON_NULLABLE, ...REQUIRED_NULLABLE].sort(),
    );
  });

  it('nullable 선언이 붙은 필드가 정확히 REQUIRED_NULLABLE 이다', () => {
    const nullable = Object.entries(properties)
      .filter(([, v]) => v.nullable === true)
      .map(([k]) => k)
      .sort();
    expect(nullable).toEqual([...REQUIRED_NULLABLE].sort());
  });

  it.each(REQUIRED_NON_NULLABLE)(
    '%s 는 required 이고 nullable 선언이 없다',
    (name) => {
      expect(execution.required).toContain(name);
      expect(properties[name].nullable).toBeUndefined();
    },
  );

  it.each(REQUIRED_NULLABLE)(
    '%s 는 required + nullable — §5.5 의 기본형(null-present)',
    (name) => {
      expect(execution.required).toContain(name);
      expect(properties[name].nullable).toBe(true);
    },
  );

  it('status 는 enum 참조로 광고된다 — 문자열로 넓어지면 소비자 narrowing 이 사라진다', () => {
    expect(Object.keys(schemas)).toContain('ExecutionStatus');
  });

  /**
   * 상세 · 재실행 · WS 스냅샷 모양(`ExecutionDetailDto`)과 그 노드 실행 항목.
   * 노드 참조는 `{ id, type, label }` 세 필드만 선언한다(CLE-T-TTE3RS 결정 (b)).
   * 노드 설정(`config`) · 좌표와 사용자 행동 기록(`interactionData`)은 선언하지 않는다.
   */
  describe('ExecutionDetailDto · NodeExecutionSummaryDto', () => {
    const propsOf = (name: string) =>
      (schemas[name]?.properties ?? {}) as Record<string, SwaggerSchemaObject>;

    it('상세는 ExecutionDto 필드에 executionPathTruncated · nodeExecutions 를 더한다', () => {
      const detail = schemas.ExecutionDetailDto;
      expect(Object.keys(propsOf('ExecutionDetailDto')).sort()).toEqual(
        [
          ...REQUIRED_NON_NULLABLE,
          ...REQUIRED_NULLABLE,
          'executionPathTruncated',
          'nodeExecutions',
        ].sort(),
      );
      expect(detail.required).toEqual(
        expect.arrayContaining(['executionPathTruncated', 'nodeExecutions']),
      );
    });

    it('노드 실행 항목의 키 집합 — 모두 required, 부재는 null', () => {
      const node = schemas.NodeExecutionSummaryDto;
      const props = propsOf('NodeExecutionSummaryDto');
      expect(Object.keys(props).sort()).toEqual(
        [
          'id',
          'executionId',
          'nodeId',
          'node',
          'status',
          'startedAt',
          'finishedAt',
          'durationMs',
          'inputData',
          'outputData',
          'error',
          'retryCount',
          'parentNodeExecutionId',
        ].sort(),
      );
      expect((node.required ?? []).slice().sort()).toEqual(
        Object.keys(props).sort(),
      );
      expect(
        Object.entries(props)
          .filter(([, v]) => v.nullable === true)
          .map(([k]) => k)
          .sort(),
      ).toEqual(
        [
          'durationMs',
          'error',
          'finishedAt',
          'inputData',
          'outputData',
          'parentNodeExecutionId',
        ].sort(),
      );
    });

    it('노드 참조는 id · type · label 세 필드다', () => {
      expect(Object.keys(propsOf('ExecutionNodeRefDto')).sort()).toEqual([
        'id',
        'label',
        'type',
      ]);
      expect(
        (schemas.ExecutionNodeRefDto.required ?? []).slice().sort(),
      ).toEqual(['id', 'label', 'type']);
    });
  });
});
