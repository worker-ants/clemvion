---
id: discord
status: implemented
code:
  - codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts
  - codebase/backend/src/modules/chat-channel/providers/discord/discord-client.ts
  - codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.ts
  - codebase/backend/src/modules/chat-channel/providers/discord/discord-signing.ts
  - codebase/backend/src/modules/chat-channel/providers/discord/discord-update.parser.ts
  - codebase/backend/src/modules/chat-channel/providers/discord/discord.types.ts
  - codebase/backend/src/modules/chat-channel/chat-channel-inbound-authenticator.ts
  - codebase/backend/src/modules/hooks/hooks.service.ts
  - codebase/backend/src/modules/hooks/hooks.controller.ts
  - codebase/backend/test/chat-channel-discord.e2e-spec.ts
  - codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts
  - codebase/frontend/src/app/(main)/triggers/page.tsx
  - codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx
  - codebase/frontend/src/lib/i18n/dict/ko/triggers.ts
  - codebase/frontend/src/lib/i18n/dict/en/triggers.ts
  - codebase/frontend/src/content/docs/06-integrations-and-config/discord.mdx
  - codebase/frontend/src/content/docs/06-integrations-and-config/discord.en.mdx
---

# Spec: Discord Chat Channel Adapter

> 관련 문서: [Provider Catalog](./_overview.md) · [Spec Chat Channel](../../../5-system/15-chat-channel.md) · [Convention Chat Channel Adapter](../../../conventions/chat-channel-adapter.md) · [Convention Secret Store](../../../conventions/secret-store.md) · [Spec External Interaction API](../../../5-system/14-external-interaction-api.md) · [Spec Webhook 트리거](../../../5-system/12-webhook.md) · [Spec AI Agent](../../3-ai/1-ai-agent.md) · [Spec Form](../../6-presentation/4-form.md) · [Spec Presentation 공통](../../6-presentation/0-common.md) · [Spec Telegram Adapter](./telegram.md) · [Spec Slack Adapter](./slack.md)

[Spec Chat Channel](../../../5-system/15-chat-channel.md) 의 어댑터 인터페이스 ([Convention Chat Channel Adapter](../../../conventions/chat-channel-adapter.md)) 의 **Discord 구체 구현 명세**. Discord REST API + Interactions Webhook 위에서 워크플로우를 chat bot 으로 운영할 때 어댑터가 어떻게 동작해야 하는지 정의.

---

## Overview (제품 정의)

### 1. 개요

`provider: "discord"` 어댑터는 [Discord REST API](https://discord.com/developers/docs/reference) + [Interactions Webhook](https://discord.com/developers/docs/interactions/receiving-and-responding) 위에 동작한다. 사용자가 Discord Developer Portal 에서 Application + Bot 을 생성하고 bot token + application public key 를 등록하면, 어댑터가 slash command bulk overwrite 로 우리 명령을 Discord 에 등록하고, 워크플로우의 인터랙션 노드 5종을 Discord UI (Message Components / Embeds / Modal) 로 자동 변환한다.

**v1 = Interactions Webhook only**. Discord 의 [Gateway WebSocket](https://discord.com/developers/docs/topics/gateway) 은 bot 별 long-lived connection + heartbeat 관리가 추가 부담이므로 v2 옵션 (Rationale R-D-3). v1 사용자는 자유 텍스트 채팅 대신 **slash command / button / modal 기반 명령** 으로 워크플로우와 상호작용한다 (R-D-3 의 결과: AI Multi Turn 의 사용자 reply 는 modal/component 입력으로 표현).

### 2. 사용 시나리오

| 시나리오 | 설명 |
|---|---|
| Discord 봇 명령 워크플로우 | 사용자가 `/workflow start` slash → AI 응답 → "다음" 버튼 / modal 로 reply |
| Discord 봇 결재 | 사용자 `/workflow approve` → Form modal → 결재 결과 통보 |
| Discord 봇 데이터 안내 | 사용자 `/workflow show` → Chart 렌더 → Embed image + 선택 버튼 |

---

## 3. REST + Interactions Webhook 호출 매핑

| Chat Channel 함수 | Discord API |
|---|---|
| `setupChannel` | (a) [`GET /applications/@me`](https://discord.com/developers/docs/resources/application) — application identity 캐시 (id, name, public_key — public_key 는 사용자가 manual 입력한 값과 verify 후 일치 확인). (b) [`PUT /applications/{app_id}/commands`](https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands) — slash command bulk overwrite (`/<prefix>` + sub-options) |
| `teardownChannel` | [`PUT /applications/{app_id}/commands` with `[]`](https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands) — slash command 삭제. best-effort (Discord 측 stale command 잔존은 다음 setup 시 overwrite) |
| `parseUpdate` | Interactions Webhook payload (`type ∈ {1, 2, 3, 5}` — PING / APPLICATION_COMMAND / MESSAGE_COMPONENT / MODAL_SUBMIT) → `ChannelUpdate` |
| `sendMessage` (text) | [`POST /channels/{channel_id}/messages`](https://discord.com/developers/docs/resources/channel#create-message) (content) — DM 채널은 사전에 [`POST /users/@me/channels`](https://discord.com/developers/docs/resources/user#create-dm) 로 채널 생성 후 channel_id 캐시 |
| `sendMessage` (buttons) | `POST /channels/{id}/messages` + `components: [{type: 1, components: [{type: 2, ...}]}]` (ACTION_ROW + BUTTON) |
| `sendMessage` (form_prompt) | §4.2 다단계: plain text content + "Reply" button → 단일 TEXT_INPUT modal (Convention §4.2) |
| `sendMessage` (form_modal) | §4.1 native modal 게이팅 — `POST /channels/{id}/messages` + "양식 작성하기" 버튼 (`custom_id: "__open_form__"`). 클릭 시 `ackInteraction` 이 interaction response `{ type: 9, data: <modal> }` (MODAL) 로 N개 TEXT_INPUT modal open (§3.3) |
| `sendMessage` (image) | `POST /channels/{id}/messages` + `attachments: [{filename, ...}]` + multipart/form-data file upload, 또는 `embeds: [{image: {url: ...}}]` |
| `sendMessage` (typing) | [`POST /channels/{channel_id}/typing`](https://discord.com/developers/docs/resources/channel#trigger-typing-indicator) — 10초 유지 후 자동 만료 |
| `ackInteraction` (button / modal) | Interactions Webhook 응답: 3초 안에 HTTP `200 OK` + body `{ type: 5 }` (DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE) / `{ type: 6 }` (DEFERRED_UPDATE_MESSAGE) / **`{ type: 9, data: <modal> }` (MODAL — `__open_form__` 또는 Reply 버튼 클릭 시 §3.3 / §5.1)**. 비동기 후속 갱신은 [`PATCH /webhooks/{app_id}/{interaction_token}/messages/@original`](https://discord.com/developers/docs/interactions/receiving-and-responding#edit-original-interaction-response) (15분 유효, 5회 한도) |

### 3.1 `setupChannel` 구체

```
GET https://discord.com/api/v10/applications/@me
Authorization: Bot {botToken}
→ { id, name, public_key, owner, ... }
  → 사용자 입력 public_key 와 일치 확인 (불일치 시 BOT_TOKEN_INVALID error)
  → config.chatChannel.botIdentity = { botId: id, username: name, publicKey: public_key }

PUT https://discord.com/api/v10/applications/{app_id}/commands
Authorization: Bot {botToken}
Body: [
  {
    "name": "<configured-prefix>",       // default "workflow"
    "description": "Run workflow",
    "type": 1,                            // CHAT_INPUT (slash command)
    "options": [
      { "name": "start", "type": 1, "description": "Start a new conversation" },
      { "name": "cancel", "type": 1, "description": "Cancel the active conversation" },
      { "name": "help", "type": 1, "description": "Show help" },
      {
        "name": "reply", "type": 1, "description": "Reply to the active AI conversation (v1 Gateway 미사용 결과 — R-CC-13 / R-D-3)",
        "options": [
          { "name": "message", "type": 3, "description": "Your reply text", "required": true }
        ]
      }
    ]
  }
]
→ 등록된 command 목록 반환
```

**Interactions Endpoint URL** 은 Discord Developer Portal 의 application 설정 (정적). 어댑터가 API 로 등록·해제하지 않음 — UI 가이드에 `${BASE_URL}/api/hooks/${trigger.endpointPath}` 입력 안내 (Slack §3.1 R-S-2 와 동일 정신).

**PING handshake** (`type: 1`) — Discord 가 Interactions Endpoint URL 등록 시 1회 + 주기적 발송. `parseUpdate` 가 `body.type === 1` 시 `null` 반환 + 호출자 (`HooksService`) 가 `{ type: 1 }` JSON 으로 `200 OK` 응답. [Spec Chat Channel §5.5](../../../5-system/15-chat-channel.md#55-inbound-http-contract) 의 `202 Accepted` 정책에 대한 명시적 예외 — Discord 가 PING 에 `200 + { type: 1 }` 만 success 로 인정 (Rationale R-D-8).

### 3.2 `teardownChannel` 구체

```
PUT https://discord.com/api/v10/applications/{app_id}/commands
Authorization: Bot {botToken}
Body: []
```

best-effort — 부분 실패 시 trigger 비활성화를 막지 않는다. 다음 setup 시 새 command 로 overwrite 되면 stale command 는 자동 정리.

Discord Developer Portal 의 Interactions Endpoint URL 은 우리 측에서 revoke 할 수 없음 — 사용자가 portal 에서 직접 비워야 한다. UI 가이드 안내.

### 3.3 MODAL 구체 (native form modal)

[Convention §4.1 native modal 경로](../../../conventions/chat-channel-adapter.md#41-native-modal-경로-2026-05-28-신설) 의 Discord 구현. Discord modal 은 **interaction RESPONSE (type 9)** 로만 열 수 있다 (server push 로는 불가) — `form_modal` 버튼 (`custom_id: "__open_form__"`) 클릭 → MESSAGE_COMPONENT interaction 의 token 으로 `ackInteraction` 이 modal 응답:

```
HTTP 200 (Interactions Webhook 응답 body)
{
  "type": 9,                              // MODAL
  "data": {
    "custom_id": "clemvion_form",         // MODAL_SUBMIT 분기용 고정 id (§4)
    "title": "<form 제목 또는 default>",
    "components": [
      // formConfig.fields[] → ACTION_ROW(1) + TEXT_INPUT(4). 최대 5 ACTION_ROW
      { "type": 1, "components": [
        { "type": 4, "custom_id": "<field.name>", "label": "<field.label>",
          "style": 1 | 2,                  // 1=SHORT, 2=PARAGRAPH(textarea)
          "required": field.required, "min_length": ..., "max_length": ... }
      ]}
    ]
  }
}
```

- **TEXT_INPUT 전용 제약**: Discord modal 은 TEXT_INPUT (type 4) **만** 수용한다 — SELECT_MENU/datepicker 등은 modal 안에 못 넣는다. 따라서 §4.1 진입은 **전 필드가 text 계열** (`text`/`textarea`/`email`/`number`/`date`/phone — 모두 TEXT_INPUT + 형식 안내로 표현) 일 때만. `select`/`radio`/`checkbox`/`file` 이 1개라도 있으면 fields ≤ 5 여도 §4.2 다단계 fallback (Convention §4.1 (a)).
- **5 fields 한계**: ACTION_ROW 최대 5 × TEXT_INPUT 1 = 5 가 hard limit.
- **MODAL_SUBMIT**: 사용자 제출 → `data.components[].components[]` 의 `{ custom_id: field.name, value }` 를 `parseUpdate` 가 `{ kind: "form_submission", fields }` 로 normalize (§4).
- **검증 실패 재표시**: Discord 는 MODAL_SUBMIT 에 대해 동일 modal 을 직접 재전송할 수 없다 (interaction 1회 응답). server-side 검증 실패 시 어댑터는 후속 메시지에 "다시 입력" 버튼 (`__open_form__`) 을 재노출 → 사용자 재클릭 시 modal 재open (Convention §4.1 step 5).

---

## 4. 명령 매핑 (`parseUpdate`)

Discord Interactions Webhook 의 단일 envelope (`type` 필드 분기) — `Content-Type: application/json`.

| Discord payload | ChannelUpdate.command |
|---|---|
| `type === 1` (PING) | `null` — 호출자가 `{ type: 1 }` 200 응답 (§3.1) |
| `type === 2` (APPLICATION_COMMAND) & `data.options[0].name === "start"` | `{ kind: "start" }` |
| `type === 2` & `data.options[0].name === "cancel"` | `{ kind: "cancel" }` |
| `type === 2` & `data.options[0].name === "help"` | (helper) — 어댑터가 직접 도움말 응답, EIA 호출 없음 |
| `type === 3` (MESSAGE_COMPONENT) & `data.custom_id === "__open_form__"` (BUTTON) | `null` (EIA 명령 아님) — `ackInteraction` 이 `{ type: 9 }` MODAL 응답 (§3.3 / §4.1 native form 게이팅) |
| `type === 3` (MESSAGE_COMPONENT) & `data.custom_id === "__reply__"` (BUTTON) | `null` — `ackInteraction` 이 `{ type: 9 }` MODAL 응답 (AI reply modal, §5.1 b) |
| `type === 3` (MESSAGE_COMPONENT) & `data.component_type === 2` (그 외 BUTTON) | `{ kind: "button_callback", callbackData: data.custom_id }` |
| `type === 3` & `data.component_type === 3` (SELECT_MENU) | `{ kind: "button_callback", callbackData: data.values[0] }` |
| `type === 5` (MODAL_SUBMIT) & `data.custom_id === "clemvion_form"` | **`{ kind: "form_submission", fields }`** — `data.components[].components[]` 의 `{ custom_id: field.name, value }` 평탄화. native form modal 채택 ([R-D-6](#r-d-6-form--text-계열--5-fields-native-modal-그-외-다단계-2026-05-24-갱신-2026-05-28)) |
| `type === 5` (MODAL_SUBMIT) & `data.custom_id === "clemvion_reply"` | `{ kind: "text_message", text: <TEXT_INPUT 값> }` — AI Multi Turn reply modal (§5.1 b). custom_id 로 form 과 구분 |
| `member.user.bot === true` 또는 `user.bot === true` (DM) | `null` — bot 무시 |
| `channel.type !== 1` (DM 아님 — GUILD_TEXT=0, DM=1, GROUP_DM=3 등) | `null` — 호출자가 `groupChatRefusal` 안내 |
| 그 외 `type` (4 = APPLICATION_COMMAND_AUTOCOMPLETE 등) | `null` — v1 미처리 |

**자유 텍스트 메시지 미수신** — Discord 의 [`MESSAGE_CREATE` Gateway event](https://discord.com/developers/docs/topics/gateway-events#message-create) 는 WebSocket Gateway 연결 시에만 도착. v1 은 Interactions Webhook only (R-D-3) 이므로 일반 DM 텍스트는 어댑터에 전달되지 않는다. AI Multi Turn 의 사용자 reply 는 **slash command 의 text option** (`/workflow reply <message>`) 또는 **modal 의 TEXT_INPUT** 으로 입력 (R-D-3 의 후속 결정).

**3초 ack 의무**: Discord Interactions 는 endpoint 가 3초 안에 응답해야 한다. `ackInteraction` 이 즉시 `200 OK + { type: 5 }` (DEFERRED — 비동기 후속 갱신 의도) 또는 `{ type: 6 }` (UPDATE_MESSAGE — 기존 메시지 갱신 의도) 응답. 비동기 후속 갱신은 `PATCH /webhooks/{app_id}/{interaction_token}/messages/@original` (15분 유효).

`idempotencyKey` 는 `interaction.id` 를 직접 사용 (Discord 가 각 interaction 에 snowflake ID 부여, retry 시 같은 ID).

---

## 5. 인터랙션 노드 UI 매핑 (CCH-MP-*)

### 5.1 AI Multi Turn (CCH-MP-01)

**Outbound (CCH-MP-01 완전 충족)**:
- `execution.ai_message.message` → `POST /channels/{id}/messages` (content, plain markdown — Discord 는 자체 markdown 지원, escape 불필요).
- **2000자 분할** (Discord `content` hard limit). 단어/문장 경계 분할. 마지막 chunk 직전까지는 `\n_(continued…)_` suffix.
- LLM 응답 처리 직전 `POST /channels/{id}/typing` 1회 (10초 자동 만료) — UX 개선. 응답 latency 가 10초 초과 시 5초마다 반복 호출.

**Inbound (CCH-MP-01 부분 유예 — R-D-3 의 결과)**:

Discord v1 은 [Interactions Webhook only](#r-d-3-v1--interactions-webhook-only-gateway--v2-2026-05-24) 이므로 일반 DM `MESSAGE_CREATE` event 를 수신할 수 없다. 사용자 reply 의 입력 경로는 다음 둘로 제한된다 (시스템 spec 의 [R-CC-13](../../../5-system/15-chat-channel.md#r-cc-13-discord-v1--cch-mp-01------interactions-webhook-only--2026-05-24) 가 본 부분 유예의 단일 진실):

- **(a) `/<prefix> reply <message>` slash command** — text option 으로 자유 입력. AI Multi Turn 진행 중에만 활성. parseUpdate 가 `{ kind: "text_message", text: <message> }` 로 반환 → EIA `submit_message`.
- **(b) Button "Reply" → Modal TEXT_INPUT** — 어댑터가 AI 응답 메시지 끝에 "Reply" 버튼 (`custom_id: "__reply__"`, style=2 SECONDARY) 첨부, 클릭 시 `ackInteraction` 이 `{ type: 9 }` MODAL 응답 (modal `custom_id: "clemvion_reply"`, 단일 TEXT_INPUT `custom_id: "message"`). 사용자는 텍스트 입력 후 submit. MODAL_SUBMIT (custom_id `clemvion_reply`) 의 TEXT_INPUT 값을 parseUpdate 가 `{ kind: "text_message", text: <값> }` 으로 normalize → EIA `submit_message`. **custom_id 분기 (§4)**: form native modal 은 `clemvion_form`, AI reply modal 은 `clemvion_reply` — MODAL_SUBMIT 의 두 경로를 명확히 구분.

v1 default UX = (b) modal — Discord 사용자에게 자연스러운 입력 흐름 + slash command 입력 부담 회피. (a) 는 power user 보조 옵션 (slash command 사용을 선호하는 사용자).

자연 대화 (일반 DM 텍스트로 reply) 의 완전 지원은 v2 Gateway plan ([`chat-channel-discord-gateway`](../../../../plan/in-progress/chat-channel-discord-gateway.md) — 후속 trigger) 진입 시 해소.

### 5.2 Button Presentation (CCH-MP-02)

- `buttonConfig.buttons[]` → Message Components — `ACTION_ROW` (type 1) 안에 `BUTTON` (type 2) elements. Discord ACTION_ROW 는 최대 5 buttons, message 는 최대 5 ACTION_ROW.
- `uiMapping.buttonLayout` 분기:
  - `auto` (default): 5개씩 ACTION_ROW 로 chunk. 25개 초과 시 message 분할 (5 ACTION_ROW × 5 buttons = 25).
  - `vertical`: 각 버튼을 별도 ACTION_ROW 로 (1 button/row).
  - `horizontal`: `auto` 와 동일 (5 buttons/row 가 horizontal 의 maximum).
- `custom_id` 필드에 `buttonId` (UUID) 직접 저장 — Discord custom_id 최대 100 chars, UUID 충분.
- 버튼 `style`: spec 의 `'primary'` → Discord `style: 1` (PRIMARY/blurple), `'danger'` → `style: 4` (DANGER/red), 그 외 `style: 2` (SECONDARY/grey).
- `buttonConfig.nodeOutput` 의 nodeType 이 시각형이면 §5.4 의 image / embed 메시지가 먼저, ACTION_ROW 는 다음 메시지로 또는 같은 메시지의 components 에 첨부.
- MESSAGE_COMPONENT interaction 도착 시:
  1. 즉시 `200 OK + { type: 6 }` (DEFERRED_UPDATE_MESSAGE) — 3초 ack 의무
  2. EIA `click_button` 호출
  3. (옵션) `PATCH /webhooks/{app_id}/{token}/messages/@original` 로 `components: []` (버튼 제거) 또는 disabled 상태로 갱신 — 중복 클릭 차단

### 5.3 Form (CCH-MP-03)

Discord 는 `supportsNativeForm = true`. [Convention §4](../../../conventions/chat-channel-adapter.md#4-form-입력-시퀀스-규약) 의 **formMode 분기** 적용. 단 Discord modal 은 **TEXT_INPUT (type 4) 만 수용** 하므로 진입 조건이 Slack 보다 좁다:

- **§4.1 native modal** — `formMode ∈ {auto, native_modal}` && `fields.length <= 5` && **전 필드가 text 계열** (`text`/`textarea`/`email`/`number`/`date`/phone — 모두 TEXT_INPUT + 형식 안내로 표현). `form_modal` 버튼 → `{ type: 9 }` MODAL (§3.3) → MODAL_SUBMIT (custom_id `clemvion_form`) 일괄 제출.
- **§4.2 다단계 텍스트 시퀀스** — `fields > 5` / `formMode === "multi_step"` / **`select`·`radio`·`checkbox`·`file` 필드 1개라도 포함** (modal 비수용 타입 — Convention §4.1 (a)). 기존 다단계.

**필드 type → §4.1 modal TEXT_INPUT** / §4.2 다단계 hint:

| `field.type` ([Form spec §1](../../6-presentation/4-form.md#1-설정-config)) | §4.1 modal (TEXT_INPUT) | §4.2 다단계 hint |
|---|---|---|
| `text` / `email` | TEXT_INPUT style 1 (SHORT) | content prompt + "Reply" button → Modal TEXT_INPUT |
| `textarea` | TEXT_INPUT style 2 (PARAGRAPH) | content prompt + "Reply" button → Modal TEXT_INPUT (PARAGRAPH) |
| `number` | TEXT_INPUT style 1 + submit 후 어댑터 숫자 검증 | content prompt + "Reply" button → Modal TEXT_INPUT (정규식 가드) |
| `date` | TEXT_INPUT style 1 + 형식 안내 (`YYYY-MM-DD`) | content prompt + 형식 안내 + Modal TEXT_INPUT (native date picker 미지원) |
| `text` + [`validation.preset: 'phone'`](../../6-presentation/4-form.md#1-설정-config) | TEXT_INPUT style 1 + 어댑터 형식 검증 | content prompt + Modal TEXT_INPUT — share_contact 동등 없음 |
| `select` / `radio` | **modal 비수용** → form 에 포함 시 §4.2 다단계 fallback | Message Components `SELECT_MENU` (type 3) 단일 select |
| `checkbox` | **modal 비수용** → §4.2 다단계 fallback | N개 BUTTON (style 2) toggle + "Done" button |
| `file` | **modal 비수용** → §4.2 다단계 fallback (Discord file v1 미지원, R-D-7/R-D-9) | content prompt + 안내 ("DM 으로 파일 업로드…") — v1 사실상 미지원. workaround: 외부 storage URL 입력 (`text` + validation `url`) 권장 |

> **modal 수용 타입 제약** (Convention §4.1 (a)): Discord modal = TEXT_INPUT only. select/radio/checkbox/date-picker/file 은 modal 밖 component 라 modal 에 못 담는다 (date 는 TEXT_INPUT + 형식 안내로 degrade 하므로 modal 수용). 따라서 `select`/`radio`/`checkbox`/`file` 이 1개라도 있으면 fields ≤ 5 여도 §4.2 다단계.

§4.2 다단계 각 필드 prompt 본문 포맷 (Telegram §5.3 / Slack §5.3 와 동일):

```
{field.label}{required ? " *" : ""}
{field.description || ""}
```

server-side validation 실패 시: §4.1 modal 은 후속 메시지 버튼 재노출로 modal 재open 유도 (§3.3), §4.2 다단계 는 currentFieldIdx 를 되돌리고 그 필드만 재질문 (Convention §4.2 step 5).

### 5.4 Carousel / Chart / Table (CCH-MP-04)

[Convention §3 매핑 표](../../../conventions/chat-channel-adapter.md#3-eia-event--rendernode-매핑) 의 `uiMapping.visualNode` enum 분기 적용. **v1 = markdown 텍스트/monospace + Embed** (의존성 추가 없음). v2 SSR PNG 격상은 별 plan [`chat-channel-visual-ssr-png`](../../../../plan/in-progress/chat-channel-visual-ssr-png.md) 공유. v1 단계에서 `photo` 선택 시 fallback to text + warning 로그.

**노드타입 × enum × 버전 매트릭스**:

| nodeType | `text` (v1·v2) | `photo` v1 | `photo` v2 | `auto` v1 | `auto` v2 |
|---|---|---|---|---|---|
| `chart` | `output.payload.{title, series, labels}` → monospace mini bar chart (markdown ``` ``` ```, 2000자 분할) | fallback to text (warning 로그) | satori SVG → PNG attachment | text (수치 가독성 우선) | text (변경 없음) |
| `carousel` | `output.items[]` → sequential `POST /channels/{id}/messages`. **`text` 는 imageUrl 무시** (bold title + description + per-card ACTION_ROW). 카드 cap 10장 + "외 N장" | fallback to `auto` v1 | 5장 collage PNG attachment (1 송신) | 카드별: imageUrl 있으면 `embeds: [{image: {url: imageUrl}}]` (title + description embed fields), 없으면 plain content. 카드 cap 10장. global buttons 마지막 카드 후 별 message | 카드별 분기 + 5장 collage PNG |
| `table` | `output.{rows, columns}` → markdown code block monospace table (column 정렬 · row cap 20 · cell >16 chars ellipsis · 2000자 분할) | fallback to text | 표 PNG attachment | text (정밀도 우선) | text (변경 없음) |
| `template` | `output.rendered` plain text → `POST /messages` (2000자 분할). HTML 은 noop fallback | fallback to text | HTML → SSR PNG | text fallback | HTML → SSR PNG |

**Embed 활용 시기**: Discord embed 는 풍부한 표현 (title / description / fields / image / color) 을 지원하지만 fields 의 inline / max length 제약이 있어 chart/table 의 monospace 표현은 plain content 가 더 가독적. carousel 의 각 카드는 embed 가 더 잘 어울림 (`auto` 분기에서 imageUrl 있으면 embed 사용).

**버튼 처리**: 모든 시각형에 대해 `buttonConfig.buttons[]` 가 있으면 시각 message 들 **다음** 메시지로 ACTION_ROW 발송 (또는 마지막 message 의 `components` 에 첨부).

**legacy `text_only` 처리**: Telegram / Slack 과 동일 — read-time normalize.

### 5.5 Typing (CCH-MP-04 - typing 등가)

`POST /channels/{channel_id}/typing` — Telegram `sendChatAction(typing)` 와 1:1 (10초 유지 후 자동 만료). LLM 응답 직전 1회 호출, latency 가 10초 초과 시 5초마다 반복 (margin 5초로 indicator 끊김 방지).

### 5.6 Execution Failed (CCH-ERR-*)

`execution.failed` 이벤트는 [Convention §3.1](../../../conventions/chat-channel-adapter.md#31-execution-failed-분류-알고리즘) 의 `classifyExecutionFailure(event)` 가 결정한 `(key, placeholders)` 를 어댑터가 lookup·치환하여 단일 `POST /channels/{id}/messages` (plain text) 로 발송한다.

| 항목 | Discord 매핑 |
|---|---|
| API 호출 | `POST https://discord.com/api/v10/channels/{channel_id}/messages` (1회) |
| 본문 | `content` = `languageHints[key]` 의 `{statusCode}` 치환 결과. **plain text** (`**__~~` 등 markdown 회피). `embeds` 미부여 |
| `components` | 미부여 (button / select 등 인터랙션 컨트롤 없음 — terminal event) |
| `message_reference` | 미부여 (DM only — [R-D-4](#r-d-4-dm-only-guild-채널-거부-2026-05-24)) |
| Interactions Webhook ack | 무관 (본 발송은 `MESSAGE_CREATE` 가 아니라 server-initiated push — Interactions Webhook 3초 ack 시한 규약과 별개) |
| timeout / retry | [CCH-SE-01](../../../5-system/15-chat-channel.md#34-신뢰성--보안) 동일 — 5초 timeout + 3회 지수 백오프. 최종 실패 시 `chat_channel_health=degraded` |

민감정보 strip — [CCH-ERR-03](../../../5-system/15-chat-channel.md#35-실행-실패-사용자-안내-cch-err-) 그대로.

---

## 6. 보안

- `botToken` (Discord bot token, [`Bot <token>`](https://discord.com/developers/docs/reference#authentication) 형식) 은 `botTokenRef` (`secret://triggers/{id}/bot-token`) 만 config 에 저장. 평문 금지 ([CCH-SE-03](../../../5-system/15-chat-channel.md#34-신뢰성--보안)).
- **Application Public Key (ed25519)**: Discord application 의 [Interactions endpoint 검증](https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization) 은 `X-Signature-Ed25519` + `X-Signature-Timestamp` 헤더 + raw body 를 application public key 로 verify. public key 는 Discord Developer Portal 에서 사용자가 복사해 입력 — `SecretResolver` 가 관리, ref = `secret://triggers/{id}/inbound-signing` ([Convention Secret Store §1](../../../conventions/secret-store.md#1-uri-scheme) 의 provider 공통 슬롯).
  - **형식 (Discord 발급 표준)**: `^[a-f0-9]{64}$` (lowercase hex 64 chars, ed25519 public key 32 bytes). Backend 의 `TriggersService.assertInboundSigningPlaintextByProvider` 가 trigger 생성 시점에 정규식 검증 — 위반 시 400 `VALIDATION_ERROR` (`details.field='inboundSigningPlaintext'`). uppercase hex 는 외부 Discord ed25519 verify 실패 회피를 위해 사전 차단.
  - public key 는 비밀이 아니라 **공개키** 지만, `SecretResolver` 로 일관성 있게 관리 (rotation / workspace 격리 / audit 동일 흐름). Rationale R-D-1.
  - HooksController 가 raw body + 두 헤더 → `SecretResolver.resolve(inboundSigningRef)` → ed25519 verify (Node.js `crypto.verify('ed25519', ...)`). 실패 시 `401 Unauthorized` ([Spec Chat Channel §5.5](../../../5-system/15-chat-channel.md#55-inbound-http-contract) 적용). Discord 는 401 응답 시 retry 하지 않음.
- **Config 필드**: `Trigger.config.chatChannel.inboundSigningRef = "secret://triggers/{id}/inbound-signing"` 로 set. Telegram / Slack 과 **동일 슬롯** — provider 별 자원 성격·검증 알고리즘은 backend 의 provider 분기 책임 ([Convention §2.3 ChatChannelConfig](../../../conventions/chat-channel-adapter.md#23-chatchannelconfig)). Discord 의 경우 발급 주체 = Discord Developer Portal 발급 후 사용자가 manual 입력 (provider-issued). 자원 타입 = ed25519 application public key (asymmetric — public 정보지만 `SecretResolver` 로 일관성 관리, R-D-1). `setupChannel` 의 `SetupResult.issuedInboundSigning` 은 비움 (server-issued 한정 필드).
- **Replay 차단**: `X-Signature-Timestamp` 가 현재 시각 ± 5분 밖이면 `401` (Discord 권장).
- DM 외 channel.type 은 어댑터 진입점에서 차단 ([CCH-CV-05](../../../5-system/15-chat-channel.md#32-identity--conversation-매핑)) — `channel.type !== 1`. `groupChatRefusal` 안내 발송 후 update 무시.
- bot member (`member.user.bot === true` 또는 DM `user.bot === true`) 도 무시.

**HTTP 응답 코드 정책**: Spec Chat Channel §5.5 가 단일 진실. **Discord 특이 예외**:
1. PING (`type: 1`) → `200 OK + { type: 1 }` JSON (§3.1) — `202` 가 아니라 `200` 필수.
2. Interactivity ack → `200 OK + { type: 5 | 6 }` (3초 시한) — `202` 미인정.

두 예외는 본 spec §3.1 / §5.2 / §5.3 에 인라인 명시. Spec Chat Channel §5.5 의 후속 갱신은 본 plan §Phase 4 시스템 spec 점검 대상.

---

## 7. 명령 처리

| 사용자 입력 | 어댑터 처리 |
|---|---|
| `/<prefix> start` (활성 execution 없음) | 새 execution 시작 + ack `{ type: 4, data: { content: languageHints.executionStarted } }` 또는 deferred 후 followup |
| `/<prefix> start` (활성 execution 있음) | 기존 execution 취소 (`cancel`) 후 새 execution 시작 + "기존 대화를 종료하고 새로 시작합니다." |
| `/<prefix> cancel` | 활성 execution 에 EIA `cancel` 호출. 없으면 noop + "진행 중인 대화가 없습니다." |
| `/<prefix> help` | 봇 기본 도움말 (v1 정적 — `languageHints.help` 또는 default 문구) |
| (modal "Reply" submit) | AI Multi Turn 진행 중이면 EIA `submit_message` |
| (button click) | EIA `click_button` |

DM 첫 메시지 자동 start (Telegram `/start` 의미상 동등) 는 **v1 미지원** — Discord 는 MESSAGE_CREATE Gateway event 없이는 DM 텍스트를 받지 못함. 사용자가 `/workflow start` 를 명시 입력해야 한다. R-D-3 의 v1 한계.

---

## 8. 비기능

- `POST /channels/{id}/messages` 5초 타임아웃 + 3회 지수 백오프 (1s / 2s / 4s). 최종 실패 시 trigger 의 `chat_channel_health` = `degraded`.
- Discord [Rate limits](https://discord.com/developers/docs/topics/rate-limits): global 50 req/sec/bot + per-route bucket (응답 헤더 `X-RateLimit-Bucket` / `X-RateLimit-Remaining` / `X-RateLimit-Reset-After`). 어댑터가 per-bucket 큐 + 응답 헤더 기반 throttle. `429 Too Many Requests` 시 `Retry-After` 존중.
- interaction.id 기반 dedup — 같은 interaction.id 가 30초 안에 두 번 도착하면 두 번째 무시 (Discord retry 정책: 3회까지).

---

## Rationale

### R-D-1. `inboundSigningRef` 단일 슬롯 공유 + public key 도 SecretResolver 로 관리 (2026-05-24, 갱신 2026-05-24)

본 항은 두 결정이 결합된다:

**결정 1**: public key (비밀 아닌 공개 정보) 도 `SecretResolver` 로 관리.

- **(채택)** SecretResolver 사용: rotation (Discord Developer Portal 에서 reset 가능) / workspace 격리 / audit 일관성. ref 형식·라이프사이클이 `botTokenRef` 와 정합.
- **(기각)** `Trigger.config.chatChannel.publicKey` 평문 저장: 비밀이 아니라서 평문 OK 지만, config JSONB 가 SecretResolver 우회 → 모듈 일관성 깨짐.

**결정 2**: ref 슬롯은 `inboundSigningRef` 단일 (Telegram / Slack 공유).

- **(채택)** Slack `R-S-1` 와 동일 — role-based generic naming 으로 통합. 자원 성격 (Telegram shared secret / Slack HMAC key / Discord ed25519 public key) 의 차이는 backend 의 provider 분기로 흡수.
- **(기각)** `publicKeyRef` 별 필드: 본 plan 의 초기 안. provider 별 자원 타입을 필드명에 표면화하는 장점은 있으나, Convention §2.3 의 필드 수 ↑ + 새 provider 추가 시 필드 신설 의무 + 자원의 "공통 role" 이 명시 안 됨.
- **(기각)** `secretTokenRef` 재사용 (Telegram-only legacy 명): naming 비일관 그대로 유지.

근거: 사용자 결정 (2026-05-24, [`plan/in-progress/spec-chat-channel-inbound-signing-rename.md`](../../../../plan/in-progress/spec-chat-channel-inbound-signing-rename.md)) — role-based generic naming 통합. asymmetric public key 라는 자원 차이는 `SecretResolver` API 측면에서는 평범한 string blob 으로 다루고 (`store` / `resolve`), 검증 단계의 `crypto.verify('ed25519', ...)` 알고리즘만 backend 의 `DiscordAdapter` 가 책임. Migration 불필요 (production data 없음).

### R-D-2. slash command `setupChannel` 시 bulk overwrite (2026-05-24)

대안:
1. **(채택) `PUT /applications/{app_id}/commands` bulk overwrite**: 멱등성 보장 (Convention §1.1 setupChannel 의무). 기존 command 와 신규 command 의 diff 계산 불필요.
2. **(기각) `POST /applications/{app_id}/commands` 개별 추가 + 기존 조회 후 diff**: race condition 위험 + 코드 복잡도 증가.
3. **(기각) `setupChannel` 미 실행 — 사용자가 Developer Portal 에서 수동 등록**: UX 부담 + bot 별 명령 일관성 보장 불가.

근거: Discord bulk overwrite API 자체가 멱등성을 위해 설계됨. setupChannel 의 자연스러운 매핑.

### R-D-3. v1 = Interactions Webhook only, Gateway 는 v2 (2026-05-24)

대안:
1. **(채택) Interactions Webhook only**: stateless HTTP. slash command / button / modal 위주 UX — Discord 의 modern bot 패턴 (Discord 자체가 권장).
2. **(기각) Gateway WebSocket 도입**: long-lived connection 1개/bot + heartbeat 관리 + shard 라우팅 (대규모 bot) 부담. 다중 인스턴스 환경에서 connection 라우팅 추가 인프라.
3. **(기각) Hybrid**: 결정 부담 증가.

**v1 제약의 결과**:
- 자유 텍스트 DM 메시지 미수신 (MESSAGE_CREATE Gateway 이벤트 없음).
- AI Multi Turn 의 사용자 reply 는 **(a) `/workflow reply <message>` slash text option 또는 (b) Modal TEXT_INPUT** 으로 표현 (§5.1).
- DM 첫 메시지 자동 start 미지원 — `/workflow start` 명시 (§7).
- `file_upload` ChannelUpdate kind 도 v1 미지원 — Discord file upload 는 Gateway message attachment 기반 (§5.3 file 필드 안내).

Gateway 도입은 별 plan [`chat-channel-discord-gateway`](../../../../plan/in-progress/chat-channel-discord-gateway.md) (v2 후보 — 사용자 요청 시 진입).

### R-D-4. DM only, guild 채널 거부 (2026-05-24)

[CCH-CV-05](../../../5-system/15-chat-channel.md#32-identity--conversation-매핑) v1 정책 정합. Discord 의 guild 채널은 multi-user — conversation 매핑 깨짐. guild bot UX 는 v2 multi-user thread 와 한 묶음.

### R-D-5. `MESSAGE_COMPONENT` `custom_id` 에 buttonId UUID 직접 (2026-05-24)

대안:
1. **(채택) UUID 직접 저장**: Discord custom_id 100 chars 한계 안에서 UUID v4 (36 chars) 가 여유. 별 매핑 테이블 불필요.
2. **(기각) 단축 ID + Redis 매핑**: 한계 100 chars 가 충분하므로 over-engineering.
3. **(기각) custom_id 에 추가 메타 동봉 (executionId 등)**: ChannelConversation 에서 충분히 보강 가능 — custom_id 는 buttonId 만.

Telegram R2 와 동일 결론.

### R-D-6. Form — text 계열 & ≤5 fields native modal, 그 외 다단계 (2026-05-24, 갱신 2026-05-28)

**(2026-05-28 갱신 — v2 채택)** Discord MODAL (TEXT_INPUT components) 을 native form 으로 채택. [Convention §4.1 / R-CCA-8](../../../conventions/chat-channel-adapter.md#r-cca-8-native-form-modal-예외-절--5-fields-이하-single-modal-2026-05-28) 예외 절 신설에 따라, `formMode ∈ {auto, native_modal}` && `fields ≤ 5` && **전 필드 text 계열** form 은 단일 MODAL (§3.3 / §5.3). 그 외 (fields > 5 / `multi_step` / select·radio·checkbox·file 포함) 는 §4.2 다단계.

기존 R-D-6 (2026-05-24) 이 이미 "Discord 의 modal 은 trigger 흐름에 자연 — ≤5 fields 면 v2 우선 격상 후보 (Slack `views.open` 보다 implementation 부담 낮음)" 라 예고했으므로 자연스러운 격상.

대안 (historical):
1. **(구 채택 → 다단계 fallback 으로 잔존) v1 다단계 시퀀스** (Convention §4.2): modal 비대상 form (select/checkbox/file 포함 / 6+ fields) 의 fallback.
2. **(v2 채택) native MODAL**: TEXT_INPUT only 제약 때문에 text 계열 form 한정. Discord modal 은 interaction response (type 9) 라 버튼 게이팅 (`__open_form__` 클릭 → MODAL 응답) 으로 token 확보 (Convention §4.1 step 2).
3. **(기각) select/checkbox 를 modal 안 강제 표현**: Discord modal 은 TEXT_INPUT 만 수용 — SELECT_MENU 를 modal 에 못 넣는다 (Discord 플랫폼 제약). 해당 타입 포함 form 은 다단계 (component 기반) 가 자연.

근거: Convention §4.1 활성화 + Discord modal TEXT_INPUT 제약. SoT: [`chat-channel-form-native-modal`](../../../../plan/in-progress/chat-channel-form-native-modal.md) v2.

### R-D-7. v1 file 필드 사실상 미지원 (R-D-3 의 결과) (2026-05-24)

R-D-3 의 v1 Interactions Webhook only 결과 — Discord file upload 는 Gateway MESSAGE_CREATE event 의 attachment 로만 가능. v1 form `file` 필드는 사실상 미지원 (workaround = 외부 storage URL 입력 모드 권장).

Form spec 의 `file` 타입 자체는 미변경 — Discord provider 만 v1 한계로 fallback. 사용자가 Discord provider + form file 필드를 만들면 노드 정의 검증 단계에서 warning 표시 (별 impl plan 책임).

### R-D-8. PING / Interactivity 의 `200 OK` 예외 (2026-05-24)

Slack R-S-8 와 동일 정신. Discord 의 두 케이스만 예외 (PING + Interactivity ack) — Spec Chat Channel §5.5 의 `202 Accepted` 정책에 명시적 예외. §5.5 후속 갱신 (case 표에 "Discord PING: 200 + { type: 1 }" / "Discord interactivity ack: 200 + { type: 5|6 }" 행) 은 본 plan §Phase 4 시스템 spec 점검 대상.

### R-D-9. file 필드 v1 한계 명시 — Form spec 미변경 (2026-05-24)

대안:
1. **(채택) Form spec 미변경 + Discord provider 의 v1 한계로 fallback**: Form spec 의 `file` 타입 추상화는 그대로. Discord 만 v1 implementation 한계로 unsupported.
2. **(기각) Form spec 에 `unsupportedProviders: ["discord"]` 등 필드 추가**: spec 이 provider-specific 한계를 알아야 함 — 의존성 역전. spec 추상화 깨짐.
3. **(기각) Discord provider 가 file 필드 만나면 자동 외부 storage URL 입력으로 변환**: 의도 변환 — 사용자가 file 필드를 설정한 의도와 다른 동작. UX 혼동.

근거: spec abstraction 우선 + provider 한계는 provider spec 의 Rationale 에 명시. impl 단계에서 warning UI 가이드.

---

## Changelog

| 날짜 | 내용 |
|---|---|
| 2026-05-24 | v1 spec 신설 — Discord REST + Interactions Webhook 기반 어댑터. Telegram §5 의 5종 인터랙션 매핑 1:1 + Discord native primitives 변환. Form 은 v1 다단계 (Convention §4 준수). typing 은 `POST /channels/{id}/typing` 1:1. PING / Interactivity 의 200 응답 예외. v1 Interactions Webhook only 의 결과로 자유 텍스트 DM / 자동 start / file upload 한계. |
| 2026-05-24 | §6 보안 + Rationale R-D-1 — public key 의 secret-store ref / config 필드를 단일 `inboundSigningRef` (`secret://triggers/{id}/inbound-signing`) 슬롯으로 통합 (Telegram / Slack 공유). 자원 성격 (ed25519 public key) / 검증 알고리즘 (`crypto.verify('ed25519', ...)`) 는 backend 의 DiscordAdapter 가 분기. spec-chat-channel-inbound-signing-rename. |
| 2026-05-28 | Native form modal 채택 (chat-channel-form-native-modal v2): (a) §3 표에 `form_modal` row (`{type:9}` MODAL) + `ackInteraction` 에 type 9 응답 추가. (b) §3.3 MODAL 구체 신설 — interaction response 게이팅·TEXT_INPUT only 제약·5 fields 한계·MODAL_SUBMIT normalize·검증 재표시. (c) §4 parseUpdate 표에 MODAL_SUBMIT 두 경로 custom_id 분기 (`clemvion_form` → form_submission / `clemvion_reply` → text_message) + `__open_form__` 버튼 분기. (d) §5.1 AI reply modal custom_id 형식 (`__reply__`/`clemvion_reply`/`message`) 명시 — form 과 구분. (e) §5.3 Form 을 formMode 분기 (text 계열 & ≤5 → modal, select/checkbox/file/6+ → 다단계) 로 재작성. (f) R-D-6 갱신 (v2 채택). Convention [§4.1 / R-CCA-8](../../../conventions/chat-channel-adapter.md#r-cca-8-native-form-modal-예외-절--5-fields-이하-single-modal-2026-05-28) 동반. |
