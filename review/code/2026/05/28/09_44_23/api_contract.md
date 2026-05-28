# API 계약(API Contract) 리뷰 결과

검토 대상: integration-activity-api-label PR
검토 일시: 2026-05-28
주요 변경: `integration_usage_log` 3컬럼 추가 + `GET /api/integrations/services/:type/catalog` 신규 endpoint + 활동 API 응답 필드 확장

---

## 발견사항

### [INFO] `ActivityItem` 의 신규 필드가 optional(`?`) 로 선언되어 기존 클라이언트에 영향 없음 — 하위 호환성 적절

- 위치: `codebase/frontend/src/lib/api/integrations.ts` `ActivityItem` 인터페이스
- 상세: `apiLabel?: string | null`, `apiMethod?: string | null`, `apiPath?: string | null` 세 필드 모두 optional 타입으로 추가되었다. 기존 클라이언트가 이 필드를 읽지 않아도 컴파일·런타임 오류가 발생하지 않는다. 백엔드도 신규 컬럼 전체를 `NULL DEFAULT NULL` 로 선언하고 backfill 없이 신규 호출부터 채우므로, 기존 활동 로그 행의 응답에서 세 필드가 `null` 로 반환되는 것이 명시적으로 허용된다.
- 제안: 현재 설계 적절. 별도 조치 불필요.

---

### [INFO] 신규 catalog endpoint 는 추가(additive) 전용 — breaking change 아님

- 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` `@Get('services/:type/catalog')`
- 상세: 완전 신규 경로이고 기존 `GET /api/integrations/services` 또는 `GET /api/integrations/:id` 와 경로가 겹치지 않는다. NestJS 라우터에서 정적 prefix `services/:type/catalog` 가 동적 `/:id` 보다 우선하므로 충돌 없음. 코드 주석에도 선언 순서를 명시하여 관리 의도가 명확하다.
- 제안: 별도 조치 불필요.

---

### [WARNING] `getServiceCatalog` 의 `serviceType` 파라미터에 서버 측 유효성 검증이 없음

- 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` L223, `integrations.service.ts` `getServiceCatalog()`
- 상세: `@Param('type') type: string` 를 그대로 서비스 메서드에 전달한다. 서비스는 `if (serviceType === 'cafe24')` 분기 이외엔 빈 배열을 반환하며 예외를 던지지 않는다. 허용되지 않는 임의 문자열(예: `../../etc`, `<script>`) 이 경로 파라미터로 들어올 때 현재 구현상 실질 위협은 없지만, API 명세 관점에서 `type` 의 허용 값 집합이 swagger에 열거(enum)되지 않아 소비자가 유효 입력을 알 수 없다. 또한 `@ApiParam` 에는 `example: 'cafe24'` 만 있고 enum 제약이 없다.
- 제안: `@ApiParam({ name: 'type', enum: ['cafe24', 'http', 'database', 'email', 'mcp', 'google', 'github'], description: '서비스 타입' })` 또는 적어도 swagger description 에 "현재 지원 값: cafe24 (나머지는 빈 배열 반환)" 을 명시한다. 요청 파라미터 화이트리스트 검증보다는 최소한 Swagger 문서화를 통해 클라이언트 오용을 줄이는 것이 우선이다.

---

### [WARNING] `OperationCatalogEntryDto` 의 `method` / `path` 필드에 `@IsNotEmpty()` 등 런타임 검증 데코레이터가 없음

- 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` `OperationCatalogEntryDto`
- 상세: 응답 DTO 임에도 `key`, `method`, `path`, `labelKey` 에 `@ApiProperty` 만 있고 `class-validator` 데코레이터가 없다. 응답 DTO 는 request validation 대상이 아니므로 class-validator 부재가 버그는 아니다. 그러나 서비스 레이어에서 `listAllCafe24Operations()` 가 반환하는 메타데이터 구조가 바뀔 경우 컴파일 타임에 감지하지 못한다. `method`, `path` 의 타입이 `string` 으로 선언되어 있고 실제로 backend metadata 에서 가져오므로 런타임 검증 누락 자체가 즉각적 문제는 아니다.
- 제안: `OperationCatalogEntryDto` 를 `plainToInstance` + `validateSync` 로 검증하는 유닛 테스트를 추가하거나, 서비스 메서드 반환 타입을 DTO 클래스와 정확히 일치시켜 TypeScript 타입 검사로 커버하면 충분하다.

---

### [INFO] 에러 응답 형식 — 인증 실패 외 케이스 Swagger 미선언

- 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` `getServiceCatalog()` Swagger 데코레이터
- 상세: `@ApiUnauthorizedResponse` 만 선언되어 있고 `@ApiBadRequestResponse` 나 `@ApiNotFoundResponse` 는 없다. 현 구현상 `type` 파라미터가 알 수 없는 값이어도 400/404 를 반환하지 않고 `{ operations: [] }` 를 200으로 반환하므로 Swagger 선언과 실제 동작이 일치한다. 이 설계 자체는 "미지원 타입은 빈 배열" 이라는 명시적 정책의 결과로 적절하다.
- 제안: 별도 조치 불필요. 다만 Swagger description 에 "알 수 없는 serviceType 도 HTTP 200 + 빈 operations 반환" 이라는 동작을 명시하면 API 소비자의 오해를 방지할 수 있다.

---

### [INFO] 응답 래퍼 일관성 — `@ApiOkWrappedResponse` 적용 확인

- 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` L219
- 상세: 기존 endpoint 들과 동일하게 `@ApiOkWrappedResponse(OperationCatalogDto, ...)` 를 사용한다. 프로젝트 내 공통 응답 래퍼 패턴을 일관되게 따른다.
- 제안: 별도 조치 불필요.

---

### [INFO] URL 경로 설계 — 3단계 중첩은 기존 선례(`oauth/begin`) 와 동일 패턴

- 위치: `GET /api/integrations/services/:type/catalog`
- 상세: consistency-check 에서 이미 지적된 사항으로, API 규약 §2.2 의 2단계 권장을 초과하지만 `POST /api/integrations/oauth/begin` 이 동일 구조의 선례이다. endpoint 성격상 특정 서비스 타입(`:type`)의 메타데이터 카탈로그를 조회하는 RPC-style 읽기 요청으로, RESTful 계층 구조를 엄격히 따르면 `/api/service-catalogs/:type/operations` 같은 형태가 더 순수하지만, 통합 컨텍스트 내에 묶는 것이 소비자에게 더 직관적이다. 현 설계가 실용적 맥락에서 합리적이다.
- 제안: 별도 조치 불필요. 단, 추후 API 규약 §2.2 에 static-prefix 예외 조항을 추가해 두면 선례 근거가 명문화된다(consistency-check I1 권장과 동일).

---

### [INFO] 페이지네이션 — catalog endpoint 는 정적 메타데이터, 페이지네이션 불필요

- 위치: `GET /api/integrations/services/:type/catalog`
- 상세: 현재 cafe24 기준 100+ operation 이지만 전량 반환이다. 페이지네이션이 없는 이유는 (a) 메타데이터는 정적·소량이고 (b) frontend 가 1h staleTime 으로 캐싱하므로 반복 요청이 거의 없으며 (c) 빈 배열 포함 단일 응답 구조가 소비 코드를 단순하게 유지한다. cafe24 operation 수가 수천 개로 늘어나지 않는 한 현재 설계가 적절하다.
- 제안: 별도 조치 불필요. operation 수가 500개 이상이 될 경우 페이지네이션 재검토 권장.

---

### [WARNING] `getServiceCatalog` 에 인증 가드 적용 여부 명시 필요

- 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` `getServiceCatalog()`
- 상세: `@ApiUnauthorizedResponse` 데코레이터가 있으므로 인증이 필요한 endpoint 임을 Swagger 로 문서화했다. 그러나 소스 코드 diff 만으로는 컨트롤러 레벨 또는 모듈 레벨의 `@UseGuards(JwtAuthGuard)` 가 이 메서드에 실제 적용되는지 확인할 수 없다. consistency-check INFO I4 에서 "catalog endpoint 는 workspace 격리 없음(메타데이터는 동일 응답)" 이라고 이미 명시되어 있으나, JWT 인증 자체는 적용 여부가 코드 diff 에 드러나지 않는다.
- 제안: 컨트롤러 클래스 레벨 가드 또는 메서드 레벨 가드가 `getServiceCatalog` 에 실제 적용됨을 테스트(e2e 또는 unit)로 검증하거나, 코드 리뷰 시 컨트롤러 전체 가드 설정을 확인한다. 만약 이 endpoint 가 공개(public) 이고 인증 불필요라면 `@ApiUnauthorizedResponse` 를 제거하고 `@Public()` 데코레이터를 명시한다.

---

### [INFO] `extractApiPath` — query string 제거로 PII 유출 방지 처리 적절

- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` `extractApiPath()`
- 상세: query string 을 의도적으로 제거하고 host+pathname 만 저장한다. API 계약 관점에서 로그에 PII/credential 이 흘러들어 가는 것을 방지하는 올바른 설계다. 함수 주석에 이유가 명시되어 있어 향후 유지보수자도 의도를 인지할 수 있다.
- 제안: 별도 조치 불필요.

---

### [INFO] `clampApiField` 의 `max <= 1` 엣지케이스 처리

- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `clampApiField()`
- 상세: `max <= 1` 일 때 ellipsis 를 붙이지 않고 `raw.slice(0, max)` 만 반환하는 방어 분기가 있다. `api_method` 의 max 가 8 이므로 실용적으로 이 분기에 진입할 일은 없지만, 잘못된 상수값이 전달될 경우를 위한 안전 처리다. API 계약 관점에서 데이터 품질 훼손 없이 저장 제약을 준수한다.
- 제안: 별도 조치 불필요.

---

## 요약

이번 변경은 `integration_usage_log` 에 nullable 컬럼 3개를 추가하고 신규 catalog endpoint 를 도입하는 순수 additive 변경이다. 기존 `ActivityItem` 응답 필드가 optional 로 추가되므로 하위 호환성이 유지되며, 신규 endpoint 는 기존 라우트와 충돌하지 않는다. 에러 응답 형식·HTTP 상태 코드·응답 래퍼 패턴 모두 프로젝트 내 기존 관례를 일관되게 따른다. 주목할 API 계약 관점 이슈는 두 가지다. 첫째, `getServiceCatalog` 의 `serviceType` 파라미터에 Swagger enum 제약이 없어 소비자가 유효 입력을 Swagger 문서만으로 파악할 수 없다. 둘째, 인증 가드(`@UseGuards`)가 해당 메서드에 실제 적용되는지 diff 만으로 확인되지 않아 `@ApiUnauthorizedResponse` 선언과 실제 동작의 정합 여부를 별도 검증해야 한다. 두 이슈 모두 현 기능의 정확성을 즉각 훼손하는 수준은 아니나 API 소비자의 올바른 사용을 보장하기 위해 조치를 권장한다.

---

## 위험도

LOW

---

## 이슈 카운트

| 등급 | 건수 |
|------|------|
| CRITICAL | 0 |
| WARNING | 2 |
| INFO | 7 |
| **합계** | **9** |
