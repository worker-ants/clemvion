# Dependency Review — harness-block-backstop (2026-08-01 00_03_38)

## 발견사항

- **[INFO]** 신규 외부 의존성 없음 — 전 변경이 표준 라이브러리 + 내부 모듈로만 구성
  - 위치: `.claude/_shared/block_integrity.py:29-32` (`from __future__ import annotations` / `import os` / `import re`), `.claude/_shared/retry_state.py:31-38` (`json`/`os`/`sys`/`datetime`/`from . import report_paths`)
  - 상세: `origin/main..HEAD` 전 diff(14개 리뷰 대상 파일 + 나머지 커밋 포함)에서 새로 추가된 `import`/`from` 문을 전수 grep 했다. 결과는 표준 라이브러리(`os`, `re`, `json`, `sys`, `datetime`, `shutil`, `tempfile`, `unittest`, `subprocess`, `__future__`)와 내부 harness 모듈(`_shared.report_paths`, `_shared.block_integrity`, `_shared.retry_state`, 테스트용 `_harness`) 뿐이다. `package.json`/`requirements.txt`/`pyproject.toml`/`Pipfile`/lock 파일 등 의존성 매니페스트 변경도, `pip install`/`npm install` 류 설치 단계 변경도 diff 전체에 0건이다. `.claude/tests/README.md` 가 명시한 "harness 의 Python 은 third-party 의존성 0 — hooks must run on a bare `python3`" 컨벤션을 그대로 준수한다.
  - 라이선스/취약점: 해당 없음 (신규 외부 패키지가 없으므로 라이선스 호환성·CVE 스캔 대상 자체가 없다).
  - 제안: 없음 — 현행 유지.

- **[WARNING]** 체커 5종 canonical 목록이 서로 다른 파일에 독립적으로 두 벌 존재하며, 둘을 묶는 테스트가 없다
  - 위치: `.claude/_shared/block_integrity.py:72-78` (`ALL_CHECKERS = (...)`) vs `.claude/skills/code-review-agents/lib/role_instructions.py:215` (`CHECKER_INSTRUCTIONS = {...}` dict 키)
  - 상세: 이번 PR 은 `consistency_orchestrator.py:54`의 `ALL_CHECKERS = list(_block_integrity.ALL_CHECKERS)`로 orchestrator 자신의 하드코딩 목록을 없애고 `_shared/block_integrity.py`의 canonical tuple 을 파생시켰다 — 이는 orchestrator↔backstop 간 중복을 정확히 없앤 개선이다(`block_integrity.py` 자체 주석: "a name added there and forgotten here would let that checker's downgrade pass unnoticed... The orchestrator derives `ALL_CHECKERS` from it"). 다만 이 tuple 은 손으로 다시 작성된 것이고, 이미 같은 5개 체커 이름(`cross_spec`/`rationale_continuity`/`convention_compliance`/`plan_coherence`/`naming_collision`)을 key 로 갖고 있는 기존 SSOT `role_instructions.CHECKER_INSTRUCTIONS`(체커 prompt 를 만드는 데 쓰임, `test_agent_consistency.py`가 `.claude/agents/*.md`·`.claude.project.json`·README.md 3곳과 묶어 지킴)와는 여전히 **독립된 두 번째 목록**이다. 직접 실행해 확인한 결과 현재는 두 목록의 내용과 순서가 정확히 일치하지만(`['cross_spec', 'rationale_continuity', 'convention_compliance', 'plan_coherence', 'naming_collision']`), `test_agent_consistency.py`도 `test_block_integrity.py`의 `CheckerListIsCanonicalTest`(orchestrator↔block_integrity 일치만 검증)도 `block_integrity.ALL_CHECKERS`↔`role_instructions.CHECKER_INSTRUCTIONS` 일치는 검증하지 않는다. 즉 향후 6번째 체커를 추가(혹은 개명/제거)하면서 `role_instructions.py`+3곳만 갱신하고 `block_integrity.ALL_CHECKERS`를 빠뜨려도 기존 테스트는 전부 통과한다 — 이 PR 이 "체커 리포트 판독" 축에서 막으려는 바로 그 실패 양상("한 곳에 추가되고 다른 곳에서는 잊힌 이름")이 "체커 등록" 축에서 재발할 수 있는 지점을 새로 만든 셈이다.
  - 참고(설계상 타당한 이유로 병합은 권장하지 않음): `_shared/__init__.py`가 스스로 "`_shared`는 hooks 도 skills 도 소유하지 않는 제3의 최상위 패키지"라고 명시한다. `role_instructions.py`는 `code-review-agents/lib` 소속(스킬 전용)이라 훅 프로세스(`review_guard.py`)의 `sys.path`에는 없다 — `block_integrity.py`가 `role_instructions.py`를 직접 import 하는 방향으로 통합하면 더 낮은 계층(`_shared`, 훅에서도 쓰임)이 더 특수한 계층(스킬 전용 `lib/`)을 참조하는 역방향 결합이 생긴다. 그러니 "가져와서 합치라"가 아니라 "두 목록이 갈라지면 테스트가 잡게 하라"가 맞는 처방이다.
  - 제안: `test_block_integrity.py`(또는 `test_agent_consistency.py`)에 `set(BI.ALL_CHECKERS) == set(role_instructions.CHECKER_INSTRUCTIONS)` 한 줄만 고정하는 케이스를 추가. import 방향을 바꾸지 않고 동치성만 assert 하면 두 SSOT 가 갈라져도 CI 가 잡는다.

- **[INFO]** `merge_coordinator_orchestrator.py`는 `_shared/retry_state.py`를 부분 채택 — 의도적이며 이미 문서화됨
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:39-48` (`sys.path.insert(0, CLAUDE_DIR)` + `from _shared import retry_state as _retry_state_lib`), 함수 `_load_state`/`_save_state`/`_apply_status_update`
  - 상세: 3개 orchestrator(code-review / consistency / merge-coordinator) 중 앞의 둘은 상태 헬퍼 5종 전부(`_reconcile_state_with_disk`의 디스크 self-healing 포함)를 `_shared/retry_state.py`에 위임하지만, `merge_coordinator_orchestrator.py`는 `_load_state`/`_save_state`/`_apply_status_update` 3개만 위임하고 `_reconcile_state_with_disk`는 이 파일에 아예 없다 — 즉 이 skill 은 Agent tool 로 직접 fan-out 했을 때의 self-healing 이 없다. 코드 내 주석과 `plan/in-progress/harness-review-gate-ci-backstop.md`의 후속 항목 #9가 이 gap 을 "다른 skill 의 동작 변경이라 별도 PR 로 분리한다"로 이미 명시적으로 defer 해뒀다 — 누락이 아니라 스코프 결정이며, 이번 PR 범위에서 추가 조치는 불필요하다.
  - 제안: 없음(추적 중). 후속 PR 에서 `merge_coordinator_orchestrator.py`도 완전히 `_shared/retry_state.py`로 통일되면 세 orchestrator의 내부 의존성 형태가 대칭을 이룬다.

- **[INFO]** Python 버전 호환성 회귀 없음
  - 위치: `.claude/_shared/block_integrity.py:133-136` (주석), `.claude/hooks/_lib/review_guard.py:91` (`from __future__ import annotations`)
  - 상세: 신규 두 `_shared` 모듈 모두 `from __future__ import annotations`로 타입힌트를 지연 평가시키고, `str.removesuffix()`(Python 3.9+ 전용) 사용을 의도적으로 피해 harness 의 "bare `python3`" 최소 버전 요구를 지킨다 — `block_integrity.py` 자체 주석이 근거를 명시("Not `removesuffix`: it needs Python 3.9 and would be this tree's first use, silently raising the harness's minimum. On an older `python3` the AttributeError... fails the REVIEW gate open for that push entirely"). `review_guard.py`에 추가된 `notes: tuple[str, ...] = ()` dataclass 필드도 같은 `__future__` 가드 하에 있어 구버전에서도 안전하다. `match`/walrus(`:=`)/`removeprefix`/`zip(strict=)` 등 신버전 전용 구문은 이번 diff 전체에 없음을 grep 으로 확인했다.
  - 제안: 없음.

- **[INFO]** 신규 `_shared` 모듈의 순환 임포트·네임스페이스 충돌 없음 확인
  - 위치: `.claude/_shared/retry_state.py:38` (`from . import report_paths as _report_paths_lib`), `.claude/_shared/__init__.py`
  - 상세: `report_paths.py`는 `os`만 import 하므로 `retry_state.py → report_paths.py` 단방향이고 역순환이 없다. `.claude` 트리 전체에서 `_shared` 디렉터리는 `.claude/_shared/` 하나뿐임을 확인했고(`.claude/_lib`은 애초에 존재하지 않음), 이번에 `merge_coordinator_orchestrator.py`가 새로 추가한 `sys.path.insert(0, CLAUDE_DIR)`이 기존 `_lib`(hooks 쪽/skills 쪽 각각 별도 디렉터리) 해석과 충돌하지 않는다. `_shared`를 세 번째 `_lib`으로 이름 짓지 않고 별도 최상위 패키지로 둔 기존 설계(`_shared/__init__.py`의 자체 설명)가 이 종류의 shadowing 위험을 이미 구조적으로 피해 간다.
  - 제안: 없음.

## 요약

이번 변경은 harness 자동화 계층(`.claude/`) 내부의 순수 Python 리팩터링 + 신규 backstop 모듈 추가로, 외부 패키지를 단 하나도 도입하지 않는다 — 두 신규 공유 모듈(`_shared/block_integrity.py`, `_shared/retry_state.py`)과 그 소비자(`review_guard.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`, `merge_coordinator_orchestrator.py`)는 모두 표준 라이브러리와 기존 내부 모듈만 사용하며, 프로젝트가 명시한 "harness Python 은 third-party 의존성 0" 컨벤션을 그대로 지킨다. 라이선스·취약점·번들 크기·버전 고정 항목은 신규 외부 의존성이 없어 해당 사항이 없고, Python 버전 호환성도 의도적으로 지켜졌다(`removesuffix` 회피 등). 실질적인 "의존성" 표면은 내부 모듈 간 관계 재편(3번째 항목의 "내부 의존성")이며, 대부분은 중복 제거 방향의 개선(orchestrator 가 `_shared`로 위임)이자 명시적으로 스코프 결정된 부분 채택(merge-coordinator)이다. 다만 이번에 `_shared/block_integrity.py`가 만든 새 canonical 체커 목록(`ALL_CHECKERS`)이, 이미 존재하던 `role_instructions.CHECKER_INSTRUCTIONS`라는 또 다른 SSOT 와 여전히 독립적으로 손으로 유지되면서도 둘을 묶는 테스트가 없다는 점은, 이 PR 이 다른 축에서 막으려는 것과 같은 종류의 조용한 drift 를 새로 하나 열어 둔 것이라 WARNING 으로 짚는다.

## 위험도

LOW
