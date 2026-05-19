### 발견사항

- **[WARNING]** `visibleWhen` 과 `requiredWhen` DSL 간 비대칭 추상화 — 의도적이나 타입 시스템으로 강제되지 않음
  - 위치: `node-component.interface.ts` (`visibleWhen` 정의부) / `types.ts` (`UiHint` 정의부)
  - 상세: `visibleWhen` 은 여전히 `{ equals } | { notEquals } | { oneOf }` 3-variant 유니온을 유지하고, `requiredWhen` 은 `{ field, equals: unknown | readonly unknown[] }` 단일 shape 로 통일됐다. 두 DSL 이 같은 `UiHint` 인터페이스 안에서 서로 다른 평가 규칙을 가지므로, 미래에 `visibleWhen` 도 단일화할 때 `matchesVisible` 역시 `Array.isArray` 분기를 추가해야 하는 일관성 부채가 남는다. 현재 비대칭은 plan 에 "한시 유지" 로 인지되어 있으나, 타입 레벨에서 두 DSL 이 별도 타입으로 분리되어 있지 않아 `visibleWhen` 에 array `equals` 를 넣어도 TypeScript 는 막지 못한다 (`unknown` 수용).
  - 제안: `type VisibleWhenRule` / `type RequiredWhenRule` 을 `UiHint` 외부에 명시적으로 선언하고 JSDoc 에 각각의 허용 shape 를 문서화. 중기적으로 `visibleWhen` 도 동일 단일 shape 로 마이그레이션.

- **[WARNING]** `matchesVisible` 내 `Array.isArray` 가드 부재 — `equals` 에 array 가 실수로 전달될 경우 참조 동등 비교로 fallthrough
  - 위치: `visibility.ts` `matchesVisible` 함수
  - 상세: `matchesVisible` 는 `"equals" in rule` 분기에서 `value === rule.equals` 단순 비교를 한다. `visibleWhen` 의 `equals` 타입이 `unknown` 이므로 누군가 `visibleWhen: { field: 'x', equals: ['a','b'] }` 로 작성해도 컴파일 에러가 없고, 런타임에 `value === ['a','b']` (참조 비교) 로 항상 false 가 된다. `matchesRequired` 와의 행동 불일치가 버그 온상이 된다.
  - 제안: `matchesVisible` 에도 `Array.isArray(rule.equals)` 방어 분기를 추가하거나, `visibleWhen.equals` 를 `unknown` 이 아닌 구체 스칼라 타입(`string | number | boolean | null`)으로 제한하여 타입 레벨에서 오용을 차단.

- **[WARNING]** `warningRule.when` 표현식이 여전히 블랙리스트 패턴 사용 — `requiredWhen` 정준화와 불일치
  - 위치: `switch.schema.ts` `warningRules` 배열 (`id: 'switch:value-mode-needs-switch-value'`)
  - 상세: `switchValue.requiredWhen` 은 이번 PR 에서 `equals: ['value']` 화이트리스트로 변환됐지만, 동일 의미를 표현하는 `warningRule.when: 'mode != expression && !switchValue'` 는 여전히 블랙리스트(`!= expression`) 로 남아 있다. 신규 mode 가 추가될 때 `requiredWhen` 은 옳게 동작하고 `warningRule` 은 잘못 동작하는 불일치가 생긴다. plan 의 consistency I-2 에서 인지됐으나 이번 commit 에 반영되지 않았다.
  - 제안: `warningRule.when` 도 화이트리스트 형태인 `mode == value && !switchValue` 또는 DSL 이 지원한다면 `mode in [value] && !switchValue` 로 변환. 최소한 inline comment 로 "신규 mode 추가 시 이 표현식도 갱신 필요" 를 명시.

- **[INFO]** `HandlerDependencies` 인터페이스가 사용되지 않는 서비스까지 묶는 God-Interface 패턴
  - 위치: `node-component.interface.ts` `HandlerDependencies` (변경 범위 외, 전체 파일 컨텍스트)
  - 상세: 인터페이스 분리 원칙(ISP) 관점에서 `HandlerDependencies` 는 `llmService`, `ragSearchService`, `knowledgeBaseService`, `integrationsService`, `mcpClientService` 등 서로 독립적인 서비스를 단일 bag 으로 노출한다. 대부분의 핸들러는 일부만 소비하고 나머지는 무시한다. 이번 PR 범위 밖이지만, 추후 핸들러 테스트 시 mock 부담이 증가하는 구조적 부채.
  - 제안: 단기적으로 현 구조 유지 가능. 중기적으로 카테고리별 `AIHandlerDeps`, `IntegrationHandlerDeps` 등 세분화 또는 의존성 레지스트리 패턴 도입 고려.

- **[INFO]** 단일 파일(`node-component.interface.ts`)이 포트/메타/UI힌트/핸들러 의존성을 모두 선언 — SRP 경계 모호
  - 위치: `node-component.interface.ts` 전체
  - 상세: `NodePort`, `NodePorts`, `NodeComponentMetadata`, `UiHint`, `HandlerDependencies`, `NodeComponent` 가 한 파일에 집중되어 있다. 이번 변경(`requiredWhen` 타입 수정)은 `UiHint` 만 건드리지만 동일 파일에 핸들러 의존성 타입도 섞여 있어 변경 영향 범위가 불명확하다. 이번 PR 자체의 문제는 아니나 향후 분리 리팩토링 시 인지 필요.
  - 제안: `ui-hint.interface.ts`, `handler-dependencies.interface.ts` 등으로 분리 후 barrel 재-export 구조로 전환.

- **[INFO]** `equals: unknown | readonly unknown[]` 타입이 단일/배열 구분을 런타임에만 위임 — 타입 안전성 부족
  - 위치: `node-component.interface.ts:299` / `types.ts:1141`
  - 상세: `equals` 필드의 타입이 `unknown | readonly unknown[]` 이므로 TypeScript 입장에서는 단일 값인지 배열인지 정적으로 구분할 수 없다. `matchesRequired` 내부에서 `Array.isArray(rule.equals)` 로 분기하는 것은 올바르지만, 사용자가 의도를 실수로 `equals: 'value'` (단일) 로 써야 할 자리에 `equals: ['value']` (배열) 를 써도 동작하고, 반대도 동작한다 — 의미는 달라지지만 컴파일러가 잡지 못한다.
  - 제안: 현 구조 수용 가능(단순성 우선). 장기적으로 overloaded generic `RequiredWhenRule<T extends ScalarValue | ScalarValue[]>` 또는 명시적 두 shape union `{ field: string; equals: Scalar } | { field: string; equals: readonly Scalar[] }` 검토.

### 요약

이번 변경은 `requiredWhen` DSL 을 `notEquals` / `oneOf` 블랙리스트·중복 형태에서 `equals: T | T[]` 단일 화이트리스트로 통일하는 합리적인 아키텍처 결정이다. 변경 범위(인터페이스 → 프론트엔드 타입 mirror → 평가 함수 분리 → 사용처 마이그레이션 → 테스트)가 일관되게 추적되었고, `matchesVisible` 과 `matchesRequired` 를 함수 레벨에서 분리한 것은 단일 책임 원칙에 부합한다. 다만 세 가지 경계 위험이 존재한다: (1) `visibleWhen` DSL 이 한시적으로 비대칭을 유지하면서 타입 레벨 강제 없이 방치되는 점, (2) `warningRule.when` 표현식이 여전히 블랙리스트 패턴(`!= expression`)을 사용해 `requiredWhen` 정준화와 실의미가 불일치하는 점, (3) `matchesVisible` 에 `Array.isArray` 방어 로직 부재로 실수 사용 시 런타임 silent bug 발생 가능성. 이 중 (2)는 신규 mode 추가 시 실제 버그로 이어질 수 있어 조기 처리가 권장된다.

### 위험도

MEDIUM
