# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[WARNING]** `UiHint.requiredWhen` 타입에서 `notEquals` / `oneOf` 형태 제거 — 파생 타입 사용처 런타임 미불일치 가능성
  - 위치: `codebase/backend/src/nodes/core/node-component.interface.ts` 라인 45-49 (diff), `codebase/frontend/src/lib/node-definitions/types.ts` 라인 65-54 (diff)
  - 상세: 두 파일에서 `requiredWhen` 의 유니온 타입(`{ field; notEquals }` / `{ field; oneOf }`)이 삭제되고 단일 shape `{ field; equals: unknown | readonly unknown[] }` 로 교체되었다. TypeScript 컴파일 타임에는 오류가 잡히지만, 만약 외부 API 응답, LocalStorage, DB 에 저장된 노드 config 메타데이터에 `notEquals` / `oneOf` 키를 담고 있는 직렬화된 JSON 이 있다면 런타임에서 `matchesRequired` 가 아무 분기에도 걸리지 않고 `value === rule.equals` 비교를 `false` 로 반환할 수 있다. 현재 코드에서 `requiredWhen` 은 노드 스키마 정적 정의(.meta()로 코드에 고정)에서만 사용되고, DB 저장 대상이 아님이 코드와 계획 문서에서 확인된다. 그러나 이 점이 JSDoc / spec 에 명시적으로 기록되어 있지 않아 후속 개발자가 직렬화 대상으로 오해할 여지가 있다.
  - 제안: `UiHint` / `requiredWhen` 정의에 "이 메타데이터는 코드에 정적으로 선언되며 DB 저장 대상이 아니다" 취지의 한 줄 JSDoc을 추가하여 직렬화 오해를 차단.

- **[WARNING]** `matchesVisible` 와 `matchesRequired` 의 `equals` 분기 동작 비대칭
  - 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/visibility.ts` 라인 964-970 (전체 파일 컨텍스트)
  - 상세: `matchesVisible` 는 `"equals" in rule` 조건에서 `value === rule.equals` 단순 비교만 한다 — `rule.equals` 가 배열이면 배열 객체와 `===` 비교가 되어 항상 `false`. 반면 `matchesRequired` 는 `Array.isArray(rule.equals)` 분기로 배열을 whitelist로 처리한다. `visibleWhen` 의 type 정의는 여전히 `{ field; equals: unknown }` 단일 값만 허용하므로 현재는 TypeScript 수준에서 배열 전달이 막히지만, 사용자가 `as const` 캐스트로 배열 `equals` 를 넘기거나 `requiredWhen` 의 변경에 따라 `visibleWhen` 에도 유사 패턴을 적용하려 할 경우 `matchesVisible` 는 의도와 다르게 항상 `false` 를 반환한다. 이는 현재 코드의 버그라기보다 잠재적 함정(silent failure)이다.
  - 제안: `matchesVisible` 함수에도 `Array.isArray(rule.equals)` 분기를 추가하거나, `visibleWhen` 타입 정의에 명시적으로 `equals` 는 배열 미지원임을 주석으로 못 박아 향후 통합 시 혼동을 방지.

- **[INFO]** `matches()` 함수 이름이 `matchesVisible()` / `matchesRequired()` 두 함수로 분리됨 — 기존 외부 참조 없음 확인
  - 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/visibility.ts` 라인 903-911 (diff)
  - 상세: 내부 헬퍼 `matches` 가 `matchesVisible` / `matchesRequired` 로 분리·개명되었다. 두 함수 모두 파일 내부에서만 사용되며 `export` 없이 선언되어 있어 모듈 외부 호출자에 미치는 영향은 없다. `isFieldVisible` / `isFieldRequired` 공개 함수의 시그니처는 변경 없음.
  - 제안: 문제 없음.

- **[INFO]** `switch.schema.ts` 의 `requiredWhen` 값 변경이 `warningRule` 조건과 의미상 분리됨
  - 위치: `codebase/backend/src/nodes/logic/switch/switch.schema.ts` 라인 488-494 (diff)
  - 상세: 기존 `requiredWhen: { field: 'mode', notEquals: 'expression' }` 은 `warningRule.when: 'mode != expression && !switchValue'` 와 의미 정렬. 새 `requiredWhen: { field: 'mode', equals: ['value'] }` 는 현재 enum 값이 `'value' | 'expression'` 두 개이므로 실질적으로 동일하게 작동하지만, 향후 mode 가 추가되면 `warningRule.when` (블랙리스트 `!= expression` 유지)과 `requiredWhen` (화이트리스트 `['value']`)가 다르게 동작할 수 있다. 이는 의도된 분기임이 plan 문서의 consistency I-2 에 기록되어 있으나, schema 코드 주석에는 이 분기 의도가 없다.
  - 제안: `switch.schema.ts` 의 `warningRules` 주석 또는 `requiredWhen` 주석에 "warningRule.when 은 미설정(undefined) config 대응을 위해 != expression 유지, requiredWhen 은 명시적 화이트리스트 ['value'] 사용 — 신규 mode 추가 시 두 곳 동기화 필요" 한 줄 추가.

- **[INFO]** `logic-ui-required.spec.ts` 테스트 어설션 변경 — 구버전 `notEquals` 어설션 완전 제거
  - 위치: `codebase/backend/src/nodes/logic/logic-ui-required.spec.ts` 라인 390-401 (diff)
  - 상세: `notEquals: 'expression'` 어설션이 `equals: ['value']` 로 교체되었다. 이전 DSL 형태에 대한 음성 테스트(negative test — `notEquals` 가 데이터에 존재하면 실패하는지)는 추가되지 않았다. 구버전 DSL 형태가 실수로 재도입되더라도 이 테스트는 새 형태만 검증하므로 감지 안 됨.
  - 제안: 구버전 형태 재도입 방어가 필요하다면 `requiredWhen` 객체에 `notEquals` 키가 없음을 별도 단언으로 추가할 수 있다. 다만 TypeScript 타입 시스템이 이미 컴파일 타임에 차단하므로 테스트 추가 여부는 팀 정책에 따름.

## 요약

이번 변경은 `requiredWhen` DSL 을 3개 union shape 에서 단일 `{ field, equals }` shape 로 축소하고, `equals` 가 배열이면 whitelist 로 해석하도록 `matchesRequired` 를 분리 구현한 것이다. 부작용 관점에서 핵심 위험은 두 가지다. 첫째, `matchesVisible` 는 `matchesRequired` 와 달리 `equals` 배열 분기를 처리하지 않아 `visibleWhen` 통합 정리(후속 follow-up)를 진행할 때 silent failure 를 일으킬 수 있는 비대칭이 남아 있다. 둘째, 삭제된 `notEquals` / `oneOf` 타입이 정적 코드 선언 전용임이 명시되지 않아, 이 메타데이터를 직렬화하거나 외부에서 주입하려는 시도가 생기면 런타임에서 무결함 없이 잘못된 `false` 를 반환할 수 있다. 전역 변수·파일시스템·환경 변수·네트워크 호출·이벤트·외부 공유 상태 측면의 부작용은 발견되지 않았으며, 공개 함수(`isFieldVisible`, `isFieldRequired`) 시그니처는 변경되지 않았다.

## 위험도

LOW
