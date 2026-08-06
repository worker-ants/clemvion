# 부작용(Side Effect) Review — round 5 (`review-gate.yml` / `check-review-gate.py` / `test_review_gate_ci.py`)

## 방법론

`mktemp -d`로 만든 격리 디렉터리(`/var/folders/.../tmp.xJLUd9uXh4/repo`)에 `.claude/`,
`scripts/`, `.github/workflows/{review-gate,harness-checks}.yml`을 복사해 실측했다. 실제
저장소 워크트리는 건드리지 않았다(`cd`는 절대경로 뒤 `&&`로만 사용, 모든 파일 조작은 스크래치
경로에 대해서만). 세션 종료 시 스크래치 디렉터리는 삭제했다. 아래 명령·출력은 그 격리 사본에서
그대로 실행한 것이다.

## 발견사항

- **[CRITICAL]** `os.environ`에 대한 **비-호출(non-Call) 읽기**로 CI 판정을 뒤집는 조건문은
  `OneJudgeTest`(정적)와 `VerdictComesFromTheGateTest`(행위) 양쪽 모두를 통과한다 — 라운드
  1~4가 "부분에 대한 정확 일치는 여전히 부분 일치"라고 결론 내린 바로 그 실패 클래스가,
  `.yml` 문서에서는 닫혔지만 `.py` 스크립트 쪽에는 아직 열려 있다.
  - 위치: `scripts/check-review-gate.py:100-102`(`decision.blocked` / `decision.reason`를
    읽는 지점 — 여기 바로 뒤에 조건부 override를 삽입) · `.claude/tests/test_review_gate_ci.py:265-355`
    (`OneJudgeTest.test_the_import_and_call_surface_stays_small` — `ast.Call`과 대입 대상
    `ast.Attribute`만 순회) · `.claude/tests/test_review_gate_ci.py:493-527`
    (`VerdictComesFromTheGateTest` — 네 조합 모두 ambient env를 그대로 상속해 `STUB_BLOCKED`만
    바꾼다).
  - 상세: `OneJudgeTest`는 스크립트의 `ast.Call` 노드와 대입 **대상**(target)인 `ast.Attribute`
    노드만 검사한다. `ast.Compare`(`in`, `==`)와 `ast.Subscript`(인덱싱 읽기)는 전혀 순회하지
    않는다. 그런데 `os.environ["X"] == "1"` 같은 값 읽기는 **호출이 아니다** — `in`/`==`/
    subscript만으로 조합할 수 있다. `main()`의 `decision.blocked`를 읽은 직후에

    ```python
    if "REVIEW_GATE_SKIP" in os.environ and os.environ["REVIEW_GATE_SKIP"] == "1":
        blocked = False
    ```

    를 추가해 실측했다. 새 `import`도, 새 `Call`도, 속성 대입도 없다 — 세 검사 축 전부를
    피해 간다. 그리고 `VerdictComesFromTheGateTest`는 `env={**os.environ, "STUB_BLOCKED": ...}`
    로 **현재 ambient 환경을 그대로 물려주고 그 위에 `STUB_BLOCKED`만 얹으므로**, 테스트
    프로세스 환경에 없는 임의의 변수 이름을 조건으로 쓰면 네 조합 전부 원래 기대값대로
    통과한다. 실제로 격리 사본에서 전체 스위트(14 tests)가 그대로 GREEN이었다:

    ```
    $ python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v
    ...
    Ran 14 tests in 3.036s
    OK
    ```

    (mutation 전/후 산출 동일 — `OneJudgeTest`, `VerdictComesFromTheGateTest`,
    `ReviewGateCliTest` 전 항목, `WorkflowWiringTest` 전부 `ok`.)

    실제 판정이 바뀌는 것도 end-to-end로 확인했다 — `_unreviewed_branch()`와 동일한 조건의
    실제 임시 git 저장소(리뷰 미해결, `codebase/` 파일 1개 변경)에 대해:

    ```
    $ python3 scripts/check-review-gate.py --root $DEMO --enforce
    review-gate: 미커버 — 1 codebase/ file(s) changed on this branch but no resolved
                 review (review/code/**/SUMMARY.md) was found.
    ...
    exit=1

    $ REVIEW_GATE_SKIP=1 python3 scripts/check-review-gate.py --root $DEMO --enforce
    review-gate: 통과 — 1 codebase/ file(s) changed on this branch but no resolved
                 review (review/code/**/SUMMARY.md) was found.
    exit=0
    ```

    같은 저장소 상태, 같은 `reason` 문자열인데 환경변수 하나로 미커버 → 통과 → exit 1 → 0.
    이것이 바로 `check-review-gate.py`의 docstring이 "판정자는 하나다"라고 못 박은 바로 그
    회귀다 — 다만 이번엔 리뷰-게이트 워크플로 YAML을 **전혀 건드리지 않고**, `.py` 파일
    하나의 diff만으로 성립한다. `WorkflowWiringTest`는 워크플로 문서 전체를 고정하지만
    `check-review-gate.py`는 그런 "문서 전체 대조" 짝이 없다 — 이 라운드가 `.yml`에는
    적용한 교훈("열거로는 끝나지 않는다")을 `.py`에는 아직 적용하지 않았다.
  - 제안: `OneJudgeTest`가 `ast.Call`/대입-대상 `ast.Attribute`뿐 아니라 `ast.Compare`,
    `ast.BoolOp`, `ast.Subscript`, `ast.IfExp`도 순회해 우변이 `os.environ`/`sys.argv`/
    임의 모듈 속성으로 귀결되는지 검사하거나(같은 종류의 무한 표면 문제를 다시 만날 수
    있음을 유의), 더 근본적으로는 `main()`이 `decision.blocked`를 읽은 뒤 **그 값을 조건
    없이 그대로 반환값에 반영**하도록 소스 라인 수를 극히 좁게 고정(문자열/AST 아닌
    **바이트 diff** 고정, `WorkflowWiringTest`가 `.yml`에 한 것과 대칭)하거나,
    `VerdictComesFromTheGateTest`의 네 조합을 "임의의 환경변수 하나를 무작위로 오염시킨
    두 번 반복 실행이 같은 결과를 내는지"까지 확장해 은닉 채널 자체를 행위로 좁히는 방법을
    검토할 것.

- **[WARNING]** 위 결함이 일반화하는 클래스: `OneJudgeTest`의 스캐너는 "호출"만 재구현의
  신호로 본다. 그러나 `decision.reason`/`decision.notes`의 **내용**을 `==`/`in`으로
  비교해 분기하는 것도 같은 구멍이다 — 예: `if "특정 문자열" in reason: blocked = False`.
  이 변형은 외부 트리거(환경변수) 없이도 성립하므로 CI 워크플로를 전혀 안 바꿔도 스크립트
  단독 PR로 배포 가능하다. 다만 `ReviewGateCliTest`가 실제 게이트를 호출하는 시나리오(미해결
  리뷰 branch)와 정확히 같은 `reason` 문자열을 만들어내므로, 그 정확한 문자열을 표적으로
  삼으면 `test_enforce_turns_the_same_verdict_into_a_failure` 등 기존 테스트가 곧바로 깨진다
  — 즉 "현재 테스트가 이미 커버하는 정확한 시나리오"는 방어되지만, **테스트가 다루지 않는
  reason 문형**(예: 다른 파일 패턴·다른 세션 상태가 만드는 변형된 문구)을 표적으로 하면
  여전히 뚫린다. 환경변수 버전보다 은밀성은 낮지만(리뷰어가 `reason` 비교 코드를 눈으로
  보면 의심스럽다) 공격 표면 자체는 동일 카테고리(비-Call 분기)다.
  - 위치: `scripts/check-review-gate.py:101-102`(같은 삽입 지점), 검사 공백은
    `.claude/tests/test_review_gate_ci.py:307-323`(호출 노드만 순회하는 루프).
  - 제안: 위 CRITICAL 항목과 같은 수선으로 함께 닫힌다 — 별도 대응 불필요.

- **[INFO]** 작업 시작 시점에 워크트리에 이미 존재하던, 이 리뷰가 만들지 않은 미커밋 변경.
  `git status`가 `M .claude/tests/test_workflow_yaml_structure.py`를 보고했다 — 이 세션이
  건드린 적이 없는 파일이다(격리 스크래치 사본에만 조작을 가했고, 그마저도 이 파일을
  복사하지 않았다). 내용은 `continue-on-error`를 모든 워크플로의 모든 job/step에 걸쳐
  금지하는 `test_no_guard_workflow_swallows_its_own_failure`를 추가하는 것으로 보이며,
  방향성은 이번 라운드의 교훈("review-gate.yml 하나에만 건 방어는 harness-checks.yml의
  같은 실패로 재발할 수 있다")과 합치하지만 **아직 커밋되지 않은 작업 중 상태**다. 작업
  트리 규칙("예상치 못한 git status는 고치지 말고 보고")에 따라 손대지 않았다 — orchestrator가
  이 상태가 이번 라운드의 의도된 진행 중 산출물인지, 다른 세션이 남긴 것인지 확인 필요.
  - 위치: `.claude/tests/test_workflow_yaml_structure.py` (diff는 기존 `WorkflowStructureTest`
    클래스 뒤에 새 메서드 `test_no_guard_workflow_swallows_its_own_failure` 추가; 정확한
    삽입 줄은 현재 워크트리의 unstaged diff 참조 — 아직 커밋 전이라 게이트 숫자를 이 리뷰
    산출물에 고정하지 않는다).
  - 제안: 커밋할 의도라면 커밋하고 이번 라운드 plan 문서(`plan/in-progress/harness-review-gate-ci-backstop.md`)에
    반영, 실수로 남은 것이면 정리.

## 요약

이번 라운드가 `.github/workflows/review-gate.yml`에 적용한 "부분 일치가 아니라 문서 전체를
고정"이라는 교훈은 YAML 쪽에서는 실제로 라운드 1~4의 네 가지 우회를 전부 닫았다(격리
사본에서 재현·확인). 그러나 같은 교훈이 `scripts/check-review-gate.py` 쪽에는 아직 적용되지
않았다: `OneJudgeTest`(정적 AST 허용 목록)와 `VerdictComesFromTheGateTest`(4-조합 행위 고정)
는 둘 다 "판정을 바꾸는 로직은 함수 호출로 나타난다"는 암묵적 가정 위에 서 있는데, `ast.Compare`/
`ast.Subscript`만으로 조립한 조건부 override는 그 가정 밖에 있다. 실측으로 환경변수 하나
(`REVIEW_GATE_SKIP`, 워크플로 YAML에는 전혀 선언되지 않은 이름)를 조건으로 삼는 5줄짜리
패치를 만들어 전체 테스트 스위트(14/14)를 GREEN으로 유지한 채, 실제 미해결-리뷰 시나리오의
`--enforce` 종료 코드를 1→0으로 뒤집는 데 성공했다. 이는 CI를 실제로 건드리지 않고
`.github/workflows/review-gate.yml`을 전혀 수정하지 않아도(≠ 이번 과제가 제외한 "기대값과
워크플로를 함께 고치는" 케이스) `scripts/check-review-gate.py` 단독 diff만으로 성립하므로,
"판정자는 하나다"라는 이 층의 핵심 불변식이 아직 완전히 닫히지 않았다는 뜻이다. 부작용
관점에서는 정확히 체크리스트 6번(환경 변수의 예상치 못한 읽기)이 이 CI 게이트의 신뢰성을
무너뜨리는 벡터로 실증된 사례다.

## 위험도

CRITICAL
