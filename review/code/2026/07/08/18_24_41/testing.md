# 테스트(Testing) 리뷰

대상: 워크스페이스 슬러그 라우팅 phase 1 후속 커밋 (docs frontmatter code: 경로 갱신, `useWorkspaceSlug`/`useWorkspaces`/`buildWorkspaceHref` 신규 헬퍼, cafe24/makeshop pending-polling 훅의 slug-aware 리다이렉트 전환, plan/consistency 산출물, spec frontmatter 일괄 정정).

## 발견사항

- **[WARNING]** `useWorkspaces` 훅이 어디에서도 직접 단위 테스트되지 않음
  - 위치: `codebase/frontend/src/lib/workspace/use-workspaces.ts` (신규), 소비처 `codebase/frontend/src/app/(main)/[...rest]/page.tsx`, `codebase/frontend/src/app/(main)/w/[slug]/layout.tsx`, `codebase/frontend/src/components/layout/sidebar.tsx`
  - 상세: `use-workspaces.ts` 전용 테스트 파일이 없다(`codebase/frontend/src/lib/workspace/__tests__/` 에는 `href.test.ts`, `use-workspace-slug.test.tsx` 만 존재). 이 훅의 3개 소비처 테스트(`workspace-redirect.test.tsx`, `w/[slug]/__tests__/layout.test.tsx`)도 전부 `useWorkspaces: () => ({})` 로 완전히 mock 처리해 실제 구현을 우회한다. 결과적으로 (a) `queryFn` 내부에서 `workspacesApi.list()` 응답을 `setWorkspaces` 로 스토어에 반영하는 side-effect, (b) `enabled: !!user` 게이트, (c) `staleTime: 60_000` 을 통한 사이드바/`[slug]` layout/catch-all 간 단일 요청 dedup 의도(주석에 명시된 핵심 근거) 가 리포지토리 어디에서도 실행되지 않는다. 연쇄로 `useWorkspaceStore.setWorkspaces` 의 "현재 id가 새 목록에 남아있으면 유지, 아니면 `list[0]` 로 폴백" 로직도 `workspace-store.test.ts` 에 해당 케이스가 없어 완전히 미검증 상태다.
  - 제안: `use-workspaces.test.tsx` 를 추가해 `workspacesApi.list` 를 mock 하고 QueryClientProvider wrapper 로 `renderHook` — (1) resolve 후 `useWorkspaceStore.getState().workspaces` 가 갱신되는지, (2) `user` 가 없을 때 `enabled=false` 로 fetch 가 호출되지 않는지, (3) 동일 `queryKey` 로 두 번째 `renderHook` 을 마운트해도 `workspacesApi.list` 가 1회만 호출되는지(dedup 의도 검증) 를 단언. `workspace-store.test.ts` 에도 `setWorkspaces` 의 유지/폴백 분기 케이스를 추가.

- **[WARNING]** cafe24/makeshop pending-polling 훅 테스트가 새로 추가된 slug-prefix 리다이렉트 경로를 실제로 exercise 하지 않음
  - 위치: `codebase/frontend/src/lib/integrations/__tests__/use-cafe24-pending-polling.test.tsx` ("transitions on connected" 케이스), `codebase/frontend/src/lib/integrations/__tests__/use-makeshop-pending-polling.test.tsx` ("transitions on connected", "encodes integrationId" 케이스) / 소스 `use-cafe24-pending-polling.ts:662`, `use-makeshop-pending-polling.ts:829-834`
  - 상세: 이번 diff 는 두 훅에 `useWorkspaceSlug()` + `buildWorkspaceHref(slug, ...)` 를 추가했지만, 각 테스트 파일은 `next/navigation` mock 에 `useParams: () => ({})` 한 줄만 보강했을 뿐 `useWorkspaceStore` 를 세팅하지 않는다(mock 도 안 하고 실제 zustand 싱글턴을 초기 상태 그대로 사용). 따라서 `useWorkspaceSlug()` 는 두 테스트 파일 모두에서 항상 `null` 을 반환하고, `buildWorkspaceHref` 는 항상 "slug 없음" 분기(bare path)만 타게 된다. 기존 단언(`expect(mockReplace).toHaveBeenCalledWith("/integrations/int-1")` 등)은 그대로 통과하지만, 이는 리팩터 이전 동작을 재확인할 뿐 이번에 추가된 `/w/<slug>/integrations/<id>` 분기를 단 한 번도 검증하지 않는다. `slug` 인자가 실수로 뒤바뀌거나 `buildWorkspaceHref` 호출이 깨져도 이 두 파일의 테스트 스위트는 감지하지 못한다. e2e 쪽도 `codebase/frontend/e2e/workspaces/slug-routing.spec.ts` 에 일반 딥링크/redirect 케이스는 있으나 cafe24/makeshop pending-polling 리다이렉트를 slug 컨텍스트에서 검증하는 케이스는 없어, 이 경로는 유닛·e2e 어느 층에서도 slug 값이 있는 상태로 커버되지 않는다.
  - 제안: 각 파일에 `useWorkspaceStore.setState({ workspaces: [...], currentWorkspaceId: ... })` (또는 `@/lib/workspace/use-workspace-slug` 자체를 mock)로 non-null slug 를 주입한 케이스를 1개씩 추가해 `mockReplace` 가 `/w/<slug>/integrations/<id>` 형태로 호출됨을 단언.

- **[INFO]** `use-page-param.test.tsx` 의 `useParams` mock 추가가 실제로 필요한지 불명확
  - 위치: `codebase/frontend/src/lib/hooks/__tests__/use-page-param.test.tsx` diff (`useParams: () => ({})` 한 줄 추가)
  - 상세: `usePageParam`(`codebase/frontend/src/lib/hooks/use-page-param.ts`) 은 `usePathname`/`useRouter`/`useSearchParams` 만 사용하고 `useParams` 를 호출하지 않는다. 이번 라운드에서 `next/navigation` mock 에 `useParams` 를 일괄 추가하는 batch 편집의 일부로 보이는데, 이 파일에서는 해당 훅이 실제로 소비되지 않아 사문화된 mock 라인이다. 기능적으로 해는 없으나, 테스트 mock 이 실제 의존성과 어긋나 있으면 향후 리팩터 시 "이 mock 이 왜 필요한지" 추적 비용이 든다.
  - 제안: 불필요하면 제거하거나, 필요한 이유(예: 공용 mock 템플릿 유지)를 주석으로 남길 것.

- **[INFO]** `buildWorkspaceHref` 단위 테스트가 일부 저빈도 경계값을 다루지 않음
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/href.test.ts`
  - 상세: null/undefined slug, 선행 슬래시 유무, 중첩 경로+쿼리스트링은 커버되지만 (1) 빈 문자열 slug(`""`, falsy 라 null/undefined 와 동일 분기를 타지만 별도 단언 없음), (2) 빈 path(`""`, 결과가 slug 유무에 따라 `/w/<slug>/` 또는 `/` 가 되는 경계값)는 테스트되지 않는다. `slug` 는 DB UNIQUE 제약이 있어 런타임에 빈 문자열이 나올 가능성은 낮지만, 함수 시그니처가 `string | null | undefined` 를 명시적으로 받는 만큼 falsy-but-not-null/undefined 케이스를 한 줄 추가해두면 회귀 방지에 도움이 된다.
  - 제안: 우선순위 낮음 — 여유 있을 때 추가.

- **[INFO]** `use-workspace-slug.test.tsx` 가 실제 zustand 싱글턴을 직접 `setState` 로 조작하고 명시적 teardown이 없음
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/use-workspace-slug.test.tsx`
  - 상세: `beforeEach` 에서 매 테스트 전 `workspaces`/`currentWorkspaceId`/`loaded` 를 완전히 덮어써 파일 내부 격리는 실질적으로 보장되지만, 스토어 자체의 `reset()` 액션을 쓰는 대신 수동으로 전체 필드를 나열해 재설정하고 있어 스토어 shape 이 바뀌면 조용히 stale 값이 남을 수 있다. Vitest 기본 설정(`isolate` 미override, 파일별 모듈 격리)에서는 파일 간 누수는 없지만, 향후 `test.isolate:false` 등으로 바뀌면 위험이 커진다.
  - 제안: `beforeEach` 에서 `useWorkspaceStore.getState().reset()` 호출 후 필요한 필드만 `setState` 로 얹는 패턴으로 바꾸면 스토어 shape 변경에 더 안전하다. 우선순위 낮음.

## 회귀 테스트 확인

- cafe24/makeshop 훅의 기존 테스트(i18n 매핑, 10분 timeout, `transitionedRef` 중복 방지, `encodeURIComponent` 가드, terminal-state 비-리다이렉트 등)는 리팩터 이후에도 로직 자체가 그대로라 여전히 유효하다. 위 WARNING 은 "새 분기 미검증" 문제이지 "기존 테스트 깨짐" 문제가 아니다.
- `use-page-param.test.tsx` 의 8개 기존 케이스는 mock 변경과 무관하게 그대로 유효.
- mdx 문서(`system-status.en.mdx`/`system-status.mdx`), `plan/in-progress/*.md`, `review/consistency/**`, `spec/**` frontmatter `code:` 경로 정정은 테스트 대상 코드가 아니므로 회귀 영향 없음.

## 요약

이번 diff 의 핵심 신규 코드(`buildWorkspaceHref`, `useWorkspaceSlug`)는 각각 전용 단위 테스트로 잘 커버되어 있고 기존 cafe24/makeshop 폴링 훅 테스트도 리팩터 후 여전히 유효하다. 다만 두 가지 실질적 커버리지 갭이 있다 — (1) 라우팅 흡수·사이드바·리다이렉트가 공유하는 신규 `useWorkspaces` 훅이 자체 테스트도 없고 모든 소비처 테스트에서 완전히 mock 처리되어 실제로 한 번도 실행되지 않으며, (2) cafe24/makeshop 폴링 훅에 추가된 slug-prefix 리다이렉트 분기가 두 테스트 파일 모두에서 slug 가 항상 null 인 상태로만 검증되어 실제 "슬러그가 있는" 경로는 유닛·e2e 어느 쪽에서도 실행되지 않는다. 두 갭 모두 즉시 기능을 깨뜨리는 결함은 아니지만(브레이크 시 catch-all 흡수가 안전망 역할), 회귀 감지력이 낮은 상태로 남아 있어 조속한 보강을 권장한다.

## 위험도

MEDIUM
