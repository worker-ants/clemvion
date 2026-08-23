import { Controller, Module, Post } from '@nestjs/common';
import {
  ApiBody,
  type ApiResponseSchemaHost,
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { Test } from '@nestjs/testing';

import { ReRunRequestDto } from './re-run.dto';

// SchemaObject 는 swagger 가 공개 export 하지 않는다 — 자매 스펙
// (`workflows/workflows-execute-body.spec.ts`) 과 같은 방식으로 공개 타입에서 파생한다.
type SchemaObject = ApiResponseSchemaHost['schema'];

/**
 * `inputOverride` 가 **열린 map** 으로 광고되는지 고정한다.
 *
 * ## 왜 메타데이터가 아니라 생성 문서를 보나
 *
 * 종전 축약형(`type: Object`)과 다수 패턴(`type: 'object' + additionalProperties: true`)은
 * **프로퍼티 메타데이터가 다르다** — 축약형은 그 단계에서 `type` 이 아예 없다. 그것만 보면
 * "타입을 광고하지 않는다" 고 오판하는데, `createDocument` 까지 돌리면 축약형도
 * `type: object` 로 **해석된다**. 실제 차이는 그 아래 한 칸이다:
 *
 * | 형태 | 생성 스키마 |
 * |---|---|
 * | `type: Object` | `{ type: 'object', description }` — `additionalProperties` **없음** |
 * | `type: 'object' + additionalProperties: true` | `{ …, additionalProperties: true }` |
 *
 * OpenAPI 검증 의미는 같지만(부재 시 기본 허용) **생성기**는 전자를 "선언된 프로퍼티가 없는
 * 닫힌 모델" 로 읽어 빈 인터페이스를 만든다. 열린 map 이라는 의도가 클라이언트에 전달되지
 * 않는 것이 이 캐너리가 막는 회귀다.
 */
@Controller('probe')
class ProbeController {
  @Post('re-run')
  @ApiBody({ type: ReRunRequestDto })
  reRun(): void {}
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('ReRunRequestDto — OpenAPI 노출', () => {
  let inputOverride: SchemaObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    try {
      const doc: OpenAPIObject = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().build(),
      );
      const dto = (doc.components?.schemas as Record<string, SchemaObject>)
        .ReRunRequestDto;
      inputOverride = (dto.properties ?? {}).inputOverride as SchemaObject;
    } finally {
      await app.close();
    }
  });

  it('[캐너리] `inputOverride` 를 **열린 map** 으로 광고한다', () => {
    expect(inputOverride.type).toBe('object');
    // 이 한 칸이 축약형과 다수 패턴을 가르는 지점이다.
    expect(inputOverride.additionalProperties).toBe(true);
  });

  it('[가드] 마커 거부 캐비엇을 description 에 싣는다 (EIA §R17)', () => {
    // 이 diff 가 바꾼 문구는 아니다 — 같은 프로퍼티의 **기존** 계약을 함께 고정한다.
    expect(String(inputOverride.description)).toContain(
      'MASKED_VALUE_RESUBMITTED',
    );
  });
});
