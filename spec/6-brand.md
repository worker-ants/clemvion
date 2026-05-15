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

Clemvion 의 로고는 워크플로우의 **노드 그래프** 그 자체를 형상화한다. 중앙의 수직 흐름선(spine), 좌우로 뻗은 분기선(branches), 그리고 그래프 위에 흩어진 원형 노드들이 한 덩어리로 잎/흐름의 형태를 이룬다.

- spine — 중앙 수직 흐름 (Living Workflow 의 *변하지 않는 주축*)
- branches — 좌우로 뻗은 분기 (Agent-Native Nodes 의 *판단·적응*)
- nodes — 각 단계의 실행 단위 (`Deep Integration`)

이 모티프는 *"흐름은 자라나야 한다"* 는 Brand Story (§2) 의 시각적 환원이다.

### 8.2 컬러 (보류)

본 §8.2 는 정식 비주얼 가이드 도입 시 채워진다. 현 시점에서는 다음 두 가지만 정의한다:

1. **자산 안에 박힌 컬러** — 정식 로고/파비콘 SVG (§8.4.1) 는 자체 fill 로 다음 vine-green 계열을 사용한다. 본 값들은 SVG 안에 박혀 있고, **앱 테마 토큰으로의 매핑은 본 spec 의 책임 밖**이다 (현 상태 = 매핑 없음).

   라이트 변종: `#1a4f2c`, `#1e7a42`, `#2a7040`, `#2a8a48`, `#3a9a58`, `#4ab868`, `#5ab872`. 워드마크 `vi` accent fill = `#1e7a42`, base fill = `#0e1a12`, 서브카피 fill = `#5ab872`.

   다크 변종: 컨테이너 fill `#111e14` + 노드 graph `#1e4a2a` / `#3aae58` / `#4fce72` / `#6edc8e` / `#7de890` / `#9efab2`. 워드마크 `vi` accent fill = `#6edc8e`, base fill = `#e8f5ec`, 서브카피 fill = `#4fce72`.

2. **앱 테마** — 현재 `frontend/src/app/globals.css` 는 Shadcn neutral 토큰을 사용한다 (`--primary` 등 라이트 near-black, 다크 near-white). 브랜드 컬러를 앱 테마에 통합하는 정식 결정은 본 §8.2 의 향후 갱신 항목이다.

> 옛 임시 §8.1 (Vine Green / Deep Forest / Bud Lime / Bark / Soil / Ink 6-token 가이드) 은 본 §8.2 의 *"보류"* 상태로 흡수되었다. 별도 컬러 가이드 결정 전까지 해당 6개 토큰명은 사용하지 않는다 (단 SVG 자산 안의 HEX 는 위 1항이 정의).

### 8.3 타이포그래피

| 용도 | 폰트 | 비고 |
| --- | --- | --- |
| 본문·UI | **Geist Sans** | 기존 `next/font/google` 유지 |
| 코드·모노 | **Geist Mono** | 기존 유지 |
| 워드마크 base | system sans-serif (`Helvetica Neue`, `Helvetica`, `Arial`) | weight **200**, letter-spacing `-0.5px`, font-size 26px (full logo 기준). SVG 자산에 박힘 |
| 워드마크 accent (`vi`) | 동일 폰트 | weight **600**, fill = `#1e7a42` (light SVG) / `#6edc8e` (dark SVG). SVG 자산에 박힘 |
| 서브카피 (`AGENTIC WORKFLOW`) | monospace (`Courier New`) | font-size 8px, letter-spacing 3px, uppercase, fill = `#5ab872` (light) / `#4fce72` (dark). SVG 자산에 박힘 |

워드마크 svg 가 fontFamily 에 시스템 폰트 스택을 명시하는 이유는 Geist 미설치 환경에서의 weight 200/600 fallback 안정성 (R-11 참조).

### 8.4 로고 시스템

#### 8.4.1 변종 매트릭스

| 변종 | 정식 경로 | 사용처 |
| --- | --- | --- |
| Full logo (light) | `frontend/public/logo.svg` | 라이트 배경 풀로고 — mark + wordmark + sub-copy 동반 |
| Full logo (dark) | `frontend/public/logo-dark.svg` | 다크 배경 풀로고 |
| Icon mark (light, 96px master) | `frontend/public/logo-mark.svg` | 사이드바, 로딩, 카드 |
| Icon mark (dark) | `frontend/public/logo-mark-dark.svg` | 다크 배경 mark |
| Wordmark only | `frontend/public/logo-wordmark.svg` | 좁은 자리 — sub-copy 없이 텍스트만 |
| Favicon multi (16/32/48 합성) | `frontend/src/app/favicon.ico` | 브라우저 탭 |
| App icon (Next.js metadata) | `frontend/src/app/icon.svg` | 32px 기본, Next.js 자동 노출 |
| Apple touch icon | `frontend/src/app/apple-icon.png` (180×180 PNG) | iOS 홈스크린. *현재 임시 SVG (`frontend/public/apple-icon.svg`) 사용 중 — PNG 변환은 §8.6 follow-up* |
| OG / Twitter card | `frontend/src/app/opengraph-image.png` (1200×630 PNG) | SNS 공유 미리보기. *현재 임시 SVG (`frontend/public/opengraph-image.svg`), metadata 미선언 — PNG 변환 후 재활성화는 §8.6 follow-up* |

#### 8.4.2 16px 전용 변종 (favicon 가독성)

favicon 16×16 은 96px master 의 단순 축소가 아니라 **별도 vector 자산**으로 둔다. 노드는 4개 이하, 라인은 3개 이하로 단순화한다. OS 탭에서 mark 의 형태가 식별 가능해야 한다.

#### 8.4.3 풀로고 구성

풀로고는 항상 **3요소 동반**:

1. Icon mark (좌)
2. Wordmark `clem`**`vi`**`on` (중앙)
3. Sub-copy `AGENTIC WORKFLOW` (wordmark 아래)

Sub-copy 는 풀로고에서 **상시** 부착한다 — 마케팅 페이지·제품 헤더·이메일 서명·OG 이미지 등 풀로고가 노출되는 모든 자리. Sub-copy 없이 wordmark 만 필요한 경우 §8.4.1 의 **Wordmark only** 변종을 별도 사용한다.

풀로고 기본 viewBox: `260 × 80` (icon mark 64×64 + 좌측 여백 16 + wordmark+sub-copy 영역).

#### 8.4.4 워드마크 사용 규정

워드마크는 **단색 또는 단색 반전만 허용**한다 (옛 임시 가이드의 단색 규정으로 복원, 2026-05-15 §8 부분 롤백 — R-13 참조).

> 단, 현재 정식 SVG 자산(`logo.svg`, `logo-dark.svg`, `logo-wordmark.svg`) 은 `clem`**`vi`**`on` 의 `vi` 두 글자를 별도 weight + 색(`#1e7a42` 라이트 / `#6edc8e` 다크) 으로 강조하는 2-tone 시그니처를 **자산 안에 박힌 디자인**으로 보유한다. 이는 정식 비주얼 가이드(§8.2 보류) 상태에서의 잠정 자산 디자인이며, 새 워드마크 자산을 그릴 때 본 §8.4.4 의 단색 규정을 따를지 / 2-tone 시그니처를 정식화할지는 §8.2 갱신과 함께 결정한다.

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
| 사이드바 상단 ([`spec/2-navigation/_layout.md` §2.1](./2-navigation/_layout.md#21-구성)) | expanded → Full logo / collapsed → Icon mark. 라이트/다크 자산 선택은 노출 자리의 surface 에 맞춤 | 클릭 시 `/dashboard` |
| 인증 화면 (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`) | Full logo | 카드 컨테이너 위 중앙 배치. 카드 자체의 배경·여백은 [`spec/2-navigation/10-auth-flow.md` §1](./2-navigation/10-auth-flow.md#1-화면-구성-개요) 가 정의 (brand spec 은 변종만 결정) |
| 브라우저 탭 | Favicon multi | 라이트/다크 자동 전환은 브라우저 표준 동작에 위임 |
| iOS 홈스크린 | Apple touch icon | 180×180 (현 임시 SVG, PNG 는 §8.6 follow-up) |
| SNS / 외부 공유 | OG image | 1200×630 (현 임시 SVG, metadata 비활성화 — §8.6 follow-up) |

라이트/다크 자산 선택은 노출 자리(surface) 의 배경 톤을 기준으로 한다 — 어두운 surface (예: 사이드바의 vine-dark 헤더 영역) 위에는 dark 변종을 둔다.

### 8.5 어조와 스타일

- 한국어를 1차 언어로 한다. 영어 표기는 제품명·고유명사에 한정한다.
- 의인화·유사 자연 비유(자라다, 뻗다, 엮다, 흐름)를 핵심 마케팅 카피에 사용한다.
- 기능 설명에서는 과장·감탄사 없이 짧고 단정한 문장을 쓴다.

### 8.6 자산 마이그레이션

(근거: R-1, R-7, R-13)

이전 임시 자산 (덩굴 + 잎 곡선 모티프) 은 본 §8 발효(2026-05-15)와 함께 폐기되었다.

폐기 (옛 자산):

- `frontend/public/logo.svg` (옛 덩굴 곡선)
- `frontend/public/logo-mark.svg` (옛 심볼)
- `frontend/src/app/icon.svg` (옛 32px favicon)
- `frontend/src/app/favicon.ico` (옛 단일 사이즈)

정식 자산 9종 — §8.4.1 매트릭스 참조:

- `frontend/public/logo.svg` *(교체)* — Full logo (light)
- `frontend/public/logo-dark.svg` *(추가)* — Full logo (dark)
- `frontend/public/logo-mark.svg` *(교체)* — Icon mark (light, 96px master)
- `frontend/public/logo-mark-dark.svg` *(추가)* — Icon mark (dark)
- `frontend/public/logo-wordmark.svg` *(추가)* — Wordmark only
- `frontend/public/favicon-16.svg` *(추가)* — 16px 전용 vector (§8.4.2)
- `frontend/src/app/icon.svg` *(교체)* — Next.js metadata icon (32px)
- `frontend/public/apple-icon.svg` *(임시 추가)* — Apple touch icon. SVG 임시
- `frontend/public/opengraph-image.svg` *(임시 추가)* — OG image. SVG 임시, metadata 미선언

**현재 임시 상태 (follow-up 대기)**:

- `apple-icon.png` (180×180 PNG) — modern iOS ≥ 12 가 SVG apple-touch-icon 을 지원하므로 임시 SVG 로 노출 중. raster 도구(sharp/ImageMagick) 도입 후 PNG 변환 + metadata 갱신.
- `opengraph-image.png` (1200×630 PNG) — SVG OG 카드는 X/Slack/Facebook 크롤러 호환성이 불안정하여 `frontend/src/app/layout.tsx` 의 `openGraph.images` / `twitter.images` 를 **비활성화** 중. PNG 생성 후 `summary_large_image` 카드 + `images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }]` 재활성화.
- `favicon.ico` multi-size (16/32/48 합성) — 옛 파일은 삭제되었다. modern 브라우저는 `icon.svg` 우선 사용하므로 영향 없음. raster 도구 도입 후 합성 .ico 생성.

위 3건은 별도 follow-up PR 의 대상이다 (`plan/in-progress/brand-refresh-impl.md §1.2, §1.3` 참조).

---

## 9. 변경 이력

| 일자 | 항목 | 비고 |
| --- | --- | --- |
| 2026-05-05 | 최초 작성 | 제품명을 Idea Workflow → Clemvion으로 전환하며 브랜드 가이드 신설 |
| 2026-05-15 | §8 정식 개정 | 옛 *Visual Identity (초안)* §8.1–§8.4 전면 폐기. Node-graph 모티프 정식 채택, Vine ramp 7단계 + Neutral + Dark 토큰 동시 도입, 워드마크 2-tone 허용, `AGENTIC WORKFLOW` 서브카피 상시 부착, 자산 9종 정식화. 옛 6개 토큰(Vine Green/Deep Forest/Bud Lime/Bark/Soil/Ink) 폐기·재정의. 동반 동기화: `spec/2-navigation/_layout.md` §2.1, `spec/2-navigation/10-auth-flow.md` §1 |
| 2026-05-15 | §8 부분 롤백 | 사용자 피드백 *"전체적인 색상이 별로"* 로 §8.2 컬러 토큰 정식화 / §8.2.4 코드 매핑 / §8.2.5 폐기 토큰 매트릭스 / §8.2.6 일시 불일치 윈도우 / §8.4.4 2-tone 정식 허용을 **폐기**. §8.1 노드 그래프 모티프, §8.4.1–§8.4.3·§8.4.5·§8.4.6 로고 시스템, §8.5 어조, §8.6 자산 9종 매트릭스는 유지. R-2/R-3/R-4/R-8/R-10 은 Superseded 표시로 보존, R-13 신설. 동반 동기화: `spec/2-navigation/_layout.md` §2.1 (Full logo (light) → Full logo), `spec/2-navigation/10-auth-flow.md` §1 (배경 그라데이션 복원). 제목에서 `PRD:` prefix 제거 |

---

## Rationale

본 섹션은 §8 정식 개정의 배경·근거·기각된 대안을 inline 으로 보관한다.

### R-1. 덩굴 곡선 → 노드 그래프 모티프 전환

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

### R-3. 워드마크 2-tone 시그니처 채택 — *Superseded by R-13 (2026-05-15)*

> 본 결정은 2026-05-15 §8 부분 롤백으로 폐기되었다. §8.4.4 는 단색 규정으로 복원. 단 현 정식 SVG 자산은 `vi` 2-tone 시그니처를 *자산 안에 박힌 디자인* 으로 유지 — 새 워드마크 자산을 그릴 때만 단색 규정 적용. 2-tone 정식화 재논의는 §8.2 갱신 시.

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

### R-5. `AGENTIC WORKFLOW` 서브카피 상시 부착

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
- Stage 2 (commit `ee94a8e8`) 에서 §8.2 의 Vine ramp 를 `frontend/src/app/globals.css` 의 Shadcn 슬롯(`--primary` 등)에 매핑한 결과, 사용자가 *"전체적인 색상이 별로"* 로 거부. 이후 globals.css 는 main 의 neutral 팔레트로 복원(commit `df1533ab`).
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
