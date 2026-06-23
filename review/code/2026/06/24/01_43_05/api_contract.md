# API 계약(API Contract) 리뷰

## 변경 개요

`ChatChannelController.rotateBotToken` 엔드포인트를 `TriggersController` 로 코드 이동한 내부 리팩터링. 외부 공개 라우트(`POST /api/triggers/:id/chat-channel/rotate-bot-token`)는 무변.

---

## 발견사항

### **[INFO]** `rotateBotToken` 에 `@Roles` 데코레이터 누락
- 위치: `/codebase/backend/src/modules/triggers/triggers.controller.ts` — 신규 추가된 `rotateBotToken` 핸들러 (~line 1241)
- 상세: 동일 컨트롤러의 `rotateNotificationSecret`, `revokePerTriggerToken` 은 `@Roles('editor')` 가 명시되어 있다. 이전된 `rotateBotToken` 에는 `@Roles` 데코레이터가 없어 인가 일관성이 깨진다. 기존 `ChatChannelController` 에도 동일하게 누락되어 있었으므로 이번 이전 시 상태를 그대로 복사한 것으로 보인다. 컨트롤러 클래스 레벨이나 전역 가드에서 인증이 보장되더라도, 역할 기반 인가가 다른 민감 엔드포인트와 다르게 적용되는 것은 API 계약 관점에서 불일치다.
- 제안: `@Roles('editor')` 를 추가해 `rotateNotificationSecret` / `revokePerTriggerToken` 과 동일한 인가 수준을 명시할 것. 또는 해당 엔드포인트의 인가 정책을 spec 에 명시하고 의도적으로 다를 경우 주석으로 근거를 기재할 것.

### **[INFO]** `rotateBotToken` 에 `@ApiParam`, `@ApiBadRequestResponse`, `@ApiUnauthorizedResponse`, `@ApiForbiddenResponse`, `@ApiNotFoundResponse` 누락
- 위치: `/codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 핸들러
- 상세: 기존 `ChatChannelController` 코드를 verbatim 복사해 Swagger 데코레이터가 최소화되어 있다. 동일 컨트롤러의 다른 엔드포인트(`rotateNotificationSecret`, `revokePerTriggerToken`)는 `@ApiParam`, `@ApiBadRequestResponse`, `@ApiUnauthorizedResponse`, `@ApiForbiddenResponse`, `@ApiNotFoundResponse` 를 모두 선언해 클라이언트가 OpenAPI 문서로 에러 응답 형식을 확인할 수 있다. `rotateBotToken` 은 이 중 어느 것도 없어 문서 일관성이 떨어진다.
- 제안: 최소한 `@ApiParam({ name: 'id', format: 'uuid' })`, `@ApiBadRequestResponse`, `@ApiUnauthorizedResponse`, `@ApiForbiddenResponse`, `@ApiNotFoundResponse` 를 추가하고 에러 응답 형식을 명시할 것.

### **[INFO]** `rotateBotToken` 의 `@Param('id')` 에 `ParseUUIDPipe` 미적용
- 위치: `/codebase/backend/src/modules/triggers/triggers.controller.ts` — `@Param('id') triggerId: string`
- 상세: 동일 컨트롤러의 `findOne`, `update`, `remove`, `getHistory`, `rotateNotificationSecret`, `revokePerTriggerToken` 모두 `@Param('id', ParseUUIDPipe)` 를 사용해 잘못된 UUID 형식을 400 으로 조기 거부한다. `rotateBotToken` 만 파이프 없이 `@Param('id')` 로 처리되어 요청 검증 일관성이 깨진다. UUID 형식이 아닌 값을 서비스 레이어로 그대로 전달하게 된다.
- 제안: `@Param('id', ParseUUIDPipe) triggerId: string` 으로 변경. 기존 `ChatChannelController` 의 verbatim 복사에서 유입된 불일치이므로 이번 기회에 교정 권장.

---

## 요약

본 변경은 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 라우트를 무변경으로 `ChatChannelController` 에서 `TriggersController` 로 이전한 내부 리팩터링이다. 외부 클라이언트 관점의 breaking change 는 없고 URL·HTTP 메서드·응답 형식·에러 코드 구조 모두 보존된다. 다만 `@Roles('editor')` 누락, Swagger 응답 데코레이터 미선언, `ParseUUIDPipe` 미적용 세 가지가 동일 컨트롤러 내 다른 엔드포인트와 불일치를 만든다. 세 항목 모두 기존 `ChatChannelController` 코드를 verbatim 복사하면서 유입된 pre-existing 불일치이며, 이번 이전이 교정 기회다. API 계약 파괴는 없으나 인가 일관성 측면에서 `@Roles` 누락은 주의가 필요하다.

## 위험도

LOW
