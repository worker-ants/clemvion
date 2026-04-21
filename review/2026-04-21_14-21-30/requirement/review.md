### 발견사항

---

**[WARNING] `update` 컨트롤러의 no-op 분기에서 권한 검사 누락**
- 위치: `workspaces.controller.ts` — `update()` 메서드, `dto.name === undefined` 분기
- 상세: `name`이 없으면 `findById`로 현재 상태를 반환하는데, 이 경우 요청자가 해당 워크스페이스 멤버인지조차 확인하지 않는다. 임의 UUID로 `PATCH /workspaces/:id` 요청을 보내면 워크스페이스의 존재 여부와 slug가 노출된다.
- 제안: `dto.name === undefined` 분기에서도 `assertMembership` 또는 `getMemberRole`을 통한 멤버십 확인 후 반환하거나, DTO에 `@IsNotEmpty()` / `@IsDefined()` 검증을 추가해 빈 body 자체를 400으로 거부한다.

---

**[WARNING] `renameWorkspace`에서 이름 길이 오류 코드가 의도와 불일치**
- 위치: `workspaces.service.ts` — `renameWorkspace()`, 길이 검증 분기
- 상세: 코드는 이름이 100자를 초과하는 경우도 같은 `WORKSPACE_NAME_TOO_SHORT` 코드를 던진다. "너무 길다"는 조건에 "too short" 코드가 붙으므로 의도와 구현이 불일치하고, 클라이언트 측 에러 메시지 분기에도 혼동을 준다.
- 제안: 별도로 `WORKSPACE_NAME_TOO_LONG` 코드를 사용하거나, 통합 코드 `WORKSPACE_NAME_INVALID`로 통일한다.

---

**[WARNING] `deleteWorkspace`에서 cascade 처리가 "외부 정리에 의존"으로만 기술됨**
- 위치: `workspaces.service.ts` — `deleteWorkspace()` JSDoc
- 상세: 멤버·초대 레코드의 정리가 DB cascade 또는 외부 로직에 의존한다고 기술되어 있으나, 엔티티에 `onDelete: 'CASCADE'` 설정이 있는지, 없다면 orphan 레코드가 남는지 보장이 없다. 코드 리뷰 범위에 엔티티 파일이 없어 확인 불가.
- 제안: `WorkspaceMember` 엔티티의 `@ManyToOne(..., { onDelete: 'CASCADE' })` 설정을 확인하고, 설정이 없다면 `deleteWorkspace` 내에서 명시적으로 멤버·초대를 먼저 제거하는 로직을 추가한다.

---

**[WARNING] `DangerZoneTab`에서 owner가 팀 워크스페이스를 나가는 경로가 UI상 완전히 차단됨**
- 위치: `settings/page.tsx` — `DangerZoneTab`, `canLeave` 계산
- 상세: `canLeave = isTeam && !isOwner` 로 owner는 "나가기" 버튼이 표시되지 않는다. 그러나 owner가 다른 owner를 먼저 지정한 뒤 나가기를 원하는 시나리오에서는 role이 바뀌어도 페이지를 리로드하지 않으면 `isOwner`가 stale 상태로 남아 버튼이 여전히 안 보일 수 있다. 역할 변경 후 `refreshWorkspaces`를 호출하고 있으나, `currentWorkspace.role`이 워크스페이스 스토어 기준이므로 스토어 갱신 타이밍에 따라 UI 불일치가 발생한다.
- 제안: 역할 변경 뮤테이션 성공 후 `refreshWorkspaces()`를 호출해 스토어를 갱신하고, `DangerZoneTab`이 갱신된 role을 반영하도록 데이터 흐름을 확인한다. 또는 `MembersTab`과 `DangerZoneTab`이 동일한 `workspaceId` 기준 쿼리를 공유하게 한다.

---

**[INFO] `WorkspaceGroupProps` 인터페이스 선언 후 `renderWorkspaceGroup`이 함수가 아닌 일반 함수로 구현됨**
- 위치: `sidebar.tsx` — `WorkspaceGroupProps`, `renderWorkspaceGroup`
- 상세: `WorkspaceGroupProps`는 인터페이스로 정의되어 있으나 `renderWorkspaceGroup`은 React 컴포넌트가 아닌 순수 렌더 함수로 구현되어 훅 사용이 불가하고, `key={title}` prop을 인자로 받아서 JSX 내부에서만 사용할 수 있다. 현재 기능에는 문제없으나, 향후 내부 상태나 훅이 필요해지면 컴포넌트로 전환해야 한다.
- 제안: 이름을 `WorkspaceGroup` 컴포넌트로 변경하거나, 렌더 함수임을 명확히 하기 위해 `renderWorkspaceGroup` 그대로 두되 인터페이스 이름을 `RenderWorkspaceGroupArgs`로 변경한다.

---

**[INFO] `invitationsQuery`가 `adminMode`에서만 활성화되나 멤버 탭이 admin 아닌 멤버에게도 표시됨**
- 위치: `settings/page.tsx` — `MembersTab`
- 상세: `invitationsQuery`는 `enabled: adminMode` 조건이 있으나, 멤버 탭 자체는 모든 팀 멤버에게 표시된다. 따라서 viewer/editor는 멤버 목록만 조회하고 초대 목록은 볼 수 없다. 이는 의도된 동작으로 보이지만, "대기 중인 초대" 카드가 admin에게만 조건부 렌더링(`{adminMode && ...}`)되어 있어 일관성은 유지된다. 요구사항과 일치 확인 권장.
- 제안: 현재 구현이 맞다면 문서나 주석으로 명시. 만약 editor도 초대 목록을 볼 수 있어야 한다면 `enabled` 조건과 카드 렌더링 조건을 함께 수정한다.

---

**[INFO] `roleLabelKey` 함수가 `page.tsx`와 `sidebar.tsx` 두 곳에 중복 정의됨**
- 위치: `settings/page.tsx:48`, `sidebar.tsx:39`
- 상세: 동일한 switch-case 로직이 두 파일에 각각 정의되어 있다. 기능상 문제없으나 유지보수 시 한쪽만 수정될 위험이 있다.
- 제안: `@/lib/utils/workspace.ts` 또는 `@/lib/stores/workspace-store.ts` 에 공통 유틸로 추출한다.

---

### 요약

전반적으로 워크스페이스 rename/delete/leave 기능의 핵심 비즈니스 로직(Admin 권한 검사, 개인 워크스페이스 보호, 유일 owner 탈퇴 차단)은 서비스 레이어에 정확하게 구현되어 있고 테스트 커버리지도 주요 경계 케이스를 잘 포함하고 있다. 다만 컨트롤러의 no-op 분기에서 인증 없이 워크스페이스 정보를 반환하는 부분이 정보 노출 취약점이 될 수 있으며, `WORKSPACE_NAME_TOO_SHORT` 에러 코드가 "너무 길다" 조건에도 사용되는 의미 불일치가 있다. 프론트엔드는 탭 구조 분리와 위험 영역 확인 플로우가 잘 구현되어 있으나, 역할 변경 후 `DangerZoneTab`의 `isOwner` 상태 동기화 타이밍 이슈와 `roleLabelKey` 중복 정의가 향후 유지보수 부채로 남을 수 있다.

### 위험도

**MEDIUM**