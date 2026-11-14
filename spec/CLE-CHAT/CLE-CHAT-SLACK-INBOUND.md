---
id: "CLE-CHAT-SLACK-INBOUND"
title: "Slack 어댑터 — 인바운드 파싱과 명령"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT-SLACK"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT", "CLE-CHAT-SLACK"]
area: "CLE-CHAT"
content_hash: "27566a1ef8b653436e622b484be945cf4b162ee131c4ff5f16335ea1a4cc0e90"
read_as: "approved_fallback"
task: "CLE-T-E90KGZ"
source_paths: []
mirror_sha256: "13142c38ee596d08c2cd92809a153a0c8471a932020ff38e4d3568b5bcc2de2b"
etag: "sha256-643a8e85207bc34f644725c0fcf699aa2c336b71fcfb843f8478ff054f5f1237"
---
## 개요

이 문서는 [Slack 어댑터](CLE-CHAT-SLACK.md) 의 하위 문서로 인바운드 요청의 `ChannelUpdate` 매핑, 중복 제거 키, 슬래시 명령 응답, 명령 처리, 보안을 정한다. 응답 코드 예외는 [Slack 어댑터 「인바운드 응답」](CLE-CHAT-SLACK.md#인바운드-응답) 이 정한다.

## 명령 매핑

Slack 인바운드는 세 가지 envelope(Events API, Interactivity, Slash Commands)로 오고 어댑터가 모두 처리한다.

### Events API

`Content-Type: application/json`, 본문 `{ type: "event_callback", event: {...} }`.

| Slack event | `ChannelUpdate.command` |
|---|---|
| `event.type === "message"`, `event.channel_type === "im"`, `bot_id` 없음, `subtype === undefined` | `{ kind: "text_message", text: event.text }` |
| `event.type === "app_mention"`(모든 채널) | DM 밖 채널은 `null`([R-S-4](CLE-CHAT-SLACK.md#r-s-4-채널그룹mpim-은-거부하고-dm-만-지원한다)). DM 안의 멘션은 `text_message` 로 받는다 |
| `event.type === "file_shared"`, DM | `{ kind: "file_upload", fileId: event.file_id, mimeType: "application/octet-stream" }`(순수 계약). 보강은 호출자(R-S-7) |
| `event.type === "message"`, `event.channel_type ∈ ('channel', 'group', 'mpim')` | `null`. 호출자가 `groupChatRefusal` 안내 |
| `event.type === "message"`, `bot_id` 있음 또는 `subtype === "bot_message"` | `null`. 봇·자기 메시지 무시 |
| 그 밖의 event(`reaction_added`, `team_join` 등) | `null`. 1차 범위에서 처리하지 않는다 |
| envelope `type === "url_verification"` | `null`. 이 경로에서는 `parseUpdate` 를 부르지 않는다. 어댑터의 `handshakeResponse` 가 `{ challenge }` 를 정하고 호출자가 update 를 처리하지 않고 그 본문을 200 으로 보낸다 |

`file_shared` 의 보강은 채널 어댑터의 `enrichInbound`(HooksService 가 부른다)가 `SlackClient.filesInfo` 로 한다. 진행 중인 다단계 질문에서는 `handleFormStep` 이 `file_upload` 를 폼 필드 값으로 쌓아 `submit_form` 을 부른다(`hooks.service.ts`, 구현됨). Form `file` 필드의 MIME 검증은 다단계 질문이 필드 제약을 상태에 저장하지 않는 `formState` 의 1차 범위 한계에 걸려 Planned 다.

### Interactivity

`Content-Type: application/x-www-form-urlencoded`, 본문 `payload=<JSON>`.

| `payload.type` | `ChannelUpdate.command` |
|---|---|
| `"block_actions"`, `actions[0].action_id === "__open_form__"` | `{ kind: "open_form_modal", openContext: { triggerId } }`. `HooksService` 가 `trigger_id` 로 `views.open` 을 부른다 |
| `"block_actions"`(버튼) | `{ kind: "button_callback", callbackData: payload.actions[0].value }` |
| `"block_actions"`(select 메뉴) | `{ kind: "button_callback", callbackData: payload.actions[0].selected_option.value }` |
| `"view_submission"`, `view.callback_id === "clemvion_form"` | `{ kind: "form_submission", fields }`. `view.state.values` 를 `{ <field.name>: rawValue }` 로 편다(block_id 가 필드 이름, 요소 값 추출, [R-S-6](CLE-CHAT-SLACK-OUTBOUND.md#r-s-6-form-은-필드-5개-이하면-모달-6개-이상이나-multi_step-이면-다단계)) |
| `"shortcut"`·`"message_action"`·`"view_closed"` | 1차 범위는 `null`. `view_closed` 뒤에도 실행은 입력 대기를 유지하고 버튼 메시지가 남아 다시 누를 수 있다 |

Slack Interactivity 는 3초 안에 `200 OK` 를 받아야 한다. 이 수신 확인은 웹훅 HTTP 응답이 맡는다. 응답은 `200 OK` 이고 경로가 정한 `response_action`(모달 검증 실패의 `errors`)이 없으면 본문을 비운다([Slack 어댑터 「R-S-8」](CLE-CHAT-SLACK.md#r-s-8-url-verification-과-interactivity-는-200-ok-로-답한다)). 처리 결과(무시 · 대기 실행 전달 · 새 실행)와 트리거 활성 여부에 관계없이 같다([Slack 어댑터 「R-S-12」](CLE-CHAT-SLACK.md#r-s-12-interactivity-는-처리-결과와-트리거-상태에-관계없이-200-으로-답한다)).

판단은 Slack 어댑터의 기본 인터랙션 응답(`defaultInteractionResponse`)이 본문의 문자열 `payload` 필드로 한다. `HooksService` 는 서명 검증 직후 이 값을 구해 두고 응답에 싣는다. 컨트롤러는 이 응답을 봉투 없이 `200` 빈 본문으로 보낸다. 새 실행의 호출 이력 응답 코드(`response_code`)도 `200` 으로 남는다. 비동기 갱신용 `response_url`(1시간 유효, 5회 한도)의 `replace_original` POST 는 `ackInteraction` 이 한다(버튼 선택 뒤 «선택 완료» 로 갱신. [Slack 어댑터 — Web API 와 노드 UI 매핑 「버튼」](CLE-CHAT-SLACK-OUTBOUND.md#버튼)).

### Slash Commands

`Content-Type: application/x-www-form-urlencoded`, 본문 `{ command, text, ... }`.

| 매핑 | `ChannelUpdate.command` |
|---|---|
| `command === "/<configured-prefix>"`, `text === "start"`(또는 빈 text) | `{ kind: "start" }` |
| `command === "/<configured-prefix>"`, `text === "cancel"` | `{ kind: "cancel" }` |
| `command === "/<configured-prefix>"`, `text === "help"` | `null`. 도움말은 슬래시 명령의 HTTP 응답에 싣는다 |
| 그 밖의 text | `{ kind: "text_message", text: body.text }` |

Slack slash command 는 워크스페이스마다 prefix 하나만 등록할 수 있어 트리거별로 나눌 수 없다. 1차 범위 정책은 다음과 같다.

- 사용자가 Slack 앱 manifest 에 slash command 하나(`/<prefix>`, 가이드 기본값 `/workflow`)를 등록한다.
- DM 에서 봇과 바로 대화하면 slash command 없이 자동으로 시작한다(Telegram `/start` 와 같다, R-S-9). 대화가 없으면 [채팅 채널 「대화 매핑」](CLE-CHAT-CORE.md#대화-매핑) 의 규칙대로 새 실행을 시작한다.
- slash command 는 보조 명령이다(`/workflow cancel` 로 활성 실행 취소 등).

**응답**: 슬래시 명령에는 3초 안에 `200 OK` 와 `{ response_type: 'ephemeral', text }` 로 답한다. `ephemeral` 이라 명령을 보낸 사람에게만 보인다. `help` 는 도움말을 싣고 그 밖의 명령은 수신 문구(`languageHints.commandReceived`, 없으면 `languageLocale` 기본 문구)를 싣는다. 처리가 새 실행 · 취소 · 답장 전달 · 중복 · 분당 한도 초과 · 워크플로우 비활성 어느 쪽으로 끝나도 같고 트리거가 비활성이어도 같다. 이때 실행은 시작하지 않는다(R-S-14). Interactivity 의 기본 응답(`200` 빈 본문)과는 본문만 다르다. 활성 실행 중 `/<prefix> start` 의 기존 실행 취소가 실패하면 이 응답 대신 그 에러로 답한다([채팅 채널 「R-CC-27 활성 실행 중 /start 는 기존 실행을 취소하고 새로 시작한다」](CLE-CHAT-CORE.md#r-cc-27-활성-실행-중-start-는-기존-실행을-취소하고-새로-시작한다)).

- 응답 판단은 `defaultInteractionResponse` 가 한다. 본문에 문자열 `command` · `text` 가 있고 Events API · `url_verification` · Interactivity 가 아니면 슬래시 명령으로 본다. 파서와 같은 판정이다. `HooksService` 는 서명 검증 직후 이 값을 구해 두고 응답에 싣는다. 기본 응답은 요청 본문만 보고 만들어 외부 호출이 없다. 슬래시 명령으로 시작한 새 실행의 호출 이력 응답 코드(`response_code`)는 `'200'` 이다.
- 수신 문구 기본값(ko `요청을 받았습니다.`, en `Request received.`)은 [채팅 채널 데이터와 흐름 「안내 문구 기본값」](CLE-CHAT-DATA.md#안내-문구-기본값) 이 정한다.
- 응답 `text` 는 Slack 이 mrkdwn 으로 렌더하므로 다른 안내 문구와 같은 `escapeSlackMrkdwn` 으로 `&`·`<`·`>` 를 escape 한다. 도움말도 같다.
- **도움말**: 파서는 `help` 에 update 를 만들지 않는다(`null`). 그래서 `/<prefix> help` 는 실행으로 가지 않고 별도 메시지도 보내지 않으며 도움말은 HTTP 응답 하나로 나간다. 하위 명령은 기본 응답이 파서와 같은 규칙(`readSlackSlashInvocation`)으로 읽는다. `languageHints.help` 가 있으면 그 문구를 그대로 쓰고 `{prefix}` 를 바꾸지 않는다. 없으면 Discord 와 함께 쓰는 locale 기본 도움말(`SLASH_HELP_DEFAULTS`)의 `{prefix}` 에 요청의 `command` 를 넣는다. 앞의 `/` 는 빼고 비어 있으면 `workflow` 를 넣는다. `languageHints.slashPrefix` 는 쓰지 않는다.
- 시작 안내와 재시작 안내는 이 응답과 별개다([「명령 처리」](#명령-처리)).

### 중복 제거 키

세 envelope 모두 `idempotencyKey` 를 envelope 별로 만든다. Events API 는 `event_id`(Slack 이 재전송 때 같은 값을 보낸다), Interactivity 는 `payload.trigger_id`(1시간 유효, 1회용 의도지만 재전송 때 다시 쓴다), Slash Commands 는 `body.trigger_id` 다. 만들지 못하면(빈 값) 파서가 `null` 을 돌려 update 자체가 버려지므로 중복 제거 대상인데 키가 없는 상태는 생기지 않는다.

인바운드 중복 제거는 구현됐다(2026-08-13). 같은 키가 30초 안에 다시 오면 무시한다(Slack 은 `X-Slack-Retry-Num` 으로 3회까지 재전송). `ChatChannelDedupService` 가 Redis `SET NX EX 30`, 키 `cc:dedup:<triggerId>:<idempotencyKey>` 로 인바운드 진입의 분당 한도 앞에서 거른다. Redis 가 없으면 통과시킨다. 키·TTL·게이트 순서는 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 이 정한다.

## 명령 처리

| 사용자 입력 | 어댑터 처리 |
|---|---|
| DM 첫 메시지나 `/<prefix> start`(활성 실행 없음) | 새 실행 시작, `languageHints.executionStarted` 안내. 안내는 아직 보내지 않는다(NERV Task `CLE-T-0400J6`) |
| `/<prefix> start`(활성 실행 있음) | 기존 실행을 실행 중지 경로(`ExecutionsService.stop`)로 취소하고 새 실행 시작, "기존 대화를 종료하고 새로 시작합니다." 안내. 기존 실행이 이미 끝났거나 지워졌으면 취소 없이 시작한다. 워크플로우가 비활성이면 버리고 기존 실행을 취소하지 않는다. 기준은 [채팅 채널 「활성 실행 중 다시 시작」](CLE-CHAT-CORE.md#활성-실행-중-다시-시작) 과 [「인바운드 관문 순서」](CLE-CHAT-CORE.md#인바운드-관문-순서) 다. 안내는 아직 보내지 않는다(NERV Task `CLE-T-0400J6`) |
| DM 메시지(활성 실행 있음) | 기존 실행을 취소하지 않는다. 입력 대기면 대기 노드로 전달하고 `running`·`pending` 이면 `languageHints.executionStillRunning` 안내 뒤 버린다([채팅 채널 「대화 매핑」](CLE-CHAT-CORE.md#대화-매핑) 의 실행 상태 분기, R-S-10) |
| `/<prefix> cancel` | 활성 실행을 실행 중지 경로(`ExecutionsService.stop`, EIA `cancel` 과 같은 경로)로 취소. 없으면 아무것도 하지 않고 "진행 중인 대화가 없습니다." 안내. 이 안내는 아직 보내지 않는다 |
| `/<prefix> help` | 실행으로 보내지 않는다. 슬래시 명령의 HTTP 응답에 도움말(`languageHints.help` 나 요청의 명령 이름을 넣은 기본 도움말)을 싣고 본인에게만 보인다 |
| 그 밖의 slash text | `text_message` 로 받는다. 멀티턴 AI 진행 중이면 답장이고 아니면 안내 |

Telegram 의 `/start`·`/cancel`·`/help` 와 뜻이 1:1 이고 Slack 은 prefix 하나의 하위 명령으로 표현한다. 슬래시 명령으로 온 입력의 HTTP 응답은 어느 행이든 [「Slash Commands」](#slash-commands) 의 응답이다. 취소 동작이 EIA `cancel` 과 같은 근거는 [채팅 채널 「R-CC-27 활성 실행 중 /start 는 기존 실행을 취소하고 새로 시작한다」](CLE-CHAT-CORE.md#r-cc-27-활성-실행-중-start-는-기존-실행을-취소하고-새로-시작한다) 에 있다.

## 보안

- 봇 토큰(Slack `xoxb-*`)은 `botTokenRef`(`secret://triggers/{id}/bot-token`)만 설정에 둔다. 평문 저장은 금지다([채팅 채널 「신뢰성과 보안」](CLE-CHAT-CORE.md#신뢰성과-보안)).
- 시크릿 참조만 다루고 평문을 설정 · 로그 · metric 에 내놓지 않는 규칙과 API 클라이언트의 실패 문장에서 봇 토큰을 지우는 규칙은 [채팅 채널 어댑터 규약 「규칙」](CLE-CHAT-ADAPTER.md#규칙) 10 이 정한다.
- **Signing secret**: Slack [요청 검증](https://api.slack.com/authentication/verifying-requests-from-slack)은 `X-Slack-Signature: v0=<HMAC-SHA256(signing_secret, "v0:" + X-Slack-Request-Timestamp + ":" + raw_body)>` 형식이다. signing secret 은 `SecretResolver` 가 관리하고 참조는 `secret://triggers/{id}/inbound-signing` 이다([시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 의 프로바이더 공통 슬롯).
  - 형식(Slack 발급 표준)은 `^[a-f0-9]{32}$`(소문자 hex 32자)다. 트리거 생성 때 `assertInboundSigningPlaintextByProvider`(`chat-channel-input-rules.ts`, `TriggersService` 가 생성 경로에서 부른다)가 검증하고 어기면 `400 VALIDATION_ERROR` 다. 대문자 hex 는 Slack HMAC 검증을 실패시키므로 미리 막는다.
  - 진입점이 raw body 와 두 헤더를 읽고 `SecretResolver.resolve(inboundSigningRef)` 뒤 HMAC-SHA256 을 다시 계산해 상수 시간 비교한다. 다르면 `401 Unauthorized` 다.
- **재전송 공격 차단**: `X-Slack-Request-Timestamp` 가 현재 시각 ±5분 밖이면 `401`(Slack 권장).
- **설정 필드**: `inboundSigningRef` 는 Telegram·Discord 와 같은 슬롯이다. 자원 성격과 검증 알고리즘은 백엔드가 프로바이더별로 나눈다([채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md)). Slack 은 앱 설치 때 Slack 이 발급해 사용자가 직접 입력하는 프로바이더 발급 자료다. 입력 평문이 바로 `SecretResolver.rotate` 로 들어가고 참조만 설정에 남는다. `SetupResult.issuedInboundSigning` 은 채우지 않는다(R-S-1).
- 채널·그룹·mpim 이벤트는 진입점에서 `event.channel_type !== "im"` 으로 막고 `groupChatRefusal` 안내 뒤 버린다([채팅 채널 「대화 매핑」](CLE-CHAT-CORE.md#대화-매핑) 의 그룹 대화 거부).
- 다른 봇이 보낸 메시지(`bot_id` 있음)도 무시한다.
- **네이티브 모달 `private_metadata`(위험 수용)**: `openFormModal` 이 view 의 `private_metadata` 에 대화 키(DM 채널 ID, 예: `D0123ABCD`)를 평문으로 담는다. `view_submission` 에 채널 ID 가 없어 제출 때 대화를 되찾는 데 필요하다. Slack 서버가 이 값을 보고 보관할 수 있지만 (a) 채널 ID 는 비밀이 아니고(Slack 이 이미 안다) (b) 봇 토큰·signing secret 같은 자격 증명은 전혀 넣지 않으므로 위험을 받아들인다. 자격 증명과 개인정보는 `private_metadata` 에 절대 넣지 않는다([시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 14).

## 구현 위치

- `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts`: Interactivity 와 슬래시 명령의 기본 응답(`defaultInteractionResponse`), 슬래시 명령 도움말(`resolveSlackHelpText`), `response_url` 갱신(`ackInteraction`)
- `codebase/backend/src/modules/chat-channel/providers/slack/slack-signing.ts`
- `codebase/backend/src/modules/chat-channel/providers/slack/slack-update.parser.ts`: 슬래시 명령 판정과 하위 명령(`readSlackSlashInvocation`, `SLACK_SLASH_HELP_SUBCOMMAND`)
- `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts`: 슬래시 명령 기본 도움말(`SLASH_HELP_DEFAULTS`, Discord 와 함께 쓴다)과 수신 문구 기본값
- `codebase/backend/src/modules/chat-channel/types.ts`: 채널 어댑터의 기본 인터랙션 응답 함수(`defaultInteractionResponse`)
- `codebase/backend/src/modules/chat-channel/chat-channel-inbound-authenticator.ts`
- `codebase/backend/src/modules/hooks/hooks.service.ts`, `hooks.controller.ts`: 인바운드 관문(워크플로우 활성 관문 포함), 명령 처리(활성 실행 중 `/<prefix> start` 의 기존 실행 취소), 인터랙션 기본 응답을 응답에 싣는 처리(`handleChatChannelWebhook`, `withDefaultInteractionResponse`)와 200 빈 본문 응답
- `codebase/backend/src/modules/hooks/hooks.service.spec.ts`: 세 프로바이더의 활성 실행 중 start 명령, 「인터랙션 기본 응답」
- `codebase/backend/src/modules/hooks/hooks.controller.spec.ts`, `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.spec.ts`: Interactivity 의 200 빈 본문
- `codebase/packages/chat-channel-validation/src/index.ts`
- `codebase/backend/test/chat-channel-slack.e2e-spec.ts`(「Interactivity 응답」 · 「슬래시 명령의 응답」 포함), `chat-channel-trigger-create.e2e-spec.ts`

## Rationale

### R-S-1 inboundSigningRef 단일 슬롯을 함께 쓴다

Telegram secret_token, Slack signing secret, Discord public key 는 모두 "인바운드 웹훅 출처 검증 자료" 라는 같은 역할이라 `inboundSigningRef?` 슬롯 하나를 함께 쓴다. 슬롯을 하나로 두면 (a) 규약의 필드가 줄고 (b) 새 프로바이더가 참조 필드를 새로 만들 필요가 없고 (c) 카탈로그와 데이터 모델의 이름이 일관된다. 발급 주체와 검증 알고리즘의 차이는 이미 `provider` 로 나뉘는 백엔드 분기가 흡수한다. 소유가 모호해질 수 있다는 우려는 백엔드 분기와 `SetupResult.issuedInboundSigning` 의 "서버 발급만" 명시로 풀린다. Slack 자원은 `secret://triggers/{id}/inbound-signing` 에 두고 SlackAdapter 가 HMAC-SHA256 으로 검증한다. 운영 데이터가 없어 마이그레이션이 필요 없다.

### R-S-7 file_shared 는 files.info 후속 조회를 HooksService 에 맡긴다

`parseUpdate` 의 순수 계약을 지키고 `HooksService` 가 `files.info` 를 부른다. `parseUpdate` 는 mimeType 을 모르는 자리표시(`application/octet-stream`)로 `file_upload` 를 바로 돌려준다. 호출자가 받은 직후 [`files.info`](https://api.slack.com/methods/files.info) 한 번으로 mimeType·filename·url_private 을 보강한다. 그 값으로 Form `file` 필드의 `allowedMimeTypes`·`maxFileSize` 를 1차 검증하고 EIA `submit_form` 에 `{ fileId, filename, mimeType, urlPrivate }` 를 넣는다. 실패하면 `currentFieldIdx` 를 되돌리고 `form_prompt` 를 다시 보낸다. `parseUpdate` 를 async 부수 효과로 풀면 Telegram 파서의 순수한 단순성을 잃는다. 보강 책임을 호출자로 모으면 다른 파일 수신 프로바이더(Telegram `document`, Discord 후속 범위의 Gateway 첨부)도 같은 방식을 다시 쓸 수 있다.

### R-S-9 DM 첫 메시지로 자동 시작한다

Telegram `/start` 와 뜻이 같고 slash command prefix 가 워크스페이스마다 하나라는 Slack 제약을 피한다. `/workflow start` 를 의무로 두면 매번 명령을 쳐야 해 DM 봇 UX 와 맞지 않는다(게다가 prefix 가 트리거마다 달라야 의미가 있는데 Slack 은 그럴 수 없다). `app_home` 진입 때 자동 시작하는 안은 Home 탭이 별도 표면이라 찾기 어렵다. slash command 는 cancel·help 같은 명시 명령의 보조 도구다.

### R-S-10 취소 후 새로 시작은 start 명령에만 적용한다

2026-10-10 결정이다(NERV Task `CLE-T-V4WVF2`). DM 텍스트는 멀티턴 AI 답장과 다단계 질문 답변이 들어오는 길이라 활성 실행 중 DM 메시지를 재시작으로 보면(이전 명령 처리 표의 규칙) 대화 중 답장마다 실행이 새로 시작된다. 그래서 재시작은 명시 명령인 `/<prefix> start` 에만 두고 DM 텍스트는 [채팅 채널 「대화 매핑」](CLE-CHAT-CORE.md#대화-매핑) 의 실행 상태 분기대로 처리한다. 명령 우선 규칙의 근거는 [채팅 채널 「R-CC-27 활성 실행 중 /start 는 기존 실행을 취소하고 새로 시작한다」](CLE-CHAT-CORE.md#r-cc-27-활성-실행-중-start-는-기존-실행을-취소하고-새로-시작한다) 에 있다. 이 결정으로 미결 «활성 실행 중 DM 메시지» 를 닫았다.

### R-S-14 슬래시 명령은 본인에게만 보이는 문구와 200 으로 답한다

2026-11-13 결정이다(NERV Task `CLE-T-MGZRRP`, NERV 질문 `01a1d2f3-e188-7354-8298-243092419a3c` 의 사람 답).

이 결정 전에는 슬래시 명령에 `202` 와 `{ data }` 봉투로 답했다. Slack 은 슬래시 명령에 3초 안에 `200` 을 받지 못하면 사용자 화면에 오류를 표시해서 명령을 처리해도 오류가 떴다. `/<prefix> help` 는 파서가 `text_message`("help")로 바꿨는데 `HooksService` 는 텍스트가 정확히 `/help` 일 때만 도움말을 보내서 Slack 에서는 도움말이 나가지 않았다.

이제 슬래시 명령에는 어느 경로로 끝나도 `200` 과 `{ response_type: 'ephemeral', text }` 로 답한다. [Discord 어댑터 「R-D-12 슬래시 명령은 본인에게만 보이는 type 4 로 바로 답하고 비활성 트리거도 인터랙션 응답으로 답한다」](CLE-CHAT-DISCORD.md#r-d-12-슬래시-명령은-본인에게만-보이는-type-4-로-바로-답하고-비활성-트리거도-인터랙션-응답으로-답한다) 의 2026-11-12 결정과 같은 모양이라 두 프로바이더의 슬래시 명령이 같은 수신 문구와 같은 기본 도움말을 쓴다. 트리거가 비활성이어도 같은 응답으로 답한다. 응답은 요청 본문만 보고 외부 호출 없이 만들므로 비활성 트리거에서 외부 호출을 하지 않는다는 규칙을 그대로 지킨다([Slack 어댑터 「R-S-12」](CLE-CHAT-SLACK.md#r-s-12-interactivity-는-처리-결과와-트리거-상태에-관계없이-200-으로-답한다) 와 같은 근거).

도움말은 `ChannelUpdate` 의 새 kind 로 두지 않았다. 파서는 `help` 에 update 를 만들지 않고 어댑터의 기본 응답이 도움말을 싣는다. 파서와 어댑터는 같은 함수(`readSlackSlashInvocation`)로 하위 명령을 읽어 응답 문구와 파서가 만드는 명령이 서로 어긋나지 않는다.

기본 도움말의 명령 이름은 `languageHints.slashPrefix` 가 아니라 요청의 `command` 에서 읽는다. Slack 은 명령 이름을 앱 manifest 에서 정하고 요청마다 `command` 로 보내므로 설정값이 manifest 와 달라도 도움말에는 사용자가 실제로 입력한 명령이 나온다.

escape 는 `languageHints` 문구의 `<…>` 가 링크나 멘션 문법으로 해석되지 않게 하려는 것이다. Discord 응답 본문은 escape 하지 않는다.

기각한 대안은 빈 본문 `200` 만 돌려주는 안이다. 오류는 표시되지 않지만 사용자 화면에 아무것도 남지 않아 명령이 받아들여졌는지 알 수 없고 `help` 의 도움말도 실을 곳이 없어 메시지를 따로 보내야 한다. 이전처럼 `202` 와 `{ data }` 봉투로 답하는 안은 Slack 이 오류로 표시하므로 남길 수 없었다.
