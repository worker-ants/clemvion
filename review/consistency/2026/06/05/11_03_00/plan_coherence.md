# Plan 정합성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
Target 범위: `spec/5-system/` 전체
검토 기준일: 2026-06-05

---

## 발견사항

- **[INFO]** exec-park-durable-resume plan 의 A2/B Phase 가 spec/5-system/ 변경을 예고하고 있음 (후속 미착수 항목)
  - target 위치: `spec/5-system/4-execution-engine.md` §4.x(park 즉시 해제 서술), §7.4(fast-path 제거), §7.5(rehydration 무손실 보장)
  - 관련 plan: `plan/in-progress/exec-park-durable-resume.md` §Spec 변경 섹션 — "Phase B 선행 의무: D4 turn-단위 park Rationale 명문화 (W4)", "fast-path 제거 반영 (W5/I2)"
  - 상세: exec-park-durable-resume plan 은 A1(완료)·A2a(완료) 이후 B Phase(B1/B2/B3) 구현 전 `4-execution-engine.md §4.x`에 Rationale(turn-단위 park 채택 근거·기각 대안) 명문화를 "구현 착수 전 의무"로 명시했다. target `spec/5-system/` 의 현재 상태(A1/A2a 반영 후)가 이 약속을 아직 이행하지 않은 상태라면, B Phase 착수 전 spec 작성이 누락된 후속 항목이다. 단 이는 B Phase 착수 전 시점이므로 현재 `--impl-done` (A2a 완료 후) 검토 시점에서는 허용 범위.
  - 제안: B Phase 착수 직전 `4-execution-engine.md §4.x`(또는 신규 §Rationale) 에 "대화 전체=단일 waiting 대비 turn-단위 park 채택 근거" 기록이 이행되는지 착수 시 확인할 것. 본 검토 시점에서는 차단 불필요.

- **[INFO]** exec-intake-queue-impl plan 의 PR3 항목이 본 plan 에 흡수되었으나 plan 문서 cross-link 이관 표기 미완
  - target 위치: `plan/in-progress/exec-park-durable-resume.md` §Phase 0
  - 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` — PR3(rehydration 일반화 + 멱등 재개)
  - 상세: exec-park-durable-resume plan 은 Phase 0에서 "출처 plan(exec-intake-queue PR3·node-cancellation §2) 항목 이관 표기 + cross-link (planner)" 를 미완료([ ] 체크박스) 상태로 두고 있다. exec-intake-queue-impl.md 의 worktree(`impl-exec-intake-queue`) 는 PR #463 로 MERGED 되어 stale 이지만, PR3 항목 자체(rehydration 일반화)는 현재 exec-park-durable-resume Phase A2/B2 로 이관 예정이다. plan 문서에 이관 표기가 없으면 후속 개발자가 중복 착수할 위험이 있다.
  - 제안: exec-intake-queue-impl.md 의 PR3 항목에 "→ exec-park-durable-resume Phase A2/B2 로 이관" 주석을 project-planner 가 추가하면 명확해진다. (plan frontmatter 로 추적 중이므로 BLOCK 불필요.)

- **[INFO]** node-cancellation-infrastructure plan §2(`NodeExecution.status='cancelled'` + 재개 경로)가 exec-park-durable-resume Phase 0 에서 직렬화 순서 확정을 요구하나 미확정
  - target 위치: `plan/in-progress/exec-park-durable-resume.md` §Phase 0 체크박스 "node-cancellation §2 와의 직렬화 순서·status 가드 겹침 확정"
  - 관련 plan: `plan/in-progress/node-cancellation-infrastructure.md` §2 (미착수, worktree: unstarted)
  - 상세: exec-park-durable-resume plan 은 A2/B 착수 전에 node-cancellation §2 와의 직렬화 순서를 확정하도록 Phase 0 체크박스에 명시했다. 이 확정이 이루어지지 않은 채 B Phase 가 착수되면 `NodeExecution.status` 가드 로직에서 두 plan 이 충돌할 수 있다. 현재 node-cancellation-infrastructure 는 worktree 미착수 상태이므로 실제 경합은 없으나, B Phase 착수 전 선행 확정이 필요하다.
  - 제안: B Phase 착수 직전 사용자/planner 가 직렬화 순서(cancellation §2 선행 vs 후행)를 결정하고 Phase 0 체크박스를 닫을 것. 현재 시점에서는 경합 없음.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 검토 결과, `spec/5-system/` 을 직접 수정하는 활성 worktree 는 발견되지 않았다. 아래는 충돌 후보로 식별되었으나 stale 판정으로 제외된 worktree 목록이다:

- `impl-exec-intake-queue` (branch `claude/impl-exec-intake-queue`) — Step 2 PR #463 MERGED (squash merge)
- `spec-exec-intake-queue` (branch `claude/spec-exec-intake-queue`) — Step 2 PR #458 MERGED
- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 2 PR #451 MERGED (spec `4-execution-engine.md` §6.1 SPEC-DRIFT 반영 후 종결)
- `fix-spec-frontmatter-catalog` (branch `claude/fix-spec-frontmatter-catalog`) — Step 2 PR #453 MERGED
- `spec-frontmatter-status-migration-027c17` (branch `claude/spec-frontmatter-status-migration-027c17`) — Step 2 PR #356 MERGED
- `continuation-worker-concurrency-env` (branch `claude/continuation-worker-concurrency-env`) — Step 2 PR #411 MERGED
- `spec-sync-audit` (branch `claude/spec-sync-audit`) — Step 2 PR #443 MERGED
- `agent-memory-embedding-model` (branch `claude/agent-memory-embedding-model`) — Step 2 PR state MERGED (Step 1 non-ancestor, Step 2 확인)
- `agent-memory-summary-model-fa4efb` (branch `claude/agent-memory-summary-model-fa4efb`) — Step 1 ancestor 확인 (STALE)

위 worktree 중 `spec/5-system/` 을 수정한 것들(exec-intake-queue, spec-sync-audit 등)은 모두 PR merge 로 종결된 stale 상태이며, target spec 영역과의 실제 경합은 없다.

해당 worktree들이 물리적으로 남아있다면 `./cleanup-worktree-all.sh --yes --force` 실행을 권장한다.

---

## 요약

`spec/5-system/` 범위(1-auth, 10-graph-rag, 11-mcp-client 등)의 현재 상태는 exec-park-durable-resume plan 의 A1·A2a Phase 완료(PR #470, A2a commit) 이후 `--impl-done` 검토 대상이다. 이 Phase 들은 주로 `4-execution-engine.md`(§6.2/§7.5/§4.x)·`conversation-thread.md`·`1-data-model.md`·`1-ai-agent.md` 를 수정하였으며, auth(1-auth), graph-rag(10-graph-rag), mcp-client(11-mcp-client) 는 별도 미해결 plan(`auth-config-webhook-followups`, `spec-sync-auth-gaps`, `spec-sync-mcp-client-gaps`)이 pending_plans 로 등재된 상태를 유지하고 있다. 미해결 결정(D2: user-defined variables, D3: park 중 편집 정책)은 target spec 과 충돌하지 않으며, B Phase 착수 전 spec Rationale 명문화 의무만 이행되면 정합성 위험 없음. worktree 충돌 후보 9건 모두 stale(PR merged) 확인 — active 충돌 0건.

---

## 위험도

NONE
