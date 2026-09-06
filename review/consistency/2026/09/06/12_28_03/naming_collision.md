# 신규 식별자 충돌 검토 — naming_collision

## 전제 정정 (실측)

프롬프트 번들의 `## 구현 변경 사항`(`<git diff origin/main...HEAD -- code_areas>`)은 예산 초과로
본문이 생략되어 있었다. 이 검토는 해당 절을 신뢰하지 않고, 지시된 대로 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`)에서
`git diff origin/main...HEAD -- codebase/` 를 직접 실행해 실제 diff(12개 파일, +1396/-10줄)를
읽고 그 안에서 신규 식별자를 전수 추출해 검사했다. `spec/5-system/` 자체의 델타는 0개 파일로,
이 브랜치는 코드 전용 변경(User 엔티티 컬럼 노출 방어)이다.

## 검사한 신규 식별자 목록과 결과

| 신규 식별자 | 도입 위치 | 충돌 검색 결과 |
|---|---|---|
| `CREATOR_PROJECTION` (export const) | `workflow-versions.service.ts` | 정의처 1곳 + 소비처(spec/fixture 주석)만. 충돌 없음 |
| `ProjectedCreator` (export type) | 〃 | 동일 파일 내 정의·사용만. 충돌 없음 |
| `UnloadedRelations` (type, 비공개) | 〃 | 동일 파일 내부만. 충돌 없음 |
| `WorkflowVersionDetail` (export type) | 〃 | 정의 1곳 + 반환형 사용 1곳. 기존 `WorkflowVersionCreatorDto`(pre-existing DTO)와 이름·의미 모두 구분됨 |
| `UserRelationLoad` (export interface) | `repo-guards/__tests__/user-entity-exposure-guard.ts` | 신규 파일 내부 정의·소비만. 충돌 없음 |
| `findEagerUserRelations` / `collectUserRelationNames` / `findUserRelationLoads` | 〃 | 저장소 전역에서 이 파일·그 spec·fixture 주석 외 사용처 없음 |
| `SRC_ROOT` (export const) | 〃 | `nullable-type-lie-cast-guard.ts` 도 동명 상수를 export 하지만 **각자 모듈-scope, 각자의 `.spec.ts` 가 자기 파일에서만 import** — 기존 저장소 관례(가드마다 독립 `SRC_ROOT`)와 동일 패턴. 실질 충돌 없음 |
| `USER_SECRET_KEYS` / `findUserSecretLeaks` / `expectNoUserSecrets` | `shared/testing/user-secret-absence.ts` | 저장소 전역에서 정의처·소비처(3개 e2e) 외 사용 없음 |
| `CreatorProbeController` / route `'probe-wv-creator'` | `workflow-versions.service.spec.ts` | 로컬 테스트 전용 probe, 실제 앱 라우터에 마운트되지 않음(스웨거 문서 빌더 전용). 기존 `swagger-dto-contract.spec.ts` 류와 동일한 격리 패턴. 충돌 없음 |
| `WorkspaceMemberDto.joinedAt` (신규 `@ApiProperty`) | `workspace-response.dto.ts` | `WorkspaceMember` 엔티티(`joinedAt: Date \| null`)·`workspaces.service.ts`·frontend `lib/api/workspaces.ts` 에 **이미 동일 의미로 존재**하던 필드에 뒤늦게 DTO 어노테이션만 붙인 것. 새 의미의 신규 식별자가 아니라 기존 값의 문서화 — 충돌 아님 |
| 파일 경로 6건 (`repo-guards/__tests__/{user-entity-exposure-guard.ts, user-entity-exposure.spec.ts, fixtures/user-eager-relation.fixture.ts, fixtures/user-relation-load.fixture.ts}`, `shared/testing/{user-secret-absence.ts, user-secret-absence.spec.ts}`) | — | 기존 저장소 명명 관례(`<name>-guard.ts` + `<name>.spec.ts` 쌍, `repo-guards/__tests__/fixtures/*.fixture.ts`)와 정확히 일치. 기존 파일과 경로 중복 없음 |
| e2e 테스트 레터 라벨 `'H.'`(`workflow-crud.e2e-spec.ts`, 기존 A~G 뒤) / `'J.'`(`workspace-rbac.e2e-spec.ts`, 기존 A~I 뒤) | — | 각 파일 내 순차 다음 문자. 중복 없음 |

## 요구사항 ID / API endpoint / 이벤트·메시지명 / 환경변수·설정키

- **요구사항 ID**: `spec/5-system/` 델타 0 — 이 diff 는 신규 요구사항 ID 를 부여하지 않는다.
- **API endpoint**: 새 endpoint 없음. 기존 `GET /api/workflows/:wfId/versions/:versionId`,
  `GET /api/workspaces/:id/members` 의 응답 컬럼 투영·필드 노출만 교정한다.
- **이벤트/메시지명**: 해당 없음(webhook/queue/sse 변경 없음).
- **환경변수·설정키**: 해당 없음(신규 ENV/config key 없음).

## 발견사항

없음.

## 요약

이번 diff(`codebase/backend`, 12개 파일)가 도입하는 모든 신규 식별자 — `CREATOR_PROJECTION`,
`ProjectedCreator`, `UnloadedRelations`, `WorkflowVersionDetail`, `UserRelationLoad` 및 그
파생 함수군, `USER_SECRET_KEYS`/`findUserSecretLeaks`/`expectNoUserSecrets`, 신규 가드·픽스처
파일 경로, `WorkspaceMemberDto.joinedAt` 어노테이션, e2e 레터 라벨 — 을 저장소 전역에서
전수 grep 대조했으며 기존 사용처와의 의미 충돌은 발견되지 않았다. 파일 경로는 기존
`repo-guards/__tests__/*-guard.ts` + `*.spec.ts` 쌍 관례와 `shared/testing/*.ts` + `*.spec.ts`
관례를 그대로 따른다. `SRC_ROOT` 라는 동일 이름이 두 가드 파일에 각각 export 되어 있으나
이는 기존 저장소가 채택한 "가드마다 독립 상수" 패턴의 반복이지 이 PR 이 새로 만든 충돌이
아니다. `spec/5-system/` 자체는 이번 브랜치에서 변경되지 않아 요구사항 ID·엔드포인트·환경변수
차원의 신규 도입도 없다.

## 위험도

NONE
