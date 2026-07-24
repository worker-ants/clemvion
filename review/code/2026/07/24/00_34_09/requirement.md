# 요구사항(Requirement) 리뷰 — push 가드 worktree 스코프 (5차/병합 재이식 라운드)

## 검증 방법

프롬프트의 diff가 크기 제한으로 대부분 생략되어 있어, `git diff origin/main...HEAD`로 직접
재추출하고 핵심 파일(`.claude/hooks/guard_review_before_push.py`, `.claude/hooks/_lib/failopen_state.py`,
`.claude/tests/test_push_guard_worktree_scope.py`, `plan/in-progress/push-guard-worktree-scope.md`)을
`Read`로 전문 대조했다. 이번 라운드는 **병렬 세션(#999/#1000, fail-open 관측 §E)을 흡수하는
merge 재이식**(커밋 `feda5b219`) 직후 상태이므로, 과거 4라운드가 이미 검증한 부분은 재확인만 하고
merge로 새로 생긴 표면에 집중했다. 정적 분석에 그치지 않고 직접 실행했다:

- `python3 -m unittest discover -s .claude/tests -p 'test_push_guard_worktree_scope.py' -v` → **21 passed**
- `python3 -m unittest discover -s .claude/tests -p 'test_guard_review_before_push_main.py'` → **35 passed**
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` → **538 passed / 1 failed**
  (`test_line_anchors.py::test_diff_blocks_are_annotated_and_correct` — 이 diff 대상 파일이 아니고
  `git diff origin/main...HEAD --stat -- .claude/tests/test_line_anchors.py`도 빈 결과라 이번 코드
  변경과 무관. 이 리뷰 세션 자체가 만든 대형 `review/` 산출물이 그 self-referential 프롬프트-빌더
  테스트의 임계치에 우연히 걸린 것으로 보임 — 조치 불요, 오귀속 방지 차원에서만 기록)
- `_push_targets()`가 실패하는 시나리오를 별도 스크립트로 직접 재현해(아래 발견사항 1 참조)
  fail-open 관측 시스템이 실제로 반응하는지 실측했다.

## 발견사항

- **[WARNING]** `main()`의 `_push_targets()` 실패 폴백이 fail-open 관측(§E) 시스템에 전혀 기록되지
  않음 — 모듈 자신이 선언한 "Fail-open is OBSERVED, not silent" 계약과 상충하며, 이 PR이 닫으려는
  것과 같은 클래스의 false-ALLOW가 **완전 침묵** 속에 재발할 수 있는 경로
  - 위치: `.claude/hooks/guard_review_before_push.py:706-710` (`main()` 안의
    `try: targets = _push_targets(command, base_cwd) except Exception: traceback.print_exc(...);
    targets = [base_cwd]`), 대비: 같은 함수의 outer `except Exception as exc:` 블록(714-723행)은
    `_is_git_push`(push DETECTION) 실패를 `outcome.degraded.append(("DETECTION", ...))`로 명시적으로
    기록함
  - 상세: 모듈 최상단 docstring(25-37행)은 "Fail-open is OBSERVED, not silent... When a gate cannot
    answer — its module failed to import, `evaluate_*()` raised, or push detection itself blew up —
    the push is still allowed, but the hook prints an explicit banner and records the CONSECUTIVE
    count"라고 명시적으로 약속한다. `_push_targets()`는 push DETECTION(`_is_git_push`) 바로 다음
    단계로 "이 push가 어느 worktree(들)을 publish하는가"를 결정하는, 이 PR이 새로 추가한 핵심
    로직이다. 그런데 이 함수가 내부 오류(예: `os.path.realpath` 예외, `git worktree list` 파싱 중
    예기치 못한 값)로 raise하면 `main()`은 `traceback.print_exc()`만 하고 `targets = [base_cwd]`로
    조용히 폴백할 뿐, `outcome.degraded`에는 아무것도 추가하지 않는다. 실측(스크립트로
    `_push_targets`가 항상 raise하도록 패치하고 두 게이트를 모두 clean으로 응답시켜 재현): 훅은
    exit 0을 반환하고, stdout은 빈 문자열이며, `.claude/state/push_guard_failopen.json`(streak
    파일)은 **생성되지 않는다** — `_report_fail_open`이 보기에 두 게이트 모두 정상적으로 `answered`
    했으므로(축소된 스코프 위에서지만) "완전히 건강한 실행"으로 판정되어 배너도, 카운터 증가도
    없다. 결과적으로 이 PR이 실증까지 남기며 닫으려던 시나리오("cwd는 clean, 실제 push 대상
    worktree는 미리뷰")가, `_push_targets()`가 (드물게라도, 혹은 특정 저장소 토폴로지에서
    지속적으로) 실패하는 한 **아무 신호 없이 재발**할 수 있다. stderr의 traceback은 exit 0 경로에서는
    (모듈 docstring 자신이 명시하듯 "on exit 2 the refusal is read from stderr, while on exit 0 it is
    STDOUT that gets injected") 통상 노출되지 않는 채널이라, 실사용에서 이 실패는 사실상 보이지
    않는다. `_worktree_branches()` 자체의 fail-open(빈 리스트 반환, `test_worktree_listing_failure_
    degrades_to_cwd`로 검증됨)은 "추가 worktree를 못 찾음"이라는 원래 없던 이점의 상실이라 침묵이
    합리적이지만, `_push_targets()`(호출자 `main()`의 outer 레벨)의 실패는 그와 성격이 다르다 —
    이미 "무엇을 평가할지" 계산이 시작된 뒤 중간에 깨진 것이고, 이 함수는 push DETECTION과 구조적으로
    대칭인 새 필수 단계(같은 테스트 파일의 자체 docstring도 "Detection of 'is this a push at all'…
    main()'s gate ORDER/bypass/fail-open orchestration… Scope here: target SELECTION"이라며 DETECTION과
    target SELECTION을 별개 관심사로 명시적으로 구분한다)인데, DETECTION 실패는 관측되고 target
    SELECTION 실패는 관측되지 않는 비대칭이 남아 있다. plan 문서의 "origin/main 재구조화 흡수" 절도
    이 gap을 언급하지 않는다.
  - 제안: `main()`의 `except Exception:` 블록 안에서도 `outcome.degraded.append(("TARGET_SELECTION",
    f"{type(exc).__name__}: {exc}"))` (또는 기존 `_GATE_REVIEW`/`_GATE_PLAN`과 구분되는 별도 라벨)를
    기록해 `_report_fail_open`이 이 경우도 배너/스트릭 대상으로 인식하게 할 것. 다만 `_ALL_GATES`
    reset 로직(`set(outcome.answered) != all_gates`)에는 영향을 주지 않도록 `degraded`에만 추가하면
    된다(이미 `degraded` 비어있지 않으면 무조건 보고하는 기존 규약과 자연히 맞음). 회귀 테스트로
    `_push_targets`를 raise시키고 streak 파일이 생성되는지 단언하는 케이스 1건 추가를 권장(기존
    `test_push_targets_crash_falls_back_to_cwd`는 exit code만 확인하고 관측 여부는 확인하지 않음).

- **[WARNING]** `_mentions_branch` 기반 매칭은 push 명령이 대상 branch 이름을 **텍스트로 언급하지
  않는** 흔한 패턴(`cd <다른-worktree> && git push` — 이미 upstream tracking이 설정된 이후의 통상적인
  bare push)에서는 무력하여, 이 PR이 닫으려는 것과 동일한 클래스의 false-ALLOW가 그대로 남는다
  (security.md가 독립적으로 발견한 것과 동일 지점 — 여기서는 요구사항 충족 관점에서 재확인·보강)
  - 위치: `.claude/hooks/guard_review_before_push.py:414-431`(`_mentions_branch`), `:459-477`
    (`_push_targets`), 설계 코멘트 `:344-376`
  - 상세: 이 수정의 전체 메커니즘은 "체크아웃된 각 branch에 대해, 그 이름이 명령 **텍스트**에
    리터럴로 등장하는가"라는 blind substring 매칭 하나에 의존한다. 그런데 이 프로젝트가 트리거로
    든 실제 시나리오(plan 문서 3-8행 "에이전트가 `cd <다른-worktree> && git push origin <그 branch>`를
    일상적으로 한다")와 달리, git의 통상적 사용 패턴은 최초 `git push -u origin <branch>`로 upstream을
    설정한 뒤에는 이후 `git push`만으로 충분하다 — 이 경우 command 텍스트 어디에도 branch 이름이
    등장하지 않는다. 이때 `_worktree_branches`가 그 worktree를 정확히 열거하더라도 `_mentions_branch`가
    모든 branch에 대해 False를 반환하므로 `_push_targets`는 `[cwd]`만 돌려주고, 실제 push 대상
    worktree는 평가되지 않는다 — 이것이 정확히 이 PR이 "2026-07-23 실측: clean cwd에서 push하면
    게이트가 통째로 건너뛰어진다"며 닫으려던 구멍이다. `git push` bare 사용은 `-u`/tracking을 이미
    설정한 반복 작업에서 매우 흔한 패턴이라 이론적 코너케이스로 치부하기 어렵다. plan 문서의
    "Rationale > 남은 갭(의도)" 절(184-186행)은 "체크아웃되지 않은 branch를 push하는 경우"만
    의도적 잔여 갭으로 명시하고 있고, "checkout은 됐지만 명령에 이름이 없는 bare push" 케이스는
    문서 어디에도 인지·서술되어 있지 않다 — 즉 알고 배제한 스코프가 아니라 발견되지 않은 갭으로
    보인다. 테스트 스위트 전체(`test_push_guard_worktree_scope.py`)를 확인한 결과도 모든 e2e
    케이스가 `git push origin <branch>` 또는 `git push origin HEAD`처럼 명시적으로 branch를 언급하는
    커맨드만 사용하며, 이 bare-push 패턴을 재현하는 테스트는 없다.
  - 제안: (a) 최소한 plan 문서의 "남은 갭" 절에 이 케이스를 명시적으로 추가해 "알려진, 의도적으로
    수용한 잔여 위험"으로 격상시킬 것(문서화만으로도 이번 PR의 "false ALLOW 완전 차단"이라는 함의를
    "명시적 branch 언급이 있는 push에 한해 차단"으로 정확히 좁혀 향후 오해를 방지). (b) 가능하다면
    보강책 검토: `git rev-parse --abbrev-ref HEAD`로 각 worktree의 현재 branch를 이미 열거하고 있으므로
    (`_worktree_branches`), cwd worktree 자신의 현재 branch에 대해 그 upstream이 설정돼 있는지와
    무관하게 이미 cwd는 항상 평가 대상이라 cwd 자신의 bare push는 문제없다 — 진짜 gap은 "cwd가 아닌
    worktree로 cd한 뒤 그 worktree에서 bare push"뿐이므로, 완전 해결은 어렵지만(그 경우 명령
    텍스트만으로는 원리적으로 알 수 없음 — `cd` 대상 경로만 텍스트에 있고 그 worktree의 branch
    이름은 없음) 적어도 `cd <path>` 형태로 텍스트에 등장하는 **worktree 경로**를 `_worktree_branches`가
    함께 돌려주는 경로 목록과 대조해 "경로가 언급되면 그 worktree도 target에 추가"하는 보조 규칙을
    고려할 것.

- **[WARNING]** README 테스트 카탈로그와 테스트 docstring이 merge로 사라진 함수명 `_run_gate`를
  여전히 현재형으로 인용 (documentation.md/testing.md/maintainability.md가 독립적으로 이미 발견 —
  요구사항 관점에서 "함수명·주석과 실제 구현의 일치" 항목으로 재확인)
  - 위치: `.claude/tests/README.md:47`, `.claude/tests/test_push_guard_worktree_scope.py:247`
  - 상세: `grep -n "_run_gate\b" .claude/hooks/guard_review_before_push.py`는 0건 — 이 브랜치가
    2차 리뷰(17_51_28)에서 추출했던 `_run_gate()`는 origin/main 재구조화 흡수 과정에서
    `_run_gates(outcome, targets)` + `_evaluate_over_targets(...)`로 대체되었다(plan 문서
    144-173행이 스스로 서술). 그러나 위 두 곳은 여전히 옛 이름을 "`_run_gate`'s per-target
    `continue`"라고 현재형으로 서술한다. `test_tests_readme_catalog.py`는 행의 존재(파일명)만
    검사하고 본문 내용은 검사하지 않아 이 드리프트는 어떤 자동 가드에도 걸리지 않는다.
  - 제안: 두 곳 모두 `_evaluate_over_targets`로 정정. (이미 다른 리뷰어가 상세히 다뤘으므로 중복
    조치는 1회로 충분.)

## 검증한 항목 (문제 없음)

- REVIEW/PLAN 두 게이트가 참조하는 필드명을 실제 `_lib/review_guard.py::ReviewDecision`
  (`blocked`/`reason`, 155-157행)과 `_lib/plan_guard.py::PlanDecision`(`untouched`/`reason`/
  `plan_path`, 78-84행)에 직접 대조 — `_run_gates`의 `is_blocked=lambda d: d.blocked` /
  `is_blocked=lambda pl: pl.untouched` 등 람다가 참조하는 필드명·타입이 정확히 일치.
  `evaluate_review(cwd: str | None = None)` / `evaluate_plan(cwd: str | None = None)` 시그니처도
  `_accepts_cwd`가 기대하는 계약과 일치함을 직접 확인.
- `main()`의 모든 반환 경로(non-push → 0, REVIEW block → 2, PLAN block → 2, 정상 종료 → 0, 최상위
  예외 → 0)가 빠짐없이 `int`를 반환. `finally`의 `_report_fail_open`은 모든 경로에서 실행됨을
  함수 구조로 확인.
- "gate당 1회만 degraded 기록"(merge로 새로 필요해진 불변식, M9)이 `_evaluate_over_targets`
  624-625행과 전용 회귀 테스트 `test_degradation_is_counted_once_per_gate_not_per_target`
  양쪽에 정확히 반영됨을 직접 실행으로 재확인(streak=1, "REVIEW gate" 배너 정확히 1회).
- per-target fail-open(한 worktree의 예외가 나머지 target 평가를 막지 않음)이 실제 코드
  (622-626행 `continue`)와 `test_per_target_fail_open_still_checks_remaining_targets`로
  여전히 유지됨을 확인 — merge로 되돌아가지 않았다.
- `.claude/tests/test_guard_review_before_push_main.py`(legacy 무인자 스텁 스위트, 이 diff에서
  미변경)가 새 `targets` 파라미터를 요구하는 `_run_gates(outcome, targets)` 시그니처 변경 후에도
  35건 전량 통과 — 레거시(비-스코프) 호출 경로가 이번 재이식으로 깨지지 않았음을 직접 재실행으로
  확인.
- TODO/FIXME/HACK/XXX 주석: 핵심 3개 파일(hook 본체, 신규 테스트, plan 문서) 전체에서 0건.
- 관련 spec 문서 없음 — 정상. `spec/`을 `grep -rl "guard_review_before_push"`로 재확인해도 0건.
  CLAUDE.md 폴더 구조상 `spec/`는 제품(`codebase/`) 정의이고 `.claude/hooks/` 하네스 자동화는 그
  범위 밖이라 기대된 결과(spec drift 아님).
- 체크리스트 "테스트 21건"을 `grep -c "    def test_"`로 직접 재실행해 실측 일치 확인.

## 요약

핵심 요구사항(push 가드가 cwd뿐 아니라 push 명령이 언급한 다른 checked-out worktree도 평가하도록
확장) 자체는 코드·테스트·plan 문서 사이에 line-level로 정확히 구현되어 있고, 병렬 세션(#999/#1000)의
fail-open 관측 구조와의 재이식도 두 핵심 불변식(gate당 1회 degraded 기록, per-target fail-open)을
동시에 만족시키며 전용 회귀 테스트(M9 대응)로 고정되어 있음을 직접 실행으로 확인했다. 다만 이번
라운드에서 요구사항 충족 관점의 실질적인 갭 두 가지를 새로 발견했다: (1) 이 PR의 새 핵심 로직인
`_push_targets()`가 실패할 경우 스코프가 조용히 cwd-only(정확히 이 PR이 고치려던 취약 상태)로
되돌아가는데, 모듈 자신이 선언한 "fail-open은 절대 침묵하지 않는다"(§E) 관측 시스템이 이 경로를
전혀 인지하지 못함을 실측으로 확인했다 — DETECTION 실패는 관측되지만 구조적으로 대칭인 target
SELECTION 실패는 관측되지 않는 비대칭. (2) 이 수정의 핵심 메커니즘(`_mentions_branch`)은 push
명령이 대상 branch 이름을 텍스트로 언급할 때만 작동하는데, upstream tracking이 설정된 뒤의 통상적인
bare `git push`(branch 이름 생략)에서는 무력해 false-ALLOW가 재발할 수 있고, 이는 plan 문서가
명시한 "의도된 잔여 갭"(체크아웃되지 않은 branch)과는 다른, 문서화되지 않은 케이스다. 두 항목 모두
즉각적인 단일 push 오판을 유발하지는 않지만(전자는 cwd는 여전히 검사되고, 후자도 cwd는 항상
검사됨), 이 PR이 정확히 겨냥한 "정상 상태인데도 통과되는" false-ALLOW 클래스가 각각 다른 조건에서
조용히 재발할 수 있는 경로라 WARNING으로 기록한다. 그 외 README/테스트 docstring의 `_run_gate`
이름 드리프트는 다른 리뷰어가 이미 발견한 것과 동일 지점이라 간단히 재확인만 했다. CRITICAL은
없다 — 모든 발견사항이 "완전 미검사"가 아니라 "의도한 것보다 좁은 검사 범위로의 조용한 축소"이며,
cwd 자체는 모든 경로에서 항상 검사된다.

## 위험도

MEDIUM
