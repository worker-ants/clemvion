# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 SoT 로 사용.

## 변경 파일 (commit `18b0c6aa6`, HEAD)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts`
- `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts`
- `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token.dto.ts` (신규)
- `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`
- `codebase/backend/src/modules/triggers/triggers.controller.ts`
- `plan/in-progress/chat-channel-rules-cleanup.md`, `review/consistency/**` (본 리뷰어 영역 밖)

frontend 변경 없음 (`codebase/frontend/**` diff 0줄).

## trigger 매칭 검토

### 매칭: `backend-api-change` (semantic, glob `**/*.controller.ts` + `**/dto/**`)
- 변경 파일: `triggers.controller.ts`, `dto/chat-channel-rotate-bot-token.dto.ts`, `dto/chat-channel-config.dto.ts`, `dto/trigger-dto-validation.spec.ts`
- 매트릭스 항목 원문 인용: "controller·DTO 의 swagger jsdoc" / "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
- 판정: **갭 없음**.
  - target ①(swagger jsdoc)은 이번 diff 자체가 그 작업이다 — `triggers.controller.ts` 에 `@ApiNotFoundResponse` + `@ApiOkWrappedResponse(ChatChannelRotateBotTokenDto)` 를 추가했고, 신규 `ChatChannelRotateBotTokenDto`/`ChatChannelBotIdentityDto` 에 `@ApiProperty` + JSDoc 을 갖췄다. 같은 changeset 안에서 완결.
  - target ②(user-guide 페이지)는 **조건부** — "API 노출 변경"이 실제로 있어야 발동한다. `TriggersService.rotateBotToken()` 은 이 diff 이전부터 `{ rotatedAt, triggerId, chatChannelHealth, botIdentity }` 를 그대로 반환하고 있었음을 `triggers.service.ts:985-1123` 에서 실측 확인 — 필드 3종(`rotatedAt`/`triggerId`/`chatChannelHealth`/`botIdentity`)은 **이번 PR 로 신설된 응답 필드가 아니라 기존 서비스 반환값을 뒤늦게 Swagger 타입으로 선언**한 것뿐이다. 커밋 메시지도 "응답 형태는 한 바이트도 바뀌지 않는다"를 264개 무편집 통과 테스트로 뒷받침한다. `rotateBotToken` 엔드포인트 자체도 신규가 아니다(`6a183cc4b`, PR-E2 에서 최초 도입 이력 확인). 즉 사용자가 보는 API 표면·동작에 변화가 없어 user-guide 페이지 갱신을 요구할 근거가 없다.

### 비매칭 (근거 확인)
- `new-node` / `node-schema-change`: `codebase/backend/src/nodes/**` 글롭에 매칭되는 파일 없음(변경은 전부 `modules/triggers/**`, 노드가 아니라 트리거 모듈).
- `new-ui-string`: `codebase/frontend/src/**/*.tsx` 변경 0건.
- `integration-provider-change`: Slack/Discord/Telegram provider 자체의 검증 로직(정규식·길이·label 문구)은 값 변경 없이 위치만 헬퍼로 재배치됨 — `Slack signing secret`/`Discord application public key` 문구·hex32/hex64 정규식 그대로(diff 는 재-들여쓰기만, `sed -n` 대조 완료).
- `new-userguide-section-dir`: `content/docs/*/` 신규 디렉토리 없음.
- `auth-session-flow-change`: `codebase/backend/src/modules/auth/**` 무변경(이 PR 은 `modules/triggers/**`).
- `expression-language-change` / `run-debug-flow-change`: 무관 모듈.
- `new-warning-code` / `new-error-code`: `codebase/backend/src/nodes/core/error-codes.ts` 무변경. `RESOURCE_NOT_FOUND`(신규로 보일 수 있는 `@ApiNotFoundResponse` 설명 문구)는 백엔드 전역에서 이미 44곳에 쓰이는 기존 공용 코드(`grep -rn RESOURCE_NOT_FOUND codebase/backend/src` 44건, `common/filters/http-exception.filter.ts` 등)이며 `INVALID_BOT_TOKEN` 도 PR-E2 이래 기존 코드 — 신규 발행 아님.

## 요약
매트릭스 20개 행 중 glob/semantic 으로 매칭된 것은 `backend-api-change` 1건뿐이며, 실측 결과 target 두 항목 모두 갭이 없다(swagger jsdoc 은 이 diff 자체가 그 작업, user-guide 페이지 갱신은 API 노출 자체가 안 바뀌어 조건 불성립 — `rotateBotToken` 응답 필드는 리팩터 이전부터 서비스가 반환하던 값을 뒤늦게 타입 선언한 것). 나머지 19개 trigger 는 노드/TSX/provider/섹션 디렉토리/auth/expression-engine/run-debug/신규 code 어느 것도 건드리지 않아 비매칭. 이번 PR 은 `chat-channel-input-rules.{ts,spec.ts}` 내부 구조 정리 + 테스트 보강 + 기존 엔드포인트의 swagger 타입 보강이며 사용자 가시 문구·API 표면·i18n 대상 문자열이 전혀 바뀌지 않았다(라벨 스왑 버그는 **테스트만** 강화됐고 프로덕션 라벨 값은 무변경).

## 위험도
NONE
