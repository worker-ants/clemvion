# Architecture Review — Brand Refresh (2026-05-15 19:07:13)

## 발견사항

- **[INFO]** `Logo` 컴포넌트의 단일 책임 원칙 — 적절한 수준
  - 위치: `frontend/src/components/ui/logo.tsx` 전체
  - 상세: `Logo` 컴포넌트는 브랜드 로고 렌더링이라는 단일 책임을 명확히 담당한다. `variant`, `theme`, `size` 세 축의 조합 로직이 한 파일 안에 있지만, 상태/비즈니스 로직 없이 순수 렌더링 함수로 유지된다. `LogoMark` 는 `variant="mark"` 의 단순 별칭(convenience wrapper)으로, 책임 분리 없이 같은 파일에 두는 것이 인터페이스 분리 원칙(ISP) 측면에서 적절하다.
  - 제안: 현행 유지. 추후 `animated` variant 등 동작 로직이 추가된다면 그 시점에 파일 분리를 검토한다.

- **[INFO]** `theme="auto"` 패턴 — CSS-class-based 다크모드 전략
  - 위치: `frontend/src/components/ui/logo.tsx` 553~571줄 (auto 분기)
  - 상세: `theme="auto"` 일 때 light/dark 이미지를 동시에 DOM에 삽입하고 Tailwind `dark:hidden` / `hidden dark:block` 으로 토글하는 이중 렌더 패턴은 SSR 일관성 문제를 회피하는 올바른 선택이다. 단, DOM에 항상 두 `<img>` 가 동시에 존재하므로 `aria-hidden` 처리 없이 두 `alt` 텍스트가 스크린 리더에게 중복 노출될 수 있다.
  - 제안: 숨겨진 이미지(`dark:hidden` / `hidden dark:block`)에 `aria-hidden="true"` 를 추가해 보조 기술 중복 읽기를 방지한다. 예: `className="block dark:hidden" aria-hidden` (dark 이미지 방향도 동일).

- **[WARNING]** `globals.css` 의 CSS 토큰이 `@theme` directive 와 Shadcn-style `:root` 변수 두 계층으로 이중 정의
  - 위치: `frontend/src/app/globals.css` — `:root` 블록 + `@theme` 블록 병존
  - 상세: `:root` 의 `--primary`, `--background` 등은 Shadcn `hsl(var(--name))` 참조 규약을 따른다. 반면 `@theme` 블록에 추가된 `--color-vine-700`, `--color-soil-50` 등은 Tailwind v4 `bg-vine-700`, `text-soil-50` 유틸리티를 위한 static 토큰이다. 현재 `--primary` 는 `vine-700` HSL 로 설정되어 있고 `--color-vine-700` 도 동일 HEX 로 존재한다 — 단일 진실(single source of truth) 원칙에 반하는 의미적 중복이다. 두 계층 중 하나가 수정되면 다른 계층이 묵시적으로 불일치 상태가 된다.
  - 제안: (a) `@theme` 의 `--color-vine-700` 을 기준 값으로 두고, `:root` 의 `--primary` 에서 `hsl(from var(--color-vine-700) h s l)` 형태로 참조하거나, (b) CSS 변수 주석에 두 토큰이 동일 HEX 임을 명시하고 Linting rule (`no-duplicate-values` 류) 로 drift 를 감지하도록 설정한다. 현재 단계(spec 정식화 직후)에서는 최소한 주석으로 *"vine-700 = #1e7a42 = hsl(143.5 60.5% 29.8%); --primary 와 --color-vine-700 은 동일값이며 의도적 이중 정의"* 를 명시해 미래 개발자의 혼란을 방지한다.

- **[WARNING]** `globals.css` 의 dark mode `--destructive-foreground` 가 라이트/다크 대칭을 깨뜨림
  - 위치: `frontend/src/app/globals.css`, `.dark` 블록 `--destructive-foreground`
  - 상세: 라이트 모드: `--destructive-foreground: 210 40% 98%` (Shadcn 기본값 그대로). 다크 모드: `--destructive-foreground: 138.5 39.4% 93.5%` (brand `text-on-dark`). 변경 전에는 다크도 `210 40% 98%` 로 동일했다. 다크 모드에서만 초록 계열(`text-on-dark`)로 교체되었는데, 이는 destructive(빨강) 버튼 위 텍스트가 라이트에서는 흰색, 다크에서는 옅은 녹색이 된다는 의미다. 의도된 디자인이라면 spec 에 명시 근거가 필요하며, 의도치 않은 경우 대비비 확인이 필요하다.
  - 제안: `spec/6-brand.md` 에 `--destructive-foreground` dark mode 값 근거를 추가하거나, 라이트/다크 일관성 유지를 위해 `210 40% 98%` 로 되돌린다. WCAG 2.1 AA (`--destructive` 다크 값 `hsl(0 62.8% 30.6%)` 위 `138.5 39.4% 93.5%` 의 대비비)를 도구로 확인할 것을 권고한다.

- **[INFO]** `AuthLayout` 의 레이어 책임 — 프레젠테이션 레이어 적절
  - 위치: `frontend/src/app/(auth)/layout.tsx`
  - 상세: 레이아웃 컴포넌트는 구조(wrapper, 로고, 제약 컨테이너)만 담당하고 상태·비즈니스 로직을 전혀 포함하지 않는다. `<Logo>` 컴포넌트와의 결합도가 낮고(props 주입 방식), 인증 하위 페이지(`children`)와는 합성(composition) 패턴으로 연결된다.
  - 제안: 현행 유지.

- **[INFO]** `sidebar.tsx` 의 Logo 교체 — 결합도 관점
  - 위치: `frontend/src/components/layout/sidebar.tsx` `+import { Logo, LogoMark }`
  - 상세: 이전에는 텍스트 `"C"` / `t("sidebar.productName")` 를 직접 인라인으로 렌더했다. 이제 `Logo`/`LogoMark` 컴포넌트에 의존하므로 컴포넌트 간 결합이 생겼으나, 이는 UI 컴포넌트 재사용을 위한 정상적인 결합도 수준이다. `ui/logo` → `layout/sidebar` 방향의 단방향 의존성이고 역방향 순환은 없다.
  - 제안: 현행 유지. `sidebar.tsx` 가 이미 매우 큰 파일(37+ import)임을 감안해, 로고 외 추가 브랜드 관련 UI가 생기면 별도 slot 컴포넌트로 추출하는 것을 중장기 개선 목표로 고려한다.

- **[INFO]** `layout.tsx` metadata 의 `twitter.images` 와 `openGraph.images` 불일치
  - 위치: `frontend/src/app/layout.tsx`, `twitter` 블록 301줄
  - 상세: `openGraph.images` 는 객체 배열(`{ url, width, height, type, alt }`)로 상세 정의되어 있으나, `twitter.images` 는 단순 문자열 배열(`["/opengraph-image.svg"]`)로 간략화되어 있다. 기능상 큰 문제는 아니지만, 두 섹션이 동일 자산을 참조하는데 표현 방식이 다르면 향후 자산 경로 변경 시 하나만 수정하는 실수가 생길 수 있다.
  - 제안: `twitter.images` 도 `openGraph.images` 와 동일한 객체 형태로 통일하거나, 공통 상수(`const OG_IMAGE = ...`)로 추출해 두 필드가 동일 소스를 참조하도록 한다.

- **[INFO]** `plan/complete/spec-draft-brand-refresh.md` 배치 — PLAN 라이프사이클 적절
  - 위치: `plan/complete/spec-draft-brand-refresh.md`
  - 상세: Stage 1 spec 작성이 완료된 plan 을 `plan/complete/` 에 두고, Stage 2 구현 plan 은 `plan/in-progress/` 에 별도로 분리했다. CLAUDE.md 의 plan 라이프사이클 규약을 정확히 따르고 있다.
  - 제안: 현행 유지.

- **[INFO]** 브랜드 토큰 CSS 정의에 dark-mode 전용 `vine-dark-*` 토큰이 `@theme` 에 없음
  - 위치: `frontend/src/app/globals.css`, `@theme` 블록
  - 상세: `@theme` 에는 라이트 토큰(`vine-300~900`, `ink`, `soil-*`, `vine-border`)만 등록되어 있고, `vine-dark-accent`, `vine-dark-bg-base` 등 다크 토큰은 CSS 변수(`.dark {}`) 에만 묵시적으로 HEX 로 삽입된다. `spec/6-brand.md` R-10 및 `impl-prep INFO 10` 에 *"dark 변종은 별도 Tailwind key 로 등록하지 않는다"* 가 명시되어 있어 의도적 설계다. 다만 다크 HEX 값이 `.dark {}` 내 주석에만 존재하고 named constant 가 없어, 다크 토큰을 직접 참조해야 하는 드문 사례(예: 인라인 SVG)에서 주석을 직접 파헤쳐야 한다.
  - 제안: 향후 다크 모드 SVG 자산 생성 시, CSS custom property 로라도 `--color-vine-dark-accent` 를 `:root` 에 정의해두면 SVG `fill="var(--color-vine-dark-accent)"` 패턴을 사용할 수 있다. 단, 현 단계에서는 spec R-10 을 준수하는 현행 방식이 옳다.

- **[WARNING]** `Logo` 컴포넌트의 `size` 기본값이 코드와 spec(plan) 사이에 불일치
  - 위치: `frontend/src/components/ui/logo.tsx` 함수 시그니처; `plan/in-progress/brand-refresh-impl.md` §3
  - 상세: `plan/in-progress/brand-refresh-impl.md` §3 은 `size` 기본값을 `full=160 / mark=32 / wordmark=120` 으로 명시했으나, 구현된 `logo.tsx` 에서는 `size` 가 `undefined` 로 기본값 없이 SVG 자연 크기에 맡긴다. 사용 측(`auth/layout.tsx`: `size={200}`, `sidebar.tsx`: `size={150}`, `size={32}`)이 모두 명시적으로 전달하므로 현재는 문제가 없으나, plan 과 코드 간 계약이 어긋나 있다.
  - 제안: `plan/in-progress/brand-refresh-impl.md` §3 의 기본값 명세를 실제 구현(기본값 없음 = SVG 자연 크기)에 맞게 수정하거나, `Logo` 에 `variant` 별 기본값 로직을 추가한다. 어느 쪽이든 spec/plan 과 코드의 계약을 일치시킨다.

---

## 요약

이번 변경셋은 브랜드 비주얼 아이덴티티 刷新을 위한 CSS 토큰 재정의, `Logo`/`LogoMark` UI 컴포넌트 신규 도입, 사이드바·인증 레이아웃·메타데이터 통합의 세 축으로 구성된다. 전체적으로 레이어 책임 분리(프레젠테이션 계층만 영향)가 잘 지켜지고 있으며, `Logo` 컴포넌트는 단일 책임과 합성 패턴을 올바르게 적용했다. 단방향 의존성(`ui/logo` → `layout/sidebar`, `layout/auth`)도 문제없다. 주요 아키텍처 위험은 `globals.css` 에서 Shadcn `:root` 변수와 Tailwind `@theme` 변수가 동일 브랜드 토큰을 이중으로 정의하는 구조로, 향후 토큰 값 변경 시 두 계층 간 drift 가 발생할 수 있다. 또한 `theme="auto"` 패턴의 이중 `<img>` DOM 삽입에서 보조 기술 중복 노출 및 dark mode `--destructive-foreground` 의 색조 불일치가 경미한 설계 위험으로 존재한다. 확장성 측면에서 `Logo` 는 새 variant 나 asset 추가가 `ASSET_PATHS` 상수 수정으로 충분한 개방-폐쇄 원칙 친화적 구조이다.

## 위험도

LOW
