---
worktree: brand-refresh-7a3f12
started: 2026-05-15
owner: developer (proposing to project-planner)
---

# Spec Update Proposal: Brand Refresh Followup

본 plan 은 `developer` 가 brand-refresh PR (#33) 시행 중 spec 정합성을 위해 `project-planner` 로 위임할 항목을 정리한 노트다.

**2026-05-15 갱신 — 테마 롤백**: 사용자 피드백("전체적인 색상이 별로") 으로 globals.css 의 Vine 토큰 매핑을 main 으로 롤백. SVG 자산 / 로고 컴포넌트 / 사이드바·인증 통합·metadata 는 그대로 유지. 결과적으로 `spec/6-brand.md §8` 의 정식판이 정의한 Vine ramp / `.dark` 토큰 / 워드마크 2-tone 등이 **spec 에는 정의되어 있으나 코드에 반영되지 않은 상태** 가 됨. 본 follow-up 의 우선순위가 크게 상승.

## 제안 항목

### P-1. `spec/6-brand.md` 제목에서 `PRD:` prefix 제거

(이전 영역과 동일 — 변경 없음)

**현재**: `# PRD: 브랜드 가이드 — Clemvion`
**제안**: `# 브랜드 가이드 — Clemvion`
**근거·영향**: 위 참고.

### P-2. `spec/0-overview.md §3.4` 상태 색상 매핑

(이전 영역과 동일 — 변경 없음. 단 §8.2.1 토큰 매핑이 의미를 가지려면 P-4 의 결정과 묶임.)

### P-3. `spec/2-navigation/10-auth-flow.md §1` 갱신 (테마 롤백 반영)

**현재** (Stage 1 에서 추가):

```
- 배경: `soil-50` (`#f7f8f6`) 단색. 그라데이션 금지. 색 토큰·예외 정의는 ...
- 카드 상단의 `[Logo]` 자리에는 Full logo (light) 변종을 사용 ...
```

**제안**: 배경 행을 **롤백** (main 의 *"제품 브랜드 색상 또는 그래디언트"* 로 복원) 하되, `[Logo]` 자리 명시는 유지.

```
- 배경: 제품 브랜드 색상 또는 그래디언트 (frontend 는 `bg-gradient-to-br ... --background → --muted → --background` 패턴 적용)
- 카드 상단의 `[Logo]` 자리에는 Full logo 변종을 사용 (변종 매트릭스: `spec/6-brand.md §8.4.1`)
```

**근거**: 사용자 피드백으로 `soil-50` 단색 배경 미적용. spec ↔ 코드 일치를 위해 spec 도 복원.

**영향**: §1 한 행 + Rationale R-1 항목 갱신 또는 추가 행 (롤백 사유).

### P-4. `spec/6-brand.md §8.2 / §8.3 / §8.4.4 / §8.6 / R-2 ~ R-11` 부분 롤백

**문제**: §8.2 의 Vine ramp + Dark 토큰, §8.3 워드마크 폰트 weight 명세, §8.4.4 워드마크 2-tone 허용 (단색 규정 폐기), §8.6 폐기 토큰 매트릭스 등은 모두 *코드에 반영* 됨을 전제로 작성되었다. 테마 롤백으로 이 전제가 깨짐.

**선택지**:

- **A) spec 도 함께 롤백** — §8.2~§8.4 의 정식판을 임시 가이드 (옛 §8) 로 되돌리고 §8.1 (디자인 모티프), §8.4.1 (자산 매트릭스), §8.4.3 (sub-copy 상시), §8.6 (자산 9종) 만 정식화 유지. R-2/R-4/R-8/R-10 폐기, R-1/R-5/R-6/R-7/R-11 유지. *코드 적용 가능한 최소 spec.*
- **B) spec 은 유지** — §8.2.6 의 *일시 불일치 허용 윈도우* 를 그대로 활용. spec 은 "설계 의도, 코드 미반영" 상태로 둠. follow-up PR 에서 단계적 적용. *spec 작업 보존, 미래 작업 가능성 열어둠.*
- **C) 부분 롤백** — §8.4.4 워드마크 2-tone 만 유지 (워드마크 svg 자체가 이미 2-tone 으로 작성됨), §8.2 컬러 토큰은 *디자인 정의로만* 유지하고 "코드 적용은 후속 PR" 명시. R 항목은 부분 보존. *중간 절충.*

**developer 추천**: **B 또는 C**. 사용자가 SVG 자산은 좋다고 했고 (그것만 유지하라 했으니), 워드마크의 `vi` 2-tone 도 SVG 안에 박혀있으니 의미 있음. 컬러 ramp 자체는 SVG 안에서 사용 중이라 디자인 정의로서 가치 있음. 다만 *코드 매핑* 부분 (§8.2.4, §8.6 의 코드 자산 폐기 매트릭스) 은 신중히 갱신 필요.

**영향**: §8 대부분 섹션 + Rationale 다수 + §9 변경 이력 추가 행. project-planner 가 spec draft → consistency-check → 반영. 본 follow-up 의 핵심 결정사항.

### P-5. `spec/2-navigation/_layout.md` §2.1 표현 강도 조정 (선택 사항)

P-4 의 결정과 묶임. spec 이 §8.2 토큰을 유지하면 §2.1 의 로고 행 갱신 (Full/Mark variant 명시) 은 그대로 유효. spec 이 컬러 ramp 를 롤백하면 §2.1 도 일관성 점검.

## 우선순위

- **P-1, P-3, P-4**: brand-refresh PR (#33) merge 전후 처리. P-4 가 가장 큰 결정.
- **P-2, P-5**: 후속, 비차단.

project-planner 에 위임. P-4 결정 시 코드↔spec 일치를 위해 developer 와 협업 필요.
