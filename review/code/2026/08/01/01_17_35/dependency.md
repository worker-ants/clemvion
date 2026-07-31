# 의존성(Dependency) Review

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 전부 표준 라이브러리 + 내부 패키지
  - 위치: `.claude/_shared/block_integrity.py` (신규 파일 전체), `.claude/_shared/retry_state.py` (신규 파일 전체)
  - 상세: 이번 변경의 핵심인 신규 파일 2개(`block_integrity.py`, `retry_state.py`)와 이를 소비하는 5개 파일(`review_guard.py`, `guard_review_before_push.py`, `guard_review_before_stop.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`, `merge_coordinator_orchestrator.py`)이 전부 `os`/`re`/`json`/`sys`/`datetime`/`traceback` 표준 라이브러리와 프로젝트 내부 패키지(`_shared`, `_lib`, `lib`)만 import 한다(직접 grep 확인). `.claude/tests/README.md:14-17`에 명시된 "harness Python 은 표준 라이브러리만 쓰고 third-party 의존성 0, `pytest`/`requirements.txt` 도입 금지" 컨벤션을 그대로 준수한다. 신규 테스트 2개(`test_block_integrity.py`, `test_retry_state_shared.py`)도 `unittest`/`tempfile`/`shutil`/`subprocess`/`ast`/`importlib.util` 등 표준 라이브러리만 사용.
  - 제안: 없음 (현행 유지 권장)

- **[WARNING]** `_shared/retry_state.py` 채택이 3개 소비자 사이에서 비대칭 — merge-coordinator 만 self-healing reconcile 을 못 받음
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:100-123` (특히 108행 "has no `_reconcile_state_with_disk` at all")
  - 상세: `code_review_orchestrator.py`(190/194/198/202/206행)와 `consistency_orchestrator.py`(91/95/99/103/107행)는 `_retry_state_lib`의 5개 함수(`load_state`/`save_state`/`reconcile_state_with_disk`/`apply_status_update`/`emit_summary_state`)를 전부 위임하지만, `merge_coordinator_orchestrator.py`(114/118/122행)는 `load_state`/`save_state`/`apply_status_update` 3개만 위임한다. `reconcile_state_with_disk` 호출부가 이 파일에 전혀 없음을 grep 으로 확인했다 — 즉 같은 `_shared` 모듈을 "공유"해도 세 소비자가 실제로 받는 보장(디스크 기준 self-healing)의 범위가 다르다. Agent tool 로 직접 fan-out 한 merge-coordinator 세션이 `--update` 를 안 부르면 `_retry_state.json` 이 prepare 시점 스냅샷에 멈춘 채 SUMMARY 는 실제 성공을 보고하는, 다른 두 orchestrator 가 이미 해소한 것과 동일한 결함 클래스를 여전히 안고 있다.
  - 제안: 코드 주석(107-112행)과 `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 9에 이미 후속 작업으로 등록돼 있어 은폐된 문제는 아니다. 다만 "세 소비자가 `_shared`를 공유하니 계약도 동일하다"는 전제로 향후 `retry_state.py`를 변경할 때 이 비대칭을 다시 놓치지 않도록, 후속 PR에서 `merge_coordinator_orchestrator.py`에도 `reconcile_state_with_disk` 위임을 마저 적용할 것.

- **[INFO]** Python 버전 호환성 보존 — PEP 604/585 타입힌트 지연 평가 + `str.removesuffix()` 의도적 회피
  - 위치: `.claude/_shared/block_integrity.py:133-136` (removesuffix 회피 주석), `.claude/_shared/block_integrity.py:96` (`str | None`), `.claude/_shared/block_integrity.py:110` (`dict[str, int]`)
  - 상세: 변경/신규 파일 전부(`block_integrity.py:29`, `retry_state.py:31`, `review_guard.py:91`, `failopen_state.py:23`, `guard_review_before_push.py:43`, `guard_review_before_stop.py:29`) `from __future__ import annotations` 를 유지하고 있어, `str | None`/`dict[str, int]`/`list[str]`/`tuple[str, ...]` 같은 PEP 604/585 문법이 전부 annotation 위치에서만 쓰이고 지연 평가된다(실행 시 평가되지 않음) — Python 3.9 미만에서도 안전하다. `contradiction_note()`는 한 걸음 더 나아가 `str.removesuffix()`(3.9+ 런타임 API) 사용을 의도적으로 피하고 그 근거를 주석으로 남겼다: "이 트리에서 첫 사용이 되어 harness 최소 버전을 조용히 올리게 되고, 구버전 `python3` 에서는 AttributeError 가 이 advisory 만 조용히 누락시키는 게 아니라 호출자의 넓은 `except Exception` 이 REVIEW 게이트 자체를 그 push 에 대해 통째로 fail-open 시킨다." 의존성/호환성 관점에서 바람직한 선례로 판단된다.
  - 제안: 없음 (참고용 긍정 확인)

- **[INFO]** 내부 패키지 명명·의존 방향 — `_shared` 신설이 기존 `_lib` 네임스페이스 충돌을 의도적으로 회피, 방향은 단방향 유지
  - 위치: `.claude/hooks/_lib/review_guard.py:130-131`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:44-45`, `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:47-48`
  - 상세: `.claude/hooks/_lib` 와 `.claude/skills/_lib` 는 동일 이름이라 한 인터프리터가 둘 다 import 하면 충돌하는 기존 문제가 있고, 이번 PR 의 신규 테스트(`test_block_integrity.py`의 `test_orchestrator_derives_its_list_from_here` 주석)도 이를 "the same dodge the consistency suites document" 라고 명시한다. 이번 PR 은 세 번째 `_lib` 을 만드는 대신 `_shared` 라는 별도 최상위 패키지를 선택했다(`.claude/_shared/__init__.py` 자체 docstring 이 "Deliberately a third top-level package rather than a third `_lib`" 라고 이유를 명시) — 동일 충돌을 재발시키지 않는 설계다. `.claude/` 최상위 디렉터리를 직접 확인한 결과 `lib`/`_lib`/`session` 명의 충돌 대상도 없다. 의존 방향도 일관되게 단방향이다(`hooks/`·`skills/` → `_shared`, 역방향 없음) — `test_block_integrity.py`의 `test_role_instructions_registers_the_same_checkers` 는 이 방향을 어기지 않으려고 `_shared`가 `skills/code-review-agents/lib/role_instructions.py`를 직접 import하는 대신 독립적으로 로드해 비교하는 방식을 택했다.
  - 제안: 없음 (설계 확인)

- **[INFO]** 리팩터 방향이 의존성 축소(중복 제거) 쪽 — dead import 오탐 없음 확인
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:47-48,262`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:43-45`
  - 상세: 두 orchestrator 가 각자 유지하던 5개 함수의 바이트 동일 사본(과거 "Change both" 주석으로 동기화 — `report_paths.py` 분리를 불렀던 것과 동일 패턴, AST 비교로 4/5 identical 확인됨)을 `_shared/retry_state.py` 로 흡수했다. `code_review_orchestrator.py`는 `_report_paths_lib` import 를 유지하는데 262행에서 `_report_paths_lib.missing_reports(...)` 를 여전히 직접 호출해 실사용을 확인했고(dead import 아님), `consistency_orchestrator.py`는 동일 import 를 제거했는데 grep 결과 남은 참조가 주석 2곳뿐이라(43행, 87행 comment) 죽은 import 가 아니라 그 파일의 유일한 사용처가 `_shared/retry_state.py` 내부로 이동해 생긴 정확한 정리임을 확인했다.
  - 제안: 없음 (정상 리팩터 확인)

## 요약

이번 변경은 harness(`​.claude/`) 내부에서 두 orchestrator(그리고 부분적으로 세 번째)가 각자 유지하던 `_retry_state.json` 상태 관리 코드와, 지금까지 존재하지 않았던 "SUMMARY BLOCK 판정 vs checker `[CRITICAL]` 모순" 백스톱 로직을 각각 `_shared/retry_state.py`, `_shared/block_integrity.py` 로 신설·흡수하는 순수 내부 리팩터/기능 추가다. 새 외부 패키지는 전혀 도입되지 않았고 표준 라이브러리만 사용해 harness Python 의 "third-party 의존성 0" 컨벤션을 그대로 지켰으므로 버전 고정·라이선스·취약점·번들 크기 관점에서는 해당 사항이 없다. Python 버전 호환성(`removesuffix` 회피, `from __future__ import annotations` 일관 적용)과 패키지 명명(`_shared` 신설로 기존 `_lib` 충돌 회피, 단방향 의존 유지)은 모두 의도적으로 잘 처리되어 있다. 유일한 실질 발견은 내부 의존성 축(8번 관점)에서: `_shared/retry_state.py`의 5개 함수 중 `merge_coordinator_orchestrator.py`만 3개만 위임받고 self-healing `reconcile_state_with_disk`는 위임받지 못해 세 소비자 간 계약 범위가 비대칭이라는 점인데, 이는 코드 주석과 plan 문서에 이미 후속 과제로 명시적으로 등록되어 있어 은폐된 리스크는 아니다.

## 위험도
LOW
