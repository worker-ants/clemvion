# 요구사항(Requirement) 리뷰

## 발견사항

### **[INFO]** 기능 완전성 — plan 명시 범위 충족 확인

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid`, `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateFormSubmission`
- 상세: plan(`spec-sync-form-gaps.md`)이 명시한 검증 범위(필수 필드·type(email/number)·minLength/maxLength·select/radio 선택지)는 구현에서 모두 충족된다. `validateFormSubmission`이 해당 규칙 전부를 처리하고 `assertFormSubmissionValid`가 이를 publisher chokepoint에서 호출한다. `FormValidationError` 발생 시 `publish` 이전에 throw되어 execution이 `waiting_for_input` 상태를 유지하는 핵심 요구사항(spec form §4 step5·§6.2 / EIA §5.1 EIA-IN-10)이 정확히 구현되어 있다.
- 제안: 없음.

---

### **[INFO]** `ValidationDetail.code` 타입 — 이전 review 사이클 WARNING 정정

- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` lines 234–239 (`ValidationDetail` 인터페이스)
- 상세: 이전 review 사이클(21_13_46·21_30_20)의 api_contract.md·naming_collision.md에서 `ValidationDetail.code`가 `string`으로 선언되어 리터럴 계약이 강제되지 않는다고 WARNING을 지적했다. 그러나 현재 실제 파일(`workflow-errors.ts`)에서 `code: 'INVALID_FIELD'` 리터럴 타입으로 선언되어 있어 해당 지적은 diff 기반 오분석으로, 실제 코드는 이미 타입 안전성이 확보된 상태다. `validation.pipe.ts`의 module-private `ValidationDetail`과의 타입 범위 불일치 우려도 workflow-errors.ts가 동일한 `'INVALID_FIELD'` 리터럴을 사용하므로 실질적 충돌 없음.
- 제안: 없음 (이미 정합).

---

### **[WARNING]** spec §6.2 `validation.min`/`max`/`pattern` 검증 — plan 추적 체크박스 분리 미완료 우려

- 위치: `plan/in-progress/spec-sync-form-gaps.md` 체크박스 상태, `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `extractFormFields`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` JSDoc lines 4317–4320
- 상세: spec form §6.2 본문(현재 파일 기준)에 `validation.min`/`max`(숫자 범위)·`pattern`(정규식) 위반은 "Planned"로 명시되어 있고, `assertFormSubmissionValid` JSDoc에도 "미적용 (Planned)" 가 명시되어 있다. `extractFormFields`가 `validation.minLength`/`maxLength`만 추출하고 `min`/`max`/`pattern`은 추출하지 않는 것은 의도된 Planned 상태다. 그러나 이전 plan_coherence.md(21_18_20)에서 `spec-sync-form-gaps.md`의 §4/§6.2 체크박스가 "비-file 검증 완료"와 "min/max/pattern Planned 잔여"를 구분하지 못하고 있다는 WARNING이 제기됐다. plan 체크박스가 여전히 두 항목을 분리하지 않고 있다면 추적 정확도 저하로 향후 min/max/pattern 구현이 누락될 위험이 있다.
- 제안: `plan/in-progress/spec-sync-form-gaps.md`에서 §4/§6.2 체크박스를 "비-file 검증(필수/type/validation.minLength/maxLength/select·radio) 완료 [x] — validation.min/max/pattern·file MIME/size/count 검증은 별도 Planned [ ]"으로 분리 갱신한다.

---

### **[INFO]** 에러 응답 shape — EIA spec §5.1 EIA-IN-10 준수 확인

- 위치: `codebase/backend/src/modules/executions/executions.controller.ts` lines 182–189, `codebase/backend/src/modules/external-interaction/interaction.service.ts` lines 308–313
- 상세: spec §5.1 EIA-IN-10의 `400 VALIDATION_ERROR + error.details[{field,message,code:"INVALID_FIELD"}]` 계약이 두 진입점 모두에서 충족된다. `executions.controller.ts`는 `{ error: { code, message, details: error.toHttpDetails() } }` 로 details를 항상 포함하고, `interaction.service.ts`는 `badRequest(ErrorCode.VALIDATION_ERROR, message, error.toHttpDetails())`를 통해 동일 shape를 만든다. FormValidationError 경로에서 `toHttpDetails()`가 항상 non-null 배열을 반환하므로 런타임 출력은 동일하다. 단, `interaction.service.ts`의 conditional spread(`details ? { details } : {}`)가 향후 `toHttpDetails()`가 빈 배열을 반환하는 경우 출력 차이를 유발할 수 있으나, 현재 구현에서는 불가능한 시나리오다.
- 제안: 없음.

---

### **[INFO]** `coerceFormSubmission` 엣지 케이스 — null/비-객체 방어 처리 확인

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` lines 4352–4361 (`coerceFormSubmission`)
- 상세: `!formData || typeof formData !== 'object'` 검사로 null·undefined·원시 타입 입력 시 `{}` 반환 처리가 되어 있다. `{}` 반환 시 `validateFormSubmission`은 빈 fields 맵으로 검증하며, required 필드가 있으면 required 오류가 올바르게 발생한다. 배열 입력은 인덱스 키('0', '1' 등)가 FIELD_NAME_RE를 통과하지 못해 fields에서 제외되므로 안전하다.
- 제안: 없음.

---

### **[INFO]** WS ack 경로 — `VALIDATION_ERROR` details 미포함 설계 확인

- 위치: websocket gateway `FormValidationError` 처리 경로, `spec/5-system/6-websocket-protocol.md` §4.2
- 상세: WS ack는 `{ errorCode: 'VALIDATION_ERROR', error: '...' }` 평면 구조로 `details[]` 없이 반환된다. spec form §4 callout에서 "WS는 `VALIDATION_ERROR` ack"로 명시한 것과 일치한다. WS spec §4.2에 VALIDATION_ERROR 행이 추가된 것도 확인된다. 단, ack에 `details` 미포함임이 WS spec에 명시되지 않아 클라이언트 구현자 혼란 여지는 남는다.
- 제안: WS ack에 details 미포함임을 WS spec §4.2 `VALIDATION_ERROR` 항목에 부연한다 (project-planner 권한 작업).

---

### **[INFO]** `spec/5-system/14-external-interaction-api.md §R13` — `FormValidationError` 행 추가 확인

- 위치: `spec/5-system/14-external-interaction-api.md` §R13 (파일 37)
- 상세: §R13 typed error ↔ WS ack ↔ EIA REST 3단 매핑 표에 `FormValidationError | VALIDATION_ERROR | 400 VALIDATION_ERROR (+ details[])` 행이 추가되어 이전 cross_spec.md WARNING이 해소됐다.
- 제안: 없음 (해소됨).

---

### **[INFO]** `spec/5-system/4-execution-engine.md §7.5.2` — `FormValidationError` 선례 목록 추가 확인

- 위치: `spec/5-system/4-execution-engine.md` §7.5.2 (파일 38)
- 상세: typed ExecutionError 선례 목록에 `FormValidationError`(`submit_form` field 검증, code `VALIDATION_ERROR`, EIA §R13 cross-ref)가 추가되어 이전 cross_spec.md WARNING이 해소됐다. ExecutionError 계층 편입 기준("publisher 측 동기 검증 경로")이 코드와 spec 모두에서 일관되게 적용되고 있다.
- 제안: 없음.

---

### **[WARNING]** 사용자 문서 `triggers.mdx`·`triggers.en.mdx` — CRITICAL 지적 해소 여부 미확인

- 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`, `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx`
- 상세: 21_30_20 convention_compliance.md에서 사용자 문서 2개 파일에 `VALIDATION_FAILED + details.fieldErrors`가 잔류한다는 CRITICAL 지적이 있었다. 이번 review 대상 payload(21_46_45)에서 해당 파일들의 변경이 포함되어 있지 않다. 외부 클라이언트가 `VALIDATION_FAILED` + `details.fieldErrors`로 분기 코드를 작성하면 실제 응답(`VALIDATION_ERROR` + `error.details[]`)과 불일치하는 클라이언트 계약 파손이 발생한다. 이는 spec/conventions/error-codes.md §2 (에러 코드 rename = breaking change) 위반이다.
- 제안: `triggers.mdx`·`triggers.en.mdx`의 `VALIDATION_FAILED` → `VALIDATION_ERROR`, `details.fieldErrors` → `error.details[{field,message,code}]` 수정이 이번 PR에 포함됐는지 즉시 확인하고, 미포함이라면 이번 PR에서 해소한다.

---

### **[INFO]** `idempotency.interceptor.ts` 주석 `VALIDATION_FAILED` 잔존 — 기능 영향 없음

- 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` lines 27, 39, 130
- 상세: 주석 3건에 `VALIDATION_FAILED` 구 코드명이 남아 있다. 실제 cache 제외 로직은 4xx 전체를 처리하므로 동작 충돌은 없다. naming_collision·rationale_continuity 리뷰에서 반복 지적된 항목이다.
- 제안: 주석 3건을 `VALIDATION_ERROR`로 통일한다.

---

## 요약

이번 변경의 핵심 요구사항 — `continueExecution` publisher chokepoint에서 form 제출 field-level 검증(필수·type(email/number)·minLength/maxLength·select/radio 선택지) 수행, `FormValidationError` throw로 execution `waiting_for_input` 유지, 두 REST 진입점(EIA `/interact`, executions `/continue`)과 WS ack에서 일관된 `400 VALIDATION_ERROR + details[{field,message,code:'INVALID_FIELD'}]` 응답 — 은 모두 충족된다. spec form §6.2 기준으로 `validation.min`/`max`/`pattern` 미구현은 spec 본문과 코드 JSDoc 모두에서 Planned로 명시되어 있어 의도된 범위 제한이다. `ValidationDetail.code` 타입 우려(이전 사이클 WARNING)는 실제 코드에서 이미 `'INVALID_FIELD'` 리터럴로 확보된 상태임을 확인했다. 주요 요구사항 미충족 버그는 발견되지 않았으나, (1) plan 체크박스의 비-file 완료 / min·max·pattern Planned 분리 갱신 누락, (2) 사용자 문서(`triggers.mdx`·`triggers.en.mdx`) `VALIDATION_FAILED` 잔류 CRITICAL 해소 여부 미확인 두 항목이 WARNING으로 남는다.

## 위험도

MEDIUM

STATUS=success ISSUES=2
