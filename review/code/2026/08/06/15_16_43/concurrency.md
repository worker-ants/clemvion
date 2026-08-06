# 동시성(Concurrency) Review

## 범위 확인

`git diff origin/main --stat` 로 이 브랜치(16 커밋)가 손댄 실제 파일을 확인했다. 판정 코드
(`review_guard.py`/`plan_guard.py`/`branch_guard.py`/`_shared/git_probe.py`)는 전부 동기·단일
프로세스 CLI/훅이며, 이번 라운드의 변경은 (1) git 프로브 5~6개를 세 훅에서 `_shared/git_probe.py`
로 위임 통합, (2) `actions/checkout` 위상에서 기본 브랜치 해석이 네트워크 폴백으로만 떨어지던
결함 수정, (3) 훅-독립 CI 백스톱(`review-gate.yml` + `check-review-gate.py`) 신설이다. 스레드·
asyncio·멀티프로세싱은 어디에도 없고, 공유 가변 상태도 모듈 전역 캐시 없이 인자 기반 순수 함수로
구성돼 있어 고전적 의미의 race/deadlock 표면은 거의 없다. 그런데 테스트 픽스처 쪽에서 실제 사고
사례를 재현하는 결함 하나를 찾았다 — 아래 발견사항 1.

## 발견사항

- **[WARNING]** `test_review_guard_hardening.py` 안에 이번 라운드가 방금 고친 것과 **같은
  결함 클래스**(임시 트리 밖 git 실행 → 공유 `.git/config` 오염)를 가진 미경화 픽스처가 두 개
  남아 있다. 그중 하나는 이 브랜치가 새로 추가한 것이다.
  - 위치: `.claude/hooks/_lib/../../tests/test_review_guard_hardening.py`
    (Read 로 직접 확인한 실제 소스 줄 번호 — 이 파일은 프롬프트에서 크기 제한으로 잘렸다):
    - `UnstagedModificationKeepsItsPathTest._git` — **677~684행** (이번 브랜치가 신규 추가,
      `git diff origin/main` 기준 `NotesReachThePublicEntryPointTest` 뒤 +304줄 블록 안에 위치)
    - `NotesReachThePublicEntryPointTest._git` — **588~595행** (origin/main 에 이미 존재, 이번
      브랜치가 만든 것은 아니지만 같은 파일에서 같은 결함 형태로 살아남아 있다)
    - 대조: 같은 파일의 `ActionsCheckoutTopologyTest._git` — **851~874행**. 바로 이 라운드의
      마지막 커밋(`9c270100f`)이 `resolved = os.path.realpath(cwd); assert resolved == root or
      resolved.startswith(root + os.sep)` + `env["GIT_CEILING_DIRECTORIES"] = root` +
      `subprocess.run(["git", "-C", resolved, *args], ...)` 로 경화한 바로 그 헬퍼다.
  - 상세: `git status`, `README.md`, 커밋 `9c270100f` 메시지로 확인한 사실 — 11R 에서
    `ActionsCheckoutTopologyTest`(당시 신규 픽스처)의 `_git` 헬퍼가 `subprocess.run(["git", *args],
    cwd=cwd, ...)` 형태로 실행되다가, 워크트리 5개가 공유하는 `.git/config` 의 `origin` URL 을
    임시 경로로 덮어썼다. 다른 세션(dep-hygiene, pr-1075-1080-build-test,
    retry-turn-cancel-guard)의 `git fetch`/`push` 가 함께 깨졌고, 오염 시점엔 아무 신호가 없어
    다음 `git fetch` 실패로 우연히 발견됐다 — "조용히 성공한 것이 최악" 이라고 커밋 메시지 스스로
    적고 있다. 이 라운드는 그 사고를 복구하고 **"이 브랜치가 손댄 픽스처 3개"** (`test_plan_guard.py`
    의 `PorcelainPathSurvivesOnARealRepoTest`, `test_review_gate_ci.py` 의 `ReviewGateCliTest`,
    `test_review_guard_hardening.py` 의 `ActionsCheckoutTopologyTest`)의 `_git` 헬퍼를 `git -C` +
    `GIT_CEILING_DIRECTORIES` + 임시-루트-밖-단언으로 경화했다. 커밋 메시지는 또한 "전수 조사"로
    `-C`/ceiling 없는 pre-existing 노출 4곳(`test_consistency_bundle_priority.py`,
    `test_consistency_impl_done.py`, `test_line_anchors.py`, `test_push_guard_worktree_scope.py`)을
    찾아 plan 의 §후속 13 에 등재했다고 적는다.
    그런데 그 "전수 조사"는 **같은 파일 안에서 세 클래스 위/아래에 있는 두 개의 동일 패턴을
    놓쳤다** — `NotesReachThePublicEntryPointTest._git`(588행)과, 이번 브랜치가 이번 라운드
    이전에 이미 추가해 둔 `UnstagedModificationKeepsItsPathTest._git`(677행) 둘 다
    `subprocess.run(["git", *args], cwd=self.root, ...)` 그대로다 — `-C` 없음,
    `GIT_CEILING_DIRECTORIES` 없음, cwd 가 임시 루트 안인지 확인하는 `assert` 없음. `grep -rl
    GIT_CEILING_DIRECTORIES .claude/tests/` 로 확인: 저장소 전체에서 이 방어가 걸린 파일은
    정확히 3개(`test_plan_guard.py`, `test_review_gate_ci.py`, `test_review_guard_hardening.py`
    자기 자신, 그것도 파일 안의 세 `_git` 중 하나에만)뿐이다. 이번 방어가 정확히 어떤 조건에서
    `cwd=` 가 의도한 임시 디렉터리를 벗어나는지는 이 라운드의 커밋 메시지도 상세 메커니즘을
    적지 않아 재현하지 못했다(측정 전 단정 금지 원칙에 따라, 이 두 클래스에서 실제 오염을
    재현했다고는 주장하지 않는다) — 다만 그 두 클래스가 `git init`/`add`/`commit` 을
    격리 없이 돌리는 것은 사실이고, `remote add`/`config` 를 안 부른다는 사실이 방어가 안 되는
    이유는 못 된다: `cwd` 해석이 어긋나면 `git commit` 이 실제 워크트리에 커밋을 남기는 쪽이
    `remote add` 가 origin URL 한 줄을 덮는 것보다 더 나쁜 결과다.
  - 이 프로젝트가 반복해서 겪은 정확히 그 패턴이다 — "한 사본만 고치고 나머지는 남긴다"
    (git 프로브 3중 사본, `_current_branch` 6번째 누락 등, 이 티켓의 7R~10R 이력과 동일 클래스).
    이번엔 파일이 다른 게 아니라 **같은 파일 안의 이웃 클래스**라 전수 조사가 더 쉽게 잡을 수
    있었던 경우다.
  - 제안: `ActionsCheckoutTopologyTest._git` 의 세 가지 방어(임시-루트-밖 assert, `git -C`,
    `GIT_CEILING_DIRECTORIES`)를 `NotesReachThePublicEntryPointTest._git`·
    `UnstagedModificationKeepsItsPathTest._git` 에도 그대로 적용하거나, plan 문서 §후속 13 이
    이미 제안한 `_harness.py` 공용 `make_temp_git_repo()` 로 다섯 개 사본(3개 경화됨 + 2개 미경화
    + 등재된 4개)을 한 번에 흡수할 것. 동시에 `.claude/tests/README.md` §"Conventions for new
    tests"(`git init` 실제 임시 저장소 관례를 적어둔 절, 81~90행)에 이 방어를 **필수 관례**로
    명문화해야 한다 — 지금은 `GIT_CONFIG_GLOBAL=/dev/null` 격리만 적혀 있고 `GIT_CEILING_DIRECTORIES`
    / `-C` 언급이 없어, 이번처럼 신규 픽스처를 작성할 다음 라운드가 같은 구멍을 다시 판다.

- **[INFO]** GitHub Actions 동시성 설정은 정확하다. `review-gate.yml`·`harness-checks.yml`
  둘 다 `concurrency: { group: <워크플로>-${{ github.ref }}, cancel-in-progress: true }` 를
  ref 단위로 걸어 같은 브랜치의 stale 실행을 취소한다. 두 워크플로 모두 `permissions: contents:
  read` 이고 잡이 파일시스템에 영속적 부수효과를 남기지 않으므로(표준 출력/종료 코드만), 취소가
  중간 상태를 남길 위험도 없다. 새로 추가된 `review-gate.yml` 의 스텝 순서(`checkout(fetch-depth:0)`
  → `setup-python` → `Fetch base ref` → 게이트 실행)도 순수 순차 실행이라 경쟁 조건이 없다.

- **[INFO]** `plan/in-progress/harness-review-gate-ci-backstop.md` §신규 후속 10 이 이미
  `_retry_state.json` 의 read-modify-write 락 부재(lost update)를 기록하고 있다 — 하지만 이는
  `merge_coordinator_orchestrator.py`/`_shared/retry_state.py` 쪽 파일로 이번 리뷰 대상 15개
  파일 밖이고, `fcntl.flock` 을 의도적으로 채택하지 않은 근거(모든 훅 경로에 블로킹 프리미티브를
  놓는 비용)까지 이미 문서화된 **결정**이다. 재보고하지 않는다 — 다만 위 발견사항 1 과 같은
  "공유 자원 다중 접근" 계열이라는 점만 교차 참조로 남긴다.

- **[INFO]** `review_guard.py` 의 `_resolution_in_flight`/`_code_review_in_flight`(마커
  디렉터리 `os.listdir` + `open`)는 이번 라운드가 건드리지 않은 기존 코드다(`git diff origin/main`
  로 미변경 확인). PreToolUse(Agent) 훅이 마커를 쓰고 Stop 훅이 읽는 생산자-소비자 구조지만,
  각각 별도 프로세스이고 파일 존재/내용만 읽는 read-mostly 라 이번 diff 범위에서 새로 만들어진
  경쟁은 없다.

## 요약

이번 라운드의 실질 코드 변경(git 프로브 통합, `actions/checkout` 위상에서의 기본 브랜치 해석
수정, 훅-독립 CI 백스톱 신설)은 전부 동기·단일 프로세스이고 GitHub Actions 의 `concurrency`
설정도 표준적으로 올바르게 돼 있어, 고전적 race/deadlock/동기화 결함은 발견되지 않았다. 다만
바로 이 라운드가 "임시 트리 밖 git 실행이 워크트리 5개가 공유하는 `.git/config` 를 오염시켜
다른 세션들을 깨뜨린" 실제 사고를 복구하고 그 원인 패턴을 3개 픽스처에서 경화했는데, 정작 그
전수 조사가 **같은 파일 안에** 남아 있는 동일 패턴 두 개(그중 하나는 이 브랜치가 새로 추가한
`UnstagedModificationKeepsItsPathTest`)를 놓쳤다. 공유 리소스(`.git/config`)에 대한 동시 접근
안전장치가 "한 사본만 고치고 나머지는 방치"된 상태이므로, 이 부분을 WARNING 으로 올린다.

## 위험도

MEDIUM — 프로덕션 판정 로직 자체에는 동시성 결함이 없으나, 이번 세션 안에서 실제로 발현한
공유 워크트리 자원 오염 사고와 동일한 클래스가 리뷰 대상 파일 안에 두 곳(그중 1곳은 이 브랜치
신규 추가) 미경화 상태로 남아 있다.

STATUS: SUCCESS
