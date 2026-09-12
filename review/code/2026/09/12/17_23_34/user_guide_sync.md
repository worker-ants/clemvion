# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (rows 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 SoT 로 사용했다.

## 변경 파일 분류

리뷰 대상 26개 파일 중 doc-sync 매트릭스가 다루는 `codebase/**` 파일은 다음 8개다 (나머지는
`repo-guards/__tests__/**` 하네스 테스트·fixture, `plan/**`·`review/**` 프로세스 산출물이라
매트릭스 target 이 아니다):

1. `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts`
2. `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`
3. `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts`
4. `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
5. `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts` (신규)
6. `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`
7. `codebase/backend/src/modules/triggers/triggers.controller.ts`
8. `codebase/backend/src/modules/triggers/triggers.service.ts`

## 매칭 결과

- **`new-node` / `node-schema-change`** (trigger glob `codebase/backend/src/nodes/**`) — 매칭 없음. 변경 위치는 `src/modules/triggers/`(트리거 도메인 로직)이지 `src/nodes/`(노드 정의)가 아니다.
- **`new-ui-string`** (trigger glob `codebase/frontend/src/**/*.tsx`) — 매칭 없음. frontend 파일 변경 0건.
- **`integration-provider-change`** (semantic) — 문면상 Slack/Discord/Telegram 을 언급하지만, 실제 diff 를 `git diff c9bc5dca6..HEAD -- .../chat-channel-input-rules.ts` 로 직접 열어 대조한 결과 **에러 메시지 문자열(`Slack signing secret`·`Discord application public key` 등)은 단 하나도 바뀌지 않았다** — `throwInvalidField`/`hasField`/`rejectBlockedField` 헬퍼로 기존 11곳의 `BadRequestException` 인라인 블록을 추출한 순수 리팩터다. `chat-channel-rejection-messages.const.ts`·`chat-channel-config.dto.ts` 변경도 "이 검증을 어느 파일이 수행하는가"를 가리키는 주석 문면 수정뿐(`TriggersService` → `chat-channel-input-rules` 로 귀속 정정, `#1319`/`#1320` 후속). provider 동작·요구사항 자체는 불변이라 provider 신규/변경에 해당하지 않는다.
- **`backend-api-change`** (semantic, glob `*.controller.ts` + `dto/**`) — **매칭**. `triggers.controller.ts`(`@ApiNotFoundResponse`/`@ApiOkWrappedResponse`/`@ApiUnauthorizedResponse` 추가, 반환 타입을 DTO 화) + 신규 응답 DTO(`chat-channel-rotate-bot-token-response.dto.ts`) + `chat-channel-config.dto.ts`(JSDoc 문면 정정)가 이 trigger 에 해당한다. 다만:
  - target (a) "controller·DTO 의 swagger jsdoc" — **같은 diff 안에서 이미 충족**(이번 PR 자체가 swagger 정합화 작업). 누락 아님.
  - target (b) "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" — `rotateBotToken` 엔드포인트는 **신규 API 가 아니다**(`triggers.service.ts` 의 로직·반환 필드는 이번 diff 로 바뀌지 않았고, 컨트롤러 반환 타입 애노테이션과 신규 swagger 데코레이터만 추가됨). 사용자 가이드는 이미 이 엔드포인트를 문서화하고 있다 — `codebase/frontend/src/content/docs/06-integrations-and-config/{telegram,discord,slack}.{mdx,en.mdx}` 의 "Rotating the bot token" 절이 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 과 응답 형태 `{ data: { triggerId, rotatedAt, chatChannelHealth, botIdentity } }` 를 이미 기술한다(예: `telegram.en.mdx:116`). 이번에 DTO 에 추가된 `botIdentity.publicKey` 필드도 **신규 동작이 아니라 기존 Discord adapter 가 이미 채워 온 값**을 문서(swagger)에 뒤늦게 반영한 것뿐이라, 유저 가이드 MDX 는 이미 `botIdentity` 를 뭉뚱그려 기술 중이고 하위 필드까지 나열하지 않으므로 stale 상태로 전환되지 않는다. **동반 갱신 누락으로 보지 않는다** — 사용자에게 노출되는 신규 개념·필드·동작이 없다.
- **`new-warning-code` / `new-error-code`** — 매칭 없음. `error-codes.ts`, warningRules 파일 미변경. 기존 `ErrorCode.INVALID_FIELD` 사용은 리팩터 이전과 동일.
- **`auth-session-flow-change`** (trigger glob `codebase/backend/src/modules/auth/**`) — 매칭 없음.
- **`expression-language-change`** (trigger glob `codebase/packages/expression-engine/**`) — 매칭 없음.
- **`run-debug-flow-change`** — 매칭 없음(실행/디버그 로깅 미변경).
- **`new-userguide-section-dir`** — 매칭 없음(신규 `content/docs/<NN>-*/` 디렉토리 없음).

## 발견사항

없음. 매칭된 유일한 trigger(`backend-api-change`)는 target 을 같은 diff 안에서 이미 충족했거나(swagger jsdoc), 사용자 가이드가 이미 다루는 기존 동작이라 갱신 대상이 아니다(신규 필드·신규 캡션 없음).

## 요약

매트릭스 20개 행 중 `backend-api-change` 1건만 파일 경로상 매칭됐고, 실측(diff 직접 대조 + 기존 06-integrations-and-config 문서 grep) 결과 그 target 은 이미 충족되어 있어 동반 갱신 누락이 없다. 나머지 19개 행(신규 노드·schema·UI 문자열·통합 provider·신규 섹션·auth·표현식·실행 흐름·warning/error code 등)은 이번 변경(트리거 도메인 검증 로직 리팩터 + 응답 DTO swagger 문서화 + repo-guard 테스트)과 매칭되지 않는다. 이 PR 은 사용자 가시 문자열·동작·필드를 하나도 바꾸지 않는 순수 리팩터/문서 정합화라, 유저 가이드 동반 갱신 관점에서 조치할 항목이 없다.

## 위험도

NONE
