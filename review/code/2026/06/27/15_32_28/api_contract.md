# API 계약(API Contract) 리뷰 결과

## 리뷰 범위

3개 파일 중 API 계약 관점과 관련 있는 파일은 1개입니다.

- `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — 분석 대상
- `plan/complete/web-chat-loader-queue-replay-arguments.md` — plan 문서, API 계약 무관
- `plan/in-progress/refactor/02-architecture.md` — plan 문서, API 계약 무관

---

## 발견사항

### [WARNING] `listModels` 엔드포인트: `ParseEnumPipe` 추가로 새로운 400 경로 발생했으나 Swagger 미문서화
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts`, `GET :id/models` 핸들러
- 상세: 이번 diff 에서 `@Query('type')` 에 `ParseEnumPipe(['chat', 'embedding'], { optional: true })` 가 추가됐다. 이로 인해 `type=invalid_value` 같은 규격 외 값이 전달되면 NestJS 가 400 Bad Request 를 반환하는 새로운 에러 경로가 생겼다. 그러나 `listModels` 핸들러에는 `@ApiBadRequestResponse` 데코레이터가 없어 Swagger 문서가 이 400 응답을 기술하지 않는다. `previewModels` 는 동일한 400 경로에 대해 `@ApiBadRequestResponse({ description: '자격증명 검증 실패 또는 Provider 호출 실패' })` 를 이미 문서화하고 있어 같은 컨트롤러 내 일관성도 어긋난다. (참고: `testConnection` 의 `ParseUUIDPipe` 미문서 400 은 이번 diff 이전 pre-existing 사안이며 본 변경의 범위 밖.)
- 제안: `listModels` 핸들러에 `@ApiBadRequestResponse({ description: '유효하지 않은 type 파라미터 (허용값: chat | embedding)' })` 를 추가한다.

### [INFO] `ParseEnumPipe` 에 TypeScript enum 대신 배열 리터럴 사용
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts`, L221
- 상세: NestJS `ParseEnumPipe` 의 공식 관용 패턴은 TypeScript `enum` 타입(`new ParseEnumPipe(MyEnum)`)을 첫 인자로 받는다. 이번 변경은 `['chat', 'embedding']` 배열을 전달했다. NestJS 내부적으로 `Object.values(enumType)` 를 사용하므로 배열을 넘겨도 `Object.values(['chat', 'embedding'])` 가 `['chat', 'embedding']` 을 반환해 런타임 동작은 동일하다. 다만 TypeScript 레벨에서 enum 타입 안전성이 활성화되지 않고(제네릭 `T` 추론 불가), NestJS 공식 문서에 없는 사용 패턴이라 향후 NestJS 내부 구현 변경 시 암묵적 의존이 깨질 여지가 있다. 현재로서는 기능상 문제없으나 비관용적 사용이다.
- 제안: `enum ModelType { chat = 'chat', embedding = 'embedding' }` 를 별도 파일 또는 해당 DTO 내에 정의하고 `new ParseEnumPipe(ModelType, { optional: true })` 로 교체하면 타입 안전성과 관용 패턴이 동시에 확보된다.

### [INFO] `ParseEnumPipe` 추가로 인한 잠재적 behavioral change (spec-compliant 클라이언트 무영향)
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts`, `GET :id/models`
- 상세: 변경 이전에는 `type=foo` 처럼 허용되지 않은 값을 전달하면 TypeScript 타입 어노테이션이 런타임에 강제되지 않아 서비스 레이어까지 해당 값이 전달됐다. 변경 이후에는 400 Bad Request 로 즉시 거부된다. Swagger `@ApiQuery` 데코레이터가 이미 `enum: ['chat', 'embedding']` 을 문서화하고 있었으므로 스펙 준수 클라이언트에게는 breaking change 가 아니다. 다만 문서 외 값을 사용하던 클라이언트는 영향을 받으며, 이런 클라이언트 존재 가능성에 대한 사전 파악이 권장된다.
- 제안: 사전 확인이 어렵다면 릴리즈 노트 또는 Changelog 에 "listModels API - 유효하지 않은 type 파라미터를 명시적으로 거부" 를 기재하는 것이 바람직하다.

---

## 요약

이번 diff 의 API 계약 관련 변경은 두 가지다. 첫째, `@Throttle` 인라인 리터럴을 상수 `PROVIDER_PROBE_THROTTLE` 로 추출한 순수 DRY 리팩터링으로, 클라이언트 observable behavior 에 변화가 없다. 둘째, `listModels` 의 `?type` 쿼리 파라미터에 `ParseEnumPipe` 를 추가해 런타임 유효성 검증을 강화한 것으로, 이 역시 스펙 준수 클라이언트에게는 영향이 없다. 다만 새로 발생한 400 에러 경로가 Swagger 에 문서화되지 않아 같은 컨트롤러 내 `previewModels` 와 일관성이 어긋나는 점이 유일한 계약 문서 갭이다. 전반적으로 이번 변경은 기존 API 계약을 강화하는 방향이며 하위 호환성 파괴에 해당하지 않는다.

---

## 위험도

LOW
