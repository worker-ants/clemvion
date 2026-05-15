---

### 발견사항

- **[INFO]** `VariablePicker` 컴포넌트에 JSDoc/Props 문서 없음
  - 위치: `variable-picker.tsx:14-19` (`VariablePickerProps` 인터페이스)
  - 상세: `VariablePickerProps`의 각 prop(`expressionData`, `onInsert`, `open`, `onOpenChange`)에 설명이 없어 사용 의도를 파악하기 어려움
  - 제안: 각 prop에 JSDoc 주석 추가 또는 인터페이스에 전체 목적 설명 추가

- **[INFO]** 내부 컴포넌트(`CategoryHeader`, `PickerItem`, `NestedFieldItem`, `NodeSection`, `InputFieldSection`)에 props 문서 없음
  - 위치: `variable-picker.tsx:39-267`
  - 상세: 공개 컴포넌트는 아니지만, `MAX_NESTING_DEPTH`, `NestedFieldItem`의 재귀 구조 등 비명확한 로직에 설명이 없음
  - 제안: `MAX_NESTING_DEPTH` 상수에 왜 5인지 이유 주석 추가, `NestedFieldItem`의 재귀 동작 설명 추가

- **[INFO]** `useExpressionContext`의 다중 입력 처리 로직에 불완전한 주석
  - 위치: `use-expression-context.ts:74-79`
  - 상세: `incomingEdges.length > 1` 분기에서 "Keys are source node IDs" 주석은 있으나, 이 경우 `$input.` 자동완성이 동작하지 않는다는 제한사항이 명시되지 않음
  - 제안: `// Multiple inputs: $input. field suggestions not supported; show source node IDs instead` 수준의 설명 보완

- **[INFO]** `getExpressionToken` 함수의 정규식 설명 부재
  - 위치: `use-expression-suggestions.ts:55`
  - 상세: `/([a-zA-Z0-9_$."[\]]*?)$/` 정규식이 어떤 토큰 경계를 처리하는지 주석 없음. 특히 `"`, `[`, `]` 문자 포함 이유가 불명확함
  - 제안: 정규식 위에 한 줄 주석으로 의도 설명 (`// Match expression token including quoted bracket notation`)

- **[INFO]** `$dataSource` 변수가 `ROOT_VARIABLES` 목록에 없고 `contextualRoots`에만 동적 추가됨
  - 위치: `use-expression-suggestions.ts:208-215`
  - 상세: `$dataSource`가 어떤 데이터를 나타내는지, 왜 `$sourceItem`과 함께만 노출되는지 주석 없음
  - 제안: 해당 블록 상단에 `// Table-context-only variables: available only when sourceItemSample is present` 주석 추가

- **[INFO]** 테스트 파일의 헬퍼 함수 `cursorAfterExpr`에 대한 설명은 충분하나, `makeSuggestions`에 JSDoc 없음
  - 위치: `use-expression-suggestions.test.ts:6-25`
  - 상세: 테스트 파일이므로 필수는 아니지만, `data: Partial<ExpressionData> = {}` 파라미터 의도 설명이 있으면 유지보수 용이
  - 제안: 선택적 개선 — 테스트 헬퍼에 간단한 주석 추가

### 요약

전반적으로 주요 공개 함수(`useExpressionSuggestions`, `useExpressionContext`, `VariablePicker`)에는 기본적인 목적 주석이 존재하며, 핵심 로직 분기점에도 인라인 주석이 적절히 배치되어 있다. 다만 내부 컴포넌트 props, 복잡한 정규식, 다중 입력 처리의 제한사항, `$dataSource`의 컨텍스트 제약 등에 보완 여지가 있다. API 변경이나 환경변수 추가는 없으므로 README/API 문서 업데이트는 불필요하다.

### 위험도

**LOW**