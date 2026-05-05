## 발견사항

### [WARNING] `evalOne` 클로저가 루프 내부에서 매 아이템마다 생성됨
- **위치**: `filter.handler.ts`, for 루프 내 `const evalOne = (cond: Condition): boolean => { ... }`
- **상세**: `evalOne`은 `item`과 `itemCtx`를 캡처하는 클로저로, N개 아이템마다 새로운 함수 객체가 힙에 할당된다. 아이템 수가 수천 건 이상이면 GC 압박이 된다.
- **제안**: 루프 외부에서 `(item, itemCtx, cond)` 파라미터를 받는 일반 함수(`evalOneCondition`)로 분리하고, 루프 내에서는 `conditions.every(cond => evalOneCondition(item, itemCtx, cond))`처럼 호출.

---

### [WARNING] `stub: Condition` 객체가 N×M 회 생성됨
- **위치**: `filter.handler.ts`, `evalOne` 내부 `const stub: Condition = { field: '', ... }`
- **상세**: N개 아이템 × M개 조건 = N×M번 Condition 객체가 매번 새로 할당된다. 아이템 1,000개 × 조건 5개면 5,000건의 단명(短命) 객체가 생성되어 GC 대상이 된다. `evaluateCondition`에 `fieldValue`를 직접 전달할 수 있으므로 stub 패턴 자체가 불필요하다.
- **제안**: `evaluateCondition` 시그니처를 `(fieldValue, operator, resolvedValue, strict, regex)` 형태로 수정하거나, `Condition` 인터페이스에서 `field` 타입을 분리해 "이미 resolve된 값 경로"를 별도 인수로 처리.

---

### [WARNING] `baseCtx` 스프레드가 아이템마다 O(|variables|) 비용을 지불
- **위치**: `filter.handler.ts`, `const itemCtx: EngineContext = { ...baseCtx, $item: item, $itemIndex: index }`
- **상세**: 워크플로 컨텍스트에 변수가 많을수록(예: 50개 변수 × 10,000개 아이템 = 500,000회 프로퍼티 복사) 스프레드 비용이 누적된다.
- **제안**: `Object.create(baseCtx)`에 `$item`·`$itemIndex`를 own property로 설정하면 프로토타입 체인을 통한 조회가 가능해 전체 복사 없이 오버라이드할 수 있다. 단, expression engine이 `hasOwnProperty` 기반 순회를 하지 않는다는 전제가 필요하므로 엔진 구현 확인 후 적용.

---

### [WARNING] expression engine이 템플릿을 매 아이템마다 재파싱할 가능성
- **위치**: `filter.handler.ts`, `resolveIfExpression` → `evaluate(value, ctx)`
- **상세**: `{{ $item.age }}`처럼 동일한 템플릿 문자열이 N번 `evaluate()`에 전달될 때, expression engine이 내부적으로 매번 렉싱·파싱을 수행한다면 O(N × template_length) 비용이 발생한다. 대규모 배열에서 가장 큰 성능 병목이 될 수 있다.
- **제안**: `execute()` 진입 시 조건 목록을 순회하며 expression 문자열을 한 번만 파싱해 AST/compiled form으로 캐싱한 뒤, 루프 내에서는 캐싱된 AST를 context만 바꿔 evaluate. engine이 이미 내부 캐시를 갖는다면 무관하나, 그렇지 않다면 가장 임팩트가 큰 개선점이다.

---

### [INFO] `EXPRESSION_PATTERN.test()` 이중 호출
- **위치**: `filter.handler.ts`, `computeFieldValue` (1회) → `resolveIfExpression` (1회 더)
- **상세**: `computeFieldValue`에서 `EXPRESSION_PATTERN.test(field)`가 참이면 `resolveIfExpression`을 호출하는데, `resolveIfExpression` 내부도 같은 패턴을 다시 테스트한다. 마이너하지만 중복 연산.
- **제안**: `resolveIfExpression` 에 "이미 패턴 확인 완료" 오버로드를 두거나, `computeFieldValue`에서 확인 후 직접 `evaluate()`를 호출하는 인라인 처리로 단순화.

---

### [INFO] `getRegex`의 `regexCache`는 실행 단위 범위(per-execute)
- **위치**: `filter.handler.ts`, `execute()` 내 `regexCache` 선언
- **상세**: 같은 워크플로가 반복 실행될 때 regex가 매번 재컴파일된다. 현재 구현은 정확하고 메모리 누수도 없지만, 패턴이 constant expression(리터럴)인 경우 클래스 레벨이나 모듈 레벨 캐시로 올리면 재사용 가능.
- **제안**: 즉각적인 변경은 불필요하나, 향후 `compile-time regex` 감지 시 모듈 레벨 캐시로 이동 검토.

---

## 요약

이번 변경은 per-item `$item` 바인딩과 스칼라 배열 sentinel을 정확하게 구현했으며 기능적으로는 완성도가 높다. 성능 면에서 주요 위험은 루프 내 **`evalOne` 클로저·`stub` 객체의 N×M 반복 할당**과 **`baseCtx` 스프레드의 O(|variables|×N) 비용**이다. 이 세 가지가 겹치면 수천 건 이상의 대형 배열에서 GC 압박과 처리 지연이 두드러질 수 있다. 단기적으로 가장 임팩트가 큰 개선은 `stub` 패턴 제거(시그니처 변경)와 `evalOne`을 루프 외부 함수로 분리하는 것이며, expression engine의 내부 파싱 캐시 여부 확인이 병행되어야 한다.

## 위험도

**MEDIUM**