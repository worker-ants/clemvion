### 발견사항

- **[WARNING]** `leaveWorkspace` — sole-owner 검사와 remove 사이 TOCTOU 경쟁 조건
  - 위치: `workspaces.service.ts` — `leaveWorkspace` 메서드
  - 상세: owner 수 조회(`memberRepository.find`) → 검사 통과 → `memberRepository.remove` 사이에 트랜잭션이 없다. 두 owner가 동시에 탈퇴 요청을 보내면 둘 다 "owner가 2명" 체크를 통과하고 각자 자신의 멤버십을 삭제해 workspace에 owner가 0명이 되는 상황이 실제로 발생 가능하다.
  - 제안: 전체 흐름을 `dataSource.transaction(async (em) => { ... })` 으로 감싸고, owner 수 조회에 `SELECT ... FOR UPDATE` (TypeORM: `em.getRepository(...).createQueryBuilder().setLock('pessimistic_write')`) 를 사용하거나, DB 레벨 constraint(owner count ≥ 1)로 보호한다.

- **[WARNING]** `deleteWorkspace` — 동시 삭제 요청 시 에러 노출
  - 위치: `workspaces.service.ts` — `deleteWorkspace` 메서드
  - 상세: `getMemberRole` → role 검사 → `findOne` → `remove` 흐름이 트랜잭션 없이 실행된다. 두 owner가 동시에 삭제 요청을 보내면 둘 다 role 검사를 통과하고, 두 번째 `remove`는 이미 삭제된 entity에 대해 DB 오류(혹은 무시)를 발생시킨다. TypeORM의 `remove`는 이미 삭제된 엔티티에 대해 조용히 성공하거나 예외를 던질 수 있어 동작이 불확정적이다.
  - 제안: `deleteWorkspace`도 트랜잭션으로 보호하거나, `remove` 결과(영향 행 수)를 확인해 0이면 `NotFoundException`을 반환한다.

- **[INFO]** `renameWorkspace` — assertAdmin과 findOne 사이 workspace 상태 변경 가능
  - 위치: `workspaces.service.ts` — `renameWorkspace` 메서드
  - 상세: `assertAdmin`(멤버 repo 조회) 이후 `workspaceRepository.findOne` 시점 사이에 workspace가 삭제되거나 requester의 role이 변경될 수 있다. 현재는 `findOne → null → NotFoundException`으로 처리되지만, role 변경은 감지되지 않는다.
  - 제안: 허용 가능한 수준이지만, 민감한 권한 변경이 우려된다면 동일 트랜잭션 내에서 role과 workspace를 함께 조회한다.

- **[INFO]** `providers.tsx` — void cancelQueries/resetQueries 비동기 순서 미보장
  - 위치: `providers.tsx` — workspace subscription 콜백
  - 상세: `void queryClient.cancelQueries()` 완료를 기다리지 않고 `void queryClient.resetQueries()`를 즉시 호출한다. React Query가 내부적으로 처리하므로 실제 문제가 발생할 가능성은 낮지만, in-flight 요청 취소 전에 reset이 먼저 완료될 수 있다.
  - 제안: `await queryClient.cancelQueries(); await queryClient.resetQueries();` 순서로 처리하거나, 이미 React Query의 내부 동작에 의존하고 있다면 주석으로 의도를 명시한다.

---

### 요약

변경된 코드 중 동시성 관점에서 가장 주의해야 할 부분은 `leaveWorkspace`의 sole-owner TOCTOU 경쟁 조건이다. 두 owner가 동시에 탈퇴하면 DB 제약이 없는 한 workspace에 owner가 없어지는 불변식 위반이 실제로 재현 가능하다. `deleteWorkspace`도 유사한 구조적 취약점을 가지며, 두 메서드 모두 트랜잭션과 비관적 락(또는 DB constraint)으로 보호하는 것이 올바른 해법이다. `renameWorkspace`의 TOCTOU와 프론트엔드의 비동기 순서 이슈는 낮은 위험도이며 즉각 수정이 필요한 수준은 아니다.

### 위험도
**MEDIUM**