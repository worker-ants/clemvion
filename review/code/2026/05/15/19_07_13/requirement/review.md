# 요구사항(Requirement) 코드 리뷰

대상 변경: Brand Refresh — Stage 2 (node graph logo + Vine ramp tokens)
리뷰 일시: 2026-05-15

---

## 발견사항

### [WARNING] `logo.tsx` — `theme="auto"` 시 두 `<img>` 에 동일 `alt` 속성이 중복 선언됨
- **위치**: `frontend/src/components/ui/logo.tsx` lines 556–569 (auto 브랜치)
- **상세**: `theme="auto"` 렌더 시 light/dark 두 `<img>` 모두 동일한 `resolvedAlt` 값을 `alt` 로 갖는다. 화면 낭독기(screen reader)는 두 이미지를 독립된 요소로 인식하므로, 하나가 CSS 로 숨겨졌더라도 `display:none` 이 아닌 Tailwind `hidden` 클래스(visibility 기반이 아니라 `display` 기반)가 적용될 경우에도 문제가 없지만, 실제로 둘 다 DOM 에 존재하므로 `hidden dark:block` 쪽 이미지는 라이트 모드에서도 accessibility tree 에 포함될 수 있다. `aria-hidden="true"` 를 숨겨지는 이미지에 추가해 접근성 이중 노출을 방지해야 한다.
- **제안**: light 이미지에 `aria-hidden="true"` (다크 모드 시 숨겨지는 쪽), dark 이미지에 동일하게 처리하거나, 두 `<img>` 중 하나를 presentational(`role="presentation"`)로 표시한다. 혹은 spec §8.4 에 접근성 처리 방법을 명시해 구현 가이드를 확정한다.

---

### [WARNING] `logo.tsx` — `size` prop 미전달 시 SVG 자연 크기에 의존하나 스펙에 기본값 정의 없음
- **위치**: `frontend/src/components/ui/logo.tsx` line 542; `plan/in-progress/brand-refresh-impl.md` §3
- **상세**: `Logo` 컴포넌트는 `size` 가 `undefined` 이면 `style` 을 적용하지 않아 SVG 가 자체 `viewBox` 크기로 렌더된다. 그런데 `plan/in-progress/brand-refresh-impl.md` §3 은 "default: full=160 / mark=32 / wordmark=120" 기본값을 제안하지만, 실제 구현 코드는 기본값을 적용하지 않는다. spec 이 기본 크기를 정의하고 있지 않아(spec §8.4.1 에 뷰박스 기재만 있음) 의도와 구현 간 괴리가 발생했다. SVG `viewBox` 자연 크기가 공식 기본 렌더 크기임을 spec 에서 명시하지 않으면, 사용처마다 크기를 직접 지정해야 하는 부담이 생기고 일관성이 깨진다.
- **제안**: spec §8.4.3 또는 §8.4.6 에 `size` 기본값(또는 "SVG 자연 크기를 기본으로 한다")을 명시하거나, `Logo` 컴포넌트 자체에 `variant` 별 기본 `size` 를 코드로 정의한다. `plan/in-progress/brand-refresh-impl.md` §3 의 기본값 제안을 코드에 반영하는 것도 방법이다.

---

### [WARNING] `layout.tsx` (auth) — `Logo` 에 `theme="auto"` 대신 `theme="light"` 를 사용하지만, 다크 모드 인증 화면 시나리오 미정의
- **위치**: `frontend/src/app/(auth)/layout.tsx` line 84; spec §8.4.6 및 `plan/in-progress/brand-refresh-impl.md` §4.2
- **상세**: `plan/in-progress/brand-refresh-impl.md` §4.2 는 인증 화면에 `<Logo variant="full" theme="light" />` 를 명시했고 구현도 이를 따른다. 그런데 배경색이 `bg-[hsl(var(--background))]` 로 되어 있어 다크 모드 시 `vine-dark-bg-base` 로 자동 전환된다. 라이트 전용 로고(`/logo.svg`)가 짙은 다크 배경 위에 렌더되면 충분한 명도 대비를 보장하지 못한다. spec `cross_spec` 리뷰(파일 18)도 이 시나리오를 WARNING 으로 지적했으나 코드에는 반영되지 않았다.
- **제안**: 인증 화면 다크 모드에서 로고 가시성을 보장하기 위해 `theme="auto"` 로 변경하거나, `(auth)/layout.tsx` 에 다크 모드 억제 클래스(`data-theme="light"`, 또는 `dark` 클래스 제거)를 적용한다. spec §8.4.6 에 인증 화면 배경이 항상 라이트임을 확정 명시해야 한다.

---

### [WARNING] `layout.tsx` (root) — `apple-icon`, `opengraph-image` 이 SVG 로 선언됐으나 실제 파일 존재 여부 불명확, `favicon-16.svg` 경로도 spec 과 불일치
- **위치**: `frontend/src/app/layout.tsx` lines 277–302
- **상세**: `icons.apple` 에 `/apple-icon.svg` (SVG), `openGraph.images` 에 `/opengraph-image.svg` 가 선언되어 있다. 그런데 `plan/in-progress/brand-refresh-impl.md` §1.3 은 `apple-icon.png` (180×180 PNG), `opengraph-image.png` (1200×630 PNG) 를 Stage 2 산출물로 지정하고 있다 — SVG 가 아니라 PNG 다. 또한 spec `plan/in-progress/brand-refresh-impl.md` §4.3 이 제시한 metadata 예시(`icons.icon: [{ url: "/favicon.ico" }, { url: "/icon.svg" }]`)와도 불일치한다: 실제 코드는 `favicon.ico` 대신 `favicon-16.svg` 를 선언하며, `apple` 에도 PNG 배열이 아닌 SVG 단일 객체를 사용한다. 이 아이콘 파일들이 `frontend/public/` 또는 `frontend/src/app/` 에 실제 존재하지 않으면 브라우저가 404 를 받는다.
- **제안**: (1) `apple-icon` 과 `opengraph-image` 의 확장자를 실제 생성 자산(PNG)에 맞춰 일치시킨다. (2) `favicon-16.svg` 파일이 실제로 존재하는지 확인 후 없으면 경로를 수정한다. (3) Stage 2 인수인계 항목의 metadata 예시와 실제 코드 선언을 동기화한다.

---

### [WARNING] `globals.css` — `@theme` 블록에 dark 토큰(`vine-dark-*`, `text-on-dark`)이 등록되지 않음
- **위치**: `frontend/src/app/globals.css` lines 229–241 (`@theme` 블록)
- **상세**: `@theme` 블록에는 라이트 모드 Vine Ramp(`vine-300 ~ vine-900`) 와 Neutral 토큰만 등록되어 있다. spec §8.2.3 의 다크 토큰(`vine-dark-bg-base`, `vine-dark-accent`, `vine-dark-spine` 등)은 CSS 변수(`.dark` 섹션)로 매핑됐지만 Tailwind theme 키로는 등록되지 않았다. `plan/in-progress/brand-refresh-impl.md` §2 는 "Tailwind theme 갱신 — `vine-dark-*` 추가"를 체크리스트에 포함하고 있으나 미이행 상태다. 다크 모드 상태 배지, 특수 UI 등에서 `bg-vine-dark-accent` 같은 Tailwind 클래스를 직접 사용할 때 동작하지 않는다. 단, 주석(lines 225–228)이 "Dark variants 는 CSS variables 를 통해서만 사용, Tailwind 키로 분리 등록하지 않는다 (spec R-10)"고 명시하고 있어 의도된 설계일 수 있다.
- **제안**: 주석 선언과 `plan/in-progress/brand-refresh-impl.md` §2 의 "vine-dark-* 추가" 체크리스트 항목이 모순된다. spec §8.2.4 (또는 R-10)에서 다크 토큰의 Tailwind 등록 여부를 명확히 확정하고, plan 체크리스트를 이에 맞게 갱신해야 한다.

---

### [INFO] `logo.test.tsx` — `theme="auto"` 테스트가 `hidden: true` 옵션을 사용하지만 `wordmark` variant 의 auto 동작 테스트 누락
- **위치**: `frontend/src/components/ui/__tests__/logo.test.tsx`
- **상세**: `theme="auto"` 테스트는 `variant="full"` 과 `LogoMark`(=`variant="mark"`) 에 대해서만 작성되어 있다. `variant="wordmark"` 에 대한 `theme="auto"` 테스트가 없다. `ASSET_PATHS.wordmark` 는 `light` 와 `dark` 경로가 동일(`/logo-wordmark.svg`)하므로 auto 렌더 시 두 `<img>` 가 동일 `src` 로 렌더되어 DOM 상 이미지가 2개 존재한다. 이 동작이 의도한 것인지 테스트로 검증되지 않는다.
- **제안**: `variant="wordmark"` + `theme="auto"` 케이스에 대한 테스트를 추가한다. 또는 `logo.tsx` 에서 `light === dark` 일 때 단일 `<img>` 로 렌더하는 최적화 분기를 두고 그에 대한 테스트를 작성한다.

---

### [INFO] `logo.test.tsx` — `size` prop 미전달 시의 동작 테스트 없음
- **위치**: `frontend/src/components/ui/__tests__/logo.test.tsx`
- **상세**: `size` prop 을 명시적으로 전달하는 테스트("applies size prop as inline width style", line 429)는 있지만, `size` 를 전달하지 않을 때 `style` 속성이 존재하지 않는지(또는 `undefined`) 검증하는 테스트가 없다. 엣지 케이스: `size={0}` 전달 시 `style.width = "0px"` 가 설정되며 이는 렌더 의도와 다를 수 있다(`0` 은 falsy 가 아니어서 조건 `size != null` 을 통과한다).
- **제안**: (1) `size` 미전달 시 `style` 속성 없음을 검증하는 테스트 추가. (2) `size={0}` 같은 경계값 처리 여부를 결정하고 로직(예: `size > 0` 조건)과 테스트를 함께 작성한다.

---

### [INFO] `plan/complete/spec-draft-brand-refresh.md` — plan 파일이 `complete/` 로 이동됐으나 내부에 미완성 항목이 남아 있는지 확인 필요
- **위치**: `plan/complete/spec-draft-brand-refresh.md`
- **상세**: 파일이 `plan/complete/` 에 위치하므로 CLAUDE.md 규약상 "모든 항목 완료"를 의미한다. 그런데 문서 안에는 "Stage 2 인수인계 항목" 과 §8.2.6 "일시 불일치 허용 윈도우", "다음 액션" 섹션이 있다. Stage 2 가 `plan/in-progress/brand-refresh-impl.md` 로 위임되었다면 본 문서의 상태 이동 자체는 적법하다. 그러나 문서 내 미체크 체크박스(`[ ]`)가 존재할 경우 규약 위반이다. diff 범위 내에서 plan/complete 로의 이동만 확인되므로 큰 위반은 아니지만, 현행 파일에 `[ ]` 항목이 없는지 최종 검증이 권장된다.
- **제안**: 머지 전에 `plan/complete/spec-draft-brand-refresh.md` 내 모든 체크박스가 `[x]` 로 완료됐는지, 또는 미완 항목이 `brand-refresh-impl.md` 로 적절히 위임됐는지 확인한다.

---

### [INFO] `sidebar.tsx` — `aria-label` 이 translation key `t("sidebar.productName")` 를 사용하는데, 해당 키의 값이 "Clemvion" 인지 스펙 명시 없음
- **위치**: `frontend/src/components/layout/sidebar.tsx` lines 342, 352
- **상세**: `expanded` / `collapsed` 두 `<Link>` 의 `aria-label` 이 모두 `t("sidebar.productName")` 번역 키를 사용한다. `Logo` 컴포넌트 자체가 이미 `alt="Clemvion"` 을 갖고 있으므로, `<Link>` 의 `aria-label` 이 중복 접근성 레이블 역할을 한다. 또한 `Link` 안에 `<img alt="Clemvion">` 이 있으면 screen reader 는 "link, Clemvion" 과 같이 읽어 `aria-label` 이 불필요해진다.
- **제안**: `<Link>` 의 `aria-label` 을 제거하거나, `Logo` 에 `alt=""` (presentational)를 전달하고 `<Link>` 에 의미 있는 `aria-label` 을 유지하는 방식 중 하나를 선택해 접근성 이중 노출을 정리한다.

---

## 요약

이번 변경은 brand-refresh Stage 2 의 핵심 코드 구현(CSS 토큰 매핑, `<Logo>` 컴포넌트 신설, 사이드바·인증 레이아웃 통합, metadata 갱신, README 업데이트)으로, spec §8 의 의도를 전반적으로 잘 반영하고 있다. 기능 완전성 측면에서는 `Logo`/`LogoMark` 컴포넌트의 variant·theme·size 조합이 모두 구현됐고 테스트도 대부분 작성됐다. 그러나 다크 모드에서 인증 화면 로고 대비 미보장(라이트 전용 로고 + 다크 배경 공존), apple-icon/opengraph-image 파일 확장자 불일치(SVG 선언 vs PNG 생성 계획), `favicon-16.svg` 경로 존재 불확실, `@theme` 다크 토큰 등록 여부 모호성 등 4개의 WARNING 이 제품 출시 전 해소가 필요한 요구사항 구현 결함이다. `theme="auto"` 의 접근성 중복 노출 및 `size` 기본값 미정의 등 INFO 항목은 즉각적 기능 장애는 아니지만 spec-구현 간 괴리 또는 테스트 커버리지 공백으로 향후 유지보수 부담이 될 수 있다.

## 위험도

MEDIUM
