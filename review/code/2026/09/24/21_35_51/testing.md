# 테스트(Testing) 리뷰

## 검증 절차

`.claude/tests/test_spec_link_checks_scope.py` (신규 회귀 테스트)를 중심으로, 관련 워크플로
(`.github/workflows/spec-link-checks.yml`)와 이 파일이 재사용하는 파서(`test_harness_checks_paths_coverage.py::parse_pathspecs_block`)를 직접 열어 확인했다. 저장소 트리를 건드리지 않기 위해
`.github/workflows/spec-link-checks.yml` 을 scratch 디렉터리(`mktemp` 대체로 세션 scratchpad)에 `cp` 해
독립적으로 두 뮤턴트를 만들고(① `plan/**` pathspec 라인 제거, ② docs-guard 실행 스텝을 단일
`spec-link-integrity.test.ts` 실행으로 되돌림), RESOLUTION.md/README.md가 주장하는 "RED" 를 직접
재현했다 — 저장소 파일은 전혀 수정하지 않았다(`git status --short` 로 확인, 세션 시작 시점과 동일).

- 뮤턴트 ① (`plan/**` 제거) → `parse_pathspecs_block` 결과에서 `plan/**` 소실 확인 → `test_pathspecs_trigger_on_plan_and_spec` 의 `plan` subTest 가 실패할 조건과 정확히 일치
- 뮤턴트 ② (단일 파일 실행으로 복귀) → `_docs_guard_run_commands` 로직 재현 결과 `runs[0]` 에 `.test.ts` 포함 → `test_runs_the_docs_guard_directory_not_one_file` 의 `assertNotIn(".test.ts", ...)` 실패 조건과 정확히 일치
- 대조군(원본 워크플로) → 두 조건 모두 통과

또한 `python3 -m pytest .claude/tests/test_spec_link_checks_scope.py .claude/tests/test_tests_readme_catalog.py .claude/tests/test_workflow_yaml_structure.py .claude/tests/test_required_check_skip_jobs.py .claude/tests/test_workflow_run_inputs_covered.py .claude/tests/test_harness_checks_paths_coverage.py .claude/tests/test_doc_sync_matrix.py -q` 를 직접 실행해 전부 통과함을 확인했고(73 passed, 789 subtests passed 합산), `spec-link-checks.yml` 이 `test_required_check_skip_jobs.py` 의 워크플로 등록 목록(`_WORKFLOWS`, 61행)에 이미 포함돼 새 "docs guards" 스텝의 `if:` 게이팅도 일반 규칙으로 커버됨을 확인했다.

## 발견사항

- **[INFO]** `_docs_guard_run_commands` 의 스텝 선택 기준이 `"--filter frontend test" in s["run"]` 부분 문자열 매칭이다.
  - 위치: `.claude/tests/test_spec_link_checks_scope.py:44-52` (`_docs_guard_run_commands` 함수)
  - 상세: 향후 누군가 실행 커맨드를 `pnpm test --filter frontend ...` 처럼 인자 순서를 바꾸면 이 필터가 아무 스텝도 못 찾아 `runs` 가 빈 리스트가 되고, `assertEqual(len(runs), 1, ...)` 가 "got []" 라는 명확한 메시지로 실패한다 — 침묵 통과가 아니라 시끄러운 실패이므로 실질적 리스크는 낮다. 다만 실패 원인이 "스텝이 사라졌다"가 아니라 "매칭 패턴이 낡았다"일 수 있어, 실패 메시지만 보면 잠깐 헷갈릴 수 있다.
  - 제안: 조치 불요(선택 사항). 장기적으로 스텝 이름(`name: docs guards (...)`)으로 먼저 찾고 `run` 유무를 검증하는 방식이 조금 더 원인을 특정하기 쉬울 수 있다.

- **[INFO]** `plan/**`·`spec/**` pathspec 이 실제 git pathspec 매칭 규칙(`**` 가 `/` 를 넘는지 등)까지 검증하진 않고, 파싱된 리스트에 리터럴 문자열이 존재하는지만 검사한다.
  - 위치: `.claude/tests/test_spec_link_checks_scope.py:56-65` (`test_pathspecs_trigger_on_plan_and_spec`)
  - 상세: 이 워크플로가 겪은 과거 실제 매칭 함정(`*.md` 가 `/` 를 넘어 17,202개를 잡은 사례, 워크플로 헤더 76-77행)은 이 테스트가 아니라 `test_ci_paths_changed.py`(실제 git 저장소+subprocess로 `**`/`*` 세그먼트 규칙을 고정)가 이미 일반적으로 커버한다. 따라서 이 파일이 리터럴 존재만 확인하는 설계는 중복을 피하는 합리적인 스코프 분리이며 갭이 아니다 — 기록 삼아 남긴다.
  - 제안: 조치 불요.

이 외에 테스트 격리·가독성·Mock 사용 관점에서 지적할 결함은 발견하지 못했다: 파일 I/O만 사용하고 외부 상태·네트워크·순서 의존이 없어 완전히 독립 실행 가능하며, 실제 파서(`parse_pathspecs_block`)를 재구현 없이 import 해서 쓰는 설계는 "가드가 자기 재구현을 검사하다 진짜 파서와 갈라지는" 이 저장소의 반복 실패 패턴을 정확히 피했다. docstring 이 두 과거 결함의 재현 조건과 왜 다른 가드가 이를 못 잡는지를 구체적으로 설명해 가독성도 좋다.

## 요약
직전 라운드 WARNING #2(회귀를 고정하는 자동 테스트 부재)에 대한 조치로 추가된 `test_spec_link_checks_scope.py` 를 실제로 두 개의 독립 뮤턴트(scratch 사본, 저장소 미변경)로 재검증한 결과 두 회귀 형태(`plan/**` pathspec 누락, 단일 파일 실행으로 축소) 모두 정확히 해당 assertion 만 실패시키는 것을 확인했다 — RESOLUTION.md 의 주장이 공허하지 않음을 독립적으로 재현했다. 테스트는 실제 파서를 재사용하고, 순수 파일 읽기 기반이라 격리·재현성이 좋으며, 관련 하네스 스위트(`test_required_check_skip_jobs.py`, `test_workflow_yaml_structure.py`, `test_harness_checks_paths_coverage.py` 등)와의 역할 분담도 중복 없이 명확하다. 발견한 두 건은 모두 INFO 수준의 잠재적 개선 여지이며 조치가 필요하지 않다.

## 위험도
NONE
