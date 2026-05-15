# 성능(Performance) 리뷰

## 발견사항

- **[WARNING]** `theme="auto"` 시 두 SVG 이미지를 동시에 DOM에 로드
  - 위치: `frontend/src/components/ui/logo.tsx` — `Logo` 컴포넌트 `theme === "auto"` 분기 (라인 554~571)
  - 상세: `theme="auto"` 일 때 light 이미지와 dark 이미지 두 개를 동시에 `<img>` 태그로 렌더하고, CSS `dark:hidden` / `hidden dark:block` 클래스로 한 쪽을 숨기는 방식을 사용한다. 브라우저는 CSS로 숨겨진 `<img>` 도 네트워크 요청을 발생시키므로 항상 두 SVG 자산을 동시 요청한다. 사이드바(`sidebar.tsx`)와 인증 레이아웃(`(auth)/layout.tsx`) 양 쪽에서 `theme="auto"` 를 사용하고 있어 페이지 로드 시 최소 2~4개 SVG 요청이 추가된다. SVG는 일반적으로 작은 편이나, 개념적으로는 낭비되는 네트워크 왕복이 발생한다.
  - 제안: (1) `prefers-color-scheme` 미디어쿼리를 CSS에서 처리하는 방식 유지 시 현행도 수용 가능하나, `<picture>` + `<source media="(prefers-color-scheme: dark)">` 패턴으로 전환하면 브라우저가 현재 테마에 맞는 이미지 한 개만 다운로드한다. (2) 또는 Next.js `next-themes` provider를 이미 사용 중이라면 `useTheme()` 훅으로 resolved theme을 읽어 단일 `<img>` 를 조건부 렌더하는 방식도 가능(단, 클라이언트 컴포넌트 필요).

- **[INFO]** `<img>` 사용으로 Next.js 이미지 최적화 미적용
  - 위치: `frontend/src/components/ui/logo.tsx` 라인 483~488 (eslint-disable 주석)
  - 상세: 코드에 `next/image` 비사용 이유를 명시적으로 주석으로 설명하고 있다("SVG는 어차피 unoptimized로 통과"). SVG 자산 특성상 raster 포맷 변환이 불필요하며 파일 크기가 작아 현행 판단은 합리적이다. 다만 `next/image`의 `priority` prop이나 `loading="eager"` 설정을 통해 LCP(Largest Contentful Paint) 관점에서 사이드바 로고 및 인증 화면 로고를 브라우저 힌트에 미리 알릴 기회를 놓친다.
  - 제안: 인증 화면 로고처럼 above-the-fold에 위치하는 로고에 `<link rel="preload" as="image" href="/logo.svg">` 를 `layout.tsx` 의 `<head>` 에 추가하거나, `Logo` 컴포넌트에 `fetchPriority="high"` 속성을 선택적으로 전달할 수 있는 prop을 추가하는 것을 검토한다.

- **[INFO]** OG 이미지를 SVG로 선언
  - 위치: `frontend/src/app/layout.tsx` — `openGraph.images` 및 `twitter.images` (라인 283~302)
  - 상세: `opengraph-image.svg` 와 `twitter.images: ["/opengraph-image.svg"]` 로 SVG를 OG 이미지로 등록하고 있다. Twitter/X, Facebook, Slack 등 대부분의 SNS 크롤러는 OG 이미지로 SVG를 지원하지 않거나 불완전하게 지원한다. 자산 렌더링에 실패해 빈 미리보기가 노출될 수 있으며, 이는 기능적 결함에 가깝다. plan 내 "PNG 미완료" 추적 사항으로 이미 인식하고 있으나, 코드에 SVG를 명시적으로 등록한 채로 머지 시 실제 OG 공유가 깨진다.
  - 제안: PNG 자산이 준비될 때까지 `openGraph.images` / `twitter.images` 등록을 주석 처리하거나 fallback PNG를 임시로 두는 것이 안전하다. 또는 `type: "image/svg+xml"` 명시를 제거해 브라우저/크롤러가 SVG를 인식하지 않을 때 graceful degradation이 되도록 한다.

- **[INFO]** 인증 레이아웃의 로고 컴포넌트에 `theme="auto"` 대신 `theme="light"` 적용
  - 위치: `frontend/src/app/(auth)/layout.tsx` 라인 84
  - 상세: 인증 화면 배경이 `soil-50` 단색(라이트 배경)으로 고정되어 있음에도 `<Logo variant="full" theme="auto" size={200} />` 를 사용한다. `theme="auto"` 는 두 SVG를 모두 로드하고 DOM에 올린다. 배경이 테마 독립적인 단색이라면 `theme="light"` 를 사용해도 무방하며, 불필요한 dark SVG 로드를 줄일 수 있다. spec의 `10-auth-flow.md §1` 에도 "light 로고" 사용 명시가 있다.
  - 제안: `(auth)/layout.tsx` 의 `<Logo>` 를 `theme="light"` 로 변경한다.

- **[INFO]** `ASSET_PATHS` 와 `DEFAULT_ALT` 를 모듈 최상위 상수로 선언 — 성능상 적절
  - 위치: `frontend/src/components/ui/logo.tsx` 라인 517~530
  - 상세: 두 객체가 모듈 스코프에서 한 번만 초기화되어 렌더 마다 재생성되지 않는다. 현행 구현은 성능 관점에서 올바르다. 추가 조치 불필요.
  - 제안: 해당 없음.

## 요약

이번 변경은 브랜드 토큰 정비와 Logo 컴포넌트 신설이 핵심으로, 성능 관점의 구조적 결함은 없다. 가장 주목할 부분은 `theme="auto"` 패턴에서 CSS visibility 토글을 위해 두 SVG 이미지를 항상 동시 로드하는 방식으로, `<picture>` 태그 활용이나 클라이언트 훅 기반 단일 렌더로 전환하면 불필요한 네트워크 요청 한 건을 아낄 수 있다. 인증 레이아웃은 배경이 라이트 고정임에도 `theme="auto"` 를 사용해 dark SVG를 낭비 로드하는 소규모 비효율이 있다. OG 이미지 SVG 등록은 크롤러 호환성 문제로 기능 결함에 가깝지만, plan 에서 인지된 미완 사항이므로 추적 관리 중임을 확인한다. 전체적으로 심각한 성능 병목은 없으며 위험도는 낮다.

## 위험도

LOW
