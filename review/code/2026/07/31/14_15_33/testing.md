# Testing Review — harness-review-gate-fixes-1bd6aa

대상: `origin/main...HEAD` diff (`.claude/agents/**`, `.claude/hooks/**`, `.claude/skills/{code-review-agents,consistency-checker}/**`, `.claude/tests/**`, `plan/in-progress/**`). 프롬프트에 전문이 실리지 않은 대용량 파일(`review_guard.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`, `test_guard_review_before_push_main.py`, `test_review_guard_hardening.py`(후반부), `.claude/tests/README.md`)은 모두 `Read`/`git diff origin/main...HEAD -- <path>`로 직접 확인했다.

## 검증 방법 (요약)

- 관련 테스트 스위트 개별 실행: `test_consistency_bundle_priority.py`(18) · `test_review_changeset_warning.py`(12) · `test_prompt_omission_notice.py`(7) · `test_review_guard_hardening.py`(47) · `test_stop_guard_failopen.py`(17) · `test_guard_review_before_push_main.py`(38) — 전부 GREEN.
- `.claude/tests/` 전체 스위트: `python3 -m unittest discover -p "test_*.py"` → **702 tests, OK** (회귀 없음).
- 이 PR 의 핵심 CRITICAL 수정(`evaluate_review`의 `in_flight_ok` 스코핑)에 대해 **직접 뮤테이션 검증**을 수행했다: `.claude/hooks/_lib/review_guard.py`의 `if in_flight_ok and _code_review_in_flight(repo_root):` 를 `if _code_review_in_flight(repo_root):` 로 되돌리는 뮤턴트를 적용 → `test_review_guard_hardening.EvaluateInFlightShortCircuitTest.test_push_path_still_blocks_while_in_flight` 가 정확히 RED로 전환됨을 확인(`AssertionError: False is not true`). 이후 백업본으로 즉시 복원, `git status`/`git diff` 무변경 확인. plan 문서가 주장하는 "mutation 3종 RED" 중 핵심 1종이 실측으로 뒷받침된다.
- `_default_branch_ref()`의 실제 git 동작을 이 저장소에서 직접 probe(`orch._default_branch_ref()` 호출) → `origin/main` 정상 반환 확인 — 다만 이 확인이 회귀 테스트로 고정돼 있지는 않다(아래 발견 1).

## 발견사항

- **[WARNING]** `_default_branch_ref()` 신설 함수의 "성공" 경로 3갈래(`git symbolic-ref` 적중 / `origin/main` fallback / `origin/master` fallback, 및 전부 실패 시 `None`)가 어떤 테스트에서도 실행되지 않는다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 함수 `_default_branch_ref` (1190행 정의) / 테스트 `.claude/tests/test_review_changeset_warning.py` 클래스 `WarnIfCommittedWorkIsMissingTest`, 특히 `test_git_exceptions_are_absorbed_not_propagated` (122행)
  - 상세: `WarnIfCommittedWorkIsMissingTest`의 모든 테스트는 `orch._default_branch_ref = lambda: ARG["base"]`로 이 함수를 통째로 stub 처리하고, `test_git_exceptions_are_absorbed_not_propagated`만 실제 함수를 호출하되 `orch._git`을 예외 발생기로 바꿔 **실패 흡수 경로만** 검증한다. 같은 PR 이 추가한 자매 함수 `consistency_orchestrator._branch_changed_rels`는 `BranchChangedRelsAgainstRealGitTest`에서 실제 임시 git repo로 성공 경로(edit/addition/rename/unknown-base 4케이스)까지 pin 하는데, 새로 만들어진 이 브랜치-기본값 해석 함수는 그 대칭 처리가 빠졌다. 리뷰 중 직접 probe로 이 저장소에서는 정상 동작(`origin/main` 반환)을 확인했지만 회귀로 고정되지 않아, 향후 우선순위 변경이나 `refs/remotes/` 접두어 스트립 로직 변경이 조용히 깨질 수 있다.
  - 제안: `BranchChangedRelsAgainstRealGitTest`와 같은 임시 git repo 패턴으로 (a) `origin/HEAD` symbolic-ref 가 설정된 경우, (b) 없고 `origin/main`만 있는 경우, (c) `origin/master`만 있는 경우, (d) 아무 origin도 없는 경우 4케이스를 직접 pin.

- **[INFO]** 신규 `BranchChangedRelsAgainstRealGitTest._repo()` fixture 가 host 전역 git 설정(GPG 서명 등)으로부터 격리되지 않는다.
  - 위치: `.claude/tests/test_consistency_bundle_priority.py` 클래스 `BranchChangedRelsAgainstRealGitTest` (224행), 메서드 `_repo` (233행)
  - 상세: 이 fixture 는 실제 `git commit`을 수행하지만 `subprocess.run(["git", *args], cwd=d, check=True, ...)` 호출에 격리 `env`를 넘기지 않아 host 의 전역/시스템 git 설정을 그대로 상속한다. 바로 이 PR 이 손댄 `test_review_guard_hardening.py`의 자매 fixture `RebaseAuthorDateTest._git` (253/271행)는 정확히 이 위험을 지목해 `GIT_CONFIG_GLOBAL=os.devnull`/`GIT_CONFIG_SYSTEM=os.devnull`로 격리한다("Isolate from the host's global/system git config (signing, hooks, …)"). 이 저장소·현재 실행 환경은 `commit.gpgsign` 미설정이라 통과하지만(직접 확인함), 전역 gpgsign 이 켜진 개발자 머신에서는 `git commit`이 대화형 프롬프트를 기다리다 30초 타임아웃으로 실패할 수 있다 — 같은 PR 안에서 한쪽은 고친 위험을 다른 쪽엔 이식하지 않은 셈이다.
  - 제안: `RebaseAuthorDateTest._git`과 동일한 `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM=os.devnull` 격리를 `_repo()`의 git 호출에도 적용.

- **[INFO]** `_aggregate_omission_note()`의 두 방어적 조기-반환 분기(`room <= 0`, `len(head) > room`)가 직접 단위 테스트되지 않는다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 함수 `_aggregate_omission_note` (1254행) / 테스트 `.claude/tests/test_prompt_omission_notice.py`
  - 상세: 이 함수는 테스트에서 `build_files_section`을 통해서만 간접 호출된다. `test_many_files_collapse_to_one_notice_and_still_fit`(1,200개 파일, cap=141,557)이 우연히 "room > 0" 상황을 만들어 간접 통과할 뿐, `room<=0`이 되는 극단(참고로 같은 plan 문서 `harness-review-gate-ci-backstop.md`가 "n=3000, 헤더만으로 157,887자 vs cap 141,557 초과"를 별도 P3 결함으로 이미 기록)이나 "heading 자체도 안 들어가는" 분기가 실제로 실행되는지는 어떤 테스트도 보장하지 않는다.
  - 제안: `_aggregate_omission_note(["a.py","b.py"], room=0)` 등으로 직접 호출해 `""` 반환, 그리고 작은 `room`으로 "부분 리스트 + 외 N개" 렌더를 pin하는 단위 테스트 추가.

- **[INFO]** `DefaultPathIsWiredTest`가 `--commit`/명시 `--files` 스코프에서 경고가 뜨지 않는지는 검증하지 않는다(`--branch`/`--range`/`--staged` 3개만 커버).
  - 위치: `.claude/tests/test_review_changeset_warning.py` 클래스 `DefaultPathIsWiredTest` (156행); `test_explicit_branch_does_not_warn`(191행)/`test_explicit_range_does_not_warn`(194행)/`test_staged_is_an_explicit_scope_and_does_not_warn`(197행)
  - 상세: `collect_change_infos`의 if/elif 사슬에서 `args.commit`·`args.files` 분기는 구조적으로 경고 호출부(마지막 `else`)에 도달할 수 없어 실제 위험은 낮지만, 클래스 자체 목적이 "경고는 오직 기본 경로에서만 발동"이므로 5개 분기 중 2개가 assert 없이 남아있는 것은 이 클래스가 표방하는 커버리지 완전성과 어긋난다.
  - 제안: `test_explicit_commit_does_not_warn` / `test_explicit_files_does_not_warn` 2건을 추가해 5개 분기를 모두 pin.

- **[WARNING]** "하향 금지 + planner 인계" 정책 — 이번 하드닝의 핵심 동기(2026-07-25 22:58:00 사고: summary 에이전트가 CRITICAL 을 WARNING 으로 임의 하향해 게이트를 실제로 통과시킴) — 가 전부 프롬프트(에이전트 markdown) 산문으로만 구현되어 있고, 이를 검증할 기계적 테스트가 전혀 없다.
  - 위치: `.claude/agents/consistency-summary.md` §요약 지침 3/4 (새로 추가된 "하향 금지"/"planner 인계" 항목), `.claude/skills/consistency-checker/SKILL.md` §4 BLOCK 처리
  - 상세: `.claude/hooks/_lib/review_guard.py`는 `SUMMARY.md`의 `BLOCK:` 한 줄만 파싱하고 각 checker 리포트의 `[CRITICAL]` 개수와 대조하지 않는다(코드로 직접 확인). 즉 summary 에이전트가 이번에 신설된 금지 규약을 다시 어기고 하향하더라도 이를 잡아낼 코드/테스트가 없다 — 정책의 준수 여부는 전적으로 LLM 이 프롬프트를 매번 정확히 따르는가에 달려 있다. 이는 새로 발견한 결함이 아니라 이 PR 이 손댄 `plan/in-progress/harness-review-gate-ci-backstop.md` 자신의 "신규 후속 #2"("하향 금지 정책에 기계적 backstop 이 없다")에 이미 정확히 기록·추적되고 있는 항목이다. 다만 테스트 리뷰 관점에서, 이 PR 이 다루는 행동 변화 중 가장 파급력이 큰 것이 100% 비검증 상태로 남는다는 사실은 명시적으로 짚을 가치가 있다 — CRITICAL 로 올리지 않는 이유는 이미 plan 에 추적 중이고 사용자가 인지한 상태이기 때문(신규 위험 도입이 아니라 기존에 알려진 잔여 갭).
  - 제안: plan 문서가 이미 제안한 대로, orchestrator(`consistency_orchestrator.py`/`code_review_orchestrator.py`)가 각 checker/reviewer 리포트의 `[CRITICAL]` 개수를 세어 최종 `BLOCK:` 값과 모순되면 stderr 경고 또는 반환 플래그를 내는 기계적 backstop 을 후속 작업으로 우선순위 상향 검토.

## 회귀 테스트 확인 (긍정적 관찰)

기존 테스트는 변경 후에도 유효하다 — `.claude/tests/` 전체 702건 실행 결과 GREEN, 회귀 없음. 특히:
- `test_review_guard_hardening.EvaluateInFlightShortCircuitTest`가 `test_in_flight_allows_even_with_stale_review` 단일 테스트에서 `test_push_path_still_blocks_while_in_flight`/`test_stop_path_opts_in_and_is_allowed` 양방향으로 분리돼, 과거 "무조건 억제" 회귀를 두 방향 모두에서 봉쇄한다.
- `test_stop_guard_failopen.py`/`test_guard_review_before_push_main.py`에 추가된 subprocess 레벨 seam 테스트(`test_stop_passes_in_flight_opt_in`, `test_push_never_opts_into_the_in_flight_concession`)는 실제 hook 프로세스를 구동해 호출부가 정확한 kwarg 를 전달하는지까지 검증한다 — mock 이 실제 시그니처(`cwd=None, *, in_flight_ok=False`)를 그대로 미러링해 시그니처 드리프트(예: 실제 함수가 kwarg 를 거부하도록 바뀌었을 때 `except Exception`에 삼켜져 조용히 fail-open 되는 경로)까지 포착하도록 설계됐다.
- `test_consistency_bundle_priority.py`/`test_prompt_omission_notice.py`는 과거 실제로 발생했던 vacuous-test 실패(호출 횟수만 세는 스파이가 pass-through 뮤턴트를 못 잡은 사례)를 docstring 에 명시하고 효과(렌더링 순서·생략 안내 유무) 단언으로 교정한 설계를 보여준다 — 테스트 가독성·의도 전달이 우수하다.
- `.claude/tests/README.md` 카탈로그가 신규 3개 테스트 파일에 대해 갱신되었고 `test_tests_readme_catalog.py`(전체 스위트 내 포함) 통과로 동기화가 검증된다.

## 요약

이번 diff 의 두 핵심 수정 — (1) `evaluate_review(in_flight_ok=...)` 스코핑으로 push 게이트가 in-flight 리뷰 억제에 잘못 열리던 CRITICAL, (2) 리뷰/consistency 프롬프트가 예산 초과 파일을 안내 없이 통째로 누락시키던 결함 — 은 unit(mock)·subprocess(실제 hook 구동)·실제 git repo 기반 테스트로 두텁게 커버되어 있으며, 직접 수행한 뮤테이션 검증(`in_flight_ok` 가드 제거)이 해당 회귀 테스트를 RED 로 전환시키는 것을 확인해 "테스트가 실제로 그 결함을 잡는다"는 주장을 실측으로 뒷받침했다. 전체 하네스 테스트 스위트(702건)도 회귀 없이 GREEN 이다. 남은 갭은 전부 비차단(WARNING/INFO) 수준이다: 신설된 `_default_branch_ref()`의 성공 경로 미검증, 신규 real-git fixture 의 host 전역 git 설정 비격리(같은 PR 의 자매 fixture는 이미 격리 처리함), `_aggregate_omission_note`의 극단 분기 간접 커버, `DefaultPathIsWiredTest`의 분기 2개 누락, 그리고 이 PR 의 핵심 정책("하향 금지")이 순수 프롬프트로만 존재해 기계적 회귀 테스트가 없다는 점(단, 이는 PR 자신의 plan 문서가 이미 인지·추적 중인 잔여 항목). 신규 코드에 대한 테스트 존재 여부·엣지 케이스·mock 적절성·격리·가독성 전반은 이 리포지토리의 높은 기존 관행 수준에 부합한다.

## 위험도

LOW
