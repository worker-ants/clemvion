# 유지보수성(Maintainability) Review

대상: `/docs` 사이드바 라우팅 무한 중첩 버그 fix (sidebar.tsx `workspaceScoped` 플래그, `(main)/[...rest]/page.tsx` catch-all terminal 가드, 관련 e2e/unit 테스트).

## 발견사항

- **[WARNING]** catch-all 세그먼트 판별에 쓰이는 리터럴 `"w"`/`2`가 여러 파일에 중복·산재
  - 위치: `codebase/frontend/src/app/(main)/[...rest]/page.tsx:41-45` (`rest[0] === "w"`, `rest.length === 2`), `codebase/frontend/src/lib/workspace/href.ts` (`/w/${slug}${clean}` 생성부), 테스트 파일들의 `rest: ["w", ...]` mock 배열
  - 상세: `(main)/w/[slug]` 라우트 세그먼트 이름(`"w"`)과 "워크스페이스 루트 = `rest.length===2`"라는 구조적 사실이 상수화되지 않고 문자열/숫자 리터럴로 여러 파일에 흩어져 있다. 인라인 주석으로 의도는 설명돼 있어 즉각적인 오독 위험은 낮지만, 향후 라우트 세그먼트명이 바뀌거나(`w` → 다른 이름) 중첩 depth 규칙이 변경될 경우 `page.tsx`·`href.ts`·테스트가 개별적으로 갱신되어야 해 변경 누락 여지가 있다.
  - 제안: `WORKSPACE_ROUTE_SEGMENT = "w"` 같은 공유 상수를 `href.ts`(또는 `lib/workspace/` 하위 신규 파일)에 두고 `page.tsx`가 이를 import 해서 `rest[0] === WORKSPACE_ROUTE_SEGMENT` 형태로 쓰면 두 파일 간 결합이 명시적으로 드러난다. `rest.length === 2`는 이미 주석으로 의미가 설명되어 있어 필수는 아니지만 `WORKSPACE_ROOT_SEGMENT_COUNT` 같은 이름으로 승격하면 가독성이 조금 더 개선된다.

- **[WARNING]** 신규 `sidebar-nav-href.test.tsx`가 기존 `sidebar.test.tsx`와 거의 동일한 mock 보일러플레이트(약 100줄)를 중복 보유
  - 위치: `codebase/frontend/src/components/layout/__tests__/sidebar-nav-href.test.tsx:1-120` (matchMedia/next-navigation/next-link/apiClient/각 store mock 블록)
  - 상세: 파일 상단 주석이 스스로 "기존 `sidebar.test.tsx`는 store 에 워크스페이스가 없어 이 결함을 재현 못해 별도 파일로 세운다"고 밝히고 있다. 즉 의도적 트레이드오프이지만, 결과적으로 `Sidebar` 컴포넌트를 렌더링하기 위한 mock 설정(대략 15개의 `vi.mock` 블록)이 두 테스트 파일에 걸쳐 복제된다. `Sidebar`의 의존성이 늘어날 때마다 두 파일을 동시에 갱신해야 하는 이중 유지보수 지점이 생긴다.
  - 제안: 공통 mock 설정(`matchMedia`, `next/link`, `apiClient`, `auth-store`, `sidebar-store`, `use-workspaces`, `i18n` 등)을 `__tests__/sidebar-test-helpers.ts` 같은 공유 유틸로 추출하고, `workspace-store` mock(있음/없음 워크스페이스)만 각 파일에서 오버라이드하는 구조로 리팩터링하면 중복을 크게 줄일 수 있다. (fix 범위를 넘는 후속 작업으로 처리해도 무방.)

- **[INFO]** `workspace-redirect.test.tsx` 한 파일 안에서 테스트 이름의 언어 컨벤션이 기존 블록(영어)과 신규 블록(한국어)으로 갈림
  - 위치: `codebase/frontend/src/app/(main)/__tests__/workspace-redirect.test.tsx:19-92`(기존 `describe("WorkspaceRedirect (catch-all)"...)`, 전부 영어 `it(...)`) vs `:96-166`(신규 `describe("WorkspaceRedirect — /w/ 접두 경로는 terminal ...")`, 전부 한국어 `it(...)`)
  - 상세: 같은 컴포넌트·같은 파일에 대해 절반은 `"forwards a bare path to the active workspace slug"`류 영어, 절반은 `"존재하지 않는 워크스페이스 스코프 경로(/w/<slug>/docs)는 notFound 로 종결한다"`류 한국어로 테스트 설명이 쓰여 있어 파일 하나의 스타일 일관성이 낮아졌다. (신규 `sidebar-nav-href.test.tsx`도 전부 한국어로, 기존 `sidebar.test.tsx`— 미확인이나 통상 영어일 가능성 — 와 다를 수 있음.) 기능적 문제는 아니며, 저장소 전반에 한국어 설명 주석이 널리 쓰이는 관행과는 결이 다르다(주석=한국어, 테스트 타이틀=기존엔 영어였던 패턴).
  - 제안: 필수 수정 사항은 아니나, 팀 컨벤션이 "테스트 타이틀은 영어, 설명 주석은 한국어"라면 신규 `it` 블록도 영어로 맞추는 편이 파일 내 일관성에 좋다. 프로젝트가 이미 한국어 테스트 타이틀을 다른 곳에서도 채택했다면 무시해도 된다(단일 파일 내 혼재만 정리 권장).

- **[INFO]** `WorkspaceRedirect` 컴포넌트의 라우팅 결정 로직이 render 본문(`workspacePrefixed`/`workspaceRootSlug` 계산 + `notFound()` 호출)과 `useEffect` 콜백(실제 forward)으로 나뉘어 있어, 전체 분기를 파악하려면 두 지점을 오가야 함
  - 위치: `codebase/frontend/src/app/(main)/[...rest]/page.tsx:38-89`
  - 상세: `notFound()`는 Next.js 제약상 render 중에 호출해야 하고 `router.replace()`는 effect 안에서 호출해야 하므로 이런 분리 자체는 불가피하며, 코드에 그 이유가 정확히 주석으로 남아 있어("**render 중** 호출해야... 훅 순서를 깨지 않도록") 당장 오독 위험은 낮다. 다만 `workspacePrefixed`/`workspaceRootSlug`라는 두 파생 변수가 effect의 의존성 배열에도 들어가고 render 본문의 `notFound()` 조건에도 쓰이면서, "이 catch-all이 무엇을 할지"를 결정하는 전체 상태 기계가 컴포넌트 여기저기 흩어진 형태다.
  - 제안: (선택) `rest` 배열을 입력으로 받아 `{ kind: "forward"; path: string } | { kind: "notFound" } | { kind: "wait" }` 같은 판정 결과를 반환하는 순수 함수(예: `resolveCatchAllRoute(rest, workspaces, currentWorkspaceId, loaded)`)로 분기 로직을 추출하면, React 훅과 무관하게 단위 테스트 가능해지고 컴포넌트는 그 결과를 render/effect에 배분하기만 하면 된다. 현재도 vitest로 시나리오별 테스트가 잘 갖춰져 있어 시급하지 않은 개선 제안.

- **[INFO]** `sidebar.tsx`의 `isActive` 판정에 남아있는 `pathname.startsWith(href) || pathname.startsWith(item.href)`가 `workspaceScoped: false`인 항목(`/docs`)에서는 `href === item.href`라서 사실상 중복 조건
  - 위치: `codebase/frontend/src/components/layout/sidebar.tsx:509-511`
  - 상세: 기능상 문제는 없다(단순 항상-참 OR가 결과를 바꾸지 않음). scoped 항목에서는 여전히 "slug 있는 href/bare href 둘 다 활성 판정"이 필요하므로 조건 자체를 없앨 수는 없지만, `workspaceScoped` 플래그가 생긴 지금은 `item.workspaceScoped ? (pathname.startsWith(href) || pathname.startsWith(item.href)) : pathname === item.href`처럼 분기를 명시하면 "왜 OR인지"가 데이터 모델과 더 정합하게 드러난다. 우선순위 낮은 가독성 제안.

## 요약

이번 변경은 근본 원인(사이드바가 `/docs`에도 무조건 slug를 붙이는 문제, catch-all이 이미 `/w/…`인 경로에 slug를 재부착하는 문제)을 `workspaceScoped` 데이터 플래그와 catch-all의 `notFound()`/forward 이원화로 구조적으로 제거했고, 각 결정의 배경·기각한 대안(idempotent 헬퍼, strip 후 재-forward)까지 주석·plan 문서에 상세히 남겨 향후 동일한 실수를 반복하지 않도록 잘 방어하고 있다. 네이밍(`workspacePrefixed`, `workspaceRootSlug`, `workspaceScoped`)과 함수 길이·중첩 깊이는 무난한 수준이며 매직 넘버/문자열(`"w"`, `rest.length===2`)도 주석으로 의미가 보강되어 있어 즉각적인 위험은 낮다. 다만 라우트 세그먼트 리터럴이 상수화되지 않고 여러 파일에 산재한 점, 신규 테스트 파일이 기존 테스트와 mock 보일러플레이트를 상당 부분 중복 보유한 점, 한 테스트 파일 내에서 테스트 타이틀 언어 컨벤션이 혼재된 점은 후속 정리 대상으로 남겨둘 만하다.

## 위험도

LOW
