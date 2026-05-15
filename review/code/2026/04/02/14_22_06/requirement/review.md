### 발견사항

---

**[WARNING] Form 노드 waiting_for_input 상태가 타임라인에 반영되지 않음**
- 위치: `frontend/src/lib/websocket/use-execution-events.ts` — `handleWaitingForInput` 핸들러
- 상세: `execution.waiting_for_input` 이벤트가 발생하면 `pauseForForm()`만 호출되어 `waitingNodeId`와 `waitingFormConfig`만 업데이트된다. 그러나 타임라인에 이미 `"running"` 상태로 추가된 해당 Form 노드의 `NodeResult.status`는 `"waiting_for_input"`으로 갱신되지 않는다. 결과적으로 스펙 §10.5에서 명시한 ⏸ 아이콘이 타임라인에 표시되지 않고 ⏳ 스피너가 그대로 유지된다.
- 제안:
  ```typescript
  // handleWaitingForInput 내부에서 addNodeResult 호출 추가
  updateNodeStatus(nodeId, { status: "waiting_for_input" });
  addNodeResult({
    nodeId,
    nodeLabel: payload.nodeLabel ?? nodeId,
    nodeType: payload.nodeType ?? "unknown",
    nodeCategory: getCategoryForType(payload.nodeType ?? "unknown"),
    status: "waiting_for_input",
    outputData: null,
  });
  ```

---

**[WARNING] resize useEffect가 드래그 중 매 픽셀마다 이벤트 리스너를 재등록함**
- 위치: `frontend/src/components/editor/run-results/run-results-drawer.tsx:68–91` — `useEffect([panelHeight])`
- 상세: `handleMouseMove`가 `setPanelHeight`를 호출할 때마다 `panelHeight` 상태가 변하고, 이 값이 effect 의존성 배열에 포함되어 있어 cleanup(리스너 제거) → 재등록 사이클이 드래그 중 수백 번 반복된다. `handleMouseUp` 내의 `localStorage.setItem(STORAGE_KEY, String(panelHeight))`에서 `panelHeight`를 클로저로 캡처하기 위해 의존성에 추가한 것이 원인이다. 이는 불필요한 DOM 조작 반복이며, cleanup/re-register 사이 미세한 gap에서 `mouseup` 이벤트 누락 위험이 있다.
- 제안: `panelHeight` 값을 ref로 병행 추적하여 effect 의존성에서 제거:
  ```typescript
  const panelHeightRef = useRef(panelHeight);
  useEffect(() => { panelHeightRef.current = panelHeight; }, [panelHeight]);

  useEffect(() => {
    const handleMouseUp = () => {
      ...
      localStorage.setItem(STORAGE_KEY, String(panelHeightRef.current));
    };
    ...
  }, []); // 의존성 배열에서 panelHeight 제거
  ```

---

**[INFO] 타임라인에서 새로 선택된(auto-select) 항목으로 스크롤 이동 미구현**
- 위치: `frontend/src/components/editor/run-results/result-timeline.tsx:56–60`
- 상세: 스펙 §10.5는 "Form 노드가 대기 상태에 진입하면 해당 노드가 자동 선택된다"고 명시하고 있다. `auto-select first result` 로직과 `RunResultsDrawer`의 `waitingNodeId` auto-select은 구현되어 있으나, 선택된 항목이 뷰포트 밖에 있을 때 해당 항목으로 스크롤하는 동작이 없다. 실행 히스토리가 길 경우 Form 노드가 화면 밖에 있을 수 있다.
- 제안: 선택된 `nodeId`가 변경될 때 해당 버튼 요소로 `scrollIntoView`를 호출.

---

**[INFO] `waiting_for_input` → 타임라인 상태 전환 테스트 누락**
- 위치: `frontend/src/lib/websocket/__tests__/use-execution-events.test.ts`
- 상세: `node.started`/`node.completed`/`node.failed`/`node.skipped` 이벤트에 대한 타임라인 결과 테스트는 추가되었으나, `execution.waiting_for_input` 이벤트 발생 시 해당 Form 노드의 `NodeResult.status`가 `"waiting_for_input"`으로 업데이트되는지 검증하는 테스트가 없다. 위 [WARNING] 버그와 직접 연관된 누락이다.
- 제안: `execution.waiting_for_input` 핸들러 테스트에 `nodeResults` 상태 검증 추가.

---

### 요약

이번 변경은 Run Results 드로어를 Chat-history 방식에서 전체 노드 타임라인 + 상세 뷰 2-column 레이아웃으로 전환하는 스펙 §10을 충실히 구현하였으며, 백엔드 이벤트에 `nodeType`/`nodeLabel` 정보를 추가하고 프론트엔드 스토어 구조를 확장한 변경은 요구사항을 대체로 충족한다. 단, Form 노드가 `waiting_for_input` 상태에 진입했을 때 타임라인에서 ⏸ 아이콘으로 전환되지 않는 기능 누락(§10.5)과, 드래그 리사이즈 시 매 픽셀마다 이벤트 리스너가 재등록되는 성능 버그가 WARNING 수준으로 존재한다.

### 위험도

**MEDIUM**