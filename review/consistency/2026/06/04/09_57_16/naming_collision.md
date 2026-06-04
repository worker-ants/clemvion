### 발견사항

- **[WARNING]** `execution-run` 큐가 `MONITORED_QUEUES` 및 e2e 큐 목록에 미등록
  - target 신규 식별자: `EXECUTION_RUN_QUEUE = 'execution-run'` (`codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts`)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/modules/system-status/system-status.constants.ts:44` — `MONITORED_QUEUES` 배열에 `background-execution`, `execution-continuation` 등이 등록되어 있지만 `execution-run` 은 없음. `/Volumes/project/private/clemvion/codebase/backend/test/system-status.e2e-spec.ts:25` — `EXPECTED_QUEUE_NAMES` 하드코딩 목록 12개에도 누락.
  - 상세: PR1 이 새 BullMQ 큐 `execution-run` 을 등록하고 `ExecutionRunProcessor` 가 이를 소비하지만, `system-status.constants.ts` 의 `MONITORED_QUEUES` 레지스트리에 추가되지 않아 시스템 상태 화면에서 해당 큐의 건강도·utilization 이 노출되지 않는다. 또한 `spec/data-flow/0-overview.md` §4 BullMQ 큐 카탈로그(주석 "큐가 늘어나면 본 표와 해당 도메인 spec 의 외부 의존 섹션 모두 갱신한다")에 `execution-run` 행이 추가되지 않았다. e2e `EXPECTED_QUEUE_NAMES` 는 블랙박스 하드코딩이라 큐 추가 시 직접 갱신이 필요하다(파일 주석 24번 줄 명시).
  - 제안: `system-status.constants.ts` 의 `MONITORED_QUEUES` 에 `{ name: EXECUTION_RUN_QUEUE, group: 'execution', concurrency: resolveExecutionRunWorkerConcurrency() }` 를 추가하고, `spec/data-flow/0-overview.md` §4 표에 `execution-run` 행을 추가한다. `system-status.e2e-spec.ts` 의 `EXPECTED_QUEUE_NAMES` 도 `'execution-run'` 을 포함하도록 갱신한다.

- **[INFO]** `spec/data-flow/0-overview.md` §4 큐 카탈로그 미갱신
  - target 신규 식별자: `'execution-run'` BullMQ 큐
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/data-flow/0-overview.md:166` — 큐 카탈로그 표. `execution-continuation`, `background-execution` 등 기존 12개 큐가 등록됨. 파일 하단 주석 "큐가 늘어나면 본 표와 해당 도메인 spec 의 외부 의존 섹션 모두 갱신한다" 명시.
  - 상세: spec/5-system/4-execution-engine.md 와 spec/0-overview.md 는 이미 `execution-run` 큐를 정확히 기술하도록 worktree 에서 갱신됐으나, `spec/data-flow/0-overview.md` §4 카탈로그는 갱신되지 않았다. 의미 충돌은 없지만 단일 진실 원칙의 카탈로그가 불완전한 상태다.
  - 제안: `/Volumes/project/private/clemvion/spec/data-flow/0-overview.md` §4 표에 `execution-run` 행(등록 모듈: `execution-engine.module.ts`, Producer: `ExecutionEngineService.execute()`, Consumer: `ExecutionRunProcessor`, 작업 단위: 첫 active 세그먼트(시작→첫 BLOCK/완료) work-stealing)을 추가한다.

- **[INFO]** `EXECUTION_RUN_WORKER_CONCURRENCY` 가 `system-status.constants.ts` 의 concurrency 파생에 반영되지 않음
  - target 신규 식별자: `EXECUTION_RUN_WORKER_CONCURRENCY` 환경변수 (`codebase/backend/.env.example`, `resolveExecutionRunWorkerConcurrency`)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/modules/system-status/system-status.constants.ts:37` — `continuationConcurrency = Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1` 로 동적 파싱 후 `MONITORED_QUEUES` 에 반영. `EXECUTION_RUN_WORKER_CONCURRENCY` 는 같은 패턴으로 system-status 에 반영돼야 utilization 계산이 정확해지지만, 현재 `MONITORED_QUEUES` 에 행이 없어 이 문제는 위 WARNING 의 파생이다.
  - 상세: `system-status.constants.ts` 에 `execution-run` 큐를 추가할 때 `continuationConcurrency` 와 동일하게 env 기반 동적 파싱(`resolveExecutionRunWorkerConcurrency()`)을 사용해야 utilization 이 정확해진다. 환경변수 이름 자체의 충돌은 없다.
  - 제안: `system-status.constants.ts` 추가 시 `const executionRunConcurrency = resolveExecutionRunWorkerConcurrency()` 또는 `Number(process.env.EXECUTION_RUN_WORKER_CONCURRENCY) || 1` 패턴 적용.

---

### 요약

신규 도입된 식별자(`EXECUTION_RUN_QUEUE`, `ExecutionRunProcessor`, `ExecutionRunJob`, `runExecutionFromQueue`, `EXECUTION_RUN_WORKER_CONCURRENCY`, `EXECUTION_RUN_PRIORITY`, `EXECUTION_RUN_QUEUE_DEFAULT_OPTS`, `buildExecutionRunJobId`, `resolveExecutionRunPriority`, `resolveExecutionRunWorkerConcurrency`)는 기존 코드베이스의 어떤 식별자와도 의미 충돌이 없다. 큐 이름 `'execution-run'`도 기존 `'background-execution'`, `'execution-continuation'` 과 네임스페이스가 명확히 분리된다. 단, 새 큐를 `MONITORED_QUEUES` 레지스트리(`system-status.constants.ts`)와 `spec/data-flow/0-overview.md` §4 카탈로그에 등록하지 않아 모니터링 공백과 카탈로그 불완전이 발생하며, e2e 테스트의 하드코딩 큐 목록도 갱신이 필요하다. 이는 의미 충돌이 아닌 등록 누락 문제다.

### 위험도

LOW
