# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위에 대한 메모

호출 프롬프트는 target 을 `spec/2-navigation/`(impl-done, diff-base `origin/main`)으로 지정했지만,
그 영역의 spec 본문 델타는 **0개 파일**이다(프롬프트 자체가 명시 — 이 브랜치는 그 spec 영역을
바꾸지 않았다. 정상이며 무효 근거 아님). 실제 `origin/main...HEAD` diff(267파일, 그중 production
코드는 20파일/약 2,600줄)는 `User` 엔티티 비밀 컬럼 노출 방어 PR(`user-entity-column-defense`)이며,
`spec/2-navigation/` 의 `code:` frontmatter 가 가리키는 파일 중 `triggers.service.ts` /
`workflow-versions.service.ts` / `workspaces` 관련 DTO·service 를 건드리기 때문에 이 scope 로
라우팅됐다. 따라서 워킹트리(`user-entity-column-defense`)를 절대경로로 직접 읽어 그 diff 가
실제로 도입하는 신규 식별자를 대상으로 점검했다 — spec 문서 자체가 새 ID/필드/엔드포인트를
선언한 바는 없다.

이 세션에서 같은 diff 계열에 대해 naming_collision 검토가 이미 15회 이상 반복됐다
(`review/consistency/2026/09/06/10_13_23` ~ `15_31_00`). 본 라운드는 마지막 커밋
(`fc6208adb`, 15:52:49 — harness 파서 docstring/분기 수정 + plan 항목 등재, production
식별자 신설 없음) 이후 상태를 대상으로 하며, 직전 라운드(`15_31_00`) 이후 naming_collision
관점에서 새로 나타난 식별자는 없다.

---

## 발견사항

- **[INFO]** 백엔드 신규 타입 `WorkflowVersionDetail` 이 프런트엔드 기존 동명 타입과 손-미러 상태 — 이번 라운드에 plan 등재까지 완료되어 WARNING 에서 하향
  - target 신규 식별자: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 의
    `export type WorkflowVersionDetail = Omit<WorkflowVersion, 'creator' | UnloadedRelations> & { creator: ProjectedCreator }`
    (이번 PR 신설, `ProjectedCreator = Pick<User, 'id'|'name'|'email'>` 로 `creator` 3필드 고정)
  - 기존 사용처: `codebase/frontend/src/lib/api/workflows.ts:109` 의
    `export interface WorkflowVersionDetail extends WorkflowVersionSummary { snapshot: VersionSnapshot }`
    (이 PR 이 건드리지 않은 기존 파일, `creator?: { id, name?, email? } | null` 로 옵셔널·부분 필드)
  - 상세: 두 선언은 같은 endpoint(`GET /api/workflows/:wfId/versions/:versionId`)의 같은 개념(버전 상세)을
    가리키는 계층 간(BE service 내부 반환 타입 vs FE API 클라이언트 타입) 자연스러운 수렴이라 "다른 의미로
    충돌"하는 CRITICAL 은 아니다. 다만 완전히 동일한 이름이 공유 타입 패키지 없이 독립 선언돼 있고, 이번
    PR 이 백엔드 쪽만 더 좁혔다(옵셔널 → 고정 3필드) — 이름이 같아 이 세션 안에서만 사람이 3라운드 연속
    "유일 정의"로 오판한 이력이 있다(`13_39_25` 가 정정). 현재 방어는 (1) 백엔드 타입 선언부 JSDoc 의
    상호 참조 문구("프런트엔드에 같은 이름의 별도 선언이 있다"), (2) `fc6208adb` 커밋에서
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 정식 트래커 항목으로 등재
    ("`WorkflowVersionDetail` 동명 미러를 코드 주석에서 트래커로 격상", planner/developer 대상,
    개명 또는 `codebase/packages/` 공유 타입 승격 제안 포함) — 두 가지 모두 확인했다. 직전 라운드
    (`15_31_00`)가 "JSDoc 뿐이고 plan 미등재"를 이유로 WARNING 판정했는데, 그 사이 커밋이 plan 등재를
    완료해 제안 사항이 실행됐으므로 본 라운드는 INFO 로 하향한다.
  - 제안: 추가 조치 불요 — 다음에 두 타입 중 하나를 만질 때 (a) JSDoc 상호 참조 생존 확인,
    (b) plan 트래커 항목(`spec-draft-nullable-notation-followups.md`)의 개명/공유 패키지화 처리 여부만 확인.

- **[INFO]** `TRIGGER_ENDPOINT_PATH_CONFLICT` 세부 코드는 신규 식별자가 아니라 기존 spec 문구의 뒤늦은 구현
  - target 신규 식별자: 없음 — `spec/2-navigation/2-trigger-list.md` §2.3.1(146행)·§3(216행)이 이미
    이 문자열을 "409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`)" 로 계약에 적어
    뒀고, 이번 diff(`triggers.service.ts` 의 `rethrowEndpointPathConflict`)는 그 문구를 그대로 구현했다.
    저장소 전수 검색 결과 spec ↔ 코드 문자열이 정확히 일치하고 다른 의미로 쓰인 곳은 없다.
  - 근거: 충돌 없음(clean) 확인용 기록. `rationale_continuity` 관점("spec 약속 vs 늦은 구현")은
    별도 checker 영역이라 여기서는 다루지 않는다.

## 검증해 확인, 충돌 없음으로 판정한 항목 (참고)

이번 diff 가 도입한 그 외 신규 식별자는 저장소 전수 검색 결과 충돌이 없다.

- `pgErrorConstraint` (`common/db/pg-error.ts`, 기존 `pgErrorCode`/`isPostgresUniqueViolation` 옆에 신설) —
  이 파일에만 정의, `triggers.service.ts` 1곳에서만 소비. 동명 함수 없음.
- `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX = 'idx_trigger_workspace_endpoint'` (`triggers.service.ts`) —
  `migrations/V002__indexes.sql` 의 실제 UNIQUE 인덱스명과 정확히 일치. 다른 인덱스명과 충돌 없음.
- `isEndpointPathUniqueViolation` / `rethrowEndpointPathConflict` — 모듈/클래스 scope, 동명 export 없음.
- `ProjectedCreator` / `CREATOR_PROJECTION` / `UnloadedRelations` (`workflow-versions.service.ts`) —
  모듈 scope, 동명 export 없음. `CREATOR_PROJECTION` 키 집합은 기존 `WorkflowVersionCreatorDto`
  (사전 존재, 이번 PR 미변경)와 필드 일치가 스키마 대조 테스트로 강제됨.
- `WorkspaceMemberDto.joinedAt` — 신규 DTO 필드지만, `spec/1-data-model.md §2.3 WorkspaceMember` 의
  기존 `joined_at | Timestamp?` 필드와 `WorkspacesService`/프런트엔드 `lib/api/workspaces.ts` 가 이미
  같은 이름·같은 의미로 다루던 값을 API DTO 선언에 뒤늦게 반영한 것 — 충돌이 아니라 기존 표류 정합화.
  (nullable 서술과 런타임 도달 가능성의 긴장은 `rationale_continuity`/`convention_compliance` 영역이며
  naming_collision 범위 밖이라 별도 flag 하지 않음.)
- `USER_SECRET_KEYS` / `expectNoUserSecrets` / `findUserSecretLeaks` (`shared/testing/user-secret-absence.ts`,
  신규 파일) — `spec/conventions/egress-masking.md` / `secret-store.md` 등 기존 convention 문서에 동명
  레지스트리 없음. 유일한 SoT.
- `dto-jsdoc-citation-guard.ts` / `user-entity-exposure-guard.ts`
  (`codebase/backend/src/repo-guards/__tests__/`, 신규) — 기존 `swagger-dto-contract-guard.ts` /
  `audit-action-binding-guard.ts` / `nullable-type-lie-cast-guard.ts` 등과 동일한
  `<name>-guard.ts` + `<name>.spec.ts` 명명 컨벤션을 따르며, `spec/conventions/review-citations.md` +
  `spec/conventions/spec-impl-evidence.md` 양쪽에 일관 등재됨(커밋 `21182db02`).
- e2e 테스트 케이스 레터(`workflow-crud.e2e-spec.ts` 의 `H.`, `workspace-rbac.e2e-spec.ts` 의 `J.`) —
  기존 레터(`A.`~`G.`, `A.`~`I.`)와 겹치지 않는 다음 순번.

## 요약

target(`spec/2-navigation/`) 의 spec 본문 델타는 0이라 spec 레벨의 요구사항 ID·API endpoint·
이벤트명·ENV 충돌은 발생하지 않는다. 실제로 그 영역에 code-link 된 파일을 건드리는 구현 diff
(`User` 엔티티 컬럼 노출 방어 PR)가 도입한 신규 식별자는 기존 DB 인덱스명·기존 DTO 필드·기존
데이터 모델 필드·기존 가드 명명 컨벤션과 대조해 충돌이 없거나 오히려 기존 표류(코드-DTO 간
`joinedAt` 불일치 등)를 정합화했다. 유일하게 실질적 긴장이 있던 항목(`WorkflowVersionDetail`
백엔드/프런트엔드 손-미러 동명 타입)은 직전 라운드가 WARNING 으로 지적한 뒤 이번 세션 마지막
커밋(`fc6208adb`)에서 plan 트래커(`spec-draft-nullable-notation-followups.md`) 등재까지 완료되어
제안된 처분이 그대로 실행됐음을 확인했다 — 즉각 조치를 막는 CRITICAL/WARNING 은 없다.

## 위험도

NONE
