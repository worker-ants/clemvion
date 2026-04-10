### 발견사항

---

**[WARNING] `useMemo` 내부에서 `useEditorStore.getState()` 직접 호출 — Hook 규칙 위반**
- 위치: `node-settings-panel.tsx`, `isDuplicateLabel` useMemo 내부
- 상세: `useMemo` 콜백 안에서 `useEditorStore.getState()`를 직접 호출하면 store 상태가 변경되어도 리렌더링이 트리거되지 않음. 컴포넌트가 마운트될 때의 스냅샷만 반영하여 실시간 중복 감지가 동작하지 않을 수 있음.
- 제안: `useEditorStore((s) => s.nodes)` hook을 컴포넌트 최상위에서 호출하고, `useMemo` 의존성에 포함시킬 것.

```tsx
const allNodes = useEditorStore((s) => s.nodes);
const isDuplicateLabel = useMemo(() => {
  return allNodes.some(
    (n) => n.id !== nodeId && (n.data as Record<string, unknown>).label === label,
  );
}, [allNodes, nodeId, label]);
```

---

**[WARNING] `generateUniqueLabel`과 `buildDisambiguatedKeys`의 넘버링 방식 불일치**
- 위치: `generate-unique-label.ts` vs `disambiguate-labels.ts`
- 상세: 프론트엔드의 `generateUniqueLabel`은 `"HTTP Request 2"` (공백+숫자) 방식, 백엔드/패키지의 `buildDisambiguatedKeys`는 `"HTTP Request#2"` (`#`+숫자) 방식. 서로 다른 네이밍 규칙을 사용하므로 사용자에게 `"HTTP Request 2"` 라벨로 두 노드가 생성될 경우, `$node["HTTP Request 2"]`가 아닌 `$node["HTTP Request 2#2"]`로 참조해야 하는 혼동 가능성.
- 제안: 두 규칙이 의도적으로 분리된 것이라면 스펙에 명시 필요. 실행 시점 disambiguation은 `#N`, 생성 시점 라벨 생성은 공백+N으로 구분하는 이유를 문서화할 것.

---

**[WARNING] `saveCanvas` 중복 라벨 검증과 `NodesService.create` 중복 라벨 검증이 이중 레이어로 존재하지만 `importWorkflow`는 검증 없음**
- 위치: `workflows.service.ts`, `importWorkflow` 메서드
- 상세: `saveCanvas`는 `validateUniqueLabels`를 호출하고, `NodesService.create`도 `assertLabelUnique`를 호출. 그러나 `importWorkflow`는 노드를 직접 `manager.save(Node, node)`로 삽입하면서 라벨 중복 검증을 전혀 수행하지 않음. 외부에서 가져온 워크플로우에 동일 라벨 노드가 있어도 그대로 저장됨.
- 제안: `importWorkflow`에도 라벨 유니크 검증 로직 추가, 또는 스펙에서 import 시 중복 허용을 명시적으로 정의할 것.

---

**[WARNING] `bulkCreate`의 기존 노드 라벨 충돌 검사가 TOCTOU(Time-of-Check-Time-of-Use) 레이스 조건에 노출됨**
- 위치: `nodes.service.ts`, `bulkCreate` 메서드
- 상세: `findByWorkflow`로 기존 노드를 조회한 뒤 `nodeRepository.save`를 호출하는 사이에 다른 요청이 동일 라벨로 노드를 삽입할 수 있음. 트랜잭션 없이 두 단계 수행.
- 제안: `bulkCreate`도 트랜잭션 안에서 실행하거나, DB 레벨 유니크 인덱스(`workflowId + label`)를 추가하여 최종 보호막을 마련할 것.

---

**[INFO] `variable-picker.tsx`의 라벨 표시 로직이 불필요하게 중복됨**
- 위치: `variable-picker.tsx`, line ~213
- 상세: `{node.resolvedKey !== node.label ? node.resolvedKey : node.label}`는 항상 `node.resolvedKey`와 동일함. 삼항 연산자가 의미없음.
- 제안: `{node.resolvedKey}`로 단순화.

---

**[INFO] `use-expression-context.ts`의 `buildDisambiguatedKeys` 호출이 `selectedNodeId`가 없는 노드까지 포함**
- 위치: `use-expression-context.ts`, `filteredNodes` 생성 시
- 상세: `availableNodes`는 `selectedNodeId`를 제외한 노드로 구성되므로 disambiguation 결과 키가 전체 워크플로우 기준이 아닌 현재 노드 제외 기준으로 계산됨. 실행 시점의 `buildExpressionContext`는 전체 `nodeMap` 기준으로 계산하므로, 프론트엔드 자동완성과 백엔드 실제 키 사이에 번호 불일치가 발생할 수 있음.
- 예시: 노드 A, B, C가 모두 "HTTP Request"일 때, C를 편집 중이면 프론트엔드는 A="HTTP Request", B="HTTP Request#2"로 제안하지만, 백엔드 실행 시 A="HTTP Request", B="HTTP Request#2", C="HTTP Request#3"으로 실행됨. 자동완성 키가 실제 실행 키와 다름.
- 제안: `buildDisambiguatedKeys`를 전체 노드 기준으로 호출한 뒤, 선택된 노드의 엔트리만 필터링하여 표시할 것.

---

### 요약

이번 변경사항은 노드 라벨 유니크 정책과 실행 시점 중복 라벨 disambiguation, UUID 폴백 참조라는 요구사항을 전반적으로 잘 구현하고 있다. 핵심 로직(`buildDisambiguatedKeys`, `generateUniqueLabel`, `assertLabelUnique`, `validateUniqueLabels`)은 명확하고 테스트도 충분히 작성되었다. 다만 `node-settings-panel.tsx`의 Hook 규칙 위반은 중복 감지 UI가 실제로 동작하지 않을 수 있는 기능 결함이며, `importWorkflow` 경로에서의 라벨 유니크 검증 누락은 정책 일관성 구멍이다. 프론트엔드 자동완성의 disambiguation 범위가 백엔드 실행 시점과 다를 수 있다는 점도 사용자 경험에 영향을 미칠 수 있어 주의가 필요하다.

### 위험도

**MEDIUM**