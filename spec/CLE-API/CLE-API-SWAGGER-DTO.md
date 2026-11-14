---
id: "CLE-API-SWAGGER-DTO"
title: "OpenAPI 문서화 — DTO 패턴"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-SWAGGER"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-SWAGGER"]
area: "CLE-API"
content_hash: "88efd362dad91daee98341a5bd7a1f7d61ff8ee0b9b98bb89a34681d85da3038"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "50f1eada84ce8e3e3b32dcea20e34c1bfde4e5e739869ab12e1a62851bbd8e85"
etag: "sha256-95d4fa69ad9c651e4eb2c21983a4c9bdee3862bdbd980b9a85ad07ae5ba2af51"
---
## 개요

이 문서는 [OpenAPI 문서화](CLE-API-SWAGGER.md) 의 하위 문서로 DTO 의 OpenAPI 선언 패턴(§1)을 정한다. 필드 JSDoc 과 `@ApiProperty` 보강, optional 필드, enum · nested · 닫힌 union · 열린 map, `writeOnly` · `readOnly`, numeric 컬럼의 wire 타입, 요청 DTO 이름이 대상이다. 응답 DTO 의 위치 · 이름 유일성과 공용 래퍼 헬퍼는 [컨트롤러와 응답 DTO](CLE-API-SWAGGER-ROUTE.md) 가, 설명 문구의 톤 · 길이 · 내부 참조 금지는 [설명 문구와 내부 참조](CLE-API-SWAGGER-TEXT.md) 가 정한다.

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
- 응답 **body 전체**가 union 이면 필드 수준이 아니라 공용 헬퍼 `ApiOkWrappedOneOfResponse`([§5-2](CLE-API-SWAGGER-ROUTE.md#5-2-공용-래퍼-헬퍼))를 쓴다.

**열린 map (키 집합이 런타임에 정해짐)**: `@ApiProperty({ type: 'object', additionalProperties: true })`.

- 노드 타입별 자유 payload(`nodeOutput`), 사용자 정의 변수 맵처럼 **실제로 키가 열려 있는** 경우에만 쓴다.
- "타입을 특정하기 번거롭다" 는 이유로 쓰지 않는다. variant 집합이 코드로 정해지면 위 닫힌 union 이 맞다([§6](CLE-API-SWAGGER-ROUTE.md#6-레거시-패턴-제거) 의 "빈 껍데기 스키마 금지" 와 같은 취지).
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

## 구현 위치

- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts` (§1-6 `findNumericAsNumber` 등 DTO 선언 대조)
- 대조군(negative fixture) `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable*.ts`. 가드가 강제하는 위반 형태의 실례다. 없으면 술어가 죽어도 테스트가 통과한다.

## Rationale

### numeric wire 타입: 가드와 규약의 책임 분리 (§1-6)

**기각한 대안: 가드가 명시 변환 경로까지 판정하게 하기.** 그러면 이 규약 절이 필요 없어진다. 그러나 그 판정은 서비스 코드의 데이터 흐름을 따라가야 성립한다. `SUM(...)::float` 가 어느 필드로 흘러 어느 DTO 로 조립되는지를 정적으로 잇는 일이고 `findNumericAsNumber` 가 서 있는 AST 수준에서 할 수 있는 판정이 아니다. 무리하게 넓히면 그 파일이 스스로 적어 둔 "정규식으로 세 번 틀렸다" 는 자리로 되돌아간다.

그래서 나눈다. 정적으로 판별할 수 있는 갈래(패스스루)는 가드가, 변환 유무를 사람이 아는 갈래는 이 규약이 맡는다. 저장소의 numeric 컬럼이 둘뿐이고 그 둘이 각각 다른 갈래라는 실측이 이 형태를 정했다.

### `Update` 접두의 범위: 왜 nested 변형에는 걸지 않는가 (§1-7)

실측이 규칙의 **범위**를 정했다. `Update*Dto` 는 18개이고 예외 없이 모두 접두다. 동시에 예외 없이 모두 컨트롤러 `@Body()` 로 받는 top-level 요청 바디다. 이름에 `Config` 가 들어간 `UpdateModelConfigDto`·`UpdateAuthConfigDto` 도 그렇다. 즉 "18/18 이 접두" 라는 사실은 그 집합이 top-level 요청 바디라는 성질과 붙어 있다.

그래서 `ChatChannelUpdateConfigDto`(2026-09-11 신설, `OmitType` nested 변형)를 두고 "18/18 이 접두니 이것도 접두여야 한다" 고 보는 것은 집합을 넘은 일반화다. nested 필드 DTO 는 `<Domain><Role>Dto` 라는 다른 축을 쓰고 있고(`ChatChannelConfigDto`, `ChatChannelUiMappingDto`, `ChatChannelBotIdentityDto`), 접두로 바꾸면 형제들과 어긋나면서 호출 규약(top-level 바디인가)을 이름으로 거짓 신호하게 된다.

**기각한 대안: 개명**(`UpdateChatChannelConfigDto`). 위 이유로 기각했다. 규칙을 넓히는 대신 규칙에 범위를 적는 것이 같은 오독을 반복하지 않게 하는 최소 조치다.

### 닫힌 union 을 `additionalProperties` 로 뭉개지 않는다 (§1-4)

옛 §1-4 는 "union 또는 dynamic" 을 한 줄로 묶어 둘 다 `additionalProperties: true` 로 안내했다. 그 결과 variant 집합이 코드로 정해진 필드까지 Swagger 에서 빈 객체로 나가, 생성 SDK 와 손으로 쓴 클라이언트 타입이 wire 와 어긋나도 잡히지 않았다. 실제 사례로 EIA 단발 상태 조회의 `context` 가 `Record<string, unknown> | null` 로 선언된 동안, 위젯의 `eia-types.ts` 는 형제 필드 `currentNode` 를 `string | null` 로 잘못 선언했고(실제 wire 는 객체) 아무 검증도 이를 잡지 못했다. `api-wrapped.ts` 의 `ApiOkWrappedOneOfResponse` 가 **응답 수준** `oneOf` 를 이미 주고 있었고 없던 것은 **필드 수준** 대응물뿐이었다.

"열림" 은 키 집합이 런타임에 정해진다는 사실 진술이지 타입을 적기 번거롭다는 편의 표현이 아니다. 두 경우를 문장 하나로 묶어 둔 것이 혼동의 원인이라 절을 나눴다. 다만 기존 필드를 한꺼번에 소급해 다시 선언하는 것은 요구하지 않는다. [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md) 의 원칙 3 이 같은 이유(넓은 회귀 위험에 비해 낮은 효용)로 새 변경에만 분류 규칙을 적용하는 것과 같은 형태다.

### `discriminator` 는 판별자가 완전할 때만 (§1-4)

OpenAPI `discriminator.propertyName` 은 "그 필드 값 → variant" 매핑이 **전단사**라고 SDK 생성기에 약속한다. 약속이 깨지면 생성기는 조용히 잘못된 variant 로 좁힌다.

EIA 단발 상태 조회의 `context` 가 그 반례다. `interactionType` 은 판별자처럼 보이지만 `buttons` 는 `buttonConfig` 를 실은 변형과(핸들러가 `buttonConfig` 를 싣지 못해 넘어간) `nodeOutput` 변형 **양쪽**에 나온다. `discriminator: { propertyName: 'interactionType' }` 을 선언하면 SDK 는 모든 `buttons` 응답을 `buttonConfig` 변형으로 좁히고 넘어간 경우에 `context.buttonConfig.buttons` 접근이 런타임 `undefined` 가 된다. 그래서 `oneOf` 만 선언하고 판별은 **키 존재**(`'buttonConfig' in context`)로 남긴다.

넘어가는 경우 자체를 없애 판별자를 완전하게 만드는 대안은 wire 변경이라 [EIA 수신 API와 SSE 「단발 상태 조회」](../CLE-IX/CLE-EIA-INBOUND.md#단발-상태-조회) 의 SSE 형식 일치 계약을 건드린다. 별건으로 둔다. 이 규칙은 `api-wrapped.ts` `wrapOneOfDataSchema` 의 기존 JSDoc("호출자는 모든 DTO 가 동일 `propertyName` 필드를 보유함을 보장해야 한다")을 규약 수준으로 올린 것이다.

### EIA `context` 는 봉투만 스키마로 닫고 안쪽은 열어 두는 이유 (§1-4)

`nodeOutput` 과 `buttonConfig.buttons` 는 노드 타입별 자유 payload(`formConfig`, `conversationConfig`, 임의 키)라 §1-4 의 **진짜 열린 map** 이다. 클래스로 고정하면 노드 타입이 늘 때마다 DTO 가 따라 늘고 여러 노드 문서가 참조하는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 과 기준이 이중화된다. 봉투(`interactionType`, `waitingNodeId`, `conversationThread`, 변형 키)만 닫고 안쪽은 열어 두는 것이 두 규약의 책임 경계와 맞는다.

같은 이유로 `ConversationThreadDto` 도 만들지 않는다. [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 의 자료구조 절이 스레드 형태(`turns[]`, `source`, `totalChars`, `nextSeq`)의 기준이고 Swagger DTO 로 다시 선언하면 두 문서가 갈린다. 봉투에서는 열린 객체로 두고 바로 위 `//` 주석이 대화 스레드 문서를 키 링크로 가리킨다(규칙 17).
