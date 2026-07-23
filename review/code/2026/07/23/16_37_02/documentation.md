# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `PostToolUseImportFailOpenTest`가 `PostToolUseExecutionTest`의 `setUp`/`_node_calls`/노드 스텁 작성 로직을 거의 그대로 재복제
  - 위치: `.claude/tests/test_mermaid_lint_ready.py` 341-386행 (신규 `PostToolUseImportFailOpenTest` 클래스)
  - 상세: 새 클래스가 `self.tool_dir`/`_NODE_STUB` 작성/`self.node_call_log`/`self.md_file` 준비 등 기존 `PostToolUseExecutionTest`(150행대)의 보일러플레이트를 사실상 복사했다. 다만 이는 새로 발견된 결함이 아니라 같은 커밋이 수정한 `plan/in-progress/harness-guard-followups.md`(91-92행, `W3` 항목)에 "테스트 헬퍼 `_node_calls`/`_run` 도입부가 `test_mermaid_lint_ready.py` 내 중복 — 순수 위생, 동작 무관"으로 이미 명시적으로 추적·defer 되어 있다.
  - 제안: 조치 불필요(이미 문서화된 known/deferred 항목). 후속 W3 처리 시 이 클래스도 함께 정리 대상에 포함되는지만 확인.

## 요약

이번 변경은 순수하게 문서·테스트 커버리지 정합성을 높이는 diff다. (1) `.claude/tests/README.md`에 기존에 존재했으나 카탈로그에 누락돼 있던 9개 테스트 파일 행과, 이 diff가 신설한 `test_tests_readme_catalog.py` 행 1개를 합쳐 총 10행을 백필했다 — 실제로 `.claude/tests/test_*.py` 28개 파일과 README 테이블에 등재된 28개 항목이 정확히 1:1로 일치함을 직접 확인했고(`git ls` vs README 파싱 결과 동일), 신설 가드 테스트(`test_tests_readme_catalog.py`)와 `test_mermaid_lint_ready.py`의 신규 `PostToolUseImportFailOpenTest`도 로컬에서 전부 통과함을 재현 확인했다. (2) 신규 파일 `test_tests_readme_catalog.py`는 모듈·클래스 단위 독스트링에 "왜 이 가드가 필요한가"(카탈로그 drift가 9/27까지 침묵 누적됐던 경위), "왜 파서가 텍스트를 주입받는 형태인가"(sanity 테스트로 항진명제 방지)까지 근거를 정확히 남겼다. (3) `test_mermaid_lint_ready.py`의 신규 `PostToolUseImportFailOpenTest`도 클래스 독스트링에 재현 대상 분기(`is_ready is None` fail-open 경로)와 재현 방법(깨진 `_lib` 카피)을 정확히 설명하며, 비-vacuity를 뮤턴트가 아니라 짝 테스트(정상 헬퍼 버전)로 확보한다는 근거까지 남겨 실제 코드 동작과 어긋남이 없다. (4) `plan/in-progress/harness-guard-followups.md`는 완료된 W4·신규 카탈로그 항목을 체크(`[x]`)하며 근거를 상세히 기록했고, 그 서술(9/27 미등재, 10행 등재, 짝 테스트로 비-vacuity 확보 등)은 실제 diff·테스트 결과와 모두 부합한다. 이 변경은 harness 내부 도구용 테스트일 뿐 제품 코드 변경이 아니므로 `CHANGELOG.md`(spec 연동 제품 변경 전용, 과거 이력상 harness-only 커밋은 미기재) 갱신도 불필요하다. 새 환경변수·설정·API 표면 변경도 없다. 유일하게 언급할 사항은 이미 자체적으로 W3 항목으로 추적된 헬퍼 코드 중복이며 이는 CRITICAL/WARNING급이 아니다.

## 위험도
NONE
