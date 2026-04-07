---

## 발견사항

### **[WARNING]** `useExpressionContext` 테스트 완전 부재
- **위치**: `use-expression-context.ts` (전체)
- **상세**: `useExpressionContext` 훅은 `$input` 필드 추출, 멀티 입력 엣지 처리, `$node` 목록 빌드, `variable_declaration` 파싱, `sourceItemSample` 리졸브 등 복잡한 로직을 포함하지만 테스트가 전혀 없습니다. `useExpressionSuggestions`의 테스트가 `ExpressionData`를 직접 주입하는 방식이라 이 훅의 내부 로직은 완전히 커버되지 않습니다.
- **제안**: `useEditorStore`, `useExecutionStore`를 mock하여 아래 시나리오를 테스트하는 `use-expression-context.test.ts` 작성 필요:
  - 단일 predecessor → `$input` 필드 추출
  - 멀티 predecessor → `inputFields`가 source node ID 배열
  - `variable_declaration` 노드의 변수 수집
  - `sourceItemSample` 리졸브 (배열, 오브젝트, null 케이스)

---

### **[WARNING]** `VariablePicker` 컴포넌트 테스트 없음
- **위치**: `variable-picker.tsx` (전체)
- **상세**: UI 컴포넌트이지만 인터랙션 로직이 중요합니다 (`onInsert` 콜백, Popover 닫힘, 카테고리 토글, `NestedFieldItem` 재귀 expand/collapse, `MAX_NESTING_DEPTH` 제한). 이 동작들에 대한 테스트가 없습니다.
- **제안**: `@testing-library/react`로 최소한 다음을 검증:
  - 아이템 클릭 시 `onInsert` 호출 후 Popover 닫힘
  - `NestedFieldItem`이 expandable 필드를 토글
  - `MAX_NESTING_DEPTH(5)` 도달 시 더 이상 expand 버튼 없음
  - `sourceItemSample`이 null이면 `$sourceItem` 섹션 미렌더

---

### **[WARNING]** `getExpressionToken` 커버리지 갭
- **위치**: `use-expression-suggestions.ts:35-61`
- **상세**: `getExpressionToken`은 private 함수이지만 엣지 케이스 처리가 많습니다. 현재 테스트는 정상적인 `{{ ... }}` 패턴만 다루며 아래 케이스가 누락되어 있습니다:
  - 커서가 `}}` 이후에 있는 경우 (closed block → `null` 반환 확인)
  - `{{` 없이 커서가 일반 텍스트에 있는 경우
  - 중첩 `{{ }}` 패턴 (예: `{{ foo }} {{ bar }}` 에서 두 번째 블록 내 커서)
  - 커서가 정확히 `{{` 바로 뒤에 있는 경우 (token이 빈 문자열)
- **제안**: 위 시나리오를 `makeSuggestions`로 직접 검증하는 테스트 추가

---

### **[WARNING]** `$var.` 제안 테스트 없음
- **위치**: `use-expression-suggestions.ts:171-188`
- **상세**: `$var.` prefix 처리 브랜치가 전혀 테스트되지 않음. `variables` 배열 필터링, prefix 매칭, tokenStart 계산 모두 미커버.
- **제안**:
  ```ts
  it("suggests variables for $var.", () => {
    const expr = "{{ $var.my }}";
    const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
      variables: [{ name: "myVar", type: "string" }, { name: "count", type: "number" }],
    });
    expect(suggestions.map(s => s.label)).toEqual(["myVar"]);
  });
  ```

---

### **[WARNING]** `$node["..."]` label 선택 제안 테스트 없음
- **위치**: `use-expression-suggestions.ts:136-154`
- **상세**: `$node["` 입력 후 node label 후보 목록을 보여주는 브랜치(`nodeSelectMatch`)가 테스트되지 않음.
- **제안**: `$node["Form` 상태에서 node label 필터링 및 `insertText: 'Form_test"].output'` 형식 검증 테스트 추가

---

### **[INFO]** `functionNames` 제안 테스트 없음
- **위치**: `use-expression-suggestions.ts:220-227`
- **상세**: 함수명 자동완성(`fnSuggestions`) 및 최대 10개 슬라이스 동작이 테스트되지 않음.
- **제안**: `functionNames` 배열을 주입하여 필터링/슬라이스 동작 검증

---

### **[INFO]** `useExpressionSuggestions` 반환값이 memoize되는지 안정성 검증 없음
- **위치**: `use-expression-suggestions.ts:104` (`useMemo`)
- **상세**: 동일 입력에 대해 참조 동일성을 유지하는지 (불필요한 리렌더 방지) 테스트가 없음.
- **제안**: `rerender`를 사용해 동일 props → 동일 `suggestions` 참조인지 확인

---

### **[INFO]** `cursorAfterExpr` 헬퍼의 한계
- **위치**: 테스트 파일 `32-38`
- **상세**: `" }}"` 패턴을 기준으로 커서 위치를 계산하는데, `}}` 직전에 공백이 없는 표현식(예: `{{ $input.body.da}}`)에서는 fallback 경로를 탐 → 다른 브랜치 커버 가능성. 이 엣지 케이스도 명시적으로 테스트 권장.

---

## 요약

`useExpressionSuggestions`의 nested path 시나리오 테스트는 잘 구성되어 있고 `cursorAfterExpr` 헬퍼로 magic number를 피한 점은 우수합니다. 그러나 가장 중요한 데이터 공급 훅인 `useExpressionContext`에 테스트가 전혀 없는 것이 핵심 리스크이며, `VariablePicker` UI 인터랙션, `$var.` 제안, `$node["` label 선택, 함수명 자동완성 등 여러 코드 경로가 완전히 미커버 상태입니다. 이 상태에서는 리팩터링이나 스토어 구조 변경 시 회귀를 탐지할 안전망이 부족합니다.

## 위험도

**MEDIUM**