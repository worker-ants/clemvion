## 발견사항

### [WARNING] workspace 엔티티를 트랜잭션 외부에서 로드 후 내부에서 저장 (TOCTOU)
- **위치**: `workspaces.service.ts` `transferOwnership`, 라인 ~407 및 ~458
- **상세**: `workspace` 엔티티는 트랜잭션 시작 전에 `this.workspaceRepository.findOne()`으로 로드됩니다. 이후 트랜잭션 내부에서 `wsRepo.save(workspace)`로 저장할 때, 외부에서 가져온 snapshot을 사용하므로 `FOR UPDATE` 락이 걸리지 않습니다. 두 owner 가 동시에 `transferOwnership`을 호출하면 두 트랜잭션이 각자 로드한 stale `workspace`로 `ownerId`를 덮어쓸 수 있습니다.
- **제안**:
  ```typescript
  // 트랜잭션 안에서 재조회
  const ws = await wsRepo.findOne({
    where: { id: workspaceId },
    lock: { mode: 'pessimistic_write' },
  });
  // ... 검증 후
  ws.ownerId = targetMembership.userId;
  await wsRepo.save(ws);
  ```

---

### [WARNING] `POST /workspaces/:id/transfer-ownership` 에 `@Roles` 데코레이터 누락
- **위치**: `workspaces.controller.ts` `transferOwnership` 메서드
- **상세**: 전역 `RolesGuard`는 `@Roles` 데코레이터가 없는 라우트를 default-allow로 통과시킵니다. 따라서 인증된 모든 사용자(viewer 포함)가 이 엔드포인트를 호출할 수 있고, 가드 단계에서 차단되지 않아 서비스 레이어 DB 조회까지 도달합니다. 서비스 내 `OWNER_REQUIRED` 검증이 최종 방어선이 됩니다. 다른 쓰기 엔드포인트(`@Roles('editor')`, `@Roles('admin')`)와 일관성이 없습니다.
- **제안**: `@Roles('owner')` 추가를 검토하세요. 단, `leaveWorkspace`·`deleteWorkspace` 등 다른 workspace 관리 엔드포인트들이 동일하게 service-level 검증만 사용한다면 의도된 패턴으로 볼 수 있습니다.

---

### [WARNING] `RolesGuard`가 이전에 `@UseGuards(RolesGuard)` 없이 `@Roles`만 달린 컨트롤러에 소급 적용
- **위치**: `app.module.ts` APP_GUARD 등록
- **상세**: 전역 가드 적용 전에 `@Roles()`를 달았으나 `@UseGuards(RolesGuard)`가 없었던 엔드포인트(이번 diff에 없는 컨트롤러)는 `@Roles`가 dead decoration이었습니다. 전역 가드 적용 후 해당 데코레이터가 실제로 동작하게 되어 의도하지 않은 403이 발생할 수 있습니다. 이번 PR diff에 포함된 컨트롤러들은 명시적으로 가드를 달았으나, 범위 밖 컨트롤러가 없는지 확인이 필요합니다.
- **제안**: `grep -r "@Roles" backend/src` 결과와 이번 diff의 컨트롤러 목록을 대조해 누락된 컨트롤러가 없는지 검증하세요.

---

### [INFO] ownership transfer 에 audit log 없음
- **위치**: `workspaces.service.ts` `transferOwnership` 전체
- **상세**: `deleteWorkspace`, `removeMember` 등 다른 고위험 작업에 audit log가 기록된다면, ownership transfer는 더욱 보안 민감한 작업임에도 audit log 호출이 보이지 않습니다.
- **제안**: 트랜잭션 완료 후 audit log 엔트리를 추가하는 것을 검토하세요.

---

### [INFO] `DangerZoneTab` 에서 멤버 목록 queryKey 공유
- **위치**: `page.tsx` `DangerZoneTab`, `membersQuery`
- **상세**: `["workspace-members", workspaceId]` queryKey를 `MembersTab`과 공유합니다. 이는 의도된 캐시 공유로 긍정적이나, `onSuccess`에서 `invalidateQueries` 후 `refreshWorkspaces()`가 완료되면 현재 사용자 role이 admin으로 변경되어 `transferEligible`이 `false`가 됩니다. 이 시점에 `membersQuery`는 `enabled: false`가 되어 staleMilTime 후 GC되므로, 의도한 flow와 일치합니다. 문제없음.

---

### [INFO] `WorkspacesModule`에서 `RolesGuard` export 제거
- **위치**: `workspaces.module.ts`
- **상세**: 기존에 `WorkspacesModule`에서 `RolesGuard`를 export하고 있었으므로, 이 모듈을 imports한 다른 모듈이 DI로 `RolesGuard`를 주입받고 있다면 브레이킹 체인지입니다. 각 컨트롤러는 클래스를 직접 import해 `@UseGuards(RolesGuard)`로 사용했으므로 DI 의존성이 없지만, 혹시 `constructor(private guard: RolesGuard)` 패턴을 쓰는 곳이 있는지 확인이 필요합니다.
- **제안**: `grep -r "RolesGuard" backend/src --include="*.ts" | grep -v "import\|@UseGuards"` 로 DI 주입 여부를 확인하세요.

---

## 요약

이번 변경의 핵심은 `RolesGuard`를 컨트롤러별 `@UseGuards`에서 전역 `APP_GUARD`로 격상하고, ownership transfer 기능을 추가한 것입니다. 전반적인 설계는 올바르고 일관적이며, 트랜잭션 + FOR UPDATE 락 조합은 동시성 안전을 의도했습니다. 그러나 `workspace` 엔티티를 트랜잭션 외부에서 로드해 내부에서 저장하는 TOCTOU 패턴이 가장 실질적인 위험으로, 동시 요청 시 `ownerId`가 마지막 커밋으로 덮어써질 수 있습니다. 전역 가드 적용 범위 확대로 인한 기존 미체크 컨트롤러 소급 적용 여부도 별도 검증이 필요합니다.

## 위험도

**MEDIUM** — 주요 기능 로직은 안전하나, 트랜잭션 외부 엔티티 로드(TOCTOU) 패턴이 높은 동시성 환경에서 데이터 정합성 문제를 일으킬 수 있습니다.