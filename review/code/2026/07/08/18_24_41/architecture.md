# 아키텍처(Architecture) 리뷰

대상: 워크스페이스 슬러그 URL 라우팅(`/w/[slug]/...`) 구현. 본 세션 diff payload 는 순수
`git mv`(내용 무변경) 파일은 제외되어 신규 헬퍼/훅(`lib/workspace/*`)·OAuth polling 훅 2종·
mdx 문서·spec frontmatter 경로 미러·plan/review 산출물만 포함한다. 아키텍처 판단의 완전성을
위해 payload 밖의 관련 실제 소스(`(main)/w/[slug]/layout.tsx`, `(main)/[...rest]/page.tsx`,
`components/layout/sidebar.tsx`, `lib/stores/workspace-store.ts`, `components/auth/auth-provider.tsx`)
도 리포지토리에서 직접 열람해 통합적으로 평가했다.

## 발견사항

- **[INFO]** `useWorkspaceSlug()` 가 라우팅 레이어와 상태(store) 레이어를 한 훅에서 이중 SoT 로 결합
  - 위치: `codebase/frontend/src/lib/workspace/use-workspace-slug.ts:19-24`
  - 상세: `params.slug`(URL, `/w/[slug]/...` 라우트 한정)와 `useWorkspaceStore` 의
    `currentWorkspaceId → slug` 파생값(전역 fallback)을 한 훅이 우선순위로 병합한다. 의도는
    JSDoc·plan(§7)·유닛테스트(`use-workspace-slug.test.tsx`)로 명확히 문서화돼 있고 동작도
    일관되지만, 호출부(30여 개 파일)는 자신이 지금 "URL-scoped" 컨텍스트에 있는지 "store
    fallback" 컨텍스트에 있는지 훅 내부를 몰라도 되게 추상화된 대신, 두 값이 잠깐 어긋나는
    구간(예: `switchWorkspace` 진행 중 `currentWorkspaceId` 는 이미 바뀌었으나 URL 은 아직
    이전 slug)에 무엇이 반환되는지는 URL 우선이라는 계약에 의존해야 알 수 있다. 실질 결함은
    아니며, 향후 이 훅을 확장(예: 다중 slug 파라미터, 서버 컴포넌트 대응)할 때 두 소스의
    우선순위 계약이 암묵적으로 깨지기 쉬운 지점이라는 점만 표시한다.
  - 제안: 현재 수준의 JSDoc 이면 충분하나, 소비 지점이 계속 늘어나면(현재도 사이드바·인테그레이션·
    프로필·에디터 등 30여 곳) `useActiveWorkspace()` 같은 상위 훅으로 `{ slug, id, role }` 를
    한 번에 파생시켜 "URL 우선 workspace 해소"라는 단일 진입점으로 좁히는 것을 검토.

- **[WARNING]** "활성/폴백 워크스페이스 해소" 로직이 `layout.tsx` 와 `[...rest]/page.tsx` 에 각각
  다른 규칙으로 중복 구현됨
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/layout.tsx:53-61` (무효 slug 시
    `workspaces.find((w) => w.id === currentWorkspaceId) ?? workspaces[0]`) vs
    `codebase/frontend/src/app/(main)/[...rest]/page.tsx:30-33` (활성 워크스페이스 결정도 동일
    패턴 `workspaces.find((w) => w.id === currentWorkspaceId) ?? workspaces[0]`)
  - 상세: 두 파일이 "폴백/활성 워크스페이스가 무엇인가"를 사실상 같은 표현식으로 각자 재구현하고
    있다. 지금은 우연히 동일한 규칙(currentWorkspaceId 우선, 없으면 목록 첫 항목)을 쓰고 있지만,
    이 규칙이 향후 바뀌면(예: "마지막 방문 워크스페이스 우선" 로 정책 변경) 두 지점을 모두 찾아
    갱신해야 하고 누락 시 catch-all 리다이렉트와 layout 멤버십-폴백이 서로 다른 워크스페이스로
    귀결되는 은근한 불일치가 생길 수 있다. `useWorkspaces`/`useWorkspaceSlug` 는 이미 공유 훅으로
    승격했으나 "폴백 워크스페이스 결정" 자체는 아직 각 라우트 컴포넌트에 인라인돼 있어 DRY 원칙에서
    한 단계 벗어난다.
  - 제안: `resolveFallbackWorkspace(workspaces, currentWorkspaceId)` 같은 순수 함수(또는
    `useActiveOrFallbackWorkspace()` 훅)로 추출해 `layout.tsx`·`[...rest]/page.tsx` 양쪽에서 공유.
    `href.ts` 와 동일한 패턴(작은 순수 함수 + 단위테스트)으로 만들면 비용도 낮다.

- **[INFO]** OAuth 폴링 훅이 "폴링 상태 머신"이라는 단일 책임에 라우팅(슬러그 해소) 책임을 추가로 흡수
  - 위치: `codebase/frontend/src/lib/integrations/use-cafe24-pending-polling.ts:46,80-83`,
    `codebase/frontend/src/lib/integrations/use-makeshop-pending-polling.ts:65,98-108`
  - 상세: 두 훅은 이미 "polling + 상태 판정 + toast + invalidate + navigate" 를 한 훅에 담고 있었고
    (JSDoc 이 이를 의도적 응집으로 정당화), 이번 변경으로 `useWorkspaceSlug()` 의존을 추가해
    "activeWorkspace 슬러그를 알아야 올바른 목적지 href 를 만들 수 있다"는 라우팅 관심사까지
    흡수했다. 단일 호출부(각각 `Cafe24PrivatePendingStep`/`MakeshopPendingStep`)만 있어 지금은
    문제가 되지 않으나, 훅이 커질수록(이미 8개 이상 의존성 훅을 조합) 책임 경계가 흐려질 위험이
    있다.
  - 제안: 현재 규모에선 리팩터링 필요성은 낮음(과잉설계 방지). 다만 이 훅에 세 번째 provider(예:
    또 다른 OAuth 제공사)가 추가될 경우, "폴링 로직"과 "완료 시 이동 경로 계산"을 분리해 훅은
    `{ poll, timedOut, lastErrorMessage, shouldNavigate }` 만 반환하고, 실제 `router.replace` 호출은
    컴포넌트 레이어(useEffect)로 옮기는 편이 프레젠테이션/비즈니스 계층 분리에 더 부합.

- **[INFO]** `useWorkspaces()` 의 `queryFn` 내부에서 store 동기화 부수효과 수행 (React Query 관용구와의 긴장)
  - 위치: `codebase/frontend/src/lib/workspace/use-workspaces.ts:19-24`
  - 상세: `queryFn` 안에서 `setWorkspaces(list)` 를 호출해 zustand store 를 갱신한다. React Query
    v5 가 `onSuccess` 콜백을 제거한 뒤 널리 쓰이는 대체 패턴이라 아키텍처 위반이라 보긴 어렵지만,
    "데이터 페칭"과 "전역 상태 동기화"라는 두 책임이 한 함수에 섞여 있어, 이 queryFn 을 다른
    캐시 정책(예: `select` 옵션, `placeholderData`)과 조합할 때 부수효과 실행 타이밍을 추론하기
    까다로워질 수 있다. 현재는 유일한 소비 경로(사이드바·layout·catch-all 3곳 dedup)이므로 실질
    리스크는 낮음.
  - 제안: 그대로 유지 가능. 다만 이 store-sync 패턴이 다른 엔티티(예: 알림·워크스페이스 멤버)로
    확장될 경우 공통 `useQuerySyncedStore` 유틸로 일반화해 반복을 막는 것을 고려.

- **[INFO(양호)]** 모듈 경계: `docs` 라우팅을 `/w/[slug]` 트리 밖에 유지해 파라미터 충돌을 원천 회피
  - 위치: `codebase/frontend/src/app/(main)/docs/[...slug]` (미이동 확인) vs
    `codebase/frontend/src/app/(main)/w/[slug]/*` (이동됨)
  - 상세: 이전 `--impl-prep` consistency-check 가 CRITICAL 로 지적한 "`[slug]` vs `/docs`
    `[...slug]` 파라미터 충돌"은, `[...slug]` 를 `[...path]` 로 rename 하는 대신 **docs 를
    아예 slug 트리 밖에 남기는 스코프 결정**으로 해소됐다(plan §"docs 는 phase 1 slug 밖").
    실제 디렉터리 구조(`find` 결과)로 `(main)/docs` 가 `(main)/w/[slug]` 아래로 이동하지
    않았음을 확인했고, 이는 Next.js 라우트 트리 상 두 `slug` 파라미터가 애초에 중첩되지 않는
    구조적 보장이다 — rename 기반 완화보다 근본적인 모듈 경계 설계(워크스페이스-무관 콘텐츠와
    워크스페이스-스코프 라우트를 애초에 분리)로, 신규 특이 사례를 만들지 않는다는 점에서 더
    견고하다.
  - 별도 조치 불요(양호 사례로 기록).

- **[INFO(양호)]** 레이어링: 워크스페이스 컨텍스트 해소를 `layout.tsx` 단일 게이트로 집중, 하위 페이지는 무관심
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/layout.tsx:63-75`
  - 상세: `WorkspaceSlugLayout` 이 resolve→reconcile→membership-redirect→gate 4단계를 모두
    수행하고, `reconciled` 가 될 때까지 `children` 을 렌더하지 않는다. 이 덕분에 `w/[slug]/*`
    아래 30여 개 페이지 컴포넌트는 "현재 store 의 `currentWorkspaceId` 가 이미 URL 과 일치한다"
    는 불변식을 전제로 데이터 페칭 로직을 그대로 유지할 수 있어(각 페이지가 직접 slug↔store
    정합을 신경 쓸 필요 없음), 프레젠테이션(페이지) ↔ 라우팅/컨텍스트 해소(layout) 계층 분리가
    잘 지켜졌다. `useParams` 직접 사용도 layout 한 곳으로 좁혀져 있어(grep 확인) 하위 페이지의
    라우팅 결합도가 낮다.
  - 별도 조치 불요(양호 사례로 기록).

## 요약

이번 변경은 "URL 이 워크스페이스 라우팅의 SoT" 라는 단일 원칙을 `layout.tsx`(URL→store reconcile) ·
`[...rest]/page.tsx`(구 경로 흡수) · `buildWorkspaceHref`/`useWorkspaceSlug`(링크 생성) 세 축으로
일관되게 구현했고, 각 축의 책임 분리도 대체로 명확하다(라우팅 게이트는 layout 에, 링크 생성은 순수
헬퍼에, 목록 페칭은 dedup 되는 공유 훅에). `docs` 를 슬러그 트리 밖에 남겨 파라미터 충돌을 rename
없이 구조적으로 회피한 결정은 이전 consistency-check 가 지적한 CRITICAL 을 근본적으로 해소한
견고한 모듈 경계 설계다. 다만 "폴백/활성 워크스페이스 해소" 규칙이 `layout.tsx` 와
`[...rest]/page.tsx` 에 동일 로직으로 중복 구현되어 있어(WARNING), 향후 정책 변경 시 두 지점이
어긋날 잔여 위험이 있다 — 공유 유틸로 추출하면 해소되는 낮은 비용의 개선이다. 그 외 `useWorkspaceSlug`
의 이중 SoT 병합, OAuth polling 훅의 라우팅 책임 흡수, `useWorkspaces` 의 queryFn 부수효과는 현재
규모에서는 실질적 문제를 일으키지 않는 낮은 우선순위 관찰 사항(INFO)이다. 순환 의존성은 발견되지
않았고, 신규 헬퍼(`href.ts`)는 단위테스트로 잘 고정되어 있다.

## 위험도

LOW
