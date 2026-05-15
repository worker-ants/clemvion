## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING]** `useMemo` 내부에서 `useEditorStore.getState()` 직접 호출 — Hook 규칙 위반
- 위치: `node-settings-panel.tsx`, `isDuplicateLabel` useMemo 블록
- 상세: `useMemo` 콜백 안에서 `useEditorStore.getState()`를 호출하면 store 변경 시 리렌더링이 트리거되지 않아 stale 값을 반환할 수 있음. 또한 `useEditorStore`는 컴포넌트 최상단에서 selector로 구독해야 함
- 제안:
  ```tsx
  const allNodes = useEditorStore((s) => s.nodes);
  const isDuplicateLabel = useMemo(
    () => allNodes.some((n) => n.id !== nodeId && (n.data as Record<string, unknown>).label === label),
    [allNodes, nodeId, label],
  );
  ```

---

**[WARNING]** `variable-picker.tsx`의 표현식 `{node.resolvedKey !== node.label ? node.resolvedKey : node.label}` 는 항상 `node.resolvedKey`를 반환
- 위치: `variable-picker.tsx`, line ~213
- 상세: 삼항 연산자의 두 분기가 각각 `node.resolvedKey`와 `node.label`인데, 구분 없이 항상 `resolvedKey`를 보여주려는 의도라면 그냥 `{node.resolvedKey}`로 충분. 코드 독자에게 혼동을 줌
- 제안:
  ```tsx
  <span className="flex-1 truncate text-orange-400">{node.resolvedKey}</span>
  ```

---

**[WARNING]** `bulkCreate`의 라벨 중복 검사가 `findByWorkflow` 전체 로딩에 의존하여 대규모 워크플로우에서 성능 저하 가능
- 위치: `nodes.service.ts`, `bulkCreate` 메서드
- 상세: 기존 노드를 전부 메모리에 로드한 뒤 Set으로 비교하는 방식은 노드 수가 많아질 때 불필요한 데이터 전송 발생. `assertLabelUnique`는 DB 쿼리로 처리하는 반면 `bulkCreate`는 별도 전략을 사용해 일관성이 없음
- 제안: `assertLabelUnique`처럼 DB `IN` 쿼리를 활용하거나, 적어도 로직을 추출해 공유

---

**[INFO]** `generateUniqueLabel`과 `buildDisambiguatedKeys`의 중복 번호 부여 방식 불일치
- 위치: `generate-unique-label.ts` vs `disambiguate-labels.ts`
- 상세: 프론트엔드 생성 시엔 `"HTTP Request 2"` (공백+숫자), 런타임 disambiguation은 `"HTTP Request#2"` (해시+숫자) 형식을 사용. 두 함수는 같은 "중복 처리" 목적이지만 서로 다른 구분자를 써서 사용자가 혼동할 수 있음. 용도가 다르다면 (생성 vs 참조) 명확한 주석이나 네이밍으로 구분 필요
- 제안: 함수명이나 파일 위치 수준에서 "노드 생성 시 라벨" vs "표현식 참조 키" 구분을 명시

---

**[INFO]** `workflow-canvas.tsx`에서 `existingLabels` 추출 코드가 세 곳에 중복
- 위치: `workflow-canvas.tsx`, 복사(duplicate), 노드 검색 팝업 추가, 드롭 추가 각각
- 상세: `nodes.map((n) => (n.data as Record<string, unknown>).label as string)` 패턴이 세 번 반복됨. 공통 헬퍼 함수로 추출하면 타입 단언 실수도 방지 가능
- 제안:
  ```ts
  const getExistingLabels = (nodes: Node[]) =>
    nodes.map((n) => (n.data as NodeData).label);
  ```

---

**[INFO]** `nodes.service.spec.ts`에서 `NotFoundException` import 후 미사용
- 위치: `nodes.service.spec.ts`, line 1
- 상세: `import { ConflictException, NotFoundException }` 에서 `NotFoundException`을 가져오나 실제 테스트에서 사용되지 않음. 불필요한 import는 가독성을 떨어뜨림
- 제안: `NotFoundException` import 제거

---

**[INFO]** `expression-resolver.service.ts`의 `resolveString` 하단 타입 단언 불필요
- 위치: `expression-resolver.service.ts`, line ~181
- 상세: `return \`${result as string}\`` — 이미 위 분기들이 string/null/undefined/object/number/boolean을 모두 처리했으므로 도달 불가능한 코드. `never` 타입 단언이 더 적합하거나 분기를 단순화 가능
- 제안: `return String(result)` 하나로 통합하거나 exhaustive check 추가

---

### 요약

전체적으로 기능 설계는 명확하고 책임 분리가 잘 되어 있으나, `node-settings-panel.tsx`의 Hook 규칙 위반(`useMemo` 내 `getState()` 직접 호출)이 실제 버그로 이어질 수 있는 가장 주요한 유지보수성 문제다. 그 외엔 생성용 라벨 유니크 생성(`generateUniqueLabel`)과 표현식 참조용 disambiguation(`buildDisambiguatedKeys`)이 서로 다른 구분자를 사용하는 불일치, 캔버스에서 반복되는 라벨 추출 패턴, `bulkCreate`에서 다른 메서드와 다른 중복 검사 전략 등 소규모 일관성 문제들이 존재한다. 전반적인 코드 구조와 테스트 커버리지는 양호하다.

### 위험도

**MEDIUM**