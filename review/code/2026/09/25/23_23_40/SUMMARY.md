# Code Review 통합 보고서

## 전체 위험도

**CRITICAL** — `user_guide_sync` reviewer 가 신규 "Admin 필요" 거부 메시지 3곳이 영문 하드코딩이며 한국어 UI 매핑이 전무해 프론트 3개 소비처(danger-tab.tsx, page.tsx rotate, OAuth 팝업 핸들러)가 원문을 그대로 사용자에게 노출한다고 보고했다(CRITICAL 1건). 그 외 나머지 13개 reviewer(security/scope/dependency/database/documentation 는 NONE, 나머지는 LOW)는 새로 발견된 심각한 결함이 없다. **forced(router_safety) 화이트리스트 7개(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과가 확보됐고 routing 은 skipped(전체 14개 reviewer 실행)였다 — 라우팅 누락으로 인한 은폐된 위험은 없다.**

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 국제화(i18n)/사용자 노출 | 신규 "Admin 필요" 거부 메시지 3곳(`create/modify/delete/rotate/reauthorize` 동작별 문구, scope 변경 문구, OAuth 콜백 재판정 문구)이 영문 하드코딩이며 `codebase/frontend/src/lib/i18n/backend-labels.ts` 에 `ADMIN_REQUIRED` 매핑이 전무하다. 프론트 3개 소비처(`danger-tab.tsx` scope 변경 `onError`, `page.tsx` rotate `onError`, `use-oauth-popup-return.ts` OAuth 팝업 postMessage 핸들러)가 `e.response?.data?.message` / `event.data.error` 를 그대로 토스트에 노출해, 한국어 제품에서 Admin 이 아닌 사용자가 Organization 통합을 조작하면 영문 문장이 그대로 뜬다. 기존 `ROLE_REQUIRED.admin` 기본 문구는 한국어인데, 이번 PR 의 새 3개 throw 지점만 이를 영문으로 override 한다. | `codebase/backend/src/modules/integrations/integrations.service.ts:657-658, 663-665, 1428-1429`; `codebase/backend/src/modules/integrations/integration-oauth.service.ts:423-429`(`assertRequesterStillAllowed`); 소비처 `codebase/frontend/.../danger-tab.tsx:46-48`, `.../page.tsx:449-452`, `codebase/frontend/src/lib/integrations/use-oauth-popup-return.ts:73-76` | (a) override 문구를 한국어로 즉시 교체(예: "Organization 통합의 {action} 에는 Admin 이상의 권한이 필요합니다."), 또는 (b) `ADMIN_REQUIRED`+동작별 안정 키를 `backend-labels.ts` 매핑에 등록하고 프론트 3곳이 `code`+`action` 조합으로 `t()` 매핑을 쓰도록 동반 수정. 최소 (a) 는 이번 라운드에서 반영 필요 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처/유지보수성 | "Organization 스코프 → Admin 요구" 판정(스코프 체크+역할 체크+throw) 조합 로직과 "없는 통합" 404 판정 리터럴이 `IntegrationOAuthService.assertRequesterStillAllowed` 에 다시 손으로 하드코딩됐다. `IntegrationsService` 는 이미 이전 라운드에서 "파일 전체 7곳 중복"을 `requireVisible`/`assertCanModify`/`throwAdminRequired`/`throwIntegrationNotFound` 로 단일화했는데(그 주석이 과거 maintainability WARNING 을 명시), 이번 PR 이 순환 의존 회피 때문에 같은 판정·리터럴을 두 번째 서비스에 다시 복제해 동일 결함 패턴이 재발했다. `ADMIN_ROLES` 상수 자체는 단일화돼 있어 즉각적 정합성 위험은 낮지만, 두 판정 경로가 향후 다르게 진화(drift)할 수 있다. | `codebase/backend/src/modules/integrations/integration-oauth.service.ts:405-430`(`assertRequesterStillAllowed`) vs `codebase/backend/src/modules/integrations/integrations.service.ts:630-665, 713-725`(`assertCanModify`/`throwIntegrationNotFound`) | 순환 의존 없는 순수 함수(예: `integration-visibility.ts` 에 `assertOrgScopeModifiable()`, `integrationNotFoundError()`)로 판정 로직·404 리터럴을 뽑아 두 서비스가 공유하도록 리팩터링 |
| 2 | 요구사항 정확성 | 커밋 직전 재판정(`assertRequesterStillAllowed`)의 403 메시지가 `record.mode`(`reauthorize`/`request_scopes`)를 받지 않아, 실제 동작이 `request_scopes` 여도 항상 "reauthorize" 문구로 고정 출력된다. 함수 docstring 은 두 동작을 모두 언급하지만 메시지는 하나로 고정. 에러 **코드**(`ADMIN_REQUIRED`)는 두 모드 모두 올바르므로 클라이언트 분기엔 영향 없음. `request_scopes` 모드로 이 403 분기를 검증하는 유닛테스트도 없다. | `codebase/backend/src/modules/integrations/integration-oauth.service.ts:426`(`assertRequesterStillAllowed`) | `record` 에 `mode`/action 을 실어 `assertCanModify` 와 같은 동작별 문구 템플릿을 쓰게 하고, `request_scopes` 모드 403 을 검증하는 유닛테스트 추가(위 #1 리팩터링과 같은 자리에서 함께 처리 가능) |
| 3 | 테스트 커버리지 | `integrations.controller.owner.spec.ts` 의 완결성 캐너리 설계 원칙(라우트 전수·남의 personal→404·**생성자 본인→통과**) 중 세 번째가 `oauth/begin` 의 `integrationId` 재판정 서브블록에는 적용되지 않았다. 남의 personal(404)·Organization(403/200) 은 테스트되지만 "요청자 본인의 personal 통합을 `integrationId` 로 지정해 `oauth/begin` 호출 시 통과"하는 케이스가 없다. | `codebase/backend/src/modules/integrations/integrations.controller.owner.spec.ts` — `describe('oauth/begin — ...')` (게이트 257~309행) | `it('본인 personal integrationId — 통과(oauthBegin 호출)', ...)` 추가 — `integrationRepo.findOne.mockResolvedValue(googlePersonal())`(생성자=CREATOR) 상태에서 `begin(CREATOR, 'reauthorize', 'int-1')` 이 `oauthBegin` 을 호출함을 확인 |
| 4 | API 계약(문서 완결성) | `create()` 핸들러의 `@ApiForbiddenResponse` 설명이 여전히 옛 문구("organization 범위 생성 권한 부족")에 머물러 있다. 같은 파일의 다른 mutating 엔드포인트(`update`/`rotate`/`reauthorize`/`requestScopes`/`updateScope`/`remove`/`oauthBegin`)는 이번 PR 에서 `ROLE_REQUIRED.admin.code`(`ADMIN_REQUIRED`)를 보간해 실제 코드를 노출하도록 갱신됐는데 `create()` 만 누락돼, OpenAPI 스펙 기반 클라이언트/SDK 소비자가 이 엔드포인트의 에러 코드를 문서에서 찾지 못한다. | `codebase/backend/src/modules/integrations/integrations.controller.ts:460`(`async create`) | 다른 mutating 엔드포인트와 동일 패턴으로 `ROLE_REQUIRED.admin.code` 를 보간하도록 `@ApiForbiddenResponse` 설명 갱신 |
| 5 | API 계약(하위 호환성) | Organization 범위 생성·rotate·request-scopes·scope 전환 4개 기존 엔드포인트 + 신규 콜백 재판정 경로의 403 `error.code` 가 `FORBIDDEN` → `ADMIN_REQUIRED` 로 바뀐다. HTTP 상태 코드(403)는 유지되고 `CHANGELOG.md` 최상단에 이미 명시적으로 고지되어 "의도된 breaking change"로 확인되나, CHANGELOG 는 "자사 frontend 는 이 코드로 분기하지 않는다"로만 리스크를 좁혀 서술하고 서드파티 API 소비자 여부는 언급하지 않는다. | `codebase/backend/src/modules/integrations/integrations.service.ts`(`assertCanModify`/`throwAdminRequired`), `integration-oauth.service.ts:405-430` | 이미 CHANGELOG 고지로 충분 — 서드파티 API 소비자가 존재한다면 별도 API 공지 채널로 추가 고지 검토 |
| 6 | 유저 가이드 동반 갱신 | `07-workspace-and-team/workspaces-and-members.{mdx,en.mdx}` 의 RBAC 요약표가 여전히 "Viewer = 모든 리소스 읽기 전용"이라고 절대 서술하는데, 같은 PR 이 갱신한 `06-integrations-and-config/integration-management.mdx` 는 "Viewer 는 자신의 Personal 통합에 한해 재인증·scope 추가 요청 가능"이라는 쓰기 예외를 신설해 두 문서가 상충한다. | `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx:39` / `.en.mdx:39` (누락된 동반 갱신 대상) | Viewer 행에 "단, 자신이 만든 Personal 통합의 재인증·scope 요청은 예외" 각주 추가 또는 리소스별 세부 권한 링크로 절대 표현 완화 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능/동시성(트레이드오프) | `update`/`updateScope` 가 lost-update 방지를 위해 `save()`(왕복 2회) 대신 `judgedRow`+조건부 UPDATE+재조회(왕복 3회) 로 바뀌었고, OAuth 콜백 커밋 트랜잭션은 `pessimistic_write` 행 락을 쥔 채 별도 커넥션으로 `getMemberRole` 을 한 번 더 대여한다. 둘 다 정합성(TOCTOU/lost-update 방지)을 위한 의도된 트레이드오프로 절대 비용은 작다. | `integrations.service.ts`(`update`/`updateScope`/`judgedRow`), `integration-oauth.service.ts`(`assertRequesterStillAllowed`, `handleCallback`) | 조치 불요. 동시 재인증 트래픽이 실측되면 `getMemberRole` 을 트랜잭션 매니저로 태워 커넥션 1개로 통일 검토 |
| 2 | 성능/부작용 | `update`/`remove`/`reauthorize` 컨트롤러 핸들러가 대상 행의 scope 를 확인하기도 전에 매 요청마다 무조건 `roleOf()`(멤버 role DB 조회)를 먼저 호출한다 — 이 값은 대상이 `organization` 일 때만 쓰인다. `origin/main` 엔 이 세 경로에 role 조회가 없었다. | `codebase/backend/src/modules/integrations/integrations.controller.ts`(`update`:489, `reauthorize`:573, `remove`:662) | 절대 비용 작음(단일 인덱스 조회) — 후속 최적화 시 서비스가 행을 먼저 읽고 organization 일 때만 지연 조회하는 안 고려 |
| 3 | 데이터베이스 | 새 가시성 조건 `(scope <> 'personal' OR created_by = :userId)` 에 대한 전용 인덱스가 없다. `workspace_id` 선두 필터로 이미 좁혀진 뒤 적용돼 현재 스케일 영향은 미미. | `integrations.service.ts:517`(`findAll`), `explore-tools.service.ts:173`(`listIntegrations`) | 워크스페이스당 통합 수가 크게 늘면 `(workspace_id, scope, created_by)` 복합 인덱스 검토 |
| 4 | 유지보수성 | `Cafe24PrecheckResultDto` 의 `existingIntegrationId`/`existingName` Swagger 설명 문자열이 같은 문장을 반복 복붙하고, `IntegrationModifyAction` 타입명이 "바꾸는 동작"을 뜻하는데 새 행을 만드는 `'create'` 원소도 포함해 이름과 의미가 약간 어긋난다. | `dto/responses/integration-response.dto.ts:363-364, 369-370`; `integrations.service.ts:390-395` | 공통 문장을 파일 상단 상수로 추출 / 타입명을 넓히거나 주석 보강 |
| 5 | 테스트 커버리지 | `pickPrecheckConflict` 의 priority 선택과 가시성 판정 조합이 다중 행(예: 우선순위 행=남의 personal, 낮은 우선순위 행=본인 소유) 픽스처로 명시 검증되지 않았고(로직상 회귀 위험은 낮음), e2e 스펙의 마지막 `it` 이 `beforeAll` 이 만든 `personalId` 를 rename 후 delete 하는 선언 순서 의존 상태 공유가 있다(주석으로 경고됨). | `integration-oauth.service.cafe24.spec.ts:824-856`, `.makeshop.spec.ts:618-648`; `test/integration-personal-owner.e2e-spec.ts:248` | 다중 행 조합 케이스 1건 추가 권장 / 삭제 검증을 별도 fixture 로 분리하면 더 안전 |
| 6 | 문서화 | `Cafe24PrecheckResultDto` 클래스 레벨 docstring 이 "충돌 대상이 남의 personal 이면 id/name 생략" 조건부 은닉 규칙을 반복하지 않아 필드를 펼쳐보지 않으면 Swagger 요약만으로는 놓칠 수 있다. | `dto/responses/integration-response.dto.ts:344-353` | 클래스 doc 에 한 문장 추가(Blocking 아님) |
| 7 | 동시성(기존 결정, 기록용) | `rotate()` 의 락-재확인은 통합 행의 scope/가시성만 재조회하고 요청자 role 은 요청 시작 시점 값을 재사용한다 — `assertRequesterStillAllowed` 는 반대로 role 도 락 안에서 재조회해 보장 범위가 다르다. `plan/complete/rotate-lost-update.md` §D 가 이미 검토·수용한 기존 트레이드오프이며 이번 diff 의 새 결함이 아니다. | `integrations.service.ts:1292-1300`(`rotate`) | 조치 불요(기존 결정 존중). 향후 재확인 범위 확대 시 일관성 있게 role 도 재조회 검토 |
| 8 | 부작용(설계 변경, 기록용) | `update()` 가 이름 미변경 요청에서 DB 쓰기를 스킵하도록 바뀌어 `updated_at` 이 더는 갱신되지 않을 수 있다(신선도 지표로 쓰는 소비자가 있다면 영향, 저장소 내에서는 미발견). `handleCallback` 커밋 직전 재판정으로 이전엔 항상 성공하던 OAuth 콜백이 이제 실패할 수 있다(의도된 보안 수정, 회귀 테스트로 커버). | `integrations.service.ts:846`; `integration-oauth.service.ts:821` | 조치 불요 — 참고 기록 |
| 9 | 보안(회귀 없음 확인) | 1라운드 WARNING(OAuth reauthorize/request_scopes 의 begin↔callback 사이 인가 재검증 누락 TOCTOU)이 `assertRequesterStillAllowed` 삽입으로 정확히 닫혔음을 소스 레벨로 확인 — 재발 없음. | `integration-oauth.service.ts`(`assertRequesterStillAllowed`, `handleCallback`) | 조치 불요 — 완결성 확인 차 기재 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 1라운드 TOCTOU WARNING 정상 종결 확인, 신규 Critical/Warning 없음 |
| performance | LOW | update/updateScope 왕복 증가, 컨트롤러 선조회, 인덱스 부재 — 전부 INFO |
| architecture | LOW | Admin 판정 조합 로직 이중 구현(WARNING) |
| requirement | LOW | request_scopes 콜백 거부 메시지가 "reauthorize" 문구로 고정(WARNING), 그 외 §8 요구사항 충족도 매우 높음 |
| scope | NONE | 24개 파일 전부 이번 보안 수정에 직접 종속, 무관한 변경 없음 |
| side_effect | LOW | FORBIDDEN→ADMIN_REQUIRED 계약 변경(문서화됨), 컨트롤러 선조회·no-op 쓰기 변화 등 설계된 부작용 |
| maintainability | LOW | 404 판정 로직·리터럴이 두 서비스에 재중복(WARNING, 재발 패턴) |
| testing | LOW | oauth/begin 본인 personal 통과 테스트 누락(WARNING) |
| documentation | NONE | Cafe24PrecheckResultDto 클래스 docstring 사소한 누락(INFO)만 |
| dependency | NONE | 신규 외부 패키지/버전 변경 없음 |
| database | NONE | 새 필터 조건 인덱스 부재(INFO)만, 마이그레이션 없음 |
| concurrency | LOW | 커밋 직전 재판정이 락 구간 중 별도 커넥션 대여(INFO), rotate 의 role 미재조회는 기존 결정 |
| api_contract | LOW | create() Swagger 설명 미갱신 + FORBIDDEN→ADMIN_REQUIRED 하위호환 변경(WARNING 2건, 후자는 이미 문서화) |
| user_guide_sync | CRITICAL | Admin 필요 메시지 영문 하드코딩·미매핑(CRITICAL), workspaces-and-members.mdx Viewer 역할표 미반영(WARNING) |

## 발견 없는 에이전트

없음 — 14개 reviewer 전원이 최소 1건 이상의 발견사항(INFO 포함)을 보고했다. 새 Critical/Warning 이 전혀 없던 순수 "이상 없음" 에이전트는 `security`(신규), `scope`, `dependency`, `database`, `documentation`(INFO 1건 제외) 이다.

## 권장 조치사항

1. **[CRITICAL, 최우선]** Admin 필요 거부 메시지 3곳(`integrations.service.ts:657-658,663-665,1428-1429`, `integration-oauth.service.ts:423-429`)의 영문 하드코딩을 한국어로 교체하거나 `backend-labels.ts` 코드+action 매핑으로 프론트 3개 소비처(`danger-tab.tsx`, `page.tsx`, `use-oauth-popup-return.ts`)가 `t()` 로 렌더링하도록 동반 수정한다.
2. `assertRequesterStillAllowed` 에 `mode`/action 을 전달해 `request_scopes` 콜백 거부 메시지가 "reauthorize" 로 고정되지 않도록 수정하고(위 1번과 같은 자리), `request_scopes` 403 을 검증하는 유닛테스트를 추가한다.
3. `IntegrationOAuthService.assertRequesterStillAllowed` 가 `IntegrationsService` 의 판정 로직·404 리터럴을 재중복한 부분을 `integration-visibility.ts` 등 순환 의존 없는 공유 지점으로 추출한다(재발 방지).
4. `oauth/begin` 완결성 캐너리에 "본인 personal integrationId → 통과" 테스트를 추가한다.
5. `create()` 핸들러의 `@ApiForbiddenResponse` 설명을 다른 mutating 엔드포인트와 동일하게 `ADMIN_REQUIRED` 코드 보간 방식으로 갱신한다.
6. `07-workspace-and-team/workspaces-and-members.{mdx,en.mdx}` 의 Viewer 역할표에 Personal 통합 재인증/scope 요청 예외를 반영한다.
7. (선택) FORBIDDEN→ADMIN_REQUIRED 코드 변경에 대해 서드파티 API 소비자가 있다면 별도 공지 채널로 추가 고지를 검토한다.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 14개 reviewer 실행(사유는 prompt 에 별도 명시되지 않음).
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원 success)
- **제외**: 없음
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **전원 결과 확보됨**, forced 인데 결과 없음 항목 없음.

| 제외된 reviewer | 이유 |
|------------------|------|
| (해당 없음) | routing 이 skipped 되어 전체 실행, 제외된 reviewer 없음 |
