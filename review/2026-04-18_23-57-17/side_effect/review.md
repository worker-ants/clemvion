## 발견사항

### **[WARNING]** 모듈 레벨 `g` 플래그 정규식 공유 상태 — `validate-scope.ts`
- **위치**: `validate-scope.ts` — `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE` (모듈 상단)
- **상세**: `g` 플래그가 붙은 정규식을 모듈 상수로 선언하면 `.test()` 호출 시 `lastIndex`가 변경되어 상태를 오염시킵니다. 코드에서 `LOOP_ROOT_RE.lastIndex = 0` 수동 리셋을 하고 있지만, `ITEM_ROOT_RE`의 경우 `hasItem`이 `true`이면 `if (!context.containerScope.hasItem)` 블록 자체가 실행되지 않아 `ITEM_ROOT_RE.lastIndex`와 `ITEM_INDEX_ROOT_RE.lastIndex`가 리셋되지 않습니다. 다음 호출에서 잘못된 위치부터 매칭을 시작합니다.
- **제안**: 모듈 상수 대신 매 호출마다 `new RegExp(...)` 로 생성하거나, `lastIndex` 리셋을 `hasItem` 분기 밖으로 이동하세요.

```ts
// 항상 리셋
ITEM_ROOT_RE.lastIndex = 0;
ITEM_INDEX_ROOT_RE.lastIndex = 0;
if (!context.containerScope.hasItem) {
  // 검사 로직...
}
```

---

### **[WARNING]** `ExpressionData` 인터페이스 파괴적 변경 — `use-expression-context.ts`
- **위치**: `ExpressionData` 인터페이스에 `allNodeKeys: Set<string>`, `containerScope` 두 필드 추가
- **상세**: `ExpressionData`는 `index.ts`에서 re-export되는 공개 타입입니다. 이 인터페이스를 직접 구현하거나 모킹하는 코드(예: 테스트의 `makeSuggestions`)는 새 필드가 없으면 TypeScript 오류가 발생합니다. `use-expression-suggestions.test.ts` diff에서 `allNodeKeys`와 `containerScope`를 `makeSuggestions` 기본값에 추가한 것이 확인되지만, 프로젝트 내 다른 위치에서 `ExpressionData`를 직접 구성/모킹하는 코드가 있다면 누락될 수 있습니다.
- **제안**: 프로젝트 전체에서 `ExpressionData`를 직접 객체 리터럴로 사용하는 곳을 grep으로 확인하세요.

---

### **[WARNING]** `useExpressionContext` 의존성 배열 확장 — `expression-input.tsx`
- **위치**: `expression-input.tsx` — `useEffect` 의존성 `[value, expressionData]`
- **상세**: `expressionData`가 `useMemo`로 생성되지만 그 안의 `availableNodes`, `allNodeKeys(Set)` 등은 매 렌더링마다 새 참조를 반환합니다. `expressionData` 객체 자체도 `useMemo`의 반환값이라 불필요한 재계산이 없는 한 참조가 안정적이어야 하나, `allNodeKeys`가 `new Set<string>(allDisambiguatedKeys.values())`로 매번 새로 생성되므로 `useMemo` 비교가 실패해 반복 실행 가능성이 있습니다.
- **제안**: `useMemo` 결과에서 `Set`을 참조 안정적으로 만들거나, validation effect에서 `expressionData` 의존성을 `expressionData.availableNodes`, `expressionData.allNodeKeys` 등 원시 비교가 가능한 값으로 세분화하세요.

---

### **[INFO]** `variable-picker.tsx`에서 즉시실행함수(IIFE) 패턴 도입
- **위치**: `variable-picker.tsx` — built-in variables 섹션
- **상세**: 기능상 부작용은 없으나 JSX 내 IIFE는 가독성을 저하시키고, 컴포넌트 리렌더링 시 매번 새 함수가 생성됩니다. 이 패턴은 React에서 비관용적입니다.
- **제안**: 렌더링 바깥에서 `scopedBuiltIns`를 계산하거나 별도 컴포넌트로 분리하세요.

---

### **[INFO]** `resolveNestedValue`의 `?? null` 패턴이 `false`/`0`/`""` 처리에 의존
- **위치**: `resolve-nested-path.ts` — `return current ?? null`
- **상세**: `current`가 `0`, `false`, `""` 같은 falsy 값일 때 `?? null`은 올바르게 해당 값을 반환합니다(`??`는 nullish만 검사). 테스트에서도 커버됩니다. 부작용은 없으나 미래 유지보수자가 `|| null`로 실수 변경 시 버그가 발생할 수 있습니다.
- **제안**: 현행 코드를 유지하되, 이미 작성된 falsy 값 테스트(0, false, "")가 이 invariant를 보호합니다.

---

## 요약

이번 변경은 expression 자동완성에 scope 인식 기능(도달 가능 조상 노드 필터링, 컨테이너 변수 게이팅, scope 유효성 검사)을 추가한 것으로 전체적으로 잘 구조화되어 있습니다. 가장 주목할 부작용은 **모듈 레벨 `g` 플래그 정규식의 `lastIndex` 누출**로, `hasItem === true`인 경우 `ITEM_ROOT_RE`/`ITEM_INDEX_ROOT_RE`의 리셋이 건너뛰어져 동일 모듈 인스턴스 내 연속 호출 시 오탐(false negative)이 발생할 수 있습니다. `ExpressionData` 인터페이스의 파괴적 변경은 동반 테스트 수정으로 이미 처리되었으나 프로젝트 전체 스캔이 권장됩니다.

## 위험도

**MEDIUM** — `lastIndex` 누출 버그가 실제 사용자 환경에서 scope 검사 오동작(특히 `foreach` 컨텍스트)으로 이어질 수 있습니다.