# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep)
Target: `spec/4-nodes/2-flow/1-workflow.md`
검토일: 2026-06-19

---

## 발견사항

해당 없음 — 기각된 대안 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 모두 미발견.

아래는 주요 Rationale 접점에 대한 확인 기록이다.

### [INFO] per-node task queue 기각 원칙과의 정합 확인

- target 위치: `spec/4-nodes/2-flow/1-workflow.md §4` (실행 로직 — `executeInline`/`executeAsync` in-process 호출)
- 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale "per-node task queue → execution-level intake 큐"`
- 상세: target 이 sync 모드에서 `executionEngine.executeInline(...)`, async 모드에서 `executionEngine.executeAsync(...)` 를 in-process 로 직접 호출하는 설계는, 실행 엔진 Rationale 에서 "한 세그먼트 내부의 노드 dispatch 는 여전히 in-process — per-node task queue 는 도입하지 않는다" 로 확정한 원칙과 완전히 일치한다. sub-workflow 호출을 별도 per-node BullMQ job 으로 분산하는 기각된 대안을 재도입하지 않았다.
- 제안: 이상 없음.

### [INFO] exec-park D6 (중첩 blocking durable park) 원칙과의 정합 확인

- target 위치: `spec/4-nodes/2-flow/1-workflow.md §4-4 예외` 및 `§5.3`
- 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale "exec-park D6"`
- 상세: target 이 `ParkReleaseSignal` 을 error 포트로 라우팅하지 않고 re-throw 한다고 명시한 것은, exec-park D6 의 핵심인 "중첩 sub-workflow 안 blocking 노드의 park 신호는 인프라 재개 신호이지 런타임 실패가 아니다" 원칙을 정확히 따른다. park 신호를 error 포트로 처리하는 기각된 대안을 재도입하지 않았다.
- 제안: 이상 없음.

### [INFO] `_continuationCheckpoint` 컬럼 신설 기각 원칙과의 정합 확인

- target 위치: `spec/4-nodes/2-flow/1-workflow.md §4` (invokerNodeId / resume_call_stack 언급)
- 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale "exec-park D6"` (`_continuationCheckpoint` 컬럼 신설 기각과 다른 범주)
- 상세: target 은 `invokerNodeId` 를 `resume_call_stack` frame 키로 영속한다고 기술하며, 이는 기각된 `_continuationCheckpoint` 신설 방식이 아니라 채택된 `Execution.resume_call_stack jsonb`(V087) 경로를 사용하는 것이다. 기각된 컬럼 신설 대안을 재도입하지 않았다.
- 제안: 이상 없음.

### [INFO] slow-path 일원화 원칙과의 정합 확인

- target 위치: `spec/4-nodes/2-flow/1-workflow.md §4` (재개 경로 설명)
- 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale "park 즉시 해제 + slow-path 일원화 (Phase B)"` (fast-path sticky resolve 기각)
- 상세: target 은 park/재개에 대해 실행 엔진 §7.5 rehydration 을 단일 재개 경로로 참조하며, 폐기된 in-memory fast-path(`pendingContinuations` / sticky resolve)를 직접·간접으로 재도입하는 기술이 없다.
- 제안: 이상 없음.

### [INFO] 실행 엔진 `execution-level` 큐 3종 구성과의 정합 확인

- target 위치: `spec/4-nodes/2-flow/1-workflow.md §4` (async 모드 `executeAsync` 호출)
- 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale "per-node task queue → execution-level intake 큐"` / `spec/0-overview.md ## Rationale "실행 엔진: Redis 큐 + 분산 워커 풀"`
- 상세: async 모드가 `executeAsync` 로 `background-execution` 큐에 등록하는 것은 채택된 3큐 모델(`execution-run` / `execution-continuation` / `background-execution`)과 정합한다. 별도 per-sub-workflow 큐를 도입하거나 직접 프로세스 분기하는 기각된 방식이 없다.
- 제안: 이상 없음.

---

## 요약

`spec/4-nodes/2-flow/1-workflow.md` 는 관련 Rationale 에 기록된 모든 핵심 결정 — per-node task queue 기각·execution-level in-process dispatch 채택, park 즉시 해제 + slow-path(rehydration) 일원화, exec-park D6 의 `resume_call_stack` 영속 방식, `_continuationCheckpoint` 컬럼 신설 기각, 3큐 구조(`execution-run`/`execution-continuation`/`background-execution`) — 에 완전히 부합한다. 명시적으로 기각된 대안의 재도입이나 합의된 invariant 를 우회하는 설계가 발견되지 않았다. 분석 과정에서 확인된 접점은 모두 INFO 수준 정합 확인이며 차단 사유 없음.

---

## 위험도

NONE
