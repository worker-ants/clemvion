# 성능(Performance) 리뷰

리뷰 대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tools/reap-merged-worktrees.sh`,
`.claude/tools/bootstrap-session.sh`, `.claude/tests/test_push_detection.py`,
`.claude/tests/test_reap_merged_worktrees.py`, `.claude/docs/worktree-policy.md`,
`plan/in-progress/harness-session-anchor-guards.md`

## 발견사항

- **[WARNING]** SessionStart 경로에서 `gh pr view` 를 워크트리/브랜치마다 순차 호출(N+1 네트워크 I/O), 스로틀 해제 시점에 부팅을 블로킹할 수 있음
  - 위치: `.claude/tools/reap-merged-worktrees.sh` `gh_state()`(L125-130), pass 1 루프의 호출부(L214), pass 2 루프의 호출부(L245, L256). 호출 체인: `.claude/tools/bootstrap-session.sh` L74 `bash "$reaper" ... || true` (동기 호출, 백그라운드 아님).
  - 상세: pass 1(워크트리)·pass 2(dangling branch) 모두 로컬에서 값싼 선-체크(더티 여부 `git status --porcelain`, ancestor 여부 `git branch -d`/`is_ancestor`)를 먼저 통과한 후보에 한해 `gh pr view <branch> --json state --jq .state` 를 호출한다 — 이는 실제 GitHub API 네트워크 왕복이며, `while read` 루프 안에서 완전히 순차적이다(병렬화·배치 없음). `REAP_MIN_INTERVAL`(기본 6h) 스로틀 덕분에 매 세션마다 발생하진 않지만, 스로틀 창이 만료된 세션에서 정리 대상 워크트리/브랜치가 여러 개 쌓여 있으면 그 세션의 `bootstrap-session.sh`(SessionStart, 동기 실행)가 N번의 순차 네트워크 호출만큼 블로킹된다 — 예: 후보 10개 × 호출당 300~800ms 가정 시 수 초 지연. `# Always exits 0 — a SessionStart helper must never block a session` 주석은 "실패하지 않는다"는 뜻이지 "빠르다"는 뜻이 아니므로 이 지연은 계약 위반은 아니지만 체감 지연으로 나타난다.
  - 제안: (a) 배치화 — `gh pr view` 를 후보마다 호출하는 대신, 한 번의 `gh pr list --state all --json headRefName,state --limit <N>` (또는 GraphQL 다중 ref 조회)로 branch→state 맵을 미리 구성해 pass 1/2 양쪽에서 재사용. gh CLI 제약으로 배치가 어렵다면 (b) 후보별 `gh pr view` 호출을 백그라운드로 fan-out 하고 `wait` 로 동시성 상한을 두어(예: `xargs -P4`) 총 대기 시간을 "합"이 아닌 "최댓값" 수준으로 낮추는 것을 고려. 실사용 워크트리 수가 적어 시급도는 낮지만, 스로틀이 풀리는 세션에서 사용자 체감 지연으로 나타나는 특성이라 기록해 둘 가치가 있음.

- **[INFO]** `_is_git_push` 가 이제 모든 Bash 호출을 토큰화 — 근거가 코드 주석에 실측치와 함께 명시돼 있고, 본 리뷰에서도 알고리즘 복잡도를 재검증해 통과
  - 위치: `.claude/hooks/guard_review_before_push.py` L190-227 (`_is_git_push`), L57-59 (`_GIT_PUSH_FALLBACK`), `.claude/settings.json` L39 `"matcher": "Bash"` — 이 훅은 push 뿐 아니라 **모든** Bash 툴 호출마다 실행된다(같은 matcher 아래 `guard_default_branch_bash.py`, `normalize_worktree_branch.py` 와 나란히).
  - 상세: 이번 재작성에서 "raw substring 사전 필터"(Critical #2 로 불건전 판정돼 제거됨)를 없애 매 Bash 호출마다 `shlex` 토큰화를 수행하게 됐다. docstring 이 `timeit` 실측치(대표 명령 6~24us vs python3 프로세스 기동 ~13ms, 3자릿수 차이)로 이 트레이드오프를 정당화하고 있다. 본 리뷰에서 독립적으로 재검증: `_tokenize`/`_git_subcommand` 는 명령 길이에 대해 O(n)(각 토큰이 최대 한 세그먼트에만 속하고, `segment[i+1:]` 슬라이스+스캔은 세그먼트당 최대 1회만 발생), 폴백 정규식(`_GIT_PUSH_FALLBACK`)도 패턴 형태상 catastrophic backtracking 이 우려됐으나 크래프트한 병리적 입력(`"A=1 " * n`, `"a=a=a=...=" * n` 등, n=50~800)으로 실측한 결과 선형(n 2배 → 시간 2배 내외)으로 스케일함을 확인 — 지수 폭발 없음.
  - 제안: 조치 불필요. 이미 측정 기반으로 판단된 트레이드오프이며 본 리뷰의 재검증도 이를 뒷받침한다.

- **[INFO]** 무거운 게이트(`evaluate_review`/`evaluate_plan`)는 실제 push 시도에만 게이팅 — 매 Bash 호출로 증폭되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py` L296-329 `main()` — `if not _is_git_push(command): return 0` 이후에만 두 게이트 호출.
  - 상세: `_is_git_push` 로 실제 push 로 판정된 경우에만 `evaluate_review()`/`evaluate_plan()` 이 실행된다. 두 함수 내부(`_lib/review_guard.py`, `_lib/plan_guard.py`)는 이번 리뷰 대상 파일 목록에 포함돼 있지 않아 내부 비용은 확인 범위 밖이지만, 최소한 "매 Bash 호출마다 무거운 게이트가 재실행"되는 N+1 패턴은 이 파일 수준에서는 없다.
  - 제안: 조치 불필요.

- **[INFO]** `bootstrap-session.sh` 는 반복 실행에 대해 적절히 idempotent — 무거운 작업을 조건부로 스킵
  - 위치: `.claude/tools/bootstrap-session.sh` L24-31(githooks 설정, 값이 다를 때만 재기록), L33-42(`node_modules` 존재 시 `npm install` 스킵), L44-53(`find -mtime +30 -delete` 로 상태 마커 GC, 두 개 고정 디렉터리로 범위 제한).
  - 상세: SessionStart 마다 실행되는 스크립트로서 "이미 끝난 작업은 재수행하지 않는다"는 원칙이 코드 전반에 일관되게 적용돼 있다(config 값 비교 후 조건부 쓰기, 디렉터리 존재 여부로 설치 스킵). 위 WARNING 항목(reap 스로틀 만료 시 지연)을 제외하면 이 스크립트 자체의 반복 비용은 낮게 유지된다.
  - 제안: 조치 불필요.

- **[INFO]** 자료구조 선택이 용도에 적절함(집합 멤버십 테스트에 `frozenset` 사용)
  - 위치: `.claude/hooks/guard_review_before_push.py` L68-71 `_GIT_OPTS_WITH_VALUE`, L84 `_SEGMENT_SEPARATOR_CHARS`.
  - 상세: 옵션 화이트리스트(`token in _GIT_OPTS_WITH_VALUE`)와 구분자 문자 집합(`ch in _SEGMENT_SEPARATOR_CHARS`) 모두 리스트/튜플이 아닌 `frozenset` 으로 O(1) 평균 멤버십 테스트를 사용한다. 두 집합 모두 크기가 작아(9개, 9자) 실측 차이는 미미하지만 관용적으로 올바른 선택이다.
  - 제안: 조치 불필요.

- **[INFO]** `test_reap_merged_worktrees.py` 는 테스트당 실제 git 저장소+워크트리를 생성하는 통합 테스트 스타일 — 실행 시간은 subprocess/git 비용에 비례
  - 위치: `.claude/tests/test_reap_merged_worktrees.py` `setUp()`(L985-1006), 14개 이상의 테스트 메서드가 각각 `_add_worktree`/`_add_branch_*` 로 실 git 프로세스를 다수 spawn.
  - 상세: 단위 테스트가 아닌 통합 테스트로 설계된 것이 의도적이다(bash 3.2 파싱 버그, 실제 파일시스템 대소문자 처리, `--keep` 다회 지정 등은 순수 목업으로는 못 잡는 종류의 결함). subprocess 기반이라 순수 Python 단위 테스트 대비 벽시계 시간이 크지만, 이는 정확성-우선의 합리적 트레이드오프이며 운영 코드의 성능과는 무관하다.
  - 제안: 조치 불필요(정보 제공 목적).

## 요약

리뷰 대상은 프로덕션 서비스가 아니라 Claude harness 의 git 훅/부트스트랩 도구 모음으로, 전반적으로 성능을 의식한 설계가 잘 반영돼 있다 — 특히 `guard_review_before_push.py` 는 substring 사전 필터 제거의 성능 영향을 `timeit` 실측치로 코드 주석에 남겼고, 본 리뷰에서 알고리즘 복잡도(선형, catastrophic backtracking 없음)를 독립 재검증해 그 판단이 타당함을 확인했다. `reap-merged-worktrees.sh` 도 값싼 로컬 체크(dirty·ancestor)를 비싼 `gh` 네트워크 호출보다 먼저 평가하는 lazy 패턴과 세션당 스로틀(6h)을 이미 갖추고 있어 N+1 외부 API 호출의 평균적 영향은 잘 억제돼 있다. 다만 그 스로틀이 만료되는 세션에서는 워크트리/브랜치 후보 수에 비례해 `gh pr view` 를 순차·동기 호출하므로 SessionStart 가 수 초 블로킹될 수 있는 잔여 리스크가 있다(WARNING 1건) — 배치 조회 또는 동시성 상한을 둔 병렬화로 개선 여지가 있으나, 실사용 워크트리 규모가 작다는 점을 감안하면 시급성은 낮다. 그 외 메모리 할당, 캐싱, 자료구조, 지연 로딩 관점에서 새로 도입된 문제는 발견되지 않았다.

## 위험도

LOW
