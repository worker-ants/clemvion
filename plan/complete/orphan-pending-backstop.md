---
worktree: orphan-pending-69fef1
started: 2026-07-04
owner: developer
spec_impact:
  - spec/5-system/4-execution-engine.md
---

# orphan pending backstop (exec-intake followup)

`exec-intake-followups.md` "orphan pending backstop" 이행. spec §8: admission 재큐 job 이 소실(Redis 비영속·eviction)되면 그 `pending` row 는 다시 pick up 될 job 이 없어 영구 잔류한다. 큐 대기 5분 timeout 은 **consumer 가 job 을 pick up 할 때만** 검사되므로(admitExecutionOrDefer §8) orphan 은 그 검사를 못 받는다.

## 현황(변경 전)

- `recoverStuckExecutions`(§7.4, `onApplicationBootstrap` + `runStuckRecoveryScan` 테스트훅)은 **stale RUNNING 만** 스캔(started_at < now-30min → case B re-drive). PENDING 미스캔.
- §8 line 1088: "orphan pending 회수는 후속 … 본 PR 스코프 아님(낮은 확률 엣지, best-effort)".

## 설계 결정

1. **회수 액션 = wait-timeout cancel(re-enqueue 아님)**. queue-wait 한도를 **이미 초과한** pending(`queued_at < now - resolveQueueWaitTimeoutMs()`)만 대상. consumer 가 pick up 했다면 admitExecutionOrDefer 가 admission 이전에 timeout 검사로 `cancelled` 마감했을 값 — cancel ≡ re-enqueue→cancel 이라 직접 cancel 이 단순·안전(오래된 실행을 RUNNING 으로 부활시키지 않음). 한도 이내 orphan 은 다음 스캔에서 초과 시 회수(best-effort, boot-only). SoT §8 "재큐 대신 cancelled 로 마감".
2. **기존 `markQueueWaitTimeout(id)` 재사용** — 조건부 UPDATE(`WHERE status='pending'`)라 admit/cancel race 에 멱등, `EXECUTION_CANCELLED`(cancelledBy=timeout)·`EXECUTION_QUEUE_WAIT_TIMEOUT`·routing release 를 그대로 emit(클라이언트 알림 보존).
3. **같은 lock·트리거 재사용** — `recoverStuckExecutions` 안 running 회수 뒤(early-return 제거)에 `recoverOrphanPendingExecutions()` 호출 → boot + 테스트훅 모두 커버. 신규 migration/env 없음.

## 체크리스트

- [x] impl-prep consistency (spec/5-system/) — 5/5 BLOCK: NO (21_50_44)
- [x] TDD: orphan scan 유닛 3(초과→cancel·이내 no-op·early-return 제거 통합) + e2e 2(orphan→cancelled+EXECUTION_QUEUE_WAIT_TIMEOUT·threshold 가드)
- [x] 구현 (recoverOrphanPendingExecutions + recoverStuckExecutions 통합, LessThan import)
- [x] spec §8/§7.1/§7.4 "구현 완료" + Rationale 서브섹션 + data-flow 3(mermaid·recovery 표) 반영
- [x] TEST WORKFLOW (lint·unit(신규 3)·build·e2e(234))
- [x] ai-review (22_12_26 → Warning 4 조치 → fresh 22_28_18 Critical/Warning 0) + impl-done consistency (22_27_48 BLOCK: NO)
- [x] PR
