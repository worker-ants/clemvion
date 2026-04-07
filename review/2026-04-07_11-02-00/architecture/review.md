### 발견사항

---

**[WARNING] ROOT_VARIABLES / BUILT_IN_VARIABLES 중복 — 단일 책임 원칙(SRP) 및 DRY 위반**
- 위치: `use-expression-suggestions.ts:19-29` / `variable-picker.tsx:28-35`
- 상세: 동일한 내장 변수 목록(`$execution`, `$now`, `$today`, `$loop`, `$item`, `$itemIndex`)이 두 파일에 각각 독립된 상수로 정의되어 있습니다. 자동완성 제안과 VariablePicker UI가 서로 다른 진실의 원천을 바라보고 있으며, 하나를 수정해도 다른 하나는 자동으로 반영되지 않습니다.
- 제안: 내장 변수 목록을 `expression-constants.ts` 같은 공유 모듈로 추출하고 양쪽에서 import.

---

**[WARNING] 레이블 기반 노드 조회 — 취약한 계약(Fragile Contract)**
- 위치: `use-expression-context.ts:129` / `use-expression-suggestions.ts:119`
- 상세: `$node["Label"].output` 표현식에서 노드를 `label`로 탐색합니다. 레이블은 사용자가 편집 가능한 표시 이름이므로, 레이블이 중복되거나 변경되면 조회가 실패합니다. ID 기반 조회로 설계되어야 할 로직이 변경 가능한 표시 이름에 의존합니다.
- 제안: 노드 ID를 식별자로 사용하는 별도 맵을 유지하거나, 표현식 내부에 안정적인 nodeId를 포함시키고 레이블은 표시용으로만 사용.

---

**[WARNING] `useExpressionContext`의 도메인 지식 하드코딩 — OCP/레이어 책임 위반**
- 위치: `use-expression-context.ts:100` (`"variable_declaration"`), `:118` (`"table"`), `:127` (`$node["..."].output` 정규식)
- 상세: UI 레이어 훅이 노드 타입 문자열(`"variable_declaration"`, `"table"`)과 표현식 문법 패턴을 직접 알고 있습니다. 새 노드 타입이 추가될 때마다 이 훅을 수정해야 합니다. 노드 타입별 데이터 추출 전략은 레지스트리나 도메인 레이어로 분리되어야 합니다.
- 제안: 노드 타입별 `getOutputFields`, `getVariables` 등을 노드 타입 정의에 전략 패턴으로 결합하여, `useExpressionContext`가 구체 타입을 알 필요 없도록 추상화.

---

**[WARNING] `FUNCTION_NAMES` 모듈 로드 시 실행**
- 위치: `use-expression-context.ts:8` — `const FUNCTION_NAMES = getAllFunctionNames();`
- 상세: 훅 호출 시점이 아닌 모듈 임포트 시점에 평가됩니다. 함수 목록이 동적으로 등록되는 구조라면 스냅샷이 되어 변경이 반영되지 않습니다. 또한 모듈 로드 시 사이드 이펙트가 발생합니다.
- 제안: `useMemo` 내부로 이동하거나, 함수 이름이 정적이라면 `ExpressionData`에서 제거하고 소비자에서 직접 호출.

---

**[WARNING] 테스트 커버리지 불균형**
- 위치: `__tests__/use-expression-suggestions.test.ts`
- 상세: `useExpressionSuggestions`는 꽤 촘촘하게 테스트되어 있지만, 데이터 준비 로직의 핵심인 `useExpressionContext`와 `VariablePicker` 인터랙션에 대한 테스트가 전무합니다. 특히 `useExpressionContext`의 전임 노드 탐색, 변수 추출, `sourceItemSample` 해석 로직은 복잡한 분기를 가지고 있어 테스트가 필요합니다.
- 제안: `useExpressionContext` 단위 테스트 추가 (mocked stores 사용), `VariablePicker`의 insert 콜백 및 카테고리 토글 동작 테스트 추가.

---

**[INFO] `useExpressionSuggestions` 내 관심사 혼재**
- 위치: `use-expression-suggestions.ts:35-61` (`getExpressionToken`), `:64-94` (`buildNestedSuggestions`)
- 상세: 하나의 파일 안에 표현식 파싱(토큰 추출), 중첩 필드 탐색, 컨텍스트별 제안 생성이 모두 존재합니다. 각각 독립적으로 테스트하기 어렵고 책임 범위가 넓습니다.
- 제안: `getExpressionToken`을 `expression-parser.ts`로 분리. 현재 테스트 파일에서도 더 세밀한 단위 검증이 가능해집니다.

---

**[INFO] `as Record<string, unknown>` 남용**
- 위치: `use-expression-context.ts:89, 90, 93, 99, 102, 117, 118, 119, 121`
- 상세: 노드의 `data` 필드에 타입 정보가 없어 런타임 캐스팅에 의존합니다. 타입 시스템의 보호를 우회하며 버그를 감춥니다.
- 제안: `NodeData` 인터페이스를 정의하고 에디터 스토어의 노드 타입에 적용.

---

**[INFO] `VariablePicker`에서 `sourceItemSample!` 비필수적 단언**
- 위치: `variable-picker.tsx:353`
- 상세: 이미 상위에서 `expressionData.sourceItemSample`이 truthy인 조건 블록 내부임에도 `!` 사용. TypeScript가 narrowing을 통해 추론하지 못하는 구조.
- 제안: 로컬 변수에 할당 후 사용하거나 early return 패턴으로 narrowing 확보.

---

### 요약

전반적으로 표현식 자동완성 기능은 관심사 분리(`useExpressionContext` → `useExpressionSuggestions` → `VariablePicker`)라는 올바른 방향으로 설계되어 있습니다. 그러나 내장 변수 목록의 이중 정의, 레이블 기반 노드 조회의 취약성, 그리고 UI 훅 내부에 직접 박힌 노드 타입 도메인 지식이 장기적인 유지보수 비용을 높이는 핵심 위험입니다. 특히 워크플로우 노드 타입이 늘어날수록 `useExpressionContext`의 하드코딩된 분기가 누락과 불일치의 진원지가 될 가능성이 높으므로, 노드 타입별 전략 추출이 우선순위가 높은 개선 항목입니다.

### 위험도

**MEDIUM**