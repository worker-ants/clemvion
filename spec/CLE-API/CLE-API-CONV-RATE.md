---
id: "CLE-API-CONV-RATE"
title: "HTTP API 규약 — 요청 빈도 제한"
type: "convention"
version: 3
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-CONV"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-CONV"]
area: "CLE-API"
content_hash: "edab36ac0c1d1acc5541dfab81a70eec59f785f0efbaf8afeff382f579e41796"
read_as: "approved_fallback"
task: "CLE-T-SG4GRQ"
source_paths: []
mirror_sha256: "aff8eed8fbf272a80ab8ef6cf35eb0157b4b5c755b56b7f1e51d7a2c7eefdaf8"
etag: "sha256-1b50b125efd516049a989d3ec8bffb91065a9bccac9f115778b13ab168bc9c78"
---
## 개요

이 문서는 [HTTP API 규약](CLE-API-CONV.md) 의 하위 문서로 요청 빈도 제한을 정한다. 한도를 넘었을 때의 응답, 범위별 한도 표, 공통 등급 상수, 전역 한도의 집계 키 결정 규칙, 한도를 건너뛰는 경우가 대상이다. 절 번호(§)와 「규칙 n」 은 부모 문서의 번호를 그대로 쓴다. 요청 빈도 제한 수치의 단일 기준은 이 문서의 §7 표다(규칙 12).

## 7. 요청 빈도 제한

> **초과 응답이 `429` 가 아닌 행이 있다.**
>
> - 서명 참조(`config.chatChannel.inboundSigningRef`)가 있는 채팅 채널 트리거로 온 웹훅 요청은 전역 요청 빈도 제한(일반 API · 웹훅 수신 행)을 받지 않는다. 남용은 서명 검증과 채팅방 단위 분당 한도(채팅 채널 인바운드 행)가 막는다. 서명 참조가 없는 채팅 채널 트리거(옛 트리거, 채널 연결 전 트리거)는 전처럼 전역 한도를 받는다. 그런 트리거는 서명을 검증하지 않아 서명 검증 실패 한도도 걸리지 않으므로 전역 한도까지 빼면 IP 단위 한도가 하나도 남지 않는다. 채팅 채널 트리거는 서명 참조와 무관하게 `auth_config_id IS NULL` 이어도 공개 웹훅 추가 한도를 받지 않는다. 채팅방 단위 한도를 넘은 메시지는 `429` 가 아니라 `202 Accepted` 와 `{ executionId: 'ignored' }` 로 받고 처리를 건너뛴다. Telegram 이 2xx 가 아닌 응답을 재시도나 웹훅 해제로 다루기 때문이다. 한 트리거에 같은 IP 에서 서명 검증 실패가 거듭되면 한동안 시크릿 조회와 서명 계산 없이 `401` 로 거절한다. 이 서명 검증 실패 한도도 `429` 를 쓰지 않는다. 규칙은 [채팅 채널 「인바운드 관문 순서」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-관문-순서) 가 정한다. 전역 한도에서 뺀 근거는 [채팅 채널 「R-CC-12」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-12-인바운드-응답은-202-로-고정하고-401404-만-예외로-둔다) 다. 채팅방 단위 한도의 근거는 [채팅 채널 「R-CC-19」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-19-분당-한도-초과분은-재발송-큐-대신-건너뛰고-degraded-로-표시한다) 다. 경우별 응답은 [채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약) 이 정한다. 웹훅 수신의 전역 한도를 어느 가드가 어떤 순서로 세는지는 표 아래 키 결정 규칙에 있다. 이 예외를 적어 두지 않으면 다음 사람이 "`429` 로 통일" 을 정합성 개선으로 착각한다.
> - WebSocket 명령은 HTTP 요청이 아니라서 상태 코드가 없다. 한도를 넘으면 소켓 `exception` 이벤트(`RATE_LIMITED`)로 알린다([WebSocket 연결과 채널 구독 「에러 코드」](CLE-API-WS.md#71-에러-코드)).

| 범위 | 제한 | 헤더 |
|------|------|------|
| 일반 API | 100 req/min (사용자 기준. 로그인 없는 요청은 IP 기준) | 통과한 응답: `X-RateLimit-Limit` · `X-RateLimit-Remaining` · `X-RateLimit-Reset`. 거부 응답(`429`): `Retry-After` |
| 인증 API (`POST /api/auth/register`, `POST /api/auth/login`) | 10 req/min (IP 기준). 라우트별 `@Throttle` 이다 | 같음 |
| 계정 확인·복구 (`POST /api/auth/forgot-password`, `POST /api/auth/resend-verification`, `POST /api/auth/check-email`) | 5 req/min (IP 기준). 라우트별 `@Throttle` 이다. 동작 정의는 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) | 같음 |
| 초대 토큰 메타 조회 (`GET /api/invitations/:token`) | 30 req/min (공개 라우트라 IP 기준). 토큰 추측을 막는다. 동작 정의는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) | 같음 |
| 로그인 세션 강제 종료 (`POST /api/auth/sessions/:familyId/revoke`, `POST /api/auth/sessions/revoke-others`) | 10 req/min, 5 req/min (순서대로, 사용자 기준). 라우트별 `@Throttle` 이다. 동작 정의는 [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) | 같음 |
| 2단계 인증 설정 시작 (`POST /api/auth/2fa/setup`) | 10 req/min (사용자 기준). 계정 비밀번호 추측을 막는 `@Throttle` 이다. 공통 등급 상수 `SENSITIVE_ACTION_THROTTLE` 을 쓴다(표 아래). 동작 정의는 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) | 같음 |
| 2단계 인증 활성화 검증 (`POST /api/auth/2fa/verify`) | 10 req/min (사용자 기준). 인증 코드 추측을 막는 `@Throttle` 이다. 공통 등급 상수 `SENSITIVE_ACTION_THROTTLE` 을 쓴다(표 아래). 동작 정의는 [가입과 로그인 「TOTP 켜기」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#totp-켜기) | 같음 |
| 2단계 인증 끄기 (`POST /api/auth/2fa/disable`) | 10 req/min (사용자 기준). 인증 코드 추측을 막는 `@Throttle` 이다. 공통 등급 상수 `SENSITIVE_ACTION_THROTTLE` 을 쓴다(표 아래). 동작 정의는 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) | 같음 |
| Passkey 등록 옵션 (`POST /api/auth/2fa/webauthn/register/options`) | 10 req/min (사용자 기준). 계정 비밀번호 추측을 막는 `@Throttle` 이다. 공통 등급 상수 `SENSITIVE_ACTION_THROTTLE` 을 쓴다(표 아래). 등록 검증(`POST /api/auth/2fa/webauthn/register/verify`)에는 라우트별 `@Throttle` 이 없다. 동작 정의는 [가입과 로그인 「Passkey 등록·인증 흐름」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-등록인증-흐름) | 같음 |
| Passkey 복구 코드 재발급 (`POST /api/auth/2fa/webauthn/recovery-codes/regenerate`) | 10 req/min (사용자 기준). 계정 비밀번호 추측을 막는 `@Throttle` 이다. 공통 등급 상수 `SENSITIVE_ACTION_THROTTLE` 을 쓴다(표 아래). 동작 정의는 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) | 같음 |
| Passkey 삭제 (`POST /api/auth/2fa/webauthn/credentials/:id/delete`) | 10 req/min (사용자 기준). 계정 비밀번호 추측을 막는 `@Throttle` 이다. `SENSITIVE_ACTION_THROTTLE` 을 쓴다. 동작 정의는 [Passkey 삭제](../CLE-ACCT/CLE-ACCT-SIGNIN-PASSKEY.md#passkey-삭제) | 같음 |
| 이메일 변경 요청·재발송 (`POST /api/users/me/email-change/request`, `.../email-change/resend`) | 5 req/min (사용자 기준). 라우트별 `@Throttle` 이다. 동작 정의는 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md#이메일-변경) | 같음 |
| 웹훅 수신 | 100 req/min (전역 기본값. `ThrottlerModule` 의 `default` 등급). 전역 가드 대신 트리거를 조회한 뒤 라우트 가드가 센다(표 아래 키 결정 규칙). 서명 참조가 있는 채팅 채널 트리거는 이 한도를 받지 않는다([위 콜아웃](#7-요청-빈도-제한)) | 같음 |
| 공개 웹훅 추가 한도 (`auth_config_id IS NULL` 이고 채팅 채널 트리거가 아닌 트리거. 채팅 채널 트리거는 [위 콜아웃](#7-요청-빈도-제한)) | IP 단위 분당 10건, 시간당 누적 신규 20건(기본값). 전역 100 req/min 위에 얹히는 층이다. `PublicWebhookThrottleGuard` 가 걸고 넘으면 `429 PUBLIC_WEBHOOK_RATE_LIMIT`·`PUBLIC_WEBHOOK_HOURLY_LIMIT` 이다. 상세는 [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) | 웹훅 문서 참조 |
| 파일 업로드 (지식 저장소 문서, 아바타) | 전역 100 req/min 을 그대로 따른다. `POST /api/knowledge-bases/:id/documents` 와 `POST /api/users/me/avatar` 에는 별도 `@Throttle` 이 없다 | 같음 |
| Provider probe API (`POST /api/model-configs/preview-models`, `POST /api/model-configs/:id/test`, `GET /api/model-configs/:id/models`) | 10 req/min (사용자 기준). 실시간 provider 호출 비용과 provider 쪽 속도 제한을 보호하는 `@Throttle` 이다. 세 핸들러가 컨트롤러 상수 `PROVIDER_PROBE_THROTTLE`(`SENSITIVE_ACTION_THROTTLE` 의 별칭)을 함께 쓴다 | 같음 |
| 지식 저장소 재임베딩 (`POST /api/knowledge-bases/:id/re-embed`) | 3 req/min (사용자 기준). `@Throttle`, 편집자 이상. 동작 정의는 [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) | 같음 |
| 지식 저장소 실패 문서 재시도 (`POST /api/knowledge-bases/:id/retry-failed`) | 3 req/min. `@Throttle`, 편집자 이상. 동작 정의는 [지식 저장소 관리](../CLE-KB/CLE-KB-MANAGE.md) | 같음 |
| 임베딩 테스트 (`POST /api/knowledge-bases/embedding-probe`) | 30 req/min. `@Throttle`, 편집자 이상. 동작 정의는 [지식 저장소 관리](../CLE-KB/CLE-KB-MANAGE.md) | 같음 |
| 지식 저장소 그래프 재추출 (`POST /api/knowledge-bases/:id/re-extract`, `POST /api/knowledge-bases/:id/documents/:docId/re-extract`) | 3 req/min, 10 req/min (순서대로, 사용자 기준). `@Throttle`, 편집자 이상. 동작 정의는 [Graph RAG](../CLE-KB/CLE-KB-GRAPH.md) | 같음 |
| 재실행 (`POST /api/executions/:id/re-run`) | 10 req/min (사용자 기준). `@Throttle`(60초에 10회). 넘으면 `429 RATE_LIMITED`. 동작 정의는 [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) | 같음 |
| 초대 발송·재발송 (`POST /api/workspaces/:id/invitations`, `.../invitations/:invitationId/resend`) | 10 req/min (사용자 기준). 메일 폭탄을 막는 `@Throttle` 이다. 공통 등급 상수 `SENSITIVE_ACTION_THROTTLE`(별칭 `INVITATION_THROTTLE`)을 쓴다(표 아래) | 같음 |
| 연결 테스트 (`POST /api/integrations/preview-test`, `POST /api/integrations/:id/test`) | 20 req/min (사용자 기준, 라우트마다 센다). 외부 연결을 거듭 여는 것을 막는 `@Throttle` 이다. 동작 정의와 근거는 [통합 관리 — 연결 테스트](../CLE-INT/CLE-INT-MANAGE-RUN.md#연결-테스트) | 같음 |
| 쇼핑몰 중복 사전 감지 (`GET /api/integrations/cafe24/precheck`, `GET /api/integrations/makeshop/precheck`) | 60 req/min (사용자 기준). 이 엔드포인트 전용 `@Throttle` 이고 일반 API 한도 대신 적용한다. 동작 정의는 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) | 같음 |
| 쇼핑몰 앱 설치 진입점 (`GET /api/3rd-party/cafe24/install/:installToken`, `GET /api/3rd-party/makeshop/install/:installToken`) | 30 req/min (공개 라우트라 IP 기준). 설치 토큰이 URL 에 드러나서 거는 `@Throttle` 이다. 그 위에 도메인 전용 실패 잠금이 있다. 설치 토큰 조회·HMAC 검증 실패가 쌓인 IP 는 `429 CAFE24_INSTALL_RATE_LIMITED`·`MAKESHOP_INSTALL_RATE_LIMITED` 로 거절한다(두 진입점이 `Cafe24InstallRateLimitService` 를 함께 쓴다). `MAKESHOP_INSTALL_RATE_LIMITED` 는 MakeShop 노드의 API 한도 초과 코드 `MAKESHOP_RATE_LIMITED` 와 다른 코드다. 동작 정의는 [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md) · [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md) | 같음 (실패 잠금은 `Retry-After` 없음) |
| 통합 OAuth 콜백 (`GET /api/3rd-party/:provider/callback`) | 60 req/min (공개 라우트라 IP 기준). OAuth code 교환은 외부를 부르므로 그 비용을 줄이려고 거는 `@Throttle` 이다. 사용자 소셜 로그인 콜백 `/api/auth/oauth/:provider/callback` 과는 다른 경로다. 동작 정의는 [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md) | 같음 |
| External Interaction 인바운드 (`POST /api/external/executions/:id/interact`, `POST /api/external/executions/:id/cancel`, `GET /api/external/executions/:id`) | interact 60 req/min, 상태 조회 120 req/min. `/cancel` 은 `/interact` 와 같은 카운터를 센다. **실행 단위**다(IP 아님). 전역 100/min 위에 얹히는 층이다. `InteractionRateLimiterService`(Redis fixed-window)와 `InteractionRateLimitGuard` 가 걸고 넘으면 `429 RATE_LIMITED` 와 `Retry-After` 를 돌려준다. 상세는 [External Interaction API](../CLE-IX/CLE-EIA.md) 의 rate limit 절. 토큰 갱신(`POST /api/external/executions/:id/refresh-token`)은 이 층 밖이다. 전역 기본값 100 req/min 만 받고 `@Public()` 라우트라 IP 로 센다(아래 키 결정 규칙) | `Retry-After` |
| External Interaction SSE 동시 연결 (`GET /api/external/executions/:id/stream`) | 실행당 동시 연결 3개. 상한은 모든 서버 인스턴스의 연결을 합쳐 센다. Redis 를 쓸 수 없으면 서버 인스턴스마다 따로 센다(fail-open). 넘으면 `429 TOO_MANY_CONNECTIONS`(EIA 전용). 상세는 [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) | 없음 |
| 채팅 채널 인바운드 (채팅방 단위) | 채팅방당 분당 60건(기본값. `config.chatChannel.rateLimitPerMinute` 로 1~600 사이에서 바꾼다). 넘은 메시지는 버퍼링·재발사 없이 처리를 건너뛰고 `chat_channel_health=degraded` 로 표시한다. `ChatChannelRateLimiterService`(Redis fixed-window)이고 Redis 를 쓸 수 없으면 fail-open 이다. 상세는 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 이 정한다 | 없음 (위 콜아웃) |
| 채팅 채널 서명 검증 실패 (채팅 채널 트리거의 인바운드 웹훅) | (트리거 id, 클라이언트 IP) 쌍마다 60초 고정 창에 서명 검증 실패 20회. 실패가 20회에 이르면 그 창이 끝날 때까지 시크릿 조회와 서명 계산 없이 `401 AUTH_FAILED` 로 거절한다. `429` 는 쓰지 않는다. `ChatChannelSignatureFailureLimiterService`(Redis `cc:sigfail:` 키)이고 Redis 를 쓸 수 없거나 오류가 나면 막지 않는다(fail-open). 동작은 [채팅 채널 「인바운드 관문 순서」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-관문-순서) 가 정한다 | 없음 (`401`, 위 콜아웃) |
| WebSocket 명령 (`/ws` namespace 의 `@SubscribeMessage`) | **소켓당** 60 msg/min (in-memory fixed-window, HTTP 아님). 전역 요청 빈도 제한(일반 API 100 req/min)은 이 경로를 세지 않는다. 한도를 넘으면 `WsRateLimitGuard` 가 `WsException(RATE_LIMITED)` 을 던지고 클라이언트는 `exception` 이벤트로 받는다(HTTP status 없음). `ping` 을 포함한 모든 `@SubscribeMessage` 핸들러에 적용한다. 등록되지 않은 이벤트(`onAny`)도 같은 소켓 예산을 쓴다. 넘었을 때의 응답은 [WebSocket 연결과 채널 구독 「에러 코드」](CLE-API-WS.md#71-에러-코드) 가 정한다 | 없음 (전송: 소켓 `exception` 이벤트) |

- HTTP 요청이 한도를 넘으면 `429` 를 받는다. 에러 코드는 행에 다른 코드를 적지 않았으면 기본 코드 `RATE_LIMITED` 다([에러 응답과 클라이언트 처리](CLE-API-ERROR.md)). 전역 기본값과 라우트별 `@Throttle` 로 거는 행, External Interaction 인바운드 행은 `Retry-After` 헤더를 함께 싣는다. 공개 웹훅 추가 한도, External Interaction SSE 동시 연결, 쇼핑몰 앱 설치 진입점의 실패 잠금은 `Retry-After` 없이 `429` 만 돌려준다. 초과 응답이 `429` 가 아닌 행(채팅 채널 인바운드, 채팅 채널 서명 검증 실패, WebSocket 명령)은 위 콜아웃에 있다.
- **표의 범위**: 위 표는 전역 기본값(일반 API, 웹훅 수신, 파일 업로드 행)과, 그 위에 라우트별 `@Throttle` 이나 도메인 전용 제한 서비스로 덮어쓴 엔드포인트별 한도를 한 곳에 모은 것이다. HTTP 라우트에 건 `@Throttle` 은 모두 이 표에 행이 있다. 개별 엔드포인트의 권한·부수 효과는 각 도메인 문서가 정하고 요청 빈도 제한 수치의 단일 기준은 이 표다. 라우트에 `@Throttle` 을 새로 걸거나 수치를 바꾸면 이 표도 함께 고친다.
- **공통 등급 상수 `SENSITIVE_ACTION_THROTTLE`**(분당 10회, `throttle.ts`)는 2단계 인증 설정 시작 · 활성화 검증 · 끄기, Passkey 등록 옵션 · 복구 코드 재발급 · 삭제, provider probe, 초대 발송·재발송 행이 함께 쓴다. 상수가 같아도 라우트마다 따로 센다. `verifyPasswordForUser` 를 부르는 라우트(비밀번호 재확인)인 2단계 인증 설정 시작 · 끄기, Passkey 등록 옵션 · 복구 코드 재발급 · 삭제에는 이 상수가 모두 걸려 있어야 한다. 단위 테스트가 이 라우트 목록을 고정해 두고 핸들러마다 이 상수가 걸렸는지 본다. 목록에 없는 새 라우트는 이 테스트에 걸리지 않는다.
- 인증된 HTTP 요청은 전역 `UserThrottlerGuard` 가 `user:<sub>` 키로 사용자별로 센다. 인증되지 않은 요청만 IP 로 센다. 그래서 인증된 라우트의 제한은 사용자 기준이다.
- **전역 요청 빈도 제한은 HTTP 요청만 센다.** 전역 `UserThrottlerGuard` 는 `shouldSkip` 에서 HTTP 요청이 아닌 호출(NestJS `ExecutionContext.getType()` 이 `'http'` 가 아닌 호출. 판정은 `isHttpContext`)을 건너뛴다. NestJS 12 부터 전역 `APP_GUARD` 가 WebSocket 게이트웨이 핸들러에도 붙으므로 그 핸들러 호출이 여기에 든다. WebSocket 명령의 요청 빈도 제한은 소켓당 `WsRateLimitGuard`(분당 60건)가 맡는다([WebSocket 연결과 채널 구독 「에러 코드」](CLE-API-WS.md#71-에러-코드)). 이 건너뛰기는 환경과 무관하고 아래 `NODE_ENV=test` 건너뛰기와 별개로 함께 적용된다. HTTP 요청이어도 `@DeferGlobalThrottle()` 이 붙은 라우트는 전역 가드가 건너뛴다. 그 라우트는 라우트 가드가 같은 한도로 센다(아래 키 결정 규칙). 서명 참조가 있는 채팅 채널 트리거로 온 웹훅 요청은 그 라우트 가드도 세지 않는다([위 콜아웃](#7-요청-빈도-제한)).
- **키 결정 규칙(현재 구현, HTTP 기준)**: 전역 가드는 `JwtAuthGuard` → `UserThrottlerGuard` → `RolesGuard` 순서로 돈다. 추적 키는 `req.user` 의 `sub`(없으면 `userId`)가 있으면 `user:<id>`, 없으면 `req.ip` 다. `@Public()` 라우트는 `JwtAuthGuard` 가 사용자를 채우지 않아 IP 로 센다. 로그인 전 인증 라우트, 웹훅 수신, 인터랙션 토큰으로 인증하는 EIA 경로가 여기 든다. EIA 의 `InteractionGuard` 는 라우트 가드라 전역 가드보다 뒤에 돈다. 웹훅 수신(`POST /api/hooks/:endpointPath`)은 전역 한도를 라우트 가드가 센다. 그 라우트에는 `@DeferGlobalThrottle()` 이 붙어 있어 전역 `UserThrottlerGuard` 가 건너뛴다. 라우트 가드는 `PublicWebhookThrottleGuard` → `HookTriggerThrottlerGuard` 순서로 돈다. `HookTriggerThrottlerGuard` 는 앞 가드가 조회한 트리거로 판정한다. 서명 참조가 있는 채팅 채널 트리거면 세지 않는다([위 콜아웃](#7-요청-빈도-제한)). 그 밖의 요청은 전역 가드와 같은 한도 · 같은 저장소 · 같은 키로 센다. 서명 참조가 없는 채팅 채널 트리거와 트리거가 없거나 조회에 실패한 요청도 센다.
- External Interaction 인바운드는 `@Throttle` 이 아니라 도메인 전용 `InteractionRateLimiterService`(실행 단위 Redis 카운터)로 덮어쓴 사례다.
- **환경으로 건너뛰는 경우는 `NODE_ENV=test` 하나다.** e2e 가 컨테이너 IP 하나에서 빠른 인증 호출을 연달아 보내 스스로 요청 빈도 제한(100/60s)에 걸리는 문제를 피하려고 test 환경에서는 `ThrottlerModule` 의 `skipIf` 가 전역 기본값과 라우트별 `@Throttle` 한도를 건너뛴다. production·development 동작은 바뀌지 않는다. 헬퍼는 `throttler-skip.ts` 의 `shouldSkipThrottle` 이다. 위의 HTTP 가 아닌 호출 건너뛰기와는 별개다.

## 구현 위치

- `codebase/backend/src/common/guards/user-throttler.guard.ts` (전역 요청 빈도 제한 키 결정. HTTP 가 아닌 호출과 `@DeferGlobalThrottle()` 라우트를 건너뛴다)
- `codebase/backend/src/common/guards/user-throttler.guard.spec.ts`
- `codebase/backend/src/common/constants/throttle.ts` (§7 의 공통 등급 상수 `SENSITIVE_ACTION_THROTTLE`)
- `codebase/backend/src/modules/auth/password-recheck-throttle.spec.ts` (`verifyPasswordForUser` 를 부르는 라우트(비밀번호 재확인)의 목록을 고정하고 핸들러마다 §7 의 `SENSITIVE_ACTION_THROTTLE` 이 걸렸는지 보는 단위 테스트)
- `codebase/backend/src/common/utils/throttler-skip.ts` (`NODE_ENV=test` skip)
- `codebase/backend/src/modules/websocket/ws-rate-limit.guard.ts` (WebSocket 명령 빈도 제한)
- `codebase/backend/src/modules/hooks/hook-trigger-throttler.guard.ts` (웹훅 수신의 전역 요청 빈도 제한. 서명 참조가 있는 채팅 채널 트리거는 세지 않는다)
- `codebase/backend/src/modules/hooks/hooks-throttle.wire.spec.ts` (웹훅 수신의 가드 순서)

## Rationale

### 로그인 세션 강제 종료 한도를 사용자 기준으로 적은 이유 (2026-10-10)

두 라우트는 로그인한 사용자만 부른다. 그래서 §7 키 결정 규칙대로 `UserThrottlerGuard` 가 `user:<sub>` 키로 센다(`user-throttler.guard.ts`). 한때 [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 이 같은 한도를 IP 당으로 적어 이 행은 집계 키를 미결로 남겼다. 세션 문서가 v2 에서 집계 키를 이 문서 §7 로 넘겼으므로 이 행까지 미결로 두면 두 문서가 서로 상대에게 미루게 된다. 그래서 구현대로 사용자 기준이라고 적었다.

### 전역 한도의 집계 키 미결을 닫았다 (2026-10-10)

[계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) 이 전역 한도와 로그인 세션 강제 종료 한도를 IP 당으로 적어 §7 과 어긋난다는 미결이 있었다. Task CLE-T-ERAJ7P 에서 그 문서의 요청 빈도 제한 표에 집계 키 열을 더해 인증한 요청은 사용자(`user:<sub>`), `@Public` 라우트는 IP 로 센다고 적었다. §7 키 결정 규칙과 같으므로 미결을 지웠다. [External Interaction API](../CLE-IX/CLE-EIA.md) 가 남긴 미결은 이 문서와 어긋나지 않는다. EIA 인바운드 경로는 `@Public()` 이라 §7 규칙대로 IP 로 센다. 그 미결의 정리는 EIA 문서가 한다.

기각한 대안은 미결을 그대로 두는 안이다. 두 문서가 이미 같은 규칙을 적는데 미결이 남으면 아직 정해지지 않은 것처럼 읽힌다.

### 이메일 변경 행의 소유 문서를 바로잡았다 (2026-10-10)

이메일 변경의 API · 재인증 · 토큰 규칙은 [내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md) 이 아니라 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) 의 「이메일 변경」 절이 정한다. 그래서 이메일 변경 요청 · 재발송 행의 동작 정의 링크를 그 절로 둔다. 두 라우트는 `/api/users/me/*` 의 JWT 인증 라우트라 사용자 기준으로 센다.

### §7 에 2단계 인증 끄기 행을 더한 이유 (2026-10-10)

Task CLE-T-75TDTN 의 결정이다. `POST /api/auth/2fa/disable` 은 비밀번호를 확인한 뒤 TOTP 코드나 TOTP 복구 코드를 한 번 더 확인한다. 인증 코드 추측을 막으려고 `@Throttle(SENSITIVE_ACTION_THROTTLE)` 로 분당 10회를 걸었다. §7 표가 요청 빈도 제한 수치의 단일 기준이므로 라우트별 `@Throttle` 을 더하면 이 표에도 행을 더한다.

기각한 대안은 두 가지다.

- 전역 100 req/min 에 맡기는 안. 비밀번호를 아는 공격자가 6자리 코드를 분당 100회까지 시도할 수 있다.
- 이 라우트 전용 상수를 새로 두는 안. 이 라우트의 의도는 "전역보다 엄격한 민감 동작" 이라 공통 등급 상수의 의도와 같다. 상수의 주석도 정책이 갈릴 때만 분리하라고 적는다.

### 전역 요청 빈도 제한이 HTTP 요청만 센다고 적었다 (2026-10-22)

NERV Task `CLE-T-A3W8B8` 에서 더했다. NestJS 12(`@nestjs/websockets` 12.1.2)부터 전역 `APP_GUARD` · `APP_PIPE` · `APP_INTERCEPTOR` 가 WebSocket 게이트웨이 핸들러에도 붙는다. 고치기 전에는 소켓에 `user` · `ip` 가 없어서 전역 `UserThrottlerGuard` 가 모든 사용자의 WebSocket 명령을 한 버킷(`unknown`)으로 셌다. 이제 이 가드는 HTTP 가 아닌 호출을 건너뛰고 WebSocket 명령은 소켓당 `WsRateLimitGuard` 만 센다. 이 가드는 2026-07-07 에 들어왔다([WebSocket 연결과 채널 구독 「전송 계층을 Socket.IO 로 바로잡은 경위 (2026-06-03)」](CLE-API-WS.md#전송-계층을-socketio-로-바로잡은-경위-2026-06-03)). WebSocket 명령을 그 가드 하나로 세던 설계를 되살린 것이다.

- §7 에 HTTP 요청만 센다는 항목을 더하고 키 결정 규칙이 HTTP 기준이라고 밝혔다. 환경으로 건너뛰는 경우는 `NODE_ENV=test` 하나이고 `skipIf` 가 건너뛰는 범위는 전역 기본값과 라우트별 `@Throttle` 한도다.
- 규칙 12 와 §7 머리 콜아웃에 WebSocket 명령을 초과 응답이 `429` 가 아닌 두 번째 예외로 더했다.
- `Retry-After` 를 싣는 것은 전역 기본값과 라우트별 `@Throttle` 행(`@nestjs/throttler`), External Interaction 인바운드 행(`InteractionRateLimitGuard`)이다. 공개 웹훅 추가 한도(`PublicWebhookThrottleGuard`)와 External Interaction SSE 동시 연결은 `429` 만 돌려준다. 그래서 규칙 12 에는 헤더가 행마다 다르다고만 적고 표 아래 첫 줄에 행 묶음별로 적었다.
- 등록되지 않은 이벤트(`onAny`)의 응답 규칙은 [WebSocket 연결과 채널 구독 「에러 코드」](CLE-API-WS.md#71-에러-코드) 에 맡겼다.

기각한 대안: 전역 가드가 소켓에서 사용자 · IP 키를 만들어 WebSocket 명령도 세는 안. 소켓당 `WsRateLimitGuard` 와 같은 명령을 두 번 센다. WebSocket 명령이 같은 사용자의 HTTP 요청 한도(분당 100회)도 함께 써 버린다.

경위는 [WebSocket 연결과 채널 구독](CLE-API-WS.md#ack-이벤트-wire-와-http-전용-전역-enhancer-를-바로잡은-경위-2026-10-22) 의 Rationale 에 있다.

### §7 표에 빠진 라우트별 한도를 더했다 (2026-10-24)

규칙 12 와 「표의 범위」 는 §7 표를 수치의 단일 기준이라고 한다. 그런데 저장 전 연결 테스트, 쇼핑몰 중복 사전 감지, 쇼핑몰 앱 설치 진입점, 통합 OAuth 콜백, 지식 저장소 그래프 재추출의 `@Throttle` 이 표에 없었다. 코드(`integrations.controller.ts`, `third-party-oauth.controller.ts`, `graph.controller.ts`)로 수치를 확인해 행을 더하고(NERV Task `CLE-T-MJ9G4C`) 「표의 범위」 에 HTTP 라우트의 `@Throttle` 이 모두 표에 있다는 문장과 수치를 바꾸면 표도 고친다는 문장을 더했다. 표와 코드를 대조하는 테스트는 NERV Task `CLE-T-CYEVNV` 로 올렸다.

- 「표의 범위」 를 좁혀 일부 라우트만 표에 두는 안은 고르지 않았다. 빠진 라우트의 수치가 단일 기준 없이 도메인 문서와 코드에만 남고 어느 라우트가 표에 있어야 하는지 알 수 없게 된다.
- 쇼핑몰 앱 설치 진입점의 실패 잠금은 `Retry-After` 없이 `429` 를 돌려준다(코드 확인). 라우트별 `@Throttle` 행은 모두 기본 코드 `RATE_LIMITED` 라서 행마다 적지 않고 표 아래 첫 불릿에 한 번 적었다. 초대 429 를 소문자 `rate_limited` 로 적은 문서가 있지만 코드는 `RATE_LIMITED` 만 낸다(정리는 NERV Task `CLE-T-8WXV7T`).
- `MAKESHOP_INSTALL_RATE_LIMITED` 는 코드(`third-party-oauth.controller.ts`)가 내는 대로 적었다. [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md) 과 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) 의 에러 표에는 아직 `CAFE24_INSTALL_RATE_LIMITED` 만 있고 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 에는 두 코드 모두 없다. 도메인 문서 반영은 NERV Task `CLE-T-SRXR5W`, 카탈로그 등재는 `CLE-T-5BZ3M2` 가 맡는다. 설치 잠금의 `429` 는 전역 예외 필터를 거치지 않아 `requestId` 가 빠진다(NERV Task `CLE-T-YK106G`).
- `/api/3rd-party/*` 경로와 컬렉션 수준 액션 경로(`preview-test`, `precheck`, `preview-models`, `embedding-probe`)는 §2.2 명명 규칙의 예외 행에 없다. 이 개정은 §7 의 수치만 맞췄고 예외 등록은 NERV Task `CLE-T-SRXR5W` 가 맡는다.
- 규칙 12, §7 머리 콜아웃, 표 아래 불릿, [§9](CLE-API-CONV-RESP.md#9-파일-업로드) 에는 엔드포인트나 행의 개수를 쓰지 않는다. 늘면 숫자가 낡는다. [§5.5 「검증 층」](CLE-API-CONV-RESP.md#검증-층-이-규칙을-무엇이-강제하는가) 의 «개수를 세지 않는다» 와 같은 이유다.

### §7 에 2단계 인증 설정 시작 행을 더했다 (2026-11-01)

NERV Task `CLE-T-94FTMV` 에서 더했다. `POST /api/auth/2fa/setup` 은 계정 비밀번호를 확인한 뒤 TOTP secret 을 발급하고 TOTP 가 이미 켜진 계정은 409 `TOTP_ALREADY_ENABLED` 로 거부한다([가입과 로그인 「TOTP 켜기는 비밀번호를 다시 확인하고 켜진 계정을 거부한다」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#totp-켜기는-비밀번호를-다시-확인하고-켜진-계정을-거부한다-2026-11-01)).

- 계정 비밀번호 추측을 막으려고 `@Throttle(SENSITIVE_ACTION_THROTTLE)` 로 분당 10회를 걸었다. 전용 상수를 두지 않은 이유는 「§7 에 2단계 인증 끄기 행을 더한 이유」 의 두 번째 기각 대안과 같다.
- 끄기 행에 합치지 않고 행을 따로 두었다. 설정 시작은 계정 비밀번호 추측을, 끄기는 인증 코드 추측을 막는다.

### §7 에 활성화 검증 · Passkey 등록 옵션 · 복구 코드 재발급 행을 더했다 (2026-11-02)

NERV Task `CLE-T-FRCRF7` 의 사람 결정이다. 정본은 [가입과 로그인 「Passkey 등록에도 비밀번호 재확인을 두고 TOTP 대기 secret 은 10분 뒤 버린다 (2026-11-02)」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-등록에도-비밀번호-재확인을-두고-totp-대기-secret-은-10분-뒤-버린다-2026-11-02) 다.

- Passkey 등록 옵션은 옵션을 만들기 전에 `verifyPasswordForUser` 로 계정 비밀번호를 확인한다. 복구 코드 재발급은 전부터 비밀번호를 확인했지만 라우트별 한도가 없었다. 두 라우트에 계정 비밀번호 추측을 막는 한도를, 활성화 검증에는 인증 코드 추측을 막는 한도를 걸었다. 세 라우트 모두 `@Throttle(SENSITIVE_ACTION_THROTTLE)` 로 분당 10회이고 사용자 기준이다. 활성화 검증은 설정 시작과 막는 대상이 달라 행을 따로 둔다.
- 등록 검증(`POST /api/auth/2fa/webauthn/register/verify`)에는 한도를 걸지 않았다. 등록 검증은 비밀번호를 받지 않고 등록 옵션이 준 `optionsToken` 이 앞선 확인을 대신한다. `optionsToken` 은 발급받은 사용자에 묶이고 5분 동안 유효하므로 비밀번호 재확인 한 번이 그 사용자가 5분 안에 하는 등록을 모두 덮는다.
- 같은 상수를 쓰는 행마다 다른 행을 나열하던 문장을 지우고 표 아래 불릿 한 곳에 모았다. 행마다 나열하면 행을 더할 때마다 여러 행을 함께 고쳐야 하고 한 행만 빠져도 서로 어긋난다.
- `verifyPasswordForUser` 를 부르는 라우트에 한도가 빠지지 않게 단위 테스트로 고정한다. 테스트는 고정한 라우트 목록의 핸들러마다 한도가 걸렸는지 보므로 목록에 없는 새 라우트는 잡지 못한다.
- 비밀번호 변경(`POST /api/users/me/change-password`), 설정 비밀 평문 노출(`POST /api/auth-configs/:id/reveal`), 계정 재인증 라우트는 범위 밖이다. 세 곳도 계정 비밀번호를 확인하지만 `verifyPasswordForUser` 를 부르지 않는다.
- **기각: e2e 로 고정한다.** test 환경에서는 `ThrottlerModule` 의 `skipIf` 가 라우트별 `@Throttle` 한도를 건너뛰어 e2e 로는 한도가 걸렸는지 볼 수 없다.

### 「일반 API」 행의 집계 키와 헤더 칸을 고쳤다 (2026-11-12)

NERV Task `CLE-T-GNTWP9` 의 초안에서 고쳤다. 「일반 API」 행에 로그인 없는 요청은 IP 로 센다는 사실을 더했다. 헤더 칸은 통과한 응답과 거부 응답으로 나눴다. `@nestjs/throttler` 는 통과한 응답에 `X-RateLimit-Limit` · `X-RateLimit-Remaining` · `X-RateLimit-Reset` 을 싣고 `429` 로 거부할 때는 `Retry-After` 만 싣는다. 전에는 거부 응답에도 `X-RateLimit-*` 이 실리는 것처럼 읽혔다.

### 연결 테스트 행에 `:id/test` 를 더했다 (2026-11-14)

근거는 [통합 관리 Rationale](../CLE-INT/CLE-INT-MANAGE-RUN.md#연결-테스트의-탐색-위험을-받아들인다-2026-11-14) 이다(NERV Task `CLE-T-SG4GRQ`).

### 웹훅 수신 한도와 채팅 채널 트리거 면제의 근거

채팅 채널 트리거를 한도에서 뺀 결정과 웹훅 수신 라우트의 가드 순서(`@DeferGlobalThrottle()` · `HookTriggerThrottlerGuard`)는 웹훅 수신(§11.7)과 함께 고치는 일이 많아 [HTTP API 규약 — WebSocket 과 웹훅 수신](CLE-API-CONV-HOOK.md#rationale) 의 Rationale 에 있다. §7 머리 콜아웃과 웹훅 수신 행을 고칠 때는 아래 세 절을 함께 본다.

- [공개 웹훅 추가 한도에서 채팅 채널 트리거를 뺐다 (2026-11-12)](CLE-API-CONV-HOOK.md#공개-웹훅-추가-한도에서-채팅-채널-트리거를-뺐다-2026-11-12)
- [채팅 채널 인바운드를 전역 요청 빈도 제한에서 뺐다 (2026-11-12)](CLE-API-CONV-HOOK.md#채팅-채널-인바운드를-전역-요청-빈도-제한에서-뺐다-2026-11-12) (가드 순서와 그 대가)
- [채팅 채널의 전역 한도 예외를 §7 머리 콜아웃 한 곳에 모았다 (2026-11-13)](CLE-API-CONV-HOOK.md#채팅-채널의-전역-한도-예외를-7-머리-콜아웃-한-곳에-모았다-2026-11-13)
