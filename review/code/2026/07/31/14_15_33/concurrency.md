# Concurrency Review — review/code/2026/07/31/14_15_33

## 발견사항

- **[INFO]** 이번 diff 의 핵심 동시성 수정(`in_flight_ok` opt-in)은 건전 — 정상 반영 확인
  - 위치: `.claude/hooks/_lib/review_guard.py:862-904`(`evaluate_review`, 특히 901행 `if in_flight_ok and _code_review_in_flight(repo_root):`), `.claude/hooks/guard_review_before_stop.py:344`(`decision = evaluate_review(in_flight_ok=True)`)
  - 상세: 이 PR 이 고친 결함은 "비동기 `/ai-review` 진행 중(세션 디렉터리+`meta.json` 은 있지만 `SUMMARY.md` 미작성) ↔ 동기적으로 평가되는 push/Stop 게이트" 사이의 실제 경쟁 윈도우다. 종전에는 `_code_review_in_flight()` 억제가 `evaluate_review()` 안에서 무조건 적용되어, push 게이트까지 `_IN_FLIGHT_TTL_SECONDS`(30분) 동안 열어주는 결함이었다(모듈 docstring 자신이 "the push guard still hard-gates" 라고 주장했지만 억제가 무조건인 동안 거짓이었음을 diff 의 주석들이 스스로 지적). 수정은 `evaluate_review(cwd=None, *, in_flight_ok=False)` 로 opt-in 화하고 Stop 훅만 `in_flight_ok=True` 를 넘기며, push 훅(`guard_review_before_push.py`, 이번 diff 밖)은 인자 없이 호출해 기본값 `False`(fail-safe 방향)를 그대로 유지한다.
    두 호출부 모두 양방향 seam 테스트로 회귀가 봉쇄돼 있다: `.claude/tests/test_review_guard_hardening.py`의 `EvaluateInFlightShortCircuitTest`(`test_push_path_still_blocks_while_in_flight` / `test_stop_path_opts_in_and_is_allowed` — 이전엔 단일 테스트라 "push 경로가 여전히 막히는지"는 아예 검증되지 않았었다), `.claude/tests/test_stop_guard_failopen.py::test_stop_passes_in_flight_opt_in`, `.claude/tests/test_guard_review_before_push_main.py::test_push_never_opts_into_the_in_flight_concession`. 세 테스트 모두 "호출부가 kwarg 를 떨어뜨려도 반환된 decision 객체는 동일해 일반 단언은 통과한다"는 점을 인지하고, 실제 호출 시 넘겨진 `in_flight_ok` 값을 파일(seam)에 기록해 대조하는 방식이라 mutation 저항력이 높다. 결함 없음 — 정상 반영으로 확인.
  - 제안: 없음.

- **[INFO]** `_resolution_in_flight` 의 marker 신호가 세션/브랜치가 아니라 프로세스 anchor(`CLAUDE_PROJECT_DIR`) 전역 스코프 — 이번 diff 범위 밖(미변경 기존 코드)이나 같은 계열의 억제-스코프 이슈
  - 위치: `.claude/hooks/_lib/review_guard.py:782-789`(`_resolution_marker_dir`), `.claude/hooks/_lib/review_guard.py:808-859`(`_resolution_in_flight`, 특히 834-846행 Signal 1)
  - 상세: 이번 PR 의 주제와 같은 "in-flight 억제의 스코프가 넓다" 계열이지만, 이 함수 자체는 diff 에 포함되지 않은 기존 코드다(`git diff origin/main` 확인 — 변경 없음). `_resolution_in_flight` 의 Signal 1(dispatch marker) 은 `.claude/state/resolution_in_flight/` 아래 모든 마커 파일을 스캔해 "하나라도 TTL 이내면 True" 를 반환하는데, 이 디렉터리는 `repo_root`(호출 세션의 git 루트)가 아니라 `CLAUDE_PROJECT_DIR`(세션 anchor — 코드 주석: "a worktree-isolated session and the main session agree on one location", 여러 worktree/세션이 의도적으로 같은 위치를 공유하도록 설계됨) 아래다. 반면 Signal 2 는 `repo_root` 기준(세션별 `review/code/**`)이라 올바르게 스코프돼 있다. 만약 서로 무관한 두 최상위 세션(예: `EnterWorktree` 로 격리되지 않은 bg 세션, 또는 같은 anchor 에서 시작한 두 병렬 대화형 세션)이 같은 `CLAUDE_PROJECT_DIR` 를 공유하면, 세션 A 의 resolution-applier in-flight 마커가 세션 B 의 Stop nudge 까지 억제할 수 있다. 영향은 soft nudge(턴 종료 안내 1회)에 국한된다 — push 하드게이트는 애초에 `_resolution_in_flight` 를 참조하지 않는다(주석: "It is deliberately NOT consulted by the push guard"). 이번 diff 가 도입하거나 악화시킨 것은 아니며 실제 발현 여부는 세션 anchor 할당 방식(이 리뷰 범위 밖)에 달려 있다.
  - 제안: 조치 불요(정보 제공). 후속 검토 시 Signal 1 마커 파일명에 session_id/branch 토�큰을 포함시켜 필터링하거나, marker 파일 내용에 repo_root 를 함께 기록해 `_resolution_in_flight` 가 자기 repo_root 로 필터링하도록 강화하는 방안을 고려할 수 있다.

- 그 외 리뷰 대상 파일 — `code_review_orchestrator.py` / `consistency_orchestrator.py` 의 예산·우선순위 로직(diff 228줄/139줄), 신규 테스트 4개(`test_consistency_bundle_priority.py`/`test_prompt_omission_notice.py`/`test_review_changeset_warning.py`/기존 테스트 보강), SKILL/agent 문서 변경 — 은 전부 순차 단일 프로세스 계산이거나 `subprocess.run` 1회 blocking 호출, 혹은 정책 문서 텍스트다. `threading`/`asyncio`/`multiprocessing`/`Lock`/`fcntl`/`flock` 등 동시성 프리미티브는 이 diff 어디에도 없음을 grep 으로 확인했다. 실제 sub-agent 병렬 fan-out(reviewer/checker 동시 실행)은 이 저장소의 Python 오케스트레이터가 아니라 하네스의 `Workflow` tool 이 수행하므로 이 diff 의 리뷰 범위 밖이다.

## 요약
이 changeset 에서 동시성 관점의 핵심은 `evaluate_review()` 에 `in_flight_ok` opt-in 플래그를 도입해 "세션 디렉터리는 생겼지만 SUMMARY.md 는 아직 없는" 진행 중 리뷰에 대한 관대한 억제를 Stop 훅(연성 nudge)에만 한정하고 push 훅(경성 게이트)에는 적용되지 않도록 스코프를 좁힌 수정이다. 이는 비동기 리뷰 프로세스와 동기적 게이트 평가 사이의 실제 레이스 윈도우(리뷰가 아직 끝나지 않은 순간에 push 가 그 틈을 타는 것)를 정확히 겨냥한 결함 수정이며, 기본값이 fail-safe(`False`, 항상 hard-gate) 방향이고 push/Stop 두 호출부 모두 mutation 에 강한 seam 테스트로 회귀가 봉쇄돼 있어 구현 품질이 높다. 나머지 변경 파일(오케스트레이터의 컨텍스트 예산/우선순위 로직, 신규 회귀 테스트, SKILL·agent 문서)은 전부 순차·단일 프로세스 코드로 동시성 프리미티브가 전혀 없다. 다만 같은 "in-flight 억제" 계열에서, 이번 diff 가 건드리지 않은 `_resolution_in_flight` 의 마커 스캔이 세션/브랜치가 아니라 프로세스 anchor(`CLAUDE_PROJECT_DIR`) 전역으로 스코프돼 있어 서로 무관한 두 세션이 같은 anchor 를 공유하면 한쪽의 resolution-applier 진행 상태가 다른 쪽의 Stop nudge 를 억제할 수 있는 잠재적 갭이 있음을 참고용 INFO 로 남긴다 — soft nudge 에만 영향을 주고 이번 PR 의 회귀는 아니다.

## 위험도
LOW
