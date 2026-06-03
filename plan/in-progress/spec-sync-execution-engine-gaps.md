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

> **2026-06-04 — §4/§7.1/§8 의 spec 표면이 재정의됨**: per-node task queue·별도 heartbeat 전제는 폐기되고 execution-level intake 큐(`execution-run`) + BullMQ stalled-job + active-running 타임아웃으로 spec 본문이 재작성됐다([`spec-draft-exec-intake-queue.md`](./spec-draft-exec-intake-queue.md)). 따라서 아래 3항목의 "spec 이 per-node 를 약속하는데 코드 부재" drift 는 해소(spec 이 더는 per-node 를 약속하지 않음). **구현 자체는 새 설계로 developer 트랙이 담당** — `plan/in-progress/exec-intake-queue-impl.md` 로 forwarding.

- [x] **§4 Worker 모델** — ~~per-node task-queue~~ → execution-level intake 큐로 재정의(forwarding). 구현 PR1.
- [x] **§7.1 Worker Heartbeat** — ~~별도 heartbeat~~ → BullMQ stalled-job(active 세그먼트 한정)으로 재정의(forwarding). 구현 PR4. `WORKER_HEARTBEAT_TIMEOUT` 코드 유지+의미 재정의.
- [x] **§8 동시 실행 제한** — active-running 누적 타임아웃 + `EXECUTION_TIME_LIMIT_EXCEEDED` + intake 큐 카운트 가드로 재정의(forwarding). 구현 PR2. spec 본문 §8 반영 완료.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings `5-system/5-system__4-execution-engine.md` 참조.
- 본 audit 에서 함께 정정한 textual 오류(§5.5 expression 제외 목록, §7.4/§9.3 continuation 메시지 타입, §7.1/§7.4 Recovery 절대시간 vs heartbeat)는 spec 본문에 직접 패치 완료 — 미구현 surface 가 아니므로 본 plan 추적 대상 아님.
