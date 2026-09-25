# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `Cafe24PrecheckResultDto` 의 property-level Swagger 설명이 새 마스킹 규칙을 반영하지 못함
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:361-370` (`existingIntegrationId`/`existingName` 의 `@ApiPropertyOptional` description)
  - 상세: `pickPrecheckConflict()`(`codebase/backend/src/modules/integrations/integration-oauth.service.ts` 신설, 게이트 346-360)는 `conflict: true` 이면서도 충돌 대상이 **남의 personal** 이면 `existingIntegrationId`/`existingName` 을 응답에서 뺀다. 이 동작은 컨트롤러의 `@ApiOkWrappedResponse` 설명(`integrations.controller.ts` 게이트 294-296, 324-326: "충돌 대상이 다른 멤버의 개인(personal) 통합이면 id/name 을 싣지 않는다")과 `spec/2-navigation/4-integration.md` §8·§9.2 에는 반영됐지만, 실제 응답 스키마를 정의하는 DTO 프로퍼티 설명은 여전히 "conflict=true 일 때만 채워진다" 라고만 적혀 있어 "conflict=true 면 항상 채워진다" 로 오독될 수 있다. 이 DTO 는 `cafe24/precheck` 와 `makeshop/precheck` 양쪽이 공유하므로(spec §9.2 "응답 shape 은 cafe24/precheck 와 동형") 두 엔드포인트 모두에 영향을 준다. OpenAPI 스펙에서 코드 생성기(client SDK 등)가 참조하는 것은 이 프로퍼티 description 이지 markdown spec 이나 상위 `@ApiOkWrappedResponse` 텍스트가 아니다.
  - 제안: `existingIntegrationId`/`existingName` 의 description 에 "충돌 대상이 다른 멤버의 personal 통합이면 conflict=true 여도 생략됨" 을 명시해 실제 조건부 마스킹 동작과 Swagger 문서를 일치시킨다.

- **[INFO]** Admin 거부 코드 `FORBIDDEN` → `ADMIN_REQUIRED` 변경은 코드값 기준 breaking change이나 적절히 문서화됨
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts`(`assertCanModify`/`throwAdminRequired`, create 흐름 등 4곳 승격) · `CHANGELOG.md:39-41`
  - 상세: HTTP 상태 코드는 403 으로 유지되지만 응답 바디의 `code` 필드가 `FORBIDDEN` 에서 `ADMIN_REQUIRED` 로 바뀐다. 이는 `error.code` 로 분기하는 외부/타 클라이언트가 있다면 breaking change 다. CHANGELOG 에 변경 사실과 "자사 frontend 는 이 코드로 분기하지 않는다" 는 영향 범위가 명시돼 있어 절차는 준수됐다. 다만 프로젝트에 API 버전 관리 체계가 없어(단일 미버전 내부 API), 이런 code-value 변경을 감지할 수 있는 유일한 수단이 CHANGELOG 기록뿐이라는 점은 구조적 한계로 남는다(이번 PR 의 결함은 아님).
  - 제안: 조치 불필요(이미 문서화됨). 참고로만 남김.

- **[INFO]** `:id` 경로 남의 personal → 404 e2e 커버리지가 `rotate`/`request-scopes` 를 제외함
  - 위치: `codebase/backend/test/integration-personal-owner.e2e-spec.ts` (게이트 155-198 의 `it.each` 목록)
  - 상세: e2e 의 "남의 personal 은 Owner 에게도 404" 표에는 `GET /:id`·`usages`·`activity`·`test`·`PATCH /:id`·`reauthorize`·`PATCH /:id/scope`·`DELETE /:id` 8개가 있으나 `POST /:id/rotate`·`POST /:id/request-scopes` 는 빠져 있다. 두 라우트는 `integrations.service.spec.ts`(§8 소유자 강제, `byId` 배열)와 `integrations.controller.owner.spec.ts`(`BY_ID` 리플렉션 전수 테이블)에서 unit/controller 레벨로는 이미 다뤄지므로 판정 자체의 커버리지 공백은 아니고, e2e 계층에서만 대표 표본을 줄인 것으로 보인다.
  - 제안: 조치 불필요(선택적 보강 사항). e2e 를 늘릴 경우 두 라우트를 표에 추가하는 정도.

## 요약

이 PR 은 통합(Integration) 리소스에 소유자 기반 가시성(§8 판정 규칙)과 Organization 통합에 대한 Admin 등급 인가를 신설·강제하는 보안 수정으로, API 계약 관점에서는 대체로 견고하다. 응답 바디 형태(`{data}`/`{data,pagination}`, 에러 `{code,message}`)는 기존 컨벤션을 그대로 따르고, `findAll` 의 가시성 필터는 `getCount`/`getMany` 가 공유하는 동일 QueryBuilder 에 적용돼 페이지네이션 `total` 정합성이 보존된다. 신규·변경된 모든 `:id` 경로와 `oauth/begin` 의 `integrationId` 우회 경로에 대해 Swagger `@ApiForbiddenResponse`/`@ApiNotFoundResponse` 설명이 실제 인가 판정 순서(가시성→역할, `updateScope` 만 예외지만 이는 이 PR 이전부터의 기존 순서)와 맞게 갱신됐고, `spec/2-navigation/4-integration.md` §8·§9.2·CHANGELOG 가 모두 같은 사실을 일관되게 기술한다. 유일하게 갱신이 누락된 곳은 `Cafe24PrecheckResultDto` 의 property-level Swagger 설명으로, 컨트롤러 설명·spec 문서는 갱신됐지만 실제 OpenAPI 스키마 소스인 DTO 어노테이션은 예전 그대로다(WARNING). `FORBIDDEN`→`ADMIN_REQUIRED` 코드 값 변경은 하위 호환성 관점의 breaking change 이지만 CHANGELOG 에 영향 범위와 함께 명시돼 있어 절차상 문제는 없다. 요청 검증(`OAuthBeginDto.integrationId` 의 `@IsUUID`) · 인가 순서(가시성 우선 → 사용처 조회/역할) 설계도 정보 노출 방지 관점에서 타당하다.

## 위험도

LOW
