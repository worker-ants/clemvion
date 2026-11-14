---
id: "CLE-ACCT-SESSION-POLICY"
title: "세션과 토큰 — 세션 정책과 세션 관리"
type: "design"
version: 3
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ACCT-SESSION"
ancestors: ["CLE-VISION", "CLE-ACCT", "CLE-ACCT-SESSION"]
area: "CLE-ACCT"
content_hash: "4d7752d9e4b9b4d0e112c110138277945e01bc4cfa3dd1e0bcd03dba79f35483"
read_as: "approved_fallback"
task: "CLE-T-E90KGZ"
source_paths: []
mirror_sha256: "185f6d6ce501efc117776a9d59f17aef83936cd97e5b89d2b7d829539a27b218"
etag: "sha256-ec2348b8e60260f980a178ade1fab6e4f99143c7c232d00d2ad3a5e0b75813a3"
---
> 구현 상태: 부분 구현 (동시 세션 한도와 초과 시 가장 오래된 세션 종료는 미구현) · 상위: [세션과 토큰](CLE-ACCT-SESSION.md)

## 개요

이 문서는 [세션과 토큰](CLE-ACCT-SESSION.md) 의 하위 문서로 로그인 세션 정책, 리프레시 쿠키 속성, 클라이언트 IP 를 읽는 순서, 본인 확인 에러 코드, 세션 관리 화면과 세션 API 를 정한다. 토큰 수명과 갱신은 [세션과 토큰 — 토큰과 갱신](CLE-ACCT-SESSION-TOKEN.md) 이 정한다.

## 세션 정책

| 항목 | 규칙 |
| --- | --- |
| 로그인 세션 단위 | `family_id`. 토큰 회전으로 행이 새로 생겨도 같은 `family_id` 는 하나의 로그인 세션이다 |
| 동시 로그인 세션 | 기본 5개(관리자 설정 가능). 미구현이다. 한도 값과 설정 주체는 [미결 사항](CLE-ACCT-SESSION.md#미결-사항) |
| 초과 시 | 가장 오래된 로그인 세션을 자동 종료한다. 미구현이다 |
| 세션 강제 종료 | 사용자가 활성 세션 목록에서 로그인 세션을 하나씩 끝낼 수 있다. 그 `family_id` 전체를 무효화한다 |
| 강제 종료 재인증 | `SessionsService.verifyReauth` 로 본인을 확인한다. 비밀번호가 있는 계정은 비밀번호, 비밀번호가 없고 TOTP 가 켜진 계정은 등록된 TOTP 코드로 확인한다. 둘 다 있으면 비밀번호, TOTP 순으로 하나만 통과하면 된다. 복구 코드는 받지 않는다. 지금은 요청 DTO 의 `totpCode` 길이 제한(6~8자)이 복구 코드를 막는다. 비밀번호도 TOTP 도 없는 OAuth 전용 계정은 `REAUTH_NOT_AVAILABLE` 로 막는다. Passkey 만 등록한 계정도 여기에 든다. Passkey 와 이메일 OTP 로 하는 계정 재인증은 현재 지원하지 않는다. 이메일 변경과 일괄 종료도 같은 `verifyReauth` 를 쓴다 |
| 비밀번호 변경 시 | `POST /api/users/me/change-password` 가 성공하면 사용자의 모든 활성 로그인 세션을 무효화하고 변경한 현재 기기에 새 로그인 세션(새 액세스 토큰과 리프레시 쿠키)을 바로 발급한다. 로그인 이력에 `session_revoked`(일괄, `familyId=null`) 1건을 남긴다. 새 로그인 세션은 표준 7일(`rememberMe=false`)이다. 이 요청은 `/api/users/me/*` 경로라 리프레시 쿠키가 붙지 않는다. 그래서 현재 로그인 세션을 식별할 수 없어 직전 로그인 세션의 로그인 유지 여부를 이어받지 않는다 |
| 이메일 변경 시 | `POST /api/users/me/email-change/verify` 가 성공하면 비밀번호 변경과 같게 모든 로그인 세션을 무효화하고 현재 기기에 다시 발급한다. 이 요청도 `/api/users/me/*` 경로라 현재 로그인 세션을 식별할 수 없다. 로그인 이력 `session_revoked`(일괄, `familyId=null`) 1건. 기존 enum 값을 다시 쓰므로 DB CHECK·마이그레이션이 필요 없다 |
| 현재 로그인 세션 식별 | 서버가 요청의 리프레시 쿠키 해시를 조회해 `isCurrent` 로 응답한다. 원래 토큰은 JS 에 노출하지 않는다. 브라우저가 쿠키를 보내도록 세션 API 는 쿠키 Path 아래 `/api/auth/sessions` 에 둔다. 쿠키가 없거나 맞는 로그인 세션이 없으면 모든 로그인 세션의 `isCurrent` 가 false 이고 일괄 종료는 400 `CURRENT_SESSION_REQUIRED` 로 거부한다 |
| 메타데이터 | 발급 시점의 IP·User-Agent·기기 라벨과 마지막 사용 시각·IP 를 리프레시 토큰 행에 기록한다 |
| 클라이언트 IP | `CF-Connecting-IP` 는 `TRUST_CF_CONNECTING_IP` 가 `true` 나 `1` 일 때만 1순위로 쓴다(기본 off, 위조 가능한 헤더). off 면 `X-Forwarded-For` 첫 IP, `req.ip`(trust proxy), `req.socket.remoteAddress` 순이다. 이 네 단계 순서는 로그인 세션·감사 IP 경로(`extractClientIp(req)`)에만 쓴다. 공개 웹훅 요청 한도·`ip_whitelist`·실행 기록 소스 IP(`Execution.source_ip`) 경로는 헤더 기반(CF 허용 시 `CF-Connecting-IP`, 그다음 `X-Forwarded-For` 첫 IP)만 쓰고 `req.ip`·socket 폴백이 없다(`extractClientIpFromHeaders`). 헤더로 IP 를 알 수 없으면 공개 웹훅 요청 한도는 거부하지 않고 단일 공유 버킷의 완화 한도를 쓴다. `ip_whitelist` 는 반대로 거부한다. 실행 기록 소스 IP 는 비워 저장한다(NULL 허용 컬럼, [실행 데이터와 흐름 — 데이터 모델](../CLE-EXEC/CLE-EXEC-DATA-MODEL.md#실행)). Cloudflare(Tunnel 포함) 뒤에 배포할 때만 켠다. 채팅 채널 서명 검증 실패 한도는 보내는 쪽이 정할 수 없는 출처만 쓴다. CF 허용 시 `CF-Connecting-IP`, 그다음 `req.ip` 순이고 `X-Forwarded-For` 첫 IP 와 socket 폴백은 쓰지 않는다(`extractUnspoofableClientIp`). 이 경로에서 IP 를 알 수 없으면 그 한도를 보지도 세지도 않는다. 규칙과 근거는 [채팅 채널 「R-CC-34」](../CLE-CHAT/CLE-CHAT-CORE-GATE.md#r-cc-34-서명-검증-실패는-트리거와-ip-쌍으로-세고-한도에-닿으면-401-로-답한다) 에 있다 |
| 리프레시 쿠키 Domain | `FRONTEND_URL`·`APP_URL` hostname 에서 자동으로 정한다(`common/config/app.config.ts` 의 `computeCookieDomain`). 같은 host·localhost·IP 면 Domain 을 지정하지 않는다(백엔드 origin 한정). 공통 상위 도메인이 있으면(예: `api.x.com`·`app.x.com`) `.x.com` 이다. 공통 도메인이 없으면 지정하지 않고 cross-origin 은 `withCredentials` 에 맡긴다. 별도 환경 변수는 없다 |
| 리프레시 쿠키 SameSite | `COOKIE_SAMESITE` 환경 변수. 기본 `none` 이다. 프론트와 API 의 사이트 경계(eTLD+1)가 다른 cross-site 배포를 지원하기 위해서다. `lax`·`strict` 면 그 배포에서 쿠키가 붙지 않아 로그인 세션이 끊긴다. 같은 사이트 배포는 `lax` 나 `strict` 로 조인다. 알 수 없는 값은 `none` 으로 처리한다 |
| 리프레시 쿠키 Path | `/api/auth` 로 한정한다(`refresh-cookie.ts` 의 `REFRESH_COOKIE_PATH`). refresh·login·logout 같은 auth 엔드포인트와 세션 API(`/api/auth/sessions…`)에만 쿠키가 붙어 노출 표면이 줄어든다. 현재 로그인 세션을 쿠키로 가려야 하는 라우트는 Path 를 넓히지 않고 이 Path 아래에 둔다. 설정과 삭제는 같은 Path 를 써야 한다 |
| 갱신 CSRF | `SameSite=none` 에서 cross-site 강제 갱신을 막기 위해 갱신 요청의 `Origin` 을 CORS 허용 목록(`isOriginAllowed`)과 비교한다. 목록 밖이거나 불투명(`'null'`)한 Origin 은 403 이다. Origin 이 없으면(같은 origin·브라우저 아닌 도구) 통과한다. 다른 엔드포인트는 Bearer 액세스 토큰 기반이라 쿠키 CSRF 와 무관하다. 예외는 로그아웃이다. 로그아웃은 Bearer 없이 쿠키만으로 동작하지만 새 토큰을 발급하지 않아 Origin 검증을 두지 않는다. 세션 API 는 쿠키를 읽지만 Bearer 액세스 토큰이 있어야 동작하고 쿠키는 현재 로그인 세션을 가리는 데만 쓴다. 그래서 Origin 검증을 두지 않는다 |

2026-11-01 부터 TOTP 설정 시작이 비밀번호를 다시 확인하므로 비밀번호 없이 TOTP 가 켜진 상태는 그 전에 켠 계정에만 남는다([가입과 로그인 「TOTP 켜기」](CLE-ACCT-SIGNIN.md#totp-켜기)). 2026-11-02 부터는 Passkey 등록 옵션에도 비밀번호 재확인이 있어 비밀번호 없이 Passkey 를 등록한 상태도 그 전에 등록한 계정에만 남는다([가입과 로그인 「Passkey 등록·인증 흐름」](CLE-ACCT-SIGNIN.md#passkey-등록인증-흐름)). 지금 비밀번호가 없는 계정이 계정 재인증 수단을 늘리려면 비밀번호 재설정으로 비밀번호를 먼저 만든다.

## 본인 확인 에러 코드

본인 확인은 세 헬퍼로 나뉜다. 에러 코드와 상태가 서로 다르다.

| 헬퍼 | 쓰는 곳 | 에러 코드 |
| --- | --- | --- |
| 계정 재인증 `SessionsService.verifyReauth` | 세션 강제 종료, 일괄 종료, 이메일 변경 | 요청에 비밀번호·TOTP 어느 쪽도 없거나 충족 안 됨(비밀번호가 없는 계정에 비밀번호만 보낸 경우 포함) `REAUTH_REQUIRED`(400), 비밀번호 불일치 `PASSWORD_INVALID`(401), TOTP 불일치 `TOTP_INVALID`(401), 계정 재인증 수단 없음(계정에 비밀번호도 TOTP 도 없음. Passkey 만 등록한 계정 포함) `REAUTH_NOT_AVAILABLE`(403) |
| 비밀번호 재확인 `AuthService.verifyPasswordForUser` | 2단계 인증 설정 시작(`/api/auth/2fa/setup`), 2단계 인증 끄기(`/api/auth/2fa/disable`), Passkey 등록 옵션(`/api/auth/2fa/webauthn/register/options`), Passkey 복구 코드 재발급, Passkey 삭제(`/api/auth/2fa/webauthn/credentials/:id/delete`) | 비밀번호 미설정(OAuth 전용)·미입력 `PASSWORD_REQUIRED`(401), 불일치 `PASSWORD_INVALID`(401). 위 라우트에서는 본문 검증이 미입력을 먼저 400 `VALIDATION_ERROR` 로 거른다. 그래서 라우트가 내는 `PASSWORD_REQUIRED` 는 계정에 비밀번호가 없다는 뜻이다. 2단계 인증 설정 시작은 비밀번호 확인 뒤 TOTP 가 이미 켜져 있으면 409 `TOTP_ALREADY_ENABLED`. 2단계 인증 끄기는 비밀번호 확인 뒤 인증 코드를 확인하고 틀리면 401 `TOTP_INVALID`. Passkey 등록 옵션은 비밀번호 확인이 실패하면 등록 옵션과 `optionsToken` 을 만들지 않고 Passkey 삭제는 credential 을 지우지 않는다 |
| 비밀번호 변경 `UsersService.changePassword` | `POST /api/users/me/change-password` 의 현재 비밀번호 확인 | 비밀번호 미설정(`passwordHash` 없음) `PASSWORD_REQUIRED`(401), 불일치 `PASSWORD_INVALID`(401), 사용자 없음 `USER_NOT_FOUND`(404) |

- `PASSWORD_INVALID` 는 세 헬퍼가 같은 코드를 쓴다. `TOTP_INVALID` 는 로그인 2단계 TOTP 검증, TOTP 활성화 검증, 2단계 인증 끄기에서도 같은 코드다.
- 비밀번호 재확인 헬퍼를 부르는 다섯 라우트는 모두 그 라우트의 다른 검사보다 비밀번호를 먼저 확인한다. 예외는 Passkey 기능이 꺼졌을 때의 503 `WEBAUTHN_DISABLED` 하나다(아래 Passkey 등록 옵션 항목). 비밀번호가 없는 계정은 401 `PASSWORD_REQUIRED`, 틀리면 401 `PASSWORD_INVALID` 이고 그 뒤 단계는 하지 않는다. 그래서 OAuth 전용 계정은 비밀번호 재설정으로 비밀번호를 만들기 전에는 TOTP 를 켜거나 Passkey 를 등록 · 삭제할 수 없다.
  - 2단계 인증 끄기(`POST /api/auth/2fa/disable`): 비밀번호가 맞으면 인증 코드를 확인한다(`TotpService.verifyForDisable`). 인증 코드는 로그인 2단계와 같이 인증 앱의 6자리 코드나 TOTP 복구 코드이고, 복구 코드로 통과하면 그 코드를 소비한다. 코드가 맞지 않거나 TOTP 가 켜져 있지 않으면 401 `TOTP_INVALID` 다. 규칙은 [가입과 로그인](CLE-ACCT-SIGNIN.md#totp-끄기) 이 정한다.
  - 2단계 인증 설정 시작(`POST /api/auth/2fa/setup { password }`): 비밀번호 확인이 실패하면 TOTP secret 을 만들지 않는다. 비밀번호 확인은 TOTP 가 켜져 있는지 보기 전에 한다. 비밀번호가 맞고 TOTP 가 이미 켜져 있으면 409 `TOTP_ALREADY_ENABLED` 이고 secret 을 바꾸지 않는다. 규칙은 [가입과 로그인 「TOTP 켜기」](CLE-ACCT-SIGNIN.md#totp-켜기) 이 정한다.
  - Passkey 등록 옵션(`POST /api/auth/2fa/webauthn/register/options { password }`): 비밀번호 확인이 실패하면 등록 옵션과 `optionsToken` 을 만들지 않는다. Passkey 기능이 꺼져 있으면 비밀번호를 확인하기 전에 503 `WEBAUTHN_DISABLED` 로 거부한다. 복구 코드 재발급과 Passkey 삭제(`POST /api/auth/2fa/webauthn/credentials/:id/delete { password }`)도 같다. Passkey 삭제는 비밀번호를 확인한 뒤에 대상 credential 을 찾는다. 규칙과 이유는 [가입과 로그인 「Passkey 등록·인증 흐름」](CLE-ACCT-SIGNIN.md#passkey-등록인증-흐름) 과 [같은 문서의 Rationale](CLE-ACCT-SIGNIN.md#passkey-등록에도-비밀번호-재확인을-두고-totp-대기-secret-은-10분-뒤-버린다-2026-11-02) 에 있다.
- 비밀번호 재확인 헬퍼를 부르는 라우트는 모두 `SENSITIVE_ACTION_THROTTLE` 로 요청 빈도를 제한한다. 라우트 목록 · 한도 · 집계 키는 [HTTP API 규약](../CLE-API/CLE-API-CONV.md#7-요청-빈도-제한) §7 이 정한다.
- 비밀번호 변경은 비밀번호 재확인 헬퍼와 같은 두 코드를 쓰지만 헬퍼는 다르다. 이유는 「[비밀번호 변경이 비밀번호 재확인 헬퍼를 재사용하지 않는 이유](#비밀번호-변경이-비밀번호-재확인-헬퍼를-재사용하지-않는-이유)」 에 있다.
- OAuth 전용 계정이 비밀번호를 추가하려면 [가입과 로그인](CLE-ACCT-SIGNIN.md) 의 비밀번호 재설정 경로를 쓴다.
- 로그인 이력 `failure_reason` 의 `INVALID_PASSWORD` 는 로그인 실패 기록값(`AuthService.login`)이라 층이 다르다. 같은 이름의 wire 에러 코드는 2026-09-02 에 은퇴했다.
- 공용 에러 카탈로그 등재는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 가 한다.

## 세션 화면

로그인 세션 관리 화면은 `/profile/sessions` 다. 내 프로필의 보안 카드에서 링크로 들어온다.

| 영역 | 들어가는 요소 | 동작 |
| --- | --- | --- |
| 활성 세션 탭 | 로그인된 기기·브라우저 목록(로그인 세션 단위), 기기 라벨·IP·마지막 사용 시각, "현재" 세션 배지 | 다른 세션을 하나씩 종료하거나 현재 세션을 뺀 나머지를 한꺼번에 종료한다. 종료 전 `RevokeConfirmDialog` 가 비밀번호 또는 TOTP 로 계정 재인증을 받는다 |
| 로그인 이력 탭 | 성공·실패·강제 종료 같은 인증 이벤트를 시간 역순으로 표시 | 본인만 조회한다. 이벤트 종류·조회 API·180일 보존은 [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md) 가 정한다 |

세션 종료 확인 창의 계정 재인증 입력은 다음 순서로 바뀐다. 이유는 「[세션 강제 종료의 계정 재인증은 비밀번호를 먼저 받고 서버 응답으로 입력을 바꾼다 (2026-11-02)](#세션-강제-종료의-계정-재인증은-비밀번호를-먼저-받고-서버-응답으로-입력을-바꾼다-2026-11-02)」 에 있다.

- 처음에는 늘 비밀번호 입력란을 보여 준다. TOTP 가 켜진 계정도 같다.
- 종료 요청이 400 `REAUTH_REQUIRED` 로 끝나고 그 계정의 TOTP 가 켜져 있으면 TOTP 코드 입력란으로 바꾼다. 비밀번호만 보낸 요청에 이 응답이 오면 그 계정에 비밀번호가 없다는 뜻이다. TOTP 켜짐 여부는 `GET /api/users/me` 응답의 `twoFactorEnabled` 로 읽는다([내 프로필](CLE-ACCT-PROFILE.md#api)).
- 종료 요청이 403 `REAUTH_NOT_AVAILABLE` 로 끝나면 계정 재인증을 할 수 없다고 안내한다.
- 비밀번호가 틀린 경우(401 `PASSWORD_INVALID`)는 비밀번호 입력란을 그대로 둔다.

이메일 변경 화면은 두 입력란을 함께 보여 주므로 이 전환 규칙을 쓰지 않는다([가입과 로그인 「이메일 변경 화면」](CLE-ACCT-SIGNIN.md#이메일-변경-화면)).

## API

세션 API 다. 갱신과 로그아웃 API 는 [세션과 토큰 — 토큰과 갱신](CLE-ACCT-SESSION-TOKEN.md#api) 에 있다.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/auth/sessions` | 활성 로그인 세션 목록. 로그인 세션 단위, `isCurrent` 포함. 응답 `{ data: { items: [...] } }`. 페이지 없는 고정 컬렉션이다([HTTP API 규약](../CLE-API/CLE-API-CONV.md)) |
| POST | `/api/auth/sessions/:familyId/revoke` | 로그인 세션 하나 강제 종료. 그 `family_id` 전체를 무효화한다. 본문에 비밀번호 또는 TOTP 로 계정 재인증. 응답 200 과 `{ data: { items } }` 형태의 갱신된 세션 목록. 분당 10회. 집계 키는 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) §7 이 정한다. 현재 세션 400 `CANNOT_REVOKE_CURRENT_SESSION`, 남의 세션·없는 세션 404, 재인증 수단 없음 403 `REAUTH_NOT_AVAILABLE`. 일부 CDN·프록시가 DELETE 본문을 지우는 문제를 피하려고 DELETE 대신 POST `/revoke` 를 쓴다(`sessions.controller.ts`) |
| POST | `/api/auth/sessions/revoke-others` | 현재 세션을 뺀 나머지 세션 일괄 종료. 비밀번호 또는 TOTP 로 계정 재인증. 응답 200 과 `{ data: { items } }` 형태의 갱신된 세션 목록. 현재 세션을 식별할 수 없으면 400 `CURRENT_SESSION_REQUIRED`. 분당 5회. 집계 키는 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) §7 이 정한다 |

세 세션 라우트는 리프레시 쿠키 Path(`/api/auth`) 아래에 있어야 현재 세션을 식별할 수 있다. 옛 경로 `/api/users/me/sessions…` 는 별칭 없이 지웠고 지금은 404 다. 이유는 「[세션 API 를 리프레시 쿠키 Path 아래로 옮겼다](#세션-api-를-리프레시-쿠키-path-아래로-옮겼다)」 에 있다. URL 명명 규칙의 예외 등재는 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 명명 규칙 절이 한다.

로그인 이력 조회 `GET /api/users/me/login-history` 는 [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md) 가 정한다. 이 라우트는 쿠키가 필요 없어 `/api/users/me` 아래에 그대로 둔다. 세션 라우트 셋과 로그인 이력 조회는 같은 `SessionsController` 에 있다. 이 컨트롤러는 prefix 없이(`@Controller()`) 라우트마다 전체 경로를 적는다.

## 구현 위치

- `codebase/backend/src/modules/auth/sessions.controller.ts`, `codebase/backend/src/modules/auth/sessions.service.ts` (세션 목록과 강제 종료 `/api/auth/sessions…`, 로그인 이력 `/api/users/me/login-history`, `verifyReauth`)
- `codebase/backend/src/modules/auth/sessions.controller.spec.ts` (세션 라우트가 리프레시 쿠키 Path 안에 있는지)
- `codebase/backend/src/modules/auth/utils/refresh-cookie.ts` (리프레시 쿠키 설정·삭제, Path 상수 `REFRESH_COOKIE_PATH`, 로그인 유지 여부에 맞춘 쿠키 `maxAge`)
- `codebase/backend/src/modules/auth/utils/client-ip.ts` (`extractClientIp`)
- `codebase/backend/src/common/config/app.config.ts` (`computeCookieDomain`)
- `codebase/backend/test/session-revocation.e2e-spec.ts`, `codebase/backend/test/helpers/auth.ts` (쿠키를 Path 가 맞는 요청에만 붙이는 세션 e2e)
- `codebase/frontend/src/app/(main)/w/[slug]/profile/sessions/**`
- `codebase/frontend/src/app/(main)/w/[slug]/profile/sessions/reauth-mode.ts`, `codebase/frontend/src/app/(main)/w/[slug]/profile/sessions/sessions-panel.tsx` (세션 강제 종료 계정 재인증 입력 전환 `nextReauthMode`)

## Rationale

### 리프레시 쿠키 Domain 을 자동으로 정한다

리프레시 쿠키 Domain 은 운영자 환경 변수가 아니라 `FRONTEND_URL`·`APP_URL` hostname 의 공통 상위 도메인에서 정한다. `api.x.com`·`app.x.com` 같은 서브도메인 분리 배포에서 별도 설정 없이 인증이 동작하게 하고, Domain 을 잘못 적어 쿠키가 전달되지 않는 운영 사고를 줄이기 위해서다. localhost·IP·공통 상위 도메인 없음이면 Domain 을 지정하지 않아 백엔드 origin 으로 좁힌다. 도메인이 완전히 다르면 쿠키를 공유할 수 없으므로 클라이언트의 `withCredentials` cross-origin 요청에 맡긴다.

### 리프레시 쿠키 SameSite 기본값을 `none` 으로 둔다

이 제품은 프론트와 API 의 사이트 경계(eTLD+1)가 다른 cross-site 배포를 지원한다. 이 배포에서 `lax`·`strict` 면 리프레시 쿠키가 cross-site 요청에 붙지 않아 세션이 끊긴다. 그래서 중단 없는 기본값은 `none` 이고, 같은 사이트 배포만 `lax`·`strict` 로 조인다. 웹채팅 위젯 같은 임베드는 Bearer EIA 토큰을 쓰고 리프레시 쿠키에 기대지 않으므로 `none` 이 필요한 주체가 아니다.

기각한 대안은 "기본 `Lax`, cross-site 배포만 `none` 을 opt-in" 한 원안이다. eTLD+1 이 다른 배포가 실제로 쓰이고 있음을 확인했고, `Lax` 기본값은 그 배포에서 첫 갱신부터 세션을 끊는다. 중단 없는 운영을 우선해 `none` 을 기본으로 하고 CSRF 는 Origin 검증으로 보완했다.

### `SameSite=none` 의 CSRF 는 Origin 검증으로 막는다

`SameSite=none` 은 cross-site 요청에 쿠키를 자동으로 붙이므로 갱신 요청에 강제 갱신 CSRF 가 성립할 수 있다. 다만 다른 엔드포인트는 모두 Bearer 액세스 토큰 기반이라 쿠키 CSRF 와 무관하다. 또 credentials CORS 허용 목록이 cross-site 출처의 응답 읽기를 이미 막는다. 그래서 double-submit 같은 CSRF 토큰 인프라를 새로 두지 않고, 갱신 요청이 `Origin` 을 기존 CORS 허용 목록과 비교해 목록 밖·불투명(`'null'`, sandbox iframe 등) Origin 을 403 으로 먼저 막는 방어를 더했다. Origin 이 없는 요청(같은 origin, 브라우저 아닌 도구)은 통과한다. 프론트 변경이나 토큰 발급 인프라가 필요 없다. 쿠키 Path 를 `/api/auth` 로 좁혀 쿠키가 붙는 표면도 줄였다. 이 절은 처음에 리프레시 쿠키가 갱신 한 곳에서만 쓰인다는 전제로 적었다. 쿠키를 읽는 라우트가 늘어난 뒤의 판단은 「[리프레시 쿠키를 읽는 라우트가 늘었다](#리프레시-쿠키를-읽는-라우트가-늘었다)」 에 있다.

### 클라이언트 IP 는 명시적으로 신뢰할 때만 CF 헤더를 쓴다

`CF-Connecting-IP` 는 클라이언트가 마음대로 보낼 수 있는 헤더다. Cloudflare 뒤가 아닌 배포에서 무조건 믿으면 요청 한도 우회, `ip_whitelist` 우회, 감사 로그 IP 오염이 가능하다. 그래서 `TRUST_CF_CONNECTING_IP=true`(정확히 `true` 나 `1`)로 명시한 배포에서만 1순위로 쓰고, 기본(off)에서는 무시하고 `X-Forwarded-For`·`req.ip` 로 폴백한다. Cloudflare(Tunnel 포함) 뒤에서는 `X-Forwarded-For` 첫 IP 도 같은 실제 클라이언트 IP 라 off 폴백이 안전하다. 이 신뢰 플래그는 IP 를 읽는 세 경로(세션·감사 IP 의 `extractClientIp`, 공개 웹훅 요청 한도와 `ip_whitelist` 검증의 `extractClientIpFromHeaders`)에 같게 적용한다. 채팅 채널 서명 검증 실패 한도의 `extractUnspoofableClientIp` 도 이 플래그를 같게 따른다. origin 직접 접근 차단(인프라·터널) 전제는 유지하고, 강제 IP 허용 목록은 터널 배포에 필요 없어 권고에서 뺐다.

`ip_whitelist`·요청 한도의 IP 추출이 헤더 기반인 것은 의도한 결정이다. `req.ip`(Express `trust proxy 1`)를 우선하거나 대신 쓰자는 안은 기각했다. CF Tunnel 배포에서 `req.ip` 는 cloudflared·CF edge 주소라 실제 클라이언트가 아니어서 `ip_whitelist` 를 오히려 깨뜨린다. XFF 헤더 위조 방어는 인프라와 `trust proxy` 경계의 책임이다. 코드 리뷰가 "`req.ip` 폴백이 없다" 고 지적해도 이 절이 정한 의도된 설계다. 같은 이유로 공개 웹훅 요청 한도는 헤더로 IP 를 알 수 없을 때 `req.socket.remoteAddress` 폴백을 쓰지 않는다. trust proxy 뒤에서는 socket 피어가 프록시 주소라 모든 트래픽이 한 버킷으로 몰려 정상 사용자가 429 를 받기 때문이다. 대신 식별 못 한 요청을 단일 공유 버킷의 완화 한도로 처리한다. 무제한 통과가 아니다. 그 한도 규칙은 [웹채팅 보안](../CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md) 이 정한다. 채팅 채널 서명 검증 실패 한도는 이 결정의 예외다. 보내는 쪽이 키의 IP 를 고르지 못하게 `X-Forwarded-For` 첫 IP 를 쓰지 않고 `req.ip` 를 쓴다. 규칙이 다른 이유는 [채팅 채널 「R-CC-34」](../CLE-CHAT/CLE-CHAT-CORE-GATE.md#r-cc-34-서명-검증-실패는-트리거와-ip-쌍으로-세고-한도에-닿으면-401-로-답한다) 에 있다.

### 비밀번호 변경은 모든 세션을 끊고 현재 기기에 다시 발급한다

비밀번호 변경의 보안 목적은 유출된 비밀번호로 이미 발급된 세션을 무효화하는 것이다. 이상적으로는 현재 세션만 남기고 나머지를 끊는 것이다. 그런데 리프레시 쿠키 Path 가 `/api/auth` 로 한정돼 `/api/users/me/change-password` 요청에는 쿠키가 붙지 않아 현재 세션을 식별할 수 없다. 그래서 모두 끊고 다시 발급해 현재 기기를 유지하는 같은 경험을 주면서, 현재 세션의 옛 리프레시 토큰까지 바꿔 더 강하게 무효화한다. OWASP Session Management 권고(비밀번호 변경 시 세션 무효화)와 맞다. 변경 직전 `currentPassword` bcrypt 검증으로 본인 확인이 끝나므로 별도 재인증은 요구하지 않는다. 응답으로 새 액세스 토큰을 주고 리프레시 쿠키를 바꿔 변경한 본인은 로그아웃 없이 계속 쓴다.

다시 발급하는 세션은 표준 7일이다. 현재 세션을 식별할 수 없어 직전 세션의 로그인 유지(30일) 여부를 이어받을 수 없다. 이 규칙의 정본은 [토큰과 갱신 「로그인 유지」](CLE-ACCT-SESSION-TOKEN.md#로그인-유지) 이고, 바뀌면 이 문단과 「세션 정책」 표의 비밀번호 변경 행을 함께 고친다. 본인이 방금 한 동작이라 세션 수명이 줄어드는 것은 받아들일 만하다.

로그인하지 않은 비밀번호 재설정과 위협 모델이 다르다. 재설정은 "비밀번호를 잃어 계정 통제를 잃었을 수 있는" 경우라 모든 세션을 끊고 다시 발급하지 않고 로그인 화면으로 보낸다. 비밀번호 변경은 "현재 비밀번호를 아는 본인이 스스로 바꾸는" 경우라 현재 세션을 믿고 다시 발급한다. 두 흐름 모두 모든 세션을 끊는다는 원칙은 같고 다시 발급하는지만 다르다.

`session_revoked` enum 값은 그대로 다시 쓴다. 새 이벤트 종류가 아니라서 로그인 이력 스키마·DB CHECK·마이그레이션이 필요 없다.

기각한 대안은 두 가지다. (a) 모든 세션을 끊고 다시 발급하지 않는 방식은 방금 비밀번호로 확인한 본인 세션을 끊어도 보안 이득이 없고 재로그인 비용만 든다. (b) 현재 세션만 빼고 끊는 방식은 위 쿠키 Path 제약으로 비밀번호 변경 컨트롤러가 현재 세션을 식별할 수 없어 구현할 수 없다.

OAuth 전용 계정은 비밀번호가 없어 `POST /api/users/me/change-password` 자체가 `PASSWORD_REQUIRED`(401)로 막힌다. 이 정책은 비밀번호가 있는 사용자에게만 적용된다. 세션 무효화와 재발급이 실패해도 이미 커밋한 비밀번호 변경을 깨지 않도록 best-effort 로 처리하되, 실패는 서버 로그로 확인할 수 있어야 한다.

### 계정 재인증은 비밀번호 또는 TOTP 로만 한다

세션 강제 종료 재인증은 처음에 "OAuth 전용 계정은 TOTP·Passkey 또는 이메일 OTP 로 대체, Passkey 우선" 으로 적혀 있었다. 실제 구현(`SessionsService.verifyReauth`)과 이메일 변경 재인증 결정, 내 프로필 화면은 모두 비밀번호 또는 TOTP 만 지원한다. Passkey 로 하는 재인증은 challenge·response 흐름이 필요해 지원하지 않고, 이메일 OTP 는 코드에 없다. 그래서 세션 정책 표를 실제 지원 수단으로 고치고 Passkey·이메일 OTP 를 "현재 미지원" 으로 적었다. 새 결정이 아니라 벗어나 있던 서술을 이미 정한 이메일 변경 재인증 결정에 맞춘 것이다. 이 정정으로 세션 정책이 재인증 에러 코드(`REAUTH_REQUIRED`=400, `PASSWORD_INVALID`=401, `TOTP_INVALID`=401)의 기준이 됐다.

복구 코드는 받지 않는다. 지금은 요청 DTO 의 `totpCode` 길이 제한(6~8자)이 복구 코드를 막는다.

2026-10-17 에 `REAUTH_NOT_AVAILABLE` 의 조건을 "비밀번호도 2단계 인증도 없는 계정" 에서 TOTP 기준으로 바로잡았다. [가입과 로그인](CLE-ACCT-SIGNIN.md) 에서 2단계 인증은 TOTP 와 Passkey 를 함께 뜻하지만 구현은 `password_hash` 와 `two_factor_enabled`(TOTP 사용 여부만 뜻함)만 본다. 그래서 Passkey 만 등록하고 비밀번호와 TOTP 가 없는 계정도 403 `REAUTH_NOT_AVAILABLE` 이다. Passkey 로 하는 계정 재인증은 지원하지 않으므로 이 동작이 그 결정과 맞다. 동작은 바뀌지 않았다.

### 비밀번호 변경이 비밀번호 재확인 헬퍼를 재사용하지 않는 이유

비밀번호 변경(`UsersService.changePassword`)은 비밀번호 재확인(`AuthService.verifyPasswordForUser`)과 같은 두 코드를 내지만 헬퍼를 재사용하지 않는다. 순환 의존 때문이 아니다. `UsersModule` 은 이미 `forwardRef(() => AuthModule)` 을 import 하고 `UsersController` 가 그 방식으로 `AuthService` 를 주입받으므로 주입은 가능하다. 재사용하지 않는 이유는 그 헬퍼가 사용자를 다시 조회하고 `!user` 를 `PASSWORD_REQUIRED` 로 접기 때문이다. 변경 경로는 이미 조회한 사용자를 쓰므로 같은 질의가 두 번 되고, 변경 경로는 사용자 없음을 `USER_NOT_FOUND`(404)로 유지해야 한다. 세션 강제 종료·이메일 변경 재인증(`verifyReauth`)과도 별도 헬퍼이고 상태와 코드가 다르다.

### 세션 API 를 리프레시 쿠키 Path 아래로 옮겼다

2026-10-10, Task CLE-T-ERAJ7P 의 결정이다.

세션 API 가 `/api/users/me/sessions` 에 있을 때는 현재 세션에 걸린 약속 셋이 동작하지 않았다. 리프레시 쿠키의 Path 가 `/api/auth` 라서 브라우저가 그 경로로 가는 요청에 쿠키를 붙이지 않았기 때문이다. `isCurrent` 가 늘 false 였고, 일괄 종료는 늘 400 `CURRENT_SESSION_REQUIRED` 로 끝났고, 현재 세션 강제 종료를 막는 규칙이 걸리지 않았다.

e2e 는 이 결함을 잡지 못했다. 테스트가 Cookie 헤더를 모든 요청에 손으로 붙였기 때문이다. 지금 `session-revocation.e2e-spec.ts` 는 `test/helpers/auth.ts` 의 `browserCookieFor` 로 브라우저처럼 Path 가 맞는 요청에만 쿠키를 붙인다.

그래서 세션 라우트 셋을 `/api/auth/sessions…` 로 옮겼다. 쿠키 Path 는 `/api/auth` 그대로다. 로그인 이력 조회는 쿠키가 필요 없어 `/api/users/me/login-history` 에 남겼다.

기각한 대안은 세 가지다.

- (a) 쿠키 Path 를 `/api` 로 넓히는 안. 모든 API 요청에 리프레시 쿠키가 붙는다. 쿠키 Path 를 좁혀 쿠키가 붙는 표면을 줄인 원칙(「[`SameSite=none` 의 CSRF 는 Origin 검증으로 막는다](#samesitenone-의-csrf-는-origin-검증으로-막는다)」)과 어긋난다.
- (b) 액세스 토큰에 로그인 세션(`family_id`) 클레임을 넣는 안. 토큰 구조가 바뀌고 액세스 토큰을 발급하는 경로마다 그 값을 채워야 한다. 쿠키로 이미 알 수 있는 사실을 위해 토큰 계약을 바꿀 까닭이 없다.
- (c) 옛 경로를 별칭으로 남기는 안. 옛 경로에는 여전히 쿠키가 붙지 않는다. 그 경로로 오는 요청은 `isCurrent` 를 틀리게 보고하고 현재 세션 강제 종료를 막지 못한다. 경로마다 핸들러를 두면 요청 한도 버킷도 갈린다. 옛 경로를 부르던 곳은 이 저장소의 프런트엔드와 e2e 뿐이어서 별칭 없이 지웠다.

URL 명명 규칙의 예외는 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 명명 규칙 표에 따로 등재했다.

### 리프레시 쿠키를 읽는 라우트가 늘었다

2026-10-10 에 바뀐 사실이다. 로그아웃은 원래 쿠키를 읽었고, 세션 라우트 셋도 쿠키를 읽는다. 그래도 Origin 검증은 계속 갱신 요청에만 둔다.

- 세션 API 는 Authorization 헤더의 Bearer 액세스 토큰이 있어야 동작한다. 액세스 토큰은 우리 프런트엔드의 JS 메모리에만 있어 다른 사이트의 페이지는 그 헤더를 붙일 수 없다.
- 그래서 쿠키만으로는 아무 동작도 승인되지 않는다. 세션 API 에서 쿠키는 어느 로그인 세션이 현재인지 가리는 데만 쓴다.
- 갱신은 다르다. 갱신은 쿠키 하나로 새 토큰을 발급하는 상태 변경이라 Origin 검증이 필요하다.
- 로그아웃도 쿠키 하나로 동작한다. 라우트가 `@Public()` 이라 Bearer 액세스 토큰을 요구하지 않는다. 그래도 로그아웃은 Origin 검증을 두지 않는다. 새 토큰을 발급하지 않아 cross-site 요청으로 얻는 것이 강제 로그아웃뿐이라서다.

비밀번호 변경과 이메일 변경은 `/api/users/me/*` 에 그대로 둔다. 두 흐름은 모든 세션을 끊고 현재 기기에 다시 발급하므로 현재 세션을 알 필요가 없다. 세션 정책 표와 「[비밀번호 변경은 모든 세션을 끊고 현재 기기에 다시 발급한다](#비밀번호-변경은-모든-세션을-끊고-현재-기기에-다시-발급한다)」 의 "쿠키가 붙지 않아 현재 세션을 식별할 수 없다" 는 이 두 요청에만 해당한다. 그 절이 기각한 (b) 현재 세션만 빼고 끊는 방식은 이제 경로를 옮기면 만들 수 있다. 그래도 바꾸지 않는다. 다시 발급하면 현재 세션의 옛 리프레시 토큰까지 바뀌어 더 강하게 무효화된다는 이유는 그대로다.

### 세션 강제 종료의 계정 재인증은 비밀번호를 먼저 받고 서버 응답으로 입력을 바꾼다 (2026-11-02)

계정 재인증은 비밀번호가 있는 계정이면 TOTP 를 켰어도 비밀번호로 통과한다. 인증 앱을 잃은 사용자도 비밀번호로 다른 세션을 끊을 수 있어야 한다. 그래서 세션 종료 확인 창은 처음에 늘 비밀번호를 받는다([세션 화면](#세션-화면)).

- 화면에서는 그 계정에 비밀번호가 있는지 알 수 없다. `GET /api/users/me` 가 비밀번호 유무를 싣지 않기 때문이다. 그래서 서버 응답을 보고 입력을 바꾼다. 400 `REAUTH_REQUIRED` 는 자격 증명이 모자랄 때 나고 비밀번호만 보낸 요청에서는 그 계정에 비밀번호가 없다는 신호다. 그 계정의 TOTP 가 켜져 있으면 TOTP 코드 입력란으로 바꾼다.
- 비용: 비밀번호 없이 TOTP 만 켠 계정은 첫 시도에서 실패 안내를 한 번 본 뒤 TOTP 코드를 넣는다. 2026-11-01 부터 TOTP 를 켜려면 비밀번호가 있어야 하므로 그 전에 TOTP 를 켠 OAuth 전용 계정만 이 경우다([가입과 로그인 「TOTP 켜기」](CLE-ACCT-SIGNIN.md#totp-켜기)).
- 비밀번호와 TOTP 가 모두 있는 계정은 이 창에서 비밀번호로 확인한다. 이 계정은 비밀번호를 보내도 400 이 나지 않아 TOTP 코드 입력란이 나오지 않는다. 비밀번호를 잊었으면 비밀번호 재설정을 쓴다.
- **기각: 내 프로필 응답에 비밀번호 유무(`hasPassword`)를 싣는다.** 처음부터 맞는 입력을 보여 줄 수 있다. 하지만 이득을 보는 계정이 위의 옛 OAuth 전용 TOTP 계정뿐이라 필드 추가에 견줘 이득이 작다. 그 계정이 치르는 비용은 실패 안내 한 번이다. 같은 날 [내 프로필 「`GET /api/users/me` 에 TOTP 켜짐 여부를 싣는다」](CLE-ACCT-PROFILE.md#get-apiusersme-에-totp-켜짐-여부를-싣는다) 는 `twoFactorEnabled` 를 더했다. 그 값이 없을 때는 TOTP 를 켠 계정 모두 화면에서 TOTP 를 끌 수 없었다.
- **기각: TOTP 가 켜진 계정은 처음부터 TOTP 코드를 받는다.** 비밀번호가 있는데 인증 앱을 잃은 사용자가 세션을 끊지 못한다.
