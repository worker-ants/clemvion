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
경로: `plan/in-progress/spec-draft-brand-rollback.md`

```
---
worktree: brand-refresh-7a3f12
started: 2026-05-15
owner: project-planner
---

# Spec Draft: brand-refresh 의 spec 부분 롤백

본 draft 는 `spec/6-brand.md` §8 정식판(Stage 1, commit `b6267429`) 의 일부를 롤백하기 위한 변경안이다. 사용자 결정(2026-05-15 대화 — *"전체적인 색상이 별로", "스펙도 당연히 롤백해야지"*) 으로 옵션 A (spec 도 함께 롤백) 채택.

코드 측은 commit `df1533ab` 에서 이미 `frontend/src/app/globals.css` 를 main 으로 복원했고, `(auth)/layout.tsx` 도 그라데이션 배경 복원, 사이드바 로고 헤더는 vine-dark-bg-elevated (`#111e14`) 단일 색으로 채우는 형태로 정착(`ecc94a6f`).

본 draft 는 코드 상태에 맞춰 spec 을 **부분** 롤백한다. SVG 자산·로고 시스템·노드 그래프 모티프는 유지 — 코드에 반영되어 있고, 사용자도 "SVG 만 사용" 으로 명시했기 때문.

## Drop-in 대체 범위

본 draft 가 적용하는 대체:

| 위치 | 변경 |
| --- | --- |
| `spec/6-brand.md` 제목 | `# PRD: 브랜드 가이드 — Clemvion` → `# 브랜드 가이드 — Clemvion` (옛 `PRD:` prefix 제거) |
| `spec/6-brand.md §8.2` (전체) | 7단계 Vine ramp + Neutral + Dark + 코드 매핑 + 폐기 매트릭스 + 일시 불일치 윈도우 → **단일 항으로 단순화**. "디자인 토큰 정식화 보류, SVG 자산 안에 박힌 컬러 참고" 만 명시. |
| `spec/6-brand.md §8.3` | 워드마크 폰트 weight 200/600 명세는 유지 (svg 안에 박혀 있음). 단 "color = `vine-700`" 같은 폐기 토큰 명 인용을 HEX 직접 표기 + "SVG 자산 안에 박힌 디자인" 으로 정정. |
| `spec/6-brand.md §8.4.4` | 워드마크 사용 규정 — 옛 *"단색 또는 단색 반전만 허용"* 으로 **복원**하되, "현재 정식 SVG 자산은 `vi` 2-tone 시그니처를 사용하며 본 자산 안에 박혀있다 — 정식 가이드 보류 중인 디자인" 으로 보조 설명. |
| `spec/6-brand.md §8.4.6` | 인증 화면 행의 *"배경은 `soil-50` 단색"* 표현 제거. *"카드 배경은 라우트 spec 의 정의를 따름"* 으로 단순화. |
| `spec/6-brand.md §8.6` | 자산 매트릭스 9종 유지. *"PNG 자산은 SVG 로 임시 사용 중 — raster 도구 준비 후 PNG 분리는 follow-up"* 추가. |
| `spec/6-brand.md §9` | 2026-05-15 **두 번째** 행 추가 — *"롤백: §8.2 컬러 토큰 정식화 / §8.4.4 2-tone 허용 / §8.2.6 일시 불일치 윈도우 폐기. SVG 자산과 §8.1 모티프·§8.4 로고 시스템·§8.5 어조·§8.6 자산 목록은 유지."* |
| `spec/6-brand.md ## Rationale` | R-1, R-5, R-6, R-7, R-9, R-11 유지. **R-2, R-3, R-4, R-8, R-10 폐기**. R-12 출처 갱신 (rollback 세션 추가). R-13 신설 — *"부분 롤백 결정의 근거"*. |
| `spec/2-navigation/_layout.md` §2.1 | variant 명시는 유지하되 색 토큰 표현 정정 (light/dark variant 라는 자산명만 인용, 옛 색 토큰 인용 제거). Rationale 추가 행. |
| `spec/2-navigation/10-auth-flow.md` §1 | 배경을 main 의 *"제품 브랜드 색상 또는 그래디언트"* 로 복원. `[Logo]` 자리는 그대로 — 변종은 brand spec 참조 유지. Rationale 갱신. |

§8 외 (§1–§7) 와 §8.1 (디자인 모티프), §8.4 (로고 시스템, 단 §8.4.4 단순화), §8.5 (어조) 는 그대로 유지.

---

## 신 §8 본문 (drop-in)

### 8.1 디자인 모티프 (유지 — 변경 없음)

> 현행 §8.1 본문 그대로. 노드 그래프 모티프는 SVG 자산에 박혀있으므로 spec 유지.

### 8.2 컬러 (보류)

본 §8.2 는 정식 비주얼 가이드 도입 시 채워진다. 현 시점에서는 다음 두 가지만 정의한다:

1. **자산 안에 박힌 컬러**: 정식 로고/파비콘 SVG (`§8.4.1`) 는 자체 fill 로 다음 vine-green 계열을 사용한다 — `#1a4f2c` / `#1e7a42` / `#2a7040` / `#2a8a48` / `#3a9a58` / `#4ab868` / `#5ab872` (라이트 변종), `#111e14` 컨테이너 + `#3aae58` / `#4fce72` / `#6edc8e` / `#7de890` / `#9efab2` (다크 변종). 이 값들은 SVG 안에 박혀있고, **앱 테마 토큰으로의 매핑은 본 spec 의 책임 밖**이다.
2. **앱 테마**: 현재 `frontend/src/app/globals.css` 는 Shadcn neutral 토큰을 그대로 사용한다 (`--primary` 등). 브랜드 컬러를 앱 테마에 통합하는 정식 결정은 본 §8.2 의 향후 갱신 항목이다.

> 옛 임시 §8.1 (Vine Green / Deep Forest / Bud Lime / Bark / Soil / Ink 6-token 가이드) 은 본 §8.2 의 *"보류"* 상태로 흡수되었다. 별도 컬러 가이드 결정 전까지 그 6개 토큰명은 사용하지 않는다.

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

#### 8.4.1 변종 매트릭스 (유지 — 변경 없음)

> 현행 §8.4.1 본문 그대로. 자산 9종 매트릭스.

#### 8.4.2 16px 전용 변종 (유지 — 변경 없음)

#### 8.4.3 풀로고 구성 (유지 — 변경 없음)

#### 8.4.4 워드마크 사용 규정 (롤백)

워드마크는 **단색 또는 단색 반전만 허용**한다 (옛 임시 가이드 §8.3 의 단색 규정으로 복원).

> 단, 현재 정식 SVG 자산(`logo.svg`, `logo-dark.svg`, `logo-wordmark.svg`) 은 `clem`**`vi`**`on` 의 `vi` 두 글자를 별도 weight + 색(`#1e7a42` 라이트 / `#6edc8e` 다크) 으로 강조하는 2-tone 시그니처를 **자산 안에 박힌 디자인** 으로 보유한다. 이는 정식 비주얼 가이드(§8.2) 보류 상태에서의 잠정 자산 디자인이며, 새 워드마크 자산을 그릴 때 본 §8.4.4 의 단색 규정을 따를지 / 2-tone 시그니처를 정식화할지는 §8.2 갱신과 함께 결정한다.

여전히 금지: 그라데이션, 외곽선, 그림자, 회전, 왜곡, 임의 색상 치환.

#### 8.4.5 여백·최소 크기 (유지 — 변경 없음)

#### 8.4.6 로고 노출 자리 (정정)

본 §8 은 다음 자리에서의 로고 노출을 정식 사양으로 둔다. 본 항은 개별 라우트 spec 보다 **우선** 한다 (R-9 참조).

| 자리 | 변종 | 비고 |
| --- | --- | --- |
| 사이드바 상단 ([`spec/2-navigation/_layout.md` §2.1](./2-navigation/_layout.md#21-구성)) | expanded → Full logo / collapsed → Icon mark. 라이트/다크 자산 선택은 노출 자리의 배경에 맞춤 | 클릭 시 `/dashboard` |
| 인증 화면 (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`) | Full logo | 카드 컨테이너 위 중앙 배치. 카드 자체의 배경·여백은 [`spec/2-navigation/10-auth-flow.md` §1](./2-navigation/10-auth-flow.md#1-화면-구성-개요) 가 정의 |
| 브라우저 탭 | Favicon multi | 라이트/다크 자동 전환은 브라우저 표준 동작에 위임 |
| iOS 홈스크린 | Apple touch icon | 180×180 (현 임시 SVG, PNG 는 §8.6 follow-up) |
| SNS / 외부 공유 | OG image | 1200×630 (현 임시 SVG, PNG 는 §8.6 follow-up) |

(옛 §8.4.6 에서 *"배경은 `soil-50` 단색 (그라데이션 금지)"* 표현 제거 — 라우트 spec 의 자리 정의로 위임.)

### 8.5 어조와 스타일 (유지 — 변경 없음)

### 8.6 자산 마이그레이션 (갱신)

이전 임시 자산 (덩굴 + 잎 곡선 모티프) 은 본 §8 발효(2026-05-15)와 함께 폐기되었다. 정식 자산 9종은 §8.4.1 매트릭스 참조.

**현재 임시 상태**:

- `frontend/src/app/apple-icon.svg` (180×180 SVG) — 정식 PNG 자산 도입 시까지 임시. modern iOS ≥ 12 가 SVG apple-touch-icon 을 지원.
- `frontend/public/opengraph-image.svg` (1200×630 SVG) — *현재 비활성화* (Next.js metadata 의 `openGraph.images` 미선언). SVG OG 카드는 X/Slack/Facebook 크롤러 호환성 미보장. PNG 생성 후 재활성화.
- `frontend/src/app/favicon.ico` — *삭제됨*. modern 브라우저는 `icon.svg` 우선 사용. multi-size .ico 재생성은 raster 도구(sharp/ImageMagick) 도입 시.

위 3건은 별도 follow-up PR 의 대상이다.

---

## §9 변경 이력 (행 추가)

| 일자 | 항목 | 비고 |
| --- | --- | --- |
| 2026-05-05 | 최초 작성 | (유지) |
| 2026-05-15 | §8 정식 개정 | (유지 — Stage 1 작업) |
| **2026-05-15** | **§8 부분 롤백** | 사용자 피드백 *"전체적인 색상이 별로"* 로 §8.2 컬러 토큰 정식화 / §8.4.4 2-tone 허용 / §8.2.6 일시 불일치 윈도우 / 옛 6-token 폐기 매트릭스 모두 **폐기**. §8.1 노드 그래프 모티프, §8.4 로고 시스템, §8.5 어조, §8.6 자산 목록은 유지. R-2/R-3/R-4/R-8/R-10 폐기, R-13 신설. 동반 동기화: `_layout.md` §2.1, `10-auth-flow.md` §1 |

---

## Rationale (개정)

**유지**: R-1, R-5, R-6, R-7, R-9, R-11. 본문 변경 없음.

**폐기**: R-2 (4→7step ramp), R-3 (2-tone 채택), R-4 (다크 토큰 동시 도입), R-8 (vine-border/text-on-dark 네이밍), R-10 (시각↔코드 분리). 본 draft 적용 시 ## Rationale 섹션에서 해당 항목 **삭제**.

**R-12 갱신**:

```
### R-12. 출처

- 컨셉 자산: `temp/clemvion_logo_concepts.html` (gitignored, 사용자 보관)
- 사전 일관성 검토 세션:
  - 1차 (Critical 2건 발견): `review/consistency/2026/05/15/18_25_10/` — 동일 파일 내 drop-in 범위 미명시 사유. 해결책으로 draft 도입부에 drop-in 대체 범위 명시.
  - 2차 (Critical 0건, BLOCK: NO): `review/consistency/2026/05/15/18_36_51/` — Stage 1 정식 반영 승인.
  - 3차 (impl-prep, BLOCK: NO): `review/consistency/2026/05/15/18_49_57/` — Stage 2 구현 착수 승인.
  - 4차 (rollback 검토): `review/consistency/2026/05/15/<rollback_session>/` — 본 draft 검토 세션. Critical 0 건 확인 후 반영.
- 사용자 결정 (2026-05-15 대화 1차): ramp 정식 도입, vi 강조 보존, sub-copy 상시 부착, 다크 모드 동시 도입.
- 사용자 결정 (2026-05-15 대화 2차, rollback): *"전체적인 색상이 별로"* → 테마 코드 롤백 + 스펙도 부분 롤백 (옵션 A).
```

**R-13 신설**:

```
### R-13. §8 부분 롤백 결정 (Stage 1 직후 동일자)

**결정**: §8 정식판의 §8.2 컬러 토큰 / §8.2.4 코드 매핑 / §8.2.5 폐기 매트릭스 / §8.2.6 일시 불일치 윈도우 / §8.4.4 워드마크 2-tone 허용 정식 규정을 **폐기**. §8.1 모티프, §8.4.1-3/5/6 로고 시스템, §8.5 어조, §8.6 자산 목록은 유지.

**근거**:
- Stage 2 (commit `ee94a8e8`) 에서 §8.2 의 Vine ramp 를 `frontend/src/app/globals.css` 의 Shadcn 슬롯(`--primary` 등)에 매핑한 결과, 사용자가 *"전체적인 색상이 별로"* 로 거부. 이후 globals.css 는 main 의 neutral 팔레트로 복원(commit `df1533ab`).
- spec 이 정의한 컬러 토큰이 코드에 반영되지 않으면, 단일 진실(single source of truth) 원칙 위반. 임시 불일치 윈도우(§8.2.6) 로 무한 연장하는 것은 spec 신뢰성 훼손.
- 옵션 분기 (옵션 A: spec 도 롤백, 옵션 B: spec 유지, 옵션 C: 부분 롤백) 중 사용자가 옵션 A 선택. 가장 단순하고 spec/코드 정합성 우선.
- SVG 자산 (`§8.4.1`) 은 사용자가 명시적으로 유지 결정. 자산 안에 박힌 vine-green 색·`vi` 2-tone 시그니처는 자산 디자인의 일부로 보존하되, **앱 테마 토큰화** 는 보류.

**기각된 대안**:
- 옵션 B (spec 유지, 코드만 롤백): 단일 진실 원칙 위반의 무한 연장. *"미래 작업 가능성"* 만 남기고 실효성 없음.
- 옵션 C (부분 롤백): §8.2 컬러 토큰을 *"디자인 정의로만 유지"* 하는 절충안. 사용자가 "당연히 롤백" 으로 옵션 A 명시.

**부수 폐기**:
- R-2/R-3/R-4/R-8/R-10 — 모두 §8.2 컬러 토큰 도입의 부속 근거. §8.2 폐기와 함께 폐기.
- §8.4.4 의 2-tone 허용 정식 규정 → 단색 규정으로 복원. 단 현 정식 SVG 자산이 2-tone 을 디자인적으로 사용 중 — 새 워드마크 자산을 그릴 때만 단색 규정 적용.
- §8.4.6 의 *"배경은 `soil-50` 단색 (그라데이션 금지)"* 표현 → 라우트 spec 위임으로 정정.

**유지 보존**:
- R-1 (모티프 전환): 노드 그래프 모티프는 SVG 자산이 그대로 사용 중.
- R-5 (sub-copy 상시): `AGENTIC WORKFLOW` 가 svg 안에 박혀 있음 + `logo-wordmark.svg` 별도 변종 보유.
- R-6 (16px 별도 vector): `favicon-16.svg` 가 실제 존재.
- R-7 (자산 9종 정식화): §8.4.1 자산 매트릭스 그대로 유효.
- R-9 (브랜드 spec 의 라우트 spec 우선권): §8.4.6 의 자리 정의가 라우트 spec 보다 우선이라는 원칙 그대로.
- R-11 (워드마크 system 폰트 스택): svg fontFamily 에 시스템 스택 그대로 박혀 있음.

**향후 작업**:
- §8.2 컬러 토큰 정식화 — 사용자/디자이너 협업으로 새 컬러 가이드 확정 후 spec 갱신 + 코드 매핑. 별도 PR.
- `apple-icon.png` / `opengraph-image.png` 생성 — raster 도구 도입 후 별도 PR.
- `favicon.ico` multi-size 합성 — 동일 follow-up.
```

---

## 동반 동기화 — `spec/2-navigation/_layout.md` §2.1

**현재** (Stage 1 적용):

```
| 로고 | 상단 | 제품 로고. 사이드바 expanded 상태에서는 **Full logo (light)** , collapsed 상태에서는 **Icon mark** 를 표시. 클릭 시 대시보드(홈, `/dashboard`)로 이동. 자세한 변종·색은 [`spec/6-brand.md` §8.4](../6-brand.md#84-로고-시스템) 참조 (변종·색의 단일 진실은 brand spec) |
```

**제안**:

```
| 로고 | 상단 | 제품 로고. 사이드바 expanded 상태에서는 **Full logo** , collapsed 상태에서는 **Icon mark** 를 표시. 클릭 시 대시보드(홈, `/dashboard`)로 이동. 라이트/다크 자산 선택과 변종 매트릭스는 [`spec/6-brand.md` §8.4](../6-brand.md#84-로고-시스템) 참조 |
```

변경: *"Full logo (light)"* / *"Icon mark"* → *"Full logo"* / *"Icon mark"* (라이트 한정 표현 제거). 변종·색 단일 진실 표현을 유지하되 색 토큰 인용은 피함.

Rationale 행 추가:

```
### R-2. §2.1 로고 행 정정 (2026-05-15 롤백)

§8.2 컬러 토큰 정식화 폐기와 함께, 본 §2.1 의 *"Full logo (light)"* 표현에서 *(light)* 한정을 제거. 라이트/다크 자산 선택은 노출 자리의 배경에 따라 brand spec §8.4 가 결정.
```

---

## 동반 동기화 — `spec/2-navigation/10-auth-flow.md` §1

**현재** (Stage 1 적용):

```
- 중앙 정렬 카드 형태 (최대 너비 400px)
- 배경: `soil-50` (`#f7f8f6`) 단색. 그라데이션 금지. 색 토큰·예외 정의는 [`spec/6-brand.md` §8.4.4](../6-brand.md#844-워드마크-사용-규정) 참조
- 카드 상단의 `[Logo]` 자리에는 **Full logo (light)** 변종을 사용 (변종 매트릭스: [`spec/6-brand.md` §8.4.1](../6-brand.md#841-변종-매트릭스))
- 반응형: 모바일에서 카드가 전체 너비 확장
```

**제안** (롤백):

```
- 중앙 정렬 카드 형태 (최대 너비 400px)
- 배경: 제품 브랜드 색상 또는 그래디언트
- 카드 상단의 `[Logo]` 자리에는 **Full logo** 변종을 사용 (변종 매트릭스: [`spec/6-brand.md` §8.4.1](../6-brand.md#841-변종-매트릭스))
- 반응형: 모바일에서 카드가 전체 너비 확장
```

변경:
- 배경 행: `soil-50` 단색 + 그라데이션 금지 → main 의 *"제품 브랜드 색상 또는 그래디언트"* 로 복원.
- `[Logo]` 자리: `Full logo (light)` → `Full logo` (라이트 한정 제거).

Rationale 갱신 (R-1, R-2 모두):

```
### R-1. 인증 화면 배경 — 그라데이션 복원 (2026-05-15 롤백)

§1 배경 기술을 옛 Stage 1 의 *"`soil-50` 단색, 그라데이션 금지"* 에서 *"제품 브랜드 색상 또는 그래디언트"* (main 표현) 로 복원. 사용자 결정 (2026-05-15 대화 2차): 테마 코드 롤백 + spec §8.2 컬러 토큰 폐기와 함께 본 spec 도 복원.

코드 상태: `frontend/src/app/(auth)/layout.tsx` 는 `bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--muted))] to-[hsl(var(--background))]` 패턴 — Shadcn neutral 그라데이션. 로고는 `#111e14` 라운드 컨테이너 안에 별도 배치 (그라데이션 위 dark surface 로 시인성 확보).

### R-2. `[Logo]` 자리 변종 명시 (정정)

§1 의 `[Logo]` 플레이스홀더는 *"Full logo"* 변종을 사용한다 (라이트/다크 한정 제거). 자리에 들어가는 자산 선택은 brand spec §8.4.1 매트릭스 + §8.4.6 의 노출 자리 규정을 따른다 (R-9 — brand spec 의 라우트 spec 우선권).

근거 출처: `spec/6-brand.md §8.4.1`, `§8.4.6`. 사전 일관성 검토 세션: `review/consistency/2026/05/15/18_36_51/` (Stage 1), `<rollback 세션>` (본 롤백).
```

(이전 R-1, R-2 는 본 행으로 **대체** — 같은 번호 재사용.)

---

## plan 정리 사항

- `plan/in-progress/spec-update-brand-followup.md` — P-1, P-3, P-4, P-5 모두 본 draft 에서 처리. P-2 는 §8.2 컬러 토큰 폐기로 자연 close. → 본 draft 반영 완료 후 `plan/complete/` 로 `git mv`.
- 본 draft (`plan/in-progress/spec-draft-brand-rollback.md`) → 반영 완료 후 `plan/complete/` 로 이동.
- `plan/in-progress/brand-refresh-impl.md` — §1.3 PNG 자산 / §1.2 favicon.ico multi-size 합성 / §5 Playwright 시각 회귀 / sidebar 단위 테스트 follow-up 들은 미체크로 남음 → `in-progress/` 유지.

---

## 검토 체크리스트 (consistency-check 사전 점검)

- [x] §8 정식판의 어느 섹션을 폐기/유지/정정할지 drop-in 범위 표 명시
- [x] 신 §8.2 (보류) 본문 작성 — SVG 안 박힌 컬러 참고 + 앱 테마 분리 명시
- [x] §8.3 워드마크 색 인용을 HEX 직접 표기로 정정 (옛 토큰명 의존 제거)
- [x] §8.4.4 단색 규정 복원 + 자산 내 2-tone 디자인 보조 설명
- [x] §8.4.6 표 — `soil-50` 표현 제거, 라우트 spec 위임 명시
- [x] §8.6 자산 마이그레이션 — SVG 임시 + PNG follow-up 명시
- [x] §9 변경 이력 두 번째 2026-05-15 행 (롤백) 명시
- [x] R-2/R-3/R-4/R-8/R-10 폐기 명시, R-12 갱신, R-13 신설
- [x] `_layout.md` §2.1 정정안 (`Full logo (light)` → `Full logo`)
- [x] `10-auth-flow.md` §1 배경 복원 + `[Logo]` 변종 표현 정정
- [x] 두 라우트 spec 의 Rationale 행 갱신 (R-1, R-2 대체)
- [x] plan 정리 — spec-update-brand-followup.md 의 P 항목 close 경로 명시
- [ ] (필수) `/consistency-check --spec plan/in-progress/spec-draft-brand-rollback.md` 호출 — Critical 0 건 확인

---

## 다음 액션

1. **본 draft 에 대해 `/consistency-check --spec` 의무 호출**.
2. Critical 0 건 확인 시 한 turn 안에 다음 3개 spec 동시 갱신:
   - `spec/6-brand.md` — 제목 + §8 부분 롤백 + §9 행 추가 + Rationale 개정
   - `spec/2-navigation/_layout.md` — §2.1 정정 + Rationale R-2 신설 (R-1 은 유지)
   - `spec/2-navigation/10-auth-flow.md` — §1 복원 + Rationale R-1/R-2 갱신
3. plan 정리 — `spec-update-brand-followup.md` + 본 draft → `plan/complete/`.
4. commit + push.

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

#### `plan/in-progress/brand-refresh-impl.md`
```
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

## 2. CSS 토큰 매핑 — **테마 롤백 (2026-05-15)**

사용자 피드백 *"전체적인 색상이 별로"* 로 globals.css 의 Vine 토큰 매핑을 **main 으로 전면 롤백**. Shadcn neutral 토큰 (`--primary: 222.2 47.4% 11.2%` 등) 그대로 유지. `(auth)/layout.tsx` 배경도 `bg-gradient-to-br ...` 로 복원.

SVG 자산은 자체 fill 로 Vine 컬러를 보유하므로 로고/파비콘 비주얼은 그대로 유지됨. 단 spec ↔ 코드 일치를 위해 `spec/in-progress/spec-update-brand-followup.md` 의 P-4 항목 (spec §8.2 부분 롤백 / 후속 분리) 을 project-planner 에 위임.

본 §2 의 아래 체크박스는 *원래 계획* 이며, 롤백으로 모두 **무효화**:

## ~~2. (이전 계획) CSS 토큰 매핑~~ — 무효

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

- [x] 프로젝트 루트 `README.md` 헤더에 full logo 

... (truncated due to size limit) ...
