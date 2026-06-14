### 발견사항

- **[INFO]** `POST /external/executions/:id/interact` 의 `submit_form` 커맨드에 신규 `400 VALIDATION_ERROR` 응답이 추가됨. 기존 성공 응답(202 Accepted) 및 기타 오류 응답(400 INVALID_COMMAND, 401 TOKEN_* 계열, 409 STATE_MISMATCH)은 변경 없음. 하위 호환성 이슈 없음.
  - 위치: `interaction.controller.ts`, `interaction.service.ts`
  - 상세: 신규 에러 코드 추가는 strictly additive change. 기존 클라이언트는 이 오류 코드를 수신한 적 없으므로 breaking change 아님.
  - 제안: 없음 (현행 유지).

- **[INFO]** `POST /api/executions/:id/continue` (내부 API) 에도 동일 `400 VALIDATION_ERROR` 응답이 추가됨. `@ApiBadRequestResponse` 데코레이터도 해당 커밋에서 추가됨(W-10 조치 반영).
  - 위치: `executions.controller.ts` 152~158행
  - 상세: Swagger 문서에 400 응답이 정상 반영됨.
  - 제안: 없음.

- **[INFO]** 응답 구조 일관성: EIA 경로(`interaction.service.ts`)와 내부 executions 경로(`executions.controller.ts`) 모두 동일 shape `{ error: { code, message, details: [{field, message, code:'INVALID_FIELD'}] } }` 를 반환. `FormValidationError.toHttpDetails()` 단일 SoT 로 일원화됨(W-6 조치 반영).
  - 위치: `workflow-errors.ts` `toHttpDetails()` 메서드
  - 상세: 두 진입점이 동일 메서드를 공유하므로 응답 구조 불일치 위험 제거됨.
  - 제안: 없음.

- **[INFO]** `details[]` 배열이 항상 단일 요소(first-error only) 설계. CHANGELOG 및 `@ApiBadRequestResponse` description 에 "현재 단계 FIRST 오류만" 명시됨. 향후 다중 오류 반환 정책 전환 시 배열 최대 길이 계약이 변경되어 클라이언트 영향 가능.
  - 위치: `interaction.controller.ts` `@ApiBadRequestResponse`, `executions.controller.ts` `@ApiBadRequestResponse`
  - 상세: 현 API description 에 "현재 단계 FIRST 오류만" 명시 — 잠재적 미래 변경 예고됨. 클라이언트가 배열 길이 1을 하드코딩하지 않는 한 breaking change 불발생.
  - 제안: 향후 다중 오류 반환 전환 시 API 버전 관리 또는 명시적 CHANGELOG 항목 필요.

- **[INFO]** HTTP 상태 코드 적절성: 검증 실패 → 400 Bad Request, 상태 부적합 → 422 Unprocessable Entity, 인증 실패 → 401 Unauthorized 구분이 RESTful 관례와 일치함.
  - 위치: `interaction.service.ts`, `executions.controller.ts`
  - 제안: 없음.

- **[INFO]** 요청 검증: `submit_form` 커맨드에 form node field 정의(필수 여부 / email·number 형식 / minLength·maxLength / 선택지) 서버 측 검증 추가. node 정의 부재 시 통과(방어적 설계, 기존 동작 유지). 미정의 추가 필드 허용 — Postel's Law 준수.
  - 위치: `execution-engine.service.ts` `assertFormSubmissionValid`
  - 제안: 현행 유지.

- **[INFO]** 인증/인가: `POST /external/executions/:id/interact` 는 iext 토큰 기반 `InteractionGuard` 로 기존 보호됨. 이번 변경은 인증 계층 무변경 — 신규 400 응답은 인증 통과 후 비즈니스 로직 레이어에서 발생.
  - 위치: `interaction.controller.ts`
  - 제안: 없음.

- **[INFO]** `badRequest()` 헬퍼 optional `details` 파라미터 추가가 기존 `MESSAGE_TOO_LONG` 경로에 하위 호환 적용됨. `details ? { details } : {}` 조건부 스프레드로 기존 응답 구조를 깨지 않음.
  - 위치: `interaction.service.ts` `badRequest()` 함수
  - 제안: 없음.

### 요약

이번 변경은 `submit_form` 커맨드에 서버 측 form field 검증을 추가하고, 검증 실패 시 `400 VALIDATION_ERROR + details[{field, message, code:'INVALID_FIELD'}]` 응답을 반환하는 strictly additive API 계약 확장이다. 기존 성공/에러 응답 구조를 변경하지 않고, 두 진입점(EIA `interaction.service.ts`, 내부 `executions.controller.ts`) 모두 `FormValidationError.toHttpDetails()` 단일 SoT 로 응답 shape를 일관성 있게 유지한다. HTTP 상태 코드(400 vs 422 구분), Swagger 문서(`@ApiBadRequestResponse` 추가), CHANGELOG 기록, WS ack `errorCode` 매핑 모두 적절히 처리되어 API 계약 관점에서 별다른 이슈가 없다. `details[]` 배열이 현재 단계에서 항상 단일 요소인 점은 CHANGELOG에 명시되어 있으나, 향후 다중 오류 반환 전환 시 클라이언트 영향 방지를 위해 API 버전 관리가 필요할 수 있다.

### 위험도
NONE

STATUS=success ISSUES=0
