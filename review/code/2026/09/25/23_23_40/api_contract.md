# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `create()` 의 `@ApiForbiddenResponse` 설명이 실제 에러 코드 변경(FORBIDDEN → ADMIN_REQUIRED)을 반영하지 않는다
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:460` (`async create` 핸들러의 `@ApiForbiddenResponse({ description: 'organization 범위 생성 권한 부족' })`)
  - 상세: 이번 변경(및 CHANGELOG "Unreleased — 남의 Personal 통합은 보이지 않고…" 항목)은 `IntegrationsService.assertCanModify`/`throwAdminRequired` 를 통해 organization 범위 생성 거부 코드를 `FORBIDDEN` 에서 `ADMIN_REQUIRED` 로 승격했다(§`create` 는 CHANGELOG 가 명시한 "기존 네 자리" 중 하나). 그런데 같은 파일에서 `update`/`rotate`/`reauthorize`/`requestScopes`/`updateScope`/`remove`/`oauthBegin` 의 `@ApiForbiddenResponse` 는 이번 PR 에서 `FORBIDDEN_MEMBER_OR_ORG_ADMIN`/`FORBIDDEN_EDITOR_OR_ORG_ADMIN`/`FORBIDDEN_MEMBER_OR_ADMIN` 처럼 `ROLE_REQUIRED.admin.code` 를 문자열 보간해 실제 코드를 노출하도록 갱신됐다. `create()` 만 예전 설명 문자열("organization 범위 생성 권한 부족")에 머물러 있어, OpenAPI 스펙만 보고 클라이언트/SDK 를 생성하는 소비자는 이 엔드포인트가 여전히 구분되지 않는 제네릭 403 을 낸다고 오해하거나, 에러 코드 문자열을 문서에서 찾지 못한다.
  - 제안: `create()` 의 `@ApiForbiddenResponse` 설명도 다른 mutating 엔드포인트와 같은 패턴으로 `ROLE_REQUIRED.admin.code` (`ADMIN_REQUIRED`) 를 보간하도록 갱신해 문서-구현 정합을 맞춘다.

- **[WARNING]** 4개 기존 엔드포인트 + 신규 판정 경로의 403 에러 코드가 `FORBIDDEN` → `ADMIN_REQUIRED` 로 바뀌는 하위 호환성 이슈 — 문서화는 되어 있으나 재확인 필요
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (`assertCanModify`/`throwAdminRequired`, 예: `create`/`rotate`/`requestScopes`/`updateScope` 판정부), `codebase/backend/src/modules/integrations/integration-oauth.service.ts:405-430`(`assertRequesterStillAllowed`)
  - 상세: `error.code === 'FORBIDDEN'` 로 분기하던 기존 API 클라이언트(자사 frontend 제외, 서드파티/외부 API 소비자 가능성)는 이 4개 자리(조직 범위 생성·rotate·request-scopes·scope 전환)와 새로 추가된 reauthorize/request-scopes 콜백 재판정에서 더는 `FORBIDDEN` 을 받지 못하고 `ADMIN_REQUIRED` 를 받는다. HTTP 상태 코드(403)는 그대로 유지되어 상태 코드 기반 처리에는 영향이 없고, CHANGELOG("Unreleased — 남의 Personal 통합은…")에 이 변경이 명시적으로 고지되어 "의도된 breaking change" 로 판단된다. 다만 CHANGELOG 는 "자사 frontend 는 이 코드로 분기하지 않는다" 로만 리스크를 좁혀 서술하고, 서드파티 API 통합 사용 여부는 언급하지 않는다.
  - 제안: 이 프로젝트에 외부(서드파티) API 소비자가 존재한다면, API 버전 고지(예: API changelog/공지) 채널을 통해 `error.code` 변경을 별도로 알리는 것을 고려한다. 내부 전용이라면 현재 조치로 충분하다(추가 조치 불요 — 정보성 기록).

- **[INFO]** `oauth/begin` 의 `integrationId` 미지정 reauthorize/request_scopes 요청은 begin 단계에서 판정을 건너뛰지만, 콜백 단계(`handleCallback`)의 `OAUTH_STATE_INVALID`(400) 로 안전하게 막힌다 — 결함 아님, 확인차 기록
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:259` (`if (action && body.integrationId)`), `codebase/backend/src/modules/integrations/integration-oauth.service.ts` 의 `handleCallback` 내 `if (!record.integrationId) { throw ... OAUTH_STATE_INVALID }`
  - 상세: `OAuthBeginDto.integrationId` 는 `@IsOptional()` 이라 reauthorize/request_scopes 모드에서도 값 없이 보낼 수 있고, 이 경우 controller 의 `requireModifiable` 인가 판정이 스킵된다. 다만 `begin()` 은 `record.integrationId: null` 상태로 state 를 저장하고, 콜백에서 `record.mode !== 'new'` 인데 `integrationId` 가 없으면 `400 OAUTH_STATE_INVALID` 로 실패해 자격 증명 커밋에 도달하지 못한다. 우회 경로는 없는 것으로 확인됨 — 별도 조치 불필요.

## 요약

이번 변경은 Integration 리소스의 Personal/Organization 가시성·권한 판정을 서비스 계층에 강제하는 보안 수정으로, 공개 URL·HTTP 메서드·요청 바디 스키마·페이지네이션 파라미터는 그대로 유지한 채(`@CurrentUser()` 로 얻는 `userId` 는 클라이언트가 이미 보내는 JWT 에서 파생되므로 신규 클라이언트 입력 요구가 아님) 응답 내용(목록에서 남의 personal 제외, `:id` 계열 전부 동일한 404, precheck 의 `existingIntegrationId`/`existingName` 조건부 생략)과 일부 403 에러 코드(`FORBIDDEN` → `ADMIN_REQUIRED`)를 바꾼다. 404 메시지는 `RESOURCE_NOT_FOUND`/`Integration not found` 로 기존 "존재하지 않음" 응답과 완전히 동일하게 통일되어 정보 노출을 막고, `findAll` 의 total 카운트도 SQL 단에서 가시성 필터를 적용해 페이지네이션 정합성을 지킨다. Swagger 문서도 대부분의 엔드포인트에서 실제 코드값을 보간해 갱신됐으나 `create()` 하나가 갱신 누락되어 문서-구현 정합이 깨졌고, 코드 변경 자체는 CHANGELOG 에 상세히 고지되어 있어 하위 호환성 리스크는 낮게 관리되고 있다. 전반적으로 API 계약 관점에서 심각한 결함은 없다.

## 위험도

LOW
