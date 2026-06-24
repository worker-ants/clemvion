# 신규 식별자 충돌 검토 결과

## 검토 대상

- **변경 범주**: `system-prompt.ts` 내 Self-review skip 안내 문자열에서 `'Review/verify is skipped ... when PLAN_NOT_COMPLETE already fired this turn'` 절 제거. `spec/3-workflow-editor/4-ai-assistant.md` Rationale `shouldSkipReview` 항목의 `finishBlockCount > 0` 스킵 조건 기술 정합.
- **식별자 도입 유무**: 없음. 이 변경은 기존 프롬프트 문자열 및 spec 본문에서 구문을 제거·수정하는 **behavior-neutral 정합화**이다. 새 엔티티·DTO·인터페이스·API 경로·이벤트명·환경변수·파일 경로가 추가되지 않는다.

---

## 발견사항

### [INFO] spec Rationale 의 `shouldSkipReview` 조건 목록과 코드 간 기존 불일치(pre-existing)

- target 신규 식별자: 없음 (target 이 도입하는 신규 식별자 없음)
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/spec/3-workflow-editor/4-ai-assistant.md` line 958
  ```
  - `state.finishBlockCount > 0` — PLAN_NOT_COMPLETE 가 이미 발동했다면 LLM 은 한 라운드 feedback 을 받았으므로 review 는 중복
  ```
  및 같은 파일 Rationale §"Review guard 항상 발동" (line 1078):
  ```
  `evaluateReviewGuard` 의 `shouldSkipReview` 에서 `finishBlockCount > 0` 체크 제거. 두 가드는 독립 계층으로 운영
  ```
  반면 코드 `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.ts` line 322–341의 `shouldSkipReview` 는 `finishBlockCount` 를 체크하지 않는다(이미 제거 완료).
- 상세: 이 불일치는 target 이 도입한 것이 아닌 **pre-existing** 상태이다. Rationale §5 (line 1072–1088) 에서 `finishBlockCount > 0` 제거 결정을 정확히 기술하고 있으나, 동일 spec 의 earlier section `##### review skip 조건` (line 952–961) 이 결정 반영 전 목록을 그대로 유지하고 있다. target 변경(prompt-string 정합화)이 이 spec 내 불일치를 외부로 드러낸다.
- 제안: target 변경과 같은 커밋 또는 동일 PR 에서 spec line 958 의 `state.finishBlockCount > 0` 불렛을 삭제하고 line 954 의 주석 `시스템 프롬프트의 Self-review 섹션 설명과 반드시 동기화 유지` 조건도 갱신된 목록을 반영해 재확인한다. 이 spec 항목은 "충돌" 이 아니라 구식(stale) 기술이므로 CRITICAL/WARNING 이 아니다.

### [INFO] system-prompt.ts line 382 `Note:` 절 — 현재 이미 올바른 방향으로 기술됨

- target 신규 식별자: 없음
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.ts` line 382
  ```
  Note: a prior PLAN_NOT_COMPLETE this turn does NOT skip review — plan completeness and workflow-quality review are independent layers, so review can still fire after the plan guard passes.
  ```
- 상세: 현재 프롬프트 텍스트는 이미 `does NOT skip review` 로 코드 동작과 정합한 방향으로 기술되어 있다. target 변경이 제거하려는 clause 는 이 `Note:` 문장 전체 또는 해당 Note 를 포함한 상위 `Review/verify is skipped automatically when ...` 단락 전체다. 제거 후 LLM 에게 노출되는 skip 조건 목록이 단순해져 혼동 여지가 없어진다. 새 식별자를 도입하지 않으므로 충돌 없음.
- 제안: 제거 후 남은 skip 조건 열거가 spec line 952–961 의 최종 목록(`reviewCompleted`, `reviewRoundCount >= 2`, `planClearedThisTurn`, 성공 edit 0, non-trigger ≤ 1) 과 일치하는지 재확인한다.

---

## 요약

target 변경은 `system-prompt.ts` 내 문자열 구문을 제거하는 behavior-neutral 정합화이며, 새로운 식별자(요구사항 ID, 엔티티명, API 경로, 이벤트명, 환경변수, 파일 경로)를 전혀 도입하지 않는다. 명명 충돌 위험은 NONE이다. 다만 `spec/3-workflow-editor/4-ai-assistant.md` 의 `##### review skip 조건` 항목(line 958)에 `finishBlockCount > 0` 이 여전히 나열되어 있는데, 이는 같은 파일 Rationale §5 의 "제거" 결정과 상충하는 pre-existing stale 기술로 target 변경과 동행 수정이 권장된다. 충돌 항목 없음.

---

## 위험도

NONE
