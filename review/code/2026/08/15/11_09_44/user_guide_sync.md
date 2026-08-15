STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json`(`rows[]`, 21개 행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(127~197행) 본문을 함께 Read 했다.

## 변경 파일 컨텍스트

prompt 헤더(`### 파일 N:`) 105개를 전수 추출했다. 실제 프로덕션 코드 변경은 다음 10개 backend 파일뿐이다:

- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` (+`.spec.ts`)
- `codebase/backend/src/modules/chat-channel/types.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (+`.spec.ts`)
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (+`.spec.ts`)
- `codebase/backend/src/shared/utils/terminal-duration.ts` (+`.spec.ts`, 신규)

나머지는 `CHANGELOG.md`, `plan/in-progress/*.md` 3건, `spec/{3-workflow-editor/3-execution,5-system/14-external-interaction-api}.md` + `spec/conventions/chat-channel-adapter.md`, 그리고 이전 리뷰 라운드(`review/code/2026/08/15/{09_58_24,10_18_38,10_34_51,10_52_08}/**`, `review/consistency/2026/08/15/{08_45_50,09_00_27,09_58_31,10_52_07}/**`)의 산출물이다.

`grep`으로 확인한 결과 이 changeset 에 **`codebase/frontend/**` · `codebase/channel-web-chat/**` 파일이 단 하나도 없다.** 매트릭스가 가리키는 모든 target(`content/docs/**`, `i18n/dict/**`, `backend-labels.ts`, `docs/locale.ts`, `README.md`)은 이 두 트리 아래에 있으므로, 이번 리뷰의 핵심 질문은 "글로브가 아니라 semantic 매칭으로 갱신이 요구되는가"이다.

## trigger 매칭 검토 (21개 행 전수)

**글로브 매칭 9개 — 전부 미스매치**: `new-node`/`node-schema-change`(`backend/src/nodes/**` 변경 0) · `new-widget-chrome-string`(`channel-web-chat/**` 변경 0) · `new-userguide-section-dir`(`content/docs/*/` 신규 디렉토리 0) · `new-bullmq-queue`(`system-status.constants.ts` 변경 0) · `new-error-code`(`error-codes.ts` 변경 0) · `spec-major-change`(글로브상 `spec/5-system/14-external-interaction-api.md` 등 3개가 매칭되나 target 은 frontmatter `code:`/`status:`/`pending_plans:` 정합 — consistency-checker 영역이지 user-guide MDX/i18n/backend-labels 가 아님) · `userguide-gui-flow-section`(`02-nodes/**.mdx`·`06-integrations-and-config/**.mdx` 변경 0).

**semantic 12개 — 전부 미스매치**: `new-ui-string`/`new-widget-chrome-string`(TSX 변경 0) · `integration-provider-change`(provider 변경 0) · `backend-api-change`(glob 은 `*.controller.ts`/`dto/**` — EIA 이벤트 타입은 controller/DTO 아님) · `new-warning-code`(`warningRules` 변경 0) · `new-cross-cutting-enum`(`durationMs` 는 enum 값이 아니라 payload 필드) · `new-backend-ui-zod-value`(zod `ui.label/hint/group` 변경 0) · `auth-session-flow-change`/`auth-config-type-enum-change`(`modules/auth/**` 변경 0) · `expression-language-change`(`packages/expression-engine/**` 변경 0) · `env-runtime-change`(런타임/기동 변경 없음) · `spec-defect-found`(해당 없음).

### 근접 후보 1 — `new-handler-output-field` (신규 handler output field)

이 trigger 는 `output.result.*`(노드 핸들러 결과 내부 신규 키, 실행 내역 hydration 대상)를 겨냥한다. `durationMs` 는 `EiaCompletedEvent` 타입에서 `result: { outputs?: unknown }` 의 **형제 필드**다 (`codebase/backend/src/modules/chat-channel/types.ts:391-397` 부근) — `result.outputs` 내부 키가 아니라 execution 봉투(envelope) 레벨 필드다. `spec/conventions/data-hydration-surfaces.md` 가 다루는 `parseHistoryMessages`/`threadTurnsToConversationItems`/`applyExecutionSnapshot` 류 노드별 실행 내역 표시 필드도 아니다. **매칭 없음.**

### 근접 후보 2 — `run-debug-flow-change` (실행·디버깅 흐름 변경)

`codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:55`(+`.en.mdx:44`)는 이미 `"실행 시간", type: "Duration", "142ms, 1.2s 같은 소요 시간"`을 문서화하고 있고, `:132`(실행 히스토리 모달)도 "소요 시간"을 언급한다. 이 UI 노출 값은 **이번 PR 이전부터** `Execution.durationMs` 엔티티 컬럼(REST 조회 기반)으로 계산·표시되던 기존 기능이다. 이번 diff 는 (a) 그 계산 로직을 `resolveTerminalDurationMs` 헬퍼로 통합하고 (b) `if (lastNodeId)` 조건 블록 밖으로 hoist해 버그를 고치고 (c) 엔티티 미로드 5경로에 SQL 클램프 계산을 추가하고 (d) **외부** webhook/SSE/WS(EIA) push payload 에 `durationMs`를 신규로 싣는 것 — 에디터 내부 Run Results UI 의 사용자 가시 동작·표시값은 변경 전후 동일하다(CHANGELOG 자체도 "REST `GET /api/external/executions/:id` 에는 아직 없다"고 명시 — REST/UI 표면은 이번 PR 이 건드리지 않는다). **매칭 없음.**

### `02-nodes/triggers.mdx` 필드-단위 payload 예시 부재 확인 (INFO 근거)

`triggers.mdx`/`.en.mdx` 전문을 grep 한 결과, "외부 인터랙션 채널" 절은 종결 이벤트의 **이름**만 나열한다(`"execution.completed"`, `"execution.failed"`, `"execution.cancelled"` — 트리거 생성 요청 예시 안). `status`/`result`/`error`/`durationMs` 같은 실제 payload 필드 단위 shape 예시는 이 문서 어디에도 없다 — 이번 PR 이전부터 없었다. 자매 PR(`e3825cc2c`, "종결 error 를 문자열 emit하던 4곳" — 같은 계열의 payload shape 변경)도 `triggers.mdx`를 갱신하지 않은 선례가 있다. payload shape 의 SoT 는 `spec/5-system/14-external-interaction-api.md` §6 이며, 그 spec 은 이 changeset 안(`파일 104`)에서 이미 갱신됐다(consistency-checker 영역).

## 선행 라운드와의 교차 검증

동일 changeset(동일 코드 diff)에 대해 이미 세 차례 독립 라운드(`10_18_38`, `10_34_51`, `10_52_08`)의 `user_guide_sync.md` 가 이 changeset 안에 존재해 대조했다. 세 라운드 모두 위험도 **NONE**, CRITICAL/WARNING **0건**으로 독립 도달했고, 근거(`run-debug-flow-change` 실측, `new-handler-output-field` 배제, `triggers.mdx` 필드 미문서화 선례)도 본 라운드와 동일하다. `10_34_51` 라운드는 `backend-api-change` 후보를 INFO 1건으로 등재했다가 "필드 단위 payload 를 애초에 다루지 않는 페이지" 선례로 조치 불요 판정했다 — 본 라운드도 동일하게 판단한다.

## 발견사항

- **[INFO]** 외부 EIA 종결 이벤트 payload 확장이 사용자 가이드(`02-nodes/triggers.mdx`)에는 반영되지 않았으나, 신규 결함이 아니라 기존 관례(payload 필드 단위 shape 는 spec 이 SoT, user-guide 는 채널 설정법만 다룸)의 연장이다.
  - 변경 파일: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`, `codebase/backend/src/modules/chat-channel/types.ts`, `codebase/backend/src/shared/utils/terminal-duration.ts`
  - 매트릭스 항목: `backend-api-change` — "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" (semantic match, 근접 후보)
  - 확인한 부재: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` / `.en.mdx` 어디에도 종결 이벤트의 필드 단위 payload 예시(`status`/`result`/`error`/`durationMs`)가 없음 — 이번 PR 이전부터 없었고, 자매 PR(`e3825cc2c`)도 이 문서를 갱신하지 않은 선례가 있음. 세 선행 라운드가 이미 동일 결론에 도달했음
  - 상세: 사용자 영향은 낮다 — 필드가 추가적(additive)이고 하위호환이며 CHANGELOG 가 명시하고, 문서가 애초에 payload 필드를 다루지 않으므로 "정확했던 문서가 stale 해진" 상황이 아니다
  - 제안: 조치 불필요(선례상 정상). 향후 EIA payload shape 를 통째로 user-guide 화할 계획이 생기면 `durationMs`/`error`/`result` 를 한 번에 반영할 것

이 외에 노드 추가·i18n dict·backend-labels·locale.ts(SECTION_LABELS_BY_LOCALE)·README.md 관련 trigger 는 매칭되는 변경 파일이 전혀 없다(글로브·의미 매칭 모두 0건). `CHANGELOG.md`, `plan/in-progress/*.md`, `review/**` 산출물은 매트릭스 대상 표면이 아니다.

## 요약

매트릭스 21개 trigger 행(glob 9 + semantic 12) 전수를 이번 changeset(backend `execution-engine`/`chat-channel`/`shared/utils` 10개 파일 + `CHANGELOG.md` + `plan/*.md` 3건 + `spec/*.md` 3건 + 선행 리뷰 아티팩트, **frontend/channel-web-chat 변경 0건**)에 대입한 결과 확정 매칭 0건이다. 가장 근접했던 두 후보(`run-debug-flow-change`→`05-run-and-debug/`, `backend-api-change`→`02-nodes/triggers.mdx`)는 실제 문서를 `Read`/`grep` 으로 직접 열어 실측한 결과 모두 CRITICAL/WARNING 이 아닌 배제 또는 INFO 로 하향됐고, 동일 changeset 을 다룬 선행 세 라운드(`10_18_38`/`10_34_51`/`10_52_08`)와도 결론이 완전히 일치한다. 유저 가이드(MDX)·i18n dict·backend-labels·locale.ts 동반 갱신 누락(CRITICAL/WARNING)은 0건이다.

## 위험도

NONE
