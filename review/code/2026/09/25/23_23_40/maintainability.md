# 유지보수성(Maintainability) 리뷰 — integration-personal-owner (2라운드)

## 발견사항

- **[WARNING]** "없는 통합" 404 판정 로직·리터럴이 두 서비스 클래스에 다시 중복됐다 — 직전 리뷰가 같은 문제를 이미 한 번 고쳤다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:405-430`(`assertRequesterStillAllowed`, 특히 411-414 `NotFoundException` 리터럴과 424-428 `ForbiddenException` 하드코딩 메시지) vs `codebase/backend/src/modules/integrations/integrations.service.ts:630-665`(`requireVisible` + `assertCanModify` + `throwAdminRequired`) · `integrations.service.ts:713-725`(`throwIntegrationNotFound`, 주석 자체가 "파일 전체 7곳으로 늘어 있었다(maintainability WARNING 2)"를 언급)
  - 상세: `IntegrationsService` 는 "보이는가(404) → Organization 이면 Admin(403)" 판정을 `requireVisible`/`assertCanModify`/`throwAdminRequired` 세 헬퍼로 한 곳에 모아 `{code:'RESOURCE_NOT_FOUND', message:'Integration not found'}` 리터럴 중복을 막았다(그 헬퍼를 만든 이유가 바로 "파일 전체 7곳 중복" 이었다고 주석에 적혀 있다). 그런데 이번 PR 이 `IntegrationOAuthService.assertRequesterStillAllowed` 에 **같은 판정**(가시성 → Organization 이면 Admin)을 새로 추가하면서, 그 헬퍼들을 재사용하지 못해(순환 의존 회피 때문으로 보임) `{code:'RESOURCE_NOT_FOUND', message:'Integration not found'}` 리터럴과 `'Admin role is required to reauthorize organization-scope integrations'` 메시지를 **손으로 다시 타이핑**했다. `integration-oauth.service.ts` 안에도 동일 리터럴이 이미 한 번 더 있다(814-818, 콜백의 트랜잭션 내부 조회 실패 분기 — PR 이전부터 존재). 결과적으로 같은 "없는 통합" 응답 모양이 지금 최소 3곳(두 파일 걸쳐)에 하드코딩돼 있고, "reauthorize" 거부 문구는 `IntegrationsService.assertCanModify` 의 템플릿(`Admin role is required to ${action} organization-scope integrations`)과 `IntegrationOAuthService` 의 정적 문자열이라는 **서로 다른 두 생성 경로**로 각자 만들어진다. 둘 중 하나만 바뀌면(예: 코드값·문구·§ 번호) 컨트롤러 Swagger 문서가 명시하는 "`:id/reauthorize` · `oauth/begin` 이 이미 본 것과 같은 판정" 이라는 불변식이 조용히 깨질 수 있다.
  - 제안: `IntegrationOAuthService` 가 `IntegrationsService` 를 직접 참조할 수 없다면(순환 의존), 판정 로직 자체를 별도의 의존성 없는 순수 함수/얇은 서비스(예: `integration-authorization.ts`, `integration-visibility.ts` 와 같은 패턴)로 뽑아 두 서비스가 공유하게 한다. 최소한 `RESOURCE_NOT_FOUND`/`Integration not found` 리터럴과 액션별 거부 문구 생성만이라도 공유 상수/함수로 옮기면 향후 drift 를 막을 수 있다.

- **[INFO]** Swagger 설명 문자열이 두 프로퍼티에 그대로 복붙됐다 — 같은 PR 안에서 이미 쓰는 상수-추출 관례를 이 파일에는 적용하지 않았다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:363-364`(`existingIntegrationId`) / `:369-370`(`existingName`)
  - 상세: 두 `@ApiPropertyOptional({ description: ... })` 가 "conflict=true 일 때만 채워진다 — 다만 충돌 대상이 다른 멤버의 개인(personal) 통합이면 conflict=true 여도 생략한다(spec 통합 §8 · §9.2)." 라는 문장을 글자 그대로 두 번 반복한다. 같은 PR 의 `integrations.controller.ts` 는 `FORBIDDEN_MEMBER`/`NOT_FOUND_INTEGRATION` 처럼 반복되는 API 설명 문구를 파일 상단 상수로 뽑아 "코드명이 바뀌면 설명이 따라온다" 는 명시적 원칙을 세워 뒀는데, 같은 조건(§ 번호가 바뀌면 두 곳을 동시에 고쳐야 함)에 놓인 이 DTO 파일에는 그 관례가 적용되지 않았다.
  - 제안: `existingIntegrationId`/`existingName` 이 공유하는 접미 문장을 파일 상단 상수(예: `EXISTING_FIELD_OMITTED_FOR_OTHERS_PERSONAL`)로 뽑아 두 데코레이터에서 재사용.

- **[INFO]** `IntegrationModifyAction` 타입 이름과 원소 `'create'` 의 의미가 어긋난다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:390-395`
  - 상세: 주석은 "Organization 통합을 **바꾸는** 동작" 이라고 정의하는데, 유니온에는 아직 존재하지 않는 행을 만드는 `'create'` 도 포함돼 있다. `assertCanModify({ scope: requestedScope }, userRole, 'create')` 호출부(`create()`, `:737-740`)를 보면 실제로는 "이 scope 값으로 생성/변경하려는 동작" 을 의미하므로 크게 헷갈리지는 않지만, 타입 이름만 보면 "기존 통합 수정" 으로 좁게 읽혀 새로 이 타입을 보는 사람이 `'create'` 원소를 보고 한번 멈칫할 수 있다.
  - 제안: 타입명을 `IntegrationScopeGuardedAction` 등으로 넓히거나, 주석에 "생성 시 요청 scope 판정도 포함" 을 한 줄 추가.

## 요약

이 PR 은 이미 매우 높은 수준의 문서화·일관된 네이밍(§8 spec 참조를 모든 주석에 명시)·의도적인 리팩터링(예: cafe24/makeshop precheck 중복 제거를 위한 `pickPrecheckConflict` 추출, `judgedRow`/`reloadOrNotFound`/`requireVisible`/`assertCanModify` 로의 판정 로직 집중화)을 보여준다. 테스트도 `it.each` 표 기반 설계와 `IntegrationsController` 의 `:id` 라우트 전수 리플렉션 캐너리처럼 향후 라우트 추가 시 판정 누락을 구조적으로 막는 좋은 패턴을 쓴다. 다만 새로 추가된 `IntegrationOAuthService.assertRequesterStillAllowed` 가 `IntegrationsService` 쪽에서 이미 "7곳 중복을 헬퍼로 통합했다" 고 스스로 기록해 둔 바로 그 404 판정 리터럴·거부 문구를 다른 파일에 다시 하드코딩한 것은, 이 PR 이 지향하는 단일 진실 원칙과 어긋나는 재발 사례이며 두 판정 경로가 향후 다르게 진화(drift)할 실질적 위험을 남긴다. 그 외 발견은 문서 문자열 중복·타입 명명 정밀도 같은 경미한 사안이다.

## 위험도

LOW
