## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING]** `computeFieldValue`의 `typeof field === 'string'` 분기가 `resolveIfExpression`과 이중 패턴 검사
- 위치: `filter.handler.ts:152-165` (`computeFieldValue` 메서드)
- 상세: `EXPRESSION_PATTERN.test(field)` 호출이 `computeFieldValue`에서 한 번, `resolveIfExpression` 내부에서 다시 한 번 수행된다. 외부에서 패턴 확인 후 `resolveIfExpression`을 호출하지만, `resolveIfExpression` 자체도 같은 가드를 반복한다. 호출 경로가 명확하지 않아 중복 검사가 존재한다.
- 제안: `computeFieldValue`에서 `EXPRESSION_PATTERN.test()` 분기 없이 항상 `resolveIfExpression`을 호출하거나, 반대로 패턴 검사를 `computeFieldValue`에서만 하도록 책임을 일원화한다.

---

**[WARNING]** `stub` 객체 생성이 핫 루프 안에 위치 (per-item × per-condition)
- 위치: `filter.handler.ts:110-114` (`evalOne` 클로저 내 `stub` 생성)
- 상세: `evalOne`이 매 아이템 × 매 조건마다 `{ field: '', operator: ..., value: ... }` 객체를 새로 할당한다. `field: ''` sentinel 우회를 위한 패턴인데, `evaluateCondition`에 `fieldValue`를 직접 받는 파라미터를 추가하거나 오버로드하는 것이 더 명료하다. 현재 구조는 "필드 해석을 이미 외부에서 끝냈으므로 내부 lookup을 우회한다"는 의도를 `stub` 패턴으로 숨긴다.
- 제안: `evaluateCondition(fieldValue, operator, compareValue, strict, regex)` 시그니처로 리팩토링하거나, `evaluateConditionByValue`를 별도 추출하여 `stub` 우회 패턴 제거.

---

**[WARNING]** `EXPRESSION_PATTERN = /\{\{/` 가 핸들러 로컬 상수 — `condition-eval.util.ts`와 분리된 중복 정의 가능성
- 위치: `filter.handler.ts:31`
- 상세: 표현식 패턴 상수가 `filter.handler.ts` 내에만 정의되어 있다. 향후 `if-else.handler`, `loop.handler` 등에서 동일한 패턴이 필요해질 때 제각각 정의될 수 있다. `@workflow/expression-engine` 또는 `_shared/` 유틸에서 export되면 일관성이 보장된다.
- 제안: `EXPRESSION_PATTERN`을 `_shared/condition-eval.util.ts` 또는 expression-engine 패키지에서 export.

---

**[WARNING]** `regexCache`의 `Map<string, RegExp | null>` + `?? undefined` 패턴이 직관적이지 않음
- 위치: `filter.handler.ts:75-89` (`getRegex` 클로저)
- 상세: `null`을 "컴파일 실패 마커"로 사용하고 `cached ?? undefined`로 변환하는 패턴은 Map의 `has()` vs `get()` 구분을 `!== undefined` 체크로 대체한 것. `regexCache.has(pattern)` / `regexCache.get(pattern)` 조합이 더 명시적이다.
- 제안:
  ```ts
  if (regexCache.has(pattern)) return regexCache.get(pattern) ?? undefined;
  ```
  로 교체하면 `null`의 역할이 더 명확해진다.

---

**[INFO]** `condition-eval.util.ts`의 `Condition.field: unknown` 타입 확장은 타입 안전성을 약화시킴
- 위치: `condition-eval.util.ts:37`
- 상세: `field: string`을 `field: unknown`으로 완화한 것은 per-item 해석 결과를 수용하기 위함이지만, `Condition` 인터페이스 자체가 "저장된 형태의 조건"과 "평가 후 임시 stub" 두 가지 역할을 겸하게 된다. 주석이 이를 설명하고 있지만, 인터페이스가 두 생명주기를 하나로 묶는 것은 미래 기여자에게 혼란을 줄 수 있다.
- 제안: `AuthoredCondition { field?: string }` vs `ResolvedCondition { field: unknown }` 으로 분리하거나, `evaluateCondition`에 `fieldValue`를 직접 받는 오버로드를 추가해 `stub` 패턴을 없애면 `field: string`을 유지할 수 있다.

---

**[INFO]** `evalOne` 클로저가 outer scope의 `item`, `itemCtx`, `strictComparison`, `getRegex`를 모두 캡처
- 위치: `filter.handler.ts:97-119` (`evalOne` 클로저)
- 상세: 클로저가 루프 내에서 정의되고 4개의 외부 변수를 암묵적으로 캡처한다. 가독성은 충분하지만 테스트 시 직접 단위 테스트가 어렵다. `private evaluateOneCond(cond, item, itemCtx, strict, getRegex)` 메서드로 분리하면 독립 테스트 가능성이 높아진다.
- 제안: 클로저를 private 메서드로 추출 (메서드 자체는 가볍고 파라미터가 명시적).

---

**[INFO]** plan 문서의 체크리스트가 모두 미체크(`- [ ]`) 상태로 커밋됨
- 위치: `plan/in-progress/node-features/filter-conditions-expression-binding.md`
- 상세: 구현이 이미 완료된 것으로 보이지만 plan 문서의 체크박스가 갱신되지 않았다. CLAUDE.md 규약에 따르면 작업이 끝나면 plan을 갱신하고 `plan/complete/`로 이동해야 한다.
- 제안: 완료된 항목을 `[x]`로 표시하고 모든 항목 완료 시 `git mv`로 `plan/complete/`로 이동.

---

### 요약

전체적으로 코드 품질이 높고 의도가 명확하게 드러난다. 특히 `computeFieldValue`와 `resolveIfExpression`의 분리, 주석을 통한 sentinel 설명, per-item context 바인딩 패턴은 TableHandler 선례와 일관성을 잘 유지한다. 주요 유지보수성 우려는 `stub: Condition` 패턴으로, `field: ''` 우회를 위해 `Condition` 인터페이스 타입을 `unknown`으로 완화하는 연쇄 효과가 발생했다. 이 패턴은 `evaluateCondition` 시그니처에 `fieldValue` 직접 파라미터를 추가하면 깔끔하게 해소될 수 있으며, 동시에 `Condition.field`를 `string`으로 복원할 수 있다. `EXPRESSION_PATTERN` 상수의 로컬 정의와 regex cache의 `null` 마커 패턴도 향후 확장 시 일관성 문제로 이어질 수 있는 소규모 기술 부채다.

### 위험도

**LOW**