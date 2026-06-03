---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# execution-engine — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). `spec/5-system/4-execution-engine.md` 을 `partial` 로 유지하며, 본 audit 에서 trust-but-verify 로 재확인된 미구현 aspirational surface 를 추적한다.
> 관련 spec: spec/5-system/4-execution-engine.md
> 기존 plan `plan/in-progress/execution-engine-residual-gaps.md` (G1/G2/G3) 와 별개 — 그쪽은 §11 graceful-shutdown WS gate 등 Phase 2 후속, 본 plan 은 §4/§7.1/§8 의 task-queue·heartbeat·동시실행 제한 aspirational 표면.

## 미구현 항목

- [ ] **§4 Worker 모델** — 별도 Redis BQ task-queue, 1 Worker = 1 NodeExecution, `taskId`/`timeout`/`retryCount` 태스크 메시지, Worker 인스턴스 수 env, 큐 파티셔닝, 우선순위 큐. 현 구현은 `runExecution` 의 in-process while-loop dispatch (별도 task-queue 없음 — §9.3 자체가 명시). 코드부재 재확인: `execution-engine/queues/` 에 `background-execution` / `continuation-execution` 프로세서만 존재.
- [ ] **§7.1 Worker Heartbeat** — 5초 간격 heartbeat / 15초(3회) 미응답 판정 / 미응답 태스크 재큐. 미구현. 현 실제는 서버 재시작 시 `recoverStuckExecutions` 가 `status='running' AND started_at < now()-STUCK_RECOVERY_STALE_MS(30분)` 인 Execution 을 일괄 `failed` 마킹하며, 에러 코드 이름(`WORKER_HEARTBEAT_TIMEOUT`)만 선반영해 재사용. heartbeat 기반 전환은 §4 Worker 모델 의존.
- [ ] **§8 동시 실행 제한** — 워크스페이스 10 / 워크플로우 3 동시 Execution 가드, 단일 Execution 노드 500 / 실행시간 30분 timeout, 큐 대기 5분 cancel. enforcement 코드 부재 재확인. `EXECUTION_TIMEOUT` 은 `code` 노드 스크립트 타임아웃과 chat-channel 실패 분류기 문자열로만 존재(엔진 레벨 실행시간 timeout 아님).

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings `5-system/5-system__4-execution-engine.md` 참조.
- 본 audit 에서 함께 정정한 textual 오류(§5.5 expression 제외 목록, §7.4/§9.3 continuation 메시지 타입, §7.1/§7.4 Recovery 절대시간 vs heartbeat)는 spec 본문에 직접 패치 완료 — 미구현 surface 가 아니므로 본 plan 추적 대상 아님.
