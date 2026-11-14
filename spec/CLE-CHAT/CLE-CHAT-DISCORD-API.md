---
id: "CLE-CHAT-DISCORD-API"
title: "Discord 어댑터 — API 호출과 UI 매핑"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT-DISCORD"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT", "CLE-CHAT-DISCORD"]
area: "CLE-CHAT"
content_hash: "65c03a2679fdf71ccffb92a561affd6e515d39a89f6eab790729617314b74c7a"
read_as: "approved_fallback"
task: "CLE-T-FQTQ7K"
source_paths: []
mirror_sha256: "6e0d6f98ed99c462f554f29a49ad5ac6799f34f2ed307ef96ad05e3d0474e673"
etag: "sha256-f2f2101da7aae8c0ba58f92ce67996f4a273e3e5476f485419bf7b33cadd0b67"
---
## 개요

이 문서는 [Discord 어댑터](CLE-CHAT-DISCORD.md) 의 하위 문서로 어댑터 함수와 Discord REST·Interactions API 의 대응, `setupChannel`·`teardownChannel`, 네이티브 모달, 발송 본문의 멘션 알림 차단, 노드별 UI 매핑, 발송 재시도·rate limit·중복 제거를 정한다. 인터랙션을 해석하고 웹훅 HTTP 응답으로 답하는 쪽은 [Discord 어댑터 — 인바운드 처리와 응답](CLE-CHAT-DISCORD-INBOUND.md) 이 정한다.

Rationale 의 R-D-1·R-D-3·R-D-4 는 [Discord 어댑터](CLE-CHAT-DISCORD.md#rationale), R-D-8·R-D-10·R-D-11·R-D-12 는 [Discord 어댑터 — 인바운드 처리와 응답](CLE-CHAT-DISCORD-INBOUND.md#rationale) 에 있다.

## REST와 Interactions 호출 매핑

| 어댑터 함수 | Discord API |
|---|---|
| `setupChannel` | (a) [`GET /applications/@me`](https://discord.com/developers/docs/resources/application)로 application identity 캐시(id, name, `verify_key` → `botIdentity.publicKey`). 응답 `verify_key` 와 사용자 입력 public key(`inboundSigningRef`)를 교차 확인하고 다르면 `BOT_TOKEN_INVALID`. (b) [`PUT /applications/{app_id}/commands`](https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands)로 slash command 일괄 덮어쓰기(`/<prefix>` 와 하위 옵션). 등록이 실패(`ok: false`)하면 `setupChannel` 도 실패한다(HTTP 401·403 이면 `BOT_TOKEN_INVALID`, 그 밖은 `code` 없는 에러) |
| `teardownChannel` | `PUT /applications/{app_id}/commands` 에 `[]`. 실패해도 막지 않는다([teardownChannel](#teardownchannel)) |
| `parseUpdate` | Interactions Webhook payload(`type ∈ {1, 2, 3, 5}`: PING, APPLICATION_COMMAND, MESSAGE_COMPONENT, MODAL_SUBMIT) → `ChannelUpdate` |
| `sendMessage`(text) | [`POST /channels/{channel_id}/messages`](https://discord.com/developers/docs/resources/channel#create-message)(content). DM 채널은 먼저 [`POST /users/@me/channels`](https://discord.com/developers/docs/resources/user#create-dm)로 만들고 channel_id 를 캐시한다 |
| `sendMessage`(buttons) | `POST /channels/{id}/messages` + `components: [{type: 1, components: [{type: 2, ...}]}]`(ACTION_ROW 와 BUTTON) |
| `sendMessage`(form_prompt) | 다단계 질문. 평문 content 와 "Reply" 버튼 → 단일 TEXT_INPUT 모달 |
| `sendMessage`(form_modal) | `POST /channels/{id}/messages` + "양식 작성하기" 버튼(`custom_id: "__open_form__"`). 클릭하면 `HooksService` 가 `openFormModal` 에서 interaction HTTP 응답 `{ type: 9, data: <modal> }` 로 TEXT_INPUT N개 모달을 연다 |
| `sendMessage`(image) | 현재 v1 은 `content` 에 caption(없으면 `fallbackText`)만 보내고 이미지는 첨부하지 않는다. `attachments` multipart 업로드나 `embeds: [{image: {url}}]` 는 미구현 |
| `sendMessage`(typing) | [`POST /channels/{channel_id}/typing`](https://discord.com/developers/docs/resources/channel#trigger-typing-indicator). 10초 유지 뒤 자동 만료 |
| `ackInteraction` | 빈 구현이다. 3초 안 Interactions 응답은 웹훅 HTTP 응답이 맡는다([인바운드 응답](CLE-CHAT-DISCORD-INBOUND.md#인바운드-응답)). [`PATCH /webhooks/{app_id}/{interaction_token}/messages/@original`](https://discord.com/developers/docs/interactions/receiving-and-responding#edit-original-interaction-response)(15분 유효, 5회 한도)은 지금 부르지 않는다 |
| `defaultInteractionResponse` | API 를 부르지 않는다. 원본 본문의 `type` 과 하위 명령 이름으로 3초 기본 응답 본문을 만든다(`buildDiscordDefaultInteractionResponse`). 컴포넌트·모달 제출은 `{ type: 6 }`, 슬래시 명령은 본인에게만 보이는 `{ type: 4 }`, 그 밖은 응답 없음([인바운드 응답](CLE-CHAT-DISCORD-INBOUND.md#인바운드-응답)) |
| `ackDroppedUpdate` | 구현하지 않는다. 버린 인터랙션도 3초 응답이 수신 확인이다 |
| `openFormModal` | `__open_form__`·`__reply__` 클릭 때 웹훅 HTTP 응답 본문 `{ type: 9, data: <modal> }`(MODAL)을 만든다. `__open_form__` 은 `clemvion_form` 폼 모달, `__reply__` 는 `clemvion_reply` 답장 모달이다([MODAL](#modal)) |

`POST /channels/{channel_id}/messages` 를 부르는 행은 모두 본문에 `allowed_mentions: {"parse": []}` 를 넣는다([멘션 무력화](#멘션-무력화)).

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

`GET /applications/@me` 와 명령 일괄 등록의 결과는 클라이언트가 돌려준 `ok: false` 로 판정한다([채팅 채널 어댑터 규약 「클라이언트 실패 판정」](CLE-CHAT-ADAPTER.md#클라이언트-실패-판정)). 둘 중 하나라도 실패하면 `setupChannel` 이 실패 사유를 담은 에러를 던진다. HTTP 401·403 이면 `code: 'BOT_TOKEN_INVALID'` 를 싣고 그 밖의 실패는 `code` 없는 에러다. 호출자는 `code` 없는 에러를 일반 실패로 다룬다(봇 토큰 재발급이면 `502 CHAT_CHANNEL_SETUP_FAILED`). 명령 등록 결과를 보지 않으면 slash command 가 없는 봇이 정상 설정으로 보인다.

Interactions Endpoint URL 은 Developer Portal 의 application 정적 설정이라 어댑터가 API 로 등록·해제하지 않는다. 사용자 가이드가 `${BASE_URL}/api/hooks/${trigger.endpointPath}` 입력을 안내한다(Slack R-S-2 와 같은 생각).

PING(`type: 1`) 핸드셰이크 응답과 트리거·워크플로우 활성 관문의 관계는 [Discord 어댑터 — 인바운드 처리와 응답 「PING 핸드셰이크」](CLE-CHAT-DISCORD-INBOUND.md#ping-핸드셰이크) 가 정한다.

### teardownChannel

```text
PUT https://discord.com/api/v10/applications/{app_id}/commands
Authorization: Bot {botToken}
Body: []
```

부분 실패해도 트리거 삭제를 막지 않는다. 명령 해제 호출이 실패(`ok: false`)하면 경고 로그만 남긴다. 남은 명령은 같은 애플리케이션으로 새 트리거를 만들 때 setup 이 새 명령으로 덮어쓴다. Interactions Endpoint URL 은 우리 쪽에서 해제할 수 없어 사용자가 portal 에서 직접 비워야 한다(사용자 가이드 안내).

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

### 멘션 무력화

Discord 로 보내는 메시지는 본문 글자를 바꾸지 않는다. 대신 [`allowed_mentions`](https://discord.com/developers/docs/resources/message#allowed-mentions-object) 를 `{"parse": []}` 로 붙여 멘션 알림을 막는다.

- **채널 메시지**: 클라이언트(`discord-client.ts`)의 `postChannelMessage` 가 `POST /channels/{channel_id}/messages` 본문에 늘 `allowed_mentions: {"parse": []}` 를 넣는다. 그래서 text · buttons · form_prompt · form_modal 버튼 메시지 · image 대체 텍스트 · 실행 실패 안내까지 모든 채널 발송이 대상이다.
- **인터랙션 응답 본문**: `content` 를 싣는 `{ type: 4 }` 응답의 `data` 에도 같은 값을 넣는다. 슬래시 명령의 즉시 응답(`buildDiscordDefaultInteractionResponse`)과 Form 제출 결과(`buildFormSubmissionResponse` 의 검증 실패 안내와 제출 완료 안내)가 여기에 든다. 이 응답 본문의 정본은 [Discord 어댑터 — 인바운드 처리와 응답 「인바운드 응답」](CLE-CHAT-DISCORD-INBOUND.md#인바운드-응답) 이다.
- **붙이지 않는 응답**: 컴포넌트와 모달 제출에 답하는 `{ type: 6 }` 은 메시지를 싣지 않아 붙이지 않는다. 모달을 여는 `{ type: 9 }` 도 메시지가 아니라서 붙이지 않는다.

`parse` 가 빈 배열이면 멘션은 화면에 그대로 보이지만 `@everyone` · `@here` · 사용자 멘션(`<@id>`) · 역할 멘션(`<@&id>`)의 알림은 가지 않는다. markdown 서식과 링크도 그대로 된다. 워크플로우 작성자가 일부러 넣은 멘션도 알림이 가지 않는다. 채팅 채널 공통 의무는 [채팅 채널 어댑터 규약 — 이벤트 렌더와 실패 안내 「멘션 무력화」](CLE-CHAT-ADAPTER-RENDER.md#멘션-무력화) 가 정하고 근거는 [Rationale](#rationale) 에 있다.

## 노드 UI 매핑

### 멀티턴 AI

아웃바운드는 CCH-MP-01 을 모두 만족한다.

- `execution.ai_message.message` 를 `POST /channels/{id}/messages`(content, 평문 markdown)로 보낸다. Discord 는 자체 markdown 을 지원해 escape 하지 않는다. 멘션 알림은 `allowed_mentions: {"parse": []}` 로 막는다([멘션 무력화](#멘션-무력화)).
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
- MESSAGE_COMPONENT 가 오면 다음 순서로 처리한다. (1) EIA `click_button` 요청을 큐에 넣는다. 처리는 기다리지 않는다. (2) 3초 안에 웹훅 HTTP 응답으로 `200 OK + { type: 6 }` 을 돌려준다. 클릭을 버린 경로도 같은 응답이다([인바운드 응답](CLE-CHAT-DISCORD-INBOUND.md#인바운드-응답)). (3) 중복 클릭을 막으려고 `PATCH /webhooks/{app_id}/{token}/messages/@original` 에 `components: []` 나 비활성 상태를 보내는 것은 선택이고 지금은 하지 않는다.

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

어댑터 규약의 `visualNode` 분기를 쓴다. v1 은 markdown 텍스트·monospace 표현이다(의존성 추가 없음). v2 SSR PNG 는 후속이다. 필드 경로는 노드가 만드는 값 기준이고, 렌더러가 읽는 순서는 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 을 본다. `chart`·`carousel` 행의 입력 필드(`payload.{title, series, labels}`, 카드 이미지 URL)는 노드 출력과 정의가 갈린다. [미결 사항](CLE-CHAT-DISCORD.md#미결-사항) 참조.

| 노드 유형 | `text`(v1·v2) | `photo` v1 | `photo` v2 | `auto` v1 | `auto` v2 |
|---|---|---|---|---|---|
| `chart` | `output.payload.{title, series, labels}` → monospace 미니 막대 차트(markdown code block, 2000자 분할) | 텍스트로 대신(warning 로그) | satori SVG → PNG 첨부 | 텍스트(수치 가독성 우선) | 텍스트 |
| `carousel` | `output.items[]` → 카드마다 굵은 제목과 설명을 하나로 이어 붙인다(`renderVisualFallback`). 이미지 URL 무시, 카드 10장 상한 | `auto` v1 로 대신 | 5장 collage PNG 첨부 1회 | 미구현. 계획은 카드별 이미지 URL 이 있으면 `embeds: [{image: {url: imageUrl}}]`(제목·설명 embed 필드), 없으면 평문 content. 현재는 `text` 와 같다(embeds 호출처 없음) | 카드별 분기와 5장 collage PNG |
| `table` | `output.{rows, columns}` → markdown code block monospace 표(열 정렬, 행 20개 상한, 16자 넘는 셀 말줄임, 2000자 분할) | 텍스트로 대신 | 표 PNG 첨부 | 텍스트(정밀도 우선) | 텍스트 |
| `template` | `output.rendered` 평문 → `POST /messages`(2000자 분할). escape 하지 않고 멘션 알림은 `allowed_mentions: {"parse": []}` 로 막는다([멘션 무력화](#멘션-무력화)). HTML 은 보내지 않는다 | 텍스트로 대신 | HTML → SSR PNG | 텍스트 | HTML → SSR PNG |

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

## 비기능

- `POST /channels/{id}/messages` 는 5초 타임아웃과 지수 백오프로 총 3회 시도한다. 대기는 1초, 2초 두 번이다. 끝내 실패하면 `chat_channel_health` 를 `degraded` 로 바꾼다.
- 클라이언트(`discord-client.ts`)는 실패를 `ok: false` 로 돌려준다. 4xx 실패에는 Discord 응답 본문(원본 숫자 `code` 포함)과 HTTP `status` 가 함께 실린다. 재시도를 다 쓴 합성 실패(fetch 예외, 429 소진, 5xx)에는 `message` 만 있다. 어댑터는 `ok: false` 로 실패를 판정하고 원본 숫자 `code` 로는 판정하지 않는다([채팅 채널 어댑터 규약 「클라이언트 실패 판정」](CLE-CHAT-ADAPTER.md#클라이언트-실패-판정)). 발송이 실패하면 어댑터가 에러를 던지고 호출자가 건강도를 `degraded` 로 바꾼다. typing 은 UX 전용이라 실패해도 경고 로그만 남긴다.
- Discord [Rate limits](https://discord.com/developers/docs/topics/rate-limits): 봇당 전역 초당 50건과 경로별 bucket(응답 헤더 `X-RateLimit-Bucket`·`X-RateLimit-Remaining`·`X-RateLimit-Reset-After`)이 있다. `429 Too Many Requests` 의 `Retry-After` 는 따른다(구현됨). bucket 단위 큐와 응답 헤더 기반 throttle 은 미구현이다.
- `interaction.id` 중복 제거: 같은 id 가 30초 안에 다시 오면 무시한다(Discord 는 3회까지 재전송한다). 파서가 채운 `idempotencyKey = interaction.id`(snowflake, 재전송 때 같다)를 `ChatChannelDedupService` 가 Redis `SET NX EX 30`, 키 `cc:dedup:<triggerId>:<interactionId>` 로 인바운드 진입의 분당 한도 앞에서 거른다. Redis 가 없으면 통과시킨다. 키·TTL·게이트 순서는 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 이 정한다. 파서가 키를 채우는 규칙은 [Discord 어댑터 — 인바운드 처리와 응답 「명령 매핑」](CLE-CHAT-DISCORD-INBOUND.md#명령-매핑) 에 있다.

## 구현 위치

이 문서가 정한 멘션 무력화의 구현 위치만 여기 둔다. 나머지는 [Discord 어댑터 「구현 위치」](CLE-CHAT-DISCORD.md#구현-위치) 에 있다.

- `codebase/backend/src/modules/chat-channel/providers/discord/discord.types.ts`: 멘션 알림을 모두 끄는 상수 `DISCORD_ALLOWED_MENTIONS_NONE`
- `codebase/backend/src/modules/chat-channel/providers/discord/discord-client.ts`: `postChannelMessage` 가 본문에 `allowed_mentions` 를 넣는다
- `codebase/backend/src/modules/chat-channel/providers/discord/discord-interaction-response.ts`: 슬래시 명령 즉시 응답(`{ type: 4 }`)의 `data.allowed_mentions`
- `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts`: Form 제출 결과 응답(`buildFormSubmissionResponse`, `{ type: 4 }`)의 `data.allowed_mentions`

## Rationale

### R-D-2 setupChannel 에서 slash command 를 일괄 덮어쓴다

`PUT /applications/{app_id}/commands` 일괄 덮어쓰기로 멱등을 보장한다(`setupChannel` 의무). 기존 명령과 새 명령의 차이를 계산할 필요가 없다. 개별 `POST` 와 조회 뒤 diff 는 race 위험과 코드 복잡도가 크고, 사용자 수동 등록은 UX 부담이 크고 봇별 명령 일관성을 보장할 수 없다. Discord 일괄 덮어쓰기 API 자체가 멱등을 위해 만들어져 setup 과 자연스럽게 맞는다.

### R-D-5 custom_id 에 buttonId UUID 를 그대로 넣는다

`custom_id` 한도 100자 안에 UUID v4(36자)가 넉넉히 들어가 별도 매핑 테이블이 필요 없다. 짧은 id 와 Redis 매핑은 과한 설계이고, executionId 같은 추가 메타는 채널 대화 상태에서 보강할 수 있으므로 `custom_id` 에는 buttonId 만 넣는다. Telegram R2 와 같은 결론이다.

### R-D-6 Form 은 텍스트 계열이고 필드 5개 이하면 모달, 그 밖은 다단계

Discord MODAL(TEXT_INPUT 요소)을 네이티브 폼으로 택한다. 어댑터 규약 R-CCA-8 에 따라 `formMode ∈ {auto, native_modal}`, 필드 5개 이하, 모든 필드가 텍스트 계열이면 모달 하나로 받는다. TEXT_INPUT 만 받는 제약 때문에 텍스트 계열 폼으로 한정되고, 모달은 interaction 응답(type 9)이라 버튼(`__open_form__` 클릭 → MODAL 응답)으로 토큰을 얻는다. SELECT_MENU 를 모달에 넣을 수 없는 플랫폼 제약 때문에 select·checkbox 같은 타입을 포함하거나 필드가 6개 이상이면 요소 기반 다단계 질문으로 받는다.

### R-D-7 v1 에서 file 필드는 사실상 지원하지 않는다

v1 Interactions Webhook 전용(R-D-3)의 결과다. Discord 파일 업로드는 Gateway `MESSAGE_CREATE` 첨부로만 가능하다. 우회로는 외부 저장소 URL 을 텍스트로 받는 방식이다(`text` 필드와 `validation.pattern` 의 URL 정규식). Form 의 `file` 타입 자체는 바꾸지 않고 Discord 프로바이더만 v1 한계로 대체한다. 사용자가 Discord 프로바이더와 file 필드를 함께 쓰면 노드 정의 검증 단계에서 경고를 보여 준다.

### R-D-9 file 필드 한계는 프로바이더 문서에 적고 Form 은 바꾸지 않는다

Form 의 `file` 추상화는 그대로 두고 Discord 프로바이더만 v1 구현 한계로 지원하지 않는다. Form 에 `unsupportedProviders: ["discord"]` 같은 필드를 더하면 Form 이 프로바이더 한계를 알아야 하는 의존성 역전이 생긴다. file 필드를 자동으로 외부 저장소 URL 입력으로 바꾸면 사용자 의도와 다르게 동작해 헷갈린다. 추상화를 앞세우고 프로바이더 한계는 프로바이더 문서의 Rationale 에 적으며, 구현 단계에서 경고 UI 로 안내한다.

### 멘션 알림은 escape 하지 않고 allowed_mentions 로 막는다 (2026-11-14)

**배경**: Template 본문과 AI 응답(`execution.ai_message`)에는 `{{ }}` 표현식이나 LLM 응답을 거쳐 사용자 입력이 섞일 수 있다. 그 안의 `@everyone` · `@here` · `<@id>` · `<@&id>` 는 멘션 알림을 울린다. 그런데 렌더러는 두 본문을 그대로 보냈다(NERV Task `CLE-T-FQTQ7K`).

**결정**: 2026-11-14 사람 결정이다(NERV 질문 `01a1d93a-a9dc-76d5-95a0-21a4753b0c50` 의 선택지 1). Discord 는 본문을 escape 하지 않고 모든 발송에 `allowed_mentions: {"parse": []}` 를 붙인다. 대가로 워크플로우 작성자가 일부러 넣은 멘션도 알림이 가지 않는다. 사람이 이 대가를 받아들였다.

**escape 대신 `allowed_mentions` 를 쓰는 이유**: escape 는 본문 글자를 바꾼다. 예를 들어 `@` 뒤에 zero-width space 를 넣으면 화면에는 같아 보여도 복사한 글자에 보이지 않는 문자가 섞인다. 사용자 · 역할 멘션(`<@id>` · `<@&id>`)까지 막으려면 문법마다 바꾸는 규칙을 따로 둬야 한다. `allowed_mentions` 는 글자를 그대로 두고 네 가지 멘션의 알림을 한 번에 막는다.

**모든 발송에 붙이는 이유**: 렌더러에서 메시지 종류마다 붙이면 새 메시지 종류나 새 발송 경로가 생길 때 빠질 수 있다. 채널 메시지는 모두 클라이언트의 `postChannelMessage` 를 거치므로 그 한 곳에서 보장한다. 인터랙션 응답 본문(`{ type: 4 }`)은 이 함수를 거치지 않고 웹훅 HTTP 응답으로 나가므로 응답을 만드는 두 곳에 따로 넣는다. `{ type: 6 }` 과 `{ type: 9 }` 응답에는 메시지가 없어 붙일 곳이 없다. 클라이언트와 응답을 만드는 함수 안에서 처리하므로 어댑터 함수와 렌더러 인터페이스는 더하지 않았다.

**기각한 대안**: Template 본문만 막고 AI 응답은 후속 작업으로 미루는 안과 `{{ }}` 치환값만 막는 안은 Slack 과 같은 이유로 기각했다([Slack 어댑터 — Web API 와 노드 UI 매핑 「Template 본문과 AI 응답을 escape 해 멘션을 막는다 (2026-11-14)」](CLE-CHAT-SLACK-OUTBOUND.md#template-본문과-ai-응답을-escape-해-멘션을-막는다-2026-11-14)).
