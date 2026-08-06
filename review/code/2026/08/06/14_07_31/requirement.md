# 요구사항(Requirement) Review — round 10

## 발견사항

- **[CRITICAL]** `_current_branch` — 다섯 개 git 프로브를 `_shared/git_probe.py` 로 통합한 9R 이 여섯 번째 사본을 놓쳤다. `branch_guard.py`(main-worktree-on-default-branch 차단 판정)와 `plan_guard.py`(`_linked_plans` 를 통한 PLAN push 하드블록 판정)가 AST-동일(docstring 제외 — 이 저장소가 다섯 개를 추출할 때 쓴 바로 그 기준)한 `_current_branch` 를 각자 손으로 갖고 있고, 어느 쪽도 `_shared/git_probe.py` 로 위임되지 않았다.
  - 위치: `.claude/hooks/_lib/branch_guard.py:57`(정의), `:123`(호출) / `.claude/hooks/_lib/plan_guard.py:115`(정의), `:192`(호출)
  - 상세:
    1. **정적 확인** — `.claude/hooks/_lib/*.py` + `.claude/_shared/*.py` 전체를 AST 정규화(docstring 제거) 후 비교하면 module-level 함수 중 파일을 넘어 동일한 것은 이 쌍 하나뿐이다(다른 다섯은 이미 `git_probe.py` 로 위임됨). 이는 정확히 이 브랜치가 지난 세 라운드에 걸쳐 "손-동기 쌍은 갈린다"(7R `_run_git.strip()`, 8R 같은 결함의 두 번째 사본, 9R `branch_guard` 세 번째 사본)로 반복 확인한 결함 클래스의 **일곱 번째 인스턴스**다.
    2. **테스트 커버리지 확인** — 두 사본 모두 어떤 스위트에서도 실행되지 않는다: `test_plan_guard.py` 는 `mock.patch.object(pg, "_current_branch", ...)` 로, `test_branch_guard.py` 는 `mock.patch.object(bg, "_current_branch", ...)` 로 항상 우회한다. `GitProbesAreNotReDuplicatedTest`(`test_plan_guard.py:342-346` `_SHARED`/`_SHARED_IN_BRANCH_GUARD`)는 다섯 개(+ branch_guard 의 두 개)만 등재하고 `_current_branch` 는 목록에 없다 — 재복제 가드 자체가 이 함수를 보지 않는다.
    3. **뮤테이션으로 실측** — `branch_guard.py` 의 `_current_branch` 를 `return out` → `return "MUTATED-" + out` 한 줄만 바꿔 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 를 돌리면:
       ```
       Ran 849 tests in 101.614s
       OK
       ```
       전체 스위트가 그대로 통과한다(원본 GREEN 도 849 tests OK 로 동일 — round 9 커밋 메시지의 "849 tests" 주장과 일치, 재측정 완료). 그리고 이 뮤턴트가 실제로 판정을 뒤집는지 별도로 확인했다 — 가드가 막아야 하는 정확한 시나리오(main worktree, 현재 브랜치 == origin 기본 브랜치 "main")를 재현하면:
       ```
       blocked: False | reason: main worktree but current branch 'MUTATED-main' != default 'main' — allowed
       ```
       즉 "메인 워크트리에서 default 브랜치 편집을 막는다"(이 프로젝트 CLAUDE.md §0 의 핵심 enforcement, `guard_default_branch_edit.py`/`guard_default_branch_prompt.py`/`.githooks/pre-commit` 세 소비자가 이 판정에 의존)는 규칙이 조용히 무력화되는데도 하네스 스위트 849개는 전부 초록이다. `plan_guard.py` 쪽 사본이 갈리면 `_linked_plans` 의 branch-key 매칭(`claude/<name>` 접두 제거분)이 깨져 PLAN 하드블록이 (worktree-basename 키가 우연히 살아있지 않는 한) 조용히 fail-open 하는 동일 클래스의 결함이 된다.
  - 제안: `_current_branch(cwd)` 를 `_shared/git_probe.py` 로 옮기고 `branch_guard.py`/`plan_guard.py` 양쪽을 `_git_probe._current_branch` 위임으로 바꾼다. `test_plan_guard.py::GitProbesAreNotReDuplicatedTest` 의 `_SHARED`/`_SHARED_IN_BRANCH_GUARD` 튜플에 `_current_branch` 를 추가해(현재 `branch_guard` 는 `_run_git`/`_repo_root` 둘만 세므로 셋으로 확장) 재복제 가드가 이 함수도 보게 한다. 가능하면 `PorcelainPathSurvivesOnARealRepoTest` 급의 실제 repo 구동 테스트를 하나 추가해(예: `git checkout -b <name>` 후 `_current_branch` 가 그 이름을 그대로 돌려주는지) 다시는 이 함수의 두 사본 모두가 mock 뒤에 숨지 않게 한다.

- **[INFO]** `plan/in-progress/harness-review-gate-ci-backstop.md` 상단 상태 표의 "배선 가드 경화 | **1R~6R 진행 중**" 문구가 §배선 가드 라운드 표(1R~7R까지 기재됨) 및 실제 git 이력(7R~9R 커밋 `cd38361ac`/`88ce9994d`/`e834d0f4e`)보다 뒤처져 있다. 8R/9R 은 "우회"가 아니라 "살아있는 결함"을 찾은 라운드라 §배선 가드 표(우회 전용 로그)에 새 행이 필요하지는 않지만, 상단 요약 숫자("1R~6R")는 표 자체가 이미 7R까지 적고 있는 사실과도 어긋난다.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md` (상단 진행 요약 표, "배선 가드 경화" 행)
  - 상세: 코드 동작에는 영향 없는 진행상황 서술 drift. spec/ 문서가 아니라 plan/ 티켓이라 규약상 SPEC-DRIFT 태그 대상은 아니다.
  - 제안: 다음 편집 시 "1R~9R" 로 갱신하거나, 라운드 카운트를 서술에서 제거하고 §배선 가드 표를 SoT 로 가리키게 한다(이 저장소가 이미 "라운드 수를 프로즈에 적지 않는다" 관행을 다른 곳(README `test_workflow_yaml_structure.py` 행)에서 채택한 이유와 동일).

## 검증한 것 (발견 없음)

- `review_guard.py::_summary_is_resolved` 의 위험도 파싱 — 9R 이 고친 무조건 `break` 제거를 재확인. 내부/외부 루프 조건 재추적 결과 로직 건전. `_section_has_rows`, `evaluate_review` 의 세 `ReviewDecision` 반환 경로(각각 `tuple(notes)` 포함) 모두 정상.
- `_shared/block_integrity.py` — `summary_block_verdict` 의 END-anchor-then-START-anchor-then-last-wins 로직을 `test_block_integrity.py` 의 7개 앵커 케이스로 손으로 추적, 전부 일치.
- `_shared/report_paths.py` — 경로 재앵커링·non-empty 체크 로직 불변, 회귀 없음.
- 환경변수 스캔(`TheGateItselfDoesNotBranchOnCiEnvTest`)이 이제 `_shared/*.py` 를 디렉터리 glob 으로 도출하므로 새로 추가된 `git_probe.py` 도 자동 포함됨을 확인(`git_probe.py` 안에 실제로 등재 안 된 환경 접근 없음 — `os.environ`/`getenv` grep 결과 review_guard.py 의 등재된 `CLAUDE_PROJECT_DIR` 하나뿐).
- `review-gate.yml` 파싱 결과가 `WorkflowWiringTest.EXPECTED` 리터럴과 필드 단위로 일치함을 직접 대조(순서·키 포함) — `paths` 5개, `concurrency`, `permissions`, `jobs.gate` 의 4-step 구조 전부 일치.
- `scripts/check-review-gate.py` 의 `_ALLOWED_IMPORTS`/`_ALLOWED_CALLS` 가 스크립트 실제 호출 표면과 일치(스크립트가 쓰는 모든 dotted call 이 허용 목록 안에 있음을 수동 대조).
- `plan_guard.py`/`branch_guard.py`/`review_guard.py` 외 `.claude/hooks/_lib/*.py` + `.claude/_shared/*.py` 전체에 대해 module-level 함수의 AST 동일성(docstring 제외)을 전수 스캔 — 위에 보고한 `_current_branch` 한 쌍 외에는 파일을 넘는 중복 없음.

## 요약

CI 백스톱 본체(`review-gate.yml`, `check-review-gate.py`)와 그것이 위임하는 `review_guard.evaluate_review()` 판정 로직·워크플로 배선 가드는 9R 까지의 강화 이후 견고하다 — 정적/행위 가드가 다층으로 걸려 있고 849개 하네스 테스트가 실제로 재현·통과함을 확인했다. 다만 9R 이 다섯 개 git 프로브를 `_shared/git_probe.py` 로 통합하며 "손-동기 쌍 drift" 클래스를 닫았다고 결론지었는데, 같은 기준(AST 동일성, docstring 제외)으로 전수 스캔하면 `_current_branch` 라는 여섯 번째 함수가 `branch_guard.py`/`plan_guard.py` 에 여전히 손으로 복제돼 있고 어느 테스트도 실제 구현을 실행하지 않는다. 뮤테이션으로 실측한 결과 이 함수 한쪽만 깨져도(a) 하네스 849개 테스트 전원이 그대로 통과하고 (b) "메인 워크트리에서 default 브랜치 편집을 막는다"는 이 프로젝트의 핵심 enforcement 가 실제로 무력화된다 — 정확히 이 라운드가 찾던 "판정을 재현했지만 아무 테스트도 실행한 적 없는 helper" 클래스다. CI 백스톱 자체의 관측 모드 설계·fail-open 계약·`--enforce` 선행조건(신뢰 뿌리 문제)은 이미 결정된 사항으로 재론하지 않았다.

## 위험도

HIGH
