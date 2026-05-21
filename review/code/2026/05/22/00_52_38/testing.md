# Testing 관점 코드 리뷰

**검토 대상**: Chat Channel Telegram 어댑터 + 관련 spec/plan 변경 (35개 파일)
**검토 일시**: 2026-05-22
**검토 관점**: 테스트 존재 여부, 커버리지 갭, 엣지 케이스, Mock 적절성, 격리, 가독성, 회귀, 테스트 용이성

---

## 발견사항

### [WARNING] HooksService — Chat Channel 분기 경로가 통합 테스트에서 전혀 커버되지 않음
- **위치**: `/codebase/backend/src/modules/hooks/hooks.service.spec.ts`
- **상세**: `hooks.service.spec.ts` 에 `ChannelAdapterRegistry` / `ChannelConversationService` / `InteractionService` mock 이 등록되어 있으나, `config.chatChannel` 이 존재하는 trigger 로 `handleWebhook` 을 호출하는 테스트 케이스가 **한 건도 없다**. `12-webhook.md` 처리 흐름 §7 에 기술된 분기 (parseUpdate → null 이면 202+ignored, 활성 execution 이 있으면 `InteractionService.interact()`, 없으면 `ExecutionEngineService.execute()`) 는 현재 테스트되지 않는다.
- **커버리지 갭**:
  1. `parseUpdate` 가 null 반환 시 202 + `{ ignored: true }` 즉시 반환 경로
  2. `ChannelConversationService.lookup()` 이 활성 execution 을 반환할 때 `InteractionService.interact()` 인-프로세스 호출 경로
  3. `ChannelConversationService.lookup()` 이 null 반환 시 신규 `ExecutionEngineService.execute()` 호출 경로
  4. `ChannelConversationService.upsert()` 와 `updateExecutionId()` 의 호출 순서 검증
- **제안**: `hooks.service.spec.ts` 에 `describe('Chat Channel 분기')` 블록을 추가하고, `activeTrigger` 의 `config` 에 `chatChannel: { provider: 'telegram', botToken: 'tok' }` 를 설정한 fixture 를 사용하여 위 4개 경로를 개별 it() 으로 테스트. `ChannelAdapterRegistry.get()` mock 이 `parseUpdate` 를 `jest.fn()` 으로 반환하도록 설정.

---

### [WARNING] InteractionGuard — `scope: 'in_process_trusted'` 플래그 관련 테스트 부재
- **위치**: `/codebase/backend/src/modules/external-interaction/interaction.guard.spec.ts`
- **상세**: EIA-AU-08 (`InteractionRequestContext.scope: 'in_process_trusted'` 를 통한 token bypass) 가 spec 에 명시되어 있으나, `interaction.guard.spec.ts` 에 이 플래그를 검증하는 케이스가 없다. 구현 시 Guard 가 `scope: 'in_process_trusted'` 를 set 하거나 우회를 허용하는 경로를 실수로 HTTP 표면에 노출할 위험이 있다. 특히 "외부 HTTP guard 는 이 플래그를 절대 set 하지 않는다" 라는 EIA-AU-08 의 불변 조건이 guard 단에서 강제되는지 테스트가 없다.
- **제안**: 두 케이스 추가: (1) `req.interaction.scope = 'in_process_trusted'` 가 외부 HTTP 요청 컨텍스트에서 사전에 설정되어 들어와도 Guard 가 이를 덮어쓰거나 무시하는지 확인, (2) bypass 경로가 `scope` 플래그 여부를 기반으로 실제로 토큰 검증을 skip 하는지 확인 (단, 이 경로가 HTTP guard 를 통하지 않는다는 사실을 시스템 레벨에서 보장하는 통합 테스트 필요).

---

### [WARNING] NotificationDispatcher — Chat Channel 어댑터 EventEmitter 리스너 등록 경로 미테스트
- **위치**: `/codebase/backend/src/modules/external-interaction/notification-dispatcher.service.spec.ts`
- **상세**: EIA §R10 확장으로 NotificationDispatcher 가 after-commit hook 시점에 in-process EventEmitter 를 emit 하여 Chat Channel 어댑터가 listener 로 attach 하는 구조가 추가되었다. 기존 `notification-dispatcher.service.spec.ts` 는 `enqueue()` (BullMQ 큐 추가) 만 검증하며, EventEmitter emit 경로나 listener 등록 API 에 대한 테스트가 없다. 이 구독 메커니즘이 실제로 구현될 때 (1) emit 이 올바른 이벤트 구조를 전달하는지, (2) listener 가 attach/detach 되는지 미검증.
- **제안**: NotificationDispatcher 에 `onEvent(listener)` / `offEvent(listener)` 류의 API 가 추가될 것으로 예상되며, 이에 대한 단위 테스트를 미리 정의. 최소한 `emit` 이 호출될 때 등록된 listener 가 올바른 EiaEvent payload 를 받는지 검증하는 케이스가 필요.

---

### [WARNING] ChannelConversationService 전용 단위 테스트 파일 부재
- **위치**: `/codebase/backend/src/modules/chat-channel/` 디렉토리
- **상세**: `channel-adapter.registry.spec.ts`, `telegram-update.parser.spec.ts`, `telegram-message.renderer.spec.ts` 는 존재하나, `ChannelConversationService` (Redis 기반 `chat-channel:{triggerId}:{conversationKey}` 키 관리, lookup/upsert/updateExecutionId) 에 대한 전용 spec 파일이 없다. 이 서비스는 conversation 상태 추적의 핵심으로, lookup miss 시 신규 execution 시작 여부를 결정한다.
- **엣지 케이스 누락**:
  - Redis key TTL 만료 후 `lookup()` 이 null 반환하는 경우
  - 동시 요청 race condition (두 update 가 거의 동시에 도착 시 같은 conversation 에 두 execution 이 시작되는 경우)
  - `conversationKey` 에 특수문자 포함 시 key 인코딩
- **제안**: `channel-conversation.service.spec.ts` 를 신설하고 Redis mock (ioredis mock 또는 `@jest-mock/redis`) 을 사용하여 CRUD 경로를 단위 테스트.

---

### [WARNING] TelegramAdapter (setupChannel / teardownChannel / sendMessage / ackInteraction) 미테스트
- **위치**: `/codebase/backend/src/modules/chat-channel/providers/telegram/`
- **상세**: `telegram-update.parser.spec.ts` 와 `telegram-message.renderer.spec.ts` 는 존재하지만, Telegram Bot API 를 실제로 호출하는 `TelegramAdapter` 클래스 자체 (setupChannel: `setWebhook`, teardownChannel: `deleteWebhook`, sendMessage: `sendMessage`/`sendPhoto`, ackInteraction: `answerCallbackQuery`) 에 대한 테스트가 없다. 특히:
  - `setupChannel` 시 `setWebhook` 실패 → `SetupResult` 에 error 정보 포함 여부
  - `secretToken` 이 생성/저장되고 webhook 검증에 사용되는지 (CCH-SE-02: X-Telegram-Bot-Api-Secret-Token 검증)
  - Bot API 429 (rate limit) 응답 시 재시도 / 에러 전파 처리
  - `sendMessage` 실패 시 `chat_channel_health` → `degraded` 전환 트리거 여부
- **제안**: `telegram.adapter.spec.ts` 를 신설. Bot API HTTP 호출을 `jest.spyOn` 또는 `nock` 으로 mock 하여 각 메서드의 happy path + 에러 경로 테스트.

---

### [WARNING] 처리 흐름 중 `parseUpdate` 의 side-effect free 계약 위반 가능성에 대한 테스트 없음
- **위치**: `spec/4-nodes/7-trigger/providers/telegram.md §4` (group chat refusal 발송) + `spec/conventions/chat-channel-adapter.md §1.1`
- **상세**: Convention R1 에서 `parseUpdate` 는 "pure, side-effect 없음" 으로 선언되어 있으나, `telegram.md §4` 의 group chat 감지 시 "안내 발송" 기술이 모호하여 구현 시 `parseUpdate` 내부에서 `sendMessage` 를 호출하는 실수가 발생할 수 있다. 현재 `telegram-update.parser.spec.ts` 에서 group chat → null 반환은 테스트하지만, `sendMessage` 가 호출되지 않는다는 side-effect 없음을 명시적으로 검증하지 않는다.
- **제안**: `parseTelegramUpdate` 가 외부 함수 (sendMessage, axios 등) 를 전혀 호출하지 않음을 보장하는 mock 전략 추가. 또는 `parseUpdate` 가 반환값에 optional `refusal` 필드를 담고 호출자가 `sendMessage` 를 처리한다는 계약을 spec 및 테스트에 명시.

---

### [INFO] telegram-message.renderer.spec.ts — CCH-MP-04 범위 (carousel, table, chart) 테스트 케이스 없음
- **위치**: `/codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.spec.ts`
- **상세**: 현재 테스트는 `ai_message`, `completed`, `failed`, `cancelled`, `waiting_for_input(ai_conversation)`, `waiting_for_input(buttons)`, `waiting_for_input(form)` 을 커버한다. `waiting_for_input(carousel)` / `waiting_for_input(chart)` / `waiting_for_input(table)` 의 SSR PNG 변환 경로 (`CCH-MP-04`) 는 PR-B 이후 scope 이지만, `renderTelegramMessages` 가 미지원 `interactionType` 을 수신했을 때 fallback 메시지를 반환하는지 (silent drop vs. error) 의 엣지 케이스가 없다.
- **제안**: 미지원 nodeType 수신 시 fallback 텍스트를 반환하는지 또는 빈 배열을 반환하는지 명시하는 케이스 1건 추가.

---

### [INFO] interaction.guard.spec.ts — `in_process_trusted` 분기가 HTTP guard bypass 를 허용하지 않는다는 역방향 검증 없음
- **위치**: `/codebase/backend/src/modules/external-interaction/interaction.guard.spec.ts`
- **상세**: 앞서 WARNING 과 관련. `scope: 'in_process_trusted'` 는 "HTTP 표면을 거치지 않는 in-process 직접 호출 경로에 한정" 이라고 spec 에 명시되어 있는데, 실제 Guard 구현이 이를 강제하는지 (HTTP 요청 헤더나 body 로 scope 를 주입하는 공격에 취약하지 않은지) 검증하는 테스트가 없다.
- **제안**: "Authorization 헤더에 scope 힌트를 포함시켜도 Guard 가 in_process_trusted bypass 를 허용하지 않는다" 케이스 추가.

---

### [INFO] plan 문서 (파일 1, 2) — 테스트 계획이 언급되어 있으나 완료 여부 추적 불가
- **위치**: `plan/in-progress/node-config-required-defaults-sweep.md`
- **상세**: 체크리스트에 "각 commit 에 `*.schema.spec.ts` 단위 테스트 추가" 가 명시되어 있고, `carousel.schema.spec.ts:70-96` 을 패턴으로 참조한다. commit 1~3 체크박스가 [x] 이므로 테스트가 추가되었다고 전제되지만, 실제 파일이 이 PR diff 에 포함되지 않아 확인이 불가하다.
- **제안**: integration/send-email/http-request 의 `*.schema.spec.ts` 와 logic 의 `logic-ui-required.spec.ts` 가 실제로 갱신되었는지 리뷰어가 개별 확인 권장.

---

### [INFO] consistency review 문서 (파일 3~25) — 테스트 관점에서 검토할 코드 변경 없음
- **위치**: `review/consistency/2026/05/21/*/` 하위 문서 전체
- **상세**: 이 파일들은 consistency check 아티팩트 (분석 결과 문서 + 재시도 상태 JSON) 이다. 코드가 아니므로 단위/통합 테스트 대상이 아니며, 테스트 관점의 발견사항 없음.

---

### [INFO] spec 문서 변경 (파일 26~35) — 직접적 테스트 대상 아님, 단 테스트 전략 영향
- **위치**: `spec/1-data-model.md`, `spec/5-system/12-webhook.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md` 등
- **상세**: spec 변경은 테스트 코드가 아니나, 구현 시 아래 항목에 대한 테스트 추가 계획이 필요하다:
  - `spec/1-data-model.md` 신규 컬럼 5개 → migration 파일 + `migrations.spec.ts` 연동 확인
  - `spec/5-system/15-chat-channel.md §3.4 CCH-NF-01` (parseUpdate ≤50ms) → 성능 assertion 또는 타임아웃 테스트 필요
  - `CCH-CV-03` (활성 execution → interact, 종료 → 신규 시작) → hooks.service 에 통합 테스트 필요 (WARNING 항목과 동일)

---

## 요약

이 PR 에서 테스트가 가장 잘 된 영역은 `parseTelegramUpdate` (순수 파서 함수, 14개 케이스)와 `renderTelegramMessages` (렌더러, 9개 케이스), `ChannelAdapterRegistry` (5개 케이스) 이다. 이들은 격리가 잘 되어 있고 의도가 명확한 좋은 단위 테스트다. 그러나 시스템 통합 경로인 HooksService 의 Chat Channel 분기 (parseUpdate 결과에 따른 분기, ChannelConversationService lookup, in-process InteractionService.interact 호출) 는 전혀 테스트되지 않아 가장 큰 커버리지 갭이 존재한다. EIA-AU-08 의 in-process trusted caller bypass 도 Guard 단에서 검증이 없다. ChannelConversationService (Redis 기반 conversation 상태 관리) 전용 spec 파일도 부재하여 이 PR 에서 가장 중요한 상태 관리 로직이 테스트되지 않는다. 또한 TelegramAdapter 의 외부 API 호출 경로 (setWebhook, sendMessage, ackInteraction) 에 대한 mock 기반 테스트가 없다. 이 PR 이 spec+plan 단계라 아직 구현 코드가 완성되지 않은 파일도 있으나, 이미 존재하는 `hooks.service.spec.ts` 에서 Chat Channel 분기 케이스를 추가하는 것은 지금 가능하다.

---

## 위험도

**HIGH**

Chat Channel 분기 처리 경로 (HooksService) 와 EIA-AU-08 bypass 경로가 전혀 테스트되지 않아, 구현 착수 시 회귀 위험이 높다. ChannelConversationService 도 핵심 상태 관리 컴포넌트임에도 테스트가 없다.

---

STATUS: SUCCESS ISSUES=8 PATH=/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-telegram-0c106c/review/code/2026/05/22/00_52_38/testing.md RESET_HINT=
