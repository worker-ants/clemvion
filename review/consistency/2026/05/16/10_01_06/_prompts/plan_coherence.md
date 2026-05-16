# Plan 정합성 Check Payload

본 파일은 orchestrator 가 Plan 정합성 checker 용으로 작성한 입력입니다. `plan/in-progress/**` 의 진행 중 작업·미해결 결정과 target 문서가 정합한지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (Plan 정합성)

1. **미해결 결정과의 충돌** — target 이 plan 에서 "결정 필요" 로 남겨둔 항목과 충돌하는 결정을 일방적으로 내리고 있지 않은가
2. **중복 작업** — target 이 이미 다른 plan 에서 진행 중인 작업과 동일한 영역을 손대고 있는가 (병렬 worktree 경합 위험)
3. **선행 plan 미해소** — target 이 가정하는 사전 조건이 plan 에서 아직 해결되지 않았는가
4. **후속 항목 누락** — target 변경이 다른 plan 의 후속 항목을 무효화하거나 새로 만들어야 하는데 반영되지 않았는가
5. **worktree 충돌** — 동일 spec 파일을 target plan 과 다른 worktree 가 동시에 손대고 있는지 (plan frontmatter `worktree` 필드 확인)

## 검토 모드
구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)

## Target 문서
경로: `spec/5-system/`

```
### 구현 대상 영역: `spec/5-system/`

#### `spec/5-system/1-auth.md`
```
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

| 항목 | 설명 |
|------|------|
| 방식 | TOTP (Time-based One-Time Password) |
| 앱 호환 | Google Authenticator, Authy 등 |
| 설정 플로우 | QR 코드 표시 → 인증 앱 스캔 → 6자리 코드 입력 확인 |
| 백업 코드 | 10개 일회용 복구 코드 생성 및 다운로드 |
| 비활성화 | 현재 코드 입력 후 비활성화 |

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
| 발송 채널 | 시스템 SMTP (`backend/src/modules/mail/`) 만 사용. 워크스페이스 SMTP Integration 은 **사용하지 않음** | 운영 단순화. 자세한 근거는 [Rationale §1.5.B](#rationale) |
| Rate Limit | 워크스페이스·invited_by 단위 분당 N회 (구현 시 결정) | 이메일 폭격 방지 |

#### 1.5.2 흐름 (미가입자 가입 경로)

```
1. Admin+ 가 POST /api/v1/workspaces/:id/invitations { email, role }
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

`backend/src/modules/mail/` 는 현재 시스템 전역 SMTP 만 지원한다. 워크스페이스 단위 SMTP Integration 을 초대 메일에도 사용할지 검토했지만, 다음 이유로 시스템 SMTP 만 사용한다:

- 초대는 "워크스페이스에 진입하기 전" 단계의 시스템 인입 행위에 가깝다. 워크스페이스의 비즈니스 SMTP 가 끊겨도 초대 흐름은 계속 동작해야 함.
- 워크스페이스 SMTP Integration 은 워크스페이스 내부 워크플로의 알림·메일 발송 용도로 설계되었으며, 초대 같은 시스템 메시지를 그쪽으로 흘리면 책임 경계가 흐려진다.
- 운영·디버깅이 단일 채널로 단순해진다 — 초대 메일 누락 원인을 추적할 때 시스템 SMTP 로그만 보면 됨.

### 1.5.C — 토큰 만료 7일

7일은 산업 표준이면서, "주말 끼고 가입" 같은 사용자 행동도 충분히 흡수한다. 더 짧으면 (예: 24~48시간) 재발송이 잦아져 운영 부담이 늘고, 더 길면 (14일+) 토큰 누출 시 노출 기간이 길어진다. 재발송 시 만료 시계는 새 토큰 발급 시점부터 다시 7일이므로, 특수 케이스는 재발송으로 해결한다.

```

#### `spec/5-system/10-graph-rag.md`
```
# Spec: Graph RAG

> 관련 문서: [PRD Graph RAG](./10-graph-rag.md) · [Spec RAG 검색](./9-rag-search.md) · [Spec 임베딩 파이프라인](./8-embedding-pipeline.md) · [Spec Knowledge Base 화면](../2-navigation/5-knowledge-base.md) · [Spec 데이터 모델 - KnowledgeBase / Entity / Relation](../1-data-model.md#211-knowledgebase) · [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md)

---

## Overview (제품 정의)

> 출처: `prd/9-graph-rag.md` — docs-consolidation(2026-05-12)으로 본 문서에 흡수.

> **구현 상태**: ✅ **P0~P2 구현 완료** (검증 일자: 2026-05-11). KB 모드 선택, 추출 파이프라인 (`graph-extraction` 큐 chained dispatch), Hybrid 검색 (`RagSearchService` graph 분기), Entity / Relation CRUD, 3D 그래프 시각화 (`graph-3d-renderer.tsx`) 까지 동작. 마이그레이션 `V025__graph_rag.sql` ~ `V027__relation_head_tail_index.sql` 적용. 본 문서 범위 밖 (§2.2) 의 community detection / Neo4j 등 P2 이후 항목만 미구현으로 남는다.

---

### 1. 목표

기존 vector RAG 가 단순 유사도 매칭이라 multi-hop 추론(예: "A가 만든 제품을 사용한 고객")이나 entity 중심 질의에 약하다. **문서에서 entity/relation 을 추출해 지식 그래프를 구성하고, 검색 시 vector seed → 그래프 확장 → rerank 흐름으로 답변 품질을 높이는 Graph RAG 옵션**을 제공한다.

| 구분 | 목표 |
|------|------|
| **사용자 가치** | entity 중심 질의·다단계 추론 시 답변 정확도 향상. KB 별로 vector / graph 모드 선택해 비용/품질 trade-off 직접 제어 |
| **기술 목표** | 기존 vector RAG 는 그대로 유지하면서 graph 모드를 추가. PostgreSQL 인프라 안에서 신규 의존성 없이 동작 (entity / relation / chunk_entity 관계형 테이블) |
| **제품 차별화** | LLM 기반 자동 추출 + 사용자 보정 가능한 그래프 뷰로, 지식 그래프 구축 비용을 코딩 없이 흡수 |

---

### 2. 범위

#### 2.1 본 문서 범위

| 영역 | 상태 | 기능 |
|------|------|------|
| KB 모드 선택 | ✅ | KB 생성 시 `vector` / `graph` 모드 선택 (불변). `kb-form-body.tsx` 셀렉트 + `V025__graph_rag.sql` 의 `rag_mode` 컬럼 + `chk_kb_rag_mode` CHECK |
| 그래프 추출 파이프라인 | ✅ | 문서 임베딩 완료 시 `document-embedding.processor` 가 `graph-extraction` 큐로 chained dispatch → `GraphExtractionService` 가 chunk 단위 LLM 추출 → entity / relation / chunk_entity UPSERT |
| 추출 LLM 설정 | ✅ | KB 단위 `extractionLlmConfigId` (V025 컬럼 + `kb-form-body.tsx` 셀렉트, 미지정 시 워크스페이스 default 사용) |
| Hybrid 검색 흐름 | ✅ | `RagSearchService` 가 KB `rag_mode === 'graph'` 면 분기 — vector seed → 1~2 hop recursive CTE traversal → expanded chunk 회수 → rerank |
| 추출 상태 / 통계 UI (P0) | ✅ | KB 상세에 진행률 + entity / relation 카운트 카드 (캐시 컬럼 `entity_count` / `relation_count`). 통계 갱신은 `document:graph_completed` payload 의 `entityCount` / `relationCount` 또는 REST `GET /:id/graph/stats` 폴링으로 조회 |
| Entity 목록 보정 UI (P1) | ✅ | `entity-list.tsx` / `relation-list.tsx` — 검색·정렬 + 개별 삭제 (`Delete /entities/:id`, `Delete /relations/:id`) |
| 그래프 시각화 (P2) | ✅ | `graph-3d-renderer.tsx` + `graph-visualization.tsx` — 3D / 2D 렌더링, 줌, 호버 시 chunk 미리보기 |

#### 2.2 본 문서 범위 밖

| 항목 | 사유 |
|------|------|
| Microsoft GraphRAG community detection / 글로벌 요약 | 빌드 비용·복잡도가 커서 P2 이후 |
| Apache AGE / Neo4j 도입 | 데이터 규모 임계 도달 시 검토. 현재는 PostgreSQL 관계형 + recursive CTE 로 충분 |
| 룰 기반 entity 추출 (spaCy 등) | LLM 추출 단일 경로로 시작. 도메인 적응 비용 회피 |
| KB 모드 사후 변경 (vector ↔ graph) | 마이그레이션 비용 큼. 모드 전환은 새 KB 생성으로 대체 |

---

### 3. 요구사항

#### 3.1 KB 모드 (`KB-GR-MD-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-MD-01 | KB 생성 시 검색 모드를 `vector` / `graph` 중에서 선택 (기본값: `vector`) | 필수 | ✅ |
| KB-GR-MD-02 | 모드는 생성 시점에만 결정. 사후 변경은 차단되며 변경이 필요하면 새 KB 를 만든다 | 필수 | ✅ |
| KB-GR-MD-03 | 모드 정보는 KB 목록·상세 화면에 배지로 표시 | 필수 | ✅ |

#### 3.2 그래프 추출 파이프라인 (`KB-GR-EX-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-EX-01 | `graph` 모드 KB 의 문서가 임베딩 완료(`embedding_status = 'completed'`)되면 자동으로 그래프 추출 큐(`graph-extraction`)에 dispatch | 필수 | ✅ |
| KB-GR-EX-02 | 추출 LLM 모델은 KB 의 `extractionLlmConfigId` 가 가리키는 LLMConfig 의 chat 모델을 사용 (미지정 시 워크스페이스 default LLMConfig) | 필수 | ✅ |
| KB-GR-EX-03 | 추출 단위: chunk 1개 → entity 목록 + relation 목록. 추출 결과는 KB 범위에서 dedup (이름·타입 정규화) | 필수 | ✅ |
| KB-GR-EX-04 | 추출 진행 상태는 문서별로 추적 (`graph_extraction_status`: pending / processing / completed / error / failed) | 필수 | ✅ |
| KB-GR-EX-05 | 추출 실패 시 문서 단위 재시도 가능 (KB 상세에서 "Re-extract" 액션) | 필수 | ✅ (`POST /knowledge-bases/:id/documents/:docId/re-extract`) |
| KB-GR-EX-06 | 임베딩 재실행(`reEmbed`) 또는 KB 전체 재임베딩 시 그래프도 함께 재추출 | 필수 | ✅ |
| KB-GR-EX-07 | 추출 비용을 사용자에게 표시 — 이번 추출에 사용된 토큰 수와 KB 누적 토큰 수 | 권장 | ✅ (`LlmService.chat` 가 자동으로 `LlmUsageLog` 기록 + KB 상세 토큰 통계) |
| KB-GR-EX-08 | LLM 호출 timeout (청크 90s) + 일시 오류 자동 재시도 (1s/4s/16s 백오프, 최대 3회). 비재시도성 오류는 즉시 `failed` 전환. UI 영구 "처리중" stuck 방지 | 필수 | ✅ (V037 + `retryWithBackoff`) |
| KB-GR-EX-09 | 최종 실패한 문서를 한 번에 재큐잉 (`POST /knowledge-bases/:id/retry-failed` `{ scope: 'graph'/'embedding'/'all' }`). 재시도 카운터·error 메시지 리셋 후 큐 add | 필수 | ✅ |
| KB-GR-EX-10 | 부팅 시 `graph_last_attempted_at` 가 10분 전 이전인 `processing` 문서 자동 회수 (`StuckDocumentRecoveryService`) | 필수 | ✅ |
| KB-GR-EX-11 | 진행 박스에 실패 카운트 + 재시도 버튼 표시. WS 이벤트 (`document:graph_retry`·`graph_failed`) 로 실시간 반영 | 필수 | ✅ |

#### 3.3 데이터 모델 (`KB-GR-DM-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-DM-01 | KB 단위로 entity 를 저장. 동일 KB 안에서 `(name, type)` 으로 dedup | 필수 | ✅ (V025 `uq_entity_kb_name_type`) |
| KB-GR-DM-02 | KB 단위로 relation 을 저장. (`head_entity_id`, `predicate`, `tail_entity_id`) 복합 unique | 필수 | ✅ (V025 `uq_relation_kb_head_pred_tail` + V027 인덱스) |
| KB-GR-DM-03 | chunk → entity 매핑(`chunk_entity`)으로 검색 시 chunk 회수 가능 | 필수 | ✅ (V025 `chunk_entity` 테이블) |
| KB-GR-DM-04 | entity 메타에 등장 횟수(`mention_count`) 와 마지막 등장 청크(`last_seen_chunk_id`) 보관 | 권장 | ✅ |

#### 3.4 검색 흐름 (`KB-GR-SR-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-SR-01 | KB.rag_mode 가 `graph` 면 RagSearchService 가 graph 검색 흐름으로 분기 | 필수 | ✅ |
| KB-GR-SR-02 | 검색 1단계: query 임베딩 → KB 의 chunk 에서 vector top-K (`vectorSeedTopK`, 기본 5) 회수 | 필수 | ✅ |
| KB-GR-SR-03 | 검색 2단계: 회수된 chunk 가 언급한 entity 들에서 1~`maxHops` (기본 1) 까지 그래프 확장 | 필수 | ✅ (recursive CTE) |
| KB-GR-SR-04 | 검색 3단계: 확장된 entity 들이 등장한 chunk 를 추가 회수 (총 chunk 수는 `expandedChunkLimit`, 기본 15 내) | 필수 | ✅ |
| KB-GR-SR-05 | 검색 4단계: vector seed + expanded chunk 를 score 재정렬해 상위 `topK` 반환 (graph expansion 청크는 entity centrality 기반 가중치 부여) | 필수 | ✅ |
| KB-GR-SR-06 | 검색 결과 메타데이터에 `traversedEntities`, `traversalDepth`, `seedChunkIds` 포함 | 권장 | ✅ (`GraphTraversalSummary` — `maxDepthUsed` 포함) |

#### 3.5 KB 검색 파라미터 (`KB-GR-PA-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-PA-01 | KB 설정에 `maxHops` (1 또는 2, 기본 1), `vectorSeedTopK` (기본 5), `expandedChunkLimit` (기본 15) 노출 | 필수 | ✅ (V025 컬럼 + KB 상세 페이지 편집 폼) |
| KB-GR-PA-02 | 파라미터 변경 시 추출/임베딩 재실행은 불필요 (검색 시점 적용) | 필수 | ✅ |
| KB-GR-PA-03 | AI Agent 노드의 KB 연동 UI 는 그대로 유지 (`ragTopK`, `ragThreshold`만 노출). 그래프 파라미터는 KB 단위에서만 제어 | 필수 | ✅ (`ai-agent.schema.ts` 에 `maxHops` / `vectorSeedTopK` / `expandedChunkLimit` 미노출 확인) |

#### 3.6 UI (`KB-GR-UI-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-UI-01 (P0) | KB 생성 폼에 모드 셀렉트 (`vector` / `graph`) + 모드별 도움말 | 필수 | ✅ |
| KB-GR-UI-02 (P0) | KB 상세 화면에 추출 진행률 배너 (`processing N/M`, `error K`) | 필수 | ✅ |
| KB-GR-UI-03 (P0) | KB 상세에 entity 수 / relation 수 통계 카드 | 필수 | ✅ |
| KB-GR-UI-04 (P1) | Entity 목록 화면 — 이름·타입·등장 횟수 컬럼, 검색·정렬, 개별 삭제 | 권장 | ✅ (`entity-list.tsx`) |
| KB-GR-UI-05 (P1) | Relation 목록 화면 — head·predicate·tail, 등장 chunk 미리보기, 개별 삭제 | 권장 | ✅ (`relation-list.tsx`) |
| KB-GR-UI-06 (P1) | 문서 상세에서 해당 문서 chunk 가 언급한 entity 목록 표시 | 권장 | ✅ (`entity-detail-dialog.tsx`) |
| KB-GR-UI-07 (P2) | 그래프 시각화 (react-flow 또는 동등) — 노드/엣지 렌더, 줌, 호버 시 chunk 미리보기 | 선택 | ✅ (`graph-3d-renderer.tsx` + `graph-visualization.tsx` — react-flow 대신 3D / 2D 렌더러 채택) |

#### 3.7 비용·관측성 (`KB-GR-OB-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-OB-01 | 추출에 사용된 LLM 토큰을 LLMUsageLog 에 기록 (기존 사용량 추적과 동일 채널) | 필수 | ✅ (`LlmService.chat` 호출 boundary 에서 자동 기록) |
| KB-GR-OB-02 | 추출 진행 / 완료 / 에러 이벤트를 WebSocket 으로 노출 (KB 상세 실시간 갱신) | 필수 | ✅ (`document:graph_started` / `_progress` / `_completed` / `_error` / `_retry` / `_failed`) |
| KB-GR-OB-03 | KB 단위 entity / relation 카운트는 캐시 컬럼으로 유지 (조회 시 매번 SELECT COUNT 회피) | 권장 | ✅ (V025 `entity_count` / `relation_count` 컬럼) |

---

### 4. 기술 결정 사항

| 항목 | 결정 | 근거 |
|------|------|------|
| 그래프 저장소 | **PostgreSQL 관계형 테이블** (`entity`, `relation`, `chunk_entity`) | 기존 인프라 그대로. 1~2 hop traversal 은 recursive CTE 로 충분 |
| 그래프 빌딩 | **LLM 추출 (BullMQ `graph-extraction` 큐)** | 기존 `document-embedding` 큐 패턴과 동일. 인프라 추가 0 |
| 추출 트리거 | **임베딩 완료 후 자동 chained** | 사용자 개입 없이 그래프가 자동 구축됨. 비용은 사후 통계로 표시 |
| 추출 LLM | **KB 단위 `extractionLlmConfigId` 신설** | 임베딩 모델과 분리해 reasoning 용 chat 모델을 따로 선택 |
| 검색 흐름 | **Hybrid (vector seed + graph expansion + rerank)** | 순수 graph traversal 은 정밀도 낮음. vector seed 가 진입점을 보장 |
| KB 모드 선택 | **생성 시 결정, 불변** | 사후 변경의 마이그레이션·UX 부담이 점진 도입의 가치를 넘어섬 |
| 검색 파라미터 노출 | **KB 단위에만** | AI Agent 노드 설정의 단순성 유지 (`ragTopK`/`ragThreshold` 만) |

---

### 5. 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|----------|------|
| NF-GR-01 | 그래프 추출 처리 속도 | 평균 30 chunk / 분 (LLM API 의존) |
| NF-GR-02 | 그래프 검색 응답 시간 | < 800ms (10만 entity·relation 기준, vector seed 포함) |
| NF-GR-03 | 추출 실패 graceful degrade | 추출 실패 chunk 는 그래프 검색 시 vector-only fallback 으로 회수 |
| NF-GR-04 | KB 당 entity 수 한계 | 100,000개 (P0). 초과 시 cleanup / community detection 필요 |
| NF-GR-05 | 토큰 사용 가시성 | 추출 토큰을 LLMUsageLog 에 기록, KB 상세에서 누적 표시 |

---

### 6. 단계별 도입 (Phase Plan)

| Phase | 범위 | 상태 | 검증 기준 |
|-------|------|------|-----------|
| **P0** | DB 마이그레이션 + 추출 큐 + 검색 분기 + 모드 선택 UI + 추출 진행 상태 | ✅ | 새 graph KB 생성 → 문서 업로드 → 자동 추출 → graph 검색 동작 |
| **P1** | Entity/Relation 목록 UI + 개별 삭제 + 사용자 보정 | ✅ | 추출 결과 검토/정정 후 검색 결과에 반영됨 |
| **P2** | 그래프 시각화 (3D/2D) | ✅ | 시각적 탐색 가능 |
| **P2+ (후속)** | community detection / 글로벌 요약 / 도메인별 entity 타입 사전 / KB 단위 prompt override | ❌ | §8 미결 항목 — 별도 PRD 로 검토 |

---

### 7. 의존성

| 의존 항목 | 현재 상태 | 비고 |
|----------|----------|------|
| BullMQ `document-embedding` 큐 | ✅ | `graph-extraction` 큐 추가 완료 (동일 패턴) |
| LLMConfig | ✅ | `V025` 에서 `extractionLlmConfigId` 컬럼 추가 완료 |
| pgvector | ✅ | vector seed 그대로 사용 |
| KB 모드 선택 UI | ✅ | `kb-form-body.tsx` 셀렉트 도입 완료 |
| AI Agent 의 KB 연동 | ✅ | 변경 없음 (`ragTopK`/`ragThreshold` 그대로) |

---

### 8. 미결 / 후속 검토

- entity 타입 사전: 도메인 비종속 (PERSON / ORG / CONCEPT / LOCATION / EVENT) 으로 시작. 사용자가 KB 별 entity 타입 사전을 정의할 수 있게 할지는 P2 검토.
- relation predicate 형식: P0 는 free-form 문자열. 정합성/검색 품질을 위해 enum 화는 P2 검토.
- 추출 prompt 의 사용자 커스터마이즈: P0 는 시스템 prompt 고정. 도메인 정확도가 부족하면 P2 에 KB 단위 prompt override 도입.
- 그래프 community detection: 구현 후 데이터 패턴을 보고 GraphRAG 스타일 클러스터 요약을 P2 에 검토.

---

## 1. 개요

Graph RAG 는 KB 의 검색 모드(`rag_mode`) 가 `graph` 일 때 활성화되는 검색 흐름이다. vector seed → graph expansion → rerank 의 Hybrid 형태로 동작하며, 기존 `vector` 모드 KB 와 동일 인프라(PostgreSQL + pgvector + BullMQ) 위에서 추가 의존성 없이 작동한다.

```
문서 업로드
  ↓
Document 레코드 생성 (status: pending)
  ↓
embedding 큐 (document-embedding) → EmbeddingService.processDocument
  ↓
embedding_status = 'completed'
  ↓
[graph KB 일 때만] graph-extraction 큐로 chained dispatch
  ↓
GraphExtractionService.extractDocument
  ↓
chunk 마다 LLM 호출 → entity / relation 추출 + dedup → DB INSERT
  ↓
graph_extraction_status = 'completed'
  ↓
WebSocket 알림 (KB 상세 실시간 갱신)
```

---

## 2. 데이터 모델

### 2.1 KnowledgeBase 추가 컬럼

[Spec 데이터 모델 §2.11](../1-data-model.md#211-knowledgebase) 의 KnowledgeBase 에 다음 컬럼이 추가된다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `rag_mode` | Enum | `vector` (default) / `graph`. **생성 시에만 결정, 사후 변경 불가** |
| `extraction_llm_config_id` | UUID? | 그래프 추출에 사용할 LLMConfig 의 chat 모델. NULL 이면 워크스페이스 default LLMConfig |
| `max_hops` | Integer | 검색 시 그래프 확장 깊이 (1 또는 2, default 1). `vector` 모드에서는 무시 |
| `vector_seed_top_k` | Integer | 검색 시 vector seed 개수 (default 5). `vector` 모드에서는 무시 |
| `expanded_chunk_limit` | Integer | graph expansion 후 회수할 청크 상한 (default 15). `vector` 모드에서는 무시 |
| `entity_count` | Integer | KB 의 entity 총 수 (캐시) |
| `relation_count` | Integer | KB 의 relation 총 수 (캐시) |

> `rag_mode = 'vector'` 인 KB 는 graph 관련 컬럼/테이블을 사용하지 않는다. AI Agent 의 RAG 호출도 `vector` 흐름 그대로.

### 2.2 Document 추가 컬럼

[Spec 데이터 모델 §2.12](../1-data-model.md#212-document) 의 Document 에 다음 컬럼이 추가된다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `graph_extraction_status` | Enum | pending / processing / completed / error. `vector` 모드 KB 에서는 항상 `pending` 으로 두고 사용하지 않음 |

### 2.3 Entity (신규)

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `knowledge_base_id` | UUID | FK → KnowledgeBase (CASCADE) |
| `name` | String | 정규화된 entity 이름 (소문자·trim) |
| `display_name` | String | 사용자 표시용 원형 |
| `type` | String | entity 타입. P0 enum: `person` / `organization` / `concept` / `location` / `event` / `other` |
| `description` | Text? | LLM 이 추출한 짧은 설명 (옵션) |
| `mention_count` | Integer | KB 내 청크에서 언급된 횟수 (캐시) |
| `last_seen_chunk_id` | UUID? | 마지막으로 등장한 청크 (FK → DocumentChunk) |
| `created_at` | Timestamp | 첫 추출 시각 |
| `updated_at` | Timestamp | 마지막 갱신 시각 |

**제약조건**: `UNIQUE(knowledge_base_id, name, type)` — KB 안에서 동일 이름·타입 entity 는 한 row 로 통합

**인덱스**:
- `(knowledge_base_id, type)` — 타입별 조회
- `(knowledge_base_id, mention_count DESC)` — centrality 정렬

### 2.4 Relation (신규)

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `knowledge_base_id` | UUID | FK → KnowledgeBase (CASCADE) |
| `head_entity_id` | UUID | FK → Entity |
| `tail_entity_id` | UUID | FK → Entity |
| `predicate` | String | 관계 서술어 (예: "founded", "employs", "is_part_of"). P0 free-form |
| `evidence_chunk_id` | UUID? | 추출 근거 청크 (FK → DocumentChunk) |
| `weight` | Integer | 동일 (head, predicate, tail) 가 여러 chunk 에서 발견되었을 때의 누적 횟수 |
| `created_at` | Timestamp | 첫 추출 시각 |
| `updated_at` | Timestamp | 마지막 갱신 시각 |

**제약조건**: `UNIQUE(knowledge_base_id, head_entity_id, predicate, tail_entity_id)`

**인덱스**:
- `(knowledge_base_id, head_entity_id)` — head 기준 1-hop 확장
- `(knowledge_base_id, tail_entity_id)` — tail 기준 역방향 확장

### 2.5 ChunkEntity (신규)

| 필드 | 타입 | 설명 |
|------|------|------|
| `chunk_id` | UUID | PK 일부, FK → DocumentChunk (CASCADE) |
| `entity_id` | UUID | PK 일부, FK → Entity (CASCADE) |
| `mention_text` | String? | 청크에서 등장한 원형 표기 (정규화 전) |

**제약조건**: `PRIMARY KEY (chunk_id, entity_id)`

**인덱스**:
- `(entity_id)` — entity → chunk 역방향 회수 (검색 expansion 단계에서 사용)

---

## 3. 그래프 추출 파이프라인

### 3.1 큐 라우팅

`document-embedding` 큐의 worker 가 임베딩을 마치고 `embedding_status = 'completed'` 로 갱신한 직후, KB 의 `rag_mode` 가 `graph` 면 `graph-extraction` 큐로 다음 job 을 add 한다.

```
document-embedding job (completed)
  └→ if (kb.rag_mode === 'graph') queue('graph-extraction').add({ documentId, knowledgeBaseId })
```

### 3.2 GraphExtractionProcessor

`@Processor('graph-extraction', { concurrency: 2 })` (LLM 호출 비용·rate limit 고려해 임베딩보다 낮은 동시성).

1. `Document.graph_extraction_status = 'processing'` 갱신, WebSocket `document:graph_started` 발사
2. 해당 document 의 모든 chunk 를 순회 (재시도 시 기존 entity/relation 은 KB 단위 dedup 으로 자연 통합)
3. chunk 마다 LLM 호출 (`extraction_llm_config_id` 또는 default LLMConfig 의 chat 모델):
   - 시스템 prompt: entity 타입 / relation 형식 / JSON schema 강제
   - user 메시지: chunk content (max 2000 token)
   - 응답: `{ entities: [{ name, displayName, type, description? }], relations: [{ head, predicate, tail }] }`
4. 결과를 KB 단위로 dedup INSERT/UPSERT (Entity 는 `(name, type)` 충돌 시 `mention_count += 1`, Relation 은 `(head, predicate, tail)` 충돌 시 `weight += 1`)
5. ChunkEntity 매핑 INSERT (chunk_id × entity_id)
6. 진행률 WebSocket emit (`document:graph_progress`, 0~100)
7. 모든 chunk 종료 시 `Document.graph_extraction_status = 'completed'` + WebSocket `document:graph_completed`

### 3.3 추출 LLM 응답 스키마

LLM 호출 시 JSON Schema 강제:

```json
{
  "type": "object",
  "properties": {
    "entities": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "description": "정규화된 이름 (소문자·trim·동의어 통합)" },
          "displayName": { "type": "string", "description": "원문에서 등장한 자연 표기" },
          "type": {
            "type": "string",
            "enum": ["person", "organization", "concept", "location", "event", "other"]
          },
          "description": { "type": "string" }
        },
        "required": ["name", "displayName", "type"]
      }
    },
    "relations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "head": { "type": "string", "description": "head entity 의 name (정규화 형)" },
          "predicate": { "type": "string", "description": "동사·관계 서술어. snake_case 권장" },
          "tail": { "type": "string", "description": "tail entity 의 name (정규화 형)" }
        },
        "required": ["head", "predicate", "tail"]
      }
    }
  },
  "required": ["entities", "relations"]
}
```

응답 검증:
- `relation.head` / `relation.tail` 은 동일 응답 내 `entities[*].name` 에 존재해야 한다 (LLM 환각 방지). 매칭 실패 relation 은 drop 후 warn.
- entity 가 0개로 추출된 chunk 는 그래프에 영향 없음 (skip).

### 3.4 재추출

- 문서 단건: `POST /api/knowledge-bases/:kbId/documents/:docId/re-extract`
- KB 전체: `POST /api/knowledge-bases/:kbId/re-extract` — KB 의 모든 entity/relation/chunk_entity 를 삭제 후 모든 문서에 대해 큐잉
- 임베딩 재실행 (`re-embed`) 은 그래프 추출도 자동 chained (KB 가 graph 모드인 경우)

---

## 4. 검색 흐름 (Hybrid)

KB.rag_mode 별로 `RagSearchService.search()` 가 분기한다. `vector` 모드는 [Spec 9-rag-search.md](./9-rag-search.md) 그대로.

### 4.1 graph 모드 단계

```
[1] query 임베딩 (KB.embedding_model)
    ↓
[2] vector seed: vectorSeedTopK 만큼 chunk 회수 (기존 vector 검색 동일)
    ↓
[3] seed chunk 가 언급한 entity 집합 수집 (chunk_entity JOIN)
    ↓
[4] graph expansion: 1~maxHops 깊이까지 head/tail 양방향 traversal
    ↓
[5] expanded entity 들이 등장한 chunk 추가 회수 (chunk_entity 역방향)
    ↓
[6] 합쳐진 chunk 집합을 score 재정렬:
       - vector seed: 원래 cosine similarity score
       - expanded chunk: cosine similarity × centrality_weight
       - centrality_weight = log(entity.mention_count + 1) / log(MAX_MENTION + 1)
    ↓
[7] 상위 ragTopK 만 컨텍스트에 주입
```

### 4.2 SQL 흐름 (recursive CTE)

```sql
-- 1. vector seed
WITH seed AS (
  SELECT dc.id AS chunk_id, dc.content, dc.metadata,
         d.id AS document_id, d.name AS document_name,
         1 - (dc.embedding::vector(1536) <=> $1) AS score
    FROM document_chunk dc
    JOIN document d ON d.id = dc.document_id
   WHERE d.knowledge_base_id = $2
     AND d.embedding_status = 'completed'
   ORDER BY score DESC
   LIMIT $3        -- vectorSeedTopK
),
-- 2. seed entity 들
seed_entities AS (
  SELECT DISTINCT ce.entity_id
    FROM chunk_entity ce
    JOIN seed s ON s.chunk_id = ce.chunk_id
),
-- 3. graph expansion (recursive)
expanded_entities AS (
  SELECT entity_id, 0 AS depth FROM seed_entities
  UNION
  SELECT CASE WHEN r.head_entity_id = e.entity_id THEN r.tail_entity_id ELSE r.head_entity_id END,
         e.depth + 1
    FROM expanded_entities e
    JOIN relation r ON (r.head_entity_id = e.entity_id OR r.tail_entity_id = e.entity_id)
   WHERE e.depth < $4   -- maxHops
),
-- 4. expanded chunk
expanded_chunks AS (
  SELECT DISTINCT ce.chunk_id
    FROM chunk_entity ce
    JOIN expanded_entities e ON e.entity_id = ce.entity_id
)
-- 5. final select with rerank
SELECT chunk_id, content, score FROM (
  SELECT s.chunk_id, s.content, s.document_name, s.metadata, s.score, 'seed' AS origin
    FROM seed s
  UNION ALL
  SELECT ec.chunk_id, dc.content, d.name, dc.metadata,
         (1 - (dc.embedding::vector(1536) <=> $1)) * COALESCE(centrality_weight(ec.chunk_id), 1) AS score,
         'expanded' AS origin
    FROM expanded_chunks ec
    JOIN document_chunk dc ON dc.id = ec.chunk_id
    JOIN document d ON d.id = dc.document_id
   WHERE ec.chunk_id NOT IN (SELECT chunk_id FROM seed)
) t
ORDER BY score DESC
LIMIT $5;        -- ragTopK
```

> 위 SQL 은 개념 정의이며 실제 구현은 차원별 partial HNSW (V022 / V023) 와 동일 cast 표현식을 따른다.

### 4.3 출력 메타데이터

검색 응답에 graph 흐름 추적 메타가 추가된다.

```json
{
  "ragSources": [
    {
      "chunkId": "uuid",
      "documentId": "uuid",
      "documentName": "Customer FAQ",
      "chunk": "관련 텍스트 (앞 200자)...",
      "score": 0.92,
      "origin": "seed"
    },
    {
      "chunkId": "uuid",
      "documentId": "uuid",
      "documentName": "Product Manual",
      "chunk": "그래프 확장으로 회수된 텍스트...",
      "score": 0.78,
      "origin": "expanded"
    }
  ],
  "graphTraversal": {
    "mode": "graph",
    "seedChunkCount": 5,
    "traversedEntityCount": 12,
    "maxDepth": 1,
    "expandedChunkCount": 8
  }
}
```

`graphTraversal` 객체는 `mode === 'vector'` 일 때 생략된다.

---

## 5. API

### 5.1 추출 / 재추출

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/knowledge-bases/:kbId/documents/:docId/re-extract` | 문서 단건 그래프 재추출 (graph 모드 KB 에서만 유효) |
| POST | `/api/knowledge-bases/:kbId/re-extract` | KB 전체 재추출 — 모든 entity/relation/chunk_entity 삭제 후 모든 문서 재추출. `KB_REEXTRACT_IN_PROGRESS` 잠금 (재임베딩과 동일 패턴) |

### 5.2 그래프 조회 (P1)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/knowledge-bases/:kbId/entities` | entity 목록 (페이지네이션, 검색, 타입 필터) |
| GET | `/api/knowledge-bases/:kbId/entities/:entityId` | entity 상세 + 등장 chunk 목록 |
| DELETE | `/api/knowledge-bases/:kbId/entities/:entityId` | entity 삭제 (관련 relation, chunk_entity CASCADE) |
| GET | `/api/knowledge-bases/:kbId/relations` | relation 목록 (페이지네이션, head/tail 검색) |
| DELETE | `/api/knowledge-bases/:kbId/relations/:relationId` | relation 삭제 |
| GET | `/api/knowledge-bases/:kbId/graph/stats` | entity_count / relation_count / 추출 진행 상태 요약 |
| GET | `/api/knowledge-bases/:kbId/graph/visualization` | 상위 mention_count entity + relation 페이로드 (시각화 용) |

---

## 6. WebSocket 이벤트

기존 `document:embedding_*` 이벤트와 같은 패턴으로 다음을 추가한다. 채널은 `kb:{documentId}` (`spec/5-system/8-embedding-pipeline.md §8` 과 동일).

| 이벤트 | 페이로드 | 시점 |
|--------|---------|------|
| `document:graph_started` | `{ documentId, knowledgeBaseId }` | 추출 시작 |
| `document:graph_progress` | `{ documentId, progress: number, entityDelta: number, relationDelta: number }` | chunk 처리마다 |
| `document:graph_completed` | `{ documentId, entityCount, relationCount }` | 완료 |
| `document:graph_error` | `{ documentId, error: string }` | **(의미 변경, 2026-05-11)** in-flight 일시 오류 — `document:graph_retry` 또는 `graph_failed` 가 곧 따라온다. **영구 실패 신호로 사용하지 말 것** (이전 동작은 `graph_failed` 로 이관됨) |
| `document:graph_retry` | `{ documentId, attempt: number, maxAttempts: number, error: string }` | 일시 오류 후 재시도 큐잉 직전 |
| `document:graph_failed` | `{ documentId, error: string }` | 재시도 모두 소진 또는 비재시도성 오류로 최종 실패 |

---

## 7. 에러 처리

| 상황 | 처리 |
|------|------|
| 추출 LLM 호출 일시 실패 (timeout / 5xx / network / 429) | `Document.graph_extraction_status = 'error'`, `graph_retry_count++`, `graph_error_message` 갱신, WS `document:graph_retry`. 1s/4s/16s 백오프로 최대 3회 자동 재시도 |
| 추출 LLM 호출 영구 실패 (재시도 소진 또는 4xx) | `Document.graph_extraction_status = 'failed'`, WS `document:graph_failed`. 사용자 액션 (단건 `/re-extract` 또는 일괄 `/retry-failed`) 까지 유지 |
| 추출 응답 JSON 파싱 실패 | chunk 단위 silent skip + warn (LLM 응답 형식 문제는 재시도해도 동일하므로 비재시도) |
| relation 의 head/tail 가 응답 entities 에 없음 | 해당 relation drop + warn (LLM 환각) |
| graph 모드 KB 인데 entity_count = 0 (추출 미완료/실패) | 검색이 vector-only 흐름으로 자동 fallback (빈 그래프 expansion = vector top-K 와 동일) |
| `re-extract` 동시 호출 | DB 컬럼 (`reextract_status`) atomic compare-and-swap 으로 차단, 409 `KB_REEXTRACT_IN_PROGRESS` |
| 워커 정상 종료 후 `processing` 상태에서 멈춤 | `StuckDocumentRecoveryService` 가 부팅 시점에 `graph_last_attempted_at < NOW() - 10min` 인 문서를 회수해 큐 재 add |

### 7.1 Retry & Failure 정책 상세

- LLM `chat()` 호출에 `{ timeoutMs: 90_000 }` 적용 — 청크 응답 hang 시 90s 안에 즉시 reject.
- 문서 단위 `retryWithBackoff(maxRetries=3, baseDelayMs=1_000)` (1s → 4s → 16s).
- chunk_entity 정리 (`DELETE FROM chunk_entity WHERE chunk_id IN ...`) 가 추출 진입부에 있어 idempotent — 재시도 시 dedup INSERT 가 안전하게 누적됨.
- 청크 단위 LLM 재시도는 별도 적용하지 않음 (문서 단위 재시도로 단순화 — LLM 비용 vs 코드 복잡도 트레이드오프). 후속 PR 에서 정밀화 검토.

> **원칙**: 그래프 검색이 어떠한 이유로든 빈 결과를 만들 경우, vector seed 결과만으로 응답을 구성한다 (graceful degradation).

---

## 8. 비-목표

- Entity disambiguation (서로 다른 사람 동명이인 구분) — P2 검토. 현재는 `(name, type)` 일치 시 동일 entity 로 간주.
- Cross-KB graph linking — KB 간 entity 통합 검색은 P2 이후 (현재는 KB 단위로 격리).
- Graph embedding (Node2Vec 등) — 검색에 활용하지 않음 (P2 이후).
- 자동 prompt tuning — 추출 prompt 는 시스템 prompt 고정 (P2 에 KB 단위 prompt override 검토).

---

## Rationale

Graph RAG 도메인 모델 결정의 배경·근거. memory/ 에 남아있던 작업 메모를 inline 흡수한 것이며, 폐기된 대안과 1회성 분석 자료는 `plan/complete/archive/from-memory/` 를 참조.

_원본 메모: memory/graph-rag-decisions.md_

### Memory: Graph RAG 기획 결정 (2026-05-02)

#### 도메인 용어

- **Graph RAG**: 문서에서 추출한 entity/relation 으로 구성된 지식 그래프를 RAG 검색에 활용하는 방식. 본 제품에서는 vector top-K seed → 1~2 hop graph expansion → rerank 하는 Hybrid 흐름을 의미한다.
- **Entity**: 문서 chunk 에서 추출된 의미 단위 (인물, 조직, 개념, 위치, 이벤트 등). KB 단위로 dedup.
- **Relation**: 두 entity 사이의 방향성 있는 관계 (head, predicate, tail).
- **ChunkEntity**: 어느 청크가 어떤 entity 를 언급했는지 추적하는 매핑.
- **KB.rag_mode**: 검색 모드. `vector` (default) / `graph` 두 가지. **생성 시에만 결정, 사후 변경 불가.**

#### 사용자 결정 (2026-05-02)

| # | 결정 사항 | 선택 |
| --- | --- | --- |
| 1 | PRD 위치 | 별도 파일 `prd/9-graph-rag.md` |
| 2 | 모드 옵션 범위 | `vector` / `graph` 2종 (graph 안에 hybrid 통합) |
| 3 | 추출 트리거 | 임베딩 완료 후 자동 chained (사용자 개입 없이 graph-extraction 큐 dispatch) |
| 4 | UI 우선순위 | P0 = 추출 진행/완료 상태만, P1 = entity 목록 + 통계, P2 = 그래프 시각화 |
| 5 | 검색 파라미터 노출 | KB 단위에만 (maxHops, vectorSeedTopK, expandedChunkLimit). AI Agent 노드는 기존 ragTopK/ragThreshold 유지 |
| 6 | KB 모드 사후 변경 | 생성 시에만 결정 (불변). 모드 전환 필요 시 새 KB 생성 |
| 7 | 추출 LLM | KB.`extraction_llm_config_id` 필드 신설 (임베딩 모델과 별도 chat LLM 지정) |

#### 결정 근거 (요약)

- **단일 PRD 파일**: 도메인 동기/요구사항/스펙이 응집되어 한 곳에서 읽힘
- **mode 2종**: graph 안에 vector seed 가 이미 포함된 Hybrid 형태라 mode 3개로 쪼갤 가치 작음
- **자동 chained**: 사용자에게 별도 액션 강요하지 않음, 임베딩 큐 → 추출 큐 자연 흐름
- **사후 변경 불가**: vector→graph 전환은 기존 chunk 에 대한 추출 트리거가 필요해 마이그레이션이 무겁고, graph→vector 는 entity/relation 폐기. 새 KB 가 더 단순
- **추출 LLM 분리**: 임베딩 모델은 표현 학습용, 추출 모델은 reasoning 용. 비용/품질을 분리 제어 가능

#### 영향 범위

- 신규: `prd/9-graph-rag.md`, `spec/5-system/10-graph-rag.md`
- 갱신: `prd/0-overview.md`, `prd/4-integration.md`, `prd/6-phase2-ai.md`
- 갱신: `spec/1-data-model.md`, `spec/5-system/9-rag-search.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/4-nodes/3-ai/1-ai-agent.md`
- 작업 plan: `plan/complete/ai-knowledge-base/graph-rag-prd.md`

#### 비-목표 (이번 PRD 범위 밖)

- Microsoft GraphRAG community detection / 글로벌 요약 (P2 이후)
- Apache AGE / Neo4j 도입 (데이터 규모 임계 도달 시 검토)
- 룰 기반 entity 추출 (LLM 추출 단일 경로)

```

#### `spec/5-system/11-mcp-client.md`
```
# Spec: MCP Client (Model Context Protocol)

> 관련 문서: [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md) · [Spec RAG 검색 §7 확장 포인트](./9-rag-search.md#7-확장-포인트--agenttoolprovider) · [Spec 통합 관리 §5.6 MCP Server](../2-navigation/4-integration.md#56-mcp-server) · [Spec Integration 공통 §1 Integration 참조](../4-nodes/4-integration/0-common.md#1-integration-참조) · [데이터 모델 - Integration §2.10](../1-data-model.md#210-integration)

---

## 1. 개요

AI Agent 노드가 외부 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 서버의 능력(Tools / Resources / Prompts)을 LLM 의 도구 호출 인터페이스로 노출해 활용할 수 있도록 하는 클라이언트 추상화 계층.

**위치**: AI Agent 노드 핸들러 내부의 `AgentToolProvider` 구현체(`McpToolProvider`)와, 그 하위에서 MCP 프로토콜 통신을 담당하는 `McpClientService` 모듈로 구성된다. 외부 프로토콜·인증·세션을 모두 캡슐화하여 AI Agent 핸들러는 KB 검색과 동일한 추상화로 MCP 도구를 다룬다.

**범위**:
- LLM 의 능동적 tool calling 으로만 호출 (KB 와 동일 — 핸들러가 prefill 하지 않음)
- 워크스페이스 공용 자원 (사용자 개인 MCP 서버는 본 spec 의 범위 밖)
- 외부 서버용 **Streamable HTTP (SSE)** transport (§2.1) + 내부 모듈용 **Internal Bridge** transport (§2.3). stdio·websocket 미지원

**MVP 미포함**:
- stdio MCP 서버 spawn (멀티테넌트 SaaS에서 프로세스·보안 격리 부담)
- MCP `prompts/get` 결과를 systemPrompt 슬롯에 정적으로 핀하는 UX
- MCP server-to-server proxy / 응답 캐싱 레이어
- MCP 서버 헬스체크의 자체 cron (만료 스캐너 §11.1 의 token_expires_at 흐름은 사용 안 함)

---

## 2. Transport

본 클라이언트는 두 종류의 transport 를 지원한다 — **외부 서버용 HTTP transport** 와 **내부 모듈용 Internal Bridge**. 두 transport 모두 `IMcpClient` 인터페이스를 구현하여 AI Agent 핸들러가 차이를 신경 쓰지 않는다.

### 2.1 Streamable HTTP (외부 서버용)

`service_type='mcp'` Integration 에 적용. MCP 의 **Streamable HTTP** transport 만 지원한다.

| 항목 | 동작 |
|------|------|
| 엔드포인트 | Integration `credentials.url` 의 단일 URL — 클라이언트 → 서버는 `POST`, 서버 → 클라이언트는 `GET` + `text/event-stream` |
| 세션 | 서버가 `Mcp-Session-Id` 응답 헤더로 발급하면 이후 모든 요청에 동일 헤더로 echo. 발급되지 않으면 stateless 모드 |
| 프로토콜 버전 | 클라이언트 SDK 가 협상. 서버가 미지원 버전을 거부하면 `INTEGRATION_NOT_CONNECTED` 로 격하 |
| 인증 | HTTP 헤더 (§3.2 `auth_type` 별 매핑) |

### 2.2 stdio 미지원 사유

- 멀티테넌트 백엔드에서 사용자별 subprocess 를 spawn 하는 비용·보안 부담
- 임의 명령 실행 권한 노출 위험
- 워크스페이스 공용 모델과 부정합

향후 데스크톱 bridge agent 등을 통해 우회적으로 stdio 서버를 노출하는 방안은 별도 spec 으로 분리한다.

### 2.3 Internal Bridge (in-process)

**일부 first-party Integration 은 외부 MCP 서버 없이 backend in-process 모듈로 MCP 인터페이스를 노출한다.** 이는 같은 Integration 이 워크플로 노드와 AI Agent 양쪽에서 사용되는 케이스의 표준 패턴이다.

| 항목 | 동작 |
|------|------|
| 적용 service_type | 현재 `cafe24` — 향후 first-party 통합(예: Shopify, Naver Smartstore)이 같은 패턴 사용 가능 |
| 구현 형태 | backend 모듈이 `IMcpClient` 인터페이스를 구현 (예: `Cafe24McpBridge`). HTTP fetch 가 아니라 직접 함수 호출 |
| connect / initialize | no-op — 메모리 안에서 즉시 사용 가능. `capabilities` / `serverInfo` 는 정적 상수 |
| 세션 | 노드 실행 단위 mutex 만 — `Mcp-Session-Id` 헤더 불필요 |
| 인증 | Integration 의 자체 인증 (예: Cafe24 OAuth) 을 그대로 활용. `credentials.url` / `auth_type` 표(§3.2) 는 적용되지 않음 |
| SSRF 검증 | 미적용 — 외부 fetch 가 없음. base URL 의 안전성 검증은 Integration 의 `service_type` 별 로직(예: Cafe24 의 `mall_id` 유효성)이 담당 |
| Rate Limit | Integration 의 자체 wrapper (예: Cafe24 의 `Cafe24ApiClient`) 가 처리. 동일 프로세스 인스턴스 내 mutex 로 노드 호출과 공유 |

**도구 노출**: §5 의 일반 모델을 그대로 적용. `Cafe24McpBridge.listTools()` 는 Cafe24 메타데이터 테이블에서 자동 생성된 도구 목록 반환 ([Spec Cafe24 §8.1](../4-nodes/4-integration/4-cafe24.md#81-도구-이름-매핑) · [Cafe24 API Metadata 컨벤션](../conventions/cafe24-api-metadata.md)).

**capability 보고**: Internal Bridge 별로 capability 가 다를 수 있다 — Cafe24 는 `tools` 만 보고, `resources` / `prompts` 미보고. AI Agent 는 §5.1 노출 규칙에 따라 메타도구를 생성하지 않는다.

**에러 처리**: §8 의 에러 vocabulary 그대로 적용. Cafe24 의 경우 `tool_result.error` 의 `code` 는 Cafe24 노드 §6 의 vocabulary (`CAFE24_AUTH_FAILED` 등)를 그대로 사용하며, `mcpDiagnostics.errors` 에는 동일하게 누적된다.

> Internal Bridge 도 §8.4 의 인증 실패 자동 status 전환 정책을 따른다 — 401/403 응답 시 `Integration.status = error(auth_failed)` 로 전이.

---

## 3. Integration 모델

MCP 서버는 **신규 노드가 아니라** 기존 Integration 엔티티의 새 `service_type` 으로 등록된다 ([데이터 모델 §2.10](../1-data-model.md#210-integration)). 별도 테이블·컬럼은 추가하지 않는다.

### 3.1 service_type / auth_type

본 절(§3) 의 `service_type='mcp'` 와 `auth_type` / `credentials` 스키마는 **외부 HTTP transport (§2.1) 한정**이다. Internal Bridge (§2.3) 로 노출되는 service_type 은 자체 인증 모델을 사용한다.

| 필드 | 값 (외부 HTTP) |
|------|----|
| `Integration.service_type` | `mcp` |
| `Integration.auth_type` | `bearer_token` / `api_key` / `none` |
| `Integration.scope` | 기본 `organization` (개인 등록 미지원) |

**Internal Bridge 적용 service_type** (현재):

| service_type | Bridge 구현 | spec |
|---|---|---|
| `cafe24` | `Cafe24McpBridge` | [Spec Cafe24 §8 AI Agent 노출](../4-nodes/4-integration/4-cafe24.md#8-ai-agent-노출-internal-mcp-bridge) |

### 3.2 credentials JSONB 스키마

`auth_type` 에 따라 다음 필드를 갖는다 — 모든 비밀 필드는 [Integration §5.6](../2-navigation/4-integration.md#56-mcp-server) 의 정책으로 AES-256-GCM 암호화된다.

| `auth_type` | 필드 | 비밀 |
|-------------|------|------|
| 공통 | `url` (https URL, 필수) | × |
| 공통 | `default_headers` (Record<string,string>?) | × |
| `bearer_token` | `token` | 🔒 |
| `api_key` | `header_name` (e.g. `X-Api-Key`), `value` | `value` 만 🔒 |
| `none` | — | — |

> **본 §3.2 의 URL 검증 / SSRF 정책은 외부 HTTP transport (§2.1) 한정.** Internal Bridge (§2.3) 는 외부 fetch 가 없으므로 적용되지 않는다.
>
> `url` 은 **HTTPS 강제** (테스트 연결 시 `https://` 시작 검증, 미충족 시 `MCP_HTTPS_REQUIRED`). 호스트가 다음 중 하나에 해당하면 동일한 코드로 차단된다 (SSRF 방어):
>
> - loopback (`127.0.0.0/8`, `::1`) / link-local (`169.254.0.0/16`, `fe80::/10`)
> - RFC 1918 사설 대역 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
> - IPv6 unique-local (`fc00::/7`)
> - cloud metadata 호스트명 (`metadata.google.internal`, `metadata.azure.com` 등)
>
> 호스트명이 IP literal 이 아닐 경우 즉시 차단하지는 않지만 (DNS 결과를 기다리지 않음), connect 단계에서 SDK 가 시도하는 실제 fetch 가 사설망 IP로 해석되더라도 transport 가 동일 검증을 1회 더 수행한다. 본 룰은 [Spec API §SSRF 가이드](./2-api-convention.md) 의 일반화이며, MCP 등록 단계에서 일관 적용된다.
>
> **로컬 개발 escape hatch** — 환경변수 `MCP_ALLOW_INSECURE_URL=true` 가 설정되면:
>
> - `http://` URL 허용 (단 `file://` / `ws://` 등 다른 scheme 은 여전히 거부)
> - 위 SSRF 호스트 블록리스트 전체 우회 (loopback / RFC 1918 / cloud metadata 모두 등록 가능)
>
> 본 토글은 운영 환경에서 절대 활성화해서는 안 된다 — 워크스페이스 admin 이 등록한 URL 을 그대로 신뢰하게 되어 SSRF 방어 표면이 다시 열린다. 기본값 `false`. `backend/.env.example` 에 경고와 함께 명시.

### 3.3 capabilities 캐시 (선택)

`Integration.last_error` 와 별개로, 서버 등록 시 1회 `initialize` 응답의 `capabilities` 객체를 `credentials.cached_capabilities` (write-only로 처리하지 않음, 메타데이터) 에 저장해 노드 설정 UI 의 즉시 미리보기에 활용할 수 있다. **저장된 capabilities 는 hint 일 뿐, 실제 실행 시점에 다시 조회한 결과를 우선한다.**

> `cached_capabilities` 는 **외부 HTTP transport (§2.1) 전용**. Internal Bridge (§2.3) 는 capability 가 정적 상수이므로 캐시 불필요 (`Cafe24McpBridge` 는 `tools` capability 만 hardcoded 보고).

---

## 4. Connection Lifecycle

### 4.1 단위

**AI Agent 노드 실행 1회 = MCP 세션 1회**. 노드 실행 시작 시 `mcpServers` 에 등록된 각 Integration 에 대해 lazily connect 하고, 노드 실행 종료(또는 multi-turn `waiting_for_input` 진입) 시 close.

| 시점 | 동작 |
|------|------|
| AI Agent `execute` 진입 | `mcpServers` 목록만 조회 (connect 지연) |
| `buildTools` 첫 호출 | 각 서버에 대해 connect → `initialize` → capabilities 검사 → `tools/list` (+ resources/prompts capability 보고 시 each list) |
| LLM 이 `mcp_*` tool 호출 | 동일 세션에서 `tools/call` (또는 메타도구 §6) |
| 노드 종료 / `waiting_for_input` | 모든 세션 close. 재개(resume) 시 `mcpServers` config 로부터 결정론적으로 재연결 |
| Multi-turn 동일 노드의 turn N+1 | 동일 세션 유지 (waiting 진입하지 않은 인-메모리 turn 의 경우) |

### 4.2 재연결 / 재개

Multi-turn AI Agent 가 `waiting_for_input` 상태로 일시 중단되면 세션은 close 되며 사용자 메시지 수신 후 재개 시점에 동일한 `mcpServers` 로부터 새 세션을 만든다. 세션 ID 와 capability list 는 **재개 시 재조회**해도 안전한 설계이며, AI Agent 내부 상태(`messages` 등)는 영향받지 않는다.

### 4.3 동시성 / 풀링

같은 노드 실행 내에서 한 서버에 대한 connect 는 **1회**만 일어난다 (`(integrationId, executionId)` 캐시). 노드 간·실행 간 세션 공유는 하지 않는다 — 사용자 격리·세션 라이프사이클의 단순함을 위해 의도적으로 풀을 키우지 않는다.

워크스페이스 단위 동시 connect 수는 백엔드 환경 변수 `MCP_MAX_CONCURRENT_CONNECTIONS` (기본 20) 로 상한한다.

> **Internal Bridge (§2.3)**: connect / `initialize` / close 가 모두 no-op. `buildTools` 는 메모리에서 즉시 메타데이터 테이블 기반 도구 목록 생성. `tools/call` 은 직접 함수 호출. `(integrationId, executionId)` 캐시 규칙은 동일 적용 (Bridge 인스턴스가 같은 execution 내에서 1회 lazy init). `MCP_MAX_CONCURRENT_CONNECTIONS` 상한은 외부 HTTP transport 에만 카운트되며 Internal Bridge 는 별도 상한 없음.

### 4.4 타임아웃

| 단계 | 기본 타임아웃 |
|------|-------------|
| connect + initialize | 10s |
| `tools/list`, `resources/list`, `prompts/list` | 10s |
| `tools/call`, `resources/read`, `prompts/get` | 30s |

타임아웃은 환경 변수로 override 가능. 초과 시 §8 의 에러 처리에 따라 격리된다.

---

## 5. 도구 노출 모델

MCP 의 세 capability(Tools / Resources / Prompts) 를 모두 **LLM 의 도구 호출 인터페이스로 평탄화** 하여 노출한다. 이는 다음 이유로 일관성 있고 단순하다:

- LLM 이 능동적으로 호출 시점·인자를 결정 (KB 검색과 동일 모델)
- AI Agent 핸들러의 `AgentToolProvider` 추상화 그대로 재사용 가능
- 사용자 설정 UI 가 "MCP 서버 추가 + 도구 allowlist" 한 가지 흐름으로 끝남

향후 systemPrompt 에 prompt 를 정적으로 핀하거나 Resource 를 KB 와 같은 정적 컨텍스트 주입으로 다루는 변형은 별도 spec 으로 도입할 수 있다.

### 5.1 노출 규칙

서버가 `initialize` 응답에서 보고한 capability 에 따라 다음 도구가 자동 생성된다.

| MCP capability | 노출되는 LLM 도구 | 종류 |
|----------------|-----------------|------|
| `tools` (서버가 보고) | 각 tool 마다 1개 — `mcp_<sid>__<toolName>` | 일반 도구 |
| `resources` (서버가 보고) | `mcp_<sid>__list_resources`, `mcp_<sid>__read_resource` | 메타 도구 |
| `prompts` (서버가 보고) | `mcp_<sid>__list_prompts`, `mcp_<sid>__get_prompt` | 메타 도구 |

서버가 capability 를 보고하지 않으면 해당 분류의 도구는 **생성 자체를 생략**한다 (LLM 에 노출 안 됨).

### 5.2 도구 이름 규칙

모든 MCP 관련 도구는 `mcp_` prefix 를 갖는다 — AI Agent 의 기존 prefix(`tool_`, `kb_`, `cond_`) 와 충돌하지 않는다.

```
mcp_<sid>__<toolName>
mcp_<sid>__list_resources
mcp_<sid>__read_resource
mcp_<sid>__list_prompts
mcp_<sid>__get_prompt
```

| 토큰 | 정의 |
|------|------|
| `<sid>` | `Integration.id` (UUID) 의 앞 8자에서 비-`[a-z0-9]` 문자를 `_` 로 치환한 값. 워크스페이스 내 8자 충돌 시 12자로 확장 (`McpToolProvider` 가 등록 시점에 결정) |
| `<toolName>` | MCP 서버가 `tools/list` 로 보고한 원본 이름. LLM API 호환을 위해 `[^a-zA-Z0-9_]` 를 `_` 로 치환 (sanitize) |
| `__` | server ↔ tool 구분자. 단일 underscore 로는 sanitized tool name 과 분리 불가능하므로 double underscore 사용 |

**역파싱**: `McpToolProvider.matches(name)` 는 `name.startsWith('mcp_')` 만 검사하고, `execute` 단계에서 `__` 의 첫 발생 위치로 split 하여 `<sid>` 와 도구 식별자를 분리한다. 메타도구는 식별자가 예약어(`list_resources`, `read_resource`, `list_prompts`, `get_prompt`) 와 일치하는지로 분기.

### 5.3 Tools — 일반 도구

MCP `tools/list` 응답의 각 tool 을 `ToolDef` ([Spec LLM 클라이언트 §3.4](./7-llm-client.md#34-tooldef--toolcall)) 로 변환한다.

```json
{
  "name": "mcp_<sid>__<sanitized_toolName>",
  "description": "<MCP tool.description>\n\n(via MCP server: <integration.name>)",
  "parameters": <MCP tool.inputSchema>
}
```

- `inputSchema` 는 JSON Schema (MCP 표준) — 변환 없이 그대로 LLM 의 `parameters` 로 전달
- `description` 끝에 출처(서버 별칭) 를 자동 부기하여 LLM 이 같은 의미의 도구가 여러 서버에 있을 때 출처 인지 가능하게 함

#### 사용자 오버라이드 (선택)

AI Agent config 의 `mcpServers[].toolOverrides[]` ([Spec AI Agent §1 설정](../4-nodes/3-ai/1-ai-agent.md#1-설정-config)) 로 도구별 description 을 커스터마이즈할 수 있다. 이름은 변경 불가 — 호환성 유지 위함.

### 5.4 Resources — 메타 도구 2종

서버가 `resources` capability 를 보고할 때만 자동 추가.

```json
{
  "name": "mcp_<sid>__list_resources",
  "description": "List available resources on MCP server \"<integration.name>\".",
  "parameters": {
    "type": "object",
    "properties": {
      "cursor": { "type": "string", "description": "Pagination cursor (optional)" }
    }
  }
}
```

```json
{
  "name": "mcp_<sid>__read_resource",
  "description": "Read a resource by URI from MCP server \"<integration.name>\".",
  "parameters": {
    "type": "object",
    "properties": {
      "uri": { "type": "string", "description": "Resource URI (use list_resources to discover)" }
    },
    "required": ["uri"]
  }
}
```

`tool_result` 는 MCP `Resource` / `ResourceContents` 객체를 JSON 직렬화하여 그대로 전달. 텍스트는 `content[].text`, 바이너리는 `content[].blob` (base64) — LLM 의 멀티모달 입력은 별도 노드(추후) 에서 활용.

### 5.5 Prompts — 메타 도구 2종

서버가 `prompts` capability 를 보고할 때만 자동 추가.

```json
{
  "name": "mcp_<sid>__list_prompts",
  "description": "List available prompt templates on MCP server \"<integration.name>\".",
  "parameters": {
    "type": "object",
    "properties": {
      "cursor": { "type": "string", "description": "Pagination cursor (optional)" }
    }
  }
}
```

```json
{
  "name": "mcp_<sid>__get_prompt",
  "description": "Render a prompt template from MCP server \"<integration.name>\". Returns a list of messages you should incorporate into your reasoning.",
  "parameters": {
    "type": "object",
    "properties": {
      "name":      { "type": "string" },
      "arguments": { "type": "object", "description": "Prompt arguments (server-defined)" }
    },
    "required": ["name"]
  }
}
```

`get_prompt` 의 `tool_result` 는 MCP `GetPromptResult.messages` 배열을 JSON 직렬화. LLM 은 이 메시지들을 자신의 reasoning 에 통합한다 (시스템 프롬프트 슬롯에 정적으로 주입하지 않음 — MVP).

### 5.6 도구 allowlist

AI Agent config (`mcpServers[].enabledTools`) 에서 일반 도구별로 화이트리스트를 적용할 수 있다.

| 값 | 의미 |
|----|------|
| `['*']` 또는 미설정 | 서버가 노출하는 모든 일반 도구 LLM 에 노출 (기본) |
| `['toolA', 'toolB']` | 명시된 일반 도구만 노출. 서버에 없는 이름은 무시(경고만) |

**메타도구는 allowlist 의 영향을 받지 않는다** — 서버 단위 on/off 만으로 제어. (resource/prompt 별로 allowlist 를 두지 않은 이유: MCP 서버 측에서 권한 모델로 제어하는 것이 자연스럽고, AI Agent 입장에서는 capability 단위 toggle 만으로 충분.)

`mcpServers[].includeResources: false` / `mcpServers[].includePrompts: false` 토글로 capability 단위 옵트아웃 가능 — 기본은 모두 `true` (서버가 보고했다면 노출).

### 5.7 도구 호출 한도

MCP 도구 호출은 AI Agent 의 `maxToolCalls` (기본 10) 카운트에 **포함**된다 — KB tool 과 동일 정책. 한도 도달 시 loop 종료 후 마지막 LLM 응답 반환.

---

## 6. AgentToolProvider 구현 (`McpToolProvider`)

[`AgentToolProvider`](../4-nodes/3-ai/1-ai-agent.md) 인터페이스의 두 번째 구현체 (첫 번째는 `KbToolProvider`).

### 6.1 인터페이스 매핑

| 메서드 | 동작 |
|--------|------|
| `key` | `'mcp'` |
| `matches(name)` | `name.startsWith('mcp_')` |
| `buildTools(ctx)` | `ctx.config.mcpServers` 순회 → 각 서버 connect/initialize → §5 규칙으로 ToolDef[] 생성. 실패 서버는 skip하고 §8 의 진단 정보 누적 |
| `execute(call, ctx)` | `name` 에서 `<sid>` 추출 → 해당 서버 세션에서 §5.3–5.5 분기 따라 RPC 호출 → 결과를 `AgentToolResult.content` 로 직렬화 |

### 6.2 진단 누적 (`mcpDiagnostics`)

KB 의 `ragDiagnostics` 와 동일한 패턴으로, AI Agent 의 `meta.mcpDiagnostics` 에 호출 통계를 누적한다.

```json
{
  "mcpDiagnostics": {
    "attempted": true,
    "serverCount": 2,
    "toolCalls": 4,
    "resourceReads": 1,
    "promptGets": 0,
    "errors": [
      { "integrationId": "uuid", "phase": "tools/list", "code": "MCP_TIMEOUT", "message": "..." }
    ]
  }
}
```

| 필드 | 의미 |
|------|------|
| `attempted` | MCP 도구가 1번 이상 호출되었거나 노출되었는지 |
| `serverCount` | 본 노드 실행에서 성공적으로 connect 된 서버 수 |
| `toolCalls` / `resourceReads` / `promptGets` | 각 호출 누적 |
| `errors` | 서버별 부분 실패 기록 (전체 실패가 아닌 격리된 실패) |

Multi-turn 모드에서는 KB 와 동일하게 turn 단위 delta 가 `meta.turnDebug[].mcpDiagnostics` 로도 분리되어 노출된다.

---

## 7. 실행 흐름 (요약)

```
AI Agent.execute()
  ↓
[setup] config.mcpServers 조회
  ↓
[buildTools] 각 server lazy connect → initialize → tools/resources/prompts list
            → §5 규칙으로 LLM ToolDef[] 생성
            → 실패 서버는 skip + mcpDiagnostics.errors 누적
  ↓
[1st LLM call] (KB tool, MCP tool, condition tool, 그리고 일반 tool 모두 함께 노출)
  ↓
LLM 응답
  ├─ tool_use(mcp_*) → §6.1 execute → tool_result 주입 → 다음 turn
  ├─ tool_use(kb_*) → KbToolProvider 처리 (변경 없음)
  ├─ tool_use(cond_*) → 조건 처리 (변경 없음)
  └─ 일반 텍스트 → 종료
  ↓
모든 세션 close → meta.mcpDiagnostics 확정
```

---

## 8. 에러 처리

### 8.1 격리 원칙

**한 MCP 서버의 장애가 AI Agent 노드 전체를 죽이지 않는다.** KB 검색과 같은 graceful degradation 전략.

| 상황 | 처리 |
|------|------|
| `initialize` 실패 / `tools/list` 실패 / connect 타임아웃 | 해당 서버 도구는 LLM 에 **노출하지 않음**. `meta.mcpDiagnostics.errors` 에 기록. 다른 서버·KB·일반 도구는 정상 노출 |
| `tools/call` 실패 (네트워크 / 5xx / RPC error) | 해당 호출만 실패. LLM 에 `tool_result` 로 `{ "error": "<code>", "message": "..." }` 전달 → LLM 이 graceful 응답 결정. `mcpDiagnostics.errors` 에도 누적 |
| 401 / 403 (인증 실패) | 위와 동일하되 `Integration.status` 를 `error(auth_failed)` 로 갱신, `last_error` 기록. 사용자에게 reauthorize/rotate 권장 |
| 도구 인자 schema 검증 실패 | LLM 이 보낸 인자가 `inputSchema` 를 위반하면 호출 시도 없이 `tool_result.error = 'INVALID_TOOL_ARGUMENTS'` 반환 (LLM 이 다음 턴에 보정) |
| `tool_result.content` 가 너무 큼 (>100KB 텍스트 또는 >1MB 바이너리) | truncate 후 `tool_result` 끝에 `[truncated: original_size_bytes]` 마커. mcpDiagnostics 경고 |

### 8.2 에러 코드 vocabulary

`tool_result.error` 또는 `mcpDiagnostics.errors[].code` 에 사용:

| 코드 | 의미 |
|------|------|
| `MCP_CONNECT_FAILED` | TCP / TLS / DNS 실패, HTTPS 강제 위반, `initialize` RPC 실패 (프로토콜 버전 불일치 등 포함) — connect 단계의 모든 실패가 하나로 흡수된다. SDK 가 connect 와 initialize 를 하나의 호출로 묶어 처리하므로 두 단계를 의미적으로 분리하기 어려움 |
| `MCP_LIST_FAILED` | `tools/list` 등 list RPC 실패 |
| `MCP_CALL_FAILED` | `tools/call` / `resources/read` / `prompts/get` 실패 |
| `MCP_TIMEOUT` | §4.4 타임아웃 초과 |
| `MCP_AUTH_FAILED` | credential 누락/포맷 오류, 또는 401/403. `Integration.status` 갱신 동반 |
| `MCP_HTTPS_REQUIRED` | URL 이 https:// 가 아니거나, 파싱 불가, 또는 사설/내부망 호스트(SSRF 차단) — preview-test 단계에서 검출 |
| `INVALID_TOOL_ARGUMENTS` | 인자 schema 검증 실패 (호출 자체는 발생 안 함) |
| `MCP_RESPONSE_TOO_LARGE` | content 사이즈 상한 초과 (truncate 적용됨을 알림) |

`Integration.last_error` 에는 `MCP_AUTH_FAILED` 와 같은 status 전이를 유발한 에러만 기록한다 — 일반 호출 실패는 `IntegrationUsageLog` (있다면) 와 `mcpDiagnostics.errors` 로 충분.

### 8.3 IntegrationUsageLog

[Spec 통합 §14 핸들러 실행 세멘틱](../2-navigation/4-integration.md#14-연관-동작) 에서 정의한 Integration 노드의 usage 로깅 패턴은 AI Agent 의 MCP 호출에도 적용된다 — `tools/call` 1회당 1 record, `node_execution_id` 는 호출 시점의 AI Agent NodeExecution.

| 필드 | 값 |
|------|----|
| `status` | `success` / `failed` |
| `error` | 실패 시 `{ code, message }` (§8.2 vocabulary). `message` 는 2KB 로 clamp |
| `duration_ms` | RPC 호출 단위의 elapsed |

**메타 도구 (`list_resources` · `read_resource` · `list_prompts` · `get_prompt`) 는 usage 로그에 기록하지 않는다** — 외부 API 호출이라기보다 MCP 세션의 내부 discovery 흐름이며, 매 호출 기록은 Activity 탭의 신호 대비 잡음을 키운다. 추후 별도 dashboard 가 필요해지면 분리된 trace 로 도입.

`tools/list` / `resources/list` / `prompts/list` 등 buildTools 단계의 setup RPC 도 usage 로그에 기록하지 않는다.

usage 로그 쓰기는 **fire-and-forget** — `tools/call` 의 응답 반환 직후 비동기로 발사되어 핫패스를 블로킹하지 않는다. DB 쓰기 실패는 swallow + warn log.

### 8.4 인증 실패 자동 status 전환

`tools/call` 응답이 401/403 (또는 `unauthorized`/`forbidden` 메시지) 이면 다음을 동시에 수행:

1. `tool_result.error.code = MCP_AUTH_FAILED` 로 LLM 에 전달 — 사용자 경험을 위해 호출 자체는 graceful fail
2. `IntegrationUsageLog.error.code = MCP_AUTH_FAILED` 로 로그 기록
3. **`Integration.status` 를 `error` 로, `status_reason` 을 `auth_failed` 로 atomic UPDATE 전환** — 다음 노드 실행이 기동될 때 통합 관리 화면이 "Need attention" 배너로 자동 노출

자동 복구는 하지 않는다 — 토큰이 다시 유효해지면 사용자가 명시적으로 `Rotate credentials` 또는 OAuth `Reauthorize` 를 통해 `connected` 로 복귀시킨다. 자동 복구 정책을 도입하면 만료된 토큰이 일시 회복되는 race-of-clock 시나리오에서 status 가 깜빡일 수 있어 운영 가시성을 해친다.

단일 실패로 status 가 전환되는 점은 OAuth integration 의 기존 정책과 동일하며 의도적 — 임계값 (예: 3회 연속) 도입은 반복 실패 비용 증가 vs status 가시성 trade-off 분석 후 별도로 결정.

---

## 9. 연결 테스트 (Test Connection)

[Spec 통합 §3.3 Step 3](../2-navigation/4-integration.md#33-step-3-연결-테스트) 의 `POST /api/integrations/preview-test` 흐름과 동일한 방식. MCP 서비스의 테스트 절차:

1. `credentials.url` 이 `https://` 시작인지 검증 — 아니면 `MCP_INVALID_URL` (test 단계 한정 코드)
2. Streamable HTTP 클라이언트로 connect → `initialize` 호출 (10s 타임아웃)
3. 응답의 `capabilities` 와 `serverInfo` 를 메모리에 보유
4. (선택) `tools/list` 1회 호출하여 도구 카운트 미리보기 생성
5. 세션 close

성공 시 응답 body 에 다음을 포함한다 (UI 가 capability 미리보기에 사용):

```json
{
  "capabilities": { "tools": {}, "resources": {}, "prompts": {} },
  "serverInfo": { "name": "filesystem-mcp", "version": "1.2.0" },
  "preview": { "toolCount": 12, "resourceSupported": true, "promptSupported": false }
}
```

실패 시 `INTEGRATION_TEST_FAILED` (HTTP 422) + `details.code` 에 §8.2 의 vocabulary.

---

## 10. 클라이언트 라이브러리 의존성

- **Backend**: 공식 TypeScript SDK `@modelcontextprotocol/sdk` (Streamable HTTP transport 모듈) 를 사용한다. Nest.js `McpClientModule` 이 SDK 를 감싸 워크스페이스 격리·로깅·타임아웃을 주입.
- 단일 transport 사용으로 SDK import 표면을 최소화하며, stdio·websocket 모듈은 import 하지 않는다.

---

## 11. 데이터 모델 영향

신규 컬럼 / 신규 엔티티 **없음**. [Integration §2.10](../1-data-model.md#210-integration) 의 `service_type` String 컬럼에 다음 값들이 본 spec 의 영역에서 사용된다 — `mcp` (외부 HTTP transport §2.1), `cafe24` (Internal Bridge §2.3). 두 값 모두 String 컬럼이므로 enum 마이그레이션 불필요.

`IntegrationUsageLog §2.10.1` 의 사용 패턴이 양쪽 transport 모두에 적용된다 (`tools/call` 1회당 1 record).

---

## 12. 확장 포인트

- **stdio transport**: 데스크톱 bridge 또는 사내 격리 환경 한정으로 도입 가능. credentials 스키마에 `command`, `args`, `env` 추가하고 transport 분기.
- **prompt 의 정적 핀**: `mcp_<sid>__get_prompt` 결과를 systemPrompt 슬롯에 고정 주입하는 사용자 흐름. AI Agent 설정 UI 의 systemPrompt 섹션 옆에 "MCP Prompt 첨부" 추가.
- **resource 의 KB-style 정적 컨텍스트**: 특정 resource URI 를 노드 실행 시 자동으로 read 하여 `messages[].content` prefix 에 주입. `mcpServers[].pinnedResources: string[]`.
- **OAuth 2.1 (PKCE) auth_type**: `bearer_token` 만 MVP. 동적 OAuth 흐름은 [통합 §10 OAuth 콜백](../2-navigation/4-integration.md#10-oauth-콜백-엔드포인트) 패턴을 재사용해 추가 가능.
- **server-to-server proxy / 응답 캐싱**: 트래픽 분석 후 별도 spec.
- **Internal Bridge 확장**: Shopify, Naver Smartstore 등 first-party 이커머스 통합이 `cafe24` 와 동일한 §2.3 패턴으로 추가 가능. backend 에 `<Service>McpBridge` 모듈 + 메타데이터 테이블을 두고 service_type 화이트리스트(§3.1) 에 추가.

각 항목은 본 spec 의 평탄화 모델(§5) 을 깨지 않고 추가 가능하도록 설계되었다.

```

#### `spec/5-system/12-webhook.md`
```
# Spec: Webhook 트리거 시스템

> 관련 문서: [PRD Webhook](./12-webhook.md) · [Spec 트리거 목록](../2-navigation/2-trigger-list.md) · [Spec 데이터 모델](../1-data-model.md#28-trigger) · [Spec 실행 엔진](./4-execution-engine.md)

---

## Overview (제품 정의)

> 출처: `prd/8-webhook.md` — docs-consolidation(2026-05-12)으로 본 문서에 흡수.

---

### 1. 개요

외부 서비스(GitHub, Stripe 등)나 사용자 정의 시스템에서 HTTP 요청을 보내 워크플로우를 자동으로 실행하는 Webhook 트리거 기능을 정의한다. Webhook은 이벤트 기반 자동화의 핵심 진입점으로, 외부 이벤트 발생 시 실시간으로 워크플로우를 트리거한다.

---

### 2. 사용 시나리오

| 시나리오 | 설명 |
|----------|------|
| GitHub PR 이벤트 | PR 생성/머지 시 코드 리뷰 워크플로우 자동 실행 |
| 이메일 수신 | 특정 메일 수신 시 AI 에이전트 워크플로우 실행 |
| Stripe 결제 이벤트 | 결제 완료/실패 시 알림 워크플로우 실행 |
| 폼 제출 | 외부 웹 폼에서 제출 시 데이터 처리 워크플로우 실행 |
| IoT 데이터 수신 | 센서 데이터 도착 시 분석 워크플로우 실행 |

---

### 3. 요구사항

#### 3.1 Webhook 엔드포인트

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-EP-01 | 트리거별 고유한 webhook URL 자동 생성 | 필수 |
| WH-EP-02 | URL 형식: `{base_url}/api/hooks/{endpoint_path}` | 필수 |
| WH-EP-03 | HTTP POST 메서드 지원 | 필수 |
| WH-EP-04 | JSON, form-urlencoded 요청 본문 수신 | 필수 |
| WH-EP-05 | 요청 본문 전체를 워크플로우 입력 데이터로 전달 (`body`) | 필수 |
| WH-EP-05-1 | Manual Trigger 노드가 선언한 `parameters` 스키마에 따라 body에서 파라미터를 추출/검증하여 `$input.parameters` / `$params`로 제공 | 필수 |
| WH-EP-05-2 | required 파라미터 누락 또는 타입 강제 변환 실패 시 `400 Bad Request`와 누락 필드 목록 반환 | 필수 |
| WH-EP-06 | 요청 헤더 정보를 메타데이터로 전달 (`headers`, `method`, `query`) | 권장 |
| WH-EP-07 | 비활성 트리거로의 요청은 `410 Gone` 응답 반환 | 필수 |

#### 3.2 인증 및 보안

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-SC-01 | 인증 없음(공개) 옵션 | 필수 |
| WH-SC-02 | HMAC 서명 검증 (Secret 기반) | 필수 |
| WH-SC-03 | Bearer Token 검증 | 필수 |
| WH-SC-04 | 인증 실패 시 `401 Unauthorized` 응답 | 필수 |
| WH-SC-05 | Rate limiting (트리거당 분당 최대 요청 수) | 권장 |

#### 3.3 응답 및 피드백

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-RS-01 | 요청 수신 즉시 `202 Accepted` + `executionId` 반환 (비동기 실행) | 필수 |
| WH-RS-02 | 잘못된 경로의 요청은 `404 Not Found` 반환 | 필수 |
| WH-RS-03 | 요청 본문 파싱 실패 시 `400 Bad Request` 반환 | 필수 |

#### 3.4 관리

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-MG-01 | 워크플로우 에디터 또는 트리거 화면에서 webhook 트리거 생성 | 필수 |
| WH-MG-02 | 생성 시 endpoint_path 자동 생성 (랜덤 UUID 기반) | 필수 |
| WH-MG-03 | 트리거 목록에서 webhook URL 전체를 클립보드 복사 | 필수 |
| WH-MG-04 | 활성/비활성 토글로 webhook 수신 제어 | 필수 |
| WH-MG-05 | 호출 이력에서 요청 시각, 상태, 응답 코드 확인 | 필수 |

---

### 4. 비기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-NF-01 | webhook 수신 후 200ms 이내 응답 반환 (실행은 비동기) | 필수 |
| WH-NF-02 | 요청 본문 최대 크기: 1MB | 필수 |
| WH-NF-03 | 동시 다발 webhook 수신 처리 (실행 엔진은 독립적으로 동작) | 필수 |

---

## 1. 아키텍처 개요

```
외부 서비스 (GitHub, Stripe 등)
       │
       ▼  HTTP POST
┌──────────────────────────────────────┐
│  POST /api/hooks/:endpointPath       │
│  (HooksController)                   │
│                                      │
│  1. endpointPath로 Trigger 조회      │
│  2. isActive 확인                    │
│  3. 인증 검증 (AuthConfig)           │
│  4. 202 Accepted 즉시 반환           │
│  5. executionEngine.execute() 호출   │
└──────────────┬───────────────────────┘
               │ (비동기)
               ▼
┌──────────────────────────────────────┐
│  ExecutionEngineService.execute()    │
│  - Execution 레코드 생성             │
│  - 워크플로우 실행 (백그라운드)        │
└──────────────────────────────────────┘
```

---

## 2. 데이터 모델

### 2.1 기존 엔티티 활용

Webhook 트리거는 기존 `Trigger` 엔티티를 사용한다. 신규 테이블 불필요.

| 필드 | 용도 |
|------|------|
| `type` | `'webhook'` |
| `endpointPath` | URL 경로 (고유, UUID 기반 자동 생성) |
| `isActive` | 수신 활성/비활성 |
| `authConfigId` | 인증 설정 연결 (nullable) |
| `config` | 추가 설정 (JSONB) |
| `workflowId` | 실행할 워크플로우 |
| `lastTriggeredAt` | 마지막 호출 시각 |

### 2.2 config 필드 구조

```json
{
  "authType": "none" | "hmac" | "bearer",
  "secret": "hmac-secret-key",
  "bearerToken": "expected-token",
  "hmacHeader": "X-Hub-Signature-256",
  "hmacAlgorithm": "sha256"
}
```

---

## 3. API 명세

### 3.1 Webhook 수신 엔드포인트

```
POST /api/hooks/:endpointPath
```

| 항목 | 설명 |
|------|------|
| 인증 | 트리거의 authType에 따라 다름 (공개/HMAC/Bearer) |
| Content-Type | `application/json`, `application/x-www-form-urlencoded` |
| 요청 본문 최대 크기 | 1MB |

**성공 응답** (`202 Accepted`):
```json
{
  "executionId": "uuid",
  "message": "Webhook received, workflow execution started"
}
```

**에러 응답**:

| 상태 | 조건 |
|------|------|
| `400 Bad Request` | 요청 본문 파싱 실패 |
| `401 Unauthorized` | 인증 검증 실패 |
| `404 Not Found` | endpointPath에 해당하는 트리거 없음 |
| `410 Gone` | 트리거가 비활성 상태 |

### 3.2 기존 Trigger CRUD API

기존 `/api/triggers` 엔드포인트를 그대로 사용. 변경 없음.

---

## 4. 인증 방식

### 4.1 None (공개)

인증 없이 누구나 호출 가능. `endpointPath`의 UUID가 사실상 비밀 키 역할.

### 4.2 HMAC 서명

```
요청 헤더:  X-Hub-Signature-256: sha256=<hex-digest>
검증 방식:  HMAC-SHA256(secret, rawBody) === 헤더 값
```

GitHub Webhook과 동일한 방식.

### 4.3 Bearer Token

```
요청 헤더:  Authorization: Bearer <token>
검증 방식:  token === config.bearerToken
```

---

## 5. 워크플로우 입력 데이터 구조

Webhook으로 수신된 데이터는 아래 구조로 워크플로우에 전달:

```json
{
  "parameters": { "orderId": "abc", "amount": 1000 },
  "body": { "orderId": "abc", "amount": "1000", "extra": "..." },
  "headers": {
    "content-type": "application/json",
    "x-event-type": "order.created"
  },
  "query": { "key": "value" },
  "method": "POST"
}
```

| 키 | 설명 |
|----|------|
| `parameters` | Manual Trigger 노드의 `config.parameters`에 따라 **body의 동일 이름 최상위 키**에서 추출 + 타입 coerce 결과. 다운스트림에서 `$params.<name>` 또는 `$input.parameters.<name>`으로 접근. |
| `body` | 파싱된 요청 본문 (JSON 또는 form data, 원본 유지) |
| `headers` | 요청 헤더 (소문자 키) |
| `query` | URL 쿼리 파라미터 |
| `method` | HTTP 메서드 |

### 5.1 파라미터 추출 규칙

1. 워크플로우의 manual_trigger 노드에서 `config.parameters` 스키마를 조회한다.
2. 스키마가 없거나 빈 배열 → `parameters = {}` (기존 동작과 호환)
3. 스키마가 있는 경우 각 파라미터에 대해:
   - `body`가 객체인 경우: 해당 `name` 최상위 키 값을 가져옴
   - `body`가 객체가 아닌 경우: 모든 값은 미지정으로 취급
   - 값이 없고 `required=true`면 누락으로 간주 → **400 Bad Request** 반환 (body 전체가 누락 필드 목록과 함께)
   - 값이 없고 `required=false`면 `defaultValue` 사용 (없으면 `null`)
   - 타입 불일치는 `coerceToType`로 강제 변환 (실패 시 400)

### 5.2 400 응답 형식

```json
{
  "statusCode": 400,
  "message": "Invalid webhook payload",
  "errors": [
    { "field": "orderId", "reason": "missing_required" },
    { "field": "amount", "reason": "coerce_failed" }
  ]
}
```

이 경우 Execution 레코드는 생성되지 않는다.

---

## 6. 구현 파일 구조

```
backend/src/modules/hooks/
  ├── hooks.module.ts          # 모듈 정의
  ├── hooks.controller.ts      # POST /api/hooks/:endpointPath
  └── hooks.service.ts         # 트리거 조회, 인증 검증, 실행 트리거
```

- `/api/hooks/*` 경로는 JWT 인증 제외 (외부 서비스가 호출하므로)
- Rate Limiting 적용: 트리거당 60req/min
- 기존 `TriggersService.findByEndpointPath()` 재사용

---

## 7. 처리 흐름

```
1. POST /api/hooks/abc-123-def 수신
2. HooksService.handleWebhook('abc-123-def', body, headers, query)
3. TriggersService.findByEndpointPath('abc-123-def') → Trigger 엔티티
4. Trigger 없으면 → 404 Not Found
5. Trigger.isActive === false → 410 Gone
6. 인증 검증:
   a. config.authType === 'none' → 통과
   b. config.authType === 'hmac' → HMAC 서명 검증
   c. config.authType === 'bearer' → Bearer 토큰 검증
   d. 실패 → 401 Unauthorized
7. resolveTriggerParameters(workflow, body) 호출
   - required 누락 / coerce 실패 → 400 Bad Request (Execution 생성하지 않음)
8. ExecutionEngineService.execute(trigger.workflowId, { parameters, body, headers, query, method }, { triggerId: trigger.id })
   - 3번째 인자로 `triggerId`를 전달해야 생성되는 Execution 행의 `trigger_id` 컬럼이 채워지고, 결과적으로 "최근 실행" 화면에서 출처가 `webhook` 으로 분류된다.
9. Trigger.lastTriggeredAt = now → DB 업데이트
10. 202 Accepted + { executionId } 반환
```

---

## 8. 보안 고려사항

| 항목 | 대책 |
|------|------|
| 엔드포인트 유추 방지 | UUID 기반 랜덤 경로 (brute force 불가) |
| 비밀 키 저장 | `config.secret`, `config.bearerToken`은 DB에 저장 (향후 암호화 적용) |
| 본문 크기 제한 | 1MB 초과 시 `413 Payload Too Large` |
| Rate Limiting | Throttler 적용 (60req/min/trigger) |
| JWT 제외 | `/api/hooks/*` 경로는 JWT guard에서 제외 |
| CORS | webhook 엔드포인트는 CORS 제한 없음 |

---

## 9. 에러 처리

| 상황 | 처리 |
|------|------|
| 워크플로우가 삭제됨 | Trigger의 workflowId FK CASCADE로 Trigger도 삭제됨 → 404 |
| 실행 엔진 오류 | 500 Internal Server Error 반환, 에러 로깅 |
| 동시 다발 요청 | 각 요청은 독립적인 Execution을 생성하여 병렬 실행 |

---

## 10. 프론트엔드 연동

기존 트리거 목록 화면(`/triggers`)과 상세 드로어에서 webhook 정보가 이미 표시됨. 추가 UI 변경 없음:
- URL 복사 버튼 (📋)
- HTTP 메서드 표시
- 호출 이력 표시

```

#### `spec/5-system/13-replay-rerun.md`
```
# Spec: 워크플로 Re-run (재실행)

> 관련 문서: [Spec 실행 엔진 §6.3](./4-execution-engine.md#63-재실행조회-정책-replay-policy) · [Spec 실행 내역 §3.7](../2-navigation/14-execution-history.md#37-re-run-액션) · [Spec 워크플로 실행/디버깅 §10.14](../3-workflow-editor/3-execution.md#1014-re-run-진입점) · [Spec AI Assistant §4.1.2](../3-workflow-editor/4-ai-assistant.md#412-re-run-비트리거-정책) · [Spec 데이터 모델 §2.13](../1-data-model.md#213-execution) · [Spec 노드 카테고리](../4-nodes/0-overview.md#2-노드-전체-목록) · [PLAN raw config exposure](../../plan/complete/engine-raw-config-exposure.md)

---

## Overview (제품 정의)

> 출처: 본 spec 신규 작성(2026-05-13). `plan/in-progress/replay-rerun.md` 의 §1 PRD 항목을 본 문서로 흡수. 옛 `prd/` 트리는 docs-consolidation(2026-05-12)으로 spec 에 병합되었으므로 신규 PRD 도 spec/ 안에 둔다.

### 1. 배경

`spec/5-system/4-execution-engine.md §6.3` Replay 정책 표는 View / Re-run / Multi-turn resume 세 모드를 분리 정의하고 있으나, **Re-run** 만 "🚧 미구현 (future PRD)" 상태로 남아 있었다. 사용자는 실행 상세 페이지에서 "이 실행을 같은 입력으로 다시 돌려서 결과를 비교하고 싶다", "타임 의존 결과(`$now` / `random()`) 를 다시 계산하고 싶다", "디버그용으로 외부 호출 없이 흐름만 재현하고 싶다" 같은 요구를 가지지만, 본 기능 부재로 우회 (워크플로를 수동 트리거 패널에서 다시 시작) 해야 했다.

본 spec 은 Re-run 의 사용자 가치, 정책 결정(A~G), API/UI/데이터 모델 명세, 외부 부수효과 안전장치, AI Assistant 와의 경계, 기존 정책과의 관계를 한 곳에 정의한다.

### 2. 사용자 가치

| 시나리오 | Re-run 으로 얻는 것 |
| --- | --- |
| **디버그·재현** | 실패한 실행을 같은 입력으로 다시 돌려 root cause 추적. 외부 호출까지 다시 일어나는지 끄고(dry-run) 흐름만 보고 싶을 때 가드 제공 |
| **재시도** | 일시적 실패(외부 API 5xx, 네트워크 끊김)를 빠르게 한 번 더 시도. 입력 수정 없이 한 클릭 |
| **테스트** | 입력 일부만 살짝 바꿔 재실행해 결과 차이를 비교 (예: 다른 사용자 ID 로 같은 흐름 재현) |
| **타임 재계산** | `$now` / `random()` / 외부 응답에 의존하는 결과를 새 실행 시점으로 재고정 |

### 3. 본 spec 이 다루는 범위

- Re-run 의 **API 계약** (`POST /api/v1/executions/:executionId/re-run`)
- 외부 부수효과 안전장치 — **확인 모달 + dry-run 토글** (A5 결정)
- 입력 데이터 모달 UX — 원본 미리보기 + 사용자 편집 (B2)
- 데이터 모델 — `re_run_of` self-FK + `chain_id` UUID + chain 깊이 32 제한 (E3)
- 권한 — 원본 실행 시작자 + 워크스페이스 Editor+ (F)
- AI Assistant 의 Re-run 비트리거 정책 (G1)
- multi-turn / Form / Buttons 노드의 Re-run UX — 사용자 새 입력 (D1)
- 진입점 — 실행 상세 페이지 + Run Results 드로어

### 4. 본 spec 이 다루지 않는 범위 (향후 확장)

- 부분 Re-run (resume-from-failure, single-node debug) — C2/C3
- 표현식 재평가만 모드 (외부 호출 skip 안 하면서 expression 만 다시) — B3
- multi-turn 입력 재사용 (자동 진행) — D2
- AI Assistant Re-run 도구 (별도 Trust 단계) — G2
- 노드별 멱등성 키 자동 부여 — A3
- 노드별 Re-run 정책 메타 (`reRunPolicy: call/skip/confirm`) — A4

위 항목들은 §10 향후 확장 에 reference 만 둔다.

### 5. 결정 사항 (사용자 확정)

| 항목 | 결정 | 정책 ID |
| --- | --- | --- |
| A. 외부 부수효과 안전장치 | **A5** — 확인 모달 + dry-run 토글 (기본 dry-run 미활성). 외부 부수효과 노드는 카테고리 메타로 분류 | `RR-PL-01` |
| B. 입력 데이터 모드 | **B2** — 원본 미리보기 + 사용자 편집 모달이 기본. "그대로 실행" 토글로 B1 도 가능 | `RR-PL-02` |
| C. 부분 Re-run | **C1** — v1 은 전체 워크플로만 | `RR-PL-03` |
| D. Multi-turn 노드 처리 | **D1** — 사용자 새 입력 (새 multi-turn 세션) | `RR-PL-04` |
| E. Chain 추적 모델 | **E3** — `re_run_of` self-FK + `chain_id` UUID 둘 다. chain 깊이 32 제한 | `RR-PL-05` |
| F. 권한 | 원본 실행 시작자 + 워크스페이스 Editor+. dry-run 도 동일 권한 | `RR-PL-06` |
| G. AI Assistant | **G1** — Re-run 트리거 불가 (read-only 정책 유지) | `RR-PL-07` |

각 정책의 근거는 §Rationale 참조.

---

## 6. 정책 (Policy IDs)

### RR-PL-01 — 외부 부수효과 안전장치 (A5)

Re-run 은 두 단계 가드를 거친다.

1. **확인 모달** — 사용자가 "Re-run" 버튼을 누르면 모달이 열린다. 모달은 항상 다음을 보여준다:
   - 원본 실행의 기본 정보 (실행 ID, 시작 시각, 상태)
   - 본 워크플로가 포함하는 외부 부수효과 노드 수 (예: "이 워크플로는 외부 호출 노드 3개 — Send Email × 1, HTTP Request × 2 — 를 포함합니다")
   - 입력 데이터 폼 (RR-PL-02 참조)
   - "dry-run 모드" 토글 (기본 OFF)
   - "재실행" / "취소" 버튼
2. **dry-run 토글** — ON 일 때, **외부 부수효과 노드** (§7 분류 기준) 는 handler 가 외부 호출을 skip 하고 mock 출력을 반환한다. 사용자가 "외부 호출 없이 흐름만 검증" 하고 싶을 때 사용.

dry-run 이 OFF 인 일반 Re-run 은 외부 호출이 그대로 재트리거되며, 그로 인한 부수효과(이메일 재발송, HTTP 재호출 등) 는 의도된 동작이다.

### RR-PL-02 — 입력 데이터 모드 (B2)

모달의 기본 동작:
- 원본 실행의 입력 데이터를 폼으로 미리 채워 표시 (Manual Trigger 의 `parameters` 스키마 기반 폼 — 기존 [Spec 실행 엔진 §6.1.1](./4-execution-engine.md#611-트리거-입력-파라미터-seeding) `resolveTriggerParameters` 패턴 재사용)
- 사용자가 필드를 편집해 다른 입력으로 재실행 가능
- 모달 상단의 **"원본 입력 그대로 사용"** 토글 (기본 OFF — 편집 가능 상태) 을 ON 으로 두면 폼이 read-only 가 되고 "재실행" 버튼이 한 클릭 경로로 단축됨

### RR-PL-03 — 부분 Re-run 미지원 (C1)

v1 은 전체 워크플로만 Re-run 한다. 실패 노드부터 이어 실행 (resume-from-failure) 이나 단일 노드 단독 재실행 (single-node debug) 은 §10 향후 확장 으로 분리.

### RR-PL-04 — Multi-turn 노드 UX (D1)

원본 실행이 multi-turn 흐름 (AI Agent Multi Turn / Information Extractor Multi Turn / Form / Buttons) 을 거쳤어도, Re-run 은 **새로운 multi-turn 세션** 으로 시작한다. 즉:
- AI Agent Multi Turn 은 첫 turn 부터 다시 — 사용자가 새 메시지를 입력
- Form / Buttons 는 새로 입력 대기
- 원본 세션의 사용자 응답을 자동 재사용하지 않는다

이유는 §Rationale 참조 — multi-turn 입력 재사용 (D2) 은 별도 plan 으로 분리.

### RR-PL-05 — Chain 추적 모델 (E3)

각 Execution row 는 다음 두 컬럼을 추가로 갖는다 (§9 데이터 모델 참조):
- `re_run_of UUID NULL REFERENCES executions(id)` — 직계 부모 (NULL 이면 원본)
- `chain_id UUID NOT NULL` — 같은 chain 의 모든 실행을 묶는 식별자. 원본 실행은 `chain_id = id` (자기 자신)

Re-run 시 새 실행은 `re_run_of = <원본 ID>`, `chain_id = <원본 chain_id>` 로 채워진다. 즉 같은 chain 안에서 깊이가 한 단계씩 증가.

**Chain 깊이 32 제한** — `re_run_of` 를 따라 거슬러 올라가 32 단계를 초과하는 Re-run 시도는 `RERUN_CHAIN_DEPTH_EXCEEDED` 로 거부. 사용자가 새 chain 을 시작하려면 워크플로를 새로 실행하거나 원본을 직접 Re-run.

### RR-PL-06 — 권한 (F)

다음을 **모두** 만족해야 Re-run 가능:
- 호출자가 같은 워크스페이스의 멤버이고 Editor 이상 (Owner / Admin / Editor)
- 호출자가 원본 실행 (`executions.created_by`) 의 작성자이거나, 워크스페이스의 Owner / Admin

위 조건은 dry-run 모드에도 동일하게 적용된다 (안전한 모드라 해도 다른 사용자의 실행 흐름을 자동으로 재현하는 것은 정보 노출 위험).

권한 부족 시 모달은 disabled + tooltip 으로 안내. 백엔드도 동일 가드를 enforce 하고 미허가 호출은 `RERUN_PERMISSION_DENIED` 반환.

### RR-PL-07 — AI Assistant 비트리거 (G1)

Workflow AI Assistant ([Spec §4.1](../3-workflow-editor/4-ai-assistant.md#41-탐색-도구-clarify-read-only)) 의 read-only 도구 (`get_workflow_executions`, `get_execution_details`) 는 Re-run 을 트리거하지 않는다. 새 도구 (`re_run_execution` 등) 는 본 spec 에 정의되지 않으며 향후 확장 (G2) 의 Trust 단계 도입 후 별도 plan 에서 다룬다.

사용자가 Assistant 에게 "이 실행을 다시 돌려줘" 같은 요청을 하면 Assistant 는 "Re-run 은 사용자가 실행 상세 페이지에서 직접 트리거해야 합니다 (정책 RR-PL-07)" 안내 메시지로 응답한다.

---

## 7. dry-run 모드 정의

### 7.1 외부 부수효과 노드 분류

다음을 **외부 부수효과 노드** 로 분류한다 (dry-run 시 skip 대상):

| 카테고리 | 해당 노드 | `supportsDryRun` |
| --- | --- | --- |
| Integration (`4-integration/*`) | HTTP Request, Send Email, Database (write — INSERT/UPDATE/DELETE/UPSERT) | true |
| Trigger 외부 발신 | (현재 v1 트리거는 모두 수신측이므로 해당 없음) | — |

다음은 **내부 부수효과 없음** 으로 분류해 dry-run 에서도 그대로 실행한다:
- Logic, Flow, Data, AI (LLM 호출은 외부이지만 워크플로 결과 재현에 필수 — §7.3 참고), Presentation (UI 렌더링), Trigger (이미 발화된 후의 Re-run 이라 트리거 자체는 다시 발화하지 않음)
- Database (read — SELECT) 는 외부 호출이지만 부수효과가 아니므로 dry-run 에서도 그대로 호출

분류 기준은 노드 레벨 메타 `category` (`spec/4-nodes/0-overview.md §2`) 와 노드별 boolean 메타 `supportsDryRun` 를 결합. 모든 외부 부수효과 노드는 v1 에서 `supportsDryRun: true` 를 기본 제공한다 (각 핸들러가 mock 출력을 반환할 수 있어야 함).

### 7.2 dry-run 동작 명세

엔진은 노드 handler 호출 직전 ExecutionContext 에 `meta.dryRun: boolean` 을 주입한다.

- handler 가 `meta.dryRun === true` 이고 자기 노드가 외부 부수효과 카테고리이면:
  - 외부 호출을 **수행하지 않는다**
  - output 으로 mock 객체를 반환:
    ```json
    {
      "_dryRun": true,
      "skippedReason": "dry-run mode",
      "wouldHaveCalled": {
        "kind": "http_request",
        "method": "POST",
        "url": "https://api.example.com/users",
        "bodyPreview": "..."
      }
    }
    ```
  - status 는 `completed` (skip 아님 — 흐름은 정상 진행). NodeExecution row 의 `outputData` 에 위 mock 객체 그대로 저장
- handler 가 dry-run 을 지원하지 않는데 (`supportsDryRun: false`) dry-run 으로 호출되면 엔진이 진입 전에 `RERUN_DRY_RUN_NOT_APPLICABLE` 로 전체 Re-run 을 거부 (모달 단계에서 미리 검출해 dry-run 토글을 disabled + tooltip 으로 안내하는 것이 권장 UX)

### 7.3 dry-run 의 LLM 호출 정책

AI 노드 (AI Agent / Text Classifier / Information Extractor) 의 LLM 호출은 외부 호출이지만 dry-run 에서도 **그대로 수행한다** — 이유:
- LLM 응답이 다운스트림 분기 결정에 직접 쓰임 (예: AI Agent 의 tool selection, Text Classifier 의 카테고리)
- LLM 호출은 일반적으로 부수효과가 아니다 (응답을 받을 뿐, 외부 시스템 상태를 변경하지 않음)

단, AI Agent 가 호출하는 **provider tool** 중 외부 부수효과 카테고리에 속하는 도구 (예: HTTP Request 도구, Send Email 도구) 는 dry-run 시 mock 응답을 반환한다 — LLM 에는 mock 결과가 전달되고, LLM 은 이를 바탕으로 다음 turn 을 진행한다.

### 7.4 dry-run 결과 표시

Run Results 드로어와 실행 상세 페이지는 dry-run 모드로 실행된 NodeExecution 을 시각적으로 구분한다:
- 노드 카드에 `🧪 dry-run` 배지
- 출력 JSON 에 `_dryRun: true` 가 있으면 자동 강조
- chain badge 에도 "dry-run" 표기 (`#3-th re-run · dry-run`)

---

## 8. API

### 8.1 POST /api/v1/executions/:executionId/re-run

원본 실행을 기반으로 새 Execution 을 시작한다.

**Path 파라미터**:
- `executionId` (UUID, required) — 재실행할 원본 Execution ID. 같은 chain 의 임의 실행이어도 됨 (직계 부모로 잡힘)

**Request body**:
```typescript
{
  // 원본 입력을 그대로 사용할지 (true) 또는 inputOverride 를 사용할지 (false)
  // 기본 true
  useOriginalInput?: boolean;

  // useOriginalInput=false 일 때 실제 사용할 입력. Manual Trigger 의 parameters
  // 스키마와 호환. resolveTriggerParameters 와 동일한 검증을 거침
  inputOverride?: Record<string, unknown>;

  // dry-run 모드로 실행할지. 기본 false
  dryRun?: boolean;
}
```

**Response 201 Created** — 새로 생성된 Execution 이 [Spec 실행 내역 §3 상세 API 응답](../2-navigation/14-execution-history.md#3-실행-상세-페이지) 의 shape 그대로 반환되며, 다음 두 필드가 추가된다:
```typescript
{
  ...Execution,           // 기존 shape 그대로
  reRunOf: string;        // 직계 부모 Execution ID
  chainId: string;        // chain UUID
  dryRun: boolean;        // 본 실행이 dry-run 인지
}
```

**에러 코드**:

| HTTP | code | 의미 |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | 인증 토큰 없음/만료. 표준 [Spec 에러 처리](./3-error-handling.md) 규약 |
| 403 | `RERUN_PERMISSION_DENIED` | RR-PL-06 권한 미충족 (워크스페이스 멤버 아님 / Viewer / 다른 사용자의 실행이고 Owner/Admin 아님) |
| 404 | `RERUN_EXECUTION_NOT_FOUND` | `executionId` 가 존재하지 않거나 다른 워크스페이스 |
| 404 | `RERUN_WORKFLOW_DELETED` | 원본 실행의 워크플로가 삭제됨 (Re-run 의 전제 — 현재 시점 워크플로 정의 — 가 충족 불가) |
| 409 | `RERUN_CHAIN_DEPTH_EXCEEDED` | RR-PL-05 chain 깊이 32 초과 |
| 400 | `RERUN_DRY_RUN_NOT_APPLICABLE` | dry-run 요청이지만 워크플로에 `supportsDryRun: false` 노드가 포함됨 |
| 400 | `INVALID_INPUT` | `inputOverride` 가 Manual Trigger parameters 스키마와 충돌 (`resolveTriggerParameters` 가 던지는 동일 에러) |

본 엔드포인트는 [Spec API 규칙 §5](./2-api-convention.md) 의 표준 응답 envelope 와 [Spec 에러 처리](./3-error-handling.md) 의 에러 shape 를 그대로 따른다.

### 8.2 GET /api/v1/executions/:executionId/chain

같은 chain 의 모든 실행을 시간 순으로 반환 (실행 상세 페이지의 chain badge 가 사용).

**Response**: `Execution[]` — 본 chain 의 모든 row 를 `started_at ASC` 정렬. 각 항목은 위 §8.1 응답과 동일 shape (단 `nodeExecutions` 는 생략).

권한은 §RR-PL-06 과 동일. 미허가 시 `RERUN_PERMISSION_DENIED`.

---

## 9. 데이터 모델

### 9.1 executions 테이블 컬럼 추가

[Spec 데이터 모델 §2.13 Execution](../1-data-model.md#213-execution) 에 다음 두 컬럼을 추가한다:

| 컬럼 | 타입 | NULL | 설명 |
| --- | --- | --- | --- |
| `re_run_of` | `UUID` | NULL | 직계 부모 Execution. NULL 이면 본 실행이 chain 의 시작 (원본). `REFERENCES executions(id) ON DELETE SET NULL` |
| `chain_id` | `UUID` | NOT NULL | 같은 chain 의 모든 실행을 묶는 식별자. 원본 실행은 `chain_id = id` 로 자기 참조 |

**인덱스**:
- `(re_run_of)` — 단순 부모 조회용 (chain badge 의 직계 부모 표시)
- `(chain_id, started_at)` — chain 전체 조회용 (`/chain` 엔드포인트가 자주 사용)

**불변식**:
- 원본 실행은 `chain_id = id` 를 만족 (마이그레이션·INSERT 시점에 강제)
- `re_run_of != NULL` 인 행은 같은 `chain_id` 의 다른 행을 참조해야 함 (cross-chain re-run 불가)
- chain 깊이 32 제한은 **애플리케이션 레벨** 에서 enforce (DB constraint 로 표현 어려움)

마이그레이션은 PR2 (`backend/migrations/V###__execution_re_run_chain.sql`) 에서 작성하며, 본 spec 은 컬럼·인덱스·불변식만 명세한다. 기존 row 의 백필은 `chain_id = id`, `re_run_of = NULL` 로 일괄 채움 (모두 chain 의 원본으로 간주).

### 9.2 NodeExecution dry-run 표기

dry-run 모드로 실행된 NodeExecution 은 별도 컬럼 추가 없이 `outputData._dryRun === true` 로 식별한다. UI 가 그 키로 분기해 배지를 표시한다 (§7.4).

부모 Execution row 자체에 `dry_run: boolean` 컬럼을 추가하는 것은 v2+ 에서 검토 — v1 은 NodeExecution 마다의 `_dryRun` 만으로도 충분하고, Execution 단위 통계가 필요하면 NodeExecution 집계로 도출 가능.

---

## 10. UI 명세

### 10.1 진입점

| 화면 | 위치 | 권한 미충족 시 |
| --- | --- | --- |
| 실행 상세 페이지 ([14-execution-history.md §3.7](../2-navigation/14-execution-history.md#37-re-run-액션)) | 실행 요약 카드 우측 헤더 | 버튼 disabled + tooltip "Re-run 권한이 없습니다 (정책 RR-PL-06)" |
| Run Results 드로어 ([3-execution.md §10.14](../3-workflow-editor/3-execution.md#1014-re-run-진입점)) | 드로어 헤더 우측 | 버튼 hidden (드로어는 워크플로 작성 중 컨텍스트라 노이즈 줄임) |

두 진입점 모두 동일한 모달을 띄운다.

### 10.2 Re-run 모달

```
┌─ Re-run Execution ────────────────────────────────────────────┐
│  원본 실행: #1234 · 2026-05-12 14:02:30 · ✅ Completed         │
│                                                                │
│  이 워크플로는 외부 호출 노드 3개 — Send Email × 1, HTTP × 2 │
│  — 를 포함합니다.                                              │
│                                                                │
│  ┌─ 입력 데이터 ─────────────────────────────────────────┐   │
│  │ ☐ 원본 입력 그대로 사용 (RR-PL-02)                     │   │
│  │                                                         │   │
│  │ name        [Alice                            ]        │   │
│  │ count       [3                                ]        │   │
│  │ extra.flag  [☑ true                           ]        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  ☐ dry-run 모드 (RR-PL-01) — 외부 호출 skip + mock 출력       │
│                                                                │
│                                          [취소]  [재실행]      │
└────────────────────────────────────────────────────────────────┘
```

**필드 동작**:

| 요소 | 기본값 | 동작 |
| --- | --- | --- |
| 원본 실행 헤더 | — | 원본 ID, 시작 시각, 최종 상태 표시. ID 클릭 시 새 탭으로 원본 상세 페이지 |
| 외부 호출 노드 안내 | — | 본 워크플로의 `supportsDryRun: true` 노드 수를 카테고리별 집계 (`grouped by node.type`) |
| 입력 데이터 폼 | 원본의 `inputData.parameters` | Manual Trigger parameters 스키마 기반 동적 폼. 필드 라벨/타입은 워크플로의 manual_trigger 노드 config 에서 도출 ([Spec 실행 엔진 §6.1.1](./4-execution-engine.md#611-트리거-입력-파라미터-seeding)) |
| "원본 입력 그대로 사용" 토글 | OFF (편집 가능) | ON 으로 두면 폼 read-only + "재실행" 버튼이 한 클릭 경로 |
| "dry-run 모드" 토글 | OFF | 워크플로에 `supportsDryRun: false` 노드가 있으면 disabled + tooltip "이 워크플로는 dry-run 미지원 노드를 포함합니다 (RR-PL-01)" |
| "재실행" 버튼 | — | 클릭 시 권한 가드 통과 → `POST /api/v1/executions/:id/re-run` → 응답의 새 Execution ID 로 라우팅 (`/workflows/:workflowId/executions/:newId`) |
| "취소" 버튼 | — | 모달 닫기. 변경 입력 폐기 |

### 10.3 Chain 표시

실행 상세 페이지 헤더에 chain 정보:

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Executions                                  [← Prev] [Next →]  │
│ ──────────────────────────────────────────────────────────────── │
│  ✅ Completed                                                     │
│  Started: 2026-05-13 09:14:02   Duration: 3.2s                   │
│  Nodes: 10/10 completed                                          │
│  ─                                                                │
│  📎 #3-th re-run · dry-run · 원본: #1234   [View chain (4) ▼]   │
└──────────────────────────────────────────────────────────────────┘
```

| 요소 | 표시 조건 | 내용 |
| --- | --- | --- |
| Chain badge | `re_run_of != null` | "#N-t

... (truncated due to size limit) ...
```

## 진행 중 plan 문서 모음 (plan/in-progress/)

### plan/in-progress 진행 중 문서

#### `plan/in-progress/0-unimplemented-overview.md`
```
# 미구현 항목 오버뷰 (PRD/Spec 기준)

> 작성일: 2026-05-11
> 출처: `prd/0-overview.md` §6.2~§6.3, 각 PRD/Spec 문서의 ❌·🚧 표기, 코드베이스 spot-check
> 검증 일자 기준: 2026-05-11. 본 문서의 "현재 상태"는 본 시점의 코드/스펙 비교 결과이며, 진행 시점에 다시 확인할 것

본 문서는 `prd/`와 `spec/`을 전수 정독해 식별한 **아직 구현되지 않았거나 부분 구현 상태인 항목**의 인덱스다. 각 항목은 카테고리별 plan 문서로 분리해 추적한다.

---

## 작업 흐름 권장 순서

다음 순서로 plan을 소화하면 의존성 충돌이 적다.

1. **`ai-agent-tool-connection-rewrite.md`** — AI Agent 도구 연결은 의도적으로 제거되어 재설계 대기 중. 사용자 가치 큼, 다른 plan과 독립적.
2. **`parallel-p2.md`** — 중첩 Parallel, `waitAll: false`, `errorPolicy` schema 노출. `logic-node-followups`와 별개로 진행 가능.
2-1. **`merge-p2-async-fanin.md`** (신규) — Merge `timeout` / `partialOnTimeout` P2 활성화. `logic-node-followups` D3 의 fallback 분리 — 엔진 비동기 dispatch 모델 도입 PoC 가 선결 조건.
3. **`background-monitoring-api.md`** — Background 노드는 ✅ 구현됐으나 `meta.backgroundRunId` 모니터링 API는 미구현.
4. **`replay-rerun.md`** — Re-run (재실행) 정책 도입.
5. **`team-workspace-followups.md`** — 공유 워크플로우 표시 + 미가입자 초대 토큰.
6. **`2fa-webauthn.md`** — WebAuthn 2FA.
7. **`accessibility-voiceover-validation.md`** — macOS VoiceOver 수동 검증.
8. **`self-hosting-deployment.md`** — Docker Compose 셀프 호스팅 풀 번들, Helm Chart, 운영·보안 가이드.
9. **`marketplace-and-plugin-sdk.md`** — 마켓플레이스 + 커스텀 노드 SDK (가장 큰 미구현 덩어리).

> 각 plan에는 배경 / 관련 PRD-Spec 참조 / 작업 단위 / 수용 기준이 포함된다. 본 인덱스는 plan 간 우선순위·의존 관계만 정리한다.

### 최근 완료

- ✅ **`prd-spec-sync.md`** (2026-05-11, `plan/complete/prd-spec-sync.md`) — Graph RAG ❌→✅, NF-OB-05 cron ✅, EH-NAV-04 ✅, Background spec 4문서 정합화, 매뉴얼 (knowledge-base.mdx 한·영) 정합화.
- ✅ **`logic-node-followups.md`** (2026-05-11, `plan/complete/logic-node-followups.md`) — D1 If/Else `is_type`/`regex` evaluator 통합 ✅, D2 Loop breakCondition + meta.exitReason ✅, D3 Merge P2 → 별도 plan (`merge-p2-async-fanin.md`) 분리 ✅, D4 Switch `meta.value` alias 제거 + 마이그레이션 ✅, D5 Variable Modification recordValues opt-in + 마스킹 유틸 ✅, D6 보류 ✅, D7 case id reserved word 검증 ✅. spec/4-nodes/1-logic 의 P0/P1 미구현 표기 모두 정리 (Merge dormant 표기는 별도 plan 분리에 따른 의도적 잔존).
- ✅ **`llm-provider-followups.md`** (2026-05-11, `plan/complete/llm-provider-followups.md`) — Azure OpenAI 스트리밍 ✅ / Local LLM (Ollama·vLLM) 검증 ✅. `AzureOpenAIClient`·`LocalClient` 가 `OpenAIClient.stream()` 을 상속하여 자동 지원. spec 2종(7-llm-client.md §8.2, 4-ai-assistant.md §1.2/§11/§13/§15) 🚧·❌→✅, PRD 0 §6.1, 매뉴얼 4종(llm-config.mdx 한·영 + overview.mdx 한·영) 정합화.

---

## 카테고리별 미구현 항목 매핑

### A. 제품 기능 (사용자 가치 큰 기능)

| PRD/Spec 항목 | 상태 | 처리 plan |
|---------------|------|-----------|
| **PRD 1 §3.9 NAV-MP-01~07 Marketplace** | ❌ 전체 미구현 (i18n 사전에만 등장) | `marketplace-and-plugin-sdk.md` |
| **PRD 4 §4 MP-CT/CS/PB-***| ❌ 전체 미구현 | `marketplace-and-plugin-sdk.md` |
| **PRD 3 §10 ND-EX-01~03 노드 확장성 SDK** | ❌ 우선순위 3 | `marketplace-and-plugin-sdk.md` |
| **PRD 5 NF-EX-04 노드 플러그인 시스템** | ❌ | `marketplace-and-plugin-sdk.md` |
| **PRD 2 §4 ED-PL-05 마켓 커스텀 노드 팔레트 표시** | (마켓 의존) | `marketplace-and-plugin-sdk.md` |
| **PRD 3 §6.1 ND-AG-06/10/21 AI Agent 도구 연결** | 🚧 의도적 제거, 재작성 예정 | `ai-agent-tool-connection-rewrite.md` |
| **PRD 3 §4.9 ND-PL-03 Parallel 결과 합산 / 중첩 Parallel / waitAll=false** | 🚧 P2 예정 | `parallel-p2.md` |
| **Spec 4-nodes/1-logic/3-loop §1 / §6 breakCondition** | ✅ 활성화 (D2, meta.exitReason 추가) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/1-if-else `is_type` / `regex` 연산자** | ✅ 구현 (D1, evaluator 통합) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/0-common If/Else, Switch `meta.matchedConditions` / `meta.matchedCaseIndex`** | ✅ 핸들러 구현 + spec 정합 (PR-1) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/0-common Variable Decl/Mod meta** | ✅ 핸들러 구현 + recordValues opt-in (D5) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/11-merge `timeout` / `partialOnTimeout`** | 🚧 P2 dormant (엔진 비동기 모델 선결) | `merge-p2-async-fanin.md` |
| **Spec 4-nodes/1-logic/12-background 모니터링 API** | ❌ 미구현 (`meta.backgroundRunId` 키만 발급) | `background-monitoring-api.md` |
| **Spec 5-system/4-execution-engine §6.3 Re-run** | 🚧 미구현 (future PRD) | `replay-rerun.md` |
| **PRD 1 §3.11 NAV-UP-05 미가입자 초대 토큰** | 🚧 후속 (가입 사용자 추가만 ✅) | `team-workspace-followups.md` |
| **PRD 1 §3.1 NAV-WF-07 공유 워크플로우 표시** | 🚧 백엔드만 존재, UI 미노출 | `team-workspace-followups.md` |
| **PRD 5 NF-SC-10 2FA WebAuthn** | 🚧 TOTP만 ✅, WebAuthn 후속 | `2fa-webauthn.md` |

### B. 인프라/배포 (셀프 호스팅)

| PRD 항목 | 상태 | 처리 plan |
|----------|------|-----------|
| **PRD 5 NF-SC-08 셀프 호스팅 보안 가이드** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-EX-03 단일~클러스터 셀프 호스팅** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-02 Docker Compose 셀프 호스팅 번들** | ❌ (현재 docker-compose.yml은 dev infra만) | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-03 Kubernetes Helm Chart** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-06 셀프 호스팅 설치/운영 문서** | ❌ | `self-hosting-deployment.md` |

### C. LLM Provider 확장 — ✅ 완료 (2026-05-11)

본 카테고리는 `plan/complete/llm-provider-followups.md` 에서 모두 처리됨. 결과:

| Spec 항목 | 처리 결과 |
|-----------|-----------|
| **Spec 3-workflow-editor/4 §11 Azure OpenAI 스트리밍** | 🚧 → ✅ (`AzureOpenAIClient extends OpenAIClient` 상속으로 자동 지원, deployment name + `api-version` 매핑) |
| **Spec 5-system/7 §8.2 LLM Client Local (Ollama/vLLM) 스트리밍** | 🚧 → ✅ (`LocalClient extends OpenAIClient` 로 OpenAI 호환 엔드포인트 자동 지원. Ollama 11434 / vLLM OpenAI-compat 모드 검증 완료) |

### D. 접근성

| PRD 항목 | 상태 | 처리 plan |
|----------|------|-----------|
| **PRD 5 NF-A11Y-03 macOS VoiceOver 수동 검증** | 🚧 자동화 ✅, 수동 체크리스트 사용자 수행 대기 | `accessibility-voiceover-validation.md` |

### E. PRD/Spec ↔ 코드 정합성 정리 (실제로는 구현 끝) — ✅ 완료 (2026-05-11)

본 카테고리는 `plan/complete/prd-spec-sync.md` 에서 모두 처리됨. 결과:

| 항목 | 처리 결과 |
|------|-----------|
| **PRD 9 Graph RAG 전체** | ❌ 로드맵 → ✅ P0~P2 구현 완료 (KB-GR-MD/EX/DM/SR/PA/UI/OB-* 모든 ID 에 상태 컬럼 추가). `prd/9-graph-rag.md` §2.1·§3·§6·§7 + `prd/0-overview.md` §6.1 갱신 |
| **PRD 5 NF-OB-05 알림 cron** | 🚧 → ✅ (5분 BullMQ repeatable + cooldown 명시) |
| **PRD 7 EH-NAV-04 AI Assistant read-only 도구** | ❌ → ✅ (`get_workflow_executions` / `get_execution_details` 가 ED-AI-35~38 모두 충족) |
| **Spec Background 노드 (5문서)** | 5-system/4-execution-engine §3.3, 1-data-model.md, 3-workflow-editor/0-canvas.md (3건), 1-node-common.md, 2-edge.md 모두 "🚧 미구현" 제거 + 평면 구현(ND-BG-05) 으로 통일 |
| **AI Agent Tool Area spec 박스** | 재작성 plan(`ai-agent-tool-connection-rewrite.md`) 와 상호 링크 추가 |
| **사용자 매뉴얼** | `frontend/src/content/docs/06-integrations-and-config/knowledge-base.mdx` 한·영 — Graph 모드 "로드맵" 안내 → 실제 사용법 + 검색 파라미터 + Entity/Relation 관리 가이드로 재작성 |

---

## plan 문서 목록

```
plan/in-progress/
├── 0-unimplemented-overview.md        ← 본 문서 (인덱스)
├── ai-agent-tool-connection-rewrite.md ← AI Agent 일반 도구 연결 재설계
├── merge-p2-async-fanin.md            ← Merge timeout/partialOnTimeout — 엔진 비동기 모델 선결
├── parallel-p2.md                     ← 중첩 Parallel·waitAll=false·errorPolicy 노출
├── background-monitoring-api.md       ← meta.backgroundRunId 모니터링 API
├── replay-rerun.md                    ← Re-run 재실행 기능 도입
├── team-workspace-followups.md        ← 공유 워크플로우 표시 + 미가입자 초대 토큰
├── 2fa-webauthn.md                    ← WebAuthn 2FA 추가
├── accessibility-voiceover-validation.md ← macOS VoiceOver 수동 체크리스트
├── self-hosting-deployment.md         ← Docker Compose 풀 번들·Helm·가이드 문서
└── marketplace-and-plugin-sdk.md      ← 마켓플레이스 전체 + 노드 플러그인 SDK

plan/complete/
├── prd-spec-sync.md                   ← §E "PRD/Spec ↔ 코드 정합성 정리" 완료 (2026-05-11)
├── llm-provider-followups.md          ← §C "LLM Provider 확장" 완료 (2026-05-11)
└── logic-node-followups.md            ← Logic 노드 잔여 P0/P1 (D1·D2·D4·D5·D7) 완료, D3 → merge-p2-async-fanin.md 분리 (2026-05-11)
```

각 plan 문서는 다음 구조를 따른다:

- **배경** — PRD/Spec의 어떤 항목이 미구현인지, 현 코드 상태
- **관련 문서** — PRD·Spec·메모리·기존 plan 링크
- **작업 단위** — 체크박스 todo 목록 (SDD: spec → 테스트 → 구현 순서)
- **수용 기준** — Definition of Done
- **의존성·리스크** — 다른 plan, 외부 시스템 영향

---

## 참고: 이미 완료되어 본 plan에 포함되지 않은 영역

- `plan/complete/feature-roadmap/stages.md` Stage 1~11 (LLM 토큰 추적 / Parallel P1 / Background 평면 구현 / 팀 워크스페이스 UI / RBAC / 2FA TOTP / 조직 Integration 공유 / OTel 트레이싱 / 알림 룰 CRUD / 접근성 자동화 / 매뉴얼 검색)
- `plan/complete/node-architecture/*` (handler colocation, schema audit, sub-workflow execution 등)
- `plan/complete/workflow-assistant/*` (Workflow AI Assistant 본체)
- `plan/complete/ai-knowledge-base/*` (Phase 2 KB + Graph RAG PRD 단계 — 코드 구현은 ✅, PRD 표기 갱신은 본 plan의 `prd-spec-sync.md`에서 처리)

```

#### `plan/in-progress/2fa-webauthn.md`
```
# 2FA WebAuthn 추가

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A
> 선행 plan: `plan/complete/feature-roadmap/06-2fa.md` (TOTP + 복구 코드 ✅)

## 배경

PRD 5 §2 NF-SC-10:

> **NF-SC-10** 2FA(Two-Factor Authentication) 지원 — 권장 — ✅ (TOTP + 복구 코드 10개. WebAuthn은 후속)

TOTP 인증 + 복구 코드는 ✅. WebAuthn (Passkey / 보안 키 등) 은 후속 작업으로 남아 있음.

## 관련 문서

- `prd/5-non-functional.md` §2 NF-SC-10
- `spec/5-system/1-auth.md` (인증 / 2FA 흐름)
- `spec/2-navigation/9-user-profile.md` (보안 설정 화면)
- `plan/complete/feature-roadmap/06-2fa.md` (TOTP 구현 history)
- 코드: `backend/src/modules/auth/two-factor*/`, `frontend/src/app/(main)/profile/security/`

## 작업 단위

### 1. 디자인 결정

- [ ] WebAuthn 라이브러리 선택 — `@simplewebauthn/server` + `@simplewebauthn/browser` 가 표준. 사용자 합의 필요
- [ ] **rpID / origin** — SaaS 도메인 vs. 셀프 호스팅 도메인 모두 지원해야 하므로 환경변수로 분리
- [ ] **사용자 흐름** — TOTP 만 / WebAuthn 만 / 둘 다 등록한 경우의 로그인 시 인증 옵션 우선순위
- [ ] **Passkey 다중 등록** — 사용자당 N개 인증기 등록 허용 (모바일 + 데스크톱 + 보안 키)
- [ ] **복구 코드** — TOTP 와 동일하게 별도 복구 코드 발급 vs. 공통 복구 코드 사용

### 2. 데이터 모델 / 마이그레이션

- [ ] `WebAuthnCredential` 엔티티 — `user_id`, `credential_id` (base64url), `public_key`, `counter`, `transports`, `device_name?`, `last_used_at?`, `created_at`
- [ ] 마이그레이션 추가

### 3. 백엔드 구현 (TDD)

- [ ] 등록 흐름: `POST /api/v1/auth/2fa/webauthn/register/options` → challenge 생성 + 세션 저장 → 클라이언트가 `navigator.credentials.create()` → `POST /api/v1/auth/2fa/webauthn/register/verify` → credential 저장
- [ ] 인증 흐름: 로그인 후 2FA 단계에서 `POST /api/v1/auth/2fa/webauthn/authenticate/options` → 클라이언트 `navigator.credentials.get()` → `POST /api/v1/auth/2fa/webauthn/authenticate/verify` → JWT 발급
- [ ] credential 관리 — 목록 조회 / 이름 수정 / 삭제 API
- [ ] counter 검증 (replay 방어) + 단위 테스트
- [ ] 통합 테스트 (등록 / 인증 / counter mismatch / 복구 코드 fallback)

### 4. 프론트엔드 구현 (TDD)

- [ ] 보안 설정 페이지에 "Passkey / 보안 키" 섹션 추가 — 등록 / 목록 / 이름 변경 / 삭제 UI
- [ ] 로그인 후 2FA 단계 — TOTP / Passkey 선택 UI (사용자가 등록한 인증기에 따라)
- [ ] 브라우저 호환성 안내 (Safari, Chrome, Firefox 의 WebAuthn 지원 차이)
- [ ] i18n (ko/en)
- [ ] 단위 테스트 + e2e (Playwright Virtual Authenticator 활용)

### 5. spec / PRD 갱신

- [ ] `prd/5-non-functional.md` §2 NF-SC-10 상태 — TOTP + WebAuthn 모두 ✅
- [ ] `spec/5-system/1-auth.md` 에 WebAuthn 흐름 추가
- [ ] `spec/2-navigation/9-user-profile.md` 보안 섹션 갱신

### 6. 매뉴얼

- [ ] `frontend/src/content/docs/` 보안 가이드에 Passkey 등록·사용법 추가

### 7. REVIEW

- [ ] `ai-review` 실행 → Security 중심 (counter 검증, replay 방어, rpID 정합성, 복구 코드 fallback)

## 수용 기준

- 사용자가 Passkey/보안 키를 등록·관리·삭제 가능
- 로그인 시 TOTP 또는 Passkey 중 선택해 2FA 통과 가능
- counter 검증·복구 코드 fallback 회귀 잠금
- ai-review Critical/Warning 0

## 의존성·리스크

- **의존**: TOTP 2FA 가 이미 ✅이므로 동일 모듈 확장
- **리스크**:
  - 셀프 호스팅 환경에서 rpID/origin 설정 실수 시 등록·인증 모두 실패 — 환경변수 검증 필수
  - 모바일 Safari 의 Passkey 흐름 차이 — 충분한 e2e/수동 검증 필요

```

#### `plan/in-progress/ai-agent-tool-connection-rewrite.md`
```
# AI Agent 일반 도구 연결 재설계

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A
> 선행 plan: [`plan/complete/ai-agent-tool-connection-rewrite.md`](../complete/ai-agent-tool-connection-rewrite.md) (이전 제거 작업의 사유·복원 절차)

## 배경

PRD 3 §6.1 / PRD 6 §3.2 의 다음 요구사항이 **의도적으로 제거된 상태**다:

- ND-AG-06 — Tool/Function 호출 지원 (다른 노드를 도구로 연결)
- ND-AG-10 — Tool Area를 통한 도구 연결 (캔버스 드래그 앤 드롭)
- ND-AG-21 — 조건과 일반 도구 동시 호출 시 일반 도구 우선 실행

config 스키마에서 `toolNodeIds` / `toolOverrides` 필드와, 캔버스의 AI Agent 우측 점선 Tool Area UX가 모두 제거됐다. 조건 도구(`cond_*`) / KB 도구(`kb_*`) / MCP 도구(`mcp_*`) 는 영향 없고 정상 동작한다.

이 plan은 새 도구 연결 디자인을 결정하고 위 PRD 항목을 다시 활성화하는 작업이다.

## 관련 문서

- 제거 결정 사유 + 복원 절차: `plan/complete/ai-agent-tool-connection-rewrite.md`
- PRD: `prd/3-node-system.md` §6.1 ND-AG-06/10/21, `prd/6-phase2-ai.md` §3.2 동일 ID
- Spec (현재 비활성 박스): `spec/4-nodes/3-ai/1-ai-agent.md` §1 / §Tool Area 박스
- Spec 캔버스 (재작성 예정 박스): `spec/3-workflow-editor/0-canvas.md` §AI Agent Tool Area
- 영향 받지 않는 정상 도구: 조건(`cond_*`), KB (`kb_*`), MCP (`mcp_*`) — `backend/src/nodes/ai/ai-agent/tool-providers/{kb-tool-provider,mcp-tool-provider}.ts`

## 작업 단위

### 1. 디자인 결정 (사용자 합의 필요)

본 단계는 **사용자와의 대화로만** 진행한다. SDD/TDD 시작 전 결정해야 할 항목:

- [ ] **도구 등록 모델** — 다음 세 가지 중 어떤 모델을 채택할지 결정
  - (a) Tool Area 부활 — 캔버스에서 AI Agent 노드 옆 점선 박스로 다른 노드를 드래그해 도구로 등록
  - (b) Tool Area 폐기 → 설정 패널에서 "도구로 사용할 노드 ID 목록"을 select 위젯으로 선택
  - (c) 별도 "AI Tool" 노드 타입 신설 — AI Agent 출력 포트 외에 dedicated tool 포트로 연결, 도구 시그니처(name/description/parameters)를 노드 자체 config에 두어 AI Agent의 config는 `toolNodeIds`만 가짐
- [ ] **도구 시그니처 정의 위치** — 도구 노드 자체 (호출되는 측) vs. AI Agent (호출하는 측). 워크플로 작성자가 도구 사양을 한 곳에서만 관리하도록 결정
- [ ] **도구 호출 시 실행 컨텍스트** — 일반 워크플로 진행과 별개의 sub-execution으로 보낼지, 같은 execution 내 inline으로 처리할지. AI Agent multi-turn 도중 도구 노드가 form/buttons/ai_conversation 같은 블로킹 노드를 포함하면 어떻게 다룰지 결정
- [ ] **도구 결과 라우팅** — 도구 노드의 출력은 LLM 컨텍스트에만 들어가는지, 일반 다운스트림 노드로도 흐르는지
- [ ] **ND-AG-21 우선순위 규칙 재확인** — 일반 도구 우선 실행 → LLM 재평가 → 조건 도구 결정 흐름이 새 설계에서도 유지되는지

> 위 결정 사항은 plan을 진행할 사용자가 답한 후, 이 체크박스를 ✅ 처리하고 결정 내용을 본 plan §결정 기록 절에 추가한다.

### 2. PRD 갱신

- [ ] 결정에 따라 `prd/3-node-system.md` §6.1 ND-AG-06/10/21 본문 업데이트 + "재작성 예정" 표기 제거
- [ ] `prd/6-phase2-ai.md` §3.2 ND-AG-06/10/21 동일 갱신
- [ ] PRD 2 §10.4 ED-AI-19 등 AI Assistant 의 편집 도구 거부 정책에 영향 있는지 확인

### 3. Spec 작성

- [ ] `spec/4-nodes/3-ai/1-ai-agent.md` 의 "재작성 예정" 박스 제거 + 새 도구 연결 모델 명세
  - config 스키마: 새 필드 정의 (`toolNodeIds` 부활인지, 새 모델인지)
  - 도구 이름 규칙: `tool_*` 접두사 부활 또는 변경
  - 도구 description 파생 규칙
  - ToolOverride 구조 (필요 시)
  - 도구 호출 결과의 `output.result.*` 위치
- [ ] `spec/3-workflow-editor/0-canvas.md` Tool Area 시각·인터랙션 재작성 (만약 결정 (a)면)
- [ ] `spec/3-workflow-editor/4-ai-assistant.md` — Workflow AI Assistant가 새 도구 연결 모델을 인식·편집할 수 있는지 정합화 (특히 `add_node` / `update_node` 응답의 dynamic-ports 모델)

### 4. 백엔드 구현 (TDD)

- [ ] `backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` config 스키마에 새 필드 복원 + Zod 검증 + 테스트
- [ ] `backend/src/nodes/ai/ai-agent/tool-providers/` 에 일반 노드 도구 provider 구현 (`node-tool-provider.ts` 등) + 단위 테스트
- [ ] `ai-agent.handler.ts` — 도구 호출 시 sub-execution / inline 호출 (결정 사항 따라) + 부분 실패 격리 + diagnostics 누적
- [ ] 조건 도구와 일반 도구 동시 호출 시 ND-AG-21 우선순위 규칙 적용 (테스트로 회귀 잠금)
- [ ] `TOOL_EXECUTION_FAILED` 에러 코드 복원 (`spec/4-nodes/3-ai/1-ai-agent.md` §6 에 이미 placeholder)

### 5. 프론트엔드 구현 (TDD)

- [ ] AI Agent 설정 패널에 도구 등록 UI (a/b/c 결정 따라)
- [ ] 캔버스 렌더 (a 선택 시 Tool Area 점선 박스 부활, b 선택 시 패널만)
- [ ] 도구 호출 시 LLM 타임라인에 tool-call 카드 표시 (이미 KB·MCP·조건 도구는 표시됨 — 일반 도구도 동일 패턴 재사용)

### 6. Migration / Rollout

- [ ] 기존 워크플로의 AI Agent config가 새 스키마에 그대로 호환되는지 확인. 호환 안 되면 `backend/scripts/` 에 마이그레이션 스크립트 추가 + dry-run / apply 흐름

### 7. 매뉴얼 업데이트

- [ ] `frontend/src/content/docs/02-nodes/ai.mdx` (또는 해당 페이지) — 도구 연결 사용법 추가
- [ ] `frontend/src/content/docs/03-workflow-editor/walkthrough.mdx` — Tool Area / 도구 등록 흐름 walkthrough 갱신

### 8. REVIEW

- [ ] `ai-review` 스킬 실행 (Architecture / Side Effect / API Contract / Concurrency 중심)
- [ ] Critical / Warning 이슈 해소 → `review/<timestamp>/RESOLUTION.md` 작성

## 수용 기준

- ND-AG-06 / ND-AG-10 / ND-AG-21 가 PRD에서 ✅ 표기로 활성화
- 새 도구 연결 모델이 spec에 명시되고 코드에 반영
- 회귀 테스트: 조건 도구·KB 도구·MCP 도구는 동일하게 동작
- ai-review Critical/Warning 0
- Workflow AI Assistant 가 새 모델을 인식해 `add_edge` 의 도구 포트를 안전하게 채울 수 있음

## 의존성·리스크

- **의존**: `prd-spec-sync.md` 의 spec 정리가 끝난 baseline에서 시작하면 깔끔
- **순서 의존성**: `conversation-thread.md` (worktree: `conversation-thread-e509c5`) 가 `spec/4-nodes/3-ai/1-ai-agent.md §1` 표를 먼저 개정 — 본 plan 의 §3 spec 작성은 그 merge 이후 착수해야 신규 5필드(`contextScope`/`contextScopeN`/`contextInjectionMode`/`includeToolTurns`/`excludeFromConversationThread`) 와 DEPRECATED 마커(`conversationHistory`/`historyCount`) 위치를 일관되게 다룰 수 있다.
- **conversation-thread 와의 정책 의존**: 일반 `tool_*` 도구 결과의 ConversationThread 누적 정책은 `conversation-thread.md` v2 에서 결정된다 — 본 plan 활성화 시 `tool_*` 결과를 `ai_tool` source 로 push 할지(현재 KB/MCP 와 동일하게 `includeToolTurns` 게이트 적용) 별도 `tool_call` source 신설할지 확정 필요.
- **리스크**:
  - 결정 (c) "AI Tool 노드 신설" 시 노드 카탈로그·플러그인 인터페이스 변경 영향이 marketplace plan(`marketplace-and-plugin-sdk.md`) 까지 번질 수 있음
  - multi-turn 도중 도구 호출 → blocking 노드(form/buttons) 진입 시 AI Agent 의 `_resumeState` 관리 복잡도 증가
  - 기존 `tool_*` 접두사를 다시 사용할 경우 LLM 프롬프트 호환성 (이전 conversation history) 검증 필요

## 결정 기록

(사용자 답변 후 채워질 자리)

- 도구 등록 모델: TBD
- 도구 시그니처 위치: TBD
- 도구 호출 실행 컨텍스트: TBD
- 도구 결과 라우팅: TBD
- ND-AG-21 우선순위 유지 여부: TBD

```

#### `plan/in-progress/ai-review-subagent.md`
```
---
worktree: ai-review-subagent-b7c8d9
started: 2026-05-15
owner: developer
---

# AI-Review / Consistency-Check — `claude -p` 제거 + Sub-agent 위임

## Context

요금제 정책 변경으로 `subprocess.run(["claude", "-p", ...])` 와
`anthropic.Anthropic().messages.create(...)` 두 model 호출 경로가 모두 사용
불가가 되었다. 현재 `/ai-review` (`code-review-agents`) 와
`/consistency-check` (`consistency-checker`) 의 model 호출이 모두 `claude -p`
이므로 (`lib/agent_runner.py:34`, `lib/summary.py:46`,
`consistency_orchestrator.py:32`) 파이프라인 전체를 sub-agent 위임으로 전환한다.

남는 유일한 model 호출 경로는 **main Claude (현재 session) 가 `Agent` tool
로 sub-agent 를 invoke** 하는 것. sub-agent 는 별도 conversation 으로 자동
격리된다. 사용량 한도 시 무한 재시도는 `/loop` dynamic mode + `ScheduleWakeup`
으로 구현.

## 새 아키텍처

```
사용자 → /ai-review        → 1회 사이클 (한도 걸린 agent 는 pending 유지)
사용자 → /loop /ai-review  → 무한 재시도 (ScheduleWakeup 으로 self-pace)
    │
    ▼
main Claude
  1. orchestrator --prepare 호출 → 세션 디렉토리 + _prompts/<role>.md +
     _retry_state.json 초기화 (model 호출 없음, file IO 만)
  2. _retry_state.json 의 pending 리스트 Read
  3. 각 pending agent 에 대해 Agent tool 병렬 invoke
     (subagent_type=<role>-reviewer, prompt=경로 인자)
  4. sub-agent return value 파싱 (STATUS=success|rate_limit|network|fatal)
  5. _retry_state.json 갱신
  6. pending 비면 summary sub-agent → SUMMARY.md → 종료
     pending 남으면 /loop 안: ScheduleWakeup(reset_hint or 1800s) → turn 종료
                  /loop 밖: partial SUMMARY 후 종료
```

## Sub-agent 정의 (.claude/agents/)

13 reviewer (`<role>-reviewer.md`):
api_contract, architecture, concurrency, database, dependency,
documentation, maintainability, performance, requirement, scope, security,
side_effect, testing

5 checker (`<checker>-checker.md`):
convention_compliance, cross_spec, naming_collision, plan_coherence,
rationale_continuity

2 summary: `code-review-summary.md`, `consistency-summary.md`

각 정의 frontmatter:
```
---
name: <slug>
description: <한 줄>
tools: Read, Grep, Glob, Bash, Write
model: sonnet
---
```

본문은 기존 prompts 의 내용을 그대로 옮기되, 다음 contract 를 끝에 추가:
- review.md 본문은 호출자가 prompt 에 인자로 준 OUTPUT_PATH 에 Write tool 로
  저장한다.
- 호출자에게 return 하는 값은 한 줄: `STATUS=<...> ISSUES=<n> PATH=<...>
  RESET_HINT=<sec or "">`.
- 사용량 한도/네트워크 오류 메시지를 받으면 `STATUS=rate_limit` 또는
  `STATUS=network` 로 보고하고 임의 우회 금지.

## Python orchestrator 슬림화

`code_review_orchestrator.py` / `consistency_orchestrator.py` 가
남기는 역할:
- diff/context 수집 + prompt-budget 압축 (`168-297` 의 기존 로직 유지)
- prompt 파일을 `review/<timestamp>/_prompts/<role>.md` 로 저장
- `_retry_state.json` 초기화 (pending=전체, success=[], fatal=[], attempts=0)
- 세션 디렉토리 경로를 stdout 으로 반환

제거할 코드:
- `from lib import agent_runner, summary`
- `agent_runner.run_agents_parallel(...)` 호출 (`code_review_orchestrator.py:290`)
- `summary.run_summary(...)` 호출 (`code_review_orchestrator.py:308`)
- 동일 위치의 consistency_orchestrator 호출

`lib/agent_runner.py`, `lib/summary.py` → 삭제. `lib/session.py` 유지.

## 변경 파일

### 신규
- `.claude/agents/<role>-reviewer.md` × 13
- `.claude/agents/<checker>-checker.md` × 5
- `.claude/agents/code-review-summary.md`
- `.claude/agents/consistency-summary.md`

### 수정
- `.claude/skills/code-review-agents/hooks/code_review_orchestrator.py`
- `.claude/skills/consistency-checker/hooks/consistency_orchestrator.py`
- `.claude/skills/code-review-agents/lib/__init__.py`
- `.claude/skills/code-review-agents/SKILL.md`
- `.claude/skills/code-review-agents/README.md`
- `.claude/skills/consistency-checker/SKILL.md`
- `.claude/commands/ai-review.md`
- `.claude/commands/consistency-check.md`
- `.claude/skills/code-review-agents/hooks/hooks.json` (PostToolUse 제거)
- `CLAUDE.md` ("외부 LLM 호출 정책" 절 신설)

### 삭제
- `.claude/skills/code-review-agents/lib/agent_runner.py`
- `.claude/skills/code-review-agents/lib/summary.py`
- `.claude/skills/code-review-agents/prompts/`
- `.claude/skills/consistency-checker/prompts/`

## 환경변수

| 변수 | 기본값 | 의미 |
| --- | --- | --- |
| `RETRY_WAKE_DEFAULT_SEC` | 1800 | reset-hint 없을 때 ScheduleWakeup 대기 |
| `RETRY_WAKE_CAP_SEC` | 3600 | wake delay 상한 |
| `RATE_LIMIT_PATTERNS` | (내장) | sub-agent return value 매칭용 추가 패턴 |
| `NETWORK_PATTERNS` | (내장) | 동일 |

## 단계

- [x] 1. .claude/agents/ 디렉토리 신설 + 20 subagent definition 작성
- [x] 2. code_review_orchestrator.py 축소 (--prepare 모드)
- [x] 3. consistency_orchestrator.py 축소
- [x] 4. lib/agent_runner.py + lib/summary.py 삭제, lib/__init__.py 정리
- [x] 5. prompts/ 디렉토리 삭제 (양 skill)
- [x] 6. SKILL.md / README.md 재작성
- [x] 7. .claude/commands/ 슬래시 정의 갱신
- [x] 8. hooks.json PostToolUse 트리거 제거
- [x] 9. CLAUDE.md 정책 절 신설
- [~] 10. `consistency-check --impl-prep`: spec 변경 없음으로 본 작업에는 적용 안 됨. 대신 `--plan` 으로 smoke test 수행 (orchestrator prepare 까지). 실제 sub-agent 호출은 commit/merge 이후 사용자 환경에서 수동 검증.
- [x] 11. orchestrator smoke test 통과: 두 orchestrator 의 `--prepare` 가 session_dir / _prompts / _retry_state.json 정상 생성. `AI_REVIEW_LOOP=1` 환경변수가 `loop_mode=true` 로 반영됨. subagent_type 매핑 (`side_effect → side-effect-reviewer`, `plan_coherence → plan-coherence-checker`) 정상.
- [ ] 12. 통합 검증 (follow-up — 사용자 환경에서 수동 수행 필요):
    - `/ai-review` 호출 → main Claude 가 13개 Agent tool 병렬 invoke → STATUS 파싱 → SUMMARY.md 생성.
    - `/loop /ai-review` 사용량 한도 시뮬레이션 → ScheduleWakeup 예약 → wake 시 재진입 → pending 만 재호출.
    - `/consistency-check --plan plan/in-progress/ai-review-subagent.md` → 5 checker sub-agent invoke → consistency-summary → BLOCK 결정.
    - 본 worktree 의 `.claude/agents/` 가 main session 에 인식되는 시점 확인 (cwd / merge 시점).
- [x] 13. plan 갱신.
- [x] 14. 단일 커밋 (7a52b93e on `claude/ai-review-subagent-b7c8d9`). PR 은 통합 검증 후 사용자 결정.
- [ ] 15. PR 생성 (통합 검증 완료 후).

## 검증 결과 (smoke)

| 항목 | 결과 |
| --- | --- |
| `python3 -c "from lib import session"` | OK |
| `code_review_orchestrator.py` import | OK (ALL_AGENTS 13개 그대로) |
| `consistency_orchestrator.py` import | OK (ALL_CHECKERS 5개 그대로) |
| `_subagent_type('side_effect')` | `side-effect-reviewer` |
| `_subagent_type('plan_coherence')` | `plan-coherence-checker` |
| `code_review_orchestrator.py --prepare` (전체 diff, 30 파일) | 성공. session_dir/_prompts/security.md + _retry_state.json + meta.json 생성. stdout 마지막 줄에 session_dir 절대경로. |
| `AI_REVIEW_LOOP=1 code_review_orchestrator.py --prepare` | `_retry_state.json` 의 `loop_mode=true`. |
| `consistency_orchestrator.py --plan plan/.../ai-review-subagent.md` | 성공. session_dir/_prompts/plan_coherence.md (header + 모드 + Target 문서 + plan_in_progress) + _retry_state.json (pending=['plan_coherence'], summary=consistency-summary). |

## 통합 검증 follow-up

main session 에서 Agent tool 로 sub-agent 를 invoke 하려면 sub-agent definition 이 main 의 `.claude/agents/` 검색 경로에 등록되어야 한다. 본 작업은 worktree 안에 신설했으므로, **PR merge 후 (또는 cwd 를 worktree 로 옮긴 상태에서)** 실제 호출 검증이 가능하다. 수동 검증 절차는 위 단계 12 참고. 검증 실패 시 plan 을 다시 `in-progress` 로 되돌리고 후속 조치.

## Follow-up — 리뷰 디렉토리 nested 구조 (commit 2)

`review/<timestamp>/` 와 `review/consistency/<timestamp>/` 의 flat 누적이 `ls` 등 파일시스템 조회 시 부담이 커서 nested 형식으로 전환.

- 신규 형식:
  - 코드 리뷰: `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`
  - 일관성 검토: `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`
- 변경된 코드:
  - `lib/session.py:create_session_dir` 가 nested ISO 로 디렉토리 생성. `subdir` 인자는 호환 유지.
  - `code_review_orchestrator.py` 의 `REVIEW_OUTPUT_DIR` 기본값 `./review` → `./review/code`.
  - `consistency_orchestrator.py` 는 prefix 그대로 `./review/consistency` (nested 는 session 모듈이 처리).
- 변경된 문서: `CLAUDE.md` 의 명명 컨벤션 표 + "정보 저장 위치" 표 + Skill 체계 표의 path 표현, `code-review-agents/SKILL.md`, `code-review-agents/README.md` 의 산출물 디렉토리 트리 + `_retry_state.json` 예시, `consistency-checker/SKILL.md`, `.claude/commands/consistency-check.md` 산출물 섹션.
- Smoke test:
  - `REVIEW_OUTPUT_DIR=/tmp/code-nested ... --prepare` → `/tmp/code-nested/2026/05/15/07_47_44/...` ✓
  - `CONSISTENCY_OUTPUT_DIR=/tmp/cons-nested ... --plan ...` → `/tmp/cons-nested/2026/05/15/07_47_46/_prompts/plan_coherence.md` 등 정상 ✓
  - 기본값(환경변수 없음) → `./review/code/2026/05/15/07_47_57/` ✓
- 기존 flat 디렉토리(`review/<ts>/`, `review/consistency/<ts>/`) 의 일괄 이동은 사용자 별도 작업.

## 단계 (이어서)

- [x] 16. `lib/session.py:create_session_dir` 를 nested ISO 로 변경 + docstring 갱신.
- [x] 17. `code_review_orchestrator.py` 기본 `REVIEW_OUTPUT_DIR` 을 `./review/code` 로.
- [x] 18. 문서 path 표현 갱신 (CLAUDE.md / 양 SKILL.md / README.md / commands/consistency-check.md).
- [x] 19. Smoke test (양쪽 orchestrator + 기본값).
- [x] 20. follow-up 단계 본 plan 에 기록.
- [x] 21. follow-up 커밋 + push (commit 241e0ebb).
- [x] 22. summary self-discovery follow-up 커밋 + push (commit 04302603).

## Follow-up — 사용자 테스트 피드백 (commit 5+6)

사용자가 실제 `/ai-review` 호출 시 두 가지 이슈 보고:
1. 이중 경로 — `review/2026-05-15_15-29-14` (옛 flat) 와 `review/code/2026/05/15/15_30_00` (새 nested) 가 동시에 생성됨.
2. 자동 후속 흐름 누락 — 옛 동작 (리뷰 → planner/developer 위임 → 이슈 해결 → e2e) 이 빠짐.

### 이슈 1 — commit 16a80728 (`fix(settings): plugins 등록 제거`)

원인: `.claude/settings.json` 의 `plugins: [".claude/skills/code-review-agents"]` 가 plugin 시스템을 통해 plugin path 의 `hooks.json` 을 PostToolUse 로 자동 등록. 옛 hooks.json (Write/Edit 트리거) 이 옛 orchestrator 를 fork → `session.create_session_dir` 만 옛 flat 형식으로 만들고 본문은 `claude -p` 부재로 실패.

해결: `plugins` 배열 제거. slash command 가 진입점이 된 후로 plugin 자동 등록은 필요 없음. 머지 후 main 의 hooks.json 도 함께 사라지면 옛 path 생성 메커니즘 완전 소멸.

### 이슈 2 — 자동 후속 흐름 (commit 6 in progress)

SKILL.md 에 "단계 8. 자동 후속 흐름" 신설:

- 8.1 분류: spec 관련 / 코드 관련.
- 8.2 spec 관련: `project-planner` 절차 (draft → `/consistency-check --spec` → `BLOCK: NO` 시 spec 반영).
- 8.3 코드 관련: `developer` 절차 (수정 + 단위 테스트 + commit).
- 8.4 모두 처리 후 `make e2e-test` 자동 실행.
- 8.5 실패 시 원인 분석 + 추가 fix (최대 3회).
- 8.6 통과 시 `RESOLUTION.md` 작성.
- 8.7 안전 가드: consistency-check `BLOCK: YES`, e2e 누적 3회 실패, 직전 수정과 무관한 사전 결함, DB 마이그레이션·외부 API 계약 변경, SUMMARY "사용자 결정 필요" 표기 → 자동 중단 + 사용자 보고.

동반 갱신: commands/ai-review.md 의 단계 8 추가, README.md 의 아키텍처 그림에 자동 후속 흐름 추가.

- [x] 23. settings.json plugins 제거 commit (16a80728).
- [x] 24. SKILL.md / commands / README 의 자동 후속 흐름 작성.
- [ ] 25. 자동 후속 흐름 commit + push.

## Follow-up — 지침 통합 보강 (commit 4)

전체 skill·agent 지침 검토 결과 발견된 약점 일괄 보강. 사용자 확인 사항: C3 (role-specific prompt 재작성) 적용, E1·E2 (가독성) 적용, C3 의 단일 공유 제안은 거부 (역할 격리 강화 의도).

- **A1 — `--resume` 모드 도입**: 두 orchestrator (`code_review_orchestrator.py`, `consistency_orchestrator.py`) 에 `--resume <session_dir>` 신설. `_retry_state.json` 존재만 검증 후 그 경로를 stdout 으로 echo. /loop wake 후 동일 세션 재진입 메커니즘이 결정성 있게 동작.
- **A2 — STATUS 미수신 fallback**: SKILL.md 단계 4 에 sub-agent 가 한도/네트워크 오류로 STATUS 라인을 만들지 못한 경우 main 이 응답 본문 키워드 매칭으로 분류하는 규칙 + 패턴 리스트 명시.
- **C3 (재해석) — role-specific prompt body**: `lib/role_instructions.py` 신설 — 13 reviewer + 5 checker 의 `ko_title`·`perspective`·`checklist` 를 single source 로 보관. orchestrator 의 `build_agent_prompt_body(agent_name, ...)` 가 role 마다 다른 본문 (`_prompts/<role>.md`) 을 생성 — system prompt 와 이중 강화로 역할 격리 보장.
- **C1, C2 — /loop 호출 형식 명시**: `AI_REVIEW_LOOP=1` env prefix 의 정확한 명령 라인, ScheduleWakeup prompt 의 `/loop /<slash> --resume <session_dir>` 절대경로 표기.
- **C4 — `_retry_state.json` 갱신 필드 명시**: SKILL.md 단계 5 에 갱신 필드 6개(`agents_*`, `agent_history`, `rate_limit_episodes`, `last_reset_hint_sec`, `wake_history`, `total_wait_sec`) 명시.
- **D1, D2 — output_file 검증 + STATUS 정규식 파싱**: SKILL.md 단계 4 에 보강. sub-agent 본문에도 "Write 실패 시 success 거짓 보고 금지" 추가.
- **B1, B2, B3 — stale path / slash 누락 동기화**: SKILL.md·README.md 의 `REVIEW_OUTPUT_DIR` 기본값 → `./review/code`, project-planner SKILL.md 의 옛 flat path → nested, developer SKILL.md 의 `consistency-checker` → `/consistency-check`.
- **E1, E2 — 가독성**: 18개 sub-agent definition 의 호출 규약·상태 결정 섹션을 통일 패턴으로 일괄 재생성 (`lib.role_instructions` 가 single source). commands 의 step 번호에 0 (사전 점검 — worktree 확인) 추가해 SKILL.md 와 일관.
- Smoke: reviewer 3종 + checker 3종 prompt 가 role-specific 으로 다르게 생성됨, `--resume` valid/invalid 분기 정상.

- [ ] 23. 통합 보강 follow-up 커밋 + push.

## Follow-up — summary sub-agent self-discovery (commit 3)

main 이 매 사이클마다 임시 markdown 을 만들어 summary sub-agent 에 전달하던 단계를 제거. summary sub-agent 가 `session_dir=<...>` 한 인자만 받고 자기 컨텍스트에서 `_retry_state.json` → `subagent_invocations[*].output_file` → `meta.json` 을 직접 Read 해 통합 보고서를 작성하도록 단순화.

- 변경: `.claude/agents/code-review-summary.md`, `.claude/agents/consistency-summary.md` 의 호출 규약 + 수행 절차.
- 동반 갱신: code-review-agents/SKILL.md (단계 6), consistency-checker/SKILL.md (단계 5), commands/ai-review.md, commands/consistency-check.md.
- retry_state 스키마 변경 없음 — `summary_subagent_type` / `summary_output_file` 필드가 summary sub-agent 내부에서 직접 참조된다.
- main 의 절차에서 "임시 `_summary.md` 작성" step 제거 → main 의 turn 길이 1단계 감소, conversation 안에 본문이 들어가지 않아 격리 강화.

- [ ] 22. summary self-discovery follow-up 커밋 + push.

## 검증

1. drift: 20 subagent definition 의 frontmatter 가 Claude Code 가 로드
   가능한 schema 인지 확인.
2. 수동 1: 작은 diff 가 있는 worktree 에서 `/ai-review` → 13 Agent 호출 →
   각 review.md + SUMMARY.md 생성.
3. 수동 2: 한 sub-agent prompt 를 임시로 "강제 STATUS=rate_limit" 로 만들고
   `/loop /ai-review` 진입 → ScheduleWakeup 예약·재진입·재호출 검증.
4. 회귀: hooks.json PostToolUse 제거 후 자동 trigger 가 fire 하지 않는지.

## 비-목표

- `claude -p` 의 동시 실행 성능 보존 (Agent tool 의 병렬성에 위임).
- 13개 sub-agent prompt 내용 자체의 품질 개선.
- /loop 외 자동 재시도 메커니즘 (cron 등 검토 가능하나 본 작업 범위 밖).

```

#### `plan/in-progress/ai-thread-source-mark.md`
```
---
worktree: ai-thread-source-mark-7c4f2a
started: 2026-05-16
owner: planner → developer
---

# AI 대화 메시지 source 마커 도입

## 배경

AI Agent 노드의 multi-turn 대화에서 사용자가 어시스턴트 응답을 클릭했을 때 run-results 패널의 Response / Request / LLM Usage 탭이 항상 "해당 턴에 대한 LLM 호출 정보가 저장되어 있지 않습니다." 만 보여주는 회귀가 발견됨.

### 원인

- 백엔드 `ConversationThread` 가 업스트림 노드(Template / Buttons / 다른 AI Agent)의 출력을 AI Agent 의 messages 배열 앞에 `role: 'user'` 로 prepend 한다 (presentation_user → `[from <nodeLabel>] ...`).
- WebSocket `execution.ai_message` 페이로드의 `messages` 는 system 만 필터링하고 injection 결과를 그대로 포함한다.
- frontend `messagesToConversationItems` 가 `role: 'user'` 메시지마다 `currentTurn++` 한다. 그 결과 injection 의 user 메시지도 turn 으로 계산되어, 실제 어시스턴트의 `turnIndex` 가 backend `turnCount` 보다 N 만큼 커진다.
- frontend 가 `debugByTurn.get(turn)` 로 LLM 호출 디버그를 매칭하는데, 키가 어긋나 `requestPayload`/`responsePayload` 가 attach 되지 않는다. fallback (`fromConversationMessages`) 도 둘 다 null 이라 skip → 빈 trace.

### 해결 방향

WebSocket `execution.ai_message` 와 `execution.waiting_for_input` 의 `messages[]` 항목에 `source: 'live' | 'injected'` 마커를 부여한다. frontend 변환기가 `source === 'injected'` 인 user 메시지는 `currentTurn` 증가에서 제외한다. 추후 다른 origin 도입 시 마커 값을 확장만 하면 되므로 확장성을 우선시한 차선책.

## Phase

### Phase 1 — Spec 갱신 (project-planner) ✅ 완료 (2026-05-16)

- [x] `spec/5-system/6-websocket-protocol.md` — §4.1 표 갱신, §4.4 JSON 예시 두 곳, 페이로드 필드표, §4.4.6 신규 절(ConversationTurnSource→source 매핑 표 포함), Rationale 신규 항목.
- [x] `spec/conventions/conversation-thread.md` — §5.1 보강 문단, §9 CHANGELOG 항목.
- [x] `spec/3-workflow-editor/3-execution.md` — §8.1 `execution.ai_message` 행 동기화.
- [x] `/consistency-check --spec` → `review/consistency/2026/05/16/09_42_54/SUMMARY.md` (BLOCK: NO, WARNING 1건 → §4.4.6 명확화 문장으로 해소).

### Phase 2 — Backend 구현 (developer)

- [ ] `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
  - `mapTurnsToChatMessages` 가 반환하는 메시지에 `source: 'injected'` 부여 (ChatMessage 타입 확장 필요).
  - `processMultiTurnMessageInner` 가 push 하는 사용자/어시스턴트/툴 메시지에 `source: 'live'` 부여.
  - `executeMultiTurn` (single-turn 의 첫 진입) 의 system message 도 emit 대상이 아니므로 마커 부여는 옵션 — 일관성을 위해 system 에도 `'live'` 부여 검토.
- [ ] `backend/src/nodes/ai/information-extractor/information-extractor.handler.ts`
  - multi-turn 모드 처리 경로에 동일 마커 부여 (스펙 일관성).
- [ ] `backend/src/modules/execution-engine/execution-engine.service.ts`
  - `buildConversationConfigFromOutput` 가 `messages` 를 필터링할 때 `source` 필드를 그대로 통과시키도록 확인 (현재는 spread 이므로 자동 통과되겠지만, 타입 시그니처 보강).
  - `handleAiMessageTurn` 의 `ai_message` emit 분기 (waiting/terminal 둘 다) 에서 `condMessages` 가 source 를 보존하도록 확인.
- [ ] `backend/src/shared/conversation-thread/thread-renderer.ts` 등 messages 모드 매핑 코드 위치 확인 후 동일 적용.
- [ ] Unit test:
  - `ai-agent.handler.spec.ts`: injection 이 있는 multi-turn 케이스에서 emit 되는 messages 각 항목의 `source` 값 검증.
  - `execution-engine.service.spec.ts`: `buildConversationConfigFromOutput` 의 source 보존 확인.
- [ ] `/consistency-check --impl-prep` 후 구현 착수.

### Phase 3 — Frontend 구현 (developer)

- [ ] `frontend/src/lib/conversation/conversation-utils.ts`
  - `RawMessage` 타입에 `source?: 'live' | 'injected'` 필드 추가.
  - `messagesToConversationItems` 의 user 분기에서 `msg.source === 'injected'` 이면 `currentTurn++` 를 건너뛰고 별도 item 으로만 push (또는 push 자체 생략 — UI 표시 정책은 추가 결정 필요).
- [ ] `frontend/src/lib/websocket/use-execution-events.ts`
  - `payload.messages[]` 타입에 `source` 필드 추가.
  - `convConfig.messages` 동일 처리.
- [ ] `frontend/src/lib/stores/execution-store.ts`
  - `ConversationItem` 에 `isInjected?: boolean` (또는 동등) 마커 추가 검토 — UI 가 inspector 에서 injection chip 등을 구분 표시할 수 있도록.
- [ ] `frontend/src/components/editor/run-results/conversation-utils.ts` (`parseHistoryMessages`) — DB 에서 복원한 완료 노드의 messages 에도 source 가 들어있도록 backend 의 `output.messages` 영속화 형태도 확인 + 일관 처리.
- [ ] Unit test:
  - `conversation-utils.test.ts` (또는 신규): injection user 메시지가 turn 카운팅에서 제외되는지 회귀 테스트.
  - assistant 메시지가 backend `turnCount` 와 같은 `turnIndex` 를 얻는지 검증.

### Phase 4 — UI 점검 & 코드 리뷰

- [ ] dev server 띄워 시나리오 재현 (Template → AI Agent 워크플로우) — Response/Request/LLM Usage 탭이 정상 동작 확인.
- [ ] `/ai-review` 실행 → `review/code/<...>/SUMMARY.md` 검토.
- [ ] CHANGELOG / README 영향 없음 확인.

## 영향 범위 / Side Effects

- WebSocket 페이로드 shape 변경 (additive — `source` 필드 추가). 기존 client 가 이 필드를 무시해도 동작에는 영향 없음.
- `output.messages` 가 DB 에 영속화될 때 source 가 함께 저장되는지 결정 필요 — frontend 의 `parseHistoryMessages` 가 완료된 노드 복원 시에도 같은 변환을 거치므로 일관성 차원에서 영속화 권장.
- Information Extractor multi-turn 도 동일 핸들러 패턴 → 함께 갱신.

## Open Questions

- (Phase 3) injection 메시지를 UI conversation timeline 에 보여줄 것인지(현재 보여주고 있음) vs 숨길 것인지. **잠정 결정**: 보여주되 turn 카운팅에서만 제외. inspector 에서 chip 으로 구분 표시는 추후 결정.
- (Phase 2) source 마커를 `output.messages` (DB 영속화) 까지 보존할 것인지. **잠정 결정**: 보존. parseHistoryMessages 도 같은 컨버터를 거치므로 일관성 확보 효과. spec §4.4.6 의 "필드 누락 시 `'live'` 로 간주" 폴백 규약이 있으므로 미보존도 동작 가능 — 영속 결정은 backend 구현 시점에 최종 확정.
- (참고) ai-agent-tool-connection-rewrite plan 에서 `tool_call` source 신설이 결정되면 §4.4.6 매핑 표의 `ai_tool` 항목이 정확히 동작하는지 재검증 필요 (consistency SUMMARY INFO #10).
- (참고) 향후 DB 컬럼 신설 plan (`Execution.conversation_thread jsonb`, conversation-thread §7 v2 로드맵) 작성 시 `output.messages[].source` 영속 정책을 명시 항목으로 포함 (consistency SUMMARY INFO #9).

```

#### `plan/in-progress/brand-refresh-impl.md`
```
---
worktree: brand-refresh-7a3f12
started: 2026-05-15
owner: developer
---

# Plan: Brand Refresh — Stage 2 (자산·코드 구현)

Stage 1 (`spec/6-brand.md` §8 정식 개정) 의 인수인계를 받아, 신 brand spec 에 맞게 자산을 생성하고 코드에 통합한다.

## 컨텍스트

- **Stage 1 산출물**: `spec/6-brand.md` §8 정식판 (Visual Identity), `spec/2-navigation/_layout.md` §2.1 동기화, `spec/2-navigation/10-auth-flow.md` §1 동기화.
- **사전 일관성 검토**: 1차 `review/consistency/2026/05/15/18_25_10/`, 2차 `review/consistency/2026/05/15/18_36_51/` (BLOCK: NO).
- **원본 컨셉 자산**: `temp/clemvion_logo_concepts.html` (gitignored, 사용자 보관). inline SVG 가 light/dark 페어로 들어있음.
- **현재 코드 상태**: `frontend/public/logo.svg`·`logo-mark.svg`·`frontend/src/app/icon.svg`·`favicon.ico` 는 옛 덩굴 곡선 자산이며 코드에서 거의 참조되지 않음. `frontend/src/app/globals.css` 의 `--primary` 는 generic HSL — brand spec 과 매핑 안 됨.

## 0. 착수 전 의무 절차

- [x] **현재 worktree 확인** — main 워크트리에서 진입 금지. 본 plan 의 worktree 는 `brand-refresh-7a3f12`.
- [x] **`/consistency-check --impl-prep spec/6-brand.md` 호출** (`developer` skill 의무). Critical 0 건 확인 시 착수.
- [x] **Stage 1 산출물 재읽기** — `spec/6-brand.md` §8 (특히 §8.2 컬러 토큰, §8.4 로고 시스템, §8.6 자산 마이그레이션) 과 `_layout.md §2.1`, `10-auth-flow.md §1`.

---

## 1. 자산 생성 (§8.4.1 의 9종)

원본은 `temp/clemvion_logo_concepts.html` 의 inline SVG. 각각 별도 파일로 추출하고 viewBox·색을 spec 토큰과 정렬한다.

### 1.1 SVG 자산 (5종)

- [x] `frontend/public/logo.svg` — Full logo (light). viewBox `260×80`. mark + wordmark + sub-copy 3요소. 색은 §8.2.1 / §8.2.2 의 light 토큰.
- [x] `frontend/public/logo-dark.svg` — Full logo (dark). 동 viewBox. 색은 §8.2.3 의 dark 토큰.
- [x] `frontend/public/logo-mark.svg` — Icon mark (light, 96px master).
- [x] `frontend/public/logo-mark-dark.svg` — Icon mark (dark, 96px master).
- [x] `frontend/public/logo-wordmark.svg` — Wordmark only (sub-copy 없음). 라이트 변종. 다크 변종은 `<Logo />` 컴포넌트의 `currentColor` 활용 또는 추후 분리.

SVG 작성 시 주의:
- 워드마크 `<text>` 의 fontFamily 에 `Helvetica Neue, Helvetica, Arial, sans-serif` 시스템 스택 명시 (§8.3, R-11).
- 워드마크 weight: base 200 / accent `vi` 600. `<tspan font-weight="600" fill="...">vi</tspan>` 활용.
- sub-copy `AGENTIC WORKFLOW` 은 Courier New / 8px / letter-spacing 3px / uppercase.

### 1.2 Favicon multi-size 합성

- [x] **16px 전용 vector 신규 작성** — 96px master 의 단순 축소 금지 (§8.4.2). 노드 ≤ 4 / 라인 ≤ 3 으로 단순화. `frontend/public/favicon-16.svg` 로 배치.
- [x] **32px vector** — `frontend/src/app/icon.svg` 가 master 의 축소판으로 작동. Next.js metadata 가 자동 노출.
- [ ] **48px vector + multi-size `favicon.ico` 합성** — *Follow-up*. ImageMagick / `png-to-ico` 등 raster 도구 필요. 현 PR 에서는 옛 `favicon.ico` 삭제, modern 브라우저는 `icon.svg` 사용.

### 1.3 PNG 자산 (Follow-up)

PNG 변환은 raster 도구(sharp / ImageMagick / Inkscape) 가 필요하므로 별도 PR 로 분리한다. 현 PR 에서는 SVG 등가물을 임시 사용:

- [ ] `frontend/src/app/apple-icon.png` (180×180) — 임시로 `frontend/public/apple-icon.svg` 사용 (modern iOS ≥ 12 가 SVG apple-touch-icon 지원). 폴백 PNG 는 follow-up.
- [ ] `frontend/src/app/opengraph-image.png` (1200×630) — *현 PR 에서는 OG/Twitter `images` 메타데이터 비활성화*. SVG OG 카드는 X/Slack/Facebook 크롤러가 안정적으로 렌더하지 않아 소셜 미리보기가 깨질 위험. PNG 생성 후 `frontend/src/app/layout.tsx` 의 `openGraph.images` 와 `twitter.card`(`summary_large_image`로 복원) 를 재활성화.

---

## 2. CSS 토큰 매핑 — **테마 롤백 (2026-05-15)**

사용자 피드백 *"전체적인 색상이 별로"* 로 globals.css 의 Vine 토큰 매핑을 **main 으로 전면 롤백**. Shadcn neutral 토큰 (`--primary: 222.2 47.4% 11.2%` 등) 그대로 유지. `(auth)/layout.tsx` 배경도 `bg-gradient-to-br ...` 로 복원.

SVG 자산은 자체 fill 로 Vine 컬러를 보유하므로 로고/파비콘 비주얼은 그대로 유지됨. 단 spec ↔ 코드 일치를 위해 `spec/in-progress/spec-update-brand-followup.md` 의 P-4 항목 (spec §8.2 부분 롤백 / 후속 분리) 을 project-planner 에 위임.

본 §2 의 아래 체크박스는 *원래 계획* 이며, 롤백으로 모두 **무효화**:

## ~~2. (이전 계획) CSS 토큰 매핑~~ — 무효

`frontend/src/app/globals.css` 의 `:root` 와 `.dark` (또는 `[data-theme="dark"]`) 페어를 정리한다.

- [x] **현행 generic HSL `--primary` (`222.2 47.4% 11.2%`) 폐기** → §8.2.1 의 `vine-700` (`#1e7a42`) HSL 변환값으로 교체.
- [x] 라이트 모드 `:root` 매핑:
  - `--primary` ← `vine-700`
  - `--background` ← `soil-50`
  - `--card` ← `soil-100`
  - `--foreground` ← `ink`
  - `--muted-foreground` ← `ink-60` 또는 `ink-40`
  - `--border` ← `vine-border`
- [x] 다크 모드 페어:
  - `--primary` ← `vine-dark-accent`
  - `--background` ← `vine-dark-bg-base`
  - `--card` ← `vine-dark-bg-elevated`
  - `--foreground` ← `text-on-dark`
  - 기타 §8.2.3 대응표 그대로 (단 `--destructive-foreground` 는 red 배경 가독성 보장을 위해 near-white 유지 — globals.css 인라인 주석 참고)
- [x] **HSL/RGB 표현 일관성** — Tailwind / Shadcn 컨벤션 (`hsl(var(--primary))`) 을 유지하려면 HEX → HSL 변환 후 공백 구분 표기 사용.
- [x] **주석으로 매핑 명시** — 각 CSS 변수 옆에 brand

... (truncated due to size limit) ...
