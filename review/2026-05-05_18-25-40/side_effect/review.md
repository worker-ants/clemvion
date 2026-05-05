## 발견사항

### [WARNING] `Condition.field: string → unknown` 인터페이스 파괴적 변경
- **위치**: `condition-eval.util.ts:38`
- **상세**: `Condition` 인터페이스는 `condition-eval.util.ts`에서 export되어 filter 이외의 다른 로직 노드(if-else 등)도 사용할 가능성이 있음. `field` 타입이 `string → unknown`으로 바뀌면서, `condition.field`를 `string`으로 읽는 기존 호출자는 TypeScript 컴파일 오류 또는 런타임 오류를 겪을 수 있음.
- **제안**: `Condition` 인터페이스의 소비자가 filter 핸들러뿐인지 grep으로 확인. 다른 노드 핸들러가 있다면 해당 노드의 `evaluateCondition` 호출도 sentinel 동작 변화 영향을 받음.

---

### [WARNING] `evaluateCondition` sentinel 동작 변화가 모든 호출자에 영향
- **위치**: `condition-eval.util.ts:71-75`
- **상세**: 변경 전에는 `field: ''`이면 `getNestedValue(item, '')` → 구현에 따라 `undefined` 또는 item, `field: '$item'`이면 `undefined`. 변경 후 두 경우 모두 `item` 자체를 반환. filter 핸들러는 이미 `stub = { field: '' }` 형태로 사전 처리한 값을 넘기므로 직접 영향이 없지만, `evaluateCondition`을 직접 호출하는 다른 코드(if-else 노드 등)는 빈 field 케이스에서 동작이 조용히 달라짐.
- **제안**: `evaluateCondition` 직접 호출부 전체를 검색해 sentinel 동작 변화가 예상치 못한 매칭을 일으키지 않는지 확인.

---

### [WARNING] 표현식 평가 실패 시 `null` 반환 → 숫자 비교에서 암묵적 매칭
- **위치**: `filter.handler.ts:167-172` (`resolveIfExpression` catch 블록)
- **상세**: 표현식 평가 실패 시 `null`을 반환. `Number(null) === 0`이므로 `operator: 'gt'`, `value: -1`처럼 0보다 작은 비교값이 있으면 실패한 표현식을 가진 item이 **match에 포함됨**. plan 문서에는 "undefined fallback"으로 명시되어 있어 코드와 계획 불일치.
  ```
  field: '{{ $item.throws }}', operator: 'gt', value: -1
  → catch → null → Number(null) = 0 > -1 → true → match에 포함
  ```
- **제안**: `null` 대신 `undefined` 반환으로 변경 권장. `Number(undefined) = NaN`, `NaN > -1 = false`로 의도한 unmatched 동작과 일치.

---

### [INFO] `$item`/`$itemIndex`가 외부 forEach 컨텍스트를 덮어씀
- **위치**: `filter.handler.ts:95-99`
- **상세**: `itemCtx = { ...baseCtx, $item: item, $itemIndex: index }`. `baseCtx`에 이미 `$item`이 있으면 (외부 ForEach 노드 내부에서 filter가 실행될 때) 외부 `$item`이 현재 filter item으로 덮어써짐. 조건 표현식에서 외부 `$item`을 참조하는 사용 패턴은 의도치 않은 동작을 일으킬 수 있음.
- **제안**: 중첩 실행 시나리오가 실제로 발생하는지 확인. 발생 가능하다면 `$outerItem`처럼 외부 컨텍스트를 보존하는 방안 검토.

---

### [INFO] `computeFieldValue`의 non-string fallback과 `evaluateCondition` sentinel 간 의미 불일치
- **위치**: `filter.handler.ts:149-176`
- **상세**: `computeFieldValue`에서 non-string `field`는 `field` 값 자체를 반환. 반면 `condition-eval.util.ts`의 sentinel은 non-string `field`이면 `item` 자체를 반환. 현재는 `stub = { field: '' }`로 우회하므로 runtime 충돌은 없지만, 두 파일이 동일 개념을 다르게 정의하고 있어 향후 유지보수 시 혼란 유발 가능.
- **제안**: `condition-eval.util.ts`의 non-string sentinel 분기를 제거하거나, 두 함수의 비-문자열 처리 정의를 문서로 명확히 구분.

---

### [INFO] `context.expressionContext` 접근 — `ExecutionContext` 인터페이스 확장 여부 불명확
- **위치**: `filter.handler.ts:76`
- **상세**: `context.expressionContext`를 접근하지만 `ExecutionContext` 인터페이스에 해당 필드가 정의되어 있는지 이 변경 범위에서 확인 불가. `undefined`면 `?? {}` 폴백으로 조용히 처리되어 workflow-level 변수가 조건 표현식에서 사용 불가능해지며, 런타임 오류 없이 조건이 잘못 평가될 수 있음.
- **제안**: `ExecutionContext` 인터페이스에 `expressionContext?: EngineContext` 필드 추가 여부 확인 및 필요시 타입 정의 업데이트.

---

## 요약

이번 변경의 핵심 부작용 위험은 두 가지다. 첫째, `Condition.field`를 `unknown`으로 확장하고 `evaluateCondition`에 sentinel 분기를 추가한 것이 filter 이외의 공유 소비자(if-else 등)에게 조용한 동작 변화를 일으킬 수 있으며, 빈 field를 가진 기존 조건이 이제 `item` 자체와 비교되는 의도치 않은 매칭을 낳을 수 있다. 둘째, 표현식 평가 실패 시 `null` 반환이 숫자 비교 연산자와 조합될 때 의도치 않게 item이 match에 포함되는 silent regression이 발생할 수 있다. filter 핸들러 내부의 per-item 바인딩 로직 자체는 설계가 명확하고 상태 누수도 없으나, `Condition` 인터페이스와 `evaluateCondition`이 공유 유틸이라는 점에서 여파 범위 확인이 필수다.

## 위험도

**MEDIUM**