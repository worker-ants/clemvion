# 신규 식별자 충돌 검토 — 2fa-webauthn.md

검토 대상: `plan/in-progress/2fa-webauthn.md`
검토 모드: spec draft 검토 (--spec)
검토일: 2026-05-18

---

## 발견사항

### [WARNING] `challengeToken` 필드 — 기존 코드와 의미 충돌 가능성

- **target 신규 식별자**: `POST /api/auth/2fa/webauthn/authenticate/options` 응답 및 기존 `/api/auth/login` 응답 확장 `{ requires2fa: true, methods: [...], challengeToken }`
- **기존 사용처**: `codebase/backend/src/modules/auth/auth.controller.ts` L180·L194·L198 및 `spec/data-flow/2-auth.md` L75 — `{ requiresTotp: true, challengeToken }` 가 이미 TOTP 전용 challenge JWT 를 가리키는 이름으로 실사용 중. `POST /api/auth/login/totp` (L207) 가 이 `challengeToken` 을 받는다.
- **상세**: target 은 기존 login 응답을 `{ requires2fa: true, methods: ['webauthn'|'totp'], challengeToken }` 으로 진화시키겠다고 명시하면서 `challengeToken` 이름을 그대로 재사용한다. 그러나 현재 코드에서 `challengeToken` 은 TOTP 전용 단명 JWT 이고, WebAuthn 인증 challenge 는 다른 포맷(CBOR/base64url credential ID, user handle 포함)을 가진다. 두 방식의 challenge 가 동일 필드명으로 내려지면 클라이언트가 방식(TOTP vs WebAuthn)에 따라 서로 다른 처리를 해야 하는데 필드명으로는 구분할 수 없어 혼선이 생긴다. `methods` 배열로 방식은 알 수 있으나, WebAuthn 전용 challenge JWT 와 TOTP challenge JWT 의 payload 구조가 다르다는 점을 spec 에서 명시하지 않으면 구현 오류로 직결된다.
- **제안**: WebAuthn challenge 응답 필드를 `webauthnChallengeToken` 또는 `challengeToken` 에 `kind` 서브필드 명시로 구분한다. 또는 methods 분기별로 `totpChallengeToken` / `webauthnChallengeToken` 을 별도 반환하고, `challengeToken` 단일 필드 재사용을 금지한다. target §3 의 "TOTP challenge token 과 동일 패턴" 언급은 payload 구조가 다른(`kind: 'webauthn_register'|'webauthn_auth'`) 만큼 명칭도 분리하는 것이 일관성에 부합한다.

---

### [CRITICAL] `requiresTotp` 필드 — 기존 API 응답과 병행 의미가 명확하지 않음

- **target 신규 식별자**: `requires2fa` (boolean) — `requiresTotp` 를 대체 예정
- **기존 사용처**: `codebase/backend/src/modules/auth/auth.controller.ts` L194·L197 에서 `requiresTotp: true` 가 실사용 중이며, `spec/data-flow/2-auth.md` L75에서 `{ requiresTotp: true, totpToken }` 이 시퀀스 다이어그램에 명시되어 있음.
- **상세**: target 은 "호환을 위해 `requiresTotp` 도 한동안 같이 내려준다" 고 명시하지만, 동일 응답에 `requiresTotp: true` 와 `requires2fa: true` 가 동시에 존재하면 프론트엔드가 어느 필드를 우선 분기해야 하는지 spec 에 정의되지 않았다. WebAuthn credential 이 있는 사용자는 `requiresTotp: false` + `requires2fa: true, methods: ['webauthn']` 인데, 기존 코드(`if ('requiresTotp' in result)`)가 새 응답 구조와 혼재하면 로그인 분기 로직이 깨진다. 단계적 이행 기간이 미정이며 deprecation 시점도 spec 에 명시되지 않음.
- **제안**: spec §3 응답 진화 섹션에 (a) `requiresTotp` 의 deprecated 시점 또는 major API 버전, (b) 두 필드가 공존할 때의 우선순위 규칙(`requires2fa` 필드 존재 시 `requiresTotp` 무시), (c) 프론트엔드 migration 가이드를 명시한다. 기존 `spec/2-navigation/10-auth-flow.md` §3.2 의 TOTP 화면 flowchart 도 갱신 대상임을 plan §5 에 추가한다.

---

### [WARNING] `webauthn_failed` — LoginHistory 이벤트 enum 충돌 위험

- **target 신규 식별자**: `webauthn_failed` (LoginHistory `event` enum 추가)
- **기존 사용처**: `codebase/backend/migrations/V040__auth_session_metadata_and_login_history.sql` L39–L48 의 `CONSTRAINT chk_login_history_event CHECK (event IN ('login_success', 'login_failed', 'totp_failed', 'logout', 'session_revoked', 'token_reuse_detected'))` 에 `webauthn_failed` 가 없음. `spec/5-system/1-auth.md` §4.3 에도 `totp_failed` 만 존재.
- **상세**: target 은 "V058 로 갱신" 을 명시하나, CHECK 제약명이 `chk_login_history_event` 임을 명시하지 않고 있다. 또한 target 은 `idx_login_history_event` 가드를 언급하는데 실제 마이그레이션(`V040`)에는 `idx_login_history_event` 라는 인덱스가 존재하지 않는다 — 실제 인덱스명은 `idx_login_history_user_created`, `idx_login_history_email_created`, `idx_login_history_created` 이다. 이 명칭 불일치는 구현 시 혼란을 유발한다.
- **제안**: target §3 의 `idx_login_history_event` 가드 언급을 `chk_login_history_event` CHECK 제약으로 정정한다. V058 마이그레이션은 `ALTER TABLE login_history DROP CONSTRAINT chk_login_history_event; ALTER TABLE login_history ADD CONSTRAINT chk_login_history_event CHECK (event IN (..., 'webauthn_failed'))` 패턴을 명시한다.

---

### [WARNING] 마이그레이션 버전 `V057` / `V058` — 현재 최신 V056 과의 연속성

- **target 신규 식별자**: `V057__webauthn_credentials_and_recovery.sql`, V058 (login_history CHECK 갱신)
- **기존 사용처**: `codebase/backend/migrations/` 의 현재 최신 파일은 `V056__notification_active_partial_index.sql`. `spec/data-flow/8-notifications.md` L67 에서도 V055·V056 이 참조됨.
- **상세**: V057·V058 번호는 현재 코드베이스의 V056 다음 번호로 직접 충돌은 없다. 그러나 `notification-websocket-name-sync.md` 등 현재 진행 중인 다른 plan 이 V057 또는 그 이후 번호를 선점할 가능성이 있다. `spec/conventions/migrations.md` 의 중복 V번호 빌드 fail 가드가 작동하므로 실제 충돌 시 빌드 차단되어 위험도는 낮지만, 구현 착수 직전에 재확인이 필요하다.
- **제안**: 구현 착수 전 `codebase/backend/migrations/` 디렉토리를 확인하여 V057 번호가 이미 사용됐으면 다음 가용 번호로 변경한다. 동시 진행 중인 plan 들(`notification-websocket-name-sync.md` 등)과 마이그레이션 번호를 조율한다.

---

### [WARNING] `webauthn.config.ts` — 설정 모듈 네임스페이스 충돌 가능성

- **target 신규 식별자**: `webauthn.config.ts` (`registerAs('webauthn', ...)` 로 등록 예상)
- **기존 사용처**: `codebase/backend/src/common/config/` 아래 `app`, `database`, `s3`, `redis`, `llm`, `jwt`, `mail` 가 이미 `registerAs` 로 등록되어 있음. `webauthn` namespace 는 아직 없음.
- **상세**: 직접 충돌은 없다. 다만 파일 위치가 target 에서 명시되지 않아 `src/common/config/webauthn.config.ts` 배치인지 `src/modules/auth/webauthn.config.ts` 배치인지 불명확하다. 기존 config 파일들은 모두 `src/common/config/` 에 집중되어 있으므로 모듈 내부(`src/modules/auth/`) 에 두면 컨벤션을 벗어난다.
- **제안**: target 의 §3 구현 항목에 `webauthn.config.ts` 위치를 `codebase/backend/src/common/config/webauthn.config.ts` 로 명시한다.

---

### [WARNING] `WebAuthnCredential` TypeORM entity — 기존 엔티티명과의 혼동

- **target 신규 식별자**: `WebAuthnCredential` (TypeORM entity), `WebAuthnService`
- **기존 사용처**: 코드베이스에 `WebAuthn*` prefix 를 가진 엔티티가 없음. `totp.service.ts` / `totp.dto.ts` 가 2FA TOTP 를 담당. 충돌 없음.
- **상세**: 직접 충돌은 없다. 그러나 `WebAuthnCredential` 이라는 이름은 WebAuthn 표준 스펙의 `PublicKeyCredential` 과 구분이 필요하다 — 프론트엔드 `@simplewebauthn/browser` 의 반환 타입 `AuthenticationResponseJSON` / `RegistrationResponseJSON` 과 백엔드 DB entity 의 동일 prefix 사용이 혼선을 유발할 수 있다. 특히 e2e 테스트(`webauthn-2fa.e2e-spec.ts`) 에서 fixture 합성 키 쌍과 DB entity 를 동일 이름으로 참조하게 되면 타입 단언이 복잡해진다.
- **제안**: INFO 수준의 관찰. DB entity 는 `WebAuthnCredential`, 프론트엔드 라이브러리 반환 타입은 `RegistrationResponseJSON` / `AuthenticationResponseJSON` 으로 이름이 이미 다르므로 실질적 충돌은 없다. e2e fixture 타입은 `SimulatedAuthenticationResponse` 같은 별도 이름을 권장한다.

---

### [INFO] `webauthn_recovery_codes` 컬럼 — `totp_recovery_codes` 와 이름 패턴 통일

- **target 신규 식별자**: `webauthn_recovery_codes` (user 테이블 컬럼, TEXT[])
- **기존 사용처**: `spec/data-flow/2-auth.md` L170 에서 `totp_recovery_codes` 컬럼이 이미 참조됨. `spec/1-data-model.md` §2.1 User 표에는 `two_factor_enabled` 만 있고 `totp_recovery_codes` 컬럼은 data-model spec 에 미등재 상태.
- **상세**: `totp_recovery_codes` 와 `webauthn_recovery_codes` 는 같은 user 테이블에 공존하게 된다. 이름 패턴(`{method}_recovery_codes`)은 일관된다. 단, `spec/1-data-model.md` §2.1 User 표에 `totp_recovery_codes` 가 누락되어 있어, target 의 §5 spec 갱신 시 `webauthn_recovery_codes` 추가와 함께 `totp_recovery_codes` 도 함께 등재해야 한다.
- **제안**: plan §5 의 `spec/1-data-model.md` 갱신 항목에 User 표의 `totp_recovery_codes TEXT[] NULL` 과 `webauthn_recovery_codes TEXT[] NULL` 을 동시에 추가하도록 명시한다. `two_factor_enabled` 가 WebAuthn 에만 설정된 사용자에게도 적용되는지(현재 TOTP 전용) 여부를 spec §1.4 에서 명확히 해야 한다.

---

### [INFO] spec 파일 경로 컨벤션 — 이번 plan 이 갱신하는 파일 경로 검토

- **target 신규 식별자**: plan 에서 언급된 spec 갱신 대상: `spec/5-system/1-auth.md`, `spec/2-navigation/9-user-profile.md`, `spec/data-flow/2-auth.md`, `spec/1-data-model.md`
- **기존 사용처**: 모두 실존하는 파일. `spec/5-system/1-auth.md` 에는 §1.4 2FA 섹션이 있고, §5 API 엔드포인트 표가 있다.
- **상세**: 경로 충돌 없음. 기존 네이밍 컨벤션(`N-name.md` / `_product-overview.md`) 을 모두 준수한다. 신규 spec 파일 생성은 없고 기존 파일 갱신만 있어 파일 경로 충돌 위험 없음.
- **제안**: 갱신 시 `spec/2-navigation/10-auth-flow.md` §3.4 의 2FA 입력 화면 wireframe 도 WebAuthn 분기를 반영해야 하나 target §5 의 갱신 대상 목록에 누락되어 있다. plan §5 에 `spec/2-navigation/10-auth-flow.md` §3.4 갱신을 추가하길 권장한다.

---

## 요약

target 문서(`plan/in-progress/2fa-webauthn.md`)가 도입하는 새 식별자 중 직접적인 동일명 의미 충돌(CRITICAL)은 `requiresTotp` 필드 하나다 — 기존 코드에서 이미 `requiresTotp: true` 가 실사용 중인데 target 은 이를 `requires2fa` 로 전환하면서 "한동안 병행 유지" 한다고만 명시하고 두 필드가 공존할 때의 우선순위와 migration 경계가 미정의 상태로 남아 있어 런타임 분기 오류로 직결될 수 있다. WARNING 급으로는 `challengeToken` 이름이 TOTP 와 WebAuthn challenge JWT 를 동일 필드명으로 사용하는 의미 혼선, `idx_login_history_event` 라는 실존하지 않는 인덱스명 오기, 마이그레이션 번호 선점 가능성이 있다. 엔티티·환경변수·파일 경로 영역에서는 실질적 충돌이 없고 이름 패턴도 기존 컨벤션에 부합한다. 구현 착수 전 CRITICAL 1건과 WARNING 3건을 spec 에서 명확히 정의해야 한다.

---

## 위험도

MEDIUM
