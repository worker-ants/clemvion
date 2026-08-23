import 'reflect-metadata';
import { Controller, Post, Body } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiBody, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { ApiResponseSchemaHost, OpenAPIObject } from '@nestjs/swagger';
import { CustomValidationPipe } from '../../common/pipes/validation.pipe';
import { WorkflowsController } from './workflows.controller';
import { ExecuteWorkflowDto } from './dto/execute-workflow.dto';

// SchemaObject 는 swagger 가 공개 export 하지 않는다 — 자매 스펙
// (`external-interaction/dto/responses/interact-ack-response.dto.spec.ts`) 과 같은 방식으로
// 공개 타입에서 파생한다.
type SchemaObject = ApiResponseSchemaHost['schema'];

/**
 * `POST /workflows/:id/execute` 의 **본문 계약이 좁아지지 않았는지** 지키는 캐너리.
 *
 * 이 엔드포인트의 `@Body()` 는 인라인 객체 타입이라 전역 `CustomValidationPipe` 가
 * 검증을 통째로 건너뛴다 — 즉 여분 top-level 키를 함께 보내도 통과해 왔다.
 * `ExecuteWorkflowDto` 는 그 사실을 바꾸지 않고 **OpenAPI 스키마만** 제공하려고 만든 것이다.
 *
 * > **여기가 RED 면 문서 작업이 계약 변경으로 번진 것이다.** `@Body()` 파라미터 타입을
 * > `ExecuteWorkflowDto` 로 바꾸면 파이프가 진입하고 `forbidNonWhitelisted: true` 가 켜져
 * > 여분 키가 400 이 된다. 그렇게 **바꾸고 싶다면** 그건 공개 API 계약 축소라 별도 결정이
 * > 필요하다(트래커 항목 참조) — 이 테스트를 조용히 고쳐서 통과시키지 말 것.
 */
describe('POST /workflows/:id/execute 본문 계약', () => {
  /** `execute()` 의 `@Body()` 자리(마지막 파라미터)에 emit 된 설계 타입. */
  function executeBodyParamType(): unknown {
    const types = Reflect.getMetadata(
      'design:paramtypes',
      WorkflowsController.prototype,
      'execute',
    ) as unknown[] | undefined;
    if (!types || types.length === 0) {
      throw new Error('design:paramtypes 메타데이터가 없다 — 테스트 전제 붕괴');
    }
    return types[types.length - 1];
  }

  it('[캐너리] `@Body()` 파라미터는 DTO 로 타입되지 않는다 — 타입하면 파이프가 진입한다', () => {
    // 전제 확인 — 이 단언이 vacuous 하지 않으려면 메타데이터가 실제로 emit 돼야 한다.
    expect(executeBodyParamType()).toBeDefined();

    expect(executeBodyParamType()).toBe(Object);
    expect(executeBodyParamType()).not.toBe(ExecuteWorkflowDto);
  });

  it('[캐너리] 여분 top-level 키를 실은 본문도 파이프를 통과한다', async () => {
    const pipe = new CustomValidationPipe();
    const body = {
      parameterValues: { apiKey: 'real-value' },
      input: { parameters: { a: 1 } },
      // 문서에 없는 키 — 지금까지 조용히 무시돼 왔다.
      legacyClientField: 'ignored-so-far',
    };

    await expect(
      pipe.transform(body, {
        type: 'body',
        metatype: executeBodyParamType() as never,
      }),
    ).resolves.toEqual(body);
  });

  /**
   * 대조군 — 파이프 자체는 **멀쩡히 문다.** 위 테스트가 통과하는 이유가 "파이프가 고장나서"
   * 가 아니라 "이 자리에 metatype 이 `Object` 라서" 임을 못박는다.
   *
   * > 거부 범위가 넓다는 점이 중요하다(실측): 이 DTO 에는 class-validator 데코레이터가
   * > 하나도 없어 `validate()` 가 등록 메타데이터를 못 찾고 **빈 객체조차** 거부한다.
   * > 즉 파라미터 타입을 이 클래스로 바꾸면 "여분 키만" 깨지는 게 아니라 **모든 요청**이
   * > 깨진다.
   */
  it.each([
    ['정상 본문', { parameterValues: { a: 1 } }],
    ['여분 키 포함', { parameterValues: {}, legacyClientField: 'x' }],
    ['빈 객체', {}],
  ])(
    '[대조군] DTO 로 타입하면 파이프가 거부한다 — %s',
    async (_label, body) => {
      const pipe = new CustomValidationPipe();
      await expect(
        pipe.transform(body, { type: 'body', metatype: ExecuteWorkflowDto }),
      ).rejects.toMatchObject({
        response: { code: 'VALIDATION_ERROR' },
      });
    },
  );
});

/**
 * 이 PR 의 **목적** 자체를 지키는 가드 (`00_07_27` testing W3).
 *
 * 위 캐너리는 *"런타임 계약이 안 깨졌는가"* 만 본다. 그것만으로는 `@ApiBody` 가 형제
 * `ExecuteNodeDto` 를 잘못 참조하는 복붙 실수를 **아무도 못 잡는다** — 런타임은 어차피
 * 안 바뀌므로 전부 GREEN 이다. 그래서 문서 표면을 직접 단언한다.
 */
describe('POST /workflows/:id/execute OpenAPI 노출', () => {
  it('[가드] 실 컨트롤러의 `@ApiBody` 가 ExecuteWorkflowDto 를 참조한다', () => {
    const params = Reflect.getMetadata(
      'swagger/apiParameters',
      WorkflowsController.prototype.execute,
    ) as Array<Record<string, unknown>> | undefined;
    expect(params).toBeDefined();

    const bodyParam = (params ?? []).find((p) => p.in === 'body');
    expect(bodyParam).toBeDefined();
    // 형제 DTO 를 잘못 참조하면 여기서 죽는다.
    expect(bodyParam?.type).toBe(ExecuteWorkflowDto);
    // 본문은 선택 — 파라미터 없이 실행하는 워크플로가 정상 경로다.
    expect(bodyParam?.required).toBe(false);
  });

  describe('스키마 렌더링', () => {
    let schema: SchemaObject;

    beforeAll(async () => {
      @Controller('stub')
      class StubController {
        @Post()
        @ApiBody({ type: ExecuteWorkflowDto, required: false })
        run(@Body() _body?: unknown): void {}
      }

      const moduleRef = await Test.createTestingModule({
        controllers: [StubController],
      }).compile();
      const app = moduleRef.createNestApplication();
      await app.init();
      try {
        const doc: OpenAPIObject = SwaggerModule.createDocument(
          app,
          new DocumentBuilder().build(),
        );
        schema = (doc.components?.schemas as Record<string, SchemaObject>)
          .ExecuteWorkflowDto;
      } finally {
        await app.close();
      }
    });

    it('ExecuteWorkflowDto 가 components.schemas 에 등재된다', () => {
      expect(schema).toBeDefined();
    });

    it('두 필드 다 열린 map 으로 렌더링된다 (`additionalProperties: true`)', () => {
      for (const field of ['parameterValues', 'input'] as const) {
        const prop = schema.properties?.[field] as SchemaObject;
        expect(prop).toBeDefined();
        expect(prop.type).toBe('object');
        expect(prop.additionalProperties).toBe(true);
      }
    });

    /**
     * **`input` 은 deprecated 다** (2026-08-23 사용자 결정). 리네임 대신 이 표시로 동명이의를
     * 해소하기로 했으므로, 플래그가 조용히 사라지면 그 결정이 무효가 된다.
     *
     * `parameterValues` 는 preferred 경로라 **deprecated 가 아니어야** 한다 — 한쪽만 보면
     * "둘 다 deprecated" 로 바꿔도 통과한다.
     */
    it('[결정] `input` 만 deprecated 로 표시된다', () => {
      const input = schema.properties?.input as SchemaObject;
      const preferred = schema.properties?.parameterValues as SchemaObject;
      expect(input.deprecated).toBe(true);
      expect(preferred.deprecated).toBeFalsy();
    });

    /**
     * 이 PR 이 존재하는 이유 — 형제 `re-run` 과 달리 `execute` 에는 마커 예약어 제약을 적을
     * 자리가 없었다. **두 필드 모두** 같은 관문을 지나므로 양쪽에 적혀야 한다(W1).
     */
    it('[가드] 마커 거부 규칙이 두 필드 description 에 모두 드러난다', () => {
      for (const field of ['parameterValues', 'input'] as const) {
        const prop = schema.properties?.[field] as SchemaObject;
        expect(prop.description).toEqual(expect.stringContaining('마커'));
      }
    });
  });
});
