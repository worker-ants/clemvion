# 신규 식별자 충돌 검토 결과

## 발견사항

### [WARNING] `ValidationDetail` 인터페이스 중복 선언
- **target 신규 식별자**: `export interface ValidationDetail` (`workflow-errors.ts:243`)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/common/pipes/validation.pipe.ts:10` — `interface ValidationDetail` (module-private, `{ field: string; message: string; code: 'INVALID_FIELD' }`)
- **상세**: target 이 `workflow-errors.ts` 에 `export interface ValidationDetail { field: string; message: string; code: string; }` 를 새로 정의한다. `validation.pipe.ts` 에는 동명의 `interface ValidationDetail { field: string; message: string; code: 'INVALID_FIELD' }` 가 이미 존재한다. 현재 `validation.pipe.ts` 쪽은 module-private 이므로 런타임 충돌은 없다. 그러나 두 타입의 `code` 필드 범위가 다르다 — pipe 버전은 리터럴 `'INVALID_FIELD'` (좁은 타입), workflow-errors 버전은 `string` (넓은 타입). 향후 통합하거나 cross-import 시 타입 불일치 혼선이 발생할 수 있다.
- **제안**: `ValidationDetail` 을 `common/pipes/validation.pipe.ts` 또는 `common/types/` 에 단일 exported 타입으로 통합하고, `workflow-errors.ts` 와 `validation.pipe.ts` 모두 그것을 import 해 사용. 또는 `workflow-errors.ts` 의 선언 이름을 `FormValidationDetailItem` 등으로 구별한다.

---

### [WARNING] `ErrorCode.VALIDATION_ERROR` 신규 추가 — 기존 리터럴 사용처와 의미 범위 불명확
- **target 신규 식별자**: `ErrorCode.VALIDATION_ERROR = 'VALIDATION_ERROR'` (`error-codes.ts`)
- **기존 사용처**: `validation.pipe.ts:36`, `password.util.ts:33,49`, `auth.service.ts:176,186,695,705`, `triggers.service.ts:214,287,295,302,356,372,383,392`, `folders.service.ts:47`, `agent-memory.controller.ts:166`, `edges.service.ts:48` 등에서 HTTP DTO/body 검증 실패용으로 동일 문자열 `'VALIDATION_ERROR'` 를 직접 리터럴로 사용 중이다.
- **상세**: 신규 `ErrorCode.VALIDATION_ERROR` 의 JSDoc 주석이 "form submit_form field 검증 실패 전용" 으로 한정되어 있으나, 기존 코드베이스 전반에서 같은 문자열이 DTO 검증 실패 등 더 넓은 맥락에 이미 사용 중이다. 값 자체 충돌은 없고 의미도 모순되지 않으나, "form 전용" 한정이 혼선을 줄 수 있다.
- **제안**: `error-codes.ts` JSDoc 에서 "form 전용" 한정 문구를 제거하거나 "API 공통 400 코드, form §4·§6.2 에서도 재사용" 으로 정정한다. 기존 리터럴 `'VALIDATION_ERROR'` 사용처들은 점진적으로 `ErrorCode.VALIDATION_ERROR` 상수로 마이그레이션 고려.

---

### [WARNING] `VALIDATION_FAILED` 구 코드명 잔존 — `VALIDATION_ERROR` 와 혼재
- **target 신규 식별자**: diff 에서 `interaction.controller.ts:70` Swagger 설명을 `VALIDATION_FAILED` → `VALIDATION_ERROR` 로 변경.
- **기존 사용처**: `idempotency.interceptor.ts:27,39,130` 주석에 `VALIDATION_FAILED` 3건 잔존. spec `spec/4-nodes/7-trigger/providers/slack.md:116` / `spec/conventions/chat-channel-adapter.md:428,449` 에도 동일.
- **상세**: 실제 wire-format 코드는 `VALIDATION_ERROR` 이므로 동작 충돌은 없다. 그러나 주석과 spec 문서에 구 명칭이 혼재해 독자 혼동을 유발할 수 있다.
- **제안**: `idempotency.interceptor.ts` 의 3개 주석을 `VALIDATION_ERROR` 로 통일한다. spec 파일 정정은 project-planner 권한 작업으로 별도 처리.

---

### [INFO] `assertFormSubmissionValid` / `coerceFormSubmission` / `coerceFormValue` — 기존 동명 식별자 없음
- **target 신규 식별자**: `ExecutionEngineService.assertFormSubmissionValid` (private), `ExecutionEngineService.coerceFormSubmission` (private static), `ExecutionEngineService.coerceFormValue` (private static)
- **기존 사용처**: 코드베이스 전역 검색 결과 동명 없음.
- **상세**: 충돌 없음. 다만 coerce 로직이 `execution-engine.service.ts` 안에 private static 으로 격리되어 `chat-channel/shared/form-mode.ts` 의 `validateFormSubmission`/`extractFormFields` 와 분산된다. 향후 form 검증 범위 확장 시 응집도 이슈 발생 가능.
- **제안**: 현행 분리 구조 유지 가능. 향후 form 검증 로직 확대 시 단일 모듈 통합 고려.

---

### [INFO] `FormValidationError` — 기존 동명 클래스 없음
- **target 신규 식별자**: `class FormValidationError extends ExecutionError` (`workflow-errors.ts`)
- **기존 사용처**: 코드베이스 전역에 동명 없음.
- **상세**: 충돌 없음. 기존 `ExecutionError` 계층(`InvalidExecutionStateError`, `MessageTooLongError` 등)과 동일 파일·패턴 준수.
- **제안**: 없음.

---

## 요약

이번 diff 가 도입하는 핵심 신규 식별자(`FormValidationError`, `export ValidationDetail`, `ErrorCode.VALIDATION_ERROR`)는 런타임 충돌을 일으키지 않는다. 두 가지 명명 혼선이 존재한다. 첫째, `ValidationDetail` 인터페이스가 `validation.pipe.ts`(module-private, `code: 'INVALID_FIELD'` 리터럴)와 `workflow-errors.ts`(exported, `code: string`)에 병존하며 타입 범위가 달라 향후 통합 시 마찰이 예상된다. 둘째, `VALIDATION_FAILED` 구 코드명이 `idempotency.interceptor.ts` 주석과 일부 spec 파일에 잔존하여 신규 `VALIDATION_ERROR` 와 혼재한다. 두 항목 모두 동작 충돌은 아니므로 즉각 차단 수준은 아니나, 코드베이스 일관성 유지를 위해 조치를 권장한다.

## 위험도

MEDIUM
