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
