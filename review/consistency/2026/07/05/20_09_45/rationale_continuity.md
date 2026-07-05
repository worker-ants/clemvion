# Rationale 연속성 검토 결과 — V-12 impl-done (SwitchConfig switchValue asterisk)

## 검토 대상

- target 커밋: `fc3c40b0f` (`feat(logic): V-12 Switch switchValue mode=value 필수 asterisk`), `git diff origin/main...HEAD`
- 핵심 변경: `codebase/frontend/src/components/editor/settings-panel/node-configs/logic-configs.tsx` — `SwitchConfig` 의 `switchValue` `ExpressionInput` 에 `required={mode === "value"}` 추가. `mode` 는 `(config.mode as string) ?? "value"` 로 정의된 로컬 변수.
- 신규 unit: `__tests__/switch-config.test.tsx` (mode=value→asterisk, mode 미지정(기본값)→asterisk, mode=expression→미노출) 3건.
- 근거 spec: `spec/4-nodes/1-logic/2-switch.md` §8 Rationale — §8.1 `switchValue.requiredWhen` 화이트리스트 정책, §8.2 신규 mode 추가 가이드라인.

## 발견사항

검토 대상 diff 범위에서 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복은 발견되지 않았다.

- **[INFO]** 화이트리스트 정책과 구현의 논리적 동치 확인 (문제 없음)
  - target 위치: `logic-configs.tsx:166` `required={mode === "value"}`
  - 과거 결정 출처: `spec/4-nodes/1-logic/2-switch.md §8.1` — "블랙리스트(`notEquals: 'expression'`) 대신 화이트리스트를 쓰는 이유: `mode` enum 에 신규 값이 추가될 때 블랙리스트는 신규 mode 에도 자동 적용되어 의도와 다르게 required 가 발화하는 hidden coupling 이 생긴다."
  - 상세: `mode === "value"` 는 backend `switch.schema.ts` 의 `ui.requiredWhen: { field: 'mode', equals: ['value'] }` 화이트리스트(단일값 `equals` 비교)와 논리적으로 동치인 명시적 whitelist 다. `mode !== "expression"` 형태의 blacklist 를 채택하지 않았으므로, §8.1 이 명시적으로 기각한 대안을 재도입하지 않았다. 신규 mode(`'range'` 등) 가 향후 enum 에 추가돼도 이 줄은 자동으로 asterisk 를 켜지 않는다 — §8.2 의도("신규 mode 에서 switchValue 가 필요하면 명시적으로 추가")와 정합.
  - 제안: 조치 불필요. 다만 `mode` enum 이 3개 이상으로 확장되는 시점에 이 줄(`mode === "value"`)을 `["value", <신규mode>].includes(mode)` 형태로 갱신해야 화이트리스트 의미(다중 값 opt-in)가 유지된다 — 후속 PR 체크리스트용 참고(필수 아님, §8.2 가이드라인이 이미 문서화하고 있어 새 Rationale 불필요).

- **[INFO]** 코드 주석의 Rationale 인용 정확성
  - target 위치: `logic-configs.tsx:163-166` 주석
  - 과거 결정 출처: `2-switch.md §8.1` 전체
  - 상세: 커밋 메시지와 코드 주석 모두 "기각된 blacklist(`notEquals:'expression'`) 아님"을 명시적으로 언급하며 §8.1 을 인용하고 있어, 향후 유지보수자가 실수로 blacklist 패턴으로 되돌릴 위험을 낮춘다. Rationale 추적성 측면에서 모범적인 패턴.
  - 제안: 조치 불필요.

- **[INFO]** override 트랙 2-track 아키텍처와의 정합
  - target 위치: `logic-configs.tsx` `SwitchConfig` 전체 (bespoke override 컴포넌트)
  - 과거 결정 출처: `spec/3-workflow-editor/1-node-common.md §2.6` (override vs auto-form 2-트랙 전략 — override 컴포넌트는 backend `ui` 힌트를 자동 소비하지 않고 수동 재현하는 것이 기존에 합의된 특성)
  - 상세: 이번 변경은 새 결정을 도입한 것이 아니라, 기존에 존재하던 gap(override 컴포넌트가 backend `requiredWhen` 힌트를 반영하지 못했던 부분)을 그 트랙의 기존 원칙(수동 동기화)대로 메운 것이다. `required` prop 은 순수 시각 표시이며, 런타임 검증은 기존과 동일하게 `NodeHandler.validate()` 가 담당 — §6 에러 코드 표의 기존 검증 경로를 우회하거나 중복 정의하지 않았다.
  - 제안: 조치 불필요.

## 요약

impl-done 시점의 최종 diff(`required={mode === "value"}` + 3 unit test)는 `2-switch.md §8.1` 이 확립한 화이트리스트 정책과 논리적으로 동치이며, §8.1 이 명시적으로 기각한 blacklist(`notEquals: 'expression'`) 패턴을 재도입하지 않았다. 커밋 메시지·코드 주석 모두 이 Rationale 을 정확히 인용하고 있어 추적성도 양호하다. 런타임 검증(`NodeHandler.validate`)과 시각 표시(asterisk)의 책임 분리 원칙(§6, node-common §2.6)도 그대로 유지된다. 이 변경으로 새 Rationale 을 작성할 필요가 있는 결정 번복은 없었으며, spec 변경도 불요하다는 커밋의 판단은 타당하다. Rationale 연속성 관점에서 위반 사항 없음.

## 위험도

NONE
