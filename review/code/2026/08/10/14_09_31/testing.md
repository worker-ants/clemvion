# 테스트(Testing) 리뷰

## 조사 방법

프롬프트가 파일 4/5/6(`code_review_orchestrator.py`, `.claude/tests/README.md`,
`test_review_prepare_single_session.py`)의 diff 를 크기 제한으로 생략했으므로,
`git diff origin/main...HEAD -- <해당 파일>` 로 실제 diff 를 직접 열람했다. 신규 테스트
17건을 `python3 -m unittest test_review_prepare_single_session` 로 직접 실행해 전부
통과함을 확인했고(`Ran 17 tests ... OK`), 기존 회귀 테스트(`test_review_changeset_warning`
21건, `test_tests_readme_catalog` 5건)도 이번 diff 이후 여전히 통과함을 실행으로 확인했다.
`test_review_session_dir_collision.py` 는 `session.create_session_dir` 를 직접 호출하는
구조라 이번 배치-분할 제거와 독립적임을 코드로 확인했다(회귀 걱정 없음).

파일 코드 뮤테이션 5종(분할 복원 / 경계 `>`→`>=` / `compute_forced_agents` 무력화 /
호출부 절단 / 소스 필터 제거)을 실제로 주입해 재현하려 했으나, 공유 워크트리에서 하네스
소스 파일(`code_review_orchestrator.py`)을 직접 편집하는 Bash 명령이 classifier 에
차단되어(리뷰어 권한 밖 write 시도로 판단된 듯) 실측 재현은 하지 못했다. 대신 각 테스트가
실제로 겨냥하는 분기를 소스 코드와 대조하는 정적 추적으로 5종 전부가 유효한 단언과 연결됨을
확인했고, 그 과정에서 뮤테이션 5종이 **겨냥하지 않은** 별도의 호출부 하나를 찾았다(아래
CRITICAL 항목).

## 발견사항

- **[WARNING]** `main()` → `_warn_large_changeset` 호출부가 어떤 테스트로도 보호되지 않는다 — 그 줄을 지워도 17건이 전부 그대로 통과한다
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1675` (`_warn_large_changeset(change_infos, config["batch_size"])`)
  - 상세: `LargeChangesetIsAnnouncedTest` 는 `orch._warn_large_changeset(...)` 를 **직접** 호출해 그 함수 자체의 동작(임계값 초과 시 stderr 안내, 이하일 때 침묵)을 정확히 검증한다. 반면 `PrepareEmitsExactlyOneSessionTest._stdout_lines`(`.claude/tests/test_review_prepare_single_session.py:66`)는 `main()` 을 실제로 실행하면서 `contextlib.redirect_stderr(io.StringIO())` 로 stderr 를 **완전히 버린다** — 반환값에도 stderr 내용이 없다. 즉 `main()` 안에서 `_warn_large_changeset` 를 부르는 그 호출 자체를 검증하는 테스트가 없다. `grep -rn "_warn_large_changeset"` 결과 정의(1146행)·docstring 인용(14행)·호출(1675행)·그 함수를 직접 부르는 테스트(test 파일 124행) 넷뿐이고, `main()` 경유로 그 부작용(stderr 안내)을 관측하는 테스트는 존재하지 않는다. 이 저장소가 최근 plan 문서에서 "헬퍼는 맞는데 아무도 안 부른다" 로 세 번 데였다고 스스로 기록한 바로 그 실패 형태이며(§router fail-closed 방어 항목이 "호출부 절단" 을 별도 뮤테이션으로 명시적으로 취급한 이유이기도 하다), 정작 같은 커밋의 `_warn_large_changeset` 자체는 그 보호를 받지 못했다. `main()` 에서 이 줄을 지워도 대형 changeset 안내(stderr, 이 diff 의 핵심 UX 변경 중 하나)가 조용히 사라지며 어떤 테스트도 RED 로 반응하지 않는다.
  - 제안: `PrepareEmitsExactlyOneSessionTest` 의 `_stdout_lines` 가 stderr 도 함께 캡처해 반환하도록 하고(`emit({"stdout": ..., "stderr": buf_err.getvalue(), "batch_sizes": seen})`), `n_files > batch_size` 케이스에서 `"LARGE CHANGESET"` 같은 마커가 stderr 에 실제로 나타나는지 최소 1건 단언을 추가한다. `LargeChangesetIsAnnouncedTest` 는 그대로 두되(함수 자체의 세부 동작을 격리해서 보는 것은 유효), `main()` 경유 호출은 별도로 1건 고정해야 이번 5종 뮤테이션 세트가 놓친 "호출부 절단(같은 파일, 다른 지점)" 을 겨냥할 수 있다.

- **[INFO]** `_source_files_missing_from_changeset` 결과가 20개를 넘을 때의 절단(`… 외 N개`) 표시가 테스트되지 않는다
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:936-937` (`shown = ...unseen[:20]`, `more = f"... 외 {len(unseen) - 20}개" if len(unseen) > 20 else ""`)
  - 상세: `DocsOnlyFramingIsCrossCheckedTest.test_the_router_prompt_refuses_the_docs_only_framing`(`.claude/tests/test_review_prepare_single_session.py` 내 `DocsOnlyFramingIsCrossCheckedTest`)는 누락 소스 파일이 1개인 케이스만 검증한다. `src_paths`(919-921행)의 동일한 20개 절단 로직도 마찬가지로 미검증이다. 로직이 단순한 슬라이스+삼항식이라 위험도는 낮지만, 이 diff 가 이미 "코드는 보이는데 아무도 안 부른다" 류 실패를 경계하는 맥락이라 언급해 둔다.
  - 제안: 21개 이상의 `unseen`/`src_paths` 로 한 건씩 추가하면 그 분기도 뮤테이션 커버리지 안으로 들어온다. 급하지 않음.

## Mock 적절성 / 테스트 격리 / 뮤테이션 겨냥성 평가

`_harness.run_in_orchestrator` 가 매 테스트를 fresh subprocess 인터프리터로 띄우는 구조는
`_lib` 이름 충돌(hooks vs skills)을 피하면서도 전역 상태 오염이 테스트 간에 전파되지 않게
막는다 — 실제로 `ForcedSetShrinksWithTheChangesetTest` 의 docstring 이 이 함정에 처음
걸렸다가 in-process import 를 fresh-interpreter 경로로 옮겨 고친 이력을 남겨 두었는데,
이는 vacuous 위험을 스스로 문서화·차단한 좋은 사례다. `PrepareEmitsExactlyOneSessionTest`
가 `orch.prepare_session` 을 페이크로 완전히 치환한 것은 이 파일이 검증하려는 계약
("`main()` 이 changeset 을 쪼개지 않고 한 번만 호출한다")에 정확히 맞는 최소 mock 이고,
실제 `prepare_session` 의 파일시스템 부작용을 이 테스트가 검증할 필요가 없으므로 과잉
mock 이 아니다.

경계값 테스트(`test_at_or_below_the_threshold_is_silent` 가 `n==batch_size` 케이스를
명시적으로 포함)와 뮤턴트-판별성 자가 점검(`test_the_fixture_actually_discriminates` 가
"소스 파일이 실제로 6개 reviewer 를 강제하는지"를 먼저 확인해 `ForcedSetShrinksWithTheChangesetTest`
의 주 단언이 우연히 통과하는 vacuous 케이스를 차단)은 이 저장소가 과거 여러 차례 겪은
"분기를 못 가르는 fixture" 문제를 정확히 인지하고 설계된 흔적이다. `_source_files_missing_from_changeset`
의 "소스 필터 제거" 뮤테이션도 `test_docs_only_branch_reports_nothing`(changeset=["spec/a.md"],
branch_files=["spec/a.md","spec/c.md"] → 기대값 `[]`) 로 실제 겨냥됨을 코드로 추적
확인했다 — 필터를 제거하면 `spec/c.md` 가 결과에 남아 단언이 깨진다.

유일한 실질 갭은 위 WARNING 한 건(`main()` 자체가 `_warn_large_changeset` 를 부른다는
배선)과 INFO 한 건(20개 절단 분기)이며, 둘 다 로직 자체보다 **그 로직이 실제로 실행 경로에
연결돼 있는지**를 재확인하는 성격이다.

## 회귀 테스트

`test_review_changeset_warning.py`(21건) · `test_review_session_dir_collision.py` ·
`test_tests_readme_catalog.py`(5건) 를 이번 diff 반영 상태에서 실행해 전부 통과를
확인했다. `.claude/tests/README.md` 에 신규 파일이 카탈로그 항목으로 추가되어 있어
`test_every_test_file_is_documented` 가요구하는 동기화도 지켜졌다.

## 요약

신규 `test_review_prepare_single_session.py` 17건은 배치 분할 제거·대형 changeset 안내·
forced-reviewer 집합 증폭·router "문서 전용" 오판 교차검사 네 가지 관심사를 각각 fresh
인터프리터로 격리해 검증하며, 경계값·vacuous 방지·필터 제거 뮤테이션까지 실제로 겨냥하는
견고한 스위트다. 다만 같은 diff 가 도입한 `_warn_large_changeset` 를 `main()` 이 실제로
호출한다는 배선 자체는 어떤 테스트도 보호하지 않는다 — 그 함수를 직접 겨냥하는 단위
테스트(`LargeChangesetIsAnnouncedTest`)와, `main()` 을 구동하지만 stderr 를 통째로 버리는
통합 테스트(`PrepareEmitsExactlyOneSessionTest`) 사이에 정확히 하나의 호출부가 비어
있다. 이 저장소가 반복적으로 겪은 "헬퍼는 맞는데 호출부가 없다" 실패 형태와 같은 모양이라
WARNING 으로 표시했다. 나머지는 20개 초과 절단 분기 미검증(INFO) 정도이며, 기존 회귀
스위트는 변경 후에도 전부 유효하다.

## 위험도

MEDIUM
