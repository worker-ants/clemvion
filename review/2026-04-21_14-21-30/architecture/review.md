## Architecture Code Review

### 발견사항

---

**[WARNING]** 컨트롤러에 비즈니스 로직 누출 (No-op update 처리)
- 위치: `workspaces.controller.ts:update()` (dto.name === undefined 분기)
- 상세: `dto.name === undefined`일 때 컨트롤러가 직접 `findById`를 호출하고 응답을 조립합니다. 이 분기는 서비스 레이어가 담당해야 할 "없으면 현재 상태 반환" 로직입니다. 컨트롤러는 라우팅·직렬화만 담당해야 합니다.
- 제안: `renameWorkspace`가 `name`이 없을 때 현재 workspace를 그대로 반환하도록 서비스에 로직을 이관. 또는 DTO 검증에서 `name`을 required로 만들어 이 분기 자체를 제거.

---

**[WARNING]** `deleteWorkspace`의 검증 순서 — 권한 체크와 타입 체크 사이에 추가 DB 조회
- 위치: `workspaces.service.ts:deleteWorkspace()`
- 상세: `getMemberRole`(DB 조회) → `findOne`(DB 조회) → 타입 체크 순서입니다. 존재하지 않는 workspace에 대해 role 조회를 먼저 하면 `getMemberRole`은 null을 반환하고 `OWNER_REQUIRED`를 던집니다. 사용자는 "권한 없음"을 받지만 실제 원인은 "존재하지 않음"입니다. `renameWorkspace`는 반대로 role 체크 → 이름 검증 → workspace 존재 체크 순서라 두 메서드 간 검증 순서가 비일관적입니다.
- 제안: workspace 존재 확인 → 타입 체크 → 권한 체크 순서로 통일. `assertWorkspaceExists(workspaceId)` 같은 private 헬퍼를 추출하면 중복도 제거됩니다.

---

**[WARNING]** `roleLabelKey` 함수 중복 정의
- 위치: `sidebar.tsx:roleLabelKey()`, `settings/page.tsx:roleLabelKey()`
- 상세: 동일한 `WorkspaceRole → TranslationKey` 매핑 함수가 두 파일에 복사되어 있습니다. 역할이 추가될 때 두 곳을 모두 수정해야 하는 산탄총 수술(Shotgun Surgery) 안티패턴입니다.
- 제안: `@/lib/i18n/workspace-role.ts` 또는 `@/lib/stores/workspace-store.ts`에 공유 함수로 추출.

---

**[INFO]** `CreateTeamWorkspaceDialog`에서 직접 `setWorkspaces` + `invalidateQueries` 이중 캐시 동기화
- 위치: `create-team-workspace-dialog.tsx:onSuccess`
- 상세: `workspacesApi.list()` 직접 호출 후 Zustand store를 수동 갱신하고, 동시에 TanStack Query 캐시도 무효화합니다. 두 상태 관리 레이어를 모두 수동으로 조율하는 패턴은 동기화 오류 가능성을 높입니다. `WorkspaceSettingsPage.refreshWorkspaces()`도 동일한 패턴을 반복합니다.
- 제안: workspace 목록 동기화 로직을 `useWorkspaceSync()` 같은 커스텀 훅으로 추출해 단일 진입점 확보.

---

**[INFO]** `providers.tsx`에서 Zustand store를 직접 subscribe하며 toast 출력
- 위치: `providers.tsx:useEffect` 내 `useLocaleStore.getState()`
- 상세: Zustand의 `getState()`를 렌더 주기 밖에서 호출하는 것은 문제없지만, Providers가 워크스페이스 전환 시의 UX 피드백(toast)과 쿼리 캐시 초기화라는 두 가지 책임을 동시에 갖게 됩니다. 책임이 늘어날수록 이 파일이 글로벌 사이드이펙트 집합소가 될 위험이 있습니다.
- 제안: 현재 규모에서는 허용 가능하지만, 워크스페이스 전환 관련 부수효과를 `useWorkspaceSwitchEffect()` 훅으로 분리해 Providers에서 호출하는 구조가 더 명확합니다.

---

**[INFO]** `DangerZoneTab`의 `workspaceRole` prop이 사용되지 않음
- 위치: `settings/page.tsx:DangerZoneTabProps` 인터페이스
- 상세: `workspaceRole: WorkspaceRole`이 props 타입에 선언되어 있지만 구현부에서 구조분해 목록에 포함되지 않아 실제로 사용되지 않습니다. 미래 확장 의도로 추정되나, 미사용 prop은 인터페이스 오염입니다.
- 제안: 실제 사용 시점까지 제거. 필요하면 그때 추가.

---

**[INFO]** `renameWorkspace`에서 이름 너무 짧을 때 `ConflictException(409)` 사용
- 위치: `workspaces.service.ts:renameWorkspace()`, `createTeam()`
- 상세: 이름 길이 검증 실패는 클라이언트 입력 오류이므로 `BadRequestException(400)`이 올바릅니다. `ConflictException(409)`은 리소스 충돌(중복 slug 등)을 위한 상태코드입니다. DTO의 `@MinLength(2)` 검증도 같은 조건을 체크하므로, 서비스 레이어의 중복 검증이 잘못된 예외 타입과 함께 존재합니다.
- 제안: `BadRequestException`으로 교체. 또는 DTO 검증에만 위임하고 서비스의 중복 검증 제거.

---

### 요약

전체적으로 Controller-Service-Repository 레이어 분리가 잘 지켜져 있고, 권한 검증을 `assertAdmin`/`assertMembership` 같은 private 헬퍼로 추출한 점, 프론트엔드에서 tab 기반으로 설정 페이지를 `OverviewTab`/`MembersTab`/`DangerZoneTab`으로 분리한 점은 좋은 설계입니다. 다만 컨트롤러에 no-op 분기 로직이 누출된 점, 서비스 메서드 간 검증 순서 비일관성, 프론트엔드의 `roleLabelKey` 중복, 이름 검증 실패 시 잘못된 HTTP 예외 타입 사용은 개선이 필요합니다. 심각한 구조적 문제는 없으며 전반적으로 안정적인 아키텍처입니다.

### 위험도

**LOW**