### 발견사항

- **[WARNING]** `visibleWhen`과 `requiredWhen`의 DSL 형태 불일치 — `matchesVisible`과 `matchesRequired` 함수가 서로 다른 분기 로직을 담당하나, `visibleWhen`은 여전히 `equals | notEquals | oneOf` 세 가지 shape를 지원하는 반면 `requiredWhen`은 단일 `{ field, equals }` shape만 지원한다. 두 DSL이 같은 인터페이스(`UiHint`)에 병존하면서 지원 연산자 집합이 달라 코드를 읽는 사람이 혼동할 수 있다.
  - 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/visibility.ts` 전체; `codebase/backend/src/nodes/core/node-component.interface.ts` `UiHint` 인터페이스
  - 상세: `visibleWhen`은 `notEquals`, `oneOf`를 계속 허용하고 `matchesVisible`이 이를 처리하지만, `requiredWhen`은 `equals`만 가능하며 `matchesRequired`는 `Array.isArray` 분기로 구현되었다. 두 DSL을 동일 인터페이스 내에서 비교할 때 지원 범위가 다르다는 사실이 타입 시그니처만으로는 즉시 드러나지 않는다.
  - 제안: `UiHint` JSDoc 또는 `visibility.ts` 상단에 두 DSL의 지원 연산자 비교표를 명시적으로 기록하거나, 장기적으로 `visibleWhen`도 `equals`-whitelist 패턴으로 점진 통일할 계획이 있다면 그 방향을 한 줄로 언급한다.

- **[WARNING]** `matchesVisible` 내부의 `equals` 분기가 단일 값 비교만 수행하나, 실제 타입 정의는 `unknown`이어서 배열이 들어올 경우 의도와 다르게 동작할 수 있다.
  - 위치: `visibility.ts` L964–L968 (`matchesVisible`)
  - 상세: `matchesVisible`의 `"equals" in rule` 분기는 `value === rule.equals`를 수행한다. `visibleWhen`의 타입은 배열을 허용하지 않으므로 현재 타입 수준에서는 안전하지만, `requiredWhen`에서 배열 whitelist를 `Array.isArray`로 분기하는 패턴과 대비되어 `matchesVisible`도 같은 처리가 필요한 것 아닌지 의문이 생긴다. 두 함수의 `equals` 처리 방식 차이에 대한 설명이 코드에 없다.
  - 제안: `matchesVisible` 함수 상단에 "`visibleWhen.equals`는 단일 값만 지원 (배열 불가)"임을 한 줄 주석으로 명시한다.

- **[WARNING]** `switch.schema.ts`의 `warningRules`에서 `mode != expression` 조건(블랙리스트 의미)과 `requiredWhen`의 `equals: ['value']`(화이트리스트 의미)가 혼재한다.
  - 위치: `codebase/backend/src/nodes/logic/switch/switch.schema.ts` L718–L732 (`warningRules`) 및 L590 (`requiredWhen`)
  - 상세: `requiredWhen`은 화이트리스트 패턴(`equals: ['value']`)으로 통일되었으나, 같은 필드를 보호하는 `warningRules[0]`의 `when` 표현식은 여전히 `mode != expression`(블랙리스트)으로 남아 있다. 두 규칙이 동일 필드를 대상으로 서로 다른 논리 방향으로 표현되어 있어 향후 mode 추가 시 `warningRules`만 갱신이 누락될 수 있다. 주석(`// Default mode is 'value'... mode != expression instead of mode == value`)이 이 차이를 설명하지만 두 위치가 떨어져 있어 읽기 부담이 있다.
  - 제안: `warningRules`의 해당 `when` 조건도 `mode == value && !switchValue`로 변경하거나, 현재 표현식이 `requiredWhen`과 의도적으로 다름을 교차 참조 주석으로 명확히 연결한다. (단, `mode`가 없을 때의 동작 차이를 고려해 변경 가능 여부를 먼저 검토해야 한다.)

- **[INFO]** 인라인 날짜·작성자 주석(`2026-05-19 정준화 (requiredwhen-dsl-whitelist)`)이 여러 파일에 중복 삽입되었다.
  - 위치: `node-component.interface.ts` L294–L298; `switch.schema.ts` L492–L494; `logic-ui-required.spec.ts` L392–L393; `visibility.ts` L917–L918, L941–L942; `types.ts` L1047–L1048
  - 상세: 변경 근거(worktree 이름, 날짜, 담당자) 주석은 git history에 이미 존재하므로 코드 내 중복 삽입은 장기적으로 노이즈가 된다. 또한 주석 스타일이 파일마다 미묘하게 다르다(코드 주석 vs JSDoc vs 테스트 `it` 설명 내 인라인).
  - 제안: 날짜·작성자·worktree 메타데이터는 commit message에만 두고 코드 주석에서는 "이유(why)"만 간결하게 남긴다.

- **[INFO]** `requiredWhen`의 타입 표현 `unknown | readonly unknown[]`이 유니온으로 선언되어 타입 가드가 런타임에만 작동한다.
  - 위치: `node-component.interface.ts` L299; `types.ts` L1141
  - 상세: `equals: unknown | readonly unknown[]`은 TypeScript 타입 시스템 관점에서 사실상 `unknown`과 동일하게 취급되어 컴파일 타임에 배열 여부를 구분해주지 않는다. 실제 분기는 `Array.isArray`로 런타임에서만 이루어진다.
  - 제안: 현재 구조에서 완전한 타입 안전성을 얻으려면 `equals` 타입을 구분된 두 shape(`{ field: string; equals: Primitive } | { field: string; equals: readonly Primitive[] }`)로 분리하거나, 단순성을 유지할 의도라면 현 구조가 의도적임을 JSDoc에 명기한다. 단기 변경 부담이 크다면 INFO 수준으로 tracking만 해도 충분하다.

- **[INFO]** `visibility.test.ts`의 테스트 설명이 한국어와 영어가 혼재한다.
  - 위치: `visibility.test.ts` L870 (`"equals whitelist 가 빈 배열이면 어떤 값도 required 아님"`)
  - 상세: 기존 테스트는 모두 영문 설명을 사용하는 반면, 새로 추가된 빈 배열 케이스만 한국어로 작성되어 스타일 일관성이 깨진다.
  - 제안: `"equals whitelist: empty array never makes field required"` 또는 유사한 영문으로 통일한다.

---

### 요약

이번 변경은 `requiredWhen` DSL을 블랙리스트(`notEquals`) / 중복(`oneOf`) 형태에서 단일 화이트리스트 형태(`equals: value | value[]`)로 단순화하는 것이 핵심이다. 변경 범위(인터페이스 → 런타임 구현 → 테스트)가 일관되게 갱신되었고, 인터페이스 계층에서는 JSDoc으로 근거가 충분히 설명되어 있다. 다만 `visibleWhen`과 `requiredWhen`의 지원 연산자 집합이 동일 파일 내에서 달라지면서 두 DSL의 비교를 위한 명시적 안내가 부재하고, `warningRules`의 `mode != expression` 표현이 `requiredWhen`의 `equals: ['value']` 화이트리스트 방향과 대비되어 일관성이 완전하지 않다. 날짜·담당자 주석의 파일 내 중복도 장기적 노이즈로 작용할 수 있다. 전반적으로 유지보수성 위험은 낮지만, 두 DSL의 차이를 문서화하고 `warningRules` 조건의 표현 방향을 통일하면 향후 mode 추가 시 혼란을 줄일 수 있다.

### 위험도

LOW
