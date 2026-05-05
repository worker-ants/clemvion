# Stage 5 · RBAC 가드

## 배경

`NF-SC-02` — Owner/Admin/Editor/Viewer 4단 역할. 데이터 모델에 `WorkspaceMember.role`은 있으나 API 가드·UI 권한 제어가 미적용. Stage 4(팀 워크스페이스 UI) 이후 진행.

## 설계

### 역할 정의

| 역할 | 워크플로우 | Integration | 멤버 | 설정 |
|---|---|---|---|---|
| Owner | 전체 (삭제·권한 위임 포함) | 전체 | 초대·역할·제거 | 전체 |
| Admin | 전체 (Owner 이양 외) | 전체 | 초대·역할·제거(Owner 제외) | 전체 |
| Editor | CRUD·실행 | 읽기·사용 | 읽기 | 읽기 |
| Viewer | 읽기·실행 | 사용만 | 읽기 | 읽기 |

### Backend 구현

- NestJS `@Roles(['owner', 'admin'])` 데코레이터 + `RolesGuard`
- 각 컨트롤러 메서드에 필요한 최소 역할 지정
- Workspaces 서비스에서 현재 요청의 memberId → role 조회 후 검증

### Frontend 구현

- `useCurrentRole()` 훅 — workspace-store 기반
- `<RoleGate minRole="editor">` 컴포넌트로 UI 조건부 렌더
- 권한 없는 동작 시도 → Toast 알림 + 비활성 처리

### 영향받는 파일

- 신규: `backend/src/common/guards/roles.guard.ts`, `decorators/roles.decorator.ts` (없다면)
- 수정: 각 컨트롤러 (workflows, triggers, schedules, integrations, auth-configs, llm-configs, knowledge-bases)에 `@Roles()` 추가
- 신규: `frontend/src/lib/auth/use-current-role.ts`, `frontend/src/components/auth/role-gate.tsx`
- 수정: 편집 버튼·삭제 버튼·생성 폼을 `RoleGate`로 감싸기
- 수정: PRD `NF-SC-02` → ✅

### 테스트

- backend: 각 역할별 접근 허용/차단 테스트
- frontend: RoleGate 렌더 조건 테스트

### 검증

- Viewer 계정으로 로그인 시 편집 UI 숨김·API 403
- Editor 계정으로 Integration 생성 시도 시 차단

## 구현 진행

- 인프라 (`RolesGuard`, `@Roles()`, `RoleGate`, `useHasRole`) 완료
- 백엔드 가드: workflows / triggers / schedules / integrations / llm-configs / knowledge-bases / **auth-configs / folders** 까지 `@Roles('editor')` 적용 (이번 사이클). `auth-configs/regenerate` 는 외부 호출자 중단을 유발하는 키 교체이므로 `@Roles('admin')` 으로 격상.
- 워크스페이스 자체 (rename / member-mgmt / leave / delete) 는 service-level role assertion 으로 admin/owner 분리 유지
- 프론트 UI: 목록 페이지 (workflows / integrations / llm-configs / knowledge-bases / KB-detail / alerts) + **워크플로우 에디터 툴바 (save / delete / 이름 inline rename) + triggers (create / toggle) + schedules (create / edit / delete / toggle)** 모두 RoleGate 적용 (이번 사이클). 실행 동작 (Run, Run-now) 은 Viewer 가능이므로 비가드.
- Owner 이양: `POST /workspaces/:id/transfer-ownership` 엔드포인트 신설. 트랜잭션 + FOR UPDATE 락으로 두 멤버 role 동시 swap (대상 → owner, 기존 owner → admin), `workspace.ownerId` 동기화. UI 는 워크스페이스 settings 의 Danger Zone 에 별도 카드로 분리 — owner-only 노출, 대상은 같은 워크스페이스의 모든 비-owner 멤버, 새 owner 의 이메일을 타이핑해야 확인 활성화.
