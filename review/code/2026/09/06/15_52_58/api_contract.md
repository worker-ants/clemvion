# API 계약(API Contract) 리뷰

## 개요

이번 diff(`origin/main...HEAD`)는 이미 9~10 차례의 `/ai-review`+`/consistency-check` 라운드를
거친 `User` 엔티티 컬럼 노출 방어 작업의 최종 상태다. API 계약에 실질적으로 영향을 주는
변경은 세 갈래이고, 나머지(review_guard.py 하네스 수정, repo-guards 신설 가드·fixture,
review/consistency 산출물, plan/CHANGELOG 문서)는 API 표면과 무관하다.

1. **`TriggersService`** — `(workspace_id, endpoint_path)` UNIQUE 위반 시
   `spec/2-navigation/2-trigger-list.md:164` 가 이미 문서화해 둔
   `409 RESOURCE_CONFLICT`(세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`,
   `details.field='endpoint_path'`) 계약을 실제로 구현. 직접 spec 문구와 구현 코드
   (`triggers.service.ts` `rethrowEndpointPathConflict`)를 대조한 결과 `code`·
   `details.field`·`details.code` 세 값이 문자 그대로 일치한다. 이전에는 전역 필터의
   `isUniqueViolation` 분기가 `details` 없이 `RESOURCE_CONFLICT` 만 던져 **문서한 계약이
   구현보다 넓은** 상태였다.
2. **`WorkflowVersionsService.findOne`** — `creator` 관계를 무투영으로 로드해 `User`
   전 컬럼(`passwordHash` 등)이 `GET /api/workflows/:wfId/versions/:versionId` 응답에
   그대로 실리던 결함을 `select` 투영(`CREATOR_PROJECTION`)으로 닫음.
   `WorkflowVersionDto`/`WorkflowVersionCreatorDto` 는 이미 `{id,name,email}` 3필드만
   선언하고 있었으므로, 이 수정은 **실제 응답을 기존 선언에 맞춘 것**이지 계약을 새로
   좁힌 것이 아니다 — 클라이언트 breaking 없음.
3. **`WorkspaceMemberDto.joinedAt` 필드 신설** — `WorkspacesService.listMembers`
   (`workspaces.service.ts:223`)가 이미 wire 로 내보내고 있던 값을 DTO 선언에 반영한
   추가적(additive) 필드다. `nullable: true` + `field: T | null` 조합이 §5.4 "기본형"
   기준과 일치하고(마이그레이션상 컬럼이 NULL 허용이나 실제 채우는 4자리는 항상
   `new Date()`라는 점을 주석에 실측으로 남김), 하위 호환에 영향 없음.

세 갈래 모두 `response-contract.ts`(`assertMatchesContract`, 선언 대조) +
`user-secret-absence.ts`(`expectNoUserSecrets`, 이름 기반 부재) 두 축으로 e2e/unit 이
검증돼 있다.

## 발견사항

- **[INFO]** (조치 불요, 이미 등재됨) 에러 봉투 `details` 필드의 배열/객체 이형이
  `§5.3` 에 명문화되지 않은 상태로 새 사례가 하나 더 늘었다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 의
    `rethrowEndpointPathConflict` (`details: { field: 'endpoint_path', code:
    'TRIGGER_ENDPOINT_PATH_CONFLICT' }`)
  - 상세: `spec/5-system/2-api-convention.md §5.3` 이 명시하는 `details` 예시는 배열
    (`[{ field, message, code: "INVALID_FIELD" }]`)뿐인데, 이번에 실제로 구현한
    트리거 충돌 응답은 `details` 를 단일 객체로 채우고 `message` 키가 없다. `chat-channel`
    도메인(`details.statusCode`)도 이미 객체 형태 선례가 있고 `ErrorResponseBodyDto.details`
    가 `unknown`/`additionalProperties: true` 로 느슨히 선언돼 있어 OpenAPI 스키마상
    깨지는 계약은 없다. 이 갭은 직전 라운드(`review/code/2026/09/06/15_30_59`)에서 이미
    WARNING 으로 지적됐고 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 planner 후속 항목("`details` object/array 두 형태를 §5.3 에 명문화")으로 등재돼
    처리 중임을 확인했다 — developer 권한(`spec/` 쓰기 불가) 밖의 정당한 처리다. 새로 지적할
    사항은 아니며, 등재된 갭에 사례 하나가 더해졌다는 것만 기록한다.
  - 제안: 조치 불요 — 후속 planner 턴 반영을 기다린다.

- **[INFO]** 트리거 `endpoint_path` UNIQUE 충돌의 409 응답 형태를 실 DB 유니크 제약
  경로로 검증하는 e2e 가 없다 (unit 레벨 mock 검증만 존재)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts`
    (`describe('TriggersService — endpoint_path UNIQUE 충돌 계약')`) — 대응 e2e 부재
    확인: `codebase/backend/test/webhook-trigger.e2e-spec.ts`,
    `codebase/backend/test/trigger-expression.e2e-spec.ts` 어디에도 `RESOURCE_CONFLICT`/
    `409` 관련 케이스 없음(grep 0건).
  - 상세: unit 테스트는 `create`/`update` × 두 wrap 표면(`driverError`/최상위) 4조합 +
    반대방향 대조군(다른 UNIQUE 인덱스는 통과)까지 매우 촘촘하지만, 전부
    `triggerRepo.save` 를 목(mock)으로 reject 시켜 만든 합성 에러다. 실제 PG 유니크
    인덱스(`idx_trigger_workspace_endpoint`)가 던지는 에러가 정말 이 술어가 가정하는
    형태(`driverError.constraint` 또는 top-level `constraint`)와 정확히 일치하는지,
    그리고 `ConflictException` 이 `GlobalExceptionFilter` 를 거쳐 문서한 wire 형태
    그대로 나가는지는 e2e 로 닫히지 않았다. `WorkflowVersionsService`/`WorkspaceMemberDto`
    두 갈래는 각각 신규 e2e(`workflow-crud.e2e-spec.ts` H., `workspace-rbac.e2e-spec.ts`
    J.)로 실 인프라 검증이 있는 것과 대비된다.
  - 제안: `webhook-trigger.e2e-spec.ts` 또는 `trigger-expression.e2e-spec.ts` 에 같은
    `endpointPath` 로 두 번째 webhook 트리거 생성을 시도해 `409`
    + `error.code='RESOURCE_CONFLICT'` + `error.details.field='endpoint_path'` +
    `error.details.code='TRIGGER_ENDPOINT_PATH_CONFLICT'` 를 단언하는 케이스 1건 추가.
    필수는 아니나(unit 커버리지가 이미 충분히 촘촘함), 이 PR 이 다른 두 갈래에는 e2e 를
    붙인 것과 형평이 맞다.

- **[INFO]** (계약 개선 확인, 조치 불요) `WorkflowVersionsService.findOne` 응답이
  이제 선언(`WorkflowVersionDto`)과 실제 값이 일치한다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`
    (`findOne` 의 `select: { ..., creator: CREATOR_PROJECTION }`), 대응 e2e
    `codebase/backend/test/workflow-crud.e2e-spec.ts` (`it('H. 버전 단건 조회 ...')`)
  - 상세: 컨트롤러가 서비스 반환값을 가공 없이 그대로 반환하므로, 이전에는 `creator`
    가 `User` 전 컬럼(`passwordHash`·`twoFactorSecret`·복구 코드·토큰 등)을 그대로
    실어 DTO 선언과 실제 wire 가 어긋나 있었다. 이번 수정으로 값과 선언이 일치하며
    `assertMatchesContract`+`expectNoUserSecrets` 두 축 모두 e2e 로 고정됐다.
  - 제안: 조치 불요.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 이미 wire 로 나가던 값을
  문서화한 것으로 하위 호환성 문제 없음
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:81-93`
  - 상세: 신규 필드는 optional 파라미터가 아니라 응답 DTO 추가 필드이므로 기존 클라이언트를
    깨지 않는다(additive). `nullable: true` 선언·§5.4 기본형 선택 근거도 실측(4자리 전부
    `new Date()`)과 일치한다.
  - 제안: 조치 불요.

## 요약

이번 diff 의 API 계약 관련 변경은 전부 **기존 계약 위반(값이 선언보다 넓거나, 구현이
문서보다 좁던 상태)을 닫는 방향**이며 새로운 breaking change·버전 관리 이슈는 없다.
트리거 `endpoint_path` UNIQUE 충돌의 `409 RESOURCE_CONFLICT` + `details.field`/
`details.code` 응답은 `2-trigger-list.md §3` 이 이미 문서화해 둔 형태를 문자 그대로
구현했고 unit 레벨 대조군(정상/반대방향/두 wrap 표면)이 촘촘하다. `WorkflowVersionsService`
의 `User` 전 컬럼 유출 수정은 선언과 실제 응답을 일치시켰고, `WorkspaceMemberDto.joinedAt`
추가도 이미 나가던 값을 사후 선언한 것이라 하위 호환에 영향이 없다. 새로 지적할 사항은
없으며, 유일하게 언급할 것은 (1) `details` 필드의 배열/객체 이형이 `§5.3` 에 아직
명문화되지 않은 기존 갭이 사례 하나 더 늘었다는 점(이미 planner 등재·조치 불요)과,
(2) 트리거 409 충돌 경로가 unit 은 촘촘하지만 실 DB 를 태우는 e2e 는 아직 없다는 점
(다른 두 갈래와 형평상 권장, 차단 사유 아님)이다. 페이지네이션·URL 설계·인증/인가 축은
이번 diff 가 새 엔드포인트를 도입하지 않아 해당 없음.

## 위험도

LOW
