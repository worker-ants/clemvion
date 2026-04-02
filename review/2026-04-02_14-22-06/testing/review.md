## 테스팅 코드 리뷰

### 발견사항

---

**[WARNING] `result-timeline.tsx` — 테스트 없음**
- 위치: `frontend/src/components/editor/run-results/result-timeline.tsx`
- 상세: 신규 컴포넌트로 핵심 로직(auto-scroll, auto-select first result, category color 매핑, status icon 렌더링)이 테스트되지 않음
- 제안: auto-scroll 동작, 첫 번째 결과 자동 선택, 선택 항목 하이라이트, 각 status별 아이콘 렌더링 테스트 추가

---

**[WARNING] `result-detail.tsx` — 테스트 없음**
- 위치: `frontend/src/components/editor/run-results/result-detail.tsx`
- 상세: `isWaitingForm` 분기(폼 UI vs PresentationContent vs GenericRenderer), `handleFormSubmit`의 WS emit, `result === null` 시 placeholder 등의 분기 테스트 없음
- 제안: null result, waiting form, completed presentation, failed generic 각 케이스 RTL 테스트 필요

---

**[WARNING] `dynamic-form-ui.tsx` — 테스트 없음**
- 위치: `frontend/src/components/editor/run-results/dynamic-form-ui.tsx`
- 상세: 모든 필드 타입(textarea, number, email, date, select, radio, checkbox, text), required 검증, submit 콜백 등이 테스트되지 않음. 기존 `run-results-drawer.tsx`에 인라인으로 있었을 때도 테스트가 없었음
- 제안: 각 field type 렌더링, required 표시, submit 시 값 전달 테스트 추가

---

**[WARNING] `presentation-renderers.tsx` — 테스트 없음**
- 위치: `frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx`
- 상세: `TableContent`의 50행 truncation, `CarouselContent`의 empty items fallback, `ChartContent`의 HTML sanitization, `isHttpUrl` 검증 로직 등 커버리지 공백 존재
- 제안: 각 렌더러 단위 테스트, 특히 XSS sanitization 경로와 fallback(`JsonContent`) 분기 테스트

---

**[WARNING] `generic-renderer.tsx` — 테스트 없음**
- 위치: `frontend/src/components/editor/run-results/renderers/generic-renderer.tsx`
- 상세: error 표시 분기, `outputData === null` 시 Output 섹션 미표시, `formatDuration` 경계값(< 1000ms vs ≥ 1000ms) 테스트 없음
- 제안: error/no-error, outputData null/non-null, duration 경계값 테스트 추가

---

**[WARNING] `handleMouseUp`에서 stale closure로 인한 잘못된 높이 저장**
- 위치: `run-results-drawer.tsx:74-82`
- 상세: `handleMouseUp` 내 `localStorage.setItem(STORAGE_KEY, String(panelHeight))`는 `useEffect` 의존성 배열의 `panelHeight` 값(마우스다운 시점)을 캡처하여 드래그 종료 시점의 실제 높이가 아닌 시작 높이를 저장할 수 있음. `startHeight.current` 대신 `setPanelHeight`의 functional updater를 사용하거나 ref로 현재 높이를 추적해야 함
- 제안: `panelHeightRef`를 별도로 두고 `handleMouseMove`에서 동기화, `handleMouseUp`에서 ref 값 사용. 이 버그는 테스트로 검출되어야 하지만 관련 테스트가 없음

---

**[INFO] `execution-store.test.ts` — `startExecution` 후 `selectedResultNodeId` 리셋 검증 추가됨 (Good)**
- 위치: `frontend/src/lib/stores/__tests__/execution-store.test.ts:54`
- 상세: `selectedResultNodeId`가 새 실행 시작 시 null로 초기화되는지 검증하는 테스트가 올바르게 추가됨

---

**[INFO] `use-execution-events.test.ts` — `node.started`/`node.failed`/`node.skipped` 이벤트 테스트 추가됨 (Good)**
- 위치: `frontend/src/lib/websocket/__tests__/use-execution-events.test.ts`
- 상세: 기존에 `node.completed`만 테스트하던 것에서 모든 노드 이벤트 타입으로 커버리지가 확장됨. `nodeType`, `nodeLabel`, `nodeCategory` 등 신규 필드도 검증함

---

**[INFO] `node-definitions` mock 추가로 `getCategoryForType` 간접 테스트**
- 위치: `use-execution-events.test.ts:27-40`
- 상세: `getNodeDefinition` mock이 적절히 구성되어 있어 카테고리 매핑 로직이 간접적으로 검증됨. 단, `unknown` 카테고리 fallback 경로(정의 없는 nodeType)에 대한 테스트는 없음
- 제안: `nodeType: "unknown_type"` 케이스를 추가하여 `"unknown"` 카테고리 fallback 검증

---

**[INFO] REST polling 경로에서 `node.label` null인 경우 테스트 없음**
- 위치: `use-execution-events.ts:252` (`ne.node?.label ?? ne.nodeId`)
- 상세: `ne.node`가 `undefined`이거나 `ne.node.label`이 빈 문자열인 경우의 fallback 동작 테스트 없음
- 제안: polling mock에서 `node` 필드가 없는 `NodeExecution` 케이스 추가

---

**[INFO] `execution-engine.service.ts` — 백엔드 nodeType/nodeLabel 추가에 대한 단위 테스트 없음**
- 위치: `backend/src/modules/execution-engine/execution-engine.service.ts`
- 상세: `NODE_STARTED`, `NODE_COMPLETED`, `NODE_SKIPPED`, `NODE_FAILED` 이벤트에 `nodeType`, `nodeLabel`, `output` 필드가 추가되었으나 해당 이벤트 페이로드를 검증하는 단위 테스트가 없음
- 제안: `emitNodeEvent` 호출 시 페이로드에 신규 필드가 포함되는지 스파이로 검증하는 테스트 추가

---

**[INFO] `executions.service.ts` — `relations: ['node']` 추가에 대한 테스트 없음**
- 위치: `backend/src/modules/executions/executions.service.ts:40`
- 상세: `nodeExecutionRepository.find` 호출 시 `relations: ['node']`가 포함되는지 검증하는 테스트 없음
- 제안: `findById` 테스트에서 `find` 호출 인자에 `relations: ['node']`가 포함됨을 검증

---

### 요약

이번 변경은 Run Results 드로어를 2-column 레이아웃으로 전면 개편한 대규모 리팩터링으로, `execution-store`와 `use-execution-events` 훅에 대한 단위 테스트는 잘 갱신되었습니다. 그러나 신규 생성된 UI 컴포넌트(`ResultTimeline`, `ResultDetail`, `DynamicFormUI`, `GenericRenderer`, `PresentationContent`)는 전혀 테스트가 없으며, 백엔드 변경사항(`execution-engine.service`, `executions.service`)에 대한 페이로드 검증도 누락되어 있습니다. 특히 `run-results-drawer.tsx`의 resize 로직에 stale closure 버그가 있어 localStorage에 잘못된 높이가 저장될 수 있고, 이를 검출할 테스트도 부재합니다.

### 위험도

**MEDIUM** — 핵심 store/hook 로직 테스트는 갱신되었으나, 신규 UI 컴포넌트 전체와 백엔드 변경사항에 대한 테스트가 없으며 런타임 버그가 포함되어 있음