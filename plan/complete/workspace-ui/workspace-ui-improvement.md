# Workspace 관리 UI 개선 — 완료 (2026-04-21)

## 결과 요약

"워크스페이스 관리 UI가 이해하기 어렵다"는 피드백을 해소하기 위해 P0 → P1 → P2 3단계를 모두 구현했다. SDD + TDD, 이후 `ai-review` 리뷰를 거쳐 Warning 9건 전원 조치 완료.

### Step 1 — 이해도 즉시 개선 (P0)
- Sidebar workspace switcher: muted 색상 → accent bg + primary 아이콘 + 2줄 구성(이름 / 타입·역할)
- Personal=User 아이콘, Team=Users 아이콘 타입별 구분
- Workspace 전환 시 `workspace.switched` toast (providers.tsx)
- Role legend 컴포넌트 — 역할 4단계(Owner/Admin/Editor/Viewer) 권한을 한 줄 칩으로 표시
- i18n: 개인/팀 설명 문구, 역할 범례, 전환 toast, 탭 라벨, danger zone 텍스트 ko/en 추가

### Step 2 — 구조 정비 (P1)
- shadcn primitives 추가: `Tabs`, `Dialog` (기존 tooltip/popover와 동일 Radix 패턴)
- Sidebar 드롭다운 그룹화: "내 워크스페이스" / "팀 워크스페이스" + "+ 새 팀 워크스페이스" / "현재 워크스페이스 설정"
- `CreateTeamWorkspaceDialog` 신규 — 이름 1필드 + 자동 전환. Settings 페이지의 기존 인라인 생성 카드 제거
- Settings 페이지 전면 재편: 3개 탭 구조 (개요 / 멤버 / 위험 영역) + 페이지 헤더에 타입 아이콘·설명
- 멤버 관리: `addMember` 대신 `invite` API 사용 + 대기 초대 목록/취소

### Step 3 — 미구현 기능 (P2)
- Backend API 3건 추가:
  - `PATCH /workspaces/:id` — 이름 변경 (Admin+)
  - `DELETE /workspaces/:id` — 워크스페이스 삭제 (Owner, team 전용, transaction + 멤버/초대 명시 삭제)
  - `POST /workspaces/:id/leave` — 자가 탈퇴 (본인, 유일한 owner 차단, transaction + FOR UPDATE)
- Service 수정: `removeMember`의 자가 탈퇴 경로를 `leaveWorkspace`로 위임해 가드 일관화
- Frontend `workspacesApi.update / delete / leave` 메서드 추가

## 리뷰 조치

Critical 0, Warning 9 모두 해결:
1. PATCH no-op 분기 제거 — DTO `name` required, 인증 우회 경로 제거
2. `leaveWorkspace` TOCTOU — transaction + pessimistic_write
3. `removeMember` 자가 탈퇴 → `leaveWorkspace` 위임
4. `deleteWorkspace` cascade — `WorkspaceInvitation` 명시적 삭제
5. 두 위험 동작 모두 transaction 감쌈
6. 길이 검증 `ConflictException` → DTO `@MinLength/@MaxLength`로 위임
7. 컨트롤러 no-op 분기 제거
8. `workspaces.controller.spec.ts` 신규 작성 (6 테스트)
9. 서비스 테스트에서 중복된 길이 검증 케이스 제거

조치 상세: `review/2026-04-21_14-21-30/RESOLUTION.md`

## 검증

- Backend lint/tsc/tests(1435 passed)/build ✓
- Frontend lint/tsc/tests(990 passed)/build ✓

## 관련 파일

### Frontend
- `src/components/layout/sidebar.tsx` (전환 UI)
- `src/components/workspace/create-team-workspace-dialog.tsx` (신규)
- `src/components/workspace/role-legend.tsx` (신규)
- `src/components/ui/dialog.tsx`, `tabs.tsx` (신규 primitives)
- `src/app/(main)/workspace/settings/page.tsx` (탭 구조 재편)
- `src/lib/api/workspaces.ts` (update/leave/delete 추가)
- `src/lib/providers.tsx` (전환 toast)
- `src/lib/utils/workspace.ts` (신규 roleLabelKey)
- `src/lib/i18n/dict/{ko,en}.ts`

### Backend
- `src/modules/workspaces/workspaces.service.ts` (rename/leave/delete + removeMember 리팩터)
- `src/modules/workspaces/workspaces.controller.ts` (PATCH/DELETE/leave)
- `src/modules/workspaces/dto/update-workspace.dto.ts` (신규)
- `src/modules/workspaces/workspaces.controller.spec.ts` (신규)
- `src/modules/workspaces/workspaces.service.spec.ts` (테스트 보강)

### Docs
- `spec/2-navigation/9-user-profile.md` — 관리 화면 mock-up & API 목록 실제 구현 반영
