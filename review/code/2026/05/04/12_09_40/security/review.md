### 발견사항

---

**[WARNING] `transferOwnership` 엔드포인트에 Guard 계층 역할 검증 누락**
- 위치: `workspaces.controller.ts` — `transferOwnership` 메서드
- 상세: `POST /workspaces/:id/transfer-ownership`에 `@Roles('owner')` 데코레이터가 없다. 전역 `RolesGuard`는 "decorator 없음 → default-allow" 의미론이므로, 인증된 모든 멤버(Viewer 포함)가 이 엔드포인트를 호출할 수 있다. 실제 owner 검증은 서비스 레이어에서 수행되어 기능적으로는 막히지만, Guard 계층의 조기 차단이 없다.
- 제안: 엔드포인트에 `@Roles('owner')` 추가로 guard-layer defense-in-depth 확보.

---

**[WARNING] `transferOwnership` 서비스: 워크스페이스 조회가 트랜잭션 밖에서 수행됨 (TOCTOU)**
- 위치: `workspaces.service.ts` — `transferOwnership` 메서드, 트랜잭션 블록 이전
- 상세: `workspace` 조회 및 `type === 'personal'` 검사가 트랜잭션 시작 전에 수행된다. 트랜잭션 내부에서 `workspace.ownerId`를 업데이트할 때 이 사전 로드된 객체를 그대로 사용하여 `wsRepo.save(workspace)`를 호출한다. 멤버 행에는 `pessimistic_write` 락이 걸리지만 워크스페이스 행은 락 없이 수정된다. 동시 호출 시나리오에서 `workspace.ownerId`가 stale 값으로 덮어쓰여질 수 있다. (단, 멤버 락에 의해 동일 requester의 중복 전송은 사실상 차단됨.)
- 제안: 워크스페이스 조회와 `type` 검사를 트랜잭션 내부로 이동하고, `SELECT ... FOR UPDATE` 락을 적용하여 원자성 보장.

```typescript
await this.memberRepository.manager.transaction(async (manager) => {
  const wsRepo = manager.getRepository(Workspace);
  const workspace = await wsRepo.findOne({
    where: { id: workspaceId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!workspace) throw new NotFoundException(...);
  if (workspace.type === 'personal') throw new ForbiddenException(...);
  // ... 이후 로직
});
```

---

**[WARNING] LLM `testConnection` / `listModels` 엔드포인트에 역할 제한 없음**
- 위치: `llm-config.controller.ts` — `POST /:id/test`, `GET /:id/models`
- 상세: 두 엔드포인트 모두 `@Roles` 데코레이터가 없어 인증된 Viewer도 호출 가능하다. 두 엔드포인트 모두 외부 LLM Provider API를 실제로 호출하므로, Viewer 다수가 반복 호출 시 의도치 않은 API 비용을 유발할 수 있다. `@Throttle`이 적용되어 있어 완화되지만 완전히 차단되지는 않는다.
- 제안: 두 엔드포인트에 `@Roles('editor')` 또는 최소한 `@Roles('viewer')` 명시 추가. 현재 구조에서 `@Roles` 없음은 "의도적으로 전체 허용"과 구분이 불가하여 가독성 문제도 있다.

---

**[INFO] 전역 Opt-out RolesGuard 전환으로 인한 미래 위험**
- 위치: `app.module.ts`
- 상세: `@UseGuards(RolesGuard)` 를 컨트롤러별로 붙이던 방식(opt-in)에서 전역 등록(opt-out)으로 전환됨. 이는 `@Roles` 데코레이터 없이 새 엔드포인트를 추가하면 인증된 모든 사용자에게 의도치 않게 노출될 수 있다. 기존 코드베이스에서 `@Roles` 없이 열어둔 엔드포인트 일부(`/schedules/preview`, `GET` 엔드포인트들)가 의도적인지 실수인지 구분이 어려워진다.
- 제안: 명시적으로 공개 접근을 허용하는 엔드포인트에 `@Public()` 또는 `@Roles()` 형태로 의도를 표현하는 관행을 코딩 컨벤션으로 문서화.

---

**[INFO] Owner 이양에 대한 Audit Log 미확인**
- 위치: `workspaces.service.ts` — `transferOwnership`
- 상세: Workspace 삭제, 멤버 역할 변경 등 고위험 작업에 Audit Log가 기록되는 것으로 보이나, `transferOwnership` 서비스 메서드 내에서 `AuditLog` 기록이 diff에 보이지 않는다. Owner 이양은 워크스페이스 제어권이 완전히 이전되는 고권한 작업이므로 감사 추적이 필수적이다.
- 제안: 트랜잭션 완료 후 `AuditLog` 엔티티에 `action: 'transfer_ownership'`, 이전 owner, 신규 owner 정보를 기록.

---

### 요약

이번 변경의 핵심은 `RolesGuard`를 전역 `APP_GUARD`로 승격시키고 Owner 이양 기능을 신규 추가한 것이다. 인젝션 취약점이나 하드코딩된 시크릿은 발견되지 않았으며, `IsUUID`/`ParseUUIDPipe` 입력 검증과 `pessimistic_write` 트랜잭션 락 활용은 적절하다. 에러 응답도 내부 스택 정보를 클라이언트에 노출하지 않는 방식으로 올바르게 처리되어 있다. 주요 우려사항은 (1) `transferOwnership` 엔드포인트의 Guard 계층 role 검증 미적용 — 서비스 레이어 검증으로 실제 차단은 되지만 defense-in-depth가 부족하고, (2) 워크스페이스 객체가 트랜잭션 외부에서 락 없이 로드되어 TOCTOU 가능성이 있으며, (3) LLM Provider API를 직접 호출하는 엔드포인트에 역할 제한이 없어 비용 남용 가능성이 존재한다.

### 위험도

**LOW-MEDIUM**