### 발견사항

---

**[WARNING] `renameWorkspace`에서 멤버십 조회와 워크스페이스 조회가 순차적으로 발생**
- 위치: `workspaces.service.ts` — `renameWorkspace()`
- 상세: `assertAdmin()` → `getMemberRole()` → DB 쿼리 후, 이름 유효성 통과 시 `findOne()` 로 워크스페이스를 다시 조회. 이름이 유효하지 않으면 워크스페이스 조회 자체가 불필요하나, 현재 로직은 순서상 문제없음. 그러나 `assertAdmin()`과 워크스페이스 `findOne()`을 병렬로 실행할 수 있는데 직렬로 처리 중.
- 제안:
  ```ts
  const [role, workspace] = await Promise.all([
    this.getMemberRole(workspaceId, requesterId),
    this.workspaceRepository.findOne({ where: { id: workspaceId } }),
  ]);
  ```
  단, 권한 없는 경우 워크스페이스 조회를 낭비하게 되므로 실제 트레이드오프 고려 필요.

---

**[WARNING] `deleteWorkspace`에서 멤버십과 워크스페이스를 직렬 조회**
- 위치: `workspaces.service.ts` — `deleteWorkspace()`
- 상세: `getMemberRole()` 완료 후에야 `workspaceRepository.findOne()`을 호출. 두 쿼리는 독립적이므로 병렬화 가능.
- 제안: `renameWorkspace`와 동일하게 `Promise.all` 적용. 단, role이 owner가 아니면 early throw하므로 eager fetch가 낭비일 수 있음. 트래픽이 적은 admin 엔드포인트이므로 현재 수준도 허용 범위.

---

**[WARNING] `leaveWorkspace`에서 owner 확인 쿼리가 조건부로 발생 (구조는 적절)**
- 위치: `workspaces.service.ts` — `leaveWorkspace()`
- 상세: 총 3번의 DB 왕복(workspace → membership → owners). 순서 의존성이 있어 병렬화 범위 제한적. `workspace`와 `membership`은 독립적이므로 병렬 가능.
- 제안:
  ```ts
  const [workspace, membership] = await Promise.all([
    this.workspaceRepository.findOne({ where: { id: workspaceId } }),
    this.memberRepository.findOne({ where: { workspaceId, userId: requesterId } }),
  ]);
  ```
  이후 순차 검증 처리.

---

**[INFO] 컨트롤러 `update()`의 no-op 경로에서 불필요한 DB 조회**
- 위치: `workspaces.controller.ts` — `update()`, line ~116
- 상세: `dto.name === undefined`일 때 `findById()` 호출 후 응답. 프론트엔드 클라이언트가 항상 `name`을 보낸다면 이 경로는 사실상 dead code이나, 방어적 처리가 DB 호출을 유발. 클라이언트 측 `update()`도 `{ name?: string }` 패치를 보내므로 이름 없이 호출될 수 있음.
- 제안: DTO에 `@MinLength(2)` 검증이 있으므로, 클라이언트 레이어에서 값이 없으면 요청 자체를 막도록 가이드하거나, 서버에서 빈 패치를 `400`으로 거부하는 것이 더 명시적이고 DB 쿼리를 줄임.

---

**[INFO] `MembersTab`에서 `membersQuery`와 `invitationsQuery`가 각각 독립 요청**
- 위치: `frontend/src/app/(main)/workspace/settings/page.tsx` — `MembersTab`
- 상세: 두 쿼리는 병렬로 fetch되므로(TanStack Query 기본 동작) 성능상 문제없음. 다만 `adminMode`인 경우에만 `invitationsQuery`가 활성화되므로 불필요한 fetch는 없음. 현재 구조 양호.

---

**[INFO] `CreateTeamWorkspaceDialog` onSuccess에서 `list()` 재호출**
- 위치: `frontend/src/components/workspace/create-team-workspace-dialog.tsx`
- 상세: 생성 성공 후 `workspacesApi.list()`를 다시 fetch해서 전체 목록을 갱신. 서버에서 이미 생성된 워크스페이스를 응답으로 받으므로 낙관적 업데이트(optimistic update)로 대체 가능하나, 동기화 정확성 측면에서 현재 방식이 안전함. 워크스페이스 생성 빈도가 낮아 성능 영향 미미.

---

**[INFO] `sidebar.tsx`의 `roleLabelKey` 함수 중복 정의**
- 위치: `sidebar.tsx` + `settings/page.tsx`
- 상세: 동일한 `roleLabelKey` 함수가 두 파일에 각각 정의됨. 공유 유틸로 추출하지 않으면 향후 역할 변경 시 양쪽 모두 수정해야 하는 유지보수 문제. 런타임 성능과는 무관하나 번들 크기를 미세하게 증가시킴.
- 제안: `@/lib/utils/workspace.ts` 등 공유 위치로 이동.

---

**[INFO] `providers.tsx` workspace 전환 시 `cancelQueries` + `resetQueries` 호출**
- 위치: `frontend/src/lib/providers.tsx`
- 상세: 전환마다 전체 쿼리를 취소·초기화하므로 원래 의도한 동작. 워크스페이스 전환이 자주 발생하는 시나리오에서 불필요한 refetch가 대량 발생할 수 있으나, 워크스페이스는 권한 경계이므로 주석에 명시된 것처럼 의도적인 설계. 성능 이슈보다 정확성 우선이 맞음.

---

### 요약

전반적으로 성능상 심각한 문제는 없다. 백엔드의 주요 패턴은 각 작업에 2~3번의 직렬 DB 쿼리를 수행하는데, `renameWorkspace`·`deleteWorkspace`·`leaveWorkspace` 모두 독립적인 첫 두 쿼리를 `Promise.all`로 병렬화하면 응답 시간을 줄일 수 있다. 프론트엔드는 TanStack Query의 캐싱과 조건부 쿼리 활성화를 적절히 사용하고 있으며, 불필요한 리렌더링이나 메모리 누수 패턴도 보이지 않는다. 컨트롤러의 no-op 경로가 DB 쿼리를 유발하는 점은 소규모 이슈이며, `roleLabelKey` 중복은 성능보다 유지보수 문제다.

### 위험도

**LOW**