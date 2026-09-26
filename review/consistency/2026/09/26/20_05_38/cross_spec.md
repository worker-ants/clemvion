# Cross-Spec 일관성 검토 — request-body-guard (--impl-done)

## 검토 범위 요약

- 이 PR 의 **spec 델타는 0개 파일**이다 — `spec/conventions/swagger.md` §5-4("요청 본문 스키마" 항목·2026-09-26 Rationale)는 이미 이전 커밋에서 merge 된 상태이고, 이번 diff(6파일/506줄)는 그 규약을 강제하는 **저장소 가드(`request-body-advertised-guard.ts`/`request-body-advertised.spec.ts`) 및 대조군(`validation.pipe.ts` 리팩터·`swagger-probe.ts` `bodyArgIndexes` 신설)만** 추가한다.
- target 이 다루는 도메인(엔드포인트별 `@Body()` 설계 타입 ↔ `@ApiBody` 광고 짝)이 실제로 건드리는 라우트 3곳(`rotate-bot-token` · execution `continue` · webhook 수신)을 코드 기준(HEAD 워킹트리)으로 직접 열어 각각의 SoT spec 과 대조했다.

## 발견사항

교차 영역 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 여섯 관점 모두에서 CRITICAL/WARNING 급 충돌을 찾지 못했다. 확인한 근거는 다음과 같다.

- **`POST /api/triggers/:id/chat-channel/rotate-bot-token`** — 신설 `ChatChannelRotateBotTokenRequestDto` 는 `@ApiBody({ type })` 전용이고 컨트롤러 `@Body() body: { newBotToken?: string }` 인라인 타입은 그대로다. 실제 검증 로직(`triggers.controller.ts` 308~332행)은 여전히 비-string/누락 시 `400 INVALID_BOT_TOKEN` 을 던지며, 이는 `spec/5-system/15-chat-channel.md` 372행의 `INVALID_BOT_TOKEN` 행과 정확히 일치한다. 계약 변경 없음.
- **`POST /api/executions/:id/continue`** — `@ApiBody({ type: ContinueExecutionRequestDto, required: false })` 로만 광고하고 파라미터는 `@Body() body?: { formData?: unknown }` 인라인을 유지한다. EIA 관련 spec 이 규정하는 continuation 계약과 형태가 달라지지 않았다(문서화만 추가).
- **웹훅 수신(`hooks.controller.ts` `receiveWebhook`)** — `@ApiBody({ schema: {} })` + `@ApiConsumes('application/json','application/x-www-form-urlencoded')` 로 "발신자가 형태를 정하는 본문"을 광고한다. `spec/5-system/12-webhook.md` 의 `WH-EP-04`(JSON/form-urlencoded 수신)·`WH-EP-05`(본문 전체를 `body` 로 전달) 요구사항과 일치하며 새 요구사항 ID 부여도 없다.
- **`CustomValidationPipe` 리팩터** — `toValidate()` 내부의 인라인 배열 `[String, Boolean, Number, Array, Object]` 을 export 된 동결 상수 `UNVALIDATED_METATYPES` 로 옮긴 것으로, 판정 로직·membership 은 동일하다(behavior-preserving refactor). `spec/5-system/3-error-handling.md`·`2-api-convention.md` 가 문서화하는 `VALIDATION_ERROR`/`INVALID_FIELD` 발행 조건과 충돌 없음.
- **layer 책임** — 신설 가드는 기존 형제 가드(`forbidden-response-codes-guard.ts`·`http-status-advertised-guard.ts`)와 동일한 `repo-guards/__tests__/` 배치·`RouteHandler`/`collectRouteHandlers`/`loadControllers` 재사용 패턴을 따른다. 새로운 레이어 경계나 책임 분할 변경 없음.
- **RBAC/권한 모델** — 이번 변경은 `@Roles()`/`@WorkspaceId()` 가드 로직을 건드리지 않는다. 대상 세 라우트의 권한 데코레이터(`@Roles('editor')` 등)도 미변경.
- **문서 section 번호 표기** — `spec/conventions/swagger.md` 는 자신의 절을 `§5-4`(대시)로, `spec/5-system/2-api-convention.md` 는 `§5.4`(점)로 적어 같은 숫자를 쓰지만, 상호 참조 링크가 이미 이 둘을 명시적으로 구분해 인용하고 있어(예: `[API 규약 §5.4]` vs `swagger.md §5-4`) 실제 혼동 사례는 발견되지 않았다. 신규 위반 아님, 정보성 확인.

## 요약

이번 PR 은 spec 을 변경하지 않고(델타 0), 이미 승인·문서화된 `spec/conventions/swagger.md` §5-4 요청 본문 스키마 규칙을 강제하는 정적 가드와 그 대조군만 추가한다. 가드가 실제로 다루는 세 미광고 라우트(rotate-bot-token · execution continue · webhook 수신)를 HEAD 워킹트리에서 직접 대조한 결과 각 스펙(15-chat-channel §5.4, 12-webhook WH-EP-04/05, EIA continue)과 요청/응답 계약이 그대로 일치했고, 파이프 리팩터는 동작 보존적이다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 기존 spec 영역과의 직접 모순이나 잠재 충돌을 확인하지 못했다.

## 위험도

NONE
