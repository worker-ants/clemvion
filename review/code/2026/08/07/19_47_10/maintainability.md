# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 하드코딩된 오류 메시지 길이 상수(매직 넘버)
  - 위치: `.claude/_shared/git_probe.py:209` (`branch_diff_files` 함수, `reason = err.strip()[:200] or ...`)
  - 상세: stderr 트렁케이션 길이 `200` 이 이름 없는 리터럴로 박혀 있다. 기존에 두 orchestrator 각각에 흩어져 있던 동일한 `[:200]` 을 이번에 한 곳(`git_probe.py`)으로 모은 것 자체는 중복 제거로서 개선이지만, 상수화(예: `_ERROR_REASON_MAX_LEN = 200`)는 하지 않아 "왜 200인지"를 알 수 없는 매직 넘버가 여전히 남아 있다.
  - 제안: 모듈 상단에 `_ERROR_REASON_TRUNCATE = 200` 같은 이름 있는 상수로 추출하면 트렁케이션 의도가 코드에서 바로 드러난다. 필수는 아니지만 이 모듈이 여러 호출자의 공용 지점이 됐으므로 값의 의미를 명시하는 편이 향후 조정 시 안전하다.

- **[INFO]** `on_error` 콜백 파라미터에 타입힌트 누락 (파일 내 다른 시그니처와 불일치)
  - 위치: `.claude/_shared/git_probe.py:168-169` (`def branch_diff_files(base_ref: str, cwd: str, *, timeout: float = 30.0, on_error=None) -> list[str]:`)
  - 상세: 이 파일은 `from __future__ import annotations` 를 쓰고 `_run_git`/`_run_git_raw`/`_current_branch`/`_origin_default_branch` 등 기존 함수 전부가 인자·반환값에 타입힌트를 갖추고 있다. 새로 추가된 `branch_diff_files` 도 `base_ref`, `cwd`, `timeout`, 반환값은 타입힌트가 있는데 `on_error` 만 어노테이션이 빠져 있어, 같은 함수·같은 파일 안에서 국소적인 일관성 결이 어긋난다.
  - 제안: `on_error: Callable[[str], None] | None = None` 으로 명시하면 파일 전체의 완전 타입힌트 컨벤션과 맞아떨어진다.

- **[INFO]** import alias 네이밍 컨벤션 드리프트 (`_lib` 접미사 유무 혼재)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:47` (`from _shared import git_probe as _git_probe`), 동일 패턴이 `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:52` 에도 있음
  - 상세: 같은 블록의 다른 두 import 는 `_report_paths_lib`, `_retry_state_lib` 처럼 `_lib` 접미사를 쓰는데, 새로 추가된 `git_probe` 는 접미사 없이 `_git_probe` 로 alias 된다. (consistency_orchestrator.py 쪽은 이미 `_block_integrity` 라는 접미사 없는 선례가 있어 완전히 새로운 불일치는 아니지만, 두 파일 모두에서 "shared 모듈은 `_lib` 접미사" 규칙이 지켜지지 않는 사례가 하나씩 더 늘었다.)
  - 제안: 사소한 스타일 이슈라 강제할 필요는 없으나, 다음에 `_shared` 신규 모듈을 import 할 때는 팀 내에서 접미사 규칙을 한 번 정리해두면 좋다. 기능에는 영향 없음.

## 요약

이번 변경은 `git_probe.py`/`retry_state.py` 에 공용 헬퍼(`branch_diff_files`, `_run_git_raw`, `fatal_sentinel_path`/`fatal_on_disk`/`_record_fatal`)를 추가해 세 orchestrator(code-review, consistency, merge-coordinator)에 흩어져 있던 거의 동일한 git 명령·상태 재조정 로직을 제거하는 리팩터링으로, 유지보수성 관점에서 전반적으로 우수하다. 함수는 짧고 단일 책임을 지키며, 중첩도 낮고, 네이밍(`_run_git_raw` vs `_run_git`, `fatal_sentinel_path`/`fatal_on_disk`/`_record_fatal`)이 의도를 명확히 드러낸다. 모든 신규 함수에 "왜 이렇게 설계했는가"를 설명하는 docstring이 붙어 있고 이는 이 코드베이스 전반의 기존 컨벤션(이력·근거를 코드에 남기는 서술형 주석)과 일치한다. 매직 넘버·타입힌트 누락·import alias 접미사 불일치는 모두 사소한 스타일 편차로, 기능이나 향후 수정 안전성에 실질적 위험을 주지 않는다. 신규 테스트(`test_branch_diff_shared.py`, `test_retry_state_shared.py` 확장분)도 각 orchestrator의 실제 진입점을 구동해 "두 구현이 일치한다"는, 이 리팩터링이 지키려는 속성 자체를 직접 검증하고 있어 유지보수성 측면에서 추가 안전판 역할을 한다.

## 위험도
LOW
