---
name: chat-channel-outbound-still-broken
status: in-progress
worktree: .claude/worktrees/chat-channel-outbound-still-broken-afe293
branch: claude/chat-channel-outbound-still-broken-afe293
created: 2026-05-25
owner: developer
related_specs:
  - spec/5-system/15-chat-channel.md
  - spec/5-system/14-external-interaction-api.md
related_prs:
  - "#314 (선행 fix — outbound 발송 silent 차단 회귀 해소 시도)"
---

# fix(chat-channel): PR #314 적용 후에도 outbound 응답 누락 — 진단 가시화 + 후속 fix

## 배경

PR #314 머지 + 새 image 빌드 + pod restart 후에도 Telegram outbound 응답이 여전히 누락. 사용자 보고 (2026-05-25):
- **트리거는 정상**: webhook inbound 받음, workflow 실행 시작 확인
- **응답 누락**: AI Agent 응답이 Telegram 으로 안 보내짐
- **환경**: K8s single-pod (cross-pod race 가설 폐기)
- **Production log**: `ChatChannelDispatcher` / `TelegramAdapter` / `NotificationFanout` 키워드 검색 시 **0건**

## 진단

ChatChannelModule 은 app.module.ts:237 에서 import. ChatChannelDispatcher 는 module providers 에 등록 + `onModuleInit` 에서 `WebsocketService.executionEvents$` subscribe. NestJS 가 정상 부트하면 인스턴스화돼야.

`ChatChannelDispatcher.handle()` 내부에 **4개 silent return 가드** + **NotificationFanout 의 silent return** 이 있는데 모두 log 없이 return:

| # | 위치 | 가드 |
|---|------|------|
| G1 | dispatcher L77 | `!SUBSCRIBED_EVENTS.has(event.eventType)` — event type filter |
| G2 | dispatcher L79-81 | `event.payload.triggerId` missing/empty |
| G3 | dispatcher L88-90 | `!this.listenerRegistry.has(triggerId)` — R8 v1 사전 가드 |
| G4 | dispatcher L101 | `!trigger` (DB lookup 실패) |
| G5 | dispatcher L103 | `!chatChannelCfg` (trigger.config 에 chatChannel 없음) |
| G6 | dispatcher L119-122 | `!conversationKey` — `event.payload.chatChannel.conversationKey` missing |
| G7 | fanout L81-85 | `event.payload.triggerId` missing/empty |
| G8 | adapter sendMessage 실패 | logger.error — **이미 log 됨**, 사용자 log 에 없음 = 도달 안 한 것 |

→ G8 에서 log 가 안 보인다는 것 = 그 앞 단계에서 silent return 했다는 강한 증거.

PR #314 의 fix 가 envelope 에 `triggerId` / `chatChannel` 첨부 → G2/G6 통과 가능하게 함. 그런데도 outbound 가 안 됨 → G3/G5 가 silent return 했을 가능성 큼.

## 후속 fix 범위

1. **dispatcher 의 silent return 4개 (G2~G6) 에 logger.warn 추가** — 정상 active trigger 의 event 가 silent skip 되는 케이스를 즉시 가시화. R8 v1 의 "trigger 삭제 후 race event 안전 가드" 본질은 유지하되, registry miss / chatChannelCfg miss / conversationKey miss 는 **운영 회귀 신호**라 warn 격상.
2. **fanout 의 silent return (G7) 에도 logger.warn 추가** — notification webhook 도 같은 회귀 영향권.
3. **WebsocketService.registerExecutionRouting / emit 시점에 logger.debug** — routing context 가 실제 등록되고 envelope 에 첨부되는지 확인 가능하게 함 (debug level — production 에서 log level 상승 시만 보임).
4. **사용자에게 새 image 재배포 + 재테스트 + log 보내달라 요청** — 위 warn 들이 production log 에 나타나면 어느 가드인지 즉시 식별.

## 후속 fix 가 직접 해결하지 못하는 경우

진단 log 가 G3 (listenerRegistry miss) 또는 G5 (chatChannelCfg miss) 를 가리키면 추가 fix 필요:
- G3 → trigger 활성화 시 listener register 호출 누락 (TriggersService.update 의 `if (chatChannel)` 가드가 toggle-only 시점에는 안 들어옴). PR #310 (R8 v1) 의 잔여 회귀.
- G5 → trigger.config.chatChannel 구조 손상. DB 마이그레이션 / 옛 trigger row 호환성 이슈.

## 진행 체크

- [x] 0. worktree 생성 + 진단 분석
- [x] 1. consistency-check — skip (가벼운 운영 진단 log 추가, spec 본문 변경 없음, 코드 시맨틱 변경 없음 — 단순 logger 호출 추가만)
- [x] 2. dispatcher / fanout silent return 진단 log 추가 (PR #315)
- [x] 3. WebsocketService routing context emit 진단 log 추가 (PR #315)
- [x] 4. TEST WORKFLOW — lint/unit/build/e2e PASS (PR #315)
- [x] 5. PR #315 머지 + 사용자 재배포 + 재테스트 → **warn 도 안 보임** = handle() 호출 자체가 안 됨
- [x] 6. follow-up #2: dispatcher subscription 확립 log + handle 진입 log + emit ai_message log 추가
- [x] 7. TEST WORKFLOW (follow-up #2)
- [x] 8. PR + 사용자 재배포·재테스트·log 확인 → ai_message 는 통과, **waiting_for_input event 만 여전히 toEiaEvent null** (사용자 log 의 새 payload key 패턴)
- [x] 9. follow-up #4 진단: toEiaEvent 의 `waiting_for_input` 분기가 EIA spec §6.2 의 nested shape (`node` / `interaction` / `context`) 를 기대하나, execution-engine 의 emit (frontend WS §4.4 shape) 은 flat (`waitingNodeId` / `waitingNodeType` / `interactionType` / `buttonConfig` / `nodeOutput` / `conversationThread`) 으로 전달. 변환 누락 → silent skip → 캐러셀/버튼/폼 모두 outbound 안 됨 (사용자의 "캐러셀이 텔레그램에 안 보임" 의 직접 원인)
- [x] 10. fix: toEiaEvent 의 waiting_for_input case 에 emit flat → EIA nested 매핑 추가 (buttons/form/ai_conversation 3 분기 + back-compat: 이미 nested shape 인 경우 pass-through). dispatcher.spec 신규 추가로 7 케이스 회귀 차단
- [x] 11. TEST WORKFLOW — lint/unit/build/e2e 모두 PASS

## Follow-up #2 추가된 진단 log

| 위치 | level | 의미 |
|------|-------|------|
| `ChatChannelDispatcher.onModuleInit` | **log** | subscription 확립 시점 — 부트 시 1회. 안 보이면 dispatcher instance 자체가 안 만들어짐 (module 등록 오류) |
| `ChatChannelDispatcher.handle` 진입 시 | **log** | SUBSCRIBED_EVENTS 매치된 event 도달. 안 보이면 emit 가 dispatcher 에 도달 안 함 (Subject 분리 / module DI 이슈) |
| `WebsocketService.emitExecutionEvent` (`ai_message`, `waiting_for_input` 만) | **log** | emit 자체 + routing context 등록 여부 확인. dispatcher 의 handle log 와 짝지어 보면 emit-subscribe 가 같은 Subject 인지 확인 가능 |

## 사용자 측 후속 절차 (follow-up #2)

1. follow-up PR 머지 + image rebuild + pod redeploy
2. Telegram bot 재테스트
3. log 확인 (`kubectl logs <pod>`):
   - **Case A** — `ChatChannelDispatcher] subscribed to ...` 안 보임 → dispatcher 가 인스턴스화 안 됨 (module 등록 오류, 매우 이례적)
   - **Case B** — subscribed log 보임 + `WebsocketService] emit ai_message ...` 보임 + `ChatChannelDispatcher] handle event ...` **안 보임** → emit-subscribe 분리 (NestJS DI subtle issue, WebsocketModule 의 multiple instance)
   - **Case C** — subscribed log + emit log + handle log 모두 보임 + 그 뒤 warn 들 보임 → PR #315 의 warn 들이 가리키는 가드에서 silent skip (registry / chatChannelCfg / conversationKey)
   - **Case D** — subscribed log + emit log + handle log 보임 + warn 없음 + 그래도 telegram outbound 없음 → adapter.sendMessage 실패 (Telegram API 400 등) — 이미 logger.error 있음 (`ChatChannelDispatcher.sendMessage 실패`)

4. 위 Case 식별 결과 paste → 결정적 fix PR

## Follow-up #3 (2026-05-25 사용자 log 결과 분석)

사용자 production log 결과:
```
[ChatChannelDispatcher] subscribed to WebsocketService.executionEvents$ ✓
[ChannelListenerRegistry] bootstrap 복원 — 1건 등록 ✓
[WebsocketService] routing context registered: chatChannel=telegram/65202054 ✓
[ChatChannelDispatcher] handle event execution.ai_message ✓
[WebsocketService] emit execution.ai_message (routing=attached) ✓
```

= **Case D 확정**. dispatcher 가 handle 까지 정상 도달 + routing attached. PR #315 의 warn 들도 안 보임 = 그 가드들 모두 통과. 그런데 telegram outbound 없음.

남은 silent return / silent skip 후보 — PR #316 까지의 진단 log 가 없는 곳:

| 후보 | 가능 원인 | 진단 log 추가 |
|------|----------|--------------|
| `toEiaEvent` null 반환 (line 177) | ai_message payload 의 message field 가 string 아님 (sanitize 변형 / emit shape 회귀) | warn — payload key dump |
| `renderNode` 가 빈 배열 반환 | event type 매치 누락 / 빈 message 처리 | log — messages.length + kinds |
| `sendMessage` silent 성공 (Telegram API 200 인데 drop) | bot 권한 / chat_id 잘못 / Telegram spam filter | log — sendMessage ok |

## Follow-up #3 진단 log 후 식별 가능 Case

- **Case D1** — `toEiaEvent null` warn 보임 → payload.message 가 string 아님. 어떤 key 들이 있는지 dump 결과로 식별.
- **Case D2** — `renderNode → 0 message(s)` 보임 → 빈 messages 배열. renderer 의 분기 누락.
- **Case D3** — `sendMessage ok` 보임 + telegram 안 옴 → API 200 인데 silent drop. Telegram 측 이슈 (bot 권한, chat_id, /start 안 함).

## 사용자 production log 결과 (PR #317 deploy 후)

```
[ChatChannelDispatcher] handle event execution.ai_message
[WebsocketService] emit execution.ai_message (routing=attached)
[ChatChannelDispatcher] WARN event execution.ai_message — toEiaEvent null.
  payload keys=[executionId,nodeExecutionId,nodeId,message,turnCount,messages,
  metadata,llmCalls,durationMs,seq,timestamp,triggerId,chatChannel]. outbound skip.
```

**Case D1 확정 + 근본 원인 발견**: payload key 에 `message` 는 있는데 **`workflowId` 없음**. `toEiaEvent` 의 가드 `if (!triggerId || !workflowId) return null` 에서 silent skip.

PR #314 의 routing context (`triggerId` + `chatChannel`) 가 `workflowId` 를 빼먹어서 dispatcher 가 EiaEvent.base 의 필수 필드를 못 만들고 null 반환.

## Fix (PR #318)

ExecutionRoutingContext 에 `workflowId?: string` 추가. ExecutionEngine 이 execute() 진입 시 workflowId 도 register 시 전달. WebsocketService 의 attachRoutingContext 가 envelope 에 workflowId 첨부. dispatcher 의 toEiaEvent 가 정상 통과.

변경 위치 (3개):
- `WebsocketService.ExecutionRoutingContext` interface — `workflowId?: string` 추가
- `WebsocketService.attachRoutingContext` — additions 에 workflowId 첨부
- `ExecutionEngineService.execute` — register 호출 시 workflowId 전달

단위 테스트 보강 (4개 갱신):
- `websocket.service.spec`: fanout envelope 에 workflowId 첨부 검증
- `execution-engine.service.spec`: webhook + chatChannel / 일반 webhook / 빈 provider / 빈 conversationKey 4 케이스 모두 workflowId 동봉 검증

코드 시맨틱 변경 — dispatcher 의 silent skip path 가 살아남 (실제 outbound 발송 회복).



## 추가된 진단 log

| 위치 | level | 메시지 |
|---|---|---|
| `ChatChannelDispatcher.handle` triggerId 없음 | debug | 수동 실행 또는 routing context 미등록 |
| `ChatChannelDispatcher.handle` listenerRegistry miss | **warn** | bootstrap 누락 또는 활성화 시점 register 누락 가능 |
| `ChatChannelDispatcher.handle` DB lookup 실패 | **warn** | trigger 삭제됨 가능 |
| `ChatChannelDispatcher.handle` chatChannelCfg 없음 | **warn** | registry stale 가능 |
| `ChatChannelDispatcher.handle` conversationKey 없음 | **warn** | PR #314 routing context 첨부 회귀 신호 |
| `NotificationFanout.handle` triggerId 없음 | debug | 수동 실행 또는 routing context 미등록 |
| `WebsocketService.registerExecutionRouting` | debug | routing context 등록 시점 식별 |

**warn 격상 기준**: trigger 가 정상 active + chatChannel 설정인데 다음 단계 못 가는 것 = 운영 회귀 신호. **debug 유지 기준**: 정상 케이스 (수동 실행) 도 도달하는 가드. log noise 회피.

사용자가 production 에서 새 image deploy + 재테스트 시 위 warn 들이 로그에 나타나는지 확인하면 어느 단계에서 막히는지 즉시 식별 가능.

## Follow-up #4 (2026-05-25 사용자 log 결과 분석 — waiting_for_input only)

사용자 production log:
```
[ChatChannelDispatcher] handle event execution.waiting_for_input
[WebsocketService] emit execution.waiting_for_input (routing=attached)
[ChatChannelDispatcher] WARN event execution.waiting_for_input (trigger=...) — toEiaEvent null.
  payload keys=[executionId,status,waitingNodeId,waitingNodeType,waitingNodeLabel,
  nodeExecutionId,startedAt,interactionType,conversationThread,buttonConfig,
  seq,timestamp,triggerId,workflowId,chatChannel]. outbound skip.
```

`workflowId` 가 이미 첨부됨 (PR #318 fix 정상 동작) — base 가드 통과. 그러나 `waiting_for_input` 분기 가드 `if (!node || typeof node !== 'object') return null` 에서 null. 원인 = emit (frontend WS §4.4 shape) 는 flat 인데 toEiaEvent 가 EIA spec §6.2 의 nested shape (`node` / `interaction` / `context`) 만 받음. 변환 누락.

매핑 (`chat-channel.dispatcher.ts` toEiaEvent waiting_for_input case):
- `node` ← `{ id: waitingNodeId, type: waitingNodeType, interactionType }`
- `interaction` ← `{}` (in-process path 는 사용 안 함, outbound webhook 만 채움)
- `context.buttonConfig` ← `payload.buttonConfig` (buttons 분기)
- `context.formConfig` ← `payload.nodeOutput.config` ?? `payload.nodeOutput.formConfig` (form 분기)
- `context.conversationConfig` ← `payload.nodeOutput.conversationConfig` (ai_conversation 분기)
- `context.conversationThread` ← `payload.conversationThread`

Back-compat: 외부 outbound webhook 이 다시 dispatcher 로 재진입하는 경로 또는 이미 nested shape 으로 emit 하는 path 가 추가될 가능성 — `payload.node` 가 객체로 들어오면 verbatim pass-through.

### 회귀 차단

`chat-channel.dispatcher.spec.ts` 신규 추가, 7 케이스:
1. buttons emit (flat) → context.buttonConfig 채워짐
2. form emit (flat) → context.formConfig 채워짐 (nodeOutput.config 에서 추출)
3. ai_conversation emit (flat) → context.conversationConfig 채워짐
4. nested back-compat → verbatim pass-through
5. waitingNodeId 누락 → null
6. unknown interactionType → null
7. triggerId / workflowId 누락 → null (base 가드)

### 캐러셀 텍스트 fallback 과의 관계

사용자가 처음 보고한 "캐러셀이 텔레그램에 표현되지 않음" 의 직접 원인이 본 fix. v1 fallback (`renderCarouselFallback`) 은 이미 구현되어 있으나 (PR #261), toEiaEvent 가 null 반환하면 renderer 호출 자체가 안 됨. 본 fix 후 dispatcher → renderTelegramMessages → renderButtons (visualKind='carousel') → renderCarouselFallback path 가 정상 동작.
