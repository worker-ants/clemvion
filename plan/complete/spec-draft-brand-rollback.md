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
