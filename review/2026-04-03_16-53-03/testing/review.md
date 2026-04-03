### 발견사항

---

**[INFO]** `expression-exclusions.ts` 변경에 대한 단위 테스트 부재
- 위치: `expression-exclusions.ts`
- 상세: `table: new Set(['columns'])` 추가로 table 노드의 `columns` 필드가 표현식 해석에서 제외됨. 이 동작을 검증하는 테스트가 없음.
- 제안: `ExpressionResolverService` 테스트에 table 노드의 `columns` 필드가 표현식 해석을 건너뛰는 케이스 추가.

---

**[INFO]** `ExpressionContext` 타입 확장(`$dataSource`, `$sourceItem`, `$sourceItemIndex`)에 대한 `evaluator.ts` 레벨 테스트 부재
- 위치: `evaluator.ts:38-40`
- 상세: 새 컨텍스트 변수들이 타입 선언에만 추가됨. evaluator 단위 테스트에서 이 변수들을 실제로 사용하는 표현식 평가 케이스가 없음.
- 제안: evaluator 테스트에 `$dataSource`, `$sourceItem`, `$sourceItemIndex`를 컨텍스트로 전달하여 표현식이 올바르게 평가되는지 확인하는 테스트 추가.

---

**[INFO]** `expressionContext` 전파 경로(`execution-engine.service.ts`)에 대한 통합 테스트 없음
- 위치: `execution-engine.service.ts:578`
- 상세: `context.expressionContext = exprContext` 대입이 테스트되지 않음. `nodeMap`이 없는 분기(`resolvedConfig = node.config`)에서는 `expressionContext`가 설정되지 않아 `undefined`가 되는 케이스도 검증 누락.
- 제안: `nodeMap`이 없는 경우 `context.expressionContext`가 `undefined`임을 검증하거나, table 핸들러가 해당 상황에서 `baseCtx`를 빈 객체로 fallback하는 동작(`context.expressionContext ?? {}`)을 table 핸들러 테스트에서 명시적으로 커버.

---

**[INFO]** `resolveColumnLabels`의 static 모드 early return 외 케이스 커버리지 확인
- 위치: `table.handler.ts:151-175`, `table.handler.spec.ts`
- 상세: static 모드 early return은 테스트됨. 그러나 dynamic 모드에서 **label에 표현식이 없는 경우**(early return) 테스트가 없음. 또한 label 표현식 평가 시 `$dataSource`만 컨텍스트에 포함되고 `$sourceItem`/`$sourceItemIndex`는 없다는 설계 결정이 테스트로 문서화되지 않음.
- 제안: 아래 케이스 추가:
  1. dynamic 모드에서 label이 일반 문자열일 때 그대로 반환
  2. label에 `{{ $dataSource.length }}` 같은 표현식이 있을 때 올바르게 해석

---

**[INFO]** `renderHtml`의 `resolvedColumns` vs `originalColumns` 분리 동작 테스트 부재
- 위치: `table.handler.ts:177-200`
- 상세: 헤더는 `resolvedColumns`(label 표현식 해석 결과)를 사용하고, 셀 데이터는 `originalColumns`(원본 field명)를 키로 조회하는 구조. 이 구분이 실제 HTML 렌더링에서 올바르게 동작하는지 검증하는 테스트 없음.
- 제안: label에 표현식이 포함된 컬럼에서 `rendered` HTML의 `<th>`는 해석된 값을, `<td>`는 원본 field에서 가져온 데이터를 포함하는지 검증하는 테스트 추가.

---

**[INFO]** 표현식 평가 실패(예외) 시 동작 미검증
- 위치: `table.handler.ts:116`, `table.handler.ts:168`
- 상세: `evaluate(col.field, itemCtx)`나 `evaluate(col.label, ctx)` 호출 시 잘못된 표현식(`{{ $undefined.foo }}` 등)으로 예외가 발생하면 어떻게 되는지 테스트 없음. 현재 코드는 예외를 catch하지 않으므로 전체 노드 실행이 실패함.
- 제안: 잘못된 표현식 입력 시 에러 전파 동작을 검증하는 테스트 추가 (또는 graceful fallback 구현 후 테스트).

---

### 요약

이번 변경은 새로운 기능(dot-path 접근, per-item 표현식 평가, label 표현식 해석)에 대한 핵심 테스트를 잘 갖추고 있으며, 기존 테스트와의 호환성도 유지된다. 다만 `expression-exclusions` 변경 검증, `evaluator.ts`의 새 컨텍스트 변수 단위 테스트, `resolveColumnLabels`의 일부 분기(label 미표현식 케이스, HTML 렌더링의 resolvedColumns/originalColumns 구분), 그리고 표현식 평가 실패 시 에러 전파에 대한 테스트가 부재하여 완전한 커버리지에 소폭 미달한다. 모두 Minor 수준이며 기존 동작을 깨는 회귀 위험은 없다.

### 위험도

**LOW**