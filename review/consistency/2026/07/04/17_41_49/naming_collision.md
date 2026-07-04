# 신규 식별자 충돌 검토 — impl-done (spec/5-system/, 동시 실행 cap PR2b)

검토 대상 신규 식별자: `V104__execution_queued_at.sql`(`queued_at` 컬럼), `V105__execution_workflow_status_index.sql`(`idx_execution_workflow_status`), `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`, `maxConcurrentExecutions`, `admitExecutionOrDefer` / `markQueueWaitTimeout`.

SoT: `/Volumes/project/private/clemvion/.claude/worktrees/impl-concurrency-cap-enforce-54f29a` (HEAD 워킹트리, 절대경로로 확인).

## 발견사항

- **[INFO]** `maxConcurrentExecutions` 와 기존 `maxConcurrency`(Parallel 노드) 명명 유사
  - target 신규 식별자: `Workspace.settings.maxConcurrentExecutions` / `Workflow.settings.maxConcurrentExecutions` (`spec/1-data-model.md:94,120`, `spec/5-system/4-execution-engine.md:1075-1076`)
  - 기존 사용처: `spec/4-nodes/1-logic/0-common.md:133`, `spec/4-nodes/1-logic/10-parallel.md` — Parallel 노드 `config.maxConcurrency`(노드 내부 branch 동시성)
  - 상세: 두 식별자 모두 "동시 실행 수 제한"이라는 상위 개념을 공유하지만 스코프가 다르다(엔진 admission gate의 workspace/workflow cap vs 노드 내부 branch 병렬도). 이름이 `maxConcurrency` 접두 공유 + `Executions` 접미만 다르다는 점에서 처음 접하는 독자가 혼동할 여지가 있음.
  - 완화 근거: `spec/1-data-model.md:94` 원문이 "Parallel 노드 `config.maxConcurrency`(노드 내 branch 동시성)와는 스코프가 다른 별개 키"라고 명시적으로 각주 처리했고, 코드에서도 `execution-limits.ts:40`·`update-workspace-settings.dto.ts:47` 주석이 동일 disambiguation 을 반복한다. 이미 충분히 명확화되어 있어 CRITICAL/WARNING 승격 불필요.
  - 제안: 현행 각주 disambiguation 유지로 충분. 추가 조치 불필요(참고용 기록).

- **[INFO]** `maxConcurrentExecutions` 키가 `Workspace.settings` 와 `Workflow.settings` 양쪽에서 동일 이름으로 재사용
  - target 신규 식별자: 두 엔티티(Workspace, Workflow) 모두 JSONB `settings.maxConcurrentExecutions`
  - 기존 사용처: 없음(신규 도입) — 동일 PR 내 자체 재사용 패턴
  - 상세: 동일 키 이름이 서로 다른 엔티티 스코프(워크스페이스당 10 vs 워크플로우당 3)에 쓰이지만, 이는 `settings.timezone` 처럼 이 프로젝트에서 이미 쓰이는 "같은 의미, 다른 스코프" JSONB 키 재사용 컨벤션과 일치한다. 두 문서(`1-data-model.md`, `4-execution-engine.md §8`)의 정의가 상호 참조로 정합적이다.
  - 제안: 충돌 아님, 컨벤션 준수. 조치 불필요.

- **[INFO]** `idx_execution_workflow_status`(V105) vs 기존 `idx_execution_workflow_started`(V002)
  - target 신규 식별자: `idx_execution_workflow_status` (`execution(workflow_id, status)`) — `codebase/backend/migrations/V105__execution_workflow_status_index.sql:13`
  - 기존 사용처: `idx_execution_workflow_started` (`execution(workflow_id, started_at DESC)`) — `codebase/backend/migrations/V002__indexes.sql:18`, `idx_execution_status`(`execution(status)`) — `V002__indexes.sql:19`
  - 상세: 이름이 `idx_execution_workflow_*` 접두를 공유해 유사해 보이나 정확히 구분되는 별개 식별자이며, 실제 이름 충돌(동일 문자열)은 없다. V105 마이그레이션 주석이 기존 두 인덱스(`idx_execution_status`, `idx_execution_workflow_started`)를 명시적으로 언급하며 신규 복합 인덱스의 필요성을 설명한다.
  - 제안: 충돌 아님. 명명 자체는 컨벤션(`idx_<table>_<cols>`)을 따르고 있어 조치 불필요.

## 요약

신규 식별자 6종(`queued_at`/V104, `idx_execution_workflow_status`/V105, `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`, `maxConcurrentExecutions`, `admitExecutionOrDefer`, `markQueueWaitTimeout`) 모두 대상 워킹트리 코드(마이그레이션 파일·서비스 메서드·env·DTO)에 실제로 존재하며 구현과 spec 이 정합적이다. 마이그레이션 V104/V105 는 기존 최대 버전(V103) 다음 순번으로 중복 없이 이어지고(`check-duplicate-versions.sh` clean), `idx_execution_workflow_status` 는 기존 `idx_execution_status`/`idx_execution_workflow_started` 와 이름·컬럼 구성 모두 겹치지 않는다. `EXECUTION_QUEUE_WAIT_TIMEOUT`/`EXECUTION_QUEUE_WAIT_TIMEOUT_MS` 는 기존 `EXECUTION_TIMEOUT`/`EXECUTION_TIME_LIMIT_EXCEEDED`/`EXECUTION_TERMINATED`/`EXECUTION_ENQUEUE_FAILED` 등 유사 접두 에러코드·env 와 spec 본문(`3-error-handling.md`)에서 명확히 구분되어 있다. 유일하게 사람이 혼동할 만한 지점은 `maxConcurrentExecutions`(신규, 엔진 admission cap) 와 `maxConcurrency`(기존, Parallel 노드 branch 동시성)의 명명 유사성이지만, spec·코드 양쪽에 이미 반복적인 명시적 disambiguation 각주가 있어 실질적 위험은 낮다(INFO 수준). CRITICAL/WARNING 급 충돌은 발견되지 않았다.

## 위험도

LOW

BLOCK: NO

STATUS: SUCCESS
