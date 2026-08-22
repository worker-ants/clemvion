STATUS=success requirement review complete — 0 CRITICAL, 2 WARNING, 1 INFO
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) Review — `execute-body-dto` (execute-workflow.dto.ts 등)

## 검증 방법
정적 리딩 외에, 다음을 실제로 실행해 사실관계를 검증했다:
- `npx jest src/modules/workflows/workflows-execute-body.spec.ts` — 5/5 GREEN.
- **뮤테이션 실측**: `@Body() body?: { input?; parameterValues? }` 를 `@Body() body?: ExecuteWorkflowDto` 로 바꿔 캐너리 테스트가 실제로 RED 로 떨어지는지 확인(2건 FAIL, 기대한 실패 메시지 — `Object` vs `ExecuteWorkflowDto`, `Input validation failed`). 커밋 후 상태였으므로 `cp` 백업 후 뮤테이션 → 복원(`git status` 로 원상복구 확인 완료, 잔여 diff 없음).
- `npx tsc --noEmit` — 신규 파일 관련 에러 0건(기존 무관 에러만 잔존, PR 무관).
- `python3 scripts/check-backend-typecheck-ratchet.py` — baseline 과 일치, PASS.
- `codebase/frontend/src/lib/api/workflows.ts` 의 `execute()` 가 정확히 `{ input, parameterValues }` 만 보낸다는 plan 문서의 주장을 grep 으로 대조 — 일치.
- `codebase/backend/src/common/pipes/validation.pipe.ts` 의 `toValidate()` 가 `Object` 를 제외 목록에 두는지 직접 확인 — DTO docstring 의 핵심 주장과 일치.
- `spec/5-system/14-external-interaction-api.md` §R17 원문 대조 — "POST /workflows/:id/execute 의 파라미터"(필드 구분 없이) 가 마스킹 거부 대상이라고 명시.

## 발견사항

- **[WARNING]** `ExecuteWorkflowDto.input` 필드의 OpenAPI `description` 이 같은 컨트롤러 로직이 적용하는 `MASKED_VALUE_RESUBMITTED` 거부 규칙을 언급하지 않는다 — `parameterValues` 쪽 description 에만 그 문구가 있다.
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:46-51` (`input` 필드의 `@ApiPropertyOptional`)
  - 상세: `workflows.controller.ts` 의 `execute()` 는 `rawValues = body?.parameterValues ?? (body?.input as ...).parameters ?? {}` 로 두 출처를 합류시킨 뒤 **동일한 한 번의 호출**로 `resolveTriggerParametersRejectingMasked(schema, rawValues)` 를 거친다(`workflows.controller.ts:306-323`). 즉 `input.parameters` 로 값을 보내도 마스킹 마커와 일치하면 똑같이 `400 MASKED_VALUE_RESUBMITTED` 로 거부된다. `spec/5-system/14-external-interaction-api.md:1580` 의 §R17 도 "`POST /workflows/:id/execute` 의 파라미터"라고 필드 구분 없이 기술한다. 그런데 이 PR 이 새로 추가한 OpenAPI `description` 은 그 규칙을 `parameterValues` 필드에만 적어 두어, Swagger 문서만 읽는 외부 API 소비자는 레거시 `input.parameters` 경로로 값을 보낼 때도 같은 거부가 적용된다는 사실을 놓칠 수 있다. 이 PR 의 목적 자체가 "이 엔드포인트의 실제 계약을 OpenAPI 에 정확히 반영한다"이므로, 이 누락은 그 목적과 정면으로 어긋나는 지점이다(기능 결함은 아니고 신설 문서의 완전성 결함).
  - 제안: `input` 필드 description 끝에 "`input.parameters` 로 넘긴 값도 동일한 마스킹 마커 거부 규칙(EIA §R17)이 적용됨" 한 문장 추가.

- **[WARNING]** `plan/in-progress/execute-body-openapi.md` 의 `## 작업` 체크리스트 6개 항목이 전부 `[ ]`(미완료) 로 남아 있는데, 실측하면 전부 완료 상태다.
  - 위치: `plan/in-progress/execute-body-openapi.md:49-54`
  - 상세: (1) `/consistency-check --impl-prep` — 같은 PR 안에 `review/consistency/2026/08/22/23_46_23/` 산출물이 존재하고 `SUMMARY.md` 가 `BLOCK: NO` 를 보고한다(완료). (2) `ExecuteWorkflowDto` 신설 — `execute-workflow.dto.ts` 존재, class-validator 데코레이터 없음(완료). (3) `@ApiBody` 추가 — `workflows.controller.ts:256` 에 반영(완료). (4) 트래커 항목 종결 — `spec-sync-external-interaction-api-gaps.md` 의 해당 항목이 `[x]` 로 flip 되고 "검증 켜기" 신규 항목도 실제로 등재됨(완료, 파일 5 diff 로 확인). (5) TEST WORKFLOW — `workflows-execute-body.spec.ts` 5/5 GREEN + typecheck ratchet PASS(완료). (6) `/ai-review` — 이 리뷰 자체가 그 실행이다. 프로젝트 컨벤션(`feedback_plan_checkbox_actual_state.md`: "수행 후에만 체크")과 어긋나는 stale 상태.
  - 제안: 커밋 반영 전 체크박스를 실제 완료 상태로 갱신(최소 1~5). `/ai-review` 항목은 이 리뷰 완료 후 체크.

- **[INFO]** `spec/conventions/swagger.md §3` 의 DTO `description` 길이 가이드(10~40자)를 `ExecuteWorkflowDto.input` 의 description(86자 실측)이 넘지만, swagger.md 자체 Rationale 이 이미 40자 초과 사례가 34% 존재함을 인정하고 있어 강한 위반은 아니다(선행 consistency-check 에서도 동일하게 INFO 로 판정됨). 별도 조치 불요.
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:46-49`

## 긍정 확인 사항 (참고)
- 핵심 설계 결정("DTO 를 `@Body()` 파라미터 타입으로 승격하지 않고 `@ApiBody`로만 문서화") 의 근거로 제시된 두 갈래 시나리오(데코레이터 없이 승격 시 전체 요청 거부 / 데코레이터를 달면 `forbidNonWhitelisted` 로 여분 키 거부)는 실제 파이프 코드·실행 테스트로 둘 다 실측 확인됨. 문서(docstring)·plan·spec 트래커 서술이 서로 정확히 일치한다.
- 캐너리 테스트(`workflows-execute-body.spec.ts`)는 실제로 방어 대상 회귀(`@Body()` 를 `ExecuteWorkflowDto` 로 바꾸는 뮤턴트)에서 RED 로 떨어짐을 직접 실행해 확인 — vacuous 하지 않다.
- 런타임 동작 변경 없음 주장이 diff 상으로도 사실과 일치(컨트롤러 `execute()` 메서드 본문 무변경, import/주석/데코레이터만 추가).
- 이전 라운드 consistency-check(WARNING: `type: Object` 만 쓰고 `additionalProperties: true` 누락)가 이미 코드에 반영되어 현재 파일에는 두 필드 모두 `additionalProperties: true` 가 달려 있음 — 해결됨, 재차 지적할 사안 아님.
- `spec/5-system/14-external-interaction-api.md` §R17 인용(`SoT: EIA §R17`)은 실제 spec 본문과 정합.
- `ExecuteNodeDto.input`(직접 값) 과 `ExecuteWorkflowDto.input`(parameters 봉투) 의 이름 충돌에 대한 docstring 설명은 실제 두 DTO 정의와 대조해 정확함.

## 요약
이 변경은 런타임 동작을 전혀 바꾸지 않고 `POST /workflows/:id/execute` 의 OpenAPI 문서만 보강하는 순수 문서화 PR이며, 핵심 설계 판단(파라미터 타입 승격 대신 `@ApiBody` 전용 DTO)의 근거를 코드·테스트로 직접 검증한 결과 모두 사실과 일치했다. 회귀 방지용 캐너리 테스트도 뮤테이션 실측으로 실효성이 확인됐다. 다만 (1) 신설 DTO의 `input` 필드 문서가 실제로 적용되는 마스킹 거부 규칙을 빠뜨려 이 PR의 "문서를 정확히 반영한다"는 목적과 부분적으로 어긋나고, (2) 작업이 실질적으로 완료됐음에도 plan 체크리스트가 전부 미체크 상태로 남아 프로젝트 컨벤션(수행 후 즉시 체크)을 벗어난다. 둘 다 기능 결함이 아니라 문서/프로세스 완전성 결함이며 CRITICAL 은 없다.

## 위험도
LOW
