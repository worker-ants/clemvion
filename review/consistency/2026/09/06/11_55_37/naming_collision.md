# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

target 은 `spec/5-system/`(--impl-done, diff-base `origin/main`)이나, **scope 델타는 0개 파일**이다 —
이 브랜치는 spec 을 바꾸지 않았다. 따라서 "신규 식별자"는 spec 요구사항 ID/엔드포인트/이벤트명이
아니라 **구현 diff(11파일 / 1399줄, `codebase/` + `plan/`)가 도입한 코드 식별자**로 좁혀진다. 워킹
트리(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`)에서
`git diff origin/main...HEAD -- codebase/ plan/` 을 직접 열어 아래 신규 식별자를 전수 확인했다:

- 상수/타입: `CREATOR_PROJECTION`, `ProjectedCreator`, `WorkflowVersionDetail`
  (`workflow-versions.service.ts`)
- DTO 필드: `WorkspaceMemberDto.joinedAt`
- 가드 모듈: `user-entity-exposure-guard.ts` (`SRC_ROOT`, `UserRelationLoad`,
  `findEagerUserRelations`, `collectUserRelationNames`, `findUserRelationLoads`, 내부 헬퍼
  `referencesUserType`/`hasEagerDecorator`/`isUserRelationPath`/`enclosingName`/`unwrap`/
  `userRelationInInitializer`/`hasProjectionFor`) + `user-entity-exposure.spec.ts` +
  `fixtures/user-relation-load.fixture.ts`
- 단언 헬퍼: `user-secret-absence.ts` (`USER_SECRET_KEYS`, `findUserSecretLeaks`,
  `expectNoUserSecrets`) + `user-secret-absence.spec.ts`
- e2e 테스트 라벨: `workflow-crud.e2e-spec.ts` 의 `H.`, `workspace-rbac.e2e-spec.ts` 의 `J.`

각 항목을 저장소 전체(`grep -rn`)로 대조해 충돌 여부를 확인했다.

## 발견사항

이번 diff 범위에서 **CRITICAL/WARNING 급 식별자 충돌은 발견되지 않았다.**

- **[INFO]** `fixtures/` 서브디렉터리 관례와 flat `-fixture.ts` 관례가 `repo-guards/__tests__/` 안에 공존
  - target 신규 식별자: `codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load.fixture.ts`
  - 기존 사용처: 같은 디렉터리의 `audit-action-binding-fixture.ts`·`engine-error-code-anchor-fixture.ts`·
    `eslint-unicorn-peer-fixture.ts` 는 **flat** `<name>-fixture.ts` 패턴을 쓰는 반면, 신규 파일은
    `fixtures/<name>.fixture.ts` 서브디렉터리 패턴을 쓴다(이 패턴 자체는 기존
    `fixtures/dto/responses/optional-nullable.fixture.ts`(`swagger-dto-contract-guard` 용)가 이미
    선례로 갖고 있다).
  - 상세: 이름이 겹치거나 실제로 충돌하지는 않는다 — 두 패턴이 이미 이 디렉터리에 공존해 왔고, 이
    PR 은 그중 후자(서브디렉터리)를 그대로 따랐을 뿐이다. 다만 어느 쪽이 정본인지 명시한 convention
    문서가 없어(`spec/conventions/` 검색 결과 0건) 다음 가드 작성자가 또 다른 조합을 고를 여지가
    남는다.
  - 제안: 이번 PR 범위에서 고칠 필요는 없다(선택한 패턴이 기존 선례와 일치). 다만 `repo-guards`
    관례를 문서화할 기회가 생기면(`spec/conventions/` 또는 헤더 주석) "fixture 는 검증 대상 성격에
    따라 배치"처럼 선택 기준을 한 줄 남기는 것을 권한다 — 이번 리뷰의 차단 사유는 아니다.

## 세부 대조 결과 (충돌 없음 확인)

1. **요구사항 ID** — 신규 spec 요구사항 ID 없음(spec 델타 0). e2e 테스트 라벨 `H`(`workflow-crud.e2e-spec.ts`,
   기존 A~G 다음)·`J`(`workspace-rbac.e2e-spec.ts`, 기존 A~I 다음)는 각 파일 내 순차 다음 문자와
   일치 — 기존 라벨과 충돌 없음.
2. **엔티티/타입명** — `ProjectedCreator`·`WorkflowVersionDetail`·`CREATOR_PROJECTION`·
   `UserRelationLoad`·`USER_SECRET_KEYS` 전부 저장소 전체에서 이 diff 가 도입한 자리 외 사용처
   없음(grep 0건). `WorkflowVersionListItem` 은 기존 타입을 수정한 것(신규 아님). `SRC_ROOT`·
   `unwrap`·`enclosingName` 같은 module-local(비-export 또는 파일 스코프) 이름은
   `nullable-type-lie-cast-guard.ts`·`swagger-dto-contract.spec.ts` 에도 동명이 있으나 각 파일은
   독립 모듈이라 TypeScript 네임스페이스 충돌 없음(기존 저장소가 이미 쓰는 "가드마다 로컬
   `SRC_ROOT` 재정의" 관례와 동형).
3. **API endpoint** — 이 diff 는 신규 endpoint 를 추가하지 않는다. e2e 는 기존
   `GET /api/workflows/:wfId/versions/:versionId`, `GET /api/workspaces/:id/members` 를 대상으로만
   한다.
4. **이벤트/메시지명** — webhook·queue·SSE 이벤트 신규 도입 없음.
5. **환경변수·설정키** — 신규 ENV/config key 없음.
6. **파일 경로** — `WorkspaceMemberDto.joinedAt` 은 신규 필드처럼 보이지만 실제로는 기존
   `workspace_member.joined_at` 컬럼(엔티티 `WorkspaceMember.joinedAt`, `spec/1-data-model.md` §의
   `joined_at | Timestamp?`, `spec/data-flow/12-workspace.md`·`2-auth.md` 의 `joined_at` INSERT
   서술)을 처음으로 DTO 에 노출한 것 — 기존 정의와 **일치**하며 다른 의미로 재사용된 바 없다.
   `user-entity-exposure-guard.ts`/`user-secret-absence.ts` 파일 경로는 각각
   `repo-guards/__tests__/<name>-guard.ts`+`<name>.spec.ts`, `shared/testing/<name>.ts`+`<name>.spec.ts`
   기존 형제 파일들(`audit-action-binding-guard.ts`/`.spec.ts`, `response-contract.ts`/`.spec.ts` 등)과
   동일한 명명 컨벤션을 그대로 따른다 — 컨벤션 위반이나 기존 파일과의 경로 충돌 없음.

## 요약

이 PR 은 spec 을 변경하지 않는 code-only 보안 하드닝 PR(`WorkflowVersion.creator` 유출 차단 +
`User` 엔티티 노출 검출 2축 신설)이며, 도입한 모든 신규 식별자(상수·타입·DTO 필드·가드 모듈·
테스트 라벨·파일 경로)를 저장소 전체 grep 으로 대조한 결과 기존 사용처와의 의미 충돌은 발견되지
않았다. `joinedAt` DTO 필드는 신규가 아니라 기존 엔티티/스키마 정의와 정확히 일치하는 최초 노출이고,
새 가드·헬퍼 파일들은 `repo-guards/__tests__/`·`shared/testing/` 의 기존 명명 관례를 그대로 따른다.
유일하게 언급할 만한 것은 fixture 배치 방식(서브디렉터리 vs flat)이 이미 두 갈래로 공존한다는
INFO 수준 관찰이며, 이는 이 PR 이 만든 문제가 아니라 기존 저장소 상태의 연장이다. 별도로, 이
가드 2축이 아직 어떤 spec 의 `code:` glob 에도 걸리지 않는다는 점은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 후속 항목(planner, `10_13_23` W1)으로 등재되어
있어 본 리뷰의 신규 발견이 아니다(식별자 충돌이 아니라 spec-linkage 커버리지 문제이므로 본 관점
밖이기도 하다).

## 위험도

NONE
