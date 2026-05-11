# Spec: 인증/인가 시스템

> 관련 문서: [PRD 비기능 요구사항](../../prd/5-non-functional.md#2-보안) · [Spec 아키텍처 개요](../0-overview.md) · [Spec 사용자 프로필](../2-navigation/9-user-profile.md) · [데이터 모델 - User](../1-data-model.md#21-user)

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

| 항목 | 설명 |
|------|------|
| 방식 | TOTP (Time-based One-Time Password) |
| 앱 호환 | Google Authenticator, Authy 등 |
| 설정 플로우 | QR 코드 표시 → 인증 앱 스캔 → 6자리 코드 입력 확인 |
| 백업 코드 | 10개 일회용 복구 코드 생성 및 다운로드 |
| 비활성화 | 현재 코드 입력 후 비활성화 |

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
| 강제 종료 재인증 | 비밀번호 재확인 필수. OAuth-only 사용자는 2FA TOTP 또는 이메일 OTP 로 대체 |
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
| totp_failed | 2FA 코드 검증 실패 |
| logout | 사용자가 `/auth/logout` 호출 → 호출 디바이스 family 전체 revoke |
| session_revoked | 사용자가 활성 세션 목록에서 다른 family 강제 종료 |
| token_reuse_detected | revoke된 refresh token 재사용 감지 → family 전체 revoke |

보존: **180일** 경과 row 는 일일 배치(`@Cron('0 3 * * *')`)로 자동 삭제. 조회는 사용자 본인만 가능하며 워크스페이스 관리자에게는 노출되지 않는다.

---

## 5. API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/auth/register | 회원가입 |
| POST | /api/auth/login | 로그인 |
| POST | /api/auth/logout | 로그아웃 (호출 디바이스 family 전체 revoke) |
| POST | /api/auth/refresh | 토큰 갱신 |
| POST | /api/auth/forgot-password | 비밀번호 재설정 요청 |
| POST | /api/auth/reset-password | 비밀번호 재설정 |
| GET | /api/auth/oauth/:provider | OAuth 시작 |
| GET | /api/auth/oauth/:provider/callback | OAuth 콜백 |
| GET | /api/audit-logs | 감사 로그 조회 (Admin+) |

사용자 본인 세션·이력 관리 엔드포인트는 [사용자 프로필 spec §6.1](../2-navigation/9-user-profile.md#61-사용자워크스페이스-api) 에 정의 (`/api/users/me/sessions`, `/api/users/me/login-history`).
