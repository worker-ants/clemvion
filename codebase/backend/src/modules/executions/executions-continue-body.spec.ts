import 'reflect-metadata';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';

import { CustomValidationPipe } from '../../common/pipes/validation.pipe';
import {
  bodyParamDesignType,
  buildSwaggerDocument,
  schemaOf,
} from '../../shared/testing/swagger-probe';
import { ExecutionsController } from './executions.controller';
import { ContinueExecutionRequestDto } from './dto/continue-execution.dto';

/**
 * `POST /executions/:id/continue` 본문 — **문서만 광고하고 계약은 그대로**인지 지키는 캐너리.
 *
 * `@Body()` 는 인라인 객체 타입이라 전역 `CustomValidationPipe` 가 검증을 건너뛴다(폼 값 검증은 엔진이 폼 노드 정의로 한다).
 * `ContinueExecutionRequestDto` 는 OpenAPI 스키마만 제공한다 — 선례 `workflows/workflows-execute-body.spec.ts`.
 *
 * > **여기가 RED 면 문서 작업이 계약 변경으로 번진 것이다.** 이 테스트를 조용히 고쳐 통과시키지 말 것.
 */
describe('POST /executions/:id/continue 본문', () => {
  it('[캐너리] `@Body()` 파라미터는 DTO 로 타입되지 않는다 — 타입하면 파이프가 진입한다', () => {
    expect(bodyParamDesignType(ExecutionsController, 'continueExecution')).toBe(
      Object,
    );
  });

  it('[캐너리] 여분 키를 실은 본문도 파이프를 통과한다', async () => {
    const body = { formData: { name: 'a' }, legacyClientField: 'x' };
    await expect(
      new CustomValidationPipe().transform(body, {
        type: 'body',
        metatype: bodyParamDesignType(
          ExecutionsController,
          'continueExecution',
        ) as never,
      }),
    ).resolves.toStrictEqual(body);
  });

  it('[가드] 실 컨트롤러의 `@ApiBody` 가 ContinueExecutionRequestDto 를 가리키고 본문은 선택이다', () => {
    const params = Reflect.getMetadata(
      'swagger/apiParameters',
      ExecutionsController.prototype.continueExecution,
    ) as Array<Record<string, unknown>> | undefined;
    const bodyParam = (params ?? []).find((p) => p.in === 'body');
    expect(bodyParam?.type).toBe(ContinueExecutionRequestDto);
    // 본문 없이 이어 진행하는 폼(필드 0개)이 정상 경로다 — 핸들러도 `body?.formData` 로 읽는다.
    expect(bodyParam?.required).toBe(false);
  });

  it('[렌더] 스키마 — formData 하나, 선택 · 열린 map', async () => {
    @Controller('stub')
    class StubController {
      @Post()
      @ApiBody({ type: ContinueExecutionRequestDto, required: false })
      run(@Body() _body?: unknown): void {}
    }
    const doc = await buildSwaggerDocument({ controllers: [StubController] });
    const schema = schemaOf(doc, 'ContinueExecutionRequestDto');
    expect(Object.keys(schema.properties ?? {})).toStrictEqual(['formData']);
    expect(schema.required ?? []).toStrictEqual([]);
    const formData = schema.properties?.formData as
      { type?: string; additionalProperties?: unknown } | undefined;
    expect(formData?.type).toBe('object');
    expect(formData?.additionalProperties).toBe(true);
  });
});
