### 발견사항

---

**[WARNING]** `transferOwnership` 서비스: workspace 레코드에 비관적 락 누락
- 위치: `workspaces.service.ts` — `transferOwnership` 메서드
- 상세: `workspace` 객체는 트랜잭션 **밖**에서 락 없이 조회된 후, 트랜잭션 **안**에서 `workspace.ownerId = targetMembership.userId` 로 수정되고 `wsRepo.save(workspace)` 로 저장된다. 두 owner가 동시에 서로 다른 대상에게 이양을 요청하는 경쟁 조건에서 `WorkspaceMember` 락은 보호하지만 `Workspace.ownerId` 갱신은 보호하지 못한다. `workspace`도 트랜잭션 안에서 `pessimistic_write` 로 다시 조회해야 일관성이 보장된다.
- 제안:
  ```ts
  const workspace = await wsRepo.findOne({
    where: { id: workspaceId },
    lock: { mode: 'pessimistic_write' },
  });
  ```
  트랜잭션 진입 후 내부에서 잠금과 함께 재조회.

---

**[WARNING]** `transferOwnership` 컨트롤러 엔드포인트에 `@Roles` 데코레이터 누락
- 위치: `workspaces.controller.ts` — `transferOwnership` 핸들러
- 상세: `@Post(':id/transfer-ownership')` 에 `@Roles('owner')` 가 없다. RolesGuard는 `@Roles` 메타데이터가 없으면 통과시키므로, 권한 검증이 전적으로 `service.transferOwnership` 내부 로직에만 의존한다. 동일 컨트롤러의 `updateMemberRole`, `removeMember` 등은 `@Roles('admin')` 을 붙여 가드 레이어에서 조기 거부(403)를 반환하므로 패턴이 불일치한다.
- 제안: `@Roles('owner')` 추가로 가드 레이어와 서비스 레이어에서 이중 검증.

---

**[WARNING]** `settings/page.tsx` — 네이티브 `<select>` 사용으로 디자인 시스템 불일치
- 위치: `DangerZoneTab` — transfer dialog 내 멤버 선택
- 상세: 프로젝트 전반에서 `@/components/ui/select` (Radix 기반) 를 사용하는데, 이양 대상 선택 UI만 네이티브 `<select>` 를 사용한다. 스타일, 포커스 링, 다크 모드, 접근성 동작이 다른 폼 요소와 다르게 보일 수 있다.
- 제안: `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` (shadcn/ui) 로 교체.

---

**[INFO]** `workspaces.service.ts` — workspace를 트랜잭션 밖에서 조회 후 안에서 변경하는 암묵적 패턴
- 위치: `transferOwnership` 메서드 전반
- 상세: `workspace` 객체 취득 → 타입 검증 → 트랜잭션 진입 → 트랜잭션 내 `workspace.ownerId` 변경 → `wsRepo.save(workspace)` 흐름은 동작하지만, 독자 입장에서 왜 트랜잭션 밖 객체를 트랜잭션 안 repo로 저장하는지 처음 보면 혼란스럽다. WARNING 항목의 락 수정과 함께 트랜잭션 내부에서 재조회하면 이 패턴도 동시에 해소된다.

---

**[INFO]** `DangerZoneTab` — 컴포넌트 복잡도 증가 (단일 책임 경계 접근)
- 위치: `settings/page.tsx` — `DangerZoneTab` 함수 컴포넌트 (~160줄)
- 상세: Leave / Delete / TransferOwnership 세 가지 뮤테이션과 각각의 다이얼로그 상태, 멤버 쿼리가 하나의 컴포넌트에 집약되어 있다. 현재는 허용 범위이지만, 다음 기능 추가 시 분리가 필요한 임계점에 근접해 있다. 특히 transfer 관련 state (`transferDialogOpen`, `transferTargetId`, `transferEmailInput`) 와 `transferMutation` 을 `TransferOwnershipCard` 같은 별도 컴포넌트로 추출하면 DangerZoneTab의 상태 부담이 절반 이하로 줄어든다.

---

**[INFO]** `TransferOwnershipDto` — 클래스 레벨 JSDoc이 서비스 동작을 기술
- 위치: `transfer-ownership.dto.ts:1-8`
- 상세: DTO의 JSDoc 블록이 "트랜잭션 내에서 두 멤버 role 이 동시에 swap 된다"는 서비스 구현 세부 사항을 설명한다. DTO는 입력 형태만 나타내면 충분하며, 동작 기술은 서비스 메서드 주석에 위치하는 것이 더 자연스럽다.

---

**[INFO]** `workspaces.service.spec.ts` — `setupOwnerLookup` 헬퍼 타입 약화
- 위치: `workspaces.service.spec.ts` — `setupOwnerLookup` 내 mock 파라미터 타입
- 상세: `mockImplementation((opts: { where?: Record<string, unknown> }) => ...)` 로 TypeORM `FindOneOptions`를 단순화했는데, 향후 `relations`, `select` 등을 사용하면 타입이 실제 API와 더 벌어진다. 테스트 범위 내 영향이므로 기능 정확성에는 문제 없다.

---

### 요약

이번 변경의 핵심인 `RolesGuard` 전역 등록 리팩터링은 각 컨트롤러의 `@UseGuards(RolesGuard)` 보일러플레이트를 일관되게 제거하여 유지보수 부담을 크게 낮추었고, `APP_GUARD` 순서 주석과 `workspaces.module.ts` 의 설명 주석은 의도를 잘 전달한다. 그러나 `transferOwnership` 서비스 메서드에서 `workspace` 레코드에 비관적 락이 누락되어 동시성 안전성에 빈틈이 있고, 컨트롤러에 `@Roles('owner')` 가 빠져 가드 레이어의 조기 거부가 작동하지 않는 패턴 불일치가 존재한다. 프런트엔드에서 네이티브 `<select>` 를 사용한 부분은 디자인 시스템 일관성을 깬다. 나머지는 정보성 수준의 관찰로, 전체 코드 품질은 양호하다.

### 위험도

**MEDIUM** — 동시성 엣지케이스(workspace 락 누락)와 패턴 불일치(컨트롤러 `@Roles` 누락)가 복합적으로 존재하나, 실제 트리거 빈도가 낮고 서비스 레이어 검증이 기본 보호는 제공하여 즉각적 장애 가능성은 낮다.