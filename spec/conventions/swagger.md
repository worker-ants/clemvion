---
id: swagger
status: implemented
code:
  - codebase/backend/src/common/swagger/**
  - codebase/backend/nest-cli.json
  - codebase/backend/src/common/config/production-guards.ts
  - codebase/backend/src/main.ts
---

# Swagger 문서화 일관된 패턴 가이드

본 프로젝트는 `@nestjs/swagger` CLI 플러그인을 **이미 활성화**했습니다 (`codebase/backend/nest-cli.json`).
플러그인은 아래를 자동 처리합니다:
- DTO 파일(`*.dto.ts`)에서 `class-validator` 데코레이터 → `@ApiProperty` 자동 생성
- 파라미터 타입, `?` 유무, enum, min/max 등 기본 메타 추론
- JSDoc `/** ... */` 주석 → `description` 필드로 전환 (`introspectComments: true`)

따라서 **DTO에서는 JSDoc 주석을 추가**하고, 설명만으로 부족한 경우에만 `@ApiProperty({ ... })`로 예시(example), enum, format 등을 보강합니다.

---

## 0) Swagger UI 노출 정책 (non-production 전용 — refactor 04 M-1)

Swagger UI(`/docs`)는 **non-production 에서만 노출**한다. `NODE_ENV=production` 에서는 무인증 API 표면 정찰(엔드포인트·DTO 구조 노출, OWASP 정보 노출)을 막기 위해 **기본 미노출**이며, 게이팅 판정은 `production-guards.ts` 의 `isSwaggerEnabled(env)` 단일 함수가 담당한다 (OAUTH/LLM stub 가드와 동형 패턴).

production 에서 일시적 디버깅이 필요하면 `ENABLE_SWAGGER_IN_PROD=true`(정확히 `true`/`1`) opt-in escape hatch 로 켠다 — 켜는 순간 무인증 노출 위험이 복귀하므로 일시적 용도로만 쓴다. (opt-in 시에도 IP 제한·Basic Auth 등 추가 보호는 없으므로 운영자가 별도로 전치한다.)

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

**닫힌 union (variant 집합이 코드로 확정)** — variant 별 DTO 클래스를 만들고, 클래스에 `@ApiExtraModels`, 필드에 `oneOf` + `getSchemaPath` 를 건다.

```ts
@ApiExtraModels(ButtonsContextDto, NodeOutputContextDto)
export class ExecutionStatusDto {
  /** waiting_for_input 시의 인터랙션 표면. 노드 종류에 따라 두 변형 중 하나. */
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(ButtonsContextDto) },
      { $ref: getSchemaPath(NodeOutputContextDto) },
    ],
    nullable: true,
  })
  context: ButtonsContextDto | NodeOutputContextDto | null;
}
```

> **`@ApiPropertyOptional` 이 아니라 `@ApiProperty({ nullable: true })` 인 이유**: 이 필드는
> **상시 존재**하고 값만 없을 수 있다 — EIA 응답 wire 가 `"context": { … } | null` 이다
> ([§14 EIA §5.3](../5-system/14-external-interaction-api.md)). `@ApiPropertyOptional` 은
> `ApiProperty({ required: false })` 의 별칭이라 쓰면 OpenAPI 가 키를 optional 로 문서화한다.
> 부재 표현 판정과 선언 형태의 SoT: [API 규약 §5.4](../5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략).

- variant 를 **한 필드 값으로 무손실 판별**할 수 있을 때만 `discriminator: { propertyName }` 을 덧붙인다. 판별 필드가 variant 간에 값을 공유하면(= 판별자가 unsound) `discriminator` 를 **생략**한다 — 선언해 두면 SDK 생성기가 잘못 narrowing 해 런타임 `undefined` 접근을 만든다. 근거: [§Rationale — discriminator 는 판별자가 sound 할 때만](#discriminator-는-판별자가-sound-할-때만-1-4).
- 응답 **body 전체**가 union 이면 property 레벨 대신 공용 헬퍼 `ApiOkWrappedOneOfResponse` (§5-2) 를 쓴다.

**열린/동적 map (키 집합이 런타임 결정)** — `@ApiProperty({ type: 'object', additionalProperties: true })`.

- 노드 타입별 자유 payload(`nodeOutput`), 사용자 정의 변수 맵 등 **실제로 키가 열려 있는** 경우에 한한다.
- **"타입을 특정하기 번거롭다"는 사유로 쓰지 않는다** — variant 집합이 코드로 확정되면 위 닫힌 union 항목이 맞다. (§6 의 "빈 껍데기 스키마 금지"와 같은 취지.)
- **예외 — 형태는 고정이나 SoT 이중화 회피로 여는 경우**: 필드의 형태가 **다른 SoT 문서에 이미 규정**돼 있고(예: EIA `getStatus` 응답의 `conversationThread` — 형태 SoT 는 [conversation-thread §1.3](./conversation-thread.md#13-conversationthread)), 그 형태를 DTO 로 다시 선언하면 두 곳을 손으로 동기화해야 하는 경우엔 열린 map(`additionalProperties`)을 유지할 수 있다. 이는 위 "번거로움" 금지의 예외 — 사유가 "타입 특정이 번거롭다"가 아니라 **"타입이 다른 SoT 에 이미 있어 재선언이 이중화"** 이기 때문이다. 이 예외를 쓸 때는 해당 DTO 의 `## Rationale` 에 "형태는 고정이지만 SoT 이중화 회피로 연다"는 근거를 명시해, 본 절만 읽고 §1-4 위반으로 오독되지 않게 한다.

> **적용 범위 — 신규 변경 한정**: 기존 `additionalProperties: true` 필드를 일괄 소급 스키마화하지 않는다. 본 절의 가치는 "이미 있는 것의 정리"가 아니라 "앞으로의 불투명 누적 방지"다 ([`execution-context.md`](./execution-context.md) §원칙 3 과 동일 취지).

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
`access-token`은 `main.ts`에서 등록한 Bearer scheme 이름입니다 (`.addBearerAuth({ scheme: 'bearer', bearerFormat: 'JWT', ... }, 'access-token')`).
`main.ts`는 추가로 **`interaction-token`** Bearer scheme 도 등록합니다 — External Interaction API 전용으로 `iext_<JWT>`(per_execution) / `itk_<opaque>`(per_trigger) 토큰을 받습니다. 해당 엔드포인트는 `@ApiBearerAuth('interaction-token')`을 사용합니다.
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
프로젝트는 `TransformInterceptor`로 성공 응답을 `{ data: ... }`로 감쌉니다. **단, 반환 객체에 이미 top-level `data` 키가 있으면(`'data' in data` 분기) 추가 래핑 없이 그대로 pass-through 합니다** — 페이지네이션 `PaginatedResponseDto`(`{ data, pagination }`)가 대표 사례이며, 그래서 그 wire shape 는 double-wrap 이 아니라 single-wrap `{ data: [...], pagination }` 다(§5-2 `ApiOkPaginatedResponse`). 비-페이징 고정 컬렉션(활성 세션·WebAuthn credential 목록)이 `{ data: { items } }` 를 직접 반환하는 경우도 동일 pass-through 분기를 탄다([api-convention §5.2](../5-system/2-api-convention.md#52-목록-응답) 비-페이징 고정 컬렉션). Swagger 응답 스키마 표기 시에도 이 구조를 반영합니다. 단순 텍스트 설명으로 끝내거나, 필요 시 다음과 같이 표현:

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
- 가능하면 "무엇을 하는지 + 제약/부수효과"를 담습니다

**길이 — 강제되는 것과 지향하는 것을 가른다** (2026-08-23 개정):

| 대상 | 길이 | 성격 |
| --- | --- | --- |
| 엔드포인트 `summary` | 10~20자 | **강제** — 목록 UI 에서 잘린다 |
| 엔드포인트 `description` | 50~150자 | **강제** |
| DTO `description` | 한 줄 요약 지향 (대략 40자) | **지향** — 상한이 아니다 |

DTO `description` 은 *"한 줄로 읽히는가"* 가 기준이지 글자 수가 아니다. 필드의 제약·부수효과를
담느라 길어지는 것은 위반이 아니며, 아래 보안·정책 캐비엇은 애초에 길이 논의 밖이다.

> 근거: [§Rationale — §3 DTO 길이는 왜 강제가 아닌가](#3-dto-길이는-왜-강제가-아닌가)

> **반드시 적는다 — 보안·정책 캐비엇** (2026-08-17 규약화 · 2026-08-22 요청 필드까지 확장·
> 2026-08-23 "예외"→"적극 지시" 재정의):
> 아래 두 부류는 **길이를 이유로 줄이지 않는다.** 짧게 쓰면 정보가 사라지는 자리다.
>
> DTO 길이가 강제가 아니게 된 이상(위 표) *"예외"* 라는 틀은 성립하지 않는다 — 없는 상한을
> 면제할 수는 없다. 그래서 **면제가 아니라 지시**로 뒤집는다: 다른 필드는 짧게 써도 되지만
> 이 둘은 **길어도 적어야 한다.**
>
> | 부류 | 소비자가 그 설명 없이는 못 알아내는 것 |
> | --- | --- |
> | **응답** 값이 저장된 값과 다를 수 있는 필드 (egress 마스킹 대상 등) | *"왜 DB 와 값이 다른가"* |
> | **요청** 값이 정책으로 거부될 수 있는 필드 (예약어·재제출 금지 값 등) | *"왜 이 값을 보내면 400 인가"* |
>
> 다만 **상세 근거는 spec 본문에 두고 여기서는 요약 1~2문장 + SoT 링크**로 적는다.
>
> 근거: [§Rationale — §3 보안·정책 캐비엇](#3-보안정책-캐비엇--왜-길이를-이유로-줄이지-않는가-그리고-왜-양방향인가)

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

**형제 DTO 가 같은 enum 을 공유하면 `*.literal.ts` 로 뺍니다.** 두 개 이상의 응답 DTO 가
동일한 값 집합을 노출할 때, 각 DTO 가 유니온 타입과 swagger `enum` 배열을 **각자 선언하면
값이 바뀔 때 여러 곳을 손으로 맞춰야 하고 한쪽만 고쳐도 아무도 모릅니다.** 같은
`dto/responses/` 아래 `<name>.literal.ts` 에 값 배열 + 파생 타입을 두고 형제들이 import 합니다.

```ts
// dto/responses/execution-status.literal.ts  — wire SoT
export const EIA_EXECUTION_STATUS_VALUES = ['pending', 'running', /* … */] as const;
export type ExecutionStatusLiteral = (typeof EIA_EXECUTION_STATUS_VALUES)[number];

// 형제 DTO 들
@ApiProperty({ enum: EIA_EXECUTION_STATUS_VALUES })
status: ExecutionStatusLiteral;
```

- **엔티티 enum 에서 파생하지 않습니다.** (a) DTO 레이어가 엔티티에 결합되지 않아야 하고
  (위 항목), (b) 엔티티 enum 의 **선언 순서가 wire enum 배열 순서를 바꿔** OpenAPI 산출물이
  엔티티 리팩터에 흔들립니다. 로컬 리터럴이 wire SoT 입니다.
- **이름 충돌을 피합니다.** 도메인 접두(`EIA_` 등)로 다른 모듈의 동명 상수와 grep 을 가르고,
  `Literal` 접미로 TypeORM 엔티티 enum 과 타입명을 가릅니다.
- 값이 **한 DTO 에만** 쓰이면 굳이 빼지 않습니다 — 공유가 생기는 시점이 분리 시점입니다.

### 5-2. 공용 래퍼 헬퍼
`codebase/backend/src/common/swagger/` 에서 다음을 제공합니다 (import: `from '../../common/swagger'`).

| 헬퍼 | 용도 | 반환 스키마 |
|------|------|------------|
| `ApiOkWrappedResponse(Dto)` | 단일 객체 200 OK | `{ data: <Dto> }` |
| `ApiOkWrappedOneOfResponse([DtoA, DtoB], { discriminator })` | 200 OK, `data` 가 여러 DTO 중 하나 (예: OAuth begin 분기 응답) | `{ data: oneOf(<DtoA>, <DtoB>) }` (`wrapOneOfDataSchema`) |
| `ApiCreatedWrappedResponse(Dto)` | 단일 객체 201 Created | `{ data: <Dto> }` |
| `ApiAcceptedWrappedResponse(Dto)` | 단일 객체 202 Accepted | `{ data: <Dto> }` |
| `ApiOkWrappedArrayResponse(Dto)` | 배열 200 OK | `{ data: <Dto>[] }` |
| `ApiOkPaginatedResponse(Dto)` | 페이지네이션 200 OK | `{ data: <Dto>[], pagination: { page, limit, totalItems, totalPages } }` (공용 `PaginatedResponseDto` — `data`·`pagination` top-level single-wrap, §2-5 pass-through) |

각 헬퍼는 내부에서 `ApiExtraModels(Dto)` + `getSchemaPath(Dto)` 를 자동 수행합니다.

> 위 표는 `common/swagger/` 가 export 하는 **호출형 헬퍼 함수**의 인벤토리다. 응답 body 전체가 아니라 **DTO 의 한 필드**가 닫힌 union 인 경우는 대응 헬퍼가 없고, `@ApiExtraModels` + `@ApiProperty({ oneOf: [...] })` 데코레이터 조합을 직접 쓴다 (§1-4).

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
- [ ] `@Roles(...)` 가 붙었거나 `@WorkspaceId()` 를 소비하는 엔드포인트는
      `@ApiForbiddenResponse` 도 추가 — `RolesGuard` 는 `@Roles()` 유무와 무관하게
      워크스페이스 멤버십을 항상 검증하므로
      ([data-flow §Rationale 멤버십 검증은 가드 1곳에서](../data-flow/12-workspace.md#멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08)), `@WorkspaceId()` 만 쓰는 조회
      엔드포인트도 403 을 낼 수 있다. `@Roles()` 가 있으면 설명에 "editor 이상 권한
      필요"처럼 요구 역할을 명시하고, `@Roles()` 없이 `@WorkspaceId()` 만 쓰면
      "워크스페이스 멤버가 아님"으로 통일한다. (`@Public()` 라우트는 대상 아님.)
- [ ] 경로 UUID 파라미터는 `@ApiParam({ format: 'uuid' })` 일관 적용

### 5-5. 에러 응답 참조
`codebase/backend/src/common/swagger/error-response.dto.ts` 의 `ErrorResponseDto` 는 `GlobalExceptionFilter` 출력을 1:1 로 표현합니다. 필요 시 `@ApiBadRequestResponse({ type: ErrorResponseDto })` 등으로 참조할 수 있습니다.

---

## 6) 레거시 패턴 제거
- `@ApiOkResponse({ schema: { type: 'object', properties: { data: { type: 'object' } } } })` 같은 "빈 껍데기" 는 반드시 DTO 기반 래퍼로 교체하세요.
- `{ data: { items, totalItems, page, limit } }` 처럼 서비스 실제 반환 형태(`{ data, pagination }`) 와 다른 스키마는 버그입니다 — `ApiOkPaginatedResponse` 로 교체. 단, `pagination` 필드가 전혀 없는 순수 `{ data: { items } }`(비-페이징 고정 컬렉션 — 활성 세션·WebAuthn credential 목록)는 이 버그 패턴이 아니라 §2-5 의 정상 pass-through 사례다([api-convention §5.2](../5-system/2-api-convention.md#52-목록-응답)) — reflatten 하지 말 것.

---

## Rationale

### §0 Swagger UI production 비노출 + opt-in (refactor 04 M-1)
Swagger UI 의 production 기본 미노출은 무인증 API 표면 정찰(엔드포인트·DTO 구조 노출)을 차단하기 위함이다. 게이팅을 `isSwaggerEnabled(env)` 단일 함수로 분리한 이유는 OAUTH/LLM stub 가드와 **동형 패턴**(`NODE_ENV` 기반 분기 + opt-in env)으로 통일해 운영자 멘탈 모델을 단일화하고 단위 테스트로 분기를 고정하기 위함이다.

`ENABLE_SWAGGER_IN_PROD` opt-in 을 둔 이유: prod 디버깅 요구를 흡수하되 기본값은 안전하게 둔다. opt-in 시 IP 제한·Basic Auth 등 추가 인증 계층을 **기본 제공하지 않는 이유**는, prod 노출 자체가 spec 어디에도 상시 요구로 기록되지 않은 예외적 디버깅 용도이기 때문이다 — 인증 계층 구현은 그 요구가 상시화될 때 검토한다(현 시점 과투자 회피). 켜는 순간 무인증 노출 위험이 복귀하므로 일시적 용도로 한정하고, 필요 시 운영자가 reverse proxy 단에서 보호를 전치한다.

### §1-4 닫힌 union 을 `additionalProperties` 로 뭉개지 않는다

종전 §1-4 는 "union 또는 dynamic" 을 한 줄로 묶어 둘 다 `additionalProperties: true` 로 안내했다. 그 결과 **variant 집합이 코드로 확정된 필드**까지 Swagger 상 빈 객체로 노출돼, 생성 SDK·손수 작성 클라이언트 타입이 wire 와 드리프트해도 잡히지 않았다. 실증 사례: EIA `getStatus` 의 `context` 가 `Record<string, unknown> | null` 로 선언된 동안, 위젯의 `eia-types.ts` 는 형제 필드 `currentNode` 를 `string | null` 로 잘못 선언했고(실제 wire 는 객체) 아무 검증도 이를 포착하지 못했다. 코드는 이미 규약보다 앞서 있었다 — `api-wrapped.ts` 의 `ApiOkWrappedOneOfResponse` 가 **응답 레벨** `oneOf` 를 제공하고 있었고, 없던 것은 **property 레벨** 대응물뿐이었다.

"열림"은 **키 집합이 런타임에 결정된다**는 사실 진술이지, 타입을 적기 번거롭다는 편의 표현이 아니다. 두 경우를 문장 하나로 묶어 둔 것이 혼동의 원인이었으므로 절을 분리했다. 다만 기존 필드의 일괄 소급 재선언은 요구하지 않는다 — [`execution-context.md`](./execution-context.md) §원칙 3 이 같은 이유(광범위 회귀 위험 대비 낮은 효용)로 신규 변경에만 분류 규칙을 적용하는 것과 동형이다.

### `discriminator` 는 판별자가 sound 할 때만 (§1-4)

OpenAPI `discriminator.propertyName` 은 "그 필드 값 → variant" 매핑이 **전단사**임을 SDK 생성기에 약속한다. 약속이 깨지면 생성기는 조용히 잘못된 variant 로 narrowing 한다.

EIA `getStatus.context` 가 그 반례다. `interactionType` 은 언뜻 판별자로 보이지만, `buttons` 는 `buttonConfig` 를 실은 변형과 (핸들러가 `buttonConfig` 를 싣지 못해 fallthrough 한) `nodeOutput` 변형 **양쪽**에 나타난다. `discriminator: { propertyName: 'interactionType' }` 을 선언하면 SDK 는 모든 `buttons` 응답을 `buttonConfig` 변형으로 narrowing 하고, fallthrough 케이스에서 `context.buttonConfig.buttons` 접근이 런타임 `undefined` 가 된다. 따라서 `oneOf` 만 선언하고 판별은 **키 존재**(`'buttonConfig' in context`)로 남긴다.

fallthrough 자체를 없애 판별자를 sound 하게 만드는 대안은 wire 변경이라 [EIA §5.3/§R17](../5-system/14-external-interaction-api.md) 의 SSE parity 계약을 건드린다 — 별건으로 둔다. 본 규칙은 `api-wrapped.ts` `wrapOneOfDataSchema` 의 기존 JSDoc("호출자는 모든 DTO 가 동일 `propertyName` 필드를 보유함을 보장해야 한다")을 규약 레벨로 승격한 것이다.

### 왜 EIA `context` 는 봉투만 스키마화하고 내부는 열어 두는가 (§1-4)

`nodeOutput` 과 `buttonConfig.buttons` 는 노드 타입별 자유 payload(`formConfig`/`conversationConfig`/임의 키)로, §1-4 가 말하는 **진짜 열린 map** 이다. 클래스로 고정하면 노드 타입이 늘 때마다 DTO 가 따라 늘고, 공용 노드 output 규약([`./node-output.md`](./node-output.md) — `1-node-common.md` 등 여러 노드 문서가 참조하는 독립 conventions 문서)과 SoT 가 이중화된다. 봉투(`interactionType`/`waitingNodeId`/`conversationThread`/변형 키)만 닫고 내부는 열어 두는 것이 두 규약의 책임 경계와 일치한다.

같은 이유로 `ConversationThreadDto` 도 만들지 않는다 — [`./conversation-thread.md`](./conversation-thread.md) **§1.3(자료구조)** 이 thread shape(`turns[]`/`source`/`totalChars`/`nextSeq`)의 SoT 이고(§4 는 영속화 단계, §8.4 는 durable 컬럼 채택 근거), Swagger DTO 로 재선언하면 두 문서가 갈린다. 봉투에서는 open object 로 두고 description 이 `conversation-thread.md` 를 지목한다.

### §3 DTO 길이는 왜 강제가 아닌가

**실측이 먼저다** (2026-08-23):

> **집계 기준을 적어 둔다 — 안 적으면 재현이 안 된다.** 실제로 이 숫자를 독립 재집계한
> 리뷰어가 다른 값(요청 ≈118/368)을 얻었고, 원인은 아래 세 가지를 서로 다르게 잡았기
> 때문이다. 방향(대량 초과)은 재현됐지만 절대값은 기준에 민감하다.
>
> 1. 대상: `codebase/backend/src/**/dto/**/*.dto.ts` (다른 위치의 DTO 는 제외)
> 2. 요청/응답 분류: 경로에 `/responses/` 가 있거나 파일명이 `-response.dto.ts` 면 응답
> 3. 길이: `description:` 에 이어지는 **연결된 문자열 리터럴을 모두 이어 붙인 뒤** 글자 수를
>    센다(`'a' + 'b'` → `ab`). 템플릿 리터럴·변수 참조는 세지 않는다

| 범위 | 40자 초과 |
| --- | --- |
| 요청 DTO | 116/335 (34%) |
| 응답 DTO | 58/128 (**45%**) |
| 전체 | **174/463 (37%)** |

> 위 §3 캐비엇 Rationale 의 `114/333` 은 **2026-08-22 시점** 실측이고, 이 표는
> **2026-08-23 재실측**이다. 차이(+2/+2)는 그 사이 두 PR 이 `ReRunRequestDto`·
> `ExecuteWorkflowDto` 에 필드 설명을 더한 것이다 — 모집단이 바뀐 것이지 어느 쪽이 틀린 게
> 아니다. 백분율이 우연히 둘 다 34% 라 눈에 안 띄므로 적어 둔다.

**37% 미준수는 "규칙이 안 지켜진다" 가 아니라 "그건 규칙이 아니었다" 는 뜻이다.** 종전 문면도
이미 `10~40자 **내외**` 로 완충을 달고 있어, 강제할 의도가 아니었음을 스스로 드러내고 있었다.

세 갈래를 놓고 골랐다:

| 대안 | 기각 사유 |
| --- | --- |
| 수치를 현실에 맞게 **올린다** | 새 숫자도 근거 없이 임의적이다. 같은 문제가 몇 달 뒤 반복된다 |
| 규칙 유지 + **초과분 174건 정리** | §3 스스로 *"소비자가 알 방법이 그 설명뿐"* 이라 한 정보를 지우게 된다. 비용도 크다 |
| **강제 아님을 명문화** ← 채택 | 문면이 현실과 의도 양쪽에 맞는다 |

이는 §3 이 자기 예외를 도입할 때 쓴 *"새로 만든 관행이 아니라 **이미 굳은 관행의 추인**"*
논리를 **기본 규칙에도 같이 적용**한 것이다 — 예외만 추인하고 본칙은 방치하면, 규약이 한쪽
발만 현실에 딛게 된다.

**강제는 남겨 둔 곳이 있다.** 엔드포인트 `summary` 는 목록 UI 에서 잘리므로 길이가 **기능적
제약**이다. DTO `description` 은 그렇지 않다 — 그 차이가 강제/지향을 가르는 기준이다.

> **이 문서가 스스로 남겨 둔 유보를 해제하는 것이다.** 2026-08-22 개정이 아래 §3 캐비엇
> Rationale 에 이렇게 적어 뒀다:
>
> > *"위 34% 는 보안·정책 캐비엇 클래스보다 넓다. 즉 `10~40자` **기본 수치 규칙 자체**가
> > 현실과 벌어져 있을 수 있는데, 그건 이 예외의 문제가 아니라 별개 판단이라 여기서 건드리지
> > 않는다."*
>
> 그 *"별개 판단"* 이 2026-08-23 사용자 택일로 내려졌고, 이 절이 그 답이다. 유보를 남긴
> 문단은 그대로 두되 **여기서 해소됐음을 명시**한다 — 유보 문구만 남고 답이 어디 있는지
> 모르면 다음 사람이 같은 조사를 반복한다.

**`deprecated` 패턴은 아직 §1 로 일반화하지 않는다.** 같은 날 `ExecuteWorkflowDto.input` 이
형제와의 동명이의를 `deprecated: true` 로 해소했지만(리네임은 와이어 계약을 깨므로 기각),
**사례가 하나뿐**이다. rule of three 를 채우기 전에 규칙으로 올리면 다음 사례가 이 형태와
다를 때 규칙이 먼저 틀린다 — 세 번째 사례가 나오면 §1 에 소절로 승격한다.

> **인접 선례를 같이 세어 둔다** (`12_45_36` rationale_continuity INFO):
> [`cafe24-api-metadata.md`](./cafe24-api-metadata.md) 는 같은 상황에서 **필드를 제거**했다
> (backend `label` → frontend i18n dict 단일 SoT). 방향이 다른 이유는 명확하다 — 그쪽은
> **내부 메타데이터**라 제거 비용이 작았고, `ExecuteWorkflowDto.input` 은 **공개 wire
> 필드**라 제거라는 선택지가 애초에 없다. 즉 두 사례는 같은 규칙의 두 사례가 아니라
> **다른 문제**이고, rule of three 를 셀 때 이걸 한 칸으로 합치면 안 된다.

### §3 보안·정책 캐비엇 — 왜 길이를 이유로 줄이지 않는가, 그리고 왜 양방향인가

**왜 이 자리는 길어도 되는가** (2026-08-17 도입 · 2026-08-23 프레이밍 정정): 소비자가 OpenAPI
만 보고 통합할 때, *"이 필드는 내가 저장한 값과 다르게 돌아온다"* 를 알 방법이 **그
`description` 뿐**이다. 짧은 한 줄에 그 사실과 이유를 동시에 담을 수 없다.

> **2026-08-17~08-22 에는 이걸 "예외" 라고 불렀다.** 그땐 DTO 길이가 강제 상한이었으니 면제가
> 맞는 틀이었다. 2026-08-23 개정으로 그 상한이 **지향**이 되면서 면제할 대상이 사라졌고,
> 그래서 같은 내용이 *"면제"* 가 아니라 **"이 둘은 길어도 반드시 적어라"** 는 **지시**로
> 뒤집혔다(§3 본문 콜아웃). 내용은 그대로고 **틀만 바뀌었다** — 아래 논거는 두 틀 모두에서
> 그대로 성립한다.

**새 관행이 아니라 추인이었다** — 도입 시점 실측으로 이미 9곳 이상의 DTO 가 이 형태를 쓰고
있었고(`execution-response.dto.ts` · `background-run-response.dto.ts` 등) 두 라운드 연속
규약 위반으로 지적됐다. 규약이 현실을 반영하도록 고친 것이다.

**왜 요청 필드까지 넓혔나** (2026-08-22): 논거가 **대칭**인데 문면만 한쪽이었다. 응답 쪽
질문이 *"왜 DB 와 값이 다른가"* 라면 요청 쪽은 *"왜 이 값을 보내면 400 인가"* 이고, 소비자가
알 방법이 그 설명뿐이라는 점도 같다. 계기는 `ReRunRequestDto.inputOverride` 로, 마스킹 마커와
정확히 일치하는 값이 `MASKED_VALUE_RESUBMITTED` 로 거부된다는 사실을 적어야 했는데 이건
응답이 아니라 **요청이 거부되는 규칙**이라 기존 문면이 못 덮었다(SoT:
[EIA §R17](../5-system/14-external-interaction-api.md)).

**요청 쪽도 똑같이 "추인" 이다** (2026-08-22 실측 — `codebase/backend/src/**/dto/**/*.dto.ts`
중 `responses/` 및 `*-response.dto.ts` 제외): 요청 DTO 73개 파일의 `description` 333개 중
**114개(34%)가 40자를 넘는다**. 최장은 `chat-channel-config.dto.ts` 435자이고, 상위권에는 이
예외가 겨냥한 바로 그 클래스가 있다 — `create-auth-config.dto.ts`(248자, 인증 상세 설정) ·
`chat-channel-config.dto.ts`(386자, provider 발급 webhook 인증 자료).

> **넓히지 않은 것**: 위 34% 는 보안·정책 캐비엇 클래스보다 넓다. 즉 `10~40자` **기본 수치
> 규칙 자체**가 현실과 벌어져 있을 수 있는데, 그건 이 예외의 문제가 아니라 별개 판단이라
> 여기서 건드리지 않는다.

### §5 ApiOkPaginatedResponse single-wrap (pass-through 예외)
`ApiOkPaginatedResponse` 가 문서화하는 wire shape 는 **single-wrap** `{ data: <Dto>[], pagination }` 다(§5-2). 페이지네이션 핸들러는 공용 `PaginatedResponseDto`(`{ data, pagination }` — top-level `data` 키 보유)를 반환하고, `TransformInterceptor` 는 이미 `data` 키가 있는 객체를 추가 래핑 없이 pass-through(`'data' in data` 분기)하므로, §2-5 의 "성공 응답을 `{ data }` 로 감싼다"는 보편 규칙의 **주요 pass-through 사례**가 된다(두 번째 사례: 비-페이징 고정 컬렉션이 `{ data: { items } }` 를 직접 반환하는 경우 — [api-convention §5.2](../5-system/2-api-convention.md#52-목록-응답) 비-페이징 고정 컬렉션. `pagination` 필드가 없어 이 §5 페이징 pass-through 와는 형태가 다르다). 종전 헬퍼가 선언하던 double-wrap `{ data: { data, pagination } }` 은 의도된 결정이 아니라 pass-through 를 간과한 **버그**였다 — 실제 런타임(`PaginatedResponseDto`+interceptor)·e2e(`res.body.data`/`res.body.pagination` top-level)·`api-convention §5.2` 가 모두 single-wrap 이라 헬퍼·§5-2 를 그에 맞춰 정정했다. **single-wrap 을 double-wrap 으로 되돌리지 말 것** — 런타임과 어긋난다.

### §5-4 확장 배경 — `@WorkspaceId()` 소비 라우트로 확대 (2026-08-08)
종전 §5-4 는 "`@Roles()` 가 있어야 403 이 가능하다"는 **opt-in 가드 모델**을 전제로 적혔다. `auth-workspace-membership-guard` PR (보안 CRITICAL fix)이 `RolesGuard` 를 **opt-out 불가능한** 구조로 재구성하면서 그 전제가 깨졌다 — 멤버십 검증이 `@Roles()` 유무와 무관하게 항상 수행되므로 `@WorkspaceId()` 만 쓰는 조회 엔드포인트도 403 을 낼 수 있다(정본: [data-flow §Rationale "멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관"](../data-flow/12-workspace.md#멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08)). 이 정정은 동작 변경이 아니라 **문서-구현 동기화**다. **왜 규약 문구까지 고치는가**: §5-4 는 신규 엔드포인트 작성 시 판단 기준으로 쓰이는데, 문구가 실제 403 발생 조건과 어긋나면 규약을 그대로 따른 다음 작성자에게서 같은 갭이 재발한다 — "사람이 규칙을 기억해야 하는 opt-in" 구조를 규약 레벨에서 반복하지 않는다(그 PR 이 코드에서 닫은 것과 같은 결함 클래스).
