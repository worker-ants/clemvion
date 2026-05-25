---
worktree: workflow-resumable-execution-phase2-cont-64f537
started: 2026-05-24
owner: developer
---

> **Worktree 이력**: Phase 0/1 = `workflow-resumable-execution-6b105e` (merged base 로 잔류). Phase 2 = `workflow-resumable-execution-phase2-a6b133`. Phase 2 cont = `workflow-resumable-execution-phase2-cont-64f537` (현재 active).

# Plan — Durable Continuation & Graceful Shutdown

> 운영 회귀 대응 — k8s 재배포 시 WAITING_FOR_INPUT 상태의 워크플로우가 "Execution failed: server restarted while waiting for user input" 으로 일괄 FAILED 처리되던 문제 해결.
>
> Spec SoT: [`spec/5-system/4-execution-engine.md §7.4 / §7.5 / §11 / §Rationale "Durable Continuation (2026-05-24)"`](../../spec/5-system/4-execution-engine.md).
> 추적 review: `review/consistency/2026/05/24/23_26_13/` (rev 1, BLOCK: YES → 보정) + `review/consistency/2026/05/24/23_39_12/` (rev 2, BLOCK: NO).

## 배경

운영 보고 (2026-05-24) — k8s rolling deploy 시점에 WAITING_FOR_INPUT 인 모든 Execution 이 일괄 "Execution failed: server restarted while waiting for user input" 으로 종결. 사용자가 다시 폼을 제출하거나 워크플로를 처음부터 재실행해야 함.

코드 위치:
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:417-424` — `pendingContinuations: Map<executionId, {resolve, reject}>` (인스턴스 로컬, 컨테이너 죽으면 소실)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:644-692` — `recoverStuckExecutions()` 가 부팅 시 30분 이상 WAITING_FOR_INPUT 인 Execution 을 일괄 FAILED 처리
- `codebase/backend/src/main.ts` — SIGTERM graceful shutdown 핸들러 없음

## 작업 단계 (Phase 분리)

### Phase 0 — Spec 갱신 (본 worktree 안에서 완료)

- [x] `spec/5-system/4-execution-engine.md` — §1.1 상태 머신 / §1.2 NodeExecution / §4.4 단일 sink Rationale / §6.2 저장 전략 / §7.2 체크포인트 / §7.4 Continuation Bus + Recovery / §7.5 신규 (Resume after Restart rehydration) / §9.2 + §9.3 신규 (BullMQ 큐 목록) / §11 신규 (Graceful Shutdown) / §Rationale 새 결정 기록
- [x] `spec/5-system/6-websocket-protocol.md` §4.2 — ack `queued: boolean` 필드 + `RESUME_*` 3개 에러 코드 + `execution.retry_last_turn` 적용 제외 명시
- [x] `spec/1-data-model.md §2.13` — `Execution.error.code` 어휘에 신규 5종 코드 노트 추가
- [x] `spec/data-flow/3-execution.md` — line 20 파일 참조, line 52 시퀀스 다이어그램 주석, line 165 mermaid 라벨, line 232-237 Rationale 역전 갱신 (옛 "Continuation bus = Redis pub/sub" → "Continuation queue = BullMQ 영속 큐")
- [x] `spec/0-overview.md` — §6.1 line 83 시스템 영역, §2.4 Rationale trade-off, §2.6 Data Layer Redis 항목
- [x] `spec/4-nodes/6-presentation/0-common.md §10.9` — internal continuation bus payload SoT 의 채널명 표기

### Phase 1 — 운영 hotfix (즉시 출혈 멈춤)

목표: 재배포 자체로 인한 일괄 실패 중단. Phase 2 가 완료되기 전이라 사용자 입력 도착 시점에 메모리 resolver 가 없으면 그 1회는 실패로 처리하나, 명확한 에러 메시지로 안내. 워크플로 자체가 cancel 되지는 않음.

- [x] 1.1 — `recoverStuckExecutions()` 의 stale 대상에서 `status='waiting_for_input'` 제외. `status='running'` 만 검출.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:644-692`
  - 옛 30분 일괄 FAIL 로직 (line 663-678) 의 SQL WHERE 절을 `status='running' AND started_at < now() - INTERVAL '30 minutes'` 로 변경.
  - 옛 error message "Execution failed: server restarted while waiting for user input" 는 더 이상 발생하지 않음. RUNNING heartbeat 미응답에 대한 fail 메시지로 교체 ("Execution failed: worker heartbeat timeout").
  - 구현 commit: `e34d2db2`. 테스트: e2e 는 Phase 2 통합 e2e (2.7) 에서 커버.
- [x] 1.2 — SIGTERM graceful shutdown 핸들러 추가.
  - 위치: `codebase/backend/src/main.ts`, NestJS `app.enableShutdownHooks()` + `OnApplicationShutdown` 훅 (ShutdownStateService).
  - `SIGTERM_GRACE_MS` (기본 30000) 환경변수 도입. spec §11 의 5단계 동작 구현.
  - `POST /api/workflows/:id/execute` 가 종료 중일 때 503 + `code: 'SERVER_SHUTTING_DOWN'` + `Retry-After` 헤더 반환.
  - active NodeExecution 은 drain wait 후 미완료 시 `failed` + `error.code='SERVER_INTERRUPTED'` 마킹.
  - 구현 commit: `e34d2db2`. 후속 fix: `8a4ad936` (W-1/W-2/W-3 등 ai-review 발견사항).
  - **Phase 1 scope**: HTTP gate 만 구현 (WS `execution.start` gate 는 WS 명령이 미구현 상태 — Phase 2 예정). spec §11 clarification → spec-fix draft 예정.
- [x] 1.3 — **SKIP** (2026-05-25 사용자 결정). Phase 2 가 같은 sprint 안에 진행되어 임시 코드를 도입할 필요 없음. Phase 2 의 BullMQ 영속 큐 + rehydration 으로 "키 없음" 케이스가 자연 해소된다.

### Phase 2 — Durable continuation 본 구현

목표: 어느 인스턴스가 사용자 입력을 받아도 다른 인스턴스가 재개 가능. spec §7.4 / §7.5 / §11 의 본문 구현.

- [x] 2.1 — BullMQ `execution-continuation` 큐 신설. (Phase 2 WIP `edc7f68b`)
- [x] 2.2 — Continuation publisher 를 BullMQ enqueue 로 교체. (Phase 2 WIP `edc7f68b`)
- [x] 2.3 — Continuation worker / consumer 신설 (fast-path). (Phase 2 WIP `edc7f68b`)
- [x] 2.3a — 진짜 rehydration 본 구현 (slow path). (Phase 2 cont commit `b6f9e8fe` + `c5d9d698`)
- [x] 2.4 — `nodeId → nodeExecutionId` lookup 절차. (Phase 2 WIP `edc7f68b`)
- [x] 2.5 — Rehydration 실패 처리 + WS ack `queued` 필드. (Phase 2 cont commit `a05dfe07` + `c5d9d698`)
- [x] 2.6 — 옛 Redis pub/sub `execution:continuation` 채널 제거. (Phase 2 WIP `edc7f68b`)
- [x] 2.7 — 통합 e2e (단일 instance simulation 으로 한정 — 다중 instance e2e 는 future PR). (Phase 2 cont commit `b08415e2`)
- [x] 2.8 — `task-queue` 큐 이름 정합화 — spec-update plan 으로 제안 작성. project-planner 픽업 대기. (Phase 2 cont commit `b3a22048`)
- [x] 2.9 — `INVALID_EXECUTION_STATE` 에러 코드 spec 등재 — spec-update plan 으로 제안 작성. project-planner 픽업 대기. (Phase 2 cont commit `b3a22048`)

### Phase 3 — 후속 정리 (선택)

- [ ] 3.1 — BullMQ retry 율 모니터링 / DLQ 알람 임계 설정.
- [ ] 3.2 — `spec/data-flow/3-execution.md` 시퀀스 다이어그램의 mermaid 자체를 BullMQ 흐름으로 재작성 (현재는 주석만 갱신).

### Phase 2 진행 상태 (WIP — 2026-05-25 commit 시점)

본 worktree (`workflow-resumable-execution-phase2-a6b133`) 의 commit `<WIP-HASH>` 까지:

**구현 완료 (코드 수준)**:
- [x] 2.1 — `continuation-execution.queue.ts` 신규: `CONTINUATION_EXECUTION_QUEUE` 상수 + `buildContinuationJobId` + `CONTINUATION_QUEUE_DEFAULT_OPTS` + `ContinuationJob` 타입
- [x] 2.2 — `continuation-bus.service.ts` 전면 재작성: Redis pub/sub 제거 + `@InjectQueue(CONTINUATION_EXECUTION_QUEUE)` 로 BullMQ enqueue. `nextSeq` (Redis INCR per executionId) 로 jobId 단조 증가. lockClient 만 별도 ioredis 유지 (recoverStuckExecutions lock 용).
- [x] 2.3 (partial) — `continuation-execution.processor.ts` 신규: `@Processor(CONTINUATION_EXECUTION_QUEUE)` Worker. 5 type dispatch → `engine.applyContinuation(...)` / `engine.applyCancellation(...)`. `engine.isNodeExecutionWaiting()` 멱등성 가드.
- [x] 2.4 — `ExecutionEngineService.resolveWaitingNodeExecutionId()` 신규: publisher 측 DB lookup. continue* 메서드들이 async 로 전환되어 lookup 후 publish.
- [x] 2.6 — 옛 Redis pub/sub 채널 (`CONTINUATION_CHANNEL = 'execution:continuation'`) 제거. ContinuationBusService 의 `on(type, handler)` API 는 no-op stub 으로 호환만 유지. `registerContinuationHandlers()` 도 no-op stub.

**Phase 2 cont 진행 (worktree `workflow-resumable-execution-phase2-cont-64f537`)**:

- [x] **테스트 회귀 14건 fix** — commit `1280ed76` `fix(execution-engine-spec): async signature 적용 + bus.on 의존 테스트 제거`. 5개 entry 비동기 + nodeExecutionId 페이로드 + bus.on listener 검증 → applyContinuation/applyCancellation 직접 dispatch 검증으로 재작성.
- [x] **2.3a (CRITICAL — 진짜 rehydration 구현)** — commit `b6f9e8fe` `feat(execution-engine): Phase 2.3a — checkpoint-based rehydration`. 새 메서드 `rehydrateContext` (execution_node_log + NodeExecution.outputData 로 context 재구성), `resumeFromCheckpoint` (waitForX 직접 invoke + setImmediate resolver fire + 남은 그래프 traversal), `RehydrationError` 분류 클래스. multi-turn AI 노드는 `_resumeState` 미영속(WARN #6) 으로 `RESUME_INCOMPATIBLE_STATE` 거부. 5건 unit 테스트 추가.
- [x] **2.5 — WS ack `queued: boolean` + 동봉 필드** — commit `a05dfe07` `feat(websocket): Phase 2.5 — queued + resumed ack 필드`. `ContinuationPublishResult` 타입 신설, 4개 continueX 메서드가 `{queued, jobId}` 반환, WS gateway 4개 handler 가 ack 에 `{resumed, queued, executionId}` 동봉 + Redis 장애 분기 처리. RESUME_* failure codes 는 spec Rationale "WS 신규 이벤트 미도입" 에 따라 후행 `EXECUTION_CANCELLED` 이벤트로 surface (별도 WS 이벤트 미도입). 2건 unit 테스트 추가.
- [x] **2.7 — 통합 e2e (rehydration 시나리오)** — commit `b08415e2` `test(execution-engine): Phase 2.7 — rehydration integration 시나리오`. Form node 의 WAITING_FOR_INPUT 진입 → `pendingContinuations.clear()` + `contextService.deleteContext` (instance restart 시뮬레이션) → DB lookup mock 갱신 → `service.applyContinuation` 직접 호출 → rehydrateAndResume → workflow COMPLETED 검증. 다중 인스턴스 정밀 e2e 는 backend-e2e 인프라가 multi-instance 미지원으로 future PR.
- [x] **2.8 / 2.9 — spec 정합화** — commit `b3a22048` `docs(spec): Phase 2.8 / 2.9 — task-queue 정합화 + INVALID_EXECUTION_STATE 등재 제안`. `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` 에 변경 제안 (§9.3 task-queue 행 삭제, §7.5.1 INVALID_EXECUTION_STATE sub-section 신설, §4.2 주석 추가) 작성 — project-planner 가 별 PR 또는 본 PR 동반으로 픽업.

**TEST WORKFLOW**: lint PASS / unit 4777 PASS / build PASS / e2e 119 PASS — commit `3b2f3ba1` 에서 pre-existing 회귀 해소 포함.

**REVIEW WORKFLOW (`/ai-review`)**: 10 reviewer 병렬 (4건 router skip). C5 (진짜 Critical — Processor unit 테스트 누락) + W1/W4/W19/W20/W22/W23 (6건 즉시 fix) 처리. commit `c5d9d698` + `22e14698`. C1-C4/C6 reviewer 보고된 spec Critical 은 모두 false positive — spec 은 Phase 0 commit 에서 BullMQ §7.4/§7.5 / WS §4.2 보강 완료 상태. RESOLUTION: `review/code/2026/05/25/08_02_14/RESOLUTION.md`.

**impl-prep 검토**:
- `review/consistency/2026/05/25/01_17_41/SUMMARY.md` — 1차 (Phase 2 진입 시) — BLOCK: NO.
- `review/consistency/2026/05/25/07_12_25/SUMMARY.md` — 2차 (Phase 2 cont 진입 시) — BLOCK: NO. W6/W7/W14/W15 는 본 cont 작업에서 해소 또는 spec-update plan 으로 이관.

**Phase 2 cont DONE — 2026-05-25**. Phase 3 (3.1 / 3.2) 는 별 plan 으로 이관 가능.

## 다음 단계

1. 사용자 confirm 후 Phase 1 부터 `developer` skill 위임. 구현 착수 직전 `/consistency-check --impl-prep spec/5-system/` 의무.
2. Phase 2 는 Phase 1 통과 후 별 PR 로 분리 권장 (변경 표면적이 큼).
3. 동반 plan 업데이트:
   - `plan/in-progress/0-unimplemented-overview.md` 의 적절한 영역에 본 작업 1행 등재
   - `plan/in-progress/self-hosting-deployment.md §4 Kubernetes Helm Chart` 에 `terminationGracePeriodSeconds = ceil(SIGTERM_GRACE_MS / 1000) + 5` 공식 + `spec/5-system/4-execution-engine.md §11` cross-link 추가
   - `plan/in-progress/retry-handler-followup.md` 에 "WARNING #2 (`execution:continuation` 채널 표기) 는 본 작업으로 채널이 BullMQ 큐로 교체됨. §4.2 작성 시 BullMQ `execution-continuation` 기준으로 작성" 한 줄 추가

## 영향받지 않는 영역

- `plan/in-progress/retry-handler-followup.md` (`_retryState`) — 직교 (`_retryState` 는 동일 nodeId 의 새 NodeExecution row spawn, 본 작업은 같은 NodeExecution 이어가기). 단 spec 영역 중첩으로 spec 반영 순서: 본 작업 (workflow-resumable-execution) 먼저 → retry-handler-followup §4.2 추가는 본 spec 의 BullMQ 기준으로 작성.
- `plan/in-progress/multiturn-error-preserve.md` — 프론트엔드 store snapshot 보존. 무관.
- `spec/5-system/13-replay-rerun.md` — Re-run 은 새 Execution row 생성. 본 작업은 같은 Execution 이어가기.
- DB migration — 본 작업 자체로는 migration 없음 (free-form `Execution.error` JSONB + 신규 BullMQ 큐는 라이브러리 표준 키 사용).

## 검토 산출물

- `review/consistency/2026/05/24/23_26_13/SUMMARY.md` — rev 1 draft 검토 (BLOCK: YES → CRITICAL 3건 보정)
- `review/consistency/2026/05/24/23_39_12/SUMMARY.md` — rev 2 draft 검토 (BLOCK: NO → spec 적용 진행)
