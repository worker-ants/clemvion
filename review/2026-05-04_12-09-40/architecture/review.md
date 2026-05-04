### 발견사항

---

**[WARNING] transferOwnership: workspace 엔티티 TOCTOU 경합**
- 위치: `workspaces.service.ts` — `transferOwnership` 메서드
- 상세: `workspace` 객체를 트랜잭션 **밖**에서 락 없이 로드한 뒤, 트랜잭션 **내부**에서 `workspace.ownerId = ...` 를 수정하고 `wsRepo.save(workspace)` 로 저장한다. 두 owner 이양 요청이 동시에 진입하면 두 번째 save 가 첫 번째 트랜잭션의 변경을 덮어쓸 수 있다. `requesterMembership`·`targetMembership`에는 `pessimistic_write` 락을 걸었으나, `workspace` 행에는 락이 없어 일관성 보장이 깨진다.
- 제안: workspace 조회를 트랜잭션 **내부**로 옮겨 `lock: { mode: 'pessimistic_write' }` 를 함께 적용한다. 또는 `wsRepo.update({ id: workspaceId }, { ownerId: targetMembership.userId })` 쿼리로 대체하면 안전하다.

```ts
// 권장 패턴
await this.memberRepository.manager.transaction(async (manager) => {
  const wsRepo = manager.getRepository(Workspace);
  const workspace = await wsRepo.findOne({
    where: { id: workspaceId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!workspace) throw new NotFoundException({ code: 'WORKSPACE_NOT_FOUND' });
  if (workspace.type === 'personal') throw new ForbiddenException({ code: 'CANNOT_TRANSFER_PERSONAL' });
  // ... 나머지 검증 및 swap
});
```

---

**[WARNING] 워크스페이스 인가(authorization) 전략의 불일치**
- 위치: `workspaces.controller.ts` `transferOwnership` vs 나머지 컨트롤러들 (`@Roles` 데코레이터)
- 상세: 모든 다른 컨트롤러는 `@Roles('editor')` / `@Roles('admin')` 선언적 가드로 인가를 표현한다. `WorkspacesController`만 서비스 레이어 role assertion 을 사용한다. `transferOwnership` 엔드포인트에 `@Roles` 데코레이터가 없어, 전체 코드베이스에서 "이 라우트는 어떤 역할이 필요한가"를 grep·정적 분석으로 파악하기 어렵다. 보안 감사 시 반드시 서비스 구현을 함께 읽어야 한다.
- 제안: 최소한 `@Roles('owner')` 를 달아 인가 의도를 선언적으로 표시하거나, 워크스페이스 전체에 적용되는 서비스 레이어 전략을 컨트롤러 레벨 주석 또는 공통 베이스 클래스로 명시화한다. 불일치 전략을 유지한다면 `WorkspacesController` 상단에 "이 컨트롤러의 역할 검증은 서비스 레이어에서 수행" 주석을 추가한다.

---

**[WARNING] 프론트엔드 role 가드 방식 불일치**
- 위치: `frontend/src/app/(main)/workspace/settings/page.tsx` — `DangerZoneTab`
- 상세: 워크스페이스 삭제 카드는 `<RoleGate minRole="owner">` 를 사용하고, owner 이양 카드는 `const transferEligible = isTeam && isOwner` 수동 조건으로 처리한다. 두 패턴이 같은 컴포넌트 내에 혼재하여 후속 개발자가 어느 패턴을 따라야 할지 판단하기 어렵다.
- 제안: owner 이양 카드도 `{isTeam && <RoleGate minRole="owner">...</RoleGate>}` 로 통일한다. `membersQuery`의 `enabled` 조건은 `isTeam && isOwner` 를 별도 변수 없이 인라인으로 사용할 수 있다.

---

**[INFO] RolesGuard 전역 등록 — opt-out 시맨틱의 암묵적 전제**
- 위치: `app.module.ts`, `RolesGuard`
- 상세: `@Roles` 데코레이터가 없는 라우트는 어떤 인증된 사용자든 접근 가능하다(default-allow). 이 동작이 `RolesGuard` 구현에 명시되어 있지 않으면, 새 컨트롤러에 `@Roles` 를 빠뜨렸을 때 의도치 않은 접근이 열릴 수 있다.
- 제안: `RolesGuard.canActivate` 내부에 "Roles 메타데이터 없으면 통과" 경로가 명확히 구현·주석화되어 있는지 확인한다. `SKIP_ROLES_CHECK` 같은 명시적 opt-out 데코레이터 도입을 고려하면 감사 추적이 쉬워진다.

---

**[INFO] 테스트에서 트랜잭션 내부 repository 참조 방식**
- 위치: `workspaces.service.spec.ts`
- 상세: 서비스 코드는 트랜잭션 내부에서 `manager.getRepository(WorkspaceMember)` 로 새 레포지토리 인스턴스를 얻지만, 테스트는 `memberRepo` (주입된 원본 레포)를 mock 한다. 현재 테스트가 통과하는 것은 TypeORM 테스트 환경에서 `manager.getRepository` 가 동일 mock 을 반환하기 때문이다. 이 의존관계가 명시되지 않으면 TypeORM 버전 업그레이드 시 테스트가 의미 없이 깨질 수 있다.

---

### 요약

이번 변경의 핵심은 `RolesGuard` 를 `APP_GUARD` 로 전역화하여 각 컨트롤러의 반복적인 `@UseGuards(RolesGuard)` 를 제거하고, `transferOwnership` 기능을 신설한 것이다. 전역 가드 등록 순서(Throttler → JWT → Roles)와 기존 opt-in 시맨틱 유지는 올바르게 설계되었으며, 테스트 커버리지도 충분하다. 그러나 `transferOwnership` 서비스 로직에서 `workspace` 엔티티를 트랜잭션 밖에서 락 없이 로드 후 트랜잭션 내에서 저장하는 TOCTOU 패턴이 동시 요청 상황에서 데이터 불일치를 일으킬 수 있으며, 워크스페이스 레이어의 서비스 레벨 인가 전략이 나머지 코드베이스의 선언적 `@Roles` 패턴과 혼재하여 보안 감사 복잡도를 높인다는 점이 주의 항목으로 남는다.

### 위험도

**MEDIUM** — TOCTOU 이슈는 일반적인 단일 사용자 환경에서는 재현이 어렵지만, 복수의 owner가 동시에 이양을 시도하거나 관리 도구를 통한 동시 접근이 발생하는 경우 `workspace.ownerId` 가 올바르게 동기화되지 않을 수 있다.