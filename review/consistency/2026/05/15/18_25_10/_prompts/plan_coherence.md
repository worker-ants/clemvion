# Plan 정합성 Check Payload

본 파일은 orchestrator 가 Plan 정합성 checker 용으로 작성한 입력입니다. `plan/in-progress/**` 의 진행 중 작업·미해결 결정과 target 문서가 정합한지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (Plan 정합성)

1. **미해결 결정과의 충돌** — target 이 plan 에서 "결정 필요" 로 남겨둔 항목과 충돌하는 결정을 일방적으로 내리고 있지 않은가
2. **중복 작업** — target 이 이미 다른 plan 에서 진행 중인 작업과 동일한 영역을 손대고 있는가 (병렬 worktree 경합 위험)
3. **선행 plan 미해소** — target 이 가정하는 사전 조건이 plan 에서 아직 해결되지 않았는가
4. **후속 항목 누락** — target 변경이 다른 plan 의 후속 항목을 무효화하거나 새로 만들어야 하는데 반영되지 않았는가
5. **worktree 충돌** — 동일 spec 파일을 target plan 과 다른 worktree 가 동시에 손대고 있는지 (plan frontmatter `worktree` 필드 확인)

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

## 변경 요약

1. **모티프 전환**: 덩굴 + 잎 곡선 → **노드 그래프 (node graph forming a flow tree)**. 제품의 Core Concept (`Living Workflow`, `Agent-Native Nodes`) 을 형상으로 직접 표현.
2. **컬러 정식화**: 컨셉 4-step Green ramp 를 정식 토큰으로 도입 (`vine-300 ~ vine-900` + neutral + dark).
3. **다크 모드 토큰 신설**: 이번 개정에서 light/dark 페어 동시 정식 도입.
4. **워드마크 2-tone 허용**: `clem**vi**on` 의 `vi` 강조 (weight 600 + vine-700) 를 정식 시그니처로 보존. *"단색만 허용"* 규정 개정.
5. **서브카피 상시화**: `AGENTIC WORKFLOW` 서브카피를 풀로고에 상시 부착.
6. **자산 9종 정식화**: full(light/dark), mark(light/dark), wordmark, favicon, app icon, apple-icon, OG image.

원본 컨셉: `temp/clemvion_logo_concepts.html` (gitignored, 사용자 보관).

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
| `soil-50` | `#f7f8f6` | 페이지 배경 |
| `soil-100` | `#eef5ec` | 카드/마크 배경 (라운드된 mark 컨테이너 fill) |
| `border` | `#e4e8e0` | 카드 보더 |

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
| `text-dark` | `#e8f5ec` | 다크 본문 텍스트, 워드마크 base |

#### 8.2.4 코드 토큰 매핑

본 §8.2 는 **시각 토큰의 정의**다. CSS 변수 (`frontend/src/app/globals.css` 의 `--primary`, `--background` 등) 와 Tailwind theme 으로의 매핑은 `developer` skill 의 Stage 2 (`plan/in-progress/brand-refresh-impl.md`) 에서 수행한다. spec 은 HEX 정의를 보유하고, 코드 토큰 이름은 구현 시 결정한다.

#### 8.2.5 폐기된 토큰

이전 §8.1 (임시) 의 다음 토큰은 본 개정 발효와 함께 폐기된다. 코드/문서/디자인 자산에서 발견 시 신 토큰으로 마이그레이션한다.

| 폐기 토큰 | 폐기 HEX | 대체 토큰 |
| --- | --- | --- |
| Vine Green (Primary) | `#1F8A4C` | `vine-700` `#1e7a42` |
| Deep Forest | `#0F3D2A` | `vine-dark-bg-elevated` `#111e14` |
| Bud Lime | `#A8D86F` | `vine-400` `#4ab868` |
| Bark | `#6B5544` | 제거. 텍스트 보조는 `ink` 의 opacity 변종(0.6 / 0.4) 으로 처리 |
| Soil | `#F4F1EC` | `soil-50` `#f7f8f6` |
| Ink | `#111111` | `ink` `#0e1a12` |

### 8.3 타이포그래피

| 용도 | 폰트 | 비고 |
| --- | --- | --- |
| 본문·UI | **Geist Sans** | 기존 `next/font/google` 유지 |
| 코드·모노 | **Geist Mono** | 기존 유지 |
| 워드마크 base | system sans-serif (`Helvetica Neue`, `Helvetica`, `Arial`) | weight **200**, letter-spacing `-0.5px`, font-size 26px (full logo 기준) |
| 워드마크 accent (`vi`) | 동일 폰트 | weight **600**, color = `vine-700` (light) / `vine-dark-accent` (dark) |
| 서브카피 (`AGENTIC WORKFLOW`) | monospace (`Courier New`) | font-size 8px, letter-spacing 3px, uppercase, color = `vine-300` (light) / `vine-dark-primary` (dark) |

워드마크 svg 는 fontFamily 에 시스템 폰트 스택을 명시해 환경 간 렌더 일관성을 확보한다 (Geist 미설치 환경에서도 동일 weight 표현 가능하도록).

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

#### 8.4.4 워드마크 사용 규정

워드마크는 **2-tone** 처리를 정식 허용한다 (이전 *"단색만 허용"* 규정 폐기).

- **Base** — weight 200
  - 라이트 배경: `ink` (`#0e1a12`)
  - 다크 배경: `text-dark` (`#e8f5ec`)
- **Accent** (`vi` 두 글자) — weight 600
  - 라이트 배경: `vine-700` (`#1e7a42`)
  - 다크 배경: `vine-dark-accent` (`#6edc8e`)

**예외**: 흑백 인쇄·1bit 출력 등 컬러 표현이 불가능한 매체에서는 accent 도 base 와 동일 색으로 합쳐 단색 처리한다. 가능한 한 2-tone 을 유지하는 것이 원칙이다.

여전히 금지: 그라데이션, 외곽선, 그림자, 회전, 왜곡, 임의 색상 치환.

#### 8.4.5 여백·최소 크기

| 항목 | 규정 |
| --- | --- |
| Clear space | 워드마크 `clemvion` 의 x-height 만큼. 풀로고의 모든 외곽에 적용 |
| 최소 풀로고 너비 | **160px**. 그 이하에서는 icon-only 또는 wordmark-only 로 전환 |
| 최소 icon mark 변 | **16px**. 그 이하 사용 금지 |
| 풀로고 / wordmark 표시 | 가로 배치 고정. 세로 스택 변종은 본 가이드에서 다루지 않음 |

#### 8.4.6 로고 노출 자리 (제품 사양 차원)

본 §8 은 다음 자리에서의 로고 노출을 정식 사양으로 둔다 (개별 라우트 spec 보다 우선):

| 자리 | 변종 | 비고 |
| --- | --- | --- |
| 사이드바 상단 (`spec/2-navigation/_layout.md` §2.1) | expanded → Full logo (light) / collapsed → Icon mark | 클릭 시 `/dashboard` |
| 인증 화면 (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`) | Full logo (light) | 카드 컨테이너 위 중앙 배치 |
| 브라우저 탭 | Favicon multi | 라이트/다크 자동 전환은 브라우저 표준 동작에 위임 |
| iOS 홈스크린 | Apple touch icon | 180×180 PNG |
| SNS / 외부 공유 | OG image | `/` 와 `/dashboard` 메타데이터 |

다크 모드 적용 시 위 자리들도 dark 변종으로 자동 전환된다 (구현은 `developer` 가 prefers-color-scheme 또는 theme provider 로 처리).

### 8.5 어조와 스타일

- 한국어를 1차 언어로 한다. 영어 표기는 제품명·고유명사에 한정한다.
- 의인화·유사 자연 비유(자라다, 뻗다, 엮다, 흐름)를 핵심 마케팅 카피에 사용한다.
- 기능 설명에서는 과장·감탄사 없이 짧고 단정한 문장을 쓴다.

(§8.4 였던 기존 어조 가이드. 본 개정에서 변경 없음.)

### 8.6 임시 자산 마이그레이션

이전 임시 자산 (덩굴 + 잎 곡선 모티프) 은 본 §8 발효와 함께 폐기 대상이다:

- `frontend/public/logo.svg` (옛) → 신규 자산으로 교체
- `frontend/public/logo-mark.svg` (옛) → 신규 자산으로 교체
- `frontend/src/app/icon.svg` (옛) → 신규 자산으로 교체
- `frontend/src/app/favicon.ico` (옛) → multi-size 합성본으로 교체
- 신규: `logo-dark.svg`, `logo-mark-dark.svg`, `logo-wordmark.svg`, `apple-icon.png`, `opengraph-image.png` 추가

마이그레이션 작업은 `plan/in-progress/brand-refresh-impl.md` (Stage 2) 에서 `developer` skill 이 수행한다. 그 동안 spec 과 실제 자산이 일시적으로 불일치할 수 있다.

---

## 9. 변경 이력 (행 추가)

| 일자 | 항목 | 비고 |
| --- | --- | --- |
| 2026-05-05 | 최초 작성 | 제품명을 Idea Workflow → Clemvion으로 전환하며 브랜드 가이드 신설 |
| **2026-05-15** | **§8 정식 개정** | 옛 *Visual Identity (초안)* 폐기. Node-graph 모티프 정식 채택, Vine ramp 7단계 + Neutral + Dark 토큰 동시 도입, 워드마크 2-tone 허용, `AGENTIC WORKFLOW` 서브카피 상시 부착, 자산 9종 정식화. 옛 6개 토큰(Vine Green/Deep Forest/Bud Lime/Bark/Soil/Ink) 폐기·재정의 |

---

## Rationale (신규 섹션 — `## 9` 직후 추가)

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

**근거**:
- `vi` 강조는 "**vi**ne" 어원을 시각적으로 환기하면서, 동시에 *agentic* (AI / vision / vital) 의 머리글자처럼 읽힐 여지를 만든다 — 단일 워드마크가 두 의미를 동시에 전달.
- 옛 *"단색 또는 단색 반전만 허용"* 규정은 임시 가이드의 안전책이었고, 정식 가이드에서는 시그니처 강도가 더 중요하다.
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

### R-8. 출처

- 컨셉 자산: `temp/clemvion_logo_concepts.html` (gitignored, 사용자 보관)
- 사전 일관성 검토 세션: (consistency-check 호출 후 SUMMARY 경로 inline 으로 갱신)
- 사용자 결정 (2026-05-15 대화): ramp 정식 도입, vi 강조 보존, sub-copy 상시 부착, 다크 모드 동시 도입

---

## Stage 2 인수인계 항목 (developer skill 로 전달)

Stage 2 plan (`plan/in-progress/brand-refresh-impl.md`) 이 처리할 항목:

1. **자산 생성·배치 (9종)** — §8.4.1 의 9개 파일 경로 그대로
   - inline SVG (`temp/clemvion_logo_concepts.html`) → 개별 svg 파일 추출
   - 16px favicon 별도 vector 신규 작성
   - PNG 자산 (`apple-icon.png` 180×180, `opengraph-image.png` 1200×630) 생성
   - multi-size `favicon.ico` 합성
2. **CSS 토큰 매핑** — `frontend/src/app/globals.css` 의 `--primary` 등 HSL 값을 §8.2 의 HEX 로 매핑. light/dark `:root` 페어 정리.
3. **`<Logo />`·`<LogoMark />` 컴포넌트 신설** — variant(`full` / `mark` / `wordmark`), theme(`light` / `dark` / `auto`), size prop.
4. **UI 자리 통합** — §8.4.6 의 5개 자리 모두 (사이드바·인증 5화면·favicon·apple-icon·OG image).
5. **Next.js `metadata.icons` 명시** — 자동 인식 의존 제거.
6. **회귀 테스트** — Playwright 시각 회귀: 사이드바 collapsed/expanded, 인증 카드, favicon HTML.
7. **README.md 로고 임베드** — 문서 헤더에 full logo (light) svg 임베드.

검출 안전망:
- `Vine Green`, `#1F8A4C`, `Bud Lime`, `#A8D86F`, `Deep Forest`, `#0F3D2A`, `Bark`, `#6B5544`, `Soil`, `#F4F1EC` 의 잔여 grep 0 건 확인 → 0 건 미달 시 fail.

---

## 검토 체크리스트 (consistency-check 사전 점검)

- [x] `spec/6-brand.md` §8 의 정식판 본문 작성
- [x] §9 변경 이력 행 추가 명시
- [x] ## Rationale 신규 섹션 (R-1 ~ R-8) 명시
- [x] `spec/2-navigation/_layout.md` §2.1 의 사이드바 로고 슬롯과 정합 확인 (§8.4.6)
- [x] 옛 토큰 ↔ 신 토큰 1:1 매핑 명시 (§8.2.5)
- [x] 다른 spec (`spec/0-overview.md`, `spec/conventions/*`) 에 HEX 박힌 곳 없음 — grep 확인 완료
- [x] 워드마크 2-tone 허용 → "단색만 허용" 규정 폐기 명시 (§8.4.4)
- [x] `AGENTIC WORKFLOW` sub-copy 상시 부착 명시 (§8.4.3)
- [x] 다크 토큰 동시 도입 (§8.2.3)

---

## 다음 액션

1. **본 draft 에 대해 `/consistency-check --spec plan/in-progress/spec-draft-brand-refresh.md` 호출** (의무).
2. Critical 0 건 확인 시 `spec/6-brand.md` 에 본 §8 + §9 행 추가 + ## Rationale 섹션 반영.
3. Critical ≥ 1 건 시 본 draft 의 영향 받는 부분 수정 후 재호출.
4. 반영 후 본 plan 을 `plan/complete/` 로 `git mv` + 신규 `plan/in-progress/brand-refresh-impl.md` (Stage 2) 생성.

```

## 진행 중 plan 문서 모음 (plan/in-progress/)

### plan/in-progress 진행 중 문서

#### `plan/in-progress/0-unimplemented-overview.md`
```
# 미구현 항목 오버뷰 (PRD/Spec 기준)

> 작성일: 2026-05-11
> 출처: `prd/0-overview.md` §6.2~§6.3, 각 PRD/Spec 문서의 ❌·🚧 표기, 코드베이스 spot-check
> 검증 일자 기준: 2026-05-11. 본 문서의 "현재 상태"는 본 시점의 코드/스펙 비교 결과이며, 진행 시점에 다시 확인할 것

본 문서는 `prd/`와 `spec/`을 전수 정독해 식별한 **아직 구현되지 않았거나 부분 구현 상태인 항목**의 인덱스다. 각 항목은 카테고리별 plan 문서로 분리해 추적한다.

---

## 작업 흐름 권장 순서

다음 순서로 plan을 소화하면 의존성 충돌이 적다.

1. **`ai-agent-tool-connection-rewrite.md`** — AI Agent 도구 연결은 의도적으로 제거되어 재설계 대기 중. 사용자 가치 큼, 다른 plan과 독립적.
2. **`parallel-p2.md`** — 중첩 Parallel, `waitAll: false`, `errorPolicy` schema 노출. `logic-node-followups`와 별개로 진행 가능.
2-1. **`merge-p2-async-fanin.md`** (신규) — Merge `timeout` / `partialOnTimeout` P2 활성화. `logic-node-followups` D3 의 fallback 분리 — 엔진 비동기 dispatch 모델 도입 PoC 가 선결 조건.
3. **`background-monitoring-api.md`** — Background 노드는 ✅ 구현됐으나 `meta.backgroundRunId` 모니터링 API는 미구현.
4. **`replay-rerun.md`** — Re-run (재실행) 정책 도입.
5. **`team-workspace-followups.md`** — 공유 워크플로우 표시 + 미가입자 초대 토큰.
6. **`2fa-webauthn.md`** — WebAuthn 2FA.
7. **`accessibility-voiceover-validation.md`** — macOS VoiceOver 수동 검증.
8. **`self-hosting-deployment.md`** — Docker Compose 셀프 호스팅 풀 번들, Helm Chart, 운영·보안 가이드.
9. **`marketplace-and-plugin-sdk.md`** — 마켓플레이스 + 커스텀 노드 SDK (가장 큰 미구현 덩어리).

> 각 plan에는 배경 / 관련 PRD-Spec 참조 / 작업 단위 / 수용 기준이 포함된다. 본 인덱스는 plan 간 우선순위·의존 관계만 정리한다.

### 최근 완료

- ✅ **`prd-spec-sync.md`** (2026-05-11, `plan/complete/prd-spec-sync.md`) — Graph RAG ❌→✅, NF-OB-05 cron ✅, EH-NAV-04 ✅, Background spec 4문서 정합화, 매뉴얼 (knowledge-base.mdx 한·영) 정합화.
- ✅ **`logic-node-followups.md`** (2026-05-11, `plan/complete/logic-node-followups.md`) — D1 If/Else `is_type`/`regex` evaluator 통합 ✅, D2 Loop breakCondition + meta.exitReason ✅, D3 Merge P2 → 별도 plan (`merge-p2-async-fanin.md`) 분리 ✅, D4 Switch `meta.value` alias 제거 + 마이그레이션 ✅, D5 Variable Modification recordValues opt-in + 마스킹 유틸 ✅, D6 보류 ✅, D7 case id reserved word 검증 ✅. spec/4-nodes/1-logic 의 P0/P1 미구현 표기 모두 정리 (Merge dormant 표기는 별도 plan 분리에 따른 의도적 잔존).
- ✅ **`llm-provider-followups.md`** (2026-05-11, `plan/complete/llm-provider-followups.md`) — Azure OpenAI 스트리밍 ✅ / Local LLM (Ollama·vLLM) 검증 ✅. `AzureOpenAIClient`·`LocalClient` 가 `OpenAIClient.stream()` 을 상속하여 자동 지원. spec 2종(7-llm-client.md §8.2, 4-ai-assistant.md §1.2/§11/§13/§15) 🚧·❌→✅, PRD 0 §6.1, 매뉴얼 4종(llm-config.mdx 한·영 + overview.mdx 한·영) 정합화.

---

## 카테고리별 미구현 항목 매핑

### A. 제품 기능 (사용자 가치 큰 기능)

| PRD/Spec 항목 | 상태 | 처리 plan |
|---------------|------|-----------|
| **PRD 1 §3.9 NAV-MP-01~07 Marketplace** | ❌ 전체 미구현 (i18n 사전에만 등장) | `marketplace-and-plugin-sdk.md` |
| **PRD 4 §4 MP-CT/CS/PB-***| ❌ 전체 미구현 | `marketplace-and-plugin-sdk.md` |
| **PRD 3 §10 ND-EX-01~03 노드 확장성 SDK** | ❌ 우선순위 3 | `marketplace-and-plugin-sdk.md` |
| **PRD 5 NF-EX-04 노드 플러그인 시스템** | ❌ | `marketplace-and-plugin-sdk.md` |
| **PRD 2 §4 ED-PL-05 마켓 커스텀 노드 팔레트 표시** | (마켓 의존) | `marketplace-and-plugin-sdk.md` |
| **PRD 3 §6.1 ND-AG-06/10/21 AI Agent 도구 연결** | 🚧 의도적 제거, 재작성 예정 | `ai-agent-tool-connection-rewrite.md` |
| **PRD 3 §4.9 ND-PL-03 Parallel 결과 합산 / 중첩 Parallel / waitAll=false** | 🚧 P2 예정 | `parallel-p2.md` |
| **Spec 4-nodes/1-logic/3-loop §1 / §6 breakCondition** | ✅ 활성화 (D2, meta.exitReason 추가) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/1-if-else `is_type` / `regex` 연산자** | ✅ 구현 (D1, evaluator 통합) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/0-common If/Else, Switch `meta.matchedConditions` / `meta.matchedCaseIndex`** | ✅ 핸들러 구현 + spec 정합 (PR-1) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/0-common Variable Decl/Mod meta** | ✅ 핸들러 구현 + recordValues opt-in (D5) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/11-merge `timeout` / `partialOnTimeout`** | 🚧 P2 dormant (엔진 비동기 모델 선결) | `merge-p2-async-fanin.md` |
| **Spec 4-nodes/1-logic/12-background 모니터링 API** | ❌ 미구현 (`meta.backgroundRunId` 키만 발급) | `background-monitoring-api.md` |
| **Spec 5-system/4-execution-engine §6.3 Re-run** | 🚧 미구현 (future PRD) | `replay-rerun.md` |
| **PRD 1 §3.11 NAV-UP-05 미가입자 초대 토큰** | 🚧 후속 (가입 사용자 추가만 ✅) | `team-workspace-followups.md` |
| **PRD 1 §3.1 NAV-WF-07 공유 워크플로우 표시** | 🚧 백엔드만 존재, UI 미노출 | `team-workspace-followups.md` |
| **PRD 5 NF-SC-10 2FA WebAuthn** | 🚧 TOTP만 ✅, WebAuthn 후속 | `2fa-webauthn.md` |

### B. 인프라/배포 (셀프 호스팅)

| PRD 항목 | 상태 | 처리 plan |
|----------|------|-----------|
| **PRD 5 NF-SC-08 셀프 호스팅 보안 가이드** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-EX-03 단일~클러스터 셀프 호스팅** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-02 Docker Compose 셀프 호스팅 번들** | ❌ (현재 docker-compose.yml은 dev infra만) | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-03 Kubernetes Helm Chart** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-06 셀프 호스팅 설치/운영 문서** | ❌ | `self-hosting-deployment.md` |

### C. LLM Provider 확장 — ✅ 완료 (2026-05-11)

본 카테고리는 `plan/complete/llm-provider-followups.md` 에서 모두 처리됨. 결과:

| Spec 항목 | 처리 결과 |
|-----------|-----------|
| **Spec 3-workflow-editor/4 §11 Azure OpenAI 스트리밍** | 🚧 → ✅ (`AzureOpenAIClient extends OpenAIClient` 상속으로 자동 지원, deployment name + `api-version` 매핑) |
| **Spec 5-system/7 §8.2 LLM Client Local (Ollama/vLLM) 스트리밍** | 🚧 → ✅ (`LocalClient extends OpenAIClient` 로 OpenAI 호환 엔드포인트 자동 지원. Ollama 11434 / vLLM OpenAI-compat 모드 검증 완료) |

### D. 접근성

| PRD 항목 | 상태 | 처리 plan |
|----------|------|-----------|
| **PRD 5 NF-A11Y-03 macOS VoiceOver 수동 검증** | 🚧 자동화 ✅, 수동 체크리스트 사용자 수행 대기 | `accessibility-voiceover-validation.md` |

### E. PRD/Spec ↔ 코드 정합성 정리 (실제로는 구현 끝) — ✅ 완료 (2026-05-11)

본 카테고리는 `plan/complete/prd-spec-sync.md` 에서 모두 처리됨. 결과:

| 항목 | 처리 결과 |
|------|-----------|
| **PRD 9 Graph RAG 전체** | ❌ 로드맵 → ✅ P0~P2 구현 완료 (KB-GR-MD/EX/DM/SR/PA/UI/OB-* 모든 ID 에 상태 컬럼 추가). `prd/9-graph-rag.md` §2.1·§3·§6·§7 + `prd/0-overview.md` §6.1 갱신 |
| **PRD 5 NF-OB-05 알림 cron** | 🚧 → ✅ (5분 BullMQ repeatable + cooldown 명시) |
| **PRD 7 EH-NAV-04 AI Assistant read-only 도구** | ❌ → ✅ (`get_workflow_executions` / `get_execution_details` 가 ED-AI-35~38 모두 충족) |
| **Spec Background 노드 (5문서)** | 5-system/4-execution-engine §3.3, 1-data-model.md, 3-workflow-editor/0-canvas.md (3건), 1-node-common.md, 2-edge.md 모두 "🚧 미구현" 제거 + 평면 구현(ND-BG-05) 으로 통일 |
| **AI Agent Tool Area spec 박스** | 재작성 plan(`ai-agent-tool-connection-rewrite.md`) 와 상호 링크 추가 |
| **사용자 매뉴얼** | `frontend/src/content/docs/06-integrations-and-config/knowledge-base.mdx` 한·영 — Graph 모드 "로드맵" 안내 → 실제 사용법 + 검색 파라미터 + Entity/Relation 관리 가이드로 재작성 |

---

## plan 문서 목록

```
plan/in-progress/
├── 0-unimplemented-overview.md        ← 본 문서 (인덱스)
├── ai-agent-tool-connection-rewrite.md ← AI Agent 일반 도구 연결 재설계
├── merge-p2-async-fanin.md            ← Merge timeout/partialOnTimeout — 엔진 비동기 모델 선결
├── parallel-p2.md                     ← 중첩 Parallel·waitAll=false·errorPolicy 노출
├── background-monitoring-api.md       ← meta.backgroundRunId 모니터링 API
├── replay-rerun.md                    ← Re-run 재실행 기능 도입
├── team-workspace-followups.md        ← 공유 워크플로우 표시 + 미가입자 초대 토큰
├── 2fa-webauthn.md                    ← WebAuthn 2FA 추가
├── accessibility-voiceover-validation.md ← macOS VoiceOver 수동 체크리스트
├── self-hosting-deployment.md         ← Docker Compose 풀 번들·Helm·가이드 문서
└── marketplace-and-plugin-sdk.md      ← 마켓플레이스 전체 + 노드 플러그인 SDK

plan/complete/
├── prd-spec-sync.md                   ← §E "PRD/Spec ↔ 코드 정합성 정리" 완료 (2026-05-11)
├── llm-provider-followups.md          ← §C "LLM Provider 확장" 완료 (2026-05-11)
└── logic-node-followups.md            ← Logic 노드 잔여 P0/P1 (D1·D2·D4·D5·D7) 완료, D3 → merge-p2-async-fanin.md 분리 (2026-05-11)
```

각 plan 문서는 다음 구조를 따른다:

- **배경** — PRD/Spec의 어떤 항목이 미구현인지, 현 코드 상태
- **관련 문서** — PRD·Spec·메모리·기존 plan 링크
- **작업 단위** — 체크박스 todo 목록 (SDD: spec → 테스트 → 구현 순서)
- **수용 기준** — Definition of Done
- **의존성·리스크** — 다른 plan, 외부 시스템 영향

---

## 참고: 이미 완료되어 본 plan에 포함되지 않은 영역

- `plan/complete/feature-roadmap/stages.md` Stage 1~11 (LLM 토큰 추적 / Parallel P1 / Background 평면 구현 / 팀 워크스페이스 UI / RBAC / 2FA TOTP / 조직 Integration 공유 / OTel 트레이싱 / 알림 룰 CRUD / 접근성 자동화 / 매뉴얼 검색)
- `plan/complete/node-architecture/*` (handler colocation, schema audit, sub-workflow execution 등)
- `plan/complete/workflow-assistant/*` (Workflow AI Assistant 본체)
- `plan/complete/ai-knowledge-base/*` (Phase 2 KB + Graph RAG PRD 단계 — 코드 구현은 ✅, PRD 표기 갱신은 본 plan의 `prd-spec-sync.md`에서 처리)

```

#### `plan/in-progress/2fa-webauthn.md`
```
# 2FA WebAuthn 추가

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A
> 선행 plan: `plan/complete/feature-roadmap/06-2fa.md` (TOTP + 복구 코드 ✅)

## 배경

PRD 5 §2 NF-SC-10:

> **NF-SC-10** 2FA(Two-Factor Authentication) 지원 — 권장 — ✅ (TOTP + 복구 코드 10개. WebAuthn은 후속)

TOTP 인증 + 복구 코드는 ✅. WebAuthn (Passkey / 보안 키 등) 은 후속 작업으로 남아 있음.

## 관련 문서

- `prd/5-non-functional.md` §2 NF-SC-10
- `spec/5-system/1-auth.md` (인증 / 2FA 흐름)
- `spec/2-navigation/9-user-profile.md` (보안 설정 화면)
- `plan/complete/feature-roadmap/06-2fa.md` (TOTP 구현 history)
- 코드: `backend/src/modules/auth/two-factor*/`, `frontend/src/app/(main)/profile/security/`

## 작업 단위

### 1. 디자인 결정

- [ ] WebAuthn 라이브러리 선택 — `@simplewebauthn/server` + `@simplewebauthn/browser` 가 표준. 사용자 합의 필요
- [ ] **rpID / origin** — SaaS 도메인 vs. 셀프 호스팅 도메인 모두 지원해야 하므로 환경변수로 분리
- [ ] **사용자 흐름** — TOTP 만 / WebAuthn 만 / 둘 다 등록한 경우의 로그인 시 인증 옵션 우선순위
- [ ] **Passkey 다중 등록** — 사용자당 N개 인증기 등록 허용 (모바일 + 데스크톱 + 보안 키)
- [ ] **복구 코드** — TOTP 와 동일하게 별도 복구 코드 발급 vs. 공통 복구 코드 사용

### 2. 데이터 모델 / 마이그레이션

- [ ] `WebAuthnCredential` 엔티티 — `user_id`, `credential_id` (base64url), `public_key`, `counter`, `transports`, `device_name?`, `last_used_at?`, `created_at`
- [ ] 마이그레이션 추가

### 3. 백엔드 구현 (TDD)

- [ ] 등록 흐름: `POST /api/v1/auth/2fa/webauthn/register/options` → challenge 생성 + 세션 저장 → 클라이언트가 `navigator.credentials.create()` → `POST /api/v1/auth/2fa/webauthn/register/verify` → credential 저장
- [ ] 인증 흐름: 로그인 후 2FA 단계에서 `POST /api/v1/auth/2fa/webauthn/authenticate/options` → 클라이언트 `navigator.credentials.get()` → `POST /api/v1/auth/2fa/webauthn/authenticate/verify` → JWT 발급
- [ ] credential 관리 — 목록 조회 / 이름 수정 / 삭제 API
- [ ] counter 검증 (replay 방어) + 단위 테스트
- [ ] 통합 테스트 (등록 / 인증 / counter mismatch / 복구 코드 fallback)

### 4. 프론트엔드 구현 (TDD)

- [ ] 보안 설정 페이지에 "Passkey / 보안 키" 섹션 추가 — 등록 / 목록 / 이름 변경 / 삭제 UI
- [ ] 로그인 후 2FA 단계 — TOTP / Passkey 선택 UI (사용자가 등록한 인증기에 따라)
- [ ] 브라우저 호환성 안내 (Safari, Chrome, Firefox 의 WebAuthn 지원 차이)
- [ ] i18n (ko/en)
- [ ] 단위 테스트 + e2e (Playwright Virtual Authenticator 활용)

### 5. spec / PRD 갱신

- [ ] `prd/5-non-functional.md` §2 NF-SC-10 상태 — TOTP + WebAuthn 모두 ✅
- [ ] `spec/5-system/1-auth.md` 에 WebAuthn 흐름 추가
- [ ] `spec/2-navigation/9-user-profile.md` 보안 섹션 갱신

### 6. 매뉴얼

- [ ] `frontend/src/content/docs/` 보안 가이드에 Passkey 등록·사용법 추가

### 7. REVIEW

- [ ] `ai-review` 실행 → Security 중심 (counter 검증, replay 방어, rpID 정합성, 복구 코드 fallback)

## 수용 기준

- 사용자가 Passkey/보안 키를 등록·관리·삭제 가능
- 로그인 시 TOTP 또는 Passkey 중 선택해 2FA 통과 가능
- counter 검증·복구 코드 fallback 회귀 잠금
- ai-review Critical/Warning 0

## 의존성·리스크

- **의존**: TOTP 2FA 가 이미 ✅이므로 동일 모듈 확장
- **리스크**:
  - 셀프 호스팅 환경에서 rpID/origin 설정 실수 시 등록·인증 모두 실패 — 환경변수 검증 필수
  - 모바일 Safari 의 Passkey 흐름 차이 — 충분한 e2e/수동 검증 필요

```

#### `plan/in-progress/ai-agent-tool-connection-rewrite.md`
```
# AI Agent 일반 도구 연결 재설계

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A
> 선행 plan: [`plan/complete/ai-agent-tool-connection-rewrite.md`](../complete/ai-agent-tool-connection-rewrite.md) (이전 제거 작업의 사유·복원 절차)

## 배경

PRD 3 §6.1 / PRD 6 §3.2 의 다음 요구사항이 **의도적으로 제거된 상태**다:

- ND-AG-06 — Tool/Function 호출 지원 (다른 노드를 도구로 연결)
- ND-AG-10 — Tool Area를 통한 도구 연결 (캔버스 드래그 앤 드롭)
- ND-AG-21 — 조건과 일반 도구 동시 호출 시 일반 도구 우선 실행

config 스키마에서 `toolNodeIds` / `toolOverrides` 필드와, 캔버스의 AI Agent 우측 점선 Tool Area UX가 모두 제거됐다. 조건 도구(`cond_*`) / KB 도구(`kb_*`) / MCP 도구(`mcp_*`) 는 영향 없고 정상 동작한다.

이 plan은 새 도구 연결 디자인을 결정하고 위 PRD 항목을 다시 활성화하는 작업이다.

## 관련 문서

- 제거 결정 사유 + 복원 절차: `plan/complete/ai-agent-tool-connection-rewrite.md`
- PRD: `prd/3-node-system.md` §6.1 ND-AG-06/10/21, `prd/6-phase2-ai.md` §3.2 동일 ID
- Spec (현재 비활성 박스): `spec/4-nodes/3-ai/1-ai-agent.md` §1 / §Tool Area 박스
- Spec 캔버스 (재작성 예정 박스): `spec/3-workflow-editor/0-canvas.md` §AI Agent Tool Area
- 영향 받지 않는 정상 도구: 조건(`cond_*`), KB (`kb_*`), MCP (`mcp_*`) — `backend/src/nodes/ai/ai-agent/tool-providers/{kb-tool-provider,mcp-tool-provider}.ts`

## 작업 단위

### 1. 디자인 결정 (사용자 합의 필요)

본 단계는 **사용자와의 대화로만** 진행한다. SDD/TDD 시작 전 결정해야 할 항목:

- [ ] **도구 등록 모델** — 다음 세 가지 중 어떤 모델을 채택할지 결정
  - (a) Tool Area 부활 — 캔버스에서 AI Agent 노드 옆 점선 박스로 다른 노드를 드래그해 도구로 등록
  - (b) Tool Area 폐기 → 설정 패널에서 "도구로 사용할 노드 ID 목록"을 select 위젯으로 선택
  - (c) 별도 "AI Tool" 노드 타입 신설 — AI Agent 출력 포트 외에 dedicated tool 포트로 연결, 도구 시그니처(name/description/parameters)를 노드 자체 config에 두어 AI Agent의 config는 `toolNodeIds`만 가짐
- [ ] **도구 시그니처 정의 위치** — 도구 노드 자체 (호출되는 측) vs. AI Agent (호출하는 측). 워크플로 작성자가 도구 사양을 한 곳에서만 관리하도록 결정
- [ ] **도구 호출 시 실행 컨텍스트** — 일반 워크플로 진행과 별개의 sub-execution으로 보낼지, 같은 execution 내 inline으로 처리할지. AI Agent multi-turn 도중 도구 노드가 form/buttons/ai_conversation 같은 블로킹 노드를 포함하면 어떻게 다룰지 결정
- [ ] **도구 결과 라우팅** — 도구 노드의 출력은 LLM 컨텍스트에만 들어가는지, 일반 다운스트림 노드로도 흐르는지
- [ ] **ND-AG-21 우선순위 규칙 재확인** — 일반 도구 우선 실행 → LLM 재평가 → 조건 도구 결정 흐름이 새 설계에서도 유지되는지

> 위 결정 사항은 plan을 진행할 사용자가 답한 후, 이 체크박스를 ✅ 처리하고 결정 내용을 본 plan §결정 기록 절에 추가한다.

### 2. PRD 갱신

- [ ] 결정에 따라 `prd/3-node-system.md` §6.1 ND-AG-06/10/21 본문 업데이트 + "재작성 예정" 표기 제거
- [ ] `prd/6-phase2-ai.md` §3.2 ND-AG-06/10/21 동일 갱신
- [ ] PRD 2 §10.4 ED-AI-19 등 AI Assistant 의 편집 도구 거부 정책에 영향 있는지 확인

### 3. Spec 작성

- [ ] `spec/4-nodes/3-ai/1-ai-agent.md` 의 "재작성 예정" 박스 제거 + 새 도구 연결 모델 명세
  - config 스키마: 새 필드 정의 (`toolNodeIds` 부활인지, 새 모델인지)
  - 도구 이름 규칙: `tool_*` 접두사 부활 또는 변경
  - 도구 description 파생 규칙
  - ToolOverride 구조 (필요 시)
  - 도구 호출 결과의 `output.result.*` 위치
- [ ] `spec/3-workflow-editor/0-canvas.md` Tool Area 시각·인터랙션 재작성 (만약 결정 (a)면)
- [ ] `spec/3-workflow-editor/4-ai-assistant.md` — Workflow AI Assistant가 새 도구 연결 모델을 인식·편집할 수 있는지 정합화 (특히 `add_node` / `update_node` 응답의 dynamic-ports 모델)

### 4. 백엔드 구현 (TDD)

- [ ] `backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` config 스키마에 새 필드 복원 + Zod 검증 + 테스트
- [ ] `backend/src/nodes/ai/ai-agent/tool-providers/` 에 일반 노드 도구 provider 구현 (`node-tool-provider.ts` 등) + 단위 테스트
- [ ] `ai-agent.handler.ts` — 도구 호출 시 sub-execution / inline 호출 (결정 사항 따라) + 부분 실패 격리 + diagnostics 누적
- [ ] 조건 도구와 일반 도구 동시 호출 시 ND-AG-21 우선순위 규칙 적용 (테스트로 회귀 잠금)
- [ ] `TOOL_EXECUTION_FAILED` 에러 코드 복원 (`spec/4-nodes/3-ai/1-ai-agent.md` §6 에 이미 placeholder)

### 5. 프론트엔드 구현 (TDD)

- [ ] AI Agent 설정 패널에 도구 등록 UI (a/b/c 결정 따라)
- [ ] 캔버스 렌더 (a 선택 시 Tool Area 점선 박스 부활, b 선택 시 패널만)
- [ ] 도구 호출 시 LLM 타임라인에 tool-call 카드 표시 (이미 KB·MCP·조건 도구는 표시됨 — 일반 도구도 동일 패턴 재사용)

### 6. Migration / Rollout

- [ ] 기존 워크플로의 AI Agent config가 새 스키마에 그대로 호환되는지 확인. 호환 안 되면 `backend/scripts/` 에 마이그레이션 스크립트 추가 + dry-run / apply 흐름

### 7. 매뉴얼 업데이트

- [ ] `frontend/src/content/docs/02-nodes/ai.mdx` (또는 해당 페이지) — 도구 연결 사용법 추가
- [ ] `frontend/src/content/docs/03-workflow-editor/walkthrough.mdx` — Tool Area / 도구 등록 흐름 walkthrough 갱신

### 8. REVIEW

- [ ] `ai-review` 스킬 실행 (Architecture / Side Effect / API Contract / Concurrency 중심)
- [ ] Critical / Warning 이슈 해소 → `review/<timestamp>/RESOLUTION.md` 작성

## 수용 기준

- ND-AG-06 / ND-AG-10 / ND-AG-21 가 PRD에서 ✅ 표기로 활성화
- 새 도구 연결 모델이 spec에 명시되고 코드에 반영
- 회귀 테스트: 조건 도구·KB 도구·MCP 도구는 동일하게 동작
- ai-review Critical/Warning 0
- Workflow AI Assistant 가 새 모델을 인식해 `add_edge` 의 도구 포트를 안전하게 채울 수 있음

## 의존성·리스크

- **의존**: `prd-spec-sync.md` 의 spec 정리가 끝난 baseline에서 시작하면 깔끔
- **리스크**:
  - 결정 (c) "AI Tool 노드 신설" 시 노드 카탈로그·플러그인 인터페이스 변경 영향이 marketplace plan(`marketplace-and-plugin-sdk.md`) 까지 번질 수 있음
  - multi-turn 도중 도구 호출 → blocking 노드(form/buttons) 진입 시 AI Agent 의 `_resumeState` 관리 복잡도 증가
  - 기존 `tool_*` 접두사를 다시 사용할 경우 LLM 프롬프트 호환성 (이전 conversation history) 검증 필요

## 결정 기록

(사용자 답변 후 채워질 자리)

- 도구 등록 모델: TBD
- 도구 시그니처 위치: TBD
- 도구 호출 실행 컨텍스트: TBD
- 도구 결과 라우팅: TBD
- ND-AG-21 우선순위 유지 여부: TBD

```

#### `plan/in-progress/ai-review-subagent.md`
```
---
worktree: ai-review-subagent-b7c8d9
started: 2026-05-15
owner: developer
---

# AI-Review / Consistency-Check — `claude -p` 제거 + Sub-agent 위임

## Context

요금제 정책 변경으로 `subprocess.run(["claude", "-p", ...])` 와
`anthropic.Anthropic().messages.create(...)` 두 model 호출 경로가 모두 사용
불가가 되었다. 현재 `/ai-review` (`code-review-agents`) 와
`/consistency-check` (`consistency-checker`) 의 model 호출이 모두 `claude -p`
이므로 (`lib/agent_runner.py:34`, `lib/summary.py:46`,
`consistency_orchestrator.py:32`) 파이프라인 전체를 sub-agent 위임으로 전환한다.

남는 유일한 model 호출 경로는 **main Claude (현재 session) 가 `Agent` tool
로 sub-agent 를 invoke** 하는 것. sub-agent 는 별도 conversation 으로 자동
격리된다. 사용량 한도 시 무한 재시도는 `/loop` dynamic mode + `ScheduleWakeup`
으로 구현.

## 새 아키텍처

```
사용자 → /ai-review        → 1회 사이클 (한도 걸린 agent 는 pending 유지)
사용자 → /loop /ai-review  → 무한 재시도 (ScheduleWakeup 으로 self-pace)
    │
    ▼
main Claude
  1. orchestrator --prepare 호출 → 세션 디렉토리 + _prompts/<role>.md +
     _retry_state.json 초기화 (model 호출 없음, file IO 만)
  2. _retry_state.json 의 pending 리스트 Read
  3. 각 pending agent 에 대해 Agent tool 병렬 invoke
     (subagent_type=<role>-reviewer, prompt=경로 인자)
  4. sub-agent return value 파싱 (STATUS=success|rate_limit|network|fatal)
  5. _retry_state.json 갱신
  6. pending 비면 summary sub-agent → SUMMARY.md → 종료
     pending 남으면 /loop 안: ScheduleWakeup(reset_hint or 1800s) → turn 종료
                  /loop 밖: partial SUMMARY 후 종료
```

## Sub-agent 정의 (.claude/agents/)

13 reviewer (`<role>-reviewer.md`):
api_contract, architecture, concurrency, database, dependency,
documentation, maintainability, performance, requirement, scope, security,
side_effect, testing

5 checker (`<checker>-checker.md`):
convention_compliance, cross_spec, naming_collision, plan_coherence,
rationale_continuity

2 summary: `code-review-summary.md`, `consistency-summary.md`

각 정의 frontmatter:
```
---
name: <slug>
description: <한 줄>
tools: Read, Grep, Glob, Bash, Write
model: sonnet
---
```

본문은 기존 prompts 의 내용을 그대로 옮기되, 다음 contract 를 끝에 추가:
- review.md 본문은 호출자가 prompt 에 인자로 준 OUTPUT_PATH 에 Write tool 로
  저장한다.
- 호출자에게 return 하는 값은 한 줄: `STATUS=<...> ISSUES=<n> PATH=<...>
  RESET_HINT=<sec or "">`.
- 사용량 한도/네트워크 오류 메시지를 받으면 `STATUS=rate_limit` 또는
  `STATUS=network` 로 보고하고 임의 우회 금지.

## Python orchestrator 슬림화

`code_review_orchestrator.py` / `consistency_orchestrator.py` 가
남기는 역할:
- diff/context 수집 + prompt-budget 압축 (`168-297` 의 기존 로직 유지)
- prompt 파일을 `review/<timestamp>/_prompts/<role>.md` 로 저장
- `_retry_state.json` 초기화 (pending=전체, success=[], fatal=[], attempts=0)
- 세션 디렉토리 경로를 stdout 으로 반환

제거할 코드:
- `from lib import agent_runner, summary`
- `agent_runner.run_agents_parallel(...)` 호출 (`code_review_orchestrator.py:290`)
- `summary.run_summary(...)` 호출 (`code_review_orchestrator.py:308`)
- 동일 위치의 consistency_orchestrator 호출

`lib/agent_runner.py`, `lib/summary.py` → 삭제. `lib/session.py` 유지.

## 변경 파일

### 신규
- `.claude/agents/<role>-reviewer.md` × 13
- `.claude/agents/<checker>-checker.md` × 5
- `.claude/agents/code-review-summary.md`
- `.claude/agents/consistency-summary.md`

### 수정
- `.claude/skills/code-review-agents/hooks/code_review_orchestrator.py`
- `.claude/skills/consistency-checker/hooks/consistency_orchestrator.py`
- `.claude/skills/code-review-agents/lib/__init__.py`
- `.claude/skills/code-review-agents/SKILL.md`
- `.claude/skills/code-review-agents/README.md`
- `.claude/skills/consistency-checker/SKILL.md`
- `.claude/commands/ai-review.md`
- `.claude/commands/consistency-check.md`
- `.claude/skills/code-review-agents/hooks/hooks.json` (PostToolUse 제거)
- `CLAUDE.md` ("외부 LLM 호출 정책" 절 신설)

### 삭제
- `.claude/skills/code-review-agents/lib/agent_runner.py`
- `.claude/skills/code-review-agents/lib/summary.py`
- `.claude/skills/code-review-agents/prompts/`
- `.claude/skills/consistency-checker/prompts/`

## 환경변수

| 변수 | 기본값 | 의미 |
| --- | --- | --- |
| `RETRY_WAKE_DEFAULT_SEC` | 1800 | reset-hint 없을 때 ScheduleWakeup 대기 |
| `RETRY_WAKE_CAP_SEC` | 3600 | wake delay 상한 |
| `RATE_LIMIT_PATTERNS` | (내장) | sub-agent return value 매칭용 추가 패턴 |
| `NETWORK_PATTERNS` | (내장) | 동일 |

## 단계

- [x] 1. .claude/agents/ 디렉토리 신설 + 20 subagent definition 작성
- [x] 2. code_review_orchestrator.py 축소 (--prepare 모드)
- [x] 3. consistency_orchestrator.py 축소
- [x] 4. lib/agent_runner.py + lib/summary.py 삭제, lib/__init__.py 정리
- [x] 5. prompts/ 디렉토리 삭제 (양 skill)
- [x] 6. SKILL.md / README.md 재작성
- [x] 7. .claude/commands/ 슬래시 정의 갱신
- [x] 8. hooks.json PostToolUse 트리거 제거
- [x] 9. CLAUDE.md 정책 절 신설
- [~] 10. `consistency-check --impl-prep`: spec 변경 없음으로 본 작업에는 적용 안 됨. 대신 `--plan` 으로 smoke test 수행 (orchestrator prepare 까지). 실제 sub-agent 호출은 commit/merge 이후 사용자 환경에서 수동 검증.
- [x] 11. orchestrator smoke test 통과: 두 orchestrator 의 `--prepare` 가 session_dir / _prompts / _retry_state.json 정상 생성. `AI_REVIEW_LOOP=1` 환경변수가 `loop_mode=true` 로 반영됨. subagent_type 매핑 (`side_effect → side-effect-reviewer`, `plan_coherence → plan-coherence-checker`) 정상.
- [ ] 12. 통합 검증 (follow-up — 사용자 환경에서 수동 수행 필요):
    - `/ai-review` 호출 → main Claude 가 13개 Agent tool 병렬 invoke → STATUS 파싱 → SUMMARY.md 생성.
    - `/loop /ai-review` 사용량 한도 시뮬레이션 → ScheduleWakeup 예약 → wake 시 재진입 → pending 만 재호출.
    - `/consistency-check --plan plan/in-progress/ai-review-subagent.md` → 5 checker sub-agent invoke → consistency-summary → BLOCK 결정.
    - 본 worktree 의 `.claude/agents/` 가 main session 에 인식되는 시점 확인 (cwd / merge 시점).
- [x] 13. plan 갱신.
- [x] 14. 단일 커밋 (7a52b93e on `claude/ai-review-subagent-b7c8d9`). PR 은 통합 검증 후 사용자 결정.
- [ ] 15. PR 생성 (통합 검증 완료 후).

## 검증 결과 (smoke)

| 항목 | 결과 |
| --- | --- |
| `python3 -c "from lib import session"` | OK |
| `code_review_orchestrator.py` import | OK (ALL_AGENTS 13개 그대로) |
| `consistency_orchestrator.py` import | OK (ALL_CHECKERS 5개 그대로) |
| `_subagent_type('side_effect')` | `side-effect-reviewer` |
| `_subagent_type('plan_coherence')` | `plan-coherence-checker` |
| `code_review_orchestrator.py --prepare` (전체 diff, 30 파일) | 성공. session_dir/_prompts/security.md + _retry_state.json + meta.json 생성. stdout 마지막 줄에 session_dir 절대경로. |
| `AI_REVIEW_LOOP=1 code_review_orchestrator.py --prepare` | `_retry_state.json` 의 `loop_mode=true`. |
| `consistency_orchestrator.py --plan plan/.../ai-review-subagent.md` | 성공. session_dir/_prompts/plan_coherence.md (header + 모드 + Target 문서 + plan_in_progress) + _retry_state.json (pending=['plan_coherence'], summary=consistency-summary). |

## 통합 검증 follow-up

main session 에서 Agent tool 로 sub-agent 를 invoke 하려면 sub-agent definition 이 main 의 `.claude/agents/` 검색 경로에 등록되어야 한다. 본 작업은 worktree 안에 신설했으므로, **PR merge 후 (또는 cwd 를 worktree 로 옮긴 상태에서)** 실제 호출 검증이 가능하다. 수동 검증 절차는 위 단계 12 참고. 검증 실패 시 plan 을 다시 `in-progress` 로 되돌리고 후속 조치.

## Follow-up — 리뷰 디렉토리 nested 구조 (commit 2)

`review/<timestamp>/` 와 `review/consistency/<timestamp>/` 의 flat 누적이 `ls` 등 파일시스템 조회 시 부담이 커서 nested 형식으로 전환.

- 신규 형식:
  - 코드 리뷰: `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`
  - 일관성 검토: `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`
- 변경된 코드:
  - `lib/session.py:create_session_dir` 가 nested ISO 로 디렉토리 생성. `subdir` 인자는 호환 유지.
  - `code_review_orchestrator.py` 의 `REVIEW_OUTPUT_DIR` 기본값 `./review` → `./review/code`.
  - `consistency_orchestrator.py` 는 prefix 그대로 `./review/consistency` (nested 는 session 모듈이 처리).
- 변경된 문서: `CLAUDE.md` 의 명명 컨벤션 표 + "정보 저장 위치" 표 + Skill 체계 표의 path 표현, `code-review-agents/SKILL.md`, `code-review-agents/README.md` 의 산출물 디렉토리 트리 + `_retry_state.json` 예시, `consistency-checker/SKILL.md`, `.claude/commands/consistency-check.md` 산출물 섹션.
- Smoke test:
  - `REVIEW_OUTPUT_DIR=/tmp/code-nested ... --prepare` → `/tmp/code-nested/2026/05/15/07_47_44/...` ✓
  - `CONSISTENCY_OUTPUT_DIR=/tmp/cons-nested ... --plan ...` → `/tmp/cons-nested/2026/05/15/07_47_46/_prompts/plan_coherence.md` 등 정상 ✓
  - 기본값(환경변수 없음) → `./review/code/2026/05/15/07_47_57/` ✓
- 기존 flat 디렉토리(`review/<ts>/`, `review/consistency/<ts>/`) 의 일괄 이동은 사용자 별도 작업.

## 단계 (이어서)

- [x] 16. `lib/session.py:create_session_dir` 를 nested ISO 로 변경 + docstring 갱신.
- [x] 17. `code_review_orchestrator.py` 기본 `REVIEW_OUTPUT_DIR` 을 `./review/code` 로.
- [x] 18. 문서 path 표현 갱신 (CLAUDE.md / 양 SKILL.md / README.md / commands/consistency-check.md).
- [x] 19. Smoke test (양쪽 orchestrator + 기본값).
- [x] 20. follow-up 단계 본 plan 에 기록.
- [x] 21. follow-up 커밋 + push (commit 241e0ebb).
- [x] 22. summary self-discovery follow-up 커밋 + push (commit 04302603).

## Follow-up — 사용자 테스트 피드백 (commit 5+6)

사용자가 실제 `/ai-review` 호출 시 두 가지 이슈 보고:
1. 이중 경로 — `review/2026-05-15_15-29-14` (옛 flat) 와 `review/code/2026/05/15/15_30_00` (새 nested) 가 동시에 생성됨.
2. 자동 후속 흐름 누락 — 옛 동작 (리뷰 → planner/developer 위임 → 이슈 해결 → e2e) 이 빠짐.

### 이슈 1 — commit 16a80728 (`fix(settings): plugins 등록 제거`)

원인: `.claude/settings.json` 의 `plugins: [".claude/skills/code-review-agents"]` 가 plugin 시스템을 통해 plugin path 의 `hooks.json` 을 PostToolUse 로 자동 등록. 옛 hooks.json (Write/Edit 트리거) 이 옛 orchestrator 를 fork → `session.create_session_dir` 만 옛 flat 형식으로 만들고 본문은 `claude -p` 부재로 실패.

해결: `plugins` 배열 제거. slash command 가 진입점이 된 후로 plugin 자동 등록은 필요 없음. 머지 후 main 의 hooks.json 도 함께 사라지면 옛 path 생성 메커니즘 완전 소멸.

### 이슈 2 — 자동 후속 흐름 (commit 6 in progress)

SKILL.md 에 "단계 8. 자동 후속 흐름" 신설:

- 8.1 분류: spec 관련 / 코드 관련.
- 8.2 spec 관련: `project-planner` 절차 (draft → `/consistency-check --spec` → `BLOCK: NO` 시 spec 반영).
- 8.3 코드 관련: `developer` 절차 (수정 + 단위 테스트 + commit).
- 8.4 모두 처리 후 `make e2e-test` 자동 실행.
- 8.5 실패 시 원인 분석 + 추가 fix (최대 3회).
- 8.6 통과 시 `RESOLUTION.md` 작성.
- 8.7 안전 가드: consistency-check `BLOCK: YES`, e2e 누적 3회 실패, 직전 수정과 무관한 사전 결함, DB 마이그레이션·외부 API 계약 변경, SUMMARY "사용자 결정 필요" 표기 → 자동 중단 + 사용자 보고.

동반 갱신: commands/ai-review.md 의 단계 8 추가, README.md 의 아키텍처 그림에 자동 후속 흐름 추가.

- [x] 23. settings.json plugins 제거 commit (16a80728).
- [x] 24. SKILL.md / commands / README 의 자동 후속 흐름 작성.
- [ ] 25. 자동 후속 흐름 commit + push.

## Follow-up — 지침 통합 보강 (commit 4)

전체 skill·agent 지침 검토 결과 발견된 약점 일괄 보강. 사용자 확인 사항: C3 (role-specific prompt 재작성) 적용, E1·E2 (가독성) 적용, C3 의 단일 공유 제안은 거부 (역할 격리 강화 의도).

- **A1 — `--resume` 모드 도입**: 두 orchestrator (`code_review_orchestrator.py`, `consistency_orchestrator.py`) 에 `--resume <session_dir>` 신설. `_retry_state.json` 존재만 검증 후 그 경로를 stdout 으로 echo. /loop wake 후 동일 세션 재진입 메커니즘이 결정성 있게 동작.
- **A2 — STATUS 미수신 fallback**: SKILL.md 단계 4 에 sub-agent 가 한도/네트워크 오류로 STATUS 라인을 만들지 못한 경우 main 이 응답 본문 키워드 매칭으로 분류하는 규칙 + 패턴 리스트 명시.
- **C3 (재해석) — role-specific prompt body**: `lib/role_instructions.py` 신설 — 13 reviewer + 5 checker 의 `ko_title`·`perspective`·`checklist` 를 single source 로 보관. orchestrator 의 `build_agent_prompt_body(agent_name, ...)` 가 role 마다 다른 본문 (`_prompts/<role>.md`) 을 생성 — system prompt 와 이중 강화로 역할 격리 보장.
- **C1, C2 — /loop 호출 형식 명시**: `AI_REVIEW_LOOP=1` env prefix 의 정확한 명령 라인, ScheduleWakeup prompt 의 `/loop /<slash> --resume <session_dir>` 절대경로 표기.
- **C4 — `_retry_state.json` 갱신 필드 명시**: SKILL.md 단계 5 에 갱신 필드 6개(`agents_*`, `agent_history`, `rate_limit_episodes`, `last_reset_hint_sec`, `wake_history`, `total_wait_sec`) 명시.
- **D1, D2 — output_file 검증 + STATUS 정규식 파싱**: SKILL.md 단계 4 에 보강. sub-agent 본문에도 "Write 실패 시 success 거짓 보고 금지" 추가.
- **B1, B2, B3 — stale path / slash 누락 동기화**: SKILL.md·README.md 의 `REVIEW_OUTPUT_DIR` 기본값 → `./review/code`, project-planner SKILL.md 의 옛 flat path → nested, developer SKILL.md 의 `consistency-checker` → `/consistency-check`.
- **E1, E2 — 가독성**: 18개 sub-agent definition 의 호출 규약·상태 결정 섹션을 통일 패턴으로 일괄 재생성 (`lib.role_instructions` 가 single source). commands 의 step 번호에 0 (사전 점검 — worktree 확인) 추가해 SKILL.md 와 일관.
- Smoke: reviewer 3종 + checker 3종 prompt 가 role-specific 으로 다르게 생성됨, `--resume` valid/invalid 분기 정상.

- [ ] 23. 통합 보강 follow-up 커밋 + push.

## Follow-up — summary sub-agent self-discovery (commit 3)

main 이 매 사이클마다 임시 markdown 을 만들어 summary sub-agent 에 전달하던 단계를 제거. summary sub-agent 가 `session_dir=<...>` 한 인자만 받고 자기 컨텍스트에서 `_retry_state.json` → `subagent_invocations[*].output_file` → `meta.json` 을 직접 Read 해 통합 보고서를 작성하도록 단순화.

- 변경: `.claude/agents/code-review-summary.md`, `.claude/agents/consistency-summary.md` 의 호출 규약 + 수행 절차.
- 동반 갱신: code-review-agents/SKILL.md (단계 6), consistency-checker/SKILL.md (단계 5), commands/ai-review.md, commands/consistency-check.md.
- retry_state 스키마 변경 없음 — `summary_subagent_type` / `summary_output_file` 필드가 summary sub-agent 내부에서 직접 참조된다.
- main 의 절차에서 "임시 `_summary.md` 작성" step 제거 → main 의 turn 길이 1단계 감소, conversation 안에 본문이 들어가지 않아 격리 강화.

- [ ] 22. summary self-discovery follow-up 커밋 + push.

## 검증

1. drift: 20 subagent definition 의 frontmatter 가 Claude Code 가 로드
   가능한 schema 인지 확인.
2. 수동 1: 작은 diff 가 있는 worktree 에서 `/ai-review` → 13 Agent 호출 →
   각 review.md + SUMMARY.md 생성.
3. 수동 2: 한 sub-agent prompt 를 임시로 "강제 STATUS=rate_limit" 로 만들고
   `/loop /ai-review` 진입 → ScheduleWakeup 예약·재진입·재호출 검증.
4. 회귀: hooks.json PostToolUse 제거 후 자동 trigger 가 fire 하지 않는지.

## 비-목표

- `claude -p` 의 동시 실행 성능 보존 (Agent tool 의 병렬성에 위임).
- 13개 sub-agent prompt 내용 자체의 품질 개선.
- /loop 외 자동 재시도 메커니즘 (cron 등 검토 가능하나 본 작업 범위 밖).

```

#### `plan/in-progress/background-monitoring-api.md`
```
# Background 노드 모니터링 API

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A

## 배경

PRD 3 §4.11 Background 노드 본체 (ND-BG-01~05) 는 ✅ 구현 완료. 다만 spec `4-nodes/1-logic/12-background.md` §하단 노트에 다음이 명시:

> 본문 실행 상태를 메인 후속 노드에서 관측하려면 `meta.backgroundRunId` (§5.1) 을 키로 모니터링 API 를 별도 호출해야 한다 (모니터링 API 자체는 미구현).

즉 Background 핸들러는 `meta.backgroundRunId` 를 발급하지만, 그 키로 본문 실행 상태(노드별 진행, 성공/실패, 시작/종료 시각, 알림 송출 결과) 를 조회하는 API 는 없다.

## 관련 문서

- `prd/3-node-system.md` §4.11 ND-BG-01~05
- `spec/4-nodes/1-logic/12-background.md` §5.1 (`meta.backgroundRunId`), §하단 모니터링 API 미구현 노트
- `spec/5-system/4-execution-engine.md` §3.3 Background 실행 (PRD/Spec 정합화는 `prd-spec-sync.md` 에서 별도 처리)
- 코드: `backend/src/modules/execution-engine/` 의 `executeBackgroundSubgraph` / `scheduleBackgroundBody` / BullMQ `background-execution` 큐, NodeExecution 의 `parentNodeExecutionId` 그룹핑

## 작업 단위

### 1. API 설계

- [ ] **엔드포인트** — `GET /api/v1/executions/:executionId/background-runs/:backgroundRunId` (또는 동등) 결정. `executionId` 는 메인 실행 ID, `backgroundRunId` 는 `meta.backgroundRunId` 가 가리키는 ID
- [ ] **응답 스키마** — `{ status, startedAt, completedAt?, nodeExecutions: NodeExecution[], notifications: Notification[] }`. `NodeExecution` 은 기존 execution-history 와 동일 shape 재사용
- [ ] **권한** — 본 실행을 시작한 사용자 + 워크스페이스 멤버 (Editor+) 만 조회 가능. RBAC 가드 적용
- [ ] **WebSocket 이벤트** — Background 본문이 진행 중일 때 실시간 갱신을 받고 싶다면 별도 채널(`background:run:<id>`) 또는 기존 `execution:<id>` 채널 확장 결정

### 2. 백엔드 구현 (TDD)

- [ ] `backend/src/modules/executions/` 에 `BackgroundRunsController` + `BackgroundRunsService` 추가
- [ ] NodeExecution 의 `parentNodeExecutionId` 인덱스로 본문 노드들 조회 + Notification 엔티티에서 background_failed 등 관련 알림 join
- [ ] Swagger 문서화 (프로젝트 `swagger-pattern.md` 메모 참조)
- [ ] 단위 테스트 + 통합 테스트 (실패 본문 / 진행 중 본문 / 완료 본문 / 권한 거부 케이스)
- [ ] `ED-AI-35~38` AI Assistant 의 read-only 도구가 background run 도 조회할 수 있는지 결정 (PRD 2 §10.9 "직계 자식 실행 (sub-workflow 1 level)" 정책의 background 적용 여부)

### 3. 프론트엔드 통합

- [ ] Run Results 드로어의 Background 노드 상세 — 본문 실행 결과 섹션 추가 (현재 Background 노드는 메인 흐름의 노드와 동일 카드만 표시)
- [ ] Execution 상세 페이지에서 Background 본문 실행을 별도 섹션으로 표시 (`spec/5-system/4-execution-engine.md` §3.3 마지막 줄 — "Execution 상세 화면에서 Background 실행 결과를 별도 섹션으로 표시")
- [ ] 단위 테스트 + storybook (옵션)

### 4. spec 갱신

- [ ] `spec/4-nodes/1-logic/12-background.md` §하단 모니터링 API 미구현 노트 → ✅ 갱신, API 시그니처 링크
- [ ] `spec/2-navigation/14-execution-history.md` 또는 `spec/3-workflow-editor/3-execution.md` 에 Background 본문 표시 섹션 추가

### 5. 매뉴얼

- [ ] `frontend/src/content/docs/02-nodes/logic.mdx` 등 Background 노드 안내 페이지에 모니터링 API / Run Results 본문 섹션 사용법 추가

### 6. REVIEW

- [ ] `ai-review` 실행 → API Contract / Side Effect / Security 중심 (권한 거부 회귀 잠금 필수)

## 수용 기준

- 새 모니터링 API 가 인증/인가 검증과 함께 동작
- Run Results 드로어 + Execution 상세에서 Background 본문 실행 결과를 시각적으로 확인 가능
- spec 의 "모니터링 API 자체는 미구현" 노트 제거
- 단위/통합 테스트가 권한·정상·실패·진행중 케이스 회귀 잠금
- ai-review Critical/Warning 0

## 의존성·리스크

- **의존**: `prd-spec-sync.md` 의 Background spec 정합화가 끝난 다음 진행하면 표기 충돌 없음
- **리스크**:
  - 본문이 매우 길어진 경우 응답 페이로드 크기 → 페이지네이션 / streaming 결정 필요
  - WebSocket 채널 확장 시 기존 `execution:<id>` 구독자에게 의도치 않은 이벤트 전파 가능

```

#### `plan/in-progress/cafe24-app-url-3rdparty-shorten.md`
```
---
worktree: cafe24-3rdparty-url-503aa0
started: 2026-05-15
owner: developer
---

# Cafe24 App URL 100자 한도 — `/api/3rd-party/<provider>/` namespace + 토큰 단축

## 배경

Cafe24 Developers 의 **App URL** 입력 필드에 100자 제한이 있는데, 현행 install URL 이 한도 초과로 등록 자체가 불가능했다.

- 현재: `https://<host>/api/integrations/oauth/install/cafe24/<64-hex>` — 호스트 32자 가정 135자.
- 사용자 보고 (2026-05-15): "토큰 없이 등록된 상태였고, 정상 url 을 등록하려고 시도하니까 App URL 에서 허용 길이를 초과했다는 오류가 나와. 수동으로 테스트해보니 100자 제한으로 확인되는데, 우리 도메인이 변동될 수 있으니 90자 정도가 마지노선일것 같아."

## 결정 (사용자 합의)

| 항목 | 결정 |
| --- | --- |
| URL 구조 | `/api/3rd-party/<provider>/...` (provider-grouped) |
| Cafe24 install | `/api/3rd-party/cafe24/install/:token` |
| Callbacks (3종) | `/api/3rd-party/cafe24/callback`, `/api/3rd-party/google/callback`, `/api/3rd-party/github/callback` |
| 토큰 | `randomBytes(16).toString('base64url')` (22자, 128-bit) |
| 검증 정규식 | `/^[A-Za-z0-9_-]{22}$/` |
| 옛 경로 | 즉시 제거 (`/api/integrations/oauth/{install,callback}/...` 핸들러 삭제) |
| 기존 `pending_install` 행 | 마이그레이션 생략 (대부분 등록 자체 실패 상태이고 영향 없음) |

길이 검증 (호스트 32자 가정):

- Install: `https://workflow-api.getit.co.kr/api/3rd-party/cafe24/install/<22>` = **85자** ≤ 90 ✓
- Callback: `.../api/3rd-party/cafe24/callback` = 62자 ✓

호스트가 약 40자까지 확장되어도 90자 마지노선 유지.

## Phase

### Phase 1 — Spec 개정 (project-planner) — **완료 (2026-05-15)**

- [x] `consistency-checker --spec` 사전 호출 — `review/consistency/2026-05-15_02-07-22/` (Critical 0, Warning 7건 모두 draft 에 반영)
- [x] `spec/1-data-model.md`
  - [x] line 253 `install_token` 설명: "32바이트 hex" → "16바이트 base64url (no padding, 22자)"
  - [x] line 645 인덱스 주석의 라우트 경로 갱신 (`/oauth/install/cafe24/:installToken` → `/3rd-party/cafe24/install/:installToken`)
  - [x] Rationale 말미에 "install_token 형식 (32byte hex → 16byte base64url, 2026-05-15)" entry 추가
  - **V047 마이그레이션 entry 추가 안 함** — DB schema 무변경 (`install_token` 컬럼이 `String?`, 길이 제약 없음). spec 의 마이그레이션 표는 schema 변경 시점만 기록하는 컨벤션. application-level format 만 변경되었으므로 Rationale 만으로 충분.
- [x] `spec/2-navigation/4-integration.md`
  - [x] §9.2 표의 install/callback 경로 새 namespace 로 갱신 — callback 은 파라메트릭 단일 형식 `/api/3rd-party/:provider/callback` 사용
  - [x] §10.1 callback 엔드포인트 박스 새 path + social-login 구분 노트 추가
  - [x] Public/Private 본문의 라우트 표기 갱신 (line 136, 158, 177, 183, 186)
  - [x] Rationale 신규 entry "Cafe24 App URL 100자 한도 대응 — `/api/3rd-party/<provider>/` namespace 도입 (2026-05-15)" 추가
  - [x] 기존 Rationale 2 항 갱신: "install_token 을 App URL path 식별 키로 승격" + "CAFE24_INSTALL_INVALID_TOKEN(404) 보안 전제"
- [x] `spec/4-nodes/4-integration/4-cafe24.md`
  - [x] step 3 URL 갱신
  - [x] 본문 내 "2026-05-14 개정" blockquote 제거 (CLAUDE.md "spec 은 latest state 만" 원칙 — Warning #4)
  - [x] §10 CHANGELOG 에 "2026-05-15" 라인 추가 (history 표 → 옛 경로 표기 유지)
- [x] `spec/data-flow/integration.md` mermaid 다이어그램의 path · token 생성 라인 갱신
- **`spec/conventions/` 신규 룰 추가 안 함** — `/api/3rd-party/<provider>/` 는 현재 cafe24·google·github 3 provider 의 OAuth callback + cafe24 install 만 사용. 동일 prefix 의 endpoint 가 4개 이상으로 늘거나 다른 모듈이 재사용을 시작하면 그 시점에 `spec/conventions/routing-namespaces.md` 신규 생성으로 승격. 현시점 단일 진실은 `spec/2-navigation/4-integration.md` Rationale entry.

### Phase 2 — 구현 (developer) — **완료 (2026-05-15)**

- [x] `consistency-checker --impl-prep` 사전 호출 — `review/consistency/2026-05-15_02-20-10/` (Critical 0, Warning 8건 spec 보완·구현·ai-review 단계에서 모두 처리)
- [x] 백엔드
  - [x] 신규 `ThirdPartyOAuthController` (단일 파라메트릭 컨트롤러) — `@Controller('3rd-party')`, `cafe24/install/:installToken` + `:provider/callback`. provider 별 분리 컨트롤러 3개 안은 코드 양 대비 이점 없어 폐기.
  - [x] 토큰 발급: `randomBytes(INSTALL_TOKEN_BYTES).toString('base64url')` (공통 상수 사용)
  - [x] `INSTALL_TOKEN_PATTERN` 정규식: `/^[A-Za-z0-9_-]{22}$/` — `third-party-oauth.constants.ts` 공유 상수
  - [x] `buildCafe24InstallUrl` / `buildOauthCallbackUrl` 헬퍼로 URL 조립 3곳 통합 (DRY)
  - [x] 옛 `@Get('oauth/install/cafe24/:installToken')`, `@Get('oauth/callback/:provider')` 핸들러 삭제
  - [x] swagger `@ApiTags('Third-Party OAuth')` + `@ApiOperation`/`@ApiResponse` 갱신
  - [x] callback 에 throttle 60 req/min 추가
- [x] 프론트엔드
  - [x] i18n `cafe24PrivatePendingSteps` 안내문 갱신 (ko/en) — "전체 복사" 강조, 22자 토큰 명시
  - [x] MDX 사용자 매뉴얼 (cafe24.mdx, cafe24.en.mdx) 의 App URL/Redirect URI 6곳 갱신
- [x] 테스트
  - [x] 단위: 토큰 정규식 (21/22/23/64자 케이스), MISSING_PARAMS (mall_id/timestamp/hmac 각각), 서비스 예외 status 전파 (403/404), unsupported provider 400, FRONTEND_URL/APP_URL fallback, appUrl 정규식 매치
  - [ ] e2e: Cafe24 private 흐름 — 본 PR 범위 외 (followup `cafe24-pending-polish-followup.md` E)
- [ ] **OAuth 콘솔 재등록 (운영 작업 — 배포 직전 ⚠️ 필수)**
  - [ ] **Google Cloud Console**: `https://<host>/api/3rd-party/google/callback` 을 Authorized redirect URIs 에 **추가** (옛 `/api/integrations/oauth/callback/google` 은 롤백 보호를 위해 삭제하지 말고 한동안 병행 유지)
  - [ ] **GitHub OAuth App**: `https://<host>/api/3rd-party/github/callback` 을 Authorization callback URL 에 추가
  - [ ] **Cafe24 Developers (운영 등록자 대상 안내)**: 기존 Private 앱 등록자에게 "앱 URL / Redirect URI 재등록 필요" 안내 발송 (sales/docs 채널). 신규 등록자는 통합 화면에서 새 URL 만 발급받으므로 별도 작업 없음.
  - [ ] **배포 순서 보장**: ① OAuth 콘솔 등록 완료 → ② 백엔드 배포. 순서가 어긋나면 모든 신규 OAuth 가 `redirect_uri_mismatch` 로 실패함.

### Phase 3 — 리뷰 + PR (developer) — **진행 중**

- [x] `/ai-review` 다관점 코드 리뷰 실행 — `review/2026-05-15_02-43-55/` (Critical 1, Warning 17, Info 14)
- [x] `review/<timestamp>/RESOLUTION.md` 작성
- [ ] 본 plan 의 모든 체크박스 완료 확인 → `git mv plan/in-progress/cafe24-app-url-3rdparty-shorten.md plan/complete/` (OAuth 콘솔 재등록은 배포 직전 운영 작업이라 PR 시점에는 미체크로 둔다 — PR description 의 "배포 체크리스트" 에 포함)
- [ ] PR 생성

## 결정 (closed)

- **컨트롤러 구조** — 단일 `ThirdPartyOAuthController(:provider)` 채택. provider 분리 컨트롤러 3개 안은 callback 처리 흐름이 동일해 코드 양 대비 이점 없음.
- **swagger Tags** — `'Third-Party OAuth'` 신규 tag 채택. 기존 `'Integrations'` 와 분리해 user-facing CRUD vs 3rd-party-facing endpoints 의 분류 명확화.
- **Frontend i18n** — markdown 렌더링이 없는 문자열이라 bold(`**...**`) 구문 제거, 평문 강조로 대체.

```

#### `plan/in-progress/cafe24-data-model-strengthen.md`
```
---
worktree: cafe24-data-model-strengthen-464de9
started: 2026-05-15
owner: developer
---

# Cafe24 Pending Install 데이터 모델 강화 (사용자 결정 3 + 4)

## Context

PR #18 의 follow-up 중 그룹 B (데이터 모델·동시성 강화) 의 두 항목을 한 PR 로 진행. 사용자가 명시적으로 (a) `installTokenIssuedAt` 컬럼 신설 / (b) `mall_id` plain 컬럼 분리 + partial UNIQUE 인덱스 두 옵션 모두 채택.

이 plan 은 `cafe24-pending-polish-followup.md` 그룹 B 의 첫 두 항목을 흡수하며, `cafe24-pending-polish.md` 의 변경 3/4 follow-up 체크박스 중 advisory lock / decrypt 비용 / mall_id plain 컬럼 등 관련 항목을 완료 처리한다.

## 변경 사항

### 결정 3 — `installTokenIssuedAt` TTL 기준 분리

- [x] **V044 마이그레이션**: `integration.install_token_issued_at TIMESTAMPTZ NULL` 추가.
- [x] **Entity**: `installTokenIssuedAt: Date | null` 필드. spec 주석에 "credentials.mall_id 의 plain projection" 와 "옛 행은 NULL → 스캐너 COALESCE fallback" 명시.
- [x] **`createPrivatePendingIntegration`**: 신규 / 재사용 모두 `installTokenIssuedAt = new Date()` 로 갱신.
- [x] **`handleCallback` 성공 분기**: `installTokenIssuedAt = null` 로 install_token 과 함께 클리어.
- [x] **TTL 스캐너 (`expirePendingInstalls`)**: WHERE 절을 `COALESCE(install_token_issued_at, created_at) < cutoff` 로 변경. 옛 행 graceful fallback.

### 결정 4 — `mall_id` plain 컬럼 + parti

... (truncated due to size limit) ...
