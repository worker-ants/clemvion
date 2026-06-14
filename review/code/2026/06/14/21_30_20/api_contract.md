# API 계약(API Contract) 리뷰

## 발견사항

### **[WARNING]** `continueExecution` REST 엔드포인트의 `FormValidationError` 응답 shape 가 EIA `interact` 와 구조 비대칭
- 위치: `codebase/backend/src/modules/executions/executions.controller.ts` — `continueExecution` 핸들러 (L182-190) vs `codebase/backend/src/modules/external-interaction/interaction.service.ts` — `dispatchContinuation` (L308-313)
- 상세: 두 경로 모두 `FormValidationError → 400 VALIDATION_ERROR` 를 반환하지만 body 구성 방식이 다르다. `executions.controller.ts` 는 `{ error: { code, message, details: error.toHttpDetails() } }` 으로 `details` 키를 항상 포함한다. `interaction.service.ts` (EIA) 의 `badRequest` 헬퍼는 `{ error: { code, message, ...(details ? { details } : {}) } }` — conditional spread 를 사용한다. 현재 두 경로 모두 `details` 가 실제로 전달되어 런타임 출력은 동일하나, 향후 `FormValidationError.toHttpDetails()` 가 빈 배열·null 을 반환하도록 변경되면 두 경로의 응답 shape 가 달라질 수 있다.
- 제안: 두 진입점이 동일 헬퍼 패턴(`badRequest` 또는 `FormValidationError.toHttpDetails()` 직접 위임)을 사용하도록 통일한다. `interaction.service.ts` 의 conditional spread 도 FormValidationError 경로에서 `details` 는 항상 non-null 이므로 무조건 포함하는 방식으로 단순화 가능.

---

### **[WARNING]** `ValidationDetail.code` 타입이 `string` — 리터럴 계약 미강제
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `ValidationDetail` 인터페이스 (L234-238)
- 상세: `ValidationDetail.code` 가 `string` 으로 선언되어 있어, 실제로 `'INVALID_FIELD'` 리터럴만 허용하는 API 계약을 타입 수준에서 강제하지 못한다. 동일 인터페이스가 `validation.pipe.ts` 에 `code: 'INVALID_FIELD'` 리터럴 타입으로 존재해 두 선언의 타입 범위가 불일치한다. 향후 `toHttpDetails()` 에서 다른 코드 문자열이 반환되더라도 TypeScript 가 감지하지 못한다.
- 제안: `ValidationDetail.code` 를 `'INVALID_FIELD'` 리터럴 타입 (또는 `ErrorCode.INVALID_FIELD` 타입)으로 좁힌다. 이렇게 하면 API 계약 상 허용 코드가 타입 레벨에서 강제되고 `validation.pipe.ts` 선언과도 정합된다.

---

### **[INFO]** `interaction.controller.ts` Swagger `@ApiBadRequestResponse` description — 파일에 정상 반영됨
- 위치: `codebase/backend/src/modules/external-interaction/interaction.controller.ts` — L70
- 상세: 일관성 검토(convention_compliance.md)에서 `VALIDATION_FAILED` 잔존을 경고했으나, 실제 파일 직접 확인 결과 description 은 이미 `'VALIDATION_ERROR (form field — details[]) / INVALID_COMMAND (필수 필드 누락).'` 으로 갱신되어 있다. diff 변경이 정상 반영된 상태다. 다만 `details[]` 내부 schema(`{field, message, code:'INVALID_FIELD'}`)가 기술되지 않아 `executions.controller.ts` description 과 상세 수준 차이가 있다.
- 제안: description 을 `'VALIDATION_ERROR (form field — details[{field,message,code:INVALID_FIELD}]) / INVALID_COMMAND (필수 필드 누락).'` 으로 보완한다.

---

### **[INFO]** WS ack `VALIDATION_ERROR` 에 `details[]` 미포함 — API 계약에 명시 부재
- 위치: WebSocket gateway `FormValidationError` 처리 경로 / `spec/5-system/6-websocket-protocol.md §4.2`
- 상세: WS ack 는 `{ errorCode: 'VALIDATION_ERROR', error: '...' }` 평면 구조로 `details[]` 없이 반환된다. REST 경로가 `details[{field,message,code}]` 를 반환하는 것과 대비하여 WS 클라이언트는 어느 필드가 실패했는지 알 수 없다. WS ack 구조의 한계에서 기인하나 spec §4.2 에 "WS ack 는 details 미포함" 임이 명시되어 있지 않아 클라이언트 구현자 혼란 가능성이 있다. WS spec 표의 `VALIDATION_ERROR` 항목은 이번 변경으로 신규 추가됨.
- 제안: spec/5-system/6-websocket-protocol.md §4.2 `VALIDATION_ERROR` 항목에 "ack field-level details 미포함 — 상세 오류는 EIA REST 경로 참조" 를 부연한다.

---

### **[INFO]** HTTP 상태 코드·에러 응답 래퍼 적절성 — 이상 없음
- 위치: `executions.controller.ts`, `interaction.service.ts`, `interaction.controller.ts`
- 상세: form field 검증 실패 `400`, 상태 불일치 EIA `409 STATE_MISMATCH` / REST executions `422 INVALID_STATE`(spec 의도적 분리), 토큰 오류 `401`, 실행 종료 `410 GONE`. 에러 응답 body 최상위 `error` 래퍼 키 패턴이 API 규약(spec §5.3)을 준수한다. `FormValidationError.toHttpDetails()` 가 `details` shape 의 단일 SoT 역할을 한다.

---

### **[INFO]** `badRequest` 헬퍼의 optional `details` 추가 — 하위 호환성 유지
- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` — `badRequest` 함수 (L331-339)
- 상세: 기존 호출부(INVALID_COMMAND, MESSAGE_TOO_LONG)는 두 인자만 전달하여 `details` 없이 동작하므로 기존 API 클라이언트 응답 shape 가 그대로 유지된다. 신규 FormValidationError 경로에서만 `details` 포함. breaking change 없음.

---

## 요약

이번 변경은 `submit_form` 명령의 field 검증 실패를 `400 VALIDATION_ERROR + details[{field, message, code:'INVALID_FIELD'}]` 로 두 REST 진입점(EIA `/interact`, executions `/continue`)에 일관되게 추가하고, WS ack 에 `VALIDATION_ERROR` 코드를 신규 추가한다. HTTP 상태 코드 선택, 에러 응답 `error` 래퍼 패턴, 하위 호환성 유지는 모두 적절하게 처리되어 있다. 주요 우려사항은 (1) 두 REST 진입점의 `details` 포함 방식 미세 비대칭 — 향후 분기 가능성, (2) `ValidationDetail.code` 가 `string` 으로 선언되어 `'INVALID_FIELD'` 리터럴 계약이 타입 레벨에서 강제되지 않아 API 계약의 타입 안전성이 불완전하다. WS ack 에 `details` 미포함이 설계 결정임에도 spec 에 명시되지 않아 클라이언트 혼란 가능성이 있으나 이는 INFO 수준이다.

## 위험도

LOW

STATUS=success ISSUES=2
