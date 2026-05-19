# 테스트(Testing) Review

## 발견사항

- **[INFO]** `matchesVisible` 내부에서 `equals` 분기가 단일 값 체크만 수행 — array 인 경우 처리 없음
  - 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/visibility.ts` L964–L969 (`matchesVisible`)
  - 상세: `requiredWhen` 은 `equals` 가 array 이면 whitelist 로 동작하는 `matchesRequired` 를 별도 분리했다. 그런데 `matchesVisible` 의 `equals` 분기는 여전히 `value === rule.equals` 단순 동등 비교만 수행한다. 두 함수의 `equals` 처리 방식이 다르다는 점은 의도적이지만, `visibleWhen.equals` 에 array 를 잘못 전달하더라도 조용히 false 를 반환할 뿐 에러가 없다. 이 비대칭 동작에 대한 테스트(또는 malformed-rule guard 테스트)가 `isFieldVisible` 측에는 없다.
  - 제안: `visibility.test.ts` 의 `isFieldVisible` 섹션에 `equals` 에 array 를 전달했을 때 항상 false 를 반환한다는 테스트를 추가해 비대칭 동작을 명시적으로 문서화한다.

- **[WARNING]** `matchesRequired` 에서 `config[rule.field]` 가 `undefined` 일 때 동작 테스트 미흡
  - 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/__tests__/visibility.test.ts` L870–L875
  - 상세: `isFieldRequired` 의 `requiredWhen` 분기에 대해 추가된 테스트는 field 키가 config 에 존재하는 케이스만 검증한다. `config` 에 해당 field 가 없을 때(`undefined`) — 예컨대 신규 노드 config 초기화 직후 — 의 동작이 테스트되지 않는다. 단일 값 분기(`value === rule.equals`)는 `undefined !== 'value'` 이므로 false 로 안전하지만, whitelist 분기(`rule.equals.includes(undefined)`) 는 whitelist 에 `undefined` 가 포함되어 있으면 true 를 반환할 수 있다. 실제 사용처에서는 `undefined` 가 whitelist 에 포함되지 않겠지만, 코너 케이스로 명시 테스트가 없다.
  - 제안: `isFieldRequired` 테스트에 `config = {}` (필드 없음) 케이스를 whitelist 형태의 `requiredWhen` 에 대해서도 추가한다. 예: `equals: ['value']`, `config: {}` → `false` 기대.

- **[WARNING]** `notEquals` 형태를 사용하는 기존 consumer 코드에 대한 회귀 테스트 없음
  - 위치: `codebase/backend/src/nodes/logic/switch/switch.schema.ts` (변경 전 `notEquals: 'expression'`), `logic-ui-required.spec.ts`
  - 상세: `requiredWhen` 의 `notEquals` / `oneOf` 형태는 인터페이스에서 제거되었다. 이번 변경에서 switch 노드만 교체되었고, 다른 노드(carousel 등 presentation 카테고리)에서 동일 패턴을 사용하는 경우 타입 에러가 발생하거나 런타임에서 조용히 실패할 수 있다. 프론트엔드 `matchesRequired` 는 `notEquals` 키를 처리하는 분기가 없으므로 기존 직렬화된 데이터(node-definitions API 캐시 등)에 `notEquals` 가 실려 오면 항상 false 를 반환한다.
  - 제안: (1) 프로젝트 전체에서 `requiredWhen.*notEquals` / `requiredWhen.*oneOf` 사용 여부를 grep 으로 확인해 잔존 consumer 를 식별한다. (2) `matchesRequired` 에 `notEquals` 키가 포함된 legacy 객체가 들어올 때 false 를 반환한다는 방어 테스트를 추가해 silent failure 를 명시화한다.

- **[INFO]** 변경 이유를 주석으로 설명한 테스트의 가독성은 양호하나, test description 명 불일치 잠재 위험
  - 위치: `logic-ui-required.spec.ts` L456
  - 상세: 테스트 명칭이 `"equals whitelist [value]"` 로 변경되어 의도를 잘 표현한다. `it.each` 블록 외부의 단일 `it` 케이스이므로 격리도 문제없다. 주석으로 변경 맥락(`2026-05-19 정준화, requiredwhen-dsl-whitelist: notEquals → equals whitelist`)을 명시한 점은 회귀 추적에 도움이 된다.
  - 제안: 현 상태 유지. 단, 향후 `warningRule` 의 `when` 식(`mode != expression`)과 `requiredWhen.equals: ['value']` 의 의미 범위가 달라질 경우 두 SSOT 가 어긋날 수 있다. `logic-ui-required.spec.ts` 의 목적이 바로 이 동기화를 잠금하는 것이므로 현행 구조는 적절하다.

- **[INFO]** `visibility.test.ts` 에 새로 추가된 "빈 배열" 케이스 — 경계값 테스트 양호
  - 위치: `visibility.test.ts` L873–L875
  - 상세: `equals: []` 일 때 항상 false 를 반환하는지 검증하는 테스트가 추가되었다. `Array.prototype.includes` 의 빈 배열 동작을 명시적으로 커버한다. 간결하고 독립적으로 실행 가능하다.
  - 제안: 현 상태 유지.

- **[WARNING]** `matchesRequired` 에 대한 타입 안전성 우회 가능성 — runtime 방어 테스트 없음
  - 위치: `visibility.ts` L972–L977 (`matchesRequired`)
  - 상세: `RequiredRule` 타입은 `equals: unknown | readonly unknown[]` 이다. TypeScript 레벨에서는 `Array.isArray(rule.equals)` 분기로 안전하지만, 프론트엔드가 백엔드 API 응답을 역직렬화할 때 타입이 소실되므로 `rule.equals` 가 `null` 이거나 `object` 인 케이스(예: 잘못된 서버 응답)는 런타임 예외를 낼 수 있다. `Array.isArray(null)` 은 false 이므로 `null === value` 비교로 안전하게 빠지지만, `equals` 자체가 plain object 인 경우도 동일하게 처리된다.
  - 제안: 현재 수준으로 안전하다 판단되나, `rule.equals` 에 `null` / `{}` 를 넣는 malformed-rule 방어 테스트를 하나 추가하면 향후 API 응답 변경 시 회귀를 조기에 포착할 수 있다.

---

## 요약

이번 변경(`requiredWhen` DSL 단일화 — `notEquals`/`oneOf` 제거, `equals` whitelist 통일)에 대한 테스트 커버리지는 전반적으로 양호하다. 프론트엔드 `visibility.test.ts` 는 단일 값, 배열 whitelist, 빈 배열 경계값 케이스를 모두 추가했고, 백엔드 `logic-ui-required.spec.ts` 는 switch 노드의 `requiredWhen` 변경을 잠금한다. 다만 `config` 에 해당 field 가 없을 때(`undefined`) 의 whitelist 동작, `notEquals` 형태를 가진 legacy 소비자가 잔존할 경우의 silent failure, 그리고 `visibleWhen` 과 `requiredWhen` 의 `equals` 처리 비대칭성에 대한 명시적 테스트가 없어 향후 DSL 확장 시 혼동 여지가 있다. 치명적 결함은 없으나 두 개의 WARNING 수준 커버리지 갭이 존재한다.

## 위험도

LOW
