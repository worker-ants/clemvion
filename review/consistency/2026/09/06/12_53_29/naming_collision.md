# 신규 식별자 충돌 검토

대상 브랜치(`user-entity-column-defense`)는 `spec/5-system/**` 를 변경하지 않는다(scope 델타 0, 정상). 신규 식별자는 전부 구현 diff(15개 파일, `codebase/backend/src/repo-guards/__tests__/**` · `codebase/backend/src/shared/testing/**` · `workflow-versions.service.ts` · `workspace-response.dto.ts` 등)에서 도입된다. 아래는 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`)를 직접 열어 확인한 결과다.

## 발견사항

- **[WARNING]** `isResponseDtoFile` 함수명이 두 guard 모듈에 동일 이름·동일 구현으로 중복 선언됨
  - target 신규 식별자: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts:46` 의 `export function isResponseDtoFile(file: string): boolean`
  - 기존 사용처: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:260` 에 이미 동일 시그니처·동일 본문(`file.replace(/\\/g, '/').includes('/dto/responses/')`)의 `export function isResponseDtoFile` 이 존재한다(이 브랜치 이전부터 존재, `swagger-dto-contract.spec.ts` 가 소비).
  - 상세: 두 정의는 "다른 의미로 충돌"은 아니다 — 새 파일의 주석("`swagger-dto-contract-guard` 와 같은 판정")이 의도적 재현임을 명시한다. 그러나 두 모듈이 서로 import 하지 않고 각자 로컬로 판정 로직을 복제했으므로, 한쪽만 수정되면(예: 응답 DTO 경로 컨벤션이 `dto/responses/` 에서 바뀌는 경우) 두 검증자의 판정 기준이 조용히 갈라진다. `src/common/__test-utils__/source-scan.ts` 에 이런 공유 술어가 없다는 것도 확인했다 — 재사용할 SoT 가 아예 없다.
  - 제안: `dto-jsdoc-citation-guard.ts` 가 `swagger-dto-contract-guard.ts` 의 `isResponseDtoFile` 을 import 해 재사용하거나, `source-scan.ts` 로 승격해 두 guard 가 같은 정의를 참조하게 한다. 이름을 바꿀 필요는 없다(의미가 같으므로) — 정의 위치만 단일화한다.

- **[INFO]** 신규 검출 3축이 아직 어떤 spec `code:` frontmatter glob 에도 등재되지 않음 (파일 경로 관점)
  - target 신규 식별자(파일 경로): `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` · `user-entity-exposure.spec.ts` · `codebase/backend/src/shared/testing/user-secret-absence.ts` · `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts` · `dto-jsdoc-citation.spec.ts`
  - 기존 사용처: `spec/5-system/2-api-convention.md` §5.4 「검증 층」 표(제9~14행 부근)와 `spec/conventions/swagger.md` §5-1 은 현재 `swagger-dto-contract-guard.ts` / `response-contract.ts` 두 검증자만 "두 검증자" 로 못박아 등재하고 있다. `code:` frontmatter 도 두 파일 glob 뿐이다.
  - 상세: 이름 자체의 충돌은 없다(신규 3파일명이 두 기존 검증자명과 겹치지 않음). 다만 파일 경로/이름이 기존 명명 컨벤션(`<name>-guard.ts` + `<name>.spec.ts`, `repo-guards/__tests__/` 하위)은 정확히 따르고 있어 컨벤션 위반은 아니다 — 순수히 "아직 문서에 등재되지 않았다"는 커버리지 문제다. 이 항목은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 후속 작업으로 self-tracked 되어 있다("신규 검출 2축을 §5.4 「검증 층」과 `code:` 에 등재", 2026-09-06 등재).
  - 제안: naming 관점에서는 조치 불요(이미 plan 에 등재됨, cross_spec/plan_coherence 리뷰어 소관). 다만 그 항목을 반영할 때 "두 검증자" 문구를 그대로 "N개" 로 숫자만 바꾸지 말 것(같은 문서가 이미 이 실수를 반복해 지적받은 이력이 plan 에 적혀 있음).

## 조사했으나 충돌 없음으로 판정한 항목 (근거 기록)

- `USER_SECRET_KEYS` / `findUserSecretLeaks` / `expectNoUserSecrets` (`shared/testing/user-secret-absence.ts`) — 저장소 전체에서 유일한 정의, 다른 의미의 동명 식별자 없음.
- `UserRelationLoad` / `findEagerUserRelations` / `collectUserRelationNames` / `findUserRelationLoads` (`repo-guards/__tests__/user-entity-exposure-guard.ts`) — 유일한 정의. `SRC_ROOT` 상수는 같은 디렉터리의 다른 guard 파일(`nullable-type-lie-cast-guard.ts` 등)에도 모듈-scoped 로 반복되지만, 이는 이 브랜치 이전부터 있던 기존 컨벤션이며 각 파일이 독립 모듈이라 실제 이름 충돌(재수출 시 충돌)은 없다.
- `CREATOR_PROJECTION` / `ProjectedCreator` / `WorkflowVersionDetail` / `UnloadedRelations` (`workflow-versions.service.ts`) — 저장소 전체에서 유일한 정의. `WorkflowVersionCreatorDto` (참조만, 정의는 이 브랜치 이전부터 `workflow-version-response.dto.ts` 에 존재)와 필드 집합이 테스트로 대조되어 있어 의미 충돌 없음.
- `WorkspaceMemberDto.joinedAt` (신규 DTO 필드) — DB 컬럼 `joined_at`(`spec/1-data-model.md`) · 엔티티 `WorkspaceMember.joinedAt` · 서비스 계층(`workspaces.service.ts`, `workspace-invitations.service.ts`)의 기존 `joinedAt` 과 이름·의미가 정확히 일치. 신규 노출이지만 신규 식별자 충돌은 아니다.
- 신규 E2E 테스트가 때리는 엔드포인트(`GET /api/workflows/:wfId/versions/:versionId`, `GET /api/workspaces/:id/members`, `GET /api/audit-logs`) — 전부 기존 엔드포인트에 대한 추가 단언이며, 신규 endpoint/webhook/이벤트/ENV 식별자는 이 diff 에 도입되지 않았다.
- fixture 내부의 `declare class User { id: string }` (`fixtures/user-eager-relation.fixture.ts`) — 실제 `User` 엔티티 import 없이 이름만 재현한 test-only 로컬 선언이며, 대상 guard 가 "이름 문자열"만 비교하는 설계임을 파일 자체가 명시한다. 프로덕션 스캔 범위(`src/modules`) 밖이라 베이스라인에도 안 걸린다 — 의도된 설계.

## 요약

이번 브랜치가 새로 도입하는 식별자(가드 파일명·함수명·타입명·DTO 필드명)는 대체로 기존 `repo-guards/__tests__/<name>-guard.ts` + `<name>.spec.ts` 명명 컨벤션을 정확히 따르고, 다른 의미로 이미 쓰이던 이름과 충돌하는 CRITICAL 사례는 발견되지 않았다. 유일한 주목할 점은 `isResponseDtoFile` 판정 함수가 기존 `swagger-dto-contract-guard.ts` 와 신규 `dto-jsdoc-citation-guard.ts` 양쪽에 동일 이름·동일 로직으로 독립 복제된 것으로, 의미 충돌은 아니지만 향후 두 정의가 조용히 갈라질 드리프트 위험이 있어 WARNING 으로 등재한다. 신규 3축(`user-entity-exposure-guard` 등)이 spec `code:` frontmatter 에 아직 등재되지 않은 점은 이름 충돌이 아니라 커버리지 갭이며, 이미 plan 에 self-tracked 되어 있어 INFO 로만 남긴다.

## 위험도

LOW
