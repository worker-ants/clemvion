---
worktree: push-guard-worktree-scope-20044c
started: 2026-07-23
owner: developer
---

# push 가드 worktree 스코프 — 교차-worktree false ALLOW 차단

> 작성일: 2026-07-23
> 트리거: 2026-07-23 세션에서 `claude/presentation-previousoutput-spec-drift-e74b2f`(PR #997) push 가
> **정상 상태인데도 차단**된 사건. 진단 결과 반대 방향의 **false ALLOW** 가 함께 있었다.
> 선행: [#992](https://github.com/worker-ants/clemvion/pull/992) (push 탐지 blind 1차 + allowlist)

## 문제 — 게이트가 "push 되는 worktree" 가 아니라 "훅의 cwd" 를 평가한다

두 게이트(`review_guard` / `plan_guard`)는 **worktree**(HEAD + working tree)를 평가한다. 그런데
`guard_review_before_push.py` 는 `evaluate_review()` 를 **인자 없이** 호출해 훅 프로세스의 cwd 를
본다. 이 저장소는 모든 작업이 `.claude/worktrees/<task>-<slug>/` 에 있고(현재 15개), 에이전트가
`cd <다른-worktree> && git push origin <그 branch>` 를 일상적으로 한다 — 그때 훅의 cwd 는 **push
대상과 다른 worktree** 다.

| 방향 | 결과 |
|---|---|
| cwd 는 리뷰 중, push 대상은 clean | **false BLOCK** — 성가시지만 안전 |
| cwd 는 clean, push 대상은 미리뷰 | **false ALLOW** — **리뷰 게이트가 실제로 우회된다** |

**실측 (2026-07-23)**:

```
evaluate_review(<갓 만든 clean worktree>)          → blocked=False
evaluate_review(<게이트 미해소 branch 의 worktree>) → blocked=True
```

즉 clean worktree 에서 push 를 실행하면 게이트가 통째로 건너뛰어진다. 이게 이번 수정이
편의가 아니라 **정합성 수정**인 이유다.

## 설계 — blind 텍스트 매칭, 파서 아님

`_is_git_push` 는 의도적으로 blind 다(그 docstring: 2026-07-17 shlex 재작성은 라운드마다 새
false-negative 클래스가 나와 **철회**됐다). 같은 철학을 지킨다 — **refspec 을 파싱하지 않는다.**
대신 체크아웃된 각 branch 에 대해 *"이 branch 이름이 명령 텍스트에 등장하는가"* 만 묻는다.

- 평가 대상 = **cwd(항상)** + **명령이 이름을 언급한 worktree**.
- 경계 매칭(`[A-Za-z0-9._/-]` 이웃 금지)이라 짧은 이름이 긴 토큰 안에서 오탐되지 않는다
  (`claude/foo` ≠ `claude/foo-abc`).
- 커밋 메시지에 branch 이름이 있으면 그 worktree 도 평가된다 → **더 엄격해질 뿐 약해지지 않는다**.
  blind push 정규식이 이미 하는 것과 같은 거래다.
- 체크아웃 안 된 branch 를 push 하면 추가 커버리지는 없다(평가할 working state 가 없다) —
  동작은 정확히 기존과 동일, **회귀 없음**.

### 시그니처 probe 가 load-bearing 이다

초안은 `evaluate_review(target)` 를 그냥 호출하고 예외를 `except Exception: continue` 로 삼켰다.
그 결과 **stub 게이트(무인자)가 TypeError 를 내며 게이트가 조용히 사라져** 기존 blocking 테스트
9건이 전부 exit 0 이 됐다. 시그니처 불일치를 fail-open 으로 만들면 안 된다 →
`_accepts_cwd()` 로 명시 probe 하고, 미지원이면 **legacy 단일-worktree 호출로 degrade**
(수정보다 약하지만 기존 동작보다 약하지 않다).

## 부수 개선

차단 메시지에 `worktree:` 줄 추가. 기존 메시지는 **어느 worktree 가 막았는지 안 밝혀** 이번 사건의
진단을 어렵게 만든 직접 원인이었다.

## 1차 리뷰(17_28_02) 반영 — MEDIUM / C0 / W7

| WARNING | 조치 |
|---|---|
| 1 PLAN 게이트 스코핑 미검증 | `_PLAN_STUB` 을 경로-키 방식으로 바꾸고 `test_plan_gate_is_scoped_too` 외 2건 추가. **M1 이 이제 이 테스트도 kill** 한다 |
| 2 `_worktree_branches` fail-open 미검증 | `test_worktree_listing_failure_degrades_to_cwd`(비-repo cwd) · `test_stale_worktree_entry_is_skipped`(디스크에서 삭제된 worktree) 추가 |
| 3 `_push_targets` 실패 폴백 미검증 | 위 2번이 같은 경로를 커버 — 실패해도 cwd 검사는 살아있음을 단언 |
| 4 REVIEW/PLAN 루프 중복(DRY) | `_run_gate()` 공용 헬퍼로 추출. 두 불변식(게이트 격리 · target 단위 fail-open)을 docstring 에 명시 |
| 5 `_accepts_cwd` 계약 미고정 | **`AcceptsCwdContractTest`** — 실제 `evaluate_review`/`evaluate_plan` 이 positional cwd 를 받는지 단언 + keyword-only/무인자가 거부되는지 고정. 시그니처가 바뀌면 false-ALLOW 로 조용히 회귀하는 걸 막는 핵심 핀 |
| 6 mutation 수치 오기재 | **오탐** — §mutation 실측 각주 참조. 두 수치가 서로 다른 mutation 이며 재실측으로 양쪽 재현 |
| 7 길이 상한 부재 | `_MAX_REDACTION_INPUT` 절단 적용(파일 관례와 일관) + **M5 로 관측 가능하게 고정**. 초기엔 상한을 넣고도 테스트가 없어 mutation 이 생존했다 |

INFO 중 반영: 지역 import 를 모듈 top 으로(관례), `timeout=5.0` 근거 주석, legacy fallback 의
`worktree:` 표시를 실제 평가 대상(`os.getcwd()`)으로 정정.

## 2차 리뷰(17_51_28) 반영 — MEDIUM / C0 / W2

| WARNING | 조치 |
|---|---|
| 1 `_run_gate` per-target fail-open 무검증 | 리뷰어가 mutation(`continue`→`return False`)으로 **38/38 green** 실측. 재현 후 스텁에 `STUB_RAISE_PATHS` 추가 + `test_per_target_fail_open_still_checks_remaining_targets` 신설(M6). 첫 target 크래시가 게이트 전체를 통과시키던 클래스 |
| 2 `_run_gate(base_cwd)` 죽은 파라미터 | 제거. 남은 두 인자를 키워드 전용(`is_blocked=`/`render=`)으로 전환(INFO 11 동반). 주석의 `base_cwd` 언급도 "legacy fallback 은 인자 없이 호출 → **프로세스 cwd** 평가" 로 정정 |

## 3차 리뷰(18_06_41) 반영 — LOW / C0 / W2

| WARNING | 조치 |
|---|---|
| 1 `main()` 의 `_push_targets` 폴백 무검증 | **내 1차(17_28_02) RESOLUTION 이 이 경로를 "커버됨" 이라 주장했으나 틀렸다.** 기존 테스트는 `_worktree_branches` 자체의 fail-open 을 탈 뿐 `main()` 의 `except` 를 타지 않는다 — `targets = []` mutation 이 **39/39 green 생존**. `_push_targets` 를 실제로 raise 시키는 `test_push_targets_crash_falls_back_to_cwd` 신설(M7). 1차 RESOLUTION 의 과대 표기도 정정 |
| 2 plan 에 2차 반영 섹션 부재 | 본 절 + 위 2차 절 추가. 1차만 표로 기록돼 감사 추적이 비대칭이었다 |

INFO 미조치: 모듈 상단 docstring 요약 · `guard_review_before_stop.py` 제외 근거(Stop 훅엔 "지목할
다른 branch" 개념이 구조적으로 없다) · detached-HEAD 파싱 · target 보고 순서 · legacy `worktree:`
렌더값 단언 — 전부 리뷰어가 "급하지 않음/선택" 분류. `_GIT_PUSH` blind 오탐(이 PR 이 만든
`push-` 파일명이 `git log` 를 걸리게 함)은 **frozen 정규식이라 범위 밖**이고 방향이 안전한 쪽이다.

## 체크리스트

- [x] 구멍 실증 (두 worktree 대조 실측)
- [x] `_worktree_branches` / `_mentions_branch` / `_push_targets` 구현
- [x] `_accepts_cwd` 시그니처 probe (silent fail-open 차단)
- [x] 차단 메시지에 worktree 표기
- [x] 테스트 **21건** 신설 + 카탈로그 등재·갱신 (9 → 18 → 19 → 20 → 21, 마지막은 main 재구조화 흡수분)
- [x] mutation 실측 **9건** (병합 후 전수 재실행)
- [x] harness 전체 **538 passed** (main 병합 후)
- [x] `/ai-review` — **4라운드 수렴** (C0/W7 → C0/W2 → C0/W2 → C0/W1[문서]). 전량 반영, 4차 RESOLUTION 에 수렴 판정

> **교훈 — "커버된다" 는 추론이 아니라 실측이어야 한다.** 1차 후 "테스트로 커버" 라고 적었다가
> 2차가 PLAN 게이트 미검증을 찾았고, 같은 1차 RESOLUTION 의 다른 행에 "위 2건이 커버" 라고
> 적었다가 3차가 `main()` 폴백 미검증을 찾았다. 두 번 다 **내가 뮤턴트를 심은 지점만 커버로 세고, 이름·모양이 비슷한 인접
> 예외 경로를 같은 것으로 착각**했다(`_worktree_branches` 의 fail-open vs `main()` 의 fail-open은
> 서로 다른 분기다). 규칙: **"이 테스트가 커버한다" 고 쓰기 전에 그 경로에 뮤턴트를 심어 red 를
> 확인한다.**

## mutation 실측

원복은 백업 `cp` + 절대경로. base 는 **편집 후 재캡처**(stale base 로 미커밋 작업이 사라진 전례).

| # | mutation | red 가 된 테스트 |
|---|---|---|
| M1 | `_push_targets` 를 `[cwd]` 로 고정 (= 수정 전 동작) | `test_false_allow_hole_is_closed` · `test_plan_gate_is_scoped_too` · `test_branch_mention_past_the_cap_is_not_scanned` (**3건**) |
| M2 | `_mentions_branch` 경계 검사 제거 (평문 substring) | `test_substring_of_longer_branch_does_not_match` **단독** |
| M3a | `_accepts_cwd` probe 제거 — **review 게이트만** | legacy 스위트 **5건** |
| M3b | `_accepts_cwd` probe 제거 — **양쪽 게이트**(초안 상태 재현) | legacy 스위트 **9건** |
| M4 | `targets` 에서 cwd 제외 | `test_cwd_worktree_is_still_evaluated` **단독** |
| M5 | `_MAX_REDACTION_INPUT` 절단 제거 | `test_branch_mention_past_the_cap_is_not_scanned` **단독** |
| M6 | `_run_gate` per-target `continue` → `return False` | `test_per_target_fail_open_still_checks_remaining_targets` **단독** (2차 리뷰 전에는 **38/38 생존**) |
| M7 | `main()` 의 `_push_targets` 폴백 → `targets = []` | `test_push_targets_crash_falls_back_to_cwd` **단독** (3차 리뷰 전에는 **39/39 생존**) |

> **M3 의 "5건 vs 9건" 은 모순이 아니다** (리뷰 17_28_02 WARNING 6 은 이 지점의 오탐):
> 두 수치는 **서로 다른 mutation** 이다. 코드 docstring 이 말하는 "9 blocking tests" 는 probe 가
> 아예 없던 **초안**(양쪽 게이트 모두 무인자 stub 에 TypeError) 상태이고, plan 이 적은 "5건" 은
> review 게이트만 되돌린 M3a 다. 2026-07-23 재실측으로 **양쪽 다 재현**했다(M3a=5, M3b=9).
> 혼동을 없애려 표를 M3a/M3b 로 분리한다.

M1 이 3건을 kill 하는 이유: `test_branch_mention_past_the_cap_is_not_scanned` 는 "cap 안쪽 언급은
잡힌다" 는 대조 절반을 함께 단언하므로 스코핑이 죽으면 그쪽이 red 가 된다 — 의도된 중첩이다.

원복 후 mutation 마커 grep **0건**. 하네스는 앵커 미일치 시 `ANCHOR-FAIL` 로 **미적용을 보고**한다
(초기 라운드에서 앵커가 틀린 mutation 이 조용히 "생존" 으로 집계된 사고가 있었다 —
치환 실패 뮤턴트가 색깔을 오염시키는 그 클래스다).

## origin/main 재구조화 흡수 (2026-07-24)

작업 중 병렬 세션이 **같은 파일**을 재구조화해 머지했다 — #999(push 게이트 fail-open 관측 §E) ·
#1000(stop 게이트 관측 + 보고 로직 `_lib` 공유). 게이트 루프가 `_run_gates(outcome)` 로 바뀌면서
degraded/answered/bypassed 를 집계한다.

**내 수정은 대체되지 않았다**: 재구조화 이후에도 `evaluate_review()` 는 여전히 **무인자 호출**이라
교차-worktree false-ALLOW 구멍은 그대로였다. #999/#1000 은 fail-open 을 *관측*만 추가했다.

**해소 방식**: 병합 충돌 2블록을 마커 편집으로 때우지 않고, **main 구조를 base 로 채택하고 내
스코핑을 그 안에 재이식**했다. 내가 추출했던 `_run_gate` 헬퍼는 main 의 `_run_gates` 에 흡수돼
사라지고, 대신 `_evaluate_over_targets()` 가 **두 불변식을 동시에** 지킨다:

- **fail-open 관측(#999)** — 게이트가 답하지 못하면 `outcome.degraded` 에 **gate 당 1회** 기록.
  target 당 기록하면 worktree 3개 실패가 streak 3 으로 부풀어 #999 의 escalation 이 조기 발화한다.
- **per-target fail-open(스코핑)** — 한 worktree 오류는 그 worktree 만 건너뛴다. 여기서 early
  return 하면 첫 target 크래시가 게이트 전체를 통과시켜, 이 작업이 닫으려는 그 false-ALLOW 다.

`_accepts_cwd` · `_worktree_branches` · `_mentions_branch` · `_push_targets` 와 테스트는 그대로 살았다.

### 재실측에서 드러난 것

병합 후 매트릭스를 돌리자 **M9(gate 당 degraded dedup)가 생존**했다 — 병합 과정에서 내가 새로
넣은 불변식인데 테스트가 없었다. `test_degradation_is_counted_once_per_gate_not_per_target` 을
추가해 닫았다(두 target 모두 raise → streak 1, 배너에 gate 1회).

> **하네스 사고 (3번째)**: 첫 재실측에서 셸 함수가 **6개 mutant 전부 "생존"** 으로 보고했으나
> 수동 확인 결과 M1 은 4건을 kill 했다 — 보고가 거짓이었다. 셸 인자로 다중행 앵커를 넘기는 구조를
> 버리고, **적용 후 디스크에서 되읽어 검증하고 pytest 종료코드를 보는** 파이썬 러너로 교체했다
> (`scratchpad/pg/matrix.py`). 이 세션에서 치환-실패/거짓-색깔 계열 사고가 세 번째다.

## Rationale

**왜 "모든 worktree 평가" 가 아닌가**: 15개 worktree 중 하나라도 dirty 하면 모든 push 가 막힌다 —
사용 불가. cwd + 언급된 branch 로 한정하면 false ALLOW 는 닫으면서 실용성을 유지한다.

**왜 refspec 을 파싱하지 않는가**: `git push origin a:b`, `HEAD:refs/heads/x`, `--force-with-lease=…`
등 git 인자 문법 + 그 위의 셸 문법은 #970/#992 가 이미 무한 표면으로 판정한 영역이다. blind
substring 은 무지해서 안전하고, 틀리는 방향이 **항상 엄격한 쪽**이다.

**남은 갭(의도)**: 체크아웃되지 않은 branch 를 push 하는 경우는 커버하지 않는다. 평가할 worktree 가
없어 원리적으로 불가하며, 기존 동작 대비 회귀는 아니다.
