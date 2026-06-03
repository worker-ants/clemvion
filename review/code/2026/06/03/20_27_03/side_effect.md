# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `$thread` 가 `BUILT_IN_PICKER_VARIABLES` 에 자동 포함됨
- **위치**: `codebase/frontend/src/components/editor/expression/expression-constants.ts` — `BUILT_IN_PICKER_VARIABLES` 정의 (라인 116–128)
- **상세**: `BUILT_IN_PICKER_VARIABLES` 는 `ROOT_VARIABLES` 를 필터(`$input`, `$node`, `$var` 제외)·map 하여 도출되는 파생 상수다. `ROOT_VARIABLES` 에 `$thread` 를 추가하면 `BUILT_IN_PICKER_VARIABLES` 에도 자동으로 `$thread` 항목이 포함된다. 이는 의도된 동작(variable picker 에 `$thread` 노출)과 일치하므로 올바른 연쇄 부작용이다. 단, 이 파생 관계가 명시적으로 문서화되어 있지 않아 미래 기여자가 `ROOT_VARIABLES` 수정 시 picker 영향을 예측하지 못할 수 있다.
- **제안**: 추가 조치는 불필요하나, `BUILT_IN_PICKER_VARIABLES` 의 주석에 "이 배열은 `ROOT_VARIABLES` 에서 자동 파생된다" 를 명시하면 유지보수성이 높아진다.

### [INFO] `$thread` 에 `scopeKey` 없음 — 전역 표시
- **위치**: `codebase/frontend/src/components/editor/expression/expression-constants.ts` 라인 74
- **상세**: 추가된 항목 `{ label: "$thread", ..., isExpandable: true }` 에 `scopeKey` 가 없다. `filterRootVariablesByScope` 는 `scopeKey` 가 없는 항목을 스코프 필터링 없이 항상 포함한다. 즉 `$thread` 는 루프·foreach 컨테이너 외부를 포함한 모든 노드의 자동완성·variable picker 에 노출된다. 백엔드 expression resolver 가 `$thread` 를 주입하는 컨텍스트(AI Agent 노드 등)와 실제로 일치하는지 확인이 필요하다. 백엔드가 `$thread` 를 주입하지 않는 노드에서 사용자가 이 변수를 선택해 표현식을 작성하면 런타임에 `undefined` 가 된다.
- **제안**: AI Agent 컨텍스트에서만 유효한 변수라면 `ContainerScopeFlags` 에 `hasThread` 플래그를 추가하거나 `$thread` 를 조건부 표시하는 별도 메커니즘을 검토한다. (현재 spec-sync plan 기록 상 백엔드는 이미 `$thread` 를 주입하므로 우선순위는 낮음)

### [INFO] `plan/complete/` 파일 신규 생성 — 파일시스템 부작용
- **위치**: `plan/complete/spec-draft-*.md`, `plan/complete/spec-fix-*.md`, `plan/complete/spec-sync-*-gaps.md` 등 12개 파일
- **상세**: 모두 `plan/complete/` 디렉토리에 새로 생성된 완료 plan 문서다. plan-lifecycle 규약에 따라 완료된 작업을 `plan/complete/` 로 이동하는 정상 절차이며, 의도치 않은 파일시스템 부작용은 없다.

### [INFO] `plan/in-progress/` 파일 수정 — 체크박스·재분류 메모 추가
- **위치**: 파일 16–23 (`spec-sync-carousel-gaps.md`, `spec-sync-data-common-gaps.md`, 등)
- **상세**: 기존 in-progress plan 파일에 `## ⚠ 재분류` 섹션을 추가하여 해당 항목이 planner 결정 필요 버킷임을 명시한다. 파일 상태(체크박스 `[ ]`)는 변경하지 않으므로 기존 상태 추적에 영향이 없다. 파일 18(`spec-sync-embedding-pipeline-gaps.md`)만 `§4.3` 항목을 `- [ ]` → `- [x]` 로 변경(구현 완료)하고 구현 상태 섹션을 재작성하며, `§6.1` 항목은 미구현으로 유지한다. 이는 의도된 spec 정합 갱신이다.

### [INFO] `spec/` 파일 frontmatter `status` 변경 — 공개 인터페이스 영향 가능
- **위치**: 파일 24–27, 29–31, 38 (여러 spec 파일의 `status: partial → implemented` + `pending_plans` 제거)
- **상세**: spec frontmatter `status` 는 spec-drift gate(`harness`) 및 spec-coverage 도구가 참조하는 메타데이터다. `partial → implemented` 로 변경하면 이 spec 에 대해 gate 가 "구현 완료"로 판단하며, 향후 `impl-done 강제화` gate 가 미구현 갭 발견 시 flag 할 수 없게 된다. 각 변경 파일의 gaps ticket(`pending_plans`) 도 함께 제거되므로, 실제로 잔여 미구현 surface 가 존재하는 경우 추적이 끊긴다. 검토 결과 모든 flip 은 해당 gaps ticket 의 미구현 항목이 모두 `[x]` 로 체크된 상태에서 수행됐거나(완전 해소), in-progress gap ticket 은 그대로 유지한다(`pending_plans` 에서만 제거, ticket 파일 자체는 잔존). 따라서 직접적인 추적 단절 위험은 낮다.

## 요약

이번 변경의 실질적 코드 변경은 `expression-constants.ts` 의 `ROOT_VARIABLES` 배열에 `$thread` 항목 한 줄 추가에 한정된다. 이 변경은 `BUILT_IN_PICKER_VARIABLES` 파생 상수에 자동으로 전파되는 연쇄 부작용이 있으나 이는 의도된 동작이다. `$thread` 에 `scopeKey` 가 없어 모든 노드 컨텍스트에 표시되는 점은 백엔드 주입 범위와 불일치할 경우 UX 상 노이즈가 될 수 있으나 런타임 오류를 유발하지는 않는다. 나머지 변경은 전부 `plan/` 및 `spec/` Markdown 문서 갱신으로, 전역 변수·외부 서비스 호출·환경 변수·이벤트·시그니처 변경 등의 부작용은 없다. spec frontmatter `status` 변경이 harness gate 동작에 영향을 미치나, gaps ticket 파일 자체는 유지되므로 실질적 추적 단절은 없다.

## 위험도

LOW
