---
id: "CLE-API-SWAGGER"
title: "OpenAPI 문서화"
type: "convention"
version: 3
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API"
ancestors: ["CLE-VISION", "CLE-API"]
area: "CLE-API"
content_hash: "3865a9b5183f26965a85c437c12429e4d822ad8f3d17d20423a70bbcf9d42c06"
read_as: "approved_fallback"
task: "CLE-T-RSF163"
source_paths: ["spec/conventions/swagger.md"]
mirror_sha256: "7d28bfbca8160fd9be453d8671d6c14a3f0928691817a6ef9ff06f1d1c54648a"
etag: "sha256-5c45c825811a0f86dcfeaa2dbfd9b5fc10b167d04ebe34b1ba53809a48438254"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/swagger.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 `@nestjs/swagger` 로 OpenAPI 문서(OpenAPI, Swagger)를 만드는 방법과, 그중 외부 API 계약에 닿는 노출 정책을 정한다. DTO·컨트롤러 데코레이터 패턴, 응답 DTO·요청 DTO(response DTO, request DTO) 규약, 설명 문구의 톤과 길이, Swagger UI 노출 범위가 대상이다.

이 프로젝트는 `@nestjs/swagger` CLI 플러그인을 이미 켜 두었다(`nest-cli.json`). 플러그인이 아래를 자동으로 처리한다.

- DTO 파일(`*.dto.ts`)의 `class-validator` 데코레이터를 `@ApiProperty` 로 바꾼다.
- 파라미터 타입, `?` 유무, enum, min·max 같은 기본 메타를 추론한다.
- JSDoc `/** ... */` 주석을 `description` 필드로 옮긴다(`introspectComments: true`).

그래서 DTO 에는 JSDoc 주석을 달고 설명만으로 부족할 때만 `@ApiProperty({ ... })` 로 예시(example)·enum·format 등을 보강한다.

이 문서가 정하지 않는 것은 아래 문서가 정한다.

- 응답 wire 형태(`{ data }` 래핑, 페이지 목록, 고정 목록)와 부재 표현(`null` 과 키 생략)의 판정 기준·선언 형태: [HTTP API 규약](CLE-API-CONV.md)
- HTTP 상태 코드를 어느 상황에 쓰는지: [HTTP API 규약](CLE-API-CONV.md)
- 에러 응답 봉투: [에러 응답과 클라이언트 처리](CLE-API-ERROR.md)
- 가드 거부 코드 자체: [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md)

## 규칙

1. Swagger UI(`/docs`)는 production 이 아닌 환경에서만 노출한다. production 에서는 `ENABLE_SWAGGER_IN_PROD` 로 켤 때만 노출한다.
2. DTO 의 모든 필드에 한국어 JSDoc 을 단다. 설명만으로 부족할 때만 `@ApiProperty` 로 보강한다.
3. 응답 필드의 `null`·키 생략 선언 형태는 [HTTP API 규약](CLE-API-CONV.md) 의 부재 표현 절을 따른다.
4. variant 집합이 코드로 정해진 닫힌 union 은 variant DTO 와 `oneOf` 로 선언한다. `discriminator` 는 한 필드 값으로 variant 를 빠짐없이 가를 수 있을 때만 단다.
5. `additionalProperties: true` 열린 map 은 키 집합이 런타임에 정해질 때만 쓴다. 타입을 적기 번거롭다는 이유로 쓰지 않는다.
6. secret store 로 가는 입력 평문 필드는 `writeOnly: true` 를, 서버가 계산하는 응답 필드는 `readOnly: true` 를 단다.
7. `numeric`·`decimal` 컬럼의 wire 타입은 변환 유무가 정한다. 엔티티를 그대로 내보내면 문자열, 서비스가 숫자로 바꾸면 숫자다.
8. `Update` 접두는 컨트롤러 `@Body()` 로 받는 top-level 부분 갱신 요청 바디에만 쓴다. `Patch` 접두는 쓰지 않는다.
9. 광고한 성공 코드는 실제 성공 코드와 같아야 한다. 모든 라우트는 성공 응답을 하나 이상 광고한다.
10. 가드가 403 을 낼 수 있는 라우트는 `@ApiForbiddenResponse` 설명에 가드가 낼 수 있는 거부 코드를 모두 싣는다.
11. `@Body()` 를 받는 라우트는 요청 본문 스키마를 광고한다.
12. 응답 DTO 는 `dto/responses/` 에 두고 엔티티를 그대로 노출하지 않는다. 응답 DTO 클래스 이름은 저장소 전체에서 유일해야 한다.
13. 성공 응답은 인라인 스키마가 아니라 응답 DTO 와 공용 래퍼 헬퍼로 광고한다.
14. DTO 필드의 JSDoc 은 공개 OpenAPI 로 나간다. 정정 경위나 리뷰 참조 같은 내부 서사는 `//` 주석에 적는다.
15. 엔드포인트 `summary` 는 10~20자, `description` 은 50~150자로 쓴다(강제). DTO `description` 은 한 줄 요약을 지향한다(강제 아님).
16. 저장값과 응답값이 다를 수 있는 필드와 정책으로 거부될 수 있는 요청 필드는 길이와 무관하게 그 사실을 설명에 적는다.
17. DTO · 컨트롤러 파일(`*.dto.ts` · `*.controller.ts`)의 `/** */` 블록 전부와 데코레이터의 `description` · `summary` 문자열에는 저장소 내부 참조를 적지 않는다. 저장소 내부 참조는 스펙 경로, 번호로 시작하는 옛 스펙 파일 이름, NERV 키(`CLE-…`), 요구사항 ID(`REQ-…-NNN`), 옛 요구사항 ID, 옛 plan 경로의 여섯 형태다. 근거는 바로 위 `//` 주석에 키 링크로 적는다([스펙과 구현 근거 규약](../CLE-ENG/CLE-ENG-SPECEVIDENCE.md) 규칙 18 · R-14). 저장소 가드 `openapi-internal-ref` 가 강제한다. 리뷰 인용은 이 목록에 없고 [리뷰 산출물 인용 규약](../CLE-ENG/CLE-ENG-REVIEWCITE.md) 이 정한다. 가드의 강제 범위와 못 보는 것은 Rationale 「공개 문장의 저장소 내부 참조를 왜 가드로 세는가」 에 적는다.

## 0. Swagger UI 노출 정책

Swagger UI(`/docs`)는 production 이 아닌 환경에서만 노출한다.

- `NODE_ENV=production` 에서는 기본으로 노출하지 않는다. 인증 없이 API 표면을 정찰하는 것(엔드포인트·DTO 구조 노출, OWASP 정보 노출)을 막기 위해서다.
- 노출 여부는 `production-guards.ts` 의 `isSwaggerEnabled(env)` 한 함수가 판정한다. OAuth·LLM stub 가드와 같은 형태다.
- production 에서 잠깐 디버깅해야 하면 `ENABLE_SWAGGER_IN_PROD=true`(정확히 `true` 또는 `1`)로 켠다. 켜는 순간 인증 없는 노출 위험이 돌아오므로 일시적으로만 쓴다. 켜도 IP 제한이나 Basic Auth 같은 추가 보호는 없으므로 운영자가 따로 앞단에 둔다.

## 1. DTO 패턴

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

비밀번호 정책 자체는 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) 이 정한다. 위 코드는 데코레이터 패턴의 예시다.

### 1-2. 예시가 필요하면 `@ApiProperty` 로 보강

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

위 예시는 **요청 쿼리 DTO** 다. 요청 DTO 에서 생략 가능한 필드는 `@ApiPropertyOptional` 과 `field?: T` 로 선언한다. 응답 DTO 에서 키를 생략하는 필드와 `null` 을 쓰는 필드를 어떻게 선언할지는 [HTTP API 규약](CLE-API-CONV.md) 의 부재 표현 절이 단일 기준이다. 요청 PATCH 의 삼중 상태(키 생략·`null`·값)에서는 `@ApiPropertyOptional({ nullable: true })` 와 `field?: T | null` 조합이 정당하다.

### 1-4. nested, enum, union

- enum: `@ApiProperty({ enum: MyEnum, enumName: 'MyEnum' })`
- nested object: `@ApiProperty({ type: () => NestedDto })`

**닫힌 union (variant 집합이 코드로 정해짐)**: variant 마다 DTO 클래스를 만들고 클래스에 `@ApiExtraModels`, 필드에 `oneOf` 와 `getSchemaPath` 를 건다.

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

이 필드에 `@ApiPropertyOptional` 이 아니라 `@ApiProperty({ nullable: true })` 를 쓰는 이유: 이 필드는 늘 있고 값만 없을 수 있다. EIA 응답 wire 가 `"context": { … } | null` 이다([EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md)). `@ApiPropertyOptional` 은 `ApiProperty({ required: false })` 의 별칭이라 쓰면 OpenAPI 가 키를 optional 로 적는다. 판정 기준과 선언 형태는 [HTTP API 규약](CLE-API-CONV.md) 의 부재 표현 절이 정한다.

- variant 를 **한 필드 값으로 빠짐없이 가를 수 있을 때만** `discriminator: { propertyName }` 을 덧붙인다. 판별 필드 값을 여러 variant 가 함께 쓰면(판별자가 불완전하면) `discriminator` 를 **생략**한다. 선언해 두면 SDK 생성기가 잘못 좁혀 런타임 `undefined` 접근을 만든다. 근거는 Rationale "`discriminator` 는 판별자가 완전할 때만".
- 응답 **body 전체**가 union 이면 필드 수준이 아니라 공용 헬퍼 `ApiOkWrappedOneOfResponse`(§5-2)를 쓴다.

**열린 map (키 집합이 런타임에 정해짐)**: `@ApiProperty({ type: 'object', additionalProperties: true })`.

- 노드 타입별 자유 payload(`nodeOutput`), 사용자 정의 변수 맵처럼 **실제로 키가 열려 있는** 경우에만 쓴다.
- "타입을 특정하기 번거롭다" 는 이유로 쓰지 않는다. variant 집합이 코드로 정해지면 위 닫힌 union 이 맞다(§6 의 "빈 껍데기 스키마 금지" 와 같은 취지).
- **예외: 형태는 정해져 있지만 기준 이중화를 피하려고 여는 경우.** 필드 형태가 다른 기준 문서에 이미 있고(예: EIA 단발 상태 조회 응답의 `conversationThread`. 형태 기준은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 의 자료구조 절), 그 형태를 DTO 로 다시 선언하면 두 곳을 손으로 맞춰야 할 때는 열린 map 을 유지할 수 있다. 사유가 "번거롭다" 가 아니라 "타입이 다른 기준 문서에 이미 있어 다시 선언하면 이중화된다" 이기 때문이다. 이 예외를 쓸 때는 그 DTO 의 Rationale 에 "형태는 정해져 있지만 기준 이중화를 피하려고 연다" 를 적어, 이 절만 읽고 위반으로 오해하지 않게 한다.

**적용 범위는 새 변경에 한한다.** 기존 `additionalProperties: true` 필드를 한꺼번에 소급해 스키마로 바꾸지 않는다. 이 절의 가치는 이미 있는 것의 정리가 아니라 앞으로 불투명한 필드가 쌓이는 것을 막는 데 있다([실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md) 의 원칙 3 과 같은 취지).

### 1-5. `writeOnly` 와 `readOnly`: 보안 민감 필드와 응답 전용 필드

Swagger UI 의 요청·응답 스키마 분리를 써서 보안 민감 입력과 자동 발급 응답 필드를 표시한다.

- **`writeOnly: true`**: 입력 전용. 응답 스키마에서 자동으로 빠진다. 사용자가 입력하지만 응답에 절대 나가지 않는 보안 민감 값(봇 토큰 평문, 서명 비밀 평문, 비밀번호 등)에 쓴다.
- **`readOnly: true`**: 응답 전용. 입력 스키마에서 자동으로 빠진다. 서버가 자동으로 발급하는 ID·타임스탬프·파생 필드에 쓴다.

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

**의무**: secret store 로 가는 입력 평문 필드(`botToken`, `inboundSigningPlaintext` 등)는 늘 `writeOnly: true` 를 단다. 서버 파생 필드(`hasBotToken`, `id`, `createdAt` 등)는 응답 DTO 에서만 `readOnly: true` 를 단다. 이 의무의 기준은 이 절이다. secret store 자체는 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 가 정한다.

### 1-6. numeric 컬럼의 wire 타입

TypeORM 은 `numeric`·`decimal` 컬럼을 **문자열**로 준다. 정밀도 손실을 피하기 위해서이고 JS `number` 로 받으면 그 컬럼 타입을 고른 이유가 사라진다. 그래서 응답 DTO 의 타입은 그 필드가 **어떻게 나가는지**를 따른다.

| 노출 경로 | wire 타입 | DTO 선언 |
| --- | --- | --- |
| 엔티티를 그대로 반환 (패스스루) | 문자열 | `field: string` 과 `@ApiProperty({ type: String, example: '10.0000' })` |
| 서비스가 명시적으로 변환 (`::float`, `Number(...)`) | 숫자 | `field: number` |

**둘 다 정당하다.** 정하는 것은 컬럼 타입이 아니라 변환이 있느냐다. 저장소의 두 실례가 각 갈래다. `alert_rule.threshold` 는 패스스루라 문자열이고 `llm_usage_log.cost_usd` 는 `statistics.service.ts` 가 `SUM(...)::float` 와 `Number(...)` 로 바꿔 숫자다. 데이터 문서도 이 구분을 적는다([알림](../CLE-OBS/CLE-OBS-NOTIFY.md), [LLM 사용량 기록](../CLE-AI/CLE-AI-USAGE.md)).

**가드**: 패스스루 갈래는 `swagger-dto-contract.spec.ts` 의 `findNumericAsNumber` 가 저장소 전체에서 강제한다. `numeric`·`decimal` 컬럼을 그대로 내보내는 응답 DTO 가 그 필드를 `number` 라고 하면 실패한다. 짝짓기는 `<Entity>Dto` 이름 관례에 기대며 그 한계는 술어 docstring 에 캐너리로 고정돼 있다. 명시 변환 갈래는 정적으로 판별할 수 없으므로 가드가 아니라 이 규약이 맡는다. 근거는 Rationale "numeric wire 타입: 가드와 규약의 책임 분리".

### 1-7. 요청 DTO 이름: `Update` 접두는 top-level 요청 바디에만

| 대상 | 이름 | 예 |
| --- | --- | --- |
| 컨트롤러 `@Body()` 로 받는 **엔티티 부분 갱신 요청 바디** | **`Update<Entity>Dto`** (접두) | `UpdateTriggerDto`, `UpdateAuthConfigDto`, `UpdateModelConfigDto` |
| 그 바디 **안의 nested 필드** DTO 와 그 갱신용 변형 | 그 필드의 로컬 패턴 **`<Domain><Role>Dto`** | `ChatChannelConfigDto`, `ChatChannelUiMappingDto`, **`ChatChannelUpdateConfigDto`** |

- **`Patch` 접두는 쓰지 않는다.** 부분 갱신이라는 뜻은 `Update` 가 이미 담고 저장소에 `Patch` 접두 클래스는 없다.
- **접두 규칙을 nested 변형으로 넓히지 않는다.** `ChatChannelUpdateConfigDto` 는 `OmitType(ChatChannelConfigDto, …)` 로 만든 nested 필드의 갱신용 변형이라 형제(`ChatChannelUiMappingDto` 등)와 같은 계열이다. `UpdateChatChannelConfigDto` 로 바꾸면 top-level 요청 바디처럼 보여 `@Body()` 로 받는다는 오해를 만든다.
- **규칙에 범위를 함께 적는다.** 접두 집합과 로컬 패턴 집합 중 어디에 거는지 적지 않으면 "18개가 전부 접두니 이것도 접두여야 한다" 는 오독이 반복된다. 근거는 Rationale "`Update` 접두의 범위".

## 2. 컨트롤러 패턴

### 2-1. 상단에 `@ApiTags` 와 `@ApiBearerAuth('access-token')`

- `access-token` 은 `main.ts` 에서 등록한 Bearer scheme 이름이다(`.addBearerAuth({ scheme: 'bearer', bearerFormat: 'JWT', ... }, 'access-token')`).
- `main.ts` 는 `interaction-token` Bearer scheme 도 등록한다. External Interaction API 전용이고 실행 단위 토큰 `iext_<JWT>` 와 트리거 단위 토큰 `itk_<opaque>` 를 받는다. 해당 엔드포인트는 `@ApiBearerAuth('interaction-token')` 을 쓴다.
- 모든 라우트가 `@Public()` 인 컨트롤러(health, hooks)는 `@ApiBearerAuth` 를 **넣지 않는다**.
- 공개 라우트와 인증 라우트가 섞인 컨트롤러는 클래스 수준에 `@ApiBearerAuth('access-token')` 를 넣고 `@Public()` 엔드포인트에는 `@ApiSecurity({})` 대신 설명에 "인증 불필요" 를 적는다. auth 컨트롤러가 이 경우다. 로그인 같은 공개 라우트와 2FA 설정·해제, 워크스페이스 전환 같은 인증 필수 라우트가 함께 있다([가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) 의 API 엔드포인트 절).

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

## 3. 주석과 설명 톤

- 한국어로 간결하게 쓴다. `~한다` 와 `~합니다` 를 섞어 써도 된다(기존 프로젝트 문서 스타일 유지).
- 이 톤 규칙은 OpenAPI `description` 에만 적용한다. 앱 화면 문구와 사용자 가이드는 해요체로 통일하며 그 기준은 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 다.
- 가능하면 "무엇을 하는지" 와 "제약·부수 효과" 를 담는다.

**길이: 강제하는 것과 지향하는 것을 가른다** (2026-08-23 개정).

| 대상 | 길이 | 성격 |
| --- | --- | --- |
| 엔드포인트 `summary` | 10~20자 | **강제**. 목록 UI 에서 잘린다 |
| 엔드포인트 `description` | 50~150자 | **강제** |
| DTO `description` | 한 줄 요약 지향 (약 40자) | **지향**. 상한이 아니다 |

DTO `description` 은 "한 줄로 읽히는가" 가 기준이지 글자 수가 아니다. 필드의 제약·부수 효과를 담느라 길어지는 것은 위반이 아니다. 아래 보안·정책 캐비엇은 애초에 길이 논의 밖이다. 근거는 Rationale "DTO 길이는 왜 강제가 아닌가".

**JSDoc 은 공개 OpenAPI 로 나간다. 내부 서사를 담지 않는다** (2026-09-05 규약화, 2026-10-03 저장소 내부 참조 금지 추가, 규칙 17).

플러그인이 `introspectComments` 로 **프로퍼티** JSDoc 을 `description` 에 그대로 싣는다(§개요). 즉 DTO 필드의 `/** ... */` 는 API 소비자가 읽는 문장이다. 컨트롤러 메서드 JSDoc 은 operation 설명으로 실리고 데코레이터의 `description` · `summary` 문자열도 그대로 나간다. 클래스 JSDoc 은 플러그인이 싣지 않지만 같은 분리를 따른다. 응답 DTO 파일의 `/** */` 는 한 채널로 다룬다([리뷰 산출물 인용 규약](../CLE-ENG/CLE-ENG-REVIEWCITE.md)). 정정 경위, 리뷰 참조, "왜 이렇게 바꿨는지" 같은 내부 서사는 JSDoc 이 아니라 그 위의 `//` 주석에 적는다. `//` 는 플러그인이 읽지 않는다.

저장소 내부 참조(규칙 17 의 여섯 형태)는 DTO · 컨트롤러 파일의 `/** */` 블록 전부와 `description` · `summary` 에 적지 않는다. 클래스 JSDoc 도 같은 채널이라 내부 참조를 적지 않는다. 플러그인이 싣지 않는 자리라도 마찬가지다.

| 무엇 | 어디 |
| --- | --- |
| 소비자가 이 필드를 쓰려면 알아야 하는 것 | JSDoc `/** */` |
| 왜 이 값이 이 타입인지의 경위, 리뷰·PR 참조, 스펙 근거 | 바로 위 `//` 주석. 스펙은 키 링크로 가리킨다([스펙과 구현 근거 규약 규칙 18 · R-14](../CLE-ENG/CLE-ENG-SPECEVIDENCE.md)) |

`alert-rule-response.dto.ts` 의 `threshold` 가 이 분리를 적용한 예다. 내부 서사는 기존 DTO 를 소급해 정리하지 않는다(§1-4 와 같은 원칙). 그 자리를 다음에 건드릴 때 함께 맞춘다. 가드가 세는 여섯 형태는 전환 단계 4c 에서 기존 자리까지 걷어 베이스라인이 0 이다(규칙 17). 경로 없는 절 번호 인용은 남아 있다(`CLE-T-BCS6QZ`).

**반드시 적는다: 보안·정책 캐비엇** (2026-08-17 규약화, 2026-08-22 요청 필드까지 확장, 2026-08-23 "예외" 에서 "적극 지시" 로 재정의).

아래 두 부류는 길이를 이유로 줄이지 않는다. 짧게 쓰면 정보가 사라지는 자리다. DTO 길이가 강제가 아니게 된 이상 "예외" 라는 틀은 성립하지 않는다(없는 상한을 면제할 수는 없다). 그래서 면제가 아니라 지시로 뒤집었다. 다른 필드는 짧게 써도 되지만 이 둘은 **길어도 적어야 한다**.

| 부류 | 소비자가 그 설명 없이는 알 수 없는 것 |
| --- | --- |
| **응답** 값이 저장된 값과 다를 수 있는 필드(응답 마스킹 대상 등) | "왜 DB 와 값이 다른가" |
| **요청** 값이 정책으로 거부될 수 있는 필드(예약어, 재제출 금지 값 등) | "왜 이 값을 보내면 400 인가" |

다만 상세 근거는 문서 본문에 두고 설명에는 1~2문장 요약만 적는다. 기준 문서는 설명이 아니라 바로 위 `//` 주석에 키 링크로 적는다(규칙 17). 응답 마스킹과 재제출 거부의 기준은 [응답 자격 증명 마스킹](CLE-API-EGRESS.md) 이다. 근거는 Rationale "보안·정책 캐비엇: 왜 길이를 이유로 줄이지 않는가, 그리고 왜 양방향인가".

## 4. 엔드포인트별 작업 순서

모듈마다 다음 순서로 작업한다.

1. 컨트롤러 파일을 읽는다.
2. DTO 파일을 한꺼번에 읽는다.
3. DTO 파일에 JSDoc 과 필요한 `@ApiProperty(Optional)` 를 더한다.
4. 컨트롤러 클래스에 `@ApiTags` 와 (보호된 경우) `@ApiBearerAuth('access-token')` 을 단다.
5. 각 엔드포인트에 `@ApiOperation`, 파라미터, 응답 데코레이터를 더한다.
6. `@Public()` 엔드포인트에는 `@ApiBearerAuth` 를 생략하거나 설명으로 명시한다.

## 5. 응답 DTO 규약

모든 성공 응답은 `@ApiOkResponse({ schema: ... })` 의 인라인 객체가 아니라 **응답 DTO 클래스와 공용 래퍼 헬퍼**로 광고한다.

### 5-1. 응답 DTO 위치

- `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts` 에 둔다.
- 엔티티(`entities/*.entity.ts`)를 그대로 노출하지 말고 API 응답 형태에 맞춘 별도 DTO 를 만든다. 비밀값(credentials, passwordHash 등)은 가리거나 뺀다.
- 겹치는 필드는 `@nestjs/swagger` 의 `PickType`·`OmitType`·`PartialType` 으로 재사용할 수 있다.

**무엇이 이 규칙을 강제하나**: 정적 가드(`swagger-dto-contract-guard.ts`)는 선언끼리만 대조하므로 "엔티티를 그대로 노출했다" 는 사실 자체는 보지 못한다. 그 축은 런타임 짝인 `response-contract.ts` 가 맡는다. 실제 응답에 **스키마가 선언하지 않은 키**가 있으면 위반으로 보고한다. 실사례로 `GET /api/audit-logs` 가 3필드를 광고하면서 `User` 엔티티 26키(`passwordHash`, 2FA 복구 코드, 계정 탈취 토큰 포함)를 내보내고 있었다(`CHANGELOG.md`). 이 검증자들의 경계는 [HTTP API 규약](CLE-API-CONV.md) 의 부재 표현 검증 층 표에 인벤토리로 둔다. **개수를 적지 않는다.** 축이 늘 때마다 숫자를 고쳐야 하는 자리를 만들지 않기 위해서다.

**응답 DTO 클래스 이름은 저장소 전체에서 유일해야 한다.**

- `@nestjs/swagger` 는 스키마를 클래스 `.name` 문자열로 `components.schemas` 에 등록한다. 서로 다른 두 클래스가 같은 이름을 쓰면 **한쪽이 다른 쪽을 덮어쓴다**. 어느 쪽이 남는지는 스캔 순서에 달렸고 남지 못한 엔드포인트의 문서는 실제 응답과 다른 형태를 광고한다.
- 컴파일은 통과한다(서로 다른 모듈의 서로 다른 클래스이므로). 타입이 막아 주지 않는 축이다.
- 같은 개념을 층별로 나눠 선언해야 할 때(입력 검증 DTO 와 응답 DTO)는 이름을 다르게 둔다. 선례는 `ChatChannelBotIdentityDto`(입력. 모든 필드 optional, 어댑터가 덮어쓰는 캐시)와 `ChatChannelRotateBotIdentityDto`(응답. `botId`·`username` 필수와 provider 부가 필드)다.
- **합치지 않는 이유**: 두 자리의 계약이 다르므로 하나로 묶으면 한쪽이 반드시 거짓말을 한다(같은 판단의 선례: `TriggerWorkflowRefDto` 와 `ScheduleTriggerWorkflowRefDto`).
- **강제**: `dto-class-name-collision.spec.ts` 가 `modules/`·`common/` 의 `*.dto.ts` 를 AST 로 훑어 `export class` 이름 중복 0을 고정한다(2026-09-12 신설). 정규식이 아니라 AST 인 이유는 주석·문자열·JSDoc 예제 안의 `export class` 를 세면 가드가 자기 오탐으로 죽기 때문이다.
- 이 규칙은 가드가 먼저 생기고 규약이 나중에 온 자리다. 첫 위반(`#1326` 이 스스로 낸 같은 이름 클래스 CRITICAL)이 가드를 불렀다. 가드가 무엇을 강제하는지 여기 적지 않으면 다음 사람이 "누가 왜 넣었는지 모르는 검사" 로 보고 지운다.

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

위 표는 `common/swagger/` 가 export 하는 호출형 헬퍼 함수의 인벤토리다. 응답 body 전체가 아니라 **DTO 의 한 필드**가 닫힌 union 인 경우는 대응 헬퍼가 없고 `@ApiExtraModels` 와 `@ApiProperty({ oneOf: [...] })` 데코레이터 조합을 직접 쓴다(§1-4).

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
  - `RolesGuard` 는 `@Roles()` 유무와 무관하게 워크스페이스 멤버십을 늘 검증한다. 그래서 `@WorkspaceId()`·`@WorkspaceParam(...)` 만 쓰는 조회 엔드포인트도 403 을 낼 수 있다(근거: [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) 의 "멤버십 검증은 가드 1곳에서", "경로 파라미터 워크스페이스도 가드가 본다" Rationale).
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
- [ ] 요청 DTO 이름에서 `Update` 접두를 top-level 요청 바디에만 쓰고 nested 변형은 로컬 패턴을 따랐는가(§1-7)

### 5-5. 에러 응답 참조

`codebase/backend/src/common/swagger/error-response.dto.ts` 의 `ErrorResponseDto` 는 `GlobalExceptionFilter` 출력을 1:1 로 표현한다. 필요하면 `@ApiBadRequestResponse({ type: ErrorResponseDto })` 처럼 참조할 수 있다. 봉투의 필드 정의는 [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) 가 정한다.

## 6. 레거시 패턴 제거

- `@ApiOkResponse({ schema: { type: 'object', properties: { data: { type: 'object' } } } })` 같은 "빈 껍데기" 는 반드시 DTO 기반 래퍼로 바꾼다.
- `{ data: { items, totalItems, page, limit } }` 처럼 서비스의 실제 반환 형태(`{ data, pagination }`)와 다른 스키마는 버그다. `ApiOkPaginatedResponse` 로 바꾼다.
- 단 `pagination` 필드가 전혀 없는 순수 `{ data: { items } }`(고정 목록 응답: 활성 로그인 세션, WebAuthn credential 목록)는 이 버그 패턴이 아니라 §2-5 의 정상 통과 사례다([HTTP API 규약](CLE-API-CONV.md) 의 고정 목록 응답). 평탄화하지 않는다.

## 구현 위치

- `codebase/backend/src/common/swagger/**` (공용 래퍼 헬퍼, `ErrorResponseDto`, 403 설명 헬퍼)
- `codebase/backend/nest-cli.json` (CLI 플러그인 설정)
- `codebase/backend/src/common/config/production-guards.ts` (`isSwaggerEnabled`)
- `codebase/backend/src/main.ts` (Bearer scheme 등록)
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts`
- `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision*.ts`
- `codebase/backend/src/shared/testing/response-contract*.ts`
- `codebase/backend/src/shared/testing/swagger-probe*.ts`
- `codebase/backend/src/repo-guards/__tests__/user-entity-exposure*.ts`
- `codebase/backend/src/shared/testing/user-secret-absence*.ts`
- `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe*.ts` 와 대조군 `fixtures/param-uuid-pipe/**` (`@ApiParam({format:'uuid'})` 축과 런타임 `ParseUUIDPipe` 축을 세는 가드)
- 대조군(negative fixture). 가드가 강제하는 위반 형태의 실례다. 없으면 술어가 죽어도 테스트가 통과한다(실제로 그 상태로 한 라운드를 지났다).
  - `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable*.ts`
  - `codebase/backend/src/repo-guards/__tests__/fixtures/user-eager-relation*.ts`
  - `codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load*.ts`
  - `codebase/backend/src/repo-guards/__tests__/fixtures/dto-class-collision/*.ts`
- `codebase/backend/src/repo-guards/__tests__/http-status-advertised*.ts` 와 `fixtures/http-status-advertised/**` (§2-4 광고한 성공 코드와 실제 성공 코드 짝)
- `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes*.ts` (§5-4 403 설명과 가드 거부 코드 짝. reflection, 대조군은 spec 안의 클래스)
- `codebase/backend/src/repo-guards/__tests__/request-body-advertised*.ts` (§5-4 요청 본문 스키마. reflection, 대조군은 spec 안의 클래스)
- `codebase/backend/src/repo-guards/__tests__/openapi-internal-ref-guard.ts` 와 `openapi-internal-ref.spec.ts`, 대조군 `fixtures/openapi-internal-ref/**` (규칙 17)
- `codebase/frontend/src/lib/__tests__/public-surface-internal-refs.test.ts` (규칙 17 과 같은 패턴으로 배포 SVG 와 외부 SDK README · `package.json` 을 보는 프런트엔드 가드)
- `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation*.ts` (교차 참조. 응답 DTO JSDoc 의 리뷰 인용을 보는 가드다. 기준은 [리뷰 산출물 인용 규약](../CLE-ENG/CLE-ENG-REVIEWCITE.md) 이다)
- `codebase/frontend/src/lib/docs/__tests__/review-citation-form.test.ts` 와 `codebase-mentions.ts` (교차 참조. [리뷰 산출물 인용 규약](../CLE-ENG/CLE-ENG-REVIEWCITE.md) 규칙 9 · 10 을 보는 가드다. 기준은 그 규약이다)

## Rationale

### numeric wire 타입: 가드와 규약의 책임 분리 (§1-6)

**기각한 대안: 가드가 명시 변환 경로까지 판정하게 하기.** 그러면 이 규약 절이 필요 없어진다. 그러나 그 판정은 서비스 코드의 데이터 흐름을 따라가야 성립한다. `SUM(...)::float` 가 어느 필드로 흘러 어느 DTO 로 조립되는지를 정적으로 잇는 일이고 `findNumericAsNumber` 가 서 있는 AST 수준에서 할 수 있는 판정이 아니다. 무리하게 넓히면 그 파일이 스스로 적어 둔 "정규식으로 세 번 틀렸다" 는 자리로 되돌아간다.

그래서 나눈다. 정적으로 판별할 수 있는 갈래(패스스루)는 가드가, 변환 유무를 사람이 아는 갈래는 이 규약이 맡는다. 저장소의 numeric 컬럼이 둘뿐이고 그 둘이 각각 다른 갈래라는 실측이 이 형태를 정했다.

### `Update` 접두의 범위: 왜 nested 변형에는 걸지 않는가 (§1-7)

실측이 규칙의 **범위**를 정했다. `Update*Dto` 는 18개이고 예외 없이 모두 접두다. 동시에 예외 없이 모두 컨트롤러 `@Body()` 로 받는 top-level 요청 바디다. 이름에 `Config` 가 들어간 `UpdateModelConfigDto`·`UpdateAuthConfigDto` 도 그렇다. 즉 "18/18 이 접두" 라는 사실은 그 집합이 top-level 요청 바디라는 성질과 붙어 있다.

그래서 `ChatChannelUpdateConfigDto`(2026-09-11 신설, `OmitType` nested 변형)를 두고 "18/18 이 접두니 이것도 접두여야 한다" 는 지적이 나왔을 때 그것은 집합을 넘은 일반화였다. nested 필드 DTO 는 `<Domain><Role>Dto` 라는 다른 축을 쓰고 있고(`ChatChannelConfigDto`, `ChatChannelUiMappingDto`, `ChatChannelBotIdentityDto`), 접두로 바꾸면 형제들과 어긋나면서 호출 규약(top-level 바디인가)을 이름으로 거짓 신호하게 된다.

**기각한 대안: 개명**(`UpdateChatChannelConfigDto`). 위 이유로 기각했다. 규칙을 넓히는 대신 규칙에 범위를 적는 것이 같은 오독을 반복하지 않게 하는 최소 조치다.

### Swagger UI production 비노출과 opt-in (§0)

Swagger UI 를 production 에서 기본으로 노출하지 않는 것은 인증 없는 API 표면 정찰(엔드포인트·DTO 구조 노출)을 막기 위해서다. 노출 판정을 `isSwaggerEnabled(env)` 한 함수로 뺀 이유는 OAuth·LLM stub 가드와 같은 형태(`NODE_ENV` 기반 분기와 opt-in 환경 변수)로 맞춰 운영자가 떠올리는 모델을 하나로 만들고 단위 테스트로 분기를 고정하기 위해서다.

`ENABLE_SWAGGER_IN_PROD` opt-in 을 둔 이유: production 디버깅 요구를 받아들이되 기본값은 안전하게 둔다. 켤 때 IP 제한이나 Basic Auth 같은 추가 인증 계층을 기본으로 주지 않는 이유는 production 노출 자체가 상시 요구로 기록되지 않은 예외적 디버깅 용도이기 때문이다. 인증 계층 구현은 그 요구가 상시화될 때 검토한다(지금은 과투자를 피한다). 켜는 순간 인증 없는 노출 위험이 돌아오므로 일시적 용도로 한정하고 필요하면 운영자가 reverse proxy 에서 보호를 둔다.

### 닫힌 union 을 `additionalProperties` 로 뭉개지 않는다 (§1-4)

옛 §1-4 는 "union 또는 dynamic" 을 한 줄로 묶어 둘 다 `additionalProperties: true` 로 안내했다. 그 결과 variant 집합이 코드로 정해진 필드까지 Swagger 에서 빈 객체로 나가, 생성 SDK 와 손으로 쓴 클라이언트 타입이 wire 와 어긋나도 잡히지 않았다. 실제 사례로 EIA 단발 상태 조회의 `context` 가 `Record<string, unknown> | null` 로 선언된 동안, 위젯의 `eia-types.ts` 는 형제 필드 `currentNode` 를 `string | null` 로 잘못 선언했고(실제 wire 는 객체) 아무 검증도 이를 잡지 못했다. 코드는 이미 규약보다 앞서 있었다. `api-wrapped.ts` 의 `ApiOkWrappedOneOfResponse` 가 **응답 수준** `oneOf` 를 주고 있었고 없던 것은 **필드 수준** 대응물뿐이었다.

"열림" 은 키 집합이 런타임에 정해진다는 사실 진술이지 타입을 적기 번거롭다는 편의 표현이 아니다. 두 경우를 문장 하나로 묶어 둔 것이 혼동의 원인이라 절을 나눴다. 다만 기존 필드를 한꺼번에 소급해 다시 선언하는 것은 요구하지 않는다. [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md) 의 원칙 3 이 같은 이유(넓은 회귀 위험에 비해 낮은 효용)로 새 변경에만 분류 규칙을 적용하는 것과 같은 형태다.

### `discriminator` 는 판별자가 완전할 때만 (§1-4)

OpenAPI `discriminator.propertyName` 은 "그 필드 값 → variant" 매핑이 **전단사**라고 SDK 생성기에 약속한다. 약속이 깨지면 생성기는 조용히 잘못된 variant 로 좁힌다.

EIA 단발 상태 조회의 `context` 가 그 반례다. `interactionType` 은 판별자처럼 보이지만 `buttons` 는 `buttonConfig` 를 실은 변형과(핸들러가 `buttonConfig` 를 싣지 못해 넘어간) `nodeOutput` 변형 **양쪽**에 나온다. `discriminator: { propertyName: 'interactionType' }` 을 선언하면 SDK 는 모든 `buttons` 응답을 `buttonConfig` 변형으로 좁히고 넘어간 경우에 `context.buttonConfig.buttons` 접근이 런타임 `undefined` 가 된다. 그래서 `oneOf` 만 선언하고 판별은 **키 존재**(`'buttonConfig' in context`)로 남긴다.

넘어가는 경우 자체를 없애 판별자를 완전하게 만드는 대안은 wire 변경이라 [External Interaction API](../CLE-IX/CLE-EIA.md) 의 SSE 형식 일치 계약을 건드린다. 별건으로 둔다. 이 규칙은 `api-wrapped.ts` `wrapOneOfDataSchema` 의 기존 JSDoc("호출자는 모든 DTO 가 동일 `propertyName` 필드를 보유함을 보장해야 한다")을 규약 수준으로 올린 것이다.

### EIA `context` 는 봉투만 스키마로 닫고 안쪽은 열어 두는 이유 (§1-4)

`nodeOutput` 과 `buttonConfig.buttons` 는 노드 타입별 자유 payload(`formConfig`, `conversationConfig`, 임의 키)라 §1-4 의 **진짜 열린 map** 이다. 클래스로 고정하면 노드 타입이 늘 때마다 DTO 가 따라 늘고 여러 노드 문서가 참조하는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 과 기준이 이중화된다. 봉투(`interactionType`, `waitingNodeId`, `conversationThread`, 변형 키)만 닫고 안쪽은 열어 두는 것이 두 규약의 책임 경계와 맞는다.

같은 이유로 `ConversationThreadDto` 도 만들지 않는다. [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 의 자료구조 절이 스레드 형태(`turns[]`, `source`, `totalChars`, `nextSeq`)의 기준이고 Swagger DTO 로 다시 선언하면 두 문서가 갈린다. 봉투에서는 열린 객체로 두고 바로 위 `//` 주석이 대화 스레드 문서를 키 링크로 가리킨다(규칙 17).

### DTO 길이는 왜 강제가 아닌가 (§3)

**실측이 먼저다** (2026-08-23). 집계 기준을 적어 둔다. 적지 않으면 재현이 안 된다. 실제로 이 숫자를 독립적으로 다시 센 리뷰어가 다른 값(요청 약 118/368)을 얻었고 원인은 아래 세 가지를 서로 다르게 잡았기 때문이다. 방향(대량 초과)은 재현됐지만 절대값은 기준에 민감하다.

1. 대상: `codebase/backend/src/**/dto/**/*.dto.ts` (다른 위치의 DTO 는 제외)
2. 요청·응답 분류: 경로에 `/responses/` 가 있거나 파일 이름이 `-response.dto.ts` 면 응답
3. 길이: `description:` 뒤에 이어지는 문자열 리터럴을 모두 이어 붙인 뒤 글자 수를 센다(`'a' + 'b'` → `ab`). 템플릿 리터럴과 변수 참조는 세지 않는다

| 범위 | 40자 초과 |
| --- | --- |
| 요청 DTO | 116/335 (34%) |
| 응답 DTO | 58/128 (**45%**) |
| 전체 | **174/463 (37%)** |

아래 보안·정책 캐비엇 항목의 `114/333` 은 2026-08-22 실측이고 이 표는 2026-08-23 재실측이다. 차이(+2/+2)는 그 사이 두 PR 이 `ReRunRequestDto`·`ExecuteWorkflowDto` 에 필드 설명을 더한 것이다. 모집단이 바뀐 것이지 어느 쪽이 틀린 것이 아니다. 백분율이 우연히 둘 다 34% 라 눈에 띄지 않으므로 적어 둔다.

**37% 미준수는 "규칙이 안 지켜진다" 가 아니라 "그건 규칙이 아니었다" 는 뜻이다.** 옛 문면도 이미 `10~40자 내외` 로 완충을 달아 강제할 의도가 아니었음을 스스로 드러내고 있었다.

세 갈래를 놓고 골랐다.

| 대안 | 기각 사유 |
| --- | --- |
| 수치를 현실에 맞게 **올린다** | 새 숫자도 근거 없이 임의적이다. 같은 문제가 몇 달 뒤 반복된다 |
| 규칙을 유지하고 **초과분 174건을 정리** | §3 스스로 "소비자가 알 방법이 그 설명뿐" 이라 한 정보를 지우게 된다. 비용도 크다 |
| **강제가 아님을 명문화** (채택) | 문면이 현실과 의도 양쪽에 맞는다 |

이는 §3 이 자기 예외를 들일 때 쓴 "새로 만든 관행이 아니라 이미 굳은 관행의 추인" 논리를 기본 규칙에도 적용한 것이다. 예외만 추인하고 본칙을 두면 규약이 한 발만 현실에 딛게 된다.

**강제를 남겨 둔 곳이 있다.** 엔드포인트 `summary` 는 목록 UI 에서 잘리므로 길이가 기능적 제약이다. DTO `description` 은 그렇지 않다. 그 차이가 강제와 지향을 가르는 기준이다.

이 결정은 2026-08-22 개정이 남겨 둔 유보를 푼 것이다. 그 개정은 보안·정책 캐비엇 Rationale 에 "34% 는 캐비엇 부류보다 넓다. 즉 `10~40자` 기본 수치 규칙 자체가 현실과 벌어져 있을 수 있는데 그건 별개 판단이라 건드리지 않는다" 고 적었다. 그 별개 판단이 2026-08-23 사용자 택일로 내려졌고 이 항목이 그 답이다. 유보 문구만 남고 답이 어디 있는지 모르면 다음 사람이 같은 조사를 반복하므로 여기서 풀렸다고 적는다.

**`deprecated` 패턴은 아직 §1 로 일반화하지 않는다.** 같은 날 `ExecuteWorkflowDto.input` 이 형제와의 같은 이름 다른 뜻을 `deprecated: true` 로 풀었지만(이름을 바꾸면 wire 계약이 깨져 기각) 사례가 하나뿐이다. rule of three 를 채우기 전에 규칙으로 올리면 다음 사례가 이 형태와 다를 때 규칙이 먼저 틀린다. 세 번째 사례가 나오면 §1 에 소절로 올린다. 인접 선례도 함께 센다. [Cafe24 operation 메타데이터](CLE-C24-META) 는 같은 상황에서 **필드를 제거**했다(백엔드 `label` 을 프론트엔드 i18n 사전 하나로). 방향이 다른 이유는 분명하다. 그쪽은 내부 메타데이터라 제거 비용이 작았고 `ExecuteWorkflowDto.input` 은 공개 wire 필드라 제거라는 선택지가 애초에 없다. 두 사례는 같은 규칙의 두 사례가 아니라 다른 문제이므로 rule of three 를 셀 때 한 칸으로 합치지 않는다.

### 보안·정책 캐비엇: 왜 길이를 이유로 줄이지 않는가, 그리고 왜 양방향인가 (§3)

**왜 이 자리는 길어도 되는가** (2026-08-17 도입, 2026-08-23 틀 정정): 소비자가 OpenAPI 만 보고 통합할 때 "이 필드는 내가 저장한 값과 다르게 돌아온다" 를 알 방법이 그 `description` 뿐이다. 짧은 한 줄에 그 사실과 이유를 함께 담을 수 없다.

2026-08-17~08-22 에는 이것을 "예외" 라고 불렀다. 그때는 DTO 길이가 강제 상한이었으니 면제가 맞는 틀이었다. 2026-08-23 개정으로 그 상한이 지향이 되면서 면제할 대상이 사라졌고 같은 내용이 면제가 아니라 "이 둘은 길어도 반드시 적어라" 는 지시로 뒤집혔다. 내용은 그대로이고 틀만 바뀌었다.

**새 관행이 아니라 추인이었다.** 도입 시점 실측으로 이미 9곳 넘는 DTO 가 이 형태를 쓰고 있었고(`execution-response.dto.ts`, `background-run-response.dto.ts` 등) 두 라운드 연속 규약 위반으로 지적됐다. 규약이 현실을 반영하도록 고쳤다.

**왜 요청 필드까지 넓혔나** (2026-08-22): 논거가 대칭인데 문면만 한쪽이었다. 응답 쪽 질문이 "왜 DB 와 값이 다른가" 라면 요청 쪽은 "왜 이 값을 보내면 400 인가" 이고 소비자가 알 방법이 그 설명뿐이라는 점도 같다. 계기는 `ReRunRequestDto.inputOverride` 였다. 마스킹 마커와 정확히 같은 값이 `MASKED_VALUE_RESUBMITTED` 로 거부된다는 사실을 적어야 했는데 이것은 응답이 아니라 요청이 거부되는 규칙이라 기존 문면이 덮지 못했다([응답 자격 증명 마스킹](CLE-API-EGRESS.md)).

**요청 쪽도 추인이다** (2026-08-22 실측, `codebase/backend/src/**/dto/**/*.dto.ts` 중 `responses/` 와 `*-response.dto.ts` 제외): 요청 DTO 73개 파일의 `description` 333개 중 114개(34%)가 40자를 넘는다. 가장 긴 것은 `chat-channel-config.dto.ts` 435자이고 상위권에 이 캐비엇이 겨냥한 바로 그 부류가 있다. `create-auth-config.dto.ts`(248자, 인증 상세 설정), `chat-channel-config.dto.ts`(386자, provider 발급 웹훅 인증 자료)다.

**넓히지 않은 것**: 위 34% 는 보안·정책 캐비엇 부류보다 넓다. 즉 기본 수치 규칙 자체가 현실과 벌어져 있을 수 있었는데 그것은 이 캐비엇의 문제가 아니라 별개 판단이라 이때는 건드리지 않았다. 그 판단은 "DTO 길이는 왜 강제가 아닌가" 에서 내려졌다.

### `ApiOkPaginatedResponse` 는 한 번 래핑 (§5)

`ApiOkPaginatedResponse` 가 문서화하는 wire 형태는 한 번 래핑한 `{ data: <Dto>[], pagination }` 이다(§5-2). 페이지네이션 핸들러는 공용 `PaginatedResponseDto`(`{ data, pagination }`, 최상위 `data` 키 있음)를 돌려주고 `TransformInterceptor` 는 이미 `data` 키가 있는 객체를 더 감싸지 않고 통과시킨다(`'data' in data` 분기). 그래서 §2-5 의 "성공 응답을 `{ data }` 로 감싼다" 는 보편 규칙의 주요 통과 사례가 된다. 두 번째 사례는 고정 목록 응답이 `{ data: { items } }` 를 직접 돌려주는 경우다(`pagination` 필드가 없어 이 페이지 목록 통과와 형태가 다르다).

옛 헬퍼가 선언하던 이중 래핑 `{ data: { data, pagination } }` 은 의도한 결정이 아니라 통과 분기를 간과한 **버그**였다. 실제 런타임(`PaginatedResponseDto` 와 인터셉터), e2e(`res.body.data`·`res.body.pagination` 최상위), [HTTP API 규약](CLE-API-CONV.md) 의 목록 응답이 모두 한 번 래핑이라 헬퍼와 §5-2 를 그에 맞춰 고쳤다. **이중 래핑으로 되돌리지 않는다.** 런타임과 어긋난다.

### 새 엔드포인트 체크리스트의 403 항목을 `@WorkspaceId()` 소비 라우트로 넓힌 배경 (§5-4, 2026-08-08)

옛 §5-4 는 "`@Roles()` 가 있어야 403 이 가능하다" 는 opt-in 가드 모델을 전제로 적혀 있었다. 워크스페이스 멤버십 가드 보안 CRITICAL 수정 PR 이 `RolesGuard` 를 opt-out 할 수 없는 구조로 다시 짜면서 그 전제가 깨졌다. 멤버십 검증이 `@Roles()` 유무와 무관하게 늘 돌므로 `@WorkspaceId()` 만 쓰는 조회 엔드포인트도 403 을 낼 수 있다(기준: [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) 의 "멤버십 검증은 가드 1곳에서" Rationale). 이 정정은 동작 변경이 아니라 문서와 구현을 맞춘 것이다.

규약 문구까지 고치는 이유: §5-4 는 새 엔드포인트를 만들 때 판단 기준으로 쓰인다. 문구가 실제 403 발생 조건과 어긋나면 규약을 그대로 따른 다음 작성자에게서 같은 틈이 다시 생긴다. "사람이 규칙을 기억해야 하는 opt-in" 구조를 규약 수준에서 반복하지 않는다(그 PR 이 코드에서 닫은 것과 같은 결함 부류).

### 광고한 성공 코드와 실제 성공 코드를 왜 가드로 세는가 (§2-4, 2026-09-26)

광고는 응답 데코레이터에, 실제 코드는 `@HttpCode` 나 Nest 기본값에 있어 둘을 한 번에 보는 곳이 없었다. 컴파일도 단위 테스트도 이 짝을 보지 않고 e2e 는 `[200, 201]` 로 둘 다 받아 불일치를 가렸다. 전수 조사(2026-09-26, `src/modules` 핸들러 223개)에서 불일치가 15곳이었다. 200 을 광고하는 POST 액션 14곳이 201 을 냈고 204 를 광고하는 초대 취소 DELETE 가 200 을 냈다. 그중 둘(MCP `preview-test`, 통합 `:id/test`)은 문서 본문이 이미 200 으로 적은 자리였다.

- **`@Res()` 를 면제하지 않는다.** SSE 핸들러는 "응답을 직접 쓰니 상태도 스스로 정한다" 고 보기 쉽지만 Nest 는 핸들러를 부르기 전에 기본 상태를 싣는다(`@nestjs/core` `router-execution-context`). 가드 spec 의 캐너리가 이 동작을 실제 요청으로 고정한다. Nest 가 동작을 바꾸면 그 캐너리가 먼저 RED 가 되고 그때 면제를 다시 판단한다.
- **이름 → 코드 표를 손으로 쓰지 않는다.** `@nestjs/swagger` 는 2xx 데코레이터만 해도 일곱을 내보낸다(203·205·206 포함). 손으로 쓴 표는 지금 쓰는 이름만 담아, 새 이름을 쓰는 날 그 핸들러의 광고가 빈 집합이 되어 대조에서 조용히 빠진다. 그래서 팩토리를 적용해 메타데이터에서 읽고 저장소 래퍼는 이름 접두사가 아니라 내부 호출로 옮긴다. 표에 없는 `Api*Response` 는 실패다.
- **"광고가 있어야 한다" 는 광고를 채운 뒤 조였다.** 처음엔 성공 응답을 광고하지 않는 핸들러(같은 날 15곳)를 대조할 것이 없다며 건너뛰었다. 광고를 채우는 일이 먼저였다. 같은 변경에서 11곳을 채웠고(응답 DTO 가 없던 워크플로우 AI 어시스턴트 세션 6곳 포함), 남은 넷은 OpenAPI 밖(`@ApiExcludeEndpoint()` 2)이거나 이미 302 를 광고하고 있었다(OAuth 리다이렉트 2, 전수가 2xx 만 셌다). 그래서 3xx 도 성공 광고로 친다. 새 라우트가 광고 없이 들어오는 순간 가드가 실패한다.
- **어느 코드가 맞는지는 이 규칙이 정하지 않는다.** 이번에 고친 14곳은 광고(200)에 실제를 맞췄다. 액션이고 `@HttpCode(200)` 을 단 POST 42곳 중 광고가 있는 40곳이 모두 200 을 광고한다. 두 자리는 행이 생긴다. OAuth 시작은 Cafe24 Private·MakeShop 분기에서 설치 대기 통합 행을 만들고(§5-2 래퍼 표가 그 분기 응답을 200 으로 적는다), 초대 수락은 멤버십 행을 만든다(1차 자원은 소비되는 초대이고 응답은 기존 워크스페이스다). 둘 다 설치·합류 흐름의 부수 효과로 보고 200 을 유지했다. 그러나 §2-4 와 [HTTP API 규약](CLE-API-CONV.md) 의 상태 코드 표에는 "자원을 만들지 않는 POST" 칸이 없다. 그 명문화는 별도 결정이다.

### 403 설명의 거부 코드: 왜 두 코드이고 왜 가드로 세는가 (§5-4, 2026-09-26)

가드 거부에 코드가 붙은 뒤에도([계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) 의 "가드 거부의 오류 코드") 기존 라우트의 403 설명은 따라가지 않았다. §5-4 는 새 엔드포인트 체크리스트라 기존 라우트를 묶지 않았고 그 결정을 적용한 PR 은 경로 라우트 15곳과 재실행·chain 의 설명만 고쳤다. 2026-09-26 실측(`src/modules`, reflection)에서 가드가 403 을 낼 수 있는 라우트 157곳 중 129곳의 설명에 코드가 빠져 있었다. "워크스페이스 멤버가 아님" 54, "editor 이상 권한 필요" 53, "viewer 이상 권한 필요" 4, 표기가 제각각인 역할 문장 14, 비멤버 코드만 빠진 통합 4 였다.

- **`@Roles()` 라우트도 `NOT_A_MEMBER` 를 싣는다.** 비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER` 라는 것이 그 결정의 채택안이다. 옛 문구("`@Roles()` 가 있으면 요구 역할과 코드")대로면 비멤버 코드가 광고에서 빠진다. 이미 코드를 싣던 28곳은 두 코드를 함께 싣고 있었고 문구를 그 실제에 맞췄다.
- **`viewer` 는 코드가 하나다.** `@Roles('viewer')` 의 거부는 멤버십 거부와 같다(`ROLE_REQUIRED.viewer` 가 `NOT_A_MEMBER`). "viewer 이상 권한 필요" 라고 쓰면 오지 않는 코드를 암시한다.
- **공용 헬퍼로 쓴다.** 문장 형식이 컨트롤러마다 갈렸다("Admin 미만 권한", "관리자 권한 필요", "권한 부족 (Admin 미만) 또는 비멤버"). 헬퍼가 코드를 `NOT_A_MEMBER`·`ROLE_REQUIRED` 상수에서 끼워 넣으므로 코드 이름이 바뀌어도 문장이 따라간다. 역할 문구 표기는 `ROLE_REQUIRED` 메시지("Editor 이상의 권한이 필요합니다.")를 따른다. 컨트롤러가 따로 두던 같은 문장의 상수(`workspaces` 의 `FORBIDDEN_*_ROUTE`, `integrations` 의 `FORBIDDEN_MEMBER`)는 이 헬퍼로 흡수한다.
- **reflection 으로 센다.** 설명은 상수 보간(`${NOT_A_MEMBER.code}`)이라 소스 텍스트로는 최종 문장을 알 수 없다. 데코레이터가 평가된 메타데이터를 읽는다. 가드가 낼 코드는 `RolesGuard` 와 같은 규칙(`@Public`, `@Roles`, 워크스페이스 소비)으로 계산하고 요구 중 가장 낮은 역할을 고르는 식은 가드와 **같은 함수**(`lowestRequiredRole`)를 쓴다. 따로 옮겨 적으면 둘이 갈리는 날 검사가 가드가 내지 않는 코드를 찾게 된다. 나머지 분기가 가드와 같은지는 가드 spec 의 "모델 캐너리" 가 실제 `RolesGuard` 를 돌려 대조한다. 스캔 모집단이 비는 공허함은 하한(컨트롤러 30, 대조 라우트 150 초과)이 막는다.
- **대조군은 가드 spec 안의 클래스다.** reflection 가드라 대조군도 데코레이터가 실제로 평가된 클래스여야 하고 모델 캐너리가 같은 클래스를 실제 `RolesGuard` 에 돌린다. 별 파일로 두면 대조군과 캐너리가 두 곳이 된다. 그래서 구현 위치에는 가드 파일 한 쌍만 적는다.
- **기존 라우트까지 소급한다.** §1-4·§3 의 규약은 새 변경에만 걸지만 이 규칙은 §2-4 처럼 **광고가 실제와 맞는가** 의 문제다. 틀린 광고는 이미 배포된 라우트에서 클라이언트를 오도한다.
- **서비스 거부는 세지 않는다.** 서비스가 내는 403 은 자리마다 조건과 코드가 달라 기계적으로 판정할 수 없다. 헬퍼 문장 뒤에 덧붙이도록 안내만 한다.

### 요청 본문 스키마: 왜 클래스로 받게 강제하지 않고 왜 reflection 으로 세는가 (§5-4, 2026-09-26)

2026-09-26 실측(`src/modules` 컨트롤러의 `@Body()` 78개): OpenAPI 에 요청 본문이 없던 라우트 3곳(`rotate-bot-token`, 실행 `continue`, 웹훅 수신)을 채운 뒤 DTO 클래스 74, 인라인 타입과 `@ApiBody` 4 로 광고하지 않는 자리가 0이 됐다.

- **클래스로 받게 강제하지 않는다.** 전역 `CustomValidationPipe` 는 파라미터 설계 타입이 클래스일 때만 들어가고 들어가면 `whitelist`·`forbidNonWhitelisted` 가 켜진다. 인라인 타입으로 받던 라우트를 클래스로 바꾸면 문서를 다는 작업이 **계약 변경**이 된다. `rotate-bot-token` 은 문자열이 아닌 `newBotToken` 에 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 이 약속한 `INVALID_BOT_TOKEN` 대신 `VALIDATION_ERROR` 를 내고 여분 키를 보내던 요청이 400 이 된다. 그래서 트래커가 처음 적었던 처방("요청 DTO 승격")을 택하지 않고 문서 전용 DTO 를 `@ApiBody` 로만 쓴다. 선례는 `ExecuteWorkflowDto`(워크플로우 실행 본문, 캐너리 `workflows-execute-body.spec.ts`)다.
- **`schema: {}` 와 열린 map 은 다르다.** 본문이 객체라는 것조차 보장되지 않으면(웹훅은 JSON 배열이나 원시값도 온다) `@ApiBody({ schema: {} })` 로 "임의 값" 을 적는다. 객체는 보장되고 키만 열려 있으면 §1-4 의 `additionalProperties: true` 다.
- **reflection 으로 센다.** 판정 축은 파이프가 받는 바로 그 값이어야 한다. 파이프는 `design:paramtypes` 가 `Object`·`String`·`Number`·`Boolean`·`Array` 면 건너뛰고 그 자리는 플러그인도 스키마를 만들지 못한다. 가드는 파이프가 export 하는 그 목록을 그대로 쓴다. 소스(AST)로는 `interface` 나 타입 별칭 참조가 런타임에 `Object` 가 되는 것을 클래스 참조와 구별할 수 없다.
- **못 보는 것.** `@ApiBody` 가 **맞는** DTO 를 가리키는지는 라우트별 캐너리(`*-body.spec.ts`)가 본다. 이 가드는 광고가 **있는지**만 센다. 클래스 파라미터의 DTO 가 실제 본문과 맞는지도 이 가드 밖이다(요청 쪽 검증은 파이프가 한다).

### 공개 문장의 저장소 내부 참조를 왜 가드로 세는가 (규칙 17, 2026-10-03)

2026-09-05 규약화(규칙 14)는 내부 서사만 `//` 주석으로 보냈다. 저장소 내부 참조는 금지하지 않았다. 오히려 §3 보안·정책 캐비엇은 설명에 1~2문장 요약과 기준 문서 링크를 적으라고 했다. EIA `context` 의 `ConversationThreadDto` 문단도 description 이 대화 스레드 문서를 가리킨다고 적었다. 2026-10-03 에 이 두 지시를 뒤집었다. 기준 문서 링크는 바로 위 `//` 주석으로 옮겼고 공개 문장에서는 저장소 내부 참조를 금지했다(규칙 17).

이 참조는 외부 소비자에게 쓸모가 없다. 옛 스펙 트리는 전환 단계 5 에서 지웠으므로 경로는 죽은 문자열이다. 외부 소비자는 NERV 스펙 키도 열어 볼 수 없다. 그래서 전환 단계 4c(NERV Task `CLE-T-9AM31N`)에서 공개 문장에는 사실만 남겼다. 필요한 근거는 바로 위 `//` 주석의 키 링크로 옮겼다. 같은 변경에서 가드 `openapi-internal-ref` 를 세웠다.

4c 가 걷은 곳은 모두 91곳(50파일)이다. 처음에는 네 형태(스펙 경로 · NERV 키 · 요구사항 ID · 옛 plan 경로)로 세 자리(DTO 필드 JSDoc · 컨트롤러 메서드 JSDoc · 데코레이터의 `description` · `summary` 문자열)를 세어 41곳을 걷었다. 옛 스펙 파일 이름 형태를 더해 2곳을 더 찾았다. 채널을 두 파일 종류의 모든 `/** */` 로 넓히고 옛 요구사항 ID 형태를 더해 48곳을 더 걷었다. 베이스라인은 0 이다.

- **두 파일 종류의 `/** */` 를 모두 본다.** `*.dto.ts` · `*.controller.ts` 의 모든 `/** */` 블록(클래스 · 멤버 · 파일 수준 선언)과 두 파일 종류의 `description` · `summary` 문자열 속성을 본다. 파일 종류는 `nest-cli.json` 의 플러그인 suffix 와 같다. 클래스 JSDoc 처럼 플러그인이 싣지 않는 자리도 같은 채널로 센다. [리뷰 산출물 인용 규약](../CLE-ENG/CLE-ENG-REVIEWCITE.md) 이 응답 DTO 파일의 `/** */` 를 한 채널로 보고 클래스 JSDoc 을 `//` 와 같게 보는 안 (A) 를 기각한 것과 같은 이유다. 쓰는 사람이 플러그인 동작을 보고 자리마다 판단하지 않아도 된다. 클래스 설명을 `@ApiSchema({ description })` 로 옮겨 적을 때 참조가 딸려 나가지도 않는다.
- **찾는 형태는 여섯이다.** 저장소 스펙 경로(`spec/…`), 옛 스펙 파일 이름, NERV 스펙 키(`CLE-…`), 요구사항 ID(`REQ-…-NNN`), 옛 요구사항 ID, 옛 plan 경로(`plan/in-progress/` · `plan/complete/`)다. 옛 스펙 파일 이름은 `spec/` 없이 적은 옛 트리 파일 이름(`15-chat-channel.md` · `../../2-navigation/4-integration.md`)이다. 옛 트리 파일 이름은 번호로 시작하므로 가드는 번호로 시작하는 `.md` 이름(`\b\d+-[a-z][\w-]*\.md\b`)을 잡는다. 번호 없는 `README.md` 같은 이름은 잡지 않는다. 옛 요구사항 ID 는 옛 트리 스펙의 앵커 ID(`WH-SC-01` · `CCH-ERR-03`)다. 대문자 묶음 둘 이상 뒤에 두 자리 숫자가 오는 모양으로 잡는다. 옛 트리의 이런 ID 690개가 모두 두 자리라서(2026-10-03 실측) `HMAC-SHA-256` 같은 세 자리 표준 이름은 잡지 않는다. `SHA-256` 처럼 대문자 묶음이 하나인 이름도 잡지 않는다. NERV 키 패턴은 NERV Task 키(`CLE-T-…`)도 잡는다.
- **`//` 와 `/* */` 주석은 보지 않는다.** 근거를 옮겨 적는 자리라 일부러 비워 둔다.
- **기존 자리까지 걷었다.** §1-4 · §3 의 비소급 원칙은 내부 서사에 걸린다. 내부 참조는 기계로 판정되고 문구를 지우면 끝난다. 전환 단계 5 에서 옛 트리를 지운 뒤로는 죽은 문자열이다. 그래서 기존 자리까지 걷었다.
- **베이스라인은 0 이다.** 공개 문장에서 내부 참조를 빼는 일은 언제나 할 수 있다. 그래서 예외를 둘 자리가 없다.
- **못 보는 것이 있다.** 상수나 헬퍼로 조립한 설명은 보지 못한다. 가드는 문자열 리터럴과 `+` 연결, 템플릿 리터럴의 고정 부분만 읽는다. 두 파일 종류 밖의 파일(`*.query.ts` 등)과 `example` · `@ApiTags` 같은 다른 키도 보지 않는다. 경로 없는 절 번호 인용(`[Spec EIA §4]`, 상수로 조립한 설명 속 `(spec 통합 §8 · §9.2)` 등)은 모양이 일정하지 않아 잡지 못한다. 그 인용은 남아 있고 정리는 NERV Task `CLE-T-BCS6QZ` 가 맡는다.
- **리뷰 인용은 다른 가드가 본다.** 응답 DTO JSDoc 의 리뷰 인용은 `dto-jsdoc-citation` 이 본다([리뷰 산출물 인용 규약](../CLE-ENG/CLE-ENG-REVIEWCITE.md)). 그 규약 규칙 9 · 10 이 금지한 두 형태(`finding` 바로 뒤 소문자 16진 8자로 줄인 발견 ID, `.review/` 아래 code · consistency · merge · spec-coverage 경로)는 `review-citation-form` 이 `codebase/**` 의 텍스트 파일에서 본다(전환 단계 4g, 2026-10-03). 요청 DTO · 컨트롤러 JSDoc 과 `description` · `summary` 문자열도 그 범위에 든다. 그 가드가 읽는 파일, 잡는 형태, 잡지 못하는 형태는 그 규약의 [강제 범위](../CLE-ENG/CLE-ENG-REVIEWCITE.md#강제-범위) 에 있다. 규칙 17 의 「리뷰 인용은 이 목록에 없고」 는 발견 ID 와 옛 리뷰 경로처럼 Task 키가 아닌 리뷰 인용을 뜻한다. NERV Task 키(`CLE-T-…`)는 NERV 키 모양이라 규칙 17 의 여섯 형태에 든다. 그래서 Task 키 인용은 이 문서의 가드 `openapi-internal-ref` 가 NERV 키 형태로 잡는다. 그 밖의 리뷰 인용 형식(옛 리뷰 경로, 날짜 없는 시각, 전체 발견 ID)은 응답 DTO 파일 밖에서는 어느 가드도 보지 않는다(그 규약의 강제 범위).
- **프런트엔드 공개 표면도 같은 패턴으로 본다.** `public-surface-internal-refs`(`codebase/frontend/src/lib/__tests__/public-surface-internal-refs.test.ts`)가 배포 SVG 와 외부 SDK(`@workflow/sdk` · `@workflow/web-chat`)의 README · `package.json` 을 같은 패턴으로 본다.
