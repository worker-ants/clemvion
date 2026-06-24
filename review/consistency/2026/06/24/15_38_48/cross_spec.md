# Cross-Spec 일관성 검토 결과

검토 모드: --impl-prep (구현 착수 전)
대상: M-4 park-진입 dispatch 추출 (`park-entry-dispatch.ts`, `buildParkEntryRegistry`)

---

## 발견사항

### WARNING: `interaction-type-registry.md` frontmatter `code:` 에 `park-entry-dispatch.ts` 미등재
- target 위치: `park-entry-dispatch.ts` (신규 파일) — `execution-engine.service.ts` 의 3개 park-entry 사이트 호출 측
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/spec/conventions/interaction-type-registry.md` frontmatter `code:` 목록 (line 4–12)
- 상세: 현재 `interaction-type-registry.md` 의 `code:` 섹션은 `resume-turn-dispatch.ts` 를 포함하지만, 이번 구현이 추가하는 `park-entry-dispatch.ts` 는 등재되지 않는다. `spec-sync-resume-dispatch-registry.md` (완료 plan) 의 W2 항목이 resume 측 파일을 frontmatter 에 등재한 선례(2026-06-13)가 있으며, park-entry 측도 같은 패턴을 따라야 일관성이 유지된다. interaction-type-registry §1.2 재개 turn 노트가 `resume-turn-dispatch.ts` 를 explicitly 언급하는데 park-entry 측 대응 노트가 없는 비대칭도 이 항목과 동행한다. target 설명 자체가 "spec 노트(interaction-type-registry.md §1.2 park-entry)는 후속 planner spec-sync PR" 로 명시 deferral 하고 있어 **이미 인지된 사항**이다.
- 제안: 구현 착수는 차단 불요. 다음 planner spec-sync PR 에서 (a) `interaction-type-registry.md` frontmatter `code:` 에 `codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts` 추가, (b) §1.2 매트릭스 하단 "재개 turn 라우팅 진입점" 노트에 대응하는 "park-entry 라우팅 진입점" 노트(`buildParkEntryRegistry` / `park-entry-dispatch.ts`) 추가 수행.

### INFO: `execution-engine.service.ts` 의 `WaitingInteractionType` 정의 위치가 spec §1.1 SoT 와 여전히 일치
- target 위치: `execution-engine.service.ts:194` (`export type WaitingInteractionType`)
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/spec/conventions/interaction-type-registry.md` §1.1 "단일 진실 위치" 표 Backend 행
- 상세: M-4 는 `WaitingInteractionType` enum 자체를 이동·변경하지 않으며, `execution-engine.service.ts` 잔류 상태는 §1.1 SoT 표와 정합한다. 충돌 없음 — 동기화 확인 목적 INFO.
- 제안: 불요.

### INFO: `park-entry-dispatch.ts` 의 우선순위(form → buttons → ai_conversation)가 `resume-turn-dispatch.ts` 의 우선순위 및 `interaction-type-registry.md §1.2` 노트와 정합
- target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts:99–118` (`buildParkEntryRegistry` 배열 순서)
- 충돌 대상: `interaction-type-registry.md §1.2` 재개 turn 라우팅 노트 "form → buttons → ai_conversation, first-match-wins"
- 상세: park-entry registry 우선순위가 resume registry 와 동일하게 form → buttons → ai_conversation 순서이며, `ai_form_render` 를 `ai_conversation` 핸들러가 처리하는 정책도 resume 측(`isAiConversation`)과 동일하다. 상호 모순 없음.
- 제안: 불요.

---

## 요약

M-4 park-진입 dispatch 추출은 behavior-preserving 리팩토링으로, 신규 데이터 모델·API 계약·요구사항 ID·상태 전이·권한 모델을 도입하지 않는다. 기존 spec 과의 실질적 충돌은 발견되지 않았다. 유일한 불일치는 `interaction-type-registry.md` frontmatter 및 §1.2 노트에 `park-entry-dispatch.ts` 가 등재되지 않는 spec drift 인데, target 설명 자체가 이를 "후속 planner spec-sync PR" 로 명시 deferral 하고 있어 기인지된 사항이다. `resume-turn-dispatch.ts` 등재(W2, 2026-06-13) 선례에 맞추어 후속 spec-sync 에서 동일 패턴으로 처리하면 충분하며, 구현 착수를 차단할 CRITICAL 항목은 없다.

---

## 위험도

LOW
