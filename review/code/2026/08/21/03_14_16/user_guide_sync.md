STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — 마커 재제출 서버측 거부 (EIA §R17, Manual 실행 경로)

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` `rows[]` (21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 함께 적재했다.

## 변경 파일 분류

실제 코드 변경(파일 1~13)은 전부 `codebase/backend/**` 이며, `codebase/frontend/**`(docs MDX·dict·backend-labels.ts)·`codebase/backend/src/nodes/**`(신규 노드)·`codebase/backend/src/modules/auth/**`(인증)·`codebase/packages/expression-engine/**`(표현식)·`codebase/backend/src/nodes/core/error-codes.ts`(노드 핸들러 ErrorCode enum)·`codebase/frontend/src/content/docs/*/`(신규 섹션)는 **어느 것도 이번 diff 에 없다**. 나머지(파일 14~149)는 plan/review 산출물과 spec 문서로 매트릭스의 코드 trigger 대상이 아니다(spec 동기화는 별도로 `plan/complete/spec-update-masked-reject-framing.md` 로 이미 처리됨 — user guide 범위 밖).

## trigger 매칭 결과

- **glob 직접 매칭 1건**: `backend-api-change` 행 — trigger glob `codebase/backend/src/**/*.controller.ts` 가 `codebase/backend/src/modules/workflows/workflows.controller.ts`(파일 9)에 매칭. targets: "controller·DTO 의 swagger jsdoc" + "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지". 아래 확인 결과 **갭 없음**(INFO 처리).
- **semantic 후보로 검토했으나 불일치**:
  - `new-warning-code`(backend `warningRules`) — grep 결과 `warningRules` 는 노드 스키마 cross-field 검증 시스템(`codebase/backend/src/nodes/**`)에서만 쓰이고, 이번 diff 의 `REASON_TO_DETAIL`/`TriggerParameterErrorDetail`(execute/re-run 트리거 파라미터 검증)과는 별개 시스템이다. 불일치.
  - `new-error-code`(`codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum) — 그 파일은 노드 핸들러 `output.error.code` 전용 enum 이고, 이번 diff 는 그 파일을 건드리지 않는다. 신규 `MASKED_VALUE_RESUBMITTED` 는 `trigger-parameter.types.ts` 의 별도 `TriggerParameterErrorDetail.code` 열거값이다. glob 불일치.
  - `run-debug-flow-change`(실행·디버깅 흐름 변경 → `05-run-and-debug/`) — 아래 상세 참고. 갭 없음(INFO).
  - `auth-session-flow-change`, `expression-language-change`, `new-node`, `node-schema-change`, `new-ui-string`, `new-userguide-section-dir`, `integration-provider-change` — 전부 불일치(대상 파일 없음).

## 발견사항

- **[INFO]** `MASKED_VALUE_RESUBMITTED` 는 매트릭스의 두 "신규 코드" 행(`new-warning-code`/`new-error-code`) 어느 glob 에도 정확히 걸리지 않는 제3의 코드 계열(`TriggerParameterErrorDetail.code`, execute/re-run 트리거 파라미터 검증 전용)이라 CRITICAL 로 올리지 않았다. 다만 "영문 코드가 사용자에게 그대로 노출되는가" 라는 checklist §6/§9 의 실질 관심사는 직접 확인했다.
  - 변경 파일: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`(신규 `masked_value_resubmitted`/`MASKED_VALUE_RESUBMITTED` 추가)
  - 매트릭스 항목: `new-warning-code`/`new-error-code` — "frontend `backend-labels.ts` 의 `WARNING_KO`/`ERROR_KO` 매핑 누락 시 CRITICAL (영문 SoT 가드)"
  - 확인 내용: frontend 전체(`codebase/frontend/src`)에 `MASKED_VALUE_RESUBMITTED`/`masked_value_resubmitted`/형제 3종(`MISSING_REQUIRED_FIELD` 등) 를 소비하는 코드가 **전혀 없다** — `TriggerParameterErrorDetail[].code`(필드별 상세)는 어디서도 읽지 않는다. 대신 두 소비처 모두 **상위 봉투 `code`**(`INVALID_INPUT`)만 본다:
    - `codebase/frontend/src/components/executions/rerun-modal.tsx:445-447` — `ERROR_CODE_TO_KEY`(`RERUN_PERMISSION_DENIED`/`RERUN_CHAIN_DEPTH_EXCEEDED`/`RERUN_WORKFLOW_DELETED`/`RERUN_DRY_RUN_NOT_APPLICABLE` 만 매핑)에 `INVALID_INPUT` 이 없어 `t("history.rerun.genericError")` 로 폴백 — 영문 원문 노출 없음.
    - `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:294-321`(`handleRunWithInput`) — 400 을 잡아 `console.error` 만 하고 사용자 토스트 자체가 없다(이 diff 가 만든 결함 아님, 기존 패턴). 영문 노출은 아니지만 UX 관점 별도 이슈(본 리뷰어 범위 밖 — requirement/testing 리뷰어 소관).
  - 상세: 직전 라운드(`review/code/2026/08/21/01_15_47/RESOLUTION.md` INFO-10)가 같은 항목을 "형제 3종도 동일, 이번 diff 의 이탈 아님. genericError 폴백이라 영문 코드 노출 없음"으로 미조치 처리했는데, 위 코드 확인으로 그 판단이 **정확함을 독립적으로 재검증**했다.
  - 제안: 조치 불요(CRITICAL 아님). 굳이 개선한다면 향후 `backend-labels.ts` 에 `ERROR_KO` 매핑 신설 시 이 4종(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED`)을 한 번에 등재하는 편이 자매 발산을 막는다 — 이번 PR 스코프는 아님.

- **[INFO]** `run-debug-flow-change`(실행·디버깅 흐름 변경) 후보 — 사용자에게 새로 보이는 UI 흐름이 없어 `05-run-and-debug/` 갱신 불필요로 판단
  - 변경 파일: `codebase/backend/src/modules/executions/executions.service.ts`, `codebase/backend/src/modules/workflows/workflows.controller.ts`
  - 매트릭스 항목: `run-debug-flow-change` — targets "`codebase/frontend/src/content/docs/05-run-and-debug/`"
  - 확인 내용: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:134` 가 이미 "자격증명으로 판별된 입력은 `***` 로 가려져 있어 프리필되지 않아요 — 직접 입력하기 전까지 Re-run 이 비활성되고..." 를 서술한다(이전 PR 의 클라이언트측 가드 문서화). 이번 PR 이 추가하는 건 **그 클라이언트 가드를 이미 통과한 뒤에만 닿는 서버측 2차 방어층**(curl 등 UI 우회 클라이언트 전용, `executions.service.ts:496-498`/`workflows.controller.ts:314-316` 주석에 명시)이라 UI 를 따라오는 일반 사용자는 이 경로에 절대 도달하지 않는다 — `editor-toolbar.tsx:117` 도 `hasMaskedMarkerLeaf` 로 "Run with Input" 제출 자체를 막는다. 문서가 서술하는 사용자 관찰 가능 동작(Re-run 버튼 비활성화)은 변경되지 않았다.
  - 제안: 조치 불요. 다만 "재제출뿐 아니라 Manual 실행 전체가 대상" 이라는 이번 PR 의 범위 확장이 `run-results.mdx` 의 서술과 모순되지는 않는지 확인했다 — 그 문서는 애초에 "재제출 전용" 으로 좁게 쓰지 않았으므로 정정 불요.

- **[INFO]** `backend-api-change` glob 매칭(`workflows.controller.ts`) — swagger jsdoc 갱신 여부 확인, 갱신 불요
  - 변경 파일: `codebase/backend/src/modules/workflows/workflows.controller.ts`(`execute` 엔드포인트)
  - 매트릭스 항목: `backend-api-change` — targets "controller·DTO 의 swagger jsdoc"
  - 확인 내용: `@ApiBadRequestResponse({ description: '트리거 파라미터 검증 실패' })`(`workflows.controller.ts` 약 254행)와 re-run 쪽 `@ApiBadRequestResponse({ description: 'INVALID_INPUT / RERUN_DRY_RUN_NOT_APPLICABLE' })`(`executions.controller.ts` 약 273행)는 기존에도 `missing_required`/`coerce_failed`/`invalid_schema` 개별 reason 을 나열하지 않고 최상위 실패 사유만 문서화하는 관행이었다. 신규 `masked_value_resubmitted` 도 같은 관행을 따르므로(세부 reason 미열거) swagger 문서 갱신 누락이 아니다.
  - 제안: 조치 불요.

## 요약

매트릭스 21행 중 glob 직접 매칭 1건(`backend-api-change`), semantic 후보 검토 대상 다수(신규 코드 2행·실행/디버깅 1행 포함)를 짚었으나, 실제 프로덕션 diff 가 `codebase/backend/**` 로 한정되고 프런트 UI·docs·dict·backend-labels.ts 를 전혀 건드리지 않으며, 신규 `MASKED_VALUE_RESUBMITTED` 코드는 (a) 노드 `ErrorCode`/`warningRules` 계열이 아니고 (b) frontend 가 필드별 `details[].code` 를 아예 소비하지 않아(top-level `INVALID_INPUT` → `genericError` 폴백) 영문 노출 위험이 없으며, (c) 사용자가 관찰하는 Re-run/Run-with-Input UI 흐름은 이번 PR 이전부터 이미 문서화된 클라이언트측 가드 그대로다 — 이번 PR 은 그 가드를 우회하는 non-UI 클라이언트만 겨냥한 서버측 2차 방어라 유저 가이드가 다뤄야 할 신규 표면이 없다. 누락된 동반 갱신 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

NONE
