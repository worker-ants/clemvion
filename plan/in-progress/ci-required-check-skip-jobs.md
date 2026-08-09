---
title: required status check 데드락 해소 — paths 필터를 skip-job 패턴으로 전환
worktree: ci-required-check-skip-jobs-42f5d8
started: 2026-08-09
owner: developer
status: in-progress
priority: P1
spec_impact: none
---

## Overview

**목적**: branch protection 에 required status check 를 등록할 수 있게 만든다.

사용자가 등록 방법을 물어 조사하던 중, **지금 상태로 등록하면 머지가 영구히 막힌다**는 것이
드러나 그 선행 조건을 먼저 만든다.

## 문제 — `paths:` 필터와 required check 는 함께 못 쓴다

GitHub 의 required check 는 "그 이름의 체크가 보고될 때까지" 기다린다. 그런데
`on.pull_request.paths` 필터가 걸린 워크플로는 무관한 PR 에서 **아예 실행되지 않고**,
실행이 없으면 보고도 없다 — 실패가 아니라 **영원한 대기**다:

```
Expected — Waiting for status to be reported
```

**이 저장소는 워크플로 10개가 전부 paths 필터를 갖는다**(2026-08-09 실측). 지금 required 를
걸면 문서만 바꾸는 PR(`#1102`·`#1105` 같은)이 통째로 막힌다.

## 처방 — 항상 실행 + 스텝 게이팅

`on.pull_request.paths` 를 걷어내 **항상 실행**시키고, `changes` 잡이 관련성을 판정해
무관하면 각 잡의 **스텝만** 건너뛴다. 잡 자체는 `success` 로 보고돼 required check 가 통과한다.

### 왜 잡 전체를 `if:` 로 skip 하지 않는가

skip 된 잡의 conclusion 은 `skipped` 이고, **그것이 required check 를 만족하는지는 문서상
모호하다.** 그 모호함에 기대면 이 변경이 없애려는 데드락이 그대로 재발한다. 스텝 게이팅은
그 의미론에 의존하지 않는다 — 잡은 확실히 `success` 다.

### 판정 로직은 한 곳에

`scripts/ci-paths-changed.sh`. 종전엔 경로 목록이 `pull_request.paths` 와 `push.paths`
**두 곳에 복제**돼 있었는데, 그게 이 저장소가 여섯 번 겪은 "paths 커버리지 갭" 클래스의
온상이다(`review-gate.yml` 주석이 그 이력을 적고 있다).

**fail-safe 방향은 "불확실하면 검사를 돌린다"** — 조용히 건너뛰는 쪽이 아니라 불필요하게
도는 쪽으로 기운다. 이 저장소가 반복해 데인 것이 "게이트가 조용히 안 도는" 실패다
(Actions 12주 비활성 · harness-checks paths 갭 6회 · lint 게이트 3개월 방치).

로컬 실증(2026-08-09): 관련 변경 → `true` · 무관 변경 → `false` ·
schedule / base SHA 부재 / merge-base 실패 3경로 전부 → `true`.

## 가장 위험한 회귀 — `needs: changes` 누락

`needs` 가 빠지면 `needs.changes.outputs.relevant` 가 **빈 문자열**이 되어 의도한 게이팅이
사라진다. `.claude/tests/test_required_check_skip_jobs.py` 가 이것을 별도 테스트로 잡는다
(뮤테이션 3/3 RED: 게이팅 제거 · `needs` 제거 · `paths` 되살림).

> **조건 방향 (ai-review W3 반영)**: 게이팅은 `== 'true'` 가 아니라 **`!= 'false'`** 다.
> `changes` 가 실패하면 출력이 빈 문자열인데 그때 실제 검사가 **돌아야** 하기 때문이다.
> `== 'true'` 였다면 빈 값에서 전부 no-op 이 되어 "초록인데 아무것도 검사하지 않는" 상태가
> 된다. 하위 잡에 `if: ${{ !cancelled() }}` 를 단 것도 같은 이유 — `needs` 실패로 잡이
> `skipped` 되면 이 패턴이 피하려던 모호함이 다른 경로로 되돌아온다.

## 기존 가드와의 결속

`test_workflow_yaml_structure.py` 의 `_PULL_REQUEST_KEYS` 주석이 **bare `pull_request:` 를
"가장 위험한 형태(always-green 워크플로를 만들 수 있다)"** 로 경고하고 있었다 — 정확히 이
변경이 만드는 형태다. 그래서 등록부를 그냥 고치지 않고 **신설 가드를 보상 통제로 명시**해
둘을 서로 물리게 했다. 조건 문자열은 두 표준형과 **정확히 일치**할 때만 규칙 예외를 받는다
(오탈자 뮤턴트 RED 확인).

## 부수 — 새로 도는 audit 이 main 취약점 2건을 드러냈다 (2026-08-09)

PR `#1106` 이 올라가자 `pnpm audit (moderate+)` 잡이 **실패**했다. 이 PR 이
`deps-security-checks.yml` 자체를 고치므로 `changes` 가 `relevant=true` 로 판정했고,
그래서 이 저장소에서 **처음으로** 그 잡이 실제 PR 에서 돌았다.

```
high      nanoid <3.3.17     GHSA-2v37-7h3g-55p8   codebase/frontend > postcss > nanoid
moderate  dompurify <=3.4.12 GHSA-55q2-fjhq-7xh7   codebase/channel-web-chat > dompurify
```

**본 PR 이 만든 회귀가 아니다** — main 에 이미 있던 것이 게이트가 켜지면서 드러났다. 이
PR 의 목적이 "이 체크를 required 로 올릴 수 있게 만드는 것" 이므로 체크가 빨간 채로 둘 수
없어 같은 PR 에서 해소한다.

### 조치 — 전이는 override, 직접 의존은 선언 자체를 올린다

`pnpm-workspace.yaml` 이 명문화한 구분을 그대로 따랐다("직접 의존을 override 로 덮으면
매니페스트가 거짓말을 하게 된다").

| 패키지 | 성격 | 조치 |
|---|---|---|
| `nanoid` | 전이 (postcss 경유) | `overrides` 에 `^3.3.17` + `EXPECTED_OVERRIDES` 동시 갱신 (2-place 규약) |
| `dompurify` | **직접** 의존 2곳 | `channel-web-chat` `3.4.12`→`3.4.13`(exact 핀 유지) · `frontend` `^3.4.12`→`^3.4.13` |

`nanoid` 를 postcss 상향이 아니라 nanoid 자체에 건 이유: frontend 가 postcss 를 **직접**
의존하는데 그 경로만 lockfile 에서 `postcss@8.5.25 > nanoid@3.3.16` 으로 고정돼 있었다.
같은 트리의 `next>postcss` 경로는 이미 `8.5.26 > 3.3.17` 이라 안전했다 — postcss 값을
올리는 방식은 두 경로 중 하나만 덮는다.

`dompurify` 는 audit 이 `channel-web-chat` 경로만 표시했지만 **frontend 도 같은 3.4.12 로
해소돼 있었다**(lockfile 실측). audit 표의 `paths` 는 잘려 나온다 — `auditConfig` 주석이
`#1038` 사고로 이미 경고하고 있는 함정이라 lockfile 을 직접 봤다.

### lockfile 의 `libc:` 57줄이 함께 사라진다 — 본 변경과 무관

재생성하면 `@img/sharp-libvips-linux-*`·`@css-inline/*` 의 `libc: [glibc|musl]` 57줄이
지워진다. **저장소가 이미 겪고 있는 진동**이다: dependabot 커밋 `ba3b1017d` 이 57줄을
넣고, 로컬 커밋 `9e73595a4`(`#1033`) 가 같은 57줄을 지웠다.

원인은 실측으로 특정했다 — 레지스트리의 **축약(abbreviated) packument** 에는 `libc` 가
없고 full packument 에만 있다. 저장소가 핀한 `pnpm@10.23.0` 은 축약본을 쓰므로 이 필드를
못 쓴다(`full-metadata=true` + 메타데이터 캐시 삭제로도 재현되지 않음 — 즉 설정 문제가
아니라 그 pnpm 이 안 쓰는 것). CI 도 `packageManager` 로 같은 10.23.0 을 쓰므로 **핀한
툴체인의 정본 출력은 `libc` 없는 쪽**이다. 후속은
[`deps-guard-hardening.md`](deps-guard-hardening.md) §후속 에 등재.

## 체크리스트

- [x] `scripts/ci-paths-changed.sh` — 판정 로직 단일화 + fail-safe 3경로 실증
- [x] `deps-security-checks.yml` 전환 (3잡) — `config-guard` · `audit` · `override-floors`
- [x] `frontend-checks.yml` 전환 (1잡) — `test-and-build`(`--frozen-lockfile` 담당)
- [x] 회귀 가드 신설 + 기존 등록부 2개 갱신 — harness **922 tests OK**
- [x] TEST WORKFLOW — lint PASS(68s) · unit PASS(92s) · build PASS(148s) · **e2e PASS(286s, 261)**
      > **e2e 를 돌린 이유**: 변경 set 에 `scripts/ci-paths-changed.sh` 가 있는데
      > `scripts/**` 는 `PROJECT.md §e2e 면제 화이트리스트` **밖**이다. "CI 스크립트라
      > e2e 와 무관" 은 자가 영향 추정이고, 화이트리스트는 부분집합 판정이지 판단이 아니다.
- [x] `/ai-review` — **Critical 0 · WARNING 10 → 8건 수정 · 2건 후속**
      (`review/code/2026/08/09/11_40_34`, reviewer 14/14). 특히 W1·W2 는 **이 PR 이
      막으려는 것과 같은 클래스를 초판이 재현한 것**이었다:
      W1 판정 스크립트의 fail-safe 를 실행 검증하는 테스트 부재(→ `test_ci_paths_changed.py`
      16건 신설, 뮤테이션 2 RED) · W2 그 스크립트가 `harness-checks.yml` paths 에 미등재
      (→ 등재). W3 은 `changes` 실패 시 하위 잡이 skipped 가 되어 모호함이 재발하는
      구멍이라 `!cancelled()` + 조건 반전(`!= 'false'`)으로 닫았다(뮤테이션 6 RED).
      W4 push 광역화, W5 레지스트리 3중 비바인딩, W6 step id 오타 미검출도 수정.
- [x] push + PR — [#1106](https://github.com/worker-ants/clemvion/pull/1106)
- [x] **부수** audit 2건 해소 (§위) — 로컬 실측: `pnpm audit --audit-level=moderate`
      **No known vulnerabilities** · `check-pnpm-security-config.py` OK(overrides 31) ·
      `check-override-floors.py` OK(대상 28) · `pnpm install --frozen-lockfile` OK
- [x] TEST WORKFLOW 재수행 (의존성 변경 — 면제 화이트리스트 밖) — lint PASS(55s) ·
      unit PASS(79s) · build PASS(160s) · **e2e PASS(307s)**
      > 커버리지는 wrapper 요약 숫자가 아니라 로그 전수로 확인했다(`tests=261` 은 backend
      > jest 만 센다): backend jest 46 suites/261 · **playwright 51** · unit 단계는
      > frontend 282 파일/5845 + channel-web-chat 23 파일/409 + backend 416 suites.
      > dompurify 를 쓰는 두 패키지가 모두 실제로 돌았다.
- [x] `/ai-review` 2차 (audit 조치분, `review/code/2026/08/09/12_41_58`) —
      **Critical 0 · WARNING 3 → 3건 전부 수정 · INFO 8**. router 가 8명 선별(= forced
      전원), 8/8 리포트 디스크 실측. 이번 라운드는 **동작 결함이 아니라 1차 fix 의 잔여**
      (문서 방향 · 중복 · 미검증 입력 형태)라 수렴으로 읽는다.
      W1 README 카탈로그 행이 1차 조건 반전을 반영 못해 **현재 코드와 반대 방향**을 서술
      (미러 4곳 중 1곳 누락 — 이 저장소의 반복 패턴) · W2 fail-safe 3줄이 5분기 복제 →
      `fail_safe()` 헬퍼(뮤테이션 6 RED) · W3 실사용 pathspec `codebase/**/package.json`
      미검증 → 실측하니 **중간 `**` 는 깊이 0 을 놓친다** → 워크플로에 깊이 0 명시 +
      테스트 3종(뮤테이션 RED).
- [x] TEST WORKFLOW 재수행 (fix 후) — lint PASS(53s) · unit PASS(73s) · build PASS(116s) ·
      **e2e PASS(270s, jest 261 + playwright 51)** · harness **942 tests OK**
      > fix 변경 set 에 `scripts/ci-paths-changed.sh` 가 있고 `scripts/**` 는 화이트리스트
      > **밖**이다. "CI 헬퍼라 성격상 `.github/**` 와 같다" 는 임의 확대라 하지 않는다.
- [x] `/consistency-check --impl-done spec/7-channel-web-chat/` — **BLOCK: NO** (5/5 checker,
      `review/consistency/2026/08/09/13_23_02`). dompurify 범프가 `codebase/channel-web-chat/**`
      을 건드려 SPEC-CONSISTENCY 게이트(Gate 2)가 걸렸다. diff 가 프롬프트에 실제로 실렸는지
      (`package.json` 7회 등장) 먼저 확인하고 돌렸다 — 번들 예산에 조용히 잘리면 거짓 통과다.
      WARNING 2건은 **이 diff 와 무관한 기존 항목**이고 둘 다 이미 티켓이 있다
      (`spec-update-webchat-evidence-pointers` · `webchat-command-failure-is-not-termination`).
      INFO #4 는 **본 plan 의 사실 오류**라 그 자리에서 고쳤다 — §Rationale 이
      `--frozen-lockfile` required-check 요구를 `deps-peer-gating-and-eslint10` 로
      귀속했는데 실측하니 그 파일엔 0건, `deps-guard-hardening` 에 8건이다.

## 후속 — 나머지 8개 워크플로 (별 항목)

같은 패턴을 반복 적용하면 된다. **전환할 때마다 `test_required_check_skip_jobs.py` 의
`CONVERTED` 목록과 `test_workflow_yaml_structure.py` 의 `_PULL_REQUEST_KEYS`·
`_SKIP_JOB_WORKFLOWS` 를 함께 갱신**하는 것이 계약이다.

- [ ] `packages-checks.yml` (matrix — 체크가 패키지마다 생기므로 required 목록도 함께 관리)
- [ ] `web-chat-checks.yml` (3잡)
- [ ] `harness-checks.yml`
- [ ] `spec-link-checks.yml`
- [ ] `migration-check.yml`
- [ ] `review-gate.yml` — **주의**: 전환하면 문서-only PR 에서도 돌게 되므로, 그 경로에서
      게이트 로직이 정상 통과하는지 먼저 확인할 것
- [ ] `e2e.yml` — `paths-ignore` 형태라 다른 축. 비용이 가장 크니 마지막
- [x] **`changes` 잡을 reusable workflow(`workflow_call`)로 추출 — 완료 (2026-08-09)**
      (ai-review W7·W8). `.github/workflows/_changed-paths.yml` 신설, 세 워크플로가
      `uses:` 로 호출한다. `backend-checks.yml`(`#1109`)이 세 번째 전환이라 그 시점에
      집행했다 — 4번째를 기다리지 않았다.
      > **W8(`fetch-depth: 0` 전체 clone 을 워크플로마다 지불)은 이 추출로 해소되지
      > 않는다.** 잡 수가 그대로라 clone 도 그대로다. 해소하려면 세 워크플로를 한
      > 워크플로로 합치거나 판정 결과를 공유해야 하는데, 그건 required check 이름
      > 구성을 바꾸는 별 축이다 — 아래 §후속 으로 남긴다.
      >
      > **가장 위험했던 자리**: `workflow_call` 의 `inputs` 는 스칼라만 받아 pathspec
      > 목록이 여러 줄 문자열로 건너온다. 그걸 배열로 되돌리는 데 실패하면 판정이
      > `relevant=false` 가 되어 **세 워크플로의 모든 검사가 조용히 no-op** 된다.
      > 정적 검사 대신 YAML 의 `run:` 블록을 실제 bash 로 돌려 스텁이 받은 인자를 세는
      > 테스트(`test_changed_paths_reusable.py`)로 고정했고, 그 테스트가 **초판의
      > `mapfile`(bash 4+ 전용)을 CI 도달 전에 잡았다**.
- [ ] `migration-recheck-on-main.yml` — **대상 아님**(push 전용, PR 체크가 아니다)

## 사용자 액션 (이 PR 머지 후)

Settings → Rules/Branches → `main` → **Require status checks to pass before merging** 에서
아래 이름 등록:

| 목적 | check 이름 |
|---|---|
| 의존성 보안 | `pnpm 보안 설정 스냅샷 가드` · `pnpm audit (moderate+)` · `override 바닥 침식 검출` |
| `--frozen-lockfile` | `test-and-build` |

> **추가 확인 (2026-08-09, `changes` 잡 추출 후)**: 인라인 잡이 reusable workflow
> 호출로 바뀌면서 **체크 표시 이름이 달라질 수 있다.** required check 는 이름으로
> 매칭하므로 등록 전에 Actions 실행 화면에서 실제 표시 이름을 1회 확인할 것
> (ai-review INFO 4 — 코드로 미리 단언할 수 있는 값이 아니다).

> **주의**: GitHub 은 최근 약 7일 안에 **한 번이라도 보고된 체크만** 검색에 노출한다. 이
> 저장소는 Actions 가 12주간 꺼져 있었으므로 목록에 안 뜰 수 있다 — 그 경우 이 PR 이
> 머지돼 워크플로가 한 번 돈 뒤 등록하거나, `gh api` 로 이름을 직접 지정한다.

## Rationale

**왜 P1 인가.** 오늘 드러난 main 잠재 결함 넷(audit 13건 · Gate C · lint 122건 · spec
타입체크 319줄)의 뿌리가 전부 **required check 미등록**이다. 등록이 목표이고 이 PR 은 그
선행 조건이다 — 이것 없이 등록하면 머지가 막혀 결국 등록을 되돌리게 된다.

**왜 2개만 전환하나.** 두 plan 이 명시적으로 요구한 required check 를 커버하는 최소
집합이다(`deps-guard-hardening` 의 `--frozen-lockfile`,
`pnpm-migration-followups` 의 `deps-security-checks`). 10개를 한 PR 에 넣으면 리뷰가
어려워지고, 패턴이 검증되기 전에 전면 적용하는 것은 순서가 뒤바뀐다.
