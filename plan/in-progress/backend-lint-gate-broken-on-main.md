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

[`auth-workspace-membership-guard`](../complete/auth-workspace-membership-guard.md) 구현 중
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

> **본체 완료 (2026-08-09) — `#1104` (`a9e2322a1`) 머지.** lint 게이트는 복구됐다.
> `in-progress/` 에 남는 이유는 아래 **§부수 발견 2건**(spec 파일 타입체크 부재 · `deleteByPrefix`
> LIKE 이스케이프)과 **§잔여 warning 47건**뿐이며, 셋 다 이 PR 의 목적(게이트 복구) 밖이라
> 의식적으로 미뤘다. 게이트 자체는 더 이상 깨져 있지 않다.

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
- [x] `/ai-review` — **완료 (2026-08-09), Critical 0**. 74파일을 **두 세션으로 나눠** 전량
      커버했다(`00_49_48` 40파일 · `00_50_08` 34파일) — orchestrator 의 `--prepare` 가 큰
      changeset 을 배치 분할하면서 배치들이 같은 세션 디렉터리를 공유해 뒤 배치만 남기 때문
      (실측은 [`harness-review-gate-followups.md`](harness-review-gate-followups.md) 의
      "형제 파일 부분 추출" 항목에 기록). 각 Warning 1건씩 처리 후 변경 파일 1개만 타겟
      재리뷰(`01_07_48`) → **Critical 0 · Warning 0**.
      RESOLUTION 3건: `00_49_48` · `00_50_08` · `01_07_48`.
- [x] `/consistency-check --impl-done spec/data-flow/` — **BLOCK: NO** (Critical 0 ·
      Warning 0 · risk NONE, `review/consistency/2026/08/09/01_16_22`).
      *`spec/5-system/` 이 아니라 `data-flow` 를 쓴 이유*: 전자는 번들이 1.2MB 라 어떤 실용
      예산에서도 구현 diff 와 공존할 수 없다(실측). 예산 850,000 + data-flow 조합에서 diff 가
      프롬프트에 온전히 실린 것을 청크 헤더 위치로 확인한 뒤 실행했다.
- [x] push + PR — **`#1104` (`a9e2322a1`) 머지 완료 (2026-08-09)**

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

- [x] 성격별 분류 — **먼저 수치를 정정한다.** `319` 는 진단 수가 아니라 `tsc` **출력의
      줄 수**였다(프록시로 셌다). 실제 진단은 **209건 / 40파일**이고 **전부 테스트 파일,
      프로덕션 0건**이다. TS 코드별로 갈린다:
      - **의도적 느슨함 ~199** — `TS2352`(mock 캐스팅) · `TS2339`/`TS18046`(부분 mock 의
        속성 접근) · `TS2322`/`TS2741` 등. 수용 대상.
      - **진짜 stale 10** — `TS2554`(인자 개수) 6 + `TS2304`(미정의 이름) 4. 전부 수정.
- [x] 승격 여부 판정 — **ratchet 으로 승격**(사용자 결정). plan 이 세운 "승격 or 미승격"
      이분법을 쓰지 않았다: baseline 을 커밋해 기존 잔여는 수용하고 **새 오류만** 막으면
      209건을 먼저 처분하지 않고도 바닥을 지금 닫을 수 있다. 정리는 각자 자기 파일을
      만질 때 점진적으로.
      > **증가와 감소 둘 다 실패**로 만들었다. 낮추지 않은 baseline 은 그 차이만큼 새
      > 오류를 조용히 받아들인다 — 이 저장소가 반복해 데인 "게이트가 조용히 헐거워지는"
      > 실패다. `--update` 로 재생성하는 정상 경로를 에러 메시지에 적었다.
- [x] **전제가 하나 더 무너졌다 — 승격할 CI 가 없었다.** 워크플로 10개의 `run:` 전수
      실측: frontend·channel-web-chat·`@workflow/web-chat`·`@workflow/sdk`·내부 packages 는
      lint/test/build 가 전부 CI 에서 도는데 **backend 만 셋 다 없다**. 유일한 커버리지는
      `e2e.yml` 의 docker 빌드(`nest build`)와 e2e 뿐이다 — **본 plan 이 복구한 lint
      게이트가 3개월간 방치될 수 있었던 진짜 이유가 이것**이다. → `backend-checks.yml`
      신설(`#1106` skip-job 패턴, `lint`·`unit`·`typecheck-ratchet` 3잡).

### `deleteByPrefix()` LIKE 메타문자 미이스케이프 (ai-review INFO, 이 PR 밖)

`secret-store/secret-resolver.service.ts` 의 `deleteByPrefix()` 가 `` `${prefix}%` `` 를
바인딩하는데 `%`·`_` 를 이스케이프하지 않는다. TypeORM 파라미터 바인딩이라 **SQLi 는
아니지만**, prefix 에 메타문자가 섞이면 의도보다 넓게 지워지는 **과다 삭제** 소지가 있다.

- [x] 호출부 전수 확인 — **프로덕션 호출부는 `triggers.service.ts:875` 한 곳**이고
      `secret://triggers/${trigger.id}/` 다. `trigger.id` 는 `@PrimaryGeneratedColumn('uuid')`
      라 `%`·`_` 가 들어갈 수 없다(실측).
- [x] 처분 — **주석 고정이 아니라 입력 거부**를 골랐다. "지금 안전하다" 는 **호출부 목록이
      그대로일 때만** 참이라, 사용자 입력이 섞인 prefix 를 넘기는 호출부가 하나 생기면
      주석은 아무것도 막지 못한다. 이미 있던 `secret://` 접두사 검사와 같은 형태로 throw 한다.
      > **이스케이프(`\%` + `ESCAPE` 절)가 아닌 이유**: 이 API 의 prefix 는 내부에서
      > 조립하는 식별자 경로라 메타문자가 **정당하게 필요한 경우가 없다.** 이스케이프는
      > 없는 유스케이스를 위해 표면을 넓히는 쪽이다.
      > 가드가 정상 경로를 막지 않는 것도 테스트로 고정했다 — 막으면 trigger 삭제가
      > 조용히 실패한다.

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
