# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 모든 `git push` 감지 시 신규 서브프로세스(`git worktree list --porcelain`)가 추가로 호출됨
  - 위치: `.claude/hooks/guard_review_before_push.py:396`, `:401-411` (`_worktree_branches`)
  - 상세: 기존에는 push 훅이 자체 gate(`evaluate_review`/`evaluate_plan`) 호출 외에 별도 프로세스를 스폰하지 않았다. 이번 변경으로 `_push_targets` → `_worktree_branches`가 `git push`로 판정된 모든 명령마다 `subprocess.run(["git", "worktree", "list", "--porcelain"], timeout=5.0)`을 무조건 실행한다. 이 프로세스는 로컬 git 메타데이터 read-only 조회이고 5초 타임아웃 + 예외 시 `[]` 반환(fail-open)으로 잘 경계되어 있어 정확성 문제는 없다. 다만 "PreToolUse(Bash)"가 모든 Bash 호출에 걸리는 훅이므로(실제로는 `_is_git_push`가 아닌-push는 조기 반환), push 커맨드 한정으로 매번 새 프로세스 기동 비용이 늘었다는 점은 side effect 관점에서 명시적으로 남겨둘 가치가 있다.
  - 제안: 현재 설계(문서화된 타임아웃 + fail-open)로 충분해 보임. 별도 조치 불요, 관찰만 해둠.

- **[INFO]** REVIEW/PLAN gate(`evaluate_review`/`evaluate_plan`)가 push 1회당 최대 N회(= 매칭된 worktree 타겟 수) 호출될 수 있음
  - 위치: `.claude/hooks/guard_review_before_push.py:617-661` (`_evaluate_over_targets`), 호출부 `:640`
  - 상세: 이전에는 gate 함수가 push마다 정확히 1회(hook의 cwd 기준) 호출됐다. worktree scoping 도입 후에는 `_push_targets`가 반환한 각 타겟(cwd + 커맨드가 언급하는 worktree)마다 `evaluate(target)`이 호출된다(단, blocked 판정이 나오면 그 타겟에서 즉시 short-circuit). `review_guard.evaluate_review`/`plan_guard.evaluate_plan`을 직접 확인한 결과 둘 다 파일시스템 쓰기·네트워크 호출이 전혀 없는 순수 read-only 함수(로컬 `git` subprocess + `os.walk`/glob 스캔만 수행)이므로 상태 오염이나 데이터 부작용 위험은 없다. 다만 `evaluate_review`는 `review/**`, `spec/**` 트리를 `os.walk`로 순회하므로, 커맨드가 여러 worktree를 명시하는 (드문) 경우 이 비용이 타겟 수에 비례해 증가한다 — 이 훅은 모든 push를 동기적으로 gate하므로 세션 체감 지연에 누적될 수 있다.
  - 제안: 실무상 대부분의 push는 타겟 1개(cwd)로 끝나 영향이 미미하다. 현재로선 조치 불필요 — 다만 향후 다중 worktree를 자주 명시하는 워크플로가 생기면 gate 호출 결과를 타겟 간 캐싱(동일 브랜치/커밋 상태면 재사용)하는 최적화를 고려할 수 있다는 점만 기록.

- **[INFO]** `main()`의 `finally: _report_fail_open(...)`가 push가 아닌 모든 Bash 호출에서도 실행되지만 실질적 부작용은 없음(검증됨)
  - 위치: `.claude/hooks/guard_review_before_push.py:753-758` (`main`), `_lib/failopen_state.py:112-121` (`report`)
  - 상세: `.claude/settings.json`의 PreToolUse matcher는 `Bash` 전체이므로 이 훅은 모든 Bash 호출마다 기동되고, `_is_git_push(command)`가 False여도 `try` 블록 안의 조기 `return 0`은 `finally`를 우회하지 못해 `_report_fail_open`이 항상 실행된다. 코드를 추적한 결과 non-push 경로에서는 `outcome.degraded`/`bypassed`/`answered`가 모두 비어 있어 `failopen_state.report()`의 첫 분기(`if not degraded: if outcome.bypassed or set(outcome.answered) != all_gates: return`)에서 아무 파일 쓰기·출력 없이 조기 반환한다 — 모듈 docstring이 명시한 "non-push … 는 'no evidence'로 두고 streak 를 건드리지 않는다" 설계와 일치. 실제 부작용(파일 쓰기·stdout/stderr 오염) 없음을 코드 레벨로 확인했으며, 신규 회귀는 아님(기존 §E 관측 설계의 일부).
  - 제안: 조치 불필요. 확인만 해둠(오탐 방지 목적의 기록).

- **[INFO]** 테스트가 실제 상태 파일(`.claude/state/push_guard_failopen.json`)에 쓰기를 유발할 수 있는 두 케이스는 `CLAUDE_PROJECT_DIR`로 격리됨(검증됨)
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:274-319`(`test_degradation_is_counted_once_per_gate_not_per_target`), `:342-389`(`test_target_selection_failure_is_counted_not_silent`)
  - 상세: `_lib/failopen_state.py:52-55`의 `state_path()`는 `CLAUDE_PROJECT_DIR` 환경변수(없으면 `os.getcwd()`)를 기준으로 상태 파일 경로를 정한다. 위 두 테스트만 `failopen_state.py`를 스텁 `_lib/`에 실제로 복사해 넣어 파일 쓰기 경로를 태우는데, 둘 다 서브프로세스 `env`에 `CLAUDE_PROJECT_DIR=self.tmp`를 명시적으로 넣어 실제 리포지토리의 `.claude/state/`를 오염시키지 않도록 격리하고 있다. 나머지 테스트는 `failopen_state` 모듈이 스텁 `_lib/`에 없어 import 실패 → `None` → print-only 폴백이라 쓰기 자체가 발생하지 않는다. 실제 production state 파일 오염 위험 없음을 확인.
  - 제안: 조치 불필요. 회귀 방지를 위해 이 패턴(신규 subprocess 테스트가 `failopen_state.py`를 끌어올 때는 항상 `CLAUDE_PROJECT_DIR` 격리)을 계속 지킬 것.

## 요약

핵심 변경(`_push_targets`/`_worktree_branches`/`_evaluate_over_targets`에 의한 push-gate의 multi-worktree 스코핑)은 새 로컬 서브프로세스 호출(`git worktree list`)과 기존 REVIEW/PLAN gate 함수의 반복 호출(타겟당 최대 1회)이라는 두 가지 side effect를 도입하지만, 둘 다 (1) read-only, (2) 타임아웃/fail-open으로 경계, (3) `evaluate_review`/`evaluate_plan` 자체에 파일 쓰기·네트워크 호출이 없음을 소스 확인으로 검증했다. 전역 상태 변경·새 전역 변수·공개 시그니처 파괴·환경변수 오·남용·의도치 않은 네트워크 호출은 발견되지 않았다. `main()`의 `finally` 기반 fail-open 리포팅이 모든 Bash 호출(비-push 포함)에서 실행되는 점, 그리고 신규 테스트가 실 상태 파일에 쓸 수 있는 두 지점 모두 각각 안전하게 처리(early-return / `CLAUDE_PROJECT_DIR` 격리)되어 있음을 코드 레벨로 재확인했다. 전반적으로 부작용 관점에서 차단 사유가 되는 CRITICAL/WARNING은 없다.

## 위험도
LOW
