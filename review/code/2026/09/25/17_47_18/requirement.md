# 요구사항(Requirement) 리뷰 — workspace-path-guard (4라운드)

## 발견사항

- **[WARNING]** `transferOwnership` 의 서비스 계층이 "존재 · 유형 오라클" 제거 원칙에서 빠져 있다 — spec/CHANGELOG 는 정확히 두 메서드(`leaveWorkspace` · `addMemberByEmail`)만 고쳤다고 서술하는데, 같은 모양의 오라클이 `transferOwnership` 에도 남아 있다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `transferOwnership` (게이트 717~735, 특히 726~739) — 트랜잭션 안에서 `wsRepo.findOne` → `!workspace` 404 `WORKSPACE_NOT_FOUND` → `workspace.type==='personal'` 403 `CANNOT_TRANSFER_PERSONAL` 를 먼저 던지고, 요청자의 멤버십/역할(`OWNER_REQUIRED`) 판정은 그 **뒤**(751~747행대)에 온다.
  - 상세: 같은 PR 의 `spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다"는 "2026-09-25 실측: 인가 누락은 없었으나 **두 메서드**(`leaveWorkspace` · `addMemberByEmail`)가 인가 **전에** 워크스페이스를 조회해 비멤버가 «없음 · 개인 · 팀» 을 구분할 수 있었다"고 명시하고, CHANGELOG 도 동일하게 "종전 `POST /:id/leave` · `POST /:id/members` 는 없음(404)·개인·팀을 구분해 답했다(서비스도 인가를 조회보다 앞으로 옮겼다)"고 두 곳만 든다. 그런데 `transferOwnership` 은 이번 diff 에서 손대지 않았고(파일 18 diff 에 `transferOwnership` 관련 hunk 없음), 여전히 워크스페이스 조회(존재·유형) → 요청자 멤버십/role 판정 순서다. 이는 `assertWorkspaceDeletable`(605~624행, 멤버십 체크가 존재 체크보다 **먼저** 결정된다 — `!myMembership || role!=='owner'` 를 `!workspace` 보다 먼저 throw)과 대비된다. `transferOwnership` 라우트는 이번 PR 로 `@Roles('owner')` + `@WorkspaceParam('id')` 가 붙어 `RolesGuard` 가 **정상 동작 시**에는 비멤버를 서비스 도달 전에 `403 NOT_A_MEMBER` 로 막으므로 1차 방어선은 닫혀 있다. 하지만 정확히 `leaveWorkspace`/`addMemberByEmail` 을 고친 이유("두 번째 선에도 같은 오라클이 남지 않게")와 동일한 논리가 `transferOwnership` 에도 적용돼야 하는데 적용되지 않았다 — 가드 reflection 이 부분 파손되는 시나리오(코드 자신도 "부분 파손은 이 단언이 못 잡는다"고 인정)에서 비멤버가 임의 워크스페이스 ID 에 대해 "없음(404) · 개인(403 CANNOT_TRANSFER_PERSONAL) · 팀+비-owner(403 OWNER_REQUIRED)" 3-way 오라클을 여전히 얻는다.
  - 제안: `transferOwnership` 도 트랜잭션 진입 직후 요청자의 멤버십·owner 여부를 **먼저** 판정(`!requesterMembership || role!=='owner'` → `OWNER_REQUIRED`)한 뒤에 워크스페이스 존재·유형을 확인하도록 재정렬하거나(락 순서·데드락 회피는 유지 가능 — `assertWorkspaceDeletable` 이 이미 같은 패턴을 보여준다), 의도적으로 범위 밖이라면 spec Rationale·CHANGELOG 의 "두 메서드" 서술에 `transferOwnership` 을 셋째로 추가하고 왜 재정렬하지 않았는지 근거를 남길 것. 둘 중 어느 쪽도 없이 "두 메서드만" 이라는 현재 서술은 코드와 line-level 로 어긋난다.

- **[INFO]** `workspace-invitations.service.ts` 의 `assertAdmin` 은 `workspaces.service.ts` 의 동형 함수와 달리 `NOT_A_MEMBER`/`ADMIN_REQUIRED` 를 분리하지 않고 소문자 `admin_required` 하나로 합쳐 던진다.
  - 위치: `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` `assertAdmin` (게이트 539~549) — `if (!member || !ADMIN_ROLES.has(member.role)) throw ... 'admin_required'`. 대조: `codebase/backend/src/modules/workspaces/workspaces.service.ts` 943~948행은 `if (!role) throwNotAMember(); if (!ADMIN_ROLES.has(role)) throwAdminRequired();` 로 분리했다.
  - 상세: 이 경로는 HTTP 상 도달 불가(초대 라우트가 `@Roles('admin')` + `@WorkspaceParam` 이라 가드가 먼저 막는다)한 "두 번째 선" 이고, docstring 이 "소문자 admin_required 는 이 선에서만 나간다"고 명시적으로 근거(`error-codes.md §3`)를 남겨 뒀다 — 의도된 historical artifact 로 보인다. 다만 `workspaces.service.ts` 쪽은 같은 역할의 두 번째 선을 가드와 같은 코드 체계로 분리했는데 이쪽만 합쳐진 것은 "두 선이 같은 실패에 같은 답을 낸다"는 이 PR 의 원칙과 불일치한다. 실질 영향은 없음(가드가 항상 먼저 막음).
  - 제안: 조치 불요(현행 문서화로 충분) — 다만 향후 이 두 번째 선을 정리할 기회가 있으면 `NOT_A_MEMBER`/`ADMIN_REQUIRED` 분리도 함께 통일할 것.

- **[INFO]** `RolesGuard.canActivate` 의 경로-워크스페이스 분기(`pathParamNames.length > 0`)는 한 핸들러가 **복수의** `@WorkspaceParam` 을 가질 때 각 파라미터에 대해 **같은 `requiredRoles` 전체**로 `assertMember` 를 반복 호출한다 — 현재 실제 라우트는 모두 단일 `id` 하나뿐이라(15곳 전부 `@WorkspaceParam('id')` 하나, `workspace-roles-attachment.spec.ts` 표로 고정) 관측 가능한 결함은 아니다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` 게이트 154~168 (`for (const name of pathParamNames) { ... await this.assertMember(raw, userId, requiredRoles); }`).
  - 상세: 만약 향후 두 워크스페이스를 동시에 받는 라우트에 `@Roles()` 가 붙으면, 두 워크스페이스 모두에 **동일한** 최소 역할이 요구되는 것으로 판정된다(레거시 `twoPaths` 픽스처는 `@Roles()` 없이만 테스트됨 — `roles.guard.spec.ts` 게이트 692~726 부근). 오늘은 그런 라우트가 없어 회색지대(spec 도 이 조합을 규정하지 않는다).
  - 제안: 조치 불요. 향후 그런 라우트가 생기면 설계를 재검토할 것.

## 요약

`workspace-path-guard` 구현은 spec(`spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다" · "가드 거부의 오류 코드")과 코드가 필드명·에러 코드·역할 목록(admin 8 · owner 2 · null 5, 전환 1 포함 15곳)·검증 순서·기본값까지 매우 촘촘하게 line-level 로 일치하며, `RolesGuard`·`workspaceParamNamesOf`·`WorkspaceParam` 데코레이터·부트 캐너리·저장소 가드(`workspace-param-binding`)가 서로 보강하는 다층 방어를 구성하고 뮤테이션 테스트(17건 전부 KILLED)로 각 분기가 실제로 커버됨을 확인했다. 유일하게 발견한 실질 이슈는 `transferOwnership` 서비스 메서드가 "인가를 조회보다 앞에 둬 존재·유형 오라클을 닫는다"는 이번 PR 의 원칙에서 예외로 남아 있다는 점이며, spec/CHANGELOG 가 "leaveWorkspace·addMemberByEmail 두 곳뿐" 이라고 서술한 것과 실제 코드 상태가 어긋난다 — 다만 `RolesGuard` 가 정상 동작하는 한 이 오라클은 1차 방어선에서 이미 차단되므로(가드 reflection 파손이라는 이미 카나리로 감시되는 실패 모드에서만 노출) 실질 익스플로잇 가능성은 낮다. 그 외 TODO/FIXME 없음, 반환값·에러 시나리오·엣지 케이스(빈 배열·nil UUID·형식 파손·헤더 위조·복수 경로 파라미터) 모두 단위/e2e 테스트로 커버됨을 확인했다.

## 위험도

LOW
