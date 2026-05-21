# Spec: Telegram Chat Channel Adapter

> 관련 문서: [Provider Catalog](./_overview.md) · [Spec Chat Channel](../../../5-system/15-chat-channel.md) · [Convention Chat Channel Adapter](../../../conventions/chat-channel-adapter.md) · [Spec External Interaction API](../../../5-system/14-external-interaction-api.md) · [Spec Webhook 트리거](../../../5-system/12-webhook.md) · [Spec AI Agent](../../3-ai/1-ai-agent.md) · [Spec Form](../../6-presentation/4-form.md) · [Spec Presentation 공통](../../6-presentation/0-common.md)

[Spec Chat Channel](../../../5-system/15-chat-channel.md) 의 어댑터 인터페이스 ([Convention Chat Channel Adapter](../../../conventions/chat-channel-adapter.md)) 의 **텔레그램 구체 구현 명세**. Telegram Bot API 위에서 워크플로우를 챗봇처럼 운영할 때 어댑터가 어떻게 동작해야 하는지 정의.

---

## Overview (제품 정의)

### 1. 개요

`provider: "telegram"` 어댑터는 [Telegram Bot API](https://core.telegram.org/bots/api) 위에 동작한다. 사용자가 Bot Father 에서 봇을 생성한 뒤 봇 토큰을 등록하면, 어댑터가 `setWebhook` 으로 텔레그램 → 우리 webhook 트리거 연결을 자동 등록하고, 워크플로우의 인터랙션 노드 4종 (AI Multi Turn / Button Presentation / Form / Carousel·Chart·Table) 을 텔레그램 UI 로 자동 변환한다.

### 2. 사용 시나리오

| 시나리오 | 설명 |
|---|---|
| 텔레그램 봇 챗봇 | 사용자가 봇에게 메시지 → AI Multi Turn 노드 진입 → 자연 대화 |
| 텔레그램 봇 결재 | 사용자 명령 → Form 다단계 시퀀스 → 결재 결과 통보 |
| 텔레그램 봇 데이터 안내 | 사용자 명령 → Chart 렌더 → `sendPhoto` 로 차트 전송 + 선택 버튼 |

---

## 3. Bot API 호출 매핑

| Chat Channel 함수 | Telegram Bot API |
|---|---|
| `setupChannel` | `POST /bot{token}/setWebhook` (url, secret_token, allowed_updates) + `GET /bot{token}/getMe` (botId / username 캐시) |
| `teardownChannel` | `POST /bot{token}/deleteWebhook` |
| `parseUpdate` | Telegram Update 객체 → `ChannelUpdate` (chat_id, from.id, text/callback_query/document 분기) |
| `sendMessage` (text) | `POST /bot{token}/sendMessage` (chat_id, text, parse_mode=MarkdownV2 escape) |
| `sendMessage` (buttons) | `sendMessage` + `reply_markup.inline_keyboard` |
| `sendMessage` (form_prompt) | `sendMessage` + 옵션 `reply_markup.keyboard` (text/숫자/share_contact) or `remove_keyboard` |
| `sendMessage` (image) | `POST /bot{token}/sendPhoto` (chat_id, photo, caption) |
| `sendMessage` (typing) | `POST /bot{token}/sendChatAction` (action=typing) |
| `ackInteraction` (button_callback) | `POST /bot{token}/answerCallbackQuery` (callback_query_id) |

### 3.1 `setupChannel` 구체

```
POST https://api.telegram.org/bot{token}/setWebhook
{
  "url": "{callbackUrl}",                   // = `${BASE_URL}/api/hooks/${trigger.endpointPath}`
  "secret_token": "{randomly_generated}",   // 32 chars [A-Za-z0-9_-]. config.chatChannel.secretToken 에 저장
  "allowed_updates": ["message", "callback_query"],  // 필요한 update 만 — group 관련 update 는 미구독
  "drop_pending_updates": true              // 기존 봇이 있던 경우 stale update 폐기
}

GET https://api.telegram.org/bot{token}/getMe
→ { ok: true, result: { id, username, ... } } → config.chatChannel.botIdentity 캐시
```

### 3.2 `teardownChannel` 구체

```
POST https://api.telegram.org/bot{token}/deleteWebhook
{ "drop_pending_updates": true }
```

best-effort — 부분 실패 시 trigger 비활성화를 막지 않는다. 다음 setup 시 새 토큰으로 재등록되면 stale webhook 은 자동 무효화.

---

## 4. 명령 매핑 (`parseUpdate`)

| 텔레그램 update | ChannelUpdate.command |
|---|---|
| `/start` (또는 `/start <param>`) | `{ kind: "start" }` |
| `/cancel` | `{ kind: "cancel" }` |
| 일반 텍스트 (`message.text`, 명령 아님) | `{ kind: "text_message", text }` |
| `callback_query` (inline_keyboard tap) | `{ kind: "button_callback", callbackData }` |
| `message.document` / `message.photo` / `message.video` | `{ kind: "file_upload", fileId, mimeType }` |
| `message.contact` (share_contact) | `{ kind: "contact_share", phone }` |
| `message.chat.type ∈ ('group', 'supergroup', 'channel')` | `null` 반환 — `parseUpdate` 는 pure (안내 미발송). 호출자(`HooksService`) 가 `chat.type !== 'private'` 분기에서 `languageHints.groupChatRefusal` 안내 `sendMessage` 별 호출 |
| `message.from.is_bot === true` | `null` (다른 봇 메시지 무시, 안내 미발송) |
| 그 외 (`sticker`, `voice` 등 unsupported) | `null` — 호출자가 `"지원하지 않는 메시지 형식입니다."` 안내 발송 |

`idempotencyKey` 는 `update.update_id` 를 직접 사용 (텔레그램이 모든 update 에 monotonic ID 부여).

---

## 5. 인터랙션 노드 UI 매핑 (CCH-MP-*)

### 5.1 AI Multi Turn (CCH-MP-01)

- `execution.ai_message.message` → `sendMessage` (parse_mode=`MarkdownV2`, escape rule per Bot API docs).
- 4096자 (텔레그램 메시지 한계) 초과 시 단어/문장 경계로 분할. 마지막 chunk 직전까지는 `\n_(continued…)_` suffix.
- LLM 응답 처리 직전에 `sendChatAction(action=typing)` 1회 (5초 자동 만료) — UX 개선.
- 사용자 reply (text_message) → EIA `submit_message`.

### 5.2 Button Presentation (CCH-MP-02)

- `buttonConfig.buttons[]` → `inline_keyboard` 2D 배열. `uiMapping.buttonLayout` 분기:
  - `auto` (default): 라벨 총 length 가 24자 이하인 버튼은 같은 row, 초과는 새 row.
  - `vertical`: 1열 N행.
  - `horizontal`: 1행 N열 (최대 8개까지, 초과는 wrap).
- `inline_keyboard.callback_data` 필드에 `buttonId` (UUID) 직접 저장. 텔레그램의 64 bytes 제한 안에서 UUID 충분.
- 버튼 시각: `style: 'primary'` → 이모지 ✅ prefix, `'danger'` → ⚠️, 그 외 plain.
- `buttonConfig.nodeOutput` 의 nodeType 이 시각형 (`carousel` / `chart` / `table`) 이면 §5.4 의 image 발송이 먼저 (image + caption), inline_keyboard 는 다음 메시지로 첨부.
- callback_query 도착 시 처리 순서:
  1. `answerCallbackQuery(callback_query_id)` 즉시 호출 (텔레그램 의무 — 안 하면 모바일 클라이언트에 로딩 indicator 가 계속 표시됨)
  2. EIA `click_button` 호출
  3. (옵션) 직전 메시지를 `editMessageReplyMarkup` 으로 키보드 제거 — 중복 클릭 차단

### 5.3 Form (CCH-MP-03)

[Convention §4 다단계 시퀀스](../../../conventions/chat-channel-adapter.md#4-form-다단계-시퀀스-규약) 정책 적용. 필드 type 별 keyboard hint:

| `field.type` ([Form spec §1](../../6-presentation/4-form.md#1-설정-config)) | Telegram keyboard |
|---|---|
| `text` / `textarea` / `email` | `force_reply` (기본 입력) |
| `number` | `reply_keyboard` 의 숫자 패드 (1~0 + ".") |
| `select` / `radio` | `inline_keyboard` 로 선택지 노출 (Button 노드와 동일 패턴) |
| `checkbox` | 다중 select — 각 옵션 inline_keyboard + 완료 버튼 |
| `date` | `force_reply` + 형식 안내 (`YYYY-MM-DD`) — v1 은 native date picker 사용 안 함 |
| `file` | `force_reply` 후 file_upload 대기. `allowedMimeTypes` 검증은 어댑터에서 1차 |
| (특수) `phone` (Form spec `type: text` + custom validation rule = phone pattern) | `request_contact: true` 버튼 — share_contact. Form spec 의 `type` Enum 자체는 미변경 (W-4) |

각 필드 prompt 의 본문 포맷:

```
{field.label}{required ? " *" : ""}
{field.description || ""}
```

server-side validation 실패 시 어댑터가 currentFieldIdx 를 되돌리고 그 필드 만 재질문 (사용자는 처음부터 다시 안 함).

### 5.4 Carousel / Chart / Table (CCH-MP-04)

`buttonConfig.nodeOutput` 의 nodeType 에 따라:

| nodeType | 렌더 방식 | 후속 |
|---|---|---|
| `chart` | [`output.rendered`](../../6-presentation/3-chart.md) 의 SVG → PNG 변환 (기존 chart 렌더러 재사용) → `sendPhoto` + caption (chart title) | 버튼이 있으면 그 다음 메시지로 `inline_keyboard` 발송 |
| `carousel` | SSR (headless chromium 또는 satori) 로 카드 1~5장을 1장의 collage PNG 으로 렌더 → `sendPhoto`. 카드 수 > 5 면 첫 5 + "외 N장" caption | 동일 |
| `table` | SSR 로 표 PNG 렌더 (rows ≤ 20 까지 1장, 초과는 첫 20 + "외 N행"). 텍스트 fallback 으로 markdown 표 1건 별도 발송 (시각 fallback) | 동일 |
| `template` | (CCH-MP-04 범위 외 — v2 구현 대상) `output.rendered` 가 HTML 이면 SSR PNG, plain text 면 `sendMessage` (4096자 분할). v1 어댑터는 noop fallback. W-3 흡수 | 동일 |

**v1 분리**: chart 는 [§11 PR-D](../../../5-system/15-chat-channel.md) 의 first 단계, carousel/table 은 SSR 인프라 정비 후 별 PR 권장. CCH-MP-04 의 "필수(단계적)" 등급은 chart 가 v1 필수, carousel/table 은 후속 plan. template 은 CCH-MP-04 미지정 — v2 별도 요구사항으로 분리.

---

## 6. 보안

- `botToken` 은 `botTokenRef` (secret store ref) 만 config 에 저장. 평문 금지 ([CCH-SE-03](../../../5-system/15-chat-channel.md#34-신뢰성--보안)).
- `setWebhook` 의 `secret_token` 파라미터를 등록 시점에 랜덤 발급 (`crypto.randomBytes(24).toString('base64url')` 32 chars). 텔레그램이 모든 update 에 `X-Telegram-Bot-Api-Secret-Token` 헤더로 동봉 → 어댑터가 검증. 검증 실패 시 401 + adapter 가 `null` 반환 (워크플로우 시작 안 함).
- group chat / channel update 는 어댑터 진입점에서 차단 ([CCH-CV-05](../../../5-system/15-chat-channel.md#32-identity--conversation-매핑)) — `chat.type` 검사. `groupChatRefusal` 안내 발송 후 update 무시.
- 다른 봇이 보낸 메시지 (`from.is_bot === true`) 도 무시.

---

## 7. 명령 처리

| 사용자 입력 | 어댑터 처리 |
|---|---|
| `/start` (활성 execution 없음) | 새 execution 시작 + `languageHints.executionStarted` 안내 |
| `/start` (활성 execution 있음) | 기존 execution 취소 (`cancel`) 후 새 execution 시작 + "기존 대화를 종료하고 새로 시작합니다." 안내 |
| `/cancel` | 활성 execution 에 EIA `cancel` 호출. 없으면 noop + "진행 중인 대화가 없습니다." |
| `/help` | 봇 기본 도움말 (v1 은 정적 텍스트 — `languageHints.help` 또는 default 문구) |
| 그 외 명령 (`/...`) | 무시 — v1 은 위 3 종 명령만 처리 |

---

## 8. 비기능

- `sendMessage` 5초 타임아웃 + 3회 지수 백오프 (1s / 2s / 4s). 최종 실패 시 trigger 의 `chat_channel_health` = `degraded`.
- 텔레그램의 group rate limit (30 msg/sec across users, 1 msg/sec per chat) — 어댑터가 chat 단위 큐 + delay 적용.
- update_id 기반 dedup — 같은 update_id 가 30초 안에 두 번 도착하면 두 번째는 무시 (idempotency).

---

## Rationale

### R1. `setWebhook` 의 `secret_token` 검증을 1차 인증으로 (2026-05-21)

대안:
1. **(채택) `setWebhook` 의 `secret_token` + `X-Telegram-Bot-Api-Secret-Token` 검증**: 텔레그램이 공식 지원하는 webhook 인증. 추가 인프라 없음.
2. **(기각) Webhook URL UUID 만 의존**: URL 노출 시 누구나 호출 가능. 텔레그램이 제공하는 native secret token 이 있는데 사용하지 않을 이유 없음.
3. **(기각) HMAC 서명**: 텔레그램은 HMAC 미지원. 추가 변환층 필요.

### R2. `inline_keyboard.callback_data` 에 buttonId UUID 직접 저장 (2026-05-21)

대안:
1. **(채택) UUID 직접 저장**: 텔레그램 callback_data 64 bytes 한계 안에서 UUID v4 (36 chars) 가 충분히 들어감. 어댑터가 별 매핑 테이블 유지 불필요.
2. **(기각) 단축 ID + Redis 매핑**: 한계 64 bytes 가 부족하지 않으므로 매핑 인프라가 over-engineering.
3. **(기각) callback_data 에 추가 메타 (timestamp 등) 동봉**: 64 bytes 부족 위험. 메타는 어댑터가 ChannelConversation 에서 보강.

### R3. v1 = chart only, carousel/table SSR 분리 (2026-05-21)

chart 는 이미 SVG 렌더가 있어 PNG 변환만 추가하면 됨. carousel/table 은 headless chromium 또는 satori 같은 SSR 인프라가 필요 — 다른 노드 (Email integration 등) 에도 영향. PR-D 의 first iteration 은 chart 만, carousel/table 은 follow-up plan 으로 분리.

### R4. MarkdownV2 escape 책임을 어댑터로 (2026-05-21)

LLM 응답이 일반 markdown 형식이지만 텔레그램 MarkdownV2 는 추가 escape 가 필요 (`_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`). 어댑터가 sendMessage 직전에 escape — workflow 노드는 일반 markdown 으로 작성하면 되고 채널별 quirk 는 어댑터에 흡수.

### R5. group chat 무한 차단 vs 사용자 선택 (2026-05-21)

대안:
1. **(채택) v1 무한 차단**: multi-user thread 가 v2 옵션. v1 에서 group 허용하면 conversation 매핑 깨짐.
2. **(기각) config 로 group 허용**: 사용자가 옵션을 켜도 thread 자료구조가 single-user 가정 → 동작 안 함.
3. **(기각) group 도 single-user 흉내**: 임의 first user 의 메시지로 thread 진행 — 사용자가 혼동.

근거: [CCH-CV-05](../../../5-system/15-chat-channel.md#32-identity--conversation-매핑) 의 v1 정책 정합. group 지원은 v2 multi-user thread 와 한 묶음.
