# RESOLUTION — M-3 2단계 (AssistantFinishGuard 추출)

대상 커밋: `1c17795c`
SUMMARY: 본 디렉터리 `SUMMARY.md` — **Risk LOW, Critical 0, Warning 1, INFO 2**

## 처분 요약

| # | 등급 | 처분 | 근거 |
|---|------|------|------|
| W-1 | Warning (Architecture) | **Defer** | `evaluateReviewGuard` 9-param 시그니처는 원본 `WorkflowAssistantStreamService` 메서드에서 **verbatim 이전** — 이전 전부터 존재. 파라미터 객체화는 behavior 무관 시그니처 변경이라 behavior-preserving 추출 PR 범위 밖. 리뷰어도 "현재 규모 즉각 블로킹 아님" 명시. 별건 후보. |
| INFO-1 | Info (Requirement) | **Defer (planner)** | spec §10 SPEC-DRIFT(`finishBlockCount>0` skip 제거·노드 수 verify 임계값) — 코드가 옳고 spec 이 낡음. 본 PR 코드 무변(이전 전부터 drift). planner 영역. |
| INFO-2 | Info (Architecture) | **Defer** | 구체 클래스 주입(인터페이스 부재) — 모듈 내 기존 패턴과 일관. 비차단. |

**코드 변경 없음 → 재리뷰 불요. 수렴.**

## 근거 상세

본 PR 의 단일 책임은 `streamMessage` 에 혼재하던 2단계 finish/review 가드(spec 3-workflow-editor §10)를 무상태 collaborator `AssistantFinishGuard` 로 **분리**하는 behavior-preserving 리팩터링이다. 이동된 3개 메서드(`evaluateFinishGuard`/`evaluateReviewGuard`/`shouldSkipReview`)·상수(`MAX_REVIEW_ROUNDS` 등)·타입(`FinishGuardState`/`FinishGuardError`)은 전부 **verbatim** 이며, 유일한 in-body 변경은 `this.collectPendingUserConfig(...)` → 공유 헬퍼 호출 1줄(동작 동일)이다. 따라서 W-1 의 시그니처 형태·INFO-1 의 spec drift 는 모두 이전 전부터 존재하던 사안으로, 이 PR 에서 손대면 추출의 순수성을 깨고 회귀 표면을 늘린다 (M-3 1단계·M-8·C-2 와 동일 규율).

## 검증 상태 (구현 시점, GREEN)
- lint·build(docker)·unit(backend 포함 전체, frontend flaky 1건 재실행 통과) PASS
- **e2e 214 PASS** — Nest DI 부팅 + 멀티턴 park/resume 가드 동작 검증
- 신규 가드 단위 `assistant-finish-guard.service.spec.ts` 12 PASS (evaluateFinishGuard 전 분기 + shouldSkipReview 판정)
- 기존 통합 `workflow-assistant-stream.service.spec.ts` 381 무변 green (가드 발동·재발동·통과 전부 보존)
