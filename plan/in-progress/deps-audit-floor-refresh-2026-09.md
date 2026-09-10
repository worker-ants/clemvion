---
title: deps-security-checks 가 main 에서 이미 빨간불이었다 — override 바닥 8건 침식 + 신규 CVE 3건, dependabot PR 7건 전부 차단
worktree: dependabot-pr-ci-fix-138fba
started: 2026-09-10
owner: developer
status: in-progress
priority: P1
spec_impact: none
---

## Overview

open dependabot PR **7건 (#1293~#1298, #1301)** 이 전부 같은 두 체크에서 실패한다:

- `override 바닥 침식 검출` (`scripts/check-override-floors.py`)
- `pnpm audit (moderate+)`

**PR 들의 결함이 아니다 — main 이 이미 빨간불이었다.** 그리고 그 사실은 숨어 있지도 않았다:
**주간 스케줄 런이 2026-09-07 에 정확히 이 두 잡으로 실패했다**(run `34122013987`, branch `main`.
`pnpm 보안 설정 스냅샷 가드`·`변경 경로 판정` 은 통과 — 즉 낡은 것은 baseline 미러가 아니라
override 값 자체다). 그 뒤 3일간 아무도 보지 않았고, dependabot PR 이 그것을 PR 체크로 다시
드러냈다.

PR 쪽에서만 빨갛게 보이는 이유는 **경로 필터**다. `deps-security-checks.yml` 은
`_changed-paths.yml` 로 관련성을 판정해 무관한 변경에서는 각 잡을 no-op 으로 통과시킨다.
2026-09-07 이후 main 커밋(#1304~#1308)은 전부 `spec/`·`plan/`·backend 테스트라 **push 트리거에서는
검사가 돌지 않고 초록으로 보고**됐다. `pnpm-lock.yaml` 을 건드리는 유일한 PR 종류인 dependabot
PR 만 실제로 검사를 돌린 것이다.

실측 (2026-09-10, 이 worktree = `origin/main` 5b458b1ec 기준):

```
pnpm audit --audit-level=moderate  → exit 1, 25 vulnerabilities
Severity: 1 low | 10 moderate | 12 high | 2 critical
```

즉 **main 자체가 audit 게이트를 통과하지 못하는 상태**이고, 경로 필터가 그것을 가리고 있었다.
main 을 먼저 초록으로 만들지 않으면 dependabot PR 을 아무리 rebase 해도 같은 자리에서 막힌다.

## 1. 해소 대상 — 실측 25건의 패키지별 분해

### (a) override 바닥 침식 — 이미 관리 선언한 패키지 (값만 올리면 된다)

| 패키지 | 현재 바닥 | 필요 하한 | 근거 advisory |
| --- | --- | --- | --- |
| `fast-uri` | `^3.1.5` | `>=3.1.6` | GHSA-jqff-g426-hqxp 외 3건 (high) |
| `hono` | `^4.12.34` | `>=4.13.5` | GHSA-crvj-82cr-hjcx 외 2건 (moderate) |
| `multer` | `^2.2.0` | `>=2.3.0` | GHSA-535w-7cp7-47q4 외 2건 (high) |
| `nodemailer` | `^9.0.1` | `>=9.1.1` | GHSA-8m3c-c648-2xjj 외 3건 (high/moderate) |
| `sharp` | `^0.35.0` | `>=0.35.4` | GHSA-rgj7-g3m4-5g8c (high) |
| `svgo` | `^4.0.2` | `>=4.1.0` | GHSA-4vpr-x523-8j87 · GHSA-w27v-7q3p-w38r |
| `js-yaml@>=4.0.0 <4.3.1` | `^4.3.1` | `>=4.3.2` | GHSA-2883-xcg3-v3hh (high) |
| `js-yaml@>=3.0.0 <3.15.1` | `^3.15.1` | `>=3.15.2` | GHSA-2883-xcg3-v3hh (high) |

`js-yaml` 2건은 **키 자체**가 advisory 범위를 따라 넓어져야 한다 (`<4.3.1` → `<4.3.2`,
`<3.15.1` → `<3.15.2`). 값만 올리면 override 가 자기 스코프 밖으로 나가 적용되지 않는다.

### (b) override 신설 — 관리 대상이 아니었던 전이 의존

| 패키지 | 경로 | 필요 하한 | 근거 |
| --- | --- | --- | --- |
| `qs` | `express@5.2.1>qs` (**prod**) · `supertest>superagent>qs` (dev) | `>=6.16.0` | GHSA-4mjr-xmp4-gh2g · GHSA-x5fp-wj9c-mxmx (moderate) |

`express` 경로가 프로덕션이라 수용(`ignoreCves`) 대상이 아니다. 부모 선언 범위
(`express@5.2.1` → `qs: ^6.14.0`, `superagent@10.3.0` → `qs: ^6.14.1`) 를 `^6.16.0` 이
만족하므로 override 가 계약을 깨지 않는다 (실측: `npm view` 로 두 부모 범위 확인).

### (c) 직접 의존 선언 상향 — override 로 덮지 않는다

`pnpm-workspace.yaml` 주석 규약: *"직접 의존을 override 로 덮으면 매니페스트가 거짓말을 하게 된다"*.

| 워크스페이스 | 패키지 | 현재 | 상향 | 근거 |
| --- | --- | --- | --- | --- |
| `codebase/channel-web-chat` | `next` | `^16.2.12` | `^16.3.3` | GHSA-p293-qw3h-jr36 · GHSA-2xp9-vwfh-vxw4 (**critical**) |
| `codebase/frontend` | `next` | `^16.2.12` | `^16.3.3` | 같은 lockfile 엔트리 (`next@16.2.12`) 를 공유 — 한쪽만 올리면 재해소 시 되돌아온다 |
| `codebase/backend` | `nodemailer` | `^9.0.5` | `^9.1.1` | 위 (a) 와 동일 advisory. 선언이 override 보다 높으므로 **양쪽** 을 올린다 |
| `codebase/backend` | `csv-parse` | `^7.0.1` | `^7.0.2` | GHSA-8cw4-87c7-c6xx (moderate) — **PR #1301 과 동일 내용** |

> `csv-parse` 를 본 PR 이 함께 올리면 #1301 은 델타가 0 이 된다. 그렇다고 #1301 을 먼저
> 머지할 수는 없다 — 그 PR 도 나머지 24건 때문에 CI 가 빨간불이기 때문이다(순환). 본 PR
> 머지 후 dependabot 이 #1301 을 자동 종료하는 것이 정상 경로다.

## 2. 2-place 편집 규약

`pnpm-workspace.yaml` 의 `overrides` 를 바꾸면 `scripts/check-pnpm-security-config.py` 의
`EXPECTED_OVERRIDES` 를 **같은 커밋에서** 갱신한다 (`PROJECT.md §의존성 취약점 audit·핀 거버넌스`).
한쪽만 고치면 `pnpm 보안 설정 스냅샷 가드` 잡이 실패한다.

## 2.5 리뷰 라운드 1 이 잡은 것 — 재해소가 `libc:` 57개를 지웠다

`/ai-review` (`review/code/2026/09/10/20_17_59`, RISK=LOW · Critical 0 · **WARNING 1**) 의
scope·dependency reviewer 가, 이 PR 이 **버전을 건드리지 않은** 패키지들의 `libc:` 메타데이터가
lockfile 에서 사라진 것을 잡았다. 최초 감사가 못 본 이유는 명확하다 — **"버전 하향 0건" 은
버전 번호만 비교하는 프록시**였고 이 클래스는 그 밖에 있었다.

실측으로 원인과 영향을 좁혔다(상세 표는 `CHANGELOG.md` 와
[`deps-guard-hardening.md` §후속 libc](deps-guard-hardening.md) 에):

- **원인은 재해소가 아니라 핀한 pnpm 버전.** 10.23.0 은 기존 `libc:` 를 보존만 하고 재해소한
  엔트리에는 다시 쓰지 않는다(대조군: 매니페스트 변경 0 → lockfile diff **0줄**). macOS·Linux
  동일 — 플랫폼 요인 아님. 10.34.5 는 같은 편집으로 재해소해도 57개를 **전부 보존**하고
  `lockfileVersion` 은 `'9.0'` 그대로다.
- **영향은 "낮음" 이 아니었다.** Alpine(musl) 에서 실제 설치해 세어 보니 `libc:` 가 없으면
  `@tailwindcss/oxide`·`@img/sharp`·`@unrs/resolver-binding`·`lightningcss` 넷 모두
  **gnu+musl 두 변형**이 깔린다(있으면 musl only). 동작은 하므로
  (`codebase/frontend/Dockerfile` 빌드 통과) **테스트가 원리적으로 못 잡는다.**
- **조치**: lockfile 을 pnpm 10.34.5 로 재생성해 57개 복원. 핀된 10.23.0 이
  `--frozen-lockfile --strict-peer-dependencies` 로 받아들이고 재작성하지 않음을 확인(exit 0).
  두 lockfile 의 차이는 `libc:` 57줄 + `caniuse-lite`·`baseline-browser-mapping` 두 건뿐.
- **남은 것**: 핀이 10.23.0 인 한 다음 재해소가 같은 자리를 다시 지운다. 이 진동은 이미
  `deps-guard-hardening.md` 에 P3 로 등재돼 있었고 그 항목의 미실증 전제 (b) 를 이번에
  실증했다 — 핀 상향은 install 호출부 5곳의 툴체인을 바꾸므로 **별도 PR**.

INFO 처분: #1(`@next/mdx` 는 코어와 별개 — CHANGELOG 문구 한정) · #2(`qs` 세 번째 소비처
`body-parser@2.3.0` → `^6.15.2`, `^6.16.0` 이 만족 — 서술 보강) · #5(CHANGELOG 표 열 정리)
는 이 PR 에서 반영. #6(`check-pnpm-security-config.py` 전용 테스트 부재) 은
`deps-guard-hardening.md` 에 등재. #3·#4·#7 은 조치 불요(참고).

## 3. dependabot PR 갱신

main 이 초록이 된 뒤 각 PR 을 rebase 한다 (`@dependabot rebase`). 대상:

| PR | 내용 | 예상 결과 |
| --- | --- | --- |
| #1293 | `pnpm/action-setup` 6.0.10 → 6.1.0 | rebase 후 통과 |
| #1294 | `p-limit` 7.3.1 → 7.3.2 | rebase 후 통과 |
| #1295 | `jest` 30.4.2 → 30.5.1 | rebase 후 통과 |
| #1296 | `dompurify` 3.4.13 → 3.4.14 | rebase 후 통과 |
| #1297 | `@radix-ui/react-label` 2.1.10 → 2.1.15 | rebase 후 통과 |
| #1298 | `@vitejs/plugin-react` 6.0.2 → 6.1.1 | rebase 후 통과 |
| #1301 | `csv-parse` 7.0.1 → 7.0.2 | 본 PR 에 흡수 → dependabot 자동 종료 |

## 체크리스트

- [x] `pnpm-workspace.yaml` overrides 갱신 (바닥 8건 + `qs` 신설)
- [x] `scripts/check-pnpm-security-config.py` `EXPECTED_OVERRIDES` 동반 갱신
- [x] 직접 의존 선언 4건 상향 (`next` ×2 · `nodemailer` · `csv-parse`)
- [x] `pnpm-lock.yaml` 재생성 + `--frozen-lockfile --strict-peer-dependencies` 통과
- [x] `pnpm audit --audit-level=moderate` exit 0
- [x] `python3 scripts/check-override-floors.py` exit 0
- [x] `python3 scripts/check-pnpm-security-config.py` exit 0
- [x] `python3 scripts/check-unmet-peers.py` exit 0 — 미충족 peer 2건, 전부 기존 등재 수용 항목(신규 0건)
- [x] TEST WORKFLOW — lint — PASS 60s (`_test_logs/lint-20260910-204230.log`, lockfile 교체 후 재수행)
- [x] TEST WORKFLOW — unit — PASS 91s (`_test_logs/unit-20260910-204330.log`; backend 454 suites / 9,521 tests · frontend 289 files · channel-web-chat 23 files / 451 tests · 내부 패키지 8개)
- [x] TEST WORKFLOW — build — PASS 191s (`_test_logs/build-20260910-204510.log`) + 타입체크 ratchet 2종 (backend 197건/36파일 · frontend 52건/15파일, baseline 일치)
- [x] TEST WORKFLOW — e2e — PASS 225s (`_test_logs/e2e-20260910-204841.log`; backend jest 52 suites / 305 tests + playwright **51 passed**)
- [x] `/ai-review` 라운드 1 — `review/code/2026/09/10/20_17_59` (RISK=LOW · Critical 0 · WARNING 1)
- [x] WARNING 1 조치(`ff94b54ce`) + RESOLUTION.md + deps 게이트 4종·TEST 4단계 재검증
- [ ] dependabot PR 7건 rebase 요청
