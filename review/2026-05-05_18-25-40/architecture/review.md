## 아키텍처 코드 리뷰 — Filter 노드 per-item Expression Binding

---

### 발견사항

---

**[WARNING] Stub 패턴 — 내부 구현 의존 누출**
- 위치: `filter.handler.ts` `evalOne` 함수 (전체 파일 기준 ~108–117행)
- 상세: `computeFieldValue`로 `fieldValue`를 미리 계산한 뒤, `{ field: '', operator, value }` 더미 `Condition`을 만들어 `evaluateCondition`에 전달한다. 핸들러가 `evaluateCondition` 내부의 sentinel 분기(empty string → item 자체 반환)를 직접 exploit하는 구조다. 두 모듈이 내부 구현 계약으로 결합되어 있으며, `evaluateCondition`의 sentinel 로직이 바뀌면 핸들러 동작도 조용히 깨진다.
- 제안: `evaluateCondition(fieldValue, cond, strict, regex)` 대신 "fieldValue를 이미 외부에서 계산한 경우" 시그니처를 분리하는 것이 더 명확하다. 예: `evaluateResolvedValue(resolvedField: unknown, resolvedValue: unknown, op, strict, regex): boolean`를 `condition-eval.util.ts`에 추가하고 stub 생성을 제거한다.

---

**[WARNING] `Condition.field: unknown` — 공유 인터페이스 타입 안전성 약화**
- 위치: `condition-eval.util.ts` `Condition` 인터페이스
- 상세: `_shared/` 유틸에 위치한 공유 인터페이스의 `field`를 `string → unknown`으로 넓혔다. `if-else`, 기타 조건 평가 노드 등 `Condition`을 소비하는 모든 코드에서 타입 가드나 as-cast 없이는 `field`를 string으로 사용할 수 없게 된다. 변경 이유는 filter 핸들러의 per-item resolve 결과가 비-string일 수 있기 때문인데, 이는 filter-specific 관심사다.
- 제안: 공유 `Condition`은 `field: string | undefined`로 유지하고, filter 전용 `FilterCondition extends Condition`에서 `field: unknown`으로 확장하거나, 핸들러 진입부에서 `unknown` 값을 `string | undefined`로 normalize한 뒤 공유 util에 전달한다.

---

**[WARNING] sentinel 로직의 책임 위치 — 공유 유틸 오염**
- 위치: `condition-eval.util.ts:75–79`
- 상세: `'' / '$item' / non-string → item 자체 사용`이라는 sentinel 의미는 filter 노드의 스칼라 배열 비교 요구에서 비롯된 것이다. 그러나 이 로직이 `_shared/condition-eval.util.ts`에 존재하므로 `evaluateCondition`을 사용하는 다른 노드들도 이 동작을 상속한다. 향후 if-else 노드 등에서 `field: ''`가 의도치 않게 item-self sentinel로 해석되는 버그 가능성이 있다.
- 제안: sentinel 분기를 `evaluateCondition`에서 제거하고, filter 핸들러의 `computeFieldValue`가 sentinel을 처리한 뒤 이미 resolved된 값을 전달하는 전용 함수(위 stub 패턴 개선과 연동)를 사용한다.

---

**[INFO] `resolveIfExpression` 실패 시 `null` 반환 — 암묵적 비교 행동**
- 위치: `filter.handler.ts` `resolveIfExpression` catch 블록
- 상세: 평가 실패 시 `null`을 반환한다. `null`이 `gt/lt/gte/lte` 연산자로 전달되면 `Number(null) = 0`이 되어 `0 > 5 = false`로 처리된다. 의도된 "unmatched 낙하" 결과는 같지만, `null`이 `eq null` 조건에서 의도치 않게 true를 만들 수 있다. 예: `field: '{{ $item.x }}'` 평가 실패 + `operator: 'is_null'` 조합 시 실패한 item이 match로 분류된다.
- 제안: 실패를 나타내는 전용 sentinel (예: `Symbol('EVAL_FAILURE')`)을 사용하고 `evaluateCondition`에서 이를 always-false로 처리하거나, `undefined`를 반환하고 비교 전 early-exit한다.

---

**[INFO] `EXPRESSION_PATTERN = /\{\{/` — 닫는 괄호 미검사**
- 위치: `filter.handler.ts:28`
- 상세: `{{`만 확인하므로 잘못된 템플릿 문자열(예: `{{ unterminated`)도 표현식으로 판정되어 `evaluate()`로 전달된다. `evaluate`가 에러를 던지면 catch에서 `null`로 처리되므로 치명적이지 않으나, 일반 문자열 필드가 `{{`를 포함하는 경우 오작동 가능성이 있다.
- 제안: `/\{\{.*\}\}/` 혹은 expression-engine이 제공하는 `hasExpression` 유틸 함수 사용을 검토한다.

---

**[INFO] 크로스-노드 스키마 의존성**
- 위치: `filter.schema.ts` — `conditionGroupSchema` import from `if-else.schema`
- 상세: filter 스키마가 if-else 스키마에 의존한다. 향후 if-else가 filter 관련 타입을 import하면 순환 의존성이 발생한다. 현재는 단방향이지만 위험 요소다.
- 제안: `conditionGroupSchema`를 `_shared/condition.schema.ts`로 분리하여 두 노드가 공유하도록 한다.

---

**[INFO] `context.expressionContext` 타입 캐스팅**
- 위치: `filter.handler.ts:66`
- 상세: `(context.expressionContext ?? {}) as EngineContext` — `ExecutionContext` 인터페이스에 `expressionContext`가 없는 경우 런타임에 `{}` 폴백이 사용된다. 이 경우 `$variables`, `$input` 등 워크플로우 전역 컨텍스트가 누락된 채로 표현식이 평가된다.
- 제안: `ExecutionContext`에 `expressionContext?: EngineContext`를 명시적으로 추가하여 타입 캐스팅을 제거하고 누락 시 경고 로깅을 추가한다.

---

### 요약

이번 변경은 spec의 per-item `$item` 바인딩을 구현하는 실질적인 기능 개선이며, 전반적인 방향성(TableHandler 선례 답습, lazy regex memoization, 테스트 선작성)은 적절하다. 그러나 핵심 아키텍처 문제가 두 가지 남아 있다. 첫째, `evalOne` 내에서 더미 `Condition`을 생성해 `evaluateCondition`의 내부 sentinel 경로를 exploit하는 stub 패턴은 두 모듈을 내부 구현 계약으로 결합시키며, 유지보수 중 silent regression의 온상이 된다. 둘째, `_shared` 유틸의 sentinel 로직과 `Condition.field: unknown` 타입 완화는 filter-specific 관심사가 공유 경계를 침범한 것으로, 다른 조건 평가 노드에 예기치 않은 동작을 전파할 수 있다. 두 문제 모두 "이미 resolved된 fieldValue를 직접 받는 전용 함수"를 `condition-eval.util.ts`에 추가하는 것으로 동시에 해결할 수 있다.

---

### 위험도

**MEDIUM**