# 신규 식별자 충돌 검토

대상 브랜치(`user-entity-column-defense`)는 `spec/conventions/**` 를 2개 파일(`review-citations.md`·
`spec-impl-evidence.md`, 둘 다 기존 문서의 본문/`code:` frontmatter 수정 — 신규 spec `id` 도입 없음)만
바꾸고, 신규 식별자 대부분은 구현 diff(15개 파일 / 1977줄, 워킹트리
`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense` 를 절대경로로 직접
`git diff origin/main...HEAD -- codebase/` 로 전수 확인)에서 도입된다. 본 라운드는 직전 라운드
(`review/consistency/2026/09/06/13_39_25/naming_collision.md`)가 남긴 유일한 WARNING 의 처분 여부를
재확인하고, 그 사이 diff 에 새로 추가된 식별자가 없는지 다시 훑었다.

## 발견사항

- **[INFO]** 백엔드/프론트엔드 동명 `WorkflowVersionDetail` — 직전 라운드 WARNING 이 처방대로 문서화되어 해소됨
  - target 신규 식별자: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 의
    `export type WorkflowVersionDetail = Omit<WorkflowVersion, 'creator' | UnloadedRelations> & { creator: ProjectedCreator }`
  - 기존 사용처: `codebase/frontend/src/lib/api/workflows.ts:109` 의
    `export interface WorkflowVersionDetail extends WorkflowVersionSummary { snapshot: VersionSnapshot }`
    (이 브랜치가 건드리지 않은 `origin/main` 기존 파일)
  - 상세: 직전 라운드(`13_39_25` 발견사항 #1)가 이 동명 충돌을 WARNING 으로 지적하며 "타입에
    JSDoc 으로 언급을 남기라"고 제안했다. 현재 워킹트리(`git diff` 미커밋 변경 포함)를 다시 열어보니
    `workflow-versions.service.ts` 의 `WorkflowVersionDetail` 선언 바로 위에 **"프런트엔드에 같은
    이름의 별도 선언이 있다"**로 시작하는 JSDoc 블록이 추가돼 있다 — 프론트 파일 경로·필드
    optionality 차이(백엔드는 `{id,name,email}` 3필드 고정, 프론트는 옵셔널)·"개명·공유 패키지화는
    이 PR 범위 밖" 이라는 명시적 스코프 제한까지 정확히 그 제안(a)을 따랐고, 인용도
    `review/consistency/2026/09/06/13_39_25` W3 을 정확히 가리킨다. 두 선언이 여전히 물리적으로
    별개(공유 타입 패키지 없음)라는 사실 자체는 남아 있지만, 이제 두 자리 모두에서 "이름이 같은
    별도 선언"임이 grep 없이도 드러나므로 더 이상 "유일 정의"로 오판될 위험은 낮다.
  - 제안: 추가 조치 불요. 다음에 두 타입 중 하나를 다시 만질 때 이 JSDoc 이 살아있는지만 확인
    (개명·공유 패키지화 자체는 여전히 이 PR 범위 밖으로 명시돼 있음).

## 조사했으나 충돌 없음으로 판정한 항목

- `SRC_ROOT` (export const) — `dto-jsdoc-citation-guard.ts`(신규) · `user-entity-exposure-guard.ts`(신규) ·
  `nullable-type-lie-cast-guard.ts`(기존)에 동명으로 각각 선언. 각 파일이 `path.resolve(__dirname, '..', '..')`
  로 **자기 위치 기준**으로 독립 계산하고, 각 `*.spec.ts` 는 자기 짝 가드 파일에서만 import 하는
  `repo-guards/__tests__/<name>-guard.ts` + `<name>.spec.ts` 기존 컨벤션 — 실질 충돌 없음(직전 라운드
  결론과 동일, 재확인 완료).
- `CREATOR_PROJECTION` / `ProjectedCreator` / `UnloadedRelations` (`workflow-versions.service.ts`) —
  저장소 전체(프론트 포함) grep 재확인, 이 파일 외 정의 없음.
- `USER_SECRET_KEYS` / `findUserSecretLeaks` / `expectNoUserSecrets` (`user-secret-absence.ts`) —
  `codebase/{backend,frontend,packages}` 전역에서 이 파일 외 정의 없음. 값 목록은 `user.entity.ts`
  실제 컬럼명·`spec/5-system/1-auth.md` 기존 표기와 정확히 일치.
- `UserRelationLoad` / `findEagerUserRelations` / `collectUserRelationNames` / `findUserRelationLoads` —
  전역 grep 0건.
- `isResponseDtoFile` — 직전 라운드(`12_53_29`)가 지적했던 중복 정의는 이미 해소: 현재
  `dto-jsdoc-citation-guard.ts` 는 `swagger-dto-contract-guard.ts` 에서 import 후 재수출만 하고
  로컬 재구현이 없다.
- `WorkspaceMemberDto.joinedAt` — DB 컬럼 `joined_at`·엔티티 `WorkspaceMember.joinedAt`·
  `workspaces.service.ts`/`workspace-invitations.service.ts` 의 기존 `joinedAt` 과 이름·의미 정확히
  일치. 신규 wire 노출이지만 식별자 충돌 아님.
- 신규 e2e 테스트 라벨 `H`(`workflow-crud.e2e-spec.ts`, 기존 A~G 다음)·`J`(`workspace-rbac.e2e-spec.ts`,
  기존 A~I 다음, `S` 는 그 이후 별도 시퀀스) — 각 파일 내 유일, 중복 없음(재검증 완료).
- 신규 e2e 가 때리는 endpoint(`GET /api/workflows/:wfId/versions/:versionId`,
  `GET /api/workspaces/:id/members`, `GET /api/audit-logs`) — 전부 기존 엔드포인트에 대한 **추가
  단언**이며, 신규 endpoint·webhook·큐·SSE 이벤트·ENV 식별자는 이 diff 에 도입되지 않았다.
- `spec/conventions/review-citations.md`/`spec-impl-evidence.md` 편집 — 신규 spec `id` 도입 없음
  (기존 두 문서 본문 정정 + `code:` frontmatter 항목 추가·인라인 주석뿐). 파일 경로 충돌 대상 없음.
- fixture 파일(`jsdoc-citation.fixture.ts`, `user-eager-relation.fixture.ts`,
  `user-relation-load.fixture.ts`) 내부 클래스·함수명(`ViolationClassCitationDto`,
  `EagerFixtureEntity`, `violation*`/`compliant*` 등) — 프로덕션 스캔 범위(`src/modules`) 밖
  test-only 선언이라 베이스라인·다른 모듈과 충돌 여지 없음.

## 요약

이번 라운드에서 새로 발견된 CRITICAL/WARNING 급 신규 식별자 충돌은 없다. 직전 라운드(`13_39_25`)가
유일하게 지적했던 `WorkflowVersionDetail` 백엔드/프론트엔드 동명 WARNING 은, 워킹트리의 미커밋
변경분에서 제안된 JSDoc 상호 참조가 정확히 추가되어 처분됐음을 확인했다 — 두 선언이 물리적으로
분리돼 있다는 사실 자체는 남지만 더 이상 "유일 정의"로 오판될 소지가 없어 INFO 로 하향한다. 그 외
가드 파일명·함수명·타입명·DTO 필드명·상수·e2e 라벨은 전부 저장소 전역 grep 으로 재확인했고, 기존
`repo-guards/__tests__/<name>-guard.ts` + `<name>.spec.ts` 명명 컨벤션과 spec 이 이미 쓰는 컬럼명
표기를 그대로 따른다.

## 위험도

LOW
