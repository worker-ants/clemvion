# 유지보수성(Maintainability) Review

대상: `.claude/tests/README.md`, `.claude/tests/test_review_gate_ci.py`,
`.github/workflows/harness-checks.yml`, `.github/workflows/review-gate.yml`,
`plan/in-progress/harness-review-gate-ci-backstop.md`, `scripts/check-review-gate.py`

## 검증 방법 (요청에 따라 명시)

읽기만으로 판단하지 않고, 아래는 실제로 실행/실측했다.

- `test_review_gate_ci.py` 13개 테스트 전부 실제 실행 → 전부 통과 확인(`python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'`).
- **뮤테이션 3종으로 "이 테스트가 실제로 실패할 수 있는가"를 직접 측정**(지적만 하지 않고 관측):
  1. advisory `notes` 출력을 blocked 분기 안으로만 옮기는 뮤테이션 → `test_notes_are_printed_on_both_verdicts` 가 두 subTest 모두 기대한 `AssertionError`로 RED 전환됨을 확인(이후 즉시 원본으로 복원, `git diff` 로 무변경 확인).
  2. `_load_gate` 의 fail-open try/except 를 제거한 사본(스크래치 디렉터리에만 작성, 저장소 파일은 건드리지 않음) → 원본은 게이트 모듈 부재 시 exit 0(배너 출력)인데 반해 뮤턴트는 처리되지 않은 `ModuleNotFoundError` 로 exit 1 — `test_a_missing_gate_module_does_not_fail_ci` 류가 이 회귀를 잡는다는 것을 대조 실행으로 확인.
  3. `scripts/check-review-gate.py` 에 `os.walk` 호출을 주입한 AST를 인메모리로 파싱해 `OneJudgeTest` 의 판정 로직에 통과시킴 → banned-call 탐지가 실제로 `os.walk` 를 잡아냄을 확인(파일은 건드리지 않고 문자열만 파싱).
  - 리뷰 컨텍스트가 우려한 "실패할 수 없는 테스트 3종"에 해당하는 사례는 이 파일에서 **찾지 못했다** — 점검한 것들은 전부 진짜 회귀를 잡는다.
- `_load_gate` 가 `hooks` 부모 디렉터리까지 `sys.path` 에 얹는 근거를 실측으로 검증 — 격리된 서브프로세스와 임시 git repo에서 `.claude/hooks/_lib` 하나만 `sys.path` 에 넣고 `import review_guard` 및 `evaluate_review()` 끝까지(진짜 게이트 로직 실행) 성공함을 확인. 원본 `guard_review_before_push.py:54` 도 `_lib` 하나만 얹는다는 것을 대조 확인.
- `plan/in-progress/harness-review-gate-ci-backstop.md` 의 `worktree:` frontmatter를 `plan_guard._linked_plans()` 에 실제로 통과시켜 반환값이 빈 리스트임을 확인, 별도로 `.claude/tools/plan-stale-audit.sh` 를 직접 실행해 같은 plan 이 `WORKTREE? MISSING` 으로 잡힘을 재확인(3중 교차검증: 문서 규약 / 함수 실행 / 감사 스크립트).
- 새로 추가된 코드 3종(`check-review-gate.py`, `test_review_gate_ci.py`)에 `re`/정규식이 전혀 없음을 직접 확인 — 리뷰 컨텍스트가 언급한 "shape 판단으로는 못 잡는 quadratic regex" 부류는 애초에 이 번들에 표면이 없다(오히려 `OneJudgeTest` 가 `re` import 자체를 금지 목록에 넣어 재발을 구조적으로 막는다).
- `harness-checks.yml`/`review-gate.yml` 변경분은 `git diff <merge-base> HEAD`로 정확히 분리해 실제로 바뀐 줄만 근거로 삼았다(전체 파일 컨텍스트에 섞인 기존 코드를 신규 결함으로 오인하지 않기 위함). `test_workflow_yaml_structure.py`/`test_harness_checks_paths_coverage.py`/`test_tests_readme_catalog.py` 를 함께 실행해 이번 추가분이 기존 메타 가드를 전부 통과함을 확인.

## 발견사항

- **[WARNING]** 함께 갱신되는 plan 문서의 `worktree:` frontmatter가 이미 사라진 워크트리를 가리켜, `plan_guard` 가 이 plan을 "연결된 plan 없음"으로 오판한다
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:3`
  - 상세: frontmatter 는 `worktree: harness-block-backstop-b56163` 이지만, 이번 회차의 실제 구현(`review-gate.yml`/`check-review-gate.py`/`test_review_gate_ci.py`)은 전부 `harness-review-ci-backstop-91f379` 에서 이뤄졌다. `harness-block-backstop-b56163` 는 `git worktree list` 에도, `.claude/worktrees/` 디렉터리에도 존재하지 않는다. `.claude/docs/plan-lifecycle.md` 는 이 필드를 "이 plan 이 살아있는 워크트리 디렉토리 이름"이라 정의하고, `plan_guard._linked_plans()` 는 정확히 이 필드를 현재 워크트리 basename/브랜치명과 매칭해 push 시 "plan 을 갱신했는가"를 판정하는 근거로 쓴다. 직접 실행: `plan_guard._linked_plans(repo_root, cwd)` → `[]`(연결된 plan 없음). `evaluate_plan()` 은 연결된 plan 이 없으면 `PlanDecision(False, False, "", None)` 으로 **무조건 통과**시킨다(ad-hoc/hotfix 작업을 막지 않으려는 의도된 escape). 오늘은 이 PR 이 실제로 plan 을 갱신했기 때문에 결과적으로 무해하지만, gate 자체는 "갱신했는지 확인"한 게 아니라 **애초에 이 plan 을 보지 못했다**. `.claude/tools/plan-stale-audit.sh` 를 직접 실행해도 이 plan 이 `WORKTREE? MISSING` 으로 잡힌다 — 이 저장소가 이미 이 결함 클래스를 이름 붙여 감시 중이라는 뜻이다. 이 PR 의 주제 자체가 "정규식이 유일 판정자라 사각이 생긴다"인데, 그 짝 문서가 메타데이터-실제 불일치로 인해 자신의 gate(`plan_guard`)에게 조용히 안 보이는, 같은 모양의 사각을 갖고 있다는 점이 아이러니하다.
  - 제안: `worktree:` 를 `harness-review-ci-backstop-91f379` 로 갱신한다. (다회차 plan 이 워크트리를 옮겨 다닐 때 이 필드가 쉽게 뒤처지는 구조이므로, 재발 방지 차원에서 "plan 갱신 시 현재 워크트리와 frontmatter 일치 여부"를 developer 워크플로 체크리스트에 명시하는 것도 고려할 만하다.)

- **[WARNING]** `_load_gate` 의 `hooks` 부모 디렉터리 sys.path 삽입은 실측상 불필요하며, 근거 주석이 사실과 다르다
  - 위치: `scripts/check-review-gate.py:55-57`(주석), `:61-67`(`_load_gate`)
  - 상세: 주석은 "`review_guard` 가 형제 모듈을 이름으로 import 한다(`from branch_guard import …`), 그래서 두 경로(`hooks/_lib`, `hooks`)를 다 얹는다"고 설명한다. 그러나 격리된 서브프로세스에서 `hooks/_lib` **하나만** `sys.path` 에 넣고 `import review_guard` → 성공, 임시 git repo 로 `evaluate_review(root)` 끝까지 호출 → 정상 반환(`blocked=False`)까지 실측으로 확인했다. `review_guard.py` 가 참조하는 `branch_guard` 는 `_lib` 안에 나란히 있어 `_lib` 하나로 충분하고(63행에서 `hooks` 를 얹는 이유가 되지 못함), `_shared` 참조는 `review_guard.py` 자신이 `_CLAUDE_DIR` 을 계산해 별도로 처리한다(이 스크립트의 `hooks` 삽입과 무관). 이 게이트가 "같은 판정자"라 부르는 원본 `.claude/hooks/guard_review_before_push.py:54` 도 `_lib` 하나만 얹는다 — 즉 이 스크립트만 유일하게 다른 패턴을 쓰면서 그 근거 주석은 실측으로 반증된다. 당장 동작을 깨지는 않지만(불필요한 sys.path 항목이 조용히 하나 더 얹힐 뿐), 이 저장소가 "주석이 실제와 다르다"는 결함 클래스를 test suite 전체로 사냥해 온 것과 정확히 같은 모양이라 방치하면 다음 사람이 잘못된 멘탈모델을 갖게 된다.
  - 제안: `hooks` 삽입과 해당 주석을 제거하고 `_lib` 만 남기거나(원본 훅과 동일하게), 정말 `hooks` 가 필요한 별도 이유가 있다면 그 실제 근거로 주석을 교체한다.

- **[WARNING]** README 새 행만 전체 한국어 산문 — 기존 27개 행은 전부 영어
  - 위치: `.claude/tests/README.md:44`
  - 상세: `test_review_gate_ci.py` 행 전체가 한국어 문장으로 작성돼 있다. 같은 파일의 나머지 27개 행(`test_agent_consistency.py` 부터 `test_tests_readme_catalog.py` 까지 전부 확인)은 예외 없이 영어 산문이며, 한국어는 정책 문서의 고유명사·인용구(예: "PROJECT.md §e2e 면제 화이트리스트", "Critical 하향 금지")만 인라인으로 등장한다. 이 파일은 `test_tests_readme_catalog.py`(행 존재/누락 검증)뿐 아니라 `test_line_anchors.py` 가 "13개 위치 블록 byte-identical"까지 확인할 만큼 스스로에게 엄격한 문서인데, 이 행만 언어 관례를 깬다. 표를 훑어 내려가며 패턴을 파악하는 문서에서 한 행만 언어가 다르면 그 자체로 스캔 가능성이 떨어지고, 향후 다른 행도 한국어로 써도 된다는 선례가 될 수 있다.
  - 제안: 다른 행처럼 영어 산문으로 통일(정책 고유명사만 한국어 인용 유지)하거나, 의도적으로 한국어를 쓰기로 한 결정이라면 그 자체를 컨벤션(예: `## Conventions for new tests`)에 남긴다.

- **[WARNING]** 테스트 헬퍼 중복 — 경로 리터럴 3중 반복 + `_run` 을 우회하는 손으로 짠 `subprocess.run`
  - 위치: `.claude/tests/test_review_gate_ci.py:74-76`(`_run` 정의), `:120`, `:127-128`, `:162-163`(동일 경로 리터럴 3회 반복), `:167-170`(`_run` 과 커맨드/kwargs 가 같은 손으로 짠 두 번째 `subprocess.run`)
  - 상세: `os.path.join(self.root, ".claude", "hooks", "_lib", "review_guard.py")` 리터럴이 `test_a_missing_gate_module_does_not_fail_ci`, `test_a_gate_that_raises_does_not_fail_ci`, `test_notes_are_printed_on_both_verdicts` 세 곳에 그대로 반복된다. 별도로 `test_notes_are_printed_on_both_verdicts` 는 `env` 오버라이드가 필요해 `_run` 헬퍼를 쓰지 못하고, `[sys.executable, str(SCRIPT), "--root", self.root]` + `capture_output=True, text=True, timeout=120` 을 그대로 다시 타이핑한 손으로 짠 `subprocess.run` 호출을 갖고 있다(74-76행의 `_run` 과 사실상 동일한 로직의 사본). 이번 리뷰 컨텍스트가 실제로 겪었다고 밝힌 "한 인스턴스는 고치고 나머지 하나는 남기는" 실패 클래스가 재현되기 좋은 모양이다 — 나중에 `_run` 이 인자를 하나 더 받아야 하는 수정이 생기면 이 손으로 짠 사본은 조용히 뒤처진다.
  - 제안: `setUp` 에서 `self._gate_path = os.path.join(self.root, ".claude", "hooks", "_lib", "review_guard.py")` 로 한 번만 계산해 재사용하거나, `_run(self, *extra, env=None)` 으로 확장해 `test_notes_are_printed_on_both_verdicts` 도 `_run` 을 그대로 재사용하게 한다.

- **[INFO]** `main()` 의 세 출력 갈래를 헬퍼로 더 나눌 여지가 있다
  - 위치: `scripts/check-review-gate.py:77-116`(`main`)
  - 상세: `main()` 은 CLI 파싱·게이트 로딩·advisory 출력·통과/미커버(관측)/미커버(강제) 세 갈래의 다중행 메시지 구성을 한 함수 안에서 순차 처리한다. 분기 깊이는 1단계뿐이고 각 블록이 docstring 이 고정한 네 성질(판정자 단일성/관측 모드 기본/fail-open/advisory 무관)과 대체로 대응해 지금도 읽기 어렵지 않지만, 두 개의 여러 줄 메시지 블록을 `_print_observed`/`_print_enforced` 같은 이름 있는 헬퍼로 빼면 `main()` 은 제어 흐름만 남아 더 짧아지고 네 성질과 코드 단위가 더 명시적으로 1:1 대응된다.
  - 제안: 강제 사항은 아니며, 선택적 리팩터링으로 위 출력 블록들을 헬퍼 함수로 추출하는 것을 고려할 만하다.

- **[INFO]** 스텁 문자열이 리터럴 대신 `\uXXXX` escape 로 작성돼 가독성이 떨어진다
  - 위치: `.claude/tests/test_review_gate_ci.py:158`
  - 상세: `_D.notes` 스텁이 반환하는 문구가 `'⚠️  세션X: 하향 감지'` 로 작성돼 있다(디코딩하면 "⚠️  세션X: 하향 감지"). 파일은 이미 다른 곳(주석, docstring 전체)에서 한글을 리터럴로 다루고 있어, 이 한 줄만 escape 로 써야 할 기술적 이유가 보이지 않는다. 디코딩해 값이 `assertIn("하향 감지", ...)` 과 정확히 맞아떨어짐은 확인했으므로 버그는 아니지만, escape 상태로는 리뷰어가 눈으로 즉시 검증하기 어렵다.
  - 제안: 리터럴 문자열(`'⚠️  세션X: 하향 감지'`)로 교체한다.

## 요약

이번 변경은 로컬 push 훅이 쓰는 것과 **동일한** `evaluate_review()` 를 CI PR 이벤트에서 재호출하는 훅-독립 백스톱을, 관측 모드로 신설한다. 판정 로직을 새로 짜지 않고 기존 게이트에 위임한 설계는 이 저장소가 이미 두 번 겪은 로컬/CI drift 를 구조적으로 차단하며, `scripts/check-review-gate.py` 는 짧고 선형적이며(순환복잡도 낮음, 중첩 1단계) "판정을 재구현하지 않는다"는 성질을 AST 기반 테스트로 직접 강제한다 — 실제로 `re`/`subprocess`/`open`/`os.walk` 를 전혀 쓰지 않음을 확인했고, `os.walk` 주입 뮤테이션을 인메모리로 넣어 그 탐지 로직이 실제로 작동함을 실측했다. `test_review_gate_ci.py` 의 13개 테스트는 실제 실행에서 전부 통과했고, 세 가지 대표 뮤테이션(advisory 출력 위치 이동, fail-open 제거, 판정 로직 재구현)에 대해 전부 기대대로 RED 로 전환됨을 직접 확인해 vacuous 한 테스트가 없음을 검증했다. 다만 네 가지 WARNING 이 남는다: 함께 갱신된 plan 문서의 `worktree:` frontmatter가 이미 사라진 워크트리를 가리켜 `plan_guard` 가 이 plan 을 아예 인식하지 못하는 상태(3중 교차검증 — 문서 규약, 함수 직접 실행, `plan-stale-audit.sh`)이고, 이는 오늘은 우연히 무해하지만 이 PR 의 주제(정규식이 유일 판정자라 생기는 사각)와 정확히 같은 모양의 메타데이터-실제 불일치다. 나머지 셋은 `check-review-gate.py` 의 불필요한 `sys.path` 삽입과 그 근거 주석의 사실 오류, README 새 행만 전체 한국어로 작성돼 27개 기존 행의 영어 관례를 깨는 점, 테스트 헬퍼의 3중 경로 리터럴 반복과 `_run` 을 우회하는 손으로 짠 `subprocess.run` 이다. 전부 기능을 깨지 않는 선의 개선 사안이며 CRITICAL 급 결함은 발견되지 않았다.

## 위험도

LOW
