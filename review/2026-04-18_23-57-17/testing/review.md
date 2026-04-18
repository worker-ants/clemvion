### 발견사항

---

**[WARNING] `expression-autocomplete.tsx` — 테스트 파일 없음**
- 위치: `expression-autocomplete.tsx` 전체
- 상세: 키보드 네비게이션(`handleKeyDown`의 ArrowUp/Down/Enter/Tab), `scrollIntoView`, 20개 항목 슬라이싱(`suggestions.slice(0, 20)`) 등 인터랙션 로직에 대한 테스트가 전혀 없음
- 제안: `@testing-library/react`로 키보드 이벤트, 선택 인덱스 변경, 항목 클릭 테스트 추가

---

**[WARNING] `expression-highlight.tsx` — 테스트 파일 없음**
- 위치: `expression-highlight.tsx` 전체
- 상세: `{{ }}` 블록 파싱 로직(닫히지 않은 `{{`, 인접한 여러 블록, 특수문자 포함 텍스트)에 대한 단위 테스트가 없음
- 제안: 파싱 로직을 순수 함수로 분리하거나 컴포넌트 렌더링 스냅샷/단언 테스트 추가

---

**[WARNING] `variable-picker.tsx` — containerScope 필터링 테스트 없음**
- 위치: `variable-picker.tsx` diff 부분 (scopedBuiltIns 필터)
- 상세: `$loop`, `$item`, `$itemIndex`가 컨테이너 스코프에 따라 VariablePicker에서 숨겨지는 동작을 검증하는 테스트가 없음. `use-expression-suggestions.test.ts`에서는 suggestions hook을 커버하지만, Picker UI 레벨의 렌더링은 미검증
- 제안: VariablePicker에 `expressionData.containerScope` 조합별 렌더링 테스트 추가

---

**[WARNING] `validate-scope.ts` — 전역 `g` 플래그 정규식의 교차 블록 중복 제거 동작 미검증**
- 위치: `validate-scope.ts:52-56`, `validate-scope.test.ts`
- 상세: `seen` Set이 모든 `{{ }}` 블록 간에 공유되므로 서로 다른 블록에서 동일한 `(kind, token)` 에러가 발생해도 한 번만 보고됨. 예: `'{{ $node["Ghost"].a }} and {{ $node["Ghost"].b }}'`는 에러 1개만 반환. 이 동작이 의도적인지 문서화·테스트되지 않음
- 제안: 동일 토큰이 복수 블록에서 나타날 때의 기대 동작을 명세하는 테스트 케이스 추가

---

**[WARNING] `expression-input.test.tsx` — syntax + scope 에러 동시 발생 시나리오 없음**
- 위치: `expression-input.test.tsx`
- 상세: 구문 에러(빨강)와 스코프 에러(황색)가 동시에 존재할 때 구문 에러만 표시되는 우선순위 동작을 검증하는 테스트 없음. 또한 스코프 내 유효한 `$loop` 참조(hasLoop=true)가 경고를 생성하지 않음을 검증하는 테스트도 없음
- 제안:
  ```ts
  // 구문 에러 우선 케이스
  value='{{ $input. }} {{ $loop.index }}'
  // → red만, amber 없음
  ```

---

**[WARNING] `reachable-nodes.test.ts` — 사이클 안전 테스트가 불완전**
- 위치: `reachable-nodes.test.ts:71-76`
- 상세: A→B→A 사이클에서 A의 조상을 구할 때 `fromA.has("B")` 만 단언. `fromA.has("A")`가 false인지(대상 자신이 결과에 포함되지 않아야 함) 검증하지 않음
- 제안:
  ```ts
  expect(fromA.has("A")).toBe(false);
  ```

---

**[WARNING] `use-expression-context.test.ts` — 선택 노드 자체가 컨테이너 타입일 때 containerScope 미검증**
- 위치: `use-expression-context.test.ts` containerScope describe 블록
- 상세: `selectedNodeId`가 `loop` 또는 `foreach` 타입 노드 자신일 때의 `containerScope` 결과(자기 자신의 type이 아니라 자신의 `containerId` 체인으로 결정됨)를 검증하는 테스트 없음
- 제안:
  ```ts
  it("loop node at top level has both flags off", () => {
    editorState = { nodes: [makeNode("lp", "loop", "Loop")], edges: [] };
    const { result } = renderHook(() => useExpressionContext("lp"));
    expect(result.current.containerScope).toEqual({ hasLoop: false, hasItem: false });
  });
  ```

---

**[INFO] `validate-scope.test.ts` — null/undefined 값 입력 케이스 없음**
- 위치: `validate-scope.test.ts`
- 상세: `validateExpressionScope(null, ctx())`, `validateExpressionScope(undefined, ctx())` 호출 시 early return `[]`을 반환하는 동작이 구현되어 있으나 테스트 없음

---

**[INFO] `use-expression-suggestions.test.ts` — hasLoop + hasItem 동시 true 케이스 없음**
- 위치: `use-expression-suggestions.test.ts` container scope gating 섹션
- 상세: 두 플래그 모두 true일 때 `$loop`, `$item`, `$itemIndex` 전부 표시됨을 검증하는 테스트 없음

---

**[INFO] `validate-scope.test.ts` — 동일 블록 내 다중 에러 종류 조합 미검증**
- 위치: `validate-scope.test.ts`
- 상세: 한 블록에서 `unknown-node` + `unknown-variable`이 동시에 발생하는 케이스(`{{ $node["Ghost"].x + $var.missing }}`)가 테스트되지 않음

---

### 요약

`reachable-nodes.ts`와 `validate-scope.ts`의 신규 단위 테스트는 핵심 알고리즘(BFS 스코프, 컨테이너 체인, 스코프 검증)을 잘 커버하고 있으며 경계값·사이클·중복 제거 케이스도 충분히 다루고 있다. 그러나 `expression-autocomplete.tsx`와 `expression-highlight.tsx`는 테스트 파일 자체가 없고, `variable-picker.tsx`의 컨테이너 스코프 필터링은 UI 레벨에서 미검증 상태이며, expression-input 통합 테스트에서 syntax+scope 동시 에러 우선순위 및 긍정 케이스(스코프 내 `$loop` → 경고 없음)가 빠져 있다.

### 위험도

**MEDIUM**