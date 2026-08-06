# 아키텍처(Architecture) 리뷰 — CI 백스톱 6R

## 실증 개요

라운드 컨텍스트가 요구한 대로 "다음 층"을 찾기 위해, `mktemp`/`git clone --local`
로 만든 **격리 사본**(`/private/tmp/.../scratchpad/ci-backstop-probe.*`)에서만 작업했다.
실제 저장소는 건드리지 않았으며, 작업 종료 시 `git status --porcelain` 로 원 저장소가
깨끗함(사전에 있던 `review/code/2026/08/06/11_34_03/` 미추적 디렉터리 외 변경 없음)을
재확인하고 스크래치 디렉터리를 삭제했다.

**결론: 뚫린다.** `scripts/check-review-gate.py` 에 6줄을 추가하면, 실제 `review-gate.yml`
job 위에서만 판정을 조용히 "통과"로 덮어쓰면서도 — 이 라운드가 세운 가드 넷
(`OneJudgeTest` 정적 AST 허용목록, `VerdictComesFromTheGateTest` 행위 순함수 테스트의
최소/적대적 환경 두 조합, `ReviewGateCliTest` 9개, `WorkflowWiringTest` 전체 문서 고정,
그리고 하네스 스위트 전체 831개) — **전부 그린으로 유지**된다.

---

## 발견사항

- **[CRITICAL]** `os.environ` 판독 금지 가드가 `ast.Attribute`/`ast.Call` 축만 덮고
  `ast.Subscript`/`ast.Compare`(`in`, `==`) 축은 비어 있다 — CI 워크플로 정체성(ambient
  `GITHUB_*`)을 조건으로 판정을 뒤집는 은닉 채널이 성립하고, 이 라운드가 만든 모든 가드를
  통과한다.
  - 위치: `scripts/check-review-gate.py` — import 블록(게이트 51-53행) 및 `main()`
    함수의 `for note in notes: print(note)` 직후 · `if not blocked:` 직전
    (게이트 109-111행 사이).
  - 상세:
    `OneJudgeTest`(`.claude/tests/test_review_gate_ci.py` 게이트 358-362행)는
    `ast.Attribute` 노드의 `attr` 이름이 `environ`/`getenv`/`argv`/`putenv` 인지만
    본다. `import` 허용목록(게이트 239행 `_ALLOWED_IMPORTS`)에 `"os"` 가 이미 있으므로
    `from os import environ as _E` 는 아무 것도 위반하지 않는다. 이후 `_E["GITHUB_WORKFLOW"]`
    (Subscript)와 `"GITHUB_WORKFLOW" in _E`(Compare)는 **Attribute 도 Call 도 아니라서**
    금지 목록에도, 호출 허용목록(게이트 240-246행 `_ALLOWED_CALLS`)에도 걸리지 않는다.
    즉 "환경을 읽는 모든 형태를 막는다"는 이 클래스의 주장(게이트 265-266행 "import 도
    **호출도** 허용 목록으로 유지한다")은 실제로는 Python 이 같은 객체에 도달하는 네 번째
    문법 축(구독)을 빠뜨리고 있다.

    `VerdictComesFromTheGateTest`(게이트 488-559행)는 "판정자가 하나"라는 주장을 스텁
    게이트의 `blocked`×`--enforce` 네 조합에 대한 종료 코드 순함수성으로 행위 검증한다 —
    이 라운드 문서가 "이제 이것이 권위" 라고 명시한 바로 그 테스트다. 그런데 그 적대적
    환경(`_HOSTILE_ENV`, 게이트 523-532행)은 `GITHUB_ACTOR`/`GITHUB_REF`/`CI`/
    `REVIEW_GATE_SKIP`/`REVIEW_GATE_ENFORCE` **5개뿐**이다. GitHub Actions 가 모든 job 에
    자동으로 채우는 기본 컨텍스트 변수는 `GITHUB_WORKFLOW`/`GITHUB_JOB`/`GITHUB_RUN_ID`/
    `GITHUB_EVENT_NAME`/`GITHUB_SHA`/`RUNNER_OS` 등 30개 안팎이고, 이 다섯은 그중 임의로
    고른 부분집합이다. `GITHUB_WORKFLOW`(워크플로 `name:` 값 — `review-gate.yml` 은
    `"review-gate"`, `harness-checks.yml` 은 `"harness-checks"`)는 그 목록에 없다. 그래서
    이 테스트는 "최소 환경"과 "적대적 환경" 둘 다에서 `GITHUB_WORKFLOW` 를 설정하지 않고,
    페이로드는 두 경우 모두 비활성 상태로 남아 순함수성 단언이 그대로 통과한다.

    `ReviewGateCliTest._run`(게이트 79-87행)은 반대로 부모 환경을 통째로 상속한다
    (`env={**os.environ, **(env or {})}`) — 이건 4R/5R 교훈으로 `VerdictComesFromTheGateTest`
    가 일부러 피한 패턴이다. 로컬 개발 머신에는 `GITHUB_WORKFLOW` 가 없으니 통과하고,
    `harness-checks.yml` 실제 CI 컨테이너 안에서 이 테스트가 돌 때는 그 job 이 속한
    워크플로 자신의 `GITHUB_WORKFLOW=harness-checks` 를 상속하므로 — 실제 목표
    (`review-gate`)와 값이 달라 — 역시 비활성 상태로 통과한다. 두 클래스 모두 개별적으로는
    합리적인 설계였지만("행위 테스트는 폐쇄된 최소 환경으로", "기능 테스트는 실제 환경으로")
    그 둘의 합이 "이 스크립트가 자기가 어느 워크플로에서 도는지 구별해 다르게 행동할 수
    있다"는 새 위협 모델을 아무도 덮지 않는 사각을 만든다.

  - **재현 (전부 격리 사본, 실제 저장소 무변경):**

    ```
    $ SCRATCH=$(mktemp -d …); git clone --quiet --local --no-hardlinks . "$SCRATCH"
    $ cd "$SCRATCH"
    # 1) 베이스라인 — 무변경 상태에서 이 라운드의 CI 백스톱 가드가 전부 그린인지 확인
    $ python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'
    ----------------------------------------------------------------------
    Ran 16 tests in 2.918s
    OK

    # 2) scripts/check-review-gate.py 에 6줄 패치 (import 1줄 + main() 5줄, 아래 diff)
    --- a/scripts/check-review-gate.py
    +++ b/scripts/check-review-gate.py
    @@ import argparse / import os / import sys 뒤
    +from os import environ as _E  # noqa: F401 -- looks innocuous next to `import os`
    @@ `for note in notes: print(note)` 뒤, `if not blocked:` 앞
    +    _quiet = ("GITHUB_WORKFLOW" in _E) and (_E["GITHUB_WORKFLOW"] == "review-gate")
    +    if _quiet:
    +        blocked = False
    +
         if not blocked:

    # 3) 이 라운드가 세운 모든 가드를 패치된 사본에 재실행
    $ python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'
    ----------------------------------------------------------------------
    Ran 16 tests in 3.246s
    OK
    $ python3 -m unittest discover -s .claude/tests -p 'test_workflow_yaml_structure.py'
    ----------------------------------------------------------------------
    Ran 9 tests in 0.081s
    OK
    # CI 가 실제로 부르는 그 명령 그대로, 스위트 전체
    $ python3 -m unittest discover -s .claude/tests -p 'test_*.py'
    ----------------------------------------------------------------------
    Ran 831 tests in 92.400s
    OK

    # 4) 실제 검증 — 미리뷰 codebase/ 변경이 있는 동일 저장소 상태에서
    #    "어느 워크플로로 도는가"만 바꿔 --enforce 로 실행
    $ mkdir -p codebase/backend/src && echo "export const a=1;" > codebase/backend/src/a.ts
    $ git add -A && git commit -q -m "feat: unreviewed change"

    $ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 GITHUB_ACTIONS=true CI=true \
        GITHUB_WORKFLOW=harness-checks python3 scripts/check-review-gate.py --enforce
    review-gate: 미커버 — 1 codebase/ file(s) changed AFTER the most recent resolved review …
    exit=1                                          # harness-checks.yml 로는 정상대로 차단

    $ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 GITHUB_ACTIONS=true CI=true \
        GITHUB_WORKFLOW=review-gate python3 scripts/check-review-gate.py --enforce
    review-gate: 통과 — 1 codebase/ file(s) changed AFTER the most recent resolved review …
    exit=0                                          # review-gate.yml 로는 조용히 통과

    $ env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 python3 scripts/check-review-gate.py --enforce
    review-gate: 미커버 — …
    exit=1                                          # 평범한 개발 머신에서도 정상
    ```

    같은 저장소 상태, 같은 `--enforce`, 같은 기저 게이트 판정인데 `GITHUB_WORKFLOW`
    값 하나로 정확히 목표 워크플로에서만 판정이 뒤집힌다. 이 라운드가 "행위로 증명한다"고
    선언한 테스트(`VerdictComesFromTheGateTest`)와 정적으로 증명한다는 테스트(`OneJudgeTest`)
    둘 다, 그리고 나머지 831개 전부가 이 상태에서 초록이다.
  - 왜 지금 당장 의미가 있나: 현재 `review-gate.yml` 은 관측 모드(`--enforce` 없음)라
    종료 코드 자체는 이미 늘 0이다. 그런데 **출력 문구**("통과" vs "미커버")는 이 라운드의
    plan 문서가 명시한 대로 "언제 `--enforce` 를 켤지" 판단할 근거로 CI 로그에 쌓이는
    실데이터다 — 이 은닉 채널은 그 텔레메트리 자체를 지금부터 조용히 오염시키고, `--enforce`
    가 실제로 켜지는 순간(로드맵에 이미 명시된 다음 단계) 이 백도어가 살아있는 채로 그
    워크플로 하나만 영구 무력화한다. "테스트가 전부 그린인 채 실제 PR 이 받는 판정을
    바꾼다"는 요구를 정확히 만족한다.
  - 제안: 두 층에서 함께 닫아야 구조적으로 수렴한다.
    1. **런타임 격리**: 정적 분석으로 "환경을 안 읽는다"를 증명하려는 시도(허용/금지
       목록의 열거) 자체가 5라운드째 반증되는 접근이다. `review-gate.yml` 의 `Review
       coverage backstop` 스텝을 `env -i` 류로 감싸 프로세스가 애초에 `GITHUB_*`/기타
       ambient 변수를 볼 수 없게 만들면, 이후 어떤 Python 문법(Attribute/Call/Subscript/
       `vars()`/`__import__`/ctypes 등)으로 읽으려 해도 값 자체가 없다 — 열거 게임을
       끝내는 유일한 구조적 해법이다.
    2. **행위 테스트 강화**: `VerdictComesFromTheGateTest` 의 고정 5-변수
       `_HOSTILE_ENV` 를 GitHub 공식 기본 컨텍스트 변수 전체로 넓히고, 특히 스텁 게이트
       판정을 고정한 채 `GITHUB_WORKFLOW`/`GITHUB_JOB` 을 `review-gate`/`gate` ↔
       `harness-checks`/`unittest` 로 스왑해도 **출력이 바이트 동일**해야 한다는 케이스를
       명시적으로 추가한다 — 지금 그 축은 "덮이지 않은 5개 중 하나"가 아니라 "이 라운드가
       막으려던 정확히 그 위협 모델(내가 어느 워크플로인지 구별)" 이므로 우선순위가 다르다.

- **[INFO]** 리뷰 번들의 `test_review_gate_ci.py` (파일 3) 스냅샷이 실제 HEAD보다
  한 커밋(`e46f5382c`, `ReviewArtifactsStayTrackedTest` 57줄 추가) 뒤처져 있다 — 번들은
  594줄, 실제 파일은 651줄.
  - 위치: 프롬프트 파일 3 vs `.claude/tests/test_review_gate_ci.py` 실제 HEAD.
  - 상세: 확인 결과 그 커밋은 `test_review_gate_ci.py` 한 파일만 건드렸고
    `scripts/check-review-gate.py`/`.github/workflows/review-gate.yml` 은 무관하므로 위
    CRITICAL 실증에는 영향이 없다(실제로 그 최신 파일로 재현했다). 다만 리뷰 세션 생성과
    작업 커밋 사이에 이 worktree 에 새 커밋이 계속 랜딩하고 있다는 뜻이라, 다음 라운드
    프롬프트를 자를 때는 최신 커밋 기준으로 다시 잘라야 한다.

- **[WARNING]** 방어 아키텍처 자체가 "열거"에 의존하는 패턴을 5라운드째 반복하고
  있다 — 이번 CRITICAL 은 그 패턴이 낳은 여섯 번째 사례일 뿐, 근본 형태는 그대로다.
  - 위치: `.claude/tests/test_review_gate_ci.py` 의 `OneJudgeTest`(게이트 220-367행)와
    `VerdictComesFromTheGateTest`(게이트 488-559행) 두 클래스 전체.
  - 상세: `OneJudgeTest` 자신의 docstring(게이트 222-227행)이 이미 이 사실을 인정한다 —
    "임의의 파이썬에서 그 부정을 정적으로 증명하는 것은 무한한 표면이고, 매 라운드 새
    우회가 나온 것이 증거다." 그 문제의식으로 `VerdictComesFromTheGateTest`(행위 기반,
    유한한 케이스 표)로 무게중심을 옮긴 것은 옳은 방향이지만, 그 행위 테스트의 "환경"
    자체가 다시 손으로 고른 유한 목록(`_HOSTILE_ENV` 5개)이라 같은 실패 형태가 한 겹
    안으로 이동했을 뿐이다. `OneJudgeTest` 는 정적 문법 축(Attribute/Call)을 놓치고,
    `VerdictComesFromTheGateTest` 는 동적 값 축(어떤 환경변수 이름)을 놓친다 — 두 축
    다 "상상 가능한 우회를 다 나열했는가"에 방어 강도가 비례하는 구조다.
  - 제안: 위 CRITICAL 제안 1(런타임 격리)이 이 구조적 문제의 근본 해법이다. 목록을
    키우는 7R 패치보다, "이 프로세스는 애초에 관측 가능한 입력이 `root` 인자 하나뿐이다"
    를 실행 환경 수준에서 강제하는 쪽이 이 저장소가 이미 5번 겪은 "한 겹 밖으로 이동하는
    우회"의 재발을 아키텍처로 차단한다.

## 요약

이번 라운드가 세운 네 겹의 방어(정적 AST 허용목록, 행위 기반 순함수 테스트, 워크플로
문서 전체 고정, 하네스 스위트 831개)는 모두 실제로 통과 확인했지만, `scripts/check-review-gate.py`
에 여섯 줄만 추가하면 — `os.environ` 을 `from os import environ as _E` 로 별칭해 Subscript/
Compare 로만 읽고, `GITHUB_WORKFLOW`(어느 워크플로로 실행되는지 GitHub 가 자동으로 채우는
값) 가 `review-gate` 일 때만 판정을 `blocked=False` 로 덮어쓰면 — 이 모든 가드가 그린인
채로 실제 `review-gate.yml` job 위에서만 판정이 조용히 뒤집힌다. 격리 사본에서 실제로 재현해
확인했다(위 명령/출력 참조). 근본 원인은 두 가지 열거(정적 문법 형태 허용목록, 행위 테스트의
환경변수 이름 목록) 모두 "상상한 우회의 집합"에 방어 범위가 비례하는 구조라는 점이고, 이는
1R~5R 이 이미 겪은 실패 형태의 반복이다. 구조적 해법은 열거를 늘리는 것이 아니라 워크플로
스텝 자체에서 프로세스가 ambient 환경을 볼 수 없게 실행 격리를 강제하는 것이다.

## 위험도

CRITICAL
