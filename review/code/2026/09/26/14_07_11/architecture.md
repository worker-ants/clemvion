# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** `workflow-assistant.controller.ts` 의 새로 광고된 5개 엔드포인트는 컨트롤러 반환 타입이 여전히 서비스 반환값에서 추론된
  엔티티 타입이며, 광고한 DTO(`AssistantSessionDto`/`AssistantSessionDetailDto`)를 명시적 반환 타입으로 선언하지 않는다.
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:77`(`list`),
    `:100`(`latest`), `:121`(`findOne`), `:138`(`create`), `:153`(`update`)
  - 상세: 같은 PR 이 `triggers.controller.ts` 의 `rotateNotificationSecret`/`revokePerTriggerToken` 반환 타입을
    인라인 리터럴에서 `Promise<NotificationRotateSecretDto>`/`Promise<InteractionRevokeTokenDto>` 로 좁혀 "서비스 반환 형태가
    바뀌는 순간 `tsc` 가 이 자리를 가리킨다" 는 컴파일 타임 drift 방지 관례를 스스로 적용했다(직전 리뷰 라운드 INFO14, 커밋
    `bf1fa96fc`). 그런데 이번에 새로 `@ApiOkWrappedResponse` 계열을 붙인 workflow-assistant 세션 5개 핸들러에는 같은 처리를 하지
    않았다 — 메서드 시그니처(`list`~`update`)는 이 PR 이 건드리지 않은 기존 코드라 회귀는 아니지만, 광고 데코레이터를 새로 얹은
    자리이므로 같은 PR 안에서 "DTO 반환 타입 명시" 관례가 비대칭적으로만 적용된다. 서비스(`WorkflowAssistantSessionService`)는
    엔티티 타입(`WorkflowAssistantSession[]` 등)을 반환하므로, DTO 필드가 엔티티와 갈리는 방향의 drift(예: DTO 에서 필드를
    빼거나 이름을 바꿨는데 엔티티는 그대로인 경우)는 `tsc` 가 못 잡고 e2e 시점에야 드러난다.
  - 제안: 급하지 않음(직전 라운드가 같은 클래스의 이슈를 INFO 로 유예한 전례와 동일선상). 여유가 있을 때 다섯 메서드에도
    `Promise<AssistantSessionDto>`/`Promise<AssistantSessionDto[]>`/`Promise<AssistantSessionDto | null>`/
    `Promise<AssistantSessionDetailDto>` 를 명시해 같은 파일 내에서도 관례를 통일한다.

## 점검 관점별 확인 내용

1. **SOLID** — `http-status-advertised-guard.ts` 는 직전 리뷰 라운드에서 지적된 SRP 문제(`judgeHandler` 가 데코레이터 분류와
   위반 판정을 함께 함)를 `classifyDecorators`(순수 분류 함수) / `judgeHandler`(그 결과로 판정만 조립) 로 분리해 이미 해결한
   상태로 들어와 있다. `common/swagger/api-wrapped.ts` 의 래퍼 함수군(`ApiOkWrappedResponse`, `ApiOkWrappedNullableResponse`,
   `ApiOkWrappedArrayResponse`, `ApiCreatedWrappedResponse` 등)은 각각 "스키마 shape 하나 + 그 shape 을 미는 데코레이터
   조합" 이라는 동일 책임을 좁게 반복하는 형태로, OCP 관점에서 새 shape 추가가 기존 함수를 건드리지 않는 구조다. 신설
   `wrapNullableDataSchema`/`ApiOkWrappedNullableResponse` 도 이 패턴을 그대로 따른다.
2. **결합도/응집도** — 신규 DTO 파일들(`webauthn-response.dto.ts` 의 `WebAuthnAvailabilityDto`,
   `trigger-secret-issue-response.dto.ts` 의 `NotificationRotateSecretDto`/`InteractionRevokeTokenDto`,
   신규 `assistant-session-response.dto.ts`)은 각 도메인 모듈의 `dto/responses/` 아래에 배치되어 기존 응집 단위
   (`trigger-response.dto.ts` 가 `TriggerDto`+`TriggerHistoryItemDto` 를 묶는 것과 동일한 결)를 그대로 따른다.
   `assistant-session-response.dto.ts` 는 엔티티의 enum 상수(`AUTO_RESUME_REASONS`, `PLAN_STEP_ACTIONS`)를 재정의하지 않고
   import 해 SoT 중복을 피했다.
3. **레이어 책임** — 이번 변경은 컨트롤러 메서드 위에 Swagger 데코레이터만 추가하거나(`webauthn.controller.ts`,
   `interaction-stream.controller.ts`, `workflow-assistant.controller.ts`), 반환 타입을 DTO 로 좁히는 것(`triggers.controller.ts`)
   뿐이며, 서비스 계층 로직·컨트롤러의 실제 제어 흐름은 건드리지 않는다. 프레젠테이션(문서화) 레이어와 비즈니스 로직 레이어의
   경계가 유지된다.
4. **디자인 패턴** — Decorator + Factory 조합(`applyDecorators` 로 여러 NestJS/Swagger 데코레이터를 하나의 이름 있는
   데코레이터로 합성)을 기존 패턴 그대로 확장한 것으로, 새 안티패턴은 보이지 않는다. `http-status-advertised-guard.ts` 의
   `swaggerResponseStatuses()` 가 이름→코드 표를 손으로 유지하지 않고 실제 데코레이터를 프로브에 적용해 메타데이터로 읽는
   방식은 반사(reflection) 기반 자기서술(self-describing) 접근으로, 새 `Api*Response` 이름이 추가돼도 가드가 자동으로
   커버한다(OCP 를 가드 설계 자체에도 적용).
5. **순환 의존성** — 신규/변경 파일들의 import 그래프를 확인했다: DTO 파일은 `@nestjs/swagger` 와 자기 모듈의 엔티티/타입만
   가져오고, 컨트롤러는 `common/swagger`(배럴 `index.ts` 의 `export * from './api-wrapped'`)와 자기 모듈 DTO 만 가져온다.
   `common/swagger` → 도메인 모듈 방향의 역참조는 없다. 순환 의존 징후 없음.
6. **추상화 수준** — `wrapNullableDataSchema` 는 "OpenAPI 3.0 이 `$ref` 형제 키를 무시한다" 는 낮은 수준의 스펙 세부사항을
   함수 안에 캡슐화해 호출부(`ApiOkWrappedNullableResponse`)와 사용처(컨트롤러)는 이를 몰라도 되게 한다 — 적절한 추상화
   경계.
7. **모듈 경계** — `trigger-secret-issue-response.dto.ts` 는 트리거 도메인 안에 두 개의 밀접한 "1회성 평문 비밀 발급" 응답을
   한 파일에 묶었고, 다른 모듈(예: auth)로 새지 않는다. `WebAuthnAvailabilityDto` 도 auth/webauthn 모듈 경계 안에 있다.
8. **확장성** — `http-status-advertised` 가드를 "광고가 있으면 실제와 맞아야 한다" 에서 "라우트는 성공 응답을 하나 이상
   광고한다" 로 강화(베이스라인 0)한 것은 향후 새 라우트가 광고 없이 추가되는 것을 자동으로 막는 방향의 변경으로, 확장성·
   유지보수성에 긍정적이다. 3xx(리다이렉트) 를 성공 광고로 인정하는 예외도 `isRedirect`/`redirectAdvertised` 로 명시적으로
   분리돼 있어, 향후 또 다른 예외 클래스가 필요해져도 `classifyDecorators` 안에 분기를 하나 더 두는 정도로 국지적으로
   확장 가능하다.

## 요약

이번 변경은 새 아키텍처 요소를 도입하기보다 기존 Swagger 문서화 패턴(`common/swagger/api-wrapped.ts` 의 Decorator+Factory,
`dto/responses/` 모듈별 배치, AST 기반 저장소 가드)을 동일한 결로 확장한 것이다. 직전 리뷰 라운드에서 지적된 SRP 문제
(`judgeHandler` 분리)와 컴파일 타임 drift 방지(triggers 반환 타입)는 이미 반영되어 들어와 있고, 순환 의존·레이어 침범·
모듈 경계 훼손은 발견되지 않았다. 유일하게 남는 것은 같은 PR 안에서 "DTO 를 반환 타입으로 명시한다" 는 관례가
`triggers.controller.ts` 에는 적용되고 새로 문서화된 `workflow-assistant.controller.ts` 5개 핸들러에는 적용되지 않은
비대칭인데, 이는 이 PR 이 새로 만든 회귀가 아니라 손대지 않은 기존 시그니처이므로 급하지 않은 INFO 로 남긴다.

## 위험도

NONE
