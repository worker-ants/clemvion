# 동시성(Concurrency) Review

## 발견사항

- **[INFO]** `evaluate_review()` 의 in-flight 완화가 push(하드 게이트)/Stop(소프트 nudge) 두 소비자에 **무조건 공유**되던 경쟁 조건이 이번 diff 로 정확히 스코프됐음을 (3R 반영 이후 최신 HEAD 기준으로) 재확인.
  - 위치: `.claude/hooks/_lib/review_guard.py:862-903`(`def evaluate_review(cwd=None, *, in_flight_ok: bool = False)`, 901행 `if in_flight_ok and _code_review_in_flight(repo_root):`), `:730-767`(`_code_review_in_flight` docstring 정정), `:152`(`_IN_FLIGHT_TTL_SECONDS` 주석 정정) / `.claude/hooks/guard_review_before_stop.py:339-344`(`decision = evaluate_review(in_flight_ok=True)`) / `.claude/hooks/guard_review_before_push.py:845-846`(`evaluate_review` — 위치 인자만, 이번 diff 대상 아님)
  - 상세: `evaluate_review()`는 `git push` 를 실제로 막는 push 가드와 턴 종료만 지연시키는 Stop 가드가 **동일 함수**를 호출한다. "`/ai-review` 세션이 생성됐지만 아직 `SUMMARY.md` 를 쓰기 전(in-flight, `_IN_FLIGHT_TTL_SECONDS`=1800초)" 상태는 비동기로 도는 리뷰 sub-agent 와 동기적으로 실행되는 두 훅 사이의 레이스를 완화하려는 신호인데, 수정 전에는 이 완화가 두 소비자 모두에게 무조건 적용돼 **push 하드 게이트까지 최대 30분간 열어주는 결함**이었다(`plan/in-progress/harness-review-gate-ci-backstop.md` §관측(2)에 "SUMMARY pending 세션이 push 를 허용" 으로 실측 기록됨). 서로 다른 견고성 요구(하드 차단 vs 소프트 nudge)를 가진 두 호출자가 하나의 공유 판정 함수 뒤에서 같은 완화 조건을 구분 없이 적용받던 전형적인 사례다.
    이번 diff 는 `in_flight_ok: bool = False` 키워드 전용 파라미터로 완화를 **opt-in** 화했다. Stop 가드만 `in_flight_ok=True` 를 명시 전달하고, push 가드(이번 diff 미변경, `guard_review_before_push.py:845-846`)는 위치 인자만 넘겨 기본값 `False` 를 유지한다 — 직접 Read 로 확인. 회귀 방지도 이중이다: `test_review_guard_hardening.py::EvaluateInFlightShortCircuitTest`(`test_push_path_still_blocks_while_in_flight` / `test_stop_path_opts_in_and_is_allowed`)가 함수 레벨에서 양방향을 고정하고, `test_stop_guard_failopen.py::test_stop_passes_in_flight_opt_in` 과 `test_guard_review_before_push_main.py::test_push_never_opts_into_the_in_flight_concession` 은 **반환된 결정 객체가 아니라 seam 에 실제로 전달된 kwarg 값**을 파일에 기록해 단언한다 — 결정 객체만 비교했다면 "kwarg 를 조용히 떨어뜨리는" 회귀를 못 잡았을 것이므로 mutation 관점에서 올바른 설계다.
  - 제안: 조치 불필요(해결·양방향 seam 테스트로 봉쇄됨). 향후 `evaluate_review()` 에 새 호출부가 추가될 때도 "안전한 기본값 + 호출자별 명시적 opt-in + seam 단언" 패턴을 관례로 유지할 것.

- **[INFO]** (사전 존재, 이번 diff 대상 아님) Stop nudge의 "세션당 1회" 마커가 check-then-act 로 구현돼 있어 진짜 동시 프로세스 하에서는 TOCTOU 레이스가 가능 — 영향은 nudge 중복 표시로 한정.
  - 위치: `.claude/hooks/guard_review_before_stop.py:208-209`(`_already_nudged` — `os.path.exists`), `:212-218`(`_mark_nudged` — `os.makedirs` + `open(marker, "w")`), `:231-240`(`_nudge_once` — 두 호출을 검사-후-생성으로 순차 실행)
  - 상세: `_nudge_once` 는 `_already_nudged(marker)` 로 확인한 뒤 `_mark_nudged(marker)` 로 생성하는데 이 두 단계가 원자적이지 않다. 마커 경로는 `session_id`(없으면 `"nosession"` 고정 폴백) + branch 토큰으로 구성되므로(`_marker_path`), 정상적으로 서로 다른 `session_id` 를 가진 세션들은 애초에 마커가 충돌하지 않고, 한 세션 내부의 Stop 훅 호출도 프로토콜상(`stop_hook_active` 로 체인이 순차 진행) 동시 실행되지 않는다. 레이스가 실제로 발현하려면 `session_id` 가 비어 `"nosession"` 으로 겹치는 **서로 다른 프로세스**가 같은 branch 에서 정말로 동시에 Stop 훅을 실행해야 한다 — 드문 조건이며, 발현해도 결과는 데이터 손상이 아니라 "1회만 떠야 할 nudge 문구가 한 번 더 뜨는" 정도다. 이 파일의 이번 diff 는 4줄(`in_flight_ok=True` 추가)뿐이라 이 패턴은 이번 변경이 만든 것도 악화시킨 것도 아니다.
  - 제안: 조치 불필요(활성 위험 아님). 이 PR 자체가 "게이트 하드닝" 주제이므로, 여유가 있다면 `os.open(marker, os.O_CREAT | os.O_EXCL | os.O_WRONLY)` 로 생성-실패를 원자적 신호로 바꿔 두면 이 경계 케이스까지 닫을 수 있다는 점만 기록해 둔다.

- **[INFO]** 신규 파일 `_probe_main.py`(1,304줄, 전량 신규)는 `code_review_orchestrator.py` 의 상태 관리 구간(`_load_state`/`_save_state`/`_apply_status_update`, 두 파일 모두 183/192/340행 — 완전 동일)을 그대로 복제하고 있으나 저장소 전체에서 이 파일을 import/실행하는 곳이 없다(SKILL.md·테스트·docs 어디에도 참조 없음, `grep -rl _probe_main` 0건).
  - 위치: `.claude/skills/code-review-agents/scripts/_probe_main.py:183-368`
  - 상세: 죽은 코드라 현재는 동시성 위험이 0이다(실행되지 않으면 경쟁도 없다). 다만 원본 쪽의 `_apply_status_update`→`_save_state` 는 파일 락 없는 순수 read-modify-write(`_load_state` 로 전체 JSON 을 읽고, 메모리에서 버킷을 옮긴 뒤, `_save_state` 로 통째로 덮어쓰기)라, 이 사본이 훗날 어떤 경로로든 `--update` 처럼 병렬 호출되게 배선되면 두 프로세스가 같은 `_retry_state.json` 을 동시에 읽고 쓸 때 lost-update 가 가능한 패턴을 그대로 물려받는다. 이는 사전 존재 설계(원본에도 동일하게 있음)이고 이번 diff 가 그 경로를 실제로 병렬 배선하지는 않았으므로 CRITICAL/WARNING 이 아니라 참고용 INFO로 남긴다. 이 파일의 존재/필요성 자체(디버깅 잔재 추정)는 concurrency 렌즈 밖이라 scope/maintainability 리뷰 몫으로 남긴다.
  - 제안: 없음(동시성 관점). 파일이 실제로 필요 없다면 삭제, 필요하다면 원본과의 중복을 없애는 리팩터가 더 적합한 리뷰 축.

- **[INFO]** 그 외 이번 diff 의 실질 코드(`build_files_section`/`_omitted_content_note`/`_aggregate_omission_note`/`warn_if_committed_work_is_missing`(`code_review_orchestrator.py`), `prioritize_bundle_files`/`_branch_changed_rels`/`_is_catalog_bulk`(`consistency_orchestrator.py`))는 전부 단일 프로세스 내 동기 계산·정렬과 `subprocess.run(..., timeout=...)` 로 타임아웃 있는 읽기 전용 git 호출뿐이다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`(약 561-750행대, 1187행대) / `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`(약 233-320행대, `collect_context` 내 `_prioritized` 클로저)
  - 상세: 스레드/asyncio/멀티프로세싱/락·세마포어 API 사용 0건(`thread|asyncio|multiprocessing|lock|mutex|semaphore|async def|await` grep 전체 무매치). 공유 가변 상태 없이 인자로 받은 로컬 리스트만 다루므로 새 경쟁 조건·데드락 소지가 없다. 신규 테스트 3종(`test_consistency_bundle_priority.py`/`test_prompt_omission_notice.py`/`test_review_changeset_warning.py`)의 서브프로세스 헬퍼도 전부 `timeout=30.0` 을 지키고 있어(과거 라운드에서 지적됐던 timeout 누락은 이미 해소된 상태로 확인됨), 대상 코드가 hang 해도 개별 테스트가 무기한 블로킹되지 않는다.
  - 제안: 없음.

## 요약

이번 diff 의 유일하게 실질적인 동시성 이슈는 `review_guard.evaluate_review()` 가 갖던 "리뷰 세션 in-flight" 완화가 push 하드 게이트와 Stop 소프트 nudge 에 무조건 공유되어, 비동기 `/ai-review` 가 진행 중(SUMMARY 작성 전)인 최대 30분 동안 실제로 `git push` 를 통과시키던 결함이었다. `in_flight_ok` 키워드 전용 opt-in(안전한 기본값 `False`, Stop 가드만 `True`)으로 정확히 스코프를 좁혔고, 함수 레벨(양방향 결정 단언) + 호출 seam 레벨(전달된 kwarg 자체를 기록해 단언) 이중 테스트로 회귀를 봉쇄했으며 push 호출부는 실제로 미변경임을 직접 확인했다. 나머지 실질 코드(프롬프트 예산/생략-안내 로직, consistency 번들 우선순위 정렬)는 스레드·비동기·락을 쓰지 않는 단일 프로세스 순차 코드라 새 위험이 없다. 부수적으로 (a) 이번 diff 대상이 아닌 Stop nudge "세션당 1회" 마커의 check-then-act 가 극히 좁은 조건에서만 발현하는 저영향 TOCTOU 를 갖고 있고, (b) 신규 파일 `_probe_main.py` 가 원본 orchestrator 의 락 없는 상태-파일 read-modify-write 패턴을 그대로 복제하지만 현재 어디서도 호출되지 않아 활성 위험은 0이라는 점을 참고용으로 기록한다. 이번 변경이 새로 도입한 CRITICAL/WARNING 급 동시성 결함은 없다.

## 위험도

LOW
