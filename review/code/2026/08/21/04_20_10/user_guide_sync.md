STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — 마커 재제출 서버측 거부 (EIA §R17, Manual 실행 경로) — 4차 라운드

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` `rows[]`(21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 함께 적재했다.

## 변경 파일 확정

`git diff --name-only origin/main...HEAD` 로 전체 changeset 을 재확인했다(spec 7 + backend 12 + CHANGELOG 1 + plan 3 + review 산출물 다수). 실제 애플리케이션 코드 변경은 **전부 `codebase/backend/**`** 이고, 프롬프트의 파일 1~13 과 정확히 일치한다:

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` — `masked_value_resubmitted`/`MASKED_VALUE_RESUBMITTED` 신규 reason/code 추가
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.{ts,spec.ts}` — 신규 파일(재제출 거부 판정기)
- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.spec.ts`
- `codebase/backend/src/modules/executions/{executions.service.ts,executions-rerun.service.spec.ts}`
- `codebase/backend/src/modules/workflows/{workflows.controller.ts,workflows.controller.spec.ts}`
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers{-guard.ts,.spec.ts}` — 신규 저장소 가드(테스트 전용)
- `codebase/backend/src/shared/utils/sanitize-error-message.{ts,spec.ts}` — `MASKED_MARKERS`/`isMaskedMarker` export 승격 + `Set`→`readonly string[]` 실제 불변화
- `codebase/backend/tsconfig.build.json` — `src/repo-guards/**` 빌드 제외

**`codebase/frontend/**` 파일은 이번 changeset 전체(코드+plan+review+spec 포함 149개 파일)에 단 하나도 없다** — `.tsx`/`dict/**`/`content/docs/**`/`backend-labels.ts`/`lib/docs/locale.ts` 전부 미포함. 이는 직전 3라운드(`00_03_57`→`00_39_27`→`01_15_47`→`03_14_16`)와 동일하며, 이번 라운드가 새로 얹은 것은 `sanitize-error-message.ts` 의 `MASKED_MARKERS` 캡슐화 정정(런타임 freeze 반증→실제 불변화) + 저장소 가드 신규 + `tsconfig.build.json` 제외 규칙뿐으로, 전부 backend 내부 구현/빌드 설정이라 매트릭스 어느 trigger 도 새로 열지 않는다.

## trigger 매칭 결과

| 매트릭스 행 | 매칭 여부 | 판단 근거 |
|---|---|---|
| 새 노드 추가 / 노드 schema 변경 (`nodes/**`) | 불일치 | 변경 파일이 `nodes/**` 아래 없음 |
| 신규 UI 문자열 (TSX) | 불일치 | `.tsx` 파일 0개 |
| 유저 가이드 신규 섹션 디렉토리 | 불일치 | 신규 `content/docs/<NN>-*/` 없음 |
| 통합/제공자 변경 | 불일치 | 해당 없음 |
| **백엔드 API 추가·변경** (`*.controller.ts`) | **매칭** — `workflows.controller.ts` | 아래 상세 — 갭 없음(INFO) |
| 신규 errorCode 발행 (`nodes/core/error-codes.ts`) | glob 불일치 | `MASKED_VALUE_RESUBMITTED` 는 별도 taxonomy(`TriggerParameterErrorDetail.code`), 그 파일을 건드리지 않음 |
| 신규 warningCode 발행 (`warningRules`) | 불일치 | `warningRules` 는 노드 스키마 cross-field 검증 전용 시스템, 이번 diff 와 무관 |
| 인증·권한·세션 흐름 변경 (`auth/**`) | 불일치 | 변경 없음 |
| 표현식 언어 변경 (`expression-engine/**`) | 불일치 | 변경 없음 |
| 실행·디버깅 흐름 변경 (semantic) | 회색지대 — 아래 상세 | 갭 없음(INFO) |
| spec 신규/대규모 변경 (`spec/{3,4,5}-*/**`) | 매칭이나 별도 처리 완료 | 3라운드 consistency-check(BLOCK:NO, Critical 0) + `plan/complete/spec-update-masked-reject-framing.md` planner 정정 완료 — user-guide-sync 범위 밖 |

## 발견사항

- **[INFO]** `MASKED_VALUE_RESUBMITTED` 가 `backend-labels.ts` 의 `ERROR_KO`/`WARNING_KO` 어느 쪽에도 매핑되지 않지만, frontend 가 애초에 `details[].code`(필드별 세부 코드)를 소비하지 않아 영문 노출 위험이 없다 — 독립 재검증 완료
  - 변경 파일: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` (`REASON_TO_DETAIL` 4번째 항)
  - 매트릭스 항목: `new-error-code`/`new-warning-code` — "frontend `backend-labels.ts` 의 `WARNING_KO`/`ERROR_KO` 매핑 누락 시 CRITICAL (영문 SoT 가드 — 매핑 없으면 사용자에게 영문 그대로 노출됨)"
  - 상세: 이번 라운드에서도 직접 확인했다. `grep -rn "MISSING_REQUIRED_FIELD\|TYPE_COERCION_FAILED\|INVALID_SCHEMA\|MASKED_VALUE_RESUBMITTED" codebase/frontend/src/` → 0건. 두 소비처 모두 **상위 봉투 `code`**(`error.code`, 예: `INVALID_INPUT`)만 읽고 `details[].code` 자체를 안 본다:
    - `codebase/frontend/src/components/executions/rerun-modal.tsx:91-102,444-447` — `ERROR_CODE_TO_KEY` 는 `RERUN_PERMISSION_DENIED`/`RERUN_CHAIN_DEPTH_EXCEEDED`/`RERUN_WORKFLOW_DELETED`/`RERUN_DRY_RUN_NOT_APPLICABLE` 4종만 매핑, `INVALID_INPUT` 은 없어 `t("history.rerun.genericError")` 로 폴백 — 영문 원문 노출 없음.
    - `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (`handleRunWithInput`) — 400 을 잡아도 raw 코드/메시지를 사용자에게 echo 하지 않음.
    - 형제 3종(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`)도 이 diff 이전부터 동일하게 미매핑 상태 — 신규 코드가 같은 상태로 합류할 뿐 이번 PR 이 만든 회귀가 아니다.
  - 결론: 매트릭스 glob(`nodes/core/error-codes.ts`) 밖이고, semantic 취지("영문 노출")도 실측상 위반이 아니라 CRITICAL 로 올리지 않는다. 3개 선행 라운드(`00_03_57`/`00_39_27`/`03_14_16`)가 동일 결론에 독립 수렴했고, `01_15_47/RESOLUTION.md` INFO-10 도 같은 판단으로 미조치 처리한 항목이다.
  - 제안: 조치 불요. 다만 향후 `TriggerParameterErrorDetail.code` taxonomy 전용 `ERROR_KO` 서브맵을 신설한다면 4종(형제 3 + `MASKED_VALUE_RESUBMITTED`)을 한 번에 등재하는 편이 자매 발산을 막는다 — 이번 PR 스코프는 아님.

- **[INFO]** `run-debug-flow-change`(실행·디버깅 흐름 변경) — 사용자 관찰 가능한 UI 흐름 변경 없어 `05-run-and-debug/` 갱신 불필요
  - 변경 파일: `codebase/backend/src/modules/executions/executions.service.ts`, `codebase/backend/src/modules/workflows/workflows.controller.ts`
  - 매트릭스 항목: `run-debug-flow-change` — targets `codebase/frontend/src/content/docs/05-run-and-debug/`
  - 상세: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:134` 가 이미 "자격증명으로 판별된 입력은 `***` 로 가려져 프리필되지 않고, 직접 입력 전까지 Re-run 이 비활성" 을 문서화(선행 PR #1180/#1181). 이번 PR 이 추가하는 서버측 거부는 그 클라이언트 가드를 이미 통과한 뒤에만(즉 UI 를 우회하는 curl 등 비-GUI 클라이언트에만) 닿는 2차 방어층이라, 문서가 서술하는 사용자 관찰 동작(Re-run 버튼 비활성화)은 변하지 않는다.
  - 제안: 조치 불요. 향후 이 방어 계층이 실제 운영에서 트리거되는 사례가 관측되면 "직접 API 호출 시 400 이 날 수 있다" 캐비엇 추가를 검토.

- **[INFO]** `backend-api-change` glob 매칭(`workflows.controller.ts`) — swagger jsdoc 갱신 여부 확인, 갱신 불요
  - 변경 파일: `codebase/backend/src/modules/workflows/workflows.controller.ts` (`execute` 핸들러)
  - 매트릭스 항목: `backend-api-change` — targets "controller·DTO 의 swagger jsdoc" + "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 상세: `@ApiBadRequestResponse({ description: '트리거 파라미터 검증 실패' })` 는 기존부터 개별 reason 을 나열하지 않는 포괄 서술이었고, 신규 `masked_value_resubmitted` 도 같은 관행 안에 자연히 포함된다 — swagger 정밀도 저하는 이번 PR 의 회귀가 아니라 기존 패턴의 연장.
  - 제안: 조치 불요.

## 요약

매트릭스 21행 중 glob 직접 매칭 1건(`backend-api-change`)만 형식적으로 매칭됐고, semantic 후보(신규 코드 2행 · 실행/디버깅 흐름 1행)를 함께 검토했으나 실제 diff 가 `codebase/backend/**` 로 완전히 한정되고(`codebase/frontend/**` 파일 0개, 이번 라운드 재확인) `MASKED_VALUE_RESUBMITTED` 는 frontend 가 애초에 소비하지 않는 taxonomy 라 영문 노출 위험이 없으며, 사용자 관찰 가능한 Re-run/Run-with-Input UI 흐름은 선행 PR 문서 그대로 유지된다. 4개 독립 라운드(`00_03_57`→`00_39_27`→`01_15_47`→`03_14_16`)가 모두 CRITICAL 0·WARNING 0·NONE 위험도로 수렴했고, 이번 5차 라운드도 동일 결론에 독립적으로 도달했다 — 이번 라운드에 신규로 얹힌 코드(`sanitize-error-message.ts` 의 `MASKED_MARKERS` 캡슐화 정정, 저장소 가드 신규, `tsconfig.build.json` 제외 규칙)는 전부 backend 내부 구현/빌드 설정이라 새 trigger 를 열지 않는다. 동반 갱신 누락 CRITICAL/WARNING 없음.

## 위험도

NONE
