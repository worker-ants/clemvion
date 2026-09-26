# 성능(Performance) 리뷰 — rotate-bot-token-body

## 범위 요약

이번 변경은 세 라우트(`POST /triggers/:id/chat-channel/rotate-bot-token`, `POST /executions/:id/continue`,
`POST /hooks/:endpointPath`)에 OpenAPI `@ApiBody`/`@ApiConsumes` 데코레이터와 문서 전용 DTO 2개
(`ChatChannelRotateBotTokenRequestDto`, `ContinueExecutionRequestDto`)를 추가하는 **순수 문서화 변경**이다.
`@Body()` 파라미터 타입은 그대로 인라인(`Object`)으로 유지되어 전역 `CustomValidationPipe` 를 우회하며,
런타임 검증 로직·요청 처리 경로·응답 스키마는 diff·plan·캐너리 테스트로 실측된 대로 전혀 바뀌지 않는다.
나머지 신규/변경 파일(`swagger-probe.ts`/`.spec.ts`, `*-body.spec.ts` 3종, plan/review 문서)도 전부
빌드 타임(데코레이터 메타데이터)·테스트 실행 시에만 동작하는 코드이고 프로덕션 요청 경로에는 들어가지 않는다.

## 발견사항

- **[INFO]** 데코레이터 추가는 애플리케이션 부트스트랩 1회성 비용만 발생
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` (`@ApiBody({ type: ChatChannelRotateBotTokenRequestDto })`, `rotateBotToken` 메서드),
    `codebase/backend/src/modules/executions/executions.controller.ts` (`@ApiBody({ type: ContinueExecutionRequestDto, required: false })`, `continueExecution` 메서드),
    `codebase/backend/src/modules/hooks/hooks.controller.ts` (`@ApiConsumes(...)` · `@ApiBody({ required: false, schema: {} })`, `receiveWebhook` 메서드)
  - 상세: `@ApiBody`/`@ApiConsumes`/`@ApiProperty`/`@ApiPropertyOptional` 는 Nest 가 OpenAPI 문서를 생성할 때(부트스트랩 시 1회, 또는 `/api-docs` 요청 시 캐시된 문서를 서빙) 리플렉션 메타데이터를 등록하는 데코레이터로, 요청마다 재평가되지 않는다. 실제 요청 처리 경로(`rotateBotToken`/`continueExecution`/`receiveWebhook` 핸들러 바디)는 이번 diff 에서 한 줄도 바뀌지 않았다. 알고리즘 복잡도·N+1·블로킹 I/O·캐싱 전략에 영향을 줄 여지가 없다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 테스트 헬퍼(`bodyParamDesignType`)는 테스트 전용, 프로덕션 핫패스와 무관
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts` (`bodyParamDesignType` 함수, `Reflect.getMetadata(ROUTE_ARGS_METADATA, ...)` + `Object.entries(args).filter(...)` 사용)
  - 상세: 이 함수는 `*-body.spec.ts` 3개 파일의 `describe` 블록 안에서 컨트롤러당 1회 호출되는 테스트 유틸리티다. 순회 대상(`args` 의 엔트리 수)은 해당 메서드의 `@Body()`/`@Param()` 등 라우트 인자 개수(실무상 1~3개)로 상수에 가깝고, 런타임 서버 코드 경로에는 전혀 포함되지 않는다. 시간 복잡도상 문제될 규모가 아니다.
  - 제안: 조치 불필요.

- **[INFO]** webhook 스키마를 `{}`(임의 값)로 광고 — 문서 크기·처리 비용에 영향 없음
  - 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts` (`@ApiBody({ required: false, description: ..., schema: {} })`)
  - 상세: 빈 스키마 객체(`{}`)는 OpenAPI 문서에 상수 크기로 반영되며, 동적 계산이나 대규모 스키마 생성이 없다. 캐싱·지연 로딩 관점에서도 무해하다.
  - 제안: 조치 불필요.

성능에 부정적 영향을 줄 수 있는 알고리즘 변경, 반복문 내 DB/API 호출, 대규모 메모리 할당, 캐싱 무효화, 동기 I/O 블로킹, 문자열 누적 O(n²), 부적절한 자료구조, 선행 로딩 이슈는 diff 전체에서 발견되지 않았다. 이전 라운드(`review/code/2026/09/26/17_55_14`)의 라우터도 동일한 근거("순수 OpenAPI 문서 데코레이터 추가 — 런타임 경로/부하 특성 변경 없음")로 performance reviewer 를 제외했으며, 이번 라운드에서 추가된 변경분(`bodyParamDesignType` 에러 경로 테스트 보강, plan/RESOLUTION 문서)도 같은 결론을 바꾸지 않는다.

## 저장소 상태

리뷰 중 저장소 트리에 어떤 파일도 쓰거나 뮤테이션하지 않았다. `git status --short` 확인 불필요(파일 Write 미수행).

## 요약

이번 변경은 3개 라우트에 OpenAPI 요청 본문 스키마(`@ApiBody`/`@ApiConsumes`)를 광고하는 문서 전용 작업으로, `@Body()` 파라미터 타입을 인라인으로 유지해 전역 검증 파이프를 우회시킴으로써 런타임 계약을 의도적으로 그대로 두었다. 부트스트랩 시 1회 평가되는 데코레이터 메타데이터 등록 외에는 요청 처리 경로에 어떤 코드도 추가·변경되지 않았고, 신규 테스트 헬퍼(`bodyParamDesignType`)도 소규모 입력에 대해 테스트 실행 시에만 동작한다. 알고리즘 복잡도, N+1, 메모리, 캐싱, 블로킹 I/O, 불필요한 연산, 자료구조, 지연 로딩 어느 관점에서도 성능 리스크가 없다.

## 위험도

NONE
