# API Contract Review — Background Monitoring API

Branch: `claude/bg-monitoring-api-7c2a91`
Reviewer role: API Contract
Date: 2026-05-15

---

## 발견사항

---

### [WARNING] `BackgroundRunStatus.cancelled` 는 서버에서 절대 반환되지 않음

- **위치**: `background-run-response.dto.ts` L3-8, L127; `background-runs.service.ts` `deriveBackgroundRunStatus()` L342-365
- **상세**: `BackgroundRunStatus` 타입은 `'cancelled'` 를 포함하지만, `deriveBackgroundRunStatus()` 의 반환 분기에는 `pending | running | completed | failed` 네 가지만 존재한다. 현재 코드 경로상 `'cancelled'` 가 반환되는 경로가 없다. 클라이언트가 이 값을 기다리는 switch/case 를 작성할 경우 dead branch 가 된다. 의도적으로 미래를 위해 예약한 값이라면 API 문서(`@ApiProperty enum`)에 `@deprecated` 또는 별도 설명이 필요하고, 의도하지 않은 값이라면 enum 에서 제거해야 한다.
- **제안**: `deriveBackgroundRunStatus()` 에 `'cancelled'` 반환 분기를 추가(예: 메인 Execution 이 cancelled 인 경우)하거나, DTO/타입에서 해당 값을 제거해 실제 계약과 일치시킨다.

---

### [WARNING] cursor 주석이 실제 필드명과 불일치 — 문서 계약 오류

- **위치**: `query-background-run.dto.ts` L8
- **상세**: JSDoc 주석은 `{ lastCreatedAt, lastId }` 라고 기술하지만 실제 `CursorPayload` 인터페이스(`background-runs.service.ts` L26-29)와 인코딩 로직은 `{ s (startedAt), i (id) }` 를 사용한다. DTO 파일은 공개 API 계약의 일부로 Swagger description 에 그대로 노출될 수 있으며, 클라이언트 개발자가 cursor 를 직접 해석하려 할 때 혼란을 준다 (cursor 는 opaque 이지만 디버깅 목적으로 디코딩 시도가 빈번함).
- **제안**: 주석을 `{ s: startedAt (ISO8601), i: nodeExecutionId }` 또는 단순히 `opaque token — 서버 내부 구조에 의존하지 말 것` 으로 수정한다.

---

### [WARNING] `BackgroundRunResponseDto` 가 `{ data: <DTO> }` 이중 래핑 없이 반환됨 — Swagger 문서와 런타임 응답 불일치 위험

- **위치**: `background-runs.controller.ts` L60, `background-run-response.dto.ts` L109; `transform.interceptor.ts` L24-27
- **상세**: 컨트롤러 메서드의 반환 타입은 `Promise<BackgroundRunResponseDto>` 이고, `TransformInterceptor` 는 `data` 키가 없으면 `{ data: <DTO> }` 로 감싸고, `data` 키가 있으면 그대로 통과시킨다. `BackgroundRunResponseDto` 최상위에는 `data` 필드가 없으므로 인터셉터가 `{ data: BackgroundRunResponseDto }` 로 감싼다. 그런데 `BackgroundRunResponseDto.nodeExecutions` 필드는 `BackgroundRunNodeExecutionsPageDto` 타입으로 자체적으로 `{ data, nextCursor, hasMore }` 를 담는다. 결과적으로 실제 wire 형식은 `{ data: { backgroundRunId, ..., nodeExecutions: { data: [...], nextCursor, hasMore }, notifications: [...] } }` 이다.

  `@ApiOkWrappedResponse(BackgroundRunResponseDto)` 는 `{ data: BackgroundRunResponseDto }` 를 문서화하므로 Swagger 스키마와 일치한다. 그러나 `nodeExecutions` 의 내부 cursor 페이지네이션 형태(`{ data, nextCursor, hasMore }`)는 프로젝트 표준 `PaginatedResponseDto` (`{ data[], pagination: { page, limit, totalItems, totalPages } }`)와 다른 별도 구조를 사용한다. 이 자체는 cursor vs offset 설계 차이이므로 API 계약 위반은 아니지만, 동일 `@ApiOkPaginatedResponse` 데코레이터를 사용하지 않아 Swagger에서 다른 계층으로 표시되어 클라이언트 팀에게 혼란을 줄 수 있다.
- **제안**: `nodeExecutions` 필드의 cursor pagination 구조가 기존 offset pagination 과 다름을 API 문서 `description` 에 명시적으로 기술하고, 향후 다른 cursor pagination 엔드포인트가 추가될 경우 `CursorPaginatedResponseDto` 와 전용 `@ApiOkCursorPaginatedResponse` 데코레이터를 공통화한다.

---

### [WARNING] Notification `resourceType` 변경으로 인한 기존 클라이언트 breaking change 가능성

- **위치**: `background-execution.processor.ts` L119-137; `notification-response.dto.ts` L30-31
- **상세**: `background_failure` 타입 알림의 `resourceType` 이 이전 `'execution'` / `resourceId = executionId` 에서 `'background_run'` / `resourceId = backgroundRunId` 로 변경되었다. 변경 후 새로 생성되는 알림에만 적용되며 기존 row 는 `'execution'` 으로 남는다 (processor 내 fallback 로직 L122-124).

  프론트엔드 알림 목록(`sidebar.tsx` L190-196)은 `resourceType` / `resourceId` 를 현재 화면에 직접 사용하지 않으므로 표시 자체는 깨지지 않는다. 그러나 외부 API 소비자(webhook, 서드파티 통합 등)가 `notification.resourceType === 'execution'` 을 조건으로 background 실패를 식별하고 있다면 새 알림이 감지되지 않는다. `NotificationDto.resourceType` 의 `@ApiPropertyOptional` 예시값이 여전히 `'execution'` (L30-31)이라 Swagger 계약과도 불일치한다.
- **제안**: `NotificationDto.resourceType` 의 `example` 과 `description` 을 `'execution' | 'background_run' | ...'` 열거형으로 업데이트하거나, `AllowedResourceType` union type 을 별도 선언해 하위 호환성 명세를 API 문서에 반영한다. 마이그레이션 가이드를 변경 이력 또는 spec 에 기재한다.

---

### [WARNING] `findOne` GET 엔드포인트에서 `workspaceId` 를 `@CurrentUser` 에서만 획득 — Editor+ 역할 검증 없음

- **위치**: `background-runs.controller.ts` L55-67; `background-runs.service.ts` `verifyExecutionAccess()` L180-196
- **상세**: 접근 제어는 `execution.workflow.workspaceId === userWorkspaceId` 비교만으로 구성되어 있다. 요청 명세에 "workspace member with Editor+ OR execution starter" 조건이 있으나 코드에서는 "workspace 소속이기만 하면" 모두 통과한다. Viewer 역할 멤버도 background run 의 `inputData` / `outputData` (민감 데이터가 포함될 수 있음)에 접근 가능하다. 기존 `ExecutionsController` 역시 동일한 패턴(workspaceId 비교만)을 사용하므로 일관성은 있으나, 명세와 구현이 일치하지 않는다.
- **제안**: `RolesGuard` 또는 서비스 내 역할 체크를 추가하거나, 명세에서 "Editor+ OR execution starter" 조건을 삭제해 현재 구현(workspace 멤버이면 허용)과 일치시킨다. 선택 후 Swagger `@ApiNotFoundResponse` description 에도 반영한다.

---

### [INFO] URL 패턴 — 기존 `/executions/:id` 대비 `:executionId` 파라미터명 불일치

- **위치**: `background-runs.controller.ts` L25, L56; `executions.controller.ts` L44, L56
- **상세**: 기존 `ExecutionsController` 는 `@Controller('executions')` + `@Param('id')` 를 사용한다. 새 `BackgroundRunsController` 는 `@Controller('executions/:executionId/background-runs')` + `@Param('executionId')` 를 사용한다. URL 형식은 RESTful 중첩 자원으로 적절하나, 상위 자원의 파라미터 이름이 `id` 에서 `executionId` 로 달라진다. Swagger UI 에서 같은 `Executions` 태그 아래 보이는 다른 엔드포인트들(`/executions/:id`)과 파라미터명이 달라 클라이언트 코드 생성기(OpenAPI Generator 등)가 다른 변수명을 생성한다.
- **제안**: 허용 가능한 수준이나, 기존 패턴 통일 또는 스키마 레벨 `name` 명시로 생성 코드 일관성 확보를 권고한다. 결정을 spec 에 명시한다.

---

### [INFO] `limit` 유효성 검증이 DTO 레이어와 서비스 레이어에 중복 존재

- **위치**: `query-background-run.dto.ts` L28-33 (`@Min(1) @Max(200)`); `background-runs.service.ts` `resolveLimit()` L135-144
- **상세**: class-validator 가 DTO 레벨에서 1~200 범위를 이미 거부하므로 `resolveLimit()` 의 범위 체크는 도달 불가능하다. 동일 검증이 두 곳에 존재해 범위를 수정할 때 한 곳만 바꾸면 불일치가 발생한다. `INVALID_LIMIT` 에러 코드가 실제로 반환되는 경로가 없다 — `@UsePipes(ValidationPipe)` 가 먼저 400 을 반환하되 에러 코드는 `INVALID_LIMIT` 이 아닌 class-validator 기본 포맷을 사용한다.
- **제안**: 서비스의 `resolveLimit()` 범위 체크를 제거하거나, DTO validator 를 제거하고 서비스 단에서만 `INVALID_LIMIT` 를 반환하도록 통일한다. 어느 쪽이든 `INVALID_LIMIT` 코드가 실제로 반환되는지 e2e 테스트로 검증한다.

---

### [INFO] Swagger `@ApiOkWrappedResponse` 가 `BackgroundRunResponseDto` 를 최상위 모델로 등록하지만, 내부 중첩 DTO 들(`BackgroundRunNodeExecutionsPageDto`, `BackgroundRunNotificationDto`)은 자동 참조만으로 등록됨

- **위치**: `background-runs.controller.ts` L45-47; `background-run-response.dto.ts` L70-107
- **상세**: `ApiOkWrappedResponse` 는 `ApiExtraModels(BackgroundRunResponseDto)` 만 적용한다. 중첩 DTO 들은 `type: () => [...]` lazy ref 로 선언되어 있어 Swagger 스키마 생성 시 참조 추적이 정상 동작하면 문제없다. 그러나 NestJS Swagger 플러그인 없이 빌드하는 환경에서는 중첩 타입이 `{}` 로 나타날 수 있다.
- **제안**: `@ApiExtraModels(BackgroundRunNodeExecutionsPageDto, BackgroundRunNodeExecutionDto, BackgroundRunNotificationDto)` 를 컨트롤러 또는 모듈 레벨에 추가해 명시적으로 등록한다.

---

### [INFO] WebSocket `background:run:` 채널 구독 guard 는 workspace 검증만 수행 — 채널 ID(backgroundRunId)가 실제 해당 executionId 에 속하는지 HTTP API 와 다르게 교차 검증하지 않음

- **위치**: `websocket.gateway.ts` L165-181; `background-runs.service.ts` `verifyBackgroundRunOwnership()` L59-78
- **상세**: `verifyBackgroundRunOwnership()` 은 `backgroundRunId → NodeExecution → Execution → Workflow → workspaceId` 를 확인한다. `executionId` 를 파라미터로 받지 않으므로 같은 workspace 내 다른 execution 의 `backgroundRunId` 로도 구독 가능하다. HTTP API 와 달리 cross-execution 구독이 가능해진다. 현재 채널은 이벤트 수신만이므로 데이터 노출 위험은 제한적이나, workspace 경계 내에서 권한 없는 채널 구독 가능성이 있다.
- **제안**: 허용 가능한 수준이지만, 동일 workspace 내 모든 execution 의 background run 을 볼 수 있음을 Swagger/spec 에 명시한다. 또는 WS subscribe payload 에 `executionId` 를 추가해 HTTP API 와 동일 수준의 검증을 수행한다.

---

### [INFO] API 버전 — `/api/v1` 하위 배치, v2 고려사항

- **위치**: `background-runs.controller.ts` L25 (controller prefix `executions/:executionId/background-runs`, 글로벌 prefix `api/v1` 가정)
- **상세**: 현재 엔드포인트는 기존 `/api/v1/executions/:id` 패밀리와 동일 버전에 배치되어 있다. `BackgroundRunResponseDto` 는 새 필드 추가가 하위 호환되지만 `status` enum 에 `cancelled` 가 현재 반환되지 않으면서 포함된 점, 그리고 `nodeExecutions` 의 중첩 cursor 구조가 기존 offset 구조와 다른 점은 향후 스키마 변경 시 breaking change 가능성이 있다. v2 별도 분리보다는 현재 v1 내 신규 자원 추가이므로 버전 충돌은 없다.
- **제안**: 현재 방식 유지. 다만 `BackgroundRunStatus` 에 새 값 추가 또는 `nodeExecutions` 구조 변경 시 semver 정책에 따라 v2 승격을 검토한다.

---

## 요약

새 `GET /api/v1/executions/:executionId/background-runs/:backgroundRunId` 엔드포인트는 RESTful 중첩 자원 설계, NotFound-on-mismatch IDOR 차단, `ParseUUIDPipe` 입력 검증, `@ApiOkWrappedResponse` 기반 Swagger 문서화 등 프로젝트 기존 패턴을 대체로 잘 따른다. 그러나 네 가지 Warning 사항이 API 계약 관점에서 즉시 조치가 필요하다: (1) `BackgroundRunStatus.cancelled` 가 실제로 반환되지 않아 타입 계약이 허위(dead enum value), (2) cursor 주석의 필드명 오류가 문서 계약을 훼손, (3) `background_failure` 알림의 `resourceType` 변경이 기존 `'execution'` 을 기대하는 외부 소비자에게 breaking change 이며 `NotificationDto.resourceType` Swagger 예시값이 갱신되지 않음, (4) 명세상 "Editor+ OR execution starter" 역할 요건이 코드에 구현되지 않아 Viewer 역할도 민감 `outputData` 에 접근 가능. Info 수준 사항들(중복 limit 검증, 중첩 DTO Swagger 등록, WS 채널 cross-execution 구독)은 보완하면 계약 견고성이 높아진다.

## 위험도

MEDIUM
