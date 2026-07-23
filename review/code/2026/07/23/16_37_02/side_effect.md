# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** stderr 문자열("Traceback", "skipped")에 대한 하드 커플링
  - 위치: `.claude/tests/test_mermaid_lint_ready.py` — `PostToolUseImportFailOpenTest.test_broken_helper_fails_open_without_invoking_the_linter` (게이트 410-427)
  - 상세: `assertIn("skipped", r.stderr)` / `assertIn("Traceback", r.stderr)` 는 `lint_mermaid_posttooluse.py` 의 `except Exception: traceback.print_exc(...)` + 이후 skip 메시지 문구를 그대로 가정한다. 이 자체는 회귀 가드로서 의도된 것(README convention 이 "동작을 바꾸는 문구는 pin 한다"고 명시)이며, 실 프로덕션 코드(`lint_mermaid_posttooluse.py`)는 이번 diff 에서 변경되지 않았다. 다만 향후 그 훅의 stderr 문구가 리팩터링되면 이 테스트가 (의도대로) 깨진다는 점은 부작용이라기보다 이 방식이 감수하는 결합이다.
  - 제안: 별도 조치 불필요 — 저장소 관례(behavioral pinning)와 일치. 참고용 INFO.

- **[INFO]** 새 가드가 도입하는 "암묵적 계약" — README 카탈로그 동기화 강제
  - 위치: `.claude/tests/test_tests_readme_catalog.py` 전체(`CatalogCoverageTest.test_every_test_file_is_documented` / `test_no_row_names_a_missing_file`, 게이트 71-86)
  - 상세: 이 테스트는 향후 `.claude/tests/test_*.py` 를 추가/삭제/개명하는 모든 PR 에 대해 `README.md` "What's covered" 표 갱신을 사실상 필수로 만든다. 이는 기능이 의도한 인터페이스 변경(새 CI 실패 조건 추가)이며 버그가 아니다 — 다만 "부작용" 관점에서 명시: 이 diff 는 harness 테스트 스위트의 통과 조건을 확장하므로, 표 갱신 없이 새 테스트 파일만 추가하는 기존/향후 PR 이 이 테스트로 인해 새로 실패할 수 있다.
  - 제안: 의도된 동작이므로 조치 불필요. 팀이 인지하고 있으면 충분.

## 점검 관점별 확인 결과

1. **의도치 않은 상태 변경**: 없음. 신규/변경 코드는 전부 `.claude/tests/` 하위 테스트와 `README.md`/plan 문서(둘 다 비-코드)뿐이며, 프로덕션 코드(`lint_mermaid_posttooluse.py`, `mermaid_lint_ready.py`, `.githooks/pre-commit`)는 이 diff 에서 변경되지 않았다(grep 으로 확인: diff 대상 4파일 중 프로덕션 코드 파일 없음).
2. **전역 변수**: 신규 모듈 스코프 상수(`test_tests_readme_catalog.py` 의 `TESTS_DIR`/`README`/`_ROW`, `test_mermaid_lint_ready.py` 의 `PostToolUseImportFailOpenTest._BROKEN_LIB`)는 테스트 전용이며 클래스 속성/모듈 상수로 격리되어 있어 프로세스 전역 상태를 오염시키지 않는다. `_harness` 의 `sys.path.insert`/`sys.modules[name]=module` 부작용은 이 diff 이전부터 존재하던 하네스 관례이며 이번 변경으로 신규 도입되지 않았다.
3. **파일시스템 부작용**: `PostToolUseImportFailOpenTest` 는 매 테스트마다 `tempfile.mkdtemp()` 로 격리된 디렉터리를 만들고 `self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)` 로 확실히 정리한다(단언 실패·예외 시에도 addCleanup 은 실행됨). 실 프로덕션 파일(`POSTTOOLUSE_SRC`, `_harness.HOOKS_DIR / "_lib" / "mermaid_lint_ready.py"`)은 오직 `shutil.copy(src, tmp_dst)` 의 **소스**로만 읽히고, 쓰기 대상은 항상 tmp 경로다 — 원본을 변형하는 코드 경로 없음을 직접 확인했다. `test_tests_readme_catalog.py` 는 `README.read_text()` 만 호출하는 순수 read-only 테스트로, 쓰기 없음.
4. **시그니처 변경**: 없음. 기존 함수/클래스 시그니처 변경 없이 새 테스트 클래스(`PostToolUseImportFailOpenTest`)와 새 테스트 파일만 추가됐다. `grep -c "class PostToolUseImportFailOpenTest"` 로 실제 파일에 중복 정의가 없음을 확인(리뷰 페이로드 상 diff 블록과 전체 파일 컨텍스트 블록에 같은 코드가 두 번 노출된 것은 표기 방식일 뿐, 실제 소스에는 1회만 존재).
5. **인터페이스 변경**: 공개 API 변경 없음. 테스트 스위트의 "통과 조건"이 넓어지는 것은 위 INFO 항목에 기재.
6. **환경 변수**: `env = dict(os.environ)` 로 사본을 만든 뒤 `PATH`/`MERMAID_LINT_TOOL_DIR`/`NODE_CALL_LOG`/`NODE_EXIT_CODE` 를 그 사본에만 설정해 `subprocess.run(..., env=env)` 로 전달한다. `os.environ` 자체를 직접 mutate 하는 코드는 없어 테스트 프로세스나 이후 테스트에 환경변수가 누출되지 않는다.
7. **네트워크 호출**: 없음. `node` 는 실행 파일이 아니라 `_NODE_STUB`(bash 로 파일에 한 줄 append 하고 exit code 만 반환) 로 완전히 대체되며, 주석에도 "Never touches the network or a real mermaid install" 로 명시. `subprocess.run` 대상은 모두 로컬 `sys.executable`/`bash`/스텁 `node` 뿐이다.
8. **이벤트/콜백**: 해당 없음 — 이 diff 범위에 이벤트 발행/콜백 로직 변경 없음.

### plan 문서(`plan/in-progress/harness-guard-followups.md`) 변경

체크박스 `[ ]→[x]` 전환과 완료 서술 추가뿐으로, 코드나 설정에 영향 없음. 새로 추가된 두 테스트 파일(W4, README 카탈로그 가드)의 실제 구현과 서술이 일치해 "체크박스=실제 상태" 원칙에 부합한다.

## 요약

이번 diff 는 harness 자기-테스트 3개 파일(README 표 갱신 1건, 기존 테스트 파일에 신규 테스트 클래스 1개 추가, 신규 테스트 파일 1개)과 plan 문서 갱신으로 구성되며, 프로덕션 코드는 전혀 건드리지 않는다. 신규 테스트는 전부 `tempfile.mkdtemp()` + `addCleanup(shutil.rmtree)` 로 격리되고, 프로덕션 훅 파일·SoT 모듈은 항상 복사의 **소스**로만 읽히며 쓰기는 tmp 경로에만 발생한다. 환경변수는 `os.environ` 사본에만 설정해 subprocess 로 전달되고, 네트워크 호출 없이 로컬 스텁(`node`)만 사용한다. 시그니처·공개 인터페이스 변경도 없다. 유일하게 언급할 만한 것은 새 가드가 앞으로 "README 카탈로그 동기화"와 "훅 stderr 문구"에 대한 회귀 결합을 추가한다는 점인데, 이는 저장소가 이미 채택한 관례(behavioral pinning)에 부합하는 **의도된** 동작 확장이지 부작용이 아니다.

## 위험도

NONE
