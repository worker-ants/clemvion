# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `GET /integrations` 목록·`GET /integrations/:id`(및 usages/activity/test/update/rotate/reauthorize/request-scopes/scope/remove) 의 응답 가시성이 바뀌는 의도된 breaking behavior change
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` (`findAll`, `Get(':id')` 등 `:id` 핸들러 전부), `codebase/backend/src/modules/integrations/integrations.service.ts` (`findAll`, `requireVisible`, `requireModifiable`)
  - 상세: 종전에는 워크스페이스 멤버(특히 Owner/Admin)가 다른 멤버의 personal 통합을 목록·상세에서 볼 수 있었으나, 이번 변경으로 personal 통합은 생성자에게만 보이고 그 외 요청자에게는 "없는 통합"과 동일한 404(`RESOURCE_NOT_FOUND`)로 응답한다. 이는 기존에 그 데이터를 소비하던 관리자용 도구·자동화가 있었다면 실제 동작이 달라지는 breaking change다.
  - 다만 (1) `spec/2-navigation/4-integration.md` §8 판정 규칙에 근거한 의도된 보안 수정이고, (2) Swagger `@ApiOperation.description`·`@ApiNotFoundResponse`(`NOT_FOUND_INTEGRATION` 문구로 "남의 personal 통합도 같은 응답"을 명시)·프론트 문서(mdx, en/ko)까지 일관되게 갱신되었으며, (3) `integrations.controller.owner.spec.ts`(리플렉션 전수 캐너리) + e2e(`integration-personal-owner.e2e-spec.ts`)로 전 라우트에 걸쳐 검증되어 있다. 스키마(응답 DTO 형태) 자체는 변하지 않았고 필터링/404 판정만 달라진 것이라, 문서화 수준과 테스트 커버리지를 감안하면 차단 사유는 아니다.
  - 제안: 별도 조치 불요. 프런트/외부 연동 문서에 이번 변경을 changelog 로 명시적으로 남겨 API 소비자가 인지하게 하는 것을 권장한다(이미 mdx 문서는 갱신됨 — 별도 CHANGELOG 존재 여부만 확인 권장).

- **[INFO]** Admin 권한 부족 403 응답의 `code`·`message`가 엔드포인트별 ad-hoc 값에서 공유 상수(`ROLE_REQUIRED.admin`)로 통합되며 값이 바뀜
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (`create`/`rotate`/`updateScope`/`requestScopes`/`reauthorize`가 호출하는 `assertCanModify` → `codebase/backend/src/modules/integrations/integration-visibility.ts` `adminRequiredError`), `codebase/backend/src/modules/integrations/integrations.controller.ts` (`FORBIDDEN_MEMBER_OR_ORG_ADMIN` 등 Swagger 상수)
  - 상세: 변경 전에는 각 메서드가 개별적으로 `{code: 'FORBIDDEN', message: '<영문 하드코딩 문장>'}` 을 던졌다(예: `create()`의 옛 코드 `'Admin role is required to create organization-scope integrations'`). 변경 후에는 `{code: 'ADMIN_REQUIRED', message: '<동작별 한국어 문구> Admin 이상의 권한이 필요합니다.'}` 로 통일된다. 이는 응답 바디의 `code` 값과 `message` 언어가 모두 바뀌는 실질적인 error-contract breaking change — `code === 'FORBIDDEN'` 으로 분기하던 기존 클라이언트가 있다면 깨진다.
  - 이 변경은 이번 세션의 이전 라운드(`git log` 상 `2f3562ce7 fix(integrations): Admin 거부 문구를 공유 한국어 문구로`)에서 의도적으로 결정된 일관성 수정이고, Swagger 설명에도 `${ROLE_REQUIRED.admin.code}` 보간으로 `ADMIN_REQUIRED` 가 명시되어 있어 문서-구현 괴리는 없다. 같은 리포의 프런트가 유일한 소비자로 보이므로 실무 위험은 낮다.
  - 제안: 외부(서드파티) API 소비자가 있는지 확인하고, 있다면 이 code 변경을 릴리스 노트에 명시한다. 없다면 조치 불요.

- **[INFO]** Cafe24/MakeShop precheck 응답의 `existingIntegrationId`/`existingName` 조건부 생략 — 스키마는 하위 호환, 의미는 변경
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (`Cafe24PrecheckResultDto`), `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (`pickPrecheckConflict`)
  - 상세: 두 필드는 이미 `@ApiPropertyOptional`(선택)이었으므로 JSON Schema 관점에서는 breaking 이 아니다. 다만 "conflict=true 면 항상 채워진다"고 가정한 프런트 코드가 있다면(다른 멤버의 personal 과 충돌하는 케이스에 한해) 동작이 달라진다. `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` 의 docstring·description 이 이 조건을 명시적으로 설명하고 있어 계약 문서화는 충분하다.
  - 제안: 프런트의 precheck 배너 컴포넌트가 `existingIntegrationId` 부재 케이스를 실제로 다루는지(별도 Warning 대상일 수 있음, API 계약 범위 밖)만 확인.

## 검증 참고
- `codebase/backend/src/modules/integrations/integration-visibility.ts` (신규) 의 `isIntegrationVisibleTo`/`integrationVisibilityClause`/`integrationNotFoundError`/`assertOrgScopeModifiable` 가 컨트롤러·서비스·OAuth 콜백·AI 어시스턴트 도구(`candidate-lookup.service.ts`, `explore-tools.service.ts`) 전체에서 단일 진실로 재사용되어 판정 drift 위험이 낮다.
- `GET /integrations` 목록은 가시성 필터를 SQL `andWhere`(`integrationVisibilityClause`)로 적용해 `total`/`limit` 페이지네이션 메타가 필터링된 결과와 일치한다 — 페이지네이션 관점 문제 없음.
- `POST /integrations/oauth/begin` 의 reauthorize/request-scopes 모드에 대해 컨트롤러 단(사전 판정, `requireModifiable`)과 콜백 커밋 직전(재판정, `assertRequesterStillAllowed`) 이중으로 인가를 확인해 TOCTOU(락 획득 전후 권한 변경) 를 방어한다. `pending_install` 행은 설치 플로우 특성상 의도적으로 재판정에서 제외되며 이는 테스트로 커버된다.
- `:id` 경로 핸들러 전수를 리플렉션으로 열거해 신규 라우트가 판정 없이 추가되는 것을 막는 캐너리(`integrations.controller.owner.spec.ts`)와, 동일 invariant 를 실제 HTTP 계층에서 검증하는 e2e(`integration-personal-owner.e2e-spec.ts`)가 함께 존재해 회귀 방지 체계가 튼튼하다.
- 에러 응답은 `{code, message}` 형태로 일관되며(`RESOURCE_NOT_FOUND`/`ADMIN_REQUIRED`/`NOT_A_MEMBER`), HTTP 상태 코드(403/404/409/400)도 기존 컨벤션과 맞는다. 존재하지 않는 통합과 "보이지 않는" 통합(남의 personal)이 동일한 404 로 응답해 리소스 존재 여부를 노출하지 않는 설계도 적절하다.
- 요청 검증: `OAuthBeginDto.integrationId` 는 `@IsUUID('all')` 로 검증되고, `UpdateScopeDto.scope` 는 `@IsIn([...])` 로 제한되는 등 기존 검증 수준이 유지된다.
- 워크플로우 어시스턴트 모듈(`candidate-lookup`, `explore-tools`, `assistant-tool-router`, `assistant-finish-guard`, `workflow-assistant-stream`)의 `userId` 스레딩은 REST API 표면이 아닌 내부 서비스 시그니처 변경이며, 모든 호출부가 함께 갱신되어 있어 내부 계약 불일치는 없다. `userId` 는 컨트롤러에서 JWT(`user.sub`)로부터만 주입되고 클라이언트 입력을 신뢰하지 않는다.

## 요약
이번 변경은 통합(Integration) 리소스에 personal/organization 가시성·인가 규칙을 도입하는 보안 강화 성격의 API 계약 변경이다. 목록·상세·정책 관련 엔드포인트의 실제 동작(다른 멤버의 personal 통합 은닉, Organization 통합 변경의 Admin 요구, precheck 응답의 조건부 필드 생략)이 달라지지만, 모두 spec(§8)에 근거한 의도된 변경이고 Swagger 문서·프런트 사용자 문서(ko/en)·컨트롤러 리플렉션 캐너리·e2e 테스트로 빈틈없이 뒷받침된다. 에러 응답은 `{code, message}` 형식과 적절한 HTTP 상태 코드를 일관되게 유지하며, 404/403 판정 순서도 정보 노출을 최소화하도록 설계되어 있다. 유일한 잠재적 하위 호환성 이슈는 (1) 목록/상세에서 다른 멤버의 personal 통합이 사라지는 동작 변화와 (2) Admin 권한 부족 403 의 `code`가 `FORBIDDEN`→`ADMIN_REQUIRED`로 바뀐 것인데, 둘 다 문서화되어 있고 같은 리포의 프런트만 소비자로 보여 실무 위험은 낮다. 차단할 Critical/Warning 사항은 없다.

## 위험도
LOW
