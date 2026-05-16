# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** 에러 코드 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 가 Public 흐름에도 재사용됨
  - 위치: `integrations.controller.ts` (오류 응답 설명 업데이트), `integration-oauth.service.ts` 라인 384, `integrations.service.ts` 라인 742
  - 상세: 에러 코드 이름 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 는 `private` 이라는 app_type 을 명시적으로 암시하지만, 이제 public 흐름(begin pre-check)과 finalize 단계 race backstop 양쪽에 동일하게 사용된다. API 클라이언트가 이 코드를 파싱해 "private app" 관련 UI 메시지를 표시하는 경우, 실제로는 public-to-public 충돌임에도 잘못된 메시지가 노출될 수 있다. 컨트롤러 Swagger 설명은 `(app_type 무관 — public/private 둘 다)` 로 업데이트되었으나, 클라이언트가 코드 문자열 자체에 의존한다면 breaking change 에 해당한다.
  - 제안: 신규 에러 코드 `CAFE24_MALL_ALREADY_CONNECTED` 를 도입하거나, 기존 코드를 유지할 경우 spec 에 "코드 문자열의 `PRIVATE` 부분은 역사적 이유로 유지되며 app_type 과 무관하게 동일 mall_id 중복을 의미함" 을 명시적으로 문서화해야 한다. 현재 버전에서 변경이 어렵다면 INFO 수준으로 내려도 무방하나, 신규 public 흐름 도입 시점이므로 명확화 기회로 활용을 권장.

- **[WARNING]** `precheckCafe24Mall` 응답에서 `conflict=true` 이지만 `status` 가 열거형 외 값인 경우 타입 강제 캐스팅 사용
  - 위치: `integration-oauth.service.ts` 라인 538~542 (fallback 분기)
  - 상세: fallback 분기에서 `fallback.status as 'connected' | 'pending_install' | 'expired' | 'error'` 로 강제 캐스팅하고 있다. DB 에 열거형 외 상태(예: 마이그레이션 중간 상태, 미래 추가 상태)가 존재할 경우, 응답 DTO (`Cafe24PrecheckResultDto`) 의 `@ApiProperty({ enum: [...] })` 과 실제 반환 값이 불일치하게 된다. Swagger 스키마가 4가지 값만 열거하는데 실제로 다른 값이 반환될 수 있어 API 계약 위반이다.
  - 제안: fallback 분기에서 알 수 없는 상태는 `status` 를 생략하거나 `undefined` 로 두어 클라이언트가 안전하게 처리하도록 한다. 또는 DB 상태를 열거형으로 엄격히 제한하는 타입 가드를 추가한다.

- **[INFO]** `GET /api/integrations/cafe24/precheck` 엔드포인트에 throttle 응답 형식 미정의
  - 위치: `integrations.controller.ts` 라인 599 (`@Throttle`) 및 라인 613 (`@ApiTooManyRequestsResponse`)
  - 상세: `@ApiTooManyRequestsResponse` 로 429 응답이 문서화되어 있으나, 429 응답 바디의 구조(에러 코드, `Retry-After` 헤더 포함 여부 등)가 명시되지 않았다. 다른 throttled 엔드포인트들과 429 응답 형식이 동일한지 일관성 확인이 필요하다.
  - 제안: 프로젝트 공통 에러 응답 DTO 가 있다면 `@ApiTooManyRequestsResponse` 에 동일하게 적용하고, `Retry-After` 헤더 반환 여부를 Swagger 에 명시한다.

- **[INFO]** `Cafe24PrecheckResultDto` 의 `conflict=false` 시 선택적 필드 반환 정책이 Swagger 에 미흡하게 기술됨
  - 위치: `integration-response.dto.ts` 라인 101~117
  - 상세: `existingIntegrationId`, `existingName`, `status` 모두 `@ApiPropertyOptional` 로 표시되어 있으나, "conflict=false 일 때 이 필드들이 반드시 absent 한다" 는 보장이 DTO 레벨에서 표현되지 않는다. Swagger 상 선택적 필드는 "있을 수도 없을 수도 있다" 로 해석되므로, 클라이언트 입장에서는 `conflict=false` 에도 방어 코드가 필요한지 불분명하다.
  - 제안: `@ApiPropertyOptional` 의 `description` 에 "conflict=true 일 때만 채워진다" 는 조건(현재 이미 존재)을 유지하되, 예시 응답 스키마를 Swagger `examples` 로 두 가지(conflict=false, conflict=true) 별도로 정의하면 계약이 더 명확해진다.

- **[INFO]** `ApiOkWrappedResponse` 래퍼 형식과 e2e 테스트의 `res.body.data` 접근
  - 위치: `integrations.controller.ts` 라인 606, `integration-cafe24-precheck.e2e-spec.ts` 라인 852
  - 상세: 컨트롤러에서 `@ApiOkWrappedResponse` 를 사용하므로 실제 응답 바디는 `{ data: Cafe24PrecheckResultDto }` 래핑 구조가 된다. e2e 테스트가 `res.body.data` 로 접근하는 것으로 보아 래핑 구조를 인식하고 있으며 일관성은 유지된다. 단, `Cafe24PrecheckResultDto` 자체가 이미 래핑을 내포하는지 확인 필요(DTO 에 `data` 필드가 없으므로 이중 래핑 문제는 없어 보임).
  - 제안: 확인 완료 수준이나, API 문서(Swagger)에서 래핑 구조가 명확히 보이도록 `ApiOkWrappedResponse` 헬퍼가 Swagger response schema 에 `data` 키를 포함하는지 검토한다.

## 요약

이번 변경은 Cafe24 mall_id 사전 중복 감지 엔드포인트(`GET /api/integrations/cafe24/precheck`)를 신규 추가하고, public 흐름 begin 단계 및 finalize 단계 race condition 에 대한 409 가드를 보강한 것이다. API 계약 관점에서 신규 엔드포인트의 요청 검증(mallId 정규식, 길이), 인증/인가(Bearer + workspace isolation), 라우트 순서(`:id` 보다 앞), throttle(60 req/min) 은 모두 적절히 설계되어 있다. 주목할 점은 에러 코드 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 가 public 흐름에도 재사용되면서 코드 이름과 실제 의미 사이의 불일치가 생겼으며, 이는 클라이언트가 에러 코드를 문자열 기준으로 처리할 경우 혼란을 줄 수 있다. 또한 fallback 분기에서 열거형 외 DB 상태가 반환될 수 있는 타입 안전성 문제가 존재한다. 전반적으로 하위 호환성·RESTful 설계·페이지네이션(해당 없음)·응답 구조 일관성은 양호하나, 에러 코드 명명과 DTO 타입 경계 강화가 권장된다.

## 위험도

LOW
