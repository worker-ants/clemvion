# 동시성(Concurrency) Review

## 발견사항

- **[INFO]** (이미 추적됨 — 재지적 아님) `agents_fatal` 해제(clear) 방향은 lost update 로부터 보호되지 않는다
  - 위치: `.claude/_shared/retry_state.py:161`-`188` (`_record_fatal` docstring "The two directions are NOT symmetric..." 및 "Caller contract: updates for the SAME agent must not overlap"), `.claude/_shared/retry_state.py:225`(`reconcile_state_with_disk` 의 `fatal_recorded = set(...) | set(fatal_on_disk(...))` 합집합)
  - 상세: (a) 이미 fatal 인 agent 를 재시도가 `pending`/`rate_limit` 로 강등하는데 그 `save_state` 쓰기가 동시 writer 에게 유실되면 sentinel 부재가 "해제됨"의 증거로 쓰이지 못해 stale JSON 이 fatal 을 되살린다. (b) 동일 agent 이름에 대한 두 `--update` 가 `load_state`~`_record_fatal` 사이에서 겹치면 `_record_fatal` 이 자기 `status` 값만 보고 무조건 sentinel 을 지워, 막 확립된 fatal 판정이 sentinel·JSON 양쪽에서 사라진다. 두 경로 모두 `plan/in-progress/harness-review-gate-followups.md` §10 "잔여 2"·"잔여 4" 로 이미 등록돼 있고, 각각 `test_clearing_fatal_is_still_unprotected_against_a_lost_update`·`test_two_overlapping_updates_for_the_SAME_agent_lose_the_fatal` 캐너리(`.claude/tests/test_retry_state_shared.py:385`, `:341`)로 의도적으로 열어둔 상태를 고정해 두었다. 회귀가 아니라(JSON-only 시절에도 동일하게 유실됐다), 해제 의도의 "양성 증거"(mtime 비교 또는 `_cleared/` 마커)가 필요한 설계 과제로 분리돼 있다.
  - 제안: 조치 불요(이미 plan 에 후속 설계로 등록·캐너리로 고정됨). 두 항목을 같은 설계 축(sentinel mtime vs 상태파일 비교)에서 함께 닫을 것을 권고하는 기존 계획을 유지.

- **[INFO]** `_record_fatal` sentinel 쓰기는 `save_state` 와 달리 원자적(temp+rename)이 아니다
  - 위치: `.claude/_shared/retry_state.py:190`-`201`
  - 상세: 현재 유일한 소비자 `fatal_on_disk`(`retry_state.py:130`-`142`)는 `os.path.isfile` 존재 여부만 확인하고 내용을 파싱하지 않으므로 torn write 자체는 기능적으로 무해하다. 다만 위 항목의 해제 방향을 mtime 비교로 닫으려면 이 쓰기도 원자적이어야 정확한 mtime 을 보장할 수 있다.
  - 제안: 지금은 조치 불필요. 향후 sentinel mtime 을 판단 로직에 쓰게 되면 `save_state` 와 같은 temp+`os.replace` 패턴으로 맞출 것 — 이미 예정된 후속 설계에 포함.

- **[INFO]** `save_state` 의 temp 파일명이 PID 기준(`f"{state_file}.tmp.{os.getpid()}"`)이라 동일 PID 내 재진입 호출에서는 충돌 가능
  - 위치: `.claude/_shared/retry_state.py:99`
  - 상세: 이번 diff 의 모든 호출 경로(`apply_status_update`, `reconcile_state_with_disk`)는 한 실행 흐름 안에서 `save_state` 를 한 번만 호출하므로 실제로 재진입이 일어나지 않는다. 서로 다른 프로세스(다른 `--update` 호출)는 서로 다른 PID 를 가지므로 temp 파일명이 겹치지 않는다. 새로 도입된 위험은 아니며, 관측 가능한 결함으로 이어지는 호출 패턴이 diff 안에 없다.
  - 제안: 조치 불필요.

- git 프로브(`_run_git`, `_run_git_raw`, `branch_diff_files`, `git_probe.py` 전체) 및 세 orchestrator 의 위임 배선 변경, `merge_coordinator_orchestrator.py` 의 `--resume` reconcile 추가는 전부 동기 `subprocess.run` 기반 순차 실행 코드다. 공유 가변 상태·스레드·락·async 코드가 없고, `--resume` 이 새로 얻은 `reconcile_state_with_disk` 호출도 이미 다른 두 orchestrator 가 갖고 있던 동일한 락-없는 read-modify-write 패턴을 세 번째 진입점에 그대로 적용한 것이라 새로운 동시성 표면을 추가하지 않는다.
- 해당 없음: async/await, 이벤트 루프, 스레드 풀·커넥션 풀 — 이번 변경 범위(Python 동기 CLI, 문서, git 서브프로세스 래퍼)에는 존재하지 않는다.

## 요약

이번 diff(`.claude/_shared/git_probe.py`·`retry_state.py` 확장, 세 orchestrator 의 브랜치-diff/상태 위임, 신규 테스트·문서·plan 기록)에서 **새로운** 동시성 결함은 발견하지 못했다. 핵심 공유 자원인 `_retry_state.json` 의 락 없는 read-modify-write 는 이미 `_fatal/<name>` sentinel + `agents_fatal` 합집합 재도출로 "fatal 로 전이" 방향의 유실을 복구 가능하게 만들었고, 이 브랜치가 의도적으로 열어둔 잔여 2종 — 해제(clear) 방향 lost update, 동일 agent 에 대한 겹친 `--update` — 는 docstring 과 각각의 캐너리 테스트(`test_clearing_fatal_is_still_unprotected_against_a_lost_update`, `test_two_overlapping_updates_for_the_SAME_agent_lose_the_fatal`)로 정확히 고정되어 있어 INFO 로만 기록했다. `fcntl.flock` 을 다시 채택하지 않은 결정(모든 훅 경로에 블로킹 프리미티브를 두게 된다는 이유)은 타당한 트레이드오프다. `merge_coordinator_orchestrator.py` 의 `--resume` self-heal 추가는 형제 orchestrator 둘과 대칭을 맞추는 확장일 뿐 새로운 위험 축을 열지 않으며, `git_probe.py` 로 통합된 git 프로브들은 상태 공유가 없는 순수 동기 서브프로세스 호출이라 동시성 관점에서 위험이 없다.

## 위험도

LOW

---

STATUS=success ISSUES=0
