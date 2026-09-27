import { IsDefined, ValidateIf, type ValidationOptions } from 'class-validator';

/**
 * 생략은 허용하되 `null` 은 거부한다 — PATCH 부분 본문에서 **NOT NULL 컬럼**에 대응하는 필드에 `@IsOptional()` 대신 쓴다.
 *
 * `@IsOptional()` 은 값이 `undefined` **또는 `null`** 이면 그 속성의 다른 검증기를 전부 건너뛴다. 그래서 `{ name: null }` 이
 * `@IsString()` 을 지나 엔티티에 병합되고, 저장 때 Postgres NOT NULL 위반(23502)이 나 전역 예외 필터가 500 으로 답했다. 이
 * 데코레이터는 `undefined`(키 생략 = 값 불변)일 때만 검증을 건너뛰고, `null` 이면 검증을 돌려 400 `VALIDATION_ERROR` 로 거부한다.
 * 필터에 23502 매핑을 넣지 않는 이유 — 500 은 «어느 입구가 검증을 빠뜨렸다» 는 알람이고 저장소 전략은 입구마다 조기 거부다.
 *
 * 쓰지 말아야 할 자리: 컬럼이 nullable 이고 `null` 이 «값을 지운다» 는 뜻인 필드 — 거기는 `@IsOptional()` + `nullable: true` 가
 * 맞다(API 규약 §5.4 의 PATCH tri-state).
 */
export function IsOptionalNonNull(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    const property = propertyKey as string;
    ValidateIf((_, value) => value !== undefined, validationOptions)(
      target,
      property,
    );
    IsDefined({
      message:
        '$property must not be null — omit the field to keep the current value',
      ...validationOptions,
    })(target, property);
  };
}
