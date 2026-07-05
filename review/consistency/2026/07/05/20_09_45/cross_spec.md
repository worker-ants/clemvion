# Cross-Spec 일관성 검토 — V-12 Switch switchValue asterisk

대상 diff: `git diff origin/main...HEAD` — `codebase/frontend/.../node-configs/logic-configs.tsx` (`SwitchConfig`) 의 `switchValue` `ExpressionInput` 에 `required={mode === "value"}` 추가 + 신규 unit test + CHANGELOG.

## 확인한 SoT

- `spec/4-nodes/1-logic/2-switch.md §8.1` (`switchValue.requiredWhen` 화이트리스트 정책): `switchValue` 의 UI asterisk 는 `ui.requiredWhen: { field: 'mode', equals: ['value'] }` 화이트리스트로 구현된다고 명시. §8.2 는 신규 mode 추가 시 `requiredWhen.equals` 배열 동기화 가이드를 별도로 규정.
- backend `codebase/backend/src/nodes/logic/switch/switch.schema.ts:88` — `switchValue` 필드 `requiredWhen: { field: 'mode', equals: ['value'] }` (mode enum 은 `['value', 'expression']`, 현재 'value' 만 필수).
- `spec/3-workflow-editor/1-node-common.md §2.6` (2-track 렌더 SoT): override 트랙(`OVERRIDE_REGISTRY` 등재 노드는 bespoke 컴포넌트로 렌더, `requiredWhen` DSL 은 auto-form 트랙(`SchemaForm`)만 소비) vs auto-form 트랙(fallback, backend `.meta({ui})` 힌트 직접 소비). §2.6.3 트랙 배정 현황에 `switch` 가 override 잔존 목록에 명시.
- `override-registry.ts:56` — `switch: SwitchConfig` 로 override 트랙 등재 확인.
- `expression-input.tsx` — `required` prop 존재, `true` 면 라벨 옆 `*` asterisk 렌더 (기존 컴포넌트 기능, 신규 아님).

## 정합성 분석

target diff 는 `SwitchConfig`(override-track bespoke 컴포넌트)의 `switchValue` `ExpressionInput` 에 `required={mode === "value"}` 를 전달한다. 이는 backend `requiredWhen: { field: 'mode', equals: ['value'] }` 화이트리스트를 프런트 override-track 코드에서 **수동으로 재현**한 것이다.

- **mode enum 정합**: backend `mode: z.enum(['value', 'expression'])` vs 프런트 `mode === "value"` 비교. 값 집합·비교 대상 문자열이 일치 — 불일치 없음.
- **화이트리스트 취지 보존**: spec §8.1 의 핵심 근거는 "신규 mode 추가 시 자동 발화 방지"이며, `mode === "value"` 자체가 명시적 화이트리스트 비교(`===`)이므로 블랙리스트(`mode !== "expression"`)로 회귀하지 않았다. 향후 신규 mode(`'range'` 등) 추가 시 이 override-track 조건도 함께 갱신해야 한다는 점은 §8.2 가이드라인의 대상이 되는데, override-track 코드는 `requiredWhen.equals` 배열 참조 없이 하드코딩된 문자열 비교이므로, **§8.2 의 "동기화 대상" 목록에 이 override-track 조건이 명시적으로 등재되어 있지 않다** (INFO 수준 — 아래 발견사항 참고).
- **§2.6 2-track 원칙과의 관계**: `requiredWhen` DSL 자체는 spec 상 "auto-form 트랙" 소비 대상으로 기술되어 있으나(§2.6.1 표), 이 diff 는 DSL 을 직접 소비하지 않고 override-track 컴포넌트가 **동일 정책을 별도로 재구현**한 것이다. 이는 override-track 의 존재 이유(§2.6 "cross-field side effect 등 auto-form 표현력 밖의 요구")와 상충하지 않는다 — override 노드도 여전히 필수 표시라는 UX 계약은 지켜야 하므로. 기존 `integration-configs.tsx` 에서도 override-track 컴포넌트가 `required={field.required}` 형태로 조건부 required 를 전달하는 선례가 있어 패턴 일관성도 있다.
- **런타임 검증과의 분리**: diff 주석이 명시하듯 이 변경은 순수 시각 표시이며 실제 필수 검증은 `NodeHandler.validate()`(및 `warningRules`)가 그대로 담당 — 검증 이중화나 신규 검증 경로 도입이 아니므로 실행 엔진 계약과 충돌 없음.

## 발견사항

- **[INFO]** override-track 화이트리스트 재현이 §8.2 동기화 체크리스트에 미등재
  - target 위치: `codebase/frontend/.../logic-configs.tsx:166` (`required={mode === "value"}`), CHANGELOG V-12 항목
  - 충돌 대상: `spec/4-nodes/1-logic/2-switch.md §8.2` "신규 mode 추가 가이드라인" (특히 step 2, `requiredWhen.equals` 배열 갱신 안내)
  - 상세: §8.2 는 신규 mode 추가 시 backend `switchValue.requiredWhen.equals` 배열과 `warningRule.when` 표현식 동기화만 언급하고, override-track(`SwitchConfig`)의 하드코딩된 `mode === "value"` 비교는 동기화 대상 목록에 없다. 신규 mode(예: `'range'`)가 `requiredWhen.equals` 에 추가되어도 이 override-track 조건은 자동으로 따라가지 않으므로, 향후 auto-form 화이트리스트를 갱신하면서 override-track 을 빠뜨리는 회귀 여지가 생긴다. 다만 이는 신규 발생 문제라기보다 override-track 존재 자체가 안고 있던 기존 구조적 특성(수동 이중 유지보수)의 연장이며, 현재 diff 자체가 새로운 모순을 만드는 것은 아니다.
  - 제안: §8.2 step 2에 "override-track(`SwitchConfig`)의 `required={mode === "value"}` 도 함께 갱신" 한 줄 추가를 project-planner 후속 spec 갱신으로 고려 (본 diff 를 막을 사유는 아님).

## 요약

target diff 는 spec §8.1 이 명시한 `switchValue` requiredWhen 화이트리스트(`equals: ['value']`) 정책을, override-track(`SwitchConfig`) bespoke 컴포넌트에서 backend schema 와 동일한 mode 값 비교로 정확히 재현한다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 어느 영역에서도 기존 spec 과 직접 모순되는 지점은 없으며, `spec/3-workflow-editor/1-node-common.md §2.6` 의 2-track 렌더 SoT(override 잔존 목록에 `switch` 등재, override-track 이 auto-form 표현력 밖 요구를 다루는 존재 이유) 와도 충돌하지 않는다. 유일하게 짚을 점은 §8.2 신규 mode 추가 가이드라인이 override-track 재현분까지 명시적으로 다루지 않는다는 INFO 수준 문서 갭이며, 이는 이번 변경이 유발한 모순이 아니라 override-track 구조가 원래 가진 이중 유지보수 특성이다.

## 위험도

NONE
