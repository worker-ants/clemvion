# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — CRITICAL 은 없다. `api_contract`·`user_guide_sync` 두 에이전트가 각각 MEDIUM 을 보고했고, 핵심은 (1) 약 87개 라우트의 403 응답 코드가 일괄 변경되는 넓은 계약 변경(의도된 것이나 announce 필요), (2) `07-workspace-and-team/` 유저 가이드 동반 검토 누락(트리거 매칭됨), (3) 이 changeset 자신이 만든 `removeMember` stale 주석이다. 보안(security) 관점에서는 새 취약점이 없고 오히려 기존 CRITICAL 급 인가 결함(경로 워크스페이스를 가드가 못 보던 문제, `transferOwnership` 이 헤더/토큰 워크스페이스로 오판정하던 문제)을 구조적으로 닫는 강화 PR 이다.

**forced(router_safety) 전원 결과 확보됨** — `documentation, maintainability, requirement, scope, security, side_effect, testing` 7개 전부 인라인 전문이 존재해 강제 화이트리스트 미이행은 없다. 놓친 CRITICAL 을 못 보고 낮은 위험도를 매기는 거짓 음성 우려는 해당 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API계약 | `@Roles()` 가 붙은 전 라우트(≈87곳: editor 66·admin 9·owner 7·viewer 5)의 403 응답 `error.code` 가 기본값 `FORBIDDEN` 에서 `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 로 일괄 변경됨. spec Rationale·CHANGELOG·e2e 로 뒷받침된 의도된 변경이나, 이 저장소에 API 버전 관리 체계가 없어 한 배포로 전역 적용됨 | `codebase/backend/src/common/guards/roles.guard.ts` `assertMember`(약 227~244행) | 문서화 수준은 이미 적절. 외부(서드파티) API 소비자가 있다면 배포 노트에 `error.code` 변경을 명시적으로 announce |
| 2 | 성능 / 부작용 | 경로 워크스페이스로 전환된 15개 라우트에서 `RolesGuard` 가 멤버십을 무조건 조회하는데, 서비스 계층의 기존 동일 조회(`assertAdmin`/`assertMembership`/`getMemberRole`)가 제거되지 않아 요청당 DB 왕복이 2배(삭제 경로는 3배)로 늘었다. 같은 서비스 파일이 다른 자리(`removeMember`)에서는 명시적으로 피해온 중복 패턴을 가드-서비스 경계에서 재도입 | `roles.guard.ts:174-181,227-244` + `workspaces.service.ts`(`listMembers:218`, `addMemberByEmail:258`, `updateMemberRole:308`, `renameWorkspace:370`, `updateWorkspaceSettings:404`, `deleteWorkspace:531,563`, `leaveWorkspace:652`) | 가드가 조회한 role 을 request-scoped 값으로 전달해 서비스 재조회를 없애거나, 최소한 "의도된 defense-in-depth" 임을 각 서비스 메서드 docstring 에 명시 |
| 3 | 요구사항 / 부작용 | `removeMember` 상단 주석("가드 층은 이 라우트를 막지 못한다 — `@Param('id')` 라 `RolesGuard` 가 단축 통과시킨다")이 **같은 PR 자신의 변경**(`@Param`→`@WorkspaceParam` 전환)으로 이미 사실과 다르게 됨. 같은 논리를 다루는 세 번째 위치(`workspace-rbac.e2e-spec.ts`)는 취소선으로 정확히 정정해 두었는데 나머지 두 곳만 누락 | `codebase/backend/src/modules/workspaces/workspaces.service.ts:824-828`, `workspaces.service.spec.ts:1745-1748` | `workspace-rbac.e2e-spec.ts:665-673` 와 같은 방식(취소선 + 정정 문단)으로 두 곳 갱신. 기능 결함 아님, 순수 서술 정합성 |
| 4 | 아키텍처 | 역할 계층 판정이 가드(`ROLE_HIERARCHY` 숫자 서열)와 서비스(`ADMIN_ROLES` 평면 집합)에 독립된 두 표현으로 이중 유지되며, 이번 PR 로 `@Roles()` 부착 라우트가 8곳 이상 늘어 중복 적용 표면이 크게 넓어짐 | `roles.guard.ts:31-58` vs `workspaces.service.ts:24,941-947` | 공유 상수 모듈(예: `common/constants/workspace-roles.ts`)로 통합해 두 표현을 파생시키는 후속 정리 검토 |
| 5 | 유지보수성 | `@ApiForbiddenResponse` 설명 문자열이 `workspaces.controller.ts` 8개 핸들러에 완전히 동일하게 하드코딩됨 — 가드 메시지가 다시 바뀌면 8곳을 손으로 동기화해야 하고 누락 시 Swagger 문서와 실제 응답이 갈림 | `workspaces.controller.ts:130,161,331,362,417,457,506,551` | 모듈 상수 또는 공용 swagger 헬퍼로 추출해 단일 참조로 통일 |
| 6 | API계약 | `workspace-invitations.service.ts::assertAdmin()` 이 던지는 소문자 `admin_required` 예외가, 컨트롤러에 새로 붙은 `@Roles('admin')` 으로 `RolesGuard` 가 먼저 `ADMIN_REQUIRED`(대문자) 로 막아 **HTTP 경로에서 도달 불가능한 죽은 코드**가 됨 | `workspace-invitations.service.ts:541`(정의), 호출부 `83,242,395,408` / 컨트롤러 `@Roles('admin')` 신규: `workspaces.controller.ts:317,350,441,486,536` | `assertAdmin`/`admin_required` 예외를 제거하거나, "가드가 이미 선점해 이 분기는 HTTP 로 도달하지 않는다" 주석 추가 |
| 7 | API계약 / 문서화 | 이번 diff 의 Swagger(`@ApiForbiddenResponse`) 갱신이 부분적 — 같은 파일 안에서도 라우트마다 신규 코드(`NOT_A_MEMBER`/`EDITOR_REQUIRED`) 명시 여부가 들쭉날쭉하고, diff 범위 밖 다른 컨트롤러(`workflows.controller.ts` 등)의 설명도 실제 코드를 반영 못함. 단, `executions.controller.ts` 관련 갭 자체는 plan/후속 트래커(`spec-draft-nullable-notation-followups.md:4985-4992`)에 이미 실측치와 함께 등재된 의도된 범위 축소로 확인됨 | `executions.controller.ts:74,106,137,160`(미갱신) vs `279,309`(갱신) | 코드 표기 스타일을 전 라우트 일관되게 통일하되, 부담되면 기존 후속 트래커 항목에 이번 신규 갭(#6 dead code 포함)도 함께 명시해 추적 |
| 8 | 유저가이드동반갱신 | `auth-session-flow-change` 트리거(경로 워크스페이스 가드 도입 + 거부 코드 전면 표준화, `modules/auth/**` 매칭)에 대해 `07-workspace-and-team/` 유저 가이드 검토가 plan·리뷰 산출물 어디에도 기록되지 않음 — PROJECT.md 가 "자주 누락되는 항목" 1순위로 명시한 "흐름 변경 + 가이드 갱신 + e2e" 묶음 중 e2e 만 이행되고 가이드 검토는 누락 | `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx`(+`.en.mdx`) 미포함 | (a) 이양·떠나기 절에 "URL 의 워크스페이스 기준으로 판정" 등 실제 체감 변화를 보강하거나, (b) `ERROR_KO` 결정과 동일한 형식으로 plan 에 "검토함 — 사용자 가시 권한 경계 불변이라 갱신 불필요" 근거를 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `workspace-param-binding` 정적 가드는 이름 휴리스틱(`workspaceId` 류)만 사용 — `@Param('id') id: string` 처럼 규칙 밖 이름은 놓칠 수 있음(문서화된 한계, 런타임 가드가 실질 방어선) | `repo-guards/__tests__/workspace-param-binding-guard.ts`(`isWorkspaceIdName`) | 조치 불요. 필요 시 lint 규칙이나 경로-패턴 기반 보강을 후속 고려 |
| 2 | 성능 / 아키텍처 | `RolesGuard` 의 경로 파라미터 루프가 순차 `await` — 현재 핸들러당 `@WorkspaceParam` 최대 1개라 무해하나, 향후 2개 이상이면 직렬 지연 | `roles.guard.ts:175-181` | 다중 파라미터 라우트가 실제로 생기면 `Promise.all` 병렬화 검토 |
| 3 | 성능 | `Reflect.getMetadata(ROUTE_ARGS_METADATA,...)` 조회가 요청당 1회→2회로 증가(마이크로초 단위로 무해) | `workspace.decorator.ts:62-81,124-140`, 호출부 `roles.guard.ts:167-173` | 필요 시 한 번만 읽어 두 팩토리를 함께 비교하는 단일 함수로 통합 |
| 4 | 아키텍처 | `RolesGuard.canActivate` 가 경로/헤더 두 인가 소스를 한 클래스에서 처리해 책임이 누적(private 메서드 추출로 완화됨, 광범위한 테스트가 회귀 위험 상쇄) | `roles.guard.ts:151-244` | 세 번째 워크스페이스 소스가 추가되면 `resolveAuthorizationTargets()` 순수 함수로 분리 검토 |
| 5 | 요구사항 | `@WorkspaceParam('')` 빈 문자열 호출 시 형식 검증이 스킵되나 뒤따르는 `ParseUUIDPipe` 가 400 으로 방어(현재 프로덕션 호출 0건, 컴파일 타임 방지는 안 됨) | `workspace.decorator.ts`(`workspaceParamNamesOf`) | 조치 불요. 원하면 `WorkspaceParam` 에 `if (!name) throw` 개발타임 방어 추가 |
| 6 | 테스트 | 경로+헤더 동시 소비 핸들러(`adminPathAndHeader`)에서 경로 값이 형식 불량/부재일 때 `@Roles()` 요구가 스킵되고 헤더 멤버십만 검사되는 상호작용이 유닛 테스트로 직접 고정되지 않음(현재는 내장 `ParseUUIDPipe` 가 400 으로 안전) | `roles.guard.ts:173-186` | `roles.guard.spec.ts` 에 `adminPathAndHeader` + 형식 불량 경로값 케이스 추가 |
| 7 | 테스트 | `workspaceParamNamesOf` 다중 파라미터 순서 검증이 `.sort()` 로 가려져, 가드가 실질적으로 의존하는 "선언 순서" 보존이 암묵적 의존으로 남음 | `workspace.decorator.spec.ts`(`twoParams` 케이스) | `.sort()` 없는 순서 보존 단언을 별도로 한 줄 추가 |
| 8 | 유지보수성 | `handlerConsumesWorkspaceId`/`workspaceParamNamesOf` 의 메타데이터 조회 보일러플레이트, `decoratorCallName` 헬퍼가 자매 가드 파일에 그대로 재복제(저장소의 의도적 미러링 관례상 낮은 우선순위) | `workspace.decorator.ts:62-81,124-140`; `workspace-param-binding-guard.ts:48-54` | 세 번째 사용처가 생기면 공용 헬퍼(`source-scan.ts` 등)로 추출 검토 |
| 9 | 유지보수성 / 문서화 | `roles.guard.ts:126` JSDoc 한 줄이 같은 블록의 다른 줄(71~110자) 대비 167자로 유난히 길어 줄바꿈 불일치(순수 스타일, `@WorkspaceParam()` 추가 시 재줄바꿈 누락으로 추정) | `roles.guard.ts:126` | 다음 편집 시 재줄바꿈 |
| 10 | 유지보수성 | `@ApiForbiddenResponse` 설명 한 줄에 가드/서비스 두 계층의 에러코드를 `·`·`—`·`/` 임의 구두점으로 나열해 Swagger UI 가독성 저하 | `executions.controller.ts:277-280(reRun), 307-310(getChain)` | 계층별 줄바꿈 또는 배열/템플릿 조립 검토 |
| 11 | 범위 | 가드 거부 코드 전역 부여, 신규 정적 가드(`workspace-param-binding`) 추가, `workspaces.controller.ts` 다수 엔드포인트의 신규 `@Roles()` 부착 모두 표면적으로는 넓어 보이나 `plan/in-progress/workspace-path-guard-impl.md` "구현 요구 1~8"·뮤턴트 표(M1~M17)에 사전 명시된 계획된 결합으로 확인됨. 스코프 이탈 아님 | `plan/in-progress/workspace-path-guard-impl.md` | 조치 불요(리뷰 기록용) |
| 12 | 요구사항 / 보안 | spec(`spec/data-flow/12-workspace.md` §Rationale)·CHANGELOG·plan·코드가 15곳 목록·역할 분배·오류 코드 표·`isUuidShaped`/`ParseUUIDPipe` 규칙까지 line-level 로 일치, CRITICAL 급 spec-code 불일치 없음 | `spec/data-flow/12-workspace.md` | 해당 없음(문제 없음으로 확인) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 새 취약점 없음. `isUuidShaped`/`ParseUUIDPipe` 형식 일치, 균일한 403, `transferOwnership` 오판정 결함을 구조적으로 닫음. INFO 2건(정적 가드 이름 휴리스틱 한계, stale 주석) |
| performance | LOW | 가드-서비스 멤버십 쿼리 중복(WARNING), 순차 await·reflection 중복 조회(INFO, 무해) |
| architecture | LOW | 역할 계층 이중 표현 확대(WARNING), 그 외 동형 확장·이중 방어선·정적 가드화는 양호한 패턴(INFO) |
| requirement | LOW | `removeMember` stale 주석(WARNING), spec fidelity 완전 일치 확인(INFO) |
| scope | NONE | 요청 범위 이탈 없음. 넓어 보이는 3가지 변경 모두 plan 에 사전 명시된 계획된 결합(INFO) |
| side_effect | LOW | 가드-서비스 중복 조회(WARNING, performance 와 동일 이슈), `removeMember` stale 주석(WARNING, requirement 와 동일), 403 바디 전역 변경 인지(INFO) |
| maintainability | LOW | `@ApiForbiddenResponse` 8곳 중복(WARNING), 그 외 보일러플레이트 중복·스타일 이슈(INFO) |
| testing | LOW | 실제 jest 실행으로 231+54 테스트 GREEN 확인. 파이프-우회 상호작용 미고정, 순서 검증이 `.sort()` 로 가려짐(INFO 2건) |
| documentation | NONE | 문서화 수준 높음. JSDoc 줄바꿈 불일치·이미 트래커 등재된 부분 갱신(INFO 2건) |
| api_contract | MEDIUM | 87개 라우트 403 코드 일괄 변경(WARNING), 도달불가 dead code `admin_required`(WARNING), Swagger 부분 갱신 비일관(WARNING) |
| user_guide_sync | MEDIUM | `auth-session-flow-change` 트리거의 `07-workspace-and-team/` 가이드 검토 누락(WARNING), `backend-api-change` 는 충실히 이행(INFO) |

## 발견 없는 에이전트

문자 그대로 "발견 없음"인 에이전트는 없음(전 에이전트가 최소 INFO 이상 보고). 다만 위험도 **NONE** 으로 판정된 에이전트는 `security`, `scope`, `documentation` 세 곳이며, 이들의 발견사항은 모두 INFO 수준(문서 정합성·정적 가드의 알려진 한계·계획된 스코프 확인)이다.

## 권장 조치사항

1. **`removeMember` stale 주석 2곳 정정** (`workspaces.service.ts:824-828`, `workspaces.service.spec.ts:1745-1748`) — 같은 PR 이 이미 다른 위치(`workspace-rbac.e2e-spec.ts`)에서 취소선으로 정정한 것과 동일하게. 기능 결함 아니므로 가장 가볍고 빠르게 처리 가능.
2. **`workspace-invitations.service.ts` 의 도달 불가능한 `admin_required` dead code 정리** — 제거하거나 "가드 선점" 주석 추가.
3. **`07-workspace-and-team/` 유저 가이드 검토 여부를 명시적으로 결정하고 기록** — PROJECT.md 가 1순위로 명시한 누락 패턴이므로, 실제 갱신하거나 "갱신 불요" 근거를 plan 에 남길 것.
4. **가드-서비스 중복 멤버십 쿼리 최적화 또는 의도 명시** — request-scoped 캐싱 또는 각 서비스 메서드 docstring 에 defense-in-depth 명시.
5. **`@ApiForbiddenResponse` 문자열 8곳 상수화 + Swagger 부분 갱신 파일 일관성 정리(dead code #2 와 연계 추적)**.
6. (후속, 낮은 우선순위) `ROLE_HIERARCHY`/`ADMIN_ROLES` 공유 모듈 통합, 외부 API 소비자 존재 시 403 코드 변경 배포 공지.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (11명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)
  - **제외**: 아래 표 (3명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단상 이번 changeset 과 관련성 낮음(신규/변경 의존성 없음) |
  | database | router 판단상 이번 changeset 과 관련성 낮음(스키마·마이그레이션 변경 없음) |
  | concurrency | router 판단상 이번 changeset 과 관련성 낮음(단, `workspace-delete-concurrency.e2e-spec.ts` 갱신은 testing/security 에이전트가 교차 확인함) |

(참고: 위 SUMMARY.md 는 `SUMMARY.md` basename 하네스 차단으로 디스크에 직접 Write 하지 못했다 — `STATUS=write_blocked`. 호출자가 이 전문을 `/Volumes/project/private/clemvion/.claude/worktrees/workspace-path-guard/review/code/2026/09/25/16_03_32/SUMMARY.md` 에 멱등 기록해야 한다. 11개 reviewer 산출 파일(`security.md` 등)은 모두 이미 디스크에 존재함을 확인했다.)
