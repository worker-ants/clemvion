# 테스트(Testing) Review — round 12

## 사전 확인 (측정)

- 회귀: 전체 harness 스위트 실행 — `python3 -m unittest discover -s .claude/tests -p 'test_*.py'`
  → `Ran 854 tests in 100.106s` / `OK`. round 12 의 실 diff(`git diff HEAD~1`, 3개 테스트
  픽스처의 `-C`+`GIT_CEILING_DIRECTORIES` 경화 + plan 문서)가 기존 테스트를 하나도 깨지
  않았다.
- round 12 자체 diff 는 작다(테스트 픽스처 3곳 + plan 문서). 이번 리뷰는 프롬프트가 파일
  전체를 "Review" 로 실었으므로, 그 델타뿐 아니라 이 델타가 기대는 판정 코드
  (`git_probe.py`/`review_guard.py`/`plan_guard.py`/`branch_guard.py`/`check-review-gate.py`)
  전체를 테스트 관점에서 훑었다.
- round 12 diff 자체(테스트 3곳에 `-C <root>` + `GIT_CEILING_DIRECTORIES=root` + 임시 트리
  밖 실행을 막는 `assert`) 는 11R 사고(공유 `.git/config` 오염)에 정확히 대응하는 수정이고,
  세 fixture 모두 동일 패턴으로 일관되게 적용됐다. 결함 없음.

## 발견사항

- **[WARNING]** `_origin_default_branch` 의 "Method 1"(로컬 `symbolic-ref
  refs/remotes/origin/HEAD`, 네트워크 불필요 — 자기 docstring이 "정상 케이스를 공짜로
  커버한다"고 부르는 그 경로)가 실제 git 저장소로 도는 테스트를 **한 번도 통과하지
  않는다**.
  - 위치: `.claude/_shared/git_probe.py:63-72` (`_origin_default_branch` Method 1 블록)
  - 상세: 이 함수를 실제 값으로 검증하는 자리는 두 갈래뿐이다 — (1)
    `test_branch_guard.py`/`test_plan_guard.py`의 결정표 테스트는
    `mock.patch.object(bg, "_origin_default_branch", ...)`/`mock.patch.object(pg,
    "_default_branch", ...)` 로 이 함수 자체를 통째로 우회한다. (2) 실제 git 저장소를 쓰는
    유일한 자리인 `test_review_guard_hardening.py::ActionsCheckoutTopologyTest` 는
    `init`+`remote add`+`fetch`(정확히 `actions/checkout` 위상)로만 저장소를 만드는데, 그
    위상은 **정의상** `refs/remotes/origin/HEAD` 가 없다 — `test_the_topology_really_lacks_
    both_local_refs` 가 그 부재를 스스로 단언한다. 즉 Method 1 가드하는 정확히 그 라인이
    이 스위트가 세운 모든 fixture 에서 실행되지 않는다. 직접 확인:
    ```
    $ grep -rn "origin/HEAD" .claude/tests/*.py
    test_review_guard_hardening.py:819: (docstring 설명)
    test_review_guard_hardening.py:884: (부재를 단언하는 라인)
    ```
    `git clone` 을 쓰는 fixture 는 스위트 전체에 하나도 없다(`grep -rn '"clone"'
    .claude/tests/*.py` → 0건). 격리 스크래치에서 직접 확인(작업 트리 밖,
    `mktemp -d` + `GIT_CEILING_DIRECTORIES`):
    ```
    $ git clone -q "$ORIGIN" "$CLONE"
    $ git -C "$CLONE" symbolic-ref --short refs/remotes/origin/HEAD
    origin/main
    $ python3 -c "... gp._origin_default_branch('$CLONE') ..."
    origin_default_branch: main
    ```
    지금은 맞게 동작한다 — 하지만 이 결과를 보장하는 테스트는 이 저장소 어디에도 없다.
    prefix-strip 로직(`out[len(prefix):]`)이나 Method1/Method2 우선순위를 실수로 바꿔도
    854개 테스트가 전부 그대로 통과한다. 이 프로젝트가 7R~9R 에 걸쳐 반복 학습한 바로 그
    교훈("mock 대신 실제 저장소로 구동하라", `.claude/tests/README.md` "Conventions for new
    tests")이 이 한 함수의 정상 경로에는 아직 적용되지 않았다.
  - 제안: `git clone` 또는 `git remote set-head` 를 명시로 실행하는 실제-저장소 fixture를
    하나 추가해 `_origin_default_branch`(또는 `_default_branch`)가 Method 1 로 정답을
    돌려주는지 직접 단언한다. `ActionsCheckoutTopologyTest` 옆에 자연스러운 대응 클래스로
    둘 수 있다("일반 clone 위상에서는 네트워크 폴백/로컬 폴백을 타지 않고 Method 1 로 끝난다").

- **[WARNING]** `_run_git` 의 타임아웃(hang 방지) 경로가 테스트되지 않는다 — 일반
  5초 기본값과, `_origin_default_branch` Method 2 의 명시적 `timeout=2.0` 클램프 둘 다.
  - 위치: `.claude/_shared/git_probe.py:106-129` (`_run_git`, `except
    (subprocess.TimeoutExpired, ...)` 절), 클램프 호출부는 `.claude/_shared/git_probe.py:77`.
  - 상세: `_run_git` 의 docstring 아닌 그 위 주석이 이 타임아웃의 존재 이유를 명시한다 —
    "이게 매 Stop / push PreToolUse 마다 도니 최악의 stall 을 작게 유지" (line 74-76).
    이제 CI 백스톱(`check-review-gate.py` → `evaluate_review()` → `_default_branch()` →
    `_origin_default_branch()`)도 같은 경로를 매 PR 마다 탄다. 그런데 `grep -rn
    "TimeoutExpired|timeout=2" .claude/tests/*.py` 는 0건 — 어떤 테스트도 `subprocess.run`
    이 `TimeoutExpired` 를 던지는 상황(느린/멎은 네트워크 `git remote show origin`, 또는
    일반 `_run_git` 호출)을 재현하지 않는다. 격리 스크래치에서 직접 측정(작업 트리 밖, 가짜
    `git` 이 30초 sleep, `PATH` 앞에만 주입):
    ```
    $ python3 -c "... gp._run_git(['remote','show','origin'], '/tmp', timeout=0.5) ..."
    rc=1 out='' dt=0.50s
    ```
    현재 구현은 **맞게** 동작한다(측정 확인) — 이 항목은 살아있는 결함이 아니라 회귀
    가드의 부재다. 이 클램프나 `except` 절의 예외 타입, 또는 `timeout=timeout` 인자 전달이
    리팩터 중 조용히 빠져도(예: `timeout` 파라미터를 깜빡하고 하드코드 제거) 854개 테스트가
    전부 그대로 통과하고, 실제 저하는 "PR 마다 CI 가 멎는다" 형태로만 드러난다 — 정확히
    이 backstop 이 막으려는 실패 모드(백스톱이 CI 를 막아서는 안 된다)의 반대편 증상이다.
  - 제안: 가짜 `git`(sleep) 을 `PATH` 앞에 주입하거나 `subprocess.run` 을 `TimeoutExpired`
    로 stub 해 `_run_git`(및 `_origin_default_branch` 의 `timeout=2.0` 클램프)이 지정한
    한도 안에서 `(1, "", "")` 로 되돌아오는지 서브프로세스/실측 기반으로 고정한다(반환 후
    타이밍 단언이 아니라, 실제 wall-clock 상한 — 메모리에 기록된 "성능/hang 회귀는
    서브프로세스+timeout" 교훈과 동일 처방).

- **[INFO]** `check-review-gate.py::main()` 의 `getattr(decision, "notes", ()) or ()`
  fallback 분기(줄 100)가 어떤 테스트에서도 실제로 `notes` 속성이 **없는** 스텁으로
  실행되지 않는다.
  - 위치: `scripts/check-review-gate.py:100` (`notes = list(getattr(decision, "notes", ()) or ())`)
  - 상세: `test_review_gate_ci.py` 의 모든 스텁 decision 클래스(`_D`, `OneJudgeTest`/
    `VerdictComesFromTheGateTest` 의 스텁 포함)는 `notes` 속성을 명시로 갖거나(`notes =
    ()`/property), 아예 `evaluate_review` 가 예외를 던져 그 줄에 도달하지 못한다
    (`test_a_gate_that_raises_does_not_fail_ci`). 실제 `ReviewDecision` 은 항상 `notes:
    tuple[str, ...] = ()` 필드를 갖고 있어 실무 영향은 낮지만, `getattr` 기본값이 존재하는
    이유(진짜 인터페이스와 다른 게이트 구현을 만나도 안 죽는 것) 자체를 증명하는 테스트가
    없다 — 방어 코드 한 줄이 "왜 있는지"를 검증하는 자리가 비어 있다.
  - 제안: `notes` 속성이 없는 최소 스텁(`class _D:\n    blocked=False\n    reason=''\n
    push_blocks=False\n` — `notes` 생략)으로 exit 0 + 빈 notes 출력을 단언하는 케이스
    하나만 추가하면 닫힌다. 낮은 우선순위.

## 확인했지만 결함 아님 (참고)

- `evaluate_review()`/`check-review-gate.py` 는 `decision.blocked` 를 직접 읽는다(과거
  라운드의 `push_blocks` 대 `blocked` 혼동과 달리 스크립트가 실제 `ReviewDecision.blocked`
  필드와 정확히 일치). `test_a_gate_that_raises_does_not_fail_ci`/`test_notes_are_printed_
  on_both_verdicts` 의 스텁 docstring 이 "이 소비자는 `push_blocks` 를 안 읽지만 진짜
  인터페이스를 그대로 비추는 게 싸다"고 정확히 그 이유를 적어뒀다 — 의도된 설계.
- `_default_branch()` 의 로컬 폴백 루프(`refs/remotes/origin/{}` 우선, `main`/`master` 만
  하드코드)는 `ActionsCheckoutTopologyTest::test_the_remote_tracking_ref_outranks_a_local_
  branch_of_another_name` 로 순서까지 실측 고정돼 있다(주장만 하고 검증 안 한 첫 판을
  리뷰어가 스스로 잡아낸 이력까지 docstring 에 남아 있음) — 위 두 WARNING 과 달리 이
  경로는 충분히 덮여 있다.
- `plan/in-progress/harness-review-gate-ci-backstop.md` 의 §13 항목이 이미 "동일 노출이
  4곳에 pre-existing" 이라고 명시적으로 등재·범위 밖 처리해 뒀다
  (`test_consistency_bundle_priority.py`/`test_consistency_impl_done.py`/
  `test_line_anchors.py`/`test_push_guard_worktree_scope.py`) — 재지적하지 않는다.
- `Fetch base ref` step 의 실제 필요성은 실제 Actions 러너 없이는 측정 불가라고 이미
  기록돼 있다 — 재지적하지 않는다.

## 요약

round 12 자체 diff(테스트 픽스처 3곳의 `-C`+`GIT_CEILING_DIRECTORIES` 경화)는 11R 사고에
정확히 대응하며 결함이 없고, 전체 하네스 스위트(854개)가 그대로 통과해 회귀도 없다.
`git_probe.py`/`review_guard.py`/`plan_guard.py`/`branch_guard.py`/`check-review-gate.py`
를 판정축으로 다시 훑었을 때 새로운 우회나 판정 반전은 찾지 못했다(라운드 7~11이 이미
그 표면을 소진시켰다는 컨텍스트와 일치). 다만 CI 백스톱이 매 PR 마다 실제로 타는 공유
`git_probe.py` 코드 중 두 경로 — `_origin_default_branch` 의 로컬 fast-path(Method 1)와
`_run_git`/네트워크 폴백의 타임아웃(hang 방지) 경로 — 는 실제 저장소로 검증하는 테스트가
전혀 없다. 둘 다 지금은 수동 측정으로 정상 동작을 확인했지만, 이 프로젝트가 7R~11R 에
걸쳐 반복 학습한 "판정 헬퍼는 mock 이 아니라 실제 저장소/실제 hang 시나리오로 구동해야
회귀를 잡는다"는 교훈이 이 두 자리에는 아직 미적용 상태라 WARNING 으로 남긴다.

## 위험도

LOW
