# 테스트(Testing) 리뷰 — 리뷰 게이트 CI 백스톱

검증 방법론: 6개 대상 파일을 정독한 뒤, `scripts/check-review-gate.py` 의 실제 인터페이스 상대(`.claude/hooks/_lib/review_guard.py`)를 직접 읽어 스텁/mock 이 실 인터페이스와 일치하는지 대조했다. 그런 다음 **읽기만으로 판단하지 않고** 커밋된 6개 파일을 임시로 mutate → 관련 테스트 재실행 → RED 확인 → 원본과 md5 대조로 완전 복원, 순서로 8종의 뮤테이션을 실측했다(전부 실제 스크립트 실행/subprocess, in-process mock 아님). 마지막으로 전체 하네스 self-test suite(825개)를 원복 후 3회 재실행해 회귀 여부를 확인했다. 아래 발견은 전부 이 실측에 근거한다.

## 발견사항

- **[WARNING]** `--root` 기본값(`_ROOT_DEFAULT`) 산정 경로가 어떤 테스트에서도 실행되지 않고, 이 경로가 깨지면 실패가 **완전히 침묵**한다(관측 모드가 아니라 `--enforce` 에서도 exit 0).
  - 위치: `scripts/check-review-gate.py:58` (`_ROOT_DEFAULT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))`), 소비처 `scripts/check-review-gate.py:61-74`(`_load_gate`)·`scripts/check-review-gate.py:81`(`ap.add_argument("--root", default=_ROOT_DEFAULT, ...)`)
  - 상세: `.claude/tests/test_review_gate_ci.py` 의 13개 테스트는 전부 `--run`/`subprocess.run` 호출 시 `--root <tempdir>` 를 명시로 넘긴다(`_run` 헬퍼 `.claude/tests/test_review_gate_ci.py:74-77`, `test_notes_are_printed_on_both_verdicts` 의 직접 `subprocess.run` 호출도 동일). 반면 실제 CI 가 쓰는 호출 모양(`.github/workflows/review-gate.yml:61`: `run: python3 scripts/check-review-gate.py`)은 `--root` 를 전혀 넘기지 않으므로 **`_ROOT_DEFAULT` 산정이 곧 실제 배포 경로**다. 실측: `python3 scripts/check-review-gate.py` (내 워크트리에서 `--root` 없이 실행) → `review-gate: 통과 — no codebase/ changes on this branch — allowed`(정상). 이어서 `--root /tmp/nonexistent-repo-root-xyz --enforce` 로 고장난 루트를 흉내내자 → `review-gate: 게이트를 불러오지 못했습니다 (ModuleNotFoundError: No module named 'review_guard')` 를 stderr 에 찍고 **exit 0**. 관측 모드도 항상 exit 0 이므로, 이 스크립트가 향후 다른 디렉터리 깊이로 옮겨져 "2단계 상위" 가정이 깨지면 CI 는 계속 초록색인 채 이 백스톱이 영구적으로 무력화된다 — 아무도 알아챌 신호가 없다(이 프로젝트가 이미 알고 대비해 온 정확히 그 "silent-permanent-disable" 실패 클래스, 예: `test_bootstrap_mermaid_install.py` 가 같은 클래스를 명시로 가드).
  - 제안: `_harness.REPO_ROOT` 와 `_ROOT_DEFAULT` 를 대조하거나, `--root` 없이 실제 저장소를 대상으로 스크립트를 실행해 "게이트를 불러오지 못했습니다" 문구가 stderr 에 **없음**을 단언하는 테스트를 추가한다(판정 자체는 앰비언트 상태에 의존하므로 단언 대상이 아니라, 로드 성공 여부만 확인하면 충분).

- **[WARNING]** `WorkflowWiringTest` 의 점검이 파싱이 아니라 주석-제거 후 **부분 문자열 존재 여부**뿐이라, 실제 배선이 깨져도 같은 문자열이 다른 자리에 남아있으면 통과한다 — 실측으로 재현.
  - 위치: `.claude/tests/test_review_gate_ci.py:248-249`(`test_it_exempts_dependabot`), `.claude/tests/test_review_gate_ci.py:254-260`(`test_it_triggers_on_the_gate_it_depends_on`), 대상 `.github/workflows/review-gate.yml:44`(`if: github.actor != 'dependabot[bot]'`)
  - 상세: `review-gate.yml` 에서 실제 job-level 게이트인 44번째 줄(`if: github.actor != 'dependabot[bot]'`)을 통째로 제거하고, 그 대신 무관한 `run: echo 'dependabot[bot] handling removed'` 스텝에 같은 리터럴 문자열만 남겨 재실행했다. 결과: `test_it_exempts_dependabot` 은 여전히 `ok`. 이는 봇 PR 이 다시 게이트에 걸려 "사실상 dependabot 전용 알람이 된다"(plan 문서 자신이 명시한 위험, `plan/in-progress/harness-review-gate-ci-backstop.md` §마찰)는 회귀를 이 테스트가 못 잡는다는 뜻이다. 같은 파일의 `OneJudgeTest`(위 참고)는 정확히 이 "단어가 아니라 연산" 문제를 이미 두 번 겪고 AST 기반으로 재작성됐는데(자체 docstring 이 그 이력을 기록), `WorkflowWiringTest` 는 같은 교훈이 아직 반영되지 않은 자리다. 이 PR 이 `test_workflow_yaml_structure.py`/`test_override_floors.py` 를 위해 PyYAML 을 이미 CI 의존성으로 들여왔으므로(README §PyYAML 예외), `on.pull_request.paths`/`jobs.gate.if` 를 `yaml.safe_load` 로 실제 파싱해 구조적으로 단언하는 것이 이미 확보된 전례와 일관된다.
  - 제안: `test_it_exempts_dependabot`/`test_it_triggers_on_the_gate_it_depends_on`/`test_it_fetches_full_history` 를 `yaml.safe_load(self.text)` 결과의 `data["jobs"]["gate"]["if"]`, `data["on"]["pull_request"]["paths"]`, 해당 스텝의 `with.fetch-depth` 를 직접 조회하는 형태로 바꾼다. (참고: `test_it_is_still_observation_only`(`--enforce` 부재 확인)는 "존재하지 않음"을 확인하는 성격이라 이 문제의 영향이 적어 우선순위 낮음.)

- **[WARNING]** `OneJudgeTest` 의 banned-call/banned-import 탐지가 import alias 로 우회 가능함을 실측 확인.
  - 위치: `.claude/tests/test_review_gate_ci.py:196-201`(호출 이름 수집: `ast.Name`/`ast.Attribute` 케이스만 문자열로 축약), `.claude/tests/test_review_gate_ci.py:209-210`(금지 호출 목록), `.claude/tests/test_review_gate_ci.py:222`(금지 import 목록 — `re`/`glob`/`subprocess` 만 있고 `os` 는 없음, 정당한 사유가 있으나 이 우회의 조건이 됨)
  - 상세: `scripts/check-review-gate.py` 에 `from os import walk as _w` + `_LEAK = list(_w('.'))` 를 주입(= 금지된 `os.walk` 와 동일 연산)했더니 `OneJudgeTest` 는 여전히 13/13 통과했다. 이유: `_w(...)` 호출의 AST 함수명은 bare `"_w"` 이고 banned 문자열(`"os.walk"`)과 일치하지 않으며, `os` 자체는 정상적인 경로 조합에 필요해 금지 import 목록(`re`/`glob`/`subprocess`)에도 없다. 대조군으로 같은 자리에 `import re` + `re.compile(...)` 을 직접 주입하면 테스트가 정확히 이 이유로 FAIL 하는 것도 확인했다 — 즉 이 테스트는 "완전히 무력"이 아니라 **비-별칭 형태만** 잡는다는 뜻이다. 발생 가능성은 낮지만(의도적 회피보다는 우연한 `from X import Y as Z` 리팩터가 계기), 같은 파일이 정확히 "문자열이 아니라 연산" 원칙을 표방하고 있어(라인 185 docstring) 이 한 곳만 그 원칙에서 새는 것은 지적할 가치가 있다.
  - 제안: 낮은 우선순위. 필요하면 `ast.alias.asname → 정본 dotted-name` 역매핑을 추가해 별칭도 정본 이름으로 정규화한다(이미 `test_harness_checks_paths_coverage.py::ExtractorBoundaryTest.test_resolves_an_alias_defined_in_the_file` 가 자매 가드에서 이 문제를 푼 선례가 있다).

## 검증 완료(정상 동작 확인, 발견 아님 — 측정 근거로 기재)

- `main()`(`scripts/check-review-gate.py:77-116`)의 모든 분기(게이트 로드 실패, 게이트 예외, notes 항상 출력, 통과, 미커버+관측 모드, 미커버+enforce)가 각각 최소 1개 테스트로 커버됨을 코드 대조로 확인했고, 그중 핵심 3개 불변식(관측 모드 기본, advisory 항상 출력, 단일 판정자)은 **직접 뮤테이션으로 RED 전이**까지 확인했다:
  - 관측 모드 조기 return 제거 → `test_unreviewed_branch_is_reported_but_not_failed_by_default`, `test_enforce_turns_the_same_verdict_into_a_failure`, `test_notes_are_printed_on_both_verdicts` 3건 정확히 FAIL.
  - advisory 출력을 blocked 분기 안으로 이동 → `test_notes_are_printed_on_both_verdicts` 의 `blocked='0'`(통과 경로) subTest 만 정확히 FAIL(정확히 의도한 대칭 문구 그대로).
  - `review-gate.yml` 의 `paths:` 에서 `.claude/_shared/**` 한 줄 제거 → `test_it_triggers_on_the_gate_it_depends_on` 정확히 FAIL.
  - 이로써 이 스위트에 "절대 실패할 수 없는" 테스트(sibling 라운드에서 지적된 클래스)는 위 3개 항목 관련해서는 없음을 확인했다.
- Mock/스텁 적절성: `test_a_gate_that_raises_does_not_fail_ci`/`test_notes_are_printed_on_both_verdicts` 가 쓰는 `review_guard` 스텁(`blocked`/`reason`/`notes`/`push_blocks`)을 실제 `.claude/hooks/_lib/review_guard.py` 의 `ReviewDecision`(dataclass, 동일 4개 필드/프로퍼티) 및 `evaluate_review(cwd=None, *, in_flight_ok=False)` 시그니처와 대조 — 일치. 스텁이 실제 인터페이스를 가리지 않는다.
- 테스트 격리: 각 테스트가 `setUp` 에서 `tempfile.mkdtemp()` + 독립 `git init` + `addCleanup(shutil.rmtree, ...)` 로 완전히 분리된 임시 저장소를 만들고, 판정은 매번 새 서브프로세스(`subprocess.run([sys.executable, ...])`)로 실행되므로 프로세스 간 상태 누수가 없다. 순서 의존 없음.
- 회귀: 원복 검증을 위해 6개 대상 파일 전부를 `HEAD` 대비 md5 대조(전부 일치, 뮤테이션 잔존 없음) 한 뒤 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'`(825개)를 3회 재실행, 매번 `OK`. 이 변경과 직접 관련된 기존 가드도 개별 확인: `test_harness_checks_paths_coverage.py`(26개, `scripts/check-review-gate.py` 가 paths 커버리지 대상으로 정확히 등록됐음을 확인), `test_tests_readme_catalog.py`(5개, 새 README 행이 정상 인식), `test_workflow_yaml_structure.py`(6개, `review-gate.yml`/`harness-checks.yml` 모두 중복 키·run/uses 결함 없음 — 이 PR 자신이 고치려는 바로 그 사고 클래스가 재발하지 않았음을 확인).
- 신규 회귀-위험 코드 없음: 6개 파일 중 정규식을 새로 도입한 곳은 없다(`check-review-gate.py` 는 `re` 를 import 하지 않는다). Sibling 라운드에서 지적된 "실측해야 갈리는 quadratic 정규식" 클래스는 `review_guard.py::_glob_to_regex`(변경 범위 밖, 이번 diff 대상 아님)에 있는 것으로, 이번 6개 파일에는 해당 리스크가 없다.
- 방법론 투명성: 뮤테이션 프로빙 도중 `test_review_gate_ci.OneJudgeTest`가 전체 스위트(825개) 실행 중 단 1회, 이미 원복된 것으로 확인한 `re` import 흔적을 이유로 FAIL 한 사례가 있었다. 그 직전/직후 파일을 `HEAD` 대비 md5 로 대조하면 완전히 일치했고, 격리 실행·2회의 재실행 전체 스위트에서 전혀 재현되지 않았다 — 코드 결함이 아니라 내 반복적 mutate/restore 사이클이 마운트된 워크트리 경로(`/Volumes/...`)에서 남긴 일회성 아티팩트로 판단해 발견사항으로 등록하지 않는다(재현 불가 + 커밋 상태와 바이트 동일 확인 완료).

## 요약

리뷰 게이트 CI 백스톱(`scripts/check-review-gate.py` + `test_review_gate_ci.py` 13건 + `review-gate.yml`)은 `main()`의 모든 분기가 테스트로 커버되고, 그중 핵심 불변식(관측 모드 기본·advisory 상시 출력·단일 판정자·트리거 경로)은 실측 뮤테이션으로 RED 전이까지 확인되어 vacuous 하지 않다. Mock/스텁은 실제 `review_guard.ReviewDecision`/`evaluate_review` 인터페이스와 일치하고, 테스트는 서브프로세스+임시 git repo 기반으로 완전히 격리돼 있으며, 전체 하네스 회귀(825건)도 3회 재확인상 무결하다. 다만 세 가지 개선 여지를 실측으로 확인했다: (1) 실제 CI 가 매번 쓰는 `--root` 미지정(기본값) 경로는 어떤 테스트도 실행하지 않고, 이 경로가 깨지면 관측 모드와 구분 불가능하게 **조용히** exit 0 이 되는 "silent-permanent-disable" 위험을 안고 있다. (2) `WorkflowWiringTest` 의 워크플로 배선 점검이 구조적 파싱이 아니라 부분 문자열 검사라, dependabot 면제 같은 실제 게이트가 깨져도 리터럴 문자열이 다른 자리에 남아있으면 통과함을 재현했다 — 이 파일의 다른 테스트(`OneJudgeTest`)가 이미 겪고 고친 것과 같은 "단어 vs 연산" 클래스다. (3) `OneJudgeTest` 의 금지-호출 탐지는 import alias 로 우회 가능함을 확인했다(낮은 우선순위). 셋 다 현재 활성 결함이 아니라 향후 회귀를 못 잡을 수 있는 테스트 강건성 갭이며, 백스톱 자체가 관측 모드+fail-open 으로 설계돼 있어 blast radius 는 제한적이다.

## 위험도

LOW
