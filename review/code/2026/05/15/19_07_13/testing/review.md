# Testing Review — Brand Refresh (brand-refresh-7a3f12)

## 발견사항

---

### [INFO] 핵심 컴포넌트(`Logo`, `LogoMark`)에 단위 테스트 존재 — 양호
- **위치**: `frontend/src/components/ui/__tests__/logo.test.tsx`
- **상세**: `logo.tsx` 신규 컴포넌트에 대해 Vitest + Testing Library 기반 단위 테스트(10개 케이스)가 함께 추가되었다. variant 3종, theme 3종, size prop, alt override, className forwarding, `LogoMark` convenience wrapper 등 컴포넌트 공개 API의 주요 경로를 커버하고 있다.
- **제안**: 현행 커버리지 유지. 아래 WARNING/INFO 항목에서 누락된 케이스 보완 권장.

---

### [WARNING] `theme="auto"` + `wordmark` 조합 케이스 누락
- **위치**: `logo.test.tsx` — `describe("Logo")` 블록
- **상세**: `wordmark` variant 는 현재 `ASSET_PATHS` 에서 light/dark 가 동일 파일(`/logo-wordmark.svg`)로 정의되어 있다. `theme="auto"` 일 때 `wordmark` 변종은 두 `<img>` 를 모두 렌더하게 되는데, 이 동작이 테스트에서 검증되지 않는다. 코드 코멘트에도 "A dedicated dark wordmark can be added later" 라고 미래 변경 가능성이 명시되어 있으므로, 현재 동작을 스냅샷으로 고정해 두어야 회귀를 즉시 감지할 수 있다.
- **제안**: `theme="auto"` + `variant="wordmark"` 조합 케이스 추가. 두 `<img>` 가 동일 `src`(`/logo-wordmark.svg`)를 가지는지, `dark:hidden`/`hidden dark:block` 클래스가 올바르게 붙는지 확인한다.

---

### [WARNING] `size` prop의 `height: auto` 스타일 검증 미흡
- **위치**: `logo.test.tsx` line 53-57
- **상세**: `size` prop 테스트는 `style.width === "200px"` 만 확인한다. `logo.tsx` 의 `style` 객체는 `{ width: "200px", height: "auto" }` 를 함께 설정하는데, `height: "auto"` 에 대한 검증이 없다. size 미전달 시(`size` = undefined) `style` prop 자체가 `undefined` 가 되어야 하는 경로도 검증되지 않는다.
- **제안**: (1) `size` 전달 시 `style.height === "auto"` assertion 추가. (2) `size` 미전달 케이스에서 img 의 `style` 속성이 비어있거나 부재함을 확인하는 테스트 추가.

---

### [WARNING] `theme="auto"` 렌더링 시 두 `<img>` 의 `alt` 중복 노출 — 접근성 회귀 감지 테스트 없음
- **위치**: `logo.test.tsx` lines 39-51
- **상세**: `theme="auto"` 일 때 동일 `alt` 값을 가진 `<img>` 가 두 개 렌더된다. 스크린 리더는 두 이미지를 모두 노출한다(하나는 CSS `hidden` 이어도 AT 가 읽을 수 있음). 현재 테스트는 `src`와 className 만 확인하고, alt 중복으로 인한 접근성 영향을 검증하지 않는다. 향후 `aria-hidden`을 추가하거나 alt를 빈 문자열로 처리하는 방향으로 변경될 때 회귀를 감지하기 어렵다.
- **제안**: `theme="auto"` 케이스에서 dark 이미지의 `aria-hidden` 여부 또는 alt 처리 방식을 assertion에 포함한다. 현재 동작이 의도적이라면 주석으로 명시하고, 추후 변경 시 테스트를 함께 갱신한다.

---

### [WARNING] `sidebar.tsx` 변경에 대한 단위 테스트 없음
- **위치**: `frontend/src/components/layout/sidebar.tsx` (파일 5)
- **상세**: 사이드바의 로고 영역이 `t("sidebar.productName")` 텍스트 노드에서 `<Logo>` / `<LogoMark>` 컴포넌트로 교체되었다. 사이드바에 대한 기존 단위 테스트 파일이 존재하는지 확인되지 않았으나(`sidebar.test.tsx` 미발견), 변경이 있는 컴포넌트에 대해 (1) expanded 상태에서 Full Logo가 렌더되는지, (2) collapsed 상태에서 LogoMark가 렌더되는지, (3) 두 경우 `aria-label`이 올바른지를 검증하는 테스트가 없다.
- **제안**: `sidebar.tsx` 의 로고 슬롯에 대한 단위 테스트 추가. collapsed/expanded 상태를 prop으로 제어할 수 있도록 컴포넌트 구조가 허용하는 경우 해당 분기를 직접 테스트한다. 통합 테스트 수준에서는 e2e 의 sidebar collapsed/expanded 시각 회귀로 커버 가능하다.

---

### [WARNING] `(auth)/layout.tsx` 변경에 대한 단위 테스트 없음
- **위치**: `frontend/src/app/(auth)/layout.tsx` (파일 2)
- **상세**: auth 레이아웃에 `<Logo>` 컴포넌트 삽입과 배경 클래스 변경이 이루어졌다. 이 레이아웃 컴포넌트에 대한 단위/통합 테스트가 없다. 로고가 렌더되는지, Link href가 `/`인지, aria-label이 올바른지 등은 현재 자동 테스트로 검증되지 않는다.
- **제안**: `(auth)/layout.tsx` 에 대한 단위 테스트 추가 또는 Playwright e2e의 a11y smoke 테스트에서 로고 존재 여부 확인 케이스 추가. `e2e/a11y/smoke.spec.ts` 에 로그인 페이지에서 `img[alt="Clemvion"]` 또는 `a[aria-label="Clemvion"]` 존재 검증 assertion을 추가하는 방법이 가장 현실적이다.

---

### [WARNING] plan/in-progress 에 명시된 Playwright 시각 회귀 테스트 미작성
- **위치**: `plan/in-progress/brand-refresh-impl.md` §5 (파일 9)
- **상세**: plan §5에 "사이드바 collapsed/expanded, 인증 카드, 다크 모드 토글 시각 회귀"를 Playwright로 검증하는 항목이 정의되어 있으나, 이번 변경 diff에서 해당 e2e 스펙 파일은 추가되지 않았다. 기존 `e2e/auth/login.spec.ts` 등은 기능 흐름을 검증하지만 로고 렌더링·배경색 변경에 대한 시각 검증은 포함하지 않는다.
- **제안**: Stage 2 완료 전에 다음 e2e 케이스 작성 필요: (1) `sidebar` collapsed/expanded 상태에서 로고 img src 확인, (2) `/login`, `/register` 등 auth 페이지에서 로고 img 존재 확인, (3) (선택) `prefers-color-scheme: dark` 환경에서 dark variant img가 visible인지 확인.

---

### [INFO] `globals.css` 및 `layout.tsx` 메타데이터 변경에 대한 직접 테스트 없음 — 구조적으로 허용
- **위치**: `frontend/src/app/globals.css` (파일 3), `frontend/src/app/layout.tsx` (파일 4)
- **상세**: CSS 변수 토큰 변경과 metadata(icons/OG) 변경은 단위 테스트로 직접 검증하기 어려운 영역이다. CSS 시각 결과는 시각 회귀 테스트, metadata는 HTML `<head>` 파싱 테스트로 접근해야 한다. plan §5의 "favicon HTML 검증" 항목(`<link rel="icon">`, `<link rel="apple-touch-icon">` 확인)이 이 영역을 커버하도록 계획되어 있으나 아직 미작성이다.
- **제안**: Playwright에서 `page.goto("/login"); const links = await page.locator('link[rel~="icon"]').all()` 등으로 `<head>` 내 아이콘 링크 존재를 검증하는 e2e 케이스 작성. CSS 토큰의 실제 계산값 검증은 visual regression으로 처리.

---

### [INFO] 기존 e2e auth 테스트의 auth 레이아웃 회귀 커버 — 부분적으로 유효
- **위치**: `frontend/e2e/auth/login.spec.ts`, `e2e/a11y/smoke.spec.ts`
- **상세**: 기존 e2e 테스트들은 `/login`, `/register`, `/forgot-password` 페이지를 직접 탐색하므로, auth layout의 치명적 렌더링 오류(JS exception 등)는 간접적으로 회귀 감지된다. a11y smoke 테스트의 axe scan은 새로 추가된 `<img alt="Clemvion">` 에 대해 alt 누락 등의 WCAG 위반도 자동 검출한다. 기존 테스트 자체는 변경 후에도 유효하다.
- **제안**: 특별한 조치 불필요. 단, WARNING 항목들이 해소되어 로고 존재 여부를 명시적으로 검증하는 케이스가 추가되면 회귀 감지 능력이 더 견고해진다.

---

### [INFO] README.md 변경에 대한 테스트 불필요
- **위치**: `README.md` (파일 1)
- **상세**: 문서 파일 변경(링크 경로 수정 + 로고 이미지 태그 추가)으로 자동 테스트 대상이 아니다.
- **제안**: 해당 없음.

---

### [INFO] `LogoMark` 의 `theme="auto"` 케이스에서 alt 검증 누락
- **위치**: `logo.test.tsx` lines 82-88 (`describe("LogoMark")`)
- **상세**: `theme="auto"` 테스트는 src 경로만 확인하고, 두 img의 alt 값과 className(dark:hidden/hidden dark:block) 검증이 없다. `Logo` describe 블록의 auto 케이스(lines 39-51)에는 className 검증이 있지만 `LogoMark` 블록에는 없어 대칭성이 맞지 않는다.
- **제안**: `LogoMark theme="auto"` 케이스에 className 및 alt 검증 추가하여 Logo auto 케이스와 대칭을 맞춘다.

---

## 요약

이번 변경의 핵심 신규 코드인 `logo.tsx` 컴포넌트에 대해서는 10개 단위 테스트가 함께 추가되어 기본적인 테스트 습관은 양호하다. 그러나 `sidebar.tsx`와 `(auth)/layout.tsx` 의 로고 통합 변경부분에 대한 컴포넌트 수준 테스트가 없고, plan §5에 명시된 Playwright 시각 회귀 테스트와 favicon HTML 검증 e2e 케이스가 이번 PR에 포함되지 않은 점이 주요 갭이다. `theme="auto" + wordmark` 조합, `size` prop의 height 스타일, `LogoMark auto` 케이스의 대칭성 등 단위 테스트 내 세부 누락도 존재한다. 기존 e2e(auth 흐름, a11y axe scan)는 치명적 회귀 감지 역할을 하고 있으나, 로고 렌더링 자체를 명시적으로 검증하는 케이스는 아직 없다. Stage 2 완료 조건(plan §6)을 충족하려면 plan §5의 미작성 e2e 케이스들이 보완되어야 한다.

## 위험도

MEDIUM
