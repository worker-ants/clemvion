# 신규 식별자 충돌 검토 — success-advert (`--impl-done`)

## 범위와 방법

이번 `--impl-done` scope(`spec/`)의 실제 델타는 0개 파일이다(`spec/conventions/swagger.md` 1건
제외 — 이는 앞선 `13_07_11`/`13_17_19` 라운드에서 이미 검토된 spec draft 반영 커밋
`24084fd0e`). 따라서 본 라운드의 실질 대상은 **그 spec 변경을 근거로 실제 구현된 코드**다
(`origin/main...HEAD` diff 15파일/1185줄). 프롬프트 번들의 diff 본문이 예산으로 잘려 있어,
HEAD 워크트리를 절대경로로 직접 읽고 `git diff origin/main...HEAD -- <path>` 로 파일별 diff를
확인했다.

이전 두 라운드(`13_07_11` spec 단계, `13_17_19` impl-prep 단계)가 이미 이 PR 의 명명
후보(`ApiOkWrappedNullableResponse`, workflow-assistant DTO 접두, triggers 응답 DTO 이름)를
사전 검토해 INFO/WARNING 으로 명명 관례(도메인 접두)를 제안했다. 본 라운드는 **실제로 구현된
최종 식별자**가 그 제안을 따랐는지, 그리고 구현 과정에서 새로 등장한 식별자(가드 내부
타입·함수, 신규 DTO 클래스 전체 목록, enum 이름)까지 포함해 저장소 전체와 재대조했다.

## 발견사항

- **[INFO]** 제안된 명명 관례가 실제 구현에 그대로 반영됨 — 충돌 없음
  - target 신규 식별자: `NotificationRotateSecretDto` · `InteractionRevokeTokenDto`
    (`codebase/backend/src/modules/triggers/dto/responses/trigger-secret-issue-response.dto.ts`,
    신규 파일), `AssistantSessionDto` · `AssistantSessionDetailDto` · `AssistantMessageDto` ·
    `AssistantToolCallDto` · `AssistantPlanDto` · `AssistantPlanStepDto` · `AssistantUsageDto`
    (`codebase/backend/src/modules/workflow-assistant/dto/responses/assistant-session-response.dto.ts`,
    신규 파일), `WebAuthnAvailabilityDto`
    (`codebase/backend/src/modules/auth/webauthn/dto/responses/webauthn-response.dto.ts`),
    `wrapNullableDataSchema` / `ApiOkWrappedNullableResponse`
    (`codebase/backend/src/common/swagger/api-wrapped.ts`)
  - 기존 사용처: 없음 — `git grep`으로 각 이름을 `codebase/`·`spec/`·`plan/` 전체에서
    조회한 결과 정의 지점 1곳 외 다른 의미의 선언은 0건
  - 상세: `13_17_19` 라운드 WARNING/INFO8이 제안한 대로 workflow-assistant 계열은 형제
    DTO(`CreateAssistantSessionDto`·`UpdateAssistantSessionDto`)와 같은 `Assistant` 접두를,
    triggers 계열은 같은 모듈 선례 `ChatChannelRotateBotTokenDto` 와 같은 도메인 접두 패턴을
    따랐다. `auth.SessionDto`/`SessionListDto`(로그인 세션), `users.MessageResponseDto`,
    `auth.RefreshTokenDto`/`AccessTokenDto`, `external-interaction.RefreshTokenResponseDto` 등
    기존 "세션"·"메시지"·"토큰" 계열 DTO 와 이름이 겹치지 않는다. 엔티티 필드에서 뽑아
    Swagger 에 노출한 `enumName`(`AssistantSessionStatus`·`AssistantToolCallKind`·
    `AssistantStepAction`·`AssistantMessageRole`·`AutoResumeReason`)도 각각 저장소 전체에서
    1회씩만 등장해 OpenAPI `components.schemas` 레벨의 enum 이름 충돌도 없다. 또한
    `dto-class-name-collision.spec.ts`(AST 기반, `modules/`·`common/` 전수) 가드가 정확히 동일한
    클래스명이 두 곳에서 선언되면 빌드 시점에 별도로 차단하므로, 유사명이 아닌 리터럴 동명 충돌은
    구조적으로도 막혀 있다.
  - 제안: 없음 — 그대로 유지.

- **[INFO]** `http-status-advertised-guard.ts` 내부 신규 식별자(`HttpStatusUnadvertised` 인터페이스,
  `HandlerDecorators` 인터페이스, `classifyDecorators`/`isRedirect` 함수, `HttpStatusScan.unadvertised`
  필드) — 충돌 없음
  - target 신규 식별자: 위 다섯 개, 전부
    `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts` 파일 내부 정의
  - 기존 사용처: 없음 — 저장소 전체에서 grep 시 정의·참조 모두 이 파일과 대응 테스트
    (`http-status-advertised.spec.ts`)로만 한정
  - 상세: 이름 공간이 이 가드 모듈에 국한되고(export 되어 다른 모듈에서 import 되지 않음),
    `isRedirect`/`classifyDecorators` 같은 일반적인 이름도 저장소 다른 곳(예: 프런트엔드 라우팅
    코드)에서 동명 함수로 쓰이지 않는다.
  - 제안: 없음.

- **[INFO]** API endpoint(method+path) 신규 추가 없음 — 전부 기존 라우트에 Swagger 응답
  데코레이터만 부가
  - target: `plan/in-progress/success-advert.md` 실측 표의 11개 자리
    (`GET/POST/PATCH/DELETE /workflow-assistant/sessions*`, `GET /auth/2fa/webauthn/availability`,
    `DELETE /auth/2fa/webauthn/credentials/:id`,
    `GET /external/executions/:executionId/stream`,
    `POST /triggers/:id/notification/rotate-secret`,
    `POST /triggers/:id/interaction/revoke-token`)
  - 기존 사용처: 위 11개 경로는 모두 이 PR 이전부터 존재하던 라우트다(컨트롤러 diff 는 데코레이터
    추가/타입 변경만이며 `@Get`/`@Post`/`@Patch`/`@Delete` 신규 선언이 없음을 diff 로 확인)
  - 상세: "새 endpoint 충돌" 관점은 해당 없음 — 이번 변경은 계약(스키마 문서화)만 추가하고 wire
    상 요청/응답을 바꾸지 않는다(`spec/conventions/swagger.md` Rationale 도 "응답 자체는 그대로,
    문서가 실제 응답을 적게 됐다"고 명시).
  - 제안: 없음.

- **[INFO]** 새 ENV var·config key·webhook/queue/SSE 이벤트명 도입 없음
  - target: diff 전체(`git diff origin/main...HEAD --stat`)를 훑어도 신규 `process.env.*` 참조,
    신규 Redis/BullMQ 큐 이름, 신규 webhook/SSE 이벤트 상수가 없다. `WEBAUTHN_RP_ID`/
    `WEBAUTHN_ORIGIN` 은 기존 env var를 Swagger 설명 문구에서 재인용한 것뿐이다.
  - 기존 사용처: 해당 없음(신규 도입 자체가 없음)
  - 상세/제안: 해당 없음.

- **[INFO]** 신규 파일 경로도 기존 컨벤션과 정합
  - target 신규 파일: `trigger-secret-issue-response.dto.ts`(`triggers/dto/responses/`),
    `assistant-session-response.dto.ts`(`workflow-assistant/dto/responses/`)
  - 기존 사용처: 같은 디렉터리의 `chat-channel-rotate-bot-token-response.dto.ts`,
    `trigger-response.dto.ts` 등과 `<도메인>-<동작>-response.dto.ts` 명명 패턴이 일치하고, 기존
    파일과 경로가 겹치지 않는다(둘 다 `git diff` 상 `new file mode` — 완전 신규 경로).
  - 상세/제안: 해당 없음 — 충돌 없음.

## 요약

이번 `--impl-done` 라운드가 실제로 다루는 코드 변경(15파일/1185줄)이 도입한 신규 식별자 —
응답 DTO 클래스 8종, Swagger 헬퍼 2종(`wrapNullableDataSchema`/`ApiOkWrappedNullableResponse`),
가드 내부 타입/함수 5종, enum 이름 5종, 신규 파일 경로 2개 — 를 저장소 전체(`codebase/`·
`spec/`·`plan/`)와 대조한 결과 리터럴 동명·의미 충돌이 하나도 없었다. 이는 앞선
`--spec`(`13_07_11`)·`--impl-prep`(`13_17_19`) 라운드가 사전에 제안한 도메인 접두 명명 관례를
구현이 그대로 따른 결과이며, `dto-class-name-collision` 가드가 리터럴 동명 충돌을 구조적으로도
막고 있다. 새 API endpoint·이벤트명·환경변수·설정키 도입도 없어(순수 문서화/계약 강화 변경)
해당 관점의 위험도 없다.

## 위험도

NONE
