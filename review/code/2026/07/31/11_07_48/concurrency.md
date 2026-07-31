# 동시성(Concurrency) Review

## 발견사항

- **[INFO]** in-flight 억제(concession)가 두 소비자(Stop nudge / push hard-gate) 사이에서 잘못 공유되던 레이스를 이번 diff 가 정확히 스코프 분리했다 — **해결됨, 회귀 테스트로 봉쇄**.
  - 위치: `.claude/hooks/_lib/review_guard.py:858-900`(특히 897행 `if in_flight_ok and _code_review_in_flight(repo_root):`), `:726-741`(`_code_review_in_flight` docstring), `:138-148`(`_IN_FLIGHT_TTL_SECONDS` 주석) / `.claude/hooks/guard_review_before_stop.py:339-344`
  - 상세: `evaluate_review()` 는 push 가드(`guard_review_before_push.py`, 하드 게이트)와 Stop 가드(`guard_review_before_stop.py`, 소프트 nudge) 두 곳에서 공유 호출된다. "`/ai-review` 세션이 시작됐지만 아직 SUMMARY.md 를 쓰지 못한 상태(in-flight, 최대 `_IN_FLIGHT_TTL_SECONDS`=1800초)"는 비동기로 진행 중인 리뷰 sub-agent 와 동기적으로 도는 Stop 훅 사이의 레이스를 가리키는 신호인데, 수정 전에는 이 신호가 무조건("unconditionally") 적용돼 **push 하드 게이트까지 최대 30분간 열어주는 결함**이었다(plan 문서 `harness-review-gate-ci-backstop.md` §관측(2)에 실측·기록됨: "리뷰가 SUMMARY 를 아직 안 썼다"는 이유로 실제 push 가 허용된 사례). 이는 전형적인 "여러 소비자가 서로 다른 동시성 요구사항(하드 vs 소프트)을 가지고 있는데 하나의 공유 판정 함수/critical-section 경계를 잘못 설정"한 레이스다.
    이번 diff 는 `evaluate_review(cwd=None, *, in_flight_ok: bool = False)` 로 시그니처를 바꿔 in-flight 억제를 **opt-in**으로 만들었다. Stop 가드만 `evaluate_review(in_flight_ok=True)` 로 명시 호출하고, push 가드(`guard_review_before_push.py`, 이번 diff에서 미변경)는 `evaluate(target)` 형태로 위치 인자만 넘기므로 `in_flight_ok` 는 기본값 `False` 로 유지된다. `_accepts_cwd()`(`guard_review_before_push.py:621-641`)가 시그니처를 점검할 때도 `in_flight_ok` 는 KEYWORD_ONLY 라 `POSITIONAL_OR_KEYWORD`/`VAR_POSITIONAL` 판정에 잡히지 않아 기존 위치-인자 디스패치(`_evaluate_over_targets`, `:807-811`, `:845-850`)에 영향이 없음을 직접 확인했다 — push 경로는 이번 변경으로 인한 부작용이 없다.
    회귀 방지도 충실하다: `test_review_guard_hardening.py::EvaluateInFlightShortCircuitTest` 가 "기본 호출(push 모양)은 in-flight 이어도 block 유지" / "`in_flight_ok=True`(Stop 모양)만 허용" 양방향을 함수 레벨에서 고정하고, `test_stop_guard_failopen.py::test_stop_passes_in_flight_opt_in` 은 Stop 훅이 실제로 `in_flight_ok=True` 키워드를 넘기는지 **seam 자체**를 단언해 "호출부가 kwarg 를 조용히 빠뜨리는" 회귀(결정 객체만 보면 동일해 다른 테스트로는 검출 불가)까지 막는다. `python3 -m unittest discover -s .claude/tests` 전체 684건 실행 결과 통과(로컬 재현 확인).
  - 제안: 조치 불필요(이미 해결·테스트로 고정됨). 다만 향후 "하나의 판정 함수를 서로 다른 강도(하드 게이트 vs 소프트 nudge)의 소비자가 공유"하는 패턴이 재등장하면, 이번처럼 opt-in 플래그 + 양방향 seam 테스트로 스코프를 명시하는 방식을 관례로 유지할 것.

- **[INFO]** `code_review_orchestrator.py`/`consistency_orchestrator.py` 의 신규 코드(`warn_if_committed_work_is_missing`, `prioritize_bundle_files`, `_branch_changed_rels`)는 전부 단일 스레드 내 동기 `subprocess.run(git …, timeout=…)` 호출과 순수 정렬/필터 로직이며, 공유 가변 상태·락·스레드/비동기 사용이 없어 동시성 관점의 새 위험은 없다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1092-1104`(`_default_branch_ref`, `warn_if_committed_work_is_missing`), `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 내 `_branch_changed_rels`/`prioritize_bundle_files`(`collect_context` 두 지점에서 호출)
  - 상세: 각 함수는 advisory-only(경고만, 절대 차단하지 않음)이고 git 실패 시 조용히 빈 결과로 폴백한다. `collect_context` 가 같은 diff 를 여러 지점(scope 파일, `other_spec_files`, `convention_files`)에서 각각 재계산하는 것은 성능상 중복 호출이지만 정합성·레이스와는 무관하다(동시성 리뷰 범위 밖).
  - 제안: 없음.

## 요약

이번 diff 의 동시성 관련 핵심은 `review_guard.evaluate_review()` 의 in-flight 억제 스코프를 `in_flight_ok` opt-in 플래그로 좁혀, 비동기 `/ai-review` 세션이 "시작됨~SUMMARY 작성 전" 구간에 있을 때의 관용이 Stop nudge 에만 적용되고 push 하드 게이트로 새지 않도록 고친 것이다. push 쪽 호출부(`guard_review_before_push.py`)는 이번 diff 에서 손대지 않았음에도 새 키워드 전용 인자가 기존 시그니처 점검(`_accepts_cwd`)과 충돌하지 않아 부작용이 없고, 두 방향(허용/차단) 모두 함수 레벨 테스트와 Stop→`evaluate_review` 호출 seam 테스트로 이중 고정돼 있다. 전체 하네스 테스트(684건) 로컬 실행도 통과했다. 그 외 파일(`code_review_orchestrator.py`, `consistency_orchestrator.py`, 테스트/plan 문서)은 동기 subprocess 호출과 순수 함수형 정렬 로직뿐이라 새로운 경쟁 조건·데드락·비동기 오용 소지가 없다. 신규로 도입된 CRITICAL/WARNING 급 동시성 결함은 발견되지 않았다.

## 위험도

LOW
