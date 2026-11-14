---
id: "CLE-TRIG-WEBHOOK-LIMIT"
title: "웹훅 — 요청 제한과 남용 방어"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-TRIG-WEBHOOK"
ancestors: ["CLE-VISION", "CLE-TRIG", "CLE-TRIG-WEBHOOK"]
area: "CLE-TRIG"
content_hash: "44f17e69d59f3d920779c81c169f568281b35ca32eb0bdfe25222803d0efb69e"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "4397689acec3d6517b7fbdd419557f855c6d623c2b371fedca8955e729c1665b"
etag: "sha256-db3eabbf36e78e89de334287a8a29589bb6e9a3286235b27184a76e5ede0f69e"
---
## 개요

이 문서는 [웹훅](CLE-TRIG-WEBHOOK.md) 의 하위 문서로 웹훅 수신 경로의 요청 제한과 공개 웹훅(`auth_config_id IS NULL`)의 남용 방어(적용 범위, 본문 크기, 호출 빈도, 설정 키, Redis 키, 가드 구현)를 정한다.

## 요청 제한과 남용 방어

공개 웹훅은 무차별 대입과 DoS 의 표면이라 인증 웹훅보다 제한을 더 건다. 이 절의 한도는 웹채팅을 포함한 공개 웹훅에 똑같이 적용된다. 채팅 채널 트리거만 뺀다(아래 문단). 정책 수치(분당 10·시간당 20·32KB·공유 버킷)와 응답 코드의 기준은 이 문서다. [웹채팅 보안 §공개 웹훅 남용 방어](../CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md#공개-웹훅-남용-방어) 와 값이 다르면 이 문서를 따른다([공개 웹훅 남용 방어의 기준을 이 문서로 둔다](#공개-웹훅-남용-방어의-기준을-이-문서로-둔다)).

채팅 채널 트리거(`config.chatChannel.provider` 가 빈 문자열이 아닌 문자열인 트리거)는 `auth_config_id` 가 없어도 공개 웹훅 한도(IP 단위 시작 한도 · 시간당 누적 신규 상한 · 본문 32KB)를 받지 않는다. 그 가운데 서명 참조(`config.chatChannel.inboundSigningRef`)가 있는 트리거는 전역 throttler(분당 100건)도 받지 않는다. 서명 참조가 없는 채팅 채널 트리거(옛 트리거 · 채널 연결 전)는 전역 throttler 를 받는다([호출 빈도 제한](#호출-빈도-제한)). 프로바이더 서명으로 인증하고 응답 계약은 [채팅 채널 「인바운드 관문 순서」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-관문-순서) 가 정한다.

- 두 가드(`PublicWebhookThrottleGuard` · `HookTriggerThrottlerGuard`)는 트리거 행의 `config.chatChannel.provider` 가 비어 있지 않은 문자열이면 채팅 채널 트리거로 본다. `HooksService` 가 채팅 채널 분기를 고르는 기준과 같다.
- `HookTriggerThrottlerGuard` 는 저장된 `inboundSigningRef` 가 비어 있지 않아야 한다는 조건을 더한다.
- `config.chatChannel` 이 객체가 아니거나 `provider` 가 없거나 빈 문자열이면 채팅 채널 트리거가 아닌 것으로 보고 한도를 건다.
- 공개 웹훅 한도에서 뺀 이유는 [본문 크기를 공개와 인증으로 나눈 이유](#본문-크기를-공개와-인증으로-나눈-이유) 의 채팅 채널 트리거 항목에 있다.

## 본문 크기

본문 크기 한도는 공개 웹훅과 인증 웹훅을 나눈다(분리 임계).

- 인증 웹훅: `/api/hooks/*`(`HOOKS_ROUTE_PREFIX` 상수) 라우트 전용 body-parser(`createHooksBodyParsers`, `src/bootstrap/hooks-body-parser.ts`)가 본문을 1MB(기본)까지 받는다. `HOOKS_MAX_BODY_BYTES` 로 바꿀 수 있고 과도한 설정으로 인한 메모리 부족을 막으려고 상한 `HOOKS_MAX_BODY_BYTES_CEILING`(16MiB)으로 자른다. 넘으면 body-parser 가 413 을 던지고 `GlobalExceptionFilter` 가 표준 봉투 `PAYLOAD_TOO_LARGE` 로 바꾼다.
- 공개 웹훅: 그 위에서 `PublicWebhookThrottleGuard` 가 32KB(`DEFAULT_MAX_BODY_BYTES`, config `publicWebhook.maxBodyBytes`)를 넘으면 `413 PUBLIC_WEBHOOK_BODY_TOO_LARGE` 로 더 막는다. 채팅 채널 트리거는 이 32KB 를 받지 않고 인증 웹훅과 같은 1MB 파서 상한만 받는다.
- 그 밖의 라우트: 전역 100KB(`createGlobalBodyParsers`)를 명시로 등록해 웹훅이 아닌 라우트의 방어선을 지킨다.
- 파서 등록 순서: `main.ts` 는 `NestFactory.create(AppModule, { bodyParser: false })` 로 Nest 기본 파서를 끄고 hooks 파서(1MB)를 먼저, 전역 파서(100KB)를 다음에 직접 등록한다. hooks 파서가 먼저 파싱해 `req._body` 를 세우면 뒤의 전역 파서는 hooks 요청을 다시 파싱하지 않는다. 두 파서는 공통 `verify` 로 rawBody 를 보존해 HMAC 검증과 맞는다.

## 호출 빈도 제한

- 전역: 글로벌 throttler 분당 100건. 서명 참조가 있는 채팅 채널 트리거는 이 한도를 받지 않는다. 수치의 기준은 [HTTP API 규약 §7](../CLE-API/CLE-API-CONV.md#7-요청-빈도-제한) 이다. 채팅 채널 트리거를 빼는 정책은 그 절과 [채팅 채널 「인바운드 관문 순서」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-관문-순서) 가 정한다. 서명 참조가 있는 트리거로 좁힌 근거는 [서명 참조가 있는 채팅 채널 트리거만 전역 요청 한도에서 뺀다](#서명-참조가-있는-채팅-채널-트리거만-전역-요청-한도에서-뺀다-2026-11-13) 에 있다.
- 전역 한도를 거는 자리: 채팅 채널 트리거인지는 트리거 행을 조회해야 알 수 있다. 그래서 이 라우트는 `@DeferGlobalThrottle()` 로 전역 가드(`UserThrottlerGuard`)를 건너뛴다. 대신 라우트 가드 `HookTriggerThrottlerGuard` 가 `PublicWebhookThrottleGuard` 뒤에서 전역 가드와 같은 한도 · 같은 저장소 · 같은 키로 센다. 이 라우트는 `@Public()` 이라 키는 IP 다.
  - 판정에는 `PublicWebhookThrottleGuard` 가 조회해 둔 트리거를 쓴다. `config.chatChannel.provider` 가 있고 저장된 `inboundSigningRef` 가 비어 있지 않은 트리거만 세지 않는다(`isSignedChatChannelTrigger`). 인바운드 인증기가 서명을 검증하는 조건과 같다.
  - 서명 참조가 없는 채팅 채널 트리거는 센다. 트리거가 없거나(`404` 로 끝날 요청) 그 가드의 트리거 조회가 실패한 요청도 센다. 판정할 수 없는 요청을 빼지 않기 위해서다.
  - 이 순서 때문에 전역 한도를 넘은 요청도 트리거 조회 한 번을 거친 뒤 `429` 로 거절된다. 공개 웹훅은 본문 크기(`413`)와 IP 시작 한도(`429`)를 전역 한도의 `429` 보다 먼저 받는다.
- 공개 웹훅 추가 한도: `PublicWebhookThrottleGuard` 가 `auth_config_id IS NULL` 인 트리거에만(채팅 채널 트리거는 뺀다) IP 단위 시작 한도(기본 분당 10, config `publicWebhook.startupPerMinute`)와 시간당 누적 신규 상한(기본 20, `publicWebhook.hourlyNewMax`)을 건다. 넘으면 `429 PUBLIC_WEBHOOK_RATE_LIMIT` 또는 `429 PUBLIC_WEBHOOK_HOURLY_LIMIT` 이다.
- 가드는 트리거를 조회한 뒤 가장 먼저 한도를 적용한다. 인증 웹훅과 채팅 채널 트리거는 이 가드를 제한 없이 통과한다(본문 크기는 위 라우트 파서가 따로 막는다).
- IP 를 알 수 없는 요청: 공격자가 `X-Forwarded-For`·`CF-Connecting-IP` 헤더를 지우는 등으로 헤더에서 클라이언트 IP 를 알 수 없으면 그런 요청을 모두 하나의 공유 버킷(`UNIDENTIFIED_IP_BUCKET`)으로 묶어 같은 한도를 건다. 무제한 우회가 아니라 유한한 완화 한도다. `req.ip`·`req.socket.remoteAddress` 폴백은 쓰지 않는다. 공유 버킷을 고른 근거와 인프라 권고는 [웹채팅 보안](../CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md) 의 Rationale «공개 웹훅에서 IP 를 알 수 없으면 공유 버킷 하나로 완화 한도를 건다» 에 있다.
- 인증 웹훅의 `ip_whitelist` 는 반대로 IP 를 알 수 없으면 거부한다. rate limit 은 가용성 보호이고 whitelist 는 인증 관문이라 성격이 다르다.
- 가드의 fail-open: Redis 를 쓸 수 없으면 통과시킨다. 가드의 트리거 조회가 실패해도 통과시키되, 공개 웹훅 보호가 잠시 꺼지는 것이므로 `error` 레벨로 로그를 남겨 긴 DB 장애 동안 보호가 빠진 것을 모니터링이 일찍 잡게 한다.

## Redis 키

공개 웹훅 한도는 Redis 버킷 두 개를 쓴다. Redis 키 인벤토리([비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md))는 이 절을 상세 기준으로 가리킨다.

| 버킷 | 키 | 윈도 |
|------|----|------|
| IP 단위 시작 한도(기본 분당 10) | `wh:rl:min:<ip>` | 60초 fixed-window |
| IP 단위 시간당 누적 신규 상한(기본 20) | `wh:rl:hour:<ip>` | 3600초 fixed-window |

IP 를 알 수 없는 요청은 `<ip>` 자리에 sentinel(`__no_client_ip__`, `UNIDENTIFIED_IP_BUCKET`)이 들어가 하나의 공유 버킷으로 묶인다. 로그와 메트릭에서 IP 처럼 보이지만 의도한 집계 키다. 두 키 모두 `INCR` 뒤 첫 증가 때 `EXPIRE` 를 건다(`PublicWebhookQuotaService`, pipeline).

## 구현 위치

- `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (공개 웹훅 본문 32KB 제한과 IP 단위 rate limit. 인증 웹훅과 채팅 채널 트리거(`config.chatChannel.provider` 가 빈 문자열이 아닌 문자열)는 통과)
- `codebase/backend/src/modules/hooks/hook-trigger-throttler.guard.ts` (이 라우트의 전역 요청 한도. `@DeferGlobalThrottle()` 로 비킨 전역 가드 대신 `PublicWebhookThrottleGuard` 뒤에서 같은 한도로 세고 서명 참조가 있는 채팅 채널 트리거는 세지 않는다. 판정 `isSignedChatChannelTrigger` 는 `codebase/backend/src/modules/chat-channel/chat-channel-secret-refs.ts`), `codebase/backend/src/modules/hooks/hooks-throttle.wire.spec.ts` (가드 체인 확인)
- `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` (Redis fixed-window 카운터, 분당·시간당 상한)
- `codebase/backend/src/bootstrap/hooks-body-parser.ts`

## Rationale

### 본문 크기를 공개와 인증으로 나눈 이유

요청 본문 최대 크기는 공개 웹훅과 인증 웹훅에 따로 둔다(공개 32KB, 인증 1MB).

- 기각한 대안 A(전역 1MB 통일): `app.use(json({ limit: '1mb' }))` 로 전역을 1MB 로 올리면 웹훅이 아닌 라우트(로그인 같은 미인증 표면 포함)까지 1MB 본문을 버퍼링해 DoS 표면이 32배 커진다. 전역 100KB 방어선이 약해진다.
- 기각한 대안 B(32KB/100KB 유지): 인증 웹훅의 100KB 는 설계 결정이 아니라 express 기본값이었고 큰 PR·결제 이벤트 같은 정당한 인증 페이로드를 막는다. 비표준 `PayloadTooLargeError` 로 끊기는 불일치도 남는다.
- 채택(분리 임계): 미인증 공개 진입점은 무차별 대입·DoS 표면이라 32KB 보수 한도를 유지하고 신원이 검증된 인증 웹훅만 `/api/hooks/*` 라우트 전용 1MB 파서로 넓힌다. 위험도에 비례한 한도다.
- 채팅 채널 트리거(2026-11-12 결정): 채팅 채널 트리거는 `auth_config_id` 가 없어도 32KB 와 IP 한도를 받지 않는다. 이 트리거는 인증 설정 대신 프로바이더 서명으로 인증한다. 프로바이더는 적은 수의 발신 IP 에서 모든 사용자의 update 를 보내서 IP 한도가 정상 트래픽도 막는다. 그때 나가는 `429` · `413` 은 프로바이더의 재전송과 웹훅 자동 비활성화를 부른다([채팅 채널 「R-CC-12」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-12-인바운드-응답은-202-로-고정하고-401404-만-예외로-둔다)). 그래서 이 트리거는 인증 웹훅과 같은 1MB 파서 상한을 받는다.
  - 서명 검증은 본문을 파싱한 뒤라 검증 전 본문도 1MB 까지 들어온다. 이 점은 미인증 진입점에 32KB 를 두는 위 채택 논거와 다르다. 전용 상한을 둘지는 [웹훅 「미결 사항」](CLE-TRIG-WEBHOOK.md#미결-사항) 에 남겼다.
  - 서명 참조 `inboundSigningRef` 가 없는 트리거(채널 설정 전 · 옛 트리거)는 인바운드 인증기가 서명 검증을 건너뛴다. 공개 웹훅 가드는 서명 참조 유무를 보지 않는다. 전역 한도 가드는 이 트리거를 센다([호출 빈도 제한](#호출-빈도-제한)). 그래서 이 트리거에 남는 방어는 1MB 파서 · 전역 throttler · 대화 단위 분당 한도(`rateLimitPerMinute`)다. 서명을 검증하지 않으니 서명 검증 실패 한도는 걸리지 않는다. 대화 단위 한도의 키는 요청 본문의 대화 ID 라서 서명이 없으면 요청을 보내는 쪽이 값을 바꿔 피할 수 있다.
- 구현 결정(`bodyParser: false` 와 명시 등록 순서): Nest 기본 파서를 켠 채 `app.use(json())` 같은 수동 파서를 더하면 Nest 가 자기 전역 파서 등록을 건너뛰어 hooks 가 아닌 본문이 파싱되지 않는(`req.body=undefined`) 함정이 있다. 그래서 기본 파서를 끄고 hooks 파서(1MB, 먼저)와 전역 파서(100KB)를 직접 등록한다.
- 메모리 상한: `HOOKS_MAX_BODY_BYTES` override 는 16MiB 로 잘라 운영 실수로 메모리 표면이 커지는 것을 막는다.
- 표준 413: 초과하면 body-parser 의 413 을 `GlobalExceptionFilter` 가 표준 봉투 `PAYLOAD_TOO_LARGE` 로 바꾼다.

### 공개 웹훅 가드는 조회 실패 때 통과시키고 error 로그를 남긴다

`PublicWebhookThrottleGuard` 는 트리거를 DB 에서 조회해 공개 웹훅인지 판정하고 IP rate limit 을 건다. 조회가 실패하면(DB 일시 장애, Redis 미가용 등) 요청을 통과시킨다(fail-open).

- 채택(fail-open): 이 가드의 책임은 가용성 보호인 rate limit 이지 인증·인가가 아니다. 인증은 인증 설정 경로가, 페이로드 검증은 `hooks.service` 가 맡는다. 보조 층이 자기 인프라 장애로 정상 트래픽 전체를 막으면(fail-closed) 가용성 사고가 인증 사고보다 크다. 그래서 조회 실패 때는 통과시키고 남용 보호는 뒤의 층(전역 throttler, 페이로드 검증)에 맡긴다.
- 기각(fail-closed): 조회 실패 때 전부 거부하면 DB·Redis 순간 장애가 곧바로 공개 웹훅 전면 중단으로 이어진다. rate limit 의 부수적 역할에 비해 영향 범위가 지나치다.
- 보완(`error` 레벨 로그): fail-open 은 보안 강도가 잠시 떨어지는 구간이라 catch 블록은 `logger.warn` 대신 `logger.error` 로 남긴다. 장애가 길어지면 운영이 보호가 빠진 구간을 알아차릴 수 있다. 알림 폭주는 모니터링 시스템의 rate limit·flapping 정책으로 억제한다.

### 공개 웹훅 남용 방어의 기준을 이 문서로 둔다

공개 웹훅 남용 방어의 정책 수치와 응답 코드는 이 문서, [웹훅 「요구사항」](CLE-TRIG-WEBHOOK.md#요구사항), [수신 API](CLE-TRIG-WEBHOOK-API.md#수신-api) 의 에러 표가 기준이다. 전에는 웹훅 문서와 [웹채팅 보안](../CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md) 이 서로를 정책 수치의 기준으로 가리켜 미결 사항에 올라 있었다. 결정은 NERV Task `CLE-T-MCYDVV` 에서 했고 웹채팅 쪽 경위는 [웹채팅 보안 「공개 웹훅 남용 방어의 기준은 웹훅 문서다」](../CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md#공개-웹훅-남용-방어의-기준은-웹훅-문서다) 에 있다.

- 가드 구현, 설정 키, 에러 코드, Redis 키, 구현 위치를 모두 이 문서가 적는다.
- 이 방어는 채팅 채널 트리거를 뺀 모든 공개 웹훅에 걸리고 웹채팅은 그 가운데 하나다.
- 두 문서가 서로를 기준으로 가리키면 한쪽만 고쳤을 때 값이 어긋난다. 웹채팅 보안은 같은 방어를 공개 챗봇 관점에서 다시 적고 값이 다르면 이 문서를 따른다.

### 서명 참조가 있는 채팅 채널 트리거만 전역 요청 한도에서 뺀다 (2026-11-13)

채팅 채널 트리거 가운데 서명 참조(`config.chatChannel.inboundSigningRef`)가 있는 트리거만 전역 요청 한도(분당 100건, IP 키)에서 뺀다. 서명 참조가 없는 트리거(옛 트리거 · 채널 연결 전)는 일반 웹훅과 같이 센다. 사람 결정(NERV 질문 `01a1d322-7833-756b-a20d-2e3e247411f3` 답 A, 2026-11-13)이고 구현은 NERV Task `CLE-T-ZC34Y0` 이 했다.

- 채팅 채널 트리거를 전역 한도에서 빼는 정책은 [HTTP API 규약 §7](../CLE-API/CLE-API-CONV.md#7-요청-빈도-제한) 과 [채팅 채널 「인바운드 관문 순서」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-관문-순서) 가 정한다. 그 대신 서명 검증과 대화 단위 분당 한도로 남용을 막는다.
- 모든 채팅 채널 트리거를 빼면 서명 참조가 없는 트리거에 IP 단위 한도가 하나도 남지 않는다. 그 트리거에 서명 검증 실패 한도가 걸리지 않고 대화 단위 한도는 피할 수 있는 사정은 [본문 크기를 공개와 인증으로 나눈 이유](#본문-크기를-공개와-인증으로-나눈-이유) 에 적었다.
- 판정(`isSignedChatChannelTrigger`)은 인바운드 인증기가 서명을 검증하는 조건과 같다. 저장된 참조만 보고 시크릿을 읽지 않으므로 요청마다 DB · 시크릿 저장소 조회가 늘지 않는다.
- 공개 웹훅 한도는 이 결정과 상관없다. 채팅 채널 트리거면 서명 참조 유무와 상관없이 공개 웹훅 한도를 받지 않는다([본문 크기를 공개와 인증으로 나눈 이유](#본문-크기를-공개와-인증으로-나눈-이유)).
