# 보안(Security) 코드 리뷰

대상: PR4 — BullMQ stalled 자동 재배달 + execution-run DLQ 모니터
(`codebase/backend/src/modules/execution-engine/**`, `codebase/backend/src/modules/executions/executions.controller.ts`, 관련 spec/plan 변경)

## 발견사항

- **[WARNING]** 신규 e2e 훅 엔드포인트에 workspace 소유권(IDOR) 검증 누락
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:232-244` (`simulateExecutionRunRedeliveryForTest`)
  - 상세: 같은 컨트롤러의 다른 `:id` 라우트(`findOne` L75-88, `stop` L135-142, `continueExecution` L165-196)는 모두 `@Param('id') id` 를 받은 직후 `this.executionsService.verifyOwnership(id, workspaceId)` 를 호출해, "요청자가 속한 workspace" 와 "`id` 가 실제로 그 workspace 소속인지" 를 둘 다 검증한다(다른 workspace 의 실행 ID 를 추측해 넣는 IDOR 차단, 주석 `W-44`/`CRIT #1` 참조). 반면 신규 `simulateExecutionRunRedeliveryForTest` 는 `@Param('id', ParseUUIDPipe) id` 를 받고도 `verifyOwnership` 호출 없이 곧바로 `this.executionEngineService.runExecutionFromQueue(id, {})` 를 호출한다. `@Roles('owner')` 가드(`codebase/backend/src/common/guards/roles.guard.ts:46-76`)는 "요청 헤더 `X-Workspace-Id`(또는 JWT) 로 식별된 workspace 에서 호출자가 owner 인가" 만 검증하며, 그 workspace 가 URL 의 `id`(executionId) 를 실제로 소유하는지는 전혀 확인하지 않는다. 즉 이 엔드포인트가 활성화된 환경(둘 다 필요: `NODE_ENV==='test'` && `E2E_TEST_HOOKS==='1'`)에서는, 자신이 owner 인 임의 workspace 의 자격증명만으로 URL 의 `:id` 를 다른 workspace 의 executionId 로 바꿔 넣어 그 실행에 대해 `runExecutionFromQueue`(§7.5 case B 재구동 트리거)를 호출할 수 있다 — cross-workspace 실행에 대한 authorization 우회(IDOR).
  - 영향 범위: 프로덕션에서는 `NODE_ENV` 가 `production` 이고 `E2E_TEST_HOOKS` 가 설정되지 않으므로 이중 게이트로 인해 도달 불가 — 즉시 위험은 없음. 다만 (a) e2e 환경이 공유 인프라에 배포되거나 (b) 향후 게이팅 조건이 완화/누락되는 회귀가 생기면 즉시 실질적 IDOR 로 전환된다. 같은 파일의 기존 `triggerStuckRecoveryForTest`(L212-222)는 param 이 없는 전역 스캔이라 이 문제가 애초에 없었는데, 이번에 `:id` 파라미터를 도입하면서 동일한 방어(verifyOwnership) 를 이식하지 않았다.
  - 제안: 다른 라우트와 동일하게 `@WorkspaceId() workspaceId: string` 파라미터를 추가하고 `await this.executionsService.verifyOwnership(id, workspaceId)` 를 `runExecutionFromQueue` 호출 전에 삽입한다. e2e 테스트(`execution-stalled-redelivery.e2e-spec.ts`)는 이미 자신이 만든 workspace 의 실행만 대상으로 하므로 이 검증을 추가해도 회귀하지 않는다.

- **[INFO]** e2e 전용 backdoor 라우트의 다층 방어는 기존 패턴과 일관되게 적용됨
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:232-244`
  - 상세: `NODE_ENV==='test'` && `E2E_TEST_HOOKS==='1'` 이중 게이트, `@Roles('owner')`, `@ApiExcludeEndpoint()`(swagger 미노출) 조합은 기존 `_test/recover-stuck-executions`(L212-222)와 동일한 검증된 패턴이다. 프로덕션 이미지가 `NODE_ENV=production` 을 강제하는 한 이 라우트 자체는 프로덕션에 노출되지 않는다. 위 WARNING(IDOR)은 이 게이트를 우회하는 문제가 아니라, 게이트 통과 후 인가 세분화(자원 소유권)가 빠졌다는 별개 지적이다.
  - 제안: 없음 (참고 확인).

- **[INFO]** `finalizeStalledExhausted` / DLQ 모니터는 사용자 입력을 다루지 않아 인젝션 표면 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:267-316`, `codebase/backend/src/modules/execution-engine/queues/execution-run-dlq-monitor.service.ts:1-120`
  - 상세: 두 신규 경로 모두 TypeORM QueryBuilder 의 파라미터 바인딩(`:id`, `:running` 등)을 사용해 SQL 인젝션 표면이 없다. `executionId` 는 BullMQ job 데이터에서 오며 사용자 HTTP 입력이 직접 SQL 문자열에 삽입되지 않는다. 에러 메시지(`error.message`)에도 스택트레이스나 내부 경로 등 민감정보 노출 없이 고정 문자열만 저장한다.
  - 제안: 없음.

- **[INFO]** DLQ 모니터 env 파싱은 안전한 화이트리스트 검증
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run-dlq-monitor.config.ts:420-424` (`parsePositiveInt`)
  - 상세: 정규식 사전검증(`/^\d+$/`) 후 `Number.isInteger` 재확인으로 공학 표기(`1e10`)·음수·소수 등 비정상 입력을 안전하게 fallback 처리한다. 하드코딩된 시크릿 없음, env 값만 파싱.
  - 제안: 없음.

- **[INFO]** 큐 설정 변경(`maxStalledCount: 0 → 1`)은 인가/인증과 무관한 신뢰성 파라미터
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:915`
  - 상세: BullMQ stalled 재배달 허용치 상향은 crash-recovery 설계이며, 비멱등 노드 이중 실행 위험은 코드 주석과 plan 문서(`exec-intake-queue-impl.md`)에서 이미 "at-least-once, poison blast radius bound" 로 명시적으로 분석·수용된 trade-off 다. 보안 취약점이라기보다 신뢰성/멱등성 설계 영역이며 별도 보안 결함 아님.
  - 제안: 없음.

## 요약

이번 PR4 변경분(BullMQ stalled 자동 재배달, `finalizeStalledExhausted` dead-letter 마감, execution-run DLQ 모니터)은 SQL 인젝션·하드코딩 시크릿·안전하지 않은 암호화·민감정보 노출 등 전형적 OWASP Top 10 결함은 발견되지 않았고, 신규 DB 쓰기 경로는 모두 파라미터 바인딩된 QueryBuilder 로 안전하다. 다만 신규 e2e 전용 backdoor 엔드포인트(`POST /executions/:id/_test/simulate-execution-run-redelivery`)는 URL 의 `id`(executionId) 에 대한 workspace 소유권 검증(`verifyOwnership`)을 누락해, 같은 컨트롤러의 다른 모든 `:id` 라우트가 지키는 IDOR 방어 관례를 깨고 있다 — 실제 도달은 `NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` 이중 게이트 뒤에 있어 프로덕션 위험은 없지만, 향후 게이팅 완화나 공유 test 인프라 노출 시 즉시 실질 IDOR 로 전환될 수 있는 방어 결여(defense-in-depth 누락)로 WARNING 처리한다.

## 위험도

LOW
