# 성능(Performance) Review

라운드 11 — `review-gate.yml` CI 백스톱 + `.claude/_shared/git_probe.py` 통합 + 세 훅
(`review_guard.py`/`plan_guard.py`/`branch_guard.py`)에 대한 성능 관점 리뷰.

리뷰 방법: 프롬프트에 실린 전체 파일 컨텍스트를 검토하고, 프롬프트 크기 제한으로 생략된
`review_guard.py`는 `Read`로 직접 열어 확인했다. 정적 판단에 그치지 않고, 성능 관련 주장은
전부 이 워크트리에서 직접 실행/측정했다(명령과 출력은 아래 각 항목에 남긴다). 작업 트리는
건드리지 않았다 — 실행한 것은 읽기 전용 측정(`evaluate_review()` 호출, `git remote show
origin` 타이밍, `find`/`git ls-files` 카운트, `actions/checkout` 유사 fetch 시뮬레이션은 별도
`mktemp -d` 임시 클론에서 수행)뿐이다.

## 발견사항

- **[WARNING]** `review_guard.py`의 리뷰 커버리지 판정이 `review/code/**`·`review/consistency/**`
  전체를 캐시 없이 매 호출마다 선형 스캔하며, 이번 PR로 그 스캔이 로컬 훅과 CI 양쪽에서 중복
  실행된다.
  - 위치: `.claude/hooks/_lib/review_guard.py:350`(`_iter_summaries`),
    `:367`(`_forced_coverage_missing`), `:405`(`_summary_is_resolved`),
    `:498`(`_newest_resolved_review_mtime`), `:680`(`_iter_consistency_summaries`),
    `:720`(`_newest_resolved_impl_done_mtime`), `:897`(`evaluate_review`)
  - 상세: `evaluate_review()`는 `codebase/` 변경이 하나라도 있으면 `os.walk`로
    `review/code/**` 전체를 훑어(현재 810개 `SUMMARY.md`) 세션마다 (1) SUMMARY.md 전문을
    읽고(`_summary_is_resolved`), (2) `_retry_state.json`을 열어 JSON 파싱하고
    (`_forced_coverage_missing`), (3) `RESOLUTION.md` 존재를 stat한다. spec-linked 변경이
    있으면 `review/consistency/**`(현재 738개)까지 같은 방식으로 전부 훑는다. 실측:
    ```
    $ find review/code -name SUMMARY.md | wc -l
    810
    $ find review/consistency -name SUMMARY.md | wc -l
    738
    $ git ls-files review/ | wc -l      # 15125
    $ git ls-files review/code | wc -l  # 9435
    ```
    `evaluate_review()`를 이 저장소에서 직접 타이밍(구현체 그대로 import 후 호출):
    ```
    _iter_summaries: 810 files in 0.0260s
    _dirty_set: 0.1053s
    _newest_resolved_review_mtime: 0.1081s -> ...
    _iter_consistency_summaries: 738 files in 0.0186s
    _newest_resolved_impl_done_mtime: 0.1403s -> ...
    evaluate_review TOTAL: 0.1028s
    ```
    현재는 무해한 수치이지만 구조적으로 세 가지가 겹친다: (a) 캐시·인덱스가 전혀 없어 매 push,
    매 Stop, 그리고 이번 PR이 추가하는 매 CI 실행마다 처음부터 다시 전체를 스캔한다. (b)
    `review/code`에는 `plan/complete/archive/` 같은 배출구가 없어 세션 수가 프로젝트 수명 내내
    단조 증가한다 — 이 브랜치 하나만 해도 이미 "11라운드"째다. (c) 이번 PR로 같은 커밋에 대해
    로컬 훅과 CI가 이 전체 스캔을 각각 독립적으로 반복한다(로컬 `git push` 시도마다 1회, PR에
    커밋이 push될 때마다 CI가 또 1회 — `concurrency: cancel-in-progress: true`라 재실행도
    처음부터 다시 돈다). 즉 O(누적 리뷰 세션 수)로 무한정 자라는 비용을 이제 두 실행 경로가
    중복 지불한다.
  - 제안: 세션 디렉터리가 이미 `<Y>/<m>/<d>/<H>_<M>_<S>`로 시분초까지 정렬 가능하게 이름
    붙어 있으므로, 연/월 단위 디렉터리 목록만 최신 N개월로 잘라 `os.walk` 범위를 줄이거나,
    "가장 최근 resolved 리뷰 시각"을 캐시 파일에 기억해 두고 그 이후 커밋된 세션만 증분
    스캔하는 방식을 검토. 최소한 `review/code`에도 오래된 세션을 감사 대상에서 빼는 아카이브
    규약을 두면 스캔 비용에 상한이 생긴다.

- **[WARNING]** `_origin_default_branch`의 네트워크 폴백(`git remote show origin`)이 자신이
  선언한 2초 타임아웃보다 실측상 더 오래 걸린다 — CI 경로에서 상시 유발될 가능성이 높다.
  - 위치: `.claude/_shared/git_probe.py:74`~`77`(Method 2, `timeout=2.0`, 주석: "keep the
    worst-case stall small"), `:106`~`129`(`_run_git`, `TimeoutExpired`를 삼켜 `rc=1`로
    죽이는 지점)
  - 상세: 이 저장소에서 `git remote show origin`을 3회 반복 실측하면 2.60s~2.68s(최초 1회는
    콜드 커넥션이라 3.7s)로, 코드가 명시한 `timeout=2.0`을 매번 초과한다.
    ```
    $ for i in 1 2 3; do /usr/bin/time -p git remote show origin >/dev/null; done
    real 2.62
    real 2.68
    real 2.60
    ```
    `_run_git`은 `subprocess.TimeoutExpired`를 잡아 `(1, "", "")`로 반환하므로
    (git_probe.py:128), 현재 타임아웃 값 그대로면 이 Method 2는 "느리지만 성공"이 아니라
    "정상 상황에서도 타임아웃으로 실패"하는 경로다 — "worst-case stall을 작게 유지한다"는
    주석 의도와 반대로, 흔한 케이스 자체가 그 상한을 넘는다.
    추가로, `actions/checkout` 계열이 실제로 쓰는 방식(`git clone`이 아니라
    `git init`+`remote add`+`fetch`)을 별도 임시 디렉터리에서 재현하면
    `refs/remotes/origin/HEAD` 심볼릭 참조가 아예 생성되지 않는다:
    ```
    $ git init -b main . && git remote add origin <url> \
      && git fetch --no-tags --prune --no-recurse-submodules origin \
           '+refs/heads/*:refs/remotes/origin/*'
    $ git symbolic-ref --short refs/remotes/origin/HEAD
    fatal: ref refs/remotes/origin/HEAD is not a symbolic ref   (rc=128)
    ```
    즉 Method 1(로컬 `symbolic-ref`)이 CI 러너에서 실패할 가능성이 높고, 그러면 세 훅
    (`review_guard`/`plan_guard`/`branch_guard`)이 공유하는 이 폴백이 `review-gate.yml`·
    `harness-checks.yml`의 매 실행마다 걸릴 텐데, 그 폴백 자신의 타임아웃이 실측 소요시간보다
    작게 잡혀 있다.
  - 참고(범위 구분): `Fetch base ref` 스텝이 `fetch-depth: 0` 위에서 실제로 필요한지 자체는
    이 티켓이 이미 "실제 Actions 러너 없이는 판정 불가"로 등재해 둔 별개의 열린 질문이라
    다시 CRITICAL로 제기하지 않는다. 여기서 새로 측정한 것은 그와 독립적인 사실 하나 —
    `timeout=2.0`이라는 상수가 그 함수 자신의 실측 소요시간보다 작다는 것 — 이며, 이는 CI
    여부와 무관하게(origin/HEAD가 없는 로컬 클론·미러 환경에서도) Method 2를 사실상 "실패하는
    폴백"으로 만든다는 점에서 성능/타임아웃 산정의 문제다.
  - 제안: 타임아웃을 실측치(≥3s) 이상으로 올리거나, `git ls-remote --symref origin HEAD`처럼
    더 가벼운 단일 네트워크 호출로 교체를 검토(대역폭·왕복 모두 `remote show`보다 저렴할
    가능성). CI 한정으로는 이미 알고 있는 `${{ github.event.repository.default_branch }}`를
    넘겨 이 폴백 자체를 건너뛰게 하는 것도 방법.

- **[INFO]** `review-gate.yml`이 트리거될 때마다 `fetch-depth: 0`으로 전체 히스토리를
  체크아웃한다(현재 `.git` 154MB, 커밋 2,401개).
  - 위치: `.github/workflows/review-gate.yml:55`~`57`
  - 상세: merge-base·freshness 판정에 전체 히스토리가 필요하다는 근거가 워크플로 주석
    ("게이트는 base 와의 merge-base 로... 둘 다 전체 히스토리가 필요하다")에 이미 명시돼
    있어 새로운 결함이 아니라 인지된 트레이드오프로 판단한다. CRITICAL/WARNING으로 올리지
    않되, 저장소가 계속 자라면 이 체크아웃 자체가 게이트 실행 시간의 지배적 비용이 될 수
    있다는 점만 기록해 둔다.

## 그 외 확인했지만 문제로 보지 않은 지점 (근거)

- `_newest_commit_time`(review_guard.py:249)은 파일 수와 무관하게 `git log` 호출을 1회로
  묶어(N+1 방지) 처리한다 — 이미 잘 설계됨.
- `_dirty_set`(review_guard.py:236)으로 `git status`를 Gate 1/Gate 2 사이에서 1회만 호출해
  재사용한다 — 이미 최적화됨.
- `_shared/block_integrity.py`의 정규식(`_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END`)은 과거
  라운드에서 실측된 이차(quadratic) 백트래킹 결함을 이미 벤치마크로 확인하고 선형 패턴으로
  고쳐 둔 상태다(모듈 내 주석에 `n=1000~16000` 배율 실측 표가 남아 있음) — 재확인만 하고
  새 지적 없음.
- `_glob_to_regex`(review_guard.py:542)의 와일드카드 상한(`_MAX_GLOB_WILDCARDS=6`)도 이미
  실측 벤치마크(`k=8~16` 표)로 근거가 남아 있고 안전한 방향(상한 초과 시 "전체 매치"로
  fail-open)으로 처리돼 있음 — 새 지적 없음.
- `plan_guard._linked_plans`/`_all_checkboxes_done`은 `plan/in-progress/*.md`만 훑는데, 이
  디렉터리는 본질적으로 작고(진행 중 작업만) 완료되면 `plan/complete/`로 옮겨지므로 위
  `review/code` 케이스와 달리 무한정 자라지 않는다 — 지적하지 않음.
- `.claude/tests/test_review_gate_ci.py`의 서브프로세스 다중 스폰(예: `VerdictComesFromTheGateTest`
  가 8회 서브프로세스 실행)은 CI 테스트 스위트 실행 시간에 수 초를 더하지만, 5분 타임아웃
  대비 무시할 수준이고 판정 로직 자체가 아니라 테스트 하네스이므로 WARNING으로 올리지 않음.

## 요약

이번 라운드는 판정 로직의 정확성보다 실행 비용 측면에서 두 가지 실측 가능한 이슈를 남긴다.
첫째, `review_guard.py`의 리뷰 커버리지 판정이 `review/code`·`review/consistency` 전체를
캐시 없이 선형 스캔하는 구조라 프로젝트가 커질수록, 그리고 이번 PR로 로컬 훅과 CI가 같은
스캔을 중복 수행하게 되면서 누적 비용이 계속 늘어난다(현재는 실측 0.1~0.25초로 무해).
둘째, 세 훅이 공유하는 `git_probe.py`의 origin 기본 브랜치 네트워크 폴백
(`git remote show origin`)이 자신의 2초 타임아웃보다 실측상(2.6~2.7초, 최초 콜드 커넥션은
3.7초) 더 오래 걸려 사실상 상시 타임아웃-실패하는 경로이며, `actions/checkout` 방식
체크아웃에서는 `origin/HEAD` 심볼릭 참조가 애초에 생기지 않아 CI에서 이 경로를 특히 자주
탈 것으로 보인다. 둘 다 지금 당장 게이트를 무너뜨리는 결함은 아니다 — fail-open 설계 덕분에
어느 쪽이든 판정 자체는 계속 답을 낸다(성능이 떨어지거나, 최악의 경우 조용히 다음 폴백으로
넘어갈 뿐 예외를 던지지 않는다). 다만 실측 근거가 뚜렷한 개선 여지이고, 특히 두 번째 항목은
이번 PR이 이 경로를 CI라는 "origin/HEAD가 없을 가능성이 높은 환경"에 처음으로 정기적으로
노출시킨다는 점에서 이번 변경과 직접 관련이 있다. 나머지 코드(배치 `git log` 호출, 단일
`git status` 재사용, `block_integrity.py`의 이미 벤치마크된 선형 정규식, `_glob_to_regex`의
실측 상한)는 이미 세심하게 성능을 다뤄 온 흔적이 뚜렷하며 추가 지적 사항이 없다.

## 위험도

LOW
