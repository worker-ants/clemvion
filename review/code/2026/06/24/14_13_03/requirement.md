# 요구사항(Requirement) 리뷰

## 리뷰 대상

- `codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.ts` (변경: skip clause 문자열 교체)
- `codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.spec.ts` (변경: 회귀 단언 2건 추가)

커밋: `86cd2a97` — `fix(workflow-assistant): system-prompt Self-review skip 안내를 코드에 정합 (finishBlockCount drift)`

---

## 발견사항

### [WARNING] [SPEC-DRIFT] spec §10 line 958 — `finishBlockCount > 0` skip 조건이 spec 본문에 잔존

- 위치: `spec/3-workflow-editor/4-ai-assistant.md` line 958 (§ "review skip 조건 (`shouldSkipReview`)")
- 상세:
  - `shouldSkipReview` 의 코드(`assistant-finish-guard.service.ts` line 327~340)에는 `finishBlockCount > 0` 체크가 이미 제거되어 있다 (M-3 2단계 PR #680). 같은 파일 line 318~320 주석도 "PLAN_NOT_COMPLETE 가 이미 fire 한 경우에도 review 는 발동한다"고 명시한다.
  - spec §10 Rationale "5. Review guard 항상 발동" (line 1072~1088)도 제거를 확정으로 설명한다.
  - 그러나 §"review skip 조건" 목록 본문(line 956~961)은 여전히 `state.finishBlockCount > 0` 항목을 열거하고 있어, spec 본문과 코드 사이에 불일치가 존재한다.
  - 커밋 메시지도 이를 인지해 "sibling PR #685 가 처리"라고 명시하고, consistency review(2026/06/24/14_03_16)에서 BLOCK:NO 판정을 받았다.
  - 코드 변경(PR #680 + 이번 PR)은 의도적이고 합리적이며 되돌리는 것이 오답이다. spec 갱신이 누락된 상태.
- 제안: 코드 유지. `spec/3-workflow-editor/4-ai-assistant.md` line 958 의 `- \`state.finishBlockCount > 0\` — PLAN_NOT_COMPLETE...` 항목을 삭제하고, 남은 skip 조건 목록이 코드 5개 조건(reviewCompleted / reviewRoundCount>=2 / planClearedThisTurn / 성공 edit 0 / non-trigger ≤1)과 1:1 대응하도록 갱신 필요. 반영 주체: `project-planner` (sibling PR #685 경로).

---

### [INFO] 테스트 단언 범위 — `doesNotSkipReview` 단언이 프롬프트 내 특정 위치를 고정하지 않음

- 위치: `system-prompt.spec.ts` line 832 (`expect(prompt).toMatch(/does NOT skip review/i)`)
- 상세: 단언은 문자열 존재 여부만 확인한다. 향후 "does NOT skip review"가 다른 섹션(예: Error handling)으로 이동해도 테스트는 통과한다. 현재는 Self-review 섹션 문맥 고정이 별도 헤더 단언(`expect(prompt).toMatch(/## Self-review before finish/)`)으로 보완되어 있어 실질적 위험은 낮다.
- 제안: 현재 단언 수준으로 충분. 추후 더 엄격한 섹션 로컬 단언이 필요하면 `prompt.slice(selfReviewIdx, nextSectionIdx)` 로 범위를 한정할 수 있다.

---

### [INFO] `shouldSkipReview` 에서 `reviewRoundCount >= 2` 조건이 시스템 프롬프트에 명시적으로 열거되지 않음

- 위치: `system-prompt.ts` line 382 (변경된 skip 안내 문장)
- 상세: 변경된 문장은 trivial / clear_plan / no-edit 세 조건만 명시한다. `reviewRoundCount >= 2` (≤ 2 review rounds) 는 step 5 prose(line 368)에 간접 언급되나 skip 조건 문장에는 포함되지 않는다. 코드 5조건 중 LLM이 직접 제어할 수 없는 서버-내부 조건(`reviewCompleted`, `reviewRoundCount >= 2`)은 LLM에게 안내할 실익이 작다는 설계 의도("LLM-제어 가능 항목만 유지")로 이는 의도적 생략이다.
- 제안: 현상 유지 적절. 설계 의도와 일치.

---

## 요약

이번 변경은 `system-prompt.ts`의 Self-review skip 안내 문자열에서 `PLAN_NOT_COMPLETE 발동 시 review skip` clause를 제거하고, "독립 계층 — plan 가드 이후에도 review 발동"을 명시한 동작 중립(behavior-neutral) 픽스다. 코드(`AssistantFinishGuard.shouldSkipReview`)가 M-3 2단계(PR #680)에서 이미 `finishBlockCount > 0` 체크를 제거한 것과 정확히 정합된다. 신규 회귀 단언 2건(`does NOT skip review` 포함 + 옛 clause 부재)은 미래 drift 재발을 구조적으로 방어한다. 기능 완전성·엣지 케이스·에러 시나리오·반환값 모두 변경 영향 없음(문자열 전용). 주요 잔여 항목은 spec §10 line 958 본문의 stale `finishBlockCount` 조건 — 코드가 옳고 spec이 낡은 SPEC-DRIFT로, sibling PR #685 경로로 별도 처리 중이다.

## 위험도

LOW
