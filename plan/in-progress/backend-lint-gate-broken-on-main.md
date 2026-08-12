---
title: backend lint 스테이지가 main 에서 깨져 있다 — prettier·typescript-eslint 무검증 머지의 결과
worktree: lint-warning-triage
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

> **처분 완료 (2026-08-12).** 아래 "이 PR 에서 하지 않는다" 는 게이트 복구 PR(`#1104`)
> 기준의 서술이다. 그 뒤 별 PR 이 이 절을 핵심 작업으로 승격해 **전량 처분**했고
> `--max-warnings 0` 을 걸었다 — 결론과 근거는 §후속 의 마지막 항목에 있다.
> 아래 표의 성격 분류는 **일부 틀렸다**(같은 항목 참조). 지금 읽는 사람이 미해결로
> 오해하지 않도록 여기 먼저 적는다.
>
> **제목의 "47건" 도 정정 대상이다 — 착수 시점 실측은 46.** 47 은 `#1104` 직후
> (2026-08-09) 값이고, 그 사이 다른 PR 들이 일부를 자연 소거했다. 제목·아래 본문의 47 은
> **그 날짜의 역사값**으로 남겨 두고(당시 판단의 근거였으므로), 실측 46 과 그 차이의
> 출처는 §후속 마지막 항목에 적었다.

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

> **결정 (2026-08-12): 도입한다.** 전량 처분 후 `--max-warnings 0` 을 걸었다.

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

## 부수 발견 — spec 파일이 타입체크되지 않는다 (**후속 PR 에서 처분 완료**)

> **문구 정정 (2026-08-09).** 아래 "이 PR 밖" 은 lint 복구 PR(`#1104`) 기준의 서술이었다.
> 그 뒤 후속 PR 이 이 절을 **핵심 작업으로 승격**해 전부 처분했다 — 진짜 결함 10건 수정 +
> ratchet 게이트 + `backend-checks.yml` 신설. 지금 읽는 사람이 "아직 안 한 일" 로
> 오해하지 않도록 제목을 바꾼다(ai-review INFO 12).

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

### `deleteByPrefix()` LIKE 메타문자 미이스케이프 (**타입체크 갭 PR 에 포함**)

> **문구 정정 (2026-08-09, ai-review WARNING #1).** "이 PR 밖" 은 lint 복구 PR 기준이었다.
> 타입체크 갭 PR 에 **함께 실었다** — 조사(호출부 전수 확인)와 조치(4줄 + 테스트)가 둘 다
> 작고, 같은 plan 의 마지막 잔여 두 항목이라 하나로 닫는 편이 추적 비용이 낮다고 봤다.
> 다만 프로덕션 동작 변경(신규 throw)이므로 그 판단을 여기 남긴다.

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

## 신설 `backend unit` 게이트가 첫 실행에서 찾은 것 (2026-08-09)

`#1109` 이 올린 `backend unit` 잡이 PR 에서 처음 돌자 **8494건 중 1건**이 실패했다.
`#1111`(reusable workflow 추출)에서 관측 — 그 PR 은 CI 배선·하네스 테스트만 바꾸므로
**원인이 아니다**.

```
● HttpRequestHandler › … › upstream abort fired during fetch cascades to the fetch controller
  thrown: "Exceeded timeout of 5000 ms for a test."
  src/nodes/integration/http-request/http-request.handler.spec.ts:1674
```

**실측 (2026-08-09)**:

| 환경 | 결과 |
|---|---|
| CI (ubuntu-latest, node 24) — 2회 | **실패**, 매번 같은 테스트·같은 타임아웃 |
| 로컬 node 24, 그 스펙 단독 | 통과 (74/74) |
| 로컬 node 24, 전체 스위트 `--maxWorkers=2`(CI 와 동일) | 통과 (417 suites / 8493) |

**flake 가 아니다** — CI 에서 2회 연속 결정적으로 실패한다. 그런데 node 버전·worker 수를
맞춰도 로컬에서 재현되지 않으므로, 남은 차이는 **러너의 CPU 속도·경합**이다.

그 테스트의 동기화 수단은 `setTimeout(() => upstream.abort(), 10)` 하나이고 전체가 jest
기본 5000ms 안에 끝나야 한다. 400+ 스위트를 2코어에서 돌리는 러너에서 워커가 멈추면
넘긴다 — 정황은 그쪽을 가리키지만 **재현으로 확정하지는 못했다.**

- [x] **원인 확정 (2026-08-09) — 타이머 기아도, 프로덕션 결함도 아니다. mock 이
      실제 `fetch` 를 안 따랐다.**

      핸들러는 fetch 전에 `assertSafeOutboundHostResolved` 로 **실제 DNS 조회**를 await
      한다(DNS rebinding 방어). 테스트는 `setTimeout(() => upstream.abort(), 10)` 로
      abort 를 쏘는데, DNS 가 10ms 보다 오래 걸리면 **fetch 가 이미 aborted 인 signal 을
      받는다.** 그런데 그 mock 은 `addEventListener('abort', …)` **만** 달았고, 이미
      abort 된 signal 의 리스너는 다시 발화하지 않는다 → promise 가 영원히 pending →
      jest 5000ms 타임아웃.

      **로컬 실증**: abort 를 즉시 발화시키면(무수정 프로브) 같은 실패가 재현된다.
      바로 옆 테스트(`already-aborted upstream signal …`)의 mock 은 **무조건 reject**
      해서 통과하고 있었다 — 그 대비가 결정적이었다.

      **프로덕션 코드는 정상이다** — 진짜 `fetch` 는 이미 aborted 인 signal 에 대해
      곧바로 `AbortError` 로 reject 한다. 취소 경로(`node-cancellation.md` §parallel-p2
      A+H)에 버그가 있는 것이 아니다.
- [x] 처분 — **mock 이 실제 `fetch` 동작을 따르게** 고쳤다(`aborted` 면 즉시 reject).
      타임아웃 상향은 하지 않았다 — 증상 덮기이고, DNS 가 더 느려지면 다시 깨진다.
      수정 후 같은 프로브로 재확인: **통과**(타이밍 무관해짐).
- [x] `backend unit` required check 등록 보류 사유 — **해소됨**. 위 1건이 유일한
      실패였고 원인이 확정·수정됐다.
- [x] **잔재 제거 (2026-08-09, `backend-hygiene-followups`)** — 위 fix 가 mock 을 고치면서
      옛 스캐폴딩을 남겼다. `fetchPromise` 는 선언 후 `_reject?.()` **한 줄에서만** 참조되는데
      `Promise` 에 `_reject` 속성이 없어 optional-call 이 매번 no-op 이고, mock 이 실제로
      반환하는 것은 별개의 새 Promise 다 — 즉 그 블록(`new Promise(() => {})` + `abort`
      리스너)은 아무것도 하지 않는다. 전수 grep 으로 참조 2곳뿐임을 확인하고 삭제했다.
      죽은 채로 두면 "abort 처리가 저기서 일어난다" 는 오독을 남긴다.

## 후속 (타입체크 갭 PR 밖)

> 타입체크 갭 PR: [#1109](https://github.com/worker-ants/clemvion/pull/1109)

- [x] `deleteByPrefix` 가드의 **존재 근거를 실행 가능한 테스트로** 고정 (ai-review INFO 7).
      지금 in-memory mock 은 `startsWith` 라 LIKE 와일드카드 의미론을 재현하지 않는다 —
      "가드가 없으면 실제 Postgres 가 과다삭제한다" 는 주석으로만 서 있다. 재현하려면
      mock 에 LIKE 해석기를 넣거나(테스트가 DB 를 흉내 내다 틀릴 위험을 새로 만든다) e2e 를
      추가해야 해서 그 PR 범위를 넘겼다.
      > **처리 (2026-08-09, `backend-hygiene-followups`) — e2e 를 골랐다.** LIKE 해석기는
      > "내가 구현한 LIKE" 에 대한 확신만 주므로, 흉내 내지 않고 **실 Postgres 에 같은 형태의
      > 쿼리를 던진다**(`test/secret-store-like-prefix.e2e-spec.ts`, 3건).
      > `_` 를 섞은 패턴이 이웃 리소스까지 지우는 것을 **의도 0건 vs 실제 2건**으로 고정했고,
      > 메타문자 없는 prefix 는 순수 접두사 일치(1건)라는 대조군을 함께 뒀다. 다른 스펙의
      > row 를 건드리지 않도록 전 ref 를 unique 네임스페이스에 가뒀다.
      > **위험이 실재하는 이유도 적었다** — `V063__secret_store.sql` 의 CHECK 는 resourceId 를
      > `[^/]+` 로만 제한해 `_`·`%` 를 허용한다. 즉 "prefix 에 메타문자가 없다" 는 성질은
      > DB 가 아니라 애플리케이션 가드만이 세운다.
      >
      > **e2e 만으로는 부족해 단위에 연결점을 뒀다.** 서비스는 러너 프로세스 밖이라 e2e 가
      > 직접 호출할 수 없어, 쿼리가 `LIKE` 이고 바인딩이 `<prefix>%` 이며 `ESCAPE` 절이
      > 없다는 사실을 단위에서 단언한다. 뮤테이션 실측: `LIKE`→`ILIKE` **1 RED** ·
      > 트레일링 `%` 제거 **1 RED**(둘 다 신규 단언만 — **기존 테스트는 전부 GREEN** 이라
      > 커버리지가 실제로 늘었다는 증거).
      >
      > **여기서 한 번 틀렸다 — 기록해 둔다.** mock 에 "가드가 사라지면 조용히 적게 지우지
      > 않고 throw" 하는 자기-전제 단언을 넣었는데, 에러 문구에 `메타문자` 를 써서 기존
      > `rejects.toThrow(/메타문자/)` 4건이 **그 throw 로 그대로 충족**됐다 → 가드 제거
      > 뮤턴트가 **47/47 GREEN**. 닫으려던 침묵을 같은 자리에 다시 만든 셈이다. 문구를
      > `LIKE 와일드카드` 로 갈라 재실측 **4 RED**. mock 이 프로덕션 가드와 같은 어휘를 쓰면
      > 단언이 어느 쪽을 검증하는지 구별할 수 없다는 것이 교훈이라 주석에도 남겼다.
- [x] **`changes` 잡 추출 — 완료 (2026-08-09, 다음 PR 로 즉시 집행)**
      (ai-review INFO 4 · `--impl-done` WARNING). `_changed-paths.yml` 신설, 세 워크플로가
      `uses:` 로 호출.
      [`ci-required-check-skip-jobs.md`](../complete/ci-required-check-skip-jobs.md) 이 "**3번째** 전환
      시점" 을 트리거로 확정해 뒀고 `backend-checks.yml` 이 그 세 번째다. 처음엔 여기 "4번째"
      라고 적었는데 **근거 없이 트리거를 미룬 것**이라 정정했다(실측: `CONVERTED` 3건).
- [x] **셋업 보일러플레이트(checkout·pnpm·setup-node·install) 추출은 별도** — **완료 (2026-08-09, [#1120](https://github.com/worker-ants/clemvion/pull/1120))**
      위 추출은 `changes` 잡만 가져갔다. 셋업은 잡마다 필요한 도구가 달라(python 유무,
      캐시 키) composite action 쪽이 맞는데, 그 판단은 4번째 워크플로가 어떤 셋업을
      요구하는지 보고 하는 편이 낫다. **범위를 쪼개 남긴다** (ai-review WARNING #1).

      > **트리거 도달 + 실측 (2026-08-09,
      > [`ci-required-check-skip-jobs.md`](../complete/ci-required-check-skip-jobs.md) 나머지 5개 전환).**
      > 전환 완료 시점 8워크플로 / 실잡 14개(`changes` 제외)를 셋업 형태로 분류한 결과:
      >
      > | 셋업 형태 | 잡 수 |
      > |---|---|
      > | `checkout` + `pnpm` + `setup-node(cache)` + `pnpm install --filter` | **8** |
      > | 위 + `setup-python` (backend `typecheck-ratchet`) | 1 |
      > | 나머지(python-only · pip · 캐시 없는 node · `fetch-depth: 0`) | 5 |
      >
      > **위에 적어 둔 "잡마다 도구가 달라" 는 절반이 반증됐다** — 8개는 `--filter` 인자
      > 하나만 다른 바이트 동일 형태다(frontend · backend lint · backend unit · packages ·
      > web-chat 3잡 · spec-link). 발산하는 것은 나머지 5개뿐이다. 즉 **추출은 정당하다.**
      >
      > 그럼에도 그 전환 PR 에 넣지 않은 이유는 난이도가 아니라 **축**이다 — 그 PR 이
      > 건드리지 않는 워크플로 3개(frontend · backend · deps)를 함께 고쳐야 하고, 깨지면
      > required check 후보 8개가 한꺼번에 죽는다. `#1111` 이 `changes` 추출을 트리거 직후
      > **별 PR** 로 집행한 것과 같은 형태로 남긴다. 남은 것은 착수뿐이고 실측은 끝났다.
      >
      > 유의점 하나: 로컬 composite action 은 `uses: ./.github/actions/<name>` 이라
      > **checkout 이 먼저 돌아야 한다** — 접히는 것은 4단계가 아니라 뒤 3단계다.

      > **집행 (2026-08-09)** — `.github/actions/pnpm-workspace/action.yml` 신설, 9개 잡이
      > `uses:` 로 호출한다(바이트 동일 8 + backend `typecheck-ratchet`). 워크플로 순 **-41줄**,
      > 게이팅 조건 반복 **57 → 39곳**. 예측대로 checkout 은 접히지 않아 호출부에
      > `checkout` + 액션 호출 2스텝이 남는다.
      >
      > 진짜 위험은 줄 수가 아니라 **가드 시야**였다 — 스텝 3개가 `.github/workflows/*.yml`
      > 밖으로 나가면서 `test_workflow_yaml_structure.py` 의 구조 검사(2026-08-01 중복 `run:`
      > 사고를 잡는 그 검사)가 그것들을 못 보게 됐다. 검사 범위를
      > `.github/actions/**/action.yml` 까지 넓히고, 액션 자체는
      > `test_pnpm_workspace_action.py` 로 통째로 고정했다(실행 검증 포함).
- [x] `spec/conventions/secret-store.md §2.1` 호출 규약 표에 `deleteByPrefix` 의 새 invariant
      각주 (ai-review INFO 11) — **planner 권한**. 내부 전용 계약이라 spec 충돌은 없다.
      **완료 (2026-08-09, planner 턴)** — "Trigger 삭제" 행에 prefix 불변식 2건(`secret://`
      접두사 · LIKE 메타문자 `%`·`_`·`\` throw)을 명시하고, 표 아래 각주 †에 근거를 적었다:
      과다삭제 위험 · **이스케이프가 아니라 거부인 이유**(§1 URI Scheme 구조상 메타문자가
      정당하게 필요한 경우가 없다) · "지금은 안전하다" 를 주석으로만 두지 않은 이유(안전이
      호출부 목록에 의존한다).
      각주에 바로 위 항목(**LIKE 의미론 미재현 mock**)을 **알려진 검증 공백**으로 함께 적었다 —
      그 항목이 미해소인 동안 이 각주가 유일한 기록이다. 링크가 아니라 서술로 적었다:
      `spec/**` → `plan/in-progress/**` 링크는 그 plan 이 `complete/` 로 이동할 때
      `spec-link-integrity` 를 깨뜨린다.
- [x] **`secret-store.md §2.1` 각주의 "알려진 검증 공백" 문단 철회** — **planner 권한**.
      바로 위 항목(`#1112`, 20:30 머지)이 그 문단을 쓴 시점과 바로 위의 검증 공백 항목을
      해소한 시점(`backend-hygiene-followups`, 같은 날 저녁)이 **병렬 세션이라 겹쳤다.**
      두 세션이 같은 항목의 양쪽 끝을 동시에 잡은 결과이며, 머지 순서상 각주 쪽이 먼저
      들어가 있다. 지금 그 문단은 **거짓**이다:
      > "…아직 실행 가능한 테스트로 고정돼 있지 않고 본 각주가 유일한 기록이다. 재현하려면
      > mock 에 LIKE 해석기를 넣거나 … e2e 를 추가해야 한다."
      실제로는 **e2e 를 추가하는 쪽을 골랐고**(`test/secret-store-like-prefix.e2e-spec.ts`,
      3건) 단위에 연결점 단언까지 뒀다. 각주가 스스로 "유일한 기록" 이라고 선언한 만큼
      방치하면 다음 사람이 없는 공백을 다시 메우려 든다.
      대체 문구는 "e2e 가 실 Postgres 로 와일드카드 의미론을 고정하고, 단위가 쿼리 형태
      (`ref LIKE :prefix` · `<prefix>%` · ESCAPE 없음)를 고정한다" 정도면 충분하다.
      > **완료 (2026-08-09, planner 턴 `spec-secret-store-footnote-retract`).** 위 초안대로
      > 두 층(e2e = 와일드카드 의미론 / 단위 = 쿼리 형태)으로 갈라 적었다.
      > **"공백이었으나 해소됐다" 로 쓰지 않았다** — `project-planner` §5 의 "옛 내용을 정리해
      > latest 만 남김(history 가 아님)" 을 따른다. 이력이 각주에 누적되면 읽는 사람이 "지금
      > 무엇이 참인가" 를 판정하려고 역추적해야 한다. 병렬 세션 경위는 draft·커밋에만 남겼다.
      > **`mock 에 LIKE 해석기` 기각 근거는 보존**했다 — 더 간단해 보여 재도입 압력이 있는
      > 대안이라, 근거를 지우면 다음 사람이 같은 선택을 다시 검토한다.
      > `code:` 글로브는 넓히지 않았다(근거는 draft §Rationale — 넓히면 그 e2e 를 만지는
      > 모든 PR 이 `--impl-done` 을 요구받는다).
- [ ] LIKE 메타문자 정규식(`/[%_\\]/`)을 프로덕션 가드와 단위 mock 이 **공유 상수**로 쓰도록
      추출 검토 (`backend-hygiene-followups` ai-review INFO 5). 지금은 두 소스에 같은 패턴이
      따로 선언돼 있어 허용 문자 집합이 바뀌면 mock 이 조용히 stale 해질 수 있다.
      > **다만 공유가 자명하게 옳지는 않다** — mock 의 정규식은 "이 mock 이 `startsWith` 로
      > 모사할 수 있는 입력인가" 라는 **다른 질문**이고, 우연히 지금 같은 집합일 뿐이다.
      > 상수를 공유하면 mock 이 가드의 복제본을 검사하게 되어, 캐너리가 reflection 을 다시
      > 구현하면 안 되는 것(`workspace-reflection-canary.ts` §판별)과 같은 함정에 빠진다.
      > 그래서 "허용 집합을 실제로 바꿀 때" 를 트리거로 남긴다 — 그때 두 질문이 여전히
      > 같은 답인지 보고 판단한다.
- [x] 남은 backend lint warning (본 plan §잔여) — **ratchet 이 아니라 전량 처분**을 골랐다
      (사용자 결정 2026-08-12). `codebase/backend/package.json` 의 `lint` 스크립트에
      `--max-warnings 0` 을 걸어 바닥이 아니라 **0** 을 고정했다.

      **수치 정정: 47 → 실측 46.** 위 §잔여 절의 47 은 `#1104` 직후(2026-08-09) 값이고,
      착수 시점 실측은 46 이다(직전 세션이 `pnpm install` 후 잰 값 — 낡은 `node_modules` 는
      존재하지 않는 `prettier/prettier` 119건을 만들어 낸다. 그 세션이 21 로 줄인 뒤 내가
      독립적으로 잰 21 과 정합한다).

      > **왜 ratchet 이 아닌가 — 전수 조사가 전제를 뒤집었다.** ratchet 이 사는 이유는
      > "지금 처분할 수 없는 잔여를 수용하면서 바닥은 닫는다" 인데, 46건을 전부 열어 보니
      > **처분할 수 없는 자리가 하나도 없었다.** 전부 라이브러리 경계에서 `any` 가 새는
      > 자리였고 수정이 타입 주석·제네릭 인자·단언뿐이라 **런타임을 건드리지 않는다.** 타입을
      > 지어내야 하는 자리도, 억제(`eslint-disable`)가 필요한 자리도 없었다. 그러면
      > baseline 파일도 매직 넘버도 필요 없어지고, ratchet 은 유지비만 남는다.

      > **"런타임 미접촉" 을 마지막 21건에서도 실측했다 — 그리고 한 칸 좁혀 적는다.**
      > 전체 `ts.Program`(실 tsconfig, `emitDecoratorMetadata` 포함)으로 before/after 를
      > emit 해 md5 를 비교한 결과 **7파일 중 5개 동일**, 나머지 둘은 **괄호 한 쌍**만
      > 다르다(dispatcher 의 `const logFn = (cond ? a : b)`, dto 의 화살표 concise body).
      > 의미는 같지만 **"emit 이 바이트 동일" 은 이 둘에서 거짓**이므로 그대로 쓰지 않는다.
      > 정확한 진술은 **"타입 소거만 일어났고 남은 차이는 괄호로 의미 동등"** 이다.
      > `emitDecoratorMetadata` 가 켜져 있어 DTO 가 유일한 실질 위험이었는데
      > `__metadata("design:type", String)` 은 불변이었다 — 데코레이터 메타데이터는 안 움직였다.
      >
      > **위 §잔여 표의 성격 분류는 두 자리가 틀렸다.** `render-tool-provider.ts` 6건을
      > "정당한 unsafe → 억제 + 근거" 로 미리 분류해 뒀지만 실제 원인은
      > **`Array.isArray(x)` 가 `unknown` 을 `unknown[]` 이 아니라 `any[]` 로 좁히는 TS 특성**
      > 이라 원소를 `unknown` 으로 받으면 그냥 사라진다(`ai-agent.schema.ts` 1건도 같은 원인).
      > `src/scripts/migrate-node-output-refs.ts` 17건도 "일회성 스크립트" 라 적혀 있었지만
      > 콜백 인자 타입만으로 닫혔다. **열어보지 않고 적은 분류가 착수 판단을 왜곡한다.**

      > **인계 노트가 제시한 수정 방향도 두 자리에서 틀렸다 — 실측으로 갈렸다.**
      > `logFn`(dispatcher)·`oldest`(executions) 는 "변수에 타입을 주면 된다" 로 인계됐고
      > 그대로 해 봤지만 두 건이 **그대로 남았다.** `no-unsafe-assignment` 는 LHS 선언 타입이
      > 아니라 **RHS 가 `any` 인 것**을 보기 때문이다(대신 downstream `no-unsafe-call`·
      > `no-unsafe-argument` 는 그 시점에 사라졌다 — 부분 효과가 있어 더 헷갈린다).
      > 단언으로 바꿔 처분했다. 규칙이 무엇을 보는지 확인하지 않고 "주석을 붙이면 된다" 로
      > 넘기면 warning 이 남은 채 게이트만 거는 결과가 된다.

      마지막 21건(7파일)의 원인과 조치:

      | 위치 | 건수 | 원인 | 조치 |
      |---|---|---|---|
      | `idempotency.interceptor.ts` | 8 | `getResponse<T = any>()` 제네릭 미지정 | 구조적 타입 `HttpResponseLike` 주입 |
      | `render-tool-provider.ts` | 6 | `Array.isArray` → `any[]` 좁힘 | 콜백 원소 `unknown` 명시 |
      | `chat-channel.dispatcher.ts` | 2 | `strictBindCallApply: false` + 오버로드 → `.bind` 가 `any` | 단언으로 형태 복원 |
      | `executions.service.ts` | 2 | `BuiltinIteratorReturn`(=`any`) → `.value` 가 `any` | 단언 `string \| undefined` |
      | `ai-agent.schema.ts` | 1 | `Array.isArray` → `any[]` 좁힘 | 원소 `unknown` 명시 |
      | `chat-channel-config.dto.ts` | 1 | `TransformFnParams.value` 가 `any` | 구조분해 파라미터에 타입 |
      | `workspace-reflection-canary.ts` | 1 | `no-unnecessary-type-assertion` | `as object` 삭제 |

      > `idempotency.interceptor.ts` 에 express `Response` 를 **박지 않은** 이유를 코드 주석과
      > 함께 남긴다 — 그러면 코드가 이미 하고 있는 `typeof res.status === 'function'` /
      > `typeof res.statusCode === 'number'` 방어가 정적으로 항상 참이 되어 **죽은 코드**가
      > 된다. 어댑터·테스트 mock 을 가리지 않는 자리라 방어가 살아 있어야 한다.
      >
      > 캐너리의 `as object` 삭제는 **가드가 여전히 자기 대상을 잡는지** 확인하고 했다 —
      > `workspace-reflection-canary.spec.ts` 의 fail-closed 단언(인식 0건이면 throw) 포함
      > 전량 통과. `cls` 는 바로 위 `typeof cls !== 'function'` 로 이미 `Function` 이고
      > 그건 `handlerConsumesWorkspaceId(controllerClass: object, …)` 에 그대로 배정된다.
      >
      > **통과만으로는 부족해 두 갈래로 확인했다** — 가드 캐너리라 "테스트가 초록" 은 증거로
      > 약하다. (1) 이 파일의 emit md5 가 **before/after 동일**이라 런타임이 바뀔 수 없고,
      > (2) 양성 검출 테스트가 **실제 `@WorkspaceId()` 데코레이터를 mock 없이** 돌려
      > `toBe(2)` 를 단언한다 — 즉 "0건이면 throw" 라는 음성 방향뿐 아니라 **소비 라우트를
      > 실제로 세는 능력**이 살아 있음을 직접 고정한다. 캐너리가 자기 대상을 못 잡게 되는
      > 파손은 이 단언에서 먼저 드러난다.

      **`--max-warnings 0` 을 CI 워크플로가 아니라 `package.json` 에 넣은 이유**: CI
      (`backend-checks.yml:95`)가 `pnpm --filter backend lint` 를 그대로 호출하므로 로컬과 CI 가
      **같은 게이트 한 벌**을 쓴다. 이 저장소는 "로컬에서 backend eslint 를 안 돌려 CI 가 터진"
      사고를 이미 겪었다.

      > **게이트를 양방향으로 실측했다** — 걸어 놓고 안 걸리는 것이 이 저장소의 반복 실패다.
      > `ai-agent.schema.ts` 의 `const tool: unknown` 에서 `: unknown` 만 떼어 warning 하나를
      > 되살리고 `pnpm --filter backend lint` → **exit 1**
      > (`✖ 1 problem (0 errors, 1 warning)` + `ESLint found too many warnings (maximum: 0)`).
      > 되돌린 뒤 → **exit 0**. **0 errors / 1 warning 에서 exit 1** 이라는 점이 핵심이다 —
      > `--max-warnings 0` 이전이라면 정확히 같은 상태가 exit 0 이었다.
      > 뮤테이션은 커밋 뒤에 넣고 커밋에서 되돌렸다(미커밋 작업을 지우지 않기 위해).
      >
      > **프로브 유효성 선검증은 생략하지 말 것** — 직전 세션은 첫 프로브로 `any` → `unknown`
      > 반환을 심었는데 `no-unsafe-return` 이 그것을 애초에 허용해 **아무 warning 도 안 났다.**
      > 프로브가 진짜 warning 을 내는지 먼저 확인하지 않으면 게이트 검증 자체가 vacuous 해진다.

      검증: eslint **errors 0 / warnings 0** · 타입체크 ratchet **199건 / 38파일 baseline 일치**
      (증감 0 — 타입을 깬 자리 없음) · backend unit **418 suites / 8512 passed**.
- [ ] **선재 테스트 공백 2건** (`12_05_39` testing INFO 1·2, 이번 라운드 유예). 둘 다 이번
      diff 가 *타입만* 바꾼 자리라 조치 대상이 아니었지만, 공백 자체는 실재한다:
      - `chat-channel.dispatcher.ts:192-201` — `logFn` 의 debug/warn 삼항 분기가
        `.handle()` 경유 스펙에서 도달 불가. standalone 함수 테스트만 존재한다.
      - `executions.service.ts:192-199` — `snapshotCache` evict(256건 한도) 테스트 전무.
        경계값(256회 삽입)으로 evict 1건·최오래된 키 삭제를 고정할 수 있다.
      > 이번 라운드에 `idempotency.interceptor.ts` 의 같은 클래스 공백은 **메웠다** — 그쪽은
      > diff 가 신설한 방어(`HttpResponseLike` optional)를 지탱하는 테스트가 없어서 주석이
      > 주장만 하는 상태였기 때문이다. 위 둘은 diff 가 방어를 신설하지 않았으므로 성격이 다르다.
      >
      > **여기 처음 "캐시 히트 경로 **전체**를 메웠다" 고 적었는데 과했다** (`12_24_14`
      > testing WARNING). 손상된 캐시 JSON 의 `catch` 분기는 히트 경로의 갈래인데 안 덮고
      > 있었다. 다음 라운드에서 그 테스트를 추가하고 이 문구를 좁혔다. 이 저장소가 반복해
      > 데인 "문서한 보장이 구현보다 넓다" 와 같은 형태다 — **"전체"·"전부" 를 쓸 때는 안
      > 덮은 갈래를 먼저 세어야 한다.**
- [x] **planner 인계 — `spec/data-flow/15-external-interaction.md` 의 R8 요약이 SoT 보다 넓다**
      (`--impl-done` `13_07_33` cross_spec·rationale_continuity WARNING, **BLOCK: NO**).
      data-flow 문서가 §1.2 시퀀스와 §2.1/§2.2 표에서 "4xx 캐시 제외" 로 요약하는데, SoT 인
      [`spec/5-system/14-external-interaction-api.md`](../../spec/5-system/14-external-interaction-api.md) §R8 은 "`400 VALIDATION_ERROR` 만 제외, 2xx·409·410 은
      캐시" 다. **선재 불일치**이고, 이번 PR 은 같은 gap 을 코드·테스트에 캐너리로 고정만 했다.
      > **`spec/` 쓰기는 developer 권한 밖**(CLAUDE.md §Skill 체계)이라 여기 인계로 남긴다.
      > checker 도 "planner 턴 권장, 이번 lint-only PR 스코프 밖" 으로 판정했다.
      > 정정 시 바로 아래 두 항목(구현의 `>= 400` 선재 결함)과 **함께** 보는 편이 낫다 —
      > 문서를 SoT 에 맞추면 구현과의 갭이 드러나므로 둘이 같은 결정의 양면이다.
- [x] **`IdempotencyInterceptor` 의 "fail-open" 주장이 런타임 reject 를 안 덮는다** (`12_55_52`
      requirement/security INFO 3). 클래스 docstring 은 "Redis 미가용 시 fail-open + warn 로그"
      라고 적었는데, 그 보장은 **생성자 시점 null 체크**(`getClientOrNull()` → null → passthrough)
      에만 해당한다. `intercept()` 의 `from(this.redis.get(redisKey))` 가 **런타임에 reject**
      하면(연결 끊김·타임아웃) Observable 이 그대로 error 를 흘려 요청 자체가 실패한다 —
      fail-open 이 아니라 fail-closed 다.
      > 즉 **문서한 보장이 구현보다 넓은** 또 한 사례다(이 브랜치에서만 3번째 형태).
      > 조치는 둘 중 하나: `catchError` 로 실제 fail-open 을 만들거나, docstring 을 "생성자
      > 시점 미가용에 한정" 으로 좁히거나. **어느 쪽이 맞는지는 EIA spec 의 가용성 요구에
      > 달렸으므로 확인이 먼저다.** 이 PR(타입 전용)에서는 런타임을 건드리지 않는다.

      > **처리 완료 (2026-08-12, `eia-idempotency-fixes`) — 확인해 보니 "둘 중 하나" 가
      > 아니었다.** `spec/data-flow/15-external-interaction.md` 가 이미 **fail-open 을 명시적으로
      > 요구**한다: "Redis | 내부 | blacklist · idempotency · seq · BullMQ. **전 경로 fail-open
      > (warn) — 가용성 우선**" (§외부 의존), "토큰 blacklist·**idempotency**·jti 추적·notification
      > enqueue 모두 Redis/DB 미가용 시 **fail-open**". 즉 docstring 을 좁히는 선택지는 애초에
      > 없었고 **문서 갭이 아니라 구현 결함**이었다. `catchError` 를 넣어 닫았다.
      >
      > **무수정 프로브로 먼저 실증**했다 — `get()` 을 reject 시키니
      > `FAIL-CLOSED — 요청 실패: ECONNRESET`. Redis 가 런타임에 죽으면 external interaction
      > API 가 500 을 뱉는 상태였다(멱등성은 부가 기능인데 그것 때문에 API 가 죽는다).
      >
      > **`catchError` 위치가 이 fix 의 진짜 위험**이라 캐너리로 고정했다. `switchMap` **뒤**에
      > 두면 캐시 충돌 시 던지는 `ConflictException`(정상 동작)까지 삼켜 **멱등성 검출이 조용히
      > 죽는다.** 뮤테이션 실측: 뒤로 옮기면 **4건 RED** — 신규 3건 + **기존 409 테스트**.
      > 기존 테스트가 함께 터지는 것이 이 위험이 실재한다는 증거다.
- [x] **planner 인계 — spec 의 fail-open 잔여 위험 카탈로그에 idempotency 예시 추가**
      (`--impl-done` `15_24_11` rationale_continuity INFO 1, **BLOCK: NO**). 코드 주석은
      "Redis 장애 지속 시 중복 억제가 사실상 무력화 → 다운스트림 중복 실행 가능" 까지 적었는데,
      [`spec/data-flow/15-external-interaction.md`](../../spec/data-flow/15-external-interaction.md) `## Rationale` 의 "Fail-open 정책의 일관 표기" 절은
      **blacklist 미적용 예시만** 들고 있어 두 위험 목록의 정밀도가 벌어졌다.
      > 그 절에 idempotency 저하 예시를 blacklist 예시와 나란히 두거나,
      > `spec/5-system/14-external-interaction-api.md` §3.4 의 `EIA-RL-02` 행에 각주를 단다.
      > **`spec/` 쓰기는 developer 권한 밖**이라 인계로 남긴다. checker 도 "선택, 필수 아님".
- [ ] **idempotency fail-open 구간의 관측·중복 억제** (`14_27_02` concurrency WARNING).
      Redis 장애가 지속되는 동안 같은 `Idempotency-Key` 재요청이 전부 캐시 미스로 판정돼
      다운스트림이 중복 실행될 수 있다 — spec 이 택한 "가용성 우선" 트레이드오프라 되돌리지
      않았고 대가는 docstring·CHANGELOG 에 명시했지만, **운영이 그 구간을 인지할 수단이 없다.**
      - Redis GET 실패율 지표/알람 추가 검토
      - GET→SET 비원자 구조(선재)를 `SET NX EX` 선점 또는 in-flight dedup 으로 좁힐지 검토
        (`14_27_02` concurrency INFO 7) — 정상 시에도 좁은 창이 있다
- [x] **`Idempotency-Key` e2e 부재** (`16_29_45` testing CRITICAL 의 후속 권고).
      `external-interaction.e2e-spec.ts` 에 `Idempotency-Key` 헤더를 쓰는 테스트가 **0건**이라,
      인터셉터가 실제 Nest 파이프라인(예외 필터·`@HttpCode`·직렬화)에서 어떻게 도는지 검증되지
      않는다. 이번 CRITICAL 도 단위 mock 이 실제 채널을 반영하지 못해 생긴 것이라, **같은
      클래스의 결함을 다시 놓치지 않으려면 e2e 가 맞는 층위**다.
      - 같은 키로 `409`/`410` 을 두 번 요청해 두 번째가 캐시 재현(같은 상태코드·body)인지
      - `400 VALIDATION_ERROR` 재제출이 정상 처리되는지(캐시되지 않았는지)

      > **완료 (2026-08-12, 사용자 결정으로 단위 리뷰 루프를 끊고 이 층위로 이동).**
      > `IDEM-1`(409 캐시 적재·재현) · `IDEM-2`(400 미적재) · `IDEM-3`(410 — `18_07_36` 에서
      > 자매 자리 누락으로 지적돼 추가) 3건. 뮤테이션 실측으로 판별력 확인:
      > 예외 경로 적재를 제거하면 **I-1 이 RED**(`1 failed / 265 passed`, exit 2), 정상 구현에서
      > **266 passed**.
      >
      > **첫 e2e 는 판별력이 없었다 — 이게 이 항목의 진짜 교훈이다.** 처음엔 "재요청 전에
      > nodeId 를 유효하게 바꿔 캐시가 없으면 202 가 나오게" 갈랐는데, 뮤턴트에서 **그대로
      > 통과**했다. 상태코드는 두 구현에서 같은 값이라 애초에 정보가 없었던 것이다.
      > **e2e 라는 층위 자체가 안전을 보장하지 않는다** — 무엇을 관측하느냐가 결정한다.
      > `interaction:idempotency:<key>` **엔트리를 직접 조회**하도록 바꾸고서야 갈렸다.
      >
      > 단위 mock 이 네 라운드 연속 놓친 결함 클래스(`mock 이 만드는 상태 ≠ 시스템이 실제로
      > 만드는 상태`)를 이제 이 e2e 가 실 파이프라인에서 잡는다.
- [x] **idempotency 캐시 키가 execution/인증 컨텍스트로 스코프되지 않는다** (`16_29_45`~
      `19_04_29` security, **5개 라운드 반복 지적**). `redisKey` 는
      `interaction:idempotency:${rawKey}` 로 **`Idempotency-Key` 헤더 값에만** 바인딩된다.
      서로 다른 execution 에 대해 같은 키 + 같은 body(→ 같은 `bodyHash`)를 쓰면 한쪽의 캐시된
      응답이 다른 요청자에게 재생될 수 있다.
      > **이번 PR 로 위험의 성격이 바뀌었다** — 종전에는 409/410 캐싱이 dead code 라 이론상
      > 서술이었지만, 이제 실제 발동 경로다. `InteractionGuard` 가 인터셉터보다 먼저 돌아
      > 인증 우회는 없고 현재 payload 는 고정 코드/enum 뿐이라 즉시 위험은 낮지만,
      > **표면 자체가 넓어졌다.**
      >
      > 조치 방향: `redisKey` 에 `executionId`(가드 검증 후 신뢰 가능한 값) 를 포함 —
      > `interaction:idempotency:${executionId}:${route}:${rawKey}` (**3 세그먼트**).
      >
      > **"인증 scope 식별자" 로 읽으면 안 된다** — jti·토큰 식별자로 스코프하면
      > `/refresh-token` 으로 토큰이 회전한 뒤의 재시도가 다른 키로 떨어져 `EIA-RL-02` 가
      > 보장하려는 바로 그 시나리오를 깬다. 스코프 단위는 토큰이 아니라 execution 이다.
      >
      > **축이 하나 더 있다 (`<route>`)** — 같은 인터셉터가 `interact` 와 `cancel` 두 자리에
      > 붙어 있는데 `CancelDto` 는 전 필드 optional 이라 body `{}` 가 가능하고, 그때
      > `bodyHash` 가 `{}` 인 interact 요청과 일치해 cancel 의 ack 가 interact 에 재생된다.
      > 원 지적(execution 축) 밖이지만 같은 결함 클래스라 함께 닫는다.
      >
      > **선행 spec 해소 (2026-08-12, planner 턴 `eia-idempotency-key-scope`, #1156)** — 키 형식은
      > `spec/data-flow/15` 3자리에 박혀 있고 `EIA-IN-11`·`EIA-RL-02` 두 행이 "동일 키" 라고만
      > 적어 **전역 유일성을 암시**했다. §R8 Rationale 에 "캐시 키 스코프" 문단(두 축 · 토큰이
      > 아닌 이유 · ctx 부재 시 캐시 skip)을 추가하고 세 자리를 3-세그먼트로 고쳤다.
      > draft: [`spec-draft-eia-idempotency-key-scope.md`](../complete/spec-draft-eia-idempotency-key-scope.md)

      > **완료 (2026-08-12, developer 턴 `eia-r8-cache-scope-4ae434`).**
      > `interaction:idempotency:${executionId}:${route}:${rawKey}` 로 착지. `executionId` 는
      > `req.interaction` (Guard 가 토큰 검증 후 합성 — 클라이언트 조작 불가), `route` 는
      > `context.getHandler().name`. ctx 부재 시 **전역 키 fallback 없이 캐시 skip**(warn).
      >
      > **뮤테이션으로 판별력을 실측했다** — 단위 5개 뮤턴트(전역 회귀 · route 만 제거 ·
      > execution 만 제거 · ctx skip 제거 · **GET 은 스코프인데 SET 만 전역**) 전부 사살.
      > e2e 는 스코프 통째 제거 뮤턴트에서 `IDEM-4`(`Expected 202 / Received 410` — B 가 A 의
      > 응답 수신)와 `IDEM-5`(`Expected 400 / Received 410` — cancel 이 interact 의 캐시 수신)가
      > RED.
      >
      > ⚠️ **그 e2e 는 처음에 판별력이 없었다.** "상태코드로 갈리는 fixture" 라고 써 놓고
      > 뮤턴트가 **캐시 키 존재 단언(white-box)에서 먼저 죽어** 상태코드 단언에 도달하지 못했다.
      > 행동 단언을 앞으로 옮기고서야 위 값이 나왔다. **관측점을 옳게 골라도 단언 순서가
      > 앞에서 죽게 만들면 뒤의 단언은 없는 것과 같다** — RED 만 보고 넘어가면 이 상태를 못 본다.
      >
      > ⚠️ **이 항목은 `16_29_45`·`16_53_26`·`17_07_45`·`18_07_36`·`18_52_47` 다섯 라운드의
      > RESOLUTION 이 "plan 에 이미 등재됨" 이라고 반복 주장했지만 실제로는 한 번도 적히지
      > 않았다.** `19_04_29` security 가 plan 을 직접 grep 해 그 불일치를 잡았고, 그제서야
      > 여기 적힌다. 거짓 "기등재" 진술이 매 라운드 리뷰어의 유예 판단까지 오염시켰다 —
      > **처분표에 "이미 있다" 를 쓸 때는 그 자리에서 grep 해 확인할 것.**
- [x] **캐시 엔트리 손상 처리 전체가 불완전하다** (제목을 넓힌다 — `23_24_08` scope INFO 9 가
      "표제가 실제 변경보다 좁다" 고 지적했고 `23_48_38` INFO 10 이 **그 수용을 적어 놓고 실제로
      제목은 안 고쳤다**고 다시 잡았다. 좁은 제목이 재확인 비용을 만든다.) 원제:
      **캐시 엔트리 내부 `responseJson` 손상은 무방비** (`18_07_36` testing INFO 1 — **직전
      RESOLUTION 이 "plan 에 기록" 으로 처분해 놓고 실제로 안 적었다**, `18_37_45` WARNING 이
      그 불이행을 잡았다). `intercept()` 의 두 자리(`JSON.parse(cached.responseJson)` — 에러
      재현 분기와 정상 재현 분기)가 엔트리 **바깥** JSON 은 `try/catch` 로 막으면서 **안쪽**
      `responseJson` 이 깨진 경우는 그대로 throw 한다 → `GlobalExceptionFilter` 가 500 으로
      마스킹한다. 선재 갭이고 fail-closed 방향이라 급하지 않다.
      > 조치하려면 두 자리를 한 번만 파싱하도록 끌어올리고 그 자리에 방어를 두는 편이 낫다
      > (`JSON.parse` 중복은 4라운드 연속 유예된 maintainability 항목이기도 하다 — 한 번에 닫힌다).

      > **완료 (2026-08-12, `eia-idem-responsejson-guard`).** 적어 둔 대로 한 번만 파싱하고
      > 그 자리에 방어를 뒀다 — `JSON.parse` 중복도 함께 사라졌다. 손상 시 동작은 바깥 JSON 과
      > 같은 "무시하고 신규 처리" 이고, 두 자리 모두 이제 **warn 을 남긴다**(종전에는 바깥
      > 손상도 조용히 넘어갔다 — fail-open 은 "요청을 살린다 + 장애를 보이게 한다" 가 한 쌍).
      >
      > **후속 (2026-08-13, `23_48_38` testing WARNING) — 위 "완료" 는 절반이었다.**
      > `try/catch` 는 `JSON.parse` 의 **문법 오류만** 잡는다. `'null'`·`'42'`·`'[]'` 는 유효한
      > JSON 이라 통과한 뒤 필드 접근에서 깨지고, 그중 `'null'` 은 `TypeError` → **500** 이었다
      > — 이 항목이 없애려던 바로 그 형태가 좁은 틈으로 남아 있었다(무수정 프로브 실측:
      > `'null'`→TypeError / `'42'`·`'[]'`·`'"str"'`→409). `isIdempotencyEntry()` 타입 가드로
      > 닫았다.
      >
      > 가드 자체도 뮤테이션으로 두 번 갈았다 — 처음엔 `Array.isArray`·`typeof` 절이 **하중
      > 없이 생존**했고(필드 검사가 이미 배제), 세 필드 검사도 전부 생존했다. 후자의 원인은
      > 가드가 아니라 **fixture** 였다: 전부 여러 조건을 동시에 위반해 하나를 지워도 나머지가
      > 대신 잡았다. 조건을 하나씩만 위반하는 fixture 를 넣고 하중 없는 절을 걷어낸 뒤에야
      > 남은 절 전부가 각각 1건씩 죽는다.
      >
      > **파싱 순서가 계약이 됐다** — payload 파싱은 `bodyHash` 판정 **뒤**여야 한다. 앞에 두면
      > 손상된 엔트리에서 409 가 조용히 사라지고 두 번째 body 가 새 응답을 받는다. 순서를
      > 뒤집는 뮤턴트로 고정 확인.
      >
      > ⚠️ **그 순서 뮤턴트를 처음엔 무효로 만들었다.** 블록을 제거하고 재삽입했더니 주석만
      > 이동하고 코드 순서는 그대로여서 GREEN 이 나왔다 — 하마터면 "테스트가 순서를 못 잡는다"
      > 로 오판할 뻔했다. 인덱스 비교(`PARSE < CONFLICT`)로 **반전을 선검증**하고 나서야 의도한
      > 테스트가 죽었다. **뮤턴트의 GREEN 은 뮤턴트가 유효할 때만 정보다.**
- [ ] **`data-flow/15` 의 "전 경로 fail-open (warn)" 이 실제보다 한 칸 넓다** (`23_48_39`
      rationale_continuity INFO 1). L308 이 Redis 관련 전 경로에 warn 이 붙는 것처럼 뭉뚱그리는데,
      `IdempotencyInterceptor` 의 다섯 경로 중 **기동 시 미주입(생성자 `null`)은 warn 을 남기지
      않는다** — 그건 장애가 아니라 설정 상태다.
      > 이 부정확은 **선재**다(내 변경이 만든 것이 아니라, 코드 docstring 을 다섯 경로 표로
      > 정밀화하면서 드러났다). **`spec/` 쓰기는 developer 권한 밖**이라 planner 인계.
      >
      > 착수 시 **두 가지를 같은 스코프로** 처리한다 (`00_20_21` plan_coherence 부가 관찰):
      >
      > 1. "구성 미주입(기동 시 `null`)은 장애가 아니라 설정 상태 → warn 제외" 정정
      > 2. **프레이밍을 "미가용" 에서 "미가용 또는 손상" 으로 확장** — 캐시 엔트리/payload 손상은
      >    Redis 가 **가용한데 데이터가 오염된** 별개 실패 축이다. 현재 문서는 fail-open 을
      >    "Redis 미가용" 하나로만 프레이밍해 이 축을 담을 자리가 없다.
      >
      > 대상 자리: [`14-external-interaction-api.md`](../../spec/5-system/14-external-interaction-api.md) §R8 Rationale ·
      > [`data-flow/15`](../../spec/data-flow/15-external-interaction.md) §4 외부 의존 표 · 같은 문서 §Rationale "Fail-open 정책의 일관 표기"
- [ ] **`intercept()` 의 `switchMap` 콜백을 `resolveCacheHit()` 로 추출** — **내가 세운 트리거가
      실제로 발동했다.** `23_24_08`·`23_36_13` 두 라운드가 "6번째 분기가 추가되면 재검토" 로
      유예했는데, `00_20_20` maintainability INFO 4 가 **분기 7개**가 됐음을 셌다(캐시 미스 ·
      엔트리 문법 손상 · 엔트리 형태 불일치 · bodyHash 불일치 · payload 손상 · 에러 재현 ·
      성공 재현).
      > **조건부 유예를 조용히 연장하지 않기 위해 항목으로 꺼낸다.** 이 PR 안에서 하지 않는
      > 이유는 순수 구조 변경이라 리뷰 라운드를 한 번 더 요구하는데, 이번 PR 의 남은 발견이
      > 전부 문서·테스트 층위라 수렴 중이기 때문이다. 다음에 이 콜백을 만질 때 착수한다.
- [ ] **`readKey`/`hashBody` 경계값 테스트 부재** (`12_55_52` testing INFO 10) — 키 길이
      초과(`MAX_KEY_LENGTH` 200), 공백뿐인 키, non-string 헤더. 선재 갭이고 이 PR 범위 밖.
      함께: 클래스 docstring 에 R8 선재 결함 참조 한 줄 추가(INFO 2, 경미).
      > 함께 닫을 것 (`00_20_20` security/testing INFO 1): `isIdempotencyEntry()` 가
      > `statusCode` 를 `typeof === 'number'` 로만 보고 **값 범위를 안 본다** — 음수·0 같은
      > 비-HTTP 코드가 `res.status()`/`HttpException` 으로 그대로 흘러간다. 출처가 자기 자신이
      > 쓴 엔트리라 위험은 낮지만 경계값이라는 성격이 같아 한 자리에서 정리한다.
      > (`NaN`·`Infinity` 는 JSON 리터럴이 아니므로 `JSON.parse` 로는 도달 불가 — 실제 표면은
      > 음수·비정상 정수뿐이다.)
- [ ] **`CCH-SE-02` 의 update dedup 이 미배선 — `ChannelUpdate.idempotencyKey` 는 dead field**
      (`19_56_51` cross_spec WARNING 3). [`spec/5-system/15-chat-channel.md`](../../spec/5-system/15-chat-channel.md) L88 은
      "인터랙션 명령 처리는 EIA `Idempotency-Key` 를 어댑터가 자동 발급 (텔레그램 `update_id`
      기반). 동일 `update_id` 30초 안 재도착은 무시" 라고 적지만, 그 경로는 HTTP 인터셉터를
      타지 않는다 — chat-channel 은 `in_process_trusted` ctx 로 서비스를 직접 호출한다.
      > **실측**: `ChannelUpdate.idempotencyKey`(`chat-channel/types.ts:129`)는 provider 파서가
      > 채우기만 하고 **읽는 곳이 0곳**이다(타입 선언 1건 + 파서/테스트뿐). 30초 dedup 도
      > 코드에 없다(`channel-listener.registry.ts` 의 것은 listener dedup 으로 다른 층).
      > 즉 spec 이 약속한 동작이 통째로 미구현이다.
      >
      > 착수 시: dedup 을 구현할지, `CCH-SE-02` 를 현실에 맞게 고칠지가 **planner 결정**이다.
      > 전자면 in-process 경로 전용 dedup 이 필요하다 — HTTP 인터셉터 재사용은 층이 안 맞는다.
- [ ] **EIA 계열 Redis 키가 실행 엔진 §9.1/§9.2 키 레지스트리에 없다** (`19_56_51`
      convention_compliance INFO 4). [`4-execution-engine.md` §9.1](../../spec/5-system/4-execution-engine.md) 은
      "**모든** Redis 키는 `{service}:{workspaceId}:{resource}:{id}:{sub}` 를 따른다" 고 선언하고
      §9.2 표 + 그 아래 예외 각주(`exec:recover:lock`·`exec:seq:<executionId>` 등)로 전역 키를
      등재하는데, `interaction:idempotency:*` 와 `iext:blacklist:<jti>` 등 **EIA 계열이 통째로
      빠져 있다**. EIA 는 자체 Redis 표(`data-flow/15` §2.2)를 갖고 있어 두 레지스트리가 분기했다.
      > 키 하나만 §9.2 에 끼워 넣으면 목록이 더 이상해지므로, **EIA 계열을 묶어** 등재하거나
      > §9.1 의 "모든" 을 실제 범위로 좁히는 편이 낫다. `spec_impact` 에
      > `4-execution-engine.md` 가 추가되는 planner 작업.
- [x] **idempotency 캐시 제외 조건이 Spec EIA §R8 보다 넓다 — 선재 결함** (`12_24_14`
      requirement WARNING). `idempotency.interceptor.ts` 의 `if (statusCode >= 400) return;`
      은 409·410 까지 캐시에서 떨구는데, [`spec/5-system/14-external-interaction-api.md`](../../spec/5-system/14-external-interaction-api.md) §R8 은 명시적으로 반대다:
      > 4xx 응답 중 `400 VALIDATION_ERROR` 만 idempotency cache 에서 제외하고,
      > 그 외 (성공 2xx / `409 Conflict` / `410 Gone`) 는 캐시한다.

      그만큼 `EIA-RL-02`(동일 키 24h 동일 응답 재현)가 409/410 범위에서 지켜지지 않는다.
      2026-05-21 원본 구현(`35ff9c19b`)부터 있던 선재 결함이라 **이 PR(타입 전용 lint 처분)
      에서는 고치지 않는다** — 런타임 미접촉이 이 PR 의 스코프이자 처분 근거 자체다.

      > **현재 동작은 캐너리로 고정해 뒀다** — `idempotency.interceptor.spec.ts` 의
      > "409 도 캐시되지 않는다 — R8 위반 상태를 고정하는 캐너리". 조건을 좁히면 그 테스트가
      > RED 가 되면서 이 항목을 가리킨다. 미수정 결함을 침묵으로 두지 않기 위한 것이다.
      >
      > **착수 시 주의 — 올바른 조건은 `=== 400` 이 아니다.** R8 은 400 중에서도
      > `VALIDATION_ERROR` 를 지목하고, 5xx 캐싱 여부는 아무 말도 하지 않는다. 리뷰어가 제안한
      > `statusCode === 400` 을 그대로 쓰면 400 의 다른 에러 코드를 캐시하게 되고 5xx 도
      > 캐시된다. **spec 확인이 코드보다 먼저**이고, 경우에 따라 planner 턴이 필요하다.

      > **선행 조건 해소 (2026-08-12, planner 턴 `eia-spec-r8-alignment`) — 이제 착수 가능하다.**
      > 위 "5xx 를 아무 말도 하지 않는다" 가 **더 이상 참이 아니다.** §R8 에 `5xx` 미캐시를
      > 명시하고, **캐시 대상이 닫힌 목록(`2xx`·`409`·`410`)** 이라는 것과 `=== 400`·`>= 400`
      > 두 축약이 각각 무엇을 깨뜨리는지를 Rationale 에 적었다. `data-flow/15` 의 "4xx 캐시
      > 제외" 요약 두 자리도 SoT 에 맞췄다(§1.2 시퀀스 · §2.2 표).
      >
      > 즉 **문서만 보고 착수해도 구현이 맞다고 오판하지 않는 상태**가 됐다. 남은 것은 열거를
      > 그대로 조건으로 옮기는 구현과, 409 캐너리를 R8 정합 동작으로 뒤집는 일뿐이다.

      > **완료 (2026-08-12, developer 턴 `eia-r8-cache-scope`).** `statusCode >= 400` 을 §R8 의
      > 열거 그대로 옮겼다 — `2xx || 409 || 410`. 캐너리는 "409 도 캐시되지 않는다(위반 고정)"
      > 에서 **"409 는 캐시된다"** 로 뒤집었고, `410`·`5xx`·`404` 케이스를 함께 고정했다.
      >
      > **두 오답 축약이 각각 다른 테스트에 걸린다** — 뮤테이션 실측:
      >
      > | 뮤턴트 | RED |
      > |---|---|
      > | `>= 400` (원래 결함으로 회귀) | 409 · 410 |
      > | `=== 400` (리뷰어가 제안했던 오답) | 5xx · 404 |
      >
      > 즉 백로그에 적어 뒀던 "`=== 400` 을 그대로 쓰면 안 된다" 는 경고가 이제 **주석이 아니라
      > 테스트로** 지켜진다. `data-flow/15` §2.2 표의 "⚠️ 현행 구현은 …" 갭 표기도 함께 지웠다
      > — 갭이 사라졌으므로 그 문장을 남기면 그것이 거짓이 된다.

      > **⚠️ 위 "완료" 는 1차 시도 기준이고, 그 시도는 실패였다 (`16_29_45` CRITICAL).**
      > 조건식만 바꾼 것으로는 **아무것도 고쳐지지 않았다** — `409`·`410` 은 서비스가
      > `ConflictException`/`GoneException` 으로 **throw** 하므로 RxJS **error 채널**로
      > 흐르는데, 캐시 적재는 `tap({ next })` 뿐이라 그 채널을 보지 못했다. 게다가 컨트롤러가
      > `@HttpCode(202)` 라 성공 경로의 `res.statusCode` 는 202 로 선고정돼 `=== 409` 가
      > 성립할 수 없다. 즉 내가 넣은 분기는 **도달 불가능한 dead code** 였다.
      >
      > **내 테스트가 그걸 못 잡은 이유가 더 중요하다** — 성공 채널에 값을 흘리면서
      > `res.statusCode` 만 409 로 프리셋하는 mock 을 썼다. 실제로는 발생하지 않는 상태를
      > 검사한 **vacuous test** 였고, 뮤테이션 표까지 붙여 놓아 검증된 것처럼 보였다.
      > 무수정 프로브(`throwError` 로 실제 예외)로 `threw=true redis.set=0` 을 확인해 확정했다.
      >
      > **2차에서 재설계했다** — 적재를 `catchError` 로 확장하고, 캐시 히트 시 `409`/`410` 은
      > **예외로 재현**하도록 고쳤다(성공 채널로 돌려주면 409 가 202 로 바뀐다). 테스트는
      > `makeThrowingHandler` 로 전부 error 채널을 행사하게 바꿨다.
      >
      > **교훈**: mock 이 "가능한 상태" 를 만들 수 있다고 해서 그것이 **실제로 발생하는 상태**는
      > 아니다. 상태코드를 손으로 세팅할 수 있으면 그 자리가 진짜로 그 값을 갖는 경로가
      > 있는지부터 확인해야 한다.
      >
      > **그리고 그 교훈을 배운 뒤에도 자매 자리를 두 번 더 놓쳤다.**
      > - 3차(`16_53_26`) — 409·410·5xx·404 는 error 채널로 바꾸고 **`400` 만** 옛 성공-채널
      >   mock 으로 남겼다. 그 상태에서는 `isErrorStatusCacheable` 에 `=== 400` 을 잘못 추가해도
      >   **아무 테스트도 RED 가 되지 않았다.**
      > - 4차(`17_07_45`) — 5xx 테스트가 순수 `Error` 를 던져 `instanceof HttpException` 가드에
      >   **먼저 막혀** 판정 함수가 호출조차 되지 않았다. `>= 500` 오염도 못 잡는 **우회 검증**
      >   이었다. 함께 410 의 replay 자매 테스트도 없었다(409 만 있었다).
      >
      > 세 번 다 **"고친 자리 옆의 같은 자리"** 였다. 한 케이스를 고쳤으면 그 순간 형제를
      > 전수로 세는 것이 이 결함 클래스의 유일한 방어다.
- [ ] `execution-engine.service.ts` 의 admission 자리(`rows.length === 1`, 2922행)에
      `Array.isArray(rows)` 런타임 가드 (`11_06_12` security INFO, 직전 세션이 유예).
      그 커밋의 값이 "emit JS 가 md5 까지 before/after 동일" 이라 런타임 가드를 넣으면 그
      성질이 깨진다는 이유였고, 실패 방향이 **fail-closed** 라(shape 이 어긋나면
      `undefined === 1` → false → admission 거부이지 cap 우회가 아니다) 급하지 않다.
      `review/**` 는 SoT 가 아니므로 여기 옮겨 적는다.
      > **파일명 정정 (2026-08-12).** 이 항목은 처음에 `migrate-node-output-refs.ts` 로
      > 적혀 있었지만 **틀렸다** — security 리뷰어가 지목한 자리는
      > `execution-engine.service.ts` 의 admission-control 이다(`security.md` 본문이
      > 파일명과 행 번호를 명시한다). 백로그 항목의 파일명이 틀리면 항목 자체가 실행
      > 불가능해지므로 착수 전에 원 리포트로 대조했다.

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
