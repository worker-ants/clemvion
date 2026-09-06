# API 계약(API Contract) 리뷰

## 개요

이번 diff(`origin/main...HEAD`)의 API 계약 관련 실질 변경은 세 갈래다.

1. `WorkflowVersionsService.findOne` — `creator` 관계를 무투영으로 로드해 `User` 전 컬럼(`passwordHash` 등)이 `GET /api/workflows/:wfId/versions/:versionId` 응답에 그대로 실리던 결함을 `select` 투영(`CREATOR_PROJECTION`)으로 닫음. `WorkflowVersionDto`/`WorkflowVersionCreatorDto` 가 이미 `{id,name,email}` 3필드만 선언하고 있었으므로, 이 수정은 **실제 응답을 기존 선언에 맞춘 것**이지 계약을 새로 좁힌 것이 아니다.
2. `TriggersService` — `(workspace_id, endpoint_path)` UNIQUE 위반 시 `2-trigger-list.md §3` 이 이미 문서화해 둔 `409 RESOURCE_CONFLICT`(세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`) 형태를 실제로 구현. 이전에는 전역 필터가 `details` 없이 `RESOURCE_CONFLICT` 만 던져 **문서한 계약이 구현보다 넓은** 상태였다 — 이번 변경은 그 간극을 메운다.
3. `WorkspaceMemberDto.joinedAt` 필드 신설 — `WorkspacesService.listMembers` 가 이미 wire 로 내보내고 있던(코드 확인: `workspaces.service.ts:223` `joinedAt: m.joinedAt`) 값을 DTO 선언에 반영. 서버가 이미 보내던 필드를 문서화하는 것이므로 하위 호환에 영향 없음.

세 갈래 모두 `codebase/backend/src/shared/testing/response-contract.ts`(선언 대조, `assertMatchesContract`) + `codebase/backend/src/shared/testing/user-secret-absence.ts`(이름 기반 부재, `expectNoUserSecrets`) 두 축으로 e2e/unit 이 검증돼 있다.

## 발견사항

- **[WARNING]** 에러 봉투 `details` 필드가 배열(검증 오류)과 객체(단일 도메인 예외) 두 형태로 쓰이는데, 이번 diff 가 신설한 `TRIGGER_ENDPOINT_PATH_CONFLICT` 형태는 `2-api-convention.md §5.3` 문서상 유일하게 명문화된 배열 스키마(`[{ field, message, code: "INVALID_FIELD" }]`)와 다른, `{ field, code }` **단일 객체** 형태다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `rethrowEndpointPathConflict` 메서드 (`details: { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }`)
  - 상세: `spec/5-system/2-api-convention.md §5.3` 은 `details` 를 "검증 오류 항목은 `{ field, message, code }` 구조" 라고만 서술하고, 예시도 배열(`"details": [ { ... } ]`)이다. 반면 이번에 추가된 트리거 충돌 응답은 `details` 를 **배열이 아닌 단일 객체**로 채우고 `message` 키도 없다. 코드에서 확인한 바로는 `chat-channel` 도메인(`details.statusCode`)도 이미 객체 형태 선례를 갖고 있어 이번 구현이 새로운 위반은 아니고, `ErrorResponseBodyDto.details` 도 `unknown`/`additionalProperties: true` 로 느슨하게 선언돼 있어 OpenAPI 스키마 상 깨지는 계약은 없다. 다만 제네릭 에러 클라이언트(예: `error.details` 를 배열로 가정하고 `.map()`/`.forEach()` 하는 코드)가 향후 이 코드를 만나면 런타임 오류를 낼 위험이 있고, 같은 필드명이 두 형태를 갖는 것은 계약 문서 미비다. 이 갭은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` (443~455행)에 planner 후속 항목("`details` 가 object/array 두 형태인 것도 §5.3 에 미명문화")으로 등재돼 있어 developer 권한(spec 쓰기 불가) 밖의 정당한 처리로 보인다.
  - 제안: 조치는 이미 tracked — 후속 planner 턴에서 `§5.3` 에 "언제 배열/언제 객체" 택일 기준을 명문화할 것. 이번 PR 범위에서 추가 조치 불요.

- **[INFO]** (계약 개선 확인, 조치 불요) `WorkflowVersionsService.findOne` 응답이 이제 선언(`WorkflowVersionDto`)과 실제 값이 일치한다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`findOne` 의 `select: { ..., creator: CREATOR_PROJECTION }`), 대응 e2e `codebase/backend/test/workflow-crud.e2e-spec.ts` (`it('H. 버전 단건 조회 ...')`)
  - 상세: 컨트롤러(`workflow-versions.controller.ts:81`)가 서비스 반환값을 가공 없이 그대로 반환하므로, 이전에는 `creator` 가 `User` 전 컬럼(`passwordHash`·`twoFactorSecret`·복구 코드·토큰 등)을 그대로 실어 DTO 선언(`WorkflowVersionCreatorDto: {id,name,email}`)과 실제 wire 가 어긋나 있었다. 이번 수정으로 값과 선언이 일치하며, `assertMatchesContract`+`expectNoUserSecrets` 두 축 모두 e2e 로 고정됐다. API 계약 관점에서는 순수 개선이며 재조사 불필요.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 이미 wire 로 나가던 값을 문서화한 것으로 하위 호환성 문제 없음
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:81-93`
  - 상세: `WorkspacesService.listMembers`(`workspaces.service.ts:223`)가 `joinedAt: m.joinedAt` 을 무조건 실었으나 DTO 에는 선언이 없었다. `nullable: true` 선언은 엔티티 컬럼이 `NULL` 허용(마이그레이션 `V001__initial_schema.sql:57`)이라는 스키마 사실을 반영한 것이고, 실제 코드 경로(4자리)가 항상 `new Date()` 로 채운다는 점도 §5.4 "기본형" 선택 기준과 일치한다. 신규 필드 추가는 기존 클라이언트를 깨지 않는다(추가적 필드).

## 요약

이번 diff 의 API 계약 관련 변경은 전부 **기존 계약 위반(값이 선언보다 넓거나, 구현이 문서보다 좁던 상태)을 닫는 방향**이며 새로운 breaking change 나 버전 관리 이슈는 없다. `WorkflowVersionsService.findOne` 의 `User` 전 컬럼 유출 수정은 선언(`WorkflowVersionDto`)과 실제 응답을 일치시켰고, 트리거 `endpoint_path` UNIQUE 충돌의 `409 RESOURCE_CONFLICT` + `details.field`/`details.code` 응답은 이미 문서화돼 있었으나 미구현이던 계약을 실제로 구현한 것이다. `WorkspaceMemberDto.joinedAt` 필드 추가도 이미 나가던 값을 사후 선언한 것이라 하위 호환에 영향이 없다. 유일한 실질 지적은 에러 봉투 `details` 필드가 배열(검증)과 객체(단일 도메인) 두 형태를 갖는데 `§5.3` 이 이를 명문화하지 않은 것으로, 이미 planner 후속 항목으로 등재돼 있고 `ErrorResponseBodyDto.details` 가 `unknown` 으로 느슨히 선언돼 있어 실질 breaking 위험은 낮다. 페이지네이션·URL 설계·인증/인가 축은 이번 diff 에서 새 엔드포인트를 도입하지 않아 해당 없음.

## 위험도

LOW
