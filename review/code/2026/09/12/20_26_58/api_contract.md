# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `rotateBotToken` 비-UUID `:id` 응답이 `500 INTERNAL_ERROR` → `400 VALIDATION_ERROR` 로 바뀐다 (실제 breaking change, 다만 적절히 관리됨)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe) triggerId: string`), `CHANGELOG.md:3` (Unreleased 항목)
  - 상세: `GlobalExceptionFilter.getCodeFromStatus()`(`codebase/backend/src/common/filters/http-exception.filter.ts:132`)를 직접 확인한 결과 `ParseUUIDPipe` 가 던지는 `BadRequestException` 은 `code` 필드가 없는 응답 객체라 `getCodeFromStatus(400)` 경로를 타 실제로 `VALIDATION_ERROR` 가 된다 — CHANGELOG·컨트롤러 주석의 주장과 실측이 일치한다. 이 엔드포인트로 잘못된(비-UUID) id 를 호출하던 클라이언트/모니터링은 이제 5xx 대신 4xx 를 받는다. CHANGELOG 가 이를 "Behavior change" 로 명시하고, 저장소 안 유일한 소비자(프런트엔드 토스트)가 status 를 분기하지 않음을 확인했다고 기록했다 — 하위 호환성 영향 평가가 사전에 이루어진 사례로, 절차적으로 적절하다.
  - 제안: 조치 불요. 외부(저장소 밖) API 클라이언트가 이 5xx 를 재시도/알림 트리거로 썼을 가능성만 배포 노트에 남기면 충분 — 이미 CHANGELOG 에 "배포 시 확인" 경고로 반영되어 있다.

- **[INFO]** 형제 6개 `:id` 엔드포인트와의 파이프·`@ApiParam(format:'uuid')` 정합성 확인 — 일치
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:82,142,164,183,212,240` (findOne/update/getHistory/remove/rotateNotificationSecret/revokePerTriggerToken)
  - 상세: 직접 대조한 결과 6곳 모두 이미 `@Param('id', ParseUUIDPipe)` + `@ApiParam({..., format:'uuid'})` 를 갖추고 있어, 이번 변경이 `rotateBotToken` 을 그 관례에 맞춘 것이 맞다. `auth.controller.ts` 의 `switchWorkspace`(`:445-448`)도 런타임 파이프는 이미 있었고 이번 diff 는 `@ApiParam` 문서 축(`format:'uuid'`)만 보강했다 — 코드 리뷰로 확인한 바 런타임 동작 변경 없음.
  - 제안: 없음.

- **[INFO]** 에러 코드 귀속 정정(`TRIGGER_NOT_FOUND` → `RESOURCE_NOT_FOUND`)이 컨트롤러 선언과 일치
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx:130`, `telegram.en.mdx:117`, `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:463`, `triggers.en.mdx:450`
  - 상세: 수정된 문서 문구("404 `RESOURCE_NOT_FOUND`(트리거 미존재 또는 워크스페이스 권한 없음)")는 `triggers.controller.ts` 의 `@ApiNotFoundResponse({ description: 'RESOURCE_NOT_FOUND — trigger 미존재 또는 워크스페이스 권한 없음' })` 문면과 정확히 일치한다. `rotateBotToken` 이 `TRIGGER_NOT_FOUND` 를 낼 경로는 없음을 확인(`hooks.service.ts` 의 인입 webhook 전용 코드) — 문서-코드 정합성 개선.
  - 제안: 없음.

- **[INFO]** `triggers{,.en}.mdx` 의 Chat Channel 에러코드 Callout 목록에 신규 400 `VALIDATION_ERROR`(비-UUID `:id`) 미기재 — 경미한 완결성 갭
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx:451` (Callout, `Error codes the Chat Channel API can carry...`), 한국어판 `triggers.mdx:463` 동일
  - 상세: 이번 diff 로 `rotateBotToken` 이 새로 낼 수 있는 400 `VALIDATION_ERROR`(id 형식 오류)가 이 Callout 목록에는 없다. 다만 같은 페이지 바로 위 섹션("Rotating the bot token")에 `VALIDATION_ERROR` 가 이미 다른 사유(설정 필드 오용)로 여러 번 언급되어 있고, 이 Callout 은 "Chat Channel 설정/토큰 회전 관련 provider 실패" 코드에 좁게 초점을 맞춘 목록으로 보여 반드시 갱신이 필요한 것은 아니다.
  - 제안: 선택 사항 — 완전성을 원하면 이 Callout 에 "id 형식 오류 시 400 VALIDATION_ERROR" 한 줄을 추가. 블로킹 아님.

- **[INFO]** 신규 `param-uuid-pipe` 가드가 UUID 경로 파라미터의 런타임 검증(400)·문서 축(`@ApiParam format:'uuid'`)을 전수(베이스라인 0)로 고정 — API 계약 회귀 방지에 긍정적
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`, `param-uuid-pipe.spec.ts`
  - 상세: `*.controller.ts` 35개 전수(id-형 `@Param` 136건)를 AST 로 스캔해 두 축 결핍을 0건으로 강제한다. 향후 신규 엔드포인트가 이번과 같은 실수(파이프 누락 → 500 마스킹)를 반복하는 것을 정적으로 차단한다. `@ApiExcludeEndpoint()` 는 문서 축만 면제하고 런타임 축은 그대로 검사하는 것도 반대방향 캐너리로 확인됨.
  - 제안: 없음 — 향후 `id`/`...Id` 가 아닌데 UUID 인 파라미터(예: `externalId`)가 생기면 이 가드가 의도적으로 RED 를 내고 사람이 이름/예외를 판단하게 설계되어 있음을 유지 보수자가 인지하면 충분.

## 요약

이번 변경의 핵심은 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 `:id` 경로 파라미터에 누락되어 있던 `ParseUUIDPipe`(런타임 검증)와 `@ApiParam({format:'uuid'})`(OpenAPI 문서)를 형제 6개 엔드포인트와 동일하게 보강한 것이다. 이로 인해 비-UUID `:id` 호출 시 응답이 `500 INTERNAL_ERROR`(SQLSTATE 22P02 마스킹, `GlobalExceptionFilter` 소스로 직접 검증됨)에서 `400 VALIDATION_ERROR` 로 바뀌는 실질적 breaking change 가 발생하지만, CHANGELOG 에 영향 평가(내부 유일 소비자 미분기 확인)와 함께 명시적으로 문서화되어 있어 절차적으로 적절하다. 함께 포함된 유저 가이드 4곳의 `TRIGGER_NOT_FOUND`→`RESOURCE_NOT_FOUND` 정정, `backend-labels.ts`/테스트의 주석 귀속 정정, `switchWorkspace` 의 `@ApiParam` 문서 보강은 모두 컨트롤러의 실제 선언·동작과 대조해 일치함을 확인했다. 신규 AST 기반 리포 가드는 이 계약(경로 UUID 파라미터의 런타임+문서 이중 검증)을 베이스라인 0으로 고정해 회귀를 구조적으로 차단한다. 에러 응답 형식·인증/인가·페이지네이션·URL 설계·버전 관리 측면에서 새로운 문제는 발견되지 않았다.

## 위험도

LOW
