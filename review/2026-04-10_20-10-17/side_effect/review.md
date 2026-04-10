### 발견사항

---

**[WARNING] `useMemo` 내부에서 `useEditorStore.getState()` 직접 호출 — React 반응성 누락**
- 위치: `node-settings-panel.tsx`, `isDuplicateLabel` useMemo 블록
- 상세: `useMemo` 의존성 배열에 `nodes`가 없고, 내부에서 `useEditorStore.getState().nodes`를 직접 읽습니다. Store의 `nodes`가 변경되어도 `isDuplicateLabel`이 재계산되지 않아, 다른 노드의 라벨이 변경된 직후에도 stale한 검증 결과를 보여줄 수 있습니다.
- 제안: `useEditorStore((s) => s.nodes)`로 구독하여 외부 변수로 빼고 `useMemo` 의존성에 포함하거나, `useMemo` 대신 인라인 파생값으로 계산

```tsx
// 현재 (문제)
const isDuplicateLabel = useMemo(() => {
  const nodes = useEditorStore.getState().nodes; // 반응성 없음
  ...
}, [nodeId, label]);

// 권장
const allNodes = useEditorStore((s) => s.nodes); // 컴포넌트 레벨
const isDuplicateLabel = useMemo(() => {
  return allNodes.some(...);
}, [nodeId, label, allNodes]);
```

---

**[WARNING] `nodesWithOutput` 순서 vs `nodeMap` 순서 불일치 가능성**
- 위치: `expression-resolver.service.ts`, `buildExpressionContext` 메서드
- 상세: `nodesWithOutput`은 `nodeMap` 순회 순서로 구성되고, `buildDisambiguatedKeys`는 이 순서를 기준으로 `#N` 접미사를 부여합니다. 그런데 두 번째 루프(`for (const [nodeId] of nodeMap)`)에서 다시 `nodeMap`을 순회하므로 순서는 일관됩니다. 단, `Map`의 삽입 순서가 위상 정렬 순서와 동일하다는 가정이 암묵적으로 내포되어 있습니다. 이 가정이 깨지면 같은 워크플로우에서 실행 시마다 `#N` 할당이 달라질 수 있습니다.
- 제안: 주석으로 "nodeMap은 위상 정렬 순서로 구성되어야 한다"는 계약을 명시

---

**[WARNING] `$node[nodeId]` UUID 폴백이 라벨과 충돌 시 덮어씀**
- 위치: `expression-resolver.service.ts`, `buildExpressionContext`
- 상세: 노드 UUID가 우연히 다른 노드의 라벨(또는 `label#N` 형태)과 일치하면 먼저 등록된 키를 덮어씁니다. 실제 UUID 형식(`xxxxxxxx-xxxx-...`)과 일반 라벨이 겹칠 가능성은 낮지만, 정책상 UUID 폴백이 라벨 키를 조용히 오버라이드할 수 있습니다.
- 제안: UUID 폴백 등록 시 키 충돌 여부를 체크하거나, 두 루프의 등록 순서를 "라벨 먼저, UUID는 없을 때만"으로 변경

---

**[INFO] `generateUniqueLabel`의 명명 체계(`Space N`)와 `buildDisambiguatedKeys`의 명명 체계(`#N`)가 상이**
- 위치: `generate-unique-label.ts` vs `disambiguate-labels.ts`
- 상세: 프론트엔드 생성 시 "HTTP Request 2", 백엔드 실행 컨텍스트에서 중복 시 "HTTP Request#2"가 됩니다. 실제로 중복 라벨은 생성 단계에서 차단되므로 런타임에 `#N`이 발동될 가능성은 낮지만, 두 규칙이 공존하면 사용자에게 혼란을 줄 수 있습니다.
- 제안: 스펙 문서에 두 체계의 의도(생성 시 vs 안전장치)를 명시적으로 기술

---

**[INFO] `bulkCreate`의 중복 검사에 TOCTOU(Time-of-check Time-of-use) 경합 가능**
- 위치: `nodes.service.ts`, `bulkCreate`
- 상세: `findByWorkflow`로 기존 라벨을 읽은 뒤 `save`하는 사이에 다른 요청이 동일 라벨로 노드를 생성할 수 있습니다. DB 레벨 유니크 제약이 없다면 레이스 컨디션 시 중복이 삽입됩니다.
- 제안: DB 컬럼에 `(workflowId, label)` 유니크 제약 추가 검토

---

**[INFO] `ExpressionNodeInfo` 인터페이스에 `resolvedKey` 필드 추가 — 기존 소비자 영향**
- 위치: `use-expression-context.ts`
- 상세: 인터페이스에 새 필수 필드(`resolvedKey`)가 추가되었습니다. 테스트 파일에서도 해당 필드를 추가했으나, 코드베이스 내 다른 곳에서 `ExpressionNodeInfo`를 수동으로 생성하는 곳이 있다면 TypeScript 컴파일 오류가 발생합니다.
- 제안: 프로젝트 전체에서 `ExpressionNodeInfo` 리터럴 생성 위치를 grep으로 확인

---

**[INFO] `variable-picker.tsx`의 표시 로직 중복 및 무의미한 삼항 연산**
- 위치: `variable-picker.tsx`, 210~213라인
- 상세: `{node.resolvedKey !== node.label ? node.resolvedKey : node.label}`는 항상 `node.resolvedKey`를 반환하므로 `node.label`을 표시하는 경우가 없습니다.
- 제안: 단순히 `{node.resolvedKey}`로 교체

---

### 요약

이번 변경은 노드 라벨 중복 방지 및 표현식 컨텍스트에서의 안전한 노드 참조를 위한 일관된 설계를 구현하고 있습니다. 전반적으로 의도한 부작용 범위를 벗어나는 큰 문제는 없으나, `node-settings-panel.tsx`에서 `useMemo` 내부의 `useEditorStore.getState()` 직접 호출이 React 반응성 모델을 위반하여 라벨 중복 검증이 stale 상태로 남는 실질적 버그가 존재합니다. UUID 폴백과 라벨 키가 동일한 `$node` 객체에 공존하는 구조는 충돌 시 조용한 덮어쓰기 위험이 있고, `bulkCreate`는 DB 수준 유니크 제약 없이 애플리케이션 레벨 검사에만 의존하는 TOCTOU 취약점이 있습니다. 나머지 변경은 설계 의도에 부합하며 기존 인터페이스 변경 영향도 테스트 코드에서 적절히 반영되었습니다.

### 위험도

**MEDIUM**