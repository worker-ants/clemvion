# 문서화(Documentation) Review — round 3 (CI backstop)

## 작업 중 관측된 예상치 못한 `git status` (수정하지 않고 보고만 함)

지시대로 워킹트리를 건드리지 않았으나, 리뷰 도중 `git status`가 다음을 보였다:

```
 M scripts/check-review-gate.py
?? review/code/2026/08/01/12_06_49/
```

`git diff -- scripts/check-review-gate.py`:

```diff
@@ -52,6 +52,10 @@ import argparse
 import os
 import sys
 
+# control case: local Name-to-Name alias of a disallowed call
+join = os.walk
+join('review')
+
 # `review_guard` 는 `.claude/hooks/_lib/` 에 있고 형제 모듈을 이름으로 import 하므로
```

이 편집은 내가 만든 것이 아니다(나는 항상 `/private/tmp/.../scratchpad/ci-backstop-mutation/`
아래 복사본만 수정했고, 절대경로도 그쪽만 썼다 — 아래 "실측" 절 참조). 파일 mtime 은
세션 중간 시각이었다. 라운드 2 에서도 "리뷰 중 소스 파일이 뮤테이션됐다"는 동일 클래스의
관측이 있었고 프롬프트는 "그 저자가 뮤테이션 테스트를 돌리다 지금은 멈췄다"고 적어 뒀는데,
이번 라운드에서도 같은 클래스가 재발한 것으로 보인다(정확히 `test_the_script_performs_no_
judgement_operations_of_its_own`이 우려하는 바로 그 시나리오 — `join = os.walk` 지역 별칭 —
를 실제 작업트리 파일에 주입하는 control-case 실험). 지시대로 고치지 않고 사실만 남긴다.

---

## 실측 — "판정자가 하나다"(OneJudgeTest) 불변식을 데코레이터로 무력화

**이 가드가 주장하는 성질**: `test_review_gate_ci.py`의 `OneJudgeTest.test_the_script_
performs_no_judgement_operations_of_its_own`(소스 253행, docstring 254-269행)은
"스크립트가 하는 일은 인자를 읽고 게이트를 부르고 출력하는 것뿐"이라는 성질을, `_ALLOWED_
IMPORTS`(224/227행, 중복 — 아래 별도 발견)와 `_ALLOWED_CALLS`(228-234행)라는 **두 개의
허용목록**으로 강제한다고 주장한다. 검사 메커니즘은 `ast.walk(tree)`로 모듈 전체를 순회하며
모든 `ast.Import`/`ast.Call` 노드를 찾아 허용 목록과 대조하는 것이다(275-311행).

docstring(256-269행)은 이 스크립트가 정확히 **네 번** 뚫린 이력을 적고 "이번엔 두 축 모두
뒤집는다"(import 도 call 도 허용목록)고 결론짓는다.

**반증**: 이 검사는 `ast.Call` 노드만 스캔한다. 그런데 **데코레이터 구문(`@expr`, 괄호
없음)은 파이썬 AST 에서 `ast.Call` 노드로 표현되지 않는다** — 함수/클래스 정의 시 파이썬이
암묵적으로 `f = expr(f)`를 실행할 뿐, 소스 상에는 그 호출에 대응하는 `Call` 노드가 없다.
따라서 임의의 이미-존재하는 callable(허용목록에 없어도 됨, 새 import 도 필요 없음 — 이미
`os`가 허용된 import 이므로 `os.*`속성 참조나 그냥 내장 이름을 쓰면 된다)을 데코레이터로
호출하면 이 스캐너의 사각지대를 통과한다.

**실제로 실행한 것과 그 출력** — 저장소 자체가 아니라 아래 스크래치 디렉터리에 만든 복사본에서만
수행했다(작업트리는 건드리지 않음):

```
SCRATCH=/private/tmp/claude-501/.../scratchpad/ci-backstop-mutation
cp -r <repo>/.claude/tests    "$SCRATCH/.claude/tests"
cp -r <repo>/.claude/hooks    "$SCRATCH/.claude/hooks"
cp -r <repo>/.claude/_shared  "$SCRATCH/.claude/_shared"
cp -r <repo>/scripts          "$SCRATCH/scripts"
cp -r <repo>/.github/workflows "$SCRATCH/.github/workflows"
```

베이스라인(무수정 복사본)에서 먼저 GREEN 확인:

```
$ python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v -k OneJudgeTest
test_the_script_performs_no_judgement_operations_of_its_own ... ok
Ran 1 test in 0.001s
OK
```

이후 `scripts/check-review-gate.py`의 `_ROOT_DEFAULT = ...` 바로 아래에 다음 5줄만 주입:

```python
@repr
def _sneaky_operation_the_allowlist_never_sees():
    return 'this callsite is invisible to ast.Call scanning'
```

(`repr`은 내장 함수라 새 import 불필요, `_ALLOWED_CALLS`에 없음, 함수 객체를 인자로 받아도
예외를 던지지 않아 스크립트 실행 자체는 정상.)

스크립트 자체가 여전히 정상 동작함을 먼저 확인:

```
$ python3 scripts/check-review-gate.py --root "$SCRATCH"
review-gate: 통과 — not inside a git repository — allowed
exit=0
```

그 다음 같은 `OneJudgeTest`를 재실행:

```
$ python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v -k OneJudgeTest
test_the_script_performs_no_judgement_operations_of_its_own ... ok
Ran 1 test in 0.001s
OK
```

**결과**: `repr(...)`이라는, `_ALLOWED_CALLS`에 없는 실제 호출이 모듈 임포트 시점마다
조용히 실행됨에도(즉 "판정자가 하나다"라는 성질은 이제 거짓) 테스트는 여전히 GREEN 이다.
데코레이터 대상은 임의의 1-인자 callable 이면 되므로, 로컬에서 직접 정의한 헬퍼를 데코레이터
자리에 두고 그 헬퍼가 자신의 인자(데코레이트된 함수 객체)를 무시한 채 클로저/전역 상태를
읽고 쓰는 식으로 확장하면(그 헬퍼 **내부**의 개별 호출들은 여전히 스캔되므로 내부에서 새로
금지된 호출을 하면 그건 잡힌다 — 뚫리는 지점은 어디까지나 "데코레이터 적용" 그 자체 한
콜사이트다) 판정 로직 재구현의 통로로 쓸 수 있다.

이는 문서(README/이 테스트의 docstring)가 "네 번 뚫렸다 → 이번엔 두 축 모두 뒤집어 닫았다"고
서술한 바로 그 서사가 **다섯 번째로 아직 안 닫혔다**는 것이며, 그 사실이 코드 어디에도
(docstring, README 모두) 알려진 한계로 적혀 있지 않다.

---

## 발견사항

- **[CRITICAL]** `OneJudgeTest`의 "판정 로직이 스크립트에 없다" 불변식이 데코레이터 호출
  경로로 실측 반증됨(위 §실측). docstring 은 "이번엔 두 축 모두 뒤집는다"(266행)고 완결된
  것처럼 서술하지만, `ast.Call` 스캔은 데코레이터 적용(`@expr`)이라는 무괄호 암묵 호출을
  보지 못한다 — 알려지지 않은 한계가 문서 어디에도 없다.
  - 위치: `.claude/tests/test_review_gate_ci.py:253` (`test_the_script_performs_no_
    judgement_operations_of_its_own`), docstring `254-269`, 검사 로직 `275-311`.
  - 제안: (a) docstring 에 "데코레이터/메타클래스 적용처럼 `ast.Call` 로 표현되지 않는
    암묵 호출은 이 검사가 못 본다"는 알려진 한계를 명시하거나, (b) `ast.FunctionDef`/
    `ast.ClassDef.decorator_list`, `ast.ClassDef.keywords`(metaclass=) 도 같은 `_dotted`
    해석 + 허용목록 대조에 포함시켜 실제로 닫는다. (b)가 이 저장소가 앞선 4번의 재발 때마다
    택한 패턴("우회를 상상하는 만큼만 강하다"는 자인)과 일관된 해법이다.

- **[WARNING]** `.claude/tests/README.md`의 `test_review_gate_ci.py` 행이 재작성 이력을
  실제보다 적게(과소) 서술한다. README 는 "the two earlier versions (whole-file grep,
  then a denylist) were each defeated"라고 적어 이전 버전을 2세대(grep, denylist)로만
  꼽지만, 같은 파일의 테스트 docstring(위 인용)은 **1차 grep → 2차 grep(docstring 제외)
  → 3차 연산 금지목록 → 4차 import 허용목록+호출 금지목록** 의 4세대가 각각 뚫렸고, 그중
  4차는 다섯 가지 별도 기법(2단 속성 체인 `os.path.isdir`, 지역 별칭 `walk = os.walk`,
  `getattr(os, "walk")()`, `__import__("os").walk()`, 원래 목록에 없던 `os.popen`/
  `os.system`)으로 뚫렸다고 적는다. README 는 이 4차 세대 자체와 그 5가지 기법을 통째로
  누락한다 — 정확히 "call 축도 허용목록화해야 했던 이유"를 설명하는 세대인데, 그 교훈이
  README 요약에는 없다.
  - 위치: `.claude/tests/README.md:88` (표 행) vs `.claude/tests/test_review_gate_ci.py:
    256-263` (docstring 본문).
  - 제안: README 행을 "네 세대가 순차로 뚫렸다(grep→grep→denylist→import-allow/call-deny)"로
    갱신하거나, 최소한 4차 세대와 그 기법 목록을 한 문장으로라도 포함시킨다.

- **[WARNING]** `test_review_gate_ci.py`의 `OneJudgeTest._ALLOWED_IMPORTS`가 **동일한 주석과
  함께 두 번 선언**되어 있다(두 번째가 첫 번째를 덮어써 동작에는 영향이 없으나, 데드 코드이자
  편집 중 정리되지 않은 흔적으로 읽힌다 — 리뷰어가 "이게 의도적 강조인지 병합 잔재인지" 판단할
  근거가 없다).
  - 위치: `.claude/tests/test_review_gate_ci.py:223-227`.

  ```python
  223      # 스크립트가 실제로 쓰는 전부. 열거를 뒤집은 이유는 아래 docstring 참조.
  224      _ALLOWED_IMPORTS = {"__future__", "argparse", "os", "sys", "review_guard"}
  225
  226      # 스크립트가 실제로 쓰는 전부. 열거를 뒤집은 이유는 아래 docstring 참조.
  227      _ALLOWED_IMPORTS = {"__future__", "argparse", "os", "sys", "review_guard"}
  228      _ALLOWED_CALLS = {
  ```

  - 제안: 224-225행 또는 226-227행 중 하나를 제거한다.

- **[WARNING]** `plan/in-progress/harness-review-gate-ci-backstop.md`의 최상단 배너(2026-07-31
  일자)가 표에서 "CI 백스톱 본체 | **미착수**"라고 단언하는데, 같은 문서 145행의 2026-08-01
  배너는 "**본체 구현 완료(관측 모드)**"라고 적는다 — 두 배너가 서로 모순된 채 남아 있다.
  이 저장소의 관행(append-only 진행 배너)상 오래된 배너를 지우지 않는 것 자체는 정상이지만,
  여기서는 오래된 표 행이 **취소선/갱신 표시 없이** 최신 사실과 정면으로 모순돼, 문서를 위에서부터
  훑는 독자는 "CI 백스톱은 아직 시작 안 됐다"고 잘못 결론 내리기 쉽다(그 뒤 100줄 넘게 읽어야
  08-01 배너를 만난다).
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:17`(구 배너 표 행, "미착수")
    vs `plan/in-progress/harness-review-gate-ci-backstop.md:145`(신 배너, "구현 완료").
  - 제안: 17행 표 셀을 `~~미착수~~ → 08-01 구현 완료(관측 모드), §145 참조` 식으로 갱신하거나,
    최소한 취소선 + 아래 배너로 포인터를 남긴다.

- **[INFO]** `WorkflowWiringTest._env_values()`(`test_review_gate_ci.py` 379-383행)는
  "job 과 각 step 의 `env:`"만 스캔한다고 docstring 그대로 정확히 서술하지만, 워크플로
  최상위(`on:`/`jobs:`와 형제인) `env:` 블록은 스캔 대상에서 빠져 있다 — 현재 `review-gate.yml`
  에 최상위 `env:`가 없어 실질 위험은 없고(같은 클래스 우회는 어차피 게이트 호출 커맨드라인의
  `$`/`${{` 금지로 막힌다), 다만 향후 최상위 `env:`가 추가되는 변경이 있을 경우를 대비해
  docstring에 "job/step env만, workflow-level env는 대상 아님"이라는 스코프 한 줄을 남겨 두면
  다음 리뷰어가 같은 질문을 반복하지 않는다.
  - 위치: `.claude/tests/test_review_gate_ci.py:379-383`.

## 요약

핵심 8개 파일(README, 3개 신규/변경 테스트, 2개 워크플로 yml, plan 문서, 게이트 스크립트)의
docstring/주석은 전반적으로 이례적으로 상세하고, 숫자(732세션, 24건/3.3%, 435건 중 80건 등)도
직접 대조한 범위 내에서는 소스와 일치했다. 다만 이번 라운드의 핵심 요구("가드가 주장하는
성질을 실측으로 반증해 보라")를 `OneJudgeTest`에 적용한 결과, 데코레이터 구문을 통한 암묵
호출이 "판정자가 하나다" 불변식을 실제로 무력화하면서도 테스트를 GREEN 으로 통과시키는 것을
확인했다 — 이는 이 가드가 이미 자인한 "금지 목록은 상상력만큼만 강하다"는 교훈이 다섯 번째로
재현된 사례이며, README/docstring 어디에도 알려진 한계로 기록돼 있지 않다. 그 외 README의
재작성 이력 서술 누락(4세대 생략), 테스트 파일의 중복 선언, plan 문서 배너 간 모순도 문서
정확성 관점에서 실질적인 수정 대상이다. 또한 리뷰 도중 지시받지 않은 작업트리 변경
(`scripts/check-review-gate.py`에 `join = os.walk` 주입)을 관측했으며, 지시대로 고치지 않고
사실만 기록한다.

## 위험도

HIGH
