# 변경 범위(Scope) 리뷰

세션: `review/code/2026/08/01/12_06_49/` · 대상 8파일 (round 3 — `harness-review-gate-ci-backstop`)
diff 범위: `origin/main...HEAD` = `f2896147b`(본체) + `fb463845d`(1R fix) + `541acaaab`(2R fix).
diff 자체(8개 소스 파일, 881줄)는 plan 문서(`plan/in-progress/harness-review-gate-ci-backstop.md`)가
서술하는 단일 작업 — "리뷰 게이트의 훅-독립 CI 백스톱, 관측 모드" — 로 정확히 수렴한다. 무관한
모듈·파일 터치는 없음(`git diff --stat`로 확인: 8개 소스 파일 + review 세션 산출물뿐).

## 실행한 것

프롬프트 CONTEXT 지시대로, 이 라운드가 다시 쓴 "One judge" 가드(`OneJudgeTest`)와 "관측 모드"
가드(`test_it_is_still_observation_only`) 각각에 대해 "주장하는 성질 → 그 성질이 거짓이면서
테스트는 GREEN인 최소 프로그램"을 실제로 만들어 별도 임시 디렉터리(`/private/tmp/.../scratchpad/
mutcopy`, `mutrepo`)에서 실행했다. 작업 트리는 건드리지 않았다(`git status --short` 로 세션 전후
확인 — 세션 자신의 출력 디렉터리 외 변경 없음).

## 발견사항

- **[CRITICAL]** `OneJudgeTest`(호출+import 허용 목록)가 주장하는 성질 — "스크립트는 자기 판정
  로직을 갖지 않는다" — 은 **AST 상 `Call`/`Import` 노드만 본다.** `Subscript`·`Compare`·재대입은
  전혀 검사 대상이 아니므로, `evaluate()` 호출 뒤 `if "X" in os.environ: blocked = False`
  형태로 판정을 통째로 재구현해도 허용 목록을 하나도 건드리지 않는다(새 import 없음, 새 호출
  없음 — `os` 는 이미 허용, `os.environ` 접근은 Attribute 지 Call 이 아니다).
  - 위치: `.claude/tests/test_review_gate_ci.py` — `OneJudgeTest.test_the_script_performs_no_judgement_operations_of_its_own` (클래스 정의는 220행, 해당 메서드는 253행 근방; `_dotted` 헬퍼 236행).
  - 실측: `scripts/check-review-gate.py` 복사본의 `main()`에 `blocked = decision.blocked` /
    `reason = decision.reason` 바로 다음 4줄을 추가했다 —
    ```python
    if "REVIEW_GATE_SKIP" in os.environ:
        blocked = False
        reason = "skip requested via env (self-judged, not evaluate_review's)"
    ```
    `python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -k OneJudgeTest`
    → **`ok`** (GREEN, 그대로 mutation 없이 통과). 이어서 실제 스크립트를 두 번 실행:
    미리뷰 브랜치 fixture 에 `--enforce` 로 돌리면 정상은 `미커버 …/exit=1`; 같은 fixture에
    `REVIEW_GATE_SKIP=1` 환경변수만 주면 `review-gate: 통과 — skip requested via env …/exit=0`.
    즉 CI 판정이 임의 이름의 환경변수 하나로 완전히 뒤집힌다 — `evaluate_review()` 를 우회하는
    **두 번째 판정자**가 정확히 이 커밋이 "네 번째로 뒤집었다"고 선언한 그 성질을 깬 채 살아
    있고, 그 성질을 고정하려고 만든 테스트가 이를 못 잡는다.
  - 상세: 커밋 메시지(541acaaab)와 README 행은 "호출 축도 허용 목록으로 뒤집어 4차 시도로
    닫았다"고 서술하는데, 실제로는 **Call/Import 두 노드 종류만** 감시 대상이라 "판정 로직"의
    정의가 여전히 좁다. 이번 라운드가 반복해서 배운 교훈("금지 목록은 우회를 상상하는 만큼만
    강하다") 이 허용 목록에도 그대로 적용된다 — 이번엔 **노드 종류** 자체가 상상 밖이었다.
  - 제안: `ast.Call`/`ast.Import` 외에 `ast.Compare`(특히 `in`/`not in` on `os.environ`)와
    새 이름에 대한 대입(`ast.Assign`) 전체를 감시하거나, 더 근본적으로 스크립트의 실행 가능한
    분기 수 자체를 고정(예: `main()` 안의 `if`/조건식 개수를 소스 레벨에서 pin)하는 방향을
    검토. 이 발견은 스코프 관점에서 "완료로 표시된 항목이 실제로는 부분 완료"라는 사실 정정이
    필요함을 뜻한다.

- **[CRITICAL]** `test_it_is_still_observation_only` 가 주장하는 성질 — "게이트 호출 명령에
  셸/표현식 치환으로 플래그를 조립할 수 없다" — 은 **`$` 와 `${{` 두 리터럴만** 검사한다.
  POSIX 셸의 또 다른 커맨드 치환 문법인 **백틱(`` ` ``)** 은 `$` 문자를 전혀 쓰지 않으므로
  검사를 완전히 통과한다.
  - 위치: `.claude/tests/test_review_gate_ci.py` — `WorkflowWiringTest.test_it_is_still_observation_only` (430행 근방, 치환 금지 루프는 444~450행).
  - 실측: `.github/workflows/review-gate.yml` 복사본에서 마지막 step 을
    `run: python3 scripts/check-review-gate.py` →
    `` run: python3 scripts/check-review-gate.py `cat .review-gate-flag 2>/dev/null` ``
    로만 바꿔 `WorkflowWiringTest` 전체를 재실행 →  5개 테스트 **전부 `ok`**, 특히
    `test_it_is_still_observation_only` 도 `ok`. 이 `run:` 은 `--enforce` 문자열도, `$`도,
    `${{`도 포함하지 않지만, 실제 GitHub Actions(bash) 에서 백틱은 정상적으로 명령 치환을
    수행하므로 `.review-gate-flag` 파일 내용(예: 이전 step 이 캐시/아티팩트로 써 둔 `--enforce`)
    으로 플래그를 조립할 수 있다.
  - 상세: 커밋 메시지(541acaaab, C2)는 정확히 "플래그를 값으로 조립할 수 있으면 리터럴 검사는
    언제나 우회 가능하다"고 그 일반적 한계를 스스로 서술해 두고도, 구현은 두 가지 치환 구문
    (`$(...)`/`${{ }}`) 만 막았다 — 백틱은 셋째 구문으로 남아 있다. `WorkflowWiringTest` 의
    docstring 은 "구조로 판정한다" 를 표방하지만 이 특정 단언만은 문자열 차단이라 예외다.
  - 제안: 금지 문자 목록에 백틱을 추가하는 것은 또 다른 상상-부족 루프를 반복할 뿐이다 —
    `run:` 을 셸 파서로 실제 토큰화해 스크립트 호출부 인자가 리터럴(문자열 상수)인지 확인하는
    쪽이 이 클래스를 구조적으로 닫는다(같은 파일이 YAML 은 이미 구조 파싱으로 전환했는데, 이
    문자열 검사만 그 교훈이 안 닿아 있다는 점은 W1 이 이미 지적한 비대칭과 같은 모양).

- **[WARNING]** 편집 잔여물 — `_ALLOWED_IMPORTS` 클래스 속성이 완전히 동일한 주석과 함께
  **두 번 선언**돼 있다(둘째가 첫째를 그대로 shadow, 동작에 영향은 없음).
  - 위치: `.claude/tests/test_review_gate_ci.py:224`와 `:227` (두 줄 다 `_ALLOWED_IMPORTS = {"__future__", "argparse", "os", "sys", "review_guard"}`, 그 사이 225~226행에 같은 주석이 반복).
  - 상세: `git log -p`로 확인 — 이번 라운드(541acaaab)가 `_ALLOWED_CALLS`/`_dotted`/새 단언들을
    추가하면서 기존 `_ALLOWED_IMPORTS` 줄을 재사용하지 않고 그 뒤에 통째로 복사해 붙였다.
    기능은 깨지지 않지만(두 번째 대입이 같은 값으로 덮어씀), 리뷰 대상 diff에 실질 로직이 아닌
    복붙 잔여물이 섞여 들어간 사례 — 8건의 CRITICAL/WARNING을 낸 리뷰 라운드에서 나온
    diff 치고는 사소하지만 눈에 띄는 위생 결함.
  - 제안: 중복 선언 한 줄과 중복 주석 제거.

- **[INFO]** `.claude/tests/test_block_integrity.py` 의 변경(24줄, `PlanStubsMirrorTheRealInterfaceTest`
  를 파일 단위 join에서 스텁 단위 비교로 바꾸고 `raise`형 스텁을 제외)은 이 PR의 표제 주제(CI
  백스톱)와 직접 무관해 보이지만, 커밋 메시지 W5·plan 문서가 명시하듯 **이번 라운드가
  `test_stop_guard_failopen.py`에 새 `evaluate_review` 스텁을 추가하면서 그 가드의 파일-단위
  join 결함을 실제로 드러낸 결과**다(같은 파일에 두 스텁이 있을 때 하나가 `push_blocks` 를
  잃어도 다른 하나 때문에 통과하던 결함). 원인-결과 관계가 diff와 plan/commit 서술 양쪽에서
  일관되게 추적되므로 범위 이탈이 아니라 정당한 부수 수정으로 판단.
  - 위치: `.claude/tests/test_block_integrity.py:672`~`700` 부근(`PlanStubsMirrorTheRealInterfaceTest`).

## 프로세스 관측

`git status --short` 는 세션 결과물 디렉터리(`review/code/2026/08/01/12_06_49/`) 외 변경이 없다 —
CONTEXT 가 우려한 "리뷰 중 소스 mutation" 은 이번 세션에서 재현되지 않았다. mutation 실험은 전부
`/private/tmp/.../scratchpad/{mutcopy,mutrepo}` 복사본에서만 수행했다.

## 요약

8개 대상 파일의 diff 자체는 plan 문서가 서술하는 단일 작업(CI 백스톱, 관측 모드, 3라운드 리뷰
반영)에 정확히 수렴하고, 무관한 파일·모듈에 손을 대지 않았다. 다만 이 라운드가 "네 번째로 판정
로직 재구현을 완전히 닫았다"고 선언하는 `OneJudgeTest`와, "플래그 조립 우회를 일반적으로 막았다"고
선언하는 `test_it_is_still_observation_only`는 둘 다 실측으로 반증된다 — 전자는 `Compare`/재대입
노드를, 후자는 백틱 명령 치환을 각각 놓쳐 실제로 판정을 완전히 뒤집는 프로그램/워크플로 변경을
GREEN으로 통과시킨다. 이는 "이 라운드가 어디까지 닫았는가"라는 스코프 서술과 실제 구현 사이의
간극이므로, 코드 변경 자체의 범위 일탈이라기보다는 **완료 선언(plan/커밋 메시지)이 실제 구현
범위보다 넓게 주장하고 있다**는 스코프 관점의 사실 정정이 필요하다. 그 외 사소한 복붙 잔여물
(`_ALLOWED_IMPORTS` 중복) 1건.

## 위험도

HIGH — 코드 변경 범위 자체는 깨끗하지만, 이 라운드가 "완전히 닫았다"고 반복 선언한 두 가드가
모두 최소 변경으로 실측 반증되어 "CI 백스톱은 판정자가 하나다 / 관측 모드는 조용히 뒤집히지
않는다"는 핵심 주장이 코드가 실제로 보장하는 범위를 넘어서 있다.
