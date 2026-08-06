# 문서화(Documentation) Review — round 11 (10R 커밋 `9a7b28764` 대상)

## 방법

`.claude/_shared/git_probe.py` / `.claude/hooks/_lib/{branch_guard,plan_guard,review_guard}.py` /
`.github/workflows/{harness-checks,review-gate}.yml` / `plan/in-progress/harness-review-gate-ci-backstop.md` /
`scripts/check-review-gate.py` 는 프롬프트에 전체가 실려 있어 그대로 판단했다. 프롬프트가 예산 초과로
누락시킨 `.claude/tests/README.md` · `test_block_integrity.py` · `test_review_guard_hardening.py` ·
`test_review_gate_ci.py`(515/829줄만) 는 지시대로 `Read` 로 직접 열어 확인했다. 이번 라운드에 실제로
바뀐 부분을 특정하기 위해 `git show 9a7b28764`(10R 커밋)와 `git diff origin/main...HEAD --stat` 을
직접 돌렸다 — 아래 인용 명령/출력 참조.

## 발견사항

- **[WARNING]** `.claude/tests/README.md` 의 `test_plan_guard.py` 행이 10R 이 바꾼 검증 방식을
  서술하지 않는다 — 이 저장소가 반복해서 "손-동기 문서는 드리프트한다" 고 스스로 기록해 온 바로
  그 클래스.
  - 위치: `.claude/tests/README.md:62` (해당 행), 대조 대상은 `.claude/tests/test_plan_guard.py`
    의 `GitProbesAreNotReDuplicatedTest` 클래스(프롬프트 게이트 329~400행).
  - 상세: README 는 이렇게 적고 있다 — "`GitProbesAreNotReDuplicatedTest` then pins the
    structural fix: the five git probes the three guards had each hand-copied now live in
    `_shared/git_probe.py`, **and both object identity and the absence of a local `def` are
    asserted**, because that pair drifted twice in a row — round 7 fixed one copy, round 8
    found the second still broken, **round 9 found a third in `branch_guard.py`**."
    이는 9R 시점의 구현을 정확히 서술하지만, 10R 커밋(`9a7b28764`)이 정확히 이 테스트를 바꿨다:
    - "the absence of a local `def`" 방식(`test_neither_guard_defines_them_locally`, 손으로 적은
      `_SHARED`/`_SHARED_IN_BRANCH_GUARD` 목록과 대조)은 **삭제**됐다.
    - 대신 세 모듈의 AST 를 서로 비교해 "본문이 동일한 함수가 남아 있으면 그 자체로 실패"시키는
      `test_no_identical_function_survives_in_two_guards` 로 교체됐다 — 목록을 아예 안 쓴다.
    - 이 교체 자체가 10R 의 핵심 서사다: "9R 이 다섯 개를 옮겼는데 **10R 이 여섯 번째
      (`_current_branch`)를 찾아냈다** — 통합도 그것을 지키는 가드도 손으로 쓴 목록이었기
      때문" (`git_probe.py` 모듈 docstring, 프롬프트 게이트 24~29행 및
      `test_plan_guard.py` 클래스 docstring, 게이트 330~343행 — 두 곳 다 갱신됨).
    - README 행은 "round 9 found a third" 까지만 적고 **10R 의 존재 자체(6번째 프로브 발견,
      열거→도출 전환)를 언급하지 않는다.**
  - 왜 걸리는 문제인가: `test_tests_readme_catalog.py` 는 "모든 `test_*.py` 가 행을 갖는가"만
    검증하고 행의 **내용**이 실제 코드와 맞는지는 보지 않는다 — 그래서 이 드리프트는 어떤 가드도
    잡지 못한다. 정확히 이 프로젝트가 `test_router_safety_policy_doc.py` 로 별도 가드를 만들어야
    했던 이유(정책 표가 24 vs 44 로 갈렸는데 아무 것도 안 잡았던 사고)와 같은 클래스다.
  - 제안: README 행을 10R 상태로 갱신 — "이제 목록을 쓰지 않는다, 세 모듈 AST 를 비교해 본문
    동일 함수가 남아 있으면 실패시킨다" + "10R 이 6번째(`_current_branch`)를 찾았다" 한 문장 추가.

- **[WARNING]** 같은 README 의 `test_review_guard_hardening.py` 행이 10R 이 **새로 추가한**
  `ResolutionMarkerPathIsConsistentTest` 클래스를 언급하지 않는다.
  - 위치: `.claude/tests/README.md:57` (해당 행). 새 클래스는
    `.claude/tests/test_review_guard_hardening.py` 끝(diff 상 마지막 38줄, `git show 9a7b28764`
    확인)에 있다.
  - 상세: 10R 커밋이 추가한 이 클래스는 "마커 디렉터리 경로가 네 곳에 손으로 적혀 있다 — 갈리면
    조용히 망가진다"(리뷰어가 뮤테이션으로 실증: 디렉터리명을 바꿔도 111개 테스트 전부 GREEN)를
    고정하는데, README 행은 여전히 9R 이전 서술(porcelain rename · `**/` globbing · session-dir
    clock · dirty/clean split · in-flight suppression · rebase author-date)에서 멈춰 있다.
    이 클래스가 고정하는 성질("손-동기 쌍은 갈린다")이 바로 위 첫 발견사항과 같은 뿌리이고,
    이 브랜치가 git 프로브에서 세 라운드 연속 겪은 것과 같은 클래스라고 그 클래스 자신의
    docstring 이 명시한다 — 그런데 그 사실을 알리는 목록(README)에는 안 실렸다.
  - 제안: README 행에 한 문장 추가 — "resolution-marker 경로가 4곳(정본 + 두 훅 + 테스트
    헬퍼)에 손 복제돼 있는지 `ResolutionMarkerPathIsConsistentTest` 가 대조한다".

- **[INFO]** `_current_branch`/`_origin_default_branch` 위임 줄에만 설명 주석이 빠져 있다 —
  같은 파일의 형제 위임 블록들과 비교하면 도드라지는 비대칭.
  - 위치: `.claude/hooks/_lib/plan_guard.py:115` (`_current_branch = _git_probe._current_branch`),
    `.claude/hooks/_lib/branch_guard.py:57-58`
    (`_current_branch = _git_probe._current_branch` / `_origin_default_branch = ...`).
  - 상세: `plan_guard.py:102-107` 은 바로 위 다섯 줄(`_run_git`~`_porcelain_path`) 위임에
    "이 다섯은 `_shared/git_probe.py` 로 옮겼다, 7R/8R 에 두 번 갈렸다" 는 주석을 달아 두고,
    `branch_guard.py:42-44` 도 `_run_git`/`_repo_root` 위임에 "세 번째 사본이었다" 는 주석을
    달아 둔다. 그런데 `_current_branch`(두 파일 모두)와 `_origin_default_branch`
    (`branch_guard.py`) 위임 줄 자체는 아무 주석이 없다 — 정확히 10R CRITICAL 의 현장이었고
    (뮤테이션으로 반환값을 오염시켜도 849개 테스트 전원 GREEN 이면서 "메인 워크트리에서 default
    브랜치 편집 차단" 이 조용히 무력화됐다는 그 발견), `_origin_default_branch` 는 이번 라운드에
    구현 방향이 뒤집힌 자리이기도 하다(이전엔 `branch_guard.py` 가 정본이고 `git_probe.py` 가
    `importlib` 로 되감아 부르는 래퍼였는데, 10R 이 정본을 `git_probe.py` 로 옮기고
    `branch_guard.py` 가 위임하는 쪽으로 뒤집었다 — `git show 9a7b28764` diff 확인). 이 역사가
    이 두 파일을 단독으로 여는 독자에게는 전혀 안 보이고, `_shared/git_probe.py` 의 모듈
    docstring 을 따로 열어야만 드러난다.
  - 제안: 필수는 아니나, 두 줄 위에 한 줄씩("10R 이 여기서 6번째 사본을 찾았다 — 위 다섯과 같이
    옮겼다" 류) 붙이면 이 파일의 나머지 위임 블록과 설명 밀도가 맞는다.

- **[INFO]** `_default_branch()` 의 `if True:` 가 이전 버전의 조건문 잔재로 보이고, 이를
  설명하는 주석이 없다.
  - 위치: `.claude/_shared/git_probe.py:139-146` (`def _default_branch` 본문의 `if True:` 블록).
  - 상세: `git show 9a7b28764` diff 로 확인하면 이 줄은 원래 `if resolver is not None:` 이었다
    — `_origin_default_branch(cwd)` 가 (importlib 동적 로드 실패 시) `None` 을 반환하는
    **호출 가능 리졸버 자체**를 돌려주던 구버전 설계의 잔재. 10R 에서 `_origin_default_branch`
    가 항상 존재하는 일반 함수로 바뀌면서 그 분기 조건은 무의미해졌는데, 코드는 `if True:` 로
    남아 아무것도 게이트하지 않는다. 동작에는 영향 없지만(단순 통과), 주석 없이 남으면 다음
    독자가 "디버그 토글을 지우다 만 것 아닌가" 의심할 자리다 — 이 라운드가 스스로 경계하는
    "설명 없이 남는 잔재" 클래스와 같은 결이다.
  - 제안: `if True:` 를 없애고 `try:` 를 바로 시작하거나, 남긴다면 "구 리졸버 설계의 잔재,
    조건 없음" 한 줄을 붙인다.

## 확인했으나 문제 없음 (반증)

- `.claude/_shared/git_probe.py` 모듈 docstring 의 "두 개 → 세 개 소비자", "열 개 → 열두 개
  미검증 사본" 수치(게이트 1, 22행)는 10R 커밋 diff 에서 **이번 라운드 자체가 고친 것**(커밋
  메시지 `[W8]`)이고, 직접 재계산해 맞음을 확인했다: `_run_git`/`_repo_root` 는 세 모듈(RG·PG·BG)
  모두, `_default_branch`/`_merge_base`/`_porcelain_path` 는 RG·PG 둘만 복제하고 있었으므로
  3+3+2+2+2=12. 신규 결함 아님.
  ```
  $ git show 88ce9994d:.claude/hooks/_lib/review_guard.py | grep -n '^def _'   # 8R 이후, 9R 이전
  $ git show 88ce9994d:.claude/hooks/_lib/plan_guard.py   | grep -n '^def _'
  $ git show 88ce9994d:.claude/hooks/_lib/branch_guard.py | grep -n '^def _'
  ```
- `plan/in-progress/harness-review-gate-ci-backstop.md` 의 §배선 가드 표는 이번 라운드가 8R·9R·
  10R 행을 정확히 추가했다(diff 로 확인, `[W9]` 서술과 일치). 배너 상단 "1R~6R" → "1R~10R" 로도
  갱신됨. 문제 없음.
- `.github/workflows/harness-checks.yml` 에 새로 추가된 `permissions: contents: read` 블록은
  바로 위에 이유("PR 이 공급한 파이썬 테스트를 실행하므로 읽기 권한만") 와 자매 워크플로 참조가
  붙어 있다. 문제 없음.
- `review_guard.py`/`plan_guard.py` 의 "These five git probes..." 위임 주석은 정확히 그 다섯
  함수(둘 다 쓰는)만 서술하고 `branch_guard` 를 "sibling guard" 라 부르지 않으므로(그 다섯 중
  `branch_guard` 는 둘만 쓴다), 세 모듈 체제로 바뀐 뒤에도 문면상 거짓이 되지 않는다. 오래된
  주석으로 잘못 걸 뻔했으나 재확인 결과 문제 없음.
- `test_review_gate_ci.py`(515~829행, 직접 Read 로 나머지 확인)는 이번 10R 커밋에서 손대지
  않았고(`git show 9a7b28764 --stat` 에 파일명 없음), README 의 해당 행 서술(Rounds 5-8 서사)과
  현재 파일 내용이 그대로 일치한다. 드리프트 없음.
- `.claude/tests/test_block_integrity.py` 도 이번 커밋 대상이 아니며(마지막 수정 `3f10ddfbe`),
  이번 라운드가 그 파일의 어떤 불변식도 건드리지 않았다.

## 요약

이번 라운드(10R 커밋 `9a7b28764`)의 실질 변경 — git 프로브 통합의 손-목록을 AST 도출로 뒤집고,
6번째로 빠졌던 `_current_branch`/`_origin_default_branch` 를 옮긴 것 — 은 코드·테스트·plan 배너
쪽에서는 서로 잘 맞물려 있고 새로 붙인 서술들도 실측(뮤테이션 111/849개 GREEN, AST 비교)에
근거해 정확하다. 다만 `.claude/tests/README.md` 는 9R 상태에서 멈춰 있어 `test_plan_guard.py`
행이 이미 삭제된 검증 방식(손 목록 + "로컬 def 부재" 체크)을 여전히 서술하고, `test_review_guard_
hardening.py` 행은 이번에 추가된 클래스를 아예 언급하지 않는다 — `test_tests_readme_catalog.py`
가 행의 **존재**만 지키고 **내용**은 안 지키는 사각지대가 실제로 발현한 사례다. 이 프로젝트가
`router_safety_policy_doc` 로 별도 학습한 "손-동기 문서는 드리프트한다" 는 교훈이 자기 자신의
테스트 카탈로그에도 적용돼야 함을 보여준다. 그 외엔 위임 줄 두 곳의 주석 비대칭과 `if True:`
잔재처럼 가벼운 INFO 만 남는다 — 판정 로직 자체에는 영향 없음.

## 위험도

LOW
