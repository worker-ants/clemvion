### 발견사항

---

**[WARNING] God Class 심화 — `ExecutionEngineService` 단일 책임 원칙 위반**
- 위치: `execution-engine.service.ts` 전체 (~2100줄)
- 상세: 이번 변경으로 도달성(reachability) 전파 책임까지 추가되었습니다. 현재 단일 서비스가 담당하는 책임: 그래프 위상 정렬, 실행 루프 순회, 노드 실행 위임, WebSocket 이벤트 발행, Form/Button/AI 대화 블로킹, 서브워크플로우 인라인 실행, 재시도 복구, 도달성 추적. `propagateReachability` 메서드 추출은 긍정적이지만 핵심 책임 분리는 이루어지지 않았습니다.
- 제안: 최소한 `GraphExecutor`(순회/reachability 로직)와 `BlockingInteractionManager`(Form/Button/AI 대기)를 분리하는 것을 고려하세요. 전면 리팩토링이 어렵다면 `executeGraphLoop` 공통 메서드 추출을 선행 과제로 삼으세요.

---

**[WARNING] 핵심 실행 루프 중복 — `runExecution` vs `executeInline` 구조적 이형동질**
- 위치: `execution-engine.service.ts` — `runExecution` (~726행), `executeInline` (~334행)
- 상세: 이번 diff에서 `reachable` 초기화, unreachable skip, `propagateReachability` 호출, back-edge 리셋 패턴이 두 메서드에 동일하게 추가되었습니다. 약 120줄 이상의 복잡한 로직이 두 곳에 유지됩니다. 한 메서드에서 버그를 수정해도 다른 쪽은 자동으로 반영되지 않으며, 이번 변경 자체가 두 위치를 동시에 수정해야 했음을 증명합니다.
- 제안:
  ```typescript
  private async executeGraphLoop(
    sortedNodeIds: string[],
    nodeMap: Map<string, Node>,
    graphEdges: GraphEdge[],
    forwardEdges: GraphEdge[],
    backEdgeMap: Map<string, BackEdge[]>,
    context: ExecutionContext,
    options: GraphLoopOptions,
  ): Promise<void>
  ```
  `runExecution`과 `executeInline`은 각자의 준비 로직(노드/컨텍스트 로딩) 후 이 메서드를 호출하는 구조로 개선하세요.

---

**[WARNING] `reachable` 초기화 로직의 O(N×E) 복잡도 — 기존 패턴과 불일치**
- 위치: `execution-engine.service.ts` — `runExecution:726`, `executeInline:334`
- 상세: `forwardEdges.some((e) => e.targetNodeId === id)`를 `sortedNodeIds` 루프 내에서 호출하여 O(N×E)가 됩니다. 동일 파일에서 `backEdgeMap`은 이미 `Map<string, BackEdge[]>`로 사전 구축해 O(1) 조회를 활용하고 있어 아키텍처 일관성이 깨집니다.
- 제안: `initReachable` 헬퍼 추출 시 `Set<string>` 사전 구축 패턴을 통합하세요:
  ```typescript
  private buildInitialReachable(sortedNodeIds: string[], forwardEdges: GraphEdge[]): Set<string> {
    const nodesWithIncoming = new Set(forwardEdges.map(e => e.targetNodeId));
    return new Set(sortedNodeIds.filter(id => !nodesWithIncoming.has(id)));
  }
  ```

---

**[WARNING] `propagateReachability`의 O(N×E) 선형 탐색 — adjacency map 미사용**
- 위치: `execution-engine.service.ts` — `propagateReachability` 메서드
- 상세: `edges.filter((e) => e.sourceNodeId === nodeId)`가 노드 실행마다 전체 엣지를 순회합니다. 노드 N=100, 엣지 E=200 워크플로우에서 20,000회 비교 발생. `backEdgeMap`이 이미 `Map` 형태로 사전 구축되어 O(1) 조회를 활용하는 것과 일관성이 없습니다. `propagateReachability`도 동일한 adjacency map 패턴을 사용해야 합니다.
- 제안: 그래프 빌드 시점에 `outgoingEdgeMap: Map<string, GraphEdge[]>`를 구성하고 `propagateReachability`에 전달하거나, 클래스 내부 상태로 관리하세요.

---

**[WARNING] `propagateReachability`와 블로킹 인터랙션 간 시간적 결합(Temporal Coupling)**
- 위치: `execution-engine.service.ts:825-833` (`runExecution`), `:475-483` (`executeInline`)
- 상세: `propagateReachability`는 반드시 `waitForButtonInteraction` 완료 후 호출되어야 합니다(버튼 클릭이 `nodeOutputCache`에 `_selectedPort`를 설정하므로). 현재 주석으로 명시되어 있으나, 메서드 시그니처나 타입 시스템으로는 이 순서 제약이 강제되지 않습니다. 향후 실행 순서를 변경하거나 새 blocking interaction을 추가할 때 조용한 버그가 발생할 수 있습니다.
- 제안: `waitForButtonInteraction` 내부에서 직접 reachability를 업데이트하여 순서 의존성을 메서드 내부로 캡슐화하거나, 인터페이스 레벨에서 순서를 강제하는 구조로 개선하세요.

---

**[INFO] `memory/execution-engine-analysis.md` stale — 구 아키텍처 기술 지속**
- 위치: `memory/execution-engine-analysis.md` 전체
- 상세: 이번 변경으로 해결된 `portRoutingSkipped` 방식의 문제점을 "현재 방식"으로 기술하고 있으며, `### 핵심 파일/라인` 섹션의 라인 번호들도 삭제된 코드 기준입니다. 향후 이 파일을 컨텍스트로 활용하면 이미 해결된 문제에 중복 투자가 발생할 수 있습니다.
- 제안: 파일을 새 `reachable` 기반 방식으로 갱신하세요. "문제점" 섹션을 "해결된 이슈"로 이동하고, 새 아키텍처의 핵심 흐름과 현재 라인 번호를 기술하세요.

---

**[INFO] `executeInline` 내 오래된 용어 잔존**
- 위치: `execution-engine.service.ts` — `executeInline`의 `_selectedPort` strip 주석
- 상세: 주석이 `"it would cause all downstream nodes to be port-routing-skipped"`라고 표현하는데, `portRoutingSkipped` 메커니즘은 이번에 제거되었습니다. 코드베이스와 주석의 용어가 불일치합니다.
- 제안: 주석을 `"it would incorrectly block downstream nodes from being marked reachable"`으로 갱신하세요.

---

**[INFO] back-edge 재실행 범위의 reachability 초기화 — 불변식 미문서화**
- 위치: `execution-engine.service.ts:843-847`
- 상세: back-edge 활성화 시 재실행 범위의 모든 노드를 `reachable`에서 제거 후 target만 추가, 이후 `propagateReachability`로 하위 노드가 재획득되는 구조입니다. 동작은 정확하지만 이 불변식(invariant)이 문서화되어 있지 않아 추후 수정 시 실수 가능성이 있습니다.
- 제안: 해당 블록에 주석 추가:
  ```typescript
  // Re-execution pass: clear the entire range so stale reachability from the
  // previous pass cannot bleed into the new pass. Nodes will be re-activated
  // transitively via propagateReachability as they execute.
  ```

---

### 요약

이번 변경의 핵심인 `portRoutingSkipped` → `reachable` 전파 모델 전환은 아키텍처적으로 올바른 방향입니다. "무엇을 건너뛸지"를 사후 추적하던 방식에서 "무엇이 실행 가능한지"를 사전 전파하는 방식으로 전환함으로써 위상 정렬 비결정성 문제가 해결되었고, `propagateReachability` 메서드 추출은 적정 수준의 추상화입니다. 그러나 구조적 문제가 두 가지 지속됩니다. 첫째, `runExecution`과 `executeInline`의 실행 루프 로직이 이번 변경으로 동일한 패턴이 두 곳에 추가되었으며, 이는 미래의 세 번째 중복 구현을 예고하는 부채입니다. 둘째, `ExecutionEngineService`는 그래프 순회, 블로킹 인터랙션, 이벤트 발행을 단일 클래스에서 담당하는 God Class 상태가 지속되고 있으며, `propagateReachability`와 블로킹 인터랙션 간의 시간적 결합이 이 문제를 심화시킵니다. 단기적으로는 `executeGraphLoop` 공통 추출이 가장 효과적인 부채 해소 방안입니다.

### 위험도
**MEDIUM**