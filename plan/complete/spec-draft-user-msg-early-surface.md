---
worktree: .claude/worktrees/user-msg-early-surface-27ccd2
started: 2026-06-01
owner: project-planner
---

# Spec draft: 사용자 발화(q) 조기 노출 — `execution.user_message` 라이브 신호

> 목적: 채널(텔레그램 등) multi-turn AI Agent 노드에서, 사용자 발화(q)가 **AI 응답(a) 생성 후**가 아니라 **수신 즉시(LLM 호출 전)** 라이브 대화 surface 에 노출되도록 한다.
> 본 draft 는 `project-planner` 산출 — 구현(codebase) 은 후속 `developer` 위임. spec/plan 까지만.

## 1. 배경 / 진단 (코드로 확정됨)

현재 multi-turn resume 흐름:

1. 사용자 메시지 q 도착 (WS `execution.submit_message` 또는 채널 인바운드).
2. 핸들러 `processMultiTurnMessageInner` 가 q 를 **인메모리** `messages` 배열 + ConversationThread(`pushAiThreadTurn('ai_user')`)에만 push.
3. `await llmService.chat(...)` 로 a 생성 (수 초 latency, blocking).
4. a 를 push.
5. 핸들러 return **후에야** 엔진 `handleAiMessageTurn` 이 `NodeExecution.outputData` 저장 + `execution.ai_message` emit 을 **turn 종료 시 1회** 수행.

→ q+a 가 항상 함께 노출되어 q 가 a 보다 먼저 보이지 않는다.

### 핵심 발견

- **정렬 버그 아님**: 전 계층이 배열 삽입 순서로 렌더 (timestamp/seq 정렬 없음). 순수하게 **q 의 노출 타이밍** 문제.
- **백엔드는 q 를 이미 조기 포착한다**: spec [AI Agent §7.5](../../spec/4-nodes/3-ai/1-ai-agent.md) 의 `resumed` (`message_received`) 스냅샷이 "사용자 메시지 수신 직후, 다음 턴 LLM 호출 전에 1회" 만들어진다 (`output.interaction.{type:'message_received', data:{content, role:'user'}, receivedAt}`).
- **그러나 그 스냅샷은 WS 라이브 신호가 아니다**: WS server→client 이벤트 표 ([§4.2](../../spec/5-system/6-websocket-protocol.md))에 `resumed` 대응 이벤트가 없고, §7.5 가 "run history / timeline observability 에만 기록" 으로 못박는다. 라이브 대화 패널이 소비하는 이벤트는 `execution.ai_message`(turn 종료) 와 `execution.waiting_for_input.conversationThread`(turn 경계) 뿐 — 둘 다 post-LLM.
- 텔레그램 인바운드 q 는 `channel-conversation.service`(답장 스레딩용 별도 스토어)에만 닿고 실행 내역/대화 뷰는 이를 읽지 않는다.

## 2. 설계 결정

### D1 — 메커니즘: 신규 `execution.user_message` 라이브 이벤트 (기존 `ai_message` 와 대칭)

엔진이 사용자 메시지를 수신해 multi-turn 노드를 재개하는 시점(= §7.5 `resumed` tick, **다음 턴 LLM 호출 전**)에 새 server→client WS 이벤트 `execution.user_message` 를 1회 emit.

- **대안 A (채택)**: 신규 `execution.user_message` 이벤트. `ai_message` ↔ `user_message` 네이밍 대칭으로 자체 문서화. 기존 `ai_message` 의 "AI 메시지" 시맨틱·turn 경계 1회 emit 불변식을 건드리지 않는다.
- **대안 B (기각)**: 기존 `ai_message` 를 interim emit 으로 의미 확장. → `ai_message.message`(assistant 표시 텍스트) 시맨틱과 turn 카운팅(`source==='live'` user 매칭) 규약([WS §4.4.6](../../spec/5-system/6-websocket-protocol.md))을 흐린다. 소비 측 turn 매칭 로직이 깨질 위험.
- **대안 C (기각)**: `resumed` 스냅샷을 그대로 WS 로 승격. → `resumed` 는 NodeHandlerOutput(전체 `output.result.messages` 누적본) 이라 페이로드가 무겁고, observability(replay) 시맨틱과 라이브 렌더 시맨틱이 한 채널에 섞인다.

### D2 — 시맨틱: 라이브 진행 신호 + turn 종료 reconciliation (영속 타이밍 불변)

`execution.user_message` 는 `execution.tool_call_started` 와 동형의 **라이브 진행 신호**다.

- **권위 출처는 여전히 turn 종료 `execution.ai_message.messages` 스냅샷**(q+a 동일 포함) — [WS §4.4 Reconciliation 노트](../../spec/5-system/6-websocket-protocol.md)와 동일 철학. `user_message` 이벤트가 손실돼도 turn 종료 스냅샷이 q 를 복원한다.
- 클라이언트는 q 를 dedup: `user_message` 로 띄운 optimistic user bubble 을 후속 `ai_message.messages` 의 권위 스냅샷으로 reconcile(치환). dedup 키 = `(nodeExecutionId, receivedAt)` 또는 다음 `ai_message` 의 마지막 `source:'live'` user 메시지.
- **영속 타이밍은 불변**: `NodeExecution.outputData` 는 기존대로 turn 경계에서만 저장 (turn-boundary single-write 불변식 유지). q 의 조기 노출은 **라이브 전용 UX 속성**으로 명시한다.

### D3 — live ↔ history 일관성: 조기 노출은 live-only, history 는 완결 후 정합

- **Live 뷰**(`use-execution-events`): `user_message` 수신 시 즉시 user bubble append → a 도착(`ai_message`) 시 reconcile. q 가 a 보다 먼저 보인다 (요구 충족).
- **History 뷰**(`parseHistoryMessages(outputData)`): 변경 없음. turn 완결 후 q+a 가 삽입 순서대로(올바른 순서) 함께 존재 — 이미 정상. "완결된 이력"에는 시간적 before/after 개념이 없으므로 조기 노출 대상 아님.
- **mid-generation 새로고침**(a 생성 중 페이지 refresh): 노드는 `running` 상태로 표시되고 optimistic q 는 복원되지 않는다 — 허용(스트리밍/`tool_call_started` 진행 신호가 live-only 인 것과 동형). v1 비요구. (early-persist 대안은 §Rationale 에서 기각.)

### D4 — 책임 레이어: 엔진 emit, 핸들러 thread-push 불변

- `execution.user_message` emit 은 **엔진 재개 경로**(WS `submit_message` + 채널 인바운드 공통 chokepoint = §7.5 resumed tick)가 담당. 핸들러(`processMultiTurnMessageInner`)는 `NodeExecution`/eventEmitter 참조가 없으므로 부적격.
- 핸들러의 ConversationThread `ai_user` push(spec [Conversation Thread §2.2](../../spec/conventions/conversation-thread.md))는 **변경 없음** — `user_message` 이벤트는 thread 전체 스냅샷이 아니라 메시지 텍스트만 운반하므로 thread-push 시점 재배치가 불필요. form-bypass(§6.2 step 2.c.bypass)·`pendingFormToolCall` 누락 fallback 로직도 무영향.

### D5 — 스코프: 일반 채팅(`message_received`) 한정

- `execution.user_message` 는 `execution.submit_message`(일반 채팅) / 채널 텍스트 인바운드 → `message_received` 경로에서만 발화.
- form 제출(`execution.submit_form` → `presentation_user`)은 **스코프 밖** — 별도 optimistic 처리가 이미 존재(spec AI Agent §7.4 D7 `resumeFromForm` 노트). form-bypass 로 들어온 raw 텍스트 메시지는 일반 채팅이므로 `user_message` 발화 대상(사용자가 실제 텍스트를 보냄 → user bubble 노출이 옳다).

## 3. Spec 변경 대상

| 문서 | 변경 |
| --- | --- |
| `spec/5-system/6-websocket-protocol.md` | (a) §4.2 server→client 이벤트 표에 `execution.user_message` 행 추가. (b) §4.4 에 페이로드 상세 subsection 추가 (`{executionId, nodeId, nodeExecutionId, message, receivedAt}`). (c) §4.4.6 / §655 소비 규약에 "live 뷰는 `user_message` 로 q 를 즉시 렌더하고 `ai_message` 로 reconcile" 명시. (d) §588 Reconciliation 노트에 `user_message` 를 tool_call 류 진행 신호로 포함. (e) 이벤트 deliverability 매트릭스(§730 부근)에 행 추가. |
| `spec/4-nodes/3-ai/1-ai-agent.md` | §7.5 (`resumed` 스냅샷)에 "이 시점에 엔진이 `execution.user_message` 라이브 이벤트를 함께 emit — observability 기록과 별개의 라이브 surface 신호" 명시 + WS §4.4 cross-ref. §6.2 step 2(b) resumed emit 설명에 동일 cross-ref. |
| `spec/conventions/conversation-thread.md` | §9 (미리보기 UI 렌더 규칙)에 "live 대화 timeline 은 `user_message` 진행 신호로 `ai_user` turn 을 조기 표시할 수 있고, 권위 출처는 turn 종료 스냅샷" 노트 추가. §2.2 는 thread-push 시점 불변임을 재확인(변경 없음). |
| `spec/5-system/4-execution-engine.md` | §7.5(재개 경로) 설명에 resumed tick 의 `execution.user_message` emit 추가 — WS `submit_message` 와 채널 인바운드 공통 chokepoint 임을 명시. §8(영속화 표, line 699-700 부근)에 "user_message 는 라이브 전용·비영속, outputData 는 turn 경계 저장 불변" 명시. |

## 4. Rationale (결정 근거 / 기각 대안)

- **왜 라이브 전용인가 (early-persist 기각)**: q 를 LLM 호출 전에 `NodeExecution.outputData` 에 선-persist 하면 (i) turn-boundary single-write 불변식이 깨지고 (mid-turn partial 스냅샷), (ii) `output.result.messages` 가 a 없이 q 만 있는 중간 상태로 다운스트림 expression(`$node["X"].output.result.messages`)에 노출될 위험, (iii) `_resumeCheckpoint` / rehydration 정합 재검토 필요 — 모두 비용 대비 효용이 낮다. 사용자 요구("a 전에 q 노출")는 **라이브 관전 경험**이 본질이며, 라이브 신호 + turn-종료 reconciliation 로 완전히 충족된다.
- **왜 신규 이벤트인가**: `ai_message` 시맨틱 오염(turn 카운팅·`message` 텍스트)을 피하고, `tool_call_started`/`ai_message` 와 같은 "라이브 진행 신호 + 권위 스냅샷 reconcile" 기성 패턴에 자연 편입.
- **텔레그램 특정성**: 채널 인바운드도 엔진의 동일 재개 chokepoint(resumed tick)를 거치므로, 그 자리에 emit 하면 채널 출처 메시지도 자동 커버. 관전자(run-results drawer)는 execution 채널 구독으로 수신.

## 5. 후속 (developer 위임 범위 — 본 plan 비포함)

→ 구현 추적은 `plan/in-progress/impl-user-msg-early-surface.md` 로 분리(I9).

- 엔진 재개 경로(`submit_message` + 채널 인바운드 공통 chokepoint)에 `execution.user_message` emit 추가 (LLM 호출 전).
- WS gateway / `ExecutionEventType` enum 에 `USER_MESSAGE = 'execution.user_message'` 등록 (I11).
- frontend `use-execution-events` 신규 핸들러 + 대화 store 에 optimistic `ai_user` append (dedup by `receivedAt`) / `ai_message` reconcile.
- unit/integration/e2e (텔레그램 multi-turn 관전 시 q 즉시 노출 → a 도착 reconcile).

## 6. consistency-check 결과 반영 (2026-06-01 11:31:31 — BLOCK: NO)

Critical 0건. WARNING 5 + INFO 13 을 아래와 같이 spec 반영에 흡수했다.

- **W1/I4/I11**: WebSocket §4.2 이벤트 표 행 + §4.6 외부 표면 매핑 표 행(`SSE: execution.user_message`, `Notification: —`) 추가. enum 등록은 구현 plan 으로 이관.
- **W2 (resumed 와의 긴장 — 코드 근거 해소)**: 코드 확인 결과 (i) WS `execution.resumed` 이벤트는 payload `{ status: RUNNING }` 뿐인 **contentless lifecycle 신호**이고 `finalizeAiNode`(turn 종료)에서 emit 되며, (ii) `status:'resumed'` `message_received` 스냅샷(§7.5)은 structured output observability 일 뿐 내용 있는 라이브 이벤트가 아니다. 즉 **수신 시점에 사용자 발화 내용을 싣는 WS 이벤트가 현재 부재**하다. execution-engine §7.5(rehydration) 의 "WS 신규 이벤트 도입 안 함" 원칙은 *재개 사실이 node 이벤트로 이미 관측 가능한 관측-중복* 이벤트를 기각한 것이라 본 건(내용 운반 이벤트 부재)에는 사유가 적용되지 않는다. → 신규 `execution.user_message` 채택이 정합. ai-agent §7.5 에 "observability 스냅샷과 별개로 라이브 이벤트 함께 emit" 명문화.
- **W3/I5/I12 (dedup 단일 진실 — 확정)**: dedup 1차 키 = `receivedAt` (= `output.interaction.receivedAt` 동일 값). `nodeExecutionId` = 해당 시점 `waiting_for_input` 상태 NodeExecution row PK 로 명시(WebSocket §4.4 + ai-agent §7.5). `ai_message` 마지막 `source:'live'` user 매칭은 fallback 으로 명문화(§588 / conversation-thread §9.7).
- **W4**: `spec/conventions/interaction-type-registry.md` §2.1 에 "신규 `ConversationTurnSource` 값 없음 — optimistic bubble 은 기존 `ai_user` 재사용, 핸들러는 `use-execution-events` 신규 분기" 노트 추가. `WaitingInteractionType` 무영향 명시.
- **W5/I1**: conversation-thread §9.7 store 변환 계약 표에 `user_message` 행(optimistic `ai_user` APPEND, dedup by `receivedAt`) + `ai_message` REPLACE 의 reconcile 문구 추가. §2.2 에 push 시점 불변 + cross-ref 노트.
- **I2/I3**: execution-engine 영속화 표에 신규 행 대신 "라이브 전용·비영속" blockquote 노트. ai-agent §7.5 "observability + 라이브 이벤트 공존" 문구.
- **I7/I13**: WebSocket §4.4 에 `interaction.data`(message_received shape)와 WS 페이로드 구별 각주, `ButtonDef.userMessage` 와의 무관성 명시.
- **I6**: 본 plan frontmatter `status: draft` 비표준 필드 제거.
- **I8/I10**: `spec-drift-ws-button-config` 와 §4.4 편집 구역 겹침 — 미착수라 현시점 경합 없음. 해당 plan 착수 시 rebase 권고(구현 plan 의 조율 메모로 이관). `execution-engine-residual-gaps.md` orphan worktree ref 는 본 작업 범위 밖 — 별도 grooming.
- **I9**: 구현 추적 plan `impl-user-msg-early-surface.md` 동시 생성.
