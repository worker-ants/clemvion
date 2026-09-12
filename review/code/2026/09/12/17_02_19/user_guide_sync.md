# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 SoT 로 사용.

## 변경 파일 (실제 codebase 변경, 파일 1~8)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts`
- `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts`
- `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts` (신규 — 이전 라운드에서 `dto/` 평평한 위치였다가 `dto/responses/` 로 이동됨)
- `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`
- `codebase/backend/src/modules/triggers/triggers.controller.ts`
- `codebase/backend/src/modules/triggers/triggers.service.ts`

나머지 파일(9~43)은 `plan/in-progress/**` · `review/code/2026/09/12/{16_17_57,16_39_18}/**` · `review/consistency/2026/09/12/15_53_35/**` — 전부 프로세스 산출물이며 본 리뷰어 영역 밖(코드 아님).

`codebase/frontend/**` diff 0줄. `codebase/backend/src/nodes/**` diff 0줄. `codebase/backend/src/modules/auth/**` diff 0줄. `codebase/packages/expression-engine/**` diff 0줄.

## trigger 매칭 검토

### 매칭: `backend-api-change` (semantic, glob `codebase/backend/src/**/*.controller.ts` + `codebase/backend/src/**/dto/**`)
- 변경 파일: `triggers.controller.ts`, `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`, `dto/chat-channel-config.dto.ts`, `dto/trigger-dto-validation.spec.ts`
- 매트릭스 원문 인용(PROJECT.md L169): "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
- 판정: **갭 없음**.
  - **(a) swagger jsdoc** — 이번 diff 자체가 그 작업이다. `triggers.controller.ts` 에 `@ApiUnauthorizedResponse`·`@ApiNotFoundResponse`·`@ApiOkWrappedResponse(ChatChannelRotateBotTokenDto)` 를 갖췄고, `ChatChannelRotateBotTokenDto`/`ChatChannelRotateBotIdentityDto` 에 `@ApiProperty`/`@ApiPropertyOptional` + JSDoc 이 필드 전부(botId·username·teamId·publicKey·rotatedAt·triggerId·chatChannelHealth·botIdentity) 를 덮는다. 같은 changeset 안에서 완결.
  - **(b) user-guide 페이지** — 조건부이고 이번 PR 은 조건이 성립하지 않는다. `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx:129` 와 `02-nodes/triggers.mdx:427-434`(+ `.en.mdx` 대응)가 **이미** `rotate-bot-token` 엔드포인트와 그 응답 형태 `{ data: { triggerId, rotatedAt, chatChannelHealth, botIdentity } }` 를 문서화하고 있다(엔드포인트 자체는 PR-E2 부터 기존). 이번 diff 는:
    - 컨트롤러 반환 타입을 `Awaited<ReturnType<...>>` 대신 명시적 DTO 로 바꾸고 swagger 데코레이터를 채운 것 — **실제 HTTP 응답 바이트는 무변경** (`triggers.service.ts` 의 `rotateBotToken` 반환 로직 자체는 diff 없음, 타입 애노테이션만 `NonNullable<ChatChannelConfig['botIdentity']> | null` 로 정밀화).
    - `dto/chat-channel-config.dto.ts`, `chat-channel-rejection-messages.const.ts` 의 변경은 **주석 문구 정정**(`TriggersService` → `chat-channel-input-rules` 모듈 함수로 귀속 갱신, `#1319`/`#1320` 이동 이력 반영)뿐이고 검증 로직·에러 메시지·필드명 자체는 무변경.
    - `chat-channel-input-rules.ts`/`.spec.ts` 는 에러 봉투 생성 로직을 `throwInvalidField`/`hasField`/`rejectBlockedField` 헬퍼로 추출하는 순수 리팩터 — `details.field`/`details.code`/`message` 문구가 원본과 동일함이 기존 테스트 무편집 통과로 고정돼 있다(사용자가 보는 에러 메시지 불변).
    따라서 "API 노출 변경"이 실질적으로 없어 user-guide 페이지 갱신을 요구할 근거가 없다. (Discord `publicKey` 필드도 이 PR 이전부터 `discord.adapter.ts` 가 실제로 채워 반환하던 필드이며, 이번 diff 는 그 기존 동작을 swagger 스키마에 뒤늦게 반영한 것뿐 — 신규 사용자 가시 필드가 아니다.)

### 비매칭 (근거 확인)
- `new-node` / `node-schema-change`: `codebase/backend/src/nodes/**` 매칭 파일 없음(변경은 전부 `modules/triggers/**`).
- `new-ui-string` / `new-widget-chrome-string`: `codebase/frontend/**`, `codebase/channel-web-chat/**` diff 0건.
- `integration-provider-change`: Slack/Discord/Telegram provider 의 검증 로직(정규식·길이·label 문구)은 값 변경 없이 헬퍼로 재배치만 됨 — 문구·정규식 그대로.
- `new-userguide-section-dir`: `content/docs/*/` 신규 디렉토리 없음.
- `auth-session-flow-change`: `codebase/backend/src/modules/auth/**` 무변경(이 PR 은 `modules/triggers/**`).
- `expression-language-change` / `run-debug-flow-change`: 무관 모듈(`packages/expression-engine/**` 무변경, 실행 엔진·디버그 로깅 무변경).
- `new-warning-code` / `new-error-code`: `codebase/backend/src/nodes/core/error-codes.ts` 무변경. 응답에 쓰이는 `RESOURCE_NOT_FOUND`·`INVALID_BOT_TOKEN`·`VALIDATION_ERROR`·`INVALID_FIELD` 는 전부 기존 공용 코드(신규 발행 아님) — 저장소 전역에서 이미 다수 사용.
- `auth-config-type-enum-change` / `new-cross-cutting-enum` / `new-backend-ui-zod-value` / `new-handler-output-field` / `new-bullmq-queue`: 해당 파일·표면 무변경.
- `spec-major-change`: `spec/**` diff 0줄(`spec_impact: none` 과 plan frontmatter 일치).

## 요약
매트릭스 20개 행 중 glob/semantic 으로 매칭된 것은 `backend-api-change` 1건(controller + dto 변경)뿐이며, target (a) swagger jsdoc 은 이 diff 자체가 그 작업으로 같은 changeset 안에서 완결됐고, target (b) user-guide 페이지는 조건부(API 노출 변경) 자체가 성립하지 않는다 — `rotate-bot-token` 엔드포인트·응답 형태·에러 메시지·provider 검증 문구 모두 기존 user-guide MDX(`telegram.mdx`/`triggers.mdx` 등)가 이미 서술한 그대로이며 이번 PR 은 순수 리팩터(헬퍼 추출) + 기존 동작의 swagger 스키마 보강일 뿐이다. 나머지 19개 trigger 는 노드/TSX/provider/섹션 디렉토리/auth/expression-engine/run-debug/신규 code 어느 것도 건드리지 않아 비매칭. 이전 두 라운드(`16_17_57`, `16_39_18`)의 독립적 user_guide_sync 검토도 동일 결론(NONE)에 도달했으며, 그 사이 조치(DTO 재배치·publicKey 필드 보강·401 응답 추가)는 모두 순수 백엔드 swagger/타입 정합 조치라 이 결론을 바꾸지 않는다.

## 위험도
NONE
