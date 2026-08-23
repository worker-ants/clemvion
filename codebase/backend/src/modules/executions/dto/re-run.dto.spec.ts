import { Controller, Module, Post } from '@nestjs/common';
import { ApiBody, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';

import { ReRunRequestDto } from './re-run.dto';

/**
 * `inputOverride` 가 **열린 map** 으로 광고되는지 고정한다.
 *
 * ## 왜 메타데이터가 아니라 생성 문서를 보나
 *
 * 종전 축약형(`type: Object`)과 다수 패턴(`type: 'object' + additionalProperties: true`)은
 * **프로퍼티 메타데이터가 다르다** — 축약형은 그 단계에서 `type` 이 아예 없다. 그것만 보면
 * "타입이 없다" 고 오판하는데, `createDocument` 까지 돌리면 축약형도 `type: object` 로
 * **해석된다**. 실제 차이는 그 아래 한 칸이다:
 *
 * | 형태 | 생성 스키마 |
 * |---|---|
 * | `type: Object` | `{ type: 'object', description }` — `additionalProperties` **없음** |
 * | `type: 'object' + additionalProperties: true` | `{ type: 'object', description, additionalProperties: true }` |
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
  let schema: Record<string, unknown>;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();
    const app = mod.createNestApplication();
    await app.init();
    const doc = SwaggerModule.createDocument(app, {
      openapi: '3.0.0',
      info: { title: 'probe', version: '1' },
      paths: {},
    } as never);
    await app.close();
    const dto = (doc.components?.schemas ?? {})['ReRunRequestDto'] as Record<
      string,
      unknown
    >;
    schema = (dto?.properties ?? {}) as Record<string, unknown>;
  });

  it('[캐너리] `inputOverride` 를 **열린 map** 으로 광고한다', () => {
    const p = schema.inputOverride as Record<string, unknown>;
    expect(p.type).toBe('object');
    // 이 한 칸이 축약형과 다수 패턴을 가르는 지점이다.
    expect(p.additionalProperties).toBe(true);
  });

  it('마커 거부 캐비엇을 description 에 싣는다 (EIA §R17)', () => {
    const p = schema.inputOverride as Record<string, unknown>;
    expect(String(p.description)).toContain('MASKED_VALUE_RESUBMITTED');
  });
});
