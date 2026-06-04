# 정식 규약 준수 검토 결과

검토 모드: `--impl-done`
Target: `spec/5-system/4-execution-engine.md` + 구현 diff (PR1 exec-intake-queue)

---

## 발견사항

### [INFO] spec frontmatter `status: partial` 유지 — 갱신 여부 점검
- target 위치: `spec/5-system/4-execution-engine.md` frontmatter `status: partial`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3.1 전이 규칙` — "마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 `implemented` 로 승격"
- 상세: PR1 이 §4.1~4.3 의 일부(intake 큐 + work-stealing)를 구현했으나 §7.1 stalled-job 재배달(crash 재개, PR3)·§8 동시성 cap(PR2)·우선순위 3-tier(PR2)가 미구현이고, 기존 `pending_plans:` 의 두 plan 파일(`execution-engine-residual-gaps.md`, `spec-sync-execution-engine-gaps.md`)이 여전히 `plan/in-progress/` 에 존재한다. 따라서 `status: partial` 유지는 규약에 맞다. 단, PR1 완료로 신규 plan `exec-intake-queue-impl.md`(PR2-4 추적)가 `pending_plans:` 에 없는지 확인 필요.
- 제안: spec 본문에 `plan/in-progress/exec-intake-queue-impl.md` 가 언급되어 있으나 frontmatter `pending_plans:` 에 등재되지 않았다면 추가해야 한다. 가드(`spec-pending-plan-existence.test.ts`)는 등재된 path 의 실존만 검사하므로 미등재 시 false-negative.

### [WARNING] 구현이 spec §4.2 jobId 스키마와 의도적으로 diverge하나 spec 갱신이 동반됨
- target 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` `buildExecutionRunJobId`; `spec/5-system/4-execution-engine.md §9.2` (diff 내 `exec:run:seq` 행)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — spec 이 약속한 surface 와 구현이 일치해야 한다
- 상세: spec §4.2 는 jobId 를 `<executionId>:run:<seq>` 형식으로 기술하고 있었으나, PR1 은 `executionId` 자체를 jobId 로 사용한다. diff 에서 §9.2 키 패턴 행에 "(PR3/PR4 활성화 — PR1 미사용)" 및 §9.3 큐 표에 "jobId = executionId" 를 명기해 spec 을 동시 갱신했으므로 spec↔구현 불일치가 아니다. 그러나 §4.2 본문("태스크 단위") 절 자체의 jobId 표기(`<executionId>:run:<seq>`)는 diff 에서 수정되지 않았다. §4.2 원문이 여전히 `taskId` 중심의 aspirational 형식을 유지하므로 독자가 §9.2·§9.3 의 수정과 충돌로 혼동할 수 있다.
- 제안: `spec/5-system/4-execution-engine.md §4.2` 절에 "PR1 에서 jobId = executionId 로 구현됨 (1:1 enqueue, seq 불필요 — §9.2 참조)" 주석을 추가해 §9.2 기술과 정합시킨다. 또는 CONVENTIONS 갱신이 아닌 spec 단독 수정으로 충분.

### [INFO] `pending_plans:` 미등재 가능성 — `exec-intake-queue-impl.md`
- target 위치: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `status: partial` 시 `pending_plans:` 의무
- 상세: diff 내 spec 본문에 `plan/in-progress/exec-intake-queue-impl.md` 가 PR2-4 잔여 작업 추적 plan 으로 언급되나, frontmatter `pending_plans:` 에 해당 경로가 보이지 않는다(현재 두 개 기존 path 만). 이 plan 이 실존하고 미구현 surface 를 책임진다면 `pending_plans:` 에 추가해야 가드가 의도대로 동작한다. `spec-pending-plan-existence.test.ts` 는 등재된 path 만 검사하므로 미등재는 가드 silent bypass.
- 제안: `plan/in-progress/exec-intake-queue-impl.md` 가 실존하면 frontmatter에 추가. 없다면 기존 두 plan 이 PR2-4 를 커버하는지 확인.

### [INFO] 코드 명명 — 새 파일·식별자 규약 준수 확인
- target 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts`, `execution-run.processor.ts`
- 위반 규약: 없음 (확인 결과 준수)
- 상세: `EXECUTION_RUN_QUEUE` (UPPER_SNAKE_CASE 상수), `ExecutionRunProcessor` / `ExecutionRunJob` (PascalCase 타입), `EXECUTION_RUN_PRIORITY` / `EXECUTION_RUN_QUEUE_DEFAULT_OPTS` / `EXECUTION_RUN_MAX_STALLED_COUNT` (UPPER_SNAKE_CASE), `resolveExecutionRunPriority` / `buildExecutionRunJobId` / `resolveExecutionRunWorkerConcurrency` (camelCase 함수) — 모두 NestJS/TypeScript 표준 명명을 따른다. 환경변수 `EXECUTION_RUN_WORKER_CONCURRENCY` 도 기존 `CONTINUATION_WORKER_CONCURRENCY` 패턴과 일치한다.

### [INFO] Swagger/DTO 규약 — 해당 없음
- target 위치: 변경된 파일 전체
- 위반 규약: `spec/conventions/swagger.md` — 해당 없음
- 상세: PR1 변경은 Queue/Processor/Service 내부 로직이며 새 API endpoint 나 DTO 가 추가되지 않았다. Swagger 규약 점검 대상 아님.

### [INFO] 에러 코드 — 신규 에러 코드 없음
- target 위치: 변경된 파일 전체
- 위반 규약: `spec/conventions/error-codes.md` — 해당 없음
- 상세: PR1 에서 신규 에러 코드가 발행되지 않는다. `runExecutionFromQueue` 의 ack-discard 경로는 `logger.warn` / `logger.debug` 로 처리하고 클라이언트 에러 코드를 발행하지 않는다.

### [INFO] 문서 구조 규약 — 3섹션 권장 준수 확인
- target 위치: `spec/5-system/4-execution-engine.md` 전체 구조
- 위반 규약: CLAUDE.md 문서 구조 (Overview / 본문 / Rationale 3섹션 권장)
- 상세: spec 문서는 이미 §1~§11 본문과 `## Rationale` 절을 갖추고 있다. PR1 의 spec diff 는 §4 Worker 모델 주석·§9.2 키 패턴·§9.3 큐 목록·§10.2 환경변수·§11 Graceful Shutdown·§마지막 정리 절을 갱신했으며 기존 3섹션 구조를 파괴하지 않는다.

---

## 요약

PR1(`impl-exec-intake-queue`)의 구현 변경(`execution-run.queue.ts`, `execution-run.processor.ts`, `execution-engine.service.ts` 등)과 동반 spec 갱신은 정식 규약(`spec/conventions/`)을 전반적으로 준수한다. 파일·식별자 명명, 환경변수 패턴, 에러 코드 정책, Swagger/DTO 관련 사항에는 위반이 없다. 주의가 필요한 항목은 두 가지다: (1) spec §4.2 의 jobId 표기(`<executionId>:run:<seq>`)가 PR1 구현(`jobId = executionId`)과 문자적으로 상충하는데, §9.2 만 수정되고 §4.2 원문은 미수정 상태여서 독자 혼동 가능성이 있다(WARNING). (2) `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` 에 `exec-intake-queue-impl.md`(PR2-4 잔여 추적 plan)가 등재되지 않았을 경우 `spec-impl-evidence` 가드의 coverage 목적이 약화된다(INFO). CRITICAL 위반은 없다.

---

## 위험도

LOW
