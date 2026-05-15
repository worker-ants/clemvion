---
worktree: brand-refresh-7a3f12
started: 2026-05-15
owner: developer
---

# Plan: Brand Refresh — Stage 2 (자산·코드 구현)

Stage 1 (`spec/6-brand.md` §8 정식 개정) 의 인수인계를 받아, 신 brand spec 에 맞게 자산을 생성하고 코드에 통합한다.

## 컨텍스트

- **Stage 1 산출물**: `spec/6-brand.md` §8 정식판 (Visual Identity), `spec/2-navigation/_layout.md` §2.1 동기화, `spec/2-navigation/10-auth-flow.md` §1 동기화.
- **사전 일관성 검토**: 1차 `review/consistency/2026/05/15/18_25_10/`, 2차 `review/consistency/2026/05/15/18_36_51/` (BLOCK: NO).
- **원본 컨셉 자산**: `temp/clemvion_logo_concepts.html` (gitignored, 사용자 보관). inline SVG 가 light/dark 페어로 들어있음.
- **현재 코드 상태**: `frontend/public/logo.svg`·`logo-mark.svg`·`frontend/src/app/icon.svg`·`favicon.ico` 는 옛 덩굴 곡선 자산이며 코드에서 거의 참조되지 않음. `frontend/src/app/globals.css` 의 `--primary` 는 generic HSL — brand spec 과 매핑 안 됨.

## 0. 착수 전 의무 절차

- [x] **현재 worktree 확인** — main 워크트리에서 진입 금지. 본 plan 의 worktree 는 `brand-refresh-7a3f12`.
- [x] **`/consistency-check --impl-prep spec/6-brand.md` 호출** (`developer` skill 의무). Critical 0 건 확인 시 착수.
- [x] **Stage 1 산출물 재읽기** — `spec/6-brand.md` §8 (특히 §8.2 컬러 토큰, §8.4 로고 시스템, §8.6 자산 마이그레이션) 과 `_layout.md §2.1`, `10-auth-flow.md §1`.

---

## 1. 자산 생성 (§8.4.1 의 9종)

원본은 `temp/clemvion_logo_concepts.html` 의 inline SVG. 각각 별도 파일로 추출하고 viewBox·색을 spec 토큰과 정렬한다.

### 1.1 SVG 자산 (5종)

- [x] `frontend/public/logo.svg` — Full logo (light). viewBox `260×80`. mark + wordmark + sub-copy 3요소. 색은 §8.2.1 / §8.2.2 의 light 토큰.
- [x] `frontend/public/logo-dark.svg` — Full logo (dark). 동 viewBox. 색은 §8.2.3 의 dark 토큰.
- [x] `frontend/public/logo-mark.svg` — Icon mark (light, 96px master).
- [x] `frontend/public/logo-mark-dark.svg` — Icon mark (dark, 96px master).
- [x] `frontend/public/logo-wordmark.svg` — Wordmark only (sub-copy 없음). 라이트 변종. 다크 변종은 `<Logo />` 컴포넌트의 `currentColor` 활용 또는 추후 분리.

SVG 작성 시 주의:
- 워드마크 `<text>` 의 fontFamily 에 `Helvetica Neue, Helvetica, Arial, sans-serif` 시스템 스택 명시 (§8.3, R-11).
- 워드마크 weight: base 200 / accent `vi` 600. `<tspan font-weight="600" fill="...">vi</tspan>` 활용.
- sub-copy `AGENTIC WORKFLOW` 은 Courier New / 8px / letter-spacing 3px / uppercase.

### 1.2 Favicon multi-size 합성

- [x] **16px 전용 vector 신규 작성** — 96px master 의 단순 축소 금지 (§8.4.2). 노드 ≤ 4 / 라인 ≤ 3 으로 단순화. `frontend/public/favicon-16.svg` 로 배치.
- [x] **32px vector** — `frontend/src/app/icon.svg` 가 master 의 축소판으로 작동. Next.js metadata 가 자동 노출.
- [ ] **48px vector + multi-size `favicon.ico` 합성** — *Follow-up*. ImageMagick / `png-to-ico` 등 raster 도구 필요. 현 PR 에서는 옛 `favicon.ico` 삭제, modern 브라우저는 `icon.svg` 사용.

### 1.3 PNG 자산 (Follow-up)

PNG 변환은 raster 도구(sharp / ImageMagick / Inkscape) 가 필요하므로 별도 PR 로 분리한다. 현 PR 에서는 SVG 등가물을 임시 사용:

- [ ] `frontend/src/app/apple-icon.png` (180×180) — 임시로 `frontend/public/apple-icon.svg` 사용 (modern iOS ≥ 12 가 SVG apple-touch-icon 지원). 폴백 PNG 는 follow-up.
- [ ] `frontend/src/app/opengraph-image.png` (1200×630) — *현 PR 에서는 OG/Twitter `images` 메타데이터 비활성화*. SVG OG 카드는 X/Slack/Facebook 크롤러가 안정적으로 렌더하지 않아 소셜 미리보기가 깨질 위험. PNG 생성 후 `frontend/src/app/layout.tsx` 의 `openGraph.images` 와 `twitter.card`(`summary_large_image`로 복원) 를 재활성화.

---

## 2. CSS 토큰 매핑 (§8.2.4 의 권장 방향 적용)

`frontend/src/app/globals.css` 의 `:root` 와 `.dark` (또는 `[data-theme="dark"]`) 페어를 정리한다.

- [x] **현행 generic HSL `--primary` (`222.2 47.4% 11.2%`) 폐기** → §8.2.1 의 `vine-700` (`#1e7a42`) HSL 변환값으로 교체.
- [x] 라이트 모드 `:root` 매핑:
  - `--primary` ← `vine-700`
  - `--background` ← `soil-50`
  - `--card` ← `soil-100`
  - `--foreground` ← `ink`
  - `--muted-foreground` ← `ink-60` 또는 `ink-40`
  - `--border` ← `vine-border`
- [x] 다크 모드 페어:
  - `--primary` ← `vine-dark-accent`
  - `--background` ← `vine-dark-bg-base`
  - `--card` ← `vine-dark-bg-elevated`
  - `--foreground` ← `text-on-dark`
  - 기타 §8.2.3 대응표 그대로 (단 `--destructive-foreground` 는 red 배경 가독성 보장을 위해 near-white 유지 — globals.css 인라인 주석 참고)
- [x] **HSL/RGB 표현 일관성** — Tailwind / Shadcn 컨벤션 (`hsl(var(--primary))`) 을 유지하려면 HEX → HSL 변환 후 공백 구분 표기 사용.
- [x] **주석으로 매핑 명시** — 각 CSS 변수 옆에 brand 토큰 이름 주석 (`/* vine-700 from spec/6-brand.md §8.2.1 */`).
- [x] **Tailwind v4 `@theme` directive 갱신** — `--color-vine-300 ~ --color-vine-900` ramp + `--color-ink`, `--color-soil-50/100`, `--color-vine-border` 등록. **다크 토큰(`vine-dark-*`) 은 별도 Tailwind 키로 등록하지 않는다** — `:root` / `.dark` CSS 변수 페어(`--primary` 등) 가 자동 전환을 담당 (spec R-10, impl-prep INFO 10).

검증:
- [ ] 매핑 후 dev server 가동 → 사이드바·인증 화면이 신 컬러로 렌더되는지 확인.

---

## 3. 컴포넌트 (`<Logo />`, `<LogoMark />`)

새 컴포넌트 위치: `frontend/src/components/ui/logo.tsx` (Shadcn ui 그룹과 일관).

- [x] `<Logo />` — props:
  - `variant?: "full" | "mark" | "wordmark"` (default: `"full"`)
  - `theme?: "light" | "dark" | "auto"` (default: `"auto"` — Tailwind `dark:` variant 로 CSS 토글)
  - `size?: number` (px) — **기본값 없음**. 미전달 시 underlying SVG 의 natural viewBox 크기로 렌더. caller 가 사용 자리에 맞게 결정 (sidebar=150, auth=200, README inline=280 등).
  - 정적 SVG 파일을 `<img>` 로 임베드. brand SVG 는 ~1–2KB 의 작은 정적 자산이라 `next/image` 의 최적화 이점이 없고, SSR 일관성 위해 plain `<img>` 채택 (`@next/next/no-img-element` lint 는 파일 레벨 disable).
- [x] alt 속성: full = `"Clemvion — Agentic Workflow"` (sub-copy 항상 동반), mark/wordmark = `"Clemvion"`.
- [x] dark variant 자동 전환 — `theme="auto"` 시 두 자산 모두 렌더하고 Tailwind `dark:hidden` / `hidden dark:block` 으로 CSS 토글. server component 호환.

---

## 4. UI 자리 통합 (§8.4.6 의 5개 자리)

### 4.1 사이드바 (`frontend/src/components/layout/sidebar.tsx`)

- [x] 사이드바 최상단에 로고 슬롯 추가. 옛 코드의 productName 텍스트 + "C" 단일 글자를 교체.
- [x] expanded (`!collapsed`) → `<Logo variant="full" theme="auto" size={150} />`
- [x] collapsed → `<LogoMark theme="auto" size={32} />`
- [x] 로고 wrapper 에 `<Link href="/dashboard">` 로 감싸 클릭 시 dashboard 이동 (§8.4.6, `_layout.md §2.1`).

### 4.2 인증 화면 (`frontend/src/app/(auth)/layout.tsx` 또는 폼 컴포넌트)

- [x] `(auth)/layout.tsx` 의 카드 컨테이너 위에 `<Logo variant="full" theme="auto" size={200} />` 중앙 배치 (다크 모드도 자동 전환).
- [x] 배경을 현재 그라데이션 → `bg-[hsl(var(--background))]` 단색으로 교체. soil-50 (라이트) / vine-dark-bg-base (다크) 자동 매핑.
- [x] 영향 받는 페이지: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` (layout 1개에서 일괄 처리).

### 4.3 Next.js metadata (favicon, apple-icon, OG)

- [x] `frontend/src/app/layout.tsx` 의 `metadata.icons` 명시 — `favicon-16.svg` (16×16) + `icon.svg` (32×32) + `apple-icon.svg` (180×180). 자동 인식 의존 제거.
- [x] `openGraph` / `twitter` — `images` 는 **현 PR 에서 비활성화** (SVG OG 카드 크롤러 호환성 이슈). `title` / `description` 만 유지. PNG 자산 생성 후 §1.3 follow-up 에서 `summary_large_image` 카드 + `opengraph-image.png` 복원.
- [x] `metadata.title` / `description` §8.5 어조 검토 — 그대로 유지.

### 4.4 README.md

- [x] 프로젝트 루트 `README.md` 헤더에 full logo svg 임베드 (`<img src="frontend/public/logo.svg" alt="Clemvion — Agentic Workflow" width="280">`). 옛 `prd/brand.md` 링크는 `spec/6-brand.md` 로 정정.

---

## 5. 회귀 테스트 (`make e2e-test`)

- [ ] **Playwright 시각 회귀** — 사이드바 collapsed/expanded, 인증 카드 (login/register/forgot/reset/verify-email), dashboard 헤더. 스냅샷 baseline 갱신은 같은 PR 안에서 처리.
- [ ] **favicon HTML 검증** — `<head>` 안의 `<link rel="icon">`, `<link rel="apple-touch-icon">` 정상 노출 확인.
- [ ] **다크 모드 토글 시각 회귀** — theme switcher 가 이미 구현되어 있다면 같이 검증, 없으면 prefers-color-scheme 매뉴얼 토글.

---

## 6. 마무리 검증 (Stage 2 종료 조건)

- [ ] **§8.2.5 grep 0 건**:
  ```bash
  grep -rnE '\bVine Green\b|\bBud Lime\b|\bDeep Forest\b|\bBark\b|\bSoil\b|#1F8A4C|#A8D86F|#0F3D2A|#6B5544|#F4F1EC|#111111' spec/ frontend/
  grep -rnE '\bInk\b' spec/ frontend/
  ```
  (단, spec/6-brand.md §8.2.5 의 폐기 매트릭스 자체는 의도적으로 보존되어 잡힘 — 그 행 제외 후 0 건 검증)
- [ ] **`spec/6-brand.md §8.2.6` 일시 불일치 윈도우 종료** — 코드 토큰과 spec 토큰이 일치함을 확인.
- [ ] **`/ai-review` 호출** (developer skill 의무) — Critical 0 건 확인.
- [ ] **본 plan 을 `plan/complete/brand-refresh-impl.md` 로 `git mv`**.

---

## 7. PR 생성

- [ ] PR 제목: `feat(brand): refresh visual identity — node graph logo + Vine ramp tokens`
- [ ] 본문 요약: Stage 1 (spec) + Stage 2 (자산·코드) 묶음으로 PR 생성. spec/6-brand.md §9 변경 이력 인용.
- [ ] reviewers: 사용자.

---

## Rationale 검증 (Stage 2 종료 후)

- [ ] `spec/6-brand.md` R-1 ~ R-12 의 의도가 코드/자산에 정확히 반영되었는지 self-review.
- [ ] 특히 R-8 (네이밍), R-11 (system 폰트 스택), R-6 (16px 별도 vector) 는 구현 디테일이므로 specific 검증.
