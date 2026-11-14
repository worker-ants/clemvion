---
id: "CLE-CHAT-DISCORD"
title: "Discord 어댑터"
type: "feature"
version: 8
status: "approved"
requirements: ["REQ-DISCORD-001", "REQ-DISCORD-002", "REQ-DISCORD-003", "REQ-DISCORD-004", "REQ-DISCORD-005", "REQ-DISCORD-006", "REQ-DISCORD-007", "REQ-DISCORD-008", "REQ-DISCORD-009", "REQ-DISCORD-010", "REQ-DISCORD-011", "REQ-DISCORD-012", "REQ-DISCORD-013", "REQ-DISCORD-014", "REQ-DISCORD-015", "REQ-DISCORD-016", "REQ-DISCORD-017", "REQ-DISCORD-018", "REQ-DISCORD-019", "REQ-DISCORD-020", "REQ-DISCORD-021", "REQ-DISCORD-022", "REQ-DISCORD-023", "REQ-DISCORD-024", "REQ-DISCORD-025", "REQ-DISCORD-026", "REQ-DISCORD-027", "REQ-DISCORD-028", "REQ-DISCORD-029", "REQ-DISCORD-030", "REQ-DISCORD-031", "REQ-DISCORD-032", "REQ-DISCORD-033", "REQ-DISCORD-034", "REQ-DISCORD-035", "REQ-DISCORD-036", "REQ-DISCORD-037"]
basis_superseded: false
parent: "CLE-CHAT"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT"]
area: "CLE-CHAT"
content_hash: "5a72836efecf69fd6ac9aa2dbabfb53071376859c9bfeb400533d1e10c3b76e6"
read_as: "approved_fallback"
task: "CLE-T-9Z0V2R"
source_paths: ["spec/4-nodes/7-trigger/providers/discord.md"]
mirror_sha256: "b7651ede6c8158e8a519a2e0179fcd5f6e46878b4cee29d72001bae9150ca85e"
etag: "sha256-93552f8e68792c4941925a4a7a4c18b62967ae8348d9125fd6fe851df0066cb0"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/7-trigger/providers/discord.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

`provider: "discord"` 채널 어댑터는 [Discord REST API](https://discord.com/developers/docs/reference) 와 [Interactions Webhook](https://discord.com/developers/docs/interactions/receiving-and-responding) 위에서 동작한다. 사용자가 Discord Developer Portal 에서 Application 과 Bot 을 만들고 봇 토큰과 application public key 를 등록하면, 어댑터가 slash command 를 일괄 덮어쓰기로 등록한다. 그리고 [채팅 채널](CLE-CHAT-CORE.md) 의 UI 매핑 요구사항(CCH-MP-01~06)이 다루는 노드를 Discord UI(Message Components, Embeds, Modal)로 바꾼다.

v1 은 Interactions Webhook 만 쓴다. Discord [Gateway WebSocket](https://discord.com/developers/docs/topics/gateway) 은 봇마다 오래 유지되는 연결과 heartbeat 관리가 필요해 v2 옵션이다(R-D-3). 그래서 v1 사용자는 자유 텍스트 대신 slash command, 버튼, 모달로 워크플로우와 주고받는다. 멀티턴 AI 의 사용자 답장도 모달·명령 입력으로 받는다.

이 문서는 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 인터페이스의 Discord 구현을 정한다. 공통 규칙(렌더 매핑, 실행 실패 분류, Form 입력 흐름, 다단계 질문 본문 형식, 시각형 렌더 입력)은 어댑터 규약을, 인바운드 HTTP 응답·명령 공통 의미·재시도 정책은 [채팅 채널](CLE-CHAT-CORE.md) 을, 설정 필드와 안내 문구는 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 을 따른다. 세부 동작은 [하위 문서](#하위-문서) 두 편이 정한다.

## 사용 시나리오

| 시나리오 | 설명 |
|---|---|
| Discord 봇 명령 워크플로우 | 사용자가 `/workflow start` → AI 응답 → "Reply" 버튼 모달이나 `/workflow reply` 로 답장 |
| Discord 봇 결재 | 사용자 slash command → Form 모달 → 결재 결과 통보 |
| Discord 봇 데이터 안내 | 사용자 slash command → Chart 렌더 → v1 은 monospace 텍스트 차트와 선택 버튼, v2 는 이미지 첨부 |

## 요구사항

- REQ-DISCORD-001 WHEN `setupChannel` 이 불리면 THE SYSTEM SHALL `GET /applications/@me` 로 `botIdentity`(`botId: hashStringToInt(id)`, `username: name`, `publicKey: verify_key`)를 캐시한다. (원본: discord §3.1)
- REQ-DISCORD-002 IF 응답의 `verify_key` 와 사용자가 입력한 public key 가 둘 다 있고 서로 다르면 THE SYSTEM SHALL `BOT_TOKEN_INVALID` 로 던져 setup 을 막는다. (원본: discord §3.1)
- REQ-DISCORD-003 WHEN `setupChannel` 이 불리면 THE SYSTEM SHALL `PUT /applications/{app_id}/commands` 로 `/<prefix>` slash command(하위 `start`·`cancel`·`help`·`reply`)를 일괄 덮어써 등록하고 등록이 실패하면 에러를 던져 setup 을 막는다(HTTP 401·403 이면 `code: 'BOT_TOKEN_INVALID'`, 그 밖은 `code` 없는 에러). (원본: discord §3.1, R-D-2)
- REQ-DISCORD-004 WHEN `teardownChannel` 이 불리면 THE SYSTEM SHALL `PUT /applications/{app_id}/commands` 에 `[]` 를 보내 명령을 지우고 실패해도 트리거 삭제를 막지 않는다. (원본: discord §3.2)
- REQ-DISCORD-005 WHEN `type: 1`(PING)이 오면 THE SYSTEM SHALL 어댑터의 `handshakeResponse` 가 정한 `{ type: 1 }` 을 호출자가 `200 OK` 로 보내고 `parseUpdate` 는 `null` 을 돌려준다. (원본: discord §3.1, R-D-8)
- REQ-DISCORD-006 WHEN Interactions payload 가 오면 THE SYSTEM SHALL [명령 매핑](#명령-매핑) 표에 따라 `ChannelUpdate` 로 바꾸고 `interaction.id` 를 중복 제거 키로 쓴다. (원본: discord §4)
- REQ-DISCORD-007 IF `channel.type !== 1`(DM 이 아님)이면 THE SYSTEM SHALL `null` 을 돌려주고 호출자가 `groupChatRefusal` 안내를 보낸다. (원본: discord §4, §6)
- REQ-DISCORD-008 IF `member.user.bot === true` 이거나 DM 의 `user.bot === true` 이면 THE SYSTEM SHALL `null` 을 돌려준다. (원본: discord §4, §6)
- REQ-DISCORD-009 WHEN 서명 검증을 통과한 슬래시 명령(APPLICATION_COMMAND)·컴포넌트(MESSAGE_COMPONENT)·모달 제출(MODAL_SUBMIT)이 오면 THE SYSTEM SHALL 3초 안에 `200 OK` 와 `{ type: 4, data }`·`{ type: 6 }`·`{ type: 9, data }` 가운데 [인바운드 응답](#인바운드-응답) 이 정한 응답을 `{ data }` 봉투 없이 돌려준다. (원본: discord §3, §4)
- REQ-DISCORD-010 WHEN `execution.ai_message` 를 보내면 THE SYSTEM SHALL `POST /channels/{id}/messages` 의 `content` 로 escape 없이 보내고 2000자를 넘으면 단어·문장 경계로 나눠 마지막 조각 전까지 `\n_(continued…)_` 를 붙인다. (원본: discord §5.1)
- REQ-DISCORD-011 WHEN AI 응답을 보내면 THE SYSTEM SHALL 마지막 텍스트 조각에 "Reply" 버튼(`__reply__`)을 붙인다. (원본: discord §5.1)
- REQ-DISCORD-012 WHEN "Reply" 버튼이 눌리면 THE SYSTEM SHALL `custom_id` 가 `clemvion_reply` 인 단일 TEXT_INPUT 모달을 열고 제출 값을 `text_message` 로 바꿔 EIA `submit_message` 로 보낸다. (원본: discord §5.1)
- REQ-DISCORD-013 WHEN `/<prefix> reply <message>` 가 오면 THE SYSTEM SHALL `{ kind: "text_message", text: <message> }` 로 바꾼다. (원본: discord §5.1)
- REQ-DISCORD-014 WHEN LLM 응답 직전이면 THE SYSTEM SHALL `POST /channels/{id}/typing` 을 한 번 보내고 응답이 10초를 넘으면 5초마다 다시 보낸다. (원본: discord §5.1, §5.5)
- REQ-DISCORD-015 WHEN 버튼 대기를 보내면 THE SYSTEM SHALL ACTION_ROW 와 BUTTON 요소로 만들고 `custom_id` 에 `buttonId` 를 넣으며 `buttonLayout` 에 따라 행을 나눈다. (원본: discord §5.2)
- REQ-DISCORD-016 WHEN 버튼 MESSAGE_COMPONENT 가 오면 THE SYSTEM SHALL EIA `click_button` 요청을 큐에 넣고 그 처리를 기다리지 않은 채 3초 안에 `200 OK` 와 `{ type: 6 }` 으로 답한다. (원본: discord §5.2)
- REQ-DISCORD-017 WHEN `formMode` 가 `auto`·`native_modal` 이고 필드가 5개 이하이며 모두 텍스트 계열인 Form 입력 대기가 오면 THE SYSTEM SHALL `form_modal` 버튼을 보내고 클릭 때 `{ type: 9 }` MODAL(TEXT_INPUT)을 웹훅 응답 본문으로 돌려준다. (원본: discord §3.3, §5.3)
- REQ-DISCORD-018 IF 모달 제출이 서버 쪽 검증에서 실패하면 THE SYSTEM SHALL 후속 메시지에 "다시 입력" 버튼(`__open_form__`)을 다시 보내 모달을 다시 열게 한다. (원본: discord §3.3)
- REQ-DISCORD-019 WHEN Form 에 `select`·`radio`·`checkbox`·`file` 필드가 있거나 필드가 6개 이상이거나 `formMode` 가 `multi_step` 이면 THE SYSTEM SHALL 다단계 질문으로 받는다. (원본: discord §5.3)
- REQ-DISCORD-020 WHEN `text` 필드에 `validation.preset: 'phone'` 이 있으면 THE SYSTEM SHALL TEXT_INPUT 과 어댑터 형식 검증으로 받는다. (원본: discord §5.3) (미구현)
- REQ-DISCORD-021 WHEN 시각형 노드나 Template 을 보내면 THE SYSTEM SHALL [시각형 매트릭스](#시각형-매트릭스) 의 v1 markdown 텍스트·monospace 표현으로 보내고 v1 에서 `photo` 면 텍스트로 대신 보내며 warning 로그를 남긴다. (원본: discord §5.4)
- REQ-DISCORD-022 WHEN `visualNode` 가 `auto` 이고 Carousel 카드에 이미지 URL 이 있으면 THE SYSTEM SHALL 그 카드를 `embeds: [{image: {url}}]` 로 보낸다. (원본: discord §5.4) (미구현)
- REQ-DISCORD-023 WHEN `image` 메시지를 보내면 THE SYSTEM SHALL 이미지를 첨부(`attachments` multipart 나 `embeds` image)로 보낸다. (원본: discord §3) (미구현)
- REQ-DISCORD-024 WHEN `execution.failed` 를 받으면 THE SYSTEM SHALL 분류 결과 문구를 평문 `content` 로 `POST /channels/{id}/messages` 한 번 보내고 `embeds`·`components`·`message_reference` 는 붙이지 않는다. (원본: discord §5.6)
- REQ-DISCORD-025 IF `X-Signature-Ed25519` 가 `X-Signature-Timestamp` 와 raw body 에 대해 저장된 public key 로 검증되지 않으면 THE SYSTEM SHALL `401` 로 답한다. (원본: discord §6)
- REQ-DISCORD-026 IF `X-Signature-Timestamp` 가 현재 시각 ±5분 밖이면 THE SYSTEM SHALL `401` 로 답한다. (원본: discord §6)
- REQ-DISCORD-027 IF 트리거 생성 때 `inboundSigningPlaintext` 가 `^[a-f0-9]{64}$` 에 맞지 않으면 THE SYSTEM SHALL `400 VALIDATION_ERROR`(`details.field='inboundSigningPlaintext'`, `details.code='INVALID_FIELD'`)로 거부한다. (원본: discord §6)
- REQ-DISCORD-028 WHEN 활성 실행이 없을 때 `/<prefix> start` 가 오면 THE SYSTEM SHALL 새 실행을 시작하고 `languageHints.executionStarted` 를 즉시 응답이나 후속 메시지로 안내한다. (원본: discord §7) (부분 구현)
- REQ-DISCORD-029 WHEN 활성 실행이 있을 때 `/<prefix> start` 가 오면 THE SYSTEM SHALL 기존 실행을 실행 중지 경로(`ExecutionsService.stop`)로 취소하고 새 실행을 시작하며 "기존 대화를 종료하고 새로 시작합니다." 를 안내한다. (원본: discord §7) (부분 구현)
- REQ-DISCORD-030 WHEN `/<prefix> cancel` 이 오면 THE SYSTEM SHALL 활성 실행을 실행 중지 경로(`ExecutionsService.stop`)로 취소하고 활성 실행이 없으면 "진행 중인 대화가 없습니다." 를 안내한다. (원본: discord §7) (부분 구현)
- REQ-DISCORD-031 WHEN `/<prefix> help` 가 오면 THE SYSTEM SHALL EIA 를 부르지 않고 3초 안에 `200 OK` 와 본인에게만 보이는 `{ type: 4, data: { content, flags: 64 } }` 로 답하며 `content` 는 `languageHints.help`(없으면 `languageHints.slashPrefix` 를 넣은 기본 도움말)로 채운다. (원본: discord §4, §7)
- REQ-DISCORD-032 WHEN `POST /channels/{id}/messages` 를 부르면 THE SYSTEM SHALL 5초 타임아웃과 지수 백오프로 총 3회까지 시도하고 끝내 실패하면 `chat_channel_health` 를 `degraded` 로 바꾼다. (원본: discord §8)
- REQ-DISCORD-033 WHEN Discord 가 `429` 와 `Retry-After` 를 돌려주면 THE SYSTEM SHALL 그만큼 기다린 뒤 다시 시도한다. (원본: discord §8)
- REQ-DISCORD-034 WHILE Discord rate limit 안에서 보내는 동안 THE SYSTEM SHALL bucket 단위 큐와 응답 헤더 기반 throttle 로 발송 속도를 맞춘다. (원본: discord §8) (미구현)
- REQ-DISCORD-035 WHEN 같은 `interaction.id` 가 30초 안에 다시 오면 THE SYSTEM SHALL 두 번째 update 를 무시한다. (원본: discord §8)
- REQ-DISCORD-036 WHEN `help` 밖의 슬래시 명령이 오면 THE SYSTEM SHALL 새 실행·취소·답장 전달·중복·분당 한도 초과·실행 중·워크플로우 비활성·파싱 실패·DM 밖 채널 어느 경로로 끝나도 3초 안에 `200 OK` 와 본인에게만 보이는 `{ type: 4, data: { content, flags: 64 } }` 로 답하며 `content` 는 `languageHints.commandReceived`(없으면 `languageLocale` 기본 문구)로 채운다. (R-D-12)
- REQ-DISCORD-037 WHEN 비활성 트리거로 슬래시 명령·컴포넌트·모달 제출이 오고 서명 검증을 통과하면 THE SYSTEM SHALL 실행을 시작하지 않고 외부 API 를 부르지 않으며 활성일 때와 같은 기본 응답(`200 OK` 와 슬래시 명령 `{ type: 4 }`, 컴포넌트·모달 제출 `{ type: 6 }`)으로 답한다. (R-D-12)

요구사항 보충 설명은 다음과 같다.

- 관련 REQ-DISCORD-002: 인바운드 서명 검증의 기준은 여전히 `inboundSigningRef`(시크릿 저장소)와 생성 때 정규식 검증(REQ-DISCORD-027)이다. setup 때 교차 확인과 `publicKey` 캐시는 그 위의 추가 안전장치이자 identity 편의다.
- 관련 REQ-DISCORD-009·016·036·037: 인터랙션 종류별 응답, 버린 인터랙션의 응답, 비활성 트리거의 응답은 [인바운드 응답](#인바운드-응답) 과 R-D-11·R-D-12 가 정한다. 활성 실행 중 `/<prefix> start` 의 기존 실행 취소가 실패하면 기본 응답 대신 그 에러로 답한다([채팅 채널](CLE-CHAT-CORE.md) REQ-CHAT-064).
- 관련 REQ-DISCORD-011~013: 두 입력 경로는 함께 있다. "Reply" 버튼 모달이 v1 기본 UX 이고 `/<prefix> reply` 는 숙련 사용자용 보조 옵션이다. 자유 DM 텍스트 답장은 v2 Gateway 에서 된다([채팅 채널](CLE-CHAT-CORE.md) R-CC-13 이 이 부분 유예의 기준이다).
- 관련 REQ-DISCORD-020: [Form 노드](../CLE-NODE-PRES/CLE-NODE-FORM.md) 에 `validation.preset` 이 아직 없다. Discord 에는 연락처 공유에 해당하는 기능이 없다.
- 관련 REQ-DISCORD-022·023: 현재 구현은 이미지 메시지를 caption(없으면 `fallbackText`) `content` 로만 보내 실제 이미지를 첨부하지 않고, Carousel 카드도 모두 텍스트로 보낸다(embeds 호출처 없음).
- 관련 REQ-DISCORD-028·029: 명령 우선 규칙, 취소 실패 처리, 대화 상태 정리, 비활성 워크플로우에서의 처리는 [채팅 채널](CLE-CHAT-CORE.md) 의 REQ-CHAT-062~066 이 정하고 Discord 의 경우별 처리는 [명령 처리](CLE-CHAT-DISCORD-INBOUND.md#명령-처리) 표가 정한다. 취소와 새 시작은 구현됐다. 즉시 응답은 공통 수신 문구(REQ-DISCORD-036)이고 시작 안내와 재시작 안내는 아직 보내지 않는다(NERV Task `CLE-T-0400J6`).
- 관련 REQ-DISCORD-030: 취소는 `/<prefix> start` 와 같은 실행 중지 경로(`ExecutionsService.stop`)를 쓴다. EIA `cancel` 도 같은 `stop` 을 부르므로 취소 동작은 같다([채팅 채널 「R-CC-27 활성 실행 중 /start 는 기존 실행을 취소하고 새로 시작한다」](CLE-CHAT-CORE.md#r-cc-27-활성-실행-중-start-는-기존-실행을-취소하고-새로-시작한다)). 취소한 뒤의 대화 상태 정리는 REQ-CHAT-065 를 따른다. 활성 실행이 없을 때의 안내는 아직 보내지 않는다. 즉시 응답은 공통 수신 문구다(REQ-DISCORD-036).
- 관련 REQ-DISCORD-031: `parseUpdate` 는 `help` 하위 명령에 `null` 을 돌려주고 `ChannelUpdate` 에 help kind 를 두지 않는다. 도움말은 어댑터의 기본 응답 본문으로만 나간다. 그래서 `HooksService` 의 `/help` 텍스트 분기(Telegram·Slack 용)를 타지 않고, 트리거가 비활성이어도 도움말로 답한다. (R-D-12)
- 관련 REQ-DISCORD-032·035: 재시도 정책과 중복 제거 키·TTL 은 [채팅 채널](CLE-CHAT-CORE.md)·[채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 이 정한다. 대기는 1초, 2초 두 번이고 세 번째 실패 뒤에는 기다리지 않는다(`discord-client.ts`).
- 관련 REQ-DISCORD-034: 현재 구현은 `429` 의 `Retry-After` 대기만 한다. bucket 단위 큐는 확인되지 않았다.
- 관련 REQ-DISCORD-036·037: 슬래시 명령은 경로마다 다른 안내를 두지 않고 한 문구로 답한다(2026-11-12 사람 결정, R-D-12). DM 밖 채널의 슬래시 명령도 파서가 버린 뒤 이 문구로 답한다.

## 하위 문서

- [Discord 어댑터 — 인바운드 처리와 응답](CLE-CHAT-DISCORD-INBOUND.md): Interactions payload 를 `ChannelUpdate` 로 바꾸는 명령 매핑, 인터랙션 종류별 웹훅 HTTP 응답, 서명 검증과 보안, 명령 처리. 요구사항 REQ-DISCORD-005~009, REQ-DISCORD-013, REQ-DISCORD-016, REQ-DISCORD-025~031, REQ-DISCORD-036, REQ-DISCORD-037.
- [Discord 어댑터 — API 호출과 UI 매핑](CLE-CHAT-DISCORD-API.md): REST·Interactions 호출 매핑, `setupChannel`·`teardownChannel`, MODAL, 노드 UI 매핑(멀티턴 AI·버튼·Form·시각형·실행 실패), 비기능(재시도·rate limit·중복 제거). 요구사항 REQ-DISCORD-001~004, REQ-DISCORD-010~024, REQ-DISCORD-032~035.

## 명령 매핑

→ [Discord 어댑터 — 인바운드 처리와 응답](CLE-CHAT-DISCORD-INBOUND.md#명령-매핑)

## 인바운드 응답

→ [Discord 어댑터 — 인바운드 처리와 응답](CLE-CHAT-DISCORD-INBOUND.md#인바운드-응답)

## 시각형 매트릭스

→ [Discord 어댑터 — API 호출과 UI 매핑](CLE-CHAT-DISCORD-API.md#시각형-매트릭스)


## 미결 사항

- **Chart·Carousel 입력 모양**: 매트릭스의 Chart 입력(`output.payload.{title, series, labels}`)과 Carousel 카드 이미지 URL 이 [Chart 노드](../CLE-NODE-PRES/CLE-NODE-CHART.md)·[Carousel 노드](../CLE-NODE-PRES/CLE-NODE-CAROUSEL.md) 출력과 다르다. [Presentation 노드 공통 §미결 사항](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md#미결-사항) 과 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md#미결-사항) 의 미결 사항과 함께 결정 필요.

## 구현 위치

- `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts`
- `codebase/backend/src/modules/chat-channel/providers/discord/discord-client.ts`
- `codebase/backend/src/modules/chat-channel/providers/discord/discord-interaction-response.ts`: 인터랙션 기본 응답(`buildDiscordDefaultInteractionResponse`)과 도움말 문구 선택(`resolveDiscordHelpText` 가 `pickLocaleDefault` 로 `SLASH_HELP_DEFAULTS` 에서 고른다)
- `codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.ts`
- `codebase/backend/src/modules/chat-channel/providers/discord/discord-signing.ts`
- `codebase/backend/src/modules/chat-channel/providers/discord/discord-update.parser.ts`
- `codebase/backend/src/modules/chat-channel/providers/discord/discord.types.ts`: interaction type·callback type·ephemeral flag 상수(`DISCORD_INTERACTION_TYPE`·`DISCORD_INTERACTION_CALLBACK_TYPE`·`DISCORD_MESSAGE_FLAG_EPHEMERAL`)
- `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts`: 수신 문구 기본값(`COMMAND_RECEIVED_DEFAULTS`·`resolveCommandReceivedMessage`), Slack 과 함께 쓰는 슬래시 명령 기본 도움말(`SLASH_HELP_DEFAULTS`)
- `codebase/backend/src/modules/chat-channel/types.ts`: 선택 함수 `defaultInteractionResponse` 와 `InboundInteractionResponse`
- `codebase/backend/src/modules/chat-channel/chat-channel-inbound-authenticator.ts`
- `codebase/backend/src/modules/hooks/hooks.service.ts`, `hooks.controller.ts`: 인바운드 관문(워크플로우 활성 관문 포함), 명령 처리(활성 실행 중 `/<prefix> start` 의 기존 실행 취소), 기본 응답 적용(`withDefaultInteractionResponse`)과 인터랙션 응답 본문의 `200` 전송
- `codebase/backend/src/modules/hooks/hooks.service.spec.ts`: 세 프로바이더의 활성 실행 중 start 명령, 인터랙션 기본 응답. `hooks.controller.spec.ts`: 인터랙션 응답 본문과 빈 본문의 `200` 전송
- `codebase/backend/src/modules/chat-channel/providers/discord/discord-interaction-response.spec.ts`, `discord.adapter.spec.ts`
- `codebase/packages/chat-channel-validation/src/index.ts`
- `codebase/backend/test/chat-channel-discord.e2e-spec.ts`, `chat-channel-trigger-create.e2e-spec.ts`
- `codebase/frontend/src/app/(main)/w/[slug]/triggers/page.tsx`, `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx`, `codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts`
- 사용자 가이드: `codebase/frontend/src/content/docs/06-integrations-and-config/discord.mdx`, `discord.en.mdx`


## Rationale

### R-D-1 public key 도 SecretResolver 로 관리하고 inboundSigningRef 슬롯을 함께 쓴다

두 결정이 합쳐져 있다.

결정 1: 비밀이 아닌 공개키도 `SecretResolver` 로 관리한다. 교체(Developer Portal 에서 reset 가능), 워크스페이스 격리, 감사 일관성을 얻고 참조 형식과 라이프사이클이 `botTokenRef` 와 맞는다. `Trigger.config.chatChannel.publicKey` 에 평문으로 두는 안은 비밀이 아니라 평문이어도 되지만, 설정 JSON 이 `SecretResolver` 를 건너뛰어 모듈 일관성이 깨지므로 택하지 않았다.

결정 2: 참조 슬롯은 Telegram·Slack 과 함께 쓰는 `inboundSigningRef` 하나다([Slack 어댑터](CLE-CHAT-SLACK.md) R-S-1 과 같은 역할 기반 이름). 자원 성격 차이(Telegram shared secret, Slack HMAC key, Discord ed25519 공개키)는 백엔드 프로바이더 분기가 흡수한다. 프로바이더별 `publicKeyRef` 필드를 두면 규약의 필드가 늘고 새 프로바이더마다 필드를 만들어야 하며 자원의 공통 역할이 드러나지 않는다.

비대칭 공개키라는 차이는 `SecretResolver` API 에서는 평범한 문자열 blob(`store`·`resolve`)으로 다루고, 검증 단계의 `crypto.verify('ed25519', ...)` 만 `DiscordAdapter` 가 맡는다.

### R-D-3 v1 은 Interactions Webhook 만, Gateway 는 v2

무상태 HTTP 인 Interactions Webhook 을 택한다. slash command·버튼·모달 위주 UX 는 Discord 가 권장하는 현대적 봇 패턴이다. Gateway WebSocket 은 봇마다 오래 유지되는 연결, heartbeat 관리, 큰 봇의 shard 라우팅, 여러 인스턴스 환경의 연결 라우팅 인프라가 필요해 v2 로 미룬다. v1 제약의 결과는 다음과 같다.

- 자유 텍스트 DM 메시지를 받지 못한다(`MESSAGE_CREATE` 없음).
- 멀티턴 AI 답장은 (a) `/workflow reply <message>` text option 이나 (b) 모달 TEXT_INPUT 으로 표현한다.
- DM 첫 메시지 자동 시작을 지원하지 않는다. `/workflow start` 를 입력해야 한다.
- `file_upload` 도 v1 에서 지원하지 않는다. Discord 파일 업로드는 Gateway 메시지 첨부에 기반한다.

Gateway 도입은 사용자 요청이 있을 때 v2 후보로 진입한다.

### R-D-4 DM 만 받고 guild 채널은 거부한다

v1 정책(CCH-CV-05)과 맞다. guild 채널은 여러 사용자가 있어 대화 매핑이 깨진다. guild 봇 UX 는 v2 여러 사용자 대화와 함께 간다.

### 다른 Rationale 항목의 위치

R-D-1·R-D-3·R-D-4 는 이 문서에 있다. 나머지 본문은 하위 문서에 있다. R-D-8·R-D-10·R-D-11·R-D-12 는 [Discord 어댑터 — 인바운드 처리와 응답](CLE-CHAT-DISCORD-INBOUND.md#rationale), R-D-2·R-D-5·R-D-6·R-D-7·R-D-9 는 [Discord 어댑터 — API 호출과 UI 매핑](CLE-CHAT-DISCORD-API.md#rationale) 에 있다. 다른 문서가 링크하는 항목은 아래에 제목만 남긴다.

### R-D-8 PING 과 Interactivity 는 200 OK 로 답한다

→ [Discord 어댑터 — 인바운드 처리와 응답](CLE-CHAT-DISCORD-INBOUND.md#r-d-8-ping-과-interactivity-는-200-ok-로-답한다)

### R-D-9 file 필드 한계는 프로바이더 문서에 적고 Form 은 바꾸지 않는다

→ [Discord 어댑터 — API 호출과 UI 매핑](CLE-CHAT-DISCORD-API.md#r-d-9-file-필드-한계는-프로바이더-문서에-적고-form-은-바꾸지-않는다)

### R-D-11 컴포넌트와 모달 제출은 어느 경로로 끝나도 type 6 으로 답한다

→ [Discord 어댑터 — 인바운드 처리와 응답](CLE-CHAT-DISCORD-INBOUND.md#r-d-11-컴포넌트와-모달-제출은-어느-경로로-끝나도-type-6-으로-답한다)

### R-D-12 슬래시 명령은 본인에게만 보이는 type 4 로 바로 답하고 비활성 트리거도 인터랙션 응답으로 답한다

→ [Discord 어댑터 — 인바운드 처리와 응답](CLE-CHAT-DISCORD-INBOUND.md#r-d-12-슬래시-명령은-본인에게만-보이는-type-4-로-바로-답하고-비활성-트리거도-인터랙션-응답으로-답한다)
