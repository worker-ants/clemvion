# Testing Review

## 발견사항

### [INFO] 추가된 회귀 단언 2건 — 적절하고 충분함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.spec.ts` 라인 827–834
- 상세: 변경의 핵심인 (1) `does NOT skip review` 문구 존재 단언, (2) 삭제된 `already fired this turn (guard feedback loop already covered it)` 문구 부재 단언 — 두 단언 모두 drift 재발을 정확하게 방지한다. 테스트 의도 주석도 코드·spec 연결고리를 충분히 설명한다.
- 제안: 없음.

### [INFO] `AssistantFinishGuard.shouldSkipReview` 에 "PLAN_NOT_COMPLETE 후에도 review 발동" 을 직접 검증하는 테스트가 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.spec.ts`
- 상세: `shouldSkipReview` 의 5개 skip 분기(reviewCompleted / reviewRoundCount >= 2 / planClearedThisTurn / no successful edit / non-trigger <= 1)는 이미 `evaluateReviewGuard` describe 블록에서 각각 개별 테스트로 커버된다. 그러나 "PLAN_NOT_COMPLETE 가 발동한 상태(`finishBlockCount > 0`)에서도 `shouldSkipReview` 가 `false` 를 반환해 review 가 발동한다"는 명시적 케이스가 없다. 이 동작은 구현 코드(`shouldSkipReview`, lines 322–341)가 `finishBlockCount` 를 전혀 체크하지 않으므로 묵시적으로 보장되지만, 커밋 메시지가 강조하는 핵심 행동 변경임에도 `assistant-finish-guard.service.spec.ts` 에는 대응 테스트가 없다. `system-prompt.spec.ts` 의 단언 2건은 LLM 안내 문자열 레벨에서만 체크하므로, 코드 레벨 회귀 방지는 `assistant-finish-guard.service.spec.ts` 에 보완하는 것이 완전하다.
- 제안: `assistant-finish-guard.service.spec.ts` 의 `evaluateReviewGuard` describe 블록에 다음 케이스를 추가한다.
  ```ts
  it('PLAN_NOT_COMPLETE 가 이미 발동한 상태(finishBlockCount > 0)에서도 review 는 skip 되지 않는다 — 독립 계층', async () => {
    // finishBlockCount 가 양수여도 shouldSkipReview 는 해당 필드를 체크하지 않음
    const result = await review(
      freshState({ finishBlockCount: 1 }),
      [okEdit()],
    );
    // PLAN_NOT_COMPLETE 로 막힌 후 두 번째 finish 에서 review 가 발동해야 함
    expect(result).not.toBeNull();
  });
  ```

### [INFO] 테스트 격리 — 문제 없음
- 위치: `system-prompt.spec.ts` 전체
- 상세: 새 단언 2건은 기존 `it('teaches the 2-stage finish self-review routine ...')` 블록 내부에 추가됐다. `buildSystemPrompt` 호출은 상수 fixture(`defs`, `emptySnapshot`)를 사용하고, 단언은 독립적인 정규식 매칭이므로 테스트 간 상태 오염이 없다. `resetExpressionCacheForTesting` / `resetNodeCatalogCacheForTesting` 를 사용하는 캐시 테스트와도 분리되어 있다.

### [INFO] 커버리지 갭 — `reviewRoundCount >= 2` 상한 경계값 조합
- 위치: `assistant-finish-guard.service.spec.ts` 라인 212–215
- 상세: 현재 `reviewRoundCount: 2` (정확히 상한값) 케이스만 있고, `reviewRoundCount: 1` (미만) 케이스는 없다. 엄밀한 `>=` vs `>` 경계 검증을 위해 `reviewRoundCount: 1` 에서 skip 되지 않음을 추가하면 완결되나, 이는 이번 PR 변경 범위 외 기존 구현이므로 CRITICAL 이슈가 아니다.

## 요약

이번 변경은 프롬프트 문자열 drift 수정(behavior-neutral)이며, 테스트 추가 2건(`does NOT skip review` 존재 단언 + 삭제된 clause 부재 단언)이 함께 포함되어 회귀 방지가 직접적으로 구현되었다. 기존 46개 테스트 전체가 그대로 유효하고, 새 단언도 기존 `it` 블록 맥락에 자연스럽게 통합되어 가독성·격리·의도 표현 모두 양호하다. 단 하나의 개선 여지는 `assistant-finish-guard.service.spec.ts` 에 "PLAN_NOT_COMPLETE 발동 후에도 review 발동" 케이스를 코드 레벨 테스트로 명시하는 것이며, 현재는 구현 코드 구조상 묵시적으로만 보장된다. 이 갭은 LOW 수준이며 이번 PR 의 기능 정확성에는 영향이 없다.

## 위험도

LOW

STATUS: OK
