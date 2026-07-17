# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** 신규 `.claude/_shared/**` 모듈이 harness CI 트리거 `paths:` 목록에서 빠져 있다 — 이 PR 이 막으려는 바로 그 drift 클래스가 재발할 수 있는 자리
  - 위치: `.github/workflows/harness-checks.yml` 9~27행 (`on.pull_request.paths`)
  - 상세: 본 PR 이 `.claude/_shared/report_paths.py` 를 "가드(`review_guard.py`)와 CLI(`code_review_orchestrator.py`, `consistency_orchestrator.py`)가 절대 어긋나면 안 되는 단일 진실"로 신설했는데, 정작 `harness-checks.yml` 의 PR 트리거 `paths:` 목록에는 `.claude/agents/**` `.claude/commands/**` `.claude/hooks/**` `.claude/skills/**` `.claude/tests/**` `.claude/tools/**` `.claude/workflows/**` 만 있고 `.claude/_shared/**` 는 없다. 즉 향후 PR 이 `.claude/_shared/report_paths.py` **한 파일만** 고치고 `.claude/hooks/**`·`.claude/skills/**`·`.claude/tests/**` 중 어느 것도 같이 건드리지 않으면(예: `report_path()` 내부 버그만 수정), `python3 -m unittest discover -s .claude/tests` 를 도는 `harness-checks.yml` 자체가 트리거되지 않아 `test_report_paths_shared.py`·`test_review_guard.py::ForcedCoverageTest`·`test_orchestrator_state.py`·`test_consistency_orchestrator_state.py` 전부가 CI 상에서 조용히 안 돈다. 동일 파일 18~19행 주석("Workflow 스크립트는 … 종전 paths 에 없어, 단독 수정 시 가드가 트리거되지 않았다")이 정확히 같은 실패 유형에 대한 과거 수정 기록이라, 이번에 신설된 `_shared/` 가 같은 구멍을 새로 열어놓은 셈이다. 로컬에서 직접 돌려 보면 전부 통과함을 확인했다(134/134 관련 테스트, 265/265 전체 `.claude/tests` 스위트) — 즉 테스트 자체는 건전하고, 문제는 오직 "미래의 단독 수정에도 CI 가 이 테스트를 반드시 돌릴 것"이라는 보장이 빠져 있다는 점이다.
  - 제안: `paths:` 목록에 `- '.claude/_shared/**'` 한 줄 추가.

- **[WARNING]** `_report_paths()` 로컬 wrapper 가 두 orchestrator 모두에서 호출자 없는 죽은 코드가 됐고, 그 결과 shared 모듈의 `report_paths()`(복수형)는 정상 경로가 한 번도 테스트되지 않는다
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:244-251`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:101-107`, `.claude/_shared/report_paths.py:54`(`report_paths`), `.claude/tests/test_report_paths_shared.py:99`(`test_malformed_manifest_shapes_do_not_crash`)
  - 상세: 리팩터 전에는 `_reconcile_state_with_disk`/`_verify_coverage` 가 로컬 `_report_paths(sd, state)` 를 호출해 dict 를 만든 뒤 그걸 사용했다. 리팩터 후에는 두 orchestrator 모두 `_report_paths_lib.has_report(...)`/`_report_paths_lib.missing_reports(...)` 를 **직접** 호출하도록 바뀌었는데, 정작 새로 만든 `_report_paths()` 로컬 함수(각 파일에 여전히 정의돼 있고 "Kept as a named function because call sites read better" 라는 docstring 을 달고 있음)는 이제 그 어떤 call site 에서도 호출되지 않는다. 저장소 전체를 grep 해도 두 정의 라인 자체 외에는 참조가 전혀 없다(프로덕션 코드·테스트 모두). 따라서 이 wrapper 가 감싸는 shared 모듈의 `report_paths()`(복수형, `{agent: path}` dict 를 만드는 함수)는 프로덕션에서 도달 불가능하고, `test_report_paths_shared.py` 안의 유일한 직접 호출(`test_malformed_manifest_shapes_do_not_crash`)조차 `{"subagent_invocations": {"x": 1}}` 같은 **기형 입력 → 빈 dict 반환** 분기만 확인할 뿐, 정상 입력(유효한 `subagent_invocations` 리스트 → `{name: path}` dict 채워짐)에 대한 happy-path 는 어디에도 검증돼 있지 않다. "looks tested, isn't" 이 바로 이 PR 이 잡으려던 패턴인데, `report_paths()` 자체가 그 패턴에 해당한다.
  - 제안: 둘 중 하나 — (a) 죽은 `_report_paths()` wrapper 2개와 그것이 감싸는 `report_paths()` 를 실제로 쓰는 곳이 없다면 정리(제거)하거나, (b) 향후 디버깅/CLI 확장 등 의도된 public API 로 유지할 거라면 `report_paths()` 의 정상 입력 케이스에 대한 단위 테스트를 최소 1개 추가.

- **[WARNING]** `consistency_orchestrator.py` 의 "빈 리포트는 성공이 아니다" 동작 변경이 `code_review_orchestrator.py` 와 달리 직접 테스트되지 않는다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:128`(`_reconcile_state_with_disk` 의 `has_report` 사용), `.claude/tests/test_consistency_orchestrator_state.py`(대응 테스트 부재)
  - 상세: 두 orchestrator 모두 `_reconcile_state_with_disk` 에서 `os.path.isfile(...)`(존재만 확인) → `_report_paths_lib.has_report(...)`(존재 **+** non-empty) 로 바뀌었다 — 즉 `touch`된 빈 리포트가 이제 "success" 로 승격되지 않는, 실질적 동작 변경이다. `code_review_orchestrator.py` 쪽은 `test_report_paths_shared.py::AgreementTest.test_agree_on_an_empty_report` 가 실제 CLI 서브프로세스(`--verify-coverage`)와 `review_guard._forced_coverage_missing` 을 나란히 돌려 "빈 리포트 = 커버리지 아님"을 end-to-end 로 못박는다. 반면 `consistency_orchestrator.py` 는 `--verify-coverage` 자체가 없고(이 커맨드는 code-review 쪽에만 존재), 유일하게 이 동작이 드러나는 지점은 `--summary-state`/`--resume` 이 호출하는 `_reconcile_state_with_disk` 인데, `test_consistency_orchestrator_state.py` 의 어떤 테스트도 빈 파일(`write_text("")`)을 써서 이를 검증하지 않는다(저장소 전체에서 consistency 테스트 파일 중 `write_text("")` 사용처 0건, grep 으로 확인). 즉 이 특정 orchestrator 에 한해 "빈 리포트가 더 이상 success 로 카운트되지 않는다"는, 이 PR 이 도입한 동작 변경이 회귀 가드 없이 남아 있다.
  - 제안: `test_consistency_orchestrator_state.py` 에 `test_an_empty_checker_report_is_not_promoted_to_success` 류 테스트 1개 추가 — `code_review_orchestrator` 쪽 `AgreementTest` 와 대칭을 맞추면 두 orchestrator 가 "change both" 주석이 아니라 테스트로 동기화된다(이 PR 의 취지와 정확히 일치).

- **[INFO]** `report_path()`(단수형)의 `isinstance(invocations, list)` 가드 분기가 직접 테스트되지 않음
  - 위치: `.claude/_shared/report_paths.py:41`
  - 상세: `report_paths()`(복수형, 57행)의 동일 가드는 `test_malformed_manifest_shapes_do_not_crash` 가 `{"subagent_invocations": {"x": 1}}` 로 직접 검증하지만, `report_path()`(단수형)는 `subagent_invocations` 가 **빈 리스트**인 케이스(`test_a_name_absent_from_the_manifest_falls_back_to_name_md`)로만 "fallback to name.md" 를 확인할 뿐, `subagent_invocations` 가 완전히 없거나(dict 에 키 자체 부재) list 가 아닌 타입인 케이스는 별도로 짚지 않는다. 두 함수가 같은 패턴이라 실제 위험은 낮지만, `has_report`/`missing_reports` 를 통해 간접적으로만 이 분기를 태우고 있다.
  - 제안: `report_path(self.sd, "security", {})` (키 자체 부재) 케이스를 `ReportPathsTest` 에 한 줄 추가하면 명시적으로 닫힌다. 선택 사항.

- **[INFO]** `test_report_paths_shared.py` 가 같은 물리 파일을 프로세스 내에서 두 개의 다른 모듈 이름으로 중복 로드
  - 위치: `.claude/tests/test_report_paths_shared.py:22-27`
  - 상세: `rp = load_module_by_path("_shared_report_paths", REPO_ROOT / ".claude" / "_shared" / "report_paths.py")` 는 `from _lib import review_guard as rg` (그 내부에서 이미 `from _shared import report_paths as _report_paths_lib` 를 실행해 `.claude` 를 `sys.path` 에 꽂아둔 뒤) 다음 줄에 온다. 이 시점엔 `import _shared.report_paths as rp` 로 캐시된 모듈을 재사용해도 됐을 텐데, 별도 이름으로 파일을 다시 로드해 동일 로직의 두 모듈 객체가 같은 인터프리터에 공존한다. 순수 함수만 담긴 모듈이라 실해는 없지만(테스트 전부 통과 확인), 두 orchestrator 서브프로세스 테스트가 검증하는 "진짜 프로덕션 경로"와 미묘하게 다른 로딩 경로를 하나 더 만드는 것이므로 짚어둔다.
  - 제안: 필수 아님 — 현재도 정상 동작.

## 요약

새로 도입된 `.claude/_shared/report_paths.py` 는 `test_report_paths_shared.py`(순수 함수 단위 테스트 + gate·CLI 실동작 일치를 실제 서브프로세스로 검증하는 `AgreementTest`)로 견고하게 뒷받침되고, `review_guard.py` 의 리팩터는 기존 `test_review_guard.py::ForcedCoverageTest`(빈 리포트·죽은 worktree 경로·기형 매니페스트 등 이미 폭넓게 커버)가 그대로 회귀 가드 역할을 한다. `_newest_resolved_review_mtime` 을 실제 디렉토리로 검증하는 `test_forced_coverage_selection.py` 는 "모든 기존 테스트가 mock 으로 우회했다"는 자기 진단을 스스로 해소하는 좋은 추가이며, sidebar 테스트 헬퍼 추출도 `vi.mock` 호이스팅 제약을 문서화하고 부분 추출에 그친 이유를 명확히 남겼다. 로컬에서 `.claude/tests` 전체(265건)와 프런트 sidebar 테스트(11건)를 재실행해 전부 통과를 확인했다. 다만 이번 리팩터가 새로 만들어낸 표면 — ①신설 `_shared/**` 가 harness CI 트리거 `paths:` 에서 빠져 미래의 단독 수정이 스위트를 안 돌릴 수 있다는 점, ②`_report_paths()` wrapper 가 양쪽 orchestrator에서 죽은 코드가 되며 그 아래 `report_paths()` 복수형 함수의 정상 경로가 결과적으로 미검증 상태로 남았다는 점, ③`code_review_orchestrator` 에는 있는 "빈 리포트=실패" 대칭 테스트가 `consistency_orchestrator` 에는 없다는 점 — 은 모두 "각자 사본을 들고 있다가 조용히 어긋난다"는 이 PR 이 잡으려는 바로 그 실패 유형과 같은 계열이라 후속 조치 가치가 있다.

## 위험도
MEDIUM
