# 부작용(Side Effect) 리뷰 결과

**리뷰 대상**: Auto-form `multiselect` widget 구현 (multiselect-widget-f72348)
**검토 일자**: 2026-05-26

---

## 발견사항

### [WARNING] 테스트 `beforeEach` 에서 전역 Zustand store 상태 변경 — 테스트 간 격리 미완성 가능성
- 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/__tests__/multi-select-widget.test.tsx` — `beforeEach` (line 69-71), 마지막 테스트 `"renders raw English labels under \`en\` locale"` (line 240-257)
- 상세: `beforeEach` 에서 `useLocaleStore.getState().setLocale("ko")` 를 호출해 전역 Zustand store 를 매 테스트 전 `"ko"` 로 초기화한다. 마지막 테스트(`renders raw English labels under \`en\` locale`)는 테스트 본문 내에서 `useLocaleStore.getState().setLocale("en")` 을 직접 호출하지만, 테스트가 끝난 후 store 를 원상복구(`"ko"` 또는 초기값)하는 코드가 없다. `beforeEach` 가 다음 테스트 전에 `"ko"` 로 재설정하므로 현재 파일 내에서는 격리가 유지된다. 그러나 같은 프로세스에서 이 파일 이후에 실행되는 다른 테스트 파일이 locale store 를 사용할 경우, vitest 의 모듈 캐싱 방식에 따라 `"ko"` 상태가 누수될 수 있다. vitest 기본 설정에서는 각 파일이 독립 worker 또는 isolate 로 실행되므로 실제 누수가 발생할 가능성은 낮지만, 동일 worker pool 내에서 공유될 경우 문제가 된다.
- 제안: `afterEach` (또는 `afterAll`)에서 `useLocaleStore.getState().setLocale("ko")` (혹은 store 초기값으로 reset)를 호출해 명시적 복구를 보장한다. 또는 vitest 의 `vi.resetModules()` / store reset API 를 활용해 store 상태를 완전히 격리한다.

---

### [INFO] `UiWidget` 타입 union 확장 — 기존 `pickWidget` 등 exhaustive switch/타입 체크 로직에 영향 가능성
- 위치: `codebase/frontend/src/lib/node-definitions/types.ts` (line 1193: `| "multiselect"` 추가)
- 상세: `UiWidget` 이 string literal union 이므로, 이 타입을 exhaustive 하게 처리하는 `switch` 문이나 TypeScript discriminated union narrowing 코드가 있다면 `"multiselect"` 케이스가 누락될 경우 컴파일 오류 또는 런타임 fallthrough 가 발생할 수 있다. `WIDGET_REGISTRY` 는 `Record<UiWidget, ComponentType<WidgetProps>>` 로 선언되어 있으므로 TypeScript 가 모든 키를 요구한다 — `widget-registry.ts` 에서 `multiselect: MultiSelectWidget` 이 이미 추가되어 있으므로 레지스트리 자체는 컴파일 오류 없이 통과한다. 다른 파일에서 `UiWidget` 을 exhaustive `switch` 로 처리하는 코드가 있을 경우 `"multiselect"` 케이스가 추가되었음을 개발자가 인지해야 한다.
- 제안: 코드베이스 내 `UiWidget` 을 exhaustive switch 로 처리하는 파일이 있다면 해당 파일에 `"multiselect"` 케이스 처리를 추가했는지 확인한다. TypeScript 컴파일이 통과한다면 안전하나, `never` 타입 체크(`assertNever`)를 사용하는 곳이 있으면 컴파일 단계에서 감지된다.

---

### [INFO] `WIDGET_REGISTRY` 모듈 초기화 부작용 — `registerWidgets` 호출이 모듈 로드 시 즉시 실행
- 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/widget-registry.ts` (line 627: `registerWidgets(WIDGET_REGISTRY)`)
- 상세: 파일 최하단에서 `registerWidgets(WIDGET_REGISTRY)` 를 모듈 최상위 레벨에서 호출한다. 이는 모듈이 import 될 때마다 `WIDGET_REGISTRY` 객체로 lazy resolver 를 업데이트하는 부작용을 일으킨다. 이 패턴은 기존에도 동일하게 존재했으며, 이번 변경으로 `multiselect` 키가 레지스트리에 추가되었을 뿐 새로운 부작용 패턴이 도입된 것은 아니다. 순환 참조 방지 목적의 의도된 설계임이 주석으로 명시되어 있다.
- 제안: 없음. 의도된 설계이며 기존 패턴과 동일.

---

### [INFO] `MultiSelectWidget` 의 `toggle` 클로저 — `selected` 는 props `value` 기반, 내부 상태 없음
- 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/widgets.tsx` — `MultiSelectWidget` (line 856-702)
- 상세: `toggle` 함수가 컴포넌트 렌더 시점의 `selected` (= `Array.isArray(value) ? value : []`) 를 클로저로 참조한다. 컴포넌트 내부에 별도의 `useState` 가 없으므로 `value` prop 이 변경될 때까지 동일한 `selected` 를 기반으로 토글이 계산된다. 이는 의도된 controlled component 패턴으로, 부모가 `onChange` 응답 후 `value` 를 업데이트하기 전에 동일한 체크박스를 두 번 클릭하면 두 번째 클릭은 첫 번째 클릭 이전의 상태를 기반으로 계산된다. 테스트 파일의 "emits the same option only once even on rapid double-toggle" 케이스가 이 동작을 의도적으로 문서화하고 있다.
- 제안: 없음. 의도된 controlled component 패턴이며 테스트에서 명시적으로 검증됨.

---

### [INFO] `plan/in-progress/spec-update-ai-error-output-fields.md` — `worktree: (assigned at impl-start)` 미지정
- 위치: `plan/in-progress/spec-update-ai-error-output-fields.md` (frontmatter)
- 상세: plan 파일의 `status: backlog` 이고 `worktree: (assigned at impl-start)` 로 실제 worktree 가 미지정된 상태로 `plan/in-progress/` 에 저장되어 있다. CLAUDE.md 의 plan 라이프사이클 규약에 따르면 `in-progress` 폴더의 plan 은 `worktree` 가 명시되어야 한다. `backlog` 상태인 plan 을 `in-progress/` 에 두는 것이 부작용이라기보다 규약 위반이나, 이 파일이 `in-progress/` 폴더에 생성됨으로써 추후 자동화 도구 또는 개발자가 해당 plan 을 활성 작업으로 혼동할 수 있다. 이는 이번 변경의 직접적인 코드 부작용은 아니다.
- 제안: `status: backlog` 인 plan 은 `plan/in-progress/` 대신 별도의 backlog 위치(또는 `plan/in-progress/` 에 두더라도 `worktree: N/A` 등으로 명시)에 두거나, CLAUDE.md 규약에 맞게 관리 방식을 확정한다.

---

## 요약

이번 변경은 frontend auto-form 에 `MultiSelectWidget` 컴포넌트를 추가하고 `UiWidget` 타입 union 에 `"multiselect"` 를 등록하는 신규 구현이다. 전반적으로 기존 widget 패턴(SelectWidget 등)을 그대로 따르고 있으며, 내부 상태를 두지 않는 controlled component 설계, immutable 토글 로직, `UnsupportedWidget` 대신 실제 위젯 컴포넌트로 대체 등 의도된 부작용만이 존재한다. 가장 주목할 부작용은 테스트 파일에서 전역 Zustand locale store 를 직접 변경하면서 파일 경계를 넘는 격리를 명시적으로 보장하지 않는 점이며, vitest 의 파일 격리 방식에 따라 실제 영향이 없을 수도 있으나 명시적 `afterEach` 복구를 권장한다. 나머지 항목은 모두 기존 패턴과 동일하거나 의도된 동작으로, 호출자에게 파급되는 인터페이스 변경이나 예상치 못한 전역 상태 변경·네트워크 호출·파일시스템 조작은 없다.

## 위험도

LOW
