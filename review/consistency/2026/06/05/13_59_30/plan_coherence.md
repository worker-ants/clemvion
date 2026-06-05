# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep, scope=spec/5-system/)
Target 문서: spec/5-system/ (1-auth.md, 10-graph-rag.md, 11-mcp-client.md 포함)
검토 worktree: exec-park-durable-resume (branch: claude/exec-park-phaseb)

---

## 발견사항

- **[INFO]** auth-config-webhook-followups 미해결 항목과 spec/5-system/1-auth.md 간 미이행 gap 존재
  - target 위치: spec/5-system/1-auth.md §4.1 (감사 로그 대상 열거), §5 API 엔드포인트 표
  - 관련 plan: plan/in-progress/auth-config-webhook-followups.md §1/§3 (worktree: unstarted, status: backlog)
  - 상세: 본 --impl-prep 의 scope 는 spec/5-system/ 전체이며 1-auth.md 가 포함된다. auth-config-webhook-followups.md §1 은 AuthConfig CRUD 감사 로그(create/update/delete/regenerate) 누락, §3 은 spec/5-system/1-auth.md §5 에 `POST /api/auth-configs/:id/reveal` 행 미등재, §5 API rate limiting 미명시 등 spec 보완 항목을 "project-planner 위임 필요"로 열어두고 있다. 현재 해당 plan 이 unstarted/backlog 상태이므로 spec/5-system/1-auth.md 의 이들 서술 gap 이 아직 미정합 상태다. 단, exec-park-durable-resume 은 1-auth.md 를 직접 수정하지 않으므로 직접 충돌은 없다. 범위 내 파일 참조 시 주의 필요.
  - 제안: 본 plan(exec-park-durable-resume)의 구현 착수에 차단 없음. 단 auth-config-webhook-followups §3 항목은 project-planner 가 별도 처리해야 한다.

- **[INFO]** spec-sync-auth-gaps(LDAP/SAML) 미구현 표면이 spec/5-system/1-auth.md §1.3 에 잔존
  - target 위치: spec/5-system/1-auth.md §1.3 "셀프 호스팅 추가 인증 (미구현 · Planned)"
  - 관련 plan: plan/in-progress/spec-sync-auth-gaps.md (worktree: spec-sync-audit)
  - 상세: 1-auth.md 의 LDAP/SAML 섹션은 "미구현" 로 명시 표시되어 있고 spec-sync-auth-gaps.md 가 pending_plans 에 등록되어 있다. exec-park-durable-resume 은 1-auth.md 를 건드리지 않으므로 직접 충돌 없음. 상태 모니터링 용도의 INFO.
  - 제안: 본 plan 에 영향 없음.

- **[INFO]** spec-sync-mcp-client-gaps 미구현 항목이 spec/5-system/11-mcp-client.md 에 잔존
  - target 위치: spec/5-system/11-mcp-client.md §3.3(capabilities 캐시), §6.2(mcpDiagnostics 미구현 표면), §8.2(MCP_TIMEOUT 미구현)
  - 관련 plan: plan/in-progress/spec-sync-mcp-client-gaps.md (pending_plans 에 등재)
  - 상세: 11-mcp-client.md 는 여러 "미구현(Planned)" 항목을 inline 으로 표시하며 spec-sync-mcp-client-gaps.md 가 이를 추적 중이다. exec-park-durable-resume 은 11-mcp-client.md 를 수정하지 않으므로 직접 충돌 없음.
  - 제안: 본 plan 에 영향 없음.

- **[WARNING]** exec-park-durable-resume(Phase B 미착수) 과 exec-intake-queue-impl(PR3 미구현 흡수) 의 spec/5-system/4-execution-engine.md 동시 수정 가능성
  - target 위치: spec/5-system/4-execution-engine.md (exec-park-durable-resume 의 Phase B spec 변경 대상)
  - 관련 plan: plan/in-progress/exec-intake-queue-impl.md PR3 (worktree: impl-exec-intake-queue, branch: claude/impl-exec-intake-queue)
  - 상세: exec-park-durable-resume plan 은 Phase B 착수 전 spec §4.x(park 즉시 해제+slow-path 일원화) 및 §7.4/§7.5 갱신을 예고한다. exec-intake-queue-impl PR3("크래시 RUNNING checkpoint 재개 + rehydration 일반화")는 §7.5 rehydration 섹션을 공유 수정 대상으로 포함한다. 두 plan 모두 active(PR state: OPEN/unmerged)이며 같은 파일의 overlapping 섹션을 수정할 수 있다. exec-park-durable-resume plan 자체가 "PR3 의 rehydration 일반화는 본 plan A2/B2 에서 직접 구현"으로 흡수 선언을 했으나, exec-intake-queue-impl 의 worktree `impl-exec-intake-queue` 는 여전히 ACTIVE(Step 1/2 모두 non-stale)이고 해당 계획이 별도로 PR3 작업을 진행할 경우 동일 섹션 경합이 발생할 수 있다.
  - 제안: Phase B 착수 전 exec-intake-queue-impl PR3 착수 여부를 사용자/developer 와 명시적으로 조율하거나, exec-intake-queue-impl 의 PR3 박스를 "exec-park-durable-resume 으로 이관됨" 으로 표기(plan 상호 cross-link 완료 여부 확인)해 이중 착수를 방지한다. exec-park-durable-resume plan §Phase 0 에 이미 이관 의도가 명시되어 있으나, exec-intake-queue-impl 측 plan 에도 동일한 이관 표기가 완료되었는지 확인 필요.

- **[INFO]** node-cancellation-infrastructure §2 와의 직렬화 순서 미확정 항목이 plan 내 미결로 남아있음
  - target 위치: spec/5-system/4-execution-engine.md (Phase B 수정 예정 영역)
  - 관련 plan: plan/in-progress/node-cancellation-infrastructure.md §2 (worktree: unstarted)
  - 상세: exec-park-durable-resume §Phase 0 에 "node-cancellation §2(`NodeExecution.status='cancelled'` enum·재개 경로)와의 직렬화 순서·status 가드 겹침 확정" 항목이 미완료([ ] 상태)로 남아있다. node-cancellation §2 자체는 worktree unstarted 이므로 현재 active worktree 충돌은 없으나, exec-park-durable-resume Phase B2(재개=항상 rehydration)에서 `NodeExecution.status` 가드를 건드릴 때 직렬화 순서가 사전에 확정되지 않으면 spec 정합성 문제가 생길 수 있다. 이는 plan 에 미해결로 명시된 선행 조건이다.
  - 제안: Phase 0 의 직렬화 순서 확정 항목을 Phase B 착수 전에 처리하거나, "node-cancellation §2 는 본 plan Phase B 완료 후 후행" 으로 명문화하는 결정이 필요하다. 현재 plan 이 체크박스로 열어두고 있으므로 본 착수 전 사용자/planner 와 결정 기록 필요.

- **[INFO]** D2 미해결 결정(user-defined variables 영속 범위) 이 spec/5-system/4-execution-engine.md §7.5 rehydration 서술에 영향 가능
  - target 위치: spec/5-system/4-execution-engine.md §7.5 (rehydration 무손실 보장 서술)
  - 관련 plan: exec-park-durable-resume §"미해결 결정" D2
  - 상세: plan D2("user-defined variables 복원을 본 plan 범위에 포함할지, 별도 plan 분리할지")가 미확정이다. spec §7.5 의 rehydration 무손실 보장 서술 범위가 variables 를 포함하는지 여부는 D2 결정에 따라 달라진다. 현재 spec 서술이 "conversationThread·variables 를 복원함을 명시"를 Phase B spec 변경으로 예고하고 있어, D2 미확정 시 spec 갱신 내용이 실제 구현 범위와 불일치할 수 있다.
  - 제안: D2 결정을 Phase B spec 갱신 전에 사용자와 확정하거나, §7.5 서술을 "conversationThread 복원" 만으로 먼저 작성하고 variables 는 D2 결정 후 보강하는 단계적 접근을 택한다.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

spec/5-system/ 의 worktree 충돌 후보로 식별된 worktree 중 stale 판정된 항목:

- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 2 PR #(merged) MERGED
- `kb-quality-fba2f2` (branch `claude/kb-quality-fba2f2`) — Step 2 PR MERGED
- `spec-exec-intake-queue` (branch `claude/spec-exec-intake-queue`) — Step 2 PR MERGED
- `impl-exec-intake-queue` (branch `claude/impl-exec-intake-queue`) — Step 2 PR MERGED (spec/5-system/4-execution-engine.md 수정 포함)
- `agent-a382d5fc6d0ac5aca` (branch `claude/agent-a382d5fc6d0ac5aca`) — Step 2 PR MERGED (17-agent-memory.md, _product-overview.md)
- `agent-a78619aab700d87a4` (branch `claude/agent-a78619aab700d87a4`) — Step 2 PR MERGED (7-llm-client.md, 9-rag-search.md)
- `rag-rerank-impl` (branch `claude/rag-rerank-impl`) — Step 2 PR MERGED (7-llm-client.md, 9-rag-search.md)
- `makeshop-api-catalog-730deb` (branch `claude/makeshop-api-catalog-730deb`) — Step 2 PR MERGED (11-mcp-client.md, 16-system-status-api.md)

위 8개 worktree 는 stale 이므로 worktree 충돌 검토 대상에서 제외한다.

**active 분석 대상** (non-stale, spec/5-system/4-execution-engine.md 수정):
- `exec-park-durable-resume` 본 plan (branch `claude/exec-park-phaseb`) — Phase B 미착수, 자기 자신
- `memory-backlog-a2-fe9c8f` (branch `claude/memory-backlog-a2-fe9c8f`, PR OPEN) — spec/5-system/17-agent-memory.md 만 수정, 4-execution-engine.md 와 겹치지 않음

**ACTIVE 충돌 후보 확인:**
- `memory-backlog-a2-fe9c8f`: spec/5-system/17-agent-memory.md 만 수정 → 4-execution-engine.md 와 파일 수준 경합 없음.
- `rag-rerank-followup-864891` (branch `claude/rag-rerank-followup-864891`, PR OPEN): spec/5-system/1-auth.md 및 9-rag-search.md 수정 → 4-execution-engine.md 와 파일 수준 경합 없음. 1-auth.md 는 exec-park-durable-resume 이 수정하지 않으므로 충돌 없음.

해당 worktree 들이 정리되지 않은 채 남아있다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

spec/5-system/ 에 대한 --impl-prep 검토 결과, exec-park-durable-resume 의 구현 착수(특히 Phase A 완료 이후 Phase B)를 직접 차단하는 CRITICAL 이슈는 없다. Phase A(A1/A2a/A2b)는 이미 완료됨이 plan 에 기록되어 있다. 주요 관심 사항은 두 가지다: (1) exec-intake-queue-impl PR3 를 exec-park-durable-resume 이 "흡수" 선언했으나 exec-intake-queue-impl plan 측의 이관 표기가 완전한지 확인이 필요하여 Phase B 착수 전 spec/5-system/4-execution-engine.md §7.5 에 대한 이중 수정 위험이 WARNING 으로 남는다. (2) node-cancellation §2 와의 직렬화 순서 및 D2(variables) 미결 결정이 Phase B spec 갱신 전에 확정되어야 한다. worktree 충돌 후보 12건 중 stale 8건 skip, active 4건 분석 결과 파일 수준 경합은 1건(exec-intake-queue-impl PR3, WARNING)이며 나머지 3건은 다른 spec 파일 수정으로 실제 충돌 없음.

---

## 위험도

LOW
