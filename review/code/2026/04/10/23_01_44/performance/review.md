## 성능 코드 리뷰

### 발견사항

---

- **[WARNING]** `propagateReachability`에서 매 노드 실행마다 전체 엣지 선형 스캔
  - 위치: `execution-engine.service.ts` — `propagateReachability` 메서드
  - 상세: `edges.filter((e) => e.sourceNodeId === nodeId)`는 O(E)이며, 이 메서드가 노드 실행마다 호출되므로 전체 복잡도가 O(N × E). N=100, E=200 워크플로우에서 20,000번의 엣지 비교 발생. 기존에 이미 `backEdgeMap`을 `Map<string, GraphEdge[]>`로 사전 구축해 O(1) 조회를 쓰고 있어 일관성도 없음.
  - 제안:
    ```typescript
    // 실행 시작 시 한 번 구축 (O(E))
    const outgoingEdgeMap = new Map<string, GraphEdge[]>();
    for (const edge of graphEdges) {
      const list = outgoingEdgeMap.get(edge.sourceNodeId) ?? [];
      list.push(edge);
      outgoingEdgeMap.set(edge.sourceNodeId, list);
    }
    // propagateReachability 시그니처 변경: edges 대신 outgoingEdgeMap 전달
    const outgoingEdges = outgoingEdgeMap.get(nodeId) ?? [];
    ```

---

- **[WARNING]** `reachable` 초기화 루프의 이중 선형 탐색
  - 위치: `execution-engine.service.ts` — `runExecution`(~726행)과 `executeInline`(~334행) 양쪽의 초기화 블록
  - 상세: `forwardEdges.some((e) => e.targetNodeId === id)`를 `sortedNodeIds` 루프 내에서 호출 → O(N × E). 두 곳 모두 동일하게 중복.
  - 제안:
    ```typescript
    // O(E)로 사전 구축
    const nodesWithIncoming = new Set(forwardEdges.map(e => e.targetNodeId));
    for (const id of sortedNodeIds) {
      if (!nodesWithIncoming.has(id)) reachable.add(id);
    }
    ```
    추가로 `buildInitialReachableSet(sortedNodeIds, forwardEdges): Set<string>` private 헬퍼로 추출하면 중복 제거도 동시에 해결.

---

- **[INFO]** `text-classifier.handler.ts`의 `execute`에서 매 호출마다 `llmService.resolveConfig` 호출
  - 위치: `text-classifier.handler.ts:45`
  - 상세: 동일한 `llmConfigId`로 루프 내에서 노드가 반복 실행될 경우 매번 DB 조회 발생. 다른 AI 핸들러들도 동일 패턴을 가질 가능성 높음.
  - 제안: `ExecutionContext`에 `llmConfigCache: Map<string, LlmConfig>` 필드를 추가하거나, 핸들러 수준에서 인스턴스 캐싱으로 동일 실행 내 중복 조회 방지.

---

- **[INFO]** 실행 루프 로직(`reachable` 초기화, `propagateReachability` 호출, back-edge 처리)이 `runExecution`과 `executeInline` 양쪽에 중복
  - 위치: `execution-engine.service.ts` — 두 메서드의 `while` 루프 전체
  - 상세: 성능 최적화(앞의 두 WARNING 항목)를 적용할 경우 양쪽을 모두 수정해야 하는 유지보수 부채. 공통 실행 루프를 `executeGraphLoop(...)` private 메서드로 추출하면 최적화를 한 번만 적용 가능.
  - 제안: 추출 시 `outgoingEdgeMap` 사전 구축도 해당 메서드 내부에서 한 번만 수행하도록 위치시킴.

---

### 요약

이번 변경에서 도입된 `reachable` 기반 도달성 전파 방식은 알고리즘 정확성을 높이는 올바른 방향이나, `propagateReachability`의 `edges.filter()`가 매 노드 실행마다 전체 엣지를 선형 스캔하고 초기화 루프 역시 O(N×E) 이중 탐색을 수행하여 두 가지 성능 비효율이 동시에 도입되었다. 이미 `backEdgeMap`을 Map으로 사전 구축해 O(1) 조회하는 패턴이 동일 코드에 존재함에도 `propagateReachability`에 적용되지 않아 일관성도 떨어진다. 일반적인 워크플로우 규모(수십 노드)에서는 체감 영향이 작지만, `outgoingEdgeMap`과 `nodesWithIncoming` Set을 실행 시작 시 O(E)로 한 번만 구축하면 O(N×E)를 O(N+E)로 개선할 수 있으며, 두 메서드에 중복된 루프 로직을 공통 메서드로 추출할 경우 최적화를 단 한 곳에서 적용 가능하다.

### 위험도

**LOW**