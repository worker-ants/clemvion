---
worktree: refactor-06-c2-atomic-claim
started: 2026-07-02
owner: project-planner
---

# spec draft — 재개(rehydration) race 보장을 DB 원자 claim 으로 (06 C-2)

대상 spec: `spec/5-system/4-execution-engine.md` (§7.5·§7.4·§1.1·§1.2·Rationale) + side-effect `spec/data-flow/3-execution.md §1.4`.
추적 plan: `plan/in-progress/refactor/06-concurrency.md` C-2 (사용자 승인 Option A, 2026-07-02).

> **rev2 (2026-07-02)** — consistency-check `23_23_49` Critical(rationale_continuity) 해소. rev1 은 기존 **직접** `WFI→failed`/`WFI→completed` 전이를 "claim 후 running 경유"로 재서술했는데, 이는 Rationale L1246–1254(L1252)가 명시 기각한 "WFI→running→failed 2단계"와 구조 일치였다. rev2 는 (a) claim 을 **재개 진입 gate 로만 추가**하고 기존 finalization 전이를 재서술하지 않으며, (b) 신규 Rationale 에서 L1252 를 정면 인용해 "부분 수정" 논거(편익 맥락 변화 + 원자성 우려 실질 대응)를 명시한다.

## 배경 (문제)

§7.5 는 "재검증 가드가 BullMQ 멱등성을 보완해 **정상-경로 race 까지 닫는다**" + Rationale "불변식: 동일 turn 이중 실행 0" 을 선언한다. 그러나 그 가드는 **비원자 SELECT check-then-act** (`worker 는 처리 전 NodeExecution.status === 'waiting_for_input' 인지 재검증`) 라, 멀티 인스턴스(인스턴스당 concurrency=1 이어도 인스턴스 간 병렬) 또는 §7.4 가 예고한 concurrency 상향 시 **선언한 불변식을 기계적으로 보장하지 못한다** — check 와 act 사이 창에서 두 worker 가 동시에 통과할 수 있다.

## 개정 방향 (Option A — DB 원자 claim)

재개 **진입** 을 조건부 원자 UPDATE 로 gate 한다 (TS 의사코드 — 기존 §1.3 관례):

```ts
// 재개 진입 gate — 단일 조건부 원자 트랜잭션
const claimed = await claimResumeEntry(nodeExecutionId); // UPDATE ... WHERE status='waiting_for_input' RETURNING id
if (!claimed) return ackAndDiscard();                    // affected=0 → 다른 worker 가 이미 획득/완료
```

- **affected=1** → 이 worker 만 재개 진행.
- **affected=0** → 즉시 **ack-and-discard**.

check-then-act 창이 사라져 정상-경로 race 가 **기계적으로** 닫힌다(멀티 인스턴스·concurrency 상향 양쪽 안전). §1.3 `_retryState` "affected=1 인 쪽만 진행" 소비 패턴의 일반화다.

## 구체 변경

### 변경 1 — §7.5 "Rehydration 멱등성" (현 L970–974 의 재검증 가드 bullet)

**현재**:
> - 추가로 worker 는 처리 전 `NodeExecution.status === 'waiting_for_input'` 인지 재검증. 이미 `COMPLETED` (다른 worker 가 먼저 처리) 면 즉시 ack-and-discard. 이 가드는 BullMQ 의 멱등성을 보완해 정상-경로 race 까지 닫는다.

**개정**:
> - 추가로 worker 는 처리 전 재개 진입을 **DB-level 원자 claim** 으로 획득한다: `waiting_for_input` 인 대상 row 를 조건부로 `running` 전이시키는 단일 UPDATE(`… WHERE status='waiting_for_input' RETURNING`)를 실행해 **affected=1** 인 worker 만 재개를 진행하고, **affected=0**(다른 worker 가 이미 획득했거나 완료)이면 즉시 **ack-and-discard**. 이 원자 claim 이 BullMQ 멱등성(jobId)을 보완해 **정상-경로 race 까지 기계적으로 닫는다** — 비원자 SELECT 재검증과 달리 check-then-act 창이 없어 멀티 인스턴스·§7.4 concurrency 상향 양쪽에서 "동일 turn 이중 실행 0" 불변식을 보장한다. claim 의 `waiting_for_input → running` 전이는 §1.1 원자성 보장에 따라 짝 상태(Execution ↔ NodeExecution)를 **단일 트랜잭션**으로 갱신하며, claim 획득 후 rehydration 이 실패하면 아래 "Rehydration 실패 케이스" 의 `RESUME_*` terminal 로 마감해 **stuck RUNNING 을 남기지 않는다**. claim 후 worker 크래시로 남은 `running` row 는 §7.4 `recoverStuckExecutions`(RUNNING 대상)가 회수한다. (§1.3 `_retryState` "affected=1 인 쪽만 진행" 패턴의 일반화.)

### 변경 2 — §7.5 rehydration 시퀀스 다이어그램 (현 L925)

**현재**: `├─ Execution.status === 'waiting_for_input' 검증`

**개정**: `├─ 재개 진입 원자 claim (waiting_for_input → running 조건부 UPDATE; affected=0 → ack-and-discard — "Rehydration 멱등성")`

### 변경 3 — §1.2 NodeExecution 상태 (전이 **추가** — 기존 전이 재서술 없음)

`waiting_for_input` 분기에 **재개 진입 gate 전이만 추가**한다. 기존 `waiting_for_input → completed`·`waiting_for_input → failed` 전이 서술은 **변경하지 않는다**(rev1 의 "running 경유 재서술" 철회):

- 다이어그램: `waiting_for_input ──► running (재개 진입 원자 claim, §7.5)` 화살표 추가.
- 표/노트 1줄: "**`waiting_for_input → running`** — 재개 진입 시 §7.5 원자 claim 이 대상 row 를 조건부 전이(affected=1 인 단일 worker 만). 이후 그 turn 은 `running` 에서 처리되어 `completed`(정상) 또는 `failed`(turn 중 LLM throw)로 마감된다. **claim 획득 실패(affected=0)는 상태 무변경 no-op**(ack-and-discard)."
- 기존 §1.1 L76 `waiting_for_input → failed`(2026-06, AI turn throw finalization)와의 관계는 §Rationale 신규 소절에서 명시(아래 변경 6) — 재개 turn 의 LLM throw 는 claim 후 `running → failed` 로 finalize 되며, 이는 2026-06 결정의 **부분 수정**이다.

### 변경 4 — §1.1 (원자성 노트 L81 정합)

- L75 `waiting_for_input → running (실행 재개)` 는 그대로 유효 — 이제 그 전이가 **원자 claim 으로 조건부·단일 진입** 됨을 §7.5 링크로 명시.
- L81 원자성 보장 노트에 1줄 보강: "재개 진입의 `waiting_for_input → running` **claim** 역시 이 원자성에 포함된다 — 조건부 UPDATE 가 Execution·NodeExecution status 를 **단일 트랜잭션**으로 함께 갱신하고, affected=0 이면 어느 쪽도 갱신하지 않는 no-op(ack-and-discard)이며, claim 후 rehydration 실패는 `RESUME_*` terminal 로 원자 마감(§7.5)."

### 변경 5 — §7.4 Worker 동시성 (현 L876) + §7.4 Rationale (L1376)

- §7.4 L876 1줄 보강: "… latency 가 관측되면 상향. **재개 진입이 §7.5 의 DB 원자 claim 으로 gate 되므로 concurrency 상향·멀티 인스턴스에서도 '동일 turn 이중 실행 0' 불변식이 유지된다** — 이 기본값은 성능 파라미터이지 정합성 전제가 아니다."
- §7.4 Rationale L1376 "재검증 가드로 불변식 보존" 류 문구를 "재개 진입 원자 claim 으로 불변식 보존"으로 갱신(INFO #1).

### 변경 6 — §Rationale (신규 소절, L1246 "waiting_for_input → failed 전이 추가" 소절 직후)

> ### 재개 race 보장을 DB 원자 claim 으로 — 2026-06 "running hop 회피" 결정의 부분 수정 (§7.5, 2026-07-02)
>
> §7.5 는 "재검증 가드가 정상-경로 race 까지 닫는다"(불변식: 동일 turn 이중 실행 0)를 선언했으나, 그 가드는 비원자 SELECT check-then-act 라 멀티 인스턴스·concurrency 상향 시 불변식을 기계적으로 보장하지 못했다. 재개 **진입** 을 조건부 원자 UPDATE(`… WHERE status='waiting_for_input' RETURNING`, affected=0 → ack-and-discard)로 gate 해 갭을 닫는다.
>
> **위 "`waiting_for_input → failed` 전이 추가" 소절이 기각한 "WFI→running→failed 2단계" 와의 관계 (정면 대응)**: 그 결정은 **AI turn 실패 finalization** 맥락에서 running hop 을 "무익한 복잡성 + 두 트랜잭션 분리로 원자성 약화" 로 기각했다 — 당시엔 running 을 경유할 **편익이 전무**했다. 본 결정은 그 hop 에 **새 편익**을 부여한다: 재개 진입의 concurrency race-safety(멀티 인스턴스·상향에서 이중 실행 기계적 차단)로, 2026-06 결정이 가중치를 둘 필요가 없던 요구다. 원자성 우려도 실질 대응한다 — claim 은 **단일 조건부 UPDATE**(두 트랜잭션 분리 아님)이고, claim 후 실패는 `RESUME_*` terminal 원자 마감(§7.5)으로 stuck RUNNING 을 남기지 않으며, 크래시 잔여 `running` row 는 `recoverStuckExecutions`(RUNNING 대상, §7.4)가 회수한다. 따라서 재개 turn 의 LLM throw 는 claim 후 `running → failed` 로 finalize 되며, 이는 2026-06 "직접 WFI→failed" 를 재개 경로에 한해 **부분 수정**한 것이다(비-재개 finalization 서술은 불변).
>
> **기존 패턴의 일반화**: optimistic claim 은 §1.3 `_retryState` 소비("affected=1 인 쪽만 진행")로 이미 확립된 패턴의 일반화이지 새 동시성 프레임워크 도입이 아니다. concurrency=1 전제 유지(대안 B)는 불변식을 운영 구성에 의존시켜 §7.4 가 예고한 상향 시점에 결국 본 변경이 필요해 비용이 이연될 뿐이라 기각.
>
> **비용·회귀·착수 조건**: `waiting_for_input → running` claim 전이(§1.1/§1.2 정합) + claim 후 rehydration 실패 롤백(`RESUME_*`) 경로 신설 — 누락 시 stuck RUNNING. 착수 조건: 동일 (executionId, nodeExecutionId) 2회 동시 재개 시 한쪽만 진행 unit + form park 에 continuation job 2건 인위 enqueue 후 turn 이중 실행 0 dockerized e2e.

### 변경 7 — side-effect `spec/data-flow/3-execution.md §1.4` (병행 다이어그램 L142–172)

병행 시퀀스 다이어그램이 "running 전이는 최종 커밋 단계"로 그려져 있어, §7.5 원자 claim(진입 직전 gate)과 running 전이 시점을 다르게 기술하게 된다. **재개 진입 gate 단계(claim: WFI→running, affected=0 → ack-and-discard)를 다이어그램/서술에 반영**하거나, 최소 "재개 진입은 §7.5 원자 claim gate 를 거친다" drift 인지 문구를 등재.

## side-effect 점검 대상

- **§7.5.1 Publisher 사전 검증**: `INVALID_EXECUTION_STATE`(0건/2건)은 publisher 측이라 worker claim 과 직교 — 불변.
- **§7.5 Rehydration 실패 케이스 표**: `RESUME_*` 종결 불변. 표 서두에 "claim 후 실패도 동일 표로 terminal 마감 — running 잔류 금지" 1줄 명시.
- **`data-flow/3-execution.md §1.4`**: 위 변경 7 — 병행 다이어그램 running 전이 시점 동기(WARNING #2).
- **`6-websocket-protocol.md` §4.2 / conversation-thread.md**: 재개 ack(`resumed`/`queued`) 의미 불변 — claim 은 내부 가드라 WS ack 계약 무영향.
- **`1-data-model.md §3`**: `node_execution.status` enum 값 불변(running 기존 값), 새 컬럼/enum 없음 — **전이만 추가**. V095 partial index `(execution_id, status) WHERE status IN ('waiting_for_input','running')` 가 이 claim UPDATE 핫경로를 이미 커버 — 신규 인덱스 불요(INFO #3, 1줄 인용).
- **plan `06-concurrency.md` C-2 체크박스**: 별 브랜치 #790 에서 "결정대기 → Option A 승인·착수대기" 반영됨(INFO #2). 본 구현 브랜치 머지 시 "[x] 구현 완료" 로 갱신 예정.

## Rationale (draft 자체)

Option A 는 사용자 승인(2026-07-02). rev2 는 rationale-continuity Critical 을 해소 — 기존 직접 finalization 전이를 재서술하지 않고 claim 을 진입 gate 로만 추가하며, L1252 기각을 정면 인용해 "편익 맥락 변화 + 원자성 실질 대응 = 부분 수정" 을 논증했다. 구현은 developer 트랙(§2단계) — tx 경계·롤백·ALLOWED_TRANSITIONS 상세는 impl-prep 에서 확정.
