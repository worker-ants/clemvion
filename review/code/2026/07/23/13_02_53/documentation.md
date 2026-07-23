# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `worktree-policy.md` 가 reap 의 gh 조회 메커니즘을 옛 방식(`gh pr view` 단건)으로만 서술 — 이번 diff 가 만든 신규 동작(배치 우선)과 불일치
  - 위치: `.claude/docs/worktree-policy.md` "정리 대상·조건" 절, `- **worktree** (...): `gh pr view <branch>` 가 **MERGED** ...` 줄
  - 상세: 이번 변경으로 `reap-merged-worktrees.sh` 의 PR 상태 조회는 **`gh pr list --state all --limit $REAP_GH_PR_LIMIT` 배치가 기본 경로**이고, `gh pr view <branch>` 는 배치 윈도우 밖(오래된 PR)이거나 배치 자체가 실패했을 때만 쓰이는 **폴백**으로 강등됐다(`reap-merged-worktrees.sh` `_load_pr_states`/`gh_state`). 그런데 `worktree-policy.md` 는 여전히 "`gh pr view <branch>` 가 MERGED" 를 유일한 판정 메커니즘처럼 서술해, 이번 PR 로 실제 호출 패턴(비용·rate-limit 특성·`--limit` 경계에서의 동작)이 바뀐 사실이 이 정책 문서엔 반영되지 않았다. 같은 문서의 throttle 불변식 줄도 `REAP_MIN_INTERVAL` 만 언급하고 신규 `REAP_GH_PR_LIMIT` 은 언급이 없다.
  - 제안: 해당 bullet 을 "PR 상태는 `gh pr list` 배치로 일괄 조회하고, `--limit`(`REAP_GH_PR_LIMIT`, 기본 200) 밖이거나 배치 실패 시에만 `gh pr view <branch>` 로 폴백" 으로 갱신. throttle bullet 근처에 `REAP_GH_PR_LIMIT` 한 줄 추가.

- **[WARNING]** plan 최상위 체크리스트가 완료된 B 항목을 여전히 미완료로 표기 — 같은 diff 안에서 자기모순
  - 위치: `plan/in-progress/harness-guard-followups.md` 파일 하단 `## 체크리스트` 섹션, `- [ ] B — reaper gh N+1 배치화` 줄
  - 상세: 이번 diff 는 `## B. reaper \`gh pr view\` 순차 N+1` 섹션 안의 두 세부 항목(배치 조회 구현, 회귀 테스트 갱신)을 모두 `[x]` 로 마감 처리했지만, 파일 맨 아래 요약 체크리스트의 `B` 줄은 갱신하지 않아 `[ ]` 상태로 남았다. 같은 diff 에서 `A`·`F` 는 섹션 완료와 요약 체크리스트 `[x]` 가 함께 갱신된 것과 대조적이다. 이 프로젝트의 관례상 plan 체크박스는 실제 상태를 나타내야 하며(완료 후에만 체크), 이 불일치는 다음에 plan 을 훑는 사람이 B 를 "아직 미착수"로 오판하게 만든다.
  - 제안: `## 체크리스트` 의 `- [ ] B — reaper gh N+1 배치화` 를 `- [x]` 로 갱신(같은 커밋에 포함).

- **[INFO]** `test_reap_merged_worktrees.py` 모듈 docstring 의 "assert the documented behaviour" 목록이 신규 배치/폴백 테스트 그룹을 반영하지 않음
  - 위치: `.claude/tests/test_reap_merged_worktrees.py` 파일 최상단 모듈 docstring (변경되지 않은 영역, diff 밖)
  - 상세: 이번 diff 로 `test_batches_state_lookups_instead_of_one_view_per_branch` 등 gh 배치·폴백을 검증하는 5개 테스트가 새로 추가됐으나, 파일 상단 docstring 의 불릿 목록(제거/스킵/dangling 판정 등 기존 동작만 나열)은 갱신되지 않았다. 이 목록은 "여기 있는 테스트들이 무엇을 보장하는지"의 1차 진입점 역할을 하므로, 새 동작 클래스(배치 조회·`--limit` 폴백·배치 실패 시 폴백·후보 0개 시 gh 미호출)가 빠져 있으면 다음에 파일을 훑는 사람이 그 커버리지를 놓치기 쉽다.
  - 제안: docstring 목록에 "PR 상태는 `gh pr list` 로 배치 조회하고, 배치 미스/실패 시 `gh pr view` 로 폴백한다" 한 줄 추가.

- **[INFO]** `GH_PR_LIMIT` 의 `0` 배제 사유가 주석에 설명되지 않음(비대칭 재사용 주석)
  - 위치: `.claude/tools/reap-merged-worktrees.sh:610-613` (`GH_PR_LIMIT="${REAP_GH_PR_LIMIT:-200}"` 및 `case` 가드)
  - 상세: 주석은 "Same bad-value guard: a non-integer would be passed straight to `gh --limit` and fail the batch." 라고만 적어, 바로 위 `MIN_INTERVAL` 가드와 "같은 종류"라고 안내한다. 그러나 실제 패턴은 `''|*[!0-9]*|0` 으로 **리터럴 0 도 명시적으로 배제**하는 반면, `MIN_INTERVAL` 쪽은 0 을 "throttle off" 라는 유효한 의미로 허용한다 — 두 가드가 겉보기엔 유사하지만 0 처리 의미가 다르다. 왜 `--limit 0`(배치가 항상 아무것도 못 가져와 매번 폴백으로 전락) 을 무효로 보고 기본값으로 되돌리는지에 대한 설명이 없다.
  - 제안: 가드 주석에 "0 은 배치를 무의미하게 만들어(항상 폴백) 기본값으로 되돌린다" 한 구절 추가.

- **[INFO]** `.claude/tests/README.md` 의 `test_reap_merged_worktrees.py` 한 줄 요약이 신규 배치 커버리지를 언급하지 않음
  - 위치: `.claude/tests/README.md:33`
  - 상세: 요약은 `REAP_GH_BIN` 스텁·머지/dirty/`--keep` 커버리지만 서술하고, 이번에 추가된 "배치 vs per-branch 호출 수 단언" 커버리지는 없다. 다른 파일(스크립트 헤더, plan 문서)은 갱신됐는데 이 README 만 예전 요약 그대로다. 필수는 아니나(요약이라 완전성 의무는 약함) 일관성 차원에서 한 구절 추가를 권장.
  - 제안: "...while still reaping everything else." 뒤에 "and that PR states are fetched via one batched `gh pr list` (falling back to per-branch `gh pr view` only on a miss or failure)." 정도 추가.

## 긍정적으로 평가할 점 (참고)

- 스크립트 헤더의 `Env:` 섹션에 신규 `REAP_GH_PR_LIMIT` 이 즉시 추가돼 `--help` 출력(헤더를 `sed` 로 추출)과 자동 동기화됨.
- `_load_pr_states`/`gh_state` 주변 인라인 주석이 서브셸 함정("모든 호출부가 command substitution → 서브셸이라 지연 로드를 `gh_state` 안에 두면 메모가 버려진다")을 정확하고 구체적으로 설명 — 복잡한 로직에 대한 모범적인 인라인 주석.
- 신규 테스트 5건 모두 docstring 에 "왜 이 테스트가 필요한가"(N+1 인시던트, 배치 윈도우 폴백, 배치 실패 폴백, lazy 호출) 를 서술해 기존 파일의 서술적 테스트명·docstring 관례를 그대로 따름.
- `plan/in-progress/harness-guard-followups.md` §B 섹션 본문은 구현 함정(서브셸 메모이제이션)까지 포함해 상세하고 정확하게 갱신됨 — 체크리스트 동기화 누락(위 WARNING)만 아쉬움.
- CHANGELOG.md 는 이 저장소에서 spec 연동 제품 변경에만 쓰이는 패턴이 확인되며(harness 변경 이력 없음), 이번 `.claude/` 하네스 변경은 그 범주 밖이라 CHANGELOG 갱신 불요 — 누락 아님.

## 요약

핵심 로직(스크립트 헤더 Env 문서, 함수 인라인 주석, 신규 env var 문서화, 테스트 docstring)의 문서화 품질은 높고 특히 서브셸 메모이제이션 함정에 대한 설명은 모범적이다. 다만 이번 diff 가 만든 동작 변경(gh 조회가 배치 우선으로 전환)이 정책 문서(`worktree-policy.md`)에는 반영되지 않아 스크립트 안과 밖의 서술이 어긋났고, plan 최상위 체크리스트가 완료된 B 항목을 미체크로 남겨 같은 파일 안에서 자기모순이 생겼다 — 둘 다 이번 diff 의 "완결성" 관점에서 놓친 갱신이며 수정 비용은 낮다.

## 위험도
LOW
