# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`  
대상 영역: `spec/5-system/` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md)  
검토일: 2026-06-10

---

## 발견사항

### [CRITICAL] 초대 토큰 저장 정책 — raw vs hash 불일치

- **target 위치**: `spec/5-system/1-auth.md §1.5.1` "저장 형태" 행
- **충돌 대상**: `spec/data-flow/12-workspace.md §1.2 / §1.5 시퀀스 다이어그램`
- **상세**:
  - `spec/5-system/1-auth.md §1.5.1`은 "DB 에는 토큰 자체를 저장 (`WorkspaceInvitation.token`, UNIQUE) — URL 조회 시 즉시 lookup"이라고 명시한다 (raw token DB 저장).
  - 반면 `spec/data-flow/12-workspace.md §1.2` 시퀀스에서 `Svc->>PG: INSERT workspace_invitation (... token ...)` 패턴으로 동일하게 raw 저장을 기술하며, `spec/data-flow/12-workspace.md §3.1 테이블`도 `token UNIQUE (V017)` 로 일치한다. 두 문서 간 자체 모순은 없다.
  - **그러나** `spec/5-system/1-auth.md §1.1`은 이메일 인증 토큰(`emailVerifyToken`)과 비밀번호 재설정 토큰(`passwordResetToken`)에 대해 **SHA-256 해시만 저장**하는 정책을 선언하고 있다. 초대 토큰(`WorkspaceInvitation.token`)만 예외적으로 raw 저장하는 근거(Rationale)가 1-auth.md 어디에도 없다. 동일 파일 내에서 "이메일 인증 / 비밀번호 재설정 토큰은 해시 저장" 과 "초대 토큰은 raw 저장" 이 병치되어 있어, 구현자가 초대 토큰도 hash 정책을 적용해야 한다고 오해할 수 있다.
  - 이 문서가 `security-fixes` 브랜치의 target임을 감안하면, 보안 수정 목적으로 초대 토큰도 해시 저장으로 변경하는 작업이 포함될 수 있으며, 이 경우 1-auth.md §1.5.1의 "저장 형태" 행과 data-flow/12-workspace.md 시퀀스/테이블 모두를 동시에 갱신해야 한다.
- **제안**:
  1. 초대 토큰의 raw 저장을 의도적으로 유지한다면 1-auth.md §1.5.1 에 이유를 명시하는 Rationale(§1.5.D)를 추가한다 (예: "공개 조회(`GET /api/invitations/:token`)에서 URL 파라미터로 직접 lookup 하므로 별도 hash 변환 없이 UNIQUE 조회 가능 — 이미 HTTPS 전송으로 토큰 기밀성 보장").
  2. 보안 수정으로 hash 저장으로 전환한다면 1-auth.md §1.5.1 저장 형태 행과 data-flow/12-workspace.md §1.2 시퀀스·§3.1 테이블을 함께 갱신한다.

---

### [CRITICAL] User 엔티티 — `password_hash` nullable 여부 불일치

- **target 위치**: `spec/5-system/1-auth.md §1.1` "비밀번호 저장" 행
- **충돌 대상**: `spec/1-data-model.md §2.1 User` 테이블
- **상세**:
  - `spec/5-system/1-auth.md §1.1`은 "`user.password_hash` 는 nullable — OAuth 단독 가입 사용자는 NULL"이라고 명시한다.
  - `spec/1-data-model.md §2.1` User 엔티티 필드 테이블에서 `password_hash` 컬럼의 타입은 `String`으로 정의되어 있으며 `?` (nullable 표기)가 없다. 다른 nullable 필드(`avatar_url String?`, `two_factor_secret String?` 등)는 모두 `?`로 명시된 패턴과 일치하지 않는다.
  - 두 문서가 동일 필드를 다르게 기술하고 있어, 마이그레이션 파일 작성·ORM 엔티티·DTO 검증 로직에서 혼란을 야기할 수 있다.
- **제안**: `spec/1-data-model.md §2.1`의 `password_hash` 행을 `String?`으로 수정하고 설명에 "bcrypt 해시. OAuth 단독 가입 사용자는 NULL" 문구를 추가한다.

---

### [CRITICAL] User 엔티티 — `login_attempts`, `locked_until` 필드 누락

- **target 위치**: `spec/5-system/1-auth.md §1.1` "로그인 실패 5회 시 10분 잠금"
- **충돌 대상**: `spec/1-data-model.md §2.1 User` 테이블, `spec/data-flow/2-auth.md §3.2`
- **상세**:
  - `spec/5-system/1-auth.md §1.1`은 "5회 실패 시 10분 잠금, 이메일 알림" 정책을 선언한다.
  - `spec/data-flow/2-auth.md §3.2`는 `user.locked_until`, `user.login_attempts` 컬럼을 구체적으로 참조하며(`UPDATE user SET login_attempts, locked_until`), 잠금 임계·초기화 로직을 상세히 기술한다.
  - 그러나 `spec/1-data-model.md §2.1 User` 엔티티 필드 테이블에는 `login_attempts`와 `locked_until` 컬럼이 정의되어 있지 않다. 데이터 모델이 불완전한 상태이며, 마이그레이션 참조 시 누락될 수 있다.
- **제안**: `spec/1-data-model.md §2.1 User` 테이블에 `login_attempts Integer` (기본값 0)와 `locked_until Timestamp?` 컬럼을 추가한다.

---

### [CRITICAL] User 엔티티 — 이메일 인증 관련 필드 누락

- **target 위치**: `spec/5-system/1-auth.md §1.1` "이메일 인증 필수", "토큰 at-rest 저장"
- **충돌 대상**: `spec/1-data-model.md §2.1 User` 테이블, `spec/data-flow/2-auth.md §1`
- **상세**:
  - `spec/5-system/1-auth.md §1.1`은 회원가입 시 이메일 인증이 필수이며, `emailVerifyToken`을 SHA-256 해시로 저장한다고 정의한다.
  - `spec/data-flow/2-auth.md §1`은 `INSERT INTO "user" (email_verify_token, email_verify_expires_at, email_verified=false)` 패턴과 `user.email_verified`, `user.oauth_provider`, `user.oauth_provider_id` 등을 직접 참조한다.
  - 그러나 `spec/1-data-model.md §2.1 User` 엔티티 정의에는 `email_verified`, `email_verify_token`, `email_verify_expires_at`, `oauth_provider`, `oauth_provider_id`, `password_reset_token`, `password_reset_expires_at` 등 인증 운영에 필수적인 필드들이 모두 누락되어 있다.
  - 데이터 모델이 구현·마이그레이션의 기준으로 사용될 때 spec 불완전성이 직접 영향을 준다.
- **제안**: `spec/1-data-model.md §2.1 User` 테이블에 인증 관련 필드 전체를 추가한다. data-flow/2-auth.md에서 참조하는 필드 목록을 기준으로 동기화한다.

---

### [WARNING] 초대 토큰 Rate Limit — 구체 값 불일치

- **target 위치**: `spec/5-system/1-auth.md §1.5.1` "Rate Limit" 행
- **충돌 대상**: `spec/data-flow/12-workspace.md §1.2`
- **상세**:
  - `spec/5-system/1-auth.md §1.5.1`은 초대 발송·재발송 rate limit를 "워크스페이스·invited_by 단위 분당 N회 (구현 시 결정)"로 열어 두었다.
  - `spec/data-flow/12-workspace.md §1.2`는 "초대 발급·재발송은 분당 10건 (`workspaces.controller.ts` `INVITATION_THROTTLE`)"으로 구체적인 값과 코드 참조까지 기술하고 있다.
  - 값이 결정된 상태에서 auth spec이 아직 "N회 (구현 시 결정)"로 남아 있어, 두 문서 간 동기화가 필요하다.
- **제안**: `spec/5-system/1-auth.md §1.5.1` Rate Limit 행을 "워크스페이스·invited_by 단위 분당 10건 (`INVITATION_THROTTLE`)" 으로 갱신한다.

---

### [WARNING] 초대 재발송 에러 코드 — `invitation_already_accepted` 정의 누락

- **target 위치**: `spec/5-system/1-auth.md §1.5.4` 에러 응답 표
- **충돌 대상**: `spec/data-flow/12-workspace.md §1.8`, `spec/conventions/error-codes.md §3`
- **상세**:
  - `spec/data-flow/12-workspace.md §1.8`은 초대 재발송(`/resend`)과 취소(`DELETE`) 시 수락된 초대에 대해 `409 invitation_already_accepted`를 반환한다고 정의한다.
  - `spec/5-system/1-auth.md §1.5.4` 에러 응답 표에는 이 코드가 없다. 표에는 `invitation_already_used (410)`만 존재한다.
  - `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에는 `invitation_already_used`만 열거되어 있으며 `invitation_already_accepted`는 없다.
  - 두 코드가 다른 문맥(수락=accept 후 사용 시도 vs 재발송/취소 시 이미 수락된 초대)에서 사용된다면 §1.5.4와 error-codes.md에 `invitation_already_accepted`를 추가해야 한다.
- **제안**: `spec/5-system/1-auth.md §1.5.4` 표에 `| 이미 수락됨 (재발송·취소 시) | 409 | invitation_already_accepted |` 행을 추가하고, `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에도 등재한다.

---

### [WARNING] 초대 가입 요청 본문 — email 필드 포함 여부 불일치

- **target 위치**: `spec/5-system/1-auth.md §1.5.2` 흐름 4번 단계
- **충돌 대상**: `spec/2-navigation/10-auth-flow.md §2.1, §2.6`
- **상세**:
  - `spec/5-system/1-auth.md §1.5.2`는 초대 토큰으로 가입 시 `POST /api/auth/register { name, password, invitationToken }` (email 없음, 서버가 토큰에서 신뢰)로 기술한다.
  - `spec/2-navigation/10-auth-flow.md §2.1`은 일반 가입을 `POST /api/auth/register { name, email, password, invitationToken? }`로, §2.6은 초대 가입 시 "이메일은 토큰에서 서버가 신뢰"라고 명시하면서도 같은 문서 §2.1에서 email을 포함한 body 형식을 기술한다. 즉 10-auth-flow.md §2.6의 설명은 1-auth.md와 일치하지만, §2.1의 일반 register body 스펙에 `email`이 포함된 것이 혼재 상태를 만든다.
  - 서버 구현 입장에서 `invitationToken`이 있을 때 `email`을 body에서 받는지 무시하는지가 명확히 정의되어야 한다.
- **제안**: `spec/5-system/1-auth.md §1.5.2`에 "서버는 `invitationToken` 존재 시 본문의 `email` 필드를 무시하고 토큰의 email을 사용한다"는 문구를 추가하거나, register 엔드포인트의 request body 스키마를 통합 정의한다.

---

### [INFO] `POST /api/auth/resend-verification` 엔드포인트 경로 표기 불일치

- **target 위치**: `spec/5-system/1-auth.md §1.1` "인증 메일 재발송" 행
- **충돌 대상**: `spec/2-navigation/10-auth-flow.md §API 목록`, `spec/5-system/1-auth.md §5 API 엔드포인트`
- **상세**:
  - `spec/5-system/1-auth.md §1.1` 표에서 경로가 `POST /auth/resend-verification` (`/api/` prefix 없음)으로 기술된다.
  - `spec/2-navigation/10-auth-flow.md §API 목록` 및 동일 1-auth.md §5 API 엔드포인트 표의 다른 모든 항목은 `/api/auth/...` 형식을 사용한다.
  - §5 엔드포인트 목록에는 `resend-verification`이 아예 없다.
- **제안**: `spec/5-system/1-auth.md §1.1` 표의 경로를 `POST /api/auth/resend-verification`으로 수정하고, §5 API 엔드포인트 목록에도 추가한다.

---

### [INFO] `WorkspaceInvitation` 엔티티 — 데이터 모델에 미정의

- **target 위치**: `spec/5-system/1-auth.md §1.5.1`, `§1.5.2`
- **충돌 대상**: `spec/1-data-model.md` (전체)
- **상세**:
  - `spec/5-system/1-auth.md §1.5`는 `WorkspaceInvitation.token`, `WorkspaceInvitation.acceptedAt` 등을 참조한다.
  - `spec/data-flow/12-workspace.md §3.1`에서 `workspace_invitation` 테이블의 컬럼 목록이 기술되지만, `spec/1-data-model.md`에는 `WorkspaceInvitation` 엔티티 섹션이 없다.
  - 데이터 모델 문서가 단일 진실 원칙상 모든 엔티티의 정의를 포함해야 하나, 초대 엔티티가 누락된 상태다.
- **제안**: `spec/1-data-model.md`에 `WorkspaceInvitation` 엔티티 섹션을 추가하거나, data-flow/12-workspace.md §3.1을 정식 SoT로 지정하고 교차 참조를 명시한다.

---

## 요약

`spec/5-system/1-auth.md`의 핵심 충돌은 `spec/1-data-model.md §2.1 User` 엔티티 정의와의 불일치다. User 엔티티에서 `password_hash`의 nullable 여부, `login_attempts`·`locked_until`·이메일 인증 관련 컬럼(`email_verified`, `email_verify_token` 등) 이 모두 누락되어 있어, 데이터 모델이 인증 구현의 실제 DB 스키마를 반영하지 못하고 있다. 초대 토큰의 저장 방식(`raw` 저장)이 동일 문서 내 다른 토큰(`SHA-256 해시 저장)과 이유 없이 병치되어 있어 보안 수정 브랜치에서 혼란을 줄 수 있다는 점도 CRITICAL 수준의 위험이다. Graph RAG(10-graph-rag.md)와 MCP Client(11-mcp-client.md)는 데이터 모델(§2.11 KnowledgeBase, §2.12 Document, §2.12.2–4 Entity/Relation/ChunkEntity, §2.10 Integration)과 일관성이 유지되고 있어 충돌이 발견되지 않았다.

---

## 위험도

**HIGH**

STATUS: SUCCESS
