<!-- main 이 journal(wf_7f9e5923-759)에서 복원 — subagent write 격리. -->

### 발견사항

- **[WARNING]** 신규 순수 함수 `buildEditorHref` 가 직접 단위 테스트 없이 병합됨
  - 위치: `codebase/frontend/src/lib/workspace/href.ts` (신규 함수) / `codebase/frontend/src/lib/workspace/__tests__/href.test.ts` (미변경)
  - 상세: 같은 파일의 형제 함수 `buildWorkspaceHref`·`buildExecutionHref` 는 `href.test.ts` 에서 기본 케이스·slug null/undefined 폴백·open-redirect 방어까지 촘촘히 테스트되는데, 이번 PR 에서 새로 추가된 `buildEditorHref` 는 같은 파일에 `describe` 블록조차 없다. 실제로 확인해보니 `href.test.ts` 는 이번 diff 목록에 포함되어 있지 않다(수정 안 됨). 이 함수는 이 PR 의 핵심 산출물(에디터 링크 slug화)인데 가장 저렴하고 직접적인 커버리지가 빠져 있다.
  - 제안: `describe("buildEditorHref", ...)` 로 `("team-a","wf-1") → "/w/team-a/workflows/wf-1"`, `(null,"wf-1") → "/workflows/wf-1"` 최소 2케이스 추가.

- **[WARNING]** 이번 PR 에서 새로 배선된 `buildEditorHref` 호출부 대부분이 "slug 활성" 회귀 단언 없이 방치됨(같은 파일 내 다른 호출부는 정확히 이 패턴을 갖추고 있어 형평성 문제)
  - 위치/실증:
    - `dashboard/page.tsx` (create-then-push, recent-workflows row click) — `dashboard-page.test.tsx` 는 오직 "recent executions row navigation"(즉 `buildExecutionHref`, 이번 PR 무관 경로)만 테스트하고, 이번에 바뀐 두 곳(워크플로우 row-click, 생성 후 이동)은 테스트가 아예 없음.
    - `workflows/page.tsx` — `workflows-page.test.tsx` L153 `expect(mockPush).toHaveBeenCalledWith("/workflows/new-wf")` 는 `useParams: () => ({})` + slug 미주입 상태라 `buildEditorHref` 가 bare 로 폴백해 "우연히" 그대로 통과. edit 메뉴·행 클릭 경로는 단언 자체가 없음.
    - `triggers/page.tsx` — `triggers-page.test.tsx` 는 `beforeEach` 에서 `setRole()` 로 `slug: "team-1"` 워크스페이스를 이미 활성화해두는데도(다른 어서션엔 slug 활용), 워크플로우 링크(`buildEditorHref(slug, trigger.workflowId)`) href 를 검증하는 테스트가 전혀 없음 — 가장 손쉽게 고칠 수 있었던 케이스.
    - `usage-node-list.tsx`(dialog variant) — 유일한 소비처 테스트인 `danger-tab.test.tsx:144` 가 `useParams: () => ({})` + workspace-store mock 없음 상태에서 `toHaveAttribute("href", "/workflows/wf-a")` 를 그대로 단언 — slug 폴백 경로만 우연히 통과, "tab" variant 는 테스트 파일 자체가 존재하지 않음.
    - `overview-card.tsx` — 컴포넌트 테스트 파일이 아예 없어 이번에 추가된 `buildEditorHref` 배선은 완전히 미검증.
  - 대조: `schedules-page.test.tsx` 만 유일하게 제대로 갱신되어 `useWorkspaceStore` 에 `slug:"team-1"` 을 주입하고 `toHaveAttribute("href","/w/team-1/workflows/w1")` 를 단언한다. `execution-list-page.test.tsx`/`dashboard-page.test.tsx` 는 "slug-누락 회귀 가드" 라는 주석까지 남기며 `buildExecutionHref` 경로엔 이 패턴을 적용해놓고, 같은 파일에서 이번에 바뀐 `buildEditorHref`("Open in Editor" 버튼) 경로엔 적용하지 않았다(`execution-list-page.test.tsx` L201 은 slug 없는 케이스만 존재).
  - 상세: `no-raw-editor-href.test.ts` 의 자체 코멘트가 "PR #865/#866 같은 멀티라인 `router.push` 클래스" 회귀가 반복됐다고 명시하는데, 그 회귀는 "raw 리터럴" 뿐 아니라 "헬퍼는 쓰지만 인자를 잘못 넘기는" 종류(잘못된 slug 변수, 인자 순서 실수)도 포함될 수 있다. 그런 버그는 raw-literal guard 로는 절대 못 잡고, 오직 "slug 활성 상태에서 href 값 검증" 테스트만 잡는다 — 그 안전망이 정확히 이번 PR 이 새로 건드린 호출부들에서 빠졌다.
  - 제안: 위 6개 파일에 `schedules-page.test.tsx`/`execution-list-page.test.tsx` 의 "slug-누락 회귀 가드" 패턴을 그대로 적용(workspace-store 에 슬러그 있는 워크스페이스 주입 후 href/push 값 단언).

- **[WARNING]** 신규 공용 게이트 `WorkspaceSlugGate` 자체의 단독 유닛 테스트가 없고, 동일 시나리오가 두 소비처 테스트에 중복
  - 위치: `codebase/frontend/src/lib/workspace/workspace-slug-gate.tsx` (신규, 로직 이동) / `codebase/frontend/src/app/(main)/w/[slug]/__tests__/layout.test.tsx`(미변경, 4케이스) / `codebase/frontend/src/app/(editor)/w/[slug]/__tests__/layout.test.tsx`(신규, 3케이스)
  - 상세: gate 로직이 `workspace-slug-gate.tsx` 하나로 추출됐는데 그에 대응하는 `lib/workspace/__tests__/workspace-slug-gate.test.tsx` 는 존재하지 않는다. 대신 (main)·(editor) 두 layout 테스트가 `next/navigation`·`use-workspaces`·`workspace-store` mock 을 각각 재정의하며 거의 동일한 3가지 시나리오(정합 렌더/불일치 reconcile/무효 slug redirect)를 검증한다. 이미 드리프트가 관측됨 — main 테스트엔 있는 "loaded=false 로딩 상태" 케이스가 editor 테스트엔 없다. gate 에 새 분기가 추가될 때마다 두 파일을 동시에 고쳐야 하고 누락되면 조용히 커버리지가 갈라진다.
  - 제안: `workspace-slug-gate.test.tsx` 로 gate 행동(정합/불일치/무효 slug/로딩) 전체를 단일화하고, 두 layout 테스트는 "children 을 그대로 전달하는지"만 확인하는 얇은 wiring 테스트로 축소.

- **[INFO]** 신규 e2e 테스트 두 건의 mocking 비대칭
  - 위치: `codebase/frontend/e2e/workspaces/slug-routing.spec.ts` L74-83 vs L85-113
  - 상세: "bare editor path" 테스트는 `/api/workflows/wf-e2e` 등 3개 API 를 스텁하지 않고 실제 백엔드로 흘려보낸다(존재하지 않는 `wf-e2e`). URL 정규식 단언만 하므로 기능적으로 문제는 없으나("라우팅 검증이 목적"이라 문서화됨), 형제 테스트와 접근 방식이 다르고 백엔드 응답 지연/에러에 따라 잠재적 flaky 요인이 될 수 있다.
  - 제안: 일관성을 위해 동일한 route 스텁을 공유하거나, 의도적 비대칭이면 주석으로 명시.

- **[INFO]** `editor-loader.tsx` (`WorkflowEditorLoader`) 는 이번에 경로만 이동(byte-identical, git rename 확인)했고 이전에도 단위 테스트가 없었음(사전 존재 갭, 이번 PR 로 인한 회귀 아님)
  - 위치: `codebase/frontend/src/app/(editor)/w/[slug]/workflows/[id]/editor-loader.tsx`
  - 상세: 노드/엣지 매핑, `dropStaleEdges` 경고 토스트, 취소 플래그, 에러 처리 등 의미 있는 로직을 포함하나 unit 테스트가 전무하다. 파일을 옮기는 김에 커버리지를 추가할 좋은 기회였다.
  - 제안: 별도 작업으로 `editor-loader.test.tsx` 추가 고려(이번 PR 필수는 아님).

### 요약
`WorkspaceSlugGate` 추출(gate 로직)과 raw-editor-href guard 테스트(`no-raw-editor-href.test.ts`, self-test 포함해 27개 전부 통과 확인함) 자체는 탄탄하게 설계·검증되어 있고 기존 `(main)` layout 회귀 테스트도 리팩터 후 수정 없이 그대로 통과한다. 그러나 이 PR 의 실질적 목적("에디터 링크에 slug 를 빠짐없이 붙인다")을 검증하는 지점에서 구멍이 크다: 새로 추가된 `buildEditorHref` 자체가 단위 테스트 0건이고, 이 함수를 소비하는 8개 호출부 중 `schedules-page.test.tsx` 한 곳만 "slug 활성" 상태에서 실제 href 값을 단언하며, 나머지(dashboard·workflows·triggers·usage-node-list·overview-card)는 slug 가 없는 mock 환경에서 우연히 통과하거나 아예 테스트 자체가 없다. raw-literal guard 는 "리터럴 사용"만 잡을 뿐 "헬퍼에 잘못된 인자를 넘기는" 이 프로젝트가 반복 경험한 것과 같은 회귀 클래스는 잡지 못하므로, 실질적 안전망은 절반만 구축된 상태다. 또한 gate 로직의 유일한 커버리지가 두 소비처 테스트에 중복돼 있어 향후 드리프트 위험이 있다.

### 위험도
MEDIUM