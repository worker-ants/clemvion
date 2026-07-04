# 보안(Security) 리뷰 — recoverOrphanPendingExecutions (orphan pending backstop §8)

## 리뷰 범위

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `recoverOrphanPendingExecutions` 신설, `recoverStuckExecutions` early-return 제거 후 통합 호출
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 신규 유닛 3건
- `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` — 신규 e2e 2건 (`insertPending`, `recoverStuck` 헬퍼 포함)
- `plan/in-progress/orphan-pending-backstop.md`, `review/consistency/2026/07/04/21_50_44/*` (문서/plan, 코드 변경 없음)

참고로 e2e 테스트가 사용하는 `POST /api/executions/_test/recover-stuck-executions` 엔드포인트 자체는 본 diff 의 변경 대상이 아니며(기존 PR3/PR4 에서 이미 구현됨) `codebase/backend/src/modules/executions/executions.controller.ts:212-222` 에서 `NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` 이중 게이팅 + `@Roles('owner')` 로 보호되고 있음을 확인했다. 이번 변경은 그 엔드포인트가 호출하는 `runStuckRecoveryScan` 내부 로직에 orphan pending 스캔을 추가한 것으로, 신규 HTTP 공격 표면을 만들지 않는다.

## 발견사항

- **[INFO]** 신규 공격 표면 없음 — 내부 스캔 로직에 한정된 변경
  - 위치: `execution-engine.service.ts:224-241` (`recoverOrphanPendingExecutions`)
  - 상세: 이 메서드는 사용자 입력을 전혀 받지 않는다. `this.executionRepository.find(...)` 조건은 코드 내부에서 계산한 `staleThreshold`(서버 시각 기반 `Date`)와 고정 `ExecutionStatus.PENDING` 뿐이며, TypeORM `LessThan` 연산자를 사용해 파라미터 바인딩되므로 SQL 인젝션 여지가 없다. 대상 실행 ID(`orphans` 배열의 `id`)도 DB 조회 결과이지 외부에서 주입 가능한 값이 아니다.
  - 제안: 없음 (현행 유지).

- **[INFO]** `markQueueWaitTimeout` 재사용 — 파라미터 바인딩 확인
  - 위치: `execution-engine.service.ts:2559-2599` (`markQueueWaitTimeout`, 변경 없음 — 재사용부만 확인)
  - 상세: `.where('id = :id', { id: executionId })`, `.andWhere('status = :pending', ...)` 모두 named parameter 바인딩. 원본 UPDATE 는 `status='pending'` 조건부(WHERE)라 admission/cancel 경쟁 상태에서도 멱등 — race 로 인한 이중 처리·상태 불일치 위험 없음.
  - 제안: 없음.

- **[INFO]** 에러 메시지 노출 범위 적절
  - 위치: `execution-engine.service.ts:235-236` (`this.logger.warn` orphan 건수 로그), `2596-2599` (`markQueueWaitTimeout` catch 블록)
  - 상세: 로그는 서버 사이드 `logger.warn`/`logger.error` 에만 기록되고, 클라이언트에 반환되는 이벤트(`ExecutionEventType.EXECUTION_CANCELLED`)에는 `code`/`message` 고정 문자열(`EXECUTION_QUEUE_WAIT_TIMEOUT`, "Execution cancelled: queue wait time exceeded`)만 포함된다. 원본 예외 스택트레이스나 DB 에러 상세가 클라이언트로 전파되지 않는다.
  - 제안: 없음.

- **[INFO]** e2e 테스트 헬퍼의 raw SQL — 인젝션 여지 검토
  - 위치: `execution-concurrency-cap.e2e-spec.ts:270-278` (`insertPending`), `460-465`(`insertRunningBlocker`, 기존)
  - 상세: `db.query(... VALUES ($1, $2, 'pending', NOW() - $3::interval)', [id, workflowId, queuedAtAgo])` — 파라미터 바인딩($1/$2/$3) 사용. `queuedAtAgo` 인자는 테스트 코드 내부에서 하드코딩한 리터럴(`'10 minutes'`, `'1 second'`)만 전달되어 외부 입력 경로가 없다. e2e 전용 테스트 코드이므로 프로덕션 공격 표면과 무관.
  - 제안: 없음.

- **[INFO]** boot-only 트리거 접근 통제는 기존 설계 재사용, 본 diff 범위 밖
  - 위치: `executions.controller.ts:212-222` (본 diff 에 포함되지 않은 기존 코드, 참고 확인만)
  - 상세: 이번 변경으로 이 엔드포인트의 인가 로직이 수정되지는 않았다. 다만 이 엔드포인트가 이제 orphan pending 도 cancel 하므로 "trigger 되는 부작용의 범위"가 넓어졌다는 점은 유의할 만하나, (1) 이미 owner 인가 + NODE_ENV/flag 이중 게이트로 보호되어 있고 (2) 부작용이 이미 `cancelled` 상태로 확정될 값을 앞당겨 적용하는 것뿐이라 신뢰 경계를 넘는 권한 상승이나 데이터 노출은 없다.
  - 제안: 없음 (참고용 확인 사항).

## 요약

이번 변경은 `recoverStuckExecutions` 부팅 백스톱에 `recoverOrphanPendingExecutions` (queue-wait 타임아웃을 이미 초과한 `pending` Execution 을 `markQueueWaitTimeout` 으로 cancel)을 추가한 내부 유지보수 로직으로, 사용자 입력을 받지 않고 모든 DB 접근이 TypeORM 파라미터 바인딩(`LessThan`, named parameter UPDATE)으로 이루어져 SQL 인젝션 위험이 없다. 신규 HTTP 엔드포인트가 추가되지 않았고, e2e 헬퍼가 사용하는 기존 test-hook 라우트는 이미 이중 env 게이팅 + `@Roles('owner')` 인가로 보호되고 있어 이번 diff 로 인한 신규 공격 표면이나 인가 우회, 시크릿 노출, 민감정보 에러 누출은 발견되지 않았다.

## 위험도

NONE

STATUS: SUCCESS
