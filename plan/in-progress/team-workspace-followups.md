# 팀 워크스페이스 잔여 후속

> 작성일: 2026-05-11 · 결정 확정: 2026-05-12
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A
> 선행 plan: `plan/complete/feature-roadmap/04-team-workspace-ui.md`, `05-rbac-enforcement.md`, `07-org-integration-sharing.md`

## 배경

팀 워크스페이스 본체·RBAC·조직 Integration 공유는 ✅. 다음 두 항목이 후속으로 남아 있다:

- **NAV-WF-07** (`spec/2-navigation/_product-overview.md` §3.1) — "팀 워크스페이스에서 공유된 워크플로우 구분 표시" (🚧 백엔드만 존재, UI 미노출)
- **NAV-UP-05** (`spec/2-navigation/_product-overview.md` §3.11) — 팀 워크스페이스 멤버 관리. 가입 사용자 이메일 추가는 ✅, **미가입자 초대 토큰** 은 후속

## 확정된 결정 (2026-05-12)

| # | 항목 | 결정 |
| - | --- | --- |
| 1 | NAV-WF-07 공유 정의 | **팀 워크스페이스 전체** — 팀 워크스페이스의 모든 워크플로를 'Shared' 로 표시. 같은 팀 안의 "내 것/남의 것" 구분은 §2.3 소유 필터가 담당 |
| 2 | 초대 메일 SMTP | **시스템 SMTP 만** — `backend/src/modules/mail/` 그대로. 워크스페이스 SMTP Integration 미사용 |
| 3 | 가입 시 이메일 검증 | **일치 강제** — 토큰 이메일 ≠ 가입/로그인 이메일이면 가입·accept 차단. 가입 페이지에서 이메일 prefill + readOnly 로 UX 마찰 완화 |
| 4 | 초대 토큰 만료 | **7일** (default). 재발송 시 만료 시계 재시작 |

근거는 `spec/2-navigation/1-workflow-list.md#rationale`, `spec/5-system/1-auth.md#rationale` 참고.

## 관련 문서

- `spec/2-navigation/_product-overview.md` §3.1 NAV-WF-07, §3.11 NAV-UP-05 (구현 완료 후 ✅ 상태 갱신 예정)
- `spec/0-overview.md` 또는 영역 overview 의 팀 워크스페이스·RBAC 섹션
- `spec/2-navigation/1-workflow-list.md` (공유 표시 위치 · §2.1·§2.3 · Rationale §1)
- `spec/2-navigation/9-user-profile.md` (멤버 관리 UI · §4.1·§4.1.1·§6.1)
- `spec/2-navigation/10-auth-flow.md` (가입 흐름의 `?invitationToken=…` 처리 · §2.6·§6.1)
- `spec/5-system/1-auth.md` (초대 토큰 흐름 · §1.5)
- 코드: `backend/src/modules/workspaces/`, `backend/src/modules/mail/`, `frontend/src/components/workspace*/`

## 작업 단위

### 1. NAV-WF-07 공유 워크플로우 구분 표시

워크스페이스 격리는 백엔드에 이미 적용됨 (X-Workspace-Id 자동 매핑, 워크스페이스 멤버만 워크플로 조회). UI 에서 "공유된 워크플로우" 임을 시각적으로 구분하는 기능이 미노출.

**확정**: 공유 정의 = **팀 워크스페이스 전체**. 팀 워크스페이스 활성 시 모든 워크플로에 👥 Team 배지. 같은 팀 안의 작성자 단위 세분화는 §2.3 소유 필터(`내 / 공유 / 전체`)가 담당. spec 본문·Rationale 박제 완료 (`spec/2-navigation/1-workflow-list.md`).

- [x] spec `2-navigation/1-workflow-list.md` §2.1·§2.3·Rationale 갱신 (2026-05-12)
- [ ] frontend `workflow-list` 컴포넌트에 Team 배지 + 소유 필터 추가 + i18n
- [ ] 단위 테스트 (배지 노출 조건 · 필터 동작)
- [ ] e2e (개인 → 팀 워크스페이스 전환 시 배지·필터 노출 변화)
- [ ] `spec/2-navigation/_product-overview.md` §3.1 NAV-WF-07 상태 ✅로 갱신 (구현 완료 시)

### 2. NAV-UP-05 미가입자 초대 토큰

현재는 가입 사용자 이메일을 직접 추가만 가능. 미가입자(아직 회원가입 안 한 이메일) 에게 초대 토큰을 발급하고, 토큰 링크로 가입 후 자동 워크스페이스 가입 흐름을 구현.

**확정 정책** — spec 본문에 박제 완료:

- 토큰 길이 64자 base64url (`crypto.randomBytes(48)`), 만료 **7일**, **1회 사용**, 재발송 시 기존 토큰 invalidate + 만료 재시작
- 이메일 일치 **강제** — 토큰의 email ≠ 로그인/가입 사용자 email 이면 가입·accept 모두 차단 (400 `invitation_email_mismatch`)
- 발송 채널 = **시스템 SMTP 만** (`backend/src/modules/mail/`). 워크스페이스 SMTP Integration 미사용
- 가입 페이지 prefill: `GET /api/invitations/:token` 으로 메타 prefetch → 이메일을 prefill + readOnly 로 고정
- 가입 트랜잭션: User 생성 + WorkspaceMember 추가 + `invitation.acceptedAt` 갱신을 단일 트랜잭션으로 처리. 초대 토큰 가입 경로에서는 §6.1 의 개인 워크스페이스 자동 생성을 **발화하지 않음**

체크리스트:

- [x] spec `5-system/1-auth.md` §1.5 초대 토큰 흐름 + Rationale (2026-05-12)
- [x] spec `2-navigation/9-user-profile.md` §4.1·§4.1.1·§6.1 갱신 (재발송 API 추가) (2026-05-12)
- [x] spec `2-navigation/10-auth-flow.md` §2.6·§6.1·§8 갱신 (`?invitationToken=…` 처리 + 자동 워크스페이스 생성 분기) (2026-05-12)
- [x] 데이터 모델 — `WorkspaceInvitation` 엔티티 점검 완료. partial UNIQUE on `(workspace_id, email) WHERE accepted_at IS NULL` 가 마이그레이션 V017 에 이미 존재 → 정책상 `invite()` 가 대기 row 를 invalidate+overwrite 하는 방식으로 충돌 없이 단일 토큰을 유지. (2026-05-12)
- [x] 마이그레이션 — V017 위에 변경 없음 (정책을 row 갱신 방식으로 흡수)
- [x] 백엔드 API (2026-05-12, commit `e697daef`)
  - `POST /api/workspaces/:id/invitations` (Admin+)
  - `POST /api/workspaces/:id/invitations/:invitationId/resend` (Admin+)
  - `DELETE /api/workspaces/:id/invitations/:invitationId` (Admin+)
  - `GET /api/invitations/:token` (@Public, prefill용)
  - `POST /api/workspaces/invitations/accept` (로그인 사용자, 이메일 일치 강제)
  - `POST /api/auth/register` 본문에 `invitationToken?` 받아 단일 트랜잭션 처리
- [x] Rate limit — invite·resend 에 분당 10회 (`@Throttle`)
- [x] 이메일 템플릿 — `mail.service.sendWorkspaceInvitationEmail(email, workspaceName, invitedByName, token)` 으로 초대자 이름 포함. **시스템 SMTP** 로 발송
- [ ] frontend — 멤버 관리 화면에 "초대" 버튼 + 이메일·역할 입력 + 대기 중 초대 목록(만료 표시 / 재발송 / 취소) — **다음 세션**
- [ ] frontend — 회원가입 페이지에서 `?invitationToken=…` 처리 (메타 prefetch → 이메일 prefill+readOnly → 초대 워크스페이스로 진입) — **다음 세션**
- [x] 단위 테스트 (백엔드) (2026-05-12, lint 0 errors / 3235 tests pass)
  - accept: 이메일 불일치 → 400 / 만료 → 410 / 중복 사용 → 410 / 정상 흐름 / 동시 accept 경쟁 (UPDATE affected=0 → 410)
  - register with invitationToken: 이메일 불일치 reject / 트랜잭션 롤백 / 자동 워크스페이스 생성 미발화 / 자동 로그인 토큰 발급
  - 재발송: 기존 토큰 invalidate + 새 토큰 발급 확인
  - invite: 대기 중 동일 이메일은 덮어쓰기 (충돌 reject 아님)
- [ ] e2e — 초대 → 메일 수신 (개발 `console` transport) → 가입 → 자동 멤버 등록 (백엔드 e2e 인프라 정비 후. 현재 e2e 스위트는 인프라 의존으로 skipped)
- [ ] `spec/2-navigation/_product-overview.md` §3.11 NAV-UP-05 상태 갱신 (frontend·전체 e2e 완료 시 `(가입 사용자 이메일 추가 · 미가입자 초대 토큰은 후속)` 부분 제거)

### 3. 매뉴얼

- [ ] `frontend/src/content/docs/` 의 워크스페이스/팀 가이드 페이지 갱신 (공유 워크플로 표시 + 초대 토큰)

### 4. REVIEW

- [ ] `ai-review` 실행 → Security (토큰 길이·만료·1회 사용·이메일 일치 강제·rate limit), Side Effect (이메일 발송), API Contract (RBAC), Concurrency (동시 accept 경쟁) 중심

## 수용 기준

- NAV-WF-07: 사용자가 워크플로 목록에서 공유 항목을 시각적으로 구분 가능
- NAV-UP-05: 워크스페이스 Admin/Owner 가 미가입 이메일을 초대 → 토큰 메일 수신 → 가입 후 자동 워크스페이스 가입 흐름이 동작
- 토큰 보안: 만료 / 1회 사용 / rate limit / RBAC 가드 모두 회귀 잠금
- ai-review Critical/Warning 0

## 의존성·리스크

- **의존**: 없음. 팀 워크스페이스 본체와 RBAC 가 이미 ✅
- **리스크 / 대응**:
  - 토큰 누출 시 권한 escalate → 1회 사용 + 7일 만료 + **이메일 일치 강제** 로 대응 (확정)
  - 동시 accept 경쟁 → `UPDATE … WHERE accepted_at IS NULL RETURNING …` 로 직렬화
  - 이메일 폭격 → 워크스페이스·invited_by 단위 rate limit 필수
  - UX 마찰 (이메일 일치 강제) → 가입 페이지에서 이메일 prefill + readOnly 로 완화 (사용자가 이메일을 "고를" 필요 없음)
