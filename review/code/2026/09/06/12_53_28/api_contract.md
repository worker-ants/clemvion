# API 계약(API Contract) 리뷰

## 개요

이번 diff 는 `User` 엔티티 컬럼 노출을 잡는 검출 가드(구조 축 `user-entity-exposure-guard.ts`,
이름 축 `user-secret-absence.ts`) 신설이 중심이고, 실제 API 표면(응답 스키마·엔드포인트)에
영향을 주는 변경은 다음 둘로 좁혀진다.

1. `WorkflowVersionsService.findOne` — `GET /api/workflows/:wfId/versions/:versionId` 이
   `creator` 관계를 투영 없이 로드해 `User` 전 컬럼(`passwordHash`·`twoFactorSecret`·복구
   코드 등)을 wire 로 내보내던 것을 `CREATOR_PROJECTION`(`id`/`name`/`email`)으로 좁혔다.
2. `WorkspaceMemberDto` 에 `joinedAt: string | null` 필드 추가(`GET /:id/members`).

두 변경 모두 `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`,
`codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` 를 직접
열어 확인했고, 컨트롤러(`workflow-versions.controller.ts`)·소비처
(`workflows.service.ts:666` `restoreVersion`)까지 추적했다.

## 발견사항

- **[INFO]** `findOne` 응답 축소는 breaking change 가 아니라 "선언된 계약과 실제 응답의
  불일치"를 닫는 수정이다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` —
    `findOne` 메서드, `CREATOR_PROJECTION` 상수 선언부
  - 상세: 컨트롤러(`workflow-versions.controller.ts:64` `@ApiOkWrappedResponse(WorkflowVersionDto, ...)`)와
    DTO(`dto/responses/workflow-version-response.dto.ts` `WorkflowVersionCreatorDto` — `id`/`name`/`email`
    3필드만 선언)는 이번 diff 이전부터 이미 3필드만 광고하고 있었다. 실제 런타임이 `User`
    전체를 실었던 것은 **선언과 어긋난 버그**였고, 이번 수정은 런타임을 선언에 맞춘 것이다.
    즉 OpenAPI 스펙을 그대로 따르던 클라이언트는 영향이 없고, 새로 추가된
    `workflow-versions.service.spec.ts` 의 `CREATOR_PROJECTION ↔ WorkflowVersionCreatorDto`
    스키마 대조 테스트가 앞으로 두 선언이 다시 갈리는 것을 막는다. `restoreVersion`
    (`workflows.service.ts:666`)은 `target.snapshot` 만 읽으므로 반환 타입이 `WorkflowVersion`
    → `WorkflowVersionDetail` 로 좁아져도 컴파일·런타임 모두 영향 없음을 확인했다.
  - 제안: 없음 — 이미 계약 준수 방향의 수정이며 회귀 방지 테스트도 갖춰짐.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 추가는 하위 호환되는 additive 필드이며 표현 형태도
  §5.4 규약에 맞다
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` —
    `WorkspaceMemberDto` 클래스, `joinedAt` 필드
  - 상세: `WorkspacesService.listMembers` 가 이미 `joinedAt: m.joinedAt` 을 무조건 실어
    왔으므로(runtime 동작 변경 없음), 이번 변경은 기존에 무선언이던 응답 필드를 DTO 에
    사후 선언한 것뿐이다. `@ApiProperty({ nullable: true, ... })`(옵셔널이 아닌 필수+nullable)로
    "항상 키는 오고 값만 null 일 수 있다"는 §5.4 기본형을 정확히 모델링했다. 기존 소비자에게
    영향 없는 순수 additive 변경.
  - 제안: 없음.

- **[INFO]** 에러 응답·요청 검증·URL 설계·페이지네이션·인증/인가는 이번 diff 로 변경되지 않음
  - 상세: `NotFoundException` 처리, `ParseUUIDPipe` 검증, `assertWorkspaceOwnership` 인가
    체크, 두 엔드포인트의 경로(`/workflows/:wfId/versions[/:versionId]`,
    `/workspaces/:id/members`)는 diff 대상이 아니다. 신규 e2e 테스트(`workflow-crud.e2e-spec.ts`
    `H.`, `workspace-rbac.e2e-spec.ts` `J.`)는 기존 인증/인가 체크를 그대로 통과하는 흐름 위에서
    응답 본문 형태만 추가로 검증한다.
  - 제안: 없음.

## 요약

API 표면에 실제로 닿는 변경은 두 건뿐이다 — (1) `GET /api/workflows/:wfId/versions/:versionId`
가 이미 OpenAPI 로 선언돼 있던 3필드 `creator` 계약에 런타임을 맞춘 보안 수정(선언 대비
과다 노출을 닫은 것이므로 spec 준수 클라이언트에는 breaking 이 아니며, 계약 일치를 강제하는
회귀 테스트가 함께 들어갔다), (2) `WorkspaceMemberDto` 에 이미 wire 로 나가던 `joinedAt` 을
사후 선언한 순수 additive 변경. 두 건 모두 기존 클라이언트와의 하위 호환성을 해치지 않고,
에러 응답·인증/인가·URL 설계·페이지네이션은 이번 diff 로 건드려지지 않았다. API 계약 관점의
Critical/Warning 급 결함은 없다.

## 위험도

LOW
