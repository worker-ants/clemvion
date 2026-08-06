# 테스트(Testing) Review — CI 백스톱 라운드 5

## 방법론 메모 (작업 트리 규칙 준수)

리뷰 대상 코드를 수정하지 않고, `mktemp -d` 로 만든 별도 스크래치 디렉터리에 `.claude/`,
`.github/workflows/*.yml`, `scripts/check-review-gate.py` 를 절대경로로 복사해 그 안에서만
변형(mutation)을 만들고 돌렸다. 실제 저장소 `git status` 는 시작 시 `review/code/2026/08/06/11_03_17/`
외에 깨끗했고, 종료 시에도 그렇다. 다만 리뷰 도중 한 시점에 `git status` 가
`.claude/tests/test_workflow_yaml_structure.py` (M) 를 보였다 — 이 세션이 만든 변경이 아니며
(내 모든 쓰기는 스크래치 경로에만 있었다), 잠시 후 다시 확인하니 사라져 있었다(clean). 다른 동시
세션이 같은 워크트리에 쓰고 있다는 신호로 보인다 — 고치지 않고 사실만 보고한다.

## 실험: 4R 방어를 뚫는 변형이 아직 있는가

`OneJudgeTest`(정적: import/호출 표면 허용목록)와 `VerdictComesFromTheGateTest`(행위: 스텁 게이트
판정 × `--enforce` 네 조합에 대해 종료 코드가 순함수인지)가 "숨은 두 번째 판정자는 반드시
드러난다" 고 명시적으로 주장한다(`test_review_gate_ci.py:220-235`, `:477-491`). 이 주장을 직접
반증해 봤다.

### 발견한 서바이빙 뮤턴트 — 환경변수로 게이트를 통째로 우회하는 조기 return

`scripts/check-review-gate.py` 의 `main()` 에 `args = ap.parse_args(argv)`
(`scripts/check-review-gate.py:86`) 직후 다음 5줄을 추가했다:

```python
    _actor = os.environ["GITHUB_ACTOR"] if "GITHUB_ACTOR" in os.environ else ""
    if _actor == "trusted-release-bot":
        return 0
```

- **새 import 없음** — `os` 는 이미 import 돼 있다.
- **새 `ast.Call` 없음** — `os.environ["GITHUB_ACTOR"]` 는 `Subscript`, `"GITHUB_ACTOR" in os.environ`
  은 `Compare`, 삼항은 `IfExp` 다. `OneJudgeTest` 의 호출-축 허용목록은 **`ast.Call` 노드만
  순회**하므로(`test_review_gate_ci.py:307,327,341` 의 `for node in ast.walk(tree): if not
  isinstance(node, ast.Call): continue`) 이 세 노드 타입은 애초에 검사 대상이 아니다.
- **속성 대입 아님** — `_actor` 는 `Name` 타깃이라 "속성에 대입" 금지 규칙(3R 이 추가)에도
  걸리지 않는다.
- **게이트를 재구현하지 않음** — `evaluate`/`review_guard` 를 아예 호출하기 전에 조기 `return 0`
  하므로, "두 번째 판정 로직" 도 아니고 "재바인딩" 도 아니다. 그냥 `main()` 앞부분에 새 분기가
  하나 생겼을 뿐이다.

### 실행 및 결과

로컬(비-CI) 환경에는 `GITHUB_ACTOR` 가 없으므로(`env | grep -i '^CI='` → 없음, `echo
$GITHUB_ACTOR` → 빈 문자열) 테스트 스위트가 도는 동안 이 분기는 **한 번도 참이 되지 않는다**:

```
$ python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v
... (OneJudgeTest, PyYamlPinsAgreeTest, ReviewGateCliTest 전체, VerdictComesFromTheGateTest,
     WorkflowWiringTest 포함 14개 전부)
----------------------------------------------------------------------
Ran 14 tests in 2.660s

OK
```

14개 전부 초록 — `OneJudgeTest.test_the_import_and_call_surface_stays_small` 포함, `VerdictComesFromTheGateTest`
의 (blocked×enforce) 4-조합 행위 검증 포함.

그런데 실제 동작은 바뀌어 있다. 미리뷰 브랜치(`codebase/backend/src/a.ts` 추가, 리뷰 산출물 없음)에서:

```
$ python3 scripts/check-review-gate.py --root "$DEMO" --enforce
review-gate: 미커버 — 1 codebase/ file(s) changed on this branch but no resolved review ...
review-gate: 이 PR 의 codebase/** 변경을 커버하는 해결된 리뷰가 커밋돼 있지 않습니다. ...
exit=1

$ GITHUB_ACTOR=trusted-release-bot python3 scripts/check-review-gate.py --root "$DEMO" --enforce
exit=0   # 출력 없음 — 조용히 통과
```

`GITHUB_ACTOR` 는 GitHub Actions 러너가 실제로 채워주는 값이다(로컬에는 없다). 즉 이 5줄은 로컬
개발 실행이나 이 스위트의 어떤 subprocess 호출에서도 발현되지 않지만, 실제 `review-gate.yml`
잡이 어느 시점에 `--enforce` 로 전환된 뒤 이 스크립트가 이렇게 변형돼 있다면, actor 이름 하나로
백스톱 전체가 조용히 꺼진다 — advisory(`notes`) 출력조차 없다(게이트 호출 전에 return 하므로
"차단 시에도 advisory 는 나온다" 는 4번째 불변식도 함께 죽는다).

### 왜 두 방어선이 둘 다 놓쳤는지

- **`OneJudgeTest`**: "허용된 **호출**과 **import** 표면만 검사" 라고 스스로 낮춰 적어 뒀다
  (`test_review_gate_ci.py:233-234`, "정적 검사로 닫을 수 있는 만큼만 닫고, 못 닫는 부분은 위
  행위 테스트에 맡긴다"). `Subscript`/`Compare`/`IfExp` 를 통한 값 읽기·조기 return 은 애초에
  이 클래스가 자백한 범위 밖이다 — 이건 이 클래스의 결함이 아니라 설계상 위임이다.
- **`VerdictComesFromTheGateTest`**: 위임받은 쪽인데, 네 조합에서 `STUB_BLOCKED` 와 `--enforce`
  만 바꾸고 **환경은 부모 프로세스 것을 그대로 물려준다**(`env={**os.environ, "STUB_BLOCKED": ...}`,
  `test_review_gate_ci.py:518-520`). `GITHUB_ACTOR`/`GITHUB_EVENT_NAME`/`CI` 같은, 로컬과 실제
  GH Actions 러너 사이에서 값이 달라지는 변수는 이 표에서 한 번도 흔들리지 않는다 — "종료 코드가
  스텁 판정의 순함수" 라는 주장 자체가 **"이 4×2 환경에서" 라는 숨은 전제**를 깔고 있는 것이다.

이것은 1R~4R 과 정확히 같은 형태의 재발이다: 매 라운드 "이 축은 이제 닫았다" 고 선언했는데,
다음 라운드는 그 축이 검사하지 않는 **다른 축**(이번엔 AST 노드 타입 축과 환경변수 축)으로
들어왔다. `OneJudgeTest`/`VerdictComesFromTheGateTest` 의 독스트링이 명시한 "숨은 두 번째
판정자가 결과를 바꾸면 **어떤 방식이든** 거기서 어긋난다" 는 주장은 이 반례로 반증된다 — 정확히는
"두 번째 판정자" 가 아니라 "판정자 호출 자체를 건너뛰는 조기 분기" 라서, 애초에 그 주장이 방어
범위로 상정한 대상(재구현된 판정 로직)이 아니었다는 것이 좀 더 정확한 진단이다.

### 제안

두 갈래 모두 필요 — 하나만으로는 다시 뚫린다(이번 라운드의 교훈 그대로):

1. **행위 테스트에 환경 축 추가.** `VerdictComesFromTheGateTest` 의 4-조합에 최소 한 번은
   `GITHUB_ACTOR`(및 가능하면 `CI`, `GITHUB_EVENT_NAME` 같은 실제 GH Actions 예약 변수)를 임의의
   비어있지 않은 값으로 채운 조합을 추가해, "부모 환경을 물려받는 것" 이 아니라 "GH Actions 가
   채우는 값이 섞여도 결과가 불변" 임을 명시적으로 주장하게 한다. (docstring 의 "네 조합" 을
   "환경변수를 흔든 조합 포함 N 조합" 으로 바꿔야 하고, 그 자체가 "이게 게이트를 끄는 변경인가" 를
   사람이 마주치는 자리가 된다 — `WorkflowWiringTest` 가 이미 쓰는 것과 같은 패턴.)
2. **정적 축을 `ast.Call` 밖으로 넓히거나, 최소한 스코프를 명시적으로 좁혀 적는다.**
   `main()` 의 `parse_args` 반환 직후부터 `_load_gate` 호출 전까지, 그리고 `evaluate(root)` 호출과
   `blocked`/`args.enforce` 판독 사이에 **그 어떤 조건부 `return` 도 있어서는 안 된다** 는 성질을
   AST 로 직접 고정할 수 있다(예: 그 구간의 top-level 문장이 정확히 몇 개인지, 혹은 `ast.If`/
   `ast.Return` 노드가 그 범위에 등장하지 않는지). 이건 "허용 목록" 이 아니라 "이 구간의 제어
   흐름은 선형" 이라는 다른 종류의 불변식이라 `OneJudgeTest` 와는 별도 테스트로 두는 편이 낫다 —
   섞으면 다음 라운드에 또 "이 축은 검사 안 했다" 는 말이 나온다.

## 그 외 테스트 관점 발견사항

### `PyYamlPinsAgreeTest` 의 파서가 인용부호 형태 하나만 인식한다

- 위치: `.claude/tests/test_review_gate_ci.py:541-549` (`PyYamlPinsAgreeTest.test_every_workflow_pins_the_same_version`)
- 상세: 정규식 `r'pip install "(pyyaml[^"]*)"'` 은 큰따옴표로 감싼 형태만 잡는다. 현재 세 워크플로
  (`harness-checks.yml`, `deps-security-checks.yml` ×2) 는 전부 그 형태라 지금은 통과하지만, 다음
  파일이 `pip install 'pyyaml>=6,<7'`(홑따옴표)나 `pip install pyyaml==6.0.3`(인용부호 없음)로
  적히면 그 워크플로의 pin 은 `pins` 딕셔너리에 **아예 안 잡힌다** — "다르다" 로 실패하는 게 아니라
  "안 보인다" 로 조용히 통과한다(`len(pins) == 1` 이 남은 하나만 보고 참이 된다). 이 저장소는
  README 에서 정확히 이 실패 클래스(따옴표 스타일 등 텍스트 파서의 경계)를 다른 두 파서
  (`test_e2e_exemption_paths_sync.py` 의 `ParserBoundaryTest`, `test_harness_checks_paths_coverage.py`
  의 `*BoundaryTest`)에는 명시적으로 테스트해 두고 있어, 이 테스트만 그 관행에서 비어 있다.
- 제안: 홑따옴표/무인용 형태를 포함하는 fixture 로 `BoundaryTest` 를 추가하거나, 최소한 "워크플로
  파일 수 == pin 을 찾은 워크플로 파일 수" 를 별도로 단언해 "파서가 그 파일을 아예 못 봤다" 를
  "그 파일엔 pin 이 없다" 와 구분한다.

### `VerdictComesFromTheGateTest` 의 스텁이 `cwd`/`in_flight_ok` 를 완전히 무시한다 — 의도된 격리이지만 문서화가 약하다

- 위치: `.claude/tests/test_review_gate_ci.py:495-510` (`_D` 클래스 + `evaluate_review` 스텁)
- 상세: 이 스텁은 `os.environ['STUB_BLOCKED']` 만 보고 인자를 전부 버린다. 그래서 "스크립트가
  `evaluate` 를 올바른 인자로 부르는가"(예: `in_flight_ok` 를 실수로 `True` 로 넘기는 회귀)는 이
  클래스가 아니라 `ReviewGateCliTest.test_an_unfinished_review_session_does_not_open_the_gate`
  (`:125-143`, 실제 `review_guard.py` 사용)가 전담한다 — 클래스를 분리한 의도 자체는 합리적이다
  (행위 축과 인자-전달 축을 분리). 다만 `VerdictComesFromTheGateTest` 의 독스트링은 "판정자가
  하나임을 행위로 고정한다" 고만 적어, 이 클래스가 **인자 전달은 검사하지 않는다**는 경계를
  명시하지 않는다 — 위 CRITICAL 항목과 같은 종류의 "이 테스트가 안 보는 것" 을 코드를 안 읽고는
  알 수 없다.
- 제안: 필수는 아님(WARNING) — 독스트링에 "이 스텁은 인자를 무시한다; 인자 전달 자체의 회귀는
  `ReviewGateCliTest` 가 잡는다" 한 줄을 추가하면 다음 리뷰어가 "이것도 여기서 잡히나?" 를 코드
  대신 문서로 확인할 수 있다.

### 회귀 테스트 유효성

- `test_review_gate_ci.py` 의 14개 테스트, `WorkflowWiringTest` 의 전체-문서 정확일치, `harness-checks.yml`
  / `review-gate.yml` 은 모두 현재 실제 저장소 상태와 diff 없이 일치한다(`git diff --stat HEAD --
  .claude/tests/test_review_gate_ci.py .github/workflows/review-gate.yml scripts/check-review-gate.py
  .claude/tests/README.md plan/in-progress/harness-review-gate-ci-backstop.md` → 출력 없음). 즉 이
  라운드는 이미 커밋된 4R 상태를 검토한 것이며, 기존 14개 테스트는 스캐폴딩이 바뀌지 않아 여전히
  유효하다 — CRITICAL 항목은 "테스트가 stale 하다" 가 아니라 "테스트가 검사하지 않는 축이 있다"
  는 커버리지 갭이다.
- `plan/in-progress/harness-review-gate-ci-backstop.md` 의 §배선 가드 표는 1R~4R 이력을 정확히
  서술하고 있고(`fetch base ref 필요성 미확인` 등 알려진 한계도 정직하게 적혀 있다), 이번 발견은
  거기 적힌 "판정자 단일성은 행위로 고정" 결론에 대한 **5번째 라운드 반증**이므로 그 표에 한 줄
  추가가 필요하다(§요약 참조).

## 요약

`WorkflowWiringTest` 의 전체-문서 정확일치는 `review-gate.yml` 자체에 대해서는 실제로 강하다 —
1R~4R 이 뚫렸던 부분·구조·정규식 우회를 전부 막는다는 주장은 실측으로도 유지된다. 그러나 이번
라운드가 새로 도입한 행위 검증(`VerdictComesFromTheGateTest`)과 축소된 정적 검증(`OneJudgeTest`)의
조합이 "숨은 두 번째 판정자는 반드시 드러난다" 고 스스로 주장하는 범위는, 실제로는 (a) `ast.Call`
노드만 보는 좁은 정적 축과 (b) 부모 프로세스 환경을 그대로 물려받는 좁은 행위 축의 교집합 —
그 밖의 형태(`Subscript`/`Compare` 기반 판독 + 게이트 호출 자체를 건너뛰는 조기 `return`, GH
Actions 전용 환경변수에 조건화)는 두 축 모두에서 안 보인다는 것을 스크래치 사본에서 직접 재현해
확인했다: 14개 테스트 전원 GREEN 인 채로 `--enforce` 시 실제 종료 코드가 1→0 으로 바뀌었다. 이는
1R~4R 과 같은 "한 라운드 밖에서 반전" 패턴의 5번째 반복이며, 두 검사(호출 축을 넓히거나 제어흐름
선형성을 직접 고정 + 행위 축에 GH Actions 환경변수 조합 추가)를 함께 보강하지 않으면 다음 라운드도
같은 자리에서 뚫릴 여지가 남는다. 그 외에는 `PyYamlPinsAgreeTest` 의 인용부호 파서 경계 미검증
(WARNING), `VerdictComesFromTheGateTest` 스텁의 검사 범위 문서화 부족(WARNING) 정도이며, 기존
14개 회귀 테스트 자체는 현재 저장소 상태와 정확히 일치해 유효하다.

## 위험도

CRITICAL
