# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] PATCH/DELETE/clone 경로가 상위 리소스 컨텍스트 없이 flat 경로 사용
- 위치: `workflow-test-datasets.controller.ts` L1004, L1024, L1040
- 상세: 생성/목록은 `GET|POST /workflows/:workflowId/test-datasets` 의 중첩 경로를 쓰지만, 수정·삭제·복제는 `PATCH|DELETE|POST /test-datasets/:id` 처럼 상위 리소스를 생략한다. RESTful 관례에서는 `PATCH /workflows/:workflowId/test-datasets/:id` 형태가 계층 관계를 명시한다. 실용적으로는 `workspaceId`를 헤더(X-Workspace-Id)에서 가져와 격리를 유지하므로 IDOR 위험은 없지만, API 클라이언트 일관성 측면에서 혼재가 발생한다.
- 제안: 중요도 낮음. 현재 설계가 spec(§2.2)에서 명시적으로 채택된 형태라면 INFO 수준으로 유지. 향후 OpenAPI 문서에서 리소스 경로 계층이 불일치로 표기될 수 있음을 감안해 API 문서 description 에 rationale 을 남기면 충분.

### [INFO] 목록 API 에 페이지네이션 없음, 소프트 상한(200행) 미노출
- 위치: `workflow-test-datasets.service.ts` L1647-L1668 (list 메서드), `workflow-test-datasets.controller.ts` L965-L983
- 상세: 목록은 `.take(200)` 하드 리미트를 적용하지만 API 응답에 `totalCount`, `hasMore`, `nextCursor` 등의 페이지네이션 메타가 없다. 응답 배열이 잘려도 클라이언트는 알 방법이 없다. 코드 주석은 "워크플로우당 소수가 정상"이라고 설명하고 있어 의도적 생략이다.
- 제안: 현재 사용 패턴에서 200행 초과가 현실적으로 불가능하다면 INFO 수준으로 유지. 다만 클라이언트가 상한 존재를 인지할 수 있도록 OpenAPI `@ApiOkWrappedArrayResponse` description 에 "최대 200개" 명시를 권장.

### [INFO] `@ApiUnauthorizedResponse` 가 list 에만 선언, create/update/remove/clone 에 누락
- 위치: `workflow-test-datasets.controller.ts` L975, L989-L1059
- 상세: `list` 핸들러에는 `@ApiUnauthorizedResponse`가 있지만 `create`, `update`, `remove`, `clone` 에는 없다. 실제로 모든 엔드포인트가 `@Roles('editor')`와 `@ApiBearerAuth`로 보호되므로 401 응답 가능성은 동일하다. Swagger 문서에서 일부 엔드포인트만 401이 선언된 것으로 나타나 클라이언트 혼란을 줄 수 있다.
- 제안: `create`, `update`, `remove`, `clone`에도 `@ApiUnauthorizedResponse({ description: '인증 실패' })`를 추가하거나, 컨트롤러 클래스 레벨에 공통 데코레이터를 붙여 일관성 확보.

### [INFO] `clone` 엔드포인트에서 `@ApiForbiddenResponse` 누락
- 위치: `workflow-test-datasets.controller.ts` L1040-L1060
- 상세: `clone`은 비소유 private 데이터셋 접근 시 404(존재 은닉)를 반환하므로 403은 실제 발생하지 않는다. 이 정책은 맞다. 그러나 서비스 내부 `findAccessible(requireOwner=false)` 로직이 workspace 격리(`workspaceId`) 검사를 통과한 뒤 404를 던지므로, 다른 워크스페이스의 데이터셋 ID를 가져올 경우에도 404 응답이 반환된다. `@ApiNotFoundResponse` description 에 "없음 또는 비공유 또는 다른 워크스페이스"라고 명시하면 더 정확.
- 제안: `@ApiNotFoundResponse({ description: '없음, 비공유, 또는 다른 워크스페이스' })`로 업데이트. 실제 동작 변경 불필요.

## 요약

변경 코드는 신규 `workflow-test-datasets` 모듈 전체(마이그레이션, 엔티티, DTO, 서비스, 컨트롤러)를 도입한다. API 계약 관점에서 하위 호환성 파괴(breaking change)는 없다(기존 엔드포인트 무변경 신규 추가). 버전 관리는 URL 버전 프리픽스 없이 다른 모듈과 동일한 패턴을 따른다. 요청 검증(class-validator)과 UUID 파이프, 에러 응답(NotFoundException/ForbiddenException/ConflictException의 `code`+`message` 구조), HTTP 상태 코드(201/200/204/400/403/404/409)가 적절히 적용되어 있으며 인증/인가(`@Roles('editor')`)가 전 엔드포인트에 적용된다. 지적 사항은 모두 INFO 수준 — Swagger 문서 일관성(401 데코레이터 부분 누락, NotFound description 세분화)과 목록 상한 미노출이며, 실제 동작 버그나 breaking change는 없다.

## 위험도

LOW
