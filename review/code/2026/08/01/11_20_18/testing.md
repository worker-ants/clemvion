# 테스트(Testing) 리뷰 — harness-review-gate-ci-backstop (round 2)

방법론: 각 가드/테스트에 대해 "그 성질이 거짓인 채로 통과하려면 무엇이 필요한가"를 실제로
뮤테이션해서 실행했다(측정 우선, 추론 최소화). 모든 실험은 `scripts/check-review-gate.py`,
`.github/workflows/review-gate.yml`, `.claude/tests/test_review_gate_ci.py`를 백업 →
뮤테이션 → `python3 -m unittest ...` 실행 → `diff`로 원복 확인의 순서로 진행했고, 마지막에
`python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 전체(827 tests, OK)와
`git status`/`git diff`로 저장소가 실험 이전 상태(사전 존재하던 미커밋 prose diff 1건만 남은
상태)로 정확히 복원됐음을 확인했다.

## 발견사항

- **[CRITICAL]** `OneJudgeTest`의 "판정자가 하나다" 가드가 동적 디스패치로 완전히 우회된다 —
  실제로 `os.walk`를 실행하면서 두 검사(허용된 import 목록 / banned-call 스캔)를 모두 통과.
  - 위치: `.claude/tests/test_review_gate_ci.py:223-226`(`_ALLOWED_IMPORTS`,
    `test_the_script_performs_no_judgement_operations_of_its_own`), 호출 탐지 로직은
    `.claude/tests/test_review_gate_ci.py:269-288`(특히 `276`의 `ast.Attribute`/`ast.Name`
    분기와 `279`의 `for banned in (...)`).
  - 상세: 이 테스트는 라운드 1에서 "허용 목록도 우회됐다"는 두 사례(`pathlib.Path(...).rglob`,
    `from os import walk as _w`)를 막도록 재작성된 버전이다. 실측으로 그 두 사례는 **여전히
    정확히 막힌다** — `import pathlib`을 추가하면 `허용되지 않은 import: ['pathlib']`로 즉시
    FAIL, `from os import walk as _w`로 별칭을 줘도 `alias_of` 역참조 덕에 `os.walk`로 정규화돼
    FAIL(둘 다 직접 재현·확인함). 그러나 세 번째 패턴 — **호출 대상 자체를 표현식으로 구성**해서
    `ast.Name`도 `ast.Attribute(value=ast.Name)`도 아니게 만드는 것 — 은 통과한다.
    `scripts/check-review-gate.py`의 `_load_gate` 안에
    `for _d, _dd, _ff in getattr(__import__('os'), 'walk')('/tmp'): break`를 삽입하고
    `OneJudgeTest`만 단독 실행하면 **OK**(FAIL 없음)가 나온다. 이유: `__import__('os')`는
    `ast.Import`/`ast.ImportFrom` 노드가 아니라 **builtin 함수 호출**이라 import 허용 목록
    검사에 애초에 걸리지 않고, 바깥 `Call`의 `func`는 `getattr(...)`라는 **또 다른 Call**이라
    `isinstance(f, ast.Name)`도 `isinstance(f, ast.Attribute) and isinstance(f.value, ast.Name)`도
    거짓이 되어 `called` 집합에 아무것도 안 남는다. 동시에 `test_review_gate_ci.py` 파일 전체
    15개 테스트(`ReviewGateCliTest` 포함)도 전부 OK로 남아, 이 삽입이 스크립트의 실제 동작(정상
    실행)도 깨지 않았음을 확인했다 — 즉 이 우회는 "테스트가 어쩌다 못 잡은 죽은 코드"가 아니라
    "살아서 실행되는 두 번째 판정 경로가 조용히 통과"하는 사례다.
  - 이 클래스는 `getattr(os, 'scandir')(...)`, `vars(os)['listdir'](...)`,
    `os.__dict__['walk']`, `eval("os.walk")(...)` 등으로 얼마든지 재생산된다 — 금지
    목록에서 허용 목록으로 바꾼 라운드 1의 교훈("금지 목록은 우회를 상상하는 만큼만 강하다")이
    **호출 표현식의 형태**에도 그대로 적용된다는 뜻이다. 허용 목록 자체는 견고하지만, "호출을
    찾아내는 방법"이 `ast.Name`/`ast.Attribute(Name)` 두 형태만 인식해 표현식 기반 간접 호출
    전부가 사각지대다.
  - 제안: 두 갈래 모두 방어할 필요는 없고, **하나만 있어도 충분**하다 — (a) `ast.Call`의
    `func`가 `ast.Name`/`ast.Attribute(value=ast.Name)` 둘 중 하나가 **아닌 경우 자체를 즉시
    실패**시킨다("판정할 수 없는 형태의 호출이 있다 = 의심스러운 코드"), 또는 (b) `getattr`/
    `__import__`/`eval`/`exec`/`vars`/`globals`를 허용된 이름 집합에 넣고 **그 이름들 자체가
    호출되는 것 자체를 금지**한다(builtin 호출이라 import 검사망 밖에 있으므로 별도 규칙 필요).
    두 접근 다 "화이트리스트가 커버 못 하는 새 형태가 나오면 여기서 실패" 라는 현재 설계 철학과
    일치한다.

- **[CRITICAL]** `test_it_is_still_observation_only`가 라운드 1에서 이미 고친 것과 **동일한
  치환 클래스**(`if:`를 지우고 같은 문자열을 `env:`에 남기는 것)로 재현 가능하다 — 단 대상이
  `if:` 조건이 아니라 `run:` 안의 `--enforce` 플래그다.
  - 위치: `.claude/tests/test_review_gate_ci.py:368-374`
    (`test_it_is_still_observation_only`, 특히 `374`의
    `self.assertNotIn("--enforce", cmd)`). 대비되는 대상은 같은 파일 `335-340`의
    `test_the_job_condition_exempts_dependabot` — 이쪽은 정확히 이 클래스를 막도록
    고쳐졌음을 아래에서 확인했다.
  - 상세(실측): `.github/workflows/review-gate.yml`의 마지막 step을
    ```yaml
    - name: Review coverage backstop
      env:
        GATE_FLAG: --enforce
      run: python3 scripts/check-review-gate.py $GATE_FLAG
    ```
    로 치환하고(백업 후 복원까지 확인) `WorkflowWiringTest`를 실행하면
    `test_it_is_still_observation_only`와 `test_a_step_actually_runs_the_script` 둘 다
    **OK**를 낸다. `_run_commands()`는 `run:` 필드의 리터럴 문자열만 보고, `env:`로 넘어간
    값이나 GitHub Actions가 셸에 넘기기 직전 치환하는 `$GATE_FLAG`는 보지 않기 때문이다.
    그런데 이 워크플로가 실제 GitHub Actions에서 돈다면 `env:`가 프로세스 환경변수로
    export 되고 bash가 `$GATE_FLAG`를 `--enforce`로 치환하므로, **실제 동작은 하드 차단으로
    뒤집힌다** — 딱 이 테스트가 막으려는 그 계약 변경이 조용히 일어난다.
  - 대조 확인(같은 클래스가 다른 테스트에서는 이미 닫혀 있음, 회귀 아님을 확인하기 위해
    실행): `if: github.actor != 'dependabot[bot]'`를 지우고 같은 문자열을
    `env:\n  NOTE: "github.actor != 'dependabot[bot]'"`로 옮기면
    `test_the_job_condition_exempts_dependabot`이 정확히 FAIL한다
    (`AssertionError: 'dependabot[bot]' not found in ''`). 즉 라운드 1이 지적한 결함
    클래스는 **한 곳(dependabot 면제)에서는 제대로 닫혔지만 다른 한 곳(`--enforce` 관측
    모드)에서는 같은 파일 안에서 대칭적으로 닫히지 않았다**.
  - `run:`을 완전한 no-op(`run: "true"`)으로 바꾸는 라운드 1의 또 다른 우회는 —
    `test_a_step_actually_runs_the_script`가 정확히 잡는 것을 별도로 확인했다
    (`AssertionError: False is not true : 어느 step 도 스크립트를 실행하지 않는다:
    [..., 'true']`) — 이 항목은 회귀가 아니라 정상 작동 확인.
  - 제안: `test_it_is_still_observation_only`도 `job["steps"]`의 `env:` 값까지 함께
    스캔하거나(가장 간단), 혹은 그 step의 `run:` 문자열에 `${{`/`$`로 시작하는 미해석
    참조가 있으면 그 자체를 실패시켜 "리터럴이 아닌 값으로 플래그를 조립하는 것" 자체를
    금지한다. `test_the_job_condition_exempts_dependabot`이 이미 `if:` 필드 하나만 보는
    것으로 충분했던 이유는 `if:`가 GH Actions에서 셸 치환을 거치지 않는 표현식 슬롯이라
    "그 자리인지"만 확인하면 됐기 때문이고, `run:`은 셸이 한 번 더 해석하므로 같은 전략이
    통하지 않는다 — 이 비대칭이 이번 결함의 근본 원인이다.

- **[WARNING]** `test_review_gate_ci.py`가 근거로 삼는 교차 파일 안전망
  `PlanStubsMirrorTheRealInterfaceTest.test_every_plan_stub_defines_push_blocks`
  (`.claude/tests/test_block_integrity.py:653-689`)가 **파일 단위 집계**라서, 이번처럼 한
  파일에 stub이 두 개 이상 있을 때 하나만 `push_blocks`를 가져도 통과한다.
  - 위치: `.claude/tests/test_review_gate_ci.py:174`(`test_a_gate_that_raises_does_not_fail_ci`
    의 `_R` stub, `push_blocks` 보유)과 `:191`(`test_notes_are_printed_on_both_verdicts`의
    `_D` stub, `push_blocks` 보유) — 그리고 `:179-181`의 주석("스텁이 진짜 인터페이스를 그대로
    비추게 두는 편이 낫다... #1057 의 가드가 강제"), 가드 본체는
    `.claude/tests/test_block_integrity.py:653-689`(특히 `675`의 `stubs = [...]`와
    `684-685`의 `self.assertIn("push_blocks", "".join(stubs), ...)`).
  - 상세(실측): `_R` stub에서 `push_blocks = False` 줄만 제거하고
    `test_block_integrity.PlanStubsMirrorTheRealInterfaceTest`를 실행하면 여전히 **OK**다.
    이유는 가드가 "`def evaluate_review`를 담은 문자열 리터럴을 파일에서 **전부 모아 join한
    뒤** 그 안에 `push_blocks`가 있는지"만 본다는 점 — 이 파일에는 그런 리터럴이 두 개
    있고, 하나(`_D`)가 여전히 `push_blocks`를 갖고 있어 다른 하나(`_R`)가 잃어도 집계
    문자열엔 남아있다. `test_block_integrity.py`의 그 클래스 docstring 자체가 "두 번,
    같은 방식으로 발견됐다"고 적어 둔 실패 클래스가, 이번엔 **한 파일 내 stub이 여럿인
    경우**라는 세 번째 변주로 재발할 수 있는 구조다.
  - 참고로 이번 결함은 오늘 당장 위험하지 않다 — `scripts/check-review-gate.py`는
    `decision.push_blocks`를 읽지 않고 `decision.blocked`/`.reason`/`.notes`만 읽으므로
    (주석에도 명시), `_R` stub이 `push_blocks`를 잃어도 `AttributeError`가 실제로 발생하진
    않는다. 하지만 이 파일의 주석이 그 가드를 근거로 "매번 판단하는 것보다 싸다"고 명시적으로
    의존을 선언한 이상, 그 가드가 실제로는 파일-단위 OR 판정이라는 사실은 이 리뷰 코멘트를
    반증하는 결과다.
  - 제안: `test_block_integrity.py`의 `stubs` 수집을 **stub 리터럴 단위**(현재처럼 파일
    전체 join이 아니라, 마커를 포함하는 각 개별 `ast.Constant` 문자열마다)로 바꿔 개별
    검사하면 이 클래스가 닫힌다.

- **[INFO]** `test_the_default_root_resolves_to_this_repository`
  (`.claude/tests/test_review_gate_ci.py:144-162`)는 자신의 docstring이 말하는 "CI 가 매번
  쓰는 바로 그 경로"를 **경로 계산**에서만 검증하고 **저장소 형태**(shallow vs full checkout)
  에서는 검증하지 않는다. 이 스위트 자체를 돌리는 `harness-checks.yml`의 `actions/checkout@v7`
  step은 `fetch-depth`를 지정하지 않아(기본 shallow, depth 1) 이 스위트를 실행하는 실제 CI
  환경은 이 테스트가 부르는 로컬 개발자 클론(보통 full)과 저장소 형태가 다르다 — 반면
  `review-gate.yml`은 명시적으로 `fetch-depth: 0`을 쓴다(`.github/workflows/review-gate.yml:56-57`).
  코드를 읽어 확인한 바로는 `review_guard._default_branch`/`_merge_base`가 모든 git 호출을
  `_run_git`의 반환코드로만 판단하고 실패 시 예외를 던지지 않도록 설계돼 있어(`review_guard.py:227-250`),
  이 비대칭이 오늘 당장 `test_the_default_root_resolves_to_this_repository`를 CI에서만 깨뜨릴
  가능성은 낮아 보인다 — 다만 이건 코드를 읽어 도출한 결론이지 실제 shallow clone으로 재현
  측정한 것은 아니라서, 확신도는 위 두 CRITICAL 항목보다 낮다.

## 확인된 정상 동작 (참고용, 발견사항 아님)

라운드 1이 "가장 날카로웠다"고 지목한 두 우회는 **현재 코드에서 정확히 막힌다**는 것을 직접
재현해 확인했다:
- `if:`를 지우고 같은 문자열을 `env:`에 남기는 우회 → `test_the_job_condition_exempts_dependabot`
  FAIL (정상).
- `run:`을 `true`로 바꾸는 우회 → `test_a_step_actually_runs_the_script` FAIL (정상).
- `OneJudgeTest`의 두 역사적 우회(`pathlib.Path(...).rglob`, `from os import walk as _w`)도
  둘 다 FAIL (정상) — 세 번째 시도(동적 디스패치, 위 CRITICAL 항목)만 뚫린다.

## 그 외 관점 (8개 체크리스트 요약)

- **테스트 존재/커버리지**: `check-review-gate.py`(120줄)에 대해 15개 테스트로 관측/enforce/
  fail-open/advisory/판정자-단일성/워크플로 배선까지 폭넓게 커버 — 신규 CI 스크립트치고 이례적으로
  두텁다.
- **엣지 케이스**: 게이트 모듈 부재, 게이트 예외, 미완료 리뷰 세션(`meta.json`만 존재), 해결된
  리뷰, `--root` 기본값 등 핵심 경계가 모두 개별 테스트로 고정돼 있음.
- **Mock 적절성**: git을 목으로 대체하지 않고 실제 `git init` 임시 저장소 + 실제 훅 파일
  `copytree`를 사용 — 이 저장소 컨벤션(`README.md` "Conventions for new tests")과 일치하며
  실동작과의 괴리가 작다. stub 인터페이스(`push_blocks`)를 실제 형태로 유지하려는 의도적
  설계도 확인(다만 그 보증 메커니즘 자체는 위 WARNING 참고).
- **테스트 격리**: 각 테스트가 독립 `tempfile.mkdtemp()` + `addCleanup(shutil.rmtree)`를
  쓰고, 스크립트는 서브프로세스로 구동돼 `sys.path` 오염이 없음. 전역 상태 공유 없음 — 실행
  순서를 바꿔도(unittest 기본은 알파벳순) 문제없이 통과함을 전체 스위트 실행으로 확인.
- **가독성**: 각 테스트 docstring이 "왜 이 테스트가 존재하는가"를 방어 대상 결함까지
  구체적으로 서술 — 이 저장소의 확립된 컨벤션과 일치, 가독성 우수.
- **회귀 테스트**: 전체 하네스 스위트 827개 테스트가 실험 전후로 모두 OK — 이번 6개 파일이
  기존 회귀를 깨지 않음.
- **테스트 용이성**: `check-review-gate.py`는 `--root` 인자로 저장소 루트를 주입받을 수 있어
  테스트 더블 없이도 격리된 임시 저장소를 대상으로 실행 가능 — 의존성 주입이 잘 되어 있음.

## 요약

새 CI 백스톱(`scripts/check-review-gate.py` + `review-gate.yml`)의 행동 커버리지는 두텁고,
라운드 1이 "가장 날카로웠다"고 지목한 두 개의 구체적 우회(`if:`→`env:` 치환,
`run:`→`true` 치환)는 실제로 재현 시도했을 때 현재 테스트가 정확히 잡아낸다 — 그 부분은
제대로 고쳐졌다. 그러나 같은 "리터럴/이름만 본다"는 근본 한계가 아직 두 곳에 남아 있고, 둘 다
실제로 뮤테이션해서 관측 안 됨(=거짓인데 GREEN)을 확인했다: (1) `OneJudgeTest`는 `getattr`/
`__import__` 같은 표현식 기반 간접 호출로 실제 `os.walk` 실행을 완전히 숨길 수 있고, (2)
`test_it_is_still_observation_only`는 `--enforce`를 `env:` 변수로 감싸면 워크플로가 실제로는
하드 차단으로 뒤집혀도 여전히 GREEN이다 — 이는 같은 파일에서 대칭적으로 이미 고친 dependabot
`if:` 케이스와 정확히 같은 결함 클래스이므로 특히 눈에 띈다. 부가로, 이번 파일이 명시적으로
근거로 삼은 교차 파일 가드(`test_block_integrity.py`의 stub-interface 보증)도 파일-단위 집계
때문에 다중 stub 파일에서 개별 stub 하나의 결손을 놓칠 수 있음을 확인했다(오늘 당장은 무해).
세 항목 모두 "그 이름이 약속하는 성질"과 "그 코드가 실제로 검증하는 것" 사이의 간극이며, 정확히
이 라운드가 요구한 "통과 조건을 반증해보라"는 지시로 찾아낸 것들이다.

## 위험도

HIGH
