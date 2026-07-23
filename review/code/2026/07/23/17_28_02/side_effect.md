# 부작용(Side Effect) 리뷰 — push-guard-worktree-scope

## 발견사항

- **[INFO]** 새 subprocess 호출이 훅의 동기 critical path 에 추가됨
  - 위치: `.claude/hooks/guard_review_before_push.py:356-363` (`_worktree_branches` 내부 `subprocess.run(["git", "worktree", "list", "--porcelain"], ...)`)
  - 상세: 모든 `git push` Bash 호출마다 새로운 `git` 서브프로세스가 1회 spawn 된다. PreToolUse 훅은 동기적으로 Bash 툴 콜을 막으므로, 이 subprocess 는 순수 로컬 read-only 명령(네트워크 호출 아님)이지만 지연시간을 추가한다. `timeout=5.0` 과 `except Exception: return []` 로 hang/실패 시 fail-open 되도록 이미 방어돼 있어 위험도는 낮음.
  - 제안: 별도 조치 불요. 다만 워크트리 수가 많은 저장소(현재 15개)에서 `git worktree list` 자체가 느려질 경우를 대비해, 이 5s 타임아웃이 실제 CI/로컬 환경에서 충분한지 정도만 인지해 두면 됨.

- **[INFO]** `evaluate_review` / `evaluate_plan` 이 push 1회당 최대 N회(=target 개수) 반복 호출됨
  - 위치: `.claude/hooks/guard_review_before_push.py:505-520` (REVIEW gate), `523-540` (PLAN gate)
  - 상세: 기존에는 `evaluate_review()` / `evaluate_plan()` 이 push 1회당 정확히 1회 호출됐다. 이번 변경으로 `scoped=True` 인 경우 `targets`(cwd + 명령이 언급한 branch 의 worktree) 각각에 대해 반복 호출된다. 두 함수 모두 내부적으로 `git status`/`git diff`/디렉터리 walk 등 read-only I/O 를 수행하므로(직접 grep 확인: `_lib/review_guard.py`/`_lib/plan_guard.py` 에 파일 쓰기 코드 없음) 상태를 변경하는 부작용은 없지만, target 수에 비례해 read I/O 및 subprocess 호출 총량이 늘어난다. 설계 문서(plan) 상 target 은 "cwd + 명령이 실제로 이름을 언급한 branch" 로 제한되어 있어 실사용 범위에서는 보통 1~2개로 bounded.
  - 제안: 의도된 설계이며 별도 조치 불요. 다만 다수 branch 를 한 커맨드에 언급하는 특이 케이스(예: `git push origin a b c`)가 실제로 유효한 git push 문법은 아니지만, 커밋 메시지 등에 여러 branch 이름이 우연히 등장하면 target 수가 늘어 호출 비용이 커질 수 있음 — 문서화된 trade-off("stricter, never weaker")와 일치하므로 CRITICAL 아님.

- **[INFO]** 예외 처리(fail-open) 세분화 방향이 "게이트 단위" → "target 단위" 로 변경됨
  - 위치: `.claude/hooks/guard_review_before_push.py:508-513` (REVIEW), `526-531` (PLAN)
  - 상세: 변경 전에는 `evaluate_review()` 호출이 예외를 던지면 `decision = None` 으로 게이트 전체가 fail-open 되어 그 push 는 통과했다. 변경 후에는 하나의 target 평가가 예외를 던져도 `continue` 로 다음 target 을 계속 평가하고, 다른 target 이 `blocked=True` 를 반환하면 최종적으로 **차단**된다. 즉 이전엔 "게이트 함수가 한 번이라도 죽으면 무조건 통과" 였던 것이, 이제는 "어느 한 target 평가가 죽어도 다른 target 의 정상 판정이 살아있으면 그 판정을 따른다" 로 바뀌어 더 엄격해졌다. 의도된 방향(문서·주석에 "fail open on internal error — check the next target" 로 명시)이며 버그는 아니지만, 예외 발생 시 최종 동작이 실제로 달라지는 관찰가능한 부작용이라 기록해 둠. target 이 하나뿐인(cwd-only) 기존 케이스에서는 동작이 완전히 동일하므로 회귀는 없음.
  - 제안: 별도 조치 불요 — plan 문서·docstring 에 이미 근거가 기술돼 있고 mutation 테스트(M1~M4)로 커버됨.

- **[INFO]** 차단 stderr 메시지 포맷에 `worktree:` 라인 추가 — 포맷 문자열의 필수 키가 늘어남
  - 위치: `.claude/hooks/guard_review_before_push.py:447`, `470` (`_REVIEW_MSG`/`_PLAN_MSG` 에 `"  worktree:  {worktree}\n"` 추가), 호출부 `514-518`, `532-538`
  - 상세: `_REVIEW_MSG.format(...)`/`_PLAN_MSG.format(...)` 이 이제 `worktree=` kwarg 를 요구한다(누락 시 `KeyError`). 두 상수와 그 `.format()` 호출부가 모두 이 파일 안에서만 쓰이는지 grep 으로 확인했고, 다른 파일에서 이 문자열을 재사용하거나 정확한 stderr 텍스트를 파싱하는 곳도 없음을 확인함(`grep -rl "BLOCKED by .claude/hooks/guard_review_before_push"` → 이 파일 1건뿐). 외부 인터페이스 영향 없음.
  - 제안: 없음 — 정보성 기록.

- **[INFO]** 새 입력 필드 `payload["cwd"]` 를 읽기 시작함
  - 위치: `.claude/hooks/guard_review_before_push.py:494-497`
  - 상세: 기존에는 훅이 stdin JSON 에서 `tool_input.command` 만 읽었으나, 이제 최상위 `cwd` 키도 읽는다. 이 키가 payload 에 없으면 `os.getcwd()` 로 fallback 하므로 하위 호환은 유지된다. 동일 패턴이 `.claude/hooks/normalize_worktree_branch.py:52` 에도 이미 존재해(`payload.get("cwd") or os.getcwd()`) Claude Code 훅 payload 계약에 `cwd` 필드가 실제로 존재함을 교차 확인함 — 근거 없는 가정이 아님.
  - 제안: 없음.

## 요약

이번 변경은 push 가드가 평가하는 "worktree" 범위를 cwd 단일에서 cwd + 명령이 명시적으로 언급한 branch 의 worktree(들)로 확장하는 정합성 수정이다. 새로 추가된 부작용은 (1) `git worktree list` subprocess 1회 추가 spawn, (2) `evaluate_review`/`evaluate_plan` 이 target 수만큼 반복 호출되어 read I/O 가 늘어나는 것, (3) 예외 발생 시 fail-open 판정이 게이트 단위에서 target 단위로 세분화되는 것 — 세 가지 모두 로컬·read-only 이며 파일시스템 쓰기, 전역 변수, 환경변수 쓰기, 네트워크 호출은 전혀 도입되지 않았다. `evaluate_review`/`evaluate_plan` 의 시그니처(`cwd: str | None = None`)는 이 diff 이전에 이미 도입돼 있었고 `_accepts_cwd()` 런타임 probe 로 구버전 시그니처(무인자 stub)에도 안전하게 legacy 단일 호출로 degrade 하도록 설계돼 있어, 기존 `test_guard_review_before_push_main.py` 의 무인자 stub 스위트와도 충돌하지 않는다. `_REVIEW_MSG`/`_PLAN_MSG` 포맷 문자열에 `worktree` 키가 추가됐지만 이 모듈 내부에서만 소비되어 외부 인터페이스 파손은 없다. 전반적으로 fail-open/fail-safe 방향이 일관되게 유지되어 있고, CRITICAL·WARNING 급 부작용은 발견되지 않았다.

## 위험도
LOW
