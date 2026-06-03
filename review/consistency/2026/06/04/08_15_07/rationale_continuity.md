# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-exec-intake-queue.md`
참조 spec Rationale: `spec/5-system/4-execution-engine.md ## Rationale`, `spec/0-overview.md ## Rationale`

---

## 발견사항

### 1. [INFO] §7.1 heartbeat 기각 방향이 기존 Rationale 의 "목표 방향" 과 다름 — Rationale 갱신 필요

- **target 위치**: `plan/in-progress/spec-draft-exec-intake-queue.md §3 (§7.1 재정의)` 및 `## Rationale "§7.1 별도 heartbeat 구현 포기 → BullMQ stalled-job 으로 일원화"`
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md ## Rationale "Phase 2 cont 후속 정리" 항 3번 ("heartbeat 기반 Recovery 전환 — 목표 방향")` 및 `§7.4 Recovery "heartbeat 기반으로의 전환은 Planned"` 문구
- **상세**: 기존 spec Rationale 은 "별도 heartbeat 채널(5초 emit / 15초 미응답 / 재큐)"을 § 4 Worker/task-queue 모델 구현과 함께 도입할 "목표 방향(Planned)"으로 명시하고 있다. target draft 는 이 목표를 폐기하고 BullMQ stalled-job 으로 일원화하는 결정을 내리면서, 해당 결정에 대한 Rationale 을 **draft 자체에 상세히** 작성했다. 충돌이라기보다 기존 Rationale 의 "목표" 문구를 번복하는 결정인데, draft 의 Rationale 이 내용은 충분하나 번복 대상이 되는 spec Rationale 항(Phase 2 cont 항 3번)을 명시적으로 인용·교체한다는 언급이 없다.
- **제안**: spec 본문 반영 시 `spec/5-system/4-execution-engine.md ## Rationale "Phase 2 cont 후속 정리 항 3번"` 의 "목표 방향(Planned)" 서술을 "BullMQ stalled-job 으로 대체 확정됨(본 draft 결정 참조)" 으로 교체하거나, 해당 항에 상호참조를 추가해 번복 사실을 명문화해야 한다.

---

### 2. [INFO] §7.2 체크포인트 Resume — "미완료 태스크 재큐" 서술과 target 의 "stalled 재배달" 모델 간 표면 불일치

- **target 위치**: `plan/in-progress/spec-draft-exec-intake-queue.md §4 (§7.2 정합)` "미완료 태스크 재큐 → 새 Worker 가 해당 노드부터 재실행"
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §7.2 체크포인트 기반 Resume` — "미완료 태스크(현재 실행 중이던 노드)를 재큐" / "해당 노드만 재실행"
- **상세**: 기존 §7.2 는 per-node task queue 전제("미완료 태스크" = 개별 노드 태스크) 로 작성되어 있다. target draft 는 §7.2 를 "stalled 재큐 모델과 정합"이라고 주장하면서 "재큐 대상은 active 세그먼트 job이고 RUNNING 한정임을 명시"하겠다고 하나, 기존 §7.2 본문을 **교체·폐기**한다는 언급 없이 "정합"으로만 처리하고 있다. spec 본문에 §7.2 가 per-node 어휘("해당 노드만 재실행")로 남으면 execution-level 세그먼트 모델과 혼용될 수 있다.
- **제안**: spec 본문 반영 시 §7.2 의 "미완료 태스크(노드)를 재큐 → 해당 노드부터 재실행" 서술을 "stalled active 세그먼트 job → 다른 워커에 재배달 → §7.5 rehydration 으로 세그먼트 재개(완료 노드 재실행 안 함 원칙 유지)" 로 재작성해야 한다. 이는 per-node 어휘 제거를 위한 필수 편집이며, draft 후속 목록에 §7.2 가 누락되어 있다.

---

### 3. [WARNING] §8 타임아웃 — 기존 spec 의 "wall-clock vs active 시간" 미정을 번복하면서 Rationale 참조는 충분하나, spec §8 본문의 기존 "30분" 수치·코드명 서술과의 명시적 교체 관계가 불분명

- **target 위치**: `plan/in-progress/spec-draft-exec-intake-queue.md §5 (§8 재정의)`, `## Rationale "타임아웃을 active-running 누적 기준으로"`
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §7.4 Recovery "STUCK_RECOVERY_STALE_MS(30분)"` 및 `spec/1-data-model.md ## Rationale "Execution.error 의 EXECUTION_TIMEOUT"` 에서 `EXECUTION_TIMEOUT` 이 "30분 heartbeat 없는 RUNNING" 용도로 쓰임을 암시
- **상세**: target draft 는 `EXECUTION_TIME_LIMIT_EXCEEDED` (신규 코드) 와 `EXECUTION_TIMEOUT` (기존 Code 노드 스크립트 타임아웃 전용) 을 명시 분리하겠다고 한다. 그런데 기존 spec 의 `spec/5-system/4-execution-engine.md §9.2 용도별 키 정의` 에는 `exec:{wsId}:worker:{workerId}:heartbeat` 키가 "Worker 헬스체크 15초" 로 남아 있고, `WORKER_HEARTBEAT_TIMEOUT` 에러 코드가 `recoverStuckExecutions` 에서 사용되고 있다(`error.code='WORKER_HEARTBEAT_TIMEOUT'`). target 이 §8 타임아웃을 active-running 누적 기준으로 정의하면 `WORKER_HEARTBEAT_TIMEOUT` 코드를 남길 것인지, `EXECUTION_TIME_LIMIT_EXCEEDED` 로 대체·공존시킬 것인지의 결정이 target 에 없다. 이는 기존 에러 코드 Rationale 과 충돌 가능성이 있는 암묵적 가정이다.
- **제안**: spec 본문 반영 목록에 "`WORKER_HEARTBEAT_TIMEOUT` 에러 코드의 stalled-job 전환 후 처리 — 코드 유지(BullMQ stalled로 의미 재정의) vs 신규 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 단계적 이관" 결정을 명시하고, `spec/1-data-model.md §2.13` 동기화(이미 후속 목록 포함) 시 에러 코드 교체 범위를 명확히 해야 한다. WARNING 수준은 해당 결정 부재가 하위 spec 과의 모순을 낳을 가능성이 있기 때문이다.

---

### 4. [INFO] `spec/0-overview.md ## Rationale "실행 엔진: Redis 큐 + 분산 워커 풀"` — "NodeExecution = 워커가 핸들러 호출" 문구 교체 명시됨, 방향 정합

- **target 위치**: `plan/in-progress/spec-draft-exec-intake-queue.md §6 (§0-overview §2.4 + Rationale 정직화)`
- **과거 결정 출처**: `spec/0-overview.md ## Rationale "실행 엔진: Redis 큐 + 분산 워커 풀 (§2.4)"` — "NodeExecution = 워커가 핸들러 호출" 표현
- **상세**: target draft 가 이 문구를 "execution-level 세그먼트 모델로 정정하고, 본 결정으로 링크"한다고 명시했으므로 번복이 Rationale 과 함께 작성되어 있다. 정책적 정합성은 충분하다.
- **제안**: spec 반영 시 0-overview.md Rationale 항의 기존 문구 옆에 "(→ 2026-06-04 execution-level intake 큐 결정으로 재정의, per-node 어휘 폐기)" 형태의 인라인 변경 이력을 남기면 미래 독자가 번복 시점을 알 수 있다.

---

### 5. [INFO] per-node task queue 폐기 — 기각 대안으로의 복귀 우려 없음, Rationale 충분

- **target 위치**: `plan/in-progress/spec-draft-exec-intake-queue.md §4.2`, `## Rationale "per-node task queue → execution-level intake 큐"`
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §4.1~4.3 (Planned)` — per-node 아키텍처가 목표로 기록됨
- **상세**: per-node task queue 는 기존 spec 에서 "Planned(aspirational)"였지 "확정 채택"이 아니었으므로, 이를 번복하는 것은 기각된 대안의 재도입이 아니라 aspirational 목표의 재정의에 해당한다. target draft 는 per-node 폐기 근거(컨테이너 중첩 스코프 체인 전제 불가, rehydration 인프라 불일치, 엔진 재작성급 비용)를 Rationale 에 상세 기록했다. Rationale 연속성 관점의 위반은 없다.
- **제안**: 없음 (정보 기록 수준).

---

### 6. [INFO] Sticky fast-path 원칙("항상 publish") — target 의 "항상 BullMQ enqueue" 정합 확인

- **target 위치**: `plan/in-progress/spec-draft-exec-intake-queue.md §4 (§7.4 정합)` "양쪽 세그먼트 진입에 동일 적용"
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md ## Rationale "Durable Continuation" — "Sticky fast-path 제거 — 항상 publish 원칙 보존"`
- **상세**: 기존 Rationale 은 "모든 진입점은 항상 BullMQ enqueue — local resolve 분기는 race window" 원칙을 확정했다. target draft 의 `execution-run` 신규 intake 큐도 동일 BullMQ infra 재사용이며, 원칙과 충돌하지 않는다.
- **제안**: 없음.

---

## 요약

target draft(`spec-draft-exec-intake-queue.md`)는 전반적으로 기존 spec Rationale 에서 확정된 원칙(무기한 park, 항상 publish, WebsocketService 단일 sink, waiting_for_input 제외 원칙 등)을 정확히 재확인하거나 강화하고 있으며, 명시적으로 기각된 대안을 이유 없이 재채택하는 사례는 발견되지 않았다. 핵심 우려는 두 가지다: (1) §7.1 heartbeat 의 "목표 방향(Planned)" 문구가 기존 Rationale 에 남아 있는데 draft 가 이를 폐기하는 결정이 spec 반영 시 해당 Rationale 항을 함께 교체해야 한다는 점, (2) `WORKER_HEARTBEAT_TIMEOUT` 에러 코드와 신규 `EXECUTION_TIME_LIMIT_EXCEEDED` 의 공존·대체 관계가 명시되지 않아 하위 spec(`spec/1-data-model.md §2.13`)과 에러 코드 충돌 가능성이 있다는 점. 이 두 항목은 WARNING/INFO 수준이며 CRITICAL 위반은 없다.

---

## 위험도

LOW
