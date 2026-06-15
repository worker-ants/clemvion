# API 계약(API Contract) 리뷰 결과

> 대상: execution §1.3 single-node execution
> 엔드포인트: `POST /api/workflows/:id/nodes/:nodeId/execute`

---

## 발견사항

### [INFO] 하위 호환성 — 신규 엔드포인트, 기존 클라이언트 영향 없음
- 위치: `workflows.controller.ts` L902 `@Post(':id/nodes/:nodeId/execute')`
- 상세: 기존 `POST /api/workflows/:id/execute` 엔드포인트는 변경 없이 유지된다. 새 경로는 완전히 추가적(additive)이며 기존 클라이언트가 호출하는 어떤 경로도 수정하지 않는다. 마이그레이션 V098 은 nullable 컬럼 ADD COLUMN(기본값 NULL)이므로 기존 행에 영향 없음.
- 제안: 이상 없음.

### [INFO] 버전 관리 — 프로젝트 내 API 버전 관리 방식과 일치
- 위치: `workflows.controller.ts` 경로 선언부
- 상세: 코드베이스가 URL 경로 버전(`/api/...`)을 사용하지 않고 엔드포인트 단위로 점진 추가하는 방식을 취하고 있으며, 이번 추가도 동일 패턴을 따른다. 특별한 버전 불일치 없음.
- 제안: 이상 없음.

### [INFO] 응답 형식 — `ApiAcceptedWrappedResponse(ExecuteAcceptedDto)` 적용, 기존 execute 패턴과 일관됨
- 위치: `workflows.controller.ts` L912 `@ApiAcceptedWrappedResponse(ExecuteAcceptedDto, ...)`
- 상세: 202 응답 body 는 `{ data: { executionId: string } }` 래퍼 구조로, 기존 `POST /api/workflows/:id/execute` 와 동일한 `ExecuteAcceptedDto` + wrapped 형식을 사용한다. e2e 테스트(`exec.body.data.executionId`)도 이 구조를 검증한다.
- 제안: 이상 없음.

### [INFO] 에러 응답 형식 — 400 에러 코드 필드 일관성 확인 필요(INFO 수준)
- 위치: `workflows.controller.ts` L959 `BadRequestException({ code: 'NODE_NOT_IN_WORKFLOW', ... })`, L973 `BadRequestException({ code: 'PREVIOUS_EXECUTION_NOT_FOUND', ... })`
- 상세: 두 400 에러 모두 `{ code, message }` 객체를 NestJS `BadRequestException` 생성자에 전달한다. NestJS 기본 직렬화 시 이 객체는 응답 body의 `message` 필드 안에 중첩되거나(`{ statusCode, message: { code, message } }`) 혹은 `error` 래퍼 하에 위치할 수 있다. e2e 테스트는 `res.body.error.code` 로 접근하는데(`workflow-execution.e2e-spec.ts` L1131, L1143), 프로젝트의 글로벌 예외 필터가 이 필드를 `error.code` 로 변환해 주는지 확인이 필요하다. 기존 execute 엔드포인트와 동일한 패턴이라면 이미 정립된 규약이므로 LOW 이하.
- 제안: 기존 `execute` 엔드포인트의 400 에러 직렬화 방식과 동일함을 확인하면 충분. 전역 예외 필터가 `code` 필드를 `error.code` 경로로 노출하고 있다면 이상 없음.

### [INFO] 요청 검증 — UUID 파이프 + DTO 검증 충분
- 위치: `workflows.controller.ts` L934–936, `execute-node.dto.ts`
- 상세: `:id`, `:nodeId` 경로 파라미터에 `ParseUUIDPipe` 적용. `ExecuteNodeDto` 는 `@IsOptional() @IsUUID()` (previousExecutionId), `@IsOptional() @IsObject()` (input) 로 class-validator 검증을 갖춘다. 빈 body(`{}`) 전송 시 두 필드 모두 optional 이라 정상 통과하며, 이는 의도된 동작(`manual input only`).
- 제안: 이상 없음.

### [INFO] URL/경로 설계 — RESTful 관점에서 적절
- 위치: `POST /api/workflows/:id/nodes/:nodeId/execute`
- 상세: 계층적 리소스 표현(`workflows/:id` → `nodes/:nodeId`)이 RESTful 설계를 따른다. `execute` 동사를 명사 리소스 뒤에 액션 서픽스로 붙이는 패턴은 기존 `POST /api/workflows/:id/execute` 와 동일하게 일관됨. `:nodeId` 가 path parameter 로 전달돼 body 와 중복되지 않음.
- 제안: 이상 없음.

### [INFO] 페이지네이션 — 해당 없음
- 위치: 전체
- 상세: 단일 실행 트리거 엔드포인트로, 목록 조회가 아니므로 페이지네이션 요구사항 없음.
- 제안: 해당 없음.

### [INFO] 인증/인가 — `@Roles('editor')` 적용, 기존 execute 엔드포인트와 동일 수준
- 위치: `workflows.controller.ts` L904 `@Roles('editor')`
- 상세: `@Roles('editor')` 가드가 적용돼 editor 이상 권한을 요구한다. 워크플로우 소속 검증(`workflowsService.findById(id, workspaceId)`)으로 workspace 스코핑 및 IDOR 방지가 이루어지며, 노드의 workflowId 매칭과 previousExecutionId 의 workflowId 매칭으로 크로스-리소스 접근도 차단된다. Swagger 에 `@ApiUnauthorizedResponse`, `@ApiForbiddenResponse` 문서화 완비.
- 제안: 이상 없음.

---

## 요약

`POST /api/workflows/:id/nodes/:nodeId/execute` 신규 엔드포인트는 API 계약 관점에서 전반적으로 건전하다. 기존 엔드포인트와의 breaking change 없이 additive 추가 방식을 취하며, 202 + `ApiAcceptedWrappedResponse(ExecuteAcceptedDto)` 응답 형식이 기존 execute 패턴과 일관된다. UUID 파이프·class-validator DTO·워크플로우 스코핑·`@Roles('editor')` 인가가 모두 적용돼 있다. 400 에러 코드(`NODE_NOT_IN_WORKFLOW`, `PREVIOUS_EXECUTION_NOT_FOUND`)의 직렬화 경로(`error.code`)는 전역 예외 필터 동작에 의존하는데, 동일 패턴이 기존 execute 엔드포인트에서도 사용된 것으로 보여 프로젝트 규약 내에 있다. CRITICAL·WARNING 발견사항 없음.

---

## 위험도

NONE
