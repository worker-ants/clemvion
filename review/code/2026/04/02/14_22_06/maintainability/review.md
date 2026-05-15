## 코드 리뷰: 유지보수성 (Maintainability)

### 발견사항

---

**[WARNING] `handleMouseUp`의 stale closure로 인한 높이 저장 버그**
- 위치: `run-results-drawer.tsx` — `handleMouseUp` 내 `localStorage.setItem(STORAGE_KEY, String(panelHeight))`
- 상세: `handleMouseUp`은 `useEffect` 의존성 배열에 `panelHeight`를 포함하지만, 드래그 중 `panelHeight`는 매번 바뀌므로 매번 새 이벤트 리스너가 등록/해제된다. 드래그 완료 시점의 `panelHeight` 대신 `startHeight`나 `ref`를 사용해 저장하는 편이 더 명확하다.
- 제안: `isDragging`, `startY`, `startHeight`가 이미 `ref`로 관리되듯, 드래그 중 변경되는 현재 높이도 `currentHeightRef`로 추적하고 `handleMouseUp`에서 ref 값을 저장하거나, `handleMouseMove` 내에서 직접 `localStorage`에 저장하는 방식을 고려.

---

**[WARNING] `PRESENTATION_TYPES` Set이 두 곳에 중복 정의됨**
- 위치: `result-detail.tsx:16-23` / 이전에는 `use-execution-events.ts`에도 존재 (제거됨)
- 상세: `result-detail.tsx`에 `PRESENTATION_TYPES` Set이 로컬 상수로 정의되어 있다. `node-definitions.ts`에 카테고리 정보가 이미 있고 `nodeCategory === "presentation"` 체크로 대체 가능함에도 별도 목록을 유지하고 있어, 향후 presentation 노드 타입 추가 시 이 파일도 별도로 수정해야 한다.
- 제안: `nodeCategory === "presentation"` 조건으로 교체하거나, `node-definitions.ts`에서 export하는 단일 Set으로 통합.

---

**[WARNING] `formatDuration` 유틸 함수가 3개 파일에 중복**
- 위치: `result-detail.tsx`, `result-timeline.tsx`, `renderers/generic-renderer.tsx`
- 상세: 동일한 `formatDuration` 함수가 세 파일 모두에 복사되어 있다. ms → 초 변환 기준(1000ms)이나 소수점 자리수 변경 시 세 군데를 모두 수정해야 한다.
- 제안: `run-results/utils.ts` 또는 `lib/format.ts`로 추출하여 공유.

---

**[INFO] `StatusBadge`와 `StatusIcon`의 역할 중복**
- 위치: `result-detail.tsx` — `StatusBadge`, `result-timeline.tsx` — `StatusIcon`
- 상세: 두 컴포넌트 모두 `NodeExecutionStatus`를 받아 시각적 표현을 반환하는데, switch 분기 케이스가 동일하다. 하나는 Badge+아이콘, 다른 하나는 아이콘만 반환하는 차이이지만 상태 목록이 달라질 경우 두 곳 모두 수정해야 한다.
- 제안: 기능 분리는 유지하되, 상태별 색상/아이콘 매핑 테이블을 공유 상수로 추출.

---

**[INFO] `getCategoryForType` 함수명이 반환 타입을 충분히 표현하지 않음**
- 위치: `use-execution-events.ts:43`
- 상세: 함수 이름만으로는 "node category"를 반환한다는 것을 알 수 있지만, fallback이 `"unknown"`임을 알 수 없다. 또한 단순 one-liner임에도 별도 함수로 분리되어 가독성 대비 추상화 비용이 있다.
- 제안: 인라인으로 사용하거나, `getNodeCategory(type: string): string`으로 명명.

---

**[INFO] `NodeExecutionData.node` 필드가 optional이어서 방어 코드가 산재함**
- 위치: `executions.ts:15`, `use-execution-events.ts:249-250`
- 상세: `node?: { id, type, label }`이 optional이라 매번 `?? "unknown"` / `?? ne.nodeId` fallback을 써야 한다. REST 응답에서 `relations: ['node']`를 항상 include하도록 변경되었으므로, 타입 레벨에서 보장 가능하다.
- 제안: `relations: ['node']`를 항상 포함한다면 `node` 필드를 required로 승격하거나, 별도 DTO 타입(`NodeExecutionWithNode`)으로 분리.

---

**[INFO] execution-engine.service.ts의 반복 패턴 — `nodeType`/`nodeLabel` 4곳에 동일 구조**
- 위치: `execution-engine.service.ts:504-507`, `548-552`, `583-588`, `645-647`
- 상세: `{ status, nodeType: node.type, nodeLabel: node.label ?? node.type }` 패턴이 4개의 이벤트 emit 호출에 반복된다. 현재는 허용 가능한 수준이지만, 향후 필드 추가 시 4곳 모두 수정해야 한다.
- 제안: `buildNodeEventPayload(node, extra)` 헬퍼로 추출하거나, 객체 스프레드로 구성.

---

### 요약

전반적으로 이번 변경은 단일 파일에 500줄 이상 밀집되어 있던 코드를 `ResultTimeline`, `ResultDetail`, `DynamicFormUI`, 렌더러 파일들로 분리하여 가독성과 단일책임 원칙을 크게 개선했다. 스펙 변경(`presentation-only → all nodes`)도 일관되게 반영되었고, 테스트도 충실히 갱신되었다. 다만 `formatDuration` 유틸과 `PRESENTATION_TYPES` Set의 중복, `StatusBadge`/`StatusIcon`의 상태 매핑 중복은 향후 presentation 타입 확장이나 상태 추가 시 변경 포인트가 분산되는 문제를 일으킬 수 있다. `handleMouseUp`의 stale closure 문제는 드래그 후 높이가 저장되지 않을 수 있는 실제 버그 가능성이 있으므로 우선적으로 검토가 필요하다.

### 위험도

**LOW**