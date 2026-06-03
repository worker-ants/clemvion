---
worktree: spec-exec-intake-queue
started: 2026-06-04
owner: project-planner
---

# Spec Draft — 실행엔진 분산 모델: execution-level intake 큐

> 대상 spec: `spec/5-system/4-execution-engine.md` (§4 / §7.1 / §7.2 / §7.4-7.5 / §8) + `spec/0-overview.md` (§2.4 + Rationale)
> 성격: 기존 "Planned/aspirational" 로 표기된 **per-node task queue** 미구현 아키텍처를 **execution-level intake 큐**로 재정의. 사용자 확정(2026-06-04).
> 본 draft 는 `/consistency-check --spec` 통과 후 spec 본문에 반영한다. 구현은 별도 developer 트랙.

## 0. 변경 요지

한 execution 을 **"active-running 세그먼트들의 연속 + 그 사이의 durable park"** 로 모델링한다.

- 두 BullMQ 큐가 **active 세그먼트**(노드를 실제로 전진시키는 작업 구간)를 운반한다:
  - `execution-run` (**신규 intake 큐**) — **첫** active 세그먼트(시작 → 첫 BLOCK/완료)
  - `execution-continuation` (**기존**) — 매 **재개** active 세그먼트(사용자 입력 후)
- `waiting_for_input` 은 **큐에 들어가지 않는 durable DB park** — 두 active 세그먼트 사이의 간극. heartbeat·TTL·재큐·stuck-recovery 대상 아님. 오직 사용자 인터랙션 도착만이 continuation job 을 만들어 다음 세그먼트를 시작한다.

per-node task queue (1 Worker = 1 NodeExecution) 모델은 폐기한다.

---

## 1. §4 Worker 모델 (4.1–4.3 재정의)

### 4.1 아키텍처 (execution-level intake 큐)

```
┌─────────────┐     ┌────────────────────┐     ┌─────────────┐
│  execute()  │────→│  BullMQ            │────→│  Worker 1   │
│  (Producer) │     │  execution-run     │     │  Worker 2   │  각 워커 = 실행 1건의
│             │     │  (intake queue)    │     │  Worker N   │  active 세그먼트 처리
└─────────────┘     └────────────────────┘     └─────────────┘
```

- `execute()` 는 Execution row 를 `pending` 으로 저장한 뒤, **현 fire-and-forget in-process `runExecution()` 대신 `execution-run` 큐에 "실행 시작" job 을 발행**한다. N 개 backend/worker 인스턴스가 work-stealing 으로 consume 한다.
- 큐는 `background-execution`(§3.3) · `execution-continuation`(§7.4) 과 **동일한 BullMQ infra 를 재사용**한다.
- backpressure: intake 큐가 버스트(웹훅·이벤트 홍수)를 버퍼링하고, 동시 active 세그먼트 수는 워커 수 × per-worker concurrency 로 상한된다 (§8 동시성 cap 의 토대).

### 4.2 작업 단위 — execution-level 세그먼트 (per-node 폐기)

- **1 Worker = 1 active 세그먼트** (실행 1건을 통째로 — 시작/재개부터 다음 BLOCK 또는 완료까지). per-node 분산(1 Worker = 1 NodeExecution)은 채택하지 않는다.
- `execution-run` job 메시지:

```json
{
  "jobId": "<executionId>:run:<monotonic-seq>",
  "executionId": "uuid",
  "input": { ... },
  "triggerType": "webhook"
}
```

> `triggerType` 값은 기존 `Trigger.type` enum(`webhook` / `manual` / `schedule`, `spec/1-data-model.md §2.8`)을 그대로 사용한다 — 신규 어휘(`trigger` 등) 도입 금지(naming collision 회피).

- job 을 받은 워커는 기존 `runExecution()` 의 **in-process dispatch loop** 를 그대로 수행한다 — 컨테이너(Loop/ForEach/Map)·중첩 스코프·back-edge·Parallel 의 의미론은 **무변경**(한 active 세그먼트는 한 워커 프로세스 안에서 진행).
- 세그먼트 종료 조건: (a) Execution 완료/실패 → job 정상 ack, (b) 노드가 BLOCK(`waiting_for_input`) 반환 → §2(아래) 의 park 처리 후 job 정상 ack.

### 4.3 수평 확장

| 항목 | 설명 |
|------|------|
| Worker 인스턴스 수 | backend 인스턴스 수로 결정 (LB 뒤 N 개) |
| per-worker 동시성 | `EXECUTION_RUN_WORKER_CONCURRENCY` (기본값 TBD — 구현 시 결정). 비양수·비정수·비숫자 입력 fallback 은 `CONTINUATION_WORKER_CONCURRENCY`(§7.4) 패턴 준용 |
| 스케일 아웃 | backend/worker 프로세스 추가로 처리량 증가 (work-stealing) |
| 우선순위 | **BullMQ job priority** 로 `manual` > `webhook` > `schedule`. `triggerType`(=`Trigger.type`) → priority 매핑 |
| 큐 파티셔닝 | 워크스페이스별 큐 분리는 **후속(P2)** — 초기엔 단일 `execution-run` 큐 + priority + concurrency 로 충분 |

### 4.4 이벤트 발행 sink

- **무변경** — `WebsocketService` 단일 sink 정책 유지(기존 §4.4 그대로). 분산 fan-out 은 Continuation Bus(§7.4) 가 담당하고 intake 큐는 이벤트 sink 와 직교.

---

## 2. waiting_for_input 처리 (핵심 — 본문 명시)

> intake 큐 도입은 **wait 의미를 전혀 바꾸지 않는다**. waiting 은 active 세그먼트가 아니라 두 세그먼트 사이의 durable park 다.

- **BLOCK 진입 시**: 그 세그먼트를 운반하던 job(`execution-run` 또는 `execution-continuation`)은 "이 실행을 BLOCK/완료까지 전진" 이라는 자기 작업을 완수한 것 → **정상 ack/remove**(fail 아님, retry 아님). Execution row 만 `waiting_for_input` 으로 남는다.
- **park 상태**: 큐 엔트리 없음 · heartbeat 없음 · TTL 없음 · §7.1 stalled 재큐 대상 아님 · §7.4 stuck-recovery 대상 아님(기존대로 `waiting_for_input` 제외). DB 에 **무기한 보존**.
- **재개**: 오직 사용자 인터랙션 도착만이 `execution-continuation` job 을 만들어 다음 active 세그먼트를 시작한다(기존 §7.4/§7.5 경로 **무변경**).
- 노드 자체의 워크플로 정의 timeout(예: `formConfig.timeout`)은 엔진 자원 가드와 **별개**로 그대로 유지된다.

---

## 3. §7.1 재정의 — stalled-job 재큐 (active 세그먼트 한정)

- heartbeat 5초/미응답 15초/태스크 재큐의 **별도 heartbeat 메커니즘 표현을 폐기**하고, **BullMQ stalled-job 검출**로 대체한다: active 세그먼트 job(`execution-run` / `execution-continuation`)을 처리하던 워커가 크래시하면, BullMQ 가 stalled job 을 다른 워커에 재배달한다 → 그 워커가 §7.5 rehydration/§7.2 checkpoint 로 세그먼트를 재개한다.
- **RUNNING 한정**: stalled 재큐는 active 세그먼트 job 에만 적용된다. **`waiting_for_input` 은 job 이 없으므로 절대 재큐/만료되지 않는다.**
- 현재의 `recoverStuckExecutions()` 절대시간(`started_at < now()-30분`) 일괄 fail 은 이 stalled 메커니즘으로 **대체 예정**으로 표기한다(구현 시 §7.2/§7.4 와 통합).

| 항목 | 재정의 후 |
|------|-----------|
| 크래시 검출 | BullMQ stalled-job 검출 (active 세그먼트 job 한정) |
| 미응답 시 동작 | stalled job 을 다른 워커에 재배달 → §7.5 rehydration 으로 세그먼트 재개 |
| waiting_for_input | **대상 아님** — job 부재, 무기한 park 유지 |

---

## 4. §7.2 / §7.4 / §7.5 정합

- **§7.2 (체크포인트 Resume)**: "미완료 태스크 재큐 → 새 Worker 가 해당 노드부터 재실행" 은 stalled 재큐 모델과 정합. 단 재큐 대상은 **active 세그먼트 job** 이고 RUNNING 한정임을 명시.
- **§7.4 / §7.5**: `execution-run` intake 큐가 `execution-continuation` 큐와 함께 **"active 세그먼트 운반자"** 임을 명시한다. rehydration(§7.5)·outbound routing context 재등록·멱등성 가드는 **양쪽 세그먼트 진입에 동일 적용**된다(첫 세그먼트가 크래시 후 재배달될 때도 동일 rehydration 경로).
- §7.4 Recovery 의 "`waiting_for_input` 무기한 보존" 원칙은 **그대로 SoT** — 본 변경이 강화/재확인.

---

## 5. §8 재정의 — active-running 타임아웃 + 동시성 cap

- **단일 Execution 최대 실행 시간 = active-running 누적 시간 기준** (wall-clock 아님, `waiting_for_input` 대기 시간 **제외**) 으로 명문화한다.
  - 근거: 며칠 대기하는 waiting 워크플로를 wall-clock 으로 죽이면 안 된다(사용자 확정).
  - 설계상 자연 분리: active 세그먼트 job 은 active 구간 동안만 존재(park 동안 job 부재)하므로 **세그먼트 job 타임아웃 = 그 세그먼트의 active 시간**. Execution 의 누적 active 시간은 세그먼트 active 시간들의 합으로 추적한다.
  - 초과 시: **`EXECUTION_TIME_LIMIT_EXCEEDED`** → Execution `failed`. (엔진 레벨 누적 active 타임아웃 전용 신규 코드. Code 노드의 스크립트 타임아웃 `EXECUTION_TIMEOUT`(`nodes/data/code/code.handler.ts`)과 **의미가 달라 코드를 분리** — naming collision 회피.)
- **동시 실행 cap** (워크스페이스 10 · 워크플로 3 등)은 `execution-run` intake 큐 + 카운트 가드로 enforce한다. 초과 시 새 Execution 은 `pending` 으로 큐 대기(기존 §8 표의 동작 유지).
- 본 절의 "미구현(Planned)" banner 는 유지하되, **목표 아키텍처를 per-node 전제가 아닌 execution-level intake 큐 + active-running 누적 타임아웃** 으로 갱신한다.

---

## 6. §0-overview §2.4 + Rationale 정직화

- §2.4 Execution Engine 의 "Message Queue — 실행 태스크를 큐에 발행 / Worker Pool — 큐에서 태스크를 소비하여 **노드** 실행" 표현을, **"execution-level intake 큐(`execution-run`)에 실행 시작을 발행 / 워커가 실행 1건(active 세그먼트)을 통째로 처리"** 로 정정한다(per-node 뉘앙스 제거).
- §2.6 Data Layer 의 Redis BullMQ 큐 목록에 `execution-run` 추가.
- Rationale "실행 엔진: Redis 큐 + 분산 워커 풀" 에 **"NodeExecution = 워커가 핸들러 호출"** 문구를 execution-level 세그먼트 모델로 정정하고, 본 결정(§아래 Rationale)으로 링크.

---

## 7. 구현 선결조건 (spec 본문에 "구현 시 검증" 으로 명시)

1. **동기 실행 경로 식별**: 현재 `execute()` 를 인라인 await 하여 결과를 즉시 반환하는 호출자(REST API / chat-channel / EIA 등)가 있으면, 큐 전환이 그 계약을 비동기로 바꾼다. 구현 선결로 **(a) 그런 caller 를 식별**하고 **(b) WS/SSE/이벤트 기반 비동기로 전환하거나 inline 대기(큐 job 완료 await)를 보전**해야 한다. 어느 진입점도 결과를 silent drop 하지 않아야 한다.
2. **멱등성**: stalled 재큐로 active 세그먼트가 재실행될 때 비멱등 노드(Integration write 등)의 중복 실행 우려 → 기존 jobId 멱등성(§7.3)·`NodeExecution.status` 재검증(§7.5)·checkpoint 재개(§7.2)와 정합되도록 구현. 세그먼트 재개는 "완료 노드 재실행 안 함" 원칙(§7.2)을 따른다.

---

## Rationale

### per-node task queue → execution-level intake 큐 (§4 재정의)

- **배경**: §4.1–4.3 은 본래 per-node task queue(1 Worker = 1 NodeExecution, 노드마다 `{taskId, nodeId, nodeType, input, context, timeout}` 태스크 발행)를 목표 아키텍처로 그렸으나 미구현(Planned) 상태였다. 분산 처리량·backpressure·장애복구가 사용 방식과 무관한 기반 요건으로 확인되어 구현에 착수하면서 설계를 재검토했다.
- **기각된 대안 (per-node task queue)**: 현 in-process dispatch loop 는 컨테이너(Loop/ForEach/Map)·중첩 스코프 체인(`$parent`)·back-edge 순환·Parallel(`p-limit`+`allSettled`)을 **"한 실행이 한 프로세스 안에 있다"** 는 전제로 동작한다. 개별 노드를 워커로 분산하려면 노드마다 전체 ExecutionContext(변수·loop/item context·스코프 체인·conversation thread)를 직렬화/rehydration 해야 하고, 현 rehydration 인프라(§7.5)는 "waiting 후 재개" 용이지 "실행 중 노드 핸드오프" 용이 아니다. → 엔진 재작성급 변경 + 고위험.
- **채택 (execution-level intake 큐)**: 워커가 **실행 1건(active 세그먼트)을 통째로** 처리한다. n8n queue mode 와 동형이며, 목표(수평 처리량·work-stealing·backpressure·§8 동시성 cap 토대)를 per-node 대비 훨씬 낮은 위험으로 달성한다. 기존 `background-execution`·`execution-continuation` 큐 패턴을 그대로 재사용한다.
- **세그먼트 모델의 정합성**: 이미 `execution-continuation`(§7.4)이 "재개 active 세그먼트" 를 운반하고 있었다. `execution-run` intake 큐는 그 대칭으로 "첫 active 세그먼트" 를 운반한다. 두 큐가 active 세그먼트를, `waiting_for_input` 이 그 사이 durable park 를 담당하는 구조가 자연스럽게 완성된다.
- **trade-off**: per-node 수준의 세밀한 부하 분산(한 실행 내 노드들을 여러 워커로)은 포기한다. 단일 실행이 매우 무겁고 그 내부를 분산해야 하는 요구가 실제로 생기면 후속으로 재검토한다(현 시점 그 요구 없음).

### §7.1 별도 heartbeat 구현 포기 → BullMQ stalled-job 으로 일원화 (§7.1 재정의)

- **배경**: §7.1 은 본래 워커가 5초마다 emit 하는 별도 heartbeat + 15초 미응답 판정 + 태스크 재큐를 목표로 그렸으나 미구현이었고, 현 동작은 `recoverStuckExecutions()` 의 절대시간(`started_at < now()-30분`) 일괄 fail 이다.
- **채택**: 별도 heartbeat 채널(워커 emit + 검사 경로)을 신설하지 않고, **BullMQ 내장 stalled-job 검출**로 일원화한다. active 세그먼트가 이미 BullMQ job(`execution-run`/`execution-continuation`)으로 표현되므로, 워커 크래시는 곧 job stall 이고 BullMQ 가 이를 다른 워커에 재배달한다. 추가 heartbeat emit/검사 코드 없이 동일 목적(크래시 검출 + 재개)을 충족한다.
- **기각**: 별도 heartbeat 는 (a) 워커마다 주기적 emit 인프라, (b) 그것을 검사·판정하는 중앙 경로를 새로 만들어야 하고, BullMQ stalled 메커니즘과 **기능이 중복**된다 (YAGNI). 절대시간 30분 일괄 fail 도 stalled 재배달로 대체되어 "이어받기 없는 fail" 회귀가 사라진다.
- **귀결**: spec §7.1 표(heartbeat 5초/15초/재큐)는 stalled-job 서술로 **교체**되며, "heartbeat 기반 전환 Planned" 문구는 폐기한다(두 방향 공존 오인 방지).

### 타임아웃을 active-running 누적 기준으로 (§8 재정의)

- **배경**: §8 의 "단일 Execution 최대 실행 시간 30분" 이 wall-clock 인지 active 시간인지 미명시였다.
- **채택**: active-running 누적 시간 기준(waiting 대기 제외). wall-clock 이면 사용자 입력을 며칠 기다리는 정상 워크플로를 timeout 으로 죽이게 된다(과거 테스트에서 "늦게 돌아오니 세션 만료" 회귀로 확인된 안티패턴).
- **설계 정합**: 세그먼트 job 이 active 구간에만 존재하므로 job 타임아웃이 곧 active 시간 측정이 되어, 별도 시계 없이 자연 분리된다.

---

## 후속

- [ ] `/consistency-check --spec plan/in-progress/spec-draft-exec-intake-queue.md` 통과 (BLOCK: NO)
- [ ] **spec 본문 반영 시 동시 갱신 목록** (cross-spec INFO 반영):
  - `spec/5-system/4-execution-engine.md`: §4.1–4.3(재정의) · §7.1(stalled-job 전면 교체) · §7.2(per-node 뉘앙스 제거) · §7.4/§7.5(intake 큐를 세그먼트 운반자로 명시) · §8(active-running) · **§9.3 큐 목록에 `execution-run` 행** · **§11 ENV 표에 `EXECUTION_RUN_WORKER_CONCURRENCY` 행**
  - `spec/0-overview.md`: §2.4(execution-level 정정) · **§2.6 Redis 큐 목록에 `execution-run` 추가** · Rationale(구 문구 옆에 변경 이유+본 결정 링크)
  - `spec/1-data-model.md §2.13`: `Execution.error` 의 `EXECUTION_TIMEOUT` 설명("30분 heartbeat 없는 RUNNING")을 stalled-job·active-running 모델과 동기화 + 신규 `EXECUTION_TIME_LIMIT_EXCEEDED` 반영
  - `execute()` 비동기 계약 명시: spec §4(또는 §6.1.1)에 "`execute()` 는 `pending` 생성 후 `execution-run` 발행하고 즉시 반환(비동기)" 명문화
- [ ] **side-effect — spec-sync plan 정리**: `plan/in-progress/spec-sync-execution-engine-gaps.md` 의 §4·§7.1·§8 추적 TODO 를 "per-node 모델 폐기로 대체됨 → 본 draft 로 forwarding" 으로 닫기. `execution-engine-residual-gaps.md G2`(cross-instance 재개)와 §7.1 stalled 재배달의 관계 명시.
- [ ] **merge 순서 메모**: `spec/0-overview.md §Rationale` 수정은 경쟁 worktree(`competitive-analysis-e0569b`·`ai-context-memory-9c7e6e`)와 인접 hunk 충돌 위험 → 해당 PR 선행 병합 후 base 최신화 또는 수동 resolve.
- [ ] 구현 추적 plan 신설 (developer 트랙: PR1 intake 큐 → PR2 §8 가드+타임아웃 → PR3 크래시 재개[`node-cancellation-infrastructure.md §2`와 코드영역 겹침 — 직렬화 순서 명시] → PR4 stalled 일원화)

> frontmatter `owner` 필드: `plan-lifecycle.md §4` 스키마에 `worktree`/`started`/`owner` 로 명시되어 유효(consistency checker 의 "스키마 외" WARNING 은 오탐으로 판단, 유지).
