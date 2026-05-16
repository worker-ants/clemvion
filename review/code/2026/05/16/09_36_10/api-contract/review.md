# Cafe24 API Contract Review (2026-05-16)

---

## Critical (외부 계약 위반 / breaking change)

없음 — 외부 API 계약을 직접 깨는 패턴은 발견되지 않았다.

---

## High (일관성 결손)

### [HIGH-1] 에러 응답 형식: install endpoint 가 `{ code, message }` 를 직접 반환하지만, 자체 API 규약 §5.3 의 표준 envelope 은 `{ error: { code, message, details? } }`

- **위치**: `third-party-oauth.controller.ts:94-106`, `128-153`
- **상세**: spec/5-system/2-api-convention.md §5.3 에 따르면 에러 응답은 반드시 `{ "error": { "code": "...", "message": "..." } }` 형태이어야 한다. 그러나 `cafe24Install()` 핸들러는 INSTALL_TOKEN_PATTERN 불일치 및 파라미터 누락 오류를 `res.status(404).json({ code, message })` — 바깥 `error` 래퍼 없이 — 직접 반환한다. `oauthCallback()` 핸들러도 동일한 패턴이나, 해당 엔드포인트는 HTML 응답을 주 목적으로 하는 `@Public` 3rd-party 경로이므로 규약 적용 우선순위가 다소 낮다.
- **제안**: JSON fallback 분기 (비 `text/html` accept) 도 `{ error: { code, message } }` 로 통일하거나, 해당 엔드포인트가 "API 규약 적용 제외 경로"임을 spec §9.2 에 명시적으로 선언한다.

### [HIGH-2] `POST /api/integrations/oauth/begin` 의 응답 DTO(OAuthBeginResultDto) 가 Cafe24 Private 분기(`cafe24_private_pending`) 응답 필드를 포함하지 않음

- **위치**: `integration-response.dto.ts:175-183`, spec §9.2
- **상세**: spec §9.2 는 Cafe24 Private 성공 시 `{ mode, integrationId, appUrl, callbackUrl }` 를 반환하고, `request-scopes` 분기에서는 `scopesAdded` 까지 추가한다고 정의한다. 그러나 `OAuthBeginResultDto` 는 `authorizeUrl` 과 `state` 만 선언한다. Swagger 문서에 Cafe24 Private 경로의 응답 필드(`mode`, `integrationId`, `appUrl`, `callbackUrl`, `scopesAdded`)가 전혀 표현되지 않아, API 계약 소비자(frontend, 외부 통합 개발자)가 응답 shape 를 파악할 수 없다.
- **제안**: `OAuthBeginResultDto` 를 discriminated union 으로 분리하거나, optional 필드(`mode?`, `integrationId?`, `appUrl?`, `callbackUrl?`, `scopesAdded?`)를 추가하고 Swagger `@ApiProperty` 로 문서화한다.

### [HIGH-3] callback 에러 분기 — Swagger `@ApiBadRequestResponse` 만 있고 OAuth-specific 에러 코드(`OAUTH_STATE_MISMATCH`, `OAUTH_STATE_EXPIRED`, `OAUTH_TOKEN_EXCHANGE_FAILED`)가 Swagger에 누락

- **위치**: `third-party-oauth.controller.ts:167-237`, `integrations.controller.ts:135-180`
- **상세**: spec §10.4, §9.4 에 `OAUTH_STATE_MISMATCH`, `OAUTH_STATE_EXPIRED`, `OAUTH_TOKEN_EXCHANGE_FAILED` 가 별개 에러 코드로 정의되어 있다. `oauthCallback` 핸들러는 이를 postMessage 로 전달하나 HTTP JSON API 계약 관점에서 해당 에러들이 Swagger 에 전혀 문서화되어 있지 않다. frontend 가 `postMessage` payload 의 `error` 문자열만으로 분기해야 하는 상황이다.
- **제안**: postMessage 페이로드의 에러 코드 vocabulary 를 `renderCallbackHtml` 레이어의 계약으로 명시적으로 선언하거나, 위 에러 코드를 Swagger `@ApiResponse` 에 예시로 포함한다.

---

## Medium (개선 권고)

### [MEDIUM-1] `OAuthBeginDto.integrationId` 에 `IsUUID()` 검증 미적용

- **위치**: `integration.dto.ts:218`
- **상세**: `integrationId` 필드에 `@IsOptional() @IsString()` 만 선언돼 있고 UUID 형식 검증(`@IsUUID()`)이 없다. spec §9.2 는 이 필드를 UUID 라고 명시한다. 잘못된 형식의 값이 서비스 계층까지 전달될 수 있다.
- **제안**: `@IsOptional() @IsUUID() integrationId?: string;` 으로 변경.

### [MEDIUM-2] `RequestScopesDto.scopes` 에 개별 요소 길이 제한 없음

- **위치**: `integration.dto.ts:331-342`
- **상세**: `OAuthBeginDto.scopes` 는 `@MaxLength(128, { each: true })` 를 적용하지만, `RequestScopesDto.scopes` 는 `@IsArray() @ArrayUnique() @IsString({ each: true })` 만 선언하고 개별 요소 길이 제한이 없다. Cafe24 scope 문자열(`mall.read_<category>`) 은 짧지만, API 계약 관점에서 동일한 검증 수준이 필요하다.
- **제안**: `@MaxLength(128, { each: true })` 추가.

### [MEDIUM-3] 메타데이터 `paginated: true` 와 `cursor` 파라미터 — Cafe24 Admin API 는 `limit`/`offset` 기반이고 cursor 를 공식 지원하지 않음

- **위치**: `cafe24.handler.ts:307`, `types.ts:45`, spec/4-cafe24.md §1
- **상세**: `Cafe24CallOptions.pagination` 에는 `cursor?: string` 필드가 있고 핸들러도 `query.cursor = pagination.cursor` 로 전달한다. 그러나 Cafe24 Admin API v2 는 cursor 기반 페이지네이션을 지원하지 않는다(링크 헤더(`links`) 포함 `offset`/`limit` 만 지원). 지원하지 않는 파라미터를 그대로 전달하면 Cafe24 측에서 무시되거나 400 이 발생할 수 있다. spec §1 의 `pagination` 정의에도 `cursor?` 가 포함돼 있어 UI 가 이를 노출할 경우 혼란이 생긴다.
- **제안**: Cafe24 메타데이터 계층에서 `cursor` 를 제거하거나, `paginated: true` 인 operation 은 `limit`/`offset` 만 허용한다고 spec 및 `Cafe24CallOptions` 에 명시한다.

### [MEDIUM-4] rate-limit 헤더 이름 불일치 — `X-Api-Call-Limit` vs `X-Cafe24-Call-*`

- **위치**: `cafe24-api.client.ts:718`, spec/4-cafe24.md §4.1
- **상세**: Cafe24 공식 문서의 rate-limit 관련 헤더 이름은 `X-Cafe24-Call-Usage`, `X-Cafe24-Call-Remain`, `X-Cafe24-Time-Usage`, `X-Cafe24-Time-Remain` 이다. `X-Api-Call-Limit` 는 `X-Cafe24-*` 네임스페이스와 일관성이 없으며, Cafe24 공식 문서에서 해당 헤더를 `X-Api-Call-Limit` 로 명시하는지 확인 필요. spec §4.1 표에서는 `X-Api-Call-Limit` 로 적시하고 있으나, `X-Cafe24-Call-Limit` 일 가능성을 배제할 수 없다.
- **제안**: Cafe24 공식 sandbox 환경에서 실제 헤더 이름을 확인하고, 불일치 시 `cafe24-api.client.ts:718` 의 `h['x-api-call-limit']` 를 수정한다.

### [MEDIUM-5] `buildUrl` 내 path 더블 슬래시 제거 방식이 단일 선행 슬래시만 처리

- **위치**: `cafe24-api.client.ts:650`
- **상세**: `cleanPath = path.replace(/^\//, '')` 는 `/{product_no}` 처럼 선행 슬래시 1개만 제거한다. path template 에 `//` 가 있거나 metadata 작성 실수가 있을 경우 Cafe24 API URL 이 `api/v2/admin//products` 형태가 될 수 있다. 현재 메타데이터에는 이 문제가 없으나, 향후 기여자 실수에 취약하다.
- **제안**: `path.replace(/^\/+/, '')` 로 교체하거나, metadata 유닛 테스트(`metadata.spec.ts`)에서 선행 슬래시 검사를 추가한다.

### [MEDIUM-6] `cafe24Install` 에서 rawQuery 추출 시 `req.url` 기반 파싱 — proxy 환경에서 X-Forwarded-Prefix 미처리

- **위치**: `third-party-oauth.controller.ts:107`
- **상세**: HMAC 검증에 사용할 rawQuery 를 `req.url.split('?', 2)[1]` 로 추출한다. NestJS 가 리버스 프록시 뒤에 배포될 경우 `req.url` 에 proxy rewrite 된 경로가 포함되어 rawQuery 는 정상이지만, Cafe24 가 서명한 원본 query string 과 비교할 때 불일치가 생길 수 있다. 현재 구현에서 쿼리 스트링 부분만 슬라이스하므로 대부분의 경우 무해하나, `X-Forwarded-Prefix` 등으로 URL 이 변형되는 환경을 명시적으로 테스트해야 한다.
- **제안**: `req.query` 를 `URLSearchParams` 로 직렬화하거나, HMAC 검증을 담당하는 서비스에서 이 edge case 를 명시적으로 다룬다.

### [MEDIUM-7] `Cafe24OperationMetadata.method` 에 `PUT` 포함 — 자체 API 규약 §3 에서 PUT 사용 금지

- **위치**: `types.ts:40`, `product.ts:112`, spec/5-system/2-api-convention.md §3
- **상세**: spec/5-system/2-api-convention.md §3 의 HTTP 메서드 표는 `PUT - 사용하지 않음 (PATCH 선호)` 로 명시한다. 그러나 Cafe24 Admin API 자체가 상품 수정(`PUT /products/{product_no}`) 등에 PUT 을 사용하므로 Cafe24 를 향한 외부 클라이언트 계약에서는 PUT 사용이 불가피하다. 이 충돌이 규약 문서에 명시적으로 예외 처리되지 않았다.
- **제안**: `spec/conventions/cafe24-api-metadata.md §2` 에 "Cafe24 Admin API 는 PUT 을 사용하므로 본 메타데이터에서만 `PUT` 허용 — 자체 API 설계 규칙 §3 의 'PUT 미사용' 원칙과 충돌하지 않음(외부 API 호출 클라이언트이므로 외부 계약 준수 우선)" 과 같은 설명을 추가한다.

---

## Info (관찰 / 좋은 사례 확인)

### [INFO-1] install_token 단일 진실 지점 — 컴파일 타임 불일치 차단

`INSTALL_TOKEN_PATTERN`, `buildCafe24InstallUrl`, `buildOauthCallbackUrl` 를 `third-party-oauth.constants.ts` 에 모아 controller·service 양쪽이 동일 상수를 참조한다. 토큰 형식 변경 시 불일치 가능성이 컴파일 타임에 차단된다. 좋은 사례.

### [INFO-2] SSRF 방어 — mallId 검증이 DTO 와 핸들러 양쪽에 적용됨

`OAuthBeginDto.mallId` 의 `@Matches(/^[a-z0-9-]{3,50}$/)` 와 `Cafe24Handler` 의 `MALL_ID_PATTERN.test(creds.mall_id)` 가 독립적으로 동작한다. URL 삽입 공격 경로가 이중으로 차단되어 있다.

### [INFO-3] Basic auth — token 교환·refresh 경로 모두 `Authorization: Basic` 사용

`refreshAccessToken` (line 428) 이 `Authorization: Basic base64(client_id:client_secret)` 를 정확히 구성한다. spec §10.3 의 "Basic auth 만 사용" 결정이 실제 코드에 준수된다.

### [INFO-4] scope 구분자 — Cafe24 는 콤마 구분 규약이 코드에 반영돼 있는지 확인 필요

spec §3.2 에 "Cafe24 는 scope 를 콤마 구분" 이라고 명시돼 있다. `oauth/begin` 서비스 계층에서 authorize URL 을 조립할 때 `scopes.join(',')` 를 사용하는지 확인을 권고한다. 본 리뷰 범위의 파일들에서는 scope 문자열 join 로직이 직접 노출되지 않으므로 `integration-oauth.service.ts` 의 authorize URL 조립 부분을 별도 확인해야 한다.

### [INFO-5] `@Post(':id/test')` — `@Roles('editor')` 누락

- **위치**: `integrations.controller.ts:300`
- **상세**: 연결 테스트(`POST /:id/test`)에는 `@Roles('editor')` 가 없다. spec §8 의 권한 테이블에 "Test connection" 의 최소 역할이 명시돼 있지 않아 현재 상태가 의도적인지 불분명하다. viewer 권한의 사용자도 테스트를 트리거할 수 있는 상태이다.
- **제안**: spec §8 에 Test connection 의 최소 역할을 명시하고, 코드에 맞게 `@Roles('viewer')` 또는 `@Roles('editor')` 를 추가한다.

---

## 종합 의견

Cafe24 통합의 API 계약은 전반적으로 spec 에 잘 부합한다. SSRF 방어(`mall_id` 패턴 이중 검증), HMAC 검증을 통한 Cafe24 설치 흐름 보호, Basic auth 토큰 교환 정책 준수, install_token 단일 진실 지점 설계 등은 견고하게 구현되어 있다. 단, 외부로 노출되는 API 계약 관점에서 두 가지 개선이 필요하다: (1) `cafe24Install` 의 JSON fallback 에러 응답이 자체 API 규약의 `{ error: { code, message } }` envelope 을 따르지 않는 것과 (2) `OAuthBeginResultDto` 가 Cafe24 Private 분기의 응답 필드를 전혀 문서화하지 않는 것이다. 이 두 문제는 frontend 클라이언트가 응답 shape 를 Swagger 로 추론할 때 직접 영향을 미친다. 메타데이터 계층에서의 `cursor` 페이지네이션 지원 혼란과 PUT 메서드 규약 예외 미명시는 중간 수준의 개선 사항이다.
