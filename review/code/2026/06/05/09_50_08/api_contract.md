# API 계약 리뷰 — agent-memory admin surface

리뷰 대상: `git diff 9f30216f..HEAD`  
신규 엔드포인트: `GET /agent-memories/scopes`, `GET /agent-memories`, `DELETE /agent-memories/:id`, `DELETE /agent-memories?scopeKey=`  
날짜: 2026-06-05

---

## WARNING

### W-1: 페이지네이션 파라미터 불일치 — 프로젝트 표준 `page` 기반 vs 신규 `offset` 기반

- 위치: `codebase/backend/src/modules/agent-memory/dto/list-agent-memory-scopes.query.ts:14-38`, `list-agent-memories.query.ts:52-69`
- 상세: 프로젝트 공통 `PaginationQueryDto` (`common/dto/pagination.dto.ts`)는 `page` (1-based, 기본 1) + `limit` + `sort` + `order` 파라미터를 정의한다. `AuditLogsController` 등 기존 컨트롤러 전부가 이를 상속(`extends PaginationQueryDto`)하여 `?page=2&limit=20` 패턴을 사용한다. 신규 DTO 는 `offset` 기반으로 별도 구현했으며 `page` 파라미터가 없다. 클라이언트 입장에서 동일 프로덕트 내에 두 종류의 페이지네이션 쿼리 파라미터 컨벤션이 혼재한다. 응답 `PaginatedResponseDto` shape (`{ data, pagination: { page, limit, totalItems, totalPages } }`)는 공유하지만 요청 파라미터가 다르므로 API 클라이언트·SDK 일관성이 깨진다. `PaginationQueryDto`에 `offset` 옵션이 없어 클라이언트가 컨트롤러마다 다른 파라미터 이름을 파악해야 한다.
- 제안: `PaginationQueryDto`를 상속하거나(`extends PaginationQueryDto`) `offset` 기반이 spec 의도라면 `PaginationQueryDto`에 `offset` 필드를 추가하고 기존 `page` 와 상호 환산 규칙을 명문화. 단, 기존 API 변경 없이 신규만 바꾼다면 `PaginationQueryDto`에 optional `offset` 추가 + 기존 `page` 에 비어있으면 `offset`으로 환산 로직 중앙화가 권장됨. 현재처럼 컨트롤러에서 `Math.floor(offset / limit) + 1`을 개별적으로 계산하는 방식은 응답 `page` 값 일관성 유지 부담을 각 컨트롤러에 전가한다.

### W-2: `GET /agent-memories`에서 `scopeKey` 필수 파라미터 누락 시 400 응답 형식이 프로젝트 표준 에러 포맷과 불일치 가능성

- 위치: `codebase/backend/src/modules/agent-memory/dto/list-agent-memories.query.ts:28-31`
- 상세: `scopeKey`는 `@IsNotEmpty()`로 선언되어 class-validator 가 400을 내지만, 글로벌 `ValidationPipe`가 class-validator 검증 실패를 `BadRequestException`으로 변환할 때 `GlobalExceptionFilter`는 `exceptionResponse.message`(보통 string[])를 `code=VALIDATION_ERROR, message=string[]` 형태로 직렬화한다. 반면 컨트롤러의 명시적 `BadRequestException({ code, message })` throw(`clearScope` 공백 scopeKey 방어 코드)는 단일 문자열 `message`를 갖는다. 같은 400 케이스에서 `message` 필드가 `string` vs `string[]`으로 혼재한다. 클라이언트가 `message`를 파싱할 때 타입 분기가 필요해진다.
- 제안: 프로젝트 표준 에러 응답 형식이 `{ error: { code, message: string, requestId } }` 임을 감안하여, class-validator 기반 검증 실패도 `details` 배열로 상세를 내리고 `message`는 단일 요약 문자열로 고정하도록 글로벌 `ValidationPipe` exceptionFactory 설정 또는 `GlobalExceptionFilter`의 배열 처리 통일이 필요. 이는 기존 엔드포인트에도 동일하게 적용되는 pre-existing 이슈이나 신규 `scopeKey` 필수 검증이 최초로 명시적으로 이를 노출하는 지점이다.

### W-3: `DELETE /agent-memories` (clearScope) — idempotency 응답 문서와 실제 동작 불일치

- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts:330-331`
- 상세: `@ApiNoContentResponse({ description: '삭제 성공 (대상 없으면 0건 삭제)' })` 로 0건 삭제도 204를 반환하도록 명시했다. 이는 idempotent DELETE 관점에서 올바른 설계다. 그러나 `@ApiQuery({ required: true })`로 `scopeKey`를 필수로 표시하면서 컨트롤러 내부에서 공백 scopeKey를 400으로 별도 차단(`!query.scopeKey?.trim()`)한다. 한편 DTO에서 `@IsNotEmpty()`가 이미 빈 문자열을 차단하지만 `@IsNotEmpty()`는 공백 문자열(`'   '`)은 통과시킨다. 따라서 class-validator 1차 통과 → 컨트롤러 2차 차단의 이중 방어가 필요한 상황이다. 이 자체는 방어적 설계로 문제가 없으나, DTO 레벨에서 `@Matches(/\S/)` 또는 `@Transform(({ value }) => value?.trim())` + `@IsNotEmpty()` 조합으로 한 계층에서 완전히 처리할 수 있다. 현재 구조는 검증 실패 코드 경로가 두 곳(DTO 400, 컨트롤러 400)에 산재하여 에러 메시지 일관성이 낮다.
- 제안: DTO에서 `@Transform(({ value }) => value?.trim())` 적용 후 `@IsNotEmpty()` 만으로 공백 포함 모든 빈 값을 차단. 컨트롤러 내 `!query.scopeKey?.trim()` 중복 방어 코드 제거로 단일 계층 검증 유지.

---

## INFO

### I-1: `DELETE /agent-memories/:id` NotFound 에러 shape이 GlobalExceptionFilter 경유 여부와 일치하는지 확인 필요

- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts:310-314`
- 상세: `throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Agent memory not found' })` 형태다. `GlobalExceptionFilter`는 `exceptionResponse.code`와 `exceptionResponse.message`를 직접 파싱하므로 최종 응답은 `{ error: { code: 'RESOURCE_NOT_FOUND', message: 'Agent memory not found', requestId } }` 형식이 된다. 이는 프로젝트 표준 에러 포맷과 일치한다. 다른 컨트롤러(예: 서비스 레이어에서 `throw new NotFoundException('...')` 단순 문자열)와 비교하면 이 컨트롤러가 더 명시적으로 `code`를 지정한 점은 좋으나, 서비스 레이어에 직접 throw하는 패턴과 혼재한다. 일관성 측면의 관찰이며 기능적 문제는 없다.

### I-2: `TransformInterceptor`에 의한 중첩 응답 shape 확인

- 위치: `codebase/backend/src/common/interceptors/transform.interceptor.ts:24-26`
- 상세: `TransformInterceptor`는 응답에 `data` 키가 있으면 그대로 통과, 없으면 `{ data }` 로 감싼다. `PaginatedResponseDto.create()` 반환값은 `{ data: T[], pagination: {...} }` 형태이므로 `'data' in result === true` — 인터셉터가 re-wrap을 건너뛰어 `{ data: [...], pagination: {...} }` 가 최종 응답이 된다. 클라이언트 `normalizePagedResponse`는 `body.data`를 items로, `body.pagination`을 메타로 읽는다. 이 흐름은 정합하나, `wrapPaginatedSchema` Swagger 문서는 `{ data: { data: [...], pagination: {...} } }` 중첩 구조로 정의(`api-wrapped.ts:86-117`)한다. 실제 wire format은 `{ data: [...], pagination: {...} }`이고 Swagger 스키마는 한 단계 더 중첩된 형태를 기술하므로 자동 SDK 생성 시 잘못된 역직렬화를 유발할 수 있다. 이는 기존 컨트롤러에서도 동일하게 적용된 pre-existing 패턴이므로 이번 변경의 문제는 아니나, 신규 엔드포인트도 동일 불일치를 그대로 상속한다.

### I-3: API 버전 관리 — 신규 엔드포인트에 버전 prefix 없음

- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts:231`
- 상세: `@Controller('agent-memories')` 로 버전 없는 경로를 사용한다. 기존 모든 컨트롤러도 버전 prefix 없이 동작하므로 프로젝트 표준과 일치한다. API 버전 관리 전략이 별도로 존재하지 않는다면 이는 문제가 없다. 향후 spec §6의 계약이 변경될 경우(예: 응답 필드 추가/변경) 하위 호환성 없는 변경을 위한 버전 전략이 없다는 점은 기록해 둔다.

### I-4: `GET /agent-memories/scopes` — limit=0 엣지 케이스에서 page 계산 division-by-zero 가능성 없음 확인

- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts:256`
- 상세: `page = Math.floor(offset / limit) + 1` 계산에서 `limit`은 DTO의 `@Min(1)` 제약으로 최소 1이 보장되므로 0 나누기는 발생하지 않는다. 다만 DTO 기본값 `limit?: number = 30`과 컨트롤러의 `query.limit ?? 30` fallback이 중복 정의되어 있다. DTO 기본값이 항상 유효하면 컨트롤러 nullish coalescing은 무용하다. 기능 문제는 없으나 코드 일관성 관점에서 중복이다.

### I-5: 하위 호환성 — 신규 추가 엔드포인트이므로 기존 클라이언트 breaking change 없음

- 상세: 4개 엔드포인트 모두 신규 추가(기존 엔드포인트 수정 없음)이며, `agent-memory.module.ts`에 `AgentMemoryController`가 등록된 것 외 기존 API surface 변경이 없다. 기존 클라이언트에 대한 breaking change는 없다.

---

## 요약

신규 4개 엔드포인트(`GET /agent-memories/scopes`, `GET /agent-memories`, `DELETE /agent-memories/:id`, `DELETE /agent-memories?scopeKey=`)는 spec §6(AGM-12/13) 계약과 구현이 전반적으로 일치하며, workspace_id 격리·editor+ 인가·204 hard delete·embedding 제외 등 핵심 보안·기능 요구사항을 올바르게 구현했다. 주요 우려는 프로젝트 표준 `PaginationQueryDto`(`page` 기반)와 다른 `offset` 기반 페이지네이션 파라미터 도입으로 인한 요청 파라미터 불일치(W-1)로, API 클라이언트가 엔드포인트별로 다른 페이지네이션 파라미터를 사용해야 하는 불일치가 생긴다. DTO 검증과 컨트롤러 수동 검증의 이중 계층(W-3), 클래스 검증 실패 시 `message` 필드 타입 혼재(W-2)도 개선이 권장된다. 에러 응답 형식은 `GlobalExceptionFilter`를 통해 프로젝트 표준을 따른다. Swagger 스키마 중첩 불일치(I-2)는 기존 pre-existing 패턴을 그대로 상속한 것으로 이번 변경에서 새로 도입된 문제가 아니다.

### 위험도
MEDIUM

BLOCK: NO
