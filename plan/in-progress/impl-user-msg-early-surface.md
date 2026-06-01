---
worktree: .claude/worktrees/user-msg-early-surface-27ccd2
started: 2026-06-01
owner: developer
---

# 구현: 사용자 발화(q) 조기 노출 — `execution.user_message` 라이브 이벤트

> Spec SoT: [WebSocket §4.2/§4.4/§4.4.6/§4.6/§588](../../spec/5-system/6-websocket-protocol.md) · [AI Agent §7.5/§6.2](../../spec/4-nodes/3-ai/1-ai-agent.md) · [Conversation Thread §2.2/§9.7](../../spec/conventions/conversation-thread.md) · [실행 엔진 §6.2](../../spec/5-system/4-execution-engine.md) · [interaction-type-registry §2.1](../../spec/conventions/interaction-type-registry.md).
> Spec 설계 근거: `plan/in-progress/spec-draft-user-msg-early-surface.md`.

## 배경

채널(텔레그램 등) multi-turn AI Agent 노드에서 사용자 발화(q)가 AI 응답(a) 생성 후에야 q+a 함께 노출된다. 원인: q 는 핸들러 인메모리에만 push 되고, 첫 persist/emit(`ai_message`)이 turn 종료(post-LLM) 시점이라 라이브 surface 에 q 가 a 전에 안 뜬다. 수신 시점에 내용을 싣는 WS 이벤트가 부재 (`execution.resumed` 는 contentless `{status:RUNNING}`).

## 작업 체크리스트

### 착수 전 의무
- [x] `/consistency-check --impl-prep spec/5-system/` (BLOCK: NO — `review/consistency/2026/06/01/11_52_20/SUMMARY.md`. W1~W4 조치, W5~W9 범위 밖)

### Backend
- [x] `ExecutionEventType` 에 `USER_MESSAGE = 'execution.user_message'` 추가 (`websocket.service.ts`).
- [x] `handleAiMessageTurn` 에서 **LLM 호출(`processMultiTurnMessage`) 직전** `execution.user_message` emit. payload `{ executionId, nodeId, nodeExecutionId, message, receivedAt }`. WS `submit_message` + 채널 인바운드 공통 chokepoint(`continueAiConversation` → bus → `handleAiMessageTurn`)라 텔레그램 자동 커버.
- [x] form 제출(`source === 'form_submitted'`) 경로 **미발화** — `if (source !== 'form_submitted')` 게이팅. form-bypass(텍스트, `source==='ai_message'`)는 발화.
- [x] 핸들러 `ai_user` thread-push 시점·책임 **불변** — emit 은 thread-push 와 독립(engine emit, handler push).
- [x] SSE 어댑터: **변경 불필요** 확인 — `handleEvent` 가 순수 pass-through(allowlist 없음). notification-fanout/webhook·chat-channel dispatcher 의 allowlist 에는 의도적으로 미추가(spec §4.6 Notification "—", dispatcher 는 outbound 라 유저 발화 echo 금지).

### Frontend
- [x] `use-execution-events` 신규 핸들러 `handleUserMessage`: optimistic `ai_user` APPEND, dedup by `receivedAt` + on/off 등록 + deps.
- [x] store `appendOptimisticUserMessage` 액션 (dedup by `receivedAt`, `isWaitingAiResponse=true`). `ai_message` REPLACE 가 reconcile (기존 carry-over 정책 회귀 없음 — unit 검증).
- [x] AST 가드 영향 없음 — 신규 `ConversationTurnSource` 없이 기존 `ai_user` 재사용. lint·unit 통과.

### 테스트
- [x] unit: 엔진 emit 시점(LLM 호출 전·`ai_message` 보다 선행)·payload·ordering (backend), store dedup/reconcile·handler append/dedup/empty-drop (frontend). `run-test.sh unit` 5389 통과.
- [x] integration: `submit_message` → `user_message`(emit) → `ai_message` 순서·dedup 을 backend spec 의 `continueAiConversation` 통합 경로로 검증 (execution-engine.service.spec).
- [x] e2e: `run-test.sh e2e` 전체 스위트 140 통과 (cross-stack 회귀 안전망). **신규 도메인 e2e 미추가** — frontend e2e 스위트에 AI-conversation/multi-turn 하네스가 전무(LLM stub 인프라 부재)하고, 이벤트 타이밍·dedup·reconcile 은 unit(backend ordering + frontend handler/store)로 결정적 커버됨. 신규 AI-conversation e2e 하네스 구축은 별도 작업.

## 조율 메모 (consistency-check I8)

- `spec-drift-ws-button-config` plan 과 `6-websocket-protocol.md §4.4` 편집 구역이 겹친다 (현재 미착수 → 경합 없음). 두 작업이 동시 진행되면 §4.4 기준 rebase.
