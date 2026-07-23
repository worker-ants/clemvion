# 성능(Performance) 리뷰 — reaper gh N+1 배치화

## 발견사항

- **[INFO]** 배치 결과 조회가 문자열 선형 스캔(O(n·m)) — 실사용 규모에서는 무해
  - 위치: `.claude/tools/reap-merged-worktrees.sh` `gh_state()` (647행 부근, `hit=$(printf '%s\n' "$_pr_states" | awk -F'\t' -v b="$branch" '$1==b{print $2; exit}')`)
  - 상세: bash 3.2(macOS 기본)에 연관 배열이 없어 `branch<TAB>state` 개행 문자열을 후보 branch 마다 `printf | awk` 로 선형 탐색한다. 후보 수를 n, `--limit`(기본 200)을 m 이라 하면 O(n·m), 게다가 각 조회마다 파이프(서브셸 1 + awk 프로세스 1)를 새로 fork 한다. `awk` 는 `exit` 로 첫 매치에서 종료해 최악의 경우만 전체 스캔한다.
  - 제안: 현재 규모(세션당 후보 수십 개, PR 최대 200줄)에서는 fork 비용(수 ms)이 이 diff 가 제거하려는 네트워크 왕복(수백 ms~수 초)에 비해 무시할 수준이라 실질적 병목이 아니다. 코드 주석이 이미 "bash 3.2 호환을 위한 의도적 트레이드오프"임을 명시하고 있어 현재로선 수정 불필요 — 향후 후보 수가 수백 단위로 커지면 `awk` 한 번으로 전체 매칭을 처리하는 방식(예: `awk` 에 후보 목록을 통째로 넘겨 한 번에 매칭)으로 재검토 가능.

- **[INFO]** `--limit` 윈도우 밖 PR 은 여전히 기존 N+1 폴백 경로로 되돌아감
  - 위치: `.claude/tools/reap-merged-worktrees.sh` `gh_state()` 652~655행, `REAP_GH_PR_LIMIT`(기본 200)
  - 상세: 배치가 커버하는 것은 최신 200개 PR 뿐이라, PR 이력이 매우 많은 저장소에서 오래된 브랜치(worktree)가 다수 남아 있으면 그만큼 `gh pr view` 단건 호출이 재발해 이 PR 이 없애려는 SessionStart 블로킹이 부분적으로 재현될 수 있다. 다만 이는 "판정 범위를 조용히 좁히지 않는다"는 정확성 우선순위 하의 의도된 설계이며, 코드 주석·plan(`plan/in-progress/harness-guard-followups.md` §B)에 명시돼 있다.
  - 제안: 현재 기본값(200)은 이 저장소의 실사용 패턴(수십 개 이내 stale worktree)에서 충분해 보인다. 별도 조치 불필요 — 다만 향후 `REAP_GH_PR_LIMIT` 를 늘려야 하는 상황이 반복되면 `gh pr list` 응답 페이로드 크기와 폴백 발생 빈도를 함께 모니터링할 필요가 있다.

- **[INFO]** 배치가 필요 이상으로 넓은 데이터(최대 200개 전체 PR)를 가져옴
  - 위치: `.claude/tools/reap-merged-worktrees.sh` `_load_pr_states()` (637~639행), `"$GH" pr list --state all --limit "$GH_PR_LIMIT" --json headRefName,state`
  - 상세: `gh pr list` 는 브랜치명 glob 필터를 지원하지 않아 `claude/*` 브랜치 외의 PR 도 함께 딸려온다. 다만 응답 필드를 `headRefName,state` 두 개로만 제한(`--json`)해 페이로드는 이미 최소화돼 있고, 왕복 횟수를 N→1로 줄이는 효과가 이 오버페치 비용을 압도한다. 문제 없음, 참고 목적으로만 기록.

## 알고리즘/N+1 관점 종합 평가

이 diff 의 핵심은 정확히 "N+1 쿼리 제거" 자체다:

- **Before**: 후보(worktree/dangling branch) 하나당 `gh pr view` 네트워크 왕복 1회 — `bootstrap-session.sh` 가 SessionStart 에 **동기** 실행하므로 stale worktree 가 쌓이면 세션 시작이 수 초 블로킹.
- **After**: `_load_pr_states()` 로 `gh pr list` 단 1회(배치) 호출 후 메인 셸 변수(`_pr_states`)에 저장, 이후 모든 `gh_state()` 호출은 그 변수를 로컬 스캔(네트워크 없음)한다. 미스(배치 윈도우 밖 PR) 시에만 개별 `gh pr view` 로 폴백.
- **서브셸 메모이제이션 함정을 정확히 인지하고 회피**: 호출부가 전부 `state=$(gh_state …)` (command substitution → 서브셸)이므로, 지연 로드를 `gh_state()` 내부에 두면 메모가 서브셸 종료와 함께 버려져 후보마다 재조회되어 배치 효과가 무효화된다. 코드는 이를 주석으로 명시하고 메인 셸에서 선-로드(`[ -n "$claude_branches" ] && _load_pr_states`)하는 방식으로 올바르게 회피했다. bash 서브셸이 변수를 상속(읽기 전용 관점에서)한다는 성질을 정확히 활용한 설계.
- **지연 로딩(Lazy Loading) 적용**: `claude/*` 브랜치가 하나도 없으면 배치 호출 자체를 skip(`_load_pr_states` 미호출) — 후보가 없는 fresh checkout 은 gh 호출 비용 0. 테스트 `test_no_gh_calls_when_there_are_no_candidates` 로 회귀 방지.
- **두 pass 간 공유(캐싱)**: pass 1(worktree)과 pass 2(dangling branch)가 `_pr_states` 를 공유해 배치를 1회만 호출(`test_batch_is_fetched_once_across_both_passes`). 또한 `claude_branches` (for-each-ref 결과)도 hoist 해 pass 2 에서 재실행하지 않도록 했다 — 부수적으로 또 하나의 중복 git 호출 제거.
- **실패 시 성능-정확성 트레이드오프가 명확**: `gh pr list` 실패(무인증/API 오류) 시 `_pr_states` 는 빈 문자열로 유지되고 모든 조회가 기존 per-branch 폴백으로 자연스럽게 떨어진다(`test_batch_failure_falls_back_to_pr_view`) — 성능 저하는 있어도 정확성(merge 판정)은 훼손되지 않는다. 이는 이 스크립트의 fail-safe 원칙과 일관된 설계.
- **메모리**: 문자열 크기는 최대 200줄 × (브랜치명 + state) 수준으로 무시할 만한 크기이며, 스크립트 종료와 함께 해제된다. 메모리 누수 여지 없음.

테스트 파일(`test_reap_merged_worktrees.py`)의 신규 5건은 호출 횟수를 `GH_CALL_LOG` 로 정확히 카운트해 "배치 1회 + `pr view` 0회", "두 pass 공유", "폴백 유지", "배치 실패 시 폴백", "후보 0개 시 미호출"을 모두 회귀 테스트로 고정하고 있어, 이번 성능 개선이 향후 되돌려지는 것을 방지하는 구조로 잘 설계됐다.

## 요약

이 변경은 순수하게 성능 개선을 목적으로 하며(SessionStart 동기 실행 경로에서 N개의 순차 네트워크 왕복을 1개의 배치 호출로 축소), 그 구현이 bash 서브셸 메모이제이션 함정을 정확히 인지하고 회피했고, 폴백·실패 경로에서도 기존의 정확성(fail-safe) 보장을 그대로 유지한다. 지연 로딩(후보 0개 시 skip)과 두 pass 간 fetch 공유까지 적용돼 있어 부가적인 낭비도 없다. 남은 것은 bash 3.2 제약에서 기인하는 O(n·m) 선형 스캔과 `--limit` 윈도우 밖 PR 의 폴백 재발 가능성 정도이며, 둘 다 현재 규모에서는 실질적 병목이 아니고 코드/plan 문서에 트레이드오프로 명시돼 있다. 성능 관점에서 이 diff 자체가 개선이며 새로운 리스크를 도입하지 않는다.

## 위험도

NONE
