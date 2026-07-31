# 동시성(Concurrency) Review

## 발견사항

- **[INFO]** `evaluate_review()` 의 in-flight 억제(concession) 공유 레이스 — 이번 diff 로 정확히 스코프 분리됨 (해결 확인, 회귀 없음).
  - 위치: `.claude/hooks/_lib/review_guard.py:862-903`(특히 863행 `in_flight_ok: bool = False` 시그니처, 901행 `if in_flight_ok and _code_review_in_flight(repo_root):`), `:730-767`(`_code_review_in_flight` docstring), `:152`(`_IN_FLIGHT_TTL_SECONDS` 주석) / `.claude/hooks/guard_review_before_stop.py:344`(`decision = evaluate_review(in_flight_ok=True)`) / `.claude/hooks/guard_review_before_push.py:811`(`evaluate(target)` — 위치 인자만)
  - 상세: `evaluate_review()`는 push 가드(하드 게이트, `git push` 자체를 차단)와 Stop 가드(소프트 nudge, 턴 종료만 지연) 두 소비자가 공유 호출한다. "`/ai-review` 세션이 시작됐지만 아직 `SUMMARY.md` 를 쓰기 전(in-flight, 최대 `_IN_FLIGHT_TTL_SECONDS`=1800초)"은 **비동기로 백그라운드에서 진행 중인 리뷰 sub-agent** 와 **동기적으로 도는 Stop/push 훅** 사이의 레이스를 완화하려는 신호인데, 수정 전에는 이 신호가 두 소비자 모두에게 무조건 적용돼 **하드 게이트(push)까지 최대 30분간 열어주는 결함**이었다(이 저장소 plan 문서 `harness-review-gate-ci-backstop.md` §관측(2)에 실측 기록: "리뷰가 SUMMARY 를 아직 안 썼다"는 이유로 실제 `git push` 가 허용된 사례). 서로 다른 견고성 요구(하드 vs 소프트)를 가진 두 소비자가 하나의 공유 판정 함수 뒤에서 같은 완화 조건을 무조건 적용받던 전형적인 케이스다.
    이번 diff 는 `evaluate_review(cwd=None, *, in_flight_ok: bool = False)` 로 시그니처를 바꿔 in-flight 억제를 **opt-in**으로 만들었다. Stop 가드만 `evaluate_review(in_flight_ok=True)` 로 명시 호출하고, push 가드(이번 diff 에서 미변경)는 `evaluate(target)` 형태로 위치 인자만 넘기므로 `in_flight_ok` 는 기본값 `False` 로 유지된다.
    직접 확인한 것: (1) `guard_review_before_push.py:621-641` 의 `_accepts_cwd()` 가 `inspect.signature` 로 파라미터 kind 를 볼 때 `in_flight_ok` 는 `KEYWORD_ONLY` 라 `POSITIONAL_ONLY`/`POSITIONAL_OR_KEYWORD`/`VAR_POSITIONAL` 판정에 걸리지 않아, 기존 위치-인자 디스패치(`_evaluate_over_targets`)에 영향이 없다. (2) `python3 -m unittest` 로 `test_review_guard_hardening.py`(47건) + `test_stop_guard_failopen.py`/`test_guard_review_before_push_main.py`/`test_consistency_bundle_priority.py`/`test_prompt_omission_notice.py`/`test_review_changeset_warning.py`(85건) 총 132건을 직접 재실행해 전부 GREEN 을 재확인했다(문서상의 주장을 그대로 믿지 않고 재현). `EvaluateInFlightShortCircuitTest`(함수 레벨: 기본 호출은 in-flight 여도 block 유지 / `in_flight_ok=True` 만 허용)와 `test_stop_passes_in_flight_opt_in`·`test_push_never_opts_into_the_in_flight_concession`(seam 레벨: 호출부가 실제로 kwarg 를 넘기는지/넘기지 않는지 자체를 단언)가 양방향을 이중으로 고정하므로, 결정 객체만 비교해서는 잡히지 않는 "kwarg 누락" 회귀도 커버된다.
  - 제안: 조치 불필요(이미 해결·양방향 테스트로 봉쇄됨). 다만 이 패턴은 구조적 분리(예: 별도 함수)가 아니라 **호출부 규율(opt-in 플래그를 빠뜨리지 않는 것)에 의존**한다 — `evaluate_review()`의 새 호출부가 추가될 때 seam 테스트 없이 `in_flight_ok=True` 를 습관적으로 넘기면 이번과 같은 문제가 재발할 수 있으니, 신규 호출부 추가 시 이번과 같은 "호출부가 정확한 kwarg 를 넘기는지" seam 테스트를 계속 요구할 것.

- **[INFO]** 나머지 변경분(프롬프트 예산/생략-안내 로직, consistency 번들 우선순위 정렬)은 전부 단일 프로세스 내 동기 실행이라 동시성 관점의 신규 위험이 없음.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 의 `_omitted_content_note`/`build_files_section`(예산 계산, 약 561-750행대)·`_default_branch_ref`/`warn_if_committed_work_is_missing`(신규 함수); `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의 `prioritize_bundle_files`/`_branch_changed_rels`/`collect_context` 내부 `_prioritized` 클로저
  - 상세: 각 함수는 로컬 변수(`remaining_budget`, `include_content`, `changed` 등)만 다루는 순수 계산/정렬이며 스레드·asyncio·멀티프로세싱·락/세마포어를 전혀 사용하지 않는다(diff 전체를 `thread|asyncio|multiprocessing|lock|mutex|semaphore|async def|await` 등으로 grep 해도 실제 동시성 API 사용은 0건 — "async-review ↔ synchronous-Stop race" 라는 주석 문구만 위 in-flight 이슈를 가리킬 뿐). git 호출(`_branch_changed_rels`, `warn_if_committed_work_is_missing`)은 전부 읽기 전용(`git diff --name-only`, `git status --porcelain`)이고 `subprocess.run(..., timeout=...)` 로 개별 타임아웃이 걸려 있어, 다른 프로세스와의 쓰기 경쟁이 없다. `collect_context` 가 `_rank_changed`/`_rank_plan_text` 를 한 번만 계산해 여러 번들 호출에 재사용하도록 리팩터링된 것도 단순 중복 호출 제거(성능)이며 동시 접근 대상이 아니다.
  - 제안: 없음.

## 요약

이번 diff 에서 동시성 관점의 실질 변경은 단 하나 — `review_guard.evaluate_review()` 가 갖고 있던 "리뷰 세션 in-flight" 완화를 `in_flight_ok` opt-in 플래그로 좁혀, 비동기 `/ai-review` 세션이 "시작됨~`SUMMARY.md` 작성 전" 구간에 있을 때의 관용이 Stop nudge(소프트)에만 적용되고 push 하드 게이트로는 더 이상 새지 않도록 고친 것이다. 이는 실제로 최대 30분간 push 게이트를 열어주던 회귀를 닫는 정당한 수정이며, `_accepts_cwd()` 의 시그니처 판정 방식을 직접 확인하고 관련 테스트 132건을 재실행해 push 경로에 부작용이 없음과 두 방향(허용/차단) 모두가 함수 레벨 + 호출 seam 레벨 이중으로 고정돼 있음을 독립적으로 재현했다. 그 외 파일(`code_review_orchestrator.py`, `consistency_orchestrator.py`, 테스트/plan 문서)은 프롬프트 예산 계산과 번들 정렬 로직으로, 스레드·비동기·락 등 동시성 API 를 전혀 사용하지 않는 단일 프로세스 순차 코드이며 git 호출도 전부 읽기 전용·타임아웃 부여라 새로운 경쟁 조건·데드락 소지가 없다. 신규로 도입된 CRITICAL/WARNING 급 동시성 결함은 없다.

## 위험도
LOW
