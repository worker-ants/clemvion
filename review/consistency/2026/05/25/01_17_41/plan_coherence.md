# Plan 정합성 검토 결과

검토 모드: `--impl-prep`, scope=`spec/5-system/`
Target: `spec/5-system/` (Phase 2 구현 착수 전 점검)
검토 worktree: `workflow-resumable-execution-phase2-a6b133` (branch `claude/workflow-resumable-execution-phase2-a6b133`)

---

## 발견사항

### [WARNING] Phase 1.3 미결정 — Phase 2 착수 조건 불명확

- **target 위치**: `plan/in-progress/workflow-resumable-execution.md` §Phase 1 item 1.3
- **관련 plan**: `plan/in-progress/workflow-resumable-execution.md`
- **상세**: Phase 1.3 체크박스가 `[ ]` 상태로 미완료. 해당 항목은 `continueExecution` / `continueButtonClick` / `continueAiConversation` / `endAiConversation` 의 "키 없음" 분기에서 사용자에게 명확한 에러 응답을 주는 임시 보강이다. 주석으로 "Phase 2 가 같은 sprint 안에 진행될 경우 skip 가능 — 사용자 영향 분석 후 결정" 이라 명시되어 있으나, skip 결정이 plan 에 기록되지 않은 채 Phase 2 착수가 진행될 경우, 1.3 의 임시 마킹 코드 (`SESSION_INTERRUPTED`) 가 Phase 2 구현과 병렬로 코드베이스에 존재하게 될 위험이 있다. Phase 2 는 `continueExecution` 등 동일 함수 경로를 BullMQ enqueue 로 교체하므로 1.3 의 임시 코드와 논리적으로 충돌.
- **제안**: Phase 2 착수 전에 (a) "1.3 skip — Phase 2 와 동시 sprint 진행으로 대체" 를 plan 에 명시하고 `[x]` 처리하거나, (b) 1.3 을 먼저 구현한 뒤 Phase 2 에서 제거하는 순서를 plan 에 명시한다. 현재 plan 의 "**본 단계는 Phase 2 가 같은 sprint 안에 진행될 경우 skip 가능**" 조건을 사용자 결정으로 확정하고 체크박스를 갱신 필요.

---

### [WARNING] Phase 2 plan frontmatter `worktree` 필드와 현 worktree 불일치

- **target 위치**: `plan/in-progress/workflow-resumable-execution.md` frontmatter
- **관련 plan**: 동일 파일
- **상세**: Plan frontmatter 에 `worktree: workflow-resumable-execution-6b105e` 로 명시되어 있으나, 현재 검토는 `workflow-resumable-execution-phase2-a6b133` worktree 에서 진행 중이다. 두 worktree 는 완전히 동일한 HEAD commit (`2b64dc04`) 을 가리키며 변경 파일 목록도 동일하다. 즉, Phase 2 작업용으로 별도 worktree 가 생성되었으나 plan frontmatter 가 갱신되지 않은 상태.
  - Phase 1 worktree (`workflow-resumable-execution-6b105e`): branch `claude/workflow-resumable-execution-6b105e`, HEAD `2b64dc04`, PR 없음 → Step 3 fallback: **ACTIVE** 취급.
  - Phase 2 worktree (`workflow-resumable-execution-phase2-a6b133`): branch `claude/workflow-resumable-execution-phase2-a6b133`, HEAD `2b64dc04`.
  - 두 branch 가 동일 commit 을 가리키므로 실질적 동일 상태이지만, 향후 Phase 2 작업 커밋이 `phase2` branch 에 쌓이면 plan frontmatter 의 `worktree` 가 이를 반영하지 않아 추적 혼란이 발생.
- **제안**: `plan/in-progress/workflow-resumable-execution.md` frontmatter 의 `worktree` 필드를 `workflow-resumable-execution-phase2-a6b133` 으로 갱신. 또는 Phase 2 전용 plan 파일을 분리 (예: `workflow-resumable-execution-phase2.md`) 해 Phase 2 scope 만 명시.

---

### [WARNING] `task-queue` 이름 확인 항목이 spec 에 TBD 로 남음 — Phase 2 구현 의무

- **target 위치**: `spec/5-system/4-execution-engine.md §9.2` BullMQ 큐 목록 표
- **관련 plan**: `plan/in-progress/workflow-resumable-execution.md` Phase 2
- **상세**: `spec/5-system/4-execution-engine.md §9.2` 표의 `task-queue` 행에 "구현 검증 후 본 행 확정/삭제 — **Phase 2 구현 시 실제 이름 확인 후 §4.2 표 갱신**" 주석이 있다. Phase 2 (2.1~2.6) 구현 단계에서 실제 큐 이름을 확인하고 spec 을 갱신해야 하는데, 이것이 Phase 2 작업 항목 목록에 명시적으로 포함되어 있지 않다. 구현이 spec 갱신 없이 완료되면 §9.2 표에 TBD 상태가 잔존.
- **제안**: `plan/in-progress/workflow-resumable-execution.md` Phase 2 작업 목록에 "2.x — `task-queue` 실제 이름 확인 후 `spec/5-system/4-execution-engine.md §9.2` 및 §4.2 갱신" 항목 추가. 또는 Phase 2 PR 머지 전 수용 기준에 포함.

---

### [WARNING] `retry-handler-followup.md` WARNING #1/#3/#4/#5 — 미해소 spec 항목이 Phase 2 범위 파일과 중첩

- **target 위치**: `plan/in-progress/retry-handler-followup.md` WARNING #1, #3, #4, #5
- **관련 plan**: `plan/in-progress/retry-handler-followup.md` (worktree: `multiturn-error-preserve` — 해당 branch 미존재, worktree 미존재, PR 없음 → 착수 대기 중)
- **상세**: `retry-handler-followup.md` 의 WARNING #1 (`_retryState` 소비 원자성 — `spec/5-system/4-execution-engine.md` 보존 예외 섹션 명시), WARNING #3 (`INVALID_EXECUTION_STATE` 요건 — `spec/5-system/6-websocket-protocol.md §4.2` 에러 코드 표), WARNING #4 (`_retryState` 소비 마킹 정책 — 동 파일 §4.2), WARNING #5 (`_retryState.expiresAt` TTL SoT — `spec/5-system/4-execution-engine.md §7` 또는 §8) 가 모두 `project-planner` 위임 후 spec 명시 대기 중이다. 이 파일들은 Phase 2 가 구현에서 핵심적으로 사용하는 spec SoT 인 `spec/5-system/4-execution-engine.md` 와 `spec/5-system/6-websocket-protocol.md` 와 동일. Phase 2 구현이 `retry-handler-followup` 이 미지정한 spec 항목을 암묵적으로 구현하면 spec 과 코드가 어긋나거나, 나중에 `retry-handler-followup` spec 추가 시 Phase 2 코드와 충돌할 수 있다.
  - WARNING #2 는 Phase 0 에서 이미 처리됨 — `execution.retry_last_turn` 이 rehydration 경로를 타지 않는다는 점이 `spec/5-system/6-websocket-protocol.md §4.2` 에 명시됨. `retry-handler-followup.md` 에도 2026-05-24 갱신 주석 추가됨. WARNING #2 는 충돌 없음.
  - WARNING #1/#3/#4/#5 는 `spec/5-system/4-execution-engine.md` 와 `spec/5-system/6-websocket-protocol.md` 변경을 요구하는데 Phase 2 구현 착수와 순서 충돌 가능.
- **제안**: Phase 2 착수 전 `retry-handler-followup.md` WARNING #1/#3/#4/#5 에 대한 spec 명시를 `project-planner` 가 먼저 처리하거나, Phase 2 가 해당 스코프와 **겹치지 않음** 을 plan 에 명시적으로 기재. `retry-handler-followup.md` 의 착수 순서 의존성으로 "Phase 2 spec 완성 후 착수" 를 의존성 섹션에 추가.

---

### [INFO] 두 Phase worktree 가 동일 HEAD 공유 — 추적 명확화 권장

- **target 위치**: worktree `workflow-resumable-execution-phase2-a6b133` 및 `workflow-resumable-execution-6b105e`
- **관련 plan**: `plan/in-progress/workflow-resumable-execution.md`
- **상세**: 두 worktree 가 동일 commit `2b64dc04` 를 가리키고 있어 현재 기준으로 실질적으로 동일한 상태다. Phase 1 결과가 Phase 2 worktree 에 그대로 복사된 것으로 보인다. 두 branch 가 diverge 하면 plan 추적이 어려워질 수 있다.
- **제안**: Phase 2 작업은 `phase2` branch 전용으로 커밋을 쌓고, Phase 1 worktree (`6b105e`) 는 PR 생성 후 정리를 고려. 단, 현재 두 worktree 가 동일 commit 이므로 작업 자체에는 즉각 위험 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 `spec/4-nodes/6-presentation/0-common.md` 를 동시에 수정하는 세 worktree 를 발견했으나, 모두 MERGED PR 확인으로 stale 판정하여 CRITICAL 에서 제외:

- `chat-channel-e2e-hardening-5ff799` (branch `claude/chat-channel-e2e-hardening-5ff799`) — Step 2 PR #303 MERGED. 해당 worktree 가 활성으로 남아있을 이유 없음. `./cleanup-worktree-all.sh --yes --force` 실행 권장.
- `chore-stale-plan-cleanup-c7e170` (branch `claude/chore-stale-plan-cleanup-c7e170`) — Step 2 PR #302 MERGED. 동일.
- `fix-secret-store-root-entities-6aa869` (branch `claude/fix-secret-store-root-entities-6aa869`) — Step 2 PR #304 MERGED. 동일.

worktree 충돌 후보 3건 중 stale 3건 skip, active 0건 분석. 실질적 worktree 충돌 없음.

---

## 요약

Plan 정합성 관점에서 CRITICAL 항목은 없다. Phase 0 spec 갱신이 충실하게 완료되어 있고, `retry-handler-followup.md` WARNING #2 갱신도 Phase 1 worktree 에서 처리되었다. 다만 세 가지 WARNING 이 Phase 2 착수에 앞서 해소를 권장한다: (1) Phase 1.3 skip/구현 결정의 plan 명시, (2) plan frontmatter `worktree` 필드 갱신, (3) `retry-handler-followup.md` WARNING #1/#3/#4/#5 spec 항목이 Phase 2 핵심 spec 파일(`spec/5-system/4-execution-engine.md`, `spec/5-system/6-websocket-protocol.md`)과 중첩되어 있어 착수 순서 의존성 명확화 필요. `task-queue` 이름 확인·갱신이 Phase 2 수용 기준에서 누락된 점도 보완 권장. worktree 충돌 후보 3건은 모두 MERGED PR 으로 stale 판정되어 실질적 경합 위험 없음.

---

## 위험도

MEDIUM
