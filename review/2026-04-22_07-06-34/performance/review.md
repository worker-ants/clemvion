### 발견사항

- **[INFO]** 조건부 spread 패턴의 단기 객체 생성
  - 위치: `workflow-view.ts:49-52`, `workflow-assistant-stream.service.ts:742-745`
  - 상세: `...(typeof n.width === 'number' ? { width: n.width } : {})` 패턴은 width/height가 없는 노드마다 빈 `{}` 객체를 2개씩 생성해 즉시 spread하고 버립니다. 최대 500노드 기준, 한 턴마다 최대 2000개의 단기 임시 객체가 생성됩니다.
  - 제안: 성능이 민감한 경로라면 아래 패턴으로 교체해 임시 객체 생성을 제거할 수 있습니다.
    ```ts
    const node: NodeShape = { id: n.id, ..., config: redactConfig(...) };
    if (typeof n.width === 'number') node.width = n.width;
    if (typeof n.height === 'number') node.height = n.height;
    return node;
    ```
    다만 현 규모(최대 500노드, V8 GC의 단기 객체 최적화)에서는 실질적인 영향이 없으므로 현재 패턴 유지도 무방합니다.

- **[INFO]** 시스템 프롬프트 토큰 소비 증가 (LLM 비용)
  - 위치: `system-prompt.ts` Layout guidance 섹션
  - 상세: 레이아웃 가이드 섹션이 2줄에서 4줄로 확장되고, 스냅샷 JSON에 측정된 노드마다 `"width": N, "height": N` 필드가 추가됩니다. 500노드 전체가 측정된 극단적 케이스에서 최대 약 1000필드(~1만 토큰 수준)가 추가될 수 있으며, 이는 매 LLM 호출마다 비용에 반영됩니다.
  - 제안: `toWorkflowView`에서 이미 측정값 없는 노드는 필드를 누락시키는 최적화가 구현되어 있어 실제 영향은 측정된 노드 수에만 비례합니다. 현 설계가 합리적입니다.

- **[INFO]** 프론트엔드 `useMemo` 재계산 의존성
  - 위치: `assistant-panel.tsx:99-128`
  - 상세: 추가된 `measured` 필드 접근(`(n as {...}).measured`)은 런타임에 단순 프로퍼티 조회로 비용이 없습니다. `useMemo`의 의존성 배열 `[nodes, edges]`는 React Flow가 상태 변경 시 새 참조를 반환하면 재계산이 발생하는데, 이는 기존 동작이며 이번 변경과 무관합니다.

---

### 요약

이번 변경은 노드의 `width`/`height` 측정값을 프론트 → DTO → 섀도우 스냅샷 → LLM 시스템 프롬프트로 흘리는 단순 필드 추가입니다. 알고리즘 복잡도 변화 없음, N+1 쿼리 없음, 블로킹 I/O 없음, 메모리 누수 없음. 유일한 성능 관련 고려사항은 조건부 spread의 임시 객체 생성(노드당 `{}`×2)과 측정된 노드 수에 비례한 LLM 프롬프트 토큰 증가이며, 두 가지 모두 현 규모(최대 500노드)에서는 무시 가능한 수준입니다. 측정값이 없는 노드의 필드를 JSON에서 아예 누락시키는 설계가 이미 프롬프트 비대화를 방지하고 있어 전반적으로 성능 친화적인 구현입니다.

### 위험도

**LOW**