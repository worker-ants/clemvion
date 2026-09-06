# 신규 식별자 충돌 검토

대상 브랜치(`user-entity-column-defense`)는 scope `spec/2-navigation/` 를 변경하지 않는다 (델타
0개 파일 — 코드 전용 PR 이라 정상, 그 자체가 CRITICAL 근거는 아님). 신규 식별자는 전부 구현 diff
(`codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` ·
`codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` ·
`codebase/backend/src/repo-guards/__tests__/{dto-jsdoc-citation-guard,user-entity-exposure-guard}.ts` ·
`codebase/backend/src/shared/testing/user-secret-absence.ts` · 관련 fixture/spec 파일들 ·
`spec/conventions/{review-citations,spec-impl-evidence}.md`)에서 도입된다. 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`)를 절대경로로
직접 열어 `git diff origin/main...HEAD -- codebase/ spec/` 전수 대조했고, 이전 라운드
(`review/consistency/2026/09/06/{13_39_25,13_52_23}/naming_collision.md`)의 결론도 현재 워킹트리
상태로 재검증했다.

## 발견사항

- **[INFO]** 백엔드/프론트엔드 동명 `WorkflowVersionDetail` — 이미 JSDoc 상호 참조로 처분됨 (재확인)
  - target 신규 식별자: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`
    의 `export type WorkflowVersionDetail = Omit<WorkflowVersion, 'creator' | UnloadedRelations> & { creator: ProjectedCreator }`
  - 기존 사용처: `codebase/frontend/src/lib/api/workflows.ts:109` 의
    `export interface WorkflowVersionDetail extends WorkflowVersionSummary { snapshot: VersionSnapshot }`
    — 이 브랜치가 건드리지 않은 `origin/main` 기존 파일 (`git diff origin/main...HEAD -- codebase/frontend/...`
    무출력으로 재확인).
  - 상세: 두 선언은 같은 endpoint(`GET /api/workflows/:wfId/versions/:versionId`)의 같은 개념(버전
    상세 + creator)을 가리켜 "다른 의미로 충돌"은 아니지만, 완전히 동일한 이름이 공유 타입 패키지
    없이 두 레이어에 독립 선언돼 있고 필드 optionality 도 갈려 있다(프론트 `creator?: {...} | null`
    옵셔널 vs 백엔드 `creator: ProjectedCreator` = `Pick<User,'id'|'name'|'email'>` 전부 필수). 현재
    워킹트리에서 백엔드 선언 바로 위 JSDoc 에 "프런트엔드에 같은 이름의 별도 선언이 있다 —
    `codebase/frontend/src/lib/api/workflows.ts` 의 `WorkflowVersionDetail`" 로 시작하는 블록이
    남아 있음을 재확인했다 — 경로·optionality 차이·"개명·공유 패키지화는 이 PR 범위 밖" 명시까지
    포함한다. 이전 라운드(`13_39_25`)가 WARNING 으로 지적한 뒤 그 다음 라운드(`13_52_23`)가 JSDoc
    추가로 처분을 확인했고, 이번 라운드도 동일 상태(주석 유지, 추가 diff 없음)임을 확인했다.
  - 제안: 추가 조치 불요 — 두 자리 모두에서 "이름이 같은 별도 선언" 임이 grep 없이도 드러나므로
    "유일 정의" 오판 위험은 낮다. 다음에 둘 중 하나를 만질 때 이 JSDoc 이 여전히 살아 있는지만
    확인할 것 (개명·공유 패키지화 자체는 이 PR 범위 밖으로 명시돼 있음).

## 조사했으나 충돌 없음으로 판정한 항목 (재확인)

- `SRC_ROOT` — `dto-jsdoc-citation-guard.ts`(신규) · `user-entity-exposure-guard.ts`(신규) ·
  `nullable-type-lie-cast-guard.ts`(기존)에 동명으로 각각 독립 선언(`path.resolve(__dirname, '..', '..')`,
  자기 위치 기준). 각 `*.spec.ts` 는 자기 짝 가드에서만 import — `repo-guards/__tests__/<name>-guard.ts`
  + `<name>.spec.ts` 기존 컨벤션. 실질 충돌 없음.
- `ProjectedCreator` / `CREATOR_PROJECTION` / `UnloadedRelations` — 저장소 전체(프론트 포함) grep
  재확인, 이 파일 외 정의 없음. `WorkflowVersionCreatorDto`(기존, `workflow-version-response.dto.ts`)와
  필드 집합(`id`/`name`/`email`)이 `workflow-versions.service.spec.ts` 로 대조돼 있어 의미 충돌 없음.
- `USER_SECRET_KEYS` / `findUserSecretLeaks` / `expectNoUserSecrets`
  (`shared/testing/user-secret-absence.ts`) — `codebase/{backend,frontend,packages}` 전역에서 이
  파일 외 정의 없음. 값 목록(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·
  `webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`)은
  `user.entity.ts` 실제 컬럼명·`spec/5-system/1-auth.md` 기존 표기와 정확히 일치.
- `UserRelationLoad` / `findEagerUserRelations` / `collectUserRelationNames` / `findUserRelationLoads`
  (`user-entity-exposure-guard.ts`) — 전역 grep 0건(이 파일 외 정의 없음).
- `JsDocCitation` / `findDtoJsDocCitations` / `ViolationClassCitationDto` / `ViolationFieldCitationDto` /
  `CompliantPlainDto` / `CompliantLineCommentDto` / `EagerFixtureEntity` — 전부 신규 가드/fixture
  파일 안에서만 쓰이는 test-only 선언. 프로덕션 스캔 범위(`src/modules/**`) 밖이라 다른 모듈과
  충돌 여지 없음. `isResponseDtoFile` 은 `dto-jsdoc-citation-guard.ts` 가
  `swagger-dto-contract-guard.ts` 에서 import 후 재수출만 하고 로컬 재구현이 없음(이전 라운드
  `12_53_29` W4 이 지적한 중복 정의는 이미 해소됨, 재확인).
- `WorkspaceMemberDto.joinedAt`(신규 API 응답 필드) — DB 컬럼 `joined_at`·엔티티
  `WorkspaceMember.joinedAt`·`workspaces.service.ts`/`workspace-invitations.service.ts` 의 기존
  `joinedAt` 과 이름·의미 정확히 일치. 신규 wire 노출이지만 식별자 충돌 아님.
- 신규 e2e 테스트 라벨 `H`(`workflow-crud.e2e-spec.ts`, 기존 A~G 다음)·`J`(`workspace-rbac.e2e-spec.ts`,
  기존 A~I 다음) — 각 파일 내 유일, 중복 없음.
- 신규 e2e 가 때리는 endpoint(`GET /api/workflows/:wfId/versions/:versionId`,
  `GET /api/workspaces/:id/members`, `GET /api/audit-logs`) — 전부 기존 엔드포인트에 대한 추가
  단언이며, 이 diff 는 신규 endpoint·webhook·큐·SSE 이벤트·ENV var·config key 를 도입하지 않는다.
- `spec/conventions/review-citations.md` / `spec-impl-evidence.md` 편집 — 신규 spec `id` 도입 없음
  (기존 두 문서 본문 정정 + `code:` frontmatter entry 1개 추가 + 인라인 YAML 주석). 신규 파일 경로
  없음, 기존 명명 컨벤션(`spec/<영역>/<n>-<name>.md`, `<basename>` 충돌 시 영역 prefix 회피 패턴)과도
  충돌 없음.
- `.claude/hooks/_lib/review_guard.py` 의 프론트매터 블록 리스트 파서 수정(빈 줄·`#` 주석 skip) —
  신규 식별자 도입 아님, 파싱 로직 버그 수정.

## 요약

이번 브랜치가 새로 도입하는 식별자(가드 파일명·함수명·타입명·DTO 필드명·상수·e2e 라벨)는 기존
`repo-guards/__tests__/<name>-guard.ts` + `<name>.spec.ts` 명명 컨벤션과 spec 이 이미 쓰는 컬럼명
표기를 그대로 따르며, 다른 의미로 이미 쓰이던 이름과 충돌하는 CRITICAL/WARNING 사례는 발견되지
않았다. 유일한 완전 동명 사례(`WorkflowVersionDetail`, 백엔드 신규 vs 프론트엔드 기존)는 같은
개념의 계층 간 수렴이며 이전 라운드에서 지적된 뒤 JSDoc 상호 참조로 이미 처분됐고, 이번 라운드도
그 처분이 유지되고 있음을 재확인해 INFO 로 등재한다. scope(`spec/2-navigation/`)에는 변경이 없어
해당 영역의 요구사항 ID·엔티티명·API endpoint·이벤트명·파일 경로 축에서 볼 신규 충돌 후보 자체가
없다.

## 위험도

NONE
