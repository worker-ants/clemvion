# 보안(Security) 리뷰

## 발견사항

- **[INFO]** 요청 본문 스키마 데코레이터만 추가하는 순수 문서화 변경 — 런타임 검증 경로 불변임을 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` (`rotateBotToken`, 308~333번째 줄 부근), `codebase/backend/src/modules/executions/executions.controller.ts:177~207`(`continueExecution`), `codebase/backend/src/modules/hooks/hooks.controller.ts:152~217`(`receiveWebhook`)
  - 상세: 이번 변경은 `@Body()` 파라미터 타입을 그대로 두고(`Object`/인라인 타입) `@ApiBody({ type: ... })` 로 OpenAPI 문서만 채우는 방식이다. 전역 `CustomValidationPipe` 는 `metatype === Object` 일 때 검증을 건너뛰므로, 새 DTO(`ChatChannelRotateBotTokenRequestDto`, `ContinueExecutionRequestDto`)를 도입해도 실제 인가·검증 로직(`rotateBotToken` 핸들러의 수동 `typeof` 체크, `verifyOwnership` IDOR 가드, `@Roles`/`@Public` 데코레이터, webhook 서명/시크릿 검증)은 전혀 바뀌지 않는다. 세 캐너리 스펙(`triggers-rotate-bot-token-body.spec.ts`, `executions-continue-body.spec.ts`, `hooks-webhook-body.spec.ts`)이 이 전제(설계 타입이 `Object`로 유지됨, 여분 키·비-string 값이 여전히 파이프를 통과함)를 명시적으로 고정해 회귀를 잡도록 설계되어 있다. 직접 `Read` 로 `triggers.controller.ts:308-333` 을 열어 확인한 결과 `newBotToken` 누락/비-string 거부(`INVALID_BOT_TOKEN`), `verifyOwnership`/`@Roles('editor')` 인가는 diff 이전과 동일하다.
  - 제안: 없음(정보성). 향후 이 DTO들에 실수로 class-validator 데코레이터를 붙이는 PR이 온다면 에러 코드 계약이 조용히 바뀔 수 있으니, 리뷰 시 “문서 전용 DTO”라는 주석과 캐너리가 함께 유지되는지 확인할 것.

- **[INFO]** `newBotToken` 필드에 `writeOnly: true` 를 정확히 부여 — 시크릿 필드의 OpenAPI 노출 억제가 규약대로 반영됨
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts:17`
  - 상세: bot token 평문을 받는 필드에 `writeOnly` 를 붙여 Swagger UI 응답 예시 등에 노출되지 않도록 했고, 렌더 캐너리(`triggers-rotate-bot-token-body.spec.ts` `[렌더]` 케이스)가 이를 단언해 회귀를 막는다. 실제 값은 어디에도 하드코딩되지 않았고, 예시(`example`)도 부여하지 않아 실제 토큰 형태를 추정할 단서를 문서에 남기지 않는다.
  - 제안: 없음(양호한 처리).

- **[INFO]** `POST /hooks/:endpointPath` 는 여전히 `@Public()` + 임의 스키마(`schema: {}`) 웹훅 — 문서화만 추가, 인증/속도제한 정책 변경 없음
  - 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts:96~141`
  - 상세: 공개(인증 없음) 웹훅 수신 엔드포인트에 `@ApiConsumes`/`@ApiBody` 만 추가됐다. 서명/시크릿 검증은 `hooksService.handleWebhook` 내부에 위임되어 있고 이 diff 범위 밖이며, 기존 `PublicWebhookThrottleGuard` · payload 크기 제한(32KB, `ApiPayloadTooLargeResponse` 문서만 여기 추가) 등 기존 방어선은 그대로다. `body: unknown` 이라 전역 파이프를 타지 않는 점도 문서 주석에 정확히 반영되어 있어 오해 소지가 없다.
  - 제안: 없음.

- **[INFO]** `ContinueExecutionRequestDto.formData` 는 `additionalProperties: true` 열린 map — 런타임 검증은 폼 엔진이 대신 수행(문서와 일치)
  - 위치: `codebase/backend/src/modules/executions/dto/continue-execution.dto.ts:15`
  - 상세: OpenAPI 스키마상 임의 키를 허용하지만, 실제 필드 검증은 대기 중인 폼 노드 정의 기준으로 엔진이 수행한다고 주석·JSDoc에 명시되어 있고 이는 새로 도입된 동작이 아니라 기존 동작을 문서화한 것이다. DTO 자체에는 인증/인가 로직이 없으며 컨트롤러의 `verifyOwnership` 호출은 diff 이전과 동일하게 유지된다.
  - 제안: 없음.

- **[INFO]** 신규 테스트 헬퍼 `bodyParamDesignType` 은 `@nestjs/testing`(devDependency) 을 사용하지만 프로덕션 번들에서 제외되도록 이미 등재된 exclude 규칙에 포함됨
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:141~164`
  - 상세: `codebase/backend/tsconfig.build.json` 을 직접 확인한 결과 `src/shared/testing/**` 이 이미 `exclude` 에 명시되어 있어(2026-08-27자 기존 조치), 이번에 추가된 함수도 동일하게 `dist` 빌드에서 제외된다. devDependency 가 프로덕션 런타임에 섞여 들어가는 공급망/의존성 문제는 발생하지 않는다.
  - 제안: 없음(기존 안전장치가 신규 코드에도 적용됨을 확인).

CHANGELOG.md, plan 문서, `review/consistency/2026/09/26/17_20_45/**` 산출물(SUMMARY.md · `_retry_state.json` · convention_compliance.md 등)은 모두 문서/메타데이터이며 시크릿·자격증명·실행 가능한 로직을 포함하지 않는다. `_retry_state.json` 은 로컬 절대경로만 담고 있어 민감정보 노출이 아니다.

뮤테이션 검증(저장소 파일 수정)은 수행하지 않았다 — `Read`/`Grep`/`grep` 만으로 충분히 확인 가능했다. `git status --short` 로 저장소에 잔여 변경이 없음을 확인했다(수정 없음).

## 요약

이번 변경은 3개 라우트(`rotate-bot-token`, `executions/:id/continue`, `hooks/:endpointPath`)에 `@ApiBody` 문서만 추가하는 순수 OpenAPI 문서화 작업이며, `@Body()` 파라미터 타입을 인라인/`Object` 로 유지해 전역 `CustomValidationPipe` 진입을 의도적으로 피함으로써 기존 인증(`@Roles`, `@Public`)·인가(`verifyOwnership` IDOR 가드)·입력 검증(`INVALID_BOT_TOKEN` 수동 체크, 웹훅 서명 검증, 폼 엔진 검증) 계약을 전혀 바꾸지 않는다. 시크릿 필드(`newBotToken`)에는 `writeOnly` 가 정확히 적용되어 있고 예시값도 없어 OpenAPI 문서를 통한 시크릿 노출 위험도 없다. 신규 테스트 유틸리티는 기존 빌드 제외 규칙에 포함되어 devDependency 가 프로덕션에 유입될 위험도 없다. 인젝션·하드코딩 시크릿·인증 우회·안전하지 않은 암호화·에러 메시지 정보 노출 등 점검 관점에서 새로 도입된 취약점은 발견되지 않았다.

## 위험도

NONE
