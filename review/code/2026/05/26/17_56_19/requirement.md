# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] 테스트 파일에 `within` 임포트가 있으나 사용되지 않음
- 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/__tests__/multi-select-widget.test.tsx` 6번 줄
- 상세: `import { render, screen, fireEvent, within } from "@testing-library/react"` 에서 `within` 이 어떤 테스트에서도 호출되지 않는다. 린트 규칙에 따라 `no-unused-vars` 경고를 발생시킬 수 있다.
- 제안: `within` 을 임포트에서 제거한다.

### [INFO] "rapid double-toggle" 테스트의 주석과 실제 검증 범위 불일치
- 위치: `multi-select-widget.test.tsx` 260~280번 줄
- 상세: 테스트 이름이 "emits the same option only once even on rapid double-toggle" 이고 주석에서 "두 번째 클릭" 시나리오를 설명하지만, 실제로 `fireEvent.click` 은 1회만 호출된다. 두 번째 클릭이 발생할 때 어떤 값이 emit 되는지는 검증하지 않는다. 주석은 두 번째 emit 까지 설명하지만 첫 번째 emit 만 어서션한다. 테스트 이름과 검증 범위가 어긋난다.
- 제안: 테스트 이름을 "toggling a checked option calls onChange exactly once per click" 처럼 실제 검증 내용에 맞게 수정하거나, 두 번째 `fireEvent.click` 과 해당 어서션을 추가한다.

### [WARNING] `schema.items` 가 `undefined` 일 때 옵션 폴백 경로 누락
- 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/widgets.tsx` `MultiSelectWidget` 함수 내 `rawOptions` 계산부
- 상세: 코드는 `schema.items?.enum` → `schema.enum` → `[]` 순으로 폴백한다. `schema.items` 가 존재하지만 `enum` 을 갖지 않고 `properties` 를 갖는 경우 (예: 배열 of 객체), `schema.items.enum` 이 배열이 아니므로 `schema.enum` 으로 폴백한다. 이 경우 `schema.enum` 도 없으면 빈 체크박스 리스트를 렌더하게 된다. 이 자체는 graceful 처리이지만, `FieldArrayWidget` 이 더 적합한 배열-of-objects 케이스를 `MultiSelectWidget` 에서 조용히 처리하려는 혼동이 생길 수 있다. spec §11.1 에서 `systemContextSections` 는 `z.enum(['time', 'timezone', 'workspace', 'node'])` 이므로 현재 사용 케이스에서는 문제가 없다. 다른 노드의 배열-of-objects 가 `widget: 'multiselect'` 로 선언될 경우 빈 체크박스 리스트가 노출된다.
- 제안: 현재 사용 케이스(spec §11.1) 기준으로는 수용 가능. 향후 확장 시 `schema.items.properties` 가 있을 때 경고 로그를 남기거나 `UnsupportedWidget` 으로 위임하는 방어 코드를 검토한다.

### [INFO] spec §11.1 필드명과 구현 일치 확인 — 충족
- 위치: spec `spec/4-nodes/3-ai/0-common.md §11.1` 및 `system-context-schema.ts`
- 상세: spec §11.1 은 `systemContextSections: String[]` 허용 값 `time / timezone / workspace / node` 를 정의한다. backend `system-context-schema.ts:64` 는 `z.array(z.enum(['time', 'timezone', 'workspace', 'node']))` 로 일치한다. frontend `MultiSelectWidget` 은 `ui.options` (backend 가 전달하는 `SECTION_OPTIONS`) 또는 `schema.items.enum` 폴백으로 동일한 값 집합을 렌더한다. 위젯 타입 `widget: 'multiselect'` 는 `system-context-schema.ts:69` 와 `UiWidget` 타입 및 `WIDGET_REGISTRY` 에 모두 일치한다.

### [INFO] spec §11.1 기본값 `['time', 'timezone']` 의 UI 처리
- 위치: `MultiSelectWidget` 컴포넌트, spec §11.1
- 상세: spec §11.1 의 `systemContextSections` 기본값은 `['time', 'timezone']` 이다. 기본값은 backend schema 에서 처리되고(`z.array(...).default([...SYSTEM_CONTEXT_DEFAULT_SECTIONS])`), frontend 위젯은 부모로부터 전달된 `value` prop 을 그대로 표시한다. `value` 가 `undefined` 또는 `null` 일 때 빈 배열로 처리하는 방어 로직(`Array.isArray(value) ? value : []`)이 있어 graceful 처리된다. 단, 실제 DB row 가 default 를 갖고 있지 않은 경우(기존 row — spec §11.1 "기존 row 해석 정책" 참조) backend 가 default 를 주입하므로 frontend 에서 추가 처리는 불필요하다.

### [INFO] plan 체크리스트 항목이 체크되지 않은 상태로 리뷰에 포함됨
- 위치: `plan/in-progress/auto-form-multiselect-widget.md` 작업 체크리스트
- 상세: `- [ ] TEST WORKFLOW: lint / unit / build / e2e`, `- [ ] REVIEW WORKFLOW: /ai-review` 가 unchecked 상태다. 리뷰 요청 시점에 체크리스트 갱신이 이루어지지 않았다. 기능 구현 관점에서는 영향 없으나 plan 라이프사이클 정합성 측면에서 완료 후 체크 마킹이 필요하다.

---

## 요약

변경 set (파일 4종: `types.ts` `UiWidget` 추가, `widgets.tsx` `MultiSelectWidget` 구현, `widget-registry.ts` 등록, 테스트 신규 추가) 은 spec `spec/4-nodes/3-ai/0-common.md §11.1` 의 `systemContextSections` UI 요구사항을 충족한다. `widget: 'multiselect'` 식별자, 4개 섹션 옵션 (`time/timezone/workspace/node`), 기본 배열 값 처리, 빈/null/undefined 입력 graceful 처리, KO/EN 번역 폴백, hint 번역 모두 spec 및 backend 정의와 line-level 로 일치한다. 테스트는 주요 동작 경로 (체크 상태, 토글 추가·제거, 폴백, 번역, 엣지 케이스) 를 적절히 커버한다. "rapid double-toggle" 테스트 이름과 실제 검증 범위의 불일치(WARNING 1건)와 미사용 `within` 임포트(INFO 1건)가 존재하나 기능 요구사항 충족에는 영향이 없다.

## 위험도

LOW
