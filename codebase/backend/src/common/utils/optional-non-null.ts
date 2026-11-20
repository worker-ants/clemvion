import { IsDefined, ValidateIf, type ValidationOptions } from 'class-validator';

/**
 * 생략은 허용하되 `null` 은 거부한다 — PATCH 부분 본문에서 **NOT NULL 컬럼**이나 JSONB 설정 키처럼 `null` 에 줄 뜻이 없는 필드에 `@IsOptional()` 대신 쓴다.
 *
 * `@IsOptional()` 은 값이 `undefined` **또는 `null`** 이면 그 속성의 다른 검증기를 전부 건너뛴다. 그래서 `{ name: null }` 이
 * `@IsString()` 을 지나 엔티티에 병합되고, 저장 때 Postgres NOT NULL 위반(23502)이 나 전역 예외 필터가 500 으로 답했다. 이
 * 데코레이터는 `undefined`(키 생략 = 값 불변)일 때만 검증을 건너뛰고, `null` 이면 검증을 돌려 400 `VALIDATION_ERROR` 로 거부한다.
 * 필터에 23502 매핑을 넣지 않는 이유 — 500 은 «어느 입구가 검증을 빠뜨렸다» 는 알람이고 저장소 전략은 입구마다 조기 거부다.
 *
 * PATCH 의 `null` 계약은 둘이고 기준은 «`null` 말고 그 값을 지울 다른 방법이 있는가» 다. 기준의 정본은
 * [HTTP API 규약 §5.5](CLE-API-CONV-RESP#55-부재-표현-null-과-키-생략) 다.
 * - **거부**(이 데코레이터): NOT NULL 컬럼, 다른 값으로 지울 수 있는 JSONB 설정 키처럼 `null` 에 줄 뜻이 없는 필드.
 *   예: 알림 설정 키, 웹채팅 외형 필드, `chatChannel.languageHints`.
 * - **해제**: `null` 말고는 값을 지울 방법이 없는 필드. 이 데코레이터를 쓰지 않는다. `@IsOptional()` + `nullable: true` 로 받고
 *   서비스가 `null` 을 저장하지 않고 키를 지운다. 예: 워크스페이스 · 워크플로우 `settings.maxConcurrentExecutions`
 *   (`workflows.service.ts` `dropNullSettingKeys`), 트리거 타입 필드 `notification` · `interaction`
 *   (`triggers.service.ts` `mergeExternalConfig`).
 *
 * 같은 «생략 가능 · null 불가» 조합을 **응답** 쪽에서 강제하는 것은 `shared/testing/response-contract.ts`(§5.5 — 키 생략형 필드에
 * null 이 오면 위반)다. 이쪽은 **요청** DTO 의 입구 검증이다. 부분 본문을 엔티티에 병합하는 쪽의 짝은 `omit-undefined.ts` 다.
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
