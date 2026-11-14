---
id: "CLE-ACCT-SIGNIN-TOTP"
title: "가입과 로그인 — 2단계 인증 설정과 TOTP"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ACCT-SIGNIN"
ancestors: ["CLE-VISION", "CLE-ACCT", "CLE-ACCT-SIGNIN"]
area: "CLE-ACCT"
content_hash: "67a7e3b6f6f2adfc9a0f695a6a6b3a605739cb9e8486b2ece42da882ada8c229"
read_as: "approved_fallback"
task: "CLE-T-Q6E11N"
source_paths: []
mirror_sha256: "7bedf102042e7cb43f3b1e850a916e83da266a44171199228a5c3d249d00fa91"
etag: "sha256-f21bd69ee5df68eb29a58cceae03a1b071b3347bdb527cf68c63f2dc14d1a7c8"
---
## 개요

이 문서는 [가입과 로그인](CLE-ACCT-SIGNIN.md) 의 하위 문서로 2단계 인증 수단의 구성, 보안 설정 화면, TOTP 켜기와 끄기, 복구 코드를 정한다. Passkey 의 기능 설정과 등록은 [Passkey 기능과 등록](CLE-ACCT-SIGNIN-PASSKEY.md), 로그인 2단계 화면은 [로그인과 소셜 로그인](CLE-ACCT-SIGNIN-LOGIN.md) 에 있다.

## 2단계 인증 수단

두 방식을 지원한다. 한 사용자가 둘 다 등록할 수 있고 등록은 서로 독립이다.

| 방식 | 설명 |
| --- | --- |
| TOTP | 인증 앱이 만드는 시간 기반 6자리 코드. Google Authenticator·Authy 같은 RFC 6238 클라이언트와 호환한다. 계정 비밀번호를 다시 확인한 뒤 QR 코드를 스캔하고 6자리 코드를 넣으면 켜진다. 켜진 동안에는 다시 설정할 수 없고 끈 뒤 다시 켠다([TOTP 켜기](#totp-켜기)). `two_factor_enabled` 는 TOTP 사용 여부만 뜻한다 |
| Passkey·보안 키 | FIDO2·WebAuthn 표준. `@simplewebauthn/server` 와 `@simplewebauthn/browser` 로 구현한다. 한 사용자가 모바일·데스크톱·보안 키처럼 credential 을 여러 개 등록할 수 있다. 등록할 때 계정 비밀번호를 재확인한다([Passkey 등록 흐름](CLE-ACCT-SIGNIN-PASSKEY.md#passkey-등록-흐름)) |

## 2단계 인증 설정 화면

보안 설정 화면은 `/profile/security` 이다. 내 프로필의 보안 카드에서 링크로 들어온다. 화면은 두 카드로 나뉜다.

| 카드 | 들어가는 요소 | 동작 |
| --- | --- | --- |
| TOTP | 설정 시작 폼(안내 문구, 계정 비밀번호 입력, 설정 시작 버튼), QR 코드, 확인 코드 입력, 복구 코드 표시, 끄기 폼(비밀번호와 인증 코드 입력) | 계정 비밀번호를 넣어 설정을 시작하고 인증 앱으로 QR 을 스캔한 뒤 코드를 넣어 켠다([TOTP 켜기](#totp-켜기)). 켜질 때 복구 코드 10개를 한 번 보여 준다. 끌 때는 비밀번호와 인증 코드를 함께 넣는다([TOTP 끄기](#totp-끄기)) |
| Passkey · 보안 키 | credential 목록(이름·transport·마지막 사용·등록일), 등록 폼(기기 이름과 계정 비밀번호 입력, 등록 버튼), 이름 변경, 삭제(계정 비밀번호 입력), 복구 코드 재발급(계정 비밀번호 입력) | 계정 비밀번호를 넣어 credential 을 등록하고 여러 개를 관리한다([Passkey 등록 흐름](CLE-ACCT-SIGNIN-PASSKEY.md#passkey-등록-흐름)). 첫 등록 때 별도 복구 코드 10개를 한 번 보여 준다. 이름 변경 입력이 비었거나 공백 문자로만 돼 있으면 저장 버튼을 막는다 |

- 프론트엔드는 보안 화면을 열 때 `GET /api/auth/2fa/webauthn/availability` 를 불러 Passkey 카드를 보일지 정한다.
- TOTP 카드는 `GET /api/users/me` 응답의 `twoFactorEnabled` 로 TOTP 켜짐 여부를 읽어 설정 카드와 켜짐 카드 가운데 하나를 그린다. 이 필드는 [내 프로필](CLE-ACCT-PROFILE.md#api) 의 API 표가 정한다.
- Passkey 등록 폼은 기기 이름과 함께 계정 비밀번호를 받는다. 비밀번호가 8자보다 짧으면 화면은 등록 옵션 요청을 보내지 않고 안내를 띄운다(TOTP 설정 시작 폼도 같다).
- Passkey 등록 옵션 · Passkey 복구 코드 재발급 · Passkey 삭제 · TOTP 설정 시작이 `PASSWORD_INVALID` 면 비밀번호가 맞지 않는다는 안내를, `PASSWORD_REQUIRED` 면 "비밀번호가 설정되지 않은 계정이에요. 비밀번호 재설정으로 먼저 설정해 주세요." 를 보여 준다. Passkey 등록의 그 밖의 실패는 등록 실패 안내(`registerFailed`) 하나로 보여 준다.
- Passkey 등록 · Passkey 복구 코드 재발급 · Passkey 삭제 · TOTP 설정 시작 · TOTP 활성화 검증 · TOTP 끄기 폼에서 요청 빈도 제한에 걸린 응답(429)을 받으면 [에러 응답과 클라이언트 처리 「API 에러 처리 흐름」](../CLE-API/CLE-API-ERROR.md#41-api-에러-처리-흐름) 의 공통 처리대로 토스트를 띄운다. 다만 비밀번호가 담긴 요청은 자동으로 다시 보내지 않는다.
- 비밀번호 재확인(password re-check, `verifyPasswordForUser`)의 에러 코드는 [세션과 토큰](CLE-ACCT-SESSION.md) 이 정한다.
- OAuth 전용 계정이 유일한 2단계 인증 수단을 끌 때 대안 로그인 경로를 어떻게 보장할지는 아직 정하지 않았다. TOTP 끄기는 비밀번호를 먼저 확인하므로 OAuth 전용 계정은 비밀번호를 추가하기 전에는 TOTP 를 끌 수 없다. Passkey 삭제도 2026-11-14 부터 비밀번호를 먼저 확인하므로 OAuth 전용 계정은 Passkey 도 지울 수 없다([Passkey 기능과 등록 「Passkey 삭제」](CLE-ACCT-SIGNIN-PASSKEY.md#passkey-삭제)). 강제 2단계 인증 정책·계정 복구 흐름과 함께 정할 별개 사안이다.

## TOTP 켜기

TOTP 를 켜려면 계정 비밀번호를 넣어 설정을 시작한다. 이어서 인증 앱으로 QR 을 스캔하고 앱에 나온 6자리 코드를 넣는다. TOTP 가 꺼져 있으면 TOTP 카드에 안내 문구, 계정 비밀번호 입력란, 설정 시작 버튼이 보인다.

서버는 설정 시작 `POST /api/auth/2fa/setup { password }` 를 다음 순서로 처리한다.

1. 본문을 검증한다. `password` 는 8자 이상 문자열이다. 빠지거나 짧으면 400 `VALIDATION_ERROR` 다.
2. 비밀번호를 확인한다(`AuthService.verifyPasswordForUser`). 비밀번호가 없는 계정(OAuth 전용)은 401 `PASSWORD_REQUIRED`, 틀리면 401 `PASSWORD_INVALID` 다. 여기서 실패하면 secret 을 만들지 않는다. 비밀번호 확인이 켜짐 여부 확인보다 먼저라서 TOTP 가 켜진 계정도 비밀번호가 틀리면 401 이다.
3. TOTP 가 켜져 있는지 본다(`TotpService.setup`). 켜져 있으면 409 `TOTP_ALREADY_ENABLED` 이고 secret 을 바꾸지 않는다.
4. 새 secret 을 만들어 `two_factor_enabled = false` 조건부 갱신으로 저장하고 `{ otpauthUrl, qrCodeDataUrl }` 를 돌려준다. 같은 갱신으로 설정 시작 시각(`user.two_factor_setup_started_at`)을 지금 시각으로 쓴다. `two_factor_enabled` 는 false 그대로다. 이렇게 설정 시작이 저장했지만 아직 켜지 않은 secret 을 이 문서에서 대기 secret(pending secret)이라고 한다. 3번에서 읽은 뒤 다른 요청이 TOTP 를 켜서 갱신된 행이 없으면 409 `TOTP_ALREADY_ENABLED` 다.

활성화 검증 `POST /api/auth/2fa/verify { code }` 는 다음 순서다.

1. 본문을 검증한다. `code` 는 6자 문자열이다. 형식이 틀리면 400 `VALIDATION_ERROR` 다.
2. 저장된 secret 이 없으면(설정 시작 전) 400 `TOTP_NOT_INITIALIZED` 다.
3. TOTP 가 켜져 있으면 코드를 확인하기 전에 409 `TOTP_ALREADY_ENABLED` 로 거부한다. 복구 코드를 다시 발급하지 않는다.
4. 설정 시작 시각이 없거나 그 시각에서 10분이 지났으면 대기 secret 이 만료된 것으로 본다. 코드를 확인하지 않고 대기 secret 과 설정 시작 시각을 NULL 로 비운 뒤 400 `TOTP_NOT_INITIALIZED` 로 거부한다. 비우기는 `two_factor_enabled = false` 이고 `two_factor_secret` 이 읽은 값 그대로일 때만 쓰는 조건부 갱신이다. 그 사이 다른 설정 시작이 쓴 새 secret 을 지우지 않기 위해서다.
5. 코드를 저장된 secret 으로 확인한다. 인증 앱의 6자리 코드만 받고 TOTP 복구 코드는 받지 않는다. 맞지 않으면 401 `TOTP_INVALID` 다.
6. TOTP 를 켠다. 복구 코드 10개를 만들어 SHA-256 해시로 저장하고 `two_factor_enabled` 를 true 로 바꾸고 설정 시작 시각을 비운다. 저장은 `two_factor_enabled = false` 이고 `two_factor_secret` 이 5번에서 확인에 쓴 secret 과 같을 때만 쓰는 조건부 갱신이다. 갱신된 행이 없으면 다시 읽는다. 그 사이 다른 요청이 켰으면 409 `TOTP_ALREADY_ENABLED`, 다른 설정 시작이 secret 을 바꿨으면 401 `TOTP_INVALID` 다. 켜면 감사 로그 `user.2fa_enabled` 를 남기고 복구 코드 평문을 한 번 돌려준다(`{ recoveryCodes }`).

- 활성화 검증 전에는 설정 시작을 다시 불러 secret 을 바꿀 수 있다. QR 을 다시 받는 경우다. 그러면 이전 secret 의 코드는 더 이상 맞지 않는다. 설정 시작 시각도 새로 쓰므로 10분은 마지막 설정 시작부터 센다.
- 켜진 뒤 secret 과 TOTP 복구 코드를 바꾸는 길은 [TOTP 끄기](#totp-끄기)(비밀번호와 인증 코드) 뒤 다시 켜는 흐름 하나다.
- 설정 시작과 활성화 검증은 사용자당 분당 10회로 제한한다(`SENSITIVE_ACTION_THROTTLE`, TOTP 끄기와 같은 상수). 한도는 라우트마다 따로 센다. 설정 시작의 한도는 탈취한 액세스 토큰만 가진 사람이 `PASSWORD_INVALID` 응답을 보고 계정 비밀번호를 추측하는 속도를 늦추기 위해서다. 활성화 검증의 한도는 대기 secret 의 6자리 코드를 추측하는 속도를 늦춘다.
- 설정 시작 뒤 10분이 지나면 대기 secret 을 쓰지 않는다(활성화 검증 4번). 설정을 다시 시작하려면 비밀번호가 필요하므로 비밀번호 확인 한 번으로 할 수 있는 코드 추측은 10분 동안의 활성화 검증 한도(분당 10회, 최대 100회)로 묶인다. 설정 시작 시각이 없는 대기 secret 도 만료로 본다. 이 규칙 전에 설정을 시작하고 켜지 않은 계정이 그 경우이고 그 사용자는 설정을 다시 시작한다.
- OAuth 전용 계정은 비밀번호가 없어 2번에서 `PASSWORD_REQUIRED` 로 막힌다. [비밀번호 재설정](CLE-ACCT-SIGNIN-SIGNUP.md#비밀번호-재설정) 으로 비밀번호를 추가한 뒤 켠다. 2026-11-01 전에 TOTP 를 켠 OAuth 전용 계정은 비밀번호 없이 TOTP 만 있을 수 있다. 이메일 변경 [동작 표](CLE-ACCT-SIGNIN-SIGNUP.md#동작-표) 의 「비밀번호 없음, TOTP 있음」 행이 그런 계정이다.
- 활성화 검증이 400 `TOTP_NOT_INITIALIZED` 를 받으면 화면은 QR 을 닫고 설정 시간이 지났으니 처음부터 다시 시작하라는 안내를 띄운다. 이어서 설정 시작(비밀번호 입력) 단계로 돌아간다.
- 설정 시작이나 활성화 검증이 409 `TOTP_ALREADY_ENABLED` 를 받으면 화면은 QR 을 닫고 이미 켜져 있다는 안내를 띄운다. 이어서 `GET /api/users/me` 로 사용자 정보를 다시 읽어 켜진 상태로 다시 그린다. 다른 탭에서 먼저 켠 경우다.
- 켜기와 끄기가 성공한 뒤에도 사용자 정보를 다시 읽는다. 켠 뒤 카드가 켜진 상태로 바뀌어도 한 번만 보여 주는 복구 코드는 화면에 남는다. TOTP 를 끄면 지운다.

## TOTP 끄기

TOTP 를 끄려면 비밀번호와 인증 코드를 함께 넣는다. 인증 코드는 로그인 2단계와 같이 인증 앱의 6자리 코드나 TOTP 복구 코드다. TOTP 가 켜져 있으면 TOTP 카드에 비밀번호 입력란, 코드 입력란, 끄기 버튼이 보인다. 비밀번호가 8자보다 짧거나 코드가 비어 있으면 화면은 요청을 보내지 않고 안내를 띄운다.

서버는 `POST /api/auth/2fa/disable { password, code }` 를 다음 순서로 처리한다.

1. 본문을 검증한다. `password` 는 8자 이상, `code` 는 6~32자 문자열이다. 빠지거나 형식이 틀리면 400 `VALIDATION_ERROR` 다.
2. 비밀번호를 확인한다(`AuthService.verifyPasswordForUser`). 비밀번호가 없는 계정은 401 `PASSWORD_REQUIRED`, 틀리면 401 `PASSWORD_INVALID` 다. 여기서 실패하면 코드는 확인하지 않는다.
3. 코드를 확인한다(`TotpService.verifyForDisable`). 로그인 2단계와 같은 `verifyForLogin` 을 쓴다. 복구 코드로 통과하면 로그인 때처럼 그 코드를 소비한다. 맞지 않으면 401 `TOTP_INVALID` 다. TOTP 가 켜져 있지 않을 때도 401 `TOTP_INVALID` 다.
4. TOTP 를 끈다. `two_factor_enabled` 를 false 로 바꾸고 TOTP secret, 남은 TOTP 복구 코드, 설정 시작 시각을 NULL 로 비운다. 감사 로그 `user.2fa_disabled` 를 남기고 200 `{ ok: true }` 를 돌려준다.

- Passkey credential 과 Passkey 복구 코드는 건드리지 않는다. Passkey 복구 코드는 TOTP 복구 코드 묶음에 없으므로 코드 입력란에 넣으면 401 `TOTP_INVALID` 다.
- 요청은 사용자당 분당 10회로 제한한다(`SENSITIVE_ACTION_THROTTLE`). 비밀번호를 아는 사람이 6자리 코드를 추측하는 속도를 늦추기 위해서다.
- 코드 확인 실패는 로그인 이력에 남기지 않는다. 로그인 이력의 `totp_failed` 는 로그인 2단계 실패만 뜻한다.
- 화면은 비밀번호 실패와 코드 실패를 나누지 않고 같은 실패 안내를 보여 준다.
- OAuth 전용 계정은 비밀번호가 없어 2번에서 `PASSWORD_REQUIRED` 로 막힌다. [비밀번호 재설정](CLE-ACCT-SIGNIN-SIGNUP.md#비밀번호-재설정) 으로 비밀번호를 추가한 뒤 끈다.
- 켜진 계정의 설정 시작과 활성화 검증은 409 `TOTP_ALREADY_ENABLED` 로 거부된다. 그래서 로그인 세션만 가진 사람이 secret 을 바꿔 이 확인을 통과할 수 없다([TOTP 켜기](#totp-켜기)).

## 복구 코드

복구 코드(recovery code, `totp_recovery_codes`, `webauthn_recovery_codes`)는 2단계 인증 수단을 잃었을 때 쓰는 일회용 코드다. TOTP 와 Passkey 가 코드 묶음을 따로 쓴다.

| 항목 | TOTP | Passkey |
| --- | --- | --- |
| 발급 시점 | TOTP 활성화 검증 성공 시 | 첫 credential 등록 검증 성공 시 |
| 개수·형식 | 10개, `xxxx-xxxx-xxxx` | 10개, 같은 형식 |
| 저장 | `user.totp_recovery_codes`: SHA-256 해시 배열, 쓰면 항목 제거 | `user.webauthn_recovery_codes`: SHA-256 해시 배열, 쓰면 항목 제거. TOTP 와 분리 |
| 폐기 | TOTP 를 끄면 NULL | 사용자가 마지막 credential 을 삭제하면 NULL. counter 역행으로 서버가 지운 경우는 비우지 않는다. 사용자가 명시적으로 재발급할 수도 있다 |
| 사용 화면 | 로그인 2단계의 "복구 코드 사용" 링크, [TOTP 끄기](#totp-끄기) 의 코드 입력란 | 로그인 2단계의 "복구 코드 사용" 링크. 별도 코드 묶음에서 검증한다 |

두 묶음을 나누는 이유는 한쪽을 꺼도 다른 쪽 복구가 계속 유효하게 하기 위해서다. TOTP 쪽 복구 코드 재발급 API 는 없다. 끄고 다시 켜면 새로 발급된다. 인증 앱을 잃은 사용자도 TOTP 복구 코드로 TOTP 를 끈 뒤 다시 켤 수 있다.

counter 역행으로 마지막 credential 이 지워져도 Passkey 복구 코드는 남는다. 다음에 첫 Passkey 를 등록할 때 새 코드 10개로 바뀐다. 이렇게 두는 이유는 [counter 역행이면 credential 을 지운다](CLE-ACCT-SIGNIN-PKAUTH.md#counter-역행이면-credential-을-지운다-suspend-기각) 에 있다.

## 미결 사항

- **복구 코드 소비의 원자성**: TOTP 복구 코드와 Passkey 복구 코드는 사용자 행을 읽어 맞는 항목을 뺀 배열을 다시 쓴다(`totp.service.ts` 의 `verifyForLogin`, `webauthn/webauthn.service.ts` 의 `verifyRecoveryCode`). 조건부 갱신이 아니라서 같은 복구 코드로 두 요청이 동시에 오면 둘 다 통과해 토큰이 두 번 나갈 수 있다. 조건부 갱신으로 한 번만 소비할지 정해야 한다.

## 구현 위치

- `codebase/backend/src/modules/auth/auth.service.ts` (`startTwoFactorSetup` · `disableTwoFactor`, TOTP 설정 시작과 끄기의 비밀번호 재확인 순서)
- `codebase/backend/src/modules/auth/totp.service.ts` (TOTP 설정 시작 · 활성화 검증의 켜짐 확인과 조건부 갱신, 설정 시작 시각 기록과 대기 secret 의 10분 만료, TOTP 끄기의 코드 확인)
- `codebase/backend/src/common/constants/throttle.ts` (`SENSITIVE_ACTION_THROTTLE`, TOTP 설정 시작 · 활성화 검증 · 끄기와 Passkey 등록 옵션 · 복구 코드 재발급의 요청 빈도 제한)
- `codebase/backend/src/modules/auth/password-recheck-throttle.spec.ts` (`verifyPasswordForUser` 를 부르는 라우트 목록을 고정하고 핸들러마다 `SENSITIVE_ACTION_THROTTLE` 이 걸렸는지 보는 단위 테스트)
- `codebase/backend/migrations/V*__user_two_factor_setup_started_at.sql` (`user.two_factor_setup_started_at` 컬럼 추가)
- `codebase/backend/test/totp-disable.e2e-spec.ts` (TOTP 끄기의 비밀번호·코드 확인과 DB 상태)
- `codebase/backend/test/totp-enable-guard.e2e-spec.ts` (TOTP 설정 시작의 비밀번호 재확인, 켜진 계정의 설정 시작 · 활성화 검증 거부와 DB 상태, 끈 뒤 다시 켜기)
- `codebase/backend/test/totp-setup-expiry.e2e-spec.ts` (TOTP 대기 secret 의 10분 만료, 시각이 없는 대기 secret, 만료 뒤 DB 상태)
- `codebase/frontend/src/app/(main)/w/[slug]/profile/security/**`

## Rationale

### 복구 코드 묶음을 TOTP 와 Passkey 로 나눈다

사용자가 한쪽 방식만 끄거나 다시 설정해도 다른 쪽 복구가 유지돼야 한다. 공통 묶음이면 TOTP 를 끌 때 Passkey 복구도 함께 버려야 하는지가 모호해진다. Passkey 만 쓰는 사용자에게도 TOTP 없이 복구 수단을 줘야 한다. 공통 묶음은 "TOTP 가 항상 켜져 있다" 는 가정에 기댄다. 컬럼 하나를 더하는 비용은 작다. PostgreSQL 은 NULL 컬럼에 공간을 거의 쓰지 않는다.

### 복구 코드는 SHA-256 으로 해시한다 (KDF 기각)

복구 코드는 `randomBytes(9)`(72비트) 기반의 고엔트로피 일회용 비밀이다. argon2id·bcrypt·scrypt 같은 KDF 의 느린 해시와 솔트는 저엔트로피 사용자 비밀번호의 사전 공격을 늦추려는 것이라 고엔트로피 값에는 이득이 없다. 2^50 이상의 탐색 공간은 GPU 로도 비현실적이다(OWASP 복구 코드 지침과 맞다). KDF 로 바꾸면 코드별 솔트 때문에 검증이 배열 `indexOf` 에서 최대 10회의 느린 비교로 바뀌어 복구 로그인이 느려지고, TOTP 와 Passkey 두 묶음을 함께 바꿔야 한다. 이득에 비해 비용이 커서 SHA-256 을 유지한다.

### TOTP 라이브러리: `otplib` v13

TOTP 발급과 검증은 `otplib` v13 을 쓴다(`totp.service.ts`). secret 은 base32(RFC 6238)라 라이브러리를 바꿔도 호환된다. v12 에서 올린 이유는 다음과 같다.

- v12 는 2021 년 이후 릴리스가 멈췄다. 보안에 중요한 경로에서 CVE 패치 라인이 없는 위험이 있다. v13 은 감사받은 `@noble/hashes`·`@scure/base` 플러그인 기반의 활성 라인이다.
- v13 은 ESM 전용 전면 재작성이고 `authenticator` preset 이 없어졌다. 다만 `verifySync`·`generateSync` 가 기본 crypto 플러그인에서 동작해 서비스 메서드를 동기로 유지했다.
- v12 와 v13 모두 RFC 6238 을 따르므로 기존 secret 이 그대로 검증된다. RFC 6238 Appendix B 벡터로 교차 버전 단위 테스트를 둬 기존 사용자가 잠기지 않게 했다.
- v12 의 `window:1` 허용 오차는 v13 의 `epochTolerance: 30`(앞뒤 1 time step)으로 같게 맞췄다.

### TOTP 끄기에 비밀번호와 인증 코드를 함께 받는다 (2026-10-10)

NERV Task `CLE-T-75TDTN` 의 결정이다. 원문 인증 명세의 2단계 인증 표는 끌 때 "비밀번호 재확인과 코드 입력" 을, API 표는 "인증과 비밀번호 재확인" 만 적었고 구현은 비밀번호만 받았다. 비밀번호와 코드를 모두 받기로 정했다.

- **코드를 함께 받는 이유**: 비밀번호만으로 끌 수 있으면 비밀번호와 로그인 세션을 손에 넣은 사람이 두 번째 요소를 지울 수 있다. 2단계 인증이 막으려는 상황이 바로 그것이다. 요소를 지우려면 그 요소를 가졌다는 것을 보여야 한다. 켜진 상태의 setup/verify 로 새 secret 을 만들어 코드 확인을 통과하는 길은 2026-11-01 에 닫았다([TOTP 켜기는 비밀번호를 다시 확인하고 켜진 계정을 거부한다](#totp-켜기는-비밀번호를-다시-확인하고-켜진-계정을-거부한다-2026-11-01)).
- **복구 코드도 받는 이유**: 인증 앱을 잃은 사용자는 TOTP 복구 코드로 로그인한 뒤 TOTP 를 끄고 새 기기로 다시 설정해야 한다. TOTP 복구 코드만 따로 재발급하는 API 도 없다. 6자리 코드만 받으면 이 사용자는 TOTP 를 끌 수도 다시 설정할 수도 없다. 그래서 로그인 2단계와 같은 `verifyForLogin` 을 쓰고 복구 코드도 로그인처럼 소비한다.
- **필드 이름 `code`**: 로그인 2단계 `POST /api/auth/login/totp` 의 본문 필드가 `code` 이고 길이 규칙(6~32자)과 받는 값이 같다. 활성화 검증 `POST /api/auth/2fa/verify` 도 `code` 를 쓴다(6자리만). 계정 재인증의 `totpCode` 는 등록된 TOTP 코드만 받는 필드라서 따르지 않았다. 이름이 같으면 받는 값도 같다고 읽히기 때문이다.
- **확인 순서**: 비밀번호를 먼저 확인한다. 비밀번호가 틀린 요청은 코드를 확인하지 않으므로 복구 코드를 소비하지 않는다.
- **에러 코드**: 코드 불일치에는 기존 `TOTP_INVALID`(401)를 쓴다. 코드 누락은 본문 검증의 400 `VALIDATION_ERROR` 가 맡는다. TOTP 가 꺼진 계정의 끄기 요청도 `TOTP_INVALID` 로 묶었다. 끄기 화면은 TOTP 가 켜진 계정에만 보이므로 꺼짐은 다른 탭에서 먼저 끈 경합에서만 나고 클라이언트가 따로 할 동작이 없다. `TOTP_NOT_ENABLED` 는 로그인 2단계 챌린지 전용 코드(401, 다시 로그인 안내)라서 다시 쓰지 않았다. 새 코드나 409 도 같은 이유로 두지 않았다.
- **로그인 이력**: 끄기의 코드 실패는 로그인 이력에 남기지 않는다. `totp_failed` 는 로그인 2단계 실패를 뜻하는 값이라 설정 화면의 실패를 섞으면 그 뜻이 흐려진다. 추측 시도는 요청 한도(사용자당 분당 10회)가 막는다.
- **설정 화면의 OAuth 전용 계정 문장**: TOTP 끄기는 이전에도 비밀번호를 먼저 확인해서 OAuth 전용 계정은 끌 수 없었다. 그래서 "따로 막는 로직이 없다" 는 문장을 Passkey 삭제로 좁혔다. 2026-11-14 에 Passkey 삭제도 비밀번호를 먼저 확인하게 되어(NERV Task `CLE-T-Q6E11N`) 그 문장도 고쳤다.

기각한 대안은 다음과 같다.

- 비밀번호만 받고 원문의 2단계 인증 표를 API 표에 맞춰 고치기: 위 첫째 이유로 기각했다.
- 6자리 코드만 받고 복구 코드는 거부하기: 인증 앱을 잃은 사용자가 TOTP 를 끄지도 다시 설정하지도 못한다.
- 계정 재인증 `verifyReauth` 를 그대로 쓰기: 비밀번호와 TOTP 가운데 하나만 통과하면 되는 규칙이라 비밀번호만 받던 이전 구현과 달라지지 않는다.
- Passkey 복구 코드도 받기: 「복구 코드 묶음을 TOTP 와 Passkey 로 나눈다」 의 결정과 어긋난다. 한쪽 수단의 복구 코드로 다른 쪽 수단을 지우게 된다.
- 비밀번호를 빼고 코드만 받기: 원문과 기존 구현이 모두 비밀번호 확인을 요구했다. 이를 약하게 할 이유가 없다.
- 코드 누락용 새 에러 코드(`TOTP_REQUIRED`): 본문 검증이 이미 400 으로 막는다. 같은 상황에 코드를 둘 두지 않는다.

### 계정 재인증과 TOTP 끄기는 코드 규칙이 다르다 (2026-10-10)

이메일 변경과 세션 강제 종료의 계정 재인증은 등록된 TOTP 코드만 받고 TOTP 복구 코드는 받지 않는다([세션과 토큰](CLE-ACCT-SESSION.md) 의 「세션 정책」 표 「강제 종료 재인증」 행). TOTP 끄기는 복구 코드도 받는다. 두 규칙은 일부러 다르게 두었다.

- 계정 재인증은 비밀번호와 TOTP 가운데 하나만 통과하면 된다. 비밀번호가 있는 사용자는 인증 앱을 잃어도 비밀번호로 계정 재인증을 한다. 복구 코드를 받지 않아도 잠기지 않는다.
- 비밀번호가 없는 OAuth 전용 계정만 TOTP 코드에 기댄다. 이 사용자도 [비밀번호 재설정](CLE-ACCT-SIGNIN-SIGNUP.md#비밀번호-재설정) 으로 비밀번호를 추가하면 비밀번호로 계정 재인증을 할 수 있다.
- TOTP 끄기는 비밀번호와 코드를 모두 요구한다. 코드 자리에 다른 길이 없어서 복구 코드를 받지 않으면 인증 앱을 잃은 사용자가 막힌다.
- 계정 재인증이 복구 코드를 받으면 비밀번호 없이 복구 코드 한 장만으로 이메일을 바꿀 수 있다. 복구 코드는 종이나 파일로 오래 보관하는 고정 값이라 단독 수단으로는 약하다.

그래서 계정 재인증 규칙은 바꾸지 않았다. 계정 재인증의 동작은 [세션과 토큰](CLE-ACCT-SESSION.md) 이 정한다. 요청 필드 이름도 받는 값에 따라 갈린다. 계정 재인증은 `totpCode`, TOTP 끄기와 로그인 2단계는 `code` 다.

계정 재인증에서 복구 코드를 막는 것은 지금 본문 검증이다. `totpCode` 는 6~8자로 묶여 있어 `xxxx-xxxx-xxxx` 꼴의 복구 코드가 서비스에 닿지 않는다. 서비스(`verifyReauth`)는 로그인과 같은 `verifyForLogin` 을 부른다. 그래서 이 길이 제한을 넓히면 계정 재인증에서도 복구 코드가 통과하고 소비된다.

### TOTP 켜기는 비밀번호를 다시 확인하고 켜진 계정을 거부한다 (2026-11-01)

NERV Task `CLE-T-94FTMV` 에서 사람 결정 두 건으로 정했다. 그 전에는 setup 과 verify 가 TOTP 가 이미 켜져 있는지 보지 않았고 로그인 세션만 있으면 됐다. 그래서 로그인 세션만 가진 사람이 secret 과 TOTP 복구 코드를 새로 만들어 원래 사용자의 인증 앱과 복구 코드를 못 쓰게 만들 수 있었다. 비밀번호까지 가진 사람은 새 secret 의 코드로 [TOTP 끄기](#totp-끄기) 도 통과했다. TOTP 가 꺼진 계정에서는 로그인 세션만 가진 사람이 자기 인증 앱으로 TOTP 를 켜 원래 사용자의 다음 로그인을 막을 수 있었다. 화면만 설정 카드를 숨겼고 API 는 막지 않았다.

- **켜진 계정은 새 코드 409 `TOTP_ALREADY_ENABLED` 로 거부한다.** setup 과 verify 가 같은 코드를 쓴다. 이 응답을 받은 클라이언트는 입력을 고치지 않고 켜진 상태를 다시 읽는다. 할 일이 다른 409 와 다르므로 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 규칙 6 의 새 조건이다. 이미 그 상태인 대상에 같은 요청을 다시 보낸 경우를 409 전용 코드로 가른 선례로 `ALREADY_A_MEMBER` 와 `TARGET_ALREADY_OWNER` 가 있다.
- **기각: 409 `RESOURCE_CONFLICT` 를 다시 쓴다.** 이 문서에서 `RESOURCE_CONFLICT` 는 가입 이메일 중복과 새 이메일 선점을 뜻하고 클라이언트는 다른 이메일로 다시 보낸다. 같은 코드로 묶으면 화면이 `message` 로 경우를 갈라야 한다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 규칙 4).
- **기각: 400 `VALIDATION_ERROR` 를 쓴다.** 요청 형식은 맞고 계정 상태가 요청을 막는 경우라 입력을 고쳐 다시 보내라는 코드와 뜻이 맞지 않는다.
- **기각: 422 `INVALID_STATE` 를 쓴다.** 이 코드는 실행 · 워크플로우의 상태 전이 거부에 쓴다.
- **기각: 켜진 상태의 재설정을 끄기와 같은 확인(비밀번호와 인증 코드)을 거쳐 허용한다.** secret 을 바꾸는 길이 둘이 되고 두 길의 확인 규칙을 함께 맞춰 둬야 한다. 끄기 뒤 다시 켜는 흐름이 이미 같은 확인을 요구하므로 길을 하나로 둔다.
- **verify 는 코드를 확인하기 전에 거부한다.** 켜진 계정에서는 코드가 맞아도 새로 켤 것이 없다. 그래서 코드를 확인하지 않고 복구 코드도 다시 발급하지 않는다.
- **setup 은 비밀번호를 다시 확인한다.** 로그인 세션만 가진 사람이 자기 인증 앱으로 TOTP 를 켜 원래 사용자를 잠그는 공격을 막는다. 켜진 계정을 거부하는 것만으로는 꺼진 계정에서 이 공격이 남는다. TOTP 끄기와 Passkey 복구 코드 재발급이 쓰는 비밀번호 재확인(`verifyPasswordForUser`)을 그대로 쓰고 같은 에러 코드(401 `PASSWORD_REQUIRED` · `PASSWORD_INVALID`)를 낸다.
- **기각: 비밀번호를 받지 않는다.** 위 공격이 남는다.
- **기각: 후속 Task 에서 TOTP 와 Passkey 를 함께 정한다.** TOTP 쪽은 setup · verify 를 고치면서 함께 막을 수 있어서 Passkey 를 기다리지 않았다. Passkey 쪽은 2026-11-02 에 정했다([Passkey 등록에도 비밀번호 재확인을 두고 TOTP 대기 secret 은 10분 뒤 버린다](CLE-ACCT-SIGNIN-PASSKEY.md#passkey-등록에도-비밀번호-재확인을-두고-totp-대기-secret-은-10분-뒤-버린다-2026-11-02)).
- **비밀번호를 켜짐 여부보다 먼저 본다.** TOTP 끄기와 같은 순서다. 비밀번호를 확인하지 못한 요청은 TOTP 상태를 읽기 전에 끝나므로 켜진 계정도 비밀번호가 틀리면 409 가 아니라 401 이다.
- **저장은 조건부 갱신이다.** 켜짐 여부를 읽은 뒤 저장하기 전에 다른 탭의 verify 가 TOTP 를 켤 수 있다. 읽은 값만 믿고 쓰면 막 켜진 계정의 secret 이나 복구 코드를 덮어쓴다. 갱신된 행이 없을 때 secret 이 바뀌었으면 확인한 코드가 지금 secret 과 맞지 않으므로 401 `TOTP_INVALID` 이고 사용자는 새 QR 의 코드로 다시 확인한다. 조건 없이 쓰는 `UsersService.update` 대신 `TotpService` 가 `User` 저장소로 직접 쓴다.
- **비용**: OAuth 전용 계정은 [비밀번호 재설정](CLE-ACCT-SIGNIN-SIGNUP.md#비밀번호-재설정) 으로 비밀번호를 만들기 전에는 TOTP 를 켤 수 없다. 끄기도 같은 조건이라 켜기와 끄기의 조건이 같아진다. OAuth 전용 계정이 계정 재인증 수단을 늘리는 길은 비밀번호 재설정 하나로 좁아졌다.
- **setup 의 요청 한도**: setup 이 계정 비밀번호를 bcrypt 로 대조하는 경로가 됐기 때문에 더했다. 탈취한 액세스 토큰만 가진 사람이 `PASSWORD_INVALID` 응답을 보고 비밀번호를 추측하는 속도를 늦추고 bcrypt 비교가 스레드 풀을 오래 잡는 비용도 줄인다. TOTP 끄기와 같은 등급이라 같은 상수(`SENSITIVE_ACTION_THROTTLE`, 사용자당 분당 10회)를 쓴다.
- **끄기의 꺼짐 응답은 바꾸지 않았다.** 꺼진 계정의 끄기 요청은 401 `TOTP_INVALID` 그대로다. 이번 결정은 켜진 계정의 켜기 요청만 다룬다.

### TOTP 대기 secret 은 설정 시작 10분 뒤 버린다 (2026-11-02)

NERV Task `CLE-T-FRCRF7` 의 사람 결정이다. Passkey 등록의 비밀번호 재확인과 함께 정해 [Passkey 기능과 등록](CLE-ACCT-SIGNIN-PASSKEY.md#passkey-등록에도-비밀번호-재확인을-두고-totp-대기-secret-은-10분-뒤-버린다-2026-11-02) 에 적었던 근거를 2026-11-14 에 문서 크기 한도 때문에 이 문서로 옮겼다. 내용은 바꾸지 않았다.

- **설정 시작 뒤 10분이 지나면 대기 secret 을 쓰지 않는다.** 수명이 없으면 비밀번호를 한 번 확인한 뒤 같은 secret 의 코드를 시간 제한 없이 추측할 수 있다.
- **시각 컬럼을 더한다.** `user.two_factor_setup_started_at`(timestamptz, NULL 허용)이다. 응답에는 싣지 않는다. 비밀은 아니라서 [계정과 워크스페이스 데이터 흐름 「응답에 싣지 않는 민감 컬럼 7개」](CLE-ACCT-DATA.md#응답에-싣지-않는-민감-컬럼-7개) 목록에는 넣지 않는다. 마이그레이션은 컬럼만 더하고 데이터를 바꾸지 않는다.
- **만료면 코드를 확인하지 않고 `TOTP_NOT_INITIALIZED` 를 쓴다.** 클라이언트가 할 일(설정 시작부터 다시)이 설정 시작 없이 부른 경우와 같아서 새 코드를 두지 않았다. 상태 코드도 기존 400 을 그대로 쓴다. 이미 발행 중인 코드의 상태 코드를 바꾸면 이 코드로 분기하는 클라이언트와의 호환이 깨진다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#규칙) 규칙 5 가 코드 이름 바꾸기를 호환을 깨는 변경으로 보는 것과 같은 이유).
- **기각: 활성화 검증이 5번 실패하면 대기 secret 을 버린다.** 실패 횟수 컬럼이 더 필요하고 시간 제한이 없어 대기 secret 이 남는다.
- **기각: 10분 만료와 5회 실패 폐기를 함께 둔다.** 요청 빈도 제한과 겹쳐 얻는 것이 적다.
- **기각: 요청 빈도 제한만 건다.** 분당 10회여도 시간 제한이 없으면 약 3주면 6자리 코드를 맞춘다.
