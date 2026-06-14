# API 계약(API Contract) 리뷰

## 발견사항

### 1. **[WARNING]** `recentCalls[].responseCode` 가 사실상 필수(`@ApiProperty`)이나 서비스 내부 의미가 혼재함

- 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` L485-488, `auth-configs.service.ts` L358
- 상세: `AuthConfigUsageCallDto.responseCode` 는 `@ApiProperty` (non-optional) 로 선언되어 스키마 상 항상 string 이다. 그러나 서비스 코드에서 webhook 은 실제 HTTP 코드(`'202'`)를, 비-HTTP 트리거(schedule 등)는 `e.status` enum 값(`'completed'`, `'failed'` 등)을 폴백으로 반환한다. 즉, 같은 `responseCode` 필드가 두 가지 의미 도메인(HTTP 상태코드 vs 워크플로 상태 enum)의 값을 담는다. API 클라이언트 입장에서 `responseCode`가 `'202'`인지 `'failed'`인지 구별하려면 값 자체를 파싱해야 하며, 이를 타입 시스템이 강제하지 않는다.
- 제안: 두 의미를 하나의 필드에 묶는 대신, (a) `responseCode: string | null` (nullable=true, HTTP 코드 전용) + `status: string` (별도 유지)로 분리하거나, (b) 폴백 동작을 DTO 주석에 명시하고 `@ApiProperty({ description: '...' })` 에 "HTTP triggers: HTTP status code; non-HTTP triggers: workflow status enum fallback" 을 기재해 클라이언트가 의미를 구별할 수 있게 한다. (b) 가 현재 코드베이스 규모에선 최소 변경이나, 장기적으로 (a) 가 계약 명확성에 유리하다.

### 2. **[WARNING]** `sourceIp` 가 DTO 에서 `optional` (`@ApiPropertyOptional`) 이나 서비스 반환 타입에서 항상 `string | null` 을 반환

- 위치: `auth-config-response.dto.ts` L479-481 (`@ApiPropertyOptional`, `sourceIp?: string | null`), `auth-configs.service.ts` L356 (`sourceIp: e.sourceIp ?? null`)
- 상세: 서비스는 `sourceIp` 를 항상 반환(null 포함)하지만, DTO 는 `@ApiPropertyOptional` + `?` 로 선언되어 있어 Swagger 스키마 상 필드 자체가 생략 가능한 것처럼 보인다. 실제 응답에서는 필드가 항상 존재(`null` 또는 IP 문자열)하므로, OpenAPI 스키마가 런타임 동작과 불일치한다.
- 제안: `@ApiProperty({ nullable: true, example: '203.0.113.7' })` + `sourceIp: string | null` (non-optional) 으로 변경하여 "필드는 항상 존재하나 값은 null 가능" 을 명시한다.

### 3. **[INFO]** `GET /api/auth-configs/:id/usage` 응답 shape 의 추가 필드가 기존 클라이언트에 미치는 하위 호환성 평가

- 위치: `auth-config-response.dto.ts` (`AuthConfigUsageDto`), `authentication/page.tsx`
- 상세: 기존 응답에 `periodCounts` (객체) 가 추가된다. REST API 에서 응답 필드 추가는 일반적으로 backward-compatible 이나, 기존 클라이언트가 응답 구조를 strict-schema 파싱하는 경우(예: discriminated union, exhaustive object destructuring) 에는 예외이다. 프론트엔드(`authentication/page.tsx`)는 `AuthConfigUsage` 인터페이스를 자체 선언하여 사용 중이며, 해당 인터페이스가 업데이트되어 `periodCounts` 를 포함하므로 클라이언트 단 위험은 없다. 외부(third-party) 클라이언트가 없는 내부 API 이므로 실질적 위험은 낮다.
- 제안: 현재로선 조치 불필요. 향후 외부 클라이언트에 공개 시 버전 전략(API 버전) 필요.

### 4. **[INFO]** `periodCounts` DTO 에 `@ApiProperty` 데코레이터 미적용 필드(유효성 검증 데코레이터 부재)

- 위치: `auth-config-response.dto.ts` L459-467 (`AuthConfigUsagePeriodCountsDto`)
- 상세: `last24h`, `last7d`, `last30d` 에 `@ApiProperty` 가 각각 선언되어 있고 example 도 있어 Swagger 문서화는 적절하다. 그러나 `@IsNumber()` 등 class-validator 데코레이터가 없다. 응답 DTO 는 보통 직렬화 전용이므로 입력 유효성 검증이 필요 없어 이는 관례상 허용되는 패턴이나, 응답 직렬화 시 `Number()` 변환이 서비스 계층에서 이미 수행되므로 문제없다.
- 제안: 현재 패턴 유지 가능. 응답 DTO 이므로 class-validator 데코레이터 추가는 불필요.

### 5. **[INFO]** `hooks.service.ts` — `handleChatChannelWebhook` 에서 `extractClientIp` 를 중복 호출

- 위치: `hooks.service.ts` L599 (`handleWebhook` 은 공용 `clientIp` 변수 재사용, `handleChatChannelWebhook` 은 L599 에서 `extractClientIp(input.headers) ?? undefined` 를 인라인 재호출)
- 상세: `handleWebhook` 경로는 L133 에서 한 번 추출 후 공유 변수를 재사용하도록 리팩토링되었다. 반면 `handleChatChannelWebhook` 경로는 동일한 인라인 호출을 유지한다. 기능 차이는 없으나 일관성 결여.
- 제안: `handleChatChannelWebhook` 내에서도 명시적 변수로 추출(`const clientIp = extractClientIp(input.headers);`) 후 사용하여 패턴을 통일한다. (API 계약 영향은 없으나 유지보수성 개선)

---

## 요약

이 변경은 `GET /api/auth-configs/:id/usage` 응답에 `periodCounts`(롤링 윈도 호출 수), `recentCalls[].sourceIp`, `recentCalls[].responseCode` 를 추가한다. DB 스키마(V096), 엔티티, 서비스, DTO, 프론트엔드 인터페이스가 일관되게 변경되어 전체적인 구현 완성도는 높다. 주요 API 계약 위험은 `responseCode` 필드가 HTTP 코드와 워크플로 status enum 을 동일 타입(`string`)으로 혼재 반환하여 클라이언트가 값의 의미를 런타임에 파싱해야 한다는 점(W-1)과, `sourceIp` 가 항상 반환되는데도 DTO 상 optional 선언되어 OpenAPI 스키마가 실제 동작과 불일치하는 점(W-2)이다. 하위 호환성 측면에서는 응답 필드 추가이므로 기존 클라이언트에 대한 breaking change 는 없다. 인증/인가, 페이지네이션, URL 설계, 요청 검증 측면에서 기존 엔드포인트 구조를 그대로 유지하므로 별도 이슈 없음.

## 위험도

MEDIUM

---

STATUS=success ISSUES=2 PATH=/Volumes/project/private/clemvion/.claude/worktrees/config-call-history-929994/review/code/2026/06/14/15_02_15/api_contract.md RESET_HINT=
