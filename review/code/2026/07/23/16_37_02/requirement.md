# 요구사항(Requirement) 리뷰

## 리뷰 대상

- `.claude/tests/README.md` — "What's covered" 카탈로그에 누락 10행 등재
- `.claude/tests/test_mermaid_lint_ready.py` — `PostToolUseImportFailOpenTest` 신설(`is_ready is None` fail-open 분기 실행 기반 테스트)
- `.claude/tests/test_tests_readme_catalog.py` — 신규. README 카탈로그 ↔ 실제 파일 양방향 무결성 가드
- `plan/in-progress/harness-guard-followups.md` — W4·신규 카탈로그 항목 체크박스 완료 반영

## 검증 방법

코드를 정적으로 읽는 데 그치지 않고 실제로 실행했다: `python3 -m unittest discover -s .claude/tests -p 'test_mermaid_lint_ready.py'`(17건 전부 OK), `-p 'test_tests_readme_catalog.py'`(5건 OK), 전체 하네스 스위트(`-p 'test_*.py'`, 453건 OK). 또한 `git show HEAD~1`로 PR 이전 상태(테스트 파일 27개, README 등재 18행 = 9개 미등재)를 재현해 plan 본문의 수치 주장을 실측 대조했고, 새로 등재된 9개 파일 중 3개(`test_guard_review_before_push_main.py`, `test_push_guard_allowlist.py`, `test_lint_mermaid_exit_codes.py`)가 오늘(2026-07-23) 추가된 것임을 `git log --diff-filter=A`로 확인해 "그 주에 추가된 3개 포함" 서술과 일치함을 검증했다. `.claude/hooks/lint_mermaid_posttooluse.py`를 직접 읽어 신규 테스트가 겨냥한 `is_ready is None` 분기(41~51행 try/except, 120행 `if is_ready is None or not is_ready(tool_dir):`)의 실제 동작과 테스트 단언이 일치함을 확인했다.

## 발견사항

- **[INFO]** 관련 spec 문서 없음 (spec fidelity 해당 없음)
  - 위치: 전체 변경 (`.claude/tests/**`, `plan/in-progress/harness-guard-followups.md`)
  - 상세: 변경 영역은 `.claude/` 하네스 자체 테스트(제품 코드 아님)이며, `CLAUDE.md`의 폴더 구조 규약상 `spec/`는 `codebase/` 하위 제품 정의·기술 명세 전용이다. `spec/` 전체를 grep 했으나 이 영역(mermaid-lint 훅, 테스트 카탈로그 가드)을 규정하는 문서는 없다 — harness 규약은 `.claude/docs/`·`PROJECT.md`가 SoT이며 이번 변경은 그와도 상충하지 않는다.
  - 제안: 조치 불요. (관련 SoT는 `plan/in-progress/harness-guard-followups.md` 자신과 `.claude/tests/README.md`.)

- **[INFO]** plan frontmatter `worktree` 필드가 현재 작업 worktree와 불일치
  - 위치: `plan/in-progress/harness-guard-followups.md:2` (`worktree: harness-guard-followups-f7140c`)
  - 상세: 이 백로그 plan은 A~H 여러 독립 항목을 서로 다른 PR/worktree에서 순차 완료하는 구조이고(본문에 "이 PR"·"별건 PR" 표기가 항목마다 다름), 현재 diff는 `harness-test-coverage-006e09` worktree에서 만들어졌다. `.claude/docs/plan-lifecycle.md §3`의 push-gate 연결 판정은 frontmatter `worktree:`와 현재 worktree 디렉토리명 매칭으로 이루어지므로, 이 커밋은 push-gate상 이 plan에 "연결"되지 않는다(gate 우회 목적이 아니라 구조적으로 그렇게 됨). 기능적 결함은 아니며 plan-lifecycle 문서도 "복수 연결"·"독립 PR" 패턴을 명시적으로 허용한다.
  - 제안: 조치 불요(설계상 허용된 패턴). 다만 반복되면 이 백로그를 하위 그룹 폴더(`plan/in-progress/harness-guard-followups/`)로 승격해 각 하위 항목이 자기 worktree를 갖게 하는 편이 `plan-lifecycle.md §2` 클러스터 패턴과 더 맞을 수 있음 — 강제 아님.

- **[INFO]** 카탈로그 파서의 파일명 문자 클래스가 소문자/숫자/언더스코어로 제한
  - 위치: `.claude/tests/test_tests_readme_catalog.py:29` (`_ROW = re.compile(r"^\|\s*\`(test_[a-z0-9_]+\.py)\`\s*\|", re.M)`)
  - 상세: 현재 저장소의 모든 `test_*.py` 파일명이 snake_case라 실질적 위양성은 없음(직접 grep으로 대문자 파일명 0건 확인). 다만 미래에 대문자를 포함한 파일명이 추가되면 이 정규식이 조용히 놓쳐 `test_every_test_file_is_documented`가 그 파일을 "미등재"로 정확히 잡아내긴 하지만("누락" 목록에 뜸), 반대로 README에 그 파일명이 정확 표기돼도 매칭 실패로 "행이 있는데 파일이 없다"는 오탐이 날 수 있음. 실무상 발생 가능성 낮음.
  - 제안: 조치 불요. 필요 시 문자 클래스를 `[A-Za-z0-9_]`로 넓히는 사소한 개선 여지만 있음.

## 기능 완전성 · 엣지 케이스 · 반환값 검증 결과

- `PostToolUseImportFailOpenTest` (test_mermaid_lint_ready.py:341-441): 훅을 임시 디렉토리에 복사하고 옆의 `_lib/mermaid_lint_ready.py`를 import 시 예외를 던지도록 만든 뒤, exit 0·stderr `"skipped"`·stderr `"Traceback"`·node 미호출(0회)을 모두 단언한다. 실제 훅 소스(`lint_mermaid_posttooluse.py:40-51,120-130`)와 대조한 결과 `except Exception: traceback.print_exc(...); is_ready = None`과 `if is_ready is None or not is_ready(tool_dir):`가 정확히 이 시나리오를 구현하고 있어 테스트가 실제 코드 경로를 태운다(단순 mock이 아님). 짝 테스트(`test_working_helper_on_the_same_fixture_does_invoke_the_linter`)로 같은 fixture에서 정상 헬퍼일 때 node가 1회 호출됨을 확인해 비-vacuity를 보장 — plan 서술("비-vacuity 는 뮤턴트가 아니라 짝 테스트로")과 정확히 일치.
- `test_tests_readme_catalog.py`: 파서(`_parse_catalog`)가 텍스트를 직접 받아 sanity 테스트로 검증 가능하고, `ParserSanityTest.test_catalog_rows_are_found`로 "빈 결과 반환 시 항진명제" 케이스를 차단한다. 양방향 검사(`test_every_test_file_is_documented`/`test_no_row_names_a_missing_file`) 모두 실행 확인, 실제로 원래 9개 누락 파일을 찾아내는 로직임을 커밋 이력 대조로 검증했다.
- `.claude/tests/README.md` 10행 추가: 각 신규 행의 서술을 대상 테스트 파일 docstring과 표본 대조(`test_push_guard_allowlist.py` 등)한 결과 실제 구현과 부합.
- `plan/in-progress/harness-guard-followups.md`: 체크박스 전환(W4, 신규 카탈로그 항목)이 실제 이번 diff의 코드 변경과 1:1 대응 — "체크 후 커밋" 컨벤션 준수.

## 요약

이번 변경은 순수 테스트/문서 커버리지 보강 PR로, 두 개의 실제 실행 갭(① `is_ready is None` fail-open 분기가 읽기로만 검증되던 문제, ② README 테스트 카탈로그가 27개 중 9개 누락되던 문제)을 각각 실행 기반 테스트로 닫는다. 새 테스트 22건(mermaid_lint_ready 2건 + catalog 5건, 나머지는 기존)을 직접 실행해 전부 통과함을 확인했고, 훅 소스 코드와 대조해 테스트가 실제 코드 경로(mock이 아닌 서브프로세스 실행)를 태움을 검증했다. plan 본문의 수치 주장(27개 중 9개 미등재, 그중 3개는 같은 날 추가)도 git 이력으로 재검증해 정확함을 확인했다. TODO/FIXME/미완성 표식 없음, 반환값·에러 경로 모두 실행 기반으로 커버됨. spec 관련 문서는 이 하네스 영역에 존재하지 않아 spec fidelity 항목은 해당 없음(INFO). 발견된 항목은 전부 INFO 수준으로, 기능적 결함이나 spec 불일치는 없다.

## 위험도

NONE
