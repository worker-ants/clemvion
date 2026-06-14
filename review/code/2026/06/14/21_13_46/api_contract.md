# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `details` 배열이 항상 길이 1로 고정됨 — 미래 확장성 관점 스키마 문서화 미흡
  - 위치: `CHANGELOG.md` 및 `workflow-errors.ts` `FormValidationError.toHttpDetails()`
  - 상세: 현재 구현은 FIRST 오류만 surface하며 `details` 배열 길이가 항상 1로 고정된다. CHANGELOG와 JSDoc에 이 정책이 명시되어 있어 의도적 설계임은 확인된다. 단, 향후 다중 오류 배열로 확장 시 클라이언트가 길이 1에 의존하는 코드를 수정해야 하는 breaking change가 발생할 수 있다. API 문서상 "현재 단계" 한정임을 명시한 것은 적절하나, 클라이언트 SDK 생성 시 이 제약이 스키마에 드러나지 않을 수 있다.
  - 제안: OpenAPI 스키마에 `minItems: 1, maxItems: 1` 또는 서술적 description을 추가해 현재 배열 크기 제약을 명시한다. 다중 오류 지원 예정이라면 API 버전 분리를 미리 계획한다.

- **[INFO]** 두 진입점(EIA REST `interaction.service` / 내부 REST `executions.controller`)에서 동일한 `VALIDATION_ERROR` 에러 코드와 `details[]` shape을 반환하나 컨트롤러 레이어별 구현이 분산됨
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts` L177-191, `codebase/backend/src/modules/external-interaction/interaction.service.ts` L685-691
  - 상세: 두 경로 모두 `FormValidationError.toHttpDetails()`를 재사용하여 응답 shape 일관성은 확보되었다. 그러나 `BadRequestException` 감싸기와 `error.{ code, message, details }` 구조 조립이 각 레이어에서 독립적으로 수행된다. 현재는 `toHttpDetails()`가 SoT 역할을 하므로 기능상 일관성은 유지되나, 추후 `error` 래퍼 키 이름이나 최상위 구조가 변경될 경우 두 곳을 모두 수정해야 한다.
  - 제안: 중장기적으로 `ExecutionErrorMapper` 또는 글로벌 `ExceptionFilter`로 일원화하는 방향이 바람직하다(RESOLUTION.md I-4 항목으로 이미 파악됨). 현재 단계에서는 허용 가능.

- **[INFO]** WS ack 경로의 `VALIDATION_ERROR` 매핑이 기존 `ExecutionError` 계층 자동 처리에 의존
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` W-12 테스트
  - 상세: WS ack는 `buildContinuationErrorAck`가 `ExecutionError` 계층을 순회하여 `errorCode`를 결정한다. `FormValidationError extends ExecutionError`이고 `code = ErrorCode.VALIDATION_ERROR`이므로 자동 매핑된다. 명시적 핸들링 없이 계층 상속에 의존하는 방식은 간결하지만, 향후 WS ack shape이 REST와 다른 구조로 분기될 경우 암묵적 의존이 디버깅을 어렵게 만들 수 있다.
  - 제안: 현재 설계는 수용 가능. W-12 회귀 테스트가 이미 추가되어 silent regression 방지됨. 문서화로 충분.

## 요약

이번 변경은 `POST /external/executions/:id/interact`(EIA) 및 내부 `/executions/:id/continue` 엔드포인트에 서버 측 form field 검증을 추가한다. API 계약 관점에서 핵심 항목들을 점검한 결과: 신규 `400 VALIDATION_ERROR` 응답은 하위 호환성을 깨지 않는 additive change이며, 기존 성공/오류 흐름은 변경되지 않는다. 응답 shape `{ error: { code, message, details[{field, message, code}] } }`이 두 진입점(EIA REST, 내부 REST)에서 `FormValidationError.toHttpDetails()`를 SoT로 공유하여 일관성이 확보되었다. HTTP 상태 코드 400 선택은 재제출 가능한 클라이언트 입력 오류로 적절하다. `@ApiBadRequestResponse` 데코레이터가 `executions.controller.ts`에 추가되어 Swagger 문서화도 보완되었다. `ErrorCode.VALIDATION_ERROR` enum 항목 추가로 단일 SoT도 달성했다. 발견된 항목은 모두 INFO 수준이며 기능적 breaking change 없음.

## 위험도

NONE
