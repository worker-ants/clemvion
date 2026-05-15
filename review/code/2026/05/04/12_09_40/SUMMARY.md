# Code Review 통합 보고서

## 전체 위험도
**HIGH** — `transferOwnership` 트랜잭션 설계의 TOCTOU 경합(workspace 엔티티 락 누락)이 실제 데이터 정합성 손상으로 이어질 수 있으며, Guard 레이어 역할 검증 누락 및 감사 로그 미생성이 복합적으로 존재한다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Database / Concurrency | **workspace 엔티티를 트랜잭션 외부에서 락 없이 로드 후 트랜잭션 내부에서 저장 (TOCTOU)** — `workspace` 객체는 트랜잭션 시작 전 `this.workspaceRepository.findOne()`으로 로드되어 `FOR UPDATE` 락 범위 밖에 있다. `WorkspaceMember`에는 `pessimistic_write` 락이 걸리지만 `workspace` 행은 잠기지 않아, 동시 `transferOwnership` 요청이 들어오면 두 트랜잭션이 각자의 stale snapshot으로 `ownerId`를 덮어쓸 수 있다. | `workspaces.service.ts` — `transferOwnership()`, 트랜잭션 외부 `findOne` → 트랜잭션 내부 `wsRepo.save(workspace)` | `workspace` 조회를 트랜잭션 내부로 이동하고 `lock: { mode: 'pessimistic_write' }` 적용. 또는 `wsRepo.update({ id: workspaceId }, { ownerId: targetMembership.userId })`로 변경 컬럼만 대상 UPDATE |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / RBAC | **`transferOwnership` 엔드포인트에 `@Roles('owner')` 데코레이터 누락** — 전역 `RolesGuard`는 `@Roles` 없는 라우트를 default-allow로 통과시키므로, 인증된 모든 사용자(viewer 포함)가 이 엔드포인트를 호출할 수 있다. 서비스 레이어의 `OWNER_REQUIRED` 검증이 최종 방어선이 되며, 다른 write 엔드포인트(`@Roles('editor')`, `@Roles('admin')`)와 패턴이 불일치한다. | `workspaces.controller.ts` — `transferOwnership` 메서드 | `@Roles('owner')` 추가. 워크스페이스 컨트롤러 전체가 service-level 검증 패턴을 의도적으로 사용한다면 컨트롤러 상단에 해당 전략을 명시하는 주석 추가 |
| 2 | Security / Audit | **ownership 이양에 감사 로그(Audit Log) 미생성** — 워크스페이스의 최종 통제권이 이전되는 고-임팩트 보안 이벤트임에도 `AuditLog` 기록이 없다. 프로젝트의 `NF-SC-06` 요구사항(주요 액션 감사 로그 ✅)과 정합성 불일치 가능성이 있다. | `workspaces.service.ts` — `transferOwnership()` 메서드 | 트랜잭션 완료 후 `action: 'transfer_ownership'`, 이전 owner, 신규 owner 정보를 `AuditLog` 엔티티에 기록 |
| 3 | Database | **데드락 위험: 두 멤버 락 획득 순서가 고정되지 않음** — A→B 이양과 B→A 이양이 동시에 시도될 경우(멀티탭·재시도 시나리오), 트랜잭션 1이 A를 락하고 B를 기다리는 동안 트랜잭션 2가 B를 락하고 A를 기다리면 데드락이 발생한다. PostgreSQL은 데드락 발생 시 한 트랜잭션을 롤백하므로 500 오류로 노출된다. | `workspaces.service.ts` — 트랜잭션 내부, `requesterMembership` → `targetMembership` 락 순서 | 두 멤버 ID를 오름차순 정렬 후 단일 `IN` 쿼리로 묶어 동시에 락: `memRepo.find({ where: { id: In([id1, id2].sort()), workspaceId }, lock: { mode: 'pessimistic_write' }, order: { id: 'ASC' } })` |
| 4 | Security | **LLM `testConnection` / `listModels` 엔드포인트에 역할 제한 없음** — 두 엔드포인트 모두 `@Roles` 데코레이터가 없어 인증된 viewer도 호출 가능하다. 외부 LLM Provider API를 실제 호출하므로 다수가 반복 호출 시 의도치 않은 API 비용이 발생한다. `@Throttle`이 완화책이나 완전한 차단이 아니다. | `llm-config.controller.ts` — `POST /:id/test`, `GET /:id/models` | 두 엔드포인트에 `@Roles('editor')` 또는 최소 `@Roles('viewer')` 명시 추가 |
| 5 | Testing | **`RolesGuard` 전역화 리팩토링에 대한 통합/e2e 테스트 부재** — 9개 컨트롤러에서 `@UseGuards(RolesGuard)`를 일괄 제거했으나, 기존 역할 제어가 깨지지 않았는지 검증하는 회귀 테스트가 없다. `@Roles` 없는 라우트가 default-allow로 동작하는지도 미검증 상태이다. | `app.module.ts` + `alerts`, `auth-configs`, `folders`, `integrations`, `knowledge-base` 등 9개 컨트롤러 | viewer/editor 권한으로 admin 전용 엔드포인트 호출 시 403 반환을 확인하는 e2e 또는 통합 테스트 추가 |
| 6 | Testing | **`transferOwnership` 트랜잭션 내부 repo 모킹 일관성 미보장** — 서비스 코드는 트랜잭션 내부에서 `manager.getRepository()`로 새 repo 인스턴스를 얻지만, 테스트는 주입된 원본 `memberRepo` mock을 단언한다. `manager.getRepository()`가 동일 mock을 반환하도록 명시적으로 설정되어 있지 않으면 false-positive 가능성이 있다. | `workspaces.service.spec.ts` — `atomically swaps roles` 테스트, `beforeEach` 설정 | `memberRepository.manager.transaction`을 명시적으로 mock하여 `manager.getRepository(Entity)`가 테스트의 mock 인스턴스를 반환함을 보장 |
| 7 | Testing | **`transferOwnership` 컨트롤러 spec의 에러 케이스 불완전** — happy path와 `ForbiddenException` 전파만 커버하며, `NotFoundException`(워크스페이스/멤버 없음), `ConflictException`(이미 owner), `BadRequestException`(자기 자신 지정) 케이스가 미검증이다. | `workspaces.controller.spec.ts` — `transferOwnership` describe 블록 | `NotFoundException`, `ConflictException`, `BadRequestException` 케이스별 테스트 추가 |
| 8 | Frontend | **이양 대상 선택에 네이티브 `<select>` 사용 — 디자인 시스템 불일치** — 프로젝트 전반에서 Radix 기반 `@/components/ui/select`를 사용하지만, 이양 대상 선택 UI만 네이티브 `<select>`를 사용한다. 스타일, 포커스 링, 다크 모드, 접근성 동작이 다른 폼 요소와 다르다. | `frontend/src/app/(main)/workspace/settings/page.tsx` — `DangerZoneTab` 내 transfer dialog | `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` (shadcn/ui) 컴포넌트로 교체 |
| 9 | Architecture | **프론트엔드 역할 가드 방식 불일치** — 워크스페이스 삭제 카드는 `<RoleGate minRole="owner">`를 사용하지만, owner 이양 카드는 `const transferEligible = isTeam && isOwner` 수동 조건으로 처리한다. 같은 컴포넌트 내에 두 패턴이 혼재한다. | `frontend/src/app/(main)/workspace/settings/page.tsx` — `DangerZoneTab` | owner 이양 카드도 `{isTeam && <RoleGate minRole="owner">...</RoleGate>}`로 통일 |
| 10 | Side Effect | **전역 가드 적용 전 `@Roles`만 달린 컨트롤러에 소급 적용 여부 미검증** — 전역 가드 적용 전에 `@UseGuards(RolesGuard)` 없이 `@Roles`만 달아 dead decoration이었던 엔드포인트가 전역 가드 등록 후 실제로 동작하게 되어 의도치 않은 403이 발생할 수 있다. | `app.module.ts` APP_GUARD 등록, 이번 diff 범위 밖 컨트롤러들 | `grep -r "@Roles" backend/src` 결과와 이번 diff 컨트롤러 목록을 대조해 누락된 컨트롤러 검증 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | **멤버 `save` 2회 순차 호출 — 배치 처리 가능** — `await memRepo.save(targetMembership)` + `await memRepo.save(requesterMembership)` 순차 실행으로 DB 왕복이 2회 발생한다. | `workspaces.service.ts` — 트랜잭션 내부 | `await memRepo.save([targetMembership, requesterMembership])`로 단일 왕복 처리 |
| 2 | Database | **`WorkspaceMember(workspaceId, userId)` 복합 인덱스 존재 여부 확인 필요** — 멤버 조회·역할 검증에 빈번히 사용되는 `(workspaceId, userId)` 쿼리에 해당 복합 인덱스가 없으면 full scan이 발생한다. | `WorkspaceMember` 엔티티 / 마이그레이션 | 엔티티 또는 마이그레이션에 `@Index(['workspaceId', 'userId'], { unique: true })` 존재 여부 검토 |
| 3 | Security | **전역 opt-out RolesGuard 전환으로 인한 미래 위험** — `@Roles` 없이 새 엔드포인트를 추가하면 인증된 모든 사용자에게 의도치 않게 노출된다. `@Roles` 없는 라우트가 의도적 공개인지 실수인지 구분이 어려워진다. | `app.module.ts` | 명시적으로 공개 접근을 허용하는 엔드포인트에 `@Public()` 또는 빈 `@Roles()` 형태로 의도를 표현하는 관행을 코딩 컨벤션으로 문서화 |
| 4 | Testing | **트랜잭션 atomicity/rollback 동작 미검증** — 첫 번째 `save` 실패 시 두 번째 `save`가 실행되지 않아야 하는 롤백 동작이 테스트되지 않는다. 부분 커밋 시 데이터 불일치가 생길 수 있는 고위험 코드 경로이다. | `workspaces.service.spec.ts` | `memRepo.save`가 첫 번째 호출에서 예외를 던질 때 `workspaceRepo.save`가 호출되지 않고 예외가 전파되는지 테스트 추가 |
| 5 | Documentation | **11개 컨트롤러에서 `@UseGuards(RolesGuard)` 제거 이유 미기재** — `app.module.ts`와 `workspaces.module.ts`의 주석이 근거를 제공하지만, 해당 파일을 보지 않은 개발자는 실수로 제거된 것으로 오해하고 재추가할 수 있다. | `alerts.controller.ts` 외 10개 컨트롤러 | 대표 컨트롤러 하나에 `// RolesGuard는 AppModule APP_GUARD로 전역 등록됨 — 별도 UseGuards 불필요` 주석 추가 |
| 6 | Documentation | **`workspaces.module.ts` 주석에 DI 인과관계 누락** — "WorkspacesService만 @Global로 export해두면 RolesGuard의 DI가 해결된다"는 주석에서 왜 그런지 이유가 생략되어 있다. | `workspaces.module.ts` 상단 주석 | `WorkspacesService만 @Global로 export해두면 RolesGuard(WorkspacesService에 의존)의 DI가 해결된다`로 인과관계 명시 |
| 7 | Frontend | **`membersQuery`에 `staleTime` 미설정** — owner가 탭을 자주 전환할 경우 마운트 시마다 멤버 목록을 재fetch한다. `MembersTab`과 동일 queryKey를 공유하므로 캐시 공유는 가능하나 명시적으로 문서화되지 않았다. | `frontend/src/app/(main)/workspace/settings/page.tsx` — `DangerZoneTab` `membersQuery` | `staleTime: 30_000` 추가 또는 캐시 공유 의도를 주석으로 명시 |
| 8 | Maintainability | **`DangerZoneTab` 컴포넌트 복잡도 증가** — Leave / Delete / TransferOwnership 세 가지 뮤테이션과 각각의 다이얼로그 상태가 단일 컴포넌트(~160줄)에 집약되어 있다. 다음 기능 추가 시 분리가 필요한 임계점에 근접했다. | `frontend/src/app/(main)/workspace/settings/page.tsx` — `DangerZoneTab` | transfer 관련 state와 mutation을 `TransferOwnershipCard` 별도 컴포넌트로 추출 고려 |
| 9 | Dependency | **신규 외부 의존성 없음, `RolesGuard` DI 단순화** — 새 npm 패키지 추가 없음. `RolesGuard` 전역 등록으로 내부 의존 관계가 오히려 정리됨. | `package.json`, `app.module.ts`, `workspaces.module.ts` | 조치 불필요 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Database | **HIGH** | workspace 엔티티 트랜잭션 외부 조회 → 내부 저장 (CRITICAL), 데드락 위험 |
| Concurrency | **MEDIUM** | TOCTOU 경합 (workspace 락 누락), 멤버 락 순서는 안전 |
| Security | **LOW-MEDIUM** | Guard 계층 역할 검증 누락, TOCTOU, LLM 엔드포인트 역할 미설정 |
| Architecture | **MEDIUM** | TOCTOU 패턴, 인가 전략 불일치, 프론트엔드 RoleGate 불일치 |
| Maintainability | **MEDIUM** | workspace 락 누락, `@Roles` 누락, 네이티브 select 불일치 |
| Requirement | **MEDIUM** | `@Roles('owner')` 누락, TOCTOU, 감사 로그 미생성 |
| Testing | **MEDIUM** | 트랜잭션 mock 일관성, RolesGuard 회귀 테스트 부재, 에러 케이스 누락 |
| Side Effect | **MEDIUM** | TOCTOU, `@Roles` 누락, 전역 가드 소급 적용 위험 |
| Performance | **MEDIUM** | TOCTOU(정합성), save 2회 순차 호출 |
| API Contract | **LOW** | TOCTOU (경고), 기타 계약 준수 양호 |
| Scope | **LOW** | `@Roles` 누락 패턴 불일치, page.tsx diff 혼재 |
| Documentation | **LOW** | 가드 제거 이유 미기재, 주석 인과관계 누락 |
| Dependency | **LOW** | 신규 외부 의존성 없음, DI 정리 완료 |

---

## 발견 없는 에이전트

없음 — 모든 에이전트가 1개 이상의 발견사항을 보고함.

---

## 권장 조치사항

1. **[즉시 필수] `transferOwnership` — workspace 엔티티를 트랜잭션 내부로 이동 + `pessimistic_write` 락 적용**
   `workspace` 조회 및 `type === 'personal'` 검증을 트랜잭션 안으로 옮기고, `wsRepo.findOne({ ..., lock: { mode: 'pessimistic_write' } })`로 원자성 확보. 가장 많은 리뷰어(9명)가 지적한 핵심 결함.

2. **[즉시 필수] 데드락 예방 — 두 멤버 락을 단일 `IN` 쿼리로 통합**
   `memRepo.find({ where: { id: In([id1, id2].sort()) }, lock: { mode: 'pessimistic_write' }, order: { id: 'ASC' } })`로 락 순서를 항상 일관되게 유지.

3. **[권장] `transferOwnership` 엔드포인트에 `@Roles('owner')` 추가**
   Guard 레이어의 defense-in-depth 확보. 워크스페이스 컨트롤러 전체가 service-level 패턴을 의도적으로 유지한다면, 그 결정을 컨트롤러 상단 주석으로 명시.

4. **[권장] 감사 로그(Audit Log) 추가**
   트랜잭션 완료 후 `action: 'transfer_ownership'`, 이전/신규 owner ID를 `AuditLog` 엔티티에 기록. `NF-SC-06` 요구사항 충족.

5. **[권장] RolesGuard 전역화 회귀 테스트 추가**
   viewer/editor 권한으로 admin 전용 엔드포인트 호출 시 403 반환을 검증하는 e2e 또는 통합 테스트. 9개 컨트롤러에 걸친 리팩토링의 안전망.

6. **[권장] 트랜잭션 내부 repo mock 명시화 및 에러 케이스 테스트 보완**
   `memberRepository.manager.transaction` mock 설정을 명시적으로 고정하고, `NotFoundException` / `ConflictException` / `BadRequestException` 케이스 테스트 추가.

7. **[선택] LLM `testConnection` / `listModels` 엔드포인트에 `@Roles('editor')` 추가**
   외부 API 비용 남용 가능성 차단.

8. **[선택] 프론트엔드 이양 대상 선택 UI를 shadcn/ui `<Select>`로 교체 및 `<RoleGate>` 패턴 통일**
   디자인 시스템 일관성 확보.

9. **[선택] `grep -r "@Roles" backend/src` 로 전역 가드 소급 적용 범위 검증**
   이번 diff에 포함되지 않은 컨트롤러 중 dead decoration이었던 `@Roles`가 활성화되지 않았는지 확인.