### 발견사항

- **[INFO]** `visibleWhen` DSL 의 `notEquals`/`oneOf` 보존 — 이유 미명시
  - target 위치: plan `## 결정` 섹션, `node-component.interface.ts` `visibleWhen` 타입 정의
  - 과거 결정 출처: plan 본문 "결정 (사용자, 2026-05-19)" — `notEquals` 는 deprecate/제거, `oneOf` 는 deprecate
  - 상세: plan 본문은 `notEquals` 와 `oneOf` 를 "deprecate / 제거" 하겠다고 선언했지만, 실제로는 `requiredWhen` 에서만 제거하고 `visibleWhen` 의 두 shape 은 `node-component.interface.ts:219-220` 과 `frontend/types.ts:58-59` 에 그대로 보존된다. `ai-agent.schema.ts:151` 이 `visibleWhen: { field: 'mode', notEquals: 'multi_turn' }` 을 능동적으로 사용 중이므로 보존이 합리적이지만, plan 문언이 "notEquals 제거" 로 읽히는 범위가 `requiredWhen` 에만 한정임을 명시하지 않는다. 이후 같은 plan 을 읽는 개발자가 `visibleWhen.notEquals` 도 제거해야 하는지 혼동할 수 있다.
  - 제안: plan `## 결정` 또는 `## 배경` 에 한 줄 추가 — "deprecate/제거 범위는 `requiredWhen` DSL 한정. `visibleWhen` 은 `notEquals` / `oneOf` 를 그대로 유지한다 (`ai-agent.schema.ts:151` 등 능동 사용 중)."

- **[INFO]** `warningRule` 의 `mode != expression` 블랙리스트 표현 — `requiredWhen` 화이트리스트 정책과 표면상 불일치
  - target 위치: `switch.schema.ts:222` — `when: 'mode != expression && !switchValue'`
  - 과거 결정 출처: `spec/4-nodes/1-logic/2-switch.md §8.1` — "블랙리스트 의미가 mode 확장 시 위험하여 화이트리스트로 전환"
  - 상세: `requiredWhen` 은 `equals: ['value']` 화이트리스트로 전환됐지만, 같은 조건을 표현하는 `warningRule.when` 표현식 (`'mode != expression && !switchValue'`) 은 블랙리스트 형태를 유지한다. 이 두 DSL 은 별개 레이어(TypeScript 타입 유니온 vs. 런타임 문자열 표현식)라 충돌이 아니지만, §8.1 의 "화이트리스트로 통일" 원칙이 `warningRule` 레이어까지 적용되는지 plan 과 spec 모두 침묵한다. 향후 신규 mode 추가 시 `warningRule` 만 누락될 위험이 잠재한다.
  - 제안: `spec/4-nodes/1-logic/2-switch.md §8.2 신규 mode 추가 가이드라인` 에 단계 추가 — "5. `warningRule id='switch:value-mode-needs-switch-value'` 의 `when` 표현식도 새 mode 에 맞게 갱신 (`mode != expression` 형태는 신규 mode 가 추가될 때 자동으로 적용되므로, `requiredWhen.equals` 배열과 동기화 여부를 의도적으로 검토한다)."

- **[INFO]** `requiredWhen` DSL shape 변경의 교차-노드 문서화 부재
  - target 위치: plan `## 작업 항목` — spec 갱신 범위가 `spec/4-nodes/1-logic/2-switch.md` 만 포함
  - 과거 결정 출처: `plan/in-progress/node-config-required-defaults-sweep.md` follow-up "spec Rationale 공식화" (consistency I-5) — `ui.required` / `requiredWhen` 의 설계 원칙을 `spec/4-nodes/0-overview.md` 또는 카테고리별 `0-common.md` Rationale 에 공식화 예정
  - 상세: `requiredWhen` DSL shape 이 단일 shape `{ field, equals: T | readonly T[] }` 로 정준화됐으나, 이 변경이 `node-component.interface.ts` 레벨의 공유 인터페이스 정책임에도 sweep 의 I-5 follow-up 과 연결되는 교차-노드 spec 문서(예: `spec/4-nodes/0-overview.md` 나 convention 파일)에는 기록되지 않는다. switch spec §8.1 만 참조하면 `requiredWhen` 화이트리스트 정책이 전체 노드에 적용되는 공통 인터페이스 결정임을 알기 어렵다.
  - 제안: I-5 follow-up ("spec Rationale 공식화") 처리 시 `requiredWhen` 단일 shape 정준화 결정을 함께 기록한다. 또는 본 plan 의 spec 갱신 항목에 `spec/4-nodes/0-overview.md` 또는 `spec/4-nodes/1-logic/0-common.md` 에 한 줄 참조를 추가하는 소항목을 포함시킨다.

### 요약

target plan `requiredwhen-dsl-whitelist.md` 은 과거 spec Rationale 에서 기각된 결정을 재도입하거나 합의된 invariant 를 직접 위반하지 않는다. `requiredWhen` DSL 의 `notEquals`/`oneOf` 제거와 `equals` array 화이트리스트 채택은 `spec/4-nodes/1-logic/2-switch.md §8.1` 에 선택지 비교표와 함께 명문화되어 있고, 실제 코드(`switch.schema.ts:88`, `visibility.ts:14-19`, `node-component.interface.ts:242`)와 정합한다. 발견된 3건은 모두 INFO 등급으로, 계획 문언의 범위 모호성(`notEquals` 제거가 `requiredWhen` 한정임이 명시되지 않은 점), `warningRule` 블랙리스트 표현과 `requiredWhen` 화이트리스트 정책 간의 가이드라인 공백, 교차-노드 DSL 정책 문서화 누락이다. 이 중 실질적 위험은 신규 mode 추가 시 `warningRule.when` 갱신이 누락될 가능성이며, §8.2 가이드라인에 해당 단계를 추가하면 해소된다.

### 위험도

LOW
