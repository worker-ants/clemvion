# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (rows 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (127~197행) 을 Read 함.

## 변경 파일 식별

`git diff --name-only origin/main...HEAD` 로 보강한 실제 변경 set (100 files, review/consistency 산출물 다수 포함) 중 코드/문서 성격이 있는 항목만 추리면:

- `CHANGELOG.md`
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/websocket/websocket.service.ts` (+ `.spec.ts`)
- `codebase/backend/src/shared/utils/strip-external-only-fields.ts` (+ `.spec.ts`)
- `plan/in-progress/eia-terminal-payload.md`, `plan/in-progress/spec-draft-eia-62-waiting-payload.md`, `plan/in-progress/spec-draft-eia-notification-payload-contract.md`
- `review/code/**`, `review/consistency/**` (리뷰/일관성 산출물 — 매트릭스 대상 아님)

`codebase/frontend/**`, `codebase/channel-web-chat/**`, `codebase/backend/src/nodes/**`, `codebase/backend/src/modules/auth/**`, `codebase/packages/expression-engine/**`, `spec/**` 는 이번 변경 set 에 **전혀 없음** — frontend 파일이 단 하나도 diff 에 포함되지 않았다.

## trigger 매칭 검토

1. **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 미매칭. 노드 디렉토리 무변경.
2. **new-ui-string** (`*.tsx` 신규 한국어 리터럴) — 미매칭. tsx 파일 무변경.
3. **integration-provider-change** — 미매칭. provider 코드 무변경.
4. **new-userguide-section-dir** — 미매칭. `content/docs/*/` 무변경.
5. **backend-api-change** (`*.controller.ts`, `dto/**`) — glob 미매칭. 변경은 `interaction.controller.ts` 가 아니라 그 아래 `interaction.service.ts` 의 `getStatus` 응답 조립 로직뿐. `getStatus` 는 `ExecutionStatusDto`(`@ApiOkWrappedResponse`)로 이미 swagger 스키마가 잡혀 있고, 그 DTO 는 애초 `llmCalls`/`turnDebug` 를 필드로 선언한 적이 없다(grep 결과 무매치) — 즉 이번 변경은 **문서화된 적 없는 필드가 새고 있던 것을 제거**하는 수정이라 swagger jsdoc 갱신 대상이 아니다. 신규 노출 필드 추가도 아님.
6. **new-warning-code / new-error-code** — 미매칭. `warningRules`/`error-codes.ts` 무변경.
7. **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — 미매칭. 변경 모듈은 `external-interaction`/`websocket`/`shared/utils` 이지 `modules/auth` 가 아니다. 의미상으로도 인증/세션 로직 자체(로그인·토큰 발급·권한 판정)는 건드리지 않고, 이미 발급된 `iext_*`/`itk_*` 토큰으로 접근 가능한 **응답 payload 에서 debug-only 필드를 제거**하는 정보 노출 수정이라 "인증·권한·세션 흐름 변경" 의미 매칭도 성립하지 않음.
8. **expression-language-change** — 미매칭. `packages/expression-engine/**` 무변경.
9. **run-debug-flow-change** (`05-run-and-debug/`) — semantic 이라 신중히 검토함. `docs/05-run-and-debug/*.mdx` 전체(`run-results`, `running-a-workflow`, `error-handling`, `validation-errors`, `version-history`)를 grep 했으나 `llmCalls`/`turnDebug`/외부 payload 관련 서술이 전혀 없다. 이번 변경이 명시적으로 보존하는 대상은 **내부 에디터 WS 채널**(`execution:{executionId}`) — "내부 WS(에디터) 채널은 종전대로 full payload 를 받는다" 고 diff 주석·CHANGELOG 가 모두 확인. 즉 사용자가 앱 내에서 실행 결과/디버그를 보는 흐름(05-run-and-debug 가 다루는 영역)은 동작 변화가 없고, 바뀐 것은 **외부 SSE/webhook/chat-channel/REST 스냅샷**으로 나가는 debug 필드 노출 여부뿐이다. 05-run-and-debug 는 이 외부 표면을 다루지 않으므로 갱신 대상 아님.
10. **new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field** — 미매칭. 신규 enum 값·zod ui 값·output.result.* 신규 키 없음. 오히려 반대로 **필드를 제거**하는 방향의 수정.
11. **AuthConfig type enum 변경 / new-bullmq-queue / env-runtime-change / spec-major-change** — 전부 미매칭.

## 결론

이번 변경 set 은 external-interaction REST 스냅샷(`InteractionService.getStatus`)과 WebSocket fanout(`WebsocketService`)에서 `llmCalls`(raw LLM 요청/응답) 같은 debug-only 필드가 중첩 위치까지 새고 있던 보안 결함을 막는 **backend 내부 정보노출 수정**이다. frontend 코드가 diff 에 단 하나도 없고, 노드/스키마/UI 문자열/통합 provider/신규 섹션/인증 흐름/표현식 언어/warning·error 코드/신규 enum·필드 어느 것도 추가·변경되지 않았다 — 오히려 기존에 새던 필드를 제거하는 방향이라 사용자에게 노출되는 문서화된 계약 자체가 변경되지 않았다(swagger DTO 도 애초 그 필드를 선언한 적이 없음). doc-sync-matrix 20개 행 중 매칭되는 trigger가 없어 동반 갱신 누락 항목도 없다.

## 요약

매트릭스 20개 행 전수 검토 결과 매칭 trigger 0건 — 이번 diff 는 순수 backend 보안 수정(REST/WS fanout debug 필드 depth-무관 strip)이며 frontend 코드·docs MDX·i18n dict·backend-labels 어느 것도 대상 파일 목록에 없어 동반 갱신 누락도 0건이다. 판정: **해당 없음**.

## 위험도

NONE
