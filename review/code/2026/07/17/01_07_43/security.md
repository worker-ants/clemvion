# 보안(Security) 리뷰

리뷰 대상: `/w/<slug>` catch-all 라우팅 무한 중첩 회귀 fix (frontend routing 전용 변경).
파일: `slug-routing.spec.ts`, `(main)/[...rest]/page.tsx`, `workspace-redirect.test.tsx`,
`sidebar-nav-href.test.tsx`(신규), `sidebar.tsx`, `href.ts`, plan 문서 2건.

### 발견사항

- **[INFO]** URL 의 slug 세그먼트를 검증 없이 그대로 신뢰해 workspace root 를 forward
  - 위치: `codebase/frontend/src/app/(main)/[...rest]/page.tsx:489-494` (`if (workspaceRootSlug) { router.replace(buildWorkspaceHref(workspaceRootSlug, "/dashboard") ...) }`)
  - 상세: `/w/<slug>` 단독 경로 접근 시, 기존 코드는 store 의 활성 워크스페이스(`resolveFallbackWorkspace`)로만 forward 했으나, 이번 변경은 **URL 에 있는 slug 값을 그대로** `buildWorkspaceHref` 에 넘겨 `/w/<url-slug>/dashboard` 로 즉시 replace 한다(`workspaces` 목록·`currentWorkspaceId` 검증을 거치지 않음 — 테스트 "store 로드를 기다리지 않는다"가 이를 명시적으로 확인). 즉 이 컴포넌트는 그 slug 가 실제로 존재하는 워크스페이스인지, 현재 사용자가 접근 권한이 있는지 전혀 검증하지 않고 순수 문자열 조립만 한다.
  - 영향 평가: `router.replace` 는 클라이언트 사이드 네비게이션이며 실제 데이터 접근·인가는 `(main)/w/[slug]` layout(본 diff 범위 밖, 미변경)에서 별도로 이루어지는 것으로 보인다(사이드바 주석 "`[slug]` layout 이 store 정합 전까지 gate 해 wrong-workspace 쿼리를 막으므로"). 따라서 이 redirect 자체가 인가 우회를 유발하진 않으나, **하위 레벨의 실제 접근 제어가 존재한다는 전제에 전적으로 의존**한다. 이 전제가 깨지면(예: `[slug]` layout 이 없거나 느슨해지면) 임의 워크스페이스 슬러그로 클라이언트가 스스로를 forward 시키는 진입점이 된다.
  - 제안: `(main)/w/[slug]` layout(혹은 그 하위 페이지)이 `currentWorkspaceId`/`workspaces` 목록과 무관하게 URL slug 에 대해 서버·클라이언트 양쪽에서 접근 권한을 재검증하는지 별도로 확인·문서화(주석 또는 spec)해 이 가정을 명시적으로 고정할 것을 권장. 코드 수정 필수는 아님(범위 밖 계층의 사전 보장을 확인하는 절차적 제안).

- **[INFO]** `buildWorkspaceHref` 의 의도된 non-idempotency — 호출부 오류 시 실패 모드가 "가시적 404" 로 완화됨(문서화됨)
  - 위치: `codebase/frontend/src/lib/workspace/href.ts` 주석, `(main)/[...rest]/page.tsx` terminal 가드
  - 상세: 이번 변경으로 이미 `/w/…` 로 시작하는 경로가 catch-all 에 들어오면 slug 를 재부착하지 않고 `notFound()`/workspace-root forward 로 종결시켜, 과거의 "세그먼트 무한 증식" 회귀 클래스를 구조적으로 제거했다. 보안 성격의 이슈는 아니고 가용성(DoS-유사 사용자 경험 결함) 회귀에 대한 견고한 수정이다. `toSafeInternalPath`(open-redirect 방어, protocol-relative·제어문자 정규화)는 이번 diff 에서 변경되지 않고 그대로 유지되어 기존 보안 경계가 보존됨을 확인했다.
  - 제안: 없음(정보성 확인).

- **[INFO]** notFound() 는 일반 404 바운더리로 종결 — 민감정보 노출 없음
  - 위치: `(main)/[...rest]/page.tsx:515`, `(main)/not-found.tsx`(미변경)
  - 상세: 새로 추가된 `if (workspacePrefixed && !workspaceRootSlug) notFound();` 는 Next.js 표준 `notFound()` 를 호출해 일반 404 바운더리로 떨어뜨릴 뿐, slug 값·워크스페이스 존재 여부·에러 스택 등 민감 정보를 노출하지 않는다. 에러 처리 관점에서 문제 없음.

- **[INFO]** 신규 테스트 파일들의 mock 데이터·시크릿 여부
  - 위치: `sidebar-nav-href.test.tsx`, `workspace-redirect.test.tsx`
  - 상세: 신규 테스트가 사용하는 워크스페이스 id/slug("team-a", "team-b" 등)는 명백한 플레이스홀더이며 하드코딩된 실제 시크릿·토큰·자격증명이 아니다. `apiClient` 등은 전부 vi.mock 처리되어 있어 실제 네트워크 호출이나 인증 정보 노출 경로가 없다.

### 요약
본 변경은 순수 프론트엔드 클라이언트 사이드 라우팅(워크스페이스 slug catch-all)의 무한 리다이렉트 회귀를 고치는 작업으로, 인젝션·하드코딩 시크릿·암호화·의존성 관련 표준 취약점은 발견되지 않았다. 유일하게 주목할 지점은 `/w/<slug>` 단독 경로를 URL 값 그대로 신뢰해 다른 워크스페이스의 dashboard 로 forward 하는 신규 로직인데, 이는 클라이언트 라우팅 계층의 문자열 조립일 뿐이고 실제 인가는 diff 범위 밖의 `(main)/w/[slug]` layout 에 위임된 구조로 보인다. 기존 open-redirect 방어(`toSafeInternalPath`)도 변경 없이 유지된다. 전반적으로 보안 리스크는 낮다.

### 위험도
LOW
