# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]` 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문(라인 160대)을 SoT 로 사용.

## 변경 파일 (실측: `git diff --stat origin/main..HEAD -- codebase/ plan/`, 16개)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts`
- `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts`
- `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts` (신규)
- `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`
- `codebase/backend/src/modules/triggers/triggers.controller.ts`
- `codebase/backend/src/modules/triggers/triggers.service.ts`, `triggers.service.spec.ts`
- `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts`, `.spec.ts`, `fixtures/dto-class-collision/{alpha,beta,decoy}.dto.ts` (신규 가드+fixture)
- `plan/complete/chat-channel-rules-cleanup.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`

`codebase/frontend/**`, `codebase/channel-web-chat/**`, `spec/**` 변경 0건 — `git diff --stat origin/main..HEAD -- codebase/frontend codebase/channel-web-chat spec` 실측 결과 공백.

## trigger 매칭 검토

### 매칭: `backend-api-change` (semantic — `**/*.controller.ts` + `**/dto/**`)
- 변경 파일: `triggers.controller.ts`, `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`(신규), `dto/chat-channel-config.dto.ts`, `dto/trigger-dto-validation.spec.ts`
- 매트릭스 원문 인용(PROJECT.md L169): "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
- 판정: **갭 없음**.
  - target (a) — `triggers.controller.ts` 에 `@ApiNotFoundResponse`+`@ApiOkWrappedResponse(ChatChannelRotateBotTokenDto)` 를 추가했고, 신규 `ChatChannelRotateBotTokenDto`/`ChatChannelRotateBotIdentityDto` 전 필드(`rotatedAt`/`triggerId`/`chatChannelHealth`/`botIdentity`/`botId`/`username`/`teamId`/`publicKey`)에 `@ApiProperty`/`@ApiPropertyOptional` + JSDoc 이 붙어 있다 — 같은 changeset 안에서 완결.
  - target (b) — `TriggersService.rotateBotToken()` 은 이번 diff 이전부터 이미 `{ rotatedAt, triggerId, chatChannelHealth, botIdentity }` 를 반환하고 있었고, `botIdentity` 는 `mergedChannel.botIdentity` 그대로 스프레드돼 Slack `teamId`/Discord `publicKey` 도 이미 wire 응답에 실려 나가던 값이다(`triggers.service.ts` 의 변경분은 `botIdentity` 타입 선언을 `NonNullable<ChatChannelConfig['botIdentity']>` 로 바꿔 **손으로 다시 적던 타입을 참조로 교체**한 것뿐 — 반환 로직 자체는 무변경). 즉 사용자에게 새로 노출되는 API 표면·동작이 없어 user-guide 페이지 갱신을 요구할 근거가 없다. 엔드포인트(`rotateBotToken`) 자체도 이번 PR 신규가 아니다.

### 비매칭 (근거 확인)
- `new-node`/`node-schema-change` (glob `codebase/backend/src/nodes/**`): 변경 파일 16개 중 `nodes/**` 경로 0건 — 전부 `modules/triggers/**` 와 `repo-guards/__tests__/**`.
- `new-ui-string`/`new-widget-chrome-string`: `codebase/frontend/**`, `codebase/channel-web-chat/**` diff 0줄(위 실측). TSX 파일 변경 없음.
- `integration-provider-change`: `chat-channel-input-rules.ts` 전체 diff(`git diff origin/main..HEAD`)를 직접 대조 — `throwInvalidField`/`hasField`/`rejectBlockedField` 헬퍼 추출은 기존 `throw new BadRequestException({...})` 블록을 글자 단위로 함수 호출로 옮긴 것뿐이다. Slack/Discord/Telegram 관련 메시지 문구(`'Slack signing secret 형식이...'`, `'Discord application public key 형식이...'`, hex32/hex64 정규식 `SLACK_SIGNING_SECRET_REGEX`/`DISCORD_PUBLIC_KEY_REGEX`)는 위치만 옮겨졌을 뿐 문자열·정규식·분기 조건 어디도 변경되지 않았다. provider 검증 동작 변화 없음.
- `new-userguide-section-dir`: `content/docs/*/` 신규 디렉토리 없음(frontend 변경 0).
- `auth-session-flow-change`: `codebase/backend/src/modules/auth/**` 무변경(이 PR 은 `modules/triggers/**`·`repo-guards/**` 만).
- `expression-language-change`: `codebase/packages/expression-engine/**` 무변경.
- `run-debug-flow-change`: 실행·디버그 로깅 관련 모듈 무변경.
- `new-warning-code`: warningRules 무변경.
- `new-error-code`: `codebase/backend/src/nodes/core/error-codes.ts` 무변경. 응답에 등장하는 `RESOURCE_NOT_FOUND`(`@ApiNotFoundResponse` 신규 데코레이터)와 `VALIDATION_ERROR`/`INVALID_FIELD` 는 전부 기존 저장소 공용 코드(`ErrorCode.INVALID_FIELD` 는 이 파일이 종전부터 쓰던 값) — 신규 발행 아님.
- `new-cross-cutting-enum`: 신규 `ChatChannelBlockedField` 타입은 `interaction-type-registry.md` 류 cross-cutting enum 이 아니라 이 파일 내부 헬퍼(`rejectBlockedField`)의 인자 타입 좁히기용 로컬 union — 매트릭스가 가리키는 대상과 무관.
- `new-backend-ui-zod-value`/`new-handler-output-field`: zod `ui.*` 값·handler output 필드 변경 없음.
- `spec-major-change`/`userguide-gui-flow-section`/`auth-config-type-enum-change`/`new-bullmq-queue`: 해당 glob·semantic 대상 전부 무변경.
- `spec-defect-found`: `spec/**` 변경 없음(devloper 권한 경계 준수, plan frontmatter 확인 대상 아님 — 이 리뷰어 범위 밖이나 참고).

## 관측된 이상 상태 (도메인 밖 — 보고 의무만 이행)
작업 트리에 `chat-channel-input-rules.ts` 의 커밋되지 않은 수정 1건이 남아 있다(`git diff HEAD` 로 확인): `hasField` 의 `typeof … !== 'undefined'` 판별이 `!!(...)` truthy 판별로 바뀌어 있다. 이는 `RESOLUTION.md`(16_17_57) 의 §뮤테이션 검증 절차와 정확히 일치하는 패턴(같은 파일·같은 헬퍼·같은 치환)이라, 어느 reviewer 가 병렬 검증 중 남긴 미원복 뮤테이션으로 추정된다. 이 변경 자체는 doc-sync 매트릭스 어떤 trigger 에도 해당하지 않아 본 리뷰의 발견사항으로 세지 않지만, 공유 워크트리 오염 이력이 있는 저장소라 그대로 보고한다 — 조치는 testing/security 영역 reviewer 또는 원 작성자 몫.

## 요약
매트릭스 20개 행 중 glob/semantic 매칭은 `backend-api-change` 1건뿐이며, target (a) swagger jsdoc 은 같은 changeset 안에서 완결됐고 target (b) user-guide 페이지는 API 노출 자체가 안 바뀌어(응답 필드는 이 PR 이전부터 서비스가 반환하던 값을 뒤늦게 DTO/swagger 타입으로 선언한 것) 조건 불성립이다. 나머지 19개 trigger(신규 노드/스키마/TSX 문자열/위젯 chrome/provider 동작/신규 섹션 디렉토리/auth/expression-engine/run-debug/신규 warning·error code/cross-cutting enum/zod UI 값/handler output field/spec 대규모 변경/BullMQ 큐)는 전부 비매칭으로 확인했다. 이번 PR 은 `chat-channel-input-rules.{ts,spec.ts}` 내부 헬퍼 추출(문구·정규식·분기 조건 무변경) + swagger 응답 DTO 재배치(`dto/responses/`) + 신규 `dto-class-name-collision` 가드/fixture이며, 사용자 가시 문구·API 표면·i18n 대상 문자열이 전혀 바뀌지 않아 유저 가이드 동반 갱신 관점에서 누락 없음.

## 위험도
NONE
