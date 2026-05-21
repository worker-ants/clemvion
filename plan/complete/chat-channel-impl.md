---
worktree: chat-channel-telegram-0c106c
started: 2026-05-21
owner: developer
---

# Implementation Plan: Chat Channel 어댑터 + Telegram (PR-A ~ PR-E 일괄)

[spec-draft-chat-channel](../complete/spec-draft-chat-channel.md) §11 의 PR-A~E 를 **단일 PR** 로 묶어 구현. 사용자 명시 요청 — "구현이 완료된 후 한번에 PR" — 에 따라 5 phase 를 한 branch (`claude/chat-channel-telegram-0c106c`) 에서 순차 진행.

관련 spec (모두 commit `34f7e308` 에 머지됨):
- [Spec Chat Channel](../../spec/5-system/15-chat-channel.md)
- [Convention Chat Channel Adapter](../../spec/conventions/chat-channel-adapter.md)
- [Spec Telegram Adapter](../../spec/4-nodes/7-trigger/providers/telegram.md)
- [Spec Webhook 트리거 §6.x](../../spec/5-system/12-webhook.md)
- [Spec EIA §3.3 EIA-AU-08 / §R10 / §R4](../../spec/5-system/14-external-interaction-api.md)
- [Spec Data Model §2.8 Trigger](../../spec/1-data-model.md)

---

## 0. 사전 확인

- [x] Worktree 확인 — `.claude/worktrees/chat-channel-telegram-0c106c/` 안
- [x] Spec 선독 — 위 6 spec 모두 읽음
- [x] 기존 인프라 파악 — HooksService, NotificationDispatcher, InteractionService, Trigger entity, V061 마이그레이션
- [x] consistency-check --impl-prep — `review/consistency/2026/05/21/23_49_16/` (Round 1) BLOCK: NO, Warning W-1~W-9 모두 plan §3.6 흡수

---

## 1. 영향 표면 (cross-stack)

### 1.1 Backend (codebase/backend/src/)

**신설 모듈**:
- `modules/chat-channel/chat-channel.module.ts` — NestJS module
- `modules/chat-channel/channel-adapter.registry.ts` — provider 등록
- `modules/chat-channel/chat-channel.dispatcher.ts` — NotificationDispatcher EventEmitter listener + ChannelMessage 발송 orchestrator
- `modules/chat-channel/chat-channel.controller.ts` — `POST /api/triggers/:id/chat-channel/rotate-bot-token`
- `modules/chat-channel/channel-conversation.service.ts` — Redis ChannelConversation CRUD
- `modules/chat-channel/dto/*.ts` — DTO
- `modules/chat-channel/types/*.ts` — `ChannelUpdate` / `ChannelMessage` / `EiaEvent` / `ChatChannelConfig` / `SetupResult` / `SendResult` 등 interface
- `modules/chat-channel/providers/telegram/telegram.adapter.ts`
- `modules/chat-channel/providers/telegram/telegram-client.ts` — HTTP client (Bot API)
- `modules/chat-channel/providers/telegram/telegram-update.parser.ts` — pure parseUpdate
- `modules/chat-channel/providers/telegram/telegram-message.renderer.ts` — pure renderNode

**개정 모듈**:
- `modules/external-interaction/notification-dispatcher.service.ts` — `EventEmitter` 인터페이스 노출 (`onEvent(type, handler)` / `offEvent(...)`). 기존 BullMQ enqueue 와 같은 호출 안에서 fan-out
- `modules/external-interaction/notification-dispatcher.types.ts` — `NotificationEventType` union + payload 타입 정리 (5종 event)
- `modules/external-interaction/interaction.service.ts` — `InteractionRequestContext` 에 `scope?: 'http_external' | 'in_process_trusted'` optional 필드 추가. `scope === 'in_process_trusted'` 일 때 token 관련 검증 skip (Guard 자체는 변경 없음, in-process caller 는 Guard 우회 — Service 에 들어오기 전 ctx 합성 책임이 caller 에 있음)
- `modules/hooks/hooks.service.ts` — `config.chatChannel` 분기:
  1. `registry.get(provider)` → `adapter.parseUpdate(rawBody, config.chatChannel)`
  2. `null` → 202 `{ ignored: true }`
  3. `ConversationConversationService.lookup({triggerId, conversationKey})` 조회
  4. active execution 있고 waiting_for_input → `InteractionService.interact(ctx{scope:'in_process_trusted'}, dto)` in-process 호출
  5. 없으면 `executionEngineService.execute(workflowId, {...telegramInput}, {triggerId})` 시작
- `modules/triggers/triggers.service.ts` — trigger create / update / delete 시 `chatChannel` 가 있으면 `setupChannel` / `teardownChannel` 자동 호출. `notification` 패턴 (notification-dispatcher invocation) 과 동일 구조
- `modules/triggers/dto/create-trigger.dto.ts` & `update-trigger.dto.ts` — `chatChannel` 필드 추가 (DTO + class-validator)
- `modules/triggers/entities/trigger.entity.ts` — `chat_channel_*` 5컬럼 매핑

**Migration**:
- `migrations/V062__trigger_chat_channel_columns.sql` — 5컬럼 ALTER TABLE ADD COLUMN

**테스트**:
- `modules/chat-channel/providers/telegram/__tests__/telegram-update.parser.spec.ts` — pure parser 단위
- `modules/chat-channel/providers/telegram/__tests__/telegram-message.renderer.spec.ts` — renderNode 5종 이벤트 매핑
- `modules/chat-channel/providers/telegram/__tests__/telegram.adapter.spec.ts` — adapter (mocked HTTP)
- `modules/chat-channel/__tests__/channel-conversation.service.spec.ts` — Redis CRUD (mocked redis)
- `modules/chat-channel/__tests__/chat-channel.dispatcher.spec.ts` — EventEmitter ↔ adapter 통합
- `modules/external-interaction/__tests__/notification-dispatcher.eventemitter.spec.ts` — 새 EventEmitter API
- `test/chat-channel-telegram.e2e-spec.ts` — full flow e2e (telegram update → execution → notification → telegram sendMessage mock)

### 1.2 Frontend (codebase/frontend/src/)

**개정** (PR-E 동반 작업 — spec-draft §10 의 I3):
- `app/(main)/triggers/[id]/_components/trigger-drawer.tsx` (혹은 동등 경로) — `chatChannel` 설정 패널 추가
- `lib/i18n/dict/{ko,en}/triggers.ts` — `chatChannel.*` 새 키
- `content/docs/02-nodes/trigger.mdx` & `.en.mdx` — webhook trigger 의 `config.chatChannel` 옵션 안내
- `lib/i18n/backend-labels.ts` — 새 errorCode/warningCode 매핑 (필요 시)

### 1.3 User Guide (codebase/frontend/src/content/docs/)

- `02-nodes/trigger.mdx` — webhook 트리거 옵션에 `chatChannel` 추가
- 혹은 `06-integrations-and-config/telegram.mdx` 신규 — 텔레그램 봇 등록 가이드 (선택)

---

## 2. Phase 분할 (commit 단위)

각 phase 는 `feat(chat-channel):` 단위 commit 1개. phase 안에서 lint/unit 까지 green 유지.

### Phase 1 — Foundation (코어 인프라)

스코프:
- DB 마이그레이션 V062 + Trigger entity 컬럼
- NotificationDispatcher EventEmitter API 노출 (`onEvent(type, handler)` / `offEvent(...)`)
- InteractionRequestContext `scope` 필드 추가 + Service 분기
- `modules/chat-channel/` 모듈 skeleton (module / types / registry / channel-conversation.service / chat-channel.dispatcher)
- Trigger DTO 의 `chatChannel` 필드 + validator

테스트:
- NotificationDispatcher.onEvent 단위
- ChannelAdapterRegistry 단위
- ChannelConversationService 단위 (Redis mock)
- InteractionService — `scope:'in_process_trusted'` 분기 단위

Commit: `feat(chat-channel): foundation — V062, registry, dispatcher EventEmitter, InteractionRequestContext scope`

### Phase 2 — PR-A: Telegram Adapter + AI Multi Turn 텍스트 (1차 usable milestone)

스코프:
- `telegram-client.ts` (axios/fetch wrapper) — `setWebhook` / `deleteWebhook` / `getMe` / `sendMessage` / `sendChatAction`
- `telegram-update.parser.ts` — `parseUpdate` 의 모든 명령 매핑 (`/start`, `/cancel`, text, callback_query, file_upload, contact_share, group_chat refusal, bot refusal)
- `telegram-message.renderer.ts` — `renderNode` 의 text 이벤트만 (ai_message / completed / failed / cancelled / waiting_for_input(ai_conversation))
- `telegram.adapter.ts` — 6함수 구현 (buttons / form_prompt / image / typing 은 stub `throw NotImplemented` — PR-B~D 에서 채움)
- `triggers.service.ts` — `setupChannel` / `teardownChannel` 호출
- `hooks.service.ts` — `config.chatChannel` 분기 (parseUpdate → execute or interact)
- `chat-channel.dispatcher.ts` — 5종 event listener attach, AI Multi Turn / completed / failed / cancelled 만 처리

테스트:
- parser fixtures (10+ raw update samples)
- renderer (5 event types, text 출력만)
- adapter setupChannel / teardownChannel / sendMessage(text) — mocked HTTP
- dispatcher listener — emit → renderNode → sendMessage call chain
- e2e: webhook receive → execution.execute → notification.emit → telegram.sendMessage HTTP mock 호출 검증

Commit: `feat(chat-channel): PR-A — Telegram adapter (AI Multi Turn 텍스트 only)`

### Phase 3 — PR-B: Button Presentation (inline_keyboard)

스코프:
- `telegram-message.renderer.ts` — `waiting_for_input(buttons)` → `buttons` body
- `telegram.adapter.ts` — `sendMessage(buttons)` → `sendMessage` + `inline_keyboard`, `ackInteraction` (`answerCallbackQuery`), `parseUpdate(callback_query)` 처리
- `hooks.service.ts` — `command:'button_callback'` 도착 시 `InteractionService.interact({command:'click_button', buttonId})` 호출
- `chat-channel.dispatcher.ts` — `waiting_for_input(buttons)` 분기, `editMessageReplyMarkup` 으로 직전 키보드 제거 (옵션)

테스트:
- renderer button output (auto / vertical / horizontal layout)
- adapter inline_keyboard JSON 구조
- e2e: 사용자 click_button → click_button 명령 EIA 호출 → 다음 노드 실행

Commit: `feat(chat-channel): PR-B — Button Presentation (inline_keyboard)`

### Phase 4 — PR-C: Form 다단계 시퀀스

스코프:
- `telegram-message.renderer.ts` — `waiting_for_input(form)` → `form_prompt` first field
- `chat-channel.dispatcher.ts` — Form 다단계 시퀀스 state machine (currentFieldIdx / partialFormData) — ChannelConversation 안에 보관
- `hooks.service.ts` — text_message 도착 시 dispatcher 에게 위임. dispatcher 가 EIA submit_form 호출 결정
- 필드 type 별 keyboard hint (number / select / radio / checkbox / phone / file / date)
- server-side validation 실패 시 currentFieldIdx 복원 + 같은 필드 재질문

테스트:
- 다단계 시퀀스 unit (state transitions)
- type 별 keyboard hint 매핑
- e2e: form 3필드 → 1필드씩 응답 → submit_form 발행 → 완료

Commit: `feat(chat-channel): PR-C — Form 다단계 시퀀스`

### Phase 5 — PR-D: Chart (sendPhoto)

스코프:
- `telegram-message.renderer.ts` — `waiting_for_input(buttons)` 의 `nodeOutput.nodeType === 'chart'` 인 경우 image body 추가
- `telegram.adapter.ts` — `sendMessage(image)` (sendPhoto)
- 기존 chart 노드의 SVG → PNG 변환 재사용 (가능하면 chart 노드 핸들러의 helper 사용)
- carousel / table 은 v1 분리 — `unsupported` fallback (text caption 만)

테스트:
- renderer chart 분기 (image + buttons)
- adapter sendPhoto (mocked HTTP)
- e2e: chart waiting_for_input → image + buttons 발송

Commit: `feat(chat-channel): PR-D — Chart sendPhoto + carousel/table fallback`

### Phase 6 — PR-E: 안정화 + Frontend + 가이드

스코프 (backend):
- Rate limit: 채널당 분당 60건 limiter (CCH-NF-03)
- Retry: sendMessage 5초 타임아웃 + 3회 지수 백오프 (1s/2s/4s), 실패 시 `chat_channel_health=degraded`
- `/cancel` 명령 처리 (EIA cancel)
- file_upload / contact_share 처리 (allowedMimeTypes 검증)
- Bot token rotation API: `POST /api/triggers/:id/chat-channel/rotate-bot-token` — 24h grace
- group chat 거부 (이미 parseUpdate 단계에서 null)
- update_id 30초 dedup (CCH-SE-02)
- secret_token (`X-Telegram-Bot-Api-Secret-Token`) 검증

스코프 (frontend):
- Trigger drawer — `chatChannel` 설정 패널 (`provider` select, `botToken` 입력, `botIdentity` 표시 read-only, `uiMapping` 옵션)
- `chat_channel_health` 배지 표시 (unknown/healthy/degraded)
- i18n dict ko/en 신규 키

스코프 (user-guide / 문서):
- `02-nodes/trigger.mdx` & `.en.mdx` — chatChannel 옵션 안내
- (선택) `06-integrations-and-config/telegram.mdx` 신규

테스트:
- rate limit unit
- retry / health 갱신 단위
- rotate-bot-token e2e
- frontend trigger drawer e2e (playwright mock)
- i18n parity / locale / backend-labels 가드

Commit: `feat(chat-channel): PR-E — 안정화 + frontend trigger drawer + 가이드`

### Phase 7 — TEST WORKFLOW

- `.claude/tools/run-test.sh lint` (backend + frontend 양쪽)
- `.claude/tools/run-test.sh unit` (backend + frontend)
- `.claude/tools/run-test.sh build` (backend + frontend)
- `.claude/tools/run-test.sh e2e` (`make e2e-test`)

Commit (필요 시): `test(chat-channel):` 또는 `style(chat-channel):` (포맷 fix)

### Phase 8 — REVIEW WORKFLOW

- `/ai-review` 호출 → SUMMARY 검토 → resolution-applier (또는 수동)
- (옵션) `/consistency-check --impl-done spec/5-system/15-chat-channel.md spec/conventions/chat-channel-adapter.md spec/4-nodes/7-trigger/providers/telegram.md`

Commit: `refactor(chat-channel):` (이슈 fix) + `docs(review):` (RESOLUTION.md)

### Phase 9 — plan complete

`chore(plan): mark chat-channel-impl complete` — 본 plan + spec-draft-chat-channel 둘 다 `complete/` 에 머문 채 commit.

---

## 3. 명시 결정

### 3.1 In-process event subscription — `WebsocketService.executionEvents$` (RxJS Subject)

**Implementation discovery (Phase 1 진입 시 확인)**: spec 의 "NotificationDispatcher EventEmitter" 는 실제 SoT 가 [`WebsocketService.executionEvents$`](../../codebase/backend/src/modules/websocket/websocket.service.ts) — RxJS `Subject<ExecutionChannelEvent>`. 기존 두 facade ([`NotificationFanout`](../../codebase/backend/src/modules/external-interaction/notification-fanout.service.ts), [`SseAdapter`](../../codebase/backend/src/modules/external-interaction/sse-adapter.service.ts)) 가 모두 같은 Subject 를 `onModuleInit` 안에서 subscribe — 어댑터는 본 패턴을 그대로 따른다.

```typescript
@Injectable()
export class ChatChannelDispatcher implements OnModuleInit, OnModuleDestroy {
  private subscription: { unsubscribe: () => void } | null = null;

  constructor(
    private readonly websocketService: WebsocketService,
    private readonly registry: ChannelAdapterRegistry,
    // ...
  ) {}

  onModuleInit(): void {
    this.subscription = this.websocketService.executionEvents$.subscribe({
      next: (event) => void this.handle(event),
      error: (err) => this.logger.error(`ChatChannelDispatcher: ${err}`),
    });
  }
}
```

`NotificationDispatcher` 자체에 새 API 신설은 불필요. spec 본문의 "NotificationDispatcher EventEmitter" 표현은 본 PR 의 post-impl spec touch 에서 "WebsocketService.executionEvents$ Subject (SoT)" 로 정정 — 두 표현이 가리키는 facade 가 동일하므로 R10 의 단일 sink 정책은 그대로 유지.

### 3.2 InteractionRequestContext `scope` 필드

```typescript
// interaction.service.ts (또는 별도 types.ts)
type InteractionScope = 'http_external' | 'in_process_trusted';

interface InteractionRequestContext {
  executionId: string;
  tokenFamily: 'iext' | 'itk';
  triggerId?: string;
  scope?: InteractionScope; // optional — 기존 호출자는 영향 없음
}
```

Service 분기:
- `scope === 'in_process_trusted'`: 모든 token 관련 추가 검증 skip (Guard 가 이미 통과한 것으로 가정 — in-process caller 는 Guard 우회)
- 그 외 (기존 동작): Guard 가 ctx 합성 후 service 에 진입했으므로 추가 검증 없음

**중요**: 외부 HTTP guard (`InteractionGuard.canActivate`) 는 `ctx.scope` 를 절대 set 하지 않는다. ChatChannelDispatcher 만 `scope:'in_process_trusted'` 로 ctx 합성. 본 invariant 는 단위 테스트로 보호.

### 3.3 ChannelConversation Redis 키

```
chat-channel:{triggerId}:{conversationKey}
```

TTL 7일. `ChannelConversationService` 가 Redis `set`/`get`/`expire` wrapper.

값 schema:
```typescript
interface ChannelConversationState {
  executionId: string | null;
  threadId: string;
  channelUserKey: string;
  startedAt: string;
  lastUpdateAt: string;
  // Form 다단계용 (Phase 4)
  formState?: {
    nodeId: string;
    currentFieldIdx: number;
    partialFormData: Record<string, unknown>;
  };
}
```

### 3.4 Telegram bot token 보관 (v1 stub — notification.signing.secret 와 동일)

Spec §4.1 의 `"botTokenRef": "secret://triggers/:id/bot-token"` 는 **미래 형태**. spec §4.1 본문이 명시:

> `botTokenRef` 는 EIA §7.1 의 `config.notification.signing.secret` 와 **동일 보안 정책** — 향후 암호화 컬럼으로 분리. v1 은 JSONB 평문 금지 + secret reference 만 보관.

현재 `notification.signing.secret` 는 `Trigger.config.notification.signing.secret` 에 plaintext 로 보관 ([triggers.service.ts 확인](../../codebase/backend/src/modules/triggers/triggers.service.ts) — 향후 암호화 컬럼 stub). "동일 보안 정책" 의 의미는 **둘 다 v1 단계에서 동일 stub 상태** 를 따른다는 것.

→ **결정**: v1 의 active bot token 은 `Trigger.config.chatChannel.botToken` 에 plaintext 보관 (notification.signing.secret 와 동일 stub). spec §4.1 의 `botTokenRef` 필드는 미래 형태로 spec 본문에는 그대로 두되, v1 구현은 추가 필드 `botToken` 으로 받아 저장. DTO 안에서 `botToken` (입력) → entity 안 저장 시 `botToken` 그대로 유지. PR-E 의 rotate-bot-token API 는 `chat_channel_token_v2` 컬럼 + 24h grace 패턴을 그대로 따름 (notification rotation 과 정합).

스펙 amendment 필요성: 본 결정은 spec §4.1 의 v1 implementation 형식이 명확하지 않은 ambiguity 를 stub 으로 채우는 것이라, post-impl 단계에서 spec §4.1 에 "v1: `botToken` plaintext stub — notification.signing.secret 와 정합" 한 줄 추가 권고 → `plan/in-progress/spec-update-chat-channel-bot-token-stub.md` (post-impl). 본 PR 자체는 차단하지 않음 — spec 의 "동일 보안 정책" 표현이 이미 stub 허용 의도를 포함하므로.

### 3.5 e2e mock 전략

Telegram Bot API 호출은 실제 텔레그램 서버로 가지 않게 mock. 옵션:
- nock (HTTP request mock)
- 또는 `TelegramClient` 를 DI 로 주입해 e2e 에서 fake impl 로 교체

→ **결정**: `TelegramClient` 를 NestJS provider 로 등록, e2e module 에서 `FakeTelegramClient` 로 override. nock 은 의존성 추가 부담.

---

## 3.6 consistency-check --impl-prep Round 1 결과 흡수 (2026-05-21 23:49:16)

[Round 1 SUMMARY](../../review/consistency/2026/05/21/23_49_16/SUMMARY.md) — BLOCK: NO, Critical 0, Warning 9, Info 15.

| ID | 조치 |
|----|------|
| W-1 secretToken 필드 누락 (`ChatChannelConfig` + JSONC 예시) | 본 PR 안에서 spec 보강: `spec/conventions/chat-channel-adapter.md §2.3` 의 `ChatChannelConfig` 에 `secretToken?: string`, `spec/5-system/15-chat-channel.md §4.1` JSONC 에 동 필드 추가. 보안 정책: 서버가 setupChannel 시점에 랜덤 발급, `botToken` 과 동일 plaintext stub. 후속 암호화 컬럼 분리는 `botTokenRef` 와 함께. (Phase 1 안 spec 미세 보강 commit) |
| W-2 `telegram.md §5.4` 중복 | 본 PR 안 spec fix: 보안 섹션을 `## 6. 보안` 으로 승격 + 후속 섹션 번호 재정렬. 명령 처리 `§6 → §7`, 비기능 `§7 → §8`. `15-chat-channel.md §5.1` anchor 갱신 |
| W-3 `template` 노드 CCH-MP-04 범위 외 | `telegram.md §5.4` template 행에 "CCH-MP-04 범위 외 — v2 구현 대상" 주석 추가. v1 코드에서는 template 분기 noop |
| W-4 Form `phone` 타입 미정의 | spec fix 회피 — `telegram.md §5.3` phone 행 비고를 "type=text + custom validation rule (phone pattern)" 로 정정. Form spec 비침습 |
| W-5 `## 5.4 보안` 위치 (W-2 와 동일 처리) | W-2 와 통합 |
| W-6 API endpoint depth 4 | `spec/5-system/2-api-convention.md` 에 "RPC-style sub-channel action endpoint 예외: `/{resource}/{id}/{channel}/{action}`" 한 줄 추가. EIA `/notification/rotate-secret` 도 동일 패턴이라 선례 확보 |
| W-7 V062 마이그레이션 슬롯 — eia-jti-tracking 경합 | 본 PR 의 V062 슬롯 선점. `eia-jti-tracking` 은 미결 결정 3건으로 즉시 착수 상태 아니므로 V063+ 사용 권고를 그쪽 plan 에 cross-reference 한 줄로 기록 |
| W-8 trigger-drawer 동시 편집 — eia-trigger-edit-ui | 본 PR 의 Phase 6 가 먼저 머지. `eia-trigger-edit-ui` 는 그 위에 rebase. 두 plan 의 작업 영역이 sub-component (chatChannel panel vs notification/interaction panel) 로 분리 가능 |
| W-9 triggers.service.ts 동시 편집 — eia-secret-rotation-revoke-api | 본 PR 의 setupChannel/teardownChannel 추가는 새 메서드. eia-secret-rotation-revoke-api 의 rotation/revoke 도 새 endpoint — 같은 클래스의 다른 메서드 추가라 hunk 충돌 가능성 낮음. 양쪽 PR 제출 전 rebase 검증 권고 |
| I-6 `parseUpdate` side-effect free vs `groupChatRefusal` 안내 | `telegram.md §4` 표 갱신: "null 반환 — 호출자(HooksService)가 별도 sendMessage 발송" 로 정정. 구현은 HooksService 가 어댑터의 `null` 응답 + `chat.type === 'group'` 케이스에 sendMessage 호출 |
| I-13 botTokenRef v1 plaintext 추적 plan | Phase 6 완료 시점에 `plan/in-progress/spec-update-chat-channel-bot-token-stub.md` 생성 (post-impl follow-up) |
| 기타 Info (I-1, I-2, I-3, I-4, I-5, I-7, I-8, I-9, I-10, I-11, I-12, I-14, I-15) | 본 PR 비차단. spec 미세 다듬기는 별 plan 으로 분리 — `plan/in-progress/spec-touchup-chat-channel-info.md` (post-impl) |

본 절의 spec 보강 commit 은 `docs(spec):` prefix 로 분리. 코드 commit (`feat(chat-channel):`) 과 한 PR 안에 공존.

---

## 4. consistency-check --impl-prep 호출 계획

본 plan 작성 직후 호출. 검토 대상 spec:
- `spec/5-system/15-chat-channel.md`
- `spec/conventions/chat-channel-adapter.md`
- `spec/4-nodes/7-trigger/providers/telegram.md`
- `spec/5-system/12-webhook.md` (§6.x 개정)
- `spec/5-system/14-external-interaction-api.md` (EIA-AU-08, §R10, §R4)
- `spec/1-data-model.md` (§2.8)

검토 포인트:
- Cross-spec: NotificationDispatcher EventEmitter 신설이 EIA §R10 의 단일 sink 원칙과 어긋나지 않는지
- Rationale continuity: §3.4 의 active bot token 컬럼 누락 결정이 spec follow-up 분리로 정당화되는지
- Convention: 모듈 구조 `modules/chat-channel/` 가 기존 `modules/external-interaction/` 패턴과 정합
- Plan coherence: `eia-trigger-edit-ui` plan 과의 trigger 드로어 spec 동시 편집 충돌 (W-9)
- Naming: V062 마이그레이션 번호 + Redis key prefix `chat-channel:` + endpoint `/chat-channel/rotate-bot-token`

Critical 발견 시 본 plan 갱신 후 재호출. Warning 은 본 plan 의 §3 결정 또는 Phase 별 노트로 흡수.

---

## 5. 후속 plan (별 PR 분리 예정)

본 plan 머지 후 별 PR 로 분리:
- `chat-channel-carousel-table-ssr.md` — Carousel / Table SSR 인프라 (PR-D 분리분, satori 도입)
- `chat-channel-slack-adapter.md` — Slack provider 추가 (어댑터 확장 검증)
- `chat-channel-multi-user-thread.md` — v2 group chat 지원

---

## 6. 진행 체크리스트

- [x] consistency-check --impl-prep 호출 + Critical 0 확인 — Round 1 BLOCK: NO
- [x] Phase 1 — Foundation commit (`725a412f`)
- [x] Phase 2 — PR-A baseline + 통합부 commit (`725a412f` + `d6a0f57f`)
- [x] Phase 3 — PR-B commit (`a692d75d`)
- [x] Phase 4 — PR-C commit (`a692d75d`)
- [x] Phase 5 — PR-D commit (`a692d75d` 의 v1 = text caption fallback. carousel/table SSR 은 spec §3.3 CCH-MP-04 의 "단계적" 정책대로 후속 plan `chat-channel-carousel-table-ssr.md` 로 분리)
- [x] Phase 6 — PR-E backend commit (`923d29f2`) + user-guide commit (`bb1e5e99`). Frontend trigger drawer chatChannel 패널은 spec-fix-chat-channel-arch.md follow-up 으로 분리
- [x] Phase 7 — TEST WORKFLOW 4 stage 모두 green (`220e8ff5`) — lint PASS, unit 4333 pass, build PASS, e2e 98 pass
- [x] Phase 8 — /ai-review 호출 + resolution-applier (`36ffed71` + `2126a1b5` + `bb1e5e99` + `626399e4`) + RESOLUTION.md (`review/code/2026/05/22/00_52_38/RESOLUTION.md`). 16 SUMMARY 항목 중 8건 코드 fix, 6건 spec-fix draft 위임, 1건 stale-rebase 비차단, 1건 이미 해결
- [x] Phase 9 — plan complete + spec-draft 와 같은 디렉토리로 (본 commit)

각 phase 종료 시 본 체크박스 갱신.
