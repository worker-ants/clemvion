# 신규 식별자 충돌 검토

## 검토 범위에 대한 메모

프롬프트가 명시한 scope(`spec/2-navigation/`)는 `origin/main...HEAD` 델타가 0 파일이었다(정상 — 코드 전용 PR). 실제 구현 델타(21파일/2671줄)는 `User` 엔티티 컬럼 방어(`user-entity-column-defense` 브랜치) 영역이며 `spec/2-navigation/`과 직접 연관은 없다. 아래 검토는 실제 diff(`git diff origin/main...HEAD -- codebase/ spec/`)에서 새로 도입된 식별자를 전수 확인한 결과다.

## 발견사항

- **[WARNING]** 백엔드 신규 타입 `WorkflowVersionDetail` 이 프런트엔드 기존 타입과 완전 동명이며 shape 가 이미 갈려 있다
  - target 신규 식별자: `WorkflowVersionDetail` (`codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:61`, 이 PR 이 새로 export)
  - 기존 사용처: `codebase/frontend/src/lib/api/workflows.ts:109` — `export interface WorkflowVersionDetail extends WorkflowVersionSummary { snapshot: VersionSnapshot }` (이 PR 이전부터 존재, 공유 타입 패키지를 거치지 않는 손-미러)
  - 상세: 두 선언 모두 `GET /workflows/:workflowId/versions/:versionId` 응답을 표현하려는 의도는 같지만 `creator` 필드의 optionality 가 다르다.
    - 백엔드(신규): `creator: ProjectedCreator` = `Pick<User, 'id'|'name'|'email'>` — 3필드 모두 **필수**, non-null.
    - 프런트엔드(기존): `creator?: { id: string; name?: string; email?: string } | null` — 객체 자체가 optional/nullable 이고 `name`/`email` 도 optional.
    현재는 프런트가 더 넓게(더 관대하게) 타입을 잡고 있어 즉시 런타임 오류로는 이어지지 않지만, 두 선언이 **완전히 독립적으로 유지보수**되고 있어 이름이 같다는 이유만으로 "유일 정의"로 오판되기 쉽다. 실제로 백엔드 코드 주석 자체가 "그것이 실제로 세 라운드 연속 '유일 정의' 오판을 만들었다"(`review/consistency/2026/09/06/13_39_25` W3)고 자인하고 있다 — 즉 이 충돌은 이미 최소 3회 다른 검토 세션을 오도한 전력이 있는 살아있는 위험이다.
    비대칭도 있다: 백엔드 파일에는 프런트 쪽 동명 선언을 가리키는 상세 주석이 있으나, 프런트엔드 `workflows.ts:109` 쪽에는 백엔드 동명 타입을 가리키는 참조가 전혀 없다 — 프런트를 먼저 여는 사람은 이 충돌의 존재조차 알 수 없다.
  - 제안: (a) 최소 조치로 프런트엔드 `workflows.ts` 의 `WorkflowVersionDetail` 선언 옆에도 백엔드 동명 타입을 가리키는 역참조 주석을 추가해 비대칭을 해소한다. (b) 근본 조치는 이 PR 범위 밖이라는 backend 주석의 판단에 동의하되, 두 선언을 공유 타입 패키지(`codebase/packages/*`)로 이관하거나 최소한 한쪽을 개명(`BackendWorkflowVersionDetail` 류)해 grep 단일성을 회복하는 후속 작업을 `plan/in-progress/`에 등재할 것을 권장한다.

## 충돌 없음으로 확인된 항목 (참고용)

아래는 신규 식별자이나 검토 결과 기존 사용처와 실제 충돌이 없음을 확인했다 — 오탐 방지를 위해 명시한다.

- `TRIGGER_ENDPOINT_PATH_CONFLICT`(details.code), `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`, `isEndpointPathUniqueViolation`, `rethrowEndpointPathConflict` — `spec/2-navigation/2-trigger-list.md §3`/§2.3.1 이 이미 문서화해 둔 문구(`409 RESOURCE_CONFLICT`, 세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)를 그대로 구현한 것 — 신규 의미 충돌 없음.
- `pgErrorConstraint`(`codebase/backend/src/common/db/pg-error.ts`) — 저장소 전체에서 유일, 기존 `pgErrorCode`/`isPostgresUniqueViolation` 과 명확히 구분되는 신규 이름.
- `WorkspaceMemberDto.joinedAt` — 신규 API 필드처럼 보이나 실제로는 기존 엔티티/DB 컬럼(`workspace_member.joined_at`)을 뒤늦게 DTO 에 노출한 것 — 의미 충돌 없음.
- `ProjectedCreator`, `CREATOR_PROJECTION`, `UnloadedRelations`, `WorkflowVersionListItem`(재정의) — 저장소 전체에서 이 모듈/테스트 파일 외 사용처 없음.
- `USER_SECRET_KEYS`, `findUserSecretLeaks`, `expectNoUserSecrets`(`codebase/backend/src/shared/testing/user-secret-absence.ts`) — 신규 공유 테스트 헬퍼, 기존 동명 식별자 없음.
- `findDtoJsDocCitations`, `JsDocCitation`, `CITATION_PATTERNS`(`dto-jsdoc-citation-guard.ts`) — `isResponseDtoFile` 은 기존 `swagger-dto-contract-guard.ts` 에서 import 재사용(중복 재정의 없음, 코드 주석이 명시적으로 단일 소유를 의도). `SRC_ROOT` 라는 동일 이름의 export const 가 `nullable-type-lie-cast-guard.ts`/`user-entity-exposure-guard.ts`/`dto-jsdoc-citation-guard.ts` 세 파일에 반복되지만, 각 파일이 자기 `__dirname` 기준으로 독립 계산하는 `repo-guards/__tests__/` 디렉토리의 기존 관례이며 모듈 스코프라 충돌 없음(신규 패턴 아님).
- `ViolationFieldCitationDto`, `CompliantLineCommentDto`(`repo-guards/__tests__/fixtures/dto/responses/jsdoc-citation.fixture.ts`) — 테스트 fixture 전용 경로에 격리, 프로덕션 DTO 와 이름 겹침 없음.
- 신규 API endpoint · 신규 audit 이벤트명 · 신규 ENV var/config key · 신규 spec 파일 경로 — diff 전수 확인 결과 이번 PR 에서 신설된 항목 없음(트리거 관련 endpoint/에러코드는 위와 같이 기존 spec 문구의 구현일 뿐 신설이 아님).

## 요약

이번 PR(`user-entity-column-defense`)이 새로 도입한 식별자는 거의 전부 격리된 신규 이름이거나, 이미 spec 이 문서화해 둔 계약을 그대로 구현한 것이어서 신규 식별자 충돌 위험이 낮다. 다만 한 건은 실질적 위험이다 — 백엔드가 새로 export 한 `WorkflowVersionDetail` 타입이 프런트엔드에 이미 존재하는 동명 타입과 shape 가 다르며, 이 이름 충돌은 코드 주석 스스로 인정하듯 이미 세 차례 검토 세션의 오판을 유발한 전력이 있다. 차단 사유는 아니지만(런타임 충돌 없음, 프런트가 더 관대한 상위집합) 구조적 혼동 소지가 남아 있으므로 WARNING 으로 등재한다.

## 위험도
LOW
