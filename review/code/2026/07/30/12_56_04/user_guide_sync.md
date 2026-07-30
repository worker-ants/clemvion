# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 절차 요약

1. SSOT 적재: `.claude/config/doc-sync-matrix.json` (rows 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (동일 20행, 표-JSON 1:1) Read 완료.
2. 변경 파일 식별: prompt 가 지정한 리뷰 대상은 아래 2파일.
   - `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
   - `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts`
   교차검증을 위해 `git diff --name-only 71ce6c12b(merge-base) HEAD -- codebase/` 로 브랜치 전체의 `codebase/**` 변경 파일 집합을 확인한 결과, 실제로도 이 2파일 + `continuation-execution.processor.ts`(주석만 정정, 로직 라인 변경 없음) + `execution-engine.service.spec.ts` 뿐이며, 전부 `codebase/backend/src/modules/execution-engine/**` 내부다. `codebase/frontend/**`, `codebase/channel-web-chat/**`, `codebase/packages/**` 는 이 브랜치에서 **0건** 변경.
3. 매트릭스 20행 전수 매칭.

## 매트릭스 매칭 결과

| 매트릭스 행 (id) | trigger | 매칭 여부 |
|---|---|---|
| new-node / node-schema-change | glob `codebase/backend/src/nodes/**` | 불일치 — 변경 파일은 `src/modules/execution-engine/**`, `src/nodes/**` 아님 |
| new-ui-string / new-widget-chrome-string | glob `*.tsx` (frontend/channel-web-chat) | 불일치 — frontend·webchat 변경 0건 |
| integration-provider-change | semantic | 불일치 — retry-turn 은 통합 provider 가 아닌 코어 엔진 서비스 |
| new-userguide-section-dir | glob `content/docs/*/` | 불일치 |
| backend-api-change | glob `*.controller.ts`, `**/dto/**` | 불일치 — 대상 파일은 controller/DTO 아님. WS 진입점(`retryLastTurn`/`applyRetryLastTurn`)은 기존 진입점 재배선일 뿐 신규 API 노출 없음 |
| new-bullmq-queue | glob `system-status.constants.ts` | 불일치 |
| new-warning-code / new-error-code | semantic / glob `error-codes.ts` | 불일치 — 아래 "심층 확인" 참조 |
| new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field | semantic | 불일치 — 신규 enum 값·zod ui 값·output.result 신규 필드 없음 (기존 `ExecutionStatus`/`NodeExecutionStatus`/`NodeEventType`/`ExecutionEventType` 값만 재사용) |
| auth-session-flow-change / auth-config-type-enum-change | `modules/auth/**` / semantic | 불일치 — auth 모듈 무관 |
| expression-language-change | glob `packages/expression-engine/**` | 불일치 |
| run-debug-flow-change | semantic "실행·디버깅 흐름 변경" → `05-run-and-debug/` | **근접 후보 — 아래 심층 확인에서 기각** |
| env-runtime-change / spec-major-change / userguide-gui-flow-section / spec-defect-found | semantic/glob | 불일치 (spec-major-change 는 `spec/5-system/4-execution-engine.md` 가 같은 브랜치에서 변경됐으나 이는 consistency-checker 영역의 spec frontmatter 동기화이지 본 리뷰어의 docs-MDX/i18n/backend-labels 영역이 아님) |

## 심층 확인 — "실행·디버깅 흐름 변경" (run-debug-flow-change) 근접 후보

`execution.retry_last_turn` 은 실제로 사용자 가이드에 **이미 상세히 문서화된 기능**이다:

- `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` §"멀티턴 대화 중 오류 발생 시 재시도" (라인 97-110): "[다시 시도] 버튼", 재시도 가능/불가 오류 분류, "60분 이내 한 번" TTL, 재시도 성공 시 downstream 노드 이어서 실행 등을 서술.
- 같은 파일의 에러 코드 표 (라인 179-184): `RETRY_STATE_NOT_FOUND` / `NODE_NOT_RETRYABLE` / `RETRY_TOO_EARLY` 3개 코드에 대한 한국어 설명이 이미 등재돼 있다.

이 근접성 때문에 본 PR이 "실행·디버깅 흐름 변경"에 해당하는지 diff 를 직접 대조했다(`git diff 71ce6c12b HEAD -- .../retry-turn.service.ts`):

- 변경 내용은 (1) `_retryState` 리터럴을 `RETRY_STATE_KEY` 상수로 추출(순수 리팩터), (2) `applyRetryLastTurn` 재진입 가드를 "read-then-branch" 에서 `claimSpawnedRetryRow`(조건부 UPDATE 원자 claim)로 교체, (3) claim 직후 `delete spawnedRow.inputData[RETRY_STATE_KEY]` 추가(내부 필드 비노출 강화)로 구성된다.
- 문서가 서술하는 사용자 가시 계약 — TTL(60분), retryable/non-retryable 분류, 1회 소비, 성공 시 downstream 이어서 실행, 3개 에러 코드의 의미 — 는 **어느 것도 이 diff 로 변경되지 않는다.** 모두 `retryLastTurn()`(WS 진입점, 검증 단계 1-5)에 있고 이번 diff 는 그 이후의 worker 재진입(`applyRetryLastTurn`) 내부 claim 순서만 건드린다.
- 제거된 유일한 사용자 가시 문자열은 구 코드의 `spawnedRow.error = { message: 'Retry re-entry failed: missing _retryState' }` 분기(동시 배달 레이스를 "손상"으로 오판해 살아있는 row 를 FAILED 로 덮어쓰던 버그, ai-review CRITICAL #1 로 이미 지적됨)이며, 이는 **삭제**됐지 신규 도입되지 않았다. `grep -rn "missing _retryState\|Retry re-entry failed"` 를 `content/docs/`, `lib/i18n/` 에 실행해 이 문자열이 애초에 문서·i18n 어디에도 참조되지 않았음을 확인했다(매치 0건) — 즉 사후 정합성 문제도 없다.
- `NODE_STARTED` WS 이벤트 payload 에서 `_retryState` 가 더 이상 노출되지 않게 된 변경은 WS 프로토콜 내부 필드 수준이며, 이 필드가애초에 사용자 가이드에 문서화된 적이 없다(그레이드된 필드는 `spec/5-system/6-websocket-protocol.md` 내부 스펙 레벨).

**결론**: `run-debug-flow-change` trigger 는 판정상 매칭되지 않는다 — 이 diff 는 이미 문서화된 기능의 **내부 동시성 정합성 버그 수정**이지, 사용자 관찰 가능한 동작·에러 코드·타이밍 계약의 변경이 아니다.

## 신규 warning/error code 확인

- `RetryLastTurnError.notFound/notRetryable/tooEarly` (→ `RETRY_STATE_NOT_FOUND`/`NODE_NOT_RETRYABLE`/`RETRY_TOO_EARLY`) 는 `workflow-errors.ts` 에 정의돼 있으며, 이 파일은 이번 브랜치 diff 목록에 없다(`git diff --name-only` 확인) — 즉 사전에 존재하던 코드로, 이번 PR 의 신규 발행이 아니다.
- `codebase/frontend/src/lib/i18n/backend-labels.ts` 에 "retry"/"RETRY" 매핑이 전무함을 확인했으나(grep 0건), 이는 이번 PR 이전부터 있던 상태이고 이번 diff 의 범위 밖이다 — 그리고 사용자에게는 어차피 `run-results.mdx` 의 표(위 참조)로 이미 한국어 설명이 제공되고 있어 (해당 코드들이 실제로 어떤 UI 경로로 노출되는지는 `backend-labels.ts` 의 `WARNING_KO`/`ERROR_KO` 매핑 체계와는 별도로) 사용자가 영문 그대로 보는 상황은 아닌 것으로 보인다. 이 gap 이 실재한다면 이번 PR 이 만든 것이 아니라 훨씬 이전(C-1 step4, `retry_last_turn` 최초 도입) 범위이므로 본 리뷰의 대상 diff 귀책이 아니다.

## 발견사항

- **[INFO]** `run-debug-flow-change` 근접 후보 검토 — 사용자 가이드 갱신 불요로 판정
  - 변경 파일: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (`applyRetryLastTurn`, `claimSpawnedRetryRow`)
  - 매트릭스 항목: `run-debug-flow-change` — targets: `codebase/frontend/src/content/docs/05-run-and-debug/`
  - 상세: 위 "심층 확인" 참조. `retry_last_turn` 기능은 이미 `run-results.mdx` 에 상세 문서화돼 있으나, 이번 diff 는 그 문서가 서술하는 사용자 가시 계약(TTL·재시도 가능 분류·1회 소비·downstream 계속 실행·3개 에러 코드)을 하나도 바꾸지 않는다 — 동시 배달 레이스에서 살아있는 row 를 오판해 죽이던 내부 버그를 원자 claim 으로 고치는 수정이며, 부수적으로 내부 전용 필드(`_retryState`)가 WS payload 에 새어나가던 것을 막는다.
  - 제안: 별도 조치 불요. 다만 이 기능이 사용자 가이드에 이미 문서화돼 있다는 사실 자체가, **향후** 이 서비스에 사용자 관찰 가능한 변경(예: TTL 값 변경, 새 에러 코드, downstream 동작 변경)이 생기면 `run-results.mdx` + `.en.mdx` 동반 갱신이 필수임을 시사한다 — 다음 PR 에서 이 파일을 건드릴 때 재확인 권장.

다른 CRITICAL/WARNING 없음.

## 요약

매트릭스 20개 trigger(glob 13 + semantic 7 혼합, JSON `rows[]` 기준) 전수 대조 결과 이번 diff(`retry-turn.service.ts` + `.spec.ts`, 브랜치 전체로 확장해도 `codebase/`는 execution-engine 모듈 4파일뿐)는 어느 trigger 에도 확정 매칭되지 않는다. 가장 근접한 semantic 후보(`run-debug-flow-change` → `05-run-and-debug/`)를 실제 문서 내용과 diff 내용을 대조해 심층 검토했으나, 이번 변경은 이미 문서화된 `retry_last_turn` 기능의 **내부 동시성 원자성 버그 수정**(비원자 read-then-branch → 조건부 UPDATE claim)일 뿐 사용자 가시 계약을 바꾸지 않아 문서 갱신 대상이 아니라고 판단했다. 신규 노드/UI 문자열/통합 provider/섹션 디렉토리/auth 흐름/표현식 언어/신규 warning·error code 어느 것도 도입되지 않았고(오히려 내부 전용 에러 메시지 1건이 제거됨, 문서·i18n 참조 0건 확인), frontend·i18n·docs 파일은 이 브랜치에서 전혀 변경되지 않았다. INFO 1건(근접 후보 기각 사유 기록) 외 CRITICAL/WARNING 없음.

## 위험도

NONE
