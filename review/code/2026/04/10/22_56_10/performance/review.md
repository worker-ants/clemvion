## 성능 코드 리뷰

### 발견사항

---

- **[WARNING]** `propagateReachability`에서 매 노드 실행마다 전체 엣지 선형 스캔
  - 위치: `execution-engine.service.ts` — `propagateReachability` 메서드
  - 상세: `edges.filter((e) => e.sourceNodeId === nodeId)`는 O(E)이며, 이 메서드가 노드 실행마다 호출되므로 전체 실행 복잡도가 O(N × E)가 됨. 노드 수 N=100, 엣지 E=200인 워크플로우에서 20,000번의 엣지 비교 발생. 반면 `backEdgeMap`은 이미 시작 시 Map으로 사전 구축해 O(1) 조회를 사용하고 있어 일관성도 없음.
  - 제안:
    ```typescript
    // 실행 시작 시 한 번 구축 (O(E))
    const outgoingEdgeMap = new Map<string, GraphEdge[]>();
    for (const edge of graphEdges) {
      const list = outgoingEdgeMap.get(edge.sourceNodeId) ?? [];
      list.push(edge);
      outgoingEdgeMap.set(edge.sourceNodeId, list);
    }

    // propagateReachability에서 O(1) 조회
    const outgoingEdges = outgoingEdgeMap.get(nodeId) ?? [];
    ```

---

- **[WARNING]** `reachable` 초기화 루프의 이중 선형 탐색
  - 위치: `execution-engine.service.ts` — `runExecution`과 `executeInline` 양쪽의 reachable 초기화 블록
  - 상세: `forwardEdges.some((e) => e.targetNodeId === id)`를 sortedNodeIds 루프 내에서 호출 → O(N × E). 동일한 패턴이 `runExecution`과 `executeInline` 두 곳에 중복되어 있음.
  - 제안:
    ```typescript
    // O(E)로 사전 구축
    const nodesWithIncoming = new Set(forwardEdges.map(e => e.targetNodeId));
    for (const id of sortedNodeIds) {
      if (!nodesWithIncoming.has(id)) reachable.add(id);
    }
    ```

---

- **[INFO]** `reachable` 초기화 및 실행 루프 로직이 `runExecution`과 `executeInline` 양쪽에 중복
  - 위치: `execution-engine.service.ts` — 두 메서드 내 while 루프 전체
  - 상세: `reachable` 초기화, 미도달 노드 skip, `propagateReachability` 호출, 백엣지 처리가 두 메서드에 동일하게 존재. 버그 수정 시 양쪽을 모두 수정해야 하는 유지보수 부채.
  - 제안: 공통 실행 루프를 별도 private 메서드로 추출하여 두 메서드에서 재사용.

---

- **[INFO]** `text-classifier.handler.ts`의 `execute`에서 매 호출마다 `llmService.resolveConfig` 호출
  - 위치: `text-classifier.handler.ts:45` — `resolveConfig` 호출
  - 상세: 워크플로우 내에서 동일한 `llmConfigId`로 여러 번 노드가 실행될 경우(루프 등), 매번 DB 조회가 발생함. 다른 AI 핸들러들도 동일한 패턴을 가질 가능성 있음.
  - 제안: `ExecutionContext`나 핸들러 수준의 간단한 캐싱으로 동일 실행 내 중복 조회 방지.

---

### 요약

이번 변경의 핵심인 `portRoutingSkipped` → `reachable` Set 방식 전환은 알고리즘적으로 올바른 방향이지만, `propagateReachability`에서 전체 엣지 배열을 매번 선형 스캔하고 `reachable` 초기화도 O(N×E)로 수행하는 두 가지 성능 비효율이 도입되었다. 이미 `backEdgeMap` 사전 구축으로 동일한 최적화 패턴을 활용하고 있음에도 `propagateReachability`에는 적용되지 않아 일관성도 떨어진다. 일반적인 워크플로우 규모(노드 수십~수백 개)에서는 체감 영향이 작겠지만, 동일 패턴으로 `outgoingEdgeMap`과 `nodesWithIncoming` Set을 사전 구축하면 O(N×E)를 O(N+E)로 개선할 수 있다.

### 위험도

**LOW**