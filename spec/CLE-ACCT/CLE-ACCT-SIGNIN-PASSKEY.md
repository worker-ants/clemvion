---
id: "CLE-ACCT-SIGNIN-PASSKEY"
title: "가입과 로그인 — Passkey 기능과 등록"
type: "design"
version: 3
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ACCT-SIGNIN"
ancestors: ["CLE-VISION", "CLE-ACCT", "CLE-ACCT-SIGNIN"]
area: "CLE-ACCT"
content_hash: "e92b40ec3b49119001e1c4aa0b950f2860f7f652a50efb56a76e600fb6275fe5"
read_as: "approved_fallback"
task: "CLE-T-GWC9M3"
source_paths: []
mirror_sha256: "058f4f1c25ef10e8ac9bb54881f26bac41834eb4073d9b848dde613a2c669434"
etag: "sha256-5bf4a5f27931cc70f81d1ca7c0b7018ea536bf316449280ca962416317962563"
---
## 개요

이 문서는 [가입과 로그인](CLE-ACCT-SIGNIN.md) 의 하위 문서로 Passkey·보안 키 기능을 켜는 환경 변수와 꺼졌을 때의 동작, Passkey 등록 흐름(비밀번호 재확인, 저장 원자성, 공개 키 알고리즘, transport 목록, 표시 이름), Passkey 복구 코드 재발급, Passkey 삭제, 복구 코드와 credential 을 바꾸는 경로의 사용자 행 잠금, Passkey 도메인 모듈 구성을 정한다. 로그인 2단계 Passkey 인증 검증과 sign counter 역행은 [Passkey 로그인 인증](CLE-ACCT-SIGNIN-PKAUTH.md), 복구 코드 묶음은 [2단계 인증 설정과 TOTP 「복구 코드」](CLE-ACCT-SIGNIN-TOTP.md#복구-코드) 에 있다.

## Passkey 기능 켜기와 환경 변수

Passkey 는 운영자가 환경 변수를 설정해야 켜지는 선택 기능이다. 셀프 호스팅 도메인이 SaaS 와 다르다는 전제 때문이다. 두 핵심 변수가 모두 있을 때만 켜지고 빠지면 자동 폴백하지 않는다. 운영 도메인과 어긋난 rpID 로 등록하면 이후 인증이 모두 실패해 사용자가 잠기기 때문이다. 설정은 `codebase/backend/src/common/config/webauthn.config.ts` 의 `registerAs('webauthn', ...)` 로 등록한다.

| 변수 | 용도 | 예 |
| --- | --- | --- |
| `WEBAUTHN_RP_ID` | Relying Party ID. 포트·스킴 없는 호스트명 | `clemvion.example.com` |
| `WEBAUTHN_RP_NAME` | 사용자 다이얼로그에 보일 이름. 선택, 기본 `Clemvion` | `Clemvion` |
| `WEBAUTHN_ORIGIN` | 콤마로 구분한 허용 origin 목록. 같은 RP 의 여러 origin 을 지원한다 | `https://clemvion.example.com,https://app.clemvion.example.com` |
| `WEBAUTHN_ALLOW_FALLBACK` | 선택. `1` 이면 `WEBAUTHN_RP_ID`·`WEBAUTHN_ORIGIN` 이 없어도 `FRONTEND_URL` 로 폴백해 켠다. 개발·로컬·시연 전용이고 운영에서는 쓰지 않는다 | `0` (기본) |

| 상태 | 조건 | 동작 |
| --- | --- | --- |
| 켜짐 (`enabled=true`) | 두 변수가 모두 있거나 `WEBAUTHN_ALLOW_FALLBACK=1` | 모든 Passkey 엔드포인트가 동작한다. 로그인 응답이 `methods=['webauthn']` 로 갈릴 수 있다 |
| 꺼짐 (`enabled=false`) | 변수가 없고 폴백도 허용하지 않음 | 부팅은 정상이고 warn 로그만 남긴다. 가용성 조회는 200 `{ enabled: false }` 를 돌려준다. credential 목록 조회는 저장된 credential 이 있어도 200 `{ items: [] }` 를 돌려준다. 나머지 Passkey 엔드포인트는 모두 `503 WEBAUTHN_DISABLED` 다. 로그인은 `methods: ['webauthn']` 챌린지를 주지 않는다. TOTP 가 켜진 사용자는 `methods=['totp']`, credential 이 있고 TOTP 가 꺼진 사용자는 503 `WEBAUTHN_DISABLED`, 둘 다 없는 사용자는 즉시 로그인이다([2단계 인증 방식 선택](CLE-ACCT-SIGNIN-LOGIN.md#2단계-인증-방식-선택)). 프론트엔드는 availability 응답을 보고 Passkey UI 를 숨긴다 |

`GET /api/auth/2fa/webauthn/availability` 는 인증이 필요 없는 공개 GET 이고 응답은 `{ enabled: boolean }` 이다. 응답 봉투는 [API](CLE-ACCT-SIGNIN-API.md#api) 첫머리의 규칙을 따른다.

운영자가 설정을 끈 상태에서 이미 credential 을 가진 사용자가 있으면 DB 행은 보존한다. 운영자가 변수를 다시 설정하면 그대로 다시 쓴다. 꺼져 있는 동안 TOTP 가 켜진 사용자는 TOTP 로 들어온다. Passkey 만 등록한 사용자는 운영자가 변수를 다시 설정할 때까지 비밀번호로 로그인하지 못한다. 비밀번호만으로 2단계 인증을 건너뛰게 두지 않기 위해서다. 소셜 로그인은 이 규칙 밖이다. 기능이 꺼진 동안의 TOTP 로그인(`POST /api/auth/login/totp`)은 `WEBAUTHN_REQUIRED` 로 막지 않는다.

## Passkey 등록 흐름

등록은 `/profile/security` 의 "Passkey 등록" 에서 시작한다.

1. `POST /api/auth/2fa/webauthn/register/options { password }` (JWT 필수). 서버는 먼저 본문을 검증한다. `password` 는 8자 이상 문자열이고 빠지거나 형식이 틀리면 400 `VALIDATION_ERROR` 다. Passkey 기능이 꺼져 있으면 비밀번호를 확인하기 전에 503 `WEBAUTHN_DISABLED` 로 거부한다. 이어서 비밀번호를 확인한다(`AuthService.verifyPasswordForUser`). 비밀번호가 없는 계정(OAuth 전용)은 401 `PASSWORD_REQUIRED`, 틀리면 401 `PASSWORD_INVALID` 이고 이때 등록 옵션과 `optionsToken` 을 만들지 않는다. 확인을 통과하면 서버가 `generateRegistrationOptions` 를 만들고 `optionsToken` JWT(`kind=webauthn_register`, 5분)를 함께 준다.
2. 클라이언트가 `navigator.credentials.create(options)` 를 호출한다.
3. `POST /api/auth/2fa/webauthn/register/verify { optionsToken, response, deviceName? }`. 서버가 `verifyRegistrationResponse` 로 검증하고 `webauthn_credential` 행을 만든다. 첫 등록이면 복구 코드 10개를 발급해 평문으로 한 번 돌려준다.

등록 검증은 1번이 준 `optionsToken` 없이는 credential 을 저장하지 않는다. 그래서 1번의 비밀번호 재확인이 등록 옵션과 등록 검증 두 요청을 모두 덮고 등록 검증은 비밀번호를 다시 받지 않는다. 이미 등록한 Passkey 는 그대로 쓴다. OAuth 전용 사용자는 [비밀번호 재설정](CLE-ACCT-SIGNIN-SIGNUP.md#비밀번호-재설정) 으로 비밀번호를 만든 뒤 등록한다. [TOTP 켜기](CLE-ACCT-SIGNIN-TOTP.md#totp-켜기) 와 같은 조건이다. 등록 옵션은 사용자당 분당 10회로 제한한다(`SENSITIVE_ACTION_THROTTLE`). 등록 검증에는 전용 한도를 걸지 않는다.

등록 검증의 저장은 한 트랜잭션이다. 사용자 행을 잠그고([사용자 행 잠금](#사용자-행-잠금)) credential 수를 센 뒤 credential 을, 첫 등록이면 복구 코드도 저장한다. 같은 사용자의 첫 등록이 동시에 오면 먼저 잠근 요청만 복구 코드를 받고 나머지는 복구 코드 없이 저장한다. 복구 코드를 저장하지 못하면 credential 도 저장하지 않는다. 같은 credential ID 가 이미 있으면(동시 등록 포함) 아무것도 저장하지 않고 409 `WEBAUTHN_CREDENTIAL_EXISTS` 로 거부한다.

Passkey 복구 코드 재발급(`POST /api/auth/2fa/webauthn/recovery-codes/regenerate`)도 등록 옵션과 같은 순서다. Passkey 기능이 꺼져 있으면 비밀번호를 확인하기 전에 503 `WEBAUTHN_DISABLED` 로 거부한다.

### 공개 키 알고리즘

등록 옵션과 등록 검증은 같은 공개 키 알고리즘 목록만 받는다. 순서대로 EdDSA(`-8`) · ES256(`-7`) · RS256(`-257`)이다. 목록 밖 알고리즘의 공개 키로 만든 credential 은 등록 검증이 400 `WEBAUTHN_VERIFY_FAILED` 로 거부하고 저장하지 않는다. 인증 검증은 등록 때 저장한 공개 키의 알고리즘으로 검증한다.

### transport 목록

등록 검증은 클라이언트가 보낸 transport 목록(`response.response.transports`)의 형식도 확인한다. 서버 라이브러리는 이 값을 검증하지 않고 그대로 돌려준다.

- 필드가 없으면 빈 목록으로 저장한다.
- 값이 문자열 배열이 아니면 400 `WEBAUTHN_VERIFY_FAILED` 로 거부하고 credential 을 만들지 않는다. `null` 이거나 배열이 아니거나 문자열이 아닌 항목이 섞인 경우다. 항목에 NUL 문자(`\u0000`)가 든 문자열이 있어도 같다. PostgreSQL `text` 에는 NUL 을 저장할 수 없기 때문이다.
- 문자열 배열이면 표준 값(`usb` · `nfc` · `ble` · `smart-card` · `hybrid` · `internal`)에 없는 값도 바꾸지 않고 저장한다.

### 표시 이름

등록 검증과 이름 변경(`PATCH /api/auth/2fa/webauthn/credentials/:id`)은 표시 이름(`deviceName`)의 형식을 같은 규칙으로 확인한다. 등록 검증에서는 이 필드를 빼거나 `null` 로 보내도 된다. 둘 다 이름 없이 저장한다. 이름 변경에서는 이 필드가 필수 문자열이다. 키를 빼거나 `null` 을 보내면 400 `VALIDATION_ERROR` 로 거부한다.

- 길이는 유니코드 코드 포인트로 세고 100개까지 받는다. 저장 컬럼은 [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md) 의 `webauthn_credential.device_name`(`varchar(100)`)이다. 서로게이트 쌍으로 된 이모지는 1개로 세고, 변형 선택자(U+FE0E · U+FE0F)는 앞 글자와 따로 1개로 센다. 제로폭 접합자(ZWJ, U+200D)로 이은 이모지와 피부색 수정자가 붙은 이모지는 화면에 한 글자로 보여도 코드 포인트 여러 개로 센다. 앞뒤 공백을 지우기 전의 값으로 센다.
- NUL 문자(`\u0000`)가 든 이름은 받지 않는다. PostgreSQL `varchar` 에는 NUL 을 저장할 수 없기 때문이다.
- 형식이 틀리면 400 `VALIDATION_ERROR` 로 거부한다. 등록 검증이면 credential 을 만들지 않고, 이름 변경이면 이름을 바꾸지 않는다. 어느 필드가 틀렸는지는 `details[]` 항목(`field: deviceName`, `code: INVALID_FIELD`)에 싣는다.
- 이름 변경은 빈 문자열과 공백 문자로만 된 이름도 같은 코드로 거부한다. 공백 문자는 ECMAScript 의 공백 · 줄 끝 문자(`String.prototype.trim()` 이 지우는 문자)다. 제로폭 공백(U+200B)처럼 `trim()` 이 지우지 않는 문자는 공백 문자로 보지 않는다.
- 저장할 때는 앞뒤 공백 문자를 지운다. 등록 검증에서 이름을 뺐거나 지운 결과가 빈 문자열이면 이름 없음(`device_name` NULL)으로 저장한다. 그래서 `device_name` 에는 빈 문자열이 들어가지 않는다.
- 이미 저장된 빈 문자열 이름은 마이그레이션이 NULL 로 바꾼다. 마이그레이션 파일은 [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md) 의 「구현 위치」에 있다.

## Passkey 삭제

`POST /api/auth/2fa/webauthn/credentials/:id/delete { password }` (JWT 필수, `:id` 는 UUID)는 등록 옵션과 같은 순서로 확인한다.

1. 본문과 `:id` 형식 검증. `password` 가 빠지거나 8자 미만이거나 `:id` 가 UUID 가 아니면 400 `VALIDATION_ERROR`.
2. 기능이 꺼져 있으면 비밀번호를 확인하기 전에 503 `WEBAUTHN_DISABLED`.
3. 비밀번호 확인(`AuthService.verifyPasswordForUser`). 비밀번호가 없는 계정은 401 `PASSWORD_REQUIRED`, 틀리면 401 `PASSWORD_INVALID` 이고 지우지 않는다. `PASSWORD_REQUIRED` 면 화면에 비밀번호 재설정 안내가 나온다.
4. 대상이 없거나 호출자의 것이 아니면 404 `WEBAUTHN_CREDENTIAL_NOT_FOUND`(존재 노출 방지).
5. 지우고 204. 마지막 credential 이었으면 `WebAuthnService.deleteCredential` 이 같은 트랜잭션에서 Passkey 복구 코드를 NULL 로 비운다(DB 트리거가 아니다).

4~5번은 [사용자 행 잠금](#사용자-행-잠금) 안에서 한다. 사용자당 분당 10회로 제한한다(`SENSITIVE_ACTION_THROTTLE`).

## 사용자 행 잠금

Passkey 복구 코드(`user.webauthn_recovery_codes`)를 읽고 쓰는 경로와 그 판단에 쓰는 credential 개수를 바꾸는 경로는 트랜잭션 첫머리에 사용자 행을 `SELECT … FOR NO KEY UPDATE` 로 잠근다. 그래서 같은 사용자의 이 경로들은 차례로 돈다.

| 경로 | 잠금 안에서 하는 일 |
| --- | --- |
| 등록 검증의 저장 | credential 수를 세고 credential 을, 첫 등록이면 복구 코드도 저장 |
| 삭제 | 대상 확인과 삭제, 마지막 credential 이었으면 복구 코드를 NULL 로 비움 |
| 복구 코드 재발급 | 비밀번호 확인 뒤 credential 수를 세고 0개면 403 `WEBAUTHN_NOT_REGISTERED`, 아니면 새 묶음으로 바꿈 |
| 복구 코드 사용 | 저장된 해시와 비교해 맞은 항목을 지움([Passkey 로그인 인증](CLE-ACCT-SIGNIN-PKAUTH.md)) |
| 로그인 2단계 Passkey 인증 검증 | credential 행을 잠그고 counter 를 갱신하거나 역행이면 지움([sign counter 역행과 동시성](CLE-ACCT-SIGNIN-PKAUTH.md#sign-counter-역행과-동시성)) |

- credential 행도 잠그는 경로는 사용자 행을 먼저 잠근다(사용자 행 → credential).
- 사용자가 마지막 credential 을 지운 뒤에는 겹친 재발급 · 복구 코드 사용 · counter 역행 삭제가 있어도 복구 코드가 남지 않는다. 삭제가 아직 커밋되지 않은 등록을 보지 못하고 복구 코드를 비우는 일도 없다.
- 같은 복구 코드를 동시에 두 번 보내면 한 번만 통과하고 다른 요청은 401 `RECOVERY_CODE_INVALID` 다.
- counter 역행으로 마지막 credential 이 지워질 때는 복구 코드를 비우지 않는다([sign counter 역행과 동시성](CLE-ACCT-SIGNIN-PKAUTH.md#sign-counter-역행과-동시성)).
- 잠금 대기 상한은 5초다(`SET LOCAL lock_timeout`). 넘기면(PostgreSQL `55P03`) 롤백하고 일반 500 으로 끝난다.

## 구현 위치

- `codebase/backend/src/modules/auth/webauthn/**` (Passkey 서비스·엔티티·DTO·컨트롤러 파일)
- `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` (Passkey 등록 옵션 · 삭제의 비밀번호 재확인, 등록 옵션 · 복구 코드 재발급 · 삭제의 요청 빈도 제한과 기능 꺼짐 확인 순서)
- `codebase/backend/src/common/config/webauthn.config.ts`
- `codebase/backend/src/modules/users/user-row-lock.ts` (사용자 행 잠금 `lockUserRow` 와 잠금 대기 상한)
- `codebase/backend/src/common/utils/postgres-text.ts` (표시 이름의 NUL 문자 · 코드 포인트 수 검증기)
- `codebase/backend/src/common/utils/postgres-text.spec.ts`, `codebase/backend/src/modules/auth/webauthn/dto/webauthn.dto.spec.ts` (표시 이름 검증기와 등록 검증 · 이름 변경 DTO 의 단위 테스트)
- `codebase/backend/test/webauthn-register-password.e2e-spec.ts` (Passkey 등록 옵션의 비밀번호 재확인, 실패 때 등록 옵션과 `optionsToken` 을 만들지 않음)
- `codebase/backend/src/modules/auth/webauthn/webauthn.service.spec.ts`, `codebase/backend/test/webauthn-2fa.e2e-spec.ts` (사용자 행 잠금을 거치는 경로의 동시 실행, 동시 등록, 삭제의 비밀번호 재확인)
- `codebase/frontend/src/lib/api/auth.ts` (`webauthnRegisterOptions` · `webauthnDeleteCredential` 이 비밀번호를 보낸다)
- `codebase/frontend/src/app/(main)/w/[slug]/profile/security/passkey-card.tsx` (Passkey 등록 · 삭제의 비밀번호 입력과 비밀번호 실패 안내)

## Rationale

### Passkey 라이브러리: `@simplewebauthn/server` 와 `@simplewebauthn/browser`

같은 메인테이너가 서버와 브라우저 모듈을 함께 관리한다. FIDO2 L3·WebAuthn 명세를 빨리 따라가고, 등록과 인증의 `generate`·`verify` 쌍이 대칭이라 코드가 단순하다. 서버 라이브러리가 origin·rpID·challenge 일관성과 서명을 검증한다. counter 역행 판정은 라이브러리에 맡기지 않는다([sign counter 역행과 동시성](CLE-ACCT-SIGNIN-PKAUTH.md#sign-counter-역행과-동시성)). 라이브러리를 올릴 때는 저장 counter 자리에 0 을 넘기면 counter 비교로 에러가 나지 않는지와 `authenticationInfo.newCounter` 가 응답의 counter 인지 확인한다.

서버와 브라우저 모두 v14 를 쓴다(2026-10-16, NERV Task `CLE-T-34HB5X`. 서버 v14 는 Node 20 이상).

- v14 는 양자 내성 암호(PQC)를 지원하는 런타임(Node 26 포함, Node 는 아직 실험 기능으로 표시)에서 기본 알고리즘 목록 맨 앞에 ML-DSA-44(`-48`)를 넣는다. 그래서 등록 옵션과 등록 검증의 `supportedAlgorithmIDs` 를 v13 기본값으로 고정한다. 실제로 받는 알고리즘은 등록 검증이 정하므로 두 호출에 같은 목록을 준다. 이미 등록된 credential 은 같은 알고리즘이라 그대로 인증된다.
- 기본 목록을 그대로 받는 안은 기각했다. ML-DSA credential 은 인증할 때마다 런타임의 실험 기능에 기대서 런타임이 바뀌면 로그인하지 못할 수 있다. PQC 도입은 런타임 지원이 안정된 뒤 따로 정한다.
- 등록 옵션만 고정하는 안도 기각했다. 옵션을 따르지 않는 클라이언트의 ML-DSA 키를 등록 검증이 받아들인다.
- v13 에 머무는 안도 기각했다. 14.0.0(2026-09-02) 뒤로 v13 라인 릴리스가 없다.

### 등록 검증은 transport 목록의 형식만 확인하고 값은 거르지 않는다 (2026-10-16)

전에는 transport 목록을 확인 없이 저장해서 형식에 따라 500 이 나거나 `null` · 숫자 항목이 바뀐 채 저장됐다(NERV Task `CLE-T-C5EWSD`).

- 형식이 틀린 값은 등록 검증 실패(400 `WEBAUTHN_VERIFY_FAILED`)로 본다. 브라우저의 `getTransports()` 는 문자열 배열만 돌려주므로(`null` 도 돌려주지 않는다) 다른 형식은 클라이언트 결함이나 조작한 요청이다. 클라이언트가 할 일이 다른 등록 검증 실패와 같아 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 규칙 6 의 새 조건이 아니다(목록 밖 알고리즘도 같다). `details` 는 싣지 않고 원인은 서버 로그에만 남긴다.
- 요청 DTO 의 400 `VALIDATION_ERROR` 는 기각했다. `response` 는 브라우저가 만든 객체를 통째로 받는 자리라 DTO 가 속을 검증하지 않고, transport 만 다른 코드를 쓰면 같은 객체 안에서 코드가 둘이 된다.
- 표준에 없는 값만 걸러 내는 안은 기각했다. WebAuthn Level 3 §2.1.1 은 RP 가 모르는 값도 처리하라고 하고, §4 는 transport 목록의 항목을 바꾸거나 빼면 그 credential 을 쓰지 못할 수 있다고 한다. 서버 v14 의 타입도 `string[]` 이다.
- 빈 목록으로 바꿔 저장하는 안과 NUL 문자가 든 항목만 빼는 안도 기각했다. 잘못된 요청을 성공으로 받으면 클라이언트 결함을 찾기 어렵고, 값을 바꾸지 않고 저장한다는 원칙이 깨진다. 필드가 빠진 요청만 빈 목록으로 저장한다.
- 개수와 길이 상한은 두지 않는다. 요청 본문에 전역 100KB 한도가 걸린다.

### Passkey 표시 이름은 요청 DTO 에서 코드 포인트 수와 NUL 문자를 확인한다 (2026-10-17)

요청 DTO 가 문자열인지와 `MaxLength(100)` 만 확인해서 저장할 수 없는 이름이 500 이 났다(NERV Task `CLE-T-XYW44D`). NUL 문자가 든 이름은 PostgreSQL 이 UTF8 인코딩 에러로 거부했다. 변형 선택자가 붙은 101 코드 포인트 이름은 class-validator 의 `MaxLength` 가 한 글자로 세서 통과했고 `varchar(100)` 이 거부했다.

- 에러 코드는 `VALIDATION_ERROR` 다. 표시 이름은 사용자가 입력한 최상위 필드라 요청 DTO 가 검증한다. 인증기 응답의 검증 실패를 뜻하는 `WEBAUTHN_VERIFY_FAILED` 는 기각했다. 표시 이름은 인증기 응답에 들지 않는다.
- 그래서 등록 검증 요청 하나에서 코드는 필드 자리로 갈린다. `response` 안은 `WEBAUTHN_VERIFY_FAILED`, 표시 이름은 `VALIDATION_ERROR` 다. DTO 검증이 서비스 검증보다 먼저 돌아서 표시 이름과 `response` 나 `optionsToken`(서비스가 확인하는 400 `INVALID_OPTIONS_TOKEN`)이 함께 틀리면 `VALIDATION_ERROR` 다.
- 표시 이름 전용 에러 코드는 기각했다. 클라이언트가 할 일이 다른 입력 검증 실패와 같아 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#규칙) 규칙 6 의 새 조건이 아니다. 틀린 필드는 [에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md#23-도메인-세부-사유를-어디에-싣는가-top-level-code-교체와-detailscode) §2.3 · §2.5 에 따라 `details[]` 에 싣는다.
- 길이는 저장하는 쪽과 같은 코드 포인트로 센다. OpenAPI 스키마의 `maxLength` 도 코드 포인트라 API 문서와 서버의 기준이 같다. 화면 입력란은 UTF-16 단위로 세서 더 엄격하므로 화면에서 입력한 이름은 이 규칙에 걸리지 않는다.
- grapheme 수로 세는 안은 기각했다. ZWJ 로 이은 이모지처럼 grapheme 하나가 코드 포인트 여럿이라 grapheme 100개짜리 이름은 `varchar(100)` 에 들어가지 않을 수 있다.
- NUL 문자를 지우고 저장하는 안은 기각했다. 사용자가 보낸 이름을 알리지 않고 바꾸게 된다.
- 전역 예외 필터에서 SQLSTATE 22021 · 22001 을 400 으로 바꾸는 안은 기각했다. 저장할 수 없는 값은 요청 입구에서 거부한다는 기존 방식(`codebase/backend/src/common/utils/optional-non-null.ts`, [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#64-유효성-검증) §6.4 의 `X-Workspace-Id` 형식 에러 행)과 맞지 않고, 틀린 필드도 응답에 담을 수 없다. 필터가 23505 를 409 `RESOURCE_CONFLICT` 로 바꾸는 것은 중복을 동시 요청 때문에 입구에서 알 수 없어서다.

### Passkey 이름 변경은 공백 문자로만 된 이름을 거부한다 (2026-10-17)

이름 변경 DTO 는 빈 문자열만 거부해서(`MinLength(1)`) 공백 문자로만 된 이름이 빈 문자열로 저장됐다. 목록 화면은 이름이 NULL 일 때만 기본 문구를 보여 줘서 이름이 빈 칸으로 보였고, 이름이 없다는 값이 NULL 과 빈 문자열 두 가지로 갈렸다(NERV Task `CLE-T-SREW0S`). 화면은 저장 버튼을 막으므로 API 를 직접 부를 때만 생긴다.

- 이름 변경은 공백 문자로만 된 이름을 빈 문자열과 같은 400 `VALIDATION_ERROR` 로 거부한다. 화면에는 이름을 지우는 기능이 없다. 이름 없음(NULL)으로 저장하는 안은 기각했다. 이름을 지우는 기능이 새로 생기는데 빈 문자열은 계속 거부해 같은 뜻의 두 입력이 다르게 처리된다.
- 등록 검증은 그대로 둔다. 표시 이름이 선택 필드라 빈 이름과 공백 문자로만 된 이름을 이름을 주지 않은 요청과 같게 보고 NULL 로 저장한다. 두 요청의 뜻이 달라서 생기는 의도한 차이다.
- 길이는 앞뒤 공백을 지우기 전 값으로 센다. 보낸 값을 그대로 검사해야 클라이언트가 지킬 규칙이 단순하다. 그래서 앞뒤 공백까지 합해 100개를 넘으면 지운 뒤 100개 이하여도 400 이다.
- 앞뒤 공백 문자를 지우는 것은 NUL 문자를 지우는 안을 기각한 이유의 예외다. 이름 가운데 글자는 그대로 두고 보이지 않는 앞뒤 공백만 지우고, 저장한 이름은 목록과 응답에 그대로 나온다. 공백 문자의 범위는 저장할 때 지우는 문자와 맞추려고 `trim()` 기준을 쓴다. U+200B 처럼 `trim()` 이 지우지 않는 문자는 이번 결정 밖이다.
- 이미 저장된 빈 문자열 이름은 마이그레이션(UPDATE 문 하나)으로 NULL 로 바꾼다. 원래 NULL 이던 행과 구분할 수 없어 되돌리지 않고 `-- DOWN:` 주석에 이유를 적는다. 화면이 빈 문자열도 기본 문구로 그리게 고치는 안은 같은 뜻의 값이 두 가지로 남아 기각했다.
- 빈 문자열을 막는 CHECK 제약은 더하지 않는다. `device_name` 을 쓰는 두 경로 모두 빈 문자열을 저장하지 않는다.

### Passkey 환경 변수가 없으면 기능만 끈다

`WEBAUTHN_RP_ID`·`WEBAUTHN_ORIGIN` 이 없고 `WEBAUTHN_ALLOW_FALLBACK` 이 `1` 이 아니면 부팅을 거부하지 않고 `enabled=false` 로 둔다.

- Passkey 는 부가 인증 수단이지 인증의 핵심 경로가 아니다. 그래서 기능이 꺼져도 부팅과 Passkey 를 등록하지 않은 사용자의 로그인, TOTP 로그인은 동작해야 한다.
- 운영자가 환경 변수를 한 번에 다 설정하지 않는 셀프 호스팅 점진 도입을 막지 않는다.
- localhost 같은 잘못된 폴백으로 등록 데이터가 쌓이면 도메인을 정할 때 모두 무효가 된다. 자동 폴백보다 명시적 활성화가 안전하다.
- Passkey 만 쓰는 사용자(TOTP 꺼짐)는 설정이 꺼지면 비밀번호로 로그인하지 못한다(503 `WEBAUTHN_DISABLED`, [Passkey 기능이 꺼지면 Passkey 만 등록한 계정의 로그인을 막는다](CLE-ACCT-SIGNIN-LOGIN.md#passkey-기능이-꺼지면-passkey-만-등록한-계정의-로그인을-막는다-2026-10-17)). 운영자가 한 번 켰다면 그대로 두는 것이 정상 운영이다. 실수로 꺼지면 Passkey 복구 코드로 TOTP 를 등록하는 우회 경로가 없어 운영자 개입이 필요하다. 설정을 바꾸기 전에 사용자에게 공지하는 것을 권한다.
- 폴백이 필요한 개발·로컬·시연에는 `WEBAUTHN_ALLOW_FALLBACK=1` 을 남겨 둔다.

### Passkey 기능이 꺼져도 credential 목록 조회는 빈 목록을 준다 (2026-11-05)

구현의 credential 목록 조회는 기능이 꺼져 있으면 200 `{ items: [] }` 를 돌려줬고 사람이 구현을 유지하기로 정했다(NERV Task `CLE-T-693G4E`).

- Passkey 설정 카드는 가용성 조회가 `enabled: false` 면 목록을 부르지 않고 카드를 숨긴다. 빈 목록 응답은 가용성 조회 결과가 아직 켜짐으로 남아 있는 동안(설정이 바뀐 직후)에만 카드에 쓰이고, 그때도 카드는 에러 없이 빈 목록을 그린다.
- 목록을 비워 보내므로 기능이 꺼진 동안 이름 변경 · 삭제를 시작할 항목이 화면에 없다. 이름 변경과 삭제는 그대로 503 이다.
- 저장된 행은 지우지 않는다. 운영자가 기능을 다시 켜면 목록에 그대로 나온다.
- **기각: 목록 조회도 503 으로 맞춘다.** 구현을 바꿔야 하고 설정 화면이 목록 에러를 따로 처리해야 한다. 얻는 것은 없다.

### Passkey 등록에도 비밀번호 재확인을 두고 TOTP 대기 secret 은 10분 뒤 버린다 (2026-11-02)

NERV Task `CLE-T-FRCRF7` 에서 사람 결정 세 건으로 정했다. [TOTP 켜기는 비밀번호를 다시 확인하고 켜진 계정을 거부한다](CLE-ACCT-SIGNIN-TOTP.md#totp-켜기는-비밀번호를-다시-확인하고-켜진-계정을-거부한다-2026-11-01) 가 미룬 Passkey 등록의 비밀번호 재확인과 요청 빈도 제한 정렬, 그리고 [대기 secret](CLE-ACCT-SIGNIN-TOTP.md#totp-켜기) 의 수명을 함께 정했다.

Passkey 등록 옵션의 비밀번호 재확인:

- **등록 옵션에서 비밀번호를 재확인한다.** 로그인 세션만 가진 사람이 자기 인증기를 Passkey 로 등록하면 원래 사용자는 다음 로그인에서 막힌다. Passkey 가 하나라도 있으면 로그인 2단계는 Passkey 로만 통과하기 때문이다. 첫 등록의 Passkey 복구 코드도 등록한 사람에게만 보인다. TOTP 설정 시작에서 막은 공격과 같아서 본문 · 확인 함수 · 에러 코드를 TOTP 설정 시작과 맞췄다.
- **등록 옵션 한 곳에서만 받는다.** `optionsToken` 은 발급받은 사용자(`sub`)에 묶이고 5분 안에만 유효해서 재확인 한 번이 그 등록을 덮는다.
- **기능이 꺼져 있으면 비밀번호를 확인하기 전에 거부한다.** 기능을 끈 서버에서 비밀번호 대조를 돌리지 않는다. 복구 코드 재발급도 같다.
- **이미 등록한 Passkey 는 그대로 쓴다.** 등록 옵션만 막고(삭제는 2026-11-14 결정) 기존 credential 에 확인을 다시 요구하지 않는다. Passkey 삭제 · 이름 변경에는 비밀번호 재확인을 더하지 않았다. 삭제에는 2026-11-14 에 더했다([아래](#passkey-삭제에도-비밀번호-재확인을-둔다-2026-11-14)).
- **비용**: OAuth 전용 사용자는 비밀번호 재설정으로 비밀번호를 만든 뒤 Passkey 를 등록한다. 그래서 비밀번호 없이 Passkey 만 등록한 OAuth 전용 계정은 이 결정 전에 등록한 경우만 남는다.
- **기각: 비밀번호 또는 TOTP 로 계정 재인증(`SessionsService.reauthenticate`)을 받는다.** 비밀번호 없이 TOTP 만 있는 계정은 TOTP 코드로 등록할 수 있게 되어 비밀번호만 받는 TOTP 설정 시작과 규칙이 갈린다.
- **기각: 이번에도 더하지 않고 미결로 남긴다.** 로그인 세션을 탈취한 사람이 자기 인증기를 등록해 원래 사용자를 잠그는 공격이 남는다.

요청 빈도 제한:

- **`SENSITIVE_ACTION_THROTTLE` 을 세 라우트에 더 건다.** Passkey 등록 옵션, Passkey 복구 코드 재발급, TOTP 활성화 검증이다. 사용자당 분당 10회이고 넘으면 429 다. 그래서 `verifyPasswordForUser` 를 부르는 라우트가 모두 이 한도를 쓴다. 단위 테스트가 라우트 목록을 고정해 핸들러마다 한도를 확인한다.
- **한도는 라우트마다 따로 센다.** 등록 검증에는 걸지 않는다. 한도가 걸린 등록 옵션의 `optionsToken` 이 있어야 저장한다.
- **기각: 비밀번호를 확인하는 라우트에만 건다.** 그러면 비밀번호 확인 한 번으로 할 수 있는 TOTP 코드 추측이 전역 한도(사용자당 분당 100회)에만 묶여 10분에 최대 1,000회가 된다.
- **기각: 바꾸지 않는다.** 복구 코드 재발급 라우트에 전용 한도가 없어 그 라우트로 설정 시작의 한도를 우회해 비밀번호를 추측할 수 있다.

TOTP 대기 secret 의 10분 만료와 기각한 안은 [2단계 인증 설정과 TOTP](CLE-ACCT-SIGNIN-TOTP.md#totp-대기-secret-은-설정-시작-10분-뒤-버린다-2026-11-02) 로 옮겼다(2026-11-14, 문서 크기 한도).

### Passkey 도메인 모듈을 분리한다

Passkey 관련 엔티티·서비스·DTO·컨트롤러·테스트는 `codebase/backend/src/modules/auth/webauthn/` 에 두고 `WebAuthnModule` 로 묶는다. 파일은 `webauthn.service.ts` · `entities/webauthn-credential.entity.ts` · `dto/webauthn.dto.ts` · `dto/responses/webauthn-response.dto.ts` · `webauthn.module.ts` · `webauthn.controller.ts`(`/auth/2fa/webauthn/...`)다. `AuthModule` 이 `WebAuthnModule` 을 import 해 `WebAuthnService` 를 주입받는다. 의존 방향은 `AuthModule → WebAuthnModule` 한 방향이다.

- `AuthService` 는 credential repository 를 직접 주입하지 않고 `WebAuthnService.countStoredCredentials()` 와 `isEnabled()` 를 쓴다. 로그인 쪽 판정은 `AuthService.passkeyState()` 한 곳에 모았다.
- `LoginHistoryService` 는 `AuthModule` 과 `WebAuthnModule` 양쪽에 provider 로 둔다. 두 인스턴스가 같은 테이블에 INSERT 만 하므로 동작이 같다. 별도 모듈 분리는 후속 과제다.
- `WebAuthnController` 파일은 `webauthn/` 폴더에 두지만 모듈 등록은 `AuthModule` 의 `controllers` 에 한다. 컨트롤러가 챌린지 토큰 소비와 2단계 뒤 토큰 발급에 `AuthService` 를 써야 하기 때문이다. `WebAuthnModule` 에 등록하면 역방향 의존이 생긴다.
- 두 컨트롤러가 함께 쓰는 리프레시 토큰 쿠키 함수는 `auth/utils/refresh-cookie.ts` 에 둔다.
- 채택 이유: 로그인 · 가입 · OAuth · 로그인 세션 · TOTP 에 Passkey 까지 한 모듈에 있으면 응집도가 낮다. 한 방향 의존으로 순환을 막는다.

### Passkey 등록 저장을 한 트랜잭션으로 묶는다 (2026-11-14)

NERV Task `CLE-T-9KCQ7Y` 에서 정했다. 전에는 credential 과 복구 코드를 따로 저장해 복구 코드 없는 credential 이 남을 수 있었고 동시 첫 등록은 복구 코드 묶음을 서로 덮어썼다. 같은 credential 의 동시 등록은 409 `RESOURCE_CONFLICT` 였다.

- **사용자 행 잠금 안에서 세고 저장한다.** 그래야 첫 등록 판정이 한 요청에서만 참이다. 다른 사용자의 등록은 막지 않는다.
- **먼저 잠근 요청이 복구 코드를 받는다.** 나중 요청은 복구 코드 없이 저장한다.
- **동시 중복도 409 `WEBAUTHN_CREDENTIAL_EXISTS` 다.** 순차 중복과 뜻이 같다.
- **기각: 잠금 없이 트랜잭션만 둔다.** READ COMMITTED 에서는 두 요청이 모두 credential 0개를 읽어 둘 다 첫 등록이 된다.
- **기각: 복구 코드를 `IS NULL` 조건부 UPDATE 로 저장한다.** 덮어쓰기는 막지만 credential 과 복구 코드가 따로 커밋되고 삭제와의 경합도 남는다.

### Passkey 삭제에도 비밀번호 재확인을 둔다 (2026-11-14)

NERV Task `CLE-T-Q6E11N` 에서 사람이 정했다(NERV 질문 `01a1d82c-12ac-7097-b633-c750fb3db127`). 토큰만으로 지울 수 있으면 로그인 세션만 손에 넣은 사람이 credential 을 모두 지워 Passkey 2단계 인증을 끌 수 있다.

- **모든 삭제에 비밀번호만 다시 받는다.** 확인 방식 · 에러 코드 · 한도는 등록 옵션 · 복구 코드 재발급과 같고 기능 꺼짐 503 을 먼저 낸다.
- **비밀번호가 없는 계정은 401 `PASSWORD_REQUIRED` 로 막는다.** 2026-11-02 전에 Passkey 를 등록한 OAuth 전용 계정이다. 화면에서 비밀번호 재설정을 안내한다. 복구 코드 재발급과 같은 규칙이다.
- **`DELETE` 를 없애고 `POST …/:id/delete` 로 옮겼다.** 이유는 [HTTP URL 규약 「본문을 받아야 하는 삭제를 `POST …/delete` 로 받는다」](../CLE-API/CLE-API-CONV-URL.md#본문을-받아야-하는-삭제를-post-delete-로-받는다-2026-11-14) 에 있다. `DELETE` 를 남기면 토큰만으로 지우는 길이 남는다. 프런트엔드와 함께 배포한다.
- **이름 변경(`PATCH`)은 그대로 둔다.** 인증 수단을 바꾸지 않는다.
- **기각: 마지막 credential 삭제에만 받는다.** 다른 credential 을 지우는 것도 쓰던 인증 수단을 없애고, 남은 개수에 따라 규칙이 갈린다.
- **기각: 비밀번호 또는 TOTP 로 재인증한다.** 비밀번호만 받는 다른 민감 동작과 규칙이 갈린다(등록 옵션과 같은 이유).

### 복구 코드를 읽고 쓰는 경로도 사용자 행 잠금 아래 둔다 (2026-11-14)

NERV Task `CLE-T-HQQNEA` 에서 정했다. 등록 저장과 삭제만 사용자 행을 잠가서 재발급 · 복구 코드 사용 · counter 역행 삭제가 마지막 credential 삭제와 겹치면 credential 없이 복구 코드가 남았고, 같은 복구 코드를 동시에 두 번 보내면 둘 다 통과했다.

- **복구 코드를 읽고 쓰는 경로와 credential 개수를 바꾸는 경로를 모두 같은 잠금에 넣는다.** 잠금 함수(`lockUserRow`)를 users 모듈에 하나 두고 다섯 경로가 함께 부른다.
- **잠금 순서는 사용자 행 → credential 이다.** 인증 검증도 credential 행보다 사용자 행을 먼저 잠근다. 순서가 갈리면 삭제와 교착한다.
- **잠금 대기 상한은 5초다.** 같은 사용자끼리만 줄을 서고 잠금을 잡은 쪽은 외부 호출 없이 몇 문장만 돈다. 나가기 · 멤버 제거 · 트리거 삭제의 잠금과 같은 값이다.
- **counter 역행 삭제는 잠금만 더하고 복구 코드는 비우지 않는다.** [Passkey 로그인 인증](CLE-ACCT-SIGNIN-PKAUTH.md) 의 2026-10-17 결정(NERV Task `CLE-T-D331TT`)을 유지한다.
- **기각: 복구 코드 사용을 조건부 UPDATE(코드를 빼면서 그 코드가 남아 있는지 조건으로 확인)로 바꾼다.** 같은 코드 두 번은 막지만 재발급이 보는 credential 개수는 다른 테이블에 있어 재발급과 삭제의 경합이 남고 경로마다 방식이 갈린다.
