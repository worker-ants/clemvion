---
id: swagger
status: spec-only
code: []
---

# Swagger 문서화 일관된 패턴 가이드

본 프로젝트는 `@nestjs/swagger` CLI 플러그인을 **이미 활성화**했습니다 (`codebase/backend/nest-cli.json`).
플러그인은 아래를 자동 처리합니다:
- DTO 파일(`*.dto.ts`)에서 `class-validator` 데코레이터 → `@ApiProperty` 자동 생성
- 파라미터 타입, `?` 유무, enum, min/max 등 기본 메타 추론
- JSDoc `/** ... */` 주석 → `description` 필드로 전환 (`introspectComments: true`)

따라서 **DTO에서는 JSDoc 주석을 추가**하고, 설명만으로 부족한 경우에만 `@ApiProperty({ ... })`로 예시(example), enum, format 등을 보강합니다.

---

## 1) DTO 패턴

### 1-1. 모든 필드에 JSDoc 추가 (한국어)
```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  /** 사용자 표시 이름 (2~50자) */
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  /** 로그인 이메일 주소 (중복 불가) */
  @IsEmail()
  email: string;

  /** 비밀번호 (8~100자, 영문 대/소문자·숫자·특수문자 중 3종 이상) */
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  /** 서비스 이용 약관 동의 여부 (true 필수) */
  @IsBoolean()
  termsAccepted: boolean;
}
```

### 1-2. 예시가 필요한 경우 `@ApiProperty` 추가 보강
```ts
/** 사용자 표시 이름 */
@ApiProperty({
  description: '사용자 표시 이름',
  example: '홍길동',
  minLength: 2,
  maxLength: 50,
})
@IsString()
@MinLength(2)
@MaxLength(50)
name: string;
```

### 1-3. Optional 필드
```ts
/** 정렬 방향 (asc | desc) */
@ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
@IsOptional()
@IsIn(['asc', 'desc'])
order?: 'asc' | 'desc';
```

### 1-4. nested / enum / union
- enum: `@ApiProperty({ enum: MyEnum, enumName: 'MyEnum' })`
- nested object: `@ApiProperty({ type: () => NestedDto })`
- union 또는 dynamic: `@ApiProperty({ type: 'object', additionalProperties: true })`

### 1-5. `writeOnly` / `readOnly` — 보안 민감 + 응답 sanitize 필드

Swagger UI 의 request/response 스키마 분리를 활용해 보안 민감 입력 / 자동 발급 응답 필드를 명시:

- **`writeOnly: true`** — 입력 전용. 응답 스키마에서 자동 제외. 사용처: 사용자가 입력하지만 응답에 절대 노출되지 않는 보안 민감 자료 (bot token plaintext, signing secret plaintext, 비밀번호 등).
- **`readOnly: true`** — 응답 전용. 입력 스키마에서 자동 제외. 사용처: 서버가 자동 발급하는 ID / 타임스탬프 / derived field.

```ts
/**
 * 입력 전용 — 서버가 secret store 로 옮긴 뒤 응답에서 strip.
 */
@ApiPropertyOptional({
  description: 'Provider 발급 plaintext (slack signing secret / discord public key)',
  writeOnly: true,
  minLength: 32,
  maxLength: 128,
})
@IsOptional()
@IsString()
@MinLength(32)
@MaxLength(128)
inboundSigningPlaintext?: string;

/**
 * 응답 전용 — 서버가 hasBotToken: botTokenRef !== null 로 자동 계산.
 */
@ApiProperty({
  description: 'Bot token 이 secret store 에 저장됐는지 여부 (derived)',
  readOnly: true,
})
hasBotToken: boolean;
```

**의무**: secret store 입력 plaintext (e.g. `botToken`, `inboundSigningPlaintext`) 필드는 항상 `writeOnly: true` 동반. 서버 derived field (`hasBotToken`, `id`, `createdAt` 등) 는 응답 DTO 한정으로 `readOnly: true` 동반. SoT 는 본 절.

---

## 2) Controller 패턴

### 2-1. 상단에 `@ApiTags` + `@ApiBearerAuth('access-token')`
`access-token`은 `main.ts`에서 등록한 Bearer scheme 이름입니다.
`@Public()` 전용 컨트롤러(auth, health, hooks)는 `@ApiBearerAuth`를 **넣지 않습니다**.
혼합 컨트롤러는 클래스 레벨 `@ApiBearerAuth('access-token')`를 넣고, `@Public()` 엔드포인트에는 `@ApiSecurity({})` 대신 설명에서 '인증 불필요'를 명시합니다.

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

### 2-3. Path / Query 파라미터
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

> 쿼리 DTO를 사용하면 `@ApiQuery`를 생략해도 CLI 플러그인이 자동으로 문서화합니다. 굳이 중복해서 적지 않습니다.

### 2-4. 상태 코드 응답 규칙

| 상황 | 데코레이터 |
|------|-----------|
| 200 OK (조회/수정) | `@ApiOkResponse` |
| 201 Created | `@ApiCreatedResponse` |
| 204 No Content | `@ApiNoContentResponse` |
| 400 검증 실패 | `@ApiBadRequestResponse` |
| 401 인증 실패 | `@ApiUnauthorizedResponse` |
| 403 권한 부족 | `@ApiForbiddenResponse` |
| 404 없음 | `@ApiNotFoundResponse` |
| 409 중복/충돌 | `@ApiConflictResponse` |

보호된 엔드포인트는 기본적으로 `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })`를 포함합니다.

### 2-5. 응답 wrapping
프로젝트는 `TransformInterceptor`로 모든 성공 응답을 `{ data: ... }`로 감쌉니다. Swagger 응답 스키마 표기 시에도 이 구조를 반영합니다. 단순 텍스트 설명으로 끝내거나, 필요 시 다음과 같이 표현:

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

구체적인 Response 클래스가 존재하면 `type: ResponseDto`로 참조합니다.

---

## 3) 주석/설명 톤
- 한국어, 간결, ~한다/합니다 혼용 가능 (기존 프로젝트 문서 스타일 유지)
- DTO `description`은 10~40자 내외
- `summary`는 10~20자 내외, `description`은 50~150자 내외
- 가능하면 "무엇을 하는지 + 제약/부수효과"를 담습니다

---

## 4) 엔드포인트별 요약 표

각 모듈 작업 시 다음 순서로 진행:
1. 컨트롤러 파일 읽기
2. DTO 파일 일괄 읽기
3. DTO 파일: JSDoc 및 필요한 `@ApiProperty(Optional)` 추가
4. 컨트롤러 클래스에 `@ApiTags`, `@ApiBearerAuth('access-token')` (보호된 경우)
5. 각 엔드포인트에 `@ApiOperation`, 파라미터, 응답 데코레이터 추가
6. `@Public()` 엔드포인트에는 `@ApiBearerAuth`를 생략 또는 설명으로 명시

---

## 5) 응답 DTO 규약

모든 성공 응답은 `@ApiOkResponse({ schema: ... })` 의 인라인 객체가 아닌 **응답 DTO 클래스 + 공용 래퍼 헬퍼** 를 사용합니다.

### 5-1. 응답 DTO 위치
- `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`
- 엔티티(`entities/*.entity.ts`) 를 그대로 노출하지 말고, API 응답 형태에 맞춰 별도 DTO 를 만듭니다. 비밀값(credentials, passwordHash 등)은 마스킹하거나 제외합니다.
- 중복 필드는 `PickType` / `OmitType` / `PartialType` (`@nestjs/swagger`) 로 재사용할 수 있습니다.

### 5-2. 공용 래퍼 헬퍼
`codebase/backend/src/common/swagger/` 에서 다음을 제공합니다 (import: `from '../../common/swagger'`).

| 헬퍼 | 용도 | 반환 스키마 |
|------|------|------------|
| `ApiOkWrappedResponse(Dto)` | 단일 객체 200 OK | `{ data: <Dto> }` |
| `ApiCreatedWrappedResponse(Dto)` | 단일 객체 201 Created | `{ data: <Dto> }` |
| `ApiAcceptedWrappedResponse(Dto)` | 단일 객체 202 Accepted | `{ data: <Dto> }` |
| `ApiOkWrappedArrayResponse(Dto)` | 배열 200 OK | `{ data: <Dto>[] }` |
| `ApiOkPaginatedResponse(Dto)` | 페이지네이션 200 OK | `{ data: { data: <Dto>[], pagination: { page, limit, totalItems, totalPages } } }` (공용 `PaginatedResponseDto` 형태) |

각 헬퍼는 내부에서 `ApiExtraModels(Dto)` + `getSchemaPath(Dto)` 를 자동 수행합니다.

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
- [ ] 응답 DTO 가 `dto/responses/` 에 있는지
- [ ] DTO 필드에 JSDoc + 필요 시 `@ApiProperty` (enum/example/format/nullable)
- [ ] `ApiOkWrappedResponse` / `ApiOkPaginatedResponse` 등 적절한 래퍼 사용
- [ ] `@Roles(...)` 가 붙은 엔드포인트는 `@ApiForbiddenResponse` 도 추가
- [ ] 경로 UUID 파라미터는 `@ApiParam({ format: 'uuid' })` 일관 적용

### 5-5. 에러 응답 참조
`codebase/backend/src/common/swagger/error-response.dto.ts` 의 `ErrorResponseDto` 는 `GlobalExceptionFilter` 출력을 1:1 로 표현합니다. 필요 시 `@ApiBadRequestResponse({ type: ErrorResponseDto })` 등으로 참조할 수 있습니다.

---

## 6) 레거시 패턴 제거
- `@ApiOkResponse({ schema: { type: 'object', properties: { data: { type: 'object' } } } })` 같은 "빈 껍데기" 는 반드시 DTO 기반 래퍼로 교체하세요.
- `{ data: { items, totalItems, page, limit } }` 처럼 서비스 실제 반환 형태(`{ data, pagination }`) 와 다른 스키마는 버그입니다 — `ApiOkPaginatedResponse` 로 교체.
