# API 계약(API Contract) 리뷰

## 개요

이번 변경은 (1) `User` 엔티티 컬럼 노출 방어(구조 축 `user-entity-exposure-guard` + 값 축
`user-secret-absence`)와 그 소비 e2e, (2) `WorkflowVersionsService.findOne` 의 `creator` 투영
누락(전 컬럼 `User` 유출) 수정, (3) `TriggersService` 의 `(workspace_id, endpoint_path)` UNIQUE
충돌을 문서(`2-trigger-list.md §3`)가 이미 약속한 `409 RESOURCE_CONFLICT` + `details.field` +
`details.code` 형태로 실제 발행하도록 만든 수정, (4) `WorkspaceMemberDto.joinedAt` 필드 계약
보정으로 구성된다. `.claude/hooks/_lib/review_guard.py`·`CHANGELOG.md`·`plan/**`·`review/**` 는
harness/문서/과거 산출물이라 API 계약과 무관하다.

## 발견사항

- **[INFO]** 트리거 `endpoint_path` 충돌 응답이 스펙 계약을 실제로 충족하도록 수정됨 (긍정적 확인)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `rethrowEndpointPathConflict`(신설 private 메서드) · `codebase/backend/src/modules/triggers/triggers.controller.ts` `create`/`update` 의 신규 `@ApiConflictResponse`
  - 상세: `spec/5-system/2-trigger-list.md §3` 은 "409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)" 를 계약으로 적어 두었으나, 종전엔 그 문자열이 저장소 어디에도 없어 실제로는 전역 필터의 일반 `RESOURCE_CONFLICT` (details 없음)만 나갔다. 이번 변경은 `triggers.service.spec.ts` 에 `driverError`/`top` 두 wrap 표면 × `create`/`update` 두 경로 조합(4케이스) + "다른 제약이면 그대로 통과" 부정 대조군까지 갖춰 검증한다. `http-exception.filter.ts` 의 봉투 조립 경로(`resp.details` 복사)와 대조해도 실제 wire 에 `details.field`/`details.code` 가 도달함을 확인했다. 컨트롤러의 `@ApiConflictResponse` 설명도 이 형태를 정확히 문서화한다.
  - 제안: 조치 불요 — 문서-구현 정합성 개선.

- **[INFO]** 동일 도메인 세부 에러 코드에 저장소 내 **두 가지 표현 관례**가 공존 — 이미 planner 백로그로 등재됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `rethrowEndpointPathConflict` (`code: 'RESOURCE_CONFLICT'` + `details: { field, code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }`) vs 같은 파일의 기존 7건 선례(`code: 'AUTH_CONFIG_NOT_FOUND'`·`'BOT_TOKEN_INVALID'`·`'CHAT_CHANNEL_SETUP_FAILED'` 등, top-level `code` 자체를 특화)
  - 상세: `2-api-convention.md §5.3` 은 어느 관례가 기본인지 명문화하지 않는다. 이번 PR 은 spec 이 "409 RESOURCE_CONFLICT (세부 코드 …)" 로 두 층을 나눠 적은 문구를 그대로 실현하기 위해 `details.code` 방식을 택했는데, 같은 파일의 다수 선례는 top-level `code` 를 특화 코드로 교체하는 방식이다. 클라이언트가 "충돌의 세부 원인"을 판별하려면 엔드포인트에 따라 `error.code` 를 볼지 `error.details.code` 를 볼지가 달라진다 — API 계약 일관성 관점의 실질적 갭이다. 다만 이는 `plan/in-progress/spec-draft-nullable-notation-followups.md:665-683` 에 "도메인 세부 에러 코드의 표현 방식을 정식화한다" (planner, 2026-09-06 등재, `review/consistency/2026/09/06/14_59_49` W1) 로 이미 등재되어 있고, `details` 가 object/array 두 형태로 쓰이는 것도 같은 항목에 병기돼 있다.
  - 제안: 이번 PR 범위에서 추가 조치 불요(이미 planner 트래커에 있음). `2-api-convention.md §5.3` 갱신 시 택일 기준을 명문화할 것.

- **[INFO]** `TriggersService` 새 SoT(`pgErrorConstraint`)가 같은 클래스의 다른 기존 중복 지점(`integration-oauth.service.ts` 2곳)을 아직 대체하지 않음 — 이미 developer 백로그로 등재됨
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:1268-1272`, `:1827-1831` (cafe24/makeshop 설치 경로) — 이번 diff 에 포함되지 않은 파일
  - 상세: 새로 추출된 `pgErrorConstraint()`(`codebase/backend/src/common/db/pg-error.ts`)는 정확히 `e.constraint ?? e.driverError?.constraint` 형태이고, `integration-oauth.service.ts` 의 두 지점이 이미 손으로 같은 4줄을 반복하며 `isPostgresUniqueViolation` 은 이미 SoT 를 쓰고 있다(둘 다 `constraint` 만 손-작성). 동작 자체는 두 표면을 이미 다 보고 있어 정확하지만, 이 PR 이 만든 "1개 함수로 통일"이라는 명제가 아직 부분적임을 뜻한다. `plan/in-progress/spec-draft-nullable-notation-followups.md:560-573` 에 "developer, 2026-09-06 등재, 의도적 보류(scope 확산 방지)"로 이미 기록돼 있다.
  - 제안: 이번 PR 범위에서 추가 조치 불요. 다음에 그 파일을 건드릴 때 치환.

- **[INFO]** 프런트/백엔드 `WorkflowVersionDetail` 손-미러 타입의 구조 drift — 문서화만 되고 실제 동기화(공유 타입 패키지화)는 이번 PR 범위 밖
  - 위치: `codebase/frontend/src/lib/api/workflows.ts` (`WorkflowVersionDetail`, `creator?: { id, name?, email? } | null`) vs `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`WorkflowVersionDetail`, `creator: ProjectedCreator`(`Pick<User,'id'|'name'|'email'>`, 3필드 고정))
  - 상세: 두 선언은 이름이 같아 grep 으로 "유일 정의"로 오판되기 쉽고(리뷰 이력상 3라운드 연속 오판), 프런트 쪽이 더 넓게(옵셔널) 선언돼 있어 현재는 런타임 오류를 유발하지 않는다. 이번 PR 은 양쪽에 상호 참조 JSDoc 경고만 추가했고, 개명·공유 패키지화는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목으로 명시적으로 defer 되어 있다.
  - 제안: 조치 불요(투명하게 문서화·추적됨). 향후 백엔드 `creator` 계약을 더 좁히거나 넓힐 때는 프런트 선언도 반드시 함께 확인.

- **[INFO]** `WorkflowVersionsService.findOne` 의 `creator` 투영 수정은 보안 버그를 문서화된 계약(`WorkflowVersionCreatorDto` 3필드)에 맞추는 방향이라 하위 호환성 리스크가 낮음
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` `findOne` (`select.creator: CREATOR_PROJECTION`)
  - 상세: 종전엔 `relations: ['creator']` 만 주어 TypeORM 이 `User` 전 컬럼(`passwordHash` 등)을 로드하고 컨트롤러가 가공 없이 반환했다(`GET /api/workflows/:wfId/versions/:versionId`). 이번 수정으로 wire 에 실리는 `creator` 필드 수가 줄어드는데, 이는 이미 선언돼 있던 `WorkflowVersionCreatorDto`(3필드)와 일치시키는 것이므로 *문서화된* 계약 기준으로는 breaking 이 아니다. 신규 e2e(`workflow-crud.e2e-spec.ts` "H." 케이스)가 `creator` 키 집합을 `['email','id','name']` 으로 고정해 검증한다.
  - 제안: 조치 불요.

## 요약

핵심 변경(트리거 endpoint_path 409 계약 실현, `WorkflowVersionsService.findOne` 의 `User` 컬럼 과다 노출 수정, `WorkspaceMemberDto`/`WorkflowVersionDto`/`AuditLogDto` 응답에 대한 선언-대조+이름-기반 이중 검증 e2e 배선)는 모두 API 계약을 문서·DTO 선언에 더 가깝게 맞추는 방향이며 새로운 breaking change 나 검증 누락을 만들지 않는다. 발견한 항목(에러 코드 표현 방식 이원화, `pgErrorConstraint` 부분 적용, 프런트/백엔드 타입 미러 drift)은 모두 이미 이 PR 자신의 문서(spec 주석·`plan/in-progress/spec-draft-nullable-notation-followups.md`)에서 실측·등재·근거와 함께 disclose 되어 있어 추가 조치를 요하지 않는다. 요청 검증·URL 설계·페이지네이션·인증/인가 관점에서는 이번 diff 가 건드리는 표면이 없다.

## 위험도

NONE
