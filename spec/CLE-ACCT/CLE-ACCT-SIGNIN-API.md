---
id: "CLE-ACCT-SIGNIN-API"
title: "가입과 로그인 — API 와 에러 코드"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ACCT-SIGNIN"
ancestors: ["CLE-VISION", "CLE-ACCT", "CLE-ACCT-SIGNIN"]
area: "CLE-ACCT"
content_hash: "c49345f860e9975f4e4fcbfaaa0da71e1ff39b473a97acc55ea784c422b73a22"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "30063220f7ea96bb16f56e26f111eb69695f02f46a8371c8042345eca6ec0f92"
etag: "sha256-30fcfad53a0ec21b1d78cb99bb866a3d3e4205f1a24508516e6450059006690d"
---
## 개요

이 문서는 [가입과 로그인](CLE-ACCT-SIGNIN.md) 의 하위 문서로 가입 · 로그인 · 2단계 인증 · 소셜 로그인 · 이메일 변경 엔드포인트와 에러 코드를 정한다. 각 동작의 순서와 규칙은 [가입 · 재설정 · 이메일 변경](CLE-ACCT-SIGNIN-SIGNUP.md), [로그인과 소셜 로그인](CLE-ACCT-SIGNIN-LOGIN.md), [2단계 인증 설정과 TOTP](CLE-ACCT-SIGNIN-TOTP.md), [Passkey 기능과 등록](CLE-ACCT-SIGNIN-PASSKEY.md), [Passkey 로그인 인증](CLE-ACCT-SIGNIN-PKAUTH.md) 에 있다.

## API

[가입과 로그인](CLE-ACCT-SIGNIN.md) 과 그 하위 문서가 소유하는 엔드포인트다. 로그아웃·토큰 갱신·로그인 세션 목록은 [세션과 토큰](CLE-ACCT-SESSION.md), 워크스페이스 전환·초대는 [워크스페이스와 멤버](CLE-ACCT-WS.md), 감사 로그 조회는 [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md), 웹훅 수신 인증 설정(AuthConfig)의 CRUD·평문 보기 엔드포인트는 [외부 호출 인증 설정 §API](../CLE-TRIG/CLE-TRIG-AUTHCFG.md#api) 가 정한다.

이 문서의 표와 본문에 적은 성공 응답은 응답 봉투 `{ data: … }` 안의 내용이다([HTTP API 규약](../CLE-API/CLE-API-CONV.md) 규칙 5). 예를 들어 `GET /api/auth/2fa/webauthn/availability` 의 응답 `{ enabled: boolean }` 은 wire 에서 `{ "data": { "enabled": … } }` 다. 에러 응답 형식은 [에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md) 가 정한다.

### 가입과 로그인

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/auth/register` | 가입. 인증 불요(`@Public`), IP 당 분당 10회. 본문 `{ name, email, password, termsAccepted, invitationToken? }`. `password` 는 8~100자다. 강도 규칙 위반은 400 `VALIDATION_ERROR` 이고 `details[].field` 는 `password` 다. `termsAccepted` 가 `true` 가 아니면 400 `VALIDATION_ERROR` 다. 초대 토큰이 없으면 사용자 행과 인증 메일만 만들고 토큰 없이 201 `{ message }` 를 준다. 활성화는 `verify-email` 에서 한다. 초대 토큰이 있으면 인증 메일 없이 바로 로그인하고 `{ message, accessToken }` 과 리프레시 쿠키를 준다. 개인 워크스페이스는 만들지 않는다([워크스페이스와 멤버](CLE-ACCT-WS.md)). 초대 토큰 에러는 [워크스페이스와 멤버 「초대 에러 코드」](CLE-ACCT-WS.md#초대-에러-코드) 에 있다. 이메일이 이미 가입돼 있으면(대소문자만 다른 계정 포함, [이메일 비교 규칙](CLE-ACCT-SIGNIN-SIGNUP.md#이메일-비교-규칙)) 409 `RESOURCE_CONFLICT`(메시지 `Email already registered`)다. 초대 가입 화면은 메시지가 아닌 `error.code` 로 이 경우를 가른다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 규칙 4). 이 응답을 전용 코드로 바꾸는 일은 NERV Task `CLE-T-2M6Q02` 가 맡는다 |
| POST | `/api/auth/verify-email` | 본문 `{ token }` 으로 이메일 인증 토큰을 검증한다. 개인 워크스페이스를 만들고 액세스·리프레시 토큰을 바로 발급한다. 인증 불요(`@Public`). 토큰이 무효하거나 만료되면 400 |
| POST | `/api/auth/resend-verification` | 인증 메일 재발송(24시간 유효). 인증 불요(`@Public`), IP 당 분당 5회. 계정 존재·인증 여부와 상관없이 같은 응답. 메일은 인증 전 계정에만 보낸다 |
| POST | `/api/auth/check-email` | 가입 전 이메일 사용 가능 여부 `{ available }`. 인증 불요(`@Public`), IP 당 분당 5회. 가입 폼 이메일 입력란의 중복 확인과 초대 가입 화면의 가입 여부 확인([워크스페이스와 멤버 「초대 가입 화면」](CLE-ACCT-WS.md#초대-가입-화면))에 쓴다. 초대 가입 화면은 이 응답을 5초까지만 기다린다. 대소문자를 구분하지 않고 비교한다. 저장된 이메일과 대소문자만 다른 계정이 있어도 `available: false` 다([이메일 비교 규칙](CLE-ACCT-SIGNIN-SIGNUP.md#이메일-비교-규칙)). 이 확인이 이메일 존재를 새로 드러내지 않는 이유는 [워크스페이스와 멤버 「가입 여부 확인은 이메일 존재를 새로 노출하지 않는다 (2026-10-18)」](CLE-ACCT-WS.md#가입-여부-확인은-이메일-존재를-새로-노출하지-않는다-2026-10-18) 에 있다 |
| POST | `/api/auth/login` | 로그인. IP 당 분당 10회. 본문 `{ email, password, rememberMe }`. 2단계 인증이 있으면 `{ requires2fa, methods, challengeToken }`, 없으면 `{ accessToken }` 과 리프레시 쿠키. 실패 401 `LOGIN_FAILED`, 비밀번호가 맞는 이메일 인증 전 계정 401 `EMAIL_VERIFICATION_REQUIRED`, 잠긴 계정 401 `ACCOUNT_LOCKED`, Passkey 기능이 꺼진 동안 Passkey 만 등록하고 TOTP 가 꺼진 계정 503 `WEBAUTHN_DISABLED`. 순서는 [로그인 처리](CLE-ACCT-SIGNIN-LOGIN.md#로그인-처리) |
| POST | `/api/auth/login/totp` | 로그인 2단계 TOTP 검증. 본문 `{ challengeToken, code }`(6자리 코드 또는 TOTP 복구 코드). 성공하면 액세스·리프레시 토큰 발급. 챌린지 토큰 무효 401 `CHALLENGE_INVALID`, TOTP 꺼짐 401 `TOTP_NOT_ENABLED`(Passkey 만 있는 계정 포함), TOTP 와 Passkey 가 모두 있는 계정 401 `WEBAUTHN_REQUIRED`, 코드 불일치 401 `TOTP_INVALID` |
| POST | `/api/auth/forgot-password` | 비밀번호 재설정 요청. IP 당 분당 5회. 항상 같은 응답 |
| POST | `/api/auth/reset-password` | 비밀번호 재설정. 본문 `{ token, newPassword }`. 실패는 모두 400 `VALIDATION_ERROR` 다. 지금 구현은 요청 형식이나 새 비밀번호의 길이 · 강도 규칙 위반에 `details` 를 싣고 토큰 무효 · 만료에는 싣지 않는다. 강도 규칙 위반의 `details[].field` 는 요청 필드 이름인 `newPassword` 다. 가입은 `password`, 비밀번호 변경은 `newPassword` 다([내 프로필](CLE-ACCT-PROFILE.md)). 이 차이는 현재 동작이고 계약이 아니다. 클라이언트는 `details` 유무로 원인을 가르지 않는다([미결 사항](CLE-ACCT-SIGNIN-SIGNUP.md#미결-사항)). 새 비밀번호 검사가 토큰 조회보다 먼저다 |

### 2단계 인증

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/auth/2fa/setup` | TOTP 설정 시작. 인증 필수(JWT), 사용자당 분당 10회. 본문 `{ password }`(8자 이상). 비밀번호를 먼저 확인한 뒤 secret 을 발급하고 `{ otpauthUrl, qrCodeDataUrl }`(QR 코드 data URL)를 돌려준다. 활성화 검증 전에는 켜지지 않는다. 본문 누락·형식 에러 400 `VALIDATION_ERROR`, 비밀번호 실패 401 `PASSWORD_REQUIRED`·`PASSWORD_INVALID`, TOTP 가 이미 켜짐 409 `TOTP_ALREADY_ENABLED`(secret 을 바꾸지 않는다). 순서와 규칙은 [TOTP 켜기](CLE-ACCT-SIGNIN-TOTP.md#totp-켜기) |
| POST | `/api/auth/2fa/verify` | TOTP 활성화 검증. 인증 필수(JWT), 사용자당 분당 10회. 본문 `{ code }`(인증 앱의 6자리 코드). 켜고 TOTP 복구 코드 10개를 한 번 돌려준다(`{ recoveryCodes }`). 본문 형식 에러 400 `VALIDATION_ERROR`, 설정 시작 전이거나 설정 시작 뒤 10분이 지남 400 `TOTP_NOT_INITIALIZED`(10분이 지났으면 코드를 확인하지 않고 대기 secret 을 비운다), TOTP 가 이미 켜짐 409 `TOTP_ALREADY_ENABLED`(코드를 확인하지 않고 복구 코드를 다시 발급하지 않는다), 코드 불일치 401 `TOTP_INVALID`. 순서와 규칙은 [TOTP 켜기](CLE-ACCT-SIGNIN-TOTP.md#totp-켜기) |
| POST | `/api/auth/2fa/disable` | TOTP 끄기. 인증 필수(JWT), 사용자당 분당 10회. 본문 `{ password, code }`. `code` 는 6~32자 문자열이고 로그인 2단계의 `code` 와 같이 인증 앱의 6자리 코드나 TOTP 복구 코드를 받는다. 비밀번호를 먼저 확인하고 이어서 코드를 확인한다. 성공하면 TOTP secret 과 TOTP 복구 코드를 비우고 200 `{ ok: true }`. 본문 누락·형식 에러 400 `VALIDATION_ERROR`, 비밀번호 실패 401 `PASSWORD_REQUIRED`·`PASSWORD_INVALID`, 코드 불일치·TOTP 꺼짐 401 `TOTP_INVALID`. 순서와 규칙은 [TOTP 끄기](CLE-ACCT-SIGNIN-TOTP.md#totp-끄기) |
| GET | `/api/auth/2fa/webauthn/availability` | Passkey 기능 켜짐 여부. 인증 불요(`@Public`). 응답 `{ enabled: boolean }` |
| POST | `/api/auth/2fa/webauthn/register/options` | Passkey 등록 옵션. 인증 필수(JWT), 사용자당 분당 10회. 본문 `{ password }`(8자 이상). 비밀번호를 먼저 확인한 뒤 등록 옵션과 `optionsToken` JWT(`kind=webauthn_register`, 5분)를 준다. 본문 누락·형식 에러 400 `VALIDATION_ERROR`, 비밀번호 실패 401 `PASSWORD_REQUIRED`·`PASSWORD_INVALID`(등록 옵션과 `optionsToken` 을 만들지 않는다). 기능이 꺼져 있으면 비밀번호를 확인하기 전에 503 `WEBAUTHN_DISABLED`. 순서와 규칙은 [Passkey 등록 흐름](CLE-ACCT-SIGNIN-PASSKEY.md#passkey-등록-흐름) |
| POST | `/api/auth/2fa/webauthn/register/verify` | Passkey 등록 검증. 인증 필수(JWT). credential 을 저장하고 첫 등록이면 복구 코드 10개를 평문으로 돌려준다. 이후에는 SHA-256 해시만 보관한다. 본문 `{ optionsToken, response, deviceName? }`. 실패 400 `WEBAUTHN_VERIFY_FAILED`, `optionsToken` 무효 400 `INVALID_OPTIONS_TOKEN`, 표시 이름 형식 에러 400 `VALIDATION_ERROR`([Passkey 등록 흐름](CLE-ACCT-SIGNIN-PASSKEY.md#passkey-등록-흐름)) |
| POST | `/api/auth/2fa/webauthn/authenticate/options` | 로그인 2단계 Passkey 옵션. 인증 불요(`@Public`). 본문의 `challengeToken` 으로 사용자를 식별한다. `optionsToken`(`kind=webauthn_auth`)을 준다. 챌린지 검증 실패 401 `CHALLENGE_INVALID`, TOTP 챌린지로 받은 챌린지 토큰 401 `CHALLENGE_METHOD_MISMATCH` |
| POST | `/api/auth/2fa/webauthn/authenticate/verify` | 로그인 2단계 Passkey 검증. 인증 불요(`@Public`). `challengeToken` 과 `optionsToken` 을 함께 검증한다. 성공하면 액세스·리프레시 토큰 발급. 실패 401 `WEBAUTHN_INVALID`(서명 불일치, 이미 쓴 Passkey 인증 챌린지 포함. credential 을 지우지 않는다). 응답의 credential 이 그 사용자의 것이 아니면 지금은 401 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 다(`WEBAUTHN_INVALID` 로 옮기기로 정함, [에러 코드](#에러-코드)). 처음 쓰는 Passkey 인증 챌린지에서 서명이 맞는데 counter 가 역행하면 credential 행을 지우고 401 `WEBAUTHN_COUNTER_REGRESSION`, 로그인 이력 `webauthn_failed`(`failure_reason=WEBAUTHN_COUNTER_REGRESSION`). 챌린지 토큰 실패는 options 와 같다. Passkey 인증 챌린지를 기록하지 못하면 서명과 counter 를 판정하지 않고 503 `SERVICE_UNAVAILABLE`([Passkey 인증 챌린지 기록](CLE-ACCT-SIGNIN-PKAUTH.md#passkey-인증-챌린지-기록)) |
| POST | `/api/auth/2fa/webauthn/recovery` | Passkey 복구 코드로 2단계 통과. 인증 불요(`@Public`). 본문 `{ challengeToken, code }`. 실패 401 `RECOVERY_CODE_INVALID`. 챌린지 토큰 실패는 options 와 같다 |
| GET | `/api/auth/2fa/webauthn/credentials` | 내 Passkey 목록. 인증 필수(JWT). 응답 `{ items: [{ id, deviceName, transports, lastUsedAt, createdAt }] }`. 페이지 없는 고정 컬렉션이다([HTTP API 규약](../CLE-API/CLE-API-CONV.md)). `publicKey`·`counter` 는 싣지 않는다. Passkey 기능이 꺼져 있으면 저장된 credential 이 있어도 200 `{ items: [] }` 다 |
| PATCH | `/api/auth/2fa/webauthn/credentials/:id` | credential `device_name` 수정. 인증 필수(JWT). `:id` 는 UUID. 본문 `{ deviceName }`. 200 과 갱신된 행. 없거나 내 것이 아니면 404 `WEBAUTHN_CREDENTIAL_NOT_FOUND`(존재 노출 방지). 이름이 비었거나 공백 문자로만 돼 있거나 형식이 틀리면 400 `VALIDATION_ERROR`([Passkey 등록 흐름](CLE-ACCT-SIGNIN-PASSKEY.md#passkey-등록-흐름)) |
| DELETE | `/api/auth/2fa/webauthn/credentials/:id` | credential 삭제. 인증 필수(JWT). 마지막 credential 을 지우면 `WebAuthnService.deleteCredential` 이 `user.webauthn_recovery_codes` 를 NULL 로 바꾼다(DB 트리거가 아니다). 204. 없거나 내 것이 아니면 404 `WEBAUTHN_CREDENTIAL_NOT_FOUND`(존재 노출 방지) |
| POST | `/api/auth/2fa/webauthn/recovery-codes/regenerate` | Passkey 복구 코드 재발급. 인증 필수(JWT), 사용자당 분당 10회, 본문 `password` 로 비밀번호 재확인. 기존 미사용 코드를 버리고 10개를 새로 발급한다. 비밀번호 실패 401 `PASSWORD_REQUIRED`·`PASSWORD_INVALID`. 기능이 꺼져 있으면 비밀번호를 확인하기 전에 503 `WEBAUTHN_DISABLED`. TOTP 의 `/api/auth/2fa/disable` 과 같은 네임스페이스에 둔다 |

2단계 인증 활성화 API 는 `/api/auth/2fa/*` 만 있다. `/api/users/me/enable-2fa`·`/api/users/me/confirm-2fa` 같은 별칭 경로는 없다.

Passkey credential 목록 · 수정 · 삭제(`/api/auth/2fa/webauthn/credentials[/:id]`)는 본인 소유 자원 라우트지만 [HTTP API 규약](../CLE-API/CLE-API-CONV.md#22-명명-규칙) §2.2 의 `/api/auth/{action}` 예외에 드는 기존 예외다(2단계 인증 등록 · 해제 묶음).

### 소셜 로그인

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/auth/oauth/providers` | 자격 증명이 설정된 OAuth 제공자 목록. 인증 불요(`@Public`), `Cache-Control: private, max-age=300`. 비어 있으면 클라이언트가 소셜 로그인 UI 를 숨긴다 |
| GET | `/api/auth/oauth/:provider` | OAuth 시작. 쿼리 `mode`(`login` · `register`)와 `rememberMe` 를 state 와 함께 저장하고 제공자로 리다이렉트한다. `mode` 가 `register` 가 아니면 `login` 으로 본다. 복귀 경로는 받지 않는다([세션과 토큰 「소셜 로그인의 복귀 경로」](CLE-ACCT-SESSION.md#소셜-로그인의-복귀-경로)) |
| GET | `/api/auth/oauth/:provider/callback` | OAuth 콜백. 성공과 실패 모두 프론트엔드 `/callback` 으로 리다이렉트한다 |

### 이메일 변경

모두 JWT 인증이 필요하다. `users.controller.ts` 가 받아 `AuthService` 로 넘긴다.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/users/me/email-change/request` | 이메일 변경 시작. 본문 `{ newEmail, password? \| totpCode? }`. 계정 재인증 필수(비밀번호 또는 등록 TOTP, Passkey 로 하는 계정 재인증은 미지원). 비밀번호도 TOTP 도 없는 계정은 Passkey 가 있어도 403 `REAUTH_NOT_AVAILABLE`. 새 이메일 형식·중복 검증 뒤 새 이메일로 1시간짜리 확인 메일을 보낸다. 분당 5회 |
| POST | `/api/users/me/email-change/verify` | 이메일 변경 확인. 본문 `{ token }`. 토큰을 검증한 뒤 `email` 교체, `email_verified=true`, 모든 로그인 세션 무효화, 현재 기기 재발급(`{ accessToken }` 과 리프레시 쿠키 회전), 옛 이메일 통지, 감사 로그 `user.email_changed`. 토큰 무효·만료 400 `VALIDATION_ERROR`, 새 이메일 선점 409 `RESOURCE_CONFLICT` |
| POST | `/api/users/me/email-change/resend` | 확인 메일 재발송. 대기 중인 새 이메일로 토큰을 다시 발급한다. 분당 5회. 대기 중 변경이 없으면 400 `VALIDATION_ERROR` |
| POST | `/api/users/me/email-change/cancel` | 진행 중인 이메일 변경 취소. 대기 필드를 NULL 로 지운다. 계정 재인증 불요, 대기 중 변경이 없어도 멱등 |

### 에러 코드

| 코드 | HTTP | 상황 |
| --- | --- | --- |
| `LOGIN_FAILED` | 401 | 로그인 실패. 없는 이메일, 비밀번호가 없는 계정(OAuth 전용), 비밀번호 불일치를 같은 코드와 같은 메시지로 거부한다. 이메일로 계정을 하나로 정할 수 없는 경우([이메일 비교 규칙](CLE-ACCT-SIGNIN-SIGNUP.md#이메일-비교-규칙))도 없는 이메일과 같다. 로그인 이력 `failure_reason` 에는 각각 `USER_NOT_FOUND` · `PASSWORD_NOT_SET` · `INVALID_PASSWORD` 가 남는다([계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md)). 비밀번호가 맞는 이메일 인증 전 계정은 `EMAIL_VERIFICATION_REQUIRED` 다 |
| `EMAIL_VERIFICATION_REQUIRED` | 401 | 비밀번호는 맞지만 이메일 인증을 마치지 않은 계정의 로그인. 비밀번호가 틀리면 `LOGIN_FAILED` 다. 로그인 이력 `failure_reason` 은 `EMAIL_NOT_VERIFIED` 다. 비밀번호가 맞았으므로 실패 횟수(`login_attempts`)는 0 으로 되돌린다. 화면은 이 코드로 이메일 인증 안내를 고른다([로그인 처리](CLE-ACCT-SIGNIN-LOGIN.md#로그인-처리)) |
| `ACCOUNT_LOCKED` | 401 | 잠긴 계정으로 로그인 |
| `VALIDATION_ERROR` | 400 | 재설정·이메일 변경 토큰 만료·무효, 재설정의 새 비밀번호 길이·강도 미달, 새 이메일 형식 에러·현재 이메일과 같음, 대기 중 변경 없이 재발송, TOTP 설정 시작 본문의 `password` 누락이나 형식 에러, TOTP 활성화 검증 본문의 `code` 형식 에러, TOTP 끄기 본문의 `password`·`code` 누락이나 형식 에러, Passkey 등록 옵션 본문의 `password` 누락이나 형식 에러, Passkey 표시 이름 형식 에러(코드 포인트 100개 초과 · NUL 문자, 이름 변경의 빈 이름 · 공백 문자로만 된 이름) |
| `RESOURCE_CONFLICT` | 409 | 가입 이메일 중복, 새 이메일 선점 |
| `REAUTH_NOT_AVAILABLE` | 403 | 계정 재인증 수단이 없는 계정(비밀번호도 TOTP 도 없음. Passkey 등록에 비밀번호 재확인이 생기기 전에 Passkey 만 등록한 OAuth 전용 계정 포함)의 이메일 변경. 서버 메시지는 비밀번호를 설정하거나 TOTP 를 켜라고 안내한다. Passkey 만 등록한 계정도 같은 메시지를 받는다. 지금 구현의 문구는 한국어라 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 규칙 3 에 어긋나는 기존 문구다. 영문 전환은 NERV Task `CLE-T-1K5CWP` 가 맡는다 |
| `PASSWORD_REQUIRED`, `PASSWORD_INVALID` | 401 | TOTP 설정 시작·2단계 인증 끄기·Passkey 등록 옵션·Passkey 복구 코드 재발급의 비밀번호 재확인 실패. Passkey 등록 옵션은 이때 등록 옵션과 `optionsToken` 을 만들지 않는다. 정의는 [세션과 토큰](CLE-ACCT-SESSION.md) |
| `TOTP_INVALID` | 401 | 로그인 TOTP 검증 실패, TOTP 활성화 검증의 코드 불일치(확인한 뒤 다른 설정 시작이 secret 을 바꾼 경우 포함), TOTP 끄기의 코드 불일치(TOTP 가 꺼져 있을 때 포함). 계정 재인증과 같은 코드를 쓴다 |
| `TOTP_NOT_ENABLED` | 401 | 로그인 2단계 TOTP 검증(`POST /api/auth/login/totp`)에서 사용자가 없거나 TOTP 가 꺼져 있다. Passkey 만 등록하고 TOTP 를 켜지 않은 계정도 이 코드다. 메시지는 다시 로그인하라고 안내한다 |
| `TOTP_NOT_INITIALIZED` | 400 | TOTP 활성화 검증(`POST /api/auth/2fa/verify`)을 설정 시작(`POST /api/auth/2fa/setup`) 없이 불러 secret 이 없거나, 설정 시작 뒤 10분이 지나 대기 secret 을 버렸다(설정 시작 시각이 없는 대기 secret 포함). 화면은 처음부터 다시 시작하라고 안내하고 설정 시작 단계로 돌아간다 |
| `TOTP_ALREADY_ENABLED` | 409 | TOTP 가 이미 켜진 계정의 설정 시작(`POST /api/auth/2fa/setup`)과 활성화 검증(`POST /api/auth/2fa/verify`). secret 과 TOTP 복구 코드를 바꾸지 않는다. 바꾸려면 [TOTP 끄기](CLE-ACCT-SIGNIN-TOTP.md#totp-끄기) 뒤 다시 켠다. 화면은 이 코드를 받으면 사용자 정보를 다시 읽어 켜진 상태로 그린다 |
| `WEBAUTHN_DISABLED` | 503 | Passkey 기능이 꺼져 있다. 가용성 조회와 credential 목록 조회를 뺀 Passkey 엔드포인트와, Passkey 만 등록하고 TOTP 가 꺼진 계정의 로그인(`POST /api/auth/login`)이 이 코드다. 운영자가 설정을 바꿀 때까지 회복되지 않으므로 재시도 대상이 아니다([HTTP API 규약](../CLE-API/CLE-API-CONV.md) 규칙 11) |
| `SERVICE_UNAVAILABLE` | 503 | 로그인 2단계 Passkey 인증 검증에서 Passkey 인증 챌린지를 기록하지 못함(Redis 연결 · 명령 실패, [Passkey 인증 챌린지 기록](CLE-ACCT-SIGNIN-PKAUTH.md#passkey-인증-챌린지-기록)). 서명과 counter 를 판정하지 않는다 |
| `WEBAUTHN_VERIFY_FAILED` | 400 | Passkey 등록 검증 실패. 허용 목록 밖 알고리즘의 공개 키와 형식이 틀린 transport 목록(문자열 배열이 아니거나 NUL 문자가 든 경우)도 이 코드다 |
| `INVALID_OPTIONS_TOKEN` | 400 | `optionsToken` 무효 |
| `CHALLENGE_INVALID` | 401 | 로그인 2단계 챌린지 토큰이 만료 · 위조됐거나 챌린지 토큰이 아님. TOTP 검증과 Passkey 옵션 · 검증 · 복구 코드가 함께 쓴다 |
| `CHALLENGE_METHOD_MISMATCH` | 401 | TOTP 챌린지(`methods: ['totp']`)로 받은 챌린지 토큰을 Passkey 옵션 · 검증 · 복구 코드에 보냄 |
| `WEBAUTHN_INVALID` | 401 | Passkey 인증 실패. 서명이 맞지 않는 응답과 이미 쓴 Passkey 인증 챌린지로 온 검증도 이 코드이고 credential 을 지우지 않는다. counter 역행은 아래 `WEBAUTHN_COUNTER_REGRESSION` 이다 |
| `WEBAUTHN_COUNTER_REGRESSION` | 401 | 처음 쓰는 Passkey 인증 챌린지로 온 인증 응답이 서명 검증을 통과했는데 sign counter 가 저장값 이하로 돌아감(둘 다 0 이면 역행이 아니다). 그 credential 을 지우고 리프레시 토큰을 모두 무효화한 뒤 거부한다([sign counter 역행과 동시성](CLE-ACCT-SIGNIN-PKAUTH.md#sign-counter-역행과-동시성)) |
| `WEBAUTHN_REQUIRED` | 401 | TOTP 가 켜져 있고 Passkey 도 등록된 계정이 TOTP 로 로그인 2단계를 통과하려 함(`POST /api/auth/login/totp`). Passkey 만 있는 계정은 `TOTP_NOT_ENABLED` 를 받는다. Passkey 기능이 꺼져 있으면 나지 않는다 |
| `WEBAUTHN_CREDENTIAL_NOT_FOUND` | 404 · 401 | 등록한 Passkey 의 이름 변경 · 삭제에서 대상 credential 이 없거나 내 것이 아니면 404 다. 로그인 2단계 Passkey 검증에서 응답의 credential 이 그 사용자의 것이 아니면 지금은 401 이다. 이 401 은 `WEBAUTHN_INVALID` 로 옮기기로 정했고 아직 구현하지 않았다(NERV Task `CLE-T-ZPPWK4`). 구현되면 이 코드는 404 하나만 남는다 |
| `RECOVERY_CODE_INVALID` | 401 | Passkey 복구 코드 불일치 |
| `OAUTH_STATE_MISMATCH` | 400 | OAuth state 없음·만료·이미 소비, 다른 제공자가 발급한 state. 로그인 콜백에서는 컨트롤러가 이 응답 대신 `?error=invalid_state` 로 리다이렉트한다([에러 처리](CLE-ACCT-SIGNIN-LOGIN.md#에러-처리)) |

전체 카탈로그와 등재 규칙은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 가 정한다.


## Rationale

### 에러 코드 표와 응답 표기를 구현에 맞췄다 (2026-10-17)

NERV Task `CLE-T-D331TT` 에서 바로잡았다. 동작은 바꾸지 않았다.

- **발행하는데 표에 없던 코드**: `LOGIN_FAILED` · `CHALLENGE_METHOD_MISMATCH` · `WEBAUTHN_COUNTER_REGRESSION` · `WEBAUTHN_REQUIRED` 를 에러 코드 표에 더했다. counter 역행은 구현대로 `WEBAUTHN_COUNTER_REGRESSION` 이다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 는 `WEBAUTHN_INVALID` 로 적었었다). 이메일 인증 전 계정은 사람 결정으로 새 코드 `EMAIL_VERIFICATION_REQUIRED` 로 나눴다([이메일 인증 전 계정은 비밀번호가 맞을 때만 알린다](CLE-ACCT-SIGNIN-LOGIN.md#이메일-인증-전-계정은-비밀번호가-맞을-때만-알린다-2026-10-17)). `WEBAUTHN_REQUIRED` 는 구현대로 좁혔다. TOTP 가 꺼진 계정은 Passkey 가 있어도 먼저 `TOTP_NOT_ENABLED` 를 받는다.
- **계정 재인증 수단 없음의 조건**: 구현(`SessionsService.verifyReauth`)은 비밀번호와 TOTP 만 보므로 조건을 "비밀번호도 TOTP 도 없는 계정" 으로 고쳤다. Passkey 만 등록한 계정도 막힌다.
- **재설정 실패의 구분**: `details` 유무를 판별 규칙으로 적는 안은 에러 코드 규약(규칙 4 · 6)과 어긋나 기각하고 현재 동작만 적은 뒤 코드를 나눌지는 미결로 올렸다([가입 · 재설정 · 이메일 변경 「미결 사항」](CLE-ACCT-SIGNIN-SIGNUP.md#미결-사항)).
- **응답 봉투 표기**: [API](#api) 첫머리에 봉투를 뺀 내용으로 적는다는 규칙을 두고 봉투째 적은 곳을 고쳤다.
- **counter 역행 뒤의 Passkey 복구 코드**: 역행 삭제는 복구 코드를 비우지 않는 지금 동작을 [복구 코드](CLE-ACCT-SIGNIN-TOTP.md#복구-코드) 에 적었다.
- **`WEBAUTHN_DISABLED` 범위**: 가용성 조회는 기능이 꺼져도 200 `{ enabled: false }` 라는 예외를 적었다.
- **counter 0 경계**: 저장값과 응답 값이 모두 0 이면 역행이 아니라고 라이브러리 판정에 맞췄다. 2026-10-30 부터는 서비스가 같은 식으로 직접 비교한다([역행은 서명 검증을 통과한 응답에서만 판정한다](CLE-ACCT-SIGNIN-PKAUTH.md#역행은-서명-검증을-통과한-응답에서만-판정한다-2026-10-30)).
- **날짜가 붙은 Rationale 의 정정**: transport 목록 결정의 고치기 전 동작을 "일부만 500, `null` 은 200" 으로 바로잡았다. 감사 details 결정의 "그 세션 워크스페이스" 를 "변경을 확정한 요청의 현재 워크스페이스" 로 고쳤다(뜻은 같다).

### 승인본 정합 경고를 정리했다 (2026-11-05)

NERV Task `CLE-T-693G4E` 에서 결정은 바꾸지 않고 표현과 범위 설명만 고쳤다. credential 목록 조회의 200 빈 목록 예외를 요구사항 · 켜기 표 · API 표 · 에러 코드 표에 적었다. 옵션 토큰 챌린지를 테이블에 두지 않는다는 문장을 발급 시점으로 좁혔다. 2단계 인증을 건너뛰지 않는다는 근거가 비밀번호 로그인에만 해당한다고 적었다. 이메일 인증 전 계정 결정이 숨기는 것은 인증 상태라고 적었다. 미결 사항에 로그인 응답 시간, 복구 코드 소비의 원자성, 미등재 코드 `WEBAUTHN_NOT_REGISTERED` 를 더했다. 2단계 인증 방식 선택 플로차트의 겹친 분기를 합쳤다. Passkey 표시 이름의 `null` 허용과 ZWJ 풀이, 23505 처리 근거를 적었다. 초대 토큰 가입 행에 초대 에러 코드 링크를 더했다.

하지 않은 것: `REAUTH_NOT_AVAILABLE` 조건을 한 곳으로 모으는 일(다섯 문서에 걸쳐 범위가 크다), 600자가 넘는 표 셀 정리(이 문서 밖), 표시 이름 규칙이 여러 곳에 나뉜 것을 합치는 일(NERV 버전 이력에 맡긴다), [오류 화면과 빈 상태](../CLE-UI/CLE-UI-ERRORS.md) 의 5xx 페이지 범위([에러 응답과 클라이언트 처리 「미결 사항」](../CLE-API/CLE-API-ERROR.md#미결-사항) 에 맡긴다), [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 쪽 문장(별도 초안).
