## 부작용 코드 리뷰

### 발견사항

---

**[WARNING] `executionsApi.getById` 반환 타입 변경으로 인한 기존 호출자 파괴**
- 위치: `frontend/src/lib/api/executions.ts`
- 상세: `getById`가 기존 `Promise<AxiosResponse<ExecutionData>>`에서 `Promise<ExecutionData>`로 변경됨. `use-execution-events.ts`는 맞게 수정되었으나, 이 API를 호출하는 다른 곳(테스트 파일의 mock 포함)이 모두 영향을 받음. `use-execution-events.test.ts`도 `{ data: createMockExecution() }` → `createMockExecution()`으로 수정된 것을 보면 알 수 있음. 만약 수정되지 않은 다른 호출자가 있다면 런타임 오류 발생.
- 제안: `getById` 를 사용하는 모든 파일 grep으로 완전히 확인 필요.

---

**[WARNING] `unwrap()` 함수의 불안정한 휴리스틱 — 배열 응답 오처리 위험**
- 위치: `frontend/src/lib/api/executions.ts` — `unwrap<T>()` 함수
- 상세: `!Array.isArray(data.data)` 조건으로 배열 응답을 제외하지만, `getByWorkflow`는 `unwrap`을 사용하지 않고 `data as PaginatedExecutions`로 직접 캐스팅함. 반면 `getById`의 `unwrap`은 `data.data`가 배열이면 `data` 자체를 반환하는데, 서버가 `{ data: { id: "..." } }` 구조로 내려오면 정상 동작하지만 `{ data: null }` 또는 `{ data: undefined }` 케이스에서 `data?.data !== undefined` 조건이 false가 되어 `data` 전체를 반환 — 즉 `data`가 `ExecutionData` 타입이 아닌 `AxiosResponse` 객체가 반환될 수 있음.
- 제안: `unwrap`의 동작을 axios interceptor 레벨로 올리거나, 조건을 명확히 해야 함.

---

**[WARNING] `execution-store.ts`의 `waitingNode*` 액션에 `selectedResultNodeId` 추가 — 기존 UI 흐름 변경**
- 위치: `frontend/src/lib/stores/execution-store.ts`
- 상세: `waitForForm`, `waitForButtons`, `waitForConversation` 액션에 `selectedResultNodeId: nodeId`가 추가됨. 이는 waiting 상태 진입 시 자동으로 해당 노드를 선택하는 부작용을 유발. 기존에 사용자가 다른 노드를 보고 있던 중 waiting이 발생하면 강제로 포커스가 이동하는 UX 변화가 생김. 주석도 `"Auto-select any blocking node"`로 변경되었으나, 이 동작이 always-on인지는 사용 환경에 따라 원치 않을 수 있음.
- 제안: 이미 `selectedResultNodeId`가 다른 노드로 설정된 경우 override하지 않는 옵션 고려.

---

**[WARNING] `carousel.handler.ts`의 `source` 필드 처리 — 표현식 미resolve 시 정상 동작 실패**
- 위치: `backend/src/modules/execution-engine/handlers/presentation/carousel.handler.ts`
- 상세: `const sourceData = config.source;`로 읽은 후 `Array.isArray(sourceData) ? sourceData : Array.isArray(input) ? input : ...` 폴백 구조를 사용. 주석에 "source is resolved by the expression engine before reaching the handler"라고 명시되어 있으나, 만약 표현식 엔진이 resolve 전에 핸들러가 호출되거나 표현식 결과가 배열이 아닌 경우(예: 객체, 문자열), 예고 없이 `input` 폴백으로 넘어감. 이는 디버깅이 어려운 조용한 실패.
- 제안: `source`가 정의되어 있는데 배열이 아닌 경우 명시적 오류 또는 경고 로그 추가.

---

**[WARNING] `carousel.handler.ts`의 dynamic item 버튼 ID 변환 — 백엔드-프론트엔드 포트 ID 불일치 가능성**
- 위치: `backend/src/modules/execution-engine/handlers/presentation/carousel.handler.ts` + `frontend/src/components/editor/canvas/custom-node.tsx`
- 상세: 런타임에 버튼 ID가 `${btn.id}__item_${itemIdx}`로 변환되고, `execution-engine.service.ts`에서 클릭 시 `buttonId.split('__item_')[0]`으로 base port ID로 복원. 에디터의 `custom-node.tsx`에서는 동적 모드 `itemButtons`의 포트를 원본 `btn.id`로 등록. 따라서 런타임 이벤트의 `selectedPort`와 에디터 엣지의 `sourceHandle`이 일치하는 것은 확인됨. 그러나 `buttonId`에 `__item_`이 이미 포함된 경우 split이 오작동 가능(`split('__item_')[0]`은 첫 번째 occurrence만 처리).
- 제안: `buttonId.replace(/__item_\d+$/, '')` 방식이 더 안전.

---

**[INFO] `ConversationInspector`에 `previewOnly` prop 추가 — 내부 상태 분기 복잡도 증가**
- 위치: `frontend/src/components/editor/run-results/conversation-inspector.tsx`
- 상세: `previewOnly=false`(기본값)일 때 `selectedItemIndex`(외부 props)를 사용하고, `true`일 때 `internalSelectedIndex`(내부 state)를 사용. 두 경로가 동일 컴포넌트에 공존하며, `previewOnly=false`에서 `internalSelectedIndex`는 항상 `null`이지만 `useState`로 항상 생성됨. 부작용 자체보다는 향후 `previewOnly`가 동적으로 변경될 경우 `effectiveIndex`가 잘못된 상태를 참조할 수 있음.
- 제안: 두 모드를 별도 컴포넌트로 분리하거나, prop 변경 시 상태 초기화 로직 추가.

---

**[INFO] `POLL_INTERVAL_WAITING_MS` 변경 (10000ms → 2000ms)**
- 위치: `frontend/src/lib/websocket/use-execution-events.ts`
- 상세: waiting 상태에서 폴링 간격이 5배 빨라짐. 이는 네트워크 요청 빈도 증가라는 부작용. WebSocket 이벤트가 정상 동작할 때는 폴링에 의존하지 않지만, WebSocket 연결이 끊긴 상황에서 부하가 증가.
- 제안: 현재 스펙에서 의도된 변경이라면 허용 가능. 단, 서버 부하 모니터링 권장.

---

**[INFO] `execution-engine.service.ts` — `_selectedPort`가 다운스트림 입력에서 제거됨**
- 위치: `backend/src/modules/execution-engine/execution-engine.service.ts` + `execution-engine.service.spec.ts`
- 상세: `_selectedPort`가 interactionData에는 남아있지만 다운스트림 노드 입력에는 전달되지 않도록 변경. 기존에 `_selectedPort`를 입력으로 읽는 다운스트림 노드 설정이 있다면 동작이 달라짐. 테스트도 이를 반영하여 수정됨.
- 제안: 이미 배포된 워크플로우 중 `_selectedPort`를 읽는 케이스가 있는지 확인 필요.

---

### 요약

전반적으로 이번 변경의 가장 큰 부작용 위험은 **`executionsApi.getById` 반환 타입 변경**으로, 이를 호출하는 모든 코드가 영향을 받으며 누락된 호출자가 있을 경우 런타임 오류가 발생한다. `unwrap()` 헬퍼의 휴리스틱이 `null`/비배열 케이스에서 잘못된 타입을 반환할 수 있는 점, carousel 아이템 버튼 ID의 `__item_` 변환-복원 로직이 ID에 `__item_`이 이미 포함된 경우 오작동할 수 있는 점, waiting 상태 진입 시 강제 노드 선택이 기존 UX에 미치는 영향이 주요 부작용이다. `_selectedPort` 제거는 기존 워크플로우 호환성을 검토해야 하며, 폴링 간격 단축은 서버 부하 증가를 수반한다.

### 위험도

**MEDIUM**