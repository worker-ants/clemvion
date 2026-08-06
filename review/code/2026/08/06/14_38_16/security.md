# 보안(Security) 리뷰 — round 11

대상: `.claude/_shared/git_probe.py`, `.claude/hooks/_lib/{branch_guard,plan_guard,review_guard}.py`,
`.claude/tests/{README.md,test_block_integrity,test_plan_guard,test_review_gate_ci,
test_review_guard_hardening,test_stop_guard_failopen,test_workflow_yaml_structure}.py`,
`.github/workflows/{harness-checks,review-gate}.yml`, `plan/in-progress/harness-review-gate-ci-backstop.md`,
`scripts/check-review-gate.py`. 프롬프트에서 잘린 `review_guard.py`(52KB)·`test_block_integrity.py`·
`test_review_guard_hardening.py`·`tests/README.md`는 `Read`로 직접 열어 확인했다.

## 방법

- 인젝션(커맨드/경로/YAML)·시크릿 하드코딩·인가 우회·입력 검증·ReDoS·에러 노출·의존성 순으로 점검.
- `subprocess.run`은 전 파일에서 리스트 인자(`shell=True` 없음) — 커맨드 인젝션 표면 없음. 확인:
  `grep -n "subprocess.run\|shell=True"` 15개 파일 전수, `shell=True` 0건.
- 하드코딩 시크릿 패턴(`api[_-]?key|secret|password|token=|BEGIN ... PRIVATE KEY|AKIA...`) 15개 파일
  전수 grep — 매치 0건 (유일한 히트는 `_IMPL_DONE_MODE_TOKEN = "--impl-done"`, 오탐).
- `.github/workflows/review-gate.yml`: `pull_request`(◯) 이지 `pull_request_target`(✗) 이라 fork PR
  에서 GITHUB_TOKEN 은 애초에 read-only 로 격리된다. `permissions: contents: read` 도 명시. 시크릿
  미사용. `${{ github.base_ref }}`는 `env:` 경유로만 셸에 들어가 GH Actions expression-injection
  관행을 지킨다(직접 `run:` 보간 없음) — 이 부분은 결함이 아니라 올바른 처리로 확인.
- `review_guard.py`의 `_glob_to_regex`: `_MAX_GLOB_WILDCARDS = 6` 캡이 여전히 살아 있고, 초과 시
  "전체 매치"(안전한 방향)로 처리 — ReDoS 방어 유지 확인.

## 발견사항

- **[WARNING]** CI 백스톱이 "판정자 자기 자신"을 PR HEAD 에서 신뢰한다 — `--enforce` 전제 목록에
  없는 별도 신뢰 축
  - 위치: `scripts/check-review-gate.py:63` (`_load_gate`, `sys.path.insert(0, lib)` 뒤
    `import review_guard`) / `.github/workflows/review-gate.yml:31` (`on.pull_request.paths`
    에 `.claude/hooks/_lib/**` 포함, `actions/checkout@v7`가 PR HEAD 를 체크아웃)
  - 상세: `check-review-gate.py`는 `review_guard.evaluate_review`를 **체크아웃된 PR 자신의
    커밋**에서 import 해 그 결과로 통과/차단을 판정한다. 즉 `.claude/hooks/_lib/review_guard.py`
    (또는 그것이 위임하는 `_shared/git_probe.py`, `_shared/block_integrity.py`)를 같은 PR 안에서
    함께 수정해 `evaluate_review()`가 항상 `blocked=False`를 반환하도록 바꾸면, 이 백스톱은 바로
    그 조작된 버전으로 자신을 평가해 통과시킨다. `paths` 트리거는 이 경로들이 바뀔 때 워크플로가
    "실행되는 것"은 보장하지만, "무엇으로 평가할지"까지는 지키지 못한다 — 실행되는 판정 로직 자체가
    피검 대상과 동일 커밋이기 때문이다. 로컬 훅도 원래 같은 성질을 갖고 있고 그건 이미
    `BYPASS_REVIEW_GUARD=1`로 의식적으로 인정된 우회이므로 근본적으로 새로운 위협 모델은 아니지만,
    이 계층이 존재하는 이유가 "로컬 훅을 완전히 건너뛴 경로(예: 웹 UI 커밋, `--no-verify`)"까지
    잡기 위함이라는 점을 생각하면, **그 경로에서도 게이트 코드 자체가 조작 가능한 동일 커밋에서
    로드된다**는 사실은 남은 방어선을 무력화한다. 티켓에 기록된 기지(既知) 한계 — "게이트는 리뷰
    ARTIFACT의 존재/형태만 검증하고 리뷰가 실제 수행됐는지는 검증하지 않는다 — `--enforce`의
    전제조건" — 는 SUMMARY.md/RESOLUTION.md 위조를 말하는 것이고, 이건 **판정 코드 자체의 자기
    변형**이라 다른 축이다. 현재는 관측 모드(항상 exit 0)라 실질적 피해는 없지만, `--enforce`를
    켜는 순간 이 축도 그 전제조건 목록에 함께 등재돼야 실효성이 생긴다 — 예: `.claude/hooks/_lib/**`,
    `.claude/_shared/**`에 대한 CODEOWNERS 필수 리뷰 등 브랜치 보호 규칙(코드 밖 설정)이 선행돼야
    한다는 점을 문서화하는 것.
  - 제안: `plan/in-progress/harness-review-gate-ci-backstop.md`의 "열린 질문"/전제조건 절에
    "게이트 코드 자체가 PR HEAD 에서 로드된다 — `--enforce` 이전에 `.claude/hooks/_lib/**` ·
    `.claude/_shared/**` 에 대한 저장소 branch-protection(CODEOWNERS 필수 승인 등)이 선행돼야
    한다"를 명시적으로 추가. 코드 변경은 요구하지 않음(설계 트레이드오프로 받아들일 수 있으나
    문서화가 비어 있음).

- **[WARNING]** git-probe 중복 검출 가드가 "같은 이름의 함수"만 비교한다 — 새 이름의 손-복제는
  통과한다
  - 위치: `.claude/tests/test_plan_guard.py:329-400` (`class GitProbesAreNotReDuplicatedTest`,
    특히 `_bodies`(349행)와 `test_no_identical_function_survives_in_two_guards`(360행))
  - 상세: `_bodies()`는 각 모듈의 `ast.FunctionDef`를 이름별로 인덱싱하고,
    `test_no_identical_function_survives_in_two_guards`는 **두 모듈에 같은 이름**으로 정의된
    함수의 본문이 같은지만 비교한다(`set(bodies[a]) & set(bodies[b])`의 교집합). 반대 방향
    가드인 `test_the_shared_probes_are_the_same_objects_everywhere`(377행)는 `git_probe`가
    **export 하는 이름 집합**만 순회해 `getattr(module, name) is getattr(git_probe, name)`을
    확인한다. 두 테스트 모두 "`git_probe`에 없는 새 이름"으로, 그리고 "다른 두 모듈에 정의되지
    않은 단일 모듈 전용 이름"으로 git 프로브를 다시 손으로 짜 넣는 경우는 잡지 못한다 — 예:
    `branch_guard.py`에만 `def _run_git_impl(...)`를 새로 추가하고(다른 두 모듈엔 없음, 따라서
    첫 테스트의 교집합에 안 걸림; `git_probe`에도 없는 이름이라 두 번째 테스트의 순회 대상도
    아님) 그 안에 이 프로젝트가 7R~9R에 걸쳐 반복적으로 겪은 것과 같은 결함(`.strip()`이 porcelain
    선행 공백을 먹는 등)을 다시 심어도 이 두 테스트는 GREEN 이다. `review_guard.py`의
    `_glob_to_regex` 주석이 인용하는 이 저장소의 교훈("정적으로 부정을 증명하려는 시도는 4세대에
    걸쳐 전부 반증됐다")과 정확히 같은 클래스이고, `test_review_gate_ci.py`의
    `VerdictComesFromTheGateTest`가 CI 스크립트의 "판정자 단일성"에 대해 이미 채택한
    행위-기반(behavioural) 검증이, git 프로브 중복 방지 쪽에는 아직 없다.
  - 제안: 정적 이름-매칭에 행위 검증을 보강 — 예를 들어 `_run_git`을 몽키패치해 반환값을
    오염시킨 뒤, 세 가드 모듈이 실제로 구동하는 `evaluate_review`/`evaluate_plan`/`evaluate`
    경로 전부가 그 패치를 관측하는지(즉 세 모듈 다 같은 객체를 참조해 우회 경로가 없는지)
    end-to-end로 도는 테스트를 추가. `GitProbesAreNotReDuplicatedTest`를 지우자는 것이 아니라,
    "이름이 겹치지 않으면 통과"라는 이 가드의 정적 한계를 `OneJudgeTest`/`VerdictComesFromTheGateTest`
    쌍처럼 행위 축으로 한 겹 더 덮자는 것.

## 요약

인젝션(커맨드/경로/셸)·하드코딩 시크릿·안전하지 않은 암호화·평문 전송류의 고전적 취약점은
15개 대상 파일 전수 점검에서 발견되지 않았다. `git_probe.py`의 `-c core.quotePath=false` 처리,
`review_guard.py`의 ReDoS 캡(`_MAX_GLOB_WILDCARDS`), `review-gate.yml`의 `env:` 경유
expression-injection 방어, `pull_request`(비-`pull_request_target`) + `contents: read` 최소권한은
모두 올바르게 구현돼 있다. 남은 두 발견은 둘 다 "라이브 취약점"이 아니라 이 저장소가 10라운드에
걸쳐 스스로 정리해 온 위협 모델("정적 열거/이름-매칭은 결국 뚫린다", "판정 코드 자체가 조작
가능한 대상과 같은 신뢰 경계에 있으면 안 된다")의 사각지대다 — 관측 모드인 현재는 실피해가
없고, `--enforce` 전환 시점에 반영해야 할 전제조건과 가드 보강으로 남긴다.

## 위험도

LOW
