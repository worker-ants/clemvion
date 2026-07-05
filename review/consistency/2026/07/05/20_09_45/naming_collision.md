# 신규 식별자 충돌 검토 — V-12 Switch switchValue asterisk (impl-done)

## 검토 대상

`git diff origin/main...HEAD` 기준 실질 변경분:

- `codebase/frontend/src/components/editor/settings-panel/node-configs/logic-configs.tsx` — `SwitchConfig` 의 `switchValue` `ExpressionInput` 에 `required={mode === "value"}` prop 값 4줄 추가(spec 인용 주석 포함).
- `codebase/frontend/src/components/editor/settings-panel/node-configs/__tests__/switch-config.test.tsx` — 신규 unit 테스트 파일(3 케이스: mode=value/미지정 기본값/mode=expression).
- `CHANGELOG.md`, `plan/in-progress/spec-code-cross-audit-2026-06-10.md` — 문서 갱신(V-12 체크 완료 반영).

target 은 `SwitchConfig` prop(`required`)에 boolean 값을 조건부로 전달하는 배선(wiring) 변경으로, **신규 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·config key·spec 파일을 전혀 도입하지 않는다.**

## 점검 관점별 확인 결과

1. **요구사항 ID 충돌** — 신규 spec ID 부여 없음. `V-12` 는 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 에 이미 존재하던 항목 라벨이며 이번 커밋은 그 체크박스만 완료 처리. 해당 없음.
2. **엔티티/타입명 충돌** — 새 타입/인터페이스/DTO 없음. `Config = Record<string, unknown>` 기존 타입 그대로 사용.
3. **API endpoint 충돌** — 새 endpoint 없음. 백엔드 변경 없음(`switch.schema.ts` 등 불변, `git diff --stat` 상 backend 파일 0건).
4. **이벤트/메시지명 충돌** — 새 webhook/queue/SSE 이벤트 없음.
5. **환경변수·설정키 충돌** — 새 ENV var·config key 없음. `mode`/`switchValue` 는 `switch.schema.ts`(`switchNodeConfigSchema`)에 이미 정의된 기존 키.
6. **파일 경로 충돌** — 신규 파일은 `__tests__/switch-config.test.tsx` 1개뿐. 동일 디렉터리의 기존 테스트 컨벤션(`node-configs/__tests__/*-config.test.tsx`, 예: `if-else-config.test.tsx` 류)과 파일명 패턴이 일치하며 기존 파일과 이름이 겹치지 않는다(`find` 확인 결과 신규 생성, 덮어쓰기 아님).

## 재사용된 기존 식별자 교차 확인 (충돌 아님)

- `required` prop — `codebase/frontend/src/components/editor/expression/expression-input.tsx:28,71,360-361` 에 이미 정의된 기존 optional prop(`<span className="ml-0.5 text-red-500" aria-hidden>` asterisk 렌더). `shared.tsx` 의 `SelectField`/`NumberField`/`CheckboxField` 등도 동일 이름·의미로 `RequiredMark`(`shared.tsx:14-17`, 동일 `text-red-500` 클래스)를 렌더 — 프런트엔드 전역에서 일관된 단일 의미(순수 시각적 asterisk, HTML `required` 속성이나 폼 제출 차단과 무관)로만 쓰인다. 이번 변경은 이 기존 prop 에 `mode === "value"` 값을 새로 전달할 뿐, prop 명이나 의미를 새로 만들지 않는다.
- `ui.requiredWhen` — `spec/4-nodes/1-logic/2-switch.md` §1 config 표(21행) 및 §8.1 Rationale 에 이미 `{ field: 'mode', equals: ['value'] }` 로 정의된 기존 SoT 어휘(`spec/3-workflow-editor/1-node-common.md` §2.6.1 UiHint DSL 등재). 코드 변경은 이 기존 정의를 override 트랙에서 재현할 뿐 새 정책을 도입하지 않는다.
- `mode`, `switchValue` — `switch.schema.ts`(`switchNodeConfigSchema`)가 SoT 인 기존 config 필드. 이미 여러 곳(케이스 UI 전환 등)에서 `mode === "value"` 분기가 쓰이고 있어 의미 충돌 없음.
- 테스트 파일 내 `describe`/`it` 제목, `RequiredMark` 클래스 셀렉터(`span.text-red-500`) 모두 기존 컨벤션을 그대로 따름.

## 이전 --impl-prep 검토와의 정합

동일 세션 계열의 `review/consistency/2026/07/05/19_55_49/naming_collision.md` (--impl-prep 단계)가 이미 "신규 식별자 도입 없음, 위험도 NONE" 으로 결론지었으며, 실제 구현(diff) 은 그 계획을 그대로 따랐다. 계획과 실제 구현 사이에 naming 관점의 이탈은 없다.

## 발견사항

없음. 신규 식별자가 도입되지 않아 충돌 여지가 구조적으로 없다.

## 요약

target 변경(`SwitchConfig` `switchValue` `ExpressionInput` 에 `required={mode === "value"}` 추가 + 신규 unit 테스트 1개)은 `spec/4-nodes/1-logic/2-switch.md §8.1`·`spec/3-workflow-editor/1-node-common.md §2.6` 이 이미 정의해 둔 `ui.requiredWhen` 화이트리스트 asterisk 정책을, auto-form 트랙이 아닌 override(bespoke) 트랙 컴포넌트에서 기존 `required` prop 값 전달로 수동 재현하는 배선(wiring) 수정이다. 요구사항 ID·엔티티/타입·API endpoint·이벤트명·환경변수/config key·spec 파일 경로 중 어느 층위에서도 신규 식별자가 도입되지 않았으며, 사용된 모든 이름(`required`, `mode`, `switchValue`, `requiredWhen`)은 각각 프런트엔드 기존 prop 컨벤션, `switch.schema.ts`, `1-node-common.md §2.6.1` 에 이미 확립된 동일 의미로 재사용된다. 신규 식별자 충돌 관점에서는 검토 대상 자체가 존재하지 않는 사실상 no-op 케이스이며, 사용자가 사전에 예상한 바("신규 식별자 없음 예상")와 일치한다.

## 위험도

NONE
