# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. Warning 8건은 전부 3라운드(`16_03_32`→`16_39_25`→`17_14_49`)가 이미 처분한 이슈들의 잔여 트레이드오프이거나, 이번 4라운드에서 새로 발견된 문서/테스트 커버리지 갭이며 인가 우회로 이어지는 항목은 없음. 강제(forced) 화이트리스트 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 누락된 forced reviewer 없음.

## Critical 발견사항

없음 (14개 reviewer 전원 Critical 0건).

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | 경로 워크스페이스 라우트 15곳에서 멤버십 SELECT 가 요청당 2회(가드+서비스) 확정 실행됨 — 읽기 전용 라우트(`getSettings`/`listMembers`)도 포함. 의도된 defense-in-depth 로 문서화돼 있으나 실제 쿼리비용/인덱스 실측은 아직 없음 | `codebase/backend/src/common/guards/roles.guard.ts:155-168`, `codebase/backend/src/modules/workspaces/workspaces.service.ts:220,481,936,944` | 쿼리비용 1회 실측해 spec Rationale 에 기록, `workspace_member(workspace_id,user_id)` 복합 인덱스 확인 |
| 2 | Architecture/SSOT | DTO 의 `WORKSPACE_ROLES`(`add-member.dto.ts`) 가 이번 PR 이 만든 단일 서열원 `WORKSPACE_ROLE_LEVEL`(`workspace-roles.ts`)에서 타입 파생되지 않고 독립 리터럴로 남음 — drift 방지가 런타임 테스트 하나에만 의존 | `codebase/backend/src/common/constants/workspace-roles.ts:1-14`, `codebase/backend/src/modules/workspaces/dto/add-member.dto.ts:4`, `workspace-roles.spec.ts:17-21` | `WORKSPACE_ROLES = Object.keys(WORKSPACE_ROLE_LEVEL) as WorkspaceRoleName[]` 로 파생시켜 SSOT 원칙을 DTO 계층까지 완결 |
| 3 | Requirement | `transferOwnership` 서비스 메서드가 "인가를 조회보다 앞에 둬 존재·유형 오라클을 닫는다"는 이번 PR 원칙의 예외로 남음 — spec Rationale/CHANGELOG 는 `leaveWorkspace`·`addMemberByEmail` 두 곳만 고쳤다고 서술하는데 실제로는 같은 형태의 3-way 오라클(없음/개인/팀+비-owner)이 `transferOwnership` 에도 존재. 1차 방어선(`RolesGuard`)이 정상 동작하면 노출되지 않음 | `codebase/backend/src/modules/workspaces/workspaces.service.ts` `transferOwnership`(게이트 717-751 부근) | 인가 판정을 조회보다 먼저 오도록 재정렬하거나, spec/CHANGELOG 에 `transferOwnership` 을 세 번째 예외로 명시하고 미조치 근거를 남길 것 |
| 4 | Testing | `RolesGuard` 의 다중 `@WorkspaceParam` + `@Roles()` 조합이 전혀 테스트되지 않음 — 각 경로 워크스페이스에 동일한 `requiredRoles` 를 독립적으로 적용하는 현재 구현이 의도한 동작인지 spec/코드 어디에도 단언 없음. 현재 프로덕션 라우트는 전부 단일 파라미터라 미관측 | `codebase/backend/src/common/guards/roles.guard.ts:156-168`, `roles.guard.spec.ts`(`PathTarget.twoPaths`) | `@Roles('admin') twoPathsWithRole(...)` fixture 추가해 "두 워크스페이스 모두 역할 충족 필요" 를 고정, 설계 선택을 docstring 에 기록 |
| 5 | Testing | `addMemberByEmail` 순서 재정렬 근거 주석은 "비관리자가 존재·유형을 구분한다"고 넓게 주장하는데, 새 회귀 테스트는 "비멤버"(role=null) 케이스만 검증함 — 멤버이지만 admin 이 아닌 사용자(editor/viewer)가 personal 워크스페이스를 대상으로 호출하는 경로는 미검증 | `codebase/backend/src/modules/workspaces/workspaces.service.ts:259-262`, `workspaces.service.spec.ts:963-1000` | `memberRepo.findOne`이 `{role:'editor'}`, `workspaceRepo.findOne`이 `type:'personal'` 인 조합 테스트 추가해 `ADMIN_REQUIRED` 단언, 또는 주석 범위를 "비멤버"로 좁히기 |
| 6 | Documentation | frontend `role-gate.tsx` 의 주석이 이번 PR 이 `roles.guard.ts` 에서 **삭제한** `ROLE_HIERARCHY` 를 여전히 SoT 로 지목 — 저장소 전체에서 그 심볼을 참조하는 살아있는 코드는 이 한 줄뿐 | `codebase/frontend/src/components/auth/role-gate.tsx:11` | 주석을 `common/constants/workspace-roles.ts` 의 `WORKSPACE_ROLE_LEVEL` 로 갱신 (이번 PR 의 diff 밖 파일이지만 참조 대상을 없앤 당사자이므로 같은 PR 에서 함께 고치는 것이 자연스러움) |
| 7 | API Contract | 경로 워크스페이스 라우트 전체에서 비멤버 403 응답의 `code` 필드가 `ADMIN_REQUIRED`/`OWNER_REQUIRED`(또는 구 `FORBIDDEN`)에서 `NOT_A_MEMBER` 로 일괄 변경됨 — HTTP 상태·응답 스키마는 불변이나 `code` 로 분기하는 외부 소비자(EIA/웹훅/SDK)에는 wire-contract breaking change. spec Rationale 에서 대안과 함께 명시적으로 채택된 트레이드오프임 | `codebase/backend/src/common/guards/roles.guard.ts` `assertMember`(209-230), `workspaces.service.ts` `assertAdmin`(942-948), `workspace-rbac.e2e-spec.ts:414-425` | 이미 고지된 변경이면 조치 불요 — Swagger `code` enum·별도 changelog 로 외부 소비자에 announce 됐는지 확인 권장 |
| 8 | User Guide Sync | `auth-session-flow-change` 매트릭스 트리거(인증·권한·세션 흐름 변경, `@WorkspaceParam` 도입 + `@Roles()` 전면 부착 + `switchWorkspace` 판정기준 명확화)에 매칭되는데 대응 타겟 중 e2e 는 충족(신규 3건)했지만 `07-workspace-and-team/` 가이드 페이지 동반 갱신이 diff 에 없음. 직접 대조 결과 현재 문서 텍스트가 사실과 어긋나지는 않는 것으로 보임(사후 추론, PR 작성자의 명시적 확인 아님) | `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx`(+`.en.mdx`) | PR 본문에 "가이드 갱신 불요" 근거를 명시하거나, `switchWorkspace` 판정 기준 변경을 반영한 한 줄을 문서에 보강 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 가드 판정(`isUuidShaped`)이 파이프 판정(`ParseUUIDPipe`)의 엄격한 상위집합이라는 관계가 우회 방지의 핵심 불변식인데, 코드 어디에도 그 관계 자체가 명시적으로 진술돼 있지 않음(각자 자기 목적만 설명) — 둘 중 하나가 개별 수정되면 조용히 깨질 수 있음 | `codebase/backend/src/common/utils/uuid.ts:59-64`, `workspace.decorator.ts:114-115` | `WorkspaceParam` 문서에 불변식 문장 추가 + 가능하면 property test(예: fast-check) |
| 2 | Security | 정적 가드 2개(`param-uuid-pipe-guard.ts`, `workspace-param-binding-guard.ts`)가 `decoratorCallName` 텍스트 비교에 의존 — 별칭 import(`import { Param as P }`)시 미탐. 기존에 문서화된 알려진 한계, 저장소 실측 0건 | `param-uuid-pipe-guard.ts:196-201`, `workspace-param-binding-guard.ts:109-110` | 조치 불요, 기록만 |
| 3 | Performance/Database/Architecture | 다중 `@WorkspaceParam` 시 `assertMember` 가 `for...of` + `await` 순차 처리(`Promise.all` 아님) — 현재 실제 15개 라우트 전부 단일 파라미터라 영향 없음 | `roles.guard.ts:156-163` | 다중 파라미터 라우트가 실제 생기면 병렬화 검토 |
| 4 | Architecture | `RolesGuard.canActivate` 의 경로/헤더 두 컨텍스트 분기가 한 메서드에 인라인 — 3번째 컨텍스트 소스가 추가되면 분기·동시소비 조합이 늘어남 | `roles.guard.ts:154-177` | 지금은 리팩터 불필요, 3번째 소스 도입 시 추출자 목록 패턴 고려 |
| 5 | Requirement/API Contract | `workspace-invitations.service.ts` 의 `assertAdmin` 은 `NOT_A_MEMBER`/`ADMIN_REQUIRED` 를 분리하지 않고 소문자 `admin_required` 하나로 던짐 — HTTP 경로로는 도달 불가(가드가 먼저 막음), `error-codes.md §3` 에 이미 반영된 의도된 historical artifact | `workspace-invitations.service.ts:532-549` | 조치 불요, 향후 정리 기회에 통일 고려 |
| 6 | Scope | `RolesGuard` 거부 코드 변경이 새 경로 라우트뿐 아니라 기존 헤더/토큰 컨텍스트 라우트(`@Roles()` 전체)까지 적용됨 — 제목("workspace-path-guard")보다 넓은 API 응답 계약 변경이나 docstring·spec Rationale 로 자기 정당화됨 | `roles.guard.ts` 133-230 | 조치 불요 — FE 외 외부 소비자의 `FORBIDDEN` 문자열 의존 여부 한 번 확인 권장 |
| 7 | Scope | `Roles()` 데코레이터 인자가 `string[]`→`WorkspaceRoleName[]` 로 좁혀져 저장소 전역 `@Roles(...)` 호출부에 영향 — breaking 없음, `@ts-expect-error` 테스트로 타입체크 ratchet 고정 | `roles.guard.ts:38` | 조치 불요 |
| 8 | Side Effect | `ADMIN_ROLES`/`NOT_A_MEMBER`/`ROLE_REQUIRED` 공유 상수가 `Object.freeze()` 없이 3개 모듈에 싱글턴 노출 — 현재 소비 코드는 전부 `.has()`/스프레드만 사용해 뮤테이션 없음 | `common/constants/workspace-roles.ts` | 조치 불요(INFO), 후속으로 freeze 고려 가능 |
| 9 | Maintainability | `handlerConsumesWorkspaceId`/`workspaceParamNamesOf` 의 메타데이터 조회 보일러플레이트 5줄 중복 — 1라운드부터 지적, 코드 형태 변화 없이 유지 | `workspace.decorator.ts:62-82,124-140` | 3번째 컨텍스트 소스 도입 시점에 헬퍼 추출 |
| 10 | Maintainability | `WorkspacesController` 의 `@ApiForbiddenResponse` 설명 문자열이 `workspace-roles.ts` 코드 값을 참조하지 않고 하드코딩 — 코드명이 바뀌어도 컴파일 오류로 안 잡힘 | `workspaces.controller.ts` 상단 `FORBIDDEN_*_ROUTE` 상수 | 우선순위 낮음, 참고만 |
| 11 | Testing | 경로+헤더 병용 핸들러(`@WorkspaceId`+`@WorkspaceParam`)에서 헤더==토큰(재검증 불요, `membershipUnverified=false`) 케이스가 결합 테스트되지 않음 — 각각 단독으로는 커버됨 | `roles.guard.spec.ts`(`adminPathAndHeader`) | `headerWorkspaceId===tokenWorkspaceId` 조합 케이스 추가 |
| 12 | Dependency | 새 외부 의존성 없음(전 28개 파일 `+import` 전수 확인) — devDependency(`typescript`) 를 쓰는 신규 코드도 `tsconfig.build.json` 기존 격리 경계(`__test-utils__/**`, `repo-guards/**`) 안에 머묾 | 전체 diff, `tsconfig.build.json` | 조치 불요 |
| 13 | Dependency | `workspace-roles.spec.ts`(공용 계층)가 `modules/workspaces/dto`(상위 계층)를 import — 레이어 역전이나 테스트 전용 SoT 교차검증 패턴, 기존 관행과 일치 | `workspace-roles.spec.ts:8` | 조치 불요, 컨벤션 문서에 "테스트 파일은 레이어링 예외" 한 줄 명시 고려(선택) |
| 14 | API Contract | `POST /workspaces/:id/transfer-ownership` 의 실제 201 응답과 Swagger 문서 200 불일치 — 이번 PR 이전부터 있던 별도 트래커 항목, 회귀 아님 | `workspace-path-guard.e2e-spec.ts:253-255` | 조치 불요(참고), 별도 트래커에서 추적 |
| 15 | Database | e2e 신규/수정 스펙의 SQL 은 전부 파라미터 바인딩(`$1`), 커넥션도 `beforeAll`/`afterAll` 로 적절히 관리 — 우수 사례로 기록 | `workspace-path-guard.e2e-spec.ts`, `workspace-delete-concurrency.e2e-spec.ts` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 우회 가능성 5가지 각도로 직접 검증 — 성립 안 함. INFO 2건만(불변식 미문서화, alias-import 한계) |
| performance | LOW | 15개 라우트 요청당 멤버십 조회 2배(WARNING), 나머지는 순차 await·미캐싱 reflection 등 INFO |
| architecture | LOW | DTO `WORKSPACE_ROLES` 가 서열 SSOT 에서 미파생(WARNING). 순환의존 없음, 레이어링 양호 |
| requirement | LOW | `transferOwnership` 이 존재·유형 오라클 폐쇄 원칙의 예외로 남음(WARNING). spec-코드 나머지는 line-level 일치 |
| scope | LOW | 28개 파일 전부 단일 plan/spec 수렴, drive-by 변경 없음. blast radius 확장 2건은 문서화됨(INFO) |
| side_effect | LOW | 1~3라운드 처분(전역 거부코드·이중조회) 재확인, 새 결함 없음. 공유상수 미-freeze 만 INFO |
| maintainability | LOW | 1~3라운드 INFO 4건이 코드 형태 변화 없이 재확인됨, 새 이슈 없음 |
| testing | LOW | 다중 `@WorkspaceParam`+`@Roles()` 미검증, `addMemberByEmail` 주석-테스트 범위 불일치(WARNING 2건) |
| documentation | LOW | frontend `role-gate.tsx` 가 삭제된 `ROLE_HIERARCHY` 참조(WARNING 1건). 그 외 문서화 수준 우수 |
| dependency | NONE | 신규 외부 의존성 없음, devDependency 격리 경계 준수 확인 |
| database | LOW | 스키마/마이그레이션 변경 없음. 이중 조회(performance와 동일 현상) INFO로 기록 |
| concurrency | NONE | 발견 없음 — 트랜잭션/락/원자적 DELETE 구조 불변 확인 |
| api_contract | LOW | 403 코드 `NOT_A_MEMBER` 통일이 wire-contract breaking change(WARNING 1건, 의도된 트레이드오프) |
| user_guide_sync | LOW | `07-workspace-and-team` 가이드 동반 갱신 누락(WARNING 1건), e2e 는 충족 |

## 발견 없는 에이전트

- **concurrency** — 28개 파일 전수 확인, 동시성 제어 구조(트랜잭션·락·원자적 DELETE) 불변 확인. 새로 도입된 결함 없음

## 권장 조치사항

1. `transferOwnership` 서비스 메서드의 인가 판정 순서를 조회보다 앞으로 재정렬하거나, spec Rationale·CHANGELOG 의 "두 메서드만" 서술에 `transferOwnership` 을 추가하고 근거를 남긴다 (Requirement WARNING 3).
2. `addMemberByEmail` 재정렬 근거 주석이 주장하는 "비관리자" 범위에 맞춰 editor/viewer + personal 워크스페이스 조합 회귀 테스트를 추가하거나, 주석 범위를 "비멤버"로 좁힌다 (Testing WARNING 5).
3. `RolesGuard` 의 다중 `@WorkspaceParam` + `@Roles()` 조합에 대한 fixture·설계 의도 문서화를 추가한다 (Testing WARNING 4).
4. frontend `role-gate.tsx` 의 stale 주석(`ROLE_HIERARCHY`)을 `WORKSPACE_ROLE_LEVEL` 로 갱신한다 (Documentation WARNING 6).
5. DTO 의 `WORKSPACE_ROLES` 를 `WORKSPACE_ROLE_LEVEL` 에서 타입 파생시켜 SSOT 원칙을 DTO 계층까지 완결한다 (Architecture WARNING 2).
6. 경로 워크스페이스 15개 라우트의 이중 멤버십 조회 비용을 한 번 실측하고 인덱스를 확인해 spec Rationale 에 남긴다 (Performance WARNING 1).
7. `07-workspace-and-team` 가이드 페이지 동반 갱신 여부를 PR 본문에 명시하거나 문서를 한 줄 보강한다 (User Guide Sync WARNING 8).
8. (선택) 403 `code` 필드 변경(`NOT_A_MEMBER` 통일)이 외부 API 소비자(EIA/웹훅/SDK)에게 이미 announce 됐는지 재확인한다 — 이미 3라운드에서 다뤄졌다면 추가 조치 불요 (API Contract WARNING 7).

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용 — 사유: 없음(routing=skipped, 전체 reviewer 강제 실행). 전체 14개 reviewer 실행됨(`security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync`).
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음).
- **제외**: 없음(0명).
