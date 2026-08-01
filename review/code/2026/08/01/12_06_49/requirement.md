# 요구사항(Requirement) Review — CI 리뷰 게이트 백스톱 (round 3)

방법: 각 가드/테스트가 주장하는 성질을 정확히 서술한 뒤, 그 성질이 거짓이면서 테스트는 여전히
GREEN 인 최소 프로그램을 실제로 작성해 **스크래치 디렉터리에 복사한 사본**에서 실행했다(작업
트리는 건드리지 않음, 실행 후 `git status` 로 확인 — 세션 산출물 디렉토리 외 변경 없음).

## 발견사항

- **[CRITICAL]** `OneJudgeTest` 가 주장하는 "스크립트는 판정을 재구현하지 않는다"(import+호출
  allowlist)를, 새 import 없이 두 줄로 무너뜨리면서 테스트는 GREEN 이다.
  - 위치: `.claude/tests/test_review_gate_ci.py:220`(`class OneJudgeTest`),
    `:253`(`test_the_script_performs_no_judgement_operations_of_its_own`),
    특히 별칭 추적 `:291-293`·getattr 전용 우회탐지 `:313-322`.
  - 상세: 이 가드는 두 축으로 판정한다 — (1) import 이름 allowlist, (2) 호출 이름 allowlist(별칭
    포함) + `getattr(module, "attr")` 형태 전용 우회 탐지. 그런데 별칭 추적(`_dotted`, 291-293행)은
    **`ast.Attribute` 체인만** 따라가고, getattr 전용 탐지(313-322행)는 **`getattr` 의 첫 인자가
    정확히 `ast.Name` 일 때만** 검사한다. 두 조건 모두 우회 가능:
    ```python
    # scripts/check-review-gate.py 어딘가에 아래 두 줄만 추가 — import 문 0개, 새 import 없음
    print = getattr(sys.modules['os'], 'system')
    ```
    - `getattr(sys.modules['os'], 'system')` 의 첫 인자는 `Subscript`(`sys.modules['os']`)이지
      `Name` 이 아니므로 313-322행 검사가 **아예 실행되지 않는다**(조용히 스킵, assert 자체가 없음).
    - 바깥 `getattr(...)` 호출 자체는 일반 호출 검사(298-311행)를 통과한다 — `func` 가 `Name('getattr')`
      로 그대로 해석되고 `"getattr"` 은 `_ALLOWED_CALLS` 에 있다.
    - `print = <그 결과>` 대입은 291-293행의 별칭 추적에 걸리지 않는다 — RHS 가 `Call` 이라
      `_dotted` 가 `None` 을 반환하기 때문(그 함수는 `Attribute` 체인만 인식). 그래서 `alias_of`
      에 `print` 재바인딩이 전혀 기록되지 않는다.
    - 이후 코드에서 `print("...")` 를 호출하는 모든 지점은 `_dotted` 가 그냥 `"print"` 를 반환하고,
      `alias_of.get("print","print")` 도 `"print"`(재바인딩이 기록 안 됐으므로) → `_ALLOWED_CALLS`
      에 있으므로 **전부 통과**. 하지만 런타임에는 `print` 가 `os.system` 이라, 스크립트의 모든
      `print(...)` 호출이 실제로는 임의 셸 명령을 실행한다.
    - `sys` 는 이미 스크립트가 정상 import 하고 있고, `sys.modules['os']` 는 `import os` 없이도
      항상 존재한다(인터프리터 부팅 시 이미 로드됨) — 그래서 import allowlist(축 1)는 아예
      건드릴 필요가 없다.
  - 실측 (사본에서 실행, 작업 트리 무변경):
    1. 사본에 `.claude/`, `scripts/check-review-gate.py` 를 복사(`rsync --exclude .git`) 후
       `python3 -m unittest test_review_gate_ci -v` 베이스라인 15/15 GREEN 확인.
    2. `scripts/check-review-gate.py` 의 `main()` 정의 직전에 위 두 줄(`# --- injected ... ---`
       주석 + `print = getattr(sys.modules['os'], 'system')`)만 삽입.
    3. `python3 -m unittest test_review_gate_ci.OneJudgeTest -v` 실행 결과:
       ```
       test_the_script_performs_no_judgement_operations_of_its_own ... ok
       Ran 1 test in 0.001s
       OK
       ```
       → 판정 로직이 재구현됐음에도(오히려 임의 셸 실행) 가드는 GREEN.
    4. 별도로 동일 패턴을 최소 재현해 런타임 효과까지 확인:
       ```python
       import sys, os
       print = getattr(sys.modules['os'], 'system')
       print("touch <scratch>/proof/PWNED_MARKER")
       ```
       실행 후 `ls <scratch>/proof/` → `PWNED_MARKER` 파일이 실제로 생성됨(즉 `print(...)` 호출이
       진짜로 `os.system(...)` 을 실행했다는 물증).
  - 이 클래스의 가드는 이미 4번 뚫린 이력이 있고(전체-grep → docstring 제외 → 연산 금지목록 →
    import+호출 allowlist, 각각 문서화된 우회) 4번째 판마저 "상상하지 못한 5가지"(2단 체인·지역
    별칭·`getattr(os,"walk")`·`__import__`·`os.popen`/`os.system`)로 뚫려 지금 형태가 됐다. 이번
    발견은 **6번째 우회 형태**로, 같은 근본 원인(금지/허용 목록은 상상한 만큼만 강함)이 또
    재발한 것이다. 다만 이번 것은 두 개의 구체적 구멍으로 특정 가능: (a) `_dotted` 의 별칭 추적이
    `Attribute` 체인만 보고 `Call`/`Subscript` RHS 는 무시, (b) getattr 전용 우회 탐지가 첫 인자
    타입을 `ast.Name` 으로 하드코딩.
  - 제안: 최소 수정 2가지가 함께 필요하다 —
    (1) `alias_of` 갱신 대상을 `Call` RHS 까지 확장하지 말고, 대신 **`_ALLOWED_CALLS` 의 bare(점
    없는) 이름들(`print`, `list`, `type`, `main`, `evaluate`, `getattr`, `_load_gate`) 에 대한 모든
    재대입(`Assign` target 이 그 이름) 자체를 금지/실패**시킨다 — 이 스크립트는 그런 재대입을
    할 이유가 전혀 없다(허용 호출 이름은 built-in/함수 이름이지 변수가 아니다).
    (2) getattr 전용 탐지(313-322행)의 "첫 인자가 `Name`" 조건을 없애고, 첫 인자가 `imported`
    안의 이름으로 **어떤 식으로든** 귀결될 수 있는 모든 표현(`Subscript`, 중첩 `Attribute`,
    `sys.modules[...]` 패턴)을 다루거나, 아니면 이 스크립트에서 **`getattr` 사용 자체를 금지**하는
    쪽이(실제로 스크립트가 쓰는 유일한 용도는 `getattr(decision, "notes", ())` 하나뿐이므로) 더
    작은 표면이다 — 그 한 곳만 이름을 박아 예외 처리하고 나머지 `getattr` 호출은 전부 금지.

- **[CRITICAL]** `WorkflowWiringTest` 가 스스로 표방하는 원칙("**구조로 판정한다 — substring
  이 아니라**", `.claude/tests/test_review_gate_ci.py:337`)이 실제로는 "문자열이 **어느 필드에**
  있는가"만 볼 뿐 "그 스텝이 **실행되는가**"는 전혀 보지 않는다 — 스텝 단위 `if:` 조건이라는,
  이 스위트가 이미 알고 있는 것과 정확히 같은 종류(불리언 게이트가 실행 여부를 결정)의 구멍이
  한 레벨 아래(job → step)에 그대로 남아 있다.
  - 위치: `.claude/tests/test_review_gate_ci.py:330`(`class WorkflowWiringTest`),
    `:385`(`test_a_step_actually_runs_the_script`), `:404`(`test_checkout_fetches_full_history`);
    실제 워크플로 `.github/workflows/review-gate.yml:55-57`(checkout), `:73-74`(gate 호출 스텝).
  - 상세 (2건, 같은 근본 원인):
    1. `test_a_step_actually_runs_the_script` 는 `job["steps"]` 중 `run:` 문자열에
       `"scripts/check-review-gate.py"` 가 있는 스텝이 하나라도 있으면 통과한다(`_run_commands`
       가 `st["run"]` 텍스트만 모은다, 375-376행). 그 스텝에 `if: ${{ false }}` 를 붙여도
       `run:` 텍스트는 그대로이므로 이 단언은 여전히 통과하지만, **CI 에서 그 스텝은 절대
       실행되지 않는다** — 이 테스트가 방어한다고 주장하는 정확히 그 실패("`paths:` 에 이름이
       있는 것과 그것을 실행하는 것은 다른 사실이다")의 재발이며, 이번엔 job 레벨이 아니라
       스텝 레벨이다.
    2. `test_checkout_fetches_full_history` 는 `uses` 가 `actions/checkout` 로 시작하는 **모든**
       스텝의 `fetch-depth` 를 모아(407-409행) 그중 하나라도 0 이면 통과한다(411행). 실행되는
       진짜 checkout 을 `fetch-depth: 1`(shallow)로 두고, `if: ${{ false }}` 가 붙은 **가짜**
       두 번째 checkout 스텝에 `fetch-depth: 0` 을 붙이면, 리스트에는 0 이 포함되므로 통과한다 —
       그런데 실제로 실행되는 checkout 은 shallow 라 merge-base 를 못 잡고, 이 테스트의 docstring
       이 정확히 말하는 결과("게이트가 조용히 fail-open 한다")가 그대로 일어난다.
  - 실측 (사본에서 실행):
    1. `review-gate.yml` 사본의 `Review coverage backstop` 스텝(73-74행 대응 위치)에
       `if: ${{ false }}` 한 줄만 추가 → `WorkflowWiringTest` 5개 전부 실행:
       ```
       test_a_step_actually_runs_the_script ... ok
       test_checkout_fetches_full_history ... ok
       test_it_is_still_observation_only ... ok
       test_the_job_condition_exempts_dependabot ... ok
       test_trigger_paths_cover_the_logic_it_depends_on ... ok
       Ran 5 tests in 0.017s
       OK
       ```
       → 게이트를 실제로 절대 실행하지 않는 워크플로가 5/5 GREEN.
    2. 별도 사본에서 checkout 스텝을 "진짜(shallow, fetch-depth:1) + 가짜(if:false,
       fetch-depth:0)" 둘로 교체 후 `test_checkout_fetches_full_history` 단독 실행:
       ```
       test_checkout_fetches_full_history ... ok
       Ran 1 test in 0.011s
       OK
       ```
       → 실행되는 checkout 이 shallow 인데도(merge-base 불가 → 백스톱 무력화) GREEN.
  - 이 스위트는 정확히 같은 원인(문자열이 **어디에** 있는지 substring 만으로는 못 봄)으로 2라운드
    전에 `if:`↔`env:` 우회와 `run:`↔`true` 치환 우회를 이미 겪었고 그때는 "구조로 판정"으로
    고쳤다(337-342행 docstring 이 그 전례를 스스로 인용한다). 그런데 그 교훈이 "필드 위치"까지만
    닿았고 "실행 조건(`if:`)"에는 닿지 않았다 — YAML 을 구조로 파싱해도, 스텝 자체가 조건부로
    스킵될 수 있다는 축은 이 스위트의 어떤 assertion 도 검사하지 않는다.
  - 제안: 두 단언 모두에 "그 스텝에 `if:` 키가 아예 없어야 한다"(현재 실제 파일의 두 스텝
    모두 `if:` 가 없다는 사실 그대로를 고정)는 조건을 추가한다 — 이 스위트가 이미 쓰는 철학과
    같은 모양("허용한 형태를 벗어나면 사람이 판단하도록 실패시킨다")이면 된다. 부가로 해당
    `uses:`/`run:` 패턴에 매칭되는 스텝이 **정확히 하나**인지도 확인하면(현재는 "하나라도
    있으면" 통과) 디코이 스텝 자체를 봉쇄한다.

- **[INFO]** `_ALLOWED_IMPORTS` 가 완전히 동일한 내용으로 두 번 정의돼 있다(사문화된 중복,
  기능 영향 없음).
  - 위치: `.claude/tests/test_review_gate_ci.py:224`, `:227` (두 줄 모두
    `_ALLOWED_IMPORTS = {"__future__", "argparse", "os", "sys", "review_guard"}`).
  - 상세: 227행이 224행을 덮어쓸 뿐이라 지금은 무해하지만, 이 클래스 전체가 "허용 목록을
    바꿀 때 한 곳만 고치고 다른 한 곳을 놓치는" 실패 계급을 정확히 겨냥하는 가드라는 점을
    감안하면 자기 파일 안의 중복 정의는 그 교훈과 어긋나는 잔재다. 나중에 한쪽만 고치면 조용히
    구 값이 죽은 채 남는다(지금은 값이 같아 드러나지 않을 뿐).
  - 제안: 중복 줄 삭제.

- **[SPEC-DRIFT 아님 / 회색지대 — INFO]** 관련 spec 본문 부재.
  - 상세: 이 변경은 `.claude/`(harness 자동화 계층)와 `scripts/`, `.github/workflows/` 로,
    프로젝트 규약상 `spec/` 는 제품 코드(`codebase/`) 대상이고 harness 도구는 `plan/` +
    `.claude/docs/` 가 SoT 다. `plan/in-progress/harness-review-gate-ci-backstop.md` 가 이
    변경의 설계 문서 겸 실측 근거이고, 본문 대조 결과 스크립트의 exit-code 계약(관측 0 /
    `--enforce` 위반 1 / 내부오류 0)·`evaluate_review()` 단일 판정자 위임·advisory
    판정-무관 출력이 plan 서술과 line-level 로 일치한다. `spec/` 에 대응 문서가 없는 것은
    누락이 아니라 이 영역의 정의된 SoT 위치가 다르기 때문이므로 INFO 로 남긴다.

## 요약

CI 백스톱 본체(`scripts/check-review-gate.py`, `.github/workflows/review-gate.yml`)의 기능
자체(관측 모드 기본·`--enforce` 전환·fail-open 3경로·advisory 판정-무관 출력·`_ALLOWED_ROOT`
2단 상위 산정)는 plan 문서의 실측·서술과 정확히 일치하고, `ReviewGateCliTest` 12건은 실제로
그 계약을 서브프로세스로 고정하고 있어 견고하다. 그러나 이번 라운드가 요구한 "가드를 실제로
공격해 보라"는 관점에서, 이 PR 이 이번에 새로 도입한 두 개의 핵심 방어 가드
(`OneJudgeTest`="판정 로직 재구현 금지", `WorkflowWiringTest`="구조로 판정, 배선이 실제로
작동함을 검증")가 **각각 독립적으로, 새 import 없이 몇 줄만으로, 실행까지 확인된 형태로** 뚫린다:
전자는 `getattr(sys.modules['os'], 'system')` 로 내장 함수 이름을 재바인딩해 임의 셸 실행이
가능함을 물증(파일 생성)까지 실측했고, 후자는 스텝 레벨 `if:` 가 이 스위트의 어떤 assertion 에도
걸리지 않아 "실행되지 않는 게이트/checkout"이 5/5 GREEN 으로 통과함을 두 가지 변형(스텝 자체
비활성화, shallow-checkout + 디코이-deep-checkout)으로 실측했다. 두 결함 모두 이 스위트가 이전
라운드들에서 이미 겪은 실패 계급("금지/허용 목록은 상상한 만큼만 강하다", "substring 은 위치를
못 본다")의 **다음 사례**이며, 현재 코드(`scripts/check-review-gate.py`, `review-gate.yml`)
자체에 이 정확한 문자열이 존재하는 것은 아니지만 — 가드가 막아야 할 변경 유형(향후 이 두 파일에
대한 악의적 또는 실수의 편집)에 대해 방어력이 없다는 점에서 CRITICAL 로 판단한다.

## 위험도

HIGH
