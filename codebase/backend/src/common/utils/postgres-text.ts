import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  MaxLength,
  ValidateBy,
  buildMessage,
  type ValidationOptions,
} from 'class-validator';

/**
 * PostgreSQL 텍스트 컬럼(`text` · `varchar(n)`)이 저장하지 못하는 문자열을 DTO 입구에서 거부하는 검증기.
 *
 * 이런 값이 검증을 지나 저장에서 실패하면 전역 예외 필터가 500 으로 답한다. 이 저장소는 그런 값을 입구마다
 * 400 `VALIDATION_ERROR` 로 미리 거부한다. `optional-non-null.ts` 가 NOT NULL 컬럼에 쓰는 전략과 같다.
 */

/** PostgreSQL 텍스트 타입은 NUL 문자(`\u0000`)를 저장하지 못한다(SQLSTATE 22021). */
export function hasNoNulCharacter(value: unknown): boolean {
  return typeof value === 'string' && !value.includes('\u0000');
}

/** 문자열의 유니코드 코드 포인트 수. 서로게이트 쌍은 하나로 센다. */
export function codePointLength(value: string): number {
  let count = 0;
  for (const _codePoint of value) count += 1;
  return count;
}

/** `varchar(n)` 처럼 길이를 코드 포인트로 셀 때 `max` 이하인지 본다. */
export function hasAtMostCodePoints(value: unknown, max: number): boolean {
  return typeof value === 'string' && codePointLength(value) <= max;
}

/** NUL 문자가 든 문자열을 거부한다. 문자열이 아니어도 거부한다. */
export function HasNoNulCharacter(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'hasNoNulCharacter',
      validator: {
        validate: (value: unknown): boolean => hasNoNulCharacter(value),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must not contain a NUL character`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

/**
 * 코드 포인트가 `max` 개를 넘는 문자열을 거부한다. 문자열이 아니어도 거부한다.
 *
 * `varchar(n)` 컬럼 필드에는 이 검증기를 따로 붙이지 않고 {@link PostgresVarchar} 를 쓴다. `@MaxLength(n)` 은
 * 변형 선택자(U+FE0E · U+FE0F)를 앞 글자와 묶어 한 글자로 세서 코드 포인트 n 개를 넘는 값도 통과시킨다.
 * PostgreSQL 은 그 값을 거부한다(SQLSTATE 22001).
 */
export function MaxCodePoints(
  max: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'maxCodePoints',
      constraints: [max],
      validator: {
        validate: (value: unknown): boolean => hasAtMostCodePoints(value, max),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must have at most $constraint1 Unicode code points`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

/**
 * `varchar(max)` 컬럼에 저장하는 문자열 필드에 붙인다. 숫자 하나로 다음 넷을 함께 건다.
 *
 * - `@MaxLength(max)`: 변형 선택자를 앞 글자와 묶어 센다. 평문이 넘치면 `maxLength` 위반으로 답한다.
 * - `@MaxCodePoints(max)`: 코드 포인트로 센다. PostgreSQL `varchar` 가 세는 방식이다.
 * - `@HasNoNulCharacter()`: NUL 문자를 거부한다.
 * - `@ApiProperty({ maxLength: max })`: OpenAPI 스키마의 `maxLength`. JSON Schema 의 `maxLength` 도 코드 포인트로 센다.
 *
 * `@MaxLength` 를 합성 안에 넣으면 Nest Swagger CLI 플러그인(`classValidatorShim`)이 소스 AST 에서 `MaxLength`
 * 이름을 찾지 못해 스키마의 `maxLength` 를 만들지 못한다. 그래서 `ApiProperty` 를 합성 안에서 직접 건다. 필드의
 * `@ApiProperty({ description })` 와는 값이 합쳐진다.
 *
 * `MinLength` · `IsString` · `IsOptional` 은 필드마다 달라 따로 붙인다.
 */
export function PostgresVarchar(max: number): PropertyDecorator {
  return applyDecorators(
    MaxLength(max),
    MaxCodePoints(max),
    HasNoNulCharacter(),
    ApiProperty({ maxLength: max }),
  );
}
