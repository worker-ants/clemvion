### 발견사항

- **[WARNING]** `addEdge`의 이중 중첩 if
  - 위치: `shadow-workflow.ts`, `addEdge` 메서드 (diff +4~+8)
  - 상세: `if (!this.isContainerAncestor(...)) { if (this.wouldCreateCycle(...)) { ... } }` 구조는 하나의 조건을 표현하는데 불필요한 중첩을 만든다.
  - 제안: `if (!this.isContainerAncestor(sourceId, targetId) && this.wouldCreateCycle(sourceId, targetId))` 로 단일 조건으로 합칠 것

- **[WARNING]** `wouldCreateCycle` 내부에서 `edge.sourceNodeId` 대신 `cur` 사용 가능
  - 위치: `shadow-workflow.ts`, `wouldCreateCycle` (diff +16~+18)
  - 상세: `if (edge.sourceNodeId !== cur) continue;` 로 이미 `edge.sourceNodeId === cur`임을 보장했으므로, 바로 아래 `this.isContainerAncestor(edge.sourceNodeId, ...)` 호출에서 `edge.sourceNodeId` 대신 지역 변수 `cur`를 쓰는 것이 의도를 더 명확하게 전달한다. 현재 코드는 `cur`와 `edge.sourceNodeId`가 같다는 사실을 독자가 위로 되짚어 확인해야 한다.
  - 제안: `this.isContainerAncestor(cur, edge.targetNodeId)` 로 변경

- **[WARNING]** 테스트 노드 픽스처 보일러플레이트 과다 반복
  - 위치: `shadow-workflow.spec.ts`, 신규 4개 테스트 케이스 전체
  - 상세: `{ positionX: 0, positionY: 0, config: {}, category: 'logic' | 'integration', ... }` 형태의 노드 객체가 케이스마다 8줄씩 인라인으로 중복된다. 파일 전체를 보면 동일 패턴이 수십 번 반복된다.
  - 제안: `makeNode(id, type, opts?: { containerId?, category?, label? })` 같은 팩토리 헬퍼를 도입해 노드 생성 코드를 1줄로 압축. 기존 `twoNodeSnap()` 같은 헬퍼 패턴이 이미 파일에 존재하므로 일관성도 높아진다.

- **[INFO]** `isContainerAncestor` 파라미터명 방향 모호성
  - 위치: `shadow-workflow.ts`, 메서드 시그니처 (diff +23~+26)
  - 상세: 메서드 이름만 보면 `nodeId`가 조상인지, `candidateAncestorId`가 조상인지 즉시 파악하기 어렵다. JSDoc이 있어 보완되지만, 호출부(`isContainerAncestor(sourceId, targetId)`)에서는 JSDoc 없이 읽어야 한다.
  - 제안: `isAncestorOf(nodeId, ancestorId)` 또는 `sourceHasAncestor(sourceId, ancestorId)` 처럼 방향이 명확한 이름 고려. 혹은 파라미터를 `(descendantId, candidateAncestorId)` 로 이름 변경

- **[INFO]** 회귀 테스트가 기존 테스트와 시나리오 중복
  - 위치: `shadow-workflow.spec.ts`, `'still rejects genuine cycles among top-level nodes (regression)'`
  - 상세: 위에 이미 존재하는 `'rejects cycles through multi-hop edges'` 테스트와 구조·검증 포인트가 거의 동일하다. 회귀 목적이 명확하므로 삭제할 필요는 없지만, `it` 설명에 "container loopback 예외가 일반 사이클 판정을 우회하지 않음을 확인"처럼 이 describe 블록에서 왜 필요한지 맥락을 명시하면 의도가 더 분명해진다.

- **[INFO]** 스펙 표 셀 길이
  - 위치: `spec/3-workflow-editor/4-ai-assistant.md`, CYCLE_DETECTED 행
  - 상세: 변경된 셀이 약 140자의 단일 문장이 되어 마크다운 표에서 가독성이 저하된다. 기능 설명 자체는 정확하다.
  - 제안: `단, source 노드의 조상 containerId 체인 중 하나와 target이 일치하는 경우 허용 (iteration back-edge, spec §4.4)` 정도로 핵심만 표 셀에 두고, 상세 설명은 표 아래 별도 단락으로 분리 고려

---

### 요약

핵심 로직(`isContainerAncestor`)은 visited 보호, 체인 순회, 예외 처리 범위(직접 부모·조상 모두 허용) 모두 올바르게 구현되어 있으며 테스트 커버리지도 4가지 시나리오(직접 컨테이너, 조상 컨테이너, 비조상 거부, 일반 사이클 회귀)를 충실히 검증한다. 다만 `addEdge`의 이중 중첩 조건, `wouldCreateCycle` 내부에서 `cur` 대신 `edge.sourceNodeId` 재참조, 테스트 노드 픽스처의 반복적인 보일러플레이트가 향후 기능 확장이나 리팩토링 시 수정 비용을 높이므로, 팩토리 헬퍼 도입과 조건 단순화로 개선할 여지가 있다.

### 위험도

**LOW**