---
title: backend lint 스테이지가 main 에서 깨져 있다 — prettier·typescript-eslint 무검증 머지의 결과
worktree: backend-lint-gate-b72fdd
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

## ⚠️ 스코프 정정 (2026-08-09) — 게이트를 막던 것은 prettier 122건뿐이었다

`codebase/backend` 의 lint 스크립트는 `eslint "{src,apps,libs,test}/**/*.ts"` 로
**`--max-warnings` 가 없다** → **warning 은 게이트를 실패시키지 않는다.**
`origin/main` 223건을 severity 로 분해하면:

| severity | 건수 | 내역 |
|---|---|---|
| **error (차단)** | **122** | `prettier/prettier` 전부 |
| warning (비차단) | 101 | `no-unnecessary-type-assertion` 54 · `no-unsafe-*` 45 · unused disable 2 |

즉 **prettier 단계만으로 게이트는 열린다.** 이 문서가 처음에 "79파일/224건이 모든 backend
PR 을 막는다" 고 적은 것은 **부정확**했다 — 막던 것은 그중 122건이다. severity 를 안 보고
메시지 총수로 규모를 말한 탓이며, 이 저장소가 반복 학습한 "요약 숫자로 판단하지 말라" 의
같은 클래스다.

## 체크리스트

- [x] `origin/main` 에서 전수 재측정 — **78파일 / 223건** (예상치와 일치, 실측 확정)
- [x] `prettier/prettier` 122건 — 51파일에 `prettier --write`. `eslint --fix` 전면 적용
      금지 원칙 준수(drive-by 회피). **이것만으로 게이트 error 0**
- [x] `@typescript-eslint/no-unnecessary-type-assertion` 54건 — 적용 후 **회귀 7건 발생,
      전량 처분**. 규칙이 "불필요" 로 지목한 assertion 중 일부가 로드베어링이었다:
      `Readonly` 해제 1 · `unknown` 좁히기 1(TS2339 ×3) · `.map()` literal widening 2 ·
      `String()` 안전화 1(lint 만 잡음). 추가로 고아 import 6건.
      widening 2건은 **억제 대신 더 나은 수정**(콜백 반환 타입 명시 · 형제와 같은
      `as const`), 나머지는 복원 + 근거 주석 + `eslint-disable`
- [x] `run-test.sh lint` wrapper 경로 확인 — **PASS (56s)**
- [x] TEST WORKFLOW — lint PASS · unit PASS(88s) · build PASS(155s) · **e2e PASS(297s, 261 tests)**
- [ ] `/ai-review` — scope 리뷰어가 "무관 변경" 으로 볼 수 있으므로 PR 본문에 선재 근거 인용
- [ ] push + PR

## 잔여 warning 47건 — 처분 방침 (이 PR 에서 하지 않는다)

`no-unsafe-*` 45 + 기타 2. **비차단이므로 이 PR 의 목적(게이트 복구) 밖이다.** 45곳에
억제/타입보강을 넣으면 판단이 들어간 변경이 45개 늘고 diff 만 커지는데 게이트에는 영향이 없다.

착수 시 성격별로 갈릴 것 (2026-08-09 분석):

| 위치 | 건수 | 성격 |
|---|---|---|
| `src/scripts/migrate-node-output-refs.ts` | 17 | 일회성 마이그레이션 스크립트의 동적 키 인덱싱 |
| `external-interaction/idempotency.interceptor.ts` | 8 | `getResponse()` 제네릭 부재 → **타입 보강이 정답**(코드는 이미 `typeof` 런타임 방어 중) |
| `triggers/triggers.service.ts` | 6 | 미타입 반환값 소비 |
| `ai-agent/tool-providers/render-tool-provider.ts` | 6 | `unknown` 재귀 순회 → **정당한 unsafe, 억제 + 근거** |
| 기타 5파일 | 8 | `m.query()` · iterator `.value` 등 |

**`--max-warnings 0` 도입 여부**가 선행 결정이다 — 도입하지 않으면 이 47건은 계속 비차단이라
정리 유인이 약하고, 도입하면 47건을 다 처분해야 게이트가 열린다. 그 결정 없이 부분 정리하는
것은 값이 낮다.

## 같은 뿌리의 형제 결함 — frontend Gate C (2026-08-08 발견·해소)

`plan/complete/harness-review-gate-ci-backstop.md` 의 frontmatter 에 `spec_impact` 가
없어 Gate C(`spec-plan-completion.test.ts`)가 실패하고 있었다 → **frontend unit 게이트가
막혀 있었다.** `started: 2026-07-25` 로 grandfather 경계(2026-06-04) 이후라 대상이다.
유입: `cdf3b6832`(`#1097`).

**해소**: `spec_impact: none` 추가(auth 브랜치에서 처리). 값 근거는 실측 — `cdf3b6832` 가
`spec/` 을 **0건** 건드렸다(`git show --stat | grep '^ spec/'`). 확인: Gate C **770 passed**.

> lint 79파일과 달리 이건 **plan 파일 1줄**이라 보안 diff 를 오염시키지 않으므로 그 브랜치에서
> 바로 고쳤다. 판단 기준은 "선재냐" 가 아니라 **diff 오염 규모**다.

이로써 오늘 하루에 드러난 main 잠재 결함이 셋이다: audit 13건(`#1095` 해소) · backend lint
79파일(본 plan) · frontend Gate C(해소). 셋 다 **Actions 꺼진 기간의 무검증 머지**가 뿌리다.

## 부수 발견 — spec 파일이 타입체크되지 않는다 (별 항목, 이 PR 밖)

`tsc --noEmit -p tsconfig.json` 으로 **전체 프로그램**을 타입체크하면 `*.spec.ts` /
`*.e2e-spec.ts` 에 **선재 타입 에러 319줄**이 나온다(2026-08-09 실측, ai-review INFO 4 가
규모까지 확인). 예: `execution-engine.service.spec.ts` · `integration-oauth.service.cafe24.spec.ts` ·
`nodes/presentation/table/buttons.spec.ts`.

**현재 게이트에서 안 잡히는 이유**: 실제 build 는 `nest build` = `tsconfig.build.json` 이고
그 파일이 `test/` · `**/*spec.ts` 를 exclude 한다. jest 는 `ts-jest`/babel 경로라 타입을
강제하지 않는다. 즉 **테스트 코드는 어떤 게이트에서도 타입체크되지 않는다.**

이 저장소가 이미 학습한 클래스다 — 메모리 `feedback_type_guard_test_actually_runs`
("`vitest run` = 타입 strip 이라 타입 테스트가 no-op", "build 가 spec.ts exclude").
**타입 가드를 테스트로 고정해 두었는데 그 테스트가 타입체크되지 않으면 가드가 vacuous 하다**
는 것이 이 갭의 실질 위험이다.

- [ ] 319줄을 성격별로 분류 (진짜 결함 vs 테스트 mock 의 의도적 느슨함)
- [ ] `tsc --noEmit` 을 게이트로 승격할지 판정 — 승격하면 319줄을 먼저 처분해야 한다
- [ ] 승격하지 않기로 하면 **그 근거를 문서에 고정** (다음 사람이 같은 조사를 반복하지 않도록)

> 이 PR 에서 하지 않는 이유: 이 PR 의 목적은 **eslint 게이트 복구**이고, `tsc` 게이트는
> 별개 축이다. 319줄 처분을 여기 얹으면 이미 74파일인 diff 가 감당 불가가 된다.

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
