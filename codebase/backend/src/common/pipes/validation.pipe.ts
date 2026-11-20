import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';

/**
 * 이 설계 타입이면 검증하지 않고 값을 그대로 넘긴다 — 인라인 객체 타입 · 인터페이스 · `unknown` 본문이 여기 든다. 저장소 가드
 * `request-body-advertised` 가 **이 상수를 그대로** 써서 «문서도 스키마가 비는 자리» 를 센다([OpenAPI 라우트 데코레이터 「새 엔드포인트 체크리스트」](CLE-API-SWAGGER-ROUTE#5-4-새-엔드포인트-체크리스트)).
 *
 * 얼린다 — export 된 전역 목록이라 `readonly` 타입만으로는 런타임 변형(`.push`)을 막지 못한다. 이 목록이 늘면 그 타입의 본문은
 * 검증 없이 지나간다.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const UNVALIDATED_METATYPES: readonly Function[] = Object.freeze([
  String,
  Boolean,
  Number,
  Array,
  Object,
]);

interface ValidationDetail {
  field: string;
  message: string;
  code: 'INVALID_FIELD';
}

/**
 * 요청 인자를 DTO 클래스로 변환하고 class-validator 로 검증하는 전역 파이프(`APP_PIPE`).
 *
 * 검증하지 않고 값을 그대로 넘기는 경우는 둘이다.
 * - 커스텀 파라미터 데코레이터 인자(`type === 'custom'`). NestJS 기본 `ValidationPipe` 의
 *   `validateCustomDecorators: false` 와 같은 동작이다. WebSocket 게이트웨이의 `@ConnectedSocket()` 소켓이
 *   여기로 온다. 전역 파이프가 게이트웨이 인자에도 붙는 근거는 `common/utils/http-context.ts` 에 있다. 그 소켓은
 *   `@nestjs/platform-socket.io` 가 고정한 socket.io 사본의 인스턴스라 `instanceof Socket` 으로는 가려내지
 *   못해서 `type` 으로 가린다. `@MessageBody()` 는 `body` 로 오므로 계속 검증한다. HTTP 컨트롤러의 커스텀
 *   데코레이터 인자에도 같은 규칙이 걸린다. 그 값을 검증하려면 그 인자에 파이프를 직접 단다.
 * - 설계 타입이 없거나 {@link UNVALIDATED_METATYPES} 에 든 인자.
 */
@Injectable()
export class CustomValidationPipe implements PipeTransform<unknown> {
  async transform(
    value: unknown,
    { metatype, type }: ArgumentMetadata,
  ): Promise<unknown> {
    // 검증하지 않는 두 경우다. 근거는 클래스 JSDoc 에 있다.
    if (type === 'custom' || !metatype || !this.toValidate(metatype)) {
      return value;
    }
    // 값이 없으면 빈 객체로 보고 검증한다(CLE-T-GDBMF8). Express 는 Content-Type 없이 온 요청의 `req.body` 를
    // 채우지 않아 `@Body()` 값이 `undefined` 다. 그대로 넘기면 `validate(undefined)` 가 TypeError 를 던져 500 이
    // 났다. 이제 필수 필드가 있으면 400 `VALIDATION_ERROR`, 모두 선택이면 빈 인스턴스로 통과한다. NestJS 기본
    // `ValidationPipe` 의 `toEmptyIfNil` 과 같은 처리다.
    const plain = value === undefined || value === null ? {} : value;
    const object = plainToInstance(
      metatype,
      plain as Record<string, unknown>,
    ) as object;
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      const details = this.flattenErrors(errors);
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        details,
      });
    }
    return object;
  }

  /**
   * Recursively walks `ValidateNested` error trees and returns one entry per
   * leaf constraint. Path segments keep array indices (`nodes[3].type`) so the
   * caller can identify exactly which item failed.
   */
  private flattenErrors(
    errors: ValidationError[],
    parentPath = '',
  ): ValidationDetail[] {
    const out: ValidationDetail[] = [];
    for (const error of errors) {
      const segment = this.joinPath(parentPath, error.property);
      if (error.constraints) {
        for (const message of Object.values(error.constraints)) {
          out.push({ field: segment, message, code: 'INVALID_FIELD' });
        }
      }
      if (error.children && error.children.length > 0) {
        out.push(...this.flattenErrors(error.children, segment));
      }
    }
    return out;
  }

  private joinPath(parent: string, property: string): string {
    if (!parent) return property;
    return /^\d+$/.test(property)
      ? `${parent}[${property}]`
      : `${parent}.${property}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private toValidate(metatype: Function): boolean {
    return !UNVALIDATED_METATYPES.includes(metatype);
  }
}
