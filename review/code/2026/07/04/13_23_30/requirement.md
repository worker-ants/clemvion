# 요구사항(Requirement) Review — PR4 spec 동기화 (2026-07-04)

## 리뷰 범위

본 changeset 은 코드 변경이 아니라 **spec 문서 5개**(`spec/1-data-model.md`, `spec/5-system/3-error-handling.md`,
`spec/5-system/4-execution-engine.md`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md`)의
갱신이다. 내용은 이미 구현·커밋된 PR4(`dbc541602` "PR4 BullMQ stalled 자동 재배달", `3f6c3dfab` "PR4 ai-review
Warning 조치")를 문서에 반영하는 post-implementation spec sync — "PR4 Planned/예약/target" 서술을 "PR4 구현
완료(2026-07-04)" 로 갱신한다.

빠짐없는 검증을 위해 실제 구현 코드(`codebase/backend/src/modules/execution-engine/**`)를 직접 대조했다:

- `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` — `EXECUTION_RUN_MAX_STALLED_COUNT = 1`, `EXECUTION_RUN_STALLED_INTERVAL_MS = 30_000`, `buildExecutionRunJobId` = `executionId` 그대로(re-enqueue 없음, seq 불요)
- `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts` — `@Processor` 데코레이터 `maxStalledCount`/`stalledInterval` 옵션 배선, `onFailed` → `finalizeStalledExhausted` 호출
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `runExecutionFromQueue` 의 PENDING/RUNNING/terminal 3-way switch(2행 3143~3168), `finalizeStalledExhausted`(2행 2763~2812, `status='running'` 조건부 UPDATE + `WORKER_HEARTBEAT_TIMEOUT` + 자식 NodeExecution cascade), `recoverStuckExecutions`(2행 2641, 부팅 backstop 존치 확인 — 은퇴 안 됨)
- `codebase/backend/src/modules/execution-engine/queues/execution-run-dlq-monitor.config.ts` — env 기본값 `EXECUTION_RUN_DLQ_ALARM_THRESHOLD=20` / `_INTERVAL_MS=60000` / `_COOLDOWN_MS=300000` / `_ENABLED=true` (spec §9.3 표와 일치)
- `codebase/backend/src/modules/execution-engine/execution-engine.module.ts` — `ExecutionRunDlqMonitorService` DI 등록 확인
- `codebase/backend/src/modules/executions/executions.controller.ts` — test-hook `simulateExecutionRunRedeliveryForTest` 의 `verifyOwnership(id, workspaceId)` 호출 확인 (IDOR 가드, 3f6c3dfab 조치와 일치)

## 발견사항

없음 (no findings).

spec 문서 5개의 모든 line-level 주장을 구현 코드와 대조했으며 불일치 없음:

- `maxStalledCount: 0 → 1`, `stalledInterval: 30초` — 코드와 spec 정확히 일치.
- "네이티브 stalled = 같은 jobId 재처리, re-enqueue/seq 불요" (§9.2 `exec:run:seq` 미사용 정정) — `buildExecutionRunJobId` 구현과 정합.
- `runExecutionFromQueue` RUNNING 분기 → `recordRunningSegmentStart` + `redriveStuckExecution`(§7.5 case B) — 코드 그대로.
- `onFailed → finalizeStalledExhausted` 가 `status='running'` 조건부로만 발동(setup-throw 경로는 이미 terminal 이라 no-op) — 코드 조건문과 정합.
- `recoverStuckExecutions` 은퇴하지 않고 부팅 backstop 으로 병존 — 코드에 여전히 존재·호출됨(`onApplicationBootstrap` 경로) 확인.
- `WORKER_HEARTBEAT_TIMEOUT` 은 엔진 레벨 인프라 코드로 유지, 부팅 backstop re-drive 는 미사용(재구동 불가는 `RESUME_CHECKPOINT_MISSING`) — spec·코드 표현 일치.
- `ExecutionRunDlqMonitorService` env 변수명·기본값(threshold=20, interval=60000ms, cooldown=300000ms, enabled=true) — config 파일과 정확히 일치.
- 잔여 zombie race(§7.5 case B 각주 / finalizeStalledExhausted JSDoc)의 서술 — 코드 주석(JSDoc)과 spec 문서 서술이 동일 내용으로 양쪽에 중복 문서화돼 있으며 모순 없음.
- 이전 라운드(13_08_20 ai-review)에서 지적된 IDOR(test-hook `verifyOwnership` 누락) 은 이미 `3f6c3dfab` 커밋으로 코드에 반영됐고, 그 반영 사실이 spec 변경에는 직접 등장하지 않으나 이는 코드-레벨 보안 조치라 본 spec 문서들의 서술 범위(§7.1/§7.5 재구동 메커니즘) 밖이므로 spec 누락이 아님.
- 문서 내 "PR4 target/예약/Planned" 잔존 표현 grep 결과 0건 — 5개 파일 전체가 "PR4 구현 완료(2026-07-04)" 로 일관되게 갱신됨. 자기 모순(self-inconsistency) 없음.

TODO/FIXME/HACK/XXX 주석 검색 결과 해당 diff 범위 내 없음. spec 자체의 결함도 발견되지 않음.

## 요약

이번 changeset 은 코드가 아니라 이미 구현·커밋된 PR4(BullMQ stalled 자동 재배달)를 spec 문서 5개에 소급 반영하는 순수 문서 동기화다. 실제 구현 파일(`execution-run.queue.ts`/`execution-run.processor.ts`/`execution-engine.service.ts`/DLQ monitor config/module 배선/controller IDOR 가드)을 라인 단위로 대조한 결과, `maxStalledCount`/`stalledInterval` 값, 3-way switch 분기, `finalizeStalledExhausted` 의 조건부 UPDATE·에러 코드·cascade, `recoverStuckExecutions` backstop 병존, DLQ 모니터 env 기본값 등 spec 이 서술하는 모든 구체적 사실이 코드와 정확히 일치한다. 이전 ai-review 라운드(13_08_20)에서 지적된 Warning 5건도 이미 별도 커밋(`3f6c3dfab`)으로 조치·RESOLUTION 처리됐다. spec 갱신 자체에 신규 요구사항 누락, 잘못된 기본값/에러코드, 논리적 모순은 발견되지 않았다.

## 위험도

NONE

STATUS: SUCCESS
