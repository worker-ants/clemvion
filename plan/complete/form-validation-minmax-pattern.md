---
worktree: form-validation-minmax-pattern-81db34
started: 2026-06-14
owner: developer
spec_impact:
  - spec/4-nodes/6-presentation/4-form.md
  - spec/5-system/6-websocket-protocol.md
  - spec/conventions/chat-channel-adapter.md
---

# A-1: form validation.min/max(숫자 범위)·pattern(정규식) 서버측 검증

> refactor-04 후속 (5차) 백로그 A-1. spec-sync-form-gaps.md 의 해당 미구현 항목 구현.
> spec §1 ValidationRule 에 min/max/pattern 이미 정의 + form.schema validationRuleSchema 에 zod 선언 존재
> → **신규 설계 없음, Planned→구현 상태 동기화**.

## 범위

- `chat-channel/shared/form-mode.ts` `validateFormSubmission` 확장: min/max(number 범위)·pattern(regex).
- `FormModalField` 타입(chat-channel/types.ts)에 `min?`/`max?`/`pattern?` 추가.
- `extractFormFields` 에서 `validation.min`/`max`/`pattern` 추출.
- EIA/WS/UI 3 경로 자동 공통 (publisher `continueExecution` chokepoint `assertFormSubmissionValid` 가 동일 validator 재사용).
- spec 동반 갱신 (같은 PR): form §6.2 Planned 행·§Rationale·assertFormSubmissionValid docstring·EIA §5.1·plan 체크박스.

## 검증 규칙 (FIRST 오류, 순서)

required → type(email/number) → minLength/maxLength → **min/max** → **pattern** → select/radio.

- **min/max**: `type==='number'` 한정, NUMBER_RE 통과 후 `Number(value)` 파싱해 범위 비교.
- **pattern**: `def.pattern` 존재 + 값 non-empty → `new RegExp(pattern)` 컴파일(실패 시 방어적 skip) → 미일치 시 오류. type 무관(custom regex).
- 메시지: 기존 minLength/maxLength 와 동일하게 default 메시지 (validation.message 미사용 — FormModalField 가 message 미보유, 기존 동작 일치).

## 체크리스트

- [x] consistency-check --impl-prep (BLOCK: NO — 22_22_50)
- [x] 테스트 선작성 (form-mode.spec.ts) — +7 케이스, 36 passed
- [x] 구현 (types.ts / form-mode.ts / execution-engine docstring)
- [x] spec 동반 갱신 (form §6.2·§Rationale / EIA §5.1 / assert docstring)
- [x] plan 체크박스 (spec-sync-form-gaps.md)
- [x] TEST WORKFLOW (lint ✓ / unit ✓ 42→ 전 suite / build ✓ / e2e ✓ 192) — link-integrity 깨진 앵커 3건(pre-existing) 동반 수정
- [x] /ai-review + SUMMARY (22_49_26 RISK LOW W3 fix → fresh 23_05_30 RISK LOW, W1 false-positive·INFO accept/defer, RESOLUTION 기록)
- [x] /consistency-check --impl-done (23_05_43 BLOCK: NO — 인접 spec 동기화 INFO 는 follow-up)
- [x] PR — #610

> 비차단 INFO follow-up(인접 spec 열거 동기화·통합 throw 테스트)은 standing plan `spec-sync-form-gaps.md` 에 등록됨. A-1 자체는 완결.

## impl-prep WARNING/INFO 반영

- W1: §6.2 Planned→구현 동기화로 자동 해소.
- W2/I3: form-mode.ts·types.ts 주석에 "regex pattern" 명시 (transform args.pattern 날짜포맷과 구분).
- I4: defer Rationale 갱신 — min/max/pattern 도 FIRST 오류 순서 따름 명시.
- I14: FormModalField min?/max?/pattern? 에 "서버측 검증 전용" JSDoc.
- I1/I2: EIA §5.1 details[] 길이 1·WS 미포함 비고 (소폭, 같은 PR 동반).
