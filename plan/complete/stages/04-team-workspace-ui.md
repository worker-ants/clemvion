# Stage 4 · 팀 워크스페이스 UI

## 배경

`backend/src/modules/workspaces` 모듈에 워크스페이스 엔티티·서비스·컨트롤러가 존재하지만 프론트엔드는 개인 워크스페이스 하나만 다룬다. PRD `NAV-UP-04`, `NAV-UP-05`, `NAV-WF-07` 모두 🚧 상태.

## 설계

### 범위

1. **워크스페이스 전환**: 사이드바 하단 사용자 영역에 현재 워크스페이스 이름 + 전환 드롭다운
2. **워크스페이스 생성**: 드롭다운 하단 "새 팀 워크스페이스" 액션
3. **멤버 관리 페이지** `/workspace/settings`: 워크스페이스 정보·멤버 목록·초대·역할 변경·탈퇴/삭제
4. **초대 수락**: 이메일 링크 또는 앱 내 알림으로 초대 수락

### API (backend 확인 후 필요 시 추가)

- `GET /api/v1/workspaces` — 내가 속한 워크스페이스 목록
- `POST /api/v1/workspaces` — 팀 워크스페이스 생성
- `GET /api/v1/workspaces/:id/members` — 멤버 목록
- `POST /api/v1/workspaces/:id/invitations` — 이메일 초대
- `PATCH /api/v1/workspaces/:id/members/:memberId` — 역할 변경
- `DELETE /api/v1/workspaces/:id/members/:memberId` — 제거

`X-Workspace-Id` 헤더는 이미 모든 리소스 쿼리에 붙도록 설계되어 있으므로, 프론트엔드 axios client가 현재 선택된 워크스페이스 ID를 자동 주입한다.

### 프론트엔드 상태

`lib/stores/workspace-store.ts` 신규 zustand — 현재 workspaceId, 목록, switch 액션. localStorage에 최근 workspaceId 영속화.

`apiClient` 인터셉터에서 `X-Workspace-Id` 자동 주입.

### 영향받는 파일

- 신규: `frontend/src/lib/stores/workspace-store.ts`
- 신규: `frontend/src/app/(main)/workspace/settings/page.tsx`
- 수정: `frontend/src/lib/api/client.ts` (헤더 인터셉터)
- 수정: `frontend/src/components/layout/sidebar.tsx` (워크스페이스 스위처)
- 수정: backend `workspaces` 컨트롤러에 누락된 엔드포인트 보강
- 수정: `frontend/src/content/docs/06-faq/faq.mdx` Q15 갱신
- 수정: PRD 상태 `✅`

### 테스트

- frontend: workspace-store 테스트, 사이드바 스위처 테스트
- backend: 멤버 관리 API 테스트
- 통합: 워크플로우 목록이 선택된 워크스페이스 기준으로 필터되는지

### 검증

- 두 개의 워크스페이스를 만들어 전환 시 워크플로우 목록이 달라지는지
- 멤버 초대 → 다른 계정으로 수락 → 권한 반영
