# 정식 규약 준수 검토 결과

**대상**: `codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.ts` 및 `system-prompt.spec.ts` (커밋 86cd2a97, diff-base=origin/main)
**관련 spec**: `spec/3-workflow-editor/4-ai-assistant.md`
**검토 일시**: 2026-06-24

---

## 발견사항

### 발견사항 1
- **[WARNING]** `spec/3-workflow-editor/4-ai-assistant.md` line 958 — spec 본문이 구현과 불일치 상태(stale)
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §§ "review skip 조건 (`shouldSkipReview`)", line 958
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — "**시스템 프롬프트의 Self-review 섹션 설명과 반드시 동기화 유지**" (spec 본문 line 954 자체에도 동기화 의무 명시). `spec-impl-evidence.md §2.1` — `status: implemented` spec 의 `code:` 경로가 실제 구현과 정합을 유지해야 함.
  - 상세: `system-prompt.ts` 는 이번 PR 에서 `PLAN_NOT_COMPLETE already fired this turn (guard feedback loop already covered it)` 조건을 review skip 사유에서 제거했으나, spec line 958 에는 `state.finishBlockCount > 0 — PLAN_NOT_COMPLETE 가 이미 발동했다면 LLM 은 한 라운드 feedback 을 받았으므로 review 는 중복` 이 여전히 skip 조건 목록에 잔류한다. 구현(`AssistantFinishGuard.shouldSkipReview`)과 spec 서술이 정반대다. 본 PR 의 prompt 변경·test regression assertion 이 이 drift 를 탐지하고 수정한 것이지만, spec 본문 자체는 갱신되지 않았다. `spec/3-workflow-editor/4-ai-assistant.md` 의 line 954 주석("시스템 프롬프트의 Self-review 섹션 설명과 **반드시** 동기화 유지")은 spec ↔ 프롬프트 ↔ 구현 세 곳의 동기화 의무를 명시하는데, 이번 PR 은 프롬프트·구현 두 곳만 정정하고 spec 은 남겼다.
  - 제안: `spec/3-workflow-editor/4-ai-assistant.md` line 958 의 `state.finishBlockCount > 0 — PLAN_NOT_COMPLETE 가 이미 발동했다면 LLM 은 한 라운드 feedback 을 받았으므로 review 는 중복` 항목을 제거하고, 이 변경의 배경(plan 가드와 review 가드는 독립 계층)을 해당 절 또는 Rationale 에 한 줄 추가한다. 본 PR 에서 spec 수정 권한이 없으면(`developer` SKILL spec read-only) `project-planner` 에 위임해 sibling PR #685 에서 처리하거나 그 PR 내에서 갱신한다. (PR 설명은 이미 "sibling PR #685(planner) 가 처리" 라고 명시하고 있으므로, 해당 plan PR 에서 반드시 line 958 을 제거해야 한다 — 이 발견사항은 그 처리가 실제로 이뤄졌는지 확인을 위한 플래그다.)

### 발견사항 2
- **[INFO]** `system-prompt.spec.ts` 신규 테스트 주석 — conventions 적 문제 없음, 서술 완결성 확인
  - target 위치: `system-prompt.spec.ts` line 749–756 (신규 추가 `expect` 블록)
  - 위반 규약: 해당 없음. `spec/conventions/` 어느 규약도 위반하지 않음.
  - 상세: 추가된 regression assertion 2건 (`does NOT skip review` 매치, `already fired this turn (guard feedback loop already covered it)` 비매치) 은 명명·포맷·문서구조·API규약 어느 규약에도 저촉되지 않는다. 주석도 의미가 명확하다.
  - 제안: 없음.

### 발견사항 3
- **[INFO]** `system-prompt.ts` 수정된 문장 — 규약 준수 확인
  - target 위치: `system-prompt.ts` line 382 (수정된 review-skip 안내 문장)
  - 위반 규약: 해당 없음.
  - 상세: 삭제된 `when \`PLAN_NOT_COMPLETE\` already fired this turn (guard feedback loop already covered it)` 절과 추가된 `Note: a prior \`PLAN_NOT_COMPLETE\` this turn does NOT skip review — plan completeness and workflow-quality review are independent layers, so review can still fire after the plan guard passes.` 문장은 `spec/conventions/error-codes.md`, `spec/conventions/swagger.md`, `spec/conventions/node-output.md` 등 어느 규약에도 저촉되지 않는다. 에러 코드(`PLAN_NOT_COMPLETE`, `WORKFLOW_REVIEW_REQUIRED`)는 기존 정의된 코드를 참조하는 것으로 신규 발행이 아니다.
  - 제안: 없음.

---

## 요약

정식 규약 준수 관점에서 이번 변경(`system-prompt.ts` + `system-prompt.spec.ts`)은 규약 직접 위반이 없다. 유일한 발견사항은 `spec/3-workflow-editor/4-ai-assistant.md` line 958 의 stale skip 조건이 구현 및 수정된 프롬프트와 불일치한다는 점으로, spec 본문 line 954 자체가 "프롬프트·구현과 반드시 동기화 유지"를 명시하는 맥락에서 WARNING 등급이다. 단, PR 설명에 따르면 이 spec 수정은 sibling PR #685(planner) 가 담당하도록 위임됐으므로 해당 PR 에서 반드시 이행되어야 한다.

---

## 위험도

**LOW** — 구현 코드·프롬프트·테스트는 서로 일관하며 동작 중립(behavior-neutral) 변경이다. 위험은 spec line 958 stale 잔류가 다음 검토자나 LLM 에게 혼란을 줄 수 있다는 문서 레이어 drift 에 한정된다. sibling PR #685 에서 처리되지 않으면 `spec-impl-evidence.md` 의 동기화 의무(line 954)를 계속 위반하게 된다.
