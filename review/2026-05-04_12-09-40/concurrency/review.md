### 발견사항

- **[WARNING]** TOCTOU 경쟁 조건: 트랜잭션 외부에서 읽은 `workspace` 객체를 트랜잭션 내부에서 저장
  - 위치: `workspaces.service.ts` — `transferOwnership()`, 트랜잭션 바깥의 `workspaceRepository.findOne()` → 트랜잭션 내부의 `wsRepo.save(workspace)`
  - 상세: `workspace` 엔티티가 락 없이 트랜잭션 시작 전에 로드된다. 트랜잭션 내부에서는 `WorkspaceMember` 에만 `pessimistic_write` 락을 걸고, `workspace` 객체를 그대로 재사용해 `ownerId`를 갱신한 뒤 저장한다. 두 개의 `transferOwnership` 요청이 동시에 도달하면 둘 다 같은 `workspace` 스냅샷을 바탕으로 저장을 시도하고, 선행 트랜잭션의 커밋이 후행 트랜잭션의 `save`에 의해 덮어씌워질 수 있다. 이름 변경(`PATCH /workspaces/:id`)이 동시에 실행되는 경우에도 동일한 스냅샷 충돌이 발생한다.
  - 제안: `workspace` 조회를 트랜잭션 내부로 이동하고 `pessimistic_write` 락을 적용한다.
    ```typescript
    await this.memberRepository.manager.transaction(async (manager) => {
      const wsRepo  = manager.getRepository(Workspace);
      const memRepo = manager.getRepository(WorkspaceMember);

      const workspace = await wsRepo.findOne({
        where: { id: workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!workspace) throw new NotFoundException({ code: 'WORKSPACE_NOT_FOUND' });
      if (workspace.type === 'personal') throw new ForbiddenException({ code: 'CANNOT_TRANSFER_PERSONAL' });
      // ... 이하 동일
    });
    ```

- **[INFO]** 잠금 순서가 고정되어 데드락 위험은 낮음
  - 위치: `workspaces.service.ts` — 트랜잭션 내부의 두 `pessimistic_write` 획득
  - 상세: 첫 번째 락은 항상 요청자(현재 owner), 두 번째 락은 항상 대상 멤버를 대상으로 한다. 워크스페이스당 owner 는 동시에 한 명이므로 두 개의 동시 `transferOwnership` 요청은 첫 번째 락에서 직렬화된다. 역방향 순서로 락을 획득하는 경우가 구조적으로 발생하지 않으므로 데드락 위험은 사실상 없다. 다만 위의 `workspace` 락이 추가된다면 락 획득 순서를 `workspace → requester → target` 으로 일관되게 유지해야 한다.

- **[INFO]** 트랜잭션 내 두 번의 분리된 `save`
  - 위치: `workspaces.service.ts` — `memRepo.save(targetMembership)` → `memRepo.save(requesterMembership)`
  - 상세: 두 저장이 같은 트랜잭션 안에 있으므로 원자성은 보장된다. 다만 TypeORM `save`는 내부적으로 `SELECT + UPDATE`를 수행하므로 단일 `UPDATE ... SET role = CASE ... END WHERE id IN (...)` 쿼리나 `memRepo.save([targetMembership, requesterMembership])` 배열 형태로 단순화하면 왕복 횟수를 줄일 수 있다.

---

### 요약

변경사항 중 동시성 관점에서 실질적인 위험은 `workspaces.service.ts`의 `transferOwnership`에 집중된다. `workspace` 엔티티를 트랜잭션 외부에서 락 없이 읽고 트랜잭션 내부에서 재사용하는 구조가 TOCTOU 경쟁 조건을 유발할 수 있으며, 동시 요청이나 다른 워크스페이스 수정 작업이 겹칠 경우 `ownerId` 불일치가 발생할 수 있다. `WorkspaceMember` 레코드에 대한 `pessimistic_write` 락 자체는 올바르게 적용되어 있고, 락 순서가 일관적이어서 데드락 위험은 낮다. 나머지 변경사항(`RolesGuard` 전역 등록, 컨트롤러 리팩토링, 프론트엔드 mutation)은 동시성과 무관하다.

### 위험도
**MEDIUM**