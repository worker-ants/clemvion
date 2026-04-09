### 발견사항

---

**[WARNING] 암묵적 문자열 프로토콜에 의한 레이어 간 강한 결합**
- 위치: `carousel.handler.ts` (ID 생성), `execution-engine.service.ts` (ID 파싱), `custom-node.tsx` (포트 추론)
- 상세: 아이템 버튼 ID의 `__item_{idx}` 패턴이 세 레이어에 걸쳐 암묵적 프로토콜로 사용되고 있음. `carousel.handler`가 생성한 `{defId}__item_{idx}` 형식을 `execution-engine`이 `buttonId.split('__item_')[0]`으로 파싱하고, `custom-node`도 동일 규칙을 인식해야 함. 이는 명시적 계약 없이 문자열 구조를 통해 컴포넌트가 결합된 구조로, 구분자 변경 시 3개 레이어를 동시에 수정해야 하는 유지보수 부채임.
- 제안: `ButtonItemRef` 같은 타입 정의로 item-button 관계를 명시적으로 모델링하거나, `buttonItemMap`에 `portId`를 함께 포함시켜 ID 파싱 없이 포트를 결정할 수 있도록 설계 변경.

---

**[WARNING] `previewOnly` boolean prop을 통한 OCP 위반**
- 위치: `conversation-inspector.tsx`, `generic-renderer.tsx`
- 상세: `previewOnly` 플래그 하나로 컴포넌트의 동작과 상태 관리 방식 전체가 분기됨 (`internalSelectedIndex` vs `selectedItemIndex`, `onSelectItem` 유무, 출력 섹션 노출 여부). 컴포넌트를 수정하지 않고 확장 가능해야 한다는 개방-폐쇄 원칙에 위배되며, 인터랙티브/읽기전용 두 책임이 한 컴포넌트에 혼재함.
- 제안: `ConversationPreview`(읽기전용)와 `ConversationInteractor`(인터랙티브) 컴포넌트로 분리하거나, render prop/slot 패턴으로 출력 영역을 외부에서 주입.

---

**[WARNING] 동적 엘리먼트 타입(`Wrapper`)에 의한 React 재조정 불안정성**
- 위치: `conversation-inspector.tsx` SummaryView 내 `items.map()`
- 상세: `const Wrapper = isClickable ? "button" : "div"` 패턴은 렌더링마다 엘리먼트 타입이 달라질 수 있어 React의 reconciler가 기존 DOM 노드를 재사용하지 못하고 언마운트/리마운트를 반복함. `isClickable` 값이 변경되면 포커스, 스크롤 위치, 애니메이션 상태가 초기화됨.
- 제안: 두 타입을 별도 분기로 명시적 렌더링(`isClickable ? <button> : <div>`)하거나, 항상 `<div>`로 렌더링 후 `role="button"`과 `tabIndex`로 접근성 처리.

---

**[WARNING] `source` 필드 해석 계약의 불명확성**
- 위치: `carousel.handler.ts` execute 메서드
- 상세: 주석("source is resolved by the expression engine before reaching the handler")과 달리, 코드는 `sourceData`(config.source)가 배열이 아닐 경우 `input`으로 폴백하는 방어 로직을 포함함. 즉 핸들러가 "표현식 엔진이 이미 해석한다"고 가정하면서도 해석되지 않은 경우를 직접 처리함. 실행 흐름의 어느 단계에서 `source` 표현식이 해석되는지 책임 경계가 모호함.
- 제안: 핸들러 진입 전 표현식 해석을 보장하는 계층을 명시하고, 핸들러는 이미 해석된 배열 데이터만 수신한다는 계약을 타입으로 강제. 폴백 로직은 제거하거나 경고 로그를 추가.

---

**[WARNING] `RunResultsDrawer`의 URL 구조 직접 의존**
- 위치: `run-results-drawer.tsx`
- 상세: `useParams()`로 현재 라우트에서 `workflowId`를 추출하여 실행 내역 링크를 구성함. 이는 Drawer 컴포넌트가 `/workflows/[id]/...` URL 구조에 직접 결합됨을 의미하며, 라우트 구조 변경 시 이 컴포넌트도 수정 필요. 또한 `<a href>` + `target="_blank"`와 `router.push()`를 혼용하는 네비게이션 패턴 불일치도 존재함.
- 제안: `workflowId`를 prop으로 외부에서 주입받거나, 링크 생성 로직을 별도 훅(`useWorkflowNavigationLinks`)으로 추출하여 URL 구성 책임을 분리.

---

**[INFO] `execution-store.ts`에서 실행 상태와 UI 선택 상태의 혼합**
- 위치: `execution-store.ts` — `waitForForm`, `waitForButtons`, `waitForConversation`
- 상세: `selectedResultNodeId: nodeId`가 대기 상태 설정과 동시에 store에 기록됨. 실행 상태(무엇을 기다리는가)와 UI 상태(어떤 노드가 선택되어 있는가)가 단일 store mutation에 결합되어, 두 관심사의 변경 이유가 달라지는 시점에 코드 분리가 어려워짐.
- 제안: 선택 상태를 별도 `useEffect`에서 `waitingNodeId` 변경을 감지하여 업데이트하거나, UI 상태를 별도 로컬 상태로 관리.

---

**[INFO] `unwrap` 헬퍼의 휴리스틱 타입 판별**
- 위치: `executions.ts`
- 상세: `unwrap<T>`이 `data?.data !== undefined && typeof data.data === "object" && !Array.isArray(data.data)` 조건으로 래핑 여부를 런타임에 추론함. `getByWorkflow`는 `unwrap`을 사용하지 않고 `data as PaginatedExecutions`로 직접 캐스팅하여 일관성이 없음. API 계약이 변경되면 이 휴리스틱이 잘못 작동할 수 있음.
- 제안: `getById`와 `getByWorkflow` 모두 동일한 정규화 전략을 적용하거나, axios 인터셉터에서 일괄 언래핑하여 API 레이어에서 항상 `T` 타입만 반환하도록 통일.

---

### 요약

전체적으로 실행 내역 UI의 계층 분리(API 레이어 정규화, 상수 추출)와 캐러셀 아이템 버튼의 기능 확장 방향은 적절하다. 그러나 **`__item_` 문자열 프로토콜이 핸들러·엔진·프런트엔드 세 레이어를 암묵적으로 결합**하는 것이 가장 심각한 아키텍처 부채이며, 변경 파급 범위가 넓다. `previewOnly` boolean prop과 동적 `Wrapper` 타입은 단일 컴포넌트에 복수 책임을 부여하고 React 렌더링 안정성을 저해하는 OCP 위반이다. `source` 필드의 계약 불명확성과 `RunResultsDrawer`의 URL 의존성은 각 컴포넌트의 책임 경계가 모호하게 정의된 사례로, 계층 간 계약을 타입과 인터페이스로 명시하는 방식으로 개선이 필요하다.

### 위험도
**MEDIUM**