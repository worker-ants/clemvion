# API 계약(API Contract) 리뷰

## 리뷰 대상

- `codebase/backend/package.json` — `@nestjs/swagger` `^11.2.7` → `^11.4.5`
- `codebase/backend/src/common/swagger/api-wrapped.ts` — `SchemaObject` 타입을 deep-import(`@nestjs/swagger/dist/interfaces/open-api-spec.interface`)에서 공개 타입 `ApiResponseSchemaHost['schema']` 파생으로 교체
- `.../execution-status-response.dto.spec.ts`, `.../interact-ack-response.dto.spec.ts` — 동일한 `SchemaObject` 타입 교체 (regression guard 테스트 본문/assertion 자체는 무변경)
- `pnpm-lock.yaml`, `pnpm-workspace.yaml` — `@nestjs/swagger` 버전 핀(`11.2.7`) 제거 + lockfile 갱신 (부수적으로 `js-yaml`/`swagger-ui-dist`/`nanoid`/`picomatch`/`postcss` 등 전이 의존성 소폭 갱신)

## 발견사항

- **[INFO]** `SchemaObject` 대체는 순수 컴파일타임 타입 변경, 런타임 스키마 shape 불변
  - 위치: `codebase/backend/src/common/swagger/api-wrapped.ts` (import 구문 및 `type SchemaObject = ApiResponseSchemaHost['schema']` 1줄만 변경)
  - 상세: `wrapDataSchema`/`wrapOneOfDataSchema`/`wrapItemsSchema`/`wrapPaginatedSchema` 함수 본문(반환하는 object literal 구조)은 diff 에 전혀 등장하지 않는다 — `{data: <ref>}`, `oneOf`, `discriminator`, `{data, pagination}` 형태 그대로다. 즉 이번 변경은 "swagger 패키지가 deep-import 경로를 `exports` 맵으로 차단해 타입을 못 가져오는 컴파일 에러"를 공개 타입으로 우회한 것이지, API 응답 스키마 생성 로직 자체를 바꾼 게 아니다. `ApiResponseSchemaHost['schema']` 는 코멘트에 따르면 `SchemaObject & Partial<ReferenceObject>` 로, 기존 `SchemaObject` 보다 넓은(더 permissive) 타입이라 `dataSchema.discriminator = {...}` 같은 기존 코드가 타입 에러 없이 그대로 컴파일된다.
  - 제안: 없음 (정상적인 vendor `exports` 맵 대응).

- **[INFO]** DTO 스키마 회귀 가드가 minor 버전 업(11.2.7→11.4.5) 전후로 동일 통과 — 실제 OpenAPI 문서 생성 결과 불변 확인
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts`, `interact-ack-response.dto.spec.ts`
  - 상세: 두 spec 은 `SwaggerModule.createDocument()` 로 실제 OpenAPI 문서를 빌드해 `oneOf`/`discriminator` 부재/`nullable`/`allOf` $ref wrap/`enum`/`required`/`additionalProperties` 등 스키마 생성의 가장 미묘한(vendor 내부 로직에 의존적인) 부분들을 assert 한다. 이 28개 테스트가 11.4.5 에서도 변경 없이 통과한다는 것은, 최소한 이 두 DTO 패밀리가 사용하는 패턴(닫힌 union oneOf, nullable, allOf-wrap $ref, enum, 부분 required)에 대해 vendor 라이브러리의 문서 생성 동작이 이번 minor 업그레이드로 달라지지 않았음을 실증적으로 뒷받침한다.
  - 제안: 없음 — 회귀 가드가 정확히 의도된 목적(버전 업그레이드 시 스키마 shape 불변 검증)을 수행하고 있다.

- **[INFO]** 전체 애플리케이션 OpenAPI 문서(`/docs`)에 대한 풀 스냅샷 회귀 테스트는 없음 — 두 DTO 패밀리 외 나머지 컨트롤러/DTO 는 이번 업그레이드로 인한 스키마 변화 여부가 자동 검증되지 않음
  - 위치: `codebase/backend/src/main.ts:116-124` (`SwaggerModule.createDocument(app, swaggerConfig)` + `SwaggerModule.setup('docs', ...)` — 앱 전체 컨트롤러를 스캔해 공개 `/docs` 엔드포인트로 서빙), vs. `grep -rl "SwaggerModule.createDocument" src --include="*.spec.ts"` 결과 단 2개 파일만 존재
  - 상세: `/docs`(및 그 JSON, 예: `/docs-json`)는 앱 전체 API 표면의 OpenAPI 문서이며, SDK 자동 생성 도구(openapi-generator 등)나 외부 API 컨슈머가 이를 참조할 수 있다. 이번 PR 의 회귀 가드는 EIA(`ExecutionStatusDto`, `InteractAckDto`) 두 DTO 패밀리에 국한되고, 나머지 ~25개 태그(Workflows/Nodes/Edges/Integrations/Statistics 등)에서 쓰이는 다른 데코레이터 조합(`PartialType`/`OmitType` 매핑 타입, 배열 `items` $ref, 커스텀 `example`, enum 변형 등)이 11.3.x~11.4.x 사이 vendor 변경으로 미세하게 달라졌는지는 이 diff 로는 검증되지 않는다. 다만 `^11.2.7`→`^11.4.5` 는 동일 major(11) 내 minor 업그레이드이므로 vendor 의 semver 계약상 공개 API(데코레이터 시그니처, `DocumentBuilder`, `SwaggerModule`)의 breaking change 는 기대되지 않고, 이번 diff 자체도 데코레이터 사용법 변경 없이 타입 import 하나만 수정했다는 점에서 실제 회귀 가능성은 낮게 평가한다.
  - 제안: (선택적 강화) `/docs-json` 전체 문서를 업그레이드 전/후로 스냅샷 diff 해보는 1회성 검증을 CI 밖에서 수행하거나, 향후 유사 vendor 업그레이드 시 최소한 대표적인 다른 컨트롤러(예: 배열 페이지네이션 응답, `PartialType` 사용 DTO)에 대해서도 동일한 문서-생성 회귀 가드를 추가하는 것을 고려. 현재로선 CRITICAL/WARNING 급 문제로 보지 않음(증거 기반 위험 낮음).

- **[INFO]** 버전 핀 제거는 근본 원인 해결과 짝을 이뤄 안전하게 처리됨
  - 위치: `pnpm-workspace.yaml` (`overrides` 블록에서 `"@nestjs/swagger": 11.2.7` 및 관련 주석 삭제), `codebase/backend/package.json`
  - 상세: 기존 핀은 "`api-wrapped.ts` 가 deep-import 를 쓰는데 11.4.x `exports` 가 이를 차단한다"는 이유로 존재했다. 이번 PR 은 그 근본 원인(deep-import 의존)을 공개 타입 파생으로 제거한 뒤 핀을 함께 해제했으므로, 핀만 먼저 풀리고 fix 가 누락되는 순서 문제는 없다. `package.json` 의 `^11.4.5` 는 다른 `@nestjs/*` 패키지들과 동일하게 caret range 를 유지해 버전 관리 일관성도 지킨다.
  - 제안: 없음.

## 요약

이번 변경은 실제 컨트롤러 라우트·요청 검증·에러 응답·인증/인가·페이지네이션 로직에는 전혀 손대지 않고, `@nestjs/swagger` minor 버전 업그레이드(11.2.7→11.4.5)에 따른 내부 deep-import 차단 문제를 공개 타입(`ApiResponseSchemaHost['schema']`)으로 우회한 순수 타입-레벨 수정이다. 응답 래퍼 함수(`wrapDataSchema`/`wrapOneOfDataSchema`/`wrapItemsSchema`/`wrapPaginatedSchema`)의 런타임 반환 object literal 구조는 diff 상 전혀 변경되지 않았고, EIA 두 DTO 패밀리(28개 테스트)의 실제 OpenAPI 문서 생성 회귀 가드가 업그레이드 전후 변경 없이 통과해 스키마 shape 불변을 실증한다. 다만 앱 전체 OpenAPI 문서(`/docs`, SDK 생성 소스가 될 수 있는 공개 표면)에 대한 풀 스냅샷 회귀 테스트는 없어 이 두 DTO 밖의 나머지 API 표면에 대한 자동 검증 커버리지는 제한적이나, 동일 major 내 minor 업그레이드라는 semver 계약과 이번 diff 의 범위(타입 import 교체뿐, 데코레이터 사용 변경 없음)를 고려하면 실질적 breaking risk 는 낮다.

## 위험도

LOW
