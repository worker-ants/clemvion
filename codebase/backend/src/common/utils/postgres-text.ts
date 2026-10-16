import {
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
 * `varchar(n)` 컬럼 필드에는 `@MaxLength(n)` 과 함께 쓴다. `@MaxLength` 는 변형 선택자(U+FE0E · U+FE0F)를
 * 앞 글자와 묶어 한 글자로 세서 코드 포인트 n 개를 넘는 값도 통과시킨다. PostgreSQL 은 그 값을 거부한다
 * (SQLSTATE 22001). `@MaxLength(n)` 을 지우지 않는 이유는 Swagger 플러그인이 그 값으로 OpenAPI 스키마의
 * `maxLength` 를 만들기 때문이다. JSON Schema 의 `maxLength` 도 코드 포인트로 센다.
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
