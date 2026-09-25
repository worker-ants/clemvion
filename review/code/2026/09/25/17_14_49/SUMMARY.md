# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건. 신규 CRITICAL은 없으나, 이 PR이 스스로 세운 "비멤버는 요구 역할과 무관하게 NOT_A_MEMBER" 불변식을 서비스 계층 `assertAdmin`이 어기고 있고 새 테스트가 그 불일치를 "정답"으로 고정한 점(WARNING), 그리고 경로 인가 우회 방지의 유일한 CI 안전망이 이름 휴리스틱에 의존하는 구조적 갭(WARNING)이 가장 중요하다. forced 화이트리스트(router_safety) 7명 전원 및 나머지 전체 reviewer 14명 결과 모두 확보됨 — 라우팅 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing/security | 서비스 계층 "두 번째 선"(`assertAdmin`)이 비멤버와 역할-부족을 구분하지 못해 `NOT_A_MEMBER` 대신 `ADMIN_REQUIRED`를 던진다 — 같은 파일의 `removeMember`는 올바르게 분리했는데, 이번 PR이 새로 추가한 테스트(`workspaces.service.spec.ts:981-994`)가 이 불일치를 "정답"으로 고정. 평상시엔 `RolesGuard`가 먼저 막아 드러나지 않지만, 이 PR 전체가 대비하려는 실패 모드(가드 reflection 파손) 발생 시 서비스 backstop이 사실과 다른 오류 코드를 낸다 | `codebase/backend/src/modules/workspaces/workspaces.service.ts:945-950`(`assertAdmin`), `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:981-994` | `assertAdmin`도 `assertMembership`처럼 멤버십과 역할을 분리(`if (!role) throwNotAMember(); if (!ADMIN_ROLES.has(role)) throwAdminRequired();`)하거나, 의도된 차이라면 테스트에 근거 주석을 남길 것. `updateMemberRole`·`renameWorkspace`·`updateWorkspaceSettings`도 같은 결함 공유 |
| 2 | security | 경로 워크스페이스 오용 방지의 유일한 CI 안전망(`workspace-param-binding-guard.ts`)이 이름 휴리스틱(`workspaceId` 또는 `*WorkspaceId` 접미)에만 의존한다 — 관례 밖 이름(예: `@Param('resourceId')`)으로 워크스페이스 경로 파라미터를 바인딩하면 CI도 못 잡고 런타임 `RolesGuard`도 "경로 워크스페이스 없음"으로 오판(헤더/토큰 워크스페이스로 오판정하거나 무검증 통과) | `codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts:46` (`isWorkspaceIdName`) | 이름 휴리스틱 대신 fail-closed 허용목록 방식으로 강화하거나, 최소한 `spec/data-flow/12-workspace.md` §Rationale에 "새 워크스페이스 경로 파라미터는 이름 규칙을 따르거나 리뷰에서 수동 확인" 체크리스트 항목 명시 |
| 3 | performance | `@Param` → `@WorkspaceParam` 전환 라우트(15곳)마다 가드+서비스가 동일한 멤버십 조회를 이중으로 수행 — `leaveWorkspace`는 최대 4~5회 순차 DB 왕복까지 쌓인다. 코드 docstring이 명시한 의도된 defense-in-depth 트레이드오프이나 규모(15개 라우트 일괄 적용)는 수치로 기록 필요 | `codebase/backend/src/common/guards/roles.guard.ts:147-167`, `codebase/backend/src/modules/workspaces/workspaces.service.ts:655` | 구조 되돌릴 필요는 없음. 호출 빈도 높은 조회형 라우트부터 가드가 읽은 role을 request 컨텍스트에 실어 서비스가 재확인만 하는 절충안 검토. 최소한 "요청당 DB 왕복 +1~+3" 을 성능 회귀 체크리스트에 기록 |
| 4 | performance | `RolesGuard.canActivate`가 `@Roles()` 라우트에서도 두 reflection 판별(`handlerConsumesWorkspaceId`, `workspaceParamNamesOf`)을 무조건 실행 — 종전엔 단축 평가(`&&`)로 건너뛰던 경로. 가장 흔한 케이스(`@Roles()+@WorkspaceParam`, `@WorkspaceId()` 미사용)에서 `consumesRequestContext` 계산 결과가 분기 결정에 전혀 안 쓰이는 순수 낭비 | `codebase/backend/src/common/guards/roles.guard.ts:147-155` | `consumesRequestContext`를 필요한 분기에서만 지연 계산하도록 되돌릴 것. 비용 자체는 마이크로초 단위라 급하지 않음 |
| 5 | testing | 공유 유틸로 승격된 `decoratorCallName`에 직접 단위 테스트가 없다 — 비-호출 데코레이터(`null` 반환) 분기가 저장소 전체 fixture 어디에도 없어 간접적으로도 실행되지 않는다. 자매 함수들(`stripLiterals`·`enclosingScopeName`)은 "간접 커버리지만이면 비대칭이 재발"이라는 명시적 근거로 직접 테스트를 갖고 있는데 이 함수만 관례에서 빠짐 | `codebase/backend/src/common/__test-utils__/source-scan.ts:140-146`, `source-scan.spec.ts` | `decoratorCallName`을 겨눈 `describe` 블록 추가 — 최소 세 갈래(호출형 `@Foo(...)`→`'Foo'`, 비호출형 `@Foo`→`null`, 다른 이름 `@Bar(...)`→`'Bar'`) |
| 6 | documentation | `param-uuid-pipe-guard.ts`의 `isIdShaped` 측정 주석(2026-09-12, "id-형 136건 · 108:28 분할")이 이 PR의 모집단 분할(`@Param`→`@WorkspaceParam` 15곳 이동)을 반영하지 않은 채 남아 있다 — 같은 파일 몇 줄 아래 이 PR이 새로 추가한 주석은 이 분할을 정확히 인지하고 있어 두 주석의 정밀도가 갈린다 | `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:56`, `:158-159` (대조: `:149`) | 저장소 관례(취소선 + "(2026-09-25 정정)")대로 addendum 추가하거나 "이 수치는 2026-09-12 시점 `@Param`-only population" 스코프 한정 문구 추가. 차단 사유 아님 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | `ADMIN_ROLES`가 `ReadonlySet<string>`으로 선언돼 이번 라운드에 도입한 `WorkspaceRoleName` 타입 좁히기 이득을 못 받음(값 자체는 파생되어 SoT 위반 아님) | `codebase/backend/src/common/constants/workspace-roles.ts` | `ReadonlySet<WorkspaceRoleName>`으로 선언 타입만 좁힐 것. 급하지 않음 |
| 2 | 테스트 | `getWorkspaceSettings`의 인라인 `FORBIDDEN` 코드가 이번 PR의 `NOT_A_MEMBER` 통일 표에서 빠진 채 남고, 기존 회귀 테스트(`:621-627`)가 그 낡은 계약을 고정 | `codebase/backend/src/modules/workspaces/workspaces.service.ts:481-487` | 별도 트래커에 통일 작업 등재 또는 의도 주석 |
| 3 | 테스트/요구사항 | 다중 `@WorkspaceParam` + `@Roles()`(역할 임계값) 조합이 미검증 — 현재 프로덕션 라우트엔 이 조합이 없어 위험 낮음 | `codebase/backend/src/common/guards/roles.guard.spec.ts:125-127, 644-676` | 낮은 우선순위. `twoPaths` fixture에 `@Roles` 변형 추가 고려 |
| 4 | 요구사항 | `workspace-delete-concurrency.e2e-spec.ts`의 신규 docstring 서술("커밋 후 지연 요청은 403")을 직접 검증하는 테스트는 없음(현재 테스트는 `[200,404]`만 단언) | `codebase/backend/test/workspace-delete-concurrency.e2e-spec.ts:24-28` | 선택 사항 — 별도 `it`으로 고정 가능 |
| 5 | 유지보수성 | `RolesGuard.canActivate`의 경로 워크스페이스 분기가 헤더/토큰 분기(`checkRequestContext`로 추출됨)와 달리 인라인으로 남아 비대칭 | `codebase/backend/src/common/guards/roles.guard.ts:154-168` | `checkPathWorkspace`로 동일하게 추출 고려. 지금 당장 필수는 아님 |
| 6 | 유지보수성 | 신규 e2e가 이미 존재하는 공유 fixture 상수(`NIL_WS`)를 동일 이름·값으로 로컬 재선언 | `codebase/backend/test/workspace-path-guard.e2e-spec.ts:34` | `../src/common/__test-utils__/workspace-id-fixtures`에서 import로 교체 |
| 7 | 유지보수성 | admin 픽스처를 editor로 초대 후 PATCH로 승격시키는 2단계 setup의 의도가 주석에 없음 | `codebase/backend/test/workspace-path-guard.e2e-spec.ts:66-82` | 의도 설명 한 줄 주석 추가 |
| 8 | 유지보수성 | `RolesGuard` 클래스 docstring이 78줄로 확장돼 spec `§Rationale`과 내용이 상당 부분 겹침(이 저장소의 기존 스타일이라 WARNING 아님) | `codebase/backend/src/common/guards/roles.guard.ts:48-125` | 다음에 컨텍스트가 늘 때는 상세 서술을 spec에만 두고 코드엔 짧은 포인터만 고려 |
| 9 | 부작용 | `countWorkspaceIdConsumingRoutes` → `countWorkspaceConsumingRoutes` exported 함수의 반환 타입이 `number` → 객체로 변경(하위호환 깨짐) — 호출부 전수 확인 결과 blast radius가 파일 내로 닫혀 있어 실질 위험 없음 | `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:98-124` | 조치 불요, 기록 목적 |
| 10 | 성능/DB/동시성/부작용 (4개 리뷰어 공통) | `RolesGuard`의 경로 파라미터 루프가 이름마다 DB 조회를 순차 `await` — 현재 전 라우트가 파라미터 1개(N=1)라 무해하나, 향후 다중 `@WorkspaceParam` 라우트가 생기면 요청당 지연이 파라미터 수에 비례 | `codebase/backend/src/common/guards/roles.guard.ts:156-163` | 지금은 조치 불요. 다중 파라미터 라우트 추가 시 `Promise.all` 병렬화 검토(fail-fast 순서 보장에 유의) |
| 11 | API 계약 | `@Roles()` 전 라우트의 403 `error.code`가 `FORBIDDEN`에서 4종 구체 코드로 바뀌는 breaking change — CHANGELOG·spec에 이미 disclose, 1st-party frontend 영향 없음 확인됨. 외부/제3자 소비자 영향은 코드 리뷰로 확인 불가 | `codebase/backend/src/common/guards/roles.guard.ts` | 배포 전 제3자 API 소비자 존재 여부만 재확인 |
| 12 | API 계약 | `POST /:id/transfer-ownership`·`POST /:id/leave`의 실제 201 vs OpenAPI 문서 200 불일치 — 이 PR이 만든 문제 아니고 기존 트래커에 등재됨, 신규 e2e가 재관측만 함 | `codebase/backend/src/modules/workspaces/workspaces.controller.ts`, `test/workspace-path-guard.e2e-spec.ts:253` | 이번 PR 범위 밖. 기존 트래커 항목 처리 시 참조 |
| 13 | 유저가이드 동반 갱신 | `auth-session-flow-change` trigger가 매칭됐으나(`auth.controller.ts`/`RolesGuard`/`workspaces` 모듈), 실제 변경은 기존 오라클 2곳 폐쇄 + 이미 부분 소비 중인 코드 계열 확장으로, `07-workspace-and-team/*.mdx` 미갱신은 실제 stale이 아님(직전 라운드와 동일 결론) | `codebase/frontend/src/content/docs/07-workspace-and-team/` (미변경) | 조치 불요 |
| 14 | 보안 | `handlerConsumesWorkspaceId`/`workspaceParamNamesOf`의 부분 파손은 부팅 캐너리(`total===0` 판정)가 못 잡는 기존 한계 — 이번 PR로 이 한계가 적용되는 표면(경로 인가 전체)이 넓어짐. 코드 docstring이 스스로 인정한 트레이드오프 | `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` | 조치 불요(기존 수용된 트레이드오프). 두 카운트 분리 로깅 설계 유지 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | CI 안전망 이름 휴리스틱 갭(WARNING), 나머지는 검증 완료 기록(INFO) |
| performance | MEDIUM | 이중 DB 조회(WARNING), reflection 무조건 실행(WARNING) |
| architecture | LOW | 이전 라운드 WARNING 처분 확인, ADMIN_ROLES 타입 사소한 비대칭(INFO) |
| requirement | NONE | spec-code 정합 확인, 도달 불가 조합 문서화 공백만(INFO) |
| scope | NONE | 27개 파일 전부 plan 요구사항에 매핑, 발견 없음 |
| side_effect | LOW | 순차 조회·exported 시그니처 변경 등 blast radius 닫힌 사항(INFO) |
| maintainability | LOW | 비대칭 추출·fixture 중복·docstring 비대 등 전부 INFO |
| testing | MEDIUM | assertAdmin 불일치를 새 테스트가 고정(WARNING), decoratorCallName 테스트 공백(WARNING) |
| documentation | LOW | 측정 주석 정밀도 격차(WARNING), 나머지는 상위권 문서화 확인 |
| dependency | NONE | 신규 외부 패키지 없음, 내부 의존성 정리 방향 긍정 |
| database | LOW | 멤버십 조회 이중화(트레이드오프, INFO), SQL 인젝션·트랜잭션 문제 없음 |
| concurrency | LOW | 락 없는 선조회 + 락 있는 재검사 계층 분리 확인, 새 경쟁 조건 없음 |
| api_contract | LOW | error.code breaking change(disclose됨), 상태코드/문서 불일치(기존) |
| user_guide_sync | NONE | trigger 매칭 1건, 실제 stale 아님으로 판정(직전 라운드와 동일) |

## 발견 없는 에이전트

- scope (위험도 NONE, 발견사항 "없음" 명시)

## 권장 조치사항

1. `workspaces.service.ts`의 `assertAdmin`을 `assertMembership`처럼 멤버십 검사와 역할 검사로 분리해 `NOT_A_MEMBER`/`ADMIN_REQUIRED`를 정확히 구분하거나, 의도된 차이라면 그 근거를 테스트·코드에 명시(WARNING #1).
2. `workspace-param-binding-guard.ts`의 이름 휴리스틱을 fail-closed 허용목록 방식으로 강화하거나 최소한 spec Rationale에 리뷰 체크리스트 항목으로 명시(WARNING #2).
3. `source-scan.ts`의 `decoratorCallName`에 직접 단위 테스트(호출형/비호출형/다른 이름) 추가(WARNING #5).
4. `RolesGuard.canActivate`의 `consumesRequestContext` 계산을 필요한 분기에서만 지연 실행하도록 되돌려 `@Roles()` 라우트의 불필요한 reflection 호출 제거(WARNING #4).
5. `param-uuid-pipe-guard.ts`의 "136건" 측정 주석에 이번 PR의 population 분할을 반영하는 날짜 붙은 addendum 추가(WARNING #6).
6. 가드+서비스 이중 멤버십 조회 비용(+1~+3 DB 왕복/요청, 15개 라우트)을 성능 회귀 체크리스트에 기록(WARNING #3, 구조 변경 불필요).

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 reviewer 14명 실행.
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨(미이행 없음)
