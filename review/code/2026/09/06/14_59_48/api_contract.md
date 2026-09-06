# API 계약(API Contract) 리뷰

## 대상 요약

이번 diff 의 `codebase/**` 실질 변경은 세 갈래다.

1. `TriggersService` — `(workspace_id, endpoint_path)` UNIQUE 충돌을 `2-trigger-list.md §3` 이 이미 문서화해 둔 `409 RESOURCE_CONFLICT` + `details.field='endpoint_path'` + `details.subCode='TRIGGER_ENDPOINT_PATH_CONFLICT'` 형태로 실제 구현.
2. `WorkflowVersionsService.findOne` — `creator` 관계를 투영 없이 로드해 `User` 전 컬럼(`passwordHash` 등)을 `GET /api/workflows/:wfId/versions/:versionId` 응답으로 내보내던 것을 3필드(`id`/`name`/`email`) 투영으로 좁힘.
3. `WorkspaceMemberDto` — 실제로는 항상 실리고 있었지만 선언이 없던 `joinedAt` 필드를 §5.4 규칙대로 `nullable: true` + `T | null` 로 추가.
4. 나머지(`user-entity-exposure-guard`, `dto-jsdoc-citation-guard`, `user-secret-absence` 등)는 이 세 계약 갭을 검출하기 위한 정적/런타임 가드·e2e 배선으로, API 계약 자체를 바꾸지 않는다.

## 발견사항

- **[INFO]** 트리거 UNIQUE 충돌 응답에 `details` 가 추가됨 — 순수 additive, 하위 호환 유지
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`rethrowEndpointPathConflict`, `isEndpointPathUniqueViolation`)
  - 상세: 상태 코드(409)와 top-level `code`(`RESOURCE_CONFLICT`)는 기존과 동일하고 `details` 객체만 새로 실린다. `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`)가 `resp.code`/`resp.message`/`resp.details` 만 봉투에 복사하므로, `ConflictException({ code, message, details })` 형태가 실제로 wire 에 도달함을 확인했다(`err.getResponse()` 는 전달한 객체를 그대로 반환). 술어를 SQLSTATE 23505 뿐 아니라 인덱스명(`idx_trigger_workspace_endpoint`, `V002__indexes.sql` 실측과 일치)까지 좁혀 다른 UNIQUE 위반의 오분류를 막았고, 반대 방향(다른 인덱스·다른 오류는 그대로 흘려보냄) 단위 테스트도 있다. 스펙(`spec/2-navigation/2-trigger-list.md §3`)과 구현이 이제 일치한다.
  - 제안: 없음 — 이대로 안전.

- **[INFO]** `GET /workflows/:wfId/versions/:versionId` 의 `creator` 응답 형태가 이전(사실상 `User` 전체)보다 좁아짐 — 의도된 보안 수정이며 문서화됨
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`(`findOne`, `CREATOR_PROJECTION`), DTO 는 `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts`(`WorkflowVersionCreatorDto`)
  - 상세: 종전에는 `relations: ['creator']` 만 있고 투영이 없어 `User` 전 컬럼(`passwordHash`·`twoFactorSecret`·복구 코드 등)이 실제로 응답에 실렸다(CHANGELOG 에 명시된 Critical). 이 diff 로 `id`/`name`/`email` 3필드로 좁혔고, 이는 `WorkflowVersionCreatorDto` 가 원래 광고하던 스키마와 일치시키는 방향이다 — 즉 "계약대로 좁힌 것"이지 새로운 계약 축소가 아니다. 형식적으로는 그 유출된 부가 필드에 의존한 소비자가 있었다면 깨지겠지만, 그 자체가 시정 대상인 보안 결함이므로 정당하다. `CREATOR_PROJECTION` 키와 DTO OpenAPI 스키마 프로퍼티를 런타임 스키마 프로브로 대조하는 테스트(`workflow-versions.service.spec.ts`)가 있어 향후 재발(투영-DTO 드리프트)을 잡는다.
  - 제안: 없음 — 이미 계약과 일치·테스트로 고정됨.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 신규 필드가 §5.4 "기본형"(상시 존재 + `null`)을 올바르게 따름
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (`WorkspaceMemberDto.joinedAt`, `@ApiProperty({ format: 'date-time', nullable: true, type: String })`)
  - 상세: `spec/5-system/2-api-convention.md §5.4` 는 상시 존재 필드에 `@ApiProperty({ nullable: true })` + `field: T | null` 을, 키 생략 필드에는 `@ApiPropertyOptional()` + `field?: T`(`| null` 금지)를 요구한다. `WorkspacesService.listMembers` 가 `joinedAt: m.joinedAt` 을 무조건 매핑하므로(`workspaces.service.ts:223` 부근) 키는 항상 온다 — "기본형" 선택이 실측과 맞다. TS 타입(`string | null`)과 `nullable: true` 선언도 일치한다.
  - 제안: 없음.

- **[INFO]** 신규 e2e(`workspace-rbac.e2e-spec.ts` "J", `workflow-crud.e2e-spec.ts` "H", `audit-logs.e2e-spec.ts` 추가 단언)가 계약 검증을 **두 축**(선언 대조 `assertMatchesContract` + 이름 기반 부재 `expectNoUserSecrets`)으로 걸어, 이번에 고친 두 유출 경로(`GET /:id/members`, `GET /workflows/:wfId/versions/:versionId`)에 회귀 테스트가 생겼다. 다른 리뷰어(scope/maintainability)가 이미 지적한 `it()` 라벨(`F.`) 중복은 API 계약 문제가 아니라 테스트 위생 이슈라 본 리뷰의 범위 밖으로 둔다.

- **[INFO]** 버전 관리(스키마/URL 버전) 및 페이지네이션은 이번 diff 의 대상이 아님
  - 상세: 신규 엔드포인트·URL 경로 변경 없음. 목록 API(`GET /:id/members`, `GET /workflows/:wfId/versions`)는 이미 비-페이징 고정 컬렉션으로 기존 관례(`{ data: [...] }`)를 그대로 유지하며 이번 diff 가 그 형태를 건드리지 않았다.

## 요약

이 변경은 새로운 API 표면을 추가하지 않고, 이미 문서화돼 있던 두 계약 갭 — 트리거 UNIQUE 충돌 에러 응답의 `details` 누락과 `WorkflowVersionsService.findOne` 의 `User` 전 컬럼 유출 — 을 스펙에 맞춰 좁히는 수정이다. 에러 응답은 상태 코드·top-level `code` 를 유지한 채 `details` 만 추가하는 순수 additive 변경으로 하위 호환에 문제가 없고, `GlobalExceptionFilter` 를 통해 실제로 wire 에 도달함을 코드 추적으로 확인했다. `creator` 투영 축소는 형식적으로는 응답 형태가 좁아지는 것이지만 유출되던 민감 컬럼을 막는 보안 수정이며 DTO 선언·런타임 스키마 대조 테스트로 드리프트를 방지한다. `WorkspaceMemberDto.joinedAt` 필드 추가는 §5.4 부재-표현 규칙(기본형: 상시 존재 + `nullable`)을 정확히 따랐고 실제 서비스 매핑과 일치한다. URL 설계·페이지네이션·인증/인가는 이번 diff 의 변경 대상이 아니며 기존 패턴을 그대로 유지한다. API 계약 관점에서 CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도

NONE
