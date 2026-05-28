---
title: 로고 리프레시 — 새 추상 마크 + 워드마크 컬러 재정렬 (2026-05-25)
created: 2026-05-25
worktree: .claude/worktrees/update-logo-and-favicon-cb7b91
branch: claude/update-logo-and-favicon-cb7b91
spec_touched:
  - spec/6-brand.md
  - spec/2-navigation/10-auth-flow.md
code_touched:
  - codebase/frontend/public/logo.svg
  - codebase/frontend/public/logo-dark.svg
  - codebase/frontend/public/logo-mark.svg
  - codebase/frontend/public/logo-mark-dark.svg
  - codebase/frontend/public/logo-wordmark.svg
  - codebase/frontend/public/favicon-16.svg
  - codebase/frontend/public/apple-icon.svg
  - codebase/frontend/public/opengraph-image.svg
  - codebase/frontend/src/app/icon.svg
  - codebase/frontend/src/app/(auth)/layout.tsx
  - codebase/frontend/src/components/layout/sidebar.tsx
  - codebase/frontend/src/components/ui/logo.tsx
---

# 로고 리프레시 (2026-05-25)

사용자가 `temp/logo.svg` 에 새 로고 마크를 제공하여, 기존 *node-graph* 모티프(spine+branches+nodes, vine-green ramp) 전체를 폐기하고 추상 단일 path + linear-gradient (teal `#12acaa` → lime `#8be67e`) 로 전환한다.

자산 파일명·`<Logo>` 컴포넌트 API 는 그대로 유지하므로, 변경은 **SVG 자산 내용물 + 워드마크 fill 색 + spec 문서 + "vine" 네이밍 코멘트** 에 한정된다.

## Phase 1 — SVG 자산 재생성 (9종)

`spec/6-brand.md §8.4.1` 자산 매트릭스의 9개 파일을 새 모티프로 재작성. 파일명·경로 모두 그대로.

| 파일 | 변경 |
| --- | --- |
| `public/logo.svg` | 풀로고 light. mark + wordmark + sub-copy. `vi` accent = `#0e8c8a` (teal-deep). 컨테이너 transparent. |
| `public/logo-dark.svg` | 풀로고 dark. `vi` accent = `#8be67e` (lime). |
| `public/logo-mark.svg` | 96px master. 컨테이너 `#eef5ec` (기존 유지). |
| `public/logo-mark-dark.svg` | 96px dark. 컨테이너 `#0a1f1f` (dark teal). |
| `public/logo-wordmark.svg` | 워드마크 only. `vi` accent `#0e8c8a`. |
| `public/favicon-16.svg` | 16px. 새 path 는 이미 단순 → 그대로 축소 (R-6 단순화 규정은 형식 유지). |
| `public/apple-icon.svg` | 180×180. iOS 자동 라운드. |
| `public/opengraph-image.svg` | 1200×630. 중앙 풀로고 + 하단 태그라인. |
| `src/app/icon.svg` | 32px Next.js metadata. 컨테이너 `#eef5ec`. |

**컬러 토큰** (자산 안에 박힘, app 테마 매핑 없음 — §8.2 정신 그대로):

- Gradient (light/dark 공통): `#12acaa` → `#8be67e` (linear, top-right → bottom-left)
- 컨테이너 light: `#eef5ec`. 컨테이너 dark: `#0a1f1f`.
- 워드마크 base — light: `#0e1a12`, dark: `#e8f5ec`.
- 워드마크 `vi` accent — light: `#0e8c8a`, dark: `#8be67e`.
- 서브카피 fill — light: `#5fc99c`, dark: `#7ed9a8`.

## Phase 2 — spec/6-brand.md 갱신

§8 본문을 새 모티프에 맞춰 부분 개정. 9종 자산 매트릭스·R-5(sub-copy 상시)·R-6(16px 별도 vector)·R-7(자산 9종 명시)·R-9(브랜드 spec 우선권)·R-11(워드마크 시스템 폰트) 은 모두 보존. R-1(노드 그래프 모티프 채택) 만 **Superseded by R-14** 처리.

변경 섹션:

- §8.1 디자인 모티프 — node-graph → "single-path 추상 마크" 재기술
- §8.2 컬러 — 자산 박힘 hex 값 갱신 (vine ramp → teal/lime gradient)
- §8.3 타이포그래피 — 워드마크 `vi` accent / sub-copy fill 값 갱신
- §8.4.2 16px favicon — 새 마크는 path 1개라 축소만으로 가독성 확보. "노드 ≤ 4 / 라인 ≤ 3" 규정은 "16px 환경에서 마크 식별성 유지" 로 일반화
- §8.4.4 워드마크 — accent 색 hex 만 갱신, 2-tone 시그니처는 유지
- §8.6 자산 마이그레이션 — 2026-05-25 교체 로그 추가
- §9 변경 이력 — 2026-05-25 항 추가
- R-1 — Superseded by R-14 마킹 (이력 보존)
- R-14 신설 — 새 모티프 채택 결정·근거·기각 대안

## Phase 3 — spec/2-navigation/10-auth-flow.md

§5 (또는 해당 위치) 의 "vine-dark" 표현을 "브랜드 dark surface" 로 갱신. hex `#111e14` 는 그대로 유지 (테스트 호환).

## Phase 4 — 코드 코멘트 갱신

- `codebase/frontend/src/app/(auth)/layout.tsx`: "vine-green/vine-dark-bg-elevated" → 브랜드 중립
- `codebase/frontend/src/components/layout/sidebar.tsx`: 동일
- `codebase/frontend/src/components/ui/logo.tsx`: "vine-700" 코멘트 갱신

코드 동작·hex 값 변경 없음 → 기존 테스트 그대로 통과.

## Phase 5 — 검증

- `pnpm --filter @clemvion/frontend lint`
- `pnpm --filter @clemvion/frontend test -- logo`
- `pnpm --filter @clemvion/frontend test -- auth.*layout`
- 시각 검증: dev server 띄워 `/login`, `/dashboard` (sidebar) 로고 확인

## Side-effects

- 사이드바·인증 화면의 로고가 즉시 새 디자인으로 노출됨 (의도된 효과)
- 사용자가 `temp/logo.svg` 를 명시적으로 제공했으므로 *user-driven brand change*. consistency-check 는 spec 본문에 R-1 → R-14 의 연속성을 명시하여 통과 가능 (rationale-continuity-checker 가 슈퍼시드 처리를 인정)
- `apple-icon.png` / `opengraph-image.png` raster 생성 follow-up 은 이전과 동일하게 미해소 — 별도 PR
