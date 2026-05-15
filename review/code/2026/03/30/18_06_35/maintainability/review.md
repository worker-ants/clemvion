## 코드 리뷰 결과 — 유지보수성 (Maintainability)

### 발견사항

---

**[WARNING] `execution-engine.service.ts` — WebSocket 이벤트 발행 코드 반복**
- 위치: `execution-engine.service.ts` 내 `execute()` 및 `executeNode()` 메서드
- 상세: `emitExecutionEvent` / `emitNodeEvent` 호출 패턴이 STARTED, COMPLETED, FAILED, SKIPPED 등 4~5곳에 동일한 구조로 반복됨. 상태 값과 페이로드 구성 로직이 인라인으로 산재해 있어 이벤트 구조 변경 시 여러 곳을 수정해야 함.
- 제안: `emitExecution(status, extra?)`, `emitNode(nodeId, status, extra?)` 같은 private 헬퍼로 추출하여 한 곳에서 관리

---

**[WARNING] `editor-store.ts` — 반복적인 `(n.data as Record<string, unknown>).xxx as string` 캐스팅**
- 위치: `saveWorkflow()` 내 `nodes.map()` 블록
- 상세: 노드 데이터에 접근할 때마다 `(n.data as Record<string, unknown>).type as string` 형태의 이중 캐스팅이 5회 반복됨. 타입 안전성도 없고 읽기도 어려움.
- 제안: `n.data`에 대한 타입 인터페이스(`CustomNodeData`)를 `editor-store.ts`에서도 import하거나, 캐스팅을 한 번만 수행하는 지역 변수 `const d = n.data as CustomNodeData`로 추출

---

**[WARNING] `workflows.service.ts` — `saveCanvas()` 메서드 과도한 길이 및 다중 책임**
- 위치: `workflows.service.ts:saveCanvas()` (약 90줄)
- 상세: 워크플로우 이름 업데이트, 노드 동기화(upsert + delete), 엣지 동기화(delete-all + recreate)라는 세 가지 책임이 하나의 메서드에 혼재됨. 노드 upsert 루프 안에 if-else 분기가 있어 중첩 깊이도 높음.
- 제안: `syncNodes(manager, workflowId, nodeDtos)`, `syncEdges(manager, workflowId, edgeDtos)` private 메서드로 분리

---

**[WARNING] `editor-toolbar.tsx` — 응답 데이터 접근 이중 캐스팅**
- 위치: `handleRun()` 내 `(response.data as { data: { executionId: string } }).data`
- 상세: API 클라이언트의 반환 타입이 `any`에 가까워 타입 단언을 이중으로 해야 하는 상황. 유지보수 중 응답 구조가 바뀌면 런타임 오류가 조용히 발생할 수 있음.
- 제안: `workflowsApi.execute()`의 반환 타입을 `apiClient.post<{ data: { executionId: string } }>`로 명시하거나, API 레이어에서 executionId를 직접 반환하도록 래핑

---

**[INFO] `workflows.service.ts` — Manual Trigger 노드 생성 시 매직 넘버**
- 위치: `create()` 메서드, `positionX: 250, positionY: 300`
- 상세: 초기 배치 좌표가 하드코딩되어 있음. 스펙 문서와 일치하지만 코드만 보면 의도 불명확.
- 제안: `MANUAL_TRIGGER_DEFAULT_POSITION = { x: 250, y: 300 }` 상수로 추출

---

**[INFO] `custom-node.tsx` — 즉시 실행 함수(IIFE)로 `statusStyles` 계산**
- 위치: `CustomNodeComponent` 내 `statusStyles` 선언부
- 상세: IIFE 패턴 대신 `useMemo` 또는 `getStatusStyle(status)` 순수 함수가 더 관용적이고 테스트하기 쉬움. 현재 구조는 리렌더링마다 함수를 재생성함.
- 제안: `memo` 컴포넌트임을 감안하여 `useMemo(() => getStatusStyle(nodeStatus?.status), [nodeStatus?.status])` 또는 컴포넌트 외부의 순수 함수로 추출

---

**[INFO] `workflows-canvas.tsx` — `manual_trigger` 문자열 리터럴 반복 사용**
- 위치: `onKeyDown` 및 `onDrop` 콜백
- 상세: `"manual_trigger"` 문자열이 두 곳에 하드코딩됨. 백엔드의 핸들러 등록 키, 프론트엔드 node definition의 type 값과 동기화해야 하는 값이 분산되어 있음.
- 제안: `node-definitions/index.ts`에 `MANUAL_TRIGGER_TYPE = "manual_trigger"` 상수 정의 후 공유

---

**[INFO] `execution-engine.service.ts` — `throw lastError ?? new Error('...')` 개선**
- 위치: `executeWithRetry()` 마지막 라인
- 상세: 기존의 `throw lastError`(lastError가 undefined일 경우 throw undefined)를 개선한 점은 긍정적. 다만 이 분기는 실제로는 도달 불가능한 경로이므로, 타입 레벨에서 `lastError`를 `Error` 타입으로 좁히면 더 명확함.

---

### 요약

전체적으로 코드 구조는 명확하고 NestJS/React 컨벤션을 잘 따르고 있으며, 새로운 기능(Manual Trigger, WebSocket 이벤트, 캔버스 저장)이 일관된 방식으로 추가되었다. 주요 유지보수성 위험은 두 가지로 요약된다: `execution-engine.service.ts`의 반복적인 WebSocket 이벤트 발행 패턴과 `workflows.service.ts`의 `saveCanvas()` 메서드 과잉 길이이다. 이 두 곳을 private 헬퍼 메서드로 분리하면 변경 영향 범위가 크게 줄어든다. 프론트엔드에서는 `"manual_trigger"` 문자열 리터럴과 타입 캐스팅 패턴이 상수/타입 정의로 일원화될 필요가 있다.

### 위험도

**MEDIUM**