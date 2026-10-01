---
id: "CLE-CHAT-TELEGRAM"
title: "Telegram 어댑터"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-TGRAM-001", "REQ-TGRAM-002", "REQ-TGRAM-003", "REQ-TGRAM-004", "REQ-TGRAM-005", "REQ-TGRAM-006", "REQ-TGRAM-007", "REQ-TGRAM-008", "REQ-TGRAM-009", "REQ-TGRAM-010", "REQ-TGRAM-011", "REQ-TGRAM-012", "REQ-TGRAM-013", "REQ-TGRAM-014", "REQ-TGRAM-015", "REQ-TGRAM-016", "REQ-TGRAM-017", "REQ-TGRAM-018", "REQ-TGRAM-019", "REQ-TGRAM-020", "REQ-TGRAM-021", "REQ-TGRAM-022", "REQ-TGRAM-023", "REQ-TGRAM-024", "REQ-TGRAM-025", "REQ-TGRAM-026", "REQ-TGRAM-027", "REQ-TGRAM-028", "REQ-TGRAM-029", "REQ-TGRAM-030", "REQ-TGRAM-031"]
basis_superseded: false
parent: "CLE-CHAT"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT"]
area: "CLE-CHAT"
content_hash: "bca47ff1935cf4aaccbd4e47aef4786db6c8e448e7e21b4c80bdbcb9fa127ff3"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/7-trigger/providers/telegram.md"]
mirror_sha256: "3cce8b23ff6277538f70cfdcf9085c5afc52de33a87874a0de91a0b158b4efbd"
etag: "sha256-d09ee1dfae7fc86e2c8014ac4cecad52ad4dacb33b8e6ff9ca18b25ca900a8e7"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/7-trigger/providers/telegram.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

`provider: "telegram"` 채널 어댑터는 [Telegram Bot API](https://core.telegram.org/bots/api) 위에서 동작한다. 사용자가 BotFather 에서 봇을 만들고 봇 토큰을 등록하면, 어댑터가 `setWebhook` 으로 Telegram 에서 우리 웹훅 트리거로 오는 연결을 자동 등록한다. 그리고 [채팅 채널](CLE-CHAT-CORE.md) 의 UI 매핑 요구사항(CCH-MP-01~06)이 다루는 노드, 곧 멀티턴 AI, 버튼이 있는 Presentation 노드, Form, 시각형 노드(Carousel·Chart·Table), Template 을 Telegram UI 로 바꾼다.

이 문서는 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 인터페이스의 Telegram 구현을 정한다. 공통 규칙(렌더 매핑, 실행 실패 분류, Form 입력 흐름, 다단계 질문 본문 형식)은 어댑터 규약을, 인바운드 HTTP 응답·명령 공통 의미·재시도 정책은 [채팅 채널](CLE-CHAT-CORE.md) 을, 설정 필드와 안내 문구는 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 을 따른다. 시각형 노드 × `visualNode` × 버전 매트릭스는 이 문서가 기준이고 [Slack 어댑터](CLE-CHAT-SLACK.md)·[Discord 어댑터](CLE-CHAT-DISCORD.md) 가 같은 정책을 쓴다.

## 사용 시나리오

| 시나리오 | 설명 |
|---|---|
| 텔레그램 봇 챗봇 | 사용자가 봇에게 메시지를 보내면 멀티턴 AI 노드로 들어가 자연스럽게 대화한다 |
| 텔레그램 봇 결재 | 사용자 명령 → Form 다단계 질문 → 결재 결과 통보 |
| 텔레그램 봇 데이터 안내 | 사용자 명령 → Chart 렌더 → v1 은 monospace 텍스트 차트와 선택 버튼, v2 는 `sendPhoto` 이미지 |

## 요구사항

- REQ-TGRAM-001 WHEN `setupChannel` 이 불리면 THE SYSTEM SHALL `setWebhook`(`url`, `secret_token`, `allowed_updates: ["message", "callback_query"]`, `drop_pending_updates: true`)으로 웹훅을 등록하고 `getMe` 결과를 `config.chatChannel.botIdentity` 에 캐시한다. (원본: telegram §3.1)
- REQ-TGRAM-002 WHEN `setupChannel` 이 불리면 THE SYSTEM SHALL 32자 `secret_token` 을 새로 만들어 `SetupResult.issuedInboundSigning` 으로 한 번만 돌려준다. (원본: telegram §3.1, §6)
- REQ-TGRAM-003 WHEN `teardownChannel` 이 불리면 THE SYSTEM SHALL `deleteWebhook`(`drop_pending_updates: true`)을 부르고 실패해도 트리거 비활성화를 막지 않는다. (원본: telegram §3.2)
- REQ-TGRAM-004 WHEN Telegram update 가 오면 THE SYSTEM SHALL [명령 매핑](#명령-매핑) 표에 따라 `ChannelUpdate` 로 바꾸고 `update.update_id` 를 중복 제거 키로 쓴다. (원본: telegram §4)
- REQ-TGRAM-005 IF `message.chat.type` 이 `group`·`supergroup`·`channel` 이면 THE SYSTEM SHALL `parseUpdate` 가 `null` 을 돌려주고 호출자가 `languageHints.groupChatRefusal` 안내를 보낸 뒤 update 를 버린다. (원본: telegram §4, §6, CCH-CV-05)
- REQ-TGRAM-006 IF `message.from.is_bot === true` 이면 THE SYSTEM SHALL 안내 없이 update 를 버린다. (원본: telegram §4, §6)
- REQ-TGRAM-007 IF `sticker`·`voice` 처럼 지원하지 않는 update 가 오면 THE SYSTEM SHALL `parseUpdate` 가 `null` 을 돌려주고 호출자가 `unsupportedMessageKind` 안내를 보낸다. (원본: telegram §4)
- REQ-TGRAM-008 WHEN `execution.ai_message` 를 보내면 THE SYSTEM SHALL MarkdownV2 escape 한 `sendMessage` 로 보내고 4096자를 넘으면 단어·문장 경계로 나눠 마지막 조각 전까지 `\n_(continued…)_` 를 붙인다. (원본: telegram §5.1)
- REQ-TGRAM-009 WHEN 본문이 있는 `execution.ai_message` 를 보내면 THE SYSTEM SHALL 텍스트 앞에 `sendChatAction(typing)` 을 한 번 보내고 본문이 비어 있으면 둘 다 보내지 않는다. (원본: telegram §5.1)
- REQ-TGRAM-010 WHEN 버튼 대기를 보내면 THE SYSTEM SHALL `buttonConfig.buttons[]` 를 `uiMapping.buttonLayout` 에 따라 `inline_keyboard` 로 만들고 `callback_data` 에 `buttonId` 를 그대로 넣는다. (원본: telegram §5.2)
- REQ-TGRAM-011 WHEN `callback_query` 가 오면 THE SYSTEM SHALL 곧바로 `answerCallbackQuery` 를 부르고 EIA `click_button` 을 부른 뒤 원본 메시지의 키보드를 `editMessageReplyMarkup` 으로 지운다. (원본: telegram §5.2)
- REQ-TGRAM-012 IF 키보드 제거(`editMessageReplyMarkup`)가 실패하면 THE SYSTEM SHALL 로그만 남기고 ack 흐름을 막지 않는다. (원본: telegram §5.2)
- REQ-TGRAM-013 WHEN Form 입력 대기가 오면 THE SYSTEM SHALL 늘 다단계 질문으로 받고 필드 `type` 별 키보드 힌트를 붙인다. (원본: telegram §5.3)
- REQ-TGRAM-014 WHEN `text` 필드에 `validation.preset: 'phone'` 이 있으면 THE SYSTEM SHALL `request_contact: true` 버튼을 보내고 받은 번호를 폼 데이터에 채운다. (원본: telegram §5.3) (미구현)
- REQ-TGRAM-015 WHEN 시각형 노드나 Template 을 보내면 THE SYSTEM SHALL [시각형 매트릭스](#시각형-매트릭스) 의 v1 MarkdownV2 텍스트·monospace 표현으로 보낸다. (원본: telegram §5.4)
- REQ-TGRAM-016 IF v1 에서 `visualNode` 가 `photo` 이면 THE SYSTEM SHALL 텍스트로 대신 보내고 warning 로그를 남기며 채널 건강도는 바꾸지 않는다. (원본: telegram §5.4)
- REQ-TGRAM-017 WHEN 시각형 노드에 `buttonConfig.buttons[]` 가 있으면 THE SYSTEM SHALL 시각 메시지를 모두 보낸 다음 메시지로 `inline_keyboard` 를 보낸다. (원본: telegram §5.4)
- REQ-TGRAM-018 WHEN `visualNode` 가 `auto` 이고 Carousel 카드에 이미지 URL 이 있으면 THE SYSTEM SHALL 그 카드를 `sendPhoto`(caption 은 제목과 설명)로 보낸다. (원본: telegram §5.4) (미구현)
- REQ-TGRAM-019 WHEN `image` 메시지를 보내면 THE SYSTEM SHALL `sendPhoto`(chat_id, photo, caption)로 보낸다. (원본: telegram §3) (미구현)
- REQ-TGRAM-020 WHEN `execution.failed` 를 받으면 THE SYSTEM SHALL 분류 결과 문구를 MarkdownV2 escape 한 `sendMessage` 1회로 보내고 `reply_markup`·`reply_to_message_id` 는 붙이지 않는다. (원본: telegram §5.6)
- REQ-TGRAM-021 WHEN `execution.cancelled` 의 `error.code` 가 `RESUME_` 로 시작하면 THE SYSTEM SHALL 일반 취소 안내 대신 `languageHints.sessionExpired` 를 보낸다. (원본: telegram §5.7)
- REQ-TGRAM-022 WHEN 재개 명령이 `STATE_MISMATCH` 로 거부되면 THE SYSTEM SHALL `escapeControlText` 로 escape 한 `languageHints.surfaceMismatch` 를 보내고 발송 실패는 흡수한다. (원본: telegram §5.8)
- REQ-TGRAM-023 IF `X-Telegram-Bot-Api-Secret-Token` 헤더가 없거나 저장한 값과 다르면 THE SYSTEM SHALL `401` 로 답하고 워크플로우를 시작하지 않는다. (원본: telegram §6)
- REQ-TGRAM-024 WHEN 활성 실행이 없는 대화에 `/start` 가 오면 THE SYSTEM SHALL 새 실행을 시작하고 `languageHints.executionStarted` 안내를 보낸다. (원본: telegram §7)
- REQ-TGRAM-025 WHEN 활성 실행이 있는 대화에 `/start` 가 오면 THE SYSTEM SHALL 기존 실행을 취소하고 새 실행을 시작하며 "기존 대화를 종료하고 새로 시작합니다." 를 안내한다. (원본: telegram §7)
- REQ-TGRAM-026 WHEN `/cancel` 이 오면 THE SYSTEM SHALL 활성 실행에 EIA `cancel` 을 부르고 활성 실행이 없으면 "진행 중인 대화가 없습니다." 를 안내한다. (원본: telegram §7)
- REQ-TGRAM-027 WHEN `/help` 가 오면 THE SYSTEM SHALL 대화 조회 전에 `languageHints.help`(없으면 기본 문구)를 보내고 워크플로우는 시작하지 않는다. (원본: telegram §7)
- REQ-TGRAM-028 IF `/start`·`/cancel`·`/help` 가 아닌 `/` 명령이 오면 THE SYSTEM SHALL 무시한다. (원본: telegram §7)
- REQ-TGRAM-029 WHEN `sendMessage` 를 부르면 THE SYSTEM SHALL 5초 타임아웃과 지수 백오프로 총 3회까지 시도하고 끝내 실패하면 `chat_channel_health` 를 `degraded` 로 바꾼다. (원본: telegram §8)
- REQ-TGRAM-030 WHILE Telegram rate limit(사용자 전체 초당 30건, 대화당 초당 1건) 안에서 보내는 동안 THE SYSTEM SHALL 대화 단위 큐와 지연으로 발송 속도를 맞춘다. (원본: telegram §8) (미구현)
- REQ-TGRAM-031 WHEN 같은 `update_id` 가 30초 안에 다시 오면 THE SYSTEM SHALL 두 번째 update 를 무시한다. (원본: telegram §8)

요구사항 보충 설명은 다음과 같다.

- 관련 REQ-TGRAM-013·014: 전화번호 preset 은 [Form 노드](../CLE-NODE-PRES/CLE-NODE-FORM.md) 에 아직 없다(스키마, 서버 정규식, 어댑터 힌트 모두 없음). Form 의 `type` enum 자체는 바꾸지 않는다.
- 관련 REQ-TGRAM-018·019: 현재 구현(`telegram.adapter.ts` 의 `image` 분기, `renderCarouselFallback`)은 이미지 메시지를 caption·`fallbackText` 텍스트로 보내고 Carousel 카드도 모두 텍스트로 보낸다. multipart 업로드와 SSR PNG 인프라가 없다.
- 관련 REQ-TGRAM-025: 활성 실행 중 `/start` 처리는 [채팅 채널](CLE-CHAT-CORE.md) 과 정의가 갈린다. [미결 사항](#미결-사항) 참조.
- 관련 REQ-TGRAM-029·031: 재시도 정책과 중복 제거 키·TTL 은 [채팅 채널](CLE-CHAT-CORE.md)·[채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 이 정한다. 대기 간격은 1초, 2초 두 번이다(`telegram-client.ts` `call`, 구현됨). 중복 제거는 `ChatChannelDedupService` 가 `String(update_id)` 로 한다(구현됨).

## Bot API 호출 매핑

| 어댑터 함수 | Telegram Bot API |
|---|---|
| `setupChannel` | `POST /bot{token}/setWebhook`(url, secret_token, allowed_updates)과 `GET /bot{token}/getMe`(botId·username 캐시) |
| `teardownChannel` | `POST /bot{token}/deleteWebhook` |
| `parseUpdate` | Telegram Update 객체 → `ChannelUpdate`(chat_id, from.id, text·callback_query·document 분기) |
| `sendMessage`(text) | `POST /bot{token}/sendMessage`(chat_id, text, `parse_mode=MarkdownV2` escape) |
| `sendMessage`(buttons) | `sendMessage` + `reply_markup.inline_keyboard` |
| `sendMessage`(form_prompt) | `sendMessage` + 선택 `reply_markup.keyboard`(텍스트·숫자·연락처 공유)나 `remove_keyboard` |
| `sendMessage`(image) | 목표는 `POST /bot{token}/sendPhoto`(chat_id, photo, caption). 미구현이라 현재는 caption·`fallbackText` 를 텍스트 `sendMessage` 로 보낸다 |
| `sendMessage`(typing) | `POST /bot{token}/sendChatAction`(action=typing) |
| `ackInteraction`(button_callback) | `POST /bot{token}/answerCallbackQuery`(callback_query_id) |

### setupChannel

```text
POST https://api.telegram.org/bot{token}/setWebhook
{
  "url": "{callbackUrl}",                   // ${BASE_URL}/api/hooks/${trigger.endpointPath}
  "secret_token": "{randomly_generated}",   // 32자 [A-Za-z0-9_-]. 평문은 SetupResult.issuedInboundSigning 으로 한 번만 드러난다
  "allowed_updates": ["message", "callback_query"],  // 필요한 update 만. 그룹 관련 update 는 구독하지 않는다
  "drop_pending_updates": true              // 기존 봇이 있던 경우 쌓인 update 를 버린다
}

GET https://api.telegram.org/bot{token}/getMe
→ { ok: true, result: { id, username, ... } } → config.chatChannel.botIdentity 캐시
```

`secret_token` 평문은 호출자(`ChatChannelBinderService`)가 `SecretResolver.rotate(secret://triggers/{id}/inbound-signing, ...)` 로 저장하고 참조만 `config.chatChannel.inboundSigningRef` 에 넣는다. `setupChannel` 을 다시 부를 때마다 새 값이 등록되고 다시 저장된다. 이것이 Telegram 서버 발급 서명 자료의 정상 동작이며 `chatChannel` 이 실린 PATCH 도 이 값을 바꾼다([채팅 채널](CLE-CHAT-CORE.md) 의 인바운드 서명 자료 변경, [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 의 setupChannel 멱등의 뜻).

### teardownChannel

```text
POST https://api.telegram.org/bot{token}/deleteWebhook
{ "drop_pending_updates": true }
```

부분 실패해도 트리거 비활성화를 막지 않는다. 다음 setup 때 새 토큰으로 다시 등록되면 낡은 웹훅은 저절로 무효가 된다.

## 명령 매핑

| Telegram update | `ChannelUpdate.command` |
|---|---|
| `/start`(또는 `/start <param>`) | `{ kind: "start" }` |
| `/cancel` | `{ kind: "cancel" }` |
| `/help` | `{ kind: "text_message", text: "/help" }`. `readCommand` 가 `/help` 만 텍스트로 통과시킨다 |
| 일반 텍스트(`message.text`, 명령 아님) | `{ kind: "text_message", text }` |
| `callback_query`(인라인 키보드 탭) | `{ kind: "button_callback", callbackData, callbackQueryId, messageId? }`. `messageId` 는 `callback_query.message.message_id` 이고 ack 뒤 키보드 제거에 쓴다 |
| `message.document`·`message.photo`·`message.video` | `{ kind: "file_upload", fileId, mimeType }` |
| `message.contact`(연락처 공유) | `{ kind: "contact_share", phone }` |
| `message.chat.type ∈ ('group', 'supergroup', 'channel')` | `null`. `parseUpdate` 는 순수 함수라 안내를 보내지 않는다. 호출자(`HooksService`)가 `chat.type !== 'private'` 분기에서 `groupChatRefusal` 을 따로 보낸다 |
| `message.from.is_bot === true` | `null`(다른 봇 메시지 무시, 안내 없음) |
| 그 밖의 `/` 명령 | `null` |
| 그 밖(`sticker`, `voice` 등) | `null`. 호출자가 "지원하지 않는 메시지 형식입니다." 를 보낸다 |

Telegram 은 모든 update 에 단조 증가 `update_id` 를 붙이므로 그 값을 중복 제거 키(`idempotencyKey`)로 그대로 쓴다.

## 노드 UI 매핑

### 멀티턴 AI

- `execution.ai_message.message` 를 `sendMessage`(`parse_mode=MarkdownV2`, Bot API 규칙대로 escape)로 보낸다.
- 4096자(Telegram 메시지 한도)를 넘으면 단어·문장 경계로 나눈다. 마지막 조각 전까지 `\n_(continued…)_` 를 붙인다.
- 응답 직전에 `sendChatAction(action=typing)` 을 한 번 보낸다(5초 뒤 자동 만료). `telegram-message.renderer.ts` 의 `renderAiMessage` 가 본문이 있는 `ai_message` 에서 텍스트 앞에 `{ kind: 'typing' }` 메시지를 넣고, 어댑터 `sendMessage` 의 `typing` 분기가 `sendChatAction` 으로 보낸다. 긴 실행 동안 주기적으로 보내는 typing 은 [채팅 채널](CLE-CHAT-CORE.md) R9 의 v2 검토 항목이다.
- 사용자 답장(`text_message`)은 EIA `submit_message` 로 보낸다.

### 버튼

- `buttonConfig.buttons[]` 를 `inline_keyboard` 2차원 배열로 만든다. `uiMapping.buttonLayout` 에 따라 나눈다.
  - `auto`(기본): 라벨 길이 합이 24자 이하인 버튼은 같은 행, 넘으면 새 행.
  - `vertical`: 1열 N행.
  - `horizontal`: 1행 N열(8개까지, 넘으면 줄바꿈).
- `callback_data` 에 `buttonId`(UUID)를 그대로 넣는다. 64바이트 한도 안에 UUID 가 들어간다(R2).
- `style: 'primary'` 는 ✅ 접두, `'danger'` 는 ⚠️ 접두, 그 밖은 그대로.
- 노드가 시각형이면 시각 메시지를 먼저 보내고 인라인 키보드는 다음 메시지로 붙인다([시각형 매트릭스](#시각형-매트릭스)). 현재 구현은 버튼 달린 Template 도 이렇게 처리하지만, 시스템 요구사항(CCH-MP-04)에 Template 을 넣을지는 [Template 노드 §미결 사항](../CLE-NODE-PRES/CLE-NODE-TEMPLATE.md#미결-사항) 에서 정한다.
- `callback_query` 가 오면 다음 순서로 처리한다.
  1. `answerCallbackQuery(callback_query_id)` 를 곧바로 부른다. Telegram 의무이고, 부르지 않으면 모바일 클라이언트에 로딩 표시가 계속 남는다.
  2. EIA `click_button` 을 부른다.
  3. 원본 메시지를 `editMessageReplyMarkup`(빈 `inline_keyboard`)으로 바꿔 키보드를 지워 중복 클릭을 막는다. `ackInteraction` 이 `ChannelUpdate.command.messageId` 로 이것을 부르고, 메시지 만료(48시간)나 이미 편집된 경우 같은 실패는 로그만 남긴다. `messageId` 가 없으면 부르지 않는다.

### Form

Telegram 은 `supportsNativeForm = false`(네이티브 모달 미지원, Mini App 은 별도 작업)라 늘 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 의 다단계 질문을 쓴다. 필드 `type` 별 키보드 힌트는 다음과 같다.

| `field.type`([Form 노드](../CLE-NODE-PRES/CLE-NODE-FORM.md)) | Telegram 키보드 |
|---|---|
| `text`·`textarea`·`email` | `force_reply`(기본 입력) |
| `number` | `reply_keyboard` 숫자 패드(1~0 과 ".") |
| `select`·`radio` | `inline_keyboard` 로 선택지 노출(버튼과 같은 방식) |
| `checkbox` | 다중 선택. 선택지마다 `inline_keyboard` 와 완료 버튼 |
| `date` | `force_reply` 와 형식 안내(`YYYY-MM-DD`). v1 은 네이티브 날짜 선택기를 쓰지 않는다 |
| `file` | `force_reply` 뒤 `file_upload` 대기. `allowedMimeTypes` 는 어댑터가 1차 검증한다 |
| `text` + `validation.preset: 'phone'` | `request_contact: true` 버튼(연락처 공유). 받으면 어댑터가 번호를 폼 데이터에 채운다. 미구현(Form 에 preset 이 아직 없다). preset 없는 일반 `text` 는 첫 행처럼 처리한다 |

질문 본문 형식과 서버 쪽 검증 실패 때 그 필드만 다시 묻는 동작은 어댑터 규약을 따른다. 질문 둘째 줄에 쓰는 `field.description` 은 Form 노드의 필드 정의에 없다([Form 노드 §미결 사항](../CLE-NODE-PRES/CLE-NODE-FORM.md#미결-사항)).

### 시각형 매트릭스

버튼 대기의 `buttonConfig.nodeOutput`, 표시 전용 완료(`execution.node.completed`), AI 표시물(`ai_message.presentations[]`) 세 진입점이 이 매트릭스를 함께 쓴다. v1 은 MarkdownV2 텍스트·monospace 표현이다(의존성 추가 없이 바로 동작). v2 SSR PNG 는 후속이다. `visualNode` 값의 뜻은 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 을 본다.

| 노드 유형 | `text`(v1·v2) | `photo` v1 | `photo` v2 | `auto` v1 | `auto` v2 |
|---|---|---|---|---|---|
| `chart` | `output.payload.{title, series, labels}` → monospace 미니 막대 차트(24칸 가로 막대, MarkdownV2 code block, 4096자 넘으면 분할). 입력 모양은 [미결 사항](#미결-사항) 참조 | 텍스트로 대신(warning 로그) | satori SVG → PNG `sendPhoto` | 텍스트(차트는 텍스트가 더 읽기 쉬워 `auto` 도 텍스트 우선) | 텍스트(v2 에서도 텍스트 우선) |
| `carousel` | `output.items[]` → 카드를 차례로 보낸다. 이미지 URL 을 무시하고 늘 `sendMessage`(굵은 제목, 설명, `🖼 {imageUrl}` 텍스트 줄). 카드 10장 상한과 "외 N장" | `auto` v1 으로 대신(warning 로그) | 카드 1~5장 collage PNG `sendPhoto` 1회 | 현재는 `text` 와 같다(`renderCarouselFallback` 이 모든 카드를 `sendMessage` 로 보내고 이미지 URL 은 `🖼 {url}` 텍스트). 카드별 이미지 URL 이 있으면 `sendPhoto`(caption 은 제목과 설명)로 나누는 것은 미구현. 카드 10장 상한과 "외 N장", 전역 버튼은 마지막 카드 뒤 별도 메시지 | 카드별 분기와 5장 collage PNG 시도 |
| `table` | `output.{rows, columns}` → monospace MarkdownV2 표(열 너비 자동 정렬, 셀 패딩, 헤더 구분선, 행 20개 상한, 16자 넘는 셀 말줄임, code block, 4096자 분할) | 텍스트로 대신(warning 로그) | 표 PNG `sendPhoto` | 텍스트(표도 텍스트 우선) | 텍스트 |
| `template` | `output.rendered` 를 MarkdownV2 escape 해 `sendMessage`(4096자 분할). HTML·Markdown·Text 세 모드 모두 텍스트로 보낸다(v1 은 HTML 을 렌더하지 않고 escape 한 평문). v2 의 HTML·Markdown 서식 렌더는 후속 | 텍스트로 대신 | HTML → SSR PNG | 텍스트 | HTML → SSR PNG |

표의 필드 경로는 노드가 무엇을 만드는지를 적은 것이고 렌더러가 읽는 순서와 wire 모양은 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 의 시각형 렌더 입력이 정한다. 다만 `chart`·`carousel` 행의 입력 필드(`payload.{title, series, labels}`, `imageUrl`)는 노드 출력과 정의가 갈린다. [미결 사항](#미결-사항) 참조.

- **버튼**: 모든 시각형에서 `buttonConfig.buttons[]` 가 있으면 시각 메시지 다음 메시지로 `inline_keyboard` 를 보낸다. 사용자가 내용을 본 뒤 고르게 하려는 것이다.
- **옛 `text_only`**: 어댑터가 입력 단계에서 `visualNode === "text_only"` 를 `"text"` 로 바꾼다(마이그레이션 전 과도기).

### 실행 실패

`execution.failed` 는 어댑터 규약의 `classifyExecutionFailure(event)` 가 정한 `(key, placeholders)` 로 문구를 찾아 채운 뒤 `sendMessage` 한 번으로 보낸다. 민감 정보 제외는 [채팅 채널](CLE-CHAT-CORE.md) 의 CCH-ERR-03 을 따른다.

| 항목 | Telegram 매핑 |
|---|---|
| API 호출 | `POST /bot{token}/sendMessage` 1회. 안내는 한 줄이라 나누지 않는다 |
| 본문 | `languageHints[key]` 에 `{statusCode}` 를 채운 결과. MarkdownV2 escape(R4 의 예약 문자 모두 backslash), `parse_mode: "MarkdownV2"` |
| `reply_markup` | 붙이지 않는다(종결 이벤트라 인터랙션 컨트롤이 없다) |
| `reply_to_message_id` | 붙이지 않는다(1:1 DM) |
| ack | 관계없다(callback 이 아니다) |
| 타임아웃·재시도 | 5초 타임아웃, 총 3회 시도. 끝내 실패하면 `degraded` |

### 멀티턴 재개 실패 취소

멀티턴 AI 대화를 서버 재시작이나 체크포인트 부재로 재개할 수 없으면 엔진이 실행을 `cancelled` 로 표시하고 `execution.cancelled` 에 `error.code`(`RESUME_INCOMPATIBLE_STATE`·`RESUME_CHECKPOINT_MISSING`·`RESUME_FAILED`)를 실어 보낸다([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)).

| 항목 | Telegram 매핑 |
|---|---|
| 분기 | `error.code` 가 `RESUME_` 로 시작하면 일반 취소 안내 대신 `languageHints.sessionExpired` 를 보낸다. 그 밖의 취소(사용자 `/cancel` 등)는 일반 취소 안내다 |
| 본문 | `sessionExpired` 문구, MarkdownV2 escape, `sendMessage` 한 번 |
| 이후 | 사용자의 다음 메시지는 새 실행으로 시작한다(`getActiveExecutionStatus` 가 cancelled 를 비활성으로 본다) |

예전에는 재개 실패가 채널에 아무 소리 없이 끝났다(DB 만 cancelled 로 바뀌고 이벤트가 나가지 않았다). 이 안내가 그 퇴행을 없앤다. AI 에이전트의 정상 재개([실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 의 `_resumeCheckpoint`)가 동작하므로 실제로는 배포 전에 들어간 대기 행, 정보 추출기 노드, 손상된 경우에만 보인다.

### 표면 불일치

인바운드 명령이 현재 대기 노드의 표면과 맞지 않아 재개 명령 발행기가 `STATE_MISMATCH` 로 거부하면(예: Form·버튼 대기 중 자유 텍스트), `HooksService` 가 거부를 흡수하면서 `languageHints.surfaceMismatch` 를 보낸다.

| 항목 | Telegram 매핑 |
|---|---|
| 분기 | 서버 안 전달(`forwardToInteractionService`)이 `STATE_MISMATCH` 를 흡수할 때 `sendSurfaceMismatchNotice` 로 보낸다. 발송 실패는 흡수하고 warn 을 남겨 재시도 루프를 만들지 않는다 |
| 본문 | `surfaceMismatch` 문구(평문). `renderNode` 를 거치지 않으므로 발송 직전 `adapter.escapeControlText`(Telegram 은 `escapeMarkdownV2`)로 escape 한다 |

제어 안내 일곱 개의 escape 규칙은 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 이 정한다. 예전에는 이 경로가 escape 를 거치지 않아 Telegram 기본 문구에 `\.` 를 미리 넣었고, 그 문구가 Slack·Discord 에서 그대로 보였다. 운영자 덮어쓰기는 등록 검증으로 막았다. 발송 직전 escape 로 근본을 고쳐 기본 문구와 덮어쓰기 모두 평문으로 쓴다.

## 보안

- 봇 토큰은 `botTokenRef`(시크릿 참조)만 설정에 둔다. 평문 저장은 금지다(CCH-SE-03).
- `setWebhook` 의 `secret_token` 은 등록 때 무작위로 만든다(`crypto.randomBytes(24).toString('base64url')`, 32자). 평문은 `SetupResult.issuedInboundSigning` 에 한 번만 드러나고 호출자가 시크릿 저장소에 저장한 뒤 참조만 `inboundSigningRef` 에 둔다. Telegram 은 모든 update 에 `X-Telegram-Bot-Api-Secret-Token` 헤더를 붙인다. 진입점이 `SecretResolver.resolve(inboundSigningRef)` 로 값을 꺼내 헤더와 같은지 확인한다. 다르면 `401` 이고 어댑터는 `null` 을 돌려준다(워크플로우를 시작하지 않는다).
- 그룹·채널 update 는 진입점에서 `chat.type` 으로 막고 `groupChatRefusal` 안내 뒤 버린다(CCH-CV-05).
- 다른 봇이 보낸 메시지(`from.is_bot === true`)도 무시한다.
- 인바운드 HTTP 응답 정책(인증, 비활성 트리거, 그룹 대화, 미지원 update, 내부 에러)은 [채팅 채널](CLE-CHAT-CORE.md) 의 인바운드 HTTP 응답 계약이 기준이고 여기 사본을 두지 않는다. 요점은 `202 Accepted` 고정, 인증 실패만 `401`, 엔드포인트 미존재만 `404` 이고 비활성 트리거도 `202 + { executionId: 'ignored' }` 다.

## 명령 처리

| 사용자 입력 | 어댑터 처리 |
|---|---|
| `/start`(활성 실행 없음) | 새 실행 시작, `languageHints.executionStarted` 안내 |
| `/start`(활성 실행 있음) | 기존 실행을 취소(`cancel`)하고 새 실행 시작, "기존 대화를 종료하고 새로 시작합니다." 안내. [미결 사항](#미결-사항) 참조 |
| `/cancel` | 활성 실행에 EIA `cancel`. 없으면 아무것도 하지 않고 "진행 중인 대화가 없습니다." |
| `/help` | v1 정적 도움말(`languageHints.help` 나 기본 문구). `parseTelegramUpdate` 의 `readCommand` 가 `/help` 를 `text_message` 로 통과시키고(`/start`·`/cancel` 밖의 다른 `/` 명령은 `null`), `HooksService` 가 대화 조회 전에 `/help` 인지 검사해 안내한다. 워크플로우는 시작하지 않는다 |
| 그 밖의 명령(`/...`) | 무시. v1 은 `/start`·`/cancel`·`/help` 만 처리한다 |

## 비기능

- `sendMessage` 는 5초 타임아웃과 지수 백오프로 총 3회 시도한다. 대기는 1초, 2초 두 번이고 세 번째 실패 뒤에는 기다리지 않는다(`telegram-client.ts` `call`, 구현됨). 끝내 실패하면 `chat_channel_health` 를 `degraded` 로 바꾼다. 정책의 기준은 [채팅 채널](CLE-CHAT-CORE.md) 이다.
- Telegram rate limit(사용자 전체 초당 30건, 대화당 초당 1건)에 맞춘 대화 단위 큐와 지연은 미구현이다. 현재 `telegram-client.ts` 는 실패 때 지수 백오프만 한다.
- `update_id` 중복 제거는 구현됐다(2026-08-13). 파서가 채운 `idempotencyKey = String(update_id)` 를 `ChatChannelDedupService` 가 쓴다(Redis `SET NX EX 30`, 키 `cc:dedup:<triggerId>:<updateId>`, 인바운드 진입에서 분당 한도 앞). Redis 가 없으면 통과시킨다. 키·TTL·게이트 순서는 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 이 정한다.

## 미결 사항

- **활성 실행 중 `/start`**: 이 문서의 명령 처리 표는 활성 실행이 있어도 `/start` 면 기존 실행을 취소하고 새로 시작한다고 정한다. [채팅 채널](CLE-CHAT-CORE.md) 의 CCH-CV-03 은 두 번째 이후 메시지를 실행 상태로만 나누고 `/start` 예외가 없다. 명령 우선 규칙을 시스템 요구사항에 둘지 프로바이더 문서 소관으로 둘지 결정 필요.
- **`visualNode=text` 의 시각 메시지**: 이 문서의 매트릭스는 `text` 에서도 Chart·Table·Carousel 을 텍스트로 보낸다고 정한다. 현재 구현(`telegram-message.renderer.ts`)은 `visualNode !== 'text'` 일 때만 시각 메시지를 만들어, 버튼 대기에서 `text` 를 고르면 시각 내용이 빠진다. [채팅 채널](CLE-CHAT-CORE.md) 의 미결 사항과 함께 결정 필요.
- **Chart·Carousel 입력 모양**: 매트릭스의 Chart 입력(`output.payload.{title, series, labels}`)과 Carousel 카드 `imageUrl` 이 [Chart 노드](../CLE-NODE-PRES/CLE-NODE-CHART.md)(`output.data`, `{ x, y? }[]`)·[Carousel 노드](../CLE-NODE-PRES/CLE-NODE-CAROUSEL.md)(`output.items[].image`) 출력과 다르다. 현재 구현(렌더러)도 `series`·`labels`·`imageUrl` 을 찾는다. [Presentation 노드 공통 §미결 사항](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md#미결-사항) 과 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md#미결-사항) 의 미결 사항과 함께 결정 필요.

## 구현 위치

- `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts`
- `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts`
- `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-update.parser.ts`
- `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts`
- 사용자 가이드: `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx`, `telegram.en.mdx`

## Rationale

### R1 setWebhook 의 secret_token 검증을 1차 인증으로 쓴다

`setWebhook` 의 `secret_token` 과 `X-Telegram-Bot-Api-Secret-Token` 검증을 택했다. Telegram 이 공식 지원하는 웹훅 인증이라 인프라를 더할 필요가 없다. 웹훅 URL 의 UUID 에만 기대면 URL 이 새어 나갔을 때 누구나 부를 수 있고, Telegram 은 HMAC 서명을 지원하지 않아 변환 계층이 더 필요하다.

### R2 callback_data 에 buttonId UUID 를 그대로 넣는다

`callback_data` 64바이트 한도 안에 UUID v4(36자)가 넉넉히 들어가 별도 매핑 테이블이 필요 없다. 짧은 id 와 Redis 매핑은 64바이트가 모자라지 않으니 과한 설계다. `callback_data` 에 타임스탬프 같은 메타를 더 넣으면 64바이트가 모자랄 수 있어, 메타는 어댑터가 채널 대화 상태에서 보강한다.

### R3 시각형은 v1 에서 텍스트로 보낸다

처음에는 "v1 은 Chart 만 PNG, Carousel·Table 은 SSR 인프라가 필요해 후속" 으로 정했다. Chart 는 이미 SVG 렌더가 있어 PNG 변환만 더하면 된다는 근거였다. 이후 v1 을 의존성 없이 바로 동작하는 MarkdownV2 텍스트·monospace 표현으로 통일했고([시각형 매트릭스](#시각형-매트릭스)), 백엔드는 차트 SVG 를 만들지 않으므로(노드 출력 스냅샷 폐기) 그 근거도 성립하지 않는다. 이미지 발송(SSR PNG)은 세 시각형 모두 v2 로 미룬다. SSR 인프라(headless chromium 이나 satori)는 Send Email 통합 같은 다른 노드에도 영향을 준다.

### R4 MarkdownV2 escape 는 어댑터가 맡는다

LLM 응답은 일반 Markdown 이지만 Telegram MarkdownV2 는 추가 escape(`_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`)가 필요하다. 어댑터가 보내기 직전에 escape 한다. 워크플로우 노드는 일반 Markdown 으로 쓰면 되고 채널별 특이점은 어댑터가 흡수한다.

### R5 그룹 대화는 v1 에서 무조건 막는다

여러 사용자 대화는 v2 옵션이고 v1 에서 그룹을 허용하면 대화 매핑이 깨진다. 설정으로 그룹을 허용해도 스레드 자료구조가 사용자 한 명을 가정해 동작하지 않는다. 그룹을 한 사용자처럼 흉내 내면 아무나 먼저 보낸 메시지로 대화가 진행돼 사용자가 헷갈린다. CCH-CV-05 의 v1 정책과 맞고 그룹 지원은 v2 여러 사용자 대화와 함께 간다.
