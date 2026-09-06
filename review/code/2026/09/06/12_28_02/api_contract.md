# API 계약(API Contract) 리뷰

## 개요

이번 diff 의 실질적인 API 계약 대상 파일은 두 개다.

- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `findOne` 에
  `creator` 투영(`CREATOR_PROJECTION`)을 추가해 `GET /api/workflows/:wfId/versions/:versionId`
  가 `User` 전 컬럼을 내보내던 것을 이미 선언돼 있던 `WorkflowVersionCreatorDto`(id·name·email)
  집합으로 좁혔다.
- `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` —
  `WorkspaceMemberDto` 에 `joinedAt: string | null`(`nullable: true`) 필드를 추가해, 이미 항상
  wire 로 나가고 있었지만 선언되지 않았던 필드를 문서화했다.

나머지 변경(가드 `user-entity-exposure-guard.ts`/`user-secret-absence.ts`, 관련 fixture·spec,
e2e 3건, CHANGELOG, plan, 과거 리뷰 라운드 아카이브 `review/code/**`·`review/consistency/**`)은
검출용 테스트 인프라·문서·산출물이며 엔드포인트 계약 자체를 정의하거나 바꾸지 않는다.

## 발견사항

- **[INFO]** `WorkflowVersionDetail.creator` 응답 형태가 (버그였던) 전체 `User` 컬럼에서
  선언된 3필드로 좁아진다 — 계약 위반이 아니라 계약을 뒤늦게 충족시키는 방향
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:69-73`
    (`CREATOR_PROJECTION` 상수), `:124-156` (`findOne`)
  - 상세: `WorkflowVersionCreatorDto`(`codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts:3-15`)는 이 PR 이전부터 이미 `id`·`name`·`email` 세 필드만
    광고하고 있었다. 실제 런타임 응답은 투영이 빠져 `User` 전 컬럼(`passwordHash` 등)을 실었으므로
    이번 수정은 *새 계약을 만드는 것*이 아니라 *구현을 기존에 공표된 계약에 맞추는 것*이다.
    따라서 정상적으로 Swagger 문서를 따르던 클라이언트는 영향이 없고, spec 문서
    (`spec/3-workflow-editor/5-version-history.md §7.2`)도 필드 형태를 이미 "포함"으로만
    서술해 갱신이 필요 없다. 다만 (있었다면) 유출된 필드에 실수로 의존한 소비자가 있다면
    그 소비자 입장에서는 breaking change 로 관측된다 — CHANGELOG 가 이 영향(저장·로깅·캐시된
    과거 응답은 회수 불가)을 이미 명시하고 있어 별도 조치는 불요.
  - 제안: 조치 불요. 기록용.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 추가는 하위 호환 유지 additive 변경
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:81-93`
  - 상세: `WorkspacesService.listMembers`(`workspaces.service.ts:199-225`, 이 diff 밖의 기존
    코드)는 이미 `joinedAt: m.joinedAt` 을 무조건 실어 왔다. DTO 선언 추가는 실제 wire 형태를
    바꾸지 않는 순수 문서화이며, 기존 필드 제거·타입 변경·필수화 없이 필드 하나를 얹는 형태라
    OpenAPI 클라이언트 생성기 관점에서도 하위 호환을 깨지 않는다. `nullable: true` 는 스키마
    상 허용치이고 코드 주석이 실제 도달 가능성(`workspace_member` 를 만드는 네 자리가 전부
    `new Date()` 로 즉시 채움)을 실측과 함께 정직하게 밝혀 둬 §5.4 규약(기본형 vs 키 생략형
    구분)과도 일치한다.
  - 제안: 조치 불요.

- **[INFO]** `creator` 관계의 내부 TS 타입이 DTO 선언보다 좁다(non-null) — 안전한 방향의 불일치
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:21`
    (`ProjectedCreator`), `:41-50` (`WorkflowVersionListItem`/`WorkflowVersionDetail`) vs
    `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts:45-49,82-86`
    (`creator?: WorkflowVersionCreatorDto | null`)
  - 상세: 서비스 반환 타입은 `creator: ProjectedCreator`(필수, non-null)인데 DTO 는
    `creator?: ... | null` 로 더 관대하게 선언한다. `created_by` 컬럼이 `NOT NULL`(엔티티
    `@Column({ name: 'created_by' })`, nullable 옵션 없음)이라 실제로 `creator` 가 비는 경로는
    현재 없어 보이지만, DTO 가 실제 보장보다 더 관대한 형태를 광고하는 것은 클라이언트를
    깨뜨리는 방향이 아니라 안전한 방향(넓은 타입 → 좁은 실값)이라 계약 위반은 아니다.
  - 제안: 조치 불요 — 기록용. (참고: 이 DTO 의 optional/nullable 조합 자체는 이번 diff 가
    새로 만든 것이 아니라 기존 선언을 그대로 둔 것이다.)

- **[INFO]** 응답-계약 회귀 테스트가 두 축(선언 대조 + 이름 기반 부재)으로 새로 배선됨
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` 신규 `it('H. 버전 단건 조회 ...')`,
    `codebase/backend/test/workspace-rbac.e2e-spec.ts` 신규 `it('J. GET /:id/members ...')`,
    `codebase/backend/src/modules/workflow-versions/workflow-versions.service.spec.ts:38-52`
    (`CREATOR_PROJECTION` ↔ `WorkflowVersionCreatorDto` OpenAPI 스키마 대조)
  - 상세: 이전에는 두 엔드포인트(`GET /workflows/:wfId/versions/:versionId`,
    `GET /workspaces/:id/members`) 모두 응답 형태를 검증하는 e2e 가 없었다. 이번 diff 가
    `assertMatchesContract`(선언 대조) + `expectNoUserSecrets`(이름 기반 부재) 두 축을 걸고,
    유닛 테스트에서는 투영 상수를 DTO 의 실제 OpenAPI 스키마와 대조해 두 선언이 갈리는 것을
    코드로 막는다. API 계약 관점에서 순수하게 긍정적인 변화다.
  - 제안: 조치 불요 — 긍정적 발견으로 기록.

## 요약

핵심 변경 두 건 모두 새 API 계약을 만들거나 기존 계약을 깨는 것이 아니라, 실제 구현이
**이미 선언돼 있던 계약**(`WorkflowVersionCreatorDto` 3필드)을 지키도록 고치거나, **이미 wire 로
나가던 값**(`joinedAt`)을 문서에 뒤늦게 반영하는 additive 변경이다. 에러 응답 형식
(`NotFoundException` + `{code, message}`)·인증/인가 가드·URL 설계·페이지네이션 정책은 이번
diff 로 변경되지 않았고, 새 요청 파라미터도 없어 요청 검증 항목은 해당하지 않는다. 유일하게
관찰할 만한 지점은 `findOne` 의 `creator` 응답이 (버그였던) 전체 `User` 컬럼에서 문서화된
3필드로 좁아진다는 것인데, 이는 정상적으로 Swagger 계약을 따르던 클라이언트에는 영향이 없고
CHANGELOG 가 그 영향 범위(이미 유출된 과거 응답은 회수 불가)를 투명하게 밝혀 뒀다. 두 엔드포인트
모두 이번 diff 로 처음 응답-계약 e2e 가 배선돼 향후 동일 회귀를 조기에 잡을 수 있게 됐다.

## 위험도
LOW
