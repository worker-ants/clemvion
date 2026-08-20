STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows: 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 Read.

## 변경 파일 (git diff --name-only main...HEAD, 31개)
`codebase/frontend/**` 변경이 **0건**이다. 전부 `codebase/backend/**`(trigger-parameter 타입·resolve/reject 유틸·executions/workflows 서비스·컨트롤러·repo-guards·tsconfig), `spec/**`(planner 턴 정정), `plan/**`, `review/**`, `CHANGELOG.md` 다.

## trigger 매칭 검토

- **`new-node` / `node-schema-change`** (`codebase/backend/src/nodes/**`) — 변경 파일 중 `codebase/backend/src/nodes/` 하위는 0건 (신규 코드는 `modules/execution-engine/`, `modules/executions/`, `modules/workflows/`, `shared/utils/`, `repo-guards/` 에 위치). 매칭 안 됨.
- **`new-error-code`** (glob: `codebase/backend/src/nodes/core/error-codes.ts`) — 신규 `MASKED_VALUE_RESUBMITTED` / `masked_value_resubmitted` 는 이 파일이 아니라 `trigger-parameter.types.ts` 의 별도 네임스페이스(`TriggerParameterErrorDetail.code`)에 추가됐다. `codebase/backend/src/nodes/core/error-codes.ts` 를 직접 Grep 해 확인 — 이 enum 은 "노드 핸들러 `output.error.code`" 전용(§3.2 CONVENTIONS, `ERROR_KO` 매핑 대상)이고 트리거 파라미터 검증 에러와 별개 체계다. 매칭 안 됨.
- **`new-warning-code`** (backend warningRules) — `warningRules` 관련 파일 변경 없음. 매칭 안 됨.
- **`new-ui-string`** (`codebase/frontend/src/**/*.tsx`) — 프런트 TSX 변경 0건. 매칭 안 됨.
- **`new-userguide-section-dir`** — `content/docs/*/` 신규 디렉토리 없음. 매칭 안 됨.
- **`integration-provider-change`** — 해당 없음.
- **`auth-session-flow-change`** (`codebase/backend/src/modules/auth/**`) — 변경 파일에 `modules/auth/` 없음. 매칭 안 됨.
- **`expression-language-change`** (`codebase/packages/expression-engine/**`) — 매칭 안 됨.
- **`backend-api-change`** (glob: `**/*.controller.ts`, `**/dto/**`, match: semantic) — `codebase/backend/src/modules/workflows/workflows.controller.ts` 가 매칭된다 (`resolveTriggerParameters` → `resolveTriggerParametersRejectingMasked` 치환). 아래에서 상세 검토.
- **`run-debug-flow-change`** (semantic) — Manual 실행/재실행 경로의 검증 흐름 변경이라 후보. 아래에서 상세 검토.

### `backend-api-change` / `run-debug-flow-change` 상세 검토 (결론: 갱신 불요)

1. **swagger jsdoc** — `workflows.controller.ts:254` 의 `@ApiBadRequestResponse({ description: '트리거 파라미터 검증 실패' })` 는 이미 일반화된 문구고, 형제 reason 3종(`missing_required`/`coerce_failed`/`invalid_schema`)도 swagger 에 개별 열거돼 있지 않다. 신규 `masked_value_resubmitted` 도 같은 패턴을 따르므로 swagger 갱신 누락이 아니라 **기존 컨벤션과 일치**한다.

2. **프런트 소비 여부** — `codebase/frontend/src` 전체를 Grep 했다: `MISSING_REQUIRED_FIELD` / `TYPE_COERCION_FAILED` / `INVALID_SCHEMA` / `MASKED_VALUE_RESUBMITTED` 어느 것도 프런트에서 참조하지 않는다. `rerun-modal.tsx` 의 `ERROR_CODE_TO_KEY` (라인 91-102)는 top-level `error.code`(`RERUN_PERMISSION_DENIED` 등)만 매핑하고, 이번 변경이 던지는 `INVALID_INPUT`/`INVALID_TRIGGER_PARAMETERS` 는 이 표에 없어 `t("history.rerun.genericError")` 로 폴백한다 — 이는 이번 PR 이전부터 형제 reason 3종에도 동일하게 적용되던 기존 동작이다. 즉 이번 PR 은 **신규 gap 을 만들지 않는다**(기존 패턴을 그대로 따름). `backend-labels.ts` 의 `ERROR_KO`/`WARNING_KO` 도 이 네임스페이스와 무관해 매핑 대상이 아니다.

3. **사용자 가이드 문서 반영 여부** — `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:134` 이 이미 "자격증명으로 판별된 입력은 `***` 로 가려져 있어 프리필되지 않아요 — 직접 입력하기 전까지 Re-run 이 비활성되고 …" 라고 서술해, 마스킹된 값으로는 재실행이 안 된다는 사용자 관점 결론을 이미 담고 있다(선행 PR `c9cc2a923` 가 기술한 프런트 가드 설명). 이번 PR 은 **같은 결론의 서버측 2층 방어**(curl 등 UI 우회 클라이언트 대상)라 정상 UI 플로우에서 관측되는 동작에 변화가 없다 — 문서가 stale 해지지 않는다.

## 발견사항

없음 — 매칭된 trigger(`backend-api-change`) 는 있으나, 그 target(swagger jsdoc·user-guide 페이지) 이 이미 기존 컨벤션/기존 문서로 충족돼 있어 실제 갱신 공백이 없다. `codebase/frontend/**` 변경이 이번 PR 에 전혀 없고, i18n dict·backend-labels.ts·docs MDX 어느 것도 이 변경으로 인해 stale 해지지 않는다.

## 요약
매트릭스 20개 행 중 glob/semantic 으로 후보가 된 것은 `backend-api-change`(`workflows.controller.ts` 매칭) 1건뿐이었고, 실사(swagger 문구·프런트 소비 코드·기존 user-guide 서술)로 대조한 결과 동반 갱신 공백은 0건이었다 — 이번 PR 은 순수 백엔드 방어 계층 추가(서버측 마스킹 마커 재제출 거부)이며 신규 코드/라벨/노드/문자열/섹션이 프런트에 노출되지 않는다.

## 위험도
NONE
