# 부작용(Side Effect) Review

## 발견사항

- **[WARNING]** 실행 상세 페이지의 노드별 dry-run 배지 폭이 좁아짐 (execution-level dry-run 표시 손실)
  - 위치: `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx` (diff 라인 87, 262-269 제거) → `codebase/frontend/src/components/editor/run-results/result-detail.tsx:1165` (`isDryRunOutput(result.outputData) && <DryRunBadge />`)
  - 상세: 리팩터 이전 코드는 `(executionDryRun || isDryRunOutput(selectedNode.outputData))` 두 조건의 OR 로 배지를 노출했다. `executionDryRun` 은 `execution.dryRun === true` (부모 Execution 의 `dry_run` 컬럼) 로, dry-run 실행에 속한 **모든** NodeExecution 카드에 배지를 띄웠다. 리팩터 후 `ResultDetail` 은 `isDryRunOutput(result.outputData)` 단독 조건만 사용한다.
    `spec/5-system/13-replay-rerun.md` §7.2/§7.3 에 따르면 `_dryRun: true` 마커는 **`supportsDryRun: true`인 외부 부수효과 노드**(HTTP Request/Send Email/Database/cafe24)만 `buildDryRunMock()` 을 통해 출력에 심는다 (`codebase/backend/src/nodes/core/dry-run.util.ts`). 그 외 노드(Logic/Transform/Condition/AI 등, AI 는 §7.3 에 의해 LLM 호출 자체는 그대로 수행)는 dry-run 실행 하에서도 `outputData._dryRun` 을 갖지 않는다.
    결과적으로 dry-run 으로 실행된 실행의 비-외부효과 노드를 선택했을 때, 리팩터 이전에는 🧪 dry-run 배지가 표시됐으나 리팩터 이후에는 표시되지 않는다. spec §7.4 는 "노드 카드에 `🧪 dry-run` 배지"와 "출력 JSON 에 `_dryRun: true` 가 있으면 자동 강조"를 별개 항목으로 나열하고 있어, 노드 카드 배지가 실행 전체 dry-run 여부(`_dryRun` 마커 무관)를 반영해야 한다는 취지로 읽힌다. `ResultDetail`(에디터 run-results 드로어에서도 재사용) 은 PR #390 이래 원래 `isDryRunOutput` 단독 조건이었으므로 드로어 쪽은 원래부터 이 좁은 동작이었지만, 실행 상세 페이지는 이번 리팩터로 기존에 갖고 있던 넓은 폴백을 잃는다 (순수 회귀는 실행 상세 페이지 한정).
    `ResultDetail`(`ResultDetailProps`) 에는 execution-level dry-run flag 를 전달할 prop 이 없다 — page.tsx 도 `execution.dryRun` 을 더 이상 넘기지 않는다.
    테스트 커버리지 확인 결과 `execution-detail-page.test.tsx` 는 chain badge 의 dry-run 표기만 검증하고, 노드 상세 패널의 dry-run 배지(비-외부효과 노드 케이스)는 어느 테스트에도 없다 — 회귀가 침묵 상태로 유입.
  - 제안: `ResultDetail` 에 execution-level `executionDryRun?: boolean` prop 을 추가해 배지 조건을 `executionDryRun || isDryRunOutput(result.outputData)` 로 복원하거나, 의도된 축소라면 spec §7.4 문구를 "노드 자체가 `_dryRun` 마커를 가진 경우에만 배지" 로 명확히 정정하고 plan/RESOLUTION 에 근거를 남길 것. 어느 쪽이든 회귀 테스트(비-외부효과 노드 + dry-run 실행 조합)를 추가해 향후 재발을 막을 것.

- **[INFO]** WS 커맨드(emit) 위임 경로는 동등 — 실질적 부작용 변경 없음
  - 위치: `page.tsx` 구 `NodeResultsTab` 의 `handleFormSubmit/handleAiRenderFormSubmit/handlePortButtonClick/handleContinueClick/handleSendMessage/handleEndConversation` (제거됨) vs `result-detail.tsx:900-972` 의 동명 핸들러
  - 상세: 이전 페이지 로컬 핸들러와 `ResultDetail` 내부 핸들러를 나란히 비교하면 커맨드 호출(`commands.submitForm/clickButton/clickContinue/sendMessage/endConversation`) 과 뒤이은 `resumeFrom*` store 액션 호출 순서·인자가 1:1 대응한다. 차이점은 `ResultDetail` 쪽이 `executionId`/`result` null 가드를 추가로 두고 있다는 점 정도이며 (예: `if (!executionId) return;`), 이는 방어적 강화로 기존 기능 축소가 아니다. `useExecutionInteractionCommands(executionId)` 호출 위치가 페이지 레벨에서 `ResultDetail` 내부로 이동했으나 동일 `executionId` 인자로 훅을 호출하므로 emit 되는 WS 이벤트 이름·페이로드는 동등하다 (테스트 파일 2의 `execution.submit_form`/`execution.click_button` 검증도 그대로 통과 확인됨).
  - 제안: 없음 (정보 제공용).

- **[INFO]** 메시지 선택 상태(selectedMsgIndex) 리셋 경로는 의미 보존
  - 위치: `page.tsx` diff 라인 128-133 (auto-select 시 `setNodeDetailTab("preview")` → `setSelectedMsgIndex(null)`), 라인 219-229 (수동 클릭 시 `setNodeDetailTab(...)` → `setSelectedMsgIndex(null)`)
  - 상세: 이전에는 노드 전환 시 tab 을 명시적으로 계산해 설정했으나(`error`/`preview`/`output` 분기), 이제는 `nodeDetailTab` 상태 자체가 사라지고 `ResultDetail` 내부의 `activeTabNodeId !== result.nodeId` derived-state 가 노드 전환마다 `activeTab` 을 `result.error ? "error" : "preview"` 로 자체 리셋한다(`result-detail.tsx:988-992`). 페이지 쪽은 `selectedMsgIndex` 만 초기화하면 되므로 로직 이관이 합당하다. 단, 이전 클릭 핸들러는 `ne.outputData || ne.nodeId === waitingNodeId` 조건으로 "output" 도 하나의 착지 후보였으나 새 로직은 error/preview 두 갈래뿐이다 — `showTabs=false`인 경우(비-conversation, 비-terminal 상태) `NodeDetailTabs` 자체가 렌더되지 않으므로 tab 선택 자체가 무의미해 실질적 차이는 없다.
  - 제안: 없음 (정보 제공용).

- **[INFO]** BackgroundRunSection 위임 — 조건 동등
  - 위치: 구 코드 `page.tsx` diff 라인 384-392 vs `result-detail.tsx:1204-1213`
  - 상세: `selectedNode.node?.type === "background" && extractBackgroundRunId(...)` 조건이 `result.nodeType === "background" && executionId && extractBackgroundRunId(...)` 로 바뀌었다. 새 조건은 `executionId` non-null 가드가 추가됐을 뿐 실질적으로 페이지 컨텍스트에서는 항상 truthy(문자열 executionId) 이므로 동작 차이 없음.
  - 제안: 없음.

- **[INFO]** 시그니처 변경 — `NodeResultsTab` props 축소는 내부 함수 한정, 공개 API 아님
  - 위치: `page.tsx` diff 라인 101-109 (`executionDryRun` prop 제거)
  - 상세: `NodeResultsTab` 은 같은 파일 내부 전용 컴포넌트(export 되지 않음)이므로 시그니처 변경의 외부 호출자 영향은 없음. 다만 위 첫 WARNING 항목대로 이 prop 제거가 곧 dry-run 배지 폭 축소의 직접 원인이다.
  - 제안: 없음 (WARNING 항목 조치로 흡수).

- **[INFO]** 전역 상태·환경 변수·파일시스템·네트워크 신규 접근 없음
  - 상세: 두 diff 모두 React 컴포넌트 트리 재구성(props drilling → 컴포넌트 위임)과 로컬 state 변수 통합에 그친다. 새 전역 변수, 모듈 스코프 mutable 상태, 환경 변수 읽기/쓰기, 신규 네트워크 호출은 없다. `useExecutionStore`/`useExecutionInteractionCommands`/WS 클라이언트는 기존 동일 인스턴스를 그대로 사용한다.
  - 제안: 없음.

## 요약

이번 변경은 실행 상세 페이지의 노드 패널 렌더링을 에디터 run-results 의 `ResultDetail` 로 위임하는 리팩터로, WS 커맨드 emit 경로(submitForm/clickButton/clickContinue/sendMessage/endConversation)와 `resumeFrom*` store 호출은 이전 로컬 핸들러와 1:1 대응해 동등하며, 메시지 선택 리셋·BackgroundRunSection 위임도 실질적 차이가 없다. 다만 실행 상세 페이지가 갖고 있던 `execution.dryRun` 기반의 넓은 dry-run 배지 폴백(비-외부효과 노드도 dry-run 실행이면 배지 표시)이 `ResultDetail` 로 위임되며 사라졌다 — `ResultDetail` 은 노드 자체의 `outputData._dryRun` 마커만 검사하는 좁은 조건만 지원하고 execution-level dry-run 을 받는 prop이 없다. spec §7.4 문구("노드 카드에 배지" vs "출력 JSON 강조"를 별항목 나열) 및 기존 페이지 동작을 볼 때 이는 의도치 않은 사용자 가시적 회귀로 판단되며, 관련 테스트도 이 케이스를 커버하지 않아 침묵 유입됐다. 그 외 전역 상태·환경 변수·파일시스템·네트워크·공개 API 관점의 부작용은 발견되지 않았다.

## 위험도

MEDIUM
