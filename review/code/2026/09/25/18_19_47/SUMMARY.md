# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0, Warning 3(전부 유지보수성/문서 정합성 — 보안·기능 결함 아님). 강제(router_safety) 지정 7개 reviewer(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성(중복) | `handlerConsumesWorkspaceId`(기존)와 `workspaceParamNamesOf`(신규)가 "메서드명 가드 → `ROUTE_ARGS_METADATA` 조회 → factory identity 필터"라는 동일 골격을 그대로 복제했다. 이 PR 이 같은 클래스의 중복(`decoratorCallName`)을 `source-scan.ts` 공용화로 이미 한 번 해소한 전례가 있어 비대칭이 두드러진다. 두 구현이 갈라지면 `RolesGuard` 의 fail-open/fail-closed 경계가 비대칭으로 깨질 수 있고, 현재는 `workspace-reflection-canary.spec.ts` 의 카운트 관측에만 의존한다. | `codebase/backend/src/common/decorators/workspace.decorator.ts:62`(`handlerConsumesWorkspaceId`), `:124`(`workspaceParamNamesOf`) | `factoryEntries(controllerClass, handler, factory)` 같은 제네릭 헬퍼로 "메서드명 가드 + metadata 조회 + factory 필터" 부분을 통합하고, 두 함수는 그 위에서 `some`/`map` 만 다르게 얹는 형태로 좁힐 것 |
| 2 | 문서화(SoT 드리프트) | Swagger 403 설명 상수(`FORBIDDEN_MEMBER_ROUTE`/`FORBIDDEN_ADMIN_ROUTE`/`FORBIDDEN_OWNER_ROUTE`)가 이 PR 이 만든 단일 진실 테이블(`workspace-roles.ts` 의 `NOT_A_MEMBER.code`/`ROLE_REQUIRED.*.code`)을 참조하지 않고 `'NOT_A_MEMBER'`/`'ADMIN_REQUIRED'`/`'OWNER_REQUIRED'` 를 문자열 리터럴로 재선언했다. 런타임 코드 축은 단일 진실을 달성했지만 API 문서 축은 여전히 수작업 동기화라, 코드명이 바뀌어도 컴파일·테스트 실패 없이 조용히 낡는다. | `codebase/backend/src/modules/workspaces/workspaces.controller.ts:66-68` | 세 상수를 `` `워크스페이스 멤버가 아님(${NOT_A_MEMBER.code})` `` 형태로 실제 상수의 `.code` 를 보간해 선언하거나, 최소한 설명 문자열과 실제 코드 일치 여부를 대조하는 테스트 한 줄 추가 |
| 3 | 문서화(수치 오차) | `CHANGELOG.md` 의 "실측" 라우트 개수(`editor 66 · admin 9 · owner 7 · viewer 5`)가 이 PR 자신이 방금 추가한 `@Roles('admin')` 8곳을 반영하지 못해 실측(2026-09-25 병합 시점: `editor 63 · admin 17 · owner 4 · viewer 4`, 합계 88)과 크게 어긋난다. 특히 admin 은 실제의 약 47%만 반영돼, "이 변경이 미치는 라우트 범위"를 알린다는 문장의 목적 자체가 훼손된다. CHANGELOG 상단이 스스로 못박은 "main 대비·머지 시점" 규칙과도 불일치. | `CHANGELOG.md:31` | `editor 63 · admin 17 · owner 4 · viewer 4`(총 88건)로 정정. 향후 이런 수치는 "PR 이 스스로 추가한 항목까지 포함해 최종 상태를 다시 센다"를 체크리스트로 둘 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능/DB | `RolesGuard` 경로 파라미터 루프가 `assertMember` DB 조회를 순차 `await` — 현재 모든 핸들러가 `@WorkspaceParam` 을 1개만 쓰므로 실질 N+1 없음. 향후 핸들러당 2개 이상 쓰이면 순차 왕복이 늘어남 | `codebase/backend/src/common/guards/roles.guard.ts:156-163` | 현재 조치 불요. 다중 파라미터가 실제 필요해지면 `Promise.all` 병렬화 또는 "핸들러당 최대 1개" 불변식을 저장소 가드로 명시 |
| 2 | 성능/부작용/DB/동시성 | 가드+서비스(+`transferOwnership`/`leaveWorkspace` 는 트랜잭션 락까지) 의 의도된 멤버십 이중~삼중 재조회. `transferOwnership`/`leaveWorkspace` 는 요청당 동일 PK 조회가 3회(가드 1 + 서비스 무락 1 + 트랜잭션 락 1)로 늘었다. `(workspaceId, userId)` 유니크 인덱스 위 조회라 성능 영향은 미미하며, spec Rationale 이 "가드→서비스 값 전달은 독립성을 잃는다"는 근거로 명시적으로 채택한 트레이드오프다 | `codebase/backend/src/common/guards/roles.guard.ts`(`assertMember`), `codebase/backend/src/modules/workspaces/workspaces.service.ts`(`transferOwnership` 725-756행, `leaveWorkspace` 650행 부근) | 조치 불요(설계 의도). 트래픽 증가 시 request-scoped 공유(`AsyncLocalStorage`) 검토는 별도 트래킹 |
| 3 | 유지보수성 | `RolesGuard.canActivate` 가 미인증 단축·경로 파라미터 인가·헤더/토큰 컨텍스트 인가 세 관심사를 한 메서드에서 처리해 분기가 조밀함 | `codebase/backend/src/common/guards/roles.guard.ts:133`(`canActivate`) | 경로 파라미터 처리 블록(147-168행)을 `checkRequestContext`/`assertMember` 와 같은 층위의 private 메서드로 분리(동작 변경 없는 가독성 개선) |
| 4 | 유지보수성 | `throwOwnerTransferRequired` 가 이웃 헬퍼(`throwNotAMember`/`throwAdminRequired`)와 달리 공유 상수를 스프레드하지 않고 필드를 직접 재조립 | `codebase/backend/src/modules/workspaces/workspaces.service.ts:933-938` | `{ ...ROLE_REQUIRED.owner, message: '...' }` 형태로 통일 |
| 5 | 테스트 | `RolesGuard` 다중 경로 파라미터에서 "서로 다른 사유(비멤버 vs 역할미달)"가 자리마다 섞이는 조합이 테스트되지 않음 — 실제 라우트는 전부 파라미터 1개라 현재 위험은 낮음 | `codebase/backend/src/common/guards/roles.guard.ts:156-163`, `roles.guard.spec.ts` `twoPathsAdmin`/`twoPaths` 블록 | `it.each` 로 "a=비멤버, b=역할미달" / "a=역할미달, b=비멤버" 케이스를 추가해 우선순위 정책을 명시적으로 고정 |
| 6 | 테스트 | `transferOwnership` 의 서비스 고유 거부 문구(`'owner 이양은 현재 owner 만 수행할 수 있습니다.'`)가 unit 레벨에서 회귀 보호되지 않음(코드만 단언, 문구는 e2e 의 가드 메시지만 확인) | `codebase/backend/src/modules/workspaces/workspaces.service.ts`(`throwOwnerTransferRequired`), `workspaces.service.spec.ts` | 기존 테스트에 `response: { message: '...' }` 한 줄 추가 |
| 7 | 아키텍처 | 경로-스코프 인가 스캐폴딩(`@WorkspaceParam`/reflection/가드/정적 저장소 가드) 전체가 "워크스페이스" 개념에 하드코딩됨 — 현재는 경로-스코프 리소스가 워크스페이스 하나뿐이라 YAGNI 상 정당 | `codebase/backend/src/common/decorators/workspace.decorator.ts:114`, `roles.guard.ts:154-168` | 조치 불요. 두 번째 경로-스코프 리소스가 생기면 공통 추상화 재판단 |
| 8 | DB/동시성 | `transferOwnership` 상단 docstring이 "두 멤버를 단일 IN 쿼리로 동시 락"이라 서술하지만 실제 구현은 순차 2회 개별 락 — 워크스페이스 행 락이 임계구역을 직렬화해 기능적 데드락 위험은 없음. 이 PR 이전(2026-05-04)부터 있던 기존 부채, 이번 diff 범위 밖 | `codebase/backend/src/modules/workspaces/workspaces.service.ts:711-715`(docstring) vs `750-769`(구현) | 이번 PR 범위 아님. 후속 정리 커밋에서 주석을 "workspace 행 락이 직렬화하므로 멤버 락 순서는 무관" 으로 정정 권장 |
| 9 | 의존성 | 프런트엔드 `role-gate.tsx` 의 `ROLE_LEVEL` 이 여전히 백엔드 `WORKSPACE_ROLE_LEVEL` 을 손으로 복제 — 이 PR 이전부터의 기존 부채, 이번에 새로 만든 결함 아님(주석만 갱신) | `codebase/frontend/src/components/auth/role-gate.tsx:10-18` vs `codebase/backend/src/common/constants/workspace-roles.ts:9-14` | 별도 작업으로 공유 패키지 이전 또는 두 파일 리터럴 대조 테스트 추가 검토 |
| 10 | 보안 | 정적 저장소 가드(`workspace-param-binding-guard.ts`)는 이름 휴리스틱(`workspaceId`/`*WorkspaceId`) 기반이라 별칭 import 나 규칙 밖 이름은 놓칠 수 있음 — docstring에 이미 문서화된 한계이며 1차 방어선은 런타임 `RolesGuard` reflection | `codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts` | 조치 불요. 새 코드가 규칙 밖 이름으로 워크스페이스 ID 를 바인딩하는 경우에만 해당하는 종전 클래스의 한계 |
| 11 | API 계약 | 비멤버 응답 코드가 요구 역할과 무관하게 `NOT_A_MEMBER` 로 통일되는 것은 wire-contract breaking change — 1~4라운드에 걸쳐 이미 검토·수용, `spec/data-flow/12-workspace.md` §Rationale·`CHANGELOG.md` 에 명시적으로 announce 됨(다만 CHANGELOG 수치 자체는 WARNING #3 참고) | `codebase/backend/src/common/guards/roles.guard.ts`(`assertMember`), `workspace-rbac.e2e-spec.ts` | 조치 불요. 기존 announce·e2e 로 충분 |
| 12 | API 계약 | `POST /api/workspaces/:id/transfer-ownership` 실제 상태(201)와 Swagger 문서(200) 불일치 — 이 PR 이전부터의 기존 문제로 별도 트래커 등재됨, 회귀 아님 | `codebase/backend/test/workspace-path-guard.e2e-spec.ts:261-263` | 조치 불요(별도 트래커) |
| 13 | 유저 가이드 동반 갱신 | `07-workspace-and-team/*.mdx` 가 이번 changeset 에도 미갱신이지만, 3라운드 연속(3·4·5) 독립 검증 결과 사용자 가시 권한·흐름에 실질 변경이 없어 stale 아님 — plan 에 "검토함, 갱신 불필요" 로 명문화, RESOLUTION 종결 완료 | `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx` | 조치 불요. 향후 라운드가 재조사 반복하지 않도록 결론만 재기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 Critical/Warning 없음. `@WorkspaceParam`+`RolesGuard` 확장이 cross-tenant 인가 우회·존재/유형 오라클을 구조적으로 닫음 |
| performance | LOW | 전부 INFO — 경로 파라미터 순차 조회, 가드+서비스 의도된 중복 조회, reflection 중복 메타데이터 조회 |
| architecture | LOW | WARNING 2건 — reflection 함수 중복, Swagger 상수 SoT 미파생 |
| requirement | NONE | spec-코드 line-level 일치 재확인, 9개 unit/e2e 스위트 446건 전부 PASS, `nest build` 통과 |
| scope | NONE | 30개 파일 전부 plan 의 8개 구현 요구에 1:1 대응, drive-by 없음 |
| side_effect | LOW | 이전 라운드 처분 재확인 + `transferOwnership`/`leaveWorkspace` 조회 3회 증가를 INFO 로 신규 기록 |
| maintainability | LOW | 전부 INFO — `canActivate` 관심사 분리, 예외 헬퍼 패턴 불일치, 테스트 헬퍼 오버로드형 시그니처 |
| testing | LOW | 전부 INFO — 다중 경로 파라미터 사유 혼합 미검증, `transferOwnership` 문구 unit 미검증 |
| documentation | LOW | WARNING 1건 — CHANGELOG 라우트 개수 실측 오차(admin 47%만 반영) |
| dependency | NONE | 신규 외부 의존성 없음. 내부 의존 구조 개선(역할 서열/거부 상수 단일화) |
| database | LOW | 전부 INFO — 순차 조회, 유니크 인덱스 위 조회라 영향 미미, docstring-구현 불일치(범위 밖) |
| concurrency | NONE | 신규 동시성 결함 없음. TOCTOU 창 없음, 락 순서 일관 유지 |
| api_contract | LOW | 전부 INFO — 이전 라운드 검토·수용된 breaking change 재확인, 신규 결함 없음 |
| user_guide_sync | NONE | CRITICAL 0·WARNING 0·INFO 1(3라운드 연속 독립 검증으로 stale 아님 재확인) |

## 발견 없는 에이전트

- security, requirement, scope, dependency, concurrency, user_guide_sync — Critical/Warning 없음(NONE)

## 권장 조치사항

1. `CHANGELOG.md:31` 의 라우트 개수를 `editor 63 · admin 17 · owner 4 · viewer 4`(총 88건, 2026-09-25 병합 시점 실측)로 정정한다 — 이 PR 이 스스로 추가한 admin 8곳이 누락된 수치라 외부 소비자에게 변경 범위를 축소해 전달하고 있다.
2. `workspaces.controller.ts:66-68` 의 Swagger `FORBIDDEN_*_ROUTE` 상수를 `workspace-roles.ts` 의 `.code` 값에서 파생시키거나, 최소한 일치 여부를 검증하는 테스트를 추가한다.
3. (선택, 유지보수성) `handlerConsumesWorkspaceId`/`workspaceParamNamesOf` 의 중복 reflection 골격을 공용 헬퍼로 통합 — 이 PR 이 이미 한 번 유사 중복(`decoratorCallName`)을 해소한 전례와의 일관성을 위해.
4. (선택) INFO #5·#6 의 테스트 갭(다중 경로 파라미터 사유 혼합, `transferOwnership` 서비스 고유 문구 unit 회귀 보호)은 저비용이므로 후속 커밋에서 채우는 것을 권장하나 병합을 막을 필요는 없다.

## 라우터 결정

- `routing=skipped` — 라우터 미사용. 전체 14개 reviewer 실행(fallback).
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
- **제외**: 없음(0명)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **전원 결과 확보됨**, forced 화이트리스트 미이행 없음

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |
