# 테스트(Testing) Review

## 발견사항

- **[INFO]** `fatal_on_disk` 의 `OSError` 방어 분기가 테스트되지 않음
  - 위치: `.claude/_shared/retry_state.py:130-142` (특히 138-141행 `try: ... except OSError: continue`)
  - 상세: `os.path.isfile(path)` 가 `OSError` 를 던지는 경로(권한 문제, 경로 성분이 디렉터리가 아님 등)를 검증하는 테스트가 없다. `reconcile_state_with_disk` 관련 테스트(`test_retry_state_shared.py`)는 sentinel 파일의 존재/부재 두 갈래만 exercise 하고, "파일시스템 이상으로 isfile 자체가 실패" 하는 세 번째 갈래는 다루지 않는다. 대칭적으로 `_record_fatal` 의 쓰기 실패(`os.makedirs` 실패)는 `test_the_sentinel_write_is_advisory` 로 고정돼 있어, 읽기 쪽만 비대칭적으로 미검증이다.
  - 제안: `mock.patch.object(os.path, "isfile", side_effect=OSError(...))` 형태로 `fatal_on_disk` 단독 또는 `reconcile_state_with_disk` 를 통해 "sentinel 읽기 실패 시에도 crash 하지 않고 그 이름을 건너뛴다" 를 직접 단언하는 테스트를 추가할 것.

- **[INFO]** `_record_fatal` 의 "해제(clear)" 경로에서 `OSError` 를 흡수하는 분기가 미검증
  - 위치: `.claude/_shared/retry_state.py:178-189` (특히 186-187행 `elif os.path.exists(path): os.unlink(path)`)
  - 상세: `test_the_sentinel_write_is_advisory` (`.claude/tests/test_retry_state_shared.py:355-364`) 는 "fatal 이 되는" 방향의 `os.makedirs` 실패만 고정한다. 대칭적인 "fatal 이 해제되는" 방향의 `os.unlink` 실패(권한 문제 또는 `os.path.exists` 확인과 `os.unlink` 사이의 TOCTOU 경합으로 파일이 이미 사라진 경우)는 어떤 테스트도 재현하지 않는다. 두 방향 모두 같은 `try/except OSError: pass` 블록 안에 있어 동작상 대칭이어야 하는데, 검증은 한쪽으로만 쏠려 있다.
  - 제안: `mock.patch.object(rs.os, "unlink", side_effect=OSError(...))` 로 "해제 시 unlink 가 실패해도 update 자체는 성공한다" 를 대칭적으로 고정.

- **[INFO]** 두 orchestrator 의 반환 **타입** 차이(list vs set)가 "의도적" 이라고 docstring 에 명시돼 있으나 assertion 으로 고정되지 않음
  - 위치: `.claude/tests/test_branch_diff_shared.py:99-118` (`BothOrchestratorsSeeTheSameFilesTest._both`, `test_an_ordinary_changeset_agrees`, `test_a_leading_space_survives_on_both_sides`), 및 `157-166` (`test_an_unresolvable_base_is_empty_on_both_sides` 의 docstring)
  - 상세: `test_an_unresolvable_base_is_empty_on_both_sides` 의 docstring 은 "실패 기본값의 TYPE(list vs set) 차이는 의도적" 이라고 명시하지만, `_both()` 헬퍼가 양쪽 결과를 항상 `sorted(...)` 로 리스트화한 뒤 비교하므로 실제 반환 타입은 어떤 테스트에서도 직접 확인되지 않는다(프로세스 경계를 넘는 fresh-interpreter 호출이라 JSON 직렬화로 타입이 어차피 소실되는 구조적 한계는 있음).
  - 제안: 타입 계약이 정말 중요하다면, in-process 로 직접 부를 수 있는 `_shared.git_probe.branch_diff_files` 자체에 대해 `assertIsInstance(result, list)` 를 추가해 최소한 공유 함수 수준에서는 타입을 고정할 것. 크리티컬한 문제는 아님 — 두 orchestrator 모두 반환값을 곧바로 `set(...)`/직접 순회로 소비하므로 타입 오분류가 있어도 다른 회귀 테스트(`test_consistency_bundle_priority.py` 등)가 잡을 가능성이 높다.

- **[INFO]** 테스트 헬퍼 중복 — `_probe()` 메서드가 두 클래스에 동일하게 존재
  - 위치: `.claude/tests/test_branch_diff_shared.py:218-223` (`SharedProbeContractTest._probe`) 와 `311-316` (`UndecodableGitOutputTest._probe`)
  - 상세: 두 private 헬퍼가 바이트 단위로 동일하다(`sys.path` 삽입 + `from _shared import git_probe`). 이 PR 자체가 "두 사본을 change-both 로 유지하다가 드리프트했다" 는 실패 패턴을 본문 코드에서 제거하는 작업인 만큼, 같은 패턴이 새로 추가된 테스트 파일 안에 (작지만) 재도입된 점은 아이러니하다.
  - 제안: 모듈 레벨 함수나 공통 mixin/setUp 으로 추출. 기능상 문제는 없음 — 순수 가독성/DRY 코멘트.

## 요약

전반적으로 이번 diff 의 테스트 설계는 매우 탄탄하다. `git_probe.branch_diff_files` 는 두 orchestrator 의 **실제 진입점**을 fresh-interpreter 로 구동해 "둘이 일치한다"는 속성 자체를 검증하고(단순 mock 이 아니라 real git fixture), 회귀했던 실제 결함(leading-space, non-ASCII C-quote, 후행 공백 마지막 줄, three-dot 범위, `except Exception` 축소로 인한 crash)을 각각 전용 테스트로 고정했다. 특히 `test_a_trailing_space_survives_in_the_last_position` 은 첫 시도의 fixture(`"trail .ts"`)가 vacuous 했던 사실과 mutation testing 이 이를 잡아낸 경위를 docstring 에 남겨 재발을 방지하고 있고, `retry_state.py` 쪽 `FatalSurvivesALostUpdateTest` 는 스레드/sleep 없이 재진입(reentrancy)으로 lost-update 경합을 **결정적으로** 재현하면서, sentinel 을 지운 대조군으로 vacuity 를 자체 검증하는 등 이 프로젝트가 과거 반복해서 겪은 "GREEN 은 증거가 아니다" 함정을 스스로 방어하고 있다. `test_clearing_fatal_is_still_unprotected_against_a_lost_update` 는 알려진 채 남겨둔 비대칭 결함(해제 방향은 여전히 lost-update 에 취약)을 캐너리로 고정해 회귀·재발견을 구분 가능하게 만든 점도 모범적이다. `merge_coordinator_orchestrator` 의 신규 self-healing 도 `--summary-state`/`--resume` 양쪽 CLI 를 subprocess 로 직접 구동해 검증하며, 기존 회귀 스위트(`test_orchestrator_state.py`, `test_consistency_orchestrator_state.py`, `test_consistency_bundle_priority.py`)의 호출 시그니처·반환 계약도 그대로 유지돼 깨지지 않는다. 발견된 갭은 모두 INFO 수준으로, `fatal_on_disk`/`_record_fatal` 의 `OSError` 방어 분기 중 절반(읽기 실패, 해제 시 unlink 실패)이 대칭적으로 검증되지 않은 점과, 신규 테스트 파일 내부의 작은 헬퍼 중복 정도다. 이들은 코드 동작을 위협하지 않는 완성도 보완 사항이다.

## 위험도
LOW
