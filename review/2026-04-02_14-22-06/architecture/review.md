## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING] `localStorage` 직접 접근 및 사이드 이펙트가 컴포넌트에 산재**
- 위치: `run-results-drawer.tsx:handleMouseUp` (useEffect 내부)
- 상세: `panelHeight` state가 변경될 때마다 `handleMouseUp` 클로저가 재생성되어 `window.removeEventListener`/`addEventListener`가 반복 호출된다. `panelHeight`를 의존성에 포함하지 않고 ref로 추적해야 한다. 또한 localStorage 접근 로직이 컴포넌트에 직접 포함되어 있어 SRP 위반.
- 제안: `panelHeight`를 ref로 추적하거나, `useResizablePanel` 커스텀 훅으로 추출. localStorage 접근은 훅 내부로 캡슐화.

---

**[WARNING] `PRESENTATION_TYPES` Set이 두 곳에 중복 정의**
- 위치: `result-detail.tsx:12-18`, 구 `run-results-drawer.tsx`(삭제됨)
- 상세: `result-detail.tsx`에 `PRESENTATION_TYPES`가 로컬 상수로 정의되어 있고, `presentation-renderers.tsx`의 `PresentationContent`도 동일 분기 로직을 내포한다. 카테고리 기반 분기라면 `nodeCategory === "presentation"` 조건으로 통일 가능하며, 타입 목록 관리 지점이 단일화되지 않았다.
- 제안: `node-definitions.ts`에 `PRESENTATION_NODE_TYPES` 상수를 export하거나, `nodeCategory === "presentation"` 조건으로 대체.

---

**[WARNING] 백엔드 WS 이벤트 페이로드 계약이 암묵적**
- 위치: `use-execution-events.ts:handleNodeStarted`, `handleNodeCompleted`, `handleNodeFailed`, `handleNodeSkipped`
- 상세: WS 이벤트 페이로드(`nodeType`, `nodeLabel`, `output`)가 타입 단언(`as { nodeId?: string; ... }`)으로만 처리되어 있다. 백엔드가 이 필드를 보내지 않으면 `"unknown"`으로 fallback되나, 실제 계약이 인터페이스로 명시되지 않아 백엔드-프론트엔드 경계가 불명확하다.
- 제안: `shared/types/ws-events.ts` 같은 파일에 WS 이벤트 페이로드 인터페이스를 정의하고 양쪽에서 참조.

---

**[WARNING] `ResultTimeline`의 자동 선택 Effect가 무한 루프 위험**
- 위치: `result-timeline.tsx:56-60`
- 상세: `onSelect`가 의존성에 포함되어 있는데, 부모에서 `useExecutionStore((s) => s.selectResultNode)`를 직접 전달하면 참조 안정성이 보장되지만, 향후 래핑 함수로 교체될 경우 `selectedId → onSelect → re-render → effect` 루프가 발생할 수 있다.
- 제안: `useEffect` 의존성에서 `onSelect`를 제거하고 `useCallback`으로 안정화되었다고 명시하거나, `onSelect`를 ref로 래핑.

---

**[INFO] `getCategoryForType`이 런타임 `node-definitions` 조회에 의존 — 레이어 책임 혼재**
- 위치: `use-execution-events.ts:40-42`
- 상세: WebSocket 이벤트 핸들러(인프라 레이어)가 UI 도메인 지식인 `getNodeDefinition`을 직접 호출한다. 카테고리는 이미 백엔드가 알고 있으므로, WS 이벤트에 `nodeCategory` 필드를 포함시키는 것이 레이어 책임상 더 명확하다. 백엔드가 보내지 않는다면, 매핑 책임을 별도 도메인 서비스로 분리해야 한다.
- 제안: 백엔드 WS 이벤트에 `nodeCategory` 추가 or `categoryResolver` 서비스 레이어 분리.

---

**[INFO] `executions.service.ts`의 `relations: ['node']` — N+1 잠재 위험**
- 위치: `executions.service.ts:40`
- 상세: `nodeExecutionRepository.find`에 `node` relation이 추가되었다. 현재는 단일 실행 조회이므로 문제없으나, 향후 `findByWorkflow`에서 동일 패턴이 적용될 경우 N+1이 발생할 수 있다. 현재 변경은 적절.
- 제안: `findByWorkflow`에서 nodeExecutions를 eager load할 경우 QueryBuilder의 `leftJoinAndSelect` 방식으로 일괄 조회 권장.

---

**[INFO] `ResultDetail`의 렌더링 분기 로직이 컴포넌트 내부에 산재**
- 위치: `result-detail.tsx:130-140`
- 상세: `isWaitingForm → DynamicFormUI`, `isPresentation && completed → PresentationContent`, `else → GenericRenderer` 분기가 JSX 내에 직접 작성되어 있다. 현재 3분기는 관리 가능하지만, 노드 유형이 증가하면 분기가 복잡해진다.
- 제안: `getResultRenderer(result, isWaitingForm)` 팩토리 함수로 분리하여 OCP 준수.

---

### 요약

이번 변경은 "Presentation 노드 전용 히스토리"에서 "전체 노드 타임라인 + 상세 뷰" 아키텍처로의 올바른 방향 전환이며, 백엔드에서 `nodeType`/`nodeLabel`을 WS 이벤트에 포함시키고 프론트엔드 스토어에 `selectedResultNodeId`를 추가한 설계 결정은 타당하다. 컴포넌트 분리(`ResultTimeline`, `ResultDetail`, `DynamicFormUI`, 렌더러들)도 SRP 관점에서 개선되었다. 다만 WS 페이로드 계약의 암묵적 타입 단언, `PRESENTATION_TYPES` 중복 정의, 리사이즈 핸들러의 클로저 stale 문제, 그리고 UI 도메인 지식(`getNodeDefinition`)이 인프라 레이어 훅에 직접 침투하는 부분은 향후 유지보수와 확장성에 영향을 줄 수 있다.

### 위험도

**LOW**