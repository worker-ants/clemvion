# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 순수 내부 리팩터링
  - 위치: 전체 변경셋 (12개 파일: `.claude/_shared/git_probe.py`, `.claude/_shared/retry_state.py`, `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`, `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py`, 테스트 2개, 문서 2개, plan 문서 3개)
  - 상세: `requirements.txt`/`pyproject.toml`/`package.json`/`Pipfile` 등 의존성 매니페스트가 변경셋에 포함되지 않았다. 새로 추가된 import 는 전부 표준 라이브러리(`os`, `subprocess`, `json`, `sys`, `datetime`, `tempfile`, `shutil`, `unittest`, `unittest.mock`)이거나 저장소 내부 모듈(`_shared.git_probe`, `_shared.retry_state`, `_shared.report_paths`, `_shared.block_integrity`, `_harness`)이다. 버전 고정·라이선스·취약점 스캔 대상이 없다.
  - 제안: 없음 (해당 없음 확인 완료).

- **[INFO]** 내부 의존성 통합 — 중복 구현을 단일 SSOT 로 정리 (긍정적)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:47` (`from _shared import git_probe as _git_probe`), `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:52` (동일), `.claude/_shared/git_probe.py:150-212` (`_run_git`/`branch_diff_files` 신설)
  - 상세: 기존에 `code_review_orchestrator.get_git_branch_diff_files` 와 `consistency_orchestrator._branch_changed_rels` 가 "change both" 주석 하나로 유지되던 동일 git 호출을 각자 인라인 구현하고 있었고, 실측대로 이미 서로 드리프트(선행 공백 처리, `core.quotePath=false` 미적용, 10s/30s 타임아웃 차이)한 상태였다. 이번 변경은 그 로직을 `_shared/git_probe.branch_diff_files` 하나로 옮기고 두 orchestrator 가 위임하도록 만들어, "표준 라이브러리·기존 의존성으로 대체 가능한 불필요한 재구현"을 제거했다. 두 호출부 모두 기존에 이미 `_shared.retry_state`/`_shared.report_paths`/`_shared.block_integrity` 를 `# noqa: E402` 패턴으로 import 하고 있어 새 import 는 기존 관례를 그대로 따른다.
  - 제안: 없음 — 의존성 위생 관점에서 개선.

- **[INFO]** 순환 의존 없음 — `_shared` 패키지 내부 그래프 확인
  - 위치: `.claude/_shared/git_probe.py:34-35`(`import os`, `import subprocess`만), `.claude/_shared/retry_state.py:36-41`(`json`, `os`, `sys`, `datetime`, `from . import report_paths as _report_paths_lib`)
  - 상세: `git_probe.py` 는 외부 의존 없이 표준 라이브러리만 사용하고, `retry_state.py` 는 같은 패키지의 `report_paths` 만 상대 import 한다. `git_probe` ↔ `retry_state` 사이에 상호 참조가 없어 순환 의존 위험이 없다. `.claude/_shared/__init__.py` 의 module docstring 이 "hooks/_lib 와 skills/_lib 이름 충돌을 피하려고 3번째 최상위 패키지로 분리했다"는 설계 근거를 명시하고 있고, 이번 변경은 그 기존 설계를 그대로 확장한 것이다.
  - 제안: 없음.

- **[INFO]** 세 번째 orchestrator 의 상태-동기화 의존 공백 해소
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:114-127`(`_reconcile_state_with_disk`, `_emit_summary_state` 위임), `:543-549`(`--resume` 경로에 재조정 추가)
  - 상세: `merge_coordinator_orchestrator.py` 는 형제 orchestrator 둘과 달리 `_shared/retry_state.reconcile_state_with_disk` 를 전혀 호출하지 않아(변경 전 AST 실측 0회) 자기치유가 없었다. 이번 변경으로 `_emit_summary_state` 를 `_retry_state_lib.emit_summary_state(session_dir, extra_fields=...)` 로 위임하고 `--resume` 경로에도 재조정을 추가해, 세 orchestrator 가 `_shared/retry_state.py` 라는 동일한 내부 모듈에 의존하는 구조로 수렴했다. `extra_fields` 콜백 파라미터로 `branches`/`base` 라는 이 skill 고유 필드만 분리해 전달하는 설계라 공유 모듈이 이 skill 특유의 필드를 알 필요가 없다 — 내부 의존 방향이 깨끗하다(orchestrator → shared, 역방향 없음).
  - 제안: 없음.

- **[INFO]** `subprocess` 사용 패턴 — 기존 안전 관례 유지
  - 위치: `.claude/_shared/git_probe.py:137-147`(`_run_git_raw` 내부 `subprocess.run(["git", "-c", "core.quotePath=false"] + args, ...)`)
  - 상세: 리스트 인자 기반 호출(`shell=True` 미사용)이라 셸 인젝션 표면이 없다. 기존 `_run_git` 과 동일한 호출 패턴을 그대로 재사용(`_run_git_raw` 로 분리 후 `_run_git` 이 위임)하므로 새로운 취약점 표면이 생기지 않는다.
  - 제안: 없음.

## 요약

이번 변경셋은 새 외부 패키지를 추가하지 않는 순수 내부 리팩터링이다 — 의존성 매니페스트(`requirements.txt` 등) 변경이 없고, 새 import 는 전부 표준 라이브러리 또는 저장소 내부 `_shared/` 모듈이다. 핵심 내용은 두 orchestrator(`code_review_orchestrator.py`, `consistency_orchestrator.py`)에 "change both" 주석으로 유지되며 이미 드리프트가 실측된 중복 git-diff 구현을 `_shared/git_probe.branch_diff_files` 로 단일화하고, `merge_coordinator_orchestrator.py` 가 형제 두 orchestrator와 동일하게 `_shared/retry_state.py` 의 재조정 로직에 위임하도록 만든 것이다. `_shared` 패키지 내부에 순환 의존이 없고, import 관례(`# noqa: E402` 위치)도 기존 코드와 일관되며, 이 통합은 "불필요한 재구현 제거"와 "내부 의존 그래프 정리" 두 축 모두에서 긍정적이다. 취약점·라이선스·버전 고정·번들 크기 관점에서 검토할 대상 자체가 없다.

## 위험도

NONE
