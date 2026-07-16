# 테스트(Testing) 재리뷰 — W#5(e2e 404 assertion 강화) 검증

대상: 직전 리뷰(`review/code/2026/07/17/01_07_43`) WARNING #5 fix — `slug-routing.spec.ts`
`"stale /w/<slug>/docs URL terminates on 404 instead of nesting forever"` 테스트에 not-found UI
렌더 assertion 추가. 관련 프로덕션 diff(`page.tsx`/`href.ts`)와 plan/RESOLUTION 문서도 함께 확인.

## 결론 먼저: W#5 는 실제로 해소됨

원 지적("URL 세그먼트 개수만 봐서 조용한 blank 렌더도 통과하는 약한 가드")은 유효했고, 이번 fix 로
구조적으로 닫혔다. 근거를 코드 레벨에서 직접 추적했다:

1. `(main)/[...rest]/page.tsx:91` — `if (workspacePrefixed && !workspaceRootSlug) notFound();` 가
   **render 본문**에서 동기 호출되고, 같은 조건에서 `useEffect` 는 line 72 `if (workspacePrefixed) return;`
   로 조기 반환해 `router.replace` 를 전혀 호출하지 않는다. 즉 "notFound() 가 아닌 다른 이유로 URL 이
   고정"되는 경로 자체가 프로덕션 코드에 없다 — 하지만 이 사실은 e2e 가 실제로 UI 렌더를 확인해야만
   증명되고(유닛은 `notFound()`를 `throw new Error("NEXT_NOT_FOUND")` 로 mock 하므로 실제 not-found
   바운더리 렌더는 증명 불가), 이번 fix 이전엔 그 증명이 없었다.
2. `(main)/not-found.tsx` → `ErrorPage variant="notFound"` 가 `<h1>{title}</h1>` 을 렌더하고,
   `dict/ko/errorPage.ts` 의 `notFound.title = "페이지를 찾을 수 없습니다"`, `dict/en/errorPage.ts` 의
   `notFound.title = "Page not found"` 를 직접 대조했다 — 테스트의 정규식
   `/페이지를 찾을 수 없습니다|Page not found/` 이 두 로케일 모두와 **정확히** 일치한다(부분/근사
   매치가 아님). 다른 variant(sessionExpired/forbidden/server/network)나 앱 내 다른 위치에 이
   문자열과 겹치는 문구가 없음도 grep 으로 확인했다 — 오탐 위험 없음.
3. 사이드바 유지 assertion(`nav a[href="/docs"]`) — `(main)/layout.tsx` 가 `<Sidebar/>` 와
   `<MainContent>{children}</MainContent>` 를 형제로 렌더하므로, `children` 이 `not-found.tsx`
   바운더리로 대체되어도 Sidebar 는 동일 레이아웃 트리에서 계속 마운트된다. `sidebar.tsx` 는 `<nav>`
   가 하나만 존재하는 구조(바깥 `<nav aria-label=...>` 안에 내부 `<nav>` 중첩)라 CSS 디센던트
   선택자가 동일 앵커를 두 번 매칭하는 strict-mode 충돌도 없다 — 같은 파일의 기존 테스트
   (`"sidebar user-guide link is bare /docs"`, 라인 136)가 이미 동일 locator 를 문제없이 써 왔다.

## 발견사항

- **[INFO]** 404 heading 텍스트 assertion 이 i18n 사전 값을 리터럴로 중복 보유
  - 위치: `codebase/frontend/e2e/workspaces/slug-routing.spec.ts:183`
  - 상세: `/페이지를 찾을 수 없습니다|Page not found/` 는 `dict/ko|en/errorPage.ts` 의 문자열을
    그대로 복제한 것이라, 향후 카피 문구가 바뀌면(다국어 QA 등) 이 e2e 가 프로덕션 로직과 무관하게
    깨진다. 다만 이는 **이번 PR 이 만든 패턴이 아니라 기존 컨벤션의 답습**이다 —
    `e2e/workflows/background-run-section.spec.ts:223` 도 동일하게 `getByRole("heading", {name: /Background 본문 실행/i})` 리터럴 매칭을 쓴다. 즉 이 저장소의 e2e heading assertion 컨벤션 자체가
    "카피 문자열 직접 매칭"이며, 이번 fix 는 그 컨벤션을 정확히 따른 것 — 신규 결함이 아니다.
  - 제안(선택, 이번 PR 불필요): 카피 변경에 대한 내성을 원하면 `ErrorPage` 에
    `data-testid={\`error-page-${variant}\`}` 같은 안정 식별자를 추가하는 저장소 차원의 후속
    개선을 고려할 수 있으나, 컨벤션 통일 이슈라 이번 PR 단독으로 처리할 사안은 아니다.

- **[INFO]** 신규 두 번째 assertion(`nav a[href="/docs"]`)에 명시적 `timeout` 옵션이 없음
  - 위치: `slug-routing.spec.ts:186`
  - 상세: 바로 앞 heading assertion 은 `{ timeout: 15_000 }` 을 명시했지만 사이드바 assertion 은
    기본 타임아웃(설정 안 하면 playwright.config 의 `expect.timeout`, 통상 5s)을 쓴다. 다만 Sidebar
    는 `(main)/layout.tsx` 에서 `not-found` 바운더리와 **같은 렌더 패스**로 마운트되는 형제 컴포넌트라
    heading 이 이미 visible 로 확인된 시점에는 이미 DOM 에 존재할 수밖에 없다 — 실질적 flake 위험은
    낮다고 판단. 대칭성을 위해 동일 timeout 을 맞추는 것은 가능하나 필수는 아니다.
  - 제안(선택): 일관성 차원에서 `{ timeout: 15_000 }` 을 동일하게 명시해도 무방하나, 기능적 리스크는
    없음.

- **[INFO]** `waitForLoadState("networkidle")` 제거는 오히려 flakiness 를 낮추는 방향
  - 위치: 동일 테스트, 이전 diff 라인 67
  - 상세: 제거된 `networkidle` 대기는 Playwright 공식 문서가 SPA/폴링 환경에서 신뢰성이 낮다고
    명시하는 안티패턴이다. 이를 결정론적 UI 상태 기반 `expect(...).toBeVisible()` polling 으로
    대체한 것은 회귀 가드 정밀도뿐 아니라 테스트 안정성 자체도 개선한다. 새 assertion 이 flaky 를
    유발한다는 근거는 코드 추적 결과 발견되지 않았다.

## 테스트 격리·가독성·회귀

- 격리: `mockAuth(page)` 를 각 테스트가 독립 호출하고 Playwright per-test 컨텍스트 격리 하에 실행되어
  테스트 간 상태 공유 없음. 이번 변경은 assertion 추가일 뿐 fixture/setState 를 건드리지 않아 격리에
  영향 없음.
- 가독성: 주석("URL 고정만 보면 조용한 blank 렌더도 통과") 이 assertion 의 **의도**(무엇을 막으려는
  회귀 가드인지)를 명확히 남겨 향후 유지보수자가 이 assertion 을 실수로 삭제/약화시킬 위험을 낮춘다 —
  좋은 패턴.
- 회귀: 기존 세그먼트-카운트 assertion(`pathname` 불변·`/w/` 카운트 1)은 그대로 유지돼 원래 회귀
  가드는 손실 없이 보존됐고, 그 위에 실제 UI 렌더 검증이 추가된 형태 — 순수 강화(strict superset)다.
  `workspace-redirect.test.tsx` 의 대응 유닛 테스트(`존재하지 않는 워크스페이스 스코프 경로...notFound
  로 종결한다` 등)도 이번 diff 로 변경되지 않았고, `WORKSPACE_ROUTE_SEGMENT` 리팩터링은 동작이 아닌
  리터럴 추출이라 동작 계약을 바꾸지 않으므로 유닛 회귀 테스트들도 여전히 유효하다.

## 요약

원 리뷰 W#5 가 지적한 "약한 가드"는 실제 프로덕션 코드 경로(동기 `notFound()` render-throw, effect
조기 반환으로 대체 URL-fix 경로 부재)와 i18n 사전 문자열을 직접 대조한 결과 완전히 해소된 것으로
확인된다. 새 assertion 은 저장소의 기존 heading-assertion 컨벤션을 그대로 따르고, 제거된
`networkidle` 대기는 오히려 flakiness 를 낮추는 방향이라 "새 assertion 이 flaky 하거나 과도하게
구현 세부에 결합"되었다는 우려는 근거가 발견되지 않았다. 남은 것은 선택적 개선(카피 변경 내성을 위한
`data-testid`, timeout 표기 일관성)뿐이며 병합을 막을 사유가 아니다. 보고된 playwright 51/51 통과는
코드 추적 결과와 정합적이다.

## 위험도

NONE
