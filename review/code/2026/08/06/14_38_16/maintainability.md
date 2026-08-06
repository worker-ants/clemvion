# 유지보수성(Maintainability) Review

라운드 11. `review_guard.py`/`plan_guard.py`/`branch_guard.py`/`_shared/git_probe.py`(판정 코드)와
그 하네스 테스트·CI 배선(`check-review-gate.py`, `review-gate.yml`, `harness-checks.yml`,
`test_*`)을 유지보수성 관점에서 검토했다. 아래 위치는 프롬프트 게이트가 아니라 저장소의
실제 소스 파일을 `Read`/`grep` 으로 직접 열어 확인한 줄 번호다.

### 발견사항

- **[WARNING]** "무엇을 스캔할지" 목록이 여전히 손으로 유지된다 — 10R 이 정확히 이 형태의
  결함을 고친 그 자리 바로 위 계층에서 재발.
  - 위치: `.claude/tests/test_plan_guard.py:346` (`GitProbesAreNotReDuplicatedTest._MODULES`),
    `.claude/tests/test_review_gate_ci.py:607`
    (`TheGateItselfDoesNotBranchOnCiEnvTest._SCANNED_LIB`)
  - 상세: 10R 커밋 메시지 자체가 결론 내린 교훈은 "통합도, 그것을 지키는 가드도 손으로 쓴
    목록이었다 … 열거를 도출로 바꿨다"였고, 그 결과 `GitProbesAreNotReDuplicatedTest`는 이제
    `review_guard.py`/`plan_guard.py`/`branch_guard.py` **세 파일의 AST 를 비교**해 "본문이
    동일한 함수가 남아 있는지"는 더 이상 손으로 세지 않는다. 그런데 **그 세 파일 자체**
    (`_MODULES`)와, 같은 세 파일을 환경변수 접근 여부로 스캔하는
    `TheGateItselfDoesNotBranchOnCiEnvTest._SCANNED_LIB` 는 여전히 하드코딩된 튜플이다.
    `.claude/hooks/_lib/`에는 이미 `branch_naming.py`/`failopen_state.py`/
    `mermaid_lint_ready.py` 등 다른 목적의 모듈도 함께 있어 "그 디렉터리 전체"로 단순
    치환할 수는 없지만, 지금 방식은 "git_probe 를 위임받아 쓰는 guard 모듈"이라는 조건으로
    **파일 내용에서 도출**하지 않고 있다. 미래에 push-gate 계열 네 번째 guard 모듈이
    `_lib/`에 추가되고 `_shared/git_probe`를 위임받으면서 실수로 함수를 다시 손으로 복제해도,
    두 하드코딩 목록 어느 쪽도 그 파일을 스캔 대상에 넣지 않으므로 두 가드 모두 조용히
    통과한다 — 이번 라운드가 고치려던 정확히 그 결함 클래스(9R→10R의 `_current_branch`
    누락)가 한 단계 위(어떤 파일을 볼지)에서 재현 가능한 상태로 남아 있다.
  - 제안: 두 목록을 예컨대 `.claude/hooks/_lib/*.py` 전체를 순회하며 `from _shared import
    git_probe` (또는 `_git_probe.`) 참조가 있는 파일만 골라내는 방식으로 도출해, "git_probe
    를 쓰는 guard 모듈 집합"이 파일 목록이 아니라 파일 내용에서 나오게 한다. 최소한 두 목록이
    서로 일치하는지 대조하는 테스트라도 추가하면 drift 는 막을 수 있다.

- **[WARNING]** 실제 git 저장소를 구동하는 테스트 부트스트랩 헬퍼(`_git`/`_write`, 각 ~7줄)가
  이번 라운드 리뷰 대상 파일 안에서만 5곳에 바이트 단위로 복제돼 있다(저장소 전체로는 7곳).
  - 위치: `.claude/tests/test_plan_guard.py:292` (`_git`) / `:301` (`_write`);
    `.claude/tests/test_review_guard_hardening.py:588`, `:677` (`_git` 두 클래스 각각) /
    `:291`, `:597`, `:686` (`_write` 세 클래스); `.claude/tests/test_review_gate_ci.py:58`,
    `:692` (`_git`) / `:67`, `:701` (`_write`)
  - 상세: 정확히 같은 본문 —
    `env["GIT_CONFIG_GLOBAL"] = os.devnull; env["GIT_CONFIG_SYSTEM"] = os.devnull;
    env["GIT_AUTHOR_NAME"] = env["GIT_COMMITTER_NAME"] = "t"; …` — 이 한 파일 안에서도
    클래스마다 다시 복사돼 있다(`test_review_guard_hardening.py`는 588행과 677행 두 곳).
    이 PR 이 프로덕션 코드에서 `_run_git`/`_repo_root`/`_current_branch` 등 다섯~여섯 개
    git 헬퍼를 "byte-identical copies … drifted twice"라는 이유로 `_shared/git_probe.py`로
    통합한 바로 그 논리가, 테스트 부트스트랩 헬퍼에는 적용되지 않았다. 지금은 내용이 짧고
    안정적이라 당장 갈릴 위험은 낮지만, `GIT_CONFIG_GLOBAL`/저자 정보 설정 방식이 바뀌면
    (예: 새 git 버전의 기본 브랜치 이름 정책, 서명 요구 등) 5~7곳을 손으로 동기화해야 하고
    한 곳을 빠뜨리는 실패 양식은 이 저장소가 이미 세 번(리뷰 게이트 자신의 `_run_git`) 겪은
    것과 동일하다.
  - 제안: `_harness.py`에 `run_git(root, *args)` / `make_temp_git_repo()` 헬퍼(또는
    `unittest.TestCase` 믹스인)를 추가해 세 파일이 이를 공유하도록 한다. README의 "Conventions
    for new tests"가 이미 "real repo" 예외를 문서화하고 있으니, 그 예외의 구현체를 한 곳에
    두는 것이 자연스러운 다음 단계다.

- **[INFO]** `_default_branch()`에 실질적으로 아무 역할이 없는 `if True:` 래퍼가 남아 있다.
  - 위치: `.claude/_shared/git_probe.py:140`
  - 상세: `git log -p`로 확인하면 이 자리는 원래 `resolver = _origin_default_branch(cwd); if
    resolver is not None:`처럼 조건부였다가, 리팩터링 과정에서 조건은 사라지고
    `if True:`만 남았다(`try/except`를 감싸는 블록이 항상 참인 조건 아래 있을 이유가 없다).
    기능에는 영향이 없지만, 다음에 이 함수를 읽는 사람이 "왜 조건이 있지?"를 잠깐이라도
    따라가게 만드는 죽은 코드다.
  - 제안: `if True:` 블록을 벗기고 `try/except`를 함수 본문에 바로 둔다(indent 만 한 단계
    줄어든다).

- **[INFO]** `branch_guard.py`에서 `_shared/git_probe`로 위임한 네 개 별칭이 두 블록으로
  쪼개져 있다.
  - 위치: `.claude/hooks/_lib/branch_guard.py:45-46` (`_run_git`, `_repo_root`)와
    `:57-58` (`_current_branch`, `_origin_default_branch`), 그 사이에 무관한
    `_is_main_worktree` 정의(`:49-54`)가 끼어 있다.
  - 상세: 이 모듈이 `_shared`에서 빌려오는 것이 정확히 무엇인지 한눈에 보려면 두 자리를
    오가야 한다. 기능 문제는 아니지만, "이 파일이 위임하는 프로브 전체"를 한 블록으로 모아
    두면 `GitProbesAreNotReDuplicatedTest`류 가드가 지키려는 "위임 vs 재정의" 경계를 사람도
    같은 자리에서 확인하기 쉬워진다.
  - 제안: 네 줄을 파일 상단 import 직후 한 블록으로 모은다.

- **[INFO]** `scripts/check-review-gate.py`가 `ReviewDecision.push_blocks` 대신
  `decision.blocked`를 직접 읽는다.
  - 위치: `scripts/check-review-gate.py:101` (`blocked = decision.blocked`)
  - 상세: `push_blocks`는 `review_guard.py:188-197`과 `plan_guard.py:450-458`에 각각
    "push 러너가 게이트마다 다른 필드 이름(`blocked` vs `untouched`)을 몰라도 되게" 만들려는
    목적으로 도입된 프로퍼티이고, `guard_review_before_push.py`는 실제로 그 계약을 통해
    두 게이트를 동일하게 소비한다. `check-review-gate.py`는 `ReviewDecision`만 소비하므로
    오늘은 문제가 없지만, 이 스크립트가 확립한 "게이트 계약은 `push_blocks`" 관행을 우회하고
    있다 — 나중에 이 스크립트가 `PlanDecision`도 함께 보게 확장되면(예: CI 백스톱이 plan
    커버리지도 검사하도록 넓어지는 경우) 그때 가서 `blocked`를 `push_blocks`로 바꿔야 한다는
    사실을 다시 발견해야 한다. `test_review_gate_ci.py`의 스텁 클래스들이 실제로는 안 읽는
    `push_blocks`를 일부러 함께 정의해 두는 것(58줄 근방 주석 "무엇을 빼도 되는지 매번
    판단하는 것보다 싸다")도 이 계약을 의식하고 있다는 방증이라, 소비 측만 계약을 벗어나 있는
    비대칭이다.
  - 제안: 지금 당장 고칠 필요는 없다(버그 아님). 이 스크립트가 두 번째 게이트를 소비하게
    되는 시점에 `push_blocks`로 맞추면 된다는 점만 기록해 둔다.

### 요약

핵심 판정 코드(`review_guard.py`, `plan_guard.py`, `branch_guard.py`, `_shared/git_probe.py`)
자체는 라운드를 거듭하며 상당히 정돈됐다 — 함수는 단일 책임으로 짧고, docstring 이 "왜"를
빠짐없이 기록하며, 매직 넘버(`_MAX_GLOB_WILDCARDS`, `_IN_FLIGHT_TTL_SECONDS`, `timeout=2.0`
등)는 전부 근거 주석을 달고 있다. 이번 라운드에서 새로 발견한 것은 기능 결함이 아니라 이
브랜치 자신이 반복해서 강조해 온 "손-동기 쌍은 갈린다"는 교훈이 아직 완전히 관철되지 않은
두 자리다: (1) "어떤 모듈을 스캔할지" 자체가 여전히 하드코딩된 두 개의 독립 목록이라 10R 이
고친 것과 동일한 클래스의 결함이 한 계층 위에서 재발할 수 있는 상태로 남아 있고, (2) 실제
git 저장소를 띄우는 테스트 부트스트랩 보일러플레이트가 리뷰 대상 파일들 안에서만 5곳에
복제돼 있다. 둘 다 오늘 당장 판정을 바꾸지는 않지만, 다음 guard 모듈 추가나 git 설정 변경
시 정확히 이 저장소가 반복해서 겪어 온 "한 곳만 고치고 나머지는 남기는" 실패로 이어지기
쉬운 자리다. 나머지는 죽은 코드 한 줄과 사소한 배치/일관성 노트 수준이다.

### 위험도

LOW
