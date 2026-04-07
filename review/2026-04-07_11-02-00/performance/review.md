### 발견사항

- **[INFO]** `useExpressionContext` — 모듈 로드 시 `getAllFunctionNames()` 즉시 실행
  - 위치: `use-expression-context.ts:8` (`const FUNCTION_NAMES = getAllFunctionNames();`)
  - 상세: 파일 임포트 시점에 단 한 번 실행되므로 실질적으로 문제없음. 단, 함수 목록이 런타임에 동적으로 변하는 구조라면 stale 값이 됨
  - 제안: 현재 정적 구조라면 유지. 동적 변경 가능성이 있으면 `useMemo` 내부로 이동

- **[INFO]** `useExpressionContext` — `useMemo` 의존성 배열에 참조 불안정 위험
  - 위치: `use-expression-context.ts:55–169`
  - 상세: `nodes`, `edges`, `nodeResults`가 매 렌더마다 새 배열 참조로 반환된다면 `useMemo`가 매번 재계산됨. Zustand 셀렉터가 얕은 비교를 보장하는지에 달려있어 스토어 구현에 따라 최적화 효과가 없을 수 있음
  - 제안: Zustand 셀렉터에 `useShallow` 또는 개별 원시값 셀렉터를 사용해 참조 안정성 확보 여부 확인

- **[INFO]** `useExpressionContext` — `resultMap` 빌드 시 O(n) 순회
  - 위치: `use-expression-context.ts:57–60`
  - 상세: `nodeResults` 전체를 Map으로 변환. 노드 수가 수십~수백 수준이면 무시할 수 있음. 그러나 `nodeResults`가 store에서 이미 Map으로 관리된다면 이 변환 자체가 중복 비용
  - 제안: 실행 스토어에서 `Map<nodeId, result>` 형태로 유지하고 직접 사용 고려

- **[INFO]** `useExpressionSuggestions` — 키입력마다 정규식 컴파일
  - 위치: `use-expression-suggestions.ts:113, 136, 205`
  - 상세: `trimmedToken.match(/\$node\["([^"]+)"\]\.output\.(.*)$/)` 등 세 개의 정규식이 `useMemo` 내부에서 매 계산마다 생성됨. JS 엔진이 리터럴 정규식을 캐싱하지만, 엄밀히는 모듈 스코프 상수로 추출하면 의도가 명확해짐
  - 제안: 세 정규식을 모듈 상수(`const NODE_OUTPUT_RE = /.../)로 추출 (가독성 + 명시적 캐싱)

- **[WARNING]** `variable-picker.tsx` — 함수 목록 전체를 DOM에 렌더링
  - 위치: `variable-picker.tsx:441–448`
  - 상세: `expressionData.functionNames` 전체를 `map`으로 렌더링. 함수가 수십~수백 개일 경우 팝오버 열릴 때 대량 DOM 노드 생성. `use-expression-suggestions.ts:222`에서는 이미 `.slice(0, 10)` 제한을 두는데 피커는 무제한
  - 제안: 팝오버 함수 목록에도 상위 N개 제한 또는 가상 스크롤 적용

- **[INFO]** `variable-picker.tsx` — `Object.keys()` 중복 호출
  - 위치: `variable-picker.tsx:294, 344`
  - 상세: `inputFieldCount`(`Object.keys(inputSample).length`)와 `$sourceItem` count(`Object.keys(sourceItemSample).length + 1`)가 렌더마다 재계산됨. 미미한 비용이나 `useMemo`로 캐싱 가능
  - 제안: `const inputFieldCount = useMemo(() => Object.keys(expressionData.inputSample).length, [expressionData.inputSample])`

- **[INFO]** `NestedFieldItem` — 트리 전체 즉시 렌더링이 아닌 온디맨드 구조로 양호
  - 위치: `variable-picker.tsx:94–179`
  - 상세: `expanded` 상태 기반으로 자식 노드를 조건부 렌더링하여 미전개 노드는 DOM에 없음. MAX_NESTING_DEPTH=5 제한도 적절

### 요약

전반적으로 `useMemo` 활용이 적절하며 심각한 성능 문제는 없다. 주요 위험은 두 가지: (1) Zustand 셀렉터의 참조 안정성이 보장되지 않으면 `useExpressionContext`의 `useMemo`가 매 렌더마다 재실행될 수 있고, (2) `VariablePicker`의 함수 목록이 전체 렌더링되어 함수 수가 많을 때 팝오버 초기 열림이 느려질 수 있다. 나머지는 INFO 수준의 코드 명확성 개선 사항이다.

### 위험도

**LOW**