## 발견사항

### [WARNING] `update` 컨트롤러의 no-op 분기 미테스트
- **위치**: `workspaces.controller.ts` — `update()` 메서드, `dto.name === undefined` 분기
- **상세**: `dto.name`이 undefined일 때 `findById`를 호출하고 현재 상태를 그대로 반환하는 로직이 있지만, 이 분기에 대한 테스트가 spec에 전혀 없음. 특히 `findById`가 null을 반환할 때 `{ data: null }`을 반환하는 케이스도 미검증.
- **제안**:
  ```ts
  it('returns current state when dto.name is undefined', async () => { ... });
  it('returns { data: null } when workspace not found in no-op path', async () => { ... });
  ```

### [WARNING] 컨트롤러 레이어 테스트 부재
- **위치**: `workspaces.controller.ts` — `update`, `remove`, `leave` 3개 엔드포인트 전체
- **상세**: 서비스 레이어(`workspaces.service.spec.ts`)에는 테스트가 잘 추가됐지만, 컨트롤러 레이어 테스트(`workspaces.controller.spec.ts` 또는 E2E 테스트)가 없음. HTTP 응답 shape(`{ data: {...} }`), Param 파이프(`ParseUUIDPipe`), 권한 guard 동작은 컨트롤러 테스트에서만 검증 가능.
- **제안**: 컨트롤러 유닛 테스트 또는 `@nestjs/testing` 기반 E2E 테스트 추가. 최소한 응답 envelope 구조(`{ data: { id, name, type, slug } }`)와 UUID 파이프 거부 동작 검증 필요.

### [WARNING] `deleteWorkspace` — 멤버/초대 cascade 미검증
- **위치**: `workspaces.service.ts` — `deleteWorkspace()` 주석: *"멤버·초대는 cascade 또는 외부 정리에 의존한다"*
- **상세**: `workspaceRepository.remove(workspace)` 호출 후 멤버·초대가 실제로 정리되는지에 대한 테스트가 없음. cascade 설정이 DB 스키마에 있어야 하는데, 현재 모킹된 테스트에서는 이 검증이 불가능. cascade가 없으면 고아 레코드가 남는 회귀 위험.
- **제안**: E2E 또는 통합 테스트에서 삭제 후 멤버/초대 레코드가 사라지는지 검증 추가. 또는 서비스에서 명시적으로 멤버를 먼저 제거하는 코드로 변경 후 테스트.

### [WARNING] `renameWorkspace` — 유효성 검사 이중화로 인한 테스트 오류 가능성
- **위치**: `workspaces.service.ts:260`과 `update-workspace.dto.ts`
- **상세**: DTO에서 `@MinLength(2)`로 먼저 걸러지므로, `renameWorkspace` 내부의 `trimmed.length < 2` 조건은 실제로 도달 불가. 그러나 spec에서는 `renameWorkspace`를 직접 호출해 이 분기를 테스트(`throws when name is too short`)하고 있어 테스트와 실제 HTTP 경로가 불일치. `name = 'A'`를 DTO 없이 서비스에 직접 전달하면 통과하지만, 실제 HTTP 요청에선 DTO validation에서 먼저 차단됨.
- **제안**: 서비스 내 길이 검사를 제거하거나, 컨트롤러 테스트에서 DTO validation 경계값을 별도 검증. 현재 서비스 테스트의 `throws when name is too short` 케이스는 실제 HTTP 경로와 다른 레이어를 검증하는 것임을 주석으로 명시.

### [INFO] `leaveWorkspace` — `memberRepo.find` mock 순서 의존성
- **위치**: `workspaces.service.spec.ts` — `refuses when requester is the sole owner` 테스트
- **상세**: `memberRepo.findOne`과 `memberRepo.find`를 모두 mock하는데, 테스트 순서가 바뀌거나 다른 테스트에서 `mockResolvedValue`를 덮어쓰면 결과가 달라질 수 있음. 현재는 `beforeEach`에서 `find: jest.fn().mockResolvedValue([])`로 초기화하고 있어 문제 없지만, `find`가 여러 케이스에서 다른 값을 반환해야 하는 테스트 추가 시 취약.
- **제안**: `mockResolvedValueOnce` 패턴을 일관되게 사용.

### [INFO] 프론트엔드 컴포넌트 테스트 없음
- **위치**: `page.tsx`, `sidebar.tsx`, `create-team-workspace-dialog.tsx`, `role-legend.tsx`
- **상세**: 신규 추가된 `OverviewTab`, `MembersTab`, `DangerZoneTab`, `CreateTeamWorkspaceDialog`, `RoleLegend` 컴포넌트에 대한 단위/통합 테스트가 없음. 특히 `DangerZoneTab`의 삭제 확인 입력(confirmInput vs workspaceName 비교) 로직은 버그 가능성이 있는 UI 로직임에도 테스트 미존재.
- **제안**: 최소한 `DangerZoneTab`의 이름 불일치 시 삭제 버튼 비활성화 및 toast 오류 발생 여부를 `@testing-library/react`로 검증.

### [INFO] `deleteWorkspace` 테스트에서 workspace not found 케이스 누락
- **위치**: `workspaces.service.spec.ts` — `deleteWorkspace` describe 블록
- **상세**: `getMemberRole`이 null을 반환하는 케이스(멤버가 아예 없는 경우)와 workspace가 존재하지 않는 케이스(`WORKSPACE_NOT_FOUND`)에 대한 테스트가 없음.
- **제안**:
  ```ts
  it('throws WORKSPACE_NOT_FOUND when workspace does not exist', async () => {
    memberRepo.findOne.mockResolvedValue({ role: 'owner' });
    workspaceRepo.findOne.mockResolvedValue(null);
    await expect(...).rejects.toMatchObject({ response: { code: 'WORKSPACE_NOT_FOUND' } });
  });
  ```

---

## 요약

서비스 레이어(`workspaces.service.spec.ts`)는 `renameWorkspace`, `deleteWorkspace`, `leaveWorkspace` 세 메서드의 핵심 분기(역할 제한, 개인 워크스페이스 차단, sole owner 보호 등)를 양호하게 커버하고 있으며 mock 설계도 격리가 잘 됨. 그러나 컨트롤러 레이어 테스트가 전혀 없어 HTTP envelope shape, UUID 파이프 동작, guard 적용 여부가 검증되지 않고, DTO validation과 서비스 내 유효성 검사의 이중화로 인해 `renameWorkspace`의 길이 검사 테스트가 실제 HTTP 경로를 대표하지 못하는 gap이 있음. 프론트엔드는 삭제 확인 로직 등 오류 가능성 있는 UI 상태 분기에 대한 컴포넌트 테스트가 전무함.

## 위험도

**MEDIUM**