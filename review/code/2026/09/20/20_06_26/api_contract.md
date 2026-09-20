# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 트랜잭션 내 `Workspace`/`Workflow` 행을 두 번 잠그는 잠재적 중복 락
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:520-534` (`deleteWorkspace`)
  - 상세: `lockParentAndListTriggerIds` 가 `pessimistic_write` 로 `Workspace` 행을 잠근 뒤, 같은 트랜잭션 안에서 `assertWorkspaceDeletable` 이 동일 행을 다시 `pessimistic_write` 로 조회한다. 같은 커넥션·트랜잭션이라 자기 자신을 막지는 않지만(PostgreSQL 은 같은 트랜잭션 내 재잠금을 허용), 이번 diff 가 도입한 것이 아니라 기존 구조이며 API 응답(상태 코드·본문)에는 영향이 없다. 다만 워크스페이스 경로는 이 재조회 덕분에 이번 PR 이 고치려는 "동시 삭제 두 번째 요청이 성공/중복 감사를 남기는" 결함이 애초에 없었던 것으로 보인다(트리거 목록 §4.4 대칭이 `assertWorkspaceDeletable` 재검사로 이미 확보됨). 이 자체는 결함이 아니라 참고 사항.
  - 제안: 조치 불필요. 다만 `workspaces.service.ts:522-523` 주석("부모 부재는 여기서 따로 보지 않는다")이 향후 리뷰어에게 왜 workflow 경로와 비대칭적으로 처리했는지 설명하고 있어 적절함.

- **[INFO]** 에러 코드 네이밍이 리소스별로 다름 (`RESOURCE_NOT_FOUND` vs `WORKSPACE_NOT_FOUND`)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:281-284` vs `codebase/backend/src/modules/workspaces/workspaces.service.ts:589-592`
  - 상세: 이번 diff 가 workflow DELETE 경로에 추가한 404 는 기존 `findById`(동일 파일 170-174행)와 동일하게 `code: 'RESOURCE_NOT_FOUND', message: 'Workflow not found'` 를 재사용해 **해당 도메인 내부에서는 일관적**이다. 워크스페이스 쪽은 이번 diff 가 새 에러 코드를 추가하지 않고 기존 `WORKSPACE_NOT_FOUND` 를 그대로 재사용한다. 두 코드명 규칙이 서로 다른 것은 이번 PR 이전부터 존재하던 계약이며, 이번 변경으로 새로 발생한 불일치가 아니다.
  - 제안: 조치 불필요(pre-existing). 향후 에러 코드 표준화 논의 시 참고.

## 검증 내역 (참고)

- `TriggerResourceReleasePort.lockParentAndListTriggerIds` 는 `WorkflowsModule`/`WorkspacesModule` 이 `ModuleRef.get(..., { strict: false })` 로만 참조하는 **내부 backend 모듈 경계 인터페이스**이며, 외부에 노출되는 HTTP API 가 아니다. 반환 타입이 `Promise<string[]>` → `Promise<LockedParentTriggers>` 로 바뀌었지만, 이 인터페이스의 유일한 구현체(`TriggerResourceReleaserService`)와 유일한 두 호출자(`WorkflowsService.remove`, `WorkspacesService.deleteWorkspace`)가 모두 같은 커밋에서 함께 갱신되어 TypeScript 컴파일 시점에 불일치가 잡힌다. HTTP 계약 변화 없음.
- `DELETE /api/workflows/:id` 컨트롤러(`workflows.controller.ts:195-214`)는 이미 `@ApiNoContentResponse`(204)·`@ApiNotFoundResponse`(404) 를 Swagger 문서에 선언해 두고 있다. 이번 diff 가 추가한 `NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Workflow not found' })` 는 **기존에 문서화된 응답 형태 그대로**이며, 새로운 상태 코드나 새로운 응답 스키마를 만들지 않는다. 트랜잭션 `.catch()` 에서 `NotFoundException` 을 먼저 걸러 로그(수동 정리 필요 경보)를 남기지 않고 그대로 재던지는 순서도 올바르다(`workflows.service.ts:289-300`).
- 신규 e2e(`codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts`)는 실제 동시 DELETE 두 건이 `[204, 404]` 로 갈리고 `audit_log` 행이 정확히 1개임을 검증한다 — REST 관점의 idempotent-delete 계약(두 번째 요청은 404, 감사 중복 없음)이 트리거 삭제(§4.4)와 대칭적으로 지켜짐을 API 레벨에서 실측 고정한다.
- 인증/인가(`@Roles('editor')`, 워크스페이스 owner 검사), 요청 검증(`ParseUUIDPipe` 등), URL 설계(`DELETE /api/workflows/:id`), 페이지네이션(해당 없음 — 단건 삭제) 은 이번 diff 로 변경되지 않았다.
- 뮤테이션 검증: 저장소 파일을 수정하지 않았다(read-only 로 조사). `git status --short` 로 별도 변경 없음 확인 완료.

## 요약

이번 변경은 **외부에 노출된 HTTP API 계약을 새로 만들거나 깨지 않는다**. `TriggerResourceReleasePort.lockParentAndListTriggerIds` 반환 타입 변경은 순수 backend 내부 모듈 경계(포트/구현/두 호출자)에 국한되며 동일 커밋에서 전부 동기화됐다. workflow DELETE 경로에 추가된 `NotFoundException({ code: 'RESOURCE_NOT_FOUND' })` 는 같은 파일의 기존 `findById` 관례를 그대로 재사용하고, 컨트롤러가 이미 문서화해 둔 204/404 응답 형태 안에 들어간다. 동시 삭제 시 "먼저 커밋한 쪽 204, 나중 쪽 404, 감사 행 1개"라는 idempotent-delete 계약이 트리거 삭제(§4.4)와 대칭적으로 확립되었고, 신규 e2e 로 그 계약이 실측 고정되었다. 워크스페이스 삭제 경로는 새 에러 코드 없이 기존 `assertWorkspaceDeletable` 재검사에 의존해 같은 문제를 이미 커버하고 있었음을 확인했다(비대칭이지만 결함 아님, 코드 내 주석으로 근거가 남아 있음). Critical/Warning 급 API 계약 위반은 발견되지 않았다.

## 위험도

NONE
