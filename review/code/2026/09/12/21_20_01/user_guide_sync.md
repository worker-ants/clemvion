# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (rows 18개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (155~284행) 을 Read 했다. 본 리뷰는 이 배치의 **4라운드째** `/ai-review` 다 (`plan/in-progress/trigger-uuid-and-guide-error-codes.md` 체크리스트 확인 — 1~3라운드가 이미 CRITICAL 0 · WARNING 다수를 처리했고, 라운드 3의 WARNING #1 이 정확히 본 리뷰어의 관점("신규 400 VALIDATION_ERROR 가 가이드 4곳에 미반영")이었다).

## 변경 set 요약 (17파일)

- 백엔드: `triggers.controller.ts`(+`ParseUUIDPipe`+Swagger), `auth.controller.ts`(Swagger `format:'uuid'` 만), 테스트/가드 신규 3개, `triggers.controller.spec.ts`
- 프런트 docs: `02-nodes/triggers{,.en}.mdx`, `06-integrations-and-config/{mcp-servers,telegram}{,.en}.mdx`
- 프런트 i18n: `lib/i18n/backend-labels.ts` + 그 테스트
- plan: 트래커 갱신 2건 + 신규 plan 1건
- `CHANGELOG.md`

## trigger 매칭 및 검증

### 1. `backend-api-change` (semantic) — `triggers.controller.ts`

`rotateBotToken` 의 `:id` 에 `ParseUUIDPipe` 를 추가하며 500→400 관측 가능 변경이 생겼다(`VALIDATION_ERROR`). 매트릭스 target: "(a) swagger jsdoc (b) user-guide 페이지".

- (a) 확인됨 — `@ApiParam({format:'uuid'})` 추가 + `@ApiBadRequestResponse` 문면에 `VALIDATION_ERROR` 추가.
- (b) 확인됨 — 같은 변경 set 안에 4개 MDX 가 전부 갱신되어 있다:
  - `02-nodes/triggers.mdx` / `.en.mdx` — Callout 의 에러 코드 목록에서 `TRIGGER_NOT_FOUND` 를 빼고 (`404 RESOURCE_NOT_FOUND` / `400 VALIDATION_ERROR`) 문장을 추가
  - `06-integrations-and-config/telegram.mdx` / `.en.mdx` — §6 에러 라인에 동일 내용 반영

**동반 갱신 누락 없음.**

### 2. `auth-session-flow-change` (semantic, glob `codebase/backend/src/modules/auth/**`) — `auth.controller.ts`

glob 상으로는 매칭되지만, diff 는 `switchWorkspace` 의 `@ApiParam` 에 `format: 'uuid'` 한 줄을 추가한 것뿐이다 — `ParseUUIDPipe` 는 이미 있었고(diff 에 파이프 변경 없음), 런타임 흐름·권한 로직·세션 로직은 무변이다. 목적도 diff 주석에 명시("`param-uuid-pipe` 가드의 두 번째 축이 예외 목록을 갖게 될 뻔했다 — 목록 대신 자리를 고친다")되어 있어 Swagger 스키마 보강일 뿐이다.

판단: **매트릭스가 요구하는 "인증·권한·세션 흐름 변경" 이 아니다** — `07-workspace-and-team/` 페이지·e2e 동반 갱신 불요. (INFO 로 기록 — glob 매칭은 됐으나 semantic 판정에서 제외)

### 3. 코드 축 정합성 정정 — `backend-labels.ts` / `backend-labels.test.ts` / MDX 4곳

`TRIGGER_NOT_FOUND` 를 "chat-channel API 코드"로 잘못 분류하던 6곳(문서 4 + 코드 2)을 전수로 찾아 같은 배치에서 정정했다. `ERROR_KO` 의 `TRIGGER_NOT_FOUND` 매핑 자체는 기존에 존재했고(신규 코드 발행 아님), 이번 변경은 **주석 귀속만** 정정한 것 — 매핑 누락이 아니므로 CRITICAL 대상 아님.

직접 검증: 리포지토리에서 `MCP_ALLOW_INSECURE_URL` 가 실제 백엔드 env var 이름임을 grep 으로 확인했다(`mcp.config.ts`·`production-guards.ts`·`mcp-tool-provider.ts` 전부 이 이름 사용). `mcp-servers.mdx`/`.en.mdx` 가 종전에 적던 `MCP_INSECURE_URL_ALLOWED` 는 존재하지 않는 이름이었고, 이번 diff 가 두 파일 모두 올바른 이름으로 고쳤다 — **양쪽 로케일 다 반영됨, 누락 없음.**

### 4. 매칭되지 않는 trigger들 (확인만)

- `new-node` / `node-schema-change` (`codebase/backend/src/nodes/**`) — 이번 diff 에 해당 경로 파일 없음 → 무관
- `new-ui-string` (TSX) — TSX 변경 없음 → 무관
- `new-userguide-section-dir` — 신규 섹션 디렉토리 없음 → 무관
- `expression-language-change` / `run-debug-flow-change` — 무관
- `new-warning-code` / `new-error-code`(`error-codes.ts` ErrorCode enum) — 이번 diff 는 기존 HTTP 레벨 코드(`VALIDATION_ERROR`/`RESOURCE_NOT_FOUND`)를 다른 엔드포인트에 노출시킨 것이지 신규 코드 발행이 아님 → 무관

### 5. spec/ 대상 항목 (본 리뷰어 스코프 밖, 참고용)

`plan/in-progress/trigger-uuid-and-guide-error-codes.md` 가 이미 등재한 두 planner 항목(`15-chat-channel.md §5.4` 표에 신규 400 행 없음, `swagger.md §5-4` 런타임 축 미기재)은 **spec/** 대상이라 developer 가 직접 못 고치는 것이 맞고(자기-반증형 소정정 조건 1 미충족 — developer 가 쓴 문장이 아님), planner 위임으로 올바르게 분리되어 있다. `codebase/frontend/src/content/docs/**` 범위가 아니므로 본 매트릭스의 "docs MDX" 대상은 아니다.

## 종합 판단

이 배치는 doc-sync 매트릭스 관점에서 이미 3라운드에 걸쳐 자체적으로 촘촘히 검증됐고(3라운드 WARNING #1 이 정확히 이 리뷰의 핵심 우려였다), 본 4라운드 독립 검토에서도 추가로 발견된 누락이 없다. `backend-api-change` trigger 1건이 매칭되고 완전히 충족됐으며, `auth-session-flow-change` 는 glob 매칭됐지만 semantic 판정상 실제 흐름 변경이 아니라 배제했다. i18n dict·신규 노드·신규 섹션 등 나머지 매트릭스 행은 이번 diff 와 무관하다.

## 위험도

NONE
