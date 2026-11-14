---
id: "CLE-CHAT-CORE-PATCH"
title: "채팅 채널 — 봇 토큰 변경 경로와 PATCH 차단"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT-CORE"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT", "CLE-CHAT-CORE"]
area: "CLE-CHAT"
content_hash: "1fa81217f7106bbba936783448ba78f2250fe2ae6d54071d1763bf1070c21a0e"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "d317c91dc5442ea6fc9dd7407cbe2ba3be8de6575e699c0e26bf7caf89f92e4d"
etag: "sha256-4ed9eefcb0c6d38ac784095b75a36aa844369c4e403619d06971713b3d2b6310"
---
## 개요

이 문서는 [채팅 채널](CLE-CHAT-CORE.md) 의 하위 문서로 봇 토큰을 등록하고 바꾸는 단일 경로, 생성 · PATCH 가 비밀 필드와 원시 `config` 의 `chatChannel` 키를 거부하는 규칙과 `details.field` 모양, 채팅 채널 부착 · 프로바이더 변경 차단, 인바운드 서명 자료 변경 정책을 정한다. 재발급 API 는 [봇 토큰 재발급](CLE-CHAT-CORE-TOKEN.md) 이 정한다.

## 봇 토큰 변경 단일 경로

봇 토큰의 신규 등록과 변경은 한 경로로 모은다.

| 시점 | 방식 | 토큰 변화 |
|---|---|---|
| 트리거 생성(`POST /api/triggers`) | 요청 본문의 `chatChannel.botToken` 평문을 `SecretResolver.rotate()`(UPSERT)로 저장하고 참조로 바꾼다. `setupChannel()` 의 부수 효과로 `botTokenRef` 가 생긴다. `setupChannel()` 은 생성·`chatChannel` PATCH·봇 토큰 재발급 세 경로에서 다시 불리는 멱등 함수라서, 중복이면 에러를 던지는 `store()` 로는 두 번째 호출부터 깨진다([시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md)) | 처음 한 번 |
| 트리거 활성화(`PATCH /api/triggers/:id` 본문 `{ isActive: true }`) | `setupChannel()` 을 부르지 않는다. 외부 프로바이더 등록과 시크릿 저장소의 봇 토큰을 그대로 쓰고 트리거 단위 listener 레지스트리에만 등록한다([R-CC-29](CLE-CHAT-CORE-LISTENER.md#r-cc-29-트리거를-켜고-끌-때-외부-채널-등록은-건드리지-않는다)) | 변경 없음 |
| 토큰 변경 | 늘 [봇 토큰 재발급 API](CLE-CHAT-CORE-TOKEN.md#봇-토큰-재발급-api) 만 쓴다. PATCH 본문의 `chatChannel.botTokenRef`(참조)와 `chatChannel.botToken`(평문)은 모두 `400 VALIDATION_ERROR` 다. `details.field` 의 모양은 아래 표를 본다 | 24시간 유예 적용 |
| `chatChannel` 이 실린 PATCH(`uiMapping`, `rateLimitPerMinute` 등 편집) | `setupChannel()` 을 다시 불러 프로바이더 등록만 갱신한다. 시크릿 저장소의 봇 토큰은 바꾸지 않아 요청 전후 값이 같다. `botTokenRef` 는 설정에서 보존되는 것이 아니라 트리거 id 에서 다시 만든다([시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 24). 이 행은 봇 토큰만 다룬다. 인바운드 서명 자료는 [인바운드 서명 자료 변경](#인바운드-서명-자료-변경) 을 본다 | 변경 없음 |

### 내부 참조 필드 거부

트리거 생성이나 PATCH 본문의 `chatChannel` 에 `botTokenRef` 나 `inboundSigningRef` 가 있으면 값이 그 트리거의 참조여도 거부하는 규칙은 [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 23 의 채팅 채널 쪽 요구사항이다. `inboundSigning` 도 같은 이유로 거부한다. 차단 필드 전체와 `details.field` 모양은 아래가 정한다.

### 차단 필드와 details.field 모양

생성 · PATCH 가 비밀 필드나 원시 `config` 의 `chatChannel` 키를 거부할 때 `details.field` 모양은 보낸 값의 형태와 위치에 따라 갈린다. 네 갈래 모두 `INVALID_FIELD` 를 싣는다(배열이면 `details[].code`, 단일 object 면 `details.code`). 첫째 · 둘째 행은 단위 테스트(`trigger-dto-validation.spec.ts`)로 확인했고 HTTP 왕복은 종단 간 테스트로 확인하지 않았다. 셋째 행은 단위 테스트(`trigger-config-internal-fields.spec.ts`)와 종단 간 테스트(`trigger-config-internal-fields.e2e-spec.ts`)로 확인했다. 넷째 행은 종단 간 테스트(`trigger-raw-config-contract.e2e-spec.ts`)로 확인했다.

이 문서에서 `chatChannel.<field>` 는 요청 본문의 top-level `chatChannel` 필드다. `config.chatChannel.<field>` 는 저장 위치(`Trigger.config.chatChannel`)를 뜻한다. 표의 셋째 · 넷째 행에서만 요청 본문의 `config` 키 아래(원시 `config`)를 뜻한다. 원시 `config` 의 `chatChannel` 은 받지 않는다([트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약)).

차단 필드는 다섯이다. `botTokenRef` · `inboundSigningRef` · `inboundSigning` 은 생성 · PATCH 모두 막는 내부 필드이고 `botToken` · `inboundSigningPlaintext` 는 PATCH 에서만 막는 값 필드다. 원시 `config` 에서는 다섯 모두 생성에서도 막는다(`setupChannel()` 과 평문 제거가 돌지 않기 때문이다). 코드의 단일 기준은 `chat-channel-rejection-messages.const.ts` 의 `CHAT_CHANNEL_BLOCKED_FIELDS` 다. `inboundSigning` 은 저장 필드가 아니다. 입력을 막으려고 목록에 둔 이름이고 저장 필드는 `inboundSigningRef` 다.

| 보낸 값 | 거부하는 층 | `details.field` | `details` 모양 |
|---|---|---|---|
| 비어 있지 않은 문자열 | 전역 `CustomValidationPipe` | 중첩 경로 `chatChannel.<field>` | 배열 |
| `null` 이나 `''` | `@IsEmpty()` 를 통과한 뒤 서비스 가드(`chat-channel-input-rules.ts`) | 평평한 `<field>` | 단일 object |
| 원시 `config.chatChannel.<field>` 의 어떤 값(생성 · 수정 모두) | 서비스 가드(`trigger-config-internal-fields.ts`) | 원시 `config` 경로 `config.chatChannel.<field>` | 단일 object |
| 요청 본문의 원시 `config` 아래 `chatChannel` 키 자체(생성 · 수정 모두, 값과 상관없이) | 서비스 가드(`trigger-config-internal-fields.ts`) | 원시 `config` 경로 `config.chatChannel` | 단일 object |

`details.field` 의 기준을 하나로 고르지 않는 것은 확정된 설계다. DTO 선언(전역 파이프)과 서비스 가드는 서로 다른 입력을 받으므로, 하나를 고르면 다른 입력에서 문서가 틀리게 된다. 셋째 행은 같은 필드가 요청 본문의 다른 위치(원시 `config`)에 실린 경우라 그 위치를 경로로 싣는다. 규칙은 [트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약) 이 정한다(2026-10-04).

넷째 행은 원시 `config` 에 `chatChannel` 키가 있는 경우다. 그 아래에 차단 필드가 없거나 값이 `null` · 빈 객체여도 거부한다(2026-10-31). 셋째 행의 검사가 넷째 행보다 먼저 돈다. 그래서 원시 `config.chatChannel` 아래에 차단 필드가 있으면 `details.field` 는 셋째 행의 `config.chatChannel.<field>` 다. 차단 필드가 없을 때만 넷째 행의 `config.chatChannel` 이다. 원시 `config` 검사 전체의 순서는 [트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약) 이 정한다.

### 한 경로만 두는 이유

PATCH 로 토큰 값을 바꾸면 다음 피해가 생긴다. (a) 외부 프로바이더(Telegram)에 등록된 웹훅은 그대로라 수신이 바로 끊긴다. (b) 재발급 API 의 24시간 유예 정책과 어긋난다. (c) 감사 로그가 `trigger.updated` 와 `trigger.chat_channel_bot_token_rotated` 로 섞인다. 그래서 한 경로만 둔다. 차단 기준은 필드 이름이 아니라 "PATCH 요청자가 자기 비밀로 값을 바꾸는가" 다. 프로바이더가 등록 동작의 일부로 강제하는 재발급(Telegram `secret_token`)은 이 기준의 대상이 아니다. 근거는 R-CC-10 과 R-CC-21 에 있다.

트리거 목록 화면의 PATCH 설명에는 "`chatChannel.botTokenRef`·`botToken` 은 PATCH 로 바꿀 수 없고 재발급 API 를 쓴다" 는 안내가 붙는다([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md)).

### 채팅 채널 부착과 프로바이더 변경

위 표는 봇 토큰만 다룬다. PATCH 가 거부하는 나머지 두 경우는 다음과 같다.

| 시도 | 응답 | 이유 |
|---|---|---|
| `chatChannel` 이 없는 트리거에 PATCH 로 나중에 붙이기 | `400 VALIDATION_ERROR`(`details.field='chatChannel'`) | 최초 설정은 생성(`POST /api/triggers`) 때만 한다. PATCH 는 비밀을 받지 않으므로(R-CC-21) 채팅 채널을 새로 붙일 방법이 없다 |
| `provider` 를 다른 값으로 바꾸기 | `400 VALIDATION_ERROR`(`details.field='provider'`) | `botTokenRef` 는 트리거 id 로만 다시 만들어지므로 그 참조 뒤의 평문은 여전히 옛 프로바이더의 토큰이다. 새 채널 어댑터가 그 토큰으로 외부 API 를 부르게 된다. 바꾸려면 트리거를 지우고 다시 만든다([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md)) |

두 제약은 R-CC-21(PATCH 는 비밀을 받지 않는다)에서 저절로 따라 나온 것이라 새 결정이 아니다. 나중에 붙이기를 막지 않으면 `setupChannel` 이 반드시 실패하고, 그 실패가 외부 API 호출 실패의 흡수 정책([채널 건강도](CLE-CHAT-CORE-RENDER.md#채널-건강도))에 묻혀 `chatChannelHealth='degraded'` 로 200 이 된다. 사용자에게는 저장된 것처럼 보이는데 봇은 죽어 있게 된다. 명시적 400 이 이 조용한 실패를 막는다.

최상위 코드는 기존 `VALIDATION_ERROR` 를 다시 쓰므로 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 에 새로 올릴 코드는 없다. `details[].code` 는 두 경우 모두 `INVALID_FIELD` 다([에러 응답과 클라이언트 처리 「2.5 `field` 를 실으면 `code` 도 싣는다 (2026-09-11)」](../CLE-API/CLE-API-ERROR.md#25-field-를-실으면-code-도-싣는다-2026-09-11)). 최상위가 이미 도메인 코드인 자리(`authConfigId` 의 `AUTH_CONFIG_NOT_FOUND`)의 판정은 [에러 응답과 클라이언트 처리 「2.6 top-level 이 이미 특화 코드일 때 (2026-09-11)」](../CLE-API/CLE-API-ERROR.md#26-top-level-이-이미-특화-코드일-때-2026-09-11) 의 판별 기준을 따르며 이 두 경우와 관계없다.

요청 본문의 원시 `config` 로도 두 제약을 우회할 수 없다. 원시 `config` 에 `chatChannel` 키가 있으면 값과 상관없이 `400 VALIDATION_ERROR` 다. `details.field` 모양은 [차단 필드와 details.field 모양](#차단-필드와-detailsfield-모양) 표의 셋째 · 넷째 행과 같다.

### 인바운드 서명 자료 변경

Slack signing secret 과 Discord ed25519 public key 는 프로바이더가 발급하고 서버에 저장하는 인바운드 서명 자료다. 변경 정책은 다음과 같다.

| 시점 | 방식 | 비고 |
|---|---|---|
| 트리거 생성(`POST /api/triggers`) | 요청 본문의 `chatChannel.inboundSigningPlaintext` 평문을 `SecretResolver.rotate(inboundSigningRef, ws, plaintext)` 로 저장하고 본문에서 지운다. 설정에는 `inboundSigningRef` 만 둔다([시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙)) | 처음 한 번 |
| 트리거 활성화(`PATCH` 본문 `{ isActive: true }`) | `setupChannel()` 을 부르지 않으므로 세 프로바이더 모두 저장된 인바운드 서명 자료를 바꾸지 않는다. Telegram 의 `secret_token` 도 새로 만들지 않는다 | 변경 없음 |
| 변경(Slack·Discord) | 1차 범위에서 정하지 않았다. PATCH 본문의 `chatChannel.inboundSigningPlaintext`·`inboundSigning` 은 `400 VALIDATION_ERROR` 로 막는다. 생성(POST)에서만 받는다. `chatChannel` 이 실린 PATCH 는 저장된 서명 값을 바꾸지 않는다. 바꾸려면 트리거를 지우고 다시 만든다. `details.field` 모양은 봇 토큰과 같다 | 후속 범위에서 따로 결정 |
| Telegram(서버 발급) | `setupChannel()` 이 불릴 때마다 `randomBytes` 로 새 값을 만들어 `setWebhook` 의 `secret_token` 으로 등록하고, 호출자가 그 값을 `inboundSigningRef` 에 다시 저장한다. 따라서 `chatChannel` 이 실린 PATCH 는 Telegram 의 서명 값을 바꾼다. 이것은 우회가 아니라 프로바이더 등록과 한 동작이다. 저장을 건너뛰면 인바운드 서명 검증이 모두 깨진다(헤더 불일치로 401). 기준은 [Telegram 어댑터](CLE-CHAT-TELEGRAM.md) 다. 이 재발급에는 전용 감사 액션이 없다([감사 로그 「감사 액션 카탈로그」](../CLE-OBS/CLE-OBS-AUDIT.md#감사-액션-카탈로그)) | 1차 · 후속 범위의 결정 대상이 아니다 |

현재 구현은 위 표와 같다. PATCH 는 `inboundSigningPlaintext`·`inboundSigning` 을 400 으로 거부한다.

1차 범위에서 막는 이유는 다음과 같다. 봇 토큰 단일 경로(R-CC-10)와 자원 성격이 달라 같은 패턴을 그대로 쓰지 않는다.

- 봇 토큰은 외부 프로바이더(Telegram BotFather, Slack OAuth, Discord Developer Portal)에 등록된 토큰이다. PATCH 로 바꾸면 외부 등록 토큰과 바로 어긋나므로 단일 경로와 24시간 유예가 정당하다.
- 인바운드 서명 자료는 외부 프로바이더가 발급하지만 우리 쪽에는 저장만 된다. 프로바이더가 교체 API 를 주지 않거나(Slack signing secret 은 수동 재발급 뒤 사용자가 다시 입력) 교체가 사용자 워크플로우 밖에서 일어난다.
- 1차 범위에서는 변경 빈도가 낮다고 본다. 재발급 API 를 새로 만드는 비용(24시간 유예, revoke, 감사)을 사용 빈도로 확인한 뒤 후속 범위에서 정한다. 그동안은 보수적으로 막아 정책 모호성을 피한다.

후속 범위의 결정 후보는 Slack·Discord 의 프로바이더 발급 서명 자료에만 해당한다. Telegram 의 서버 발급 자료는 포함하지 않는다.

- (A) 봇 토큰 단일 경로 패턴을 그대로 쓴다. `POST /api/triggers/:id/chat-channel/rotate-inbound-signing` 을 새로 만든다.
- (B) PATCH 본문을 허용한다(유예 없이 바로 교체). 외부 프로바이더가 유예를 주지 않으므로 우리 쪽 유예도 의미가 없다.
- (C) 트리거 삭제·재생성을 강제한다(1차 범위와 같다). UX 부담은 있지만 단순하다.

## 구현 위치

- `codebase/backend/src/modules/triggers/chat-channel-*.ts`(R-CC-22 의 글로브)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`: 입출력 도메인 규칙 순수 함수, R-CC-21 입력 규칙
- `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts`: PATCH 금지 필드와 거부 문구의 단일 기준. 원시 `config` 가드도 이 필드 목록을 쓴다
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`: 시크릿 쓰기와 참조 보존, Telegram `secret_token` 재저장
- `codebase/backend/src/modules/triggers/trigger-config-internal-fields.ts`: 원시 `config` 의 내부 필드 거부와 `chatChannel` 키 거부(`details.field` 표 셋째 · 넷째 행)
- `codebase/backend/src/modules/triggers/dto/create-trigger.dto.ts`
- 테스트: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts`

## Rationale

### R-CC-10 봇 토큰 변경은 재발급 API 한 경로로만

토큰 변경은 늘 재발급 API 이고 PATCH 는 `botTokenRef`·`botToken` 을 모두 막는다(R-CC-21). Telegram 의 서버 발급 서명 자료는 대상이 아니다. PATCH 와 재발급을 함께 허용하는 웹훅 HMAC 시크릿 패턴(이후 폐기됐지만 "서버가 가진 비밀" 이라는 자원 성격 대조는 그대로다)과 결론이 다른 이유는 자원 위치다. HMAC 시크릿은 우리가 가진 비밀이지만 봇 토큰은 외부 프로바이더에 등록된 토큰이라 PATCH 로 바꾸면 우리 DB 만 바뀌고 수신이 바로 깨진다. 두 경로가 함께 있으면 24시간 유예 정책이 어긋나고 감사 로그가 섞이며, PATCH 만 두면 무중단 교체를 잃는다.

감사 action 은 `trigger.chat_channel_bot_token_rotated` 다. 한때 `chat-channel.rotate-bot-token` 으로 적혀 있었는데 `<resource>.<verb>` 구조, 밑줄 구분자, 과거분사 시제를 모두 어겼고 `chat-channel` resource 는 없다. 세 교체 · 재발급 엔드포인트가 모두 `/api/triggers/:id/…` 아래라 resource 는 `trigger` 다(2026-08-11 정정, [감사 action 명명](../CLE-OBS/CLE-OBS-AUDITNAME.md)).

### R-CC-21 PATCH 는 비밀을 쓰지 않는다

이 항목은 R-CC-10 을 뒤집지 않는다. 여기서 "비밀" 은 `botToken` 과 Slack·Discord 의 `inboundSigningPlaintext` 두 가지다. Telegram 의 서버 발급 `issuedInboundSigning` 은 `setupChannel()` 이 새 `secret_token` 을 등록하므로 다시 저장해야 하며, 건너뛰면 인바운드가 모두 401 이 된다(2026-09-10 정정).

**우회의 모양.** 차단이 `botTokenRef` 라는 필드 이름에만 걸려 있었는데 값을 나르는 필드는 `botToken` 이었다. 이 필드는 PATCH·POST 공용 DTO 에서 필수였고, `chatChannel` 이 실린 PATCH 는 재발급의 24시간 유예 백업, 전용 감사 action, `chatChannelRotatedAt` 갱신을 모두 건너뛰고 시크릿 저장소를 덮어썼다. 인바운드 서명 자료도 같았다. 문서는 1차 범위의 변경 차단을 선언했지만 구현은 Slack·Discord 에서 `inboundSigningPlaintext` 가 없으면 400 으로 막아 PATCH 마다 금지된 변경을 강제했다(2026-09-10 에 구현을 맞췄다).

**처방의 함정.** "PATCH DTO 에서 `botToken` 을 뺀다" 만 하면 더 나쁘다. 그때 `setupChatChannel` 은 `secrets.rotate(botTokenRef, ws, cfg.botToken ?? '')` 를 조건 없이 실행했고 `SecretResolver.rotate` 에는 빈 값 가드가 없었다. 그래서 필드가 없으면 빈 문자열로 토큰을 지웠다. 이어지는 `setupChannel` 은 401 을 받아 조용히 `degraded` 가 됐다. 당시에는 `botToken` 이 필수라 요청이 400 으로 막혀 이 일이 일어나지 않았다. 결함이 토큰을 지키고 있었던 셈이다. 그래서 PATCH 가 비밀 필드를 받지 않는 것과 그 경로가 두 비밀을 쓰지 않는 것을 함께 정한다. 검증 함수가 생성·수정 경로에 공유돼 있어 차단을 거기 넣으면 Slack·Discord 생성이 깨지므로 PATCH 전용 경로를 나눠야 한다. 빈 값 가드는 2026-11-06 에 들어갔다. 지금은 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 의 `store` · `rotate` 가 빈 평문을 거부한다.

**기각한 대안.** `botToken` 을 선택 필드로 두고 무시하면 사용자가 설정했다고 믿은 비밀을 말없이 버린다. `SecretResolver.rotate` 에 빈 값 가드를 넣어 이 경로만 막으면 원인을 남긴다(그 가드는 다른 호출부를 위해 따로 검토했고 2026-11-06 에 `store` · `rotate` 자체에 넣었다). Telegram 도 `rotate-inbound-signing` 전용 API 로 나누는 안은 서명 자료를 바꾸는 주체가 Telegram 등록 동작이라 `setupChannel` 재호출 경로가 그대로 남는다. 채널 어댑터가 기존 서명을 다시 쓰게 하는 안은 Slack·Discord 전용으로 후속 범위에 미룬 결정을 Telegram 에 미리 집행하고 Telegram 어댑터 문서와 채널 어댑터 규약을 함께 뒤집는다. `chatChannel` PATCH 에서 `setupChannel` 을 아예 부르지 않는 안은 `setupChannel()` 의 멱등 전제를 깨고 `endpointPath` 변경의 웹훅 재등록을 끊는다.

**세 축.** 차단 기준은 "PATCH 요청자가 자기 비밀로 값을 바꾸는가" 다. 이 축은 봇 토큰과 인바운드 서명의 자원 성격 대조(외부 등록 여부)와 직교하고, "서명 자료를 바꾸는 주체가 누구인가" 축과도 직교한다. 그 축은 서버 발급(Telegram)·프로바이더 발급(Slack·Discord) 구분과 같다. 후속 범위에서 인바운드 서명 자료 교체를 정해도 봇 토큰(R-CC-10 유지)과 Telegram 서버 발급 자료(우리 정책 대상이 아니고, 휩쓸면 서명 검증이 깨진다)에는 닿지 않는다. 후속 범위의 후보 A·B·C 는 Slack·Discord 축 전용이다.

**시크릿 저장소의 교차 행 거부.** Telegram 의 최초 설정과 `chatChannel` 이 실린 PATCH 는 프로바이더에 새 `secret_token` 을 등록한 뒤 `inbound-signing` 행을 `rotate` 로 저장한다. 그 행이 다른 워크스페이스가 소유한 행(비밀 참조 교차 행)이면 [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 25 에 따라 이 저장이 거부된다. 프로바이더에는 새 값이 등록됐고 저장된 값은 옛 값이라 인바운드가 401 로 닫힌다. 트리거는 `degraded` 로 남고 `chat_channel_last_error` 에는 그 거부의 고정 문구가 남는다. 같은 원인이 봇 토큰 재발급에서는 `500 INTERNAL_ERROR` 다([봇 토큰 재발급 API](CLE-CHAT-CORE-TOKEN.md#봇-토큰-재발급-api)). 정리 절차는 [시크릿 저장소 「교차 행 점검과 정리」](../CLE-INT/CLE-INT-SECRET.md#교차-행-점검과-정리) 에 있다.

**`details[].code`.** 네 갈래 모두 같은 헬퍼(`throwInvalidField`)로 `INVALID_FIELD` 를 싣는다. 서비스 가드 갈래에 `code` 를 실은 것은 2026-09-11, 셋째 갈래(원시 `config`)는 2026-10-04, 넷째 갈래(원시 `config` 의 `chatChannel` 키)는 2026-10-31(NERV Task `CLE-T-EA7B5M`)이다.

### R-CC-22 triggers 모듈 안의 구현 경로를 글로브로 적는다

triggers 모듈에 새 파일이 세 번 생겼는데 세 번 모두 구현 위치 목록에서 빠졌고, 빠진 파일이 8개까지 늘었다. 목록에 없으면 그 파일을 고친 변경이 이 문서와 대조되지 않는다. 결정 때(2026-09-11) 이 대조를 강제하던 push 리뷰 가드는 NERV 정본 전환 단계 2(NERV Task `CLE-T-4ABTG7`)에서 없어졌다. 지금은 일관성 검토의 `--impl-done` 이 `## 구현 위치` 가 바뀐 파일을 덮는 문서를 검토 대상에 넣는다(NERV Task `CLE-T-VP5KDJ`). 이 실행을 강제하는 것은 없다(NERV done 게이트는 이 문서가 대상이었는지 보지 않는다). 그래도 목록에서 빠진 파일이 대조에서 빠진다는 점은 같아서 결정을 유지한다(2026-10-03 근거 갱신). 늘어날 예정인 집합은 나열이 아니라 술어로 잡는다. 통째 글로브(`modules/triggers/**`)는 무관한 파일 17개를 끌어들였고, 좁은 글로브 셋은 의도한 파일을 정확히 덮었다(2026-09-11 10개, 2026-09-12 `dto/**` 로 넓힌 뒤 11개, 차집합 0). [스펙과 구현 근거 규약](../CLE-ENG/CLE-ENG-SPECEVIDENCE.md) 규칙 19 · 20 은 글로브를 허용하되 넓은 트리 글로브는 아무것도 가리키지 않는 것과 같다고 본다. 이 결정은 그 취지를 따른다. 남는 위험은 없어진 파일을 가리키던 글로브가 다른 파일에 맞는 것이고 보완은 정기 커버리지 점검이다.
