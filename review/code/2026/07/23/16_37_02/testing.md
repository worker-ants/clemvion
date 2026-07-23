### 발견사항

- **[INFO]** `test_broken_helper_fails_open_without_invoking_the_linter` 의 `"skipped"` 단언이 형제 테스트(`test_not_ready_skips_without_invoking_the_linter`)보다 덜 구체적
  - 위치: `.claude/tests/test_mermaid_lint_ready.py:418` (`PostToolUseImportFailOpenTest.test_broken_helper_fails_open_without_invoking_the_linter`)
  - 상세: `self.assertIn("skipped", r.stderr)` 는 부분 문자열만 확인한다. 반면 같은 파일의 `test_not_ready_skips_without_invoking_the_linter`(line 210)는 `assertIn("skipped (tooling deps not installed)", r.stderr)` 로 정확한 문구까지 고정한다. 실제 훅(`lint_mermaid_posttooluse.py:120-130`)은 `is_ready is None`(import 실패) 분기와 `not is_ready(tool_dir)`(미설치) 분기가 **동일한 메시지**를 출력하므로 지금은 문제가 되진 않지만, 두 분기를 구분해서 출력하도록 나중에 바뀌면 이 테스트가 "어느 분기를 탔는지"는 검증하지 못한 채 계속 통과할 수 있다. 다만 같은 테스트가 `"Traceback"` 존재까지 함께 단언하므로(이건 import-실패 분기에서만 찍힘) 실질적으로 분기 특정성은 이미 확보되어 있어 심각도는 낮다.
  - 제안: 일관성을 위해 `assertIn("skipped (tooling deps not installed)", r.stderr)` 로 형제 테스트와 동일한 구체적 문구를 쓰는 편이 낫다.

- **[INFO]** 테스트 헬퍼(`_node_calls`/`_run`/`_write_lib`/노드 스텁 setUp) 중복이 4번째 클래스로 확대
  - 위치: `.claude/tests/test_mermaid_lint_ready.py` — 신규 `PostToolUseImportFailOpenTest`(341-441행)가 `PostToolUseExecutionTest`·`PreCommitExecutionTest` 와 거의 동일한 `_node_calls`/`_run`/setUp 보일러플레이트를 또 한 번 복제
  - 상세: 이미 `plan/in-progress/harness-guard-followups.md` W3 항목("테스트 헬퍼 `_node_calls`/`_run` 도입부가 `test_mermaid_lint_ready.py` 내 중복. 순수 위생, 동작 무관")으로 추적 중인 이슈이며 이번 PR 이 새로 만든 문제는 아니다. 다만 이번 변경이 중복 인스턴스를 3개에서 4개로 늘렸다는 점은 기록해 둘 가치가 있다.
  - 제안: 새로 처리할 필요는 없음(W3 백로그가 이미 존재) — 향후 W3 해소 시 공통 베이스 `TestCase`/mixin 으로 통합 권장.

### 검증 수행 내역

- `python3 -m unittest discover -s .claude/tests -p 'test_mermaid_lint_ready.py'` → 17/17 통과 (신규 `PostToolUseImportFailOpenTest` 2건 포함).
- `python3 -m unittest discover -s .claude/tests -p 'test_tests_readme_catalog.py'` → 5/5 통과.
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` (하네스 전체 스위트) → 453/453 통과 — 이번 변경으로 인한 회귀 없음 확인.
- **비-vacuity 실측 재검증**: `lint_mermaid_posttooluse.py` 의 `if is_ready is None or not is_ready(tool_dir):` 를 `if False:`로 뮤테이트해 원복 전 실행 → `PostToolUseImportFailOpenTest.test_broken_helper_fails_open_without_invoking_the_linter` 가 정확히 실패(`'skipped' not found in 'Traceback ...'`)함을 확인, 뮤턴트를 `cp` 백업본으로 복원. 이 신규 테스트가 실제로 해당 분기를 잡는다는 PR 서술이 독립적으로 재현됨.
- **README 카탈로그 정합성 실측**: `.claude/tests/test_*.py` 실제 목록(28개)과 `README.md` "What's covered" 표의 백틱 행(28개)을 diff — 양방향 완전 일치(미등재 0, 존재하지 않는 파일 지칭 행 0). 신규 파일 `test_tests_readme_catalog.py` 자신도 표 50행에 등재되어 자기 참조 케이스가 자기 테스트를 실패시키지 않음을 확인.
- 카탈로그 신규 10개 행이 가리키는 파일이 모두 `.claude/tests/` 에 실존함을 개별 확인(`test_plan_guard.py` 등 10개 전부 OK).

### 테스트 관점 평가

1. **테스트 존재 여부**: 이번 변경 자체가 테스트 추가(코드 변경 없음, `.claude/tests/` 만 대상)이며, 두 갭 — (a) `lint_mermaid_posttooluse.py` 의 import-fail-open(`is_ready is None`) 분기 무실행 커버리지, (b) README 카탈로그 drift(27개 중 9개 미등재) — 를 정확히 겨냥해 채운다. 코드 변경이 없으므로 "테스트가 더 필요한 프로덕션 코드"는 없음.
2. **커버리지 갭**: 신규 두 테스트가 목표한 갭을 실측으로 닫았음을 뮤테이션 재현으로 확인. 남은 갭(W1/W3/W8/C/E/G/H)은 plan 자체가 명시적으로 별건/후속으로 분리해 문서화했으며 은폐가 아님.
3. **엣지 케이스**: import-time 예외(런타임 실패)와 정상 경로를 짝으로 검증하는 non-vacuity 패턴(`test_working_helper_on_the_same_fixture_does_invoke_the_linter`)이 있어 "항상 skip 되는 깨진 fixture" 오탐을 차단한다. 좋은 설계.
4. **Mock 적절성**: `node` 를 얇은 bash 스텁으로 대체하고 실제 훅 스크립트는 subprocess 로 그대로 실행 — 내부 로직을 mock 하지 않고 실제 진입점(`main()`)을 프로세스로 구동해 `assertIn("is_ready(tool_dir)", src)` 류의 텍스트-매칭 취약점(파일 docstring 이 스스로 지적)을 피한다.
5. **테스트 격리**: 매 테스트가 `tempfile.mkdtemp()` + `addCleanup`으로 격리되고 `env`도 복사본을 사용. 전체 스위트(453건) 및 단일 파일(17건) 양쪽 다 통과해 순서 의존성 없음을 확인.
6. **가독성**: 클래스/함수 docstring 이 "왜 이 테스트가 필요한가"(harness-guard-followups §A W4 참조)까지 서술하는 하우스 스타일을 일관되게 따름. 테스트명도 의도를 명확히 드러냄.
7. **회귀 테스트**: 기존 17건(`test_mermaid_lint_ready.py`) + 하네스 전체 453건 모두 그대로 통과 — 회귀 없음.
8. **테스트 용이성**: 훅이 이미 `MERMAID_LINT_TOOL_DIR` 환경변수 오버라이드와 "자기 위치 기준 `_lib` 해석"을 지원해 복사 기반 격리 테스트가 자연스럽게 가능한 구조 — 별도 리팩터 없이 테스트 가능.

### 요약

`.claude/tests/test_mermaid_lint_ready.py` 의 `PostToolUseImportFailOpenTest`(import-fail-open 분기 실행 기반 회귀, non-vacuity 짝 테스트 포함)와 신규 `test_tests_readme_catalog.py`(README "What's covered" 카탈로그 양방향 drift 가드) 모두 목표한 커버리지 갭을 정확히 메우며, 실제 뮤테이션 재현과 전체 스위트 재실행(453/453)으로 회귀 없음·비-vacuity를 직접 재검증했다. `README.md` 의 10개 신규 행도 실제 파일 존재·카탈로그 완전 일치를 확인했다. 발견된 사항은 assertion 구체성 미세 개선 여지 1건과 이미 추적 중인(W3) 테스트 헬퍼 중복 확대 1건뿐이며 둘 다 차단 사유가 아니다.

### 위험도
NONE
