---
worktree: workflow-resumable-execution-6b105e
started: 2026-05-24
owner: project-planner
---

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
- [ ] 1.3 — `continueExecution` / `continueButtonClick` / `continueAiConversation` / `endAiConversation` 의 "키 없음" 분기에서, Phase 2 가 적용되기 전까지는 명확한 에러 응답.
  - 현재: silent skip (다른 인스턴스가 처리한다고 가정).
  - 임시 보강 (Phase 2 적용 전): 로컬 키 없음 + Execution.status === 'waiting_for_input' 이면 사용자에게 "재배포로 세션이 일시 중단되었습니다. 새 폼을 다시 제출해주세요" 메시지 + Execution을 `cancelled` + `error.code='SESSION_INTERRUPTED'` 마킹 (임시 — Phase 2 적용 시 제거).
  - **본 단계는 Phase 2 가 같은 sprint 안에 진행될 경우 skip 가능**. 사용자 영향 분석 후 결정.

### Phase 2 — Durable continuation 본 구현

목표: 어느 인스턴스가 사용자 입력을 받아도 다른 인스턴스가 재개 가능. spec §7.4 / §7.5 / §11 의 본문 구현.

- [ ] 2.1 — BullMQ `execution-continuation` 큐 신설.
  - 위치: `codebase/backend/src/modules/execution-engine/queues/continuation-execution.queue.ts` (신규).
  - `background-execution.queue.ts` 의 패턴 그대로 따름.
  - `attempts: RESUME_BULLMQ_ATTEMPTS` (기본 3), `removeOnComplete: true`, exponential backoff.
- [ ] 2.2 — Continuation publisher 를 BullMQ enqueue 로 교체.
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts`.
  - 기존 `Redis pub.publish(CONTINUATION_CHANNEL, msg)` → `continuationQueue.add('continue', msg, { jobId, attempts })`.
  - jobId 스키마: `${executionId}:${nodeExecutionId}:${monotonic-seq}` (Redis INCR per executionId).
  - **항상 enqueue 원칙 유지** — 자기 인스턴스에 키가 있어도 BullMQ 경유. sticky fast-path 도입하지 않음.
- [ ] 2.3 — Continuation worker / consumer 신설.
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` (신규).
  - 로컬 `pendingContinuations` 키 hit → 즉시 resolve (fast path).
  - 키 miss → §7.5 rehydration: Execution.status 검증 → NodeExecution.outputData 에서 체크포인트 로드 → ExecutionContext 재구성 → `waitForX()` 새로 invoke → resolver 호출.
- [ ] 2.4 — `nodeId → nodeExecutionId` lookup 절차.
  - WS gateway / REST controller 가 publish 직전에 DB lookup (`execution_id + node_id + status='waiting_for_input'`) 수행.
  - 0건 / 다중 row 시 client 에 `INVALID_EXECUTION_STATE` 응답.
- [ ] 2.5 — Rehydration 실패 처리 + WS ack 에 `queued` 필드 / `RESUME_*` 에러 코드 전달.
  - 위치: WS gateway controllers (`execution-actions.controller.ts` 또는 그 동등 파일).
  - `RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE` 각 케이스에서 Execution `cancelled` + 동반 NodeExecution `failed` 마킹.
- [ ] 2.6 — 옛 Redis pub/sub `execution:continuation` 채널 publisher / subscriber 코드 제거.
  - 단일 배포 (dual-write 금지) 로 진행.
- [ ] 2.7 — 통합 e2e: testcontainers 환경에서 backend 2 인스턴스 띄우고, 인스턴스 A 에서 시작 → A 죽임 → B 가 사용자 입력 받고 rehydration 으로 재개 → workflow 정상 완료.

### Phase 3 — 후속 정리 (선택)

- [ ] 3.1 — BullMQ retry 율 모니터링 / DLQ 알람 임계 설정.
- [ ] 3.2 — `spec/data-flow/3-execution.md` 시퀀스 다이어그램의 mermaid 자체를 BullMQ 흐름으로 재작성 (현재는 주석만 갱신).

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
