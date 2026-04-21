---

### 발견사항

**[WARNING] 테스트 "allows nested children to loop back to an ancestor container"가 false-positive 방지 경로를 검증하지 않음**
- 위치: `shadow-workflow.spec.ts`, 추가된 두 번째 `it` 블록 (lines ~392–444)
- 상세: 해당 테스트는 `edges: []` (pre-existing 에지 없음)로 초기화된다. 이 상태에서는 `wouldCreateCycle`이 어차피 false를 반환하므로, `isContainerAncestor` 예외가 없어도 결과가 동일하다. 즉, 이 테스트는 "containerId 체인을 올라가며 조상을 찾는다"는 로직만 검증할 뿐, **기존 body 에지(outer→inner, inner→grandchild)가 존재할 때 cycle 오판을 방지**하는 핵심 경로를 전혀 검증하지 않는다.
- 제안: 아래와 같이 pre-existing 에지를 추가해야 실질적인 false-positive 방지를 검증할 수 있다.
  ```typescript
  edges: [
    { id: 'e1', sourceNodeId: 'outer', sourcePort: 'body', targetNodeId: 'inner', targetPort: 'in', type: 'data' },
    { id: 'e2', sourceNodeId: 'inner', sourcePort: 'body', targetNodeId: 'grandchild', targetPort: 'in', type: 'data' },
  ],
  ```
  이 에지들이 없으면 `wouldCreateCycle`이 outer에서 inner→grandchild 경로를 발견하지 못해, 예외 로직이 실제로 트리거되지 않는다.

---

**[WARNING] 포트 수준 검증 없이 조상 컨테이너 모든 포트가 허용됨**
- 위치: `shadow-workflow.ts:257`, `isContainerAncestor` 메서드
- 상세: 구현은 source 노드의 조상 컨테이너이기만 하면 **어떤 포트로도** 연결을 허용한다. 코드 주석과 spec 설명이 일관되게 `emit` 포트로의 재진입이 iteration back-edge라고 서술하고 있으나, `target_port`가 `in`이나 `body` 같은 비-iteration 포트일 때도 cycle 검사가 면제된다. spec 개정문 자체는 "target 이 일치"를 노드 수준으로만 기술했으므로 spec 위반은 아니지만, 실행 엔진의 실제 처리 방식(containerId 기반 그래프 분리)과 의미 정합성 면에서 `emit` 포트 외 연결이 실행 엔진에서 어떻게 해석되는지 불명확하다.
- 제안: 당장 버그는 아니지만, 실행 엔진의 back-edge 해석 범위와 맞추어 포트 제한 여부를 명시적으로 spec에 기술하거나, 구현에서 `targetPort === 'emit'`인지 추가 체크하는 것을 검토.

---

**[INFO] 중간 컨테이너 노드가 조상 컨테이너로 loopback하는 케이스 미테스트**
- 위치: `shadow-workflow.spec.ts`, `container loopback` describe 블록
- 상세: `inner(containerId=outer) → outer`의 에지 추가 시나리오가 테스트되지 않았다. `isContainerAncestor('inner', 'outer')` = true이므로 로직상 허용되어야 하지만, 테스트가 존재하지 않아 리그레션 보호가 없다.
- 제안: 직접 자식이 아닌 컨테이너 노드가 자신의 부모 컨테이너로 loopback하는 케이스를 추가.

---

**[INFO] `isContainerAncestor` 내 visited 보호의 시작점 누락 가능성**
- 위치: `shadow-workflow.ts:343–357`, `isContainerAncestor`
- 상세: `visited`에 `nodeId` 자체는 추가하지 않고, containerId 체인의 각 노드만 추가한다. containerId 체인이 `nodeId → A → A` (A.containerId = A) 형태로 자기 자신을 가리키는 경우, `visited.has('A')` 체크가 두 번째 방문에서 잡히므로 무한루프는 없다. 동작은 정확하나, `nodeId` 자체가 visited에 없는 점이 의도인지 명확하지 않다.
- 제안: 방어적 코딩 측면에서 루프 시작 전 `visited.add(nodeId)`를 추가하면 더 명확해진다.

---

### 요약

이번 변경은 `isContainerAncestor`를 통해 자식→조상 컨테이너 iteration back-edge를 cycle 판정에서 면제하는 기능을 구현했으며, 로직 자체는 spec §4.4의 의도와 일치하고 unrelated container 및 top-level cycle에 대한 거부도 정확히 유지된다. 다만 중첩 조상 loopback 테스트에 pre-existing body 에지가 없어 핵심 false-positive 방지 경로가 실제로 실행되지 않으므로, 테스트 coverage에 사각지대가 존재한다. 이 간극은 향후 `wouldCreateCycle` 내 edge 필터링 로직이 변경될 때 리그레션을 놓칠 위험으로 남는다.

### 위험도

**LOW**