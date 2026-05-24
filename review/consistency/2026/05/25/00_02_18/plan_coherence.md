# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
Target 경로: `spec/5-system/`
검토 수행 worktree: `workflow-resumable-execution-6b105e`

---

## 발견사항

### 발견사항 1

- **[WARNING]** `retry-handler-followup.md` 후속 항목이 workflow-resumable-execution Phase 0 완료 후 갱신되지 않음
  - target 위치: `spec/5-system/6-websocket-protocol.md §4.2` (본 worktree 에서 Phase 0 완료)
  - 관련 plan: `plan/in-progress/retry-handler-followup.md` WARNING #2 — "`execution.retry_last_turn` Continuation Bus 경유 여부" 항목
  - 상세: `retry-handler-followup.md` WARNING #2 는 `spec/5-system/6-websocket-protocol.md §4.2` 에 `execution.retry_last_turn` 의 Continuation Bus(`execution:continuation` **Redis pub/sub 채널**) 경유 여부를 명시하도록 `project-planner` 에게 위임하고 있다. 그러나 `workflow-resumable-execution` Phase 0 에서 이미 해당 채널을 BullMQ `execution-continuation` 큐로 전면 교체하고 §4.2 에 `RESUME_*` 에러 코드 3종 + `queued: boolean` 필드를 추가했다. `retry-handler-followup.md` 는 아직 옛 "Redis pub/sub 채널" 전제로 WARNING #2 를 기술 중이며, `workflow-resumable-execution` 플랜 자체가 "retry-handler-followup.md 에 한 줄 추가 필요" 를 '다음 단계 §3' 에 명시했지만 실제로 추가되지 않은 상태이다. 이 상태에서 `retry-handler-followup` 작업자가 WARNING #2 를 그대로 이행하면 이미 BullMQ 로 교체된 채널 기반으로 잘못된 spec 변경이 발생할 수 있다.
  - 제안: `plan/in-progress/retry-handler-followup.md` WARNING #2 항목에 "본 WARNING 의 전제인 `execution:continuation` Redis 채널은 `workflow-resumable-execution` (Phase 0, 2026-05-24) 에서 BullMQ `execution-continuation` 큐로 교체됨. §4.2 작성 시 BullMQ 큐 기준으로 작성할 것" 한 줄을 추가해야 한다. `plan/in-progress/workflow-resumable-execution.md §다음 단계 3` 항목의 미이행 후속 조치이므로 해당 체크박스도 함께 이행 필요.

---

### 발견사항 2

- **[WARNING]** `2fa-webauthn-followups.md` 의 WebAuthn e2e·mobile 검증 항목이 `spec/5-system/1-auth.md` 의 구현 전제와 충돌 없으나, plan worktree 가 TBD 로 미확정인 상태에서 구현 착수 시 spec 기준 변경 위험
  - target 위치: `spec/5-system/1-auth.md §1.4.4`, §5 API 표, Rationale §1.4.I~§1.4.H
  - 관련 plan: `plan/in-progress/2fa-webauthn-followups.md` 항목 2 (백엔드 e2e), 항목 3 (mobile 검증)
  - 상세: `spec/5-system/1-auth.md` 에 포함된 모든 spec 변경 항목(§1.1.A, §1.4.2, §1.4.4, §1.4.G, §1.4.H, §1.4.I 등)은 `2fa-webauthn-followups.md` 에서 모두 `[x]` 완료 처리되어 target spec 과 plan 이 정합하다. 단, 항목 2 (WebAuthn e2e) 와 항목 3 (mobile Safari 수동 검증) 은 여전히 미완료(`[ ]`) 상태이며 codebase 변경을 동반한다. plan 의 `worktree: TBD` 는 아직 worktree 가 생성되지 않았음을 의미한다. 이 상태에서 해당 worktree 가 생성되고 구현에 착수할 경우, SDD 절차상 `developer` 가 `consistency-check --impl-prep` 을 다시 수행해야 한다. 본 검토 결과가 그 시점의 baseline 으로 재활용될 수 없음을 plan 에 명시해야 한다.
  - 제안: `plan/in-progress/2fa-webauthn-followups.md` 항목 2/3 착수 직전 `developer` 가 `consistency-check --impl-prep spec/5-system/` 를 독립적으로 재실행하도록 비고 한 줄 추가 권장. 현재 spec 정합성 이슈는 없으나 추적 목적.

---

### 발견사항 3

- **[INFO]** `spec-overview-followups-2026-05-18.md` plan 이 `completed: 2026-05-21` 로 표기됐으나 아직 `plan/in-progress/` 에 잔류 중
  - target 위치: 해당 없음 (spec/5-system/ 미포함)
  - 관련 plan: `plan/in-progress/spec-overview-followups-2026-05-18.md` — frontmatter `completed: 2026-05-21`
  - 상세: plan 본문에 `worktree: spec-overview-followups-bundle` 이 명시됐으나 git worktree 목록에 해당 worktree 가 존재하지 않으며, 브랜치 `spec-overview-followups-bundle` 도 원격에 없다. PR 매핑이 확인되지 않는다 (Step 2 fallback — 브랜치가 로컬에도 없어 PR 조회 불가). 단, plan 에 `completed: 2026-05-21` 이 명시되고 남은 task 는 "PR + merge" 체크박스뿐이며, 이미 `plan/complete/` 이동이 누락된 상태다. spec/5-system/ 에 직접 영향 없다.
  - 제안: `plan/in-progress/spec-overview-followups-2026-05-18.md` 을 `plan/complete/` 로 `git mv` 처리 권장. 본 검토 차단 요인 아님.

---

### 발견사항 4

- **[INFO]** `retry-handler-followup.md` 의 worktree 로 선언된 `multiturn-error-preserve` 브랜치가 PR #289 MERGED 로 stale
  - target 위치: 해당 없음 (직접 충돌 없음)
  - 관련 plan: `plan/in-progress/retry-handler-followup.md` — `worktree: multiturn-error-preserve`
  - 상세: `retry-handler-followup.md` 는 `worktree: multiturn-error-preserve` 로 선언됐으나 PR #289 (squash merge) 로 인해 해당 브랜치가 stale 상태다(Step 1 ACTIVE, Step 2 PR #289 MERGED). `retry-handler-followup` 는 아직 미완료 plan 이며 실제 구현 worktree 는 새로 생성해야 한다. 현재 stale worktree 선언이 오해를 줄 수 있다.
  - 제안: `retry-handler-followup.md` frontmatter 의 `worktree: multiturn-error-preserve` 를 `worktree: TBD` (또는 신규 worktree 이름) 로 갱신 권장. cleanup-worktree-all.sh 로 stale worktree 정리 후 재할당.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

1. `chat-channel-dispatcher-split-impl-d7c3ea` (branch `claude/chat-channel-dispatcher-split-impl-d7c3ea`) — Step 1 ACTIVE (squash merge 로 ancestor 아님), Step 2 PR #310 MERGED. `spec/5-system/15-chat-channel.md` 만 수정 — target 영역(`1-auth`, `10-graph-rag`, `11-mcp-client`, `12-webhook`) 과 파일 겹침 없어 충돌 없음. Stale.

2. `trigger-create-multi-provider-ui-plan-677f12` (branch `claude/trigger-create-multi-provider-ui-plan-677f12`) — Step 1 ACTIVE, Step 2 PR #308 MERGED. `spec/5-system/15-chat-channel.md` 만 수정 — 충돌 없음. Stale.

3. `telegram-chat-channel-spec-polish-49c49b` (branch `claude/telegram-chat-channel-spec-polish-49c49b`) — Step 1 ACTIVE, Step 2 PR #281 MERGED. `spec/5-system/12-webhook.md` 를 수정하나 plan 의 open item(`[ ]`) 이 0건이며 PR 이 이미 병합됨. Stale.

4. `worktree-multiturn-error-preserve` (branch `worktree-multiturn-error-preserve`) — Step 1 ACTIVE (squash merge 로 ancestor 아님), Step 2 PR #289 MERGED. stale 으로 skip. `retry-handler-followup.md` 의 worktree 선언에서 참조되고 있어 발견사항 4 에 INFO 로 기록.

5. `harness-spec-impl-coverage-befc2f` (branch `claude/harness-spec-impl-coverage-befc2f`) — Step 1 ACTIVE, Step 2 PR #287 MERGED. Stale.

6. `spec-followup-cron-7d-statemachine-868886` (branch `claude/spec-followup-cron-7d-statemachine-868886`) — Step 1 ACTIVE, Step 2 PR #216 MERGED. Stale.

위 stale worktree 들이 파일시스템에 잔류하고 있다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/5-system/` 범위의 구현 착수 전 plan 정합성 검토 결과, 직접적인 CRITICAL 수준의 충돌(미해결 결정 우회·active worktree 경합)은 발견되지 않았다. 현재 활성 worktree 중 `spec/5-system/4-execution-engine.md` 또는 `spec/5-system/6-websocket-protocol.md` 를 동시에 수정 중인 타 worktree 는 없다. 다만 두 건의 WARNING 이 존재한다: (1) `retry-handler-followup.md` 의 WARNING #2 가 이미 교체된 Redis 채널 전제로 spec §4.2 갱신을 지시하고 있어, `workflow-resumable-execution` Phase 0 완료 사실을 해당 plan 에 반영해야 한다. (2) `2fa-webauthn-followups` 의 미완료 구현 항목(e2e·mobile)이 새 worktree 착수 시 impl-prep 재실행 필요성을 plan 에 추가 표기해야 한다. worktree 충돌 후보 6건은 Step 2(PR state MERGED)로 모두 stale 확인되어 skip 처리됐으며, 유효 충돌 0건이다.

---

## 위험도

LOW
