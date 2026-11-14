---
id: "CLE-API-SWAGGER-ROUTE"
title: "OpenAPI 문서화 — 컨트롤러와 응답 DTO"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-SWAGGER"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-SWAGGER"]
area: "CLE-API"
content_hash: "31cdcd51ff1d14fd4fff5bf9649e3d50a564b61767f3542ff8630c1d6ef6698b"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "c0a0d55f4882108c820f700a620e807d2e85b0ca925848c48163e81695b0ae69"
etag: "sha256-615d0e6de0b178a133bde18fe057df6fd55833c29bd0df566427206f7afb2e9c"
---
## 개요

이 문서는 [OpenAPI 문서화](CLE-API-SWAGGER.md) 의 하위 문서로 컨트롤러의 OpenAPI 선언(§2), 응답 DTO 규약(§5), 레거시 패턴 제거(§6)를 정한다. DTO 필드 선언은 [DTO 패턴](CLE-API-SWAGGER-DTO.md) 이, 설명 문구는 [설명 문구와 내부 참조](CLE-API-SWAGGER-TEXT.md) 가 정한다.

## 2. 컨트롤러 패턴

### 2-1. 상단에 `@ApiTags` 와 `@ApiBearerAuth('access-token')`

- `access-token` 은 `main.ts` 에서 등록한 Bearer scheme 이름이다(`.addBearerAuth({ scheme: 'bearer', bearerFormat: 'JWT', ... }, 'access-token')`).
- `main.ts` 는 `interaction-token` Bearer scheme 도 등록한다. External Interaction API 전용이고 실행 단위 토큰 `iext_<JWT>` 와 트리거 단위 토큰 `itk_<opaque>` 를 받는다. 해당 엔드포인트는 `@ApiBearerAuth('interaction-token')` 을 쓴다.
- 모든 라우트가 `@Public()` 인 컨트롤러(health, hooks)는 `@ApiBearerAuth` 를 **넣지 않는다**.
- 공개 라우트와 인증 라우트가 섞인 컨트롤러는 클래스 수준에 `@ApiBearerAuth('access-token')` 를 넣고 `@Public()` 엔드포인트에는 `@ApiSecurity({})` 대신 설명에 "인증 불필요" 를 적는다. auth 컨트롤러가 이 경우다. 로그인 같은 공개 라우트와 2FA 설정·해제, 워크스페이스 전환 같은 인증 필수 라우트가 함께 있다([가입과 로그인 「API」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#api), [워크스페이스와 멤버 「전환 API 와 토큰」](../CLE-ACCT/CLE-ACCT-WS.md#전환-api-와-토큰)).

```ts
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery,
  ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse,
  ApiBadRequestResponse, ApiUnauthorizedResponse, ApiNotFoundResponse, ApiConflictResponse,
} from '@nestjs/swagger';

@ApiTags('Workflows')
@ApiBearerAuth('access-token')
@Controller('workflows')
export class WorkflowsController { ... }
```

### 2-2. 엔드포인트 데코레이터

```ts
@Post()
@ApiOperation({
  summary: '워크플로우 생성',
  description: '새로운 워크플로우를 생성합니다. 생성 시 초기 버전이 함께 기록됩니다.',
})
@ApiCreatedResponse({
  description: '생성된 워크플로우 정보',
  schema: {
    type: 'object',
    properties: { data: { type: 'object' } },
  },
})
@ApiBadRequestResponse({ description: '입력값 검증 실패' })
@ApiUnauthorizedResponse({ description: '인증 실패' })
async create(@Body() dto: CreateWorkflowDto) { ... }
```

위 `schema` 는 데코레이터 위치를 보이기 위한 예시다. 실제로는 §5 의 응답 DTO 와 공용 래퍼 헬퍼를 쓴다(§6 빈 껍데기 금지).

### 2-3. Path·Query 파라미터

```ts
@Get(':id')
@ApiOperation({ summary: '워크플로우 단건 조회' })
@ApiParam({ name: 'id', description: '워크플로우 UUID', format: 'uuid' })
@ApiOkResponse({ description: '워크플로우 상세' })
@ApiNotFoundResponse({ description: '해당 워크플로우를 찾을 수 없음' })
async findOne(@Param('id') id: string) { ... }
```

```ts
@Get()
@ApiOperation({ summary: '워크플로우 목록' })
@ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
@ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
@ApiQuery({ name: 'search', required: false, type: String })
async findAll(@Query() query: QueryWorkflowDto) { ... }
```

쿼리 DTO 를 쓰면 `@ApiQuery` 를 빼도 CLI 플러그인이 자동으로 문서화한다. 굳이 중복해서 적지 않는다.

### 2-4. 상태 코드 응답 규칙

| 상황 | 데코레이터 |
|------|-----------|
| 200 OK (조회·수정) | `@ApiOkResponse` |
| 201 Created | `@ApiCreatedResponse` |
| 204 No Content | `@ApiNoContentResponse` |
| 3xx 리다이렉트 (`res.redirect` 로 끝나는 라우트) | `@ApiFoundResponse` 등 |
| 400 검증 실패 | `@ApiBadRequestResponse` |
| 401 인증 실패 | `@ApiUnauthorizedResponse` |
| 403 권한 부족 | `@ApiForbiddenResponse` |
| 404 없음 | `@ApiNotFoundResponse` |
| 409 중복·충돌 | `@ApiConflictResponse` |
| 502 외부 provider 호출 실패 | `@ApiBadGatewayResponse` |

이 표는 데코레이터 대응만 다룬다. 어느 상황에 어느 상태 코드를 쓰는지(202·410·413·422·429·503 포함)는 [HTTP API 규약](CLE-API-CONV.md) 의 HTTP 상태 코드 절이 정한다.

**광고한 성공 코드는 실제 성공 코드와 같아야 한다.**

- 실제 성공 코드는 `@HttpCode(n)` 이 있으면 n, 없으면 Nest 기본값(POST 201, 그 밖 200)이다. 그래서 200 을 광고하는 POST 에는 `@HttpCode(HttpStatus.OK)` 를, 204 를 광고하는 DELETE 에는 `@HttpCode(HttpStatus.NO_CONTENT)` 를 함께 단다.
- `@Res()` 로 응답을 직접 쓰는 핸들러(SSE 등)도 같다. Nest 는 핸들러를 부르기 전에 이 코드를 응답에 싣는다.
- **라우트는 성공 응답을 하나 이상 광고한다.** 2xx 응답 데코레이터를 달고 응답을 `res.redirect` 로 끝내는 라우트는 3xx(`@ApiFoundResponse` 등)를 단다.
- 리다이렉트만 광고한 라우트는 위 짝을 대조하지 않는다. `res.redirect(url)` 는 Nest 가 미리 실은 상태를 명시적으로 덮어쓴다. 앞의 SSE 가 면제되지 않는 것(핸들러가 상태를 건드리지 않아 Nest 기본값이 그대로 나간다)과 반대 경우이고 이 예외는 리다이렉트만 광고한 라우트에 한한다.
- `@ApiExcludeEndpoint()` 핸들러는 OpenAPI 밖이라 묻지 않는다.
- 저장소 가드 `http-status-advertised` 가 강제한다.
- 이 규칙은 광고와 실제의 짝만 강제하고 어느 코드가 맞는지는 정하지 않는다. 자원을 만들지 않는 POST 액션의 성공 코드 기준은 아직 없다([HTTP API 규약](CLE-API-CONV.md) 의 미결 사항).

보호된 엔드포인트에는 기본으로 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 를 단다.

### 2-5. 응답 wrapping

프로젝트는 `TransformInterceptor` 로 성공 응답을 `{ data: ... }` 로 감싼다.

- **반환 객체에 이미 최상위 `data` 키가 있으면**(`'data' in data` 분기) 더 감싸지 않고 그대로 통과시킨다(pass-through).
- 페이지네이션 `PaginatedResponseDto`(`{ data, pagination }`)가 대표 사례다. 그래서 그 wire 형태는 이중 래핑이 아니라 한 번 래핑한 `{ data: [...], pagination }` 이다(§5-2 `ApiOkPaginatedResponse`).
- 고정 목록 응답(활성 로그인 세션, WebAuthn credential 목록)이 `{ data: { items } }` 를 직접 돌려주는 경우도 같은 통과 분기를 탄다.
- wire 형태 자체의 기준은 [HTTP API 규약](CLE-API-CONV.md) 의 응답 형식 절이다. 이 절은 인터셉터 동작과 스키마 표기만 다룬다.

Swagger 응답 스키마에도 이 구조를 반영한다. 간단한 텍스트 설명으로 끝내거나, 필요하면 다음과 같이 적는다.

```ts
@ApiOkResponse({
  description: '액세스 토큰 재발급',
  schema: {
    type: 'object',
    properties: {
      data: {
        type: 'object',
        properties: { accessToken: { type: 'string' } },
      },
    },
  },
})
```

구체적인 Response 클래스가 있으면 `type: ResponseDto` 로 참조한다.

## 5. 응답 DTO 규약

모든 성공 응답은 `@ApiOkResponse({ schema: ... })` 의 인라인 객체가 아니라 **응답 DTO 클래스와 공용 래퍼 헬퍼**로 광고한다.

### 5-1. 응답 DTO 위치

- `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts` 에 둔다.
- 엔티티(`entities/*.entity.ts`)를 그대로 노출하지 말고 API 응답 형태에 맞춘 별도 DTO 를 만든다. 비밀값(credentials, passwordHash 등)은 가리거나 뺀다.
- 겹치는 필드는 `@nestjs/swagger` 의 `PickType`·`OmitType`·`PartialType` 으로 재사용할 수 있다.

**무엇이 이 규칙을 강제하나**: 정적 가드(`swagger-dto-contract-guard.ts`)는 선언끼리만 대조하므로 "엔티티를 그대로 노출했다" 는 사실 자체는 보지 못한다. 그 축은 런타임 짝인 `response-contract.ts` 가 맡는다. 실제 응답에 **스키마가 선언하지 않은 키**가 있으면 위반으로 보고한다. 실사례로 `GET /api/audit-logs` 가 3필드를 광고하면서 `User` 엔티티 26키(`passwordHash`, 2FA 복구 코드, 계정 탈취 토큰 포함)를 내보내고 있었다. 이 검증자들의 경계는 [HTTP API 규약](CLE-API-CONV.md) 의 부재 표현 검증 층 표에 인벤토리로 둔다. **개수를 적지 않는다.** 축이 늘 때마다 숫자를 고쳐야 하는 자리를 만들지 않기 위해서다.

**응답 DTO 클래스 이름은 저장소 전체에서 유일해야 한다.**

- `@nestjs/swagger` 는 스키마를 클래스 `.name` 문자열로 `components.schemas` 에 등록한다. 서로 다른 두 클래스가 같은 이름을 쓰면 **한쪽이 다른 쪽을 덮어쓴다**. 어느 쪽이 남는지는 스캔 순서에 달렸고 남지 못한 엔드포인트의 문서는 실제 응답과 다른 형태를 광고한다.
- 컴파일은 통과한다(서로 다른 모듈의 서로 다른 클래스이므로). 타입이 막아 주지 않는 축이다.
- 같은 개념을 층별로 나눠 선언해야 할 때(입력 검증 DTO 와 응답 DTO)는 이름을 다르게 둔다. 선례는 `ChatChannelBotIdentityDto`(입력. 모든 필드 optional, 어댑터가 덮어쓰는 캐시)와 `ChatChannelRotateBotIdentityDto`(응답. `botId`·`username` 필수와 provider 부가 필드)다.
- **합치지 않는 이유**: 두 자리의 계약이 다르므로 하나로 묶으면 한쪽이 반드시 거짓말을 한다(같은 판단의 선례: `TriggerWorkflowRefDto` 와 `ScheduleTriggerWorkflowRefDto`).
- **강제**: `dto-class-name-collision.spec.ts` 가 `modules/`·`common/` 의 `*.dto.ts` 를 AST 로 훑어 `export class` 이름 중복 0을 고정한다(2026-09-12 신설). 정규식이 아니라 AST 인 이유는 주석·문자열·JSDoc 예제 안의 `export class` 를 세면 가드가 자기 오탐으로 죽기 때문이다.
- 가드가 먼저 생기고 규약이 뒤따른 자리라 가드가 무엇을 강제하는지 여기 적는다. 적지 않으면 "누가 왜 넣었는지 모르는 검사" 로 보고 지운다.

**형제 DTO 가 같은 enum 을 함께 쓰면 `*.literal.ts` 로 뺀다.** 두 개 이상의 응답 DTO 가 같은 값 집합을 노출할 때 각 DTO 가 union 타입과 swagger `enum` 배열을 따로 선언하면 값이 바뀔 때 여러 곳을 손으로 맞춰야 하고 한쪽만 고쳐도 아무도 모른다. 같은 `dto/responses/` 아래 `<name>.literal.ts` 에 값 배열과 파생 타입을 두고 형제들이 import 한다.

```ts
// dto/responses/execution-status.literal.ts  — wire SoT
export const EIA_EXECUTION_STATUS_VALUES = ['pending', 'running', /* … */] as const;
export type ExecutionStatusLiteral = (typeof EIA_EXECUTION_STATUS_VALUES)[number];

// 형제 DTO 들
@ApiProperty({ enum: EIA_EXECUTION_STATUS_VALUES })
status: ExecutionStatusLiteral;
```

- **엔티티 enum 에서 파생하지 않는다.** (a) DTO 층이 엔티티에 묶이지 않아야 하고 (b) 엔티티 enum 의 선언 순서가 wire enum 배열 순서를 바꿔 OpenAPI 산출물이 엔티티 리팩터링에 흔들린다. 로컬 리터럴이 wire 의 단일 기준이다.
- **이름 충돌을 피한다.** 도메인 접두(`EIA_` 등)로 다른 모듈의 같은 이름 상수와 grep 을 가르고 `Literal` 접미로 TypeORM 엔티티 enum 과 타입 이름을 가른다.
- 값이 **한 DTO 에만** 쓰이면 굳이 빼지 않는다. 공유가 생기는 시점이 분리 시점이다.

### 5-2. 공용 래퍼 헬퍼

`codebase/backend/src/common/swagger/` 가 다음을 제공한다(import: `from '../../common/swagger'`).

| 헬퍼 | 용도 | 반환 스키마 |
|------|------|------------|
| `ApiOkWrappedResponse(Dto)` | 단일 객체 200 OK | `{ data: <Dto> }` |
| `ApiOkWrappedNullableResponse(Dto)` | 단일 객체 또는 `null` 200 OK (예: 없으면 `null` 인 "최근 항목" 조회) | `{ data: <Dto> \| null }` |
| `ApiOkWrappedOneOfResponse([DtoA, DtoB], { discriminator })` | 200 OK, `data` 가 여러 DTO 중 하나 (예: OAuth 시작 분기 응답) | `{ data: oneOf(<DtoA>, <DtoB>) }` (`wrapOneOfDataSchema`) |
| `ApiCreatedWrappedResponse(Dto)` | 단일 객체 201 Created | `{ data: <Dto> }` |
| `ApiAcceptedWrappedResponse(Dto)` | 단일 객체 202 Accepted | `{ data: <Dto> }` |
| `ApiOkWrappedArrayResponse(Dto)` | 배열 200 OK | `{ data: <Dto>[] }` |
| `ApiOkPaginatedResponse(Dto)` | 페이지네이션 200 OK | `{ data: <Dto>[], pagination: { page, limit, totalItems, totalPages } }` (공용 `PaginatedResponseDto`. `data`·`pagination` 을 최상위에 두는 한 번 래핑, §2-5 통과 분기) |

각 헬퍼는 안에서 `ApiExtraModels(Dto)` 와 `getSchemaPath(Dto)` 를 자동으로 처리한다.

위 표는 `common/swagger/` 가 export 하는 호출형 헬퍼 함수의 인벤토리다. 응답 body 전체가 아니라 **DTO 의 한 필드**가 닫힌 union 인 경우는 대응 헬퍼가 없고 `@ApiExtraModels` 와 `@ApiProperty({ oneOf: [...] })` 데코레이터 조합을 직접 쓴다([§1-4](CLE-API-SWAGGER-DTO.md#1-4-nested-enum-union)).

### 5-3. 사용 예

```ts
import {
  ApiOkWrappedResponse,
  ApiOkPaginatedResponse,
  ApiCreatedWrappedResponse,
} from '../../common/swagger';
import { WorkflowDto } from './dto/responses/workflow-response.dto';

@Get()
@ApiOkPaginatedResponse(WorkflowDto, { description: '워크플로우 목록' })
async findAll(...) { ... }

@Get(':id')
@ApiOkWrappedResponse(WorkflowDto, { description: '워크플로우 상세' })
async findOne(...) { ... }

@Post()
@ApiCreatedWrappedResponse(WorkflowDto, { description: '생성된 워크플로우' })
async create(...) { ... }
```

### 5-4. 새 엔드포인트 체크리스트

- [ ] 응답 DTO 가 `dto/responses/` 에 있는가
- [ ] DTO 필드에 JSDoc 이 있고 필요하면 `@ApiProperty`(enum, example, format, nullable)로 보강했는가
- [ ] `ApiOkWrappedResponse`·`ApiOkPaginatedResponse` 등 알맞은 래퍼를 썼는가
- [ ] `@Roles(...)` 가 붙었거나 `@WorkspaceId()`·`@WorkspaceParam(...)` 을 쓰는 엔드포인트에 `@ApiForbiddenResponse` 를 더했는가.
  - `RolesGuard` 는 `@Roles()` 유무와 무관하게 워크스페이스 멤버십을 늘 검증한다. 그래서 `@WorkspaceId()`·`@WorkspaceParam(...)` 만 쓰는 조회 엔드포인트도 403 을 낼 수 있다(근거: [워크스페이스와 멤버 「멤버십 검증은 가드 한 곳에서 `@Roles()` 와 상관없이 한다」](../CLE-ACCT/CLE-ACCT-WS.md#멤버십-검증은-가드-한-곳에서-roles-와-상관없이-한다), [워크스페이스와 멤버 「경로 파라미터 워크스페이스도 가드가 본다」](../CLE-ACCT/CLE-ACCT-WS.md#경로-파라미터-워크스페이스도-가드가-본다)).
  - 설명에는 **가드가 낼 수 있는 거부 코드를 모두** 싣는다. 비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER` 이므로 대상 라우트는 모두 "워크스페이스 멤버가 아님(`NOT_A_MEMBER`)" 을 싣는다. `@Roles()` 가 있으면 요구 역할 중 가장 낮은 역할의 코드를 더한다(예: "워크스페이스 멤버가 아님(`NOT_A_MEMBER`) 또는 Editor 이상 권한 필요(`EDITOR_REQUIRED`)"). `@Roles('viewer')` 는 멤버십과 같아 앞 문장뿐이다.
  - 문장은 공용 헬퍼 `FORBIDDEN_NOT_A_MEMBER`·`forbiddenForRole(role)`(`common/swagger`)로 만들고 서비스가 내는 403 은 그 뒤에 덧붙인다. 코드 목록은 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 의 가드 거부 코드다.
  - 저장소 가드 `forbidden-response-codes` 가 새 엔드포인트만이 아니라 **모든 라우트**에서 빠진 가드 코드를 잡는다. 설명에 남은 코드(역할을 내린 뒤의 옛 역할 코드)와 서비스 거부는 세지 않으므로 `@Roles()` 를 바꾸면 설명도 손으로 맞춘다. `@Public()` 라우트는 대상이 아니다.
- [ ] 광고한 성공 코드(`ApiOk*`, `ApiCreated*`, `ApiAccepted*`, `ApiNoContent*`, `ApiResponse({ status })` 등 저장소 래퍼를 포함한 모든 성공 응답 데코레이터)와 실제 성공 코드(`@HttpCode` 또는 Nest 기본값)가 짝을 이루는가(§2-4). 성공 응답을 하나도 광고하지 않는 라우트는 없어야 한다(리다이렉트 라우트는 3xx).
- [ ] 요청 본문을 받는 라우트(`@Body()`)가 본문 스키마를 광고하는가.
  - 파라미터를 DTO 클래스로 받으면 플러그인이 스키마를 만든다.
  - 클래스로 받을 수 없으면 **문서 전용 DTO**(class-validator 데코레이터 없이 `@ApiProperty` 만)를 `@ApiBody({ type })` 로 광고하고 파라미터는 인라인 타입을 유지한다. 전역 `CustomValidationPipe` 는 클래스 파라미터에만 들어가 `whitelist`·`forbidNonWhitelisted` 로 에러 코드와 여분 키 처리를 바꾸기 때문이다.
  - 형태를 보내는 쪽이 정하는 본문(외부 웹훅. 객체가 아닐 수도 있다)은 `@ApiBody({ schema: {} })` 로 광고한다.
  - 저장소 가드 `request-body-advertised` 가 **모든 라우트**에서 `@Body()` 자리의 설계 타입이 클래스가 아닌데 `@ApiBody` 가 없는 자리를 잡는다(`@ApiExcludeEndpoint()`·`@ApiExcludeController()` 제외).
- [ ] 경로 UUID 파라미터에 `@ApiParam({ format: 'uuid' })` 를 일관되게 적용했는가
- [ ] 요청 DTO 이름에서 `Update` 접두를 top-level 요청 바디에만 쓰고 nested 변형은 로컬 패턴을 따랐는가([§1-7](CLE-API-SWAGGER-DTO.md#1-7-요청-dto-이름-update-접두는-top-level-요청-바디에만))

### 5-5. 에러 응답 참조

`codebase/backend/src/common/swagger/error-response.dto.ts` 의 `ErrorResponseDto` 는 `GlobalExceptionFilter` 출력을 1:1 로 표현한다. 필요하면 `@ApiBadRequestResponse({ type: ErrorResponseDto })` 처럼 참조할 수 있다. 봉투의 필드 정의는 [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) 가 정한다.

## 6. 레거시 패턴 제거

- `@ApiOkResponse({ schema: { type: 'object', properties: { data: { type: 'object' } } } })` 같은 "빈 껍데기" 는 반드시 DTO 기반 래퍼로 바꾼다.
- `{ data: { items, totalItems, page, limit } }` 처럼 서비스의 실제 반환 형태(`{ data, pagination }`)와 다른 스키마는 버그다. `ApiOkPaginatedResponse` 로 바꾼다.
- 단 `pagination` 필드가 전혀 없는 순수 `{ data: { items } }`(고정 목록 응답: 활성 로그인 세션, WebAuthn credential 목록)는 이 버그 패턴이 아니라 §2-5 의 정상 통과 사례다([HTTP API 규약](CLE-API-CONV.md) 의 고정 목록 응답). 평탄화하지 않는다.

## 구현 위치

- `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision*.ts` (§5-1 클래스 이름 유일성)
- `codebase/backend/src/shared/testing/response-contract*.ts` (§5-1 런타임 응답 키 대조)
- `codebase/backend/src/repo-guards/__tests__/user-entity-exposure*.ts`
- `codebase/backend/src/shared/testing/user-secret-absence*.ts`
- `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe*.ts` 와 대조군 `fixtures/param-uuid-pipe/**` (`@ApiParam({format:'uuid'})` 축과 런타임 `ParseUUIDPipe` 축을 세는 가드)
- 대조군(negative fixture). 가드가 강제하는 위반 형태의 실례다. 없으면 술어가 죽어도 테스트가 통과한다.
  - `codebase/backend/src/repo-guards/__tests__/fixtures/user-eager-relation*.ts`
  - `codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load*.ts`
  - `codebase/backend/src/repo-guards/__tests__/fixtures/dto-class-collision/*.ts`
- `codebase/backend/src/repo-guards/__tests__/http-status-advertised*.ts` 와 `fixtures/http-status-advertised/**` (§2-4 광고한 성공 코드와 실제 성공 코드 짝)
- `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes*.ts` (§5-4 403 설명과 가드 거부 코드 짝. reflection, 대조군은 spec 안의 클래스)
- `codebase/backend/src/repo-guards/__tests__/request-body-advertised*.ts` (§5-4 요청 본문 스키마. reflection, 대조군은 spec 안의 클래스)

## Rationale

### `ApiOkPaginatedResponse` 는 한 번 래핑 (§5)

`ApiOkPaginatedResponse` 가 문서화하는 wire 형태는 한 번 래핑한 `{ data: <Dto>[], pagination }` 이다(§5-2). 페이지네이션 핸들러는 공용 `PaginatedResponseDto`(`{ data, pagination }`, 최상위 `data` 키 있음)를 돌려주고 `TransformInterceptor` 는 이를 더 감싸지 않고 통과시킨다(§2-5). 고정 목록 응답 `{ data: { items } }` 가 두 번째 통과 사례다(`pagination` 이 없어 형태가 다르다).

옛 헬퍼가 선언하던 이중 래핑 `{ data: { data, pagination } }` 은 통과 분기를 간과한 **버그**였다. 런타임(`PaginatedResponseDto` 와 인터셉터), e2e(`res.body.data`·`res.body.pagination` 최상위), [HTTP API 규약](CLE-API-CONV.md) 의 목록 응답이 모두 한 번 래핑이다. **이중 래핑으로 되돌리지 않는다.** 런타임과 어긋난다.

### 새 엔드포인트 체크리스트의 403 항목을 `@WorkspaceId()` 소비 라우트로 넓힌 배경 (§5-4, 2026-08-08)

옛 §5-4 는 "`@Roles()` 가 있어야 403 이 가능하다" 는 opt-in 가드 모델을 전제로 적혀 있었다. 워크스페이스 멤버십 가드 보안 수정이 `RolesGuard` 를 opt-out 할 수 없는 구조로 다시 짜면서 그 전제가 깨졌다(멤버십 검증 기준은 §5-4 체크리스트의 링크). 이 정정은 동작 변경이 아니라 문서와 구현을 맞춘 것이다.

규약 문구까지 고치는 이유: §5-4 는 새 엔드포인트를 만들 때 판단 기준으로 쓰인다. 문구가 실제 403 발생 조건과 어긋나면 규약을 그대로 따른 다음 작성자에게서 같은 틈이 다시 생긴다. "사람이 규칙을 기억해야 하는 opt-in" 구조를 규약 수준에서 반복하지 않는다(그 수정이 코드에서 닫은 것과 같은 결함 부류).

### 광고한 성공 코드와 실제 성공 코드를 왜 가드로 세는가 (§2-4, 2026-09-26)

광고는 응답 데코레이터에, 실제 코드는 `@HttpCode` 나 Nest 기본값에 있어 둘을 한 번에 보는 곳이 없었다. 컴파일도 단위 테스트도 이 짝을 보지 않고 e2e 는 `[200, 201]` 로 둘 다 받아 불일치를 가렸다. 전수 조사(2026-09-26, `src/modules` 핸들러 223개)에서 불일치가 15곳이었다(201 을 내는 200 광고 POST 14, 200 을 내는 204 광고 초대 취소 DELETE 1). 그중 둘(MCP `preview-test`, 통합 `:id/test`)은 문서 본문이 이미 200 으로 적은 자리였다.

- **`@Res()` 를 면제하지 않는다.** Nest 는 핸들러를 부르기 전에 기본 상태를 싣는다(`@nestjs/core` `router-execution-context`). 가드 spec 의 캐너리가 이 동작을 실제 요청으로 고정한다. Nest 가 동작을 바꾸면 그 캐너리가 먼저 RED 가 되고 그때 면제를 다시 판단한다.
- **이름 → 코드 표를 손으로 쓰지 않는다.** `@nestjs/swagger` 는 2xx 데코레이터만 해도 일곱을 내보낸다(203·205·206 포함). 손으로 쓴 표는 새 이름을 쓰는 날 그 핸들러의 광고가 빈 집합이 되어 대조에서 조용히 빠진다. 그래서 팩토리를 적용해 메타데이터에서 읽고 저장소 래퍼는 이름 접두사가 아니라 내부 호출로 옮긴다. 표에 없는 `Api*Response` 는 실패다.
- **"광고가 있어야 한다" 는 광고를 채운 뒤 조였다.** 광고 없던 핸들러 15곳 중 11곳을 채웠고(응답 DTO 가 없던 워크플로우 AI 어시스턴트 세션 6곳 포함) 남은 넷은 OpenAPI 밖(`@ApiExcludeEndpoint()` 2)이거나 302 를 광고하던 OAuth 리다이렉트 2 였다(전수 조사가 2xx 만 셌다). 그래서 3xx 도 성공 광고로 친다. 새 라우트가 광고 없이 들어오면 가드가 실패한다.
- **어느 코드가 맞는지는 이 규칙이 정하지 않는다.** 고친 14곳은 광고(200)에 실제를 맞췄다. 액션이고 `@HttpCode(200)` 을 단 POST 42곳 중 광고가 있는 40곳이 모두 200 을 광고하기 때문이다. 두 자리는 행이 생긴다. OAuth 시작은 Cafe24 Private·MakeShop 분기에서 설치 대기 통합 행을 만들고(§5-2 래퍼 표가 그 분기 응답을 200 으로 적는다), 초대 수락은 멤버십 행을 만든다(1차 자원은 소비되는 초대이고 응답은 기존 워크스페이스다). 둘 다 설치·합류 흐름의 부수 효과로 보고 200 을 유지했다. 그러나 §2-4 와 [HTTP API 규약](CLE-API-CONV.md) 의 상태 코드 표에는 "자원을 만들지 않는 POST" 칸이 없다. 그 명문화는 별도 결정이다.

### 403 설명의 거부 코드: 왜 두 코드이고 왜 가드로 세는가 (§5-4, 2026-09-26)

가드 거부에 코드가 붙은 뒤에도([워크스페이스와 멤버 「가드 거부에 에러 코드를 붙인다」](../CLE-ACCT/CLE-ACCT-WS.md#가드-거부에-에러-코드를-붙인다)) 기존 라우트의 403 설명은 따라가지 않았다. §5-4 는 새 엔드포인트 체크리스트라 기존 라우트를 묶지 않았고 그 결정을 적용한 변경은 경로 라우트 15곳과 재실행·chain 의 설명만 고쳤다. 2026-09-26 실측(`src/modules`, reflection)에서 가드가 403 을 낼 수 있는 라우트 157곳 중 129곳의 설명에 코드가 빠져 있었다.

- **`@Roles()` 라우트도 `NOT_A_MEMBER` 를 싣는다.** 비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER` 라는 것이 그 결정의 채택안이다. 옛 문구("`@Roles()` 가 있으면 요구 역할과 코드")대로면 비멤버 코드가 광고에서 빠진다. 이미 코드를 싣던 28곳은 두 코드를 함께 싣고 있었고 문구를 그 실제에 맞췄다.
- **`viewer` 는 코드가 하나다.** `@Roles('viewer')` 의 거부는 멤버십 거부와 같다(`ROLE_REQUIRED.viewer` 가 `NOT_A_MEMBER`). "viewer 이상 권한 필요" 라고 쓰면 오지 않는 코드를 암시한다.
- **공용 헬퍼로 쓴다.** 문장 형식이 컨트롤러마다 갈렸다("Admin 미만 권한", "관리자 권한 필요", "권한 부족 (Admin 미만) 또는 비멤버"). 헬퍼가 코드를 `NOT_A_MEMBER`·`ROLE_REQUIRED` 상수에서 끼워 넣으므로 코드 이름이 바뀌어도 문장이 따라간다. 역할 문구 표기는 `ROLE_REQUIRED` 메시지("Editor 이상의 권한이 필요합니다.")를 따른다. 컨트롤러가 따로 두던 같은 문장의 상수(`workspaces` 의 `FORBIDDEN_*_ROUTE`, `integrations` 의 `FORBIDDEN_MEMBER`)는 이 헬퍼로 흡수한다.
- **reflection 으로 센다.** 설명은 상수 보간(`${NOT_A_MEMBER.code}`)이라 소스 텍스트로는 최종 문장을 알 수 없다. 데코레이터가 평가된 메타데이터를 읽는다. 가드가 낼 코드는 `RolesGuard` 와 같은 규칙(`@Public`, `@Roles`, 워크스페이스 소비)으로 계산하고 가장 낮은 역할은 가드와 **같은 함수**(`lowestRequiredRole`)로 고른다. 옮겨 적으면 둘이 갈린다. 나머지 분기가 가드와 같은지는 가드 spec 의 "모델 캐너리" 가 실제 `RolesGuard` 를 돌려 대조한다. 스캔 모집단이 비는 공허함은 하한(컨트롤러 30, 대조 라우트 150 초과)이 막는다.
- **대조군은 가드 spec 안의 클래스다.** reflection 가드라 대조군도 데코레이터가 평가된 클래스여야 하고 모델 캐너리가 같은 클래스를 돌린다. 별 파일로 두면 대조군과 캐너리가 두 곳이 된다. 그래서 구현 위치에는 가드 파일 한 쌍만 적는다.
- **기존 라우트까지 소급한다.** [DTO 패턴 §1-4](CLE-API-SWAGGER-DTO.md#1-4-nested-enum-union) · [설명 문구 §3](CLE-API-SWAGGER-TEXT.md#3-주석과-설명-톤) 의 규약은 새 변경에만 걸지만 이 규칙은 §2-4 처럼 **광고가 실제와 맞는가** 의 문제라 틀린 광고가 배포된 라우트에서 클라이언트를 오도한다.
- **서비스 거부는 세지 않는다.** 서비스가 내는 403 은 자리마다 조건과 코드가 달라 기계적으로 판정할 수 없다. 헬퍼 문장 뒤에 덧붙이도록 안내만 한다.

### 요청 본문 스키마: 왜 클래스로 받게 강제하지 않고 왜 reflection 으로 세는가 (§5-4, 2026-09-26)

2026-09-26 실측(`@Body()` 78개): 본문이 없던 3곳(`rotate-bot-token`, 실행 `continue`, 웹훅 수신)을 채운 뒤 DTO 클래스 74, 인라인 타입과 `@ApiBody` 4 로 빈 자리가 0이 됐다.

- **클래스로 받게 강제하지 않는다.** 전역 `CustomValidationPipe` 는 파라미터 설계 타입이 클래스일 때만 들어가고 들어가면 `whitelist`·`forbidNonWhitelisted` 가 켜진다. 인라인 타입으로 받던 라우트를 클래스로 바꾸면 문서를 다는 작업이 **계약 변경**이 된다. `rotate-bot-token` 은 문자열이 아닌 `newBotToken` 에 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 이 약속한 `INVALID_BOT_TOKEN` 대신 `VALIDATION_ERROR` 를 내고 여분 키를 보내던 요청이 400 이 된다. 그래서 "요청 DTO 승격" 처방을 택하지 않고 문서 전용 DTO 를 `@ApiBody` 로만 쓴다. 선례는 `ExecuteWorkflowDto`(워크플로우 실행 본문, 캐너리 `workflows-execute-body.spec.ts`)다.
- **`schema: {}` 와 열린 map 은 다르다.** 본문이 객체라는 것조차 보장되지 않으면(웹훅은 JSON 배열이나 원시값도 온다) `@ApiBody({ schema: {} })` 로 "임의 값" 을 적는다. 객체는 보장되고 키만 열려 있으면 [DTO 패턴 §1-4](CLE-API-SWAGGER-DTO.md#1-4-nested-enum-union) 의 `additionalProperties: true` 다.
- **reflection 으로 센다.** 판정 축은 파이프가 받는 바로 그 값이어야 한다. 파이프는 `design:paramtypes` 가 `Object`·`String`·`Number`·`Boolean`·`Array` 면 건너뛰고 그 자리는 플러그인도 스키마를 만들지 못한다. 가드는 파이프가 export 하는 그 목록을 그대로 쓴다. 소스(AST)로는 `interface` 나 타입 별칭 참조가 런타임에 `Object` 가 되는 것을 클래스 참조와 구별할 수 없다.
- **못 보는 것.** `@ApiBody` 가 **맞는** DTO 를 가리키는지는 라우트별 캐너리(`*-body.spec.ts`)가 본다. 이 가드는 광고가 **있는지**만 센다. 클래스 파라미터의 DTO 가 실제 본문과 맞는지도 이 가드 밖이다(요청 쪽 검증은 파이프가 한다).
