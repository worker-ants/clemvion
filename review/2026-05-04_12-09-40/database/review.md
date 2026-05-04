### 발견사항

- **[CRITICAL]** `workspace` 엔티티를 트랜잭션 바깥에서 조회한 뒤 트랜잭션 내에서 저장
  - 위치: `workspaces.service.ts` → `transferOwnership`, `this.workspaceRepository.findOne(...)` (트랜잭션 외부) / `wsRepo.save(workspace)` (트랜잭션 내부)
  - 상세: `workspace` 객체는 트랜잭션이 열리기 전에 락 없이 읽힌 스냅샷이다. 트랜잭션 내에서 두 멤버 role이 swap된 뒤 `workspace.ownerId`를 갱신하지만, 이 시점 `workspace` 객체는 외부에서 읽은 stale 상태다. 동시에 두 개의 `transferOwnership` 요청이 들어오면 두 트랜잭션 모두 같은 stale workspace를 읽어 서로의 `ownerId` 갱신을 덮어쓸 수 있다. `workspace.save`가 낙관적 잠금 없이 UPDATE를 수행하므로 last-write-wins 경쟁이 발생한다.
  - 제안: `workspaceRepository.findOne`을 트랜잭션 내부(`manager.getRepository(Workspace).findOne(...)`)로 이동하고, 두 멤버 락과 마찬가지로 `lock: { mode: 'pessimistic_write' }`를 추가한다.

```typescript
// ✗ 현재 (트랜잭션 외부 조회)
const workspace = await this.workspaceRepository.findOne({ where: { id: workspaceId } });
// ...
await this.memberRepository.manager.transaction(async (manager) => {
  const wsRepo = manager.getRepository(Workspace);
  // workspace는 락 없이 읽힌 stale 객체
  workspace.ownerId = targetMembership.userId;
  await wsRepo.save(workspace);
});

// ✓ 권장 (트랜잭션 내부 조회 + 락)
await this.memberRepository.manager.transaction(async (manager) => {
  const wsRepo = manager.getRepository(Workspace);
  const workspace = await wsRepo.findOne({
    where: { id: workspaceId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!workspace) throw new NotFoundException(...);
  if (workspace.type === 'personal') throw new ForbiddenException(...);
  // ...
});
```

---

- **[WARNING]** 잠금 순서 불일치로 인한 데드락 위험
  - 위치: `workspaces.service.ts` → `transferOwnership` 내부 트랜잭션
  - 상세: `requesterMembership`을 먼저 `(workspaceId, userId)` 조건으로 락, 이후 `targetMembership`을 `(id, workspaceId)` 조건으로 락한다. 한 워크스페이스에서 A→B 이양과 B→A 이양이 동시에 시도될 경우(멀티탭·재시도 시나리오), 트랜잭션 1이 A를 락하고 B를 기다리는 동안 트랜잭션 2가 B를 락하고 A를 기다리면 데드락이 발생한다. 실제로 한 워크스페이스에 owner가 단 한 명인 설계라면 빈도는 낮지만 PostgreSQL은 데드락 발생 시 한 트랜잭션을 롤백하므로 사용자에게 500 오류로 노출될 수 있다.
  - 제안: 두 멤버를 락할 때 항상 id 기준 오름차순으로 정렬한 뒤 순서대로 락을 획득하거나, 두 멤버를 단일 `IN` 쿼리로 묶어 한 번에 락을 건다.

```typescript
// 두 id를 정렬해서 항상 같은 순서로 락
const ids = [requesterMembership.id, newOwnerMemberId].sort();
const members = await memRepo.find({
  where: { id: In(ids), workspaceId },
  lock: { mode: 'pessimistic_write' },
  order: { id: 'ASC' },
});
```

---

- **[WARNING]** `workspace` 조회와 `type === 'personal'` 검증이 트랜잭션 밖에서 수행됨
  - 위치: `workspaces.service.ts` → `transferOwnership` 상단 (트랜잭션 진입 전 early-return 블록)
  - 상세: personal 워크스페이스 차단 검증 자체는 정상이지만, 이 검증 직후 다른 트랜잭션이 workspace.type을 변경하는 시나리오는 없으므로 실제 위험은 낮다. 그러나 위의 CRITICAL 수정 시 이 검증도 트랜잭션 내부로 함께 옮겨야 일관성이 유지된다. 현재 코드는 분기 로직이 트랜잭션 안팎으로 분산되어 있어 유지보수 시 혼란을 유발한다.
  - 제안: 위 CRITICAL 수정과 함께 `workspace` 존재 확인 및 `type` 검증을 트랜잭션 내부로 일원화한다.

---

- **[INFO]** 두 멤버 `save`를 별도 호출로 분리
  - 위치: `workspaces.service.ts` → `transferOwnership` 내부 트랜잭션
  - 상세: `await memRepo.save(targetMembership); await memRepo.save(requesterMembership);` 가 직렬로 실행되어 2회 UPDATE 왕복이 발생한다. 트랜잭션 내에서 단일 bulk save로 묶으면 1회 왕복으로 줄일 수 있다.
  - 제안: `await memRepo.save([targetMembership, requesterMembership]);`

---

- **[INFO]** `WorkspaceMember(workspaceId, userId)` 복합 인덱스 의존
  - 위치: `workspaces.service.ts` → `memRepo.findOne({ where: { workspaceId, userId: requesterId }, lock: ... })`
  - 상세: 이 쿼리는 `(workspaceId, userId)` 복합 인덱스가 없으면 full scan 또는 non-selective 단일 컬럼 스캔으로 실행된다. 멤버 목록 조회·역할 검증에 빈번히 사용되는 쿼리이므로 해당 인덱스 존재 여부를 마이그레이션에서 확인해야 한다.
  - 제안: 엔티티 또는 마이그레이션에 `@Index(['workspaceId', 'userId'], { unique: true })` 존재 여부 검토.

---

### 요약

핵심 변경인 `transferOwnership` 트랜잭션 설계는 방향성은 올바르나, `workspace` 엔티티를 트랜잭션 바깥에서 잠금 없이 읽은 뒤 트랜잭션 내에서 저장하는 구조적 결함이 있다. 동시 요청 시 `workspace.ownerId`가 stale 값으로 덮어쓰일 수 있으며, 두 멤버 잠금 순서가 고정되지 않아 이론적 데드락 위험도 존재한다. 나머지 컨트롤러 변경(전역 `RolesGuard` 전환에 따른 `@UseGuards` 제거)은 데이터베이스와 무관하다.

### 위험도

**HIGH**