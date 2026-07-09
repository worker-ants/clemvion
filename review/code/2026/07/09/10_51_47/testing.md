# 테스트(Testing) Review

## 발견사항

- **[WARNING]** 이 PR 이 고쳤다고 주장하는 "slug 누락 latent broken-link" 3곳(대시보드 row-click·executions 목록 row-click·상세 prev/next) 에 대해, **slug 가 실제로 존재하는 상황**을 재현하는 컴포넌트 레벨 회귀 테스트가 없다.
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/dashboard/page.tsx` — 테스트 파일 자체가 존재하지 않음(`find`로 확인, dashboard 관련 테스트는 `lib/api/__tests__/dashboard.test.ts` 뿐이고 API 클라이언트만 검증). 이 파일이 바로 3개 latent bug 중 하나를 고친 파일인데 컴포넌트 테스트가 전무.
  - 위치: `app/(main)/w/[slug]/workflows/[id]/executions/__tests__/execution-list-page.test.tsx:149-163` (`navigates to execution detail on row click`) — `vi.mock("next/navigation", () => ({ useParams: () => ({}) ... }))` 이고 `workspace-store` 시딩이 없어 `useWorkspaceSlug()` 가 항상 `null` 로 resolve. 그 결과 단언 `expect(mockPush).toHaveBeenCalledWith("/workflows/wf-1/executions/exec-1")` 은 slug-null fallback 경로와 우연히 일치할 뿐, `buildExecutionHref(slug, ...)` 에 slug 가 올바르게 전달되는지는 전혀 검증하지 않는다. 실제로 `buildExecutionHref` 호출에서 slug 인자가 실수로 빠지거나 하드코드 `null` 로 바뀌어도 이 테스트는 계속 통과한다(vacuous pass).
  - 위치: `app/(main)/w/[slug]/workflows/[id]/executions/__tests__/execution-detail-page.test.tsx` — back-button 은 `setupAuth("editor", ...)` 로 slug `"ws"` 를 시딩해 `"/w/ws/workflows/wf-1/executions"` 를 올바르게 검증(203행, 모범 사례). 그러나 이번 diff 로 함께 바뀐 **prev/next 버튼**(adjacentQuery.data.prev/next) 과 **reRunOf chain-origin 링크·dropdown chain items 링크**(329행 근처 테스트에서 `#1-th re-run`/`View chain (2)` 텍스트만 확인하고 `href` 단언 없음)는 href 검증이 전혀 없다.
  - 위치: `app/(main)/w/[slug]/workflows/page.tsx:342-347` (`case "executions"`) — `app/(main)/w/[slug]/workflows/__tests__/workflows-page.test.tsx` 전체에 `"executions"` 라는 문자열이 단 한 번도 등장하지 않는다(grep 확인). 행 메뉴의 "executions" 액션 자체가 이 테스트 파일에서 전혀 트리거되지 않아, 이번 diff 가 바꾼 정확한 코드 경로(`buildWorkspaceHref` → `buildExecutionHref`)가 미검증 상태다.
  - 위치: `components/triggers/__tests__/trigger-history-dialog.test.tsx:110-117`, `components/editor/run-results/__tests__/execution-history-panel.test.tsx:95` — 둘 다 href 단언은 있으나 slug 가 `null` 인 bare-path 케이스만 검증(두 파일 모두 workspace-store 시딩·slug mock 없음). slug 존재 케이스는 없음.
  - 위치: `components/editor/run-results/run-results-drawer.tsx` — 이 컴포넌트에 대한 테스트 파일이 아예 존재하지 않는다(`find`/`grep -rl "RunResultsDrawer" --include="*.test.*"` 모두 0건). `buildExecutionHref(slug, workflowId)` 사용처를 포함해 전체 컴포넌트가 미검증.
  - 대조군(좋은 예): `components/executions/__tests__/rerun-modal.test.tsx:216-234` (`재실행 성공 후 활성 워크스페이스가 있으면 slug 경로로 라우팅한다`) 는 `useWorkspaceStore.setState({ workspaces: [{ slug: "team-x", ... }], currentWorkspaceId: "ws" })` 로 slug 를 시딩하고 `"/w/team-x/workflows/wf-1/executions/exec-new"` 를 정확히 검증한다 — 이 패턴이 표준이 되어야 한다. 다만 같은 파일의 "원본 실행 ID 링크"(294행) 는 bare-path 만 테스트해 같은 파일 내에서도 비대칭이다.
  - 상세: 실 코드(`buildExecutionHref` 헬퍼) 는 `href.test.ts` 유닛테스트로 잘 검증되어 URL 조립 로직 자체의 정확성은 확보되어 있다. 그러나 "이 페이지/컴포넌트가 실제로 slug 를 헬퍼에 넘기고 있는가"라는 **배선(wiring) 검증**은 프로젝트 메모리에 이미 기록된 반복 패턴(`next/navigation` mock 이 non-reactive 하여 slug 관련 단언이 vacuous 해지는 문제)과 정확히 같은 계열의 리스크다. 이번 PR 의 존재 이유(latent broken-link 수정) 자체가 회귀 시 다시 조용히 깨질 수 있다.
  - 제안: 위 컴포넌트들에 `useWorkspaceStore.setState({ workspaces: [{ id, slug: "team-a", ... }], currentWorkspaceId: id, loaded: true })` 를 시딩한 뒤 `/w/team-a/...` 형태의 href/push 단언을 최소 1개씩 추가(rerun-modal.test.tsx 216행 패턴 재사용). dashboard.tsx·run-results-drawer.tsx 는 최소한의 스모크 테스트라도 신설 검토.

- **[WARNING]** `no-raw-execution-href.test.ts` guard 가 "현재 저장소에 위반 0건"만 검증하고, regex 자체가 실제 위반 패턴을 탐지한다는 **자체 self-test(true-positive fixture)** 가 없다.
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/no-raw-execution-href.test.ts:32-40`
  - 상세: 이 테스트는 `collectSourceFiles(SRC)` 로 스캔한 실제 소스 파일에 `RAW_EXECUTION_HREF` 정규식이 매치되지 않는지만 확인한다(`expect(offenders).toEqual([])`). regex 자체가 알려진-위반 문자열(예: `` `/workflows/${id}/executions` ``)에 대해 실제로 `true` 를 반환하는지를 검증하는 순수 유닛 테스트가 없다. 향후 이 정규식이 이스케이프 실수나 리팩터로 약화돼도(예: `\$\{` 를 잘못 고치는 등), 그 시점에 저장소에 우연히 위반 코드가 없다면 이 테스트는 계속 통과(vacuous pass)해 guard 가 무력화된 것을 아무도 눈치채지 못한다.
  - 부가 확인(직접 검증): 이 regex 는 문자열 concatenation 형태(`"/workflows/" + id + "/executions"`)는 전혀 탐지하지 못한다(직접 node 로 테스트: `false`). 반면 다중 interpolation(`` `/workflows/${a}${b}/executions` ``)이나 주석 안에 같은 backtick 패턴이 있는 경우(`// see \`/workflows/${id}/executions\``)는 매치되어 **오탐(false positive)** 가능성도 있다 — 코드가 아닌 문서/주석 문자열도 구분 없이 걸린다.
  - 제안: `RAW_EXECUTION_HREF.test(fixtureString)` 이 알려진 위반 문자열에 대해 `true`, 안전한 대안 문자열(헬퍼 호출)에 대해 `false` 를 반환한다는 순수 regex 유닛 테스트를 추가해 guard 자체의 유효성을 회귀 검증할 것. concatenation 우회 한계는 이미 알려진 트레이드오프(커밋 메시지에 명시)이니 plan 문서 `## 근거(출처)` 또는 Rationale 에 "알려진 한계"로 명시해 향후 재발견 시 재작업을 방지할 것.

- **[INFO]** `href.test.ts` 의 `buildExecutionHref` 테스트 스위트가 `buildWorkspaceHref` 스위트 대비 조합이 얕다.
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/href.test.ts:54-70`
  - 상세: 커버된 케이스: 목록 경로(slug 있음, executionId 없음), 상세 경로(slug 있음, executionId 있음), null slug + executionId 있음(폴백). 누락:
    - `buildExecutionHref(null, "wf-1")` — executionId 없이 null slug인 목록 경로 폴백(상세 경로만 null-slug 케이스가 있음).
    - `undefined` slug (buildWorkspaceHref 스위트는 null/undefined 둘 다 테스트하지만, buildExecutionHref 는 null 만).
    - `executionId` 가 빈 문자열(`""`)인 경우 — falsy 라서 자동으로 목록 경로로 폴백되는 동작(의도적일 수 있으나 문서화·테스트 안 됨).
  - 제안: 위 3가지 케이스를 `it.each` 로 추가해 헬퍼의 경계 동작을 명시적으로 고정.

- **[INFO]** `error-page.test.tsx` 의 `isSafeRedirectPath` 테스트가 이번 PR 로 강화된 백슬래시/제어문자 우회 케이스를 커버하지 않는다.
  - 위치: `codebase/frontend/src/components/ui/__tests__/error-page.test.tsx:10-21`
  - 상세: `isSafeRedirectPath` 는 이제 전량 `isSafeInternalPath`(`lib/workspace/safe-path.ts`)로 위임되고, 그 로직의 백슬래시(`/\evil.com`)·tab/CR/LF 우회 케이스는 `safe-path.test.ts` 에 잘 커버되어 있다. 그러나 실제 소비 entry-point 인 `error-page.tsx` 의 `isSafeRedirectPath` export 자체를 검증하는 통합 테스트는 예전 3케이스(`//evil.com`, `https://evil.com`, 빈 문자열/null)만 남아 있어, `error-page.tsx` 쪽 배선(예: 잘못된 함수를 import)이 깨져도 이 테스트만으로는 감지되지 않을 위험이 낮게나마 존재한다.
  - 제안: `error-page.test.tsx` 에 백슬래시 또는 제어문자 케이스 최소 1개(`isSafeRedirectPath("/\\evil.com")` → `false`)를 추가해 delegate 배선을 직접 회귀 검증.

- **[INFO]** 긍정 확인: `safe-path.test.ts`(신규)는 `it.each` 로 경계값(빈 문자열·null·프로토콜-상대·백슬래시·tab/CR/LF·leading slash 누락)을 명확한 라벨과 함께 잘 커버하고, `href.test.ts` 의 `buildWorkspaceHref` 스위트도 동일 스타일을 유지해 가독성이 좋다. `workspace-store.ts`/`resolve-fallback.ts`/`types.ts` 의 타입 이동(B-4)은 순수 리팩터로 기존 `workspace-store.test.ts`/`resolve-fallback.test.ts` 가 변경 없이 통과함을 직접 실행으로 확인했고, `tsc --noEmit` 도 클린해 "16 importer 무변경" 주장과 부합한다. 전체 관련 테스트 스위트(12개 파일, 144 케이스)를 직접 실행해 전부 통과함을 확인했다.

## 요약
핵심 헬퍼(`buildExecutionHref`, `toSafeInternalPath`/`isSafeInternalPath`)에 대한 유닛 테스트는 명확하고 경계값을 잘 커버하며, 타입 이동(B-4)도 회귀 없이 안전하게 컴파일·통과함을 직접 확인했다. 다만 이 PR의 핵심 동기인 "3곳의 slug 누락 latent broken-link" 수정에 대해, 정작 slug 가 존재하는 실제 상황을 재현하는 컴포넌트 레벨 회귀 테스트가 dashboard·executions 목록·상세 prev/next·workflows "executions" 메뉴·run-results-drawer 등 다수 소비처에서 빠져 있어(기존 테스트는 slug=null 폴백 경로와 우연히 일치할 뿐인 vacuous pass), 향후 같은 클래스의 버그가 재발해도 테스트가 이를 잡지 못할 위험이 크다. 또한 신설된 `no-raw-execution-href.test.ts` guard 는 "현재 저장소에 위반 없음"만 확인할 뿐 regex 가 실제로 위반을 탐지한다는 자체 검증(self-test)이 없어, guard 자체가 무력화돼도 알아채기 어렵다. rerun-modal.test.tsx 의 slug-존재 케이스 테스트 패턴은 모범 사례이니 다른 소비처에도 동일하게 적용할 것을 권장한다.

## 위험도
MEDIUM
