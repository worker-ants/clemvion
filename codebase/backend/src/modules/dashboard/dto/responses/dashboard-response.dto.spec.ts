import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';

import {
  buildSwaggerDocument,
  propertyOf,
  schemaOf,
  type SwaggerSchemaObject,
} from '../../../../shared/testing/swagger-probe';
import { ExecutionStatus } from '../../../executions/entities/execution.entity';
import { ExecutionDto } from '../../../executions/dto/responses/execution-response.dto';
import { RecentExecutionDto } from './dashboard-response.dto';

/**
 * 대시보드 최근 실행(`RecentExecutionDto`)의 OpenAPI 스키마 회귀 가드.
 *
 * `status` 는 실행 상태를 그대로 싣는다. 그래서 광고하는 enum 이 실행 상태 전체(`ExecutionStatus`)와
 * 같아야 한다. 종전에는 손으로 적은 다섯 값이라 `waiting_for_input` 이 빠져 있었다(CLE-T-F9GHKP).
 * 실행 응답(`ExecutionDto.status`)과 같은 이름의 스키마를 가리키는지도 함께 본다. 상수를 공유하면 한쪽에만
 * 값을 더하는 drift 가 생기지 않는다.
 *
 * 계약 근거: [대시보드](CLE-OBS-DASHBOARD) 「최근 실행」 · [OpenAPI 문서화 「nested, enum, union」](CLE-API-SWAGGER-DTO#1-4-nested-enum-union)
 */
@Controller('stub')
class StubController {
  @Get('recent')
  @ApiOkResponse({ type: RecentExecutionDto })
  recent(): RecentExecutionDto {
    return null as never;
  }

  @Get('execution')
  @ApiOkResponse({ type: ExecutionDto })
  execution(): ExecutionDto {
    return null as never;
  }
}

/**
 * 프로퍼티가 가리키는 이름 붙은 스키마의 이름. `enumName` 을 준 enum 은 `allOf: [{ $ref }]` 로 나온다
 * (`example` 같은 형제 키를 함께 둘 수 있게). 이름 붙은 스키마가 아니면 `null`.
 */
function refNameOf(schema: SwaggerSchemaObject): string | null {
  const s = schema as { $ref?: string; allOf?: Array<{ $ref?: string }> };
  const ref = s.$ref ?? (s.allOf?.length === 1 ? s.allOf[0].$ref : undefined);
  return ref ? ref.replace('#/components/schemas/', '') : null;
}

/** 이름 붙은 스키마를 가리키면 그 스키마를, 아니면 그 자리 스키마를 돌려준다. */
function resolve(
  doc: OpenAPIObject,
  schema: SwaggerSchemaObject,
): SwaggerSchemaObject {
  const name = refNameOf(schema);
  return name ? schemaOf(doc, name) : schema;
}

describe('RecentExecutionDto — OpenAPI 스키마', () => {
  let doc: OpenAPIObject;

  beforeAll(async () => {
    doc = await buildSwaggerDocument({ controllers: [StubController] });
  });

  it('status enum 은 실행 상태 전체(waiting_for_input 포함)다', () => {
    const status = resolve(
      doc,
      propertyOf(doc, 'RecentExecutionDto', 'status'),
    );
    expect([...(status.enum ?? [])].sort()).toEqual(
      Object.values(ExecutionStatus).sort(),
    );
    expect(status.enum).toContain(ExecutionStatus.WAITING_FOR_INPUT);
  });

  it('status 는 실행 응답과 같은 ExecutionStatus 스키마를 가리킨다', () => {
    const recent = refNameOf(propertyOf(doc, 'RecentExecutionDto', 'status'));
    expect(recent).toBe('ExecutionStatus');
    expect(recent).toBe(refNameOf(propertyOf(doc, 'ExecutionDto', 'status')));
  });
});
