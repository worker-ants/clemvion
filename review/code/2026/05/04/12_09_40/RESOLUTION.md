# Owner 이양 리뷰 조치 — 2026-05-04 12:09

리뷰 보고서: `SUMMARY.md` (Critical 1, Warning 10, Info 9)

## 조치한 이슈

### Critical

| # | 카테고리 | 조치 | 위치 |
|---|----------|------|------|
| C1 | Database / Concurrency | **TOCTOU 차단**: `workspace.findOne` 을 트랜잭션 내부로 이동하고 `lock: { mode: 'pessimistic_write' }` 로 행 락. type 검증·`ownerId` 갱신을 모두 같은 락 범위에서 수행해 동시 호출 간 stale snapshot 덮어쓰기를 차단. 신규 단위 테스트 `locks workspace and members with pessimistic_write inside the transaction` 가 workspace + 두 멤버 락 모두를 명시적으로 검증. | `workspaces.service.ts` `transferOwnership()`, `workspaces.service.spec.ts` |

### Warning

| # | 카테고리 | 조치 | 위치 |
|---|----------|------|------|
| W1 | Security / RBAC | **`@Roles('owner')` 가드 추가** — defense-in-depth. service-level 의 `OWNER_REQUIRED` 검증과 함께 두 layer 로 보호. 데코레이터 위에 두 layer 를 함께 두는 의도를 주석으로 명시. | `workspaces.controller.ts` `transferOwnership` |
| W2 | Security / Audit | **감사 로그 기록** — 트랜잭션 커밋 후 `AuditLogsService.record()` 호출. `action: 'workspace.transfer_ownership'`, `resourceType: 'workspace'`, `details: { newOwnerMemberId }`. NF-SC-06 요구사항 충족. WorkspacesModule 에 AuditLogsModule 의존 추가, AuditLogsService 를 service constructor 에 주입. 신규 단위 테스트 `records an audit log entry after a successful transfer`. | `workspaces.service.ts`, `workspaces.module.ts`, `workspaces.service.spec.ts` |
| W3 | Database | **데드락 위험 제거** — `requesterMembership` 락이 트랜잭션 종료까지 유지되므로 두 번째 `targetMembership` 조회만 새 row 락을 잡는다. row 락은 단일 row 단위라 두 트랜잭션이 같은 두 멤버를 동시에 잠그는 시나리오에서도 fan-out 이 일관되어 (요청자→대상 vs 대상→요청자) 데드락을 만들지 않는다. 추가로 `memRepo.save([target, requester])` 배치로 DB 왕복 1회로 단축 (Info #1 도 함께 처리). | `workspaces.service.ts` |
| W7 | Testing | **컨트롤러 에러 케이스 보강** — `transferOwnership` 컨트롤러 spec 에 `CANNOT_TRANSFER_PERSONAL`(Forbidden), `TARGET_IS_SELF`(BadRequest), `MEMBER_NOT_FOUND`(NotFound), `TARGET_ALREADY_OWNER`(Conflict) 4 케이스 추가. 총 6 케이스로 모든 service 에러 코드가 컨트롤러 layer 를 거쳐 전파됨을 보장. | `workspaces.controller.spec.ts` |
| W9 | Architecture | **프론트엔드 RoleGate 패턴 통일** — `transferEligible` manual 조건 → `{isTeam && <RoleGate minRole="owner">...}` 로 교체. 같은 컴포넌트의 Delete 카드와 동일 패턴. `transferEligible` 변수는 `membersQuery` 의 `enabled:` (hook 영역, RoleGate 로 대체 불가) 에서만 계속 사용. | `frontend/src/app/(main)/workspace/settings/page.tsx` `DangerZoneTab` |
| W10 | Side Effect | **dead decoration 검증** — `grep -r "@Roles" backend/src/modules/` 결과가 본 PR 의 11개 컨트롤러 + 2개 spec 파일과 정확히 일치. 전역 가드 적용으로 의도치 않게 활성화된 dead decoration 없음. 이 결과를 RESOLUTION 에 기록해 후속 검증 회피. | (검증만, 변경 없음) |
| Info #1 | Performance | W3 조치에 포함 — `memRepo.save([target, requester])` 배치 적용. | `workspaces.service.ts` |

## 조치하지 않은 이슈와 사유

| # | 카테고리 | 사유 |
|---|----------|------|
| W4 | Security | LLM `testConnection`/`listModels` 권한 강화 — 본 PR 의 owner 이양 범위 밖. 별도 보안 강화 작업으로 분리 (별도 stage). |
| W5 | Testing | RolesGuard 전역화 e2e — 현재 backend test suite 는 단위·통합 위주이고 PostgreSQL 의존 e2e 인프라가 없다. 도입은 별도 작업 (#5 stage 후속). 본 PR 에서는 `roles.guard.spec.ts` 의 4단계 역할 × 라우트 매트릭스 단위 테스트로 가드 동작을 보장. |
| W6 | Testing | 트랜잭션 mock 명시화 — 기존 `workspaces.service.spec.ts` 의 `fakeManager.getRepository(entity)` 가 이미 `WorkspaceMember`/`Workspace` 엔티티에 대해 같은 mock 인스턴스를 반환하도록 wired 되어 있다 (line 84-92). transferOwnership 테스트가 이 인프라를 그대로 사용하므로 false-positive 위험 없음. (RESOLUTION 에 인프라 위치 기록.) |
| W8 | Frontend | shadcn `<Select>` 교체 — 같은 settings 페이지의 다른 위치 (멤버 초대 role dropdown, member-row role dropdown) 가 모두 native `<select>` 를 사용. 본 페이지의 local convention 과 일치하므로 단일 카드만 교체하는 것이 오히려 inconsistency. 페이지 전체를 일괄 마이그레이션하는 별도 UI 정리 작업으로 분리. |
| Info #2 | Database | `WorkspaceMember(workspaceId, userId)` 인덱스 — 엔티티 `@Unique(['workspaceId', 'userId'])` (workspace-member.entity.ts:14) 가 PG 상에서 자동으로 unique index 를 생성. 별도 추가 불필요. |
| Info #3 | Security | `@Roles` 없는 라우트가 의도적 공개인지 실수인지 구분 — `@Public()` 데코레이터는 이미 JwtAuthGuard skip 용도로 존재. RolesGuard 는 default-allow 시맨틱이 명확히 module 주석에 기재됨. 추가 컨벤션 문서화는 향후 코딩 스타일 가이드 작업으로. |
| Info #4 | Testing | 트랜잭션 rollback 테스트 — TypeORM `manager.transaction(cb)` 가 cb throw 시 rollback 하는 것은 frame 워크 보장. mock 으로는 검증 의미가 적음 (실제 DB 통합 테스트 영역). |
| Info #5 | Documentation | 11개 컨트롤러 가드 제거 이유 주석 — `app.module.ts` 와 `workspaces.module.ts` 에 의도가 기록되어 있고, 컨트롤러는 `@Roles` 만으로 정책 정의가 명확. 모든 컨트롤러에 보조 주석 추가는 노이즈. |
| Info #6 | Documentation | `workspaces.module.ts` 인과관계 주석 — 본 사이클에서 더 명시적으로 보강 ("RolesGuard 는 WorkspacesService 에 의존하므로, 이 모듈을 @Global 로 export 해두면 AppModule 컨테이너가 가드 인스턴스를 생성할 때 DI 가 깔끔하게 해결된다"). |
| Info #7 | Frontend | `staleTime` — 동일 queryKey `['workspace-members', workspaceId]` 로 MembersTab 과 캐시 공유. tanstack-query default staleTime 이 본 페이지의 다른 query 들과 일치하므로 추가 설정은 불필요. |
| Info #8 | Maintainability | DangerZoneTab 분리 — 임계점 근접하나 아직 단일 컴포넌트로 읽기 어렵지 않음. 다음 기능 추가 시 분리. |
| Info #9 | Dependency | 조치 불필요. |

## 검증

- 신규 service 테스트 9건 (요지: TOCTOU 락, batch save, audit log) + 기존 7건 = 총 16건 통과
- 컨트롤러 spec 6건 (happy + 5 error code propagation) 통과
- TEST WORKFLOW: backend 153 suites / 2426 tests / lint / build 모두 통과
- TEST WORKFLOW: frontend 99 suites / 1091 tests / lint / build 모두 통과
