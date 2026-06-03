---
id: auth-flow
status: partial
pending_plans:
  - plan/in-progress/spec-sync-auth-flow-gaps.md
code:
  - codebase/frontend/src/app/(auth)/**
  - codebase/frontend/src/components/auth/**
  - codebase/backend/src/modules/auth/**
---

# Spec: 인증 UI 플로우

> 관련 문서: [PRD 비기능 요구사항 §2](../5-system/_product-overview.md#2-보안) · [Spec 인증/인가](../5-system/1-auth.md) · [Spec 사용자 프로필](./9-user-profile.md) · [데이터 모델 - User](../1-data-model.md#21-user)

---

## 1. 화면 구성 개요

인증 화면은 사이드바가 없는 **전체 화면 레이아웃**을 사용한다.

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│              ┌────────────────────────┐                      │
│              │        [Logo]          │                      │
│              │                        │                      │
│              │    (인증 폼 영역)       │                      │
│              │                        │                      │
│              └────────────────────────┘                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- 중앙 정렬 카드 형태 (최대 너비 400px)
- 배경: 제품 브랜드 색상 또는 그래디언트
- 카드 상단의 `[Logo]` 자리에는 **Full logo** 변종을 사용 (변종 매트릭스: [`spec/6-brand.md` §8.4.1](../6-brand.md#841-변종-매트릭스))
- 반응형: 모바일에서 카드가 전체 너비 확장

---

## 2. 회원가입 (Register)

### 2.1 화면

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    Create your account           │
│                                  │
│    Name:     [______________]    │
│    Email:    [______________]    │
│    Password: [______________]    │
│              (패스워드 강도 바)    │
│                                  │
│    □ I agree to Terms of Service │
│                                  │
│    [      Create Account      ]  │
│                                  │
│    ─── or continue with ───      │
│                                  │
│    [🔵 Google] [⚫ GitHub]       │
│                                  │
│    Already have an account?      │
│    → Sign in                     │
└──────────────────────────────────┘
```

### 2.2 필드 검증

| 필드 | 검증 규칙 | 실시간 피드백 |
|------|-----------|--------------|
| Name | 필수, 2~50자 | 입력 즉시 |
| Email | 필수, 이메일 형식 | blur 시 형식 검증 (blur 시 `POST /api/auth/check-email` 중복 확인은 **미구현 (Planned)** — 백엔드 엔드포인트·`authApi.checkEmail` 클라이언트는 존재하나 register 폼이 아직 호출하지 않음) |
| Password | 필수, 최소 8자, 대소문자+숫자+특수문자 중 3가지 이상 | 입력 중 강도 바 표시 (약함/보통/강함) |
| Terms | 필수 체크 | 미체크 시 버튼 비활성화 |

### 2.3 비밀번호 강도 바

구현은 5개 기준(8자 이상 / 소문자 / 대문자 / 숫자 / 특수문자)을 각 1점으로 합산한 `score`(0~5)에 따라 5단계 라벨을 노출한다 (`codebase/frontend/src/lib/utils/password.ts`).

| 강도 라벨 (i18n key) | score | 색상 |
|------|------|------|
| 약함 (`auth.register.strengthWeak`) | 0~1 | 빨강 (`bg-red-500`) |
| 보통 (`auth.register.strengthFair`) | 2 | 주황 |
| 양호 (`auth.register.strengthGood`) | 3 | 노랑 |
| 강함 (`auth.register.strengthStrong`) | 4 | 연초록 (`green-400`) |
| 매우 강함 (`auth.register.strengthVeryStrong`) | 5 | 진초록 (`green-600`) |

### 2.4 처리 플로우

```
1. 입력 검증 (클라이언트)
2. POST /api/auth/register { name, email, password, invitationToken? }
3. 성공 → 이메일 인증 안내 화면으로 이동 (단, invitationToken 흐름은 §2.6 분기 참고)
4. 실패 → 인라인 에러 표시 (이메일 중복, 토큰 만료/이메일 불일치 등)
```

### 2.6 초대 토큰을 통한 가입 (`?invitationToken=…`)

미가입자가 메일 링크를 클릭하면 회원가입 페이지는 `?invitationToken=…` 쿼리를 받아 다음 처리를 수행한다:

| 단계 | 처리 |
|------|------|
| 1. 토큰 메타 prefetch | `GET /api/invitations/:token` 로 워크스페이스 이름·초대자·이메일·만료 조회. 401/410 등 실패 → 에러 화면으로 라우팅 |
| 2. 이메일 prefill + readOnly | 응답의 `email` 을 입력란에 채우고 readOnly 로 고정. 다른 이메일로 가입 자체 차단 |
| 3. 헤더 안내 | "**{workspace}** 에 초대받으셨어요" + 초대자 이름 노출 |
| 4. 가입 제출 | `POST /api/auth/register { name, password, invitationToken }` — 이메일은 토큰에서 서버가 신뢰 |
| 5. 트랜잭션 처리 | 서버에서 [Spec 인증/인가 §1.5.2](../5-system/1-auth.md#152-흐름-미가입자-가입-경로) 의 단일 트랜잭션 (User 생성 + WorkspaceMember 추가 + invitation.acceptedAt) 수행. 실패 시 전체 롤백 |
| 6. 가입 성공 후 | 이메일 인증 안내 화면 대신 **초대된 워크스페이스로 컨텍스트 진입** (§6.1 의 개인 워크스페이스 자동 생성은 발화하지 않음) |
| 7. 에러 분기 | `invitation_email_mismatch` (서버가 거의 차단하지만 안전망), `invitation_expired`, `invitation_already_used` → "이 초대는 더 이상 유효하지 않아요. 워크스페이스 관리자에게 재발송을 요청하세요" 안내 |

### 2.5 이메일 인증 안내 화면

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    📧 Verify your email          │
│                                  │
│    We sent a verification link   │
│    to gehrig@example.com         │
│                                  │
│    [   Resend Email   ]  (계획)  │
│                                  │
│    → Back to login               │
└──────────────────────────────────┘
```

- 이메일 인증 링크 클릭 → 인증 페이지가 `POST /api/auth/verify-email` 호출 (token 은 **요청 본문**에 동봉; 링크 자체는 `?token=` 쿼리로 전달되나 검증 호출은 POST+body 다). 아래 §API 표 참조.
- 인증 성공 → 자동 로그인 + 개인 워크스페이스 생성 + 대시보드(`/dashboard`)로 리다이렉트
- 인증 토큰 유효기간: 24시간
- **미구현 (Planned)**: Resend Email 버튼 + 60초 쿨다운 + `POST /api/auth/resend-verification`. 현재 화면(`codebase/frontend/src/app/(auth)/verify-email/verify-email-content.tsx`)은 "Back to login" 링크만 노출하며, 백엔드 `resend-verification` 핸들러도 아직 없다. 추적: `plan/in-progress/spec-sync-auth-flow-gaps.md`

---

## 3. 로그인 (Sign In)

### 3.1 화면

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    Sign in to your account       │
│                                  │
│    Email:    [______________]    │
│    Password: [______________]    │
│                                  │
│    □ Remember me                 │
│    → Forgot password?            │
│                                  │
│    [        Sign In          ]   │
│                                  │
│    ─── or continue with ───      │
│                                  │
│    [🔵 Google] [⚫ GitHub]       │
│                                  │
│    Don't have an account?        │
│    → Create account              │
└──────────────────────────────────┘
```

### 3.2 처리 플로우

```
1. 입력 검증 (이메일 형식, 비밀번호 비어있지 않음)
2. POST /api/auth/login { email, password }
3. 2FA 미설정 → JWT 발급 → 대시보드(`/dashboard`)로 리다이렉트
4. 2FA 설정됨 → 응답 { requires2fa, methods, challengeToken } 수신 → 2FA 입력 화면으로 이동
   - methods 가 'webauthn' 포함 → WebAuthn 화면 (TOTP 입력란 비노출 — [auth spec §1.4.2](../5-system/1-auth.md#142-로그인-시-인증-방식-선택--webauthn-우선-totp-fallback-자동-금지))
   - methods 가 'totp' 만 → TOTP 화면
5. 로그인 실패 → "Invalid email or password" 에러 (구체적 이유 미노출)
6. 5회 실패 → 계정 10분 잠금 + "Account locked. Try again in 10 minutes."
```

클라이언트는 `requires2fa` + `methods` 만 본다 — `requires2fa=true` 이면 challenge 단계, `methods[0]` 으로 WebAuthn / TOTP 화면을 분기. 상세 분기 규칙은 [auth spec §1.4.2](../5-system/1-auth.md#142-로그인-시-인증-방식-선택--webauthn-우선-totp-fallback-자동-금지) 참고.

### 3.3 "Remember me" 동작

| 체크 | Refresh Token 유효기간 |
|------|----------------------|
| 미체크 | 7일 (기본) |
| 체크 | 30일 |

### 3.4 2FA 입력 화면

응답 `methods` 에 따라 두 화면 중 하나가 노출된다.

#### 3.4.1 TOTP 화면 (methods = ['totp'])

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    Two-factor authentication     │
│                                  │
│    Enter the 6-digit code from   │
│    your authenticator app        │
│                                  │
│    [  _  _  _  _  _  _  ]       │
│                                  │
│    → Use a recovery code         │
│                                  │
│    [       Verify            ]   │
│    [       ← Back            ]   │
└──────────────────────────────────┘
```

- 6자리 숫자 자동 포커스 이동
- `POST /api/auth/login/totp { challengeToken, code }`
- 성공 → JWT 발급 → 리다이렉트
- 실패 → "Invalid code. Please try again."
- 복구 코드 입력 모드 전환 시 단일 입력 필드로 변경

#### 3.4.2 WebAuthn 화면 (methods 가 'webauthn' 포함)

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    Two-factor authentication     │
│                                  │
│    Use your Passkey or security  │
│    key to sign in                │
│                                  │
│    [   Use Passkey / Key     ]   │
│                                  │
│    → Use a recovery code         │
│    [       ← Back            ]   │
└──────────────────────────────────┘
```

- 페이지 마운트 시 자동으로 `navigator.credentials.get()` 호출 흐름 진입.
- `POST /api/auth/2fa/webauthn/authenticate/options { challengeToken }` → optionsToken + PublicKeyCredentialRequestOptions 수신.
- 사용자가 인증기 동작 → `POST /api/auth/2fa/webauthn/authenticate/verify { challengeToken, optionsToken, response }`.
- 실패 시 동일 화면에 "Use a recovery code" 링크 → 입력 필드 노출 → `POST /api/auth/2fa/webauthn/recovery { challengeToken, code }`.
- **TOTP 화면으로 자동 전환되지 않는다.** 사용자가 TOTP 만 사용하길 원하면 보안 설정에서 WebAuthn credential 을 먼저 모두 삭제해야 한다 (auth spec §1.4.D Rationale).
- 브라우저가 WebAuthn 미지원이거나 사용자 인증기에 접근 불가 시 안내문 + 복구 코드 입력 링크만 노출.

---

## 4. 비밀번호 재설정 (Forgot Password)

### 4.1 Step 1: 이메일 입력

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    Reset your password           │
│                                  │
│    Enter the email associated    │
│    with your account             │
│                                  │
│    Email: [______________]       │
│                                  │
│    [    Send Reset Link     ]    │
│    [    ← Back to Sign In   ]   │
└──────────────────────────────────┘
```

- `POST /api/auth/forgot-password { email }`
- **성공/실패 모두 동일 안내 화면** 표시 (이메일 존재 여부 노출 방지)

### 4.2 Step 2: 안내 화면

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    📧 Check your email           │
│                                  │
│    If an account exists for      │
│    gehrig@example.com,           │
│    we sent a password reset      │
│    link.                         │
│                                  │
│    [   Resend Email   ]  (계획)  │
│    [   ← Back to Sign In   ]    │
└──────────────────────────────────┘
```

> **미구현 (Planned)**: 위 Resend Email 버튼은 아직 없다. 현재 안내 화면(`codebase/frontend/src/components/auth/forgot-password-form.tsx`)은 "Back to login" 링크만 노출한다 (`POST /api/auth/forgot-password` 자체는 재요청 시 동일하게 재호출 가능하나 전용 Resend UI 미배선).

### 4.3 Step 3: 새 비밀번호 입력

이메일의 재설정 링크 클릭 시 표시:

```
┌──────────────────────────────────┐
│           [Logo]                 │
│                                  │
│    Set new password              │
│                                  │
│    New Password:                 │
│    [______________]              │
│    (패스워드 강도 바)              │
│                                  │
│    Confirm Password:             │
│    [______________]              │
│                                  │
│    [    Reset Password     ]     │
└──────────────────────────────────┘
```

- `POST /api/auth/reset-password { token, newPassword }`
- 성공 → "Password updated. Sign in with your new password." + 로그인 화면으로 이동
- 토큰 만료/무효 → "This link has expired. Request a new one." + 재요청 링크
- 재설정 토큰 유효기간: 30분
- 사용 후 토큰 즉시 무효화

---

## 5. OAuth 소셜 로그인

### 5.0 활성화된 Provider 노출

회원가입·로그인 화면 진입 시 서버에서 `GET /api/auth/oauth/providers` 를 호출하여 현재 자격증명이 설정된 provider 목록을 받는다.

| 응답 | UI 동작 |
|------|---------|
| `{ data: { providers: ["google", "github"] } }` | "Or continue with" 구분선과 두 버튼 모두 표시 |
| 일부만 포함 (예: `["google"]`) | 해당 버튼만 단일 컬럼으로 표시 |
| 빈 배열 `[]` | 구분선과 버튼 모두 비표시 (이메일/비밀번호 폼만 노출) |

- Provider 활성화 기준: `OAUTH_STUB_MODE=true` (개발) 또는 `{PROVIDER}_CLIENT_ID` 환경변수가 설정된 경우
- 응답은 `Cache-Control: private, max-age=300` 으로 5분 캐싱 (Next.js Server Component `fetch` 의 `revalidate: 300` 와 정합; 공유 캐시 비저장을 위해 `private`, `codebase/backend/src/modules/auth/auth.controller.ts` `@Header`)
- 이 API 호출이 실패하면 안전 기본값으로 빈 배열 처리하여 SSO UI 비표시 (이메일/비밀번호 로그인은 정상 동작)

### 5.1 플로우

```
┌─────────┐     ┌─────────────┐     ┌────────────┐     ┌──────────┐
│ 클라이언트│────→│ 서버         │────→│ OAuth 제공자│────→│ 콜백 처리 │
│ (버튼)   │     │ /auth/oauth/ │     │ (Google 등)│     │          │
│          │     │ :provider   │     │            │     │          │
└─────────┘     └─────────────┘     └────────────┘     └──────────┘
     │                                                        │
     │              5. JWT 발급 + 리다이렉트                    │
     │←──────────────────────────────────────────────────────│
```

### 5.2 상세 단계

| 단계 | 동작 |
|------|------|
| 1 | 사용자가 "Continue with Google/GitHub" 버튼 클릭 |
| 2 | `GET /api/auth/oauth/:provider` → 서버가 OAuth URL 생성 (`state` 파라미터 포함) |
| 3 | 브라우저를 OAuth 제공자의 인증 페이지로 리다이렉트 (또는 팝업) |
| 4 | 사용자가 OAuth 제공자에서 인증 승인 |
| 5 | OAuth 제공자가 `GET /api/auth/oauth/:provider/callback?code=...&state=...`로 리다이렉트 |
| 6 | 서버가 `code`로 토큰 교환 → 프로필 조회 → 사용자 조회/생성 |
| 7 | JWT 발급 → 프론트엔드 리다이렉트 URL로 이동 (토큰은 HttpOnly Cookie) |

### 5.3 OAuth 콜백 처리 상세 (`/api/auth/oauth/:provider/callback`)

| 단계 | 처리 |
|------|------|
| state 검증 | 서버가 생성한 state 값과 일치하는지 확인 (CSRF 방지) |
| 코드 교환 | `code` → OAuth 제공자 토큰 엔드포인트에서 `access_token` 교환 |
| 프로필 조회 | `access_token`으로 사용자 프로필(이메일, 이름, 아바타) 조회 |
| 사용자 매칭 | 이메일로 기존 사용자 검색 |
| 기존 사용자 | OAuth 프로바이더 정보 연결 → 로그인 처리 |
| 신규 사용자 | 자동 회원가입 → 개인 워크스페이스 생성 → 로그인 처리 |
| JWT 발급 | Access Token + Refresh Token 발급 |
| 리다이렉트 | `{frontend_url}/callback?success=true` — **access token 은 URL 에 싣지 않는다**. Refresh Token 만 httpOnly Cookie 로 설정하고, 콜백 페이지가 `POST /api/auth/refresh`(refresh 쿠키 사용)로 access token 을 발급받아 메모리에 적재한다 (decision A, 2026-05-31 — URL history/Referer/프록시 로그 노출 차단). |

### 5.4 OAuth 에러 처리

| 에러 | 처리 |
|------|------|
| state 불일치 | `{frontend_url}/callback?error=invalid_state` |
| 코드 교환 실패 | `{frontend_url}/callback?error=token_exchange_failed` |
| 이메일 미제공 | `{frontend_url}/callback?error=email_required` (GitHub private email 등) |
| 서버 오류 | `{frontend_url}/callback?error=server_error` |

프론트엔드의 `/callback` 페이지:
- `success=true` → `refreshAccessToken()`(`POST /api/auth/refresh`)로 access token 발급 → 메모리 적재 → 대시보드(`/dashboard`)로 리다이렉트. refresh 실패 시 에러 표시.
- `error=*` → 에러 메시지 표시 + "다시 시도" 버튼 + 로그인 화면 링크

---

## 6. 첫 워크스페이스 자동 생성

### 6.1 트리거 조건

아래 경우에 개인 워크스페이스가 자동 생성된다:

| 경로 | 조건 |
|------|------|
| 이메일 회원가입 | 이메일 인증 완료 시 **(단, `invitationToken` 으로 가입한 경우 제외 — 초대된 워크스페이스로 진입)** |
| OAuth 소셜 로그인 (최초) | 신규 사용자 자동 가입 시 |

> 초대 토큰으로 가입한 사용자는 초대된 팀 워크스페이스에 곧바로 멤버로 추가되므로 별도의 개인 워크스페이스를 자동 생성하지 않는다. 이후 사용자가 개인 워크스페이스를 원하면 워크스페이스 관리 화면에서 직접 만들 수 있다.

### 6.2 생성 규칙

| 항목 | 값 |
|------|-----|
| Workspace.name | "{사용자 이름}'s Workspace" |
| Workspace.slug | 사용자 이메일 로컬 파트 + 랜덤 4자리 (예: `gehrig-a1b2`) |
| Workspace.type | `personal` |
| WorkspaceMember.role | `owner` |
| Workspace.timezone | 브라우저 타임존 (Accept-Language 헤더에서 추론) 또는 `UTC` |

---

## 7. 인증 상태 관리

### 7.1 라우트 가드

인증 페이지는 Next.js route group `(auth)` 로 묶여 URL 세그먼트에 `/auth` 접두사가 붙지 않는다 → 실제 경로는 `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/callback`.

| 라우트 | 인증 필요 | 미인증 시 |
|--------|-----------|-----------|
| `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` 등 `(auth)` 그룹 | X | — |
| `/callback` (OAuth 콜백) | X | — |
| 그 외 모든 라우트 | O | `/login`으로 리다이렉트 (원래 URL을 `redirect` 파라미터에 보존; `codebase/frontend/src/components/auth/auth-provider.tsx`) |

### 7.2 로그인 후 리다이렉트

- 로그인 성공 시 `redirect` 파라미터가 있으면 해당 URL로 이동
- 없으면 기본: `/dashboard` (대시보드)

### 7.3 로그아웃

1. `POST /api/auth/logout` 호출 (Refresh Token 무효화)
2. 클라이언트: Access Token 메모리에서 제거, Cookie 삭제
3. `/login`으로 리다이렉트

---

## 8. API 엔드포인트

기존 [Spec 인증/인가](../5-system/1-auth.md#5-api-엔드포인트) 엔드포인트에 추가:

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/auth/register | 회원가입 (본문에 `invitationToken?` 동봉 시 [§2.6](#26-초대-토큰을-통한-가입-invitationtoken) 흐름) |
| GET | /api/invitations/:token | 초대 토큰 메타 조회 (가입 페이지 prefill 용, 인증 불요) |
| POST | /api/auth/verify-email | 이메일 인증 확인 (본문: `{ token }`) |
| POST | /api/auth/resend-verification | 인증 이메일 재발송 — **미구현 (Planned)**, 백엔드 핸들러 부재. 추적: `plan/in-progress/spec-sync-auth-flow-gaps.md` |
| POST | /api/auth/login | 로그인 (2FA 활성 시 `{ requires2fa, methods, challengeToken }` 응답) |
| POST | /api/auth/login/totp | 2FA TOTP 검증 (`{ challengeToken, code }`) — 옛 `/api/auth/verify-2fa` 표기는 폐기, canonical 정의는 [auth spec §5](../5-system/1-auth.md#5-api-엔드포인트) |
| POST | /api/auth/2fa/webauthn/authenticate/options · /verify · /recovery | WebAuthn 2FA 흐름. canonical 정의는 [auth spec §5](../5-system/1-auth.md#5-api-엔드포인트) |
| POST | /api/auth/logout | 로그아웃 |
| POST | /api/auth/refresh | 토큰 갱신 |
| POST | /api/auth/forgot-password | 비밀번호 재설정 요청 |
| POST | /api/auth/reset-password | 비밀번호 재설정 |
| GET | /api/auth/oauth/providers | 활성화된 OAuth provider 목록 (UI 노출 제어용, 5분 캐싱) |
| GET | /api/auth/oauth/:provider | OAuth 시작 (리다이렉트) |
| GET | /api/auth/oauth/:provider/callback | OAuth 콜백 |
| POST | /api/auth/check-email | 이메일 중복 확인 (가입 폼 실시간 검증용) |

---

## Rationale

### R-1. 인증 화면 배경 — 브랜드 그래디언트

§1 배경은 *"제품 브랜드 색상 또는 그래디언트"* 를 사용한다. 코드 상태: `codebase/frontend/src/app/(auth)/layout.tsx` 는 `bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--muted))] to-[hsl(var(--background))]` 패턴 — Shadcn neutral 그라데이션. 로고는 `<Logo theme="auto">` 로 wrapper bg/rounded 없이 그라데이션 surface 위에 직접 배치 (라이트/다크 자산 선택은 brand spec §8.4 가 결정).

### R-2. `[Logo]` 자리 변종

§1 의 `[Logo]` 플레이스홀더는 *"Full logo 변종"* 을 사용한다. 본 문서는 로고가 노출되는 **자리**를 정의하고, 자리에 들어가는 변종·라이트/다크 선택은 brand spec §8.4.1 매트릭스 + §8.4.6 의 노출 자리 규정을 따른다 (brand spec §8.4.6 — 브랜드 spec 의 라우트 spec 우선권).
