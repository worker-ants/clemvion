import { BadRequestException } from '@nestjs/common';
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomValidationPipe } from './validation.pipe';

class InnerDto {
  @IsString()
  @IsIn(['apple', 'banana'])
  fruit: string;
}

class OuterDto {
  @IsString()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InnerDto)
  items: InnerDto[];
}

describe('CustomValidationPipe', () => {
  const pipe = new CustomValidationPipe();
  const meta = { metatype: OuterDto, type: 'body' as const };

  it('returns the transformed instance when validation passes', async () => {
    const result = await pipe.transform(
      { name: 'ok', items: [{ fruit: 'apple' }] },
      meta,
    );
    expect(result).toBeInstanceOf(OuterDto);
  });

  it('emits path-qualified details for nested array errors', async () => {
    try {
      await pipe.transform(
        { name: 'ok', items: [{ fruit: 'apple' }, { fruit: 'cherry' }] },
        meta,
      );
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as {
        code: string;
        details: { field: string; message: string; code: string }[];
      };
      expect(body.code).toBe('VALIDATION_ERROR');
      const leaf = body.details.find((d) => d.field.includes('items[1].fruit'));
      expect(leaf).toBeDefined();
      expect(leaf!.message).not.toBe('');
      expect(leaf!.message).toMatch(/must be one of/i);
      expect(leaf!.code).toBe('INVALID_FIELD');
    }
  });

  it('emits details for a top-level field error', async () => {
    try {
      await pipe.transform({ name: 123, items: [{ fruit: 'apple' }] }, meta);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as {
        details: { field: string; message: string }[];
      };
      const detail = body.details.find((d) => d.field === 'name');
      expect(detail).toBeDefined();
      expect(detail!.message).not.toBe('');
    }
  });
});

/**
 * ## `forbidNonWhitelisted` — 알 수 없는 키를 **거절**한다
 *
 * 파이프가 `whitelist: true` + `forbidNonWhitelisted: true` 로 돌기 때문에, DTO 에 없는
 * 키는 조용히 벗겨지는 것이 아니라 **400 이 된다.** 이 축을 단언하는 테스트가 없었다
 * (리뷰 `18_34_04` W2).
 *
 * 없으면 무엇을 놓치나 — **DTO 에서 필드를 지우는 것이 곧 공개 계약 변경**이라는 사실이다.
 * 2026-09-04 에 `QueryExecutionDto.workflowId`(죽은 파라미터)를 제거했고, 그 순간
 * `?workflowId=…` 를 보내던 요청은 `200`(무시됨) → `400` 이 됐다. 그 동작을 고정하는
 * 자동화가 저장소 어디에도 없었다.
 */
describe('CustomValidationPipe — forbidNonWhitelisted', () => {
  const pipe = new CustomValidationPipe();

  class NarrowDto {
    @IsString()
    known: string;
  }

  it('DTO 에 없는 키가 오면 400 이다 — 조용히 벗기지 않는다', async () => {
    await expect(
      pipe.transform(
        { known: 'ok', removedParam: 'anything' },
        { metatype: NarrowDto, type: 'query' as const },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('[대조군] 알려진 키만 오면 통과한다 — 위 단언이 공허하지 않다', async () => {
    const result = await pipe.transform(
      { known: 'ok' },
      { metatype: NarrowDto, type: 'query' as const },
    );
    expect(result).toBeInstanceOf(NarrowDto);
  });
});
