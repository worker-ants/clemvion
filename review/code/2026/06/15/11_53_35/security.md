# 보안(Security) Review — Workflow Test Datasets

## 발견사항

- **[INFO]** JSONB `input` 필드에 대한 크기 제한 없음
  - 위치: `codebase/backend/src/modules/workflow-test-datasets/dto/create-workflow-test-dataset.dto.ts` — `input: Record<string, unknown>`, `codebase/backend/src/modules/workflow-test-datasets/dto/update-workflow-test-dataset.dto.ts` — `input?: Record<string, unknown>`
  - 상세: `@IsObject()` 유효성 검사만 수행하며, 중첩 깊이·총 바이트 크기에 대한 제한이 없다. 악의적 사용자가 매우 큰 JSON payload 를 제출하면 PostgreSQL JSONB 저장 및 직렬화 단계에서 불필요한 자원을 소비할 수 있다 (소프트 DoS). 목록 쿼리에 `.take(200)` 상한이 있고 JSONB 컬럼 자체는 PostgreSQL 에서 1 GB 이상까지 허용되므로 실질적 영향 면에서는 낮은 수준이다.
  - 제안: `@MaxLength` 대신 커스텀 validator 나 `@Transform` 을 통해 직렬화 바이트 크기(예: JSON.stringify 기준 64 KB 또는 128 KB)에 상한을 설정하거나, 서버 수준의 request body 크기 제한(NestJS `app.use(bodyParser.json({ limit: '...' }))`)이 충분한지 확인·문서화한다.

- **[INFO]** `ownerId` 가 응답 DTO에 노출됨
  - 위치: `codebase/backend/src/modules/workflow-test-datasets/dto/responses/workflow-test-dataset-response.dto.ts` — `ownerId: string`
  - 상세: 응답에 소유 유저 UUID(`ownerId`)가 항상 포함된다. `isOwner` 불리언 필드만으로 클라이언트 UI 동작을 결정할 수 있는 경우, UUID 노출은 불필요한 내부 식별자 누출이다. 단, UUID 자체가 민감 정보는 아니며 `visibility=workspace` 공유본을 조회하는 모든 구성원에게 소유자 UUID 가 보이게 된다.
  - 제안: 클라이언트가 `ownerId` 를 실제로 필요로 하는 사용 사례를 검토하여, 불필요한 경우 응답에서 제거하거나 `isOwner` 만으로 대체하는 것을 고려한다.

- **[INFO]** `PATCH /test-datasets/:id` 및 `DELETE /test-datasets/:id` 엔드포인트에서 `workspaceId` 가 헤더(X-Workspace-Id)에서 오는 구조적 특성
  - 위치: `workflow-test-datasets.service.ts` — `findAccessible` 메서드, `workflow-test-datasets.controller.ts` — `@WorkspaceId()` 데코레이터
  - 상세: PATCH/DELETE/clone 시 `workspaceId` 를 클라이언트가 헤더로 제공하는 구조다. `findAccessible` 내에서 `{ id, workspaceId }` 조건으로 격리하므로 다른 workspace 의 데이터셋에는 접근할 수 없다 (e2e 테스트 E 에서도 검증됨). 그러나 workspaceId 를 URL 경로가 아닌 헤더로 받는 패턴은 일관성 검토가 필요하며, `WorkspaceId` 데코레이터가 인증된 JWT 에서 workspace 멤버십을 검증하는지 또는 단순히 헤더 값을 반환하는지에 따라 보안 강도가 달라진다.
  - 제안: `@WorkspaceId()` 데코레이터가 인증 토큰 또는 서버 측 세션 기반으로 workspace 멤버십을 독립적으로 검증하는지 확인한다. 만약 헤더 값을 단순 passthrough 한다면 임의 `workspaceId` 전달이 가능하므로, `Roles('editor')` 가드가 해당 workspace 에 대한 멤버십·역할을 JWT claim 또는 DB 조회로 검증하는지 반드시 확인한다.

## 요약

전반적으로 이번 변경은 보안을 잘 고려한 구현이다. SQL 인젝션은 TypeORM Parameterized Query(`createQueryBuilder` + named parameter)로 방지되어 있고, 입력에 대해 `class-validator` 데코레이터(@IsString, @IsNotEmpty, @MaxLength, @IsObject, @IsEnum)가 적용되어 있다. 인가 모델은 `ownerId` 서버 설정(클라이언트가 owner 를 직접 지정 불가), workspace 격리, private/workspace visibility 체크의 3단계로 구성되어 있으며 비소유 private 접근 시 404 존재 은닉 패턴도 올바르게 적용되었다. 하드코딩된 시크릿·평문 전송·취약 알고리즘·민감 정보 에러 노출은 없다. 남은 주요 위험은 JSONB `input` 필드의 크기 상한 부재(소프트 DoS 가능성)와 `WorkspaceId` 헤더 기반 식별자의 서버 측 멤버십 검증 여부 확인 필요이며, 두 항목 모두 현재 코드 범위 외부(body-parser 설정·가드 구현)의 문제다.

## 위험도

LOW
