---
id: "CLE-ACCT-SIGNIN-PKAUTH"
title: "가입과 로그인 — Passkey 로그인 인증과 counter 역행"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ACCT-SIGNIN"
ancestors: ["CLE-VISION", "CLE-ACCT", "CLE-ACCT-SIGNIN"]
area: "CLE-ACCT"
content_hash: "c79748caadc3bcb1c1d7f5d12acceaffddfdd3835f564e1a01063f4657bd1ecf"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "0e08c124b48d08c398e6280cba381969bce0107961c63a436869b3ae443c21a3"
etag: "sha256-33a9059753d5414b0f35a8c473dc95ae8836f1e2411c69ff12a2a791b8097d45"
---
## 개요

이 문서는 [가입과 로그인](CLE-ACCT-SIGNIN.md) 의 하위 문서로 로그인 2단계의 Passkey 인증 흐름, Passkey 인증 챌린지를 한 번만 쓰는 기록 규칙, sign counter 역행 판정과 동시성 처리를 정한다. Passkey 기능 켜기와 등록은 [Passkey 기능과 등록](CLE-ACCT-SIGNIN-PASSKEY.md), 로그인 화면 쪽 동작은 [로그인과 소셜 로그인 「Passkey 인증 화면」](CLE-ACCT-SIGNIN-LOGIN.md#passkey-인증-화면) 에 있다.

## Passkey 로그인 인증 흐름

로그인 2단계 인증은 다음 순서다.

1. `POST /api/auth/2fa/webauthn/authenticate/options { challengeToken }`. 서버가 챌린지 토큰을 검증하고 `generateAuthenticationOptions` 와 `optionsToken`(`kind=webauthn_auth`, 5분)을 준다.
2. 클라이언트가 `navigator.credentials.get(options)` 를 호출한다.
3. `POST /api/auth/2fa/webauthn/authenticate/verify { challengeToken, optionsToken, response }`. 서버는 챌린지 토큰과 옵션 토큰을 검증한 뒤 그 Passkey 인증 챌린지를 쓴 것으로 기록한다. 이미 쓴 챌린지면 401 `WEBAUTHN_INVALID` 로 거부한다. 이어서 `verifyAuthenticationResponse` 로 서명을 검증한다. 서명이 맞으면 counter 역행을 판정하고 counter 를 갱신한 뒤 액세스 토큰과 리프레시 토큰 쿠키를 발급한다.

복구 코드로 통과할 때는 `POST /api/auth/2fa/webauthn/recovery { challengeToken, code }` 를 부른다. 서버는 `webauthn_recovery_codes` 해시와 비교해 맞으면 그 항목을 지우고 JWT 를 발급한다.

챌린지는 stateless JWT(`optionsToken`)로 발급한다. payload 는 `{ kind, sub, challenge, exp(5분) }` 이다. 발급할 때는 별도 테이블에 두지 않는다. 로그인에서 쓴 Passkey 인증 챌린지는 아래 규칙대로 기록한다.

### Passkey 인증 챌린지 기록

로그인 2단계 인증의 챌린지는 한 번만 쓴다. 이 문서에서 Passkey 인증 챌린지는 `optionsToken`(`kind=webauthn_auth`)에 든 `challenge` 값을 말한다. 챌린지 토큰(`challengeToken`)이나 로그인 1단계 응답의 `methods: ['webauthn']` · `methods: ['totp']` 챌린지와는 다르다. 줄여서 「Passkey 챌린지」 라고 쓰지 않는다.

- 서버는 인증 검증 요청을 받으면 서명과 counter 를 판정하기 전에 그 챌린지를 쓴 것으로 기록한다. 기록은 아래 보존 기간 동안 남는다.
- 기록은 여러 서버 인스턴스에서 원자적이다. 같은 챌린지로 동시에 온 요청 가운데 하나만 판정으로 간다.
- 이미 기록된 챌린지면 credential 과 리프레시 토큰을 건드리지 않고 401 `WEBAUTHN_INVALID` 로 거부한다.
- 검증 결과와 상관없이 기록한다. 챌린지 토큰은 기록하지 않는다. 그래서 검증이 실패해도 같은 챌린지 토큰으로 옵션을 다시 받거나 Passkey 복구 코드를 쓸 수 있다. 로그인 화면은 시도할 때마다 옵션을 새로 받는다(`login-form.tsx`). 검증 응답을 기다리는 동안에는 인증 버튼을 잠근다.
- 등록 챌린지(`kind=webauthn_register`)는 이 규칙 밖이다.
- 기록은 Redis 키 `auth:webauthn-auth-challenge:<challenge>` 에 `SET … EX … NX` 명령 하나로 남긴다. 키 목록은 [비동기 큐와 Redis 키 목록 「다른 모듈의 키」](../CLE-PLAT/CLE-PLAT-QUEUE.md#다른-모듈의-키) 에 있다.
- **보존 기간**: 기록은 옵션 토큰의 만료 시각(`exp`)에 여유 시간 60초(`WEBAUTHN_AUTH_CHALLENGE_EXPIRY_MARGIN_SEC`)를 더한 때까지 남긴다. 시계가 늦은 서버 인스턴스는 다른 서버 인스턴스에서 이미 만료된 옵션 토큰도 받는다. 그동안 기록이 남아 있도록 여유를 둔다. 기록은 TTL 로 사라지므로 정리 작업이 없다. 이 문서와 [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md) 에서 Passkey 인증 챌린지 기록의 「보존 기간」 은 이 정의를 따른다.
- 기록은 옵션 토큰의 서명 · `kind` · `sub` · `exp` 를 검증한 뒤 credential 을 조회하기 전에 한다. 기록은 credential 트랜잭션 밖에서 한다.
- 기록하지 못하면(Redis 연결 · 명령 실패) 서명과 counter 를 판정하지 않고 503 `SERVICE_UNAVAILABLE` 로 거부한다. 다시 시도할 수 있는 응답이다. credential · 리프레시 토큰 · 로그인 이력은 바꾸지 않는다. Passkey 복구 코드로 통과하는 경로는 이 기록을 쓰지 않는다.
- 기록은 서명 검증보다 먼저 하므로 실패한 시도도 그 옵션 토큰을 쓴 것이 된다. 다시 시도하려면 옵션부터 다시 받는다.
- 이미 쓴 챌린지로 온 요청은 로그인 이력에 `webauthn_failed`(`failure_reason='WEBAUTHN_INVALID'`)를 남긴다. 계정 잠금 카운터(`login_attempts`)는 바꾸지 않는다. 서명이 틀린 응답과 같은 처리다.

이유는 Rationale 「[Passkey 인증 챌린지는 한 번만 쓴다](#passkey-인증-챌린지는-한-번만-쓴다-2026-10-17)」 에 있다.

## sign counter 역행과 동시성

처음 쓰는 Passkey 인증 챌린지로 온 응답이 서명 검증을 통과했는데 sign counter 가 역행했으면 서비스는 그 credential 행을 바로 지운다. suspend 컬럼은 두지 않는다. 이어서 그 사용자의 활성 리프레시 토큰을 모두 무효화해 복제한 공격자가 기존 토큰으로 계속 접근하지 못하게 한다. 로그인 이력에는 `webauthn_failed`(`failure_reason='WEBAUTHN_COUNTER_REGRESSION'`)를 남기고 401 `WEBAUTHN_COUNTER_REGRESSION` 으로 응답한다. 사용자가 같은 인증기를 다시 쓰려면 `/profile/security` 에서 다시 등록한다.

역행은 응답의 sign counter 가 저장값 이하인 경우다. 저장값과 응답 값이 모두 0 이면 counter 를 쓰지 않는 인증기로 보고 역행으로 판정하지 않는다. 서비스가 비교하는 식은 라이브러리(`@simplewebauthn/server`)가 원래 쓰던 판정식과 같다.

서명 검증을 통과하지 못한 응답은 counter 값과 상관없이 401 `WEBAUTHN_INVALID` 이고 credential 을 지우지 않는다. 서명이 틀린 응답으로 지우면 그 사용자의 비밀번호만 아는 사람이 인증기 없이 credential 을 지우고 로그인 세션을 모두 끝낼 수 있기 때문이다.

이 문서에서 서명 검증을 통과했다는 것은 `verifyAuthenticationResponse` 가 `verified: true` 를 돌려줬다는 뜻이다. 라이브러리는 그 안에서 challenge · origin · rpID · 사용자 확인 플래그(UV)를 확인하고 저장된 공개 키로 서명을 검증한다. 라이브러리도 counter 를 비교하지만 서명보다 먼저 비교해서 서명이 틀린 응답도 역행 에러로 끝낸다. 그래서 서비스는 라이브러리에 저장 counter 대신 0 을 넘겨 그 비교를 끄고, `verified: true` 를 받은 뒤에 위 규칙으로 직접 비교한다. 라이브러리가 검증 중에 에러를 던지거나 `verified: false` 를 돌려주면 모두 401 `WEBAUTHN_INVALID` 다.

`verifyAuthentication` 은 credential 조회·검증·counter 갱신·역행 시 삭제·리프레시 토큰 무효화를 한 트랜잭션에서 처리한다. credential 행은 `SELECT ... FOR UPDATE` 로 잠근다. 같은 assertion 의 두 요청은 같은 챌린지를 쓰므로 챌린지 기록에서 한쪽만 이 트랜잭션에 들어가고 다른 쪽은 401 `WEBAUTHN_INVALID` 를 받는다. 다른 챌린지로 같은 credential 의 요청이 동시에 오면 한쪽이 잠금을 기다렸다가 갱신된 counter 를 읽는다. 그 요청의 응답 counter 가 갱신된 값 이하이면 역행으로 판정된다. 다른 챌린지로 온 정상 응답 두 개의 순서가 뒤바뀌어도 이렇게 판정되고 그 처분은 [미결 사항](#미결-사항) 에서 정한다. 로그인 이력 기록은 트랜잭션 밖에서 호출해 기록 실패가 credential 삭제와 토큰 무효화 커밋을 막지 않게 한다.

counter 역행으로 마지막 credential 이 지워져도 Passkey 복구 코드는 비우지 않는다. 사용자가 마지막 credential 을 지울 때는 비운다([복구 코드](CLE-ACCT-SIGNIN-TOTP.md#복구-코드)).

## 미결 사항

- **다른 챌린지로 온 Passkey 응답의 순서가 뒤바뀐 경우의 역행 처분**: 두 탭에서 거의 동시에 인증하면 인증기가 서명한 정상 응답 두 개가 서로 다른 챌린지로 뒤바뀐 순서로 도착할 수 있다. 먼저 서명된 응답이 나중에 처리되면 갱신된 counter 를 읽고 역행으로 판정된다. 그러면 credential 이 지워지고 리프레시 토큰이 모두 무효가 된다. 챌린지 기록은 같은 챌린지의 재사용만 막아서 이 경우를 막지 못한다. 지금 동작을 유지할지, 대안 가운데 하나를 고를지 정해야 한다. 대안은 credential 단위로 직렬화해 처리 순서를 맞추는 안, 작은 역행을 허용하는 안, 이 경우는 credential 을 지우지 않고 거부하는 안이다. 후속 NERV Task `CLE-T-XFG7AE` 로 추적한다.

## 구현 위치

- `codebase/backend/src/modules/auth/webauthn/webauthn-auth-challenge.service.ts` (Passkey 인증 챌린지 기록)
- `codebase/backend/test/webauthn-2fa.e2e-spec.ts` (Passkey 등록·인증, counter 역행, 서명이 틀린 응답의 거부, counter 가 늘 0 인 인증기, 같은 응답의 재전송(차례로 · 동시에, counter 가 늘 0 인 인증기 포함), 등록 알고리즘 고정, transport 목록 형식, 표시 이름 형식, 이름 변경의 빈 이름 · 공백 문자로만 된 이름)

## Rationale

### Passkey 옵션 토큰의 챌린지를 stateless JWT 로 둔다

이 절의 챌린지는 등록 · 인증 옵션 토큰(`optionsToken`)에 담는 `challenge` 값이다. WebAuthn 명세의 challenge unique·fresh 요건은 challenge 가 random 이고 검증 때 클라이언트 응답과 맞는지 확인하면 충족된다. 서버 DB 의 단명 행이 필수는 아니다. JWT 만료 5분과 `kind` 검증으로 등록·인증 흐름의 교차 사용을 막는다. 발급할 때는 행을 만들지 않으므로 발급 쪽에는 단명 행 정리 배치와 인덱스가 필요 없다. 다만 JWT 만으로는 같은 챌린지를 다시 쓰는 것을 막지 못한다. 그래서 Passkey 인증 챌린지는 쓴 기록을 따로 두고 그 기록은 보존 기간이 지나면 TTL 로 사라진다(「Passkey 인증 챌린지는 한 번만 쓴다」).

2026-10-17 정정(NERV Task `CLE-T-D331TT`): 이 절은 같은 JWT 로 두 번째 검증을 하면 라이브러리가 거부한다고 적었다. 라이브러리에는 쓴 챌린지를 기억하는 상태가 없어 그렇지 않았다. counter 를 올리는 인증기는 두 번째 검증이 counter 역행으로 처분됐고 counter 가 늘 0 인 인증기는 두 번째 검증도 통과했다.

### counter 역행이면 credential 을 지운다 (suspend 기각)

counter 역행은 인증기 복제 공격이나 인증기 firmware 에러 둘 중 하나다. 둘 다 신뢰가 깨진 상태라 바로 신뢰를 거둔다. 같은 assertion 의 중복 요청은 챌린지 기록에서 먼저 거부되고 서명이 틀린 응답은 역행으로 판정하지 않는다. 그래서 역행 판정까지 오는 응답은 이 두 경우뿐이다(2026-10-17, 「Passkey 인증 챌린지는 한 번만 쓴다」). 2026-10-30 에 예외를 하나 찾았다(NERV Task `CLE-T-GK9J2B`). 다른 챌린지로 온 정상 응답 두 개의 순서가 뒤바뀐 경우이고 처분은 [미결 사항](#미결-사항) 에서 정한다. suspend(`disabled_at` 컬럼과 명시적 재활성화)는 사용자에게 재활성화 선택지를 주는데, 복제한 공격자가 본인인 척 재활성화해도 효과가 같아 보안 이득이 작다. 추가 컬럼·UI 흐름·테스트가 줄어 운영이 단순하고 재등록 비용은 작다.

2026-10-17 추가(NERV Task `CLE-T-D331TT`): counter 역행으로 마지막 credential 이 지워져도 Passkey 복구 코드는 비우지 않는다. 남은 코드는 쓸 곳이 거의 없다. credential 이 없으면 로그인 응답이 `methods: ['webauthn']` 가 아니다. 쓸 수 있는 곳은 삭제 전에 `methods: ['webauthn']` 로 발급된 챌린지 토큰(`challengeToken`, 5분)뿐이고 그 토큰은 로그인 1단계를 통과해야 받는다. 첫 등록은 credential 수가 0 인지로 판정하므로 다음 등록 때 새 코드로 바뀐다. 역행 트랜잭션에서 복구 코드도 비우는 안은 기각했다. counter 역행 처분 범위가 처음 쓰는 챌린지에서 서명이 맞는 응답으로 좁혀져도 남은 코드를 쓸 곳은 그대로라 비워서 얻는 것이 없다.

2026-10-30 에 역행 판정 자리를 서명 검증 뒤로 옮겼다(NERV Task `CLE-T-NWHVMN`). 이유와 기각한 안은 [역행은 서명 검증을 통과한 응답에서만 판정한다](#역행은-서명-검증을-통과한-응답에서만-판정한다-2026-10-30) 에 있다.

### 역행은 서명 검증을 통과한 응답에서만 판정한다 (2026-10-30)

NERV Task `CLE-T-NWHVMN` 에서 정했다. 그 전 구현은 `@simplewebauthn/server` 의 counter 비교를 그대로 썼다. 라이브러리는 counter 를 서명보다 먼저 비교한다. 그래서 서명이 틀린 응답도 counter 만 저장값 이하면 역행 에러가 났고 서비스는 credential 을 지우고 리프레시 토큰을 모두 무효화했다. 저장 counter 가 0 보다 크면 인증기 없이 이런 응답을 만들 수 있다. 비밀번호로 로그인 1단계를 통과하면 인증 옵션의 `allowCredentials` 에서 credential id 를 받기 때문이다. 그러면 그 사용자는 Passkey 를 잃고 로그인 세션이 모두 끝난다. 지워진 것이 마지막 Passkey 이고 TOTP 도 없으면 다음 로그인은 2단계 인증 없이 비밀번호만으로 통과한다.

- **기각: 서명을 검증하기 전에 counter 로 처분한다.** 라이브러리의 판정을 그대로 쓰는 그 전 동작이다. 위 공격을 막지 못한다.
- **기각: 라이브러리 에러 메시지로 역행을 가려낸다.** 라이브러리가 문구를 바꾸면 역행이 조용히 `WEBAUTHN_INVALID` 로 바뀐다. 서명 검증 뒤에 서비스가 직접 비교하면 문구에 기대지 않는다.
- **기각: 서명 검증을 따로 한다.** 라이브러리의 counter 에러를 받은 뒤 서명을 다시 검증하거나 서명 검증 함수를 직접 부르는 안이다. 라이브러리가 하는 challenge · origin · rpID · UV 확인까지 서비스가 다시 맞춰야 한다. 저장 counter 자리에 0 을 넘기면 라이브러리의 확인을 그대로 쓰고 counter 비교만 서비스로 옮긴다.

### Passkey 인증 챌린지는 한 번만 쓴다 (2026-10-17)

NERV Task `CLE-T-D331TT` 에서 사람 결정으로 정했다. 같은 assertion 이 두 번 오는 일은 공격이 아니어도 생긴다. 버튼을 두 번 누르거나 네트워크 계층이 요청을 다시 보내는 경우다. 챌린지 기록이 없을 때 counter 를 올리는 인증기는 두 번째 요청이 counter 역행으로 처분됐다. credential 이 지워지고 첫 요청이 받은 로그인 세션까지 끝났다. counter 가 늘 0 인 인증기(대부분의 플랫폼 Passkey)는 같은 assertion 이 다시 통과해 토큰이 한 번 더 나왔다. 챌린지를 한 번만 쓰면 두 경우 모두 credential 을 지우지 않는 401 로 끝난다. 처음 쓰는 챌린지에서 서명이 맞는데 counter 가 역행한 응답만 복제 신호로 남는다. (2026-10-30 정정: 다른 챌린지로 온 정상 응답의 순서가 뒤바뀌어도 역행으로 판정된다([미결 사항](#미결-사항)).)

- **기각: counter 가 같은 값과 작은 값을 나눠 처분한다.** counter 가 같으면 거부만 하고 작을 때만 지우는 안이다. counter 가 늘 0 인 인증기의 재전송을 막지 못하고 같은 counter 를 내는 복제 인증기도 놓친다.
- **기각: 지금 동작을 문서에 적고 화면에서 중복 제출을 막는다.** 화면을 거치지 않는 재전송과 counter 0 인증기의 토큰 재발급이 남는다.
- **기록 시점**: 서명과 counter 를 판정하기 전에 기록한다. 판정 뒤에 기록하면 동시에 온 두 요청이 모두 판정으로 가서 지금과 같은 역행 처분이 난다. 검증 결과와 상관없이 기록하므로 실패한 사용자는 옵션을 다시 받아야 한다. 옵션 요청은 챌린지 토큰만 있으면 되고 로그인 화면은 이미 시도마다 옵션을 새로 받는다.
- **비용**: 쓴 챌린지를 [보존 기간](#passkey-인증-챌린지-기록) 동안 담는 공유 저장소가 필요하다. 챌린지를 JWT 에 담아 발급하는 방식은 그대로 둔다. 한 번만 쓰는 값을 원자적으로 소비하는 선례는 [계정과 워크스페이스 데이터 흐름 「OAuth state 를 한 번의 DELETE 로 소비한다」](CLE-ACCT-DATA.md#oauth-state-를-한-번의-delete-로-소비한다) 에 있다.

2026-10-30 구현(NERV Task `CLE-T-GK9J2B`): 구현하면서 다음을 정했다.

- **저장소는 Redis 키다.** 쓴 챌린지마다 키 하나를 `SET` 명령 하나(`NX` · `EX`)로 남긴다. 명령 하나라서 여러 서버 인스턴스에서도 원자적이다. 기록은 TTL 로 사라지므로 정리 배치와 마이그레이션이 없다.
- **기각: OAuth state 처럼 테이블에 넣는다.** 유니크 제약과 마이그레이션이 더 들고 검증할 때마다 DB 쓰기가 하나 는다. 기록은 보존 기간(길어야 약 6분) 동안만 있으면 된다. 기록을 잃을 수 있다는 점은 아래 「받아들인 위험」 에 적었다.
- **키에 챌린지 원문을 넣는다.** 해시하지 않는다. 챌린지는 옵션 응답으로 클라이언트에 이미 내려가는 서버 무작위 값이고 서명된 옵션 토큰 안에 있어 키만으로는 아무것도 할 수 없다. [Redis 키 명명 규약 「Redis 키가 아닌 인접 이름」](../CLE-ENG/CLE-ENG-REDIS.md#redis-키가-아닌-인접-이름) 의 advisory lock 키 `makeshop-pending` 이 `client_id` 를 SHA-256 hex 로 바꿔 넣는 것은 `client_id` 가 자격 증명이기 때문이다.
- **기록하지 못하면 판정하지 않는다(fail-closed).** 기록 없이 판정으로 보내면 같은 assertion 의 두 번째 요청이 역행으로 처분되어 이 결정이 막으려던 경우가 돌아온다. 같은 Redis 를 쓰는 다른 기능(`ChatChannelDedupService` · `Cafe24InstallNonceCache`)은 fail-open 이지만 따르지 않았다. 실패 정책은 키마다 그 키를 소유한 문서가 정한다([용어 사전 — API 와 개발 규약](../CLE-GLOSSARY-API.md) 「fail-open」, [EIA 데이터 「인프라 장애에는 fail-open 한다」](../CLE-IX/CLE-EIA-DATA.md#인프라-장애에는-fail-open-한다)). Redis 장애 중에는 Passkey 로 로그인 2단계를 통과할 수 없고 Passkey 복구 코드 경로만 열린다. 이 상태는 2026-10-17 에 기각한 「기능이 꺼진 동안 Passkey 복구 코드로만 로그인을 연다」([Passkey 기능이 꺼지면 Passkey 만 등록한 계정의 로그인을 막는다](CLE-ACCT-SIGNIN-LOGIN.md#passkey-기능이-꺼지면-passkey-만-등록한-계정의-로그인을-막는다-2026-10-17))와 닮았지만, 그 안을 기각한 이유(새 `methods` 값과 화면)는 여기서 생기지 않는다. 복구 코드 입력은 [Passkey 인증 화면](CLE-ACCT-SIGNIN-LOGIN.md#passkey-인증-화면) 에 이미 있다. 복구 코드가 바닥날 위험은 장애가 이어지는 동안 남고, 장애는 `/api/health` 의 Redis 점검과 error 로그로 드러난다.
- **기각: 저장소 장애를 401 `WEBAUTHN_INVALID` 로 돌려준다.** 인증 실패와 인프라 장애를 한 코드로 묶으면 클라이언트가 다시 시도할지 가를 수 없다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 규칙 6). [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 규칙 11 은 우리 인프라 의존성의 일시 장애에 `503` 을 쓰게 한다. 카탈로그에 있는 503 `SERVICE_UNAVAILABLE` 을 쓰고 새 코드를 만들지 않았다.
- **이미 쓴 챌린지는 서명이 틀린 응답과 같게 처리한다.** 로그인 이력 사유는 `WEBAUTHN_INVALID` 이고 `login_attempts` 는 바꾸지 않는다. 로그인 1단계를 통과한 뒤의 실패라서 기존 2단계 실패와 같게 둔다.
- **전용 요청 빈도 제한은 두지 않았다.** 이 경로는 `@Public` 이라 전역 한도(IP 당 분당 100회)가 걸리고 재사용 거부는 저장소 조회 한 번이다.
- **받아들인 위험: 한 번만 쓴다는 보장은 Redis 가 키를 잃지 않는다는 전제에 기댄다.** 영속 설정 없이 재시작하거나 failover 로 키를 잃으면 보존 기간이 끝날 때까지 이미 쓴 챌린지를 다시 쓸 수 있다. 다시 보내려면 챌린지 토큰 · 옵션 토큰 · assertion 이 모두 있어야 하고 그 기간은 길어야 약 6분이다. counter 가 늘 0 인 인증기에는 이 기록이 유일한 재전송 방어다. Redis 퇴거 정책은 `noeviction` 이 전제다.

2026-11-01 정리(NERV Task `CLE-T-YKA9CJ`): 보존 기간(옵션 토큰 만료 시각 + 여유 60초)을 [Passkey 인증 챌린지 기록](#passkey-인증-챌린지-기록) 에 한 번 정의하고 다른 곳은 그 정의를 가리키게 했다. 요구사항 문장이 여유를 빠뜨렸던 것도 맞췄다. 여유 60초는 이미 승인된 값이다. 기록하지 못하는 원인에서 「Redis 설정 누락」 을 뺐다. 연결 설정에는 기본값(`localhost:6379`)이 있어 남는 원인은 연결 · 명령 실패이고, 둘 다 다시 시도하면 풀릴 수 있어 「다시 시도할 수 있는 응답」 과 맞는다.

### 로그인 검증에서 credential 을 찾지 못하면 `WEBAUTHN_INVALID` 로 거부하기로 했다 (2026-11-12)

NERV Task `CLE-T-3P4ENZ` 에서 사람이 정했다. 구현은 NERV Task `CLE-T-ZPPWK4` 가 맡는다. 그때까지 응답은 401 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 이고 [에러 코드](CLE-ACCT-SIGNIN-API.md#에러-코드) 표에 그 사실과 결정을 함께 적었다.

- **한 이름이 두 뜻으로 쓰였다.** `WEBAUTHN_CREDENTIAL_NOT_FOUND` 는 등록한 Passkey 의 이름 변경 · 삭제에서 대상이 없다는 404 이고, 로그인 2단계 검증에서는 인증이 실패했다는 401 이다. [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 규칙 6 은 뜻이 갈리면 코드를 나누라고 정한다.
- **로그인 쪽을 기존 `WEBAUTHN_INVALID` 로 옮긴다.** 서명이 틀린 응답과 이미 쓴 챌린지를 이 코드로 묶은 이유와 같다. 사용자가 할 일은 「Passkey 로 다시 시도」 하나이고 credential 이 없다는 사실을 서명 실패와 구별해 알려 줄 이유도 없다. 로그인 화면은 `WEBAUTHN_INVALID` 만 안내 문구(`auth.login.webauthnFailed`)로 바꾸므로 옮기면 이 경우에도 같은 안내가 나간다.
- **기각: 로그인 쪽에 새 코드를 만든다.** 클라이언트가 그 코드로 따로 할 일이 없다.
- **기각: 그대로 둔다.** 같은 이름이 404 와 401 로 나가면 클라이언트가 상태와 코드 가운데 무엇으로 분기할지 정할 수 없다.
- **로그인 이력은 바꾸지 않는다.** 지금 이 경로는 로그인 이력을 남기지 않고, 남길지는 이번 결정에 들지 않았다.
- **이 코드를 이번에 에러 코드 표에 올렸다.** 「미결 사항」 의 Passkey 미등재 코드 셋 가운데 이번 결정과 직접 걸리는 것은 이 코드뿐이다. 나머지 둘은 NERV Task `CLE-T-9KCQ7Y` 에 남긴다.
