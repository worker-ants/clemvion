## 성능 코드 리뷰

### 발견사항

---

**[WARNING] `sortedNodeIds.indexOf()` — O(n) 선형 탐색이 back-edge마다 반복**
- 위치: `execution-engine.service.ts`, back-edge 맵 구성 루프
- 상세: `sortedNodeIds.indexOf(edge.targetNodeId)`는 배열을 선형 순회(O(n))하며, back-edge 수가 많아질수록 O(k×n) 비용 발생
- 제안:
  ```ts
  const nodeIndexMap = new Map(sortedNodeIds.map((id, i) => [id, i]));
  // 이후 indexOf 대신 nodeIndexMap.get(edge.targetNodeId) ?? -1 사용
  ```

---

**[WARNING] `portRoutingSkipped` 초기화 루프 — 매 back-edge 활성화마다 O(range) 연산**
- 위치: `execution-engine.service.ts:~435`
  ```ts
  for (let i = activated.targetIndex; i <= pointer; i++) {
    portRoutingSkipped.delete(sortedNodeIds[i]);
  }
  ```
- 상세: 순환이 빈번하고 loop 구간이 넓으면, 반복마다 O(range) 삭제 연산 누적. `maxNodeIterations=100`이고 range가 100개면 10,000번 삭제 연산
- 제안: `portRoutingSkipped`를 단순 Set이 아닌, "현재 loop 시작 index 이후에 추가된 항목만 유효"로 처리하는 버전-카운터 방식 또는 범위별 스냅샷으로 대체 고려

---

**[INFO] `identifyBackEdges` — 외부 edge(노드 집합 외)는 adjacency에서 누락 후 forwardEdges로 재분류 필요**
- 위치: `back-edge-identifier.ts:~28`
- 상세: `nodeIds`에 없는 source/target을 가진 edge는 adjacency 구성 시 skip되지만, 마지막 분류 단계에서 `backEdgeSet`에 없으므로 `forwardEdges`에 포함됨. 기능 문제는 없으나 외부 edge가 매우 많을 경우 불필요하게 `forwardEdges` 배열이 비대해질 수 있음
- 제안: 필요 시 외부 edge를 별도 `externalEdges`로 분리하여 처리 최적화

---

**[INFO] `configService.get()` — 루프 외부에서 1회 호출하지만 매 실행마다 호출됨**
- 위치: `execution-engine.service.ts:~284`
- 상세: `MAX_NODE_ITERATIONS`는 정적 설정값이므로 모듈 초기화 시 캐싱하면 불필요한 환경변수 조회 제거 가능 (현재 실행마다 `runExecution` 내에서 1회 호출 — 허용 가능한 수준이나 캐싱이 더 명확함)
- 제안:
  ```ts
  private readonly maxNodeIterations: number;
  // constructor에서
  this.maxNodeIterations = this.configService.get<number>('MAX_NODE_ITERATIONS', 100);
  ```

---

**[INFO] `nodeOutputCache` — 실행 완료 후 메모리 정리는 `finally`에서 처리됨 (양호)**
- 위치: `execution-engine.service.ts` `finally` 블록
- 상세: `contextService.deleteContext(executionId)` 호출로 누수 방지됨. 다만 `pendingContinuations` Map은 이미 `continueExecution`/`cancelWaiting`에서 삭제되고 `finally`에서도 재삭제하므로 이중 처리이나 문제는 없음

---

**[INFO] `backEdgeMap` 구성 시 `?? []` 패턴으로 매번 새 배열 생성**
- 위치: `execution-engine.service.ts:~268`
  ```ts
  const list = backEdgeMap.get(edge.sourceNodeId) ?? [];
  list.push({ edge, targetIndex });
  backEdgeMap.set(edge.sourceNodeId, list);
  ```
- 상세: `backEdgeMap.get()`이 undefined일 때 새 배열을 생성하고 즉시 set하는 패턴. back-edge가 적으면 문제없으나 관용적으로 명시적 초기화가 더 효율적
- 제안:
  ```ts
  if (!backEdgeMap.has(edge.sourceNodeId)) backEdgeMap.set(edge.sourceNodeId, []);
  backEdgeMap.get(edge.sourceNodeId)!.push({ edge, targetIndex });
  ```

---

### 요약

전체적으로 성능 설계는 양호하다. back-edge 기반 순환 실행 모델은 `while(pointer)` 방식으로 재귀 없이 구현되어 스택 오버플로우 위험이 없고, `identifyBackEdges`의 DFS는 이터레이티브 스택으로 구현되어 깊은 그래프에서도 안전하다. 주요 데이터 구조(Map, Set)의 선택도 적절하다. 개선이 필요한 핵심 포인트는 **`indexOf` O(n) 탐색을 Map으로 교체**하는 것으로, 이는 대규모 워크플로우에서 back-edge가 많을 때 누적 비용이 될 수 있다. `portRoutingSkipped` 범위 초기화 패턴도 루프 구간이 넓은 경우 개선 여지가 있으나 현재 `maxNodeIterations=100` 제한 하에서는 실질적 영향은 제한적이다.

### 위험도

**LOW**