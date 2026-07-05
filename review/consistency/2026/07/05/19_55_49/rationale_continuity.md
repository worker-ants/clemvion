# Rationale 연속성 검토 결과 — V-12 (SwitchConfig switchValue asterisk)

## 검토 대상

- target 코드: `codebase/frontend/src/components/editor/settings-panel/node-configs/logic-configs.tsx` — `SwitchConfig` 의 `switchValue` `ExpressionInput` 에 `required={mode === "value"}` 추가 (현재 working-tree diff, 신규 테스트 `__tests__/switch-config.test.tsx` 동반).
- 근거 spec: `spec/4-nodes/1-logic/2-switch.md` §1 (config 표) + §8 Rationale (§8.1 `switchValue.requiredWhen` 화이트리스트 정책, §8.2 신규 mode 추가 가이드라인).
- 관련 SoT: `codebase/backend/src/nodes/logic/switch/switch.schema.ts` (`switchValue.meta({ ui: { requiredWhen: { field: 'mode', equals: ['value'] } } })`), `spec/3-workflow-editor/1-node-common.md` §2.6 (override vs auto-form 2-트랙 전략, `requiredWhen` DSL 정의).

## 발견사항

검토 대상 범위에서 Rationale 위반·기각된 대안의 재도입·무근거 번복은 발견되지 않았다.

- **[INFO]** 화이트리스트 조건과의 정합 확인 (문제 없음, 참고용 기록)
  - target 위치: `logic-configs.tsx:166` `required={mode === "value"}`
  - 과거 결정 출처: `spec/4-nodes/1-logic/2-switch.md §8.1` — "블랙리스트(`notEquals: 'expression'`) 대신 화이트리스트(`equals: ['value']`)를 쓰는 이유: `mode` enum 에 신규 값이 추가될 때 블랙리스트는 신규 mode 에도 자동 적용되어 의도와 다르게 required 가 발화하는 hidden coupling 이 생긴다."
  - 상세: `mode === "value"` 는 `equals: ['value']` 화이트리스트와 논리적으로 동치인 명시적 whitelist 비교다 (`mode !== "expression"` 형태의 blacklist 가 아니다). §8.1 이 명시적으로 기각한 대안(blacklist)을 재도입하지 않았다. 신규 mode(`'range'` 등) 추가 시에도 이 코드는 자동으로 asterisk 를 켜지 않으므로 §8.2 가이드라인("신규 mode 에서 switchValue 가 필요하면 배열에 명시 추가")과 일치 — 다만 이 bespoke override 컴포넌트는 배열이 아닌 단일 문자열 비교이므로, 향후 실제로 `mode` enum 이 확장될 경우 이 줄도 `["value", "range"].includes(mode)` 식으로 함께 갱신해야 화이트리스트 의미가 유지된다. 코드 주석(163~166행)이 이미 §8.1 인용 및 화이트리스트 취지를 명시하고 있어 이 부분은 향후 유지보수자에게 잘 전달된다.
  - 제안: 현재로선 조치 불필요. 다만 향후 `mode` enum 이 3개 이상으로 늘어나는 PR 리뷰 시 이 줄이 배열 `.includes()` 형태로 갱신되는지 체크리스트에 추가하면 §8.2 가이드라인 준수가 더 견고해진다 (선택적 INFO, 필수 아님).

- **[INFO]** override 트랙과 auto-form SoT 간 이중 표현 (기존에 이미 알려진 trade-off, 신규 아님)
  - target 위치: `logic-configs.tsx:163-166` (bespoke 컴포넌트에서 backend `requiredWhen` 힌트를 수동 재현)
  - 과거 결정 출처: `spec/3-workflow-editor/1-node-common.md` §2.6 (override vs auto-form 2-트랙 전략) — `switch` 는 override 잔존 목록에 명시되어 있어 (§2.6 "override 잔존" 표), bespoke 컴포넌트가 backend `ui` 힌트를 자동 소비하지 않고 수작업으로 동기화하는 것이 이 트랙의 알려진 특성이다.
  - 상세: 이는 기각된 결정의 재도입이 아니라, 기존에 합의된 아키텍처(override 트랙은 backend 스키마 힌트를 자동 렌더하지 않고 수동 구현) 의 정상적인 적용 사례다. target 변경은 오히려 이 아키텍처 하에서 backend SoT(`requiredWhen`)와 프런트 UI 간의 기존 drift(스펙 §1 표·§8.1 은 `requiredWhen` 을 문서화했지만 실제 override 컴포넌트에는 asterisk 가 없었던 gap)를 해소하는 방향이다.
  - 제안: 조치 불필요. 참고로 기록.

## 요약

target 변경(`required={mode === "value"}`)은 `2-switch.md §8.1` 이 규정한 화이트리스트 정책(신규 mode 에 자동 적용되지 않는 명시적 `equals` 비교)과 정확히 일치하며, §8.1 이 명시적으로 기각한 blacklist(`notEquals: 'expression'`) 패턴을 재도입하지 않는다. `required` prop 은 순수 UI asterisk 이며 런타임 강제는 기존 `NodeHandler.validate()` 경로(§6 에러 코드 표)에 남아있어 `1-node-common.md §2.6` 의 "런타임 강제는 validate() 소관" 원칙도 그대로 유지된다. Rationale 연속성 관점에서 위반·번복 사항은 발견되지 않았다.

## 위험도

NONE
