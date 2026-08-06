# Side Effect Review — round 9 (CI 백스톱)

## 중요 선행 관찰: 리뷰 프롬프트가 stale 하다

`_prompts/side_effect.md` 가 담은 `plan_guard.py`/`review_guard.py` 전체 파일 컨텍스트는
**커밋 `88ce9994d` (8R) 시점**의 내용이다. 그런데 실제 작업 트리는 그 이후로 더 진행되어
있다 — `git status` 기준 `plan_guard.py`/`review_guard.py`/`test_plan_guard.py` 가
**미커밋 수정**돼 있고, 새 파일 `.claude/_shared/git_probe.py` 가 **미추적**으로 존재한다.
즉 이번 라운드(9R)의 실제 코드 변경은 프롬프트에 없다: `_run_git`/`_repo_root`/
`_default_branch`/`_merge_base`/`_porcelain_path` 다섯 함수를 두 훅이 손으로 복제해 갖고
있던 것을 `.claude/_shared/git_probe.py` 하나로 위임 통합한 리팩터다(8R 이 지적한
"hand-synced-pair drift" 에 대한 근본 대응).

프롬프트가 지시한 두 파일의 "부작용" 은 이미 7R/8R 리뷰에서 다뤄졌고(`-c
core.quotePath=false` 는 subprocess 인자일 뿐 전역 git config 를 쓰지 않음, `.strip()`→
`.rstrip()` 은 다른 `_run_git` 호출부에 영향 없음 — 이번에도 확인함), 새로 부작용을 낼 여지가
없다. 그래서 아래 발견사항은 **실제 작업 트리의 최신 상태**(git_probe 위임 리팩터)를 대상으로
한다. 명령과 결과는 각 항목에 남긴다.

## 발견사항

- **[WARNING]** git_probe 위임 이후 `_origin_default_branch` 임포트가 두 훅에 죽은 채로
  남아, "모킹해도 반영 안 되는" 부작용 함정이 됨
  - 위치: `.claude/hooks/_lib/plan_guard.py:62-67` (`try: from branch_guard import
    _origin_default_branch ... except Exception: _origin_default_branch = None`),
    동형 블록이 `.claude/hooks/_lib/review_guard.py:124-129`
  - 상세: 리팩터 전에는 이 블록이 `_default_branch()`(같은 파일에 로컬 정의)의 실제 동작을
    좌우했다. 리팩터 후 `_default_branch = _git_probe._default_branch` 로 **통째로 위임**되는데,
    `git_probe._default_branch` 는 `git_probe.py` 자신이 별도로 import 한 **자기 자신의**
    `_origin_default_branch` 를 참조한다(`.claude/_shared/git_probe.py:39-45`). 즉
    `plan_guard.py`/`review_guard.py` 최상단의 이 블록은 이제 **어디서도 읽히지 않는다** —
    `grep -n "_origin_default_branch" .claude/hooks/_lib/plan_guard.py
    .claude/hooks/_lib/review_guard.py` 로 확인: 두 파일 모두 정의(대입) 줄만 나오고 사용처가
    없다. 프로덕션 판정 결과 자체는 `branch_guard._origin_default_branch` 가 어차피 같은 함수
    객체라 틀리지 않지만(846개 harness 테스트 전부 OK로 확인), 이 죽은 바인딩은
    (a) 주석("Reuse the default-branch resolver so … is computed against the same default
    branch")이 더 이상 사실을 설명하지 않고, (b) 누군가 `mock.patch.object(pg,
    "_origin_default_branch", …)` 또는 `mock.patch.object(rg, "_origin_default_branch", …)`
    로 기본 브랜치 해석을 스텁하려 하면 **아무 효과 없이 조용히 무시된다** — "테스트가 의도한
    이름을 패치했는데 실제로는 아무것도 가로채지 못하는" 이번 브랜치 자체가 9라운드째 쫓고 있는
    바로 그 실패 형태다. 현재 그렇게 하는 테스트는 없음을 확인했다(`grep -rn
    "_origin_default_branch" .claude/tests/` → `test_branch_guard.py` 만 `bg.` 를 패치, `pg.`/
    `rg.` 패치는 0건)이므로 지금 당장 살아있는 결함은 아니지만, 다음에 누가 이 이름을 보고
    직관적으로 패치를 시도하면 바로 이 함정에 걸린다.
  - 제안: 두 훅의 죽은 `try/except _origin_default_branch` 블록을 삭제하고 주석도 함께
    걷어낸다(그 자리의 실제 동작은 이제 `_shared/git_probe.py` 의 동일 블록이 전담). 또는
    `git_probe.GitProbesAreNotReDuplicatedTest` 와 같은 층위로 "죽은 바인딩이 남아있지 않다"
    를 고정하는 짧은 테스트를 추가한다.

- **[WARNING]** 새 위임 모듈 `.claude/_shared/git_probe.py` 가 CI-env 정적 스캐너의 대상
  목록에 없음 — 판정을 가르는 최하위 primitive 가 정적 커버리지 밖으로 나감
  - 위치: `.claude/tests/test_review_gate_ci.py` 의 `TheGateItselfDoesNotBranchOnCiEnvTest`
    클래스, `_SCANNED = ("review_guard.py", "branch_guard.py", "plan_guard.py")` 줄
    (`grep -n "_SCANNED\s*=" .claude/tests/test_review_gate_ci.py` → 603행)
  - 상세: 이 클래스는 "게이트가 위임하는 파일들에 등재되지 않은 `os.environ` 읽기가 없는지"
    를 AST 로 정적 스캔한다. 스캔 경로 계산은 `_harness.HOOKS_DIR / "_lib" / name` 로,
    `.claude/hooks/_lib/` 아래만 본다. 이번 라운드가 `_run_git`/`_repo_root`/
    `_default_branch`/`_merge_base`/`_porcelain_path` — 두 게이트의 판정이 공유하는 가장
    기초적인 git 파싱 primitive 전부 — 를 `.claude/_shared/git_probe.py` 로 옮겼는데, 이
    새 파일은 `_SCANNED` 에도, 스캔 경로 계산 로직에도 잡히지 않는다(다른 디렉터리다). 지금은
    `git_probe.py` 가 `os.environ`/`os.getenv` 를 전혀 읽지 않아(직접 확인:
    `.claude/_shared/git_probe.py` 전문에 `environ`/`getenv` 없음) 실질적으로 뚫린 것은
    아니다. 그리고 형제 테스트 `TheRealGateIgnoresTheEnvironmentTest`(같은 파일, 646행 부근)는
    **행위 기반**이라 — 실물 저장소에 대해 최소 환경과 GH Actions 풀세트 환경 두 번 판정시켜
    결과가 같은지 본다 — `git_probe.py` 안에 미래에 env 분기가 생겨도 잡아낼 유일한 남은
    안전망이다. 다만 그 사실이 `TheGateItselfDoesNotBranchOnCiEnvTest` 자신의 독스트링에는
    적혀 있지 않고("판정자 본체도 환경으로 갈라지지 않는다"), 정적 목록이 최신 위임 구조를
    반영하지 못한 채 "커버한다" 는 인상을 준다 — 이 저장소가 정확히 이 클래스의 실패를
    (workflow paths 목록, `_ALLOWED_CALLS` 등에서) 반복해서 겪어온 패턴이다.
  - 제안: `_SCANNED` 에 `.claude/_shared/git_probe.py` (및 이미 위임 중인
    `report_paths.py`/`block_integrity.py` — 이쪽은 별도로 이미 스캔 대상이 아니라는 점도
    같은 갭)를 추가하거나, 스캔 대상을 "review_guard/plan_guard 가 import 하는 `_shared.*`
    전부" 로 동적 계산하도록 바꾼다. 최소한 이 클래스의 독스트링에 "행위 테스트가 실질적
    백스톱이고 이 목록은 참고용" 이라고 명시해 stale 목록이 안전 인상을 주지 않게 한다.

- **[INFO]** (프리엑시스팅, 이번 라운드 미변경) `os.environ` 전역 변경이 복원 없이 남는
  테스트 헬퍼
  - 위치: `.claude/tests/test_review_guard_hardening.py` 의
    `StopResolutionSuppressionTest._run_stop`, `os.environ.pop("BYPASS_REVIEW_GUARD", None)`
    줄(현재 파일 540행)
  - 상세: 같은 메서드 안에서 `CLAUDE_PROJECT_DIR` 는 이전 값을 저장했다가
    `self.addCleanup(...)` 으로 정확히 복원하는데(523-528행), 바로 다음 줄의
    `BYPASS_REVIEW_GUARD` pop 은 그런 저장/복원이 없다. 로컬에서 `BYPASS_REVIEW_GUARD=1` 을
    export 한 채로(예: 실제 push 우회를 테스트하던 셸에서 이어서) 이 스위트를 같은 프로세스로
    돌리면, 이 pop 이후 그 값이 스위트 나머지 테스트에 계속 사라진 채로 남는다 — 프로세스 전역
    가변 상태(`os.environ`)를 격리 없이 건드리는 형태다. CI 는 잡별로 새 프로세스이므로 실전
    영향은 없고, 이번 9R 변경분(git_probe 위임)과도 무관하지만, 같은 메서드가 바로 위에서
    보여준 "저장 → 복원" 규율과 대비되는 것이라 기록해 둔다.
  - 제안: `prev_bypass = os.environ.pop("BYPASS_REVIEW_GUARD", None)` 로 저장하고, `if
    prev_bypass is not None: self.addCleanup(os.environ.__setitem__,
    "BYPASS_REVIEW_GUARD", prev_bypass)` 를 같은 패턴으로 추가.

## 실증 명령과 결과

```
$ python3 -m py_compile .claude/hooks/_lib/plan_guard.py .claude/hooks/_lib/review_guard.py \
    scripts/check-review-gate.py
COMPILE_OK

$ python3 -m unittest discover -s .claude/tests -p 'test_*.py'
Ran 846 tests in 87.337s
OK

$ python3 -m unittest discover -s .claude/tests -p 'test_plan_guard.py' -v
Ran 33 tests in 0.247s
OK   (GitProbesAreNotReDuplicatedTest 포함)

$ python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v
Ran 19 tests in 3.273s
OK
```

Mutant-validity 확인(자체 스크래치 디렉터리에서, 작업 트리는 건드리지 않음):
`.claude/` 전체를 `mktemp -d` 사본에 복사한 뒤 `plan_guard.py` 에 `_run_git` 로컬 재정의를
`_run_git = _git_probe._run_git` 대입 **앞**에 주입(재복제 흉내) →
`GitProbesAreNotReDuplicatedTest.test_neither_guard_defines_them_locally` 가 정확히
`'_run_git' unexpectedly found in {...}` 로 RED, 반면 object-identity 만 보는
`test_both_guards_use_the_same_function_objects` 는 같은 뮤턴트에서 GREEN 으로 남았다(뒤이은
재대입이 이름을 다시 `git_probe` 것으로 덮어써 동일성만으로는 재복제를 못 잡음) — 두 테스트가
서로 다른 각도에서 필요하다는 것을 확인했고, 결함은 아니다(오히려 설계 의도대로 상호 보완).

```
$ (스크래치 사본에서)
$ python3 -m unittest discover -s .claude/tests -p 'test_plan_guard.py' -v 2>&1 | tail -8
FAIL: test_neither_guard_defines_them_locally (...) module='plan_guard.py', fn='_run_git'
AssertionError: '_run_git' unexpectedly found in {...} : plan_guard.py 가 _run_git 을
다시 로컬 정의했다 — 복제가 부활했다
Ran 33 tests in 0.236s
FAILED (failures=1)
```

## 요약

이번 라운드(9R)의 실제 코드 변경은 리뷰 프롬프트에 담기지 않은 미커밋 리팩터였다 — 두 훅이
손으로 복제해 갖고 있던 다섯 개 git 파싱 primitive(`_run_git`/`_repo_root`/
`_default_branch`/`_merge_base`/`_porcelain_path`)를 `.claude/_shared/git_probe.py` 하나로
위임 통합했고, 이는 7R/8R 이 반복적으로 찾아낸 "hand-synced-pair drift" 에 대한 근본적인
구조적 대응으로 타당하다. `-c core.quotePath=false`/`.rstrip()` 자체의 부작용(전역 git
config 미변경, 다른 `_run_git` 호출부와의 leading-whitespace 비호환 없음)은 프로세스 인자에
국한돼 안전함을 재확인했고, 846개 harness 테스트가 전부 통과하며 새 격리 테스트
(`GitProbesAreNotReDuplicatedTest`)의 mutation-validity 도 직접 확인했다. 다만 리팩터의
부산물로 (1) 두 훅에 더 이상 아무것도 읽지 않는 `_origin_default_branch` 임포트 블록이 죽은
채 남아 향후 목킹 시도를 조용히 무력화할 함정이 되었고, (2) CI-env 정적 스캐너
(`TheGateItselfDoesNotBranchOnCiEnvTest`)의 대상 목록이 새 위임 파일
`.claude/_shared/git_probe.py` 를 포함하도록 갱신되지 않아 — 지금은 그 파일이 환경변수를
전혀 읽지 않으므로 실해는 없지만 — 판정의 최하위 계층이 정적 커버리지 밖에서 행위 테스트
하나에만 의존하게 됐다. 둘 다 지금 당장 PR 판정을 뒤집는 결함은 아니지만, 이 브랜치가 9라운드
동안 쫓아온 "위임/추출 지점에서 목록이 stale 해지는" 바로 그 실패 클래스의 새 표면이라
기록해 둔다.

## 위험도

LOW
