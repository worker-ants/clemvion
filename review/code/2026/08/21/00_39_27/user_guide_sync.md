STATUS=success user_guide_sync review complete — 0 CRITICAL, 0 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — `inputOverride`/`parameterValues` 마스킹 마커 재제출 서버측 거부 (RESOLUTION 라운드)

## 매트릭스 적재 · 변경 파일 확정

`.claude/config/doc-sync-matrix.json` (`rows[]` 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(127~209행)을 SSOT 로 적재. `git diff --name-only origin/main...HEAD` 로 실제 변경 set 을 재확인 — 57개 파일, prompt 목록과 일치. 구성:

- backend `.ts`/`.spec.ts` 8개 — `execution-engine/{types,utils}` (신규 `reject-masked-resubmission.ts`/`.spec.ts` 포함) · `executions.service.ts`(+spec) · `workflows.controller.ts`(+spec) · `shared/utils/sanitize-error-message.ts`
- `CHANGELOG.md` 1개, `plan/in-progress/*.md` 2개
- `review/code/2026/08/21/00_03_57/**` 12개 (직전 라운드 리뷰+RESOLUTION 산출물) + `review/consistency/2026/08/20/{19_34_37,19_48_56,23_33_00}/**` 24개 (3라운드 consistency-check 산출물)
- `spec/**.md` 7개 — `1-data-model.md` · `3-workflow-editor/3-execution.md` · `4-nodes/7-trigger/1-manual-trigger.md` · `5-system/{12-webhook,13-replay-rerun,14-external-interaction-api,3-error-handling}.md`

**`codebase/frontend/**` 파일은 이번 변경 set 에 단 하나도 없다** — `.tsx`/`dict/**`/`content/docs/**`/`backend-labels.ts`/`lib/docs/locale.ts` 전부 미포함. 이는 직전 라운드(`00_03_57`)와 동일하며, 이번 라운드는 그 리뷰의 CRITICAL(boolean 우회)·WARNING(errors/details 봉투, 표 행 캐비엇, 트래커 미종결, CHANGELOG 부재) 수정만 추가했을 뿐 프런트 표면을 건드리지 않았다.

## trigger 매칭 결과

| 매트릭스 행 | 매칭 여부 | 판단 근거 |
|---|---|---|
| 새 노드 추가 / 노드 schema 변경 (`codebase/backend/src/nodes/**`) | 불일치 | 변경 파일이 `nodes/**` 아래 없음 |
| 신규 UI 문자열 (TSX) | 불일치 | 이번 diff 에 `.tsx` 파일 0개 |
| 유저 가이드 신규 섹션 디렉토리 | 불일치 | 신규 `content/docs/<NN>-*/` 없음 |
| 통합/제공자 변경 | 불일치 | 해당 없음 |
| **백엔드 API 추가·변경** (`*.controller.ts`) | **매칭** — `workflows.controller.ts` | 아래 상세 (직전 라운드와 판단 불변) |
| 신규 errorCode 발행 (`nodes/core/error-codes.ts` 의 `ErrorCode` enum) | 불일치(글로브 미스매치) | 아래 상세 |
| 신규 warningCode 발행 | 불일치 | `warningRules` 변경 없음 |
| 인증·권한·세션 흐름 변경 | 불일치 | `auth/**` 변경 없음 |
| 표현식 언어 변경 | 불일치 | `expression-engine/**` 변경 없음 |
| 실행·디버깅 흐름 변경 (semantic) | 회색지대 — 아래 상세 | |
| spec 신규/대규모 변경 (`spec/{3,4,5}-*/**`) | 매칭이나 3라운드 consistency-check 로 이미 처리 완료(BLOCK:NO, Critical 0) | — |

## 발견사항

- **[INFO]** `workflows.controller.ts` 가 "백엔드 API 추가·변경" trigger 에 매칭되지만 target (a)(swagger jsdoc)·(b)(user-guide 페이지) 갱신이 이번 라운드에도 없다 — 실사용 영향은 낮음(직전 라운드 판단 재확인)
  - 변경 파일: `codebase/backend/src/modules/workflows/workflows.controller.ts` (`execute` 핸들러가 `resolveTriggerParametersRejectingMasked` 로 교체돼 `MASKED_VALUE_RESUBMITTED` 신규 거부 분기 획득)
  - 매트릭스 항목: "백엔드 API 추가·변경" — "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 상세: `execute` 엔드포인트의 `@ApiBadRequestResponse({ description: '트리거 파라미터 검증 실패' })` (`workflows.controller.ts` 249행)는 개별 `details[].code` 값(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`)을 열거하지 않는 포괄 서술이었고, 신규 `MASKED_VALUE_RESUBMITTED` 도 같은 포괄 서술 안에 자연히 포함돼 swagger 정밀도 저하가 이번 PR 의 회귀가 아니다. 실측 재확인: (1) `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` 134행("자격증명 입력은 `***`로 가려져 프리필되지 않고, 직접 입력 전까지 Re-run 비활성")·`running-a-workflow.mdx` 32행이 이미 UI 레벨 마스킹 흐름을 정확히 문서화(선행 PR #1180/#1181), (2) `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 의 `handleRunWithInput` 은 `hasMaskedMarkerLeaf` 로 마커가 leaf 에 남아 있으면 Run 자체를 막고, 이 신규 서버측 400 에러는 catch 블록에서 `console.error` 만 하고 사용자에게 노출하지 않음(raw 영문 메시지 leak 없음), (3) `rerun-modal.tsx` 의 `ERROR_CODE_TO_KEY` 도 `RERUN_*` 4종만 매핑하고 `INVALID_INPUT`/`INVALID_TRIGGER_PARAMETERS` 는 제네릭 토스트로 폴백 — 이 폴백 자체가 선행 상태(회귀 아님). 즉 정상 GUI 경로로는 신규 서버측 400 에 사실상 도달할 수 없고, 도달해도 영문 원문이 사용자에게 노출되지 않는다. `spec/` 쪽은 이번 라운드에 `spec/5-system/3-error-handling.md` §1.7 캐비엇("re-run 이 세 번째 소비처로 늘어난 시점", `MASKED_VALUE_RESUBMITTED` 는 재제출 경로 한정)까지 추가로 촘촘해졌다.
  - 제안: 조치 불요. 향후 이 방어 계층이 실제로 트리거되는 사례(운영 로그 등)가 관측되면 `05-run-and-debug/` 에 "직접 API 호출 시 400 이 날 수 있다" 캐비엇 추가를 검토.

- **[INFO]** 신규 `MASKED_VALUE_RESUBMITTED` 가 `backend-labels.ts` 의 `ERROR_KO` 에 매핑되지 않지만, 매트릭스의 `error-codes.ts` glob 트리거 범위 밖이며 형제 코드 3종과 동형이다
  - 변경 파일: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` (`REASON_TO_DETAIL` 에 `masked_value_resubmitted → MASKED_VALUE_RESUBMITTED` 4번째 항 추가)
  - 매트릭스 항목: "신규 errorCode 발행 (`codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 추가)" — trigger.globs 가 `nodes/core/error-codes.ts` 로 정확히 스코프됨(`match: "glob"`)
  - 상세: `error-codes.ts` 의 `ErrorCode` 는 "node handlers' `output.error.code`"(노드 실행 실패) 전용 taxonomy 이고, `TriggerParameterErrorDetail.code`(이번 PR 대상)는 실행 시작 **전** 파라미터 검증이라는 별개 taxonomy 다. 실측(`grep`): `codebase/frontend/src/lib/i18n/backend-labels.ts`·`dict/{ko,en}/*.ts` 어디에도 `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED`/`INVALID_TRIGGER_PARAMETERS`/`INVALID_INPUT` 매칭 0건 — 신규 코드가 같은 미매핑 상태로 합류하는 것은 이번 PR 이 만든 회귀가 아니라 기존 정책과 정합.
  - 제안: 조치 불요(매트릭스 gate 밖). `TriggerParameterErrorDetail` taxonomy 를 위한 별도 매핑 정책이 필요하다고 판단되면 `project-planner` 턴에서 명문화 검토(이번 리뷰의 차단 사유는 아님).

## 요약

매트릭스 21행 중 "백엔드 API 추가·변경"(semantic, `workflows.controller.ts` 매칭) 1행만 형식적으로 매칭됐고, 실사용 영향 실측 결과(UI 는 마스킹 마커를 애초에 제출 자체를 막고, 도달해도 raw 영문이 사용자에게 노출되지 않음) target 미갱신이 사용자 가시 회귀로 이어지지 않아 CRITICAL/WARNING 없이 INFO 2건으로 수렴했다. 이번 changeset(57개 파일 — backend 8·CHANGELOG 1·plan 2·review 산출물 36·spec 7·spec-sync tracker 갱신)은 `codebase/frontend/**` 파일을 전혀 포함하지 않아 노드·i18n dict·섹션 디렉토리·통합 provider 관련 8개 trigger 는 매칭되지 않았고, `spec/**` 7개 파일은 3라운드 consistency-check(BLOCK:NO, Critical 0)로 이미 처리 완료된 상태를 재확인했다. 직전 라운드(`00_03_57/user_guide_sync.md`)의 독립 분석과 결론이 완전히 일치(convergent).

## 위험도

NONE
