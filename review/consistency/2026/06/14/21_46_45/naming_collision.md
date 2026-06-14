# 신규 식별자 충돌 검토 결과

## 발견사항

### [WARNING] `ValidationDetail` 인터페이스 중복 선언

- **target 신규 식별자**: `export interface ValidationDetail` — `/Volumes/project/private/clemvion/.claude/worktrees/eia-form-validation-0f0d83/codebase/backend/src/modules/execution-engine/workflow-errors.ts` (line 234)
- **기존 사용처**: `interface ValidationDetail` (unexported, file-private) — `/Volumes/project/private/clemvion/.claude/worktrees/eia-form-validation-0f0d83/codebase/backend/src/common/pipes/validation.pipe.ts` (lines 10–14)
- **상세**: 두 선언의 구조(`{ field: string; message: string; code: 'INVALID_FIELD' }`)가 동일하므로 런타임 충돌은 없다. 그러나 같은 이름의 인터페이스가 두 파일에 독립 선언되어 있다. `validation.pipe.ts` 의 선언은 file-scope `interface` (미export), `workflow-errors.ts` 의 선언은 `export interface` 다. `interaction.service.ts` 는 이미 `workflow-errors.ts` 에서 import 한다. 현재 단계에서 교차 import 는 없으나, 두 곳에 같은 이름·같은 구조가 분산되면 향후 한 쪽만 수정될 위험이 있다(단일 진실 원칙 위반).
- **제안**: `validation.pipe.ts` 의 file-private `ValidationDetail` 을 제거하고 `workflow-errors.ts` 에서 import 하여 단일 SoT 를 유지한다. 또는 `ValidationDetail` 을 `src/common/types/` 계층으로 승격해 양쪽이 공통 위치에서 import 하도록 한다.

---

### [INFO] `VALIDATION_ERROR` / `INVALID_FIELD` 가 `ErrorCode` enum 에 신설되나 기존 인라인 리터럴과 의미 중복

- **target 신규 식별자**: `ErrorCode.VALIDATION_ERROR = 'VALIDATION_ERROR'`, `ErrorCode.INVALID_FIELD = 'INVALID_FIELD'` — `/Volumes/project/private/clemvion/.claude/worktrees/eia-form-validation-0f0d83/codebase/backend/src/nodes/core/error-codes.ts` (lines 98–100)
- **기존 사용처**: `'VALIDATION_ERROR'` 문자열 리터럴이 `common/filters/http-exception.filter.ts:91`, `common/pipes/validation.pipe.ts:36`, `common/swagger/error-response.dto.ts:10`, `auth.service.ts:176,186,695,705`, `triggers.service.ts` 등 다수 파일에 인라인으로 쓰인다. `'INVALID_FIELD'` 는 `validation.pipe.ts:58,13` 에 인라인으로 쓰인다.
- **상세**: 코드 문자열 값(`'VALIDATION_ERROR'`, `'INVALID_FIELD'`)은 동일하므로 런타임 의미 충돌은 없다. 신규 `ErrorCode` enum 항목이 이 문자열들의 단일 진실이 되어야 하지만, 기존 인라인 리터럴 사용처들은 아직 enum 참조로 교체되지 않았다. 이는 충돌이 아닌 일관성 미완성이다.
- **제안**: 기존 `'VALIDATION_ERROR'`·`'INVALID_FIELD'` 인라인 리터럴을 `ErrorCode.VALIDATION_ERROR`·`ErrorCode.INVALID_FIELD` 참조로 순차 교체해 단일 진실을 완성한다. 본 diff 범위 밖이므로 별도 추적 plan 권장.

---

### [INFO] `spec/4-nodes/1-logic/9-foreach.md` 의 `VALIDATION_FAILED` 는 무관 코드로 잔존

- **target 신규 식별자**: `VALIDATION_ERROR` (form field 검증 실패)
- **기존 사용처**: `spec/4-nodes/1-logic/9-foreach.md:167` 에 `"code": "VALIDATION_FAILED"` 가 ForEach 노드 아이템별 에러 예시로 남아 있다.
- **상세**: ForEach 노드의 `VALIDATION_FAILED` 는 ForEach 내부 item-level 에러를 가리키며 form submit_form 검증 코드와 의미가 다른 별개 식별자다. 이 spec 은 본 diff 가 수정하지 않는 미변경 구역이다. 직접 충돌은 아니나, `VALIDATION_FAILED` vs `VALIDATION_ERROR` 두 코드가 spec 에 혼재하면 향후 독자가 혼동할 수 있다.
- **제안**: ForEach 노드 spec 의 `VALIDATION_FAILED` 가 실제 코드에서 어떤 값으로 발행되는지 확인 후, `VALIDATION_ERROR` 와 다른 의미라면 spec 에 "ForEach item 검증 실패 전용" 임을 명시해 혼동을 방지한다.

---

### [INFO] `spec/conventions/chat-channel-adapter.md` 의 main branch 에 `VALIDATION_FAILED + fieldErrors` 구형 참조 잔존

- **target 신규 식별자**: `VALIDATION_ERROR` + `error.details[{field,message,code}]`
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md` (main branch) lines 428, 449 에 `400 VALIDATION_FAILED + fieldErrors` 로 남아 있다.
- **상세**: worktree 의 해당 파일은 이미 `VALIDATION_ERROR` + `error.details[{field,message,code}]` 로 갱신되어 있어 worktree 내부에서는 충돌이 없다. 단, main 브랜치에 잔존하는 `VALIDATION_FAILED` 참조는 이번 PR 머지 후 main 에서 불일치를 만든다.
- **제안**: `spec/conventions/chat-channel-adapter.md` 의 main branch 에 잔존하는 `VALIDATION_FAILED + fieldErrors` 두 곳(lines 428, 449)을 본 PR 내에서 함께 교체하거나, 머지 직후 follow-up 으로 처리한다.

---

## 요약

신규 도입 식별자(`FormValidationError`, `ValidationDetail` export, `ErrorCode.VALIDATION_ERROR`, `ErrorCode.INVALID_FIELD`, `coerceFormValue`, `coerceFormSubmission`, `assertFormSubmissionValid`)는 기존 코드베이스에서 동일 이름·다른 의미로 사용되는 사례를 발견하지 못했다. 의미 충돌 위험은 없다. 다만 `ValidationDetail` 인터페이스가 `validation.pipe.ts` 에 file-scope 로 독립 선언되어 단일 진실이 분산되고(WARNING), `VALIDATION_ERROR`·`INVALID_FIELD` 가 기존 인라인 리터럴로 다수 파일에 쓰이는데 enum 참조로 일원화되지 않은 점(INFO), 그리고 ForEach spec 에 `VALIDATION_FAILED` 혼재(INFO) 및 main branch chat-channel-adapter spec 의 구형 코드 잔존(INFO)이 일관성 위험으로 확인된다.

## 위험도

LOW
