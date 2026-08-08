---
title: backend lint 스테이지가 main 에서 깨져 있다 — prettier·typescript-eslint 무검증 머지의 결과
worktree: (unstarted)
started: 2026-08-08
owner: developer
status: in-progress
priority: P1
spec_impact: none
---

## Overview

[`auth-workspace-membership-guard`](auth-workspace-membership-guard.md) 구현 중
TEST WORKFLOW `lint` 스테이지가 실패해 발견했다. **그 브랜치의 변경과 무관하며
`origin/main` 자체가 깨져 있다.** 사용자 결정(2026-08-08): **별 PR 로 분리** —
78개 파일 포맷 변경이 보안 fix 의 diff 를 덮지 않게 한다. 보안 PR 은 이 PR 위에 rebase.

## 실측 (2026-08-08)

`cd codebase/backend && npx eslint . --format json` 전수:

| 지표 | 값 |
| --- | --- |
| 에러 있는 파일 | **79개** |
| 총 메시지 | **224건** |
| `prettier/prettier` | 123 |
| `@typescript-eslint/no-unnecessary-type-assertion` | 54 |
| `@typescript-eslint/no-unsafe-assignment` | 20 |
| `no-unsafe-member-access` / `-argument` / `-return` | 8 / 8 / 7 |

79개 중 **78개가 auth 브랜치 diff 밖**이다(그 브랜치가 만든 것이 아님을 이 사실로 확정 —
건드리지 않은 파일이 실패하면 정의상 선재다). 그 브랜치가 만든 1건(`roles.guard.ts`
헤더 배열 정규화 줄)은 거기서 이미 고쳤다.

## 원인 정황

`prettier/prettier` 123건이 거의 전부 **union 타입의 선행 `|`** 를 지적한다
(`Replace '|·Record<string,·unknown>⏎' with 'Record<string,·unknown>'` 형태).
이는 prettier 의 union 포맷 규칙 변경 서명이다.

- `#1076` — prettier 3.8.4 → **3.9.6** (dependabot)
- `#1079` — typescript-eslint 8.61.1 → **8.65.0** (dependabot) → `no-unnecessary-type-assertion`
  54건이 새로 발화한 것으로 보인다

두 PR 모두 **Actions 가 꺼진 기간에 검증 없이 머지**됐다. 이 저장소가 이미 학습한 클래스이며
(`deps-guard-hardening` 의 audit 13건 누적과 동일한 뿌리), lint 는 그중 아직 안 드러났던 축이다.

> **진단 과정에서 두 번 틀렸다 — 재현 시 주의.**
> 1. 처음엔 2파일만 보고 "선재" 라 판단해 `npx prettier --write` 를 돌렸는데 `unchanged` 가
>    떴다. 표준 prettier 와 `eslint-plugin-prettier` 의 판정이 갈리는 상태였다.
> 2. `run-test.sh lint` 는 **마지막 30줄만** 내보내므로 그 출력에서 센 "51건 / 3파일" 은
>    truncated 값이었다. `npx eslint --format json` 으로 직접 재고 나서야 79파일/224건이
>    드러났다. **wrapper 요약 숫자로 규모를 판단하지 말 것.**

## 체크리스트

- [ ] `origin/main` 에서 전수 재측정 (이 문서 숫자는 auth 브랜치 기준 — 그 브랜치의 1건을
      뺀 78파일/223건이 main 값일 것으로 예상하되 **실측으로 확정**)
- [ ] `prettier/prettier` 123건 — `npx prettier --write` 로 일괄. **eslint --fix 전면 적용
      금지** (drive-by 로 로직 변경이 섞인 선례: `project_reaper_engine_dry_refactor_920`)
- [ ] `@typescript-eslint/no-unnecessary-type-assertion` 54건 — 기계적 제거가 **안전한지
      건별 확인**. 불필요해 보이는 assertion 이 실제로는 좁히기를 하고 있으면 타입 회귀다
- [ ] `no-unsafe-*` 43건 — 판정 필요. 억제(`eslint-disable` + 근거) vs 타입 보강 택일
- [ ] lint 통과 후 `run-test.sh lint` 로 wrapper 경로도 확인
- [ ] TEST WORKFLOW (lint·unit·build·e2e) — 포맷 변경이 런타임에 영향 없음을 e2e 로 확인
- [ ] `/ai-review` — scope 리뷰어가 "무관 변경" 으로 볼 수 있으므로 PR 본문에 선재 근거 인용

## Rationale

**왜 P1 인가.** lint 게이트가 **모든 backend PR 을 막는다.** 보안 fix 를 포함해 어떤 작업도
TEST WORKFLOW 를 온전히 통과했다고 말할 수 없는 상태다. 코드 동작 결함은 아니지만 게이트
차단이라 우선순위가 높다.

**왜 별 PR 인가 (사용자 결정 2026-08-08).** 78파일 포맷 변경을 보안 PR 에 넣으면 diff 가
swamp 되고 scope 리뷰어가 정당하게 지적한다. 보안 fix 의 리뷰 품질을 지키는 것이 우선이다.

**함께 볼 것**: [`deps-peer-gating-and-eslint10.md`](deps-peer-gating-and-eslint10.md) 가
"Actions 가 repo 레벨에서 꺼져 있어 dependabot PR 이 아무 검증 없이 머지된다" 를 이미
기록하고 required-check 등록을 사용자 액션으로 남겨 뒀다. **이 건이 그 미등록의 3번째
피해**다(1: `#1058` typescript 롤백, 2: `#1074` unicorn 복원, 3: 본 건). required check
등록 없이는 4번째가 온다.
