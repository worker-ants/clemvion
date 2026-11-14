---
id: "CLE-CHAT-ADAPTER-SETUP"
title: "채팅 채널 어댑터 규약 — 채널 등록 실패와 토큰 폐기"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT-ADAPTER"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT", "CLE-CHAT-ADAPTER"]
area: "CLE-CHAT"
content_hash: "1e34a960c94dcdd710a32a61d9d15ed6657ea5fbedcfa512caf475a22e5a6531"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "f8884697e86475acc008c6a69458ff35518419f266750dc988c88f08e0e472f9"
etag: "sha256-f72cd0315a81185c5d9f60e72ff5ee4817ddf7b1b1aa76e9b9121e2ecc00ff7d"
---
## 개요

이 문서는 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 의 하위 문서로 `setupChannel` 의 멱등, 등록 실패 사유의 선언과 판별, 프로바이더 API 클라이언트의 실패 판정, 이전 봇 토큰 폐기 시점을 정한다.

## setupChannel 멱등의 뜻

`setupChannel` 의 멱등은 "같은 설정으로 다시 불러도 등록이 깨지지 않는다" 는 뜻이다. 발급되는 시크릿 값이 그대로라는 뜻이 아니다. Telegram 어댑터는 부를 때마다 `randomBytes` 로 새 `secret_token` 을 만들어 `setWebhook` 에 등록하고, 호출자가 그것을 `inboundSigningRef` 에 다시 저장한다. 이것이 정상 동작이며 저장을 건너뛰면 인바운드 서명 검증이 모두 깨진다([Telegram 어댑터](CLE-CHAT-TELEGRAM.md), [채팅 채널](CLE-CHAT-CORE.md) 의 인바운드 서명 자료 변경).

이 구분은 등록과 값 두 층을 가르는 규약이다. 멱등을 값 불변으로 읽어 Telegram 재저장을 막으면 모든 Telegram 인바운드가 401 이 된다.

## setupChannel 실패 판별

`setupChannel` 이 자격 증명 거부로 실패하면 던지는 `Error` 에 `code: 'BOT_TOKEN_INVALID'` 를 실어 사유를 선언한다. 옛 규약은 `teardownChannel` 과 `revokeBotToken` 도 같이 적었으나 `revokeBotToken` 은 에러를 흡수한다고도 적어 어긋난다([미결 사항](CLE-CHAT-ADAPTER.md#미결-사항)). 호출자는 `code` 로만 분류하고 `message` 를 해석하지 않는다. `code` 가 없는 에러는 일반 실패로 다룬다. 응답 분류(`400 BOT_TOKEN_INVALID`, `502 CHAT_CHANNEL_SETUP_FAILED`)는 [채팅 채널](CLE-CHAT-CORE.md) 의 봇 토큰 재발급 API 가 정한다(근거 R-CCA-9).

`code` 라는 이름은 이 호출 스택에서 네 가지 뜻으로 쓰인다. 섞으면 조용히 잘못 분기한다.

| 무엇 | 소유 | 값 |
|---|---|---|
| 이 절의 `code` | 채널 어댑터가 새로 던지는 `Error` 의 프로퍼티 | 우리 문자열(`'BOT_TOKEN_INVALID'`) |
| 실행 실패 안내 분류의 `event.error.code` | EIA 이벤트 페이로드 | 실행 실패 분류용, 다른 네임스페이스 |
| `app.code`·`res.code` | 프로바이더 원본 API 응답 필드(Discord) | 숫자. 실패 판별에 쓰지 않는다(클라이언트가 만든 합성 실패에는 없다) |
| Node·undici 시스템 에러의 `code` | 런타임이 붙인다 | `'ENOTFOUND'`, `'ECONNREFUSED'`, `'UND_ERR_*'` |

세 번째는 이름이 가깝다. 이 필드는 프로바이더가 돌려준 4xx 본문에만 있고 클라이언트가 API 호출 재시도를 다 쓰고 만든 합성 실패에는 없다. 그래서 채널 어댑터는 이 필드가 있는지로 실패를 판정하지 않는다([클라이언트 실패 판정](#클라이언트-실패-판정)). 네 번째는 판별을 뒤집는다. DNS 가 죽은 `Error` 도 `.code` 가 있으므로 `if (err.code)` 같은 참거짓 판별은 네트워크 단절을 "토큰이 잘못됐다" 로 보고한다. 그래서 판별은 허용 목록 정확 일치(`err.code === 'BOT_TOKEN_INVALID'`)여야 한다. `telegram-client.ts` 주석이 이미 적고 있듯 undici 는 `ENOTFOUND` 를 이 자리로 보낸다. 구현은 `ENOTFOUND → 502` 테스트로 이 오분류를 막는다.

호출자가 프로바이더 신호 방식을 추측하지 않는 이유는 방식이 서로 다르기 때문이다. Slack 은 HTTP 200 과 `{ok:false, error:'invalid_auth'}`, Discord 는 `verify_key` 불일치(상태 코드 자체가 없다), Telegram 은 `HTTP 401` 로 알린다. 문자열에서 상태 숫자를 찾는 방식은 세 프로바이더 중 두 곳에서 원리적으로 실패한다(2026-09-12 실측).

**한시 예외: 호출자의 401/403 fallback.** `code` 가 없는 에러에 대해 호출자는 message 의 401/403 을 보고 `BOT_TOKEN_INVALID` 로 분류한다. "message 원문으로 분기하지 않는다"([R-CCA-5](CLE-CHAT-ADAPTER-RENDER.md#r-cca-5-실행-실패-분류-함수를-규약에-둔다), [채팅 채널 「R-CC-15 실행 실패 안내의 입력과 자리표시자를 허용 목록으로 제한한다」](CLE-CHAT-CORE.md#r-cc-15-실행-실패-안내의-입력과-자리표시자를-허용-목록으로-제한한다), 실행 엔진 보안 게이트, 에러 코드 카탈로그의 `FILE_REQUIRED` 주석)에 대한 의도적 예외다. `code` 를 아직 붙이지 않은 경로가 조용히 502 로 빠지는 것보다 400 이 사용자에게 낫다.

1차 범위의 세 채널 프로바이더(Telegram·Slack·Discord)는 2026-09-12 에 모두 `code` 부착을 마쳤지만 실측 판정은 "아직 지우지 말 것" 이다. 부착은 주 경로에 한정되고 fallback 이 유일한 방어인 경로가 남아 있다. 대표적으로 Slack 4xx 응답이 JSON 이 아닐 때 클라이언트가 만드는 `error: 'HTTP 401'` 은 자격 증명 값 허용 목록에 없다. `code` 부착은 제거의 충분조건이 아니고, 그 조건만 보고 지우면 그 경로들이 조용히 502 로 바뀐다. 제거할 수 있는 때는 fallback 이 유일한 방어인 경로가 하나도 남지 않았을 때다.

조건만 적고 추적하지 않으면 한시 예외가 영구 예외가 된다. 남은 경로에 `code` 를 붙이고 제거를 다시 판정하는 일은 NERV Task `CLE-T-PDWFV8` 이 맡는다.

### 클라이언트 실패 판정

이 절의 앞부분은 채널 어댑터가 호출자에게 실패 사유를 알리는 층이다. 그보다 한 층 아래에서 채널 어댑터는 프로바이더 API 클라이언트(`providers/<프로바이더>/<프로바이더>-client.ts`)의 결과를 보고 실패인지 판정한다.

- 클라이언트는 실패를 `ok: false` 표지로 돌려준다. 프로바이더가 돌려준 4xx 본문이든 클라이언트가 API 호출 재시도를 다 쓰고 만든 합성 실패(fetch 예외, 429 소진, 5xx)든 같다.
- 채널 어댑터는 이 `ok: false` 로 실패를 판정한다. 프로바이더 원본 응답 필드(Discord 숫자 `code`)가 있는지로 판정하지 않는다. 합성 실패에는 그 필드가 없어 실패가 성공으로 처리된다.
- 실패한 `sendMessage` 는 throw 한다. 호출자는 그 실패를 받아 채널 건강도를 `degraded` 로 둔다([채팅 채널 「채널 건강도」](CLE-CHAT-CORE.md#채널-건강도)).
- `setupChannel` 이 안에서 부르는 하위 호출이 실패해도 `setupChannel` 실패다. [Discord 어댑터](CLE-CHAT-DISCORD.md) 의 slash command 일괄 등록(`PUT /applications/{app_id}/commands`)이 그 예다. 결과를 보지 않으면 등록 실패가 정상 설정으로 보인다.
- 자격 증명 거부 판정 방식은 바꾸지 않는다. Discord 는 클라이언트가 실어 준 HTTP `status`(401/403)로 가린다. slash command 일괄 등록이 401/403 으로 실패해도 `code: 'BOT_TOKEN_INVALID'` 를 싣는다(규칙 5).

Slack·Telegram 클라이언트와 채널 어댑터는 이미 `ok` 로 판정한다. 근거는 R-CCA-11 이다.

## 이전 봇 토큰 폐기

이전 봇 토큰의 외부 폐기는 선택 함수 `revokeBotToken?` 이 한다([인터페이스와 함수 책임](CLE-CHAT-ADAPTER-IFACE.md#채널-어댑터-인터페이스)). 호출자는 둘이다.

- 24시간 유예가 끝난 정리 작업(`TriggersService.cleanupRotatedChatChannelTokens`)이 v2 참조(`bot-token.v2`)에 백업해 둔 이전 토큰을 폐기한다.
- 재발급(`TriggersService.rotateBotToken`)은 유예 안에 다시 교체해 v2 백업에서 덮인 토큰만 폐기한다. 교체가 끝까지 성공한 뒤(설정 컬럼 갱신과 감사 기록 뒤)에만 부르고, 덮인 값이 비었거나 지금 토큰·새 토큰과 같으면 부르지 않는다.

재발급이 방금 v2 로 백업한 이전 토큰은 재발급 시점에 폐기하지 않는다. 폐기 실패는 흐름을 막지 않는다. 근거는 [R-CCA-10](#r-cca-10-이전-봇-토큰은-24시간-유예가-끝난-정리-작업이-폐기한다) 이다.

## Rationale

### R-CCA-9 실패 사유를 message 가 아니라 code 로 선언한다

채널 어댑터가 자격 증명 거부를 `Error.code` 로 선언하고 호출자는 `message` 를 해석하지 않는다. 기각한 대안은 둘이다.

| 대안 | 기각 이유 |
|---|---|
| 호출자가 `message` 에서 상태 숫자를 찾는다(예전 구현) | 프로바이더가 숫자를 주지 않으면 원리적으로 실패한다. 1차 범위의 세 채널 프로바이더 중 두 곳이 그랬다. 규칙이 조용히 틀리고 다음 프로바이더에서도 같은 일이 난다 |
| 채널 어댑터가 `message` 를 `'BOT_TOKEN_INVALID:'` 접두로 시작한다 | Discord 어댑터가 실제로 쓰던 방식이라 관례를 승격하자는 제안이었다. 여전히 문자열 해석으로 제어 흐름을 가르고, 이 저장소는 같은 문제에서 이미 세 번 반대로 결정했다([R-CCA-5](CLE-CHAT-ADAPTER-RENDER.md#r-cca-5-실행-실패-분류-함수를-규약에-둔다) 와 [채팅 채널 「R-CC-15 실행 실패 안내의 입력과 자리표시자를 허용 목록으로 제한한다」](CLE-CHAT-CORE.md#r-cc-15-실행-실패-안내의-입력과-자리표시자를-허용-목록으로-제한한다), 실행 엔진 보안 게이트, 에러 코드 카탈로그의 `FILE_REQUIRED` 주석). 그 접두는 관례가 아니라 규칙이 없던 흔적이었다 |

`code` 가 나은 이유는 컴파일러와 리팩터링 도구가 볼 수 있어서다. 문자열 접두는 오타, 번역, 문구 정리에 조용히 깨지고 깨졌다는 신호도 없다.

변경 관리의 옛 문구 "모든 구체 어댑터 문서를 함께 고친다" 는 "영향받는 모든" 으로 읽는다. 지금 문구가 그 해석이다. 이 결정은 프로바이더 문서 가운데 Slack 만 고쳤다. Slack 의 실패 응답 모양(HTTP 200 과 `{ok:false}`)이 이 결정의 실질 동기인데 문서에 없었기 때문이다. [setupChannel 멱등의 뜻](#setupchannel-멱등의-뜻) 도 Telegram 문서 하나만 고친 선례가 있다. 채널 프로바이더 카탈로그는 프로바이더 목록이나 지원 상태가 바뀔 때만 고친다. [R-CCA-12](CLE-CHAT-ADAPTER-RENDER.md#r-cca-12-uimappingvisualnode-를-세-값으로-바꾼다) 는 enum 필드 하나의 변경이라 카탈로그를 고치지 않았다.

### R-CCA-10 이전 봇 토큰은 24시간 유예가 끝난 정리 작업이 폐기한다

이전 봇 토큰의 외부 폐기(`revokeBotToken`, Slack `auth.revoke`)는 24시간 유예가 끝난 정리 작업 `TriggersService.cleanupRotatedChatChannelTokens` 가 부른다. 이 작업은 `ChatChannelTokenRotatorService` 가 매시간 돌린다. 폐기 대상은 재발급 때 v2 참조(`bot-token.v2`)에 백업해 둔 이전 토큰이다. 재발급(`TriggersService.rotateBotToken`) 시점에는 방금 백업한 이전 토큰을 폐기하지 않는다. 유예 안에 다시 교체한 경우의 예외는 이 절 끝에 적었다.

유예를 두는 목적은 재발급 직후에도 이전 토큰으로 진행 중인 요청이 끝까지 처리되게 하는 것이다. 이 목적과 맞는 폐기 시점은 유예가 끝난 뒤뿐이다.

기각한 대안은 재발급 즉시 폐기다. 그러면 24시간 유예 동안 이전 토큰으로 진행 중이던 요청이 실패한다. 유예를 둔 의미가 없어진다.

옛 문구는 재발급 시점에 즉시 폐기한다고 읽혔다. 2026-11-06 에 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 과 현재 구현(`cleanupRotatedChatChannelTokens` → `tryRevokeBotToken`) 쪽으로 정했고 코드 동작은 바꾸지 않았다. 출처는 NERV Task `CLE-T-D41BY6` 와 리뷰 발견 `01a0e596-b8dd-74bb-904b-76b68a4177a6` 이다.

유예 안에 다시 교체하면 재발급이 폐기를 부르는 경우가 하나 생긴다. 2026-11-13 사람 결정(NERV 질문 `01a1d2f3-e056-744a-a58f-76fe3a46c612`)이고 출처는 NERV Task `CLE-T-6ZTPZ8` 4번이다. 토큰을 A 에서 B 로 바꾸고 24시간 안에 B 에서 C 로 다시 바꾸면 v2 백업 칸(`bot-token.v2`)의 A 가 B 로 덮인다. 그 뒤로는 A 를 가리키는 기록이 우리 쪽에 남지 않아 유예 종료 정리 작업도 A 를 폐기하지 못한다. 그래서 재발급이 끝까지 성공한 뒤(설정 컬럼 갱신과 감사 기록 뒤) 덮인 A 를 `revokeBotToken` 으로 best-effort 폐기한다. 실패해도 재발급은 성공이고 경고 로그만 남긴다. 대가로 A 의 유예는 두 번째 교체 시점에 끝난다. 덮인 값이 비었거나 지금 토큰(B)·새 토큰(C)과 같으면 폐기하지 않는다. 같은 토큰으로 되돌리는 교체에서 쓰고 있는 토큰을 끊지 않기 위해서다. 재발급이 실패해 v2 를 A 로 되돌리면 폐기하지 않는다. B 는 위 원칙대로 유예가 끝난 뒤 정리 작업이 폐기한다.

### R-CCA-11 클라이언트 실패는 ok:false 표지로 판정한다

프로바이더 API 클라이언트는 실패를 `ok: false` 표지로 돌려주고 채널 어댑터는 그 표지로 실패를 판정한다. 프로바이더 원본 응답 필드(Discord 숫자 `code`)가 있는지로 판정하지 않는다. 실패한 `sendMessage` 는 throw 하고 `setupChannel` 의 하위 호출 실패는 `setupChannel` 실패다([클라이언트 실패 판정](#클라이언트-실패-판정)).

결함은 Discord 에서 드러났다. Discord 클라이언트(`discord-client.ts` `call()`)는 3회 시도를 다 쓴 실패(fetch 예외, 429 소진, 5xx)를 `{ ok: false, message }` 로 돌려주고 Discord 원본 숫자 `code` 를 싣지 않는다. Discord 어댑터는 `code` 가 있는지로 실패를 판정했다. 그래서 네트워크 단절이나 5xx 뒤의 `sendMessage` 가 성공으로 처리되고 `chat_channel_health` 가 `degraded` 가 되지 않았다. [채팅 채널 「채널 건강도」](CLE-CHAT-CORE.md#채널-건강도) 의 요구사항 위반이다. `setupChannel` 은 실제 원인 대신 고정 문구 `Discord application 응답에 id 누락` 을 던졌다. slash command 일괄 등록은 결과를 보지 않아 등록 실패가 정상 설정으로 보였다.

기각한 대안은 클라이언트가 합성 실패에 가짜 숫자 `code` 를 싣는 것이다. 채널 어댑터의 판정을 그대로 두고 결함을 막을 수는 있다. 하지만 Discord 원본 `code` 네임스페이스에 우리가 만든 값이 섞인다. 그러면 「setupChannel 실패 판별」 의 `code` 네 가지 뜻 가운데 세 번째(프로바이더 원본 응답 필드)의 뜻이 흐려진다. `ok` 는 Slack·Telegram 클라이언트가 이미 쓰는 표지라 세 프로바이더의 판정 방식도 하나로 맞는다.

출처는 NERV Task `CLE-T-KX2Q2N` 과 점검 Task `CLE-T-H0GF4K` 다.
