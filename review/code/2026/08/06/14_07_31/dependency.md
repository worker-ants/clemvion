# Dependency Review — CI 백스톱 (round 10)

## 스코프 확인 (측정)

`git diff origin/main...HEAD --stat -- . ':!review'` 결과, 이 브랜치가 건드린 파일은
정확히 meta.json 의 15개와 일치한다(15 files changed, 1862 insertions(+), 180 deletions(-)).
`package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml` / `requirements*.txt` /
`pyproject.toml` 등 의존성 매니페스트는 이 15개 중 **0개**다. 신규 외부 패키지는 없다.

15개 파일의 import 문을 전수 확인(`grep -nE "^\s*(import |from )"`): 표준 라이브러리
(`os`, `sys`, `subprocess`, `re`, `json`, `time`, `dataclasses`, `datetime`, `argparse`,
`importlib.util`, `ast`, `glob`, `io`, `contextlib`, `unittest`, `tempfile`, `shutil`,
`pathlib`)뿐이고, 유일한 서드파티는 `test_workflow_yaml_structure.py`/`test_review_gate_ci.py`
의 `import yaml` — 이는 2026-08-01 에 이미 도입된 PyYAML 재사용이지 이 PR 의 신규 의존성이
아니다.

## 발견사항

- **[WARNING]** `_shared/git_probe.py` 가 도입한 역방향 내부 의존(git_probe → branch_guard)의
  실제 동작 경로가 이 PR 의 어떤 테스트에서도 실행되지 않는다 — 바로 이 PR 이 없애려던
  "아무도 실행 안 하는 판정 헬퍼" 결함을 한 겹 위에서 재생산한다.
  - 위치: `.claude/_shared/git_probe.py:35`(`_origin_default_branch` — `branch_guard.py`
    파일을 `importlib.util.spec_from_file_location`으로 별도 로드해 그 모듈의
    `_origin_default_branch` 함수 객체를 반환) 및 `.claude/_shared/git_probe.py:113`
    (`_default_branch` — 그 함수를 호출해 못 구하면 `main`/`master` 로컬 브랜치 존재
    여부로 폴백).
  - 상세: `git_probe.py` 는 "공유 leaf 유틸"이면서 `.claude/hooks/_lib/branch_guard.py`
    (구체적 상위 소비자)를 런타임에 다시 읽어 들인다. 그것도 정규 `import`가 아니라
    `sys.modules["_git_probe_branch_guard"]`라는 **별도 이름**으로 로드하므로, 같은 파일이
    프로세스 안에서 (a) 정상 `from _lib import branch_guard`로 한 번, (b) 이 우회 경로로
    또 한 번 — 독립된 두 모듈 객체로 존재할 수 있다. 이 설계 자체(문서화된 순환 회피)는
    타당하지만, **이 함수 쌍(`_origin_default_branch`/`_default_branch`)의 동작을 직접
    구동하는 테스트가 하나도 없다.** 확인 방법: `plan_guard`/`review_guard`를 건드리는
    모든 테스트는 `mock.patch.object(pg, "_default_branch", ...)` /
    `mock.patch.object(rg, "_default_branch", ...)` 로 이 함수 자체를 완전히 우회하고
    (`.claude/tests/test_plan_guard.py:33`, `.claude/tests/test_review_guard_hardening.py:189`,
    `.claude/tests/test_review_guard.py:240,375`), `test_branch_guard.py` 는
    `branch_guard.py` 자신의 **로컬** `_origin_default_branch`(그 모듈 65~104행, git_probe
    와 이름만 같고 실제 git 커맨드를 도는 별개 함수)만 mock 해 테스트하지 git_probe 가
    별도로 로드하는 사본을 절대 거치지 않는다. `GitProbesAreNotReDuplicatedTest`
    (`.claude/tests/test_plan_guard.py:329`)는 `_run_git`/`_repo_root`/`_default_branch`/
    `_merge_base`/`_porcelain_path` 다섯 함수의 **객체 동일성**과 로컬 `def` 부재만 검사할
    뿐, `_default_branch` 호출이 실제로 `branch_guard`를 성공적으로 로드해 origin 의
    default branch 를 맞게 돌려주는지는 검사하지 않는다.

    뮤테이션으로 실증: 스크래치 사본에서 `git_probe.py:48` 의
    `os.path.join(_HOOKS_LIB, "branch_guard.py")`를 존재하지 않는 파일명으로 바꿔
    `_origin_default_branch`가 항상 `None`을 반환하도록 만들었다(예외는
    `git_probe.py:57`의 `except Exception: return None`이 삼킨다 — 여기까지는 문서화된
    fail-open 계약대로 동작). 그 상태로 아래를 실행:

    ```
    python3 -m unittest discover -s .claude/tests -p test_plan_guard.py
    python3 -m unittest discover -s .claude/tests -p test_branch_guard.py
    python3 -m unittest discover -s .claude/tests -p test_review_guard.py
    python3 -m unittest discover -s .claude/tests -p test_review_guard_hardening.py
    ```
    → 4개 스위트 137/137 테스트 전부 `OK`(뮤테이션 전과 동일). 직접 호출로 뮤테이션이
    실제로 효과가 있었음도 확인:
    `gp._origin_default_branch(cwd)` → `None`(정상 상태에서는 `main` 을 반환하는 함수
    객체 — 정상 저장소에서 `resolver(cwd)` 는 `"main"` 을 반환함을 별도로 확인했다).

    영향 경로: `_default_branch` 가 `None` 을 반환하면 `plan_guard.evaluate_plan`
    (`.claude/hooks/_lib/plan_guard.py:277-278`)과 `review_guard.py:920-921` 모두
    `base = _merge_base(cwd, default) if default else None` 에 의해 `base=None`이 되고,
    커밋된 변경 집합(`_committed_changes`)이 통째로 빈 리스트가 된다 — 즉 "커밋된
    codebase/** 변경"이 하나도 안 잡혀 게이트가 fail-open 방향으로 조용히 통과 판정을
    낼 수 있는 자리다. 폴백(로컬 `main`/`master` 브랜치 존재 확인)이 안전망 역할을
    하지만, `review-gate.yml`(신규 CI 워크플로)의 러너는 PR ref 만 체크아웃하므로
    로컬에 `main`/`master` 브랜치가 남아있다는 보장이 약하다(이 경로의 실제 CI 거동
    자체는 "실제 Actions 러너에서만 확인 가능"이라는 이미 기록된 known-limit 이므로
    여기서 단정하지 않는다 — 요점은 코드가 아니라 **테스트 커버리지의 부재**다).
  - 제안: `.claude/tests/test_plan_guard.py`의 `GitProbesAreNotReDuplicatedTest` 나 별도
    클래스에, 실제 git 저장소(임시 디렉터리에 `git init` + `origin` 리모트 시뮬레이션 또는
    `origin/HEAD` symref 조작)로 `git_probe._default_branch(cwd)` 를 **모킹 없이** 구동해
    `branch_guard.py` 경유 resolver 가 정상적으로 값을 돌려주는 경로 자체를 한 번은
    검증하는 테스트를 추가할 것. `PorcelainPathSurvivesOnARealRepoTest`
    (`.claude/tests/test_plan_guard.py:266`)가 `_uncommitted_changes` 에 대해 이미 쓴
    "헬퍼가 아니라 실제 저장소로 구동" 패턴을 그대로 `_default_branch` 에도 적용하면 된다.

- **[INFO]** (검증 결과, 결함 아님) PyYAML pin 일치성은 이미 전용 테스트로 지켜진다.
  - 위치: `.claude/tests/test_review_gate_ci.py:807`
    (`PyYamlPinsAgreeTest.test_every_workflow_pins_the_same_version`).
  - 상세: `.github/workflows/*.yml` 전체를 정규식으로 스캔해 `pip install "pyyaml..."`
    pin 문자열이 정확히 하나로 일치하는지 검사하고, "pyyaml 을 언급하는 파일 집합"과
    "pin 이 잡힌 파일 집합"까지 대조해 정규식이 새 표기 형태를 놓치는 경우도 잡는다.
    뮤테이션으로 검증: 스크래치 사본에서 `deps-security-checks.yml` 의 두 pin 중
    하나만 `"pyyaml>=6,<7"` → `"pyyaml>=6,<8"` 로 바꾸자 즉시
    `AssertionError: 2 != 1 : pyyaml pin 이 갈렸다` 로 RED. 유효한 가드다. 현재
    `harness-checks.yml`(신규 스텝 없음, 기존 pin 그대로) 과
    `deps-security-checks.yml` 두 곳 모두 `pyyaml>=6,<7` 로 일치하며 이번 PR 은 그
    pin 자체를 건드리지 않았다. `review-gate.yml` 은 `설치 단계 없음`(주석대로
    `scripts/check-review-gate.py` 는 `argparse`/`os`/`sys` 와 내부 `review_guard`
    임포트뿐)이라 대상도 아니다.

- **[INFO]** `harness-checks.yml` 의 주석 "actions major policy consistent with the other
  workflows (v5/v6 line)" 은 이 PR 이 건드리지 않은 사전 존재 라인이라 스코프 밖이지만,
  현재 사실과 어긋난다.
  - 위치: `.github/workflows/harness-checks.yml` (해당 주석은 `setup-python@v7` 스텝
    바로 위 — 이번 PR 의 diff 는 파일 상단 docstring 과 `paths:` 목록만 바꿨고 이 줄은
    포함하지 않는다. `git blame` 상 `a10ab5b04`, 2026-05-30 작성).
  - 상세: `git blame -L` 및 `grep -rn "uses: actions/" .github/workflows/` 로 확인 —
    `actions/checkout`·`actions/setup-python`·`actions/setup-node`·
    `actions/upload-artifact` 는 저장소 전체가 `@v7`(dependabot PR #673, #987 등으로
    2026-06~07월에 일괄 상향), `actions/cache` 만 `@v6`(`e2e.yml`). "v5/v6 line" 을
    가리키는 워크플로는 현재 존재하지 않는다. 이 PR 의 diff 범위 밖이라 CRITICAL/WARNING
    으로 올리지 않지만, 같은 파일을 이번에 손댄 김에 정정 대상으로 기록해 둔다.
  - 제안: 별도 하우스키핑 커밋에서 주석을 "v7 line"으로 정정(또는 버전 언급 자체를
    제거).

- **[INFO]** (검증 결과, 결함 아님) 2026-08-01 사고(YAML 중복 키가 `pip install` 스텝을
  침묵 소실시킨 것)를 재현하는 구조 가드가 실재한다 — `test_workflow_yaml_structure.py`
  의 `test_no_duplicate_keys`(98행)와
  `test_every_step_has_exactly_one_of_run_or_uses`(110행)가 `.github/workflows/*.yml`
  전체에 적용되고, `DetectorTest`(333행 이하)가 그 두 검사기 자체를 2026-08-01 사고
  형태 fixture 로 화이트박스 검증한다. 의존성 설치 스텝이 조용히 사라지는 클래스는 이미
  막혀 있다.

- **[INFO]** 내부 의존성 정리(review_guard/plan_guard/branch_guard → `_shared/git_probe.py`
  단일화) 자체는 순수 내부 재배선이며 외부 패키지 표면·번들 크기·라이선스에 영향 없음.
  `check-review-gate.py` 의 sys.path 조작도 `.claude/hooks/_lib` 하나만 얹으면 되도록
  스코프를 줄였고(주석에 적힌 "리뷰어가 `_lib`만으로 끝까지 도는 것을 실측"), 실제로
  `review_guard.py` 는 모듈 최상단에서 `plan_guard`/`branch_guard` 를 직접 import 하지
  않음을 확인했다(`grep -n "^import \|^from " review_guard.py` — `_shared.*` 와 stdlib
  뿐) — 그 주장과 일치한다.

## 요약

이번 PR(15개 파일, review-gate.yml CI 백스톱 + git_probe 통합)은 신규 외부 의존성을
전혀 추가하지 않는다 — 매니페스트 파일 변경 0건, 도입한 서드파티는 기존 PyYAML 재사용뿐이고
그 pin 일치성은 전용 테스트로 지켜지며 뮤테이션으로 유효성도 확인했다. GitHub Actions
버전 pin(`@v7`)도 저장소 전체와 일관된다. 유일한 실질 발견은 라이선스·취약점·버전충돌이
아니라 **내부 의존성 구조**다: `_shared/git_probe.py` 가 `.claude/hooks/_lib/branch_guard.py`
를 별도 모듈 사본으로 동적 재로드하는 역방향 의존을 새로 만들었는데, 그 연결 경로
(`_origin_default_branch`/`_default_branch`)를 실제로 구동하는 테스트가 이 PR 의 어떤
스위트에도 없다 — 뮤테이션으로 137개 관련 테스트가 전부 무감하게 통과함을 실증했다.
현재 저장소에서 실제로 오작동하는 증거는 없고(수동 호출로 정상 동작 확인) 폴백 경로도
존재하므로 CRITICAL 로 올리지는 않지만, 이 PR 이 "손-동기 사본은 아무도 실행 안 하는
채로 갈린다"는 바로 그 교훈으로 시작된 만큼 이 지점은 같은 클래스의 새로운 사각지대로
남는다.

## 위험도
MEDIUM
