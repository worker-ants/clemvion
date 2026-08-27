import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty } from '@nestjs/swagger';

import {
  buildSwaggerDocument,
  propertyOf,
  schemaOf,
  schemasOf,
} from './swagger-probe';

/**
 * 이 헬퍼의 **존재 이유는 에러 경로**다 — 네 스펙이 반복하던 `as Record<…>` 캐스팅은
 * DTO 이름을 틀리면 `undefined` 를 내고 다음 줄이 **설명 없는 `TypeError`** 로 죽었다.
 *
 * 행복 경로는 네 소비처 스펙이 이미 매 실행마다 검증하므로 여기서 다시 세지 않는다.
 * 여기서 고정하는 것은 *"틀렸을 때 무엇을 말해 주는가"* 이고, 그게 없으면 이 헬퍼는
 * 캐스팅을 한 곳에 모았을 뿐 **아무것도 개선하지 않은 것**이 된다.
 */
class SampleDto {
  @ApiProperty({ type: String })
  name!: string;
}

@Controller('probe')
class ProbeController {
  @Get()
  @ApiOkResponse({ type: SampleDto })
  get(): SampleDto {
    return null as never;
  }
}

@Controller('empty')
class EmptyController {
  @Get()
  get(): void {}
}

describe('swagger-probe — 에러 경로', () => {
  describe('DTO 를 참조하는 프로브', () => {
    let doc: Awaited<ReturnType<typeof buildSwaggerDocument>>;

    beforeAll(async () => {
      doc = await buildSwaggerDocument({ controllers: [ProbeController] });
    });

    it('[전제] 행복 경로가 실제로 동작한다 (아래 단언들이 공허해지지 않도록)', () => {
      expect(schemaOf(doc, 'SampleDto')).toBeDefined();
      expect(propertyOf(doc, 'SampleDto', 'name').type).toBe('string');
    });

    it('없는 DTO 이름이면 **생성된 이름 목록**을 담아 던진다', () => {
      expect(() => schemaOf(doc, 'NoSuchDto')).toThrow(/NoSuchDto/);
      // 오타를 그 자리에서 고칠 수 있어야 한다 — 후보를 함께 싣는지.
      expect(() => schemaOf(doc, 'NoSuchDto')).toThrow(/SampleDto/);
    });

    it('없는 프로퍼티면 **광고된 프로퍼티 목록**을 담아 던진다', () => {
      expect(() => propertyOf(doc, 'SampleDto', 'nope')).toThrow(/nope/);
      expect(() => propertyOf(doc, 'SampleDto', 'nope')).toThrow(/name/);
    });
  });

  it('DTO 를 하나도 참조하지 않는 프로브면 원인을 지목해 던진다', async () => {
    const doc = await buildSwaggerDocument({ controllers: [EmptyController] });
    // 실측: `createDocument` 는 이 경우 `{"schemas":{}}` 를 낸다 — `components` 가
    // `undefined` 인 상태는 도달하지 않는다. 도달하는 것은 **빈 레코드**다.
    expect(() => schemasOf(doc)).toThrow(/등재된 DTO 스키마가 없다/);
  });
});
