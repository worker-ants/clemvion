## 아키텍처 코드 리뷰

### 발견사항

---

**[CRITICAL]** SwitchHandler 기본 비교 연산이 `===`에서 `==`로 묵시적 변경됨 (하위 호환성 파괴)

- **위치**: `switch.handler.ts` — `matchByValue()` 메서드
- **상세**: 이전 구현은 `coerceCaseValue(c.value, c.valueType) === actualValue`(strict equality)를 사용했고, `valueType`이 없으면 타입이 다른 값은 매칭되지 않았다. 새 구현은 `strictComparison`이 명시적으로 `true`가 아닌 한 `==`(loose equality)를 기본으로 사용한다. 기존에 `switchValue: '1'`, `cases: [{ id: 'c', value: 1 }]`로 구성된 워크플로우는 이전에는 default로 빠졌으나, 이제는 `c`에 매칭된다. 테스트에서도 이전 테스트(`should use strict equality when valueType is not specified` → `default`)와 새 테스트(`loose comparison (default) treats "1" and 1 as equal` → `num`)가 정반대임을 명시한다. **데이터베이스에 저장된 기존 워크플로우 설정을 마이그레이션 없이 재해석하므로 silent misrouting 위험이 있다.**
- **제안**: 기본값을 strict(`===`)로 유지하고, 신규 기능인 `strictComparison: false`를 opt-in으로 제공하거나, 기존 워크플로우에 대한 마이그레이션 스크립트와 함께 변경을 적용할 것. 또는 신규 워크플로우에 한해 적용될 수 있도록 `schemaVersion` 필드를 활용할 것.

---

**[WARNING]** 컨트롤 필드 의미론이 두 레이어에 중복 정의됨 (DRY 위반)

- **위치**: `handler-output.adapter.ts:toEngineFlatShape()` + `execution-engine.service.ts:stripControlFields()`
- **상세**: 어떤 필드가 "컨트롤 필드"인지(`port`, `status`, `_resumeState`, `_selectedPort`)의 정의가 두 곳에 분산되어 있다. 어댑터는 캐시에 쓸 때 이 필드들을 합성하고, 엔진 서비스는 다운스트림으로 전달할 때 이 필드들을 제거한다. 향후 `_nextNode` 같은 새로운 컨트롤 필드가 추가되면 두 곳을 동시에 수정해야 한다는 사실이 코드에서 드러나지 않는다.
- **제안**: 컨트롤 필드 목록을 `handler-output.adapter.ts`에 상수로 선언하고(`const CONTROL_FIELDS = ['_selectedPort', 'port', 'status', '_resumeState'] as const`), `stripControlFields`가 그 상수를 import해서 사용하도록 단일 소스를 만들 것.

---

**[WARNING]** SwitchHandler가 두 가지 독립적인 실행 전략을 담당하여 SRP 위반

- **위치**: `switch.handler.ts:execute()`
- **상세**: `mode: 'value'`와 `mode: 'expression'`은 본질적으로 다른 매칭 알고리즘이다. 하나는 사전 해소된 primitive를 직접 비교하고, 다른 하나는 `evaluateCondition`을 통해 input 필드를 조건식으로 평가한다. validate와 execute 모두 mode에 따라 분기하는 if 블록을 가지며, 이 두 모드는 `SwitchCase.value`와 `SwitchCase.condition`이라는 서로 다른 필드를 사용한다. 앞으로 세 번째 mode가 추가될 경우 이 핸들러는 더 커진다.
- **제안**: 단기적으로는 현 구조가 허용 가능하나, `interface SwitchStrategy { match(input, cases, options): SwitchCase | undefined }` 패턴으로 분리하거나, `ValueModeSwitchHandler`, `ExpressionModeSwitchHandler`를 별도 핸들러로 분리하고 등록을 달리 하는 방향을 검토할 것.

---

**[WARNING]** `not_contains` 연산자가 비문자열 타입에 `true`를 반환하는 암묵적 기본값

- **위치**: `condition-evaluator.util.ts:54`
- **상세**: `contains`는 비문자열 타입에 `false`를 반환하지만, `not_contains`는 비문자열 타입에 `true`를 반환한다. 즉 `fieldValue`가 숫자이면 `not_contains` 조건은 항상 통과된다. 이 비대칭 동작은 테스트에 문서화되어 있지 않으며, 표현식 모드 switch에서 예기치 않은 분기를 유발할 수 있다.
- **제안**: `not_contains`도 타입 불일치 시 `false` 반환을 고려하거나, 최소한 `condition-evaluator.util.spec.ts`에 비문자열 `not_contains`가 `true`를 반환한다는 테스트를 추가하여 의도적 동작임을 명시할 것.

---

**[INFO]** `condition-evaluator.util.ts` 추출은 아키텍처적으로 올바른 결정

- **위치**: `condition-evaluator.util.ts`
- **상세**: if-else와 switch 핸들러에 중복 존재하던 조건 평가 로직을 `nodes/core/` 레이어의 공유 유틸리티로 추출한 것은 DRY 원칙에 부합하고, 향후 다른 조건 기반 핸들러(예: filter, loop-while 등)도 재사용 가능한 구조다. `getNestedValue`에 대한 의존성이 단일 지점으로 집약되어 프로토타입 오염 방어도 일관되게 적용된다.

---

**[INFO]** `stripControlFields`의 단락 최적화(early return)는 불필요한 객체 복사를 방지

- **위치**: `execution-engine.service.ts:stripControlFields()`
- **상세**: 제거할 필드가 없는 경우 원본 객체를 그대로 반환하는 early return은 메모리 효율적이며, 특히 대량의 노드 출력이 전달되는 경우 GC 압력을 줄인다. 올바른 설계.

---

### 요약

이번 변경은 핸들러 컨트롤 필드(`port`, `status`, `_resumeState`)가 다운스트림으로 누출되던 실제 버그를 수정하고, 조건 평가 로직을 공유 유틸리티로 올바르게 추출한 의미 있는 리팩토링이다. 그러나 **SwitchHandler의 기본 비교 동작이 strict에서 loose로 전환된 것은 데이터베이스에 저장된 기존 워크플로우를 재해석하는 breaking change**로, 마이그레이션 계획 없이 배포될 경우 운영 중인 워크플로우의 라우팅 오작동을 유발할 수 있다. 컨트롤 필드 목록의 이중 정의는 중기적인 유지보수 부담이며, SwitchHandler의 이중 모드 구조는 기능 확장에 따라 복잡도가 선형 이상으로 증가할 위험이 있다.

### 위험도

**HIGH** (기본 비교 연산 변경으로 인한 기존 워크플로우 silent misrouting 위험)