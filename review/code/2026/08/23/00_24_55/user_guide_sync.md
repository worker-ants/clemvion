STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 함께 Read.

## 변경 파일 컨텍스트 (실제 코드/문서 변경만 — review/** 메타 산출물 제외)
- `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` (신규 — `ExecuteWorkflowDto`, Swagger 전용)
- `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts` (신규 — 캐너리+OpenAPI 노출 가드)
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (`@ApiBody({ type: ExecuteWorkflowDto })` 추가)
- `plan/complete/execute-body-openapi.md` (신규, `plan/in-progress/`에서 이동·봉인)
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (트래커 항목 종결 `[x]` + 신규 이연 항목 2건 등재)
- `review/code/2026/08/23/00_07_27/**`, `review/consistency/2026/08/22/23_46_23/**` — 직전 라운드 리뷰/일관성-검토 산출물(메타 문서). 매트릭스 어느 trigger 에도 해당 없음(코드/docs 아님)

이번 라운드는 직전 라운드(`00_07_27`, 자체 `user_guide_sync.md` 도 위 changeset 안에 포함)의 Warning 3건을 반영한 재검증이다. 핵심 diff(`execute-workflow.dto.ts`/`workflows.controller.ts`/`workflows-execute-body.spec.ts`)는 W1 반영으로 `input` 필드 description 이 확장된 것 외에 구조는 동일하다.

## 매칭된 trigger
`dto/**` + `*.controller.ts` 글롭이 매트릭스 `backend-api-change` 행(semantic)에 매칭된다:

> "백엔드 API 추가·변경 | (a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"

다른 20개 행(새 노드 추가·노드 schema 변경·신규 UI 문자열·통합/제공자 변경·신규 섹션 디렉토리·인증/세션 흐름·표현식 언어·실행/디버깅 흐름·신규 warning/error code 등)은 이 changeset 의 어떤 파일과도 매칭되지 않는다 — `codebase/backend/src/nodes/**` 변경 없음, `*.tsx` 변경 없음, `auth/**` 변경 없음, `expression-engine/**` 변경 없음, 새 `docs/<NN>-*/` 디렉토리 없음, `error-codes.ts`(`ErrorCode` enum) 변경 없음.

`MASKED_VALUE_RESUBMITTED` 코드가 이번 diff 의 Swagger description 에 처음 노출됐지만, 이는 매트릭스 `new-error-code`/`new-warning-code` 행이 가리키는 `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 이 아니라 `execution-engine/types/trigger-parameter.types.ts` 의 기존(사전 존재) 값 리터럴이다(`resolve-trigger-parameters.spec.ts`·`re-run.dto.ts`·`workflows.controller.spec.ts` 등에 선재). 이번 PR 이 신규로 발행한 코드가 아니므로 해당 두 행은 트리거되지 않는다.

## 동반 갱신 검증

### (a) swagger jsdoc — 충족
`ExecuteWorkflowDto`(`execute-workflow.dto.ts` 1-59줄)가 `@ApiPropertyOptional` 로 `parameterValues`/`input` 양쪽 필드에 상세 description 을 달았고(W1 반영으로 `input` 도 마커 거부 규칙 명시), `workflows.controller.ts` 253-256줄이 `@ApiBody({ type: ExecuteWorkflowDto, required: false })` 로 배선했다. 이 changeset 자체가 target (a) 이므로 누락 없음.

### (b) API 노출 변경이 사용자 안내에 영향 — 갭 없음(기존 판단 재확인)
이 PR 은 **런타임 동작을 한 줄도 바꾸지 않는** 것이 명시적 설계 결정이다(`execute-workflow.dto.ts` docstring, `plan/complete/execute-body-openapi.md` "핵심 판단" 절). `@Body()` 파라미터는 인라인 타입을 유지해 `CustomValidationPipe` 가 검증을 skip 하고, `workflows-execute-body.spec.ts` 가 이를 캐너리+OpenAPI 노출 가드로 고정한다. 즉 API 계약(요청/응답 shape·허용 필드·에러 코드)이 바뀐 게 없다 — 이미 존재하던 동작(마스킹 마커 재제출 거부, 레거시 `input.parameters` 봉투)을 Swagger 스키마에만 명문화했다.

이 마스킹 재제출 거부 UX 자체는 이미 `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` (Re-run 흐름 — "자격증명으로 판별된 입력은 `***` 로 가려져 있어 프리필되지 않아요")와 `02-nodes/triggers.mdx` (`POST /workflows/:id/execute` + `parameterValues` 예시)로 커버돼 있음을 직접 확인했다.

`MASKED_VALUE_RESUBMITTED` 코드 리터럴 자체는 `codebase/frontend/src/content/docs/**`·`codebase/frontend/src/lib/i18n/**` 어디에도 등장하지 않는다(grep 확인) — 즉 "정확히 어떤 값이 마커로 간주되어 거부되는지"는 유저 가이드에 서술돼 있지 않다. **다만 이는 이번 PR 이 만든 갭이 아니라 선존 갭**이며, 직전 리뷰 라운드(`00_07_27`)에서 정확히 이 지점을 INFO #10 으로 지적했고 `RESOLUTION.md`("안 한다. 형제 re-run 과도 대칭인 선존 갭이고 plan 이 범위를 명시적으로 좁혔다")로 명시적 처분됐다 — `re-run.dto.ts`(형제 DTO, `MASKED_VALUE_RESUBMITTED` 를 이미 Swagger 에 노출 중)도 동일하게 유저 가이드에 마커 리터럴을 서술하지 않아 대칭이다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에도 이 PR 의 스코프가 "문서만 고치고 런타임은 안 바꾼다"로 명시적으로 좁혀져 있다.

## 발견사항

- **[INFO]** 마스킹 마커 거부 규칙(`MASKED_VALUE_RESUBMITTED`)이 유저 가이드(MDX)·`backend-labels.ts` 어디에도 리터럴/코드로 서술되지 않음 — 선존 갭, 이번 PR 범위 밖으로 명시적으로 처분됨
  - 변경 파일: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` (Swagger 최초 노출)
  - 매트릭스 항목: `backend-api-change` — "(b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 누락된 동반 갱신(잠재): `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` 또는 `05-run-and-debug/run-results.mdx` 에 `MASKED_VALUE_RESUBMITTED` 구체 서술
  - 상세: 사용자가 API 를 직접 호출할 때 왜 400 이 나는지 유저 가이드만으로는 알 수 없다. 다만 형제 `re-run` 경로도 동일 갭이라 이번 PR 이 만든 회귀가 아니고, 팀이 이미 `00_07_27` 라운드에서 이 정확한 항목을 검토·처분(안 한다)했다 — 재차단 사유 아님
  - 제안: 조치 불필요(이미 처분됨). 추후 마커 재제출 거부 UX 를 유저 가이드에 전면 문서화하는 별도 트래커 항목으로 진행하려면 `re-run`·`execute` 양쪽을 한 번에 다루는 것을 권장

## 요약
매트릭스 21개 행 중 `backend-api-change`(semantic) 1개가 diff 의 `dto/**` + `*.controller.ts` 변경에 매칭됐다. target (a) swagger jsdoc 는 이 changeset 자체가 충족(W1 반영으로 오히려 강화)한다. target (b) user-guide 페이지 영향은 이 PR 이 런타임 동작을 전혀 바꾸지 않는 OpenAPI 문서화 전용 변경이라 신규 갭이 아니며, 관련 사용자 동작(마스킹 재제출 거부 UX)은 이미 `05-run-and-debug/run-results.mdx`·`02-nodes/triggers.mdx` 에 개념 수준으로 문서화돼 있다. `MASKED_VALUE_RESUBMITTED` 코드 리터럴 자체가 유저 가이드에 없다는 선존 갭은 형제 `re-run.dto.ts` 와 대칭이고 직전 라운드(`00_07_27`)에서 이미 검토·명시적 비조치 처분됐으므로 INFO 1건으로만 기록한다. 다른 20개 행은 트리거 글롭/semantic 조건에 매칭되는 파일이 changeset 에 없다. 신규 동반 갱신 누락(WARNING/CRITICAL) 0건.

## 위험도
NONE
