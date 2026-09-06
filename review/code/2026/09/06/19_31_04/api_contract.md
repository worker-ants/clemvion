# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 트리거 `endpoint_path` UNIQUE 충돌 — 문서화된 계약을 실제로 구현 (기존 갭 해소, 신규 위반 아님)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:98-101`(`create`), `:127-130`(`update`); 구현은 `codebase/backend/src/modules/triggers/triggers.service.ts:1607`(`rethrowEndpointPathConflict`)·`:222`(`isEndpointPathUniqueViolation`)
  - 상세: `spec/2-navigation/2-trigger-list.md:94,164`가 "409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)"를 계약으로 명시하고 있었는데, 이 문자열이 코드 어디에도 없었다(`GlobalExceptionFilter`의 `isUniqueViolation` 분기는 `details` 없이 `RESOURCE_CONFLICT`만 발행). 이번 변경으로 `TriggersService.create`/`update`가 `(workspace_id, endpoint_path)` UNIQUE 위반(SQLSTATE 23505 + 인덱스명 `idx_trigger_workspace_endpoint`)만 좁혀 잡아 문서한 형태의 409를 던지고, 다른 UNIQUE 위반은 그대로 흘려보낸다(`triggers.service.spec.ts`가 두 방향 모두 테스트). 컨트롤러에 `@ApiConflictResponse` 도 추가돼 OpenAPI 문서와 실제 응답이 일치한다. `GlobalExceptionFilter.catch`에서 `exceptionResponse.code`/`details`가 그대로 top-level로 복사되는 경로도 확인했다 — wire 형태가 스펙과 맞다.
  - 제안: 조치 불요. 하위 호환성 영향 없음(기존에 없던 세부 코드를 `details`에 추가하는 것은 순수 additive).

- **[WARNING]** 도메인 세부 에러 코드 표현 방식이 API 전체에서 두 관례로 갈라져 있다 (이번 PR이 그중 하나를 신규 채택)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1607-1631`(`rethrowEndpointPathConflict` — `details.code='TRIGGER_ENDPOINT_PATH_CONFLICT'` 채택) vs `spec/5-system/3-error-handling.md:88`(`DUPLICATE_NODE_LABEL`)·`:90`(`WORKFLOW_VERSION_CONFLICT`) — 이쪽은 top-level `code` 자체를 특화 코드로 **교체**하는 관례
  - 상세: 저장소에는 이미 "top-level `code` 교체"(7건 선례) 와 "세부 코드는 `details.code`"(`error-codes.md §4.2`, `trigger-parameter.types.ts`) 두 관례가 공존하는데, `spec/5-system/2-api-convention.md §5.3`은 어느 쪽이 기본인지 명문화하지 않는다. 이번 PR은 spec 문구가 "두 층"을 나눠 적었다는 이유로 `details.code` 쪽을 택했다 — 근거는 타당하지만, 클라이언트가 도메인 충돌 종류를 분기할 때 `error.code`만 보는지 `error.details.code`도 봐야 하는지가 엔드포인트마다 달라진다는 사실 자체는 API 소비자 입장에서 실질적인 비일관성이다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:631-649`에 planner 항목("도메인 세부 에러 코드의 표현 방식을 정식화한다")으로 등재돼 있음을 확인했다 — 신규 조치 요구 아님, 다만 다음 planner 턴에서 `§5.3`에 택일 기준이 명문화될 때까지 이 비일관성이 유효함을 SUMMARY에서 놓치지 않도록 표시.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가 — 기존에 이미 나가던 응답 필드의 뒤늦은 선언 (breaking change 아님)
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:82-93`
  - 상세: `WorkspacesService.listMembers`(`workspaces.service.ts:217-224`)는 이미 `joinedAt: m.joinedAt`을 응답 객체에 싣고 있었는데 DTO가 이를 선언하지 않아 `assertMatchesContract` 같은 선언-대조 검증자가 이 키를 못 잡던 상태였다. 이번 PR은 `@ApiProperty({ format: 'date-time', nullable: true, type: String })` + `joinedAt: string | null`로 선언을 추가했다 — §5.4의 "상시 존재 + null 가능" **기본형** 규칙과 정확히 일치(옵셔널 아님, `nullable: true`만). Wire 는 변경되지 않으므로 기존 클라이언트에 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** `WorkflowVersionsService.findOne`의 `creator` 응답 투영 신설 — 응답 스키마 축소(하위 호환 유지)
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:144-166`(`findOne` — `select.creator: CREATOR_PROJECTION`), `:83-87`(`CREATOR_PROJECTION` 상수), `:21`(`ProjectedCreator` 타입)
  - 상세: 종전 `findOne`은 `relations: ['creator']`만 지정해 `User` 엔티티 전 컬럼(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes` 등)을 로드했고 컨트롤러가 이를 가공 없이 반환 — `GET /api/workflows/:wfId/versions/:versionId`가 실제로 비밀 컬럼을 wire 로 노출하던 상태였다(자매 메서드 `findByWorkflow`는 처음부터 투영이 있었음). 이번 변경으로 `creator`가 `{id, name, email}` 3필드로 좁혀진다. 새 e2e(`workflow-crud.e2e-spec.ts` "H." 케이스)가 계약 대조(`assertMatchesContract`) + 이름 기반 부재(`expectNoUserSecrets`) + 3필드 양성 확인 세 축으로 회귀를 막는다. 응답 필드가 **줄어드는** 방향이라 기존에 그 여분 필드를 실제로 소비하던 클라이언트가 있었다면 그 필드들은 사라지지만, 그것들은애초에 노출되면 안 됐던 비밀 컬럼이라 하위 호환 예외로 정당화된다.
  - 제안: 조치 불요. 다만 이미 알려진 잔여 항목(아래) 확인.

- **[INFO]** `WorkflowVersionListItemDto`/`WorkflowVersionDto`의 `creator` 필드가 §5.4 금지 조합(`@ApiPropertyOptional({nullable:true})` + `creator?: T | null`)을 그대로 두고 있다 — 이번 PR 대상 파일 아님, 이미 등재된 부채
  - 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` (`WorkflowVersionListItemDto.creator`, `WorkflowVersionDto.creator` — 이번 diff에 포함되지 않은 파일)
  - 상세: 이번 PR이 서비스 레이어의 런타임 타입을 `creator: ProjectedCreator`(항상 존재, 3필드 필수)로 좁혔으나, OpenAPI DTO 선언은 여전히 optional+nullable 이중 표기라 "선언이 런타임보다 넓다." `plan/in-progress/spec-draft-nullable-notation-followups.md:694-712`에 이미 developer 항목으로 등재돼 있고(`swagger-dto-contract.spec.ts`의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 래칫으로 동결 중), 프런트엔드 `codebase/frontend/src/lib/api/workflows.ts:109-123`의 손-미러 `WorkflowVersionDetail`(옵셔널/nullable `creator`)과의 형태 불일치도 같은 항목에 묶여 있다.
  - 제안: 조치 불요(이미 계획됨). 신규로 발견된 문제 아님 — 회귀 아님을 확인만 함.

## 요약

이번 변경분(트리거 `endpoint_path` 409 계약 구현, `WorkflowVersionsService.findOne`/`listMembers` 응답에서 `User` 비밀 컬럼 노출 차단, `WorkspaceMemberDto.joinedAt` 선언 추가)은 모두 API 계약을 **기존보다 정확하게** 만드는 방향이다 — spec에 문서화됐으나 미구현이던 409 계약을 실제로 발행하게 했고, wire에 이미 나가던 필드(`joinedAt`)의 선언 누락을 메웠으며, DTO 선언보다 넓게 새고 있던 응답(`User` 전 컬럼)을 선언 수준으로 좁혔다. 세 변경 모두 새 e2e/spec으로 회귀 방지가 걸려 있고 하위 호환성 파괴(breaking change)는 없다 — `joinedAt` 추가는 순수 additive, `creator` 투영 축소는 애초에 노출되면 안 됐던 비밀 필드 제거라 예외적으로 정당하다. 유일하게 남는 것은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 등재된 두 계약 부채(도메인 세부 에러 코드의 top-level `code` vs `details.code` 표현 방식 비일관성, `WorkflowVersion*Dto.creator`의 §5.4 금지 조합)인데 둘 다 이번 PR이 새로 만든 것이 아니라 사전에 추적 중인 항목이다. 버전 관리·URL/경로 설계·페이지네이션·인증/인가 관점에서는 이번 diff가 건드리는 엔드포인트에 새로운 문제를 발견하지 못했다(기존 가드 데코레이터 유지, 신규 엔드포인트 없음).

## 위험도

LOW
