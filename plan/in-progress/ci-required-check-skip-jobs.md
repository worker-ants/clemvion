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

`needs` 가 빠지면 `needs.changes.outputs.relevant` 가 **빈 문자열**이 되고 `!= 'true'` 가
참이 되어 **모든 스텝이 no-op** 으로 건너뛰어진다. 체크는 초록인데 아무것도 검사하지 않는다.

`.claude/tests/test_required_check_skip_jobs.py` 가 이것을 별도 테스트로 잡는다
(뮤테이션 3/3 RED: 게이팅 제거 · `needs` 제거 · `paths` 되살림).

## 기존 가드와의 결속

`test_workflow_yaml_structure.py` 의 `_PULL_REQUEST_KEYS` 주석이 **bare `pull_request:` 를
"가장 위험한 형태(always-green 워크플로를 만들 수 있다)"** 로 경고하고 있었다 — 정확히 이
변경이 만드는 형태다. 그래서 등록부를 그냥 고치지 않고 **신설 가드를 보상 통제로 명시**해
둘을 서로 물리게 했다. 조건 문자열은 두 표준형과 **정확히 일치**할 때만 규칙 예외를 받는다
(오탈자 뮤턴트 RED 확인).

## 체크리스트

- [x] `scripts/ci-paths-changed.sh` — 판정 로직 단일화 + fail-safe 3경로 실증
- [x] `deps-security-checks.yml` 전환 (3잡) — `config-guard` · `audit` · `override-floors`
- [x] `frontend-checks.yml` 전환 (1잡) — `test-and-build`(`--frozen-lockfile` 담당)
- [x] 회귀 가드 신설 + 기존 등록부 2개 갱신 — harness **922 tests OK**
- [x] TEST WORKFLOW — lint PASS(68s) · unit PASS(92s) · build PASS(148s) · **e2e PASS(286s, 261)**
      > **e2e 를 돌린 이유**: 변경 set 에 `scripts/ci-paths-changed.sh` 가 있는데
      > `scripts/**` 는 `PROJECT.md §e2e 면제 화이트리스트` **밖**이다. "CI 스크립트라
      > e2e 와 무관" 은 자가 영향 추정이고, 화이트리스트는 부분집합 판정이지 판단이 아니다.
- [ ] `/ai-review` + Critical·Warning 해소
- [ ] push + PR

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
- [ ] `migration-recheck-on-main.yml` — **대상 아님**(push 전용, PR 체크가 아니다)

## 사용자 액션 (이 PR 머지 후)

Settings → Rules/Branches → `main` → **Require status checks to pass before merging** 에서
아래 이름 등록:

| 목적 | check 이름 |
|---|---|
| 의존성 보안 | `pnpm 보안 설정 스냅샷 가드` · `pnpm audit (moderate+)` · `override 바닥 침식 검출` |
| `--frozen-lockfile` | `test-and-build` |

> **주의**: GitHub 은 최근 약 7일 안에 **한 번이라도 보고된 체크만** 검색에 노출한다. 이
> 저장소는 Actions 가 12주간 꺼져 있었으므로 목록에 안 뜰 수 있다 — 그 경우 이 PR 이
> 머지돼 워크플로가 한 번 돈 뒤 등록하거나, `gh api` 로 이름을 직접 지정한다.

## Rationale

**왜 P1 인가.** 오늘 드러난 main 잠재 결함 넷(audit 13건 · Gate C · lint 122건 · spec
타입체크 319줄)의 뿌리가 전부 **required check 미등록**이다. 등록이 목표이고 이 PR 은 그
선행 조건이다 — 이것 없이 등록하면 머지가 막혀 결국 등록을 되돌리게 된다.

**왜 2개만 전환하나.** 두 plan 이 명시적으로 요구한 required check 를 커버하는 최소
집합이다(`deps-peer-gating-and-eslint10` 의 `--frozen-lockfile`,
`pnpm-migration-followups` 의 `deps-security-checks`). 10개를 한 PR 에 넣으면 리뷰가
어려워지고, 패턴이 검증되기 전에 전면 적용하는 것은 순서가 뒤바뀐다.
