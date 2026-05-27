# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `MultiSelectWidget` JSDoc — 특정 구현에 묶인 참조

- 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/widgets.tsx` L648–655 (추가된 JSDoc)
- 상세: JSDoc 본문이 "AI 노드 `systemContextSections` 4개 섹션 (time / timezone / workspace / node)" 을 직접 언급한다. `MultiSelectWidget` 은 범용 `array<enum>` 위젯으로 `WIDGET_REGISTRY` 에 등록되어 다른 노드에서도 재사용될 수 있다. 현재 문서가 특정 구현 사례에 묶여 있으면 향후 사용자가 범용성을 오해할 수 있다.
- 제안: "현재 AI 노드 `systemContextSections` 에서 사용됨" 형태의 사용 예시(example use) 로 남기거나, 첫 단락을 범용 설명("array-of-string schema field 를 수직 체크박스 목록으로 렌더하는 범용 위젯") 으로 쓰고 구체 사례는 `@example` 또는 보조 문장으로 분리하는 방향 권장.

---

### [INFO] `UiHint.widget` 에 `"multiselect"` 추가 — 타입 JSDoc 내 위젯 목록 미언급

- 위치: `codebase/frontend/src/lib/node-definitions/types.ts` L1251 `UiHint` 타입 정의 (변경 라인 L1193 인근)
- 상세: `UiHint` 타입 본문 및 그 위 타입 주석에 각 widget 종류별 설명이 없다. `multiselect` 가 추가됐을 때 "어떤 schema 구조(array + items.enum)가 이 widget 과 매칭되는지" 를 JSDoc/주석으로 명시하면 향후 노드 정의자가 올바르게 사용할 수 있다. 현재는 동작을 알려면 `widgets.tsx` 구현을 직접 읽어야 한다.
- 제안: `UiWidget` 유니온 타입 위 또는 `UiHint` 의 `widget?` 필드 주석에 간단한 매핑 테이블이나 설명을 추가 (`multiselect` — `array<string>` 스키마, 수직 체크박스 목록). 필수는 아니나 타입 파일이 API 문서 역할을 하는 구조이므로 권장.

---

### [INFO] `WIDGET_REGISTRY` JSDoc — `multiselect` 미언급

- 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/widget-registry.ts` L596–602 (기존 JSDoc)
- 상세: `WIDGET_REGISTRY` 의 기존 JSDoc 은 `LlmConfigSelectorWidget` 등 "first-class selector" 와 `UnsupportedWidget` fallback 에 대해 설명하지만, 새로 추가된 `multiselect` 에 대한 언급이 없다. 낮은 영향이지만 문서가 레지스트리의 완전한 그림을 전달하지 못한다.
- 제안: `multiselect` 등 inline checkbox-list 위젯을 별도로 설명할 필요는 없으나, 필요 시 JSDoc 마지막에 "일반 inline 위젯(`multiselect`, `select`, …)은 `widgets.tsx` 에 구현됨" 형태의 한 줄 안내를 추가 가능. (선택 사항)

---

### [INFO] 테스트 파일 최상단 주석 — spec 링크 상대경로 깊이 확인 필요

- 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/__tests__/multi-select-widget.test.tsx` L2–4
- 상세: 파일 최상단 주석의 spec 링크 `../../../../../../spec/4-nodes/3-ai/0-common.md` 가 테스트 파일의 실제 경로 기준으로 올바른 상대경로인지 확인이 필요하다. `__tests__/` 폴더 위치를 기준으로 6단계 상위라면 `codebase/` 루트 위를 가리킬 수 있다. 경로가 잘못되면 주석의 hyperlink 가 IDE/툴에서 해석 불가 상태가 된다.
  - 파일 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/__tests__/`
  - 6단계 상위 이동: `__tests__` → `auto-form` → `settings-panel` → `editor` → `components` → `src` → `frontend` (7단계면 `codebase/` 밖)
  - 실제로는 6개 `../` 가 `codebase/frontend/` 루트를 가리키므로, `spec/` 폴더는 모노레포 루트에 있어 경로가 한 단계 더 필요하다 (`../../../../../../..`).
- 제안: 상대경로를 `../../../../../../../spec/4-nodes/3-ai/0-common.md` 로 수정하거나, 절대 경로 표기 불가 환경이면 `[Spec AI Common §11](spec/4-nodes/3-ai/0-common.md)` 형태의 repo-root 상대 링크로 기재하는 관례를 도입 권장. 이 주석이 실제 클릭 가능한 링크로 쓰이지 않는다면 영향은 낮다.

---

### [INFO] `plan/in-progress/auto-form-multiselect-widget.md` — 작업 체크리스트 미완료 상태 그대로 PR 진입

- 위치: `plan/in-progress/auto-form-multiselect-widget.md` 작업 체크리스트
- 상세: 체크리스트 항목이 모두 `[ ]` (미완료) 상태다. 실제로 구현이 완료된 PR 이라면 완료 항목은 `[x]` 로 표시하고, plan 파일을 `plan/complete/` 로 이동시켜야 한다 (`plan-lifecycle.md` 규약). 현재 상태는 PR 의 완료 시점을 반영하지 못한다.
- 제안: 완료된 항목 `[x]` 표시 후 `git mv plan/in-progress/auto-form-multiselect-widget.md plan/complete/auto-form-multiselect-widget.md` 수행 (PR merge 시점 또는 merge 직전).

---

### [INFO] `within` import 미사용

- 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/__tests__/multi-select-widget.test.tsx` L38
- 상세: `import { ..., within } from "@testing-library/react"` 에서 `within` 이 어떤 테스트 케이스에서도 사용되지 않는다. 사용되지 않는 import 는 코드의 의도를 흐리고, lint(`no-unused-vars`/`@typescript-eslint/no-unused-vars`) 경고 대상이 된다.
- 제안: `within` 을 import 목록에서 제거.

---

## 요약

이번 변경은 `MultiSelectWidget` 구현 누락 보완 성격의 좁은 범위 PR 이다. 핵심 공개 함수(`MultiSelectWidget`)에 JSDoc 이 적절히 작성되어 있고, `WIDGET_REGISTRY` 에도 기존 주석 구조가 유지된다. `plan/in-progress` 의 DOCUMENTATION 매핑 섹션이 i18n·README·API 문서 갱신 불필요 근거를 명시적으로 기록한 점은 긍정적이다. 다만 JSDoc 이 범용 위젯임에도 특정 노드 사례에 묶여 기술되어 있고, `UiWidget` 타입에 `multiselect` 의 예상 schema 구조가 문서화되지 않아 향후 사용자가 올바른 schema 조합을 파악하려면 구현 코드를 직접 읽어야 하는 경계가 남는다. 테스트 파일의 spec 상대경로 오류 가능성과 미사용 `within` import, plan 파일 체크리스트 미갱신은 모두 INFO 수준으로 즉시 차단 사항은 없다.

## 위험도

LOW
