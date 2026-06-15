# 요구사항(Requirement) 리뷰 — execution §1.3 단일 노드 실행

**리뷰 대상 spec**: `spec/3-workflow-editor/3-execution.md §1.3 / §9`
**리뷰 일시**: 2026-06-15
**파일 수**: 16개 (SQL 1, TypeScript 11, TSX 2, MD 2)

---

## 발견사항

### **[INFO]** 기능 완전성: §1.3 핵심 요구사항 모두 구현됨

- 위치: 전체 변경셋
- 상세: spec §1.3 표의 4개 행 (트리거·진입점·범위·입력 데이터) 및 메커니즘 주석, §9 API 행이 코드에 선명하게 반영됐다.
  - 트리거: `workflow-canvas.tsx` 우클릭 메뉴 "이 노드 실행" (`handleNodeMenuAction("run")`) — spec "노드 우클릭 → 이 노드 실행" 일치.
  - 진입점: `POST /api/workflows/:id/nodes/:nodeId/execute` — spec §9 행 일치.
  - 범위: `seedInitialReachability([singleNodeId])` + 노드 실행 직후 `break` — spec "해당 노드만 실행, downstream 미진행" 일치.
  - 입력: `seedSingleNodePredecessorOutputs` 로 predecessor 출력 pre-seed, 미지정 시 수동 입력 fallback — spec "previousExecutionId 상류 출력 자동 주입, 미지정 시 body `input` 대체" 일치.
  - 출력: `resultNodeId = singleNodeId ?? ...` 로 대상 노드 outputData 마감 — spec "새 Execution 으로 기록" 일치.
- 제안: 없음 (INFO).

---

### **[INFO]** 출력 표시: 설정 패널 Info 탭 결과 표시 구현

- 위치: `node-settings-panel.tsx` InfoTab
- 상세: spec §1.3 "설정 패널 Info 탭에 결과(출력/오류/소요) 표시" 요구 중 출력(outputData)·오류(error)·소요(duration ms) 세 요소가 `latestResult` 객체에서 모두 렌더링된다. `nodeResults` 배열을 역순 탐색해 해당 `nodeId` 의 가장 최근 결과를 꺼내는 로직은 루프 반복(iter) 포함 최신 결과를 정확히 선택한다.
- 제안: 없음 (INFO).

---

### **[INFO]** Run Results 드로어 연동: 일반 실행과 동일 surface 재사용

- 위치: `workflow-canvas.tsx` `handleRunThisNode` 함수
- 상세: spec §1.3 "Run Results 드로어에 노드 타임라인" 요구는 `startExecution(executionId)` 호출로 달성된다 — 일반 실행과 동일한 executionId 기반 WS 채널 구독·드로어 표시 경로를 재사용한다. spec R-1.3 Rationale "전용 call-log 엔티티 미도입 — Execution 행 재사용" 결정에 부합한다.
- 제안: 없음 (INFO).

---

### **[INFO]** 에러 처리: handleRunThisNode 에서 에러를 `console.error` 로만 처리

- 위치: `workflow-canvas.tsx` `handleRunThisNode` catch 블록 (라인 ~1200)
- 상세: API 호출 실패(400/503/네트워크 오류)가 catch 되어 `console.error` 만 기록하고 사용자에게 아무 피드백이 없다. 사용자는 "이 노드 실행"을 클릭했을 때 아무 일도 일어나지 않는 것처럼 보인다. spec §1.3 에는 프론트엔드 에러 표시 형태가 명시되지 않으므로 spec 위반은 아니지만, UX 품질 관점에서 토스트·인라인 에러 표시 등 최소한의 사용자 피드백이 바람직하다. 동일 패턴의 향후 확장(blocking 노드 지원) 시에도 동일한 조용한 실패가 발생한다.
- 제안: spec 범위 밖이므로 강제는 아니나, 최소한 토스트 알림으로 "노드 실행 실패: {error.message}" 를 표시하는 것을 권장한다.

---

### **[WARNING]** 엔진 루프에서 disabled 노드가 `singleNodeId` 일 때 동작 미정의

- 위치: `execution-engine.service.ts` `runExecution` 루프, `handleDisabledNode` 분기
- 상세: `reachable` 에는 `singleNodeId` 만 포함되므로 해당 노드가 disabled 이면 `handleDisabledNode` 가 호출된 후 `pointer++; continue;` 로 루프가 종료된다. 이 경우 `break` 가 수행되지 않으므로 루프는 정상 종료하나, `resultNodeId = singleNodeId` 로 지정된 노드의 `outputData` 는 `nodeOutputCache` 에 없어 `savedExecution.outputData = {}` 로 마감된다. spec §1.3 메커니즘 주석("범위 한계 v1: 최상위 비-blocking 노드")에서 disabled 노드를 별도 언급하지 않아 정의가 부재한다. 실행 결과는 `outputData: {}` 로 마감돼 COMPLETED 상태가 되므로 완전한 버그는 아니지만, 의도치 않은 조용한 빈 결과가 발생할 수 있다.
- 제안: (a) disabled 노드를 `singleNodeId` 로 지정 시 컨트롤러 레벨에서 400 반환하거나, (b) 엔진에서 disabled 노드 감지 시 실행 실패 처리. v1 범위 외로 defer 할 경우 spec §1.3 범위 한계에 "disabled 노드 지정 시 동작 미보장" 을 1행 명시.

---

### **[WARNING]** `seedSingleNodePredecessorOutputs`: `adaptHandlerReturn` 가 null/정의 안 된 인자 수용 여부 미검증

- 위치: `execution-engine.service.ts` `seedSingleNodePredecessorOutputs` (라인 ~7800)
- 상세: `row.outputData != null` 조건으로 null 행은 걸러내지만, `storedOutput` 이 non-null 이면서 `typeof storedOutput !== 'object'` 인 경우(예: 문자열 scalar)가 가능하다. 이 경우 `isCanonical` 검사는 false 를 반환하고 `wrapBareAsNodeHandlerOutput(storedOutput)` 이 호출되어 lenient wrapper 경로로 진입한다. `wrapBareAsNodeHandlerOutput` 의 내부 동작이 비-객체 입력을 얼마나 견고하게 처리하는지는 이번 diff 에서 확인되지 않는다. spec §1.3 에는 `NodeExecution.output_data` 형식이 "canonical `{config, output, ...}` 형태" 로 명시되어 있어 실제 운영 데이터에서는 정상 케이스이나, 레거시 row 또는 비정상 데이터가 섞인 경우 예외가 발생해 단일 노드 실행 전체가 실패할 수 있다.
- 제안: `wrapBareAsNodeHandlerOutput` 호출 전 `storedOutput` 이 object 타입인지 확인하거나, try-catch 로 감싸 seed 실패를 수동 입력 fallback으로 연결. 또는 해당 함수가 scalar 입력을 정상 처리함을 단위 테스트로 검증.

---

### **[WARNING]** `previousExecutionId` 가 타 워크플로우 실행인지 검증 후 실행 엔진에 그대로 전달 — 워크스페이스 격리 이중 검증 없음

- 위치: `workflows.controller.ts` executeNode (라인 ~956–968)
- 상세: 컨트롤러는 `executionRepository.findOneBy({ id: previousExecutionId, workflowId: id })` 로 동일 워크플로우 소속 여부를 검증한다. 단 워크플로우 자체의 워크스페이스 소속 확인은 `workflowsService.findById(id, workspaceId)` 가 담당하며, 이 검증이 먼저 수행되므로 교차 워크스페이스 IDOR 는 기존 guard 로 방지된다. 이는 올바른 구현이나, `previousExecutionId` 의 워크스페이스를 직접 검증하지 않고 `workflow_id` 조인으로만 확인하는 간접 방식임을 인지할 필요가 있다. 이후 워크플로우가 다른 워크스페이스로 이동되는 기능이 추가될 경우 이 검증이 약해질 수 있다. 현재 spec 에서는 워크플로우 이동 기능이 없으므로 현재 구현은 충분하다.
- 제안: 현재 spec 범위 내 충분함. 워크플로우 이동 기능 추가 시 검증 로직 재검토 필요.

---

### **[INFO]** `handleRunThisNode` 내 `execState.status === "running"` 가드 — 진행 중 실행과 단일 노드 실행 경합 방지

- 위치: `workflow-canvas.tsx` `handleRunThisNode` (라인 ~1187)
- 상세: 실행 중 상태에서 "이 노드 실행"을 클릭하면 조용히 무시(`return`)된다. spec §1.3 에 이 경우의 동작 명세가 없으므로 spec 위반은 아니다. 단 사용자가 실행 중에 단일 노드를 실행하려면 현재 실행이 끝날 때까지 기다려야 하는데, UI 에서 이를 알려주지 않는다. 앞서 언급한 조용한 에러 처리와 같은 패턴.
- 제안: 실행 중 클릭 시 "실행 중 — 현재 실행이 완료된 후 시도하세요" 등 토스트 표시 권장.

---

### **[INFO]** `getLatestPredecessorOutputs`: 컨테이너 반복 등 다중 NodeExecution 처리 정확

- 위치: `execution-engine.service.ts` `getLatestPredecessorOutputs` (라인 ~7840)
- 상세: `finishedAt DESC` 정렬 후 노드별 첫 행만 취하는 로직은 컨테이너 반복으로 동일 nodeId 가 여러 NodeExecution 을 가질 때 최신 완료 출력을 정확히 선택한다. 이는 spec §1.3 메커니즘 "직속 predecessor 출력 복원" 요구에 부합한다.
- 제안: 없음 (INFO).

---

### **[INFO]** `ExecuteNodeDto.input` 필드가 `workflowsApi.executeNode` 에서 전달되지 않음 (현재 프론트엔드)

- 위치: `workflow-canvas.tsx` `handleRunThisNode` + `workflows.ts` `executeNode` 함수
- 상세: 현재 `handleRunThisNode` 는 `previousExecutionId` 만 전달하고 `input` 을 전달하지 않는다. `ExecuteNodeDto` 에는 `input?: Record<string, unknown>` 이 있고 API 클라이언트도 `input` 을 지원하나, 우클릭 메뉴 진입점에서는 수동 입력 필드 UI 없이 실행된다. spec §1.3 "미지정 시 body `input` 수동 입력으로 대체" 는 API 계약에서 지원되며, 프론트엔드에서 `input` 미전달 시 빈 객체(`{}`)가 `workflowInput` 이 되어 predecessor seed 없는 경우 빈 입력으로 실행된다. spec R-1.3 Rationale "미지정 시 body `input`(수동) 으로 대체해 '입력을 직접 지정한 단발 테스트'도 지원" 은 API 레벨에서 구현돼 있으므로 프론트엔드에서 노출하지 않아도 API 스펙은 충족한다. 향후 수동 입력 다이얼로그 추가 시 자연스럽게 확장 가능.
- 제안: 없음 (INFO). 필요 시 우클릭 메뉴에 "이 노드 실행 (입력 지정)" 항목 추가로 확장.

---

### **[INFO]** `isDirty` 저장 실패 시 조용한 리턴 — 실행 취소 이유 미표시

- 위치: `workflow-canvas.tsx` `handleRunThisNode` (라인 ~1189–1191)
- 상세: `saveWorkflow()` 가 false 를 반환하면(저장 실패 시) 단순 `return` 으로 실행을 취소한다. 저장 실패 자체는 `saveWorkflow` 내부에서 에러 처리될 수 있으나, 사용자가 "이 노드 실행"을 눌렀을 때 아무 일도 일어나지 않는 것처럼 보인다. spec 범위 밖 UX 이슈.
- 제안: spec 위반 아님, INFO. 저장 실패 시 "저장에 실패해 실행을 시작할 수 없습니다" 토스트 권장.

---

### **[INFO]** spec fidelity: §9 API — 400 에러 코드 `NODE_NOT_IN_WORKFLOW` / `PREVIOUS_EXECUTION_NOT_FOUND` — spec 에 명시 없음

- 위치: `workflows.controller.ts` + spec §9
- 상세: spec §9 의 해당 API 행은 "대상 노드가 워크플로우에 없거나 previousExecutionId 가 타 워크플로우면 400" 만 기술하고, 에러 코드를 명시하지 않는다. 구현은 `NODE_NOT_IN_WORKFLOW` / `PREVIOUS_EXECUTION_NOT_FOUND` 라는 코드를 사용한다. 이는 spec 침묵 영역으로 구현이 추가 정보를 제공하는 것이므로 spec 위반이 아니다.
- 제안: spec 침묵 영역. `spec/conventions/error-codes.md` 에 두 코드를 등록하거나, §9 행에 에러 코드를 명시하면 좋다.

---

### **[INFO]** [SPEC-DRIFT] spec §1.3 출력 항목에 "Run Results 드로어 노드 타임라인" 언급 있으나 단일 노드 실행 시 타임라인 필터링 동작 미기술

- 위치: `spec/3-workflow-editor/3-execution.md §1.3` "출력" 행
- 상세: spec §1.3 출력 행은 "Run Results 드로어에 노드 타임라인" 을 언급한다. 단일 노드 실행 시 실제로는 대상 노드 1개만 타임라인에 나타난다(다른 노드는 실행되지 않으므로). 이는 스펙 본문이 침묵하는 영역(단일 노드 타임라인 표시 형태)이며 코드가 자연스럽게 구현하는 범위다. 특별한 필터링 없이 일반 실행과 동일한 드로어가 사용되며, 단일 노드 결과만 나타나는 것은 엔진의 범위 제한 결과다.
- 제안: 코드 유지. spec §1.3 출력 행에 "(단일 노드만 타임라인에 표시됨)" 1행 추가하면 독자에게 더 명확하다. 대상 spec: `spec/3-workflow-editor/3-execution.md §1.3` 출력 행.

---

### **[INFO]** 테스트 커버리지: 단위 + e2e 핵심 시나리오 커버

- 위치: `execution-engine.service.spec.ts` + `workflows.controller.spec.ts` + `workflow-execution.e2e-spec.ts`
- 상세:
  - 단위 테스트 — `execution-engine.service.spec.ts`: (1) previousExecutionId 있을 때 대상 노드만 실행 + seed, (2) previousExecutionId 없을 때 수동 입력으로 실행 — 2개 케이스 커버.
  - 컨트롤러 단위 테스트 — `workflows.controller.spec.ts`: (1) 정상 흐름, (2) previousExecutionId 없음, (3) 노드 없음 400, (4) 타 워크플로우 previousExecution 400, (5) 503 shutdown gate — 5개 케이스 커버.
  - e2e — `workflow-execution.e2e-spec.ts`: (F) 202 + terminal 도달, (G) 노드 없음 400, (H) previousExecutionId 타 워크플로우 400 — 3개 케이스 커버.
  - 미커버: (1) singleNodeId 가 disabled 노드인 경우, (2) predecessor `outputData` 가 비-canonical scalar인 경우, (3) `previousExecutionId` 는 있지만 predecessor NodeExecution 이 COMPLETED 상태가 아닌 경우(모두 건너뜀으로 빈 seed).

---

## 요약

execution §1.3 단일 노드 실행의 핵심 요구사항 — 전용 엔드포인트(`POST /api/workflows/:id/nodes/:nodeId/execute`), 대상 노드만 실행(downstream 미진행), predecessor 출력 pre-seed 입력 주입, Execution row 재사용, 설정 패널 Info 탭 결과 표시, 노드 우클릭 트리거 — 이 spec §1.3 / §9 / Rationale R-1.3 과 line-level 로 일치하게 구현됐다. 이전 impl-prep consistency 리뷰에서 지적된 CRITICAL 2건(엔드포인트 URL 패턴 위반, 컬럼명 `single_node_id` 논란)은 각각 `/nodes/:nodeId/execute` 경로 채택·`single_node_id` 유지(근거 주석 기재) 로 설계 교정되어 해소됐다. 주요 미결 위험은 두 가지다: (1) disabled 노드를 singleNodeId 로 지정 시 동작이 spec과 코드 모두에 정의되지 않아 조용한 빈 결과가 발생할 수 있다(WARNING). (2) `seedSingleNodePredecessorOutputs` 에서 비-canonical scalar `outputData` 에 대한 `wrapBareAsNodeHandlerOutput` 처리 견고성이 확인되지 않았다(WARNING). 이 두 케이스 모두 v1 범위 한계("최상위 비-blocking 노드 대상")로 처리 가능하나, spec 또는 코드에 명시적 가드를 추가하면 회귀를 방지할 수 있다. 프론트엔드에서 에러 발생 시 사용자 피드백 부재(조용한 실패)는 UX 품질 이슈이나 spec 위반은 아니다.

---

## 위험도

**LOW**

주요 근거: 핵심 기능 흐름(실행 트리거·범위 제한·입력 seed·결과 기록)이 spec 과 정합하게 구현됐고 단위·e2e 테스트가 주요 경로를 커버한다. 남은 WARNING 2건(disabled 노드 동작 미정의, 비-canonical outputData 처리 미검증)은 현실 운영에서 발생 빈도가 낮고 v1 범위 한계로 명시적으로 defer 가능하다. 전체 기능 완전성과 spec 충실도 관점에서 즉각적인 차단 위험은 없다.
