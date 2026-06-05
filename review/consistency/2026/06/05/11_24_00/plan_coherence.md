# Plan 정합성 검토 결과

검토 모드: impl-done (구현 완료 후 검토)
Target: `spec/5-system/` (diff-base: origin/main)
실제 변경 파일: `spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`, `spec/5-system/6-websocket-protocol.md`

---

## 발견사항

- **[INFO]** Phase B 선행 spec 의무 미이행 — D4 Rationale 명문화 누락
  - target 위치: `spec/5-system/4-execution-engine.md` §4.x / Rationale 영역
  - 관련 plan: `plan/in-progress/exec-park-durable-resume.md` "Spec 변경" 섹션 "[Phase B 선행 — 구현 착수 전 의무] D4 turn-단위 park Rationale 명문화"
  - 상세: plan 은 Phase B 코딩 착수 전 4-execution-engine.md §4.x 또는 신규 §Rationale 에 D4(turn-단위 park) 채택 근거·기각 대안을 명문화하도록 의무로 지정(consistency W4). 이번 A2a PR 의 target diff 는 schemaVersion 관련 §1.3·§7.5 변경만 포함하고 D4 Rationale 텍스트는 미포함. A2a 완료 시점이므로 당장 강제되지 않으나, Phase B 착수 전 이 텍스트를 추가해야 한다는 pending obligation 이 현재 target 에 반영되지 않은 상태.
  - 제안: Phase B PR 착수 직전 spec PR 에서 `spec/5-system/4-execution-engine.md §4.x Rationale` 에 D4 결정 배경 텍스트를 추가. target 이 A2a 전용이라면 현재 상태는 수용 가능하나, Phase B 착수 전 위 추가를 잊지 않도록 plan §Spec 변경 항목에 체크박스를 두는 것을 권장.

- **[INFO]** A2b `ai_agent 한정` 문구 3곳 여전히 spec 에 잔존
  - target 위치: `spec/5-system/4-execution-engine.md` §1.3 L111·L113·L1166
  - 관련 plan: `plan/in-progress/exec-park-durable-resume.md` §A2b "spec 'ai_agent 한정' 문구 3곳 동기 갱신 — IE 미적용→지원으로 전환"
  - 상세: plan A2b 는 `information_extractor` 의 checkpoint 지원이 추가될 때 §1.3 의 "ai_agent 한정" 문구 3곳을 갱신하도록 명시. 현재 target diff 는 A2a 범위만 처리했으므로 이 문구들이 그대로 남아 있음. 이는 예상된 상태(A2b 는 [분리, 후속]으로 명시)이나, A2b 착수 시 놓치지 않도록 추적 상태를 명확히 할 필요.
  - 제안: A2b 착수 시 해당 3곳 동기 갱신을 계획 일정에 포함. 현 상태는 정합적(A2b 미완으로 A2a 스코프 외).

- **[INFO]** Phase 0 open item — node-cancellation §2 직렬화 순서 미확정
  - target 위치: n/a (spec/5-system/ 에 직접 영향 없음)
  - 관련 plan: `plan/in-progress/exec-park-durable-resume.md` Phase 0 "node-cancellation §2 직렬화 순서·status 가드 겹침 확정" (미체크), `plan/in-progress/node-cancellation-infrastructure.md` §2 (unstarted)
  - 상세: exec-park plan 은 Phase A2/B 착수 전 node-cancellation §2(`NodeExecution.status='cancelled'` enum·재개 경로)와의 직렬화 순서를 확정하도록 Phase 0 에 명시. target spec 변경(A2a)은 이 확인 없이 진행됐으나, A2a 는 checkpoint versioning 에 국한되어 cancelled enum·재개 경로와 표면이 겹치지 않으므로 실질 충돌은 없음. 단 Phase B/A2b 착수 전에는 이 확정이 필요.
  - 제안: Phase 0 미체크 항목을 Phase B PR 착수 전 처리. node-cancellation 은 unstarted 이므로 exec-park Phase B 설계 확정 후 순서를 정해 plan 에 기록.

- **[INFO]** D2(user-defined variables 복원) 미결 — target spec 에 미반영
  - target 위치: n/a (현재 target diff 에 관련 변경 없음)
  - 관련 plan: `plan/in-progress/exec-park-durable-resume.md` §A3 "D2: user-defined variables 복원을 본 plan 범위에 포함할지, 별도 plan 분리할지"
  - 상세: D2 는 미확정 결정으로 plan 에 열려 있음. 현재 A2a target spec 에 variables 복원 내용이 없는 것은 예상된 상태이나, D2 가 "본 plan 포함" 으로 확정될 경우 추후 4-execution-engine §6.2/§7.5 에 내용이 추가돼야 한다. 충돌은 없으나 추적 목적으로 기록.
  - 제안: 사용자/planner 결정 후 plan A3 체크박스 업데이트.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `spec-frontmatter-status-migration-027c17` (branch `spec-frontmatter-status-migration-027c17`) — Step 2 PR #356 MERGED
- `ai-context-memory-9c7e6e` (branch `ai-context-memory-9c7e6e`) — Step 2 PR #459 MERGED
- `spec-sync-audit` (branch `spec-sync-audit`) — Step 2 PR #443 MERGED
- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 2 PR #451 MERGED
- `impl-exec-concurrency-cap` (branch `impl-exec-concurrency-cap`) — Step 2 PR #469 MERGED
- `rag-rerank-impl` (branch `rag-rerank-impl`) — Step 2 PR #465 MERGED
- `rag-rerank-decisions-dd1d68` (branch `rag-rerank-decisions-dd1d68`) — Step 2 PR #460 MERGED
- `spec-exec-intake-queue` (branch `spec-exec-intake-queue`) — Step 2 PR #458 MERGED
- `workflow-turn-timing-69fee2` (branch `workflow-turn-timing-69fee2`) — Step 2 PR #445 MERGED
- `followup-conversation-reconcile` (branch `claude/followup-conversation-reconcile`) — Step 2 PR #429 MERGED
- `continuation-worker-concurrency-env` (branch `claude/continuation-worker-concurrency-env`) — Step 2 PR #411 MERGED
- `conventions-code-data-9b32d5` (branch `conventions-code-data-9b32d5`) — Step 2 PR #433 MERGED

위 stale worktree 들은 모두 MERGED PR 로 종결됐음에도 `plan/in-progress/` 파일에 여전히 worktree 참조로 남아 있음. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/5-system/` 의 이번 변경(A2a: checkpoint schemaVersion 추가, `RESUME_INCOMPATIBLE_STATE` 케이스 확장, 초대 에러코드 historical-artifact 주석)은 in-progress plan 의 어떤 미해결 결정과도 직접 충돌하지 않는다. 변경된 4개 파일을 동시에 수정하는 active(non-stale) worktree는 대상 worktree(`exec-park-durable-resume`) 자신뿐이며 경합 없음. 발견된 항목 전부 INFO 등급으로, Phase B 착수 전에 처리해야 할 pending obligation(D4 Rationale 명문화, node-cancellation §2 순서 확정) 을 추적 목적으로 기록. worktree 충돌 후보 12건 전부 stale 판정(MERGED PR)으로 skip.

---

## 위험도

LOW
