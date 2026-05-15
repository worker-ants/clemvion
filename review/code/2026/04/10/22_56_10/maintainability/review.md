### 발견사항

---

**[WARNING] reachable 초기화 로직 중복**
- 위치: `execution-engine.service.ts` — `executeInline` (~334행)과 `runExecution` (~726행)
- 상세: 아래 패턴이 두 메서드에 동일하게 존재합니다.
  ```typescript
  const reachable = new Set<string>();
  for (const id of sortedNodeIds) {
    const hasIncoming = forwardEdges.some((e) => e.targetNodeId === id);
    if (!hasIncoming) reachable.add(id);
  }
  ```
- 제안: private 헬퍼 메서드로 추출 (`buildInitialReachableSet(sortedNodeIds, forwardEdges): Set<string>`)

---

**[WARNING] back-edge 리셋 로직 중복**
- 위치: `execution-engine.service.ts` — `executeInline` (~493행)과 `runExecution` (~843행)
- 상세: 동일한 범위 clear + re-add 패턴이 두 곳에 중복됩니다.
  ```typescript
  for (let i = activated.targetIndex; i <= pointer; i++) {
    reachable.delete(sortedNodeIds[i]);
  }
  reachable.add(sortedNodeIds[activated.targetIndex]);
  ```
- 제안: `resetReachabilityRange(reachable, sortedNodeIds, targetIndex, pointer)` 헬퍼 추출

---

**[WARNING] `propagateReachability`에서 O(n) 선형 탐색**
- 위치: `execution-engine.service.ts` — `propagateReachability` 메서드 (~2083행)
- 상세: `edges.filter((e) => e.sourceNodeId === nodeId)` 가 노드 실행마다 호출됩니다. 노드 수 N에 대해 O(N²) 복잡도. 큰 워크플로우에서 성능 문제로 이어질 수 있습니다.
- 제안: 그래프 빌드 단계에서 `Map<string, GraphEdge[]>` (sourceNodeId → edges) 형태의 adjacency map을 미리 구성하여 전달

---

**[WARNING] 테스트 노드 객체 보일러플레이트 대규모 중복**
- 위치: `execution-engine.service.spec.ts` — 새로 추가된 `Reachability-based execution` describe 블록 전체
- 상세: 아래 패턴이 3개 테스트에 걸쳐 15회 이상 반복됩니다.
  ```typescript
  {
    id: 'node-a',
    workflowId,
    type: 'port_router',
    category: NodeCategory.LOGIC,
    label: 'Router',
    config: {},
    isDisabled: false,
    containerId: undefined as unknown as string,
    toolOwnerId: undefined as unknown as string,
  }
  ```
  특히 `containerId: undefined as unknown as string` 타입 캐스팅 패턴이 기존 테스트를 포함해 파일 전체에서 반복됩니다.
- 제안: `makeNode(id, type, label, overrides?)` 테스트 팩토리 함수를 파일 상단에 정의하여 재사용

---

**[WARNING] `memory/execution-engine-analysis.md` 내용이 구현과 불일치**
- 위치: `memory/execution-engine-analysis.md`
- 상세: 파일이 현재 구현이 `portRoutingSkipped` 방식을 사용한다고 기술하고 있으나, 이번 변경으로 `reachable` 기반 방식으로 교체되었습니다. 문서가 해결된 문제를 현재 문제로 오해하게 만듭니다.
- 제안: 파일을 갱신하여 새로운 reachability 기반 아키텍처와 그 동작 방식을 기술

---

**[INFO] 핵심 fan-in 엣지 케이스 테스트 누락**
- 위치: `execution-engine.service.spec.ts` — `Reachability-based execution` describe 블록
- 상세: 한 노드에 복수의 incoming edge가 있는 경우 (fan-in) — 예: 활성 브랜치와 비활성 브랜치 양쪽에서 받는 노드 — 의 reachability 동작을 검증하는 테스트가 없습니다.
- 제안: `port1 → X, port2 → X` 구조에서 port1 선택 시 X가 reachable로 표시되는지 확인하는 케이스 추가

---

**[INFO] `NodeHandler` 객체 생성 패턴 불일치**
- 위치: `execution-engine.service.spec.ts` — 새로 추가된 테스트들
- 상세: 기존 테스트에서는 `mockHandler`를 `beforeEach` 바깥에 정의하여 재사용하는 반면, 새 테스트들은 각 `it` 블록 내에서 핸들러를 inline으로 정의합니다. 두 패턴이 혼재하여 일관성이 부족합니다.
- 제안: 핸들러를 describe 블록 scope에서 정의하는 방향으로 통일 (재사용 핸들러는 describe 상단, 테스트 전용은 it 내부)

---

**[INFO] `result.errors!` non-null assertion 제거 (긍정적 변경)**
- 위치: `text-classifier.handler.spec.ts:65`
- 상세: `result.errors!.length` → `result.errors.length`로 수정된 부분은 올바른 개선입니다. `ValidationResult.errors` 타입이 항상 존재해야 함을 명시적으로 드러냅니다. 변경 자체는 타입 정합성 향상에 기여합니다.

---

### 요약

이번 변경의 핵심인 `portRoutingSkipped` → `reachable` 리팩토링은 개념적으로 올바른 방향으로, "무엇을 건너뛸지" 추적하던 방식에서 "무엇을 실행할지"를 추적하는 보다 명확한 모델로 전환되었습니다. 그러나 `executeInline`과 `runExecution` 사이에서 reachability 초기화, back-edge 리셋 패턴이 그대로 복제되어 있어, 향후 로직 변경 시 두 곳을 함께 수정해야 하는 유지보수 부담이 생겼습니다. 테스트 코드에서는 노드 객체 생성 보일러플레이트가 과도하게 중복되어 가독성을 해치고 있으며, `memory` 파일이 구현 내용과 불일치하는 상태로 방치되어 있습니다. `propagateReachability`의 선형 탐색도 워크플로우 규모가 커질 경우 잠재적 성능 이슈가 됩니다.

### 위험도
**MEDIUM**