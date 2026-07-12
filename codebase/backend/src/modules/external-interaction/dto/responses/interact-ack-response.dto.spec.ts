import { Controller, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiOkResponse, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type {
  OpenAPIObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { InteractAckDto } from './interact-ack-response.dto';
import { EIA_EXECUTION_STATUS_VALUES } from './execution-status.literal';

/**
 * `InteractAckDto` 의 OpenAPI 스키마 표현 회귀 가드.
 *
 * `currentStatus` 는 `ExecutionStatusDto.status` 와 동일한 공유 SoT
 * (`EIA_EXECUTION_STATUS_VALUES`)를 쓴다 — 두 DTO 의 enum 배열이 갈라지지 않도록
 * (그리고 엔티티 상태 집합과도 어긋나지 않도록) 값을 직접 검증한다.
 *
 * 계약 SoT: [Swagger 규약 §1-4](../../../../../../../spec/conventions/swagger.md) ·
 * [EIA §5.1 / §5.4](../../../../../../../spec/5-system/14-external-interaction-api.md)
 */
@Controller('stub')
class StubController {
  @Post()
  @ApiOkResponse({ type: InteractAckDto })
  ack(): InteractAckDto {
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

describe('InteractAckDto — OpenAPI 스키마 (EIA §5.1 / §5.4)', () => {
  let interactAck: SchemaObject;

  beforeAll(async () => {
    const doc = await buildDocument();
    const schemas = doc.components?.schemas as Record<string, SchemaObject>;
    interactAck = schemas.InteractAckDto;
  });

  it('InteractAckDto 가 components.schemas 에 등재된다', () => {
    expect(interactAck).toBeDefined();
  });

  it('currentStatus.enum 이 공유 SoT 를 반영한다 (DTO↔SoT 참조; SoT 불변식은 execution-status.literal.spec)', () => {
    const currentStatus = interactAck.properties?.currentStatus as SchemaObject;
    expect(currentStatus.enum).toEqual([...EIA_EXECUTION_STATUS_VALUES]);
  });

  it('currentStatus 는 optional 이다 (명령 직후 미관측 가능)', () => {
    expect(interactAck.required ?? []).not.toContain('currentStatus');
  });
});
