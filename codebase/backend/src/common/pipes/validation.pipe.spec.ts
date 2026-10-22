import { BadRequestException } from '@nestjs/common';
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Socket } from 'socket.io';
import { CustomValidationPipe, UNVALIDATED_METATYPES } from './validation.pipe';

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
 * `forbidNonWhitelisted` — unknown keys are REJECTED, not silently stripped.
 *
 * The pipe runs with `whitelist: true` + `forbidNonWhitelisted: true`, so a key that the
 * DTO does not declare produces a 400 rather than being quietly dropped. Nothing asserted
 * that axis before.
 *
 * What it lets slip without this: the fact that **removing a field from a DTO is itself a
 * public contract change.** `QueryExecutionDto.workflowId` (a dead parameter) was removed
 * on 2026-09-04, and from that moment a request carrying `?workflowId=…` went from `200`
 * (ignored) to `400`. No automated test pinned that behaviour.
 *
 * Tracking: `plan/in-progress/spec-draft-nullable-notation-followups.md` §후속.
 */
describe('CustomValidationPipe — forbidNonWhitelisted', () => {
  const pipe = new CustomValidationPipe();

  class NarrowDto {
    @IsString()
    known: string;
  }

  const narrowMeta = { metatype: NarrowDto, type: 'query' as const };

  it('rejects a key the DTO does not declare', async () => {
    try {
      await pipe.transform(
        { known: 'ok', removedParam: 'anything' },
        narrowMeta,
      );
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as {
        code: string;
      };
      expect(body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('accepts declared keys only — proves the assertion above is not vacuous', async () => {
    const result = await pipe.transform({ known: 'ok' }, narrowMeta);
    expect(result).toBeInstanceOf(NarrowDto);
  });
});

describe('UNVALIDATED_METATYPES', () => {
  it('얼려 있다 — export 된 전역 목록이 런타임에 늘면 그 타입의 본문이 검증 없이 지나간다', () => {
    expect(Object.isFrozen(UNVALIDATED_METATYPES)).toBe(true);
  });

  it('파이프는 이 목록의 설계 타입이면 검증하지 않고 값을 그대로 넘긴다', async () => {
    const pipe = new CustomValidationPipe();
    const value = { anything: 1 };
    for (const metatype of UNVALIDATED_METATYPES) {
      await expect(
        pipe.transform(value, { type: 'body', metatype: metatype as never }),
      ).resolves.toBe(value);
    }
  });
});

/**
 * NestJS 12 부터 APP_PIPE 가 WebSocket 게이트웨이 핸들러의 인자에도 붙는다. 게이트웨이의
 * `@ConnectedSocket() client: Socket` 은 설계 타입이 `Socket` 클래스라 목록에 걸리지 않고,
 * 값은 요청 본문이 아니라 프레임워크가 넘긴 소켓 객체다. 이것을 DTO 처럼 변환 · 검증하면
 * 핸들러가 소켓 대신 사본을 받거나 검증 예외로 끝난다.
 */
describe('CustomValidationPipe — 이미 선언 타입의 인스턴스인 값', () => {
  const pipe = new CustomValidationPipe();

  it('WS 소켓 인자는 변환 · 검증하지 않고 같은 참조를 돌려준다', async () => {
    const socket = Object.assign(Object.create(Socket.prototype) as Socket, {
      id: 'socket-1',
    });
    await expect(
      pipe.transform(socket, { type: 'custom', metatype: Socket }),
    ).resolves.toBe(socket);
  });

  it('plain 객체는 같은 설계 타입이어도 여전히 검증한다 — 위 단언이 vacuous 하지 않다', async () => {
    class NarrowDto {
      @IsString()
      known: string;
    }
    await expect(
      pipe.transform(
        { known: 'ok', extra: 1 },
        { type: 'custom', metatype: NarrowDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
