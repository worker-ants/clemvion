### 발견사항

---

**[WARNING] `reachable` 초기화 로직 중복**
- 위치: `execution-engine.service.ts` — `executeInline` (~334행)과 `runExecution` (~726행)
- 상세: 동일한 루트 노드 탐색 패턴이 두 메서드에 복사되어 있음. 초기화 기준(`forwardEdges`가 없는 노드)이 변경될 때 양쪽을 동시에 수정해야 하며, 한 곳을 놓치면 조용한 동작 차이로 이어짐.
- 제안: `private buildInitialReachableSet(sortedNodeIds: string[], forwardEdges: GraphEdge[]): Set<string>` 헬퍼로 추출

---

**[WARNING] back-edge 리셋 로직 중복**
- 위치: `execution-engine.service.ts` — `executeInline` (~493행)과 `runExecution` (~843행)
- 상세: 아래 패턴이 두 곳에 동일하게 존재함:
  ```typescript
  for (let i = activated.targetIndex; i <= pointer; i++) {
    reachable.delete(sortedNodeIds[i]);
  }
  reachable.add(sortedNodeIds[activated.targetIndex]);
  ```
- 제안: `private resetReachabilityRange(reachable, sortedNodeIds, targetIndex, pointer)` 헬퍼로 추출

---

**[WARNING] `propagateReachability`에서 O(N×E) 선형 탐색**
- 위치: `execution-engine.service.ts` — `propagateReachability` 메서드 (~2083행)
- 상세: `edges.filter((e) => e.sourceNodeId === nodeId)`가 노드 실행마다 전체 엣지를 순회. `backEdgeMap`은 이미 `Map<string, GraphEdge[]>`로 사전 구축해 O(1) 조회를 사용하고 있어 일관성도 없음.
- 제안: 실행 시작 시 `outgoingEdgeMap`을 `Map<string, GraphEdge[]>`로 사전 구축하여 `propagateReachability`에 전달

---

**[WARNING] 테스트 노드 객체 보일러플레이트 과도 중복**
- 위치: `execution-engine.service.spec.ts` — `Reachability-based execution` describe 블록 전체
- 상세: 아래 패턴이 15회 이상 반복됨. 특히 `containerId: undefined as unknown as string` 타입 캐스팅은 파일 전체에서 반복되며 가독성을 저해함:
  ```typescript
  {
    id: 'node-a', workflowId, type: 'port_router',
    category: NodeCategory.LOGIC, label: 'Router', config: {},
    isDisabled: false,
    containerId: undefined as unknown as string,
    toolOwnerId: undefined as unknown as string,
  }
  ```
- 제안: 파일 상단에 `makeNode(id: string, type: string, label: string, overrides?: Partial<Node>): Partial<Node>` 팩토리 함수 정의하여 재사용

---

**[WARNING] `memory/execution-engine-analysis.md` 내용이 구현과 불일치**
- 위치: `memory/execution-engine-analysis.md` 전체
- 상세: "현재 방식"이 `portRoutingSkipped` 기반으로 기술되어 있고 "문제점" 섹션이 이번 변경으로 이미 해결된 버그를 현재 문제로 설명함. `### 핵심 파일/라인` 섹션의 라인 번호도 삭제된 코드 기준.
- 제안: `reachable` 기반 새 아키텍처로 전면 갱신

---

**[INFO] `executeInline` 내 오래된 용어 잔존**
- 위치: `execution-engine.service.ts` — `executeInline`의 `_selectedPort` strip 주석
- 상세: 주석이 `"port-routing-skipped"` 용어를 사용하고 있으나 해당 메커니즘은 제거됨. 코드베이스와 용어 불일치.
- 제안: 주석을 `reachable` 기반 용어로 교체

---

**[INFO] `propagateReachability` JSDoc에 disabled 노드 caller 책임 미명시**
- 위치: `execution-engine.service.ts:2083-2109`
- 상세: disabled 노드가 이 메서드를 호출해서는 안 된다는 caller 책임이 문서화되지 않아, 메서드를 독립적으로 읽는 독자가 disabled 노드의 downstream 처리 방식을 파악하기 어려움.
- 제안: JSDoc에 `* Note: disabled nodes must NOT call this method — their downstream nodes should remain unreachable (caller responsibility).` 추가

---

**[INFO] `reachable` 초기화 의도 주석 부재**
- 위치: `runExecution`, `executeInline` 양쪽의 초기화 블록
- 상세: 왜 "incoming edge가 없는 노드"를 초기 reachable로 설정하는지(루트 노드 = 워크플로우 진입점)에 대한 설명이 없음.
- 제안: 주석 추가: `// Seed reachability with root nodes (no incoming forward-edges). All other nodes are activated transitively via propagateReachability.`

---

**[INFO] fan-in 엣지 케이스 테스트 누락**
- 위치: `execution-engine.service.spec.ts` — `Reachability-based execution` describe 블록
- 상세: `port1 → X`, `port2 → X` 구조에서 port1 선택 시 X가 reachable로 마킹되는지 검증하는 테스트가 없음. 한 노드에 활성/비활성 브랜치 양쪽에서 엣지가 들어오는 fan-in 케이스가 미커버.
- 제안: fan-in 시나리오 테스트 케이스 추가

---

### 요약

이번 변경의 핵심인 `portRoutingSkipped → reachable` 전환은 유지보수성 관점에서 올바른 방향이다. "무엇을 건너뛸지"에서 "무엇을 실행할지"로의 모델 전환은 코드 의도를 명확히 하고, `propagateReachability` 메서드 추출은 인라인 skip 로직의 캡슐화를 개선했다. 그러나 `executeInline`과 `runExecution` 간 초기화·리셋 로직의 ~40줄 중복이 해소되지 않아 버그 수정 시 두 곳을 반드시 함께 수정해야 하는 유지보수 부채가 남아 있다. 테스트에서는 노드 객체 보일러플레이트가 15회 이상 반복되어 가독성을 저해하고, `makeNode` 팩토리 도입으로 즉시 개선 가능한 수준이다. `propagateReachability`의 O(N×E) 엣지 탐색은 이미 `backEdgeMap`에 적용된 패턴(`outgoingEdgeMap` 사전 구축)으로 쉽게 해결될 수 있는 일관성 문제다. `memory/execution-engine-analysis.md`가 구 방식을 현재 방식으로 기술하고 있어 향후 작업 컨텍스트 로딩 시 혼란을 야기할 위험이 있으며, 즉시 갱신이 필요하다.

### 위험도
**MEDIUM**