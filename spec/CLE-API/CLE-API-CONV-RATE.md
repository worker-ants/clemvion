---
id: "CLE-API-CONV-RATE"
title: "HTTP API 규약 — 요청 빈도 제한"
type: "convention"
version: 5
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-CONV"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-CONV"]
area: "CLE-API"
content_hash: "211d34b72b00b19e6db6b05eb837a7e815051a9a54986e28815a160ce2f646df"
read_as: "approved_fallback"
task: "CLE-T-CJ7HB1"
source_paths: []
mirror_sha256: "2a014ef8f688a06fb292aef2027afabdfe5907bf0fed8fb0fa6eb457f20b449b"
etag: "sha256-c290a3335b5099a342e89bd7f93bc97a905c43ea286ebd2ee628097abd59bc84"
---
## 개요

이 문서는 [HTTP API 규약](CLE-API-CONV.md) 의 하위 문서로 요청 빈도 제한을 정한다. 한도를 넘었을 때의 응답, 범위별 한도 표, 공통 등급 상수, 전역 한도의 집계 키 결정 규칙, 한도를 건너뛰는 경우가 대상이다. 절 번호(§)와 「규칙 n」 은 부모 문서의 번호를 그대로 쓴다. 요청 빈도 제한 수치의 단일 기준은 이 문서의 §7 표다(규칙 12).

## 7. 요청 빈도 제한

> **초과 응답이 `429` 가 아닌 행이 있다.**
>
> - 서명 참조(`config.chatChannel.inboundSigningRef`)가 있는 채팅 채널 트리거로 온 웹훅 요청은 전역 요청 빈도 제한(일반 API · 웹훅 수신 행)을 받지 않는다. 남용은 서명 검증과 채팅방 단위 분당 한도(채팅 채널 인바운드 행)가 막는다. 서명 참조가 없는 채팅 채널 트리거(옛 트리거, 채널 연결 전 트리거)는 전처럼 전역 한도를 받는다. 그런 트리거는 서명을 검증하지 않아 서명 검증 실패 한도도 걸리지 않으므로 전역 한도까지 빼면 IP 단위 한도가 하나도 남지 않는다. 채팅 채널 트리거는 서명 참조와 무관하게 `auth_config_id IS NULL` 이어도 공개 웹훅 추가 한도를 받지 않는다. 채팅방 단위 한도를 넘은 메시지는 `429` 가 아니라 `202 Accepted` 와 `{ executionId: 'ignored' }` 로 받고 처리를 건너뛴다. Telegram 이 2xx 가 아닌 응답을 재시도나 웹훅 해제로 다루기 때문이다. 한 트리거에 같은 IP 에서 서명 검증 실패가 거듭되면 한동안 시크릿 조회와 서명 계산 없이 `401` 로 거절한다. 이 서명 검증 실패 한도도 `429` 를 쓰지 않는다. 규칙은 [채팅 채널 인바운드 관문 「서명 검증 실패 한도」](../CLE-CHAT/CLE-CHAT-CORE-GATE.md#서명-검증-실패-한도) 가 정한다. 전역 한도에서 뺀 근거는 [채팅 채널 「R-CC-12」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-12-인바운드-응답은-202-로-고정하고-401404-만-예외로-둔다) 다. 채팅방 단위 한도의 근거는 [채팅 채널 「R-CC-19」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-19-분당-한도-초과분은-재발송-큐-대신-건너뛰고-degraded-로-표시한다) 다. 경우별 응답은 [채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약) 이 정한다. 웹훅 수신의 전역 한도를 어느 가드가 어떤 순서로 세는지는 표 아래 키 결정 규칙에 있다. 이 예외를 적어 두지 않으면 다음 사람이 "`429` 로 통일" 을 정합성 개선으로 착각한다.
> - WebSocket 명령은 HTTP 요청이 아니라서 상태 코드가 없다. 한도를 넘으면 소켓 `exception` 이벤트(`RATE_LIMITED`)로 알린다([WebSocket 연결과 채널 구독 「에러 코드」](CLE-API-WS.md#71-에러-코드)).

| 범위 | 제한 | 헤더 |
|------|------|------|
| 일반 API | 100 req/min (사용자 기준. 로그인 없는 요청은 IP 기준) | 통과한 응답: `X-RateLimit-Limit` · `X-RateLimit-Remaining` · `X-RateLimit-Reset`. 거부 응답(`429`): `Retry-After` |
| 인증 API (`POST /api/auth/register`, `POST /api/auth/login`) | 10 req/min (IP 기준). 라우트별 `@Throttle` 이다 | 같음 |
| 계정 확인·복구 (`POST /api/auth/forgot-password`, `POST /api/auth/resend-verification`, `POST /api/auth/check-email`) | 5 req/min (IP 기준). 라우트별 `@Throttle` 이다. 동작 정의는 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) | 같음 |
| 초대 토큰 메타 조회 (`GET /api/invitations/:token`) | 30 req/min (공개 라우트라 IP 기준). 토큰 추측을 막는다. 동작 정의는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) | 같음 |
| 로그인 세션 강제 종료 (`POST /api/auth/sessions/:familyId/revoke`, `POST /api/auth/sessions/revoke-others`) | 10 req/min, 5 req/min (순서대로, 사용자 기준). 라우트별 `@Throttle` 이다. 동작 정의는 [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) | 같음 |
| 2단계 인증 설정 시작 (`POST /api/auth/2fa/setup`) | 10 req/min (사용자 기준). 비밀번호 재확인 라우트다(`@RequirePasswordRecheck()`, 표 아래). 동작 정의는 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) | 같음 |
| 2단계 인증 활성화 검증 (`POST /api/auth/2fa/verify`) | 10 req/min (사용자 기준). 인증 코드 추측을 막는 `@Throttle` 이다. 공통 등급 상수 `SENSITIVE_ACTION_THROTTLE` 을 쓴다(표 아래). 동작 정의는 [가입과 로그인 「TOTP 켜기」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#totp-켜기) | 같음 |
| 2단계 인증 끄기 (`POST /api/auth/2fa/disable`) | 10 req/min (사용자 기준). 비밀번호 재확인 라우트다(`@RequirePasswordRecheck()`, 표 아래). 동작 정의는 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) | 같음 |
| Passkey 등록 옵션 (`POST /api/auth/2fa/webauthn/register/options`) | 10 req/min (사용자 기준). 비밀번호 재확인 라우트다(`@RequirePasswordRecheck()`, 표 아래). 등록 검증(`POST /api/auth/2fa/webauthn/register/verify`)에는 라우트별 `@Throttle` 이 없다. 동작 정의는 [가입과 로그인 「Passkey 등록·인증 흐름」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-등록인증-흐름) | 같음 |
| Passkey 복구 코드 재발급 (`POST /api/auth/2fa/webauthn/recovery-codes/regenerate`) | 10 req/min (사용자 기준). 비밀번호 재확인 라우트다(`@RequirePasswordRecheck()`, 표 아래). 동작 정의는 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) | 같음 |
| Passkey 삭제 (`POST /api/auth/2fa/webauthn/credentials/:id/delete`) | 10 req/min (사용자 기준). 비밀번호 재확인 라우트다(`@RequirePasswordRecheck()`, 표 아래). 동작 정의는 [Passkey 삭제](../CLE-ACCT/CLE-ACCT-SIGNIN-PASSKEY.md#passkey-삭제) | 같음 |
| 비밀번호 재확인 실패 (재확인 라우트에서 틀린 계정 비밀번호) | 사용자당 60초 고정 창에 10회. 모든 재확인 라우트의 실패를 합쳐 센다. 넘으면 창이 끝날 때까지 비밀번호를 대조하지 않고 `429 RATE_LIMITED`. Redis 를 쓸 수 없으면 fail-open. 상세는 표 아래 「비밀번호 재확인 실패 한도」 | 없음 |
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
| 채팅 채널 서명 검증 실패 (채팅 채널 트리거의 인바운드 웹훅) | (트리거 id, 클라이언트 IP) 쌍마다 60초 고정 창에 서명 검증 실패 20회. 실패가 20회에 이르면 그 창이 끝날 때까지 시크릿 조회와 서명 계산 없이 `401 AUTH_FAILED` 로 거절한다. `429` 는 쓰지 않는다. `ChatChannelSignatureFailureLimiterService`(Redis `cc:sigfail:` 키)이고 Redis 를 쓸 수 없거나 오류가 나면 막지 않는다(fail-open). 동작은 [채팅 채널 인바운드 관문 「서명 검증 실패 한도」](../CLE-CHAT/CLE-CHAT-CORE-GATE.md#서명-검증-실패-한도) 가 정한다. 클라이언트 IP 출처도 같은 절이 정한다(`CF-Connecting-IP`(신뢰 설정 `TRUST_CF_CONNECTING_IP` 가 켜진 배포만) → `req.ip`. `X-Forwarded-For` 첫 값은 쓰지 않는다) | 없음 (`401`, 위 콜아웃) |
| WebSocket 명령 (`/ws` namespace 의 `@SubscribeMessage`) | **소켓당** 60 msg/min (in-memory fixed-window, HTTP 아님). 전역 요청 빈도 제한(일반 API 100 req/min)은 이 경로를 세지 않는다. 한도를 넘으면 `WsRateLimitGuard` 가 `WsException(RATE_LIMITED)` 을 던지고 클라이언트는 `exception` 이벤트로 받는다(HTTP status 없음). `ping` 을 포함한 모든 `@SubscribeMessage` 핸들러에 적용한다. 등록되지 않은 이벤트(`onAny`)도 같은 소켓 예산을 쓴다. 넘었을 때의 응답은 [WebSocket 연결과 채널 구독 「에러 코드」](CLE-API-WS.md#71-에러-코드) 가 정한다 | 없음 (전송: 소켓 `exception` 이벤트) |

- HTTP 요청이 한도를 넘으면 `429` 를 받는다. 에러 코드는 행에 다른 코드를 적지 않았으면 기본 코드 `RATE_LIMITED` 다([에러 응답과 클라이언트 처리](CLE-API-ERROR.md)). 전역 기본값과 라우트별 `@Throttle` 로 거는 행, External Interaction 인바운드 행은 `Retry-After` 헤더를 함께 싣는다. 공개 웹훅 추가 한도, 비밀번호 재확인 실패, External Interaction SSE 동시 연결, 쇼핑몰 앱 설치 진입점의 실패 잠금은 `Retry-After` 없이 `429` 만 돌려준다. 초과 응답이 `429` 가 아닌 행(채팅 채널 인바운드, 채팅 채널 서명 검증 실패, WebSocket 명령)은 위 콜아웃에 있다.
- **표의 범위**: 위 표는 전역 기본값(일반 API, 웹훅 수신, 파일 업로드 행)과, 그 위에 라우트별 `@Throttle` 이나 도메인 전용 제한 서비스로 덮어쓴 엔드포인트별 한도를 한 곳에 모은 것이다. HTTP 라우트에 건 `@Throttle` 은 모두 이 표에 행이 있다. 개별 엔드포인트의 권한·부수 효과는 각 도메인 문서가 정하고 요청 빈도 제한 수치의 단일 기준은 이 표다. 라우트에 `@Throttle` 을 새로 걸거나 수치를 바꾸면 이 표도 함께 고친다.
- **공통 등급 상수 `SENSITIVE_ACTION_THROTTLE`**(분당 10회, `throttle.ts`)는 2단계 인증 설정 시작 · 활성화 검증 · 끄기, Passkey 등록 옵션 · 복구 코드 재발급 · 삭제, provider probe, 초대 발송·재발송 행이 함께 쓴다. 상수가 같아도 라우트마다 따로 센다.
- **비밀번호 재확인 라우트**: `verifyPasswordForUser` 로 계정 비밀번호를 다시 확인하는 라우트는 `@RequirePasswordRecheck()` 를 선언한다. 이 데코레이터로 `SENSITIVE_ACTION_THROTTLE` 과 재확인 표시 메타데이터가 함께 걸린다. 본문 DTO 는 `PasswordRecheckDto`(8자 이상 128자 이하)를 상속한다. 단위 테스트는 auth 모듈의 컨트롤러를 모두 읽어 재확인 표시가 있는 핸들러와 `PasswordRecheckDto` 하위 본문을 받는 핸들러가 같은지, 표시한 핸들러마다 이 상수가 걸렸는지 본다. 활성화 검증은 비밀번호를 받지 않아 재확인 라우트가 아니다.
- **비밀번호 재확인 실패 한도**: `verifyPasswordForUser` 는 틀린 비밀번호를 사용자 단위로 센다(`PasswordRecheckFailureLimiterService`). 순서는 사용자 · 비밀번호 해시 확인(없으면 `401 PASSWORD_REQUIRED`) → 한도 확인 → 대조 → 틀리면 실패를 세고 `401 PASSWORD_INVALID` 다. 한도에 닿은 사용자는 대조 없이 `429 RATE_LIMITED`(「비밀번호를 너무 많이 틀렸습니다. 잠시 후 다시 시도해 주세요.」)를 받는다. 맞힌 시도와 비밀번호가 없는 계정은 세지 않고, 맞혀도 카운터를 지우지 않는다. 한도에 닿는 순간 경고 로그를 한 번 남긴다. Redis 가 없거나 오류가 나면 세지도 막지도 않는다(fail-open). 이 문서가 정하는 Redis 키는 아래와 같다.
  - `auth:password-recheck-failures:<userId>`: 사용자의 재확인 실패 수. TTL 60초 고정 창이고 첫 실패에 걸고 늘리지 않는다. INCR 과 TTL 보정을 Lua 스크립트 하나로 실행해 TTL 없는 키를 남기지 않는다.
- 인증된 HTTP 요청은 전역 `UserThrottlerGuard` 가 `user:<sub>` 키로 사용자별로 센다. 인증되지 않은 요청만 IP 로 센다. 그래서 인증된 라우트의 제한은 사용자 기준이다.
- **전역 요청 빈도 제한은 HTTP 요청만 센다.** 전역 `UserThrottlerGuard` 는 `shouldSkip` 에서 HTTP 요청이 아닌 호출(NestJS `ExecutionContext.getType()` 이 `'http'` 가 아닌 호출. 판정은 `isHttpContext`)을 건너뛴다. NestJS 12 부터 전역 `APP_GUARD` 가 WebSocket 게이트웨이 핸들러에도 붙으므로 그 핸들러 호출이 여기에 든다. WebSocket 명령의 요청 빈도 제한은 소켓당 `WsRateLimitGuard`(분당 60건)가 맡는다([WebSocket 연결과 채널 구독 「에러 코드」](CLE-API-WS.md#71-에러-코드)). 이 건너뛰기는 환경과 무관하고 아래 `NODE_ENV=test` 건너뛰기와 별개로 함께 적용된다. HTTP 요청이어도 `@DeferGlobalThrottle()` 이 붙은 라우트는 전역 가드가 건너뛴다. 그 라우트는 라우트 가드가 같은 한도로 센다(아래 키 결정 규칙). 서명 참조가 있는 채팅 채널 트리거로 온 웹훅 요청은 그 라우트 가드도 세지 않는다([위 콜아웃](#7-요청-빈도-제한)).
- **키 결정 규칙(현재 구현, HTTP 기준)**: 전역 가드는 `JwtAuthGuard` → `UserThrottlerGuard` → `RolesGuard` 순서로 돈다. 추적 키는 `req.user` 의 `sub`(없으면 `userId`)가 있으면 `user:<id>`, 없으면 `req.ip` 다. `@Public()` 라우트는 `JwtAuthGuard` 가 사용자를 채우지 않아 IP 로 센다. 로그인 전 인증 라우트, 웹훅 수신, 인터랙션 토큰으로 인증하는 EIA 경로가 여기 든다. EIA 의 `InteractionGuard` 는 라우트 가드라 전역 가드보다 뒤에 돈다. 웹훅 수신(`POST /api/hooks/:endpointPath`)은 전역 한도를 라우트 가드가 센다. 그 라우트에는 `@DeferGlobalThrottle()` 이 붙어 있어 전역 `UserThrottlerGuard` 가 건너뛴다. 라우트 가드는 `PublicWebhookThrottleGuard` → `HookTriggerThrottlerGuard` 순서로 돈다. `HookTriggerThrottlerGuard` 는 앞 가드가 조회한 트리거로 판정한다. 서명 참조가 있는 채팅 채널 트리거면 세지 않는다([위 콜아웃](#7-요청-빈도-제한)). 그 밖의 요청은 전역 가드와 같은 한도 · 같은 저장소 · 같은 키로 센다. 서명 참조가 없는 채팅 채널 트리거와 트리거가 없거나 조회에 실패한 요청도 센다.
- External Interaction 인바운드는 `@Throttle` 이 아니라 도메인 전용 `InteractionRateLimiterService`(실행 단위 Redis 카운터)로 덮어쓴 사례다.
- **환경으로 건너뛰는 경우는 `NODE_ENV=test` 하나다.** e2e 가 컨테이너 IP 하나에서 빠른 인증 호출을 연달아 보내 스스로 요청 빈도 제한(100/60s)에 걸리는 문제를 피하려고 test 환경에서는 `ThrottlerModule` 의 `skipIf` 가 전역 기본값과 라우트별 `@Throttle` 한도를 건너뛴다. production·development 동작은 바뀌지 않는다. 헬퍼는 `throttler-skip.ts` 의 `shouldSkipThrottle` 이다. 위의 HTTP 가 아닌 호출 건너뛰기와는 별개다. 비밀번호 재확인 실패 한도는 `ThrottlerModule` 밖이라 test 환경에서도 센다.

## 구현 위치

- `codebase/backend/src/common/guards/user-throttler.guard.ts` (전역 요청 빈도 제한 키 결정. HTTP 가 아닌 호출과 `@DeferGlobalThrottle()` 라우트를 건너뛴다)
- `codebase/backend/src/common/guards/user-throttler.guard.spec.ts`
- `codebase/backend/src/common/constants/throttle.ts` (§7 의 공통 등급 상수 `SENSITIVE_ACTION_THROTTLE`)
- `codebase/backend/src/modules/auth/decorators/require-password-recheck.decorator.ts` (`@RequirePasswordRecheck()`)
- `codebase/backend/src/modules/auth/dto/password-recheck.dto.ts` (`PasswordRecheckDto`)
- `codebase/backend/src/modules/auth/password-recheck-throttle.spec.ts` (재확인 라우트 열거 테스트)
- `codebase/backend/src/modules/auth/auth.service.ts` (`verifyPasswordForUser`)
- `codebase/backend/src/modules/auth/password-recheck-failure-limiter.service.ts` (비밀번호 재확인 실패 한도)
- `codebase/backend/src/modules/auth/password-recheck-failure-limiter.service.spec.ts`
- `codebase/backend/test/password-recheck-shared-limit.e2e-spec.ts` (두 재확인 라우트의 실패를 합쳐 세는지 본다)
- `codebase/backend/src/common/utils/throttler-skip.ts` (`NODE_ENV=test` skip)
- `codebase/backend/src/modules/websocket/ws-rate-limit.guard.ts` (WebSocket 명령 빈도 제한)
- `codebase/backend/src/modules/hooks/hook-trigger-throttler.guard.ts` (웹훅 수신의 전역 요청 빈도 제한. 서명 참조가 있는 채팅 채널 트리거는 세지 않는다)
- `codebase/backend/src/modules/hooks/hooks-throttle.wire.spec.ts` (웹훅 수신의 가드 순서)

## Rationale

### 로그인 세션 강제 종료 한도를 사용자 기준으로 적은 이유 (2026-10-10)

두 라우트는 로그인한 사용자만 부르므로 §7 키 결정 규칙대로 `user:<sub>` 키로 센다(`user-throttler.guard.ts`). [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 은 집계 키를 이 문서 §7 에 맡긴다.

### 전역 한도의 집계 키 미결을 닫았다 (2026-10-10)

[계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) 의 요청 빈도 제한 표도 인증한 요청은 사용자(`user:<sub>`), `@Public` 라우트는 IP 로 센다고 적어 §7 과 같다(Task CLE-T-ERAJ7P). [External Interaction API](../CLE-IX/CLE-EIA.md) 의 인바운드 경로는 `@Public()` 이라 IP 로 센다.

기각한 대안은 미결을 그대로 두는 안이다. 두 문서가 같은 규칙을 적는데 미결이 남으면 아직 정해지지 않은 것처럼 읽힌다.

### 이메일 변경 행의 소유 문서를 바로잡았다 (2026-10-10)

이메일 변경 규칙은 [내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md) 이 아니라 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) 의 「이메일 변경」 절이 정하므로 두 행의 동작 정의 링크를 그 절로 둔다. 두 라우트는 JWT 인증 라우트라 사용자 기준으로 센다.

### §7 에 2단계 인증 끄기 행을 더한 이유 (2026-10-10)

`POST /api/auth/2fa/disable` 은 비밀번호를 확인한 뒤 TOTP 코드나 TOTP 복구 코드를 한 번 더 확인한다. 인증 코드 추측을 막으려고 `SENSITIVE_ACTION_THROTTLE`(분당 10회)을 걸었다(Task CLE-T-75TDTN).

기각한 대안은 두 가지다.

- 전역 100 req/min 에 맡기는 안. 비밀번호를 아는 공격자가 6자리 코드를 분당 100회까지 시도할 수 있다.
- 이 라우트 전용 상수를 새로 두는 안. "전역보다 엄격한 민감 동작" 이라는 의도가 공통 등급 상수와 같다. 상수의 주석도 정책이 갈릴 때만 분리하라고 적는다.

### 전역 요청 빈도 제한이 HTTP 요청만 센다고 적었다 (2026-10-22)

NestJS 12(`@nestjs/websockets` 12.1.2)부터 전역 `APP_GUARD` 가 WebSocket 게이트웨이 핸들러에도 붙는다. 소켓에는 `user` · `ip` 가 없어서 전역 `UserThrottlerGuard` 가 모든 사용자의 WebSocket 명령을 한 버킷(`unknown`)으로 셌다. 그래서 이 가드는 HTTP 가 아닌 호출을 건너뛰고 WebSocket 명령은 소켓당 `WsRateLimitGuard` 만 센다(NERV Task `CLE-T-A3W8B8`).

기각한 대안: 전역 가드가 소켓에서 사용자 · IP 키를 만들어 WebSocket 명령도 세는 안. 소켓당 `WsRateLimitGuard` 와 같은 명령을 두 번 센다. WebSocket 명령이 같은 사용자의 HTTP 요청 한도(분당 100회)도 함께 써 버린다.

### §7 표에 빠진 라우트별 한도를 더했다 (2026-10-24)

규칙 12 와 「표의 범위」 대로 HTTP 라우트의 `@Throttle` 은 모두 §7 표에 둔다. 빠져 있던 행은 코드로 수치를 확인해 더했다(NERV Task `CLE-T-MJ9G4C`).

- 「표의 범위」 를 좁혀 일부 라우트만 표에 두는 안은 고르지 않았다. 빠진 라우트의 수치가 단일 기준 없이 도메인 문서와 코드에만 남고 어느 라우트가 표에 있어야 하는지 알 수 없게 된다.
- 라우트별 `@Throttle` 행은 모두 기본 코드 `RATE_LIMITED` 라서 행마다 적지 않고 표 아래 첫 불릿에 한 번 적었다.
- `/api/3rd-party/*` 경로와 컬렉션 수준 액션 경로가 §2.2 명명 규칙의 예외 행에 없는 문제는 이 개정의 범위 밖이다.
- 규칙 12, §7 머리 콜아웃, 표 아래 불릿, [§9](CLE-API-CONV-RESP.md#9-파일-업로드) 에는 엔드포인트나 행의 개수를 쓰지 않는다. 늘면 숫자가 낡는다. [§5.5 「검증 층」](CLE-API-CONV-RESP.md#검증-층-이-규칙을-무엇이-강제하는가) 의 «개수를 세지 않는다» 와 같은 이유다.

### §7 에 2단계 인증 설정 시작 행을 더했다 (2026-11-01)

`POST /api/auth/2fa/setup` 은 계정 비밀번호를 확인한 뒤 TOTP secret 을 발급한다([2단계 인증 설정과 TOTP 「TOTP 켜기는 비밀번호를 다시 확인하고 켜진 계정을 거부한다」](../CLE-ACCT/CLE-ACCT-SIGNIN-TOTP.md#totp-켜기는-비밀번호를-다시-확인하고-켜진-계정을-거부한다), NERV Task `CLE-T-94FTMV`).

- 계정 비밀번호 추측을 막으려고 `SENSITIVE_ACTION_THROTTLE` 로 분당 10회를 걸었다. 전용 상수를 두지 않은 이유는 「§7 에 2단계 인증 끄기 행을 더한 이유」 의 두 번째 기각 대안과 같다.
- 끄기 행에 합치지 않고 행을 따로 두었다. 설정 시작은 계정 비밀번호 추측을, 끄기는 인증 코드 추측을 막는다.

### §7 에 활성화 검증 · Passkey 등록 옵션 · 복구 코드 재발급 행을 더했다 (2026-11-02)

NERV Task `CLE-T-FRCRF7` 의 사람 결정이다. 정본은 [Passkey 기능과 등록 「Passkey 등록에도 비밀번호 재확인을 두고 TOTP 대기 secret 은 10분 뒤 버린다」](../CLE-ACCT/CLE-ACCT-SIGNIN-PASSKEY.md#passkey-등록에도-비밀번호-재확인을-두고-totp-대기-secret-은-10분-뒤-버린다) 다.

- Passkey 등록 옵션과 복구 코드 재발급에는 계정 비밀번호 추측을, 활성화 검증에는 인증 코드 추측을 막는 한도를 걸었다. 셋 다 `SENSITIVE_ACTION_THROTTLE` 이고 사용자 기준이다. 활성화 검증은 설정 시작과 막는 대상이 달라 행을 따로 둔다.
- 등록 검증(`POST /api/auth/2fa/webauthn/register/verify`)에는 한도를 걸지 않았다. 비밀번호를 받지 않고, 발급받은 사용자에 묶여 5분 동안 유효한 `optionsToken` 이 앞선 비밀번호 확인을 대신한다.
- 같은 상수를 쓰는 행마다 다른 행을 나열하던 문장을 지우고 표 아래 불릿 한 곳에 모았다. 행마다 나열하면 행을 더할 때마다 여러 행을 함께 고쳐야 하고 한 행만 빠져도 서로 어긋난다.
- 이때는 `verifyPasswordForUser` 를 부르는 라우트 목록을 단위 테스트에 고정했다. 목록에 없는 새 라우트는 검사에서 빠져서 뒤에 메타데이터 열거로 바꿨다([비밀번호 재확인 실패를 사용자 단위로 센다](#비밀번호-재확인-실패를-사용자-단위로-센다)).
- 비밀번호 변경(`POST /api/users/me/change-password`), 설정 비밀 평문 노출(`POST /api/auth-configs/:id/reveal`), 계정 재인증 라우트는 범위 밖이다. 세 곳도 계정 비밀번호를 확인하지만 `verifyPasswordForUser` 를 부르지 않는다.
- **기각: e2e 로 고정한다.** test 환경에서는 `ThrottlerModule` 의 `skipIf` 가 라우트별 `@Throttle` 한도를 건너뛰어 e2e 로는 한도가 걸렸는지 볼 수 없다.

### 「일반 API」 행의 집계 키와 헤더 칸을 고쳤다 (2026-11-12)

`@nestjs/throttler` 는 통과한 응답에 `X-RateLimit-*` 를 싣고 `429` 로 거부할 때는 `Retry-After` 만 싣는다. 그래서 헤더 칸을 둘로 나눴다. 로그인 없는 요청은 IP 로 센다는 사실도 행에 적었다(NERV Task `CLE-T-GNTWP9`).

### 연결 테스트 행에 `:id/test` 를 더했다 (2026-11-14)

근거는 [통합 관리 Rationale](../CLE-INT/CLE-INT-MANAGE-RUN.md#연결-테스트의-탐색-위험을-받아들인다-2026-11-14) 이다(NERV Task `CLE-T-SG4GRQ`).

### 웹훅 수신 한도와 채팅 채널 트리거 면제의 근거

채팅 채널 트리거의 한도 면제와 웹훅 수신 라우트의 가드 순서는 [HTTP API 규약 — WebSocket 과 웹훅 수신](CLE-API-CONV-HOOK.md#rationale) 의 Rationale 에 있다. §7 머리 콜아웃과 웹훅 수신 행을 고칠 때는 아래 세 절을 함께 본다.

- [공개 웹훅 추가 한도에서 채팅 채널 트리거를 뺐다 (2026-11-12)](CLE-API-CONV-HOOK.md#공개-웹훅-추가-한도에서-채팅-채널-트리거를-뺐다-2026-11-12)
- [채팅 채널 인바운드를 전역 요청 빈도 제한에서 뺐다 (2026-11-12)](CLE-API-CONV-HOOK.md#채팅-채널-인바운드를-전역-요청-빈도-제한에서-뺐다-2026-11-12) (가드 순서와 그 대가)
- [채팅 채널의 전역 한도 예외를 §7 머리 콜아웃 한 곳에 모았다 (2026-11-13)](CLE-API-CONV-HOOK.md#채팅-채널의-전역-한도-예외를-7-머리-콜아웃-한-곳에-모았다-2026-11-13)

### 서명 검증 실패 한도 링크와 IP 출처를 고쳤다 (2026-11-14)

서명 검증 실패 한도와 클라이언트 IP 출처의 정본은 [채팅 채널 — 인바운드 관문](../CLE-CHAT/CLE-CHAT-CORE-GATE.md#서명-검증-실패-한도) 이다(NERV Task `CLE-T-HMFRBD`).

### 비밀번호 재확인 실패를 사용자 단위로 센다

결정일: 2026-11-15

탈취한 액세스 토큰만 가진 사람도 재확인 라우트의 `PASSWORD_INVALID` 응답을 보고 계정 비밀번호를 추측할 수 있다(NERV Task `CLE-T-CJ7HB1`).

- 라우트별 `@Throttle` 은 라우트마다 따로 센다. 재확인 라우트가 다섯이면 한 사용자의 추측 예산이 분당 50회가 되고 라우트를 더할 때마다 늘어난다. 실패를 사용자 하나에 묶어 세서 이 예산을 분당 10회로 고정했다.
- 한도 값은 민감 tier 와 같은 10회다. 라우트 하나에서 허용하던 추측 횟수를 모든 재확인 라우트를 합친 상한으로 삼았다.
- 맞힌 시도는 세지 않는다. 비밀번호를 아는 사용자는 2단계 인증과 Passkey 설정을 여러 번 바꿔도 이 한도에 걸리지 않는다.
- Redis 장애에는 fail-open 이다. 장애 중에도 라우트별 한도(분당 10회)는 남는다. 비밀번호 재확인을 Redis 가용성에 묶으면 Redis 장애 때 2단계 인증과 Passkey 관리까지 쓸 수 없게 된다.
- 라우트 목록 고정 테스트를 메타데이터 열거로 바꿨다(§7 「비밀번호 재확인 라우트」). 새 재확인 라우트에서 선언을 빠뜨리면 본문 DTO 쪽에서 드러난다.

기각한 대안은 세 가지다.

- 다섯 라우트를 한 `@Throttle` 버킷으로 묶는 안. `ThrottlerGuard` 는 성공한 요청도 세므로 비밀번호를 맞힌 정상 사용도 한도에 걸린다.
- 계정을 잠그는 안. 탈취한 토큰을 가진 사람이 일부러 틀려 원래 사용자의 로그인까지 막을 수 있다.
- 맞히면 카운터를 지우는 안. 틀린 시도 사이에 성공을 끼워 넣을 수 있는 공격자는 이미 비밀번호를 안다. 지워서 얻는 것이 없어 단순한 고정 창을 택했다.
