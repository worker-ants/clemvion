# 요구사항(Requirement) 리뷰 — push 가드 worktree 스코프

## 발견사항

- **[CRITICAL]** 리뷰 대상 브랜치가 `origin/main` 에 이미 병합된 push-탐지 버그 픽스(§J, #1001/#1002)를 흡수하지 못한 채, `_GIT_PUSH` 가 그 버그가 있던 구 버전 그대로다.
  - 위치: `.claude/hooks/guard_review_before_push.py:101-103` (`_GIT_PUSH = re.compile(...)`)
  - 상세: `git diff origin/main -- .claude/hooks/guard_review_before_push.py` 로 확인한 결과, 이 브랜치의 `_GIT_PUSH` 는
    ```
    r"(?:^|&&|;|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*git\b[^&;|]*\bpush\b"
    ```
    인데, `origin/main` 은 이미
    ```
    r"(?:^|&&|;|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=(?:'[^']*'|\"(?:\\.|[^\"\\])*\"|[^\s'\"]\S*)\s+)*git\b[^&;|]*\bpush\b"
    ```
    로 픽스돼 있다(커밋 `442ccc325` #1001, `ddd3633d4` #1002, 2026-07-24 00:23~00:57, 이 브랜치의 merge-base `93e7ac344` 이후 main 에 랜딩). 구 버전의 결함(§J, main 커밋 메시지 그대로): env 접두 스킵이 `=\S+` 라 **따옴표 안 공백에서 끊긴다** — `GIT_SSH_COMMAND="ssh -i ~/.key" git push origin main` 같은 흔한 SSH-키 지정 push 가 **아예 push 로 탐지되지 않아** `_is_git_push()` 가 `False` 를 반환하고 `main()` 이 `return 0` 으로 즉시 빠진다. 즉 REVIEW/PLAN 게이트는 물론 이 PR 이 구현한 worktree 스코핑 로직 자체도 전혀 실행되지 않는다 — fail-open 배너조차 없다(검출 자체가 "push 아님" 으로 판정되므로 §E 관측 대상도 아니다).
    같은 이유로 `.claude/tests/test_push_guard_allowlist.py`(§J 회귀 코퍼스·`EnvValueSubpatternSharedTest`)와 `.claude/tests/README.md` 의 해당 행(`test_push_guard_allowlist.py` 설명, `test_guard_default_branch_bash_mutating.py` 행)도 이 브랜치엔 없다 — `git diff HEAD origin/main -- .claude/tests/README.md` 로 확인.
    다행히 `git diff 93e7ac344..HEAD -- .claude/hooks/guard_review_before_push.py` (이 브랜치 자체 커밋들만의 diff) 는 `_GIT_PUSH` 정의 줄을 전혀 건드리지 않는다 — 즉 이 PR의 worktree-스코핑 로직 자체가 §J 를 되돌린 것은 **아니며**, 정상적인 `git merge`/rebase 는 충돌 없이 main 의 픽스를 흡수할 것이다. 하지만 **현재 커밋된 파일 그대로**는 이미 되돌려진(regressed) 상태이고, 이 상태로 push/머지되면 §J 가 막았던 게이트 우회가 재현된다.
  - 제안: 머지/push 전에 `origin/main` 을 이 브랜치에 병합(또는 rebase)해 `442ccc325`·`ddd3633d4` 를 흡수한다. 병합 후 (1) `_GIT_PUSH` 가 escape-aware 버전인지, (2) `test_push_guard_allowlist.py` 의 §J 코퍼스·`EnvValueSubpatternSharedTest` 가 이 PR 의 worktree-스코핑 테스트와 공존해 green 인지, (3) `.claude/tests/README.md` 카탈로그가 두 PR 의 행을 모두 반영하는지 재확인한다. `plan/in-progress/push-guard-worktree-scope.md` 의 "origin/main 재구조화 흡수(2026-07-24)" 절이 #999/#1000 흡수만 기록하고 이후 랜딩한 #1001/#1002 흡수는 기록하지 않는데, 그 사이에 실제로 싱크가 끊겼다는 신호와 일치한다.

- **[INFO]** 이 변경 영역(`.claude/hooks/**`, `.claude/tests/**`)을 규정하는 `spec/**` 문서를 찾지 못했다. `.claude/` 는 harness 인프라이며 CLAUDE.md 의 spec-linked 대상(`codebase/**`)이 아니어서 정상이다. 설계·요구사항의 단일 진실은 `plan/in-progress/push-guard-worktree-scope.md`(문제 정의·설계·4라운드 리뷰 반영표·11건 mutation 실측·Rationale)가 대신하며, 실제 파일(`guard_review_before_push.py`)의 인라인 docstring 이 그 설계를 line-level 로 정확히 반영한다(예: "false BLOCK/false ALLOW" 표, `_accepts_cwd` probe 의 load-bearing 근거, 잔여 갭 3종 — 모두 plan 문서 서술과 일치). spec 결함 아님.

- **[INFO]** worktree-스코핑 기능 자체(이 리뷰의 본 대상)는 기능적으로 완전하다. `_worktree_branches`/`_mentions_branch`/`_push_targets`/`_accepts_cwd`/`_evaluate_over_targets` 를 직접 검증:
  - `.claude/tests/test_push_guard_worktree_scope.py` 23건 전체 green (`python3 -m unittest discover -s .claude/tests -p 'test_push_guard_worktree_scope.py'`).
  - harness 전체 스위트 540건 green (`python3 -m unittest discover -s .claude/tests -p 'test_*.py'`) — §J 관련 신규 테스트가 부재하므로 이 카운트엔 §J 회귀 테스트가 포함돼 있지 않다(위 CRITICAL 항목과 연결).
  - 엣지 케이스 커버: 삭제된(stale) worktree 항목 skip(`_push_targets`의 `os.path.isdir` 가드), `git worktree list` 실패 시 cwd-only 로 fail-open degrade, target 단위 fail-open(첫 target 크래시가 나머지 target 평가를 막지 않음), `_MAX_REDACTION_INPUT` 절단 경계(정확히 cap 안/밖), `_mentions_branch` 의 경계 매칭(`claude/foo` ≠ `claude/foo-abc`, 문자열 시작/끝 boundary), `_accepts_cwd` 의 keyword-only/무인자 거부, PLAN 게이트도 REVIEW 와 동일하게 스코핑됨, `BYPASS_*` 가 스코핑된 차단에도 여전히 적용됨, §E fail-open streak 이 target 단위가 아닌 gate 단위로 1회만 집계됨.
  - 반환값: `main()` 은 모든 경로(정상/차단/import 실패/평가 예외/target 선택 실패/미확인 예외)에서 int(0 또는 2)를 반환하며 `finally` 로 `_report_fail_open` 이 항상 실행된다 — 모든 경로에서 관측이 보장된다.
  - 실제 게이트 함수 시그니처(`review_guard.evaluate_review(cwd: str | None = None)`, `plan_guard.evaluate_plan(cwd: str | None = None)`)를 직접 열람해 `_accepts_cwd` 의 positional-cwd 전제와 일치함을 확인했고, `AcceptsCwdContractTest` 가 그 실제 시그니처를 대상으로 고정한다.
  - `_lib/failopen_state.Outcome`/`report()`/`import_failure_reason()` 계약도 실제 정의와 hook 의 사용이 일치한다.

## 요약

이번 PR 이 직접 구현한 "push 가 발행하는 worktree(들)을 REVIEW/PLAN 게이트가 모두 평가하도록" 하는 기능 자체는 요구사항을 완전히 충족한다 — 문제(교차-worktree false ALLOW) 실증, 설계(blind 텍스트 매칭 + cwd/branch/path 매칭), 시그니처 안전장치(`_accepts_cwd`), fail-open 관측과의 통합(gate 당 1회 집계, per-target 격리)이 모두 코드·테스트·plan 문서 3자 일치로 확인됐고 23개 신규 테스트 + 하네스 전체 540건이 green 이다. 다만 이 브랜치가 커밋한 `.claude/hooks/guard_review_before_push.py` 는 현재 `origin/main` 에 이미 랜딩된 별도 픽스(§J, 따옴표 env 접두로 인한 push 미탐지 — 게이트 전체 우회)를 흡수하지 못한 상태이며, 이 PR 자체의 커밋들은 그 코드 라인을 건드리지 않아 정상적인 머지/rebase 로 자동 해소될 것으로 보이지만, **현재 커밋된 스냅샷 자체는 이미 알려진 게이트 우회 결함을 그대로 담고 있다.** 이를 먼저 동기화한 뒤 push/머지할 것을 권고한다.

## 위험도

CRITICAL
