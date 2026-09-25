# 유지보수성(Maintainability) 코드 리뷰

## 개요

이번 변경은 `.claude/tests/**` 하네스 전용(프로덕션 `codebase/**` 미변경)으로, 병렬 pytest 실행이
실제 저장소 트리(`spec/5-system/7-llm-client.md`, `plan/in-progress/`)에 프로브를 남기던 문제를
`_harness.make_temp_repo_copy` 신설 + 4개 테스트 파일의 격리 방식 전환으로 고친다. 이전 리뷰 라운드
(`review/code/2026/09/25/10_27_27`)에서 지적된 Warning 2건(0-subtree 시 `CalledProcessError`,
5곳 완전 동일 보일러플레이트)은 이 세션이 검토하는 diff 시점에 이미 커밋 `89ae9fa24`로 해소되어
있음을 코드에서 직접 확인했다.

## 발견사항

- **[INFO]** 프로브 대상 spec 파일 경로 문자열 `"spec/5-system/7-llm-client.md"` 이 모듈 상수로
  뽑히지 않고 세 곳에 리터럴로 반복된다.
  - 위치: `.claude/tests/test_consistency_bundle_priority.py` — `TheDocumentBeingEditedIsNeverOmittedTest._rank_of_an_uncommitted_edit`(652번째 줄 부근, `rel = "spec/5-system/7-llm-client.md"`), 같은 클래스의 `test_collect_context_puts_the_edited_document_first`(689번째 줄 부근), 그리고 이번 diff 로 새로 추가된 `TheRepoCopyFixtureTest.test_a_commit_in_the_copy_is_in_the_branch_diff`(779번째 줄 부근)
  - 상세: 앞 두 곳은 이 diff 이전부터 있던 패턴이라 이번 PR 이 만든 중복은 아니지만, 이번 PR 이 세 번째 사용처를 새로 추가하면서 중복을 늘렸다. 파일 경로가 바뀌면(예: `7-llm-client.md` 개명) 세 곳을 모두 손대야 한다.
  - 제안: `test_consistency_bundle_priority.py` 모듈 상단에 `PROBE_TARGET_REL = "spec/5-system/7-llm-client.md"` 같은 상수를 두고 세 스니펫이 f-string 으로 주입받게 하면 drift 위험이 줄어든다. 우선순위는 낮음 — 문자열이 그대로 노출돼 있어 수동 검색으로도 놓치기 어렵다.

- **[INFO]** 리팩터링이 `try/finally` + `shutil.copy` 원복 패턴을 `with tempfile.TemporaryDirectory()` 컨텍스트 매니저로 교체하면서 가독성이 오히려 개선됐다(부수적으로 확인한 긍정적 변화, 조치 불요). 원복 누락 가능성 자체가 사라졌고, 각 테스트의 "무엇을 준비하고 무엇을 재는가"가 한 블록 안에 선형으로 읽힌다.
  - 위치: `.claude/tests/test_consistency_bundle_priority.py` — `TheDocumentBeingEditedIsNeverOmittedTest`, `TheDiffOutranksTheFolderDumpTest` 내 여러 메서드
  - 상세/제안: 없음(참고용 긍정 기록).

## 확인한 항목 (문제 없음)

- **중복 제거**: 이전 라운드 Warning 2(다섯 스니펫에 걸친 `make_temp_repo_copy(os.path.join(tmp, "repo"), "spec/5-system")` 3줄 완전 중복)는 `_PREAMBLE` 생성 시 `orchestrator_preamble(..., extra=...)` 로 `five_system_copy(tmp)` 헬퍼 함수 하나로 통합되어 해소됨을 `test_consistency_bundle_priority.py:44-57` 에서 직접 확인했다. 다섯 호출부 모두 `root = five_system_copy(tmp)` 한 줄로 줄었다.
- **네이밍**: `make_temp_repo_copy` 가 `make_temp_git_repo` 를 내부에서 호출·확장하는 상위집합 관계이며, docstring 첫 줄(`` `make_temp_git_repo` + this checkout's ``subtrees`` committed ``)이 그 관계를 명시한다. 기존 `make_probe_repo` 안이 겪었을 `_shared/git_probe.py` 와의 중의성도 개명으로 제거됐다(이전 라운드 W2 반영 확인).
- **일관성**: `_harness.py` 는 기존부터 함수 본문 내 지역 `import`(예: `git_in` 의 `import os`) 관행을 쓰고 있고, 신설 `make_temp_repo_copy` 의 `import shutil` 도 같은 관행을 따른다 — 새로운 스타일 이탈이 아니다. `test_router_decision_trust.py`(영문 주석/docstring)와 `test_consistency_bundle_priority.py`(한글 주석/docstring)는 각 파일의 기존 언어 관행을 그대로 유지하며 섞이지 않았다.
- **함수 길이/책임**: `make_temp_repo_copy`(약 20줄, docstring 제외 실제 로직 6줄), `orchestrator_preamble`, `run_in_orchestrator` 모두 단일 책임을 유지하고 과도하게 길지 않다.
- **중첩 깊이**: 신규/수정 테스트 스니펫은 `with tempfile.TemporaryDirectory()` → (필요 시) `with open(...)` 정도의 2단 중첩에 그치며, 조건 분기 중첩은 늘지 않았다.
- **매직 넘버**: 이번 diff 자체가 새로 도입한 매직 넘버는 없다(`n = 23` 등은 기존 코드에서 캡 20 을 넘기는 근거가 주석으로 설명된 채 그대로 유지).
- **호출부 파급 확인**: `test_router_decision_trust.py::RouterPromptStatesCompositionTest._prepare_over` 에 `cwd=REPO_ROOT` 기본값을 추가하면서, 이 헬퍼를 쓰는 나머지 3개 호출부(`test_mixed_changeset_is_declared_not_doc_only`, `test_doc_only_changeset_is_declared_as_such` 등)는 인자를 그대로 두어도 동작이 바뀌지 않음을 `grep` 으로 전수 확인했다 — 시그니처 확장이 하위 호환을 유지한다.
- **문서 동기화**: `.claude/tests/README.md`, `CHANGELOG.md`, `plan/in-progress/harness-probe-isolation.md`, `plan/in-progress/harness-review-gate-followups.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 서술이 서로 참조하는 실측 수치(잔여 5/6→0/6, 실패 22/24→0/24, census 97→0)가 모든 문서에서 일치한다.

## 검증 방법

저장소 트리에는 어떤 뮤테이션도 가하지 않았다(`git status --short` 로 세션 시작·종료 시 확인, 리뷰 세션 산출물 디렉터리 외 변경 없음). `Read`/`grep` 으로 `.claude/tests/_harness.py`, `test_consistency_bundle_priority.py`, `test_consistency_spec_draft_snapshot.py`, `test_consistency_target_validation.py`, `test_router_decision_trust.py` 를 직접 열어 diff 게이트 번호와 실제 소스 줄을 대조했다.

## 요약

이번 변경은 유지보수성 관점에서 우수한 편이다. 실측 근거를 곁들인 docstring, 명확한 함수 분리, 이전 리뷰 라운드에서 지적된 중복·엣지케이스 미비를 정확히 해소한 후속 커밋(`89ae9fa24`)까지 포함되어 있다. 남은 지적은 `"spec/5-system/7-llm-client.md"` 문자열 리터럴이 세 곳(그중 하나는 이번 PR 신설)에 반복되는 INFO 수준 중복 하나뿐이며, 병합을 막을 이유가 아니다.

## 위험도
LOW
