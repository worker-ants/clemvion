# 부작용(Side Effect) 리뷰 — harness-review-gate-ci-backstop (round 2)

## 방법

CONTEXT 의 지시대로 "가드/테스트가 이름 붙인 성질이 거짓인데도 통과하려면 무엇이 필요한가"를
실제로 뮤턴트를 만들어 **실제 테스트 클래스**(`OneJudgeTest`, `WorkflowWiringTest`)를 그대로
로드해 돌려 확인했다(추론이 아니라 실행). 아래 CRITICAL/WARNING 은 전부 이렇게 측정한 결과다.

## 발견사항

- **[CRITICAL]** `OneJudgeTest` 의 "판정자가 하나다" 가드가 `__import__()` 동적 임포트로 완전히
  우회된다 — import 허용목록과 호출 금지목록 양쪽 다 안 걸린다.
  - 위치: `.claude/tests/test_review_gate_ci.py:223`(`_ALLOWED_IMPORTS`), `:245-256`(import 집합
    검사), `:268-282`(호출 금지목록 검사)
  - 상세: 이 테스트는 이미 세 번 고쳐졌다고 자인한다(전문 grep → 문구 검사 → 연산 기반 금지목록,
    각각 리뷰어가 실증한 우회로 폐기). 그런데 세 번째 버전도 `ast.Import`/`ast.ImportFrom`
    **정적 노드만** 훑어 `imported` 집합을 만든다. `_sp = __import__("subprocess")` 처럼
    런타임 호출로 모듈을 가져오면 이 노드 자체가 아예 없으므로 `imported`(따라서
    `extra = imported - _ALLOWED_IMPORTS`)에 전혀 나타나지 않는다. 이어지는 `_sp.run(...)`
    호출도 `alias_of`(정적 import 문에서만 채워짐)에 `_sp` 항목이 없어 `called` 집합에
    `subprocess.run` 이 아니라 `_sp.run` 으로만 남고, 금지 목록(`os.walk`/`os.scandir`/
    `os.listdir`/`open` 4개)에는 애초에 `subprocess.*` 자체가 없다. 즉 `scripts/check-review-gate.py`
    에 `__import__("subprocess")` 로 `grep -rl` 을 돌려 리뷰 산출물을 직접 뒤지는 **완전한 두 번째
    판정자**를 심어도 이 테스트는 통과한다.
    실측: 위 패턴을 담은 스크립트를 만들어 실제 `test_review_gate_ci.OneJudgeTest` 클래스를
    `importlib`로 로드하고 `SCRIPT` 만 그 파일로 바꿔 `unittest.TextTestRunner`로 돌렸다 —
    결과 `OK`(통과), `wasSuccessful: True`. docstring 의 "새 import 가 필요해지면 여기서 실패한다"
    는 주장은 거짓이다 — `__import__` 는 새 "import 문"이 아니라 함수 호출이라 이 설계가 잡는
    표면 밖에 있다.
  - 제안: (a) `ast.Call` 을 훑어 `func` 가 `Name(id='__import__')` 이거나
    `Attribute(attr='import_module')`(importlib 경유) 인 호출 자체를 금지 항목으로 추가한다.
    (b) 더 근본적으로, 호출 쪽 검사를 "금지 목록"에서 "허용 목록"으로 뒤집는다 — import 쪽은
    이미 그렇게 해서 이번 우회를 막았는데 호출 쪽(`for banned in (...)`)은 여전히 예전에 이미
    한 번 폐기된 것과 같은 금지목록 설계로 남아 있다. 이 파일 자신의 docstring 이 "금지 목록은
    우회를 상상하는 만큼만 강하다"고 결론지었는데, 그 결론을 import 에만 적용하고 호출에는
    적용하지 않은 것이 이번 구멍의 근본 원인이다.

- **[WARNING]** 같은 `OneJudgeTest` 의 호출 금지목록이 `os` 모듈 안에서도 불완전 — `os.popen`/
  `os.system` 등은 애초에 목록에 없어 셸을 통한 트리 순회/파일 읽기가 잡히지 않는다.
  - 위치: `.claude/tests/test_review_gate_ci.py:278`
  - 상세: `os` 는 허용된 import 다(스크립트가 `os.path.join` 등에 실제로 쓴다). 금지 대상은
    `os.walk`/`os.scandir`/`os.listdir`/`open` 딱 4개뿐이라, `os.popen(f"find {root}/review -name SUMMARY.md ...")`
    처럼 셸을 경유해 리뷰 산출물 트리를 스스로 훑는 코드는 새 import 없이(`os` 는 이미 허용됨)
    통과한다. 실측: 이 호출을 담은 스크립트로 실제 `OneJudgeTest` 를 그대로 돌렸다 — `OK`
    (통과). "리뷰 산출물을 스스로 읽으면 그것이 두 번째 판정자다"라는 이 테스트의 명시적 목적이
    `os.popen`/`os.system`/`os.spawn*`/`os.posix_spawn` 앞에서는 성립하지 않는다.
  - 제안: 위 CRITICAL 과 같은 근본 처방(호출도 허용목록화)으로 자연히 닫힌다. 임시 처방만
    원하면 `os.popen`/`os.system`/`os.spawn*` 를 금지 목록에 추가하되, 이는 "상상 가능한 만큼만
    강한" 임시방편이라는 것을 이 파일 자신의 docstring 이 이미 경고하고 있다.

- **[WARNING]** `WorkflowWiringTest.test_a_step_actually_runs_the_script` 가 "구조로 판정한다 —
  substring 이 아니라"고 주장하지만, `run:` 스텝 **본문 텍스트** 안에서는 여전히 substring
  검사라 실행 없이 경로만 언급하는 주석으로 통과시킬 수 있다.
  - 위치: `.claude/tests/test_review_gate_ci.py:327-332`
  - 상세: 1차 라운드의 우회 (a)(`if:` 삭제 후 같은 문자열을 `env:` 에 남김) / (b)(`run:` 을
    `true` 로 교체)는 이번 라운드에서 `if`/`run` 키를 YAML 트리에서 직접 읽는 구조적 검사로
    막혔다(확인함 — `run:` 을 `true` 로 바꾸면 `_run_commands()` 결과가 `["true"]` 뿐이라
    substring 매치 자체가 실패한다). 그런데 `run:` 값 자체가 **여러 줄 셸 스크립트**일 때는 그
    안의 주석 줄도 여전히 같은 문자열 텍스트다. `.github/workflows/review-gate.yml` 형태를 본떠
    ```yaml
    run: |
      # NOTE: scripts/check-review-gate.py 는 이 스텝에서 실행되지 않는다 (일부러 비활성화)
      echo "temporarily disabled"
    ```
    로 바꾼 워크플로 파일을 만들어 실제 `WorkflowWiringTest.test_a_step_actually_runs_the_script`
    를(`_harness.REPO_ROOT` 를 그 임시 루트로 바꿔) 그대로 돌렸다 — `OK`(통과). 즉 스크립트가
    실제로는 전혀 실행되지 않는데 이 테스트는 "실행된다"고 판정한다. 1차 라운드가 고친 것은
    "문자열이 파일의 어느 **키**에 있는가"였고, 이번에 남은 것은 "문자열이 그 키의 값
    (셸 스크립트) 안에서 **주석인가 명령인가**"라 같은 클래스의 한 단계 더 안쪽 반복이다.
  - 제안: `run:` 값에서 `#` 로 시작하는 줄(따옴표 안이 아닌)을 제거한 뒤 검사하거나, 최소한
    각 줄을 개별 처리해 "주석이 아닌 줄에 해당 경로가 명령으로 나타나는지"를 확인한다.
    `test_e2e_exemption_paths_sync.py`/`test_harness_checks_paths_coverage.py` 가 이미
    inline-comment vs 실제 값을 구분하는 파서를 갖고 있으니 그 패턴을 재사용할 수 있다.

- **[INFO]** `test_the_default_root_resolves_to_this_repository` 는 이 파일에서 유일하게
  임시 저장소가 아니라 **실제 저장소**를 대상으로 진짜 `evaluate_review()` 를 실행한다.
  - 위치: `.claude/tests/test_review_gate_ci.py:144-162`
  - 상세: `--root` 를 넘기지 않고 `cwd=str(_harness.REPO_ROOT)` 로만 서브프로세스를 띄우므로,
    스크립트는 `_ROOT_DEFAULT`(자기 파일 위치 두 단계 위 — 실제 저장소 루트)를 쓴다. 이는
    README 의 컨벤션("git-backed 헬퍼를 patch 해 테스트를 hermetic 하게 유지")의 명시적
    예외이고 docstring 도 그 이유를 밝힌다(디폴트 루트 계산 자체가 한 번도 실행 안 되는 것을
    막기 위해). 실제 위험 여부를 코드로 추적: `evaluate_review` 가 거치는 `_run_git` 은 실패를
    삼켜 `rc=1` 로 반환하고(`review_guard.py:206-216`), `_merge_base`/`_default_branch` 도
    실패 시 `None` 을 반환할 뿐 예외를 던지지 않는다(`review_guard.py:227-247`) — 그래서
    `harness-checks.yml`(이 워크플로는 `fetch-depth: 0` 이 **없어** shallow clone)에서 이
    테스트가 돌아도 "예외를 던졌습니다" 문자열이 stderr 에 찍힐 경로는 없다. 또한
    `review_guard` 의 모든 파일 열기는 `"r"` 모드뿐이라(`grep` 확인 완료) 실제 저장소에 쓰기는
    없다. 즉 **관측 가능한 side effect 는 없다** — 다만 이 파일에서 유일하게 "hermetic 하지
    않은 테스트"라는 사실 자체는 기록해 둘 가치가 있다(다음에 이 함수 근처를 고치는 사람이
    "왜 이것만 tempdir 을 안 쓰지"라고 물을 근거).
  - 제안: 조치 불필요. docstring 에 위 결론("shallow clone 에서도 예외 경로 없음, 확인됨")을
    한 줄 보강하면 다음 리뷰에서 같은 질문이 반복되지 않는다.

- **[INFO]** `harness-checks.yml` 이 이번에 처음으로 **네트워크 설치 스텝**(`pip install
  "pyyaml>=6,<7"`)을 유닛테스트 실행 스텝보다 앞에 얹었다 — 이전까지 "표준 라이브러리만" 이던
  파이프라인이 PyPI 가용성에 의존하게 됐다.
  - 위치: `.github/workflows/harness-checks.yml:84-85`
  - 상세: 설치 스텝은 "Run harness unit tests"(27개 `test_*.py` 전체)보다 **먼저** 실행된다.
    PyYAML 이 필요한 곳은 `test_override_floors.py`/`test_workflow_yaml_structure.py` 단 둘뿐인데,
    설치가 이 순서에 있으므로 PyPI 순단이나 pip 레지스트리 이슈가 나면 YAML 과 무관한 나머지
    25개 테스트 파일까지 전부 "harness-checks" job 실패로 묶인다 — 이전에는 없던 새 실패
    모드다. `README.md`/워크플로 주석 둘 다 `deps-security-checks.yml` 의 기존 패턴을 재사용한
    것이라 밝히고 있어 의도된 트레이드오프이지 이번 PR 이 발명한 리스크는 아니지만, "제로
    서드파티 의존" 이던 파이프라인의 실패 표면이 넓어졌다는 사실은 side-effect 관점에서
    기록해 둘 가치가 있다.
  - 제안: 조치 불필요(이미 실측·문서화된 트레이드오프). 다만 pip 설치 실패를 별도 스텝으로
    분리해 "YAML 가드 실패"와 "네트워크/설치 실패"를 CI 로그에서 구분 가능하게 하면 향후
    트리아지가 빨라진다(선택 사항).

## 그 외 확인한 항목(문제 없음)

- `review-gate.yml` 은 `permissions: contents: read` 를 명시해 신규 워크플로인데도 쓰기 권한을
  요구하지 않는다 — PR 코멘트/체크 작성 등 예상 밖 부작용 표면이 없다. `pull_request`(●아님
  `pull_request_target`) 트리거라 fork PR 에 시크릿이 노출되지도 않는다.
- `evaluate_review()` 시그니처(`cwd=None, *, in_flight_ok=False`)를 CI 스크립트가
  위치 인자 `evaluate(root)` 하나로만 호출한다 — `in_flight_ok` 는 기본값(`False`, hard-gate)을
  그대로 쓰므로 push 가드와 동일한 엄격도이고, Stop 가드 전용 완화가 CI 로 새지 않는다.
  실제 함수 정의(`review_guard.py:942-943`)와 대조해 확인.
- `.claude/tests/test_review_gate_ci.py` 의 나머지 테스트는 전부 `tempfile.mkdtemp()` +
  `addCleanup(shutil.rmtree, ...)` 로 격리된 임시 git repo 를 쓰고, `_git()` 이 `GIT_CONFIG_GLOBAL`
  /`GIT_CONFIG_SYSTEM` 을 `/dev/null` 로 돌려 사용자 전역 git 설정에서도 격리된다 — 실제
  저장소나 사용자 환경에 쓰기 부작용 없음.
- `check-review-gate.py` 자체(`_load_gate`/`main`)는 `sys.path` 에 경로 하나만 얹고
  `review_guard.evaluate_review` 를 부른 뒤 stdout/stderr 에 출력, 반환코드만 결정한다 —
  스크립트 자신의 파일시스템 쓰기/환경변수 쓰기/네트워크 호출 없음.

## 요약

이번 라운드에 새로 추가된 CI 백스톱 자체(`check-review-gate.py`, `review-gate.yml`)는 읽기
전용·최소 권한·fail-open 으로 설계돼 있어 부작용 표면이 작다. 그러나 이 계층의 안전성 전체가
의존하는 핵심 불변식 — "판정자는 하나(`review_guard.evaluate_review`)이고 스크립트가 재구현하지
않는다" — 을 지키는 `OneJudgeTest` 가드는, 이미 세 번 우회된 전례가 있는 바로 그 이유(금지 목록은
상상한 만큼만 강하다)로 이번에도 뚫린다: `__import__()` 동적 임포트는 정적 import 노드 기반의
허용목록과 정적 alias 기반의 호출 금지목록 양쪽을 모두 벗어나며, 실제 테스트 클래스를 로드해
`__import__("subprocess")` + `os.popen` 두 가지 뮤턴트로 확인했다(둘 다 `OK`). `WorkflowWiringTest`
도 "구조로 판정한다"고 선언한 지점(스텝 실행 여부)에서 여전히 `run:` 본문 텍스트에 대한 substring
검사로 남아, 실행하지 않는 주석으로 통과시킬 수 있음을 실측했다. 현재 시점에 실제 스크립트가
이런 우회를 담고 있지는 않으므로 당장 활성 결함은 아니지만, 이 가드들이 지키려는 성질이 미래의
"편의상 subprocess 로 한 번 더 확인해보자" 류 패치를 전혀 막지 못한다는 점에서 방어선으로서는
신뢰도가 낮다 — 정확히 이 PR 의 라운드 1 리뷰가 지적한 패턴의 재발이다.

## 위험도

HIGH
