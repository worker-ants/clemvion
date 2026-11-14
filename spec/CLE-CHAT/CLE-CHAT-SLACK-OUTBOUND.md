---
id: "CLE-CHAT-SLACK-OUTBOUND"
title: "Slack 어댑터 — Web API 와 노드 UI 매핑"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT-SLACK"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT", "CLE-CHAT-SLACK"]
area: "CLE-CHAT"
content_hash: "1e66aed3bb57a9769addabfb7532ad247f692fed9d6dafb056ca54866d0b0339"
read_as: "approved_fallback"
task: "CLE-T-FQTQ7K"
source_paths: []
mirror_sha256: "e7da7d456d6811129c605ecd400cd5fe2d489dda5352e51ec906360624edb82f"
etag: "sha256-90ab42e3645cd60bef4d64e5a9be2432b77f2156afe1b306b62217c8b37fc171"
---
## 개요

이 문서는 [Slack 어댑터](CLE-CHAT-SLACK.md) 의 하위 문서로 어댑터 함수별 Slack Web API 호출, `setupChannel` · `teardownChannel` · `views.open` 세부, 노드별 Slack UI 매핑, 발송 비기능을 정한다.

## Web API 호출 매핑

| 어댑터 함수 | Slack API |
|---|---|
| `setupChannel` | (a) [`POST /api/auth.test`](https://api.slack.com/methods/auth.test)로 bot identity 캐시. (b) Events API Request URL 은 Slack 앱 manifest 설정이라 어댑터는 URL Verification(`type: "url_verification"`) 응답만 보장한다. (c) signing secret 은 사용자가 앱 설치 단계에서 받아 따로 입력한다. 어댑터가 발급하지 않는다 |
| `teardownChannel` | 외부 호출 없음. Request URL 은 우리 쪽에서 해제할 수 없다. 봇 토큰 revoke(`auth.revoke`)는 봇 토큰 재발급 흐름의 책임이다 |
| `parseUpdate` | Events API(`event_callback` envelope), Interactivity(`payload=<URL-encoded JSON>`, `block_actions`·`view_submission`), Slash Commands(`application/x-www-form-urlencoded`) → `ChannelUpdate` |
| `sendMessage`(text) | [`POST /api/chat.postMessage`](https://api.slack.com/methods/chat.postMessage)(channel, text). `mrkdwn` 파라미터는 보내지 않고 Slack 기본값(`mrkdwn=true`)을 쓴다 |
| `sendMessage`(buttons) | `chat.postMessage` + `blocks: [{type: "actions", elements: [{type: "button", ...}]}]` |
| `sendMessage`(form_prompt) | `chat.postMessage` + 선택 `blocks: [{type: "input", ...}]` 로 필드 하나 안내(다단계 질문) |
| `sendMessage`(form_modal) | `chat.postMessage` + `actions` 블록의 `action_id: "__open_form__"` 버튼("양식 작성하기"). 클릭하면 `HooksService` 가 `openFormModal` 에서 [`POST /api/views.open`](https://api.slack.com/methods/views.open)으로 모달을 연다 |
| `sendMessage`(image) | [`POST /api/files.uploadV2`](https://api.slack.com/methods/files.uploadV2)(channel_id, file, filename, initial_comment=caption)로 PNG 업로드(구현됨, `client.filesUploadV2`). 실패하면 caption·`fallbackText` 를 `chat.postMessage` 텍스트로 보낸다 |
| `sendMessage`(typing) | 없음. Slack Web API 에 서버가 보내는 typing 표시가 없다(R-S-5) |
| `ackInteraction` | 인터랙션 후처리. `button_callback` 이고 `response_url` 이 있으면 [`response_url`](https://api.slack.com/interactivity/handling#message_responses) 에 `replace_original: true` 로 POST 해 원본 메시지를 «선택 완료» 문구로 바꾼다. 실패는 로그만 남긴다. 3초 안 수신 확인은 웹훅 HTTP 응답이 맡는다([「Interactivity」](CLE-CHAT-SLACK-INBOUND.md#interactivity)) |
| `defaultInteractionResponse` | API 를 부르지 않는다. Interactivity 는 `200` 빈 본문(`{}`), 슬래시 명령은 `200` 과 `{ response_type: 'ephemeral', text }` 를 낸다([「Interactivity」](CLE-CHAT-SLACK-INBOUND.md#interactivity) · [「Slash Commands」](CLE-CHAT-SLACK-INBOUND.md#slash-commands)). Events API 는 기본 응답이 없어 `202` 다. `url_verification` 은 기본 응답 없이 핸드셰이크 응답(`200 + { challenge }`)으로 답한다 |
| `ackDroppedUpdate` | 구현하지 않는다. 버린 update 도 웹훅 HTTP 응답이 수신 확인이다 |

### setupChannel

```text
POST https://slack.com/api/auth.test
Authorization: Bearer {botToken}
→ { ok: true, team_id, user_id, bot_id, url, team, user, ... }
// 자격 증명 거부: HTTP 200 + { ok: false, error: 'invalid_auth' | 'not_authed'
//                              | 'account_inactive' | 'token_revoked' | 'token_expired' }
//   Slack Web API 는 인증 실패도 200 으로 준다. 어댑터는 이것을 자격 증명 거부로 읽고
//   code: 'BOT_TOKEN_INVALID' 를 실어 던진다.
→ config.chatChannel.botIdentity = { botId: hashStringToInt(user_id ?? bot_id), username: (user ?? bot_id), teamId: team_id }
```

Slack 식별자(`user_id` `U…`, `bot_id` `B…`)는 문자열인데 `botIdentity.botId` 는 `number` 라서 `slack.adapter.ts` 의 `hashStringToInt` 로 결정적 정수로 바꿔 저장한다. Slack identity 의 실제 식별자는 `username` 과 `teamId` 이고 `botId` 는 키로 쓰지 않는다.

**자격 증명 거부 목록**: 위 다섯 값이 `BOT_TOKEN_INVALID` 판별의 전부이고 목록을 열어 두지 않는다. `ratelimited` 처럼 자격 증명과 무관한 값은 일부러 뺀다. "당신 토큰이 잘못됐다" 를 잘못 말하는 것이 `502`(그 밖의 실패)보다 나쁘다. 목록에 없는 값은 502 로 간다. 이 목록은 외부 API 응답이라 저장소 안에서 잴 수 없다. 늘리려면 Slack 이 문서화한 표준 auth 에러라는 근거를 대고 코드 상수(`slack.adapter.ts` 의 `SLACK_CREDENTIAL_REJECTED_ERRORS`)와 함께 늘린다. 한쪽만 바꾸면 판별이 조용히 갈린다. `token_expired` 는 통합 상태 사유(`Integration.status_reason`)의 `'token_expired'` 와 글자만 같고 다른 네임스페이스다([통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md)). 이쪽은 Slack API 응답 문자열이고 저쪽은 우리 DB 컬럼 값이다.

Events API Request URL 은 Slack 앱 manifest 에 미리 등록하는 값이라 어댑터가 API 로 등록·해제하지 않는다(R-S-2). 사용자는 manifest 의 `event_subscriptions.request_url` 을 `${BASE_URL}/api/hooks/${trigger.endpointPath}` 로 설정해 둬야 한다(사용자 가이드가 안내한다).

URL Verification(`type: "url_verification"`)은 Slack 이 Request URL 을 등록할 때 한 번 보낸다. `parseUpdate` 가 `null` 을 돌려주고 호출자가 `{ challenge: <받은 값> }` JSON 을 `200 OK` 로 답한다. `202` 고정 정책의 명시적 예외다([Slack 어댑터 「R-S-8」](CLE-CHAT-SLACK.md#r-s-8-url-verification-과-interactivity-는-200-ok-로-답한다)). 트리거가 활성이면 워크플로우가 비활성이어도 답한다(2026-10-10 사용자 결정). 워크플로우가 비활성인 채로 앱을 연결해도 Request URL 등록이 실패하지 않게 하려는 것이다. 관문은 트리거 활성 관문, 핸드셰이크 응답, …, 워크플로우 활성 관문 순서라 핸드셰이크 단계에서는 워크플로우 상태를 확인하지 않는다. 트리거가 비활성이면 challenge 를 돌려주지 않고 `202`·`{ executionId: 'ignored' }` 다([Slack 어댑터 「인바운드 응답」](CLE-CHAT-SLACK.md#인바운드-응답)).

### teardownChannel

어댑터는 외부 호출을 하지 않는다. 사용자가 Slack 앱을 워크스페이스에서 지우면 Events API 도 저절로 무효가 된다.

봇 토큰을 재발급하면 이전 토큰은 24시간 유예가 끝난 뒤 정리 작업이 [`POST /api/auth.revoke`](https://api.slack.com/methods/auth.revoke)로 무효화한다(R-S-11). 정리 작업은 `TriggersService.cleanupRotatedChatChannelTokens` 이고 `ChatChannelTokenRotatorService` 가 매시간 돌린다. 폐기 대상은 `bot-token.v2` 참조에 백업된 이전 토큰이다. 재발급(`TriggersService.rotateBotToken`) 시점에는 그 재발급으로 백업되는 이전 토큰을 무효화하지 않는다. 유예 안에 다시 재발급하면(A→B 뒤 유예 안에 B→C) `bot-token.v2` 의 A 가 B 로 덮이므로 덮인 A 는 재발급이 끝까지 성공한 뒤 `auth.revoke` 로 best-effort 폐기하고 실패해도 재발급은 성공으로 두고 경고 로그만 남긴다(NERV Task `CLE-T-6ZTPZ8`).

### views.open

[채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 네이티브 모달 경로의 Slack 구현이다. `form_modal` 버튼(`action_id: "__open_form__"`)을 누르면 `parseUpdate` 가 `open_form_modal`(openContext.triggerId)을 돌려주고 `HooksService` 가 `openFormModal` 에서 `block_actions` 의 `trigger_id`(3초 유효)로 곧바로 모달을 연다.

```text
POST https://slack.com/api/views.open
Authorization: Bearer {botToken}
{
  "trigger_id": "<block_actions payload 의 trigger_id>",
  "view": {
    "type": "modal",
    "callback_id": "clemvion_form",       // view_submission 분기용 고정 id
    "title": { "type": "plain_text", "text": "<폼 제목 또는 기본값>" },
    "submit": { "type": "plain_text", "text": "제출" },
    "blocks": [
      // formConfig.fields[] → input 블록. block_id = field.name
      { "type": "input", "block_id": "<field.name>", "label": {...},
        "element": { "type": "plain_text_input" | "static_select" | "datepicker" | "checkboxes", ... },
        "optional": !field.required }
    ]
  }
}
```

- **trigger_id 3초 제약**: `block_actions` 를 받은 직후 동기로 `views.open` 을 불러야 한다. 늦으면 `trigger_expired` 다. 사이에 EIA 같은 다른 I/O 를 끼우지 않는다.
- **필드 타입 → 요소**: [Form](#form) 의 표를 따른다.
- **view_submission**: 제출하면 `parseUpdate` 가 `payload.view.state.values` 를 `{ kind: "form_submission", fields }` 로 편다(다단계 질문과 달리 모든 필드를 한 번에 받는다).
- **검증 실패 재표시**: 서버 쪽 검증 실패(EIA `400 VALIDATION_ERROR` + `error.details[{field, message, code}]`) 때 `view_submission` 응답으로 `{ "response_action": "errors", "errors": { "<details[0].field>": "<details[0].message>" } }` 를 돌려준다. 모달이 닫히지 않고 그 필드에 에러가 보인다.

## 노드 UI 매핑

### 멘션 무력화

`execution.ai_message` 의 `message` 와 Template 본문(`execution.node.completed` 로 받은 `template` 노드의 `output.rendered`, `execution.ai_message.presentations[]` 의 `template`)은 [Slack 서식](https://api.slack.com/reference/surfaces/formatting) 규칙대로 `&` · `<` · `>` 를 `&amp;` · `&lt;` · `&gt;` 로 escape 한 뒤 보낸다(`escapeSlackMrkdwn`). 이 함수는 슬래시 명령 응답의 `text`([「Slash Commands」](CLE-CHAT-SLACK-INBOUND.md#slash-commands))와 안내 문구(`escapeControlText`)를 escape 할 때 쓰는 함수와 같다. 두 본문에는 `{{ }}` 표현식이나 LLM 응답을 거쳐 사용자 입력이 섞일 수 있다. escape 한 본문은 Slack 에서 다음과 같이 보인다.

- `<!channel>` · `<!here>` · `<@U…>` 같은 멘션 문법은 글자 그대로 보이고 알림이 울리지 않는다.
- `<https://example.com|라벨>` 같은 링크 문법도 글자 그대로 보인다.
- 꺾쇠 없이 쓴 URL 은 그대로 자동 링크가 되고 `*굵게*` · `_기울임_` 같은 서식도 그대로 된다.

워크플로우 작성자가 템플릿에 일부러 넣은 멘션과 링크 문법도 글자로 보인다. 링크가 필요하면 URL 을 꺾쇠 없이 쓴다.

3500자 분할은 escape 한 뒤에 한다. 3500자 조각 경계가 `&amp;` · `&lt;` · `&gt;` 의 가운데를 지나면 그 엔티티 앞에서 자른다. 채팅 채널 공통 의무는 [채팅 채널 어댑터 규약 — 이벤트 렌더와 실패 안내 「멘션 무력화」](CLE-CHAT-ADAPTER-RENDER.md#멘션-무력화) 가 정하고 근거는 [Rationale](#template-본문과-ai-응답을-escape-해-멘션을-막는다-2026-11-14) 에 있다.

### 멀티턴 AI

- `execution.ai_message.message` 를 `chat.postMessage` 로 보낸다(mrkdwn, [Slack 서식](https://api.slack.com/reference/surfaces/formatting) 규칙대로 `<`, `>`, `&` 만 escape). Template 본문에도 같은 escape 를 적용한다([멘션 무력화](#멘션-무력화)).
- 3500자에서 나눈다. `chat.postMessage.text` 의 권장 한도 4000자에서 500자 여유를 둔 값이다. 단어·문장 경계로 나누고 마지막 조각 전까지 `\n_(continued…)_` 를 붙인다. 조각 경계가 escape 결과의 가운데를 지나면 그 엔티티 앞에서 자른다.
- 응답 직전 typing 표시는 보내지 않는다(R-S-5).
- 사용자 DM 답장(`text_message`)은 EIA `submit_message` 로 보낸다.

### 버튼

- `buttonConfig.buttons[]` 를 Block Kit [`actions` 블록](https://api.slack.com/reference/block-kit/blocks#actions)의 `button` 요소 배열로 만든다. `uiMapping.buttonLayout` 에 따라 나눈다.
  - `auto`(기본): `actions` 블록 하나에 넣는다(요소 최대 25개, 라벨 길이 무관). Slack actions 블록은 행·열 개념 없이 클라이언트가 자동 줄바꿈한다.
  - `vertical`: 버튼마다 `section` 블록을 나누고 `accessory` 에 버튼 하나를 둔다.
  - `horizontal`: `auto` 와 같다(actions 블록이 본래 가로 흐름이다).
- 버튼 `value` 에 `buttonId`(UUID)를 넣는다. 한도 2000자라 여유가 있다.
- `style: 'primary'` 는 `style: "primary"`, `'danger'` 는 `style: "danger"`, 그 밖은 지정하지 않는다.
- 노드가 시각형이면 시각 메시지를 먼저 보내고 actions 블록은 다음 메시지로 보낸다.
- `block_actions` 가 오면 다음 순서로 처리한다. (1) EIA `click_button` 요청을 큐에 넣는다. 처리는 기다리지 않는다. (2) `ackInteraction` 이 `response_url` 에 `replace_original: true` 와 `text`(`languageHints.selectionDone`, 없으면 "선택 완료")를 보내 키보드를 지운다. (3) 웹훅 HTTP 응답으로 3초 안에 빈 본문 `200 OK` 를 보낸다. 클릭을 버린 경우(재도착, 분당 한도 초과, 실행이 입력 대기가 아님, 워크플로우 비활성)에도 (3) 의 응답은 같다([Slack 어댑터 「R-S-12」](CLE-CHAT-SLACK.md#r-s-12-interactivity-는-처리-결과와-트리거-상태에-관계없이-200-으로-답한다)).

### Form

Slack 은 `supportsNativeForm = true` 이고 어댑터 규약의 폼 모드 분기를 쓴다.

- **네이티브 모달**: `formMode ∈ {auto, native_modal}`, 필드 5개 이하, 모든 필드가 Slack 모달 수용 타입일 때. Slack 모달은 `plain_text_input`·`static_select`·`datepicker`·`checkboxes` 를 input 블록으로 받으므로 1차 범위 폼 타입 가운데 `file` 만 빠진다. `form_modal` 버튼 → `views.open` → `view_submission` 일괄 제출.
- **다단계 질문**: 필드 6개 이상, `formMode === "multi_step"`, `file` 필드 포함.

| `field.type`([Form 노드](../CLE-NODE-PRES/CLE-NODE-FORM.md)) | 모달 input 요소 | 다단계 질문 힌트 |
|---|---|---|
| `text`·`textarea`·`email` | `plain_text_input`(textarea 는 `multiline: true`) | 평문 질문(`section` 블록과 사용자 DM 답장) |
| `number` | `plain_text_input`(제출 뒤 어댑터가 숫자 검증) | 평문 질문과 "숫자만 입력" 안내 |
| `select`·`radio` | `static_select`(단일 선택) | `actions` 블록의 `static_select` |
| `checkbox` | `checkboxes` | `checkboxes` 와 완료 버튼 |
| `date` | `datepicker` | `datepicker` |
| `file` | 모달이 받지 않는다. 하나라도 있으면 다단계 질문 | "파일을 이 DM 에 업로드해 주세요" 질문 → `file_shared` 이벤트 수신 |
| `text` + `validation.preset: 'phone'` | `plain_text_input`(어댑터 형식 검증). 미구현 | 평문 질문과 "전화번호 입력" 안내. Slack 에는 연락처 공유가 없다 |

서버 쪽 검증이 실패하면 모달은 `response_action: errors` 로 그 필드를 강조하고 다단계 질문은 `currentFieldIdx` 를 되돌려 그 필드만 다시 묻는다. 질문 본문 형식은 어댑터 규약을 따른다.

### 시각형 매트릭스

어댑터 규약의 `visualNode` 분기를 쓴다. 1차 범위는 mrkdwn 텍스트·monospace 표현이다(의존성 추가 없음). 후속 범위의 SSR PNG 격상 조건은 [Telegram 어댑터](CLE-CHAT-TELEGRAM.md) 와 같다. 필드 경로는 노드가 만드는 값 기준이다. 렌더러가 읽는 순서는 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 을 본다. `chart`·`carousel` 행의 입력 필드(`payload.{title, series, labels}`, 카드 이미지 URL)는 노드 출력과 정의가 갈린다. [Presentation 노드 공통 §미결 사항](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md#미결-사항) 과 [채팅 채널 어댑터 규약 §미결 사항](CLE-CHAT-ADAPTER.md#미결-사항) 참조.

| 노드 유형 | `text`(1차 · 후속 범위) | `photo` 1차 범위 | `photo` 후속 범위 | `auto` 1차 범위 | `auto` 후속 범위 |
|---|---|---|---|---|---|
| `chart` | `output.payload.{title, series, labels}` → monospace 미니 막대 차트(mrkdwn code block, 3500자 분할) | 텍스트로 대신(warning 로그) | satori SVG → PNG `files.uploadV2` | 텍스트(수치 가독성 우선) | 텍스트 |
| `carousel` | `output.items[]` → 카드를 차례로 `chat.postMessage`. `text` 는 이미지 URL 을 무시한다(굵은 제목, 설명, 카드별 actions 블록 버튼). 카드 10장 상한과 "외 N장" | `auto` 1차 범위 표현으로 대신(warning 로그) | 카드 1~5장 collage PNG `files.uploadV2` 1회 | 카드별로 이미지 URL 이 있으면 Block Kit `image` 블록(`image_url`, `alt_text`, `title`), 없으면 `chat.postMessage`(굵은 제목, 설명, 카드별 actions). 이미지 블록 분기는 미구현이고 현재는 텍스트 카드만 보낸다. 카드 10장 상한, 전역 버튼은 마지막 카드 뒤 별도 메시지 | 카드별 분기와 5장 collage PNG 시도 |
| `table` | `output.{rows, columns}` → mrkdwn code block 안의 monospace 표(열 패딩, 헤더 구분선, 행 20개 상한, 16자 넘는 셀 말줄임, 3500자 분할) | 텍스트로 대신 | 표 PNG `files.uploadV2` | 텍스트(정밀도 우선) | 텍스트 |
| `template` | `output.rendered` 가 평문이면 `<` · `>` · `&` 를 escape 한 뒤 `chat.postMessage`(3500자 분할. 조각 경계가 escape 결과의 가운데를 지나면 그 엔티티 앞에서 자른다. [멘션 무력화](#멘션-무력화)). HTML 은 보내지 않는다 | 텍스트로 대신 | HTML → SSR PNG | 텍스트 | HTML → SSR PNG |

- **버튼**: 모든 시각형에서 `buttonConfig.buttons[]` 가 있으면 시각 메시지 다음 메시지로 actions 블록을 보낸다.
- **옛 `text_only`**: 어댑터가 입력 단계에서 `"text"` 로 바꾼다.

### Typing

1차 범위는 아무것도 보내지 않는다(`as_user=true` 와 Real Time Messaging 의 `typing` 이벤트는 Socket Mode 전용). `renderNode` 가 typing 메시지를 만들지 않거나 `sendMessage` 가 조용히 건너뛴다. LLM 응답이 수 초에서 수십 초 걸리면 사용자가 "봇이 죽었나" 느낄 수 있어 자리표시 메시지 뒤 `chat.update` 하는 방안을 후속 범위에서 검토한다(R-S-5).

### 실행 실패

`execution.failed` 는 어댑터 규약의 `classifyExecutionFailure(event)` 결과로 문구를 찾아 채운 뒤 `chat.postMessage` 한 번(평문)으로 보낸다. 민감 정보 제외는 [채팅 채널 「실행 실패 안내」](CLE-CHAT-CORE.md#실행-실패-안내) 를 따른다.

| 항목 | Slack 매핑 |
|---|---|
| API 호출 | `POST https://slack.com/api/chat.postMessage` 1회 |
| 본문 | `languageHints[key]` 에 `{statusCode}` 를 채운 결과. mrkdwn 문법(`<>*_~` 등)을 피한 평문이고 `blocks` 는 붙이지 않는다 |
| `thread_ts` | 붙이지 않는다(1:1 DM, [Slack 어댑터 「R-S-4」](CLE-CHAT-SLACK.md#r-s-4-채널그룹mpim-은-거부하고-dm-만-지원한다)) |
| `channel` | 대화의 `channel_id`(다른 `chat.postMessage` 와 같다) |
| 타임아웃·재시도 | 5초 타임아웃, 총 3회 시도. 끝내 실패하면 `degraded` |

## 비기능

- `chat.postMessage` 는 5초 타임아웃과 지수 백오프로 총 3회 시도한다. 대기는 1초, 2초 두 번이고 세 번째 실패 뒤에는 더 기다리지 않아 4초 대기는 생기지 않는다(`slack-client.ts` `call`). 끝내 실패하면 `chat_channel_health` 를 `degraded` 로 바꾼다.
- Slack [Rate limits](https://api.slack.com/docs/rate-limits): `chat.postMessage` 는 Tier 4(워크스페이스당 분당 약 100건), `files.uploadV2` 는 Tier 2(분당 약 20건)다. 응답의 `Retry-After` 는 따른다(구현됨). DM 채널 단위 큐와 메서드별 bucket 으로 스스로 속도를 맞추는 것은 미구현이다.
- 인바운드 중복 제거는 [Slack 어댑터 — 인바운드 파싱과 명령 「중복 제거 키」](CLE-CHAT-SLACK-INBOUND.md#중복-제거-키) 에 있다.

## 구현 위치

- `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts`: `setupChannel`, 자격 증명 거부 목록(`SLACK_CREDENTIAL_REJECTED_ERRORS`), `ackInteraction`
- `codebase/backend/src/modules/chat-channel/providers/slack/slack-client.ts`
- `codebase/backend/src/modules/chat-channel/providers/slack/slack-message.renderer.ts`: 노드 UI 매핑 렌더, `execution.ai_message` 본문과 Template 본문의 escape(`escapeSlackMrkdwn`), 3500자 분할(`chunkText` · `chunkEnd`)
- `codebase/backend/src/modules/chat-channel/providers/slack/slack.types.ts`
- `codebase/frontend/src/app/(main)/w/[slug]/triggers/page.tsx`, `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx`, `codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts`
- 사용자 가이드: `codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx`, `slack.en.mdx`

## Rationale

### R-S-2 Events API Request URL 을 자동 등록하지 않는다

사용자가 Slack 앱 manifest 에 미리 등록한다. Request URL 은 OAuth 설치 흐름이 아니라 앱 manifest 의 정적 설정이라 Slack Web API 로 바꿀 수 없다. `apps.manifest.update` 는 앱 소유자의 사용자 토큰(`xoxe.xoxp-*` configuration token)만 받아 워크플로우 사용자의 봇 토큰으로는 부를 수 없다. `setupChannel` 은 `auth.test` 로 identity 만 캐시하고 URL 검증은 호출자가 응답으로 처리한다. 사용자 가이드에 manifest 입력 안내를 둔다.

### R-S-5 typing 표시는 보내지 않는다

Slack Web API 에 서버가 보내는 typing 표시가 없다. Socket Mode 의 `typing` 이벤트만 가능한데 1차 범위는 웹훅 모드뿐이다([Slack 어댑터 「R-S-3」](CLE-CHAT-SLACK.md#r-s-3-1차-범위는-웹훅-모드만-socket-mode-는-후속-범위)). 임시 "..." 메시지는 소음이고 갱신·삭제 부담이 있다. "처리 중입니다" 자리표시 메시지를 `chat.update` 로 바꾸는 방식은 UX 는 좋지만 `execution.ai_message` 도착 시점의 message_ts 를 추적해야 해 후속 범위로 나눈다. 프로바이더가 기능을 지원하지 않으면 빈 구현을 허용하는 `ackInteraction` 과 같은 생각이다.

### R-S-6 Form 은 필드 5개 이하면 모달, 6개 이상이나 multi_step 이면 다단계

Slack `views.open` 모달을 네이티브 폼으로 택했다. [채팅 채널 어댑터 규약 「R-CCA-8 네이티브 폼 모달 예외: 필드 5개 이하 모달 하나」](CLE-CHAT-ADAPTER.md#r-cca-8-네이티브-폼-모달-예외-필드-5개-이하-모달-하나) 의 예외에 따라 `formMode ∈ {auto, native_modal}`, 필드 5개 이하, `file` 필드 없는 폼은 모달 하나로 받는다. 그 밖은 Telegram 과 같은 다단계 질문이다. 모달은 Slack 에서 가장 자연스러운 폼 UX 다. 필드 6개 이상을 여러 페이지 모달로 끌고 가지 않는 이유는 Discord 와 공통 분모(모달 필드 5개 한도)를 맞추고 UX 복잡도를 피하려는 것이다.

### R-S-11 이전 봇 토큰의 auth.revoke 는 24시간 유예가 끝난 뒤 부른다

2026-11-06 결정이다(NERV Task `CLE-T-D41BY6`). 근거는 [채팅 채널 어댑터 규약 「R-CCA-10 이전 봇 토큰은 24시간 유예가 끝난 정리 작업이 폐기한다」](CLE-CHAT-ADAPTER.md#r-cca-10-이전-봇-토큰은-24시간-유예가-끝난-정리-작업이-폐기한다) 에 있다. 이 결정으로 미결 «이전 봇 토큰 revoke 시점» 을 닫았다.

### Template 본문과 AI 응답을 escape 해 멘션을 막는다 (2026-11-14)

**배경**: Template 노드는 `{{ }}` 표현식으로 웹훅 본문, 폼 입력, 앞 노드 출력 같은 외부 값을 본문에 넣는다. 그 값에 `<!channel>` · `<!here>` 가 들어 있으면 채널 전체 멘션이 되어 알림이 울리고 `<@U…>` 는 사용자 멘션이 된다. 그런데 렌더러는 Template 본문을 그대로 보냈다. AI 응답의 `<` · `>` · `&` escape 는 이미 [Slack 어댑터](CLE-CHAT-SLACK.md) 의 요구사항이었지만 코드는 escape 하지 않았다(NERV Task `CLE-T-FQTQ7K`).

**결정**: 2026-11-14 사람 결정이다(NERV 질문 `01a1d93a-a9dc-76d5-95a0-21a4753b0c50` 의 선택지 1). Template 본문과 AI 응답을 모두 escape 한다. AI 응답은 코드를 그 요구사항에 맞춘다. 대가로 워크플로우 작성자가 템플릿에 일부러 넣은 멘션과 `<url|라벨>` 링크도 글자로 보인다. 맨 URL 자동 링크와 서식은 그대로 되므로 이 대가를 받아들였다.

escape 는 슬래시 명령 응답과 안내 문구에 이미 쓰던 `escapeSlackMrkdwn` 을 그대로 쓴다. 한 함수를 쓰면 봇이 보내는 글의 escape 규칙이 경로마다 갈리지 않는다. escape 는 렌더러 안에서 하고 어댑터 함수와 렌더러 인터페이스는 더하지 않았다.

escape 하면 본문이 길어지므로 3500자 분할은 escape 한 뒤에 한다. 조각 경계가 `&lt;` 같은 엔티티 가운데를 지나면 Slack 에는 `&l` 과 `t;` 같은 깨진 글자가 보인다. 그래서 경계를 그 엔티티 앞으로 당긴다.

**`mrkdwn` 파라미터를 보내지 않는 기존 결정은 유지한다**: `chat.postMessage` 에 `mrkdwn: false` 를 보내면 AI 응답과 Template 본문의 `*굵게*` · `_기울임_` 같은 서식까지 꺼진다. 꺾쇠 문법만 escape 하면 서식은 남기고 멘션과 링크 문법만 글자로 바꿀 수 있다. 그래서 [Web API 호출 매핑](#web-api-호출-매핑) 의 `sendMessage`(text) 행은 바꾸지 않았다.

**기각한 대안**:

- **Template 만 escape 하고 AI 응답은 후속 작업으로 미룬다**: LLM 응답에도 사용자 발화나 도구 결과가 그대로 들어갈 수 있어 같은 위험이 있다. 미루면 Slack 어댑터의 요구사항과 코드가 어긋난 채로 남는다.
- **`{{ }}` 치환값만 escape 하고 작성자가 쓴 글자는 그대로 둔다**: 렌더러가 받는 값은 완성된 `output.rendered` 라 어느 글자가 치환값인지 알 수 없다. Template 노드나 표현식 해석기가 치환할 때 escape 하거나 치환 경계를 출력에 실어 넘겨야 한다. 이것은 백엔드와 표현식 해석기가 본문을 escape 하지 않고 소비처가 처리한다는 2026-11-12 결정([Presentation 노드 공통 — 표시 표면 「Template 본문은 그리는 쪽이 정화한다 (2026-11-12)」](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON-DISPLAY.md#template-본문은-그리는-쪽이-정화한다-2026-11-12), NERV Task `CLE-T-MBGDA4`)과 겹친다. AI 응답에는 치환 경계가 아예 없다.
- **`mrkdwn: false` 로 서식 해석을 끈다**: 위에 적은 대로 서식까지 사라져 AI 응답의 표현이 바뀐다.
