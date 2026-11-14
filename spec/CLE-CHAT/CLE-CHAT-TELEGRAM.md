---
id: "CLE-CHAT-TELEGRAM"
title: "Telegram 어댑터"
type: "feature"
version: 7
status: "approved"
requirements: ["REQ-TGRAM-001", "REQ-TGRAM-002", "REQ-TGRAM-003", "REQ-TGRAM-004", "REQ-TGRAM-005", "REQ-TGRAM-006", "REQ-TGRAM-007", "REQ-TGRAM-008", "REQ-TGRAM-009", "REQ-TGRAM-010", "REQ-TGRAM-011", "REQ-TGRAM-012", "REQ-TGRAM-013", "REQ-TGRAM-014", "REQ-TGRAM-015", "REQ-TGRAM-016", "REQ-TGRAM-017", "REQ-TGRAM-018", "REQ-TGRAM-019", "REQ-TGRAM-020", "REQ-TGRAM-021", "REQ-TGRAM-022", "REQ-TGRAM-023", "REQ-TGRAM-024", "REQ-TGRAM-025", "REQ-TGRAM-026", "REQ-TGRAM-027", "REQ-TGRAM-028", "REQ-TGRAM-029", "REQ-TGRAM-030", "REQ-TGRAM-031", "REQ-TGRAM-032", "REQ-TGRAM-033"]
basis_superseded: false
parent: "CLE-CHAT"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT"]
area: "CLE-CHAT"
content_hash: "424106ac3f071d134e6e295b0cda277b7ef3d0ec3110745fc467979e1f3d62d6"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "bf9c4bad38495700bd31eb2eaee4b1cdae467b5984dd843a076b022ca0c0c076"
etag: "sha256-abb059b91eb9ef1fbb22779b5ac2cc32be038d685cbc10d6eaeed180d870cfb9"
---
> 구현 상태: 부분 구현 · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

`provider: "telegram"` 채널 어댑터는 [Telegram Bot API](https://core.telegram.org/bots/api) 위에서 동작한다. 사용자가 BotFather 에서 봇을 만들고 봇 토큰을 등록하면, 어댑터가 `setWebhook` 으로 Telegram 에서 우리 웹훅 트리거로 오는 연결을 자동 등록한다. 그리고 [채팅 채널 「노드와 채널 UI 매핑」](CLE-CHAT-CORE.md#노드와-채널-ui-매핑) 의 요구사항(REQ-CHAT-018~030)이 다루는 노드, 곧 멀티턴 AI, 버튼이 있는 Presentation 노드, Form, 시각형 노드(Carousel·Chart·Table), Template 을 Telegram UI 로 바꾼다.

이 문서는 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 인터페이스의 Telegram 구현을 정한다. 공통 규칙(렌더 매핑, 실행 실패 분류, Form 입력 흐름, 다단계 질문 본문 형식)은 어댑터 규약을, 인바운드 HTTP 응답·명령 공통 의미·재시도 정책은 [채팅 채널](CLE-CHAT-CORE.md) 을, 설정 필드와 안내 문구는 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 을 따른다. 노드별 Telegram UI 와 시각형 매트릭스는 하위 문서 [Telegram 어댑터 — 노드 UI 매핑](CLE-CHAT-TELEGRAM-UI.md) 이 정한다.

## 사용 시나리오

| 시나리오 | 설명 |
|---|---|
| 텔레그램 봇 챗봇 | 사용자가 봇에게 메시지를 보내면 멀티턴 AI 노드로 들어가 자연스럽게 대화한다 |
| 텔레그램 봇 결재 | 사용자 명령 → Form 다단계 질문 → 결재 결과 통보 |
| 텔레그램 봇 데이터 안내 | 사용자 명령 → Chart 렌더 → 1차 범위는 monospace 텍스트 차트와 선택 버튼, 후속 범위는 `sendPhoto` 이미지 |

## 요구사항

- REQ-TGRAM-001 WHEN `setupChannel` 이 불리면 THE SYSTEM SHALL `setWebhook`(`url`, `secret_token`, `allowed_updates: ["message", "callback_query"]`, `drop_pending_updates: true`)으로 웹훅을 등록하고 `getMe` 결과를 `config.chatChannel.botIdentity` 에 캐시한다.
- REQ-TGRAM-002 WHEN `setupChannel` 이 불리면 THE SYSTEM SHALL 32자 `secret_token` 을 새로 만들어 `SetupResult.issuedInboundSigning` 으로 한 번만 돌려준다.
- REQ-TGRAM-003 WHEN `teardownChannel` 이 불리면 THE SYSTEM SHALL `deleteWebhook`(`drop_pending_updates: true`)을 부르고 실패해도 트리거 삭제를 막지 않는다.
- REQ-TGRAM-004 WHEN Telegram update 가 오면 THE SYSTEM SHALL [명령 매핑](#명령-매핑) 표에 따라 `ChannelUpdate` 로 바꾸고 `update.update_id` 를 중복 제거 키로 쓴다.
- REQ-TGRAM-005 IF `message.chat.type` 이 `group`·`supergroup`·`channel` 이면 THE SYSTEM SHALL `parseUpdate` 가 `null` 을 돌려주고 호출자가 `languageHints.groupChatRefusal` 안내를 보낸 뒤 update 를 버린다.
- REQ-TGRAM-006 IF `message.from.is_bot === true` 이면 THE SYSTEM SHALL 안내 없이 update 를 버린다.
- REQ-TGRAM-007 IF `sticker`·`voice` 처럼 지원하지 않는 update 가 오면 THE SYSTEM SHALL `parseUpdate` 가 `null` 을 돌려주고 호출자가 `unsupportedMessageKind` 안내를 보낸다.
- REQ-TGRAM-008 WHEN `execution.ai_message` 를 보내면 THE SYSTEM SHALL MarkdownV2 escape 한 `sendMessage` 로 보내고 4096자를 넘으면 단어·문장 경계로 나눠 마지막 조각 전까지 `\n_(continued…)_` 를 붙인다.
- REQ-TGRAM-009 WHEN 본문이 있는 `execution.ai_message` 를 보내면 THE SYSTEM SHALL 텍스트 앞에 `sendChatAction(typing)` 을 한 번 보내고 본문이 비어 있으면 둘 다 보내지 않는다.
- REQ-TGRAM-010 WHEN 버튼 대기를 보내면 THE SYSTEM SHALL `buttonConfig.buttons[]` 를 `uiMapping.buttonLayout` 에 따라 `inline_keyboard` 로 만들고 `callback_data` 에 `buttonId` 를 그대로 넣는다.
- REQ-TGRAM-011 WHEN 활성 트리거로 `callback_query` 가 오면 THE SYSTEM SHALL 클릭을 처리했든 버렸든 `answerCallbackQuery` 를 부르고 처리한 클릭이면 원본 메시지의 키보드를 `editMessageReplyMarkup` 으로 지우며 버린 클릭이면 키보드를 남긴다.
- REQ-TGRAM-012 IF 키보드 제거(`editMessageReplyMarkup`)가 실패하면 THE SYSTEM SHALL 로그만 남기고 ack 흐름을 막지 않는다.
- REQ-TGRAM-013 WHEN Form 입력 대기가 오면 THE SYSTEM SHALL 늘 다단계 질문으로 받고 필드 `type` 별 키보드 힌트를 붙인다.
- REQ-TGRAM-014 WHEN `text` 필드에 `validation.preset: 'phone'` 이 있으면 THE SYSTEM SHALL `request_contact: true` 버튼을 보내고 받은 번호를 폼 데이터에 채운다. (미구현)
- REQ-TGRAM-015 WHEN 시각형 노드나 Template 을 보내면 THE SYSTEM SHALL [시각형 매트릭스](#시각형-매트릭스) 의 1차 범위 표현인 MarkdownV2 텍스트·monospace 로 보낸다.
- REQ-TGRAM-016 IF 1차 범위에서 `visualNode` 가 `photo` 이면 THE SYSTEM SHALL 텍스트로 대신 보내고 warning 로그를 남기며 채널 건강도는 바꾸지 않는다.
- REQ-TGRAM-017 WHEN 시각형 노드에 `buttonConfig.buttons[]` 가 있으면 THE SYSTEM SHALL 시각 메시지를 모두 보낸 다음 메시지로 `inline_keyboard` 를 보낸다.
- REQ-TGRAM-018 WHEN `visualNode` 가 `auto` 이고 Carousel 카드에 이미지 URL 이 있으면 THE SYSTEM SHALL 그 카드를 `sendPhoto`(caption 은 제목과 설명)로 보낸다. (미구현)
- REQ-TGRAM-019 WHEN `image` 메시지를 보내면 THE SYSTEM SHALL `sendPhoto`(chat_id, photo, caption)로 보낸다. (미구현)
- REQ-TGRAM-020 WHEN `execution.failed` 를 받으면 THE SYSTEM SHALL 분류 결과 문구를 MarkdownV2 escape 한 `sendMessage` 1회로 보내고 `reply_markup`·`reply_to_message_id` 는 붙이지 않는다.
- REQ-TGRAM-021 WHEN `execution.cancelled` 의 `error.code` 가 `RESUME_` 로 시작하면 THE SYSTEM SHALL 일반 취소 안내 대신 `languageHints.sessionExpired` 를 보낸다.
- REQ-TGRAM-022 WHEN 재개 명령이 `STATE_MISMATCH` 로 거부되면 THE SYSTEM SHALL `escapeControlText` 로 escape 한 `languageHints.surfaceMismatch` 를 보내고 발송 실패는 흡수한다.
- REQ-TGRAM-023 IF `X-Telegram-Bot-Api-Secret-Token` 헤더가 없거나 저장한 값과 다르면 THE SYSTEM SHALL `401` 로 답하고 워크플로우를 시작하지 않는다.
- REQ-TGRAM-024 WHEN 활성 실행이 없는 대화에 `/start` 가 오면 THE SYSTEM SHALL 새 실행을 시작하고 `languageHints.executionStarted` 안내를 보낸다. (부분 구현)
- REQ-TGRAM-025 WHEN 활성 실행이 있는 대화에 `/start` 가 오면 THE SYSTEM SHALL 기존 실행을 실행 중지 경로(`ExecutionsService.stop`)로 취소하고 새 실행을 시작하며 "기존 대화를 종료하고 새로 시작합니다." 를 안내한다. (부분 구현)
- REQ-TGRAM-026 WHEN `/cancel` 이 오면 THE SYSTEM SHALL 활성 실행을 실행 중지 경로(`ExecutionsService.stop`)로 취소하고 활성 실행이 없으면 "진행 중인 대화가 없습니다." 를 안내한다. (부분 구현)
- REQ-TGRAM-027 WHEN `/help` 가 오면 THE SYSTEM SHALL 대화 조회 전에 `languageHints.help`(없으면 기본 문구)를 보내고 워크플로우는 시작하지 않는다.
- REQ-TGRAM-028 IF `/start`·`/cancel`·`/help` 가 아닌 `/` 명령이 오면 THE SYSTEM SHALL 무시한다.
- REQ-TGRAM-029 WHEN `sendMessage` 를 부르면 THE SYSTEM SHALL 5초 타임아웃과 지수 백오프로 총 3회까지 시도하고 끝내 실패하면 `chat_channel_health` 를 `degraded` 로 바꾼다.
- REQ-TGRAM-030 WHILE Telegram rate limit(사용자 전체 초당 30건, 대화당 초당 1건) 안에서 보내는 동안 THE SYSTEM SHALL 대화 단위 큐와 지연으로 발송 속도를 맞춘다. (미구현)
- REQ-TGRAM-031 WHEN 같은 `update_id` 가 30초 안에 다시 오면 THE SYSTEM SHALL 두 번째 update 를 무시한다.
- REQ-TGRAM-032 IF 버린 클릭의 `answerCallbackQuery` 가 실패하면 THE SYSTEM SHALL 경고 로그만 남기고 웹훅 HTTP 응답(`202 + { executionId: 'ignored' }`)을 바꾸지 않는다.
- REQ-TGRAM-033 IF 비활성 트리거로 `callback_query` 가 오면 THE SYSTEM SHALL `answerCallbackQuery` 를 포함한 Telegram API 호출을 하지 않고 `202 + { executionId: 'ignored' }` 로 답한다.

요구사항 보충 설명은 다음과 같다.

- 관련 REQ-TGRAM-011·012: 처리한 클릭의 순서는 EIA `click_button` 요청 큐 등록, `answerCallbackQuery`, 키보드 제거, 웹훅 HTTP 응답(`202`)이다. EIA 요청은 큐에 넣기만 하고 처리를 기다리지 않는다. 수신 확인과 키보드 제거는 `ackInteraction` 이 한다. 활성 실행이 없는 대화로 온 클릭은 새 실행을 시작하는 update 로 처리되고 그 뒤 같은 수신 확인과 키보드 제거를 한다(현재 구현).
- 관련 REQ-TGRAM-011·032·033: 버린 클릭의 수신 확인은 `HooksService` 의 `dropChatChannelUpdate` 가 채널 어댑터의 `ackDroppedUpdate` 를 불러 보낸다. 클릭을 버리는 경로는 여섯 가지다. 파서가 버린 `callback_query`, 30초 안에 다시 온 같은 update, 대화 단위 분당 한도 초과, 실행이 `running`·`pending` 이라 입력 대기가 아닌 경우(`executionStillRunning` 안내 뒤), 활성 실행이 없는 대화인데 워크플로우가 비활성인 경우, 트리거의 워크플로우가 그 워크스페이스에 없는 경우다. Telegram 어댑터는 본문의 `callback_query.id` 가 비어 있지 않은 문자열일 때만 `answerCallbackQuery` 를 부르고 `editMessageReplyMarkup` 은 부르지 않는다. 클릭이 아닌 update 에는 아무것도 하지 않는다. `HooksService` 는 이 수신 확인을 보내기만 하고 끝나기를 기다리지 않아 웹훅 HTTP 응답이 늦어지지 않는다. 호출이 실패하면 `HooksService` 가 경고 로그만 남기고 응답은 그대로 `202 + { executionId: 'ignored' }` 다. 트리거가 비활성이면 서명 검증 뒤 외부 호출 없이 끝나므로 수신 확인도 보내지 않는다.
- 관련 REQ-TGRAM-013·014: 전화번호 preset 은 [Form 노드](../CLE-NODE-PRES/CLE-NODE-FORM.md) 에 아직 없다(스키마, 서버 정규식, 어댑터 힌트 모두 없음). Form 의 `type` enum 자체는 바꾸지 않는다.
- 관련 REQ-TGRAM-018·019: 현재 구현(`telegram.adapter.ts` 의 `image` 분기, `renderCarouselFallback`)은 이미지 메시지를 caption·`fallbackText` 텍스트로 보내고 Carousel 카드도 모두 텍스트로 보낸다. multipart 업로드와 SSR PNG 인프라가 없다.
- 관련 REQ-TGRAM-024·025: 활성 실행 중 `/start` 의 명령 우선 규칙, 취소 실패 처리, 대화 상태 정리는 [채팅 채널](CLE-CHAT-CORE.md) 의 REQ-CHAT-062~065 가 정한다. 트리거의 워크플로우가 비활성이면 두 경우 모두 새 실행을 시작하지 않고 기존 실행도 취소하지 않는다(REQ-CHAT-066). 처리 세부와 구현 상태는 [명령 처리](#명령-처리) 표에 있다.
- 관련 REQ-TGRAM-026: EIA `cancel` 도 같은 `ExecutionsService.stop` 을 부르므로 취소 동작은 같다([채팅 채널 「R-CC-27 활성 실행 중 /start 는 기존 실행을 취소하고 새로 시작한다」](CLE-CHAT-CORE.md#r-cc-27-활성-실행-중-start-는-기존-실행을-취소하고-새로-시작한다)). 취소한 뒤의 대화 상태 정리는 REQ-CHAT-065 를 따른다. 활성 실행이 없을 때의 안내는 아직 보내지 않고 ack 만 한다(현재 구현, `hooks.service.ts`).
- 관련 REQ-TGRAM-029·030·031: [비기능](#비기능) 절을 본다.

## 하위 문서

- [Telegram 어댑터 — 노드 UI 매핑](CLE-CHAT-TELEGRAM-UI.md): 멀티턴 AI, 버튼 키보드와 클릭 수신 확인, Form 키보드 힌트, 시각형 매트릭스, 실행 실패 · 재개 실패 취소 · 표면 불일치 안내, 관련 미결 사항. 이 하위 문서는 REQ-TGRAM-008~022 · REQ-TGRAM-032 의 세부 규칙을 정한다. 요구사항 줄 자체는 이 문서의 [요구사항](#요구사항) 에 있다.

## 시각형 매트릭스

→ [Telegram 어댑터 — 노드 UI 매핑](CLE-CHAT-TELEGRAM-UI.md#시각형-매트릭스)

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
| `ackInteraction`(button_callback) | `POST /bot{token}/answerCallbackQuery`(callback_query_id)를 부르고 이어서 `POST /bot{token}/editMessageReplyMarkup`(빈 `inline_keyboard`)으로 키보드를 지운다. 인바운드 명령 처리(EIA 요청 큐 등록) 뒤에 불린다 |
| `defaultInteractionResponse` | 구현하지 않는다. 기본 인터랙션 응답이 없어 인바운드 HTTP 응답은 `202` 그대로다. 버튼 클릭의 수신 확인은 `answerCallbackQuery` 가 맡는다 |
| `ackDroppedUpdate`(버린 `callback_query`) | `POST /bot{token}/answerCallbackQuery`(callback_query_id)만 부른다. 키보드는 남긴다. `callback_query` 가 아닌 update 에는 아무것도 부르지 않는다 |

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

`secret_token` 평문은 호출자(`ChatChannelBinderService`)가 `SecretResolver.rotate(secret://triggers/{id}/inbound-signing, ...)` 로 저장하고 참조만 `config.chatChannel.inboundSigningRef` 에 넣는다. `setupChannel` 을 다시 부를 때마다 새 값이 등록 · 저장되는 것이 정상 동작이며 `chatChannel` 이 실린 PATCH 도 이 값을 바꾼다([채팅 채널](CLE-CHAT-CORE.md) 의 인바운드 서명 자료 변경, [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 의 setupChannel 멱등의 뜻).

### teardownChannel

```text
POST https://api.telegram.org/bot{token}/deleteWebhook
{ "drop_pending_updates": true }
```

부분 실패해도 트리거 삭제를 막지 않는다. 남은 웹훅은 삭제된 트리거의 주소를 가리키므로 그 update 는 `404` 로 끝난다([채팅 채널 「R-CC-12 인바운드 응답은 202 로 고정하고 401·404 만 예외로 둔다」](CLE-CHAT-CORE.md#r-cc-12-인바운드-응답은-202-로-고정하고-401404-만-예외로-둔다)). 같은 봇으로 새 트리거를 만들면 setup 이 웹훅을 새 주소로 덮어쓴다.

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

## 보안

- 봇 토큰은 `botTokenRef`(시크릿 참조)만 설정에 둔다. 평문 저장은 금지다([채팅 채널](CLE-CHAT-CORE.md) REQ-CHAT-035).
- 봇 토큰과 인바운드 서명 자료를 시크릿 저장소 참조로만 다루고 평문을 설정 JSON · 로그 · metric 에 내놓지 않는 규칙, 프로바이더 API 클라이언트가 실패 문장을 돌려주거나 로그에 남기기 전에 봇 토큰을 지우는 규칙은 [채팅 채널 어댑터 규약 「규칙」](CLE-CHAT-ADAPTER.md#규칙) 10 이 정한다.
- `setWebhook` 의 `secret_token` 은 등록 때 무작위로 만든다(`crypto.randomBytes(24).toString('base64url')`, 32자). 평문은 `SetupResult.issuedInboundSigning` 에 한 번만 드러나고 호출자가 시크릿 저장소에 저장한 뒤 참조만 `inboundSigningRef` 에 둔다. Telegram 은 모든 update 에 `X-Telegram-Bot-Api-Secret-Token` 헤더를 붙인다. 진입점이 `SecretResolver.resolve(inboundSigningRef)` 로 값을 꺼내 헤더와 같은지 확인한다. 다르면 `401` 이고 어댑터는 `null` 을 돌려준다(워크플로우를 시작하지 않는다).
- 그룹·채널 update 는 진입점에서 `chat.type` 으로 막고 `groupChatRefusal` 안내 뒤 버린다([채팅 채널](CLE-CHAT-CORE.md) REQ-CHAT-017).
- 다른 봇이 보낸 메시지(`from.is_bot === true`)도 무시한다.
- 인바운드 HTTP 응답 정책(인증, 비활성 트리거, 그룹 대화, 미지원 update, 내부 에러)은 [채팅 채널](CLE-CHAT-CORE.md) 의 인바운드 HTTP 응답 계약이 기준이고 여기 사본을 두지 않는다. 기본은 `202 Accepted` 다. 인증 실패 `401` 과 엔드포인트 미존재 `404` 를 포함한 예외 응답 코드 목록은 [채팅 채널 「R-CC-12 인바운드 응답은 202 로 고정하고 401·404 만 예외로 둔다」](CLE-CHAT-CORE.md#r-cc-12-인바운드-응답은-202-로-고정하고-401404-만-예외로-둔다) 에 있다. 비활성 트리거도 `202 + { executionId: 'ignored' }` 다. 버린 버튼 클릭에 `answerCallbackQuery` 를 보내도 웹훅 HTTP 응답은 `202` 그대로다(REQ-TGRAM-011·032). 트리거의 워크플로우가 비활성이면 새 실행을 시작할 update(활성 실행이 없는 대화의 메시지, `/start`)만 `202 + { executionId: 'ignored' }` 로 버리고 진행 중인 대화의 입력과 `/cancel`·`/help` 는 그대로 처리한다(REQ-CHAT-066·068). 활성 실행 중 `/start` 의 기존 실행 취소가 실패하면 그 에러로 응답한다(REQ-CHAT-064).

## 명령 처리

| 사용자 입력 | 어댑터 처리 |
|---|---|
| `/start`(활성 실행 없음) | 새 실행 시작, `languageHints.executionStarted` 안내. 안내는 아직 보내지 않는다(NERV Task `CLE-T-0400J6`) |
| `/start`(활성 실행 있음) | 기존 실행을 실행 중지 경로(`ExecutionsService.stop`)로 취소하고 새 실행 시작, "기존 대화를 종료하고 새로 시작합니다." 안내. 기존 실행이 이미 끝났거나 지워졌으면 취소 없이 시작한다. 워크플로우가 비활성이면 버리고 기존 실행을 취소하지 않는다. 기준은 [채팅 채널](CLE-CHAT-CORE.md) REQ-CHAT-062~064·066 이다. 안내는 아직 보내지 않는다(NERV Task `CLE-T-0400J6`) |
| `/cancel` | 활성 실행을 실행 중지 경로(`ExecutionsService.stop`, EIA `cancel` 과 같은 경로)로 취소. 없으면 아무것도 하지 않고 "진행 중인 대화가 없습니다." 안내. 이 안내는 아직 보내지 않는다 |
| `/help` | 1차 범위의 정적 도움말(`languageHints.help` 나 기본 문구). `parseTelegramUpdate` 의 `readCommand` 가 `/help` 를 `text_message` 로 통과시키고(`/start`·`/cancel` 밖의 다른 `/` 명령은 `null`), `HooksService` 가 대화 조회 전에 `/help` 인지 검사해 안내한다. 워크플로우는 시작하지 않는다 |
| 그 밖의 명령(`/...`) | 무시. 1차 범위는 `/start`·`/cancel`·`/help` 만 처리한다 |

## 비기능

- `sendMessage` 는 5초 타임아웃과 지수 백오프로 총 3회 시도한다. 대기는 1초, 2초 두 번이고 세 번째 실패 뒤에는 기다리지 않는다(`telegram-client.ts` `call`, 구현됨). 끝내 실패하면 `chat_channel_health` 를 `degraded` 로 바꾼다. 정책의 기준은 [채팅 채널](CLE-CHAT-CORE.md) 이다.
- Telegram rate limit(사용자 전체 초당 30건, 대화당 초당 1건)에 맞춘 대화 단위 큐와 지연은 미구현이다. 현재 `telegram-client.ts` 는 실패 때 지수 백오프만 한다.
- `update_id` 중복 제거는 구현됐다(2026-08-13). 파서가 채운 `idempotencyKey = String(update_id)` 를 `ChatChannelDedupService` 가 쓴다(Redis `SET NX EX 30`, 키 `cc:dedup:<triggerId>:<updateId>`, 인바운드 진입에서 분당 한도 앞). Redis 가 없으면 통과시킨다. 키·TTL·게이트 순서는 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 이 정한다.

## 구현 위치

- `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts`(렌더러 · 클릭 수신 확인은 [하위 문서](CLE-CHAT-TELEGRAM-UI.md#구현-위치))
- `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-update.parser.ts`
- `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts`
- `codebase/backend/src/modules/chat-channel/types.ts`: 채널 어댑터의 버린 update 수신 확인 함수(`ackDroppedUpdate`)
- `codebase/backend/src/modules/hooks/hooks.service.ts`: 명령 처리(`/help`, `/cancel`, 활성 실행 중 `/start` 의 기존 실행 취소), 버린 update 처리(`dropChatChannelUpdate`)
- `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.spec.ts`, `codebase/backend/src/modules/hooks/hooks.service.spec.ts`(「버린 update 의 수신 확인」): 버린 클릭의 수신 확인, 비활성 트리거에서 부르지 않음
- `codebase/backend/test/chat-channel-telegram-start.e2e-spec.ts`: 활성 실행 중 `/start` 의 취소와 새 시작
- `codebase/backend/test/chat-channel-telegram-dropped-callback.e2e-spec.ts`: 워크플로우 비활성 · 재도착으로 버린 클릭의 `202` 응답
- 사용자 가이드: `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx`, `telegram.en.mdx`

## Rationale

### R1 setWebhook 의 secret_token 검증을 1차 인증으로 쓴다

`setWebhook` 의 `secret_token` 과 `X-Telegram-Bot-Api-Secret-Token` 검증을 택했다. Telegram 이 공식 지원하는 웹훅 인증이라 인프라를 더할 필요가 없다. 웹훅 URL 의 UUID 에만 기대면 URL 이 새어 나갔을 때 누구나 부를 수 있고, Telegram 은 HMAC 서명을 지원하지 않아 변환 계층이 더 필요하다.

### R5 그룹 대화는 1차 범위에서 무조건 막는다

여러 사용자 대화는 후속 범위의 옵션이고 1차 범위에서 그룹을 허용하면 대화 매핑이 깨진다. 설정으로 그룹을 허용해도 스레드 자료구조가 사용자 한 명을 가정해 동작하지 않는다. 그룹을 한 사용자처럼 흉내 내면 아무나 먼저 보낸 메시지로 대화가 진행돼 사용자가 헷갈린다. [채팅 채널](CLE-CHAT-CORE.md) REQ-CHAT-017 의 1차 범위 정책과 맞고 그룹 지원은 후속 범위의 여러 사용자 대화와 함께 간다.

### R6 활성 실행 중 /start 의 규칙은 채팅 채널 문서가 정한다

2026-10-10 에 명령 우선 규칙을 [채팅 채널 「R-CC-27 활성 실행 중 /start 는 기존 실행을 취소하고 새로 시작한다」](CLE-CHAT-CORE.md#r-cc-27-활성-실행-중-start-는-기존-실행을-취소하고-새로-시작한다) 로 정했다. 세 프로바이더에 같은 규칙이라 시스템 문서에 두고 이 문서는 명령 이름과 안내 문구만 정한다. 이 결정으로 이 문서의 미결 «활성 실행 중 `/start`» 를 닫았다.

### R8 요구사항 줄의 옛 문서 절 표기를 지우고 머리 줄을 고쳤다

요구사항 줄 끝의 `(원본: telegram §n)` 표기와 머리 줄의 «원문» 경로는 지워진 옛 저장소 문서를 가리켜 찾아갈 수 없었다. 문서는 NERV 링크로 가리킨다는 [용어 사전](../CLE-GLOSSARY.md) 원칙 11 에 따라 지웠고 요구사항의 뜻은 바꾸지 않았다. 머리 줄의 구현 상태는 `부분 구현` 으로 고쳤다. REQ-TGRAM-014·018·019·030 이 미구현이고 024~026 이 부분 구현이라 [스펙과 구현 근거 규약](../CLE-ENG/CLE-ENG-SPECEVIDENCE.md) 의 구현 상태 세 값(구현됨·부분 구현·미구현) 가운데 `구현됨` 이 맞지 않는다.
