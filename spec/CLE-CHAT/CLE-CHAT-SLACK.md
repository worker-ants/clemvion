---
id: "CLE-CHAT-SLACK"
title: "Slack 어댑터"
type: "feature"
version: 6
status: "approved"
requirements: ["REQ-SLACK-001", "REQ-SLACK-002", "REQ-SLACK-003", "REQ-SLACK-004", "REQ-SLACK-005", "REQ-SLACK-006", "REQ-SLACK-007", "REQ-SLACK-008", "REQ-SLACK-009", "REQ-SLACK-010", "REQ-SLACK-011", "REQ-SLACK-012", "REQ-SLACK-013", "REQ-SLACK-014", "REQ-SLACK-015", "REQ-SLACK-016", "REQ-SLACK-017", "REQ-SLACK-018", "REQ-SLACK-019", "REQ-SLACK-020", "REQ-SLACK-021", "REQ-SLACK-022", "REQ-SLACK-023", "REQ-SLACK-024", "REQ-SLACK-025", "REQ-SLACK-026", "REQ-SLACK-027", "REQ-SLACK-028", "REQ-SLACK-029", "REQ-SLACK-030", "REQ-SLACK-031", "REQ-SLACK-032", "REQ-SLACK-033", "REQ-SLACK-034", "REQ-SLACK-035", "REQ-SLACK-036", "REQ-SLACK-037", "REQ-SLACK-038", "REQ-SLACK-039", "REQ-SLACK-040", "REQ-SLACK-041", "REQ-SLACK-042", "REQ-SLACK-043", "REQ-SLACK-044"]
basis_superseded: false
parent: "CLE-CHAT"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT"]
area: "CLE-CHAT"
content_hash: "e7648c579a9ad2ba8f24cc00f1cdc0d321b233a37ca227c8bfa24dfd7f646742"
read_as: "approved_fallback"
task: "CLE-T-MGZRRP"
source_paths: []
mirror_sha256: "859e3d0818870a528089a620569dfdd1a6f44914574688e8252fa136786e430c"
etag: "sha256-5d2b28707b826c6dd06cb84e49499482a0e2bd864d4ee7dbfc19c900cd8c8bb8"
---
> 구현 상태: 부분 구현 · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

`provider: "slack"` 채널 어댑터는 [Slack Web API](https://api.slack.com/web), [Events API](https://api.slack.com/apis/events-api), [Interactivity & Shortcuts](https://api.slack.com/interactivity) 위에서 동작한다. 사용자가 자기 워크스페이스에 Slack 앱을 설치하고 봇 토큰을 등록하면 Events API 구독의 Request URL 검증으로 Slack 에서 우리 웹훅 트리거로 오는 연결이 이어진다. 어댑터는 [채팅 채널 「노드와 채널 UI 매핑」](CLE-CHAT-CORE.md#노드와-채널-ui-매핑) 의 요구사항(REQ-CHAT-018~030)이 다루는 노드를 Slack UI(Block Kit, Modal)로 바꾼다.

1차 범위는 웹훅 모드만 지원한다. Slack Socket Mode(WebSocket 연결)는 오래 유지되는 연결 관리와 여러 서버 인스턴스 라우팅 부담이 있어 후속 범위의 옵션이다(R-S-3). 그래서 사용자는 Slack 앱을 "Event Subscriptions: Request URL" 모드로 설정해야 한다.

이 문서는 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 인터페이스의 Slack 구현을 정한다. 공통 규칙(렌더 매핑, 실행 실패 분류, Form 입력 흐름, 다단계 질문 본문 형식, 시각형 렌더 입력)은 어댑터 규약을, 인바운드 HTTP 응답·명령 공통 의미·재시도 정책은 [채팅 채널](CLE-CHAT-CORE.md) 을, 설정 필드와 안내 문구는 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 을 따른다.

## 사용 시나리오

| 시나리오 | 설명 |
|---|---|
| Slack 봇 챗봇 | 사용자가 봇과 DM 하면 멀티턴 AI 노드로 들어가 자연스럽게 대화한다 |
| Slack 봇 결재 | 사용자 요청 → Form(필드 5개 이하는 모달, 그 밖은 다단계 질문) → 결재 결과 통보 |
| Slack 봇 데이터 안내 | 사용자 요청 → Chart 렌더 → 1차 범위는 mrkdwn monospace 텍스트 차트와 선택 버튼, 후속 범위는 이미지 |

## 요구사항

- REQ-SLACK-001 WHEN `setupChannel` 이 불리면 THE SYSTEM SHALL `auth.test` 를 부르고 `botIdentity` 를 `{ botId: hashStringToInt(user_id ?? bot_id), username: user ?? bot_id, teamId: team_id }` 로 캐시한다.
- REQ-SLACK-002 IF `auth.test` 가 HTTP 200 과 `ok:false` 에 `invalid_auth`·`not_authed`·`account_inactive`·`token_revoked`·`token_expired` 가운데 하나를 돌려주면 THE SYSTEM SHALL `code: 'BOT_TOKEN_INVALID'` 를 실은 에러를 던진다.
- REQ-SLACK-003 IF `auth.test` 의 `error` 가 위 다섯 값이 아니면 THE SYSTEM SHALL 자격 증명 거부로 분류하지 않는다.
- REQ-SLACK-004 WHEN `teardownChannel` 이 불리면 THE SYSTEM SHALL 외부 API 를 부르지 않는다.
- REQ-SLACK-005 WHEN envelope `type` 이 `url_verification` 이면 THE SYSTEM SHALL `parseUpdate` 가 `null` 을 돌려주고 호출자가 `200 OK` 와 `{ challenge: <받은 값> }` 으로 답한다.
- REQ-SLACK-006 WHEN Events API 로 봇이 아닌 사용자의 DM 메시지(`channel_type === "im"`, `bot_id` 없음, `subtype` 없음)가 오면 THE SYSTEM SHALL `text_message` 로 바꾼다.
- REQ-SLACK-007 IF DM 밖 채널에서 `app_mention` 이 오면 THE SYSTEM SHALL `null` 을 돌려주고 DM 안의 멘션은 `text_message` 로 받는다.
- REQ-SLACK-008 WHEN DM 에서 `file_shared` 이벤트가 오면 THE SYSTEM SHALL `parseUpdate` 가 `{ kind: "file_upload", fileId, mimeType: "application/octet-stream" }` 를 돌려주고 `HooksService` 가 `files.info` 로 mimeType·filename·url_private 을 보강한다. (R-S-7)
- REQ-SLACK-009 IF 메시지의 `channel_type` 이 `channel`·`group`·`mpim` 이면 THE SYSTEM SHALL `null` 을 돌려주고 호출자가 `groupChatRefusal` 안내를 보낸다.
- REQ-SLACK-010 IF 메시지에 `bot_id` 가 있거나 `subtype === "bot_message"` 이면 THE SYSTEM SHALL `null` 을 돌려준다.
- REQ-SLACK-011 WHEN `block_actions` 의 `action_id` 가 `__open_form__` 이면 THE SYSTEM SHALL `{ kind: "open_form_modal", openContext: { triggerId } }` 로 바꾼다.
- REQ-SLACK-012 WHEN 버튼이나 select 메뉴의 `block_actions` 가 오면 THE SYSTEM SHALL `button_callback` 으로 바꾸고 `callbackData` 에 `actions[0].value` 나 `actions[0].selected_option.value` 를 넣는다.
- REQ-SLACK-013 WHEN `callback_id` 가 `clemvion_form` 인 `view_submission` 이 오면 THE SYSTEM SHALL `view.state.values` 를 `{ <field.name>: rawValue }` 로 펴 `form_submission` 으로 바꾼다.
- REQ-SLACK-014 WHEN 서명 검증을 통과한 Interactivity 요청(`payload=<JSON>` 본문)이 오면 THE SYSTEM SHALL 처리 결과와 트리거 활성 여부에 관계없이 3초 안에 `200 OK` 로 답하고 경로가 정한 `response_action` 이 없으면 본문을 비운다. (R-S-8, R-S-12)
- REQ-SLACK-015 WHEN 설정한 slash command 가 `start` 나 빈 text 로 오면 THE SYSTEM SHALL `start` 로, `cancel` 이면 `cancel` 로, 그 밖이면 `text_message` 로 바꾸되 `help` 이면 update 를 만들지 않는다(`null`).
- REQ-SLACK-016 WHEN 활성 실행이 없는 DM 에 첫 메시지가 오면 THE SYSTEM SHALL slash command 없이 새 실행을 시작한다. (R-S-9)
- REQ-SLACK-017 WHEN update 를 파싱하면 THE SYSTEM SHALL 중복 제거 키를 Events API 는 `event_id`, Interactivity 는 `payload.trigger_id`, Slash Commands 는 `body.trigger_id` 로 만들고 만들지 못하면 `null` 을 돌려준다.
- REQ-SLACK-018 WHEN `execution.ai_message` 를 보내면 THE SYSTEM SHALL `<`·`>`·`&` 만 escape 한 `chat.postMessage` 로 보내고 3500자를 넘으면 단어·문장 경계로 나눠 마지막 조각 전까지 `\n_(continued…)_` 를 붙인다.
- REQ-SLACK-019 WHEN typing 메시지를 보내야 하면 THE SYSTEM SHALL 아무것도 보내지 않는다. (R-S-5)
- REQ-SLACK-020 WHEN 버튼 대기를 보내면 THE SYSTEM SHALL Block Kit `actions` 블록의 `button` 요소로 만들고 `value` 에 `buttonId` 를, `style` 에 `primary`·`danger` 를 넣는다.
- REQ-SLACK-021 WHEN 버튼 `block_actions` 가 오면 THE SYSTEM SHALL EIA `click_button` 요청을 큐에 넣고 `response_url` 에 `replace_original: true` 로 "선택 완료" 를 보내 키보드를 지운 뒤 3초 안에 빈 `200 OK` 로 답한다.
- REQ-SLACK-022 WHEN `formMode` 가 `auto`·`native_modal` 이고 필드가 5개 이하이며 `file` 필드가 없는 Form 입력 대기가 오면 THE SYSTEM SHALL `form_modal` 버튼을 보내고 클릭 즉시 `views.open` 으로 모달을 연다.
- REQ-SLACK-023 IF 모달 제출이 서버 쪽 검증에서 실패하면 THE SYSTEM SHALL `view_submission` 응답으로 `response_action: "errors"` 와 `details[0]` 필드 에러를 돌려줘 모달을 유지한다.
- REQ-SLACK-024 WHEN 모달 조건에 맞지 않는 Form 입력 대기가 오면 THE SYSTEM SHALL 다단계 질문으로 받고 필드 `type` 별 Block Kit 요소를 쓴다.
- REQ-SLACK-025 WHEN `text` 필드에 `validation.preset: 'phone'` 이 있으면 THE SYSTEM SHALL `plain_text_input` 과 어댑터 형식 검증으로 받는다. (미구현)
- REQ-SLACK-026 WHEN 시각형 노드나 Template 을 보내면 THE SYSTEM SHALL [시각형 매트릭스](#시각형-매트릭스) 의 1차 범위 표현인 mrkdwn 텍스트·monospace 로 보내고 1차 범위에서 `photo` 면 텍스트로 대신 보내며 warning 로그를 남긴다.
- REQ-SLACK-027 WHEN `visualNode` 가 `auto` 이고 Carousel 카드에 이미지 URL 이 있으면 THE SYSTEM SHALL 그 카드를 Block Kit `image` 블록으로 보낸다. (미구현)
- REQ-SLACK-028 WHEN `image` 메시지를 보내면 THE SYSTEM SHALL `files.uploadV2` 로 PNG 를 올리고 실패하면 caption·`fallbackText` 를 `chat.postMessage` 텍스트로 보낸다.
- REQ-SLACK-029 WHEN `execution.failed` 를 받으면 THE SYSTEM SHALL 분류 결과 문구를 mrkdwn 없이 평문 `chat.postMessage` 한 번으로 보내고 `blocks`·`thread_ts` 는 붙이지 않는다.
- REQ-SLACK-030 IF `X-Slack-Signature` 가 `v0=` HMAC-SHA256(signing secret, `"v0:" + timestamp + ":" + raw_body`)과 상수 시간 비교에서 다르면 THE SYSTEM SHALL `401` 로 답한다.
- REQ-SLACK-031 IF `X-Slack-Request-Timestamp` 가 현재 시각 ±5분 밖이면 THE SYSTEM SHALL `401` 로 답한다.
- REQ-SLACK-032 IF 트리거 생성 때 `inboundSigningPlaintext` 가 `^[a-f0-9]{32}$` 에 맞지 않으면 THE SYSTEM SHALL `400 VALIDATION_ERROR`(`details.field='inboundSigningPlaintext'`, `details.code='INVALID_FIELD'`)로 거부한다.
- REQ-SLACK-033 WHEN 모달 view 의 `private_metadata` 를 채우면 THE SYSTEM SHALL 대화 키(DM 채널 ID)만 넣고 자격 증명과 개인정보는 넣지 않는다.
- REQ-SLACK-034 WHEN 활성 실행이 없을 때 `/<prefix> start` 가 오면 THE SYSTEM SHALL 새 실행을 시작하고 `languageHints.executionStarted` 를 안내한다. (부분 구현)
- REQ-SLACK-035 WHEN 활성 실행이 있을 때 `/<prefix> start` 가 오면 THE SYSTEM SHALL 기존 실행을 실행 중지 경로(`ExecutionsService.stop`)로 취소하고 새 실행을 시작하며 "기존 대화를 종료하고 새로 시작합니다." 를 안내한다. (부분 구현)
- REQ-SLACK-036 WHEN `/<prefix> cancel` 이 오면 THE SYSTEM SHALL 활성 실행을 실행 중지 경로(`ExecutionsService.stop`)로 취소하고 활성 실행이 없으면 "진행 중인 대화가 없습니다." 를 안내한다. (부분 구현)
- REQ-SLACK-037 WHEN `/<prefix> help` 가 오면 THE SYSTEM SHALL 실행으로 보내지 않고 슬래시 명령 응답의 `text` 에 `languageHints.help`(없으면 `languageLocale` 기본 도움말에 요청의 `command` 를 넣은 문구)를 싣는다. (R-S-14)
- REQ-SLACK-038 WHEN `chat.postMessage` 를 부르면 THE SYSTEM SHALL 5초 타임아웃과 지수 백오프로 총 3회까지 시도하고 끝내 실패하면 `chat_channel_health` 를 `degraded` 로 바꾼다.
- REQ-SLACK-039 WHEN Slack 이 `429` 와 `Retry-After` 를 돌려주면 THE SYSTEM SHALL 그 초만큼 기다린 뒤 다시 시도한다.
- REQ-SLACK-040 WHILE Slack rate limit 안에서 보내는 동안 THE SYSTEM SHALL DM 채널 단위 큐와 메서드별 bucket 으로 발송 속도를 맞춘다. (미구현)
- REQ-SLACK-041 WHEN 같은 중복 제거 키가 30초 안에 다시 오면 THE SYSTEM SHALL 두 번째 update 를 무시한다.
- REQ-SLACK-042 WHEN 봇 토큰 재발급 뒤 24시간 유예가 끝나 정리 작업이 이전 봇 토큰을 폐기하면 THE SYSTEM SHALL 그때 `auth.revoke` 를 부르고 재발급 시점에는 그 재발급으로 유예 백업에 들어가는 이전 토큰에 부르지 않는다.
- REQ-SLACK-043 WHEN 서명 검증을 통과한 슬래시 명령이 오면 THE SYSTEM SHALL 활성 실행 중 `/<prefix> start` 의 기존 실행 취소가 실패한 경우를 빼고 처리 결과와 트리거 활성 여부에 관계없이 3초 안에 `200 OK` 와 본인에게만 보이는 `{ response_type: 'ephemeral', text }` 로 답하며 `help` 밖의 명령이면 `text` 를 `languageHints.commandReceived`(없으면 `languageLocale` 기본 문구)로 채운다. (R-S-14)
- REQ-SLACK-044 WHEN 슬래시 명령 응답의 `text` 를 채우면 THE SYSTEM SHALL `&`·`<`·`>` 를 escape 한다. (R-S-14)

요구사항 보충 설명은 다음과 같다.

- 관련 REQ-SLACK-002·003: 이 다섯 값이 `BOT_TOKEN_INVALID` 판별의 전부이고 목록을 열어 두지 않는다. `ratelimited` 처럼 자격 증명과 무관한 값은 일부러 뺀다. "당신 토큰이 잘못됐다" 를 잘못 말하는 것이 `502`(그 밖의 실패)보다 나쁘다. 목록에 없는 값은 502 로 간다. 이 목록은 외부 API 응답이라 저장소 안에서 잴 수 없다. 늘리려면 Slack 이 문서화한 표준 auth 에러라는 근거를 대고 코드 상수(`slack.adapter.ts` 의 `SLACK_CREDENTIAL_REJECTED_ERRORS`)와 함께 늘린다. 한쪽만 바꾸면 판별이 조용히 갈린다. `token_expired` 는 통합 상태 사유(`Integration.status_reason`)의 `'token_expired'` 와 글자만 같고 다른 네임스페이스다([통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md)). 이쪽은 Slack API 응답 문자열이고 저쪽은 우리 DB 컬럼 값이다.
- 관련 REQ-SLACK-008: `parseUpdate` 는 순수 계약을 지키고 보강은 호출자 쪽에서 한다. 채널 어댑터의 `enrichInbound`(HooksService 가 부른다)가 `SlackClient.filesInfo` 를 부른다. 진행 중인 다단계 질문에서는 `handleFormStep` 이 `file_upload` 를 폼 필드 값으로 쌓아 `submit_form` 을 부른다(`hooks.service.ts`, 구현됨). Form `file` 필드의 MIME 검증은 다단계 질문이 필드 제약을 상태에 저장하지 않는 `formState` 의 1차 범위 한계에 걸려 Planned 다.
- 관련 REQ-SLACK-014·021: Interactivity 의 웹훅 HTTP 응답은 Slack 어댑터의 기본 인터랙션 응답(`defaultInteractionResponse`)이 정한다. 본문에 문자열 `payload` 필드가 있으면 Interactivity 로 보고 빈 응답을 돌려준다. `HooksService` 는 서명 검증 직후 이 값을 구해 둔다. 처리가 무시 · 대기 실행 전달 · 새 실행 어느 쪽으로 끝나도 이 값을 응답에 싣는다. 트리거가 비활성이어도 같다. 컨트롤러는 이 응답을 봉투 없이 `200` 빈 본문으로 보낸다. 경로가 정한 응답(`view_submission` 검증 실패의 `response_action: "errors"`)이 있으면 그것이 먼저다. 새 실행의 호출 이력 응답 코드(`response_code`)도 `200` 으로 남는다. `click_button` 요청 큐 등록과 `ackInteraction` 의 `response_url` 갱신은 전부터 구현돼 있었다. 응답 코드는 NERV Task `CLE-T-FCBG91` 이 고쳤다. 슬래시 명령의 기본 응답은 빈 본문이 아니고 REQ-SLACK-043 이 정한다.
- 관련 REQ-SLACK-016·034·035: 활성 실행이 있을 때 기존 실행을 취소하고 새로 시작하는 입력은 `/<prefix> start` 뿐이다. 명령 우선 규칙, 취소 실패 처리, 대화 상태 정리는 [채팅 채널](CLE-CHAT-CORE.md) 의 REQ-CHAT-062~065 가 정한다. 활성 실행이 있는 DM 의 일반 텍스트는 기존 실행을 취소하지 않고 [채팅 채널](CLE-CHAT-CORE.md) 의 실행 상태 분기(REQ-CHAT-013·014)를 따른다(R-S-10). 트리거의 워크플로우가 비활성이면 활성 실행이 없는 DM 의 메시지와 `/<prefix> start` 는 새 실행을 시작하지 않고 버린다. 활성 실행이 있는 DM 의 `/<prefix> start` 도 기존 실행을 취소하지 않는다(REQ-CHAT-066). 취소와 새 시작은 구현됐고 시작 안내와 재시작 안내는 아직 보내지 않는다(NERV Task `CLE-T-0400J6`).
- 관련 REQ-SLACK-025: [Form 노드](../CLE-NODE-PRES/CLE-NODE-FORM.md) 에 `validation.preset` 이 아직 없다. Slack 에는 연락처 공유에 해당하는 기능이 없다.
- 관련 REQ-SLACK-027: 현재 구현(`slack-message.renderer.ts`)은 Carousel 카드를 제목·설명 텍스트로만 만든다.
- 관련 REQ-SLACK-036: 취소는 `/<prefix> start` 와 같은 실행 중지 경로(`ExecutionsService.stop`)를 쓴다. EIA `cancel` 도 같은 `stop` 을 부르므로 취소 동작은 같다([채팅 채널 「R-CC-27 활성 실행 중 /start 는 기존 실행을 취소하고 새로 시작한다」](CLE-CHAT-CORE.md#r-cc-27-활성-실행-중-start-는-기존-실행을-취소하고-새로-시작한다)). 취소한 뒤의 대화 상태 정리는 REQ-CHAT-065 를 따른다. 활성 실행이 없을 때의 안내는 아직 보내지 않고 ack 만 한다(현재 구현, `hooks.service.ts`).
- 관련 REQ-SLACK-037: 파서는 `help` 에 update 를 만들지 않는다(`null`). 그래서 `/<prefix> help` 는 실행으로 가지 않고 별도 메시지도 보내지 않는다. 도움말은 슬래시 명령의 HTTP 응답 하나로 나간다(REQ-SLACK-043). 하위 명령은 어댑터의 기본 응답(`defaultInteractionResponse`)이 파서와 같은 규칙(`readSlackSlashInvocation`)으로 읽는다. `languageHints.help` 가 있으면 그 문구를 그대로 쓰고 `{prefix}` 를 바꾸지 않는다. 없으면 Discord 와 함께 쓰는 locale 기본 도움말(`SLASH_HELP_DEFAULTS`)의 `{prefix}` 에 요청의 `command` 를 넣는다. 앞의 `/` 는 빼고 비어 있으면 `workflow` 를 넣는다. `languageHints.slashPrefix` 는 쓰지 않는다(R-S-14).
- 관련 REQ-SLACK-038·041: 재시도 정책과 중복 제거 키·TTL 은 [채팅 채널](CLE-CHAT-CORE.md)·[채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 이 정한다. 대기는 1초, 2초 두 번이고 세 번째 실패 뒤에는 기다리지 않아 4초 대기는 생기지 않는다(`slack-client.ts` `call`).
- 관련 REQ-SLACK-040: 현재 구현은 `429` 의 `Retry-After` 대기만 한다. 채널 단위 큐와 메서드별 bucket 은 확인되지 않았다.
- 관련 REQ-SLACK-042: `auth.revoke` 는 24시간 유예가 끝난 정리 작업이 부른다. 정리 작업은 `TriggersService.cleanupRotatedChatChannelTokens` 이고 `ChatChannelTokenRotatorService` 가 매시간 돌린다. 폐기 대상은 `bot-token.v2` 참조에 백업된 이전 토큰이다. 재발급(`TriggersService.rotateBotToken`) 시점에는 그 재발급으로 백업되는 이전 토큰에 부르지 않는다. 유예 안에 다시 재발급하면(A→B 뒤 유예 안에 B→C) `bot-token.v2` 의 A 가 B 로 덮이므로 덮인 A 는 재발급이 끝까지 성공한 뒤 `auth.revoke` 로 best-effort 폐기하고 실패해도 재발급은 성공으로 두고 경고 로그만 남긴다(NERV Task `CLE-T-6ZTPZ8`). 근거는 [채팅 채널 어댑터 규약 「R-CCA-10 이전 봇 토큰은 24시간 유예가 끝난 정리 작업이 폐기한다」](CLE-CHAT-ADAPTER.md#r-cca-10-이전-봇-토큰은-24시간-유예가-끝난-정리-작업이-폐기한다) 다.
- 관련 REQ-SLACK-043·044: 응답 판단은 Slack 어댑터의 기본 응답(`defaultInteractionResponse`)이 한다. 본문에 문자열 `command` · `text` 가 있고 Events API · `url_verification` · Interactivity 가 아니면 슬래시 명령으로 본다. 파서와 같은 판정이다. `HooksService` 는 서명 검증 직후 이 값을 구해 둔다. 처리가 새 실행 · 취소 · 답장 전달 · 중복 · 분당 한도 초과 · 워크플로우 비활성 어느 쪽으로 끝나도 이 값을 응답에 싣는다. 트리거가 비활성이어도 같고 이때 실행은 시작하지 않는다. 기본 응답은 요청 본문만 보고 만들어 외부 호출이 없다. 슬래시 명령으로 시작한 새 실행의 호출 이력 응답 코드(`response_code`)는 `'200'` 이다. 수신 문구 기본값(ko `요청을 받았습니다.`, en `Request received.`)은 [채팅 채널 데이터와 흐름 「안내 문구 기본값」](CLE-CHAT-DATA.md#안내-문구-기본값) 이 정한다. 활성 실행 중 `/<prefix> start` 의 기존 실행 취소가 실패하면 이 응답 대신 그 에러로 답한다([채팅 채널](CLE-CHAT-CORE.md) 의 취소 실패 처리). 응답 `text` 는 Slack 이 mrkdwn 으로 렌더하므로 다른 안내 문구와 같은 `escapeSlackMrkdwn` 으로 escape 한다. 도움말도 같다. 시작 안내와 재시작 안내는 이 응답과 별개다(NERV Task `CLE-T-0400J6`).

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
| `ackInteraction` | 인터랙션 후처리. `button_callback` 이고 `response_url` 이 있으면 [`response_url`](https://api.slack.com/interactivity/handling#message_responses) 에 `replace_original: true` 로 POST 해 원본 메시지를 «선택 완료» 문구로 바꾼다. 실패는 로그만 남긴다. 3초 안 수신 확인은 웹훅 HTTP 응답이 맡는다([Interactivity](#interactivity)) |
| `defaultInteractionResponse` | API 를 부르지 않는다. 본문에 문자열 `payload` 필드가 있으면(Interactivity) 3초 기본 응답으로 `200` 빈 본문(`{}`)을 낸다. 슬래시 명령이면 `200` 과 `{ response_type: 'ephemeral', text }` 를 낸다. `text` 는 `help` 면 도움말, 그 밖은 수신 문구이고 `&`·`<`·`>` 를 escape 한다([Slash Commands](#slash-commands)). Events API 는 기본 응답이 없어 `202` 다. `url_verification` 은 기본 응답 없이 핸드셰이크 응답(`200 + { challenge }`)으로 답한다([Interactivity](#interactivity)) |
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

Events API Request URL 은 Slack 앱 manifest 에 미리 등록하는 값이라 어댑터가 API 로 등록·해제하지 않는다(R-S-2). 사용자는 manifest 의 `event_subscriptions.request_url` 을 `${BASE_URL}/api/hooks/${trigger.endpointPath}` 로 설정해 둬야 한다(사용자 가이드가 안내한다).

URL Verification(`type: "url_verification"`)은 Slack 이 Request URL 을 등록할 때 한 번 보낸다. `parseUpdate` 가 `null` 을 돌려주고 호출자가 `{ challenge: <받은 값> }` JSON 을 `200 OK` 로 답한다. [채팅 채널](CLE-CHAT-CORE.md) 인바운드 HTTP 응답 계약의 `202` 고정 정책에 대한 명시적 예외다(R-S-8). 트리거가 활성이면 워크플로우가 비활성이어도 답한다(2026-10-10 사용자 결정). 워크플로우가 비활성인 채로 앱을 연결해도 Request URL 등록이 실패하지 않게 하려는 것이다. 관문은 트리거 활성 관문, 핸드셰이크 응답, …, 워크플로우 활성 관문 순서로 놓이므로 핸드셰이크 응답 단계에서는 워크플로우 상태를 확인하지 않는다. 순서의 기준은 [채팅 채널 「인바운드 관문 순서」](CLE-CHAT-CORE.md#인바운드-관문-순서) 다. 트리거가 비활성이면 challenge 를 돌려주지 않고 `202`·`{ executionId: 'ignored' }` 다([채팅 채널](CLE-CHAT-CORE.md) REQ-CHAT-067, [채팅 채널 「R-CC-28 비활성 워크플로우는 채팅 채널로 새 실행을 시작하지 않는다」](CLE-CHAT-CORE.md#r-cc-28-비활성-워크플로우는-채팅-채널로-새-실행을-시작하지-않는다)).

### teardownChannel

어댑터는 외부 호출을 하지 않는다. 사용자가 Slack 앱을 워크스페이스에서 지우면 Events API 도 저절로 무효가 된다. 봇 토큰을 재발급하면 이전 토큰은 24시간 유예가 끝난 뒤 정리 작업(`ChatChannelTokenRotatorService` 가 매시간 돌리는 `TriggersService.cleanupRotatedChatChannelTokens`)이 [`POST /api/auth.revoke`](https://api.slack.com/methods/auth.revoke)로 무효화한다. 재발급 시점에는 그 재발급으로 백업되는 이전 토큰을 무효화하지 않는다. 유예 안에 다시 재발급해 백업이 덮이는 토큰만 그 재발급이 끝난 뒤 무효화한다(REQ-SLACK-042).

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

## 명령 매핑

Slack 인바운드는 세 가지 envelope(Events API, Interactivity, Slash Commands)로 오고 어댑터가 모두 처리한다.

### Events API

`Content-Type: application/json`, 본문 `{ type: "event_callback", event: {...} }`.

| Slack event | `ChannelUpdate.command` |
|---|---|
| `event.type === "message"`, `event.channel_type === "im"`, `bot_id` 없음, `subtype === undefined` | `{ kind: "text_message", text: event.text }` |
| `event.type === "app_mention"`(모든 채널) | DM 밖 채널은 `null`(R-S-4). DM 안의 멘션은 `text_message` 로 받는다 |
| `event.type === "file_shared"`, DM | `{ kind: "file_upload", fileId: event.file_id, mimeType: "application/octet-stream" }`(순수 계약). 보강은 호출자(R-S-7) |
| `event.type === "message"`, `event.channel_type ∈ ('channel', 'group', 'mpim')` | `null`. 호출자가 `groupChatRefusal` 안내 |
| `event.type === "message"`, `bot_id` 있음 또는 `subtype === "bot_message"` | `null`. 봇·자기 메시지 무시 |
| 그 밖의 event(`reaction_added`, `team_join` 등) | `null`. 1차 범위에서 처리하지 않는다 |
| envelope `type === "url_verification"` | `null`. 호출자가 `{ challenge }` 로 200 응답 |

### Interactivity

`Content-Type: application/x-www-form-urlencoded`, 본문 `payload=<JSON>`.

| `payload.type` | `ChannelUpdate.command` |
|---|---|
| `"block_actions"`, `actions[0].action_id === "__open_form__"` | `{ kind: "open_form_modal", openContext: { triggerId } }`. `HooksService` 가 `trigger_id` 로 `views.open` 을 부른다 |
| `"block_actions"`(버튼) | `{ kind: "button_callback", callbackData: payload.actions[0].value }` |
| `"block_actions"`(select 메뉴) | `{ kind: "button_callback", callbackData: payload.actions[0].selected_option.value }` |
| `"view_submission"`, `view.callback_id === "clemvion_form"` | `{ kind: "form_submission", fields }`. `view.state.values` 를 `{ <field.name>: rawValue }` 로 편다(block_id 가 필드 이름, 요소 값 추출, R-S-6) |
| `"shortcut"`·`"message_action"`·`"view_closed"` | 1차 범위는 `null`. `view_closed` 뒤에도 실행은 입력 대기를 유지하고 버튼 메시지가 남아 다시 누를 수 있다 |

Slack Interactivity 는 3초 안에 `200 OK` 를 받아야 한다. 이 수신 확인은 웹훅 HTTP 응답이 맡는다. 응답은 `200 OK` 이고 경로가 정한 `response_action`(모달 검증 실패의 `errors`)이 없으면 본문을 비운다(R-S-8). 처리가 무시(파싱 실패, 재도착, 분당 한도 초과, 워크플로우 비활성), 대기 실행 전달, 새 실행 어느 쪽으로 끝나도 같고 트리거가 비활성이어도 같다(R-S-12). 판단은 Slack 어댑터의 `defaultInteractionResponse` 가 본문의 문자열 `payload` 필드로 한다. 비동기 갱신용 `response_url`(1시간 유효, 5회 한도)의 `replace_original` POST 는 `ackInteraction` 이 한다(버튼 선택 뒤 «선택 완료» 로 갱신).

### Slash Commands

`Content-Type: application/x-www-form-urlencoded`, 본문 `{ command, text, ... }`.

| 매핑 | `ChannelUpdate.command` |
|---|---|
| `command === "/<configured-prefix>"`, `text === "start"`(또는 빈 text) | `{ kind: "start" }` |
| `command === "/<configured-prefix>"`, `text === "cancel"` | `{ kind: "cancel" }` |
| `command === "/<configured-prefix>"`, `text === "help"` | `null`. 도움말은 슬래시 명령의 HTTP 응답에 싣는다(REQ-SLACK-037) |
| 그 밖의 text | `{ kind: "text_message", text: body.text }` |

Slack slash command 는 워크스페이스마다 prefix 하나만 등록할 수 있어 트리거별로 나눌 수 없다. 1차 범위 정책은 다음과 같다.

- 사용자가 Slack 앱 manifest 에 slash command 하나(`/<prefix>`, 가이드 기본값 `/workflow`)를 등록한다.
- DM 에서 봇과 바로 대화하면 slash command 없이 자동으로 시작한다(Telegram `/start` 와 같다). 대화가 없으면 [채팅 채널](CLE-CHAT-CORE.md) 의 REQ-CHAT-015 대로 새 실행을 시작한다.
- slash command 는 보조 명령이다(`/workflow cancel` 로 활성 실행 취소 등).

슬래시 명령에는 3초 안에 `200 OK` 와 `{ response_type: 'ephemeral', text }` 로 답한다(REQ-SLACK-043). `ephemeral` 이라 명령을 보낸 사람에게만 보인다. `help` 는 도움말을 싣고 그 밖의 명령은 수신 문구(`languageHints.commandReceived`)를 싣는다. 처리 결과와 트리거 활성 여부에 관계없이 같다(R-S-14). Interactivity 의 기본 응답(`200` 빈 본문)과는 본문만 다르다.

### 중복 제거 키

세 envelope 모두 `idempotencyKey` 를 envelope 별로 만든다. Events API 는 `event_id`(Slack 이 재전송 때 같은 값을 보낸다), Interactivity 는 `payload.trigger_id`(1시간 유효, 1회용 의도지만 재전송 때 다시 쓴다), Slash Commands 는 `body.trigger_id` 다. 만들지 못하면(빈 값) 파서가 `null` 을 돌려 update 자체가 버려지므로 중복 제거 대상인데 키가 없는 상태는 생기지 않는다.

## 노드 UI 매핑

### 멀티턴 AI

- `execution.ai_message.message` 를 `chat.postMessage` 로 보낸다(mrkdwn, [Slack 서식](https://api.slack.com/reference/surfaces/formatting) 규칙대로 `<`, `>`, `&` 만 escape).
- 3500자에서 나눈다. `chat.postMessage.text` 의 권장 한도 4000자에서 500자 여유를 둔 값이다. 단어·문장 경계로 나누고 마지막 조각 전까지 `\n_(continued…)_` 를 붙인다.
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
- `block_actions` 가 오면 다음 순서로 처리한다. (1) EIA `click_button` 요청을 큐에 넣는다. 처리는 기다리지 않는다. (2) `ackInteraction` 이 `response_url` 에 `replace_original: true` 와 `text`(`languageHints.selectionDone`, 없으면 "선택 완료")를 보내 키보드를 지운다. (3) 웹훅 HTTP 응답으로 3초 안에 빈 본문 `200 OK` 를 보낸다. 클릭을 버린 경우(재도착, 분당 한도 초과, 실행이 입력 대기가 아님, 워크플로우 비활성)에도 (3) 의 응답은 같다(R-S-12).

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
| `template` | `output.rendered` 가 평문이면 `chat.postMessage`(3500자 분할). HTML 은 보내지 않는다 | 텍스트로 대신 | HTML → SSR PNG | 텍스트 | HTML → SSR PNG |

- **버튼**: 모든 시각형에서 `buttonConfig.buttons[]` 가 있으면 시각 메시지 다음 메시지로 actions 블록을 보낸다.
- **옛 `text_only`**: 어댑터가 입력 단계에서 `"text"` 로 바꾼다.

### Typing

Slack Web API 에는 서버가 보내는 typing 표시가 없다(`as_user=true` 와 Real Time Messaging 의 `typing` 이벤트는 Socket Mode 전용). 1차 범위는 아무것도 보내지 않는다. `renderNode` 가 typing 메시지를 만들지 않거나 `sendMessage` 가 조용히 건너뛴다. LLM 응답이 수 초에서 수십 초 걸리면 사용자가 "봇이 죽었나" 느낄 수 있다. "처리 중입니다" 임시 메시지를 보낸 뒤 응답으로 `chat.update` 하는 방안을 후속 범위에서 검토한다. 프로바이더가 기능을 지원하지 않으면 빈 구현을 허용한다는 `ackInteraction` 과 같은 생각이다.

### 실행 실패

`execution.failed` 는 어댑터 규약의 `classifyExecutionFailure(event)` 결과로 문구를 찾아 채운 뒤 `chat.postMessage` 한 번(평문)으로 보낸다. 민감 정보 제외는 [채팅 채널](CLE-CHAT-CORE.md) 의 REQ-CHAT-041 을 따른다.

| 항목 | Slack 매핑 |
|---|---|
| API 호출 | `POST https://slack.com/api/chat.postMessage` 1회 |
| 본문 | `languageHints[key]` 에 `{statusCode}` 를 채운 결과. mrkdwn 문법(`<>*_~` 등)을 피한 평문이고 `blocks` 는 붙이지 않는다 |
| `thread_ts` | 붙이지 않는다(1:1 DM, R-S-4) |
| `channel` | 대화의 `channel_id`(다른 `chat.postMessage` 와 같다) |
| 타임아웃·재시도 | 5초 타임아웃, 총 3회 시도. 끝내 실패하면 `degraded` |

## 보안

- 봇 토큰(Slack `xoxb-*`)은 `botTokenRef`(`secret://triggers/{id}/bot-token`)만 설정에 둔다. 평문 저장은 금지다([채팅 채널](CLE-CHAT-CORE.md) REQ-CHAT-035).
- 봇 토큰과 인바운드 서명 자료를 시크릿 저장소 참조로만 다루고 평문을 설정 JSON · 로그 · metric 에 내놓지 않는 규칙, 프로바이더 API 클라이언트가 실패 문장을 돌려주거나 로그에 남기기 전에 봇 토큰을 지우는 규칙은 [채팅 채널 어댑터 규약 「규칙」](CLE-CHAT-ADAPTER.md#규칙) 10 이 정한다.
- **Signing secret**: Slack [요청 검증](https://api.slack.com/authentication/verifying-requests-from-slack)은 `X-Slack-Signature: v0=<HMAC-SHA256(signing_secret, "v0:" + X-Slack-Request-Timestamp + ":" + raw_body)>` 형식이다. signing secret 은 `SecretResolver` 가 관리하고 참조는 `secret://triggers/{id}/inbound-signing` 이다([시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 의 프로바이더 공통 슬롯).
  - 형식(Slack 발급 표준)은 `^[a-f0-9]{32}$`(소문자 hex 32자)다. 트리거 생성 때 `assertInboundSigningPlaintextByProvider`(`chat-channel-input-rules.ts`, `TriggersService` 가 생성 경로에서 부른다)가 검증하고 어기면 `400 VALIDATION_ERROR` 다. 대문자 hex 는 Slack HMAC 검증을 실패시키므로 미리 막는다.
  - 진입점이 raw body 와 두 헤더를 읽고 `SecretResolver.resolve(inboundSigningRef)` 뒤 HMAC-SHA256 을 다시 계산해 상수 시간 비교한다. 다르면 `401 Unauthorized` 다.
- **재전송 공격 차단**: `X-Slack-Request-Timestamp` 가 현재 시각 ±5분 밖이면 `401`(Slack 권장).
- **설정 필드**: `inboundSigningRef` 는 Telegram·Discord 와 같은 슬롯이다. 자원 성격과 검증 알고리즘은 백엔드가 프로바이더별로 나눈다([채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md)). Slack 은 앱 설치 때 Slack 이 발급해 사용자가 직접 입력하는 프로바이더 발급 자료다. 입력 평문이 바로 `SecretResolver.rotate` 로 들어가고 참조만 설정에 남는다. `SetupResult.issuedInboundSigning` 은 채우지 않는다(R-S-1).
- 채널·그룹·mpim 이벤트는 진입점에서 `event.channel_type !== "im"` 으로 막고 `groupChatRefusal` 안내 뒤 버린다([채팅 채널](CLE-CHAT-CORE.md) REQ-CHAT-017).
- 다른 봇이 보낸 메시지(`bot_id` 있음)도 무시한다.
- **네이티브 모달 `private_metadata`(위험 수용)**: `openFormModal` 이 view 의 `private_metadata` 에 대화 키(DM 채널 ID, 예: `D0123ABCD`)를 평문으로 담는다. `view_submission` 에 채널 ID 가 없어 제출 때 대화를 되찾는 데 필요하다. Slack 서버가 이 값을 보고 보관할 수 있지만 (a) 채널 ID 는 비밀이 아니고(Slack 이 이미 안다) (b) 봇 토큰·signing secret 같은 자격 증명은 전혀 넣지 않으므로 위험을 받아들인다. 자격 증명과 개인정보는 `private_metadata` 에 절대 넣지 않는다([시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 14).

## 인바운드 응답

인바운드 HTTP 응답 정책은 [채팅 채널](CLE-CHAT-CORE.md) 의 인바운드 HTTP 응답 계약이 기준이고 여기 사본을 두지 않는다. 기본은 `202 Accepted` 다. 인증 실패 `401` 과 엔드포인트 미존재 `404` 를 포함한 예외 응답 코드 목록은 [채팅 채널 「R-CC-12 인바운드 응답은 202 로 고정하고 401·404 만 예외로 둔다」](CLE-CHAT-CORE.md#r-cc-12-인바운드-응답은-202-로-고정하고-401404-만-예외로-둔다) 에 있다. Slack 예외는 세 가지다. (1) `url_verification` envelope 은 `200 OK + { challenge }` 다. (2) Interactivity 는 3초 안에 `200 OK`(빈 본문이나 `response_action`)이고 `202` 가 아니다. (3) 슬래시 명령은 3초 안에 `200 OK` 와 본인에게만 보이는 `{ response_type: 'ephemeral', text }` 다(R-S-14). (1)·(2) 는 인바운드 응답 계약 표와 프로바이더별 응답 예외 조건에 들어 있다(R-S-8). (2)·(3) 의 응답은 어댑터의 기본 응답(`defaultInteractionResponse`)이 정한다. Interactivity 와 슬래시 명령의 `200` 은 처리 결과와 관계없고 트리거가 비활성이어도 같다(R-S-12, R-S-14). 비활성 트리거의 Events API 메시지는 `202 + { executionId: 'ignored' }` 다. 트리거가 활성이면 워크플로우가 비활성이어도 `url_verification` 에는 답한다. 핸드셰이크 응답이 워크플로우 활성 관문보다 앞이기 때문이다([채팅 채널 「인바운드 관문 순서」](CLE-CHAT-CORE.md#인바운드-관문-순서)). 워크플로우가 비활성이면 새 실행을 시작할 update(활성 실행이 없는 DM 의 메시지, `/<prefix> start`)는 버린다. 이때 Interactivity 로 온 클릭은 `200` 빈 본문이고 `/<prefix> start` 는 `200` 과 수신 문구이며 DM 메시지는 `202 + { executionId: 'ignored' }` 다. 진행 중인 DM 의 입력(답장, 버튼, 모달 제출)과 `/<prefix> cancel` 은 그대로 처리한다(REQ-CHAT-066~068, [채팅 채널 「R-CC-28 비활성 워크플로우는 채팅 채널로 새 실행을 시작하지 않는다」](CLE-CHAT-CORE.md#r-cc-28-비활성-워크플로우는-채팅-채널로-새-실행을-시작하지-않는다)). 활성 실행 중 `/<prefix> start` 의 기존 실행 취소가 실패하면 슬래시 명령의 `200` 응답 대신 그 에러로 응답한다(REQ-CHAT-064).

## 명령 처리

| 사용자 입력 | 어댑터 처리 |
|---|---|
| DM 첫 메시지나 `/<prefix> start`(활성 실행 없음) | 새 실행 시작, `languageHints.executionStarted` 안내. 안내는 아직 보내지 않는다(NERV Task `CLE-T-0400J6`) |
| `/<prefix> start`(활성 실행 있음) | 기존 실행을 실행 중지 경로(`ExecutionsService.stop`)로 취소하고 새 실행 시작, "기존 대화를 종료하고 새로 시작합니다." 안내. 기존 실행이 이미 끝났거나 지워졌으면 취소 없이 시작한다. 워크플로우가 비활성이면 버리고 기존 실행을 취소하지 않는다. 기준은 [채팅 채널](CLE-CHAT-CORE.md) REQ-CHAT-062~064·066 이다. 안내는 아직 보내지 않는다(NERV Task `CLE-T-0400J6`) |
| DM 메시지(활성 실행 있음) | 기존 실행을 취소하지 않는다. 입력 대기면 대기 노드로 전달하고 `running`·`pending` 이면 `languageHints.executionStillRunning` 안내 뒤 버린다([채팅 채널](CLE-CHAT-CORE.md) REQ-CHAT-013·014, R-S-10) |
| `/<prefix> cancel` | 활성 실행을 실행 중지 경로(`ExecutionsService.stop`, EIA `cancel` 과 같은 경로)로 취소. 없으면 아무것도 하지 않고 "진행 중인 대화가 없습니다." 안내. 이 안내는 아직 보내지 않는다 |
| `/<prefix> help` | 실행으로 보내지 않는다. 슬래시 명령의 HTTP 응답에 도움말(`languageHints.help` 나 요청의 명령 이름을 넣은 기본 도움말)을 싣고 본인에게만 보인다(REQ-SLACK-037) |
| 그 밖의 slash text | `text_message` 로 받는다. 멀티턴 AI 진행 중이면 답장이고 아니면 안내 |

Telegram 의 `/start`·`/cancel`·`/help` 와 뜻이 1:1 이다. Slack 은 prefix 하나의 하위 명령으로 표현한다. 슬래시 명령으로 온 입력의 HTTP 응답은 어느 행이든 `200` 과 본인에게만 보이는 문구다. `help` 는 도움말이고 그 밖은 수신 문구다(REQ-SLACK-043).

## 비기능

- `chat.postMessage` 는 5초 타임아웃과 지수 백오프로 총 3회 시도한다. 대기는 1초, 2초 두 번이고 세 번째 실패 뒤에는 더 기다리지 않는다(`slack-client.ts` `call`). 끝내 실패하면 `chat_channel_health` 를 `degraded` 로 바꾼다.
- Slack [Rate limits](https://api.slack.com/docs/rate-limits): `chat.postMessage` 는 Tier 4(워크스페이스당 분당 약 100건), `files.uploadV2` 는 Tier 2(분당 약 20건)다. 응답의 `Retry-After` 는 따른다(구현됨). DM 채널 단위 큐와 메서드별 bucket 으로 스스로 속도를 맞추는 것은 미구현이다.
- 인바운드 중복 제거는 구현됐다(2026-08-13). 같은 키가 30초 안에 다시 오면 무시한다(Slack 은 `X-Slack-Retry-Num` 으로 3회까지 재전송). `ChatChannelDedupService` 가 Redis `SET NX EX 30`, 키 `cc:dedup:<triggerId>:<idempotencyKey>` 로 인바운드 진입의 분당 한도 앞에서 거른다. Redis 가 없으면 통과시킨다. 키·TTL·게이트 순서는 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 이 정한다.

## 미결 사항

지금 남은 미결 사항은 없다. «help 명령 경로» 와 «슬래시 명령의 3초 응답» 은 2026-11-13 결정으로 닫았다(R-S-14).

## 구현 위치

- `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts`: Interactivity 와 슬래시 명령의 기본 응답(`defaultInteractionResponse`), 슬래시 명령 도움말(`resolveSlackHelpText`), `response_url` 갱신(`ackInteraction`)
- `codebase/backend/src/modules/chat-channel/providers/slack/slack-client.ts`
- `codebase/backend/src/modules/chat-channel/providers/slack/slack-message.renderer.ts`
- `codebase/backend/src/modules/chat-channel/providers/slack/slack-signing.ts`
- `codebase/backend/src/modules/chat-channel/providers/slack/slack-update.parser.ts`: 슬래시 명령 판정과 하위 명령(`readSlackSlashInvocation`, `SLACK_SLASH_HELP_SUBCOMMAND`)
- `codebase/backend/src/modules/chat-channel/providers/slack/slack.types.ts`
- `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts`: 슬래시 명령 기본 도움말(`SLASH_HELP_DEFAULTS`, Discord 와 함께 쓴다)과 수신 문구 기본값
- `codebase/backend/src/modules/chat-channel/types.ts`: 채널 어댑터의 기본 인터랙션 응답 함수(`defaultInteractionResponse`)
- `codebase/backend/src/modules/chat-channel/chat-channel-inbound-authenticator.ts`
- `codebase/backend/src/modules/hooks/hooks.service.ts`, `hooks.controller.ts`: 인바운드 관문(워크플로우 활성 관문 포함), 명령 처리(활성 실행 중 `/<prefix> start` 의 기존 실행 취소), 인터랙션 기본 응답을 응답에 싣는 처리(`handleChatChannelWebhook`, `withDefaultInteractionResponse`)와 200 빈 본문 응답
- `codebase/backend/src/modules/hooks/hooks.service.spec.ts`: 세 프로바이더의 활성 실행 중 start 명령, 「인터랙션 기본 응답」
- `codebase/backend/src/modules/hooks/hooks.controller.spec.ts`, `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.spec.ts`: Interactivity 의 200 빈 본문
- `codebase/packages/chat-channel-validation/src/index.ts`
- `codebase/backend/test/chat-channel-slack.e2e-spec.ts`(「Interactivity 응답」 · 「슬래시 명령의 응답」 포함), `chat-channel-trigger-create.e2e-spec.ts`
- `codebase/frontend/src/app/(main)/w/[slug]/triggers/page.tsx`, `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx`, `codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts`
- 사용자 가이드: `codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx`, `slack.en.mdx`

## Rationale

### R-S-1 inboundSigningRef 단일 슬롯을 함께 쓴다

Telegram secret_token, Slack signing secret, Discord public key 는 모두 "인바운드 웹훅 출처 검증 자료" 라는 같은 역할이라 `inboundSigningRef?` 슬롯 하나를 함께 쓴다. 슬롯을 하나로 두면 (a) 규약의 필드가 줄고 (b) 새 프로바이더가 참조 필드를 새로 만들 필요가 없고 (c) 카탈로그와 데이터 모델의 이름이 일관된다. 발급 주체와 검증 알고리즘의 차이는 이미 `provider` 로 나뉘는 백엔드 분기가 흡수한다. 소유가 모호해질 수 있다는 우려는 백엔드 분기와 `SetupResult.issuedInboundSigning` 의 "서버 발급만" 명시로 풀린다. Slack 자원은 `secret://triggers/{id}/inbound-signing` 에 두고 SlackAdapter 가 HMAC-SHA256 으로 검증한다. 운영 데이터가 없어 마이그레이션이 필요 없다.

### R-S-2 Events API Request URL 을 자동 등록하지 않는다

사용자가 Slack 앱 manifest 에 미리 등록한다. Request URL 은 OAuth 설치 흐름이 아니라 앱 manifest 의 정적 설정이라 Slack Web API 로 바꿀 수 없다. `apps.manifest.update` 는 앱 소유자의 사용자 토큰(`xoxe.xoxp-*` configuration token)만 받아 워크플로우 사용자의 봇 토큰으로는 부를 수 없다. `setupChannel` 은 `auth.test` 로 identity 만 캐시하고 URL 검증은 호출자가 응답으로 처리한다. 사용자 가이드에 manifest 입력 안내를 둔다.

### R-S-3 1차 범위는 웹훅 모드만, Socket Mode 는 후속 범위

Events API 와 Interactivity Request URL 만 쓰는 무상태 HTTP 라 여러 서버 인스턴스 라우팅 부담이 없다. Socket Mode 는 봇마다 오래 유지되는 WebSocket 연결이 필요해 여러 인스턴스 환경의 라우팅·장애 조치 부담이 생긴다. 사설망 안의 Slack 처럼 Socket Mode 가 필요한 경우는 후속 범위로 나눈다.

### R-S-4 채널·그룹·mpim 은 거부하고 DM 만 지원한다

1차 범위 정책([채팅 채널](CLE-CHAT-CORE.md) REQ-CHAT-017)과 맞다. `app_mention` 은 채널과 DM 모두에서 생기므로 채널 멘션은 따로 거부하고 DM 안의 멘션만 `text_message` 로 받는다. 여러 사용자 채널 대응은 후속 범위의 여러 사용자 대화와 함께 간다.

### R-S-5 typing 표시는 보내지 않는다

Slack Web API 에 서버가 보내는 typing 표시가 없다. Socket Mode 의 `typing` 이벤트만 가능한데 1차 범위는 웹훅 모드뿐이다(R-S-3). 임시 "..." 메시지는 소음이고 갱신·삭제 부담이 있다. "처리 중입니다" 자리표시 메시지를 `chat.update` 로 바꾸는 방식은 UX 는 좋지만 `execution.ai_message` 도착 시점의 message_ts 를 추적해야 해 후속 범위로 나눈다. 프로바이더가 기능을 지원하지 않으면 빈 구현을 허용하는 `ackInteraction` 과 같은 생각이다.

### R-S-6 Form 은 필드 5개 이하면 모달, 6개 이상이나 multi_step 이면 다단계

Slack `views.open` 모달을 네이티브 폼으로 택했다. [채팅 채널 어댑터 규약 「R-CCA-8 네이티브 폼 모달 예외: 필드 5개 이하 모달 하나」](CLE-CHAT-ADAPTER.md#r-cca-8-네이티브-폼-모달-예외-필드-5개-이하-모달-하나) 의 예외에 따라 `formMode ∈ {auto, native_modal}`, 필드 5개 이하, `file` 필드 없는 폼은 모달 하나로 받는다. 그 밖은 Telegram 과 같은 다단계 질문이다. 모달은 Slack 에서 가장 자연스러운 폼 UX 다. 필드 6개 이상을 여러 페이지 모달로 끌고 가지 않는 이유는 Discord 와 공통 분모(모달 필드 5개 한도)를 맞추고 UX 복잡도를 피하려는 것이다.

### R-S-7 file_shared 는 files.info 후속 조회를 HooksService 에 맡긴다

`parseUpdate` 의 순수 계약을 지키고 `HooksService` 가 `files.info` 를 부른다. `parseUpdate` 는 mimeType 을 모르는 자리표시(`application/octet-stream`)로 `file_upload` 를 바로 돌려준다. 호출자가 받은 직후 [`files.info`](https://api.slack.com/methods/files.info) 한 번으로 mimeType·filename·url_private 을 보강한다. 그 값으로 Form `file` 필드의 `allowedMimeTypes`·`maxFileSize` 를 1차 검증하고 EIA `submit_form` 에 `{ fileId, filename, mimeType, urlPrivate }` 를 넣는다. 실패하면 `currentFieldIdx` 를 되돌리고 `form_prompt` 를 다시 보낸다. `parseUpdate` 를 async 부수 효과로 풀면 Telegram 파서의 순수한 단순성을 잃는다. 보강 책임을 호출자로 모으면 다른 파일 수신 프로바이더(Telegram `document`, Discord 후속 범위의 Gateway 첨부)도 같은 방식을 다시 쓸 수 있다.

### R-S-8 URL Verification 과 Interactivity 는 200 OK 로 답한다

[채팅 채널](CLE-CHAT-CORE.md) 의 인바운드 응답 계약은 `202 Accepted` 가 기준이다. 예외 응답 코드 목록은 [채팅 채널 「R-CC-12 인바운드 응답은 202 로 고정하고 401·404 만 예외로 둔다」](CLE-CHAT-CORE.md#r-cc-12-인바운드-응답은-202-로-고정하고-401404-만-예외로-둔다) 에 있다. Slack 은 그 가운데 프로바이더별 응답 예외 두 가지를 더한다. URL Verification 은 Slack 이 응답 본문에서 `challenge` 를 꺼내야 하므로 `200 OK + { challenge }` JSON 이 필수다. Interactivity 3초 ack 는 Slack 이 `200 OK`(또는 `response_action`)만 성공으로 보고 `202` 는 클라이언트에 에러로 보일 수 있다. 응답 계약을 200·202 둘 다 허용으로 넓히면 모든 프로바이더의 응답 정책이 모호해지므로 Slack 만 예외로 두어 변경 범위를 줄인다. 예외 허용 조건은 인바운드 응답 계약의 프로바이더별 응답 예외가 정한다. 슬래시 명령의 `200` 응답은 이 결정 뒤에 R-S-14 가 세 번째 예외로 더했다.

트리거가 꺼져 있을 때 두 예외의 응답은 다르다. URL Verification 요청은 handshake 전에 버리고 `202` 로 답한다([채팅 채널 「R-CC-28 비활성 워크플로우는 채팅 채널로 새 실행을 시작하지 않는다」](CLE-CHAT-CORE.md#r-cc-28-비활성-워크플로우는-채팅-채널로-새-실행을-시작하지-않는다)). Interactivity 요청에는 트리거가 꺼져 있어도 `200` 빈 본문으로 답한다([채팅 채널 「R-CC-33 인터랙션은 어느 경로로 끝나도 기본 응답으로 답하고 버린 클릭에는 수신 확인을 보낸다」](CLE-CHAT-CORE.md#r-cc-33-인터랙션은-어느-경로로-끝나도-기본-응답으로-답하고-버린-클릭에는-수신-확인을-보낸다)). 위의 «필수» 는 켜진 트리거가 URL 을 등록할 때의 응답을 가리킨다.

### R-S-9 DM 첫 메시지로 자동 시작한다

Telegram `/start` 와 뜻이 같고 slash command prefix 가 워크스페이스마다 하나라는 Slack 제약을 피한다. `/workflow start` 를 의무로 두면 매번 명령을 쳐야 해 DM 봇 UX 와 맞지 않는다(게다가 prefix 가 트리거마다 달라야 의미가 있는데 Slack 은 그럴 수 없다). `app_home` 진입 때 자동 시작하는 안은 Home 탭이 별도 표면이라 찾기 어렵다. slash command 는 cancel·help 같은 명시 명령의 보조 도구다.

### R-S-10 취소 후 새로 시작은 start 명령에만 적용한다

2026-10-10 결정이다(NERV Task `CLE-T-V4WVF2`). 원문 명령 처리 표는 활성 실행이 있을 때 DM 메시지가 와도 기존 실행을 취소하고 새로 시작한다고 적었다. DM 텍스트는 멀티턴 AI 답장과 다단계 질문 답변이 들어오는 길이다. 이것을 재시작으로 보면 대화 중 답장마다 실행이 새로 시작된다. 그래서 재시작은 명시 명령인 `/<prefix> start` 에만 두고 DM 텍스트는 [채팅 채널](CLE-CHAT-CORE.md) 의 실행 상태 분기(REQ-CHAT-013·014)대로 처리한다. 명령 우선 규칙의 근거는 [채팅 채널 「R-CC-27 활성 실행 중 /start 는 기존 실행을 취소하고 새로 시작한다」](CLE-CHAT-CORE.md#r-cc-27-활성-실행-중-start-는-기존-실행을-취소하고-새로-시작한다) 에 있다. 이 결정으로 미결 «활성 실행 중 DM 메시지» 를 닫았다.

### R-S-11 이전 봇 토큰의 auth.revoke 는 24시간 유예가 끝난 뒤 부른다

2026-11-06 결정이다(NERV Task `CLE-T-D41BY6`). 근거는 [채팅 채널 어댑터 규약 「R-CCA-10 이전 봇 토큰은 24시간 유예가 끝난 정리 작업이 폐기한다」](CLE-CHAT-ADAPTER.md#r-cca-10-이전-봇-토큰은-24시간-유예가-끝난-정리-작업이-폐기한다) 에 있다. 이 결정으로 미결 «이전 봇 토큰 revoke 시점» 을 닫았다.

### R-S-12 Interactivity 는 처리 결과와 트리거 상태에 관계없이 200 으로 답한다

2026-11-12 결정이다(NERV Task `CLE-T-FCBG91`, NERV 질문 `01a1d025-8baf-773f-95fd-201820c7cd5f` 의 사람 답). R-S-8 은 Interactivity 에 `200 OK` 로 답한다고 정했다. 그런데 구현은 `block_actions` 에 `202` 와 `{ data }` 봉투로 답했다. 그러면 클라이언트에 에러로 보일 수 있다(R-S-8). 이 응답은 요청을 받았다는 확인이고 처리 결과를 알리지 않는다. 그래서 파싱 실패, 재도착, 분당 한도 초과, 대기 실행 전달, 새 실행, 워크플로우 비활성 모두 같은 `200` 빈 본문으로 답한다. 경로가 정한 응답(`view_submission` 검증 실패의 `response_action: "errors"`)만 이보다 먼저다.

트리거가 비활성이어도 `200` 으로 답한다. 트리거를 꺼도 DM 에 남은 버튼 메시지는 누를 수 있다. 그때 `202` 로 답하면 사용자 화면에 에러가 보일 수 있다. 기본 응답은 외부 호출 없이 요청 본문만 보고 정한다. 그래서 비활성 트리거에서는 서명 검증 뒤 외부 호출을 하지 않는다는 규칙(같은 사람 답)을 그대로 지킨다. 비활성 트리거의 Events API 메시지는 지금처럼 `202` 다. 슬래시 명령도 이 결정 때는 `202` 로 남겼고 R-S-14 가 `200` 으로 바꿨다.

판단은 채널 어댑터가 한다. Slack 어댑터의 `defaultInteractionResponse` 가 본문의 문자열 `payload` 필드로 Interactivity 를 가른다. `HooksService` 는 프로바이더를 가리지 않고 그 값을 응답에 싣는다.

검토한 다른 선택은 비활성 트리거에 이전처럼 `202` 로 답하는 안이다([채팅 채널](CLE-CHAT-CORE.md) 인바운드 HTTP 응답 계약의 비활성 트리거 행). 트리거를 끈 뒤 누른 버튼마다 사용자 화면에 에러가 보일 수 있어 택하지 않았다.

슬래시 명령의 3초 `200` 과 `/<prefix> help` 응답은 이번 범위에서 빼고 NERV Task `CLE-T-MGZRRP` 로 넘겼다. 그 결정은 R-S-14 에 있다.

### R-S-13 옛 문서 절 표기를 지우고 머리 줄과 범위 표기를 고쳤다

요구사항 줄 끝의 `(원본: slack §n)` 표기와 머리 줄의 «원문» 경로는 NERV 로 옮기기 전 저장소 문서를 가리켰다. 그 문서는 지워져 git 이력에만 있고 절 번호로는 찾아갈 수 없다. 문서는 NERV 링크로 가리킨다는 [용어 사전](../CLE-GLOSSARY.md) 원칙 11 에 따라 지웠다(NERV Task `CLE-T-1FCGJ1`). 표기에 함께 적혀 있던 이 문서의 Rationale 번호(R-S-n)는 남겼다. 요구사항의 뜻은 바꾸지 않았다. 머리 줄의 구현 상태는 `부분 구현` 으로 고쳤다. REQ-SLACK-025·027·040 이 미구현이고 034~037 이 부분 구현이라 [스펙과 구현 근거 규약](../CLE-ENG/CLE-ENG-SPECEVIDENCE.md) 의 구현 상태 세 값(구현됨·부분 구현·미구현) 가운데 `구현됨` 이 맞지 않는다.

같은 Task 에서 범위 표기 `v1` · `v2` 를 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 과 같은 「1차 범위」 · 「후속 범위」 로 바꿨다. 한 뜻에 한 용어를 쓴다는 [용어 사전](../CLE-GLOSSARY.md) 원칙 6 을 따랐고 범위의 뜻은 그대로다. `bot-token.v2` 는 시크릿 참조 이름이라 범위 표기가 아니어서 그대로 두었다. R-S-6 이 가리키던 다른 문서의 Rationale 번호(R-CCA-8)는 원칙 10 에 따라 제목을 단 링크로 바꿨다.

### R-S-14 슬래시 명령은 본인에게만 보이는 문구와 200 으로 답한다

2026-11-13 결정이다(NERV Task `CLE-T-MGZRRP`, NERV 질문 `01a1d2f3-e188-7354-8298-243092419a3c` 의 사람 답).

이 결정 전에는 슬래시 명령에 `202` 와 `{ data }` 봉투로 답했다. Slack 은 슬래시 명령에 3초 안에 `200` 을 받지 못하면 사용자 화면에 오류를 표시한다. 그래서 명령을 처리해도 사용자 화면에는 오류가 떴다. `/<prefix> help` 는 파서가 `text_message`("help")로 바꿨다. 그런데 `HooksService` 는 텍스트가 정확히 `/help` 일 때만 도움말을 보내서 Slack 에서는 도움말이 나가지 않았다.

이제 슬래시 명령에는 어느 경로로 끝나도 `200` 과 `{ response_type: 'ephemeral', text }` 로 답한다. `ephemeral` 이라 명령을 보낸 사람에게만 보인다. `help` 는 도움말을 싣고 그 밖의 명령은 공통 수신 문구를 싣는다. [Discord 어댑터 「R-D-12 슬래시 명령은 본인에게만 보이는 type 4 로 바로 답하고 비활성 트리거도 인터랙션 응답으로 답한다」](CLE-CHAT-DISCORD.md#r-d-12-슬래시-명령은-본인에게만-보이는-type-4-로-바로-답하고-비활성-트리거도-인터랙션-응답으로-답한다) 의 2026-11-12 결정과 같은 모양이다. 그래서 두 프로바이더의 슬래시 명령이 같은 수신 문구와 같은 기본 도움말을 쓴다. 트리거가 비활성이어도 같은 응답으로 답한다. 응답은 요청 본문만 보고 외부 호출 없이 만든다. 그래서 비활성 트리거에서는 외부 호출을 하지 않는다는 규칙을 그대로 지킨다(R-S-12 와 같은 근거).

도움말은 `ChannelUpdate` 의 새 kind 로 두지 않았다. 파서는 `help` 에 update 를 만들지 않고 어댑터의 기본 응답이 도움말을 싣는다. 그래서 `help` 는 실행으로 가지 않고 별도 메시지도 보내지 않는다. 파서와 어댑터는 같은 함수(`readSlackSlashInvocation`)로 하위 명령을 읽는다. 그래서 응답 문구와 파서가 만드는 명령이 서로 어긋나지 않는다.

기본 도움말의 명령 이름은 `languageHints.slashPrefix` 가 아니라 요청의 `command` 에서 읽는다. Slack 은 명령 이름을 앱 manifest 에서 정하고 요청마다 `command` 로 보낸다. 그래서 설정값이 manifest 와 달라도 도움말에는 사용자가 실제로 입력한 명령이 나온다.

응답 `text` 는 Slack 이 mrkdwn 으로 렌더한다. 그래서 다른 안내 문구와 같은 `escapeSlackMrkdwn` 으로 `&`·`<`·`>` 를 escape 한다. `languageHints` 문구의 `<…>` 가 링크나 멘션 문법으로 해석되지 않게 하려는 것이다. Discord 응답 본문은 escape 하지 않는다.

이 결정으로 미결 «help 명령 경로» 와 «슬래시 명령의 3초 응답» 을 닫았다.

기각한 대안은 빈 본문 `200` 만 돌려주는 안이다. 오류는 표시되지 않지만 사용자 화면에 아무것도 남지 않아 명령이 받아들여졌는지 알 수 없다. `help` 의 도움말도 실을 곳이 없어 메시지를 따로 보내야 한다. 이전처럼 `202` 와 `{ data }` 봉투로 답하는 안은 Slack 이 오류로 표시하므로 남길 수 없었다.
