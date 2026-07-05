# Cross-Spec 일관성 검토 — V-12 switchValue asterisk (SwitchConfig)

## 검토 대상

`codebase/frontend/src/components/editor/settings-panel/node-configs/logic-configs.tsx` 의 `SwitchConfig` 에서 `switchValue` 렌더용 `ExpressionInput` 에 `required={mode === "value"}` 를 추가하는 1줄 변경. 목적은 `spec/4-nodes/1-logic/2-switch.md §8.1` 이 명시한 `ui.requiredWhen: { field: 'mode', equals: ['value'] }` 화이트리스트 asterisk 를, override 트랙 bespoke 폼에서도 렌더되게 하는 것.

## 발견사항

없음 (Critical/Warning/Info 레벨의 실질적 충돌 없음).

### 확인한 근거 (충돌 없음을 뒷받침)

1. **§2.6 (`spec/3-workflow-editor/1-node-common.md`) 2-트랙 렌더 전략과 정합** — `switch` 는 `OVERRIDE_REGISTRY` 에 등재된 override 트랙 노드(§2.6.3 트랙 배정 현황 표에 명시)다. `ui.requiredWhen` 은 auto-form 트랙(`SchemaForm`/`visibility.ts`)이 소비하는 DSL 이지만, override 트랙 컴포넌트는 동일 의도를 bespoke 코드로 수동 미러링해야 한다 — 이는 §2.6 신설 배경(R-2, 2026-06-10)이 명시한 문제의식("Switch 의 `requiredWhen`... 개별 노드 spec 이 단편적으로만 참조")과 정확히 일치한다. 이번 변경은 그 미러링 갭을 메우는 것이지 새 정책을 만드는 것이 아니다.

2. **switch §8.1/§8.2 Rationale 과 정합** — §8.1 은 asterisk 정책의 근거(화이트리스트 vs 블랙리스트)를, §8.2 는 신규 `mode` 추가 시 `switchValue.requiredWhen.equals` 배열 갱신 가이드를 이미 규정해 두고 있다. 코드 변경은 이 문서가 이미 규정한 대로 `mode === "value"` 조건을 그대로 반영한 것으로, 로직 자체("현재 `equals` 화이트리스트가 `['value']` 단일 항목"이므로 `mode === "value"` 로 동치)가 스펙과 일치한다. `mode` enum 이 향후 확장되면 이 인라인 조건도 `equals` 배열 전체와 동기화해야 하나, 이는 §8.2 가 이미 예견한 유지보수 포인트이며 이번 변경 범위 밖이다.

3. **backend lock 테스트와 무충돌** — `codebase/backend/src/nodes/logic/logic-ui-required.spec.ts` 는 스키마 `ui.requiredWhen` 값 자체(`{ field: 'mode', equals: ['value'] }`)만 잠그며 frontend 렌더링 방식은 검증 범위 밖이다. 이번 변경은 frontend-only 이고 스키마를 건드리지 않으므로 이 lock 테스트에 영향 없음.

4. **`ExpressionInput.required` 는 순수 시각적 asterisk** — `expression-input.tsx:360-364` 확인 결과 `required` prop 은 `<span className="text-red-500" aria-hidden>*</span>` 렌더만 하며 HTML `required` 속성이나 폼 제출 차단 로직과 무관하다. switch §1 필드 표의 "런타임 강제는 `NodeHandler.validate()` 소관" 서술과 책임 분리가 유지된다 — asterisk 추가가 `switch.handler.ts` 의 검증 로직(§6 에러 코드 표: `mode='value'` + `switchValue` 미설정 시 `In Value mode, Switch Value must be entered.`)과 중복되거나 충돌하지 않는다. 두 메커니즘(UI 힌트 vs 런타임 validate)은 이미 spec 상 별개 레이어로 문서화되어 있어 계층 책임 충돌 없음.

5. **다른 override-track 노드에 유사 선례 없음(리스크 아님)** — `if_else`, `loop`, `variable_declaration` 등 동일 override 트랙의 다른 bespoke 컴포넌트가 `ui.required`/`requiredWhen` 을 미러링하는지 여부는 이번 변경 스코프 밖이며, switch 한정 1줄 수정이 다른 노드의 기존 동작을 변경하지 않는다. 다만 동일 패턴(스키마 `ui.requiredWhen` 존재 + override 컴포넌트 미반영)이 다른 override 노드에도 잠재할 수 있음은 별도 후속 점검 후보로 남는다(본 변경의 차단 사유는 아님).

## 요약

이번 변경은 신규 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 을 도입하지 않으며, `spec/4-nodes/1-logic/2-switch.md §8.1`·`spec/3-workflow-editor/1-node-common.md §2.6` 이 이미 규정한 override 트랙 asterisk 정책을 코드에 뒤늦게 반영하는 정합 작업이다. 검토한 6개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 어디에서도 실질 충돌을 발견하지 못했다.

## 위험도

NONE
