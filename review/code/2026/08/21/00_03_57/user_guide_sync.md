STATUS=success user_guide_sync review complete — 0 CRITICAL, 0 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — `inputOverride` 마커 재제출 서버측 거부

## 매트릭스 적재 · 변경 파일 확정

`.claude/config/doc-sync-matrix.json` (`rows[]` 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(127~209행)을 SSOT 로 적재. 실제 변경 set 은 프롬프트의 41개 파일 목록과 `git diff --name-only origin/main...HEAD` 결과가 정확히 일치함을 확인했다(41 파일, 편차 없음). 구성:

- backend `.ts`/`.spec.ts` 8개 — `execution-engine/{types,utils}`·`executions.service.ts`·`workflows.controller.ts`(+ spec) · `shared/utils/sanitize-error-message.ts`
- `plan/in-progress/*.md` 2개, `review/consistency/**` 24개(3라운드 consistency-check 산출물)
- `spec/**.md` 7개 — `1-data-model.md` · `3-workflow-editor/3-execution.md` · `4-nodes/7-trigger/1-manual-trigger.md` · `5-system/{12-webhook,13-replay-rerun,14-external-interaction-api,3-error-handling}.md`

**`codebase/frontend/**` 파일은 이 변경 set 에 단 하나도 없다** — `.tsx`/`dict/**`/`content/docs/**`/`backend-labels.ts` 전부 미포함.

## trigger 매칭 결과

| 매트릭스 행 | 매칭 여부 | 판단 근거 |
|---|---|---|
| 새 노드 추가 / 노드 schema 변경 (`codebase/backend/src/nodes/**`) | 불일치 | 변경 파일이 `nodes/**` 아래 없음 (execution-engine·executions·workflows·shared 모듈) |
| 신규 UI 문자열 (TSX) | 불일치 | 이번 diff 에 `.tsx` 파일 0개 — 프런트 마스킹 가드는 선행 PR(#1180/#1181, 커밋 `b677564e0`/`c9cc2a923`)에서 이미 병합됨, 이번 changeset 범위 밖 |
| 유저 가이드 신규 섹션 디렉토리 | 불일치 | 신규 `content/docs/<NN>-*/` 없음 |
| 통합/제공자 변경 | 불일치 | 해당 없음 |
| **백엔드 API 추가·변경** (`*.controller.ts`) | **매칭** — `workflows.controller.ts` | 아래 상세 |
| 신규 errorCode 발행 (`nodes/core/error-codes.ts` 의 `ErrorCode` enum) | 불일치(글로브 미스매치) | 아래 상세 |
| 신규 warningCode 발행 | 불일치 | `warningRules` 변경 없음 |
| 인증·권한·세션 흐름 변경 | 불일치 | `auth/**` 변경 없음 |
| 표현식 언어 변경 | 불일치 | `expression-engine/**` 변경 없음 |
| 실행·디버깅 흐름 변경 (semantic) | 회색지대 — 아래 상세 | |
| spec 신규/대규모 변경 (`spec/{3,4,5}-*/**`) | 매칭이나 이미 3라운드 consistency-check 로 처리 완료(BLOCK:NO, Critical 0) | 아래 상세 |

## 발견사항

- **[INFO]** `workflows.controller.ts` 가 "백엔드 API 추가·변경" trigger 에 매칭되지만 target (a)(swagger jsdoc)·(b)(user-guide 페이지) 갱신이 없다 — 실사용 영향은 낮다고 판단
  - 변경 파일: `codebase/backend/src/modules/workflows/workflows.controller.ts` (`execute` 핸들러에 `findMaskedResubmissions` 체크 + `MASKED_VALUE_RESUBMITTED` 신규 거부 분기 추가)
  - 매트릭스 항목: "백엔드 API 추가·변경" — "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 상세: `execute` 엔드포인트의 `@ApiBadRequestResponse({ description: '트리거 파라미터 검증 실패' })` 는 이번 PR 이전부터 개별 `details[].code` 값(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`)을 열거하지 않는 포괄 서술이었고, 신규 `MASKED_VALUE_RESUBMITTED` 도 같은 포괄 서술 안에 자연히 포함된다 — **swagger 서술의 정밀도 저하는 이번 PR 이 만든 회귀가 아니라 기존 패턴의 연장**이다. `codebase/frontend/src/content/docs/**` 쪽도 실측 확인 결과: (1) `05-run-and-debug/run-results.mdx` 134행이 이미 "자격증명 입력은 `***`로 가려져 프리필되지 않고, 직접 입력 전까지 Re-run 비활성" 을 문서화(선행 PR #1181), (2) `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 의 `handleRunWithInput` 은 JSON 에디터에서 마스킹 마커가 leaf 에 남아 있으면 Run 자체를 비활성화한다(`hasMaskedMarkerLeaf`, 선행 PR). 즉 정상 GUI 경로로는 신규 서버측 400 을 **사실상 도달할 수 없다** — 이번 PR 이 추가한 건 UI 를 우회하는 직접 API 호출(`curl` 등)에 대한 방어 계층이라, 일반 사용자가 보는 가이드 문서·GUI 문구를 바꿀 필요가 옅다. `spec/` 쪽(진짜 기술 SoT)은 7개 파일에 걸쳐 이례적으로 촘촘히 갱신됐고 3라운드 consistency-check(`19_34_37`→`19_48_56`→`23_33_00`)에서 BLOCK:NO·Critical 0 으로 수렴한 상태다.
  - 제안: 조치 불요. 다만 향후 이 방어 계층이 실제로 트리거되는 사례(관측 로그 등)가 생기면 그때 `codebase/frontend/src/content/docs/05-run-and-debug/` 에 "직접 API 호출 시 400 이 날 수 있다" 캐비엇을 추가 검토.

- **[INFO]** 신규 `MASKED_VALUE_RESUBMITTED` / 자매 코드 3종이 `backend-labels.ts` 의 `ERROR_KO` 에 매핑되지 않지만, 이는 매트릭스의 `error-codes.ts` glob 트리거 범위 밖이며 기존과 동형이다
  - 변경 파일: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` (`REASON_TO_DETAIL` 에 `masked_value_resubmitted → MASKED_VALUE_RESUBMITTED` 4번째 항 추가)
  - 매트릭스 항목: "신규 errorCode 발행 (`codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 추가)" — trigger.globs 가 `nodes/core/error-codes.ts` 로 정확히 스코프됨(`match: "glob"`)
  - 상세: `error-codes.ts` 의 `ErrorCode` 는 "node handlers' `output.error.code`"(노드 실행 실패) 전용 taxonomy 로, JSDoc 에 명시돼 있음. `TriggerParameterErrorDetail.code`(이번 PR 의 대상)는 **실행 시작 전 파라미터 검증** 이라는 별개 taxonomy 다 — 실측: 기존 형제 코드 `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA` 도 `backend-labels.ts` 의 `ERROR_KO`/`WARNING_KO` 어디에도 매핑돼 있지 않음(grep 0건). 신규 `MASKED_VALUE_RESUBMITTED` 가 같은 미매핑 상태로 합류하는 것은 **이번 PR 이 만든 회귀가 아니라 기존 taxonomy 의 기존 정책과 정합**이다. `frontend/src/components/executions/rerun-modal.tsx` 의 `ERROR_CODE_TO_KEY` 도 `RERUN_*` 4종만 매핑하고 `INVALID_INPUT`/`INVALID_TRIGGER_PARAMETERS` 는 애초부터 없어 제네릭 에러 토스트로 폴백한다 — 이 폴백 경로 자체도 선행 상태.
  - 제안: 조치 불요(매트릭스 gate 밖). 다만 PROJECT.md 143행 "자주 누락" 문구("백엔드가 새 warning/error 코드를 발행하면 ... 같은 commit 에")는 `error-codes.ts` 외의 taxonomy 에도 적용될 수 있는 넓은 표현이라, 향후 이 taxonomy(`TriggerParameterErrorDetail`) 를 위한 별도 매핑 정책이 필요하다고 판단되면 `project-planner` 턴에서 명문화 검토(코드 변경 아님, 이번 리뷰의 차단 사유는 아님).

## 요약

매트릭스 21행 중 "백엔드 API 추가·변경"(semantic, `workflows.controller.ts` 매칭) 1행만 형식적으로 매칭됐고, 실사용 영향 실측 결과 target 미갱신이 사용자 가시 회귀로 이어지지 않아 CRITICAL/WARNING 없이 INFO 2건으로 수렴했다. 이번 changeset 은 `codebase/frontend/**` 파일을 전혀 포함하지 않아(41개 변경 파일 전량이 backend/plan/review/spec) 노드·i18n dict·섹션 디렉토리·통합 provider 관련 8개 trigger 는 전부 매칭되지 않았고, `spec/**` 7개 파일은 이미 3라운드 consistency-check(BLOCK:NO, Critical 0)로 별도 처리 완료된 상태를 재확인했다. 신규 에러 코드(`MASKED_VALUE_RESUBMITTED`)는 `error-codes.ts` `ErrorCode` enum 과 다른 taxonomy(`TriggerParameterErrorDetail`)에 속해 `backend-labels.ts` `ERROR_KO` 매핑 트리거 글로브 밖이며, 형제 코드 3종과 동일하게 기존부터 미매핑 상태라 회귀가 아니다.

## 위험도

NONE
