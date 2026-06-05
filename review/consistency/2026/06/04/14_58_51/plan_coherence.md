## 발견사항

### [WARNING] `spec-sync-execution-engine-gaps.md` §8 항목이 타임아웃 전체를 "미구현"으로 추적 — 부분 구현 후 갱신 필요

- **target 위치**: `plan/in-progress/spec-update-pr2a-timeout.md` §제안 변경 1 (`spec/5-system/4-execution-engine.md §8`)
- **관련 plan**: `plan/in-progress/spec-sync-execution-engine-gaps.md` §8 항목 — "단일 Execution 노드 500 / 실행시간 30분 timeout, 큐 대기 5분 cancel. enforcement 코드 부재 재확인."
- **상세**: `spec-sync-execution-engine-gaps.md`는 §8 전체(워크스페이스 cap + 실행시간 timeout + 큐 대기 cancel)를 하나의 미구현 항목으로 추적한다. PR2a(`impl-exec-concurrency-cap`)가 active-running 타임아웃을 구현했다면, 이 plan의 §8 항목 중 timeout 부분이 부분 해소됐으므로 해당 항목을 분리하거나 완료 표기해야 한다. target 이 spec을 갱신하면서 `spec-sync-execution-engine-gaps.md`의 §8 추적 항목은 사실과 어긋난 채 남게 된다.
- **제안**: `spec-update-pr2a-timeout.md` 적용 시 `spec-sync-execution-engine-gaps.md`의 §8 미구현 항목을 "(1단계) active-running 타임아웃 — PR2a 완료" / "(2단계) 워크스페이스·워크플로우 cap·큐 대기 cancel — Planned"로 분리 갱신. target plan 또는 적용 후 project-planner가 수행.

---

### [WARNING] `data-flow/0-overview.md §4` BullMQ 큐 카탈로그에 `execution-run` 이미 누락 확인됨 — PR1 미반영 여부 재검증 필요

- **target 위치**: `plan/in-progress/spec-update-pr2a-timeout.md` §제안 변경 2 — `execution-run`을 `execution-continuation` 앞에 삽입
- **관련 plan**: PR1(`impl-exec-intake-queue`, PR #463, MERGED). `fix-bg-context-followups` (PR #451, MERGED) worktree는 동일 파일에서 `makeshop-token-refresh` 행 제거를 반영했으나 `execution-run` 추가는 하지 않았다.
- **상세**: 현재 `origin/main`의 `spec/data-flow/0-overview.md` line 93 인라인 텍스트에 `execution-run`이 없고, §4 표에도 행이 없다. PR1(#463)은 MERGED 상태이므로 카탈로그에 `execution-run`이 없는 것은 PR1의 spec 반영 누락이거나 PR1이 spec을 갱신하지 않은 것이다. target plan의 "After" 제안은 인라인 텍스트에 `execution-run`을 `execution-continuation` 앞에 삽입하는데, 현행 main의 인라인 텍스트에는 `makeshop-token-refresh`가 여전히 있다 — `fix-bg-context-followups` worktree의 변경(해당 항목 제거)이 stale 판정된 worktree에만 있고 아직 main에 반영되지 않았을 수 있다. 적용 전 현재 파일 상태를 재확인해야 한다.
- **제안**: target 적용 전 `spec/data-flow/0-overview.md` line 93 및 §4 표의 현재 상태를 확인. 인라인 텍스트와 표 삽입 위치가 stale worktree와 다를 수 있으므로 after 텍스트를 현행 main 기준으로 조정.

---

### [INFO] `spec-fix-eia-token-error-codes.md`(TBD worktree)가 §5.1 에러 코드 결정을 보류 중 — target의 §6.4 코드 추가와 간접 중복 없음, cross-ref 권장

- **target 위치**: `plan/in-progress/spec-update-pr2a-timeout.md` §제안 변경 3 — EIA §6.4 `error.code` 목록에 `EXECUTION_TIME_LIMIT_EXCEEDED` 추가
- **관련 plan**: `plan/in-progress/spec-fix-eia-token-error-codes.md` — `spec/5-system/14-external-interaction-api.md §5.1` 에러 표에 `TOKEN_REVOKED`, `SCOPE_MISMATCH` HTTP status 정합, terminal revoke 신뢰성 명시. worktree TBD(미착수).
- **상세**: 두 plan이 동일 파일의 다른 섹션(§5.1 vs §6.4)을 수정한다. 현재 `spec-fix-eia-token-error-codes.md`는 미착수이므로 직접 충돌은 없다. 다만 §6.4 에러 코드 카탈로그는 `3-error-handling.md §엔진 수준 에러`를 정본으로 참조(`... 정본은 spec/5-system/3-error-handling.md §엔진 수준 에러`)하므로, target 적용 시 `3-error-handling.md`에도 `EXECUTION_TIME_LIMIT_EXCEEDED`가 등재돼 있는지 함께 확인 필요.
- **제안**: target 적용 시 `spec/5-system/3-error-handling.md §엔진 수준 에러` 목록에 `EXECUTION_TIME_LIMIT_EXCEEDED` 포함 여부 확인. 누락 시 동일 패치에 포함.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip된 항목:

- `spec-exec-intake-queue` (branch `claude/spec-exec-intake-queue`) — Step 2 PR #458 MERGED (squash merge: Step 1 ancestor 검사 미통과, Step 2 GitHub PR state MERGED → stale 확정)
- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 2 PR #451 MERGED (squash merge: Step 1 ancestor 검사 미통과, Step 2 GitHub PR state MERGED → stale 확정)

두 worktree 모두 `spec/5-system/4-execution-engine.md`, `spec/data-flow/0-overview.md`, `spec/5-system/14-external-interaction-api.md`를 수정하고 있으나 PR이 종결됐으므로 활성 경합 대상이 아니다. 단, 해당 변경이 main에 이미 반영됐는지(squash merge로 커밋 해시가 다름) `git log --oneline origin/main -- <file>`으로 확인 권장. 두 worktree가 여전히 파일시스템에 남아 있으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target 문서 `plan/in-progress/spec-update-pr2a-timeout.md`는 PR2a(`impl-exec-concurrency-cap`)가 active-running 타임아웃을 구현한 사실을 `spec/5-system/4-execution-engine.md §8`, `spec/data-flow/0-overview.md §4`, `spec/5-system/14-external-interaction-api.md §6.4` 세 곳에 반영하는 SPEC-DRIFT 적용 계획이다. 미해결 결정 우회나 active worktree 동시 경합(§5)은 없다 — 잠재적 충돌 후보였던 `spec-exec-intake-queue`, `fix-bg-context-followups` 두 worktree 모두 stale 판정(각각 PR #458, PR #451 MERGED). 주요 주의사항은 두 가지: (1) `spec-sync-execution-engine-gaps.md`의 §8 미구현 항목이 target 반영 후 사실과 어긋나게 되므로 plan 갱신이 필요하고, (2) `data-flow/0-overview.md`의 현재 인라인 텍스트 상태(stale worktree 변경이 아직 main에 없을 수 있음)를 실제 파일로 재확인한 뒤 `execution-run` 삽입 위치를 조정해야 한다. worktree 충돌 후보 2건 중 stale 2건 skip, active 0건 분석.

## 위험도

LOW
