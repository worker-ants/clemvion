# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
검토 범위: `spec/4-nodes/6-presentation/`
검토 포커스: `plan/in-progress/spec-sync-form-gaps.md` 미구현 항목 — `validation.min`/`max`/`pattern` 검증 구현 착수

---

## 발견사항

### 발견사항 1

- **[INFO]** `validation.min` / `validation.max` / `validation.pattern` — 스펙 필드명과 코드 스키마가 이미 일치
  - target 신규 식별자: `validation.min`, `validation.max`, `validation.pattern` (FormField 의 ValidationRule 서브 필드)
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/codebase/backend/src/nodes/presentation/form/form.schema.ts` 의 `validationRuleSchema` (lines 20-29) — 이미 `min: z.number().optional()`, `max: z.number().optional()`, `pattern: z.string().optional()` 가 선언돼 있다.
  - 상세: target spec(`spec/4-nodes/6-presentation/4-form.md §1`)의 ValidationRule 구조 테이블(fields: `min`, `max`, `pattern`)은 구현 코드의 `validationRuleSchema` 와 정확히 동명 동타입으로 정렬돼 있다. 충돌 없음.
  - 제안: 충돌 없음. 코드 스키마는 이미 이 필드들을 optional 로 선언한 상태이므로 구현 시 별도 스키마 변경 없이 validator 로직 확장만 필요.

### 발견사항 2

- **[INFO]** `FormModalField.min` / `FormModalField.max` / `FormModalField.pattern` — chat-channel 어댑터 타입에 부재
  - target 신규 식별자: `validation.min`, `validation.max`, `validation.pattern` 의 구현이 `validateFormSubmission` 경로를 통해 적용될 때 `FormModalField` 타입에 해당 필드가 필요
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/codebase/backend/src/modules/chat-channel/types.ts` 의 `FormModalField` 인터페이스 — 현재 `minLength?: number`, `maxLength?: number` 만 보유하고 `min`, `max`, `pattern` 은 선언돼 있지 않다. `extractFormFields`(`form-mode.ts` lines 87-105)도 `minLength`/`maxLength` 만 변환하고 `min`/`max`/`pattern` 변환 없음.
  - 상세: `validateFormSubmission` 함수 (`form-mode.ts`) 가 `FormModalField[]` 를 매개변수로 받는다. `execution-engine.service.ts` 의 `assertFormSubmissionValid` 가 `extractFormFields(node.config)` → `validateFormSubmission(...)` 순서로 호출한다. `min`/`max`/`pattern` 검증을 추가하려면 `FormModalField` 타입에 `min?`, `max?`, `pattern?` 필드를 추가하고 `extractFormFields` 에서 해당 필드를 변환해야 한다. 필드명 자체의 충돌 위험은 없지만(기존에 없던 필드), 역할 경계를 명확히 해야 한다. `minLength`/`maxLength` 는 chat-channel modal 자체의 TEXT_INPUT 길이 제약에 활용되는 목적이 있는 반면, `min`/`max`/`pattern` 는 순수 서버-side 검증 목적이라 chat-channel provider 측에서 UI hint 로 쓰이지 않는다. `ValidationPreset` 의 `phone` 프리셋은 spec 상 Planned/미구현이므로 본 구현 범위 외.
  - 제안: `FormModalField` 에 `min?: number`, `max?: number`, `pattern?: string` 필드를 추가할 때 JSDoc 주석으로 "서버측 숫자 범위/정규식 검증 전용 — chat-channel modal UI hint 에 활용 안 함 (`minLength`/`maxLength` 와 달리)" 을 명시해 `minLength`/`maxLength` 의 dual-purpose(modal + 서버) 와 구분하도록 권장.

### 발견사항 3

- **[INFO]** `VALIDATION_ERROR` / `INVALID_FIELD` / `FormValidationError` — 기존 에러 코드 체계와 정합
  - target 신규 식별자: `min`/`max`/`pattern` 위반 시 표면할 에러 코드
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/codebase/backend/src/nodes/core/error-codes.ts` — `VALIDATION_ERROR`, `INVALID_FIELD` 이미 등록. `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `FormValidationError` 이미 구현, `code = ErrorCode.VALIDATION_ERROR`.
  - 상세: `min`/`max`/`pattern` 검증 실패도 기존 `FormValidationError` 를 그대로 사용한다. 추가 에러 코드 또는 신규 에러 클래스가 불필요하다. 충돌 없음.
  - 제안: 추가 조치 불요.

### 발견사항 4

- **[INFO]** `assertFormSubmissionValid` / `validateFormSubmission` — 기존 함수명과 확장 충돌 없음
  - target 신규 식별자: `min`/`max`/`pattern` 검증 로직이 추가될 함수 이름
  - 기존 사용처: `form-mode.ts:145` — `validateFormSubmission`, `execution-engine.service.ts:4324` — `assertFormSubmissionValid`
  - 상세: 두 함수 모두 기존에 존재하며 확장 대상이다. 신규 함수명이 도입되지 않으므로 충돌 없음. `validateFormSubmission` 은 `FormModalField[]` 에 `min`/`max`/`pattern` 필드가 추가되면 해당 필드를 참조하는 분기를 추가하는 방식으로 확장된다.
  - 제안: 추가 조치 불요.

### 발견사항 5

- **[WARNING]** `pattern` 필드명 — `transform.handler.ts` 에 다른 의미의 `args.pattern` 존재
  - target 신규 식별자: `validation.pattern` (FormField 의 ValidationRule 서브 필드 — 정규표현식 문자열)
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/codebase/backend/src/nodes/data/transform/transform.handler.ts` — `args.pattern` (날짜 포맷 패턴 문자열, dayjs `format` 인자). 같은 코드베이스 내 `pattern` 이 두 가지 의미(정규식 vs 날짜 포맷)로 사용된다.
  - 상세: 네임스페이스가 완전히 분리돼 있다 (`formFieldSchema.validation.pattern` vs `TransformOperation.args.pattern`). 동일 모듈에서 혼용되지 않아 런타임 충돌은 없다. 단, 코드 리뷰 및 문서 작성 시 "pattern 필드"라고 하면 맥락 없이는 구분이 어려울 수 있다.
  - 제안: form.schema.ts / form-mode.ts 코드 주석에서 `validation.pattern` 을 "정규표현식 패턴" 으로 명시 (단순히 "pattern"이 아닌 "regex pattern" 표기). transform 쪽과의 혼동 위험은 낮으나 일관성 차원의 개선 권장.

---

## 요약

`spec/4-nodes/6-presentation/` 이 참조하는 `validation.min`/`max`/`pattern` 식별자는 이미 `form.schema.ts` 의 `validationRuleSchema` 에 선언돼 있어 스펙-코드 간 충돌이 없다. 에러 코드(`VALIDATION_ERROR`, `INVALID_FIELD`)와 에러 클래스(`FormValidationError`)도 기존 체계를 그대로 재사용하므로 신규 도입 없이 구현이 가능하다. 유일한 확장 포인트는 `chat-channel/types.ts` 의 `FormModalField` 인터페이스로, `min`/`max`/`pattern` 필드 추가가 필요하지만 기존 필드(`minLength`/`maxLength`)와 명명 충돌은 없다. `transform.handler.ts` 의 `args.pattern`(날짜 포맷)과 `validation.pattern`(정규식) 간 동명 이의어 존재는 WARNING 수준이나 네임스페이스가 분리돼 있어 충돌 위험은 낮다.

## 위험도

LOW
