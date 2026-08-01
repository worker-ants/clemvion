# Requirement Review — `harness-review-gate-ci-backstop` (round 2)

## 방법 (measurement, not just inspection)

프롬프트 6개 파일을 전부 Read 한 뒤, 각 가드/테스트에 대해 "그 성질이 거짓인데도 통과하려면
무엇이 필요한가"를 실제로 코드로 만들어 실행했다. 실행한 것들:

1. `OneJudgeTest`의 AST 허용목록/금지목록 로직을 그대로 복제해, `__import__('os').walk(...)`,
   `getattr(os, 'walk')(...)`, `eval("...")`, 그리고 **`os.path.isdir/getmtime` 2단 속성 체인**
   4가지를 스크래치 스크립트로 판정 — 전부 결과 확인.
2. `test_it_is_still_observation_only`의 `run:` substring 검사를 스크래치 YAML(`env:` 경유로
   `--enforce`를 숨기는 변형)에 대해 PyYAML 로 재현 실행.
3. `python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v`를 실제
   레포에서 2회 실행 — 1회차는 클린 상태(15/15 종료 상태 확인용), 2회차는 **같은 워크트리에서
   동시에 도는 다른 프로세스가 실시간으로 넣은 변형**(아래 관측 참고) 위에서 실행해 라이브
   증거를 얻었다.
4. `scripts/check-review-gate.py`를 실제로 서브프로세스로 띄워 `evaluate_review`가 예외 없이
   `None`/속성 없는 값을 반환하는 경우를 재현.
5. 두 워크플로 YAML 을 커스텀 duplicate-key 로더로 파싱해 README 가 경고하는 "중복 `run:` 키"
   사고 클래스가 이번 변경에 없는지 확인(둘 다 OK).

## 발견사항

- **[CRITICAL]** `test_it_is_still_observation_only`가 `run:` 문자열만 보고, `env:` 경유로
  숨긴 `--enforce`는 통과시킨다 — 라운드 1의 "가장 날카로운" 결함(if:/env: substring 우회)과
  **동일 클래스**가 이 파일의 다른 테스트에서 재발한다.
  - 위치: `.claude/tests/test_review_gate_ci.py:368-374` (`def test_it_is_still_observation_only` ~
    `self.assertNotIn("--enforce", cmd)`). 독스트링 자신이 스코프를 인정한다("`run:` 명령만 본다").
  - 상세: 아래 YAML을 실제 PyYAML + 테스트와 동일한 파싱 로직으로 돌리면 `test_it_is_still_observation_only`가 **통과**한다:
    ```yaml
    - name: Review coverage backstop
      env:
        GATE_FLAG: --enforce
      run: python3 scripts/check-review-gate.py $GATE_FLAG
    ```
    측정: `run` 필드 텍스트는 `"python3 scripts/check-review-gate.py $GATE_FLAG"`이고
    `"--enforce" not in cmd`가 `True`다 — 즉 워크플로가 실질적으로 enforce 모드로 돌아도
    이 가드는 초록이다. **라이브 재현**: 리뷰 도중 같은 워크트리에서 동시에 도는 다른 프로세스가
    실제로 `.github/workflows/review-gate.yml`의 해당 스텝을 `env: {GATE_FLAG: --enforce}` /
    `run: true $GATE_FLAG`로 바꿔 놓은 순간 전체 스위트를 돌렸더니(`unittest discover -v`),
    `test_a_step_actually_runs_the_script`는 (스크립트를 안 부른다는 무관한 이유로) 정확히
    FAIL 했지만 `test_it_is_still_observation_only`는 **ok**로 통과했다 — 스크래치 시뮬레이션과
    실제 파일 양쪽에서 재현된, 동일한 결론이다.
  - 제안: `job.get("if", "")`처럼 구조로 검사할 것 — 예컨대 `run:` 텍스트가 아니라 스텝의
    `env:` 값 전체(및 `run:`에서 참조되는 그 env 키)까지 함께 검사하거나, 최소한 스텝의
    `env` 딕셔너리 값에도 `--enforce`가 없는지 별도로 단언한다. `test_the_job_condition_exempts_dependabot`가
    이미 구조 기반으로 재작성됐는데 같은 파일의 이 테스트만 옛 substring 방식에 머물러 있다.

- **[CRITICAL]** `OneJudgeTest.test_the_script_performs_no_judgement_operations_of_its_own`의
  "금지 호출" 탐지가 `Attribute(base=Name)` 한 단계만 인식해, 이미 허용된 `os` 모듈을 통한
  판정 재구현이 여러 경로로 조용히 빠져나간다 — 라운드 1이 닫은 두 우회(`pathlib.rglob`,
  `from os import walk as _w`)의 **네 번째 자매 우회**다.
  - 위치: `.claude/tests/test_review_gate_ci.py:269-283`, 특히 `276`행
    (`elif isinstance(f, ast.Attribute) and isinstance(f.value, ast.Name):`) 및 `224`행의
    `_ALLOWED_IMPORTS`.
  - 상세: 아래 4가지를 그 테스트의 판정 로직(허용 import 집합 계산 + `called` 집합 구성 +
    금지 호출 대조)을 그대로 복제한 스크립트로 실행 — **넷 다 `extra imports = set()`,
    `banned calls detected = []`** (즉 통과):
    1. `os.path.isdir(codebase)`, `os.path.getmtime(codebase)` — **2단 속성 체인**. `os`는
       이미 허용 목록에 있어 새 import 불필요하고, `os.path.isdir`의 베이스(`os.path`)는
       `ast.Attribute`이지 `ast.Name`이 아니므로 276행 분기 자체가 안 걸린다 — `called`
       집합에 아예 등록되지 않는다. (라이브 근거: 리뷰 도중 같은 워크트리의 동시 프로세스가
       정확히 이 모양 — `os.path.isdir`/`os.path.getmtime` 기반의 "제2 판정자"로
       `decision.blocked`를 대체하는 변형을 `scripts/check-review-gate.py`에 실시간으로
       주입했다가 되돌렸다. 그 변형이 살아있던 순간을 직접 재실행해 확인하진 못했지만
       — 되돌려지는 타이밍과 겹쳤다 — 동일 로직을 격리 스크립트로 재현한 결과는 명확히
       탐지 실패다.)
    2. `__import__('os').walk(root)` — 외부 호출의 `func.value`가 `ast.Call`이라
       `isinstance(f.value, ast.Name)`이 거짓, 새 import 도 불필요.
    3. `getattr(os, 'walk')(root)` — `func` 자체가 `ast.Call`(getattr 결과 호출)이라
       Name 분기도 Attribute 분기도 안 걸림. 이미 허용된 `os`만 재사용.
    4. `eval("__import__('os').listdir(root)")` — 문자열 리터럴 내부는애초에 AST 로 파싱된
       코드가 아니므로 정적 검사가 볼 수 없음.
  - 이 넷 중 (1)이 가장 현실적이다 — "판정 재구현"을 상상하는 개발자가 실제로 쓸 법한 모양이
    `os.walk`가 아니라 `os.path.exists`/`os.path.getmtime`/`os.path.isdir` 류이기 때문이다.
    이는 "판정자가 하나다"라는, 이 스크립트의 존재 이유이자 스위트가 **첫 번째로 고정하는**
    성질을 실질적으로 무력화한다.
  - 제안: 금지 호출 판정을 `Attribute(base=Name)` 한 단계에 한정하지 말고, 체인을 루트까지
    풀어(예: `Attribute`를 재귀적으로 걸어 `os.path.isdir`도 `"os.path.isdir"`로 정규화) 대조할
    것. 동시에 `eval`/`exec`/`compile`/`__import__`/`getattr`/`setattr` 자체를 (허용 import와
    별개로) 호출 자체 금지 목록에 추가해, "지역 변수를 거쳐 간접 호출"이라는 회피 축 전체를
    닫는 것을 검토.

- **[WARNING]** `scripts/check-review-gate.py`의 fail-open 보장이 `evaluate(root)` **호출**
  만 감싸고, 그 반환값에 대한 이후 속성 접근은 감싸지 않는다 — `evaluate_review()`가 예외 없이
  기대한 모양이 아닌 값(예: `None`, 또는 `.blocked`가 없는 객체)을 반환하면 스크립트가
  **처리되지 않은 예외로 exit 1** 하며 죽는다.
  - 위치: `scripts/check-review-gate.py:89-100` (`try: decision = evaluate(root) ... except ...
    return 0` 다음의 `if not decision.blocked:`가 try 밖에 있다).
  - 상세: 실제로 재현했다 — `evaluate_review`가 `return None`만 하는 스텁 `review_guard.py`를
    임시 저장소에 놓고 `--root <tempdir>`로 스크립트를 서브프로세스로 실행하면:
    ```
    returncode: 1
    stderr: ...AttributeError: 'NoneType' object has no attribute 'blocked'
    ```
    이는 문서가 스스로 못박은 4대 성질 중 3번("게이트가 예외를 던져도 exit 0 ... 백스톱이
    CI 를 막아서는 안 된다")을 정확히 위반한다 — "예외를 던지는" 실패는 잡히지만 "예외
    없이 이상한 값을 반환하는" 실패는 안 잡힌다. `review_guard.evaluate_review`의 현재
    구현은 항상 `ReviewDecision`을 반환하므로 오늘 당장 터지는 결함은 아니지만, 이 스크립트가
    스스로 표방하는 "백스톱이 자기 부재/오류로 CI 를 막으면 안 된다"는 방어선의 폭이 호출부
    시그니처 계약이 유지되는 동안만 유효하다는 뜻이고, 그 계약을 지키는 테스트가 없다.
  - 제안: `try` 블록을 `decision.blocked`/`getattr(decision, "notes", ())` 접근까지 포함하도록
    넓히거나, 반환값에 `hasattr(decision, "blocked")` 가드를 추가. 회귀 테스트로 "예외 없이
    형태만 깨진 반환값"을 스텁으로 고정할 것(현재 `test_a_gate_that_raises_does_not_fail_ci`는
    "raise"만 고정하고 "silently malformed return"은 고정하지 않는다).

- **[INFO]** 관련 spec 문서 없음(예상된 부재).
  - 위치: `spec/` 전체 grep — `review_guard`/`evaluate_review`/`check-review-gate` 어느 것도
    `spec/`에 등장하지 않는다.
  - 상세: 이 변경은 프로젝트 컨벤션상 harness/CI 도구 계층(`.claude/`, `scripts/`,
    `.github/workflows/`)이고, 단일 진실은 `plan/in-progress/harness-review-gate-ci-backstop.md`다.
    그 plan 문서의 "4대 성질"(판정자 하나 / 관측 모드 기본 / fail-open / advisory
    판정-무관) 서술은 코드와 line-level 로 대응한다(위 CRITICAL/WARNING 두 항목은 그 "판정자
    하나"·"fail-open" 성질을 **검증하는 테스트/스크립트 자체의 구멍**이지, plan 문서 서술과
    코드가 어긋난 것은 아니다). spec/ 문서 부재는 결함이 아니라 이 영역의 정상적인 컨벤션.

- **[INFO]** 리뷰 도중 공유 워크트리에서 다른 프로세스의 미커밋 변형이 실시간으로 나타났다
  사라졌다 했다(스코프 위반으로 세지 않음, 이 changeset 이 아님).
  - 위치: `scripts/check-review-gate.py`, `.github/workflows/review-gate.yml` — 관측 시점에
    한정, 리포트 작성 시점엔 이미 되돌려져 있었다(`git status`/`git diff` 재확인).
  - 상세: 반복 실행한 `git status --porcelain -uall`/`git diff` 결과가 호출마다 달랐다 — 같은
    워크트리에서 병행 중인 다른 리뷰/테스트 프로세스(뮤테이션 검증)로 보인다. 이 자체가
    "정답이 무엇인지" 헷갈리게 만들 수 있는 리뷰 환경 리스크이지만, 위 CRITICAL 두 건은 그
    실시간 변형에 의존하지 않고 **격리된 스크래치 재현**(스크립트/YAML을 독립적으로 복제 실행)
    으로 확정했으므로 이 관측이 사라져도 결론은 유효하다.
  - 제안: 없음(코드 수정 대상 아님). 최종 push 전 `git status`가 clean 한지, 그리고 다른
    reviewer 산출물(`scope.md` 등)에서도 같은 오염이 관측됐는지 orchestrator 가 대조할 것.

- **[INFO]** `test_a_gate_that_raises_does_not_fail_ci`의 스텁에 정의된 `class _R`(`push_blocks
  = False`)이 실제로는 쓰이지 않는다(`evaluate_review`가 바로 `raise`하므로 인스턴스화되지
  않음). 기능 결함은 아니고 사소한 dead code.
  - 위치: `.claude/tests/test_review_gate_ci.py:176-184` 부근(스텁 문자열 리터럴).
  - 제안: 필요 없으면 제거, 또는 실제로 `raise` 이전에 `_R()`을 반환하는 경로를 하나 더
    추가해 "raise 하지 않는 스텁이 진짜 인터페이스 모양을 유지한다"는 주석의 의도를 코드로
    보여줄 것.

## 요약

이 변경 자체(관측 모드 CI 백스톱: `review-gate.yml` + `check-review-gate.py` + 배선 테스트)는
기능적으로 완결돼 있고, 판정 위임·기본값(enforce=False)·fail-open·advisory 출력·bot 예외·
paths coverage 등 8개 관점 대부분에서 실측(서브프로세스 실행, 실제 워크플로 YAML 구조 파싱,
duplicate-key 검사)이 통과했다. 그러나 이 라운드가 명시적으로 "가드/테스트 자체가 거짓을
통과시키는가"를 검증하라고 요청했고, 그 축에서 두 개의 CRITICAL 을 실측으로 확정했다 — 둘 다
라운드 1이 이미 발견·수정한 것과 **같은 결함 클래스의 재발**이다: (1) `--enforce` 를 `env:`
경유로 숨기면 "여전히 관측 모드" 테스트가 통과하고, (2) `os.path.*` 2단 속성 체인(및
`__import__`/`getattr`/`eval`)으로 우회하면 "판정자가 하나다" 테스트가 통과한다. 두 경우 다
스크립트/워크플로 **본체는 오늘 그런 모양이 아니므로 지금 당장 CI 가 거짓 안전 상태는 아니지만**,
바로 이 스위트가 방어하려는 "가드를 흉내만 내는 재구현이 조용히 미끄러진다"는 사고가 이 테스트
자신의 사각지대에서 다시 가능하다는 뜻이라 우선순위가 높다. WARNING 은 fail-open 계약이 반환값
형태 오류까지는 덮지 않는다는 좁지만 실측된 구멍이다.

## 위험도

HIGH
