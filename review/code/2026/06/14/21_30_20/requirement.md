# 요구사항(Requirement) 리뷰

## 발견사항

### **[WARNING]** spec §6.2 `validation.min`/`max`(숫자 범위)·`pattern`(정규식) 검증 미구현 — plan 추적 완료 (INFO 격상 사유)

- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `extractFormFields` (L87-105) / `validateFormSubmission` (L145-191) / `FormModalField` 타입
- 상세: spec `form.md §6.2` 는 `validation.min`/`max`(숫자 범위)·`pattern`(정규식) 위반을 "클라이언트 에러 응답 → 폼 재표시" 대상으로 명시하고 있으나, 해당 표 행에 **"미구현 (Planned), `plan/in-progress/spec-sync-form-gaps.md` 추적"** 이 명기되어 있다. `extractFormFields` 는 `validation.minLength`·`validation.maxLength` 만 추출하고 `min`/`max`/`pattern` 은 추출하지 않는다. 결과적으로 `number` 타입 필드에 `validation.min`/`max` 가 설정돼 있어도 서버 측 검증이 수행되지 않는다.

  이 미구현은 이번 PR 에서 **의도적으로 범위 한정한 사항**으로, `plan/in-progress/spec-sync-form-gaps.md` 21행(`- [ ] §6.2 서버측 validation.min/max(숫자 범위)·pattern(정규식) 검증`)에 명시적으로 등록되어 있고, spec §6.2 표 행에도 Planned 주석이 이미 추가되어 있다. 이전 리뷰 사이클의 requirement.md 에서 WARNING 으로 분류한 근거("plan 미명시")는 현 시점 해소됐다. 따라서 이 항목은 **실질적으로 INFO** 에 해당하며, 미완성 spec 약속이 코드베이스에 존재하므로 추적 목적으로 기록한다.

- 제안: 현재 상태 유지(plan 추적 완료). `validateFormSubmission` 확장 시 `FormModalField` 에 `min?`, `max?`, `pattern?` 필드 추가 및 해당 검증 분기를 삽입하면 3 경로(EIA/WS/UI)에 자동으로 반영된다.

---

### **[INFO]** spec §6.2 `type:'file'` MIME/크기/개수 검증 — 명시적 Planned, plan 추적 완료

- 위치: `execution-engine.service.ts` `assertFormSubmissionValid` JSDoc ("file MIME/size/count 검증은 Planned — 본 단계 미적용")
- 상세: spec §6.2 의 `type:'file'` MIME/크기/개수 초과 조건은 이번 PR 에서 의도적으로 제외됐다. spec §6.2 표 행과 JSDoc, `plan/in-progress/spec-sync-form-gaps.md` 모두에 명시되어 있어 요구사항 누락 버그가 아닌 범위 한정 결정이다. 현재 file 타입 `required: true` 시 빈 배열 `[]`은 `coerceFormValue` 에서 `''`(빈 문자열)로 변환되어 required 검증이 올바르게 동작한다.
- 제안: 현 상태 유지.

---

### **[INFO]** 핵심 요구사항 충족 확인 — EIA-IN-10, EIA-RL-03, spec form §4·§6.2

- 위치: `execution-engine.service.ts` `continueExecution` / `assertFormSubmissionValid`, `interaction.service.ts` `dispatchContinuation`, `executions.controller.ts` `continueExecution` 핸들러
- 상세: 이번 PR 의 핵심 요구사항인 다음 항목들이 모두 구현되어 있다:
  1. **EIA-IN-10** (`submit_form` 검증 실패 시 `400 VALIDATION_ERROR` + `details[]`): `interaction.service.ts` 가 `FormValidationError` → `badRequest(..., err.toHttpDetails())` 로 변환하고, `executions.controller.ts` 도 동일 패턴으로 매핑한다.
  2. **EIA-RL-03** (검증 실패 시 `waiting_for_input` 유지): `assertFormSubmissionValid` 가 `publish` 이전에 throw 하여 `continuationBus.publish` 가 호출되지 않으므로 execution 상태가 변경되지 않는다.
  3. **spec form §4 step5** (publisher 측 동기 검증): `continueExecution` 에서 `assertFormSubmissionValid` 를 `publish` 전에 호출하는 구조가 3 진입점(EIA REST, WS, 내부 executions) 에서 공통으로 적용된다.
  4. **spec form §6.2 구현 범위** (필수/type/minLength·maxLength/select·radio 선택지): `validateFormSubmission` 이 해당 4 범주를 모두 커버하고 `extractFormFields` 가 올바르게 추출한다.
  5. **`details[].code = 'INVALID_FIELD'`**: `FormValidationError.toHttpDetails()` 가 `ErrorCode.INVALID_FIELD` 를 사용하며, spec `§5.1` 의 `{ field, message, code: "INVALID_FIELD" }` 형태와 일치한다.
- 제안: 없음.

---

### **[INFO]** `validateFormSubmission` 반환 FIRST-only 정책 — spec `details[]` 배열과 정합

- 위치: `workflow-errors.ts` `FormValidationError.toHttpDetails()` (L269-277)
- 상세: `validateFormSubmission` 은 `{ field, message } | null` 을 반환하므로 항상 FIRST 오류 하나만 surface 한다. `toHttpDetails()` 는 이를 길이 1 의 `ReadonlyArray<ValidationDetail>` 로 반환한다. EIA spec §5.1 이 `details[]` 를 배열로 정의하나 단일 오류만 포함되는 것은 구현 일관성(chat-channel `validateFormSubmission` 재사용 정책) 으로 인한 의도적 선택이다. spec 의 `details[]` 배열 형태를 준수하므로 spec 위반 아님.
- 제안: 현 상태 유지. Rationale 기록은 별도 project-planner 작업.

---

### **[INFO]** `validateFormSubmission` 호출 인자 순서 — 올바름 확인

- 위치: `execution-engine.service.ts:4335` — `validateFormSubmission(ExecutionEngineService.coerceFormSubmission(formData), fields)`
- 상세: `form-mode.ts` 의 `validateFormSubmission(fields: Record<string, string>, defs: FormModalField[])` 시그니처에서 첫 번째 인자가 제출 데이터 맵, 두 번째가 필드 정의 배열이다. 코드에서 `coerceFormSubmission(formData)` (제출 데이터 맵) → 1번, `extractFormFields(node.config)` 결과(필드 정의 배열) → 2번으로 올바르게 호출된다.
- 제안: 없음.

---

### **[INFO]** `checkbox` 타입 required 검증 — 암묵적 처리, 선택지 검증 없음

- 위치: `form-mode.ts` `validateFormSubmission` — `checkbox` 타입 전용 분기 없음
- 상세: `checkbox` 타입에 아무것도 선택하지 않으면 빈 배열 `[]` → `coerceFormValue` 에서 `''`(빈 문자열) → `required: true` 검증이 올바르게 동작한다. 비어있지 않은 `checkbox` 값은 콤마 join 후 `select`/`radio` 선택지 검증 분기를 타지 않아 옵션 외 값도 통과된다. spec §6.2 에 checkbox 선택지 검증이 명시되지 않았으므로 현 PR 범위 밖이다.
- 제안: 없음.

---

### **[INFO]** `interaction.controller.ts` Swagger description — 이미 `VALIDATION_ERROR` 로 반영됨 (이전 리뷰 오탐 해소)

- 위치: `codebase/backend/src/modules/external-interaction/interaction.controller.ts` L70
- 상세: 이전 일관성 리뷰(`convention_compliance.md`, `naming_collision.md`)에서 "현재 파일에 여전히 `VALIDATION_FAILED` 가 남아 있다" 는 WARNING 을 제기했으나, 현재 파일을 직접 확인한 결과 `'VALIDATION_ERROR (form field — details[]) / INVALID_COMMAND (필수 필드 누락).'` 로 이미 올바르게 반영되어 있다. 이전 리뷰의 해당 WARNING 은 오탐이거나 다른 iteration 의 파일 상태를 참조한 것으로, 현 구현은 spec EIA §5.1 과 정합하다.
- 제안: 없음. (해당 WARNING 은 실제 파일 확인으로 해소됨)

---

### **[INFO]** `ValidationDetail.code` 타입 — `string` vs 리터럴 `'INVALID_FIELD'` 불일치

- 위치: `workflow-errors.ts` `ValidationDetail` 인터페이스 L234-238 — `code: string`
- 상세: `workflow-errors.ts` 의 `ValidationDetail` 은 `code: string` (넓은 타입)으로 선언하고 실제 값으로 `ErrorCode.INVALID_FIELD` 를 할당한다. spec §5.1 이 `code: "INVALID_FIELD"` 를 고정 값으로 명시하므로, 타입 안전성 측면에서 리터럴 타입으로 좁히는 것이 더 정확하다. 기능 동작에는 영향 없음.
- 제안: `code: 'INVALID_FIELD'` 또는 `code: typeof ErrorCode.INVALID_FIELD` 로 타입을 좁힐 것 고려. 현 시점 차단 불필요.

---

## 요약

이번 변경은 `continueExecution` publisher chokepoint 에 form 제출 field-level 검증(`FormValidationError`, `assertFormSubmissionValid`, `coerceFormSubmission/Value`)을 추가하고, EIA REST 와 WS 두 진입점에서 일관되게 `400 VALIDATION_ERROR + details[{field,message,code:'INVALID_FIELD'}]` 로 변환하는 구조다. spec form §4 step5·§6.2 의 구현 범위 항목(필수·type(email/number)·minLength/maxLength·select/radio 선택지)은 올바르게 구현되었으며, EIA-IN-10 (VALIDATION_ERROR + details[]), EIA-RL-03 (waiting_for_input 유지) 요구사항이 충족된다. 검증 실패 시 `publish` 전에 throw 되어 execution 이 `waiting_for_input` 을 유지하는 핵심 계약도 정확하다.

`validation.min`/`max`·`pattern` 미구현은 이전 리뷰 사이클에서 WARNING 으로 분류됐으나, 현 PR 에서 `plan/in-progress/spec-sync-form-gaps.md` 와 spec §6.2 표 모두에 Planned 로 명시됐으므로 추적 완료 상태이며 실질적으로 INFO 다. `interaction.controller.ts` Swagger description 의 `VALIDATION_FAILED` 잔존 우려(이전 일관성 리뷰 WARNING)는 실제 파일 확인 결과 이미 `VALIDATION_ERROR` 로 반영되어 있어 오탐으로 판명됐다. `file` 검증 미구현도 plan 에 명시된 범위 외 항목이다. 전반적으로 이번 PR 의 명시 범위 내 요구사항은 완전히 충족되어 있다.

## 위험도

LOW
