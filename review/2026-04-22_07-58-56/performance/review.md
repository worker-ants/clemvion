### 발견사항

- **[WARNING]** `wouldCreateCycle` 내부 루프에서 `isContainerAncestor` 반복 호출 시 매번 `Set<string>` 생성
  - 위치: `shadow-workflow.ts`, `wouldCreateCycle` 내 `for (const edge of this.edges.values())` 루프 (diff 기준 +14~+17줄)
  - 상세: DFS로 방문하는 각 노드 `cur`에 대해 전체 엣지를 순회하고, `sourceNodeId === cur`인 엣지마다 `isContainerAncestor`를 호출한다. `isContainerAncestor`는 매 호출 시 `new Set<string>()`을 생성한다. 노드 V개, 엣지 E개 기준 최악 O(V × E)번의 Set 할당이 발생한다. 워크플로우 규모가 작으면 무시할 수 있으나, GC 압력 측면에서 불필요하다.
  - 제안: DFS 진입 전 container back-edge ID를 한 번만 pre-compute해 `Set<string>`으로 캐싱하거나, `isContainerAncestor` 결과를 `Map<string, boolean>` 캐시에 저장해 동일 `(sourceId, targetId)` 쌍의 재계산을 방지한다.

    ```typescript
    // wouldCreateCycle 시작 시 한 번만 필터링
    const backEdgeTargets = new Map<string, Set<string>>();
    for (const edge of this.edges.values()) {
      if (this.isContainerAncestor(edge.sourceNodeId, edge.targetNodeId)) {
        if (!backEdgeTargets.has(edge.sourceNodeId))
          backEdgeTargets.set(edge.sourceNodeId, new Set());
        backEdgeTargets.get(edge.sourceNodeId)!.add(edge.targetNodeId);
      }
    }
    // 이후 루프에서 isContainerAncestor 대신 backEdgeTargets.get(cur)?.has(edge.targetNodeId) 사용
    ```

- **[INFO]** `wouldCreateCycle`의 엣지 스캔이 O(E)인 구조는 기존 코드부터 존재하는 사전 이슈
  - 위치: `shadow-workflow.ts`, `wouldCreateCycle` 전체
  - 상세: 방문 노드마다 `this.edges.values()` 전체를 순회해 `sourceNodeId === cur` 조건으로 필터링한다. 인접 리스트 `Map<nodeId, ShadowEdge[]>`를 `ShadowWorkflow` 내부에 유지하면 O(1) 조회로 단축 가능하다. 이번 diff가 도입한 문제는 아니지만, `isContainerAncestor` 중첩 호출로 단위 비용이 높아져 체감이 더 커졌다.
  - 제안: `edges` Map과 병행해 `private adjacency = new Map<string, ShadowEdge[]>()`를 유지하고 `addEdge`/`removeEdge`에서 갱신하면 `wouldCreateCycle`을 O(V + E)로 개선할 수 있다.

- **[INFO]** `isContainerAncestor` 내부의 `Set<string>()` 초기화는 컨테이너 순환 손상 방어용으로 정당하나, 일반 경로에서는 불필요
  - 위치: `shadow-workflow.ts`, `isContainerAncestor` (diff +22~+35줄)
  - 상세: 정상적인 데이터에서 `containerId` 체인이 순환하는 경우는 없으므로 `visited` Set이 실제로 쓰이는 경우는 데이터 손상 시뿐이다. 과도한 방어 비용은 아니지만 컨테이너 깊이가 1~3인 일반 케이스에서는 Set 생성 자체가 순회 비용과 동급이다.
  - 제안: 현행 유지를 권장. 무한루프 방어의 정확성이 더 중요하다. 다만 위 WARNING 항목에서 Set 재사용으로 보완하면 전체 할당 횟수가 줄어든다.

- **[INFO]** 테스트 파일 — 성능 이슈 없음
  - 위치: `shadow-workflow.spec.ts` 전체
  - 상세: 각 테스트가 독립적인 소형 `ShadowWorkflow` 인스턴스를 생성하며, 노드 수는 최대 4개다. 메모리 할당 및 실행 시간 모두 무시 가능한 수준이다.

---

### 요약

이번 변경의 핵심 성능 부담은 `wouldCreateCycle` 내부 루프에서 `isContainerAncestor`를 반복 호출할 때 매번 `new Set<string>()`이 생성된다는 점이다. 현실적인 워크플로우 규모(노드 수십~백 개)에서는 측정 가능한 지연을 유발하지 않으므로 즉각적인 수정이 필수적이지는 않다. 그러나 DFS 진입 전에 back-edge를 한 번만 pre-filter하는 패턴으로 바꾸면 코드 의도도 더 명확해지고 불필요한 GC 할당도 줄어든다. 알고리즘 구조 자체(전체 엣지 O(E) 순회)는 이번 diff 이전부터 존재하던 이슈이며, 인접 리스트 도입으로 근본적으로 개선할 수 있다.

### 위험도

**LOW**