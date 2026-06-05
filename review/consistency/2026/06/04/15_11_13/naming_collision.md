# 신규 식별자 충돌 Check 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
대상 범위: `spec/5-system/4-execution-engine.md` + 관련 구현 diff

---

## 발견사항

충돌로 분류할 항목이 없습니다. 세부 점검 결과는 아래와 같습니다.

### [INFO] EXECUTION_TIME_LIMIT_EXCEEDED — EXECUTION_TIMEOUT 과의 의미 분리가 코드·spec·문서에서 일관되게 명시됨

- target 신규 식별자: `ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED` (`codebase/backend/src/nodes/core/error-codes.ts` line 54)
- 기존 사용처: `EXECUTION_TIMEOUT` — `codebase/backend/src/nodes/data/code/code.handler.ts` 에서 Code 노드 스크립트 타임아웃으로 사용 중
- 상세: 두 코드는 의미가 다르다. `EXECUTION_TIMEOUT` = Code 노드의 스크립트 실행 시간 초과(노드 단위). `EXECUTION_TIME_LIMIT_EXCEEDED` = 엔진 레벨 단일 Execution 누적 active-running 시간 초과(워크플로우 전체). 충돌은 없으나 이름이 유사해 혼동 가능성이 있었다. 그러나 error-codes.ts 주석, execution-failure-classifier.ts 의 TIMEOUT_CODES Set 인라인 주석, spec/5-system/3-error-handling.md line 59-60, spec/conventions/chat-channel-adapter.md line 387, workflow-errors.ts 주석 등 여러 위치에서 명시적으로 구분 설명이 추가되어 있으므로 실제 혼동 위험이 낮다.
- 제안: 없음. 현재 명시 수준이 적절함.

### [INFO] ExecutionTimeLimitError 클래스명 — 기존 workflow-errors 패턴과 일관됨

- target 신규 식별자: `class ExecutionTimeLimitError` (`codebase/backend/src/modules/execution-engine/workflow-errors.ts` line 501)
- 기존 사용처: 같은 파일의 `InvalidExecutionStateError`, `SubWorkflowTimeoutError`, `RetryLastTurnError` 등
- 상세: 동일 파일 내 동일 패턴(`*Error extends Error, readonly code = ErrorCode.*`)을 따르며, 기존에 동일 이름이 다른 의미로 사용된 사례 없음. 충돌 없음.
- 제안: 없음.

### [INFO] EXECUTION_MAX_ACTIVE_RUNNING_MS ENV var — 기존 ENV 네임스페이스와 일관됨

- target 신규 식별자: `EXECUTION_MAX_ACTIVE_RUNNING_MS` (`codebase/backend/.env.example` line 157, `execution-limits.ts` line 24)
- 기존 사용처: `MAX_NODE_ITERATIONS`, `CONTINUATION_WORKER_CONCURRENCY`, `EXECUTION_RUN_WORKER_CONCURRENCY`, `SIGTERM_GRACE_MS` 등 — 기존 패턴은 `<DOMAIN>_<ATTRIBUTE>` 혹은 `MAX_<ATTRIBUTE>` 형식
- 상세: 기존 실행 엔진 관련 ENV(`MAX_NODE_ITERATIONS`, `EXECUTION_RUN_WORKER_CONCURRENCY`)와 네임스페이스가 일치한다. 다른 의미로 이미 존재하는 ENV 키 없음. 충돌 없음.
- 제안: 없음.

### [INFO] activeRunningMs 엔티티 필드 — durationMs 와 의미·역할 명확히 분리됨

- target 신규 식별자: `Execution.activeRunningMs` / DB 컬럼 `active_running_ms` (`codebase/backend/src/modules/executions/entities/execution.entity.ts`)
- 기존 사용처: `Execution.durationMs` / DB 컬럼 `duration_ms` — wall-clock 총 소요 시간
- 상세: `durationMs`(wall-clock 전체) vs `activeRunningMs`(active 세그먼트 누적, `waiting_for_input` 제외)로 의미가 다르며 이름도 겹치지 않는다. 데이터 모델 spec(`spec/1-data-model.md` §2.13)에도 두 필드의 구분이 이미 반영되어 있다. 충돌 없음.
- 제안: 없음.

### [INFO] execution-limits.ts 신규 파일 — 기존 파일명과 겹치지 않음

- target 신규 식별자: `codebase/backend/src/modules/execution-engine/execution-limits.ts`
- 기존 사용처: `execution-engine.service.ts`, `workflow-errors.ts`, `queues/execution-run.queue.ts` 등 — `execution-limits` 이름 기존 파일 없음
- 상세: 디렉토리 내 기존 파일 목록 확인 결과 `execution-limits.ts` / `execution-limits.spec.ts` 는 이번에 신규 추가된 파일이다. 기존 파일명과 충돌 없음.
- 제안: 없음.

### [INFO] resolveMaxActiveRunningMs 함수명 — 기존 resolve* 패턴 계열과 일관됨

- target 신규 식별자: `resolveMaxActiveRunningMs` (`execution-limits.ts`)
- 기존 사용처: `resolveExecutionRunWorkerConcurrency`, `resolveExecutionRunPriority` (`queues/execution-run.queue.ts`)
- 상세: 기존 `resolveExecution*` 패턴을 따르되, 해결하는 대상(`MaxActiveRunningMs`)이 새로운 ENV 키에 대응한다. 이름이 기존 함수와 겹치지 않으며 동일 모듈 내 별도 함수와 의미 충돌 없음.
- 제안: 없음.

### [INFO] DEFAULT_MAX_ACTIVE_RUNNING_MS 상수명 — MAX_EXECUTION_PATH_ROWS 등 기존 상수와 혼동 없음

- target 신규 식별자: `DEFAULT_MAX_ACTIVE_RUNNING_MS` (`execution-limits.ts`)
- 기존 사용처: `MAX_EXECUTION_PATH_ROWS` (`executions.service.ts`) — execution path row 수 상한, 별개 도메인
- 상세: 이름이 다르고 의미도 다른 도메인이다. 충돌 없음.
- 제안: 없음.

### [INFO] V073 마이그레이션 번호 — 직전 번호 V072 와 연속적으로 일관됨

- target 신규 식별자: `V073__execution_active_running_ms.sql`
- 기존 사용처: `V072__integration_unify_store_identifier_index.sql` (가장 최근 마이그레이션)
- 상세: V073 이 V072 바로 다음으로 연속되며, V073 으로 등록된 다른 파일 없음. 충돌 없음.
- 제안: 없음.

### [INFO] MONITORED_QUEUES 에 execution-run 추가 — 기존 큐 목록과 중복 없음

- target 신규 식별자: `EXECUTION_RUN_QUEUE` 를 `MONITORED_QUEUES` 에 추가 (`system-status.constants.ts`)
- 기존 사용처: `BACKGROUND_EXECUTION_QUEUE`, `CONTINUATION_EXECUTION_QUEUE` 등 기존 큐 항목
- 상세: `EXECUTION_RUN_QUEUE = 'execution-run'` 은 PR1(`impl-exec-intake-queue`) 에서 도입된 상수이며, 이번 diff 에서는 `MONITORED_QUEUES` 등록만 추가한다. `execution-run` 큐 이름은 이미 코드베이스에 존재하는 상수를 참조하는 것이고, 기존 `MONITORED_QUEUES` 목록에 동일 큐 이름으로 등록된 항목 없음. 충돌 없음.
- 제안: 없음.

---

## 요약

이번 diff 가 도입하는 식별자(`EXECUTION_TIME_LIMIT_EXCEEDED`, `ExecutionTimeLimitError`, `EXECUTION_MAX_ACTIVE_RUNNING_MS`, `activeRunningMs`/`active_running_ms`, `execution-limits.ts`, `resolveMaxActiveRunningMs`, `DEFAULT_MAX_ACTIVE_RUNNING_MS`, `V073` 마이그레이션) 중 기존 사용처와 실질적으로 충돌하는 항목은 없다. `EXECUTION_TIMEOUT` 과 `EXECUTION_TIME_LIMIT_EXCEEDED` 의 의미 유사성은 잠재적 혼동 위험이 있었으나, error-codes.ts·workflow-errors.ts·spec/5-system/3-error-handling.md·chat-channel-adapter.md 등 여러 위치에서 명시적 구분 설명이 일관되게 추가되어 있어 실제 충돌 위험은 없다.

---

## 위험도

NONE
