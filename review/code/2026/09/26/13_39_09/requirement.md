# 요구사항(Requirement) 충족 리뷰 — success-advert (11개 라우트 성공 응답 스키마 광고)

## 발견사항

- **[INFO]** `AssistantToolCallDto.result?: unknown` 를 `@ApiPropertyOptional({ type: 'object', additionalProperties: true })` 로 문서화 — 실제 필드 타입은 `unknown` 이라 원리적으로 object 가 아닌 값(문자열·배열 등)도 대입 가능하다.
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/responses/assistant-session-response.dto.ts:112` (전체 파일 컨텍스트 게이트 기준, `/** 도구 실행 결과 ... */` 주석 바로 아래 `result?: unknown;` 필드)
  - 상세: `workflow-assistant-stream.service.ts` · `assistant-tool-router.service.ts` · `shadow-workflow.ts` 등 실제 대입 지점을 확인한 결과 지금까지의 모든 `result` 값은 `{ ok: ... }` 형태의 object 였다. 다만 타입 자체가 `unknown` 이라 향후 도구가 스칼라/배열 결과를 반환해도 타입 시스템이 막지 못하며, 이 경우 문서(`type: 'object'`)와 실제 응답이 어긋난다.
  - 제안: 코드 버그는 아니며 현재는 실측과 일치한다. 향후 도구 결과가 object 가 아닌 경우가 생기면 스키마를 갱신할 필요가 있다는 점만 인지하면 됨 — 즉시 수정 불요.

## 점검 결과 요약 (근거)

- **`ApiOkWrappedNullableResponse` 신설**(`common/swagger/api-wrapped.ts`): `{ data: <ref> | null }` 를 `allOf` 로 감싸 `nullable` 을 붙이는 구현이 spec `spec/conventions/swagger.md` §5-2 표(`ApiOkWrappedNullableResponse(Dto)` → `{ data: <Dto> | null }`)와 line-level 로 일치. 단위 테스트(`api-wrapped.spec.ts`)가 `toStrictEqual` 로 `allOf`+`nullable` 모양을 고정.
- **`GET sessions/latest`**: 핸들러가 `session`(존재하면 객체, 없으면 `null`)을 직접 반환 → `TransformInterceptor`(`common/interceptors/transform.interceptor.ts`)가 `data && typeof data === 'object' && 'data' in data` 를 truthy-guard 로 검사하므로 `null` 은 안전하게 `{ data: null }` 로 래핑된다. `wrapNullableDataSchema` 광고와 실제 wire shape 이 정확히 일치함을 확인.
- **WebAuthn `availability`/`DELETE credentials/:id`**: `WebAuthnAvailabilityDto{ enabled: boolean }` 이 실제 반환값(`{ data: { enabled: this.webauthnService.isEnabled() } }`)과 정확히 일치. `DELETE` 는 `@HttpCode(HttpStatus.NO_CONTENT)` + `@ApiNoContentResponse` 조합이 이미 있어 §2-4 "광고한 성공 코드는 실제 성공 코드를 담는다" 규칙 충족.
- **triggers `rotate-secret`/`revoke-token`**: 신설 DTO(`NotificationRotateSecretDto{ secret, rotatedAt }`, `InteractionRevokeTokenDto{ token }`)가 `triggers.service.ts` 의 `rotateNotificationSecret`/`revokePerTriggerToken` 반환 타입(`Promise<{ secret: string; rotatedAt: string }>` / `Promise<{ token: string }>`)과 필드명·개수가 정확히 일치.
- **interaction-stream SSE**: `@ApiOkResponse` 추가는 spec `swagger.md` §2-4 Rationale("`@Res()` 를 면제하지 않는다")과 정합 — 핸들러가 `res.status()` 를 직접 호출하지 않아 Nest 기본 200 이 나가는 것을 그대로 광고.
- **workflow-assistant 세션 DTO 6종**: `AssistantSessionDto`/`AssistantMessageDto`/`AssistantToolCallDto`/`AssistantPlanDto`/`AssistantPlanStepDto`/`AssistantUsageDto`/`AssistantSessionDetailDto` 필드를 대응 엔티티(`workflow-assistant-session.entity.ts`, `workflow-assistant-message.entity.ts`)와 1:1 대조 — 필드명·nullable 여부·enum 값(`SESSION_STATUSES`, `MESSAGE_ROLES`, `TOOL_CALL_KINDS`, `PLAN_STEP_ACTIONS`, `AUTO_RESUME_REASONS`)이 `as const satisfies readonly X[]` 로 엔티티의 유니온 타입과 컴파일 타임에 묶여 drift 를 차단. 관계 필드(workspace/workflow/user/llmConfig)는 DTO 에서 의도적으로 배제되고 실제로 `find` 경로가 relations 를 로드하지 않음을 확인.
- **가드 강화(`http-status-advertised-guard.ts`)**: "라우트는 성공 응답을 하나 이상 광고한다" 규칙이 `@ApiExcludeEndpoint()` 제외, 리다이렉트(3xx)를 성공 광고로 인정하는 예외까지 spec §2-4 본문과 정확히 일치하게 구현됨. 대조군 fixture(`sample.controller.ts`)가 15개 이상의 분기(기본값 위반·204 광고·`@ApiResponse`·래퍼·206·`@Res()`·리다이렉트 2종·제외·미광고·unresolved 3종·주석/문자열 디코이)를 모두 커버하고 plan 의 6개 뮤턴트 표(S1~S6, 전부 KILLED)와 부합. `_test/*` 훅 2곳이 `@ApiExcludeEndpoint()` 로 실제로 제외됨을 직접 확인.
- **e2e 계약 대조**: `advertised-response-contract.e2e-spec.ts`(WebAuthn availability · notification rotate-secret), `workflow-assistant.e2e-spec.ts`(세션 CRUD 전체 + SSE 상태줄), `chat-channel-trigger-create.e2e-spec.ts`(revoke-token)가 `assertMatchesContract`/`contractForDto` 로 "선언되지 않은 키" 축까지 실측 대조 — 응답 DTO 가 실제 wire 와 다르면 e2e 가 즉시 실패하는 구조.
- **CHANGELOG**: 두 항목(스키마 광고 11곳, 가드 강화)의 서술이 실제 diff 범위·behavior 와 정확히 일치.
- **TODO/FIXME/HACK/XXX**: 대상 파일 전체에서 미완성을 시사하는 주석 없음.
- **엣지 케이스**: `null` 최근 세션(`sessions/latest`), 빈 `oneOf`(변경 없음, 기존 로직), `wrapOneOfDataSchema` 단일/빈 배열 케이스(기존 테스트 유지) 모두 커버.

## 요약

11개 라우트에 대한 성공 응답 스키마 광고 + `http-status-advertised` 가드 강화 변경은 spec(`spec/conventions/swagger.md` §2-4, §5-2)과 line-level 로 완전히 일치하며, 신설 DTO 필드는 실제 엔티티/서비스 반환 타입과 1:1 대조해 불일치가 없다. `TransformInterceptor` 의 null 처리, SSE `@Res()` 비면제, 리다이렉트 3xx 예외 등 까다로운 엣지 케이스가 스펙 본문·가드 구현·대조군 fixture·e2e 계약 검증 네 층에서 서로 정합적으로 처리된다. 유일하게 짚을 점은 `AssistantToolCallDto.result` 가 `unknown` 타입을 `type: 'object'` 로 문서화하는 것인데, 현재 실제 대입값은 모두 object 라 지금은 실측과 부합하며 코드 결함으로 볼 수 없다(INFO 수준, 즉시 수정 불요). CRITICAL/WARNING 급 발견사항 없음.

## 위험도

NONE
