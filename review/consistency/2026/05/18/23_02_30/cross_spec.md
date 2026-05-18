# Cross-Spec 일관성 검토 — 2FA WebAuthn 추가

> target: `plan/in-progress/2fa-webauthn.md`
> 검토 기준: 기존 `spec/**` 와의 직접 충돌 분석

---

## 발견사항

### 발견 1
- **[CRITICAL]** `spec/5-system/1-auth.md §1.4` — 2FA 방식이 TOTP 단일로만 기술됨
  - target 위치: `plan/in-progress/2fa-webauthn.md` §2 (spec 갱신 체크리스트 §1.4 항목 [x]) · §3.4 WebAuthn 로그인 흐름
  - 충돌 대상: `spec/5-system/1-auth.md §1.4` (현재 라이브)
  - 상세: 라이브 `spec/5-system/1-auth.md §1.4` 는 `방식: TOTP (Time-based One-Time Password)` 단 한 줄로 기술되어 있으며 WebAuthn, optionsToken, challengeToken, 우선순위 규칙, 별도 복구 코드, 환경변수(`WEBAUTHN_RP_ID/RP_NAME/ORIGIN`)에 대한 기술이 전혀 없다. 또한 §4.3 LoginHistory 이벤트 목록에도 `webauthn_failed` 가 없고, §5 API 엔드포인트 표에 WebAuthn 경로가 없다. 계획 §2 의 체크박스는 [x] 로 완료 표시되어 있으나 파일 내용과 불일치 — spec 갱신이 실제로 반영되지 않았다면 구현 코드가 spec 과 완전히 모순된다.
  - 제안: `spec/5-system/1-auth.md §1.4` 를 WebAuthn 내용(방식 확장, 우선순위 규칙, challengeToken/optionsToken, 별도 복구 코드, 환경변수)으로 갱신. §4.3 LoginHistory 이벤트에 `webauthn_failed` 추가. §5 API 표에 `/api/auth/2fa/webauthn/*` 엔드포인트 군 추가. §2.3 강제 종료 재인증 문구도 WebAuthn 케이스 포함으로 갱신.

### 발견 2
- **[CRITICAL]** `spec/1-data-model.md §2.1 User` — WebAuthn 관련 필드 3개 누락
  - target 위치: `plan/in-progress/2fa-webauthn.md` §2 (spec 갱신 [x]) · 구현 §3 마이그레이션 `V057`
  - 충돌 대상: `spec/1-data-model.md §2.1 User` (현재 라이브, 필드 목록)
  - 상세: 라이브 `spec/1-data-model.md §2.1 User` 의 필드 표는 `two_factor_enabled` 만 존재하며, `two_factor_secret`, `totp_recovery_codes`, `webauthn_recovery_codes` 세 컬럼이 없다. target 은 이 세 필드를 User 엔티티에 추가하고 SHA-256 해시 배열 semantics 를 명시하도록 요구한다. 마이그레이션 V057 은 `webauthn_recovery_codes TEXT[]` 를 `user` 테이블에 추가하는데, spec 의 User 정의와 엔티티 코드가 불일치한 상태에서 마이그레이션이 실행되면 ORM 엔티티·spec·DB 스키마 삼중 불일치가 발생한다.
  - 제안: `spec/1-data-model.md §2.1 User` 에 `two_factor_secret`, `totp_recovery_codes`, `webauthn_recovery_codes` 행 추가 및 설명 기입. `two_factor_enabled` 의 설명을 "TOTP 2FA 활성 여부 (WebAuthn credential 등록 여부와는 독립)" 으로 갱신.

### 발견 3
- **[CRITICAL]** `spec/1-data-model.md §2.18.2 LoginHistory` — `webauthn_failed` enum 누락 및 CHECK 제약명 미기재
  - target 위치: `plan/in-progress/2fa-webauthn.md` §2 (spec 갱신 [x]) · 구현 §4 (`webauthn_failed` 이벤트 추가) · 마이그레이션 V058
  - 충돌 대상: `spec/1-data-model.md §2.18.2 LoginHistory` (현재 라이브)
  - 상세: 라이브 LoginHistory 의 `event` Enum 은 `login_success / login_failed / totp_failed / logout / session_revoked / token_reuse_detected` 로 정의되며 `webauthn_failed` 가 없다. `failure_reason` 가능값에도 `WEBAUTHN_INVALID / WEBAUTHN_COUNTER_REGRESSION` 이 미기재되어 있다. CHECK 제약명 `chk_login_history_event` 가 명시되어 있지 않아 마이그레이션 V058 의 `DROP CONSTRAINT chk_login_history_event + ADD CONSTRAINT` 가 실패할 수 있다. spec 과 마이그레이션이 불일치하면 DB 상태와 spec 의 신뢰성 중 하나만 유지된다.
  - 제안: `spec/1-data-model.md §2.18.2 LoginHistory` event Enum 에 `webauthn_failed` 추가. `failure_reason` 가능값에 `WEBAUTHN_INVALID`, `WEBAUTHN_COUNTER_REGRESSION` 명시. CHECK 제약명 `chk_login_history_event` (V040 도입) 기재, V058 에서 DROP+ADD 패턴임을 각주 처리.

### 발견 4
- **[CRITICAL]** `spec/1-data-model.md §2.21` — WebAuthnCredential 엔티티 미존재, 섹션 번호 충돌
  - target 위치: `plan/in-progress/2fa-webauthn.md` §2 (spec 갱신 [x]) · `spec/1-data-model.md §2.21 WebAuthnCredential` (corpus 내 draft 버전)
  - 충돌 대상: `spec/1-data-model.md §2.21 AssistantMessage` (현재 라이브)
  - 상세: 라이브 `spec/1-data-model.md` 의 §2.21 은 `AssistantMessage` 다. target plan 의 corpus 버전은 §2.21 을 `WebAuthnCredential` 로, AssistantMessage 를 §2.22 로 시프트한다. 라이브 파일에 이 변경이 미반영이면, ERD 섹션(§1), 인덱스 표(§3), 다른 spec 의 `§2.21 AssistantMessage` 참조 링크가 모두 깨진다.
  - 제안: `spec/1-data-model.md §2.21 WebAuthnCredential` 신규 추가, AssistantMessage 를 §2.22 로 이동. §1 ERD 다이어그램에 `WebAuthnCredential (User 1:N)` 관계 반영 (plan §2 마지막 미완 항목 `[ ]`). §3 인덱스 표에 `webauthn_credential (user_id)`, `webauthn_credential (credential_id) UNIQUE` 추가.

### 발견 5
- **[CRITICAL]** `spec/2-navigation/10-auth-flow.md §3.2 / §3.4` — endpoint·token 명명 충돌 (`verify-2fa`/`tempToken` vs `login/totp`/`challengeToken`)
  - target 위치: `plan/in-progress/2fa-webauthn.md` §4 백엔드 구현 · §5 프론트엔드 구현
  - 충돌 대상: `spec/2-navigation/10-auth-flow.md §3.2 처리 플로우` (라이브: `2FA 설정됨 → 2FA 입력 화면으로 이동 (임시 토큰 포함)`), `§3.4` (라이브: `POST /api/auth/verify-2fa { tempToken, code }`)
  - 상세: 라이브 `spec/2-navigation/10-auth-flow.md` 는 §3.2 에서 2FA 응답을 "임시 토큰" 으로만 표현하고, §3.4 에서 `POST /api/auth/verify-2fa { tempToken, code }` 를 canonical endpoint 로 기술한다. target 은 `challengeToken` 과 `POST /api/auth/login/totp` 를 canonical 로 하며, `requiresTotp`/`tempToken` 는 deprecated 처리한다. 또한 §3.4 가 단일 TOTP 화면만 기술하고 WebAuthn 화면(§3.4.2) 이 없다. 구현 코드가 `login/totp` + `challengeToken` 을 쓰는데 spec 이 `verify-2fa` + `tempToken` 을 유지하면 API 계약이 두 문서에서 다르게 정의된다.
  - 제안: `spec/2-navigation/10-auth-flow.md §3.2` 를 `{ requires2fa, methods, challengeToken }` 응답 형식으로 갱신. §3.4 를 §3.4.1 TOTP / §3.4.2 WebAuthn 으로 분리. `verify-2fa` / `tempToken` 를 deprecated 표기로 처리. corpus 에 포함된 draft 버전(`auth-flow.md`)이 이를 반영하고 있으므로 라이브 파일에 해당 변경을 적용.

### 발견 6
- **[CRITICAL]** `spec/data-flow/2-auth.md §1.2` — `totpToken`/`requiresTotp` 사용, WebAuthn 분기 없음
  - target 위치: `plan/in-progress/2fa-webauthn.md` §2 (spec 갱신 [x])
  - 충돌 대상: `spec/data-flow/2-auth.md §1.2` (라이브: `Svc-->>C: 200 { requiresTotp: true, totpToken }`, `C->>Svc: POST /api/auth/login/totp { totpToken, code }`)
  - 상세: 라이브 `spec/data-flow/2-auth.md §1.2` 의 sequence 다이어그램은 `requiresTotp: true` + `totpToken` 을 응답 필드로, `totpToken` 을 TOTP verify 요청 본문 필드로 사용한다. target 은 `{ requires2fa, methods, challengeToken }` 으로 변경하고 WebAuthn credential count > 0 시 WebAuthn 분기를 삽입하며, `challengeToken` 이 `totpToken` 을 대체한다. 불일치 상태에서는 두 spec 이 서로 다른 로그인 흐름을 canonical 로 주장한다.
  - 제안: `spec/data-flow/2-auth.md §1.2` sequence 다이어그램을 WebAuthn-우선 분기(credential count > 0 → `methods=['webauthn']`, 0 + `two_factor_enabled` → `methods=['totp']`) 로 갱신. `totpToken` → `challengeToken` 으로 전면 교체. `webauthn_credential` / `webauthn_recovery_codes` 행을 §3 데이터 변경 표에 추가.

### 발견 7
- **[WARNING]** `spec/2-navigation/9-user-profile.md §2.2` — 보안 설정에 WebAuthn/Passkey 카드 기술 부재
  - target 위치: `plan/in-progress/2fa-webauthn.md` §2 (spec 갱신 [x]) · §5 프론트엔드 구현 (security 페이지 Passkey 카드)
  - 충돌 대상: `spec/2-navigation/9-user-profile.md §2.2 보안 설정` (라이브: `2FA 설정: TOTP 기반. /profile/security 페이지.`)
  - 상세: 라이브 §2.2 는 보안 설정에서 2FA 를 "TOTP 기반" 단일 방식으로 기술하며 Passkey/WebAuthn 카드, credential 목록 관리, 복구 코드 재발급 기능에 대한 UI spec 이 없다. 프론트엔드 구현(§5)은 security 페이지에 Passkey 카드를 추가하지만 spec 이 뒷받침하지 않으면 UI 명세의 단일 진실 원칙이 깨진다. 직접적 모순은 아니지만 spec 과 구현 간 기술 범위 불일치로 향후 유지보수 혼란을 야기한다.
  - 제안: `spec/2-navigation/9-user-profile.md §2.2` 에 WebAuthn/Passkey 항목(미등록 상태 등록 버튼, 등록 목록 관리, 복구 코드 발급/재발급) 추가. §6.1 API 표에 WebAuthn credential 관리 endpoint 참조 추가(canonical 은 인증 spec §5 로 위임).

### 발견 8
- **[WARNING]** `spec/5-system/1-auth.md §2.3 강제 종료 재인증` — WebAuthn 사용자 케이스 미정의
  - target 위치: `plan/in-progress/2fa-webauthn.md` §2 (spec 갱신 [x])
  - 충돌 대상: `spec/5-system/1-auth.md §2.3 세션 정책` 강제 종료 재인증 행 (현재: "비밀번호 재확인 필수. OAuth-only 사용자는 2FA TOTP 또는 이메일 OTP 로 대체")
  - 상세: 현재 spec 은 강제 종료 재인증 시 TOTP 를 대체 수단 중 하나로 열거한다. WebAuthn-only 사용자(TOTP 미활성화 + WebAuthn credential 보유)는 이 정책에서 처리 방식이 정의되지 않는다. target plan §2 의 체크박스([x])는 WebAuthn 케이스를 §2.3 에 추가하도록 명시하나 라이브 파일에 반영이 없다.
  - 제안: `spec/5-system/1-auth.md §2.3 강제 종료 재인증` 행에 "WebAuthn credential 보유 사용자는 WebAuthn 또는 복구 코드로 대체" 케이스 추가.

### 발견 9
- **[WARNING]** `spec/1-data-model.md §1 ERD 다이어그램` — `WebAuthnCredential (User 1:N)` 미반영
  - target 위치: `plan/in-progress/2fa-webauthn.md` §2 마지막 항목 `[ ]` (미완)
  - 충돌 대상: `spec/1-data-model.md §1` (라이브 ERD — `User` 하위에 `WebAuthnCredential` 없음)
  - 상세: plan 의 §2 spec 갱신 체크리스트 마지막 항목이 `[ ]` (미체크) 상태 — ERD 다이어그램 갱신이 명시적으로 미완. 라이브 ERD 와 §2.21 WebAuthnCredential 신규 엔티티 사이에 불일치가 남는다. 데이터 모델 spec 이 불완전하게 갱신되면 ERD 기반 설계 검토(consistency checker, code review)에서 WebAuthn 관계가 누락된 채 분석된다.
  - 제안: `spec/1-data-model.md §1` ERD 텍스트 다이어그램에 `User ──── WebAuthnCredential (1:N, cascade)` 관계 추가. plan §2 의 해당 항목을 완료 처리(`[x]`)해야 impl-prep 단계 진입 가능.

### 발견 10
- **[INFO]** `spec/data-flow/2-auth.md §3 데이터 변경 표` — `webauthn_credential`, `webauthn_recovery_codes` 행 없음
  - target 위치: `plan/in-progress/2fa-webauthn.md` §2 (spec 갱신 [x])
  - 충돌 대상: `spec/data-flow/2-auth.md §3 데이터 변경 표` (라이브)
  - 상세: 라이브 §3 에 `webauthn_credential` 테이블 및 `user.webauthn_recovery_codes` 컬럼이 data change 항목으로 열거되지 않는다. 기능상 충돌이라기보다 spec 동기화 미완으로, 데이터 흐름 spec 이 실제 변경 범위를 반영하지 못한다.
  - 제안: `spec/data-flow/2-auth.md §3` 에 WebAuthn credential 등록/삭제 시 변경 엔티티(webauthn_credential INSERT/DELETE, user.webauthn_recovery_codes UPDATE) 행 추가.

### 발견 11
- **[INFO]** `plan/in-progress/2fa-webauthn.md §8 Follow-up` — `requiresTotp` deprecated 제거 타임라인 미정의
  - target 위치: `plan/in-progress/2fa-webauthn.md` §4 `requiresTotp` 항목 (W-1 follow-up) · §8
  - 충돌 대상: 해당 deprecated 필드가 현재 `spec/2-navigation/10-auth-flow.md §3.2` 에 정의 없어 제거 시점 spec 정합 불확실
  - 상세: target 은 `/auth/login` 응답에 `requiresTotp` 를 backward compat 필드로 유지하고 "두 마이너 버전 후 제거" 를 §8 follow-up 으로 남겼다. 그러나 라이브 `spec/2-navigation/10-auth-flow.md` 에 `requiresTotp` 의 deprecated 표기와 제거 타임라인이 기술되지 않아 제거 시점에 spec 갱신이 누락될 가능성이 있다. 개발자가 deprecated 여부를 코드 주석 외 spec 에서 확인하지 못한다.
  - 제안: `spec/5-system/1-auth.md §5` 또는 `spec/2-navigation/10-auth-flow.md §3.2` 에 `requiresTotp` deprecated 표기 + 제거 마일스톤 명시.

---

## 요약

target 문서(`plan/in-progress/2fa-webauthn.md`)의 spec 갱신 체크리스트(§2)는 대부분 [x] 로 표시되어 있으나, 라이브 spec 파일들(`spec/5-system/1-auth.md`, `spec/1-data-model.md`, `spec/2-navigation/10-auth-flow.md`, `spec/data-flow/2-auth.md`, `spec/2-navigation/9-user-profile.md`)을 실제로 확인한 결과, WebAuthn 관련 내용이 전혀 반영되지 않은 상태다. 특히 (1) 2FA endpoint 및 token 명명(`verify-2fa`/`tempToken` → `login/totp`/`challengeToken`)이 두 spec 에서 다르게 정의되고, (2) User 엔티티 필드 3개와 LoginHistory 이벤트가 누락되어 있으며, (3) WebAuthnCredential 엔티티 자체가 데이터 모델 spec 에 존재하지 않는다. 이 상태에서 구현에 착수하면 spec 과 코드 사이의 완전한 괴리가 발생하며, `consistency-check --impl-prep` 이 PASS 될 수 없다. plan §2 의 모든 spec 갱신 작업이 라이브 파일에 실제로 적용되었는지 재확인하고, ERD 다이어그램 갱신(plan §2 미완 `[ ]`)을 완료한 뒤 impl-prep 점검을 진행해야 한다.

---

## 위험도

**CRITICAL**
