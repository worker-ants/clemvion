# 요구사항(Requirement) 리뷰 — reaper gh N+1 배치화

## 검증 방법
- `.claude/tests/test_reap_merged_worktrees.py` 23건 전량 실행 → **전부 PASS** (`pytest` 기준 8.77s).
- 비-vacuity 검증: `_load_pr_states` 호출부(`[ -n "$claude_branches" ] && _load_pr_states`)를 no-op 로 뮤테이트해
  배치를 무력화한 뒤 재실행 → `test_batches_state_lookups_instead_of_one_view_per_branch`,
  `test_batch_is_fetched_once_across_both_passes` 두 신규 테스트가 실제로 FAIL(`0 != 1`, per-branch
  `pr view` 3회 관측)함을 확인 → 원복 후 clean 상태(`git status --porcelain` 무변경) 재확인. 신규 배치
  테스트가 실제로 배치 유무를 판별한다.

## 발견사항

- **[WARNING]** plan 최상위 체크리스트의 B 항목이 본문 완료 표기와 불일치
  - 위치: `plan/in-progress/harness-guard-followups.md:282` (`- [ ] B — reaper gh N+1 배치화`)
  - 상세: 같은 파일의 §B 본문(1175, 1184번째 줄 부근, diff 상 `- [x] gh pr list ... → 배치 채택`,
    `- [x] 회귀: 기존 test_reap_merged_worktrees.py ...`)은 이번 diff 에서 `[x]` 로 전환됐고, F 항목처럼
    구현이 끝난 항목은 최상위 체크리스트도 함께 `[x]` 로 갱신하는 것이 이 문서의 기존 관례(A, F 는 이미
    그렇게 돼 있음)다. 그런데 최상위 "## 체크리스트" 절의 `- [ ] B` 는 그대로 미체크 상태로 남아, 문서
    내부에서 "B 는 아직 안 함"과 "B 는 끝냈고 이 PR" 이라는 두 서술이 공존한다. 사용자 메모(`plan 체크박스
    = 실제 상태`, "수행 후에만 체크하고 그 커밋에 포함")와 직접 충돌.
  - 제안: `plan/in-progress/harness-guard-followups.md:282` 를 `- [x] B — reaper gh N+1 배치화 (이 PR)`
    로 갱신 (F 항목의 표기 패턴과 통일).

- **[WARNING]** 하네스 거버넌스 문서(`worktree-policy.md`)가 새 배치 메커니즘을 반영하지 않음
  - 위치: `.claude/docs/worktree-policy.md:106` ("정리 대상·조건" — `gh pr view <branch>` 가 **MERGED**...)
  - 상세: 이 PR 이 `.claude/tools/reap-merged-worktrees.sh` 자체의 헤더 주석은 배치 우선(`gh pr list`)+
    캐시미스/실패 시 `gh pr view` 폴백으로 정확히 갱신했으나(스크립트 34~44행 부근 diff), reaper 의
    "정리 대상·조건"을 서술하는 병렬 문서인 `worktree-policy.md` §7 은 여전히 "`gh pr view <branch>` 가
    MERGED" 만을 유일한 메커니즘처럼 서술한다. 이 문서는 `spec/` 은 아니지만 이 기능의 "판정·실행은
    reap-merged-worktrees.sh 한 곳" 이라 명시하며 그 판정 방식을 요약하는 문서-of-record 다. 독자가 이
    문서만 보면 여전히 브랜치당 1회 `gh pr view` 라고 오해한다.
  - 제안: §7 "정리 대상·조건" 항목에 "PR 상태는 배치(`gh pr list --state all --limit N`)로 1회 선조회,
    `--limit` 밖이거나 배치 실패 시에만 개별 `gh pr view` 로 폴백" 을 한 줄 추가 (spec 문서가 아니므로
    본 reviewer 가 직접 수정하지 않음 — developer/문서 갱신 대상).

- **[INFO]** `spec/` 커버리지 없음 (spec 누락)
  - 위치: `spec/` 전역 검색 (`reap-merged-worktrees|gh pr view|gh pr list`) — 매치 0건
  - 상세: 이 변경은 `.claude/tools/`, `.claude/tests/`, `plan/` 범위의 내부 하네스 도구이며 제품 기능이
    아니다. CLAUDE.md 정보 저장 위치 표상 `spec/` 은 제품 정의·기술 명세 전용이라 이 영역은 원래
    `spec/` 대상이 아니다 (관련 서술은 `.claude/docs/worktree-policy.md` 에 있으며 위 WARNING 에서 별도
    다룸).

- **[INFO]** `REAP_GH_PR_LIMIT` 신규 env var 의 직접 테스트 부재
  - 위치: `.claude/tools/reap-merged-worktrees.sh:66-67` (`GH_PR_LIMIT=${REAP_GH_PR_LIMIT:-200}`;
    `case ... ''|*[!0-9]*|0) GH_PR_LIMIT=200 ;; esac`)
  - 상세: 값 검증 가드(빈 값/비정수/0 → 200 폴백)와 커스텀 값 적용 자체를 직접 단언하는 테스트가 없다.
    `REAP_MIN_INTERVAL` 의 기존 가드와 동일 패턴이라 위험은 낮으나, "PR 이 --limit 밖" 폴백 시나리오는
    `batch_omit` 으로 결과만 시뮬레이션할 뿐 `REAP_GH_PR_LIMIT` 자체를 통해 트리거하는 테스트는 없다.
  - 제안: `REAP_GH_PR_LIMIT=abc`(또는 `0`) 로 실행해 `gh pr list --limit 200` 이 호출됨을 단언하는 테스트
    1건 추가 고려 (필수는 아님, 저위험).

- **[INFO]** 배치 map 의 "브랜치당 첫 매치" 선택이 브랜치 재사용 시나리오에서 모호할 수 있음
  - 위치: `.claude/tools/reap-merged-worktrees.sh:113` (`awk -F'\t' -v b="$branch" '$1==b{print $2; exit}'`)
  - 상세: 한 브랜치명에 대해 `gh pr list` 응답에 레코드가 두 개 이상(과거에 종료된 PR + 같은 브랜치명을
    재사용한 새 PR) 존재하면 `gh pr list` 의 정렬 순서에 따라 첫 매치가 선택된다. 실제 워크플로는
    브랜치=PR 1:1 이 일반적이라 발생 가능성은 낮고, 설사 발생해도 최악의 결과는 "증명된 merge 를 놓쳐
    reap 하지 않음"(fail-safe 방향)이라 스크립트 자신이 명시한 안전 철학과 충돌하지 않는다. 데이터
    유실·오삭제로 이어지지 않으므로 차단 사유 아님.

- **[INFO]** 테스트 더블(`_GH_STUB`)이 배치 응답에 OPEN/CLOSED 레코드를 흉내내지 않음
  - 위치: `.claude/tests/test_reap_merged_worktrees.py` `_GH_STUB`, `pr list` 분기 (`for b in
    ${MERGED_BRANCHES:-}; do ... printf '%s\tMERGED\n' "$b"; done`)
  - 상세: 배치가 `MERGED_BRANCHES` 에 속한 브랜치만 방출하고 OPEN/CLOSED 상태의 레코드는 전혀 만들지
    않는다. 그 결과 미merge 브랜치는 테스트 상 항상 `pr view` 폴백을 거쳐 상태를 얻는다(정답은 맞지만
    배치의 실제 이점인 "OPEN 브랜치도 폴백 없이 배치로 해결" 경로는 어떤 테스트로도 검증되지 않는다).
    프로덕션 결함은 아니고 순수 테스트 커버리지 갭.

## 요약
`gh_state` 의 N+1(`gh pr view` 브랜치별 순차 호출)을 `gh pr list` 단건 배치 + 캐시미스/실패 시 개별
`pr view` 폴백으로 교체한 구현은 plan(§B)이 요구한 항목(배치 채택, 서브셸 함정 회피를 위한 메인 셸
선로드, `claude/*` 브랜치 0개 시 lazy skip, `--limit` 밖 브랜치 폴백, 배치 실패 시 폴백)을 빠짐없이
충족하며, 5건의 신규 테스트가 각 시나리오(배치 1회·두 pass 공유·배치 누락 폴백·배치 실패 폴백·후보 0개
무호출)를 정확히 커버한다. 직접 실행한 23건 전량 PASS + 배치 비활성 뮤테이션에 대한 실측 FAIL 로
비-vacuity 도 확인했다. 기능적 CRITICAL 은 발견되지 않았다. 다만 이 diff 자체가 plan 문서의 최상위
체크리스트(B 항목)를 본문과 불일치 상태로 남겼고, 병행 거버넌스 문서(`worktree-policy.md` §7)가 새
배치 메커니즘을 반영하지 못해 stale 서술이 됐다 — 둘 다 코드 정합성이 아닌 문서 동기화 이슈로 WARNING
등급이며 병합을 막을 사유는 아니다.

## 위험도
LOW
