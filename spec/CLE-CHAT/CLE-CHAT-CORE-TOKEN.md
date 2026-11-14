---
id: "CLE-CHAT-CORE-TOKEN"
title: "채팅 채널 — 봇 토큰 재발급"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT-CORE"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT", "CLE-CHAT-CORE"]
area: "CLE-CHAT"
content_hash: "935b805497b0eefbb73702ccbcee7cbb2ee8f5e4361280628b5e4def43e19fe8"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "92edccd0c8a47252551ec912ac5fef4a0af5d43351a9591c3ec321b22c422298"
etag: "sha256-6752d5d2ec50df4ac0bd2deb9167434e4bd52e033fcaaabaa2c27c9bdac249f5"
---
## 개요

이 문서는 [채팅 채널](CLE-CHAT-CORE.md) 의 하위 문서로 봇 토큰과 인바운드 서명 자료의 저장, 봇 토큰 재발급 API, 24시간 유예와 정리, 봇 토큰 입력 형식, 응답 파생 필드 `hasBotToken` 을 정한다. PATCH 차단은 [봇 토큰 변경 경로와 PATCH 차단](CLE-CHAT-CORE-PATCH.md) 이 정한다.

## 비밀 저장

참조 형식은 `secret://triggers/{triggerId}/bot-token`·`secret://triggers/{triggerId}/inbound-signing` 이고 DB 에는 암호문(BYTEA)만 남는다([시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md)).

## 24시간 유예와 정리

- Telegram 은 재발급 때 `setWebhook` 을 다시 부른다.
- 정리 스케줄러는 BullMQ repeatable 이고 `NotificationSecretRotatorService` 와 같은 패턴이다. `NotificationSecretRotatorService` 는 EIA 알림 서명 시크릿을 교체한 뒤 유예가 끝나면 새 시크릿(`notification_secret_v2`)을 primary 로 올리는 스케줄러다.
- 재발급은 primary 참조를 바로 새 토큰으로 바꾸고 백업 참조(`bot-token.v2`)에 옛 토큰을 24시간 백업한다. 백업 참조를 primary 로 올리는 단계는 없다.
- 저장된 옛 토큰이 비었거나 공백만 있으면(시크릿 저장소가 빈 평문을 거부하기 전에 저장된 행) 백업을 건너뛰고 경고 로그를 남긴다. 로그에는 트리거 id 만 싣는다. 그런 값은 보존할 토큰이 아니다. 시크릿 저장소는 공백만 있는 평문도 거부하므로 백업하려 하면 재발급이 실패한다.
- 유예가 끝난 정리 작업이 백업 토큰을 프로바이더에서 폐기(`revokeBotToken`, 지원하는 프로바이더만)한 뒤 지운다. 재발급 시점에는 백업한 옛 토큰을 폐기하지 않는다.
- 유예 안에 다시 재발급해 백업 참조에 있던 토큰이 덮이면 재발급이 끝까지 성공한 뒤 덮인 토큰을 그 자리에서 폐기한다. 이 폐기는 실패해도 재발급을 실패시키지 않고 경고 로그만 남긴다(NERV Task `CLE-T-6ZTPZ8`). 근거는 [채팅 채널 어댑터 규약 「R-CCA-10 이전 봇 토큰은 24시간 유예가 끝난 정리 작업이 폐기한다」](CLE-CHAT-ADAPTER.md#r-cca-10-이전-봇-토큰은-24시간-유예가-끝난-정리-작업이-폐기한다) 에 있다.

## 봇 토큰 입력 형식

- 공백은 양끝이든 가운데든 거부한다. 제어 문자(CR · LF · NUL 등)와 ASCII 밖 문자도 거부한다.
- 생성은 DTO 에서 검증하고 길이 1~256 은 전부터 있었다. 재발급은 컨트롤러에서 검증하고 256자 상한도 이때 더했다. 두 경로는 같은 판정 코드를 쓴다.
- PATCH 는 봇 토큰을 받지 않는다([봇 토큰 변경 단일 경로](CLE-CHAT-CORE-PATCH.md#봇-토큰-변경-단일-경로)).
- 이미 저장된 토큰은 바꾸지 않고 알려진 비밀 치환([채팅 채널 어댑터 규약 「규칙」](CLE-CHAT-ADAPTER.md#규칙) 10)도 그대로 둔다. 근거는 [R-CC-32](#r-cc-32-봇-토큰-입력은-보이는-ascii-만-받는다) 에 있다.

## 봇 토큰 재발급 API

`POST /api/triggers/:id/chat-channel/rotate-bot-token` 은 봇 토큰 재발급(`rotate-bot-token`)의 유일한 경로다.

요청 본문은 다음과 같다.

```jsonc
{
  "newBotToken": "<bot-father-issued-token>"   // 필수. 새 봇 토큰
}
```

성공 응답(200 OK)은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 `{ data }` 응답 봉투와 `TransformInterceptor` 를 따른다. `rotateBotToken`(`triggers.service.ts`)은 `rotatedAt` 과 함께 `triggerId`, `chatChannelHealth`(`setupChannel` 재호출 결과, 성공하면 `'healthy'`), `botIdentity`(`setupChannel` 의 `configUpdates.botIdentity` 로 갱신한 getMe 캐시, 돌려주지 않는 프로바이더는 `null`)를 싣는다.

```jsonc
{
  "data": {
    "rotatedAt": "<ISO8601>",
    "triggerId": "<trigger-uuid>",
    "chatChannelHealth": "healthy",          // 'unknown' | 'healthy' | 'degraded'
    "botIdentity": { "botId": 123, "username": "mybot" }  // 또는 null
  }
}
```

실패 응답은 [에러 응답과 클라이언트 처리 「2. 에러 응답 봉투」](../CLE-API/CLE-API-ERROR.md#2-에러-응답-봉투) 를 따른다.

| HTTP | error.code | 사유 |
|---|---|---|
| 404 | `RESOURCE_NOT_FOUND` | 트리거가 없거나 워크스페이스 권한이 없다(`findById`). 재발급 도중 트리거가 삭제돼(워크플로우·워크스페이스 삭제의 외래 키 연쇄 삭제 포함, advisory lock 으로 못 막는다) 잠금 안 병합 쓰기가 0행에 맞은 경우도 같다([트리거 관리 「동시 쓰기 직렬화」](../CLE-TRIG/CLE-TRIG-MANAGE.md#동시-쓰기-직렬화)) |
| 400 | `INVALID_BOT_TOKEN` | `newBotToken` 이 없거나 문자열이 아니거나 256자를 넘거나 보이는 ASCII(U+0021~U+007E) 밖의 문자(공백 · 제어 문자 · ASCII 밖 문자)가 있다(controller 입력 검증, [봇 토큰 입력 형식](#봇-토큰-입력-형식)). 시크릿을 저장하거나 프로바이더를 부르기 전에 거부한다 |
| 400 | `VALIDATION_ERROR` | `X-Workspace-Id` 헤더가 있으나 UUID 가 아니다(공용 헬퍼 `workspace-context.util.ts` 가 먼저 거부). 헤더와 JWT `workspaceId` 가 둘 다 없는 경우는 아래 403 `FORBIDDEN` 행이다. PATCH 본문 필드 거부의 같은 코드와도 다른 경우다 |
| 400 | `CHAT_CHANNEL_NOT_CONFIGURED` | `config.chatChannel` 이 없는 트리거 |
| 400 | `CHAT_CHANNEL_PROVIDER_UNKNOWN` | 레지스트리에 없는 프로바이더 |
| 400 | `CHAT_CHANNEL_ENDPOINT_REQUIRED` | 트리거에 `endpointPath` 가 없다 |
| 400 | `BOT_TOKEN_INVALID` | `setupChannel` 이 자격 증명 거부로 실패했다. 신호가 401/403 이든 `{ok:false, error:'invalid_auth'}`(HTTP 200)든 `verify_key` 불일치든 같은 분류이고, 채널 어댑터가 `code` 로 선언한다([채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md), R-CC-23) |
| 403 | `FORBIDDEN` | 워크스페이스 문맥이 없다(`X-Workspace-Id` 헤더와 JWT `workspaceId` 가 둘 다 없음). 전역 가드 `RolesGuard` 가 `@WorkspaceId()` 보다 먼저 돌아 `code` 없이 거부하므로 기본 코드가 실린다. 로그인 토큰에는 개인 워크스페이스가 실려 있어 실제로는 거의 나지 않는다([워크스페이스와 멤버 「가드 거부 에러 코드」](../CLE-ACCT/CLE-ACCT-WS.md#가드-거부-에러-코드) · [「`X-Workspace-Id` 형식 검사」](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-형식-검사), R-CC-18) |
| 403 | `NOT_A_MEMBER` | 요청자가 그 워크스페이스의 멤버가 아니다 |
| 403 | `EDITOR_REQUIRED` | 요청자의 역할이 편집자보다 낮다(뷰어). 재발급에는 편집자 이상 역할이 필요하다 |
| 500 | `INTERNAL_ERROR` | 트리거의 비밀 참조에 다른 워크스페이스가 소유한 시크릿 저장소 행(비밀 참조 교차 행)이 남아 있다. [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 25 에 따라 `rotate` 가 거부하고 `message` 는 5xx 가림 문구다. Telegram 에서 프로바이더 등록 뒤 인바운드 서명 자료 저장이 거부되면 인바운드도 401 로 닫힌다. 남는 부분 상태는 [채팅 채널 데이터와 흐름 「봇 토큰 라이프사이클」](CLE-CHAT-DATA.md#봇-토큰-라이프사이클) 에 있다. 운영자가 [시크릿 저장소 「교차 행 점검과 정리」](../CLE-INT/CLE-INT-SECRET.md#교차-행-점검과-정리) 대로 정리한 뒤 다시 호출한다 |
| 502 | `CHAT_CHANNEL_SETUP_FAILED` | 그 밖의 `setupChannel` 실패(프로바이더 5xx, 네트워크, 타임아웃). 클라이언트가 입력으로 고칠 수 없고 외부 API 호출을 다시 시도해도 실패한 경우다. 우리 인프라 일시 장애인 `503` 과 구분한다 |

`INVALID_BOT_TOKEN` 과 `BOT_TOKEN_INVALID` 는 어순만 다르고 뜻이 다르다. 앞쪽은 입력 형식이 틀려 프로바이더를 부르기 전에 거부한 것이고 뒤쪽은 프로바이더가 토큰을 거부한 것이다([에러 코드 규약과 카탈로그 §6.15](../CLE-API/CLE-API-ERRCODES.md#615-채팅-채널-봇-토큰-재발급-도메인-문서-참조)).

실패 응답에는 프로바이더 원문을 싣지 않는다. `message` 는 고정 문자열이고 `code` 가 판별자다. 원본 문구는 서버 로그에만 남긴다. 에러 원문은 URL, query, DB 컬럼명, stack, API 키 조각을 흘릴 수 있다([실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) 의 보안 게이트, R-CC-15). 같은 원문을 `chat_channel_last_error` 에는 싣는 이유는 [R-CC-26](CLE-CHAT-CORE-RENDER.md#r-cc-26-마지막-오류-필드는-프로바이더-원문을-싣고-자격-증명-모양만-가린다) 에 있다.

24시간 유예는 `chat_channel_token_v2` 컬럼과 `setWebhook` 재호출(Telegram)로 구현한다. 컬럼과 정리 흐름은 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 이 정한다.

## 응답 파생 필드 hasBotToken

`GET /api/triggers/:id` 응답의 `config.chatChannel` 에는 `hasBotToken: boolean` 파생 필드가 들어간다.

- 규칙: `botTokenRef` 가 NULL 이 아니면 `true`, 아니면 `false` 다.
- 용도: 화면이 "재발급" 버튼을 켤지 "신규 등록" 폼을 보여 줄지 판단한다.
- 위치: 응답 DTO 전용 파생 필드다. DB 컬럼이 아니고 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 의 메모리 표현 `ChatChannelConfig` 에도 넣지 않는다. 변환은 `TriggersService` 의 응답 경계(`sanitizeForResponse`)가 맡는다.
- 보안: `botTokenRef` 자체와 `botToken` 평문은 응답에 절대 싣지 않는다. 화면은 참조가 있는지만 알면 된다. 응답 비노출 규범의 기준은 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 다.

## 구현 위치

- `codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts`: 봇 토큰 정리 매시간 워커
- `codebase/backend/src/modules/triggers/dto/**/chat-channel-*.dto.ts`: `chat-channel-config.dto.ts`(생성·수정 검증 분리), `responses/chat-channel-rotate-bot-token-response.dto.ts`
- `codebase/backend/src/modules/triggers/dto/chat-channel-bot-token.ts`: 봇 토큰 입력 형식 판정(`BOT_TOKEN_MAX_LENGTH`, 보이는 ASCII 판정). 생성 DTO(`chat-channel-config.dto.ts`)와 재발급 컨트롤러(`triggers.controller.ts`)가 함께 쓴다
- `codebase/backend/src/modules/triggers/triggers.service.ts`(재발급·정리 오케스트레이션, 유예 안의 재발급으로 덮인 토큰 폐기), `triggers.controller.ts`(`rotateBotToken` 엔드포인트, `newBotToken` 입력 검증)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 의 `translateSetupChannelError`: `setupChannel` 실패 분류

## Rationale

### R7 동사를 rotate-bot-token 으로 둔다

EIA `notification/rotate-secret`(알림 서명 시크릿 교체)과 자원이 달라 같은 동사는 헷갈린다. URL 만으로 자원을 알 수 있다. [HTTP API 규약 「2.2 명명 규칙」](../CLE-API/CLE-API-CONV.md#22-명명-규칙) 의 「예외: RPC 형태 하위 채널 액션」 에 해당하고 이 경로가 그 예로 올라 있다.

### R-CC-18 rotate-bot-token 의 워크스페이스 검증은 공용 데코레이터로 한다

워크스페이스 문맥은 공용 `@WorkspaceId()` 로 읽는다. 옛 구현은 헤더만 보고 `401 WORKSPACE_REQUIRED` 를 던졌다. 문맥 부재는 인증 실패가 아니고, JWT `workspaceId` fallback 을 놓쳤으며, 표준 코드 이름과 달라 클라이언트가 같은 조건을 두 번 나눠야 했다. 공용 데코레이터로 옮겨 셋을 함께 없앴다. 옛 코드는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 의 은퇴 코드에 올렸고, 클라이언트 하드코딩 분기가 없어 깨지는 영향은 없다. 그때 문맥이 없으면 `400 WORKSPACE_ID_REQUIRED` 였다.

2026-08-08 에 이 엔드포인트에 `@Roles('editor')` 가 붙었다(역할을 지정하지 않은 라우트의 워크스페이스 멤버십 검증 누락 수정). 그 뒤로는 전역 가드 `RolesGuard` 가 `@WorkspaceId()` 보다 먼저 돈다. 워크스페이스 문맥이 없으면 가드가 `code` 없는 403 으로 거부하고 응답 코드는 기본값 `FORBIDDEN` 이다([워크스페이스와 멤버 「가드 거부 에러 코드」](../CLE-ACCT/CLE-ACCT-WS.md#가드-거부-에러-코드)). 그래서 `400 WORKSPACE_ID_REQUIRED` 는 이 엔드포인트에서 나지 않는다. 비멤버와 뷰어의 거부는 [봇 토큰 재발급 API](#봇-토큰-재발급-api) 의 에러 표에 있다(2026-11-12 정정).

### R-CC-23 setupChannel 실패는 전송 방식이 아니라 원인으로 분류한다

기준을 "401/403 이면 `BOT_TOKEN_INVALID`" 에서 "자격 증명 거부면 `BOT_TOKEN_INVALID`, 그 밖이면 `502 CHAT_CHANNEL_SETUP_FAILED`" 로 바꾸고, 판별은 채널 어댑터가 `code` 로 선언한다. 옛 술어 `/\b(401|403)\b/` 는 Slack(HTTP 200 과 `{ok:false, error:'invalid_auth'}`)과 Discord(`verify_key` 불일치, 상태 코드 없음)에서 걸리지 않고 Telegram(`HTTP {status}` 를 메시지에 싣는다)에서만 걸렸다(2026-09-12 실측). 그래서 가장 흔한 실패인 잘못된 토큰이 Slack 에서 "상류 고장" 으로 나가 사용자가 다시 시도하기만 반복했다.

4xx·5xx 경계는 누가 고칠 수 있는가로 정한다. 잘못된 토큰은 클라이언트가 고치므로 4xx, 프로바이더 장애는 다시 시도할 수밖에 없어 5xx 다. 전송 방식을 기준으로 삼으면 프로바이더가 방식을 바꿀 때 규칙이 조용히 틀린다. 실행 엔진의 "Redis 장애는 502 가 아니라 503" 결정과도 부딪치지 않는다. 503 사용처(`WEBAUTHN_DISABLED`, `SERVER_SHUTTING_DOWN`, `EXECUTION_ENQUEUE_FAILED`)는 모두 우리 쪽이고, 이 결정은 비어 있던 자리(외부 프로바이더 실패)를 채운다. 프로바이더 타임아웃은 두 축이 갈릴 수 있으나 지금은 다시 시도한 뒤의 일반 실패라 502 이고, 실제로 갈리면 그때 정한다. 502 는 이 저장소에서 처음 쓰여(2026-09-12 실측 0건) [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 상태 코드 카탈로그와 [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 데코레이터 표에 행을 새로 둔다.

에러 응답 봉투에는 프로바이더 원문(옛 `details.reason`)을 싣지 않는다. 실행 엔진의 보안 게이트와 R-CC-15 가 막는 것과 같은 누출이기 때문이다. 진단 필드 `chat_channel_last_error` 와의 차이는 R-CC-26 에 있다. 남은 401/403 message fallback 의 제거 조건은 [채팅 채널 어댑터 규약 「setupChannel 실패 판별」](CLE-CHAT-ADAPTER.md#setupchannel-실패-판별) 이 정하고 NERV Task `CLE-T-PDWFV8` 이 판정한다. 2026-10-08 에는 프로바이더에 닿지 않는 입력 형식 에러(제어 문자가 든 봇 토큰)가 502 로 갔다. 위 기준으로는 4xx 여야 한다(2026-10-08 보강, R-CC-26). 2026-11-06 부터는 이런 봇 토큰을 입력에서 400 으로 거부한다([R-CC-32](#r-cc-32-봇-토큰-입력은-보이는-ascii-만-받는다)).

### R-CC-32 봇 토큰 입력은 보이는 ASCII 만 받는다

2026-11-06 결정이다(NERV Task `CLE-T-FX354C`). 이 문제는 NERV Task `CLE-T-H0GF4K` 의 일관성 검토에서 찾았고 R-CC-23 에 2026-10-08 보강으로 적어 두었다.

**결정.** 봇 토큰 입력은 1~256자의 보이는 ASCII(U+0021~U+007E)만 받는다. 공백(양끝이든 가운데든), 제어 문자(CR · LF · NUL 등), ASCII 밖 문자가 있으면 프로바이더를 부르거나 시크릿을 저장하기 전에 400 으로 거부한다.

- 생성(`POST /api/triggers` 의 `chatChannel.botToken`)은 DTO 에서 검증하고 `400 VALIDATION_ERROR` 로 거부한다. 길이 1~256 은 전부터 있었고 이번에 문자 집합을 더했다.
- 재발급(`POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 `newBotToken`)은 컨트롤러에서 검증하고 `400 INVALID_BOT_TOKEN` 으로 거부한다. 새 에러 코드를 만들지 않고 이 코드의 뜻을 넓혔다. 재발급에도 생성과 같은 256자 상한을 둔다. 그전에는 값이 있는지와 문자열인지만 봤다.
- PATCH 는 지금처럼 봇 토큰을 받지 않는다.

**이유.** R-CC-23 은 4xx 와 5xx 를 누가 고칠 수 있는가로 가른다. 이 기준으로 보면 이런 토큰은 사용자가 고칠 입력 에러다. 그런데 이 값은 헤더로 보낼 수 없어서 fetch 가 요청을 만들지 않았다. 그래서 프로바이더에 닿지도 않은 실패가 생성 때의 채널 설정과 그 뒤 발송에서는 채널 건강도 `degraded` 로, 재발급에서는 `502 CHAT_CHANNEL_SETUP_FAILED` 로 드러났다.

**기각한 대안.**

- (a) 프로바이더별 문자 집합. Telegram(`\d+:[A-Za-z0-9_-]+`), Slack(`xoxb-…`), Discord(base64url 과 `.`)의 토큰은 모두 보이는 ASCII 안에 있다. 프로바이더마다 나눠도 더 막을 입력이 없고 프로바이더가 토큰 형식을 바꾸면 정상 토큰을 막게 된다.
- (b) 서버가 양끝 공백을 떼고 받기. 사용자가 보낸 값과 저장된 값이 달라진다. 화면(프론트엔드)은 이미 양끝 공백을 떼고 보낸다.

**이미 저장된 토큰.** 이 결정 전에 저장된 토큰은 바꾸지 않는다. 그런 토큰이 남은 트리거는 지금처럼 `degraded` 로 드러나고 사용자가 재발급으로 고친다.

**알려진 비밀 치환과의 관계.** 프로바이더 API 클라이언트가 실패 문장에서 그 호출의 봇 토큰을 지우는 알려진 비밀 치환([채팅 채널 어댑터 규약 「규칙」](CLE-CHAT-ADAPTER.md#규칙) 10, [응답 자격 증명 마스킹 §1.1](../CLE-API/CLE-API-EGRESS.md#11-egress-only))은 그대로 둔다. 입력 거부는 치환을 대신하지 않고 치환 앞에 덧붙인 검사다. 입력 거부로는 이미 저장된 토큰과 다른 모양의 유입을 막지 못하고 알려진 비밀 치환은 입력 모양과 상관없이 닫는다. [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md#트리거-응답의-마지막-오류를-표면에-올린-이유-2026-10-05) 이 「봇 토큰 입력에서 제어 문자만 거부하기」 를 기각한 이유와 같다.
