# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `WorkspaceRedirect` 종결 로직(`notFound()`)이 렌더 단계에서 무조건 실행되는 신규 부작용 표면
  - 위치: `codebase/frontend/src/app/(main)/[...rest]/page.tsx:87` (`if (workspacePrefixed && !workspaceRootSlug) notFound();`)
  - 상세: 기존에는 이 catch-all 이 항상 `router.replace`(effect 내부 부작용)만 발생시키는 순수 redirect-only 컴포넌트였다. 이번 변경으로 `/w/<slug>/<미매칭>` 류 경로에서 **렌더 중 throw** 하는 `notFound()` 가 추가되어, 컴포넌트가 "항상 redirect" 에서 "redirect 또는 render-phase exception" 으로 계약이 넓어졌다. `notFound()` 를 effect 밖(렌더 바디)에서 호출한 것은 Next.js 요구사항에 맞게 올바르게 처리되었고(주석에도 명시), `(main)/not-found.tsx` 바운더리가 실제로 존재함을 확인했다. 다만 이 컴포넌트를 사용하는 다른 잠재적 소비처나 향후 리팩터링 시 "이 컴포넌트는 항상 redirect 만 한다" 는 과거 가정하에 작성된 코드가 있다면 깨질 수 있다.
  - 제안: 현재로선 실제 문제는 없음(단일 소비처, 문서화됨). plan 체크리스트의 "10. spec 보강 draft" 항목이 이 계약 확장을 spec 에 반영할 예정이므로 그대로 진행하면 충분.

- **[INFO]** `useEffect` 의 조기 반환 분기가 `router.replace` 호출과 "아무 것도 안 함"(render 단계에 위임) 두 갈래로 나뉨
  - 위치: `codebase/frontend/src/app/(main)/[...rest]/page.tsx:61-74`
  - 상세: `workspaceRootSlug` 가 있으면 effect 에서 즉시 `router.replace(dashboard)` 를 호출하고, `workspacePrefixed` 만 참이면 effect 는 조용히 `return` 하고 실제 종결은 렌더 바디의 `notFound()` 가 담당한다. 두 부작용 경로(effect의 navigation, render의 throw)가 같은 조건식 변수(`workspacePrefixed`/`workspaceRootSlug`)를 반씩 나눠 사용하므로 로직 자체는 배타적이라 중복 실행 위험은 없으나, "이 컴포넌트의 부작용이 어디서 발생하는지" 를 두 곳(effect + render)으로 분산시켜 향후 유지보수 시 한쪽만 보고 놓치기 쉽다.
  - 제안: 현재 구현은 정확하나, 두 부작용 지점을 컴포넌트 상단 주석에서 명시적으로 교차 참조(예: "effect 담당 분기 vs render 담당 분기")해두면 회귀 방지에 도움이 된다. 이미 주석이 어느 정도 있어 필수 조치는 아님.

- **[INFO]** `router.replace` 는 `workspaceRootSlug` 존재 여부만 보고 워크스페이스 store `loaded`/유효성 확인 없이 즉시 forward
  - 위치: `codebase/frontend/src/app/(main)/[...rest]/page.tsx:61-64` (및 테스트 `workspace-redirect.test.tsx:154-160` "store 로드를 기다리지 않는다")
  - 상세: 기존 fallback 분기(`resolveFallbackWorkspace`)는 `loaded` 를 기다린 뒤 활성 워크스페이스를 계산했지만, 신규 `workspaceRootSlug` 분기는 URL 의 slug 를 그대로 신뢰해 store 로드를 기다리지 않고 즉시 `/w/<slug>/dashboard` 로 forward 한다. 의도된 설계(주석·plan 문서에 근거 명시)이며, 존재하지 않거나 접근 불가한 slug 에 대한 최종 검증은 `w/[slug]` layout(`workspace-slug-gate.tsx`, 본 diff 밖)에 위임한다는 기존 책임 분리를 그대로 따른다. 새로운 외부 네트워크 호출이나 인증 우회는 없음.
  - 제안: 조치 불요. 다운스트림 게이트가 실제로 무효 slug 를 처리한다는 전제가 유지되는지만 회귀 테스트로 계속 지켜보면 됨(이미 기존 `workspace-slug-gate` 테스트 커버리지가 있을 것으로 판단).

- **[INFO]** `sidebar.tsx` `navItems` 데이터에 신규 필드 `workspaceScoped` 추가
  - 위치: `codebase/frontend/src/components/layout/sidebar.tsx:127-179` (`as const satisfies ReadonlyArray<{...}>`)
  - 상세: 모듈 비공개 상수(`export` 되지 않음)라 외부 인터페이스 변경은 아님. `satisfies` 타입에 `workspaceScoped: boolean` 이 추가되어 항목 누락 시 컴파일 타임에 즉시 드러나므로 안전. href 생성 로직(`item.workspaceScoped ? buildWorkspaceHref(...) : item.href`)이 `/docs` 만 예외 처리하도록 데이터 기반으로 고정되어, 과거처럼 "예외를 개발자가 코드에서 잊어버리는" 회귀 클래스를 구조적으로 차단한다.
  - 제안: 조치 불요.

- **[INFO]** `href.ts` — 코드 변경 없이 JSDoc 주석만 추가(비-idempotent 설계 근거 문서화)
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:11-20`
  - 상세: `buildWorkspaceHref` 함수 시그니처·구현은 전혀 변경되지 않았다(diff 는 순수 주석 추가). 따라서 기존 호출자(약 45곳, `grep` 확인) 어느 쪽에도 동작 변화가 없다. 문서화된 "이미 `/w/…` 인 path 를 넘겨도 접두를 또 붙인다" 는 기존부터 있던 동작이며, 새 위험을 도입하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 테스트 파일에서 `next/navigation` 모듈 mock 에 `notFound` 추가, `window.matchMedia` 전역 재정의
  - 위치: `codebase/frontend/src/app/(main)/__tests__/workspace-redirect.test.tsx:11-16`, `codebase/frontend/src/components/layout/__tests__/sidebar-nav-href.test.tsx:15-27`
  - 상세: `vi.mock("next/navigation", ...)` 은 파일 스코프로 격리되어 다른 테스트 파일에 영향 없음. `Object.defineProperty(window, "matchMedia", ...)` 도 Vitest 의 파일 단위 격리 환경(jsdom, 기본적으로 파일마다 별도 인스턴스) 안에서만 유효해 전역 오염 위험은 낮음. `mockNotFound` 가 항상 `throw new Error("NEXT_NOT_FOUND")` 하도록 고정된 것은 실제 Next.js 의 render-phase throw 계약을 정확히 흉내 낸 것으로 적절하다.
  - 제안: 조치 불요.

- **[INFO]** 리뷰 payload 에 라우팅 버그와 무관한 `plan/complete/ai-agent-tool-payload-budget-followups.md` frontmatter 변경(`status: complete`, `spec_impact` 추가)이 포함됨
  - 위치: `plan/complete/ai-agent-tool-payload-budget-followups.md:2-9`
  - 상세: 코드 부작용은 아니고 diff 범위 오염(scope contamination) 성격의 관찰. 이 변경은 이미 머지된 별도 PR(#955/#956) 계열 plan 문서의 상태 갱신으로 보이며, 이번 라우팅 fix(`user-guide-routing-loop-fix.md`)와 기능적으로 무관하다. 코드/런타임 부작용은 전혀 없음(문서 frontmatter 뿐).
  - 제안: 실질 위험 없음. 커밋 단위 분리가 필요하면 별도로 처리하되, 부작용 리뷰 관점에서는 조치 불요.

## 요약

핵심 변경은 클라이언트 사이드 catch-all 라우트(`(main)/[...rest]/page.tsx`)와 사이드바 네비게이션 데이터(`sidebar.tsx`)에 국한되며, 전역 변수·환경 변수·네트워크 호출·기존 공개 함수 시그니처(예: `buildWorkspaceHref`)에는 어떠한 변경도 없다. 가장 주목할 부분은 `WorkspaceRedirect` 컴포넌트가 "항상 redirect" 계약에서 "redirect 또는 render-phase `notFound()` throw" 로 부작용 표면이 넓어진 점인데, 이는 사용자 보고 무한 리다이렉트 버그를 근본적으로 제거하기 위한 의도된 설계이며 `(main)/not-found.tsx` 바운더리 존재·effect/render 분기의 배타성·테스트(e2e 5건 + unit 7건)로 뒷받침된다. `router.replace` 를 store `loaded` 대기 없이 즉시 호출하는 신규 분기(`workspaceRootSlug`)도 slug 유효성 검증 책임을 기존 `w/[slug]` 게이트에 위임하는 기존 아키텍처를 그대로 따른다. 테스트 파일의 mock/전역 재정의는 파일 스코프로 격리되어 있어 교차 오염 위험이 없다. 전반적으로 부작용 관점에서 심각한 이슈는 발견되지 않았다.

## 위험도

LOW
