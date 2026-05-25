# 브랜드 가이드 — Clemvion

> 관련 문서: [제품 개요](./0-overview.md)

---

## 1. 제품명

**Clemvion** — 영문 표기 그대로 사용한다. 한글 표기·로마자 표기를 별도로 두지 않고 단일 토큰을 그대로 노출한다.

## 2. Brand Story

Clemvion은 덩굴식물에서 영감을 받았다. 보이지 않는 구조를 따라 유연하게 뻗어 나가며, 환경에 맞춰 스스로 형태를 바꾸는 식물처럼, Clemvion은 작업·시스템·지능을 하나로 엮어 스스로 확장되는 실행 구조를 만든다.

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

자산은 단일 `<path>` + linear gradient 로 구성된다. 옛 *node-graph* 모티프(spine + branches + 다수 nodes 분해 도형) 는 본 §8.1 에서 폐기되었다 — R-1 → R-14 참조.

이 모티프는 *"흐름은 자라나야 한다"* 는 Brand Story (§2) 의 시각적 환원이며, **노드와 노드 사이의 관계** 를 추상화한다 (옛 모티프는 노드 자체의 조립을 보여줬다 — 추상화 수준 차이).

### 8.2 컬러 (보류)

본 §8.2 는 정식 비주얼 가이드 도입 시 채워진다. 현 시점에서는 다음 두 가지만 정의한다:

1. **자산 안에 박힌 컬러** — 정식 로고/파비콘 SVG (§8.4.1) 는 자체 fill 로 다음 **teal → lime gradient** 를 사용한다. 본 값들은 SVG 안에 박혀 있고, **앱 테마 토큰으로의 매핑은 본 spec 의 책임 밖**이다 (현 상태 = 매핑 없음).

   - **Mark gradient** (light/dark 공용): linear-gradient `#12acaa` (teal) → `#8be67e` (lime). gradient 좌표는 `userSpaceOnUse` 로 path bbox 의 대각선 (`(69.856, 105.446)` → `(30.467, 58.503)`, mm 단위 원 path 좌표계). light·dark 모두 동일 stop 사용 — 마크 자체가 충분히 밝아 라이트/다크 surface 양쪽에서 식별 가능.
   - **로고 자산 컨테이너 fill** — **transparent** (R-16). 라이트/다크 surface 위에 직접 얹힘. 옛 컨테이너 fill (`#eef5ec` light / `#0a1f1f` dark) 은 R-16 으로 폐기.
   - **워드마크 fill** — light: `#000000` (pure black) / dark: `#ffffff` (pure white). 단색 단일 (R-15) + 흑백 단일 분리 (R-16).
   - **유틸리티 자산 컨테이너 fill** (favicon-16 / icon / apple-icon / OG): 본 브랜드 자산이 아닌 브라우저 탭·iOS 홈스크린·소셜 카드용. 시인성 확보를 위해 컨테이너 fill 유지 — favicon-16/icon/apple-icon `#eef5ec`, OG `#f7f8f6`. R-16 의 transparent 규정은 브랜드 표상 자산 (logo, mark, wordmark) 에 한정.

2. **앱 테마** — 현재 `codebase/frontend/src/app/globals.css` 는 Shadcn neutral 토큰을 사용한다 (`--primary` 등 라이트 near-black, 다크 near-white). 브랜드 컬러를 앱 테마에 통합하는 정식 결정은 본 §8.2 의 향후 갱신 항목이다.

> 옛 vine-green ramp (7단계, light `#1a4f2c`–`#5ab872`, dark `#1e4a2a`–`#9efab2`) 는 2026-05-25 자산 교체 (R-14) 로 폐기. 옛 워드마크 ink `#0e1a12` / cream `#e8f5ec` 도 R-16 으로 pure black/white 로 통일. 별도 컬러 가이드 결정 전까지 옛 토큰명·hex 는 사용하지 않는다.

### 8.3 타이포그래피

| 용도 | 폰트 | 비고 |
| --- | --- | --- |
| 본문·UI | **Geist Sans** | 기존 `next/font/google` 유지 |
| 코드·모노 | **Geist Mono** | 기존 유지 |
| 워드마크 | system sans-serif (`Helvetica Neue`, `Helvetica`, `Arial`) | weight **500**, letter-spacing `-1px`, font-size **48px** (full logo / wordmark-only 공통). 첫 글자 대문자 `C` + 나머지 소문자 `lemvion` → 표기 *Clemvion*. **흑백 단일 fill** — light `#000000` / dark `#ffffff` (R-16). SVG 자산에 박힘. R-15·R-16 참조 |
| ~~워드마크 accent (`vi`)~~ | — | **2-tone `vi` 시그니처는 R-15 로 폐기**. 워드마크는 단색 단일 fill |
| ~~서브카피 (`AGENTIC WORKFLOW`)~~ | — | **풀로고에서 폐기 (R-5 → R-15 Supersede)**. 풀로고 = mark + wordmark 2요소. brand tagline *Agentic Workflow* 는 alt 텍스트·메타데이터에 잔존 (OG `<meta>` 등) |

워드마크 svg 가 fontFamily 에 시스템 폰트 스택을 명시하는 이유는 Geist 미설치 환경에서의 weight **500** fallback 안정성 (R-11 참조 — 옛 weight 200/600 2-tone 은 R-15 로 단일 500 으로 통합).

### 8.4 로고 시스템

#### 8.4.1 변종 매트릭스

| 변종 | 정식 경로 | 사용처 |
| --- | --- | --- |
| Full logo (light) | `codebase/frontend/public/logo.svg` | 라이트 surface 풀로고 — mark + wordmark, 투명 배경 + 검정 텍스트 (R-15, R-16) |
| Full logo (dark) | `codebase/frontend/public/logo-dark.svg` | 다크 surface 풀로고 — 투명 배경 + 흰색 텍스트 (R-15, R-16) |
| Icon mark (light/dark 공용, 96px master) | `codebase/frontend/public/logo-mark.svg` | 사이드바 collapsed, 로딩, 카드. 투명 배경 + gradient mark (R-16: 라이트/다크 단일 자산) |
| Wordmark only (light) | `codebase/frontend/public/logo-wordmark.svg` | 마크 없이 텍스트만, 라이트 surface — 검정 (R-16) |
| Wordmark only (dark) | `codebase/frontend/public/logo-wordmark-dark.svg` | 마크 없이 텍스트만, 다크 surface — 흰색 (R-16) |
| Favicon multi (16/32/48 합성) | `codebase/frontend/src/app/favicon.ico` | 브라우저 탭 |
| App icon (Next.js metadata) | `codebase/frontend/src/app/icon.svg` | 32px 기본, Next.js 자동 노출 |
| Apple touch icon | `codebase/frontend/src/app/apple-icon.png` (180×180 PNG) | iOS 홈스크린. *현재 임시 SVG (`codebase/frontend/public/apple-icon.svg`) 사용 중 — PNG 변환은 §8.6 follow-up* |
| OG / Twitter card | `codebase/frontend/src/app/opengraph-image.png` (1200×630 PNG) | SNS 공유 미리보기. *현재 임시 SVG (`codebase/frontend/public/opengraph-image.svg`), metadata 미선언 — PNG 변환 후 재활성화는 §8.6 follow-up* |

#### 8.4.2 16px favicon

favicon 16×16 은 정식 마크와 동일한 단일 path 를 그대로 축소한다 (R-14 의 새 모티프는 path 1개로 단순하여, 옛 모티프처럼 노드/라인을 별도 단순화할 필요 없음). 16px 환경에서 마크 윤곽이 식별 가능해야 하며, 가독성이 무너지면 별도 vector 자산을 둔다 (옛 R-6 의 fallback 절차로 보존).

#### 8.4.3 풀로고 구성

풀로고는 **2요소 동반** (R-15, 2026-05-25 개정):

1. Icon mark (좌)
2. Wordmark `Clemvion` (우, 대문자 C)

옛 §8.4.3 의 *3요소 (mark + wordmark + sub-copy `AGENTIC WORKFLOW`)* 동반 규정은 R-15 로 폐기. *Agentic Workflow* tagline 은 풀로고 SVG 시각 영역에서는 빠지고, 다음 위치에 잔존:

- `<img alt>` / `<svg aria-label>` — 풀로고 변종 한정 (mark·wordmark-only 변종의 alt 는 *"Clemvion"* 단독)
- 마케팅 페이지의 hero copy / OG 메타 description / `<title>` — 본 §8 의 책임 밖, 각 surface spec 에서 정의

풀로고 기본 viewBox: `320 × 80` (icon mark 60×60 + 좌측 여백 10 + wordmark 영역 230 + 우측 여백 20). 옛 `260 × 80` 은 R-15 로 폐기.

#### 8.4.4 워드마크 사용 규정

워드마크는 **흑백 단일 fill** (R-13 단색 규정 → R-15 2-tone 폐기 → R-16 흑백 단일 분리).

- 표기: 첫 글자 대문자 `C` + 나머지 소문자 `lemvion` → *Clemvion*
- 폰트: §8.3 의 system sans-serif stack
- weight: 500 (medium)
- font-size: 48 (full logo / wordmark-only 공통)
- letter-spacing: -1
- fill: light surface `#000000` (pure black) / dark surface `#ffffff` (pure white)
- 배경: 자산 SVG 컨테이너 fill 없음 (transparent) — light/dark surface 위에 직접 얹힘

옛 *2-tone `vi` 시그니처* (R-3 정식화 → R-13 spec 정식 폐기 + 자산 안 보존 → R-14 시점 자산 색만 갱신 → **R-15 자산 안 디자인도 폐기**) 의 3단 이력은 Rationale 에 보존.

여전히 금지: 워드마크 자체에 그라데이션 fill, 외곽선, 그림자, 회전, 왜곡, 임의 색상 치환. (워드마크가 노출되는 페이지 배경의 그라데이션 여부는 본 §8 가 결정하지 않으며, 각 라우트 spec 의 자리 정의를 따른다.)

#### 8.4.5 여백·최소 크기

| 항목 | 규정 |
| --- | --- |
| Clear space | 워드마크 `clemvion` 의 x-height 만큼. 풀로고의 모든 외곽에 적용 |
| 최소 풀로고 너비 | **160px**. 그 이하에서는 icon-only 또는 wordmark-only 로 전환 |
| 최소 icon mark 변 | **16px**. 그 이하 사용 금지 |
| 풀로고 / wordmark 표시 | 가로 배치 고정. 세로 스택 변종은 본 가이드에서 다루지 않음 |

#### 8.4.6 로고 노출 자리 (제품 사양 차원)

본 §8 은 다음 자리에서의 로고 노출을 정식 사양으로 둔다. 본 항은 개별 라우트 spec (`spec/2-navigation/_layout.md`, `spec/2-navigation/10-auth-flow.md` 등) 의 로고 기술보다 **우선**한다 — 본 §8 이 단일 진실(single source of truth) 이며, 개별 라우트 spec 은 노출 위치만 정의하고 변종·색은 본 §8 을 따른다 (R-9 참조).

| 자리 | 변종 | 비고 |
| --- | --- | --- |
| 사이드바 상단 ([`spec/2-navigation/_layout.md` §2.1](./2-navigation/_layout.md#21-구성)) | expanded → Full logo (`theme="auto"`) / collapsed → Icon mark (`theme="auto"`) | 클릭 시 `/dashboard`. R-17 이후 sidebar 헤더 row 는 dedicated dark backdrop 없이 sidebar surface(`--card`) 그대로 |
| 인증 화면 (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`) | Full logo (`theme="auto"`) | 인증 카드 위 중앙 배치. R-17 이후 logo wrapper 는 dedicated dark backdrop 없이 인증 gradient surface 위에 transparent 로 얹힘. 카드 자체의 배경·여백은 [`spec/2-navigation/10-auth-flow.md` §1](./2-navigation/10-auth-flow.md#1-화면-구성-개요) 가 정의 |
| 브라우저 탭 | Favicon multi | 라이트/다크 자동 전환은 브라우저 표준 동작에 위임 |
| iOS 홈스크린 | Apple touch icon | 180×180 (현 임시 SVG, PNG 는 §8.6 follow-up) |
| SNS / 외부 공유 | OG image | 1200×630 (현 임시 SVG, metadata 비활성화 — §8.6 follow-up) |

라이트/다크 자산 선택은 노출 자리(surface) 의 배경 톤을 기준으로 한다. **R-17 (2026-05-25)** 이후 사이드바·인증 화면 모두 dedicated 한 `#111e14` dark backdrop 을 두지 않고 surface(Shadcn `--card` / 인증 gradient) 위에 transparent 로고가 직접 얹힘 — `<Logo theme="auto">` 가 현재 테마 모드를 따라 light/dark 자산을 자동 토글한다.

### 8.5 어조와 스타일

- 한국어를 1차 언어로 한다. 영어 표기는 제품명·고유명사에 한정한다.
- 의인화·유사 자연 비유(자라다, 뻗다, 엮다, 흐름)를 핵심 마케팅 카피에 사용한다.
- 기능 설명에서는 과장·감탄사 없이 짧고 단정한 문장을 쓴다.

### 8.6 자산 마이그레이션

(근거: R-1, R-7, R-13, R-14)

#### 8.6.1 1차 교체 — node-graph 모티프 채택 (2026-05-15)

이전 임시 자산 (덩굴 + 잎 곡선 모티프) 은 §8 정식 개정(2026-05-15)과 함께 폐기되었다 (R-1).

#### 8.6.2 2차 교체 — single-path 추상 마크 (2026-05-25, R-14) + 워드마크 layout 개정 (R-15)

2026-05-25 사용자 결정으로 node-graph 모티프(spine + branches + 다수 nodes 분해) 를 폐기하고, 단일 path + linear gradient `#12acaa → #8be67e` 의 추상 마크로 전환 (R-14). 동일자 워드마크 layout 도 재개정 — `Clemvion` 대문자 C, font 500/48px 단색, sub-copy 폐기, viewBox `260×80 → 320×80` (R-15). 자산 파일명·`<Logo>` 컴포넌트 API 는 그대로 유지하므로 외부 import 경로 변경 없음.

| 자산 경로 | 변경 |
| --- | --- |
| `codebase/frontend/public/logo.svg` | 교체 (R-14 마크 + R-15 워드마크 + R-16 transparent/검정) |
| `codebase/frontend/public/logo-dark.svg` | 교체 (동일 layout, R-16 transparent/흰색) |
| `codebase/frontend/public/logo-mark.svg` | 교체 (96px master). R-16 으로 컨테이너 fill 제거 (transparent) |
| ~~`codebase/frontend/public/logo-mark-dark.svg`~~ | **삭제 (R-16)** — transparent 후 light 변종과 동일 |
| `codebase/frontend/public/logo-wordmark.svg` | 교체 (R-15 + R-16, viewBox `220×60`, 검정) |
| `codebase/frontend/public/logo-wordmark-dark.svg` | **신설 (R-16)** — dark surface 용 흰색 워드마크 |
| `codebase/frontend/public/favicon-16.svg` | 교체 (단일 path). R-16 의 예외 — 컨테이너 `#eef5ec` 유지 |
| `codebase/frontend/src/app/icon.svg` | 교체 (32px). R-16 예외 — 컨테이너 유지 |
| `codebase/frontend/public/apple-icon.svg` | 교체. R-16 예외 — 컨테이너 유지. PNG 변환 follow-up 은 8.6.3 그대로 |
| `codebase/frontend/public/opengraph-image.svg` | 교체 (embedded 풀로고 R-15/R-16 반영, 텍스트 흑색). R-16 예외 — 컨테이너 유지. metadata 미선언 follow-up 은 8.6.3 그대로 |

#### 8.6.3 임시 상태 (follow-up 대기, 1·2차 교체 공통)

- `apple-icon.png` (180×180 PNG) — modern iOS ≥ 12 가 SVG apple-touch-icon 을 지원하므로 임시 SVG 로 노출 중. raster 도구(sharp/ImageMagick) 도입 후 PNG 변환 + metadata 갱신.
- `opengraph-image.png` (1200×630 PNG) — SVG OG 카드는 X/Slack/Facebook 크롤러 호환성이 불안정하여 `codebase/frontend/src/app/layout.tsx` 의 `openGraph.images` / `twitter.images` 를 **비활성화** 중. PNG 생성 후 `summary_large_image` 카드 + `images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }]` 재활성화.
- `favicon.ico` multi-size (16/32/48 합성) — 옛 파일은 삭제되었다. modern 브라우저는 `icon.svg` 우선 사용하므로 영향 없음. raster 도구 도입 후 합성 .ico 생성.

위 3건은 별도 follow-up PR 의 대상이다 (`plan/in-progress/brand-refresh-impl.md §1.2, §1.3` 참조). R-14 자산 교체 이후에도 동일하게 유효 — PNG 생성은 1차 교체 시점의 미해소 follow-up 이지만, 2차 교체 후의 새 SVG 가 생성 소스가 된다.

---

## 9. 변경 이력

| 일자 | 항목 | 비고 |
| --- | --- | --- |
| 2026-05-05 | 최초 작성 | 제품명을 Idea Workflow → Clemvion으로 전환하며 브랜드 가이드 신설 |
| 2026-05-15 | §8 정식 개정 | 옛 *Visual Identity (초안)* §8.1–§8.4 전면 폐기. Node-graph 모티프 정식 채택, Vine ramp 7단계 + Neutral + Dark 토큰 동시 도입, 워드마크 2-tone 허용, `AGENTIC WORKFLOW` 서브카피 상시 부착, 자산 9종 정식화. 옛 6개 토큰(Vine Green/Deep Forest/Bud Lime/Bark/Soil/Ink) 폐기·재정의. 동반 동기화: `spec/2-navigation/_layout.md` §2.1, `spec/2-navigation/10-auth-flow.md` §1 |
| 2026-05-15 | §8 부분 롤백 | 사용자 피드백 *"전체적인 색상이 별로"* 로 §8.2 컬러 토큰 정식화 / §8.2.4 코드 매핑 / §8.2.5 폐기 토큰 매트릭스 / §8.2.6 일시 불일치 윈도우 / §8.4.4 2-tone 정식 허용을 **폐기**. §8.1 노드 그래프 모티프, §8.4.1–§8.4.3·§8.4.5·§8.4.6 로고 시스템, §8.5 어조, §8.6 자산 9종 매트릭스는 유지. R-2/R-3/R-4/R-8/R-10 은 Superseded 표시로 보존, R-13 신설. 동반 동기화: `spec/2-navigation/_layout.md` §2.1 (Full logo (light) → Full logo), `spec/2-navigation/10-auth-flow.md` §1 (배경 그라데이션 복원). 제목에서 `PRD:` prefix 제거 |
| 2026-05-25 | §8.1·§8.2·§8.3·§8.4.2·§8.4.4·§8.6 자산 교체 | 사용자가 `temp/logo.svg` 로 새 마크 제공 → node-graph 모티프 폐기, single-path + teal→lime gradient (`#12acaa → #8be67e`) 추상 마크로 전환. 9종 자산 매트릭스 (§8.4.1) 그대로, 파일명·`<Logo>` 컴포넌트 API 변경 없음. 워드마크 `vi` accent / sub-copy fill 색만 갱신. dark mark 컨테이너 `#111e14` → `#0a1f1f`. R-1 은 *Superseded by R-14* 마킹으로 보존. R-14 신설. 동반 동기화: `spec/2-navigation/10-auth-flow.md` §5 의 *vine-dark* 명명 → *dark brand surface* (hex `#111e14` 는 sidebar 헤더에만 잔류 — 동작 변경 없음) |
| 2026-05-25 | §8.3·§8.4.3·§8.4.4 워드마크 layout 개정 | 사용자가 첨부 이미지로 새 워드마크 시안 제공 → 표기 `clemvion` → **`Clemvion`** (첫 글자 대문자), font weight `200/600` 2-tone → **단일 500**, font-size `26` → **48**, letter-spacing `-0.5` → **-1**, fill 2-tone → **단색 단일**. 풀로고에서 `AGENTIC WORKFLOW` sub-copy 폐기 → 풀로고 = mark + wordmark 2요소. viewBox `260×80` → `320×80`. R-3 (2-tone 시그니처) / R-5 (sub-copy 상시 부착) *Superseded by R-15* 마킹. R-15 신설. `<Logo>` 컴포넌트 API·자산 파일명 변경 없음 |
| 2026-05-25 | §8.2·§8.4.1·§8.4.4 투명 배경 + 흑백 단일 분리 | 사용자 결정 *"라이트/다크 모두 배경 투명, 글자색만 흑백 분리"*. 브랜드 자산(`logo.svg`·`logo-dark.svg`·`logo-mark.svg`·`logo-wordmark.svg`·신규 `logo-wordmark-dark.svg`) 컨테이너 fill 전체 폐기. 워드마크 fill `#0e1a12`/`#e8f5ec` → `#000000`/`#ffffff` 흑백 통일. `logo-mark-dark.svg` 삭제 (transparent 후 light 변종과 동일해짐) — `<Logo>` mark 양쪽 모두 `logo-mark.svg`. 신규 wordmark-dark 변종 추가 — `<Logo>` wordmark 도 light/dark 분리. 자산 매트릭스 9종 → **9종 (mark-dark 삭제 + wordmark-dark 신설)**. 유틸리티 자산(favicon-16·icon·apple-icon·OG) 은 사용처 특성상 컨테이너 유지. R-16 신설 |
| 2026-05-25 | §8.4.6 dark backdrop 폐기 | 사용자 결정 *"페이지의 로고 부분에서 백그라운드 색은 제거하고, 라이트/다크 모드 로고를 그대로 적용"*. R-14 가 도입했던 사이드바 헤더 + 인증 카드 wrapper 의 `bg-[#111e14]` dark backdrop 폐기. `<Logo theme="dark">` → `<Logo theme="auto">` 로 전환하여 surface 가 결정한 테마 모드를 따르게 함. R-14 의 *dark brand surface* 결정은 *Superseded by R-17* 마킹. R-17 신설. 동반 변경: `codebase/frontend/src/components/layout/sidebar.tsx` (헤더 row bg 제거), `codebase/frontend/src/app/(auth)/layout.tsx` (logo wrapper bg/rounded 제거), `codebase/frontend/src/app/(auth)/__tests__/layout.test.tsx` (3건 어서션 갱신), `spec/2-navigation/10-auth-flow.md` R-1 (인증 화면 로고 surface 기술) |

---

## Rationale

본 섹션은 §8 정식 개정의 배경·근거·기각된 대안을 inline 으로 보관한다.

### R-1. 덩굴 곡선 → 노드 그래프 모티프 전환 — *Superseded by R-14 (2026-05-25)*

> 본 결정은 2026-05-25 자산 교체로 폐기. 노드 그래프 모티프 (spine + branches + 다수 nodes 분해) 자체가 R-14 로 대체됨. SVG 자산은 single-path 추상 마크로 전환. 본 R-1 의 *"덩굴 곡선이 아닌 노드 graph 표현"* 원칙은 부분 유지 — R-14 의 새 마크 역시 "노드 간 연결 관계" 의 추상화이므로 곡선 식물 모티프로의 회귀가 아니다.

원 결정·근거·기각 대안 (이력 보존):

**결정**: 옛 임시 자산의 "덩굴이 위로 자라는 곡선 + 잎" 모티프를 폐기하고, "노드 그래프 형태로 자라난 잎" 모티프로 정식화.

**근거**:
- 제품 정체성(§3, §4)이 *Agent-Native Nodes* 와 *Living Workflow* 인데, 곡선 모티프는 이 정체성을 전달하지 못했다 — 일반적인 식물·자연 브랜드와 차별이 약하다.
- 노드 그래프 모티프는 워크플로우 빌더의 캔버스를 그대로 축약한 형태로, 사용자가 *제품의 본질을 그대로 본다*.
- Brand Story (§2) 의 "*보이지 않는 구조를 따라 유연하게 뻗어 나가며*" 는 곡선보다 노드+분기 구조에서 더 직접적으로 전달된다.

**기각된 대안**:
- 단순 wordmark only (mark 없음) — favicon·앱 아이콘 자리에서 식별성이 떨어짐.
- 추상 기호 (단일 도형) — 제품의 워크플로우 정체성과의 연결이 약함.

### R-2. 4-step → 7-step Vine ramp 도입 — *Superseded by R-13 (2026-05-15)*

> 본 결정은 2026-05-15 §8 부분 롤백으로 폐기되었다. 7단계 Vine ramp 의 spec 정식화는 R-13 으로 무효화. SVG 자산 안의 라이트/다크 vine 컬러는 §8.2 (보류) 의 1항에 *디자인 참고* 로 남는다.

원 결정·근거·기각 대안 (이력 보존):

- 옛 3색 (Vine Green / Bud Lime / Deep Forest) → 7단계 Vine ramp (`vine-300 ~ vine-900`).
- 근거: 노드 그래프 mark 의 깊이별 톤 요구 / success·hover·disabled·차트 시리즈 단일 brand 처리 / Tailwind 한 자릿수 차이로 의도 명확화.
- 기각: 옛 3색 유지 + Bud Lime 강화 (토큰 부족, 다크 매핑 모호).

### R-3. 워드마크 2-tone 시그니처 채택 — *Superseded by R-13 (2026-05-15), R-15 (2026-05-25)*

> 본 결정은 2-단계로 폐기:
> 1. **2026-05-15 R-13** — §8.4.4 spec 정식 규정은 단색으로 복원. 단 *자산 안에 박힌 2-tone 디자인* 은 잠정 유지.
> 2. **2026-05-25 R-15** — 자산 안 박힌 `vi` 2-tone 디자인까지 폐기. 모든 워드마크 SVG 가 단색 단일 fill 로 통일.
>
> 2-tone 정식화 재논의는 §8.2 갱신 시. 단 R-15 의 사용자 결정 (단색 신규 디자인 제공) 이력은 재논의 시 기각 사유로 우선 검토.

원 결정·근거·기각 대안 (이력 보존):

- 워드마크 `clem`**`vi`**`on` 의 `vi` 두 글자를 별도 weight + 색(vine-700) 으로 강조하는 2-tone 처리를 정식 시그니처로 채택.
- 기각된 규정 원출처: 구 §8.3 의 *"단색 또는 단색 반전만 허용"*.
- 근거: `vi` 강조의 "**vi**ne" 어원 환기 + *agentic* 머리글자 중의성 / 정식 가이드에서 시그니처 강도 우선 / 흑백 인쇄는 예외 절로 처리.
- 기각: 단색 유지 (시그니처 약함) / `clem` 강조 (어원 무관).

### R-4. 다크 모드 토큰 동시 도입 — *Superseded by R-13 (2026-05-15)*

> 본 결정은 §8.2 컬러 토큰 정식화 폐기와 함께 무효화. light/dark 페어 토큰 자체가 §8.2 (보류) 로 흡수되었다. SVG 자산에는 라이트/다크 두 변종이 자체 fill 로 보유 중 (§8.4.1 매트릭스). 향후 §8.2 재정식화 시 다크 모드 동시 도입 vs 분리 도입 결정을 다시 한다.

원 결정·근거·기각 대안 (이력 보존):

- light/dark 페어를 동시 정식화 (별도 plan 분리 X).
- 근거: 컨셉 자산의 light/dark 페어 / 에디터·코드 화면의 다크 모드 요구 / 토큰 페어 명시로 자동 매핑 단순화.
- 기각: 다크 모드 후속 분리 (자산 2회 점프, 폐기 토큰 행렬 두 번 갱신).

### R-5. `AGENTIC WORKFLOW` 서브카피 상시 부착 — *Superseded by R-15 (2026-05-25)*

> 본 결정은 2026-05-25 워드마크 개정으로 폐기. 풀로고는 mark + wordmark 2요소 (sub-copy 없음). *Agentic Workflow* tagline 은 alt/aria-label/메타 description 등 시각 영역 외부에 잔존 — R-15 본문 참조. 카테고리 디스크립터의 외부 노출 필요성 (옛 R-5 핵심 근거) 은 풀로고가 아닌 marketing-page hero copy / OG meta 로 옮겨졌다.

원 결정·근거·기각 대안 (이력 보존):

**결정**: 풀로고에 sub-copy 를 상시 동반. sub-copy 없는 사용처는 별도 wordmark-only 변종으로 분리.

**근거**:
- 제품명 `Clemvion` 만으로는 카테고리 인지가 어렵다 (식물 어원이 직관적으로 워크플로우/AI 를 떠올리게 하지 않음). 카테고리 디스크립터를 항상 노출해 외부 노출(OG, 이메일, 명함) 에서 즉시 *무엇을 하는 제품인지* 전달.
- 풀로고에서 sub-copy 를 제거할지 말지를 매번 판단하지 않게 함 → 사용자(디자이너·구현자) 의 결정 비용 감소.
- sub-copy 가 필요 없는 좁은 자리는 wordmark-only 변종을 쓰면 되므로 손해가 없음.

**기각된 대안**:
- sub-copy 를 마케팅 노출에서만 사용 — 풀로고 변종이 사실상 2개(with/without) 가 되어 가이드가 복잡해짐.

### R-6. 16px 전용 별도 vector

**결정**: favicon 16×16 은 96px master 의 축소판이 아니라 별도 vector 자산으로 둔다.

**근거**:
- 컨셉 자산의 16px 카드를 검토한 결과, 96px 의 모든 노드·라인을 그대로 축소하면 OS 탭에서 흙뭉치로 보일 위험이 명백하다 (anti-alias 한계).
- 노드 ≤ 4 / 라인 ≤ 3 으로 단순화한 별도 vector 를 두면, 어느 사이즈에서도 mark 의 식별성이 보장된다.

### R-7. 자산 9종 정식화 + 폐기 토큰 매트릭스 명시

**결정**: §8.4.1 에 9개 자산 경로를 정식 명시, §8.2.5 에 폐기 토큰 ↔ 대체 토큰 1:1 매핑 명시.

**근거**:
- Stage 2 (developer) 가 spec 만 보고 어떤 파일을 어디에 배치하고, 옛 토큰을 무엇으로 교체할지 결정할 수 있어야 한다. 모호한 가이드는 구현 시점에 즉흥 결정으로 이어진다.
- 폐기 매트릭스는 grep 가능한 형태로 두어, 향후 정합성 검토 시 자동 검출 가능하게 함.

### R-8. 토큰 네이밍에서 일반 단어 회피 — *Superseded by R-13 (2026-05-15)*

> 본 결정은 §8.2 컬러 토큰 정식화 폐기와 함께 무효화. 토큰명(`vine-border`, `text-on-dark` 등) 자체가 §8.2 (보류) 로 흡수되었다. 향후 §8.2 재정식화 시 동일 네이밍 원칙을 재검토한다.

원 결정·근거 (이력 보존):

- Neutral 토큰의 보더를 `border` 가 아닌 `vine-border` 로, 다크 모드 텍스트를 `text-dark` 가 아닌 `text-on-dark` 로 명명.
- 근거: Tailwind / Shadcn 컨벤션과의 충돌 방지 / brand 토큰임을 prefix·의미로 명시 / grep 의도 식별 용이.

### R-9. 브랜드 spec 의 라우트 spec 대비 우선권

**결정**: §8.4.6 (로고 노출 자리) 가 개별 라우트 spec (`spec/2-navigation/_layout.md`, `spec/2-navigation/10-auth-flow.md` 등) 의 로고 기술보다 우선한다.

**근거**:
- 브랜드 자산의 변종·색은 단일 진실(single source of truth) 원칙상 한 곳에서만 정의되어야 한다. 라우트 spec 에 색·변종을 박으면 brand spec 개정 시 N 군데를 동기화해야 한다.
- 라우트 spec 은 "로고가 어디에 노출되는가" (자리) 만 정의하고, 변종·색은 brand spec 을 참조하도록 책임 분리.
- 본 §8.4.6 자체에 자리 매핑이 명시되어 있으므로, 라우트 spec 간 충돌 시 §8.4.6 이 결정권자.

### R-10. 시각 토큰과 코드 토큰의 분리 (구현 위임) — *Superseded by R-13 (2026-05-15)*

> 본 결정은 §8.2 컬러 토큰 정식화 폐기와 함께 무효화. §8.2 가 *보류* 상태가 되어 "시각 토큰 정의 → 코드 매핑 위임" 의 분리 자체가 불필요. 향후 §8.2 재정식화 시 본 원칙은 보존할 가치가 있어 재검토 대상.

원 결정·근거 (이력 보존):

- §8.2 는 시각 토큰(이름 + HEX) 만 정의, CSS 변수 명·Tailwind theme key 는 developer 가 결정.
- 근거: spec 의 디자인 의도 표현 책임 / 코드베이스 컨벤션과의 분리 / spec 개정 시 코드 검토 강제 회피.

### R-11. 워드마크 폰트 스택에 system 명시 (옛 §8.2 "별도 브랜드 폰트 도입 안 함" 방침의 부분 폐기)

**결정**: 워드마크 svg 가 fontFamily 에 `Helvetica Neue, Helvetica, Arial, sans-serif` 시스템 스택을 명시. 워드마크 한정으로 Geist Sans 사용 안 함. 본문·UI 폰트는 여전히 Geist Sans.

**부분 폐기**: 옛 §8.2 의 *"기존 프런트엔드의 폰트 스택을 그대로 유지한다. 별도 브랜드 폰트는 도입하지 않는다"* 방침은 본 결정으로 워드마크 한정 부분 폐기. 본문·UI 영역에는 여전히 유효.

**근거**:
- svg 는 정적 자산으로 모든 환경에 그대로 임베드되며, 사용자 환경에 Geist 가 설치되어 있지 않을 가능성이 있다. weight 200/600 의 정확한 표현이 깨지면 워드마크 시그니처가 무너진다.
- 시스템 sans-serif 는 모든 OS 에 weight 200/600 fallback 이 보장된다.
- 본문·UI 폰트는 여전히 Geist Sans 를 쓴다 (next/font/google 로 안전하게 로드되는 환경 안).

### R-12. 출처

- 컨셉 자산: `temp/clemvion_logo_concepts.html` (gitignored, 사용자 보관)
- 사전 일관성 검토 세션:
  - 1차 (Critical 2건 발견): `review/consistency/2026/05/15/18_25_10/` — 동일 파일 내 drop-in 범위 미명시 사유. 해결책으로 draft 도입부에 drop-in 대체 범위 명시.
  - 2차 (Critical 0건, BLOCK: NO): `review/consistency/2026/05/15/18_36_51/` — Stage 1 정식 반영 승인.
  - 3차 (impl-prep, BLOCK: NO): `review/consistency/2026/05/15/18_49_57/` — Stage 2 구현 착수 승인.
  - 4차 (rollback 검토, Critical 0건, BLOCK: NO): `review/consistency/2026/05/15/23_45_11/` — 본 부분 롤백 반영 승인.
- 사용자 결정 (2026-05-15 대화 1차): ramp 정식 도입, vi 강조 보존, sub-copy 상시 부착, 다크 모드 동시 도입.
- 사용자 결정 (2026-05-15 대화 2차, rollback): *"전체적인 색상이 별로"* → 테마 코드 롤백 + 스펙도 부분 롤백 (옵션 A).

### R-13. §8 부분 롤백 결정 (2026-05-15, Stage 1 직후 동일자)

**결정**: §8 정식판의 §8.2 컬러 토큰 / §8.2.4 코드 매핑 / §8.2.5 폐기 토큰 매트릭스 / §8.2.6 일시 불일치 윈도우 / §8.4.4 워드마크 2-tone 정식 허용을 **폐기**. §8.1 모티프, §8.4.1–§8.4.3·§8.4.5·§8.4.6 로고 시스템, §8.5 어조, §8.6 자산 9종 목록은 유지. R-2/R-3/R-4/R-8/R-10 은 *Superseded by R-13* 무효화 표시로 이력 보존.

**근거**:
- Stage 2 (commit `ee94a8e8`) 에서 §8.2 의 Vine ramp 를 `codebase/frontend/src/app/globals.css` 의 Shadcn 슬롯(`--primary` 등)에 매핑한 결과, 사용자가 *"전체적인 색상이 별로"* 로 거부. 이후 globals.css 는 main 의 neutral 팔레트로 복원(commit `df1533ab`).
- spec 이 정의한 컬러 토큰이 코드에 반영되지 않으면 단일 진실(single source of truth) 원칙 위반. 임시 불일치 윈도우(§8.2.6) 로 무한 연장하는 것은 spec 신뢰성 훼손.
- 옵션 분기 (A=spec 도 롤백, B=spec 유지, C=부분 롤백) 중 사용자가 옵션 A 선택. 가장 단순하고 spec/코드 정합성 우선.
- SVG 자산 (§8.4.1) 은 사용자가 명시적으로 유지 결정. 자산 안에 박힌 vine-green 색·`vi` 2-tone 시그니처는 자산 디자인의 일부로 보존하되, **앱 테마 토큰화** 는 보류.

**기각된 대안**:
- 옵션 B (spec 유지, 코드만 롤백): 단일 진실 원칙 위반의 무한 연장. *"미래 작업 가능성"* 만 남기고 실효성 없음.
- 옵션 C (부분 롤백): §8.2 컬러 토큰을 *"디자인 정의로만 유지"* 하는 절충안. 사용자가 *"당연히 롤백"* 으로 옵션 A 명시.

**보존되는 결정**:
- R-1 (모티프 전환): 노드 그래프 모티프는 SVG 자산이 그대로 사용 중.
- R-5 (sub-copy 상시): `AGENTIC WORKFLOW` 가 svg 안에 박혀 있음 + `logo-wordmark.svg` 별도 변종 보유.
- R-6 (16px 별도 vector): `favicon-16.svg` 실재.
- R-7 (자산 9종 정식화): §8.4.1 자산 매트릭스 그대로 유효.
- R-9 (브랜드 spec 의 라우트 spec 우선권): §8.4.6 의 자리 정의가 라우트 spec 보다 우선이라는 원칙 그대로.
- R-11 (워드마크 system 폰트 스택): svg fontFamily 에 시스템 스택 그대로 박혀 있음.

**향후 작업**:
- **§8.2 컬러 토큰 정식화** — 사용자/디자이너 협업으로 새 컬러 가이드 확정 후 spec 갱신 + 코드 매핑. 별도 PR. 재정식화 시 **이번 폐기한 R-2/R-3/R-4 의 결정·근거를 동일 형태로 재채택하기 전에**, 이번 사용자 피드백(컬러 거부)의 원인을 다시 검토해야 한다 — 단순 재선언으로 같은 거부를 반복하지 않도록.
- **R-10 (시각/코드 토큰 분리 원칙)** — §8.2 재정식화 시 보존 가치가 있어 재검토 대상.
- **R-4 (다크 모드 동시 도입 vs 분리)** — §8.2 재정식화 시 다시 결정.
- `apple-icon.png` / `opengraph-image.png` 생성 — raster 도구 도입 후 별도 PR.
- `favicon.ico` multi-size 합성 — 동일 follow-up.

### R-14. node-graph 분해 모티프 → single-path 추상 마크 (2026-05-25)

**결정**: §8.1 의 *spine + branches + nodes 분해형 node-graph* 모티프를 폐기하고, 단일 `<path>` + linear gradient (`#12acaa` teal → `#8be67e` lime) 의 추상 마크로 교체. §8.4.1 자산 매트릭스(9종), §8.4.3 풀로고 3요소 동반 규정, §8.4.5 여백·최소 크기, §8.4.6 자리 매핑은 모두 유지. 워드마크 `vi` accent / 서브카피 색만 새 gradient 에 맞춰 갱신 (`#1e7a42`→`#0e8c8a` light, `#6edc8e`→`#8be67e` dark).

**근거**:

- 사용자가 `temp/logo.svg` 로 새 마크 디자인을 직접 제공 — *user-driven brand change*. 외부 디자이너/내부 시안 비교 절차 없이 사용자 단독 결정.
- 옛 node-graph 모티프(spine + branches + 다수 circle nodes) 는 "그래프 자체를 그리는" 표상이었던 반면, 새 마크는 **노드 간 연결 관계** 의 추상화로, 같은 *Living Workflow / Agent-Native Nodes* 정체성을 더 단순한 형태로 전달.
- 단일 path 는 16px favicon 까지 별도 단순화 없이 그대로 축소 가능 → 옛 R-6 의 *"96px master 의 단순 축소가 아니라 별도 vector 자산"* 요건이 불필요해짐 (§8.4.2 일반화).
- linear gradient (teal → lime) 는 vine-green ramp 의 다단계 토큰을 자산 안에서 *연속적인 색상 흐름* 으로 대체. 라이트/다크 surface 모두에서 동일 gradient 가 식별 가능 (옛은 light/dark 별로 다른 ramp 사용).
- `<Logo>` 컴포넌트 API · 자산 파일명 · `<Logo>` 호출 위치 모두 그대로 → 코드 변경은 SVG content 내부에 한정.

**기각된 대안**:

- 옛 node-graph 모티프 유지 + 새 마크는 보조 변종 — 사용자가 *"새로운 로고"* 로 전면 교체 명시. 잠재 변종 보유는 R-9 의 단일 진실 원칙 위반.
- 새 마크의 path 를 spine + branches 형태로 분해 재구성 — 옛 모티프 보존을 위한 노력. 새 디자인의 정체성(단일 path + gradient)을 훼손하므로 채택 안 함.
- 다크 컨테이너 hex `#111e14` 유지 — 새 gradient 와의 색상 조화를 위해 `#0a1f1f` (dark teal) 로 갱신. 단, sidebar 헤더 영역의 `#111e14` 하드코딩은 호환성 위해 본 PR 에서 유지 (옛 *vine-dark-bg-elevated* 명칭은 *dark brand surface* 로 호칭 변경, hex 동결 — 별도 후속 PR 에서 통일 가능).

**보존되는 결정**:

- R-5 (sub-copy 상시 부착): `AGENTIC WORKFLOW` 가 새 SVG 안에 동일하게 박혀 있음 + `logo-wordmark.svg` 별도 변종 유지.
- R-7 (자산 9종 정식화): §8.4.1 매트릭스 그대로 유효 — 파일명·경로 변경 없음.
- R-9 (브랜드 spec 의 라우트 spec 우선권): §8.4.6 자리 정의 그대로.
- R-11 (워드마크 system 폰트 스택): svg fontFamily 시스템 sans 스택 유지.
- R-13 (§8.2 컬러 토큰 정식화 폐기): 본 R-14 도 컬러는 *자산 안에 박힌 hex* 로만 정의, 앱 테마 토큰 매핑은 여전히 보류 — R-13 의 단일 진실 보호 원칙 그대로.

**부분 폐기**:

- R-1 (덩굴 → node-graph 전환): node-graph 모티프 자체가 R-14 로 대체되므로 *Superseded by R-14* 마킹. 단 "덩굴 곡선 식물 모티프로의 회귀는 안 한다" 는 R-1 의 핵심 원칙은 R-14 에서도 유지 — 새 마크는 식물이 아니라 *노드 간 관계의 추상화*.
- R-6 (16px 별도 vector): 옛 node-graph 의 복잡도를 전제로 한 규정. 새 마크는 단일 path 이므로 §8.4.2 가 *"단일 path 그대로 축소"* 로 일반화. R-6 의 *"가독성 무너지면 별도 vector"* fallback 절차는 유지.

**향후 작업**:

- 새 gradient (teal → lime) 의 app 테마 토큰 매핑 — R-13 의 §8.2 보류 결정을 그대로 따른다. 별도 PR.
- `apple-icon.png` / `opengraph-image.png` raster 생성 — 1차 교체 시점의 follow-up 이 그대로 유효. 단 생성 소스는 R-14 의 새 SVG.
- sidebar 헤더 `#111e14` 와 dark mark 컨테이너 `#0a1f1f` 의 색상 조화 — 동일 dark surface 가 다른 hex 를 쓰는 일시 불일치. 사용자 시각 검토 후 통일 (별도 PR).

**출처**:
- 새 마크 원본: `temp/logo.svg` (사용자 제공).
- 사용자 결정 (2026-05-25 대화): *"우리의 새로운 로고. 파비콘 포함 모든 로고 갱신, 스펙도 갱신"*.

### R-15. 워드마크 layout 개정 — capital C, monochrome, no sub-copy (2026-05-25)

**결정**: §8.3 typography + §8.4.3 풀로고 구성 + §8.4.4 워드마크 규정을 재개정.

| 항목 | 옛 (R-14 시점) | 신 (R-15) |
| --- | --- | --- |
| 표기 | `clemvion` (전체 소문자) | `Clemvion` (첫 글자 대문자) |
| font-weight | 200 base + 600 accent (2-tone) | **500 단일** |
| font-size | 26 (full logo) / 28 (wordmark-only) | **48** (양쪽 공통) |
| letter-spacing | -0.5 | **-1** |
| fill | base `#0e1a12` + accent `#0e8c8a`/`#8be67e` (2-tone) | **단색 단일** — light `#0e1a12` / dark `#e8f5ec` |
| 풀로고 구성 | mark + wordmark + sub-copy *AGENTIC WORKFLOW* (3요소) | **mark + wordmark (2요소)** — sub-copy 폐기 |
| 풀로고 viewBox | 260×80 | **320×80** |

`<Logo>` 컴포넌트 API · 자산 파일명 · 호출 위치 모두 그대로 — 변경은 SVG content 내부에 한정.

**근거**:

- 사용자가 첨부 이미지로 새 워드마크 시안 제공 — *user-driven design change*. mark 자체는 그대로 유지 (R-14 의 single-path teal→lime gradient), 워드마크 layout 만 갱신.
- 새 표기 `Clemvion` 은 §1 의 정식 brand name (대문자 표기) 과 일치. 옛 SVG 의 소문자 표기는 stylization 이었고, 사용자 의도는 정식 표기 정렬로 해석.
- font-weight 500 + size 48 은 옛 weight 200 + size 26 대비 시각적으로 *substantially heavier and bigger* — 워드마크가 마크와 동등한 시각 비중을 가져 균형 잡힌 lockup 구성.
- 2-tone `vi` 시그니처 폐기는 R-3 → R-13 → R-14 이력의 자연스러운 연장 (spec 정식 규정은 R-13 에서 이미 단색, 자산 안 디자인만 잠정 유지였음). R-15 는 자산 안 디자인까지 단색으로 통일.
- sub-copy `AGENTIC WORKFLOW` 폐기는 R-5 (sub-copy 상시) 의 반전. R-5 의 근거 *"카테고리 디스크립터 항상 노출"* 은 풀로고 시각이 아니라 marketing-page hero copy / OG meta description / `<title>` 로 옮겨졌다고 본다 — 풀로고 자체가 시각적으로 차지하는 영역을 줄여 다양한 surface (좁은 헤더, 작은 카드) 에서의 사용성 향상.
- viewBox 폭 확장 (260 → 320): font-size 48 + "Clemvion" 8자 + letter-spacing -1 의 텍스트 폭 (≈ 210 viewBox 단위) + 좌 mark (70) + 좌우 margin → 320 이 자연스러운 폭. 80 height 는 유지.

**기각된 대안**:

- font-weight 600 / 700 (semibold/bold) — 사용자 시안의 시각적 무게는 medium (500) 으로 판단. semibold 는 더 두꺼워 마크 gradient 와 비교해 텍스트가 과중. 사용자 시안 재제공 시 재검토 가능.
- 워드마크 소문자 유지 (`clemvion`) — 사용자 시안이 명백히 대문자 `C` 제시. §1 정식 표기와도 정렬되므로 채택.
- sub-copy `AGENTIC WORKFLOW` 를 wordmark 아래 작은 자리에 잔존 — 사용자 시안에 없음. R-5 폐기로 결론.
- viewBox 비율 유지 (260×80 → 더 좁은 텍스트) — 텍스트 폭이 줄어 lockup 균형 깨짐.

**보존되는 결정**:

- R-1·R-14 (마크 모티프) — 마크 SVG path 는 그대로.
- R-6 (16px favicon 가독성) — 본 R-15 는 favicon-16/icon-32/apple-icon 영향 없음 (그것들은 mark 만 포함).
- R-7 (자산 9종 정식화) — §8.4.1 매트릭스 그대로. 단 `logo.svg`·`logo-dark.svg`·`logo-wordmark.svg`·`opengraph-image.svg` 4개 자산의 내용물만 갱신.
- R-9 (브랜드 spec 우선권) — 라우트 spec 의 *AGENTIC WORKFLOW* 노출은 본 §8 의 책임이 아니라 각 surface spec 이 결정 (R-9 그대로 적용).
- R-11 (워드마크 system 폰트 스택) — weight 200/600 fallback 안정성 → weight **500** fallback 안정성 으로 약화. 시스템 sans-serif 의 weight 500 은 OS 표준 (Helvetica Neue Medium / Arial Bold fallback).
- R-13 (워드마크 단색 규정) — R-15 가 R-13 의 단색 규정을 *자산 디자인 차원에서도* 완성. R-3 의 2-tone 잔존이 끝남.
- R-14 (마크 자산) — 마크는 그대로.

**부분 폐기**:

- R-5 (sub-copy 상시 부착): *Superseded by R-15*. 풀로고 시각에서는 폐기, brand identity 의 tagline 으로는 잔존.
- R-3 (2-tone `vi`): R-13 으로 spec 폐기, R-15 로 자산 폐기. 2단계 supersession 완성.

**향후 작업**:

- `<Logo>` 컴포넌트의 `DEFAULT_ALT.full = "Clemvion — Agentic Workflow"` 는 그대로 유지 — 풀로고 변종이 brand tagline 을 함의하는 marketing-purpose 자리에 노출되는 케이스 (인증 카드 위, 사이드바 등) 에서 a11y 컨텍스트 보존. SVG `<title>`/`aria-label` 은 시각에 맞춰 *"Clemvion"* 으로 좁힘 (`<img alt>` 가 우선).
- `Agentic Workflow` tagline 의 marketing-page 노출 자리 — 각 라우트 spec 이 정의. brand spec 의 책임 밖.
- `apple-icon.png` / `opengraph-image.png` raster 생성 — R-14 의 follow-up 이 그대로 유효. 단 OG 의 생성 소스는 R-15 의 새 SVG.

**출처**:

- 새 워드마크 시안: 사용자 첨부 이미지 (2026-05-25 대화).
- 사용자 결정 (2026-05-25 대화 2차): *"로고는 그대로 두고, 글자의 크기와 배치만 첨부 이미지처럼 변경해줘. (라이트모드와 다크모드를 분리해야해)"*.

### R-16. 투명 배경 + 흑백 단일 분리 (2026-05-25, 3차 개정)

**결정**: 브랜드 자산(`logo.svg`, `logo-dark.svg`, `logo-mark.svg`, `logo-wordmark.svg`, 신규 `logo-wordmark-dark.svg`) 의 SVG 컨테이너 fill 을 전체 폐기 → **transparent**. 워드마크 fill 을 `#0e1a12`/`#e8f5ec` 에서 **pure `#000000`/`#ffffff`** 로 통일. `logo-mark-dark.svg` 는 transparent 후 light 변종과 동일해지므로 **삭제**, `<Logo>` 컴포넌트의 mark 양쪽 path 가 동일 파일을 가리키도록 정리. 신규 `logo-wordmark-dark.svg` 추가, `<Logo>` wordmark 양쪽 path 가 light/dark 별도 파일을 가리키도록 분리.

**근거**:

- 사용자 결정 *"라이트모드나 다크모드 둘다 배경은 투명으로 하고. 글자색만 검은색과 흰색으로 나뉘어."* — 컨테이너 fill 의 hex 결정(R-14 의 `#eef5ec`/`#0a1f1f`) 을 surface 의 책임으로 위임. 브랜드 자산은 *문자 그대로 vector 만 그리고, 배경은 호출 측이 결정*.
- 흑백 통일은 *디자인 의도가 surface 톤을 따라가는 단색 vector* — `#0e1a12` (R-15) 도 흑에 매우 가까웠으나, pure black/white 로 통일하면 자산 안 hex 가 디자인 의도(surface 대비) 와 1:1 매칭.
- `logo-mark-dark.svg` 의 삭제: R-14 시점에서 dark 변종은 *dark teal 컨테이너 위 gradient mark* 였으나, R-16 의 transparent 이후 light/dark 모두 *transparent 위 gradient mark* 가 되어 내용물이 동일. 파일 중복 보존은 무의미.
- 신규 `logo-wordmark-dark.svg`: wordmark 가 흑백 분리되므로, 옛 *"wordmark 는 단일 변종, vi accent 가 양쪽에서 시인성 유지"* (R-3 이후 잠정 디자인) 의 마지막 잔재가 폐기.
- 유틸리티 자산 (favicon-16, icon, apple-icon, opengraph-image) 은 본 R-16 의 transparent 규정에서 **예외**:
  - favicon-16 / icon: 브라우저 탭 표시. 탭 자체의 배경 (Chrome/Safari 의 OS-aware 톤) 위에 mark 만 떠 있으면 시인성 저하.
  - apple-icon: iOS 홈스크린 표시. transparent 면 사용자 wallpaper 가 비쳐 들어 일관성 깨짐.
  - opengraph-image: 외부 소셜 카드. X/Twitter/Slack/Facebook 크롤러는 transparent 를 자체 톤으로 채우는데 톤이 surface 별로 달라 일관성 깨짐.
- `<Logo>` 컴포넌트 외부 API (variant·theme prop, alt 텍스트) 는 변경 없음. ASSET_PATHS 의 내부 매핑만 갱신.

**기각된 대안**:

- 모든 자산을 transparent (favicon·icon·apple-icon·OG 포함) — 시인성/일관성 문제로 기각. 사용자는 *"라이트모드나 다크모드"* 컨텍스트로 발언했고, 이는 app 의 테마 모드 (`<Logo>` 가 다루는 영역) 를 지칭. favicon·OG 등은 app 테마 모드 영역 밖.
- `logo-mark-dark.svg` 보존 (R-14 dark 컨테이너 유지) — R-16 의 transparent 결정과 모순. R-14 dark 컨테이너 자체가 *transparent 면 dark surface 와 충돌하지 않으므로* 불필요.
- wordmark 단일 변종 + CSS 로 색 토글 (`<img>` 가 아닌 inline SVG 사용) — `<Logo>` 가 `<img>` 기반이라 fill 을 CSS 로 직접 토글 불가. inline SVG 전환은 SSR/streaming 영향 — 별개 결정으로 기각.

**보존되는 결정**:

- R-1·R-14 (마크 모티프): mark path/gradient 모두 그대로.
- R-7 (자산 9종 정식화): R-16 으로 1개 삭제 + 1개 신설 → **여전히 9종** (logo·logo-dark·logo-mark·logo-wordmark·**logo-wordmark-dark**·favicon-16·icon·apple-icon·opengraph-image). 매트릭스 그대로 grep 가능.
- R-9 (브랜드 spec 우선권): 라우트 spec 의 surface 톤 결정은 본 §8 가 결정하지 않음 — R-16 의 transparent 규정으로 자산은 surface 결정에 더 잘 적응.
- R-11 (워드마크 system 폰트 스택): font/weight/letter-spacing 동일.
- R-13 (워드마크 단색 규정) → R-15 (자산 안 2-tone 폐기) → R-16 (자산 fill 흑백 통일) 의 3단 supersession 완성.
- R-14 (마크 자산), R-15 (워드마크 layout): 본 R-16 은 *추가 개정* 이며 R-14·R-15 의 결정은 그대로.

**부분 폐기**:

- R-14 의 *"dark mark 컨테이너 `#111e14` → `#0a1f1f` (dark teal)"* 결정 — R-16 으로 컨테이너 자체가 transparent 가 되어 hex 결정이 무효. 이력은 R-14 본문에 남김.
- R-15 의 워드마크 fill `#0e1a12`/`#e8f5ec` — R-16 으로 pure `#000000`/`#ffffff` 로 갱신. fill 색 자체의 디자인 의도(*ink 톤 vs surface 톤 대비*) 는 R-16 에서도 유지 — 톤만 더 절대적인 흑백.

**향후 작업**:

- 사이드바 헤더 `bg-[#111e14]` / 인증 카드 wrapper `bg-[#111e14]` — R-14 시점의 *dark brand surface* 가 R-16 의 transparent 로고 위에서도 그대로 유효. dark 시멘틱 토큰화 follow-up (R-14 `향후 작업` 참조) 은 그대로 유효.
- `<Logo>` 컴포넌트의 `DEFAULT_ALT.full`/`DEFAULT_ALT.wordmark` 동일 유지 — 시각 변경 없음.
- `apple-icon.png` / `opengraph-image.png` raster 생성 — R-14 follow-up 그대로 유효. raster 도구 도입 시점에서 R-16 의 새 SVG 가 소스.

**출처**:

- 사용자 결정 (2026-05-25 대화 3차): *"배경색도 변경해야 할 것 같아. 라이트모드나 다크모드 둘다 배경은 투명으로 하고. 글자색만 검은색과 흰색으로 나뉘어."*.

### R-17. 사이드바·인증 로고 surface 의 dedicated dark backdrop 폐기 (2026-05-25, 4차 개정)

**결정**: 사이드바 헤더 row (`codebase/frontend/src/components/layout/sidebar.tsx`) 와 인증 화면 로고 wrapper (`codebase/frontend/src/app/(auth)/layout.tsx`) 의 `bg-[#111e14]` (R-14 가 *dark brand surface* 로 도입한 dedicated dark backdrop) 를 폐기. `<Logo theme="dark">` (강제 다크 자산) → `<Logo theme="auto">` (현재 테마 모드 자동 토글) 로 전환. 로고는 sidebar 의 `--card` surface / 인증 gradient surface 위에 R-16 의 transparent SVG 로 직접 얹힘.

**근거**:

- 사용자 결정 (이미지 첨부): 사이드바 헤더 row 의 `#111e14` dark backdrop 이 sidebar body 의 neutral palette 와 시각 단절을 일으킴 — 헤더만 dark, 본문만 light 의 *patched* 인상. R-14 도입 당시는 *gradient mark 가 light surface 위에서 묻혀 보일* 우려로 dedicated backdrop 을 깔았으나, R-16 의 transparent + R-15 의 흑백 워드마크 이후 light surface 위에서도 시인성 충분.
- R-14 가 dark backdrop 을 도입한 핵심 사유 (*vine-green ramp 가 light surface 와 충돌*) 는 R-13 + R-14 + R-15 + R-16 의 4 단계 디자인 진화로 무효화. 현 자산은 *gradient teal→lime mark + monochrome black/white wordmark* 로, surface 톤만 따라가면 충돌하지 않음.
- `<Logo theme="auto">` 패턴은 이미 다른 자리 (마케팅 페이지·dashboard 카드) 에서 사용 중. 사이드바·인증만 dark 강제는 일관성 깨짐.
- dark mode 활성화 시 sidebar `--card` 가 dark teal 톤으로 전환 → dark wordmark (흰색) + transparent gradient mark 가 자연스럽게 어울림. light mode 도 동일하게 surface 가 light 톤일 때 light wordmark (검정) 가 어울림.

**기각된 대안**:

- backdrop hex 만 갱신 (`#111e14` → 다른 dark tone) — 사용자 의도는 *backdrop 자체* 의 제거. hex 갱신은 패치워크 인상 유지.
- 사이드바만 제거, 인증은 유지 — 두 자리는 동일 R-14 결정으로 도입된 형제 surface. 한쪽만 제거하면 spec 의 *로고 노출 자리 일관성* 깨짐.
- `<Logo theme="auto">` 대신 `theme="light"` 강제 — sidebar `--card` 가 dark mode 에서 어두워질 때 검정 wordmark 가 묻혀 보임. auto 가 옳음.

**보존되는 결정**:

- R-9 (브랜드 spec 의 라우트 spec 우선권): 본 §8.4.6 자리 매핑이 라우트 spec 보다 우선이라는 원칙은 그대로. R-17 은 §8.4.6 표 본문에 *"R-17 이후 dedicated dark backdrop 없음, theme=auto"* 명시.
- R-15 / R-16 (워드마크 layout, transparent, 흑백 단일 분리): 자산 자체의 디자인은 그대로. R-17 은 *호출 측 wrapper* 만 변경.
- R-11 (워드마크 system 폰트 스택): 영향 없음.

**부분 폐기**:

- R-14 의 *"sidebar 헤더 + 인증 카드 wrapper 는 `bg-[#111e14]` dark brand surface 유지"* 결정 — R-17 으로 폐기. R-14 본문의 *"sidebar 헤더 `#111e14` 와 dark mark 컨테이너 `#0a1f1f` 의 색상 조화"* 향후 작업도 R-17 으로 무효 (`#111e14` 자체가 사라짐).
- R-14 의 *"dark mark 컨테이너 `#111e14` → `#0a1f1f` (dark teal)"* 자산 결정은 R-16 으로 이미 무효 (컨테이너 transparent). R-17 은 R-16 의 연장선.

**향후 작업**:

- R-14 의 *"sidebar/auth `#111e14` 통일"* follow-up 은 R-17 으로 자연 해소 — 별도 작업 없음.
- dark mode 가 도입되면 (`spec/conventions/theme-mode.md` 같은 별도 spec 으로 도입 예정) `<Logo theme="auto">` 가 자동으로 올바르게 작동. dark mode 토글 UI 는 본 §8 의 책임 밖.
- 다른 자리 (dashboard 카드, 마케팅 페이지) 의 `<Logo theme="dark">` 강제 호출이 남아있다면 R-17 의 정신에 맞춰 `theme="auto"` 로 점진 전환 — 별도 follow-up.

**출처**:

- 사용자 결정 (2026-05-25 대화 4차): *"페이지의 로고 부분에서 백그라운드 색은 제거하고, 라이트모드와 다크모드 로고를 그대로 적용하면 좋을듯"* + 사이드바 스크린샷 첨부.
