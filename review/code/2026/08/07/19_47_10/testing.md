# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `branch_diff_files`의 실패-메시지 폴백 분기(`err`가 비어 있을 때의 제네릭 문구)가 새로 추가된 코드인데 어떤 테스트도 그 분기를 타지 않는다.
  - 위치: `.claude/_shared/git_probe.py:209` (`reason = err.strip()[:200] or f"rc={rc} (timeout or git unavailable)"`)
  - 상세: `test_branch_diff_shared.py`의 `SharedProbeContractTest.test_on_error_reports_the_failure_the_callers_log`(217행)는 존재하지 않는 ref 로 **실제 git 이 실행되어 stderr 를 채운** 경우만 검증한다 — 이 경우 `err.strip()`이 non-empty 라 `or` 우측(제네릭 메시지)은 평가되지 않는다. `_run_git_raw`가 `subprocess.TimeoutExpired`/`FileNotFoundError`/`OSError`를 잡아 `(1, "", "")`를 반환하는 경로(같은 파일 146행)로 이어질 때만 `err`가 빈 문자열이 되어 `or f"rc={rc} (timeout or git unavailable)"`가 평가되는데, 이 조합을 만드는 테스트가 없다. 반환값(`[]`)에는 영향이 없지만, 두 orchestrator가 `debug_log`로 남기는 실패 사유 문자열의 절반(제네릭 폴백)이 미검증 상태다.
  - 제안: `_run_git_raw`를 monkeypatch 하여 `(1, "", "")`를 반환하게 만든 뒤 `branch_diff_files`를 호출, `on_error`로 전달된 문자열이 `"rc=1"` 을 포함하는지 단언하는 테스트를 추가. 실제 timeout/누락 git 바이너리를 재현할 필요 없이 값싸게 닫을 수 있는 갭이다.

- **[INFO]** `fatal_on_disk`의 방어적 `except OSError` 분기가 자매 함수 `_record_fatal`의 동일 패턴과 달리 직접 테스트되지 않는다.
  - 위치: `.claude/_shared/retry_state.py:122`-`134` (`fatal_on_disk`, 특히 132-133행 `except OSError: continue`)
  - 상세: `_record_fatal`의 advisory OSError 스왈로우는 `test_retry_state_shared.py:311` `test_the_sentinel_write_is_advisory`가 `os.makedirs`를 mock 해 직접 고정한다. 반면 읽기 쪽 `fatal_on_disk`(예: `os.path.isfile`이 권한 문제로 예외를 던지는 경우)는 대칭되는 테스트가 없다 — 이 함수가 실제로 호출되는 `reconcile_state_with_disk`의 정상 경로(파일 없음)만 간접적으로 통과시키고 있다.
  - 제안: `os.path.isfile`을 mock 해 특정 이름에서만 `OSError`를 던지도록 하고, 그 이름이 결과에서 조용히 빠지되 나머지 이름은 정상 처리되는지 확인하는 테스트를 `FatalSurvivesALostUpdateTest`에 추가.

- **[INFO]** 두 orchestrator 호출부에 새로 붙은 `on_error=lambda reason: debug_log(...)` 배선 자체가 실제 `debug_log` 싱크(각자의 `/tmp/*-log.txt`)까지 관통해서 검증되지는 않는다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1063`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:256`
  - 상세: `test_branch_diff_shared.py`의 `test_an_unresolvable_base_is_empty_on_both_sides`(157-166행)는 두 진입점 모두 실패 시 빈 리스트/세트를 반환하는 것만 확인한다. 공유 콜백 계약 자체는 `SharedProbeContractTest`가 단위 테스트로 고정하지만, "각 orchestrator 가 자기 `debug_log` 로 로깅을 유지한다"는 이번 리팩터의 명시적 설계 목표(각 orchestrator 함수 docstring 이 그렇게 서술)는 두 콜사이트 어느 쪽에서도 end-to-end 로 pin 되어 있지 않다. 람다가 얇아서 위험은 낮지만, 회귀가 나면(예: 람다를 실수로 지우거나 인자 순서를 바꾸는 뮤테이션) 리턴값 테스트만으로는 못 잡는다.
  - 제안: 각 orchestrator preamble 안에서 `debug_log`를 캡처용 리스트로 monkeypatch 한 뒤 실패 base 로 호출해 메시지가 실제로 전달됐는지 보는 테스트를 하나씩(또는 파라미터화해서 하나로) 추가하면 닫힌다. 필수는 아니고, 이번 변경의 핵심 리스크(경로 유실·인코딩)와는 무관한 부수 배선이라 우선순위는 낮음.

## 긍정적으로 확인된 점 (참고용)

- `test_branch_diff_shared.py`는 `_shared/git_probe.branch_diff_files`를 직접 부르지 않고 **양쪽 orchestrator 의 실제 진입점**(`get_git_branch_diff_files` / `_branch_changed_rels`)을 fresh-interpreter subprocess 로 구동해 일치를 단언한다 — "각자 캡슐을 다시 깨뜨리는" 회귀(래퍼가 결과를 재가공)까지 잡는 설계다.
- 병리적 픽스처(선행/후행 공백, 비-ASCII 파일명)에 각각 vacuity check 를 동반한다 — 특히 `test_a_trailing_space_survives_in_the_last_position`의 독스트링은 처음에 `"trail .ts"`(공백이 중간)로 짜서 뮤테이션에 안 잡혔던 실패를 기록하고, 지금은 픽스처가 "정말 마지막 줄이 후행 공백으로 끝나는가"를 스스로 단언하도록 고쳐져 있다.
- `FatalSurvivesALostUpdateTest._lose_a_fatal_update`는 스레드/sleep 없이 `save_state`를 monkeypatch 한 재진입으로 동시성 레이스를 결정적으로 재현한다 — flaky 위험이 없고, 실제 `apply_status_update`를 그대로 구동해 재구현 괴리도 없다.
- `test_without_the_sentinel_the_same_loss_is_unrecoverable`(대조군)과 각 주요 테스트의 "vacuity check" 어서션(예: `레이스가 fatal 을 유실시키지 못했다`, `픽스처가 이미 치유된 상태다`)이 GREEN 이 증거가 아니라는 이 저장소의 반복 교훈을 그대로 실천하고 있다.
- `test_summary_state_cli_reads_through_the_shared_helper`/`test_summary_state_heals_...`는 필드별 `assertIn` 대신 **전체 stdout 라인**을 비교해, 필드 순서가 CLI 계약의 일부라는 점(순서 변경 뮤테이션)까지 잡는다.
- 실제로 `.claude/tests/test_branch_diff_shared.py`와 `.claude/tests/test_retry_state_shared.py`를 로컬에서 실행해 31개 전부 통과(서브테스트 11개 포함)를 확인했다.

## 요약

이번 변경(`git_probe.branch_diff_files` 신설 + 두 orchestrator 위임, `retry_state.py`의 `_fatal/<name>` sentinel + `reconcile_state_with_disk` 합집합 도출, `merge_coordinator_orchestrator`의 자기치유 추가)은 모두 전용 테스트 파일(`test_branch_diff_shared.py` 신설, `test_retry_state_shared.py` 대폭 확장)로 두텁게 커버되어 있다. 회귀 재현(레이스, 선행/후행 공백, 비-ASCII 경로, 3-dot 범위)을 실제 git/파일시스템 픽스처로 결정적으로 고정했고, vacuity check 를 동반해 GREEN 이 곧 증거가 아니라는 원칙을 지켰다. 남은 갭은 전부 새로 추가된 코드의 **방어적/부수 경로**(에러 메시지 제네릭 폴백, advisory OSError 스왈로우의 읽기 쪽, 콜백 배선의 실제 로그 싱크 도달)에 국한되며, 반환값·상태 파일의 정합성 같은 핵심 계약에는 영향이 없다. 기존 회귀 테스트(`test_consistency_bundle_priority.py`의 `_branch_changed_rels` 실측, `test_review_changeset_warning.py`의 mock 기반 테스트)도 위임 구조 변경 후에도 그대로 유효함을 로컬 실행으로 확인했다.

## 위험도

LOW
