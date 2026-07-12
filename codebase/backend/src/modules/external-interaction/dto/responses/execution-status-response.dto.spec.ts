import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ApiOkResponse,
  DocumentBuilder,
  SwaggerModule,
  getSchemaPath,
} from '@nestjs/swagger';
import type {
  OpenAPIObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import {
  ButtonsContextDto,
  CurrentNodeDto,
  ExecutionStatusDto,
  NodeOutputContextDto,
} from './execution-status-response.dto';
import { EIA_EXECUTION_STATUS_VALUES } from './execution-status.literal';

/**
 * `ExecutionStatusDto` 의 OpenAPI 스키마 표현 회귀 가드.
 *
 * 실제 OpenAPI 문서를 생성해 검증한다 — 데코레이터 메타데이터만 읽으면 `@ApiExtraModels`
 * 누락으로 `$ref` 가 dangling 되는 경우를 놓친다 (variant 가 `components.schemas` 에 등재되지 않음).
 *
 * 계약 SoT: [Swagger 규약 §1-4](../../../../../../../spec/conventions/swagger.md) ·
 * [API 규약 §5.4](../../../../../../../spec/5-system/2-api-convention.md) ·
 * [EIA §5.3](../../../../../../../spec/5-system/14-external-interaction-api.md)
 */
@Controller('stub')
class StubController {
  @Get()
  @ApiOkResponse({ type: ExecutionStatusDto })
  find(): ExecutionStatusDto {
    return null as never;
  }
}

async function buildDocument(): Promise<OpenAPIObject> {
  const moduleRef = await Test.createTestingModule({
    controllers: [StubController],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  try {
    return SwaggerModule.createDocument(app, new DocumentBuilder().build());
  } finally {
    await app.close();
  }
}

describe('ExecutionStatusDto — OpenAPI 스키마 (EIA §5.3)', () => {
  let doc: OpenAPIObject;
  let schemas: Record<string, SchemaObject>;
  let executionStatus: SchemaObject;

  beforeAll(async () => {
    doc = await buildDocument();
    schemas = doc.components?.schemas as Record<string, SchemaObject>;
    executionStatus = schemas.ExecutionStatusDto;
  });

  it('variant DTO 가 components.schemas 에 등재된다 (@ApiExtraModels — dangling $ref 방지)', () => {
    expect(schemas.ButtonsContextDto).toBeDefined();
    expect(schemas.NodeOutputContextDto).toBeDefined();
    expect(schemas.CurrentNodeDto).toBeDefined();
  });

  it('context 는 두 variant 의 oneOf 다 (닫힌 union — Swagger 규약 §1-4)', () => {
    const context = executionStatus.properties?.context as SchemaObject;
    expect(context.oneOf).toEqual([
      { $ref: getSchemaPath(ButtonsContextDto) },
      { $ref: getSchemaPath(NodeOutputContextDto) },
    ]);
  });

  it('context 는 discriminator 를 선언하지 않는다 (interactionType 은 unsound 판별자)', () => {
    const context = executionStatus.properties?.context as SchemaObject & {
      discriminator?: unknown;
    };
    // buttons 는 buttonConfig 복원 실패 시 NodeOutputContextDto 변형으로 fallthrough 하므로
    // interactionType 으로 variant 를 narrowing 할 수 없다 (interaction.service.ts getStatus).
    expect(context.discriminator).toBeUndefined();
  });

  it('context 는 비-waiting 상태에서 null 이므로 nullable 이다', () => {
    const context = executionStatus.properties?.context as SchemaObject;
    expect(context.nullable).toBe(true);
  });

  it('context 는 additionalProperties 로 뭉개지지 않는다 (회귀 가드)', () => {
    const context = executionStatus.properties?.context as SchemaObject;
    expect(context.additionalProperties).toBeUndefined();
    // 열린 map 이면 `type: 'object'` 가 붙는다. oneOf 스키마에는 type 이 없다.
    expect(context.type).toBeUndefined();
  });

  it('currentNode 는 CurrentNodeDto 를 $ref 하고 nullable 이다', () => {
    const currentNode = executionStatus.properties?.currentNode as SchemaObject;
    expect(currentNode.nullable).toBe(true);
    // @nestjs/swagger 는 description 이 동반된 $ref 를 allOf 로 wrap 한다.
    expect(currentNode.allOf).toEqual([
      { $ref: getSchemaPath(CurrentNodeDto) },
    ]);
  });

  describe('부재 표현 — null vs 키 생략 (API 규약 §5.4)', () => {
    it.each([['ButtonsContextDto'], ['NodeOutputContextDto']])(
      '%s.conversationThread 는 키 생략 필드다 — optional 이며 nullable 이 아니다',
      (dtoName) => {
        const variant = schemas[dtoName];
        const thread = variant.properties?.conversationThread as SchemaObject;
        expect(thread).toBeDefined();
        // 키 생략(present-when-available) → required 아님 + nullable 아님.
        expect(variant.required ?? []).not.toContain('conversationThread');
        expect(thread.nullable).not.toBe(true);
      },
    );

    it.each([['result'], ['error']])(
      '%s 는 null 을 쓰는 형제 필드다 — nullable 이다',
      (field) => {
        const schema = executionStatus.properties?.[field] as SchemaObject;
        expect(schema.nullable).toBe(true);
      },
    );
  });

  describe('봉투만 스키마화 — 내부 payload 는 열린 map 으로 남는다', () => {
    it('NodeOutputContextDto.nodeOutput 은 additionalProperties 다', () => {
      const nodeOutput = schemas.NodeOutputContextDto.properties
        ?.nodeOutput as SchemaObject;
      expect(nodeOutput.type).toBe('object');
      expect(nodeOutput.additionalProperties).toBe(true);
    });

    it('ButtonsContextDto.buttonConfig 내부는 열려 있다', () => {
      const buttonConfig = schemas.ButtonsContextDto.properties
        ?.buttonConfig as SchemaObject;
      expect(buttonConfig.type).toBe('object');
    });

    it('ConversationThreadDto 를 만들지 않는다 (SoT = conversation-thread.md §1.3)', () => {
      expect(schemas.ConversationThreadDto).toBeUndefined();
    });
  });

  describe('variant 필수 필드', () => {
    it('ButtonsContextDto 는 interactionType/waitingNodeId/buttonConfig 를 요구한다', () => {
      const required = schemas.ButtonsContextDto.required ?? [];
      expect(required).toEqual(
        expect.arrayContaining([
          'interactionType',
          'waitingNodeId',
          'buttonConfig',
        ]),
      );
    });

    it('NodeOutputContextDto 는 interactionType/waitingNodeId/nodeOutput 을 요구한다', () => {
      const required = schemas.NodeOutputContextDto.required ?? [];
      expect(required).toEqual(
        expect.arrayContaining([
          'interactionType',
          'waitingNodeId',
          'nodeOutput',
        ]),
      );
    });
  });

  describe('status enum — 공유 SoT (EIA_EXECUTION_STATUS_VALUES)', () => {
    it('status.enum 이 공유 SoT 를 반영한다 (DTO↔SoT 참조; SoT 순서·집합 불변식은 execution-status.literal.spec)', () => {
      const status = executionStatus.properties?.status as SchemaObject;
      expect(status.enum).toEqual([...EIA_EXECUTION_STATUS_VALUES]);
    });
  });
});
