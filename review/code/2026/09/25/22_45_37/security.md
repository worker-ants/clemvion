# 보안(Security) 리뷰 — integration-personal-owner

## 발견사항

- **[WARNING]** OAuth `reauthorize`/`request_scopes` 콜백이 자격증명을 실제로 갈아끼우는 시점에 인가를 재검증하지 않는다 (TOCTOU)
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — `handleCallback` (590번째 줄부터, 특히 764~785번째 줄의 재조회·자격증명 대입 구간). 이 파일의 이 구간은 이번 diff 에 포함되지 않은 "전체 파일 컨텍스트" 라 diff 게이트 번호가 없다 — `Read` 로 원본을 직접 열어 확인한 실제 소스 줄 번호다.
  - 상세: 이번 PR 은 `IntegrationsController.oauthBegin`/`reauthorize`/`requestScopes` 가 `begin()` 호출 **직전**에 `resolveRole` + `requireModifiable`(가시성 404 → Organization Admin 403)을 검사하도록 새로 추가했다(`integrations.controller.ts` 226~238, `integrations.service.ts` `requireModifiable`). 그런데 실제로 자격증명을 덮어쓰는 지점은 사용자가 외부 OAuth 팝업 동의를 마치고 돌아오는 `handleCallback`이고, 문서(`integration-management.mdx` §OAuth 팝업)에도 "5분 안에 돌아오지 않으면 타임아웃"이라고 명시할 만큼 `begin()`과 `handleCallback()` 사이에 최대 수 분의 간극이 있다. `handleCallback` 은 `pessimistic_write` 락으로 행을 다시 읽지만(764~767번째 줄) `isIntegrationVisibleTo`/`assertCanModify` 를 다시 부르지 않고 곧바로 `integration.credentials = credentials`(778번째 줄, reauthorize) 또는 병합(780~785번째 줄, request_scopes — 이 분기도 새 `access_token`/`refresh_token`을 덮어쓴다)으로 커밋한다. 즉 begin() 시점엔 Admin 이었던 사용자가 그 사이 Editor/Viewer 로 강등되어도, 이미 발급받은 `state` 로 콜백을 완료하면 Organization 통합의 외부 계정 자격증명을 자신의 것으로 바꿔치기하는 데 성공한다 — 이 PR 이 막으려던 바로 그 시나리오("Viewer 가 Organization 통합을 자기 외부 계정으로 재인증")를 완전히 막지 못하는 좁은 창이 남는다.
  - 같은 파일 `IntegrationsService.rotate()`(`integrations.service.ts` 1260~1271번째 줄)는 정확히 이 계열의 레이스를 의식하고 트랜잭션 락 안에서 `isIntegrationVisibleTo`/`assertCanModify` 를 **다시** 검사하도록 설계돼 있다(주석: "권한도 이 시점 값으로 다시 본다 — 테스트가 도는 동안 scope 가 바뀌었을 수 있다"). OAuth reauthorize/request_scopes 경로에는 이 대칭적인 재검사가 빠져 있어 같은 파일 안에서 처리 일관성이 깨진다.
  - 제안: `handleCallback` 이 `record.userId` 로 현재 role 을 다시 조회하고 (해당 없다면 Personal 은 `isIntegrationVisibleTo`, Organization 은 `assertCanModify` 상당 판정을) 커밋 직전에 재확인하도록 한다. `rotate()`의 lock-안 재검사 패턴을 그대로 재사용할 수 있다.

- **[INFO]** `getForExecution` 은 이번 PR 의 가시성 판정(§8)을 적용받지 않는다 — 문서화된 기존 잔여 갭
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1543` (`getForExecution`)
  - 상세: 워크플로우 실행 엔진이 노드 config 의 `integrationId` 로 통합을 읽는 이 경로는 워크스페이스 스코프만 확인하고 `created_by`/`scope` 는 보지 않는다(메서드 docstring 이 이를 명시). 즉 스케줄/웹훅 등으로 실행되는 노드가 다른 멤버의 personal 통합을 계속 사용할 수 있다. 이번 diff 가 만든 새 결함은 아니며, `plan/in-progress/integration-personal-owner-followup.md` 첫 항목("워크플로우 노드에서 사용: 본인 것만")에 후속 작업으로 명시적으로 추적되고 있다. 추가 조치 불필요 — 완결성 확인 차 기재.

- **[INFO]** precheck(`GET /integrations/cafe24/precheck`, `.../makeshop/precheck`) 및 unique 제약 409 는 남의 personal 의 "존재"를 계속 드러낸다 — 의도된 잔여
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` `pickPrecheckConflict`(약 346~360번째 줄, 이번 diff 포함)
  - 상세: `conflict: true` 는 남의 personal 이어도 항상 반환되고(식별자·이름만 숨김), 워크스페이스 단위 유일성 제약(mall_id/shop_uid/이름) 때문에 새 통합 생성 시 409 로 "이미 존재"가 드러난다. 이는 호출자 고지와 spec Rationale 이 명시적으로 받아들인 잔여 리스크("워크스페이스 단위 유일성이 남의 personal 의 존재를 409 로 드러내는 것은 spec Rationale 이 받아들인 잔여")이며, 이번 diff 의 버그가 아니다. 완결성 확인 차 기재.

## 검증한 항목 (문제 없음)

- `integrationVisibilityClause(alias)`(`integration-visibility.ts`)는 alias 를 하드코딩 리터럴(`'i'`)로만 호출하고 사용자 입력을 SQL 에 직접 연결하지 않는다 — 뷰어 id 는 파라미터 바인딩(`:integrationViewerId`)으로 전달돼 SQL 인젝션 경로 없음.
- `IntegrationsController`의 `:id` 전 라우트(`findOne`/`listUsages`/`activity`/`testConnection`/`update`/`rotate`/`reauthorize`/`requestScopes`/`updateScope`/`remove`) 가 전부 `requireVisible`/`requireModifiable` 를 거치도록 배선됐고, `integrations.controller.owner.spec.ts` 가 리플렉션으로 `:id` 라우트 전수를 이 판정 표와 대조하는 완결성 캐너리를 둬 향후 라우트 추가 시 회귀를 방지한다.
- 남의 personal 은 존재하는 id 든 아니든 항상 동일한 `404 { code: 'RESOURCE_NOT_FOUND', message: 'Integration not found' }` 를 반환하도록 `throwIntegrationNotFound()` 단일 지점에서 통일 — 역할 우위(Owner 포함) 없이도 존재-오라클을 막는 설계이며 e2e(`integration-personal-owner.e2e-spec.ts`)가 이를 실제 HTTP 응답으로 재확인한다.
- `updateScope` 는 Admin 여부를 먼저 검사한 뒤 가시성을 검사하므로 비-Admin 요청자에게는 대상 id 의 존재 여부와 무관하게 항상 동일한 403 이 나가 존재 열거로 이어지지 않는다.
- `assertCanModify`/`requireModifiable` 는 "보이는가(404) → Organization 이면 Admin 인가(403)" 순서를 일관되게 지켜 인가 판단이 자원 존재 확인보다 먼저 실행되는 경우(`remove()`의 명시 주석대로)를 포함해 사용처 조회 등 부수 조회로 존재를 흘리지 않는다.
- `create()`/`updateScope()`의 organization 승격은 `isAdmin(userRole)` 게이트를 거치고 `createdBy` 는 서버가 강제하는 `userId` 로만 설정되어 클라이언트가 소유자를 스푸핑할 수 없다.
- 자격증명은 여전히 마스킹된 형태로만 API 응답에 노출되고(`maskCredentials`), 에러 메시지도 `INTEGRATION_CREDENTIALS_UNREADABLE` 등 정형화된 코드만 노출한다 — 이번 diff 가 이 경계를 건드리지 않았다.
- e2e 신규 스펙(`codebase/backend/test/integration-personal-owner.e2e-spec.ts`)에 하드코딩된 `credentials: { token: 'e2e-ipo-...' }` 는 테스트 픽스처용 더미 값이며 실제 시크릿이 아니다.

## 요약

이 PR 은 실제로 심각했던 인가 결함(Organization 통합의 reauthorize 에 역할 검사가 전무해 어떤 멤버든 자기 외부 계정으로 조직 통합의 자격증명을 바꿔치기할 수 있었던 문제, 그리고 Personal 통합을 소유자 아닌 사람이 열람/변경할 수 있었던 문제)을 목록·`:id` 전 라우트·precheck·워크플로우 어시스턴트 후보 조회까지 넓게, 그리고 SQL 필터링(페이지네이션 total 오염 방지)·통일된 404·리플렉션 기반 라우트 완결성 테스트·e2e 로 잘 마감했다. 다만 새로 추가된 인가 검사가 OAuth `begin()` 요청 시점에만 걸려 있고, 실제 자격증명이 갈아 끼워지는 `handleCallback()` 커밋 시점에는 재검증이 없어 — 같은 파일의 `rotate()`가 명시적으로 방어한 것과 같은 계열의 TOCTOU 창이 reauthorize/request_scopes 경로에 남아 있다(최대 수 분 창, role 강등이 그 사이 개입해야 하는 좁은 조건이지만 이 PR 이 닫으려던 바로 그 위협모델과 정확히 겹친다). 그 외 SQL 인젝션·시크릿 하드코딩·인가 우회·암호화·에러 정보 노출 관점에서는 새로운 문제를 발견하지 못했다.

## 위험도

LOW
