# RESOLUTION — review/code/2026/07/23/17_28_02

대상: branch `claude/push-guard-worktree-scope-20044c` (base `origin/main`), 커밋 `65e7626fb`.
판정: **RISK=MEDIUM / CRITICAL=0 / WARNING=7 / INFO=16**. forced 7/7 확보(디스크 대조 누락 0).
`summary_written=false` 라 main 이 `SUMMARY.md` 직접 기록.

## WARNING 7건

| # | 조치 |
|---|---|
| **1** PLAN 게이트 스코핑 미검증 | **반영** — `_PLAN_STUB` 이 `untouched=False` 하드코딩이라 PLAN 이 "다른 worktree 를 보고 block" 하는 경로를 한 번도 안 탔다. 경로-키 방식으로 교체하고 `test_plan_gate_is_scoped_too`(+2건) 추가. 재실측 결과 **M1 이 이제 이 테스트도 kill** 한다 — 검증 공백이 실제였음이 확인됐다 |
| **2** `_worktree_branches` fail-open 미검증 | **반영** — `test_worktree_listing_failure_degrades_to_cwd`(git 아닌 cwd) · `test_stale_worktree_entry_is_skipped`(디스크에서 삭제된 worktree, `isdir` 방어 자극) |
| **3** `_push_targets` 실패 폴백 미검증 | **반영** — 위 2건이 같은 경로를 커버. 폴백 시에도 cwd 검사는 살아있음을 단언 |
| **4** REVIEW/PLAN 루프 DRY 위반 | **반영** — `_run_gate()` 추출. 유지해야 할 두 불변식(**게이트 격리**: 하나가 disabled/raise 해도 다른 하나가 죽지 않음 / **target 단위 fail-open**: 한 worktree 오류가 나머지 검사를 막지 않음)을 docstring 에 명시 |
| **5** `_accepts_cwd` 계약 미고정 | **반영** — `AcceptsCwdContractTest` 신설. 실제 `evaluate_review`/`evaluate_plan` 이 positional cwd 를 받는지 단언하고, keyword-only·무인자가 거부되는지도 고정. 시그니처가 바뀌면 **다른 테스트는 전부 green 인 채 false-ALLOW 로 회귀**하는 게 이 fix 의 최대 잔여 위험이었다 |
| **6** mutation 수치 오기재 | **근거 있는 미조치 — 오탐**. 아래 §오탐 판정 |
| **7** 길이 상한 부재 | **반영** — `_push_targets` 진입 시 `_MAX_REDACTION_INPUT` 절단(파일의 기존 방어 관례와 일관). 절단은 branch 언급을 **드롭만** 할 수 있고(→ 그 branch 에 한해 수정 전 동작) 새로 만들 수 없어 cwd 검사를 약화시키지 못한다 |

### WARNING 6 은 오탐 — 두 수치는 서로 다른 mutation 이다

리뷰어는 plan 의 "legacy 스위트 5건" 과 코드 docstring 의 "9 blocking tests" 가 불일치한다고
봤으나, **둘은 다른 변형을 가리킨다**. 2026-07-23 재실측으로 양쪽을 재현했다:

| 변형 | 결과 |
|---|---|
| M3a — `_accepts_cwd` probe 제거, **review 게이트만** (plan 이 문서화한 것) | **5 failed** |
| M3b — probe 제거, **양쪽 게이트** (docstring 이 서술한 초안 상태) | **9 failed** |

코드도 plan 도 자기 맥락에서 정확하다. 다만 혼동을 부른 건 사실이므로 plan 표를 M3a/M3b 로
분리하고 각주로 근거를 남겼다 — 수치를 "정정" 하지 않았다. 잘못된 쪽으로 고쳤다면 감사 기록이
오히려 거짓이 됐을 것이다.

## INFO 반영분

지역 `import subprocess`/`inspect` → 모듈 top(파일 관례, INFO 7) · `timeout=5.0` 근거 주석
(INFO 6) · legacy fallback 의 `worktree:` 표시를 실제 평가 대상 `os.getcwd()` 로 정정(INFO 3).

미조치: `_lib/` 레이어 분리(INFO 10 — 재사용처가 생기면), 모듈 상단 docstring 요약(INFO 8),
`guard_review_before_stop.py` 제외 근거(INFO 9), 다중-branch 언급 테스트(INFO 13) — 전부
비차단이며 리뷰어도 선택으로 분류.

## 검증

- 신규 테스트 **9 → 18건**. harness 전체 **485 passed / 253 subtests**.
- mutation **6건 재실측**:

| # | mutation | red |
|---|---|---|
| M1 | 스코핑 무력화(pre-fix 복원) | **3건** — false-ALLOW 핀 + **PLAN 스코핑** + cap 대조 |
| M2 | 경계 검사 제거 | substring 오탐 테스트 단독 |
| M3a / M3b | probe 제거 (review만 / 양쪽) | legacy 5건 / 9건 |
| M4 | targets 에서 cwd 제외 | cwd 평가 테스트 단독 |
| M5 | `_MAX_REDACTION_INPUT` 절단 제거 | cap 테스트 단독 |

- 원복 후 mutation 마커 grep **0건**.

## 하네스 사고 1건 (기록)

첫 재실측에서 N1(스코핑 무력화)이 "생존" 으로 보고됐는데 **실제로는 앵커가 안 맞아 치환이
적용되지 않은 것**이었다(셸 fallback 로직이 실패를 삼켰다). 앵커 불일치 시 `ANCHOR-FAIL` 을
출력하고 그 라운드를 미적용으로 표시하도록 하네스를 고친 뒤 재실행해 3건 kill 을 확인했다.
**치환 실패한 뮤턴트가 색깔을 오염시키는** 알려진 클래스이며, 같은 라운드에서 실제로 N4(cap)
생존도 함께 드러나 상한 테스트를 추가하게 됐다.

## 다음 라운드

코드·테스트가 실질 변경됐으므로 fresh `/ai-review` 1회. Critical 0 + 코드 Warning 0 이면
관례대로 수렴한다.
