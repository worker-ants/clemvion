## 발견사항

### [WARNING] `transferOwnership` 트랜잭션 내부 repo 모킹 일관성 미검증
- **위치**: `workspaces.service.spec.ts`, `atomically swaps roles` 테스트
- **상세**: 서비스 구현은 `this.memberRepository.manager.transaction(async (manager) => { const memRepo = manager.getRepository(WorkspaceMember); ... })` 패턴으로 트랜잭션 내에서 `manager.getRepository()`를 통한 새 repo 인스턴스를 사용한다. 테스트는 `memberRepo.save.mock.calls`를 단언하는데, `manager.getRepository(WorkspaceMember)`가 같은 mock 인스턴스를 반환하도록 `beforeEach`에서 설정되어 있지 않으면 단언이 통과하더라도 실제 트랜잭션 내부 동작을 검증하지 못하는 false-positive가 발생한다. 전체 파일의 `beforeEach` 설정을 확인해야 한다.
- **제안**: `memberRepository.manager.transaction`을 명시적으로 mock하여 `manager.getRepository(WorkspaceMember)`와 `manager.getRepository(Workspace)`가 테스트의 `memberRepo`, `workspaceRepo` mock을 반환하는지 보장. 예:
  ```ts
  memberRepo.manager = {
    transaction: jest.fn().mockImplementation(async (cb) =>
      cb({ getRepository: (entity) => entity === WorkspaceMember ? memberRepo : workspaceRepo })
    ),
  } as any;
  ```

---

### [WARNING] `transferOwnership` 컨트롤러에 `@Roles('owner')` 데코레이터 누락
- **위치**: `workspaces.controller.ts`, `transferOwnership` 메서드
- **상세**: 추가된 `POST :id/transfer-ownership` 엔드포인트에 `@Roles('owner')` 데코레이터가 없다. 서비스 레벨에서 `OWNER_REQUIRED` 검증을 하긴 하지만, HTTP 레이어의 `RolesGuard`가 사전 차단하지 못한다. 다른 write 엔드포인트(`@Roles('editor')`, `@Roles('admin')`)와 일관성이 없으며, 컨트롤러 테스트도 이 가드 동작을 검증하지 않는다.
- **제안**: 컨트롤러 메서드에 `@Roles('owner')` 추가. 컨트롤러 spec에 guard 통합 여부를 확인하는 테스트 추가 (또는 e2e 레벨에서 커버).

---

### [WARNING] `RolesGuard` 전역화 리팩토링에 대한 통합/e2e 테스트 부재
- **위치**: `app.module.ts` + 9개 컨트롤러 파일 (`alerts`, `auth-configs`, `folders`, `integrations`, `knowledge-base` 등)
- **상세**: 모든 컨트롤러에서 `@UseGuards(RolesGuard)`를 제거하고 전역 `APP_GUARD`로 이전했다. 컨트롤러 단위 테스트는 가드를 bypass하므로, 이 리팩토링이 기존 역할 제어를 깨뜨리지 않는다는 것을 검증하는 통합/e2e 테스트가 없다. 특히 opt-out(`@Public` 등) 패턴 없이 `@Roles`가 없는 라우트가 default-allow로 동작하는지에 대한 회귀 테스트가 필요하다.
- **제안**: `RolesGuard` 동작을 검증하는 e2e 또는 통합 테스트 추가 — viewer/editor 권한으로 admin 전용 엔드포인트 호출 시 403 반환 확인.

---

### [WARNING] 컨트롤러 spec의 `transferOwnership` 에러 케이스 불완전
- **위치**: `workspaces.controller.spec.ts`, `transferOwnership` describe 블록
- **상세**: 현재 테스트는 happy path와 `ForbiddenException` 전파만 커버한다. 서비스에서 throw할 수 있는 `NotFoundException`(워크스페이스/멤버 없음), `ConflictException`(이미 owner), `BadRequestException`(자기 자신 지정) 케이스가 테스트되지 않았다.
- **제안**:
  ```ts
  it('propagates NotFoundException when workspace not found', ...)
  it('propagates NotFoundException when target member not found', ...)
  it('propagates ConflictException when target is already owner', ...)
  it('propagates BadRequestException for self-transfer', ...)
  ```

---

### [INFO] 트랜잭션 atomicity/rollback 동작 미검증
- **위치**: `workspaces.service.spec.ts`
- **상세**: 현재 테스트는 데이터 변경 결과(role swap, ownerId 갱신)를 검증하지만, 첫 번째 `save` 실패 시 두 번째 `save`가 실행되지 않아야 하는 트랜잭션 롤백 동작은 검증하지 않는다. 운영 환경에서 부분 커밋이 발생할 경우 데이터 불일치가 생길 수 있는 고위험 코드 경로다.
- **제안**: `memRepo.save`가 첫 번째 호출에서 예외를 던질 때 `workspaceRepo.save`가 호출되지 않고 예외가 전파되는지 테스트 추가.

---

### [INFO] `workflows.controller.spec.ts`의 `WorkspacesService` 제거에 따른 회귀 위험
- **위치**: `workflows.controller.spec.ts`
- **상세**: `WorkspacesService` mock이 제거되었다. 이는 `RolesGuard`가 더 이상 컨트롤러 테스트에 직접 포함되지 않기 때문이다. 하지만 `WorkflowsController`의 다른 동작이 `WorkspacesService`에 의존하고 있었다면 제거로 인해 숨겨진 의존성이 드러날 수 있다. 현재 테스트는 통과하는 것으로 보이므로 즉각적 문제는 없으나, 향후 컨트롤러에 service 의존성이 추가될 경우 테스트 모듈 설정을 재검토해야 한다.

---

## 요약

`transferOwnership` 서비스 테스트는 7가지 에러 케이스를 포함하여 비즈니스 로직 커버리지가 충분하다. 그러나 세 가지 구조적 약점이 있다: (1) 트랜잭션 내부에서 `manager.getRepository()`로 획득한 repo가 mock 인스턴스와 동일한지 전체 `beforeEach` 설정을 확인해야 하며, (2) `RolesGuard` 전역화 리팩토링은 9개 컨트롤러에 걸친 변경임에도 이를 회귀 검증하는 통합 테스트가 없고, (3) `transferOwnership` 컨트롤러에 `@Roles('owner')` 데코레이터가 없어 서비스 레벨 검증에만 의존한다. 컨트롤러 스펙의 에러 케이스 누락은 보완이 권장된다.

## 위험도

**MEDIUM**