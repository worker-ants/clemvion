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
- [ ] 7. TEST WORKFLOW (follow-up #2)
- [ ] 8. PR + 사용자 재배포·재테스트·log 확인

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
