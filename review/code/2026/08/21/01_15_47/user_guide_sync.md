STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — `inputOverride`/`parameterValues` 마스킹 마커 재제출 서버측 거부

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` `rows[]` 20개 행 + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 보조로 확인.

## 변경 파일 컨텍스트

실질 코드 변경은 전부 `codebase/backend/**` — `codebase/frontend/**` 는 이 변경 set 안에 **파일이 단 하나도 없음**:

- `CHANGELOG.md`
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` — 신규 reason/code `masked_value_resubmitted` / `MASKED_VALUE_RESUBMITTED`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (+ `.spec.ts`, 신규)
- `codebase/backend/src/modules/executions/executions.service.ts` (+ `-rerun.service.spec.ts`)
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (+ `.spec.ts`)
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` — 기존 `isMaskedMarker`/`MASKED_MARKERS` export 승격(신규 판정 로직 아님)
- `plan/**`, `review/**` (트래커·리뷰 산출물), `spec/**` 7건(1-data-model.md, 3-execution.md, 1-manual-trigger.md, 12-webhook.md, 13-replay-rerun.md, 14-external-interaction-api.md, 3-error-handling.md)

## trigger 매칭 검토

1. **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 미매칭. `codebase/backend/src/nodes/` 하위 파일 없음.
2. **new-ui-string** (`codebase/frontend/src/**/*.tsx`) — 미매칭. TSX 변경 없음.
3. **new-userguide-section-dir** — 미매칭. `content/docs/*/` 변경 없음.
4. **integration-provider-change** — 미매칭. provider 변경 없음.
5. **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — 미매칭. 변경 파일은 execution-engine/executions/workflows 모듈이지 auth 모듈이 아님.
6. **expression-language-change** (`codebase/packages/expression-engine/**`) — 미매칭.
7. **backend-api-change** (`codebase/backend/src/**/*.controller.ts`, `**/dto/**`) — **글롭 매칭**: `workflows.controller.ts` 가 `.controller.ts` 파일. 상세 검토 결과 실질 갭 없음(아래 발견사항 참조).
8. **run-debug-flow-change** (semantic, targets `05-run-and-debug/`) — 그레이존으로 검토(아래 발견사항 참조).
9. **new-warning-code / new-error-code** — `new-error-code` 행의 glob 은 `codebase/backend/src/nodes/core/error-codes.ts` 인데 이번 신규 코드 `MASKED_VALUE_RESUBMITTED` 는 그 파일이 아니라 `trigger-parameter.types.ts` 의 `TriggerParameterErrorDetail.code` union 에 추가됐다 — 글롭 미매칭. `new-warning-code`(warningRules) 도 무관. 의미상 인접 사례라 검토는 했음(아래 발견사항 참조).

## 발견사항

- **[INFO]** `backend-api-change` 글롭이 매칭되지만 swagger jsdoc 갱신은 불필요 — 기존 문구가 이미 이 케이스를 포괄
  - 변경 파일: `codebase/backend/src/modules/workflows/workflows.controller.ts`
  - 매트릭스 항목: `backend-api-change` — targets "controller·DTO 의 swagger jsdoc", "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 상세: `execute()` 핸들러의 `@ApiBadRequestResponse({ description: '트리거 파라미터 검증 실패' })` (컨트롤러 게이트 254행)는 기존 3개 reason(`missing_required`/`coerce_failed`/`invalid_schema`)도 개별 예시 없이 이 한 문구로 포괄해 왔다. 신규 `masked_value_resubmitted` 도 같은 우산 아래 있어 이 PR 이 기존 swagger 문서화 컨벤션과 어긋나는 새 갭을 만들지 않는다. `run-and-debug`/`triggers` 유저 가이드도 확인했다 — `05-run-and-debug/running-a-workflow.mdx:32` 가 이미 "자격증명으로 판별된 값은 `***` 로 가려져 오는데, 그대로 실행하면 그 문자열이 실제 입력이 되기 때문에 남아 있는 동안 실행 버튼이 비활성돼요" 로 **프런트 1층 가드**를 정확히 서술 중이고, 이번 PR 이 추가한 **서버 2층 가드**는 UI 를 거치는 정상 사용자 흐름에는 영향이 없다(프런트가 이미 막아 서버에 도달하지 않음) — API 직접 호출(curl 등) 방어용이라 "how to use the UI" 성격의 유저 가이드 갱신 대상이 아니다.
  - 누락된 동반 갱신: 없음(실사 결과 갭 없음).
  - 제안: 조치 불요. 참고로 남김.

- **[INFO]** 신규 field-level 코드 `MASKED_VALUE_RESUBMITTED` 는 frontend 어디에도 ko 매핑이 없으나, 기존 3개 형제 코드도 동일 — 이 PR 이 새로 만든 패턴 이탈이 아님
  - 변경 파일: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
  - 매트릭스 항목: 인접 개념(신규 errorCode → `backend-labels.ts` ERROR_KO) — 단, 이 코드의 SoT 파일(`trigger-parameter.types.ts`)은 `new-error-code` 행의 glob(`codebase/backend/src/nodes/core/error-codes.ts`) 대상이 아니라 엄밀히는 매칭 아님.
  - 상세: `grep -rn "TYPE_COERCION_FAILED|MISSING_REQUIRED_FIELD|INVALID_SCHEMA|MASKED_VALUE_RESUBMITTED" codebase/frontend/src` 결과 0건 — frontend 는 이 4개 코드 중 어느 것도 개별 매핑하지 않는다. 실사용 경로(`codebase/frontend/src/components/executions/rerun-modal.tsx`)의 `parseErrorCode`/`ERROR_CODE_TO_KEY` 는 최상위 `RERUN_*` 코드만 매핑하고, `details[].code`(필드별 코드)는 아예 읽지 않는다 — 매칭 실패 시 `t("history.rerun.genericError")` 로 폴백해 **영문 코드가 그대로 노출되지는 않는다**(CRITICAL 기준인 "영문 그대로 노출"에 해당 안 함). `workflows.controller.ts` 의 `execute()` 경로도 동일 구조(`INVALID_TRIGGER_PARAMETERS` 최상위 코드만 있고 세부 코드는 UI 에러 매핑 대상 밖).
  - 누락된 동반 갱신: 없음(CRITICAL 기준 미충족 — 원문 그대로 노출 안 됨). 다만 `MASKED_VALUE_RESUBMITTED` 의 backend message(`'Masked value was resubmitted — enter the real value'`, "타입이 아니라 마커이니 다시 입력하라"는 구체적 안내)가 실제로는 사용자에게 전혀 도달하지 못하고 일반 `genericError` 토스트로 뭉개진다는 점은, 이 PR 이 CHANGELOG 에서 강조한 "사용자가 취할 행동이 다르다(가려진 값을 다시 입력하라)" 라는 설계 의도가 UI 표면까지는 이어지지 않았다는 뜻 — 다만 이는 doc-sync 갭이라기보다 UX/frontend 구현 갭에 가깝고, 기존 3개 형제 코드도 동일하게 매핑 안 돼 있어 이번 diff 가 새로 만든 회귀는 아니다.
  - 제안: doc-sync 관점에서는 조치 불요. (참고: frontend 쪽에서 `details[].code` 를 읽어 필드별 안내를 보여주는 개선을 원한다면 별도 UX 개선 티켓 — 본 리뷰 범위 밖.)

## 요약

매트릭스 20개 행 중 `backend-api-change`(glob) 1개가 형식적으로 매칭됐고(`.controller.ts` 변경), 나머지 19개 행은 모두 미매칭 — 이번 diff 는 `codebase/frontend/**` 파일을 전혀 건드리지 않는 순수 백엔드 방어 계층 추가(EIA §R17 서버측 2층, Manual 실행 경로 마스킹 마커 재제출 거부)다. 매칭된 1개 행도 실사 결과 swagger 문구가 이미 포괄적이고, UI 정상 흐름은 이미 프런트 1층 가드로 문서화돼 있어 실질 동반 갱신 누락은 없음(CRITICAL 0, WARNING 0, INFO 2 — 둘 다 조치 불요 성격의 그레이존 기록).

## 위험도

NONE
