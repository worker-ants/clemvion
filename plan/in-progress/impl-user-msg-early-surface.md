---
worktree: TBD
started: 2026-06-01
owner: developer (TBD)
---

# 구현: 사용자 발화(q) 조기 노출 — `execution.user_message` 라이브 이벤트

> Spec SoT: [WebSocket §4.2/§4.4/§4.4.6/§4.6/§588](../../spec/5-system/6-websocket-protocol.md) · [AI Agent §7.5/§6.2](../../spec/4-nodes/3-ai/1-ai-agent.md) · [Conversation Thread §2.2/§9.7](../../spec/conventions/conversation-thread.md) · [실행 엔진 §6.2](../../spec/5-system/4-execution-engine.md) · [interaction-type-registry §2.1](../../spec/conventions/interaction-type-registry.md).
> Spec 설계 근거: `plan/in-progress/spec-draft-user-msg-early-surface.md`.

## 배경

채널(텔레그램 등) multi-turn AI Agent 노드에서 사용자 발화(q)가 AI 응답(a) 생성 후에야 q+a 함께 노출된다. 원인: q 는 핸들러 인메모리에만 push 되고, 첫 persist/emit(`ai_message`)이 turn 종료(post-LLM) 시점이라 라이브 surface 에 q 가 a 전에 안 뜬다. 수신 시점에 내용을 싣는 WS 이벤트가 부재 (`execution.resumed` 는 contentless `{status:RUNNING}`).

## 작업 체크리스트

### 착수 전 의무
- [ ] `/consistency-check --impl-prep spec/5-system/` (developer 의무)

### Backend
- [ ] `ExecutionEventType` 에 `USER_MESSAGE = 'execution.user_message'` 추가 (`codebase/backend/src/modules/websocket/websocket.service.ts`).
- [ ] 엔진 multi-turn 재개 chokepoint(WS `submit_message` + 채널 텍스트 인바운드 공통 경로 = `message_received` resume tick)에서 **LLM 호출 전** `execution.user_message` emit. payload `{ executionId, nodeId, nodeExecutionId, message, receivedAt }`. `nodeExecutionId` = 해당 `waiting_for_input` NodeExecution row PK, `receivedAt` = `output.interaction.receivedAt` 동일 값.
- [ ] form 제출(`submit_form` → `presentation_user`) 경로에는 **미발화** 확인. form-bypass(텍스트 메시지)는 일반 채팅이므로 발화 대상.
- [ ] 핸들러 `processMultiTurnMessageInner` 의 `ai_user` thread-push 시점·책임 **불변** 확인 (영속·권위 경로 변경 없음).
- [ ] SSE 어댑터(`external-interaction/sse-adapter.service.ts`)에 `execution.user_message` 매핑 (Notification 미발송).

### Frontend
- [ ] `use-execution-events` 신규 핸들러: `execution.user_message` 수신 → store `conversationMessages` 에 optimistic `ai_user` `ConversationItem` APPEND, dedup by `receivedAt`.
- [ ] `ai_message` REPLACE 가 optimistic bubble 을 권위 스냅샷으로 reconcile 하는지 확인 (기존 carry-over 정책 회귀 없음).
- [ ] `interaction-type-exhaustiveness.test.ts` 등 AST 가드 영향 확인 (신규 ConversationTurnSource 없음 — `ai_user` 재사용).

### 테스트
- [ ] unit: 엔진 emit 시점(LLM 호출 전), payload shape, form 제출 미발화.
- [ ] integration: `submit_message` → `user_message` → `ai_message` 순서·dedup.
- [ ] e2e: 텔레그램 multi-turn 관전 시 q 즉시 노출 → a 도착 reconcile, history 뷰 정합.

## 조율 메모 (consistency-check I8)

- `spec-drift-ws-button-config` plan 과 `6-websocket-protocol.md §4.4` 편집 구역이 겹친다 (현재 미착수 → 경합 없음). 두 작업이 동시 진행되면 §4.4 기준 rebase.
