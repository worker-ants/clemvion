## 성능 코드 리뷰

### 발견사항

---

**[WARNING] `node-settings-panel.tsx`: `useMemo` 내에서 `useEditorStore.getState()` 직접 호출**
- 위치: `node-settings-panel.tsx:133-139`
- 상세: `useMemo` 안에서 `useEditorStore.getState()`를 호출하는 패턴은 Zustand 구독을 우회합니다. `label` 상태 변경 시 메모는 재계산되지만, 다른 노드가 외부에서 변경될 경우 `isDuplicateLabel`이 stale 값을 반환할 수 있습니다. 또한 React 훅 규칙 관점에서 `useMemo` 안에서 store 접근 방식이 일관성이 없습니다 (컴포넌트 상단에서는 `useEditorStore(s => s.nodes)`로 구독하면서, 여기서는 `getState()`를 사용).
- 제안: 컴포넌트 최상단에서 `useEditorStore(s => s.nodes)`로 nodes를 구독하고, `useMemo`의 의존성으로 사용하세요.
```ts
const nodes = useEditorStore((s) => s.nodes);
const isDuplicateLabel = useMemo(() =>
  nodes.some(n => n.id !== nodeId && (n.data as Record<string, unknown>).label === label),
  [nodes, nodeId, label]
);
```

---

**[WARNING] `nodes.service.ts` `bulkCreate`: O(n²) 배치 중복 감지 알고리즘**
- 위치: `nodes.service.ts:58-64`
- 상세: `batchDuplicates` 검출에 `batchLabels.filter((label, i) => batchLabels.indexOf(label) !== i)`를 사용합니다. `indexOf`는 매 원소마다 O(n) 스캔을 수행하므로 전체 복잡도 O(n²)입니다. 수백 개 노드를 배치 생성할 경우 선형 이상의 비용이 발생합니다.
- 제안: Set을 활용한 O(n) 알고리즘으로 대체하세요.
```ts
const seen = new Set<string>();
for (const d of dtos) {
  if (seen.has(d.label)) {
    throw new ConflictException({ code: 'DUPLICATE_NODE_LABEL', message: `Duplicate node label in batch: "${d.label}"` });
  }
  seen.add(d.label);
}
```

---

**[WARNING] `nodes.service.ts` `bulkCreate`: 불필요한 전체 노드 로딩**
- 위치: `nodes.service.ts:68-77`
- 상세: `findByWorkflow(workflowId)`로 워크플로우의 모든 노드를 로드한 뒤 라벨 충돌을 체크합니다. 노드 수가 많을수록 메모리 적재량과 네트워크 비용이 증가합니다. 배치에서 충돌 여부만 알면 되므로 전체 엔티티를 가져올 필요가 없습니다.
- 제안: 특정 라벨들의 존재 여부만 쿼리하도록 최적화하세요.
```ts
const batchLabelList = dtos.map(d => d.label);
const conflicting = await this.nodeRepository.findOne({
  where: batchLabelList.map(label => ({ workflowId, label })),
});
// 또는 IN 쿼리로 처리
```

---

**[INFO] `workflow-canvas.tsx`: 노드 추가 시마다 전체 노드 배열 순회**
- 위치: `workflow-canvas.tsx:177-181`, `281-284`, `337-340`
- 상세: 노드 복사/추가 3개 코드 경로 모두에서 `nodes.map(n => n.data.label)`로 전체 노드 배열을 순회해 레이블 목록을 생성합니다. 노드가 수백 개인 대형 워크플로우에서는 매 드래그/클릭마다 반복됩니다. 개별 호출에서는 무시할 수 있는 수준이나, 에디터 성능에 민감한 환경에서는 주목할 만합니다.
- 제안: 현재 규모에서는 허용 가능하지만, 필요시 store selector에서 레이블 Set을 파생 상태로 유지하는 방식을 고려할 수 있습니다.

---

**[INFO] `use-expression-context.ts`: `buildDisambiguatedKeys` 두 번의 배열 순회**
- 위치: `use-expression-context.ts:90-108`
- 상세: `filteredNodes.map(...)` → `buildDisambiguatedKeys(...)` → `filteredNodes.map(...)` 순으로 배열을 두 번 순회합니다. `useMemo`로 감싸져 있어 불필요한 재계산은 방지되지만, 내부 로직은 두 개의 별도 반복입니다. 노드 수가 많지 않은 현 상황에서는 실질적 문제가 없으나 구조적으로 단일 패스로 합칠 수 있습니다.
- 제안: 현재 코드는 가독성이 우선된 설계로 허용 가능합니다. 최적화 필요 시 단일 순회로 병합 고려.

---

**[INFO] `buildDisambiguatedKeys`: 두 번의 완전 순회**
- 위치: `disambiguate-labels.ts:15-30`
- 상세: 먼저 레이블 빈도 집계를 위한 순회, 이후 키 할당을 위한 순회로 총 2회 순회합니다. O(2n) = O(n)이므로 알고리즘 복잡도는 적절합니다. 단일 패스로 구현하려면 로직이 복잡해져 가독성이 희생되므로 현재 구조가 올바른 트레이드오프입니다.

---

### 요약

전반적으로 성능 관점에서 양호한 구현입니다. 핵심 자료구조(Map, Set)를 적절히 활용하고 있으며, 프론트엔드의 `useMemo` 적용도 적절합니다. 주요 개선 포인트는 두 가지입니다: (1) `bulkCreate`의 배치 중복 감지가 O(n²) 알고리즘을 사용하고 있어 Set 기반 O(n) 구현으로 교체가 필요하며, (2) `bulkCreate`에서 충돌 체크를 위해 전체 노드를 로드하는 것은 대규모 워크플로우에서 불필요한 메모리 적재 및 I/O 비용을 유발합니다. `node-settings-panel.tsx`의 `useMemo` 내 `getState()` 호출 패턴은 잠재적 stale 상태 문제를 야기할 수 있어 수정이 권장됩니다.

### 위험도

**MEDIUM**