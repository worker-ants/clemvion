# 정식 규약 준수 Check Payload

본 파일은 orchestrator 가 정식 규약 준수 checker 용으로 작성한 입력입니다. target 문서가 정식 규약(`spec/conventions/**`) 을 따르고 있는지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (정식 규약 준수)

1. **명명 규약** — 파일·식별자·API endpoint 명명이 conventions 규칙과 일치하는가
2. **출력 포맷 규약** — 노드 Output, API 응답, error code 형식 등이 정식 규약을 따르는가
3. **문서 구조 규약** — Overview / 본문 / Rationale 3섹션 권장, `_product-overview.md`·`0-` prefix 등 CLAUDE.md 의 명명 컨벤션 준수
4. **API 문서 규약** — Swagger 패턴·request/response DTO 명명
5. **금지 항목** — conventions 에서 명시적으로 금지한 패턴(예: 옛 prd/, memory/ 경로 사용)을 답습하고 있지 않은가

## 검토 모드
spec draft 검토 (--spec)

## Target 문서
경로: `plan/in-progress/spec-draft-brand-refresh.md`

```
---
worktree: brand-refresh-7a3f12
started: 2026-05-15
owner: project-planner
---

# Spec Draft: spec/6-brand.md §8 정식 개정 (Visual Identity)

본 draft 는 `spec/6-brand.md` §8 (Visual Identity) 의 정식판이다. 현재 §8 은 *"임시 가이드 — 디자이너 협업으로 정식 비주얼 가이드가 마련되면 교체한다"* 상태이며, 본 draft 가 채택되면 그 자리를 대체한다.

## Drop-in 대체 범위 (BLOCK 해소 — 명시)

본 §8 정식판은 현행 `spec/6-brand.md` 의 다음 하위 섹션 전체를 **삭제하고** 본 draft 의 §8.1–§8.6 으로 **대체**한다. 부분 병합 금지.

- 현행 §8.1 **컬러 (1차 제안)** — 폐기 (6개 토큰 모두 §8.2 신 토큰으로 대체. 매핑 표는 본 draft §8.2.5)
- 현행 §8.2 **타이포그래피** — 폐기 (워드마크 폰트·weight·자간 정의가 본 draft §8.3 으로 전면 재정의)
- 현행 §8.3 **로고 사용 규정 (초안)** — 폐기 (특히 *"단색 또는 단색 반전만 허용"* 조항 무효. 본 draft §8.4.4 의 2-tone 시그니처 채택으로 대체)
- 현행 §8.4 **어조와 스타일** — 본 draft §8.5 로 위치만 이동 (내용 동일)

§8 외 섹션(§1–§7, §9, §10 이하) 은 본 draft 의 영향 범위가 아니며, §9 변경 이력에 행 1개를 추가한다.

## 변경 요약

1. **모티프 전환**: 덩굴 + 잎 곡선 → **노드 그래프 (node graph forming a flow tree)**. 제품의 Core Concept (`Living Workflow`, `Agent-Native Nodes`) 을 형상으로 직접 표현.
2. **컬러 정식화**: 컨셉 4-step Green ramp 를 정식 토큰으로 도입 (`vine-300 ~ vine-900` + neutral + dark).
3. **다크 모드 토큰 신설**: 이번 개정에서 light/dark 페어 동시 정식 도입.
4. **워드마크 2-tone 허용**: `clem**vi**on` 의 `vi` 강조 (weight 600 + vine-700) 를 정식 시그니처로 보존. *"단색만 허용"* 규정 개정.
5. **서브카피 상시화**: `AGENTIC WORKFLOW` 서브카피를 풀로고에 상시 부착.
6. **자산 9종 정식화**: full(light/dark), mark(light/dark), wordmark, favicon, app icon, apple-icon, OG image.

원본 컨셉: `temp/clemvion_logo_concepts.html` (gitignored, 사용자 보관).

연관 spec 동기화 (본 Stage 1 안에서 함께 처리):

- `spec/2-navigation/_layout.md` §2.1 사이드바 로고 행 — expanded/collapsed 변종 규칙 추가
- `spec/2-navigation/10-auth-flow.md` §1 배경 기술 — "브랜드 색상 또는 그래디언트" → "`soil-50` 또는 `vine-700` 단색 (그라데이션 금지, §8.4.4 참조)" 로 구체화. `[Logo]` 자리에 변종 참조 주석 추가.

---

## §8 정식 개정안 (drop-in 대체)

> 본 draft 의 아래 ## 8. ~ ## 9. 와 ## Rationale 가 `spec/6-brand.md` 의 현 §8(임시), §9(변경 이력) 행 추가, 신규 ## Rationale 섹션 본문으로 그대로 들어간다.

---

## 8. Visual Identity

### 8.1 디자인 모티프

Clemvion 의 로고는 워크플로우의 **노드 그래프** 그 자체를 형상화한다. 중앙의 수직 흐름선(spine), 좌우로 뻗은 분기선(branches), 그리고 그래프 위에 흩어진 원형 노드들이 한 덩어리로 잎/흐름의 형태를 이룬다.

- spine — 중앙 수직 흐름 (Living Workflow 의 *변하지 않는 주축*)
- branches — 좌우로 뻗은 분기 (Agent-Native Nodes 의 *판단·적응*)
- nodes — 각 단계의 실행 단위 (`Deep Integration`)

이 모티프는 *"흐름은 자라나야 한다"* 는 Brand Story (§2) 의 시각적 환원이다.

### 8.2 컬러 토큰

#### 8.2.1 Vine Ramp — Primary (라이트 모드)

| 토큰 | HEX | 역할 |
| --- | --- | --- |
| `vine-900` (Deep Vine) | `#1a4f2c` | 루트 노드, 텍스트 강조, 다크 액션 hover |
| `vine-800` (Spine) | `#2a7040` | 중앙 흐름 stroke (mark 내부) |
| `vine-700` (Primary) | `#1e7a42` | **주요 액션**, 워드마크 `vi` 강조, 1차 브랜드 컬러 |
| `vine-600` (Branch) | `#2a8a48` | 1차 분기 노드 |
| `vine-500` (Leaf) | `#3a9a58` | 2차 분기 노드, 보조 강조 |
| `vine-400` (Sprout) | `#4ab868` | 하위 분기 노드, success state |
| `vine-300` (Mist) | `#5ab872` | 외곽 라인, 서브카피 |

#### 8.2.2 Neutral — 라이트 모드

| 토큰 | HEX | 역할 |
| --- | --- | --- |
| `ink` | `#0e1a12` | 본문 텍스트, 워드마크 base |
| `ink-60` | `#0e1a12` @ 60% opacity | 보조 텍스트 (옛 `Bark` 대체) |
| `ink-40` | `#0e1a12` @ 40% opacity | 비활성 텍스트, hint |
| `soil-50` | `#f7f8f6` | 페이지 배경 |
| `soil-100` | `#eef5ec` | 카드/마크 배경 (라운드된 mark 컨테이너 fill) |
| `vine-border` | `#e4e8e0` | 카드 보더 (Tailwind/Shadcn `--border` 와 충돌 방지 위해 `vine-border` 로 명명) |

#### 8.2.3 Dark Mode

| 토큰 | HEX | 역할 |
| --- | --- | --- |
| `vine-dark-bg-base` | `#0e1210` | 페이지 배경 |
| `vine-dark-bg-elevated` | `#111e14` | 카드/마크 컨테이너 배경 |
| `vine-dark-mid` | `#1e4a2a` | 스파인 조인트 (톤 다운된 점) |
| `vine-dark-spine` | `#3aae58` | 다크 spine stroke |
| `vine-dark-primary` | `#4fce72` | 다크 액션, 1차 분기 노드 |
| `vine-dark-leaf` | `#7de890` | 다크 2차 분기 노드 |
| `vine-dark-accent` | `#6edc8e` | 다크 워드마크 `vi` 강조 |
| `vine-dark-glow` | `#9efab2` | 루트 노드 (가장 밝은 강조점) |
| `text-on-dark` | `#e8f5ec` | 다크 본문 텍스트, 워드마크 base (Tailwind `text-{shade}` 및 `dark:` variant 와 충돌 방지 위해 `text-on-dark` 로 명명) |

#### 8.2.4 코드 토큰 매핑 (구현 위임 정책)

본 §8.2 는 **시각 토큰의 의미·HEX 정의**다. CSS 변수 명(`frontend/src/app/globals.css` 의 `--primary`, `--background`, `--foreground`, `--border`, `--muted-foreground` 등) 및 Tailwind theme key 로의 매핑은 `developer` skill 의 Stage 2 (`plan/in-progress/brand-refresh-impl.md`) 에서 수행한다. 그 이유는 §Rationale R-10 참고.

매핑 시 권장 방향 (구현자 결정):

- `vine-700` → `--primary` (현행 HSL `222.2 47.4% 11.2%` 폐기)
- `ink` → `--foreground`
- `ink-60` / `ink-40` → `--muted-foreground` 등 보조 토큰
- `soil-50` → `--background`
- `soil-100` → `--card`
- `vine-border` → `--border`
- `vine-dark-*` → 다크 :root 페어
- `text-on-dark` → `--foreground` (다크 모드)

#### 8.2.5 폐기된 토큰

이전 §8.1 (임시) 의 다음 토큰은 본 개정 발효와 함께 폐기된다. 코드/문서/디자인 자산에서 발견 시 신 토큰으로 마이그레이션한다. (근거: R-1, R-7 참조)

| 폐기 토큰 | 폐기 HEX | 대체 토큰 |
| --- | --- | --- |
| Vine Green (Primary) | `#1F8A4C` | `vine-700` `#1e7a42` |
| Deep Forest | `#0F3D2A` | `vine-dark-bg-elevated` `#111e14` |
| Bud Lime | `#A8D86F` | `vine-400` `#4ab868` |
| Bark | `#6B5544` | 제거. 텍스트 보조는 `ink-60` / `ink-40` (§8.2.2) |
| Soil | `#F4F1EC` | `soil-50` `#f7f8f6` |
| Ink | `#111111` | `ink` `#0e1a12` |

> 잔재 검출 명령(Stage 2 마무리 시 0건 확인): `grep -rn 'Vine Green\|Bud Lime\|Deep Forest\|#1F8A4C\|#A8D86F\|#0F3D2A\|#6B5544\|#F4F1EC' spec/ frontend/`

#### 8.2.6 일시 불일치 허용 윈도우

본 §8 발효 시점부터 Stage 2 (`brand-refresh-impl.md`) 완료까지, `frontend/` 의 CSS 변수·SVG 자산은 일시적으로 spec 의 신 토큰과 불일치할 수 있다. 이는 Stage 2 마무리에서 §8.2.5 의 grep 0 건 조건으로 해소된다.

### 8.3 타이포그래피 (현행 §8.2 전면 대체)

| 용도 | 폰트 | 비고 |
| --- | --- | --- |
| 본문·UI | **Geist Sans** | 기존 `next/font/google` 유지 |
| 코드·모노 | **Geist Mono** | 기존 유지 |
| 워드마크 base | system sans-serif (`Helvetica Neue`, `Helvetica`, `Arial`) | weight **200**, letter-spacing `-0.5px`, font-size 26px (full logo 기준) |
| 워드마크 accent (`vi`) | 동일 폰트 | weight **600**, color = `vine-700` (light) / `vine-dark-accent` (dark) |
| 서브카피 (`AGENTIC WORKFLOW`) | monospace (`Courier New`) | font-size 8px, letter-spacing 3px, uppercase, color = `vine-300` (light) / `vine-dark-primary` (dark) |

> 옛 §8.2 "워드마크 = Geist Sans Medium / 자간 `-0.01em`" 정의는 본 표로 **전면 대체**. 워드마크 svg 가 fontFamily 에 시스템 폰트 스택을 명시하는 이유는 Geist 미설치 환경에서의 weight 200/600 fallback 안정성 (R-11 참조).

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
| Apple touch icon | `frontend/src/app/apple-icon.png` (180×180 PNG) | iOS 홈스크린 |
| OG / Twitter card | `frontend/src/app/opengraph-image.png` (1200×630 PNG) | SNS 공유 미리보기 |

#### 8.4.2 16px 전용 변종 (favicon 가독성)

favicon 16×16 은 96px master 의 단순 축소가 아니라 **별도 vector 자산**으로 둔다. 노드는 4개 이하, 라인은 3개 이하로 단순화한다. OS 탭에서 mark 의 형태가 식별 가능해야 한다.

#### 8.4.3 풀로고 구성

풀로고는 항상 **3요소 동반**:

1. Icon mark (좌)
2. Wordmark `clem`**`vi`**`on` (중앙)
3. Sub-copy `AGENTIC WORKFLOW` (wordmark 아래)

Sub-copy 는 풀로고에서 **상시** 부착한다 — 마케팅 페이지·제품 헤더·이메일 서명·OG 이미지 등 풀로고가 노출되는 모든 자리. Sub-copy 없이 wordmark 만 필요한 경우 §8.4.1 의 **Wordmark only** 변종을 별도 사용한다.

풀로고 기본 viewBox: `260 × 80` (icon mark 64×64 + 좌측 여백 16 + wordmark+sub-copy 영역).

#### 8.4.4 워드마크 사용 규정 (현행 §8.3 전면 대체)

워드마크는 **2-tone** 처리를 정식 허용한다. 옛 §8.3 *"단색 또는 단색 반전만 허용"* 조항은 본 항으로 무효화된다 (R-3 참조).

- **Base** — weight 200
  - 라이트 배경: `ink` (`#0e1a12`)
  - 다크 배경: `text-on-dark` (`#e8f5ec`)
- **Accent** (`vi` 두 글자) — weight 600
  - 라이트 배경: `vine-700` (`#1e7a42`)
  - 다크 배경: `vine-dark-accent` (`#6edc8e`)

**예외**: 흑백 인쇄·1bit 출력 등 컬러 표현이 불가능한 매체에서는 accent 도 base 와 동일 색으로 합쳐 단색 처리한다. 가능한 한 2-tone 을 유지하는 것이 원칙이다.

여전히 금지: 그라데이션 배경, 외곽선, 그림자, 회전, 왜곡, 임의 색상 치환. 로고가 노출되는 배경에도 그라데이션을 사용하지 않는다.

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
| 사이드바 상단 (`spec/2-navigation/_layout.md` §2.1) | expanded → Full logo (light) / collapsed → Icon mark | 클릭 시 `/dashboard` |
| 인증 화면 (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`) | Full logo (light) | 카드 컨테이너 위 중앙 배치. 배경은 `soil-50` 단색 (그라데이션 금지, §8.4.4) |
| 브라우저 탭 | Favicon multi | 라이트/다크 자동 전환은 브라우저 표준 동작에 위임 |
| iOS 홈스크린 | Apple touch icon | 180×180 PNG |
| SNS / 외부 공유 | OG image | `/` 와 `/dashboard` 메타데이터 |

다크 모드 적용 시 위 자리들도 dark 변종으로 자동 전환된다 (구현은 `developer` 가 prefers-color-scheme 또는 theme provider 로 처리).

본 항이 명시하는 사이드바 expanded/collapsed 변종 규칙은 본 Stage 1 안에서 `spec/2-navigation/_layout.md` §2.1 로고 행에도 동시 반영된다 (Drop-in 대체 범위 참조).

### 8.5 어조와 스타일 (현행 §8.4 와 동일 — 위치만 이동)

- 한국어를 1차 언어로 한다. 영어 표기는 제품명·고유명사에 한정한다.
- 의인화·유사 자연 비유(자라다, 뻗다, 엮다, 흐름)를 핵심 마케팅 카피에 사용한다.
- 기능 설명에서는 과장·감탄사 없이 짧고 단정한 문장을 쓴다.

### 8.6 임시 자산 마이그레이션

(근거: R-1, R-7)

이전 임시 자산 (덩굴 + 잎 곡선 모티프) 은 본 §8 발효와 함께 폐기 대상이다:

폐기 (옛 자산):

- `frontend/public/logo.svg` (옛 덩굴 곡선)
- `frontend/public/logo-mark.svg` (옛 심볼)
- `frontend/src/app/icon.svg` (옛 32px favicon)
- `frontend/src/app/favicon.ico` (옛 단일 사이즈)

신규 (§8.4.1 정식 자산 — 9종 전체):

- `frontend/public/logo.svg` *(교체)* — Full logo (light)
- `frontend/public/logo-dark.svg` *(추가)* — Full logo (dark)
- `frontend/public/logo-mark.svg` *(교체)* — Icon mark (light, 96px master)
- `frontend/public/logo-mark-dark.svg` *(추가)* — Icon mark (dark)
- `frontend/public/logo-wordmark.svg` *(추가)* — Wordmark only
- `frontend/src/app/favicon.ico` *(교체)* — multi-size 합성 (16/32/48)
- `frontend/src/app/icon.svg` *(교체)* — Next.js metadata icon
- `frontend/src/app/apple-icon.png` *(추가)* — Apple touch icon 180×180
- `frontend/src/app/opengraph-image.png` *(추가)* — OG image 1200×630

마이그레이션 작업은 `plan/in-progress/brand-refresh-impl.md` (Stage 2) 에서 `developer` skill 이 수행한다. 그 동안의 일시 불일치는 §8.2.6 에서 허용 명시.

---

## 9. 변경 이력 (행 추가)

| 일자 | 항목 | 비고 |
| --- | --- | --- |
| 2026-05-05 | 최초 작성 | 제품명을 Idea Workflow → Clemvion으로 전환하며 브랜드 가이드 신설 |
| **2026-05-15** | **§8 정식 개정** | 옛 *Visual Identity (초안)* §8.1–§8.4 전면 폐기. Node-graph 모티프 정식 채택, Vine ramp 7단계 + Neutral + Dark 토큰 동시 도입, 워드마크 2-tone 허용, `AGENTIC WORKFLOW` 서브카피 상시 부착, 자산 9종 정식화. 옛 6개 토큰(Vine Green/Deep Forest/Bud Lime/Bark/Soil/Ink) 폐기·재정의. 사이드 효과로 `spec/2-navigation/_layout.md` §2.1, `spec/2-navigation/10-auth-flow.md` §1 동기화 |

---

## Rationale (신규 섹션 — `## 9` 직후 추가, 파일 최종 섹션)

### R-1. 덩굴 곡선 → 노드 그래프 모티프 전환

**결정**: 옛 임시 자산의 "덩굴이 위로 자라는 곡선 + 잎" 모티프를 폐기하고, "노드 그래프 형태로 자라난 잎" 모티프로 정식화.

**근거**:
- 제품 정체성(§3, §4)이 *Agent-Native Nodes* 와 *Living Workflow* 인데, 곡선 모티프는 이 정체성을 전달하지 못했다 — 일반적인 식물·자연 브랜드와 차별이 약하다.
- 노드 그래프 모티프는 워크플로우 빌더의 캔버스를 그대로 축약한 형태로, 사용자가 *제품의 본질을 그대로 본다*.
- Brand Story (§2) 의 "*보이지 않는 구조를 따라 유연하게 뻗어 나가며*" 는 곡선보다 노드+분기 구조에서 더 직접적으로 전달된다.

**기각된 대안**:
- 단순 wordmark only (mark 없음) — favicon·앱 아이콘 자리에서 식별성이 떨어짐.
- 추상 기호 (단일 도형) — 제품의 워크플로우 정체성과의 연결이 약함.

### R-2. 4-step → 7-step Vine ramp 도입

**결정**: 옛 3색 (Vine Green / Bud Lime / Deep Forest) 체계 → 7단계 Vine ramp (`vine-300 ~ vine-900`) 로 확장.

**근거**:
- 노드 그래프 mark 자체가 깊이별 다른 톤을 요구한다 (루트 노드 = 가장 짙음, 외곽 분기 = 가장 옅음). 컨셉 HTML 의 light 모드 mark 가 이미 4톤을 사용하고 있어, 토큰화 없이는 일관성 관리가 불가능하다.
- 7단계 ramp 는 success state · hover state · disabled state · 차트 시리즈 컬러까지 단일 brand 안에서 처리 가능하게 한다 (별도 Bud Lime 없이도).
- 코드 매핑 시 `vine-300 ~ vine-900` 의 한 자릿수 차이로 의도를 명확히 표현 가능 (Tailwind 컨벤션과 정합).

**기각된 대안**:
- 옛 3색 유지 + Bud Lime 강화 — 토큰 부족으로 mark 내부 톤 표현 불가, 다크 모드 매핑 모호.

### R-3. 워드마크 2-tone 시그니처 채택 (단색 규정 폐기)

**결정**: 워드마크 `clem**vi**on` 의 `vi` 두 글자를 별도 weight + 색(vine-700) 으로 강조하는 2-tone 처리를 정식 시그니처로 채택.

**기각된 규정 원출처**: `spec/6-brand.md` (현행) §8.3 *"단색 또는 단색 반전만 허용"* — 임시 가이드 시절 조항으로, 본 개정에서 무효화.

**근거**:
- `vi` 강조는 "**vi**ne" 어원을 시각적으로 환기하면서, 동시에 *agentic* (AI / vision / vital) 의 머리글자처럼 읽힐 여지를 만든다 — 단일 워드마크가 두 의미를 동시에 전달.
- 옛 단색 규정은 임시 가이드의 안전책이었고, 정식 가이드에서는 시그니처 강도가 더 중요하다.
- 흑백·1bit 출력 같은 컬러 표현 불가 매체는 §8.4.4 의 예외 절로 처리.

**기각된 대안**:
- 워드마크 전체 단색 유지 — 시그니처 약함, 다른 SaaS wordmark 와의 차별성 부족.
- `clem` 강조 — 어원과 무관해 의미 전달 실패.

### R-4. 다크 모드 토큰 동시 도입

**결정**: 본 개정에서 light/dark 페어를 동시 정식화 (별도 plan 으로 분리하지 않음).

**근거**:
- 컨셉 HTML 이 light/dark 페어를 모두 제시했고, 라이트만 먼저 도입할 경우 다크 자산을 ad-hoc 으로 만드는 시기가 생긴다 (브랜드 일관성 위협).
- 다크 모드는 워크플로우 에디터·코드 편집 화면에서 자주 요구되는 모드라, 정식 가이드 시점에 함께 정의해 두는 비용이 가장 낮다.
- 토큰 페어(`vine-700` ↔ `vine-dark-accent` 등) 로 명시함으로써, 향후 자동 매핑(prefers-color-scheme, theme provider) 도입이 단순해진다.

**기각된 대안**:
- 다크 모드를 후속 plan 으로 분리 — 자산이 2회 점프해야 하고, 폐기 토큰 행렬이 두 번 갱신되어 변경 이력이 더 복잡해짐.

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
- 컨셉 HTML 의 16px 카드를 검토한 결과, 96px 의 모든 노드·라인을 그대로 축소하면 OS 탭에서 흙뭉치로 보일 위험이 명백하다 (anti-alias 한계).
- 노드 ≤ 4 / 라인 ≤ 3 으로 단순화한 별도 vector 를 두면, 어느 사이즈에서도 mark 의 식별성이 보장된다.

### R-7. 자산 9종 정식화 + 폐기 토큰 매트릭스 명시

**결정**: §8.4.1 에 9개 자산 경로를 정식 명시, §8.2.5 에 폐기 토큰 ↔ 대체 토큰 1:1 매핑 명시.

**근거**:
- Stage 2 (developer) 가 spec 만 보고 어떤 파일을 어디에 배치하고, 옛 토큰을 무엇으로 교체할지 결정할 수 있어야 한다. 모호한 가이드는 구현 시점에 즉흥 결정으로 이어진다.
- 폐기 매트릭스는 grep 가능한 형태로 두어, 향후 정합성 검토 시 자동 검출 가능하게 함.

### R-8. 토큰 네이밍에서 일반 단어 회피

**결정**: Neutral 토큰의 보더를 `border` 가 아닌 `vine-border` 로, 다크 모드 텍스트를 `text-dark` 가 아닌 `text-on-dark` 로 명명.

**근거**:
- 코드 베이스의 Tailwind / Shadcn 컨벤션이 `--border` CSS 변수 및 `text-{shade}` 유틸리티 / `dark:` variant 를 광범위하게 사용 중. 동일 이름의 spec 토큰을 두면 구현자가 "재정의" 인지 "별도 토큰" 인지 매번 판단해야 한다.
- Brand 토큰임을 prefix(`vine-`) 또는 의미(`on-dark`) 로 분명히 함으로써 grep 시 의도 식별이 용이.
- `vine-border` 가 CSS 변수 `--border` 에 매핑되더라도, 그 매핑은 §8.2.4 에서 명시적으로 선언된다.

### R-9. 브랜드 spec 의 라우트 spec 대비 우선권

**결정**: §8.4.6 (로고 노출 자리) 가 개별 라우트 spec (`spec/2-navigation/_layout.md`, `spec/2-navigation/10-auth-flow.md` 등) 의 로고 기술보다 우선한다.

**근거**:
- 브랜드 자산의 변종·색은 단일 진실(single source of truth) 원칙상 한 곳에서만 정의되어야 한다. 라우트 spec 에 색·변종을 박으면 brand spec 개정 시 N 군데를 동기화해야 한다.
- 라우트 spec 은 "로고가 어디에 노출되는가" (자리) 만 정의하고, 변종·색은 brand spec 을 참조하도록 책임 분리.
- 본 §8.4.6 자체에 자리 매핑이 명시되어 있으므로, 라우트 spec 간 충돌 시 §8.4.6 이 결정권자.

### R-10. 시각 토큰과 코드 토큰의 분리 (구현 위임)

**결정**: §8.2 는 시각 토큰(이름 + HEX) 만 정의하고, CSS 변수 명·Tailwind theme key 는 `developer` 의 Stage 2 가 결정한다.

**근거**:
- spec 의 책임은 *디자인 의도* 의 표현이고, 구현 토큰 이름은 *기존 코드베이스의 컨벤션* (Shadcn `--primary`, `--background` 등) 과 정합해야 한다. 두 책임을 분리하지 않으면 spec 개정 때마다 코드 검토가 강제된다.
- §8.2.4 에 권장 매핑 방향을 힌트로 제공함으로써 구현 즉흥화 방지.
- 코드 토큰 이름 변경 시 spec 을 건드리지 않고도 가능 (개발자 권한 안에서 처리).

### R-11. 워드마크 폰트 스택에 system 명시

**결정**: 워드마크 svg 가 fontFamily 에 `Helvetica Neue, Helvetica, Arial, sans-serif` 시스템 스택을 명시. (Geist 사용 안 함)

**근거**:
- svg 는 정적 자산으로 모든 환경에 그대로 임베드되며, 사용자 환경에 Geist 가 설치되어 있지 않을 가능성이 있다. weight 200/600 의 정확한 표현이 깨지면 워드마크 시그니처가 무너진다.
- 시스템 sans-serif 는 모든 OS 에 weight 200/600 fallback 이 보장된다.
- 본문·UI 폰트는 여전히 Geist Sans 를 쓴다 (next/font/google 로 안전하게 로드되는 환경 안).

### R-12. 출처

- 컨셉 자산: `temp/clemvion_logo_concepts.html` (gitignored, 사용자 보관)
- 사전 일관성 검토 세션: `review/consistency/2026/05/15/18_25_10/` (1차) + 후속 재검토 세션 (Critical 0 건 확인 후 inline 으로 갱신)
- 사용자 결정 (2026-05-15 대화): ramp 정식 도입, vi 강조 보존, sub-copy 상시 부착, 다크 모드 동시 도입

---

## Stage 1 동기화 대상 (본 Stage 안에서 함께 적용)

본 §8 개정과 같은 turn 에 다음 두 spec 도 갱신한다 (project-planner 권한 안).

### S1-A. `spec/2-navigation/_layout.md` §2.1 — 로고 행 갱신

현행:

```
| 로고 | 상단 | 제품 로고. 클릭 시 대시보드(홈, `/dashboard`)로 이동 |
```

신규:

```
| 로고 | 상단 | 제품 로고. 사이드바 expanded 상태에서는 Full logo (light), collapsed 상태에서는 Icon mark 를 표시. 클릭 시 대시보드(홈, `/dashboard`)로 이동. 자세한 변종·색은 [`spec/6-brand.md` §8.4](../6-brand.md#84-로고-시스템) 참조 |
```

### S1-B. `spec/2-navigation/10-auth-flow.md` §1 — 배경·로고 기술 갱신

현행:

```
- 배경: 제품 브랜드 색상 또는 그래디언트
```

신규:

```
- 배경: `soil-50` (`#f7f8f6`) 단색. 그라데이션 금지 (자세한 규정은 [`spec/6-brand.md` §8.4.4](../6-brand.md#844-워드마크-사용-규정) 참조)
- 카드 상단의 `[Logo]` 자리에는 Full logo (light) 변종을 사용 (자세한 변종은 [`spec/6-brand.md` §8.4.1](../6-brand.md#841-변종-매트릭스))
```

---

## Stage 2 인수인계 항목 (developer skill 로 전달)

Stage 2 plan (`plan/in-progress/brand-refresh-impl.md`) 이 처리할 항목:

1. **자산 생성·배치 (9종)** — §8.4.1 의 9개 파일 경로 그대로
   - inline SVG (`temp/clemvion_logo_concepts.html`) → 개별 svg 파일 추출
   - 16px favicon 별도 vector 신규 작성
   - PNG 자산 (`apple-icon.png` 180×180, `opengraph-image.png` 1200×630) 생성
   - multi-size `favicon.ico` 합성
2. **CSS 토큰 매핑** — `frontend/src/app/globals.css` 의 `--primary` 등 HSL 값을 §8.2 의 HEX 로 매핑. light/dark `:root` 페어 정리. §8.2.4 권장 방향 참고.
3. **`<Logo />`·`<LogoMark />` 컴포넌트 신설** — variant(`full` / `mark` / `wordmark`), theme(`light` / `dark` / `auto`), size prop.
4. **UI 자리 통합** — §8.4.6 의 5개 자리 모두 (사이드바·인증 5화면·favicon·apple-icon·OG image).
5. **Next.js `metadata.icons` 명시** — 자동 인식 의존 제거.
6. **회귀 테스트** — Playwright 시각 회귀: 사이드바 collapsed/expanded, 인증 카드, favicon HTML.
7. **README.md 로고 임베드** — 문서 헤더에 full logo (light) svg 임베드.

마무리 검증 (Stage 2 종료 조건):

- §8.2.5 grep 명령 0 건 (옛 토큰명·HEX 잔재 없음)
- e2e 회귀 그린
- spec ↔ 자산 일치 확인 (§8.2.6 일시 불일치 윈도우 종료)

---

## 검토 체크리스트 (consistency-check 2차 점검 대비)

- [x] Drop-in 대체 범위를 도입부에 명시 (§8.1–§8.4 폐기, §8.1–§8.6 신규)
- [x] `_layout.md` §2.1 갱신안 inline (S1-A)
- [x] `10-auth-flow.md` §1 갱신안 inline (S1-B)
- [x] `border` → `vine-border` 리네이밍
- [x] `text-dark` → `text-on-dark` 리네이밍
- [x] `ink-60` / `ink-40` 토큰 신설 (옛 `Bark` 대체 명확화)
- [x] §8.2.4 코드 토큰 매핑 권장 방향 추가
- [x] §8.2.6 일시 불일치 허용 윈도우 명시
- [x] §8.6 신규 자산 목록 완전화 (9종 전체 + *(교체)*/*(추가)* 라벨)
- [x] R-3 기각된 규정 원출처 인용
- [x] R-9 신설 (브랜드 spec 의 라우트 spec 우선권)
- [x] R-10 신설 (시각 토큰 ↔ 코드 토큰 분리 위임)
- [x] R-11 신설 (워드마크 system 폰트 스택 근거)
- [x] R-12 (출처) 에 1차 세션 경로 명시

---

## 다음 액션

1. **본 draft 에 대해 `/consistency-check --spec plan/in-progress/spec-draft-brand-refresh.md` 재호출** (2차) — 1차의 Critical 2건이 모두 drop-in 범위 명시로 자동 해소되었는지 확인.
2. **Critical 0 건 확인 시 한 turn 안에 다음 3개 파일 동시 갱신**:
   - `spec/6-brand.md` — §8 + §9 + ## Rationale 반영
   - `spec/2-navigation/_layout.md` — §2.1 (S1-A)
   - `spec/2-navigation/10-auth-flow.md` — §1 (S1-B)
3. **본 plan 정리와 Stage 2 plan 신설을 원자적 처리**:
   - `plan/in-progress/spec-draft-brand-refresh.md` 의 R-12 에 2차 세션 경로 inline 갱신
   - `plan/in-progress/brand-refresh-impl.md` 신설 (Stage 2 인수인계 항목 그대로 옮김)
   - 본 draft 를 `git mv plan/in-progress/spec-draft-brand-refresh.md plan/complete/`
   - Stage 2 plan 없이 본 draft 만 complete 로 이동 금지
4. **Critical ≥ 1 건 시** 영향 받는 부분 수정 후 재호출.

```

## 정식 규약 모음 (spec/conventions/)

### spec/conventions 정식 규약

#### `spec/conventions/cafe24-api-metadata.md`
```
# CONVENTION: Cafe24 API Metadata

> 관련 문서: [Spec Cafe24 노드](../4-nodes/4-integration/4-cafe24.md) · [Spec 통합 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24) · [Spec MCP Client §2.3 Internal Bridge](../5-system/11-mcp-client.md#23-internal-bridge)

본 컨벤션은 Cafe24 Admin API 의 endpoint 매핑 메타데이터 형식을 정의한다. backend 의 `Cafe24` 노드 핸들러와 `Cafe24McpBridge` 양쪽이 **같은 메타데이터 테이블** 을 소비한다 — 신규 endpoint 추가는 메타데이터 row 1 추가로 끝나야 한다.

---

## 1. 디렉토리 구조

```
backend/src/nodes/integration/cafe24/metadata/
  index.ts             # 18 resource 의 종합 export
  store.ts             # Store (상점)
  product.ts           # Product (상품)
  order.ts             # Order (주문)
  customer.ts          # Customer (회원)
  community.ts         # Community (게시판)
  design.ts
  promotion.ts
  application.ts       # ⚠ Cafe24 앱 관리 API — OAuth 앱 등록(credentials.app_type)과 무관. naming collision 주의
  category.ts
  collection.ts
  supply.ts
  shipping.ts
  salesreport.ts
  personal.ts
  privacy.ts
  mileage.ts
  notification.ts
  translation.ts
```

각 파일은 한 Resource 의 모든 Operation 메타데이터를 export 한다.

## 2. Operation 메타데이터 형식

```ts
interface Cafe24OperationMetadata {
  // 식별
  id: string;                    // 예: 'product_list'. resource 안에서 unique
  label: string;                 // UI 드롭다운 라벨 (한국어) 예: '상품 목록 조회'
  description: string;           // MCP tool description (영문 권장) 또는 다국어 키
  scopeType: 'read' | 'write';   // scope 매핑 — mall.read_<resource> / mall.write_<resource>. Node.category 와의 명명 충돌 회피 위해 'category' 가 아닌 'scopeType' 사용

  // HTTP 매핑
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;                  // path template. 예: 'products/{product_no}'

  // 입력 스키마
  requiredFields: string[];
  fields: {
    [fieldName: string]: {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
      location: 'path' | 'query' | 'body';
      enum?: string[];
      description?: string;
      default?: unknown;
    };
  };

  responseShape?: 'list' | 'single' | 'empty';
  paginated?: boolean;
}
```

## 3. 예시 — `product` Resource 일부

```ts
export const productOperations: Cafe24OperationMetadata[] = [
  {
    id: 'product_list',
    label: '상품 목록 조회',
    description: 'List products in the mall. Supports filtering by category, display status, date range.',
    scopeType: 'read',
    method: 'GET',
    path: 'products',
    requiredFields: ['shop_no'],
    fields: {
      shop_no:     { type: 'number',  location: 'query',  description: 'Multi-shop number (default 1)' },
      category_no: { type: 'number',  location: 'query',  description: 'Filter by category' },
      display:     { type: 'enum',    location: 'query',  enum: ['T', 'F'] },
      since:       { type: 'string',  location: 'query',  description: 'ISO8601 date — created_after' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'product_get',
    label: '상품 단건 조회',
    description: 'Get a single product by product_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}',
    requiredFields: ['product_no'],
    fields: {
      product_no:  { type: 'number',  location: 'path' },
      shop_no:     { type: 'number',  location: 'query' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_update',
    label: '상품 수정',
    description: 'Update a product (name, price, display, stock, etc).',
    scopeType: 'write',
    method: 'PUT',
    path: 'products/{product_no}',
    requiredFields: ['product_no'],
    fields: {
      product_no:    { type: 'number',  location: 'path' },
      product_name:  { type: 'string',  location: 'body' },
      price:         { type: 'string',  location: 'body', description: 'Decimal string (KRW)' },
      display:       { type: 'enum',    location: 'body', enum: ['T', 'F'] },
    },
    responseShape: 'single',
  },
];
```

## 4. 신규 endpoint 추가 절차

1. [Cafe24 공식 문서](https://developers.cafe24.com/docs/ko/api/admin/) 에서 endpoint 의 method / path / 필드 확인.
2. 해당 resource 의 metadata 파일에 §2 형식으로 row 1 추가.
3. `id` 는 `<resource>_<verb>` 형식 (예: `product_list`, `order_update_status`). 중복 금지 (resource 내).
4. `scopeType` 은 read/write 결정 — scope 매핑에 사용.
5. 백엔드 단위 테스트가 자동으로 검증:
   - 모든 `id` 의 unique
   - 모든 `path` 의 `{placeholder}` 가 `fields` 에 정의됐는지
   - `requiredFields` 가 `fields` 의 키 부분집합인지
6. **spec 본문 수정 불요** — `4-cafe24.md` 는 형식만 정의.

## 5. MCP Bridge 와의 매핑

> **레이어 경계**: 본 절의 `Cafe24McpBridge.callTool(name, args)` 와 `listTools()` 가 반환하는 도구 `name` 은 **bare operation id** (예: `product_list`) 다. MCP Client 레이어가 외부 노출 시점에 `mcp_<sid>__` prefix 를 자동 부여한다 ([Spec MCP Client §5.2](../5-system/11-mcp-client.md#52-도구-이름-규칙)). AI Agent config 의 `mcpServers[].enabledTools` 도 bare id 배열로 저장된다.

`Cafe24McpBridge.listTools()` 는 메타데이터 테이블을 순회하여 다음을 생성한다:

```ts
function operationToMcpTool(op: Cafe24OperationMetadata): McpTool {
  return {
    name: op.id,                                 // bare id — 예: 'product_list'
    description: `${op.description}\n\n(Cafe24 ${op.method} ${op.path})`,
    inputSchema: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(op.fields).map(([k, f]) => [k, fieldToJsonSchema(f)])
      ),
      required: op.requiredFields,
    },
  };
}
```

`Cafe24McpBridge.callTool(name, args)` 는 args 를 노드 핸들러의 `fields` 와 동일하게 처리하여 `Cafe24ApiClient` 로 위임 — **노드와 MCP 가 같은 호출 경로를 공유**.

## 6. allowlist 와의 관계

> 용어: **UI grouping 단위 = "카테고리"** (사용자 친화 표기) — 백엔드 메타데이터 파일 구조의 "Resource" 와 동일 범위를 가리키며, 문맥에 따라 혼용한다. spec 본문에서는 UI 맥락이면 "카테고리", 백엔드/Operation 메타데이터 맥락이면 "Resource" 사용. `Node.category` Enum 과는 별개 개념 (이름 충돌은 §2 의 `scopeType` 채택으로 이미 회피).

AI Agent `mcpServers[].enabledTools` 가 비어있으면 모든 operation 이 노출. 사용자가 `['product_list', 'product_get']` 로 좁히면 그 둘만 LLM tool 로 노출 (bare id 비교). UI 는 카테고리 단위 grouping (예: "Product (read 전부)" 체크 → 백엔드는 `['product_list', 'product_get']` 로 저장).

## 7. CHANGELOG

| 일자 | 변경 |
|------|------|
| 2026-05-13 | 신규 컨벤션 — Cafe24 API metadata 의 형식·디렉토리·추가 절차 정의. `scopeType` 필드명 채택 (`Node.category` 와의 명명 충돌 회피) |

```

#### `spec/conventions/migrations.md`
```
# Flyway 마이그레이션 운영 규약

## Overview

본 규약은 PostgreSQL 스키마 마이그레이션을 다음 세 가지 안전성 기준으로 운영하기 위한 정식 규칙이다.

1. **충돌 방지** — 여러 PR 이 병렬로 진행될 때 같은 V번호를 동시에 점유하는 사고를 사전에 차단한다.
2. **순서 보장** — 마이그레이션 적용 순서를 작성 의도와 일치시켜, 의존성 (예: `V<N+1>` 이 `V<N>` 컬럼을 참조) 사고를 막는다.
3. **운영 안전성** — 이미 운영에 적용된 마이그레이션을 수정해 Flyway checksum 불일치로 부팅이 실패하는 일을 막는다.

본문 절차·도구는 모두 위 세 기준을 보장하기 위한 수단이다. 실제 작성 가이드(트랜잭션 모드, NOT VALID 패턴, extension 의존성 등)는 [`backend/migrations/README.md`](../../backend/migrations/README.md) 가 담당하며, 본 문서는 **버전 번호 정책과 머지 race 안전망**에 집중한다.

---

## 1. 명명 규약

```text
backend/migrations/V<번호>__<snake_case_descriptor>.sql
backend/migrations/V<번호>__<snake_case_descriptor>.conf  # 필요한 경우만 (executeInTransaction=false 등)
```

- 번호는 **단조 증가하는 정수**. `V001__initial_schema.sql` 부터 시작해 1씩 증가한다.
- 설명자는 `snake_case`. 영문 소문자 + 숫자 + `_` 만 사용한다.
- `.conf` 페어는 항상 `.sql` 과 동일한 base name (`V<NNN>__<descriptor>`) 을 사용한다. 예: `V033__embedding_hnsw_1024.sql` ↔ `V033__embedding_hnsw_1024.conf`.
- ⚠️ **alphanumeric suffix 금지** — `V035a`, `V035_1` 처럼 정수가 아닌 접미사를 붙이면 Flyway 의 기본 version 파서가 매치에 실패해 schema_history 에 미등록된 채 silent skip 된다. 이 조건은 `backend/src/migrations.spec.ts` 가 빌드/CI 마다 자동 검증한다.

## 2. V번호 정책

- **단조 증가**: 신규 V번호는 항상 현재 main 의 max(V) **+1** 이다.
- **gap 금지**: 작업 도중 V번호를 건너뛰지 않는다. 두 개를 추가하면 `+1`, `+2` 가 되어야 한다.
- **재사용 금지**: 한번 main 에 들어간 V번호는 다른 마이그레이션으로 재할당하지 않는다.

작성 시 절차는 [§5 새 마이그레이션 추가 절차](#5-새-마이그레이션-추가-절차) 를 따른다.

## 3. Append-only 원칙

이미 main 에 들어간 V<N> 의 `.sql` / `.conf` 는 **절대 수정하지 않는다**.

- Flyway 는 부팅 시 각 적용된 마이그레이션의 SQL 내용 checksum 을 `flyway_schema_history` 와 비교한다. 파일이 한 글자라도 바뀌면 `Migration checksum mismatch for migration version NNN` 으로 부팅이 실패한다.
- 컬럼/인덱스/제약 추가·변경·삭제가 필요하면 **새 V<N+k>** 로 `ALTER`·`DROP`·`CREATE` 를 작성한다.
- 운영 사고로 어쩔 수 없이 checksum 을 재정렬해야 한다면 `migrate-repair` 서비스를 사용한다 (절차는 [`backend/migrations/README.md`](../../backend/migrations/README.md) §4 참고).

## 4. `outOfOrder=false` 유지

Flyway 의 `outOfOrder=true` 옵션은 옛 V번호가 늦게 들어와도 실행을 허용한다. 본 repo 는 이 옵션을 **명시적으로 사용하지 않는다** (Flyway 기본값 `false` 유지).

이유:
- `outOfOrder=true` 환경에서 두 PR 이 동시에 V<N+1> 을 만들고 한쪽이 V<N+2> 로 양보한 뒤 늦게 머지되면, **의도된 의존성 순서와 실제 적용 순서가 어긋난다**.
- 본 규약은 PR CI 단계에서 V번호 충돌을 잡아내므로 (`§5`), `outOfOrder` 를 켤 필요가 없다.

## 5. 새 마이그레이션 추가 절차

1. `git fetch origin main && git rebase origin/main` — base 를 최신화한다.
2. `ls backend/migrations | tail -2` 로 현재 max V 를 확인한다.
3. `V<max+1>__<descriptor>.sql` 을 작성한다. 필요하면 동일 base name 의 `.conf` 를 함께 둔다 ([`backend/migrations/README.md`](../../backend/migrations/README.md) §4·§5 참고).
4. 로컬에서 `python3 scripts/check-migration-versions.py --base origin/main` 으로 V번호 가드를 통과시킨다.
5. `make e2e-test` 로 dry-run — e2e 컨테이너의 Flyway 가 실제 마이그레이션을 적용해 본다.
6. PR 을 연다. CI 의 `migration-check` 가 동일한 검사를 다시 돌린다.

> PR open 후에는 가능한 빠르게 리뷰·머지하여 다른 PR 과의 V번호 점유 윈도우를 짧게 유지한다.

## 6. 충돌 검출 / 머지 race

본 repo 는 두 단계 안전망으로 V번호 충돌과 merge race 를 모두 차단한다.

### 6.1 PR CI 가드 (`scripts/check-migration-versions.py`)

`pull_request` 이벤트마다 [`/.github/workflows/migration-check.yml`](../../.github/workflows/migration-check.yml) 이 실행되어 다음을 검사한다.

| 검사 | 위반 예시 | 메시지 |
| --- | --- | --- |
| 중복 | 같은 V<N>__*.sql 두 개 | `FAIL: V041 is duplicated` |
| 단조성 | 신규 V<N> 가 main_max 이하 | `FAIL: V040 is not greater than base (origin/main) max V040` |
| 연속성 | gap 발생 (예: V041 없이 V042) | `FAIL: V042 leaves a gap (expected V041 after base max V040)` |
| `.conf` 페어 | `.conf` 의 base name 이 `.sql` 과 다름 | `FAIL: V041 .conf base name does not match its .sql` |

위반 시 workflow exit 1 로 PR 머지가 막힌다. 작성자가 rebase 해 V번호를 재할당하면 즉시 재검증된다.

로컬에서 동일 검사를 돌리려면:

```bash
python3 scripts/check-migration-versions.py --base origin/main
```

### 6.2 머지 직전 rebase 규약 (운영 규약)

PR CI 가 통과한 직후 다른 PR 이 먼저 머지되어 main 의 max(V) 가 추월되는 **merge race** 가 발생할 수 있다. 본 repo 는 GitHub 무료 플랜의 private 저장소여서 branch protection 의 "Require branches to be up to date before merging" 옵션을 사용할 수 없으므로 (자세한 사유는 [§7 대안 4](#대안-4-github-branch-protection--require-branches-to-be-up-to-date)), race 차단을 다음 운영 규약으로 대체한다.

**머지 직전 확인 (작성자 책임)**

1. `git fetch origin main && git rebase origin/main` 으로 base 를 최신화한다.
2. push 후 `migration-check` 가 PR 의 latest commit 기준 green 인지 확인한다.
3. 본 PR 에 `migration-recheck-on-main` 알림 코멘트가 게시되어 있다면, 무조건 위 1·2 단계를 다시 수행한다.

이 규약은 [`/.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md) 의 Migration checklist 와 짝을 이룬다 — 작성자는 체크박스를 통해 self-confirmation 한다.

### 6.3 사후 안전망 — `migration-recheck-on-main`

`backend/migrations/**` 가 main 에 push 될 때 (= migration PR 이 머지된 직후) [`/.github/workflows/migration-recheck-on-main.yml`](../../.github/workflows/migration-recheck-on-main.yml) 이 두 가지를 자동 수행한다.

- **Post-merge sanity** — `python3 scripts/check-migration-versions.py --base HEAD~1` 를 main 에서 실행. dup / gap / 단조성 / `.conf` 페어 위반이 main 에 실제로 도달했으면 워크플로가 fail 하여 Actions 탭에 빨간불이 켜진다 (Slack/Email 알림이 연동되어 있으면 자동 통지).
- **Auto-nudge** — 열린 PR 중 `backend/migrations/**` 파일이 변경 목록에 포함된 PR 들에 "rebase + CI 재실행 필요" 코멘트를 자동 게시. PR 작성자가 race 가능성을 즉시 인지하고 §6.2 규약을 수행하도록 nudge.

두 작업 모두 머지 자체를 막진 못한다 — 무료 private 환경에서 가능한 최대 강도는 "즉시 가시화 + nudge" 다. 향후 유료 플랜으로 전환 시 [§7 대안 4](#대안-4-github-branch-protection--require-branches-to-be-up-to-date) 의 branch protection 을 §6.2 로 승격하고 본 절은 backup 으로 유지할 수 있다.

## 7. 폐기 대안 (Rationale)

### 대안 1: 타임스탬프 prefix (`V<YYYYMMDDHHMMSS>__...`)

장점은 unique 보장이 자연스럽다는 점이지만, 다음 단점으로 폐기.

- 타임스탬프 순서가 **실제 의도된 실행 순서와 어긋날 수 있다** — 작성자 시계 차이 / merge 순서 / cherry-pick 으로 인해 의존성 깨짐이 발생한다.
- Flyway 의 단조 정수 모델과 자연스럽게 맞물리지 않아 `outOfOrder` 위험을 흡수하게 된다.
- 한 PR 의 마이그레이션을 다른 PR 의 마이그레이션 사이에 끼워 넣을 동기가 발생해 (시계 후순위) append-only 원칙이 흔들린다.

### 대안 2: `flyway.outOfOrder=true`

옛 V번호가 늦게 들어와도 실행한다. PR 충돌 부담은 줄지만:

- **의존성 사고 위험** — V<N+1> 이 V<N> 컬럼을 참조하는 코드를 작성해 두었는데, 운영 환경에는 V<N> 이 더 늦게 들어가는 케이스가 가능해진다.
- 환경별 적용 이력이 비결정적이 되어 디버깅·재현이 어려워진다.

본 규약은 `outOfOrder=false` 를 유지하고 PR CI 가드로 충돌을 사전 차단한다.

### 대안 3: GitHub Merge Queue

자동화 강도는 가장 높지만:

- GitHub plan 의존성 + 셋업 비용이 작지 않다 (private 저장소의 merge queue 는 유료 플랜 한정).
- 본 repo 규모에서는 §6.2/§6.3 의 규약 + 사후 안전망만으로도 race 빈도 대비 비용 대비 효율이 더 낫다.
- 향후 PR 동시성이 늘어 race 가 빈번해지면 재검토 후보로 둔다.

### 대안 4: GitHub branch protection — "Require branches to be up to date"

race 차단의 **정공법**이지만 본 repo 는 GitHub 무료 플랜의 private 저장소여서 다음 제약이 있다.

- Settings → Branches → Branch protection rules 의 일부 옵션 (특히 required status checks / "up to date" 강제) 이 무료 private 에서 비활성화되어 있다.
- `gh api -X PUT repos/<owner>/<repo>/branches/main/protection` CLI 역시 동일한 플랜 제약으로 실패한다.

따라서 현재는 §6.2 (작성자 책임 규약) + §6.3 (`migration-recheck-on-main`) 으로 대체한다. 향후 유료 플랜으로 전환하면 다음 순서로 승격을 검토한다.

1. Settings → Branches → main → "Require branches to be up to date before merging" 활성화.
2. `migration-check / guard` 를 required status check 로 등록.
3. §6.2 의 작성자 책임 규약을 자동화 차단으로 흡수.
4. §6.3 의 `migration-recheck-on-main` 은 backup 으로 유지 — race 가 사후에라도 main 에 도달했을 때 가시화하는 역할은 branch protection 이 대체하지 못한다.

---

## 참고

- 실제 작성 가이드(트랜잭션 모드, NOT VALID 패턴, extension, `.conf` 사용법, repair 절차): [`backend/migrations/README.md`](../../backend/migrations/README.md)
- 시스템 아키텍처 §2.8 (Flyway 운영): [`spec/0-overview.md`](../0-overview.md)
- 가드 스크립트: [`scripts/check-migration-versions.py`](../../scripts/check-migration-versions.py)
- CI workflow: [`.github/workflows/migration-check.yml`](../../.github/workflows/migration-check.yml)

```

#### `spec/conventions/node-output.md`
```
# Output 변수 일관성 규칙 (Conventions)

모든 노드 개선 문서가 참조하는 **공통 규칙집**입니다. 각 노드 개선 문서는 이 Principle들 중 위반 사항을 식별하고 그에 대한 구체적인 수정안을 제시합니다.

> **설계 목표**: "워크플로우 작성자가 `$node["노드 이름"].output.*` 로 값을 꺼낼 때, **노드 종류를 몰라도 어디에 무엇이 있을지 예측 가능**하도록 한다."

---

## Principle 0 — `NodeHandlerOutput`의 5필드는 불변

모든 노드 핸들러는 `{ config, output, meta?, port?, status? }` 형태의 객체를 반환합니다.
- `config`: 해석된 설정값 (자격증명 제거)
- `output`: 후속 노드에 전달되는 **주 데이터**
- `meta`: **실행 메타데이터** (duration, statusCode, tokens, logs)
- `port`: 라우팅 포트 지시 (string | string[])
- `status`: 흐름 제어 상태 (`waiting_for_input`, `resumed`, `ended` 등)

이 5필드의 의미는 **어떤 노드에서든 동일**해야 합니다.

---

## Principle 1 — `output` 은 "비즈니스 결과물"만 담는다

`output` 아래에는 후속 노드가 로직에 사용할 **도메인 데이터**만 둡니다.

| ✅ `output`에 두는 것 | ❌ `output`에 두지 않는 것 |
| --- | --- |
| 응답 본문 / 분류 결과 / 추출된 필드 | 토큰 수 / duration / HTTP status code |
| 렌더링된 프레젠테이션 뷰 | LLM model 이름 / 디버그 로그 |
| 사용자 입력 / 버튼 클릭 인터랙션 | 실행 횟수 / retry count |

→ 실행 메트릭은 **Principle 2** 에 따라 `meta`에 둡니다.

---

## Principle 1.1 — `config` 와 `output` 은 **직교**한다 (중복 금지)

사용자가 UI에서 설정한 **리터럴 값**은 **`config` 에만** 존재하고, 해당 값을 `output` 에 중복 복사하지 않습니다.

### 1.1.1. 규칙

| 값의 성격 | 저장 위치 |
| --- | --- |
| **사용자가 UI/schema 로 설정한 리터럴 값** (title, submitLabel, layout, chartType, format, columns 정의, fields 정의, systemPrompt, maxTurns, categories 정의 등) | `config` **만** |
| **런타임에 계산/변형/집계/평가된 값** (resolved items (dynamic), evaluated rows, aggregated chart data, rendered template string, LLM response, extracted fields, normalized HTTP response) | `output` **만** |
| **사용자 상호작용 데이터** (form submission, button click, user message) | `output.interaction` |
| **실행 메트릭** (duration, tokens, status code, rowCount) | `meta` (Principle 2) |

### 1.1.2. 식별 기준

다음 질문으로 판단:

> "이 값을 알기 위해 노드를 **실제 실행**해야 하는가?"

- 실행 없이 schema/config 만 보면 알 수 있음 → `config`
- 실행이 필요함 (input/외부 API/사용자 입력에 의존) → `output`

### 1.1.3. 적용 예

- `form.config.title = "User Profile"` → `output` 에 **echo 금지**. 후속 노드가 필요하면 `$node["F"].config.title` 사용.
- `carousel.config.layout = "card"` → `output` 에 echo 금지.
- `chart.config.chartType = "bar"` → `output` 에 echo 금지. 반면 `output.data` 는 input을 집계한 런타임 값이므로 OK.
- `template.config.content = "Hello {{ name }}"` → `output` 에 echo 금지. 반면 `output.rendered = "Hello Alice"` 는 expression resolver 가 해석한 런타임 결과이므로 OK. **이 패턴은 Principle 7 (config echo 원칙) 과 정확히 정합한다 — `config` 는 원본 템플릿, `output` 은 평가 결과.**
- `loop.config.count = 10` → `output` 에 echo 금지. 실제로 실행된 횟수는 `meta.iterations` 또는 `output.iterations.length`.

### 1.1.4. 예외 — `output.view` 타입 판별자 패턴은 **사용하지 않는다**

기존 초안에서 제안했던 `output.view.type = 'form' | 'carousel' | ...` 판별자는 **폐기**합니다. 노드 종류는 `$node["X"]` 로 접근하는 시점에 이미 워크플로우 정의상 알 수 있으므로 판별자는 불필요한 중복입니다.

---

## Principle 2 — `meta` 는 "실행 메트릭"만 담는다

| 분류 | 필수/권장 필드 |
| --- | --- |
| **공통** | `meta.durationMs: number` |
| **LLM 계열** | `meta.model`, `meta.inputTokens`, `meta.outputTokens`, `meta.totalTokens`, `meta.thinkingTokens?`, `meta.toolCalls?` |
| **HTTP** | `meta.statusCode`, `meta.durationMs` |
| **DB** | `meta.durationMs`, `meta.rowCount` |
| **Code** | `meta.durationMs`, `meta.success`, `meta.logs?`, `meta.error?`, `meta.errorCode?` |
| **Container** | `meta.iterations?`, `meta.branches?`, `meta.matchedCount?` |

> `ai_agent` 가 현재 사용하는 `output.metadata.*` 는 **폐지**합니다. 모든 토큰/모델 정보는 `meta.*` 로 이동.

---

## Principle 3 — 에러 컨트랙트 통일

### 3.1. 분류

| 종류 | 처리 방식 |
| --- | --- |
| **Pre-flight 에러** (config 오류, credential 누락, SSRF 차단 등) | `throw` → 엔진이 실행 실패로 마킹 |
| **Runtime 에러** (외부 API 실패, 쿼리 실패 등) | `port: 'error'` + `output.error` |
| **예상 가능한 비즈니스 실패** (매칭 없음, 빈 결과 등) | 정상 `port` 유지, 결과가 비어있음을 명시 |

### 3.2. `output.error` 표준 형태

```json
{
  "output": {
    "error": {
      "code": "HTTP_5XX" | "DB_QUERY_FAILED" | "LLM_TIMEOUT" | ...,
      "message": "사람이 읽는 메시지",
      "details": { /* optional, 노드별 */ }
    }
  },
  "port": "error"
}
```

- `code` 는 `UPPER_SNAKE_CASE`.
- `message` 는 국제화 고려 없음 (로그/디버깅용 원문).
- `details` 는 선택적, 노드별 스키마.

### 3.3. 에러 포트 보유 노드

반드시 `error` 포트를 갖는 노드: `http_request`, `database_query`, `send_email`, `cafe24`, `ai_agent`, `information_extractor`, `text_classifier`, `code`, `workflow` (sub-workflow 실패 시).
`transform` 은 pre-flight(config) 검증만 수행 → throw.

---

## Principle 4 — 블로킹/재개 컨트랙트 통일

### 4.1. 상태 전이

```
[실행 시작]
   │
   ├─ 블로킹 노드 도달
   │     ↓
   │  status: "waiting_for_input"
   │  output: { view: {...} }         ← 렌더링용 뷰
   │  (엔진이 실행을 일시 중지)
   │
   ├─ 사용자 입력 수신
   │     ↓
   │  status: "resumed"                ← 통일된 resumed 상태
   │  output: {
   │    view: {...},                   ← 이전 뷰 그대로 유지 (immutable snapshot)
   │    interaction: {
   │      type: "form_submitted" | "button_click" | "message_received",
   │      data: {...},                 ← type별 payload
   │      receivedAt: ISO8601
   │    }
   │  }
   │
   └─ (multi-turn LLM의 경우) 조건 만족 시
         ↓
      status: "ended"
      port: <condition_id> | "user_ended" | "max_turns" | "out"
      output: { result: {...}, ... }   ← 최종 결과
```

### 4.2. 폐기할 필드 / 구조

- `_multiTurnState` → `_resumeState`로 통일. 노출되지 않는 internal 필드임을 문서에 명시.
- 현재 form의 `output.submittedData` → `output.interaction.data` 로 이동.
- 현재 carousel/chart/table/template의 `output.previousOutput` → **제거**. 이전 뷰 정보는 `config` + output의 런타임 필드 조합으로 재구성 가능 (Principle 1.1).
- 초안의 `output.view` 래퍼 → **폐기** (Principle 1.1.4). 런타임 값은 `output` 최상위에 직접 배치.
- 초안의 `output.view.type` 판별자 → **폐기** (Principle 1.1.4). 노드 타입은 워크플로우 정의에서 파악.
- 현재 presentation 노드의 `output.type: 'carousel'|'table'|...` 판별자 → **폐기** (동일 이유).
- 현재 presentation 노드의 `output.rendered` (HTML snapshot) → **프런트 렌더링용** 이라면 유지 가능하나, 후속 노드 로직이 참조할 런타임 값이 아니면 `meta.rendered` 로 이동 검토.

### 4.3. Waiting 상태의 `output` 내용 (노드별)

`output` 에는 **이 실행 시점에 계산된 런타임 값만** 담습니다. 리터럴 config 필드는 echo 금지 (Principle 1.1).

| 노드 | Waiting `output` | 런타임 필드 설명 |
| --- | --- | --- |
| `form` | `{}` (빈 객체) | 폼 렌더링에 계산할 값 없음. fields/title/submitLabel 등은 모두 `config` 참조. |
| `carousel` (static) | `{}` | `items` 가 literal config. 런타임 계산 없음. 후속 노드는 `config.items` 참조. |
| `carousel` (dynamic) | `{ items }` | `source` 표현식 해석 + `titleField`/`descriptionField`/`imageField` 매핑으로 **런타임 생성**된 items 배열. `config.items` 와 독립. |
| `table` (static) | `{ rows }` | 핸들러가 `columns[*].field` 기준으로 row 필터링 → 런타임 정규화됨. |
| `table` (dynamic) | `{ rows, totalRows }` | dataSource 에서 per-row expression 평가 결과. `totalRows` 는 slice 된 페이지 길이. |
| `chart` | `{ data }` | input 을 xAxis 기준으로 **런타임 집계**한 `[{x, y}, ...]`. chartType/title 은 config. |
| `template` | `{ rendered }` | 템플릿 문자열이 engine 의 expression resolver 로 **해석된 결과**. `content` / `format` 은 config. |
| `ai_agent` (multi) | `{ messages }` | 대화 누적. 런타임 상태. |
| `information_extractor` (multi) | `{ messages, partial? }` | 대화 + 부분적으로 수집된 extracted 필드 (있을 경우). |

### 4.4. Resumed 상태의 `output` 내용

Waiting 시점 output 을 **그대로 유지** (immutable snapshot) 하고 `output.interaction` 을 추가:

```json
{
  "output": {
    ...waiting 시점과 동일한 런타임 필드,
    "interaction": {
      "type": "form_submitted" | "button_click" | "button_continue" | "message_received",
      "data": { /* interaction type별 payload, 아래 참조 */ },
      "receivedAt": "2026-04-19T12:34:56.789Z"
    }
  },
  "status": "resumed",
  "port": "<선택된 포트>"
}
```

### 4.5. `interaction.data` payload 규격

| `interaction.type` | `data` shape | 적용 노드 |
| --- | --- | --- |
| `form_submitted` | `{ [fieldName]: value }` (제출된 필드 값) | `form` |
| `button_click` | `{ buttonId, buttonLabel, selectedItem? }` | `carousel`, `table`, `chart`, `template` |
| `button_continue` | `{ buttonId, buttonLabel, url }` | link 타입 버튼의 Continue 포트 (presentation 노드) |
| `message_received` | `{ content, role: "user" }` | `ai_agent`, `information_extractor` multi-turn |

---

## Principle 5 — `port` 활성화 모델

| 형태 | 의미 | 사용 노드 |
| --- | --- | --- |
| `port: undefined` | 기본 단일 출력 (노드 정의상 outputs가 1개) | `transform`, `send_email`, `manual_trigger` |
| `port: string` | 복수 출력 중 하나 선택 | `if_else`, `switch`, `http_request`, `database_query`, `ai_agent` 등 |
| `port: string[]` | 복수 출력 동시 활성화 (fan-out) | `parallel` (handler), `text_classifier` (multi-label) |

**금지**: `port` 를 출력 포트 ID 이외의 값으로 사용 (예: 현재 ai_agent가 `output.port` 를 조건 ID 선택에 사용하는 패턴은 Principle 8과 함께 제거).

---

## Principle 6 — 동적 포트 ID 네이밍

- **글로벌 버튼**: `config.buttons[i].id` 그대로 사용. 사용자가 설정한 ID.
- **Per-item 버튼** (carousel static 모드 등): `${buttonId}__item_${index}` — carousel이 이미 사용 중인 suffix를 공식 규칙으로 승격. 엔진이 `__item_\d+$` 패턴을 분리하여 원본 포트로 라우팅.
- **시스템 포트 예약어**: `out`, `error`, `default`, `done`, `user_ended`, `max_turns`, `completed`, `fallback`, `continue`. 사용자 설정 ID가 이 값과 충돌하면 프런트엔드에서 거부.
- **동적으로 생성되는 포트**: `class_0` / `class_1` (classifier), `branch_0` / `branch_1` (parallel) 처럼 `<prefix>_<index>` 형식.

---

## Principle 7 — `config` echo 원칙 (NodeHandlerOutput.config)

> `NodeHandlerOutput.config` 는 워크플로우 작성자가 설정한 **원본(pre-evaluation) 값** 을 그대로 echo 하는 필드입니다. expression(`{{ ... }}`) 이 포함된 필드는 평가 전 형태를 echo 하고, **평가 결과는 `output.*` 에 둡니다**.
>
> 후속 노드는:
> - `$node["X"].config.<field>` — 노드가 **어떻게 설정됐는가** (원본 템플릿)
> - `$node["X"].output.<field>` — 노드가 **무엇을 실제로 생산/사용했는가** (평가 결과)
>
> 두 영역의 직교성은 Principle 1.1 의 핵심 전제입니다. 핸들러가 `context.rawConfig` 를 echo 함으로써 이 직교성이 유지됩니다 (PRD `ENG-RC-*`, Spec [실행 엔진 §5.5](../../spec/5-system/4-execution-engine.md)).

**항상 echo** (NodeHandlerOutput.config 에 raw 형태로): 사용자가 UI 에서 설정한 **비민감** 값
- `method`, `url` (credential 제거된 raw 형태), `queryType`, `mode`, `model`, `systemPrompt` (raw — `{{ }}` 포함 가능), `userPrompt` (raw), `subject` (raw), `body` (raw), `fields`, `title`, `submitLabel`, `layout`, `items`, `columns`, `chartType`, `conditions`, `categories`, `iterationLimit`, `branchCount`, `maxTurns`, `maxCollectionRetries`, `outputFormat` 등.

**절대 echo 금지**:
- 자격증명 (password, apiKey, token, secret, oauth credentials).
- 코드 본문 (`code.config.code` — 이미 `expression-exclusions`에 등록되어 있음).
- URL 내 임베디드 credential (`https://user:pass@host` → `https://host` 로 sanitize).
- 파일 업로드 원본 바이너리 (reference만).

**선택적 echo** (크기 문제):
- `form.config.fields` 가 매우 클 경우 → 그대로 echo (정의상 구조 정보).
- `ai_agent.config.systemPrompt` 가 수천 줄일 경우에도 그대로 echo (디버깅 목적).

**`config` (raw) ↔ `output` (evaluated) 관계** (Principle 1.1 재확인):
- 모든 raw config 필드는 **`output` 에 복사되지 않습니다**.
- expression 평가 결과는 `output.*` 에 단일 보존 (Principle 8.2 의 카테고리별 네이밍 원칙을 따름).
- expression 미사용 필드 (예: `mode`, `chartType`) 는 raw 와 evaluated 가 동일하므로 본 변경의 영향 없음.

**`context.rawConfig` 의 mutation 보호**:
- 엔진은 `Object.freeze` 적용한 shallow snapshot 을 주입한다 — top-level 필드 mutation 은 strict 모드에서 TypeError 가 발생한다.
- **Shallow 임에 유의** — `rawConfig.headers.foo = '...'` 같은 중첩 객체 변이는 차단되지 않는다. 핸들러는 rawConfig 를 read-only 로 다루어야 하며, 변형이 필요하면 `structuredClone` 으로 복제한다.

### 핸들러 구현 가이드

```ts
// 표준 패턴 — 핸들러는 context.rawConfig 를 echo, evaluated 값으로 동작.
async execute(input, config /* evaluated */, context /* { rawConfig, ... } */) {
  const evaluatedSubject = config.subject as string;          // "Hello Alice"
  const evaluatedBody = config.body as string;
  await sendMail({ subject: evaluatedSubject, body: evaluatedBody, ... });

  return {
    config: {
      // raw 를 echo. 사용자가 expression 으로 작성했다면 "{{ name }}" 을 그대로.
      integrationId: context.rawConfig?.integrationId,
      to: context.rawConfig?.to,
      subject: context.rawConfig?.subject,                    // "Hello {{ name }}"
      body: context.rawConfig?.body,
      bodyType: context.rawConfig?.bodyType,
    },
    output: {
      messageId: info.messageId,
      // evaluated 값. 후속 노드가 실제 발송된 내용을 참조.
      subject: evaluatedSubject,
      body: evaluatedBody,
      bodyType: config.bodyType,
    },
  };
}
```

---

## Principle 8 — 이중/불필요한 중첩 제거

### 8.1. 금지 패턴

- ❌ `output.output.extracted.*` (현재 `information_extractor`)
- ❌ `output.data.*` 를 "본 결과" 의 1차 wrapper로 사용 (현재 `ai_agent` conditional)
- ❌ `output.metadata.tokens` (현재 `ai_agent`) → `meta.tokens` 로 이동

### 8.2. 통일된 1차 네이밍

| 개념 | 권장 위치 |
| --- | --- |
| LLM의 응답 텍스트/객체 | `output.result.response` (ai_agent) |
| 분류된 카테고리 | `output.result.category` (single) / `output.result.categories` (multi) |
| 추출된 필드 | `output.result.extracted` |
| HTTP 응답 본문 | `output.response` (그대로 유지, 이미 관용적) + `output.responseHeaders` |
| HTTP 요청 본문 (evaluated) | `output.requestBody`, `output.requestBodyType` (Principle 7 — config 의 raw 와 직교) |
| DB 쿼리 결과 | `output.rows`, `output.rowCount`, `output.fields`, `output.insertId?` (그대로 유지) |
| 이메일 전송 결과 | `output.messageId`, `output.accepted`, `output.rejected`, `output.subject`, `output.body`, `output.bodyType` (subject·body 는 Principle 7 — config 의 raw 와 직교) |
| 코드 실행 결과 | `output.result` |
| 프레젠테이션 뷰 | `output.view` (Principle 4 참고) |

> 규칙: **LLM 계열 노드 (ai_agent, text_classifier, information_extractor) 는 `output.result` 아래에 도메인 결과를 모은다.** 이 한 문장이면 3개 노드 모두 일관됩니다.

---

## Principle 9 — Container 노드의 `output` 오버라이트 컨트랙트

Container 노드 (

... (truncated due to size limit) ...
