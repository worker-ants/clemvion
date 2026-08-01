# Dependency Review — 2026/07/31 19_03_11

## 발견사항

- **[WARNING]** `str.removesuffix()` — Python ≥3.9 전용 stdlib 메서드가 이 harness Python 트리 최초로 도입되어, 명시된 바 없는 최소 런타임 버전을 암묵적으로 끌어올린다
  - 위치: `.claude/_shared/block_integrity.py:126` (`contradiction_note()` 안 `f"{k.removesuffix('.md')}={v}"`)
  - 상세: 저장소 전체 `.claude/**/*.py` 를 grep 한 결과 `removesuffix`/`removeprefix` 사용은 이 한 줄이 유일하다(기존 코드는 전무). `.claude/tests/README.md` 는 harness Python 의 규약을 "third-party dependencies 0, hooks must run on a bare `python3`" 라고 명시하지만 최소 **버전**은 어디에도 고정돼 있지 않다 — `.python-version`/`pyproject.toml`/`setup.cfg` 없음, CI(`*.yml`)는 `python-version: '3.x'`(항상 최신)만 지정해 로컬 컨트리뷰터의 시스템 `python3` 버전은 통제 대상이 아니다. Python 3.8 이하(예: 구형 배포판의 기본 `python3`)에서 이 줄이 실행되면 `AttributeError` 가 발생한다.
    파일 상단의 `from __future__ import annotations` 는 타입 힌트만 지연 평가할 뿐 이 런타임 문자열 메서드 호출은 보호하지 못한다.
    호출 경로를 추적하면: `contradiction_note()` → `review_guard._newest_resolved_impl_done_mtime()`(`.claude/hooks/_lib/review_guard.py:757` 부근) → `evaluate_review()`. 이 예외는 `guard_review_before_push.py` 의 `_evaluate_over_targets()` 가 `try/except Exception` 으로 감싸(`.claude/hooks/guard_review_before_push.py:831-837`) 대상별 fail-open 시키므로 **하드 크래시는 아니며**, 기존 §E 관측 메커니즘(`outcome.degraded` 카운터 + 배너)으로 보고는 된다 — 이 점이 심각도를 CRITICAL 이 아닌 WARNING 으로 제한하는 근거다. 다만 그 결과는 "이번 PR 이 새로 추가하려는 하향-감지 경고 1건이 안 뜨는" 수준이 아니라 **REVIEW/PLAN 게이트 전체가 해당 push 에 대해 조용히(배너까지는 뜨지만) 무력화**되는 것이라, 이 파일이 막으려는 바로 그 "silent" 클래스의 축소판이 재발하는 셈이다.
  - 제안: `k[:-3] if k.endswith(".md") else k` 처럼 버전-무관 표현으로 교체(또는 최소 버전을 3.9+ 로 공식 채택하고 `.claude/tests/README.md`/CI 에 명시). 후자를 택할 경우 이 한 줄만이 아니라 harness Python 전체의 "any python3" 전제를 재검토해야 한다.

- **[INFO]** 세 orchestrator 의 `_shared/retry_state.py` 채택이 비대칭 — `merge_coordinator_orchestrator.py` 만 부분 위임
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:85`(`_emit_summary_state`, 로컬 구현 유지)·`:110`(`_load_state`, 위임)·`:114`(`_save_state`, 위임)·`:118`(`_apply_status_update`, 로컬 구현 유지) — `_reconcile_state_with_disk` 대응 함수 자체가 없음
  - 상세: `code_review_orchestrator.py`(`_shared/retry_state.py:190-209` 위임)와 `consistency_orchestrator.py`(`:91-108` 위임)는 5개 함수(`load_state`/`save_state`/`reconcile_state_with_disk`/`apply_status_update`/`emit_summary_state`) 전부를 `.claude/_shared/retry_state.py` 로 위임하지만, `merge_coordinator_orchestrator.py` 는 `_load_state`/`_save_state` 두 개만 위임하고 `_apply_status_update`/`_emit_summary_state` 는 branch/base 필드가 달라 로컬 사본을 유지하며, `_reconcile_state_with_disk` 자기치유 로직은 아예 없다. 결과적으로 Agent tool 로 직접 fan-out 한 merge-coordinator 세션은 prepare 시점 스냅샷에 고정된 채 SUMMARY 가 실제 성공을 보고하는 모순을 그대로 겪을 수 있다 — 다른 두 orchestrator 가 이번 PR 로 이미 닫은 것과 같은 클래스의 갭이다.
    이 비대칭은 새로 발견한 것이 아니라 `plan/in-progress/harness-review-gate-ci-backstop.md:76-82`(항목 9)에 "다른 skill 의 동작 변경이라 별도 PR 로 분리한다" 로 이미 의도적으로 추적·이연돼 있다. 코드 자체의 결함이라기보다 **내부 모듈 의존 관계의 현재 상태**로 기록해 둔다.
  - 제안: 별도 PR 에서 `merge_coordinator_orchestrator.py` 에도 `reconcile_state_with_disk` 위임을 추가할 때 이 노트를 참조.

- **[INFO]** 신규 외부 의존성 없음 — 순수 stdlib + 내부 패키지 재구성
  - 위치: `.claude/_shared/block_integrity.py`, `.claude/_shared/retry_state.py`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`, `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py`, `.claude/tests/test_block_integrity.py`, `.claude/tests/test_retry_state_shared.py` 전체
  - 상세: 변경된 9개 Python 파일의 `import`/`from` 문을 전수 확인 — 전부 stdlib(`os`, `re`, `json`, `sys`, `subprocess`, `tempfile`, `shutil`, `unittest`, `datetime`, `argparse`, `contextlib`, `io`) 또는 저장소 내부 모듈(`lib.*`, `_lib.*`, `_shared.*`, `_harness`)뿐이다. `git diff --stat origin/main...HEAD` 에도 `requirements.txt`/`package.json`/`pyproject.toml`/lockfile 변경이 전혀 없다. `.claude/_shared/__init__.py`(변경 없음, 기존 파일)에 문서화된 대로 `_shared` 는 `hooks/_lib` 와 `skills/_lib` 이름 충돌을 피하려 만든 세 번째 최상위 패키지이며, 이번 PR 은 그 패키지에 신규 모듈 2개(`block_integrity.py`, `retry_state.py`)를 추가하는 내부 리팩토링이다. 순환 임포트도 없음: `retry_state.py` → `report_paths.py`(단방향, `os` 만 사용), `block_integrity.py` 는 외부 의존 없음.
    체크리스트 1(신규 의존성)·2(버전 고정)·3(라이선스)·4(취약점)·5(불필요한 의존성)·6(번들 크기·빌드시간) 은 전부 해당 사항 없음(N/A) — 새 패키지가 없으므로 pin/license/vuln/번들 논의 대상 자체가 없다. `.claude/tests/README.md` 가 명시하는 "zero third-party dependencies" 규약이 그대로 지켜졌다.

## 요약

이번 diff 는 `code_review_orchestrator.py`/`consistency_orchestrator.py`/`merge_coordinator_orchestrator.py` 세 곳에 중복돼 있던 상태 관리·검증 로직을 `.claude/_shared/{block_integrity,retry_state}.py` 두 신규 stdlib-only 모듈로 추출하는 순수 내부 리팩토링으로, 외부 패키지·라이선스·취약점·번들 크기 축은 전부 변경 사항이 없다(신규 의존성 0). 유일한 실질 발견은 `block_integrity.py` 가 이 harness Python 트리에서 처음으로 `str.removesuffix()`(Python ≥3.9)를 사용해 어디에도 명시되지 않은 최소 런타임 버전을 암묵적으로 올린다는 점이며, 영향은 기존 push/stop 게이트의 fail-open 관측 메커니즘(`outcome.degraded` + 배너)으로 이미 완충돼 하드 크래시는 아니지만 구형 `python3` 환경에서는 이번 PR 이 추가하려는 하향-감지 경고 자체가 조용히 꺼진다. 그 외 `merge_coordinator_orchestrator.py` 만 `_shared/retry_state.py` 를 부분 위임(자기치유 로직 없음)하는 내부 의존 비대칭은 실재하지만 plan 문서에 별도 PR 로 명시적으로 이연돼 있어 이번 변경의 결함이 아니다.

## 위험도

LOW
