# 유지보수성(Maintainability) 리뷰

리뷰 대상: `.claude/tools/bootstrap-session.sh`, `.claude/tests/test_bootstrap_mermaid_install.py`, `.githooks/pre-commit`, `.claude/tests/README.md`
(diff base: `origin/main`, 관련 SoT 파일 `.claude/hooks/_lib/mermaid_lint_ready.py` / `.claude/hooks/lint_mermaid_posttooluse.py` 는 교차확인용으로 참고)

## 발견사항

- **[WARNING]** mtime 기반 쿨다운 헬퍼가 `reap-merged-worktrees.sh`와 중복 구현되고 이름도 갈린다
  - 위치: `.claude/tools/bootstrap-session.sh:78` (`_file_mtime`), `:81-85` (`_install_throttled`) vs `.claude/tools/reap-merged-worktrees.sh:113` (`file_mtime`), `:111-122` (throttle 블록)
  - 상세: `stat -f %m … || stat -c %Y … || echo 0` 이식성 관용구와 "marker 파일 mtime 을 지금 시각과 비교해 쿨다운 윈도 안이면 skip" 이라는 로직이 두 스크립트에 문자 그대로 재구현되어 있다. 두 파일은 같은 `.claude/tools/` 디렉터리에 있고 `bootstrap-session.sh` 가 `reap-merged-worktrees.sh` 를 직접 호출하는 밀접한 관계인데도 공유 lib이 없다. 게다가 헬퍼 이름이 `_file_mtime`(언더스코어 프리픽스) vs `file_mtime`(프리픽스 없음)으로 갈려, 두 구현이 독립적으로 작성됐음을 보여준다. 같은 PR 이 Python 쪽에서는 정확히 이 문제(3곳이 readiness 판정을 각자 구현하던 것)를 `_lib/mermaid_lint_ready.py` 라는 단일 SoT 로 추출해서 해결했는데, bash 쪽 동일 패턴엔 같은 처방이 적용되지 않았다.
  - 제안: 낮은 우선순위. `.claude/tools/_lib/` 같은 공유 스니펫(source 가능한 `.sh`)으로 mtime/쿨다운 판정을 추출하거나, 최소한 헬퍼명을 하나의 컨벤션(언더스코어 유무)으로 통일. 로직이 안정적이고 짧아 당장 버그 위험은 낮지만, 향후 이식성 수정(예: 새 OS의 `stat` 변형 대응)이 필요해지면 두 곳을 함께 고쳐야 한다는 사실을 놓치기 쉽다.

- **[INFO]** 신규 테스트 2개의 `_harness` import 주석이 스위트 전반의 확립된 컨벤션을 생략
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:34` (`import _harness  # noqa: F401`)
  - 상세: 기존 테스트 파일 대부분(`test_reap_merged_worktrees.py`, `test_review_guard.py`, `test_branch_guard.py` 등 8개)은 `# noqa: F401  — side effect: puts .claude/hooks on sys.path` 형태로 왜 이 import 가 "미사용처럼 보이지만 의도적인지"를 명시한다. 이 파일은 트레일링 설명 없이 `# noqa: F401` 만 남겼다. 더 정확히는, 이 파일은 34번 줄 바로 아래(36번 줄)에서 `_harness.REPO_ROOT` 를 실제로 참조하므로 "미사용 import" 프레이밍 자체가 이 파일엔 안 맞는다 — 정확히 동일한 케이스(모듈 스코프에서 `_harness.REPO_ROOT` 직접 참조)를 다루는 `test_run_test_watchdog.py:30`은 `# noqa: F401  — side effect: harness path setup / REPO_ROOT` 로 이를 정확히 반영해뒀다. (같은 diff 의 `test_mermaid_lint_ready.py:26` 도 동일하게 트레일링 설명이 빠져 있다.)
  - 제안: 기존 컨벤션에 맞춰 트레일링 설명 추가 — 예: `# noqa: F401  — side effect: puts .claude/hooks on sys.path; REPO_ROOT used below`.

- **[INFO]** git-fixture 보일러플레이트(`setUp`/`_git`/`_write`)가 테스트 파일 간 반복
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:51-91` vs `.claude/tests/test_reap_merged_worktrees.py:51-84`
  - 상세: "throwaway git repo 초기화 + `_git`/`_write` 헬퍼" 보일러플레이트가 두 파일 사이에서 거의 동일하게(변수명까지) 반복된다. README 서술에 따르면 `test_review_guard_hardening.py` 도 유사하게 "real temp git repo" 를 만든다. `_harness.py` 는 경로 해석/모듈 로더만 제공하고 공유 git-fixture 헬퍼는 없다.
  - 제안: 강제 사항 아님 — 테스트 파일이 서로 독립적으로 읽히도록 하는 것도 합리적 선택(DAMP > DRY for tests)이라 현재 상태가 나쁘다고 보긴 어렵다. 다만 반복 지점이 3곳을 넘어가면 `_harness.py`에 공유 `GitFixtureMixin`(또는 함수)을 두는 걸 고려할 만하다.

- **[INFO]** 쿨다운 리터럴 `1800`(과 `2000`)이 여러 테스트 메서드에 하드코딩
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:186,188,194,197` (`retry_after=1800`), `:195` (`time.time() - 2000`)
  - 상세: `retry_after=1800` 이 두 테스트 메서드에 걸쳐 4번 반복되고, 이 값이 프로덕션 기본값(`MERMAID_INSTALL_RETRY_SEC:-1800`, `bootstrap-session.sh:76`)과 우연히 일치한다는 사실이 코드만 봐서는 명시적으로 드러나지 않는다. `2000`은 "쿨다운 윈도보다 크게" 라는 인라인 주석이 있어 상대적으로 안전하다.
  - 제안: 선택적으로 `_DEFAULT_RETRY_AFTER = 1800` 모듈 상수를 두면 "이 테스트 값이 프로덕션 기본값을 미러링한다"는 의도가 명시적이 되고, 향후 프로덕션 기본값이 바뀔 때 grep 으로 한 곳만 갱신하면 된다는 이점이 생긴다. 리스크는 낮음.

- **[INFO]** 4-way `&&` 체인 install 가드에 이름 붙은 술어가 빠짐
  - 위치: `.claude/tools/bootstrap-session.sh:87-88`
  - 상세: `if [ -f "$tool_dir/package.json" ] && [ ! -f "$marker" ] && ! _install_throttled && command -v npm >/dev/null 2>&1; then` — 4개 조건이 한 줄(개행 포함)에 나열된다. 바로 위에서 `_install_throttled` 라는 이름 붙은 술어 함수를 이미 뽑아둔 것과 비교하면, "설치가 필요한가"라는 전체 판단도 같은 방식으로 `_mermaid_install_needed`류 함수로 뽑았으면 대칭성이 있었을 것이다. 다만 각 조건 위에 이미 상세한 설계 주석(34-72번 줄)이 있어 가독성 저해는 크지 않다.
  - 제안: 선택적 — 조건이 더 늘어날 계획이 없다면 현행 유지도 무방.

## 요약

변경분은 작고 지역적이며(핵심 로직은 `bootstrap-session.sh` 의 ~20줄 실행 코드 + 신규 테스트 파일 1개 + `pre-commit` 의 readiness 판정 한 줄 교체), 순환 복잡도·중첩 깊이·함수 길이 모두 낮게 유지된다. 특히 이전 라운드(review/code/2026/07/18/02_06_42 C1)에서 실증된 TOCTOU 회귀를 락 제거로 되돌리면서, "왜 락을 다시 넣지 않았는가"를 코드 옆에 상세히 남긴 설계 주석은 유지보수성 관점에서 강점이다 — 다음에 락을 재도입하려는 사람이 같은 실수를 반복하지 않도록 막는다. 매직 넘버(`1800`초 쿨다운)에도 인라인 근거가 붙어 있고, 신규 테스트 네이밍(`test_installs_once_and_writes_completion_marker` 등)은 행동 기반으로 명확하다. 아쉬운 점은 bash 쪽에서 `reap-merged-worktrees.sh` 와 거의 동일한 mtime/쿨다운 헬퍼를 다시 구현한 것(WARNING 1건) — 같은 PR 이 Python 쪽에서는 정확히 이 유형의 중복을 `mermaid_lint_ready.py` SoT 로 해소했기 때문에 더 눈에 띈다. 나머지는 테스트 스위트의 기존 컨벤션(`_harness` noqa 주석 문구, git-fixture 보일러플레이트)과의 미세한 편차 수준으로 모두 INFO 등급이며 당장 고칠 필요는 없다.

## 위험도

LOW
