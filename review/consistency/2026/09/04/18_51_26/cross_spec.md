# Cross-Spec 일관성 검토 — spec/2-navigation/ (impl-done)

## 검토 범위 요약

- scope(`spec/2-navigation/`) 델타: 0개 파일 (이 브랜치는 해당 spec 영역을 변경하지 않음 — 정상, CRITICAL 사유 아님)
- 실제 구현 diff: 3개 파일 / 121줄, 전부 `codebase/backend/**` (spec 변경 없음)
  1. `codebase/backend/src/common/pipes/validation.pipe.spec.ts` — `forbidNonWhitelisted` (알 수 없는 키 400 거절) 동작을 고정하는 신규 unit 테스트 추가
  2. `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` — `QueryExecutionDto.workflowId`(죽은 쿼리 파라미터, `@IsUUID` 데코레이터) 제거
  3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — `@Transform` 예외 관련 doc-comment 재실측(1,095개 중 17개, null 축 갈리는 사례 0건)로 정정

target(`spec/2-navigation/`)이 이번 diff로 직접 갱신되지 않았으므로, 검토는 **diff가 spec/2-navigation 및 인접 영역(spec/3-workflow-editor, spec/5-system)이 이미 문서화한 계약과 충돌하는지**에 집중했다.

## 확인한 근거

- `spec/2-navigation/14-execution-history.md:345,350-354` — `GET /api/executions/workflow/:workflowId` 의 쿼리 파라미터 표는 `page` / `limit` / `sort` / `order` / `status` **5개만** 정의한다. `workflowId` 쿼리 필터는 애초에 spec 어디에도 약속된 적이 없다 (경로 파라미터 `:workflowId` 와는 별개).
- `spec/3-workflow-editor/3-execution.md:274,341,747,778` — 같은 endpoint 를 재사용하는 다른 3곳 모두 path param `:workflowId` 만 언급, 쿼리 필터 언급 없음.
- `spec/5-system/2-api-convention.md:286` — 이 endpoint 의 페이지네이션 형식(offset 기반)만 규정, 쿼리 파라미터 목록에 `workflowId` 없음.
- `codebase/frontend/src/lib/api/executions.ts:87-93,203-210` — `ExecutionListParams` 타입에 `workflowId` 필드가 없고, `getByWorkflow()` 호출부도 이를 보내지 않는다. 프런트엔드가 이 값을 송신한 적이 없어 diff 로 인한 프런트-백엔드 계약 파손 없음.
- `spec/2-navigation/1-workflow-list.md:74` 의 "받더라도 서버는 무시한다"(`ownership`)는 이번 diff 가 고정한 `forbidNonWhitelisted`(DTO 미선언 키 거절) 축과 겉보기엔 상반돼 보이나, `ownership` 은 `QueryWorkflowDto` 에 **선언된 필드**(`query-workflow.dto.ts:58`, `@IsIn` 검증)이고 개인 워크스페이스 컨텍스트에서 서비스 로직이 그 값을 비즈니스적으로만 무시하는 것이다. `forbidNonWhitelisted` 는 **DTO 에 선언조차 안 된 키**만 거절하므로 두 문서는 서로 다른 축(선언된 필드의 비즈니스 무시 vs. 미선언 키의 파이프 거절)을 기술하며 모순이 아니다.
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` 는 repo-guard 내부 파서로 `spec/**` 어디에서도 참조되지 않는다 — cross-spec 표면 없음.
- `workflowId` 를 쿼리로 보내는 다른 e2e (`workflow-assistant.e2e-spec.ts`)는 전혀 다른 엔드포인트(`/api/workflow-assistant/sessions`)로, 이번에 바뀐 `QueryExecutionDto` 와 무관.

## 발견사항

없음. 이번 diff 는 `QueryExecutionDto.workflowId` (spec 이 애초에 약속하지 않았고 `findByWorkflow` 가 읽지도 않던 죽은 파라미터)를 제거해 오히려 **코드를 기존 spec 문서(`14-execution-history.md` §쿼리 파라미터 표)와 더 가깝게 정렬**시켰다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 모두에서 다른 spec 영역과의 직접 모순이나 잠재 충돌을 찾지 못했다.

## 요약

target 영역(`spec/2-navigation/`) 자체의 spec 델타는 0이며, 실제 구현 diff(3파일/121줄)는 `executions` 모듈의 죽은 쿼리 파라미터 제거와 그에 따른 회귀 테스트/가드 doc-comment 정정에 국한된 순수 backend 변경이다. 관련 spec 문서(`2-navigation/14-execution-history.md`, `3-workflow-editor/3-execution.md`, `5-system/2-api-convention.md`)를 직접 대조한 결과 어느 곳도 `workflowId` 쿼리 필터를 약속한 적이 없고, 프런트엔드도 이를 송신한 적이 없어 계약 파손이 없다. `forbidNonWhitelisted` 신규 테스트가 고정하는 "DTO 미선언 키 → 400" 축은 `workflow-list.md` 의 "선언된 `ownership` 필드를 컨텍스트에 따라 무시" 서술과 다른 축을 기술하므로 상충하지 않는다. Cross-Spec 관점에서 이 변경은 위험이 없다.

## 위험도

NONE
