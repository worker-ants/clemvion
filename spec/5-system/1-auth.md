---
id: auth
status: partial
code:
  - codebase/backend/src/modules/auth/**/*.ts
  - codebase/backend/src/modules/auth-configs/auth-configs.service.ts
  - codebase/backend/src/modules/audit-logs/**/*.ts
  - codebase/backend/src/modules/mail/**/*.ts
  - codebase/backend/src/common/guards/*.ts
  - codebase/backend/src/common/config/webauthn.config.ts
  - codebase/frontend/src/app/(main)/invitations/accept/**
  - codebase/frontend/src/components/auth/register-form.tsx
  - codebase/frontend/src/lib/api/invitations.ts
pending_plans:
  - plan/in-progress/spec-sync-auth-gaps.md
---

# Spec: 인증/인가 시스템

> 관련 문서: [PRD 비기능 요구사항](./_product-overview.md#2-보안) · [Spec 아키텍처 개요](../0-overview.md) · [Spec 사용자 프로필](../2-navigation/9-user-profile.md) · [데이터 모델 - User](../1-data-model.md#21-user)

---

## Overview

플랫폼의 인증·인가·감사 기반을 정의한다. 본 문서는 사용자 신원(로그인·2FA·세션)과 권한(RBAC)의 단일 진실이다.

- **인증 (§1)** — 이메일/비밀번호, 2FA(TOTP · WebAuthn/Passkey), OAuth 소셜 로그인, 가입·이메일 인증 흐름.
- **세션 관리 (§2)** — access/refresh 토큰 family, 디바이스별 revoke, IP 추출 정책.
- **인가 (§3)** — 워크스페이스 스코프 RBAC 매트릭스(역할별 권한, AuthConfig reveal 권한 분리 포함).
- **감사 로그 (§4)** — `user.*` · `auth_config.*` 감사 액션과 workspace 귀속 규칙.
- **API 엔드포인트 (§5)** — 인증 관련 REST 표면. 사용자 세션/프로필·초대·AuthConfig CRUD 등 인접 엔드포인트는 각 SoT 문서를 포인터로 참조한다(중복 정의 금지).

> 인증 설정(AuthConfig, 통합 자격증명 vault) 엔드포인트의 SoT 는 [설정 spec §A.4](../2-navigation/6-config.md) 이며, 본 문서는 그 권한(RBAC §3.2)·감사(§4.1)만 다룬다.

---

## 1. 인증 (Authentication)

### 1.1 이메일/비밀번호 인증

| 항목 | 설명 |
|------|------|
| 회원가입 | 이메일 + 비밀번호. 이메일 인증 필수 |
| 비밀번호 정책 | 최소 8자, 대소문자 + 숫자 + 특수문자 중 3가지 이상 조합 |
| 비밀번호 저장 | bcrypt (cost factor ≥ 12). `user.password_hash` 는 nullable — OAuth 단독 가입 사용자는 NULL |
| 로그인 | 이메일 + 비밀번호 → JWT 발급 |
| 비밀번호 분실 | 이메일로 재설정 링크 발송 (유효기간 30분). 모든 이메일 보유 사용자에게 발급 (§1.1.A 참고) |
| 로그인 실패 | 5회 실패 시 10분 잠금, 이메일 알림 |
| 토큰 at-rest 저장 | 이메일 인증 토큰(`emailVerifyToken`)·비밀번호 재설정 토큰(`passwordResetToken`)·이메일 변경 토큰(`emailChangeToken`, §1.1.B)은 **SHA-256 해시**로만 저장한다 (raw 토큰은 메일 링크로만 전달, DB 미저장). 검증 시 입력 토큰을 동일 해시로 변환해 비교 |
| 인증 메일 재발송 | `POST /api/auth/resend-verification` — throttle 5/min, 이메일 enumeration-safe 응답 (존재 여부 무관 동일 응답). 발급되는 인증 토큰은 24h 유효 (§5 동일) |

#### 1.1.A 비밀번호 재설정 흐름과 가입 경로 (OAuth-only · WebAuthn 보유 사용자 포함)

`/auth/forgot-password` 와 `/auth/reset-password` 는 가입 경로(이메일/비밀번호·OAuth·WebAuthn 보유)에 관계없이 동일하게 동작한다. 운영 시나리오별 결과:

| 사용자 상태 | forgot-password 동작 | reset-password 동작 |
|------------|---------------------|--------------------|
| 이메일/비밀번호 가입 (일반) | 재설정 토큰 발급 + 메일 발송 | `password_hash` 갱신, 모든 refresh token revoke |
| OAuth 가입 (no password) | 동일하게 토큰 발급 + 메일 — 이메일 enumeration 차단 + opt-in "비밀번호 추가" 경로로 작동 | `password_hash` 가 NULL→신규 hash 로 채워짐. 이후부터 이메일/비밀번호 로그인 가능 |
| WebAuthn credential 보유 | 동일 | `password_hash` 만 갱신. WebAuthn credential·복구 코드는 **보존**. 다음 로그인 시 §1.4.2 에 따라 `methods=['webauthn']` 분기 (비밀번호 입력 후 WebAuthn challenge) |
| WebAuthn credential 보유 + 복구 코드 분실 + 비밀번호 분실 | 재설정 후 비밀번호로 1단계는 통과하지만 2단계 WebAuthn 을 통과 못 하면 로그인 불가 | — (운영 권고: WebAuthn 모두 삭제해 줄 수 있는 관리자 개입 경로 또는 [credential 분실 복구]) |
| 토큰 만료 (30분 경과) | 재요청 가능 | 400 VALIDATION_ERROR |
| 존재하지 않는 이메일 | 응답 동일 ("If an account exists...") — enumeration 방지 | — |

설계 원칙:

- **응답 동일성**: forgot-password 는 사용자 존재 여부·가입 경로와 무관하게 동일 응답 (`200 { data: { message } }`). 메일 발송 실패는 swallow.
- **WebAuthn 자동 무효화 없음**: 비밀번호 재설정으로 WebAuthn credential 을 disable 하지 않는다. 비밀번호는 1단계 인증일 뿐, 2단계 WebAuthn 의 신뢰 기반(개인 키)을 흔들 사건이 아니기 때문. 분실한 디바이스를 비활성화하고 싶으면 사용자가 WebAuthn 관리 화면(`/profile/security` Passkey 카드) 에서 명시적으로 credential 을 삭제한다 ((해당 사용자가 로그인할 수 있어야 가능하므로) credential 분실 + 복구 코드 분실 시는 관리자 개입).
- **refresh 토큰 전체 revoke**: 비밀번호 재설정 직후 모든 활성 세션 종료 (탈취된 비밀번호 시나리오 차단). WebAuthn credential 보유 사용자는 재로그인 시 §1.4.2 의 WebAuthn challenge 를 통과해야 한다.

#### 1.1.B 이메일 변경 흐름

로그인한 사용자가 자신의 로그인 이메일을 바꾸는 **별도 프로세스**다. `/profile` 본 화면은 readonly 표시만 하고, 변경은 전용 페이지(`/profile/change-email`)에서 (1) 재인증 → (2) 신규 이메일로 확인 메일 발송 → (3) 신규 이메일 링크 클릭으로 확정하는 3단계로 진행한다. 엔드포인트 정의는 [사용자 프로필 §6.1](../2-navigation/9-user-profile.md#61-사용자워크스페이스-api).

**핵심 설계**

- **재인증 후 신규 이메일만 인증**: 변경 시작 시 §2.3 강제 종료와 동일한 재인증(`verifyReauth` — 비밀번호, 또는 비밀번호 없는 계정은 등록된 TOTP 코드)을 요구하고, 신규 이메일로만 확인 링크를 보낸다. 기존(옛) 이메일에는 차단 없는 **보안 통지**만 발송한다. 옛 이메일을 차단 조건으로 두지 않는 이유는 Rationale 1.1.B-1.
- **이메일 OTP 배제**: 이메일 변경 재인증은 비밀번호 또는 등록 TOTP 로 한정하며 §2.3 의 "이메일 OTP" 대체 수단은 채택하지 않는다 — 변경 대상 메일함과의 순환성 때문(Rationale 1.1.B-4). WebAuthn step-up 재인증은 §2.3 세션-revoke 와 동일하게 현재 미지원이다(Rationale 1.1.B-4).
- **재인증 수단 없는 계정 차단**: `password_hash` 도 2FA 도 없는 OAuth-only 계정은 `REAUTH_NOT_AVAILABLE`(§2.3 재인증 상류 코드 재사용)로 변경 불가하다.
- **토큰 at-rest SHA-256**: 변경 확인 토큰(`emailChangeToken`)은 `emailVerifyToken`/`passwordResetToken` 과 동일하게 SHA-256 해시로만 저장하고 raw 는 메일 링크로만 전달한다(§1.1 표). 유효기간 1h(Rationale 1.1.B-3).
- **확인은 인증 필수**: 신규 이메일의 확인 토큰은 **인증된 본인 세션**에서만 소비된다(`POST /api/users/me/email-change/verify`, JWT). 토큰이 사용자에 바인딩되어 누출 링크 단독으로는 무용하다 — signup `verify-email`(`@Public`)보다 강한 가드(Rationale 1.1.B-2).
- **확인 성공 시 세션 처리**: 비밀번호 변경과 동일하게 전 family revoke + 현재 디바이스 재발급(§2.3 / Rationale 2.3.C). `login_history` 에 `session_revoked`(bulk, `familyId=null`) 1건, 감사 `user.email_changed`(§4.1) 1건이 동반된다.

**운영 시나리오**

| 사용자 상태 | request 동작 | verify 동작 |
|------------|-------------|-------------|
| 비밀번호 보유 (일반) | 비밀번호 재확인 → pending_email 저장 + 신규 이메일로 확인 메일(1h) | email = pending_email, email_verified=true + 전 세션 revoke + 현재 디바이스 재발급(`{ accessToken }`) |
| 비밀번호 없음 + TOTP 보유 | TOTP 코드 재확인 → 동일 | 동일 |
| OAuth-only + 2FA 없음 | 403 `REAUTH_NOT_AVAILABLE` — 변경 불가 (안내만) | — |
| 신규 이메일 = 현재 이메일 · 형식 오류 | 400 `VALIDATION_ERROR` | — |
| 신규 이메일이 타 계정 사용 중 | 409 `RESOURCE_CONFLICT` (register 중복과 동일 코드) | 트랜잭션 내 UNIQUE 재검사 → 선점 시 409 + pending NULL화 |
| 토큰 만료(1h 경과)·무효 | — | 400 `VALIDATION_ERROR` |

확인 완료 후 옛 이메일 통지는 best-effort(실패 swallow)이며 "본인이 아니면 비밀번호 재설정으로 보안 조치" 안내를 포함한다. pending 이 있을 때 재요청은 기존 토큰을 덮어쓴다(항상 0~1개 유효). `email-change/cancel` 은 pending 이 없어도 멱등(no-op)이다.

**메일 발송 실패 처리 (request vs resend 비대칭)**: 최초 `request` 의 확인 메일 발송이 실패하면 pending 3필드를 롤백(NULL화)하고 오류를 전파한다 — 사용자가 pending 잔존 없이 깨끗이 재시작하도록. 반면 `resend` 의 발송 실패 시에는 **갱신된 토큰을 유지**하고(롤백하지 않음) 사용자가 `resend` 재호출로 복구한다 — 이미 진행 중인 변경의 pending 을 발송 실패로 제거하면 UX 가 더 나빠지기 때문이다(Rationale 1.1.B-2 의 토큰 바인딩 전제는 불변).

### 1.2 OAuth 소셜 로그인

| 프로바이더 | 설명 |
|-----------|------|
| Google | Google OAuth 2.0 |
| GitHub | GitHub OAuth Apps |

- 소셜 로그인 시 기존 이메일 계정과 자동 연결 (이메일 일치 시)
- 최초 소셜 로그인 시 자동 회원가입 + 개인 워크스페이스 생성

### 1.3 셀프 호스팅 추가 인증 *(미구현 · Planned)*

> **상태**: 아래 두 방식은 아직 구현되지 않았다 (백엔드에 LDAP/SAML 핸들러·passport strategy·의존성 부재). 셀프 호스팅 운영자를 위한 **선택** 기능으로 계획만 확정된 상태이며, 추적은 [`plan/in-progress/spec-sync-auth-gaps.md`](../../plan/in-progress/spec-sync-auth-gaps.md).

| 방식 | 설명 |
|------|------|
| LDAP | LDAP/Active Directory 연동 (선택, **미구현**) |
| SAML 2.0 | 기업 SSO 연동 (선택, **미구현**) |

### 1.4 2FA (Two-Factor Authentication)

두 가지 방식을 지원한다. 한 사용자가 둘 다 등록할 수 있고, 등록 자체는 독립적이다.

| 방식 | 설명 |
|------|------|
| **TOTP** | Time-based One-Time Password. Google Authenticator · Authy 등 RFC 6238 클라이언트와 호환. QR 코드 스캔 → 6자리 코드 입력 → 활성화. 비활성화 시 비밀번호 재확인 + 코드 입력 |
| **WebAuthn (Passkey · 보안 키)** | FIDO2/WebAuthn 표준. `@simplewebauthn/server` + `@simplewebauthn/browser` 구현. 사용자당 다중 credential 등록 허용 (모바일 + 데스크톱 + 보안 키). 자세한 데이터 모델은 [데이터 모델 §2.21 WebAuthnCredential](../1-data-model.md#221-webauthncredential) |

#### 1.4.1 복구 코드

| 항목 | TOTP | WebAuthn |
|------|------|----------|
| 발급 시점 | TOTP 활성화 verify 성공 시점 | 첫 WebAuthn credential 등록 verify 성공 시점 |
| 개수 | 10개 (포맷 `xxxx-xxxx-xxxx`) | 10개 (동일 포맷) |
| 저장 | `user.totp_recovery_codes`: SHA-256 해시 배열, 사용 시 항목 제거 | `user.webauthn_recovery_codes`: SHA-256 해시 배열, 사용 시 항목 제거. **TOTP 와 별도 분리** |
| 폐기 | TOTP 비활성화 시 NULL | 사용자의 모든 credential 삭제 시 NULL. 사용자 명시적 "복구 코드 재발급" 도 지원 |
| 사용 화면 | 로그인 2FA 단계에서 "복구 코드 사용" 링크 → 입력 필드 | 동일 동선, 단 별도 코드 풀에서 검증 |

TOTP/WebAuthn 두 풀을 분리하는 이유는 한쪽을 비활성화해도 다른 쪽 복구가 계속 유효하도록 하기 위함이다 (Rationale 1.4.B 참고).

#### 1.4.2 로그인 시 인증 방식 선택 — **WebAuthn 우선, TOTP fallback 자동 금지**

`/auth/login` 의 비밀번호 검증을 통과한 뒤 2FA 단계를 분기한다:

| 사용자 상태 | 응답 | 로그인 2단계 화면 |
|-------------|------|------------------|
| WebAuthn credential ≥ 1 | `{ requires2fa: true, methods: ['webauthn'], challengeToken }` | WebAuthn 인증 화면. TOTP 코드 입력란은 숨김 |
| WebAuthn credential = 0 AND `two_factor_enabled = true` | `{ requires2fa: true, methods: ['totp'], challengeToken }` | TOTP 입력 화면 (기존과 동일) |
| 둘 다 없음 | `{ accessToken }` (즉시 로그인) | — |

규칙:

- **WebAuthn 이 1개라도 등록된 사용자에게는 로그인 화면에서 TOTP 입력을 제공하지 않는다.** 사용자가 TOTP 로 우회하길 원하면 보안 설정에서 WebAuthn credential 을 먼저 모두 삭제해야 한다 (Rationale 1.4.D — fallback 채널을 자동으로 노출하면 약한 인증 수단이 강한 인증 수단을 우회하는 위협이 있음).
- WebAuthn 실패 시 사용자는 동일 화면의 **"복구 코드 사용"** 링크로 WebAuthn 전용 복구 코드 입력 필드를 노출할 수 있다 (TOTP 화면으로 자동 전환되지 않음).
- 클라이언트는 `requires2fa` + `methods` 만 본다 — `requires2fa=true` 이면 challenge 단계, `methods[0]` 으로 화면을 분기.

#### 1.4.3 WebAuthn 환경변수 (옵션 기능)

WebAuthn 은 **셀프 호스팅 도메인이 SaaS 와 다르다** 는 전제 때문에 운영자가 명시적으로 env 를 설정해야 활성화되는 옵션 기능이다. 두 핵심 환경변수가 모두 설정되어 있을 때만 기능이 켜지며, 누락 시 자동 폴백하지 않는다 (운영 도메인과 어긋난 rpID 로 등록되면 이후 인증이 모두 실패해 사용자가 락아웃됨).

실제 적용은 `codebase/backend/src/common/config/webauthn.config.ts` 에서 `registerAs('webauthn', ...)` 로 등록.

| 변수 | 용도 | 예 |
|------|------|----|
| `WEBAUTHN_RP_ID` | Relying Party ID (호스트명, 포트·스킴 없음) | `clemvion.example.com` |
| `WEBAUTHN_RP_NAME` | 사용자 다이얼로그에 표시될 이름 (선택, 기본 `Clemvion`) | `Clemvion` |
| `WEBAUTHN_ORIGIN` | 콤마 구분 허용 origin 목록. 같은 RP 의 multi-origin 지원 | `https://clemvion.example.com,https://app.clemvion.example.com` |
| `WEBAUTHN_ALLOW_FALLBACK` | (선택) `1` 설정 시 `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` 미설정 상태에서도 `FRONTEND_URL` 로 폴백해 기능을 켠다. **개발·로컬·시연 한정**, 운영 사용 금지 | `0` (default) |

**활성/비활성 시 동작**

| 상태 | 조건 | 동작 |
|------|------|------|
| 활성 (enabled=true) | 두 환경변수 모두 설정 **또는** `WEBAUTHN_ALLOW_FALLBACK=1` | 모든 WebAuthn 엔드포인트 정상 동작. `/auth/login` 응답이 §1.4.2 표에 따라 `methods=['webauthn']` 분기 가능 |
| 비활성 (enabled=false) | 환경변수 미설정 + 폴백 미허용 | 부팅은 정상 (warn 로그). WebAuthn 엔드포인트는 모두 `503 WEBAUTHN_DISABLED` 반환. `/auth/login` 은 credential 보유와 무관하게 `webauthnCount=0` 으로 취급 → `methods=['totp']` 또는 즉시 로그인. 프론트엔드는 `GET /auth/2fa/webauthn/availability` 응답에 따라 Passkey UI 를 숨긴다 |

**`/auth/2fa/webauthn/availability`** — Public GET. 응답(논리 payload) `{ enabled: boolean }` — 전역 `TransformInterceptor` 가 wire 에서 `{ "data": { "enabled": … } }` 로 래핑하므로 클라이언트는 `res.data.enabled` 로 읽는다 ([API 규약 §5](./2-api-convention.md#5-응답-형식)). §5 엔드포인트 표(`{ enabled: boolean }`)와 동일 — 본 문서는 논리 payload 표기로 통일한다. 인증 불요. 프론트엔드가 보안 페이지 진입 시 호출해 Passkey 카드 노출 여부를 결정한다.

운영자가 미설정 상태에서 사용자가 이미 WebAuthn credential 을 보유 중인 경우: DB row 는 보존되며 운영자가 env 를 다시 설정하면 그대로 재사용 가능하다. 비활성 동안 사용자는 TOTP 또는 일반 로그인으로 진입하므로 락아웃되지 않는다 (Rationale 1.4.F).

#### 1.4.4 WebAuthn 흐름

**등록** (`/profile/security` 의 "Passkey 등록"):

```
1. POST /api/auth/2fa/webauthn/register/options          (JWT 인증 필수)
   → 서버: generateRegistrationOptions + optionsToken JWT 발급 (kind=webauthn_register, 5분)
2. 클라이언트: navigator.credentials.create(options)
3. POST /api/auth/2fa/webauthn/register/verify { optionsToken, response }
   → 서버: verifyRegistrationResponse → webauthn_credential row INSERT
   → 첫 등록이면 webauthn_recovery_codes 10개 발급 + 평문 응답 (일회성 표시)
```

**인증** (로그인 2FA 단계):

```
1. POST /api/auth/2fa/webauthn/authenticate/options { challengeToken }
   → 서버: challengeToken (mfa_challenge JWT) 검증 → generateAuthenticationOptions + optionsToken (kind=webauthn_auth, 5분)
2. 클라이언트: navigator.credentials.get(options)
3. POST /api/auth/2fa/webauthn/authenticate/verify { challengeToken, optionsToken, response }
   → verifyAuthenticationResponse → counter 갱신
   → JWT access + refresh cookie 발급
```

**복구 코드 fallback**:

```
POST /api/auth/2fa/webauthn/recovery { challengeToken, code }
→ webauthn_recovery_codes 해시 비교 → 일치 시 row 에서 항목 제거 + JWT 발급
```

counter 역행이 감지되면 `verifyAuthenticationResponse` 가 reject 한다. 서비스 코드는 해당 credential row 를 즉시 삭제 (suspend 컬럼 없음 — Rationale 1.4.E) 하고 **해당 사용자의 활성 refresh token 전체를 즉시 revoke** 한다 — 클론 공격자가 기존 access/refresh 로 계속 접근하는 위협을 차단. LoginHistory 에 `webauthn_failed`(`failure_reason='WEBAUTHN_COUNTER_REGRESSION'`) 를 함께 기록한다.

**동시성 보호** — `verifyAuthentication` 의 credential 조회·검증·counter 갱신·역행 시 삭제·refresh revoke 는 **단일 트랜잭션** 안에서 처리되며, credential row 는 `SELECT ... FOR UPDATE` 로 pessimistic lock 한다. 두 동시 요청이 같은 assertion 으로 들어와도 한쪽은 lock 대기 → 첫 요청이 counter 를 갱신한 뒤 두 번째 요청은 갱신된 counter 를 읽으므로 `@simplewebauthn/server` 가 `counter <= stored` 로 reject. LoginHistory 기록은 트랜잭션 *밖* 에서 호출해 audit 자체가 보안 핵심 경로(credential 삭제 + token revoke commit) 를 막지 않도록 한다.

### 1.5 초대 토큰 흐름

팀 워크스페이스 Admin+ 가 **미가입자** 를 이메일로 초대하기 위한 토큰 기반 흐름. 가입 사용자 즉시 추가는 별도 API (`POST /api/workspaces/:id/members`) 를 사용한다 — 본 섹션은 미가입자 시나리오만 다룬다.

#### 1.5.1 토큰 정책

| 항목 | 값 | 비고 |
|------|-----|------|
| 토큰 생성 | `crypto.randomBytes(48)` → base64url (64자) | 추측 불가 |
| 저장 형태 | DB 에는 토큰 자체를 저장 (`WorkspaceInvitation.token`, UNIQUE) | URL 조회 시 즉시 lookup |
| 만료 | 발급 시점 + **7일** | 산업 표준. 만료 시 410 응답 |
| 사용 횟수 | **1회** — accept 트랜잭션에서 `acceptedAt` 갱신 시 동시에 사용 처리 | 동시 accept 경쟁은 `UPDATE … WHERE accepted_at IS NULL RETURNING …` 로 직렬화 |
| 재발송 | 기존 토큰 invalidate(만료 처리) + 신규 토큰 발급 + 만료 시계 재시작 | 한 초대 row 는 항상 0~1개의 유효 토큰만 보유 |
| 동일 이메일 중복 초대 | 새 발송이 들어오면 기존 대기 중 토큰 invalidate 후 신규 발급 | 다중 토큰이 동시에 살아있지 않도록 |
| **이메일 일치 강제** | accept·가입 시 `토큰.email == 로그인/가입 사용자 이메일` 강제. 불일치 시 400 | 토큰 누출 시 임의 사용자가 임의 워크스페이스에 진입하는 위협 차단 |
| 발송 채널 | 시스템 SMTP (`codebase/backend/src/modules/mail/`) 만 사용. 워크스페이스 SMTP Integration 은 **사용하지 않음** | 운영 단순화. 자세한 근거는 [Rationale §1.5.B](#rationale) |
| Rate Limit | 분당 10건 (`INVITATION_THROTTLE`, `workspaces.controller.ts` — invite·resend 엔드포인트 공통) | 이메일 폭격 방지. [data-flow §1.2](../data-flow/12-workspace.md) 와 동일 값 |

#### 1.5.2 흐름 (미가입자 가입 경로)

```
1. Admin+ 가 POST /api/workspaces/:id/invitations { email, role }
   → 토큰 생성, expiresAt = NOW() + 7d, 이메일 발송
2. 수신자가 메일의 링크 클릭 → 프론트엔드 가입 페이지 `/auth/register?invitationToken={token}`
3. 프론트엔드: GET /api/invitations/:token 로 메타 prefetch
   → 응답: { workspaceName, invitedByName, email, expiresAt, role }
   → 이메일 입력란을 prefill + readOnly 로 고정
4. 사용자가 비밀번호·이름 입력 후 가입 제출
   → POST /api/auth/register { name, password, invitationToken }
   → 서버 검증:
     a. 토큰 유효성 (존재·미만료·미사용)
     b. 토큰의 email 과 가입 요청 본문에 동봉된 email (또는 토큰에서 유도) 일치
     c. 일치 → User 생성 + WorkspaceMember 추가 + invitation.acceptedAt 갱신
        세 작업은 단일 트랜잭션 내에서 처리 (실패 시 전체 롤백)
     d. 불일치/만료 → 400 + 가입 자체 거부 (User row 생성 안 함)
5. 가입 성공 → 자동 로그인 → 초대된 워크스페이스로 컨텍스트 진입
   ※ 6.1 의 "개인 워크스페이스 자동 생성" 트리거는 **발화하지 않음**
```

#### 1.5.3 흐름 (이미 가입한 사용자가 다른 워크스페이스에 초대된 경우)

```
1. 메일 링크 클릭 → 프론트엔드가 토큰 메타 조회
2. 로그인되어 있고 본인 이메일과 토큰 이메일이 일치 → 수락 페이지에 [수락] 버튼 노출
3. POST /api/workspaces/invitations/accept { token }
   → 서버 검증: 토큰 유효 + 본인 이메일 = 토큰 이메일
   → WorkspaceMember 추가 + acceptedAt 갱신 (단일 트랜잭션)
4. 응답 후 프론트엔드가 해당 워크스페이스로 컨텍스트 전환
```

토큰 이메일과 로그인 사용자의 이메일이 다르면 수락 페이지에서 "이 초대는 {토큰.email} 에게 발송되었습니다. 해당 계정으로 로그인하세요" 안내 + 로그아웃 버튼만 노출한다.

> **경로·진입**: 수락 페이지는 `/invitations/accept?token=<초대토큰>` (쿼리 파라미터 `token`). 초대 메일 링크는 `/auth/register?invitationToken=` 를 가리키므로, **이미 로그인한 사용자**가 이 링크로 진입하면 register 페이지가 로그인 상태를 감지해 위 수락 페이지로 리다이렉트한다 (register 폼은 미가입자 가입 경로). 미로그인 사용자는 §1.5.2 가입 경로를 따른다.

#### 1.5.4 에러 응답

| 상황 | HTTP | 코드 |
|------|------|------|
| 토큰 없음·잘못된 형식 | 404 | `invitation_not_found` |
| 만료 | 410 | `invitation_expired` |
| 이미 사용됨 | 410 | `invitation_already_used` |
| 이메일 불일치 (accept 또는 register) | 400 | `invitation_email_mismatch` |
| 권한 부족 (발송·재발송·취소) | 403 | `forbidden` |
| Rate limit 초과 | 429 | `rate_limited` |

> **명명 — historical-artifact 예외**: 위 코드들은 [`node-output.md` Principle 3.2](../conventions/node-output.md#32-outputerror-표준-형태)·[`error-codes.md §1`](../conventions/error-codes.md#1-의미-기반-명명-핵심-원칙)의 `UPPER_SNAKE_CASE` 규약과 달리 `lower_snake_case` 다. v1 출하 시 이 형태로 정착했고 프론트엔드([`invitations.ts`](../../codebase/frontend/src/lib/api/invitations.ts) `INVITATION_ERROR_CODES`)가 `code` 값으로 직접 분기하므로, rename 은 API breaking change 가 된다([`error-codes.md §2`](../conventions/error-codes.md#2-안정성--rename-정책) "이름 정확성 향상만을 위한 rename 은 하지 않는다"). 따라서 [`error-codes.md §3` historical-artifact 레지스트리](../conventions/error-codes.md#3-historical-artifact-예외-레지스트리)에 등재해 유지한다 — 신규 코드는 본 예외를 선례로 삼지 않고 처음부터 `UPPER_SNAKE_CASE` 를 쓴다. 특히 `forbidden`·`rate_limited` 는 일반 명칭이라 다른 도메인에서는 `FORBIDDEN`·`RATE_LIMITED`(UPPER) 를 쓰며, 본 lowercase 표기는 **초대 흐름 전용** 한정 예외다(`error-codes.md §3` 의 "초대 API 한정" 명시와 일치).

---

## 2. 세션 관리

### 2.1 JWT 토큰 구조

| 토큰 | 저장 위치 | 유효 기간 | 용도 |
|------|-----------|-----------|------|
| Access Token | 메모리 (JS 변수) | 15분 | API 요청 인증 |
| Refresh Token | HttpOnly · Secure Cookie (`SameSite` 는 §2.3, Path `/api/auth`) | 7일 | Access Token 갱신 |

> **`JWT_SECRET` production fail-closed (refactor 04 C-1)**: Access Token 은 `JWT_SECRET` 으로
> 서명된다. `NODE_ENV=production` 에서 `JWT_SECRET` 가 미설정/기본 sentinel/예시값/32자 미만이면
> 부팅을 거부한다 (`main.ts` 의 `assertProductionConfig`; `ENCRYPTION_KEY`·`MCP_ALLOW_INSECURE_URL`
> 과 단일 가드 블록). 설계 근거·응집 이유는 §Rationale "Production fail-closed 가드" 참조.
> dev/test/e2e(`NODE_ENV≠production`)는 dev fallback 을 허용해 영향 없다.

### 2.2 Access Token Payload

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "activeWorkspaceId": "workspace-uuid",
  "role": "editor",
  "iat": 1711406400,
  "exp": 1711407300
}
```

> **활성 워크스페이스 클레임 = `activeWorkspaceId`** — **결정 완료·구현 착수 전(Planned)**. 필드명을 현재 `workspaceId` 에서 `activeWorkspaceId` 로 rename 하기로 결정했다(`spec-sync-data-flow-12-workspace-gaps` 결정2 = B, 2026-07-07; 권장안 A(유지)와 다른 사용자 명시 선택). 위 예시는 착수 대상(target) payload 다 — 종전 코드는 `workspaceId` 를 서명한다. 구현 시 전환기 dual-read 로 read site 는 `activeWorkspaceId ?? workspaceId` 로 legacy 토큰을 함께 수용하고, write(서명)는 `activeWorkspaceId` 만 발행한다 (rollover window = access token TTL 15분). 활성 워크스페이스 전환은 `POST /api/auth/workspaces/:id/switch`(§5) 로 이 클레임을 재발급한다 — 토큰이 활성 워크스페이스의 단일 진실이며 `X-Workspace-Id` 헤더는 fallback. 상세: [data-flow §1.5](../data-flow/12-workspace.md#15-워크스페이스-전환-토큰-재발급).

### 2.3 세션 정책

| 항목 | 설명 |
|------|------|
| 세션 단위 | `family_id` — refresh 회전 시 row가 갱신되더라도 동일 family는 하나의 "디바이스 세션" |
| 동시 세션 | 기본 5개 (관리자 설정 가능) |
| 초과 시 | 가장 오래된 세션 자동 종료 |
| 비활동 만료 | 30일간 미사용 시 Refresh Token 무효화 |
| 강제 종료 | 사용자가 활성 세션 목록에서 개별 종료 가능 (family 전체 revoke) |
| 강제 종료 재인증 | 비밀번호 재확인 필수. OAuth-only 사용자는 등록된 2FA (TOTP 또는 WebAuthn) 또는 이메일 OTP 로 대체. 두 방식 모두 등록한 사용자는 §1.4.2 의 우선순위(WebAuthn 우선) 를 따른다 |
| 비밀번호 변경 시 처리 | 비밀번호 변경(`POST /users/me/change-password`) 성공 시 사용자의 **모든 활성 family 를 revoke** 하고 변경을 수행한 **현재 디바이스에 새 세션(access token + refresh 쿠키 회전)을 즉시 재발급**한다 — 탈취 가능한 모든 refresh token(현재 family 포함)을 변경 시점에 무효화하면서 변경한 본인은 재로그인 없이 계속 사용한다. `login_history` 에 `session_revoked`(bulk, `familyId=null`) 1건 기록. 재발급 세션은 표준 7일(`rememberMe=false`) — 현재 family 미식별으로 직전 세션의 remember-me 상태는 승계하지 않는다 — Rationale 2.3.C |
| 이메일 변경 시 처리 | 이메일 변경 확인(`POST /users/me/email-change/verify`, §1.1.B) 성공 시 **비밀번호 변경과 동일**하게 전 family revoke + 현재 디바이스 재발급한다. verify 가 `/api/users/me/*` 라 refresh 쿠키(Path `/api/auth`)가 미첨부되어 현재 family 를 식별할 수 없으므로 전체 revoke + 재발급으로 수렴한다(비밀번호 변경과 동형, Rationale 2.3.C 공유). `login_history` 에 `session_revoked`(bulk, `familyId=null`) 1건 — enum 값 재사용이라 DB CHECK·마이그레이션 불요 |
| 현재 세션 식별 | 서버가 요청의 refresh-token 쿠키 해시를 조회해 `isCurrent` 플래그로 응답 — raw token은 JS로 노출하지 않음 |
| 메타데이터 | 발급 시점의 IP·User-Agent·디바이스 라벨 및 마지막 사용 시각을 RefreshToken 에 기록 |
| 클라이언트 IP | `CF-Connecting-IP` 는 **`TRUST_CF_CONNECTING_IP=true` 일 때만 1순위** (기본 off — 위변조 가능 헤더). off 면 `X-Forwarded-For` 첫 IP → `req.ip`(trust proxy) → `req.socket.remoteAddress` 순. **이 `req.ip`/`socket` 폴백을 포함한 4단계 순서는 세션·감사 IP 경로(`extractClientIp(req)`)에 한정**된다. **webhook/rate-limit/`ip_whitelist` 경로는 헤더 기반(CF-gated → XFF 첫 IP)만 적용하며 `req.ip`/`socket` 폴백이 없다**(`extractClientIpFromHeaders` 직접 호출) — CF Tunnel 에서 `req.ip` 가 실제 클라이언트가 아니어서 의도적으로 기각(Rationale 2.3.B). 헤더 미식별 시 공개 webhook rate-limit 은 거부가 아니라 **단일 공유 버킷 완화 한도**를 적용한다(`ip_whitelist` 는 반대로 fail-closed — Rationale 2.3.B). Cloudflare(Tunnel 포함) 뒤 배포만 활성화 — Rationale 2.3.B |
| Refresh 쿠키 Domain | `FRONTEND_URL`·`APP_URL` hostname 에서 자동 유도 (`common/config/app.config.ts` `computeCookieDomain`): 같은 host·localhost·IP → Domain 미지정 (backend origin 한정) · 공통 상위 도메인 보유 (예: `api.x.com`/`app.x.com`) → `.x.com` · 공통 도메인 없음 → 미지정 (cross-origin 은 `withCredentials` 의존). 별도 env 없음 — Rationale 2.3.A |
| Refresh 쿠키 SameSite | `COOKIE_SAMESITE` env — 기본 `none` (프론트와 API 가 사이트 경계(eTLD+1)를 달리하는 cross-site 배포 지원; `lax`/`strict` 면 쿠키 미첨부 → 세션 끊김). 동일 사이트 배포는 `lax`(또는 `strict`)로 하드닝. 미인식 값은 `none` fallback — Rationale 2.3.B |
| Refresh 쿠키 Path | `/api/auth` 로 한정 (refresh·login·logout 등 auth 엔드포인트 외에는 쿠키 미첨부 — 표면 축소). `set`/`clear` 가 동일 Path 사용 필수 |
| `/auth/refresh` CSRF | `SameSite=none` 모드에서 cross-site 강제 refresh 를 막기 위해 요청 `Origin` 을 CORS allowlist(`isOriginAllowed`)와 대조 — allowlist 외·불투명(`'null'`) Origin 은 `403`. Origin 부재(same-origin·non-browser)는 통과. 다른 엔드포인트는 Bearer access token 기반이라 쿠키 CSRF 면역 — Rationale 2.3.B |

### 2.4 토큰 갱신 플로우

```
1. Access Token 만료 감지 (API 401 응답)
2. Refresh Token으로 /api/auth/refresh 호출
3. 새 Access Token + 새 Refresh Token 발급 (Rotation)
4. 이전 Refresh Token 즉시 무효화
5. 무효화된 Refresh Token 사용 시도 → 모든 세션 종료 (탈취 의심)
```

---

## 3. 인가 (Authorization)

### 3.1 RBAC 역할

| 역할 | 설명 |
|------|------|
| **Owner** | 워크스페이스 소유자. 모든 권한 + 워크스페이스 삭제 |
| **Admin** | 관리자. 멤버 관리 + 설정 변경 + 모든 리소스 CRUD |
| **Editor** | 편집자. 워크플로우/트리거/스케줄 CRUD + 실행 |
| **Viewer** | 조회자. 읽기 전용 |

### 3.2 리소스별 권한 매트릭스

| 리소스 | Owner | Admin | Editor | Viewer |
|--------|-------|-------|--------|--------|
| Workspace 설정 | CRUD | RU | R | R |
| Workspace 삭제 | D | — | — | — |
| 멤버 관리 | CRUD | CRU | R | R |
| Admin 역할 부여 | ✅ | — | — | — |
| Workflow | CRUD | CRUD | CRUD | R |
| Workflow 실행 | ✅ | ✅ | ✅ | — |
| Trigger | CRUD | CRUD | CRUD | R |
| Schedule | CRUD | CRUD | CRUD | R |
| Integration (Org) | CRUD | CRUD | R | R |
| Integration (Personal) | 자기 것 | 자기 것 | 자기 것 | 자기 것 |
| Knowledge Base | CRUD | CRUD | CRUD | R |
| Auth Config | CRUD | CRUD | R | R |
| Auth Config Reveal (평문 노출) | ✅ | ✅ | — | — |
| Model Config | CRUD | CRUD | CRUD | R |
| Statistics | R | R | R | R |
| System Status ※ | R | R | R | R |
| Marketplace 설치 | ✅ | ✅ | ✅ | — |
| Audit Log | R | R | — | — |

> ※ **System Status**: 큐 적체 집계만 노출하는 시스템 전역 읽기 API(`/api/system-status/overview`)로, 워크스페이스 경계를 갖지 않는다. 개별 job·payload·워크스페이스 식별자를 노출하지 않으므로 모든 역할이 동일하게 읽기만 가능하다 (별도 admin 가드 없음). 상세는 [System Status API §4 보안](./16-system-status-api.md#4-보안).

### 3.3 API 인가 흐름

```
1. 요청 수신 → Access Token 검증
2. Token에서 활성 워크스페이스(target: `activeWorkspaceId`; 종전 `workspaceId`), role 추출 — 착수 대상 계약에서는 `jwt.strategy` 가 클레임의 멤버십을 검증해 활성값을 확정한다(부재·비멤버 시 personal fallback). **결정 완료·구현 착수 전**이며, 종전 구현은 매 요청 personal workspace 로 재해석한다 (§2.2 · [data-flow §1.5](../data-flow/12-workspace.md#15-워크스페이스-전환-토큰-재발급))
3. 요청 리소스가 해당 워크스페이스에 속하는지 확인
4. 역할이 해당 액션에 대한 권한을 가지는지 확인
5. 권한 없음 → 403 Forbidden
```

> **Model Config Editor CRUD 근거**: Model Config(`/api/model-configs`)는 AI 모델 설정(provider/모델/파라미터)이라 워크플로우 구축의 일부로 Editor 가 직접 관리한다 (코드 `@Roles('editor')` 와 일치). 반면 Auth Config 는 외부 인증 자격증명이라 Editor=R 로 좁힌다 — 두 리소스의 민감도 차이를 반영한 의도적 권한 분리다.
>
> **Auth Config Reveal 권한 분리 근거**: Auth Config 의 `R` (Editor/Viewer) 은 **마스킹된 응답 조회** (`***<last4>`, [Spec 데이터 모델 §2.17.2](../1-data-model.md#2172-마스킹노출-정책)) 를 포함한다. 자격증명의 존재·식별에는 마스킹으로 충분하며 평문 유출 위험이 없다. 평문을 보는 **Reveal** (`POST /api/auth-configs/:id/reveal`) 은 별도 액션으로 분리해 Admin+ 로 제한한다 — 평문 reveal 은 현재 로그인 비밀번호 재확인 + audit 기록이 필요한 민감 동작이므로 권한을 좁힌다.

---

## 4. 감사 로그 (Audit Log)

### 4.1 기록 대상 액션

**Action naming·시제 규약**: `<resource>.<verb>` 구조(resource dot-prefix 필수)와 verb 시제 3분류(과거분사 기본 / CRUD 현재형 예외 / 도메인 고유 동사)는 [`conventions/audit-actions.md`](../conventions/audit-actions.md) 가 SoT 다 — 본 §4.1 은 그 규약을 따르는 **액션 카탈로그**(구현됨/Planned 목록)·workspace 귀속·읽기측 계약을 소유한다. 구현 action 의 단일 SoT 는 [`audit-action.const.ts`](../../codebase/backend/src/modules/audit-logs/audit-action.const.ts) 의 `AUDIT_ACTIONS` union 이며, `AuditLogsService.record({ action })` 가 타입으로 강제한다 (인라인 문자열 금지).

**현재 구현된 액션**:

| 카테고리 | action |
|----------|------|
| Integration | `integration.created`, `integration.updated`, `integration.deleted`, `integration.rotated`, `integration.scope_changed`, `integration.reauthorized` |
| 워크스페이스 | `workspace.transfer_ownership` |
| 실행 (재실행) | `execution.re_run` |
| 설정 | `auth_config.create`, `auth_config.update`, `auth_config.delete`, `auth_config.regenerate`, `auth_config.reveal` |
| 인증 (워크스페이스 컨텍스트) | `user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled`, `user.email_changed`(이메일 변경 확인 `POST /users/me/email-change/verify`, §1.1.B — **details 에 raw 이메일 미저장**, Rationale 1.1.B-6) — 액터의 현재 세션 `workspaceId` 에 귀속, controller 경계 기록 (`users.controller`·`auth.controller`·`webauthn.controller`). 상세 [data-flow §1.1](../data-flow/1-audit.md) + §Rationale 4.1.B |

> **읽기측 계약 — `action` 은 닫힌 enum 이 아니다.** 쓰기측은 위 `AUDIT_ACTIONS` union 으로 타입 강제되지만, `AuditLog.action` 자체는 **DB 자유 문자열 컬럼**이다 (application 레벨 union 으로만 좁히고 DB CHECK 는 두지 않는다 — 액션 추가가 잦아 마이그레이션 비용을 피하기 위함, [data-flow §1.1](../data-flow/1-audit.md)). audit 불변 원칙상 과거 row 에는 현재 union 밖의 **레거시 값이 존재할 수 있다** (예: cross-audit G-02 이전 `execution.re_run` 의 구 표기 `re_run_initiated` — 신규 row 부터 정정됐고 기존 row 는 그대로 보존). 따라서 조회 API 응답(`AuditLogDto.action`)의 소비자는 `action` 을 닫힌 enum 으로 단정하지 말고 union 밖 값을 graceful 하게 처리한다 (`AuditLogDto.action` 의 OpenAPI 설명도 동일 계약을 명시).

**Planned (미구현 — 목표 커버리지)**: 아래 액션은 spec 이 기록 의도를 선언했으나 아직 코드가 `AuditLogsService.record` 를 호출하지 않는다. 현황은 [data-flow 감사 로그 §1.1](../data-flow/1-audit.md) 이 추적한다. 구현 시 `AUDIT_ACTIONS` 에 추가한다.

| 카테고리 | Planned action |
|----------|------|
| 워크스페이스 | `workspace.created`, `workspace.updated`, `workspace.deleted` — **결정 완료·구현 착수 전**(`spec-sync-data-flow-12-workspace-gaps` 결정4 = B, 2026-07-07): 구현 시 `workspaces.service` 가 기록 |
| 멤버 | `member.invited`, `member.role_changed`, `member.removed` — **결정 완료·구현 착수 전**(결정4 = B): 구현 시 `workspaces.service`·`workspace-invitations.service` 가 기록 |
| 워크플로우 | `workflow.created`, `workflow.updated`, `workflow.deleted`, `workflow.executed` |
| 트리거 | `trigger.created`, `trigger.updated`, `trigger.deleted` |
| 스케줄 | `schedule.created`, `schedule.updated`, `schedule.deleted` |
| 설정 | `model_config.*` (create/update/delete/set_default — **현재형 유지**: `set_default` 가 과거분사로 부자연스러워 auth_config 처럼 resource 단위 현재형으로 통일. reveal 미제공 — ModelConfig 는 평문 reveal 엔드포인트 없음) |

> **감사 액션 통합 (model_config)** — *목표 설계*. 설정 CRUD 감사 로깅 자체는 현재 미구현이다 (`model_config.service.ts` 는 `AuditLogsService` 를 호출하지 않는다 — [data-flow §1.1 커버리지 갭](../data-flow/1-audit.md) 이 ground truth). 구현 시 신규 이벤트는 `model_config.*` (create/update/delete/set_default) 로 기록한다. 통합 이전 `llm_config.*`/`rerank_config.*` 로 적재된 row 가 있다면 append-only 로 보존되며 재작성하지 않으므로, 감사 조회는 두 액션 집합(`model_config.*` OR `llm_config.*`/`rerank_config.*`)을 OR 로 결합해 질의한다.

> 워크스페이스 컨텍스트가 없는 인증 이벤트(login, logout, login_failed 등)는 AuditLog 가 아닌 §4.3 **LoginHistory** 에 기록된다.

> **`user.*` 액션의 workspace 귀속 (refactor 04 후속)**: `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 의 "워크스페이스 컨텍스트" 는 **액터의 현재 세션 `workspaceId`**(인증 요청 JWT 의 workspace) 다. 이 세 액션은 모두 **인증된 세션**에서만 발생하므로(`POST /users/me/change-password`, TOTP `verifyAndEnable`/`disable`, WebAuthn 등록/삭제) 항상 세션 workspace 가 있어 `audit_log.workspaceId`(non-nullable)를 그대로 충족한다 — schema 변경 불요. `resourceType: 'user'`, `resourceId: <userId>`. **무인증 password-reset**(`POST /auth/reset-password`, 토큰 기반·세션 없음)은 workspace 컨텍스트가 없어 `user.password_changed` 감사 대상이 **아니다**(위 LoginHistory 분류 원칙 적용) — reset 완료를 별도로 남길지는 `login_history` event enum(§4.3 / [데이터 모델 §2.18.2](../1-data-model.md)) 신설을 동반하는 **별개 결정**으로, 본 결정 범위 밖이다. 설계 근거·기각 대안은 §Rationale 4.1.B.

### 4.2 조회

- 관리자(Admin+)만 조회 가능
- 기간, 사용자, 액션 유형으로 필터링
- 보존 정책 **미정** — 현재는 정리 배치 없이 무제한 보관 ([Data Flow 감사 로그 §3 보존 정책](../data-flow/1-audit.md#3-보존-정책) 과 일치). "최근 90일 보관 (설정 가능)" 은 **계획(Planned)** 이며 미구현 (§4.3 LoginHistory 의 180일 일일 배치와 대조)

### 4.3 로그인 이력 (LoginHistory)

사용자 단위 인증 이벤트는 별도 테이블 `login_history` 에 보관한다 (데이터 모델 §2.18.2). 사용자가 본인의 이력만 조회할 수 있다.

| 이벤트 | 설명 |
|--------|------|
| login_success | 비밀번호 또는 OAuth 로그인 성공 |
| login_failed | 비밀번호 불일치·계정 잠금·이메일 미인증 등 실패 |
| totp_failed | 2FA TOTP 코드 검증 실패 |
| webauthn_failed | 2FA WebAuthn 검증 실패. `failure_reason` 으로 `WEBAUTHN_INVALID`·`WEBAUTHN_COUNTER_REGRESSION` 등 세부 구분 |
| logout | 사용자가 `/auth/logout` 호출 → 호출 디바이스 family 전체 revoke |
| session_revoked | 사용자가 활성 세션 목록에서 다른 family 강제 종료, 또는 **비밀번호 변경·이메일 변경(§1.1.B) confirm 성공 시 전체 family revoke**(bulk, `familyId=null`). enum 값(`session_revoked`)은 기존 그대로 재사용 — DB CHECK 제약·마이그레이션 불요 |
| token_reuse_detected | revoke된 refresh token 재사용 감지 → family 전체 revoke |

보존: **180일** 경과 row 는 일일 배치(BullMQ repeatable scheduler, `0 3 * * *` Asia/Seoul)로 자동 삭제. 조회는 사용자 본인만 가능하며 워크스페이스 관리자에게는 노출되지 않는다.

---

## 5. API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/auth/register | 회원가입. **인증 불요** (`@Public`) — 토큰·메일 발급 후 `verify-email` 로 활성화 ([§1.5.2 흐름](#152-흐름-미가입자-가입-경로)) |
| POST | /api/auth/verify-email | 이메일 인증 토큰 검증 → 개인 워크스페이스 생성 + access/refresh 즉시 발급. **인증 불요** (`@Public`). 토큰 무효·만료 시 400 |
| POST | /api/auth/resend-verification | 인증 메일 재발송 (24h 유효). **인증 불요** (`@Public`), throttle 5/min. 이메일 enumeration-safe (존재·인증 여부 무관 동일 응답) |
| POST | /api/auth/check-email | 회원가입 전 이메일 사용 가능 여부 확인. **인증 불요** (`@Public`), throttle 5/min |
| POST | /api/auth/login | 로그인 (비밀번호 검증 — 2FA 활성 사용자는 `{ requires2fa, methods, challengeToken }` 응답) |
| POST | /api/auth/login/totp | 로그인 2FA TOTP 검증 (`challengeToken` + 6자리 code 또는 복구 코드). 성공 시 access/refresh 발급 |
| POST | /api/auth/2fa/setup | TOTP 설정 시작 (인증 필수) — secret 발급 + QR data URL 반환 |
| POST | /api/auth/2fa/verify | TOTP 활성화 verify (인증 필수) — 활성화 + TOTP 복구 코드 10개 일회성 반환 |
| POST | /api/auth/2fa/disable | TOTP 비활성 (인증 + 비밀번호 재확인) |
| GET | /api/auth/2fa/webauthn/availability | WebAuthn 기능 활성 여부 조회. **인증 불요** (`@Public`). 응답: `{ enabled: boolean }`. 프론트엔드가 Passkey UI 노출 여부 결정용. spec §1.4.3 |
| POST | /api/auth/2fa/webauthn/register/options | WebAuthn 등록 options 발급. **인증 필수** (JWT). 응답에 `optionsToken` JWT (`kind=webauthn_register`, exp 5분) 동봉. 기능 비활성 시 503 `WEBAUTHN_DISABLED` |
| POST | /api/auth/2fa/webauthn/register/verify | WebAuthn 등록 verify. **인증 필수** (JWT). credential 저장 + 첫 등록 시 복구 코드 10개 평문 반환 (이후 SHA-256 해시만 보관). 실패: 400 `WEBAUTHN_VERIFY_FAILED`, optionsToken 무효 시 400 `INVALID_OPTIONS_TOKEN` |
| POST | /api/auth/2fa/webauthn/authenticate/options | WebAuthn 로그인 2FA options. **인증 불요** (`@Public`) — 본문의 `challengeToken` (mfa_challenge JWT) 으로 userId 식별. 응답에 `optionsToken` JWT (`kind=webauthn_auth`). 검증 실패: 401 `CHALLENGE_INVALID` |
| POST | /api/auth/2fa/webauthn/authenticate/verify | WebAuthn 로그인 2FA verify. **인증 불요** (`@Public`) — `challengeToken` + `optionsToken` 동시 검증. 성공 시 access/refresh 발급. 실패: 401 `WEBAUTHN_INVALID`, counter 역행 시 401 + 해당 credential row 삭제 + LoginHistory `webauthn_failed`(`WEBAUTHN_COUNTER_REGRESSION`) |
| POST | /api/auth/2fa/webauthn/recovery | WebAuthn 복구 코드로 2FA 통과. **인증 불요** (`@Public`) — `challengeToken` + `code`. 실패: 401 `RECOVERY_CODE_INVALID` |
| GET | /api/auth/2fa/webauthn/credentials | 사용자의 WebAuthn credential 목록. **인증 필수** (JWT). 응답: `{ data: { items: [{ id, deviceName, transports, lastUsedAt, createdAt }] } }` — 비-페이징 고정 컬렉션([api-convention §5.2](./2-api-convention.md#52-목록-응답)). publicKey·counter 미노출 |
| PATCH | /api/auth/2fa/webauthn/credentials/:id | credential `device_name` 수정. **인증 필수** (JWT). `:id` 는 UUID. 200 + 갱신된 row. 본인 소유 아니면 404 (enumeration 방지) |
| DELETE | /api/auth/2fa/webauthn/credentials/:id | credential 삭제. **인증 필수** (JWT). **마지막 credential 삭제 시 `user.webauthn_recovery_codes` 를 `WebAuthnService.deleteCredential` 가 NULL 화** (DB 트리거 아님). 204 |
| POST | /api/auth/2fa/webauthn/recovery-codes/regenerate | WebAuthn 복구 코드 재발급. **인증 필수** (JWT) + 본문에 `password` 재확인. 기존 미사용 코드 폐기 후 10개 새로 발급. TOTP 의 `/api/auth/2fa/disable` 과 대칭적인 네임스페이스 (TOTP 측 복구 코드 재발급은 현재 미지원 — 비활성→재활성으로 재발급) |
| POST | /api/auth/logout | 로그아웃 (호출 디바이스 family 전체 revoke) |
| POST | /api/auth/refresh | 토큰 갱신 |
| POST | /api/auth/workspaces/:id/switch | 워크스페이스 전환 — 대상 멤버십 검증(비멤버 `403 NOT_A_MEMBER`) 후 access token 을 `activeWorkspaceId=:id` 로 재발급 + refresh rotate. `JwtAuthGuard`. **결정 완료·구현 착수 전(Planned)** — `spec-sync-data-flow-12-workspace-gaps` 결정1. 상세 [data-flow §1.5](../data-flow/12-workspace.md#15-워크스페이스-전환-토큰-재발급) |
| POST | /api/auth/forgot-password | 비밀번호 재설정 요청 |
| POST | /api/auth/reset-password | 비밀번호 재설정 |
| GET | /api/auth/oauth/providers | 백엔드에 자격증명이 설정된 활성 OAuth provider 목록. **인증 불요** (`@Public`), `Cache-Control: private, max-age=300`. 비어 있으면 클라이언트가 SSO UI 미노출 |
| GET | /api/auth/oauth/:provider | OAuth 시작 |
| GET | /api/auth/oauth/:provider/callback | OAuth 콜백 |
| GET | /api/audit-logs | 감사 로그 조회 (Admin+) |
| GET | /api/invitations/:token | 초대 토큰 메타 조회 (인증 불요, 가입 페이지 prefill). 만료·invalidated 토큰은 410 |

사용자 본인 세션·이력 관리 엔드포인트는 [사용자 프로필 spec §6.1](../2-navigation/9-user-profile.md#61-사용자워크스페이스-api) 에 정의 (`/api/users/me/sessions`, `/api/users/me/login-history`).

사용자 본인 이메일 변경 엔드포인트(`/api/users/me/email-change/request`·`/verify`·`/resend`·`/cancel`)도 [사용자 프로필 spec §6.1](../2-navigation/9-user-profile.md#61-사용자워크스페이스-api) 에 정의된다. 흐름·토큰 라이프사이클·재인증·세션·감사는 본 문서 §1.1.B 가 소유한다.

초대 발송·재발송·취소·수락 엔드포인트는 [사용자 프로필 spec §6.1](../2-navigation/9-user-profile.md#61-사용자워크스페이스-api) 에 정의 (`/api/workspaces/:id/invitations`, `/api/workspaces/invitations/accept`).

인증 설정(AuthConfig) CRUD 엔드포인트(`/api/auth-configs/*` — 평문 노출 `POST /api/auth-configs/:id/reveal` 포함)는 [설정 spec §A.4](../2-navigation/6-config.md) 의 표가 단일 SoT 다. 본 문서는 그 권한·감사만 다룬다 — RBAC 매트릭스 §3.2, 감사 액션 §4.1(`auth_config.*`), reveal 권한 분리 근거는 §3.2 하단 주석 참조.

`POST /api/auth/register` 는 본문에 `invitationToken?` 을 받아 [§1.5.2 흐름](#152-흐름-미가입자-가입-경로) 의 트랜잭션을 수행한다.

---

## Rationale

### 1.1.B-1 — 이메일 변경: "둘 다 인증" 기각, "재인증 + 신규만 인증 + 옛 통지" 채택
옛 이메일을 *차단 조건*(링크 클릭 강제)으로 두면 옛 메일함 접근을 잃은 사용자 — 이메일 변경의 주된 사유(퇴사로 회사 메일 상실·메일 서비스 종료) — 가 영구히 변경 불가가 된다. 옛 이메일의 두 역할(통제 증명 / 알림 채널) 중 "통제 증명"은 §2.3 재인증(비밀번호·2FA)이 메일함 소유보다 강하게 대체하므로, 옛 이메일은 비차단 **통지**(알림 채널)로만 둔다. 결과적으로 "둘 다 인증"보다 본인 증명이 강하면서 UX·복구성이 낫다. 기각: (a) 옛+신규 둘 다 링크 확인 — 위 lockout 문제, (b) 재인증 없이 신규만 확인 — 세션 탈취만으로 식별자 교체가 가능해짐.

### 1.1.B-2 — 확인(verify)을 `@Public` 이 아니라 인증 필수로
signup `verify-email` 은 계정 활성화(아직 세션 없음)라 `@Public` 이다. 이메일 *변경* 은 이미 로그인된 계정의 식별자 교체라, 확인 토큰을 인증 사용자에 바인딩하면 누출된 링크 단독으로는 변경이 불가능하다(공격자가 그 사용자로 로그인돼 있어야 함) — signup 보다 강한 가드다. 비용은 다른 기기에서 링크 클릭 시 로그인 1스텝(아직 옛 이메일로)뿐이다. 기각: `@Public` verify(누구나 클릭 시 즉시 커밋) — 링크 누출 시 제3자가 피해자 이메일을 바꿀 위협.

### 1.1.B-3 — 변경 토큰 TTL 1h
signup 인증 24h(가입 직후 여유)와 비밀번호 재설정 30분(탈취 시나리오·짧게) 사이. 로그인 상태에서 능동 수행하는 in-flow 동작이라 짧게 두되, 신규 메일함 확인 여유로 1h 로 정한다.

### 1.1.B-4 — 이메일 변경 재인증은 이메일 OTP 를 배제 (§2.3 세션-revoke 재인증과 차등)
§2.3 강제 종료 재인증은 OAuth-only 대안으로 "이메일 OTP" 를 언급하지만, 이메일 *변경* 흐름에서는 변경 대상 메일함의 소유 자체가 증명 대상이라 이메일 OTP 가 본인 증명으로 순환·부적합하다(공격자가 지정한 새 메일함의 OTP 로 통과하는 모순). 따라서 이메일 변경 재인증은 비밀번호 또는 TOTP 로 좁히고 이메일 OTP 를 채택하지 않는다 — 구현은 세션 강제 종료와 동일한 `SessionsService.verifyReauth`(password OR TOTP) 를 재사용한다. WebAuthn 을 재인증 수단으로 쓰는 것은 challenge/response step-up 흐름이 필요해 `verifyReauth` 가 현재 미지원이며(§2.3 세션-revoke 와 동일 한계), 그 일반화는 `plan/complete/refactor-auth-reverify-unify.md` 영역이다. WebAuthn 만 등록한(비밀번호·TOTP 없는) 계정은 password/TOTP 설정 후 이메일을 변경할 수 있다. §2.3 의 세션-revoke 재인증 정의 자체는 본 작업에서 변경하지 않는다.

### 1.1.B-5 — OAuth-only · 재인증 수단 없는 계정은 변경 차단
`password_hash` 도 2FA 도 없는 OAuth-only 계정은 재인증 수단이 없어 `REAUTH_NOT_AVAILABLE` 로 이메일 변경을 차단한다(self-service 불가, 안내만). 세션 탈취만으로 로그인 식별자를 교체해 계정을 탈취하는 위협을 차단하기 위함이다. 기존 OAuth provider 링크는 provider account id 기준이라 이메일 변경과 독립적이다(구현 시 확인). 강제 2FA·계정 복구 흐름은 §4.1.B 의 "OAuth-only 마지막 2FA 비활성화" 와 동일하게 별개 결정 사안이다.

### 1.1.B-6 — `user.email_changed` 감사 details 에 raw 이메일 미저장
`user.email_changed` 는 액터 세션 workspace 의 admin 이 조회 가능하다(§4.2). 변경 전/후 주소를 details 에 넣으면 필요 이상으로 PII 가 노출되므로, "변경 발생" 사실과 `ipAddress`(포렌식)만 기록하고 raw 이메일 값은 details 에 담지 않는다. 액션 분류는 §4.1.A 및 [`audit-actions.md`](../conventions/audit-actions.md) 의 확정 규약(`user.*` 네임스페이스·과거분사)을 그대로 따른다.

### 1.5.A — 가입 시 이메일 일치 강제

토큰 이메일 ≠ 가입/로그인 사용자 이메일인 경우, 가입·accept 를 모두 차단한다 (이메일 일치 강제). 이유:

- 토큰은 (긴 random 이지만) URL·메일 경유로 유출 가능. 일치 검증이 없으면 누출 토큰 단독으로 워크스페이스 진입이 가능해 권한 escalate 위협이 큼.
- 가입 페이지에서 이메일을 prefill + readOnly 로 고정하면 정상 사용자에게는 UX 마찰이 거의 없음 (이메일을 "고를" 필요가 사라짐).
- 다른 이메일로 가입하고 싶은 경우는 일반 회원가입 경로(`/auth/register`, `invitationToken` 없음) 를 따로 거치게 되므로 안내가 단순함.

### 1.5.B — 초대 메일 SMTP: 시스템 전역 사용

`codebase/backend/src/modules/mail/` 는 현재 시스템 전역 SMTP 만 지원한다. 워크스페이스 단위 SMTP Integration 을 초대 메일에도 사용할지 검토했지만, 다음 이유로 시스템 SMTP 만 사용한다:

- 초대는 "워크스페이스에 진입하기 전" 단계의 시스템 인입 행위에 가깝다. 워크스페이스의 비즈니스 SMTP 가 끊겨도 초대 흐름은 계속 동작해야 함.
- 워크스페이스 SMTP Integration 은 워크스페이스 내부 워크플로의 알림·메일 발송 용도로 설계되었으며, 초대 같은 시스템 메시지를 그쪽으로 흘리면 책임 경계가 흐려진다.
- 운영·디버깅이 단일 채널로 단순해진다 — 초대 메일 누락 원인을 추적할 때 시스템 SMTP 로그만 보면 됨.

### 1.5.C — 토큰 만료 7일

7일은 산업 표준이면서, "주말 끼고 가입" 같은 사용자 행동도 충분히 흡수한다. 더 짧으면 (예: 24~48시간) 재발송이 잦아져 운영 부담이 늘고, 더 길면 (14일+) 토큰 누출 시 노출 기간이 길어진다. 재발송 시 만료 시계는 새 토큰 발급 시점부터 다시 7일이므로, 특수 케이스는 재발송으로 해결한다.

### 1.4.A — WebAuthn 라이브러리: `@simplewebauthn/server` + `@simplewebauthn/browser`

`@simplewebauthn/*` 는 서버·브라우저 양쪽 모듈을 같은 메인테이너가 관리한다. FIDO2 L3 / WebAuthn spec 추적이 빠르고, registration·authentication 의 `generate`·`verify` 페어가 대칭이라 코드가 단순하며 Node 18+ 에서 ESM/CJS 모두 동작한다.

`@simplewebauthn/server` 가 다음 두 항목을 무료로 제공한다: (a) attestation/assertion 의 origin·rpID·challenge 일관성 검증, (b) counter 역행 감지. 본 spec 의 보안 요구를 라이브러리가 그대로 만족한다.

### 1.4.B — 복구 코드 풀 분리 (TOTP / WebAuthn 별도)

`user.totp_recovery_codes` 와 `user.webauthn_recovery_codes` 두 컬럼으로 풀을 분리한다. 이유:

- 사용자가 한쪽 방식만 비활성화·재설정해도 다른 쪽 복구가 유지되어야 한다. 공통 풀이면 TOTP 비활성화 시점에 WebAuthn 복구도 함께 폐기되어야 할지 결정이 모호해진다.
- "WebAuthn 만 사용" 사용자에게도 TOTP 활성화 없이 복구 수단을 제공해야 한다. 공통 풀 가설은 "TOTP 가 항상 켜져 있다" 라는 가정에 의존한다.
- 추가 컬럼 한 개의 비용은 미미 (NULL 일 때 PostgreSQL 은 추가 공간 거의 사용 안 함).

### 1.4.C — WebAuthn challenge: stateless JWT (별도 테이블 없음)

challenge 는 stateless JWT (`optionsToken`, payload `{ kind, sub, challenge, exp(5분) }`) 로 발급한다. 채택 이유:

- WebAuthn spec 의 challenge unique·fresh 요건은 challenge 자체가 random 이고 verify 시 클라이언트 응답과 일치 확인하면 만족된다. 서버 측 DB 의 단명 row 가 unique 강제에 필수는 아님.
- replay 방어: JWT 만료 5분 + `kind` 검증으로 의도 다른 흐름(`register`↔`auth`) 교차 사용 차단.
- 운영 부담 감소: 단명 row 의 cleanup 배치·인덱스 부재.
- 트레이드오프: 같은 5분 윈도우 안에서 동일 JWT 의 두 번째 verify 가 시도되면, `@simplewebauthn/server` 의 verify 는 challenge·response 짝의 cryptographic uniqueness 로 거부한다 (credential 의 counter 증가가 한 번만 발생). 즉 JWT 단독 reuse 만으로 인증을 통과할 수 없음.

### 1.4.E — counter 역행 시 credential 강제 삭제 (vs suspend)

WebAuthn 인증기의 sign counter 가 역행하면 (저장값 ≥ 신규값) `@simplewebauthn/server` 의 `verifyAuthenticationResponse` 는 reject 한다. 본 spec 은 reject 시 **해당 row 를 즉시 삭제** 하고 `failure_reason=WEBAUTHN_COUNTER_REGRESSION` 으로 LoginHistory 에 기록한다 (사용자가 같은 인증기를 다시 쓰려면 `/profile/security` 에서 재등록). suspend(`disabled_at` 컬럼 + 명시적 재활성화) 대신 삭제를 선택한 이유:

- counter 역행은 (a) 인증기 복제·클론 공격 (b) 인증기 firmware 오류 두 가지로 좁혀진다. 둘 다 신뢰가 깨진 상태이므로 즉시 신뢰 철회가 원칙.
- suspend 는 사용자에게 "재활성화" 선택지를 주는데, 이는 클론 공격자가 본인을 사칭해 재활성화 버튼을 눌러도 동일한 효과 — 보안 이득이 작다.
- 운영 단순화: 추가 컬럼·UI 흐름·테스트 케이스가 줄어든다. 재등록 비용이 사용자에게 미미.

### 1.4.D — 로그인 시 TOTP 자동 fallback 금지

WebAuthn 등록 사용자에게 로그인 화면이 TOTP 입력란을 함께 노출하지 않는다. 이유:

- 보안: WebAuthn 은 phishing-resistant, TOTP 는 사용자가 코드를 입력하는 시점에 phishing 에 취약. 사용자가 강한 인증 수단을 등록했는데 약한 수단으로 자동 우회 가능하면 등록한 의미가 약해진다.
- 사용자가 의도적으로 TOTP 로 전환하길 원하면 보안 설정에서 WebAuthn credential 을 모두 삭제 (혹은 webauthn 복구 코드 사용) 한 뒤 재로그인 가능. 의식적인 다운그레이드만 허용한다.
- 분실 시 잠김 위협은 별도 복구 코드 (§1.4.1) 로 완화. 복구 코드 분실까지 가정한 계정 복구는 본 spec 범위 밖 (관리자 개입 경로).

### 1.4.F — WebAuthn 환경변수 미설정 시 기능 비활성

`WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` 미설정 + `WEBAUTHN_ALLOW_FALLBACK!=1` 이면 부팅을 거부하지 않고 `enabled=false` 로 둔다 — WebAuthn 엔드포인트만 503 을 반환하고 나머지는 정상 동작한다. 운영자가 WebAuthn 을 사용할 의향이 없거나 아직 도메인이 정해지지 않은 셀프 호스팅 단계에서 앱 전체가 죽으면 안 되기 때문이다. 채택 이유:

- WebAuthn 은 **부가 인증 수단**이지 인증의 핵심 경로가 아니다. 부재 시 일반 로그인 + TOTP 가 정상 동작해야 한다.
- 운영자가 모든 env 를 한 번에 설정하지 않는 셀프 호스팅 점진 도입 시나리오를 차단하지 말아야 한다.
- 잘못된 폴백(localhost 등) 으로 등록·인증 데이터가 누적되면 향후 도메인 결정 시점에 모두 무효화되므로, 자동 폴백보다는 명시적 활성화가 안전.
- 사용자 락아웃 우려: WebAuthn-only 사용자가 env 비활성 시점에 접근 불가가 되는 가능성은 있으나, 운영자가 WebAuthn 을 한 번이라도 활성화했다면 env 를 그대로 두는 게 정상 운영. 운영자 실수로 env 가 꺼지면 사용자는 webauthn 복구 코드 → TOTP 등록 우회 경로가 없고 관리자 개입 필요. 본 케이스는 §1.4.D 와 같은 운영 권고 사항 (env 변경 전 사용자 공지).
- 폴백이 필요한 dev/local/시연 한정으로는 `WEBAUTHN_ALLOW_FALLBACK=1` escape hatch 를 유지한다.

### 1.4.G — V058 마이그레이션을 NOT VALID + VALIDATE 2-step 으로 분리하지 않은 이유

V058 (`chk_login_history_event` CHECK 제약에 `webauthn_failed` 추가) 는 `DROP/ADD CONSTRAINT` 단일 statement 로 작성됐다. `codebase/backend/migrations/README.md §1` 의 기본 컨벤션은 NOT VALID + VALIDATE 2-step 이지만, 본 건은 다음 모든 조건이 충족돼 단일 statement 가 안전하다고 판단:

1. **append-only 테이블** — `login_history` 는 INSERT 만 발생 (UPDATE/DELETE 없음 — 보존 기간 정기 배치만 DELETE). long-running write 트랜잭션이 ACCESS EXCLUSIVE 와 경합할 가능성이 낮다.
2. **enum 확장 시나리오** — 신규 enum 값 (`webauthn_failed`) 은 기존 row 에 존재하지 않으므로 NOT VALID 의 "기존 row 검증 스킵" 이 주는 이득이 없다 (어차피 전체 검증 시 0건 위배).
3. **테이블 크기가 아직 작음** — `login_history` 는 락 영향이 무시 가능한 규모. 다만 장기적으로 성장하면 다음과 같은 사후 검토를 권장:
   - 1M row 도달 시: 다음 CHECK 변경부터 의무적으로 NOT VALID + VALIDATE 분리
   - 보존 기간 (180일) 정책이 효과적으로 동작하는지 스케줄 job 모니터링 (`login-history-pruner` 큐)

이미 적용된 제약을 NOT VALID 로 재선언하는 것은 의미 불명이고 (제약명 동일 시 `ERROR: relation already exists`), DROP → NOT VALID ADD → VALIDATE 3-step 우회는 단일 statement 보다 더 긴 락 윈도우(총 3개 ACCESS EXCLUSIVE 락)를 만든다. 미래의 동일 패턴 변경에 대해서는 위 조건 점검 후 분기하며, `login_history` 같은 append-only 테이블도 1M row 이후에는 NOT VALID 2-step 의무화를 권장한다.

### 1.4.H — WebAuthn 도메인 모듈 분리

WebAuthn 관련 entity·service·DTO·controller·tests 는 `codebase/backend/src/modules/auth/webauthn/` 서브폴더에 위치하고 `WebAuthnModule` 로 묶인다. AuthModule 은 WebAuthnModule 을 import 해 WebAuthnService 를 주입받는다 — 단방향 의존성 (`AuthModule → WebAuthnModule`).

| 위치 | 분류 |
|--------|------|
| `auth/webauthn/webauthn.service.ts` | service |
| `auth/webauthn/entities/webauthn-credential.entity.ts` | entity |
| `auth/webauthn/dto/webauthn.dto.ts` | request DTO |
| `auth/webauthn/dto/responses/webauthn-response.dto.ts` | response DTO |
| `auth/webauthn/webauthn.module.ts` | NestJS module |
| `auth/webauthn/webauthn.controller.ts` | HTTP controller — `/auth/2fa/webauthn/...` |

AuthService 는 `webauthnCredentialRepository` 직접 주입 대신 `WebAuthnService.countCredentials()` 를 사용한다. `countCredentials()` 가 기능 비활성(§1.4.3) 시 0 을 반환하므로 AuthService 는 enabled 분기 로직을 보유할 필요 없음.

LoginHistoryService 는 AuthModule 과 WebAuthnModule 양쪽에 provider 로 둔다 — 두 인스턴스가 같은 DB 테이블에 INSERT 만 하므로 동작 동등. LoginHistoryModule 로의 추가 분리는 별 follow-up.

**컨트롤러 host 위치 — AuthModule** — `WebAuthnController` 파일은 `webauthn/` 폴더에 두지만 **module 등록은 AuthModule 의 `controllers` 배열**에 한다. `WebAuthnController` 가 challenge 토큰 소비·MFA 후 토큰 발급에 `AuthService` 를 사용해야 하는데, 만약 controller 를 `WebAuthnModule` 에 등록하면 `WebAuthnModule → AuthModule` 의존성이 생겨 단방향 원칙이 깨진다. 의존 그래프를 한 방향으로 유지하기 위해 controller host 는 AuthModule, service/entity/DTO 만 WebAuthnModule.

`setRefreshTokenCookie` / `clearRefreshTokenCookie` 는 두 controller 모두 사용하므로 `auth/utils/refresh-cookie.ts` 의 모듈 단위 함수로 추출 — controller 인스턴스의 private 메서드가 아닌 stateless helper.

**채택 이유**

- AuthModule 비대화 — login·register·OAuth·session·TOTP 외에 WebAuthn 까지 한 곳에 있어 응집도 낮음. 도메인 모듈 + 컨트롤러 분리로 도메인 경계 명시.
- 단방향 의존성으로 순환 위험 차단. AuthService 는 WebAuthnService 를 알지만 역방향 의존성 없음.

### 1.4.I — `requiresTotp` deprecated 필드 제거 종결

`/auth/login` 의 2FA challenge 응답에는 `requiresTotp?: boolean` 필드가 존재하지 않는다 (backend `LoginChallengeDto` · `AuthService.login()` · frontend `TwoFactorChallengeResponse` 모두). 클라이언트는 `requires2fa` + `methods` 만으로 분기한다 (`lib/api/auth.ts` 의 `TwoFactorChallengeResponse` / `isTwoFactorChallenge()`).

**이유**

- 같은 의미를 두 필드로 중복 표현하는 비용 — Swagger 문서·클라이언트 타입·DTO·테스트 mock 모두에서 노이즈 발생.
- "두 필드 충돌 시 `requires2fa` 우선" 같은 정합성 규칙을 유지보수해야 하는 부담 제거.

### 1.4.J — TOTP 라이브러리: `otplib` v13

TOTP 발급·검증은 `otplib` (v13 라인) 을 사용한다 (`totp.service.ts`). secret 은 base32(RFC 6238) 이며 라이브러리 교체와 무관하게 호환된다.

**v12 → v13 업그레이드 근거 (refactor 07-dependency m-9)**

- v12 라인은 2021 이후 릴리스가 멈춘 stale 버전 — TOTP 라는 보안 크리티컬 경로에서 향후 CVE 패치 라인 부재 리스크. v13 은 현행 활성 라인(audited `@noble/hashes`·`@scure/base` 플러그인 기반).
- v13 은 complete rewrite (ESM-only, `authenticator` preset 제거 → functional API). 단 `verifySync`/`generateSync` 가 기본 crypto 플러그인에서 동작해 **서비스 메서드는 동기 유지**(호출자 async 전파 불필요).
- **기존 secret 호환성 보존**: v12·v13 모두 RFC 6238 준수 — v12 시절 발급된 base32 secret 은 v13 검증과 동일하게 동작한다 (RFC 6238 Appendix B 벡터 cross-version 단위 테스트로 보장). 따라서 기존 사용자 2FA 락아웃 없음.
- v12 `window:1` 허용 오차는 v13 `epochTolerance: 30`(±1 time step) 으로 등가 유지.

### 1.4.K — 복구 코드 해시: SHA-256 (KDF 미채택)

복구 코드(TOTP·WebAuthn 양쪽)는 **SHA-256** 단순 해시로 저장한다 (§1.4 표). 비밀번호용 KDF(argon2id·bcrypt·scrypt)는 채택하지 않는다.

**근거**

- 복구 코드는 `randomBytes(9)`(72비트) 기반의 **고엔트로피 일회성** 시크릿이다. KDF 의 느린-해시·솔트는 **저엔트로피 사용자 비밀번호**의 사전·brute-force 공격을 늦추기 위한 것으로, 고엔트로피 랜덤 값에는 실익이 없다 — 2^50+ 탐색 공간은 GPU 로도 비현실적이라 SHA-256 으로 충분하다 (OWASP 복구 코드 가이드와 정합).
- KDF 전환 시 코드별 솔트 → 로그인 검증이 배열 `indexOf` 매칭에서 **순차 KDF compare 반복**으로 바뀌어 (최대 10개 × 느린 해시) 복구 로그인 지연이 커지고, TOTP·WebAuthn 두 풀을 대칭으로 변경해야 한다 — 한계 이득 대비 비용 과대.
- KDF 전환 방향을 검토했으나, 위 엔트로피 분석에 따라 **현행 SHA-256 유지**가 정설이다.

### 2.3.A — Refresh 쿠키 Domain 자동 유도 (명시 env 없음)

Refresh 쿠키의 `Domain` 속성은 운영자 env 가 아니라 `FRONTEND_URL`/`APP_URL` 의 hostname 에서 공통 상위 도메인을 자동 유도한다 (§2.3 표, `common/config/app.config.ts` `computeCookieDomain`). 서브도메인 분리 배포(`api.x.com` / `app.x.com`)에서 별도 설정 없이 인증이 동작하고, 잘못된 명시 Domain 설정으로 쿠키가 전달되지 않는 운영 사고를 줄이기 위함이다. localhost·IP·공통 상위 도메인 부재 시에는 Domain 을 지정하지 않아 backend origin 한정으로 좁힌다 — 전혀 다른 도메인 간에는 쿠키 공유 자체가 불가능하므로 클라이언트의 `withCredentials` cross-origin 요청에 의존한다.

### 2.3.B — Refresh 쿠키 SameSite·CSRF 와 클라이언트 IP 신뢰 (refactor 04 M-5·m-3)

**SameSite (M-5).** Refresh 쿠키의 `SameSite` 는 `COOKIE_SAMESITE` env 로 분리하며 기본 `none` 이다. 본 제품은 프론트와 API 가 사이트 경계(eTLD+1)를 달리하는 cross-site 배포를 지원하는데, 이 토폴로지에서는 `lax`/`strict` 면 refresh 쿠키가 cross-site 요청에 첨부되지 않아 세션이 끊긴다. 따라서 무중단 기본값은 `none` 이고, 동일 사이트 배포만 `lax`(또는 `strict`)로 하드닝한다. (web-chat 위젯 등 임베드는 Bearer EIA 토큰을 쓰고 refresh 쿠키에 의존하지 않으므로 None 요구의 주체가 아니다.) **기각된 대안**: "기본 `Lax` + cross-site 배포만 `none` opt-in" 원안 — cross-site(eTLD+1 분리) 배포가 실사용 중임이 확인되어, `Lax` 기본은 그 배포에서 첫 refresh 부터 세션이 끊긴다. 무중단을 우선해 `none` 기본을 채택하고 CSRF 는 Origin 검증으로 보완했다.

**`none` 모드의 CSRF 보완 (M-5).** `SameSite=none` 은 cross-site 요청에 쿠키를 자동 첨부하므로 `/auth/refresh` 에 강제 refresh CSRF 가 성립할 수 있다. 다만 (a) refresh 쿠키는 `/auth/refresh` 한 곳에서만 쓰이고 다른 엔드포인트는 모두 Bearer access token 기반이라 쿠키 CSRF 면역이며, (b) credentials CORS allowlist 가 cross-site 출처의 **응답 읽기**를 이미 차단한다. 따라서 CSRF 토큰 인프라(double-submit 등)를 신설하는 대신, `/auth/refresh` 가 요청 `Origin` 을 기존 CORS allowlist(`isOriginAllowed`)와 대조해 allowlist 외·불투명(`'null'`, sandbox iframe 등) Origin 을 `403` 으로 선차단하는 defense-in-depth 를 둔다. Origin 부재(same-origin·non-browser 도구)는 통과한다 — 프론트 변경·토큰 발급 인프라가 불필요하다. cookie `Path` 를 `/api/auth` 로 한정해 쿠키 첨부 표면도 축소한다(`set`/`clear` 동일 Path 필수).

**클라이언트 IP 신뢰 (m-3).** `CF-Connecting-IP` 는 클라이언트가 임의로 보낼 수 있는 헤더라, Cloudflare 뒤가 아닌 배포에서 무조건 신뢰하면 rate-limit 우회·`ip_whitelist` 우회·감사로그 IP 오염이 가능하다. 따라서 `TRUST_CF_CONNECTING_IP=true`(정확히 `true`/`1`)로 명시한 배포에서만 1순위로 사용하고, 기본(off)에서는 무시하고 `X-Forwarded-For`/`req.ip` 로 폴백한다(fail-safe). Cloudflare(Tunnel 포함) 뒤에서는 `X-Forwarded-For` 첫 IP 도 동일한 실제 클라이언트 IP 이므로 off 폴백이 안전하다. 본 신뢰 플래그는 IP 를 읽는 세 경로(세션·감사 IP `auth/utils/client-ip` 의 `extractClientIp` — req.ip/socket 폴백 포함; 공개 webhook rate-limit·`ip_whitelist` 검증의 `extractClientIpFromHeaders` — 헤더 기반·폴백 없음)에 일관 적용한다. origin 직접 접근 차단(인프라/터널) 전제는 유지하되, 강제 IP allowlist 는 터널 배포에 불필요해 권고에서 제외한다. **`ip_whitelist`/rate-limit 의 IP 추출이 헤더 기반(CF-gated → XFF 첫 IP)인 것은 의도된 결정**이다 — `req.ip`(Express `trust proxy 1`) 를 우선/대체로 쓰자는 안은 **기각**한다: CF Tunnel 배포에서는 `req.ip` 가 cloudflared/CF edge 주소라 실제 클라이언트가 아니어서 `ip_whitelist` 를 오히려 깨뜨린다. XFF 헤더 위변조 방어는 위 원칙대로 인프라/`trust proxy` 경계의 책임이며, 코드 리뷰가 "`req.ip` 폴백 부재" 를 지적하더라도 본 항이 정한 의도된 설계다. 같은 이유로 공개 webhook rate-limit 의 **IP 미식별(헤더 부재) 케이스도 `req.socket.remoteAddress` 폴백을 쓰지 않는다**(trust-proxy 뒤 socket 피어가 프록시 주소라 전 트래픽이 단일 버킷으로 붕괴 → 정상 사용자 false 429) — 대신 미식별 요청을 **단일 공유 버킷 완화 한도**로 처리한다(무제한 통과 아님, D-12; SoT [4-security R6](../7-channel-web-chat/4-security.md#r6-공개-webhook-ip-미식별--단일-공유-버킷-완화-한도)).

### 2.3.C — 비밀번호 변경 시 세션 revoke 범위 (refactor 04 후속)

비밀번호 변경(`POST /users/me/change-password`) 성공 시 **사용자의 모든 활성 family 를 revoke 하고 현재 디바이스에 새 세션을 재발급**한다(옵션 B). 변경 직전 `currentPassword` bcrypt 검증으로 본인 확인이 끝나므로 별도 재인증은 요구하지 않는다. 응답으로 새 access token 을 반환하고 refresh 쿠키를 회전시켜, 변경한 본인은 로그아웃 없이 그대로 사용한다.

근거: 비밀번호 변경의 보안 목적은 **유출된 비밀번호로 이미 발급된(=탈취 가능한) 세션의 무효화**다. 이상적으로는 "현재 세션만 남기고 나머지 revoke"이나, refresh 쿠키 `Path` 가 `/api/auth` 로 한정돼(§2.3 · Rationale 2.3.B M-5) `/api/users/me/change-password` 요청에는 쿠키가 첨부되지 않아 **현재 family 를 식별할 수단이 없다**. 따라서 전체 revoke + 재발급으로 동일 UX(현재 디바이스 유지)를 달성하되 현재 family 의 구 refresh token 까지 회전시켜 **더 강한 무효화**를 얻는다. OWASP Session Management 권고(비밀번호 변경 시 세션 무효화)와 일치한다.

reissue 세션은 표준 7일(`rememberMe=false`)로 발급한다 — 현재 family 를 식별할 수 없어 직전 세션의 remember-me(30일) 여부를 승계할 수 없기 때문이다. 변경 직후 본인이 명시적으로 수행한 동작이라 재발급 세션 수명 하향은 수용 가능한 트레이드오프다.

**무인증 reset-password(§1.1.A)와의 위협 모델 대조**: `POST /auth/reset-password`(토큰 기반·세션 없음)는 "비밀번호를 분실해 계정 통제권을 잃었을 수 있는" 시나리오라 전 세션을 revoke 하되 재발급하지 않고 로그인 화면으로 보낸다(기존 흐름 유지). 반면 change-password 는 "현재 비밀번호를 아는 본인이 능동적으로 교체" 하는 시나리오라 현재 세션 신뢰가 유지돼 재발급한다. 둘 다 "전 세션 revoke" 원칙은 공유하되 재발급 여부가 갈린다.

`session_revoked` enum 값은 기존 그대로 재사용한다(§4.3) — 새 event 종류 신설이 아니므로 `login_history` event 스키마·DB CHECK 제약·마이그레이션이 불요하다.

**기각된 대안 (a) 전 세션 revoke + 재발급 없음**: 현재 디바이스 포함 전체 종료 후 재로그인 강제. 변경한 본인은 방금 비밀번호로 재인증한 신뢰 세션이라 끊을 보안 이득이 없고 재로그인 비용만 발생.
**기각된 대안 (b') 현재 family 제외 revoke**: 위 쿠키 `Path` 제약으로 changePassword 컨트롤러에서 현재 family 식별 불가 — 구현 불가능.

**OAuth-only 사용자**: `passwordHash` 가 없으면 `POST /users/me/change-password` 자체가 `INVALID_PASSWORD` 로 차단되므로(현행) 본 정책은 비밀번호 보유 사용자에만 적용된다.

revoke/재발급 실패가 비밀번호 변경 주 동작(이미 커밋됨)을 깨지 않도록 best-effort 로 처리하되, 실패는 서버 로그로 관측 가능해야 한다.

### 1.5.D — 워크스페이스 초대 토큰을 raw 로 저장하는 이유 (vs 이메일·재설정 토큰의 SHA-256 해시)

§1.1 의 이메일 인증·비밀번호 재설정 토큰은 **사용자 계정 자체를 탈취**할 수 있는 자격증명이라 DB 유출 시 피해가 직접적이므로 SHA-256 해시로만 저장한다. 반면 초대 토큰(`WorkspaceInvitation.token`, raw 저장)은:

- 토큰 단독으로는 권한 획득이 불가능하다 — 수락 시 서버가 **로그인 사용자의 이메일과 토큰 이메일 일치를 강제**(`invitation_email_mismatch`, §1.5.3)하므로, 유출 토큰은 해당 이메일 계정의 인증 없이는 무용하다.
- 단일 사용(수락 시 소멸) + 7일 만료로 노출 창이 한정된다.
- 초대 관리 화면(§1.5.1)이 pending 초대의 재발송·취소를 위해 토큰 lookup 을 수행한다.

따라서 해시 전환의 보안 이득이 위협 모델 대비 작아 raw 저장을 유지한다. DB 유출을 전제로 하는 방어는 이메일 일치 강제(1차)와 만료(2차)가 담당한다.

### Production fail-closed 가드 — JWT_SECRET·ENCRYPTION_KEY·MCP (refactor 04 C-1·M-4·M-7)

`NODE_ENV=production` 에서 핵심 secret/플래그가 비보안 상태로 켜진 채 부팅하려 하면 즉시 throw 해
기동을 거부한다 (`common/config/production-guards.ts` 의 `assertProductionConfig`, `main.ts` 가
bootstrap 첫 단계에서 호출). 대상:

- **`JWT_SECRET`** — 미설정/기본 sentinel(`dev-jwt-secret`)/`.env.example` placeholder, 또는 32자
  미만(CWE-521 약한 secret). 기본·예측 가능 secret 으로 서명하면 누구나 access token 을 위조해
  인증을 전면 우회할 수 있다.
- **`ENCRYPTION_KEY`** — 미설정/공개 `.env.example` 예시 키. 예시 키로 운영하면 secret store 가
  사실상 평문이 된다 ([secret-store §Rationale](../conventions/secret-store.md#rationale)).
- **`MCP_ALLOW_INSECURE_URL`** — true 면 throw ([11-mcp-client](./11-mcp-client.md) 의 "운영 절대
  금지" 를 enforcement 로 일치).
- **`OAUTH_STUB_MODE`** — true 면 throw. 실제 OAuth provider 검증을 우회하는 비보안 stub 으로,
  운영에서 켜지면 SSO 인증을 무력화한다 (옛 `main.ts` 인라인 가드를 본 함수로 응집).
- **`LLM_STUB_MODE`** — true 면 throw. 실제 LLM 호출을 가짜 응답으로 대체하는 비보안 stub 으로,
  운영에서 켜지면 AI 기능이 검증 없는 stub 출력을 반환한다 (동일 응집).

**단일 블록 응집 이유**: spec 이 이미 동형 secret/stub(`INTERACTION_JWT_SECRET`,
`OAUTH_STUB_MODE`/`LLM_STUB_MODE`)에 production throw 표준을 명문화했고, 같은 위치(`main.ts` boot)·
같은 패턴이라 한 함수로 모으면 이후 secret 추가 시 누락을 구조적으로 막는다. env 만으로 부팅 직전
판정 가능한 절대-금지 항목만 포함하며, DI·요청 컨텍스트가 필요하거나(예: `INTERACTION_JWT_SECRET`
생성자 throw) 정당 용도가 있는 항목(예: `ALLOW_PRIVATE_HOST_TARGETS` 는 throw 가 아닌 warn)은
의도적으로 분리한다. 운영 영향(미설정 시 기동 거부)은 insecure 부팅보다 안전한 fail-closed 의도다.
dev/test/e2e(`NODE_ENV≠production`)는 영향이 없다.

### 4.1.A — Planned 감사 액션의 `user.*` dot-prefix 통일

§4.1 의 Planned 인증 감사 액션을 `password_change`·`2fa_enable/disable`(dot-prefix 없음)에서
`user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled`로 확정한다. 근거:

- **dot-prefix 는 §4.1 규약상 필수다** — `<resource>.<verb>`. prefix 없는 표기는 과거
  `re_run_initiated`(→ `execution.re_run`, cross-audit G-02)와 동일한 규약 이탈이며, 그 선례가
  이미 정정된 이상 Planned 표가 같은 위반을 답습하면 안 된다. Planned 는 미구현이라 코드 의존이
  없어 지금 표기를 바로잡는 비용이 가장 낮다.
- **resource 토큰은 `user`** — 비밀번호 변경·2FA 토글은 행위 주체 사용자의 **계정 보안 속성**
  변경이라 `auth_config`(웹훅 인증 설정 — 별개 리소스)나 `auth`(추상적)보다 `user` 가 자연스럽다.
  향후 user-profile 계열 감사(예: `user.email_changed`)와 동일 네임스페이스로 묶인다.
- **verb 시제는 과거분사** — integration 계열(`integration.created`)과 같이 "일어난 일" 을 기록하는
  도메인 관례를 따른다(`changed`/`enabled`/`disabled`). 구현 시 `AUDIT_ACTIONS` 에 추가한다.

같은 근거로 **나머지 Planned 액션의 시제도 정규화**한다 — `workspace`·`member`·`workflow`·
`trigger`·`schedule` 은 동사가 모두 과거분사로 자연스러우므로 기본 규약(과거분사)을 따라
`created`/`updated`/`deleted`/`invited`/`role_changed`/`removed`/`executed` 로 적는다(현재형
`create`·`invite` 이탈 정정). 단 `model_config.*` 는 `set_default` 가 과거분사로 부자연스러워
`auth_config` 와 동일하게 **resource 단위 현재형 예외**를 유지한다 — 규약의 "과거분사가
부자연스러운 동사가 섞이면 CRUD 현재형으로 통일" 조항 적용. 모두 미구현이라 코드 의존이 없어
지금 표기를 확정하는 비용이 가장 낮고, 구현 시 `AUDIT_ACTIONS` 에 그대로 추가한다.

**`workspace.transfer_ownership` 분류 (refactor 04 후속 A-2)**: 기존 구현된
`workspace.transfer_ownership` 은 과거분사 기본형·CRUD 현재형 예외 어디에도 깔끔히 들어맞지
않는다 — 소유권 이전은 생애주기 CRUD 가 아니라 단일 트랜잭션 행위이고, 과거분사화
(`ownership_transferred`)는 이미 적재된 row 와 `AUDIT_ACTIONS` 표기를 깨뜨리면서 얻는 게 없다
(append-only 원칙). 따라서 `execution.re_run` 과 같은 **도메인 고유 동사**로 분류한다.
이 시제 3분류(과거분사 기본 / CRUD 현재형 예외 / 도메인 고유 동사)와 도메인별 레지스트리는
[`conventions/audit-actions.md`](../conventions/audit-actions.md) 가 규약 SoT 로 정착했으며,
본 4.1.A 는 그 결정의 근거·역사로 남는다.

### 4.1.B — `user.*` 감사 이벤트의 workspace 귀속 (refactor 04 후속)

`user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 를 `audit_log`(workspaceId **non-nullable**)에 어떻게 귀속할지 확정한다 — **액터의 현재 세션 `workspaceId`**(인증 요청 JWT 의 workspace).

근거: 이 세 액션은 모두 **인증된 세션에서만** 발생한다(`POST /users/me/change-password`·TOTP·WebAuthn 모두 JwtAuthGuard 뒤). 인증 요청은 항상 workspace 컨텍스트를 JWT 로 운반하므로, 그 세션 workspace 에 귀속하면 `workspaceId` non-nullable 제약을 schema 변경 없이 충족한다. 이는 §4.1 의 "인증 (워크스페이스 컨텍스트)" 분류를 **구체화**하는 것이지 번복이 아니다 — login/logout/login_failed(무 workspace) → LoginHistory(L379) 규칙은 불변.

**무인증 password-reset 제외**: `POST /auth/reset-password`(토큰 기반)는 세션·workspace 가 없어 `user.password_changed` audit 대상이 아니다(L379 분류 원칙). reset 완료를 별도 기록할지는 `login_history` event enum(§4.3, [데이터 모델 §2.18.2](../1-data-model.md)) 신설 + `chk_login_history_event` CHECK 마이그레이션을 동반하는 별개 결정으로 본 범위 밖이다.

**WebAuthn 추가 credential 등록도 `user.2fa_enabled`**: 두 번째 이후 authenticator 등록(이미 2FA 활성)도 동일하게 `user.2fa_enabled` 로 기록하되 `details.firstCredential=false` 로 최초 활성화와 구분한다 — "2FA 활성화" 사건은 아니지만 계정 보안 속성(인증 수단) 추가라 추적 대상이고, 액션을 새로 만들기보다 details 플래그로 구분하는 편이 조회·집계에 단순하다 (`webauthn.controller` 가 `firstCredential = (recoveryCodes 발급 여부)` 로 판정).

**OAuth-only 사용자의 마지막 2FA 비활성화는 별개 결정**: 비밀번호 없는 OAuth-only 계정이 유일한 2FA 수단을 비활성화할 때 대안 인증 경로(계정 잠금 위험)를 어떻게 보장할지는 본 감사 귀속과 무관하며, 강제 2FA 정책·계정 복구 흐름과 함께 다룰 별개 결정 사안이다(현재 별도 차단 로직 없음).

**기각된 대안**:
- **(b) `audit_log.workspaceId` nullable 허용** (user-level 이벤트 null): schema 마이그레이션 + 모든 workspace-필터 쿼리·인덱스·조회 권한(§4.2 `@WorkspaceId()` 스코프) 이 null 을 특수 처리해야 해 blast radius 가 크다. 인증 이벤트가 항상 세션 workspace 를 가지므로 nullable 이 불필요.
- **(c) 별도 user/personal audit scope 신설**: `audit_log` 는 본질적으로 workspace-scoped 팀 기능이고 user-단위 인증 이벤트는 이미 `login_history`(§4.3)가 담당 — 저장소 이중화는 불필요.
