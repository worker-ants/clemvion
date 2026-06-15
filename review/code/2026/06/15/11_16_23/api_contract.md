# API 계약(API Contract) 리뷰

## 발견사항

### [WARNING] GET /workflows/:workflowId/test-datasets 목록 응답에 `ApiOkWrappedResponse` 미적용
- 위치: `workflow-test-datasets.controller.ts` L973-L976 (`@ApiOkResponse({ type: [WorkflowTestDatasetDto], ... })`)
- 상세: `create` 와 `update` 엔드포인트는 `ApiCreatedWrappedResponse` / `ApiOkWrappedResponse` 커스텀 데코레이터를 사용해 TransformInterceptor 의 `{ data: ... }` 래핑을 Swagger 스펙에 반영한다. 반면 `list` 핸들러는 `@ApiOkResponse({ type: [WorkflowTestDatasetDto] })` — 네이티브 NestJS 데코레이터 — 를 사용하므로, 실제 런타임 응답 형식(`{ data: WorkflowTestDatasetDto[] }`)과 Swagger 문서의 스키마가 불일치한다. e2e 테스트는 `memberList.body.data as Array<...>` 로 래핑된 형식을 예상하고 있어 동작 자체에는 문제 없으나, Swagger 클라이언트 생성 코드가 오작동할 수 있다.
- 제안: `@ApiOkWrappedResponse(WorkflowTestDatasetDto, { isArray: true, description: '데이터셋 목록' })` (또는 프로젝트에서 지원하는 배열형 커스텀 데코레이터)로 교체해 응답 래핑 형식을 Swagger 스펙에 일관되게 노출한다.

### [WARNING] PATCH /test-datasets/:id — URL 설계에서 workflowId 컨텍스트 누락
- 위치: `workflow-test-datasets.controller.ts` L1005 (`@Patch('test-datasets/:id')`)
- 상세: 생성·목록 엔드포인트는 `/workflows/:workflowId/test-datasets` 형태로 워크플로우 계층을 URL 에 명시한다. 그러나 수정(`PATCH`)·삭제(`DELETE`)·복제(`POST .../clone`) 엔드포인트는 `/test-datasets/:id` 형태로 최상위 경로를 사용한다. 이는 REST 계층 설계 일관성 위반이다. Workflow 귀속 리소스를 flat 하게 노출하면 API 클라이언트가 리소스 계층을 파악하기 어렵고, 다른 리소스 ID 와의 충돌 가능성도 생긴다. 다만 서비스 레이어에서 `workspaceId` 기반 격리가 실질적 보안을 담당하므로 breaking security issue 는 아니다.
- 제안: `/workflows/:workflowId/test-datasets/:id` 통합 형식으로 통일하거나, 적어도 workflowId 없는 flat 경로를 의도적 설계 결정으로 spec 에 명시적으로 기록한다. 만약 workflowId 없는 경로를 유지한다면, workspaceId 헤더 격리가 단일 보안 경계임을 문서화한다.

### [INFO] 목록 API 하드 제한(take 200) — 페이지네이션 미제공
- 위치: `workflow-test-datasets.service.ts` L1789 (`.take(200)`)
- 상세: 서비스 코드에서 "데이터셋은 워크플로우당 소수로 유지되는 것이 정상" 이라고 주석으로 근거를 명시했다. API 응답에는 페이지네이션 메타데이터(`total`, `hasMore` 등)가 없어 클라이언트는 200건 이상 존재 여부를 알 수 없다. 현재 운영 시나리오에서는 수용 가능하나, 향후 데이터셋이 누적될 경우 API 클라이언트가 페이지네이션 메타 없이 잘린 목록을 완전한 것으로 오인할 수 있다.
- 제안: 단기적으로는 응답 헤더(`X-Total-Count`) 또는 `{ data: [...], hasMore: boolean }` 래퍼로 잘림 여부를 알릴 것을 권장한다. 장기적으로 200 건 초과 가능성이 생기면 cursor 기반 페이지네이션 도입을 검토한다.

### [INFO] `input` 필드 — 요청 DTO 에 `IsNotEmpty` 검증 미적용
- 위치: `create-workflow-test-dataset.dto.ts` L481 (`@IsObject() input: Record<string, unknown>`)
- 상세: `input` 은 `@IsObject()` 만 적용되어 있다. `{}` 빈 객체는 유효한 값으로 허용(spec 의도와 일치)하므로 Issue 는 아니나, 향후 null 전달 시 `@IsObject()` 는 null 을 통과시킬 수 있다 (class-validator 의 `@IsObject()` 는 null 을 실패시키나, `@IsOptional()` 없이 null 이 전달되면 `@IsNotEmpty()` 가 없으면 빈 통과 가능). 현재는 `IsObject` 가 null 을 reject 하므로 치명적 결함은 아니다.
- 제안: 명시적으로 `@IsNotEmpty()` 를 추가하거나, `@IsObject({ each: false })` 동작을 테스트로 확인해 의도를 문서화한다.

### [INFO] 409 Conflict 에러 응답 코드 키 불일치 가능성
- 위치: `workflow-test-datasets.service.ts` L1903 (`throw new ConflictException({ code: 'DUPLICATE_NAME', ... })`)
- 상세: 컨트롤러 Swagger 문서는 `@ApiConflictResponse({ description: '같은 이름 데이터셋 중복' })` 으로 409 를 선언하나, 실제 에러 바디의 `code` 값(`DUPLICATE_NAME`)은 문서에 노출되지 않는다. e2e 테스트(F 케이스)는 HTTP 409 만 검증하고 바디의 `code` 를 검증하지 않으므로 클라이언트가 `code` 에 따른 분기 로직을 구현할 때 계약이 모호하다.
- 제안: `@ApiConflictResponse` 의 description 에 `code: DUPLICATE_NAME` 을 포함시키거나, 에러 응답 DTO 를 별도로 정의해 Swagger 스키마로 노출한다.

---

## 요약

이번 변경은 `workflow_test_dataset` 테이블과 CRUD + clone 엔드포인트를 신규 추가하는 것이다. 기존 API 에 대한 breaking change 는 없으며, 새 엔드포인트에 JWT 인증(`@ApiBearerAuth`) + Role guard(`@Roles('editor')`) 가 일관되게 적용되어 있다. 에러 응답은 NotFoundException / ForbiddenException / ConflictException 을 명확히 분리해 HTTP 상태 코드를 적절히 사용한다. 다만 목록 응답의 Swagger 래핑 스키마가 실제 런타임과 불일치하는 점(WARNING), 수정·삭제 경로가 생성·목록 경로와 URL 계층 구조가 다른 점(WARNING)이 클라이언트 계약 명확성 관점에서 조치가 권장된다.

---

## 위험도

MEDIUM
