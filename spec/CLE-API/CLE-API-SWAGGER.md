---
id: "CLE-API-SWAGGER"
title: "OpenAPI 문서화"
type: "convention"
version: 6
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API"
ancestors: ["CLE-VISION", "CLE-API"]
area: "CLE-API"
content_hash: "74cf5cbfde4b4c5146a9e1b54f3871c6c5439222902d8c8fec9ee3b2a1b4c9da"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/conventions/swagger.md"]
mirror_sha256: "4b36ba81ad3adbca2c147261fecdbb2979ff18b833612cbaf56b1796f97baf85"
etag: "sha256-51079bcd7b10fa7dacf761a59b4c906ed51422a9e5303de866cdfdc6fa2a631f"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/swagger.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 `@nestjs/swagger` 로 OpenAPI 문서(OpenAPI, Swagger)를 만드는 방법과, 그중 외부 API 계약에 닿는 노출 정책을 정한다. DTO·컨트롤러 데코레이터 패턴, 응답 DTO·요청 DTO(response DTO, request DTO) 규약, 설명 문구의 톤과 길이, Swagger UI 노출 범위가 대상이다. 이 문서는 입구로 규칙 목록, 노출 정책(§0), 모듈별 작업 순서(§4)를 두고, 패턴과 근거의 상세는 「하위 문서」 절의 세 문서가 맡는다. 절 번호(§0~§6)는 하위 문서에서도 그대로 쓴다.

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
17. DTO · 컨트롤러 파일(`*.dto.ts` · `*.controller.ts`)의 `/** */` 블록 전부와 데코레이터의 `description` · `summary` 문자열에는 저장소 내부 참조를 적지 않는다. 저장소 내부 참조는 스펙 경로, 번호로 시작하는 옛 스펙 파일 이름, NERV 키(`CLE-…`), 요구사항 ID(`REQ-…-NNN`), 옛 요구사항 ID, 옛 plan 경로의 여섯 형태다. 근거는 바로 위 `//` 주석에 키 링크로 적는다([스펙과 구현 근거 규약](../CLE-ENG/CLE-ENG-SPECEVIDENCE.md) 규칙 18 · R-14). 저장소 가드 `openapi-internal-ref` 가 강제한다. 발견 ID · 옛 리뷰 경로 같은 리뷰 인용(Task 키 제외)은 이 목록에 없고 [리뷰 산출물 인용 규약](../CLE-ENG/CLE-ENG-REVIEWCITE.md) 이 정한다. 가드의 강제 범위와 못 보는 것은 Rationale 「공개 문장의 저장소 내부 참조를 왜 가드로 세는가」 에 적는다([설명 문구와 내부 참조](CLE-API-SWAGGER-TEXT.md#공개-문장의-저장소-내부-참조를-왜-가드로-세는가-규칙-17-2026-10-03)).

## 하위 문서

이 문서에는 요구사항 줄이 없다. 하위 문서마다 맡는 규칙 번호(위 「규칙」 절)를 적는다.

- [OpenAPI 문서화 — DTO 패턴](CLE-API-SWAGGER-DTO.md): §1. 필드 JSDoc · `@ApiProperty` 보강, optional, 닫힌 union · `discriminator` · 열린 map, `writeOnly` · `readOnly`, numeric wire 타입, 요청 DTO 의 `Update` 접두와 각 근거. 규칙 2 · 3 · 4 · 5 · 6 · 7 · 8.
- [OpenAPI 문서화 — 컨트롤러와 응답 DTO](CLE-API-SWAGGER-ROUTE.md): §2 · §5 · §6. 보안 scheme, 엔드포인트 데코레이터, 상태 코드 광고, 응답 wrapping, 응답 DTO 위치 · 이름 유일성, 공용 래퍼 헬퍼, 새 엔드포인트 체크리스트(403 설명 · 요청 본문), 레거시 패턴 제거와 각 근거. 규칙 9 · 10 · 11 · 12 · 13.
- [OpenAPI 문서화 — 설명 문구와 내부 참조](CLE-API-SWAGGER-TEXT.md): §3. 설명 톤과 길이, JSDoc 과 `//` 주석의 분리, 보안·정책 캐비엇, 공개 문장의 저장소 내부 참조 금지와 그 가드. 규칙 14 · 15 · 16 · 17.

## 0. Swagger UI 노출 정책

Swagger UI(`/docs`)는 production 이 아닌 환경에서만 노출한다.

- `NODE_ENV=production` 에서는 기본으로 노출하지 않는다. 인증 없이 API 표면을 정찰하는 것(엔드포인트·DTO 구조 노출, OWASP 정보 노출)을 막기 위해서다.
- 노출 여부는 `production-guards.ts` 의 `isSwaggerEnabled(env)` 한 함수가 판정한다. OAuth·LLM stub 가드와 같은 형태다.
- production 에서 잠깐 디버깅해야 하면 `ENABLE_SWAGGER_IN_PROD=true`(정확히 `true` 또는 `1`)로 켠다. 켜는 순간 인증 없는 노출 위험이 돌아오므로 일시적으로만 쓴다. 켜도 IP 제한이나 Basic Auth 같은 추가 보호는 없으므로 운영자가 따로 앞단에 둔다.

## 4. 엔드포인트별 작업 순서

모듈마다 다음 순서로 작업한다.

1. 컨트롤러 파일을 읽는다.
2. DTO 파일을 한꺼번에 읽는다.
3. DTO 파일에 JSDoc 과 필요한 `@ApiProperty(Optional)` 를 더한다.
4. 컨트롤러 클래스에 `@ApiTags` 와 (보호된 경우) `@ApiBearerAuth('access-token')` 을 단다.
5. 각 엔드포인트에 `@ApiOperation`, 파라미터, 응답 데코레이터를 더한다.
6. `@Public()` 엔드포인트에는 `@ApiBearerAuth` 를 생략하거나 설명으로 명시한다.

## 5. 응답 DTO 규약

§5 는 [컨트롤러와 응답 DTO](CLE-API-SWAGGER-ROUTE.md#5-응답-dto-규약) 가 정한다. 아래 두 소제목은 다른 문서가 이 문서의 앵커로 링크하는 자리라 링크 스텁으로 남긴다.

### 5-1. 응답 DTO 위치

→ [OpenAPI 문서화 — 컨트롤러와 응답 DTO](CLE-API-SWAGGER-ROUTE.md#5-1-응답-dto-위치)

### 5-2. 공용 래퍼 헬퍼

→ [OpenAPI 문서화 — 컨트롤러와 응답 DTO](CLE-API-SWAGGER-ROUTE.md#5-2-공용-래퍼-헬퍼)

## 구현 위치

주제별 가드 · 대조군은 각 하위 문서의 구현 위치 절에 있다.

- `codebase/backend/src/common/swagger/**` (공용 래퍼 헬퍼, `ErrorResponseDto`, 403 설명 헬퍼)
- `codebase/backend/nest-cli.json` (CLI 플러그인 설정)
- `codebase/backend/src/common/config/production-guards.ts` (`isSwaggerEnabled`)
- `codebase/backend/src/main.ts` (Bearer scheme 등록)
- `codebase/backend/src/shared/testing/swagger-probe*.ts`

## Rationale

### Swagger UI production 비노출과 opt-in (§0)

Swagger UI 를 production 에서 기본으로 노출하지 않는 것은 인증 없는 API 표면 정찰(엔드포인트·DTO 구조 노출)을 막기 위해서다. 노출 판정을 `isSwaggerEnabled(env)` 한 함수로 뺀 이유는 OAuth·LLM stub 가드와 같은 형태(`NODE_ENV` 기반 분기와 opt-in 환경 변수)로 맞춰 운영자가 떠올리는 모델을 하나로 만들고 단위 테스트로 분기를 고정하기 위해서다.

`ENABLE_SWAGGER_IN_PROD` opt-in 을 둔 이유: production 디버깅 요구를 받아들이되 기본값은 안전하게 둔다. 켤 때 IP 제한이나 Basic Auth 같은 추가 인증 계층을 기본으로 주지 않는 이유는 production 노출 자체가 상시 요구로 기록되지 않은 예외적 디버깅 용도이기 때문이다. 인증 계층 구현은 그 요구가 상시화될 때 검토한다(지금은 과투자를 피한다). 필요하면 운영자가 reverse proxy 에서 보호를 둔다.
