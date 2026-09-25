# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** precheck 응답의 "필드 조건부 생략"은 OpenAPI 스키마가 아니라 설명(prose)에만 표현됨
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:358-377` (`PRECHECK_IDENTITY_MASKED`, `existingIntegrationId?`, `existingName?`)
  - 상세: `pickPrecheckConflict`(`codebase/backend/src/modules/integrations/integration-oauth.service.ts:357-371`)가 충돌 대상이 요청자에게 보이지 않는(남의 personal) 행이면 `existingIntegrationId`/`existingName` 키 자체를 응답에서 생략한다. 두 필드는 원래도 `@ApiPropertyOptional`(옵션)이라 **스키마 타입상 breaking change 는 아니다** — 프런트엔드도 이미 옵셔널 체이닝으로 소비한다(`codebase/frontend/src/app/(main)/w/[slug]/integrations/new/_components/auth-step.tsx:380,389`, `codebase/frontend/src/lib/api/integrations.ts:413-414`). 다만 "conflict=true 인데 두 필드가 모두 없다"는 조건은 OpenAPI 스키마(`oneOf`/`discriminator` 등)로 인코딩되지 않고 description 문자열로만 전달되므로, 이 문서를 읽지 않는 codegen 클라이언트는 두 필드를 사실상 상시 존재로 가정할 위험이 남는다.
  - 제안: 현재 방식(옵션 필드 + 설명 보강)은 실무적으로 허용 가능한 선. 굳이 강화하려면 `@ApiExtraModels` + `oneOf` 로 "식별자 있음/없음" 두 변형을 명시하는 정도이나, 이번 PR 스코프에서 필수는 아님.

- **[INFO]** `oauth/begin` 의 `reauthorize`/`request_scopes` 모드는 `integrationId` 가 없으면 이번에 추가된 인가 재판정을 아예 거치지 않는다(기존 DTO 동작, 이번 diff 로 인한 회귀 아님)
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:258-259` (`if (action && body.integrationId)`) · `codebase/backend/src/modules/integrations/dto/integration.dto.ts:224-229` (`integrationId?: string` — 두 모드에서도 optional)
  - 상세: `modifyActionOfBeginMode` 는 `mode` 만으로 액션을 정하고, 실제 `requireModifiable` 호출은 `body.integrationId` 가 존재할 때만 실행된다. `OAuthBeginDto` 는 reauthorize/request_scopes 모드에서도 `integrationId` 를 `@IsOptional()` 로 두고 있어(요청 검증에서 조건부 필수화가 안 됨), 이론적으로 `{mode:'reauthorize'}` 만 보내는 요청은 이 PR 이 닫으려는 판정 경로를 타지 않는다. 다만 이 DTO 자체는 이번 diff 의 변경 대상이 아니고, 호출자 고지에도 "이 PR 범위 밖" 후속 항목이 명시돼 있어 새 결함이 아니라 기존 갭의 잔존으로 판단.
  - 제안: 후속 plan(`plan/in-progress/integration-personal-owner-followup.md`)에 "reauthorize/request_scopes 모드의 integrationId 조건부 필수화(`@ValidateIf`)" 를 명시적으로 등록해 두면 다음 세션이 놓치지 않는다.

## 점검 관점별 확인 (문제 없음)

- **하위 호환성**: 서비스 메서드(`precheckCafe24Mall`/`precheckMakeshopShop`/`findAll`/`findById`/`getUsages`/`getActivity`/`testConnection`/`update`/`remove`/`requestScopes`/`updateScope`/`reauthorize`)에 `userId`(또는 `userRole`) 파라미터가 추가됐지만 전부 컨트롤러 내부 호출이며 컨트롤러는 이미 인증된 `@CurrentUser()` 에서 값을 채운다 — 외부 요청 스키마(경로·쿼리·바디)는 하나도 바뀌지 않았다. DTO 필드도 전부 기존에 optional 이던 필드만 조건부로 생략되므로 스키마 레벨 breaking change 없음.
- **버전 관리**: 별도 API 버전 분기 없음, 기존 관례(버전 없음) 유지.
- **응답 형식**: `PaginatedResponseDto` 의 `total`/`limit` 계산이 SQL 레벨 가시성 필터(`integrationVisibilityClause`, `codebase/backend/src/modules/integrations/integration-visibility.ts:37-39`)로 처리돼 목록·페이지네이션 메타가 남의 personal 행을 세지 않는다 — 응답 구조 일관성 양호.
- **에러 응답**: `RESOURCE_NOT_FOUND`(404)·`ADMIN_REQUIRED`(403, `ROLE_REQUIRED.admin` 공유 문구)로 코드·문구가 일원화되고(`integration-visibility.ts:47-52`, `81-88`), 기존에 흩어져 있던 `ForbiddenException({code:'FORBIDDEN', ...})` 4곳이 공유 함수 호출로 대체되어 오히려 일관성이 개선됨. HTTP 상태 코드(404/403/409)도 판정 성격에 맞게 사용.
- **요청 검증**: 컨트롤러/DTO 자체의 검증 로직은 변경 없음(쿼리·바디 스키마 그대로). 새로 추가된 것은 인가 판정 로직뿐.
- **URL/경로 설계**: 신규 라우트 없음, 기존 RESTful 구조(`/integrations`, `/integrations/:id/...`) 유지. `:id` 라우트 전수를 리플렉션으로 캐너리 테스트(`codebase/backend/src/modules/integrations/integrations.controller.owner.spec.ts:206-221`)해 "새 `:id` 라우트가 판정 없이 추가되는" 회귀를 구조적으로 방지한 점이 API 계약 관점에서 긍정적.
- **페이지네이션**: 위 응답 형식 항목과 동일 — 필터가 SQL 단으로 내려가 있어 페이지네이션 정합성 유지.
- **인증/인가**: `:id` 하위 전 엔드포인트에 "보이는가(404) → Organization 이면 Admin 인가(403)" 순서가 `requireModifiable`/`requireVisible` 로 일원화됐고, `oauth/begin` 의 `integrationId` 우회 경로도 `:id/reauthorize`·`:id/request-scopes` 와 동일 판정을 받도록 막았다. Swagger 문서(`@ApiForbiddenResponse`/`@ApiNotFoundResponse`)도 실제 동작에 맞춰 갱신되어 있어 문서-구현 정합성 양호.

## 요약

이번 변경은 새 엔드포인트나 요청/응답 스키마 형태 변경 없이, 기존 통합(Integration) API 전반에 "Personal 소유자 강제 + Organization 변경 Admin 전용" 인가 규칙을 결합한 보안 수정이다. 서비스 메서드 시그니처에 `userId`/`userRole` 이 추가됐지만 전부 컨트롤러가 인증 토큰에서 채우는 내부 배선이라 외부 계약에는 영향이 없고, DTO 필드는 원래도 optional 이던 것만 조건부로 생략돼 하위 호환성이 유지된다. 에러 코드·문구가 공유 함수로 일원화되고 Swagger 설명이 실제 동작(신규 403/404 케이스 포함)에 맞춰 갱신됐으며, `:id` 라우트 전수 캐너리 테스트로 향후 회귀도 구조적으로 막아둔 점이 API 계약 관점에서 특히 견고하다. 발견된 두 건은 모두 차단 사유가 아닌 INFO 수준(정성적 스키마 표현의 한계, 기존 DTO 의 조건부 필수 검증 미비)이며 이미 알려진 범위 밖 후속 항목과 겹친다.

## 위험도

LOW
