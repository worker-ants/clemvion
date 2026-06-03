---
worktree: eia-strip-llmcalls
branch: worktree-eia-strip-llmcalls
status: in-progress
---

# L1: 외부 execution-event 수신자에서 debug payload(llmCalls) strip

PR #429 후속. ai-review I-3/I-4 의 raw LLM payload 노출에 대해 사용자가
"채널 실제 사용 + L1" 결정. L1 = 외부/채널 수신자에는 `llmCalls`
(raw request/responsePayload) 미전송, 에디터 인증 WS 에는 유지.

## 조사 결론 (노출 경로 + seam)
- `execution.ai_message` 의 `llmCalls[].request/responsePayload` 가 raw LLM
  요청/응답(system prompt·대화이력·tool 정의·user 입력 / 응답 본문)을 운반.
- `WebsocketService.emitExecutionEvent`:
  - (1) `gateway.broadcastToChannel(wireEnvelope)` → **인증 WS 에디터 채널** (workspace ownership 게이트)
  - (2) `executionEventSubject.next({payload: fanoutEnvelope})` → **fanout** →
    3개 외부 소비자: SseAdapter(iext/itk 토큰 SSE), NotificationFanout(webhook),
    ChatChannelDispatcher(텔레그램/web-chat outbound).
- SSE 는 `JSON.stringify(event.payload)` 통째 전송(필터 없음) → 채널 토큰
  보유 end-user 가 raw payload 수신 가능 (실 노출).
- chat-channel dispatcher 는 `llmCalls` 를 EiaAiMessageEvent 에 복사만 하고
  **소비하지 않음**(dead passthrough: dispatcher.ts:518, types.ts:304).
- `llmCalls` 는 오직 `execution.ai_message` 에만 실림. request/responsePayload 는
  llmCalls[] 안에만 존재(top-level 아님).

## 설계 (단일 seam)
`emitExecutionEvent` 에서 WS broadcast 는 full 유지하고, **fanout publish 직전
payload 에서 `llmCalls` 를 제거**(shallow clone). → SSE·webhook·chat 모두
debug payload 미수신, 에디터 WS 만 유지. wireEnvelope 은 strip 전 broadcast 돼
영향 없음(새 객체로 strip, 기존 ref 미변형).

## Phase A — spec (project-planner) ✅
- [x] websocket-protocol §4.4 `llmCalls[]` 노트 + Rationale: open item → strip-only 결정
  (인증 내부 WS 전용, fanout 외부 strip). DB 영속·실행이력 패널 불변 명시.
- [x] cross-spec 동반 갱신(consistency W-1/W-2): EIA §6.5 + chat-channel CCH-MP-01 에 strip 예외 명시
- [x] consistency-check --spec: BLOCK:NO (MEDIUM). Warning(EIA/CCH 동반·`(L1)`네이밍·plan체크박스)
  전부 반영. (review/consistency/2026/06/03/09_02_06/SUMMARY.md)

## Phase B — backend (developer)
- [ ] `websocket.service.ts`: fanout envelope 에서 `llmCalls` strip 헬퍼 + 적용
- [ ] dead passthrough 제거: `chat-channel.dispatcher.ts` toChatChannelEvent llmCalls 복사 + `types.ts` EiaAiMessageEvent.llmCalls 필드
- [ ] 테스트: websocket.service.spec(WS=full, fanout=stripped), external-interaction e2e / sse-adapter(SSE frame no llmCalls), chat-channel.dispatcher.spec
- [ ] TEST WORKFLOW (lint·unit·build·e2e)
- [ ] /ai-review + fix

## 비고
- frontend 변경 불필요(에디터는 WS 로 llmCalls 계속 수신; web-chat 위젯은 이미 무시 + 이제 미수신).
