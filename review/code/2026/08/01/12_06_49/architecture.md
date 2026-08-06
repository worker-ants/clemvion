# 아키텍처(Architecture) Review

## 방법 및 검증 절차 (요청에 따른 실측)

각 가드/테스트에 대해 "주장하는 성질"을 먼저 명시한 뒤, 그 성질이 실제로는 거짓이면서 테스트는 GREEN 인 최소 프로그램을 별도 스크래치 디렉터리(`/private/tmp/.../scratchpad/gatecheck/`)에서 구성해 실행했다. **작업 트리는 건드리지 않았다** — 종료 시 `git status --porcelain=v1` 확인 결과 `review/code/2026/08/01/12_06_49/`(이 리뷰 세션 산출물 디렉터리) 외 변경 없음.

- `scripts/check-review-gate.py` 를 스크래치로 복사(`original.py`) 후, `OneJudgeTest.test_the_script_performs_no_judgement_operations_of_its_own` 의 AST 검사 로직을 그대로 추출한 독립 스크립트(`run_one_judge_check.py`)를 작성해 원본/뮤턴트에 동일 조건으로 실행.
- `test_it_is_still_observation_only` 의 문자열/치환 검사는 순수 Python 로 재현.
- `test_the_job_condition_exempts_dependabot` 의 `assertRegex` 는 순수 Python `re.search` 로 재현.

## 발견사항

- **[CRITICAL]** `OneJudgeTest`(허용 import + 허용 호출 목록 정적분석)는 **호출(Call)과 import 축만** 검사하고 **대입(Assign)·비교(Compare)·불리언(BoolOp) 축은 전혀 검사하지 않는다** — "판정 로직을 스크립트가 새로 갖지 않는다"는 이 파일의 핵심 불변식을 새 import·새 호출 없이 깰 수 있다.
  - 위치: `.claude/tests/test_review_gate_ci.py:220-327` (`class OneJudgeTest`, 특히 `test_the_script_performs_no_judgement_operations_of_its_own`, `253-327`행) — 실제 공격 표면은 `scripts/check-review-gate.py:97-102`(`main()` 내 `decision = evaluate(root)` 직후 블록).
  - 상세: 실측으로 두 가지 뮤턴트를 만들어 재현했다.
    1. **가장 싼 버전**: `decision = evaluate(root)` 바로 다음 줄에 `decision.blocked = False` 한 줄 추가. 새 import 0개, 새 호출 0개(Attribute 대입은 `ast.Assign`의 target 이 `ast.Attribute`인 경우이고, 테스트의 로컬-별칭 추적 루프는 `target`이 `ast.Name`인 경우만 다루며, 호출 검사 루프는 `ast.Call` 노드만 순회한다 — 그래서 이 라인은 두 루프 어디에도 걸리지 않는다).
    2. **조건부 버전**: `if "테스트" in reason or os.environ["CI_QUIET_GATE"]: blocked = False`. `in` 비교와 `os.environ[...]` 서브스크립트는 `ast.Compare`/`ast.Subscript`이지 `ast.Call`이 아니므로 역시 호출-축 검사에 걸리지 않는다.
    실행 결과(둘 다 동일):
    ```
    $ python3 run_one_judge_check.py mutant_cheapest.py
    mutant_cheapest.py: ALL ASSERTIONS PASSED (OneJudgeTest would be GREEN)
    ```
    행동 차이도 실측: `decision.blocked = True`(게이트가 실제로 미커버라고 판정)인데 뮤턴트를 거치면 `blocked = False`로 뒤집힘 —
    ```
    real decision.blocked = True  -> script's effective blocked = False
    ```
    이 파일의 docstring 은 이미 이 가드가 "네 번 뚫렸다"(전체 grep → prose-제외 grep → 연산 금지목록 → import+호출 허용목록)고 기록하는데, 이번이 **다섯 번째**다 — 매번 "상상한 우회 채널만 막는다"는 같은 구조적 실패가 반복된다. 이번 채널은 함수 호출도 import 도 아닌, **로컬 변수 재대입/속성 대입/비교 연산** — Python 에서 판정을 표현하는 데 함수 호출이 전혀 필요 없다는 사실이 그대로 노출된 것이다.
  - 제안: 허용/금지 "연산 종류" 목록을 아무리 늘려도 같은 게임이 반복된다(README 자신의 통찰: "금지 목록은 우회를 상상하는 만큼만 강하다" — 이번엔 허용 목록으로 뒤집었지만 축이 여전히 "무엇을 하는가"라서 같은 함정). 근본 해법은 두 가지 중 하나: (a) `main()` 이 `decision = evaluate(root)` 이후 `decision.blocked`/`decision.reason`/`decision.notes` 를 **그 자리에서 읽어 곧바로 print 하고 반환하는 것 외에 아무 것도 하지 않는지**를 스크립트 텍스트 자체의 golden/구조 diff 로 고정(허용된 몇 줄의 정확한 시퀀스를 통째로 비교) — 화이트리스트를 "연산"이 아니라 "코드 형태"로 옮긴다; (b) 최소한 이번 라운드에서 드러난 두 채널(Attribute 대입 타깃, Call 이 아닌 Compare/BoolOp/Subscript 로 decision 필드에 영향을 주는 지역 변수 재정의)을 추가로 금지하는 축을 넣는다. (a)가 이 클래스의 반복을 구조적으로 끝낸다.

- **[WARNING]** `test_it_is_still_observation_only`(review-gate.yml 의 `run:` 이 `--enforce` 를 쓰지 않음을 고정)는 **셸 인접 따옴표 결합**으로 우회 가능 — 리터럴 substring 검사와 `$`/`${{` 검사를 모두 통과하면서 실행 시점에는 `--enforce` 가 전달된다.
  - 위치: `.claude/tests/test_review_gate_ci.py:430-454`(`test_it_is_still_observation_only`) — 대상 `.github/workflows/review-gate.yml:74`(`run: python3 scripts/check-review-gate.py`).
  - 상세: 실측.
    ```
    $ bash -c 'printf "%s\n" python3 scripts/check-review-gate.py --enfor""ce'
    python3
    scripts/check-review-gate.py
    --enforce
    ```
    ```python
    cmd = 'python3 scripts/check-review-gate.py --enfor""ce'
    "--enforce" in cmd   # False
    "$" in cmd           # False
    "${{" in cmd         # False
    ```
    즉 `run: python3 scripts/check-review-gate.py --enfor""ce` 로 워크플로를 고치면 (1) `assertNotIn("--enforce", cmd)` 통과, (2) `$`/`${{` 부재 검사 통과, (3) `_env_values()` 에도 `--enforce` 문자열이 없으므로 전부 통과하지만, bash 는 인접한 빈 따옴표를 같은 단어로 결합해 실제 인자는 정확히 `--enforce` 하나가 된다(재확인: `subprocess` 로 실제 argv 캡처 → `['--enforce']`). 이 테스트의 docstring 은 정확히 "리터럴만 보면 안 된다"는 교훈을 `if:`→`env:` 우회에 대해서만 반영했고, `run:` 문자열 자체 내부의 셸 인용부호 결합은 다루지 않는다 — 같은 파일의 `OneJudgeTest`가 이미 겪은 "문자열이 어디 있는지가 아니라 결과가 무엇인지를 봐야 한다"는 교훈이 이 테스트에는 아직 닿지 않았다.
  - 제안: `run:` 문자열을 `shlex.split()`으로 실제 셸 토큰화한 뒤 파싱된 인자 리스트에 `"--enforce"`가 있는지로 판정(리터럴 substring 대신). 최소 조치로는 인접 따옴표 결합(`""`, `''`, `\` 이스케이프) 패턴을 검출해 실패시키는 방어적 정규식을 추가.

- **[WARNING]** `test_the_job_condition_exempts_dependabot`는 `assertRegex`(부분일치)만 사용해, 의도한 "단일 부정 비교식"이 아니라 **다른 항상-참 조건과 `||`로 결합된** `if:` 도 통과시킨다 — 정확히 이 테스트의 docstring 이 스스로 "두 조각을 따로 보면 통과한다"고 경고한 것과 같은 급의 실패가 **결합 연산자 축**에서 재발한다.
  - 위치: `.claude/tests/test_review_gate_ci.py:392-402`(`test_the_job_condition_exempts_dependabot`) — 대상 `.github/workflows/review-gate.yml:51`(`if: github.actor != 'dependabot[bot]'`).
  - 상세: 실측.
    ```python
    pattern = r"github\.actor\s*!=\s*['\"]dependabot\[bot\]['\"]"
    cond = "github.actor != 'dependabot[bot]' || github.event_name == 'pull_request'"
    re.search(pattern, cond)   # truthy → 테스트 통과
    ```
    이 워크플로의 트리거가 `pull_request` 단일이므로 `github.event_name == 'pull_request'`는 이 워크플로 안에서 구조적으로 항상 참이다 — 즉 `if:` 전체가 항상 참이 되어 dependabot 면제가 실질적으로 무력화되는데 테스트는 여전히 GREEN. (영향은 "봇 PR 에도 게이트가 돈다"는 노이즈이며 현재는 관측 모드라 차단으로 이어지지 않는다 — 그래서 CRITICAL 이 아니라 WARNING — 그러나 `--enforce` 전환 후라면 봇 PR 이 실제로 차단되는 회귀로 승격된다.)
  - 제안: `assertRegex` 대신 `if:` 문자열 전체가 정확히 그 부정 비교 표현과 (공백 차이만 허용하고) **동치**인지 확인(`re.fullmatch` 또는 파싱 트리 비교), 또는 최소한 `||`/`or`/`&&`/`and` 로 다른 절과 결합되어 있지 않음을 별도로 단언.

- **[INFO]** `test_review_gate_ci.py`에 `_ALLOWED_IMPORTS` 클래스 속성이 **동일 내용으로 두 번** 선언돼 있다 — 편집 잔여물로 보이는 죽은 코드.
  - 위치: `.claude/tests/test_review_gate_ci.py:220-227`(224행과 227행, 둘 다 `_ALLOWED_IMPORTS = {"__future__", "argparse", "os", "sys", "review_guard"}`, 그 사이 223/226행도 같은 주석이 중복).
  - 상세: 기능적으로는 무해하다(같은 값 재대입). 그러나 향후 허용 목록을 넓힐 때 한쪽만 고치고 다른 쪽을 놓치는 조용한 drift 의 소재가 된다 — 이 세션이 반복해서 겪은 "한 인스턴스만 고치고 나머지는 남기는" 실패 패턴과 동일 클래스.
  - 제안: 중복 선언 제거.

- **[INFO]** `_lib` 네임스페이스 충돌(`.claude/hooks/_lib` vs `.claude/skills/_lib`) 회피용 `sys.path.insert` + bare-module `import review_guard` 패턴이 이번 PR 로 **세 번째 소비자**(`scripts/check-review-gate.py`)까지 확산됐다.
  - 위치: `scripts/check-review-gate.py:60-70`(`_ROOT_DEFAULT`, `_load_gate`).
  - 상세: `plan/in-progress/harness-review-gate-ci-backstop.md`가 이 근본 원인("hooks/skills 의 `_lib` 네임스페이스 충돌 해소가 선행")을 이미 별도 defer 항목으로 추적하고 있어 신규 발견은 아니지만, 이 PR 이 그 위에 세 번째 사본을 쌓아 표면을 넓혔다는 점은 기록할 가치가 있다. 각 소비자(테스트 하네스, 훅, 이제 CI 스크립트)가 독립적으로 "경로를 얹고 bare import" 를 반복하는 것은 결합도 관점에서 완전한 캡슐화가 아니라, 하나의 알려진 결함(패키지 네임스페이스 충돌)을 세 곳에서 개별적으로 우회하는 형태다.
  - 제안: plan 의 defer 항목대로 `_lib` 충돌 해소를 근본적으로 선행하되, 그 전까지는 이 우회 패턴 자체를 공용 헬퍼(`_shared/`)로 추출해 최소한 "우회 방법"만이라도 한 곳에서 관리할 것.

## 긍정적으로 확인된 설계 요소

- `scripts/check-review-gate.py`는 판정 로직을 전혀 갖지 않고 로컬 훅과 **동일한** `review_guard.evaluate_review()`를 그대로 호출한다 — `report_paths`/`retry_state`에서 이미 두 번 겪은 "로컬/CI 판정 drift" 실패 클래스를 원천적으로 피하는 좋은 설계다(SRP·SSOT 준수).
- fail-open(게이트 부재·예외 모두 exit 0) 과 관측 모드 기본값은 명확히 분리된 계약이고, `try` 블록이 호출뿐 아니라 반환값 읽기(`decision.blocked` 등)까지 감싸도록 되어 있어(주석이 그 이유를 명시) "게이트가 형태만 다른 값을 반환하면 AttributeError 로 CI 를 막는" 역전 실패를 실제로 막는다.
- `review-gate.yml`/`harness-checks.yml`의 `paths:` 목록은 "게이트 로직 자체를 고친 PR 은 그 게이트를 검증하는 워크플로도 반드시 트리거해야 한다"는 불변식을 (과거 6차례 실패로 학습한 대로) 명시적으로 나열해 지킨다 — 좋은 방어적 설계.

## 요약

이번 CI 백스톱(round 3)의 **기능 설계**는 견고하다: 판정 위임 단일화(SSOT), 관측 모드 기본값, fail-open, advisory 판정-무관 출력이라는 네 성질 모두 코드에 정확히 반영돼 있고 `review-gate.yml`/`harness-checks.yml`의 트리거 경로도 과거 6~7차례의 "파일 단독 수정 시 가드 미발동" 실패를 학습해 촘촘히 등재돼 있다. 그러나 그 설계를 **정적으로 강제하겠다는 새 가드 3종**(`OneJudgeTest`의 import+호출 허용목록, `test_it_is_still_observation_only`의 문자열/치환 검사, `test_the_job_condition_exempts_dependabot`의 정규식 검사)은 모두 실제로 우회 가능함을 이번 리뷰에서 실측으로 확인했다. 특히 `OneJudgeTest`는 이 파일의 docstring 이 스스로 "네 번 뚫렸다"고 기록한 패턴의 **다섯 번째 사례**를 낳았다 — 이번엔 함수 호출도 import 도 아닌 순수 대입/비교 축이었다. 이는 개별 버그라기보다, "가드가 감시하는 연산의 종류(화이트/블랙리스트)"라는 추상화 축 자체가 "판정 로직을 표현할 수 있는 모든 Python 구문"보다 항상 좁다는 구조적 한계이며, 이 저장소가 이미 여러 차례 도달한 결론(연산 목록화 대신 코드 형태 자체를 golden 으로 고정)을 다시 한번 뒷받침한다.

## 위험도

HIGH — `OneJudgeTest` 우회는 이 PR의 핵심 아키텍처 목표("판정자가 하나")를 정적으로는 강제하지 못함을 실측으로 반증하는 CRITICAL 급 결함이지만, 현재 `scripts/check-review-gate.py` 자체는 그 형태로 작성돼 있지 않고(활성 익스플로잇 아님) 게이트는 관측 모드라 blast radius 도 제한적이다. `--enforce` 전환 전에 위 발견사항(특히 OneJudgeTest·observation-only 우회)의 검출 축을 보강할 것을 권고한다.
