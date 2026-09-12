# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `rotate-bot-token` 의 `:id` 비-UUID 입력에 대한 응답이 `500 INTERNAL_ERROR` → `400 VALIDATION_ERROR` 로 바뀐다 — 상태 코드 축의 breaking change
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` (`rotateBotToken` 메서드, `@Param('id', ParseUUIDPipe) triggerId: string` 및 그 위 `@ApiBadRequestResponse`)
  - 상세: `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`) 는 `HttpException` · http-error-like(4xx) · `isPostgresUniqueViolation`(23505) 세 분기만 인식하고, 나머지 `Error` 는 전부 500 `INTERNAL_ERROR` 로 떨어진다는 것을 직접 코드로 확인했다 — CHANGELOG 서술과 일치한다. 이번 변경으로 `ParseUUIDPipe` 가 붙어 비-UUID `:id` 는 이제 컨트롤러 진입 전에 400 `VALIDATION_ERROR` 로 끊긴다. 5xx 를 재시도/알림 트리거로 쓰는 외부 소비자가 있다면 신호가 사라지는 방향의 변경이라 형식상 breaking 이지만, ① CHANGELOG.md 에 Behavior change 로 명시 disclose 됐고 ② 저장소 내 유일한 소비자(프런트엔드 토스트)가 status 분기를 하지 않음을 확인했다고 기록돼 있으며 ③ 형제 6개 rotate/조회 엔드포인트는 애초에 이 축으로 400 을 내고 있어 이 엔드포인트만 예외였던 상태를 정상화하는 것이다. 버전 관리 체계(예: `/v1/`)가 없는 API 라 이런 동작 변경은 CHANGELOG 고지 외에 별도 마이그레이션 창구가 없다는 점은 이 PR 이 만든 문제가 아니라 프로젝트 전반의 기존 특성이다.
  - 제안: 조치 불필요 — 이미 CHANGELOG 고지·영향 분석·형제 엔드포인트와의 일관성 확보가 끝난 상태. 기록 목적의 INFO.

- **[INFO]** `@Param('id', ParseUUIDPipe)` 패치는 이 한 엔드포인트에 국한되고, `GlobalExceptionFilter` 자체는 SQLSTATE 22P02(`invalid_text_representation`)를 여전히 분류하지 않는다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (`catch` 메서드 — `HttpException`/`isPostgresUniqueViolation`/`mapHttpErrorLike` 세 분기 외 fallthrough)
  - 상세: 이번 diff 는 `@Param()` 경유 UUID 만 막는다. `@Query()`·body 필드로 넘어가는 UUID 형 값이 DB 조회까지 흘러가는 다른 경로가 있다면 여전히 500 마스킹이 재현될 수 있다. 다만 이는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 별도 항목("`GlobalExceptionFilter` 가 SQLSTATE 22P02 를 분류하지 않는다")으로 등재돼 있고, 필터 레벨 변경은 "저장소의 모든 엔드포인트 실패 분류에 영향"이라는 이유로 선행 전수조사가 필요해 의도적으로 이번 배치 범위 밖에 둔 것으로 기록돼 있다. 이번 PR 의 diff 만 놓고 보면 새로운 계약 위반이 아니라, 이미 스코프를 좁혀 명시적으로 defer 한 기존 갭이다.
  - 제안: 신규 조치 불필요(이미 트래커에 있음) — 이 리뷰에서는 범위 밖임을 재확인만 한다.

- **[INFO]** `auth.controller.ts switchWorkspace` 의 `@ApiParam` 에 `format: 'uuid'` 추가는 순수 문서(OpenAPI 스키마) 변경이며 런타임 동작은 무변
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts` (`switchWorkspace` 메서드)
  - 상세: 직접 파일을 열어 확인한 결과 `@Param('id', ParseUUIDPipe) targetWorkspaceId: string` 는 이번 diff 이전부터 이미 존재했다(런타임 축은 그대로, 문서 축의 `format` 키만 추가됨). 응답 스키마·상태 코드·인가 조건 어느 것도 바뀌지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** 에러 응답 문서(CHANGELOG·`@ApiBadRequestResponse`·`@ApiNotFoundResponse`)와 프런트엔드 사용자 가이드(MDX 4곳)의 에러 코드 서술이 실제 컨트롤러 선언과 일치하도록 함께 갱신됐다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` (`@ApiBadRequestResponse`/`@ApiNotFoundResponse` 문면), `codebase/frontend/src/content/docs/06-integrations-and-config/telegram{,.en}.mdx`, `codebase/frontend/src/content/docs/02-nodes/triggers{,.en}.mdx`
  - 상세: 컨트롤러의 `@ApiNotFoundResponse({ description: 'RESOURCE_NOT_FOUND — trigger 미존재 또는 워크스페이스 권한 없음' })` 를 직접 확인했고, 가이드 문서는 종전 `404 TRIGGER_NOT_FOUND`(실제로는 존재하지 않는 조합 — `TRIGGER_NOT_FOUND` 는 인입 webhook 경로 전용 코드)를 `404 RESOURCE_NOT_FOUND` 로, 그리고 신규 `400 VALIDATION_ERROR` 축을 추가로 반영했다. 응답 형식·에러 코드 문서의 정합성을 개선하는 방향이라 계약 관점에서 긍정적이다.
  - 제안: 조치 불필요.

## 요약

이번 변경의 핵심은 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 `:id` 경로 파라미터에 누락돼 있던 `ParseUUIDPipe` 를 형제 6개 엔드포인트와 동일하게 부착해, 비-UUID 입력이 DB 레벨(SQLSTATE 22P02)까지 흘러 `500 INTERNAL_ERROR` 로 마스킹되던 것을 `400 VALIDATION_ERROR` 로 정상화한 것이다. `GlobalExceptionFilter` 실제 분기 로직(`HttpException`/unique-violation/http-error-like 세 갈래, 나머지는 500)을 직접 코드로 대조해 CHANGELOG·PR 서술의 정확성을 확인했다. 상태 코드가 5xx→4xx 로 바뀌는 것은 형식상 하위 호환성 파괴 가능성이 있으나, CHANGELOG 에 Behavior change 로 명시 고지되고 유일한 저장소 내 소비자의 영향 없음이 확인됐으며 형제 엔드포인트와의 계약 일관성을 회복하는 방향이라 실질 위험은 낮다. 응답 형식(에러 envelope), 요청 검증(파이프 축+`@ApiParam` 문서 축을 동시에 요구하는 신규 AST 가드로 회귀 방지), URL/경로 설계, 인증/인가에는 변화가 없고 페이지네이션은 해당 없음. 남은 아키텍처 갭(필터가 22P02 를 전역적으로 분류하지 않음)은 이미 별도 트래커 항목으로 스코프를 좁혀 defer 돼 있어 이번 diff 의 결함으로 재기재하지 않았다. 문서(MDX 4곳) 와 OpenAPI 선언(`@ApiBadRequestResponse`/`@ApiNotFoundResponse`)도 실제 동작에 맞춰 함께 갱신되어 있다.

## 위험도

LOW
