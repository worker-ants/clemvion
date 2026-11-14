---
id: "CLE-CHAT-DATA-CONFIG"
title: "채팅 채널 데이터와 흐름 — 설정과 안내 문구"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT-DATA"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT", "CLE-CHAT-DATA"]
area: "CLE-CHAT"
content_hash: "8a8ab7236bf2e03074b24f22235f3198fce615ad8518fafaee6039f7412646bd"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "d044436dfe7b64513caf6d1e12482a69985564d1ce6622199aa4edcfd3fd50c4"
etag: "sha256-df90ea418a4436c2f2cc095318f93730ce6c4e4791722ae0bcf672e5d49eac93"
---
## 개요

이 문서는 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 의 하위 문서로 웹훅 트리거의 `config.chatChannel` 필드 계약과 봇 안내 문구(`languageHints`)의 키 · 기본값 · escape 규칙을 정한다. 이 문서에서 단독으로 쓴 「프로바이더」 는 채널 프로바이더를 뜻한다.

## Trigger.config.chatChannel

`chatChannel` 이 없으면 일반 웹훅 트리거다(기존 동작 그대로). 이 필드는 [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) 트리거의 `config` JSONB 안에 있다. 메모리 표현 타입(`ChatChannelConfig`)은 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 이 정하고, 필드 계약은 이 절이 정한다. `languageLocale` 을 포함한 `chatChannel` 필드 전체 목록의 기준도 이 절이다([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 가 여기를 가리킨다).

요청 본문에서는 이 설정을 최상위 필드 `chatChannel` 로만 받는다. 생성 · 수정 요청 본문의 `config` 키(원시 `config`) 아래에 `chatChannel` 키가 있으면 값과 상관없이 400 `VALIDATION_ERROR`(`details.field='config.chatChannel'`)다. 그 아래에 내부 필드 경로(`config.chatChannel.botTokenRef` 등)가 함께 실렸으면 그 경로의 거부가 먼저 걸린다. 기준은 [트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약) 이다.

```jsonc
{
  "chatChannel": {
    "provider": "telegram",                    // 채널 프로바이더. 지원 목록은 채팅 채널 문서의 카탈로그(1차 범위: telegram / slack / discord)
    "botToken": "<provider 발급 plaintext>",   // 입력 전용. 생성 요청(POST /api/triggers) 본문의 chatChannel.botToken 으로만 받는다. 원시 config.chatChannel.botToken 은 400 이다(트리거 관리). 서비스가 SecretResolver.rotate 로 옮긴 뒤 지운다. 응답·DB JSONB 에 없다(시크릿 저장소 「규칙」 규칙 14).
                                               // 1~256자의 보이는 ASCII(U+0021~U+007E)만 받는다. 공백·제어 문자·ASCII 밖 문자가 있으면 400 VALIDATION_ERROR(채팅 채널 「R-CC-32 봇 토큰 입력은 보이는 ASCII 만 받는다」)
                                               // telegram = BotFather `\d+:[A-Za-z0-9_-]+` (입력 안내일 뿐 서버는 이 형식을 검증하지 않는다. 잘못된 토큰은 setupChannel 실패 때 BOT_TOKEN_INVALID 로 드러난다)
                                               // slack = `xoxb-*` / discord = Developer Portal Bot Token (둘 다 입력 안내일 뿐 서버는 검증하지 않는다)
    "inboundSigningPlaintext": "<provider-issued plaintext>",  // 입력 전용, slack·discord 만(telegram 은 서버가 발급). slack = 소문자 hex 32자(signing secret), discord = 소문자 hex 64자(ed25519 application public key).
                                               // 생성 요청 본문의 chatChannel.inboundSigningPlaintext 로만 받는다. 원시 config.chatChannel 아래로는 받지 않는다.
                                               // 서비스가 SecretResolver.rotate(inboundSigningRef, ws, plaintext) 뒤 지운다. telegram 에 넣으면 400 VALIDATION_ERROR(field='inboundSigningPlaintext')
    "botTokenRef":      "secret://triggers/{triggerId}/bot-token",       // DB JSONB 에만 둔다. 응답에서는 지운다. 요청 본문으로는 받지 않는다(chatChannel.botTokenRef · 원시 config.chatChannel.botTokenRef 모두 400). 프로바이더 공통
    "inboundSigningRef": "secret://triggers/{triggerId}/inbound-signing",  // DB JSONB 에만 둔다. 응답에서는 지운다. 요청 본문으로는 받지 않는다(chatChannel.inboundSigningRef · 원시 config.chatChannel.inboundSigningRef 모두 400). 프로바이더 공통 단일 슬롯(검증 알고리즘은 백엔드가 프로바이더별로 나눈다)
    "botIdentity": {                            // setupChannel 결과 캐시(생성 뒤 읽기 전용)
      "botId": 123456789,
      "username": "myworkflow_bot",
      "teamId": "T012ABCDE",                    // 선택. workspace·team 개념이 있는 프로바이더(Slack 등)만
      "publicKey": "<verify_key>"               // 선택. Discord 의 GET /applications/@me verify_key 캐시(비민감 공개키)
    },
    "uiMapping": {                              // 선택. 노드를 채팅 채널 UI 로 바꾸는 옵션
      "formMode": "auto",                       // "multi_step" | "native_modal" | "auto"(기본). 뜻은 채팅 채널 어댑터 규약의 Form 입력 흐름
      "visualNode": "auto",                     // "text" | "photo" | "auto"(기본). 예전 "text_only" 는 읽을 때 "text" 로 바꾼다
      "buttonLayout": "auto"                    // "auto" | "vertical" | "horizontal"
    },
    "rateLimitPerMinute": 60,                   // 대화 단위 분당 한도(기본 60, 1–600). 넘치면 건너뛰고 degraded
    "languageLocale": "ko",                     // "ko" | "en", 기본 "ko". languageHints 가 비어 있는 키의 기본 문구 언어
    "languageHints": {                          // 봇이 스스로 보내는 안내 문구(사용자 덮어쓰기). 모두 평문으로 쓴다
      "groupChatRefusal":              "이 봇은 1:1 대화만 지원합니다.",
      "unsupportedMessageKind":        "지원하지 않는 메시지 형식입니다.",
      "executionStarted":              "워크플로우를 시작합니다…",
      "executionCompleted":            "워크플로우가 완료되었습니다.",
      "executionStillRunning":         "워크플로우가 처리 중입니다. 잠시만 기다려 주세요.",
      "help":                          "사용 가능한 명령: /start, /cancel, /help",
      "formValidationFailed":          "입력값을 다시 확인해 주세요.",
      "formNextField":                 "다음 항목을 입력해 주세요."
      // commandReceived · formOpenLabel · sessionExpired · surfaceMismatch · executionFailed* 여섯 개도 덮어쓸 수 있다. 예시 값은 「안내 문구 기본값」 표의 KO 기본값과 같다
    }
  }
}
```

`botToken` 입력의 문자 제약은 [채팅 채널 「R-CC-32 봇 토큰 입력은 보이는 ASCII 만 받는다」](CLE-CHAT-CORE.md#r-cc-32-봇-토큰-입력은-보이는-ascii-만-받는다) 가 정한다. 1~256자의 보이는 ASCII(U+0021~U+007E)만 받고 프로바이더별 형식은 검증하지 않는다.

`languageHints` 키의 쓰임은 다음과 같다.

| 키 | 쓰임 |
|---|---|
| `groupChatRefusal` | 그룹 대화 거절 안내 |
| `unsupportedMessageKind` | 그룹이 아닌 미지원 update 안내 |
| `executionStarted` · `executionCompleted` | 실행 시작·완료 안내 |
| `executionStillRunning` | 실행 중 · 대기 중(`running`·`pending`)에 온 메시지 안내 |
| `help` | `/help` 기본 도움말. Discord 의 `/<prefix> help` 와 Slack 의 `/<명령> help` 는 슬래시 명령의 즉시 응답에 이 값을 그대로 싣는다(`{prefix}` 를 바꾸지 않는다). 값이 없으면 두 프로바이더가 함께 쓰는 locale 기본 도움말에 명령 이름을 넣어 쓴다. Discord 는 등록한 명령 이름(`languageHints.slashPrefix`, 없으면 `workflow`)을 넣는다([Discord 어댑터](CLE-CHAT-DISCORD.md)). Slack 은 명령 이름을 앱 manifest 에서 정하므로 `slashPrefix` 를 쓰지 않는다. 요청의 `command` 에서 앞의 `/` 를 뺀 값(비면 `workflow`)을 넣는다([Slack 어댑터](CLE-CHAT-SLACK.md)) |
| `commandReceived` | Discord · Slack 슬래시 명령의 즉시 응답(본인에게만 보이는 메시지)에 싣는 공통 수신 문구. `help` 가 아닌 모든 슬래시 명령에 쓴다([채팅 채널 「인터랙션 기본 응답」](CLE-CHAT-CORE.md#인터랙션-기본-응답)) |
| `formValidationFailed` · `formNextField` | 다단계 질문의 검증 실패 재질문, 다음 필드 질문 |
| `formOpenLabel` | 네이티브 모달을 여는 `form_modal` 버튼 라벨 |
| `sessionExpired` | 멀티턴 재개 실패(`RESUME_*`) 안내 |
| `surfaceMismatch` | 대기 표면과 명령 불일치(409 `STATE_MISMATCH`) 안내 |
| `executionFailed*` 여섯 개 | 실행 실패 안내. 분류 결과 키이고, 허용 자리표시자는 `{statusCode}`(정수) 하나다. 그 밖의 자리표시자는 등록 요청의 입력 검증이 거부한다 |

프로바이더 문서는 이 목록에 없는 키도 참조한다. [Telegram 어댑터](CLE-CHAT-TELEGRAM.md) 는 일반 취소 안내로 `executionCancelled` 를, [Discord 어댑터](CLE-CHAT-DISCORD.md) 는 모달 제목 fallback 으로 `formModalTitle` 을 쓴다. [미결 사항](CLE-CHAT-DATA.md#미결-사항) 참조.

`botTokenRef`·`inboundSigningRef` 는 `SecretResolver` 가 풀어 쓴다. 설정 JSON 에는 참조만 두고, 평문은 백엔드가 AES-256-GCM 으로 암호화해 `secret_store` 테이블의 `encrypted BYTEA` 컬럼에 둔다. External Interaction API(EIA) 알림 웹훅의 `notification.signing.secretRef` 와 같은 정책, 같은 백엔드다([EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md)). 두 참조는 응답에 싣지 않는다. 응답은 파생 필드 `hasBotToken` 만 싣는다([채팅 채널](CLE-CHAT-CORE.md) 의 응답 파생 필드). `inboundSigningRef` 의 프로바이더별 자원 성격·발급 주체·검증 알고리즘(Telegram 서버 발급 shared secret, Slack HMAC(Hash-based Message Authentication Code) key, Discord ed25519 공개키)은 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 이 정한다.

## 안내 문구 기본값

실행 실패 안내 키 여섯 개의 기본 문구는 한국어와 영어 두 locale 모두 백엔드가 가진다. 채널 어댑터가 문구를 찾는 순서는 (1) `languageHints[key]` 사용자 덮어쓰기, (2) `languageLocale` 의 기본 문구, (3) locale 이 없을 때 `ko` 다. 처음부터 있던 다섯 키(`groupChatRefusal` 등)의 영어 기본값은 범위 밖이다. `formOpenLabel` 과 Discord · Slack 슬래시 명령 응답의 `commandReceived` 도 두 locale 을 모두 가지고 찾는 순서가 같다. 슬래시 명령 `help` 의 기본 도움말(`SLASH_HELP_DEFAULTS`)도 두 locale 을 가진다(위 키 표의 `help`).

| key | KO 기본값 | EN 기본값 |
|---|---|---|
| `executionFailedThirdParty4xx` | "외부 서비스 요청이 거부되었습니다 ({statusCode}). 잠시 후 다시 시도해 주세요." | "The external service rejected the request ({statusCode}). Please try again later." |
| `executionFailedThirdParty5xx` | "외부 서비스에 일시적인 문제가 발생했습니다 ({statusCode}). 잠시 후 다시 시도해 주세요." | "The external service is temporarily unavailable ({statusCode}). Please try again later." |
| `executionFailedThirdParty` | "외부 서비스 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요." | "Couldn't reach the external service. Please try again later." |
| `executionFailedTimeout` | "처리 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요." | "The request timed out. Please try again later." |
| `executionFailedRateLimit` | "요청량이 많아 잠시 후 다시 시도해 주세요." | "Too many requests. Please try again later." |
| `executionFailedInternal` | "서비스에 일시적 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." | "The service is temporarily unavailable. Please try again later." |
| `formOpenLabel` | "양식 작성하기" | "Open form" |
| `sessionExpired` | "대화 세션이 만료되어 재개할 수 없습니다. 새 메시지를 보내면 새 대화가 시작됩니다." | "This conversation session has expired and cannot be resumed. Send a new message to start a fresh conversation." |
| `surfaceMismatch` | "지금은 이 입력을 받을 수 없습니다. 화면에 표시된 양식이나 버튼을 사용해 주세요." | "This input can't be accepted here right now, please use the form or buttons shown above" |
| `commandReceived` | "요청을 받았습니다." | "Request received." |

`{statusCode}` 는 두 locale 에서 같은 자리에 있다. 그래서 치환 코드가 locale 분기 없이 한 경로로 동작한다.

봇 안내 문구는 메신저로 나가는 봇 메시지라 [다국어와 화면 문구 「규칙」](../CLE-UI/CLE-UI-I18N.md#규칙) 7(화면 한국어 문자열의 표기 · 문체)의 대상이 아니다. 한국어 기본 문구는 합쇼체로 쓰고 «~해 주세요» 처럼 띄어 쓴다. 이 표와 위 `languageHints` 예시가 그 기준이다. 지금 백엔드 기본 문구의 `surfaceMismatch` 와 «~해주세요» 로 붙여 쓴 Form 안내 두 개는 이 기준과 다르고 NERV Task `CLE-T-A0G1FB` 가 맞춘다.

`sessionExpired` 는 멀티턴 AI 대화가 서버 재시작이나 AI 재개 체크포인트 부재로 재개할 수 없을 때(`execution.cancelled` 와 `RESUME_*` 코드) 일반 취소 안내 대신 보낸다([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)). 찾는 순서는 `formOpenLabel` 과 같다. 사용자의 다음 메시지는 새 실행으로 시작한다(취소된 실행은 새 실행을 시작시킨다).

`surfaceMismatch` 는 인바운드 명령이 지금 입력을 기다리는 블로킹 노드의 대기 표면과 맞지 않아 재개 명령 발행기가 409 `STATE_MISMATCH` 로 거부했을 때 보내는 부수 안내다. 예를 들어 Form·버튼 입력 대기 중에 자유 텍스트가 오면 `text_message → submit_message` 고정 매핑이 거부된다([실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 의 표면 매트릭스). 로그만 남기던 경우에도 사용자에게 알려 주려는 것이다. 현재 구현은 `HooksService.forwardToInteractionService` 가 거부를 흡수하면서 `sendSurfaceMismatchNotice` 로 보낸다.

`commandReceived` 는 Discord · Slack 슬래시 명령이 어느 경로로 끝나든(새 실행, 취소, 답장 전달, 중복, 분당 한도 초과, 워크플로우 비활성, 파싱 실패, 트리거 비활성) 같은 문구로 나간다. `help` 하위 명령만 이 문구 대신 도움말로 답한다. 문구는 처리 전에 정하므로 경로에 따라 달라지지 않는다. 새 실행의 시작 안내(`executionStarted`)를 대신하지 않는다. 시작 안내는 NERV Task `CLE-T-0400J6` 가 다룬다.

### 제어 안내의 프로바이더별 escape

`HooksService` 가 렌더러(`renderNode`)를 거치지 않고 `adapter.sendMessage` 로 바로 보내는 제어 안내 키는 `help`, `groupChatRefusal`, `unsupportedMessageKind`, `executionStillRunning`, `surfaceMismatch`, `formValidationFailed`, `formNextField` 일곱 개다. 발송 직전 `adapter.escapeControlText(text)` 로 프로바이더 표면에 맞게 escape 한다.

- Telegram: `escapeMarkdownV2`(예약 문자 backslash escape, `renderNode` 경로와 같은 규칙)
- Slack: `escapeSlackMrkdwn`(`<`, `>`, `&` 만)
- Discord: 평문 그대로(렌더러도 escape 하지 않는다)

그래서 기본 문구와 운영자 덮어쓰기는 모두 평문으로 쓴다. `\.` 같은 수동 escape 는 필요 없다. `formOpenLabel` 은 버튼 라벨이라 MarkdownV2 대상이 아니고, `sessionExpired` 와 실행 실패 안내는 `renderNode` 경로라 렌더러가 escape 한다. 함수 계약은 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 이 정한다.

Discord · Slack 슬래시 명령의 즉시 응답에 싣는 `commandReceived` 와 도움말(`languageHints.help` 나 기본 도움말)은 `adapter.sendMessage` 로 보내지 않고 인터랙션 응답 본문으로 나간다. 그래서 `adapter.escapeControlText` 를 거치지 않는다. escape 여부는 그 응답을 만드는 어댑터의 `defaultInteractionResponse` 가 프로바이더별로 정한다.

- Discord: 응답 본문(`data.content`)을 escape 하지 않는다. 다른 Discord 제어 안내와 결과가 같다.
- Slack: 응답의 `text` 는 mrkdwn 으로 렌더되므로 다른 Slack 제어 안내와 같이 `escapeSlackMrkdwn` 으로 `&`, `<`, `>` 를 escape 한다.

이 응답을 정하는 함수의 계약은 [채팅 채널 어댑터 규약 「인터랙션 기본 응답과 수신 확인」](CLE-CHAT-ADAPTER.md#인터랙션-기본-응답과-수신-확인) 이 정한다.

## 구현 위치

- `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts`: 안내 문구의 locale 기본값과 덮어쓰기 해석. 공통 수신 문구 `COMMAND_RECEIVED_DEFAULTS` · `resolveCommandReceivedMessage` 와 Discord · Slack 이 함께 쓰는 슬래시 명령 기본 도움말 `SLASH_HELP_DEFAULTS` 를 포함한다
- `codebase/backend/src/modules/chat-channel/providers/discord/discord-interaction-response.ts`, `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts`, `codebase/backend/src/modules/chat-channel/providers/slack/slack-update.parser.ts`: 슬래시 명령의 즉시 응답. Discord 는 `buildDiscordDefaultInteractionResponse`, Slack 은 `defaultInteractionResponse` · `resolveSlackHelpText`(응답 `text` 의 mrkdwn escape 포함)다. Slack 의 `help` 판정은 파서와 같은 규칙의 `readSlackSlashInvocation` 이 한다

## Rationale

### 슬래시 명령의 공통 수신 문구를 안내 문구 키로 둔다 (2026-11-12)

2026-11-12 결정이다(NERV Task `CLE-T-TSEP9G` · `CLE-T-C5G12M`). 사람이 질문 `01a1d025-899f-7709-b759-4f7bf6c16ef5` 에 답해 정했다. Discord 슬래시 명령은 3초 안에 `{ type: 4 }` 로 답해야 하므로 처리 전에 정할 문구가 하나 필요하다. 그 문구를 `languageHints` 의 새 키 `commandReceived` 로 둔다. 기본값은 ko "요청을 받았습니다." · en "Request received." 이고 다른 안내 문구처럼 운영자가 덮어쓸 수 있다. 찾는 순서도 같다([안내 문구 기본값](#안내-문구-기본값)). 이 문구는 인터랙션 응답 본문으로 나가므로 제어 안내의 `escapeControlText` 를 거치지 않는다([제어 안내의 프로바이더별 escape](#제어-안내의-프로바이더별-escape)). 응답을 처리 전에 정하는 이유는 [채팅 채널 「R-CC-33 인터랙션은 어느 경로로 끝나도 기본 응답으로 답하고 버린 클릭에는 수신 확인을 보낸다」](CLE-CHAT-CORE.md#r-cc-33-인터랙션은-어느-경로로-끝나도-기본-응답으로-답하고-버린-클릭에는-수신-확인을-보낸다) 에 있다.

기각한 대안은 둘이다.

- (a) 서버가 고정한 문구로 답한다. 봇이 보내는 다른 안내 문구는 모두 운영자가 바꿀 수 있는데 이 문구만 바꿀 수 없게 된다. `languageLocale` 도 따르지 못한다.
- (b) 시작 안내 `executionStarted` 를 다시 쓴다. 이 응답은 새 실행뿐 아니라 취소, 답장 전달, 중복, 분당 한도 초과, 워크플로우 비활성처럼 실행을 시작하지 않는 경로에도 나간다. 그 경로에서 «워크플로우를 시작합니다» 는 사실과 다르다. 시작 안내는 NERV Task `CLE-T-0400J6` 가 따로 다룬다.

2026-11-13 에 Slack 슬래시 명령에도 같은 키와 같은 기본 도움말을 쓰기로 했다(NERV Task `CLE-T-MGZRRP`, 질문 `01a1d2f3-e188-7354-8298-243092419a3c`). Slack 도 슬래시 명령에는 3초 안에 `200` 으로 답해야 한다. 그래서 Discord 와 같게 모든 경로에서 본인에게만 보이는 응답(`response_type: 'ephemeral'`)으로 답한다. Slack 은 명령 이름을 앱 manifest 에서 정하고 요청마다 `command` 로 보내 준다. 그래서 기본 도움말에 넣을 명령 이름을 `languageHints.slashPrefix` 로 받지 않는다.
