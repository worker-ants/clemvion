## 발견사항

### **[WARNING]** `ExpressionData` 인터페이스 파괴적 변경
- **위치**: `use-expression-context.ts:33` — `sourceItemSample: Record<string, unknown> | null`
- **상세**: `ExpressionData` 인터페이스에 새 필수 필드가 추가됨. 이 인터페이스를 직접 구현하거나 객체를 수동으로 생성하는 모든 코드(다른 테스트, mock, 컴포넌트)는 해당 필드 누락으로 TypeScript 컴파일 에러가 발생함. 테스트 파일은 `sourceItemSample: null`을 default에 포함시켜 이미 대응되어 있음.
- **제안**: 다른 소비자 파일들도 확인 필요. `sourceItemSample?: ... | null`로 optional 처리하거나, 기존 consumer를 일괄 업데이트.

### **[WARNING]** `$dataSource` 제안은 있으나 필드 확장 핸들러 없음
- **위치**: `use-expression-suggestions.ts:213`
- **상세**: `sourceItemSample`이 존재할 때 `$dataSource`가 root 자동완성에 추가되지만, `$dataSource.` 입력 시 필드 제안을 처리하는 분기가 없음. `$input.`, `$sourceItem.`, `$var.`, `$node[...]` 에는 각각 분기가 있으나 `$dataSource.`는 누락됨. 사용자가 `$dataSource.`를 입력하면 root 변수 목록만 표시됨.
- **제안**: `$dataSource.` 시작 시 `dataSource` 배열의 첫 번째 항목 필드를 제안하는 분기 추가.

### **[INFO]** 모듈 레벨 `FUNCTION_NAMES` 즉시 평가
- **위치**: `use-expression-context.ts:8` — `const FUNCTION_NAMES = getAllFunctionNames()`
- **상세**: 모듈 임포트 시점에 한 번 실행됨. `getAllFunctionNames()`가 순수 함수라면 문제없으나, 런타임 등록(동적 함수 추가) 이후 변경이 반영되지 않음.
- **제안**: 현재 구조에서는 허용 범위이나, 함수가 동적으로 등록될 경우 `useMemo` 내부로 이동 필요.

### **[INFO]** Non-null assertion `!` 사용
- **위치**: `variable-picker.tsx:353` — `expressionData.sourceItemSample!`
- **상세**: `expressionData.sourceItemSample`이 truthy인 조건 블록 내부에서 사용되므로 런타임 안전하지만, TypeScript의 null-safety 보호를 명시적으로 우회하는 패턴임.
- **제안**: 안전하나 가능하다면 optional chaining `?.`으로 대체하거나 변수에 할당해 사용.

### **[INFO]** `useMemo` 의존성 배열 검증
- **위치**: `use-expression-context.ts:169` — `[nodes, edges, nodeResults, selectedNodeId]`
- **상세**: 새로 추가된 `sourceItemSample` 계산 로직은 `nodes`, `edges`, `nodeResults`, `selectedNodeId` 모두를 사용하며 의존성 배열과 일치함. 누락된 의존성 없음.

---

## 요약

이번 변경의 핵심 부작용은 `ExpressionData` 인터페이스에 새 필수 필드(`sourceItemSample`)가 추가되어 해당 인터페이스를 직접 구성하는 모든 외부 코드에 컴파일 에러를 유발할 수 있다는 점이다. 테스트 코드는 이미 대응되어 있으나, 다른 소비자 파일 확인이 필요하다. 또한 `$dataSource` 변수가 자동완성에 노출되지만 해당 경로의 필드 확장 로직이 없어 UX 불일치가 발생한다. 전역 상태 오염, 예상치 못한 네트워크 호출, 파일시스템 부작용은 없다.

## 위험도

**MEDIUM** — 인터페이스 파괴적 변경으로 인한 컴파일 에러 가능성 및 `$dataSource` 기능 불완전으로 인한 UX 불일치.