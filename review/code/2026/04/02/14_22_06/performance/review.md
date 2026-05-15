## 성능 코드 리뷰

### 발견사항

---

**[WARNING] `handleMouseUp`의 stale closure — `panelHeight` 값이 드래그 종료 시점이 아닌 useEffect 등록 시점 값으로 저장됨**
- 위치: `run-results-drawer.tsx` — `handleMouseUp` 내 `localStorage.setItem`
- 상세: `panelHeight`가 useEffect dependency에 포함되어 있어 setState가 발생할 때마다 이벤트 핸들러를 재등록함. mousemove 중에는 `setPanelHeight`가 빈번하게 호출되므로, mousemove 이벤트 핸들러도 매 setState마다 재등록됨 — window에 이벤트 리스너를 등록/해제하는 비용이 드래그 내내 발생.
- 제안: `panelHeight`를 ref로 관리하거나, mouseUp 시에만 저장 필요한 최종값을 ref에서 읽도록 수정.

```tsx
// 현재: panelHeight state → useEffect dependency → 매 render마다 재등록
useEffect(() => { ... }, [panelHeight]);  // ← 문제

// 개선: ref로 최종값 추적
const panelHeightRef = useRef(panelHeight);
const handleMouseMove = (e: MouseEvent) => {
  const newHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, startHeight.current + diff));
  setPanelHeight(newHeight);
  panelHeightRef.current = newHeight;  // ref에 최신값 유지
};
const handleMouseUp = () => {
  localStorage.setItem(STORAGE_KEY, String(panelHeightRef.current));
};
// useEffect dependency에서 panelHeight 제거 → 한 번만 등록
}, []);
```

---

**[WARNING] `relations: ['node']` 추가 — 모든 NodeExecution에 Node entity를 JOIN 로딩**
- 위치: `executions.service.ts:37`
- 상세: `findById`는 단일 실행 조회이므로 큰 문제는 없으나, NodeExecution이 수백 개일 경우(Loop/ForEach 시나리오) Node relation을 모두 eager load함. Node entity가 크거나 workflow에 수십 개 노드가 있을 때 메모리 부담 증가.
- 제안: Node relation 전체가 아닌 필요한 컬럼만 select하거나, `loadRelationIds: true` 후 별도 조회로 분리. 단, 현재 사용 규모에서는 INFO 수준으로 볼 수 있음.

---

**[WARNING] `getCategoryForType` — 매 노드 이벤트마다 `getNodeDefinition` 호출**
- 위치: `use-execution-events.ts:43`, 각 handleNode* 핸들러
- 상세: `getNodeDefinition`이 내부적으로 배열 탐색이나 Map 조회를 수행한다면 매 이벤트마다 호출됨. 실행당 호출 빈도는 낮으나, 동일 nodeType에 대해 반복 조회 가능 (started → completed → 동일 nodeId 중복 업데이트).
- 제안: `getNodeDefinition`이 이미 O(1) Map 조회라면 문제없음. 그렇지 않다면 `Map<string, string>` 캐시 추가 권장.

---

**[INFO] `addNodeResult` 내 `nodeResults.some()` + `nodeResults.map()` — O(n) 이중 순회**
- 위치: `execution-store.ts:95–106`
- 상세: 노드 결과 추가 시 `some`으로 존재 여부 확인 후 `map`으로 교체 — 최악 O(2n). 일반 워크플로우에서 노드 수는 수십 개 이하이므로 실질적 영향은 없음.
- 제안: Map 자료구조로 관리 시 O(1)로 개선 가능하나, 순서 보존 및 현재 규모에서는 불필요.

---

**[INFO] `ResultTimeline` — `results` 배열 전체를 매 render마다 DOM 노드로 렌더링**
- 위치: `result-timeline.tsx:61–93`
- 상세: 현재 구현은 가상화(virtualization) 없이 전체 렌더링. 일반적인 워크플로우(노드 수십 개)에서는 문제없으나, Loop/ForEach로 수백 개 노드가 실행될 경우 DOM 비대화 가능.
- 제안: 현재 규모에서는 수용 가능. 향후 Loop 내 반복 실행 지원 시 `react-virtual` 등 가상화 고려.

---

**[INFO] `execution-engine.service.ts` — NODE_STARTED/COMPLETED/SKIPPED/FAILED 이벤트마다 `node.label ?? node.type` 연산 반복**
- 위치: execution-engine.service.ts:501, 548, 583, 645
- 상세: 동일한 `node.label ?? node.type` 표현식이 4곳에서 반복됨. 성능 영향은 미미하나, 실행 엔진 내 지역변수로 추출하면 명확성과 유지보수성 향상.
- 제안: `const nodeLabel = node.label ?? node.type;` 로컬 변수 추출.

---

### 요약

전반적으로 성능 관점에서 큰 문제는 없으나, **`run-results-drawer.tsx`의 drag resize 핸들러**가 핵심 이슈다. `panelHeight` state가 `useEffect` dependency에 포함되어 드래그 중 mousemove/mouseup 핸들러가 매 setState마다 window에 재등록/해제되므로, 리사이즈 성능 저하가 발생할 수 있다. `executions.service.ts`의 Node relation eager loading은 현재 단일 조회 용도에서는 수용 가능하지만, Loop/ForEach 시나리오에서 노드 수가 많아질 경우 부담이 될 수 있다. 나머지 사항들은 현재 사용 규모에서 실질적 영향이 없는 INFO 수준이다.

### 위험도

**MEDIUM** — drag resize handler의 불필요한 이벤트 리스너 재등록이 UX에 직접 영향을 줄 수 있음.