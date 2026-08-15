# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 방법론

1. `.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문(§133-155)을 SSOT 로 적재.
2. 변경 파일 목록은 prompt 의 82개 항목 헤더(`### 파일 N:`)를 전수 추출한 뒤 `git diff --name-only origin/main...HEAD` 로 교차 검증 — 완전히 일치함(82/82). 브랜치는 `claude/eia-terminal-duration-outputs`.
3. 실제 코드 변경은 `codebase/backend/**` 10개 파일(execution-engine·chat-channel·shared/utils/terminal-duration 신규 2개)뿐이고, 나머지는 `CHANGELOG.md`, `plan/in-progress/*.md`(3개), `review/code/**`·`review/consistency/**` 산출물(선행 라운드 아티팩트), `spec/**.md`(3개) — **`codebase/frontend/**`·`codebase/channel-web-chat/**` 파일은 이 changeset 에 단 하나도 없음**(헤더 전수 grep 으로 확인).
4. 매트릭스 21개 행을 전수 순회하며 글로브·의미 매칭을 판정. 근접 후보(`run-debug-flow-change`, `backend-api-change`)는 실제 문서(`05-run-and-debug/run-results.mdx`, `02-nodes/triggers.mdx`)를 `Read`/`grep` 으로 직접 열어 실측했다.
5. 동일 changeset 에 대한 선행 두 라운드(`review/code/2026/08/15/10_18_38/user_guide_sync.md`, `review/code/2026/08/15/10_34_51/user_guide_sync.md`)가 이미 존재해 교차 대조했다 — 독립 판정 결과가 일치한다(아래 "선행 라운드와의 교차 검증" 참고).

## 변경 내용 요약 (이 reviewer 관점)

EIA(External Interaction API) 종결 이벤트(`execution.completed`/`failed`/`cancelled`) payload 에 `durationMs` 필드(밀리초, 알 수 없으면 `null`)를 싣는 배관 작업. `codebase/backend/src/shared/utils/terminal-duration.ts` 신설(`resolveTerminalDurationMs`/`toFiniteNumber`/SQL 상수), `execution-engine.service.ts`·`retry-turn.service.ts`·`chat-channel/{dispatcher,types}.ts` 에 배선. 전부 backend 내부 로직 + 외부 webhook/SSE/WS wire 계약 변경이며, frontend 코드·문서·i18n 자산은 일절 건드리지 않는다.

## 매트릭스 21개 행 순회 결과

**글로브 매칭 트리거 (9개) — 전부 미스매치**: `new-node`(`nodes/**` 변경 0), `node-schema-change`(동일), `new-widget-chrome-string`(`channel-web-chat/**` 변경 0), `new-userguide-section-dir`(`content/docs/*/` 변경 0), `new-bullmq-queue`(`system-status.constants.ts` 변경 0), `new-error-code`(`error-codes.ts` 변경 0), `spec-major-change`(glob 은 `spec/2-*`~`spec/5-*`+`conventions/**` — 이번 changeset 의 `spec/3-workflow-editor/3-execution.md`·`spec/5-system/14-external-interaction-api.md`·`spec/conventions/chat-channel-adapter.md` 3개가 **글로브상으로는 매칭**되나, 이 행의 target 은 frontmatter `code:`/`status:`/`pending_plans:` 정합이며 user-guide MDX/i18n/backend-labels 가 아니다 — consistency-checker 영역. 본 changeset 에 동봉된 `review/consistency/2026/08/15/09_58_31/*`(BLOCK: NO)가 이미 이 갱신을 다뤘고 `plan/in-progress/eia-terminal-payload.md` §재판정④ "spec 동반 변경(전수)" 표가 완료를 명시한다 — 이 reviewer 영역 밖이므로 CRITICAL/WARNING 미등재), `userguide-gui-flow-section`(`02-nodes/**.mdx`·`06-integrations-and-config/**.mdx` 변경 0).

**의미 매칭 트리거 (12개) — 전부 미스매치**: `new-ui-string`(TSX 변경 0), `integration-provider-change`(provider 변경 0), `backend-api-change`(glob 은 `*.controller.ts`/`dto/**` — EIA 이벤트 타입은 둘 다 아님, 미매칭), `new-warning-code`(`warningRules` 변경 0), `new-cross-cutting-enum`(`durationMs` 는 enum 값이 아니라 payload 필드), `new-backend-ui-zod-value`(`ui.label/hint/group` 변경 0), `new-handler-output-field`(§아래 상세), `auth-session-flow-change`/`auth-config-type-enum-change`(`modules/auth/**` 변경 0), `expression-language-change`(`packages/expression-engine/**` 변경 0), `run-debug-flow-change`(§아래 상세), `env-runtime-change`(런타임/기동 변경 없음), `spec-defect-found`(해당 없음).

### `run-debug-flow-change` 실측 (가장 근접한 후보)

`codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:55` 는 이미 `"실행 시간", type: "Duration", "142ms, 1.2s 같은 소요 시간"` 을 문서화하고 있다. 이 UI 노출 값은 **이번 PR 이전부터** `execution.durationMs` 엔티티 컬럼으로 계산·표시되던 기존 기능이다. 이번 diff 는 (a) 그 계산 로직을 `resolveTerminalDurationMs` 헬퍼로 통합하고 (b) 조건 블록 밖 hoist 버그를 고치고 (c) 엔티티 미로드 5경로에 SQL 계산을 추가하고 (d) **외부** webhook/SSE/WS(EIA) payload 에 `durationMs` 필드를 신규로 싣는 것 — 에디터 UI 의 사용자 가시 동작·표시값은 변경 전후 동일하다. `05-run-and-debug/` 갱신 대상 아님.

### `new-handler-output-field` 검토

이 trigger 는 `output.result.*`(핸들러 결과 내부 신규 키, 히스토리/hydration surface 대상)를 겨냥한다. `durationMs` 는 `EiaCompletedEvent` 등에서 `result` 의 **형제 필드**이지(`result: { outputs?: unknown }; durationMs?: number | null;` — 같은 레벨) `result.outputs` 내부 키가 아니며, `spec/conventions/data-hydration-surfaces.md` 가 다루는 `parseHistoryMessages`/`threadTurnsToConversationItems`/`applyExecutionSnapshot` 류 실행 내역 표시 필드도 아니다. 매칭 없음.

### `02-nodes/triggers.mdx` 필드-단위 payload 예시 부재 확인

`grep '```jsonc'` 로 이 페이지의 두 코드 블록을 확인한 결과 각각 트리거 **생성 요청**(`POST /api/triggers`)과 **202 즉시 응답**(`executionId`/`status: pending`) 예시이지, 종결 이벤트(`execution.completed` 등) payload 자체의 필드 열거가 아니다. 즉 이 페이지는 애초에 필드 단위로 payload 를 문서화하지 않으므로, `durationMs` 신규 필드로 인해 "이미 문서화된 목록이 stale 해진" 지점이 없다 — 매트릭스 미매칭이지 발견 누락이 아니다.

## 선행 라운드와의 교차 검증

동일 changeset 에 대한 `10_18_38`·`10_34_51` 두 라운드 산출물이 이번 changeset 안에 포함돼 있어 대조했다:

- `10_18_38`: 위험도 NONE, CRITICAL/WARNING 0건, "`run-debug-flow-change`" 실측·"`new-handler-output-field`" 배제 근거가 본 라운드와 동일한 결론.
- `10_34_51`: 위험도 NONE, `backend-api-change` 후보를 INFO 1건으로 등재했다가 "필드 단위 payload 를 다루지 않는 페이지"라는 선례로 조치 불필요 판정.

세 라운드 모두 독립적으로 동일한 결론(매칭 트리거 없음, 위험도 NONE)에 도달했다.

## 발견사항

없음. 매칭되는 trigger 자체가 없어 동반 갱신 누락을 판정할 대상이 없다.

## 요약

매트릭스 21개 행(glob 9 + semantic 12) 전수를 이번 changeset(backend `execution-engine`/`chat-channel`/`shared/utils` 10개 파일 + `CHANGELOG.md` + `plan/*.md` 3개 + `spec/*.md` 3개 + 선행 리뷰 아티팩트, **frontend 변경 0건**)에 대입한 결과 확정 매칭 0건이다. 가장 근접했던 두 후보(`run-debug-flow-change`→`05-run-and-debug/`, `new-handler-output-field`)는 실제 문서·타입 구조를 직접 열어 실측한 결과 모두 대상에서 배제됐고, `spec-major-change` 는 글로브상 매칭되지만 target 이 이 reviewer 영역(user-guide MDX/i18n/backend-labels) 밖이라 CRITICAL/WARNING 으로 세우지 않았다. 동일 changeset 을 다룬 선행 두 라운드와도 결론이 일치한다. 유저 가이드(MDX)·i18n dict·backend-labels·locale.ts 동반 갱신 누락은 0건이다.

## 위험도

NONE
