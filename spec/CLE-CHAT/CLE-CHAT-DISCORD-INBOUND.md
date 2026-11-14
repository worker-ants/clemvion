---
id: "CLE-CHAT-DISCORD-INBOUND"
title: "Discord 어댑터 — 인바운드 처리와 응답"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT-DISCORD"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT", "CLE-CHAT-DISCORD"]
area: "CLE-CHAT"
content_hash: "9f756ff3c4539e79df3c2184e76bf5de4ed69f5e4e2268625476df6fe1cb559b"
read_as: "approved_fallback"
task: "CLE-T-NMTWSN"
source_paths: []
mirror_sha256: "bbb24a7fd52371c3227b3d80732540f7f20ce3ebdea82329cd6a952a78a62222"
etag: "sha256-3b9b03af164c46287669107d67ff0861c962639cac8f8db5af15b6c0839aa6cb"
---
## 개요

이 문서는 [Discord 어댑터](CLE-CHAT-DISCORD.md) 의 하위 문서로 Interactions payload 의 명령 매핑, 인터랙션 종류별 웹훅 HTTP 응답, 서명 검증과 보안, 명령 처리를 정한다. 어댑터 함수와 Discord API 의 대응, 노드 UI 매핑은 [Discord 어댑터 — API 호출과 UI 매핑](CLE-CHAT-DISCORD-API.md) 이 정한다.

Rationale 의 R-D-1·R-D-3·R-D-4 는 [Discord 어댑터](CLE-CHAT-DISCORD.md#rationale), R-D-2·R-D-5·R-D-6·R-D-7·R-D-9 는 [Discord 어댑터 — API 호출과 UI 매핑](CLE-CHAT-DISCORD-API.md#rationale) 에 있다.

## 명령 매핑

Discord Interactions Webhook 은 envelope 하나(`type` 필드로 분기, `Content-Type: application/json`)다.

| Discord payload | `ChannelUpdate.command` |
|---|---|
| `type === 1`(PING) | `null`. 응답은 [PING 핸드셰이크](#ping-핸드셰이크) 가 정한다 |
| `type === 2`(APPLICATION_COMMAND), `data.options[0].name === "start"` | `{ kind: "start" }` |
| `type === 2`, `data.options[0].name === "cancel"` | `{ kind: "cancel" }` |
| `type === 2`, `data.options[0].name === "reply"` | `{ kind: "text_message", text: <message option> }`(멀티턴 AI 답장) |
| `type === 2`, `data.options[0].name === "help"` | `null`. 도움말은 어댑터의 기본 응답이 본인에게만 보이는 `{ type: 4 }` 로 바로 보낸다([인바운드 응답](#인바운드-응답)). EIA 를 부르지 않는다 |
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

중복 제거 키(`idempotencyKey`)는 `interaction.id` 를 그대로 쓴다. Discord 가 interaction 마다 snowflake id 를 붙이고 재전송 때 같은 id 를 보낸다. 30초 TTL·Redis 키·게이트 순서는 [Discord 어댑터 — API 호출과 UI 매핑 「비기능」](CLE-CHAT-DISCORD-API.md#비기능) 에 있다.

## 인바운드 응답

Discord Interactions 는 3초 안에 interaction response 객체로 답해야 한다. 응답이 늦거나 그 객체가 아니면(`202` 와 `{ data }` 봉투 등) Discord 는 인터랙션을 실패로 보고 사용자 화면에 실패를 띄운다(R-D-11). 이 응답은 웹훅 HTTP 응답이 맡는다. `HooksController` 는 인터랙션 응답 본문을 `{ data }` 봉투 없이 `200 OK` 로 보낸다. `ackInteraction` 은 빈 구현이다.

| 인터랙션과 경로 | 웹훅 HTTP 응답 |
|---|---|
| PING(`type: 1`), 트리거 활성(워크플로우가 비활성이어도) | `200 OK` + `{ type: 1 }`([PING 핸드셰이크](#ping-핸드셰이크)) |
| PING, 트리거 비활성 | `202` + `{ data: { executionId: 'ignored' } }`. Interactions Endpoint URL 등록이 실패한다 |
| 슬래시 명령(`type: 2`) `help`. 트리거 비활성을 포함한 모든 경로 | `200 OK` + `{ type: 4, data: { content: <도움말>, flags: 64 } }` |
| `help` 밖의 슬래시 명령(`start`·`cancel`·`reply` 와 해석하지 못한 명령). 새 실행, 취소, 답장 전달, 버린 경로 전부(중복, 분당 한도 초과, 실행 중, 워크플로우 비활성, 워크플로우 없음, 파싱 실패, DM 밖 채널), 트리거 비활성 | `200 OK` + `{ type: 4, data: { content: <수신 문구>, flags: 64 } }` |
| 컴포넌트(`type: 3`) `__open_form__`·`__reply__` 클릭으로 모달을 연 경우 | `200 OK` + `{ type: 9, data: <modal> }`(`openFormModal`) |
| 모달 제출(`type: 5`) `clemvion_form` 을 처리한 경우(검증 실패 포함) | `200 OK` + `{ type: 4, data: { content, flags: 64 } }`(`buildFormSubmissionResponse`). 본인에게만 보이는 메시지다 |
| 그 밖의 컴포넌트(버튼, 셀렉트)와 모달 제출(Reply 모달 `clemvion_reply`, 버려진 `clemvion_form` 등). 처리한 경로, 버린 경로 전부, 트리거 비활성 | `200 OK` + `{ type: 6 }`(DEFERRED_UPDATE_MESSAGE) |
| 자동완성(`type: 4`, APPLICATION_COMMAND_AUTOCOMPLETE)과 알 수 없는 `type` | `202` + `{ data: { executionId: 'ignored' } }`. v1 은 처리하지 않는다 |

도움말은 `languageHints.help` 가 비어 있지 않으면 그 문구다. 없으면 `languageLocale` 이 `en` 일 때 영어, 그 밖에는 한국어 기본 도움말이고 `{prefix}` 자리에 `languageHints.slashPrefix`(없으면 `workflow`. slash command 등록과 같은 값)를 넣는다.

```text
/{prefix} start - 새 대화 시작
/{prefix} cancel - 진행 중인 대화 취소
/{prefix} reply - 진행 중인 대화에 답장
/{prefix} help - 도움말
```

영어 기본 도움말은 같은 네 줄이고 설명은 `Start a new conversation`, `Cancel the active conversation`, `Reply to the active conversation`, `Show help` 다.

수신 문구는 `languageHints.commandReceived` → `languageLocale` 기본값(ko `요청을 받았습니다.`, en `Request received.`) → ko 순서로 찾는다. 안내 문구 키와 기본값의 기준은 [채팅 채널 데이터와 흐름 「안내 문구 기본값」](CLE-CHAT-DATA.md#안내-문구-기본값) 이다. 슬래시 명령이 어느 경로로 끝났는지는 이 응답에 드러나지 않는다(R-D-12).

- 처리 경로가 응답 본문을 이미 만들었으면(`{ type: 9 }` 모달 열기, `{ type: 4 }` Form 제출 결과) 그 본문을 보내고, 없으면 기본 응답을 보낸다.
- 트리거가 비활성이어도 서명 검증을 통과한 슬래시 명령, 컴포넌트, 모달 제출에는 활성일 때와 같은 기본 응답으로 답한다. 실행은 시작하지 않고 외부 API 도 부르지 않는다. PING 은 트리거 활성 관문 뒤의 핸드셰이크라 `202` 다(R-D-12).
- 활성 실행 중 `/<prefix> start` 의 기존 실행 취소가 실패하면 기본 응답 대신 그 에러(`503` 등)로 답한다([채팅 채널](CLE-CHAT-CORE.md) 의 명령 우선 규칙, R-CC-27).
- 슬래시 명령, 컴포넌트, 모달 제출로 새 실행을 시작하면 그 실행의 `response_code` 는 실제로 보낸 응답 코드인 `'200'` 이다.
- `{ type: 5 }`(DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE)를 보내는 경로는 없다. 원본 메시지를 비동기로 갱신하는 `PATCH /webhooks/{app_id}/{interaction_token}/messages/@original`(15분 유효)도 지금 쓰지 않는다.

### PING 핸드셰이크

PING(`type: 1`)은 Discord 가 Interactions Endpoint URL 을 등록할 때 한 번, 그 뒤 주기적으로 보낸다. 어댑터의 선택 함수 `handshakeResponse`([채팅 채널 어댑터 규약 「채널 어댑터 인터페이스」](CLE-CHAT-ADAPTER.md#채널-어댑터-인터페이스))가 `{ type: 1 }` 본문을 만들고 `HooksService` 가 그 본문을 `200 OK` 로 답한다. 이때 `parseUpdate` 는 부르지 않는다. Discord 는 PING 에 `200 + { type: 1 }` 만 성공으로 보므로 [채팅 채널](CLE-CHAT-CORE.md) 인바운드 응답 계약의 `202` 고정 정책에 대한 명시적 예외다(R-D-8).

트리거가 활성이면 워크플로우가 비활성이어도 답한다(2026-10-10 사용자 결정). 워크플로우가 비활성인 채로 Interactions Endpoint URL 을 등록해도 실패하지 않게 하려는 것이다. 관문은 트리거 활성 관문, 핸드셰이크 응답, …, 워크플로우 활성 관문 순서로 놓이므로 핸드셰이크 응답 단계에서는 워크플로우 상태를 확인하지 않는다. 순서의 기준은 [채팅 채널 「인바운드 관문 순서」](CLE-CHAT-CORE.md#인바운드-관문-순서) 다.

트리거가 비활성이면 PING 에 답하지 않고 `202`·`{ executionId: 'ignored' }` 다([채팅 채널 「인바운드 관문 순서」](CLE-CHAT-CORE.md#인바운드-관문-순서) 의 트리거 활성 관문, [채팅 채널 「R-CC-28 비활성 워크플로우는 채팅 채널로 새 실행을 시작하지 않는다」](CLE-CHAT-CORE.md#r-cc-28-비활성-워크플로우는-채팅-채널로-새-실행을-시작하지-않는다)). 그래서 트리거가 비활성이면 Interactions Endpoint URL 등록도 실패한다.

### 응답 종류의 조건

응답 종류는 Discord 의 [interaction callback type](https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-response-object-interaction-callback-type) 조건에 따라 고른다.

- `{ type: 6 }`(DEFERRED_UPDATE_MESSAGE)은 화면을 바꾸지 않고 받았다는 것만 알린다. Discord 문서는 이 응답을 MODAL_SUBMIT 과 컴포넌트 인터랙션에만 쓸 수 있다고 적는다. 조건은 인터랙션 종류이고 모달을 컴포넌트에서 열었는지는 따지지 않으므로 모든 모달 제출에 쓸 수 있다. 이 시스템의 모달은 모두 컴포넌트(`__open_form__`·`__reply__` 버튼)에서 연다.
- 슬래시 명령(APPLICATION_COMMAND)에는 `{ type: 6 }` 을 쓸 수 없다. 그래서 메시지를 싣는 `{ type: 4 }`(CHANNEL_MESSAGE_WITH_SOURCE)로 바로 답하고 `flags: 64`(EPHEMERAL)를 붙여 명령을 보낸 사용자에게만 보이게 한다.

### 응답을 정하는 위치

기본 응답은 어댑터의 선택 함수 `defaultInteractionResponse`([채팅 채널 어댑터 규약 「채널 어댑터 인터페이스」](CLE-CHAT-ADAPTER.md#채널-어댑터-인터페이스))가 만든다. Discord 구현은 `discord-interaction-response.ts` 의 `buildDiscordDefaultInteractionResponse` 다. 원본 본문의 `type` 과 하위 명령 이름만 보고 외부 호출 없이 응답을 만든다. `HooksService` 는 서명 검증 직후, 트리거 활성 관문보다 먼저 이 값을 구하고 경로가 따로 만든 응답이 없을 때 붙인다.

`HooksService` 에는 Discord 인터랙션 응답을 고르는 분기가 없다. PING 핸드셰이크 판정도 `DiscordAdapter.handshakeResponse` 가 하므로 `HooksService` 에는 Discord 전용 분기가 없다.

어댑터는 interaction type, callback type, ephemeral flag 값을 `discord.types.ts` 의 상수로 쓴다.

| 상수 | 값 |
|---|---|
| `DISCORD_INTERACTION_TYPE` | `PING` 1, `APPLICATION_COMMAND` 2, `MESSAGE_COMPONENT` 3, `APPLICATION_COMMAND_AUTOCOMPLETE` 4, `MODAL_SUBMIT` 5 |
| `DISCORD_INTERACTION_CALLBACK_TYPE` | `PONG` 1, `CHANNEL_MESSAGE_WITH_SOURCE` 4, `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` 5, `DEFERRED_UPDATE_MESSAGE` 6, `UPDATE_MESSAGE` 7, `MODAL` 9 |
| `DISCORD_MESSAGE_FLAG_EPHEMERAL` | 64 |

## 보안

- 봇 토큰(Discord [`Bot <token>`](https://discord.com/developers/docs/reference#authentication) 형식)은 `botTokenRef`(`secret://triggers/{id}/bot-token`)만 설정에 둔다. 평문 저장은 금지다(CCH-SE-03). 봇 토큰과 인바운드 서명 자료를 다루는 규칙은 [채팅 채널 어댑터 규약 「규칙」](CLE-CHAT-ADAPTER.md#규칙) 10 을 따른다. 클라이언트(`discord-client.ts`)는 실패 문장(fetch 예외, API 호출 재시도 소진 사유)을 돌려주거나 로그에 남기기 전에 그 호출에 쓴 봇 토큰을 지운다.
- **Application public key(ed25519)**: Discord [Interactions endpoint 검증](https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization)은 `X-Signature-Ed25519`·`X-Signature-Timestamp` 헤더와 raw body 를 application public key 로 검증한다. public key 는 사용자가 Developer Portal 에서 복사해 입력하고 `SecretResolver` 가 관리한다. 참조는 `secret://triggers/{id}/inbound-signing` 이다([시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 의 프로바이더 공통 슬롯).
  - 형식(Discord 발급 표준)은 `^[a-f0-9]{64}$`(소문자 hex 64자, ed25519 공개키 32바이트)다. 트리거 생성 때 `assertInboundSigningPlaintextByProvider`(`chat-channel-input-rules.ts`)가 검증하고 어기면 `400 VALIDATION_ERROR` 다. 대문자 hex 는 ed25519 검증 실패를 피하려고 미리 막는다.
  - public key 는 비밀이 아니라 공개키지만 교체, 워크스페이스 격리, 감사를 같은 흐름으로 다루려고 `SecretResolver` 로 관리한다(R-D-1).
  - 진입점이 raw body 와 두 헤더를 읽고 `SecretResolver.resolve(inboundSigningRef)` 뒤 ed25519 로 검증한다(Node.js `crypto.verify('ed25519', ...)`). 실패하면 `401 Unauthorized` 다. Discord 는 401 에 재시도하지 않는다.
- **설정 필드**: `inboundSigningRef` 는 Telegram·Slack 과 같은 슬롯이고 자원 성격과 검증 알고리즘은 백엔드가 프로바이더별로 나눈다([채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md)). Discord 는 Developer Portal 이 발급해 사용자가 직접 입력하는 프로바이더 발급 자료이고 자원은 ed25519 공개키(비대칭)다. `SetupResult.issuedInboundSigning` 은 채우지 않는다.
- **재전송 공격 차단**: `X-Signature-Timestamp` 가 현재 시각 ±5분 밖이면 `401`(Discord 권장).
- DM 밖 `channel.type` 은 진입점에서 `channel.type !== 1` 로 막고 `groupChatRefusal` 안내 뒤 버린다(CCH-CV-05).
- 봇 멤버(`member.user.bot === true`, DM `user.bot === true`)도 무시한다.

인바운드 HTTP 응답 정책의 기준은 [채팅 채널 「인바운드 HTTP 응답 계약」](CLE-CHAT-CORE.md#인바운드-http-응답-계약) 이고 기본은 `202 Accepted` 다. 그 밖의 응답 코드와 근거는 그 절의 목록과 [채팅 채널 「R-CC-12 인바운드 응답은 202 로 고정하고 401·404 만 예외로 둔다」](CLE-CHAT-CORE.md#r-cc-12-인바운드-응답은-202-로-고정하고-401404-만-예외로-둔다) 를 본다. Discord 가 요구하는 예외는 두 가지다. (1) PING(`type: 1`)은 `200 OK + { type: 1 }` JSON 이 필수다([PING 핸드셰이크](#ping-핸드셰이크)). (2) 슬래시 명령, 컴포넌트, 모달 제출은 3초 안에 `200 OK` 와 interaction response 객체로 답하고 `202` 는 인정하지 않는다. 응답 본문은 [인바운드 응답](#인바운드-응답) 이 정한다(R-D-8).

워크플로우가 비활성이면 새 실행을 시작할 update(`/<prefix> start` 와 활성 실행이 없는 대화의 입력)를 실행 없이 버리고 [인바운드 응답](#인바운드-응답) 의 기본 응답으로 답한다. 진행 중인 대화의 입력(답장, 버튼, 모달 제출)과 `/<prefix> cancel` 은 그대로 처리한다([채팅 채널 「R-CC-28 비활성 워크플로우는 채팅 채널로 새 실행을 시작하지 않는다」](CLE-CHAT-CORE.md#r-cc-28-비활성-워크플로우는-채팅-채널로-새-실행을-시작하지-않는다)). 활성 실행 중 `/<prefix> start` 의 기존 실행 취소가 실패하면 그 에러로 응답한다. 프로바이더가 요구하지 않는데도 `202` 대신 `503` 을 돌려주는 예외다. 트리거가 비활성일 때의 응답은 [인바운드 응답](#인바운드-응답) 과 [PING 핸드셰이크](#ping-핸드셰이크) 를 본다.

## 명령 처리

| 사용자 입력 | 어댑터 처리 |
|---|---|
| `/<prefix> start`(활성 실행 없음) | 새 실행 시작. 즉시 응답은 본인에게만 보이는 공통 수신 문구다([인바운드 응답](#인바운드-응답)). 시작 안내(`languageHints.executionStarted`)는 아직 보내지 않는다(NERV Task `CLE-T-0400J6`) |
| `/<prefix> start`(활성 실행 있음) | 기존 실행을 실행 중지 경로(`ExecutionsService.stop`)로 취소하고 새 실행 시작, "기존 대화를 종료하고 새로 시작합니다." 안내. 기존 실행이 이미 끝났거나 지워졌으면 취소 없이 시작한다. 워크플로우가 비활성이면 버리고 기존 실행을 취소하지 않는다. 기준은 [채팅 채널](CLE-CHAT-CORE.md) 의 명령 우선 규칙과 비활성 워크플로우 규칙이다. 즉시 응답은 공통 수신 문구이고 안내는 아직 보내지 않는다(NERV Task `CLE-T-0400J6`) |
| `/<prefix> cancel` | 활성 실행을 실행 중지 경로(`ExecutionsService.stop`, EIA `cancel` 과 같은 경로)로 취소. 없으면 아무것도 하지 않고 "진행 중인 대화가 없습니다." 안내. 이 안내는 아직 보내지 않는다. 즉시 응답은 공통 수신 문구다 |
| `/<prefix> help` | 본인에게만 보이는 즉시 응답으로 도움말(`languageHints.help`, 없으면 기본 도움말)을 보낸다. EIA 를 부르지 않는다 |
| `/<prefix> reply <message>` | 멀티턴 AI 진행 중이면 EIA `submit_message`. 즉시 응답은 공통 수신 문구다 |
| 모달 "Reply" 제출 | 멀티턴 AI 진행 중이면 EIA `submit_message`. 응답은 `{ type: 6 }` |
| 버튼 클릭 | EIA `click_button`. 응답은 `{ type: 6 }` |

DM 첫 메시지로 자동 시작하는 것(Telegram `/start` 와 같은 뜻)은 v1 에서 지원하지 않는다. Discord 는 Gateway `MESSAGE_CREATE` 없이 DM 텍스트를 받지 못하므로 사용자가 `/workflow start` 를 직접 입력해야 한다(R-D-3 의 v1 한계).

## Rationale

### R-D-8 PING 과 Interactivity 는 200 OK 로 답한다

[Slack 어댑터 「R-S-8 URL Verification 과 Interactivity 는 200 OK 로 답한다」](CLE-CHAT-SLACK.md#r-s-8-url-verification-과-interactivity-는-200-ok-로-답한다) 와 같은 생각이다. Discord 가 요구하는 예외는 두 경우(PING, Interactivity 응답)이고 둘 다 [채팅 채널 「프로바이더별 응답 예외」](CLE-CHAT-CORE.md#프로바이더별-응답-예외) 의 두 조건을 만족한다. Interactivity 응답에는 슬래시 명령, 컴포넌트, 모달 제출이 모두 들고 그 본문은 R-D-11·R-D-12 가 정한다. 다른 응답 코드(인증 실패, 엔드포인트 미존재, `/<prefix> start` 의 취소 실패 등)와 근거는 [채팅 채널 「인바운드 HTTP 응답 계약」](CLE-CHAT-CORE.md#인바운드-http-응답-계약) 과 [채팅 채널 「R-CC-12 인바운드 응답은 202 로 고정하고 401·404 만 예외로 둔다」](CLE-CHAT-CORE.md#r-cc-12-인바운드-응답은-202-로-고정하고-401404-만-예외로-둔다) 가 정하고 여기 다시 적지 않는다. `/<prefix> start` 의 취소 실패에 `503` 을 돌려주는 근거는 [채팅 채널 「R-CC-27 활성 실행 중 /start 는 기존 실행을 취소하고 새로 시작한다」](CLE-CHAT-CORE.md#r-cc-27-활성-실행-중-start-는-기존-실행을-취소하고-새로-시작한다) 에 있다.

### R-D-10 활성 실행 중 start 명령은 기존 실행을 취소하고 새로 시작한다

2026-10-10 결정이다(NERV Task `CLE-T-V4WVF2`). 명령 처리 표는 활성 실행이 있어도 `/<prefix> start` 면 기존 실행을 취소하고 새로 시작한다고 적었는데, [채팅 채널](CLE-CHAT-CORE.md) 의 CCH-CV-03 에는 `/start` 예외가 없었다. 채팅 채널 문서에 명령 우선 규칙을 두어 이 표를 정본으로 맞췄다. 근거는 [채팅 채널 「R-CC-27 활성 실행 중 /start 는 기존 실행을 취소하고 새로 시작한다」](CLE-CHAT-CORE.md#r-cc-27-활성-실행-중-start-는-기존-실행을-취소하고-새로-시작한다) 에 있다. Discord 는 v1 에서 자유 DM 텍스트를 받지 못하므로(R-D-3) [Slack 어댑터 「R-S-10 취소 후 새로 시작은 start 명령에만 적용한다」](CLE-CHAT-SLACK.md#r-s-10-취소-후-새로-시작은-start-명령에만-적용한다) 같은 DM 텍스트 구분이 필요 없다.

### R-D-11 컴포넌트와 모달 제출은 어느 경로로 끝나도 type 6 으로 답한다

NERV Task `CLE-T-7XWVC5` 의 결정이다. Discord 는 interaction response 객체가 아닌 응답이나 `202` 를 받으면 그 인터랙션을 실패로 처리하고 사용자 화면에 «This interaction failed» 를 띄운다. 이 결정 전에는 버튼·셀렉트 클릭에 `202` 와 `{ data }` 봉투로 답했다. 그래서 클릭을 처리해도 화면에는 실패가 떴다.

`{ type: 6 }`(DEFERRED_UPDATE_MESSAGE)은 화면을 바꾸지 않고 후속 메시지도 요구하지 않는다. 그래서 중복, 분당 한도 초과, 실행 중처럼 클릭을 버린 경로에 보내도 안전하다. 경로가 이미 만든 응답(`{ type: 9 }` 모달 열기, `{ type: 4 }` Form 제출 결과)이 있으면 그것을 보낸다. 슬래시 명령에는 Discord 가 `{ type: 6 }` 을 허용하지 않아(컴포넌트와 모달 제출 전용) 이 결정에서 뺐다. 슬래시 명령의 응답은 R-D-12 가 정한다. 새 실행의 `response_code` 는 실행 데이터 정의(실제 HTTP 응답 코드)대로 `'200'` 을 남긴다.

기각한 대안은 둘이다.

- `ackInteraction` 이 `{ type: 6 }` 을 보내게 하는 안: 이 함수는 반환값이 없어(`Promise<void>`) 웹훅 HTTP 응답을 만들지 못한다. [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 도 이 함수를 인바운드 명령 처리 뒤의 후처리로 정했다. 기본 응답은 R-D-12 에서 선택 함수 `defaultInteractionResponse` 로 옮겼다.
- 처리한 경로만 `{ type: 6 }` 으로 답하고 버린 경로는 `202` 로 두는 안: 버린 클릭마다 사용자 화면에 실패가 뜬다.

이 항목은 R-D-8 이 정한 예외(Interactivity 응답은 `200 OK`) 안에서 컴포넌트와 모달 제출의 응답 본문과 적용 범위를 정한다.

### R-D-12 슬래시 명령은 본인에게만 보이는 type 4 로 바로 답하고 비활성 트리거도 인터랙션 응답으로 답한다

2026-11-12 사람 결정 두 건이다(NERV Task `CLE-T-TSEP9G`).

결정 1(NERV 질문 `01a1d025-899f-7709-b759-4f7bf6c16ef5`): 슬래시 명령은 `{ type: 4, data: { content, flags: 64 } }` 로 바로 답한다. `help` 는 도움말을 싣고, 그 밖의 명령은 어느 경로로 끝나도 공통 수신 문구 `languageHints.commandReceived`(기본 ko `요청을 받았습니다.`, en `Request received.`)를 싣는다. 이전의 `202` 와 `{ data }` 봉투 응답은 Discord 가 실패로 보아 명령을 처리해도 사용자 화면에 실패가 떴다. `{ type: 6 }` 은 슬래시 명령에 쓸 수 없어(R-D-11) 메시지를 싣는 `{ type: 4 }` 를 쓰고, `flags: 64` 를 붙여 명령을 보낸 사용자에게만 보이게 한다. 시작 안내(`languageHints.executionStarted`)는 NERV Task `CLE-T-0400J6` 이 따로 다룬다. 도움말은 `ChannelUpdate` 의 kind 가 아니라 어댑터의 기본 응답 본문으로 나간다.

결정 2(NERV 질문 `01a1d025-8baf-773f-95fd-201820c7cd5f`): 트리거가 비활성이어도 슬래시 명령, 컴포넌트, 모달 제출에는 활성일 때와 같은 기본 응답으로 답한다. 트리거를 꺼도 slash command 등록과 예전 메시지의 버튼은 남아 사용자가 계속 보낼 수 있다([채팅 채널](CLE-CHAT-CORE.md) R-CC-29). `202` 로 답하면 그때마다 실패가 뜬다. 기본 응답은 원본 본문만 보고 외부 호출 없이 만들므로 «비활성 트리거에서는 외부 호출을 하지 않는다» 와 어긋나지 않는다. PING 은 지금처럼 `202` 다.

응답 판단은 어댑터의 선택 함수 `defaultInteractionResponse`(`buildDiscordDefaultInteractionResponse`)가 한다. `HooksService` 는 서명 검증 직후 그 값을 구해 두고 경로가 따로 만든 응답이 없을 때 붙인다. 함수를 어댑터 규약에 둔 근거는 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 의 R-CCA-14 다.

기각한 대안은 셋이다.

- 슬래시 명령에 `{ type: 5 }`(DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE)로 미룬 뒤 `PATCH /webhooks/{app_id}/{interaction_token}/messages/@original` 로 원본 응답을 고치는 안: 명령마다 외부 호출이 하나 더 든다. 버린 경로(중복, 분당 한도 초과)에도 그 호출을 해야 하고, 호출이 없거나 실패하면 사용자는 로딩 표시를 보다가 실패를 본다.
- 슬래시 명령은 `202` 를 유지하는 안: 처리한 명령에도 실패가 뜨는 결함이 남는다.
- 비활성 트리거는 인터랙션에도 `202` 로 답하는 안: 트리거를 끈 동안 누른 버튼과 보낸 명령마다 실패가 뜬다.
