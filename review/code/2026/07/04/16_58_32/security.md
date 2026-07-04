# 보안(Security) Review — PR2b 동시성 cap admission gate

## 발견사항

- **[INFO]** raw SQL 은 전량 파라미터 바인딩 — 인젝션 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2639` (`admitExecutionOrDefer` 의 원자 admission UPDATE), `execution-engine.service.ts:7461` 인근 기존 raw query, `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` 의 `db.query(...)` 호출들
  - 상세: 신규 admission UPDATE 는 `WHERE id = $1 AND status = 'pending' AND (SELECT COUNT(*) ... WHERE w.workspace_id = $2 ...) < $3 AND (... WHERE workflow_id = $4 ...) < $5` 형태로 `executionId`, `workspaceId`, `wsCap`, `execution.workflowId`, `wfCap` 5개 값 모두 `$n` placeholder 로 바인딩되고, 문자열 템플릿 리터럴 안에 사용자 입력이 직접 삽입되지 않는다. `wsCap`/`wfCap` 은 `resolveConcurrencyCap()` 이 `typeof raw === 'number' && Number.isInteger(raw) && raw > 0` 검증을 거친 값만 통과시키므로 값 자체도 신뢰 가능한 정수다. `markQueueWaitTimeout` 은 QueryBuilder(`.where('id = :id', ...)`)를 사용해 동일하게 안전. e2e 테스트의 `db.query` 도 전부 `$1`/`$2` 파라미터화. SQL 인젝션 벡터 없음.
  - 제안: 없음(현행 유지 권장).

- **[INFO]** workspace `maxConcurrentExecutions` 쓰기 경로는 인가 검증이 정상 적용됨 (IDOR 없음)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:156-166` (`PATCH :id/settings`), `codebase/backend/src/modules/workspaces/workspaces.service.ts:448-499` (`updateWorkspaceSettings`)
  - 상세: `workspaceId` 는 `@Param('id', new ParseUUIDPipe())` 로 경로에서 오고, `userId` 는 JWT(`@CurrentUser()`)에서 온다. `updateWorkspaceSettings` 는 mutate 전에 `await this.assertAdmin(workspaceId, userId)` 를 호출해 **호출자가 해당 workspaceId 의 owner/admin 인지**를 확인한다(`getMemberRole` 조회 → `ADMIN_ROLES.has(role)`). `maxConcurrentExecutions` 는 다른 필드(interactionAllowedOrigins/timezone)와 동일하게 이 가드 안에서만 병합되므로, 타 워크스페이스의 cap 을 임의로 변경하는 IDOR 경로가 없다. DTO 레벨에서도 `@IsInt() @Min(1)` 로 `0`/음수/실수/문자열이 차단되고, 서비스 계층 `resolveConcurrencyCap` 이 런타임에서도 동일 조건(`Number.isInteger && > 0`)을 재검증해 "무제한(0)" 같은 우회 옵션이 없다.
  - 제안: 없음.

- **[INFO]** workflow 레벨 `maxConcurrentExecutions` 는 이번 PR 에서 사용자 노출 쓰기 경로가 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-limits.ts:47-56` (`resolveConcurrencyCap` 소비처), grep 결과 `Workflow.settings.maxConcurrentExecutions` 를 세팅하는 컨트롤러/서비스 코드 부재
  - 상세: admission gate 는 `workflow?.settings` 도 `resolveConcurrencyCap` 에 넘기지만, 이번 diff 에는 workflow 설정을 갱신하는 API 가 포함되어 있지 않다(e2e 테스트도 `db.query` 로 직접 DB 를 조작해 시나리오를 구성 — "settings write API 는 별도 테스트 범위" 라는 주석으로 명시). 따라서 workflow cap 에 대한 신규 인가 취약점 표면은 이번 변경으로 추가되지 않는다. 다만 향후 workflow 레벨 API 가 추가될 때는 workspace 사례와 동일하게 workflow 소유(workspace 소속) 검증이 반드시 있어야 한다는 점을 후속 구현 시 확인할 필요가 있다.
  - 제안: workflow-level cap 을 사용자에게 노출하는 API 를 추가할 때, workspace 사례처럼 workflow → workspace 소속 확인 + admin 권한 검증을 동일하게 적용할 것(현재는 해당 사항 없음, 참고용 메모).

- **[INFO]** 에러 메시지에 민감 정보 노출 없음
  - 위치: `execution-engine.service.ts:2545-2565` (`markQueueWaitTimeout`)
  - 상세: 클라이언트로 emit 되는 `EXECUTION_CANCELLED` 이벤트의 `error` 는 고정 문자열(`'Execution cancelled: queue wait time exceeded'`)과 안정 코드(`EXECUTION_QUEUE_WAIT_TIMEOUT`)만 포함하며, DB 에러 상세·스택트레이스·내부 쿼리 구조 등은 노출되지 않는다. 예외 발생 시(catch 블록)에도 `this.logger.error`/`this.logger.warn` 으로만 서버 로그에 기록하고, 클라이언트에는 별도로 전파하지 않는다.
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿 — 신규 발견 없음(dev/e2e placeholder 로 기존 컨벤션 준수)
  - 위치: `.env.example` (`EXECUTION_QUEUE_WAIT_TIMEOUT_MS=300000`), `docker-compose.e2e.yml` (`EXECUTION_QUEUE_WAIT_TIMEOUT_MS: "8000"`)
  - 상세: 이번 PR 이 추가한 값은 큐 대기 타임아웃(ms) 숫자일 뿐 시크릿이 아니다. 같은 diff 컨텍스트에 보이는 `JWT_SECRET`/`ENCRYPTION_KEY` 등은 기존 파일에 이미 있던 것으로 이번 변경분이 아니며, `.env.example` 은 `change-me-*` placeholder 컨벤션을, `docker-compose.e2e.yml` 은 "e2e 전용, 운영 금지" 주석이 붙은 격리된 테스트 전용 값을 사용해 기존 프로젝트 컨벤션과 일치한다.
  - 제안: 없음.

## 요약

이번 PR2b(동시성 cap admission gate) 변경분은 보안 관점에서 특별한 결함이 발견되지 않았다. 신규 raw SQL(`admitExecutionOrDefer` 의 원자 조건부 UPDATE)은 5개 값 모두 `$1`-`$5` 파라미터 바인딩으로 처리되어 SQL 인젝션 벡터가 없고, cap 값(`wsCap`/`wfCap`)도 사전에 타입·범위 검증을 거친 정수만 사용된다. `maxConcurrentExecutions` workspace 설정 쓰기 경로(`PATCH /workspaces/:id/settings`)는 경로 파라미터(UUID)+JWT 사용자 식별자 조합으로 `assertAdmin` 인가 검증을 정상적으로 거치므로 IDOR/권한 우회 가능성이 없으며, DTO(`@IsInt @Min(1)`)와 서비스 계층(`resolveConcurrencyCap`)의 이중 검증으로 비정상 값(0/음수/실수/문자열)도 차단된다. workflow 레벨 cap 은 이번 PR 에 사용자 노출 쓰기 API 가 없어 신규 인가 표면이 발생하지 않는다. 에러 메시지·이벤트 payload 도 안정 코드와 고정 문자열만 노출해 정보 누출이 없다.

## 위험도

NONE

STATUS: SUCCESS
