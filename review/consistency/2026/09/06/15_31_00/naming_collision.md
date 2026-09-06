# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위에 대한 메모

호출 프롬프트는 target 을 `spec/2-navigation/`(impl-done, diff-base `origin/main`)으로 지정했지만,
그 영역의 spec **본문 델타는 0개 파일**이다(프롬프트 자체가 명시). 실제 `origin/main...HEAD` diff(20파일 /
2584줄)는 spec/2-navigation 의 `code:` 프런트매터가 가리키는 코드(`triggers.service.ts`,
`workflow-versions.service.ts`, `workspaces` DTO 등)를 건드리는 **user-entity 노출 방어** PR이다.
따라서 본 리뷰는 워킹트리(`user-entity-column-defense`)를 절대경로로 직접 읽어 그 diff 가 실제로
도입하는 신규 식별자를 대상으로 점검했다 — spec 문서 자체가 새 ID/필드/엔드포인트를 선언한 바는 없다.

---

## 발견사항

- **[WARNING]** 백엔드가 새로 내보내는 타입 `WorkflowVersionDetail` 이 프런트엔드에 이미 있는 동명 타입과 독립적으로 갈라져 있다
  - target 신규 식별자: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 의 `export type WorkflowVersionDetail = Omit<WorkflowVersion, 'creator' | UnloadedRelations> & { creator: ProjectedCreator }` (이번 diff 신설. `ProjectedCreator = Pick<User, 'id'|'name'|'email'>`)
  - 기존 사용처: `codebase/frontend/src/lib/api/workflows.ts:109` `export interface WorkflowVersionDetail extends WorkflowVersionSummary { snapshot: VersionSnapshot }` (기존, 이번 PR 미변경) — `WorkflowVersionSummary.creator?: { id, name?, email? } | null` 로 **옵셔널·부분 필드**
  - 상세: 두 선언 모두 "워크플로우 버전 상세" 라는 같은 개념을 가리키고 공유 타입 패키지를 거치지 않는 손-미러(hand-mirrored)다. 이번 PR 이 백엔드 쪽 `creator` 를 `{id, name, email}` 3필드 **고정**으로 좁혔는데, 프런트엔드 쪽은 여전히 옵셔널/nullable 이라 지금 당장 런타임 깨짐은 없다(넓은 쪽이 좁은 값을 받아도 무해) — 그러나 이름이 같아 `grep`/사람이 "유일 정의"로 오판하는 사고가 **이미 이 세션에서 3라운드 연속** 발생했다(코드 주석이 `review/consistency/2026/09/06/13_39_25` W3 을 직접 인용). 개발자도 코드 주석에 "다음에 이 타입을 만지면 저쪽도 열어라" 라고만 남겼을 뿐, `plan/in-progress/` 에 이 이름 충돌을 추적하는 항목은 없다(검색 결과 0건)
  - 제안: (a) 백엔드 타입을 `WorkflowVersionDetailProjection` 등으로 개명해 프런트 타입과 시각적으로 구분하거나, (b) 두 선언을 공유 타입 패키지(`codebase/packages/**`)로 승격해 SoT 를 하나로 만드는 후속 항목을 `plan/in-progress/`에 정식 등재한다. 최소한 코드 주석의 "다음에 만지면 열어라" 를 plan 항목으로 격상해 추적 가능하게 할 것

- **[INFO]** `error.details` 를 "flat object 의 `code`" 로 쓴 신규 케이스가, 기존 §4.2 의 "array 의 `[].code`" 패턴과 키 이름은 같지만 컨테이너 모양이 다르다 — 단, 이미 별도 plan 항목으로 추적 중
  - target 신규 식별자: `codebase/backend/src/modules/triggers/triggers.service.ts` `rethrowEndpointPathConflict()` 가 던지는 `details: { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }` (flat object 안의 `code`)
  - 기존 사용처: `spec/conventions/error-codes.md §4.2` 의 `error.details[].code`(Trigger 파라미터 검증 사유 — **배열** 항목의 `code`, 값 후보는 `MISSING_REQUIRED_FIELD` 등 고정 레지스트리) / `spec/5-system/2-api-convention.md §5.3` 의 `details: [{ field, message, code: "INVALID_FIELD" }]` (검증 오류 **배열**, `code` 값은 항상 리터럴 `"INVALID_FIELD"`)
  - 상세: 신규 코드는 `TRIGGER_ENDPOINT_PATH_CONFLICT` 라는 값을 담은 `code` 키를 **배열이 아닌 단일 object** 안에 둔다. 동일 `details.code` 경로명이 (1) "검증 배열 항목의 고정 리터럴" 과 (2) "충돌 사유를 나타내는 가변 도메인 서브코드" 라는 두 의미로 갈라질 여지가 있다. 다만 이 정확한 긴장은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` (443~451줄)에 "(1) top-level code 교체 vs (2) `details.code`, 어느 쪽이 기본인지 `api-convention.md §5.3` 이 명문화하지 않는다" 로 선행 등재돼 있어 새로운 blind spot 은 아니다
  - 제안: 별도 조치 불요 — 위 plan 항목이 `2-api-convention.md §5.3` 택일 기준 명문화를 이미 과제로 잡고 있으므로 그 항목 진행 시 함께 정리하면 된다. (fresh CRITICAL/WARNING 으로 재등재하지 말 것)

- **[INFO]** `409 RESOURCE_CONFLICT` 세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT` 자체는 신규 식별자가 아니라 기존 spec 문구의 뒤늦은 구현
  - target 신규 식별자: 없음 — `spec/2-navigation/2-trigger-list.md` §2.3.1(146행)·§3(217행)이 이미 이 문자열을 계약으로 명시하고 있었고, 이번 diff 는 그 문구를 그대로 구현했을 뿐이다 (`git -C <worktree> grep` 결과 spec ↔ 코드 문자열 100% 일치, 다른 의미로 쓰인 곳 없음)
  - 근거: 확인만 하고 문제 없음 표시 목적의 기록 — 다른 checker(rationale_continuity 등)가 이 항목을 "spec 약속 vs 늦은 구현" 으로 이미 다룰 것이므로 naming_collision 관점에서는 충돌 없음(clean)

## 검증해 확인, 충돌 없음으로 판정한 항목 (참고)

아래는 이번 diff 가 도입한 다른 신규 식별자들이며, 저장소 전수 검색 결과 충돌이 없음을 확인했다.

- `pgErrorConstraint` / `isPostgresUniqueViolation` / `pgErrorCode` (`common/db/pg-error.ts`) — 신규 함수 `pgErrorConstraint` 는 이 파일에만 정의되고 `triggers.service.ts` 1곳에서만 소비. 동명 함수 없음
- `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX = 'idx_trigger_workspace_endpoint'` — `V002__indexes.sql` 의 실제 UNIQUE 인덱스명과 정확히 일치, 다른 인덱스명과 충돌 없음
- `ProjectedCreator` / `CREATOR_PROJECTION` / `UnloadedRelations` (`workflow-versions.service.ts`) — 모듈 scope, 동명 export 없음. `CREATOR_PROJECTION` 의 키 집합은 기존 `WorkflowVersionCreatorDto`(사전 존재, 이번 PR 미변경)와 필드 일치가 테스트로 강제됨
- `WorkspaceMemberDto.joinedAt` — 신규 필드지만 `WorkspaceMember` 엔티티·`WorkspacesService`·프런트엔드 `codebase/frontend/src/lib/api/workspaces.ts` 가 이미 같은 이름·같은 의미(`string | null`)로 쓰고 있던 값을 DTO 선언에 뒤늦게 반영한 것 — 충돌 아님, 오히려 정합화
- `USER_SECRET_KEYS` / `expectNoUserSecrets` / `findUserSecretLeaks` (`shared/testing/user-secret-absence.ts`, 신규 파일) — `egress-masking.md`/`secret-store.md` 등 기존 convention 문서에 동명 레지스트리 없음. 유일한 SoT
- `dto-jsdoc-citation-guard.ts` / `user-entity-exposure-guard.ts` (신규, `codebase/backend/src/repo-guards/__tests__/`) — 기존 `swagger-dto-contract-guard.ts`/`audit-action-binding-guard.ts` 등과 같은 `<name>-guard.ts` + `<name>.spec.ts` 명명 컨벤션을 그대로 따르며, `spec/conventions/review-citations.md` + `spec/conventions/spec-impl-evidence.md` 양쪽에 일관되게 등재됨 (이번 diff 가 두 문서를 함께 갱신 — 별도 커밋 21182db02 로 이미 반영 확인)
- e2e 테스트 케이스 레터(`workflow-crud.e2e-spec.ts` 의 `H.`, `workspace-rbac.e2e-spec.ts` 의 `J.`) — 기존 레터(`A.`~`G.`, `A.`~`I.`)와 겹치지 않는 다음 순번

## 요약

target(spec/2-navigation) 자체의 spec 델타는 0이라 spec 레벨의 요구사항ID·API endpoint·이벤트명·ENV
충돌은 발생하지 않는다. 실제 구현 diff(user-entity 노출 방어 PR)가 도입한 신규 식별자 대부분은 기존
DB 인덱스명·기존 DTO 필드 집합·기존 프런트엔드 필드와 대조해 충돌이 없거나 오히려 기존 표류를
정합화했다. 다만 백엔드 `WorkflowVersionDetail` 타입이 프런트엔드의 동명·이형 타입과 손-미러 상태로
갈라져 있는 문제는 이번 PR 이 그 간극을 더 벌렸고(옵셔널→고정 3필드), 이 세션 안에서 이미 3차례
사람의 오판을 유발한 이력이 있는데도 아직 plan 항목으로 추적되지 않는다 — 이것이 유일하게 실질적인
조치가 필요한 항목이다. `details.code` 형태 충돌은 이미 별도 plan 항목이 추적 중이라 재등재하지 않았다.

## 위험도

LOW
