## 발견사항

### [WARNING] `service['configService']` private 필드 직접 접근
- **위치**: `execution-engine.service.spec.ts`, `should throw when a node exceeds MAX_NODE_ITERATIONS` / `should allow unlimited iterations when MAX_NODE_ITERATIONS=0`
- **상세**: 테스트 내에서 `service['configService'] as unknown as { get: jest.Mock }` 형태로 private 필드를 직접 조작. 필드명이 변경되면 런타임에 `undefined.mockImplementation`으로 에러 없이 조용히 실패하거나 잘못된 값으로 테스트가 통과될 위험이 있음
- **제안**: `MAX_NODE_ITERATIONS`가 다른 값이어야 하는 테스트는 독립 `describe` 블록에서 `beforeEach`의 `ConfigService` mock을 교체하여 별도 `TestingModule`을 구성하거나, 최소한 `configService.get.mockReturnValue` 대신 spy를 사용

---

### [WARNING] `back-edge-identifier.spec.ts` — self-loop 케이스 미테스트
- **위치**: `back-edge-identifier.spec.ts` 전반
- **상세**: `A → A` 형태의 자기 참조(self-loop) 엣지가 DFS에서 GRAY→GRAY로 back-edge로 분류되는지 검증하는 케이스가 없음. 구현은 이 케이스를 처리할 수 있지만 명시적 테스트가 없어 회귀 위험 존재
- **제안**:
  ```ts
  it('should identify self-loop as a back-edge', () => {
    const nodes: GraphNode[] = [{ id: 'A' }];
    const edges: GraphEdge[] = [edge('A', 'A')];
    const result = identifyBackEdges(nodes, edges);
    expect(result.backEdges).toHaveLength(1);
    expect(result.forwardEdges).toHaveLength(0);
  });
  ```

---

### [WARNING] back-edge `targetIndex === -1` 가드 미존재 및 미테스트
- **위치**: `execution-engine.service.ts:277` (`sortedNodeIds.indexOf(edge.targetNodeId)`)
- **상세**: `backEdge.targetNodeId`가 `sortedNodeIds`에 없으면 `indexOf`가 `-1`을 반환하고, `pointer = -1`로 세팅됨. JavaScript에서 `sortedNodeIds[-1]` → `undefined`, `nodeMap.get(undefined)` → `undefined`이므로 `pointer++`로 0이 되어 루프가 처음부터 재시작되는 미묘한 버그. 이 경계 케이스에 대한 가드도 테스트도 없음
- **제안**: `targetIndex < 0`인 경우 skip하거나 에러를 던지는 방어 로직 추가 후 테스트 케이스 작성

---

### [WARNING] 순환 재실행 시 노드가 받는 입력값 검증 없음
- **위치**: `execution-engine.service.spec.ts`, `should execute a cyclic workflow when back-edge port is conditionally selected`
- **상세**: 포인터 되감기 시 `executedNodes`는 초기화되지 않지만 `nodeOutputCache`는 재실행 후 갱신됨. 두 번째 루프에서 각 노드가 실제로 올바른 입력(갱신된 이전 노드의 출력)을 받는지 검증하지 않고 호출 횟수와 최종 상태만 확인함
- **제안**: 루프 재실행 중 각 노드의 input을 캡처하여 두 번째 실행에서 올바른 데이터가 전달되는지 assertions 추가

---

### [WARNING] `portRoutingSkipped` 리셋 동작 검증 테스트 없음
- **위치**: `execution-engine.service.ts:430-434` (back-edge 활성화 시 portRoutingSkipped 리셋)
- **상세**: 재실행 구간의 포트 라우팅 스킵 상태를 초기화하는 로직이 있으나, 이 동작을 직접 검증하는 테스트가 없음. 순환 실행 내에 포트 라우팅(버튼, 분기)이 조합된 시나리오 미테스트
- **제안**: 첫 번째 루프에서 분기에 의해 스킵된 노드가 back-edge 이후 재실행 구간에서 정상 실행되는지 검증하는 테스트 추가

---

### [INFO] 순환 + Form 노드 조합 시나리오 미테스트
- **위치**: `execution-engine.service.spec.ts`
- **상세**: 사이클 경로 상에 Form 노드가 있어 `waiting_for_input` 상태로 일시 정지 후 재개될 때 back-edge 활성화가 올바르게 동작하는지 검증하는 테스트가 없음

---

### [INFO] 순환 실행 중 노드 에러 발생 시 동작 미테스트
- **위치**: `execution-engine.service.spec.ts`
- **상세**: 순환 내 노드가 에러를 던졌을 때 `stop_workflow` / `skip` / `use_default` 에러 정책과의 조합이 테스트되지 않음. 특히 `skip` 정책으로 처리 후 back-edge 활성화 로직이 올바르게 동작하는지 불명확

---

### [INFO] `nodeExecutionCount` 직접 검증 없음
- **위치**: `execution-engine.service.spec.ts`
- **상세**: 반복 횟수를 추적하는 `nodeExecutionCount`가 정확히 증가하는지 직접 검증하는 테스트가 없음. 현재는 간접적으로 MAX_NODE_ITERATIONS 초과 여부를 통해서만 검증됨

---

## 요약

`back-edge-identifier`의 단위 테스트는 DAG, 단순 사이클, 복합 사이클, 다이아몬드 그래프 등 핵심 케이스를 잘 커버하고 있으며, 서비스 레벨 통합 테스트도 기본 순환 시나리오(조건부 분기, MAX_NODE_ITERATIONS, 무제한, 회귀)를 충실히 추가했다. 그러나 **private 필드 직접 조작으로 인한 테스트 취약성**, **self-loop 미테스트**, **back-edge `targetIndex = -1` 미가드**, **재실행 구간의 실제 데이터 흐름 검증 부재**, **portRoutingSkipped 리셋 동작 검증 부재** 등 중요한 갭이 존재하여 일부 엣지 케이스와 리팩토링 시 회귀 탐지 능력이 부족하다.

## 위험도

**MEDIUM**