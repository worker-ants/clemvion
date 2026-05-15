## 리뷰 결과

### 발견사항

---

**[WARNING] `PATCH :id` no-op 경로에서 권한 검증 누락**
- 위치: `workspaces.controller.ts` — `update()` 메서드, `dto.name === undefined` 분기
- 상세: `name`이 없으면 `renameWorkspace()`를 호출하지 않고 바로 `findById()`로 워크스페이스를 반환합니다. 이 경로는 `assertAdmin()`을 거치지 않으므로, 어떤 인증된 사용자라도 임의 UUID로 `PATCH /workspaces/:id`를 빈 바디로 호출해 워크스페이스 존재 여부와 메타데이터를 확인할 수 있습니다.
- 제안: no-op 경로를 제거하거나, `findById` 전에 멤버십 확인(`assertMembership`)을 추가하세요. 또는 DTO에서 `name`을 required로 선언해 이 분기 자체를 없애는 것이 더 단순합니다.

---

**[WARNING] `deleteWorkspace`에서 cascade 미보장 — 고아(orphan) 리소스 발생 가능**
- 위치: `workspaces.service.ts` — `deleteWorkspace()`, 주석 "멤버·초대는 cascade 또는 외부 정리에 의존한다"
- 상세: `workspaceRepository.remove(workspace)`를 호출하면 TypeORM은 DB의 `ON DELETE CASCADE`가 설정된 경우에만 연관 `WorkspaceMember`, `WorkspaceInvitation` 레코드를 자동 삭제합니다. 엔티티에 cascade 옵션이나 DB FK cascade가 없으면 멤버/초대 레코드가 남아 참조 무결성이 깨집니다. 명시적으로 주석에 "외부 정리에 의존"이라고 기재되어 있으나, 해당 정리 코드가 이 변경사항에 포함되지 않았습니다.
- 제안: 엔티티에 `@OneToMany(() => WorkspaceMember, ..., { cascade: true, onDelete: 'CASCADE' })`가 설정되어 있는지 확인하거나, `deleteWorkspace()` 내부에서 `memberRepository.delete({ workspaceId })` / `invitationRepository.delete({ workspaceId })`를 명시적으로 호출하세요.

---

**[WARNING] `leaveWorkspace`와 `removeMember`의 중복 — 동작 불일치 위험**
- 위치: `workspaces.service.ts` — `leaveWorkspace()` vs `removeMember()`
- 상세: 두 메서드 모두 `memberRepository.remove(membership)`으로 자가 탈퇴를 지원합니다. `leaveWorkspace`는 personal 워크스페이스·sole owner를 차단하지만, `removeMember`는 `member.userId !== requesterId` 조건이 false이면 `assertAdmin()`을 건너뛰므로 멤버가 직접 자신을 제거할 때 personal 워크스페이스 여부나 sole owner 체크를 하지 않습니다. 즉 `DELETE /workspaces/:id/members/:memberId`에서 자기 자신을 대상으로 하면 `leaveWorkspace`의 보호 로직이 우회됩니다.
- 제안: `removeMember`에서 `member.userId === requesterId`인 경우 `leaveWorkspace`와 동일한 가드(personal 여부, sole owner 여부)를 적용하거나, 내부적으로 `leaveWorkspace`를 호출하도록 위임하세요.

---

**[WARNING] `renameWorkspace`에서 이름 길이 오류 코드가 의미상 잘못됨**
- 위치: `workspaces.service.ts` — `renameWorkspace()`, `ConflictException`
- 상세: 이름 길이 검증 실패 시 `ConflictException` (HTTP 409)을 던지지만, 이는 리소스 충돌(slug 중복 등)에 적합한 상태 코드입니다. 길이 검증 실패는 `BadRequestException` (HTTP 400)이 맞습니다. `createTeam()`에서도 동일 코드(`WORKSPACE_NAME_TOO_SHORT`)로 `ConflictException`을 사용하는 패턴을 반복하고 있습니다.
- 제안: `ConflictException` → `BadRequestException`으로 교체하세요. 클라이언트는 `@ApiBadRequestResponse`를 이미 선언했으므로 API 계약과도 일치합니다.

---

**[INFO] `providers.tsx`에서 Zustand 구독 내부에서 `useLocaleStore.getState()` 직접 접근**
- 위치: `frontend/src/lib/providers.tsx` — workspace 전환 구독 콜백
- 상세: Zustand store를 `useEffect` 밖이 아닌 subscribe 콜백 내에서 `getState()`로 읽는 것은 정상입니다. 다만 locale이 변경되어도 이 구독은 재등록되지 않으므로 항상 최신 locale을 가져올 수 있습니다. 문제는 없으나, 향후 locale 변경 직후 워크스페이스를 전환하면 잠깐 이전 locale로 toast가 뜨는 경쟁 조건이 이론상 가능합니다. 실용적으로는 무시 가능한 수준입니다.
- 제안: 현재 구현 유지 가능. 필요 시 `translate`를 locale subscribe 시점에 캡처하지 말고 toast 내부에서 lazy하게 가져오는 방식도 동일합니다.

---

**[INFO] `CreateTeamWorkspaceDialog`에서 `setWorkspaces` + `switchWorkspace` 순서와 `providers.tsx` 구독의 toast 중복 가능성**
- 위치: `create-team-workspace-dialog.tsx` — `onSuccess`, `providers.tsx` — workspace 전환 구독
- 상세: `switchWorkspace(created.id)`를 호출하면 `providers.tsx`의 구독이 즉시 실행되어 `workspace.switched` toast를 표시합니다. 그런데 바로 직전에 `createSuccess` toast도 표시합니다. 같은 사용자 행동에 대해 toast가 두 번 연속 뜹니다.
- 제안: `CreateTeamWorkspaceDialog`에서 `createSuccess` toast를 제거하거나, 워크스페이스 생성 직후 전환 시에는 `switched` toast를 suppress하는 플래그를 두는 방식을 고려하세요.

---

**[INFO] `roleLabelKey` 함수 중복 정의**
- 위치: `sidebar.tsx`와 `workspace/settings/page.tsx` 모두 동일한 `roleLabelKey` 함수를 정의
- 상세: 동작 자체는 동일하므로 버그는 아니나, 향후 role이 추가될 때 두 곳 모두 수정해야 합니다.
- 제안: 공통 유틸로 추출하세요 (예: `@/lib/workspace-utils.ts`).

---

### 요약

이번 변경의 핵심 부작용 위험은 두 가지입니다. 첫째, `PATCH :id`의 no-op 경로가 권한 검증을 우회해 정보 노출 벡터가 됩니다. 둘째, `removeMember`의 자가 탈퇴 경로가 `leaveWorkspace`의 sole-owner·personal 워크스페이스 가드를 bypass합니다. 나머지 항목(cascade 미보장, 오류 코드 타입, toast 중복, 코드 중복)은 기능 오류보다 유지보수성·UX 이슈에 가깝습니다. 전반적인 설계(권한 계층, 워크스페이스 타입 분리, 쿼리 캐시 초기화 전략)는 일관되게 구현되어 있습니다.

### 위험도

**MEDIUM**