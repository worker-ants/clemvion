# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `rotate-bot-token` 의 `:id` 검증 강화는 breaking change 지만 리스크가 낮고 문서화가 충실하다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken()` 의 `@Param('id', ParseUUIDPipe)` (게이트 291)
  - 상세: 비-UUID `:id` 응답이 `500 INTERNAL_ERROR`(Postgres 22P02 → `GlobalExceptionFilter` 미분류 마스킹) 에서 `400 VALIDATION_ERROR` 로 바뀐다. `GlobalExceptionFilter.getCodeFromStatus(400)` 경로를 직접 확인해 `ParseUUIDPipe` 의 기본 `BadRequestException`(중첩 `error` 가 객체가 아니라 문자열 `'Bad Request'`라 `nested` 매칭 실패 → status 기반 폴백)이 실제로 `VALIDATION_ERROR` 를 낸다는 것을 재현 없이 소스 대조로 확인했다. 5xx 를 재시도/알림 트리거로 쓰는 외부 소비자가 있다면 신호가 사라지는 진짜 breaking change 이지만, 저장소 내 유일한 소비자(`codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` 의 `onError`)는 상태 코드를 분기하지 않고 고정 토스트만 띄우므로 이 저장소 범위에서는 영향이 없다 — CHANGELOG 의 주장과 실측이 일치한다. 형제 6개 엔드포인트(`findOne`/`update`/`getHistory`/`remove`/`auth.switchWorkspace` 등)는 이미 `ParseUUIDPipe` 를 쓰고 있었으므로 이번 변경은 기존 계약과의 **정합**이지 새로운 패턴 도입이 아니다.
  - 제안: 조치 불필요. 다만 외부(저장소 밖) API 클라이언트가 있다면 배포 노트에 반영된 CHANGELOG 경고를 그대로 릴리스 공지에도 전파할 것.

- **[INFO]** OpenAPI 문서 축(`format: 'uuid'`) 보강 — `auth.controller.ts` `switchWorkspace`
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts:436` (게이트 436, `@ApiParam({ name: 'id', ... format: 'uuid' })`)
  - 상세: 런타임 검증(`ParseUUIDPipe`, 447행)은 이미 존재했고 이번 diff 는 OpenAPI 스키마 선언만 보강한다. 클라이언트 동작에는 영향 없는 순수 문서 정합화이며, `spec/conventions/swagger.md §5-4` 체크리스트와 새로 추가된 정적 가드(`param-uuid-pipe-guard.ts`)의 근거와 일치함을 확인했다.

- **[INFO]** 에러 코드 문서-코드 불일치 정정 (`TRIGGER_NOT_FOUND` → `RESOURCE_NOT_FOUND`)
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` (게이트 605-613), `codebase/frontend/src/content/docs/06-integrations-and-config/telegram{,.en}.mdx`, `02-nodes/triggers{,.en}.mdx`
  - 상세: `triggers.controller.ts` 의 `findById` 는 실제로 `RESOURCE_NOT_FOUND` (`codebase/backend/src/modules/triggers/triggers.service.ts:348-349`)를 던지며, `TRIGGER_NOT_FOUND` 는 별개 표면인 hooks webhook 인입 경로(`spec/data-flow/10-triggers.md`)의 코드임을 서비스 소스로 직접 확인했다. 유저 가이드 4곳 + `backend-labels.ts`/`.test.ts` 주석 2곳까지 총 6곳의 오귀속을 정정해 API 응답 계약과 사용자 문서의 정합을 회복한다 — 계약 자체의 변경이 아니라 문서를 실제 계약에 맞추는 수정.

- **[INFO]** 에러 응답 문서화 완결성 — `@ApiBadRequestResponse` 가 400 사유를 전부 나열
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:271-272` (게이트 271-272)
  - 상세: `VALIDATION_ERROR (:id 가 UUID 형식이 아님)` 를 기존 `INVALID_BOT_TOKEN`/`BOT_TOKEN_INVALID`/`CHAT_CHANNEL_*` 목록에 추가해 400/502 두 축을 모두 문서화했다. `@ApiNotFoundResponse` 도 `RESOURCE_NOT_FOUND` 로 정확히 기재되어 있다. 응답 스키마·에러 코드 목록이 실제 핸들러 로직과 1:1 대응해 스키마 드리프트가 없다.

- **[INFO]** 인증/인가 미변경 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:257-258` (`@Post(':id/chat-channel/rotate-bot-token')` + `@Roles('editor')`)
  - 상세: 이번 diff 는 파라미터 파이프·문서 데코레이터만 추가했고 `@Roles('editor')`·`@ApiBearerAuth` 등 인가 체계는 무변경이다. Nest 실행 순서(Guard → Pipe)상 `ParseUUIDPipe` 검증보다 role 가드가 먼저 실행되므로 인가 우회 경로는 생기지 않는다.

- **[INFO]** 신규 정적 가드(`param-uuid-pipe-guard.ts`)의 API 계약 커버리지
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`, `param-uuid-pipe.spec.ts`
  - 상세: id-형 경로 파라미터의 런타임(`ParseUUIDPipe`)·문서(`@ApiParam format:'uuid'`) 두 축을 AST 로 전수 스캔해 베이스라인 0으로 고정한다. `@ApiExcludeEndpoint()` 핸들러는 문서 축만 면제하고 런타임 축은 그대로 요구하는 설계(반대 방향 캐너리 fixture 로 검증됨)라, 향후 같은 클래스의 회귀(비-UUID id → 500 마스킹)를 구조적으로 막는다. API 계약 관점에서 유의미한 회귀 방지 장치다.

## 요약

이번 변경 세트의 핵심은 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 한 곳에만 빠져 있던 `:id` UUID 검증(`ParseUUIDPipe`)을 형제 6개 엔드포인트와 동일하게 맞추는 것이다. 이로 인해 비-UUID `:id` 요청의 응답이 `500 INTERNAL_ERROR`(버그 — Postgres 파싱 에러가 `GlobalExceptionFilter` 의 미분류 폴백으로 마스킹됨)에서 `400 VALIDATION_ERROR` 로 바뀌는 행위 변경(breaking change)이 발생하지만, ① 실제 필터 로직을 직접 대조해 400/`VALIDATION_ERROR` 전환이 정확함을 확인했고 ② 저장소 내 유일한 프런트엔드 소비자는 상태 코드를 분기하지 않아 영향이 없음을 소스로 검증했으며 ③ CHANGELOG 에 배포 시 확인 사항으로 명시적으로 경고돼 있다. 부수적으로 `auth.controller.ts` 의 OpenAPI `format:'uuid'` 문서 보강, 4개월 전부터 존재하던 에러 코드 문서 오귀속(`TRIGGER_NOT_FOUND`→`RESOURCE_NOT_FOUND`) 6곳 정정, 그리고 이 클래스의 회귀를 원천 차단하는 AST 기반 정적 가드가 함께 추가되어 응답 형식·에러 코드·요청 검증·문서 정합성이 전반적으로 개선됐다. 새 URL 이나 페이지네이션 변경은 없고, 인증/인가 체계에도 영향이 없다.

## 위험도

LOW
