# User Guide Sync 리뷰 — rotate-bot-token-body

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` `rows[]` (22행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 표(160~183행) + §자주 누락되는 항목(196~212행)을 Read 했다.

## 변경 파일 식별

prompt 에 포함된 실제 코드/문서 변경(리뷰 산출물·plan 파일 제외):

- `CHANGELOG.md` (Unreleased 항목 추가)
- `codebase/backend/src/modules/executions/dto/continue-execution.dto.ts` (신규, OpenAPI 전용 DTO)
- `codebase/backend/src/modules/executions/executions-continue-body.spec.ts` (신규, 캐너리)
- `codebase/backend/src/modules/executions/executions.controller.ts` (`@ApiBody` 추가)
- `codebase/backend/src/modules/hooks/hooks-webhook-body.spec.ts` (신규, 캐너리)
- `codebase/backend/src/modules/hooks/hooks.controller.ts` (`@ApiBody`/`@ApiConsumes` 추가)
- `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts` (신규, OpenAPI 전용 DTO)
- `codebase/backend/src/modules/triggers/triggers-rotate-bot-token-body.spec.ts` (신규, 캐너리)
- `codebase/backend/src/modules/triggers/triggers.controller.ts` (`@ApiBody` 추가)
- `codebase/backend/src/shared/testing/swagger-probe.{ts,spec.ts}` (테스트 헬퍼)
- `plan/in-progress/rotate-bot-token-body.md`

노드(`codebase/backend/src/nodes/**`), TSX, `channel-web-chat`, `auth/**`, `expression-engine/**`, `content/docs/<NN>-*/` 신규 디렉토리, `error-codes.ts`, `system-status.constants.ts` — 이번 변경 set 에 없음. 따라서 매트릭스 22행 중 다음 행만 후보로 남는다: **`backend-api-change`**(`codebase/backend/src/**/*.controller.ts` + `dto/**`, semantic match).

## trigger 매칭 및 검증

`backend-api-change` 행의 target 은 (a) controller·DTO 의 swagger jsdoc, (b) API 노출 변경이 사용자 안내에 영향이면 관련 user-guide 페이지. PROJECT.md §자주 누락 "API 추가 vs swagger jsdoc 누락"(210행)도 동일 항목을 가리킨다.

- **(a) swagger jsdoc**: 이 PR 의 본질이 정확히 이것이다 — 세 라우트(`rotate-bot-token` / `continue` / `receiveWebhook`)에 `@ApiBody`(+`@ApiConsumes`)를 붙였다. **같은 changeset 안에서 충족**됨 — 갭 없음.
- **(b) user-guide 페이지 영향 여부**: 실측으로 세 엔드포인트를 각각 확인했다.
  - `rotate-bot-token` — `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` 427~439행("Bot Token 회전 (single-path)" 절)에 이미 `curl -X POST .../rotate-bot-token -d '{ "newBotToken": "<신규 token>" }'` 예시와 에러 코드 표(463행, `INVALID_BOT_TOKEN` 포함)가 있다. 이번 PR 은 런타임 계약을 바꾸지 않는다(plan 자체가 "런타임은 한 줄도 바꾸지 않는다"로 명시, 캐너리로 회귀 고정) — 기존 가이드 서술과 코드 실측이 이미 일치해 갱신할 stale 내용이 없다.
  - `receiveWebhook` — 같은 `triggers.mdx` 96행에 "`Content-Type`은 `application/json` 또는 `application/x-www-form-urlencoded`"가 이미 명시돼 있다. 신규 `@ApiConsumes('application/json', 'application/x-www-form-urlencoded')` 는 이 기존 서술과 동일 — 갱신 불필요.
  - `continueExecution`(`POST /executions/:id/continue`) — 이 엔드포인트를 사용자가 직접 curl 로 호출하는 것을 전제로 문서화한 절은 `05-run-and-debug/`·`02-nodes/` 어디에도 없다(폼 제출은 UI 플로우로 문서화되고, `ai.mdx` 121행 등은 노드 동작 서술이지 raw API 호출 안내가 아니다). 이 DTO 도 "OpenAPI 스키마 전용"이며 폼 필드 자체의 검증 방식(엔진이 대기 중인 폼 노드 정의로 검증)은 그대로다 — 신규로 노출되는 사용자 가시 계약이 없다.

세 라우트 모두 **런타임 불변 + 기존 가이드가 이미 정확** 상태로 실측 확인됐다. i18n dict(`{ko,en}`), `backend-labels.ts`(WARNING_KO/ERROR_KO/LABEL_KO 등), `locale.ts` 의 `SECTION_LABELS_BY_LOCALE`, `04-expression-language/*` 등 다른 target 은 이번 변경과 아예 무관 — 신규 에러/경고 코드 발행 없음(`INVALID_BOT_TOKEN`/`VALIDATION_ERROR` 는 기존 코드 재사용), 신규 UI 문자열(TSX) 없음, 신규 노드/섹션/통합 없음.

## 발견사항

없음. `backend-api-change` trigger 가 파일 glob 상 매칭되지만, target (a)는 같은 changeset 안에서 충족되고 target (b)는 세 엔드포인트 모두 실측으로 기존 user-guide 내용이 이미 정확함을 확인해 동반 갱신이 필요하지 않다.

## 요약

매트릭스 22개 행 중 `backend-api-change`(semantic) 1개 행만 파일 패턴상 후보로 매칭됐고, 실측 검증 결과 동반 갱신 누락은 0건이다(swagger jsdoc 은 이 PR 자체가 추가한 것이고, user-guide 페이지는 세 라우트 모두 기존 서술이 이미 정확해 갱신 대상이 없음을 `triggers.mdx` 96·427~439·463행 대조로 확인). 노드/i18n/섹션/인증/표현식/실행-디버깅/warning·error 코드 등 나머지 trigger 는 이번 변경 set 과 전혀 무관하다.

## 위험도

NONE
