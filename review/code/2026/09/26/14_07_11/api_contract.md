# API 계약(API Contract) 리뷰

## 개요

이 변경은 `success-advert` 작업 — 성공 응답을 하나도 광고하지 않던 라우트 11곳에 응답 DTO·`@ApiOkResponse` 계열 데코레이터를 붙이고, 저장소 가드 `http-status-advertised` 를 «라우트는 성공 응답을 하나 이상 광고한다» 로 조이며, `data` 가 `null` 일 수 있는 응답을 위한 `ApiOkWrappedNullableResponse` 래퍼를 추가한다. **실제 컨트롤러 동작(응답 상태·바디)은 바꾸지 않고, 이미 나가고 있던 응답을 OpenAPI 스키마로 옮겨 적는 것**이 이 PR 의 명시된 범위다 (`plan/in-progress/success-advert.md` "방향" 절, CHANGELOG "응답 자체는 그대로다 — 문서가 실제 응답을 적게 됐다").

주요 대상: `codebase/backend/src/common/swagger/api-wrapped.ts`(신규 래퍼), `webauthn.controller.ts`/`webauthn-response.dto.ts`, `interaction-stream.controller.ts`, `triggers.controller.ts` + 신규 `trigger-secret-issue-response.dto.ts`, `workflow-assistant.controller.ts` + 신규 `assistant-session-response.dto.ts`, 가드 `http-status-advertised-guard.ts` 및 그 테스트, 신규 e2e `advertised-response-contract.e2e-spec.ts`.

## 발견사항

- **[INFO]** `GET /api/workflow-assistant/sessions` 는 페이지네이션 파라미터 없이 "최근 상호작용 순 최대 50건"으로 고정 응답한다.
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` — `list()` 핸들러(`@ApiOkWrappedArrayResponse(AssistantSessionDto, { description: '세션 목록 — 최근 상호작용 순, 최대 50건' })`).
  - 상세: 이 PR 이 이 엔드포인트의 동작을 바꾼 것은 아니다(엔티티를 그대로 반환하던 기존 동작을 그대로 문서화). 다만 이번에 OpenAPI 계약으로 명시적으로 굳어지므로, 워크스페이스당 세션이 50건을 넘는 사용자는 51번째 이후 세션을 조회할 방법이 API 계약상 없다는 점이 이제 클라이언트 생성기에도 드러난다.
  - 제안: 이 PR 의 범위(문서화)에서 조치할 사안은 아니나, 목록이 실제로 50건을 넘어설 가능성이 있다면 후속으로 커서/페이지 파라미터 도입을 검토할 가치가 있다. 차단 사유 아님.

- **[INFO]** `NotificationRotateSecretDto`/`InteractionRevokeTokenDto` 는 평문 secret/token 을 스키마로 광고한다 — 이 자체는 기존 설계(1회성 평문 노출)를 그대로 옮긴 것.
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-secret-issue-response.dto.ts`.
  - 상세: 응답 바디의 실제 동작은 이 PR 이전과 동일하다(서비스 계층 `rotateNotificationSecret`/`revokePerTriggerToken` 은 변경 없음, 컨트롤러 메서드 반환 타입만 인라인 리터럴 → DTO 클래스로 정리). DTO 주석이 "이 응답에서만 보인다"를 명시해 계약 문서상으로도 1회성임이 드러난다. 새로운 노출이 아니라 기존 노출을 정확히 문서화한 것이므로 문제 없음 — 확인 차 기록.

- **[INFO]** `wrapNullableDataSchema`/`ApiOkWrappedNullableResponse` 의 `data` 는 `required: ['data']` + `allOf:[$ref] + nullable:true` 형태로, `data` 키 자체는 항상 존재하고 값만 `null` 일 수 있음을 정확히 표현한다. 실제 컨트롤러(`workflow-assistant.controller.ts` `latest()`)가 `null` 또는 세션 객체를 그대로 리턴하고, 전역 `TransformInterceptor`(`codebase/backend/src/common/interceptors/transform.interceptor.ts`)가 `data` 키가 없는 값만 `{ data }` 로 감싸므로(이미 `data` 키가 있으면 통과) — 광고된 스키마와 실제 wire 응답이 서로 정확히 일치한다. 단위 테스트(`api-wrapped.spec.ts`)가 `toStrictEqual` 로 형제 키 배치까지 못박아 회귀를 잡는다. 문제 없음 — 검증 완료로 기록.

- **[INFO]** 신규 `HttpStatusUnadvertised` 가드(“성공 응답을 하나 이상 광고해야 한다”, 베이스라인 0)는 API 계약 관점에서 바람직한 강화다. 리다이렉트 라우트(`res.redirect`)를 3xx 로 인정하고 2xx 짝 대조에서 제외하는 예외 처리(`isRedirect`, `redirectAdvertised`)도 실제 Nest 런타임 동작(“`res.redirect` 가 Nest 기본 200 을 덮어쓴다”)과 부합하며, 대조군 fixture(`sample.controller.ts` 의 `getRedirect`/`getRedirectViaApiResponse`)와 뮤테이션 테스트(8/8 KILLED, plan 표 기록)로 뒷받침된다.

발견된 항목 중 CRITICAL/WARNING 급 계약 위반은 없다. 검증한 지점:
- **하위 호환성**: 응답 상태·바디 변경 없음(순수 문서화 + 타입 정리). 컨트롤러 반환 타입을 인라인 리터럴에서 DTO 클래스로 바꾼 자리(`triggers.controller.ts` `rotateNotificationSecret`/`revokePerTriggerToken`)도 구조적으로 동일한 shape 이라 breaking 아님.
- **응답 형식 일관성**: `{ data: ... }` 래퍼 규약을 `ApiOkWrapped*` 계열로 일관 적용, 새 `ApiOkWrappedNullableResponse` 도 같은 규약.
- **에러 응답**: 이번 PR 은 에러 응답 형식을 바꾸지 않음(기존 `ApiBadRequestResponse`/`ApiUnauthorizedResponse`/`ApiForbiddenResponse` 그대로).
- **요청 검증**: 변경 없음(`ParseUUIDPipe`, `@ApiQuery({ required: true, format: 'uuid' })` 기존 그대로 문서화만 됨).
- **URL/경로 설계**: 신규 경로 없음, 기존 RESTful 네이밍(`sessions`, `sessions/:id`, `sessions/latest`) 유지.
- **인증/인가**: 문서화된 인증 요구사항이 실제 가드와 일치함을 확인 — `webauthnAvailability()`(`@Public()`, "인증 불요"), `interaction-stream`(`@ApiBearerAuth('interaction-token')` + `InteractionGuard`), workflow-assistant 세션(`FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole('editor')` 를 실제 `@Roles` 데코레이터와 대조 확인). 이 PR 이 가드 로직 자체를 바꾸지 않음.
- **e2e 계약 검증**: `assertMatchesContract` 가 선언되지 않은 키까지 잡는 방식으로 새 DTO 11개 전부(직접 또는 관련 e2e 파일 경유)를 실제 응답과 대조하고 있음을 diff 로 확인(`advertised-response-contract.e2e-spec.ts`, `workflow-assistant.e2e-spec.ts` 케이스 H, `chat-channel-trigger-create.e2e-spec.ts`).

## 요약

이 변경은 신규 엔드포인트나 요청/응답 스키마의 실제 동작 변경 없이, 이미 나가고 있던 11개 라우트의 성공 응답을 OpenAPI 스키마로 문서화하고 이를 강제하는 저장소 가드를 신설한 순수 계약-명세화 작업이다. `data`-nullable 래퍼는 OpenAPI 3.0 의 `$ref` 형제 키 무시 문제를 `allOf` 로 올바르게 우회했고, 리다이렉트 라우트에 대한 3xx 성공 광고 예외도 Nest 런타임 동작과 일치한다. e2e 계약 대조(`assertMatchesContract`)로 신규 DTO 전부가 실제 응답과 일치함을 검증했고, 가드 로직은 뮤테이션 테스트(8/8 KILLED)로 뒷받침된다. 발견한 사항은 모두 INFO 수준(목록 API 의 페이지네이션 부재는 이 PR 이전부터의 기존 설계, 평문 secret 노출도 기존 설계를 옮겨 적은 것)이며 이 PR 의 범위에서 조치가 필요한 CRITICAL/WARNING 은 없다.

## 위험도

LOW
