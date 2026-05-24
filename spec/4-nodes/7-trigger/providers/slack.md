---
id: slack
status: implemented
code:
  - codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts
  - codebase/backend/src/modules/chat-channel/providers/slack/slack-client.ts
  - codebase/backend/src/modules/chat-channel/providers/slack/slack-message.renderer.ts
  - codebase/backend/src/modules/chat-channel/providers/slack/slack-signing.ts
  - codebase/backend/src/modules/chat-channel/providers/slack/slack-update.parser.ts
  - codebase/backend/src/modules/chat-channel/providers/slack/slack.types.ts
  - codebase/backend/src/modules/chat-channel/chat-channel-inbound-authenticator.ts
  - codebase/backend/src/modules/hooks/hooks.service.ts
  - codebase/backend/src/modules/hooks/hooks.controller.ts
  - codebase/backend/test/chat-channel-slack.e2e-spec.ts
  - codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts
  - codebase/frontend/src/app/(main)/triggers/page.tsx
  - codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx
  - codebase/frontend/src/lib/i18n/dict/ko/triggers.ts
  - codebase/frontend/src/lib/i18n/dict/en/triggers.ts
  - codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx
  - codebase/frontend/src/content/docs/06-integrations-and-config/slack.en.mdx
---

# Spec: Slack Chat Channel Adapter

> 관련 문서: [Provider Catalog](./_overview.md) · [Spec Chat Channel](../../../5-system/15-chat-channel.md) · [Convention Chat Channel Adapter](../../../conventions/chat-channel-adapter.md) · [Convention Secret Store](../../../conventions/secret-store.md) · [Spec External Interaction API](../../../5-system/14-external-interaction-api.md) · [Spec Webhook 트리거](../../../5-system/12-webhook.md) · [Spec AI Agent](../../3-ai/1-ai-agent.md) · [Spec Form](../../6-presentation/4-form.md) · [Spec Presentation 공통](../../6-presentation/0-common.md) · [Spec Telegram Adapter](./telegram.md)

[Spec Chat Channel](../../../5-system/15-chat-channel.md) 의 어댑터 인터페이스 ([Convention Chat Channel Adapter](../../../conventions/chat-channel-adapter.md)) 의 **Slack 구체 구현 명세**. Slack Web API + Events API + Interactivity 위에서 워크플로우를 chat bot 으로 운영할 때 어댑터가 어떻게 동작해야 하는지 정의.

---

## Overview (제품 정의)

### 1. 개요

`provider: "slack"` 어댑터는 [Slack Web API](https://api.slack.com/web) + [Events API](https://api.slack.com/apis/events-api) + [Interactivity & Shortcuts](https://api.slack.com/interactivity) 위에 동작한다. 사용자가 자기 workspace 에 Slack 앱을 install 하고 bot token 을 등록하면, 어댑터가 Events API subscription 의 Request URL 검증을 통해 Slack → 우리 webhook 트리거 연결을 자동 등록하고, 워크플로우의 인터랙션 노드 5종을 Slack UI (Block Kit / Modal) 로 자동 변환한다.

**v1 = Webhook-mode only**. Slack 의 Socket Mode (WebSocket 연결) 는 long-lived connection 관리 + 다중 인스턴스 라우팅이 추가 부담이므로 v2 옵션 (Rationale R-S-3). 따라서 사용자는 자신의 Slack 앱을 "Event Subscriptions: Request URL" 모드로 설정해야 한다.

### 2. 사용 시나리오

| 시나리오 | 설명 |
|---|---|
| Slack 봇 챗봇 | 사용자가 봇과 DM → AI Multi Turn 노드 진입 → 자연 대화 |
| Slack 봇 결재 | 사용자 mention → Form 다단계 시퀀스 (또는 v2 modal) → 결재 결과 통보 |
| Slack 봇 데이터 안내 | 사용자 mention → Chart 렌더 → Block Kit image block + 선택 버튼 |

---

## 3. Web API 호출 매핑

| Chat Channel 함수 | Slack API |
|---|---|
| `setupChannel` | (a) [`POST /api/auth.test`](https://api.slack.com/methods/auth.test) — bot identity 캐시. (b) Events API "Request URL" 은 Slack 앱 manifest 측 설정이므로 어댑터는 URL Verification handshake (`type: "url_verification"`) 응답 코드만 보장. (c) signing secret 은 사용자가 OAuth Install 단계에서 받아 별도 입력 — 어댑터가 발급하지 않음 |
| `teardownChannel` | best-effort no-op — Slack 앱 manifest 의 Request URL 은 우리 측에서 revoke 할 수 없음. 다만 bot token rotation (`auth.revoke`) 은 별도 [CCH-SE-04](../../../5-system/15-chat-channel.md#34-신뢰성--보안) rotate API 의 책임 — `teardownChannel` 자체는 외부 호출 없음 |
| `parseUpdate` | Events API (`event_callback` envelope) + Interactivity (`payload=<URL-encoded JSON>`) + Slash Commands (`application/x-www-form-urlencoded`) → `ChannelUpdate` |
| `sendMessage` (text) | [`POST /api/chat.postMessage`](https://api.slack.com/methods/chat.postMessage) (channel, text, mrkdwn=true) |
| `sendMessage` (buttons) | `chat.postMessage` + `blocks: [{type: "actions", elements: [{type: "button", ...}]}]` |
| `sendMessage` (form_prompt) | `chat.postMessage` + 옵션 `blocks: [{type: "input", ...}]` 으로 single-field 안내 (v1 다단계 텍스트 시퀀스 + Convention §4 준수) |
| `sendMessage` (image) | [`POST /api/files.uploadV2`](https://api.slack.com/methods/files.uploadV2) (channel, file, initial_comment) — v1 carousel/chart/table 의 image fallback path |
| `sendMessage` (typing) | **no-op** — Slack Web API 에 server-initiated typing indicator 가 없다 (Rationale R-S-5) |
| `ackInteraction` (button_callback / view_submission) | Interactivity 응답: 3초 안에 HTTP `200 OK` 반환 (빈 body 또는 `response_action`) — 비동기 갱신은 [`response_url`](https://api.slack.com/interactivity/handling#message_responses) 사용 |

### 3.1 `setupChannel` 구체

```
POST https://slack.com/api/auth.test
Authorization: Bearer {botToken}
→ { ok: true, team_id, user_id, bot_id, url, team, user, ... }
  → config.chatChannel.botIdentity = { botId: bot_id, username: user, teamId: team_id }
```

Events API 의 "Request URL" 은 Slack 앱 manifest 의 사전 등록 사항 — 어댑터가 API 로 등록·해제하지 않는다 (R-S-2). 사용자는 Slack 앱 manifest 의 `event_subscriptions.request_url` 을 `${BASE_URL}/api/hooks/${trigger.endpointPath}` 로 설정해 둔 상태여야 한다 (UI 가이드 시점에 안내).

**URL Verification** (`type: "url_verification"`) — Slack 이 Request URL 등록 시 1회 발송. `parseUpdate` 가 envelope `type === "url_verification"` 시 `null` 반환 + 호출자(`HooksService`) 가 `{ challenge: <받은 값> }` JSON 으로 `200 OK` 응답. [Spec Chat Channel §5.5 Inbound HTTP Contract](../../../5-system/15-chat-channel.md#55-inbound-http-contract) 의 `202 Accepted` 정책에 대한 명시적 예외 — url_verification 은 Slack 이 즉시 검증을 요구하므로 본 케이스만 `200 OK + { challenge }` 형식.

### 3.2 `teardownChannel` 구체

어댑터는 외부 호출 없음 (no-op). 사용자가 Slack 앱을 workspace 에서 uninstall 하면 Events API 도 자동 무효화 — 우리 측 추가 호출 불필요.

선택 정리: bot token rotation API (`POST /api/triggers/:id/chat-channel/rotate-bot-token`) 가 호출되면 별도 step 으로 [`POST /api/auth.revoke`](https://api.slack.com/methods/auth.revoke) 로 old token 무효화 — [CCH-SE-04](../../../5-system/15-chat-channel.md#34-신뢰성--보안) 의 24h grace 종료 시점에 `ChatChannelTokenRotatorService` 가 수행.

---

## 4. 명령 매핑 (`parseUpdate`)

Slack 의 inbound 진입은 3종 envelope (Events API · Interactivity · Slash Commands) — 어댑터가 모두 처리.

### 4.1 Events API (`Content-Type: application/json`, body `{ type: "event_callback", event: {...} }`)

| Slack event | ChannelUpdate.command |
|---|---|
| `event.type === "message"` & `event.channel_type === "im"` & no `bot_id` & `subtype === undefined` | `{ kind: "text_message", text: event.text }` |
| `event.type === "app_mention"` (모든 채널) | DM 외 채널 → `null` (R-S-4). DM 안의 mention 은 `text_message` 로 흡수 |
| `event.type === "file_shared"` & DM | `parseUpdate` 는 `{ kind: "file_upload", fileId: event.file_id, mimeType: "application/octet-stream" }` 를 동기 반환 (Convention §1.1 pure 계약 유지). 실제 mimeType / filename / url_private 보강은 **호출자 (`HooksService`) 가 `files.info` 1회 후속 호출** 책임 — 자세한 흐름은 Rationale R-S-7 (채택) |
| `event.type === "message"` & `event.channel_type ∈ ('channel', 'group', 'mpim')` | `null` — 호출자가 `groupChatRefusal` 안내 |
| `event.type === "message"` & `bot_id` 존재 또는 `subtype === "bot_message"` | `null` — 봇/자기 메시지 무시 |
| 그 외 event (`reaction_added`, `team_join` 등) | `null` — v1 미처리 |
| envelope `type === "url_verification"` | `null` — 호출자가 `{ challenge }` 200 응답 (§3.1) |

### 4.2 Interactivity (`Content-Type: application/x-www-form-urlencoded`, body `payload=<JSON>`)

| payload.type | ChannelUpdate.command |
|---|---|
| `"block_actions"` (button tap) | `{ kind: "button_callback", callbackData: payload.actions[0].value }` |
| `"block_actions"` (select menu) | `{ kind: "button_callback", callbackData: payload.actions[0].selected_option.value }` |
| `"view_submission"` (modal submit) | v1: 미사용 (Convention §4 다단계 시퀀스 채택 — R-S-6). v2: `{ kind: "form_submission", fields: payload.view.state.values }` 로 확장 예정 |
| `"shortcut"` / `"message_action"` / `"view_closed"` | v1 `null` |

**3초 ack 의무**: Slack Interactivity 는 endpoint 가 3초 안에 `200 OK` 를 반환해야 한다. `ackInteraction` 이 즉시 빈 body 200 응답 — 비동기 후속 갱신은 `response_url` (1시간 유효, 5회 한도) 로 별 POST.

### 4.3 Slash Commands (`Content-Type: application/x-www-form-urlencoded`, body `{ command, text, ... }`)

| 매핑 | ChannelUpdate.command |
|---|---|
| `command === "/<configured-prefix>"` & `text === "start"` (또는 빈 text) | `{ kind: "start" }` |
| `command === "/<configured-prefix>"` & `text === "cancel"` | `{ kind: "cancel" }` |
| 그 외 text | `{ kind: "text_message", text: body.text }` |

Slack slash command 는 **workspace 단위 1개 prefix** 만 등록 가능하므로 trigger 별 prefix 분리 불가능. v1 정책:
- 사용자가 Slack 앱 manifest 에서 1개 slash command (`/<prefix>`, default 가이드 = `/workflow`) 등록.
- DM 안에서 봇과 직접 대화하면 **slash command 없이 자동 start** (Telegram `/start` 와 동등) — `conversation 없음` 분기에서 자동 새 execution 시작 (Spec Chat Channel CCH-CV-03).
- slash command 는 보조 명령 (`/workflow cancel` 로 활성 execution 취소 등).

`idempotencyKey` 는 envelope 별로 결정:
- Events API: `event_id` (Slack 이 retry 시 같은 event_id 동봉)
- Interactivity: `payload.trigger_id` (1시간 유효, 1회용 의도지만 Slack retry 시 재사용)
- Slash Commands: `body.trigger_id` 동상

---

## 5. 인터랙션 노드 UI 매핑 (CCH-MP-*)

### 5.1 AI Multi Turn (CCH-MP-01)

- `execution.ai_message.message` → `chat.postMessage` (mrkdwn=true, [Slack mrkdwn](https://api.slack.com/reference/surfaces/formatting) escape rule 적용 — `<`, `>`, `&` 만 escape, 그 외는 stdmd).
- **3500자 분할** (Slack `chat.postMessage.text` soft limit = 4000자, 보수 margin 500자). 단어/문장 경계 분할. 마지막 chunk 직전까지는 `\n_(continued…)_` suffix.
- LLM 응답 처리 직전 typing indicator → **no-op** (R-S-5).
- 사용자 reply (DM `text_message`) → EIA `submit_message`.

### 5.2 Button Presentation (CCH-MP-02)

- `buttonConfig.buttons[]` → Block Kit [`actions` block](https://api.slack.com/reference/block-kit/blocks#actions) 의 `button` element 배열. `uiMapping.buttonLayout` 분기:
  - `auto` (default): `actions` block 의 `elements` 가 최대 25개 — 라벨 길이 무관 1 block 으로. (Slack 의 actions block 은 row/column 개념이 없음, 클라이언트가 자동 wrap)
  - `vertical`: 각 버튼을 별도 `section` block 으로 분리 (각 section 의 `accessory` 에 단일 button)
  - `horizontal`: `auto` 와 동일 (Slack actions block 자체가 horizontal flow)
- 버튼의 `value` 필드에 `buttonId` (UUID) 저장 — Slack 의 button value 최대 2000 chars, UUID v4 (36 chars) 여유.
- 버튼 `style`: spec 의 `'primary'` → Block Kit `style: "primary"`, `'danger'` → `style: "danger"`, 그 외 default (style 미지정).
- `buttonConfig.nodeOutput` 의 nodeType 이 시각형이면 §5.4 의 image 메시지가 먼저 (image block + caption), actions block 은 다음 메시지로.
- `block_actions` payload 도착 시:
  1. 즉시 `200 OK` (3초 ack 의무) — 빈 body
  2. EIA `click_button` 호출
  3. (옵션) `response_url` 로 `replace_original: true, text: "선택 완료: <라벨>"` POST — 키보드 제거 + 선택 시각화

### 5.3 Form (CCH-MP-03)

v1 = [Convention §4 다단계 시퀀스](../../../conventions/chat-channel-adapter.md#4-form-다단계-시퀀스-규약) 정책 적용 — **모든 어댑터가 동일한 다단계 텍스트 시퀀스** 컨벤션 차원 강제 (Convention Rationale R4). Slack 의 native `views.open` modal 은 v2 옵션 (R-S-6).

필드 type 별 Block Kit hint:

| `field.type` ([Form spec §1](../../6-presentation/4-form.md#1-설정-config)) | Slack hint |
|---|---|
| `text` / `textarea` / `email` | plain text prompt (`section` block + 사용자 자유 DM reply) |
| `number` | plain text prompt + 안내 ("숫자만 입력") |
| `select` / `radio` | Block Kit `actions` block 의 `static_select` element (단일 선택) |
| `checkbox` | Block Kit `checkboxes` element + 완료 button (Block Kit checkboxes 는 단일 element 안에서 N개 옵션 선택 + submit 별도 button) |
| `date` | Block Kit `datepicker` element (native date picker — Slack 지원) |
| `file` | plain text prompt ("파일을 이 DM 에 업로드해 주세요") → `file_shared` event 수신 |
| `text` + [`validation.preset: 'phone'`](../../6-presentation/4-form.md#1-설정-config) | plain text prompt + 안내 ("전화번호 입력") — Slack 은 share_contact 동등 native UI 없음. Form spec 의 `type` Enum 자체는 미변경 |

각 필드 prompt 본문 포맷 (Telegram §5.3 와 동일):

```
{field.label}{required ? " *" : ""}
{field.description || ""}
```

server-side validation 실패 시 어댑터가 currentFieldIdx 를 되돌리고 그 필드만 재질문 (Convention §4 step 5).

### 5.4 Carousel / Chart / Table (CCH-MP-04)

[Convention §3 매핑 표](../../../conventions/chat-channel-adapter.md#3-eia-event--rendernode-매핑) 의 `uiMapping.visualNode` enum 분기 적용. **v1 = mrkdwn 텍스트/monospace 표현** (의존성 추가 없음). v2 SSR PNG 격상은 별 plan [`chat-channel-visual-ssr-png`](../../../../plan/in-progress/chat-channel-visual-ssr-png.md) 공유 (Telegram §5.4 와 동일 격상 trigger). v1 단계에서 `photo` 선택 시 fallback to text + warning 로그 (`chat_channel_health` 변경 없음).

**노드타입 × enum × 버전 매트릭스**:

| nodeType | `text` (v1·v2) | `photo` v1 | `photo` v2 | `auto` v1 | `auto` v2 |
|---|---|---|---|---|---|
| `chart` | `output.payload.{title, series, labels}` → monospace mini bar chart (mrkdwn code block ``` ``` ```, 3500자 분할) | fallback to text (warning 로그) | satori SVG → PNG `files.uploadV2` | text (수치 가독성 우선) | text (변경 없음) |
| `carousel` | `output.items[]` → sequential `chat.postMessage`. **`text` 는 imageUrl 무시** (mrkdwn bold title + description + per-card actions block buttons). 카드 cap 10장 + "외 N장" 안내 | fallback to `auto` v1 (warning 로그) | 카드 1~5장 collage PNG `files.uploadV2` (1 송신) | 카드별: imageUrl 있으면 Block Kit `image` block (`image_url` + `alt_text` + `title`), 없으면 `chat.postMessage` (title bold + description + per-card actions). 카드 cap 10장. global buttons 마지막 카드 후 별 message | 카드별 분기 + 5장 collage PNG 시도 |
| `table` | `output.{rows, columns}` → mrkdwn code block 안의 monospace table (column padding · header separator · row cap 20 · cell >16 chars ellipsis · 3500자 분할) | fallback to text | 표 PNG `files.uploadV2` | text (정밀도 우선) | text (변경 없음) |
| `template` | `output.rendered` 가 plain text 면 `chat.postMessage` (3500자 분할). HTML 은 noop fallback | fallback to text | HTML → SSR PNG | text fallback | HTML → SSR PNG |

**버튼 처리**: 모든 시각형에 대해 `buttonConfig.buttons[]` 가 있으면 시각 message 들 **다음** 메시지로 actions block 발송 (Slack UX 정합 — 컨텐츠 본 후 선택).

**legacy `text_only` 처리**: Telegram 과 동일 — 어댑터가 입력 단계에서 `visualNode === "text_only"` 를 `"text"` 로 read-time normalize (Convention §2.3 의 normalize 정책 적용).

### 5.5 Typing (CCH-MP-04 - typing 등가)

Slack Web API 는 server-initiated typing indicator 가 없다 (`as_user=true` + Real Time Messaging 의 `typing` event 는 Socket Mode 전용). v1 은 **no-op** — `renderNode` 가 typing ChannelMessage 를 생성하지 않거나 `sendMessage` 가 silent skip. UX 영향:

- LLM 응답 latency 가 긴 경우 (수 초~수 십 초) 사용자가 "봇이 죽었나" 느낄 수 있음 — 별 plan [`chat-channel-progress-indicator`](../../../../plan/in-progress/chat-channel-progress-indicator.md) (v2 후보 — 생성 보류) 에서 "처리 중입니다" 라는 임시 메시지를 보낸 후 응답으로 `chat.update` 갱신하는 방안 검토.

Convention §1.1 의 `ackInteraction` 정책 — provider 에 따라 noop 가능. Slack 의 typing 도 동일 정신: provider 가 native 미지원 시 no-op 허용.

---

## 6. 보안

- `botToken` (Slack `xoxb-*` 형식) 은 `botTokenRef` (`secret://triggers/{id}/bot-token`) 만 config 에 저장. 평문 금지 ([CCH-SE-03](../../../5-system/15-chat-channel.md#34-신뢰성--보안)).
- **Signing Secret**: Slack 앱의 [Request URL 검증](https://api.slack.com/authentication/verifying-requests-from-slack) 은 `X-Slack-Signature: v0=<HMAC-SHA256(signing_secret, "v0:" + X-Slack-Request-Timestamp + ":" + raw_body)>` 형식. signing secret 은 `SecretResolver` 가 관리 — ref = `secret://triggers/{id}/inbound-signing` ([Convention Secret Store §1](../../../conventions/secret-store.md#1-uri-scheme) 의 provider 공통 슬롯).
  - HooksController 가 raw body + 헤더 두 값을 fetch → `SecretResolver.resolve(inboundSigningRef)` → HMAC-SHA256 재계산 후 constant-time compare. 실패 시 `401 Unauthorized` ([Spec Chat Channel §5.5](../../../5-system/15-chat-channel.md#55-inbound-http-contract) 의 401 라인 적용).
- **Replay 차단**: `X-Slack-Request-Timestamp` 가 현재 시각 ± 5분 밖이면 `401` (Slack 권장).
- **Config 필드**: `Trigger.config.chatChannel.inboundSigningRef = "secret://triggers/{id}/inbound-signing"` 로 set. Telegram / Discord 와 **동일 슬롯** — provider 별 자원 성격·검증 알고리즘은 backend 의 provider 분기 책임 ([Convention §2.3 ChatChannelConfig](../../../conventions/chat-channel-adapter.md#23-chatchannelconfig)). Slack 의 경우 발급 주체 = Slack 앱 install 시점에 Slack 이 발급하여 사용자가 manual 입력 (provider-issued). 사용자 입력 plaintext 가 직접 `SecretResolver.store` 로 들어가고 ref 만 config 에 보관 — `setupChannel` 의 `SetupResult.issuedInboundSigning` 은 비움 (server-issued 한정 필드). Rationale R-S-1.
- group/channel/mpim event 는 어댑터 진입점에서 차단 ([CCH-CV-05](../../../5-system/15-chat-channel.md#32-identity--conversation-매핑)) — `event.channel_type !== "im"`. `groupChatRefusal` 안내 발송 후 update 무시.
- 다른 봇이 보낸 메시지 (`bot_id` 존재) 도 무시.

**HTTP 응답 코드 정책**: 인증 / 비활성 트리거 / group chat / 미지원 event / 어댑터 내부 에러 등 모든 케이스의 응답 정책은 [Spec Chat Channel §5.5 Inbound HTTP Contract](../../../5-system/15-chat-channel.md#55-inbound-http-contract) 가 단일 진실. 본 파일은 케이스 매트릭스 사본을 두지 않음 (drift 회피).

**Slack 특이 예외**:
1. `type: "url_verification"` envelope → `200 OK + { challenge }` (§3.1) — `202 Accepted` 정책의 명시적 예외.
2. Interactivity 응답 3초 시한 → `200 OK` (empty body 또는 `response_action`) — `202` 가 아니라 `200` 사용 (Slack 권장 형식). 본 예외도 Spec Chat Channel §5.5 의 후속 갱신 대상이거나, 본 spec 의 `200 vs 202` Rationale (R-S-8) 에 기록.

---

## 7. 명령 처리

| 사용자 입력 | 어댑터 처리 |
|---|---|
| DM 첫 메시지 또는 `/<prefix> start` (활성 execution 없음) | 새 execution 시작 + `languageHints.executionStarted` 안내 |
| DM 메시지 또는 `/<prefix> start` (활성 execution 있음) | 기존 execution 취소 (`cancel`) 후 새 execution 시작 + "기존 대화를 종료하고 새로 시작합니다." 안내 |
| `/<prefix> cancel` | 활성 execution 에 EIA `cancel` 호출. 없으면 noop + "진행 중인 대화가 없습니다." |
| `/<prefix> help` | 봇 기본 도움말 (v1 은 정적 텍스트 — `languageHints.help` 또는 default 문구) |
| 그 외 slash text | `text_message` 로 흡수 — AI Multi Turn 진행 중이면 reply, 아니면 안내 |

Telegram §7 의 `/start` / `/cancel` / `/help` 와 의미 1:1 — Slack 은 단일 prefix slash 의 sub-command 로 표현.

---

## 8. 비기능

- `chat.postMessage` 5초 타임아웃 + 3회 지수 백오프 (1s / 2s / 4s). 최종 실패 시 trigger 의 `chat_channel_health` = `degraded`.
- Slack [Rate limits](https://api.slack.com/docs/rate-limits): `chat.postMessage` = **Tier 4** (≈ 100/min/workspace), `files.uploadV2` = **Tier 2** (≈ 20/min). 어댑터가 channel (DM) 단위 큐 + per-method bucket 으로 자체 throttle. 응답의 `Retry-After` 헤더 존중.
- Events API dedup — 같은 `event_id` 가 30초 안에 두 번 도착하면 두 번째 무시 (Slack 의 retry 정책: 3회까지 `X-Slack-Retry-Num`).

---

## Rationale

### R-S-1. `inboundSigningRef` 단일 슬롯 공유 — provider 별 의미·발급 주체는 backend 분기 (2026-05-24, 갱신 2026-05-24)

대안:
1. **(채택) `inboundSigningRef?` 단일 슬롯 (Telegram / Slack / Discord 공유)**: 세 자원 (Telegram secret_token / Slack signing secret / Discord public key) 의 공통 role 은 "inbound webhook 출처 검증용 자료". ref 슬롯을 단일화하면 (a) Convention 의 필드 폭 ↓ (b) 새 provider 추가 시 ref 신설 불필요 (c) catalog 와 data-model 의 naming 일관성 ↑. 발급 주체·검증 알고리즘 차이는 backend 의 provider 분기 책임으로 흡수 (provider 가 이미 `provider` 식별자로 분기되므로 자연).
2. **(기각) `signingSecretRef` 별 필드 + `secretTokenRef` (Telegram) / `publicKeyRef` (Discord) 의 3 필드**: 초기 안. provider 별 의미 차이를 필드명으로 표면화하는 장점은 있으나, 동일 role 의 자원이 3개 ref 슬롯에 흩어져 (a) Convention §2.3 의 필드 수 ↑ (b) `bot-token` 처럼 provider 공통 자원과 패턴 비대칭 (provider 공통은 단일 필드, provider 별은 다중 필드 — 일관성 ↓) (c) 새 provider 추가 시 ref 필드 신설 의무. 본 안의 ownership 모호성 우려는 backend 의 provider 분기 + `SetupResult.issuedInboundSigning` 의 "server-issued 한정" 명시로 충분히 해소됨.
3. **(기각) `webhookSecretRef` (Telegram 만 generic 이름) + Slack/Discord 별 필드 — 본 plan 시작 직전 상태**: naming 비일관 (Telegram 만 generic). 통합 결정 정당화.

근거: 사용자 결정 (2026-05-24, [`plan/in-progress/spec-chat-channel-inbound-signing-rename.md`](../../../../plan/in-progress/spec-chat-channel-inbound-signing-rename.md)) — role-based generic naming 으로 통합. Slack 의 자원은 secret-store 의 `secret://triggers/{id}/inbound-signing` 슬롯에 보관되며, backend 의 SlackAdapter 가 HMAC-SHA256 알고리즘으로 검증한다. Migration 불필요 (production data 없음).

### R-S-2. Events API Request URL 자동 등록 미지원 (2026-05-24)

대안:
1. **(채택) 사용자가 Slack 앱 manifest 에 사전 등록**: Slack 의 Events API Request URL 은 OAuth Install 흐름 안에 묶여 있지 않고 앱 manifest 의 정적 설정. API 로 동적 변경 불가능 (Slack Web API 미제공).
2. **(기각) [`POST /apps.manifest.update`](https://api.slack.com/methods/apps.manifest.update) 호출**: 본 API 는 `xoxe.xoxp-*` configuration token (앱 owner 의 user token) 만 인정 — 워크플로우 사용자의 bot token 으로는 호출 불가. ops 부담 큼.

근거: Slack 의 design 제약 — `setupChannel` 은 `auth.test` 로 identity 캐시만, URL 등록 verification 은 호출자가 응답 헤더 처리. UI 가이드에 manifest 입력 안내 추가 (별 [user guide 페이지](../../../../codebase/frontend/src/content/docs/triggers/) — 후속 impl plan 책임).

### R-S-3. v1 = Webhook-mode only, Socket Mode 는 v2 (2026-05-24)

대안:
1. **(채택) Webhook-mode only (v1)**: Events API + Interactivity Request URL 만 사용. stateless HTTP — 다중 인스턴스 라우팅 부담 없음.
2. **(기각) Socket Mode (WebSocket)**: bot 별 long-lived WebSocket connection 1개 필요. 다중 인스턴스 환경에서 라우팅 / failover 추가 부담. v1 단순성과 어긋남.
3. **(기각) Hybrid**: 둘 다 지원 → 사용자 결정 부담 증가.

근거: v1 단순성. Socket Mode 가 필요한 사용 사례 (private network 안의 Slack 등) 가 v2 trigger 시 별 plan 으로 분리.

### R-S-4. group/channel/mpim 거부 — DM 만 지원 (2026-05-24)

[CCH-CV-05](../../../5-system/15-chat-channel.md#32-identity--conversation-매핑) v1 정책 정합. Slack `app_mention` 도 채널/DM 모두 발생할 수 있으므로 채널 mention 은 별도로 거부 (DM 안의 mention 만 `text_message` 로 흡수). multi-user 채널 대응은 v2 multi-user thread 와 한 묶음.

### R-S-5. typing indicator no-op (2026-05-24)

대안:
1. **(채택) no-op**: Slack Web API 에 server-initiated typing indicator 가 없다. Socket Mode 의 `typing` event 만 가능하지만 v1 은 Webhook-mode only (R-S-3).
2. **(기각) ephemeral "..." 메시지**: 노이즈 + 이후 갱신/삭제 부담 (`chat.delete` 호출 추가).
3. **(기각) "처리 중입니다" placeholder + `chat.update` 으로 응답 교체**: UX 는 좋으나 EIA `execution.ai_message` 도착 시점에 message_ts 추적 부담. 별 plan `chat-channel-progress-indicator` 로 분리.

근거: Convention §1.1 의 `ackInteraction` 와 동일 정신 — provider 가 native 미지원 시 no-op 허용. UX 격상은 별 plan.

### R-S-6. v1 Form = 다단계 텍스트 시퀀스, modal 은 v2 (2026-05-24)

대안:
1. **(채택) v1 다단계 텍스트 시퀀스** (Convention §4 준수): Telegram 과 동일 UX. 컨벤션 차원 강제 (Convention Rationale R4) 와 정합.
2. **(기각) v1 부터 `views.open` modal native**: Slack 의 가장 native 한 form UX 지만 컨벤션 §4 위반. modal 을 도입하려면 컨벤션 §4 에 "provider 가 native form UI 지원 시 예외" 절 추가 + Telegram 도 [Mini App](https://core.telegram.org/bots/webapps) 의 native form 으로 격상하는 path 가 함께 검토되어야 — 변경 범위 큼.
3. **(보류) v1 부터 modal + v2 에서 컨벤션 통합**: 일단 도입했다가 컨벤션이 따라가는 패턴 — drift 위험.

근거: 컨벤션 우선 + 변경 범위 최소화. modal 은 별 plan [`chat-channel-form-native-modal`](../../../../plan/in-progress/chat-channel-form-native-modal.md) 후보 (v2 trigger 시 진입).

### R-S-7. `file_shared` event → `files.info` 후속 조회 — HooksService 위임 (채택) (2026-05-24)

대안:
1. **(채택) `parseUpdate` pure 유지 + `HooksService` 가 `files.info` 호출**: `parseUpdate` 는 side-effect free (Convention §1.1) 계약 유지. mimeType 미상 placeholder 로 `ChannelUpdate { kind: "file_upload", fileId, mimeType: "application/octet-stream" }` 동기 반환. caller (`HooksService`) 가 ChannelUpdate 수신 직후 [`files.info`](https://api.slack.com/methods/files.info) 1회 호출로 실제 mimeType / filename / url_private 보강 → form `file` 필드 `allowedMimeTypes` 검증 + EIA `submit_form` payload 합성.
2. **(기각) `parseUpdate` 의 contract 를 async + 외부 호출 허용 으로 완화**: Convention 차원 변경 — 본 spec 범위 외 + Telegram parser 의 pure 단순성 손실.
3. **(기각) `mimeType` 미상으로 EIA 전달 후 backend 가 보강**: Form validation 시점이 webhook 진입점 안에서 처리되므로 (5.3 의 multi-step sequence 흐름) HooksService 가 호출하는 것이 자연.

**Normative 흐름**:
```
event.type === "file_shared" 도착
  ↓ HooksService.handleChatChannelUpdate(rawBody)
  ↓ adapter.parseUpdate(rawBody)  →  ChannelUpdate { kind: "file_upload", fileId, mimeType: "application/octet-stream" }  (pure)
  ↓ HooksService 가 botToken resolve → slackClient.files.info(fileId)
  ↓ 보강된 mimeType / filename / url_private 으로 ChannelUpdate 갱신
  ↓ Form `file` 필드의 allowedMimeTypes / maxFileSize 1차 검증
  ↓ 통과 시 EIA submit_form (data.<fieldName> = { fileId, filename, mimeType, urlPrivate }) 호출
  ↓ 실패 시 currentFieldIdx 되돌리고 form_prompt 재발송 (Convention §4 step 5)
```

근거: Convention §1.1 pure 계약 유지 우선. mimeType 보강 책임을 caller 로 일원화하면 다른 file-receiving provider (향후 Telegram `document` / Discord v2 Gateway attachment) 도 동일 패턴 재사용 가능.

### R-S-8. URL Verification / Interactivity 의 `200 OK` 예외 (2026-05-24)

Spec Chat Channel §5.5 는 inbound webhook 응답을 `202 Accepted` 로 SoT 화. Slack 의 두 케이스만 예외:
1. URL Verification: Slack 이 `challenge` 값을 응답 본문에서 추출해야 하므로 `200 OK + { challenge }` JSON 필수.
2. Interactivity 3초 ack: Slack 이 `200 OK` (또는 `response_action`) 만 success 로 인정 — `202` 는 클라이언트에 error 로 표시될 가능성.

대안 (기각): §5.5 를 200/202 둘 다 허용으로 generalize — 모든 provider 의 응답 정책이 모호해짐. Slack 만 예외 (Telegram 은 그대로 202) 가 변경 범위 최소.

근거: provider 특성 차이. Spec Chat Channel §5.5 의 후속 갱신 (case 표에 "Slack url_verification: 200 + challenge" / "Slack interactivity ack: 200" 행 추가) 은 본 plan §Phase 4 의 시스템 spec 점검 대상.

### R-S-9. DM 첫 메시지 자동 `start` (slash command prefix 의존 회피) (2026-05-24)

대안:
1. **(채택) DM 첫 메시지 자동 start**: Telegram `/start` 의 의미상 동등. slash command prefix 가 workspace 단위 1개라는 Slack 제약을 우회.
2. **(기각) `/workflow start` 명령 의무화**: 사용자가 매번 명령을 쳐야 함 — DM bot UX 와 어긋남. 게다가 prefix 가 trigger 별 달라야 의미 있는데 Slack 은 그것 불가.
3. **(기각) `app_home` 진입 자동 start**: Slack Home tab 은 별도 surface — DM 메시지 흐름과 분리. 사용자 발견성 낮음.

근거: Slack 의 native bot UX 와 정합. slash command 는 명시적 명령 (cancel / help) 의 보조 도구.

---

## Changelog

| 날짜 | 내용 |
|---|---|
| 2026-05-24 | v1 spec 신설 — Slack Web API + Events API + Interactivity 기반 Webhook-mode 어댑터. Telegram §5 의 5종 인터랙션 매핑 1:1 + Slack native primitives 변환. Form 은 v1 다단계 텍스트 시퀀스 (Convention §4 준수). typing no-op. URL Verification / Interactivity 의 200 응답 예외. |
| 2026-05-24 | §6 보안 + Rationale R-S-1 — signing secret 의 secret-store ref / config 필드를 단일 `inboundSigningRef` (`secret://triggers/{id}/inbound-signing`) 슬롯으로 통합 (Telegram / Discord 공유). 발급 주체 (Slack provider-issued) / 검증 알고리즘 (HMAC-SHA256) 는 backend 의 SlackAdapter 가 분기. spec-chat-channel-inbound-signing-rename. |
