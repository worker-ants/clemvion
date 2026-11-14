---
id: "CLE-CHAT-SLACK"
title: "Slack 어댑터"
type: "feature"
version: 8
status: "approved"
requirements: ["REQ-SLACK-001", "REQ-SLACK-002", "REQ-SLACK-003", "REQ-SLACK-004", "REQ-SLACK-005", "REQ-SLACK-006", "REQ-SLACK-007", "REQ-SLACK-008", "REQ-SLACK-009", "REQ-SLACK-010", "REQ-SLACK-011", "REQ-SLACK-012", "REQ-SLACK-013", "REQ-SLACK-014", "REQ-SLACK-015", "REQ-SLACK-016", "REQ-SLACK-017", "REQ-SLACK-018", "REQ-SLACK-019", "REQ-SLACK-020", "REQ-SLACK-021", "REQ-SLACK-022", "REQ-SLACK-023", "REQ-SLACK-024", "REQ-SLACK-025", "REQ-SLACK-026", "REQ-SLACK-027", "REQ-SLACK-028", "REQ-SLACK-029", "REQ-SLACK-030", "REQ-SLACK-031", "REQ-SLACK-032", "REQ-SLACK-033", "REQ-SLACK-034", "REQ-SLACK-035", "REQ-SLACK-036", "REQ-SLACK-037", "REQ-SLACK-038", "REQ-SLACK-039", "REQ-SLACK-040", "REQ-SLACK-041", "REQ-SLACK-042", "REQ-SLACK-043", "REQ-SLACK-044"]
basis_superseded: false
parent: "CLE-CHAT"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT"]
area: "CLE-CHAT"
content_hash: "be187d44acf8f9d2c0a5ced33dc2031cb3f9dc8c671f0d9bc2b581fbc7895e7a"
read_as: "approved_fallback"
task: "CLE-T-9Z0V2R"
source_paths: []
mirror_sha256: "1fab391c2b531ae6785afdfb5bc0992174406aa872b6ee4dbe5b628a783a994c"
etag: "sha256-301ddeb4314f34a5d7471f6772003497a51bec8861d10c13bc50707a55d3cc89"
---
> 구현 상태: 부분 구현 · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

`provider: "slack"` 채널 어댑터는 [Slack Web API](https://api.slack.com/web), [Events API](https://api.slack.com/apis/events-api), [Interactivity & Shortcuts](https://api.slack.com/interactivity) 위에서 동작한다. 사용자가 자기 워크스페이스에 Slack 앱을 설치하고 봇 토큰을 등록하면 Events API 구독의 Request URL 검증으로 Slack 에서 우리 웹훅 트리거로 오는 연결이 이어진다. 어댑터는 [채팅 채널 「노드와 채널 UI 매핑」](CLE-CHAT-CORE.md#노드와-채널-ui-매핑) 의 요구사항(REQ-CHAT-018~030)이 다루는 노드를 Slack UI(Block Kit, Modal)로 바꾼다.

1차 범위는 웹훅 모드만 지원한다. Socket Mode(WebSocket 연결)는 후속 범위의 옵션이다(R-S-3). 그래서 사용자는 Slack 앱을 "Event Subscriptions: Request URL" 모드로 설정해야 한다.

이 문서는 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 인터페이스의 Slack 구현을 정한다. 공통 규칙(렌더 매핑, 실행 실패 분류, Form 입력 흐름, 다단계 질문 본문 형식, 시각형 렌더 입력)은 어댑터 규약을, 인바운드 HTTP 응답·명령 공통 의미·재시도 정책은 [채팅 채널](CLE-CHAT-CORE.md) 을, 설정 필드와 안내 문구는 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 을 따른다. 이 문서는 범위 · 요구사항 · 인바운드 응답 예외와 공통 결정을 두고 세부 동작은 「하위 문서」의 두 문서가 정한다.

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
- REQ-SLACK-005 WHEN envelope `type` 이 `url_verification` 이면 THE SYSTEM SHALL 어댑터의 `handshakeResponse` 가 정한 `{ challenge: <받은 값> }` 을 호출자가 `200 OK` 로 보내고 `parseUpdate` 는 `null` 을 돌려준다.
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

요구사항 보충 설명은 다음과 같다. 자세한 동작은 하위 문서의 해당 절에 있다.

- 관련 REQ-SLACK-002·003: 이 다섯 값이 `BOT_TOKEN_INVALID` 판별의 전부이고 목록을 열어 두지 않는다. 목록에 없는 값(`ratelimited` 등)은 `502` 로 간다. 목록을 늘리는 조건과 `token_expired` 이름 구분은 [「setupChannel」](CLE-CHAT-SLACK-OUTBOUND.md#setupchannel) 에 있다.
- 관련 REQ-SLACK-008: 보강 경로와 Form `file` 필드 MIME 검증(Planned)은 [「Events API」](CLE-CHAT-SLACK-INBOUND.md#events-api) 에 있다.
- 관련 REQ-SLACK-014·021: 응답은 Slack 어댑터의 기본 인터랙션 응답(`defaultInteractionResponse`)이 정한다. 경로가 정한 응답(`view_submission` 검증 실패의 `response_action: "errors"`)이 있으면 그것이 먼저다. 슬래시 명령의 기본 응답은 빈 본문이 아니고 REQ-SLACK-043 이 정한다([「Interactivity」](CLE-CHAT-SLACK-INBOUND.md#interactivity)).
- 관련 REQ-SLACK-016·034·035: 활성 실행이 있을 때 기존 실행을 취소하고 새로 시작하는 입력은 `/<prefix> start` 뿐이다. 명령 우선 규칙, 취소 실패 처리, 대화 상태 정리는 [채팅 채널](CLE-CHAT-CORE.md) 의 REQ-CHAT-062~065 가 정한다. 활성 실행이 있는 DM 의 일반 텍스트는 실행 상태 분기(REQ-CHAT-013·014)를 따른다(R-S-10). 워크플로우가 비활성이면 새 실행을 시작할 입력은 버리고 기존 실행도 취소하지 않는다(REQ-CHAT-066). 취소와 새 시작은 구현됐고 시작 안내와 재시작 안내는 아직 보내지 않는다(NERV Task `CLE-T-0400J6`).
- 관련 REQ-SLACK-025: [Form 노드](../CLE-NODE-PRES/CLE-NODE-FORM.md) 에 `validation.preset` 이 아직 없다. Slack 에는 연락처 공유에 해당하는 기능이 없다.
- 관련 REQ-SLACK-027: 현재 구현(`slack-message.renderer.ts`)은 Carousel 카드를 제목·설명 텍스트로만 만든다.
- 관련 REQ-SLACK-036: 취소는 `/<prefix> start` · EIA `cancel` 과 같은 실행 중지 경로(`ExecutionsService.stop`)를 쓴다. 취소한 뒤의 대화 상태 정리는 REQ-CHAT-065 를 따른다. 활성 실행이 없을 때의 안내는 아직 보내지 않고 ack 만 한다(`hooks.service.ts`).
- 관련 REQ-SLACK-037·043·044: 하위 명령 판정, 도움말 문구, 응답 판단과 escape 규칙은 [「Slash Commands」](CLE-CHAT-SLACK-INBOUND.md#slash-commands) 에 있다. 활성 실행 중 `/<prefix> start` 의 기존 실행 취소가 실패하면 이 응답 대신 그 에러로 답한다(REQ-CHAT-064).
- 관련 REQ-SLACK-038·041: 재시도 정책과 중복 제거 키·TTL 은 [채팅 채널](CLE-CHAT-CORE.md)·[채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 이 정한다. 대기 간격은 [「비기능」](CLE-CHAT-SLACK-OUTBOUND.md#비기능) 에 있다.
- 관련 REQ-SLACK-040: 현재 구현은 `429` 의 `Retry-After` 대기만 하고 채널 단위 큐와 메서드별 bucket 은 확인되지 않았다.
- 관련 REQ-SLACK-042: 정리 작업과 유예 안 재발급(A→B→C) 처리는 [「teardownChannel」](CLE-CHAT-SLACK-OUTBOUND.md#teardownchannel) 에 있다. 근거는 [채팅 채널 어댑터 규약 「R-CCA-10 이전 봇 토큰은 24시간 유예가 끝난 정리 작업이 폐기한다」](CLE-CHAT-ADAPTER.md#r-cca-10-이전-봇-토큰은-24시간-유예가-끝난-정리-작업이-폐기한다) 다.

## 하위 문서

- [Slack 어댑터 — 인바운드 파싱과 명령](CLE-CHAT-SLACK-INBOUND.md): 세 envelope(Events API · Interactivity · Slash Commands)의 `ChannelUpdate` 매핑, 중복 제거 키, 슬래시 명령 응답, 명령 처리, 서명 검증과 보안. REQ-SLACK-005 의 `url_verification` 파싱도 여기 있고 Request URL 등록 배경은 Web API 문서의 [「setupChannel」](CLE-CHAT-SLACK-OUTBOUND.md#setupchannel) 에 있다. 요구사항: REQ-SLACK-005~017, REQ-SLACK-030~037, REQ-SLACK-041, REQ-SLACK-043, REQ-SLACK-044.
- [Slack 어댑터 — Web API 와 노드 UI 매핑](CLE-CHAT-SLACK-OUTBOUND.md): Web API 호출 매핑, `setupChannel` · `teardownChannel` · `views.open`, 노드별 Slack UI(멀티턴 AI · 버튼 · Form · 시각형 · Typing · 실행 실패), 발송 비기능. REQ-SLACK-021 의 버튼 클릭 처리 순서는 [「버튼」](CLE-CHAT-SLACK-OUTBOUND.md#버튼) 에 있다. 요구사항: REQ-SLACK-001~004, REQ-SLACK-018~029, REQ-SLACK-038~040, REQ-SLACK-042.

하위 문서가 따르는 [채팅 채널](CLE-CHAT-CORE.md) 요구사항은 실행 상태 분기 REQ-CHAT-013~015, 그룹 대화 거부 REQ-CHAT-017, 봇 토큰 평문 저장 금지 REQ-CHAT-035, 실패 안내의 민감 정보 제외 REQ-CHAT-041, 명령 우선 규칙 REQ-CHAT-062~065, 워크플로우 활성 관문 REQ-CHAT-066~068 이다.

## 시각형 매트릭스

→ [「시각형 매트릭스」](CLE-CHAT-SLACK-OUTBOUND.md#시각형-매트릭스)

## 인바운드 응답

인바운드 HTTP 응답 정책은 [채팅 채널](CLE-CHAT-CORE.md) 의 인바운드 HTTP 응답 계약이 기준이고 여기 사본을 두지 않는다. 기본은 `202 Accepted` 다. 인증 실패 `401` 과 엔드포인트 미존재 `404` 를 포함한 예외 응답 코드 목록은 [채팅 채널 「R-CC-12 인바운드 응답은 202 로 고정하고 401·404 만 예외로 둔다」](CLE-CHAT-CORE.md#r-cc-12-인바운드-응답은-202-로-고정하고-401404-만-예외로-둔다) 에 있다. Slack 예외는 세 가지다.

1. `url_verification` envelope 은 `200 OK + { challenge }` 다.
2. Interactivity 는 3초 안에 `200 OK`(빈 본문이나 `response_action`)이고 `202` 가 아니다.
3. 슬래시 명령은 3초 안에 `200 OK` 와 본인에게만 보이는 `{ response_type: 'ephemeral', text }` 다(R-S-14).

(1)~(3) 은 인바운드 응답 계약의 프로바이더별 응답 예외에 들어 있다(R-S-8, R-S-14). (1) 은 어댑터의 핸드셰이크 응답(`handshakeResponse`)이, (2)·(3) 은 어댑터의 기본 응답(`defaultInteractionResponse`)이 정한다. Interactivity 와 슬래시 명령의 `200` 은 처리 결과와 관계없고 트리거가 비활성이어도 같다(R-S-12, R-S-14). 비활성 트리거의 Events API 메시지와 `url_verification` 은 `202 + { executionId: 'ignored' }` 다(REQ-CHAT-067). 트리거가 활성이면 워크플로우가 비활성이어도 `url_verification` 에는 답한다. 핸드셰이크 응답이 워크플로우 활성 관문보다 앞이기 때문이다([채팅 채널 「인바운드 관문 순서」](CLE-CHAT-CORE.md#인바운드-관문-순서)).

워크플로우가 비활성이면 새 실행을 시작할 update(활성 실행이 없는 DM 의 메시지, `/<prefix> start`)는 버린다. 이때 Interactivity 로 온 클릭은 `200` 빈 본문이고 `/<prefix> start` 는 `200` 과 수신 문구이며 DM 메시지는 `202 + { executionId: 'ignored' }` 다. 진행 중인 DM 의 입력(답장, 버튼, 모달 제출)과 `/<prefix> cancel` 은 그대로 처리한다(REQ-CHAT-066~068, [채팅 채널 「R-CC-28 비활성 워크플로우는 채팅 채널로 새 실행을 시작하지 않는다」](CLE-CHAT-CORE.md#r-cc-28-비활성-워크플로우는-채팅-채널로-새-실행을-시작하지-않는다)). 활성 실행 중 `/<prefix> start` 의 기존 실행 취소가 실패하면 슬래시 명령의 `200` 응답 대신 그 에러로 응답한다(REQ-CHAT-064).

## Slash Commands

→ [「Slash Commands」](CLE-CHAT-SLACK-INBOUND.md#slash-commands)

## 미결 사항

지금 남은 미결 사항은 없다. «help 명령 경로» 와 «슬래시 명령의 3초 응답» 은 2026-11-13 결정으로 닫았다(R-S-14).

## 구현 위치

인바운드 응답 예외의 구현 위치만 여기 둔다. 나머지는 두 하위 문서의 「구현 위치」 절에 있다.

- `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts`: `url_verification` 의 핸드셰이크 응답(`handshakeResponse`), Interactivity 와 슬래시 명령의 기본 응답(`defaultInteractionResponse`)
- `codebase/backend/src/modules/chat-channel/types.ts`: 채널 어댑터의 핸드셰이크 응답 함수(`handshakeResponse`)와 기본 인터랙션 응답 함수(`defaultInteractionResponse`)
- `codebase/backend/src/modules/hooks/hooks.service.ts`, `hooks.controller.ts`: 인바운드 관문(워크플로우 활성 관문 포함), 인터랙션 기본 응답을 응답에 싣는 처리(`handleChatChannelWebhook`, `withDefaultInteractionResponse`)와 200 빈 본문 응답

## Rationale

### R-S-1 inboundSigningRef 단일 슬롯을 함께 쓴다

→ [「R-S-1 inboundSigningRef 단일 슬롯을 함께 쓴다」](CLE-CHAT-SLACK-INBOUND.md#r-s-1-inboundsigningref-단일-슬롯을-함께-쓴다)

### R-S-2 Events API Request URL 을 자동 등록하지 않는다

→ [「R-S-2 Events API Request URL 을 자동 등록하지 않는다」](CLE-CHAT-SLACK-OUTBOUND.md#r-s-2-events-api-request-url-을-자동-등록하지-않는다)

### R-S-3 1차 범위는 웹훅 모드만, Socket Mode 는 후속 범위

Events API 와 Interactivity Request URL 만 쓰는 무상태 HTTP 라 여러 서버 인스턴스 라우팅 부담이 없다. Socket Mode 는 봇마다 오래 유지되는 WebSocket 연결이 필요해 여러 인스턴스 환경의 라우팅·장애 조치 부담이 생긴다. 사설망 안의 Slack 처럼 Socket Mode 가 필요한 경우는 후속 범위로 나눈다.

### R-S-4 채널·그룹·mpim 은 거부하고 DM 만 지원한다

1차 범위 정책([채팅 채널](CLE-CHAT-CORE.md) REQ-CHAT-017)과 맞다. `app_mention` 은 채널과 DM 모두에서 생기므로 채널 멘션은 따로 거부하고 DM 안의 멘션만 `text_message` 로 받는다. 여러 사용자 채널 대응은 후속 범위의 여러 사용자 대화와 함께 간다.

### R-S-5 typing 표시는 보내지 않는다

→ [「R-S-5 typing 표시는 보내지 않는다」](CLE-CHAT-SLACK-OUTBOUND.md#r-s-5-typing-표시는-보내지-않는다)

### R-S-6 Form 은 필드 5개 이하면 모달, 6개 이상이나 multi_step 이면 다단계

→ [「R-S-6 Form 은 필드 5개 이하면 모달, 6개 이상이나 multi_step 이면 다단계」](CLE-CHAT-SLACK-OUTBOUND.md#r-s-6-form-은-필드-5개-이하면-모달-6개-이상이나-multi_step-이면-다단계)

### R-S-7 file_shared 는 files.info 후속 조회를 HooksService 에 맡긴다

→ [「R-S-7 file_shared 는 files.info 후속 조회를 HooksService 에 맡긴다」](CLE-CHAT-SLACK-INBOUND.md#r-s-7-file_shared-는-filesinfo-후속-조회를-hooksservice-에-맡긴다)

### R-S-8 URL Verification 과 Interactivity 는 200 OK 로 답한다

[채팅 채널](CLE-CHAT-CORE.md) 의 인바운드 응답 계약은 `202 Accepted` 가 기준이다([채팅 채널 「R-CC-12 인바운드 응답은 202 로 고정하고 401·404 만 예외로 둔다」](CLE-CHAT-CORE.md#r-cc-12-인바운드-응답은-202-로-고정하고-401404-만-예외로-둔다)). Slack 의 프로바이더별 응답 예외는 세 가지다. 이 항목이 URL Verification 과 Interactivity 두 가지를 더했고 세 번째인 슬래시 명령의 `200` 응답은 [「R-S-14 슬래시 명령은 본인에게만 보이는 문구와 200 으로 답한다」](CLE-CHAT-SLACK-INBOUND.md#r-s-14-슬래시-명령은-본인에게만-보이는-문구와-200-으로-답한다) 가 더했다. URL Verification 은 Slack 이 응답 본문에서 `challenge` 를 꺼내야 하므로 `200 OK + { challenge }` JSON 이 필수다. 이 본문은 Slack 어댑터의 `handshakeResponse` 가 정하고 `HooksService` 는 update 를 처리하지 않고 그 본문을 `200` 응답에 싣는다. Interactivity 3초 ack 는 Slack 이 `200 OK`(또는 `response_action`)만 성공으로 보고 `202` 는 클라이언트에 에러로 보일 수 있다. 응답 계약을 200·202 둘 다 허용으로 넓히면 모든 프로바이더의 응답 정책이 모호해지므로 Slack 만 예외로 두어 변경 범위를 줄인다. 예외 허용 조건은 인바운드 응답 계약의 프로바이더별 응답 예외가 정한다.

트리거가 꺼져 있을 때 이 항목이 더한 두 예외의 응답은 다르다. URL Verification 요청은 handshake 전에 버리고 `202` 로 답한다([채팅 채널 「R-CC-28 비활성 워크플로우는 채팅 채널로 새 실행을 시작하지 않는다」](CLE-CHAT-CORE.md#r-cc-28-비활성-워크플로우는-채팅-채널로-새-실행을-시작하지-않는다)). Interactivity 요청에는 트리거가 꺼져 있어도 `200` 빈 본문으로 답한다([채팅 채널 「R-CC-33 인터랙션은 어느 경로로 끝나도 기본 응답으로 답하고 버린 클릭에는 수신 확인을 보낸다」](CLE-CHAT-CORE.md#r-cc-33-인터랙션은-어느-경로로-끝나도-기본-응답으로-답하고-버린-클릭에는-수신-확인을-보낸다)). 위의 «필수» 는 켜진 트리거가 URL 을 등록할 때의 응답을 가리킨다.

### R-S-9 DM 첫 메시지로 자동 시작한다

→ [「R-S-9 DM 첫 메시지로 자동 시작한다」](CLE-CHAT-SLACK-INBOUND.md#r-s-9-dm-첫-메시지로-자동-시작한다)

### R-S-10 취소 후 새로 시작은 start 명령에만 적용한다

→ [「R-S-10 취소 후 새로 시작은 start 명령에만 적용한다」](CLE-CHAT-SLACK-INBOUND.md#r-s-10-취소-후-새로-시작은-start-명령에만-적용한다)

### R-S-11 이전 봇 토큰의 auth.revoke 는 24시간 유예가 끝난 뒤 부른다

→ [「R-S-11 이전 봇 토큰의 auth.revoke 는 24시간 유예가 끝난 뒤 부른다」](CLE-CHAT-SLACK-OUTBOUND.md#r-s-11-이전-봇-토큰의-authrevoke-는-24시간-유예가-끝난-뒤-부른다)

### R-S-12 Interactivity 는 처리 결과와 트리거 상태에 관계없이 200 으로 답한다

2026-11-12 결정이다(NERV Task `CLE-T-FCBG91`, NERV 질문 `01a1d025-8baf-773f-95fd-201820c7cd5f` 의 사람 답). R-S-8 은 Interactivity 에 `200 OK` 로 답한다고 정했는데 구현은 `block_actions` 에 `202` 와 `{ data }` 봉투로 답해 클라이언트에 에러로 보일 수 있었다. 이 응답은 요청을 받았다는 확인이고 처리 결과를 알리지 않는다. 그래서 파싱 실패, 재도착, 분당 한도 초과, 대기 실행 전달, 새 실행, 워크플로우 비활성 모두 같은 `200` 빈 본문으로 답한다. 경로가 정한 응답(`view_submission` 검증 실패의 `response_action: "errors"`)만 이보다 먼저다.

트리거가 비활성이어도 `200` 으로 답한다. 트리거를 꺼도 DM 에 남은 버튼 메시지는 누를 수 있고 그때 `202` 로 답하면 사용자 화면에 에러가 보일 수 있다. 기본 응답은 외부 호출 없이 요청 본문만 보고 정하므로 비활성 트리거에서는 서명 검증 뒤 외부 호출을 하지 않는다는 규칙(같은 사람 답)을 그대로 지킨다. 비활성 트리거의 Events API 메시지는 지금처럼 `202` 다. 슬래시 명령은 R-S-14 가 `200` 으로 바꿨다.

판단은 채널 어댑터가 한다. Slack 어댑터의 `defaultInteractionResponse` 가 본문의 문자열 `payload` 필드로 Interactivity 를 가르고 `HooksService` 는 프로바이더를 가리지 않고 그 값을 응답에 싣는다.

검토한 다른 선택은 비활성 트리거에 이전처럼 `202` 로 답하는 안이다([채팅 채널](CLE-CHAT-CORE.md) 인바운드 HTTP 응답 계약의 비활성 트리거 행). 트리거를 끈 뒤 누른 버튼마다 사용자 화면에 에러가 보일 수 있어 택하지 않았다.

### R-S-13 옛 문서 절 표기를 지우고 머리 줄과 범위 표기를 고쳤다

NERV Task `CLE-T-1FCGJ1` 에서 찾아갈 수 없는 옛 저장소 문서를 가리키던 `(원본: slack §n)` 표기와 머리 줄 «원문» 경로를 [용어 사전](../CLE-GLOSSARY.md) 원칙 11 에 따라 지웠다. Rationale 번호(R-S-n)와 요구사항의 뜻은 그대로다. REQ-SLACK-025·027·040 이 미구현이고 034~037 이 부분 구현이라 [스펙과 구현 근거 규약](../CLE-ENG/CLE-ENG-SPECEVIDENCE.md) 의 구현 상태를 `부분 구현` 으로 고쳤다. 범위 표기 `v1` · `v2` 는 원칙 6 에 따라 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 과 같은 「1차 범위」 · 「후속 범위」 로 바꿨고(`bot-token.v2` 는 시크릿 참조 이름이라 그대로) 다른 문서의 Rationale 번호(R-CCA-8)는 원칙 10 에 따라 제목을 단 링크로 바꿨다.

### R-S-14 슬래시 명령은 본인에게만 보이는 문구와 200 으로 답한다

→ [「R-S-14 슬래시 명령은 본인에게만 보이는 문구와 200 으로 답한다」](CLE-CHAT-SLACK-INBOUND.md#r-s-14-슬래시-명령은-본인에게만-보이는-문구와-200-으로-답한다)
