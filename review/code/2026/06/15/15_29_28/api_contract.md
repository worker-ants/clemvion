# API Contract Review — execution §1.3 단일 노드 실행

## 발견사항

### [INFO] 신규 엔드포인트 추가 — 하위 호환성 이상 없음
- 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` L427
- 상세: `POST /api/workflows/:id/nodes/:nodeId/execute` 는 순수 신규 엔드포인트다. 기존 엔드포인트(`POST /api/workflows/:id/execute` 등)를 변경하지 않으므로 기존 클라이언트에 대한 breaking change 없음.
- 제안: 해당 없음.

### [INFO] RESTful 경로 설계 적절
- 위치: `workflows.controller.ts` L427, `execute-node.dto.ts`
- 상세: 경로 `POST /api/workflows/:id/nodes/:nodeId/execute` 는 Node 를 Workflow 의 하위 자원으로 표현하고, `/execute` 는 `/stop` 선례와 동일한 단일 동사 action suffix 패턴을 따른다. plan 문서에서 impl-prep 검토 시 `execute-node`(동사+명사) 경로를 api-convention §2.2 위반으로 교정한 결과이므로 네이밍 일관성이 확보돼 있다.
- 제안: 해당 없음.

### [INFO] HTTP 상태 코드 적절
- 위치: `workflows.controller.ts` L428 (`@HttpCode(HttpStatus.ACCEPTED)`)
- 상세: 비동기 실행 큐 등록에 202 Accepted 반환은 적절하다. 기존 `POST /api/workflows/:id/execute` 와 동일한 패턴. `@ApiAcceptedWrappedResponse(ExecuteAcceptedDto)` 로 응답 스키마도 선언돼 있다.
- 제안: 해당 없음.

### [INFO] 에러 응답 형식 일관성
- 위치: `workflows.controller.ts` L469-503
- 상세: `BadRequestException({ code, message })` 패턴이 두 곳(`NODE_NOT_IN_WORKFLOW`, `PREVIOUS_EXECUTION_NOT_FOUND`) 에 사용됐다. e2e 테스트(`workflow-execution.e2e-spec.ts` L624, L637)가 `res.body.error.code` 로 확인하고 있어 프로젝트 표준 에러 래핑 구조(`{ error: { code, message } }`)를 따르는 것으로 보인다. `ServiceUnavailableException({ code, message })` 의 503 도 같은 패턴이며 Swagger 에 별도 schema 예시가 선언돼 있다.
- 제안: 해당 없음.

### [INFO] 응답 형식 일관성 — `{ executionId }` 플랫 반환
- 위치: `workflows.controller.ts` L519 (`return { executionId }`)
- 상세: 기존 `execute` 핸들러(L324)와 동일하게 `{ executionId }` 를 반환하고 `@ApiAcceptedWrappedResponse(ExecuteAcceptedDto)` 로 래핑 응답을 선언한다. 프론트엔드 클라이언트도 `response.data.data.executionId` 패턴으로 읽고 있어(`workflow-canvas.tsx` L706) 래퍼 구조와 일치한다.
- 제안: 해당 없음.

### [INFO] 요청 검증 충분
- 위치: `execute-node.dto.ts`, `workflows.controller.ts` L459, L479-503
- 상세: (1) Path parameter `id`, `nodeId` 에 `ParseUUIDPipe` 적용으로 UUID 형식 검증. (2) `@IsUUID()` 데코레이터로 `previousExecutionId` 형식 검증. (3) 컨트롤러에서 노드가 해당 워크플로우에 속하는지 DB 조회로 검증(IDOR 방지). (4) `previousExecutionId` 가 동일 워크플로우 소속인지 추가 검증(cross-workflow seed 차단). `@IsObject()` 로 `input` 필드 타입 검증도 포함.
- 제안: 해당 없음.

### [INFO] 인증/인가 적절
- 위치: `workflows.controller.ts` L429 (`@Roles('editor')`)
- 상세: 단일 노드 실행은 실행 진입점이므로 `editor` 이상 권한을 요구한다. 기존 `execute` 핸들러와 동일 수준. `@ApiUnauthorizedResponse`, `@ApiForbiddenResponse` 도 선언돼 있다.
- 제안: 해당 없음.

### [INFO] DB 컬럼이 API 응답 DTO 에 미노출
- 위치: `execution.entity.ts` L316-320
- 상세: entity 주석이 "API 응답 DTO 미포함(whitelist 매핑이라 자동 배제)"을 명시한다. `singleNodeId`, `previousExecutionId` 는 디버그 메타데이터로, API 응답에 자동 포함되지 않는다.
- 제안: 해당 없음.

### [INFO] 버전 관리 — 기존 패턴 유지
- 위치: 전체 변경 셋
- 상세: 프로젝트는 URL path versioning 을 사용하지 않는(모든 엔드포인트가 `/api/` prefix 공통) 구조로, 신규 엔드포인트도 동일 패턴을 따른다. breaking change 없는 신규 추가이므로 별도 버전 범프 불필요.
- 제안: 해당 없음.

### [INFO] 페이지네이션 — 해당 없음
- 상세: 신규 API 는 목록 반환이 아닌 단일 액션 엔드포인트이므로 페이지네이션 요구 사항 없음.

## 요약

이번 변경은 `POST /api/workflows/:id/nodes/:nodeId/execute` 신규 엔드포인트를 추가하는 것으로, 기존 API 에 대한 breaking change 는 없다. 경로 설계는 프로젝트 api-convention §2.2 를 준수하며(impl-prep 검토에서 이미 교정 완료), HTTP 202 반환·에러 응답 형식(`{ code, message }`)·인증/인가(`@Roles('editor')`)·요청 검증(ParseUUIDPipe + DB 소속 검증)이 모두 기존 패턴과 일관된다. Swagger 어노테이션(`@ApiParam`, `@ApiAcceptedWrappedResponse`, `@ApiBadRequestResponse`, `@ApiNotFoundResponse`, `@ApiResponse(503)`)이 완비돼 있으며, 신규 DB 컬럼(`singleNodeId`, `previousExecutionId`)은 응답 DTO 에서 자동 배제된다. API 계약 관점에서 발견된 Critical 또는 Warning 항목은 없다.

## 위험도

NONE
