# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=codebase/backend/src/modules/auth)

---

### 발견사항

- **[CRITICAL]** 로그인 2FA 분기 — WebAuthn 우선 탐지 로직 부재
  - target 위치: `auth.service.ts` `login()` 메서드 (line 310–316), `AuthService.loginWithTotp()` (line 338–395), `LoginChallengeDto` 및 컨트롤러 `login()` 응답 형태
  - 과거 결정 출처: `spec/5-system/1-auth.md §1.4.2` + Rationale `1.4.D — 로그인 시 TOTP 자동 fallback 금지`
  - 상세:
    - spec §1.4.2는 로그인 2FA 분기를 WebAuthn credential 보유 여부로 먼저 판단하도록 명시한다. WebAuthn credential ≥ 1이면 응답은 `{ requires2fa: true, methods: ['webauthn'], challengeToken, requiresTotp: <boolean> }`이어야 한다. WebAuthn credential = 0 AND `two_factor_enabled = true`일 때만 `{ requires2fa: true, methods: ['totp'], challengeToken, requiresTotp: true }`를 반환한다.
    - 현재 `auth.service.ts`의 `login()` 은 `user.twoFactorEnabled`만 확인해 challengeToken을 발급하며(line 310), WebAuthn credential 존재 여부를 전혀 보지 않는다. 반환 타입도 `{ requiresTotp: true, challengeToken }`으로 `methods` 필드가 없어 새 응답 계약과 다르다.
    - Rationale 1.4.D는 "WebAuthn이 1개라도 등록된 사용자에게는 로그인 화면에서 TOTP 입력을 제공하지 않는다"고 명확히 기각된 대안(TOTP 자동 fallback)을 재채택하는 것을 금지한다. 현재 구현은 WebAuthn credential이 있는 사용자라도 TOTP challengeToken 응답만 내려주므로 이 기각된 설계를 그대로 사용하는 결과가 된다.
    - `LoginChallengeDto`(auth-response.dto.ts)에 `requiresTotp: boolean`과 `challengeToken`만 있고 `requires2fa`, `methods` 필드가 없다. spec §5 API 표는 `{ requires2fa, methods, challengeToken, requiresTotp? }`를 명시한다.
    - `requiresTotp`는 spec §1.4.2에서 deprecated 표시된 필드임에도 신규 DTO의 주 필드로 선언되어 있다.
  - 제안: `login()` 에서 `user.twoFactorEnabled` 확인 전에 WebAuthn credential 조회(`WebAuthnCredentialRepository` 또는 `WebAuthnService.getCredentialCount(userId)`)를 추가하고, 결과에 따라 `methods: ['webauthn']` 또는 `methods: ['totp']`를 분기한다. `LoginChallengeDto`에 `requires2fa: boolean`, `methods: string[]`, `requiresTotp?: boolean` (deprecated 표시)을 추가한다.

---

- **[CRITICAL]** `loginWithTotp()`가 WebAuthn challenge 경로에 진입 가능 — TOTP 전용 검증이 WebAuthn 사용자에게 열려 있음
  - target 위치: `auth.service.ts` `loginWithTotp()` (line 338–395), `auth.controller.ts` `loginTotp()` (line 218–231)
  - 과거 결정 출처: `spec/5-system/1-auth.md §1.4.2` + Rationale `1.4.D`
  - 상세:
    - `loginWithTotp()`는 `user.twoFactorEnabled` 여부만 확인하고(line 360), WebAuthn credential 보유 여부를 검사하지 않는다. WebAuthn credential이 등록된 사용자가 `POST /api/auth/login/totp`로 직접 호출하면 TOTP 검증이 통과되어 정식 토큰이 발급될 수 있다.
    - Rationale 1.4.D의 "WebAuthn 등록 사용자에게 로그인 화면이 TOTP 입력란을 함께 노출하지 않는다" 원칙은 API 레이어 backstop 없이 UI 레이어만으로 강제할 수 없다. 기각된 "약한 수단으로의 자동 우회" 가능성이 backend에 그대로 남아 있다.
  - 제안: `loginWithTotp()`에서 WebAuthn credential이 1개 이상 존재하는 사용자에 대해 `401 TOTP_FORBIDDEN` 또는 `WEBAUTHN_REQUIRED`를 반환하는 백스탑을 추가한다. 또는 challengeToken payload에 `method: 'totp' | 'webauthn'`을 박아 verify 단계에서 method 일치 여부를 검증한다.

---

- **[WARNING]** `LoginChallengeDto.requiresTotp`가 deprecated임에도 primary 필드로 선언
  - target 위치: `codebase/backend/src/modules/auth/dto/responses/auth-response.dto.ts` (line 12–17)
  - 과거 결정 출처: `spec/5-system/1-auth.md §1.4.2` — "requiresTotp는 기존 클라이언트 호환을 위한 deprecated 필드"
  - 상세: spec §1.4.2는 `requiresTotp`를 deprecated로 명시하고 새 클라이언트는 `requires2fa + methods`만 보도록 이행 정책을 기술한다. 현재 DTO는 `requiresTotp: boolean`을 `@ApiProperty`로 선언하되 `requires2fa`, `methods` 필드가 없다. 구현 착수 시점에 deprecated 필드만 남기고 primary 필드를 생략하면 이후 클라이언트 이행 및 DTO 제거 조건 관리가 어려워진다.
  - 제안: DTO에 `requires2fa: boolean`, `methods: ('totp' | 'webauthn')[]` 필드를 primary로 추가하고, `requiresTotp`는 `@ApiProperty({ deprecated: true })`로 마크한다. 구현 PR에서 `@deprecated` JSDoc도 함께 추가한다.

---

- **[WARNING]** WebAuthn 로그인 2FA endpoint 미구현 — 구현 착수 전 서비스 파일·컨트롤러 부재
  - target 위치: `codebase/backend/src/modules/auth/` 전체 파일 목록
  - 과거 결정 출처: `spec/5-system/1-auth.md §1.4.4`, §5 API 표 (`POST /api/auth/2fa/webauthn/authenticate/options`, `verify`, `recovery`, `GET /api/auth/2fa/webauthn/credentials`, `PATCH`, `DELETE`, `POST .../recovery-codes/regenerate`)
  - 상세: 현재 `codebase/backend/src/modules/auth/` 에는 `totp.service.ts`만 있고 WebAuthn 관련 서비스 파일(`webauthn.service.ts` 등), WebAuthn controller, entity(`webauthn_credential` 테이블 ORM)가 없다. spec §1.4.4는 등록·인증·복구 코드 fallback·credential 관리 엔드포인트를 상세히 정의하며, Rationale 1.4.A~1.4.E가 모두 WebAuthn 구현 원칙을 기록한다.
    - 이는 새 설계 도입이 아니라 미구현 상태이므로 Rationale 원칙 번복보다는 "합의된 원칙에 따른 구현이 빠진" 상황이다. 그러나 `auth.service.ts`의 2FA 분기 로직이 WebAuthn 없이 TOTP-only로 완성된 모양새라 이후 WebAuthn 추가 시 `login()` 로직의 대규모 수정이 필요하다. 착수 전에 진단해야 할 설계 결손이다.
  - 제안: 구현 plan에 WebAuthn 서비스·엔티티·컨트롤러 파일 신설을 명시하고, `auth.service.ts`의 `login()` 2FA 분기를 WebAuthn 감지 포함 형태로 먼저 리팩토링한 뒤 WebAuthn 엔드포인트를 추가하는 순서를 고정한다.

---

- **[WARNING]** counter 역행 감지 시 credential row 삭제 처리 경로 미예비
  - target 위치: `auth.service.ts` 전반 (WebAuthn verify 핸들러 부재)
  - 과거 결정 출처: `spec/5-system/1-auth.md §1.4.4` + Rationale `1.4.E — counter 역행 시 credential 강제 삭제 (vs suspend)`
  - 상세: Rationale 1.4.E는 "suspend" 대신 "즉시 삭제"를 명시적으로 채택하고, 그 이유로 "신뢰가 깨진 상태이므로 즉시 신뢰 철회"를 기술한다. spec §1.4.4는 counter 역행 시 "해당 credential row 삭제 + LoginHistory `webauthn_failed`(`WEBAUTHN_COUNTER_REGRESSION`)"를 지정한다. `WebAuthnCredential`에 `disabled_at` 같은 suspend용 컬럼을 두는 설계가 기각되었음을 착수 전 팀이 명확히 인식해야 한다. 현재 entity가 없으므로 설계 단계에서 suspend 컬럼을 도입하면 Rationale 1.4.E 위반이 된다.
  - 제안: `WebAuthnCredential` entity 설계 시 `disabled_at` 컬럼을 포함하지 않음을 entity 파일의 주석 또는 spec 참조로 명시한다. counter 역행 처리는 `deleteCredential()` 직접 호출로 구현한다.

---

- **[INFO]** 복구 코드 풀 분리 원칙 — entity 미존재로 사전 확인 필요
  - target 위치: `codebase/backend/src/modules/auth/` entity 폴더 (`entities/`)
  - 과거 결정 출처: `spec/5-system/1-auth.md §1.4.1` + Rationale `1.4.B — 복구 코드 풀 분리 (TOTP / WebAuthn 별도)`
  - 상세: Rationale 1.4.B는 "공통 풀"을 명시적으로 기각하고 `user.totp_recovery_codes`와 `user.webauthn_recovery_codes`를 별도 컬럼으로 유지함을 확정했다. 현재 `totp.service.ts`는 `user.totpRecoveryCodes`를 사용하는 반면, User entity 의 `webauthn_recovery_codes` 컬럼 및 관련 ORM 매핑이 구현 착수 전에 데이터 모델에 존재하는지 확인이 필요하다.
  - 제안: 구현 착수 전 `User` entity 파일에서 `webauthn_recovery_codes` 컬럼 존재를 확인하고, 없으면 마이그레이션과 함께 추가한다. `TotpService.disable()` 의 `totpRecoveryCodes: null` 처리가 `webauthnRecoveryCodes`를 건드리지 않음도 단위 테스트로 보호한다.

---

- **[INFO]** challengeToken payload에 `method` 필드 추가 제안 (Rationale 1.4.C 관련)
  - target 위치: `auth.service.ts` `login()` challengeToken 발급 (line 311–314)
  - 과거 결정 출처: `spec/5-system/1-auth.md` Rationale `1.4.C — WebAuthn challenge: stateless JWT`
  - 상세: Rationale 1.4.C는 challengeToken을 stateless JWT로 채택하면서 payload에 `kind`, `sub`, `challenge`, `exp`를 포함하도록 기술한다. 현재 challengeToken payload는 `{ sub, mfa_challenge: true, rememberMe }`만 담고 `kind` (method 구분) 이 없다. WebAuthn authenticate verify 단계에서 이 challengeToken을 재사용할 때 `kind` 없이 교차 사용 차단이 어렵다.
  - 제안: challengeToken 발급 시 `{ sub, mfa_challenge: true, rememberMe, method: 'totp' | 'webauthn' }`을 포함하도록 수정해, verify 핸들러에서 의도한 method인지 확인한다.

---

### 요약

Rationale 연속성 관점에서 가장 심각한 문제는 `auth.service.ts`의 `login()` 메서드가 WebAuthn credential 존재 여부를 전혀 고려하지 않아 Rationale 1.4.D("WebAuthn 등록 사용자에게 TOTP 자동 fallback 금지")와 spec §1.4.2("WebAuthn 우선, TOTP fallback 자동 금지") 원칙을 직접 위반하고 있다는 점이다. 이 원칙은 설계 단계에서 명시적으로 기각된 "약한 인증 수단으로의 자동 우회" 패턴을 현재 구현이 그대로 재현하는 구조이며, `loginWithTotp()` 백스탑 부재와 맞물려 WebAuthn 등록 사용자가 TOTP 경로로 로그인할 수 있는 보안 결손으로 이어진다. `LoginChallengeDto`의 deprecated 필드 취급 역시 합의된 이행 원칙을 따르지 않는다. WebAuthn 관련 파일 자체가 미존재하는 상태이므로 구현 착수 전에 `login()` 2FA 분기 리팩토링과 entity 설계를 Rationale 원칙에 맞춰 확정해야 한다.

### 위험도

HIGH
