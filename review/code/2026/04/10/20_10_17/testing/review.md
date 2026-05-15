### 발견사항

---

**[WARNING]** `node-settings-panel.tsx`의 `isDuplicateLabel` useMemo 내부에서 훅 규칙 위반
- 위치: `node-settings-panel.tsx:132` — `useMemo` 콜백 내에서 `useEditorStore.getState()` 직접 호출
- 상세: `useMemo` 내부에서 `useEditorStore.getState()`를 사용하면 store의 상태 변화를 구독하지 않아 label 변경이 실시간으로 반영되지 않을 수 있음. 또한 이 컴포넌트에 대한 테스트가 전혀 없어 이 버그가 테스트에서 잡히지 않음.
- 제안: `useEditorStore((s) => s.nodes)`로 노드 목록을 구독하거나, 해당 컴포넌트에 대한 단위 테스트 추가 필요

---

**[WARNING]** `nodes.service.spec.ts`의 `update` 테스트에서 label 미변경 케이스의 mock 설정 불일치
- 위치: `nodes.service.spec.ts:69` — `'should allow update when label unchanged'`
- 상세: `update` 메서드는 `findById`를 호출한 후 `dto.label !== node.label`일 때만 `assertLabelUnique`를 호출함. 이 테스트에서 `label: 'HTTP Request'` (기존과 동일)를 전달하므로 `findOne`이 한 번만 호출되어야 함. 하지만 mock이 단순히 `mockResolvedValue(existing)`으로 설정되어 있어 잘못된 두 번째 호출이 있어도 감지 못함.
- 제안: `expect(mockRepo.findOne).toHaveBeenCalledTimes(1)` 검증 추가

---

**[WARNING]** `workflow-canvas.tsx`의 duplicate 노드 copy 시 label 생성 로직에 대한 통합 테스트 누락
- 위치: `workflow-canvas.tsx:183~192` — duplicate 케이스의 `generateUniqueLabel` 호출
- 상세: `generateUniqueLabel`은 단위 테스트가 있지만, 캔버스에서 노드를 복제할 때 `currentLabel`이 `node.data.label ?? definition.label`로 결정되는 로직에 대한 컴포넌트 수준 테스트가 없음. 특히 `data.label`이 없을 경우 fallback 동작이 검증되지 않음.
- 제안: `workflow-canvas` 컴포넌트 테스트에서 duplicate 이벤트 발생 시 label 생성 동작 검증 추가

---

**[WARNING]** `use-expression-context.test.ts`에서 duplicate label 시나리오 테스트 누락
- 위치: `use-expression-context.test.ts` — `availableNodes` 관련 테스트
- 상세: `buildDisambiguatedKeys`를 사용한 핵심 기능임에도 불구하고, 두 노드가 동일한 label을 가질 때 `resolvedKey`가 `#N` suffix로 올바르게 설정되는지 검증하는 테스트가 없음. 현재 테스트는 unique label 케이스만 커버.
- 제안:
```typescript
it("assigns disambiguated resolvedKey for duplicate labels", () => {
  editorState = {
    nodes: [
      makeNode("n1", "http_request", "HTTP"),
      makeNode("n2", "http_request", "HTTP"),
      makeNode("n3", "slack", "Slack"),
    ],
    edges: [],
  };
  const { result } = renderHook(() => useExpressionContext("n3"));
  const keys = result.current.availableNodes.map((n) => n.resolvedKey);
  expect(keys).toContain("HTTP");
  expect(keys).toContain("HTTP#2");
});
```

---

**[INFO]** `disambiguate-labels.spec.ts`에서 UUID 충돌 케이스 미검증
- 위치: `disambiguate-labels.spec.ts` 전체
- 상세: label과 다른 노드의 UUID가 동일한 문자열일 경우 `$node` 맵에서 UUID fallback이 label key를 덮어쓰는지(또는 그 반대) 검증하는 테스트 없음. `expression-resolver.service.ts:41~44`에서 `$node[resolvedKey]`와 `$node[nodeId]` 양쪽에 등록하는데, `resolvedKey === nodeId`인 경우를 포함.
- 제안: `buildDisambiguatedKeys`에서 id가 다른 노드의 label과 동일한 문자열인 엣지 케이스 테스트 추가

---

**[INFO]** `expression-resolver.service.spec.ts`의 UUID fallback 테스트에서 `resolvedKey` 충돌 케이스 미검증
- 위치: `expression-resolver.service.spec.ts:386` — `'provides UUID fallback for all nodes'`
- 상세: 단일 노드에서 UUID fallback 동작만 검증. 복수 노드에서 disambiguated key와 UUID 양쪽이 모두 올바른 output을 가리키는지 검증하는 테스트 없음.
- 제안: n1, n2가 동일 label을 가질 때 `$node["n1"]`, `$node["n2"]` 각각 올바른 output을 반환하는지 추가 검증

---

**[INFO]** `nodes.service.spec.ts`에서 `remove` 관련 테스트 없음
- 위치: `nodes.service.spec.ts` 전체
- 상세: `NodesService.remove`에 대한 테스트가 없음. 기존부터 누락된 케이스이나, 새 파일 추가 시점에서 보완 기회가 있었음.
- 제안: `remove` 호출 시 `findById` → `repository.remove` 흐름 검증 추가

---

**[INFO]** `variable-picker.tsx`의 `resolvedKey !== label` 분기 로직에 대한 테스트 누락
- 위치: `variable-picker.tsx:213` — `{node.resolvedKey !== node.label ? node.resolvedKey : node.label}`
- 상세: 사실상 항상 `resolvedKey`를 표시하는 것과 동일하나, 이 렌더링 분기에 대한 컴포넌트 테스트가 없어 label과 resolvedKey가 다를 때 UI에 올바른 값이 표시되는지 미검증.

---

### 요약

전체적으로 핵심 기능인 `buildDisambiguatedKeys`와 `generateUniqueLabel`에 대한 단위 테스트는 잘 작성되어 있으며 경계값 및 순서 보존 케이스도 커버하고 있다. `NodesService`와 `ExpressionResolverService`의 새로운 동작에 대한 테스트도 적절히 추가되었다. 그러나 `node-settings-panel.tsx`의 `isDuplicateLabel` 로직은 `useMemo` 내에서 스토어를 직접 조회하는 반응성 버그가 있으며 이를 잡는 테스트가 없다는 점이 주요 위험 요소다. 또한 `use-expression-context`에서 duplicate label이 실제로 `resolvedKey`에 `#N` suffix로 반영되는지 검증하는 통합 테스트가 빠져 있어 프론트엔드 disambiguation 흐름의 end-to-end 신뢰도가 다소 부족하다.

### 위험도

**MEDIUM**