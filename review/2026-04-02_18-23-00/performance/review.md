## 성능 코드 리뷰

### 발견사항

---

**[WARNING] `resolveString`의 이중 정규식 평가**
- 위치: `expression-resolver.service.ts` — `resolveString()` 메서드
- 상세: `EXPRESSION_PATTERN.test(value)`로 `{{` 존재 여부를 확인한 후, `evaluate()`를 호출하고 나서 다시 `FULL_EXPRESSION_PATTERN.test(value)`로 전체 표현식 여부를 판별합니다. 그런데 `FULL_EXPRESSION_PATTERN`이 매치되는 경우에도 `evaluate()`가 이미 전체 문자열을 파싱하므로, 타입 보존 분기(`return result`)와 혼합 텍스트 분기(`return result`) 모두 동일한 값을 반환합니다. 즉 `FULL_EXPRESSION_PATTERN.test()`는 항상 수행되지만 현재 코드에서는 분기 결과가 동일하여 무의미한 정규식 실행입니다.
- 제안: `evaluate()`가 단일 표현식 여부 플래그를 반환하도록 패키지를 수정하거나, `FULL_EXPRESSION_PATTERN`을 `evaluate()` 호출 전에 먼저 검사하여 불필요한 중간 처리를 줄이세요.

---

**[WARNING] `buildExpressionContext`에서 `new Date()` 3회 호출**
- 위치: `expression-resolver.service.ts` — `buildExpressionContext()` L38–42
- 상세: `$execution.startedAt`, `$now`, `$today` 모두 개별 `new Date()`를 생성합니다. 동일 컨텍스트 빌드 중에 세 번의 날짜 객체를 생성하며, 노드 실행마다 이 메서드가 호출되면 불필요한 객체 할당이 누적됩니다.
- 제안: 메서드 시작 시 `const now = new Date()`를 한 번만 생성하고 재사용하세요.

---

**[WARNING] `useExpressionContext` — `getAllFunctionNames()` 매 렌더링 호출 가능성**
- 위치: `use-expression-context.ts` — `useMemo` 내부
- 상세: `getAllFunctionNames()`는 `useMemo` 의존성 배열(`nodes, edges, nodeResults, selectedNodeId`)이 변경될 때마다 호출됩니다. 함수 목록이 정적이라면 컴포넌트 모듈 수준 상수로 추출하거나 별도 `useMemo([], [])` (마운트 시 1회)로 분리해야 합니다.
- 제안:
```ts
// 모듈 최상단 (컴포넌트 외부)
const FUNCTION_NAMES = getAllFunctionNames();
```

---

**[WARNING] `ExpressionHighlight` — 매 렌더링마다 문자열 파싱**
- 위치: `expression-highlight.tsx` — while 루프
- 상세: `value`가 변경될 때마다 전체 문자열을 순회하며 parts 배열을 새로 생성합니다. `ExpressionInput` 내에서 `value`는 입력 이벤트마다 변경되므로 매우 빈번하게 실행됩니다. 또한 동일 `value`에 대해 `expression-input.tsx`에서도 `validateExpressions`가 `matchAll`로 파싱하여 중복 파싱이 발생합니다.
- 제안: 파싱 결과를 `useMemo`로 캐싱하거나, highlight와 validation을 단일 파싱 패스로 통합하세요.

---

**[WARNING] `useExpressionSuggestions` — `useMemo` 의존성 과다**
- 위치: `use-expression-suggestions.ts`
- 상세: `expressionData` 객체 전체가 의존성으로 전달됩니다. `useExpressionContext`가 `useMemo`를 사용하지만 `nodes`, `edges`, `nodeResults` 중 어느 하나라도 변경되면 `expressionData` 참조가 교체되어 `useExpressionSuggestions`도 재계산됩니다. 자동완성이 열려 있지 않은 상태에서도 불필요한 재계산이 발생합니다.
- 제안: 자동완성이 닫혀 있을 때(`autocompleteOpen === false`)는 suggestions를 계산하지 않도록 조건부 처리를 추가하거나, `cursorPos`가 표현식 블록 내에 없을 때 조기 반환하세요.

---

**[INFO] `getExpressionToken` — O(n) 역방향 스캔**
- 위치: `use-expression-suggestions.ts` — `getExpressionToken()`
- 상세: 커서 위치에서 문자열 시작까지 역방향으로 선형 탐색합니다. 대부분의 실제 입력 길이에서는 문제가 없지만, 수천 자 이상의 템플릿 필드에서는 체감 지연이 생길 수 있습니다.
- 제안: 현재 스펙 범위에서는 허용 가능한 수준이나, 최대 입력 길이를 제한하는 것을 고려하세요.

---

**[INFO] `ExpressionAutocomplete` — `suggestions.slice(0, 20)` 매 렌더링**
- 위치: `expression-autocomplete.tsx` L69
- 상세: 매 렌더링마다 배열을 슬라이싱합니다. `useMemo`로 한 번만 처리하는 것이 더 명확하나, 배열 크기가 작아 실제 영향은 미미합니다.
- 제안: `useExpressionSuggestions`에서 이미 최대 개수를 제한하거나, slice를 상위 훅으로 올리세요.

---

**[INFO] 로컬 패키지 파일 링크 (`file:../packages/expression-engine`)**
- 위치: `backend/package.json`, `frontend/package.json`
- 상세: 로컬 파일 링크는 개발 환경에서는 적합하지만, CI/CD 빌드 시 패키지 경로가 컨텍스트 외부에 위치하면 Docker 빌드나 monorepo 외부 배포 시 문제가 될 수 있습니다. 성능보다는 빌드 안정성 이슈입니다.
- 제안: workspace 프로토콜 (`workspace:*`) 또는 npm workspaces 설정으로 전환을 검토하세요.

---

### 요약

전반적으로 표현식 엔진 통합 구조는 적절하게 설계되어 있습니다. 주요 성능 위험은 **프론트엔드 편집기**에 집중되어 있습니다. `ExpressionInput`이 키 입력마다 동일한 문자열을 `validateExpressions`(matchAll)와 `ExpressionHighlight`(while 루프)에서 이중으로 파싱하고, `getAllFunctionNames()`가 store 변경 시마다 재호출되는 구조가 사용자 체감 지연으로 이어질 수 있습니다. 백엔드의 `ExpressionResolverService`는 노드 실행당 1회 호출되므로 영향이 제한적이나, `new Date()` 중복 생성과 이미 동일한 값을 반환하는 `FULL_EXPRESSION_PATTERN` 검사는 간단히 제거 가능한 낭비입니다.

### 위험도

**MEDIUM**