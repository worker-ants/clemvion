# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/2fa-webauthn.md`
**검토 모드**: spec draft 검토 (`--spec`)
**검토일**: 2026-05-18

---

### 발견사항

---

- **[CRITICAL]** 로그인 2FA 엔드포인트 계약 충돌 — 두 spec 간 경로·페이로드 불일치
  - target 위치: §3 백엔드 구현 — "기존 `/auth/login` 응답을 확장: `{ requiresTotp }` 대신 `{ requires2fa, methods, challengeToken }` 로 진화"
  - 충돌 대상:
    - `spec/data-flow/2-auth.md §1.2` — 현재 2FA 흐름은 `POST /api/auth/login/totp { totpToken, code }` 와 응답 `{ requiresTotp: true, totpToken }` 으로 기술됨
    - `spec/2-navigation/10-auth-flow.md §3.4, §8` — 동일 흐름을 `POST /api/auth/verify-2fa { tempToken, code }` 로 기술. 필드명도 `tempToken` 으로 다름
  - 상세: 기존 두 spec 사이에도 2FA 엔드포인트·페이로드 명세가 이미 불일치한 상태(`/api/auth/login/totp` vs `/api/auth/verify-2fa`, `totpToken` vs `tempToken`)다. draft 는 이 불일치를 해소하지 않고 세 번째 표현(`{ requires2fa, methods, challengeToken }`)을 추가한다. spec/5-system/1-auth.md §5 API 표에는 현행 TOTP 엔드포인트 자체가 누락되어 있어 canonical 정의가 없다. 구현 착수 전에 어느 경로·페이로드를 canonical 로 확정해야 한다.
  - 제안: `spec/5-system/1-auth.md §5` 에 현행 TOTP 2FA 엔드포인트를 먼저 명확히 추가한 뒤, WebAuthn 확장 시 어느 경로로 통합할지 결정. `spec/data-flow/2-auth.md §1.2` 와 `spec/2-navigation/10-auth-flow.md §3.4/§8` 를 동시에 갱신해 canonical 경로를 단일화.

---

- **[CRITICAL]** `spec/1-data-model.md` User 엔티티에 TOTP 전용 컬럼 미정의
  - target 위치: §2 데이터 모델 — "`user` 테이블에 `webauthn_recovery_codes TEXT[] NULL` 컬럼 추가. (`totp_recovery_codes` 와 별도)"
  - 충돌 대상: `spec/1-data-model.md §2.1` — User 엔티티 필드 표에 `two_factor_enabled` 만 있고, `two_factor_secret`, `totp_recovery_codes` 등 TOTP 구현에 필요한 컬럼이 정의되지 않음. `spec/data-flow/2-auth.md §2.1` 스키마 매핑에서는 `two_factor_secret, totp_recovery_codes` 를 기정사실로 사용
  - 상세: draft 는 `totp_recovery_codes` 와 별도로 `webauthn_recovery_codes` 를 추가하겠다고 선언하는데, `totp_recovery_codes` 자체가 `spec/1-data-model.md` 의 User 엔티티 표에 없다. 데이터 모델 spec 의 User 엔티티가 불완전하게 정의되어 있어 cross-spec 일관성 기반이 흔들린다. 동시에 `webauthn_recovery_codes` 추가도 spec/1-data-model.md §2.1 에 반영이 필요하다.
  - 제안: `spec/1-data-model.md §2.1` User 엔티티에 `two_factor_secret`, `totp_recovery_codes`, `webauthn_recovery_codes` 를 모두 명시. draft §5 spec 갱신 항목에 이 작업을 명시적으로 추가.

---

- **[CRITICAL]** LoginHistory `event` Enum 확장과 데이터 모델 spec 의 직접 모순
  - target 위치: §3 백엔드 구현 — "AuditLog/LoginHistory 의 `event` enum 에 `webauthn_failed` 추가 — `check_login_history_event` CHECK 제약을 V058 로 갱신"
  - 충돌 대상: `spec/1-data-model.md §2.18.2` — LoginHistory `event` Enum 정의: `login_success / login_failed / totp_failed / logout / session_revoked / token_reuse_detected` (6가지). `webauthn_failed` 미포함.
  - 상세: draft 는 `webauthn_failed` 를 DB CHECK 제약까지 갱신하겠다고 선언하지만, `spec/1-data-model.md §2.18.2` 와 `spec/5-system/1-auth.md §4.3` 의 event 열거에 이 값이 없다. spec 갱신 계획(§5)에 LoginHistory 표 갱신이 누락되어 있다.
  - 제안: draft §5 spec 갱신 항목에 `spec/1-data-model.md §2.18.2` LoginHistory event 열거 갱신을 추가. `spec/5-system/1-auth.md §4.3` LoginHistory 이벤트 표에도 `webauthn_failed` 추가.

---

- **[WARNING]** `spec/2-navigation/9-user-profile.md §2.2 보안 설정` — "TOTP 기반" 단정 표현
  - target 위치: §4 프론트엔드 구현, §5 spec 갱신 — `spec/2-navigation/9-user-profile.md §2.2 보안 표 갱신` 계획 있음
  - 충돌 대상: `spec/2-navigation/9-user-profile.md §2.2` — `| 2FA 설정 | TOTP 기반. /profile/security 페이지. QR 코드 표시 → ...`
  - 상세: draft 는 §2.2 보안 표 갱신을 계획하고 있으나, "QR 코드 표시 → 인증 앱으로 스캔 → 확인 코드 입력" 이라는 TOTP 전용 플로우 설명과 "/profile/security" 에 WebAuthn Passkey 카드를 추가하는 것이 어떤 UX 구조로 공존할지 구체적으로 정해지지 않았다. 보안 설정 페이지의 레이아웃·섹션 분리 방식이 spec 에 반영되어야 프론트 구현 방향이 확정된다.
  - 제안: §5 spec 갱신 항목에서 `spec/2-navigation/9-user-profile.md §2.2` 의 구체적 개정 범위(TOTP 섹션 + Passkey 섹션 분리 레이아웃)를 draft 에 명시. 단순 "보안 표 갱신" 으로 뭉뚱그리지 말 것.

---

- **[WARNING]** `/api/auth/2fa/webauthn/authenticate/options` 의 인증 흐름 — anonymous 로그인 연계 부재
  - target 위치: §3 백엔드 구현 — `POST /api/auth/2fa/webauthn/authenticate/options (challenge token + 또는 anonymous + email)`
  - 충돌 대상: `spec/5-system/1-auth.md §2.1, §2.2` — JWT 기반 인증 체계. `spec/data-flow/2-auth.md §1.2` — 로그인 2FA 단계는 tempToken/totpToken 을 발급해 상태를 유지하는 방식.
  - 상세: WebAuthn 인증 options 엔드포인트가 "(challenge token + 또는 anonymous + email)" 두 경로를 허용한다고 명시하나, "anonymous + email" 흐름의 인증 방식(rate limit, 계정 존재 여부 노출 방지 정책)이 기존 auth spec 과 어떻게 조화를 이루는지 정의가 없다. 기존 spec 은 로그인 실패 후 5회 잠금(`§1.1`), 계정 존재 여부 비노출(`§3.2 처리 플로우`) 등의 정책을 가지고 있다.
  - 제안: draft §3 또는 §5 spec 갱신에서 anonymous 흐름의 rate limit·계정 존재 여부 처리 방침을 명시. 기존 auth spec 의 계정 잠금·실패 카운트 정책과 충돌하지 않도록 정의.

---

- **[WARNING]** 세션 강제 종료 재인증 방식 — WebAuthn 추가 후 정책 공백
  - target 위치: 해당 없음 (draft 미언급)
  - 충돌 대상: `spec/5-system/1-auth.md §2.3` — "강제 종료 재인증: 비밀번호 재확인 필수. OAuth-only 사용자는 2FA TOTP 또는 이메일 OTP 로 대체"
  - 상세: WebAuthn 이 추가되면 "2FA = TOTP" 라는 가정이 깨진다. WebAuthn-only 사용자(TOTP 미등록)가 세션을 강제 종료할 때 재인증 방법이 비밀번호·TOTP·WebAuthn 중 어느 것인지 spec 이 침묵한다. draft 가 이 정책 공백을 메우지 않으면 구현자가 임의로 결정하게 된다.
  - 제안: `spec/5-system/1-auth.md §2.3` "강제 종료 재인증" 항목에 WebAuthn 케이스를 추가. draft §5 spec 갱신 항목에도 명시.

---

- **[WARNING]** `spec/data-flow/2-auth.md §2.1` 스키마 매핑 — WebAuthn 신규 테이블 미반영 범위 명시 부재
  - target 위치: §5 spec 갱신 — "`spec/data-flow/2-auth.md` — TOTP-only 가정 sequence 에 WebAuthn 분기 추가"
  - 충돌 대상: `spec/data-flow/2-auth.md §2.1` 스키마 매핑 표 — 현재 `user`, `refresh_token`, `auth_oauth_state`, `login_history`, `workspace`, `workspace_member` 만 기재
  - 상세: draft 계획이 sequence diagram 분기 추가만 언급하는데, §2.1 스키마 매핑 표에도 `webauthn_credential`, `user.webauthn_recovery_codes` 의 read/write 패턴 추가가 필요하다. 이를 누락하면 data-flow spec 의 스키마 섹션이 새 테이블과 불일치 상태로 남는다.
  - 제안: draft §5 spec 갱신 항목에 `spec/data-flow/2-auth.md §2.1` 스키마 매핑 표 갱신을 명시.

---

- **[INFO]** `spec/1-data-model.md §3` 인덱스 전략 표 — webauthn_credential 인덱스 미등재
  - target 위치: §2 데이터 모델 — `webauthn_credential(user_id)`, `webauthn_credential(credential_id)` UNIQUE 인덱스 정의
  - 충돌 대상: `spec/1-data-model.md §3` 인덱스 전략 표
  - 상세: 신규 테이블의 인덱스가 draft 에 정의되어 있으나, spec/1-data-model.md 의 §3 인덱스 전략 표에 WebAuthn 관련 항목이 추가되어야 한다. §5 spec 갱신 계획에 이 표 갱신이 빠져 있다.
  - 제안: draft §5 의 `spec/1-data-model.md` 갱신 항목에 §3 인덱스 전략 표 갱신을 명시.

---

- **[INFO]** `spec/2-navigation/9-user-profile.md §6.1` API 표 — WebAuthn credential 관리 endpoint 누락 예정
  - target 위치: §3 백엔드 구현 — `GET/PATCH/DELETE /api/auth/2fa/webauthn/credentials/*` 계획
  - 충돌 대상: `spec/2-navigation/9-user-profile.md §6.1` API 표 — 현재 `enable-2fa`, `confirm-2fa` 까지만 있음
  - 상세: draft 의 §5 spec 갱신에 "§6.1 API 표 갱신" 이 포함되어 있어 의도는 있으나, 어느 endpoint 를 어느 표에 등재할지(사용자 프로필 API 표 vs auth spec API 표) 구분이 없다. WebAuthn credential 관리는 사용자 프로필 영역 API 이므로 `/api/users/me/*` 경로가 더 일관적일 수 있는데, draft 는 `/api/auth/2fa/webauthn/*` 를 사용한다.
  - 제안: credential 관리 endpoint 경로 체계(`/api/auth/2fa/webauthn/*` vs `/api/users/me/webauthn/*`)를 명시적으로 결정하고 spec 에 기재. spec/2-navigation/9-user-profile.md §6.1 에 WebAuthn 관리 endpoint 를 추가할 경우 경로 일관성 확인 필요.

---

### 요약

WebAuthn 추가 계획 자체의 방향성(WebAuthn 우선 fallback, 별도 복구 코드, stateless challenge JWT)은 기존 TOTP 설계 패턴과 잘 어울린다. 그러나 세 가지 CRITICAL 이슈가 구현 착수를 차단한다: (1) 기존 TOTP 2FA endpoint 가 `spec/data-flow/2-auth.md`(`/api/auth/login/totp`, `totpToken`) 와 `spec/2-navigation/10-auth-flow.md`(`/api/auth/verify-2fa`, `tempToken`) 사이에서도 이미 불일치하고, draft 는 세 번째 변형(`challengeToken`)을 추가하여 혼란을 심화한다; (2) `spec/1-data-model.md §2.1` User 엔티티에 `two_factor_secret`, `totp_recovery_codes` 등 기존 TOTP 컬럼조차 정의되어 있지 않아 `webauthn_recovery_codes` 추가의 기반이 흔들린다; (3) `LoginHistory.event` Enum 에 `webauthn_failed` 추가가 필요한데 spec/1-data-model.md §2.18.2 갱신이 §5 계획에서 빠져 있다. WARNING 이슈 3건(anonymous 인증 rate limit 정책, WebAuthn-only 사용자의 세션 강제 종료 재인증 방식, data-flow §2.1 스키마 매핑 누락)도 구현 전 명확히 해야 하며, 이를 해소하지 않으면 보안 결함이나 spec 불일치 상태로 구현이 진행될 수 있다. 구현 착수 전에 CRITICAL 3건 해소가 필수이며, 특히 2FA endpoint canonical 경로 확정은 기존 spec(data-flow + auth-flow) 의 동시 정정을 요구한다.

### 위험도

HIGH
