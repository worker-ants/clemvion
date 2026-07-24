# 요구사항(Requirement) 리뷰 — push 가드 worktree 스코프 (3차/게이트, 18_06_41)

## 검증 방법

이 라운드는 `origin/main` 대비 누적 diff(3개 커밋: `65e7626fb` 원 fix → `4a516b03a` 1차 리뷰(17_28_02)
WARNING 7건 반영 → `942412ea3` 2차 리뷰(17_51_28) WARNING 2건 반영)를 대상으로 한다. 프롬프트가
파일 1(`guard_review_before_push.py`)·파일 3(`test_push_guard_worktree_scope.py`)의 diff 를 크기
제한으로 생략했으므로, 두 파일을 직접 `Read` 하여 현재 최종 상태를 라인 단위로 검증했다. 추가로:

- `.claude/tests/test_push_guard_worktree_scope.py` 단독 + `test_guard_review_before_push_main.py` +
  `test_push_guard_allowlist.py` 재실행: **75 passed, 139 subtests passed**.
- harness 전체(`python3 -m unittest discover -s .claude/tests -p 'test_*.py'`) 재실행: **486 tests, OK**
  — plan 체크리스트·커밋 메시지의 "486 passed" 주장과 정확히 일치.
- `_lib/review_guard.py::evaluate_review` / `_lib/plan_guard.py::evaluate_plan` 실제 시그니처(`cwd: str
  | None = None`)를 직접 Read 해 `_accepts_cwd` probe 가 실제 production 함수에 대해 `True` 를 반환함을
  재확인, `evaluate_review` 내부에서 `cwd` 가 `_repo_root(cwd)`/`_default_branch(cwd)`/
  `_merge_base(cwd, …)`/`_committed_code_changes(cwd, …)`/`_uncommitted_code_changes(cwd)` 로 실제
  전파됨을 확인(round-2 requirement 리뷰의 INFO 3 미확인분 해소 재검증).
- `spec/` 를 `push_guard`/`push-guard`/`worktree.*scope` 로 grep — 관련 문서 0건(스코프 밖, harness
  전용 변경이 맞는지 독립 재확인).
- `grep -n "TODO\|FIXME\|HACK\|XXX"` — 두 파일 모두 0건.
- `_run_gate`/`_push_targets`/`_worktree_branches`/`_mentions_branch`/`_accepts_cwd` 전체를 라인 단위로
  재대조하고 `main()` 배선(REVIEW→PLAN 순서, bypass, fail-open)과의 정합을 확인.

## 1·2차 리뷰 반영 상태 — 코드 레벨 최종 재검증

1차(17_28_02) WARNING 7건 + 2차(17_51_28) WARNING 2건 모두 코드에 실제로 반영되어 있음을 직접
대조로 확인했다(요약, 상세는 각 라운드 RESOLUTION.md 참조):

| 라운드 | WARNING | 최종 상태 |
|---|---|---|
| 1차 #1 | PLAN 게이트 스코핑 미검증 | `test_plan_gate_is_scoped_too`(+2건) 통과, 경로-키 stub 확인 |
| 1차 #2/#3 | fail-open 폴백 미검증 | `test_worktree_listing_failure_degrades_to_cwd` · `test_stale_worktree_entry_is_skipped` 통과 |
| 1차 #4 | REVIEW/PLAN 루프 DRY 위반 | `_run_gate()` 로 추출, 494-520행, 양쪽 재사용 확인 |
| 1차 #5 | `_accepts_cwd` 계약 미고정 | `AcceptsCwdContractTest` 3건, 실제 `evaluate_review`/`evaluate_plan` 대상으로 통과 |
| 1차 #6 | mutation 수치 "5건 vs 9건" | 오탐으로 판정·plan 표를 M3a/M3b 로 분리(코드 변경 불필요) — 근거 타당 |
| 1차 #7 | 길이 상한 부재 | `_push_targets` 439행 `command[:_MAX_REDACTION_INPUT]`, 테스트 2건 통과 |
| 2차 #1 | `_run_gate` per-target fail-open 무검증 | `test_per_target_fail_open_still_checks_remaining_targets` 신설, mutation(continue→return False) 재현 시 이 테스트 1건만 red 확인 |
| 2차 #2 | `_run_gate` 죽은 파라미터 `base_cwd` | 494행에서 제거, `is_blocked=`/`render=` 키워드 전용으로 전환 — 현재 시그니처 `def _run_gate(evaluate, bypass_env, targets, *, is_blocked, render) -> bool` 확인 |

## 발견사항

- **[INFO]** `_GIT_PUSH` 의 blind word-boundary 매칭이, 이 PR 자신이 만든 파일 경로("push-guard-worktree-scope")로
  인해 순수 `git log`/`git diff`/`git blame` 등 비-push 명령까지 오탐 차단할 수 있음을 실측으로 재현
  - 위치: `.claude/hooks/guard_review_before_push.py:70-72`(`_GIT_PUSH`, 이번 diff 로 수정된 패턴은 아님 — #992 부터 "DO NOT EDIT" 로 고정), 결과적으로 노출되는 대상은 `plan/in-progress/push-guard-worktree-scope.md` 등 이번 diff 로 신설된 경로
  - 상세: 이 리뷰 도중 `git log --oneline -- plan/in-progress/push-guard-worktree-scope.md` 를 실행했더니
    실제로 REVIEW 게이트가 발동해 차단됐다(`reason: 2 spec-linked file(s) changed AFTER the most recent
    --impl-done consistency report`). `_GIT_PUSH` 는 `git` 뒤 어디서든 `\bpush\b` 단어 경계 매칭을 찾으므로,
    파일명 `push-guard-worktree-scope.md`(하이픈은 비-단어문자라 `\b` 가 "push" 앞뒤에 성립)를 인자로 받는
    어떤 `git` 서브커맨드도 push 로 오분류된다. 이 정규식 자체는 이번 diff 의 변경 대상이 아니고("DO NOT
    EDIT this pattern" 주석, #992 부터 frozen) 이미 알려진 트레이드오프(과매칭 방향은 안전)이지만, 이번
    PR 이 신설한 파일/테스트/plan 이름(`push-guard-worktree-scope.md`,
    `test_push_guard_worktree_scope.py`)이 "push" 를 하이픈으로 경계 지어진 단어로 포함하는 바람에, 이
    저장소 안에서 그 경로를 인자로 받는 일상적 `git log`/`git blame`/`git diff -- <path>` 호출이 새로
    이 오탐 경로에 놓이게 됐다. 기능적 결함(코드가 틀린 것)이 아니라 이 PR의 네이밍이 기존에 알려진
    trade-off 를 우연히 더 자주 건드리게 만든 부작용이며, 방향은 항상 false BLOCK(안전한 쪽)이라 false
    ALLOW 회귀는 아니다.
  - 제안: 조치 불요(정규식은 이번 diff 범위 밖이며 "DO NOT EDIT" 로 고정됨). 참고로만 기록 — 향후 유사한
    하이픈-`push` 파일명을 이 저장소에 추가하는 작업자는 `git log -- <path>` 류 명령이 이 훅에 걸릴 수
    있음을 인지하면 좋음.

- **[INFO]** 모듈 최상단 docstring 이 여전히 cross-worktree 평가 계약을 요약하지 않음 (1차 documentation 리뷰 INFO 1, 미조치 상태 최종 확인)
  - 위치: `.claude/hooks/guard_review_before_push.py:1-24`(모듈 docstring) vs `:316-348`(신설 "Which
    worktree(s) does this push publish?" 설계 블록)
  - 상세: 상단 docstring 은 "REVIEW gate / PLAN gate 가 각각 하나의 override 를 갖는다" 수준으로만
    서술하고, 316행부터의 상세 블록(cwd 뿐 아니라 명령이 언급한 worktree 도 평가한다는 핵심 계약)을
    언급하지 않는다. 기능은 정확하지만 처음 파일을 훑는 사람에게 오해 소지가 남아 있다.
  - 제안: 조치 불요(비차단) — 상단 docstring 에 한 줄 요약을 추가하면 좋음. 코드 결함 아님.

- **[INFO]** `guard_review_before_stop.py` 는 여전히 `evaluate_review()`/`evaluate_plan()` 무인자 호출로,
  worktree 스코프 확장이 이 fix 대상(push 훅)에만 적용되고 자매 훅(Stop)에는 적용되지 않음 — 최종 상태
  확인, 구조적으로 타당한 스코프 제외
  - 위치: `.claude/hooks/guard_review_before_stop.py:247`(`evaluate_review()`), `:264`(`evaluate_plan()`)
  - 상세: Stop 훅은 "이 turn/세션이 끝나는 그 worktree 자체"를 판정하는 것이라 push 명령처럼 "다른
    branch 를 지목"할 대상이 없어 구조적으로 이번 fix 의 스코프 밖이라는 설명이 타당하다(1차
    documentation 리뷰와 동일 결론). 다만 그 판단이 코드·plan 어디에도 문장으로 남아있지 않아 향후
    "왜 Stop 훅은 안 고쳤는가"를 재조사하게 만들 소지는 여전히 남아 있다.
  - 제안: 조치 불요(비차단). 선택적으로 316행 블록 또는 plan 문서에 한 줄 근거를 남기면 재조사 비용을
    줄일 수 있음.

- **[INFO]** 관련 spec 문서 없음 — 정상 (harness 전용 변경, 독립 재확인)
  - 위치: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_worktree_scope.py` 전체
  - 상세: `spec/` 를 `push_guard`/`push-guard`/`worktree.*scope` 로 grep 한 결과 이 훅의 worktree 스코핑
    행위를 규정하는 spec 문서는 없다. CLAUDE.md 폴더 구조상 `spec/` 는 `codebase/` 제품 정의이고
    `.claude/hooks/` 하네스 자동화는 범위 밖이므로 기대된 결과다(SPEC-DRIFT 아님 — 애초에 대상 spec
    영역이 없음). `plan/in-progress/push-guard-worktree-scope.md` 가 설계 문서 역할을 하며, 본문(문제
    정의·설계·"시그니처 probe 가 load-bearing"·mutation 실측·Rationale)과 실제 구현(`_push_targets`/
    `_mentions_branch`/`_accepts_cwd`/`_run_gate`/`worktree:` 메시지 라인)을 재차 라인 단위로 대조해
    전부 일치함을 확인했다.
  - 제안: 조치 불요.

## 요약

핵심 기능(교차-worktree false-ALLOW 차단: cwd 뿐 아니라 push 명령이 이름을 언급한 다른 checked-out
worktree 도 REVIEW/PLAN 게이트가 평가하도록 확장)은 최종 상태(3개 커밋 누적)에서 정확히 구현되어
있으며, 1차·2차 리뷰에서 발견된 WARNING 9건(1차 7건 + 2차 2건) 전부가 코드·테스트 레벨에서 실제로
반영되었음을 직접 재대조·재실행으로 확인했다. 특히 이번 재검증에서 눈여겨본 지점(2차 WARNING #1,
per-target fail-open)은 이 PR 이 닫으려는 것과 같은 클래스의 false-ALLOW(첫 target 의 우연한 내부
오류만으로 실제 push 대상이 미검사 통과)였는데, `test_per_target_fail_open_still_checks_remaining_targets`
로 정확히 고정되어 있다. 반환값 누락, TODO/FIXME, 에러 시나리오 미정의, 데이터 유효성 검증 공백,
엣지 케이스(빈 worktree 목록·삭제된 worktree·detached HEAD·오버사이즈 커맨드·중복 worktree)의
미처리는 발견되지 않았다. 관련 spec 문서는 존재하지 않으며(harness 전용, 기대된 결과) SPEC-DRIFT
대상도 아니다. 새로 발견한 것은 전부 INFO 수준이며, 그중 하나(`_GIT_PUSH` blind 매칭이 이 PR 이 만든
"push" 포함 파일명과 상호작용해 무해한 `git log` 류 명령까지 오탐 차단할 수 있음)는 실측으로 직접
재현했으나 방향이 항상 안전한 쪽(false BLOCK)이고 정규식 자체가 이번 diff 범위 밖(frozen, "DO NOT
EDIT")이라 비차단이다. 나머지(모듈 docstring 미갱신, Stop 훅 스코프 제외 근거 미문서화)는 1차 리뷰부터
이미 알려진 채 의도적으로 비차단 처리된 항목의 최종 상태 재확인이다.

## 위험도
LOW
