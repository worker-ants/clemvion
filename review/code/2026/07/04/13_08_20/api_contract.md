# API 계약(API Contract) Review

## 발견사항

- **[WARNING]** 신규 `_test` 엔드포인트에 워크스페이스 소유권(IDOR) 검증 누락
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:232-244` (`simulateExecutionRunRedeliveryForTest`)
  - 상세: 동일 컨트롤러의 다른 `:id` 엔드포인트(`findOne`, `stop`, `continueExecution`)는 모두 `@Param('id')` 를 받은 뒤 `executionsService.verifyOwnership(id, workspaceId)` 를 호출해 "요청자의 workspace 가 해당 execution 을 소유하는지"를 명시적으로 검증한다(주석에 W-44 CRIT #1 IDOR 대응으로 문서화됨). 신규 `simulateExecutionRunRedeliveryForTest(@Param('id') id)` 는 `id` 를 받지만 이 검증 없이 바로 `executionEngineService.runExecutionFromQueue(id, {})` 를 호출한다. `RolesGuard` 는 "요청자가 자신이 속한 어떤 workspace 의 owner 역할을 갖는지"만 확인하고, path param `id` 가 그 workspace 소유인지는 검증하지 않으므로 — 게이트 통과 조건 자체는 이 컨트롤러의 다른 라우트와 동일한 인가 계약을 만족하지 못한다. 기존 `_test/recover-stuck-executions` 는 execution id 를 파라미터로 받지 않는 전역 스캔이라 이 이슈가 원천적으로 없었는데, 신규 엔드포인트는 `:id` 를 받는 형태로 확장되면서 동일 IDOR 방어 패턴이 이관되지 않았다.
  - 위험 완화 요소: `NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` 이중 게이트로 실제 프로덕션 노출 가능성은 없고, e2e 전용 backdoor 로 문서화되어 있어 실질 exploit 가능성은 낮음. 다만 "API 계약" 관점에서 컨트롤러 내 인가 패턴의 일관성이 깨진 것은 사실이며, 추후 이 훅이 운영용으로 전용되거나(주석에 "PR4 관측성 트랙에서 별도 검토"라 명시) 게이트 조건 하나가 실수로 완화될 경우 다른 workspace 의 execution 을 임의로 재구동시킬 수 있는 잠재 벡터가 된다.
  - 제안: 다른 workspace-scoped `:id` 엔드포인트와 동일하게 `@WorkspaceId()` 를 받아 `await this.executionsService.verifyOwnership(id, workspaceId)` 를 호출한 뒤 `runExecutionFromQueue` 를 트리거하도록 정렬. 혹은 e2e 전용 훅이라 스코프 검증이 불필요하다는 설계 의도라면, 그 근거를 주석에 "IDOR 검증 의도적 생략 — 이유" 형태로 명시해 향후 리뷰에서 반복 플래그되지 않도록 한다.

- **[INFO]** `finalizeStalledExhausted` fire-and-forget 호출의 예외 처리는 로그로만 종결
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts:822-830`
  - 상세: `onFailed` 핸들러(BullMQ `@OnWorkerEvent`)는 반환값이 없는 동기 함수이므로 `finalizeStalledExhausted(executionId)` 호출을 `void ... .catch(...)` 로 fire-and-forget 한다. 실패 시 `logger.error` 만 남기고 재시도 경로가 없다 — DB update 자체가 일시적으로 실패(커넥션 풀 고갈 등)하면 해당 Execution 은 `RUNNING` 으로 영구 잔류할 수 있다(다음 부팅 시 `recoverStuckExecutions` backstop 이 회수한다고 설계 문서에 명시되어 있어 완전한 갭은 아님). API 계약 자체에 영향을 주는 문제는 아니고 내부 event handler 설계이므로 INFO.
  - 제안: 별도 조치 불요 — 설계 의도(부팅 backstop 이 최종 안전망)가 plan(`plan/in-progress/exec-intake-queue-impl.md`)에 명시되어 있어 현 상태로 수용 가능.

- **[INFO]** DLQ 모니터는 알람 로그만 발생, HTTP surface 없음
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run-dlq-monitor.service.ts` 전체
  - 상세: `ExecutionRunDlqMonitorService` 는 API 엔드포인트를 노출하지 않는 순수 내부 observability 컴포넌트(주기 폴링 + `logger.error` 알람)이며, `ContinuationDlqMonitorService` 와 동일 패턴을 따른다. API 계약 관점에서 검토할 표면이 없음 — 문제 없음, 참고용 기록.

- **[INFO]** `@ApiExcludeEndpoint()` 적용 일관성 확인 — 문제 없음
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:235`
  - 상세: 신규 test-hook 엔드포인트는 기존 `_test/recover-stuck-executions` 와 동일하게 `@ApiExcludeEndpoint()` 로 Swagger 문서에서 배제되어 있어, 공개 API 계약(스키마 노출)에는 영향을 주지 않는다. HTTP 상태 코드(`202 ACCEPTED`)·데코레이터 순서(`@Post` → `@HttpCode` → `@Roles` → `@ApiExcludeEndpoint`)도 기존 test-hook 라우트와 동일하게 정렬되어 일관성 있음.

## 요약

이번 변경의 핵심은 execution-engine 내부(BullMQ stalled 재배달, dead-letter 마감, DLQ 관측성 서비스)이며 공개 API 계약(응답 스키마·버전·페이지네이션·에러 포맷)에는 영향이 없다. 유일하게 신규 공개 표면은 `executions.controller.ts` 에 추가된 e2e 전용 test-hook 엔드포인트 `POST /executions/:id/_test/simulate-execution-run-redelivery` 로, `NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` 이중 게이트 + `@Roles('owner')` + `@ApiExcludeEndpoint()` 로 기존 `_test/recover-stuck-executions` 패턴을 잘 재사용했다. 다만 이 신규 엔드포인트는 `:id` path param 을 받는 형태로 확장되었음에도, 동일 컨트롤러의 다른 `:id` 라우트들이 일관되게 적용하는 workspace 소유권(IDOR) 검증(`verifyOwnership`)이 빠져 있어 컨트롤러 내부 인가 계약의 일관성이 깨졌다. 실제 프로덕션 노출 위험은 이중 게이트로 인해 낮지만, 계약 일관성·향후 재사용 안전성 관점에서 보강을 권고한다(WARNING). 그 외 발견 사항은 모두 설계 의도가 명확히 문서화된 INFO 수준이다.

## 위험도

LOW
