## 성능 코드 리뷰

### 발견사항

---

**[WARNING]** `pendingContinuations` Map 메모리 누수 가능성
- 위치: `execution-engine.service.ts` — `pendingContinuations` Map
- 상세: `waitForFormSubmission`에서 Promise를 생성하고 Map에 등록하지만, 서버 재시작이나 비정상 종료 시 resolve/reject 없이 Map 엔트리가 영구적으로 잔류할 수 있음. 현재 `finally` 블록에서 `pendingContinuations.delete(executionId)`를 호출하고 있으나, 이는 실행이 정상 흐름으로 진입한 경우에만 동작함. WebSocket 연결이 끊긴 채 Form 대기 중인 실행은 Map에 계속 남아있을 수 있음.
- 제안: TTL 기반 만료 처리 또는 연결 해제 이벤트에서 `cancelWaitingExecution` 연동.

---

**[WARNING]** Form 대기 중 폴링 계속 진행 — 불필요한 API 호출
- 위치: `use-execution-events.ts` — `pollExecutionStatus` 반환값
- 상세: `waiting_for_input` 상태에서 `return false`를 반환해 폴링을 계속 유지함. 폴 주기가 2초이므로 Form 대기가 10분이면 약 300번의 REST API 호출이 발생함. 이 기간 동안 상태 변화가 없으면 모든 호출이 낭비됨.
- 제안: `waiting_for_input` 상태 감지 후 폴링 주기를 확장(`backoff`)하거나, WS 이벤트(`execution.started` 재수신)가 올 때까지 폴링을 일시 중단.

---

**[WARNING]** `nodeExecutionRepository.findOne` — `waitForFormSubmission`에서 매번 DB 조회
- 위치: `execution-engine.service.ts:waitForFormSubmission`
- 상세: Form 노드 처리 시마다 `nodeExecutionRepository.findOne({ where: { executionId, nodeId } })`를 실행함. 실행 흐름에서 해당 `NodeExecution` 객체는 이미 상위 `executeNode` 로직에서 생성·저장된 상태이므로 다시 DB를 조회할 필요가 없음.
- 제안: `executeNode`에서 반환된 `NodeExecution` 인스턴스를 `waitForFormSubmission`에 파라미터로 전달하여 불필요한 DB roundtrip 제거.

---

**[INFO]** `addNodeResult`에서 매 호출마다 선형 탐색
- 위치: `execution-store.ts:addNodeResult`
- 상세: 중복 확인 시 `Array.some()` + `Array.map()`으로 O(n) 탐색을 두 번 수행. 결과 수가 수십 개 이하라면 실질적 문제는 없으나, 구조적으로는 비효율적.
- 제안: `nodeResults`를 `Map<string, NodeResult>`으로 관리하면 O(1) 조회/업데이트 가능. 단, 렌더링 시 `Array.from(map.values())`로 변환 필요.

---

**[INFO]** `dangerouslySetInnerHTML` — 보안/렌더링 비용
- 위치: `run-results-drawer.tsx:ChartContent`, `TemplateContent`
- 상세: 성능 이슈보다는 보안 이슈가 주이나, 외부에서 받은 HTML을 직접 삽입하면 대용량 HTML의 경우 레이아웃 계산 비용이 증가할 수 있음. 또한 매 렌더링마다 DOM을 재구성함.
- 제안: `useMemo`로 렌더링된 HTML을 메모이제이션하거나, Chart의 경우 SVG를 별도 컴포넌트로 분리하여 불필요한 재렌더 방지.

---

**[INFO]** 폴링에서 Presentation 노드 결과 중복 수집
- 위치: `use-execution-events.ts:pollExecutionStatus`
- 상세: 폴링 시 `nodeExecutions`를 전체 순회하며 모든 완료된 Presentation 노드 결과를 `addNodeResult`로 추가함. `addNodeResult`는 중복 방지 로직이 있지만, 폴링마다(2초 간격) 동일한 배열을 반복 순회하는 O(n) 연산이 계속 발생함. 노드 수가 많을 경우 누적 비용이 있음.
- 제안: 마지막으로 처리한 `nodeExecution` 개수를 ref로 추적하여 신규 항목만 처리하는 증분 처리 방식 적용.

---

**[INFO]** `useEffect` 의존 배열 과다 — 불필요한 cleanup/re-subscribe 가능성
- 위치: `use-execution-events.ts` — `useEffect` 의존 배열 (14개 항목)
- 상세: `handleExecutionStarted`, `handleNodeCompleted` 등이 `useCallback`으로 메모이제이션되어 있으나, 의존 배열에 `addNodeResult`, `pauseForForm` 같은 Zustand 액션 함수가 포함됨. Zustand의 `create`는 동일 참조를 보장하므로 실제 문제는 적지만, 향후 리팩토링 시 리스크 요인.
- 제안: Zustand store actions는 불변 참조이므로 `useExecutionStore.getState().action()` 패턴으로 의존 배열에서 제외 가능.

---

### 요약

이번 변경은 Form 노드의 실행 일시 정지/재개 기능을 추가한 것으로, 전반적으로 구현이 올바르게 이루어졌다. 핵심 성능 리스크는 두 가지다: (1) Form 대기 중에도 2초 간격 폴링이 중단 없이 진행되어 불필요한 REST API 호출이 누적되고, (2) `nodeExecutionRepository.findOne`이 이미 메모리에 있는 엔티티를 재조회하는 불필요한 DB roundtrip이 발생한다. `pendingContinuations` Map의 메모리 누수는 현재 `finally` 블록으로 일부 방어되어 있으나, 비정상 종료 경로에서는 여전히 잔류 가능성이 있다. 나머지 이슈들은 현 규모에서는 영향이 미미하지만, 노드 수가 증가할 경우 개선이 권장된다.

### 위험도

**MEDIUM**