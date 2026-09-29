---
id: "CLE-CHAT-DISCORD"
title: "Discord 어댑터"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-DISCORD-001", "REQ-DISCORD-002", "REQ-DISCORD-003", "REQ-DISCORD-004", "REQ-DISCORD-005", "REQ-DISCORD-006", "REQ-DISCORD-007", "REQ-DISCORD-008", "REQ-DISCORD-009", "REQ-DISCORD-010", "REQ-DISCORD-011", "REQ-DISCORD-012", "REQ-DISCORD-013", "REQ-DISCORD-014", "REQ-DISCORD-015", "REQ-DISCORD-016", "REQ-DISCORD-017", "REQ-DISCORD-018", "REQ-DISCORD-019", "REQ-DISCORD-020", "REQ-DISCORD-021", "REQ-DISCORD-022", "REQ-DISCORD-023", "REQ-DISCORD-024", "REQ-DISCORD-025", "REQ-DISCORD-026", "REQ-DISCORD-027", "REQ-DISCORD-028", "REQ-DISCORD-029", "REQ-DISCORD-030", "REQ-DISCORD-031", "REQ-DISCORD-032", "REQ-DISCORD-033", "REQ-DISCORD-034", "REQ-DISCORD-035"]
basis_superseded: false
parent: "CLE-CHAT"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT"]
area: "CLE-CHAT"
content_hash: "05cbbeff938eeb828baee99498618facd39f9cea8aecd96f4521c627202a1192"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/7-trigger/providers/discord.md"]
mirror_sha256: "ac14b902e91af477d68ffbe6eb72db8c3b0903b99969a3234c78405bf6b388e1"
etag: "sha256-48bafdbfb3e6fc5625e46a62421b8be1cee0737aa6479efb652dd09c2020ec71"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/7-trigger/providers/discord.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

`provider: "discord"` 채널 어댑터는 [Discord REST API](https://discord.com/developers/docs/reference) 와 [Interactions Webhook](https://discord.com/developers/docs/interactions/receiving-and-responding) 위에서 동작한다. 사용자가 Discord Developer Portal 에서 Application 과 Bot 을 만들고 봇 토큰과 application public key 를 등록하면, 어댑터가 slash command 를 일괄 덮어쓰기로 등록한다. 그리고 [채팅 채널](CLE-CHAT-CORE.md) 의 UI 매핑 요구사항(CCH-MP-01~06)이 다루는 노드를 Discord UI(Message Components, Embeds, Modal)로 바꾼다.

v1 은 Interactions Webhook 만 쓴다. Discord [Gateway WebSocket](https://discord.com/developers/docs/topics/gateway) 은 봇마다 오래 유지되는 연결과 heartbeat 관리가 필요해 v2 옵션이다(R-D-3). 그래서 v1 사용자는 자유 텍스트 대신 slash command, 버튼, 모달로 워크플로우와 주고받는다. 멀티턴 AI 의 사용자 답장도 모달·명령 입력으로 받는다.

이 문서는 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 인터페이스의 Discord 구현을 정한다. 공통 규칙(렌더 매핑, 실행 실패 분류, Form 입력 흐름, 다단계 질문 본문 형식, 시각형 렌더 입력)은 어댑터 규약을, 인바운드 HTTP 응답·명령 공통 의미·재시도 정책은 [채팅 채널](CLE-CHAT-CORE.md) 을, 설정 필드와 안내 문구는 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 을 따른다.

## 사용 시나리오

| 시나리오 | 설명 |
|---|---|
| Discord 봇 명령 워크플로우 | 사용자가 `/workflow start` → AI 응답 → "Reply" 버튼 모달이나 `/workflow reply` 로 답장 |
| Discord 봇 결재 | 사용자 slash command → Form 모달 → 결재 결과 통보 |
| Discord 봇 데이터 안내 | 사용자 slash command → Chart 렌더 → v1 은 monospace 텍스트 차트와 선택 버튼, v2 는 이미지 첨부 |

## 요구사항

- REQ-DISCORD-001 WHEN `setupChannel` 이 불리면 THE SYSTEM SHALL `GET /applications/@me` 로 `botIdentity`(`botId: hashStringToInt(id)`, `username: name`, `publicKey: verify_key`)를 캐시한다. (원본: discord §3.1)
- REQ-DISCORD-002 IF 응답의 `verify_key` 와 사용자가 입력한 public key 가 둘 다 있고 서로 다르면 THE SYSTEM SHALL `BOT_TOKEN_INVALID` 로 던져 setup 을 막는다. (원본: discord §3.1)
- REQ-DISCORD-003 WHEN `setupChannel` 이 불리면 THE SYSTEM SHALL `PUT /applications/{app_id}/commands` 로 `/<prefix>` slash command(하위 `start`·`cancel`·`help`·`reply`)를 일괄 덮어써 등록한다. (원본: discord §3.1, R-D-2)
- REQ-DISCORD-004 WHEN `teardownChannel` 이 불리면 THE SYSTEM SHALL `PUT /applications/{app_id}/commands` 에 `[]` 를 보내 명령을 지우고 실패해도 트리거 비활성화를 막지 않는다. (원본: discord §3.2)
- REQ-DISCORD-005 WHEN `type: 1`(PING)이 오면 THE SYSTEM SHALL `parseUpdate` 가 `null` 을 돌려주고 호출자가 `200 OK` 와 `{ type: 1 }` 로 답한다. (원본: discord §3.1, R-D-8)
- REQ-DISCORD-006 WHEN Interactions payload 가 오면 THE SYSTEM SHALL [명령 매핑](#명령-매핑) 표에 따라 `ChannelUpdate` 로 바꾸고 `interaction.id` 를 중복 제거 키로 쓴다. (원본: discord §4)
- REQ-DISCORD-007 IF `channel.type !== 1`(DM 이 아님)이면 THE SYSTEM SHALL `null` 을 돌려주고 호출자가 `groupChatRefusal` 안내를 보낸다. (원본: discord §4, §6)
- REQ-DISCORD-008 IF `member.user.bot === true` 이거나 DM 의 `user.bot === true` 이면 THE SYSTEM SHALL `null` 을 돌려준다. (원본: discord §4, §6)
- REQ-DISCORD-009 WHEN Interactions 요청이 오면 THE SYSTEM SHALL 3초 안에 `200 OK` 와 `{ type: 5 }`·`{ type: 6 }`·`{ type: 9, data }` 가운데 알맞은 응답을 돌려준다. (원본: discord §3, §4)
- REQ-DISCORD-010 WHEN `execution.ai_message` 를 보내면 THE SYSTEM SHALL `POST /channels/{id}/messages` 의 `content` 로 escape 없이 보내고 2000자를 넘으면 단어·문장 경계로 나눠 마지막 조각 전까지 `\n_(continued…)_` 를 붙인다. (원본: discord §5.1)
- REQ-DISCORD-011 WHEN AI 응답을 보내면 THE SYSTEM SHALL 마지막 텍스트 조각에 "Reply" 버튼(`__reply__`)을 붙인다. (원본: discord §5.1)
- REQ-DISCORD-012 WHEN "Reply" 버튼이 눌리면 THE SYSTEM SHALL `custom_id` 가 `clemvion_reply` 인 단일 TEXT_INPUT 모달을 열고 제출 값을 `text_message` 로 바꿔 EIA `submit_message` 로 보낸다. (원본: discord §5.1)
- REQ-DISCORD-013 WHEN `/<prefix> reply <message>` 가 오면 THE SYSTEM SHALL `{ kind: "text_message", text: <message> }` 로 바꾼다. (원본: discord §5.1)
- REQ-DISCORD-014 WHEN LLM 응답 직전이면 THE SYSTEM SHALL `POST /channels/{id}/typing` 을 한 번 보내고 응답이 10초를 넘으면 5초마다 다시 보낸다. (원본: discord §5.1, §5.5)
- REQ-DISCORD-015 WHEN 버튼 대기를 보내면 THE SYSTEM SHALL ACTION_ROW 와 BUTTON 요소로 만들고 `custom_id` 에 `buttonId` 를 넣으며 `buttonLayout` 에 따라 행을 나눈다. (원본: discord §5.2)
- REQ-DISCORD-016 WHEN 버튼 MESSAGE_COMPONENT 가 오면 THE SYSTEM SHALL 곧바로 `200 OK` 와 `{ type: 6 }` 으로 답하고 EIA `click_button` 을 부른다. (원본: discord §5.2)
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
- REQ-DISCORD-028 WHEN 활성 실행이 없을 때 `/<prefix> start` 가 오면 THE SYSTEM SHALL 새 실행을 시작하고 `languageHints.executionStarted` 를 즉시 응답이나 후속 메시지로 안내한다. (원본: discord §7)
- REQ-DISCORD-029 WHEN 활성 실행이 있을 때 `/<prefix> start` 가 오면 THE SYSTEM SHALL 기존 실행을 취소하고 새 실행을 시작하며 "기존 대화를 종료하고 새로 시작합니다." 를 안내한다. (원본: discord §7)
- REQ-DISCORD-030 WHEN `/<prefix> cancel` 이 오면 THE SYSTEM SHALL 활성 실행에 EIA `cancel` 을 부르고 활성 실행이 없으면 "진행 중인 대화가 없습니다." 를 안내한다. (원본: discord §7)
- REQ-DISCORD-031 WHEN `/<prefix> help` 가 오면 THE SYSTEM SHALL EIA 를 부르지 않고 `languageHints.help`(없으면 기본 문구)로 바로 답한다. (원본: discord §4, §7) (부분 구현)
- REQ-DISCORD-032 WHEN `POST /channels/{id}/messages` 를 부르면 THE SYSTEM SHALL 5초 타임아웃과 지수 백오프로 총 3회까지 시도하고 끝내 실패하면 `chat_channel_health` 를 `degraded` 로 바꾼다. (원본: discord §8)
- REQ-DISCORD-033 WHEN Discord 가 `429` 와 `Retry-After` 를 돌려주면 THE SYSTEM SHALL 그만큼 기다린 뒤 다시 시도한다. (원본: discord §8)
- REQ-DISCORD-034 WHILE Discord rate limit 안에서 보내는 동안 THE SYSTEM SHALL bucket 단위 큐와 응답 헤더 기반 throttle 로 발송 속도를 맞춘다. (원본: discord §8) (미구현)
- REQ-DISCORD-035 WHEN 같은 `interaction.id` 가 30초 안에 다시 오면 THE SYSTEM SHALL 두 번째 update 를 무시한다. (원본: discord §8)

요구사항 보충 설명은 다음과 같다.

- 관련 REQ-DISCORD-002: 인바운드 서명 검증의 기준은 여전히 `inboundSigningRef`(시크릿 저장소)와 생성 때 정규식 검증(REQ-DISCORD-027)이다. setup 때 교차 확인과 `publicKey` 캐시는 그 위의 추가 안전장치이자 identity 편의다.
- 관련 REQ-DISCORD-011~013: 두 입력 경로는 함께 있다. "Reply" 버튼 모달이 v1 기본 UX 이고 `/<prefix> reply` 는 숙련 사용자용 보조 옵션이다. 자유 DM 텍스트 답장은 v2 Gateway 에서 된다([채팅 채널](CLE-CHAT-CORE.md) R-CC-13 이 이 부분 유예의 기준이다).
- 관련 REQ-DISCORD-020: [Form 노드](../CLE-NODE-PRES/CLE-NODE-FORM.md) 에 `validation.preset` 이 아직 없다. Discord 에는 연락처 공유에 해당하는 기능이 없다.
- 관련 REQ-DISCORD-022·023: 현재 구현은 이미지 메시지를 caption(없으면 `fallbackText`) `content` 로만 보내 실제 이미지를 첨부하지 않고, Carousel 카드도 모두 텍스트로 보낸다(embeds 호출처 없음).
- 관련 REQ-DISCORD-029·031: 활성 실행 중 `/start` 와 help 경로는 정의가 갈린다. [미결 사항](#미결-사항) 참조.
- 관련 REQ-DISCORD-032·035: 재시도 정책과 중복 제거 키·TTL 은 [채팅 채널](CLE-CHAT-CORE.md)·[채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 이 정한다. 대기는 1초, 2초 두 번이고 세 번째 실패 뒤에는 기다리지 않는다(`discord-client.ts`).
- 관련 REQ-DISCORD-034: 현재 구현은 `429` 의 `Retry-After` 대기만 한다. bucket 단위 큐는 확인되지 않았다.

## REST와 Interactions 호출 매핑

| 어댑터 함수 | Discord API |
|---|---|
| `setupChannel` | (a) [`GET /applications/@me`](https://discord.com/developers/docs/resources/application)로 application identity 캐시(id, name, `verify_key` → `botIdentity.publicKey`). 응답 `verify_key` 와 사용자 입력 public key(`inboundSigningRef`)를 교차 확인하고 다르면 `BOT_TOKEN_INVALID`. (b) [`PUT /applications/{app_id}/commands`](https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands)로 slash command 일괄 덮어쓰기(`/<prefix>` 와 하위 옵션) |
| `teardownChannel` | `PUT /applications/{app_id}/commands` 에 `[]`. 실패해도 막지 않는다(남은 명령은 다음 setup 때 덮어쓴다) |
| `parseUpdate` | Interactions Webhook payload(`type ∈ {1, 2, 3, 5}`: PING, APPLICATION_COMMAND, MESSAGE_COMPONENT, MODAL_SUBMIT) → `ChannelUpdate` |
| `sendMessage`(text) | [`POST /channels/{channel_id}/messages`](https://discord.com/developers/docs/resources/channel#create-message)(content). DM 채널은 먼저 [`POST /users/@me/channels`](https://discord.com/developers/docs/resources/user#create-dm)로 만들고 channel_id 를 캐시한다 |
| `sendMessage`(buttons) | `POST /channels/{id}/messages` + `components: [{type: 1, components: [{type: 2, ...}]}]`(ACTION_ROW 와 BUTTON) |
| `sendMessage`(form_prompt) | 다단계 질문. 평문 content 와 "Reply" 버튼 → 단일 TEXT_INPUT 모달 |
| `sendMessage`(form_modal) | `POST /channels/{id}/messages` + "양식 작성하기" 버튼(`custom_id: "__open_form__"`). 클릭하면 `HooksService` 가 `openFormModal` 에서 interaction HTTP 응답 `{ type: 9, data: <modal> }` 로 TEXT_INPUT N개 모달을 연다 |
| `sendMessage`(image) | 현재 v1 은 `content` 에 caption(없으면 `fallbackText`)만 보내고 이미지는 첨부하지 않는다. `attachments` multipart 업로드나 `embeds: [{image: {url}}]` 는 미구현 |
| `sendMessage`(typing) | [`POST /channels/{channel_id}/typing`](https://discord.com/developers/docs/resources/channel#trigger-typing-indicator). 10초 유지 뒤 자동 만료 |
| `ackInteraction` | Interactions 응답. 3초 안에 `200 OK` 와 `{ type: 5 }`(DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE), `{ type: 6 }`(DEFERRED_UPDATE_MESSAGE), `{ type: 9, data: <modal> }`(`__open_form__`·`__reply__` 클릭 때 MODAL). 비동기 갱신은 [`PATCH /webhooks/{app_id}/{interaction_token}/messages/@original`](https://discord.com/developers/docs/interactions/receiving-and-responding#edit-original-interaction-response)(15분 유효, 5회 한도) |

### setupChannel

```text
GET https://discord.com/api/v10/applications/@me
Authorization: Bot {botToken}
→ { id, name, verify_key, owner, ... }
  → config.chatChannel.botIdentity = { botId: hashStringToInt(id), username: name, publicKey: verify_key }
```

현재 구현은 응답의 `id`·`name` 을 `botIdentity` 에 저장하고(`botId` 는 snowflake 문자열을 `hashStringToInt` 로 바꾼 정수), `verify_key`(application public key)를 `botIdentity.publicKey` 에 캐시한다(비민감 공개키). `verify_key` 와 사용자 입력 public key 가 둘 다 있고 다르면 `BOT_TOKEN_INVALID` 로 던져 잘못된 앱·키 등록을 setup 때 막는다.

```text
PUT https://discord.com/api/v10/applications/{app_id}/commands
Authorization: Bot {botToken}
Body: [
  {
    "name": "<configured-prefix>",       // 기본 "workflow"
    "description": "Workflow assistant",
    "type": 1,                            // CHAT_INPUT(slash command)
    "options": [
      { "name": "start", "type": 1, "description": "Start a new conversation" },
      { "name": "cancel", "type": 1, "description": "Cancel the active conversation" },
      { "name": "help", "type": 1, "description": "Show help" },
      {
        "name": "reply", "type": 1, "description": "Reply to the active AI conversation",
        "options": [
          { "name": "message", "type": 3, "description": "Reply text", "required": true }
        ]
      }
    ]
  }
]
→ 등록된 command 목록 반환
```

Interactions Endpoint URL 은 Developer Portal 의 application 정적 설정이라 어댑터가 API 로 등록·해제하지 않는다. 사용자 가이드가 `${BASE_URL}/api/hooks/${trigger.endpointPath}` 입력을 안내한다(Slack R-S-2 와 같은 생각).

PING(`type: 1`)은 Discord 가 Interactions Endpoint URL 을 등록할 때 한 번, 그 뒤 주기적으로 보낸다. `parseUpdate` 가 `null` 을 돌려주고 호출자가 `{ type: 1 }` JSON 을 `200 OK` 로 답한다. Discord 는 PING 에 `200 + { type: 1 }` 만 성공으로 보므로 [채팅 채널](CLE-CHAT-CORE.md) 인바운드 응답 계약의 `202` 정책에 대한 명시적 예외다(R-D-8).

### teardownChannel

```text
PUT https://discord.com/api/v10/applications/{app_id}/commands
Authorization: Bot {botToken}
Body: []
```

부분 실패해도 트리거 비활성화를 막지 않는다. 다음 setup 때 새 명령으로 덮어쓰면 남은 명령은 저절로 정리된다. Interactions Endpoint URL 은 우리 쪽에서 해제할 수 없어 사용자가 portal 에서 직접 비워야 한다(사용자 가이드 안내).

### MODAL

[채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 네이티브 모달 경로의 Discord 구현이다. Discord 모달은 interaction 응답(type 9)으로만 열 수 있고 서버가 먼저 보낼 수 없다. `form_modal` 버튼(`custom_id: "__open_form__"`)을 누르면 `parseUpdate` 가 `open_form_modal` 을 돌려주고, `HooksService` 가 `openFormModal` 에서 MODAL JSON 을 웹훅 HTTP 응답 본문으로 돌려준다(HooksController 가 `res.json`).

```text
HTTP 200 (Interactions 응답 본문)
{
  "type": 9,                              // MODAL
  "data": {
    "custom_id": "clemvion_form",         // MODAL_SUBMIT 분기용 고정 id
    "title": "<formConfig.title>",        // formConfig.title(extractFormTitle)을 45자로 자르고, 없으면 languageHints.formModalTitle, 마지막으로 '양식'
    "components": [
      // formConfig.fields[] → ACTION_ROW(1) + TEXT_INPUT(4). ACTION_ROW 최대 5개
      { "type": 1, "components": [
        { "type": 4, "custom_id": "<field.name>", "label": "<field.label>",
          "style": 1 | 2,                  // 1=SHORT, 2=PARAGRAPH(textarea)
          "required": field.required,
          "placeholder": field.description(있으면, 100자 이하),
          // field.validation.{minLength,maxLength} → min_length / max_length(Discord 0–4000 한도). 없으면 붙이지 않는다
          "min_length": field.minLength?, "max_length": field.maxLength? }
      ]}
    ]
  }
}
```

- **TEXT_INPUT 전용**: Discord 모달은 TEXT_INPUT(type 4)만 받는다. SELECT_MENU·날짜 선택기는 모달에 넣을 수 없다. 그래서 모든 필드가 텍스트 계열(`text`·`textarea`·`email`·`number`·`date`·phone, 모두 TEXT_INPUT 과 형식 안내로 표현)일 때만 모달로 간다. `select`·`radio`·`checkbox`·`file` 이 하나라도 있으면 필드가 5개 이하여도 다단계 질문이다.
- **placeholder**: `field.description` 을 쓰지만 이 필드는 Form 노드의 필드 정의에 없다. 정식 필드로 둘지는 [Form 노드 §미결 사항](../CLE-NODE-PRES/CLE-NODE-FORM.md#미결-사항) 에서 정한다.
- **필드 5개 한도**: ACTION_ROW 5개 × TEXT_INPUT 1개가 최대다.
- **MODAL_SUBMIT**: 제출하면 `data.components[].components[]` 의 `{ custom_id: field.name, value }` 를 `parseUpdate` 가 `{ kind: "form_submission", fields }` 로 편다.
- **검증 실패 재표시**: Discord 는 MODAL_SUBMIT 에 같은 모달을 다시 보낼 수 없다(interaction 응답은 한 번). 서버 쪽 검증이 실패하면 후속 메시지에 "다시 입력" 버튼(`__open_form__`)을 다시 보내고, 사용자가 누르면 모달을 다시 연다.

## 명령 매핑

Discord Interactions Webhook 은 envelope 하나(`type` 필드로 분기, `Content-Type: application/json`)다.

| Discord payload | `ChannelUpdate.command` |
|---|---|
| `type === 1`(PING) | `null`. 호출자가 `{ type: 1 }` 로 200 응답 |
| `type === 2`(APPLICATION_COMMAND), `data.options[0].name === "start"` | `{ kind: "start" }` |
| `type === 2`, `data.options[0].name === "cancel"` | `{ kind: "cancel" }` |
| `type === 2`, `data.options[0].name === "reply"` | `{ kind: "text_message", text: <message option> }`(멀티턴 AI 답장) |
| `type === 2`, `data.options[0].name === "help"` | 도움말. 어댑터가 바로 답하고 EIA 를 부르지 않는다. [미결 사항](#미결-사항) 참조 |
| `type === 3`(MESSAGE_COMPONENT), `data.custom_id === "__open_form__"`(BUTTON) | `{ kind: "open_form_modal", openContext: { interactionId, interactionToken } }`. `HooksService` 가 `{ type: 9 }` MODAL 을 웹훅 응답 본문으로 돌려준다 |
| `type === 3`, `data.custom_id === "__reply__"`(BUTTON) | `{ kind: "open_form_modal", openContext: { interactionId, interactionToken, modal: "reply" } }`. `HooksService` 가 `openFormModal(modalKind='reply')` 로 `clemvion_reply` 모달을 연다 |
| `type === 3`, `data.component_type === 2`(그 밖의 BUTTON) | `{ kind: "button_callback", callbackData: data.custom_id }` |
| `type === 3`, `data.component_type === 3`(SELECT_MENU) | `{ kind: "button_callback", callbackData: data.values[0] }` |
| `type === 5`(MODAL_SUBMIT), `data.custom_id === "clemvion_form"` | `{ kind: "form_submission", fields }`. `data.components[].components[]` 의 `{ custom_id: field.name, value }` 를 편다(R-D-6) |
| `type === 5`, `data.custom_id !== "clemvion_form"`(예: `clemvion_reply`) | `{ kind: "text_message", text: <TEXT_INPUT 값> }`. 멀티턴 AI 답장 모달의 결과다 |
| `member.user.bot === true` 또는 DM `user.bot === true` | `null`. 봇 무시 |
| `channel.type !== 1`(DM 아님: GUILD_TEXT=0, DM=1, GROUP_DM=3 등) | `null`. 호출자가 `groupChatRefusal` 안내 |
| 그 밖의 `type`(4 = APPLICATION_COMMAND_AUTOCOMPLETE 등) | `null`. v1 에서 처리하지 않는다 |

자유 텍스트 메시지는 받지 못한다. Discord 의 [`MESSAGE_CREATE`](https://discord.com/developers/docs/topics/gateway-events#message-create) 는 Gateway 연결 때만 오고 v1 은 Interactions Webhook 만 쓰기 때문이다(R-D-3). 멀티턴 AI 답장은 slash command 의 text option 이나 모달 TEXT_INPUT 으로 받는다.

Discord Interactions 는 3초 안에 응답해야 한다. `ackInteraction` 이 곧바로 `200 OK` 와 `{ type: 5 }`(DEFERRED, 비동기 후속 갱신)나 `{ type: 6 }`(UPDATE_MESSAGE, 기존 메시지 갱신)로 답한다. 비동기 갱신은 `PATCH /webhooks/{app_id}/{interaction_token}/messages/@original`(15분 유효)이다.

중복 제거 키(`idempotencyKey`)는 `interaction.id` 를 그대로 쓴다. Discord 가 interaction 마다 snowflake id 를 붙이고 재전송 때 같은 id 를 보낸다.

## 노드 UI 매핑

### 멀티턴 AI

아웃바운드는 CCH-MP-01 을 모두 만족한다.

- `execution.ai_message.message` 를 `POST /channels/{id}/messages`(content, 평문 markdown)로 보낸다. Discord 는 자체 markdown 을 지원해 escape 가 필요 없다.
- 2000자(`content` 한도)에서 나눈다. 단어·문장 경계로 나누고 마지막 조각 전까지 `\n_(continued…)_` 를 붙인다.
- 응답 직전 `POST /channels/{id}/typing` 을 한 번 보낸다(10초 자동 만료). 응답이 10초를 넘으면 5초마다 다시 보낸다.

인바운드는 CCH-MP-01 을 일부 미룬다. v1 은 Interactions Webhook 만 써서 DM `MESSAGE_CREATE` 를 받지 못하므로 답장 경로는 둘로 제한된다([채팅 채널](CLE-CHAT-CORE.md) R-CC-13 이 이 부분 유예의 기준이다).

- (a) `/<prefix> reply <message>` slash command: text option 으로 자유 입력한다. 멀티턴 AI 진행 중에만 의미가 있다. `parseUpdate` 가 `{ kind: "text_message", text }` 로 돌려주고 EIA `submit_message` 로 간다. 숙련 사용자용 보조 옵션이다.
- (b) "Reply" 버튼 → 모달 TEXT_INPUT(v1 기본 UX): 어댑터(`renderAiMessage`)가 AI 응답의 마지막 텍스트 조각을 버튼 메시지로 바꿔 "Reply" 버튼(`id: "__reply__"`, style none·SECONDARY)을 붙인다. 누르면 `parseUpdate` 가 `open_form_modal`(`openContext.modal: "reply"`)을 돌려주고, `HooksService` 가 `openFormModal(modalKind='reply')` 로 `{ type: 9 }` 모달(`custom_id: "clemvion_reply"`, TEXT_INPUT `custom_id: "message"`)을 연다. 제출(`clemvion_reply` MODAL_SUBMIT)의 값을 `parseUpdate` 가 `text_message` 로 바꿔 EIA `submit_message` 로 보낸다. 폼 모달은 `clemvion_form`, AI 답장 모달은 `clemvion_reply` 로 두 MODAL_SUBMIT 경로를 나눈다.

일반 DM 텍스트로 답하는 완전한 자연 대화는 v2 Gateway 에서 된다.

### 버튼

- `buttonConfig.buttons[]` 를 Message Components 로 만든다. `ACTION_ROW`(type 1) 안에 `BUTTON`(type 2)을 넣는다. ACTION_ROW 하나에 버튼 최대 5개, 메시지 하나에 ACTION_ROW 최대 5개다.
- `uiMapping.buttonLayout` 에 따라 나눈다.
  - `auto`(기본): 5개씩 ACTION_ROW 로 나눈다. 25개를 넘으면 메시지를 나눈다(5 × 5 = 25).
  - `vertical`: 버튼마다 ACTION_ROW 하나.
  - `horizontal`: `auto` 와 같다(행당 5개가 가로 최대다).
- `custom_id` 에 `buttonId`(UUID)를 넣는다. 한도 100자라 넉넉하다(R-D-5).
- `style: 'primary'` 는 `style: 1`(PRIMARY), `'danger'` 는 `style: 4`(DANGER), 그 밖은 `style: 2`(SECONDARY).
- 노드가 시각형이면 시각 메시지를 먼저 보내고 ACTION_ROW 는 다음 메시지로 보내거나 같은 메시지의 `components` 에 붙인다.
- MESSAGE_COMPONENT 가 오면 (1) 곧바로 `200 OK + { type: 6 }`(3초 ack), (2) EIA `click_button`, (3) 선택으로 `PATCH /webhooks/{app_id}/{token}/messages/@original` 에 `components: []` 나 비활성 상태를 보내 중복 클릭을 막는다.

### Form

Discord 는 `supportsNativeForm = true` 이고 어댑터 규약의 폼 모드 분기를 쓴다. 모달이 TEXT_INPUT 만 받아 진입 조건이 Slack 보다 좁다.

- **네이티브 모달**: `formMode ∈ {auto, native_modal}`, 필드 5개 이하, 모든 필드가 텍스트 계열. `form_modal` 버튼 → `{ type: 9 }` MODAL → `clemvion_form` MODAL_SUBMIT 일괄 제출.
- **다단계 질문**: 필드 6개 이상, `formMode === "multi_step"`, `select`·`radio`·`checkbox`·`file` 필드가 하나라도 있을 때.

| `field.type`([Form 노드](../CLE-NODE-PRES/CLE-NODE-FORM.md)) | 모달 TEXT_INPUT | 다단계 질문 힌트 |
|---|---|---|
| `text`·`email` | style 1(SHORT) | content 질문과 "Reply" 버튼 → TEXT_INPUT 모달 |
| `textarea` | style 2(PARAGRAPH) | content 질문과 "Reply" 버튼 → TEXT_INPUT 모달(PARAGRAPH) |
| `number` | style 1, 제출 뒤 어댑터 숫자 검증 | content 질문과 "Reply" 버튼 → TEXT_INPUT 모달(정규식 확인) |
| `date` | style 1 과 형식 안내(`YYYY-MM-DD`) | content 질문, 형식 안내, TEXT_INPUT 모달(네이티브 날짜 선택기 없음) |
| `text` + `validation.preset: 'phone'` | style 1 과 어댑터 형식 검증. 미구현 | content 질문과 TEXT_INPUT 모달. 연락처 공유는 없다 |
| `select`·`radio` | 모달이 받지 않는다. 있으면 다단계 질문 | `SELECT_MENU`(type 3) 단일 선택 |
| `checkbox` | 모달이 받지 않는다. 있으면 다단계 질문 | BUTTON(style 2) N개 토글과 "Done" 버튼 |
| `file` | 모달이 받지 않는다. 있으면 다단계 질문(Discord 파일 v1 미지원, R-D-7·R-D-9) | content 질문과 "DM 으로 파일 업로드…" 안내. v1 에서는 사실상 지원하지 않는다. 우회로는 외부 저장소 URL 을 `text` 필드로 받고 `validation.pattern` 에 URL 정규식을 지정하는 것이다. Form 에는 URL 검증 preset 이 없다 |

서버 쪽 검증이 실패하면 모달은 후속 메시지의 버튼으로 다시 열게 하고, 다단계 질문은 `currentFieldIdx` 를 되돌려 그 필드만 다시 묻는다. 질문 본문 형식은 어댑터 규약을 따른다.

### 시각형 매트릭스

어댑터 규약의 `visualNode` 분기를 쓴다. v1 은 markdown 텍스트·monospace 표현이다(의존성 추가 없음). v2 SSR PNG 는 후속이다. 필드 경로는 노드가 만드는 값 기준이고, 렌더러가 읽는 순서는 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 을 본다. `chart`·`carousel` 행의 입력 필드(`payload.{title, series, labels}`, 카드 이미지 URL)는 노드 출력과 정의가 갈린다. [미결 사항](#미결-사항) 참조.

| 노드 유형 | `text`(v1·v2) | `photo` v1 | `photo` v2 | `auto` v1 | `auto` v2 |
|---|---|---|---|---|---|
| `chart` | `output.payload.{title, series, labels}` → monospace 미니 막대 차트(markdown code block, 2000자 분할) | 텍스트로 대신(warning 로그) | satori SVG → PNG 첨부 | 텍스트(수치 가독성 우선) | 텍스트 |
| `carousel` | `output.items[]` → 카드마다 굵은 제목과 설명을 하나로 이어 붙인다(`renderVisualFallback`). 이미지 URL 무시, 카드 10장 상한 | `auto` v1 로 대신 | 5장 collage PNG 첨부 1회 | 미구현. 계획은 카드별 이미지 URL 이 있으면 `embeds: [{image: {url: imageUrl}}]`(제목·설명 embed 필드), 없으면 평문 content. 현재는 `text` 와 같다(embeds 호출처 없음) | 카드별 분기와 5장 collage PNG |
| `table` | `output.{rows, columns}` → markdown code block monospace 표(열 정렬, 행 20개 상한, 16자 넘는 셀 말줄임, 2000자 분할) | 텍스트로 대신 | 표 PNG 첨부 | 텍스트(정밀도 우선) | 텍스트 |
| `template` | `output.rendered` 평문 → `POST /messages`(2000자 분할). HTML 은 보내지 않는다 | 텍스트로 대신 | HTML → SSR PNG | 텍스트 | HTML → SSR PNG |

- **Embed 활용(계획)**: Discord embed 는 title·description·fields·image·color 를 지원하지만 fields 의 inline·길이 제약 때문에 Chart·Table 의 monospace 표현은 평문 content 가 더 읽기 쉽다. Carousel 카드는 embed 가 더 어울린다. `auto` 에서 이미지 URL 이 있으면 embed 를 쓰는 것은 미구현이고 현재 모든 시각형은 markdown 텍스트다.
- **버튼**: 모든 시각형에서 `buttonConfig.buttons[]` 가 있으면 시각 메시지 다음 메시지로 ACTION_ROW 를 보내거나 마지막 메시지의 `components` 에 붙인다.
- **옛 `text_only`**: 읽을 때 `"text"` 로 바꾼다.

### 실행 실패

`execution.failed` 는 어댑터 규약의 `classifyExecutionFailure(event)` 결과로 문구를 찾아 채운 뒤 `POST /channels/{id}/messages` 한 번(평문)으로 보낸다. 민감 정보 제외는 [채팅 채널](CLE-CHAT-CORE.md) 의 CCH-ERR-03 을 따른다.

| 항목 | Discord 매핑 |
|---|---|
| API 호출 | `POST https://discord.com/api/v10/channels/{channel_id}/messages` 1회 |
| 본문 | `content` = `languageHints[key]` 에 `{statusCode}` 를 채운 결과. markdown 문법(`**__~~` 등)을 피한 평문이고 `embeds` 는 붙이지 않는다 |
| `components` | 붙이지 않는다(종결 이벤트라 인터랙션 컨트롤이 없다) |
| `message_reference` | 붙이지 않는다(DM 전용, R-D-4) |
| Interactions ack | 관계없다. 서버가 먼저 보내는 메시지라 3초 ack 규약과 별개다 |
| 타임아웃·재시도 | 5초 타임아웃, 총 3회 시도. 끝내 실패하면 `degraded` |

## 보안

- 봇 토큰(Discord [`Bot <token>`](https://discord.com/developers/docs/reference#authentication) 형식)은 `botTokenRef`(`secret://triggers/{id}/bot-token`)만 설정에 둔다. 평문 저장은 금지다(CCH-SE-03).
- **Application public key(ed25519)**: Discord [Interactions endpoint 검증](https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization)은 `X-Signature-Ed25519`·`X-Signature-Timestamp` 헤더와 raw body 를 application public key 로 검증한다. public key 는 사용자가 Developer Portal 에서 복사해 입력하고 `SecretResolver` 가 관리한다. 참조는 `secret://triggers/{id}/inbound-signing` 이다([시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 의 프로바이더 공통 슬롯).
  - 형식(Discord 발급 표준)은 `^[a-f0-9]{64}$`(소문자 hex 64자, ed25519 공개키 32바이트)다. 트리거 생성 때 `assertInboundSigningPlaintextByProvider`(`chat-channel-input-rules.ts`)가 검증하고 어기면 `400 VALIDATION_ERROR` 다. 대문자 hex 는 ed25519 검증 실패를 피하려고 미리 막는다.
  - public key 는 비밀이 아니라 공개키지만 교체, 워크스페이스 격리, 감사를 같은 흐름으로 다루려고 `SecretResolver` 로 관리한다(R-D-1).
  - 진입점이 raw body 와 두 헤더를 읽고 `SecretResolver.resolve(inboundSigningRef)` 뒤 ed25519 로 검증한다(Node.js `crypto.verify('ed25519', ...)`). 실패하면 `401 Unauthorized` 다. Discord 는 401 에 재시도하지 않는다.
- **설정 필드**: `inboundSigningRef` 는 Telegram·Slack 과 같은 슬롯이고 자원 성격과 검증 알고리즘은 백엔드가 프로바이더별로 나눈다([채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md)). Discord 는 Developer Portal 이 발급해 사용자가 직접 입력하는 프로바이더 발급 자료이고 자원은 ed25519 공개키(비대칭)다. `SetupResult.issuedInboundSigning` 은 채우지 않는다.
- **재전송 공격 차단**: `X-Signature-Timestamp` 가 현재 시각 ±5분 밖이면 `401`(Discord 권장).
- DM 밖 `channel.type` 은 진입점에서 `channel.type !== 1` 로 막고 `groupChatRefusal` 안내 뒤 버린다(CCH-CV-05).
- 봇 멤버(`member.user.bot === true`, DM `user.bot === true`)도 무시한다.

인바운드 HTTP 응답 정책은 [채팅 채널](CLE-CHAT-CORE.md) 의 인바운드 HTTP 응답 계약이 기준이다. Discord 예외는 두 가지다. (1) PING(`type: 1`)은 `200 OK + { type: 1 }` JSON 이 필수다. (2) Interactivity ack 는 3초 안에 `200 OK + { type: 5 | 6 }` 이고 `202` 를 인정하지 않는다. 두 예외는 [setupChannel](#setupchannel), [버튼](#버튼), [Form](#form) 에 적혀 있다.

## 명령 처리

| 사용자 입력 | 어댑터 처리 |
|---|---|
| `/<prefix> start`(활성 실행 없음) | 새 실행 시작, ack `{ type: 4, data: { content: languageHints.executionStarted } }` 나 deferred 뒤 후속 메시지 |
| `/<prefix> start`(활성 실행 있음) | 기존 실행을 취소(`cancel`)하고 새 실행 시작, "기존 대화를 종료하고 새로 시작합니다." [미결 사항](#미결-사항) 참조 |
| `/<prefix> cancel` | 활성 실행에 EIA `cancel`. 없으면 아무것도 하지 않고 "진행 중인 대화가 없습니다." |
| `/<prefix> help` | 봇 기본 도움말(v1 정적, `languageHints.help` 나 기본 문구). [미결 사항](#미결-사항) 참조 |
| `/<prefix> reply <message>` | 멀티턴 AI 진행 중이면 EIA `submit_message` |
| 모달 "Reply" 제출 | 멀티턴 AI 진행 중이면 EIA `submit_message` |
| 버튼 클릭 | EIA `click_button` |

DM 첫 메시지로 자동 시작하는 것(Telegram `/start` 와 같은 뜻)은 v1 에서 지원하지 않는다. Discord 는 Gateway `MESSAGE_CREATE` 없이 DM 텍스트를 받지 못하므로 사용자가 `/workflow start` 를 직접 입력해야 한다(R-D-3 의 v1 한계).

## 비기능

- `POST /channels/{id}/messages` 는 5초 타임아웃과 지수 백오프로 총 3회 시도한다. 대기는 1초, 2초 두 번이다. 끝내 실패하면 `chat_channel_health` 를 `degraded` 로 바꾼다.
- Discord [Rate limits](https://discord.com/developers/docs/topics/rate-limits): 봇당 전역 초당 50건과 경로별 bucket(응답 헤더 `X-RateLimit-Bucket`·`X-RateLimit-Remaining`·`X-RateLimit-Reset-After`)이 있다. `429 Too Many Requests` 의 `Retry-After` 는 따른다(구현됨). bucket 단위 큐와 응답 헤더 기반 throttle 은 미구현이다.
- `interaction.id` 중복 제거는 구현됐다(2026-08-13). 같은 id 가 30초 안에 다시 오면 무시한다(Discord 는 3회까지 재전송한다). 파서가 채운 `idempotencyKey = interaction.id`(snowflake, 재전송 때 같다)를 `ChatChannelDedupService` 가 Redis `SET NX EX 30`, 키 `cc:dedup:<triggerId>:<interactionId>` 로 인바운드 진입의 분당 한도 앞에서 거른다. Redis 가 없으면 통과시킨다. 키·TTL·게이트 순서는 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 이 정한다.

## 미결 사항

- **활성 실행 중 `/start`**: 이 문서의 명령 처리 표는 활성 실행이 있어도 `/start` 면 기존 실행을 취소하고 새로 시작한다고 정한다. [채팅 채널](CLE-CHAT-CORE.md) 의 CCH-CV-03 은 `/start` 예외가 없다. 결정 필요.
- **help 명령 경로**: 명령 매핑은 `help` 하위 명령을 어댑터가 바로 답한다고 적지만, `ChannelUpdate` 에 help kind 가 없고 현재 구현은 파서가 `null` 을 돌려준다. `HooksService` 의 도움말 분기는 텍스트가 정확히 `/help` 일 때만 탄다. [Slack 어댑터](CLE-CHAT-SLACK.md) 에도 같은 문제가 있다. help 를 정식 kind 로 둘지 결정 필요.
- **Chart·Carousel 입력 모양**: 매트릭스의 Chart 입력(`output.payload.{title, series, labels}`)과 Carousel 카드 이미지 URL 이 [Chart 노드](../CLE-NODE-PRES/CLE-NODE-CHART.md)·[Carousel 노드](../CLE-NODE-PRES/CLE-NODE-CAROUSEL.md) 출력과 다르다. [Presentation 노드 공통 §미결 사항](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md#미결-사항) 과 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md#미결-사항) 의 미결 사항과 함께 결정 필요.

## 구현 위치

- `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts`
- `codebase/backend/src/modules/chat-channel/providers/discord/discord-client.ts`
- `codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.ts`
- `codebase/backend/src/modules/chat-channel/providers/discord/discord-signing.ts`
- `codebase/backend/src/modules/chat-channel/providers/discord/discord-update.parser.ts`
- `codebase/backend/src/modules/chat-channel/providers/discord/discord.types.ts`
- `codebase/backend/src/modules/chat-channel/chat-channel-inbound-authenticator.ts`
- `codebase/backend/src/modules/hooks/hooks.service.ts`, `hooks.controller.ts`
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

### R-D-2 setupChannel 에서 slash command 를 일괄 덮어쓴다

`PUT /applications/{app_id}/commands` 일괄 덮어쓰기로 멱등을 보장한다(`setupChannel` 의무). 기존 명령과 새 명령의 차이를 계산할 필요가 없다. 개별 `POST` 와 조회 뒤 diff 는 race 위험과 코드 복잡도가 크고, 사용자 수동 등록은 UX 부담이 크고 봇별 명령 일관성을 보장할 수 없다. Discord 일괄 덮어쓰기 API 자체가 멱등을 위해 만들어져 setup 과 자연스럽게 맞는다.

### R-D-3 v1 은 Interactions Webhook 만, Gateway 는 v2

무상태 HTTP 인 Interactions Webhook 을 택한다. slash command·버튼·모달 위주 UX 는 Discord 가 권장하는 현대적 봇 패턴이다. Gateway WebSocket 은 봇마다 오래 유지되는 연결, heartbeat 관리, 큰 봇의 shard 라우팅, 여러 인스턴스 환경의 연결 라우팅 인프라가 필요해 v2 로 미룬다. v1 제약의 결과는 다음과 같다.

- 자유 텍스트 DM 메시지를 받지 못한다(`MESSAGE_CREATE` 없음).
- 멀티턴 AI 답장은 (a) `/workflow reply <message>` text option 이나 (b) 모달 TEXT_INPUT 으로 표현한다.
- DM 첫 메시지 자동 시작을 지원하지 않는다. `/workflow start` 를 입력해야 한다.
- `file_upload` 도 v1 에서 지원하지 않는다. Discord 파일 업로드는 Gateway 메시지 첨부에 기반한다.

Gateway 도입은 사용자 요청이 있을 때 v2 후보로 진입한다.

### R-D-4 DM 만 받고 guild 채널은 거부한다

v1 정책(CCH-CV-05)과 맞다. guild 채널은 여러 사용자가 있어 대화 매핑이 깨진다. guild 봇 UX 는 v2 여러 사용자 대화와 함께 간다.

### R-D-5 custom_id 에 buttonId UUID 를 그대로 넣는다

`custom_id` 한도 100자 안에 UUID v4(36자)가 넉넉히 들어가 별도 매핑 테이블이 필요 없다. 짧은 id 와 Redis 매핑은 과한 설계이고, executionId 같은 추가 메타는 채널 대화 상태에서 보강할 수 있으므로 `custom_id` 에는 buttonId 만 넣는다. Telegram R2 와 같은 결론이다.

### R-D-6 Form 은 텍스트 계열이고 필드 5개 이하면 모달, 그 밖은 다단계

Discord MODAL(TEXT_INPUT 요소)을 네이티브 폼으로 택한다. 어댑터 규약 R-CCA-8 에 따라 `formMode ∈ {auto, native_modal}`, 필드 5개 이하, 모든 필드가 텍스트 계열이면 모달 하나로 받는다. TEXT_INPUT 만 받는 제약 때문에 텍스트 계열 폼으로 한정되고, 모달은 interaction 응답(type 9)이라 버튼(`__open_form__` 클릭 → MODAL 응답)으로 토큰을 얻는다. SELECT_MENU 를 모달에 넣을 수 없는 플랫폼 제약 때문에 select·checkbox 같은 타입을 포함하거나 필드가 6개 이상이면 요소 기반 다단계 질문으로 받는다.

### R-D-7 v1 에서 file 필드는 사실상 지원하지 않는다

v1 Interactions Webhook 전용(R-D-3)의 결과다. Discord 파일 업로드는 Gateway `MESSAGE_CREATE` 첨부로만 가능하다. 우회로는 외부 저장소 URL 을 텍스트로 받는 방식이다(`text` 필드와 `validation.pattern` 의 URL 정규식). Form 의 `file` 타입 자체는 바꾸지 않고 Discord 프로바이더만 v1 한계로 대체한다. 사용자가 Discord 프로바이더와 file 필드를 함께 쓰면 노드 정의 검증 단계에서 경고를 보여 준다.

### R-D-8 PING 과 Interactivity 는 200 OK 로 답한다

Slack R-S-8 과 같은 생각이다. Discord 의 두 경우(PING, Interactivity ack)만 [채팅 채널](CLE-CHAT-CORE.md) 인바운드 응답 계약의 `202` 정책에 대한 명시적 예외다.

### R-D-9 file 필드 한계는 프로바이더 문서에 적고 Form 은 바꾸지 않는다

Form 의 `file` 추상화는 그대로 두고 Discord 프로바이더만 v1 구현 한계로 지원하지 않는다. Form 에 `unsupportedProviders: ["discord"]` 같은 필드를 더하면 Form 이 프로바이더 한계를 알아야 하는 의존성 역전이 생긴다. file 필드를 자동으로 외부 저장소 URL 입력으로 바꾸면 사용자 의도와 다르게 동작해 헷갈린다. 추상화를 앞세우고 프로바이더 한계는 프로바이더 문서의 Rationale 에 적으며, 구현 단계에서 경고 UI 로 안내한다.
