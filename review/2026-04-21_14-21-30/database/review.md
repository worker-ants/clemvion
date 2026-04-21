### 발견사항

- **[WARNING]** `deleteWorkspace`에 cascade 처리 미검증
  - 위치: `workspaces.service.ts` — `deleteWorkspace` 메서드
  - 상세: 주석에 "멤버·초대는 cascade 또는 외부 정리에 의존한다"고 명시되어 있으나, `workspaceRepository.remove(workspace)` 호출 시 실제로 `WorkspaceMember`, `WorkspaceInvitation` 등 연관 엔티티에 DB 레벨 `ON DELETE CASCADE`가 설정되어 있는지, 또는 TypeORM `cascade: true`가 관계에 선언되어 있는지 코드에서 확인되지 않음. 두 가지 모두 없을 경우 워크스페이스 삭제 시 orphan 레코드 또는 FK 제약 위반 에러가 발생할 수 있음.
  - 제안: 엔티티 정의에서 `@OneToMany(..., { cascade: ['remove'] })` 또는 마이그레이션에서 `ON DELETE CASCADE` FK 제약이 설정되어 있는지 확인 필요. 불명확하다면 트랜잭션 내에서 직접 삭제하는 방식으로 교체 권장.

- **[WARNING]** `deleteWorkspace`와 `leaveWorkspace`에 트랜잭션 미적용
  - 위치: `workspaces.service.ts` — `deleteWorkspace`, `leaveWorkspace`
  - 상세: `deleteWorkspace`는 권한 확인 → 워크스페이스 조회 → 삭제의 3단계가, `leaveWorkspace`는 워크스페이스 조회 → 멤버십 조회 → owner 수 조회 → 멤버십 삭제의 4단계가 각각 별개 쿼리로 실행됨. 동시 요청 환경에서 TOCTOU(Time-Of-Check-Time-Of-Use) 문제가 발생할 수 있음. 예를 들어, 두 owner가 동시에 `leaveWorkspace`를 호출하면 `owners.length <= 1` 체크를 동시에 통과하여 두 명 모두 탈퇴할 수 있음.
  - 제안: 두 메서드를 `EntityManager` 트랜잭션으로 감싸거나, `SELECT ... FOR UPDATE`를 사용하여 critical section을 보호해야 함.

  ```ts
  async leaveWorkspace(workspaceId: string, requesterId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // ... 기존 로직을 manager 쿼리로 교체
    });
  }
  ```

- **[WARNING]** `renameWorkspace`에서 권한 확인과 실제 업데이트 간 workspace 이중 조회
  - 위치: `workspaces.service.ts` — `renameWorkspace`
  - 상세: `assertAdmin` → `workspaceRepository.findOne` 순서로 워크스페이스를 두 번 조회함. `assertAdmin`은 내부적으로 `getMemberRole`(memberRepository 조회)만 수행하지만, 이후 `findOne`으로 workspace를 재조회하는 구조. 쿼리 낭비는 아니지만, 권한 확인 후 workspace가 삭제된 경우를 고려해야 하며, 트랜잭션 없이는 race condition이 존재함.
  - 제안: 트랜잭션으로 묶거나, 적어도 `assertAdmin` 내부에서 workspace 존재 확인을 함께 처리.

- **[INFO]** `leaveWorkspace`의 `memberRepository.find({ where: { workspaceId, role: 'owner' } })` 인덱스 확인 필요
  - 위치: `workspaces.service.ts` — `leaveWorkspace`
  - 상세: `(workspaceId, role)` 복합 인덱스가 없을 경우 `workspaceId` 단일 인덱스로 필터 후 `role` 컬럼을 full scan하게 됨. 멤버 수가 많은 팀에서는 성능 이슈 가능성 있음.
  - 제안: `WorkspaceMember` 엔티티 또는 마이그레이션에 `@Index(['workspaceId', 'role'])` 복합 인덱스 추가 검토.

- **[INFO]** `update` 컨트롤러의 no-op 분기에서 권한 검증 미수행
  - 위치: `workspaces.controller.ts` — `update` 메서드 (dto.name === undefined 분기)
  - 상세: `dto.name`이 없을 때 현재 워크스페이스 상태를 그냥 반환하는데, 이 경로에서는 권한 확인 없이 `findById`를 호출하고 데이터를 노출함. DB 관점에서 직접적인 문제는 아니지만, 인증된 사용자라면 멤버가 아닌 워크스페이스 정보도 조회 가능해질 수 있음. 서비스 레이어에 `assertMembership`이 없는 경로임.
  - 제안: no-op 분기에서도 `workspacesService.findById` 대신 멤버십 검증이 포함된 메서드 사용 권장.

---

### 요약

이번 변경은 워크스페이스 이름 변경·삭제·탈퇴 기능을 추가한 것으로, TypeORM Repository 패턴을 일관되게 사용하고 SQL Injection 위험은 없음. 그러나 `deleteWorkspace`와 `leaveWorkspace`가 다단계 쿼리를 트랜잭션 없이 수행하여 **동시성 환경에서 데이터 정합성이 보장되지 않는 구조적 문제**가 존재하며, 특히 `leaveWorkspace`의 sole-owner 체크는 TOCTOU 취약점이 있음. 또한 워크스페이스 삭제 시 연관 테이블(멤버, 초대 등)의 cascade 처리 여부가 엔티티/마이그레이션 레벨에서 명시적으로 확인되어야 한다.

### 위험도

**MEDIUM**