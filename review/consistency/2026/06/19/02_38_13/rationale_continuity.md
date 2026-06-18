# Rationale 연속성 검토 결과

검토 모드: --impl-prep  
스코프: `spec/5-system/4-execution-engine.md`  
검토 일시: 2026-06-19

---

## 발견사항

### 발견사항 없음

구체적인 충돌·번복 항목이 식별되지 않았다. 아래에 검토 근거를 정리한다.

---

## 검토 근거

### 1. 기각된 대안의 재도입 — 해당 없음

`spec/0-overview.md § Rationale "실행 엔진: Redis 큐 + 분산 워커 풀"` 이 명시적으로 기각한 대안들:

- in-process 단일 프로세스 (SaaS 수평 확장 불가·장기 대기 점유)
- Postgres `LISTEN/NOTIFY` 자체 큐 (retry/DLQ/rate limit/cross-pod 직렬화 재구현 필요)

target 의 §4 · §9.3 은 동일 결정을 이어받아 BullMQ 기반 세 큐(`execution-run` / `execution-continuation` / `background-execution`)와 execution-level active 세그먼트 단위 처리를 명문화하고 있다. 재도입 없음.

`spec/5-system/4-execution-engine.md § Rationale "per-node task queue → execution-level intake 큐"` 가 명시적으로 기각한 per-node task queue(1 Worker = 1 NodeExecution, 노드마다 context 전체 직렬화)는 본문 §4.2, §9.3, §Rationale "park 즉시 해제" 등 여러 곳에서 일관되게 "채택하지 않음" 으로 기록되어 있으며, 재도입 흔적이 없다.

`spec/1-data-model.md § Rationale "Execution.execution_path → ExecutionNodeLog (V035 → V036)"` 의 결정(append-only `execution_node_log` 채택, 배열 컬럼 폐기)과 target 의 §7.4 · §1.2 내용이 충돌하지 않는다.

### 2. 합의된 원칙 위반 — 해당 없음

주요 합의 원칙 대조:

| 합의 원칙 (출처 Rationale) | target 반영 여부 |
|---|---|
| 항상 BullMQ enqueue (publisher-side / worker-side fast-path 제거) — `spec/0-overview.md` + `spec/5-system/4-execution-engine.md § Rationale "park 즉시 해제"` | §7.4 "라우팅 원칙: 모든 진입점은 항상 BullMQ enqueue", full B3 완료 명시 — 일치 |
| active-running 누적 기준 타임아웃 (wall-clock 아님) — `spec/5-system/4-execution-engine.md § Rationale "타임아웃을 active-running 누적 기준으로"` | §8 표 · 주석 모두 동일 기준 — 일치 |
| DB 스키마 비확장 (`_resumeCheckpoint` 를 별도 컬럼 신설 기각, `NodeExecution.outputData` JSONB 키로 보존) — `spec/5-system/4-execution-engine.md § Rationale "Multi-turn 재시작 재개"` | §1.3, §7.5 본문 모두 동일 — 일치 |
| `INVALID_EXECUTION_STATE`(WS) / `INVALID_STATE`(REST 422) 이름 분리 유지 — `§Rationale "Phase 2 cont" #2` | §7.5.1 본문 + §Rationale "Phase 2 cont #2" 가 동일 설명을 유지 — 일치 |
| typed `ExecutionError` 경계만 전환, 내부 plain Error 는 generic fallback — `§Rationale "Continuation ack client-safe typed error"` | §7.5.2 에 동일 정책 명문화 — 일치 |
| `execution.resumed_after_restart` WS 신규 이벤트 미도입 — `§Rationale "Durable Continuation & Graceful Shutdown"` | §7.4 · §7.5 본문에 해당 이벤트 없음 — 일치 |
| `waiting_for_input → failed` 직접 전이 (2단계 WFI→running→failed 기각) — `§Rationale "waiting_for_input → failed 전이 추가"` | §1.1 전이 표 · §1.2 에 명시 — 일치 |
| Execution `cancelled` / NodeExecution `failed` 이분 (rehydration 실패 단말) — `§Rationale "Phase 2 cont #4"` | §7.5 실패 케이스 표 — 일치 |

### 3. 결정의 무근거 번복 — 해당 없음

"WARN #6 미영속" 번복(credential-strip 부분집합 `_resumeCheckpoint` 평문 영속 도입)은 `§ Rationale "Multi-turn 재시작 재개"` 에서 이유(운영 결함, 선례 `_retryState` 와의 동형), 기각 대안(암호화, 별도 컬럼 신설), trade-off 를 명시적으로 기술하고 있다. 번복에 동반 Rationale 이 있다.

`§ Rationale "RESUME_* 동기 ack 노출 폐기"` 도 옛 spec 기술과의 모순 인식, 올바른 경로(비동기 이벤트), 코드와의 정합 근거를 모두 기록하고 있다.

C-1 god-class 분할 (`§ Rationale "C-1 god-class strangler-fig 분할"`) 은 spec 변경이 아닌 구현 재량 영역으로 명시하고 있으며, 이전 선례(`resume-turn-dispatch.ts` registry)를 인용해 "spec 변경 불요" 근거를 제시한다.

### 4. 암묵적 가정 충돌 — 해당 없음

`spec/0-overview.md § Rationale "실행 엔진"` 의 시스템 invariant:

- "작업 단위는 execution-level active 세그먼트" — target §4.2, §9.3 이 정확히 동일 invariant 를 유지한다.
- "세 큐로 분리" (`execution-run` / `execution-continuation` / `background-execution`) — target §9.3 큐 목록 일치.

`spec/1-data-model.md § Rationale` 의 `execution_node_log` SoT 가정을 우회하는 설계가 target 에 없다.

`spec/5-system/4-execution-engine.md § Rationale "park 즉시 해제"` 의 invariant "모든 재개 = rehydration 단일 경로" (in-process resolver 부재, fast-path 제거)와 §7.4 Worker 동작 셀, §7.5 rehydration 본문이 일치한다.

---

## 요약

`spec/5-system/4-execution-engine.md` (target) 는 `spec/0-overview.md`, `spec/1-data-model.md`, 그리고 target 자신의 `## Rationale` 에 기록된 모든 주요 결정과 일관된다. 기각된 대안(per-node task queue, in-process 단일 프로세스, Postgres LISTEN/NOTIFY 큐, per-node 직렬화 분산, `waiting_for_retry` enum 신설, 별도 `_continuationCheckpoint` 컬럼, `execution.resumed_after_restart` WS 이벤트, heartbeat 채널, undo 스크립트 등)이 본문에 재등장하지 않으며, 합의된 설계 원칙(항상 BullMQ enqueue, execution-level 세그먼트 단위, active-running 누적 타임아웃, credential-strip 평문 영속, `_resumeCheckpoint` JSONB 키 보존, typed `ExecutionError` 경계 변환)이 유지되고 있다. 번복이 있는 항목(WARN #6 영속 결정, RESUME_* 동기 ack 기술 정정)은 모두 새 Rationale 를 동반해 기록됐다. Rationale 연속성 관점에서 구현 착수를 차단하는 이슈가 없다.

---

## 위험도

NONE

STATUS: OK
