# Plan 정합성 검토 — trigger-create-multi-provider-ui (구현 완료 시점)

검토 모드: `--impl-done`
Target: `plan/in-progress/trigger-create-multi-provider-ui.md` + 관련 구현 diff
검토 일시: 2026-05-24
검토자: plan-coherence sub-agent

---

## 발견사항

### [WARNING] dispatcher-split plan frontmatter 갱신 미완료

- **target 위치**: `plan/in-progress/trigger-create-multi-provider-ui.md` §완료 기준 (line 179) + §의식적 boundary (line 153)
- **관련 plan**: `plan/in-progress/chat-channel-dispatcher-split.md` frontmatter `status` 필드
- **상세**: target plan 은 완료 기준에 "dispatcher-split plan frontmatter 갱신 — `status: backlog → ready` + trigger 조건 항목을 GUI 관점 충족 cross-link" 를 명시하고 있다. 그러나 target worktree (`claude/trigger-create-multi-provider-ui-plan-677f12`) 의 diff (`git diff origin/main...HEAD`) 에 `plan/in-progress/chat-channel-dispatcher-split.md` 변경이 전혀 포함되어 있지 않다. 해당 파일은 worktree 내에서도 `status: backlog (trigger 조건 미충족 — 2nd provider 도입 결정 대기)` 그대로 남아 있다. 즉, 이 plan 이 스스로 완료 기준으로 정의한 후속 조치 하나가 미실행 상태로 PR 이 열려 있다.
- **제안**: PR 머지 전, target worktree 에서 `plan/in-progress/chat-channel-dispatcher-split.md` 의 frontmatter 를 다음과 같이 갱신해야 한다:
  - `status: backlog → ready (trigger 조건 충족 — 2nd provider GUI 진입점 본 plan PR 머지)`
  - trigger 조건 항목에 cross-link 추가 (`plan/in-progress/trigger-create-multi-provider-ui.md` 머지 시점)
  - 이 갱신이 없으면 dispatcher-split 의 trigger 조건이 언제 충족됐는지 추적이 단절되고, 후속 plan 에서 진입 가능 여부를 판단할 수 없다.

---

### [INFO] trigger-list-chat-channel-ui plan 이 in-progress 에 잔류 (stale plan cleanup 의 별 grooming 트리거)

- **target 위치**: `plan/in-progress/trigger-create-multi-provider-ui.md` §의식적 boundary (line 156)
- **관련 plan**: `plan/in-progress/trigger-list-chat-channel-ui.md` (PR #283 MERGED)
- **상세**: target plan 이 "stale 정리는 본 plan 범위 밖" 으로 의식적으로 경계를 그은 점은 정당하다. 그러나 PR #283 이 MERGED 된 이후에도 `plan/in-progress/trigger-list-chat-channel-ui.md` 가 `plan/in-progress/` 에 남아 있어 plan lifecycle 규칙(`plan/complete/` 로 `git mv`) 미이행 상태이다. target plan 완료 PR 에 grooming commit 을 포함하거나 별 chore PR 로 처리하길 권장한다.
- **제안**: `plan/in-progress/trigger-list-chat-channel-ui.md` → `plan/complete/trigger-list-chat-channel-ui.md` (`git mv`). 별 grooming PR 또는 target PR 의 추가 commit 으로 처리.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보로 초기 검토된 7개 worktree 중 아래 6개는 stale 판정되어 §5번 (worktree 충돌) 검토 대상에서 제외:

| worktree | branch | Step 1 결과 | Step 2 결과 |
|---|---|---|---|
| `chat-channel-e2e-hardening-5ff799` | `claude/chat-channel-e2e-hardening-5ff799` | ACTIVE (squash-merge 로 Step 1 통과 못 함) | PR #303 MERGED → **stale** |
| `chat-channel-unverified-owner-e2e-d74fda` | `claude/chat-channel-unverified-owner-e2e-d74fda` | ACTIVE (squash-merge) | PR #306 MERGED → **stale** |
| `chore-stale-plan-cleanup-c7e170` | `claude/chore-stale-plan-cleanup-c7e170` | ACTIVE (squash-merge) | PR #302 MERGED → **stale** |
| `ai-agent-formdata-size-limit-2ad8ff` | `claude/ai-agent-formdata-size-limit-2ad8ff` | ACTIVE (squash-merge) | PR #305 MERGED → **stale** |
| `password-hash-format-guard-60f7f2` | `claude/password-hash-format-guard-60f7f2` | ACTIVE (squash-merge) | PR #307 MERGED → **stale** |
| `fix-secret-store-root-entities-6aa869` | `claude/fix-secret-store-root-entities-6aa869` | ACTIVE (squash-merge) | PR #304 MERGED → **stale** |

이 6개 worktree 는 모두 이미 main 에 머지된 branch 의 청소되지 않은 worktree 이다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

**실제 active 로 처리한 worktree**: `trigger-create-multi-provider-ui-plan-677f12` (target 자신, PR 준비 중) + `trigger-list-chat-channel-ui-d0c4a3` (Step 1 ACTIVE, Step 2 PR #283 MERGED → stale).

`trigger-list-chat-channel-ui-d0c4a3` 는 Step 2 에서 MERGED 로 확인 → stale. 해당 worktree 가 물리적으로 존재하지 않음 (`.claude/worktrees/` 목록에 없음) 을 확인하여 실제 충돌 없음.

따라서 active worktree 중 target 과 동일 파일을 손대는 **실제 충돌 대상 없음** (나머지 active worktree 들은 `codebase/backend/src/nodes/ai/`, `user.entity.*`, `app.module.*` 등 전혀 다른 파일 영역).

---

## 요약

target plan (`trigger-create-multi-provider-ui`) 은 spec 결정·선행 조건·후속 plan 들과 전반적으로 정합하다. 미해결 결정 우회, active worktree 와의 파일 경합, 선행 plan 미해소는 발견되지 않았다. 단, plan 이 스스로 완료 기준으로 명시한 `chat-channel-dispatcher-split.md` frontmatter `status: backlog → ready` 갱신이 현재 diff 에 포함되어 있지 않아 WARNING 한 건을 보고한다. 이 갱신이 PR 머지 전 커밋으로 포함되어야 dispatcher-split 진입 시점 추적이 가능하다. `trigger-list-chat-channel-ui` plan 의 `plan/complete/` 미이동은 INFO 로 별 grooming 을 권장한다. worktree 충돌 후보 7건 중 stale 6건 skip, 실질 active 1건 (target 자신) 분석 — 경합 없음. 또한 stale worktree 6건이 `.claude/worktrees/` 에 잔류하므로 cleanup 실행 권장.

---

## 위험도

LOW
