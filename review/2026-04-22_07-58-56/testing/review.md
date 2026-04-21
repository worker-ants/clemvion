## 발견사항

---

**[WARNING] `wouldCreateCycle` BFS 수정 로직이 직접 검증되지 않음**
- 위치: `shadow-workflow.ts:331-336`, `shadow-workflow.spec.ts` 전체
- 상세: `wouldCreateCycle` 내부에서 기존 loopback 에지를 BFS 탐색에서 제외하는 로직이 추가되었으나, 이 경로를 직접 검증하는 테스트가 없다. 예를 들어 `loop → child` (body) + `child → loop` (loopback, 이미 추가됨) 상태에서 `externalNode → loop`를 추가할 때 `wouldCreateCycle`이 `child → loop` 에지를 올바르게 스킵해 false를 반환하는지 검증하지 않는다.
- 제안:
  ```typescript
  it('skips existing loopback edges during cycle BFS (allows external → container)', () => {
    // loopback 에지가 이미 있는 상태에서 외부→컨테이너 에지 추가가 허용되어야 함
    const sw = new ShadowWorkflow({ nodes: [...], edges: [
      { id: 'body', sourceNodeId: 'loop', sourcePort: 'body', targetNodeId: 'child', targetPort: 'in', type: 'data' },
      { id: 'back', sourceNodeId: 'child', sourcePort: 'out', targetNodeId: 'loop', targetPort: 'emit', type: 'data' },
    ]}, new Set(['loop', 'http_request']));
    const result = sw.apply({ name: 'add_edge', arguments: { source_id: 'externalNode', target_id: 'loop' } });
    expect(result.ok).toBe(true); // BFS가 loopback 에지를 스킵하지 않으면 CYCLE_DETECTED 오진
  });
  ```

---

**[WARNING] 손상된 `containerId` 순환 체인에 대한 테스트 누락**
- 위치: `shadow-workflow.ts:344-355` (`isContainerAncestor`)
- 상세: `isContainerAncestor`는 `containerId` 체인이 순환될 경우(예: A.containerId = B, B.containerId = A) `visited` Set으로 무한루프를 방지한다. 방어 코드가 있지만 실제로 작동하는지 검증하는 테스트가 없다. 데이터 손상 시나리오에서 false를 반환하는지 확인해야 한다.
- 제안:
  ```typescript
  it('isContainerAncestor handles circular containerId chain without infinite loop', () => {
    // nodeA.containerId = nodeB, nodeB.containerId = nodeA (손상 데이터)
    const sw = new ShadowWorkflow({ nodes: [
      TRIGGER_NODE,
      { id: 'nodeA', ..., containerId: 'nodeB' },
      { id: 'nodeB', ..., containerId: 'nodeA' },
    ], edges: [] }, new Set(['http_request']));
    // 예외 없이 종료되고 false를 반환해야 함
    const result = sw.apply({ name: 'add_edge', arguments: { source_id: 'nodeA', target_id: 'nodeB' } });
    expect(result.ok).toBe(false); // 순환 containerId이므로 ancestor 아님 → cycle 검사 진행
  });
  ```

---

**[WARNING] "allows" 케이스에서 스냅샷 상태 미검증**
- 위치: `shadow-workflow.spec.ts:330-377`, `shadow-workflow.spec.ts:379-435`
- 상세: 첫 번째, 두 번째 loopback 허용 테스트가 `result.ok === true`만 검증하고 실제로 에지가 스냅샷에 추가되었는지(`sw.snapshot().edges`) 확인하지 않는다. 기존 `add_edge` 테스트들(line ~262)은 `sw.snapshot().edges`까지 검증한다.
- 제안:
  ```typescript
  expect(result.ok).toBe(true);
  expect(sw.snapshot().edges).toHaveLength(2); // body 에지 + 새 loopback 에지
  const loopback = sw.snapshot().edges.find(e => e.sourceNodeId === 'child');
  expect(loopback?.targetNodeId).toBe('loop');
  expect(loopback?.targetPort).toBe('emit');
  ```

---

**[WARNING] 삭제된 노드를 `containerId`로 참조하는 케이스 미검증**
- 위치: `shadow-workflow.ts:344-355`
- 상세: `remove_node` 후 해당 노드를 `containerId`로 참조하던 자식 노드가 남아있을 때 `isContainerAncestor`가 안전하게 처리되는지 테스트 없음. 실제로는 `this.nodes.get(current)?.containerId ?? null`이 null을 반환해 루프를 종료하므로 안전하지만, 이 경로는 검증되지 않는다.

---

**[INFO] 스펙 문서와 구현 간 표현 불일치**
- 위치: `spec/3-workflow-editor/4-ai-assistant.md` (§4.4), `shadow-workflow.ts:252-258`
- 상세: 스펙은 "자기·조상 컨테이너로 되돌아가는 back-edge"라고 기술하지만, self-loop는 이미 `sourceId === targetId` 체크로 별도 처리된다. `isContainerAncestor`는 조상만 확인하므로 "자기" 케이스는 실제로 이 경로에 도달하지 않는다. 스펙이 구현보다 넓게 기술되어 있어 혼란을 줄 수 있다.

---

**[INFO] 형제 컨테이너(sibling container) 에지 테스트 없음**
- 위치: `shadow-workflow.spec.ts`
- 상세: `childA → loopB` (비조상, 사이클 없음)처럼 순환을 유발하지 않는 비조상 컨테이너로의 에지가 사이클 검사를 정상 통과하는 케이스 없음. 현재 세 번째 테스트는 사이클을 유발하는 비조상 케이스만 다루며, 사이클 없는 비조상 케이스는 기존 일반 `add_edge` 테스트로 간접 커버될 뿐이다.

---

## 요약

핵심 신규 로직인 `isContainerAncestor`와 `wouldCreateCycle` 수정에 대한 4개의 테스트 케이스는 기본 시나리오(직접 부모, 조상, 비조상 사이클, 일반 사이클 회귀)를 적절히 다루며 테스트 격리·가독성·의도 표현은 우수하다. 단, `wouldCreateCycle` 내부의 BFS 수정 경로(기존 loopback 에지 스킵)가 직접 검증되지 않아 해당 변경의 회귀 방어력이 부족하고, 손상된 containerId 체인 방어 코드도 검증이 없다. "allows" 케이스에서 스냅샷 상태를 확인하지 않는 점도 다른 테스트들의 패턴과 일관되지 않는다.

## 위험도

**MEDIUM** — 핵심 사이클 검출 로직의 BFS 수정 경로가 테스트로 커버되지 않아 해당 분기에서 오류 발생 시 회귀 방어가 없다.