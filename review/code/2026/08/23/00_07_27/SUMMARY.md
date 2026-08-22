# Code Review 통합 보고서

## 전체 위험도
**LOW** — `POST /workflows/:id/execute` 본문에 대한 순수 OpenAPI 문서화 PR(런타임 계약 무변경, 캐너리 테스트로 실측 고정됨). CRITICAL 없음. forced whitelist(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 확인됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `ExecuteWorkflowDto.input` 필드의 OpenAPI description 이 실제로 동일하게 적용되는 `MASKED_VALUE_RESUBMITTED` 마스킹 거부 규칙(EIA §R17)을 언급하지 않는다 — `parameterValues` description 에만 그 문구가 있음. 컨트롤러는 `parameterValues`/`input.parameters` 두 출처를 합류시켜 동일한 `resolveTriggerParametersRejectingMasked()` 한 번으로 처리하므로 실제로는 두 필드 모두 거부 대상 | `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:46-51`; 근거: `workflows.controller.ts:306-323`, `spec/5-system/14-external-interaction-api.md:1580`(§R17) | `input` description 끝에 "input.parameters 로 넘긴 값도 동일한 마스킹 마커 거부 규칙(EIA §R17) 적용됨" 한 문장 추가 |
| 2 | 문서화/프로세스 | `plan/in-progress/execute-body-openapi.md` 작업 체크리스트 4개 항목(`consistency-check --impl-prep`, `ExecuteWorkflowDto 신설`, `@ApiBody 추가`, `트래커 항목 종결`)이 diff 상 이미 완료됐음에도 `[ ]` 미체크 상태로 남아 있다 — 프로젝트 컨벤션("plan 체크박스 = 실제 상태, 수행 후에만 체크") 위반 | `plan/in-progress/execute-body-openapi.md:50-53` | 완료된 4개 체크박스를 `[x]` 로 갱신(`/ai-review` 항목은 이 리뷰·fix 반영 후 체크) |
| 3 | 테스트 | 신설 캐너리 테스트(`workflows-execute-body.spec.ts`)는 "런타임 계약이 안 깨졌는가"만 검증하고, 이 PR 의 실제 목적인 "OpenAPI 문서가 올바르게 노출되는가"(`components.schemas` 등록, `requestBody` `$ref`, `required:false`)를 단언하는 테스트가 없다. 형제 DTO(`ExecuteNodeDto`)로 잘못 참조하는 복붙 실수를 해도 현재 테스트 셋으로는 전혀 잡히지 않음 | `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts`(전체); `workflows.controller.ts:256` | 저장소에 이미 있는 `interact-ack-response.dto.spec.ts` 패턴(`SwaggerModule.createDocument()` 기반 스키마 등록 단언)을 따라 `ExecuteWorkflowDto` 전용 검증 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `POST /workflows/:id/execute` 본문은 이번 변경 이후에도 스키마 검증을 받지 않는다(사전 존재 상태, 회귀 아님). 다만 공개 문서화로 이 갭의 발견 가능성이 높아짐 | `execute-workflow.dto.ts:31-52`; `workflows.controller.ts:256` | 신규 이슈 아님. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 이연 결정("여분 키 400 거부 여부") 우선순위 결정 시 참고 |
| 2 | 보안 | 마스킹 마커 리터럴을 문서에 노출하지 않은 점은 양호한 정보 최소화 설계 | `execute-workflow.dto.ts:32-35` | 조치 불필요 |
| 3 | 보안 | DTO 에 class-validator 데코레이터가 없어 향후 다른 엔드포인트에 오용될 잠재 위험이 있으나 캐너리 테스트로 이 라우트에 한해 회귀 방지됨 | `execute-workflow.dto.ts:30-53`; `workflows-execute-body.spec.ts:32-79` | 필요시 클래스명에 `ForDocsOnly` 등 접미사 고려(선택) |
| 4 | 유지보수성 | 동일 rationale 표가 DTO docstring·plan 문서·spec-sync 트래커 3곳에 거의 verbatim 중복 — 향후 결정 변경 시 drift 위험 | `execute-workflow.dto.ts:16-21`; `plan/in-progress/execute-body-openapi.md`; `spec-sync-external-interaction-api-gaps.md` | SoT 하나(DTO docstring 권장) 지정, 나머지는 링크만 (선택) |
| 5 | 유지보수성 | DTO 클래스 docstring(29줄)이 클래스 본문(23줄)보다 길다 | `execute-workflow.dto.ts:3-29` | 필요시 표/경고 블록을 별도 문서로 이관 후 docstring 축약 (선택) |
| 6 | 유지보수성/API계약 | `ExecuteWorkflowDto.input` 과 `ExecuteNodeDto.input` 이 같은 컨트롤러 표면에서 동일 필드명·다른 의미로 병존(JSDoc 으로 이미 구분 설명됨) | `execute-workflow.dto.ts:41-52` | 현재 docstring 교차 참조로 충분, 별도 조치 불요 |
| 7 | API계약/요구사항 | `ExecuteWorkflowDto.input` description 이 86자로 `spec/conventions/swagger.md §3` 기본 권장(10~40자) 초과. swagger.md 자체가 이미 34% 예외 인정 + 2026-08-22 확장된 "보안·정책 캐비엇 예외" 해당 | `execute-workflow.dto.ts:46-49` | 조치 불요 |
| 8 | 부작용 | `@ApiBody` 추가는 공개 OpenAPI 스키마(문서 표면)만 바꾸고 런타임 계약(파이프 진입·검증 여부)은 무변경 — 실측 확인됨 | `workflows.controller.ts:256` | 조치 불요, 참고용 |
| 9 | 테스트 | 캐너리가 "`@Body()` = 메서드의 마지막 파라미터"라는 위치 가정에 의존 — 향후 시그니처 변경 시 조용히 무의미해질 수 있음 | `workflows-execute-body.spec.ts:29` | 주석으로 가정 명시 또는 Nest 라우트 인자 메타데이터로 직접 식별하도록 강화 (선택) |
| 10 | 문서화 | 유저 가이드(`triggers.mdx`)가 이번에 OpenAPI 로 공식화된 `MASKED_VALUE_RESUBMITTED` 거부 규칙을 서술하지 않음(형제 `re-run` 과도 대칭적인 기존 갭, 이번 PR 범위 밖으로 plan 이 명시적으로 좁힘) | `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` | 필요시 별도 트래커 항목 등재(선택, 비차단) |
| 11 | 문서화 | `{@link WorkflowsController.execute}`, `{@link ExecuteNodeDto.input}` JSDoc 태그가 참조 대상을 import 하지 않음(런타임·Swagger 출력엔 영향 없음, 순수 스타일 nit으로 실측 확인) | `execute-workflow.dto.ts:8, 42` | 선택적으로 type-only import 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 런타임 검증 미영향 확인, class-validator 부재는 캐너리로 완화, INFO 5건 |
| requirement | LOW | input 필드 마스킹 거부 규칙 설명 누락, plan 체크리스트 stale |
| scope | NONE | 범위 이탈 없음, 발견사항 없음 |
| side_effect | NONE | 문서 표면만 변경, 런타임 부작용 없음 |
| maintainability | NONE | rationale 3중 중복·docstring 과다 등 INFO만 |
| testing | LOW | OpenAPI 노출 자체를 검증하는 테스트 부재 |
| documentation | LOW | plan 체크리스트 stale, 부차적 문서 갭 |
| api_contract | LOW | description 길이·네이밍 중첩 INFO, 하위 호환성은 실측 확인 |
| user_guide_sync | NONE | 매칭된 매트릭스 행(backend-api-change) target (a)(b) 모두 충족, 갭 없음 |

## 발견 없는 에이전트

- scope
- user_guide_sync

## 권장 조치사항
1. `ExecuteWorkflowDto.input` description 에 마스킹 마커 거부 규칙(EIA §R17) 언급 추가 (WARNING #1)
2. `plan/in-progress/execute-body-openapi.md` 완료된 체크박스 4개를 `[x]` 로 갱신 (WARNING #2)
3. `interact-ack-response.dto.spec.ts` 패턴을 따라 `ExecuteWorkflowDto` 의 실제 OpenAPI 문서 노출(스키마 등록·`requestBody` 참조·`required:false`)을 검증하는 테스트 추가 (WARNING #3)
4. (선택) INFO 항목 중 rationale 중복 정리·JSDoc import 보강 등은 여유 있을 때 처리

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (9명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 누락 없음
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이 diff(문서화 전용, 런타임 무변경)와 무관 |
  | architecture | 라우터 판단 — 이 diff 와 무관 |
  | dependency | 라우터 판단 — 이 diff 와 무관 |
  | database | 라우터 판단 — 이 diff 와 무관 |
  | concurrency | 라우터 판단 — 이 diff 와 무관 |