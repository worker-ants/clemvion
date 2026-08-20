STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 점검 요약

매트릭스([`.claude/config/doc-sync-matrix.json`](../../../../../.claude/config/doc-sync-matrix.json)) `rows[]` 22개 trigger 를 변경 파일 92개(백엔드 서버측 마커 거부 구현 + 테스트 + CHANGELOG + `plan/**` + `spec/**` + 선행 리뷰 산출물)에 매칭했다. 핵심 코드 변경은 100% 백엔드(`codebase/backend/**`) — `codebase/frontend/src/**`(TSX·dict·docs MDX)는 이번 변경 set 에 **전혀 포함되지 않았다**. 매칭되는 trigger 후보를 순서대로 검증한 결과는 아래와 같다.

## 발견사항

- **[INFO]** `workflows.controller.ts` 의 신규 400 필드 코드가 swagger jsdoc 에 반영되지 않음 (사전 존재하던 갭, 심화 아님)
  - 변경 파일: `codebase/backend/src/modules/workflows/workflows.controller.ts` (execute 메서드, `resolveTriggerParametersRejectingMasked` 호출부)
  - 매트릭스 항목: `backend-api-change` — trigger `codebase/backend/src/**/*.controller.ts` (glob 매칭). targets: "controller·DTO 의 swagger jsdoc", "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 확인 내용: `execute()` 메서드의 `@ApiResponse` 데코레이터는 `503 SERVER_SHUTTING_DOWN` 만 예시로 싣고 있고 (라인 259 부근), 400 `INVALID_TRIGGER_PARAMETERS` 분기는 이 PR 이전부터 swagger 에 전혀 문서화돼 있지 않다 (`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA` 도 마찬가지). 신규 `MASKED_VALUE_RESUBMITTED` 는 이미 미문서화된 그 400 분기 안에 필드 코드 하나가 늘어난 것뿐이라, 이 PR 이 새로 만든 갭이 아니라 기존 패턴을 그대로 따른 것이다.
  - 상세: 이 400 은 API 를 직접 호출하는 외부 통합 개발자에게는 **행동 변화**다 — 이전에는 리터럴 `'***'` 값이 자격증명 필드로 조용히 수리(受理)됐지만(원 결함), 이제는 명시적으로 거부된다. `spec/conventions/swagger.md` 는 이 프로젝트의 정식 swagger 컨벤션이지만 이 400 분기에 대한 자동 가드(`*.test.ts`)는 없다 — `guard_tests: []`, `verify: null` (매트릭스 원문 그대로).
  - 제안: 필수는 아니나, `@ApiResponse({ status: 400, ... })` 예시에 `MASKED_VALUE_RESUBMITTED` 를 포함한 `details[]` 샘플을 추가하면 외부 API 통합자에게 도움이 된다. Blocking 은 아님 — 후속 PR 로 미뤄도 무방.

- **[INFO]** `codebase/frontend/src/content/docs/05-run-and-debug/` 가 서버측 2층 방어(§R17 서버측 거부)를 명시하지 않음 — 다만 UI 관측 동작은 이미 정확히 기술돼 있어 실사용자 영향 없음
  - 변경 파일: `codebase/backend/src/modules/executions/executions.service.ts`, `codebase/backend/src/modules/workflows/workflows.controller.ts` (Manual 실행 경로 마커 거부 신설)
  - 매트릭스 항목: `run-debug-flow-change` (semantic) — targets: `codebase/frontend/src/content/docs/05-run-and-debug/`
  - 확인 내용: `running-a-workflow.mdx:32` 와 `run-results.mdx:134` 는 이미 **프런트 UI 가드**(Run/Re-run 버튼이 마스킹 마커가 남아 있는 동안 비활성)를 정확히 설명하고 있다. 이번 PR 은 그 UI 가드를 우회하는 직접 API 호출(curl 등)에 대한 **서버측 안전망**만 추가했을 뿐, UI 를 거쳐 상호작용하는 일반 사용자가 관측하는 동작은 바뀌지 않는다(버튼은 여전히 비활성 상태이고 정상적으로는 이 서버 거부 경로에 절대 도달하지 않는다). 따라서 유저 가이드가 "stale" 상태는 아니다.
  - 상세: gray-zone 으로 분류한 이유 — trigger 자체는 "실행·디버깅 흐름 변경"에 해당하지만, 문서가 서술하는 내용(사용자가 관측 가능한 UI 동작)이 이번 PR 로 변하지 않았다. `spec/3-workflow-editor/3-execution.md`(엔지니어링 spec, 이번 diff 에 포함)에는 이미 서버 2층 거부가 상세히 반영됐다 — 이는 `spec/` SoT 이지 `codebase/frontend/src/content/docs/`(사용자 가이드) 는 아니다.
  - 제안: Blocking 아님. 원한다면 `05-run-and-debug/running-a-workflow.mdx` 에 "직접 API 호출도 동일하게 거부된다" 한 문장을 덧붙여 API 통합자를 위한 참고로 남길 수 있으나, 현재 서술이 오도하지는 않는다.

## 확인했으나 갭이 없는 영역 (근거 포함)

- **i18n dict parity (`new-ui-string`)**: 이번 변경 set 에 `codebase/frontend/src/**/*.tsx` 가 **하나도 없다** — 신규 한국어 리터럴 없음. 매칭 대상 없음.
- **backend warning/error → ko 매핑 (`new-warning-code`/`new-error-code`)**: 신규 `MASKED_VALUE_RESUBMITTED` 코드는 `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum이 아니라 `trigger-parameter.types.ts` 의 별도 좁은 taxonomy(`TriggerParameterErrorDetail.code`)다 — glob 매칭 대상이 아니다. 더 중요하게, `grep -rn "MASKED_VALUE_RESUBMITTED\|MISSING_REQUIRED_FIELD\|TYPE_COERCION_FAILED\|INVALID_SCHEMA" codebase/frontend/src` 결과가 **전무**해 이 코드 패밀리는 (신규·기존 형제 코드 모두) `backend-labels.ts` 의 `WARNING_KO`/`ERROR_KO` 파이프라인에 애초에 연결돼 있지 않다. 실제 소비처 확인 결과: `rerun-modal.tsx` 는 최상위 `error.code`(예: `RERUN_PERMISSION_DENIED`)만 `ERROR_CODE_TO_KEY` 로 매핑하고 나머지는 이미 ko/en 양쪽에 등록된 `history.rerun.genericError` 로 폴백하며, `editor-toolbar.tsx` 의 `handleRun`/`handleRunWithInput` 오류 핸들러는 `console.error` 만 하고 사용자에게 아무 텍스트도 렌더링하지 않는다. 즉 이 신규 코드가 사용자에게 영문 그대로 노출되는 렌더 경로가 **존재하지 않는다** — CRITICAL 기준("매핑 없으면 사용자에게 영문 그대로 노출")이 성립하지 않는다.
- **노드 신규/schema 변경**: `codebase/backend/src/nodes/**` 변경 없음. 매칭 대상 없음.
- **통합/제공자 변경**: 해당 없음.
- **신규 유저 가이드 섹션 디렉토리**: `codebase/frontend/src/content/docs/*/` 신규 디렉토리 없음(기존 `05-run-and-debug/` 안의 기존 파일만 잠재 대상이었고 실제로도 변경 없음). `locale.ts` 등록 이슈 없음.
- **인증·권한·세션 흐름 변경**: `codebase/backend/src/modules/auth/**` 변경 없음.
- **표현식 언어 변경**: `codebase/packages/expression-engine/**` 변경 없음.
- **webhook 응답 코드 표(`triggers.mdx:142-152`)**: PR 설계상 마커 거부는 **Manual 실행 경로 전용**이고 webhook·schedule 은 명시적으로 제외됐다(저작 주체 기준) — 그 표는 그대로 정확하다. Manual `/execute` 자체는 애초에 이 문서에 "응답 코드" 표가 없어(webhook 만 있음) 이 PR 로 새로 stale 해진 것도 아니다.
- **spec/ 문서 동반 갱신**: `spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`, `spec/4-nodes/7-trigger/1-manual-trigger.md`, `spec/5-system/{3-error-handling,12-webhook,14-external-interaction-api}.md` 전부 이번 diff 에 포함돼 이미 갱신됨(선행 리뷰 라운드 + `plan/complete/spec-update-masked-reject-framing.md` planner 턴). `spec-major-change` trigger 는 이미 충족.

## 요약

매트릭스 22개 trigger 중 실질적으로 후보가 된 것은 `backend-api-change`(controller glob 매칭)와 `run-debug-flow-change`(semantic) 2개였고, 둘 다 조사 결과 CRITICAL/WARNING 급 누락이 아니라 저심각도 INFO 2건(swagger jsdoc 미문서화 — 사전 존재, 유저 가이드 MDX 의 서버측 방어층 미언급 — 관측 동작 불변)으로 수렴했다. i18n dict·backend-labels.ts·`02-nodes` MDX·section locale 등록 등 CRITICAL 후보 항목은 전수 확인 결과 매칭 대상이 없거나(신규 TSX/노드/섹션 없음) 실제 렌더 경로가 없어(신규 에러 코드가 어떤 UI 에도 표시되지 않음) 위험이 성립하지 않았다.

## 위험도

LOW
