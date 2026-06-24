# Cross-Spec 일관성 검토 결과

## 검토 대상

- **Target**: `plan/in-progress/spec-draft-m1-residual-sync.md`
- **범위**: `spec/4-nodes/3-ai/1-ai-agent.md` 편집안 1-A~1-G (doc-sync, behavior 무변경)
- **검토 일시**: 2026-06-24

---

## 발견사항

### [WARNING] AiMemoryManager 위임 참조가 `spec/data-flow/13-agent-memory.md` 의 call-site 기술과 불일치

- **target 위치**: 편집안 1-D (§6.1 단계 1.3), 1-E (§6.1 단계 1.5), 1-F (§6.1 단계 2.7)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/spec/data-flow/13-agent-memory.md` L38-39, L103-104
- **상세**:
  - draft 는 recall(`injectMemoryContext`)·추출(`scheduleMemoryExtraction`) 의 구현 주체를 `AiMemoryManager` (`ai-agent/ai-memory-manager.ts`) 로 명시하고, 공유 헬퍼는 `shared/agent-memory-injection.ts` 라고 기술한다.
  - `data-flow/13-agent-memory.md` L38-39 는 코드 진입점을 여전히 (a) `nodes/ai/shared/agent-memory-injection.ts` — 공유 헬퍼 (`scheduleMemoryExtraction` producer 측 + `buildRecallBlock`), (b) `nodes/ai/ai-agent/ai-agent.handler.ts` — recall + 턴 경계 enqueue 호출부 로 나열하고 있으며, `AiMemoryManager` 가 중간 위임 계층임을 언급하지 않는다.
  - L103-104 에서도 `injectMemoryContext` 메서드를 `ai-agent.handler.ts` 의 메서드로 기술한다 ("ai-agent.handler.ts `injectMemoryContext` / information-extractor.handler.ts 동형 경로").
  - M-1 2단계 분할 후 `AiMemoryManager` 가 `ai-agent.handler.ts` 에서 recall/enqueue 를 인수받은 중간 collaborator 라면, `data-flow/13-agent-memory.md` 의 L39 · L103-104 는 구 handler 직접 호출 경로를 가리켜 코드 현실과 어긋난다. draft 가 `1-ai-agent.md` 에만 `AiMemoryManager` 참조를 추가하면 두 문서가 서로 다른 call-site 를 가리키게 된다.
  - `information-extractor.handler.ts` 의 동형 recall 경로(L39·L104)는 `AiMemoryManager` 와 무관하게 별도 구현이므로 이 경우는 data-flow 기술이 여전히 정확할 수 있다 — 단, `ai-agent.handler.ts` 에 대한 기술은 동기화가 필요하다.
- **제안**: draft 채택 시 `spec/data-flow/13-agent-memory.md` L39 의 `ai-agent.handler.ts` 항목을 `AiMemoryManager` (`ai-agent/ai-memory-manager.ts`) → `shared/agent-memory-injection.ts` 위임 구조로 갱신하고, L103-104 의 "ai-agent.handler.ts `injectMemoryContext`" 표현도 `AiMemoryManager.injectMemoryContext` (via `ai-agent/ai-memory-manager.ts`) 로 동기화한다. 두 문서를 같은 PR/플랜에서 함께 편집해야 단일-진실 원칙 위반이 발생하지 않는다.

---

### [INFO] `spec/4-nodes/6-presentation/0-common.md` 의 `processMultiTurnMessage` call-site 표현

- **target 위치**: 편집안 1-C (§6.2 서두 구현 진입점 추가)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/spec/4-nodes/6-presentation/0-common.md` L367, `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/spec/conventions/conversation-thread.md` L575
- **상세**:
  - draft 는 `AiTurnExecutor.processMultiTurnMessage` (`ai-agent/ai-turn-executor.ts`) 를 §6.2 서두에 추가한다.
  - `spec/4-nodes/6-presentation/0-common.md` L367 은 여전히 `ai-agent.handler.processMultiTurnMessage(userMessage)` 로 기술한다. `spec/conventions/conversation-thread.md` L575 도 `processMultiTurnMessage` 를 backend 핸들러 메서드로 언급한다.
  - 이 두 파일은 M-1 분할로 실제 구현이 `AiTurnExecutor` 로 이동했더라도 `ai-agent.handler` 가 facade 로서 해당 메서드를 외부에 위임하는 형태라면 외부에서 보는 진입 경계(`ai-agent.handler.processMultiTurnMessage`)는 여전히 유효하다. 따라서 직접적 충돌은 아니지만, `processMultiTurnMessage` 의 실제 구현 위치가 `AiTurnExecutor` 임을 해당 파일들이 알지 못한다는 정보 비대칭이 있다.
  - behavior spec 이 아니라 구현 참조 주석이므로 즉각 차단 수준은 아님. 향후 개발자가 두 파일을 모두 읽을 때 혼동을 줄이려면 동기화 권장.
- **제안**: `spec/4-nodes/6-presentation/0-common.md` L367 의 `ai-agent.handler.processMultiTurnMessage` 표현을 별도 doc-sync 에서 `AiTurnExecutor.processMultiTurnMessage` (via `ai-agent.handler` facade) 로 보강하는 것을 고려. 이번 draft 범위 밖이므로 별도 플랜 항목으로 이월.

---

### [INFO] `ToolCallTrace.startedAt?`/`finishedAt?` 추가 (편집 1-G) — 타 spec 과 정합

- **target 위치**: 편집안 1-G (§7.1 각주 `meta.turnDebug[].toolCalls` shape)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/spec/5-system/6-websocket-protocol.md` L605, L646; `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/spec/4-nodes/3-ai/0-common.md` L111
- **상세**:
  - WS protocol spec L605 는 `tool_call_completed` 이벤트에 `startedAt`/`finishedAt`(ISO8601) 이 있고 "meta.turnDebug[].toolCalls[] 에도 동일하게 영속" 됨을 명시한다. L646 도 `toolCalls[].startedAt`/`finishedAt` 가 `meta.turnDebug[]` JSON 에 동봉 영속됨을 기술한다.
  - `spec/4-nodes/3-ai/0-common.md` L111 은 `TurnDebugEntry` 가 `toolCalls?` 를 가진 superset 임을 명시하나 `ToolCallTrace` shape 의 상세는 `1-ai-agent.md §7.1` 각주에 위임한다.
  - draft 의 추가(`startedAt?`/`finishedAt?` 및 `ai-turn-executor.ts` 구현 위치 명시)는 WS protocol spec 과 완전히 정합이며 충돌 없음. `0-common.md` 가 `TurnDebugEntry.toolCalls` shape 상세를 `1-ai-agent.md` 에 위임하고 있으므로 `0-common.md` 의 추가 갱신 없이 `1-ai-agent.md` 각주 보강만으로 단일 진실이 된다.
- **제안**: 충돌 없음. 변경 불요.

---

### [INFO] 레이어 주석 (편집 1-A) — `interaction-type-registry.md` 와 정합

- **target 위치**: 편집안 1-A (§6 서두 레이어 주석)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/spec/conventions/interaction-type-registry.md` L46-47
- **상세**:
  - draft 가 추가하는 레이어 주석은 `AiTurnOrchestrator.emitAiWaitingForInput` 이 park/resume lifecycle 을 구동한다고 기술한다.
  - `interaction-type-registry.md` L46-47 은 `AiTurnOrchestrator.emitAiWaitingForInput` (C-1 분할 후 엔진 위임) 을 `ai_conversation` / `ai_form_render` 의 emit 위치로 이미 등록하고 있다.
  - 충돌 없음. draft 내용이 기존 registry 와 일관됨.
- **제안**: 변경 불요.

---

## 요약

이번 draft(`spec-draft-m1-residual-sync.md`)가 제안하는 편집안 1-A~1-G 는 `spec/4-nodes/3-ai/1-ai-agent.md` 단일 파일 내 doc-sync 로, 행위 계약·요구사항 ID·데이터 모델·API 계약을 변경하지 않는다. RBAC/권한 모델·상태 전이·API endpoint 와 관련한 충돌은 없다. 단, `AiMemoryManager` 를 recall/추출 위임 계층으로 명시하는 편집(1-D·1-E·1-F)은 `spec/data-flow/13-agent-memory.md` 가 동일 call-site 를 여전히 `ai-agent.handler.ts` 직접 경로로 기술하고 있어 두 문서 간 구현 참조 불일치가 발생한다. 이 불일치는 두 spec 파일 중 하나가 구 상태를 가리키게 되어 개발자 오독을 유발할 수 있으므로 동일 플랜/PR 에서 `data-flow/13-agent-memory.md` 도 함께 갱신해야 한다. 나머지 편집(1-A·1-B·1-C·1-G)은 기존 spec 과 충돌이 없다.

---

## 위험도

MEDIUM

(WARNING 1건 — `data-flow/13-agent-memory.md` 와의 call-site 기술 불일치. 단독 채택 시 두 문서가 서로 다른 구현 위치를 가리키는 정합성 결함 발생. INFO 2건은 명명 비일관성 수준으로 기능 위험 없음.)

---

STATUS: OK
