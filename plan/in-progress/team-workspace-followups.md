# 팀 워크스페이스 잔여 후속

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A
> 선행 plan: `plan/complete/feature-roadmap/04-team-workspace-ui.md`, `05-rbac-enforcement.md`, `07-org-integration-sharing.md`

## 배경

팀 워크스페이스 본체·RBAC·조직 Integration 공유는 ✅. 다음 두 항목이 후속으로 남아 있다:

- **PRD 1 §3.1 NAV-WF-07** — "팀 워크스페이스에서 공유된 워크플로우 구분 표시" (🚧 백엔드만 존재, UI 미노출)
- **PRD 1 §3.11 NAV-UP-05** — 팀 워크스페이스 멤버 관리. 가입 사용자 이메일 추가는 ✅, **미가입자 초대 토큰** 은 후속

## 관련 문서

- `prd/1-navigation.md` §3.1 NAV-WF-07, §3.11 NAV-UP-05
- `prd/0-overview.md` §6.1 (팀 워크스페이스·RBAC ✅)
- `spec/2-navigation/1-workflow-list.md` (공유 표시 위치)
- `spec/2-navigation/9-user-profile.md` (멤버 관리 UI)
- `spec/5-system/1-auth.md` (인증·초대 흐름)
- 코드: `backend/src/modules/workspaces/`, `frontend/src/components/workspace*/`

## 작업 단위

### 1. NAV-WF-07 공유 워크플로우 구분 표시

워크스페이스 격리는 백엔드에 이미 적용됨 (X-Workspace-Id 자동 매핑, 워크스페이스 멤버만 워크플로 조회). UI 에서 "공유된 워크플로우" 임을 시각적으로 구분하는 기능이 미노출.

- [ ] **결정**: "공유" 의 정의를 사용자 질의로 명확화 — (a) 팀 워크스페이스 안의 모든 워크플로 = 공유 / (b) 다른 멤버가 만들었거나 다른 멤버에게 명시적으로 공유한 것만 = 공유
- [ ] (a) 결정 시: 팀 워크스페이스 활성 시 전체 목록에 "Team" 배지 표시 (개인 워크스페이스 워크플로와 구분)
- [ ] (b) 결정 시: 워크플로의 작성자 vs. 현재 사용자 비교 + 명시적 sharedWith 컬럼 (마이그레이션 필요)
- [ ] frontend `workflow-list` 컴포넌트에 배지·필터 추가 + i18n
- [ ] 단위 테스트 + e2e
- [ ] `prd/1-navigation.md` §3.1 NAV-WF-07 상태 ✅로 갱신
- [ ] spec `2-navigation/1-workflow-list.md` 에 공유 표시 영역 정의

### 2. NAV-UP-05 미가입자 초대 토큰

현재는 가입 사용자 이메일을 직접 추가만 가능. 미가입자(아직 회원가입 안 한 이메일) 에게 초대 토큰을 발급하고, 토큰 링크로 가입 후 자동 워크스페이스 가입 흐름을 구현.

- [ ] 데이터 모델 — `WorkspaceInvitation` 엔티티 (`workspace_id`, `email`, `role`, `token` (랜덤 32+B), `expires_at`, `invited_by`, `accepted_at?`)
- [ ] 마이그레이션 추가
- [ ] 백엔드 API — `POST /api/v1/workspaces/:id/invitations` (Editor+ → 토큰 생성 + 이메일 발송), `GET /api/v1/invitations/:token` (토큰 검증), `POST /api/v1/invitations/:token/accept` (가입 후 호출, 멤버로 등록)
- [ ] 토큰 만료 (기본 7일) + 1회 사용 + 재발송 기능
- [ ] 이메일 템플릿 — 가입 링크 + 워크스페이스 이름 + 초대자 이름. SMTP 설정 우선순위는 mail 모듈의 기본 흐름 따름
- [ ] frontend — 멤버 관리 화면에 "초대" 버튼 + 이메일 입력 + 역할 선택 + 토큰 발송 상태 표시. 회원가입 페이지에서 `?invitationToken=...` 쿼리 처리 (가입 후 자동 accept 호출)
- [ ] 가입자가 가입한 다음 자동으로 워크스페이스에 가입되는 흐름 구현
- [ ] 단위/통합 테스트 (만료 / 재발송 / 잘못된 토큰 / 이미 사용된 토큰 / 역할 부여)
- [ ] `prd/1-navigation.md` §3.11 NAV-UP-05 상태 갱신 (`(가입 사용자 이메일 추가 · 미가입자 초대 토큰은 후속)` 부분 제거)
- [ ] spec `5-system/1-auth.md` 에 초대 토큰 흐름 추가
- [ ] spec `2-navigation/9-user-profile.md` 멤버 관리 화면 갱신

### 3. 매뉴얼

- [ ] `frontend/src/content/docs/` 의 워크스페이스/팀 가이드 페이지 갱신 (공유 워크플로 표시 + 초대 토큰)

### 4. REVIEW

- [ ] `ai-review` 실행 → Security (토큰 길이·만료·1회 사용·rate limit), Side Effect (이메일 발송), API Contract (RBAC) 중심

## 수용 기준

- NAV-WF-07: 사용자가 워크플로 목록에서 공유 항목을 시각적으로 구분 가능
- NAV-UP-05: 워크스페이스 Admin/Owner 가 미가입 이메일을 초대 → 토큰 메일 수신 → 가입 후 자동 워크스페이스 가입 흐름이 동작
- 토큰 보안: 만료 / 1회 사용 / rate limit / RBAC 가드 모두 회귀 잠금
- ai-review Critical/Warning 0

## 의존성·리스크

- **의존**: 없음. 팀 워크스페이스 본체와 RBAC 가 이미 ✅
- **리스크**:
  - 초대 이메일 발송에 워크스페이스 SMTP Integration 사용 시 — 어떤 SMTP를 default 로 쓸지 결정 (시스템 SMTP vs. 워크스페이스 별 설정)
  - 토큰 누출 시 권한 escalate — 1회 사용 + 짧은 만료 + 가입 시 이메일 일치 검증 필수
