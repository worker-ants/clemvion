# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 새 응답 DTO 를 문서화하면서도 컨트롤러 반환 타입은 여전히 인라인 리터럴 타입이라 `tsc` 가 DTO ↔ 실제 반환값 drift 를 못 잡는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateNotificationSecret()`(게이트 229행), `revokePerTriggerToken()`(게이트 260행)
  - 상세: 두 핸들러는 `@ApiOkWrappedResponse(NotificationRotateSecretDto, …)` / `@ApiOkWrappedResponse(InteractionRevokeTokenDto, …)` 로 새 DTO 를 광고하지만, 메서드 시그니처는 여전히 `Promise<{ secret: string; rotatedAt: string }>` / `Promise<{ token: string }>` 인라인 타입이다. 바로 아래(게이트 315행) `rotateBotToken()` 의 주석이 정확히 이 문제를 지적한다 — "반환 타입을 **DTO 로 선언**한다 — 종전 `Awaited<ReturnType<...>>` 은 서비스가 무엇을 돌려주든 따라가므로 swagger 선언과 실제 응답이 갈려도 조용하다... DTO 로 받으면 서비스 반환 형태가 바뀌는 순간 `tsc` 가 이 자리를 가리킨다." 같은 PR·같은 파일에서 확립한 관례를 이번에 추가한 두 엔드포인트에는 적용하지 않았다. 실제 응답 모양은 e2e(`advertised-response-contract.e2e-spec.ts`, `chat-channel-trigger-create.e2e-spec.ts`)가 `assertMatchesContract` 로 대조하므로 런타임 drift 는 결국 잡히지만, 그 시점은 e2e 실행 시점이지 컴파일 시점이 아니다.
  - 제안: `TriggersService.rotateNotificationSecret`/`revokePerTriggerToken` 의 반환 타입과 컨트롤러 시그니처를 각각 `Promise<NotificationRotateSecretDto>`/`Promise<InteractionRevokeTokenDto>` 로 좁혀 컴파일 시점에 drift 를 잡을 수 있게 한다. 급하지 않다 — e2e 가 이미 안전망이다.

## 점검 관점별 확인 내용

1. **하위 호환성** — 이번 변경은 `@nestjs/swagger` 데코레이터·신규 응답 DTO·repo-guard(`http-status-advertised-guard.ts`) 확장이 전부이고, 컨트롤러의 실제 런타임 동작(상태 코드·응답 바디)은 바꾸지 않는다. 순수 문서화 추가라 기존 클라이언트에 영향 없음. 유일한 변경은 이전에 성공 응답을 전혀 광고하지 않던 11개 라우트가 이제 스키마를 갖는다는 점인데, 이는 생성된 OpenAPI 문서의 **정확도 향상**이지 wire 변경이 아니다.

2. **버전 관리** — API 버전 프리픽스가 없는 기존 체계를 그대로 유지. 버전 관련 이슈 없음.

3. **응답 형식** — `wrapNullableDataSchema`(`common/swagger/api-wrapped.ts`)가 `{ data: <ref> | null }` 을 `allOf`+`nullable` 로 감싸는 것은 OpenAPI 3.0 이 `$ref` 형제 키(`nullable`)를 무시하는 사양의 정확한 우회이며, `@nestjs/swagger` 11.4.5 의 `SchemaObjectFactory.createNotBuiltInTypeReference`(설치된 `node_modules/@nestjs/swagger/dist/services/schema-object-factory.js`)가 클래스 프로퍼티 레벨의 `@ApiProperty({ type: () => Dto, nullable: true })`(예: `AssistantMessageDto.plan`/`.usage`)에 대해 이미 같은 `allOf`+`nullable` 우회를 자동 적용함을 직접 확인했다 — 두 경로(수동 wrapper vs 라이브러리 자동 처리)가 서로 다른 메커니즘이지만 결과적으로 일관된 스키마 형태를 낸다. `TransformInterceptor`(`common/interceptors/transform.interceptor.ts`)의 `'data' in data` 검사는 `data` 가 `null`이어도 단락 평가로 안전하게 `{ data: null }` 을 만들어 `wrapNullableDataSchema` 계약과 wire 가 정확히 맞는다. 신규 `AssistantSessionDto`/`AssistantSessionDetailDto`/`WebAuthnAvailabilityDto`/`NotificationRotateSecretDto`/`InteractionRevokeTokenDto` 는 모두 실제 컨트롤러·서비스 반환값과 대조해 확인했고, 신설 e2e(`advertised-response-contract.e2e-spec.ts`, `workflow-assistant.e2e-spec.ts` 확장, `chat-channel-trigger-create.e2e-spec.ts` 확장)가 `assertMatchesContract`(선언되지 않은 키·누락된 required 키까지 검증)로 각 라우트를 실측한다 — 문서와 실제 응답의 정합성을 컴파일이 아닌 런타임에서 강하게 보증하는 좋은 패턴이다.

4. **에러 응답** — 이번 diff 는 에러 응답 형식을 바꾸지 않는다. `triggers.controller.ts` 의 두 신규 성공 응답 광고 옆에 이미 있던 `@ApiBadRequestResponse`/`@ApiUnauthorizedResponse`/`@ApiForbiddenResponse`/`@ApiNotFoundResponse` 는 그대로 유지된다.

5. **요청 검증** — 이번 diff 는 요청 검증 로직을 바꾸지 않는다(전부 응답 광고·가드·테스트).

6. **URL/경로 설계** — 신규 라우트 없음(모두 기존 라우트에 응답 스키마만 추가). 가드 fixture(`sample.controller.ts`)에 추가된 `redirect`/`redirect-via-api-response` 경로는 프로덕션 스캔 루트(`src/modules`) 밖의 대조군이라 실제 API 표면에 영향 없음.

7. **페이지네이션** — 이번 diff 가 건드린 라우트 중 페이지네이션 대상 없음(`wrapPaginatedSchema` 자체는 미변경).

8. **인증/인가** — `webauthnAvailability()` 는 `@Public()` 유지 + "인증 불요" 설명과 일치. 나머지 신규 광고 대상 엔드포인트(`webauthnDelete`, workflow-assistant 세션 CRUD, triggers secret 회전 2건)의 `@UseGuards`/`@Roles`/`@ApiBearerAuth` 는 모두 diff 이전과 동일하게 유지되며 이번 변경은 응답 스키마만 추가했다. 인가 로직 변경 없음.

## 부가: repo-guard 확장(`http-status-advertised-guard.ts`)

`unadvertised`(성공 응답을 하나도 광고하지 않는 라우트) 판정과 `isRedirect`(3xx) 분기를 추가해, 기존 "광고 vs 실제 코드 일치" 판정에 "광고가 아예 없다"는 별도 위반 축을 더했다. 리다이렉트로 끝나는 라우트(`getRedirect`/`getRedirectViaApiResponse` fixture)는 2xx 짝 대조에서 올바르게 제외되며, 대조군 fixture·근거 캐너리(`@Res()` 핸들러의 실제 기본 상태를 supertest 로 검증)까지 갖춰 판정 로직의 타당성을 실증한다. 이 가드 자체는 API 엔드포인트가 아니라 CI 시점에 API 계약 누락을 잡는 도구이므로, 장기적으로 "성공 응답 미광고" 회귀를 원천 차단하는 긍정적 변경이다.

## 요약

이번 변경은 이전까지 OpenAPI 성공 응답 스키마를 전혀 광고하지 않던 11개 엔드포인트(WebAuthn 가용성 조회, WebAuthn credential 삭제, triggers notification secret 회전·interaction token 재발급, workflow-assistant 세션 목록/최근/상세/생성/수정/삭제, 두 SSE 스트림)에 응답 DTO·`@ApiOkWrappedResponse` 계열 데코레이터를 부여하고, 이를 강제하는 repo-guard(`http-status-advertised-guard.ts`)와 실제 wire shape 을 검증하는 e2e(`assertMatchesContract`)를 함께 추가한 순수 문서화·가드 강화 PR이다. 런타임 동작·상태 코드·요청 검증·인증 흐름·URL 설계·페이지네이션 등은 전혀 바뀌지 않아 하위 호환성 파괴 위험이 없고, 신규 nullable-wrapper 헬퍼는 `@nestjs/swagger` 의 자체 sibling-$ref 우회 로직과 결과적으로 일관되며, 새 DTO 들은 e2e 계약 검증으로 실측 뒷받침된다. 유일한 지적은 `triggers.controller.ts` 의 두 신규 핸들러가 같은 파일의 확립된 관례(반환 타입을 DTO 로 선언해 `tsc` 가 drift 를 잡게 하는 패턴)를 따르지 않은 INFO 수준의 사소한 일관성 갭뿐이다.

## 위험도

LOW
