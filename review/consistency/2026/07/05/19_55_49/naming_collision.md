# 신규 식별자 충돌 검토 — spec/4-nodes/1-logic/

## 검토 범위 확인

target 은 `spec/4-nodes/1-logic/` 전체(0-common·1-if-else·2-switch·10-parallel·11-merge·12-background 등, 모두 `status: implemented`)이며, 실제 작업 트리 diff 를 확인한 결과 이번 --impl-prep 이 겨냥하는 실질 변경분은 다음 한 곳뿐이다.

- `codebase/frontend/src/components/editor/settings-panel/node-configs/logic-configs.tsx` — `SwitchConfig` 의 `switchValue` `ExpressionInput` 에 `required={mode === "value"}` 4줄 추가(spec §2-switch.md 인용 주석 포함).
- 신규 unit 테스트 파일 `__tests__/switch-config.test.tsx` (미추적).

즉 본 변경은 **신규 식별자를 전혀 도입하지 않는다** — 기존 spec 문서(`ui.requiredWhen`), 기존 프런트엔드 prop(`required`), 기존 config 필드(`mode`, `switchValue`)를 그대로 재사용해 override 트랙 컴포넌트에서 auto-form 트랙의 동일 동작을 재현하는 배선(wiring) 작업이다.

## 점검 관점별 확인 결과

1. **요구사항 ID 충돌** — 새 요구사항 ID 부여 없음(코드 변경만, 신규 spec ID 없음). 해당 없음.
2. **엔티티/타입명 충돌** — 새 타입/인터페이스 없음. `Config = Record<string, unknown>` 기존 타입 재사용.
3. **API endpoint 충돌** — 새 endpoint 없음.
4. **이벤트/메시지명 충돌** — 새 이벤트/메시지 없음.
5. **환경변수·설정키 충돌** — 새 config key 없음. `mode`/`switchValue`는 `switch.schema.ts`(`switchNodeConfigSchema`)에 이미 정의된 기존 키.
6. **파일 경로 충돌** — 새 spec 파일 없음. 신규 테스트 파일 `__tests__/switch-config.test.tsx` 는 프런트엔드 기존 컨벤션(`node-configs/__tests__/*.test.tsx`)과 일치, 충돌 없음.

## 교차 검증한 기존 정의 (충돌 아님을 확인한 근거)

- `ui.requiredWhen` — `spec/4-nodes/1-logic/2-switch.md` §1 에서 이미 `ui.requiredWhen: { field: 'mode', equals: ['value'] }` 로 정의되어 있고, `spec/3-workflow-editor/1-node-common.md` §2.6.1 (`UiHint DSL`)이 이를 **정식 SoT 어휘**로 등재 — "`required` / `requiredWhen` — UI 필수 표시(asterisk)... (Switch 의 `requiredWhen` ... 개별 노드 spec 이 단편적으로만 참조해 왔다)"로 명시적으로 Switch 사례를 인용한다. 이번 변경은 이 기존 SoT 정의를 override 트랙(bespoke 컴포넌트)에서 재현하는 것뿐이며 새 의미를 만들지 않는다.
- `required` prop — 프런트엔드 `shared.tsx`(SelectField/NumberField/CheckboxField 등)와 `expression-input.tsx` 전반에서 이미 동일 의미(`RequiredMark` 렌더 + `aria-required`)로 광범위하게 재사용되는 기존 prop. 이번 변경은 동일 prop 을 `ExpressionInput`에 새로 값 전달할 뿐, 새 prop 명이나 새 의미를 도입하지 않는다.
- `mode`/`switchValue` — `switch.schema.ts` `switchNodeConfigSchema` 가 SoT 인 기존 config 필드. 코드가 이미 `mode === "value"` 분기를 여러 곳에서 사용 중(케이스 UI 전환 등, §2 참조)이며 이번 추가와 의미 충돌 없음.

## 발견사항

없음. 신규 식별자가 도입되지 않아 충돌 여지가 구조적으로 없다.

## 요약

이번 target 변경은 `spec/4-nodes/1-logic/2-switch.md`에 이미 정의돼 있던 `ui.requiredWhen` 화이트리스트 동작을, 해당 노드가 auto-form 트랙이 아닌 override(bespoke) 트랙에 있어 자동 적용되지 않던 것을 `SwitchConfig` 컴포넌트에서 기존 `required` prop 으로 수동 재현하는 4줄짜리 배선 수정이다. 새 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·config key·spec 파일 경로 중 어느 것도 신규 도입되지 않았으며, 사용된 모든 식별자(`requiredWhen`, `required`, `mode`, `switchValue`)는 각각 `spec/3-workflow-editor/1-node-common.md` §2.6.1, 프런트엔드 `shared.tsx`/`expression-input.tsx`, `switch.schema.ts` 에 이미 확립된 동일 의미로 재사용된다. 신규 식별자 충돌 관점에서는 검토 대상 자체가 존재하지 않는 사실상 no-op 케이스다.

## 위험도

NONE
