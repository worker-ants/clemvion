---
worktree: exec-intake-pr4-stalled
started: 2026-07-04
owner: developer
spec_impact:
  - spec/5-system/4-execution-engine.md
  - spec/1-data-model.md
  - spec/5-system/3-error-handling.md
  - spec/conventions/error-codes.md
  - spec/data-flow/3-execution.md
---

# spec-update — 4-execution-engine §7 PR4 (BullMQ stalled 자동 재배달) 반영

PR4 구현(`feat(06-concurrency): PR4 BullMQ stalled 자동 재배달`) 이 착지했으므로, spec 의 "PR4 Planned/target" 마커를 **구현 완료(2026-07-04)** 로 flip 하고, 구현이 원래 스케치와 달라진 두 지점(F1: `recoverStuckExecutions` **은퇴 아님·backstop 상시 유지**, F-seq: 네이티브 stalled 는 **같은 jobId 재처리라 `exec:run:seq` 불요**)과 defer 결정(Q2: 세그먼트-start 영속 defer → under-count 미해소)을 Rationale 에 정합화한다.

이 draft 는 `/consistency-check --spec` 게이트용. BLOCK: NO 시 spec 본문에 반영.

## 확정 사실 (사용자 결정 2026-07-03 + 구현 결과)

- **auto-redelivery ON**, `maxStalledCount=1` (bounded blast radius = 재배달 1회; 소진 시 failed).
- **네이티브 BullMQ stalled = 같은 jobId 재처리** → `<executionId>:run:<seq>` re-enqueue **불요**. `exec:run:seq` 키는 PR4 에서도 **미사용 유지**(당초 "PR4 활성화" 스케치를 정정).
- **`recoverStuckExecutions` 은퇴하지 않는다** — 부팅 backstop 으로 상시 유지. 이유(물리): 전체 재시작·Redis 비영속(job 소실)·job 유실은 **stalled job 자체가 없어** stalled 재배달로 커버 불가. KB `stuck-document-recovery` 도 동일하게 "stalled + 부팅 backstop" 병존 선례.
- **at-least-once 경계 = PR3 모델 유지**: 완료 노드 skip(exactly-once), RUNNING-at-crash 노드는 재실행(Integration 멱등은 노드 책임, §7.3).
- **Q2 defer**: 세그먼트-start 영속(active_running_ms under-count 정밀 해소)은 PR4 에서 **하지 않는다**(migration-free). under-count 는 후속 candidate 로 남긴다.
- **`WORKER_HEARTBEAT_TIMEOUT` 재정의 + PR4 부터 발동**: "30분 절대 stale 일괄 fail" → "stalled 재배달 attempts 소진(terminal worker failure)". `onFailed → finalizeStalledExhausted` 가 `status='running'` 조건부로만 마킹.

## 편집 목록 (before → after)

### E1. line 379 구현상태 banner
- before: "§7.1 stalled-job 재배달(crash 재개)…는 Planned (PR2-4) … `maxStalledCount:0` 으로 stalled 재배달 차단"
- after: §7.1 stalled 재배달은 **PR4 구현 완료(2026-07-04)** — `maxStalledCount:1`, 크래시 세그먼트 자동 1회 재배달 후 §7.5 case B 재구동. (동시성 cap PR2b·우선순위 3-tier 는 여전히 Planned 로 유지.)

### E2. §7.1 (812–829)
- title `(target)` 유지 가능하나 banner(814) 를 "두 트리거 분리 (PR3 구현 / **PR4 구현**)" 로.
- (mid-operation stalled 트리거) 항목: "PR4 Planned … 미구현 … `maxStalledCount:0` 유지" → **"PR4 구현(2026-07-04): `maxStalledCount:1`. 운영 중 워커 크래시 = job stall → BullMQ 가 같은 jobId 로 1회 자동 재배달 → 픽업 워커의 `runExecutionFromQueue` RUNNING 분기가 §7.5 case B 로 재구동."**
- 표(822–827):
  - `mid-operation 크래시 검출 (PR4 target)` → **(PR4 구현)**.
  - `미응답 시 동작 (PR4 target)` → **(PR4 구현)** 같은 jobId 재배달 → §7.5 rehydration.
  - `terminal (PR3 현행)` 행: "PR3 기간 WORKER_HEARTBEAT_TIMEOUT 미발동" → PR4 에선 **재구동 불가(checkpoint)는 여전히 `RESUME_CHECKPOINT_MISSING`**, 단 **stalled 재배달 소진은 `WORKER_HEARTBEAT_TIMEOUT`**(아래 행)로 분리.
  - `attempts 소진 (PR4 target)` → **(PR4 구현)**: "stalled 재배달 소진 → failed + `WORKER_HEARTBEAT_TIMEOUT`. `maxStalledCount=1` 이므로 재배달 1회 후 소진." §2.13 동기화.
- 829 "PR3 → PR4 관계" 문단: "완전 대체는 PR4 로 남는다(… `recoverStuckExecutions` **은퇴** 포함)" → **정정**: PR4 는 운영 중 즉시 재배달을 도입하되 **`recoverStuckExecutions` 을 은퇴시키지 않는다 — 부팅 backstop 으로 상시 유지**(전체 재시작·Redis 비영속·job 유실은 stalled job 이 없어 backstop 필수). 관측성은 execution-run DLQ 모니터로 도입.

### E3. §7.2 (836–852)
- point 2 "mid-operation (active 세그먼트 한정, PR4 Planned)" → **(PR4 구현)**.
- 850 "point 2(mid-operation stalled 재배달)는 여전히 Planned(PR4)" → **PR4 구현 완료**.
- 852 "PR4 예정 mid-operation 재배달" → **PR4 구현된 mid-operation 재배달**.

### E4. §7.5 case B (929) + §1.2/§7.5 zombie race (1002, 1301–1302)
- 929 case B 트리거: 현재 "부팅 시 `recoverStuckExecutions` 가 …" 만 → **트리거 2종**: (i) 부팅 backstop `recoverStuckExecutions`(started_at 조건부 re-claim), (ii) **운영 중 stalled 재배달 시 `runExecutionFromQueue` RUNNING 분기**(같은 jobId 재처리, `recordRunningSegmentStart` + `redriveStuckExecution`). 재구동 로직(rehydrate + forward)은 공통.
- 1002 / 1301–1302 "잔여 race (PR4 완결)" / "BullMQ stalled fencing 이 아직 꺼져 있어" → **정정**: PR4 로 stalled 재배달이 **켜졌다**(`maxStalledCount=1`). 단 stalled fencing 은 BullMQ lock 만료 기반이라 zombie(락 만료 후 부활) 를 **완전히** 배제하진 못하며, per-node COMPLETED skip + `maxStalledCount=1`(무한 재배달 없음) 로 blast radius 를 bound. (완전 fencing 서술을 "PR4 가 lock 기반 재배달로 대폭 완화, per-node skip 이 이중 구동 무해화" 로 조정 — "PR4 가 완전 해소" 로 과표기하지 않는다.)

### E5. §8 under-count Rationale (1409–1424)
- 1413 "경합 없는 flush … 세그먼트-start 영속이 도입되는 **PR4**에서 해소 예정" → **정정**: PR4 는 사용자 결정(Q2 defer)으로 **migration-free** 로 진행해 세그먼트-start 를 영속하지 않는다 → under-count **미해소**. 정밀 flush 는 세그먼트-start 영속을 도입하는 **후속**으로 남긴다.
- 1424 동일 취지 문장 정합.

### E6. §9.2 seq 표 (1117) + §9.3 큐 카탈로그 (1136)
- 1117 `exec:run:seq`: "PR4 활성화" → **정정**: PR4 는 **네이티브 stalled(같은 jobId 재처리)** 를 쓰므로 re-enqueue 가 없고 seq 도 **미사용 유지**. (seq 일반형은 향후 명시적 re-enqueue 도입 시에만 활성화.)
- 1136 큐 카탈로그 `execution-run` 행: `maxStalledCount:0` → **`maxStalledCount:1`** + stalledInterval 30s. "stalled 재배달 차단 — PR4 상향" → **"PR4: stalled 1회 자동 재배달 → §7.5 case B 멱등 재구동. jobId=executionId 유지(네이티브 stalled 는 같은 jobId 재처리, re-enqueue/seq 불요)."**

### E7. §2.13 WORKER_HEARTBEAT_TIMEOUT
- 코드 의미를 "stalled 재배달 소진" 으로 재정의 + **PR4 부터 발동**으로 동기화(현재 §2.13 서술 확인 후 정합).

### E8. Rationale (1462–1470) + 신규 PR4 소절
- 1470 "`WORKER_HEARTBEAT_TIMEOUT` … PR4 에서 의미 재정의 … PR3 기간 미발동" → **PR4 구현으로 재정의 발효**.
- 1466–1470 heartbeat→stalled 일원화 문단에 **`recoverStuckExecutions` backstop 유지**(은퇴 아님) 를 명기.
- 신규 소절 "**PR4 — BullMQ stalled 자동 재배달 (2026-07-04)**":
  - 네이티브 stalled = 같은 jobId 재처리 → seq/re-enqueue 불요(당초 스케치 대비 단순화).
  - `maxStalledCount=1` bounded blast radius 근거(poison 세그먼트 무인 무한 재실행 방지; 소진 → `WORKER_HEARTBEAT_TIMEOUT` dead-letter + DLQ 모니터 관측).
  - `recoverStuckExecutions` **backstop 상시 유지** 근거(물리: 재시작·Redis 비영속·job 유실은 stalled job 부재; KB stuck-document-recovery 선례).
  - Q2 defer(세그먼트-start 영속 미도입, migration-free) → under-count 미해소, 후속 candidate.
  - at-least-once 경계 = PR3 모델 계승(§7.3 노드 멱등 책임).

### E8b. §Rationale "크래시/재시작 RUNNING 세그먼트 제어된 re-drive" (line 1299–1302) — rationale checker WARNING
- 1300 "**왜 BullMQ stalled 자동 재배달을 지금 켜지 않는가 (PR4 분리)**: … 자동 재배달·`recoverStuckExecutions` 은퇴는 PR4 에서 관측성과 함께 도입한다." → **정정**: PR4 가 자동 재배달을 **켰다**(`maxStalledCount=1`) — 단, **`recoverStuckExecutions` 을 은퇴시키지 않고 backstop 으로 유지**(물리적 사유). "PR3 에서 켜지 않는 이유(poison 무인 증폭 위험)" 서술은 PR3 시점 근거로 보존하되, "PR4 에서 은퇴" 예고는 "PR4 에서 자동 재배달 도입 + backstop 병존" 으로 갱신.
- 1301–1302 (zombie race / terminal 경계)는 E4 에서 커버(stalled fencing 켜짐 반영).

### E9. spec/conventions/error-codes.md §3 `WORKER_HEARTBEAT_TIMEOUT` (line 63) — convention checker WARNING
- before: "…→ (PR4 target) BullMQ stalled-job 재배달 attempts 소진 시 발동. 코드명은 **유지·PR4 재정의**…"
- after: **"(PR4 구현, 2026-07-04)"** — BullMQ stalled 재배달(`maxStalledCount=1`) attempts 소진 시 `onFailed → finalizeStalledExhausted` 가 `status='running'` 조건부로 `failed` + `WORKER_HEARTBEAT_TIMEOUT` 마킹. 재정의 발효(30분 절대 stale → stalled 소진). 부팅 `recoverStuckExecutions` re-drive(§7.5 case B)는 여전히 이 코드를 쓰지 않음(재구동 불가 = `RESUME_CHECKPOINT_MISSING`). spec 본문 flip 과 시제 일치.

### E10. spec/1-data-model.md §2.13 Execution.error (line 469) — cross_spec CRITICAL
- `WORKER_HEARTBEAT_TIMEOUT (…terminal worker failure, **PR4 예약**, §7.1; **PR3(2026-07-04)부터 … 이 코드는 PR3 기간 미발동**)` → **"PR4 구현(2026-07-04): stalled 재배달 소진 시 발동. 부팅 recoverStuckExecutions re-drive(§7.5 case B)는 이 코드 미사용(재구동 불가=`RESUME_CHECKPOINT_MISSING`)."**

### E11. spec/5-system/3-error-handling.md §1.4 표 (line 76) — cross_spec CRITICAL
- `WORKER_HEARTBEAT_TIMEOUT | … **PR4 예약** — PR3 … 미발동` → **"PR4 구현: stalled 재배달 attempts 소진 → failed. 부팅 re-drive(§7.5 case B)는 미사용."**

### E12. spec/data-flow/3-execution.md — cross_spec CRITICAL/WARNING/INFO
- **:65** `attempts: 1, maxStalledCount: 0 … (PR1~PR3 무변경; 상향은 PR4). stalled 재배달이 … 차단하며` → **"attempts:1, `maxStalledCount:1`(PR4). stalled 재배달 1회 자동 허용 → 같은 jobId 재처리로 `runExecutionFromQueue` RUNNING 분기가 §7.5 case B 재구동(멱등: 완료 노드 skip). 소진 시 failed+`WORKER_HEARTBEAT_TIMEOUT`."** crash orphan RUNNING 은 여전히 §3.3 backstop `recoverStuckExecutions` 도 커버.
- **:247 상태도** `running --> failed: … (WORKER_HEARTBEAT_TIMEOUT 은 PR4 stalled 예약 — PR3 미발동)` → **"WORKER_HEARTBEAT_TIMEOUT(PR4 stalled 소진)"**. `running --> running` 코멘트에 PR4 트리거 병기: "부팅 recoverStuckExecutions re-claim(PR3 backstop) **또는** 운영 중 stalled 재배달 RUNNING 분기(PR4)".
- **:204 §2.2 큐 카탈로그 표** (`:65` 와 별개 occurrence — cross_spec 재검증 WARNING): `execution-run` 행 `attempts:1 / maxStalledCount:0 / removeOnFail:false` → **`maxStalledCount:1`** (PR4). "jobId=executionId (1:1 enqueue dedup)" 유지(네이티브 stalled 는 같은 jobId 재처리).
- **:262 표** `WORKER_HEARTBEAT_TIMEOUT | **PR4 예약** … **PR3 미발동**` → **"PR4 구현: stalled 재배달 소진. 부팅 re-drive 는 미사용(§3.3)."**
- **:293 §3.3 표**: 도입부 "소스는 두 가지" → **세 가지**(또는 boot re-drive 항목에 PR4 stalled 병기). `recoverStuckExecutions` 항목 말미 괄호 `(BullMQ stalled 자동 재배달·WORKER_HEARTBEAT_TIMEOUT 발동은 PR4 …)` → **"PR4 구현됨"** + **신규 행/문장**: "운영 중 stalled 재배달(`execution-run`/`execution-continuation` job stall) → 같은 jobId 재처리 → `runExecutionFromQueue` RUNNING 분기 §7.5 case B 재구동; `maxStalledCount=1` 소진 시 `WORKER_HEARTBEAT_TIMEOUT`. `recoverStuckExecutions` 는 stalled job 이 없는 케이스(전체 재시작·Redis 비영속·job 유실) backstop 으로 병존."

### E13. §9.3 DLQ 모니터 명기 (naming_collision INFO, 비차단)
- §9.3(또는 §7.4 DLQ 서술)에 continuation 과 대칭으로 `ExecutionRunDlqMonitorService`(`EXECUTION_RUN_DLQ_ALARM_THRESHOLD` 등) 를 execution-run 큐 관측 수단으로 1줄 명기. (있으면 좋은 정합, 필수 아님.)

## 검증
- spec.ts:1078 가드(`recoverStuckExecutions` 는 fail-mark 안 함) 는 **유지 유효** — backstop 은 여전히 re-drive 만; `WORKER_HEARTBEAT_TIMEOUT` 는 별도 `finalizeStalledExhausted` 소관.
- 반영 후 `/consistency-check --spec` 재확인 불요(본 draft 가 그 게이트). spec 반영 후 `/consistency-check --impl-done spec/5-system/` 로 코드-스펙 정합 최종 확인.
