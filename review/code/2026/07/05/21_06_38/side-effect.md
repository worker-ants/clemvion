# 부작용(Side Effect) 리뷰 — use-result-detail-waiting 훅 추출 리팩터

대상 worktree: `.claude/worktrees/result-detail-props-hook-94eca4`
대상 파일:
- `codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx`
- `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx`
- `codebase/frontend/src/components/editor/run-results/use-result-detail-waiting.ts` (신규)

## 발견사항

이번 리팩터는 **동작 보존(behavior-preserving)** 을 의도한 순수 추출이며, 검증 결과 5개 체크포인트 전부 이상 없음.

- **[INFO]** Hook 호출 순서 vs early return — 규약 준수 확인
  - 위치: `run-results-drawer.tsx:123-136` (`useResultDetailWaiting()` 호출) vs `run-results-drawer.tsx:248` (`if (status === "idle") return null;`)
  - 상세: `useResultDetailWaiting()` 내부는 전부 `useExecutionStore(...)` 구독(React hook)이며, 이 호출이 idle early return **이전** 라인 123-136 에 위치. early return **이후**(라인 310-311)에 호출되는 것은 `deriveFlags(isSelectedWaiting)` 뿐이며, 이는 훅이 아니라 hook 내부에서 클로저로 생성된 순수 함수(`use-result-detail-waiting.ts:50-57`)라서 Rules of Hooks 위반이 아님. hook 자체의 JSDoc(`use-result-detail-waiting.ts:12-17`)에도 이 계약이 명시돼 있고 실제 구현이 그대로 지킴.
  - `page.tsx`(`NodeResultsTab`)에는 이 함수 안에 조건부 early return 이 훅 호출보다 먼저 오는 코드가 없음(모든 훅이 함수 최상단, `!nodeExecutions.length` 조기 반환은 라인 564 로 모든 훅 이후) — 문제 없음.
  - 제안: 없음 (규약 준수).

- **[INFO]** 소비처별 `isSelectedWaiting` 보존
  - 위치: drawer `run-results-drawer.tsx:302-306` (status==="waiting_for_input" && waitingNodeId!=null && (selectedResult?.nodeId===waitingNodeId || selectedResultNodeId===waitingNodeId), iteration-aware dual match) vs page `page.tsx:556-557` (`!!waitingNodeId && selectedNodeId === waitingNodeId`).
  - 상세: 두 소비처 모두 리팩터 전과 동일한 자체 `isSelectedWaiting` 정의를 유지하고, 이를 `deriveFlags(isSelectedWaiting)` 인자로만 전달(drawer: `run-results-drawer.tsx:310-311`, page: `page.tsx:559-560`). 훅이나 `deriveFlags` 내부에서 `isSelectedWaiting` 을 자체 계산하지 않음 — 확인됨.
  - 제안: 없음.

- **[INFO]** 11개 selector + 4개 resume 콜백 + `pendingFormToolCallId` 배선 무손실
  - 위치: `use-result-detail-waiting.ts:23-41` (waitingInteractionType, waitingFormConfig, waitingButtonConfig, waitingConversationConfig, conversationMessages, isWaitingAiResponse, pendingFormToolCallId(via selectPendingFormToolCallId), resumeFromForm, resumeFromAiRenderForm, resumeFromButtons, resumeFromConversation)
  - 상세: 리팩터 전 두 파일에 각각 인라인됐던 항목과 1:1 대응, 이름 변경·drop 없음. `run-results-drawer.tsx:312-315` 의 `isLiveConversation`(드로어 고유 로직, `ai_conversation || ai_form_render`)은 훅으로 옮기지 않고 드로어 자체 `waitingInteractionType`(hook 반환값)을 그대로 사용해 유지됨 — 정상.
  - `interaction-type-exhaustiveness.test.ts` 의 `REGISTRY_SITES` 가 4→3 파일로 축소되고 `use-result-detail-waiting.ts` 로 대체된 것도 실제 exhaustive 분기 위치 이동과 일치(문자열 리터럴 `"form"/"buttons"/"ai_conversation"/"ai_form_render"` 가 실제로 `deriveFlags` 안에 존재 — `use-result-detail-waiting.ts:51,52,55,56`).
  - 제안: 없음.

- **[INFO]** `deriveFlags` 공식이 원본 인라인 불리언과 동일
  - 위치: `use-result-detail-waiting.ts:50-57`
  - 상세: `isWaitingForm = isSelectedWaiting && waitingInteractionType === "form"`, `isWaitingButtons = isSelectedWaiting && waitingInteractionType === "buttons"`, `isWaitingConversation = isSelectedWaiting && (waitingInteractionType === "ai_conversation" || waitingInteractionType === "ai_form_render")`. diff (`refactor2.diff:71-78`, `refactor2.diff:243-250`) 의 삭제된 원본 인라인 코드와 토큰 단위로 동일. `ai_form_render` 가 `isWaitingForm` 이 아니라 `isWaitingConversation` 에 OR 로 흡수되는 뉘앙스도 유지 — hook 신규 unit 테스트(`use-result-detail-waiting.test.ts`)로 `ai_form_render→isWaitingConversation=true, isWaitingForm=false` 케이스가 명시적으로 커버됨.
  - 제안: 없음.

- **[INFO]** `waitingInteractionType` 페이지 destructure 제거의 영향 없음
  - 위치: `page.tsx` 리팩터 후 destructure(`page.tsx:523-535`)에 `waitingInteractionType` 미포함. 유일한 문자열 매치는 `page.tsx:138` 주석("waitingNodeId / waitingInteractionType 가 영영 update 안 되어") 뿐이며 이는 REST→store bridge 관련 일반 설명 주석으로 `NodeResultsTab` 스코프 밖(다른 컴포넌트, 라인 96-148 부근). `NodeResultsTab` 안에서 `waitingInteractionType` 을 실제로 소비하는 코드는 리팩터 전에도 오직 3-boolean 파생에만 쓰였고, 그 계산이 `deriveFlags` 로 이전됐으므로 별도 소비처 없음 확인.
  - 제안: 없음.

## 검증 절차

- 신규 hook unit 테스트(`use-result-detail-waiting.test.ts`, 5건) + `interaction-type-exhaustiveness.test.ts` 통과 확인 (vitest, 2 files / 7 tests passed).
- `src/components/editor/run-results` + `src/app` 하위 전체 회귀 테스트 실행 — 55 files / 552 tests 전부 통과.
- git log 확인: 이번 변경은 단일 커밋(`b6a9c6cf5`)으로 격리, 대상 3파일 외 다른 소스 변경 없음(테스트·spec/plan 문서 갱신 제외).

## 요약

`use-result-detail-waiting.ts` 훅 추출은 store selector 구독(hook)과 `isSelectedWaiting` 기반 파생(순수 함수 `deriveFlags`)을 명확히 분리해 Rules of Hooks 를 두 소비처 모두에서 지키고 있으며, 드로어의 `status === "idle"` early return 이전에 훅이 호출되는 것도 확인됐다. 두 소비처는 각자의 `isSelectedWaiting` 정의(드로어: iteration-aware dual match, 페이지: `selectedNodeId === waitingNodeId`)를 그대로 보존한 채 인자로만 전달하고, 11개 selector·4개 resume 콜백·`pendingFormToolCallId`·`ai_form_render→isWaitingConversation` 뉘앙스 모두 원본과 동일하게 배선돼 있다. 드로어 고유의 `isLiveConversation` 로직도 훅이 반환한 `waitingInteractionType` 을 그대로 사용해 변경 없이 유지된다. 페이지에서 `waitingInteractionType` 을 더 이상 destructure 하지 않는 것도 실제 미사용 확인으로 안전하다. 신규/기존 테스트(회귀 552건 포함) 전부 통과해 동작 보존 리팩터로서 부작용 위험이 발견되지 않았다.

## 위험도

NONE
