# RESOLUTION — review/code/2026/07/24/01_25_15

대상: branch `claude/push-guard-worktree-scope-20044c`, 커밋 `98a27eb2f`.
판정: **RISK=CRITICAL / CRITICAL=1 / WARNING=5 / INFO=9**. forced 7/7 확보.

> 이 라운드는 직전(01_02_21)의 CRITICAL — **diff payload 가 코드 3파일을 누락** — 을 해소하려고
> 그 3파일을 **명시 타겟**으로 재실행한 것이다. 이번엔 payload 에 정확히 3파일이 들어갔고
> (`--- Batch 1/1 (3 files) ---` 확인), 그래서 **코드가 처음으로 제대로 리뷰됐다**.
> 문서화된 처방(타겟 재실행)이 의도대로 작동했고, 그 즉시 아래 CRITICAL 을 잡아냈다.

## CRITICAL 1 (반영) — origin/main 이 **또** 앞서갔다

`_GIT_PUSH` 정규식이 origin/main 에 이미 랜딩된 §J 버그픽스(#1001 `442ccc325`, #1002
`ddd3633d4`)를 흡수하지 못한 **구버전**이었다. 구버전은 env-prefix 를 `=\S+` 로 스킵해 따옴표 안
공백에서 끊긴다 — `GIT_SSH_COMMAND="ssh -i ~/.key" git push …` 같은 형태가 **탐지되지 않아**
`_is_git_push()` 가 False 를 반환하고 `main()` 이 즉시 `return 0` 한다. 즉 REVIEW/PLAN 게이트도,
**이 PR 이 만든 worktree 스코핑도 아예 실행되지 않는다**(fail-open 배너조차 없어 §E 관측 대상도
아님).

**실측 확인**: 내 branch `:102` 는 `=\S+`, origin/main 은
`=(?:'[^']*'|"(?:\\.|[^"\\])*"|[^\s'"]\S*)` — escape-aware.

**조치**: `origin/main` 병합. 훅은 자동 병합됐고(escape-aware 패턴 흡수 + 내 스코핑 4지점 유지),
`.claude/tests/README.md` 만 충돌 — 양쪽이 각자 카탈로그 행을 추가해서다. **양쪽 행을 모두 보존**
하고 중복 1건만 제거했다(#1001 의 `test_guard_default_branch_bash_mutating.py` + 내
`test_push_guard_worktree_scope.py` 공존).

병합 후 재확인 3가지(리뷰어 요구):
1. `_GIT_PUSH` 가 escape-aware 버전 — **확인**(`:115` 이하).
2. §J 코퍼스(`test_push_guard_allowlist.py`)와 내 스코핑 테스트 **공존 green** — 확인
   (**564 passed / 325 subtests**, 병합 전 540 → §J 테스트 유입분 포함).
3. README 카탈로그가 **두 PR 행을 모두** 반영 — 확인.

## WARNING 5건

| # | 조치 |
|---|---|
| **2** `BYPASS_PLAN_GUARD` scoped 억제 미검증 (REVIEW 와 비대칭) | **반영** — `test_bypass_plan_also_suppresses_a_scoped_block` 추가. 리뷰어 지적대로 **이 파일은 같은 비대칭에 이미 한 번 당했다**(17_28_02 WARNING 1: PLAN 게이트 스코핑이 통째로 미검증) |
| **3** 회귀 테스트 docstring 의 리뷰 라운드 오귀속 | **반영** — `test_push_targets_crash_falls_back_to_cwd` 의 `(17_51_28 WARNING 1)` → `(18_06_41 WARNING 1)`. 이 저장소는 라운드 인용을 감사 이력으로 다루므로 오귀속은 추적을 엉뚱한 세션으로 보낸다 |
| **1** `_run_gates` REVIEW/PLAN 블록 중복 | **미조치 (근거 유지)** — 그 골격은 **#999 가 소유한 코드**다. 내 병합은 그 안에 `_evaluate_over_targets` 호출만 끼워 넣었고, 재추출하면 #999 가 방금 세운 구조를 이 PR 이 되돌리는 셈이라 병합 표면만 키운다. 리뷰어도 "별도 커밋 가능 / 이번 병합을 막을 사안 아님" 으로 분류 |
| **4** 게이트 인터페이스가 `Protocol` 대신 런타임 추론 | **미조치** — `AcceptsCwdContractTest` 가 실제 두 함수의 시그니처를 고정하고 있고(M8 이 17건 kill 로 load-bearing 확인), `Protocol` 도입은 `_lib` 계약 변경이라 별건. 리뷰어도 "필수 아님" |
| **5** `Decision.blocked` vs `Plan.untouched` 필드명 불일치 | **미조치** — 두 dataclass 는 `_lib` 소유다. 공통 `blocked` property 추가는 그 모듈의 계약 변경이라 이 PR 범위 밖 |

## INFO 9건

전부 확인형이거나 낮은 우선순위(타입힌트·`SoR:` 경로·`result is None` pin·`_lib` 추출 등).
INFO 1(ReDoS 실측 선형 확인)·INFO 9(스코핑 기능 요구사항 완전 충족, 23건+540건 green)는 양성 확인.

## 검증

- harness 전체 **564 passed / 325 subtests** (§J 코퍼스 유입 후).
- mutation **11건 전수 재실행**: 전부 의도한 테스트만 red, 원복 후 base 와 byte-identical.
  §J 병합이 스코핑 매트릭스를 훼손하지 않음을 확인.
- 신규 테스트 **24건**(BYPASS_PLAN 대칭 1건 추가).

## 다음 라운드

코드가 실질 변경(§J 병합 + 테스트 1건)됐으므로 fresh 리뷰 1회.
