# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `GET /executions/:id` 및 `GET /executions/workflow/:workflowId` — 워크스페이스 소유권 미검증
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:56-79`
  - 상세: `findOne`(`GET :id`)과 `findByWorkflow`(`GET workflow/:workflowId`)는 workspaceId 검증 없이 실행 ID만으로 조회한다. `stop`·`continue` 뮤테이션 엔드포인트는 `verifyOwnership()`을 호출하지만, 읽기(GET) 엔드포인트에는 해당 검증이 누락돼 있다. 서비스 레이어의 주석("컨트롤러의 가드/미들웨어에서 수행한다")이 명시돼 있으나 실제로 컨트롤러에서 워크스페이스 파라미터를 넘기지 않는다. 다른 워크스페이스 멤버가 실행 UUID를 알면 상세 정보(노드 실행 이력 포함)를 조회할 수 있다.
  - 제안: `findOne`에 `@WorkspaceId() workspaceId` 파라미터를 추가하고 `verifyOwnership()` 호출 삽입. `findByWorkflow`는 workflowId를 workspaceId로 스코핑하는 검증(workflow 서비스를 통해 소유 확인)을 추가한다.

- **[WARNING]** `POST /workflows/:id/execute` — 응답이 `data` 래퍼 없이 `{ executionId }` 반환
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:264`
  - 상세: `TransformInterceptor`는 이미 `data` 키가 있는 객체를 그대로 통과시키고, 없는 객체는 `{ data: <원본> }`으로 래핑한다. 따라서 `return { executionId }` 는 `{ data: { executionId } }`로 나간다. 그런데 이 엔드포인트는 `@ApiAcceptedWrappedResponse(ExecuteAcceptedDto)`를 사용해 `{ data: ExecuteAcceptedDto }` 스키마를 선언하므로 Swagger 문서와 실제 응답은 일치한다. 단, spec/5-system/12-webhook.md §3.1 은 웹훅 응답 본문을 `{ "executionId": "uuid", "message": "..." }` (래퍼 없음)로 정의하고, 현재 코드는 `{ data: { executionId, message } }` 형태로 내보내므로 **webhook 엔드포인트와 spec 간 응답 형식 불일치**가 있다.
  - 제안: spec/5-system/12-webhook.md §3.1의 응답 스키마를 실제 구현과 동일하게 `{ data: { executionId, message } }`로 갱신하거나, HooksController에서 `@SkipTransform()` 또는 별도 응답 처리를 도입해 spec 그대로 `{ executionId, message }` 반환 여부를 정책적으로 결정한다.

- **[WARNING]** `POST /executions/:id/continue` — 응답이 `{ success: true }` (data 래퍼 후 `{ data: { success: true } }`)이나 Swagger 스키마는 `ExecutionContinueResultDto`
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:128`
  - 상세: 반환값 `{ success: true }`는 TransformInterceptor를 거치면 `{ data: { success: true } }`가 된다. Swagger는 `@ApiOkWrappedResponse(ExecutionContinueResultDto)`로 선언하므로 런타임과 문서가 일치해야 하지만, DTO 클래스의 실제 내용과 `{ success: true }`의 일치 여부를 확인해야 한다. 별도 문제 없다면 INFO 수준이지만 명시적인 `return { data: { ... } }` 패턴을 다른 컨트롤러와 통일하는 것을 권장한다.
  - 제안: 반환 값을 `return { success: true }` 대신 `ExecutionContinueResultDto` 인스턴스로 교체하거나 DTO 구조를 확인해 일치를 보장한다.

- **[WARNING]** Webhook spec(§5.2) vs 실제 에러 응답 형식 불일치
  - 위치: `spec/5-system/12-webhook.md:248-254` vs `codebase/backend/src/common/filters/http-exception.filter.ts:63-72`
  - 상세: spec §5.2는 webhook 파라미터 검증 400 응답을 `{ "statusCode": 400, "message": "...", "errors": [...] }` (bare 형식)으로 정의한다. 반면 GlobalExceptionFilter는 `{ "error": { "code", "message", "requestId", "details" } }` 형식으로 통일돼 있다. 클라이언트(및 외부 시스템)가 두 형식을 모두 구현해야 하는 혼란을 초래한다. spec의 `statusCode` 필드도 현재 구현에 없다.
  - 제안: spec/5-system/12-webhook.md §5.2를 실제 GlobalExceptionFilter의 envelope(`{ error: { code, message, details } }`)과 동기화한다. 외부 호출자가 이미 old 형식에 의존하는 경우 breaking change이므로 버전 이행 계획 수립.

- **[WARNING]** `PaginationQueryDto.sort` 필드 — 허용 값 미검증(SQL injection 위험)
  - 위치: `codebase/backend/src/common/dto/pagination.dto.ts:46-51`
  - 상세: `sort` 파라미터에 `@IsString()` 외에 허용 값 목록(`@IsIn([...])`) 검증이 없다. 서비스 레이어의 `getSortColumn()`이 화이트리스트 매핑으로 최종 방어하나, 이 방어는 각 서비스가 개별 구현하므로 누락 위험이 있다(감사 로그, 알림, 실행 서비스는 각각 별도 `getSortColumn` 보유). DTO 레벨에서 통일 검증이 없으면 새로운 서비스가 방어 누락할 수 있다.
  - 제안: `PaginationQueryDto`에 `@IsIn(['created_at', 'updated_at', 'name'])` 등 공통 허용 값을 추가하거나, 서비스별 허용 필드를 DTO 상속을 통해 명시화한다.

- **[WARNING]** 알림 읽음 처리(`PATCH /notifications/:id/read`) — spec 상태 토글 패턴 위반
  - 위치: `codebase/backend/src/modules/notifications/notifications.controller.ts:73`
  - 상세: spec/5-system/2-api-convention.md §12.1은 상태 토글을 `PATCH /:id { is_read: true }` 형태로 하되 전용 엔드포인트를 만들지 말라고 규정한다. 현재 `PATCH /:id/read`는 전용 sub-resource 엔드포인트를 사용하므로 규약 위반이다.
  - 제안: `PATCH /notifications/:id` + body `{ isRead: true }` 형태로 변경하거나, spec §12.1에 notifications의 read 전용 엔드포인트를 예외로 명문화한다. 클라이언트 계약 변경이 수반되므로 deprecation 경로 필요.

- **[WARNING]** `GET /auth/login`(login endpoint) — `forgotPassword`만 throttle 적용, `login`/`register`에 개별 throttle 미적용
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts:165-200, 104-135`
  - 상세: spec §7은 "인증 API: 10 req/min (IP 기준)"을 규정하나, `POST /auth/login`과 `POST /auth/register`에는 개별 `@Throttle` 데코레이터가 없다. 글로벌 기본값(분당 100 req)이 적용되므로 spec 정의보다 10배 너그러운 제한이 적용된다. `POST /auth/forgot-password`는 `{ ttl: 60_000, limit: 5 }`가 적용돼 있어 일관성이 없다. 무차별 대입(brute-force) 공격에 취약하다.
  - 제안: `POST /auth/login`과 `POST /auth/register`에 `@Throttle({ default: { ttl: 60_000, limit: 10 } })`(IP 기준 분당 10회) 추가. `@Throttle`의 keyGenerator가 IP 기반인지 확인도 필요.

- **[INFO]** `DELETE /workspaces/:id` — HTTP 상태 코드 204 No Content 대신 200 반환
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:139-158`
  - 상세: `remove` 핸들러에 `@HttpCode(HttpStatus.NO_CONTENT)`가 없고 `return { data: { ok: true } }`를 반환하므로 200 OK가 된다. spec/5-system/2-api-convention.md §6은 삭제 성공을 204 No Content로 규정한다. `@Delete ':id/members/:memberId`도 동일하게 `return { data: { ok: true } }` → 200. 대조적으로 `DELETE /integrations/:id`, `DELETE /workflows/:id`, `DELETE /triggers/:id` 등은 `@HttpCode(HttpStatus.NO_CONTENT)`를 올바르게 사용한다.
  - 제안: 삭제 후 본문 없이 204를 반환하거나, spec을 `200 OK + { ok: true }` 패턴으로 명시적으로 허용하도록 갱신해 일관성을 확보한다.

- **[INFO]** `GET /executions/workflow/:workflowId` — URL 설계가 RESTful sub-resource 패턴에 부합하지 않음
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:60`
  - 상세: spec/5-system/2-api-convention.md §2.1은 `{resource}/{id}/{sub-resource}` 패턴을 권장한다. 현재 `/executions/workflow/:workflowId`는 `workflow`가 sub-resource가 아닌 필터 명칭으로 사용돼 `/workflows/:id/executions` 패턴이 더 RESTful하다. 현재 WorkflowsController에서는 이 경로가 없고 ExecutionsController에 분리돼 있다.
  - 제안: `/executions/workflow/:workflowId` 경로는 현 구조에서 허용 가능한 절충이므로 즉각 변경보다는 next major refactoring 시 `/workflows/:workflowId/executions`로 이전을 권장한다. 현 경로를 deprecated로 표기 후 신규 경로 추가 병행 검토.

- **[INFO]** `GET /login-history` — cursor 파라미터 DTO 검증 없이 raw `@Query()` 사용
  - 위치: `codebase/backend/src/modules/auth/sessions.controller.ts:189-196`
  - 상세: `limit`과 `cursor`를 직접 `@Query('limit')`, `@Query('cursor')`로 받아 서비스에서 수동 파싱한다. DTO class + class-validator를 사용하지 않아 Swagger 자동 문서화가 안 되고 limit에 대해 최대값(예: 200) 검증이 코드 중복으로 처리된다. 다른 목록 엔드포인트는 모두 DTO를 사용한다.
  - 제안: `LoginHistoryQueryDto`를 생성해 `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit`, `@IsOptional() @IsString() cursor` 필드를 정의하고 `@Query() query: LoginHistoryQueryDto`로 전환한다.

- **[INFO]** OAuth 콜백 에러를 query string으로 노출 (`access_token` URL 노출 포함)
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts:494-507`
  - 상세: 소셜 로그인 성공 시 `{frontendUrl}/callback?success=true&token={accessToken}`으로 redirect하므로 access token이 URL에 포함된다. Referer 헤더, 브라우저 히스토리, 서버 로그에 토큰이 노출될 수 있다. Fragment(`#`) 기반 전달이 더 안전하다.
  - 제안: `?token=...` 대신 `#token=...` fragment로 전달하거나, 단회용 코드(server-side exchange)를 발급해 frontend가 교환하는 패턴을 도입한다.

---

## 요약

전반적으로 API 계약은 spec(`spec/5-system/2-api-convention.md`)과 높은 수준의 일관성을 유지하고 있다. `TransformInterceptor`를 통한 `{ data: ... }` 래핑, `GlobalExceptionFilter`의 `{ error: { code, message, requestId } }` 에러 envelope, 공용 `PaginatedResponseDto`, Swagger 래퍼 헬퍼 체계가 잘 구축돼 있다. 그러나 `GET /executions/:id`와 `GET /executions/workflow/:workflowId`에서 워크스페이스 소유권 검증이 누락돼 IDOR 위험이 존재하며, spec의 인증 API rate limit(10 req/min)이 login/register에 적용되지 않아 브루트포스 공격에 노출돼 있다. webhook 에러 응답 형식도 spec과 실제 구현 간 불일치가 있어 외부 연동 클라이언트 혼란을 유발할 수 있다. 삭제 HTTP 상태 코드 불일치, 알림 읽음 처리의 sub-resource URL 패턴, access token URL 노출 등 낮은 수준의 계약 드리프트도 발견된다.

## 위험도

MEDIUM
