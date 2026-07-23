# 테스트(Testing) 리뷰 — reap-merged-worktrees.sh gh 배치화

## 검증 방법
- `.claude/tests/test_reap_merged_worktrees.py` 전체 23건 실행 → 전부 PASS 확인.
- 비-vacuity 실측: `_load_pr_states`를 no-op으로 만드는 뮤턴트(배치를 되돌려 매번
  `pr view`만 호출하도록)를 적용 후 재실행 → `test_batches_state_lookups_instead_of_one_view_per_branch`,
  `test_batch_is_fetched_once_across_both_passes` 둘 다 기대대로 FAIL(둘 다 `pr list` 호출 0회,
  `pr view`가 후보 수만큼 호출됨을 진단 메시지로 확인). plan 문서(`plan/in-progress/harness-guard-followups.md`)의
  "비-vacuity: 배치를 되돌린 뮤턴트에서 두 테스트 모두 실패 확인" 주장을 재현·검증함. 이후
  백업본으로 원복, `git diff` clean 확인.

## 발견사항

- **[WARNING]** `GH_CALL_LOG`가 `gh` 호출의 첫 3개 위치 인자만 기록해 `--limit` 값이 구조적으로 검증 불가
  - 위치: `.claude/tests/test_reap_merged_worktrees.py` `_GH_STUB` 내 `echo "${1:-} ${2:-} ${3:-}"` (라인 44 부근) / `.claude/tools/reap-merged-worktrees.sh` `_load_pr_states`의 `"$GH" pr list --state all --limit "$GH_PR_LIMIT" …` 호출
  - 상세: 실제 호출은 `pr list --state all --limit <N> --json … --jq …` 순서라 `$1 $2 $3` = `pr list --state`이고, `--limit`과 그 값(`$GH_PR_LIMIT`)은 4~6번째 토큰이라 로그에 전혀 남지 않는다. 따라서 `REAP_GH_PR_LIMIT`(신규 env, 이번 diff에서 추가)가 실제로 `gh pr list --limit`에 올바르게 전달되는지 — 예컨대 향후 리팩터가 이 인자를 누락시키거나 잘못된 위치로 옮겨도 — 어떤 테스트도 잡을 수 없다.
  - 제안: 스텁 로그를 `"$@"` 전체(혹은 최소 `--limit` 다음 토큰까지)로 확장하고, `REAP_GH_PR_LIMIT=7` 같은 값을 설정해 로그에서 `--limit 7`이 실제로 나타나는지 단언하는 테스트 1건 추가.

- **[WARNING]** 신규 `GH_PR_LIMIT` bad-value 가드가 테스트 커버리지 0
  - 위치: `.claude/tools/reap-merged-worktrees.sh` `GH_PR_LIMIT="${REAP_GH_PR_LIMIT:-200}"` / `case "$GH_PR_LIMIT" in ''|*[!0-9]*|0) GH_PR_LIMIT=200 ;; esac`
  - 상세: 이 가드는 이번 diff에서 신규 도입됐다(기존 `MIN_INTERVAL` 가드를 본떠 작성). 그러나 `.claude/tests/test_reap_merged_worktrees.py` 전체에서 `REAP_GH_PR_LIMIT`/`GH_PR_LIMIT`을 참조하는 코드가 전무하다(`grep` 0건) — 비정수·`0`·빈 문자열 입력이 실제로 기본값 200으로 폴백하는지, 유효한 정수가 그대로 통과하는지 어느 것도 실행 기반으로 검증되지 않는다. 위 WARNING(로그가 `--limit` 값을 안 남김)과 결합하면, 이 가드를 깨뜨리는 리그레션(예: `case` 패턴에서 `0` 케이스 누락)이 통과할 수 있다.
  - 제안: `REAP_GH_PR_LIMIT=abc`(비정수) / `REAP_GH_PR_LIMIT=0` 케이스에서 배치 호출이 실패하지 않고(exit 0) 정상 동작함을 최소한 회귀 확인하는 테스트. 로그 확장과 짝지으면 `--limit 200`으로 폴백됐는지까지 직접 단언 가능.

- **[INFO]** 배치 응답이 MERGED 상태만 모델링 — OPEN/CLOSED을 배치가 "직접 반환"하는 경로는 미검증
  - 위치: `.claude/tests/test_reap_merged_worktrees.py` `_GH_STUB`의 `pr list` 분기(`for b in ${MERGED_BRANCHES:-}; do … printf '%s\tMERGED\n' "$b"; done`)
  - 상세: 실제 `gh pr list --state all`은 MERGED뿐 아니라 OPEN/CLOSED PR도 한 번에 응답 배열에 포함시킨다. 그러나 스텁은 `MERGED_BRANCHES`에 있는 항목만 배치 출력에 넣고, 그 외 브랜치는 배치에서 아예 누락시켜(`BATCH_OMIT`과 동일한 모양) `pr view` 폴백을 유도한다. 즉 "배치가 어떤 브랜치에 대해 OPEN/CLOSED을 직접 응답해서 `gh_state`가 그 값을 그대로 반환하고 `pr view`로 폴백하지 않는" 경로(`reap-merged-worktrees.sh`의 `if [ -n "$hit" ]; then echo "$hit"; return; fi`가 `hit=OPEN`/`CLOSED`인 케이스)는 테스트에서 한 번도 실행되지 않는다. 로직 자체가 상태값에 무관하게 동작해(문자열 그대로 반환) 실질 위험은 낮지만, `--state all`을 쓰는 실제 API 응답 모양과 스텁이 구조적으로 어긋난다는 점에서 Mock 충실도 갭이다.
  - 제안: 스텁에 `BATCH_STATES`류 env(예: `"branch1:OPEN branch2:CLOSED"`)를 추가해 배치가 비-MERGED 상태를 직접 반환하는 케이스, 그리고 그 경우 `pr view`가 호출되지 않음(`assertEqual(self._gh_calls("pr view"), [])`)을 검증하는 테스트 1건.

- **[INFO]** 배치 hit과 배치 miss가 같은 실행에 혼재하는 케이스 미검증
  - 위치: `.claude/tests/test_reap_merged_worktrees.py::test_falls_back_to_pr_view_when_branch_missing_from_batch`
  - 상세: 이 테스트는 후보가 1개(`wt-old`, `BATCH_OMIT`으로 배치에서 누락)뿐이라, "일부 브랜치는 배치가 답하고 일부만 폴백"하는 혼합 시나리오가 없다. 현재 `gh_state`가 브랜치별 독립 awk 조회라 로직상 문제는 없어 보이나(각 호출이 자기 브랜치만 본다), 향후 리팩터가 "배치에 하나라도 miss가 있으면 전체를 폴백"하는 식으로 잘못 바뀌어도 잡아낼 회귀 테스트가 없다.
  - 제안: 후보 2개(`branch-a`는 배치 hit, `branch-b`는 `BATCH_OMIT`) 조합에서 `pr view`가 정확히 `branch-b`에 대해서만 1회 호출됨을 단언하는 테스트.

- **[INFO]** 폴백 테스트들이 "배치 시도 자체는 여전히 일어났다"를 단언하지 않음
  - 위치: `test_falls_back_to_pr_view_when_branch_missing_from_batch`, `test_batch_failure_falls_back_to_pr_view`
  - 상세: 두 테스트 모두 `pr view` 호출 횟수만 확인하고 `pr list`가 (실패했든 성공했든) 실제로 시도됐는지는 확인하지 않는다. 현재 구현상 배치 스킵 조건은 오직 "claude/* 브랜치 0개"뿐이라 실질 위험은 낮지만, 명시적으로 `self.assertEqual(len(self._gh_calls("pr list")), 1)`을 추가하면 "폴백 = 배치를 건너뛴 결과"가 아니라 "배치를 먼저 시도하고 실패/누락했을 때만의 폴백"이라는 의도를 더 정확히 고정한다.

## 요약

핵심 회귀(N+1 → 배치 1회 호출)는 신규 5개 테스트로 잘 커버되며, 리뷰어가 직접 배치 로직을 무력화하는 뮤턴트를 적용해 두 핵심 테스트(`test_batches_state_lookups_instead_of_one_view_per_branch`, `test_batch_is_fetched_once_across_both_passes`)가 기대대로 실패함을 실측 확인해 plan 문서의 비-vacuity 주장이 사실임을 검증했다. 기존 18개 테스트도 회귀 없이 전부 통과하고, 테스트 격리(매 테스트 독립 tempdir·로그 파일)·가독성(각 테스트가 방지하려는 구체적 결함을 docstring에 명시)·테스트 용이성(`REAP_GH_BIN`/`GH_CALL_LOG`/`BATCH_OMIT`/`LIST_FAILS` 등 주입 가능한 env 시임)도 양호하다. 다만 이번 diff가 새로 도입한 `REAP_GH_PR_LIMIT` 값 자체는 (a) 호출 로그가 앞 3토큰만 기록해 구조적으로 검증 불가능하고 (b) bad-value 가드에 대한 실행 기반 테스트가 전무해 — 두 가지가 결합하면 `--limit` threading이나 그 가드가 깨지는 리그레션을 이 스위트가 잡지 못한다. 배치 응답이 MERGED 상태만 모델링하는 점도 실제 `--state all` 응답 모양과의 완전한 충실도 갭이지만 로직이 상태값에 무관해 위험은 낮다.

## 위험도
LOW
