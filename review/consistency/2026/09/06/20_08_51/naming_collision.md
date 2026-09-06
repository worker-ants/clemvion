# 신규 식별자 충돌 검토 — naming_collision

대상: `spec/2-navigation/` (impl-done, diff-base `origin/main`). 이 스코프 자체의 spec 델타는 0파일이지만, 코드 diff(23파일/2769줄) 중 `spec/2-navigation/2-trigger-list.md`(trigger endpoint 충돌 처리)의 `code:` 에 걸리는 `triggers.controller.ts`/`triggers.service.ts` 변경분이 있어, 그 변경이 도입한 신규 식별자를 기존 spec·코드 사용처와 대조했다. 확인은 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`)를 절대경로로 직접 열고 `git diff origin/main...HEAD -- codebase/ .claude/hooks/_lib/review_guard.py spec/conventions/*.md` 로 실제 코드 변경분만 추출해 수행했다.

## 발견사항

- **[WARNING] `WorkflowVersionDetail` 타입명이 frontend/backend 양쪽에 별도 선언 — 형태가 서로 다름**
  - target 신규 식별자: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 의 신규 export `WorkflowVersionDetail` (`Omit<WorkflowVersion, 'creator' | 'workflow'> & { creator: ProjectedCreator }` — `creator: { id, name, email }` 3필드 고정). 이 PR 이전에는 `findOne` 이 이름 없는 `Promise<WorkflowVersion>` 을 반환했으므로 이 이름 자체가 백엔드에는 신규다.
  - 기존 사용처: `codebase/frontend/src/lib/api/workflows.ts` 의 기존 `export interface WorkflowVersionDetail extends WorkflowVersionSummary { snapshot: VersionSnapshot }` — `creator?: { id, name?, email? } | null` (옵셔널·nullable), 이 PR 이전부터 존재.
  - 상세: 공유 타입 패키지를 거치지 않는 손-미러 관계라 이름은 같은데 계약이 갈렸다. 백엔드가 더 좁으므로(3필드 필수) 현재 런타임 오류는 없지만, "이름이 같아서 grep 이 두 자리를 같은 정의로 보여준다"는 문제가 이미 같은 세션에서 여러 라운드 연속 "유일 정의" 오판을 냈다고 두 파일이 스스로 JSDoc 으로 문서화하고 있다(`review/consistency/2026/09/06/15_31_00` W4, `16_29_00` W5, `13_39_25` W3 인용).
  - 확인: 이미 두 파일 모두 상호 참조 JSDoc 주석을 달았고, `plan/in-progress/spec-draft-nullable-notation-followups.md` (line ~650) 에 "developer, 2026-09-06 등재" 로 개명(`WorkflowVersionDetailProjection` 등) 또는 `codebase/packages/` 공유 타입 승격 방안이 체크박스 미해결(`[ ]`) 상태로 트래커에 올라 있다.
  - 제안: 신규 조치 불요 — 이미 tracked. 이 리뷰에서 새로 등재할 필요는 없고, in-progress 체크박스가 유지되는지만 후속 라운드에서 확인.

- **[INFO] 세부 에러 코드 표현 관례(`details.code`) 가 아직 단일 규약으로 정식화되지 않은 채 신규 사용처가 하나 늘었다**
  - target 신규 식별자: `triggers.service.ts` `rethrowEndpointPathConflict()` 가 던지는 `ConflictException({ code: 'RESOURCE_CONFLICT', details: { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' } })` — 단일 object `details.code`.
  - 기존 사용처: (a) `error-codes.md §4.2` + `trigger-parameter.types.ts` 의 **array** 형 `error.details[].code`(`MISSING_REQUIRED_FIELD` 등, 다중 필드용), (b) 저장소 전역에 top-level `code` 자체를 특화 코드로 **교체**하는 선례 7건(`DUPLICATE_NODE_LABEL`·`WORKFLOW_VERSION_CONFLICT`·`ALREADY_A_MEMBER` 등).
  - 상세: 같은 `details.code` 키가 "array 항목의 세부 사유" 와 "단일 object 의 세부 코드" 두 형태로 이미 쓰이고 있고, `2-api-convention.md §5.3` 이 어느 쪽이 기본 관례인지 명문화하지 않는다. 이번 PR 은 spec 문구(`2-trigger-list.md` 의 "409 RESOURCE_CONFLICT (세부 코드 …)")를 "top-level 은 그대로 두고 details 에 세분화" 로 해석했는데, 다수 선례(7건)는 top-level `code` 자체를 교체하는 쪽이라 다음 구현자가 또 다른 선택을 할 위험이 있다. 동일 문자열이 다른 의미로 쓰여 즉시 오동작하는 CRITICAL 형 충돌은 아니다(엔드포인트별 응답 스코프가 분리돼 실제 파싱 충돌은 없음) — "같은 키 이름, 다른 구조적 관례"가 반복되는 패턴에 대한 명확화 이슈.
  - 확인: `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "planner, 2026-09-06 등재, `review/consistency/2026/09/06/14_59_49` W1" 로 `2-api-convention.md §5.3` 택일 기준 정식화 + `3-error-handling.md §1` 카탈로그 등재가 이미 체크박스 미해결 상태로 트래커에 있다.
  - 제안: 신규 조치 불요 — 이미 tracked.

## 확인했으나 충돌 없음(참고)

- `TRIGGER_ENDPOINT_PATH_CONFLICT` / `details.field='endpoint_path'` — `spec/2-navigation/2-trigger-list.md §3`·`§2.3.1` 이 명시한 문구와 코드가 정확히 일치(신규 도입이 아니라 spec 이 먼저 선언했고 코드가 뒤늦게 구현한 케이스). 신규 상수 `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX = 'idx_trigger_workspace_endpoint'` 도 `V002__indexes.sql` 의 실제 인덱스명과 일치하며 다른 곳에서 다른 의미로 쓰이지 않는다.
- `WorkspaceMemberDto.joinedAt`(신규 필드) — spec 본문에 `joinedAt` 을 다른 의미로 쓰는 곳이 없다(전수 grep 0건). 프런트엔드가 이미 `joinedAt: string | null` 로 소비 중이던 wire 필드를 DTO 선언이 뒤늦게 따라잡은 것.
- `pgErrorConstraint` / `isEndpointPathUniqueViolation` / `CREATOR_PROJECTION` / `ProjectedCreator` / `UnloadedRelations` — 전부 저장소에 단일 정의, 기존 식별자와 이름 충돌 없음.
- `user-entity-exposure-guard.ts` / `dto-jsdoc-citation-guard.ts` / `user-secret-absence.ts` 및 그 fixture 경로들 — `codebase/backend/src/repo-guards/__tests__/` 디렉토리는 이 PR 이전부터 존재하는 기존 가드 컨벤션(예: `swagger-dto-contract-guard.ts`, `engine-error-code-anchor-fixture.ts` 등)을 따르는 신규 파일들이며, 같은 이름의 기존 가드/유틸과 충돌하지 않는다.
- 신규 API endpoint·webhook/queue/SSE 이벤트·ENV var — 이번 diff 에 도입된 것이 없다(기존 엔드포인트 `POST/PATCH /api/triggers*` 에 `@ApiConflictResponse` 데코레이터로 기존 계약을 문서화했을 뿐).
- `spec/2-navigation/*.md` 의 `id:` frontmatter 값 — 이번 diff 는 이 영역 spec 파일 자체를 건드리지 않았다(스코프 델타 0).

## 요약

이번 diff가 `spec/2-navigation/`(trigger-list) 에 걸치는 부분(트리거 endpoint 충돌 에러 코드)은 기존 spec 서술과 정확히 일치해 신규 충돌이 없다. 다만 같은 diff가 건드린 인접 영역(`workflow-versions.service.ts`)에서 프런트/백엔드 동명 타입 `WorkflowVersionDetail` 이 서로 다른 형태로 갈라지는 문제(WARNING)와, `details.code` 세부 에러 코드 표현 관례가 두 상이한 선례 사이에서 아직 단일화되지 않은 문제(INFO)가 확인됐다 — 둘 다 개발자·planner 가 이미 코드/문서에 자기-진단 주석을 남기고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 미해결 체크박스로 등재해 두었으므로, 신규로 놓친 충돌이 아니라 이미 추적 중인 항목이다. spec/2-navigation 스코프 자체에서 새로 발견된 차단급 identifier 충돌은 없다.

## 위험도

LOW
