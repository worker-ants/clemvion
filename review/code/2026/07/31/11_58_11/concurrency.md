# 동시성(Concurrency) Review

## 발견사항

- **[INFO]** `evaluate_review()` 의 in-flight 완화가 두 호출자(push 가드 / stop 가드)에 **무조건 공유**되던 경쟁 조건이 이번 변경으로 올바르게 스코프됐음을 확인
  - 위치: `.claude/hooks/_lib/review_guard.py:862`(`def evaluate_review(cwd=None, *, in_flight_ok: bool = False)`), `:901`(`if in_flight_ok and _code_review_in_flight(repo_root):`) / `.claude/hooks/guard_review_before_stop.py:344`(`decision = evaluate_review(in_flight_ok=True)`)
  - 상세: 수정 전에는 `_code_review_in_flight()`(별도 프로세스가 진행 중인 `/ai-review` 세션 — `meta.json` 은 있고 `SUMMARY.md` 는 아직 없는 상태를 파일 타임스탬프로 판정)가 참이면 `evaluate_review()` 가 무조건 `blocked=False` 를 반환했다. 이 함수는 `guard_review_before_push.py`(하드 게이트, PreToolUse)와 `guard_review_before_stop.py`(소프트 넛지, Stop)가 **동일하게 호출**하므로, "리뷰가 비동기로 진행 중"이라는 상태가 실제로는 Stop 넛지만 억제해야 하는데 push 하드 게이트까지 최대 30분(`_IN_FLIGHT_TTL_SECONDS`) 열어 버리는 결과를 냈다 — 서로 다른 두 호출자(다른 시점·다른 프로세스)가 하나의 공유 판정 함수와 그 함수가 읽는 디스크 상태를 통해 암묵적으로 동기화되어야 했는데 그 스코프 구분이 없었던 구조적 결함이다. `plan/in-progress/harness-review-gate-ci-backstop.md` §관측(2)에 실측 재현이 기록돼 있다(`SUMMARY pending` 세션이 push 를 허용).
    - 수정: `in_flight_ok: bool = False` 키워드 전용 인자를 추가해 기본값을 **안전한 쪽(항상 하드 게이트)**으로 두고, Stop 가드만 명시적으로 `in_flight_ok=True` 를 넘기도록 스코프. Push 가드(`guard_review_before_push.py:845-846`, 이번 diff 대상 아님)는 여전히 위치 인자만으로 호출해 opt-in 하지 않음을 직접 확인했다.
    - 부수 확인: `_evaluate_over_targets` 의 `_accepts_cwd()` 는 `POSITIONAL_ONLY`/`POSITIONAL_OR_KEYWORD`/`VAR_POSITIONAL` 만 검사하므로, 새로 추가된 `in_flight_ok` (KEYWORD_ONLY)가 그 판정에 끼어들지 않아 기존 per-worktree 스코핑 로직도 회귀 없음을 확인.
    - 테스트: `test_review_guard_hardening.py::EvaluateInFlightShortCircuitTest`(양방향), `test_guard_review_before_push_main.py::test_push_never_opts_into_the_in_flight_concession`, `test_stop_guard_failopen.py::test_stop_passes_in_flight_opt_in` 모두 **반환값이 아니라 seam 에서 실제로 전달된 kwarg 값**을 파일에 기록해 단언한다 — `evaluate_review()` 호출부가 `in_flight_ok` 를 떨어뜨려도 결정 객체 자체는 동일하므로, 값만 보는 단언이었다면 회귀를 못 잡았을 것(mutation 관점에서 올바른 설계).
  - 제안: 없음(수정·검증 모두 적절). 향후 `evaluate_review()` 에 새 opt-in 파라미터를 또 추가할 경우 이번과 같은 "안전한 기본값 + 호출자별 명시적 opt-in + seam 단언" 패턴을 유지할 것.

- **[WARNING]** 신규 테스트 헬퍼 3곳의 `subprocess.run` 에 `timeout` 이 없어 대상 코드가 hang 하면 개별 테스트가 무기한 블로킹된다
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:57`, `.claude/tests/test_prompt_omission_notice.py:70`, `.claude/tests/test_review_changeset_warning.py:61` (모두 동일한 `run_in_orchestrator()` 헬퍼 정의부의 `proc = subprocess.run(...)` 호출)
  - 상세: 세 파일 모두 "Fresh-interpreter convention as in `test_consistency_context_budget`"(기존 파일 — 이번 diff 대상 아님, 거기도 동일하게 timeout 없음)을 그대로 복제했다고 스스로 명시한다. 즉 이번 diff 가 새 결함을 발명한 것은 아니지만, 기존에 1곳이던 무제한 대기 지점을 3곳으로 늘렸다. 같은 diff 안의 다른 서브프로세스 테스트(`test_guard_review_before_push_main.py` `timeout=10`, `test_stop_guard_failopen.py` `timeout=30.0`, `_run()` 헬퍼)는 명시적 timeout 을 지키고 있어, 이 3개 신규 파일만 그 관례에서 벗어난다. 대상 코드(`prioritize_bundle_files`/`collect_context`/`build_files_section` 등, 정렬·재귀·서브프로세스 호출을 포함)에 향후 무한루프·데드락급 회귀가 생기면 이 테스트는 실패가 아니라 **행(hang)** 으로 반응하고, 신호는 `.claude/tools/run-test.sh` 의 스테이지 단위 워치독(coarse-grained, 스테이지 전체를 죽임)에서만 뒤늦게 잡힌다 — 이 프로젝트 자체가 memory 에 "반환 후 타이밍 단언은 hang 을 못 잡음 → 서브프로세스+timeout" 을 명시적 관례로 못박아 둔 것과 어긋난다.
  - 제안: 세 헬퍼의 `subprocess.run(...)` 에 형제 테스트와 동일한 수준(예: `timeout=30.0`)을 추가. 헬퍼가 3곳에 그대로 복제돼 있으므로 공용 모듈로 뽑아 한 곳에서만 고치는 것도 고려할 만하다(이미 최소 4개 파일이 동일한 `_PREAMBLE`/`run_in_orchestrator` 패턴을 복제 중).

## 요약

이번 변경의 핵심 동시성 이슈는 `evaluate_review()` 의 in-flight 완화가 push 가드와 stop 가드에 무조건 공유되어 하드 게이트가 최대 30분간 열리던 실제 경쟁 조건이었고, 이는 `in_flight_ok` 키워드 전용 opt-in(안전한 기본값 False)으로 정확히 스코프됐으며 seam 단언 기반 테스트로 회귀도 잘 막아 뒀다 — 프로덕션 코드 경로에는 추가 조치가 필요 없다. 남은 항목은 신규 테스트 헬퍼 3곳이 `subprocess.run` 에 timeout 을 두지 않아 향후 대상 코드가 hang 할 경우 개별 테스트가 무기한 블로킹되는 test-infra 한정 리스크이며, 같은 diff 내 형제 테스트들이 이미 지키는 관례에서 벗어난 것이므로 WARNING 으로 기록한다. 그 밖의 변경(`code_review_orchestrator.py`/`consistency_orchestrator.py` 의 신규 함수들)은 모두 단일 프로세스 내 순차 실행이며 스레드·락·async 코드가 없어 동시성 관점에서 추가 위험이 없다.

## 위험도

LOW
