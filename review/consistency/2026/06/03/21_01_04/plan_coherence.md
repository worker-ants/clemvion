# Plan 정합성 검토 결과

target: `plan/in-progress/ai-context-memory-auto.md`
worktree: `ai-context-memory-9c7e6e`
검토 모드: spec draft (--spec)

---

## 발견사항

### [WARNING] ai-agent-tool-connection-rewrite 의 `conversation-thread.md` v2 정책 의존이 target 변경에 의해 실질적으로 결정됨

- **target 위치**: `plan/in-progress/ai-context-memory-auto.md` §1.1 / §3 (`conversation-thread.md §1.3, §4, §5.3` 갱신)
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §의존성·리스크 — "일반 `tool_*` 도구 결과의 ConversationThread 누적 정책은 `conversation-thread.md` v2 에서 결정된다"
- **상세**: `ai-agent-tool-connection-rewrite` 는 `conversation-thread.md` 의 v2 결정이 나오기 전까지 `tool_*` 결과를 `ai_tool` source 로 push 할지 또는 별도 `tool_call` source 를 신설할지를 열린 항목으로 남겨두고 있다. target plan 의 Phase A 는 `conversation-thread.md §1.3` 에 `runningSummary?`/`summarizedUpToSeq?` 필드를 추가하고 §4(영속화)/§5.3(cap 토큰화)/§7(v2 로드맵 항목 실현 표기)를 개정한다. 이 개정이 `conversation-thread.md` 에 대한 v2 수준 변경으로 간주된다면, tool-connection-rewrite 가 "v2 결정을 기다린다"고 명시한 open 정책 질문이 해소됐는지 불분명하다.
- **제안**: target plan Phase A 완료 시 `ai-agent-tool-connection-rewrite.md` §의존성·리스크의 "conversation-thread v2 정책" 항목을 업데이트하여, 본 target 변경이 `tool_*` source 정책 미해결 항목을 해소하는지, 혹은 여전히 별도 결정이 필요한지를 명시할 것. 해소하지 않는다면 해당 항목을 `ai-agent-tool-connection-rewrite.md §5 미해결 결정`으로 이전.

---

### [WARNING] `conversation-thread.md §7 v2 로드맵`의 "Token-aware cap" 실현 표기와 §5.3 char-기반 cap 공존 여부가 Phase 계획에 미명시

- **target 위치**: `plan/in-progress/ai-context-memory-auto.md` §1.1 ("이 작업이 그 로드맵을 실현한다"), §3 (`conversation-thread.md §7: v2 로드맵에서 token-aware cap 항목 → 본 작업으로 실현 표기`)
- **관련 plan**: 없음 (현재 `spec/conventions/conversation-thread.md` §7에 "Token-aware cap: 현재 char-based cap (§5.3) 을 provider tokenizer 기반으로" 항목이 활성 로드맵으로 남아있음)
- **상세**: 현재 §5.3 의 char-기반 cap(`MAX_INJECTED_TURNS: 100`, `MAX_TURN_TEXT_CHARS: 4000`, `MAX_INJECTED_CHARS: 200_000`)은 `memoryStrategy: 'manual'` 에서 유지되어야 한다. target 은 이를 명시하지 않아 Phase A 개정 시 기존 cap 이 제거되는지 공존하는지가 불명확하다. 또한 §7 로드맵의 "Token-aware cap" 은 "provider tokenizer 기반" 방식을 기술하는 반면, target 의 `memoryTokenBudget` 은 정수 예산이지 tokenizer-exact 방식이 아니다. §7 항목을 "실현 완료"로 표기하면 tokenizer-exact 개선 여지가 close 된 것으로 오인될 수 있다.
- **제안**: Phase A spec 개정 시 (a) §5.3 에 `manual` 모드 char-기반 cap 유지를 명시하고 `summary_buffer/persistent` 모드는 token-budget 방식으로 대체됨을 구분 기술할 것, (b) §7 로드맵 항목을 "token-budget 방식으로 부분 실현; tokenizer-exact 방식은 여전히 v3 로드맵" 과 같이 정밀 표기할 것.

---

### [WARNING] `ai-review-backlog-seq-counter` PR 2/3 미착수 상태이나 착수 시 `ai-agent.handler.ts` 에서 target Phase E 와 경합 가능

- **target 위치**: `plan/in-progress/ai-context-memory-auto.md` §4 Phase E — `ai-agent.handler.ts` `injectConversationContext` 확장, meta echo
- **관련 plan**: `plan/in-progress/ai-review-backlog-seq-counter.md` PR 2/3 — `ai-agent.handler.ts` 의 `TOOL_CALL_STARTED`/`COMPLETED` 직접 `WebsocketService` 호출 → `ExecutionEventEmitter` facade 경유 리팩터링 (별도 worktree 착수 미결)
- **상세**: PR 2/3 은 현재 착수되지 않아 활성 worktree 경합은 없다. 그러나 두 작업이 동시에 착수되면 `ai-agent.handler.ts` 동일 파일에 대한 worktree 경합이 발생한다. 변경 위치는 handler 내 다른 함수이지만 merge 충돌 가능성이 있다.
- **제안**: target Phase E 착수 전에 PR 2/3 상태를 확인하고, 활성화 시 직렬화 순서를 두 plan 에 모두 주석으로 명시할 것(예: "target Phase E 완료 후 PR 2/3 착수" 또는 그 역).

---

### [INFO] `spec/5-system/<N>-agent-memory.md` 신규 파일 번호 — Phase A 채번 시 현재 가용 번호 확인 메모 추가 권장

- **target 위치**: `plan/in-progress/ai-context-memory-auto.md` §5 — "신규 system spec 문서 번호(`spec/5-system/<N>`) — Phase A 에서 채번"
- **관련 plan**: 없음 (5-system 파일을 신설하는 활성 plan 없음)
- **상세**: `spec/5-system/` 에 현재 `1-auth.md`~`16-system-status-api.md` 까지 사용 중이므로 다음 가용 번호는 `17`이다. 활성 worktree 중 5-system 신규 파일을 만드는 경합은 없음.
- **제안**: `plan/in-progress/ai-context-memory-auto.md` §5 의 해당 항목에 "(현재 가용: 17번, 2026-06-03 기준)" 메모 추가 권장.

---

### [INFO] `§5 미해결 — 요약 LLM 콜 모델` 결정이 Phase A 에서 1-ai-agent.md 설정 표 범위에 영향할 수 있음

- **target 위치**: `plan/in-progress/ai-context-memory-auto.md` §5 — "요약 LLM 콜이 쓰는 모델 — 노드 `model`/`llmConfigId` 재사용 vs 저비용 모델 분리"
- **관련 plan**: 없음
- **상세**: 저비용 모델 분리를 선택할 경우 `spec/4-nodes/3-ai/1-ai-agent.md §1` 설정 표에 `summaryModelId?` 또는 유사 필드가 추가될 수 있으나, 현재 target plan 의 설정 표(§2)에는 5개 필드만 열거되어 있어 해당 케이스가 누락될 수 있다.
- **제안**: Phase A 착수 전 이 결정을 "v1 은 노드 `model` 재사용, 별도 필드 없음"으로 scope-freeze 하거나, 별도 필드를 추가할 경우 §2 설정 표를 갱신하도록 Phase A 체크리스트에 명시.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 stale 판정으로 제외된 항목:

- `ai-context-memory-9c7e6e` (branch `claude/ai-context-memory-9c7e6e`) — Step 1 ancestor STALE (target worktree 자신, 충돌 대상 아님). skip.
- `spec-drift-gates-b26bce` (branch `claude/spec-drift-gates-b26bce`) — Step 2 PR #449 MERGED. stale skip.
- `spec-drift-resolve-efb608` (branch `claude/spec-drift-resolve-efb608`) — Step 2 PR #432 MERGED. stale skip.
- `spec-inprogress-groom-c7568b` (branch `claude/spec-inprogress-groom-c7568b`) — Step 2 PR #450 MERGED. stale skip.
- `spec-sync-impl-644d19` (branch `claude/spec-sync-impl-644d19`) — Step 2 PR #448 MERGED. stale skip.
- `fix-presentation-tool-default-dcecc3` (branch `claude/fix-presentation-tool-default-dcecc3`) — Step 2 PR #438 MERGED. stale skip.
- `plan-grooming-2ec306` (branch `claude/plan-grooming-2ec306`) — Step 2 PR #431 MERGED. stale skip.
- `system-status-recent-failed-86831b` (branch `claude/system-status-recent-failed-86831b`) — Step 2 PR #435 MERGED. stale skip.
- `code-node-sandbox-979a97` (branch `claude/code-node-sandbox-979a97`) — Step 2 PR #434 MERGED. stale skip.
- `conventions-code-data-9b32d5` (branch `claude/conventions-code-data-9b32d5`) — Step 2 PR #433 MERGED. stale skip.
- `cafe24-api-catalog-1665bd` (branch `claude/cafe24-api-catalog-1665bd`) — Step 2 PR #447 MERGED. stale skip.
- `node-cancellation-engine-6bfcaa` (branch `claude/node-cancellation-engine-6bfcaa`) — Step 2 PR #442 MERGED. stale skip.
- `no-floating-promises-error-b004d8` (branch `claude/no-floating-promises-error-b004d8`) — Step 2 PR #416 MERGED, 0 commits ahead of main. stale skip.
- `spec-sync-audit` (branch `claude/switch-regex-workspace-uq`) — Step 2 PR #446 MERGED. stale skip. (spec-sync-structural-followups, spec-sync-common-gaps, spec-sync-execution-engine-gaps 등 동 worktree 참조 plan 들 모두 경합 없음)
- `feat-web-chat-demo` (branch `claude/workspace-allowed-origins-settings`) — Step 1 ACTIVE (squash merge hash 변경), Step 2 PR #441 MERGED. stale skip.
- `followup-conversation-reconcile` (branch `worktree-followup-conversation-reconcile`) — 실제 worktree 디렉터리 미존재. Step 2 PR #429 MERGED. stale skip.
- `workflow-turn-timing-69fee2` (branch `claude/workflow-turn-timing-69fee2`) — Step 2 PR #445 MERGED. stale skip.

stale worktree 가 다수 활성으로 남아있다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`plan/in-progress/ai-context-memory-auto.md` (target)는 전반적으로 plan 내 미해결 결정을 Phase A 에서 명시적으로 해소하도록 설계되어 있으며, 활성 worktree 와의 직접적 파일 경합은 없다. 주요 정합 우려 3건: (1) `ai-agent-tool-connection-rewrite` 의 `conversation-thread.md` v2 의존 항목이 target 변경으로 해소되는지 불명확 — Phase A 완료 시 해당 plan 업데이트 필요; (2) `conversation-thread.md §5.3` char-기반 cap 의 `manual` 모드 유지 및 §7 로드맵 항목의 tokenizer-exact vs token-budget 구분이 Phase A 에서 정밀 처리 필요; (3) `ai-review-backlog-seq-counter` PR 2/3 착수 시 `ai-agent.handler.ts` 경합 가능 — 현재는 미착수라 실제 충돌 없으나 사전 직렬화 합의 권장. 위 모두 WARNING 수준이며 CRITICAL 은 없다. worktree 충돌 후보 17건 중 stale 17건 skip, active 0건 분석.

---

## 위험도

LOW
