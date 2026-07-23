### 발견사항

- **[CRITICAL]** 새 회귀 테스트가 정작 자신이 존재하는 이유(README 미러 stale count)를 잡지 못한다 — README 는 지금도 24 로 stale
  - 위치: `.claude/tests/test_router_safety_policy_doc.py` — `test_table_states_the_real_extension_count` (파일 3, 게이트 97~105행) 및 `PolicyMatrixMatchesConstantsTest._readme_extension_list` (게이트 92~95행)
  - 상세: 이 PR 은 `router_safety.py` 의 docstring 표("24 extensions" → "44 extensions", 파일 1 게이트 36행)를 고치고, 같은 종류의 drift 를 다시는 놓치지 않도록 `test_router_safety_policy_doc.py` 를 새로 추가했다. 이 테스트의 module docstring(파일 3 게이트 1~19행)은 스스로 "the source-extension count and spelled-out list (**both docs**)" 를 검증한다고 선언한다. 그러나 실제 구현을 보면:
    - `test_table_states_the_real_extension_count` 는 `\| Source-code file \((\d+) extensions below\)` 패턴으로 **`self.doc`(router_safety.py 의 docstring)만** 검사한다. `self.readme` 의 개수는 전혀 검사 대상이 아니다.
    - `test_readme_list_is_exactly_the_constant` 은 README 의 확장자 **나열 목록**(`소스 코드 확장자: ...`)만 검사하고, README 의 표 행 `| 소스 파일 (24 확장자) | ... |` 에 박힌 **숫자**는 검사하지 않는다.
    - 실측: `.claude/skills/code-review-agents/README.md` 68행은 지금도 `| 소스 파일 (24 확장자) | ... |` 로 되어 있다(worktree 실물 확인 완료, `git diff` 로 main 과 대조해도 이 줄은 무변경). 반면 이번 PR 로 `router_safety.py` docstring 은 44 로 고쳐졌다. 즉 **이 PR 이 고치려던 것과 정확히 같은 종류의 drift 가 sibling 미러 문서에 지금 이 순간 실존**하는데, 새로 추가된 가드는 이를 통과시킨다(green 인 채로 stale 값이 남는다).
  - 제안: `test_table_states_the_real_extension_count` (혹은 별도 테스트)에서 README 의 `\| 소스 파일 \((\d+) 확장자\)` 행 숫자도 `len(self.values["extensions"])` 와 비교하도록 확장하고, 그 김에 README 68행의 "24" 를 "44" 로 고친다. docstring 의 "both docs" 주장을 실제 구현과 맞출 것.

- **[WARNING]** 정책 표의 9개 행 중 2개(Source-code, Reviewer roster)만 drift 가드 대상 — 나머지 7개 행(Package manifest, Doc file, Migration, OpenAPI, `spec/**/*.md`, Dockerfile, .dockerignore, .env)의 "Forced reviewers" 컬럼은 `_RULES` 상수와 실측 대조 없이 프리텍스트로 남는다
  - 위치: `.claude/tests/test_router_safety_policy_doc.py` — `PolicyMatrixMatchesConstantsTest` 클래스 전체(파일 3)
  - 상세: `router_safety.py` docstring(파일 1 게이트 34~46행)은 스스로 "본 docstring 의 표가 정책의 단일 진실 원천"이라 선언하는데, 새 테스트는 표의 9개 행 중 2개만 실제 상수(`_SOURCE_FORCED_REVIEWERS`, `ALL_AGENTS`)와 대조한다. 예를 들어 향후 `_DB_PATTERNS`(마이그레이션) 규칙에서 forced reviewer 를 `("database",)` 에서 다른 값으로 바꾸면서 표의 "Migration ... | database |" 행을 갱신하지 않아도 이 테스트는 통과한다 — 이번 발견(24 vs 44)과 같은 종류의 재발을 나머지 7행에서는 여전히 못 막는다.
  - 제안: `_RULES` 를 순회하며 각 규칙의 `reviewers` 튜플과 docstring 표의 해당 행을 매칭해 전수 대조하는 파라미터화 테스트를 추가하거나, 최소한 이번 스코프에서 의도적으로 좁혔음을 테스트 docstring 에 명시(현재는 "정책의 단일 진실 원천" 전체를 지킨다는 인상을 준다).

- **[INFO]** 사용하지 않는 import
  - 위치: `.claude/tests/test_router_safety_policy_doc.py:29` (`from pathlib import Path`)
  - 상세: 파일 내 어디에서도 `Path(...)` 를 직접 호출하지 않는다(`SKILL_DIR`/`ROUTER_SAFETY`/`README`/`ORCH` 는 모두 `_harness.REPO_ROOT`(이미 Path)의 `/` 연산 체이닝으로 만들어진다). lint 를 돌리면 F401 로 걸릴 죽은 import.
  - 제안: import 제거.

- **[INFO]** Mock 없이 실제 subprocess/실제 파일을 읽는 설계는 적절 — 단, 두 서브프로세스 호출 실패 시 진단 메시지가 stderr 마지막 1500자로 잘린다
  - 위치: `.claude/tests/test_router_safety_policy_doc.py` — `_router_safety_values`(게이트 39~56행), `_all_agents`(게이트 59~68행)
  - 상세: 이 자체는 결함이 아니라 설계 확인 차원의 메모. `router_safety` 임포트가 `_lib` 이름 충돌 때문에 in-process 로 불가능해 서브프로세스로 우회하는 것은 `test_router_decision_trust.py` 의 기존 선례와 일치하고, `code_review_orchestrator.py` 는 `__file__` 기준 절대경로로 자체 `sys.path` 를 구성하므로 `runpy.run_path` 로 실행해도 sibling import 가 깨지지 않음을 확인했다(모듈 최상단 `if __name__ == "__main__":` 가드도 확인 — `main()` 부작용 없음). Mock 을 안 쓴 선택은 실제 동작과의 괴리를 없애는 올바른 방향.

### 요약
`test_router_safety_policy_doc.py` 는 24 vs 44 실측 drift 를 잡기 위한 목적있는 회귀 테스트로, mock 없이 실제 subprocess 로 라이브 상수를 읽어 대조하는 설계 자체는 견고하다. 그러나 이 테스트는 자신의 module docstring 이 주장하는 범위(README 미러의 "count and list, both docs")를 실제로는 절반만 구현했고, 그 결과 README.md(`.claude/skills/code-review-agents/README.md:68`)에 지금도 살아있는 "24 확장자" stale 값 — 이 PR 이 고치려던 것과 완전히 동일한 결함 — 을 green 상태로 놓친다. 이 한 가지가 이 리뷰의 핵심 결함이며, 나머지(표 9행 중 2행만 커버, 미사용 import)는 스코프/스타일 수준의 부차적 지적이다.

### 위험도
CRITICAL
