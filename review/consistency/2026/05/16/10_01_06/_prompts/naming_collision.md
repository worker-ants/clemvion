# 신규 식별자 충돌 Check Payload

본 파일은 orchestrator 가 신규 식별자 충돌 checker 용으로 작성한 입력입니다. target 문서가 도입하는 새 식별자가 기존 사용처와 충돌하지 않는지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (신규 식별자 충돌)

1. **요구사항 ID 충돌** — target 이 새로 부여하는 ID 가 기존에 다른 의미로 이미 사용되고 있는가
2. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스 명이 기존 영역에서 다른 의미로 사용 중인가
3. **API endpoint 충돌** — 새 endpoint(method + path)가 기존 spec 에 이미 정의되어 있는가
4. **이벤트/메시지명 충돌** — webhook·queue·sse 이벤트 이름 충돌
5. **환경변수·설정키 충돌** — 새 ENV var, config key 가 기존 사용처와 겹치는가
6. **파일 경로 충돌** — 새 spec 파일 경로/이름이 기존 명명 컨벤션을 깨거나 기존 파일과 겹치는가

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

## 검색 대상 코퍼스 (spec/, plan/in-progress/, conventions/)

### 관련 spec 본문

#### `spec/0-overview.md`
```
# Spec: 시스템 아키텍처 개요

> 관련 문서: [데이터 모델](./1-data-model.md) · [브랜드 가이드](./6-brand.md) · [노드 Output 규약](./conventions/node-output.md)

---

## Overview (제품 정의)

> 출처: `prd/0-overview.md` — docs-consolidation(2026-05-12)으로 본 문서에 흡수.

---

### 1. 제품 비전

**"흐름은 설계하는 것이 아니라, 자라나야 한다."**

Clemvion은 AI 에이전트와 노코드 워크플로우 빌더를 통합한 실행 플랫폼이다. 시각적 캔버스에서 노드를 연결해 복잡한 비즈니스 자동화를 구현하되, 워크플로우 안에 AI 에이전트 노드를 삽입함으로써 각 단계가 단순 실행이 아닌 **판단과 적응**을 수행하게 한다. 개발자에게는 고급 설정과 코드 편집 옵션을, 비개발자에게는 직관적인 드래그 앤 드롭 인터페이스와 AI 어시스턴트와의 대화형 편집을 제공한다.

브랜드 스토리·정체성은 [`brand.md`](./6-brand.md)를 참조한다.

---

### 2. 목표

| 구분 | 목표 |
|------|------|
| **사용자 가치** | 반복 업무를 자동화하여 생산성 향상. AI Agent를 활용한 지능형 워크플로우 구축 |
| **비즈니스 가치** | SaaS와 셀프 호스팅 양립으로 다양한 고객층 확보. 마켓플레이스를 통한 생태계 구축 |
| **기술 목표** | 확장 가능한 노드 시스템, 안정적 워크플로우 실행 엔진, 실시간 디버깅 지원 |

---

### 3. 타겟 사용자

#### 3.1 비개발자
- 마케팅, 운영, CS 등 비즈니스 부서 담당자
- 반복 업무 자동화 필요성을 느끼는 사용자
- 직관적 UI를 통해 워크플로우를 구성

#### 3.2 개발자
- 빠른 프로토타이핑 및 자동화 파이프라인 구축
- 코드 편집, 커스텀 노드 개발, API 직접 호출 등 고급 기능 활용
- 셀프 호스팅 환경 운영

#### 3.3 팀/조직
- 워크플로우 공유 및 협업
- 역할/권한 기반 접근 관리
- 조직 단위 통합(Integration) 설정 공유

---

### 4. 사용 단위

- **개인**: 개인 워크스페이스에서 독립적으로 워크플로우 생성/관리
- **팀/조직**: 팀 워크스페이스를 통해 워크플로우 공유, 역할/권한 관리, 공통 Integration 설정 관리

---

### 5. 배포 방식

| 방식 | 설명 |
|------|------|
| **SaaS** | 클라우드 호스팅, 멀티 테넌트 환경, 구독 기반 과금 |
| **셀프 호스팅** | 온프레미스 또는 프라이빗 클라우드 배포, 단일/멀티 테넌트 선택 가능 |

두 배포 방식 모두 동일한 기능을 제공하며, 환경 독립적 설계를 통해 설정만으로 배포 방식을 전환할 수 있어야 한다.

---

### 6. 현재 구현 상태 및 남은 로드맵

#### 6.1 구현 완료 (✅)

| 영역 | 기능 |
|------|-----------|
| **내비게이션** | 대시보드, 워크플로우 목록, 트리거 목록, 스케줄, 통합, Knowledge Base, LLM 설정, 인증 설정, 통계, 사용자 매뉴얼(/docs), 사용자 프로필 |
| **워크플로우 에디터** | 캔버스 기반 노드 편집, 엣지 연결, 실행·디버깅, 버전 히스토리 |
| **노드 시스템** | Trigger(Manual), Logic(If/Else·Switch·Loop·ForEach·Map·Filter·Split·Merge·Parallel·Background·Variable Decl/Mod), Flow(Workflow), AI(AI Agent·Text Classifier·Information Extractor), Integration(HTTP·Database·Send Email), Data(Transform·Code), Presentation(Carousel·Chart·Form·Table·Template) |
| **AI 플랫폼** | LLM Config(프로바이더·모델·API Key — v1 의 5개 provider OpenAI/Anthropic/Google/Azure OpenAI/Local Ollama·vLLM 모두 스트리밍 ✅), Knowledge Base(문서 업로드·임베딩·RAG 검색), **Graph RAG**(KB 모드 선택 + entity/relation 자동 추출 + Hybrid 검색 + Entity/Relation 목록·삭제 + 3D 그래프 시각화 — 상세: [PRD 9](./5-system/10-graph-rag.md)) |
| **Workflow AI Assistant** | 에디터 내 채팅형 AI로 자연어 요청 → 노드·엣지 자동 구성. Clarify → Plan → Execute 3단계 대화 루프, SSE 스트리밍, 세션 영속. 상세: [PRD 2 §10](./3-workflow-editor/_product-overview.md#10-ai-assistant-ed-ai-), [PRD 6 §3.6](./4-nodes/3-ai/_product-overview.md#36-workflow-ai-assistant). |
| **팀 워크스페이스·RBAC** | 데이터 모델(`Workspace.type = personal \| team`, `WorkspaceMember.role`) + 백엔드 모듈(`backend/src/modules/workspaces`) + 프런트엔드 UI(워크스페이스 전환, 멤버 초대·역할·소유권 이전). 회원가입 시 개인 워크스페이스가 자동 생성되고 `X-Workspace-Id`는 서버가 자동 매핑한다. |
| **시스템** | 인증/인가(개인·팀 워크스페이스), REST API, 에러 처리, 표현식 엔진(`{{ }}`), 실행 엔진(Redis 큐 + 워커 풀, 분산 continuation bus), WebSocket 실시간 상태, Webhook 수신, 실행 이력 |

#### 6.2 백엔드만 존재 / 부분 구현 (🚧)

| 영역 | 상태 |
|------|------|
| **Parallel 노드 (P1)** | `PARALLEL_ENGINE=v1` 환경변수로 활성화하면 `ParallelExecutor`가 `p-limit` + `Promise.allSettled`로 분기를 동시 실행한다(off 시 기존 순차 동작). branchCount(2~16), maxConcurrency(0=무제한, 1~16) 지원. 분기 내 블로킹 노드·back-edge·중첩 Parallel은 금지. Merge `wait_all` 조합으로 결과 합산 가능. P2에서 중첩 Parallel과 waitAll=false를 추가할 예정이다. |
| **조직 레벨 Integration 공유** | 팀 워크스페이스 단위 Integration 공유는 후속 단계에서 도입 예정이다. |

#### 6.3 로드맵 / 미구현 (❌)

| 영역 | 내용 |
|------|------|
| **Graph RAG 후속 (P2+)** | community detection / 글로벌 요약 / 도메인별 entity 타입 사전 / KB 단위 prompt override. P0~P2 본체는 §6.1 에서 ✅. 상세: [PRD 9 §8](./5-system/10-graph-rag.md#8-미결--후속-검토). |
| **Logic 확장 노드** | Parallel P2(중첩 Parallel, waitAll=false). |
| **마켓플레이스** | 워크플로우 템플릿·AI Agent 프리셋·Integration 플러그인·커스텀 노드 게시 기능. |
| **배포 자동화 확장** | 공식 Docker/Kubernetes 배포 가이드, 셀프 호스팅 번들. |
| **확장 SDK** | 노드 플러그인 SDK, 외부 커스텀 노드 개발/게시. |
| **Cafe24 통합** | spec 완료(2026-05-13). 워크플로 `cafe24` 노드 + AI Agent Internal MCP Bridge 양방향 노출. 18 카테고리 메타데이터 기반 단일 노드. 후속 implementation 진행 예정 ([Spec Cafe24 노드](./4-nodes/4-integration/4-cafe24.md) · [Spec 통합 §5.8](./2-navigation/4-integration.md#58-cafe24)). |
| **Internal MCP Bridge 패턴 확장** | Cafe24 이후 Shopify·Naver Smartstore 등 first-party 이커머스 통합을 같은 [Spec MCP Client §2.3](./5-system/11-mcp-client.md#23-internal-bridge) 패턴으로 추가. |

---

### 7. 용어 정의

| 용어 | 정의 |
|------|------|
| **Workflow** | 노드와 엣지로 구성된 자동화 프로세스의 단위. 특정 트리거에 의해 실행되거나 수동으로 실행 가능 |
| **Node** | 워크플로우 내에서 하나의 작업 단위를 나타내는 구성 요소. 입력을 받아 처리하고 출력을 생성 |
| **Edge** | 두 노드 간의 연결. 데이터 흐름의 방향과 경로를 정의 |
| **Port** | 노드의 입출력 연결 지점. 입력 포트(Input Port)와 출력 포트(Output Port)로 구분 |
| **Trigger** | 워크플로우의 실행을 시작하는 이벤트. Webhook, 스케줄(Cron), 수동 실행 등의 유형 존재 |
| **Canvas** | 워크플로우를 시각적으로 편집하는 작업 공간 |
| **Integration** | 외부 서비스(Google, GitHub 등)와의 연동 설정 |
| **Knowledge Base** | AI Agent의 RAG(Retrieval-Augmented Generation)를 위한 지식 저장소. KB 단위로 `vector` / `graph` 검색 모드를 선택할 수 있다 |
| **Graph RAG** | 문서에서 추출한 entity / relation 으로 구성된 지식 그래프를 RAG 검색에 활용하는 방식. 본 제품에서는 vector seed → 그래프 확장 → rerank 의 Hybrid 흐름으로 동작한다 ([PRD 9](./5-system/10-graph-rag.md)) |
| **Entity / Relation** | Graph RAG 의 구성 요소. Entity 는 문서 chunk 에서 추출한 의미 단위(인물·조직·개념·위치·이벤트). Relation 은 두 entity 사이의 방향성 있는 관계 (head, predicate, tail) |
| **Execution** | 워크플로우의 한 번의 실행 인스턴스. 실행 상태, 각 노드별 입출력 데이터, 로그를 포함 |
| **Workspace** | 사용자 또는 팀이 워크플로우, Integration, 설정 등을 관리하는 독립된 공간 |
| **Marketplace** | Agent 설정, 워크플로우 템플릿, Integration 플러그인을 공유/설치하는 공간 |
| **Schedule** | 워크플로우를 주기적으로 실행하기 위한 Cron Job 규칙 |
| **LLM** | Large Language Model. AI Agent 노드에서 사용하는 언어 모델 |
| **RAG** | Retrieval-Augmented Generation. Knowledge Base에서 관련 정보를 검색하여 AI 응답 품질을 향상시키는 기법 |

---

### 8. 문서 맵

본 spec/ 트리는 docs-consolidation(2026-05-12)으로 옛 `prd/`·`memory/`·`user_memo/` 를 흡수해 **제품의 단일 진실(single source of truth)** 로 통합되었다.

| 영역 | 위치 | 진입 문서 |
| --- | --- | --- |
| 제품 개요 + 시스템 아키텍처 | `spec/0-overview.md` | 본 문서 |
| 데이터 모델 | `spec/1-data-model.md` | 핵심 엔티티 정의 |
| 브랜드 가이드 | `spec/6-brand.md` | — |
| 정식 규약 | `spec/conventions/` | 노드 Output 규약, Swagger 패턴 등 |
| 내비게이션 화면 | `spec/2-navigation/` | `_product-overview.md` + 화면별 문서 |
| 워크플로우 에디터 | `spec/3-workflow-editor/` | `_product-overview.md` + 캔버스·노드 공통·엣지·실행·AI Assistant |
| 노드 시스템 | `spec/4-nodes/` | `_product-overview.md` + `0-overview.md` + 카테고리별 폴더 (`1-logic/` ~ `7-trigger/`) |
| 시스템 공통 | `spec/5-system/` | `_product-overview.md` + 영역별 spec (인증·API 규칙·실행 엔진·LLM Client·임베딩·RAG·Graph RAG·MCP·Webhook 등) |
| 데이터 흐름 | `spec/data-flow/` | `0-overview.md` + 도메인별 흐름·schema 매핑 (auth·workspace·workflow·execution·knowledge-base·integration·triggers·llm-usage·file-storage·notifications·audit·observability) |

문서 컨벤션:
- **`_product-overview.md`** — 다중 spec 파일을 가진 영역의 제품 정의(옛 PRD). 영역의 사용자 가치·요구사항·요구사항 ID.
- **`_layout.md`** — 영역 공통 레이아웃 (현재는 `2-navigation/` 만 사용).
- **`0-overview.md` / `0-common.md`** — 영역·카테고리 내부의 기술 아키텍처·공통 규약.
- **`N-name.md`** — 정렬된 상세 spec. 본문 끝에 `## Rationale` 섹션으로 결정 근거 inline. 단일 spec 파일 영역(예: webhook, graph-rag)은 본문 상단에 `## Overview (제품 정의)` 섹션을 직접 둔다.

별도 보관소:
- `plan/in-progress/` · `plan/complete/` — 작업 추적 라이프사이클
- `plan/complete/archive/from-memory/` — 옛 `memory/` 의 1회성 분석·진행 로그
- `plan/complete/archive/from-user-memo/` — 옛 `user_memo/` 의 초기 기획·노드 개선안

> 구체 파일 목록은 본 문서가 박제하지 않는다. 폴더 구조는 `ls spec/` 또는 IDE 트리에서 확인한다.

---

## 1. 시스템 구성 개요

```
┌─────────────────────────────────────────────────────────┐
│                      Client (SPA)                       │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │Navigation│  │Workflow Editor│  │  Settings/Config  │  │
│  │  Views   │  │   (Canvas)    │  │     Views         │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API / WebSocket
┌───────────────────────┴─────────────────────────────────┐
│                    API Gateway                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Auth · Rate Limiting · Request Routing          │   │
│  └──────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │
  ┌─────────────────────┼─────────────────────┐
  │                     │                     │
  ▼                     ▼                     ▼
┌──────────┐   ┌───────────────┐   ┌──────────────────┐
│ Core API │   │  Execution    │   │  Integration     │
│ Service  │   │  Engine       │   │  Service         │
│          │   │               │   │                  │
│ - CRUD   │   │ - Scheduler   │   │ - OAuth Manager  │
│ - Search │   │ - Worker Pool │   │ - Connector Pool │
│ - Version│   │ - State Mgmt  │   │ - Webhook Mgr    │
└────┬─────┘   └──┬─────┬──────┘   └────────┬─────────┘
     │            │     │                    │
     │            ▼     │                    │
     │   ┌─────────────┐│                    │
     │   │ Message     ││                    │
     │   │ Queue       ││                    │
     │   │ (Redis BQ)  ││                    │
     │   └──────┬──────┘│                    │
     │          ▼       │                    │
     │   ┌─────────────┐│                    │
     │   │  Workers    ││                    │
     │   │ (N 인스턴스)││                    │
     │   └─────────────┘│                    │
     │                   │                    │
     ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                    Data Layer                             │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────┐ │
│  │PostgreSQL│  │   Redis   │  │  Vector  │  │ Object │ │
│  │(Primary) │  │(Cache/Pub)│  │   DB     │  │Storage │ │
│  └──────────┘  └───────────┘  └──────────┘  └────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 주요 컴포넌트

### 2.1 Client (SPA)
- **기술**: React 기반 SPA
- **역할**: 내비게이션 화면, 워크플로우 에디터(캔버스), 설정 화면 렌더링
- **통신**: REST API(CRUD), WebSocket(실시간 실행 상태, 협업)

### 2.2 API Gateway
- 인증/인가 검증
- Rate Limiting
- 요청 라우팅
- CORS 관리

### 2.3 Core API Service
- 워크플로우, 노드, 트리거, 스케줄 등의 CRUD
- 검색 및 목록 조회
- 버전 관리
- 팀/워크스페이스 관리

### 2.4 Execution Engine
- 워크플로우 실행 오케스트레이션
- 노드 그래프 순회 및 실행
- 스케줄러 (Cron Job 기반 트리거)
- **Message Queue** (Redis 기반) — 실행 태스크를 큐에 발행
- **Worker Pool** (N개 인스턴스, 수평 확장) — 큐에서 태스크를 소비하여 노드 실행
- 실행 상태 관리 및 장애 시 복구

### 2.5 Integration Service
- OAuth 인증 플로우 관리
- Third-party API 커넥터 풀
- Webhook 수신/발신 관리
- 연동 상태 모니터링

### 2.6 Data Layer
- **PostgreSQL**: 주 데이터베이스 (워크플로우, 사용자, 설정 등)
- **Redis**: 캐시, 실행 상태 Pub/Sub, 세션 관리
- **Vector DB**: Knowledge Base 임베딩 저장/검색
- **Object Storage**: S3 호환 스토리지 (AWS S3 / MinIO). 파일 업로드, Knowledge Base 원본 문서 등 저장

### 2.7 Object Storage (S3 호환)

| 항목 | 설명 |
|------|------|
| 호환성 | AWS S3 API 호환 (AWS S3, MinIO 등) |
| SaaS | AWS S3 사용 |
| 셀프 호스팅 | MinIO 기본 제공 (Docker Compose에 포함) |

**버킷 구조:**

```
{bucket}/
  kb/                              # Knowledge Base 원본 문서 (구현됨)
    {kbId}/
      {documentId}/
        {sanitizedFilename}
  {workspaceId}/                   # Form/Avatar 영역 (계획)
    forms/                         # Form 노드 파일 업로드
      {executionId}/
        {fileId}_{originalName}
    avatars/                       # 프로필 이미지
      {userId}.{ext}
```

| 영역 | 키 패턴 | 상태 | 코드 |
|------|---------|------|------|
| Knowledge Base 원본 문서 | `kb/{kbId}/{documentId}/{sanitizedFilename}` | 구현됨 | `backend/src/modules/knowledge-base/knowledge-base.service.ts:723` |
| Form 노드 업로드 / Avatar | `{workspaceId}/forms/...`, `{workspaceId}/avatars/...` | 계획 (코드 미구현) | — |

> KB 원본 키는 `workspaceId` 를 prefix 로 두지 않는다. `kbId` 자체가 workspace 에 종속되므로 (KB 메타데이터의 FK) 키 공간이 겹치지 않으며, 키 길이가 짧아 S3 list/delete 비용이 낮다. 버킷 이름은 `S3_BUCKET` 환경변수 (기본 `workflow-storage`, `backend/.env.example:55`) 로 지정한다.

### 2.8 DB 마이그레이션 (Flyway)

| 항목 | 설명 |
|------|------|
| 도구 | **Flyway** |
| 버전 관리 | SQL 기반 마이그레이션 파일, `V{version}__{description}.sql` 네이밍 |
| 롤백 지원 | 각 마이그레이션에 대응하는 undo 스크립트 작성 (`U{version}__{description}.sql`) |
| CI/CD 연동 | 배포 파이프라인에서 `flyway migrate` 자동 실행. 마이그레이션 실패 시 배포 중단 |
| 환경 분리 | dev/staging/production 환경별 설정 파일 분리 (`flyway-{env}.conf`) |
| 기준선 | 최초 배포 시 `flyway baseline`으로 기준점 설정 |

---

## 3. 공통 UI 패턴

### 3.1 레이아웃
- 좌측 고정 사이드바 + 우측 메인 컨텐츠 영역
- 에디터 화면은 사이드바를 축소하거나 숨길 수 있음

### 3.2 목록 화면 패턴
- 상단: 검색바 + 필터 + 생성 버튼
- 중앙: 테이블/카드 형태 목록
- 하단: 페이지네이션 또는 무한 스크롤
- 각 항목: 우클릭 또는 더보기(...) 메뉴로 액션 (편집, 복제, 삭제)

### 3.3 상세/설정 패널 패턴
- 우측 슬라이드 패널 또는 모달
- 변경사항 자동 저장 (에디터) 또는 저장/취소 버튼 (설정)
- 유효성 검증 즉시 피드백

### 3.4 상태 표시 패턴
- **Badge/Tag**: Active(초록), Inactive(회색), Error(빨강), Processing(파랑 스피너)
- **Toast**: 성공/실패/정보 알림
- **Skeleton**: 로딩 중 UI 플레이스홀더

### 3.5 반응형 및 테마
- 최소 해상도: 1280x720
- 라이트/다크 테마 지원
- 에디터는 데스크탑 전용 (모바일에서는 뷰어 모드만 제공)

---

## 4. 영역별 진입 문서

docs-consolidation(2026-05-12) 으로 PRD/Spec 가 통합되었다. 옛 PRD 의 식별자(예: `NAV-WF-*`, `ED-AI-*`, `ND-IF~ND-BG`) 는 각 영역의 `_product-overview.md` 안에서 그대로 사용되고, 상세 spec 은 동일 폴더의 번호 매겨진 문서로 분배된다.

| 영역 | 제품 정의 (전 PRD) | 상세 spec |
|------|-------------------|-----------|
| 내비게이션 | [`./2-navigation/_product-overview.md`](./2-navigation/_product-overview.md) | [`./2-navigation/`](./2-navigation/) 의 화면별 문서 |
| 워크플로우 에디터 | [`./3-workflow-editor/_product-overview.md`](./3-workflow-editor/_product-overview.md) | [`0-canvas`](./3-workflow-editor/0-canvas.md) · [`1-node-common`](./3-workflow-editor/1-node-common.md) · [`2-edge`](./3-workflow-editor/2-edge.md) · [`3-execution`](./3-workflow-editor/3-execution.md) · [`4-ai-assistant`](./3-workflow-editor/4-ai-assistant.md) |
| 노드 시스템 | [`./4-nodes/_product-overview.md`](./4-nodes/_product-overview.md) | [`./4-nodes/0-overview.md`](./4-nodes/0-overview.md) + 카테고리별 폴더 |
| AI 플랫폼 (LLM/KB/Assistant) | [`./4-nodes/3-ai/_product-overview.md`](./4-nodes/3-ai/_product-overview.md) | [`./4-nodes/3-ai/`](./4-nodes/3-ai/) · [`./5-system/7-llm-client.md`](./5-system/7-llm-client.md) |
| 통합·KB·마켓플레이스 | [`./4-nodes/4-integration/_product-overview.md`](./4-nodes/4-integration/_product-overview.md) | [`./4-nodes/4-integration/`](./4-nodes/4-integration/) · [`./2-navigation/4-integration.md`](./2-navigation/4-integration.md) · [`./2-navigation/5-knowledge-base.md`](./2-navigation/5-knowledge-base.md) · [`./2-navigation/8-marketplace.md`](./2-navigation/8-marketplace.md) |
| 비기능 요구사항 | [`./5-system/_product-overview.md`](./5-system/_product-overview.md) | [`./5-system/`](./5-system/) 의 영역별 문서 |
| 실행 이력 | (Overview 섹션 통합) | [`./2-navigation/14-execution-history.md`](./2-navigation/14-execution-history.md) |
| Webhook | (Overview 섹션 통합) | [`./5-system/12-webhook.md`](./5-system/12-webhook.md) |
| Graph RAG | (Overview 섹션 통합) | [`./5-system/10-graph-rag.md`](./5-system/10-graph-rag.md) |
| 브랜드 가이드 | — | [`./6-brand.md`](./6-brand.md) |
| 노드 Output 규약 | — | [`./conventions/node-output.md`](./conventions/node-output.md) |

---

## 5. 배포 환경 분리

| 항목 | SaaS | 셀프 호스팅 |
|------|------|-------------|
| 인증 | 자체 인증 + OAuth 소셜 로그인 | 자체 인증 + LDAP/SAML 옵션 |
| 데이터 격리 | 멀티 테넌트 (논리적 격리) | 단일 테넌트 (물리적 격리) |
| 스케일링 | 자동 수평 확장 | 수동 구성 (Docker Compose / K8s) |
| 업데이트 | 자동 롤링 업데이트 | 수동 버전 업그레이드 |
| 마켓플레이스 | 중앙 마켓플레이스 접근 | 프록시 또는 오프라인 패키지 |
| 모니터링 | 내장 대시보드 + 관리형 알림 | Prometheus/Grafana 연동 가이드 |

```

#### `spec/1-data-model.md`
```
# Spec: 데이터 모델

> 관련 문서: [Spec 아키텍처 개요](./0-overview.md) · [PRD 개요](./0-overview.md) · [PRD 노드 시스템](./4-nodes/_product-overview.md)

---

## 1. 엔티티 관계 개요

```
User ──┬── Workspace (1:N)
       │       │
       │       ├── Folder (1:N, 자기참조 parent_id)
       │       ├── Workflow (1:N)
       │       │       ├── Node (1:N)
       │       │       ├── Edge (1:N)
       │       │       ├── WorkflowVersion (1:N)
       │       │       └── Execution (1:N)
       │       │               └── NodeExecution (1:N)
       │       │
       │       ├── Integration (1:N)
       │       └── IntegrationUsageLog (1:N)
       │       ├── Schedule (1:N)
       │       ├── Trigger (1:N)
       │       ├── KnowledgeBase (1:N)
       │       │       └── Document (1:N)
       │       │
       │       ├── LLMConfig (1:N)
       │       ├── AuthConfig (1:N)
       │       ├── AuditLog (1:N)
       │       ├── Notification (1:N)
       │       └── AssistantSession (1:N)
       │               └── AssistantMessage (1:N)
       │
       └── WorkspaceMember (N:M via join)
```

---

## 2. 핵심 엔티티

### 2.1 User

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| email | String | 고유, 로그인 식별자 |
| password_hash | String | 비밀번호 해시 (bcrypt) |
| name | String | 표시 이름 |
| avatar_url | String? | 프로필 이미지 URL |
| locale | String | 언어 설정 (기본: "ko") |
| theme | Enum | light / dark |
| two_factor_enabled | Boolean | 2FA 활성 여부 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.2 Workspace

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| name | String | 워크스페이스 이름 |
| type | Enum | personal / team |
| owner_id | UUID | FK → User |
| slug | String | URL 슬러그 |
| settings | JSONB | 워크스페이스 설정 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.3 WorkspaceMember

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| user_id | UUID | FK → User |
| role | Enum | owner / admin / editor / viewer |
| invited_at | Timestamp | 초대 시각 |
| joined_at | Timestamp? | 합류 시각 |

### 2.4 Workflow

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| name | String | 워크플로우 이름 |
| description | String? | 설명 |
| is_active | Boolean | 활성 상태 |
| tags | String[] | 태그 목록 |
| folder_id | UUID? | FK → Folder (정리용) |
| settings | JSONB | 워크플로우 레벨 설정 |
| current_version | Integer | 현재 버전 번호 |
| created_by | UUID | FK → User |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.5 Folder

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| name | String | 폴더 이름 |
| parent_id | UUID? | FK → Folder (중첩 폴더 지원) |
| sort_order | Integer | 정렬 순서 (기본: 0) |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

**제약 조건:**
- `(workspace_id, parent_id, name)` UNIQUE — 같은 위치에 동일 이름 불가
- 중첩 깊이 제한: 최대 5단계

### 2.6 Node

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow |
| type | Enum | 노드 유형 (if_else, switch, loop, ..., ai_agent, text_classifier, information_extractor, http_request, ..., transform, code, carousel, table, chart, form, template) |
| category | Enum | logic / flow / ai / integration / data / presentation |
| label | String | 사용자 지정 노드 이름 |
| position_x | Float | 캔버스 X 좌표 |
| position_y | Float | 캔버스 Y 좌표 |
| config | JSONB | 노드별 설정 값 |
| is_disabled | Boolean | 비활성 여부 |
| description | String? | 메모/설명 |
| container_id | UUID? | FK → Node. 컨테이너 노드(Loop/ForEach/Map) 내부에 배치된 경우. 엣지 연결/삭제로 자동 동기화(§11.2.1 canvas 스펙 참조). Background 는 컨테이너 멤버십을 사용하지 않고 `background` 포트 엣지로 본문을 식별한다 ([PRD 3 §4.11 ND-BG-05 대안 구현](./4-nodes/_product-overview.md#411-background) / [Spec 실행 엔진 §3.3](./5-system/4-execution-engine.md#33-background-실행)) |
| tool_owner_id | UUID? | FK → Node. AI Agent의 Tool Area에 등록된 경우 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

**제약 조건:**
- `container_id`와 `tool_owner_id`는 동시에 값을 가질 수 없음 (CHECK 제약)
- `container_id`가 참조하는 노드의 type은 `loop`, `foreach`, `map` 중 하나여야 함 (Background는 도입 시 추가)
- `container_id` 체인은 순환하지 않아야 함 — 실행 시 `CONTAINER_CYCLE` 에러로 거부
- 트리거 카테고리 노드(`manual_trigger` 등)는 `container_id`를 가질 수 없음 — 실행 시 `CONTAINER_INVALID_CHILD` 에러로 거부
- `tool_owner_id`가 참조하는 노드의 type은 `ai_agent`여야 함

**Node.type 전체 목록:**

| category | type | 설명 |
|----------|------|------|
| logic | if_else | 조건 분기 |
| logic | switch | 다중 분기 |
| logic | loop | 반복 |
| logic | variable_declaration | 변수 선언 |
| logic | variable_modification | 변수 수정 |
| logic | split | 배열 분리 |
| logic | map | 배열 변환 |
| logic | foreach | 순차 반복 |
| logic | parallel | 병렬 실행 |
| logic | merge | 데이터 합산 |
| logic | background | 백그라운드 실행 |
| flow | workflow | 서브 워크플로우 호출 |
| ai | ai_agent | AI Agent 실행 |
| ai | text_classifier | 텍스트 분류 |
| ai | information_extractor | 정보 추출 |
| integration | http_request | 범용 HTTP 요청 |
| integration | database_query | 데이터베이스 쿼리 |
| integration | send_email | 이메일 발송 (SMTP) |
| integration | cafe24 | Cafe24 Admin API (Resource × Operation 동적 폼). 같은 Integration 이 AI Agent MCP 도구로도 사용 ([Spec Cafe24 노드](./4-nodes/4-integration/4-cafe24.md)) |
| data | transform | 데이터 변환 (연산 체인) |
| data | code | JavaScript 코드 실행 |
| presentation | carousel | 캐러셀(슬라이드) 시각화 |
| presentation | table | 테이블 시각화 |
| presentation | chart | 차트 시각화 |
| presentation | form | 사용자 입력 폼 (Human-in-the-loop) |
| presentation | template | 템플릿 기반 콘텐츠 생성 |

### 2.7 Edge

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow |
| source_node_id | UUID | FK → Node (출력 노드) |
| source_port | String | 출력 포트 식별자 (예: "true", "false", "default", "out_0") |
| target_node_id | UUID | FK → Node (입력 노드) |
| target_port | String | 입력 포트 식별자 (기본: "in") |
| type | Enum | 엣지 유형: `data` (기본) / `error` (에러 포트 엣지) |
| condition | JSONB? | 엣지 조건 (조건부 라우팅용) |
| created_at | Timestamp | 생성 시각 |

**제약 조건:**
- `(source_node_id, source_port, target_node_id, target_port)` UNIQUE — 동일 연결 중복 방지
- 자기 자신으로의 연결 불가 (`source_node_id != target_node_id`)
- source_node와 target_node는 같은 workflow_id에 속해야 함

### 2.8 Trigger

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| workflow_id | UUID | FK → Workflow |
| type | Enum | webhook / schedule / manual |
| name | String | 트리거 이름 |
| is_active | Boolean | 활성 상태 |
| config | JSONB | 트리거별 설정 |
| endpoint_path | String? | Webhook URL 경로 (type=webhook) |
| auth_config_id | UUID? | FK → AuthConfig (Webhook 인증) |
| last_triggered_at | Timestamp? | 마지막 실행 시각 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.9 Schedule

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| trigger_id | UUID | FK → Trigger |
| cron_expression | String | Cron 표현식 |
| timezone | String | 타임존 (IANA) |
| is_active | Boolean | 활성 상태 |
| next_run_at | Timestamp | 다음 실행 예정 시각 |
| last_run_at | Timestamp? | 마지막 실행 시각 |
| parameter_values | JSONB | 워크플로우 Manual Trigger 노드 스키마에 대응하는 파라미터 값 맵. 값 문자열에 `{{ $now }}`, `{{ $schedule.* }}` 등 제한 표현식 사용 가능. 기본값 `{}`. |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.9.1 Trigger ↔ Schedule 동기화 규칙

Schedule은 Trigger의 서브타입이다. 양쪽의 라이프사이클과 상태는 동기화된다.

| 이벤트 | 동작 |
|--------|------|
| Schedule 생성 | Trigger 자동 생성 (type=`schedule`, 동일 이름, 동일 워크플로우, is_active 동기화) |
| Schedule 이름 변경 | 연결된 Trigger 이름도 동기화 |
| Schedule is_active 변경 | 연결된 Trigger is_active도 동기화 (역방향도 동일) |
| Schedule 삭제 | 연결된 Trigger cascade 삭제 |
| Trigger(type=schedule) 삭제 | 연결된 Schedule cascade 삭제 |
| Trigger(type=schedule) 직접 생성 | 금지 — Schedule 화면에서만 생성 가능 |

**제약 조건:**
- Schedule.trigger_id는 NOT NULL — 반드시 Trigger와 1:1 매핑
- Trigger(type=schedule)는 반드시 1개의 Schedule을 가짐

---

### 2.10 Integration

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| service_type | String | 서비스 유형 (google, github, http, database, email, webhook, mcp, cafe24). `mcp` 의 사용처·credentials 스키마는 [Spec MCP Client](./5-system/11-mcp-client.md) · [Spec 통합 §5.6](./2-navigation/4-integration.md#56-mcp-server). `cafe24` 는 [Spec 통합 §5.8](./2-navigation/4-integration.md#58-cafe24) · [Spec Cafe24 노드](./4-nodes/4-integration/4-cafe24.md) — 같은 Integration 이 워크플로 노드와 AI Agent MCP Bridge 양쪽에서 사용된다 ([Spec MCP Client §2.3 Internal Bridge](./5-system/11-mcp-client.md#23-internal-bridge)) |
| name | String | 사용자 지정 별칭 |
| auth_type | Enum | oauth2 / api_key / bearer_token / basic / connection_string / smtp / webhook_outbound / none. `none` 은 인증이 없는 공용 MCP 서버 등에 사용 |
| credentials | JSONB (encrypted) | 인증 정보 (암호화 저장). OAuth의 경우 `scopes: string[]` 포함 |
| scope | Enum | personal / organization |
| status | Enum | connected / expired / error / pending_install |
| install_token | String? | Cafe24 Private 앱 설치 흐름 식별 키. `oauth/begin (app_type=private)` 시 **16바이트를 `base64url` (no padding, 22자) 인코딩**해 발급, callback 성공 또는 TTL 만료 시 NULL. Cafe24 private 전용 — 다른 service_type 에서는 항상 NULL. **형식 변경 (2026-05-15)**: 옛 32바이트 hex (64자) 는 Cafe24 App URL 100자 한도 초과로 폐기 — 본 문서 Rationale 의 "install_token 형식" 항 참조. 정식 라이프사이클은 [Spec 통합 화면 §6 상태 전이](./2-navigation/4-integration.md#6-상태-전이) 와 [§9.2 API](./2-navigation/4-integration.md#92-인증--회전--scope) |
| install_token_issued_at | Timestamp? | Cafe24 Private `install_token` 발급 시각. TTL 스캐너 (`pending-install-ttl` job) 가 `now - 24h` 와 비교해 만료 판단 — 초과 시 `status='expired', status_reason='install_timeout', install_token=NULL` 로 전이. 재사용/새 발급 시 갱신, callback 성공 시 NULL. 옛 (V044 이전) 행은 NULL → 스캐너가 `created_at` 으로 fallback 하여 동일 24h TTL 적용 (배포 직후 일괄 expired 처리 없음 — `created_at` 이 이미 24h 이상 지난 행만 자연스럽게 expired 됨). V044 추가 |
| mall_id | String? | Cafe24 `mall_id` 의 plain projection — `credentials.mall_id` 와 동일 값을 plain 컬럼으로 복제. `(workspace_id, mall_id)` 부분 UNIQUE 인덱스가 SQL 레벨에서 중복 cafe24 통합을 거부하고, decrypt 없이 O(1) lookup 가능. cafe24 외 service_type 에서는 항상 NULL. 옛 (V045 이전) 행은 NULL — 다음 ORM save (callback / reauth) 시 backfill. **비즈니스 규칙**: 같은 workspace 내 같은 `mall_id` 의 cafe24 통합은 `app_type` 무관 최대 1행 — 한 mall 에 public·private 을 동시에 보유하면 토큰·webhook 처리 주체가 분기되어 사용자 혼란과 회계 충돌을 유발하므로 spec 차원에서 금지. Public App 지원 시 재검토 대상. V045 추가 |
| status_reason | String? | 상태별 사유 코드 (모두 `snake_case`). `error` → `insufficient_scope` / `auth_failed` / `network` / `unknown` (현행) — `credentials_unreadable` 은 기존 분기로 정합성 유지. `expired` → `token_expired` / `refresh_failed` / `install_timeout`. `pending_install` → callback 실패 분기 코드 (`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`). `resource_not_found` 는 row 가 사라진 케이스라 DB 갱신 불가 → 후보값 제외 ([Spec 통합 화면 §10.4](./2-navigation/4-integration.md#104-에러-매핑)). `connected` → NULL. ※ DB 저장값은 `snake_case`, 동일 의미의 API 에러 코드는 `OAUTH_*` `UPPER_SNAKE_CASE` (의도적 분리) |
| token_expires_at | Timestamp? | 토큰 만료 시각 (OAuth) |
| last_used_at | Timestamp? | 마지막 노드 실행에서 사용된 시각 (캐시) |
| last_rotated_at | Timestamp? | 자격 증명 마지막 회전 시각 (OAuth 재인증 또는 비OAuth 교체) |
| last_error | JSONB? | 최근 호출 실패의 요약 `{ code, message, at }` |
| created_by | UUID | FK → User |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

**제약조건**: `UNIQUE(workspace_id, name)` — 워크스페이스 내 별칭 유일성

### 2.10.1 IntegrationUsageLog

> 관련 문서: [Spec 통합 화면 §Recent activity](./2-navigation/4-integration.md)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| integration_id | UUID | FK → Integration (CASCADE) |
| node_execution_id | UUID | FK → NodeExecution |
| workflow_id | UUID | FK → Workflow (비정규화, 조회 최적화) |
| status | Enum | success / failed |
| error | JSONB? | 실패 시 에러 요약 `{ code, message }` |
| duration_ms | Integer | 호출 소요 시간 |
| at | Timestamp | 호출 시각 |

**보존 기간**: 90일. 일일 배치로 기한 초과 레코드 정리.

**인덱스**: `(integration_id, at DESC)` — 상세 페이지 최근 활동 조회용

### 2.11 KnowledgeBase

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| name | String | 컬렉션 이름 |
| description | String? | 설명 |
| embedding_model | String | 임베딩 모델 식별자 (default: text-embedding-3-small) |
| embedding_dimension | Integer? | 저장된 청크들의 벡터 차원. 첫 임베딩 후 자동으로 채워지고, KB 재임베딩 시 NULL 로 reset |
| chunk_size | Integer | 청크 크기 (기본: 1000) |
| chunk_overlap | Integer | 청크 오버랩 (기본: 200) |
| document_count | Integer | 문서 수 (캐시) |
| reembed_status | Enum | KB 전체 재임베딩 잠금 상태: `idle` / `in_progress` (default: idle). 진입 시 atomic compare-and-swap |
| rag_mode | Enum | 검색 모드: `vector` (default) / `graph`. **생성 시에만 결정, 사후 변경 불가** ([Spec Graph RAG](./5-system/10-graph-rag.md)) |
| extraction_llm_config_id | UUID? | `rag_mode = 'graph'` 일 때 그래프 추출에 사용할 LLMConfig (chat 모델). NULL 이면 워크스페이스 default LLMConfig |
| max_hops | Integer | graph 검색 시 그래프 확장 깊이 (1 또는 2, default 1). `vector` 모드에서는 무시 |
| vector_seed_top_k | Integer | graph 검색 시 vector seed 개수 (default 5). `vector` 모드에서는 무시 |
| expanded_chunk_limit | Integer | graph expansion 후 회수할 청크 상한 (default 15). `vector` 모드에서는 무시 |
| entity_count | Integer | KB 의 entity 총 수 (캐시). `vector` 모드는 항상 0 |
| relation_count | Integer | KB 의 relation 총 수 (캐시). `vector` 모드는 항상 0 |
| reextract_status | Enum | KB 전체 그래프 재추출 잠금: `idle` / `in_progress` (default: idle). `vector` 모드에서는 사용 안 함 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.12 Document

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| knowledge_base_id | UUID | FK → KnowledgeBase |
| name | String | 문서 이름 |
| file_type | Enum | txt / md / pdf / csv |
| file_url | String | 원본 파일 저장 경로 |
| file_size | Integer | 파일 크기 (bytes) |
| embedding_status | Enum | `pending` / `processing` / `completed` / `error` / `failed`. `error` = in-flight 재시도 중 일시 오류, `failed` = 최대 재시도 소진 또는 비재시도성 오류로 인한 최종 실패 |
| embedding_retry_count | Integer | 임베딩 재시도 누적 횟수. 성공 시 0 으로 리셋 |
| embedding_last_attempted_at | Timestamp? | 마지막 임베딩 시도 시각. stuck 회수 임계 비교에 사용 |
| embedding_error_message | Text? | 마지막 임베딩 오류 메시지 (sanitize 거친 사용자 노출용). 성공 시 NULL |
| graph_extraction_status | Enum? | `pending` / `processing` / `completed` / `error` / `failed`. `vector` 모드 문서는 NULL. 의미는 `embedding_status` 와 동일 |
| graph_retry_count | Integer | 그래프 추출 재시도 누적 횟수. 성공 시 0 |
| graph_last_attempted_at | Timestamp? | 마지막 그래프 추출 시도 시각 |
| graph_error_message | Text? | 마지막 그래프 추출 오류 메시지 |
| chunk_count | Integer | 생성된 청크 수 |
| tags | String[] | 태그 |
| metadata | JSONB | 메타데이터 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.12.1 DocumentChunk

> 관련 문서: [Spec 임베딩 파이프라인](./5-system/8-embedding-pipeline.md)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| document_id | UUID | FK → Document (CASCADE) |
| chunk_index | Integer | 청크 순서 (0-based) |
| content | Text | 청크 텍스트 원본 |
| embedding | Vector | 벡터 임베딩 (pgvector) |
| token_count | Integer | 청크의 토큰 수 |
| metadata | JSONB | `{ page?: number, section?: string }` |

**제약조건**: `UNIQUE(document_id, chunk_index)`

**인덱스**: 차원별 partial HNSW (V022 `vector` + V023 `halfvec` + V030–V032 후속 정비) — 유사도 검색 성능. 마이그레이션 상세는 [`spec/data-flow/knowledge-base.md §2.3`](./data-flow/knowledge-base.md) 및 `backend/migrations/V022_*.sql`, `V023_*.sql`, `V030_*.sql`–`V032_*.sql` 참조.

### 2.12.2 Entity

> 관련 문서: [Spec Graph RAG](./5-system/10-graph-rag.md). `rag_mode = 'graph'` 인 KB 에서만 사용된다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| knowledge_base_id | UUID | FK → KnowledgeBase (CASCADE) |
| name | String | 정규화된 entity 이름 (소문자·trim) |
| display_name | String | 사용자 표시용 원형 |
| type | Enum | `person` / `organization` / `concept` / `location` / `event` / `other` |
| description | Text? | LLM 추출 짧은 설명 |
| mention_count | Integer | KB 내 청크에서 언급된 횟수 (캐시) |
| last_seen_chunk_id | UUID? | 마지막 등장 청크 (FK → DocumentChunk) |
| created_at | Timestamp | 첫 추출 시각 |
| updated_at | Timestamp | 마지막 갱신 시각 |

**제약조건**: `UNIQUE(knowledge_base_id, name, type)`

**인덱스**: `(knowledge_base_id, type)`, `(knowledge_base_id, mention_count DESC)`

### 2.12.3 Relation

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| knowledge_base_id | UUID | FK → KnowledgeBase (CASCADE) |
| head_entity_id | UUID | FK → Entity |
| tail_entity_id | UUID | FK → Entity |
| predicate | String | 관계 서술어 (예: `founded`, `employs`). P0 free-form, snake_case 권장 |
| evidence_chunk_id | UUID? | 추출 근거 청크 (FK → DocumentChunk) |
| weight | Integer | 동일 (head, predicate, tail) 가 여러 chunk 에서 발견된 누적 횟수 |
| created_at | Timestamp | 첫 추출 시각 |
| updated_at | Timestamp | 마지막 갱신 시각 |

**제약조건**: `UNIQUE(knowledge_base_id, head_entity_id, predicate, tail_entity_id)`

**인덱스**: `(knowledge_base_id, head_entity_id)`, `(knowledge_base_id, tail_entity_id)`

### 2.12.4 ChunkEntity

| 필드 | 타입 | 설명 |
|------|------|------|
| chunk_id | UUID | FK → DocumentChunk (CASCADE) |
| entity_id | UUID | FK → Entity (CASCADE) |
| mention_text | String? | 청크에서 등장한 원형 표기 (정규화 전) |

**제약조건**: `PRIMARY KEY (chunk_id, entity_id)`

**인덱스**: `(entity_id)` — entity → chunk 역방향 회수 (검색 expansion 단계)

### 2.13 Execution

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow |
| trigger_id | UUID? | FK → Trigger (트리거에 의한 실행 시) |
| status | Enum | pending / running / completed / failed / cancelled / waiting_for_input |
| started_at | Timestamp | 실행 시작 시각 |
| finished_at | Timestamp? | 실행 종료 시각 |
| duration_ms | Integer? | 실행 소요 시간 |
| input_data | JSONB? | 실행 입력 데이터 |
| output_data | JSONB? | 실행 최종 출력 데이터 |
| error | JSONB? | 에러 정보. 최초 failed NodeExecution의 에러를 참조/복사 (아래 참조) |
| executed_by | UUID? | FK → User (수동 실행 시) |
| parent_execution_id | UUID? | FK → Execution (서브 워크플로우 실행 시 부모 실행) |
| recursion_depth | Integer | 서브 워크플로우 호출 깊이 (root = 0) |

> 실행된 노드의 순서(옛 `execution_path UUID[]` 컬럼)는 별도 append-only 테이블 **ExecutionNodeLog** (§2.13.1) 가 보관한다. 다중 인스턴스에서 동시 INSERT 시 절대 순서를 보장하지 못하던 array 컬럼 모델은 V036 에서 DROP 되었고, V035 에서 도입된 `execution_node_log` 가 대체한다.

### 2.13.1 ExecutionNodeLog

`(execution_id, id)` 정렬이 곧 노드 실행 순서. BIGSERIAL `id` 는 PostgreSQL sequence 가 부여하므로 다중 backend 인스턴스에서도 concurrency-safe 하다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | BIGSERIAL | PK. sequence 부여 순서가 곧 실행 순서 |
| execution_id | UUID | FK → Execution (ON DELETE CASCADE) |
| node_id | UUID | 실행된 노드 ID |
| created_at | TimestampTZ | append 시각 (기본 `NOW()`) |

**인덱스**: `(execution_id, id)` — 단일 execution 의 노드 순서 조회 (`findById` 가 `executionPath: string[]` 응답을 본 테이블의 정렬 쿼리로 채움).

### 2.14 NodeExecution

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| execution_id | UUID | FK → Execution |
| node_id | UUID | FK → Node |
| status | Enum | pending / running / completed / failed / skipped / waiting_for_input |
| started_at | Timestamp | 실행 시작 시각 |
| finished_at | Timestamp? | 실행 종료 시각 |
| duration_ms | Integer? | 소요 시간 |
| input_data | JSONB | 노드 입력 데이터 |
| output_data | JSONB? | 노드 출력 데이터 |
| error | JSONB? | 에러 정보 `{ code, message, stack? }` |
| retry_count | Integer | 재시도 횟수 |
| interaction_data | JSONB? | 사용자 인터랙션 기록 — Form 제출 또는 버튼 클릭 정보. `{ interactionType: "form_submitted" \| "button_click" \| "button_continue", buttonId?, buttonLabel?, clickedAt, clickedBy }`. 본 필드 + `output_data.messages` (AI 노드) 가 [ConversationThread](./conventions/conversation-thread.md) 의 분산 SoT — 실행 후 timeline UI 가 reconstruct |

**Execution.error ↔ NodeExecution.error 관계:**

| 항목 | 설명 |
|------|------|
| 원본 | NodeExecution.error — 개별 노드 실행 실패 시 기록 |
| 복사 | Execution.error — 워크플로우 실행이 `failed` 상태로 전이될 때, **최초 failed NodeExecution**의 에러 정보를 복사 |
| 구조 | `{ nodeId: "uuid", code: "ERROR_CODE", message: "에러 설명" }` |
| 용도 | 실행 목록에서 Execution 단위로 에러 원인을 즉시 파악 가능 (NodeExecution 조회 없이) |

### 2.15 WorkflowVersion

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workflow_id | UUID | FK → Workflow |
| version | Integer | 버전 번호 |
| snapshot | JSONB | 워크플로우 전체 스냅샷 (nodes, edges, settings) |
| change_summary | String? | 변경 사항 요약 |
| created_by | UUID | FK → User |
| created_at | Timestamp | 생성 시각 |

### 2.16 LLMConfig

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| provider | String | 프로바이더 (openai, anthropic, local 등) |
| name | String | 사용자 지정 이름 |
| api_key | String (encrypted) | API Key (암호화 저장) |
| base_url | String? | 커스텀 엔드포인트 URL (로컬 모델용) |
| default_model | String | 기본 모델 ID |
| default_params | JSONB | 기본 파라미터 (temperature, max_tokens 등) |
| is_default | Boolean | 기본 프로바이더 여부 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.17 AuthConfig

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| name | String | 인증 설정 이름 |
| type | Enum | api_key / bearer_token / basic_auth |
| config | JSONB (encrypted) | 인증 설정 상세 (암호화) |
| ip_whitelist | String[]? | 허용 IP 목록 |
| is_active | Boolean | 활성 상태 |
| last_used_at | Timestamp? | 마지막 사용 시각 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.18 AuditLog

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| user_id | UUID | FK → User |
| action | String | 수행 액션 (workflow.create, trigger.update 등) |
| resource_type | String | 대상 리소스 유형 |
| resource_id | UUID | 대상 리소스 ID |
| details | JSONB | 변경 상세 |
| ip_address | String | 요청 IP |
| created_at | Timestamp | 발생 시각 |

> AuditLog는 워크스페이스 단위 리소스 변경을 기록한다. 워크스페이스 컨텍스트가 없는 인증 이벤트(로그인 성공/실패, 세션 강제 종료 등)는 별도의 **LoginHistory** 테이블에 보관한다.

### 2.18.1 RefreshToken

세션 단위는 `family_id` 다. refresh 회전 시 row가 새로 발급되지만 동일 family는 하나의 "디바이스 세션"으로 간주한다. 사용자에게 노출되는 "활성 세션" 은 `is_revoked = false` 인 같은 family의 가장 최신 row 메타데이터를 보여준다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | FK → User (cascade) |
| token_hash | String | SHA-256(refresh_token), UNIQUE |
| family_id | UUID | 세션 식별자 (회전 시에도 유지) |
| is_revoked | Boolean | 강제/자연 만료 여부 |
| expires_at | Timestamp | 만료 시각 (7일 기본, rememberMe 시 30일) |
| device_label | String? | UA에서 파생된 표시 라벨 ("Chrome on macOS") |
| user_agent | String? | 발급 시점 raw UA |
| ip_address | String? | 발급 시점 클라이언트 IP (CF-Connecting-IP 우선) |
| last_used_at | Timestamp? | refresh 호출마다 갱신 |
| last_used_ip | String? | 마지막 활동 IP |
| created_at | Timestamp | 발급 시각 |

### 2.18.2 LoginHistory

인증 이벤트(로그인 성공·실패, TOTP 실패, 로그아웃, 세션 강제 종료, refresh token 재사용 감지)를 사용자 단위로 시간순 기록한다. 사용자가 직접 본인 이력을 조회한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID? | FK → User (cascade). 실패한 로그인에서 매칭 사용자가 없는 경우 NULL 가능 |
| email | String | 시도된 이메일 (enumeration 추적용) |
| event | Enum | login_success / login_failed / totp_failed / logout / session_revoked / token_reuse_detected |
| ip_address | String? | 클라이언트 IP |
| user_agent | String? | raw UA |
| device_label | String? | UA에서 파생된 표시 라벨 |
| family_id | UUID? | 관련 세션의 family_id (해당 시) |
| failure_reason | String? | INVALID_PASSWORD / ACCOUNT_LOCKED / TOTP_INVALID 등 |
| created_at | Timestamp | 발생 시각 |

보존 정책: 180일 경과 row는 일일 배치로 자동 삭제.

### 2.19 Notification

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| user_id | UUID | FK → User (수신자) |
| type | Enum | execution_failed / background_failed / schedule_failed / integration_expired / marketplace_update / team_invite |
| title | String | 알림 제목 |
| message | String | 알림 내용 |
| resource_type | String? | 관련 리소스 유형 (workflow, integration 등) |
| resource_id | UUID? | 관련 리소스 ID |
| is_read | Boolean | 읽음 여부 (기본: false) |
| channel | Enum | in_app / email / both |
| email_sent_at | Timestamp? | 이메일 발송 시각 |
| created_at | Timestamp | 생성 시각 |

### 2.20 AssistantSession

Workflow AI Assistant의 채팅 세션. 단일 워크플로우 단위로 존재하며, 페이지 새로고침/재접속 시에도 이어서 대화할 수 있다. 상세: [Spec 3-workflow-editor/4: AI Assistant](./3-workflow-editor/4-ai-assistant.md).

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace (cascade 삭제) |
| workflow_id | UUID | FK → Workflow (cascade 삭제) — 세션은 단일 워크플로우에 종속 |
| user_id | UUID | FK → User — 세션 생성자 |
| title | String? | 세션 제목 (첫 메시지 요약 또는 사용자 편집) |
| llm_config_id | UUID? | FK → LLMConfig — 지정 없으면 workspace default 사용 |
| status | Enum | active / archived — archived는 UI 상에서 숨김 |
| message_count | Int | 메시지 수 캐시 (비정규화) |
| last_interaction_at | Timestamp | 마지막 메시지/도구 호출 시각 |
| created_at | Timestamp | 생성 시각 |
| updated_at | Timestamp | 수정 시각 |

### 2.21 AssistantMessage

AssistantSession에 속하는 개별 메시지. 사용자 입력, assistant 응답, 도구 호출 결과를 시간 순서대로 기록한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| session_id | UUID | FK → AssistantSession (cascade 삭제) |
| role | Enum | user / assistant / tool / system — 시스템 메시지는 감사/디버그용, 일반적으로 프롬프트 빌더가 매 요청마다 동적으로 조립하므로 저장되지 않음 |
| content | Text? | 사용자/어시스턴트 텍스트 본문. role=tool인 경우 null 가능 |
| tool_calls | JSONB? | role=assistant에서 함께 발행된 tool_call 목록. 각 항목: `{id, name, arguments, kind: 'explore'\|'plan'\|'edit', result, planStepId?}` |
| tool_call_id | String? | role=tool에서 어떤 tool_call의 결과인지 참조 |
| plan | JSONB? | `propose_plan` tool-call 발행 시 스냅샷. `{title, summary, steps[], openQuestions[], approvedAt?}` |
| usage | JSONB? | `{inputTokens, outputTokens, totalTokens, thinkingTokens?, model}` — role=assistant의 턴 종료 시점에만 채움 |
| finish_reason | String? | `stop` / `tool_calls` / `length` / `content_filter` / `aborted` — role=assistant에만 |
| created_at | Timestamp | 생성 시각 |

> `tool_calls[].result` 는 Shadow 검증 결과 또는 탐색 결과의 축약본을 담아 사용자가 히스토리에서 맥락을 재현할 수 있도록 한다. 단, 대용량 원본(예: 50MB 워크플로우)은 요약 형태로만 기록한다(§9.1).

---

## 3. 인덱스 전략

| 테이블 | 인덱스 | 목적 |
|--------|--------|------|
| Workflow | (workspace_id, is_active) | 워크스페이스별 활성 워크플로우 조회 |
| Workflow | (workspace_id, name) | 이름 검색 |
| Node | (workflow_id) | 워크플로우별 노드 조회 |
| Node | (container_id) | 컨테이너별 자식 노드 조회 |
| Node | (tool_owner_id) | AI Agent별 Tool Area 노드 조회 |
| Edge | (workflow_id) | 워크플로우별 엣지 조회 |
| Edge | (workflow_id, type) | 워크플로우별 엣지 유형 조회 |
| Edge | (source_node_id) | 노드별 아웃바운드 엣지 |
| Execution | (workflow_id, started_at DESC) | 워크플로우별 실행 이력 |
| Execution | (status) | 상태별 실행 조회 |
| NodeExecution | (execution_id) | 실행별 노드 실행 조회 |
| ExecutionNodeLog | (execution_id, id) | 단일 실행의 노드 진행 순서 조회 |
| Trigger | (workspace_id, type) | 유형별 트리거 조회 |
| Trigger | (workspace_id, endpoint_path) UNIQUE | Webhook URL 라우팅 (워크스페이스 단위 유니크) |
| Schedule | (next_run_at, is_active) | 스케줄러 다음 실행 대상 조회 |
| AuditLog | (workspace_id, created_at DESC) | 감사 로그 조회 |
| RefreshToken | (user_id, family_id) WHERE is_revoked = false | 사용자별 활성 세션 그룹 조회 |
| LoginHistory | (user_id, created_at DESC) | 사용자별 로그인 이력 조회 |
| LoginHistory | (email, created_at DESC) | 미가입 이메일 시도 추적 |
| Integration | (workspace_id, service_type) | 서비스별 연동 조회 |
| Integration | (workspace_id, name) UNIQUE | 워크스페이스 내 별칭 유일성 |
| AssistantSession | (workflow_id, status, last_interaction_at DESC) | 워크플로우별 최근 활성 세션 조회 |
| AssistantSession | (workspace_id, user_id, updated_at DESC) | 사용자별 세션 목록 |
| AssistantMessage | (session_id, created_at ASC) | 세션 내 메시지 시간순 페이징 |
| Integration | (workspace_id, status) | 만료/에러 상태 배지 카운트 + `pending_install` TTL 스캐너 조회 + 중복 방지 lookup 겸용 ([Spec 통합 화면 §6](./2-navigation/4-integration.md#6-상태-전이)) |
| Integration | (install_token) WHERE install_token IS NOT NULL | Cafe24 Private App URL (`/3rd-party/cafe24/install/:installToken`) 의 단일 row 식별. NULL 비저장 부분 인덱스로 인덱스 크기 최소화. V043 |
| Integration | (workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL UNIQUE | Cafe24 통합 중복 방지 SQL 강제 + workspace 별 mall lookup O(1). 한 workspace 안에서 같은 mall_id 의 cafe24 통합은 최대 1행 (public 과 private 동시 보유 불가). V046 (V045 컬럼 추가와 분리 — CONCURRENTLY 와 ALTER 가 한 마이그레이션에 공존 불가) |
| Integration | (token_expires_at) | 만료 스캐너 배치 조회 |
| IntegrationUsageLog | (integration_id, at DESC) | 연동별 최근 호출 이력 |
| IntegrationUsageLog | (at) | 보존기간 초과 레코드 정리 배치 |
| Folder | (workspace_id, parent_id) | 워크스페이스별 폴더 조회 |
| Notification | (user_id, is_read, created_at DESC) | 사용자별 미읽은 알림 조회 |
| Notification | (workspace_id, created_at DESC) | 워크스페이스별 알림 조회 |

## Rationale

### Execution.execution_path → ExecutionNodeLog (V035 → V036)

옛 `execution.execution_path UUID[]` 컬럼은 단일 인스턴스 환경에서는 동작했으나, 다중 backend 인스턴스가 동시에 `array_append()` 로 갱신할 때 인스턴스 간 절대 순서가 보장되지 않았다. 대체 모델로 append-only 테이블 `execution_node_log` 를 도입했고, BIGSERIAL `id` 가 PostgreSQL sequence (concurrency-safe) 로 부여되므로 `(execution_id, id)` 정렬이 곧 노드 실행 순서가 된다.

이행은 lock 영향 최소화를 위해 두 단계로 분리되었다.

- `backend/migrations/V035__execution_node_log_create.sql` — 테이블 생성 + `UNNEST WITH ORDINALITY` 로 기존 array 데이터 이행. `executeInTransaction=false`.
- `backend/migrations/V036__execution_drop_execution_path.sql` — 컬럼 DROP. `lock_timeout=3s` 로 운영 영향 최소화.

설계·운영 세부는 [`spec/5-system/4-execution-engine.md §7.4`](./5-system/4-execution-engine.md) 참고. 외부 API 응답의 `executionPath: string[]` 시그니처는 유지되며, `findById` 가 본 테이블의 정렬 쿼리로 채운다.

### install_token 형식 (32byte hex → 16byte base64url, 2026-05-15)

옛 32바이트 hex (64자) 는 Cafe24 Developers App URL 입력 필드의 100자 한도를 path prefix 단축만으로는 못 맞춰 함께 단축. 16바이트 (128-bit) 면 capability token 으로 NIST/OWASP 권장 (96-bit 이상) 을 충분히 상회. DB 컬럼 `install_token` 은 `String?` 으로 길이 제약이 없어 schema 변경 불필요 — 마이그레이션 entry 신규 추가 없음. 상세 배경·대안 비교는 [Spec 통합 화면 §9.2 Rationale "Cafe24 App URL 100자 한도 대응" 항](./2-navigation/4-integration.md#rationale).

```

#### `spec/2-navigation/0-dashboard.md`
```
# Spec: 대시보드

> 관련 문서: [Spec 레이아웃](./_layout.md) · [Spec 인증 플로우](./10-auth-flow.md) · [PRD 내비게이션](./_product-overview.md) · [Spec 워크플로우 목록](./1-workflow-list.md) · [Spec 실행 내역](./14-execution-history.md)

---

## 1. 개요

대시보드(`/dashboard`)는 로그인 후 최초 랜딩 화면이다. 워크플로우 상태와 최근 실행 이력을 한눈에 파악하고, 빠른 액션을 수행할 수 있다.

---

## 2. 화면 구성

```
┌────────────────────────────────────────────────────────────────┐
│  Dashboard                                  [+ New Workflow]   │
│  ──────────────────────────────────────────────────────────── │
│                                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Total WF │ │ Runs(7d) │ │ Success  │ │ Avg Time │         │
│  │   12     │ │    87    │ │  94.2%   │ │   4.3s   │         │
│  │ 10A / 2I │ │          │ │          │ │          │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                │
│  ┌─────────────────────────────┐ ┌──────────────────────────┐ │
│  │ Recent Workflows            │ │ Recent Executions        │ │
│  │ ─────────────────────────── │ │ ──────────────────────── │ │
│  │ 1. Data Sync       2m ago  │ │ Data Sync  ✅ 3.2s  14:02│ │
│  │ 2. Email Campaign  1h ago  │ │ Report Gen ❌ 1.0s  14:01│ │
│  │ 3. Report Gen      3h ago  │ │ Email Camp ✅ 5.1s  13:58│ │
│  │ 4. Email Notify    1d ago  │ │ Email Ntfy ✅ 0.8s  13:55│ │
│  │ 5. DB Backup       2d ago  │ │ ...                      │ │
│  │                             │ │                          │ │
│  │ [View All →]                │ │                          │ │
│  └─────────────────────────────┘ └──────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. 요약 카드

상단에 4개의 요약 카드를 가로 배치한다.

| 카드 | 표시 내용 | 설명 |
|------|-----------|------|
| Total Workflows | 총 워크플로우 수 + Active/Inactive 구분 | Active: 트리거가 활성화된 워크플로우, Inactive: 비활성 |
| Runs (7d) | 최근 7일 실행 횟수 | 전주 대비 증감 표시 (선택) |
| Success Rate | 최근 7일 성공률 (%) | `completed / (completed + failed) × 100` |
| Avg Time | 최근 7일 평균 실행 시간 | 단위: 초(s) 또는 분(m) 자동 전환 |

---

## 4. 최근 워크플로우

최근 수정 또는 실행 기준으로 상위 5개 워크플로우를 표시한다.

| 항목 | 설명 |
|------|------|
| 정렬 기준 | `max(updatedAt, lastExecutedAt)` 내림차순 |
| 표시 필드 | 워크플로우 이름, 마지막 활동 시간 (상대 시간) |
| 클릭 동작 | 워크플로우 에디터(`/workflows/:id`)로 이동 |
| "View All" 링크 | `/workflows` (워크플로우 목록)로 이동 |
| 빈 상태 | "No workflows yet. Create your first workflow!" + [+ New Workflow] 버튼 |

---

## 5. 최근 실행 이력

최근 실행 완료/실패 기준 10건을 표시한다.

| 열 | 설명 |
|----|------|
| 상태 | ✅ completed / ❌ failed / ⏳ running |
| 워크플로우 이름 | 실행된 워크플로우 이름 |
| 트리거 | 실행 출처(`subworkflow`/`manual`/`schedule`/`webhook`/`unknown`) 아이콘 + 라벨. 분류 규칙·보조 라벨 정책은 [실행 내역 spec §2.4 Trigger 출처 분류](./14-execution-history.md#trigger-출처-분류) 참조 |
| 소요 시간 | 실행 소요 시간 (초/분) |
| 시각 | 실행 완료 시각 (상대 시간 또는 HH:mm) |

| 동작 | 설명 |
|------|------|
| 행 클릭 | 해당 실행의 상세 페이지(`/workflows/:workflowId/executions/:executionId`)로 이동. 상세 스펙은 [Spec 실행 내역](./14-execution-history.md) 참조 |
| 빈 상태 | "No executions yet. Run a workflow to see results here." |

---

## 6. 빠른 액션

| 액션 | 위치 | 동작 |
|------|------|------|
| + New Workflow | 페이지 헤더 우측 | 새 워크플로우 생성 → 에디터로 이동 |

---

## 7. API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/dashboard/summary | 요약 카드 데이터 (워크플로우 수, 실행 횟수, 성공률, 평균 시간) |
| GET | /api/dashboard/recent-workflows | 최근 워크플로우 5건 |
| GET | /api/dashboard/recent-executions | 최근 실행 이력 10건 |

**응답 예시 — `/api/dashboard/summary`**:

```json
{
  "totalWorkflows": 12,
  "activeWorkflows": 10,
  "inactiveWorkflows": 2,
  "runs7d": 87,
  "successRate": 94.2,
  "avgExecutionTime": 4.3
}
```

---

## 8. 반응형

| 브레이크포인트 | 레이아웃 |
|----------------|----------|
| ≥ 1280px | 요약 카드 4열, 최근 워크플로우·실행 이력 2열 |
| 768px ~ 1279px | 요약 카드 2열, 최근 워크플로우·실행 이력 1열 (세로 스택) |
| < 768px | 요약 카드 1열, 최근 워크플로우·실행 이력 1열 |

```

#### `spec/2-navigation/1-workflow-list.md`
```
# Spec: 워크플로우 목록 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#31-workflow-list-워크플로우-목록) · [Spec 레이아웃](./_layout.md) · [Spec 캔버스](../3-workflow-editor/0-canvas.md) · [데이터 모델 - Workflow](../1-data-model.md#24-workflow)

---

## 1. 화면 구조

```
┌─────────────────────────────────────────────────────────┐
│  Workflows                         [+ New Workflow]     │
│                                                         │
│  ┌──────────────────┐  ┌──────┐  ┌─────────────────┐   │
│  │ 🔍 Search...     │  │Filter│  │ Sort: Updated ▼ │   │
│  └──────────────────┘  └──────┘  └─────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ● My Workflow 1            Active    2 min ago      │ │
│  │   3 nodes · webhook trigger            ⋮           │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ ○ Data Pipeline            Inactive  1 hour ago     │ │
│  │   12 nodes · schedule trigger          ⋮           │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ ● Shared: Team Bot        Active    5 min ago       │ │
│  │   8 nodes · webhook trigger   👥 Team  ⋮           │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│                    1  2  3  ... 10  →                    │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 기능 상세

### 2.1 워크플로우 목록 테이블

| 컬럼 | 내용 |
|------|------|
| 상태 표시 | Active(●초록) / Inactive(○회색) 아이콘 |
| 이름 | 워크플로우 이름. 클릭 시 에디터로 진입 |
| 트리거 요약 | 연결된 트리거 유형 및 개수 |
| 노드 수 | 워크플로우에 포함된 노드 수 |
| 마지막 실행 | 마지막 실행 시각 (상대 시간 표시) |
| 공유 표시 | 팀 워크스페이스에 속한 모든 워크플로우에 팀 뱃지(👥 Team) 표시. 개인 워크스페이스에서는 표시하지 않는다. ([Rationale §1](#rationale)) |
| 더보기 메뉴(⋮) | 편집, 복제, 활성/비활성 토글, 내보내기, 삭제 |

### 2.2 검색

- 워크플로우 이름 기준 실시간 검색 (debounce 300ms)
- 검색 결과가 없을 경우 "검색 결과가 없습니다" 메시지 표시

### 2.3 필터

| 필터 항목 | 옵션 | 비고 |
|-----------|------|------|
| 상태 | 전체 / Active / Inactive | 상시 노출 |
| 소유 | 내 워크플로우 / 공유된 워크플로우 / 전체 | **팀 워크스페이스 활성 시에만 노출**. "공유된 워크플로우" = `createdBy ≠ 현재 사용자`. 개인 워크스페이스에서는 필터 자체가 사라진다. UI 의 세 옵션은 서버 `GET /api/workflows?ownership=` 의 `mine` / `shared` / `all` 에 1:1 매핑된다 — 개인 워크스페이스 컨텍스트에서는 클라이언트가 파라미터를 보내지 않고, 받더라도 서버는 무시한다 |
| 태그 | 태그 멀티 선택 | 상시 노출 |
| 폴더 | 폴더 선택 (있을 경우) | 상시 노출 |

> 팀 뱃지(§2.1 공유 표시)는 워크스페이스 단위의 "공유" 정의를 따르고, 소유 필터는 그 안에서 내 것/남의 것을 다시 구분하는 보조 도구다. 두 정의가 어긋나지 않는 이유는 [Rationale §1](#rationale) 참고.

### 2.4 정렬

| 정렬 기준 | 방향 |
|-----------|------|
| 최근 수정순 (기본) | 내림차순 |
| 이름순 | 오름차순/내림차순 |
| 생성일순 | 내림차순 |
| 마지막 실행순 | 내림차순 |

### 2.5 새 워크플로우 생성

- "**+ New Workflow**" 버튼 클릭
- 워크플로우 이름 입력 다이얼로그 표시 (기본값: "Untitled Workflow")
- 생성 후 즉시 에디터로 진입

### 2.6 더보기 메뉴 액션

| 액션 | 동작 |
|------|------|
| 편집 | 에디터로 진입 |
| 복제 | 워크플로우 복사본 생성 (이름에 "(Copy)" 추가) |
| 활성/비활성 | 상태 토글. 비활성 시 트리거/스케줄 중지 |
| 내보내기 | JSON 파일로 다운로드 |
| 삭제 | 확인 다이얼로그 후 삭제. 연결된 트리거/스케줄도 함께 비활성화 |

### 2.7 빈 상태

- 워크플로우가 없을 때: 일러스트 + "첫 번째 워크플로우를 만들어 보세요" 메시지 + 생성 버튼
- 마켓플레이스 템플릿 추천 링크

---

## 3. API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/workflows | 목록 조회 (쿼리: search, status, tag, sort, order, page, limit, ownership). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수. `ownership` 은 팀 워크스페이스 컨텍스트에서만 의미가 있으며 (`mine` / `shared` / `all`, default `all`), 개인 워크스페이스에서는 서버가 무시한다 (= `all` 처럼 동작) |
| POST | /api/workflows | 새 워크플로우 생성 |
| PATCH | /api/workflows/:id | 워크플로우 수정 (이름, 상태 등) |
| POST | /api/workflows/:id/duplicate | 워크플로우 복제 |
| DELETE | /api/workflows/:id | 워크플로우 삭제 |
| GET | /api/workflows/:id/export | JSON 내보내기 |
| POST | /api/workflows/import | JSON 가져오기 |

---

## Rationale

### 1. "공유 워크플로우" 의 정의 — 팀 워크스페이스 전체

NAV-WF-07 의 "공유" 기준으로 두 옵션을 검토했다:

- (a) **팀 워크스페이스에 속한 모든 워크플로우** = 공유 (선택)
- (b) `createdBy ≠ 현재 사용자` 또는 명시적 sharedWith 컬럼 = 공유 (폐기)

(a) 를 채택한 이유:

- PRD 의 NAV-WF-07 원문("팀 워크스페이스에서 공유된 워크플로우 구분 표시")이 워크스페이스 단위의 격리·공유를 전제로 하고 있어, 워크스페이스 = 공유 단위라는 정의와 자연스럽게 부합한다.
- 데이터 모델상 워크플로우 격리는 이미 `workspaceId` 로 처리되며(`backend/src/modules/workflows/entities/workflow.entity.ts`), `sharedWith` 컬럼이나 추가 마이그레이션 없이 구현 가능하다.
- (b) 는 같은 팀 안에서 "내 것" 과 "남의 것" 을 다시 분리하는 정의지만, 그 구분은 §2.3 의 **소유 필터** 가 담당하므로 뱃지에서까지 중복으로 표현할 필요가 없다.

결과적으로 뱃지(워크스페이스 = 공유)와 필터(작성자 단위 세분화)가 역할 분담된다.

```

#### `spec/2-navigation/10-auth-flow.md`
```
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
| Email | 필수, 이메일 형식 | blur 시 형식 검증 + 중복 확인 API 호출 |
| Password | 필수, 최소 8자, 대소문자+숫자+특수문자 중 3가지 이상 | 입력 중 강도 바 표시 (약함/보통/강함) |
| Terms | 필수 체크 | 미체크 시 버튼 비활성화 |

### 2.3 비밀번호 강도 바

| 강도 | 조건 | 색상 |
|------|------|------|
| 약함 | 8자 미만 또는 1가지 문자 유형 | 빨강 |
| 보통 | 8자 이상 + 2가지 문자 유형 | 주황 |
| 강함 | 8자 이상 + 3가지 이상 문자 유형 | 초록 |

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
│    [   Resend Email   ]          │
│                                  │
│    Didn't receive?               │
│    Check spam folder or          │
│    → use a different email       │
└──────────────────────────────────┘
```

- 이메일 인증 링크 클릭 → `GET /api/auth/verify-email?token={token}`
- 인증 성공 → 자동 로그인 + 개인 워크스페이스 생성 + 대시보드(`/dashboard`)로 리다이렉트
- 인증 토큰 유효기간: 24시간
- 재발송: 60초 쿨다운

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
4. 2FA 설정됨 → 2FA 입력 화면으로 이동 (임시 토큰 포함)
5. 로그인 실패 → "Invalid email or password" 에러 (구체적 이유 미노출)
6. 5회 실패 → 계정 10분 잠금 + "Account locked. Try again in 10 minutes."
```

### 3.3 "Remember me" 동작

| 체크 | Refresh Token 유효기간 |
|------|----------------------|
| 미체크 | 7일 (기본) |
| 체크 | 30일 |

### 3.4 2FA 입력 화면

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
- `POST /api/auth/verify-2fa { tempToken, code }`
- 성공 → JWT 발급 → 리다이렉트
- 실패 → "Invalid code. Please try again."
- 복구 코드 입력 모드 전환 시 단일 입력 필드로 변경

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
│    [   Resend Email   ]          │
│    [   ← Back to Sign In   ]    │
└──────────────────────────────────┘
```

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
- 응답은 `Cache-Control: public, max-age=300` 으로 5분 캐싱 (Next.js Server Component `fetch` 의 `revalidate: 300` 와 정합)
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
| 리다이렉트 | `{frontend_url}/callback?success=true&token={accessToken}` (Refresh Token은 httpOnly Cookie로 설정, Access Token은 짧게 URL 파라미터로 전달되며 클라이언트가 즉시 메모리에 저장 후 URL 정리) |

### 5.4 OAuth 에러 처리

| 에러 | 처리 |
|------|------|
| state 불일치 | `{frontend_url}/callback?error=invalid_state` |
| 코드 교환 실패 | `{frontend_url}/callback?error=token_exchange_failed` |
| 이메일 미제공 | `{frontend_url}/callback?error=email_required` (GitHub private email 등) |
| 서버 오류 | `{frontend_url}/callback?error=server_error` |

프론트엔드의 `/callback` 페이지:
- `success=true` + `token` → `setAccessToken(token)` 후 대시보드(`/dashboard`)로 리다이렉트
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

| 라우트 | 인증 필요 | 미인증 시 |
|--------|-----------|-----------|
| `/auth/*` (로그인, 가입 등) | X | — |
| `/auth/callback` | X | — |
| 그 외 모든 라우트 | O | `/auth/login`으로 리다이렉트 (원래 URL을 `redirect` 파라미터에 보존) |

### 7.2 로그인 후 리다이렉트

- 로그인 성공 시 `redirect` 파라미터가 있으면 해당 URL로 이동
- 없으면 기본: `/dashboard` (대시보드)

### 7.3 로그아웃

1. `POST /api/auth/logout` 호출 (Refresh Token 무효화)
2. 클라이언트: Access Token 메모리에서 제거, Cookie 삭제
3. `/auth/login`으로 리다이렉트

---

## 8. API 엔드포인트

기존 [Spec 인증/인가](../5-system/1-auth.md#5-api-엔드포인트) 엔드포인트에 추가:

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/auth/register | 회원가입 (본문에 `invitationToken?` 동봉 시 [§2.6](#26-초대-토큰을-통한-가입-invitationtoken) 흐름) |
| GET | /api/invitations/:token | 초대 토큰 메타 조회 (가입 페이지 prefill 용, 인증 불요) |
| POST | /api/auth/verify-email | 이메일 인증 확인 (쿼리: token) |
| POST | /api/auth/resend-verification | 인증 이메일 재발송 |
| POST | /api/auth/login | 로그인 |
| POST | /api/auth/verify-2fa | 2FA 코드 검증 |
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

### R-1. 인증 화면 배경 — 그라데이션 복원 (2026-05-15 롤백)

§1 배경 기술을 *"제품 브랜드 색상 또는 그래디언트"* (main 표현) 로 **복원**. 이전 Stage 1 (commit `b6267429`) 에서 *"`soil-50` 단색, 그라데이션 금지"* 로 구체화했으나, 동일자 §8 부분 롤백 (`spec/6-brand.md` R-13) 에서 `soil-50` 토큰이 §8.2 와 함께 폐기되어 본 표현도 함께 복원했다.

코드 상태: `frontend/src/app/(auth)/layout.tsx` 는 `bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--muted))] to-[hsl(var(--background))]` 패턴 — Shadcn neutral 그라데이션. 로고는 `#111e14` 라운드 컨테이너 안에 별도 배치 (그라데이션 위 dark surface 로 시인성 확보).

### R-2. `[Logo]` 자리 변종 명시 (2026-05-15 정정)

§1 의 `[Logo]` 플레이스홀더에 *"Full logo 변종 사용"* 명시. 이전 Stage 1 에서는 *"Full logo (light)"* 로 라이트 한정했으나, §8 부분 롤백 (`spec/6-brand.md` R-13) 에서 라이트/다크 자산 선택을 노출 자리의 surface 톤에 위임하는 형태로 바뀌어 본 행에서도 라이트 한정을 제거.

본 문서는 로고가 노출되는 **자리**를 정의하고, 자리에 들어가는 변종·라이트/다크 선택은 brand spec §8.4.1 매트릭스 + §8.4.6 의 노출 자리 규정을 따른다 (R-9 — 브랜드 spec 의 라우트 spec 우선권).

근거 출처: `spec/6-brand.md §8.4.1`, `§8.4.6`, `R-13`. 사전 일관성 검토 세션: `review/consistency/2026/05/15/18_36_51/` (Stage 1), `review/consistency/2026/05/15/23_45_11/` (롤백).

```

#### `spec/2-navigation/11-error-empty-states.md`
```
# Spec: 에러 페이지 / 빈 상태 UI

> 관련 문서: [Spec 레이아웃](./_layout.md) · [Spec 아키텍처 개요](../0-overview.md) · [Spec 에러 처리](../5-system/3-error-handling.md)

---

## 1. 에러 페이지

시스템 수준의 에러가 발생하면 전체 화면을 에러 페이지로 교체한다. 모든 에러 페이지는 **아이콘/일러스트 + 제목 + 설명 + CTA 버튼** 구조를 따른다.

### 1.1 공통 레이아웃

```
┌──────────────────────────────────────┐
│                                      │
│           (아이콘/일러스트)           │
│                                      │
│              제목 (H1)               │
│         설명 텍스트 (Body)           │
│                                      │
│           [ CTA 버튼 ]              │
│                                      │
└──────────────────────────────────────┘
```

- 화면 중앙 정렬
- 사이드바는 에러 유형에 따라 표시/숨김 (인증 관련 에러는 숨김)
- 다크/라이트 테마 모두 지원

### 1.2 에러 페이지 정의 (5종)

| 에러 | HTTP 코드 | 아이콘 | 제목 | 설명 | CTA |
|------|-----------|--------|------|------|-----|
| 세션 만료 | 401 | 🔒 자물쇠 | 세션이 만료되었습니다 | 보안을 위해 자동 로그아웃 되었습니다. 다시 로그인해주세요. | **다시 로그인** → 로그인 페이지 |
| 권한 없음 | 403 | 🚫 차단 | 접근 권한이 없습니다 | 이 페이지에 접근할 권한이 없습니다. 워크스페이스 관리자에게 문의하세요. | **워크스페이스 목록으로** → 워크스페이스 선택 화면 |
| 페이지 없음 | 404 | 🔍 돋보기 | 페이지를 찾을 수 없습니다 | 요청하신 페이지가 존재하지 않거나 이동되었습니다. | **대시보드로 이동** → 대시보드 |
| 서버 에러 | 500 | ⚠️ 경고 | 문제가 발생했습니다 | 서버에서 예기치 않은 오류가 발생했습니다. 잠시 후 다시 시도해주세요. | **다시 시도** → 현재 페이지 새로고침, **대시보드로 이동** → 대시보드 |
| 네트워크 오류 | — | 📡 연결 끊김 | 네트워크에 연결할 수 없습니다 | 인터넷 연결을 확인하고 다시 시도해주세요. | **다시 시도** → 현재 페이지 새로고침 |

### 1.3 에러 페이지 동작 규칙

| 규칙 | 설명 |
|------|------|
| 401 감지 | API 응답 401 수신 시 현재 페이지를 세션 만료 에러 페이지로 교체. 로그인 후 원래 URL로 리디렉트 |
| 403 감지 | API 응답 403 수신 시 권한 없음 에러 페이지 표시 |
| 404 감지 | 존재하지 않는 라우트 접근 또는 API 404 응답 시 표시 |
| 500 감지 | API 응답 5xx 수신 시 서버 에러 페이지 표시 |
| 네트워크 오류 | API 호출 실패 (네트워크 타임아웃, DNS 실패 등) 시 표시 |
| 사이드바 표시 | 401: 숨김, 403/404/500/네트워크: 표시 (로그인 상태 유지 중이므로) |

---

## 2. 빈 상태 (Empty State)

데이터가 없는 화면에서 사용자에게 안내 문구와 행동 유도 버튼을 표시한다.

### 2.1 공통 패턴

```
┌──────────────────────────────────────┐
│                                      │
│              (아이콘)                │
│                                      │
│           안내 문구 (Body)           │
│                                      │
│           [ CTA 버튼 ]              │
│                                      │
└──────────────────────────────────────┘
```

- 목록 영역 중앙에 표시
- 상단의 검색/필터 바는 유지
- 아이콘은 해당 리소스를 상징하는 라인 아이콘

### 2.2 화면별 빈 상태 정의

| 화면 | 아이콘 | 안내 문구 | CTA |
|------|--------|-----------|-----|
| Dashboard — 최근 워크플로우 | 워크플로우 아이콘 | 아직 워크플로우가 없습니다. 첫 워크플로우를 만들어보세요. | **워크플로우 만들기** → 워크플로우 생성 |
| Dashboard — 최근 실행 | 실행 아이콘 | 아직 실행 기록이 없습니다. 워크플로우를 실행하면 여기에 표시됩니다. | — (CTA 없음) |
| Workflows 목록 | 워크플로우 아이콘 | 워크플로우가 없습니다. 자동화를 시작하려면 새 워크플로우를 만들어보세요. | **새 워크플로우** → 워크플로우 생성 |
| Triggers 목록 | 트리거 아이콘 | 트리거가 없습니다. 워크플로우를 자동으로 시작하려면 트리거를 추가하세요. | **트리거 추가** → 트리거 생성 |
| Schedule 목록 | 달력 아이콘 | 스케줄이 없습니다. 워크플로우를 정기적으로 실행하려면 스케줄을 추가하세요. | **스케줄 추가** → 스케줄 생성 |
| Integration 목록 | 연결 아이콘 | 연동된 서비스가 없습니다. 외부 서비스를 연결하여 워크플로우에서 활용하세요. | **서비스 연결** → 연동 추가 |
| Executions 목록 | 실행 아이콘 | 실행 기록이 없습니다. 워크플로우를 실행하면 여기에서 결과를 확인할 수 있습니다. | **워크플로우 목록** → 워크플로우 목록 이동 |

### 2.3 검색 결과 없음

검색 또는 필터 적용 결과가 0건인 경우, 일반 빈 상태와 다른 메시지를 표시한다.

```
┌──────────────────────────────────────┐
│                                      │
│              🔍 아이콘               │
│                                      │
│   검색 결과가 없습니다.             │
│   다른 키워드로 검색하거나           │
│   필터를 변경해보세요.               │
│                                      │
│         [ 필터 초기화 ]             │
│                                      │
└──────────────────────────────────────┘
```

| 항목 | 설명 |
|------|------|
| 아이콘 | 돋보기 아이콘 |
| 안내 문구 | "검색 결과가 없습니다. 다른 키워드로 검색하거나 필터를 변경해보세요." |
| CTA | **필터 초기화** → 검색어 및 필터를 모두 초기화하여 전체 목록 표시 |
| 적용 범위 | 검색바 또는 필터가 존재하는 모든 목록 화면 공통 |

```

#### `spec/2-navigation/12-workflow-version-history.md`
```
# Spec: 워크플로우 버전 이력

> 관련 문서: [Spec 워크플로우 편집기](../3-workflow-editor/) · [데이터 모델 - WorkflowVersion](../1-data-model.md)

---

## 1. 개요

워크플로우 편집기 내부에서 캔버스의 변경 이력을 버전 단위로 추적·복원할 수 있다.

- **자동 스냅샷**: 사용자가 캔버스를 저장(`POST /workflows/:id/save`)할 때마다 서버는 동일 트랜잭션 직후 `workflow_version` 레코드를 자동으로 생성한다.
- **불변 스냅샷**: 각 버전은 저장 시점의 노드/엣지 전체 상태를 `jsonb` snapshot 으로 보관한다. 이후 캔버스가 바뀌어도 과거 버전은 변하지 않는다.
- **복원 가능**: 임의의 과거 버전을 현재 상태로 덮어쓸 수 있고, 복원 동작 자체가 새로운 버전으로 기록되어 “Restored from vN” 로 표기된다.

---

## 2. 진입점

워크플로우 편집기 우측 “⋯ (More)” 드롭다운 → **Version History** 항목을 클릭하면 우측에 사이드 패널이 열린다.

```
┌──── Editor Toolbar ────────────────────────── [Save] [Run▾] [⋯] ─┐
│ ...                                                              │
├────────────┬────────────────────────────┬────────────────────────┤
│  Palette   │   Canvas                   │   Version History 패널 │
│            │                            │   ─────────────────── │
│            │                            │   ☐ Compare versions  │
│            │                            │   v3 · 2026-04-14 ... │
│            │                            │   v2 · ...            │
│            │                            │   v1 · ...            │
└────────────┴────────────────────────────┴────────────────────────┘
```

---

## 3. 사이드 패널 동작

| 영역 | 동작 |
|------|------|
| 헤더 | 닫기(X) 버튼 |
| Compare 토글 | 활성 시 버전 항목에 체크박스 노출. 두 개 선택 후 "Diff" 버튼 클릭 → Diff 다이얼로그 열림 |
| 버전 항목 (목록 모드) | 버전 번호 / 작성자 / 생성 시각 / 변경 요약 + `상세(Eye)` · `복원(↺)` 액션 버튼 |
| 빈 상태 | "No versions yet. Save the canvas to create the first version." |
| 에러 상태 | "Failed to load versions" |

목록은 `version DESC` (최신 위) 정렬.

---

## 4. 상세 다이얼로그

선택한 버전의 snapshot 을 단일 다이얼로그에서 읽기 전용으로 표시한다.

- 워크플로우 메타 (이름, 설명)
- 노드 목록 (label / type / 좌표 / disabled 여부)
- 엣지 목록 (`source:port → target:port`)

---

## 5. Diff 다이얼로그

두 개의 버전을 동시에 fetch 하여 클라이언트 사이드로 비교한다. 낮은 버전이 “before”, 높은 버전이 “after”.

- **Name 변경**: before/after 강조
- **Added nodes / Removed nodes**: id 기준 비교
- **Modified nodes**: 동일 id 의 `label, type, category, positionX, positionY, config, isDisabled, description, containerId, toolOwnerId` 중 달라진 필드명 출력
- **Added edges / Removed edges**: `source:port → target:port` key 기준

---

## 6. 복원 다이얼로그

“복원” 액션 클릭 시 확인 다이얼로그 노출:

> The current canvas will be replaced with the snapshot from vN. The replacement is itself recorded as a new version, so you can always restore back.

확인 시 `POST /workflows/:id/versions/:versionId/restore` 호출. 성공하면 `workflow-versions` 쿼리 캐시 무효화 + **페이지 리로드**(편집기 in-memory 상태와 서버 상태가 완전히 교체되므로).

---

## 7. API 스펙

### 7.1 버전 목록

`GET /workflows/:wfId/versions`

응답: `WorkflowVersion[]` (version DESC). `creator` relation 포함.

### 7.2 버전 상세

`GET /workflows/:wfId/versions/:versionId`

응답: `WorkflowVersion` 단건 + `snapshot` 포함.

스냅샷 스키마:
```ts
interface VersionSnapshot {
  name: string;
  description: string | null;
  nodes: Array<{
    id: string;
    type: string;
    category: string;
    label: string;
    positionX: number;
    positionY: number;
    config: Record<string, unknown>;
    isDisabled: boolean;
    description: string | null;
    containerId: string | null;
    toolOwnerId: string | null;
  }>;
  edges: Array<{
    id: string;
    sourceNodeId: string;
    sourcePort: string;
    targetNodeId: string;
    targetPort: string;
    type: string;
    condition: Record<string, unknown> | null;
  }>;
}
```

### 7.3 복원

`POST /workflows/:id/versions/:versionId/restore`

응답: `{ workflow, nodes, edges }` (saveCanvas 와 동일).

### 7.4 캔버스 저장

`POST /workflows/:id/save` body 에 `changeSummary?: string` 필드 추가됨. 버전 이력에 그대로 표기된다.

---

## 8. 데이터 모델

`workflow_version` 테이블 (기존 정의):

| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid (PK) | |
| workflow_id | uuid (FK→workflow, ON DELETE CASCADE) | |
| version | int | `(workflow_id, version)` UNIQUE |
| snapshot | jsonb | 위 스키마 |
| change_summary | text NULL | |
| created_by | uuid (FK→user) | |
| created_at | timestamptz | |

---

## 9. 동작 보장

- 캔버스 저장과 버전 생성은 동일 사용자 관점에서 **원자적으로 보여야** 한다. 캔버스 트랜잭션 커밋 직후 버전이 생성되며, 버전 생성 실패 시 (드물지만) 이미 캔버스는 저장된 상태이므로 다음 저장에서 자동으로 따라잡힌다.
- 워크플로우 삭제 시 `ON DELETE CASCADE` 로 모든 버전이 함께 삭제된다.
- 복원으로 생성되는 새 버전의 `change_summary` 는 항상 `Restored from vN` 형식.

```

#### `spec/2-navigation/13-user-guide.md`
```
# Spec: User Guide (`/docs`)

> 관련 문서: [PRD 내비게이션](./_product-overview.md) · [Spec 레이아웃](./_layout.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md) · [Spec 캔버스](../3-workflow-editor/0-canvas.md)

---

## 1. 목적

제품의 UI만으로는 파악이 어려운 개념(워크플로우 구조, 노드 종류, 표현식 언어, 실행/디버깅, 연동/설정)을 **제품 내부에서** 한글로 안내한다. 별도 외부 문서 사이트 대신 `/docs` 경로로 제공하여 에디터 작업 중 즉시 접근 가능하게 한다.

## 2. 정보 구조 (IA)

```
/docs
├── 01-getting-started/
│   ├── what-is-this       # 제품 소개
│   ├── ui-tour            # 화면 구성
│   └── first-workflow     # 첫 워크플로우 만들기
├── 02-nodes/
│   ├── overview           # 노드 개념
│   ├── triggers           # Trigger 노드
│   ├── logic              # Logic 노드
│   ├── flow               # Flow 노드
│   ├── data               # Data 노드
│   ├── ai                 # AI 노드
│   ├── integrations       # Integration 노드
│   └── presentation       # Presentation 노드
├── 03-workflow-editor/
│   ├── overview           # AI 어시스턴트 개요 (UI · 대화 루프 · 도구 · 세션 · v1 한계 · 오류)
│   └── walkthrough        # AI 어시스턴트 직접 써 보기 (자연어 → 4-노드 워크플로우)
├── 04-expression-language/
│   ├── basics             # 표현식 기본
│   ├── variables-and-context  # 변수·컨텍스트
│   └── cheatsheet         # 요약 치트시트
├── 05-run-and-debug/
│   ├── running-a-workflow # 실행 방법
│   ├── run-results        # 실행 이력 조회
│   ├── error-handling     # 에러 정책
│   └── version-history    # 버전 히스토리
├── 06-integrations-and-config/
│   ├── integration-management  # 통합 관리
│   ├── llm-config             # LLM 설정
│   ├── knowledge-base         # 지식 저장소
│   └── mcp-servers            # MCP 서버 통합 (AI Agent 도구 호출용)
├── 07-workspace-and-team/
│   └── workspaces-and-members  # 개인·팀 워크스페이스, 멤버 초대, 공유 표시
└── 99-faq/                     # 항상 사이드바 맨 아래 (§5 규칙)
    └── faq
```

## 3. 라우트

| 경로 | 동작 |
| --- | --- |
| `/docs` | 허브 페이지 — `/docs/01-getting-started/what-is-this`로 리다이렉트 (또는 섹션 카드 노출) |
| `/docs/[...slug]` | 동적 MDX 렌더링. 슬러그는 파일 경로와 1:1 (예: `/docs/02-nodes/ai` → `content/docs/02-nodes/ai.mdx`) |
| 존재하지 않는 슬러그 | `notFound()` 호출 → 표준 404 |

## 4. 프론트매터 스키마

모든 MDX 파일 상단에 아래 YAML 프론트매터를 둔다.

| 키 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- |
| `title` | 필수 | string | 페이지 제목. 사이드바와 본문 H1에 사용 |
| `section` | 필수 | string | 섹션 키 (예: `02-nodes`) — 디렉터리명과 일치 |
| `order` | 필수 | number | 섹션 내 정렬 기준 |
| `summary` | 필수 | string | 사이드바 미리보기 및 OG 설명 |
| `spec` | 선택 | string[] | 1차 소스 spec 파일 경로 |
| `code` | 선택 | string[] | 검증에 사용할 코드 경로(glob 허용) |
| `draft` | 선택 | boolean | true면 production 빌드에서 제외 |

예시:

```yaml
---
title: "AI 노드"
section: "02-nodes"
order: 6
summary: "자연어 처리·분류·추출 노드의 사용법을 알아봐요."
spec: ["spec/4-nodes/3-ai/0-common.md", "spec/5-system/7-llm-client.md"]
code: ["backend/src/nodes/ai/**", "frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx"]
---
```

## 5. 섹션 순서

섹션 디렉터리명의 숫자 프리픽스(`01-`, `02-` ...)가 사이드바 표시 순서를 결정한다. 페이지 내 순서는 `order`로 결정한다.

**FAQ 섹션은 항상 사이드바 맨 아래에 위치한다.** 신규 섹션이 자유롭게 `08-`, `09-` ... 로 늘어나더라도 FAQ 가 아래로 밀려나도록, FAQ 디렉터리는 `99-faq` 와 같이 충분히 큰 숫자 프리픽스를 사용한다. `registry.ts` 의 `SECTION_LABELS` 도 `99-faq` 키로 라벨을 등록한다.

## 6. 딥링크 규약

- 사이드바 네비·Empty State·FieldHelp·다른 매뉴얼 페이지 간 링크 모두 `/docs/<dir>/<slug>` 형태를 따른다.
- 페이지 내 앵커는 `rehype-slug`가 헤딩 텍스트를 슬러그화한 값으로 자동 생성한다(예: `/docs/02-nodes/ai#fallback`).
- 에디터에서 매뉴얼로 이동하는 링크는 새 탭(`target="_blank"`)으로 열어 작업 맥락을 보존한다.
- 매뉴얼 간 링크는 기본 탭 전환(`<Link>`)을 사용한다.

## 7. 작성 정책

| 항목 | 규칙 |
| --- | --- |
| 독자 | 비기술자 + 개발자 모두. 각 페이지 "랜딩 → 상세 → 팁/참고" 3층 구조 |
| 문체 | 정중한 해요체. 세부 원칙은 [`_glossary.md`](../../frontend/src/content/docs/_glossary.md) |
| 소스 | `spec/*.md` 를 1차 소스로 재작성. `backend/src/nodes/**` 스키마와 `frontend/src/components/editor/settings-panel/node-configs/*` 로 필드명 검증 |
| 이미지 | 텍스트·ASCII·코드 예시 우선. 스크린샷은 후속 작업 |
| 예제 표현식 | `{{ ... }}` 문법. `@workflow/expression-engine`이 파싱 가능한 문법이어야 함 |

## 8. 공용 MDX 컴포넌트

| 컴포넌트 | 용도 |
| --- | --- |
| `<Steps>` | 순서형 가이드. 자식은 `<li>` |
| `<FieldTable>` | 필드 표. 컬럼: 이름·필수·타입·설명·기본값 |
| `<Callout type="note\|tip\|warn">` | 강조 박스 |
| `<Example>` | 코드/표현식 예제. 언어 태그 필수 |

## 9. 네비게이션 생성

빌드타임에 `frontend/src/lib/docs/registry.ts`가 `frontend/src/content/docs/**/*.mdx`를 스캔해 섹션 트리를 만든다.

- 프론트매터 `draft: true

... (truncated due to size limit) ...

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

### spec/conventions 정식 규약

#### `spec/conventions/cafe24-api-metadata.md`
```
# CONVENTION: Cafe24 API Metadata

> 관련 문서: [Spec Cafe24 노드](../4-nodes/4-integration/4-cafe24.md) · [Spec 통합 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24) · [Spec MCP Client §2.3 Internal Bridge](../5-system/11-mcp-client.md#23-internal-bridge)

본 컨벤션은 Cafe24 Admin API 의 endpoint 매핑 메타데이터 형식을 정의한다. backend 의 `Cafe24` 노드 핸들러와 `Cafe24McpBridge` 양쪽이 **같은 메타데이터 테이블** 을 소비한다 — 신규 endpoint 추가는 메타데이터 row 1 추가로 끝나야 한다.

---

## 1. 디렉토리 구조

```
backend/src/nodes/integration/cafe24/metadata/
  index.ts             # 18 resource 의 종합 export
  store.ts             # Store (상점)
  product.ts           # Product (상품)
  order.ts             # Order (주문)
  customer.ts          # Customer (회원)
  community.ts         # Community (게시판)
  design.ts
  promotion.ts
  application.ts       # ⚠ Cafe24 앱 관리 API — OAuth 앱 등록(credentials.app_type)과 무관. naming collision 주의
  category.ts
  collection.ts
  supply.ts
  shipping.ts
  salesreport.ts
  personal.ts
  privacy.ts
  mileage.ts
  notification.ts
  translation.ts
```

각 파일은 한 Resource 의 모든 Operation 메타데이터를 export 한다.

## 2. Operation 메타데이터 형식

```ts
interface Cafe24OperationMetadata {
  // 식별
  id: string;                    // 예: 'product_list'. resource 안에서 unique
  label: string;                 // UI 드롭다운 라벨 (한국어) 예: '상품 목록 조회'
  description: string;           // MCP tool description (영문 권장) 또는 다국어 키
  scopeType: 'read' | 'write';   // scope 매핑 — mall.read_<resource> / mall.write_<resource>. Node.category 와의 명명 충돌 회피 위해 'category' 가 아닌 'scopeType' 사용

  // HTTP 매핑
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;                  // path template. 예: 'products/{product_no}'

  // 입력 스키마
  requiredFields: string[];
  fields: {
    [fieldName: string]: {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
      location: 'path' | 'query' | 'body';
      enum?: string[];
      description?: string;
      default?: unknown;
    };
  };

  responseShape?: 'list' | 'single' | 'empty';
  paginated?: boolean;
}
```

## 3. 예시 — `product` Resource 일부

```ts
export const productOperations: Cafe24OperationMetadata[] = [
  {
    id: 'product_list',
    label: '상품 목록 조회',
    description: 'List products in the mall. Supports filtering by category, display status, date range.',
    scopeType: 'read',
    method: 'GET',
    path: 'products',
    requiredFields: ['shop_no'],
    fields: {
      shop_no:     { type: 'number',  location: 'query',  description: 'Multi-shop number (default 1)' },
      category_no: { type: 'number',  location: 'query',  description: 'Filter by category' },
      display:     { type: 'enum',    location: 'query',  enum: ['T', 'F'] },
      since:       { type: 'string',  location: 'query',  description: 'ISO8601 date — created_after' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'product_get',
    label: '상품 단건 조회',
    description: 'Get a single product by product_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}',
    requiredFields: ['product_no'],
    fields: {
      product_no:  { type: 'number',  location: 'path' },
      shop_no:     { type: 'number',  location: 'query' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_update',
    label: '상품 수정',
    description: 'Update a product (name, price, display, stock, etc).',
    scopeType: 'write',
    method: 'PUT',
    path: 'products/{product_no}',
    requiredFields: ['product_no'],
    fields: {
      product_no:    { type: 'number',  location: 'path' },
      product_name:  { type: 'string',  location: 'body' },
      price:         { type: 'string',  location: 'body', description: 'Decimal string (KRW)' },
      display:       { type: 'enum',    location: 'body', enum: ['T', 'F'] },
    },
    responseShape: 'single',
  },
];
```

## 4. 신규 endpoint 추가 절차

1. [Cafe24 공식 문서](https://developers.cafe24.com/docs/ko/api/admin/) 에서 endpoint 의 method / path / 필드 확인.
2. 해당 resource 의 metadata 파일에 §2 형식으로 row 1 추가.
3. `id` 는 `<resource>_<verb>` 형식 (예: `product_list`, `order_update_status`). 중복 금지 (resource 내).
4. `scopeType` 은 read/write 결정 — scope 매핑에 사용.
5. 백엔드 단위 테스트가 자동으로 검증:
   - 모든 `id` 의 unique
   - 모든 `path` 의 `{placeholder}` 가 `fields` 에 정의됐는지
   - `requiredFields` 가 `fields` 의 키 부분집합인지
6. **spec 본문 수정 불요** — `4-cafe24.md` 는 형식만 정의.

## 5. MCP Bridge 와의 매핑

> **레이어 경계**: 본 절의 `Cafe24McpBridge.callTool(name, args)` 와 `listTools()` 가 반환하는 도구 `name` 은 **bare operation id** (예: `product_list`) 다. MCP Client 레이어가 외부 노출 시점에 `mcp_<sid>__` prefix 를 자동 부여한다 ([Spec MCP Client §5.2](../5-system/11-mcp-client.md#52-도구-이름-규칙)). AI Agent config 의 `mcpServers[].enabledTools` 도 bare id 배열로 저장된다.

`Cafe24McpBridge.listTools()` 는 메타데이터 테이블을 순회하여 다음을 생성한다:

```ts
function operationToMcpTool(op: Cafe24OperationMetadata): McpTool {
  return {
    name: op.id,                                 // bare id — 예: 'product_list'
    description: `${op.description}\n\n(Cafe24 ${op.method} ${op.path})`,
    inputSchema: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(op.fields).map(([k, f]) => [k, fieldToJsonSchema(f)])
      ),
      required: op.requiredFields,
    },
  };
}
```

`Cafe24McpBridge.callTool(name, args)` 는 args 를 노드 핸들러의 `fields` 와 동일하게 처리하여 `Cafe24ApiClient` 로 위임 — **노드와 MCP 가 같은 호출 경로를 공유**.

## 6. allowlist 와의 관계

> 용어: **UI grouping 단위 = "카테고리"** (사용자 친화 표기) — 백엔드 메타데이터 파일 구조의 "Resource" 와 동일 범위를 가리키며, 문맥에 따라 혼용한다. spec 본문에서는 UI 맥락이면 "카테고리", 백엔드/Operation 메타데이터 맥락이면 "Resource" 사용. `Node.category` Enum 과는 별개 개념 (이름 충돌은 §2 의 `scopeType` 채택으로 이미 회피).

AI Agent `mcpServers[].enabledTools` 가 비어있으면 모든 operation 이 노출. 사용자가 `['product_list', 'product_get']` 로 좁히면 그 둘만 LLM tool 로 노출 (bare id 비교). UI 는 카테고리 단위 grouping (예: "Product (read 전부)" 체크 → 백엔드는 `['product_list', 'product_get']` 로 저장).

## 7. CHANGELOG

| 일자 | 변경 |
|------|------|
| 2026-05-13 | 신규 컨벤션 — Cafe24 API metadata 의 형식·디렉토리·추가 절차 정의. `scopeType` 필드명 채택 (`Node.category` 와의 명명 충돌 회피) |

```

#### `spec/conventions/conversation-thread.md`
```
# Conversation Thread (대화 스레드)

> 관련 문서: [Spec 실행 엔진 §6.1](../5-system/4-execution-engine.md#61-컨텍스트-구조) · [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md) · [Spec AI 공통 §11](../4-nodes/3-ai/0-common.md#11-conversation-context) · [CONVENTIONS Principle 4.5](./node-output.md#45-interactiondata-payload-규격) · [Spec 표현식 언어 §4.4](../5-system/5-expression-language.md#44-thread-속성)

워크플로우 한 실행 동안 발생하는 사용자 인터랙션과 AI 대화 turn 을 시간순으로 누적하는 1급 컨텍스트. AI Agent 노드가 노드 설정 (`contextScope`) 으로 자동 주입받는다.

---

## 1. 자료구조

### 1.1 ConversationTurnSource

| 값 | 발생원 |
|---|---|
| `presentation_user` | Form / Carousel / Table / Chart / Template 의 `output.interaction.{type}` 가 `form_submitted` / `button_click` / `button_continue` 일 때 |
| `ai_user` | AI Agent multi-turn 의 `output.interaction.type='message_received'` 시점 |
| `ai_assistant` | AI Agent (single·multi) 의 final assistant 응답 |
| `ai_tool` | KB / MCP / condition tool 결과 (opt-in 시 `includeToolTurns: true`) |
| `system` | 명시적으로 push 한 system text (예약, v1 자동 누적 없음). **주의**: AssistantMessage `role: 'system'` 과 무관 — 워크플로우 레벨의 수동 push 전용 (예: 초기 시스템 안내 turn) |

### 1.2 ConversationTurn

| 필드 | 타입 | 설명 |
|---|---|---|
| `seq` | Number | 단조 증가. append 순서 == 시간 순서. thread 내 unique |
| `nodeId` | UUID | turn 을 발생시킨 그래프 노드 |
| `nodeLabel` | String | append 시점의 라벨 snapshot (라벨 변경 후에도 표시 일관성) |
| `nodeType` | String | 예: `form`, `carousel`, `ai_agent` |
| `timestamp` | String (ISO 8601) | 서버 시각 |
| `source` | ConversationTurnSource | §1.1 |
| `text` | String | system_text injection 과 UI 의 1차 텍스트. 빈 문자열 가능 (구조화 데이터만 있는 경우) |
| `data?` | Object | 구조화 원본 — `output.interaction.data` snapshot |
| `toolCalls?` | Array<{id,name,arguments}> | `source='ai_assistant'` 한정. provider 호환성을 위해 messages 모드에서 drop 가능 |
| `toolCallId?` | String | `source='ai_tool'` 한정 |

### 1.3 ConversationThread

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | String | v1 고정값 `"default"` (multi-thread 는 v2). **port 예약어 `'default'` 와 무관** — namespace 분리. 코드에서 `DEFAULT_THREAD_ID = 'default'` 상수 추출 권장 |
| `nextSeq` | Number | 다음 append 시 부여될 seq (== `turns.length`) |
| `turns` | ConversationTurn[] | 시간순 누적 |
| `totalChars` | Number | append 시 갱신되는 누적 char 길이 캐시 (cap 빠른 경로) |

### 1.4 `text` 변환 규칙

| `interaction.type` | text |
|---|---|
| `form_submitted` | `name=John, age=30` (key=value 리스트, 200자 cap, value 가 객체/배열이면 JSON 직렬화) |
| `button_click` | `clicked: <buttonLabel>` (label 미존재 시 `<buttonId>`) |
| `button_continue` | `continued: <url>` (url 미존재 시 `continued`) |
| `message_received` (ai_user) | 메시지 본문 그대로 |
| `ai_agent` final assistant | `output.result.response` 그대로 (CONVENTIONS Principle 8.2 LLM 응답 텍스트 경로) |
| `text_classifier` final assistant (v2) | single-label: `output.result.category`. Multi-label: `output.result.categories.map(c => c.name).join(', ')` (categories 는 객체 배열이라 raw `.join` 불가). |
| `information_extractor` final assistant (v2) | `output.result.extracted` 를 항상 `JSON.stringify` 직렬화 (`responseFormat` 필드는 `ai_agent` 전용 — extractor 는 항상 구조화 출력). |

---

## 2. 자동 누적 컨트랙트

### 2.1 Presentation 노드

`status: 'resumed'` 직전, `output.interaction` 빌드 후 엔진이 자동 push:
- form `interaction.type='form_submitted'` → `source: 'presentation_user'`
- carousel/table/chart/template `interaction.type='button_click' | 'button_continue'` → `source: 'presentation_user'`

> 현재 실행 엔진의 presentation resume 코드는 `'submitted' / 'button_click' / 'button_continue'` 의 legacy status 값을 status 필드에 사용한다 (spec [실행 엔진 §1.3](../5-system/4-execution-engine.md#13-블로킹재개-컨트랙트-nodehandleroutput-status) 의 마이그레이션 노트 참조). 통일된 `'resumed'` 값으로의 마이그레이션은 별도 phase (presentation Principle 1.1 재작성) — 본 컨벤션은 status 값과 무관하게 `interaction.{type, data, receivedAt}` payload 가 emit 되는 시점에 push 가 발화함을 정의한다.

### 2.2 AI Agent

| 시점 | source |
|---|---|
| multi-turn user message 도착 (`output.interaction.type='message_received'`) | `ai_user` |
| multi-turn 매 turn 종료 시 final assistant 응답 (`output.result.response`) | `ai_assistant` |
| multi-turn condition route 시 assistant 응답 (`output.result.response`) | `ai_assistant` |
| single-turn `userPrompt` (resolved) | `ai_user` (1회) |
| single-turn 최종 `output.result.response` | `ai_assistant` (1회) |
| tool-loop 중 assistant + tool result | `ai_assistant` / `ai_tool` (opt-in `includeToolTurns: true` 시에만) |

### 2.3 v1 적용 범위 (push vs inject 구분)

| 동작 | v1 적용 범위 | v2 로드맵 |
|---|---|---|
| **Turn push (누적)** | `ai_agent` 만 — multi-turn user/assistant + single-turn final assistant 자동 push | `text_classifier` / `information_extractor` 도 final assistant push 추가 (§1.4 의 v2 표기 행) |
| **자동 주입 (inject — `contextScope` 활성화)** | `ai_agent` 만 | `text_classifier` / `information_extractor` 도 동일 인터페이스 |

> push 와 inject 를 분리해 정의하는 이유: 다른 AI 노드의 final 응답도 후속 AI Agent 가 thread 로 받게 하려는 의도였으나, 분류·추출 노드 핸들러는 final-assistant 의미 있는 시점이 ai_agent 와 다르고 (text_classifier 는 카테고리, information_extractor 는 구조화 데이터), §1.4 의 변환 규칙도 노드별로 갈라진다. v1 출하 기준은 ai_agent 만이며 (handler 코드에 push hook 존재), 다른 두 노드의 push 는 §1.4 의 변환 규칙이 합의된 v2 에서 활성화.

### 2.4 opt-out

각 노드에 공통 boolean config: `excludeFromConversationThread` (default `false`). `true` 면 해당 노드의 모든 push 가 silent skip. UI 그룹은 `Advanced > Conversation`.

---

## 3. 스코프 규칙

| 컨테이너 | 정책 |
|---|---|
| Sub-workflow (`executeInline`) | parent thread 상속·공유 |
| Background | enqueue 시점 turns 배열까지 복사한 snapshot — 격리 |
| Loop / ForEach / Map / Parallel | parent thread 상속·공유 |

### 3.1 Sub-workflow 상속 근거

`Workflow` 노드의 sync `executeInline` 경로는 부모 `ExecutionContext` 를 그대로 재사용한다 (`recursionDepth` 만 증가). 따라서 sub 안의 AI Agent 도 부모의 thread 를 본다. 사용자가 명시적으로 격리하고 싶으면 async mode 로 호출 (별도 Execution → 별도 thread).

### 3.2 Background 격리 근거

`scheduleBackgroundBody` 가 enqueue 시점에 thread 의 **turns 배열까지 함께 복사한 snapshot** 을 만든다 — 최소 `{ ...thread, turns: [...thread.turns] }` 형태. 단순 reference 복사가 아니라 새 array 인스턴스를 만들어, 백그라운드가 새 turn 을 push 해도 메인 thread 의 `turns` 가 변형되지 않음을 보장한다. ConversationTurn 객체 자체는 immutable (한 번 push 되면 수정되지 않음) 이라 깊은 복사까지 필요하지 않다.

→ 메인 흐름이 이후 발생시킨 turn 은 background 가 못 보고, background 안에서 발생한 turn 은 메인 thread 에 영향 없음. PRD 3 §4.11 ND-BG-05 ("백그라운드 실패가 메인 흐름의 Execution 상태에 영향을 주지 않음") 격리 원칙과 정합.

### 3.3 컨테이너 상속 근거

Loop / ForEach / Map / Parallel 컨테이너는 별도 ExecutionContext 를 만들지 않고 같은 context.nodeOutputCache 를 공유한다. thread 도 같은 정책. iteration 메타 (index 등) 는 thread 에 자동 주입하지 않으며, 필요시 사용자가 `{{ $loop.index }}` 등으로 명시.

---

### 2.5 nextSeq 원자성

`nextSeq` 의 단조 증가는 **단일 ExecutionContext 인스턴스 하에 직렬 실행** 보장에
의존한다. v1 의 in-memory + single-instance 환경에서는 한 execution 의 노드
처리가 한 번에 한 노드씩 진행되므로 (engine 의 `executeNode` 가 sequential)
`appendInternal` 의 `seq = thread.nextSeq; thread.nextSeq = seq + 1` 가
race-free.

다음 시나리오에서는 별도 보장이 필요:
- **Parallel 컨테이너**: 분기들이 같은 thread 에 동시 push 가능. v1 은 Parallel
  내부 thread 사용을 정의하지 않음 (관련 spec follow-up). v2 에서 분기별 child
  thread 또는 merge point 재통합 정책 결정.
- **Multi-instance / Redis 분산**: thread 가 Redis 로 옮겨가면 `INCR` 같은
  atomic operation 또는 lock 필요. v1 은 in-memory only.

---

## 4. 영속화

| 단계 | 저장소 | 비고 |
|---|---|---|
| 실행 중 | `ExecutionContext` (실행 엔진 §6.2 정책에 따라 Redis 포함 직렬화) | `ExecutionContextService.createContext` 가 빈 thread (`{ id: 'default', nextSeq: 0, turns: [], totalChars: 0 }`) 로 초기화. TTL 은 실행 타임아웃 × 2 (execution-engine §6.2) |
| 실행 후 | NodeExecution 분산 저장 | `output.interaction` (presentation, `interaction.type` ∈ form_submitted/button_click/button_continue), `output.messages` (AI 멀티턴 누적 — waiting/resumed 시), `output.result.response` (AI 최종 응답) 가 SoT. thread 자체는 재구성 가능한 derived view |
| WS payload | `EXECUTION_WAITING_FOR_INPUT` 의 `conversationThread` snapshot 동봉 (선택) | UI 가 라이브 thread 표시 가능 |

**v1 은 신규 DB 컬럼 도입 없음.** 향후 사용자 요구 명확해지면 `Execution.conversation_thread jsonb NULL` 컬럼 마이그레이션 검토.

---

## 5. AI Agent 자동 주입

`spec/4-nodes/3-ai/1-ai-agent.md` §1 의 5 신규 필드:

| 필드 | 타입 | 기본값 |
|---|---|---|
| `contextScope` | `none` / `thread` / `lastN` | `none` |
| `contextScopeN` | Integer | `20` |
| `contextInjectionMode` | `messages` / `system_text` | `messages` |
| `includeToolTurns` | Boolean | `false` |
| `excludeFromConversationThread` | Boolean | `false` |

주입 위치는 `processMultiTurnMessageInner` 의 매 turn `llmService.chat` 직전 (single-turn 은 첫 chat 직전). messages 배열을 매 turn `[system, ...injectedThread, ...selfHistory]` 로 재빌드 — `injectedThread` 에서 자기 노드가 발생시킨 turn 은 `getThreadExcludingNode` 로 제외해 중복 방지.

### 5.1 messages 모드 매핑

| turn.source | role | content prefix |
|---|---|---|
| `presentation_user` | `user` | `[from <nodeLabel>] ` |
| `ai_user` | `user` | (없음) |
| `ai_assistant` | `assistant` | (없음, `toolCalls` 보존 또는 drop) |
| `ai_tool` | `tool` | (없음, `toolCallId` 매칭) |
| `system` | `system` | (없음) — **Anthropic API 비호환**: messages 배열 내 `role: 'system'` 미지원. provider 가 anthropic 이면 `system_text` 모드 또는 별도 분기로 우회 필수. v1 자동 push 없으므로 현재 실질 문제 없음 (수동 push 도입 시 provider 분기 검증 필수). |

> **WebSocket emit 결과의 `source` 마커**: 위 매핑으로 messages 배열에 prepend 된 모든 항목은 emit 시 `source: 'injected'` 를 동봉한다. 한편 AI Agent 핸들러가 `processMultiTurnMessageInner` 등에서 실제 turn 처리 결과로 push 하는 user/assistant/tool 메시지는 `source: 'live'`. 이 마커는 [Spec WebSocket Protocol §4.4.6](../5-system/6-websocket-protocol.md#446-messagessource-마커) 의 WebSocket 페이로드 전용 2값 표식이며, 본 §1.1 의 `ConversationTurnSource` (내부 5값 enum) 와는 구별된다 — emit 단계에서 §4.4.6 의 매핑 표에 따라 축약된다.

### 5.2 system_text 모드

`thread-renderer` 가 헤더 `[#seq · timestamp · label (type) · source]` + text 본문으로 렌더해 `finalSystemPrompt` 끝에 첨부. KB guidance / condition suffix 보다 뒤.

**Sanitization**: `turn.text` 가 사용자 입력 (form 제출, ai_user 메시지) 에서 유래한 경우 prompt injection 방어를 위해 `LlmService` 의 user content sanitizer 와 동일한 방식으로 sanitize 한다.

### 5.3 Cap (v1 — char 기반)

| 상수 | 값 | 동작 |
|---|---|---|
| `MAX_INJECTED_TURNS` | `100` | 초과 시 가장 오래된 turn 부터 drop, `[... N earlier turns omitted ...]` 마커 1줄 prepend |
| `MAX_TURN_TEXT_CHARS` | `4000` | 초과 시 truncate (`...` 접미사) |
| `MAX_INJECTED_CHARS` | `200_000` | 합산 char 추가 안전망 |

`meta.contextInjection: { appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }` 디버그 echo. `appliedScope`/`appliedMode` 는 config 값의 echo 가 아니라 **실제 적용 결과** 를 표기 (예: `contextScope='thread'` 더라도 thread 가 비어있으면 `appliedScope='none'`, cap 으로 잘리면 `injectedTurns < turns.length`). Principle 2 (meta = 런타임 측정값) 정합.

---

## 6. Expression 통합

`spec/5-system/5-expression-language.md` §4.4 의 `$thread` 변수:

| 표현식 | 반환 |
|---|---|
| `$thread.turns` | ConversationTurn[] (readonly) |
| `$thread.length` | Number |
| `$thread.text` | String — system_text 렌더 결과 |

자동 주입과 독립적으로 사용자가 명시 참조 가능 (예: 별도 `transform` 노드에서 thread 가공).

---

## 7. v2 로드맵

- **Multi-thread**: 사용자 지정 key 로 한 execution 안에서 여러 thread 운영. presentation 노드가 어느 thread 에 push 할지 명시할 수 있게.
- **Token-aware cap**: 현재 char-based cap (§5.3) 을 provider tokenizer 기반으로 — 모델별 정확한 토큰 budget 고려.
- **`text_classifier` / `information_extractor` 자동 push + 주입**: §1.4 의 변환 규칙이 합의된 후 두 노드 핸들러에 push hook 추가, contextScope 적용 확장.
- **DB 컬럼 신설**: `Execution.conversation_thread jsonb` 컬럼 마이그레이션 검토 — 현재는 NodeExecution 분산 저장이라 cross-node 조회가 N+1.
- **실행 이력 화면의 ConversationThread 크로스노드 뷰**: EH-DETAIL-06 과 함께 v2 UI spec 정의.
- **Parallel 컨테이너 + Thread 정책**: 현재 §2.5 가 "Parallel 내부 thread 사용을 정의하지 않음" 으로 명시. 분기별 child thread 또는 merge point 재통합 정책 결정 필요. 사용 케이스 정의 후 spec write.
- **`$thread.text` lazy 평가**: 현재 `buildExpressionContext` 가 호출마다 전체 thread 를 system_text 로 즉시 렌더 (성능 hot path). 측정 결과 비용이 크면 `Object.defineProperty` lazy getter 또는 `$thread.text` 를 별도 key 로 분리해 명시 요청 시만 렌더.
- **Service 모듈 위치 정리**: 현재 `backend/src/modules/execution-engine/conversation-thread/` 에 types/renderer/service 가 함께 있음. types/renderer 는 pure 라 향후 `src/shared/` 또는 별도 `@workflow/conversation-thread` 패키지로 분리해 nodes/ai → execution-engine 의 의존 그래프를 단순화 검토.
- **Storage cap evict 정책**: §STORAGE_MAX_TURNS=500 은 LRU style FIFO drop. 향후 사용자 인터랙션 우선 보존 등 정책 옵션 검토.

---

## 8. Rationale

설계 결정의 근거는 [Spec AI Agent §12](../4-nodes/3-ai/1-ai-agent.md#12-rationale) Rationale 섹션에 단일 인라인 — Conversation Thread 도입 동기, 선택지 비교, v1/v2 경계, 옛 `conversationHistory` 필드 제거 사유. 본 문서는 컨벤션의 단일 진실 공급원이며 동기·역사는 AI Agent 본문에 둔다.

---

## 9. CHANGELOG

| 일자 | 변경 |
|---|---|
| 2026-05-14 | 신규 작성 — Conversation Thread 정식 도입 |
| 2026-05-16 | AI Agent 의 옛 `conversationHistory` / `historyCount` schema·UI 메타 제거 (`contextScope` / `contextScopeN` 로 단일화) |
| 2026-05-16 | §5.1 에 emit 레이어 연계 설명 신규 추가 — injection 산출 메시지가 WebSocket emit 시 `source: 'injected'` 마커를 동봉하며, 이는 [Spec WebSocket Protocol §4.4.6](../5-system/6-websocket-protocol.md#446-messagessource-마커) 의 WebSocket 페이로드 전용 2값 표식이다 (내부 `ConversationTurnSource` 5값과 구별). 디버깅 타임라인의 turn 카운팅이 backend `turnCount` 와 일치하기 위한 전제 |

```

#### `spec/conventions/migrations.md`
```
# Flyway 마이그레이션 운영 규약

## Overview

본 규약은 PostgreSQL 스키마 마이그레이션을 다음 세 가지 안전성 기준으로 운영하기 위한 정식 규칙이다.

1. **충돌 방지** — 여러 PR 이 병렬로 진행될 때 같은 V번호를 동시에 점유하는 사고를 사전에 차단한다.
2. **순서 보장** — 마이그레이션 적용 순서를 작성 의도와 일치시켜, 의존성 (예: `V<N+1>` 이 `V<N>` 컬럼을 참조) 사고를 막는다.
3. **운영 안전성** — 이미 운영에 적용된 마이그레이션을 수정해 Flyway checksum 불일치로 부팅이 실패하는 일을 막는다.

본문 절차·도구는 모두 위 세 기준을 보장하기 위한 수단이다. 실제 작성 가이드(트랜잭션 모드, NOT VALID 패턴, extension 의존성 등)는 [`backend/migrations/README.md`](../../backend/migrations/README.md) 가 담당하며, 본 문서는 **버전 번호 정책과 머지 race 안전망**에 집중한다.

---

## 1. 명명 규약

```text
backend/migrations/V<번호>__<snake_case_descriptor>.sql
backend/migrations/V<번호>__<snake_case_descriptor>.conf  # 필요한 경우만 (executeInTransaction=false 등)
```

- 번호는 **단조 증가하는 정수**. `V001__initial_schema.sql` 부터 시작해 1씩 증가한다.
- 설명자는 `snake_case`. 영문 소문자 + 숫자 + `_` 만 사용한다.
- `.conf` 페어는 항상 `.sql` 과 동일한 base name (`V<NNN>__<descriptor>`) 을 사용한다. 예: `V033__embedding_hnsw_1024.sql` ↔ `V033__embedding_hnsw_1024.conf`.
- ⚠️ **alphanumeric suffix 금지** — `V035a`, `V035_1` 처럼 정수가 아닌 접미사를 붙이면 Flyway 의 기본 version 파서가 매치에 실패해 schema_history 에 미등록된 채 silent skip 된다. 이 조건은 `backend/src/migrations.spec.ts` 가 빌드/CI 마다 자동 검증한다.

## 2. V번호 정책

- **단조 증가**: 신규 V번호는 항상 현재 main 의 max(V) **+1** 이다.
- **gap 금지**: 작업 도중 V번호를 건너뛰지 않는다. 두 개를 추가하면 `+1`, `+2` 가 되어야 한다.
- **재사용 금지**: 한번 main 에 들어간 V번호는 다른 마이그레이션으로 재할당하지 않는다.

작성 시 절차는 [§5 새 마이그레이션 추가 절차](#5-새-마이그레이션-추가-절차) 를 따른다.

## 3. Append-only 원칙

이미 main 에 들어간 V<N> 의 `.sql` / `.conf` 는 **절대 수정하지 않는다**.

- Flyway 는 부팅 시 각 적용된 마이그레이션의 SQL 내용 checksum 을 `flyway_schema_history` 와 비교한다. 파일이 한 글자라도 바뀌면 `Migration checksum mismatch for migration version NNN` 으로 부팅이 실패한다.
- 컬럼/인덱스/제약 추가·변경·삭제가 필요하면 **새 V<N+k>** 로 `ALTER`·`DROP`·`CREATE` 를 작성한다.
- 운영 사고로 어쩔 수 없이 checksum 을 재정렬해야 한다면 `migrate-repair` 서비스를 사용한다 (절차는 [`backend/migrations/README.md`](../../backend/migrations/README.md) §4 참고).

## 4. `outOfOrder=false` 유지

Flyway 의 `outOfOrder=true` 옵션은 옛 V번호가 늦게 들어와도 실행을 허용한다. 본 repo 는 이 옵션을 **명시적으로 사용하지 않는다** (Flyway 기본값 `false` 유지).

이유:
- `outOfOrder=true` 환경에서 두 PR 이 동시에 V<N+1> 을 만들고 한쪽이 V<N+2> 로 양보한 뒤 늦게 머지되면, **의도된 의존성 순서와 실제 적용 순서가 어긋난다**.
- 본 규약은 PR CI 단계에서 V번호 충돌을 잡아내므로 (`§5`), `outOfOrder` 를 켤 필요가 없다.

## 5. 새 마이그레이션 추가 절차

1. `git fetch origin main && git rebase origin/main` — base 를 최신화한다.
2. `ls backend/migrations | tail -2` 로 현재 max V 를 확인한다.
3. `V<max+1>__<descriptor>.sql` 을 작성한다. 필요하면 동일 base name 의 `.conf` 를 함께 둔다 ([`backend/migrations/README.md`](../../backend/migrations/README.md) §4·§5 참고).
4. 로컬에서 `python3 scripts/check-migration-versions.py --base origin/main` 으로 V번호 가드를 통과시킨다.
5. `make e2e-test` 로 dry-run — e2e 컨테이너의 Flyway 가 실제 마이그레이션을 적용해 본다.
6. PR 을 연다. CI 의 `migration-check` 가 동일한 검사를 다시 돌린다.

> PR open 후에는 가능한 빠르게 리뷰·머지하여 다른 PR 과의 V번호 점유 윈도우를 짧게 유지한다.

## 6. 충돌 검출 / 머지 race

본 repo 는 다음 안전망으로 V번호 충돌과 merge race 를 차단한다. 우회 가능한 단계가 있을 때마다 다음 단계가 fail-fast 로 잡도록 다층화되어 있다 — 유닛테스트 → PR CI → 머지 직전 rebase → 사후 recheck → 이미지 빌드 시점.

### 6.1 PR CI 가드 (`scripts/check-migration-versions.py`)

`pull_request` 이벤트마다 [`/.github/workflows/migration-check.yml`](../../.github/workflows/migration-check.yml) 이 실행되어 다음을 검사한다.

| 검사 | 위반 예시 | 메시지 |
| --- | --- | --- |
| 중복 | 같은 V<N>__*.sql 두 개 | `FAIL: V041 is duplicated` |
| 단조성 | 신규 V<N> 가 main_max 이하 | `FAIL: V040 is not greater than base (origin/main) max V040` |
| 연속성 | gap 발생 (예: V041 없이 V042) | `FAIL: V042 leaves a gap (expected V041 after base max V040)` |
| `.conf` 페어 | `.conf` 의 base name 이 `.sql` 과 다름 | `FAIL: V041 .conf base name does not match its .sql` |

위반 시 workflow exit 1 로 PR 머지가 막힌다. 작성자가 rebase 해 V번호를 재할당하면 즉시 재검증된다.

로컬에서 동일 검사를 돌리려면:

```bash
python3 scripts/check-migration-versions.py --base origin/main
```

### 6.2 머지 직전 rebase 규약 (운영 규약)

PR CI 가 통과한 직후 다른 PR 이 먼저 머지되어 main 의 max(V) 가 추월되는 **merge race** 가 발생할 수 있다. 본 repo 는 GitHub 무료 플랜의 private 저장소여서 branch protection 의 "Require branches to be up to date before merging" 옵션을 사용할 수 없으므로 (자세한 사유는 [§7 대안 4](#대안-4-github-branch-protection--require-branches-to-be-up-to-date)), race 차단을 다음 운영 규약으로 대체한다.

**머지 직전 확인 (작성자 책임)**

1. `git fetch origin main && git rebase origin/main` 으로 base 를 최신화한다.
2. push 후 `migration-check` 가 PR 의 latest commit 기준 green 인지 확인한다.
3. 본 PR 에 `migration-recheck-on-main` 알림 코멘트가 게시되어 있다면, 무조건 위 1·2 단계를 다시 수행한다.

이 규약은 [`/.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md) 의 Migration checklist 와 짝을 이룬다 — 작성자는 체크박스를 통해 self-confirmation 한다.

### 6.3 사후 안전망 — `migration-recheck-on-main`

`backend/migrations/**` 가 main 에 push 될 때 (= migration PR 이 머지된 직후) [`/.github/workflows/migration-recheck-on-main.yml`](../../.github/workflows/migration-recheck-on-main.yml) 이 두 가지를 자동 수행한다.

- **Post-merge sanity** — `python3 scripts/check-migration-versions.py --base HEAD~1` 를 main 에서 실행. dup / gap / 단조성 / `.conf` 페어 위반이 main 에 실제로 도달했으면 워크플로가 fail 하여 Actions 탭에 빨간불이 켜진다 (Slack/Email 알림이 연동되어 있으면 자동 통지).
- **Auto-nudge** — 열린 PR 중 `backend/migrations/**` 파일이 변경 목록에 포함된 PR 들에 "rebase + CI 재실행 필요" 코멘트를 자동 게시. PR 작성자가 race 가능성을 즉시 인지하고 §6.2 규약을 수행하도록 nudge.

두 작업 모두 머지 자체를 막진 못한다 — 무료 private 환경에서 가능한 최대 강도는 "즉시 가시화 + nudge" 다. 향후 유료 플랜으로 전환 시 [§7 대안 4](#대안-4-github-branch-protection--require-branches-to-be-up-to-date) 의 branch protection 을 §6.2 로 승격하고 본 절은 backup 으로 유지할 수 있다.

### 6.4 빌드 시점 가드 (`backend/migrations/check-duplicate-versions.sh`)

마이그레이션 Docker 이미지 ([`backend/migrations/Dockerfile`](../../backend/migrations/Dockerfile)) 빌드의 마지막 RUN 단계에서 `/flyway/sql` 디렉토리의 `V*.sql` 파일을 검사해 동일 V번호가 둘 이상이면 **빌드 자체를 fail** 시킨다. 같은 정수로 정규화되는 모든 형태(`V41` vs `V041`, `V050__a.sql` vs `V050__b.sql` 등) 가 중복으로 잡힌다.

용도는 §6.1·§6.3 와 동일한 중복 검출이지만 검사 시점이 다르다 — 다음 시나리오에서도 차단된다.

- **유닛테스트·PR CI 가 우회된 빌드** — 긴급 hotfix, 로컬 운영자의 임시 빌드, 외부 환경의 직접 `docker build`.
- **CI 가드 스크립트나 spec 자체가 잘못 수정**되어 §6.1 가 무의미해진 경우 — 빌드 단계의 가드는 동일 이미지를 사용하는 모든 환경에서 동일하게 적용되므로 정책 수정의 일시적 drift 에도 안전.

위반 출력 예 (stderr) :

```text
ERROR: duplicate Flyway migration version(s) detected in /flyway/sql:
  V041:
    - /flyway/sql/V041__one.sql
    - /flyway/sql/V041__two.sql

Policy: spec/conventions/migrations.md §6 (V번호 단조성·중복 방지).
Add a new migration with a unique V<N+1> prefix instead.
```

로컬에서 이미지 빌드 없이 같은 검사를 돌리려면:

```bash
backend/migrations/check-duplicate-versions.sh backend/migrations
```

본 가드는 §6.1 / §6.3 의 Python 가드와 동일한 V번호 정규화 규칙(`V0*([0-9]+)__`) 을 사용한다. 정책 변경이 발생하면 두 가드를 함께 갱신해야 한다.

## 7. 폐기 대안 (Rationale)

### 대안 1: 타임스탬프 prefix (`V<YYYYMMDDHHMMSS>__...`)

장점은 unique 보장이 자연스럽다는 점이지만, 다음 단점으로 폐기.

- 타임스탬프 순서가 **실제 의도된 실행 순서와 어긋날 수 있다** — 작성자 시계 차이 / merge 순서 / cherry-pick 으로 인해 의존성 깨짐이 발생한다.
- Flyway 의 단조 정수 모델과 자연스럽게 맞물리지 않아 `outOfOrder` 위험을 흡수하게 된다.
- 한 PR 의 마이그레이션을 다른 PR 의 마이그레이션 사이에 끼워 넣을 동기가 발생해 (시계 후순위) append-only 원칙이 흔들린다.

### 대안 2: `flyway.outOfOrder=true`

옛 V번호가 늦게 들어와도 실행한다. PR 충돌 부담은 줄지만:

- **의존성 사고 위험** — V<N+1> 이 V<N> 컬럼을 참조하는 코드를 작성해 두었는데, 운영 환경에는 V<N> 이 더 늦게 들어가는 케이스가 가능해진다.
- 환경별 적용 이력이 비결정적이 되어 디버깅·재현이 어려워진다.

본 규약은 `outOfOrder=false` 를 유지하고 PR CI 가드로 충돌을 사전 차단한다.

### 대안 3: GitHub Merge Queue

자동화 강도는 가장 높지만:

- GitHub plan 의존성 + 셋업 비용이 작지 않다 (private 저장소의 merge queue 는 유료 플랜 한정).
- 본 repo 규모에서는 §6.2/§6.3 의 규약 + 사후 안전망만으로도 race 빈도 대비 비용 대비 효율이 더 낫다.
- 향후 PR 동시성이 늘어 race 가 빈번해지면 재검토 후보로 둔다.

### 대안 4: GitHub branch protection — "Require branches to be up to date"

race 차단의 **정공법**이지만 본 repo 는 GitHub 무료 플랜의 private 저장소여서 다음 제약이 있다.

- Settings → Branches → Branch protection rules 의 일부 옵션 (특히 required status checks / "up to date" 강

... (truncated due to size limit) ...
