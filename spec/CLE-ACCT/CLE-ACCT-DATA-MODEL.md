---
id: "CLE-ACCT-DATA-MODEL"
title: "계정과 워크스페이스 데이터 흐름 — 사용자 · 인증 엔티티"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ACCT-DATA"
ancestors: ["CLE-VISION", "CLE-ACCT", "CLE-ACCT-DATA"]
area: "CLE-ACCT"
content_hash: "f50cb5d91cb3fb1036630202d722adfbc57943d7a3cc5c6ec80857640b9e9483"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "fe53b99beefa28d5db8f76c9c9cae3e66012fc95b20b289cc184a3ff34bcfe4a"
etag: "sha256-836bf87c829b1a91482e63a9aef2af314d36b8531cbe8015060b2a8689bee579"
---
## 개요

이 문서는 [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md) 의 하위 문서로 사용자와 인증 엔티티 5개(User, RefreshToken, LoginHistory, WebAuthnCredential, AuthOauthState)의 컬럼 · 제약 · 인덱스와 그 스키마 결정의 근거를 정한다. 워크스페이스 엔티티는 [워크스페이스 데이터와 흐름](CLE-ACCT-DATA-WS.md), 읽고 쓰는 순서는 [인증 흐름](CLE-ACCT-DATA-AUTH.md), 흐름별 쓰기 컬럼 표는 [테이블 쓰기 · 배치 · 외부 의존](CLE-ACCT-DATA-OPS.md) 에 있다.

## User

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| email | String | 고유, 로그인 식별자 |
| password_hash | String? | 비밀번호 bcrypt 해시. OAuth 전용 계정은 NULL |
| name | String | 표시 이름 |
| avatar_url | String? | 프로필 이미지 URL. 외부 URL(OAuth 제공자 사진 등) 또는 직접 올린 아바타의 공개 URL. 직접 올렸는지는 `avatars/{userId}/` 접두로 판별한다 |
| locale | String | 언어 설정 (기본 `"ko"`) |
| email_verified | Boolean | 이메일 인증 완료 여부 (기본 false, 인증 전 로그인 제한) |
| email_verify_token | String? | 이메일 인증 토큰 SHA-256 해시 (24시간 유효). 인증하면 NULL |
| email_verify_expires_at | Timestamp? | 이메일 인증 토큰 만료 시각 |
| pending_email | String? | 확인 대기 중인 새 이메일. 확정(email 로 승격)이나 취소 때 NULL |
| email_change_token | String? | 이메일 변경 확인 토큰 SHA-256 해시 (1시간 유효). 확인·취소·만료 때 NULL |
| email_change_expires_at | Timestamp? | 이메일 변경 확인 토큰 만료 시각 |
| password_reset_token | String? | 비밀번호 재설정 토큰 SHA-256 해시 (30분 유효). 사용·만료 때 NULL |
| password_reset_expires_at | Timestamp? | 재설정 토큰 만료 시각 |
| login_attempts | Integer | 연속 로그인 실패 횟수 (기본 0, 5회면 잠금) |
| locked_until | Timestamp? | 로그인 잠금 해제 시각 (10분 잠금) |
| oauth_provider | String? | OAuth 가입·연결 제공자 (예: `google`). 연결 안 했으면 NULL |
| oauth_provider_id | String? | 제공자 쪽 사용자 식별자 |
| notification_preferences | JSONB | 사용자 알림 환경설정 (기본 `{}`). 키는 [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) |
| theme | Enum | `light` / `dark` / `system` (기본 `light`). CHECK `chk_user_theme`. `system` 을 화면에 적용하는 방식은 [내 프로필](CLE-ACCT-PROFILE.md) 이 정한다 |
| two_factor_enabled | Boolean | TOTP 사용 여부. Passkey 등록과는 독립이라 Passkey 만 등록한 사용자는 false |
| two_factor_secret | String? | TOTP secret (base32, RFC 6238). 활성화 검증 전에는 값이 있어도 `two_factor_enabled = false`. TOTP 가 켜진 동안에는 설정 시작이 거부돼 바뀌지 않는다. 활성화 검증 전의 대기 secret([가입과 로그인 「TOTP 켜기」](CLE-ACCT-SIGNIN.md#totp-켜기))은 설정 시작 뒤 10분이 지나면 만료되고 활성화 검증이 비운다(`two_factor_setup_started_at`). 끄면 NULL |
| two_factor_setup_started_at | Timestamp? | TOTP 설정 시작 시각. 설정 시작이 `two_factor_secret` 과 같은 조건부 UPDATE 로 쓴다. 활성화 검증이 성공하거나 TOTP 를 끄면 NULL 이다. 값이 없거나 10분이 지났으면 활성화 검증이 대기 secret 을 만료로 보고 secret 과 함께 비운다. 응답에 싣지 않는다 |
| totp_recovery_codes | String[]? | TOTP 활성화 때 발급한 복구 코드 10개의 SHA-256 해시 배열. 쓰면 항목 제거 |
| webauthn_recovery_codes | String[]? | 첫 Passkey 등록 때 발급한 복구 코드 10개의 SHA-256 해시 배열. 사용자가 마지막 credential 을 지우면 NULL. 이 NULL 처리는 DB 트리거가 아니라 애플리케이션(`WebAuthnService.deleteCredential`) 책임이다. counter 역행으로 서버가 지운 경우는 비우지 않는다([가입과 로그인 「복구 코드」](CLE-ACCT-SIGNIN.md#복구-코드)). 사용자가 재발급해도 갱신 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

- 제약: `email UNIQUE`(V001). 이 제약은 대소문자를 구분한다. `LOWER(email)` 인덱스(V101)는 조회용이고 유니크 인덱스가 아니다.
- 새로 저장하는 이메일은 앞뒤 공백을 지우고 소문자로 저장한다(`normalizeEmail`). 일반 가입 · 초대 가입 · OAuth 새 계정 · 이메일 변경의 `pending_email` 이 이 규칙을 따른다. 이메일 변경을 확정하면 정규화한 `pending_email` 값이 `email` 이 된다.
- 조회와 중복 확인은 `LOWER(email)` 로 비교한다(V101 인덱스). 로그인 · 비밀번호 재설정 요청 · 인증 메일 재발송 · OAuth 이메일 연결 · 워크스페이스 멤버 직접 추가와 초대는 `UsersService.lookupByEmail` 로 계정을 찾는다. 가입 중복 확인과 `check-email` 은 `emailExists`, 이메일 변경의 중복 확인은 `emailTakenByOther` 를 쓴다. 대소문자만 다른 계정이 여럿 맞을 때의 처리를 포함한 규칙의 정본은 [가입과 로그인 「이메일 비교 규칙」](CLE-ACCT-SIGNIN.md#이메일-비교-규칙) 이다.
- 정규화 전에 생긴 "대소문자만 다른 계정 묶음" 이 남아 있을 수 있다(`email UNIQUE` 는 대소문자를 구분한다). 기존 값은 바꾸지 않고 묶음을 합치거나 지우지도 않는다(2026-11-05 사람 결정). 묶음이 0 이 되면 `LOWER(email)` 유니크 인덱스를 건다. 이 일은 NERV Task `CLE-T-6QZCYD` 가 맡는다. 운영자는 아래 쿼리로 묶음을 찾는다.

  ```sql
  SELECT LOWER(email) AS email_key, COUNT(*) AS accounts,
         array_agg(id ORDER BY created_at) AS user_ids
    FROM "user"
   GROUP BY LOWER(email)
  HAVING COUNT(*) > 1;
  ```

- `theme` 의 CHECK 는 `chk_user_theme` 이고 `light`·`dark`·`system` 을 받는다. V001 의 자동 이름 제약 `user_theme_check`(`light`·`dark`)를 대신한다. V149 가 새 제약을 `NOT VALID` 로 걸고 V150 이 검증한 뒤 옛 제약을 지운다(Rationale 「`user.theme` CHECK 확장은 두 단계 마이그레이션으로 했다」).
- `two_factor_setup_started_at` 은 `codebase/backend/migrations/V*__user_two_factor_setup_started_at.sql` 이 더한다. 이 마이그레이션은 기존 행을 바꾸지 않는다. 그래서 컬럼을 더하기 전에 설정 시작한 대기 secret 은 시각이 NULL 이고 활성화 검증이 만료로 본다.
- Passkey credential 은 별도 엔티티 [WebAuthnCredential](#webauthncredential) 에 둔다. User 행에는 `webauthn_recovery_codes` 와 간접적으로 credential 개수만 영향을 준다.

### 응답에 싣지 않는 민감 컬럼 7개

아래는 API 응답과 엔티티 프로퍼티의 camelCase 이름이다. 위 표의 snake_case 컬럼과 1:1 로 대응한다(`password_hash` ↔ `passwordHash`). 시행 코드(`USER_SECRET_KEYS`)가 camelCase 를 쓰므로 그 이름을 쓴다.

`passwordHash`, `twoFactorSecret`, `totpRecoveryCodes`, `webauthnRecoveryCodes`, `emailVerifyToken`, `passwordResetToken`, `emailChangeToken` 은 어떤 API 응답에도 싣지 않는다. 해시나 토큰이라 평문은 아니지만 오프라인 크래킹, 재설정 토큰 탈취, 2단계 인증 우회의 입력이 된다. 응답 DTO 에 선언돼서도 안 되고 본문에 실려서도 안 된다.

- 컬럼 수준 `select: false` 는 쓰지 않고 응답 경계에서 지운다. 내부 경로가 값을 직접 읽기 때문이다(Rationale 「`User` 민감 컬럼은 응답 경계에서 지운다」). 같은 근거를 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 가 트리거 계열에 대해 적고 있다.
- 시행 축은 두 개다. [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 응답 검증 층 표에 있는 구조 축(`User` 를 투영 없이 관계로 싣는 자리)과 이름 축(응답 본문에 그 이름이 있는가)이다. 목록의 기준은 코드(`shared/testing/user-secret-absence.ts` 의 `USER_SECRET_KEYS`)다. 엔티티에 민감 컬럼을 더하면 이 배열에도 넣는다. 이름 축은 이름으로만 걸리므로 새 이름을 저절로 알지 못한다.
- [WebAuthnCredential](#webauthncredential) 의 `public_key`·`counter` 는 이 목록에 없다. 공개 키는 설계상 노출해도 된다. 목록을 "인증 관련 전부" 로 넓히지 않는 경계다.
- `two_factor_enabled` 도 이 목록에 없다. TOTP 를 켰는지만 뜻하는 상태 플래그라서 내 프로필 응답에 `twoFactorEnabled` 로 싣는다([내 프로필](CLE-ACCT-PROFILE.md)).
- `two_factor_setup_started_at` 은 프로필 응답 DTO 에 선언하지 않는다. 선언하지 않은 키가 응답에 실리면 `response-contract` 검증에 걸린다. 비밀이 아니라서 이름 축 목록(`USER_SECRET_KEYS`)에는 넣지 않았다.

## RefreshToken

세션 단위는 `family_id` 다. 토큰 회전 때 행이 새로 생기지만 같은 `family_id` 는 하나의 로그인 세션이다. 사용자에게 보이는 활성 세션은 `is_revoked = false` 인 같은 `family_id` 의 가장 최신 행 메타데이터다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK → User (CASCADE) |
| token_hash | String | SHA-256(리프레시 토큰), UNIQUE |
| family_id | UUID | 로그인 세션 식별자 (회전 뒤에도 유지) |
| is_revoked | Boolean | 강제·자연 만료 여부 |
| expires_at | Timestamp | 만료 시각. 발급하거나 회전한 시점부터 로그인 유지(`remember_me`)면 30일, 아니면 7일 |
| remember_me | Boolean | 로그인 유지 여부 (NOT NULL, 기본 `false`). 로그인 · 소셜 로그인 · Passkey 로그인 · TOTP 2단계 로그인 · 초대 가입이 발급할 때 정한다. 갱신으로 회전하면 새 행이 옛 행 값을 이어받는다. 토큰 수명과 갱신 쿠키 `maxAge` 를 정하는 정본이다([세션과 토큰 「로그인 유지」](CLE-ACCT-SESSION.md#로그인-유지)). V156 이 더했다 |
| device_label | String? | UA 에서 만든 표시 라벨 ("Chrome on macOS") |
| user_agent | String? | 발급 시점 원래 UA |
| ip_address | String? | 발급 시점 클라이언트 IP. IP 추출 순서는 [세션과 토큰](CLE-ACCT-SESSION.md) |
| last_used_at | Timestamp? | 갱신 때마다 갱신 |
| last_used_ip | String? | 마지막 활동 IP |
| created_at | Timestamp | 발급 시각 |

인덱스: `token_hash UNIQUE`, `(user_id, family_id) WHERE is_revoked=false`(V040 메타데이터).

`remember_me` 는 `codebase/backend/migrations/V156__refresh_token_remember_me.sql` 이 더했다. 같은 마이그레이션이 배포 시점에 `is_revoked = false AND expires_at > now() AND expires_at - created_at > interval '8 days'` 인 행만 `true` 로 채운다. 이유는 Rationale 「리프레시 토큰 행에 로그인 유지 여부를 둔다 (2026-11-05)」 에 있다.

## LoginHistory

인증 이벤트를 사용자 단위로 시간순 기록한다. 이벤트의 뜻과 조회 API, 보존 정책은 [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md) 가 정한다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID? | FK → User (CASCADE). 로그인 실패에서 맞는 사용자가 없으면 NULL |
| email | String | 시도된 이메일 (열거 추적용) |
| event | Enum | `login_success` / `login_failed` / `totp_failed` / `webauthn_failed` / `logout` / `session_revoked` / `token_reuse_detected` |
| ip_address | String? | 클라이언트 IP |
| user_agent | String? | 원래 UA |
| device_label | String? | UA 에서 만든 표시 라벨 |
| family_id | UUID? | 관련 로그인 세션 (해당할 때). 일괄 무효화는 NULL |
| failure_reason | String? | `USER_NOT_FOUND` / `EMAIL_NOT_VERIFIED` / `PASSWORD_NOT_SET` / `INVALID_PASSWORD` / `ACCOUNT_LOCKED` / `TOTP_INVALID` / `WEBAUTHN_INVALID` / `WEBAUTHN_COUNTER_REGRESSION` 등. 기록용 사유값이고 응답 에러 코드와는 별개 층이다(`TOTP_INVALID` 처럼 이름이 같은 값도 있다. [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) §6.3). `USER_NOT_FOUND` 는 로그인에서 `LOGIN_FAILED` 로 나간다. 사유별 응답 코드는 [가입과 로그인 「에러 코드」](CLE-ACCT-SIGNIN.md#에러-코드) 에 있다 |
| created_at | Timestamp | 발생 시각 |

- CHECK 제약 이름은 `chk_login_history_event` 다(V040 도입). `webauthn_failed` 는 V058 에서 DROP CONSTRAINT 와 ADD CONSTRAINT 로 더했다.
- 인덱스: `(user_id, created_at DESC)`, `(email, created_at DESC)`(V040). 보존 배치용 인덱스는 [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md) 에 있다.
- 180일이 지난 행은 매일 배치로 지운다([Redis 와 배치](CLE-ACCT-DATA-OPS.md#redis-와-배치)).

## WebAuthnCredential

사용자가 등록한 Passkey·보안 키 인증기다. 사용자당 여러 개를 등록할 수 있다. 등록·인증·삭제 흐름은 [가입과 로그인](CLE-ACCT-SIGNIN.md) 을 따른다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK → User (CASCADE 삭제) |
| credential_id | String | UNIQUE. WebAuthn 표준 credential ID (base64url). 길이가 가변이라 TEXT |
| public_key | Bytes | CBOR-COSE 로 직렬화한 공개 키 (BYTEA) |
| counter | BigInt | 재전송 방어용 sign counter. 인증마다 갱신한다. 처음 쓰는 Passkey 인증 챌린지로 온 응답이 서명 검증을 통과했는데 역행하면(응답 값이 저장값 이하. 둘 다 0 이면 역행이 아니다) 그 행을 바로 지우고(suspend 컬럼은 두지 않는다) 로그인 이력에 `webauthn_failed`(`WEBAUTHN_COUNTER_REGRESSION`)를 남긴다 |
| transports | String[] | 등록 때 클라이언트가 보낸 transport 문자열 목록. 값은 바꾸지 않고, 필드가 없으면 빈 배열로 저장한다. 개수와 길이 상한은 없고 요청 본문 한도(100KB)만 걸린다. 형식 검증(문자열 배열, NUL 문자 없음, `null` 거부)과 표준 값은 [가입과 로그인 「Passkey 등록·인증 흐름」](CLE-ACCT-SIGNIN.md#passkey-등록인증-흐름) 이 정한다 |
| aaguid | UUID? | 인증기 모델 식별자 (선택) |
| device_name | String? | 사용자가 붙인 표시 이름(`varchar(100)`, 유니코드 코드 포인트 100개까지. 앞뒤 공백을 지우기 전 값으로 센다). NUL 문자는 받지 않는다. 앞뒤 공백 문자를 지워 저장하고 빈 문자열은 저장하지 않는다. DB CHECK 제약은 없고 등록 검증과 이름 변경이 이 규칙을 지킨다. 이름이 없으면 NULL 이고 UI 가 transport 와 등록일로 표시한다. 형식 규칙과 근거는 [가입과 로그인 「Passkey 등록·인증 흐름」](CLE-ACCT-SIGNIN.md#passkey-등록인증-흐름) |
| last_used_at | Timestamp? | 마지막 인증 성공 시각 |
| created_at | Timestamp | 등록 시각 |

인덱스: `credential_id UNIQUE`, `(user_id)`.

- **옵션 토큰**: 등록·인증 옵션 토큰(`optionsToken`)의 챌린지는 stateless JWT 로 발급한다. 만료 5분, payload `{ kind: 'webauthn_register'|'webauthn_auth', sub, challenge, exp }` 다. 발급할 때는 테이블에 두지 않는다.
- **Passkey 인증 챌린지 기록**: Passkey 인증 챌린지(`webauthn_auth` 의 `challenge` 값)는 한 번만 쓰므로 서버가 쓴 값을 기록한다. 챌린지 토큰(`challengeToken`)은 기록하지 않는다. 이 기록의 보존 기간과 규칙은 [가입과 로그인 「Passkey 등록·인증 흐름」](CLE-ACCT-SIGNIN.md#passkey-등록인증-흐름) 에 있다. 기록은 테이블이 아니라 Redis 키에 둔다([Redis 와 배치](CLE-ACCT-DATA-OPS.md#redis-와-배치)).

## AuthOauthState

소셜 로그인 state 를 담는 단명 테이블 `auth_oauth_state` 다. 컬럼은 흐름이 읽고 쓰는 컬럼이다. 타입·제약은 현재 구현(마이그레이션 `V013__auth_oauth_state.sql`)을 따른다. 다른 테이블을 가리키는 FK 는 없다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| state | String(64) | 서버가 만든 state 값. `UNIQUE`(V013) |
| provider | String(32) | OAuth 제공자 (`google`, `github`) |
| mode | String(16) | 시작 요청의 모드. `CHECK (mode IN ('login', 'register'))` |
| remember_me | Boolean | 시작 요청의 로그인 유지 여부. 기본 `false`. 시작 요청의 값을 콜백까지 나르는 컬럼이고 로그인 세션 수명의 정본은 `refresh_token.remember_me` 다 |
| expires_at | Timestamp | `now + 10분` |
| created_at | Timestamp | 생성 시각 |

인덱스: `state UNIQUE`(V013), `idx_auth_oauth_state_expires (expires_at)`.

## Rationale

### `User` 민감 컬럼은 응답 경계에서 지운다

2026-09-06 결정이다. `GET /api/audit-logs` 가 필드 3개를 광고하면서 `User` 엔티티를 통째로 내보내고 있었고, 같은 형태가 워크플로우 버전 상세에서도 났다. 세 안을 견줬다.

| 안 | 채택·기각 이유 |
| --- | --- |
| 컬럼 `select: false` | 기각. 조용히 실패한다. 민감 7컬럼은 내부 경로가 값을 직접 쓴다(로그인 검증, 토큰 소비, 복구 코드 대조). 컬럼 수준에서 끄면 그 경로가 예외 없이 `undefined` 를 받는다. 실측: `user.entity.ts` 에 `select: false`·`@Exclude()` 가 0건이었다 |
| 응답 DTO 를 손으로 좁히기 (단독) | 기각. 다음 자리가 열린다. 유출은 최상위가 아니라 중첩(`data.items[].user.…`)에서 났고 새 엔드포인트마다 같은 판단을 되풀이해야 한다 |
| 응답 경계 투영과 검출 2축 | 채택. 구조 축은 "엔티티를 통째로 실었다" 를, 이름 축은 "그 이름이 응답에 있다" 를 본다 |

두 축을 모두 세운 이유는 계약 검증기(`response-contract.ts`)가 배선된 엔드포인트에서만 동작하고 배선이 아직 전 엔드포인트에 닿지 않았기 때문이다. 이름 축은 선언·배선과 독립이라 실수로 `passwordHash` 를 DTO 에 선언까지 한 경우도 잡는다.

채택안이 코드에서 갖는 형태는 쿼리 범위 `select` 투영이다(예: `find`·`findOne` 옵션 `select: { creator: { id, name, email } }`). 그 쿼리 하나에만 걸리고 값을 읽는 다른 내부 경로는 건드리지 않는다. 첫 줄이 기각한 엔티티 선언의 `@Column({ select: false })` 는 모든 쿼리에 걸려 그 경로가 `undefined` 를 받으므로 이름은 닮았지만 성질이 반대다.

사례는 `WorkflowVersionsService.findOne`(`CREATOR_PROJECTION`)과 `WorkspacesService.listMembers` 다. 후자는 전환하자 `user-entity-exposure-guard` 의 화이트리스트에서 빠졌다. 그 래칫은 양방향이라 목록에 남겨 두면 실패하므로 항목이 사라지는 것 자체가 전환의 기계적 증거다. 이 구분은 `select: { … }` 를 기각한 대안의 재도입으로 오판하지 않게 하려고 적는다.

`select: false` 기각은 이 저장소의 일반 규칙이 아니다. 컬럼별 소비 패턴이 가른다. [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) 의 `Notification.background_run_id` 는 `select: false` 로 선언돼 있고(V107) 그것이 맞다. 유일한 내부 소비자(`findByBackgroundRun`)가 WHERE 절에만 쓴다.

| 내부 소비 패턴 | 처분 | 사례 |
| --- | --- | --- |
| 값을 읽는다 | 응답 경계에서 지운다(`select: false` 금지) | `User` 민감 7컬럼, `Trigger.notification_secret_v2`(교체 스윕이 승격에 쓴다) |
| WHERE 절에만 쓴다 | `select: false` 유효 | `Notification.background_run_id` |

이 결정을 "`select: false` 를 쓰지 마라" 의 선례로 인용하려면 그 컬럼의 소비 패턴이 앞쪽임을 먼저 보여야 한다.

### 로그인 이력 CHECK 변경을 한 문장 마이그레이션으로 했다

V058(`chk_login_history_event` 에 `webauthn_failed` 추가)은 `DROP/ADD CONSTRAINT` 한 문장으로 썼다. 마이그레이션 기본 규약은 NOT VALID 와 VALIDATE 두 단계지만([DB 마이그레이션 규약](../CLE-ENG/CLE-ENG-MIGRATION.md)), 이 건은 다음 조건을 모두 만족해 한 문장이 안전하다고 판단했다.

1. append-only 테이블이다. `login_history` 는 INSERT 만 한다(보존 배치의 DELETE 만 예외). 오래 도는 쓰기 트랜잭션이 ACCESS EXCLUSIVE 잠금과 부딪칠 가능성이 낮다.
2. enum 확장이다. 새 값(`webauthn_failed`)은 기존 행에 없으므로 NOT VALID 의 "기존 행 검증 건너뛰기" 이득이 없다. 전체 검증을 해도 위반은 0건이다.
3. 테이블이 아직 작다. 잠금 영향을 무시할 수 있는 규모다. 다만 100만 행에 이르면 다음 CHECK 변경부터 NOT VALID 와 VALIDATE 로 나누는 것을 의무로 하고, 180일 보존 배치(`login-history-pruner`)가 제대로 도는지 모니터링한다.

이미 적용한 제약을 NOT VALID 로 다시 선언하는 것은 뜻이 없다(이름이 같으면 `ERROR: relation already exists`). DROP, NOT VALID ADD, VALIDATE 세 단계로 우회하면 한 문장보다 잠금 창이 길어진다(ACCESS EXCLUSIVE 잠금 3회). 같은 형태의 변경은 위 조건을 점검한 뒤 고르고, append-only 테이블도 100만 행 이후에는 두 단계를 권한다.

### `user.theme` CHECK 확장은 두 단계 마이그레이션으로 했다

2026-10-10 결정이다(NERV Task `CLE-T-E7MF3Q`). 프로필 수정 API(`UpdateMeDto.USER_THEMES`)와 환경설정 화면은 테마로 `light`·`dark`·`system` 을 받았다. 그런데 V001 의 CHECK 는 `light`·`dark` 만 허용해서 `system` 을 저장하면 제약 위반으로 500 이 났다. 여섯 안을 견줬다.

| 안 | 채택·기각 이유 |
| --- | --- |
| DTO 와 화면에서 `system` 을 빼기 | 기각. 화면에 System 선택지가 이미 있었고 저장만 막혀 있었다. 값을 빼면 OS 색상 모드를 따르는 선택지를 잃는다 |
| V001 의 CHECK 를 직접 고치기 | 기각. 이미 적용한 마이그레이션은 고치지 않는다([DB 마이그레이션 규약](../CLE-ENG/CLE-ENG-MIGRATION.md)) |
| 새 마이그레이션에서 한 문장으로 DROP·ADD | 기각. 「로그인 이력 CHECK 변경을 한 문장 마이그레이션으로 했다」 의 첫 조건(append-only)을 만족하지 않는다. `user` 는 로그인할 때마다 `login_attempts` 를 고치고 프로필 수정도 받는 테이블이다 |
| 한 파일에서 새 제약을 NOT VALID 로 걸고 바로 VALIDATE 하기 | 기각. 아래 문단의 잠금 문제 |
| 같은 파일에 두고 같은 이름 `.conf`(`V149__user_theme_allow_system.conf`)로 트랜잭션을 끄기 | 기각. 규약 기본 절차(`migrations/README.md` §1)와 V141~V147 선례를 따른다. `.conf` 관찰은 아래 문단 |
| 이름 있는 새 제약을 NOT VALID 로 걸고(V149) 다음 파일에서 VALIDATE 한 뒤 옛 제약을 지우기(V150) | 채택. 마이그레이션 기본 절차(`migrations/README.md` §1)를 따른다. 잠금이 강한 단계와 검사가 오래 걸리는 단계를 다른 트랜잭션에 둔다 |

새 제약 이름은 `chk_user_theme` 이다. V001 의 인라인 CHECK 에는 PostgreSQL 이 붙인 자동 이름 `user_theme_check` 가 있어서 V150 이 `DROP CONSTRAINT IF EXISTS` 로 지운다. 새 제약이 옛 제약보다 넓으므로 기존 행은 위반할 수 없다. 되돌리기는 두 파일의 역순이다. 먼저 V150 의 `-- DOWN:` 대로 `system` 행을 `light` 로 바꾸고 옛 제약을 다시 건다. 이어서 V149 의 `-- DOWN:` 대로 새 제약을 지운다. 

두 파일로 나눈 이유는 잠금이다. Flyway 는 파일 하나를 트랜잭션 하나로 돌린다. `ADD CONSTRAINT … NOT VALID` 가 잡은 ACCESS EXCLUSIVE 잠금은 커밋할 때까지 남아서, 같은 파일에서 VALIDATE 하면 기존 행을 모두 검사하는 동안 `user` 의 읽기와 쓰기가 막힌다. V149 는 메타데이터만 바꾸므로 금방 커밋된다. V150 의 VALIDATE 는 SHARE UPDATE EXCLUSIVE 만 잡아서 검사하는 동안에도 읽기와 쓰기를 막지 않는다. 마지막 DROP 은 ACCESS EXCLUSIVE 를 잡지만 검사가 끝난 뒤에 잡고 곧바로 커밋된다.

두 파일 모두 `lock_timeout` 을 3초로 둔다(V036 과 같은 방식). 오래 열린 트랜잭션이 `user` 테이블 잠금을 잡고 있으면 ALTER 가 잠금을 기다리고, 그 뒤에 오는 `user` 접근도 로그인을 포함해 모두 함께 기다린다. 3초 안에 잠금을 잡지 못하면 그 파일이 롤백되고 Flyway 이력에 실패 행이 남지 않으므로 다시 배포하면 된다.

트랜잭션을 끄는 설정 파일(같은 이름 `.conf` 나 `.sql.conf`)은 쓰지 않았다. 같은 이름 `.conf` 가 적용되지 않은 것처럼 보인 관찰이 있어서다(재현 전, NERV Task `CLE-T-NYFE78` 에서 확인). 두 파일로 나누는 방식은 파일마다 트랜잭션 하나라는 Flyway 기본 동작만으로 NOT VALID 와 VALIDATE 의 잠금을 나눈다. V141~V146 이 `NOT VALID` 로 건 외래 키를 V147 이 따로 검증한 것과 같은 방식이다.

### 리프레시 토큰 행에 로그인 유지 여부를 둔다 (2026-11-05)

NERV Task `CLE-T-BYCGF1` 에서 바꿨다. 규칙과 근거, 기각한 안은 [세션과 토큰 「토큰 회전이 로그인 유지 여부를 이어받는다 (2026-11-05)」](CLE-ACCT-SESSION.md#토큰-회전이-로그인-유지-여부를-이어받는다-2026-11-05) 에 있다. 이 문서에는 컬럼 정의와 백필 근거만 적는다.

- 그 전에는 토큰 행에 로그인 유지 여부가 없어서 갱신이 토큰을 회전할 때 늘 `false` 로 넘겼다. 그래서 30일로 로그인한 세션도 첫 회전 뒤에는 7일 만료가 됐다. 회전이 이어받을 값을 남기려고 `refresh_token.remember_me`(NOT NULL, 기본 `false`)를 더했다.
- `auth_oauth_state.remember_me` 는 그대로 둔다. 소셜 로그인 시작부터 콜백까지 값을 나르는 단명 행이고 콜백이 소비하면 사라진다. 콜백이 발급한 리프레시 토큰의 `remember_me` 가 그 값을 받는다.
- 백필은 `expires_at - created_at` 으로 발급 수명을 가른다. 7일 행은 차이가 7일이고 30일 행은 30일이라 8일을 경계로 둔다. 이미 한 번 회전한 행은 고치기 전 규칙대로 7일로 발급돼 원래 로그인 유지 여부를 알 수 없다. 그래서 `false` 로 남긴다. 그 사용자는 다음 로그인부터 30일을 받는다.
- **기각: 기존 행을 모두 `false` 로 두기.** 배포 시점에 30일로 로그인해 아직 한 번도 회전하지 않은 세션도 다음 회전부터 7일이 된다. 이런 행은 발급 수명으로 판별할 수 있으므로 살린다.
- **기각: 살아 있는 행을 모두 `true` 로 채우기.** 로그인 유지를 끄고 로그인한 세션까지 30일로 늘어난다.
- 상수 기본값이 있는 NOT NULL 컬럼 추가는 PostgreSQL 11 이상에서 메타데이터만 바꾼다. 다만 ACCESS EXCLUSIVE 잠금을 잡으므로 V149 와 같이 `lock_timeout` 을 3초로 둔다. 잡지 못하면 그 파일이 롤백되므로 다시 배포하면 된다.

### 새로 저장하는 이메일을 소문자로 정규화하고 기존 행은 바꾸지 않는다 (2026-11-05)

NERV Task `CLE-T-SFWX84` 에서 바꿨다. 기존 계정을 다루는 방식은 사람 결정이다(NERV 질문 `01a1ac05-8931-7309-acc4-ae26e35086a2`). 비교 규칙과 근거, 기각한 안은 [가입과 로그인 「대소문자만 다른 기존 계정은 대소문자까지 같은 계정만 쓰고 나머지는 모호로 거부한다 (2026-11-05)」](CLE-ACCT-SIGNIN.md#대소문자만-다른-기존-계정은-대소문자까지-같은-계정만-쓰고-나머지는-모호로-거부한다-2026-11-05) 에 있다. 이 문서에는 데이터 쪽만 적는다.

- 그 전에는 이메일을 입력한 대소문자 그대로 저장했다. 로그인 · 가입 중복 확인 · `check-email` · OAuth 이메일 연결도 대소문자를 구분해 비교했다. `LOWER(email)` 로 비교한 곳은 이메일 변경의 중복 확인(`emailTakenByOther`)뿐이었다.
- 정규화는 새로 쓰는 값에만 건다. 기존 행을 소문자로 바꾸는 마이그레이션은 기각했다. 대소문자만 다른 묶음이 있으면 `email UNIQUE` 에 걸리고 어느 계정을 남길지 사람이 정해야 한다.
- 비교는 `LOWER(email)` 로 하고 V101 인덱스를 쓴다. 새 인덱스는 더하지 않았다.
- `LOWER(email)` 유니크 인덱스는 지금 걸 수 없다. 묶음이 남아 있으면 인덱스를 만들지 못한다. 운영자가 [User](#user) 의 쿼리로 묶음을 찾아 정리한 뒤 NERV Task `CLE-T-6QZCYD` 가 건다.
