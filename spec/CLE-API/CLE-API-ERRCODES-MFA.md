---
id: "CLE-API-ERRCODES-MFA"
title: "에러 코드 카탈로그 — 2FA · Passkey · 재인증"
type: "convention"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-ERRCODES"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-ERRCODES"]
area: "CLE-API"
content_hash: "885c97ef305860f5be4933258106fb216a6736b6998f788fd3c1f597aaab0751"
read_as: "approved_fallback"
task: "CLE-T-GWC9M3"
source_paths: []
mirror_sha256: "e15dae7acb5826524179bbc83b40d3adc72ae05c0d965eba2170b88406e62de6"
etag: "sha256-b08bf7e6350fc8e4a41b65dc69a28de2c9122bb1e236e538efd161d4939501df"
---
## 개요

이 문서는 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 의 하위 문서로 카탈로그 가운데 2FA · WebAuthn · 계정 재인증 · 비밀번호 재확인 코드(§6.3)와 로그인 2단계 코드의 결정을 정한다.

## 6.3 2FA·WebAuthn·계정 재인증·비밀번호 재확인 (도메인 문서 참조)

2FA(TOTP, WebAuthn/Passkey), 계정 재인증, 비밀번호 재확인 흐름이 함께 쓰는 코드다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `WEBAUTHN_DISABLED` | 503 | Passkey 기능이 꺼져 있을 때(환경 변수 미설정이고 폴백을 허용하지 않음) 가용성 조회(`GET /api/auth/2fa/webauthn/availability`)와 credential 목록 조회(`GET /api/auth/2fa/webauthn/credentials`)를 뺀 Passkey 엔드포인트 전체가 돌려준다. 목록 조회는 200 빈 목록이다. 로그인(`POST /api/auth/login`)도 Passkey 만 등록하고 TOTP 가 꺼진 계정이 로그인 1단계를 통과하면 이 코드로 거부한다. 운영자가 설정을 바꿀 때까지 회복되지 않으므로 재시도 대상이 아니다. 일시 장애가 아닌데 `503` 을 쓰는 예외는 [HTTP API 규약](CLE-API-CONV.md) 규칙 11 에 있다 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-기능-켜기와-환경-변수) |
| `WEBAUTHN_VERIFY_FAILED` | 400 | Passkey 등록 검증 실패. 허용 목록 밖 알고리즘의 공개 키와 형식이 틀린 transport 목록(문자열 배열이 아니거나 NUL 문자가 든 경우)도 이 코드다. 표시 이름(`deviceName`) 형식 에러는 이 코드가 아니라 `VALIDATION_ERROR`(§6.4)다 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `WEBAUTHN_CREDENTIAL_EXISTS` | 409 | Passkey 등록 검증(`POST /api/auth/2fa/webauthn/register/verify`)에서 같은 credential ID 가 이미 저장돼 있음. 같은 credential 을 동시에 등록해 UNIQUE 제약에 걸린 경우도 이 코드다. credential 과 복구 코드를 저장하지 않는다 | [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN-API.md#에러-코드) |
| `WEBAUTHN_NOT_REGISTERED` | 400 · 403 | 등록한 Passkey 가 없는 사용자의 요청. 로그인 2단계 Passkey 옵션(`POST /api/auth/2fa/webauthn/authenticate/options`)은 400, Passkey 복구 코드 재발급(`POST /api/auth/2fa/webauthn/recovery-codes/regenerate`)은 비밀번호 확인 뒤 403 이다. 상태 코드는 달라도 뜻이 같아 한 행에 둔다 | [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN-API.md#에러-코드) |
| `INVALID_OPTIONS_TOKEN` | 400 | WebAuthn register·verify 의 optionsToken(짧은 수명의 서명 토큰) 무효 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `CHALLENGE_INVALID` | 401 | 로그인 2단계의 챌린지 토큰(`challengeToken`, `mfa_challenge` JWT)이 만료 · 위조됐거나 2단계용 토큰이 아님. TOTP 검증(`POST /api/auth/login/totp`)과 Passkey 옵션 · 검증 · 복구 코드 경로가 함께 쓴다 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `CHALLENGE_METHOD_MISMATCH` | 401 | 로그인 2단계에서 챌린지 토큰(`challengeToken`)이 정한 방식과 다른 경로를 부름. TOTP 챌린지(`methods: ['totp']`)로 받은 토큰을 Passkey 옵션 · 검증 · 복구 코드 경로에 보낸 경우다 | [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) |
| `WEBAUTHN_INVALID` | 401 | Passkey 로그인 2단계 검증 실패. 서명이 맞지 않는 응답과 이미 쓴 Passkey 인증 챌린지(`optionsToken` 의 `challenge`)로 온 검증도 이 코드이고 credential 을 지우지 않는다. 응답의 credential 이 그 사용자의 것이 아닐 때(없는 credential 포함)도 이 코드다. counter 역행은 별도 코드 `WEBAUTHN_COUNTER_REGRESSION` 이다 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `WEBAUTHN_COUNTER_REGRESSION` | 401 | Passkey 로그인 2단계에서 처음 쓰는 Passkey 인증 챌린지로 온 응답이 서명 검증을 통과했는데 인증기의 sign counter 가 저장값 이하로 돌아감(저장값과 응답 값이 모두 0 이면 역행이 아니다). 서버가 그 credential 을 지우고 사용자의 리프레시 토큰을 모두 무효화한 뒤 이 코드로 거부한다. 로그인 이력 `failure_reason` 에는 같은 이름의 사유값이 남는다 | [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) |
| `WEBAUTHN_REQUIRED` | 401 | TOTP 가 켜져 있고 Passkey 도 등록된 계정이 로그인 2단계 TOTP 검증(`POST /api/auth/login/totp`)을 부름. Passkey 가 있으면 TOTP 로 로그인할 수 없다. TOTP 가 꺼진 계정은 Passkey 가 있어도 먼저 `TOTP_NOT_ENABLED` 를 받는다. Passkey 기능이 꺼져 있으면 TOTP 로 로그인하므로 나지 않는다 | [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) |
| `WEBAUTHN_CREDENTIAL_NOT_FOUND` | 404 | 등록한 Passkey 의 이름 변경(`PATCH /api/auth/2fa/webauthn/credentials/:id`)이나 삭제(`POST /api/auth/2fa/webauthn/credentials/:id/delete`)에서 대상 credential 이 없거나 호출자의 것이 아님. 둘을 구분하지 않는다(존재 노출 방지). 삭제는 비밀번호를 확인한 뒤에 대상을 찾는다 | [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) |
| `RECOVERY_CODE_INVALID` | 401 | WebAuthn 복구 코드로 2FA 통과 실패 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `REAUTH_NOT_AVAILABLE` | 403 | 비밀번호 해시도 TOTP 도 없는 OAuth 전용 계정이라 계정 재인증 수단이 없음. Passkey 만 등록한 계정도 여기에 든다. 이메일 변경과 로그인 세션 강제 종료의 계정 재인증이 함께 쓴다 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) |
| `REAUTH_REQUIRED` | 400 | 계정 재인증 자격 증명이 없거나 부족함(비밀번호와 TOTP 어느 것도 검증할 수 없음. 비밀번호가 없는 계정에 비밀번호만 보낸 경우 포함) | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) |
| `PASSWORD_INVALID` | 401 | 비밀번호 재확인 **불일치**. 계정 재인증(`verifyReauth`), TOTP 설정 시작·2FA 비활성화·Passkey 등록 옵션(`POST /api/auth/2fa/webauthn/register/options`)·Passkey 복구 코드 재발급·Passkey 삭제(`POST /api/auth/2fa/webauthn/credentials/:id/delete`)의 재확인(`verifyPasswordForUser`), 비밀번호 변경이 함께 쓴다 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) |
| `PASSWORD_REQUIRED` | 401 | 비밀번호가 **설정되지 않았거나(OAuth 전용) 입력되지 않음**. TOTP 설정 시작·2FA 비활성화·Passkey 등록 옵션(`POST /api/auth/2fa/webauthn/register/options`)·Passkey 복구 코드 재발급·Passkey 삭제 같은 민감 동작의 `verifyPasswordForUser` 재확인과 비밀번호 변경이 함께 쓴다. 이 다섯 민감 동작의 라우트에서는 본문 검증이 미입력을 먼저 400 `VALIDATION_ERROR` 로 거른다. 그래서 그 라우트가 내는 `PASSWORD_REQUIRED` 는 계정에 비밀번호가 없다는 뜻이다. 불일치는 형제 코드 `PASSWORD_INVALID` 다. 계정 재인증의 입력 누락 `REAUTH_REQUIRED`(400, `verifyReauth`)와는 발행 헬퍼도 상태 코드도 다른 별개 코드다 | [세션과 토큰 「본인 확인 에러 코드」](../CLE-ACCT/CLE-ACCT-SESSION.md#본인-확인-에러-코드) |
| `TOTP_INVALID` | 401 | TOTP 코드 불일치. 계정 재인증, 로그인 2FA, TOTP 활성화 검증(`POST /api/auth/2fa/verify`), 2FA 비활성화(`POST /api/auth/2fa/disable`)가 함께 쓴다. 로그인 2FA 와 2FA 비활성화는 6자리 TOTP 코드나 TOTP 복구 코드를 받고 둘 다 맞지 않으면 이 코드다. 2FA 비활성화는 2FA 가 켜져 있지 않을 때도 이 코드를 낸다. TOTP 활성화 검증은 코드를 확인한 뒤 저장하기 전에 다른 TOTP 설정 시작 요청이 secret 을 바꾼 경우에도 이 코드를 내고 TOTP 를 켜지 않는다 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md), [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) |
| `TOTP_NOT_ENABLED` | 401 | 로그인 2FA 챌린지(`AuthService.loginWithTotp`)에서 계정의 TOTP 가 꺼져 있거나 사용자가 없음. Passkey 만 등록하고 TOTP 를 켜지 않은 계정도 이 코드다. 로그인 2FA 챌린지 전용이고 클라이언트는 다시 로그인하게 안내한다. 2FA 비활성화에서 2FA 가 꺼져 있을 때는 이 코드가 아니라 `TOTP_INVALID` 다 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `TOTP_NOT_INITIALIZED` | 400 | TOTP 활성화 검증(`POST /api/auth/2fa/verify`, `TotpService.verifyAndEnable`)에서 사용자가 없거나 TOTP secret 이 없음. TOTP 설정 시작(`POST /api/auth/2fa/setup`)을 거치지 않고 활성화 검증을 부른 경우다. 설정 시작 뒤 10분이 지나 [대기 중인 TOTP secret](../CLE-ACCT/CLE-ACCT-SIGNIN.md#totp-켜기) 이 만료된 경우도 이 코드다. 이때 서버는 그 secret 과 설정 시작 시각을 비우고 인증 코드를 확인하지 않는다. 설정 시작 시각이 없는 대기 secret 도 만료로 본다. 클라이언트는 만료 안내를 보이고 설정 시작 단계로 돌아간다 | [가입과 로그인 「TOTP 켜기」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#totp-켜기) |
| `TOTP_ALREADY_ENABLED` | 409 | TOTP 가 이미 켜진 계정의 설정 시작(`POST /api/auth/2fa/setup`)과 활성화 검증(`POST /api/auth/2fa/verify`). secret 과 TOTP 복구 코드를 바꾸지 않는다. 바꾸려면 TOTP 를 끄고 다시 켠다 | [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) |

- 이 표는 도메인 문서 본문에 문서화된 코드만 등재한다.
- 로그인 실패 자체는 `LOGIN_FAILED`(§6.2)로 돌려준다(`PASSWORD_INVALID` 아님). 감사 기록은 `login_history` 의 `event`(`totp_failed` 등 소문자 값)와 `failure_reason`(`TOTP_INVALID`, `INVALID_PASSWORD` 등 대문자 사유값)에 남는다([계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md)). 사유값과 응답 에러 코드는 별개 층이다. `TOTP_INVALID` · `WEBAUTHN_COUNTER_REGRESSION` 처럼 이름이 같은 값도 있고 `INVALID_PASSWORD` 처럼 응답에서는 다른 코드(`LOGIN_FAILED`)로 나가는 값도 있다. 알 수 없는 이메일로 로그인하면 `failure_reason` 은 `USER_NOT_FOUND` 이고 응답은 `LOGIN_FAILED`(401)다(`auth.service.ts`).
- **비슷한 이름 주의**: 비밀번호 재확인 계열 에러 코드는 셋이다(`PASSWORD_INVALID`, `PASSWORD_REQUIRED`, `REAUTH_REQUIRED`). 옛 `INVALID_PASSWORD` 는 2026-09-02 에 은퇴해 응답에 나가지 않는다(§5). 접미사가 같은 `WEBAUTHN_REQUIRED`(§6.3)는 이 계열이 아니다. 입력이 빠진 것이 아니라 TOTP 와 Passkey 가 모두 있는 계정의 TOTP 로그인을 막는 코드다. 로그인의 `EMAIL_VERIFICATION_REQUIRED`(§6.2)는 응답 에러 코드다. `EMAIL_NOT_VERIFIED` 는 같은 경우에 로그인 이력 `failure_reason` 에 남는 사유값이고 응답에는 나가지 않는다.
- **비슷한 이름 주의(TOTP 상태 코드)**: TOTP 상태 때문에 거부하는 코드는 셋이고 클라이언트가 할 일이 서로 다르다. `TOTP_ALREADY_ENABLED`(409)는 TOTP 가 이미 켜진 계정의 TOTP 설정 시작 · 활성화 검증이다. 클라이언트는 입력을 고치지 않고 켜진 상태를 다시 읽는다. `TOTP_NOT_ENABLED`(401)는 로그인 2단계 TOTP 검증 전용이고 클라이언트는 다시 로그인하게 안내한다. `TOTP_NOT_INITIALIZED`(400)는 대기 secret 없이(설정 시작 전이거나 10분이 지나 버림) 활성화 검증을 부른 경우이고 클라이언트는 설정 시작 단계로 돌아간다. 코드 불일치는 셋 가운데 어느 것도 아니고 `TOTP_INVALID`(401)다.
- **2FA 비활성화**: `POST /api/auth/2fa/disable` 의 인증 코드 실패는 새 코드 없이 `TOTP_INVALID`(401)를 쓴다. 확인 순서, 복구 코드 소비, 로그인 이력에 남기지 않는 규칙은 [가입과 로그인 「TOTP 끄기」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#totp-끄기) 가 정한다.

## Rationale

### 2FA 비활성화 실패에 기존 코드를 쓴다 (2026-10-10)

2026-10-10 에 2FA(TOTP) 비활성화가 비밀번호와 인증 코드를 함께 받게 됐다(NERV Task `CLE-T-75TDTN`). 인증 코드가 틀리면 새 코드 없이 `TOTP_INVALID` 를 쓴다. 확인 순서와 코드 선택의 근거는 [가입과 로그인 「TOTP 끄기」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#totp-끄기) 와 같은 문서의 「TOTP 끄기에 비밀번호와 인증 코드를 함께 받는다」 Rationale 이 정한다.

그 Rationale 에 없는 기각 대안 하나는 여기 남긴다.

- TOTP 복구 코드 불일치에 `RECOVERY_CODE_INVALID` 를 쓴다: 그 코드는 Passkey 복구 코드의 실패 코드다. 비활성화는 입력란 하나로 TOTP 코드와 TOTP 복구 코드를 함께 받으므로 어느 쪽이 틀렸는지 가르지 않는다. 로그인 2FA 도 같다.

### 로그인 2단계에서 발행하던 미등재 코드 셋을 등재했다 (2026-10-17)

NERV Task `CLE-T-D331TT` 에서 바로잡았다. `WEBAUTHN_COUNTER_REGRESSION` · `CHALLENGE_METHOD_MISMATCH` · `WEBAUTHN_REQUIRED` 는 모두 401 로 발행되고 있었다. 그런데 §6.3 에도 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) 의 에러 코드 표에도 없었다. 규칙 8 위반이다.

- 도메인 문서에 먼저 적고 이 표에 등재했다. 세 이름 모두 조건의 뜻을 적고 있어 규칙 1 에 맞는다.
- `WEBAUTHN_INVALID` 행은 counter 역행도 이 코드에 든다고 적었다. 구현은 counter 역행에 응답 코드 `WEBAUTHN_COUNTER_REGRESSION` 을 돌려준다. 로그인 이력의 사유값과 같은 이름이다. 그래서 행을 구현에 맞췄다. counter 역행이면 서버가 그 credential 을 지우므로 사용자가 할 일이 다르다. 같은 Passkey 로는 다시 로그인할 수 없고 Passkey 를 다시 등록해야 한다. 그래서 별개 조건으로 본다(규칙 6).
- 이 Task 본문은 등재와 구현 변경 두 안을 올렸다. 구현 변경은 counter 역행의 응답 코드를 `WEBAUTHN_INVALID` 로 합치는 안이다. 등재를 골랐다. 구현이 처음부터 이 코드를 내보내므로 이름을 바꾸면 규칙 5 에 어긋난다. 이 응답은 비밀번호 확인을 통과해 챌린지 토큰을 받은 호출자에게만 간다. 그 호출자가 더 알게 되는 것은 방금 쓴 credential 이 역행으로 지워졌다는 사실이다. 이 코드는 처음 쓰는 Passkey 인증 챌린지에 서명이 맞는 응답에만 나간다([가입과 로그인 「역행은 서명 검증을 통과한 응답에서만 판정한다」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#역행은-서명-검증을-통과한-응답에서만-판정한다-2026-10-30)). 그래서 이 사실을 알게 되는 쪽은 인증기를 가진 사람이나 인증기를 복제한 사람뿐이다. 복제한 쪽은 들켰다는 것을 알게 되지만 그 credential 은 이미 지워져 더 쓸 수 없다. 이 노출은 받아들이고 코드를 그대로 둔다(NERV Task `CLE-T-693G4E`).
- §6.3 끝 불릿은 사유값과 응답 코드를 「별개 층」 으로 적는다. 「사유값은 응답 코드가 아니다」 라고 쓰지 않은 것은 `TOTP_INVALID` 처럼 사유값과 응답 코드의 이름이 같은 경우가 전부터 있었기 때문이다. 그 이름은 바꾸지 않았다(규칙 5).
- §5 `INVALID_PASSWORD` 행은 새 코드 `PASSWORD_NOT_SET` 을 만들지 않은 이유로 감사 사유값과의 이름 충돌을 들었다. 이번 등재와 어긋나 보이지만 두 판단은 대상이 다르다. 그 행은 새 이름을 만들지 말지를 정했고 이번 등재는 이미 발행 중인 `WEBAUTHN_COUNTER_REGRESSION` 을 다뤘다. 발행 중인 이름은 사유값과 같아도 규칙 5 로 바꾸지 않는다. 사유값과 겹치는 이름을 피할지는 규칙 1~10 에 없고 새 코드를 만들 때마다 따진다. 2026-09-02 결정은 바뀌지 않았다.
- `LOGIN_FAILED` 행에는 어떤 경우를 이 코드로 거부하는지 적지 않았다. 그 목록은 정의 문서인 [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) 한 곳에 둔다(규칙 8). 이메일 인증 전 계정의 로그인 응답은 아래 「로그인 결정 셋을 카탈로그에 옮겼다」 에 적었다.

### 로그인 결정 셋을 카탈로그에 옮겼다 (2026-10-17)

NERV Task `CLE-T-D331TT` 에서 사람이 정한 로그인 결정 셋을 이 카탈로그에 옮겼다. 결정과 이유의 정본은 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) Rationale 이다. 셋 다 구현됐다(NERV Task `CLE-T-GK9J2B` · `CLE-T-AYT4VB` · `CLE-T-RFSJXQ`).

- **이메일 인증 전 계정**: 비밀번호가 맞을 때만 새 코드 `EMAIL_VERIFICATION_REQUIRED`(401)로 알린다. 처음에는 발행하지 않아 §6.2 표 아래 문장에 적었고 구현과 함께 표에 등재했다(규칙 9). 사용자가 할 일이 자격 증명 확인과 달라 규칙 6 의 새 조건이다. 규칙 6 단서(다른 워크스페이스의 리소스가 드러나는 조건)에는 해당하지 않는다. 이 응답은 비밀번호가 맞을 때만 나서 비밀번호를 모르는 사람에게 계정 상태를 드러내지도 않는다. 클라이언트는 이 코드로 안내 문구를 고른다(규칙 4). 이름은 감사 사유값 `EMAIL_NOT_VERIFIED` 와 겹치지 않게 골랐다. 처음 초안은 `LOGIN_FAILED` 에 메시지만 다르게 두었다. 그러면 규칙 4 · 6 과 어긋나 사람이 다시 정했다. `LOGIN_FAILED` 행의 「잘못된 자격 증명」 은 그대로 맞다([가입과 로그인 「이메일 인증 전 계정은 비밀번호가 맞을 때만 알린다」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#이메일-인증-전-계정은-비밀번호가-맞을-때만-알린다-2026-10-17)).
- **Passkey 기능이 꺼졌을 때의 로그인**: Passkey 만 등록하고 TOTP 가 꺼진 계정의 로그인도 `WEBAUTHN_DISABLED`(503)를 받는다. 그래서 그 행에 로그인을 더하고 `WEBAUTHN_REQUIRED` 행의 이유를 고쳤다. 기능이 꺼지면 credential 을 0개로 본다는 이유는 이 결정으로 맞지 않게 됐다([가입과 로그인 「Passkey 기능이 꺼지면 Passkey 만 등록한 계정의 로그인을 막는다」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-기능이-꺼지면-passkey-만-등록한-계정의-로그인을-막는다-2026-10-17)).
- **Passkey 인증 챌린지**: 이미 쓴 챌린지와 서명이 틀린 응답은 `WEBAUTHN_INVALID` 이고 credential 을 지우지 않는다. `WEBAUTHN_COUNTER_REGRESSION` 은 처음 쓰는 챌린지에서 서명이 맞는 응답에만 난다. 새 코드는 만들지 않았다. 두 경우 모두 사용자가 할 일은 Passkey 로 다시 시도하는 것이라 `WEBAUTHN_INVALID` 의 뜻에 든다([가입과 로그인 「Passkey 인증 챌린지는 한 번만 쓴다」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-인증-챌린지는-한-번만-쓴다-2026-10-17)).

### 구현 반영 (2026-10-30, NERV Task `CLE-T-GK9J2B`)

- 로그인 2단계 Passkey 인증 검증은 Passkey 인증 챌린지를 기록하지 못하면 503 `SERVICE_UNAVAILABLE` 로 거부한다. 이 코드의 첫 발행처라 §6.1 행에 적었다.
- 상태 코드는 503 이다. [HTTP API 규약](CLE-API-CONV.md) 규칙 11 이 503 을 우리 인프라 의존성의 일시 장애에 쓴다고 정했고 Redis 는 우리 인프라다. 그래서 `WEBAUTHN_DISABLED` 처럼 규칙 11 의 예외로 적을 필요가 없다.
- 새 코드를 만들지 않았다. 카탈로그에 같은 뜻의 `SERVICE_UNAVAILABLE` 이 이미 있어 규칙 6 의 새 조건이 아니다.
- 저장소 장애를 `WEBAUTHN_INVALID` 로 합치지 않았다. 인증 실패와 인프라 장애는 뜻이 갈린다. 합치면 클라이언트가 다시 시도할지 판단할 수 없다(규칙 6).

### Passkey 등록 옵션의 비밀번호 재확인과 TOTP 대기 secret 만료에 기존 코드를 쓴다 (2026-11-02)

NERV Task `CLE-T-FRCRF7` 에서 사람이 정한 결정 세 건 가운데 코드 선택에 걸리는 둘을 §6.3 에 옮겼다. 동작과 근거의 정본은 [가입과 로그인 「Passkey 등록에도 비밀번호 재확인을 두고 TOTP 대기 secret 은 10분 뒤 버린다 (2026-11-02)」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-등록에도-비밀번호-재확인을-두고-totp-대기-secret-은-10분-뒤-버린다-2026-11-02) 다. 나머지 한 건은 비밀번호 재확인 라우트의 요청 빈도 제한이다. 한도를 넘으면 기존 `RATE_LIMITED`(429)를 쓰고 한도 수치는 [HTTP API 규약 「7. 요청 빈도 제한」](CLE-API-CONV.md#7-요청-빈도-제한) 이 정한다.

- **Passkey 등록 옵션**: 옵션을 만들기 전에 TOTP 설정 시작과 같은 `verifyPasswordForUser` 로 비밀번호를 다시 확인한다. 그래서 `PASSWORD_INVALID` · `PASSWORD_REQUIRED` 행의 발행처에 더했다. 새 코드는 만들지 않았다. 다른 민감 동작의 재확인과 뜻이 같고 클라이언트가 할 일도 같다. Passkey 기능이 꺼져 있으면 비밀번호를 확인하기 전에 `WEBAUTHN_DISABLED`(503)로 거부한다. Passkey 복구 코드 재발급도 같다.
- **TOTP 대기 secret 만료**: 설정 시작 뒤 10분이 지난 대기 secret 으로 활성화 검증을 부르면 서버가 그 secret 을 비우고 `TOTP_NOT_INITIALIZED`(400)로 거부한다. 응답 코드도 사람이 고른 안에 있었다. NERV 질문 `01a199f3-42c1-721b-a0d6-dc853234191a` 의 A안에 「400 `TOTP_NOT_INITIALIZED`(기존 코드)」 가 적혀 있다.
- **상태 코드는 기존 400 을 따른다.** 만료 조건을 더해도 이 코드의 기존 응답은 바꾸지 않는다. 상태 코드를 바꾸면 API 계약이 바뀐다. 이름 바꾸기를 막는 규칙 5 와 같은 이유다.
- **규칙 6 의 새 조건으로 보지 않았다.** 서버가 만료된 secret 을 비운 뒤의 상태는 설정을 시작하지 않은 상태와 같다. 사용자가 할 일도 설정 시작부터 다시 하는 것 하나다. 클라이언트는 설정 시작을 거친 뒤에만 활성화 검증을 부르므로 이 코드를 받으면 만료 안내를 보인다.

### Passkey 코드를 구현에 맞춰 고쳤다 (2026-11-14)

NERV Task `CLE-T-ZPPWK4` · `CLE-T-9KCQ7Y` · `CLE-T-Q6E11N` 에서 구현과 함께 §6.3 을 고쳤다.

- **로그인 검증의 401 을 `WEBAUTHN_INVALID` 로 옮겼다.** 2026-11-12 결정([웹훅 · 트리거 · 채팅 채널](CLE-API-ERRCODES-TRIGGER.md#404-가-아닌-_not_found-세-코드를-정리했다-2026-11-12))을 구현했다. 「(로그인 검증)」 행을 지워 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 는 404 한 행만 남았다. 메시지도 서명 실패와 같아서 응답으로는 두 경우를 구별할 수 없다.
- **발행 중이던 두 코드를 등재했다(규칙 8).** `WEBAUTHN_CREDENTIAL_EXISTS`(409)와 `WEBAUTHN_NOT_REGISTERED`(400 · 403)다. 이름과 상태 코드는 내던 그대로다(규칙 5). 같은 credential 의 동시 등록이 UNIQUE 제약에 걸릴 때 나던 409 `RESOURCE_CONFLICT` 는 `WEBAUTHN_CREDENTIAL_EXISTS` 로 맞췄다. 순차 중복과 뜻이 같다. [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 「미결 사항」 의 같은 항목은 지웠다.
- **`WEBAUTHN_NOT_REGISTERED` 는 상태 코드가 둘이어도 한 행에 둔다.** 두 발행처 모두 등록한 Passkey 가 없다는 뜻이라 규칙 6 으로 나누지 않는다. 상태 코드는 이미 내던 값이라 바꾸지 않았다.
- **Passkey 삭제에도 비밀번호를 다시 받는다.** 그래서 `PASSWORD_INVALID` · `PASSWORD_REQUIRED` 의 발행처가 하나 늘었다. 다른 민감 동작의 재확인과 뜻이 같아 새 코드는 만들지 않았다. 결정은 [Passkey 기능과 등록](../CLE-ACCT/CLE-ACCT-SIGNIN-PASSKEY.md#passkey-삭제에도-비밀번호-재확인을-둔다-2026-11-14) 에 있다.
