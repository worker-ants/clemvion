# 부작용(Side Effect) Review — round 3 (CI 백스톱)

작업 방식 고지: 아래 "발견사항"의 뮤테이션 실험은 전부
`/private/tmp/.../scratchpad/r3copy` 에 만든 **저장소 복사본**에서만 수행했다 — 실제 워크트리를 뮤테이트한
적은 없다. 그런데 리뷰 도중 실제 워크트리에서 **내가 만들지 않은** 변경을 관측했다(아래 최상단 항목).
그 항목은 되돌리지 않고 그대로 보고한다(지시사항: "Report any unexpected `git status` rather than
fixing it").

## 발견사항

- **[CRITICAL]** 리뷰 도중 실제 워크트리의 `scripts/check-review-gate.py` 가 **나의 작업이 아닌 경로로**
  일시적으로 수정됐다가 다시 원상 복귀하는 것을 관측했다 — round 2 에서 "이제 멈췄다"고 적힌 "다른
  세션이 뮤테이션 테스트를 라이브 워크트리에 직접 돌린다"는 문제가 round 3 에서도 여전히 벌어지고
  있다는 증거다.
  - 위치: `scripts/check-review-gate.py` (관측 당시 `git diff` 기준 52번째 줄 뒤 4줄 삽입 지점).
  - 상세: 세 시점에 `git status --short` 를 찍었다.
    1. 리뷰 초반: `review/code/2026/08/01/12_06_49/`(세션이 미리 만들어 둔 산출물 디렉터리) 외엔 깨끗.
    2. 이 보고서를 거의 다 쓴 시점, 위 워크플로 YAML 뮤테이션 실험(스크래치 복사본)들을 마치고 실제
       워크트리 상태를 재확인했을 때:
       ```
       $ git status --short
        M scripts/check-review-gate.py
       ?? review/code/2026/08/01/12_06_49/

       $ git diff -- scripts/check-review-gate.py
       @@ -52,6 +52,10 @@ import argparse
        import os
        import sys

       +# control case: local Name-to-Name alias of a disallowed call
       +join = os.walk
       +join('review')
       +
        # `review_guard` 는 `.claude/hooks/_lib/` 에 있고 형제 모듈을 이름으로 import 하므로
       ```
    3. 위 발견을 이 보고서에 적어 넣은 직후 재확인하니 `scripts/check-review-gate.py` 는 다시 깨끗한
       상태(`git diff` 출력 없음, `git status --short` 에 더 이상 안 잡힘)로 돌아와 있었다.
    즉 **수정 → 관측 → 원복**이 내 리뷰 세션 도중 몇 분 안에 일어났다. 이 삽입 내용 자체
    (`join = os.walk; join('review')` — 지역 이름 별칭으로 금지 호출을 위장하는 형태)는 정확히
    `OneJudgeTest` 가 이번 라운드에 새로 방어하겠다고 주장하는 우회 축과 같다. 나는 이 파일이나 그
    경로에 쓴 적이 없다 — 내 모든 뮤테이션은 `$SCRATCH/r3copy/scripts/check-review-gate.py`(복사본)에만
    썼고, 실제 워크트리 경로는 서브프로세스로 **실행만** 했다(아래 항목들의 실측 로그가 그 근거). 즉 이
    오르내림은 **다른 프로세스/세션**이 같은 공유 워크트리에서 라이브로 뮤테이션→검증→복원을 수행 중이던
    흔적이다 — 여러 리뷰어가 동시에 같은 워크트리를 쓰는 이 파이프라인에서, "뮤테이션은 자기 복사본에서만"
    이라는 격리 원칙이 최소 한 프로세스에서는 지금도 지켜지지 않고 있다는 신호. 결과적으로 지금은 파일이
    깨끗하므로 **되돌릴 것은 없지만**, 이 세션 도중 파일이 예측 불가한 순간에 달라 보일 수 있었다는 사실
    자체가 부작용이다(예: 같은 순간에 다른 리뷰어가 이 파일을 diff 로 읽었다면 실제로는 존재하지 않을
    "코드"를 리뷰 대상으로 착각했을 수 있다).
  - 제안: (a) 본 항목은 관측 보고이며 조치가 필요한 현재 diff 는 없다(재확인 시 clean). (b) 최종
    커밋/푸시 직전에 한 번 더 `git status`/`git diff` 로 관련 파일들이 HEAD 와 일치하는지 재확인할
    것을 권한다. (c) 재발 방지책으로, 병렬 리뷰어 fan-out 프롬프트(및 code-review-agents SKILL 공통
    지시문)에 "뮤테이션 실험은 반드시 자기 소유 임시 디렉터리 복사본에서 수행하고 공유 워크트리는 절대
    쓰지 않는다"는 문구가 명시돼 있는지 확인하고, 없다면 추가한다.

---

이하는 본 라운드가 다루는 세 파일(`scripts/check-review-gate.py`, `.github/workflows/review-gate.yml`,
`.claude/tests/test_review_gate_ci.py`)의 가드/테스트 자체에 대한 분석이다. 이 라운드의 본질은 "가드가
주장하는 성질"과 "가드가 실제로 검사하는 것" 사이의 간극이다. 문서(`README.md`, `check-review-gate.py`,
`review-gate.yml` 주석, `plan/...md`)는 4번째 재작성 끝에 "이번엔 import 축 + 호출 축 둘 다 뒤집었다"고
서술하지만, 아래는 그 서술에도 불구하고 **성질이 거짓인 채 테스트가 GREEN** 인 실측 사례들이다. 전부
스크래치 복사본에서 실행해 확인했다(위 관측 이전에 수행).

- **[CRITICAL]** `review-gate.yml` 의 dependabot 면제 조건은 정규식 **부분일치**로만 검증돼, 조건 전체를
  트리비얼하게 만드는 한 조각을 덧붙이면 통과한다 — "봇 면제"뿐 아니라 **게이트 전체를 영구 무력화**하는
  변형도 GREEN 이다.
  - 위치: `.github/workflows/review-gate.yml:51`(`if: github.actor != 'dependabot[bot]'`),
    `.claude/tests/test_review_gate_ci.py:392`(`test_the_job_condition_exempts_dependabot`),
    단언은 `test_review_gate_ci.py:398`(`self.assertRegex(cond, r"github\.actor\s*!=\s*['\"]dependabot\[bot\]['\"]", ...)`).
  - 상세: 테스트는 `cond` 문자열 어딘가에 그 부분식이 **존재하는지**만 본다(`assertRegex` = `re.search`,
    앵커 없음). 실측 1 — `if: (github.actor != 'dependabot[bot]') || (github.actor == 'dependabot[bot]')`
    로 바꾸면 조건은 **항상 참**(봇도 포함해 매번 실행)이 되어 면제 자체가 사라지는데 테스트는 "ok". 실측 2
    (더 심각) — `if: (github.actor != 'dependabot[bot]') && false` 로 바꾸면 조건은 **항상 거짓**이 되어
    이 워크플로는 **어떤 PR 에서도 다시는 돌지 않는다** — CI 백스톱 전체의 영구 disable — 인데도 같은
    테스트가 "ok" 를 낸다. 두 경우 다 스크래치 복사본에서 실제 `unittest` 로 재현했다:
    ```
    $ python3 -c "... unittest.TextTestRunner(verbosity=2).run(suite) ..."
    test_the_job_condition_exempts_dependabot ... ok
    ```
    (두 조건 각각에 대해 동일 출력.) 리뷰어 코멘트("두 조각을 따로 보면 통과한다")는 `!=` 와 `dependabot[bot]`
    이 **분리**된 경우만 막았을 뿐, 정규식이 매치하는 조각이 **더 큰 트리비얼 논리식의 일부**가 되는 경우는
    막지 못한다 — `assertRegex` 는 fullmatch 가 아니라 substring search 이기 때문.
  - 제안: `cond` 를 정규식 부분일치가 아니라 **구조적으로** 검증한다 — 예: `cond.strip()` 이 정확히
    `"github.actor != 'dependabot[bot]'"` 와 같은지(byte-identical), 혹은 GitHub Actions 식 파서로 최상위
    연산자가 단항 비교 하나뿐인지 확인. 최소한 정규식을 `^...$`(전체 문자열) 로 anchor 하는 것만으로도
    이번 두 실측은 막힌다(단, 다른 tautology 변형까지는 못 막을 수 있음).

- **[CRITICAL]** `review-gate.yml` 의 "관측 모드 고정" 단언(`test_it_is_still_observation_only`)이 `$`/`${{`
  치환만 막고 **셸 문자열 리터럴 연접**은 막지 않아, 특수문자 없이 `--enforce` 를 몰래 켤 수 있다.
  - 위치: `.github/workflows/review-gate.yml:74`(`run: python3 scripts/check-review-gate.py`),
    `.claude/tests/test_review_gate_ci.py:430`(`test_it_is_still_observation_only`),
    단언은 `test_review_gate_ci.py:444`(`assertNotIn("--enforce", cmd)`)와
    `test_review_gate_ci.py:446-450`(`for interp in ("$", "${{"): assertNotIn(interp, cmd, ...)`).
  - 상세: `run:` 을 `python3 scripts/check-review-gate.py --enfor""ce` 로 바꾸면 소스 텍스트에는 리터럴
    `"--enforce"` 도 `"$"` 도 `"${{"` 도 **나타나지 않는다**(문자열이 `--enfor` / `""` / `ce` 세 조각으로
    쪼개져 있다) — 그래서 테스트는 통과한다. 그러나 bash 는 인접한 따옴표 문자열을 연접하므로, 이 줄이
    실제 GitHub Actions runner 에서 실행되면 스크립트는 인자 `--enforce` 를 그대로 받는다. 실측:
    ```
    $ python3 -c "sys.path.insert(0,'.claude/tests'); ... test_it_is_still_observation_only ..."
    test_it_is_still_observation_only ... ok

    $ bash -c 'set -- scripts/check-review-gate.py --enfor""ce; printf "%s\n" "$@"'
    scripts/check-review-gate.py
    --enforce
    ```
    즉 워크플로 계약이 "관측만"에서 "하드 차단"으로 **조용히** 뒤집히는데(리뷰산출물 미커밋 PR 435건 중
    80건을 즉시 막기 시작), 이 파일이 명시적으로 막겠다고 주장하는 바로 그 사고(§"플래그를 값으로 조립하면
    리터럴 검사가 무력해진다")가 **문자 조립이 아니라 문자열 리터럴 분할**이라는 변형으로 재발한다. 저자가
    라운드 1 에서 막은 것(`$GATE_FLAG` 변수 치환)과 인접한 공격이지만 정확히 그 방어가 상상하지 못한 형태.
  - 제안: 리터럴 substring 검사 대신 `shlex.split(cmd)` (혹은 `list(shlex.shlex(cmd, posix=True, punctuation_chars=False))`)
    로 실제 토큰화한 뒤 `"--enforce"` 가 토큰 목록에 있는지 확인한다. `shlex` 는 인접 따옴표 연접을 셸과
    동일하게 처리하므로 이번 실측이 그대로 잡힌다(단, `$()`/backtick 명령치환까지 완전히 막으려면 여전히
    별도 검사가 필요 — `shlex` 는 치환을 평가하지 않고 리터럴로만 남긴다는 점은 인지하고 있을 것).

- **[WARNING]** "게이트 스크립트가 실제로 실행되는가" 단언이 substring 매치라 **문자열로 이름만 언급**해도
  통과한다.
  - 위치: `.github/workflows/review-gate.yml:73-74`,
    `.claude/tests/test_review_gate_ci.py:385`(`test_a_step_actually_runs_the_script`),
    단언은 `test_review_gate_ci.py:387-390`(`any("scripts/check-review-gate.py" in c for c in self._run_commands())`).
  - 상세: `run: python3 scripts/check-review-gate.py` 를
    `run: echo "backstop lives at scripts/check-review-gate.py (not run in this step)"` 로 바꾸면 스크립트는
    **한 번도 실행되지 않지만** 테스트는 통과한다:
    ```
    test_a_step_actually_runs_the_script ... ok
    ```
    `WorkflowWiringTest` 의 클래스 docstring 은 이미 "구조로 판정한다 — substring 이 아니라" 는 원칙을
    다른 두 개(파일 위치 우회, `run:`→`true` 우회)에 대해서는 관철했지만, 이 특정 단언 자체는 여전히
    문자열 포함 검사다 — 같은 파일 안에서 원칙과 구현이 갈린 자리.
  - 제안: `run:` 값을 파싱해 첫 토큰이 `python3`(or `python`) 이고 두 번째 argv 가 정확히
    `scripts/check-review-gate.py` 인지(즉 그 경로가 **실행 대상**이지 문자열 인자/echo 대상이 아닌지)
    확인한다. 최소한 `shlex.split` 후 경로가 "실행되는 프로그램 위치"에 오는지 검사하면 이번 형태는 막힌다.

- **[CRITICAL]** `OneJudgeTest`(스크립트가 자기 판정 로직을 갖지 않는다)가 "`review_guard` 를 import 했고
  소스 어딘가에 `evaluate_review` 라는 속성 이름이 등장한다"는 두 가지 **정적 존재 여부**만 확인할 뿐,
  그 함수가 실제로 **호출**되어 그 반환값(`decision.blocked`)이 종료 코드를 결정하는지는 검사하지 않는다.
  이를 이용해 "항상 통과하는 두 번째 판정자"를 허용된 import/호출만으로 구성해 GREEN 을 받았다.
  - 위치: `scripts/check-review-gate.py` 전체(교체 대상), 가드는
    `.claude/tests/test_review_gate_ci.py:220`(`class OneJudgeTest`),
    import 단언 `test_review_gate_ci.py:283-285`, 호출 허용목록 `test_review_gate_ci.py:228-234`
    (`_ALLOWED_CALLS`), attrs 단언 `test_review_gate_ci.py:325-327`
    (`self.assertIn("evaluate_review", attrs, ...)`).
  - 상세: 스크래치 복사본의 `scripts/check-review-gate.py` 를 다음 뮤턴트로 통째로 교체했다(전문은
    스크래치에 보관, 요지만 인용):
    ```python
    def _load_gate(root: str):
        lib = os.path.join(root, ".claude", "hooks", "_lib")
        if lib not in sys.path:
            sys.path.insert(0, lib)
        import review_guard          # import 축 통과용
        review_guard.evaluate_review  # 죽은 참조 — attrs 단언만 만족, 호출은 안 함
        return None

    def main(argv=None) -> int:
        ap = argparse.ArgumentParser(description="stub", allow_abbrev=False)
        ap.add_argument("--enforce", action="store_true")
        ap.add_argument("--root", default=_ROOT_DEFAULT)
        args = ap.parse_args(argv)
        root = os.path.abspath(args.root)
        _load_gate(root)
        print("review-gate: 통과 — mutant always allows")   # 판정과 무관하게 항상 pass
        return 0
    ```
    사용한 호출은 전부 `_ALLOWED_CALLS` 안에 있다(`os.path.dirname/abspath/join`, `sys.path.insert`,
    `argparse.ArgumentParser`, `ap.add_argument`, `ap.parse_args`, `sys.exit`, `print`). `OneJudgeTest`
    를 이 파일에 대해 단독 실행하면:
    ```
    test_the_script_performs_no_judgement_operations_of_its_own ... ok
    ```
    그리고 실제 동작을 실측하면 — 실제 `.claude/hooks/_lib` 를 얹은 임시 git repo 에서, 커밋된
    `codebase/backend/src/a.ts` 변경에 리뷰가 전혀 없는 상태로 `--enforce` 를 줬을 때:
    ```
    --- MUTANT ---
    review-gate: 통과 — mutant always allows
    exit code: 0
    --- REAL script (동일 저장소, unmodified) ---
    review-gate: 미커버 — 1 codebase/ file(s) changed on this branch but no resolved review ...
    exit code: 1
    ```
    즉 "판정자가 하나다"라는, 이 파일이 **네 번째로** 다시 세우려던 바로 그 불변식이 다섯 번째로
    뚫린다 — 이번엔 "호출을 아예 안 하고 이름만 남긴다"는, 이전 4번(전체 grep/docstring, prose 제외/안내문,
    금지목록/`rglob`·`os.walk as _w`, 호출축 금지목록/2단 체인·별칭·`getattr`·`__import__`) 중 누구도
    겨냥하지 않은 축이다.
  - 제안: `evaluate_review` 참조가 **호출**되는지(`ast.Call`의 `func`가 `_dotted` 로
    `"review_guard.evaluate_review"` 또는 `_load_gate`가 반환한 로컬 변수를 통해서만 등장하는지)와, 그
    호출 결과(`decision`/`evaluate(...)` 반환값)의 속성(`.blocked`/`.reason`)이 실제로 `sys.exit`/반환문에
    데이터플로우로 연결되는지까지 확인해야 한다. 정적 "속성 이름이 어딘가 있다"는 데이터플로우가 아니라
    존재 여부일 뿐이라, "부르지 않고 이름만 남기는" 죽은 코드로 항상 만족된다. 최소 보완책: `_load_gate`
    의 반환값이 실제로 호출되고(`evaluate = _load_gate(root); decision = evaluate(root)` 형태),
    `decision.blocked`가 리터럴이 아닌 `evaluate(...)` 호출식에서 나온 이름에 바인딩되는지 AST 상에서
    추적.

- **[INFO]** `OneJudgeTest._ALLOWED_IMPORTS` 클래스 속성이 **완전히 동일한 값으로 두 번** 대입돼 있다 —
  기능적으로는 무해하지만(둘째가 첫째를 덮어씀) 향후 한쪽만 편집되는 실패 모드의 씨앗이다.
  - 위치: `.claude/tests/test_review_gate_ci.py:224` 와 `:227` (두 줄 모두
    `_ALLOWED_IMPORTS = {"__future__", "argparse", "os", "sys", "review_guard"}`, 각각 바로 위에 동일한
    주석 "스크립트가 실제로 쓰는 전부. 열거를 뒤집은 이유는 아래 docstring 참조.").
  - 상세: 클래스 바디에서 같은 이름에 두 번 대입하면 파이썬은 조용히 마지막 값으로 덮어쓴다 — 지금은
    두 값이 byte-identical 이라 관측 가능한 차이가 없다. 다만 "열거를 뒤집은 이유"를 설명하는 리뷰 라운드
    커밋들 중 한 곳에서 복붙하며 지우지 못한 잔재로 보이며, 다음에 누군가 이 집합에 항목을 추가/제거할 때
    두 줄 중 하나만 고치면 **실제로 적용되는 값(마지막 대입)** 과 바로 위 주석/앞줄이 보여주는 값이
    소리 없이 갈린다 — 이 파일 전체가 경계하는 "documentation 과 enforcement 가 갈리는" 실패 클래스를
    스스로 재현할 수 있는 자리.
  - 제안: 중복 대입 한 줄 삭제.

## 요약

리뷰 도중 실제 워크트리의 `scripts/check-review-gate.py` 가 나의 작업이 아닌 경로로 일시 수정됐다가
다시 원복되는 것을 관측했다(round 2 에서 "이제 멈췄다"고 적힌 바로 그 문제 — 다른 세션이 라이브
워크트리에 뮤테이션을 직접 걸고 있는 것으로 보인다). 관측 시점엔 diff 가 없으므로 되돌릴 것은 없지만
그대로 보고한다. 가드/테스트 자체에 대해서는, 이번 라운드가 "import 축 + 호출 축을 모두 뒤집었다"는
4차 개정과 "substring 대신 구조로 본다"는 워크플로 테스트 재작성을 담고 있지만, 스크래치 복사본에서
뮤턴트를 넣고 돌려본 결과 핵심 불변식 넷 모두에서 **테스트가 GREEN 인 채 성질이 거짓**인 경로를
찾았다: (1) dependabot 조건은 정규식 부분일치라 트리비얼-참/트리비얼-거짓 어느 쪽으로도 무력화되고
후자는 게이트 전체를 영구 비활성화한다, (2) `--enforce` 금지 단언은 `$`/`${{` 치환만 막아 따옴표
연접(`--enfor""ce`)으로 관측 모드를 몰래 강제 모드로 뒤집을 수 있다, (3) "스크립트가 실제로 실행되는가"
단언은 substring 매치라 `echo` 로 이름만 언급해도 통과한다, (4) `OneJudgeTest` 는 import/호출 표면만
검사해 "부르지 않고 이름만 참조하는" 죽은 코드로 항상 만족되므로 실제로는 판정을 전혀 위임하지 않는
"두 번째 판정자"(항상 allow)가 허용 목록 안의 호출만으로 통과한다. 넷 다 이 파일들의 docstring 이
스스로 서술하는 "이전 버전은 저자가 상상 못한 것에 뚫렸다"는 패턴을 그대로 반복하며, 특히 (4)는 이
백스톱이 존재하는 핵심 이유(판정자가 하나여야 한다)를 정면으로 무효화한다. 부수적으로
`_ALLOWED_IMPORTS` 중복 대입(INFO) 1건. 가드 실험은 전부 스크래치 복사본에서만 수행했다.

## 위험도

CRITICAL
