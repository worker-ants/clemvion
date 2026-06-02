# API 계약(API Contract) 리뷰 결과

## 발견사항

### [WARNING] 공개 Webhook 에러 응답 형식이 NestJS 기본 응답 포맷과 상이
- **위치**: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` — `canActivate()` 내 `HttpException` 및 `PayloadTooLargeException` 투척 로직 (라인 667-693)
- **상세**: Rate-limit(429)·Payload Too Large(413) 에러 응답의 바디 구조가 `{ error: { code, message } }` 형식이다. NestJS 기본 HttpException 응답은 `{ statusCode, message, error }` 를 최상위 키로 사용하는 반면, 이 Guard 는 `error` 를 중첩 객체로 감싸 `{ error: { code: string, message: string } }` 구조를 사용한다. 이 패턴이 `hooks.controller.ts` 의 기존 에러 응답(NestJS 기본 포맷)과 다르면 동일 엔드포인트에서 서로 다른 에러 응답 구조가 혼재한다. 클라이언트가 에러 파싱 로직을 두 가지로 분기해야 한다.
- **제안**: 프로젝트 공통 에러 응답 포맷(예: `ExceptionFilter` 또는 `ApiErrorDto`)이 있다면 그 포맷을 따른다. 없다면 `PayloadTooLargeException` 도 `HttpException` 과 동일한 커스텀 바디 형식(`{ error: { code, message } }`)으로 일관하도록 맞추고, Swagger 데코레이터(`@ApiPayloadTooLargeResponse`, `@ApiTooManyRequestsResponse`)의 `description` 에 응답 스키마를 명시한다.

### [WARNING] 429/413 응답 Swagger 스키마 미등록
- **위치**: `/codebase/backend/src/modules/hooks/hooks.controller.ts` — `@ApiPayloadTooLargeResponse`, `@ApiTooManyRequestsResponse` 데코레이터 (라인 69-74)
- **상세**: 두 응답 데코레이터 모두 `description` 문자열만 제공하고 응답 바디 스키마(`type` 또는 `schema` 옵션)를 지정하지 않는다. Swagger UI 에서 클라이언트가 수신하는 `{ error: { code, message } }` 구조를 알 수 없고, SDK 또는 외부 통합 파트너가 에러를 핸들링하기 위해 소스를 직접 읽어야 한다. API 계약 문서화 측면에서 불완전하다.
- **제안**: `@ApiResponse({ status: 429, schema: { example: { error: { code: 'PUBLIC_WEBHOOK_RATE_LIMIT', message: '...' } } } })` 형태로 응답 바디 스키마를 Swagger 에 명시한다.

### [INFO] IP 식별 불가 시 Rate-limit 미적용(fail-open) — API 명세 미기재
- **위치**: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` — `extractClientIp()` 후 `if (!ip) return true;` (라인 677)
- **상세**: IP 추출에 실패하면 Rate-limit 없이 요청을 통과시킨다. 의도적인 fail-open 정책이나, `@ApiOperation` description 또는 spec 4-security §4 에 "IP 식별 불가 시 throttle 미적용" 동작이 명시되지 않으면 클라이언트·운영팀이 예상 밖의 동작으로 받아들일 수 있다.
- **제안**: `@ApiOperation` description 또는 spec §4 에 "Cloudflare/프록시 IP 헤더 미전달 시 IP 추적 불가 — throttle 미적용(fail-open)" 를 명시한다.

### [INFO] `authConfigId` undefined 경계 처리 불명확
- **위치**: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` — `if (trigger.authConfigId !== null) return true;` (라인 662)
- **상세**: `authConfigId !== null` 조건만으로 인증 webhook 을 분류한다. TypeORM 이 `nullable` 컬럼에 대해 `undefined` 를 반환하는 경우(`undefined !== null` 는 `true`)에 공개 webhook 이 인증 webhook 으로 오분류될 수 있다. 런타임상 TypeORM 은 `null` 을 반환하므로 일반적으로 안전하나, 타입 계약으로 명시되지 않은 가정이다.
- **제안**: `Trigger.authConfigId` 타입을 `string | null` (undefined 없음)으로 명시하거나, 조건을 `if (trigger.authConfigId != null)` 로 변경해 의도를 명확히 한다.

## 요약

이번 변경의 핵심 API 관련 코드는 `POST /api/hooks/:endpointPath` 엔드포인트에 공개 Webhook 남용 방어 Guard(`PublicWebhookThrottleGuard`)와 quota 서비스(`PublicWebhookQuotaService`)를 추가한 것이다. URL 설계·버전 관리·하위 호환성은 양호하며(기존 엔드포인트 동일 경로 유지, 신규 429/413 응답 추가만), 인증/인가 분기(authConfigId 기반 공개 여부 판별)와 Redis fail-open 정책도 명확히 설계되었다. 다만 에러 응답 바디 포맷(`{ error: { code, message } }`)이 NestJS 기본 HttpException 구조와 상이하여 동일 엔드포인트 내 에러 응답 일관성 문제가 있고(WARNING), Swagger 데코레이터에 응답 바디 스키마가 누락되어 API 계약 문서화가 불충분하다(WARNING). IP fail-open 정책 미문서화 및 authConfigId undefined 경계는 경미한 개선 항목이다(INFO 2건). SDK 관련 변경(파일 7-20)은 클라이언트 측 JavaScript API 표면 변경이며 백엔드 HTTP API 계약과 무관하다.

## 위험도

LOW

---

STATUS=success ISSUES=4
