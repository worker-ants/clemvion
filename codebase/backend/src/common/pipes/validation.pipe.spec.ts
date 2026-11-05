import { BadRequestException } from '@nestjs/common';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Socket } from 'socket.io';
import { CustomValidationPipe, UNVALIDATED_METATYPES } from './validation.pipe';
import { Setup2faDto } from '../../modules/auth/dto/totp.dto';

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
 * `@ConnectedSocket() client: Socket` 은 `custom` 인자로 오고, 설계 타입이 `Socket` 클래스라
 * 목록에 걸리지 않는다. 실제 소켓은 `@nestjs/platform-socket.io` 가 고정한 socket.io 사본의
 * 인스턴스라 백엔드가 import 한 `Socket` 의 인스턴스도 아니다. 이 값을 DTO 처럼 변환하면
 * `new Socket()` 이 던져 `subscribe` 가 `exception` 으로 끝났다.
 */
describe('CustomValidationPipe — 커스텀 데코레이터 인자', () => {
  const pipe = new CustomValidationPipe();

  class NarrowDto {
    @IsString()
    known: string;
  }

  it('다른 socket.io 사본의 소켓도 변환 · 검증하지 않고 같은 참조를 돌려준다', async () => {
    // 백엔드의 `Socket` 클래스로 만들지 않은 객체다. 런타임에 두 사본이 갈리는 상황과 같다.
    const socket = { id: 'socket-1', handshake: {} };
    await expect(
      pipe.transform(socket, { type: 'custom', metatype: Socket }),
    ).resolves.toBe(socket);
  });

  it('커스텀 인자는 설계 타입이 DTO 여도 검증하지 않는다', async () => {
    const value = { known: 'ok', extra: 1 };
    await expect(
      pipe.transform(value, { type: 'custom', metatype: NarrowDto }),
    ).resolves.toBe(value);
  });

  it('body 인자는 같은 값이면 거부한다 (WS 의 @MessageBody() 도 body 로 온다)', async () => {
    await expect(
      pipe.transform(
        { known: 'ok', extra: 1 },
        { type: 'body', metatype: NarrowDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

/**
 * 본문 없이 온 요청(CLE-T-GDBMF8). Express 는 Content-Type 이 없는 요청의 `req.body` 를 채우지 않아 `@Body()` 값이
 * `undefined` 로 온다. 예전에는 `validate(undefined)` 가 TypeError 를 던져 500 이 났다. 빈 객체로 보고 검증해 필수 필드가
 * 있는 DTO 는 400 `VALIDATION_ERROR`, 필드가 모두 선택인 DTO 는 통과한다(NestJS 기본 `ValidationPipe` 와 같다).
 */
describe('CustomValidationPipe — 값이 없는 본문', () => {
  const pipe = new CustomValidationPipe();

  class RequiredFieldDto {
    @IsString()
    password: string;
  }

  class AllOptionalDto {
    @IsOptional()
    @IsString()
    note?: string;
  }

  it.each([undefined, null])(
    '필수 필드가 있는 DTO 는 %p 를 400 VALIDATION_ERROR 로 거부한다',
    async (value) => {
      // 통과하면 돌려받은 인스턴스가 err 에 들어가 아래 instanceof 단언이 실패한다.
      const err: unknown = await pipe
        .transform(value, { type: 'body', metatype: RequiredFieldDto })
        .catch((err_: unknown) => err_);
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as {
        code: string;
        details: { field: string; code: string }[];
      };
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details.map((d) => d.field)).toContain('password');
    },
  );

  it.each([undefined, null])(
    '필드가 모두 선택인 DTO 는 %p 를 빈 인스턴스로 통과시킨다',
    async (value) => {
      await expect(
        pipe.transform(value, { type: 'body', metatype: AllOptionalDto }),
      ).resolves.toBeInstanceOf(AllOptionalDto);
    },
  );

  it('실제 DTO(2FA setup)도 본문이 없으면 400 으로 거부한다', async () => {
    await expect(
      pipe.transform(undefined, { type: 'body', metatype: Setup2faDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('검증하지 않는 설계 타입은 undefined 를 그대로 돌려준다', async () => {
    await expect(
      pipe.transform(undefined, { type: 'body', metatype: Object }),
    ).resolves.toBeUndefined();
  });
});
