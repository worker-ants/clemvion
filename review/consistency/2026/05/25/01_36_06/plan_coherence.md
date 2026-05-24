# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
대상 spec: `spec/5-system/15-chat-channel.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/6-websocket-protocol.md`
검토 일시: 2026-05-25

---

## 발견사항

### [WARNING] `spec/5-system/6-websocket-protocol.md` 를 ACTIVE worktree 가 이미 수정 중 — 미PR 상태

- **target 위치**: `spec/5-system/6-websocket-protocol.md` 전체 (impl-prep 대상 파일)
- **관련 plan**: `plan/in-progress/workflow-resumable-execution.md` (worktree `workflow-resumable-execution-6b105e` / `workflow-resumable-execution-phase2-a6b133`, 두 worktree 가 동일 HEAD `2b64dc04` 공유)
- **상세**:
  - worktree `workflow-resumable-execution-6b105e` 가 Phase 0 spec 작업으로 `spec/5-system/6-websocket-protocol.md` 에 이미 변경을 가해 놓았으나 PR 이 아직 미발행 상태다. main 기준 파일 크기 843 라인 vs worktree 851 라인 (8행 추가).
  - 변경 내용: `execution.click_button.ack` 의 `queued: boolean` 선택 필드 추가, `RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE` 에러 코드 3개 추가 및 적용 범위 주석. 범위는 §4.2 (click_button / submit_form / submit_message / end_conversation ack 공통).
  - 본 impl-prep 가 바라보는 `spec/5-system/6-websocket-protocol.md` 는 **workflow-resumable 변경이 반영되지 않은 main HEAD 기준**이다. 구현 착수 시 spec 의 ack 계약이 다르다고 인식할 수 있어 혼선 위험 있음.
  - stale 판정 cascade: Step 1 ACTIVE (non-ancestor), Step 2 "no PR" — Fallback active 처리.
- **제안**: workflow-resumable Phase 0 spec 변경분이 PR 로 merge 된 뒤 impl-prep 를 다시 실행하거나, 해당 worktree 의 변경 내용을 확인하고 impl-prep scope 내에 WS protocol 관련 항목이 없음을 명시적으로 확인 후 진행. 두 worktree 가 동일 HEAD 를 공유하므로 한 쪽만 PR 을 내면 됨.

---

### [WARNING] `spec/5-system/6-websocket-protocol.md §4.4` — 미해결 결정 존재 (spec-drift-ws-button-config)

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §4.4 (`buttonConfig.timeout` / `timeoutAction` / `nodeOutput.type`)
- **관련 plan**: `plan/in-progress/spec-drift-ws-button-config.md` (worktree `pending-assignment`, project-planner 결정 대기)
- **상세**:
  - `spec-drift-ws-button-config.md` 는 `6-websocket-protocol.md §4.4` 에 있는 `buttonConfig.timeout` / `timeoutAction` 예시가 `spec/4-nodes/6-presentation/0-common.md §3`의 "타임아웃 없음" 정책과 직접 모순됨을 기록하고 있으며, 해결 방향 (A) vs (B) 가 project-planner 결정을 기다리고 있다. 마찬가지로 `buttonConfig.nodeOutput.type` 래퍼 판별자도 Presentation 공통 규약 Principle 1.1.4 와 충돌.
  - impl-prep 대상에 `6-websocket-protocol.md` 가 포함되어 있어, 해당 §4.4 의 모순된 예시가 구현 기준으로 잘못 채택될 위험이 있음.
  - worktree 는 `pending-assignment` — 아직 worktree 미생성.
- **제안**: `spec/5-system/6-websocket-protocol.md §4.4` 부분을 impl 에서 참조하는 경우 `spec-drift-ws-button-config.md` 에 기술된 모순(C2/C3)을 인지하고 (A) 안을 잠정 채택으로 진행하거나, project-planner 에게 결정을 요청한 뒤 착수. 구현 범위가 §4.4 와 무관하다면 INFO 수준으로 격하 가능.

---

### [WARNING] `spec/5-system/6-websocket-protocol.md §4.2` — retry-handler-followup W1~W5 미반영

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §4.2 (`execution.retry_last_turn` Continuation Bus 경유 여부, `INVALID_EXECUTION_STATE` 사전 검증 요건 등)
- **관련 plan**: `plan/in-progress/retry-handler-followup.md` WARNING #1~#5 (모두 project-planner 위임 대기)
- **상세**:
  - `retry-handler-followup.md` 의 W1 (`_retryState` 소비 원자성), W2 (`execution.retry_last_turn` Continuation Bus 경유 여부), W3 (`INVALID_EXECUTION_STATE` 사전 검증), W4 (`_retryState` 소비 마킹 방법), W5 (`_retryState.expiresAt` TTL SoT) 다섯 항목이 모두 `spec/5-system/6-websocket-protocol.md §4.2` (일부는 `spec/5-system/4-execution-engine.md`) 에 반영되길 기다리고 있다. project-planner 위임 완료 전까지 spec 내 이 부분은 결정 미확정.
  - 추가로 `workflow-resumable-execution.md` 는 "WARNING #2 (`execution:continuation` 채널 표기) 는 본 작업으로 BullMQ 큐로 교체됨 — retry-handler-followup §4.2 작성 시 BullMQ `execution-continuation` 기준으로 작성" 이라는 연동 주석을 남겼지만, 이 주석이 main 의 `retry-handler-followup.md` 에 아직 추가되지 않았다. 두 plan 이 6-websocket-protocol.md §4.2 를 동일 영역에서 병렬 편집할 시 내용 충돌 가능성.
- **제안**: impl-prep 범위가 `retry_last_turn` WS 흐름 또는 Continuation Bus 관련 구현을 포함한다면 project-planner 에게 W1~W5 spec 명시를 선행 요청. 범위와 무관한 구현이라면 경고만 기록하고 진행 가능. `retry-handler-followup.md` 에도 workflow-resumable 의 BullMQ 전환 사실 한 줄 추가 필요 (plan 상호 참조 누락).

---

### [INFO] `plan/in-progress/trigger-list-chat-channel-ui.md` — PR #283 MERGED 이나 plan 이 complete/ 미이동

- **target 위치**: `spec/5-system/15-chat-channel.md` (pending_plans 에 영향)
- **관련 plan**: `plan/in-progress/trigger-list-chat-channel-ui.md` (worktree `trigger-list-chat-channel-ui-d0c4a3`, PR #283 MERGED, worktree 디렉토리 이미 삭제됨)
- **상세**: `trigger-list-chat-channel-ui-d0c4a3` worktree 는 물리적으로 존재하지 않고 PR #283 은 MERGED 완료. 그러나 plan 파일이 `plan/in-progress/` 에 잔류 중. `spec/5-system/15-chat-channel.md` frontmatter `pending_plans` 에는 `trigger-list-chat-channel-ui` 가 없으므로 spec frontmatter 충돌은 없으나, plan 라이프사이클 정책(`plan-lifecycle.md`) 위반.
- **제안**: `plan/in-progress/trigger-list-chat-channel-ui.md` 를 `plan/complete/` 로 `git mv` 이동 처리.

---

### [INFO] `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` — PR #281 MERGED 이나 plan 이 complete/ 미이동

- **target 위치**: `spec/5-system/15-chat-channel.md` (pending_plans 에 영향)
- **관련 plan**: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` (worktree `telegram-chat-channel-spec-polish-49c49b`, PR #281 MERGED)
- **상세**: PR #281 이 MERGED 완료되어 결정 4건이 모두 spec 에 반영됐으나 plan 이 `plan/in-progress/` 에 잔류. `spec/5-system/15-chat-channel.md` frontmatter `pending_plans` 에는 이 plan 이 없어 spec 충돌은 없으나, plan 라이프사이클 위반.
- **제안**: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` 를 `plan/complete/` 로 이동.

---

### [INFO] `spec/5-system/15-chat-channel.md` frontmatter `pending_plans` — chat-channel-dispatcher-split 참조 상태 혼재

- **target 위치**: `spec/5-system/15-chat-channel.md` frontmatter `pending_plans[0]` = `plan/in-progress/chat-channel-dispatcher-split.md`
- **관련 plan**: `plan/in-progress/chat-channel-dispatcher-split.md` (status `in-progress`, worktree `chat-channel-dispatcher-split-impl-d7c3ea` — Step 2: MERGED)
- **상세**: `chat-channel-dispatcher-split.md` 는 `plan/in-progress/` 와 `plan/complete/` 양쪽 모두에 존재 (`plan/complete/chat-channel-dispatcher-split.md` 확인). spec frontmatter `pending_plans` 는 `plan/in-progress/` 경로를 참조. `chat-channel-dispatcher-split-impl-d7c3ea` worktree 의 PR 은 MERGED 이나, plan 내 status 는 `in-progress (R8 v2 per-trigger listener 정책 적용 — 2026-05-24)` 로 실질 in-progress 로 기록되어 있다. `plan/complete/` 사본이 새 버전인지 확인 필요.
- **제안**: `plan/complete/chat-channel-dispatcher-split.md` 와 `plan/in-progress/chat-channel-dispatcher-split.md` 의 내용을 비교해 실제 완료 상태를 확인. 완료됐으면 in-progress 버전 삭제 + spec frontmatter `pending_plans` 에서 해당 행 제거. 완료 미확인이면 plan 상태 명문화.

---

### [INFO] `spec/5-system/11-mcp-client.md` — 정합 이슈 없음

- **상세**: 모든 활성 worktree 중 `spec/5-system/11-mcp-client.md` 를 수정하는 worktree 없음. spec 의 `status: spec-only` 유지, 충돌 plan 없음.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

**`spec/5-system/15-chat-channel.md` 후보 8건 — 전부 stale skip:**

- `ai-agent-formdata-size-limit-2ad8ff` (branch `claude/ai-agent-formdata-size-limit-2ad8ff`) — Step 2: PR #(MERGED)
- `chat-channel-e2e-hardening-5ff799` (branch `claude/chat-channel-e2e-hardening-5ff799`) — Step 2: PR MERGED
- `chat-channel-unverified-owner-e2e-d74fda` (branch `claude/chat-channel-unverified-owner-e2e-d74fda`) — Step 2: PR MERGED
- `chat-channel-validation-constants-e9e037` (branch `claude/chat-channel-validation-constants-e9e037`) — Step 2: PR MERGED
- `chore-stale-plan-cleanup-c7e170` (branch `claude/chore-stale-plan-cleanup-c7e170`) — Step 2: PR #302 MERGED
- `fix-secret-store-root-entities-6aa869` (branch `claude/fix-secret-store-root-entities-6aa869`) — Step 2: PR MERGED
- `password-hash-format-guard-60f7f2` (branch `claude/password-hash-format-guard-60f7f2`) — Step 2: PR #307 MERGED
- `trigger-create-multi-provider-ui-plan-677f12` (branch `claude/trigger-create-multi-provider-ui-plan-677f12`) — Step 2: PR MERGED

**`spec/5-system/6-websocket-protocol.md` 후보 중 skip된 것: 없음 (2건 모두 ACTIVE 판정)**

위 8개 worktree 는 PR merge 완료 후에도 로컬 worktree 가 남아 있어 cleanup 이 필요하다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

**`spec/5-system/6-websocket-protocol.md` ACTIVE 후보 2건:**

- `workflow-resumable-execution-6b105e` (branch `claude/workflow-resumable-execution-6b105e`) — Step 1: ACTIVE (non-ancestor), Step 2: no PR
- `workflow-resumable-execution-phase2-a6b133` (branch `claude/workflow-resumable-execution-phase2-a6b133`) — Step 1: ACTIVE (non-ancestor), Step 2: no PR

두 worktree 가 동일 HEAD `2b64dc04` 를 공유하므로 실질적으로 동일한 spec 변경 1건. 위 [WARNING] 로 보고.

---

## 요약

`spec/5-system/15-chat-channel.md` 에 대해서는 worktree 충돌 후보 8건 모두 MERGED stale 로 skip 되어 현재 impl-prep 의 정합을 막는 active 경합은 없다. `spec/5-system/11-mcp-client.md` 는 어떤 활성 worktree도 손대지 않으며 unresolved 결정도 없다. 반면 `spec/5-system/6-websocket-protocol.md` 는 두 가지 우려가 겹친다: (1) `workflow-resumable-execution` worktree 가 §4.2 에 `queued` 필드·`RESUME_*` 에러 코드를 추가한 채 PR 미발행 상태로 활성 경합 중이고, (2) `spec-drift-ws-button-config` plan 이 §4.4 에 project-planner 결정이 필요한 미해결 모순을 남겨 두고 있다. impl-prep 범위가 WS ack 계약 또는 button/form 대기 흐름을 건드린다면 두 선행 사안을 해소한 뒤 착수해야 한다. plan 라이프사이클 위반 2건 (PR #281·#283 plan 미이동) 과 dispatcher-split plan 상태 혼재 1건은 INFO 수준 정리 대상. worktree 충돌 후보 10건 중 stale 8건 skip, active 2건 분석.

---

## 위험도

MEDIUM
