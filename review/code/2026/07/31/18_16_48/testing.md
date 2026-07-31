# Testing Review

## 발견사항

- **[WARNING]** 신규 백스톱의 핵심 계약("경고만 하고 세션을 건너뛰지 않는다")이 반환값 기준으로는 pin 되어 있지 않다
  - 위치: `.claude/tests/test_block_integrity.py:126` (`GateSurfacesTheContradictionTest._run_gate`) 및 `:137-139` (`test_warning_reaches_stderr`) / `.claude/hooks/_lib/review_guard.py:707-741` (`_newest_resolved_impl_done_mtime`)
  - 상세: `review_guard.py`의 새 코드(및 `block_integrity.py` 모듈 docstring)가 명시적으로 강조하는 설계 원칙은 "모순을 발견해도 경고만 하고 세션을 skip/block 하지 않는다"이다(주석: "Warn, do not skip the session"). 그런데 `_run_gate` 헬퍼는 `_newest_resolved_impl_done_mtime`의 stderr 출력만 캡처해 반환하고, 함수의 실제 반환값(그 세션이 SPEC-CONSISTENCY 게이트의 "fresh impl-done" 판정에 기여하는 타임스탬프 `best`)은 버린다. `test_warning_reaches_stderr`/`test_quiet_when_the_session_agrees` 둘 다 stderr 문자열만 단언한다. 따라서 향후 누군가 "모순이 있으면 이 세션은 신뢰하지 말자"는 발상으로 `continue`를 추가해 이 세션을 조용히 스킵(=fail-open 계약 위반, 사실상 재도입되는 "차단")하더라도 두 테스트는 여전히 GREEN이다 — 정확히 `GateSurfacesTheContradictionTest`의 클래스 docstring이 지적하는 "predicate 는 테스트되지만 호출부가 사라져도 GREEN" 사각지대가, "호출부는 있지만 부작용이 계약을 깨도 GREEN"이라는 한 단계 위 형태로 재발할 수 있는 지점이다.
  - 제안: `_run_gate`가 stderr 문자열과 함께 `_newest_resolved_impl_done_mtime`의 반환값도 함께 돌려주도록 바꾸고, 모순 케이스(`test_warning_reaches_stderr`)에서 그 반환값이 `> 0.0`(즉 세션이 여전히 "resolved"로 집계돼 gate 를 통과시킴)임을 함께 단언한다.

- **[WARNING]** `CHECKER_REPORTS`(신규)와 `ALL_CHECKERS`(기존)가 서로 참조 없이 하드코딩된 채 동기화 테스트가 없다
  - 위치: `.claude/_shared/block_integrity.py:44-50` (`CHECKER_REPORTS`) vs `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:50-56` (`ALL_CHECKERS`)
  - 상세: 두 목록은 지금은 내용이 일치하지만(`.md` 접미사 차이만 있음), 서로 참조하지도 않고 "Change both" 주석조차 없다. 향후 6번째 checker 가 `ALL_CHECKERS`에 추가되고 `CHECKER_REPORTS`가 갱신되지 않으면, `downgraded_criticals`는 그 checker 가 낸 `[CRITICAL]` 하향을 영구히 놓치게 된다 — 이 백스톱 자체가 막으려는 바로 그 실패("checker 가 CRITICAL 을 냈는데 아무도 못 봄")를 리스트 드리프트로 재현하는 셈이다. 이 저장소는 정확히 이 클래스의 드리프트(`test_agent_consistency.py`의 4-place 레지스트리, `test_router_safety_policy_doc.py`의 24 vs 44 익스텐션 드리프트)로 이미 여러 차례 실제 사고를 겪었다.
  - 제안: `consistency_orchestrator.ALL_CHECKERS`를 import 해 `set(BI.CHECKER_REPORTS) == {c + ".md" for c in ALL_CHECKERS}`를 단언하는 동기화 테스트를 `test_block_integrity.py`(또는 신규 cross-module 테스트)에 추가하거나, `CHECKER_REPORTS`를 `ALL_CHECKERS`에서 파생시켜 애초에 드리프트가 불가능한 구조로 바꾼다.

- **[WARNING]** 이번 PR이 새로 만든 `summary_block_verdict()`가 기존 `_summary_block_is_no()`와 동일한 `BLOCK:` 파싱 로직을 독립 재구현하면서 agreement 테스트가 없다
  - 위치: `.claude/_shared/block_integrity.py:42`(`_BLOCK_LINE`), `:66-69`(`summary_block_verdict`) vs `.claude/hooks/_lib/review_guard.py:141`(`_BLOCK_LINE`), `:693-704`(`_summary_block_is_no`)
  - 상세: 두 정규식(`BLOCK:\s*(YES|NO)`, `re.IGNORECASE`)과 판정 로직이 사실상 동일한 코드를 두 파일에 독립적으로 갖게 됐다. 이 PR 자체의 커밋 목적("Change both" 주석으로 유지되던 5개 함수를 `_shared/retry_state.py`로 통합해 중복을 제거)과 정면으로 대비된다 — 한쪽에서 중복을 없애면서 같은 PR에서 다른 한쪽에 새 중복을 만들었다. 이 저장소는 정확히 이 실패 모드(`report_paths.py`의 `has_report`/`--verify-coverage` 중복이 2026-07-17 실제로 갈라졌던 사건)를 `test_report_paths_shared.py::AgreementTest`로 막아왔는데, 신규 중복 쌍에는 그런 안전장치가 없다.
  - 제안: `review_guard._summary_block_is_no`가 `_block_integrity.summary_block_verdict(text) == "NO"`를 호출하도록 통합하는 편이 근본적이다. 통합이 부담스럽다면 최소한 두 함수가 동일 입력 집합(대소문자 혼합, 공백 변형, `BLOCK:` 라인 부재 등)에 대해 같은 답을 내는지 확인하는 agreement 테스트를 추가한다.

- **[INFO]** `_shared/retry_state.py` 자체를 직접 import 해 단위 테스트하는 파일이 없다 — 전 커버리지가 두 orchestrator CLI 를 통한 subprocess 간접 테스트뿐
  - 위치: `.claude/tests/test_retry_state_shared.py` 전체(전 테스트가 subprocess 경유) — 비교 대상 `.claude/tests/test_report_paths_shared.py`(직접 import 하는 `ReportPathsTest` + `AgreementTest` 병행 보유)
  - 상세: `retry_state.py`의 모듈 docstring 이 스스로 "`_shared/report_paths.py`를 대체하는 것과 같은 배치"라고 밝히는데, `report_paths.py`는 직접 단위 테스트 + agreement 테스트 두 층위를 다 갖춘 반면 `retry_state.py`는 subprocess 층위만 있다. 구체적 부작용 하나: `emit_summary_state(session_dir, extra_fields=None)`의 `extra_fields`가 callable 이 아닌 "plain mapping"으로 전달되는 분기(`.claude/_shared/retry_state.py:130-131`, `else extra_fields`)는 현재 두 실호출자(`code_review_orchestrator`는 lambda 전달, `consistency_orchestrator`는 생략) 어느 쪽도 거치지 않으므로 테스트로 전혀 도달 불가능한 죽은 분기다. `retry_state.py`는 두 orchestrator가 겪는 `_lib` 패키지 충돌(project_config 등 skill 전용 의존성)이 없으므로, 직접 in-process 단위 테스트 추가에 기술적 장애가 없다.
  - 제안: `test_retry_state_shared.py`에 `_harness.load_module_by_path`로 `retry_state.py`를 직접 로드하는 테스트 클래스를 추가해 `load_state`(파일 없음 → `SystemExit(1)`), `reconcile_state_with_disk`의 반환 튜플, 그리고 `emit_summary_state`에 plain dict 를 직접 넘기는 경로를 단언한다.

- **[INFO]** (스코프 밖, 참고용) `merge_coordinator_orchestrator.py`가 이번에 통합된 것과 사실상 동일한 state-bookkeeping 사본을 그대로 들고 있고, 테스트가 전혀 없다
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:79-133` (`_load_state`/`_save_state`/`_emit_summary_state`/`_apply_status_update`)
  - 상세: 이 파일은 이번 diff 에 포함되지 않았으므로 이번 변경의 결함은 아니다. 다만 `retry_state.py`의 docstring 이 "두 orchestrator 가 사본을 들고 있었다"고 서술하는 것과 달리 실제로는 세 번째 사본이 리팩터링 대상 밖에 그대로 남아 있고(`_load_state`/`_save_state`/`_apply_status_update`는 구조적으로 동일, `_emit_summary_state`만 `branches`/`base` 필드로 다름), `.claude/tests/`의 어떤 파일도 이 orchestrator를 참조하지 않는다. 이번 통합이 "두 곳→하나"가 아니라 "세 곳 중 두 곳→하나, 한 곳은 미착수"라는 사실을 다음 작업자가 알아야 한다.
  - 제안: 이번 PR 스코프 확장 요구는 아님 — 후속 plan 항목으로만 기록 권장.

- **[INFO]** SUMMARY.md는 있으나 `BLOCK:` 라인이 파싱 불가한 케이스가 명시적으로 테스트되지 않음
  - 위치: `.claude/tests/test_block_integrity.py:58-67` (`DowngradedCriticalsTest._session`)
  - 상세: `_session` 헬퍼는 `block is not None`일 때만 `**BLOCK: {block}**` 라인을 쓰고, `None`이면 SUMMARY.md 자체를 만들지 않는다. 그 결과 `summary_block_verdict`가 `None`을 리턴하는 두 경로("파일 없음" / "파일은 있으나 `BLOCK:` 라인 없음") 중 후자는 실제로 연습되지 않는다. `downgraded_criticals`의 fail-open 동작(`!= "NO"` → `{}`)은 두 경로 모두 안전하지만, 후자(형식을 어긴 SUMMARY)가 실제 운영에서 더 흔히 발생할 수 있는 형태이므로 명시적으로 pin 해두면 의도가 더 분명해진다.
  - 제안: SUMMARY.md 는 존재하되 `BLOCK:` 라인이 없는(예: 자유 서술형 요약) 케이스에 대한 테스트 1개 추가.

- **[INFO]** `retry_state.load_state`가 직접 던지는 `sys.exit(1)` 경로(파일 없음)는 어떤 테스트에서도 그 함수를 통해 도달하지 않는다
  - 위치: `.claude/_shared/retry_state.py:41-47` (`load_state`)
  - 상세: `test_resume_missing_state_fails`(`test_orchestrator_state.py`)는 각 orchestrator의 `--resume` 전용 사전 점검(자체 `os.path.isfile` 체크, 별도 에러 메시지)만 때리며 `load_state`를 거치지 않는다. `--update`/`--summary-state`를 `_retry_state.json`이 없는 세션에 호출하는 시나리오는 어떤 스위트에도 없다. 리팩터링 이전에도 동일 코드가 각 orchestrator 안에 있었으므로 이번 diff 가 만든 새 결함은 아니지만, 5개 함수가 한 곳에 모인 지금이 이 fail-loud 경로를 pin 하기 좋은 시점이다.
  - 제안: 우선순위 낮음 — 여유 있을 때 추가.

## 요약

이번 PR은 (1) `BLOCK: NO` 하향을 검출하는 신규 백스톱 `block_integrity.py`와 (2) 두 orchestrator에 중복돼 있던 5개 state-bookkeeping 함수를 `_shared/retry_state.py`로 통합하는 리팩터링으로 구성된다. 신규 테스트(`test_block_integrity.py` 9케이스, `test_retry_state_shared.py` 4케이스)는 모두 통과했고, 관련 기존 스위트(`test_orchestrator_state.py` 28건, `test_consistency_orchestrator_state.py` 7건, `test_review_guard.py` 37건) 및 전체 하네스 스위트(724건)도 회귀 없이 통과를 확인했다. 격리(tempdir+addCleanup, 고유 세션 디렉터리), 가독성(각 테스트가 왜 존재하는지 서술한 docstring), mock 사용(실제 파일 I/O — git 관련이 아니므로 mocking 불필요)은 이 저장소의 확립된 관례를 잘 따른다. 다만 신규 백스톱이 명시적으로 표방하는 핵심 계약("경고만 하고 차단/스킵하지 않는다")은 관문 함수의 반환값이 아니라 stderr 출력만으로 pin 되어 있어 정작 가장 중요한 속성이 헐겁게 잠겨 있고, 새로 등장한 `CHECKER_REPORTS`/`ALL_CHECKERS` 하드코딩 쌍 및 `summary_block_verdict`/`_summary_block_is_no` 중복 파서 쌍은 이 프로젝트가 이미 여러 차례 실제 사고로 겪은 "동기화 안 된 N중 사본" 패턴을 별다른 테스트 없이 재현하고 있다. 셋 다 지금 당장 깨진 것은 아니며 저장소 자체(harness 메타 코드)에 국한되지만, 방치되면 이 PR이 막으려는 바로 그 실패(조용한 하향·드리프트)로 되돌아갈 수 있는 지점이라 우선순위 있게 다뤄질 가치가 있다.

## 위험도

MEDIUM
