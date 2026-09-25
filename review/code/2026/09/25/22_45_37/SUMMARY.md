# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 14개 reviewer 전원(forced 7명 포함) 결과 확보됨, 누락 없음. 개별 reviewer 판정은 대부분 LOW/NONE이나, `concurrency` reviewer 가 지적한 lost-update(TOCTOU) 문제가 이 PR이 강제하려는 "Organization 통합 변경은 Admin 이상" 불변식을 레이스 상황에서 무력화할 수 있어 통합 위험도를 MEDIUM으로 올린다. Critical 발견은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성 | `update()`/`updateScope()`/`reauthorize()`(비-OAuth 리셋 분기)가 인가 판정 후 엔티티 전체를 `save()`해 lost-update를 일으킨다 — 판정과 커밋 사이에 다른 요청이 `scope`를 바꾸면 그 값이 조용히 되돌아가, PR이 강제하려는 "Organization 변경은 Admin만" 불변식이 레이스 상황에서 무너진다 | `codebase/backend/src/modules/integrations/integrations.service.ts` — `update()`(810-823), `updateScope()`(1407-1408), `reauthorize()`(1447) | 같은 파일 `rotate()`(1215-1311)가 이미 쓰는 트랜잭션+`pessimistic_write` 재조회+인가 재판정+부분 `update()` 패턴을 동일 적용 |
| 2 | 동시성 | `remove()` — 신규 `requireModifiable` 판정 이후 재확인 없이 `DELETE` 커밋. 판정과 삭제 사이에 다른 요청이 `scope`를 organization으로 승격시켜도 Editor의 삭제가 그대로 성공한다 | `integrations.service.ts` — `requireModifiable`(848-854) ~ `delete()`(884-887) | `DELETE` 조건에 판정 시점 `scope`/버전을 포함하거나 `rotate()`처럼 트랜잭션 재조회로 통일 |
| 3 | 보안 | OAuth `reauthorize`/`request_scopes` 콜백(`handleCallback`)이 실제로 자격증명을 갈아끼우는 커밋 시점에 인가를 재검증하지 않는다(TOCTOU). `begin()`~콜백 사이 role 강등이 개입하면 이 PR이 막으려던 시나리오가 좁은 창으로 재현됨 | `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — `handleCallback`(590-785, 특히 764-785) | `rotate()`의 락-안 재검사 패턴(가시성/인가 재판정)을 `handleCallback` 커밋 직전에도 적용 |
| 4 | 아키텍처 / 유지보수성 | `resolveRole()` 호출 + 위임 3줄 블록이 컨트롤러 8곳(oauthBegin/create/update/rotate/reauthorize/requestScopes/updateScope/remove)에 반복되고, 동일 개념이 서비스마다 `userId`/`viewerId`로 다르게 명명되어 있다 | `integrations.controller.ts` 전역, `integration-visibility.ts`, `integration-oauth.service.ts` | `@CurrentRole()` 파라미터 데코레이터 또는 서비스 내부 조회로 통합; 명명은 하나로 통일 |
| 5 | 아키텍처 | `oauth/begin`의 `mode` 분기 인가체크가 이 PR이 도입한 `:id` 라우트 리플렉션 완결성 캐너리의 보호망 밖에 있어, 향후 새 `mode`가 `integrationId`를 소비하게 돼도 가드 누락이 구조적으로 잡히지 않는다 | `integrations.controller.ts:226` | `OAuthBeginDto.mode` 유니언을 소진하는 `switch`(default에서 `never` 체크)로 전환 |
| 6 | 성능 / 데이터베이스 | role 조회 DB 왕복이 `RolesGuard`(가드)와 핸들러의 `resolveRole()` 양쪽에서 요청당 2회 발생. 이번 PR이 이 기존 패턴(`create`에만 있던)을 `update`/`rotate`/`remove` 3곳에 추가로 복제해 확산시켰다 | `integrations.controller.ts:462,520,650` → `integrations.service.ts:1833`(`resolveRole`) | `RolesGuard`가 조회한 role을 `request`에 실어 핸들러가 재사용하도록 리팩터 |
| 7 | 요구사항 | 신규 사용자 문서(mdx, en/ko)가 Viewer의 실제 권한을 실제보다 좁게 서술 — "재인증/자격증명 교체는 할 수 없다"고 적었지만 실제로는 Viewer도 **본인** Personal 통합의 reauthorize/request-scopes는 가능(라우트에 `@Roles('editor')` 없음, spec §8/§3.2와 일치하는 의도된 동작) | `integration-management.mdx:38`, `.en.mdx:27` | Viewer 행을 "본인 Personal은 재인증·scope 요청 가능(생성/편집/삭제/자격증명 교체는 불가)"로 정정 |
| 8 | 요구사항 | "Danger zone" 행이 Personal 통합 삭제 요건을 "creator면 충분"으로 과장 — 실제로는 `DELETE`가 `@Roles('editor')`로 게이트돼 있어 Viewer는 본인이 만든 것도 삭제 불가(같은 PR의 followup plan이 이 격차를 명시) | `integration-management.mdx:69`, `.en.mdx:58` | "Editor 이상 + 본인 것"으로 정정, Viewer 예외 명시 |
| 9 | 테스팅 | makeshop precheck 테스트 매트릭스가 cafe24(3케이스+fallback) 대비 "남의 personal" 1건뿐 — 회귀 방어망이 비대칭적으로 얇음 | `integration-oauth.service.makeshop.spec.ts` (613 부근) | cafe24의 `it.each` 매트릭스(남의personal/본인personal/organization/fallback)를 동일 이식 |
| 10 | 문서화 | `assertCanRotate` 삭제 후 그 JSDoc(락전/락안 이중검사·drift 방지 근거)이 고아로 남아 무관한 `mergeAndValidateCredentials` 앞에 붙었고, 새 `assertCanModify`에는 이 근거가 옮겨지지 않음 | `integrations.service.ts:1185-1189` | 고아 블록 삭제 후 내용을 `assertCanModify` JSDoc에 통합 |
| 11 | API 계약 | `Cafe24PrecheckResultDto`의 `existingIntegrationId`/`existingName` Swagger property 설명이 새 마스킹 규칙("남의 personal이면 conflict=true여도 생략")을 반영하지 못해 실제 응답 스키마 문서가 컨트롤러 설명·spec과 어긋남 | `dto/responses/integration-response.dto.ts:361-370` | description에 마스킹 조건 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 / 아키텍처 / 부작용 | `getForExecution`(워크플로 실행 엔진 경로)은 이번 §8 가시성 판정을 적용받지 않음 — followup plan에 이미 추적된 의도된 잔여 갭, 새 결함 아님 | `integrations.service.ts:1543` | 조치 불요(추적됨) |
| 2 | 보안 | precheck(cafe24/makeshop)·unique 제약 409는 남의 personal 통합의 "존재"를 계속 드러냄 — spec Rationale이 수용한 잔여 리스크 | `integration-oauth.service.ts:346-360` | 조치 불요 |
| 3 | 성능 / 데이터베이스 | personal 가시성 SQL 필터(`scope<>'personal' OR created_by=:id`)에 전용 인덱스 없음 — 현재 규모(workspace당 통합 소수)에서는 무시 가능 | `integration-visibility.ts:25`, `findAll`/`listIntegrations` | 워크스페이스당 통합 수 급증 시 `(workspace_id, scope, created_by)` 복합/부분 인덱스 고려 |
| 4 | 아키텍처 | `IntegrationsService` mutation 메서드 위치 인자가 계속 늘어남(`userRole` 추가로 5-인자) — Actor 값 객체 부재 | `integrations.service.ts` (update/remove/rotate/reauthorize) | `{userId, role}` 값 객체로 묶어 시그니처 성장 흡수 |
| 5 | 아키텍처 / 스코프 | 통합 목록 조회 쿼리 구성이 `integrations.service`/`explore-tools.service` 두 곳에 독립 존재, 공유는 가시성 절뿐 | `integrations.service.ts:513`, `explore-tools.service.ts:169` | 향후 규칙 추가 시 양쪽 동반 갱신 필요함을 인지 |
| 6 | 유지보수성 | `Integration.scope`가 여전히 `string`이라 신규 리터럴 비교(`'personal'`/`'organization'`)에 컴파일타임 오타 보호 없음(기존 상태, 이 PR이 비교 지점만 늘림) | `integration-visibility.ts:16`, `integrations.service.ts:653` | 후속으로 `type IntegrationScope` 유니언 도입 고려 |
| 7 | 유지보수성 | `create()`의 조직 스코프 거부 메시지가 `assertCanModify` 템플릿과 같은 문구를 별도 리터럴로 반복 | `integrations.service.ts:707-711` | `IntegrationModifyAction`에 `'create'` 추가해 메시지 생성 통합 |
| 8 | 테스팅 | `integrations.controller.owner.spec.ts`가 usageLog/node 두 리포지토리에 동일 mock을 재사용해 구분력이 없음(리포지토리 오혼용 회귀를 못 잡음) | `integrations.controller.owner.spec.ts:106-117` | 필요시 분리 또는 의도 주석 추가 |
| 9 | 테스팅 | `assertCanModify`의 액션별 메시지 문구를 검증하는 테스트 없음(코드만 고정, message는 미검증) | `integrations.service.spec.ts` (`orgMutations`) | 필요시 substring 단언 추가 |
| 10 | 테스팅 | e2e가 `beforeAll`로 상태를 공유하고 마지막 테스트가 `personalId`를 삭제 — 파일 내 선언 순서에 암묵 의존 | `test/integration-personal-owner.e2e-spec.ts` | "반드시 마지막" 주석 추가 |
| 11 | 문서화 | `CandidateLookupService` 클래스 상단 docstring이 신규 §8 가시성 필터(요청자에게 보이는 것만)를 언급하지 않음 | `candidate-lookup.service.ts` | 클래스 docstring에 한 문장 보강 |
| 12 | 문서화 | cafe24/makeshop precheck spec의 fake-integration 빌더 두 개가 `scope`/`createdBy` 기본값 처리 방식이 반대인데 그 차이를 설명하는 주석이 cafe24 쪽에만 있음 | `integration-oauth.service.cafe24.spec.ts` vs `.makeshop.spec.ts` | makeshop 쪽에도 근거 주석 추가 또는 스타일 통일 |
| 13 | API 계약 / 부작용 | `FORBIDDEN`→`ADMIN_REQUIRED` 코드값 승격(4곳)은 breaking change이나 CHANGELOG에 영향범위와 함께 문서화되어 절차는 준수됨 | `integrations.service.ts`(assertCanModify 등), `CHANGELOG.md:39-41` | 조치 불요(이미 문서화) |
| 14 | API 계약 | e2e의 "남의 personal→404" 표가 `rotate`/`request-scopes`를 제외 — unit/controller 레벨(리플렉션 전수 테이블)에서는 이미 커버됨 | `test/integration-personal-owner.e2e-spec.ts:155-198` | 선택적 보강 |
| 15 | 요구사항 | Viewer가 본인 Personal을 reauthorize/request-scopes 하는 "성공" 경로가 실제 HTTP 가드 체인을 통과하는 e2e로는 검증되지 않음(서비스 유닛 테스트만 커버) | `integration-personal-owner.e2e-spec.ts`, `integrations.controller.owner.spec.ts:257-303` | e2e에 Viewer 본인 성공 케이스 1개 추가 권고 |
| 16 | 유저가이드 동기화 | `auth-session-flow-change` 트리거가 glob(`modules/auth/**`)과 문자 그대로 불일치하지만, 실질적으로는 `integration-management.mdx`(en/ko)+CHANGELOG로 대체 갱신됨 — 리소스-스코프 인가를 이 트리거로 볼지 정책 명확화 권고 | doc-sync-matrix.json | project-planner 후속 검토 권고 |
| 17 | 유저가이드 동기화 | cafe24/makeshop precheck의 "남의 personal 충돌 시 식별자 마스킹" 규칙이 provider별 문서(`cafe24.mdx`/`makeshop.mdx`)에는 없음(일반 통합관리 문서에는 가시성 규칙이 포괄적으로 서술됨) | `content/docs/06-integrations-and-config/{cafe24,makeshop}.mdx` | 낮은 우선순위, 필요시 한 줄 추가 |
| 18 | 의존성 | 신규 외부 패키지 없음(`package.json`/lockfile 변경 없음). 신규 내부 모듈 `integration-visibility.ts`는 type-only import만 사용해 순환 의존 없음(확인 완료) | 전체 diff | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | OAuth `handleCallback` 커밋 시점 인가 재검증 누락(TOCTOU) |
| performance | LOW | role 조회 DB 왕복 중복이 update/rotate/remove로 확산 |
| architecture | LOW | `resolveRole` 보일러플레이트 8곳, `oauth/begin` mode 분기가 완결성 캐너리 밖 |
| requirement | LOW | 신규 사용자 문서 2건이 Viewer 권한을 과소/과장 서술(코드는 spec과 정확히 일치) |
| scope | NONE | 스코프 이탈 없음 — 2차 표면(workflow-assistant) 확산은 spec이 요구하는 의도된 범위 |
| side_effect | LOW | 광범위한 시그니처 변경을 저장소 전체 grep으로 전수 확인, 알려진 잔여 갭만 존재 |
| maintainability | LOW | `resolveRole` 반복, `userId`/`viewerId` 명명 불일치 |
| testing | LOW | makeshop precheck 테스트 매트릭스가 cafe24 대비 얇음 |
| documentation | LOW | `assertCanRotate` 삭제 후 JSDoc이 고아로 남음 |
| dependency | NONE | 신규 외부 의존성 없음, 신규 내부 모듈도 순환 의존 없음 |
| database | LOW | role 조회 중복, 가시성 필터가 커버 인덱스 밖 컬럼 사용(규모상 무시 가능) |
| concurrency | **MEDIUM** | `update`/`updateScope`/`reauthorize`/`remove`의 lost-update(TOCTOU)가 Admin 강제 불변식을 레이스로 무력화 가능 |
| api_contract | LOW | `Cafe24PrecheckResultDto` Swagger 설명이 마스킹 규칙 미반영 |
| user_guide_sync | LOW | `auth-session-flow-change` 트리거 그레이존, provider 문서에 마스킹 규칙 누락 |

## 발견 없는 에이전트

없음 — 14개 에이전트 전원이 최소 1건 이상의 발견사항(WARNING 또는 INFO)을 보고했다.

## 권장 조치사항

1. **(최우선, concurrency MEDIUM)** `update()`/`updateScope()`/`reauthorize()`(비-OAuth 분기)/`remove()`에 `rotate()`와 동일한 트랜잭션 + `pessimistic_write` 재조회 + 인가 재판정 + 부분 `update()` 패턴을 적용해 lost-update/TOCTOU를 닫는다.
2. `integration-oauth.service.ts`의 `handleCallback`이 자격증명을 커밋하기 직전에 현재 role로 가시성/인가를 재검증하도록 한다(`rotate()` 락-안 재검사 패턴 재사용).
3. `integration-management.mdx`/`.en.mdx`의 Viewer 권한 서술 2곳(재인증/scope요청 가능, 삭제는 Editor+ 필요)을 실제 구현과 일치하도록 정정한다.
4. `integration-oauth.service.makeshop.spec.ts`의 precheck 테스트 매트릭스를 cafe24 수준(본인personal/organization/fallback 케이스 포함)으로 보강한다.
5. `integrations.service.ts`의 고아 JSDoc(`assertCanRotate` 잔재)을 정리하고 그 근거를 `assertCanModify`로 이전한다.
6. `Cafe24PrecheckResultDto`의 Swagger property 설명에 신규 마스킹 규칙을 반영한다.
7. 컨트롤러의 `resolveRole()` 중복 DB 조회(가드 대비)를 제거하고, 8곳에 반복된 보일러플레이트를 데코레이터/헬퍼로 통합하며 `userId`/`viewerId` 명명을 통일한다.
8. `oauth/begin`의 `mode` 분기를 타입-소진 `switch`로 전환해 라우트 완결성 캐너리의 사각지대를 없앤다.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용. 모든 14개 reviewer(security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync)가 실행되었다.
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음).
- **제외**: 없음(전 reviewer 실행).
