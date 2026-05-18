# Spec: 인증/인가 시스템

> 관련 문서: [PRD 비기능 요구사항](./_product-overview.md#2-보안) · [Spec 아키텍처 개요](../0-overview.md) · [Spec 사용자 프로필](../2-navigation/9-user-profile.md) · [데이터 모델 - User](../1-data-model.md#21-user)

---

## 1. 인증 (Authentication)

### 1.1 이메일/비밀번호 인증

| 항목 | 설명 |
|------|------|
| 회원가입 | 이메일 + 비밀번호. 이메일 인증 필수 |
| 비밀번호 정책 | 최소 8자, 대소문자 + 숫자 + 특수문자 중 3가지 이상 조합 |
| 비밀번호 저장 | bcrypt (cost factor ≥ 12) |
| 로그인 | 이메일 + 비밀번호 → JWT 발급 |
| 비밀번호 분실 | 이메일로 재설정 링크 발송 (유효기간 30분) |
| 로그인 실패 | 5회 실패 시 10분 잠금, 이메일 알림 |

### 1.2 OAuth 소셜 로그인

| 프로바이더 | 설명 |
|-----------|------|
| Google | Google OAuth 2.0 |
| GitHub | GitHub OAuth Apps |

- 소셜 로그인 시 기존 이메일 계정과 자동 연결 (이메일 일치 시)
- 최초 소셜 로그인 시 자동 회원가입 + 개인 워크스페이스 생성

### 1.3 셀프 호스팅 추가 인증

| 방식 | 설명 |
|------|------|
| LDAP | LDAP/Active Directory 연동 (선택) |
| SAML 2.0 | 기업 SSO 연동 (선택) |

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
| WebAuthn credential ≥ 1 | `{ requires2fa: true, methods: ['webauthn'], challengeToken, requiresTotp: <true if TOTP active else false> }` | WebAuthn 인증 화면. TOTP 코드 입력란은 숨김 |
| WebAuthn credential = 0 AND `two_factor_enabled = true` | `{ requires2fa: true, methods: ['totp'], challengeToken, requiresTotp: true }` | TOTP 입력 화면 (기존과 동일) |
| 둘 다 없음 | `{ accessToken }` (즉시 로그인) | — |

규칙:

- **WebAuthn 이 1개라도 등록된 사용자에게는 로그인 화면에서 TOTP 입력을 제공하지 않는다.** 사용자가 TOTP 로 우회하길 원하면 보안 설정에서 WebAuthn credential 을 먼저 모두 삭제해야 한다 (Rationale 1.4.D — fallback 채널을 자동으로 노출하면 약한 인증 수단이 강한 인증 수단을 우회하는 위협이 있음).
- WebAuthn 실패 시 사용자는 동일 화면의 **"복구 코드 사용"** 링크로 WebAuthn 전용 복구 코드 입력 필드를 노출할 수 있다 (TOTP 화면으로 자동 전환되지 않음).
- `requiresTotp` 는 기존 클라이언트 호환을 위한 **deprecated** 필드다. 도입 이유: WebAuthn 추가 이전 클라이언트(릴리스 < 2026-05-18) 가 본 응답을 분해할 수 있도록 한동안 함께 내려준다. **제거 조건**: (1) 두 마이너 버전 후 (예: 본 변경이 v0.7 이면 v0.9 에서 제거), (2) `methods` 만 보는 새 프론트엔드가 동일 PR 에서 함께 배포되어 backward-only 사용처가 사라진 것이 확인된 후 — 둘 중 늦은 시점. 새 클라이언트는 `requires2fa` + `methods` 만 본다. 두 필드 충돌 시 `requires2fa` 가 우선한다.

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

**`/auth/2fa/webauthn/availability`** — Public GET. 응답 `{ data: { enabled: boolean } }`. 인증 불요. 프론트엔드가 보안 페이지 진입 시 호출해 Passkey 카드 노출 여부를 결정한다.

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
| Rate Limit | 워크스페이스·invited_by 단위 분당 N회 (구현 시 결정) | 이메일 폭격 방지 |

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

#### 1.5.4 에러 응답

| 상황 | HTTP | 코드 |
|------|------|------|
| 토큰 없음·잘못된 형식 | 404 | `invitation_not_found` |
| 만료 | 410 | `invitation_expired` |
| 이미 사용됨 | 410 | `invitation_already_used` |
| 이메일 불일치 (accept 또는 register) | 400 | `invitation_email_mismatch` |
| 권한 부족 (발송·재발송·취소) | 403 | `forbidden` |
| Rate limit 초과 | 429 | `rate_limited` |

---

## 2. 세션 관리

### 2.1 JWT 토큰 구조

| 토큰 | 저장 위치 | 유효 기간 | 용도 |
|------|-----------|-----------|------|
| Access Token | 메모리 (JS 변수) | 15분 | API 요청 인증 |
| Refresh Token | HttpOnly Cookie | 7일 | Access Token 갱신 |

### 2.2 Access Token Payload

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "workspaceId": "workspace-uuid",
  "role": "editor",
  "iat": 1711406400,
  "exp": 1711407300
}
```

### 2.3 세션 정책

| 항목 | 설명 |
|------|------|
| 세션 단위 | `family_id` — refresh 회전 시 row가 갱신되더라도 동일 family는 하나의 "디바이스 세션" |
| 동시 세션 | 기본 5개 (관리자 설정 가능) |
| 초과 시 | 가장 오래된 세션 자동 종료 |
| 비활동 만료 | 30일간 미사용 시 Refresh Token 무효화 |
| 강제 종료 | 사용자가 활성 세션 목록에서 개별 종료 가능 (family 전체 revoke) |
| 강제 종료 재인증 | 비밀번호 재확인 필수. OAuth-only 사용자는 등록된 2FA (TOTP 또는 WebAuthn) 또는 이메일 OTP 로 대체. 두 방식 모두 등록한 사용자는 §1.4.2 의 우선순위(WebAuthn 우선) 를 따른다 |
| 현재 세션 식별 | 서버가 요청의 refresh-token 쿠키 해시를 조회해 `isCurrent` 플래그로 응답 — raw token은 JS로 노출하지 않음 |
| 메타데이터 | 발급 시점의 IP·User-Agent·디바이스 라벨 및 마지막 사용 시각을 RefreshToken 에 기록 |
| 클라이언트 IP | Cloudflare 무료 플랜 호환: `CF-Connecting-IP` 헤더를 1순위, `X-Forwarded-For` 첫 IP, `req.ip` 순으로 추출 |

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
| LLM Config | CRUD | CRUD | R | R |
| Statistics | R | R | R | R |
| Marketplace 설치 | ✅ | ✅ | ✅ | — |
| Audit Log | R | R | — | — |

### 3.3 API 인가 흐름

```
1. 요청 수신 → Access Token 검증
2. Token에서 workspaceId, role 추출
3. 요청 리소스가 해당 워크스페이스에 속하는지 확인
4. 역할이 해당 액션에 대한 권한을 가지는지 확인
5. 권한 없음 → 403 Forbidden
```

---

## 4. 감사 로그 (Audit Log)

### 4.1 기록 대상 액션

| 카테고리 | 액션 |
|----------|------|
| 인증 (워크스페이스 컨텍스트) | password_change, 2fa_enable/disable |
| 워크스페이스 | workspace.create, workspace.update, workspace.delete |
| 멤버 | member.invite, member.role_change, member.remove |
| 워크플로우 | workflow.create, workflow.update, workflow.delete, workflow.execute |
| 트리거 | trigger.create, trigger.update, trigger.delete, trigger.toggle |
| 스케줄 | schedule.create, schedule.update, schedule.delete |
| Integration | integration.create, integration.update, integration.delete |
| 설정 | auth_config.*, llm_config.* |

> 워크스페이스 컨텍스트가 없는 인증 이벤트(login, logout, login_failed 등)는 AuditLog 가 아닌 §4.3 **LoginHistory** 에 기록된다.

### 4.2 조회

- 관리자(Admin+)만 조회 가능
- 기간, 사용자, 액션 유형으로 필터링
- 최근 90일 보관 (설정 가능)

### 4.3 로그인 이력 (LoginHistory)

사용자 단위 인증 이벤트는 별도 테이블 `login_history` 에 보관한다 (데이터 모델 §2.18.2). 사용자가 본인의 이력만 조회할 수 있다.

| 이벤트 | 설명 |
|--------|------|
| login_success | 비밀번호 또는 OAuth 로그인 성공 |
| login_failed | 비밀번호 불일치·계정 잠금·이메일 미인증 등 실패 |
| totp_failed | 2FA TOTP 코드 검증 실패 |
| webauthn_failed | 2FA WebAuthn 검증 실패. `failure_reason` 으로 `WEBAUTHN_INVALID`·`WEBAUTHN_COUNTER_REGRESSION` 등 세부 구분 |
| logout | 사용자가 `/auth/logout` 호출 → 호출 디바이스 family 전체 revoke |
| session_revoked | 사용자가 활성 세션 목록에서 다른 family 강제 종료 |
| token_reuse_detected | revoke된 refresh token 재사용 감지 → family 전체 revoke |

보존: **180일** 경과 row 는 일일 배치(`@Cron('0 3 * * *')`)로 자동 삭제. 조회는 사용자 본인만 가능하며 워크스페이스 관리자에게는 노출되지 않는다.

---

## 5. API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/auth/register | 회원가입 |
| POST | /api/auth/login | 로그인 (비밀번호 검증 — 2FA 활성 사용자는 `{ requires2fa, methods, challengeToken, requiresTotp? }` 응답) |
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
| GET | /api/auth/2fa/webauthn/credentials | 사용자의 WebAuthn credential 목록. **인증 필수** (JWT). 응답: `[{id, deviceName, transports, lastUsedAt, createdAt}]` (publicKey·counter 미노출) |
| PATCH | /api/auth/2fa/webauthn/credentials/:id | credential `device_name` 수정. **인증 필수** (JWT). `:id` 는 UUID. 200 + 갱신된 row. 본인 소유 아니면 404 (enumeration 방지) |
| DELETE | /api/auth/2fa/webauthn/credentials/:id | credential 삭제. **인증 필수** (JWT). **마지막 credential 삭제 시 `user.webauthn_recovery_codes` 를 `WebAuthnService.deleteCredential` 가 NULL 화** (DB 트리거 아님). 204 |
| POST | /api/auth/2fa/webauthn/recovery-codes/regenerate | WebAuthn 복구 코드 재발급. **인증 필수** (JWT) + 본문에 `password` 재확인. 기존 미사용 코드 폐기 후 10개 새로 발급. TOTP 의 `/api/auth/2fa/disable` 과 대칭적인 네임스페이스 (TOTP 측 복구 코드 재발급은 현재 미지원 — 비활성→재활성으로 재발급) |
| POST | /api/auth/logout | 로그아웃 (호출 디바이스 family 전체 revoke) |
| POST | /api/auth/refresh | 토큰 갱신 |
| POST | /api/auth/forgot-password | 비밀번호 재설정 요청 |
| POST | /api/auth/reset-password | 비밀번호 재설정 |
| GET | /api/auth/oauth/:provider | OAuth 시작 |
| GET | /api/auth/oauth/:provider/callback | OAuth 콜백 |
| GET | /api/audit-logs | 감사 로그 조회 (Admin+) |
| GET | /api/invitations/:token | 초대 토큰 메타 조회 (인증 불요, 가입 페이지 prefill). 만료·invalidated 토큰은 410 |

사용자 본인 세션·이력 관리 엔드포인트는 [사용자 프로필 spec §6.1](../2-navigation/9-user-profile.md#61-사용자워크스페이스-api) 에 정의 (`/api/users/me/sessions`, `/api/users/me/login-history`).

초대 발송·재발송·취소·수락 엔드포인트는 [사용자 프로필 spec §6.1](../2-navigation/9-user-profile.md#61-사용자워크스페이스-api) 에 정의 (`/api/workspaces/:id/invitations`, `/api/workspaces/invitations/accept`).

`POST /api/auth/register` 는 본문에 `invitationToken?` 을 받아 [§1.5.2 흐름](#152-흐름-미가입자-가입-경로) 의 트랜잭션을 수행한다.

---

## Rationale

### 1.5.A — 가입 시 이메일 일치 강제

토큰 이메일 ≠ 가입/로그인 사용자 이메일인 경우의 처리로 세 옵션을 검토했다:

- **이메일 일치 강제 (선택)** — 다르면 가입·accept 모두 차단.
- 토큰만 무효화, 가입은 허용 — 가입은 끝나지만 워크스페이스 멤버는 안 됨. UX 가 모호.
- 검증 없이 자동 accept — 토큰 누출 시 임의 워크스페이스 진입 가능.

이메일 일치 강제를 채택한 이유:

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

후보:

- **`@simplewebauthn/*` (선택)** — 서버·브라우저 양쪽 모듈을 같은 메인테이너가 관리. FIDO2 L3 / WebAuthn spec 추적이 빠르고, registration·authentication 의 `generate`·`verify` 페어가 대칭이라 코드가 단순. Node 18+ 에서 ESM/CJS 모두 동작.
- `fido2-lib` — 저수준 API. CBOR / COSE 해석을 직접 다뤄야 해 보일러플레이트가 많음.
- 직접 구현 — 비현실적. WebAuthn spec 변화 추적·attestation 검증 보안 리스크가 큼.

`@simplewebauthn/server` 가 다음 두 항목을 무료로 제공한다: (a) attestation/assertion 의 origin·rpID·challenge 일관성 검증, (b) counter 역행 감지. 본 spec 의 보안 요구를 라이브러리가 그대로 만족한다.

### 1.4.B — 복구 코드 풀 분리 (TOTP / WebAuthn 별도)

세 옵션을 검토했다:

- **별도 풀 (선택)** — `user.totp_recovery_codes` 와 `user.webauthn_recovery_codes` 두 컬럼.
- 공통 풀 — 한 컬럼에서 TOTP·WebAuthn 양쪽 fallback.
- WebAuthn 만 fallback 없음 — 사용자가 마지막 credential 분실 시 계정 잠김.

별도 풀을 선택한 이유:

- 사용자가 한쪽 방식만 비활성화·재설정해도 다른 쪽 복구가 유지되어야 한다. 공통 풀이면 TOTP 비활성화 시점에 WebAuthn 복구도 함께 폐기되어야 할지 결정이 모호해진다.
- "WebAuthn 만 사용" 사용자에게도 TOTP 활성화 없이 복구 수단을 제공해야 한다. 공통 풀 가설은 "TOTP 가 항상 켜져 있다" 라는 가정에 의존한다.
- 추가 컬럼 한 개의 비용은 미미 (NULL 일 때 PostgreSQL 은 추가 공간 거의 사용 안 함).

### 1.4.C — WebAuthn challenge: stateless JWT (별도 테이블 없음)

검토한 두 옵션:

- **stateless JWT (선택)** — `optionsToken` 으로 발급. payload `{ kind, sub, challenge, exp(5분) }`.
- `webauthn_challenge` 테이블 — INSERT/SELECT/DELETE 필요.

JWT 채택 이유:

- WebAuthn spec 의 challenge unique·fresh 요건은 challenge 자체가 random 이고 verify 시 클라이언트 응답과 일치 확인하면 만족된다. 서버 측 DB 의 단명 row 가 unique 강제에 필수는 아님.
- replay 방어: JWT 만료 5분 + `kind` 검증으로 의도 다른 흐름(`register`↔`auth`) 교차 사용 차단.
- 운영 부담 감소: 단명 row 의 cleanup 배치·인덱스 부재.
- 트레이드오프: 같은 5분 윈도우 안에서 동일 JWT 의 두 번째 verify 가 시도되면, `@simplewebauthn/server` 의 verify 는 challenge·response 짝의 cryptographic uniqueness 로 거부한다 (credential 의 counter 증가가 한 번만 발생). 즉 JWT 단독 reuse 만으로 인증을 통과할 수 없음.

### 1.4.E — counter 역행 시 credential 강제 삭제 (vs suspend)

WebAuthn 인증기의 sign counter 가 역행하면 (저장값 ≥ 신규값) `@simplewebauthn/server` 의 `verifyAuthenticationResponse` 는 reject 한다. 본 spec 은 reject 시 **해당 row 를 즉시 삭제** 하고 `failure_reason=WEBAUTHN_COUNTER_REGRESSION` 으로 LoginHistory 에 기록한다.

검토한 두 옵션:

- **삭제 (선택)** — credential row 제거. 사용자가 같은 인증기를 다시 쓰려면 `/profile/security` 에서 재등록.
- suspend — 별도 `disabled_at` 컬럼 + 사용자가 명시적으로 "다시 활성화" 가능.

삭제를 선택한 이유:

- counter 역행은 (a) 인증기 복제·클론 공격 (b) 인증기 firmware 오류 두 가지로 좁혀진다. 둘 다 신뢰가 깨진 상태이므로 즉시 신뢰 철회가 원칙.
- suspend 는 사용자에게 "재활성화" 선택지를 주는데, 이는 클론 공격자가 본인을 사칭해 재활성화 버튼을 눌러도 동일한 효과 — 보안 이득이 작다.
- 운영 단순화: 추가 컬럼·UI 흐름·테스트 케이스가 줄어든다. 재등록 비용이 사용자에게 미미.

### 1.4.D — 로그인 시 TOTP 자동 fallback 금지

WebAuthn 등록 사용자에게 로그인 화면이 TOTP 입력란을 함께 노출하지 않는다. 이유:

- 보안: WebAuthn 은 phishing-resistant, TOTP 는 사용자가 코드를 입력하는 시점에 phishing 에 취약. 사용자가 강한 인증 수단을 등록했는데 약한 수단으로 자동 우회 가능하면 등록한 의미가 약해진다.
- 사용자가 의도적으로 TOTP 로 전환하길 원하면 보안 설정에서 WebAuthn credential 을 모두 삭제 (혹은 webauthn 복구 코드 사용) 한 뒤 재로그인 가능. 의식적인 다운그레이드만 허용한다.
- 분실 시 잠김 위협은 별도 복구 코드 (§1.4.1) 로 완화. 복구 코드 분실까지 가정한 계정 복구는 본 spec 범위 밖 (관리자 개입 경로).

### 1.4.F — WebAuthn 환경변수 미설정 시 부팅 거부 vs 기능 비활성

본 PR 직후 운영 인스턴스에서 `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` 미설정 상태로 NestJS bootstrap 이 throw → 컨테이너 crashloop 발생. 운영자가 WebAuthn 을 사용할 의향이 없거나 아직 도메인이 정해지지 않은 셀프 호스팅 단계에서 앱 전체가 죽는 trade-off 가 부적절하다는 판단으로, 정책을 두 가지 후보 중 선택:

| 후보 | 동작 | 채택 여부 |
|------|------|-----------|
| A. 부팅 거부 (이전) | env 미설정 + `WEBAUTHN_ALLOW_FALLBACK!=1` → throw | **기각** — 운영자가 WebAuthn 을 안 쓰는 경우에도 앱 자체가 안 뜸. 일반 로그인·TOTP 까지 동반 마비. |
| B. 기능 비활성 (현재) | env 미설정 → `enabled=false`. WebAuthn 엔드포인트만 503, 나머지 정상 | **채택** — 옵션 기능답게 옵션. 운영자가 의식적으로 켜야 켜진다. |

채택 이유:

- WebAuthn 은 **부가 인증 수단**이지 인증의 핵심 경로가 아니다. 부재 시 일반 로그인 + TOTP 가 정상 동작해야 한다.
- 운영자가 모든 env 를 한 번에 설정하지 않는 셀프 호스팅 점진 도입 시나리오를 차단하지 말아야 한다.
- 잘못된 폴백(localhost 등) 으로 등록·인증 데이터가 누적되면 향후 도메인 결정 시점에 모두 무효화되므로, 자동 폴백보다는 명시적 활성화가 안전.
- 사용자 락아웃 우려: WebAuthn-only 사용자가 env 비활성 시점에 접근 불가가 되는 가능성은 있으나, 운영자가 WebAuthn 을 한 번이라도 활성화했다면 env 를 그대로 두는 게 정상 운영. 운영자 실수로 env 가 꺼지면 사용자는 webauthn 복구 코드 → TOTP 등록 우회 경로가 없고 관리자 개입 필요. 본 케이스는 §1.4.D 와 같은 운영 권고 사항 (env 변경 전 사용자 공지).
- 폴백이 필요한 dev/local/시연 한정으로는 `WEBAUTHN_ALLOW_FALLBACK=1` escape hatch 를 유지한다.
