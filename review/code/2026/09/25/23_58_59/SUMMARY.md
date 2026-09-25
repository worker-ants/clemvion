# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — `rotate()`의 락-내부 재판정이 통합 행(scope)은 다시 읽지만 요청자 role은 요청 시작 시점 스냅샷을 그대로 쓴다(concurrency, CRITICAL) — 외부 연결 테스트(수 초) 도중 요청자가 강등돼도 통과해 조직 통합 자격 증명을 교체할 수 있는 인가 우회 경쟁 조건. forced whitelist(documentation·maintainability·requirement·scope·security·side_effect·testing) 7명 전원 결과 확보됨 — 강제 리뷰어 미이행으로 인한 은폐 위험은 없음. 이 Critical을 제외하면 나머지는 WARNING/INFO 수준으로, 인가 로직 자체(가시성 판정 단일화·404 존재은닉·SQL 파라미터 바인딩)는 전반적으로 견고하다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/인가 | `rotate()`의 트랜잭션 내(`pessimistic_write`) 재판정이 통합 행(scope)은 fresh 재조회하지만 요청자 `userRole`은 요청 시작 시점 값을 그대로 재사용. `dispatchTest`(실제 외부 접속, 수 초 소요) 도중 요청자가 member에서 강등돼도 `assertCanModify(fresh, staleRole, 'rotate')`가 통과해, 이미 권한을 잃은 사용자가 조직 통합의 credential rotate를 커밋할 수 있다. 자매 경로인 OAuth 콜백의 `assertRequesterStillAllowed`는 role도 fresh 재조회해 이미 이 문제를 막고 있어 `rotate()`만 비대칭. | `codebase/backend/src/modules/integrations/integrations.service.ts` — `rotate()` (userRole 선언 1231행, `dispatchTest` 호출 1246행, 락 내 재조회 1274행, 재판정 1283행) | `rotate()`의 트랜잭션 내부 재판정 직전에 `workspacesService.getMemberRole(workspaceId, userId)`로 role을 다시 조회해 `assertCanModify(fresh, freshRole, 'rotate')`에 전달. `integration-oauth.service.ts`의 `assertRequesterStillAllowed` 패턴을 공유 헬퍼로 추출해 재사용 권장. role 강등 시나리오(scope 불변, role만 변경)를 검증하는 단위 테스트 추가. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 (BOLA) | 노드 실행 엔진의 유일한 자격 증명 조회 경로 `getForExecution(id, workspaceId)`가 `workspaceId` 범위만 확인하고 personal 통합의 `createdBy` 가시성은 검증하지 않는다. 워크플로 `config.integrationId`가 저장 시점에 가시성 검증을 받지 않는 것으로 보여, 다른 멤버의 personal 통합 UUID를 아는 Editor/Viewer가 자신이 편집 가능한 노드에 그 UUID를 넣어 워크플로를 실행시키면 API 상 "안 보이는" 통합의 자격 증명으로 실제 외부 호출이 가능하다. 코드 주석이 "후속 plan"으로 명시한 의도적 스코프 제외이나, 이번 PR의 핵심 불변식(§8)이 실행 표면에서는 아직 성립하지 않는다. | `codebase/backend/src/modules/integrations/integrations.service.ts` — `requireVisible()` 주석(약 622행), `getForExecution()` 정의(약 1562행) | 워크플로 노드 config 저장 시 `integrationId` 가시성 검증을 추가하거나, `getForExecution`도 워크플로 소유자/실행 주체 기준 `isIntegrationVisibleTo`를 적용. 최소한 `plan/`에 후속 추적 항목으로 등록 확인. |
| 2 | DB/동시성 (performance·side_effect·database 3개 reviewer 공통 지적) | OAuth 콜백 커밋 트랜잭션이 `pessimistic_write` 행 락을 잡은 채, 신규 추가된 `assertRequesterStillAllowed`가 트랜잭션 `manager`가 아닌 별도 리포지토리(`WorkspacesService.getMemberRole`)로 **커넥션 풀에서 두 번째 커넥션**을 획득해 조회한다. 락 보유 시간이 원격 조회 왕복만큼 늘어나고, organization-scope 재인증/scope-추가 콜백이 동시에 몰리면 풀 고갈(pool starvation)·타임아웃 위험이 이론상 존재한다. | `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — `assertRequesterStillAllowed`(405-425행, `getMemberRole` 호출 414-419행), 호출부 `handleCallback` 트랜잭션 내(807행 락 획득, 816행 호출) | 멤버십 조회를 트랜잭션의 `manager`로 수행하도록 변경(`manager.getRepository(WorkspaceMember)` 직접 사용 또는 `WorkspacesService`에 manager/queryRunner 파라미터 오버로드 추가)해 같은 커넥션 안에서 해결. TOCTOU 방지 의도(락 시점 값 재판정) 자체는 유지하되 커넥션만 통합. |
| 3 | 성능 | `update`·`remove` 컨트롤러 핸들러가 `RolesGuard.assertMember`가 이미 조회한 워크스페이스 role을 재사용하지 않고 `roleOf()`로 동일 `(workspaceId, userId)`를 다시 조회 — 요청당 DB 왕복이 불필요하게 2배. `create`/`rotate`는 기존 설계(리팩터만 됨)이나 `update`/`remove`는 이번 PR에서 신규로 늘어난 중복. | `codebase/backend/src/modules/integrations/integrations.controller.ts:489`(`update()`), `:662`(`remove()`); `roleOf` 정의 135-140행 | `RolesGuard`가 판정한 role을 `request` 객체에 실어 컨트롤러가 데코레이터로 재사용하도록 배선하거나, 최소 두 경로만이라도 중복 쿼리 제거. |
| 4 | 유지보수성 | `updateScope`가 다른 5개 변경 동작(create/update/remove/rotate/request-scopes)과 달리 공유 판정 헬퍼(`assertCanModify`→`assertOrgScopeModifiable`)를 우회하고 `isAdmin(userRole)` 직접 체크를 쓴다. `assertOrgScopeModifiable`은 `scope !== 'organization'`이면 무조건 통과시키므로, 다음 유지보수자가 "일관성"을 이유로 `updateScope`를 `assertCanModify`로 되돌리면 personal 통합 생성자가 Admin 없이 자기 personal을 organization으로 승격시킬 수 있는 권한 상승 결함이 재도입된다. 이 우회의 "왜"가 호출부에 주석으로 남아 있지 않다. | `codebase/backend/src/modules/integrations/integrations.service.ts` — `updateScope`(1410행), 근거는 `integration-visibility.ts` JSDoc(56행)에만 존재 | `updateScope` 호출부에 우회 이유를 1줄 주석으로 명시하거나, `assertOrgScopeModifiable`이 `action === 'change-scope'`일 때 scope 조건을 건너뛰도록 통합해 `updateScope`도 같은 헬퍼를 쓰게 만들어 트랩 자체를 제거. |
| 5 | 유지보수성 | 이미 ~310줄인 `handleCallback`(provider 검증·state 소비·에러 분기·토큰 교환·provider별 자격증명 조립·install_token 백필까지 처리)에 이번 diff가 트랜잭션 임계구역 안 인가 재판정 책임을 한 겹 더 얹었다. 보안 판정처럼 독립 검증돼야 할 로직이 거대 함수 내부로 더 파고들며, 신규 테스트도 `handleCallback` 전체를 인스턴스화해야 그 판정을 검증할 수 있는 구조가 굳어진다. | `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — `handleCallback`(631-941행), 신규 호출 816행 | 최소한 "요청자 재판정 이후" credentials 교체 분기를 별도 private 메서드로 추출해 트랜잭션 콜백 본문을 짧게 유지. |
| 6 | 문서화 | 신규 e2e 스펙 파일 헤더 JSDoc의 "보호 대상 invariants" 목록 첫 항목 문장이 "Owner 에게도"에서 끝나며 서술어가 없는 미완성 문장. 테스트 자체 동작에는 영향 없으나 이 파일이 spec §8·Rationale을 인용하는 SoT 요약 역할을 해 오독 위험이 있다. | `codebase/backend/test/integration-personal-owner.e2e-spec.ts:20` | "...Owner 에게도 예외가 아니다" 등으로 문장 완결. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | 가시성 판정이 in-memory 함수(`isIntegrationVisibleTo`)와 SQL 문자열(`integrationVisibilityClause`)로 이중 표현되며, 둘의 동치를 강제하는 장치는 단위 테스트뿐 — 향후 규칙 변경 시 한쪽만 고치면 목록과 단건 조회 가시성이 갈라질 수 있음 | `integration-visibility.ts:24-39` | 두 표현이 같은 판정을 내리는지 확인하는 property-style 테스트 추가 고려 |
| 2 | 아키텍처 | `IntegrationOAuthService`/`IntegrationsService`가 서로 주입 못 해 "판정 오케스트레이션 시퀀스"(보이는가→organization이면 role조회→assert) 자체가 두 서비스에 손으로 중복 작성됨 | `integration-oauth.service.ts:405-425` vs `integrations.service.ts:687-697` | 세 번째 유사 호출부 생기면 role resolver를 인자로 받는 고차 함수로 통합 고려 |
| 3 | 아키텍처 | `workflow-assistant`의 `explore-tools.service.ts`가 `integrations` 모듈 내부 파일을 상대경로로 직접 import(공개 서비스 경유 아님) — 기존 관례와 일관되나 파일 이동 시 모듈 밖 소비자도 함께 깨짐 | `explore-tools.service.ts:8-11` | 공유 정책 함수가 늘어나면 `common/`·`@shared`로 승격 고려 |
| 4 | 아키텍처 | 컨트롤러(`oauthBegin`)가 두 서비스 간 인가 판정 오케스트레이션을 직접 수행(파사드 역할 겸함) — `never` exhaustiveness 체크로 우회 위험은 컴파일 타임에 봉쇄됨 | `integrations.controller.ts:258-268` | 동일 조합 로직이 두 번째 호출부에 필요해지면 별도 파사드로 추출 고려 |
| 5 | 유지보수성 | `assertCanModify`가 `assertOrgScopeModifiable`을 그대로 위임만 하는 빈 래퍼 | `integrations.service.ts:645-651` | JSDoc에 존재 이유 명시 또는 제거 |
| 6 | 유지보수성 | `judgedRow` 이름이 호출부만 보면 "무엇을 판정했는지" 즉시 드러나지 않음 | `integrations.service.ts:663-669` 및 호출부(835,902,1417행) | `compareAndSetKeyOf` 등 의도를 드러내는 이름으로 변경 고려 |
| 7 | 유지보수성 | `oauthBegin`이 `requireModifiable`의 반환 엔티티를 버림 — 다른 호출부는 모두 반환값을 이어 쓰는데 컨트롤러만 예외 | `integrations.controller.ts:259-268` | 판정만 필요함을 밝히는 주석 또는 `void` 명시 |
| 8 | 테스트 | `findAll`의 `scope=personal` 명시 필터와 신설 가시성 절 동시 적용 조합을 검증하는 케이스 없음 | `integrations.service.spec.ts:2386` 부근 | 필터+가시성 절 동시 적용 케이스 1건 추가 |
| 9 | 테스트 | e2e `beforeAll`의 admin 승격 조회 결과에 대한 방어적 단언(`toHaveLength(1)`) 없음 — 실패 시 원인 특정이 어려움 | `test/integration-personal-owner.e2e-spec.ts:120-128` | 방어적 단언 1줄 추가 |
| 10 | 테스트 | e2e 마지막 테스트가 `beforeAll`이 만든 `personalId`를 삭제 — 현재 순차 실행이라 안전하지만 `--randomize`/`concurrent` 도입 시 조용히 깨질 구조 | `test/integration-personal-owner.e2e-spec.ts:248-258` | 우선순위 낮음, 다른 e2e 관례처럼 자기완결적 fixture로 전환 고려 |
| 11 | 테스트 | `getForExecution`(§보안 WARNING 1과 동일 지점)이 가시성 판정을 우회하는 유일한 경로로 문서화돼 있으나, "이 하나뿐"임을 보장하는 회귀 캐너리가 없음 | `integrations.service.ts:622,1562` | 후속 plan 착수 시 리플렉션 기반 경계 캐너리 추가 권고 |
| 12 | 데이터베이스 | `update`/`updateScope`/`reauthorize`의 compare-and-set(`update`+`judgedRow`) 이후 응답용 재조회(`reloadOrNotFound`)가 별도 트랜잭션이라, UPDATE 성공 직후 동시 삭제가 끼면 클라이언트는 404를 받고 감사 로그도 남지 않는 좁은 창이 존재 | `integrations.service.ts` `update()`(834-852행), `updateScope()`(1416-1430행) | 급하지 않음 — 여유 있으면 `RETURNING *`으로 왕복 제거 또는 UPDATE+감사로그를 한 트랜잭션으로 통합 |
| 13 | 데이터베이스 | 신설 가시성 필터(`created_by`/`scope`)에 전용 인덱스 없음(`idx_integration_workspace_status`만 존재) — 현재 규모에서는 문제 없음 | `integration-visibility.ts:37-39`, `findAll` | 워크스페이스당 통합 수가 커지면 `(workspace_id, created_by)` 복합 인덱스 검토 |
| 14 | API 계약 | 목록/상세 등에서 남의 personal 통합이 사라지는 것은 의도된 breaking behavior change — 문서·테스트로 충분히 뒷받침됨 | `integrations.controller.ts`, `integrations.service.ts` | 외부 연동 존재 시 changelog 고지(이미 CHANGELOG 반영됨) 외 조치 불요 |
| 15 | API 계약 | Admin 부족 403의 `code`가 `FORBIDDEN`→`ADMIN_REQUIRED`로 통일되며 값이 바뀜(의도된 이전 라운드 결정) | `integration-visibility.ts` `adminRequiredError`, `workspace-roles.ts` | 외부 소비자 있으면 릴리스 노트 명시, 없으면 조치 불요 |
| 16 | API 계약 | Cafe24/MakeShop precheck의 `existingIntegrationId`/`existingName`이 남의 personal과 충돌 시 조건부 생략 — 스키마는 optional이라 하위호환이나 의미는 변경 | `integration-response.dto.ts`(`Cafe24PrecheckResultDto`), `pickPrecheckConflict` | 프런트 precheck 배너가 필드 부재 케이스를 다루는지 확인(범위 밖 참고) |
| 17 | 의존성 | 신규 외부 패키지 없음 — `integration-visibility.ts` 신규 공유 모듈이 2개 모듈·4개 소비자에 결합(내부 결합도 증가, DI 순환 없음) | 전체 diff, `integration-visibility.ts` | 조치 불요, 파일이 더 커지면 모듈 공개 API로 승격 고려 |
| 18 | 유저 가이드 동반 갱신 | `auth-session-flow-change`·`integration-provider-change` 두 semantic trigger의 target(07-workspace-and-team·06-integrations-and-config ko/en·e2e·CHANGELOG)이 모두 같은 changeset에서 이미 갱신돼 누락 없음 | doc-sync-matrix 21행 대조 | 조치 불요 |
| 19 | 유저 가이드 동반 갱신(참고) | `integrationNotFoundError()`가 기존 전역 관례대로 영문 message("Integration not found")를 던지며, 이번 PR이 이 404 발생 빈도(동료 personal URL 직접 접근)를 늘림 — 매트릭스 어떤 target도 이를 가리키지 않아 판정 대상 밖 | `integration-visibility.ts` | 조치 불요(참고 기록) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| concurrency | CRITICAL | `rotate()` 락-내부 재판정의 role staleness (TOCTOU 인가 우회) |
| security | MEDIUM | `getForExecution` 실행 경로 personal 가시성 미검증(BOLA 잔여 갭) |
| side_effect | MEDIUM | OAuth 콜백 트랜잭션 내 커넥션 이중 점유 |
| database | MEDIUM | 동일 이슈(락 보유 중 별도 커넥션) + CAS 이후 재조회 트랜잭션 미분리 |
| performance | LOW | update/remove role 중복 조회, OAuth 콜백 락 구간 연장 |
| maintainability | LOW | `updateScope` 판정 우회, `handleCallback` 비대화 |
| documentation | LOW | e2e 헤더 문장 미완성 |
| architecture | LOW | 판정 이중표현·모듈 경계 등 INFO 4건, 구조적 결함 없음 |
| requirement | LOW | spec §8 전 표면 line-level 일치 확인, INFO 2건만 |
| testing | LOW | 커버리지 갭 4건(INFO), 회귀 방지 설계는 견고 |
| api_contract | LOW | 의도된 breaking behavior change 3건, 문서·테스트로 충분히 뒷받침 |
| scope | NONE | 26개 파일 전부 단일 의도에 직결, 범위 이탈 없음 |
| dependency | NONE | 신규 외부 패키지 없음 |
| user_guide_sync | NONE | 매트릭스 매칭 trigger 전부 동반 갱신 확인 |

## 발견 없는 에이전트

- **scope** — 범위 이탈(무관한 리팩터링·설정 변경·포맷팅 혼입 등) 없음
- **dependency** — 신규 외부 패키지·버전 변경 없음
- **user_guide_sync** — 매칭된 모든 trigger의 동반 갱신 대상이 이미 같은 changeset에 존재, 누락 없음

## 권장 조치사항

1. **(최우선, Critical)** `rotate()`의 트랜잭션 내 재판정에서 요청자 role을 fresh 재조회하도록 수정 — `assertRequesterStillAllowed`(OAuth 콜백)와 동일 패턴을 공유 헬퍼로 추출해 두 경로가 같은 처방을 쓰게 하고, 강등 시나리오(scope 불변·role만 변경) 회귀 테스트 추가.
2. `getForExecution` 실행 경로의 personal 가시성 미검증(WARNING 1)에 대해, 후속 plan이 실제로 등록·추적되고 있는지 확인하거나 이번 PR 범위에서 최소 워크플로 config 저장 시점 가시성 검증을 추가.
3. OAuth 콜백 `handleCallback`의 `assertRequesterStillAllowed`가 `pessimistic_write` 락을 쥔 채 별도 커넥션으로 `getMemberRole`을 조회하는 패턴을 트랜잭션 `manager` 기반 조회로 통합해 락 보유시간·커넥션 이중점유 해소(performance/side_effect/database 3개 reviewer 공통 지적).
4. `update`/`remove` 컨트롤러의 `RolesGuard` 결과 중복 조회 제거.
5. `updateScope`가 공유 판정 헬퍼를 우회하는 이유를 코드 주석으로 명시하거나 `assertOrgScopeModifiable`에 통합해 향후 권한 상승 회귀 재도입 경로를 차단.
6. e2e 스펙 헤더의 미완성 문장 완결(documentation WARNING).
7. (낮은 우선순위) `handleCallback` 책임 분리, `judgedRow` 명명 개선, `assertCanModify` 빈 래퍼 정리, `findAll` 필터×가시성 조합 테스트·e2e 방어적 단언 보강.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용(이번 workflow 호출에 skip 사유가 별도로 전달되지 않음) — 전체 14개 reviewer 실행.
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원 success)
- **제외**: 없음
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **전원 결과 확보됨**, 강제 화이트리스트 미이행 없음

| 제외된 reviewer | 이유 |
|------------------|------|
| (해당 없음) | — |
