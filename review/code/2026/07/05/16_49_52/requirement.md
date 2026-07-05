# 요구사항(Requirement) 리뷰 — V-05 execution-detail ResultDetail 재사용

## 발견사항

- **[CRITICAL]** `toNodeResult()` 가 `inputData` 를 매핑하지 않아 Input 탭이 영구 "로드 중" 플레이스홀더만 표시
  - 위치: `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx:475-487` (`toNodeResult`), 소비처 `codebase/frontend/src/components/editor/run-results/result-detail.tsx:334-338`
  - 상세: 리팩터 전에는 `NodeResultsTab` 이 `nodeDetailTab === "input"` 일 때 `<JsonViewer data={selectedNode.inputData} />` 로 `NodeExecutionData.inputData` 를 직접 렌더했다(diff `-JsonViewer data={selectedNode.inputData}` 참고). 리팩터 후 `ResultDetail` 은 `NodeResult.inputData` 만 읽는데, `toNodeResult()` 는 `nodeId/nodeLabel/nodeType/nodeCategory/status/duration/error/outputData` 만 채우고 `inputData`(및 `startedAt`)는 세팅하지 않는다. `ResultDetail`(result-detail.tsx:334-338)은 `result.inputData != null` 이 아니면 `t("editor.runResults.loadingInput")`("입력 데이터 로드 중...") 를 렌더 — 실제로는 로드 실패가 아니라 필드가 애초에 비어 있어 **모든 노드**에서 Input 탭이 영구히 placeholder 로만 보인다. 스펙 §3.3 은 서브탭에 Input 을 명시("서브 탭(노드 레벨): Preview / **Input** / Output / ...")하므로 이는 EH-DETAIL-03 §3.3 요구사항 위반. `apply-execution-snapshot.ts:101-102`(`inputData: ne.inputData, startedAt: ne.startedAt`)와 `run-results-drawer.tsx` 등 다른 소비처는 정상적으로 이 필드를 채우고 있어 이 파일만의 국지적 누락으로 확인됨. 회귀를 잡는 unit 테스트도 없음(Input 탭을 클릭해 내용을 assert 하는 테스트 부재 확인).
  - 제안: `toNodeResult()` 에 `inputData: ne.inputData, startedAt: ne.startedAt` 추가.

- **[CRITICAL]** 같은 이유로 헤더의 노드 시작 시각(`startedAt`)이 실행 상세 페이지에서 사라짐
  - 위치: `page.tsx:475-487` (`toNodeResult`), 소비처 `result-detail.tsx:1167-1171`
  - 상세: 리팩터 전 헤더는 `{selectedNode.startedAt ? formatDate(...) + " · " : ""}{formatDuration(...)}` 로 시작 시각+소요시간을 함께 표시했다(diff 참고). `ResultDetail` 헤더는 `result.startedAt` 이 있을 때만 `formatDate` 를 렌더하는데(`result-detail.tsx:1167`), `toNodeResult` 가 `startedAt` 을 세팅하지 않으므로 실행 상세 페이지에서는 이 필드가 항상 `undefined` → 시작 시각이 영구히 표시되지 않는다(소요 시간만 남음). 좌측 노드 목록에는 여전히 `ne.startedAt` 직접 사용(`formatDate(ne.startedAt, "time-seconds")`, page.tsx:1031)이 남아 있어 목록/상세 패널 간 시각 정보 표시가 비대칭이 된다.
  - 제안: 위와 동일 수정(`toNodeResult` 에 `startedAt` 추가)으로 해결.

- **[WARNING]** dry-run 배지 표시 범위가 실행 전체 → 노드별 마커 존재 여부로 축소됨 (동작 변경)
  - 위치: diff `-executionDryRun={execution.dryRun === true}` (page.tsx 제거분) / `result-detail.tsx:1165` `isDryRunOutput(result.outputData) && <DryRunBadge />`
  - 상세: 리팩터 전 배지 조건은 `executionDryRun || isDryRunOutput(selectedNode.outputData)` — 부모 `Execution.dryRun===true` 이면 해당 실행에 속한 **모든** 노드 상세에 배지가 떴다(spec §7.4 "노드 카드에 🧪 dry-run 배지"). 리팩터 후에는 `isDryRunOutput(result.outputData)` 단독 — 즉 그 노드의 `outputData._dryRun===true` 마커가 있는 노드(외부 부수효과 카테고리, §7.1)에만 배지가 뜨고, dry-run 실행 중이지만 정상 실행된 Logic/Flow/Data/AI/Presentation 노드(§7.1/§7.3)에는 더 이상 배지가 안 뜬다. spec §9.2 문언("dry-run 모드로 실행된 NodeExecution 은 `outputData._dryRun === true` 로 식별")은 새 동작과 더 정확히 부합하지만, 사용자가 "이 실행 전체가 dry-run 이었는지" 를 개별 노드 상세에서 더 이상 한눈에 확인할 수 없다는 점에서 가시적 축소다. 의도적 개선인지 실수인지 diff 코멘트에서 명시적으로 밝히지 않아 SPEC-DRIFT 로 단정하지 않고 WARNING 으로 남김.
  - 제안: 의도된 변경이면 spec §7.4/§9.2 에 "노드별 배지는 해당 NodeExecution 의 `_dryRun` 마커 기준" 임을 명시하는 문구 보강 검토(project-planner). 의도치 않은 축소라면 executionId 대응 `execution.dryRun` 을 다시 `ResultDetail` 에 prop 으로 흘려 OR 조건 복원.

- **[INFO]** V-05 diff 자체는 스펙 §3.3/§3.4/§3.4.1/§3.4.2 서브탭 요구사항(Preview/Input/Output/Config/LLM Usage/Response/Request/References/Error, 메시지 레벨 전환, 기본 탭 규칙 "에러면 Error, outputData 있으면 Preview, 그 외 Output")을 `ResultDetail`/`NodeDetailTabs` 로 line-level 로 정확히 재구현하고 있음. `execution-detail-waiting.test.tsx` 신규 테스트 2건(완결 AI 노드 Config+LLM Usage, 완결 일반 노드 Config만) 통과 확인, 전체 8/8 통과. live waiting 상호작용(form/buttons/conversation, `useExecutionInteractionCommands`)도 `ResultDetail` 내부로 이동했을 뿐 커맨드 배선(`commands.submitForm/clickButton/sendMessage/endConversation` 등)이 보존되어 있고 관련 waiting 테스트(form/buttons submit, WS emit, waitingNodeId 리셋, 재-auto-select 방지) 모두 통과 — 회귀 없음.
  - 위치: `codebase/frontend/src/components/editor/run-results/result-detail.tsx` 전체, `spec/2-navigation/14-execution-history.md §3.3/§3.4/§3.4.1/§3.4.2`
  - 상세: 별도 조치 불필요, 참고용 확인 기록.

## 요약

V-05 리팩터는 실행 상세 페이지의 노드 상세 패널을 에디터 `ResultDetail` 재사용으로 통일해 스펙 §3.3/§3.4/§3.4.1/§3.4.2 이 요구하는 Config·LLM Usage·메시지 레벨(Response/Request/LLM Usage)·References 서브탭 구성을 정확히 구현했고, waiting 상호작용(form/buttons/conversation) 배선도 손실 없이 보존됐다(관련 테스트 전부 통과). 다만 `toNodeResult()` 변환 함수가 `NodeExecutionData` 의 `inputData`/`startedAt` 필드를 새 `NodeResult` 타입에 매핑하지 않아, 실행 상세 페이지에서 Input 탭이 항상 빈 placeholder 로만 뜨고 노드 상세 헤더의 시작 시각이 사라지는 두 가지 실질 회귀가 발생했다 — 둘 다 스펙이 명시한 서브탭/필드(§3.3 Input, §3.2/헤더 시작 시각)를 무효화하므로 CRITICAL 로 분류한다. 부가적으로 dry-run 배지 노출 범위가 실행 전체 기준에서 노드별 마커 기준으로 좁아진 동작 변경이 있어 의도 확인이 필요하다(WARNING).

## 위험도

HIGH
