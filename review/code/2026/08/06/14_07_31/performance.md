# 성능(Performance) Review — round 10 (CI 백스톱, `git_probe.py` 추출)

대상 diff: `e834d0f4e` (`.claude/_shared/git_probe.py` 신설, `branch_guard.py`/`plan_guard.py`/
`review_guard.py` 위임 전환, 관련 테스트). `.github/workflows/review-gate.yml` ·
`scripts/check-review-gate.py` 자체는 이번 라운드 diff에 없음(9R까지 이미 구현됨) — 이번 라운드가
그 게이트에 물리는 판정 함수(`evaluate_review`)의 호출 빈도를 CI 쪽으로 늘렸다는 점만 새로 고려.

## 발견사항

- **[WARNING]** 새 `_shared/git_probe.py` 가 두 훅의 **공용 단일 구현**이 됐는데도, 같은 프로세스
  안에서 두 번 반복되는 동일 git 조회를 캐시하지 않는다.
  - 위치: `.claude/_shared/git_probe.py:106-137` (`_repo_root`/`_default_branch`/`_merge_base`,
    캐시 없음) — 호출부는 `.claude/hooks/_lib/review_guard.py:916-921`(`evaluate_review`)와
    `.claude/hooks/_lib/plan_guard.py:273-278`(`evaluate_plan`).
  - 상세: `guard_review_before_push.py`(이번 diff 밖, 정본 소비자)는 `git push` 한 번마다
    `evaluate_review(cwd)` 와 `evaluate_plan(cwd)` 를 **같은 프로세스**에서 순서대로 부른다. 두
    함수 모두 독립적으로 `_repo_root(cwd)` → `_default_branch(cwd)` → `_merge_base(cwd, default)`
    를 처음부터 다시 계산하므로 `git rev-parse --show-toplevel` · (`git remote`/
    `git symbolic-ref refs/remotes/origin/HEAD`/필요시 `git remote show origin`) ·
    `git merge-base` 가 **동일 인자로 두 번씩** 실행된다. 실측(아래 명령):
    ```
    $ python3 -c "..."  # review_guard.evaluate_review('.') + plan_guard.evaluate_plan('.')
    combined push-hook path: 0.244s, git subprocess calls=12
    ```
    (코드베이스 변경이 없는 가장 빠른 경로에서도 12회. `_default_branch` 가 로컬
    `symbolic-ref` 캐시를 못 찾아 `git remote show origin`(네트워크, 최대 2.0s 타임아웃) 폴백을
    타는 환경이면, 이 중복만으로 push 지연이 최대 +2s 더 늘어난다.)
    이 추출 자체가 "손 복제 세 벌을 하나로" 라는 것이 목적이었고 그 목적은 correctness 축에서는
    달성됐지만, 바로 그 단일화 덕분에 프로세스-로컬 캐시(`cwd` 키의 `functools.lru_cache`
    등)를 붙일 자연스러운 지점이 생겼는데 이번 라운드는 그 기회를 쓰지 않았다.
  - 제안: `git_probe.py` 의 `_repo_root`/`_default_branch`/`_merge_base` 에 프로세스 수명 동안만
    유효한 경량 메모이제이션을 추가(같은 `cwd` 인자 재호출 시 subprocess 재실행 생략). 훅
    프로세스는 단명이라 무효화 정책이 필요 없다 — 스코프가 "한 번의 훅 실행" 이면 충분.

- **[WARNING]** 리뷰 세션 전체 이력을 매 호출마다 선형 스캔 — 이번 라운드가 그 호출부(CI)를
  하나 더 늘렸다.
  - 위치: `.claude/hooks/_lib/review_guard.py:498-528`(`_newest_resolved_review_mtime`),
    `:720-762`(`_newest_resolved_impl_done_mtime`) — `evaluate_review`(`:946-947`, `:969-970`)에서
    호출. CI 쪽 새 호출 경로: `.github/workflows/review-gate.yml` job `gate` →
    `scripts/check-review-gate.py:96-97`(`evaluate(root)`).
  - 상세: `_newest_resolved_review_mtime` 은 `review/code/**` 전체를 `os.walk` 하고, 발견한 모든
    `SUMMARY.md` 마다 `_summary_is_resolved` 를 호출한다(각각 `_retry_state.json` 오픈, 조건부로
    `RESOLUTION.md` 존재 확인, 조건부로 `SUMMARY.md` 전체 읽기+정규식 스캔). spec-linked 변경이면
    같은 패턴이 `review/consistency/**` 에도 반복된다. 실측(현재 저장소):
    ```
    $ find review/code -name SUMMARY.md | wc -l          # 809
    $ find review/consistency -name SUMMARY.md | wc -l    # 738
    $ python3 -c "...rg._newest_resolved_review_mtime('.', dirty)..."
    newest_resolved_review_mtime: 0.353s (best=1785990812.0)
    $ python3 -c "...rg._newest_resolved_impl_done_mtime('.', dirty, notes)..."
    _newest_resolved_impl_done_mtime: 0.128s (best=1785579995.0)
    $ python3 -c "...rg.evaluate_review('.') with codebase change mocked..."
    evaluate_review (with codebase change) took 0.355s
    ```
    이 비용은 **저장소가 지금까지 쌓은 전체 리뷰 세션 수에 비례**하고 상한이 없다 — 병합 시점
    이후로만 보거나, 이미 계산해 둔 `newest_code` 이상인 첫 세션에서 멈추는 식의 조기 종료가
    없다(현재 필요한 것은 `max(resolved) >= newest_code` 여부뿐인데 항상 전수 `max` 를 구한다).
    plan 문서(`plan/in-progress/harness-review-gate-ci-backstop.md`)가 이미 "`codebase/**` PR
    435건 중 355건이 해결된 리뷰 동반" 이라고 실측해 둔 것처럼 이 저장소는 계속 리뷰 세션을
    쌓는 관행이라, 이 스캔은 시간이 지날수록 커지기만 한다. 이번 라운드는 정확히 이 함수를 새
    호출자(GitHub Actions, `codebase/**` 또는 `.claude/hooks/_lib/**` 등을 건드리는 모든 PR)에
    연결했으므로 — 로컬 push/Stop 훅뿐 아니라 팀 전체 PR 마다 이 선형 스캔이 한 번 더 돈다.
    현재 절대 시간(≈0.5s)은 CI `timeout-minutes: 5` 대비 무해하지만, 이 성장 추세는 파일 내
    `_MAX_GLOB_WILDCARDS`·`_spec_code_patterns`(633개 spec 측정치) 처럼 "측정하고 상한을 건"
    다른 항목들과 달리 어디에도 결정으로 기록돼 있지 않다.
  - 제안: (a) 세션 디렉터리명이 이미 시간순 정렬 가능한 타임스탬프이므로 최신순으로 walk 하며
    `resolved and t >= newest_code` 를 만족하는 첫 세션에서 조기 종료, (b) 또는 리뷰/일관성
    커버리지를 위한 경량 인덱스(예: 세션 dir → resolved 여부·시각 캐시 파일)를 두고 증분 갱신.
    지금 당장 막을 필요는 없고, 성장 추세를 인지하고 있다는 기록만이라도 plan 에 남길 것을 권장.

- **[INFO]** `_newest_resolved_review_mtime` 루프가 `RESOLUTION.md` 존재를 세션마다 두 번 확인.
  - 위치: `.claude/hooks/_lib/review_guard.py:429`(`_summary_is_resolved` 내부에서 1차 확인) 와
    `:521-522`(`_newest_resolved_review_mtime` 루프 본문에서 동일 경로 2차 확인).
  - 상세: `_summary_is_resolved(summary_path)` 는 `RESOLUTION.md` 가 있으면 그 자리에서
    `True` 를 반환(추가로 `SUMMARY.md` 를 읽지 않음)한다. 호출부 `_newest_resolved_review_mtime`
    은 그 반환값을 받은 뒤, dirty-mtime 보정을 위해 같은 `os.path.join(session_dir,
    "RESOLUTION.md")` 존재 여부를 **다시** `os.path.exists` 로 확인한다. 세션당 `stat()` 1회씩
    낭비 — 개별로는 마이크로초 단위지만 위 두 번째 항목이 지적한 성장 추세 위에 얹힌다.
    이번 라운드가 `_summary_is_resolved` 의 위험도-파싱 루프(`break` 버그, C1)를 직접 고쳤고
    바로 옆 코드라 함께 다듬을 기회가 있었다.
  - 제안: `_summary_is_resolved` 가 resolution 경로(또는 bool)를 반환하도록 시그니처를 넓히거나,
    호출부에서 `RESOLUTION.md` 존재를 한 번만 계산해 양쪽에서 재사용.

- **[INFO]** `git_probe._origin_default_branch` 가 `branch_guard.py` 를 별도 `sys.modules` 키
  (`_git_probe_branch_guard`) 아래 **두 번째 인스턴스**로 동적 로드.
  - 위치: `.claude/_shared/git_probe.py:35-59`.
  - 상세: 같은 프로세스에서 다른 경로로 `branch_guard.py` 가 이미 `import`(예: package-qualified
    `_lib.branch_guard`)돼 있어도, 이 함수는 `importlib.util.spec_from_file_location` 으로 완전히
    별도의 모듈 객체를 만들어 `exec_module` 한다. `sys.modules.get("_git_probe_branch_guard")` 로
    프로세스 내 1회만 캐시되므로 반복 호출 비용은 없고(O(1) 이후), `branch_guard.py` 자체가
    작아 절대 비용도 무시할 수준(<1ms)이지만, 한 프로세스에서 그 모듈의 top-level 상태가 최대
    2벌 살아있게 되는 새 코드 경로다. 현재는 문제를 일으키지 않으나 이 함수에 상태를 추가하는
    쪽으로 확장되면 두 인스턴스가 갈릴 수 있다는 점만 기록.
  - 제안: 특별한 조치 불요 — INFO. 향후 `branch_guard.py` 에 모듈 레벨 가변 상태가 생기면
    재검토.

## 요약

이번 라운드(9R→10R)의 핵심 변경은 `git_probe.py` 추출과 위험도 파싱 잠복 결함 수정으로, 둘 다
성능 저하를 유발하지 않는다 — 알고리즘 자체는 그대로 이동했을 뿐이다. 다만 추출이 만든 단일
chokepoint 에서 두 훅(`review_guard`/`plan_guard`)이 같은 프로세스 안에서 동일 git 조회를
독립적으로 반복하는 기존 비효율(측정: 코드 변경 없는 가장 빠른 push 경로에서도 git subprocess
12회, 0.24초)을 캐시로 눌러줄 자연스러운 기회를 놓쳤다. 더 무거운 것은 `evaluate_review()` 의
리뷰/일관성 세션 전수 스캔(측정: 809+738개 세션에 약 0.5초)으로, 상한 없이 저장소 히스토리에
비례해 계속 커지는데 이번 라운드가 그 함수를 CI(GitHub Actions, PR마다)라는 새 고빈도 호출자에
연결했다 — 오늘은 CI 5분 타임아웃 대비 무해하지만 다른 유사 항목들과 달리 성장 추세가 기록돼
있지 않다. 세션당 `RESOLUTION.md` 중복 stat 은 미미한 수준의 추가 낭비. 넷 다 지금 당장 게이트를
막을 사안은 아니며, 즉시 조치보다는 인지·백로그 등재가 적절한 수준이다.

## 위험도

LOW
