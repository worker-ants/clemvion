## 발견사항

---

### **[WARNING]** unreachable 노드에 대한 `NodeExecution` DB 레코드 및 `NODE_SKIPPED` WebSocket 이벤트 묵음 제거

- **위치**: `execution-engine.service.ts` — `runExecution` 및 `executeInline`의 `reachable` 체크 블록
- **상세**: 기존 `portRoutingSkipped` 방식은 skip된 노드마다 `createNodeExecution(..., SKIPPED)` + `emitNodeEvent(..., NODE_SKIPPED)`를 명시적으로 호출했습니다. 새 방식은 `pointer++` 후 `continue`로 완전히 건너뜁니다. 두 가지 부작용 변화가 동시에 발생합니다:
  1. **DB 상태**: `node_executions` 테이블에 해당 노드 레코드가 생성되지 않아 실행 이력 조회 시 `node_executions.nodeId`로 JOIN하는 쿼리가 결과를 반환하지 않습니다.
  2. **WebSocket 계약**: `NODE_SKIPPED` 이벤트를 수신해 노드 상태를 "skipped"로 표시하는 프론트엔드 로직이 있다면, 해당 노드들이 "pending" 상태로 영구적으로 표시됩니다.
- **제안**: `isDisabled` 처리와 동일하게 unreachable 노드도 `createNodeExecution` + `emitNodeEvent(NODE_SKIPPED)`를 호출하거나, 이 변경이 의도적임을 스펙과 프론트엔드 코드에서 명시적으로 확인

---

### **[WARNING]** back-edge 점프 시 루프 범위 밖 노드의 stale reachability 잔존

- **위치**: `execution-engine.service.ts:493-497` (executeInline), `843-848` (runExecution)
- **상세**: back-edge 활성화 시 `targetIndex ~ pointer` 범위 내 노드들의 reachability를 삭제합니다. 그러나 루프의 이전 패스에서 `propagateReachability`가 `pointer` 이후 노드(루프 범위 밖)를 이미 `reachable`에 추가했다면, 그 상태가 그대로 유지됩니다.

  시나리오:
  ```
  A → Router[port1→B→C, port2→D] → E (C와 D 모두 E로 연결)
  ```
  1패스: Router가 port1 선택 → B, C, E가 reachable에 추가됨
  back-edge로 Router로 돌아와 2패스: port2 선택 → D, E reachable 추가
  결과: C가 2패스에서도 reachable로 남아 있어 의도치 않게 실행됨

- **제안**: back-edge 점프 시 `pointer` 이후 노드 중 루프 내부에서만 도달 가능한 노드도 함께 초기화하거나, 해당 한계를 명시적으로 주석에 문서화

---

### **[WARNING]** `propagateReachability` 메서드 시그니처 — 내부 캐시 구조에 직접 결합

- **위치**: `execution-engine.service.ts` — `propagateReachability` 메서드 시그니처
- **상세**: `nodeOutputCache: Record<string, unknown>` 매개변수로 `ExecutionContext`의 내부 데이터 구조를 직접 받습니다. `isPortFiltered`가 이 객체에서 `_selectedPort` 키를 직접 읽는 구조이므로, `nodeOutputCache` 내부 포맷이 변경될 경우 `propagateReachability`도 함께 수정해야 합니다. 현재는 두 곳(`runExecution`, `executeInline`)에서 호출되어 변경 범위가 넓어집니다.
- **제안**: 현재 규모에서는 허용 범위이나, 호출 시 `context.nodeOutputCache`를 그대로 전달하지 않고 필요한 노드 출력만 추출해 전달하는 방향으로 개선 가능

---

### **[INFO]** `reachable` 세트에 대한 쓰기 작업이 세 곳에 분산

- **위치**: 초기화 블록, `propagateReachability`, back-edge 리셋 블록
- **상세**: `reachable` 세트는 지역 변수이므로 실행 간 상태 공유 문제는 없습니다. 그러나 쓰기 작업이 세 곳에 분산되어 있어 `reachable.add/delete` 호출 순서에 의존합니다. 특히 `propagateReachability`는 `waitForButtonInteraction` 이후에 호출해야 한다는 암묵적 순서 의존성(temporal coupling)이 주석으로만 표현되어 있습니다.
- **제안**: 현재 동작은 정확합니다. 기존 주석("Must happen after blocking interactions")이 이 의도를 표현하고 있어 허용 가능한 수준입니다.

---

### **[INFO]** `memory/execution-engine-analysis.md` 내용이 현재 구현과 불일치

- **위치**: `memory/execution-engine-analysis.md` 전체
- **상세**: 파일이 `portRoutingSkipped` 기반 방식을 "현재 방식"으로 기술하고, 해당 방식의 문제점을 "현재 문제"로 설명합니다. 이번 변경으로 해당 문제가 해결되었으나 파일은 갱신되지 않았습니다. 향후 이 파일을 참고하면 이미 해결된 문제를 재접근하거나, 존재하지 않는 코드 라인을 수정하려 할 수 있습니다.
- **제안**: `reachable` 기반 방식으로 파일 갱신 필요 (documentation 리뷰어와 동일한 지적)

---

## 요약

이번 변경의 핵심 부작용은 **unreachable 노드에 대한 두 가지 외부 관찰 가능한 동작 제거**입니다: `node_executions` DB 레코드 미생성(실행 이력 완전성 저하)과 `NODE_SKIPPED` WebSocket 이벤트 미발행(프론트엔드 UI 상태 동기화 파괴 가능). `propagateReachability` 메서드 자체는 새로운 부작용 없이 순수하게 `reachable` 세트를 갱신하며, `reachable`은 지역 변수이므로 실행 간 상태 오염은 없습니다. back-edge 재실행 범위 밖의 stale reachability는 복잡한 사이클+분기 그래프에서 잠재적 오실행으로 이어질 수 있으나 현재 테스트 커버리지 내에서는 검출되지 않습니다. 나머지 변경(text-classifier 포맷팅, 테스트 추가)은 부작용이 없습니다.

## 위험도
**MEDIUM**