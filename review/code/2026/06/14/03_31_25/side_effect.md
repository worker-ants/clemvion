# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] execution-store의 `drawerExpanded` 상태가 `reset()` 에서 초기화되지 않아 의도적 설계이나 호출자 기대와 불일치할 수 있음
- 위치: `/codebase/frontend/src/lib/stores/execution-store.ts` — `reset()` 함수 및 `startExecution()` 내
- 상세: `drawerExpanded`는 UI 선호값으로 명시적으로 `reset`/`startExecution` 대상에서 제외됐다. 이는 의도된 설계이며 테스트(execution-store.test.ts)로 검증됐다. 그러나 기존 `reset()`을 호출하는 다른 컨텍스트(예: 워크플로우 이동 시 cleanup)에서 드로어 펼침 상태가 유지되는 것이 항상 바람직하지 않을 수 있다. 현재 store는 전역 singleton이므로 한 워크플로우에서 접힌 상태로 두면 다른 워크플로우 이동 시에도 접힌 채로 시작된다.
- 제안: 의도된 설계라면 문서화(주석)가 이미 돼 있으므로 허용. 다만 향후 "워크플로우 이동 시 UI 상태 초기화" 요구사항 발생 시 `reset()` 대상 포함 여부를 재검토할 것.

### [WARNING] `RunResultsDrawer`의 `expanded` 상태를 로컬 `useState`에서 전역 store로 승격 — 초기값 차이 없으나 공유 상태의 범위 확장
- 위치: `/codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx` 라인 124–125
- 상세: 기존 `useState(true)` → `useExecutionStore(s => s.drawerExpanded)` 변경. 초기값은 동일(`true`)하지만, 이제 `drawerExpanded`는 컴포넌트 수명이 아닌 store 수명(앱 전체)을 따른다. `RunResultsDrawer`가 unmount/remount 되어도 상태가 유지되는 부작용이 발생한다. 예를 들어 접힌 상태에서 워크플로우 페이지를 떠났다가 돌아오면 이전 상태가 유지된다.
- 제안: 의도된 동작(단축키를 통한 교차 컴포넌트 공유)으로 허용 가능. 단, "페이지 진입 시 항상 펼침 상태로 시작"이 요구사항이라면 라우트 이동 시 `reset`에 포함하거나 별도 초기화 로직이 필요.

### [INFO] `handleExport`에서 DOM 조작(`document.body.appendChild`)을 통한 파일 다운로드 부작용 — 기존 코드이나 주의
- 위치: `/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` — `handleExport` 콜백 (변경 없는 기존 코드)
- 상세: 이번 변경과 직접 관련 없으나, `handleExport`는 `document.body`에 `<a>` 엘리먼트를 추가·클릭·제거하는 DOM 부작용을 가진다. 이 패턴은 신규 변경이 아니다.
- 제안: 이번 PR 변경 범위 밖이므로 별도 이슈 없음.

### [INFO] `handleLoadFromHistory`가 내부적으로 `executionsApi.getById` 네트워크 호출을 직접 수행
- 위치: `/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 라인 1576–1588
- 상세: 이 콜백은 `useQuery`를 통하지 않고 직접 API를 호출하므로 React Query 캐시를 거치지 않는다. 동일 실행 ID를 여러 번 선택하면 매번 네트워크 요청이 발생한다. 실패 시 `toast.error`로 알리고 `console.error`를 남기는 것은 적절하다. `setJsonInput`/`setHistoryPickerOpen` 로컬 상태만 변경하므로 외부 공유 상태 부작용은 없다.
- 제안: 캐싱이 필요하다면 `useQuery`로 전환하거나 메모이즈 맵을 사용할 수 있으나, 히스토리 로드는 빈번하지 않아 현재 설계로 충분.

### [INFO] `isEditableTarget` 함수가 `workflow-editor.tsx`에서 `export`로 노출 — 공개 API 추가
- 위치: `/codebase/frontend/src/components/editor/workflow-editor.tsx` 라인 2256–2263
- 상세: `isEditableTarget`이 모듈 public export로 추가됐다. 테스트 파일(`workflow-editor-shortcuts.test.ts`)에서 직접 import한다. 이는 의도된 것이며 인터페이스 변경이 아닌 새 export 추가이므로 기존 호출자에 영향 없음. 그러나 `workflow-editor.tsx` 파일은 렌더 컴포넌트이므로 순수 헬퍼를 별도 util 파일로 분리하는 것이 더 깔끔할 수 있다.
- 제안: 기능적 문제 없음. 추후 리팩토링 시 `lib/utils/` 하위로 이동 고려.

### [INFO] `historyQuery`의 `queryKey`가 `["editor-run-history", workflowId]`로 전역 React Query 캐시에 등록됨
- 위치: `/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 라인 1564–1573
- 상세: `enabled: !!workflowId && runWithInputOpen && historyPickerOpen` 조건으로 피커를 열 때만 활성화된다. 캐시 키는 다른 쿼리(`["execution", executionId]`, `["workflows"]` 등)와 충돌하지 않는다. 기본 `staleTime`/`gcTime`이 적용되므로 화면 이동 후에도 캐시가 일정 시간 남아있는 것은 의도된 React Query 동작이다.
- 제안: 문제 없음.

### [INFO] `data-run-results-drawer` 어트리뷰트 추가로 `closest()` DOM 쿼리 기준점 변경
- 위치: `/codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx` 라인 483
- 상세: `workflow-editor.tsx`의 Escape 핸들러가 `active.closest("[data-run-results-drawer]")`로 드로어 내부 포커스를 감지한다. `data-run-results-drawer` 어트리뷰트가 `RunResultsDrawer` 최외곽 `<div>`에 추가됐으므로, 드로어 내부의 어떤 요소도 해당 선택자에 매칭된다. 외부 테스트나 다른 코드에서 동일 선택자를 사용할 경우의 충돌 가능성은 낮으나, `data-` 어트리뷰트가 사실상 암묵적 인터페이스(implicit coupling) 역할을 한다.
- 제안: 문서화 수준의 주의. 현재 단일 사용처이므로 문제 없음.

### [INFO] `Ctrl+Shift+R`에서 `return` 조기 반환 후 Escape 핸들러 미실행
- 위치: `/codebase/frontend/src/components/editor/workflow-editor.tsx` 라인 2351–2355
- 상세: `Ctrl+Shift+R` 분기에서 `return`으로 조기 종료하므로 동일 이벤트에서 Escape 로직은 실행되지 않는다. 이는 올바른 설계다(R 키는 Escape가 아님). 단, 이전 `saveAndInvalidate` / `toggleAssistant` 핸들러들은 `return` 없이 fall-through 방식이라 `R` 키가 동시에 다른 핸들러와 매칭될 여지가 있지만, 실제로 `R` 키는 다른 조건과 겹치지 않는다.
- 제안: 일관성을 위해 모든 단축키 분기에 `return`을 추가하는 것을 고려할 수 있으나, 현재 동작에는 실질적 문제 없음.

---

## 요약

이번 변경의 핵심 부작용은 `RunResultsDrawer`의 `expanded` 상태를 로컬 `useState`에서 `execution-store`의 전역 상태로 승격한 것이다. 이는 의도된 설계(단축키와 UI 컨트롤의 공유 상태)이며 테스트로 검증됐지만, 상태 수명이 앱 전체로 확장되는 부작용을 수반한다. `editor-toolbar.tsx`의 히스토리 로드(`handleLoadFromHistory`)는 React Query 캐시를 우회하는 직접 API 호출을 사용하나, 로컬 컴포넌트 상태만 변경하므로 공유 상태 오염 없음. `isEditableTarget`의 public export 추가는 인터페이스 확장이지만 기존 호출자에 파괴적 변경이 없다. `historyQuery` 쿼리 키는 기존 캐시 공간과 충돌하지 않는다. 전반적으로 의도치 않은 전역 상태 변경·네트워크 호출·파일시스템 부작용은 발견되지 않았으며, 식별된 경고 사항은 알려진 trade-off로 설계 내에서 허용 가능한 수준이다.

## 위험도

LOW
