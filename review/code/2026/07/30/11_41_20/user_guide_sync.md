STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===

# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재 확인

- `.claude/config/doc-sync-matrix.json` `rows[]` 18개 행을 Read.
- `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (라인 116–186) 을 nuance 보조로 Read.

## 변경 파일 컨텍스트

prompt 에 포함된 리뷰 대상은 아래 2개 파일뿐이다 (둘 다 `codebase/backend/src/modules/execution-engine/`):

- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts`

`git diff origin/main HEAD --name-only` 로 이 PR 라운드의 `codebase/**` 전체 변경분을 보강 확인한 결과도 동일 디렉토리 범위 안에 머문다:

```
codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts   (주석 전용 — 코드 diff 없음)
codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts                    (테스트)
codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts                          (테스트)
codebase/backend/src/modules/execution-engine/retry-turn.service.ts                                (구현)
```

(그 외 변경분인 `spec/5-system/4-execution-engine.md`, `plan/in-progress/*.md`, `review/code/2026/07/28/20_32_57/RESOLUTION.md` 는 `codebase/**` 밖이라 ai-review 스코프 밖 — memory `project_review_scope_harness_only` 와 일치.)

## 변경 내용 요약 (trigger 판정 근거)

`git diff b351731f0 HEAD -- .../retry-turn.service.ts` 로 실제 diff 를 확인했다. 변경은:

1. `RETRY_STATE_KEY` 상수 추출 (리터럴 중복 제거, 순수 리팩터).
2. `applyRetryLastTurn` 재진입에 **2차 원자 claim**(`claimSpawnedRetryRow`, private 신설 메서드) 을 "`_retryState` 부재 → 손상 판정" **이전**으로 이동 — 예전엔 이 판정이 claim 뒤에 있어 이미 다른 delivery 가 정상적으로 claim 한 살아있는 row 를 손상으로 오판해 FAILED 로 덮어썼다 (ai-review CRITICAL #1, `review/code/2026/07/28/20_32_57`).
3. claim 성공 직후 `delete spawnedRow.inputData[RETRY_STATE_KEY]` 로 in-memory 를 DB 와 동기화 (stale `save()` 가 방금 지운 키를 부활시키는 CRITICAL #2 차단).

세 변경 모두 **`applyRetryLastTurn` 내부의 동시-배달(concurrent BullMQ redelivery) 레이스 처리 로직**에 국한된다. 공개 메서드 시그니처(`retryLastTurn(executionId, nodeExecutionId)`, `applyRetryLastTurn(executionId, spawnedNodeExecutionId)`), WS 이벤트 payload 모양(`emitNode`/`emitExecution` 호출부 미변경), 에러 코드(`RETRY_STATE_NOT_FOUND`/`NODE_NOT_RETRYABLE`/`RETRY_TOO_EARLY`, `workflow-errors.ts` 미변경)는 그대로다. 정상(비-레이스) 단일 delivery 경로의 관측 가능한 동작은 수정 전후 동일 — 차이는 오직 레이스가 실제로 발생했을 때만 나타나며, 그마저도 "잘못된 FAILED 노출"이 "조용한 discard"로 바뀌는, 버그 제거이지 신규 의도된 사용자 기능이 아니다.

## 매트릭스 trigger 매칭 결과 (18개 행 전수 확인)

| trigger id | 매칭 여부 | 사유 |
|---|---|---|
| new-node / node-schema-change | 불일치 | glob `codebase/backend/src/nodes/**` — 변경 파일은 `modules/execution-engine/`, `nodes/` 하위 아님 |
| new-ui-string / new-widget-chrome-string | 불일치 | frontend/`channel-web-chat` TSX 변경 없음 |
| integration-provider-change | 불일치 | provider(cafe24/makeshop/mcp 등) 관련 변경 아님 |
| new-userguide-section-dir | 불일치 | `content/docs/` 변경 없음 |
| backend-api-change | 불일치 | glob `**/*.controller.ts`, `**/dto/**` — 대상은 service 내부 private 메서드, controller/DTO 아님 |
| new-bullmq-queue | 불일치 | `system-status.constants.ts` 변경 없음, 신규 `@Processor` 없음 |
| new-warning-code / new-error-code | 불일치 | `error-codes.ts` 미변경. `workflow-errors.ts` 의 기존 `RETRY_STATE_NOT_FOUND`/`NODE_NOT_RETRYABLE`/`RETRY_TOO_EARLY` 도 이번 diff 에서 손대지 않음 (grep 으로 직접 확인) |
| new-cross-cutting-enum | 불일치 | 신규 enum 값 추가 없음 (`ExecutionStatus`/`NodeExecutionStatus` 기존 값만 사용) |
| new-backend-ui-zod-value | 불일치 | zod `ui.*` 관련 변경 없음 |
| new-handler-output-field | 불일치 | `output.result.*` 신규 키 없음 — `_retryState`/`inputData` 는 기존 internal JSONB 작업 키(신규 아님) |
| auth-session-flow-change / auth-config-type-enum-change | 불일치 | glob `codebase/backend/src/modules/auth/**` — 변경 파일은 `modules/execution-engine/`, auth 모듈 아님 |
| expression-language-change | 불일치 | glob `codebase/packages/expression-engine/**` — 미변경 |
| run-debug-flow-change (실행·디버깅 흐름 변경) | 그레이존 → 불일치로 판정 | 아래 상세 참조 |
| env-runtime-change / spec-major-change / userguide-gui-flow-section / spec-defect-found | 불일치 | 해당 파일 유형 변경 없음 |

### run-debug-flow-change 상세 검토 (가장 근접한 후보)

`execution.retry_last_turn` 은 Run Results 화면의 "다시 시도" 버튼으로 이미 사용자 가시 기능이며, `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` §"멀티턴 대화 중 오류 발생 시 재시도" 에 이미 다음이 문서화돼 있다 (grep 확인):

- 재시도 가능/불가 오류 종류, "60분 이내 한 번" 제한
- 재시도 성공 시 downstream 노드 진행
- `RETRY_STATE_NOT_FOUND` / `NODE_NOT_RETRYABLE` / `RETRY_TOO_EARLY` 에러 표

이 문서가 서술하는 내용 중 어느 것도 본 diff 로 바뀌지 않는다 — 정상 단일 delivery 흐름은 그대로이고, 바뀌는 것은 오직 BullMQ 재배달 레이스 발생 시의 내부 판정(오탐 FAILED → 조용한 discard)뿐이며 이는애초에 문서화된 적 없는 버그의 제거다. `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` / `conversation-inspector.tsx` / `result-detail.tsx` 등 프런트엔드의 `retryLastTurn` 연동부도 이번 diff 에 포함되지 않았고(공개 시그니처·반환 shape 불변이므로) 갱신 불필요. 따라서 "실행·디버깅 흐름 변경" trigger 의 의도(사용자가 관측하는 실행/디버깅 동작 변경)에 해당하지 않는다고 판단한다.

## 발견사항

해당 없음 — 매트릭스 18개 행 중 어느 trigger 에도 매칭되지 않는다.

## 요약

매트릭스는 총 18개 trigger 행(JSON `rows[]`)을 보유하며, 이번 PR 라운드의 `codebase/**` 변경분(`retry-turn.service.ts`/`.spec.ts`, 및 주석 전용인 `continuation-execution.processor.ts`)은 execution-engine 모듈 내부의 AI multi-turn retry 재진입 동시성 버그 수정(2차 원자 claim 삽입 위치 정정 + in-memory 동기화)에 한정된다. 18개 trigger 전수 대조 결과 매칭 0건 — 새 노드/스키마, TSX 신규 문자열, 통합/제공자, 신규 문서 섹션, controller/DTO API, 신규 BullMQ 큐, 신규 warning/error 코드, cross-cutting enum, 신규 handler output field, auth/세션 흐름, AuthConfig enum, 표현식 언어 중 어느 것도 해당 없다. 가장 근접한 "실행·디버깅 흐름 변경" 조차, 이미 `05-run-and-debug/run-results.mdx` 에 문서화된 retry_last_turn 사용자 시맨틱(60분 제한·성공 시 downstream 진행·3개 에러 코드)이 이 diff 로 전혀 바뀌지 않아(레이스 상황에서만 나타나던 오탐 버그의 제거일 뿐) 불일치로 판정했다. 유저 가이드·i18n dict·backend-labels·locale.ts 동반 갱신 누락 없음.

## 위험도

NONE
