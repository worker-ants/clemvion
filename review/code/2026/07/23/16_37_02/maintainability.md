# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 실행 기반 테스트 픽스처 보일러플레이트(`bin`/`node` 스텁 생성 + `_node_calls()` 카운터)가 같은 파일 내 세 번째 클래스에 그대로 복제됨
  - 위치: `.claude/tests/test_mermaid_lint_ready.py` 신규 클래스 `PostToolUseImportFailOpenTest` (게이트 341-441, 특히 `setUp` 375-380·`_node_calls` 404-408)
  - 상세: 동일한 패턴(`self.bin = os.path.join(...)` → `node` stub 작성 → `os.chmod(..., 0o755)` → `_node_calls()` 로그 라인 카운트)이 이미 `PostToolUseExecutionTest`(게이트 173-190)와 `PreCommitExecutionTest`(게이트 275-300)에 존재한다. 실측: `grep -n "_node_calls\|node_stub = os.path.join"` 결과 동일 블록이 3곳에 등장. 이 diff 는 그 개수를 2 → 3 으로 늘린다. 로그 포맷이나 스텁 프로토콜이 바뀌면 세 곳을 동시에 고쳐야 하고, 하나라도 놓치면 조용히 어긋난 assertion 이 남을 수 있다.
  - 참고: 이미 `plan/in-progress/harness-guard-followups.md` 의 W3 항목("테스트 헬퍼 `_node_calls`/`_run` 도입부가 `test_mermaid_lint_ready.py` 내 중복. 순수 위생, 동작 무관.")으로 팀이 인지·추적 중이며 저우선으로 의도적 defer 상태다. 새 발견이 아니라 기존에 문서화된 부채가 이 diff 로 한 겹 더 쌓인 것 — 그래서 INFO 로 유지한다.
  - 제안: 지금 당장 처리할 필요는 없다(W3 로 이미 추적됨). 다음에 이 파일을 만질 일이 있으면 공통 `_node_calls`/스텁-설치 로직을 `mixin` 클래스나 모듈 레벨 헬퍼로 뽑아 3-way 동기화 리스크를 없애는 편이 좋다.

- **[INFO]** 신규 클래스의 `setUp`/도크스트링이 인접 클래스(`PostToolUseExecutionTest`)와 목적·구조가 유사해 파일 내 응집도는 좋으나, 클래스가 5개로 늘며 파일이 길어짐
  - 위치: `.claude/tests/test_mermaid_lint_ready.py` 전체(현재 444줄)
  - 상세: 기능적 결함은 아니며, 클래스별 책임(“무엇을 실행 기반으로 검증하는가”)이 명확히 분리되어 있어 가독성 자체는 유지된다. 다만 앞선 INFO 항목의 보일러플레이트 중복과 맞물려 파일이 계속 커지는 방향이라는 점만 기록.
  - 제안: 없음(추가 조치 불요, 참고용).

## 그 외 검토 결과 (문제 없음)

- `.claude/tests/test_tests_readme_catalog.py` (신규): 함수 분리가 명확(`_parse_catalog`/`_catalog`/`_actual_test_files`), 정규식·역할이 모듈 상단 주석·docstring 으로 잘 설명됨. "빈 파싱 결과 → 항진명제" 위험을 `ParserSanityTest` 로 스스로 방어하는 점이 이 리포지토리의 기존 컨벤션(`test_dependabot_npm_coverage.py` 류 손수-파서 가드)과 일관됨. 네이밍·중첩·복잡도 모두 낮고 깨끗함.
- `.claude/tests/README.md`: 표 포맷·톤이 기존 행들과 일관되게 10행 추가됨. 문제 없음.
- `plan/in-progress/harness-guard-followups.md`: 체크박스 갱신 + 완료 근거 서술. 같은 W-번호가 여러 리뷰 라운드에 걸쳐 재사용되지만(`W1`, `W3`, `W4` 등), 각기 다른 라운드 타임스탬프로 구분되어 있어 이 저장소의 기존 관례이며 신규 중복 문제는 아님.

## 요약

이번 변경은 전부 하네스 자체 테스트/문서(README 카탈로그, 신규 회귀 테스트, plan 갱신)이며 상용 코드(`codebase/`)에는 손대지 않는다. 신규 `test_tests_readme_catalog.py`는 네이밍·구조·자기검증(파서 vacuity 가드)이 모두 이 저장소의 기존 손수-파서 테스트 컨벤션을 잘 따르고 있어 가독성·복잡도 측면에서 흠잡을 곳이 없다. 유일하게 짚을 점은 `test_mermaid_lint_ready.py`에 추가된 `PostToolUseImportFailOpenTest`가 기존 두 클래스와 거의 동일한 subprocess 픽스처 보일러플레이트(`node` 스텁 생성, `_node_calls` 카운터)를 세 번째로 복제한다는 것인데, 이는 이미 plan 의 W3 항목으로 팀이 인지하고 "순수 위생, 저우선"으로 명시적으로 defer 한 부채라 이번 diff 를 막을 사유는 아니다. 전체적으로 유지보수성 리스크는 낮다.

## 위험도

LOW
