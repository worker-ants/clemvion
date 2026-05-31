# 브랜드 가이드 — Clemvion

> 관련 문서: [제품 개요](./0-overview.md)

---

## 1. 제품명

**Clemvion** — 영문 표기 그대로 사용한다. 한글 표기·로마자 표기를 별도로 두지 않고 단일 명칭을 공통으로 사용한다.

## 2. Brand Story

Clemvion은 유연하게 작업·시스템·지능을 하나로 엮어 맥락이 공유되고 스스로 확장되는 실행 구조를 만든다.

기존의 워크플로우는 사람이 설계하고 사람이 유지해야 했다. 그러나 실제 업무는 고정된 흐름이 아니라 끊임없이 변하고, 연결되고, 판단을 요구한다. Clemvion은 이 간극에서 출발한다.

> "흐름은 설계하는 것이 아니라, 자라나야 한다."

## 3. What is Clemvion

Clemvion은 AI 에이전트와 노코드 워크플로우 빌더를 통합한 실행 플랫폼이다. 단순한 자동화를 넘어, 워크플로우 안에 AI 에이전트 노드를 삽입함으로써 각 단계가 단순 실행이 아닌 **판단과 적응**을 수행한다. AI 어시스턴트와의 대화를 통해 워크플로우를 생성하고, 수정하고, 디버깅할 수 있다.

## 4. Core Concept

| # | 컨셉 | 정의 |
| --- | --- | --- |
| 1 | **Living Workflow** | 워크플로우는 더 이상 고정된 스크립트가 아니다. 실행되며 변화하고, 상황에 맞게 스스로 이어진다. |
| 2 | **Agent-Native Nodes** | 각 노드는 단순 기능 블록이 아니라 지능을 가진 실행 단위다. 조건 분기·예외 처리·데이터 해석까지 에이전트가 직접 수행한다. |
| 3 | **Conversational Building** | 코드를 작성하지 않아도 된다. AI와 대화하며 워크플로우를 설계하고, 문제가 발생하면 함께 디버깅한다. |
| 4 | **Deep Integration** | 외부 서비스와 내부 시스템을 노드 기반으로 직접 연결한다. API·SaaS·사내 도구가 하나의 흐름 안에서 자연스럽게 작동한다. |

## 5. Why Clemvion

- 반복 작업을 자동화하는 수준을 넘어서고 싶은 팀
- 복잡한 시스템을 하나의 흐름으로 통합하고 싶은 조직
- 사람이 아닌 시스템이 실행을 책임지길 원하는 환경

Clemvion은 이런 요구를 단순한 도구가 아니라 **스스로 작동하는 구조**로 해결한다.

## 6. One-line Definition

> Clemvion = AI가 엮고, 실행하고, 성장시키는 워크플로우 시스템

## 7. Vision

우리는 도구를 만드는 것이 아니다. 우리는 **일이 스스로 이루어지는 방식**을 다시 정의한다.

Clemvion은 사람이 모든 흐름을 통제하던 시대에서, **지능이 흐름을 운영하는 시대**로의 전환을 만든다.

---

## 8. Visual Identity

### 8.1 디자인 모티프

Clemvion 의 마크는 두 개의 원형 단위 (상단의 큰 원형 노드 + 좌하단의 보조 원형 노드) 가 단일 path 안에서 유기적으로 이어지는 **추상 mark** 다. 두 노드 사이의 음각 공간은 *연결 관계(connection)* 를, 외곽으로 흘러나가는 곡선은 *흐름(flow)* 을 표현한다.

- 상단 원 (large) — Living Workflow 의 *주된 실행 흐름*
- 좌하단 원 (small) — Agent-Native Nodes 의 *판단 분기*
- 두 원을 잇는 path body — Conversational Building 의 *연결 관계*

자산은 단일 `<path>` + linear gradient 로 구성된다. 이 모티프는 *"흐름은 자라나야 한다"* 는 Brand Story (§2) 의 시각적 환원이며, **노드와 노드 사이의 관계** 를 추상화한다.

### 8.2 컬러 (보류)

정식 비주얼 컬러 가이드는 향후 도입한다. 현 시점에서는 다음 두 가지만 정의한다:

1. **자산 안에 박힌 컬러** — 로고/파비콘 SVG 는 자체 fill 로 다음 값을 사용한다. 본 값들은 SVG 안에 박혀 있고, **앱 테마 토큰으로의 매핑은 본 spec 의 책임 밖**이다 (현 상태 = 매핑 없음).

   - **Mark gradient** (light/dark 공용): linear-gradient `#12acaa` (teal) → `#8be67e` (lime). gradient 좌표는 `userSpaceOnUse` 로 path bbox 의 대각선 (`(69.856, 105.446)` → `(30.467, 58.503)`, mm 단위 원 path 좌표계). light·dark 모두 동일 stop 사용 — 마크 자체가 충분히 밝아 라이트/다크 surface 양쪽에서 식별 가능.
   - **로고 자산 컨테이너 fill** — **transparent**. 라이트/다크 surface 위에 직접 얹힘.
   - **워드마크 fill** — light: `#000000` (pure black) / dark: `#ffffff` (pure white).
   - **유틸리티 자산 컨테이너 fill** (favicon-16 / icon / apple-icon / OG): 본 브랜드 자산이 아닌 브라우저 탭·iOS 홈스크린·소셜 카드용. 시인성 확보를 위해 컨테이너 fill 유지 — favicon-16/icon/apple-icon `#eef5ec`, OG `#f7f8f6`. transparent 규정은 브랜드 표상 자산 (logo, mark, wordmark) 에 한정.

2. **앱 테마** — 현재 `codebase/frontend/src/app/globals.css` 는 Shadcn neutral 토큰을 사용한다 (`--primary` 등 라이트 near-black, 다크 near-white). 브랜드 컬러를 앱 테마에 통합하는 정식 결정은 향후 §8.2 갱신 항목이다.

### 8.3 타이포그래피

| 용도 | 폰트 | 비고 |
| --- | --- | --- |
| 본문·UI | **Geist Sans** | `next/font/google` |
| 코드·모노 | **Geist Mono** | |
| 워드마크 | system sans-serif (`Helvetica Neue`, `Helvetica`, `Arial`) | weight **500**, letter-spacing `-1px`, font-size **48px** (full logo / wordmark-only 공통). 첫 글자 대문자 `C` + 나머지 소문자 `lemvion` → 표기 *Clemvion*. **흑백 단일 fill** — light `#000000` / dark `#ffffff`. SVG 자산에 박힘 |

워드마크 svg 가 fontFamily 에 시스템 폰트 스택을 명시하는 이유는 Geist 미설치 환경에서의 weight **500** fallback 안정성이다. 본문·UI 폰트는 Geist Sans 를 유지한다.

브랜드 tagline *Agentic Workflow* 는 풀로고 시각 영역에는 포함되지 않으며, 풀로고 변종의 alt 텍스트·메타데이터 (OG `<meta>` description 등) 에만 노출된다.

### 8.4 로고 시스템

#### 8.4.1 변종 매트릭스

| 변종 | 정식 경로 | 사용처 |
| --- | --- | --- |
| Full logo (light) | `codebase/frontend/public/logo.svg` | 라이트 surface 풀로고 — mark + wordmark, 투명 배경 + 검정 텍스트 |
| Full logo (dark) | `codebase/frontend/public/logo-dark.svg` | 다크 surface 풀로고 — 투명 배경 + 흰색 텍스트 |
| Icon mark (light/dark 공용, 96px master) | `codebase/frontend/public/logo-mark.svg` | 사이드바 collapsed, 로딩, 카드. 투명 배경 + gradient mark (라이트/다크 단일 자산) |
| Wordmark only (light) | `codebase/frontend/public/logo-wordmark.svg` | 마크 없이 텍스트만, 라이트 surface — 검정 |
| Wordmark only (dark) | `codebase/frontend/public/logo-wordmark-dark.svg` | 마크 없이 텍스트만, 다크 surface — 흰색 |
| Favicon multi (16/32/48 합성) | `codebase/frontend/src/app/favicon.ico` | 브라우저 탭 |
| App icon (Next.js metadata) | `codebase/frontend/src/app/icon.svg` | 32px 기본, Next.js 자동 노출 |
| Apple touch icon | `codebase/frontend/src/app/apple-icon.png` (180×180 PNG) | iOS 홈스크린. *현재 임시 SVG (`codebase/frontend/public/apple-icon.svg`) 사용 중 — PNG 변환은 §8.6 follow-up* |
| OG / Twitter card | `codebase/frontend/src/app/opengraph-image.png` (1200×630 PNG) | SNS 공유 미리보기. *현재 임시 SVG (`codebase/frontend/public/opengraph-image.svg`), metadata 미선언 — PNG 변환 후 재활성화는 §8.6 follow-up* |

#### 8.4.2 16px favicon

favicon 16×16 은 정식 마크와 동일한 단일 path 를 그대로 축소한다 (마크가 path 1개로 단순하여 별도 단순화가 불필요하다). 16px 환경에서 마크 윤곽이 식별 가능해야 하며, 가독성이 무너지면 별도 vector 자산을 둔다.

#### 8.4.3 풀로고 구성

풀로고는 **2요소 동반**:

1. Icon mark (좌)
2. Wordmark `Clemvion` (우, 대문자 C)

브랜드 tagline *Agentic Workflow* 는 풀로고 SVG 시각 영역에는 포함되지 않고, 다음 위치에만 잔존한다:

- `<img alt>` / `<svg aria-label>` — 풀로고 변종 한정 (mark·wordmark-only 변종의 alt 는 *"Clemvion"* 단독)
- 마케팅 페이지의 hero copy / OG 메타 description / `<title>` — 본 §8 의 책임 밖, 각 surface spec 에서 정의

풀로고 기본 viewBox: `320 × 80` (icon mark 60×60 + 좌측 여백 10 + wordmark 영역 230 + 우측 여백 20).

#### 8.4.4 워드마크 사용 규정

워드마크는 **흑백 단일 fill**.

- 표기: 첫 글자 대문자 `C` + 나머지 소문자 `lemvion` → *Clemvion*
- 폰트: §8.3 의 system sans-serif stack
- weight: 500 (medium)
- font-size: 48 (full logo / wordmark-only 공통)
- letter-spacing: -1
- fill: light surface `#000000` (pure black) / dark surface `#ffffff` (pure white)
- 배경: 자산 SVG 컨테이너 fill 없음 (transparent) — light/dark surface 위에 직접 얹힘

금지: 워드마크 자체에 그라데이션 fill, 외곽선, 그림자, 회전, 왜곡, 임의 색상 치환. (워드마크가 노출되는 페이지 배경의 그라데이션 여부는 본 §8 가 결정하지 않으며, 각 라우트 spec 의 자리 정의를 따른다.)

#### 8.4.5 여백·최소 크기

| 항목 | 규정 |
| --- | --- |
| Clear space | 워드마크 `clemvion` 의 x-height 만큼. 풀로고의 모든 외곽에 적용 |
| 최소 풀로고 너비 | **160px**. 그 이하에서는 icon-only 또는 wordmark-only 로 전환 |
| 최소 icon mark 변 | **16px**. 그 이하 사용 금지 |
| 풀로고 / wordmark 표시 | 가로 배치 고정. 세로 스택 변종은 본 가이드에서 다루지 않음 |

#### 8.4.6 로고 노출 자리 (제품 사양 차원)

본 §8 은 다음 자리에서의 로고 노출을 정식 사양으로 둔다. 본 항은 개별 라우트 spec (`spec/2-navigation/_layout.md`, `spec/2-navigation/10-auth-flow.md` 등) 의 로고 기술보다 **우선**한다 — 본 §8 이 단일 진실(single source of truth) 이며, 개별 라우트 spec 은 노출 위치만 정의하고 변종·색은 본 §8 을 따른다.

| 자리 | 변종 | 비고 |
| --- | --- | --- |
| 사이드바 상단 ([`spec/2-navigation/_layout.md` §2.1](./2-navigation/_layout.md#21-구성)) | expanded → Full logo (`theme="auto"`) / collapsed → Icon mark (`theme="auto"`) | 클릭 시 `/dashboard`. sidebar 헤더 row 는 dedicated dark backdrop 없이 sidebar surface(`--card`) 그대로 |
| 인증 화면 (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`) | Full logo (`theme="auto"`) | 인증 카드 위 중앙 배치. logo wrapper 는 dedicated dark backdrop 없이 인증 gradient surface 위에 transparent 로 얹힘. 카드 자체의 배경·여백은 [`spec/2-navigation/10-auth-flow.md` §1](./2-navigation/10-auth-flow.md#1-화면-구성-개요) 가 정의 |
| 브라우저 탭 | Favicon multi | 라이트/다크 자동 전환은 브라우저 표준 동작에 위임 |
| iOS 홈스크린 | Apple touch icon | 180×180 (현 임시 SVG, PNG 는 §8.6 follow-up) |
| SNS / 외부 공유 | OG image | 1200×630 (현 임시 SVG, metadata 비활성화 — §8.6 follow-up) |

라이트/다크 자산 선택은 노출 자리(surface) 의 배경 톤을 기준으로 한다. 사이드바·인증 화면 모두 dedicated dark backdrop 을 두지 않고 surface(Shadcn `--card` / 인증 gradient) 위에 transparent 로고가 직접 얹힘 — `<Logo theme="auto">` 가 현재 테마 모드를 따라 light/dark 자산을 자동 토글한다.

### 8.5 어조와 스타일

- 한국어를 1차 언어로 한다. 영어 표기는 제품명·고유명사에 한정한다.
- 의인화·유사 자연 비유(자라다, 뻗다, 엮다, 흐름)를 핵심 마케팅 카피에 사용한다.
- 기능 설명에서는 과장·감탄사 없이 짧고 단정한 문장을 쓴다.

### 8.6 임시 자산 상태 (follow-up 대기)

다음 3건은 별도 follow-up 의 대상이다. PNG 생성 소스는 현 SVG 자산이다.

- `apple-icon.png` (180×180 PNG) — modern iOS ≥ 12 가 SVG apple-touch-icon 을 지원하므로 임시 SVG 로 노출 중. raster 도구(sharp/ImageMagick) 도입 후 PNG 변환 + metadata 갱신.
- `opengraph-image.png` (1200×630 PNG) — SVG OG 카드는 X/Slack/Facebook 크롤러 호환성이 불안정하여 `codebase/frontend/src/app/layout.tsx` 의 `openGraph.images` / `twitter.images` 를 **비활성화** 중. PNG 생성 후 `summary_large_image` 카드 + `images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }]` 재활성화.
- `favicon.ico` multi-size (16/32/48 합성) — modern 브라우저는 `icon.svg` 우선 사용하므로 현재 영향 없음. raster 도구 도입 후 합성 .ico 생성.

---

## Rationale

본 섹션은 현재 §8 디자인의 핵심 근거만 보관한다.

### 추상 single-path 마크 + teal → lime gradient

- 마크는 단일 `<path>` + linear gradient (`#12acaa` teal → `#8be67e` lime) 로, **노드 간 연결 관계** 를 추상화한다 (노드 자체의 조립이 아니라 그 사이의 관계). 같은 *Living Workflow / Agent-Native Nodes* 정체성을 단순한 형태로 전달한다.
- 단일 path 는 16px favicon 까지 별도 단순화 없이 그대로 축소 가능하다.
- 식물·덩굴 곡선 모티프는 채택하지 않는다 — 마크는 식물이 아니라 노드 간 관계의 추상화다.
- gradient 는 light/dark surface 양쪽에서 동일 stop 으로 식별 가능해 surface 별 별도 ramp 가 불필요하다.

### 워드마크 — 흑백 단일, capital C, system 폰트 스택

- 표기 `Clemvion` (첫 글자 대문자) 은 §1 의 정식 brand name 과 일치한다.
- weight 500 + size 48 은 마크와 동등한 시각 비중을 가져 균형 잡힌 lockup 을 구성한다.
- fill 은 흑백 단일 (light `#000000` / dark `#ffffff`) — 디자인 의도(surface 톤 대비) 가 자산 안 hex 와 1:1 매칭된다. accent 색은 두지 않는다.
- fontFamily 에 system sans-serif (`Helvetica Neue` / `Helvetica` / `Arial`) 를 명시하는 이유는 Geist 미설치 환경에서의 weight 500 fallback 안정성이다. 본문·UI 폰트는 Geist Sans 를 유지한다.
- 풀로고는 mark + wordmark 2요소다. tagline *Agentic Workflow* 는 풀로고 시각이 아니라 alt/aria-label/메타 description 으로만 노출된다 — 풀로고 시각 영역을 줄여 좁은 헤더·작은 카드에서의 사용성을 높인다.

### 컨테이너 fill transparent

- 브랜드 표상 자산 (logo, mark, wordmark) 의 SVG 컨테이너 fill 은 transparent — 배경 톤 결정은 호출 측 surface 의 책임이다. 자산은 vector 만 그린다.
- 유틸리티 자산 (favicon-16, icon, apple-icon, opengraph-image) 은 예외로 컨테이너 fill 을 유지한다: 브라우저 탭·iOS 홈스크린·외부 소셜 카드는 surface 톤이 자산 통제 밖이라 transparent 면 시인성·일관성이 깨진다.

### 로고 자리의 theme="auto" + dedicated dark backdrop 없음

- 사이드바 헤더·인증 화면 로고 wrapper 는 dedicated dark backdrop 을 두지 않는다. transparent 자산 + 흑백 워드마크는 light surface 위에서도 시인성이 충분하다.
- `<Logo theme="auto">` 가 현재 테마 모드를 따라 light/dark 자산을 자동 토글한다 — 마케팅 페이지·dashboard 카드 등 다른 자리와 동일 패턴으로 일관성을 유지한다.
- (인프라) Tailwind v4 의 `dark:` variant 가 OS `prefers-color-scheme` 대신 `.dark` ancestor class 를 추적하도록 `globals.css` 에 `@custom-variant dark (&:where(.dark, .dark *));` 를 둔다. 로고·테마 토글은 OS preference 가 아니라 앱의 actual theme state 만 따른다.

### 브랜드 spec 의 라우트 spec 우선권

- §8.4.6 (로고 노출 자리) 가 개별 라우트 spec (`spec/2-navigation/_layout.md`, `10-auth-flow.md` 등) 의 로고 기술보다 우선한다.
- 브랜드 자산의 변종·색은 단일 진실(single source of truth) 원칙상 한 곳(본 §8)에서만 정의한다. 라우트 spec 은 "로고가 어디에 노출되는가"(자리) 만 정의하고 변종·색은 본 §8 을 참조한다.

### 앱 테마 컬러 토큰화 보류

- 마크 gradient (teal → lime) 의 앱 테마 토큰 매핑은 보류 상태다. `globals.css` 는 Shadcn neutral 팔레트를 사용한다.
- 정식 컬러 가이드는 사용자/디자이너 협업으로 확정한 뒤 §8.2 갱신 + 코드 매핑으로 진행한다.
