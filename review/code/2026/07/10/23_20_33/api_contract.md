# API 계약(API Contract) 리뷰

대상: `GET /api/external/executions/:id` (`ExecutionStatusDto`) 응답 스키마 정밀화 — `context`/`currentNode`/`result`/`error` 를 `additionalProperties: true` 뭉개기에서 닫힌 `oneOf` variant DTO 로 전환 + `spec/conventions/swagger.md` §1-4 개정 + `spec/5-system/2-api-convention.md` §5.4(부재 표현) 신설.

## 발견사항

- **[INFO]** `oneOf` variant 간 상호 배타성이 스키마 레벨에서 강제되지 않음
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` — `ButtonsContextDto`(112-121), `NodeOutputContextDto`(128-137)
  - 상세: 두 variant 클래스 모두 `additionalProperties: false` 를 선언하지 않으므로(NestJS Swagger 기본값은 열림), 이론적으로 `interactionType`/`waitingNodeId`/`buttonConfig`/`nodeOutput` 을 전부 포함한 payload 는 두 스키마의 `required` 조건을 동시에 만족해 `oneOf`(정확히 하나만 매치)가 요구하는 배타성이 스키마상으로는 보장되지 않는다. 다만 `interaction.service.ts` `getStatus()` 는 두 키를 동시에 싣는 분기가 없어(위 `getStatus` 조립 로직 확인 완료) 실제 wire 에서는 항상 정확히 한 variant 만 매치되므로 **실질적 위험은 없다** — 스키마의 이론적 엄밀성과 실제 구현이 벌어져 있다는 관찰이다.
  - 제안: 필요 시 각 variant 에 `not: { required: ['nodeOutput'] }` / `not: { required: ['buttonConfig'] }` 상호 배제 조건을 추가하거나, 현행처럼 "실제 서버가 항상 배타적으로 생성한다"는 불변식을 주석/테스트로 고정하는 현재 방식을 유지해도 무방(비차단, 문서화 목적).

- **[INFO]** SSE/WS 표면(§6-websocket-protocol)의 `waiting_for_input` payload 는 이번 스키마화 범위 밖
  - 위치: `spec/5-system/14-external-interaction-api.md` §5.3 주석 (SSE wire 와 동일 형식이라는 계약)
  - 상세: REST `getStatus.context` 는 이번 PR 로 OpenAPI 상 정밀화됐으나, 동일 wire 를 공유한다고 명시된 SSE `execution.waiting_for_input` 이벤트 자체는 WS 프로토콜 문서 영역이라 Swagger(OpenAPI) 스키마 대상이 아니다(REST 만 OpenAPI 로 문서화되는 것이 프로젝트 관례). 계약상 두 표면이 "동일 형식" 이라는 진술은 코드 검증(테스트 2건, `interaction.service.spec.ts`)으로 뒷받침되고 있어 실질적 갭은 아니다.
  - 제안: 조치 불요, 참고 사항.

## 점검 관점별 확인

1. **하위 호환성** — Breaking change 없음. `interaction.service.ts`(코드베이스 현재 상태, L242-356)를 직접 추적한 결과, `getStatus()` 가 반환하는 실제 JSON 구조는 이번 diff 전후로 동일하다: `context` 조립 로직은 `if/else-if` → `if` 내부 3항 연산자로 리팩터됐을 뿐 분기 조건과 결과 객체 shape 이 1:1 대응(`interactionType` falsy 시 `context=null` 유지, `buttons && bc` 시 `buttonConfig` 동봉, 그 외 truthy `interactionType` 시 `nodeOutput` 동봉)하며, `result`/`error`/`seq` 계산도 무변경이다. 즉 이번 변경은 **런타임 wire 는 그대로 두고 OpenAPI 스키마 표현만 `additionalProperties: true` 뭉개기 → 명시적 `oneOf`/`nullable` 로 정밀화**한 것 — 기존에 opaque object 를 소비하던 클라이언트는 영향 없음. 이전에 백엔드 DTO 를 신뢰해 잘못된 타입을 선언했던 `codebase/channel-web-chat/src/lib/eia-types.ts` 의 `currentNode?: string | null` 은 실제로는 항상 wire 와 어긋나 있던 **선재 드리프트 버그**였고(백엔드는 diff 이전에도 이미 객체 `{id,type,interactionType}` 를 반환), 이번 PR 이 프런트 타입을 wire 에 맞춰 정정한 것 — 현재 위젯이 `currentNode` 를 소비하지 않아(plan draft "현재 미소비라 무해") 런타임 영향도 없다.

2. **버전 관리** — API 버전 체계 변경 없음. 응답 스키마의 하위 호환 정밀화이므로 버전 bump 불요 판단이 타당.

3. **응답 형식** — 일관성 개선. `context`(변형 payload) 는 `@ApiExtraModels(ButtonsContextDto, NodeOutputContextDto, CurrentNodeDto)` + `oneOf`/`getSchemaPath` 로, `currentNode` 는 `type: () => CurrentNodeDto`(중첩 참조, `@ApiExtraModels` 불필요하나 명시적으로 포함해도 무해) 로 정밀화됐다. `result`/`error` 에 `nullable: true` 를 추가한 것도 **문서 표현만 수정**(런타임 `execution.status !== COMPLETED/FAILED` 분기에서 이미 항상 `null` 반환 — diff 전후 로직 동일 확인)이며 새 값을 wire 에 흘리지 않는다.

4. **에러 응답** — 본 diff 범위 밖(변경 없음).

5. **요청 검증** — 본 diff 는 응답 DTO 만 대상. 요청 DTO(`InteractDto` 등) 변경 없음.

6. **URL/경로 설계** — 변경 없음.

7. **페이지네이션** — 해당 없음(단발 상태 조회).

8. **인증/인가** — 변경 없음(`InteractionRequestContext` 가드/컨트롤러 데코레이터 미변경).

## 답변 — 지정된 5개 초점 질문

**(1) `oneOf` without `discriminator` 가 올바른 표현인가 (buttons 가 양쪽 variant 에 출현)?**
올바르다. `interaction.service.ts` L302-323(현재 코드) 을 직접 추적하면 `interactionType === 'buttons' && bc` 일 때만 `ButtonsContextDto` 변형, `bc` 가 falsy 인 `buttons`(buttonConfig 복원 실패)는 `else` 분기로 `NodeOutputContextDto` 변형에 fallthrough 한다 — 즉 `interactionType='buttons'` 값이 두 variant 모두에서 관측 가능해 "필드 값 → variant" 전단사를 요구하는 OpenAPI `discriminator.propertyName` 계약이 성립하지 않는다. `discriminator` 를 선언하면 코드 생성기가 모든 `buttons` 응답을 `ButtonsContextDto` 로 단정 narrowing 해 fallthrough 케이스에서 `context.buttonConfig` 미존재로 인한 런타임 오류를 유발한다. `oneOf` 는 discriminator 없이도 OpenAPI 3.0 상 유효한 형식(discriminator 는 codegen 최적화 힌트일 뿐 검증 필수 요소가 아님)이므로, 판별이 불가능한 이 케이스에서 discriminator 를 생략한 것은 정확한 선택이다. `interaction.service.spec.ts` 신규 테스트("buttons 인데 buttonConfig 부재면 nodeOutput 변형으로 fallthrough")가 이 불변식을 실제 서비스 레벨에서 고정하고, `responses.dto.spec.ts` 가 OpenAPI 문서 생성 결과에서 `context.discriminator` 가 `undefined` 임을 별도로 고정 — 이중 회귀 가드가 존재한다.

**(2) `ExecutionStatusDto.context` 가 기존 클라이언트에 하위 호환인가 — 런타임 wire 무변경 주장을 `interaction.service.ts` `getStatus()` 로 검증**
검증 완료, 하위 호환이다. 코드베이스 현재 `getStatus()`(L242-356)를 diff 와 대조한 결과, `context` 조립은 사실상 동일 로직의 표현만 바뀌었다(`if/else-if` 순차 대입 → 단일 `if` 블록 내 3항 연산자). `base` 오브젝트 필드(`interactionType`/`waitingNodeId`/조건부 `conversationThread`) 와 분기 조건(`buttons && bc` → `buttonConfig` 동봉, 그 외 truthy `interactionType` → `nodeOutput` 동봉, falsy `interactionType` → `context=null` 유지)이 diff 전후 1:1 대응한다. DTO 타입은 `Record<string, unknown> | null`(뭉개진 표현)에서 `ButtonsContextDto | NodeOutputContextDto | null`(정밀 표현)로 바뀌었으나 **JSON 직렬화 결과는 TS 타입과 무관하게 동일**하므로, 이전에 opaque object 로 `context` 를 소비하던 어떤 클라이언트도 영향받지 않는다.

**(3) `conversationThread` 키-생략 vs `null` 형제 필드 — DTO 선언이 이제 wire 를 반영하는가?**
반영한다. `WaitingContextBaseDto.conversationThread?: ConversationThread;`(`| null` 없음, `@ApiPropertyOptional` — nullable 미지정)로 선언돼 "값 있을 때만 키 동봉" 의미를 정확히 타입화했고, `result?: Record<string, unknown> | null;` / `error?: Record<string, unknown> | null;` 는 이번에 `nullable: true` 가 추가돼 "키는 항상 존재, 값이 `null`" 의미를 명시했다. 이는 신설된 `api-convention.md §5.4` 의 "키를 생략하는 필드는 `field?: T`(`| null` 금지), `null` 을 쓰는 필드는 `@ApiPropertyOptional({ nullable: true }) field?: T | null`" 규칙과 정확히 일치하며, `interaction.service.spec.ts` 신규 테스트가 `conversationThread` 부재 시 `Object.keys(ctx)` 에 키 자체가 없음을 서비스 레벨에서, `responses.dto.spec.ts` 가 `variant.required` 미포함 + `thread.nullable !== true` 를 스키마 레벨에서 각각 고정해 DTO 선언·런타임·스키마 3자가 수렴한다.

**(4) `@ApiExtraModels` 가 모든 `getSchemaPath` 참조를 커버하는가 (dangling `$ref` 없음)?**
커버한다. `getSchemaPath` 호출은 `ExecutionStatusDto.context` 프로퍼티의 `oneOf` 배열 안 2건(`ButtonsContextDto`, `NodeOutputContextDto`)뿐이며, 클래스 데코레이터 `@ApiExtraModels(ButtonsContextDto, NodeOutputContextDto, CurrentNodeDto)` 가 이 둘을 모두 포함한다(`CurrentNodeDto` 는 `currentNode` 필드가 `type: () => CurrentNodeDto` 로 직접 참조돼 원래 `@ApiExtraModels` 불요이나 포함해도 무해 — 실제로 `responses.dto.spec.ts` 가 `schemas.CurrentNodeDto` 존재를 별도 검증). 프로덕션 컨트롤러(`interaction.controller.ts:177`)는 `@ApiOkWrappedResponse(ExecutionStatusDto)` 헬퍼를 쓰는데, `@ApiExtraModels` 가 DTO 클래스 자체에 붙어 있어 어느 wrapping 헬퍼를 쓰든 스키마 등재에 영향받지 않는다. 신규 `responses.dto.spec.ts` 는 데코레이터 메타데이터 정적 검사가 아니라 **실제 `SwaggerModule.createDocument()` 를 호출해 `components.schemas` 결과를 검증**하므로, `@ApiExtraModels` 누락으로 인한 dangling `$ref` 를 실증적으로 포착하는 강한 회귀 가드다.

**(5) `result`/`error` 에 `nullable: true` 추가가 wire 를 바꿨는가?**
바꾸지 않았다. `getStatus()` 의 `result`/`error` 계산 로직(`execution.status === COMPLETED ? deepRedactSecrets(...) : null` / 동일 패턴 `FAILED`)은 diff 전후 완전히 동일 — 오직 `@ApiPropertyOptional` 데코레이터 인자에 `nullable: true` 가 추가됐을 뿐이다. 이는 이미 존재하던 런타임 동작(비-completed/실패 상태에서 `null` 반환)을 OpenAPI 스키마가 뒤늦게 명시한 것으로, plan 체크리스트가 지목한 대로 이전엔 "`null` 필드에 `nullable` 선언 누락"이었던 §5.4 미준수 상태를 스키마 레벨에서 바로잡은 순수 문서화 수정이다.

## 요약

`GET /api/external/executions/:id` 의 `ExecutionStatusDto` 응답 스키마를 `additionalProperties: true` 로 뭉개져 있던 `context`/`currentNode` 를 판별자 없는 닫힌 `oneOf` variant DTO(`ButtonsContextDto`/`NodeOutputContextDto`/`CurrentNodeDto`)로, `result`/`error` 를 명시적 `nullable: true` 로 정밀화한 변경이다. `interaction.service.ts` 의 실제 조립 로직을 diff 전후로 직접 대조한 결과 **런타임 wire 는 완전히 동일**하며, DTO 타입·OpenAPI 스키마만 실제 wire 를 뒤늦게 정확히 반영하도록 좁혀졌다 — 순수 문서화/타입 정밀화로 하위 호환 breaking change 는 없다. `interactionType='buttons'` 가 두 variant 모두에 나타날 수 있는 실제 fallthrough 케이스가 서비스 코드에 존재하므로 `discriminator` 를 의도적으로 생략한 것은 OpenAPI 관점에서 정확한 판단이며, 이 불변식은 서비스 단위 테스트(fallthrough)와 실제 OpenAPI 문서 생성 검증 테스트(discriminator 부재·dangling `$ref` 부재·nullable/required 검증) 양쪽에서 실증적으로 고정돼 있다. `conversationThread` 의 키-생략 vs `result`/`error` 의 `null` 이라는 한 응답 내 이중 부재 표현도 신설된 `api-convention.md §5.4` 규칙과 DTO 선언(`field?: T` vs `field?: T | null` + `nullable: true`)이 정확히 대응한다. 유일한 관찰 사항은 `oneOf` 두 variant 가 서로를 배제하는 조건을 스키마 레벨(`additionalProperties: false` 또는 `not.required`)로 강제하지 않는다는 점이나, 실제 서버 구현이 두 키를 동시에 채우는 경로가 없어 실질 위험은 없는 INFO 수준이다.

## 위험도

LOW
STATUS: SUCCESS