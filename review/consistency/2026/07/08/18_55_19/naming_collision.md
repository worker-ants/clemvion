# 신규 식별자 충돌 검토 — spec/2-navigation/ (워크스페이스 슬러그 라우팅, --impl-done)

## 검토 범위 및 방법

diff-base `origin/main` 대비 target 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/workspace-slug-routing-de2b12`, HEAD)를 절대경로로 직접 조회했다. 이번 변경은 **프론트엔드 전용** 라우팅 리팩터(`(main)/*` → `(main)/w/[slug]/*` git-mv + 신규 헬퍼/훅 4개 + catch-all/layout 2개)이며 backend·API·ENV·이벤트 정의 변경은 없음을 `git diff origin/main --stat -- codebase/backend` (결과 없음) 로 확인했다. 신규 식별자 후보:

- 라우트 세그먼트: `(main)/w/[slug]/**` (26페이지 git-mv), `(main)/[...rest]/page.tsx`
- 컴포넌트: `WorkspaceSlugLayout`, `WorkspaceRedirect`
- 훅/헬퍼: `useWorkspaceSlug`, `useWorkspaces`, `buildWorkspaceHref`, `resolveFallbackWorkspace`
- spec 헤딩: `spec/data-flow/12-workspace.md` "### URL slug = FE 라우팅 SoT (≠ backend 인가 SoT)"
- spec 본문 신규 서술: `9-user-profile.md §3`, `_layout.md §2.2/§3.1`, `10-auth-flow.md §7.2`

## 발견사항

- **[INFO]** 라우트 파라미터명 `slug` 가 두 개의 이질적 개념에 재사용됨
  - target 신규 식별자: `codebase/frontend/src/app/(main)/w/[slug]/**` 의 동적 파라미터 `slug` (워크스페이스 고유 slug, 문자열 1개)
  - 기존 사용처: `codebase/frontend/src/app/(main)/docs/[...slug]/page.tsx` (spec `spec/2-navigation/13-user-guide.md §3/§6`) — 여기서 `slug` 는 "locale + section + 문서 파일 경로" 를 나타내는 catch-all 배열(`string[]`, 최소 3세그먼트)로 워크스페이스와 무관한 완전히 다른 개념
  - 상세: 두 라우트는 부모 정적 세그먼트(`w` vs `docs`)가 다르므로 Next.js 라우팅상 실제 충돌은 없다 — `plan/in-progress/workspace-slug-routing.md` 의 impl-prep 단계에서 이미 이 조합이 Critical 후보로 지적됐고, "docs 를 옮기지 않으므로 nesting 자체가 없다" 는 근거로 해소됐으며 TEST WORKFLOW 의 `build(route 충돌 0)` 로 실증됐다(빌드 성공 확인). 다만 코드베이스 전역에서 `useParams<{ slug }>()` 패턴과 "slug" 라는 이름이 워크스페이스 식별자와 문서 경로라는 서로 무관한 두 의미로 공존하는 점은 향후 검색·리팩터 시 낮은 확률로 혼동을 유발할 수 있다(타입 모양이 `string` vs `string[]` 로 달라 컴파일러가 오용은 대부분 차단).
  - 제안: 이미 리스크 평가·근거가 plan 문서에 기록되어 있으므로 추가 조치 불요. 향후 신규 개발자 온보딩 문서·주석에서 "`slug` 는 도메인에 따라 워크스페이스/문서 경로 두 가지 의미로 쓰인다" 는 점을 한 줄 남기면 좋다(선택).

- **[INFO]** 헬퍼 파일 베이스네임 `href.ts` 중복 (다른 디렉터리)
  - target 신규 식별자: `codebase/frontend/src/lib/workspace/href.ts` (export `buildWorkspaceHref`)
  - 기존 사용처: `codebase/frontend/src/lib/notifications/href.ts` (export `notificationHref`, PR #830 계열에서 도입)
  - 상세: 두 파일 모두 "href 를 만드는 순수 함수" 라는 유사한 역할이나, import 경로(`@/lib/workspace/href` vs `@/lib/notifications/href`)와 export 함수명(`buildWorkspaceHref` vs `notificationHref`)이 명확히 달라 실제 이름 충돌은 없다. 단, 파일명만으로 검색하는 개발자가 두 파일 중 무엇을 열지 순간 혼동할 수 있다.
  - 제안: 실질적 위험 없음 — 그대로 두어도 무방. 원한다면 두 파일 다 `workspace-href.ts` / `notification-href.ts` 처럼 도메인 접두어를 파일명에도 반영하는 컨벤션을 추후 고려.

- **[INFO]** 훅 3종(`useWorkspaceStore` / `useWorkspaceSlug` / `useWorkspaces`) 이름 유사
  - target 신규 식별자: `useWorkspaceSlug` (`lib/workspace/use-workspace-slug.ts`), `useWorkspaces` (`lib/workspace/use-workspaces.ts`)
  - 기존 사용처: `useWorkspaceStore` (`lib/stores/workspace-store.ts`, 기존 zustand 스토어 훅)
  - 상세: 세 이름이 접두어 `useWorkspace*` 를 공유해 표면적으로 혼동 가능성이 있으나(스토어 vs slug 조회 vs 목록 fetch), 신규 두 훅 모두 JSDoc 에 "`cf. useWorkspaceStore(zustand 상태) · useWorkspaces(목록 fetch)/useWorkspaceSlug(현재 slug) 와 역할이 다르다`" 로 상호 참조를 이미 명시해 실질적 혼동 위험을 낮췄다.
  - 제안: 조치 불요 — 이미 문서화로 완화됨.

## 요약

이번 target 변경(spec/2-navigation/* 는 실제로는 워크스페이스 슬러그 라우팅 구현을 반영한 `code:` 경로·서술 갱신, 실코드는 `(main)/w/[slug]/**` git-mv + 4개 신규 훅/헬퍼 + catch-all/layout 2개)에서 요구사항 ID·엔티티/DTO명·API endpoint(method+path)·이벤트/메시지명·ENV/설정키 차원의 **실질적 충돌은 발견되지 않았다** — backend·API·ENV 는 이번 변경 범위 밖(unchanged, `git diff --stat` 로 확인)이기 때문이다. 유일하게 주목할 만한 지점은 라우트 파라미터명 `slug` 가 워크스페이스 식별자(`w/[slug]`)와 기존 문서 경로(`docs/[...slug]`)라는 서로 다른 두 개념에 재사용된다는 점인데, 이는 이미 해당 plan(`plan/in-progress/workspace-slug-routing.md`)의 impl-prep 단계 consistency-check 에서 Critical 후보로 검토돼 "부모 세그먼트가 달라 nesting 이 없으므로 실제 라우팅 충돌 아님" 으로 해소되었고 빌드 성공(route 충돌 0)으로 실증됐다. 그 외 `href.ts` 파일명 중복과 `useWorkspace*` 훅 3종의 이름 유사성은 실사용 충돌 없이 순수 가독성 참고 사항(INFO)이다.

## 위험도

LOW
