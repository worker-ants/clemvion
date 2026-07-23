# 유지보수성(Maintainability) 리뷰

### 발견사항

- **[INFO]** 사용하지 않는 import (`Path`)
  - 위치: `.claude/tests/test_router_safety_policy_doc.py:29`
  - 상세: `from pathlib import Path` 를 import 하지만 파일 전체에서 `Path` 를 직접 참조하는 곳이 없다 (`SKILL_DIR`/`ROUTER_SAFETY`/`README`/`ORCH` 는 모두 `REPO_ROOT / ...` 로 구성되며, `REPO_ROOT` 는 `_harness` 모듈에서 이미 `Path` 인스턴스로 import 된다). 린터(flake8/ruff 등)가 있다면 unused-import 로 잡힐 항목이다.
  - 제안: `from pathlib import Path` 줄 제거.

- **[INFO]** 두 헬퍼 함수(`_router_safety_values`, `_all_agents`) 간 subprocess 호출 보일러플레이트 중복
  - 위치: `.claude/tests/test_router_safety_policy_doc.py:39-56` (`_router_safety_values`) 와 `:59-68` (`_all_agents`)
  - 상세: 두 함수 모두 `subprocess.run([sys.executable, "-c", script], capture_output=True, text=True, cwd=str(REPO_ROOT))` 호출 후 `returncode != 0` 이면 `AssertionError(f"... {r.stderr[-1500:]}")` 를 던지고, 아니면 `json.loads(r.stdout.strip().splitlines()[-1])` 를 반환하는 동일 패턴을 반복한다. `-1500` 스트라이드 값도 두 곳에 하드코딩되어 있다.
  - 제안: `_run_python_json(script: str, context: str) -> dict|list` 같은 공용 헬퍼로 추출하면 두 함수가 각자의 `script` 문자열 조립에만 집중할 수 있다. 다만 이 subprocess-호출-후-에러-슬라이스 패턴은 같은 스위트의 `test_router_decision_trust.py` 등 다른 테스트 파일에서도 반복되는 기존 컨벤션(예: `r.stderr[-1500:]`, `r.stderr[-2000:]`)이라 이번 PR 이 새로 만든 문제라기보다 기존 스타일을 답습한 것에 가깝다 — 즉시 수정을 요구할 사안은 아니고, 스위트 전반에 걸친 별도 리팩터링 후보로 남겨도 무방하다.

- **[INFO]** 정규식 파싱 기반 assertion 이 문서 포맷 변경에 취약
  - 위치: `.claude/tests/test_router_safety_policy_doc.py` 의 `_doc_extension_list`, `_readme_extension_list`, `test_table_states_the_real_extension_count`, `test_table_row_names_the_real_forced_reviewers`, `test_reviewer_roster_count_and_names_match_the_orchestrator`
  - 상세: docstring/README 의 정확한 텍스트 패턴(`"Source-code extensions counted by ...:\n"`, `"| Source-code file (\d+ extensions below)"`, `"소스 코드 확장자: `([^`]+)`"` 등)에 강하게 결합되어 있다. 파일 자체의 docstring 이 "이 문서가 정책 SoT" 라고 선언하고 있고, README.md 도 `.claude/tests/README.md` 의 컨벤션 절이 명시한 "문서가 곧 스펙인 경우 prose-checking 예외"에 해당하므로 의도된 트레이드오프다. 다만 향후 문서 문구를 자연스럽게 다듬으려는 편집자가 이 정규식들을 모르고 깨뜨릴 위험은 남는다.
  - 제안: 각 정규식 위에 있는 docstring/주석 수준으로 이미 의도가 잘 설명되어 있어 추가 조치는 불필요. 단, 문서 쪽 편집 시 이 테스트가 실패하면 원인(정규식 불일치 vs 진짜 드리프트)을 빠르게 구분할 수 있도록 각 `assertIsNotNone` 의 메시지가 이미 충실하다 — 유지만 하면 된다.

### 요약
이번 변경은 실제로 발견된 SSOT 드리프트(정책 표의 "24 extensions" 서술이 실제 44개 확장자 집합과 어긋났던 문제)를 재발 방지 테스트로 봉인하는 성격의 변경으로, 목적이 명확하고 각 테스트 메서드가 짧고 단일 책임을 가지며 실패 메시지도 원인을 구체적으로 설명한다. `router_safety.py`/`README.md` 변경은 docstring 표의 숫자 하나를 정정하는 1줄 수정으로 위험이 없다. 새로 추가된 `test_router_safety_policy_doc.py` 는 가독성·네이밍·함수 길이·중첩 깊이 모두 양호하며, 지적된 항목(미사용 import, 두 헬퍼 함수의 경미한 보일러플레이트 중복)은 모두 INFO 수준이고 후자는 기존 테스트 스위트의 확립된 스타일과 일치한다. 전반적으로 유지보수성 관점에서 문제 삼을 사안은 없다.

### 위험도
NONE
