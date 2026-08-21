STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — `MASKED_VALUE_RESUBMITTED` 서버측 거부

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]`, 총 25행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 함께 Read 함.

## 변경 파일 컨텍스트
prompt 에 포함된 109개 파일 중 실질 코드 변경은 다음 11개이며, 전부 `codebase/backend/**` 아래다 (**`codebase/frontend/**` 변경 파일은 0개** — 프롬프트 상단 "점검 관점" 안내문 안의 경로 언급 2건뿐, 실제 변경 파일 아님):

- `CHANGELOG.md`
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` (신규 reason/code `masked_value_resubmitted`/`MASKED_VALUE_RESUBMITTED`)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규) + `.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`, `.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`, `.spec.ts`
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`, `.spec.ts` (신규)
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` (기존 `isMaskedMarker`/`MASKED_MARKERS` export 승격 — 신규 로직 없음)
- 나머지는 `plan/**`·`review/**`·`spec/**` — 코드 아님

## 매칭 및 판정

### 1) `new-error-code` 행 (glob `codebase/backend/src/nodes/core/error-codes.ts`) — 미매칭
신규 `MASKED_VALUE_RESUBMITTED` 는 `trigger-parameter.types.ts` 의 `TriggerParameterErrorDetail.code` 열거값이다. 매트릭스가 이 행의 glob 을 `error-codes.ts` 한 파일로 명시 스코프한 것은 그 파일이 **노드 핸들러 `output.error.code`** 전용 enum(파일 최상단 doc: `"Canonical error-code enum for node handlers' output.error.code"`)이기 때문이고, `TriggerParameterErrorDetail.code` 는 HTTP 400 트리거 파라미터 검증 실패 코드로 **다른 네임스페이스**다. 실제로 `error-codes.ts` 는 이 diff 에서 손대지 않았다. 확인차 기존 3개 형제 코드(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`)도 `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO`/어디에도 매핑돼 있지 않음을 grep 으로 확인함(0건) — 이 PR 이 새로 만든 격차가 아니라 기존에 존재하지 않던 매핑 계약이다.

### 2) 사용자 노출 경로 실측 — 매핑 부재가 실제로 영문 노출로 이어지는가
- `codebase/frontend/src/components/executions/rerun-modal.tsx`: `handleSubmit` 의 catch 는 `parseErrorCode(err)`(응답 **최상위** `code`, 여기선 `INVALID_INPUT`)를 `ERROR_CODE_TO_KEY`(RERUN_* 4개만 등록)에서 찾고, 미매칭이면 `t("history.rerun.genericError")`(한국어 고정 문구)로 폴백한다 — `details[].code`(`MASKED_VALUE_RESUBMITTED`) 자체를 읽지 않으므로 애초에 영문 노출 표면이 아니다.
- `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` `handleRunWithInput`: catch 블록이 `SyntaxError` 외에는 `console.error` 만 하고 토스트가 없다 — 이 PR 과 무관한 기존 상태(모든 execute 실패가 동일)이며 이번 diff 가 새로 노출을 만들지 않는다.
- 더 근본적으로, 두 표면 모두 **클라이언트가 이미 제출 전에 마스킹 마커를 막는다** — `rerun-modal.tsx` 의 `blockedByMaskedInput`, `editor-toolbar.tsx` 의 `jsonError`(`hasMaskedMarkerLeaf`). 이번 서버측 거부는 CHANGELOG 가 스스로 밝히듯 "프런트가 이미 같은 비용을 치르고 있어 새로 생기는 비용이 아니"고, UI 바깥(curl 등) 직접 호출에 대한 백스톱이다 — 정상 UI 플로우에서는 도달 불가능한 방어선.
- `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `translateBackendError`(`ERROR_KO` 룩업 후 영문 fallback)는 grep 결과 현재 어디서도 호출되지 않는 유휴 유틸이라, 이번 코드와도 무관.

→ 매핑 미등록이 사용자에게 영문을 노출시키는 실제 경로가 없어 **CRITICAL 판정 근거(영문 그대로 노출)가 성립하지 않는다.**

### 3) `05-run-and-debug/` docs (run-debug-flow-change, semantic) — 이미 정합
`running-a-workflow.mdx:32` ("`Load from History` ... 실행 버튼이 비활성돼요"), `run-results.mdx:134` ("Re-run 이 비활성되고, 원본 입력 그대로 사용을 켜면...")는 이미 클라이언트측 차단 동작을 정확히 서술하고 있다. 이번 diff 는 그 문서가 서술하는 UI 동작을 바꾸지 않는다(서버측 거부는 UI 도달 불가 경로에만 적용) — 갱신 불필요.

### 4) `backend-api-change` 행 (glob `**/*.controller.ts`) — 매칭하나 실질 갭 없음
`workflows.controller.ts` 변경. 다만 `execute` 엔드포인트의 기존 swagger 데코레이터 `@ApiBadRequestResponse({ description: '트리거 파라미터 검증 실패' })` 가 이미 일반화된 문구라 신규 detail code 를 별도로 enumerate 할 필요가 없다(다른 3개 기존 reason 코드도 개별 문서화돼 있지 않음 — 기존 컨벤션과 일치).

### 5) 그 외 행 (new-node/node-schema/new-ui-string/integration-provider/new-userguide-section-dir/expression-language/auth-session-flow) — 전부 미매칭
노드 디렉토리·프런트 TSX·통합 provider·docs 신규 디렉토리·`expression-engine`·`modules/auth/**` 어느 것도 이번 diff 범위에 없음.

## 요약
매트릭스 25행 중 glob/semantic 매칭 후보는 `new-error-code`(스코프 파일 불일치로 미매칭)와 `backend-api-change`(매칭하나 기존 일반화 문구로 충분)뿐이었고, 나머지 다수는 전부 미매칭. 신규 `MASKED_VALUE_RESUBMITTED` 코드는 `error-codes.ts` `ErrorCode` enum 과 다른 네임스페이스(`TriggerParameterErrorDetail.code`)이며, 두 실제 프런트 소비처(rerun-modal / editor-toolbar) 모두 그 값을 읽지 않고 클라이언트가 이미 제출 전에 마스킹 마커를 차단해 서버 거부 경로 자체가 UI 상 도달 불가능하다 — `05-run-and-debug/` 문서도 그 차단 동작을 이미 정확히 서술한다. `codebase/frontend/**` 변경 파일이 0개라 i18n dict parity·section-locale 등록 등 CRITICAL 트리거도 원천적으로 성립하지 않는다. 동반 갱신 누락 0건.

## 위험도
NONE
