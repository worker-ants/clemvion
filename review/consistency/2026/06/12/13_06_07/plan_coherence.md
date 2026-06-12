# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/4-nodes/5-data/)
검토 일시: 2026-06-12

---

## 발견사항

### 1. **[CRITICAL]** `unified-model-mgmt-plan-close` 활성 worktree 가 `spec/4-nodes/5-data/2-code.md` 의 최근 확정 내용을 삭제·단순화함

- **target 위치**: `spec/4-nodes/5-data/2-code.md` — §2.2 `$helpers.base64` 타입 계약, §4 step3 dayjs 스냅샷 경로, §7.1 "dayjs 스냅샷 최적화" callout, §7.2 메모리 행 `CODE_NODE_MEMORY_LIMIT_MB` env 조정, §Rationale 의 dayjs·base64·메모리 env 3개 소절
- **관련 plan/worktree**: `plan/in-progress/unified-model-management.md`, worktree `unified-model-mgmt-plan-close`, branch `claude/unified-model-mgmt-plan-close` (PR #562, **OPEN**)
- **상세**: PR #561(merge commit `eb9cc631`)이 `spec/4-nodes/5-data/2-code.md` 에 다음을 추가했다: (a) `$helpers.base64.encode/decode` 비문자열 `TypeError` 계약·입력 타입 callout, (b) §4 step3 dayjs 스냅샷 복원 경로 기술, (c) §7.1 "dayjs 스냅샷 최적화" 섹션, (d) §7.2 메모리 행을 `CODE_NODE_MEMORY_LIMIT_MB` env 조정 가능으로 갱신, (e) §Rationale dayjs·base64·메모리 한도 env 소절 3개. `claude/unified-model-mgmt-plan-close` branch 는 PR #558(`3a167330`)을 공통 조상으로 하여 main 보다 정확히 한 commit 뒤에 있고, 그 위에서 위 추가분을 **모두 삭제 또는 단순화**하는 diff 를 갖는다(`git diff origin/main..claude/unified-model-mgmt-plan-close -- spec/4-nodes/5-data/2-code.md` 결과, -113 줄). 이 branch 가 현재 상태 그대로 main 에 머지되면 PR #561 에서 확정·구현된 spec 내용(base64 타입 계약·dayjs 스냅샷·env 조정)이 **롤백**된다.
- **제안**: PR #562 을 머지하기 전에 해당 branch 를 `origin/main` 으로 rebase 해야 한다. rebase 과정에서 `spec/4-nodes/5-data/2-code.md` 에 대한 패치가 정상 적용 여부를 확인한다. `unified-model-mgmt-plan-close` branch 의 의도(unified model management plan 완료 마킹)와 `2-code.md` 삭제 diff 가 왜 함께 포함됐는지 검토 — 혹 stale base 로 인해 cherry-pick 실수가 섞인 것이라면 rebase 후 code spec 부분을 drop 한다.

---

### 2. **[WARNING]** `code-node-isolated-vm-followups.md` 미완료 항목 2건이 target spec 에 이미 반영됐으나 plan 체크박스가 미갱신

- **target 위치**: `spec/4-nodes/5-data/2-code.md` §2.2, §7.2, Rationale
- **관련 plan**: `plan/in-progress/code-node-isolated-vm-followups.md` — "INFO — `$helpers.base64` 비문자열 일관성" ( `[ ]` 미완), "INFO — 메모리 한도 env" ( `[ ]` 미완)
- **상세**: 두 항목은 spec 변경을 "변경 시 spec 동반" 조건부로 기다리던 코드 후속 작업이다. PR #561(`eb9cc631`, 2026-06-12 머지)에서 spec 측이 먼저 완료됐다 — `$helpers.base64` 비문자열 `TypeError` 계약이 §2.2 에 기술되고 Rationale 에 배경 소절이 추가됐으며, `CODE_NODE_MEMORY_LIMIT_MB` env 조정(상한 512MB clamp)이 §7.2 에 기술됐다. plan 체크박스는 여전히 `[ ]` 상태라 "미착수" 로 오독된다. 코드 구현(실제 `typeof !== 'string'` TypeError 로직, `CODE_NODE_MEMORY_LIMIT_MB` env 파싱) 은 별도로 확인 필요하지만 spec 선행분은 완료된 상태다.
- **제안**: `plan/in-progress/code-node-isolated-vm-followups.md` 의 두 항목을 실제 코드 구현 완료 여부에 따라 체크하거나 "(spec 완료, 코드 잔여)" 상태로 분리 표기. spec 측이 PR #561 에서 완료됐음을 명시.

---

### 3. **[WARNING]** `code-node-isolated-vm-followups.md` Spec 항목 "§4 step3 / §7.1 snapshot 경로 기술" 이 target spec 에 반영됐으나 plan 미갱신

- **target 위치**: `spec/4-nodes/5-data/2-code.md` §4 step3 (dayjs 스냅샷 복원 경로), §7.1 "dayjs 스냅샷 최적화" callout
- **관련 plan**: `plan/in-progress/code-node-isolated-vm-followups.md` — "§4 step3 / §7.1 snapshot 경로 기술 (그룹4 ai-review SPEC-DRIFT INFO #1·#2)" ( `[ ]` 미완, "planner 위임 — 비차단 INFO")
- **상세**: PR #561 이 §4 step3 ("dayjs 는 모듈 로드 시 `createSnapshot` 1회 베이크 후 per-exec isolate 가 스냅샷에서 복원, 미지원 시 per-exec 컴파일 fallback")과 §7.1 dayjs 스냅샷 최적화 섹션을 추가해 plan 이 요청한 내용을 충족했다. plan 체크박스는 여전히 `[ ]`.
- **제안**: `plan/in-progress/code-node-isolated-vm-followups.md` Spec 섹션의 해당 항목을 `[x]` (PR #561 완료)로 표기.

---

### 4. **[INFO]** target 검토 worktree `code-followups-impl-afebb8` 자체가 stale — 해당 branch 는 main 에 이미 포함

- **target 위치**: worktree `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8` (branch `claude/code-followups-impl-afebb8`)
- **상세**: `git merge-base --is-ancestor claude/code-followups-impl-afebb8 origin/main` → exit 0 (STALE). 해당 branch 의 작업은 이미 main 에 포함되어 있으나 worktree 가 정리되지 않고 남아 있다. 현재 consistency check 가 이 worktree 안에서 실행되고 있다.
- **제안**: 작업이 완료된 worktree 이므로 cleanup 대상. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

- `audit-sot-hygiene-8fc5f1` (branch `claude/audit-sot-hygiene-8fc5f1`) — Step 1 ACTIVE, Step 2 PR #552 MERGED → stale skip
- `code-snapshot-perf-ff751c` (branch `claude/code-snapshot-perf-ff751c`) — Step 1 ACTIVE, Step 2 PR #559 MERGED → stale skip
- `plan-cleanup-impl-done-4c9d96` (branch `claude/plan-cleanup-impl-done-4c9d96`) — Step 1 ACTIVE, Step 2 PR #556 MERGED → stale skip
- `pr4b-kb-embedding-retire` (branch `claude/pr4b-kb-embedding-retire`) — Step 1 ACTIVE, Step 2 PR #558 MERGED → stale skip
- `spec-audit-action-prose` (branch `claude/spec-audit-action-prose`) — Step 1 ACTIVE, Step 2 PR #554 MERGED → stale skip
- `spec-auth-hygiene` (branch `claude/spec-auth-hygiene`) — Step 1 ACTIVE, Step 2 PR #560 MERGED → stale skip
- `spec-ragsources-content` (branch `claude/spec-ragsources-content`) — Step 1 ACTIVE, Step 2 PR #557 MERGED → stale skip
- `test-code-http-hardening-10aad3` (branch `claude/test-code-http-hardening-10aad3`) — Step 1 ACTIVE, Step 2 PR #555 MERGED → stale skip
- `code-followups-impl-afebb8` (현재 target worktree, branch `claude/code-followups-impl-afebb8`) — Step 1 STALE (ancestor of main) → stale skip

이들 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

**비 stale (active) 충돌 후보**: `unified-model-mgmt-plan-close` (PR #562 OPEN) — §1번 발견사항으로 CRITICAL 분류.

---

## 요약

target 영역(`spec/4-nodes/5-data/`) 은 현재 main 에 이미 반영된 최신 상태이며, 주요 충돌 위협은 단 하나다. 활성 PR #562(`unified-model-mgmt-plan-close`)가 `spec/4-nodes/5-data/2-code.md` 에 대해 PR #561 에서 확정된 base64 타입 계약·dayjs 스냅샷 최적화·메모리 env 조정 내용을 삭제하는 diff 를 포함하고 있어, 이 branch 가 rebase 없이 머지되면 최근 확정 spec 이 일부 롤백된다 (CRITICAL). 추가로 `code-node-isolated-vm-followups.md` 의 spec 완료 항목 3건(base64/memory env/snapshot 경로)이 PR #561 에서 완료됐음에도 plan 체크박스가 미갱신된 상태라 WARNING 2건으로 기록했다. worktree 충돌 후보 9개는 PR MERGED 확인(Step 2)으로 stale skip, active 충돌 후보는 1건(PR #562) 분석.

---

## 위험도

**CRITICAL**

STATUS: OK
