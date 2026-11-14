---
id: "CLE-ACCT-SIGNIN-PASSKEY"
title: "가입과 로그인 — Passkey 기능과 등록"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ACCT-SIGNIN"
ancestors: ["CLE-VISION", "CLE-ACCT", "CLE-ACCT-SIGNIN"]
area: "CLE-ACCT"
content_hash: "911932e68394b9d5a1aca780fbe7296ac6d2f5af03a8fc703f7570b913b6da21"
read_as: "approved_fallback"
task: "CLE-T-Q6E11N"
source_paths: []
mirror_sha256: "c4fec2138dd285b6ed4ec5aa6270eb3c0896f2d523c4f75e57aafaf9826ef0f5"
etag: "sha256-2190dac18ae1de469afcc1b586824d8c44b909a9e83ca3a08e491df5bd407a81"
---
## 개요

이 문서는 [가입과 로그인](CLE-ACCT-SIGNIN.md) 의 하위 문서로 Passkey·보안 키 기능을 켜는 환경 변수와 꺼졌을 때의 동작, Passkey 등록 흐름(비밀번호 재확인, 저장 원자성, 공개 키 알고리즘, transport 목록, 표시 이름), Passkey 복구 코드 재발급, Passkey 삭제, Passkey 도메인 모듈 구성을 정한다. 로그인 2단계 Passkey 인증 검증과 sign counter 역행은 [Passkey 로그인 인증](CLE-ACCT-SIGNIN-PKAUTH.md), 복구 코드 묶음은 [2단계 인증 설정과 TOTP 「복구 코드」](CLE-ACCT-SIGNIN-TOTP.md#복구-코드) 에 있다.

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

등록 검증의 저장은 한 트랜잭션이다. 사용자 행을 잠그고(`pessimistic_write`) credential 수를 센 뒤 credential 을, 첫 등록이면 복구 코드도 저장한다. 같은 사용자의 첫 등록이 동시에 오면 먼저 잠근 요청만 복구 코드를 받고 나머지는 복구 코드 없이 저장한다. 복구 코드를 저장하지 못하면 credential 도 저장하지 않는다. 같은 credential ID 가 이미 있으면(동시 등록 포함) 아무것도 저장하지 않고 409 `WEBAUTHN_CREDENTIAL_EXISTS` 로 거부한다.

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

1. 본문 검증. `password` 가 빠지거나 8자 미만이면 400 `VALIDATION_ERROR`.
2. 기능이 꺼져 있으면 비밀번호를 확인하기 전에 503 `WEBAUTHN_DISABLED`.
3. 비밀번호 확인(`AuthService.verifyPasswordForUser`). 비밀번호가 없는 계정은 401 `PASSWORD_REQUIRED`, 틀리면 401 `PASSWORD_INVALID` 이고 지우지 않는다. `PASSWORD_REQUIRED` 면 화면에 비밀번호 재설정 안내가 나온다.
4. 대상이 없거나 호출자의 것이 아니면 404 `WEBAUTHN_CREDENTIAL_NOT_FOUND`(존재 노출 방지).
5. 지우고 204. 마지막 credential 이었으면 `WebAuthnService.deleteCredential` 이 같은 트랜잭션에서 Passkey 복구 코드를 NULL 로 비운다(DB 트리거가 아니다).

4~5번은 등록 검증과 같은 사용자 행 잠금 안에서 한다. 그래서 마지막 credential 삭제와 첫 등록이 겹쳐도 credential 이 남았는데 복구 코드가 없는 상태가 생기지 않는다. 사용자당 분당 10회로 제한한다(`SENSITIVE_ACTION_THROTTLE`).

## 구현 위치

- `codebase/backend/src/modules/auth/webauthn/**` (Passkey 서비스·엔티티·DTO·컨트롤러 파일)
- `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` (Passkey 등록 옵션 · 삭제의 비밀번호 재확인, 등록 옵션 · 복구 코드 재발급 · 삭제의 요청 빈도 제한과 기능 꺼짐 확인 순서)
- `codebase/backend/src/common/config/webauthn.config.ts`
- `codebase/backend/src/common/utils/postgres-text.ts` (표시 이름의 NUL 문자 · 코드 포인트 수 검증기)
- `codebase/backend/src/common/utils/postgres-text.spec.ts`, `codebase/backend/src/modules/auth/webauthn/dto/webauthn.dto.spec.ts` (표시 이름 검증기와 등록 검증 · 이름 변경 DTO 의 단위 테스트)
- `codebase/backend/test/webauthn-register-password.e2e-spec.ts` (Passkey 등록 옵션의 비밀번호 재확인, 실패 때 등록 옵션과 `optionsToken` 을 만들지 않음)
- `codebase/backend/src/modules/auth/webauthn/webauthn.service.spec.ts`, `codebase/backend/test/webauthn-2fa.e2e-spec.ts` (등록 저장 · 삭제의 잠금 트랜잭션, 동시 등록, 삭제의 비밀번호 재확인)
- `codebase/frontend/src/lib/api/auth.ts` (`webauthnRegisterOptions` · `webauthnDeleteCredential` 이 비밀번호를 보낸다)
- `codebase/frontend/src/app/(main)/w/[slug]/profile/security/passkey-card.tsx` (Passkey 등록 · 삭제의 비밀번호 입력과 비밀번호 실패 안내)

## Rationale

### Passkey 라이브러리: `@simplewebauthn/server` 와 `@simplewebauthn/browser`

같은 메인테이너가 서버와 브라우저 모듈을 함께 관리한다. FIDO2 L3·WebAuthn 명세를 빨리 따라가고, 등록과 인증의 `generate`·`verify` 쌍이 대칭이라 코드가 단순하다. 서버 라이브러리가 origin·rpID·challenge 일관성과 서명을 검증한다. counter 역행 판정은 라이브러리에 맡기지 않는다([sign counter 역행과 동시성](CLE-ACCT-SIGNIN-PKAUTH.md#sign-counter-역행과-동시성)). 라이브러리를 올릴 때는 저장 counter 자리에 0 을 넘기면 counter 비교로 에러가 나지 않는지와 `authenticationInfo.newCounter` 가 응답의 counter 인지 확인한다.

서버와 브라우저 모두 v14 를 쓴다. 서버를 v13 에서 v14 로 올리면서 정한 것은 다음과 같다(2026-10-16, NERV Task `CLE-T-34HB5X`).

- 서버 v14 의 `engines` 는 Node 20 이상이다. 지금 런타임은 Node 26 이다.
- v14 는 양자 내성 암호(Post-Quantum Cryptography, PQC)를 지원하는 런타임에서 등록 옵션과 등록 검증의 기본 알고리즘 목록 맨 앞에 PQC 서명 알고리즘 ML-DSA 의 44 파라미터 세트(COSE 알고리즘 식별자 `-48`)를 넣는다. Node 26 이 그 경우이고 Node 는 이 Web Crypto 알고리즘을 아직 실험 기능으로 표시한다.
- 그래서 등록 옵션(`generateRegistrationOptions`)과 등록 검증(`verifyRegistrationResponse`)의 `supportedAlgorithmIDs` 를 v13 기본값인 EdDSA(`-8`) · ES256(`-7`) · RS256(`-257`)으로 고정한다. 옵션은 브라우저에 주는 안내이고 실제로 받는 알고리즘은 등록 검증이 정하므로 두 호출에 같은 목록을 준다. 인증 검증에는 이 목록이 없다.
- 기본 목록을 그대로 받는 안은 기각했다. ML-DSA 키로 등록한 credential 은 인증할 때마다 런타임의 실험 기능에 기댄다. 런타임을 바꾸거나 그 기능이 바뀌면 그 사용자가 로그인하지 못할 수 있다. PQC 도입은 런타임 지원이 안정된 뒤 따로 정한다.
- 등록 옵션만 고정하는 안도 기각했다. 옵션을 따르지 않는 클라이언트가 ML-DSA 키를 보내면 등록 검증이 받아들인다.
- v13 에 머무는 안도 기각했다. 14.0.0(2026-09-02) 뒤로 v13 라인 릴리스가 없고 그 뒤 수정은 모두 v14 릴리스로 나왔다.
- 이미 등록된 credential 은 v13 과 같은 알고리즘이라 그대로 인증된다.

### 등록 검증은 transport 목록의 형식만 확인하고 값은 거르지 않는다 (2026-10-16)

서비스가 transport 목록을 확인 없이 `webauthn_credential.transports`(문자열 배열 컬럼)에 저장해서 문자열 배열이 아닌 값 가운데 일부는 500 이 났고, `null` 은 빈 목록으로 저장되고 200 을 받았고, 숫자 항목은 문자열로 바뀌어 저장됐다. NERV Task `CLE-T-C5EWSD` 에서 아래처럼 정했다.

- 형식이 틀린 값은 등록 검증 실패로 본다. 브라우저의 `getTransports()` 는 문자열 배열만 돌려주므로 다른 형식은 클라이언트 결함이나 조작한 요청이다. 응답의 다른 필드가 틀렸을 때와 같은 400 `WEBAUTHN_VERIFY_FAILED` 를 쓴다. 클라이언트가 할 일이 다른 등록 검증 실패와 같아서 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 규칙 6 의 새 조건이 아니다(허용 목록 밖 알고리즘도 같다). 이 응답에는 `details` 를 싣지 않고 원인은 서버 로그에만 남긴다.
- 요청 DTO 검증으로 400 `VALIDATION_ERROR` 를 내는 안은 기각했다. `response` 는 브라우저가 만든 객체를 통째로 받는 자리라 DTO 가 속을 검증하지 않는다. transport 만 다른 코드를 쓰면 같은 `response` 객체 안의 필드끼리 코드가 둘이 된다. `response` 밖의 최상위 입력 필드인 표시 이름은 이 범위가 아니다(아래 표시 이름 절).
- 표준에 없는 값만 걸러 내는 안은 기각했다. WebAuthn Level 3 §2.1.1 에 따르면 열거 값은 문자열이고 RP 는 모르는 값도 처리해야 한다. §4 에는 credential record 의 transport 목록에서 항목을 바꾸거나 빼면 그 credential 을 쓰지 못할 수도 있다고 적혀 있다. 서버 v14 의 타입도 `string[]` 이다.
- 형식이 틀린 값을 빈 목록으로 바꿔 저장하는 안도 기각했다. 잘못된 요청을 성공으로 받으면 클라이언트 결함을 찾기 어렵다. 필드가 빠진 요청은 선택 필드가 빠진 것이라서 빈 목록으로 저장한다.
- `null` 은 필드가 빠진 것으로 보지 않고 400 으로 거부한다. 브라우저의 `getTransports()` 는 `null` 을 돌려주지 않는다.
- NUL 문자가 든 항목만 빼고 나머지를 저장하는 안도 기각했다. 값을 바꾸지 않고 저장한다는 원칙을 지키려고 요청 전체를 거부한다.
- 개수와 길이 상한은 따로 두지 않는다. 이 엔드포인트의 요청 본문에는 전역 100KB 한도가 걸린다.

### Passkey 표시 이름은 요청 DTO 에서 코드 포인트 수와 NUL 문자를 확인한다 (2026-10-17)

요청 DTO 가 문자열인지와 `MaxLength(100)` 만 확인해서 저장할 수 없는 이름이 검증을 지나 500 이 났다(NERV Task `CLE-T-XYW44D`). NUL 문자가 든 이름은 PostgreSQL 이 `invalid byte sequence for encoding "UTF8": 0x00` 으로 거부했다. 변형 선택자가 붙은 101 코드 포인트 이름은 class-validator 의 `MaxLength` 가 앞 글자와 변형 선택자(U+FE0E · U+FE0F)를 한 글자로 세서 통과시켰고 PostgreSQL 이 `value too long for type character varying(100)` 으로 거부했다.

- 에러 코드는 `VALIDATION_ERROR` 다. 표시 이름은 사용자가 입력한 최상위 필드라서 요청 DTO 가 검증한다. `WEBAUTHN_VERIFY_FAILED` 를 쓰는 안은 기각했다. 그 코드는 인증기 응답의 검증 실패를 뜻하는데 표시 이름은 인증기 응답에 들지 않는다. transport 목록이 DTO 검증을 쓰지 않은 이유(브라우저가 만든 객체를 통째로 받는 자리)도 표시 이름에는 해당하지 않는다.
- 그래서 등록 검증 요청 하나에서 에러 코드는 필드가 있는 자리로 갈린다. `response` 객체 안의 필드는 `WEBAUTHN_VERIFY_FAILED`, 표시 이름은 `VALIDATION_ERROR` 다. 요청 DTO 검증이 서비스 검증보다 먼저 돌아서 표시 이름과 `response` 안의 필드가 함께 틀린 요청은 `VALIDATION_ERROR` 를 받는다. `optionsToken` 의 서명 · 만료 확인(400 `INVALID_OPTIONS_TOKEN`)도 서비스가 하므로 표시 이름과 `optionsToken` 이 함께 틀린 요청도 `VALIDATION_ERROR` 다.
- 표시 이름 전용 에러 코드를 새로 두는 안은 기각했다. 클라이언트가 할 일은 다른 입력 검증 실패와 같이 그 필드를 고쳐 다시 보내는 것이라 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#규칙) 규칙 6 의 새 조건이 아니다. 어느 필드가 틀렸는지는 [에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md#23-도메인-세부-사유를-어디에-싣는가-top-level-code-교체와-detailscode) §2.3 · §2.5 에 따라 `details[]` 에 싣는다.
- 길이는 저장하는 쪽과 같은 단위인 코드 포인트로 센다. OpenAPI 스키마의 `maxLength` 도 코드 포인트로 세므로 API 문서와 서버의 기준이 같다. 화면의 이름 입력란은 `maxLength` 를 UTF-16 단위로 세서 이보다 엄격하다. 그래서 화면에서 입력한 이름은 이 규칙에 걸리지 않는다.
- 사람이 보는 글자(grapheme) 수로 세는 안은 기각했다. `varchar(100)` 은 코드 포인트로 세므로 grapheme 100개짜리 이름은 저장하지 못할 수 있다. ZWJ 로 이은 이모지는 한 글자로 보여도 코드 포인트가 여러 개다.
- NUL 문자를 지우고 저장하는 안은 기각했다. 사용자가 보낸 이름을 알리지 않고 바꾸게 된다.
- 전역 예외 필터에서 SQLSTATE 22021 · 22001 을 400 으로 바꾸는 안은 기각했다. 저장할 수 없는 값은 요청 입구에서 미리 거부한다는 기존 방식(`codebase/backend/src/common/utils/optional-non-null.ts`)과 맞지 않는다. [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#64-유효성-검증) §6.4 의 `X-Workspace-Id` 형식 에러 행도 같은 방식이다(입구에서 거부하지 않으면 SQLSTATE 22P02 가 500 `INTERNAL_ERROR` 로 가려진다). 필터에서 바꾸면 어느 필드가 틀렸는지도 응답에 담을 수 없다. 전역 필터가 SQLSTATE 23505 를 409 `RESOURCE_CONFLICT` 로 바꾸는 것은 중복을 동시 요청 때문에 입구에서 미리 알 수 없어서다. 형식 에러는 입구에서 알 수 있다.

### Passkey 이름 변경은 공백 문자로만 된 이름을 거부한다 (2026-10-17)

이름 변경 DTO 는 빈 문자열만 거부해서(`MinLength(1)`) 공백 문자로만 된 이름이 앞뒤 공백을 지운 빈 문자열로 저장됐다. 목록 화면은 이름이 NULL 일 때만 기본 문구를 보여 줘서 이름이 빈 칸으로 보였고, 이름이 없다는 같은 뜻의 값이 데이터베이스에 NULL 과 빈 문자열 두 가지로 갈렸다(NERV Task `CLE-T-SREW0S`). 화면은 저장 버튼을 막으므로 API 를 직접 부를 때만 생기는 경우다.

- 이름 변경은 공백 문자로만 된 이름을 빈 문자열과 같은 400 `VALIDATION_ERROR` 로 거부한다. 이름 변경은 이름을 바꾸는 요청이고 화면에는 이름을 지우는 기능이 없다.
- 이름 없음(NULL)으로 저장하는 안은 기각했다. 이름을 지우는 기능이 새로 생기는데 빈 문자열은 계속 거부하므로 같은 뜻의 두 입력이 다르게 처리된다.
- 등록 검증은 그대로 둔다. 표시 이름이 선택 필드라서 빈 이름과 공백 문자로만 된 이름은 이름을 주지 않은 요청과 같게 보고 NULL 로 저장한다. 두 요청의 뜻이 달라서 생기는 의도한 차이다.
- 길이는 앞뒤 공백을 지우기 전 값으로 센다. 보낸 값을 그대로 검사해서 클라이언트가 지킬 규칙이 단순하다. 지운 뒤 값으로 세려면 두 DTO 에서 검증 전에 값을 바꿔야 한다. 그래서 앞뒤 공백까지 합해 코드 포인트 100개를 넘는 이름은 지운 뒤 100개 이하여도 400 이다.
- 앞뒤 공백 문자를 지우고 저장하는 것은 NUL 문자를 지우는 안을 기각한 이유의 예외로 둔다. 이름 가운데 글자는 그대로 두고 화면에 보이지 않는 앞뒤 공백만 지운다. 저장한 이름은 목록과 이름 변경 응답에 그대로 나온다.
- 공백 문자의 범위는 `trim()` 의 기준을 그대로 쓴다. 그래야 저장할 때 지우는 문자와 이름 변경이 거부하는 문자가 같다. 제로폭 공백(U+200B)처럼 `trim()` 이 지우지 않는 문자는 이번 결정의 범위 밖이고 지금처럼 받는다.
- 이미 저장된 빈 문자열 이름은 마이그레이션으로 NULL 로 바꾼다. 화면이 빈 문자열도 기본 문구로 그리게 고치는 안은 기각했다. 같은 뜻의 값이 데이터베이스에 두 가지로 남는다. 마이그레이션은 `device_name` 이 빈 문자열인 행을 NULL 로 바꾸는 UPDATE 문 하나다. 바꾼 뒤에는 원래 빈 문자열이던 행과 원래 NULL 이던 행을 구분할 수 없어서 되돌리지 않고 `-- DOWN:` 주석에 그 이유를 적는다.
- 빈 문자열을 막는 데이터베이스 CHECK 제약은 더하지 않는다. `device_name` 을 쓰는 경로는 등록 검증과 이름 변경 둘뿐이고 두 경로 모두 빈 문자열을 저장하지 않는다.

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

- **등록 옵션에서 비밀번호를 재확인한다.** 로그인 세션만 가진 사람이 자기 인증기를 Passkey 로 등록하면 원래 사용자는 다음 로그인에서 막힌다. Passkey 가 하나라도 있으면 로그인 2단계는 Passkey 로만 통과하기 때문이다. 첫 등록의 Passkey 복구 코드도 등록한 사람에게만 보인다. TOTP 설정 시작에서 막은 공격과 같아서 같은 본문(`{ password }`, 8자 이상 문자열), 같은 확인(`AuthService.verifyPasswordForUser`), 같은 에러 코드(401 `PASSWORD_REQUIRED` · `PASSWORD_INVALID`)를 쓴다.
- **등록 옵션 한 곳에서만 받는다.** `optionsToken` 은 발급받은 사용자(`sub`)에 묶이고 5분 안에만 유효하다. 그래서 비밀번호 재확인 한 번이 덮는 범위는 그 사용자가 그 토큰으로 5분 안에 하는 등록이다.
- **기능이 꺼져 있으면 비밀번호를 확인하기 전에 거부한다.** 기능을 끈 서버에서 비밀번호 대조를 돌리지 않기 위해서다. 복구 코드 재발급도 이 순서로 바꿨다.
- **이미 등록한 Passkey 는 그대로 쓴다.** 새 등록만 막고 기존 credential 에 확인을 다시 요구하지 않는다. Passkey 삭제 · 이름 변경에는 비밀번호 재확인을 더하지 않았다. 삭제에는 2026-11-14 에 더했다([아래](#passkey-삭제에도-비밀번호-재확인을-둔다-2026-11-14)).
- **비용**: OAuth 전용 사용자는 비밀번호 재설정으로 비밀번호를 만든 뒤 Passkey 를 등록한다. 그래서 비밀번호 없이 Passkey 만 등록한 OAuth 전용 계정은 이 결정 전에 등록한 경우만 남는다.
- **기각: 비밀번호 또는 TOTP 로 계정 재인증(`SessionsService.reauthenticate`)을 받는다.** 비밀번호 없이 TOTP 만 있는 계정은 TOTP 코드로 등록할 수 있게 되어 비밀번호만 받는 TOTP 설정 시작과 규칙이 갈린다.
- **기각: 이번에도 더하지 않고 미결로 남긴다.** 로그인 세션을 탈취한 사람이 자기 인증기를 등록해 원래 사용자를 잠그는 공격이 남는다.

요청 빈도 제한:

- **`SENSITIVE_ACTION_THROTTLE` 을 세 라우트에 더 건다.** Passkey 등록 옵션, Passkey 복구 코드 재발급, TOTP 활성화 검증이다. 사용자당 분당 10회이고 넘으면 429 다. 이제 `verifyPasswordForUser` 를 부르는 라우트 넷(TOTP 설정 시작 · TOTP 끄기 · Passkey 등록 옵션 · Passkey 복구 코드 재발급)이 모두 이 한도를 쓴다. 단위 테스트가 이 라우트 목록을 고정하고 핸들러마다 한도가 걸렸는지 본다. 목록에 없는 새 라우트는 이 테스트에 걸리지 않는다.
- **한도는 라우트마다 따로 센다.** 등록 검증에는 걸지 않는다. 비밀번호를 받지 않고 한도가 걸린 등록 옵션의 `optionsToken` 이 있어야 저장한다.
- **기각: 비밀번호를 확인하는 라우트에만 건다.** 그러면 비밀번호 확인 한 번으로 할 수 있는 TOTP 코드 추측이 전역 한도(사용자당 분당 100회)에만 묶여 10분에 최대 1,000회가 된다.
- **기각: 바꾸지 않는다.** 복구 코드 재발급 라우트에 전용 한도가 없어 그 라우트로 설정 시작의 한도를 우회해 비밀번호를 추측할 수 있다.

TOTP 대기 secret 의 10분 만료와 기각한 안은 [2단계 인증 설정과 TOTP](CLE-ACCT-SIGNIN-TOTP.md#totp-대기-secret-은-설정-시작-10분-뒤-버린다-2026-11-02) 로 옮겼다(2026-11-14, 문서 크기 한도).

### Passkey 도메인 모듈을 분리한다

Passkey 관련 엔티티·서비스·DTO·컨트롤러·테스트는 `codebase/backend/src/modules/auth/webauthn/` 에 두고 `WebAuthnModule` 로 묶는다. `AuthModule` 이 `WebAuthnModule` 을 import 해 `WebAuthnService` 를 주입받는다. 의존 방향은 `AuthModule → WebAuthnModule` 한 방향이다.

| 위치 | 분류 |
| --- | --- |
| `auth/webauthn/webauthn.service.ts` | service |
| `auth/webauthn/entities/webauthn-credential.entity.ts` | entity |
| `auth/webauthn/dto/webauthn.dto.ts` | 요청 DTO |
| `auth/webauthn/dto/responses/webauthn-response.dto.ts` | 응답 DTO |
| `auth/webauthn/webauthn.module.ts` | NestJS module |
| `auth/webauthn/webauthn.controller.ts` | HTTP controller (`/auth/2fa/webauthn/...`) |

- `AuthService` 는 credential repository 를 직접 주입하지 않고 `WebAuthnService.countStoredCredentials()` 와 `isEnabled()` 를 쓴다. 로그인 쪽 판정은 `AuthService.passkeyState()` 한 곳에 모았다.
- `LoginHistoryService` 는 `AuthModule` 과 `WebAuthnModule` 양쪽에 provider 로 둔다. 두 인스턴스가 같은 테이블에 INSERT 만 하므로 동작이 같다. 별도 모듈 분리는 후속 과제다.
- `WebAuthnController` 파일은 `webauthn/` 폴더에 두지만 모듈 등록은 `AuthModule` 의 `controllers` 에 한다. 컨트롤러가 챌린지 토큰 소비와 2단계 뒤 토큰 발급에 `AuthService` 를 써야 하기 때문이다. `WebAuthnModule` 에 등록하면 역방향 의존이 생긴다.
- `setRefreshTokenCookie`·`clearRefreshTokenCookie` 는 두 컨트롤러가 함께 쓰므로 `auth/utils/refresh-cookie.ts` 의 모듈 함수로 뺐다.
- 채택 이유: 로그인·가입·OAuth·로그인 세션·TOTP 에 Passkey 까지 한 모듈에 있으면 응집도가 낮다. 도메인 모듈로 나눠 경계를 드러내고 한 방향 의존으로 순환을 막는다.

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
- **`DELETE` 를 없애고 `POST …/:id/delete` 로 옮겼다.** 일부 CDN · 프록시는 `DELETE` 본문을 버린다. 로그인 세션 강제 종료가 `POST …/revoke` 를 쓴 이유와 같다. `DELETE` 를 남기면 토큰만으로 지우는 길이 남는다. 프런트엔드와 함께 배포한다.
- **이름 변경(`PATCH`)은 그대로 둔다.** 인증 수단을 바꾸지 않는다.
- **기각: 마지막 credential 삭제에만 받는다.** 다른 credential 을 지우는 것도 쓰던 인증 수단을 없애고, 남은 개수에 따라 규칙이 갈린다.
- **기각: 비밀번호 또는 TOTP 로 재인증한다.** 비밀번호만 받는 다른 민감 동작과 규칙이 갈린다(등록 옵션과 같은 이유).
