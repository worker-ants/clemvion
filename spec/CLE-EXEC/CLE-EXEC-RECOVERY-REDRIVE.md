---
id: "CLE-EXEC-RECOVERY-REDRIVE"
title: "장애 복구와 안전 종료 — 크래시 재구동과 부팅 복구 스캔"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-RECOVERY"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-RECOVERY"]
area: "CLE-EXEC"
content_hash: "78292f9883b83e7a53206ddb7d344a37e1f840ad426ce46f714f2411572aa4aa"
read_as: "approved_fallback"
task: "CLE-T-EC9VFJ"
source_paths: []
mirror_sha256: "c7eff802460e62d1f0e0565bcfb7dc8b8437d6548330816886cd749100d8d802"
etag: "sha256-7812bafcc798c212a56da5f20531fc04dce06a19ce565eb6148f55d3bda80d73"
---
## 개요

이 문서는 [장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md) 의 하위 문서로 실행 중(`running`)이던 세그먼트의 크래시 재구동과 부팅 복구 스캔을 정한다. 재구동의 두 트리거(운영 중 stalled 재배달, 부팅 복구 스캔), 부팅 복구 스캔의 네 단계, 종결된 실행 아래 남은 노드 실행 행의 마감, 그 결정 근거를 다룬다. 재구동이 거치는 rehydration 과 멱등성 계약은 [체크포인트와 rehydration](CLE-EXEC-RECOVERY-REHYDRATE.md) 이 정한다.

## 크래시 재구동

크래시한 세그먼트는 두 트리거로 재구동한다. 둘 다 구현됐다.

### 운영 중 stalled 재배달

- 시작 큐(`execution-run`) 설정은 `maxStalledCount: 1`, `stalledInterval: 30초` 다.
- 워커가 크래시하면 작업이 stall 된다. BullMQ 가 **같은 jobId 로 1회** 다른 워커에 자동 재배달한다.
- 작업을 받은 워커의 `runExecutionFromQueue` 는 실행이 이미 `running` 인 것을 보고 `running` 분기로 들어간다. `recordRunningSegmentStart` 와 `redriveStuckExecution` 으로 [case B](CLE-EXEC-RECOVERY-REHYDRATE.md#두-진입-경우) 재구동을 한다. 완료 노드는 건너뛰므로 멱등이다.
- 검출 대상은 세그먼트 작업(`execution-run` / `execution-continuation`)뿐이다.
- 재배달을 소진하면 `onFailed → finalizeStalledExhausted` 가 `status='running'` 조건으로 실행을 `failed` + `error.code='WORKER_HEARTBEAT_TIMEOUT'` 으로 마감한다.
- **이 마감은 단일 트랜잭션이다(2026-08-15).** 실행을 `failed` 로 쓰는 UPDATE 와 자식 `running` 노드 실행을 함께 마감하는 cascade UPDATE 를 `dataSource.transaction` 하나로 묶는다. 이벤트는 커밋 뒤에 발행한다. 같은 두 테이블 쓰기를 하는 `cancelParkedExecution` 과 `markWebChatIdleTimeout` 도 같은 방식이다.
- 관측은 시작 큐 DLQ 모니터(`ExecutionRunDlqMonitorService`)가 한다. 설정은 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 에 있다.

### 부팅 복구 스캔으로 재구동

- 서버가 뜰 때 `recoverStuckExecutions()` 가 `status='running' AND started_at < now() - STUCK_RECOVERY_STALE_MS(30분)` 인 실행을 찾는다.
- 일괄 `failed` 로 표시하지 않는다. 행마다 **원자 re-claim** 을 한다. `UPDATE … SET started_at=now() WHERE status='running' AND started_at < :threshold RETURNING` 에서 affected=1 인 인스턴스만 그 실행을 맡는다.
- 가진 실행을 case B 로 재구동한다. rehydrate 한 뒤 마지막 완료 노드 다음부터 `runNodeDispatchLoop` 로 진행한다.
- **PR4 뒤에도 은퇴하지 않고 함께 둔다.** stalled 재배달은 stall 된 작업이 있을 때만 동작한다. 전체 재시작(모든 워커가 동시에 내려감), Redis 비영속(작업 자체 소실), 작업 유실은 stall 된 작업이 없어 이 스캔이 맡는다.

### heartbeat 채널을 두지 않는다

워커가 5초마다 신호를 보내고 중앙에서 검사하는 heartbeat 채널은 **만들지 않는다.** 워커 크래시는 곧 세그먼트 작업의 stall 이고 BullMQ 내장 stalled 검출이 같은 일을 한다. 근거는 [Rationale](#워커-크래시-복구를-stalled-재배달로-일원화-2026-06-04-결정) 에 있다.

### 경계와 마감

| 항목 | 동작 |
| --- | --- |
| 입력 대기 | 대상이 아니다. 큐 작업이 없으므로 stall, 재발행, 만료 어디에도 걸리지 않는다. 기한 없이 park 한다. |
| 재구동 자체가 불가 | 체크포인트가 없거나 손상됐으면 `RESUME_CHECKPOINT_MISSING` 으로 끝낸다([rehydration 실패](CLE-EXEC-RECOVERY-REHYDRATE.md#rehydration-실패)). |
| 계속 실패하는 poison 세그먼트 | 부팅 트리거는 부팅마다 최대 1회라 저절로 속도가 제한된다. 운영 중 stalled 트리거는 `maxStalledCount:1` 이라 1회 재배달 뒤 `WORKER_HEARTBEAT_TIMEOUT` 으로 DLQ 에 간다. 누적되면 실행 시간 한도 초과(`EXECUTION_TIME_LIMIT_EXCEEDED`)가 2차 경계로 작동한다. 이 2차 경계는 best-effort 다(시간이 덜 세어질 수 있다, [안전 종료와 영속 재개 큐](CLE-EXEC-RECOVERY-SHUTDOWN.md#rationale) 참조). |
| stalled 재배달 소진 | `onFailed → finalizeStalledExhausted` 가 `status='running'` 조건부로 실행을 `failed` + `WORKER_HEARTBEAT_TIMEOUT` 으로 마감한다. 부팅 재구동은 이 코드를 쓰지 않는다. |

### 남은 zombie race

정상 크래시는 BullMQ lock 만료 기반 재배달로 막힌다. 원래 워커가 lock 만료 뒤 되살아나는 zombie(hang 이나 네트워크 단절 뒤 부활)는 완전히 배제되지 않는다. 그러면 stale 판정 때문에 한 실행의 세그먼트 두 개가 동시에 돌 수 있다. 피해 범위는 다음으로 묶인다.

- 부팅 트리거는 부팅마다 1회, 운영 중 stalled 는 `maxStalledCount:1` 이라 어느 쪽도 빠르게 반복 재구동하지 않는다.
- stale 임계가 30분이라 짧은 hang 은 부팅 스캔 대상이 아니다.
- 노드 실행마다 `completed` 여부를 다시 보고 건너뛰므로 두 번 돌아도 완료 노드는 다시 실행되지 않는다.

이 노출은 예전의 실패 처리 방식에도 똑같이 있었으므로 새 회귀가 아니다. 완전한 차단은 세그먼트 시작 시각이나 소유자 토큰을 영속하는 후속 작업에 달려 있다.

## 부팅 복구 스캔

부팅 복구 스캔(`recoverStuckExecutions`)은 `onApplicationBootstrap` 에서 한 번 돈다. 여러 인스턴스가 함께 뜰 때 다른 인스턴스가 정상 처리 중인 실행을 잘못 건드리지 않도록 보수적으로 막는다.

- **분산 lock**: `redis SET 'exec:recover:lock' <hostname:uuid-token> EX 60 NX`. TTL 은 60초다. lock 을 못 잡은 인스턴스는 건너뛴다. 컨테이너끼리 PID 가 겹쳐도 `hostname + UUID` 로 주인을 가린다. 키 목록에서의 등재는 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 에 있다.
- **명시적 해제**: 작업이 끝나면 주인을 확인하는 Lua script 로 lock 을 바로 푼다. TTL 만료를 기다리지 않고 다음 인스턴스가 처리할 수 있다. 주인이 다르면(이미 만료돼 다른 인스턴스가 잡은 lock) 절대 지우지 않는다.
- **두 겹의 보호**: 전역 부팅 lock 은 스캔이 동시에 시작되는 것을 막는다. 행 단위 `started_at` 조건부 re-claim 은 그 안의 추가 방어다. 늦은 부팅 스캔이나 lock 만료 경합으로 스캔이 겹쳐도 한 행이 두 번 재구동되지 않는다. 두 장치는 층이 달라 함께 둔다.

lock 을 잡은 인스턴스는 네 단계를 차례로 돈다.

- (a) 오래 멈춘 `running` 실행을 행 단위로 re-claim 한다.
- (b) re-claim 한 실행을 case B 로 재구동한다. 재구동은 기다리지 않고 띄워 둔다(fire-and-forget).
- (c) 작업을 잃은 대기 중 실행을 취소한다(`recoverOrphanPendingExecutions`).
- (d) 종결된 실행 아래 `running` 으로 남은 노드 실행 행을 닫는다(`closeOrphanRunningNodeExecutions`). 규칙은 [종결된 실행 아래 남은 노드 실행 행](#종결된-실행-아래-남은-노드-실행-행) 에 있다.

| 상태 | 임계 | 기준 컬럼 | 처리 |
| --- | --- | --- | --- |
| `running` | `STUCK_RECOVERY_STALE_MS`(30분) | `started_at` | row 단위 re-claim 뒤 case B 재구동. 부분 완료 노드라는 진행 흔적이 있다. |
| `pending`(작업을 잃은 것) | `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`(5분) | `queued_at` | `recoverOrphanPendingExecutions` 가 `markQueueWaitTimeout`(조건부 UPDATE `WHERE status='pending'`)으로 `cancelled` 마감. `error.code='EXECUTION_QUEUE_WAIT_TIMEOUT'`, `cancelledBy='timeout'`, `releaseExecutionRouting`. 작업을 가져갈 때의 큐 대기 한도 처리와 같다. |
| 노드 실행 `running`(실행은 종결) | `STUCK_RECOVERY_STALE_MS`(30분) | 노드 실행 `started_at` | `closeOrphanRunningNodeExecutions` 가 노드 실행 행을 `failed` 로 닫는다. 실행 상태는 바꾸지 않는다. Background 본문 행은 뺀다. |
| `waiting_for_input` | 없음 | 없음 | 무시한다. 기한 없이 보존하고 입력이 오면 rehydration 으로 재개한다. |

- 작업을 잃은 대기 중 실행은 동시 실행 제한에 걸려 지연 재발행된 작업이 Redis 비영속이나 eviction 으로 사라진 경우다. 큐 대기 한도는 작업을 가져갈 때만 검사하므로 이런 실행은 그 검사를 받지 못한다. 규칙 전체는 [큐 워커와 동시 실행 제한](CLE-EXEC-WORKER.md) 의 동시 실행 제한 절에 있다.
- `queued_at IS NULL`(V104 이전 행)은 저절로 빠진다.
- 스캔 시점에 아직 한도 안쪽인 작업 없는 대기 중 실행은 다음 부팅 스캔에서 한도를 넘었으면 회수한다. 드문 경우이고 부팅 때만 도는 best-effort 다.
- 동시에 소비자가 그 실행을 `running` 으로 들이거나 취소해도 affected=0 으로 끝나 결과가 같다. `pending → running` 과 `pending → cancelled` 는 서로 배타적인 전이라 두 번 처리되지 않는다.
- 공개 웹채팅 위젯의 익명 토큰 영구 만료로 생긴 입력 대기 실행의 회수는 이 스캔이 아니라 EIA 계층의 반복 sweep 이 맡는다. 규칙은 [External Interaction API](../CLE-IX/CLE-EIA.md) 의 EIA-RL-07 에 있다. 기한 없는 보존이 지키는 정상 대기(입력이 실제로 올 실행)는 바뀌지 않는다.

### 종결된 실행 아래 남은 노드 실행 행

2026-11-12 에 구현됐다. 스캔의 (d) 단계(`closeOrphanRunningNodeExecutions`)는 실행이 이미 끝났는데 노드 실행 행만 `running` 으로 남은 경우를 닫는다. case B 의 옛 행 마감(`failOrphanRunningNodeExecutions`)은 실행이 `running` 일 때만 돌아서 이 행에 닿지 않는다([멱등성 계약](CLE-EXEC-RECOVERY-REHYDRATE.md#멱등성-계약)).

- **대상**: 부모 실행이 종결 상태(`completed` · `failed` · `cancelled`)이고 노드 실행 행이 `running` 인 행이다. 그 행의 `started_at` 이 `STUCK_RECOVERY_STALE_MS`(30분)보다 오래돼야 한다.
- **제외**: 부모 체인에 Background 노드(타입 `background`) 행이 있는 행은 닫지 않는다. 부모 체인은 `parent_node_execution_id` 를 위로 따라가고 깊이 한도는 64 다. 한도 안에서 최상위 행(부모가 없는 행)에 닿지 못한 행도 닫지 않는다. 그런 행은 Background 조상이 없다고 확인할 수 없다. Background 본문은 부모 실행이 끝난 뒤에도 같은 executionId 로 돈다. `maxDurationMs` 가 0 이면 시간 한도도 없다. 그래서 본문 안 컨테이너 행이 30분 넘게 살아 있을 수 있다. 크래시로 남은 본문 행도 이 단계는 닫지 않는다.
- **건드리지 않는 행**:
  - `started_at` 이 30분 안쪽인 행. 마지막 턴 재시도 재진입 턴의 살아 있는 새 행이 여기 든다. 그 턴 동안 실행은 `failed` 이고 새 행은 `running` 이다. 취소 커밋 뒤 노드 마감 전의 짧은 창에 있는 행도 여기 든다.
  - `waiting_for_input` 노드 실행 행.
  - 비종결 실행(`running` · `pending` · `waiting_for_input`) 아래의 행.
- **처리**: 조건부 UPDATE(`status='running'` 인 행만)로 행을 `failed` 로 바꾼다. `finished_at` 은 지금 시각이고 `error.message` 는 `Node run left running under a finished execution; closed by boot recovery scan` 이다. 고른 뒤 그 사이 닫힌 행은 조건에 걸리지 않아 덮지 않는다. 실행 상태는 바꾸지 않는다. 실행이 이미 끝났으므로 이벤트를 내지 않는다. 닫은 건수는 warn 로그로 남긴다.
- **best-effort**: 이 단계가 실패해도 부팅을 막지 않는다. 예외는 error 로그로만 남기고 다음 부팅 스캔이 같은 행을 다시 본다. lock 을 잡지 못한 인스턴스는 이 단계도 건너뛴다.
- **덮는 출처**: 아래 세 경우는 모두 「부모 실행 종결 + 노드 실행 행 `running`」 이라 한 조건으로 닫힌다.
  1. 마지막 턴 재시도(`retry_last_turn`)의 2차 claim(`claimSpawnedRetryRow`)이 재배달을 버려서 남은 `running` 새 행. 실행은 `failed` 다.
  2. 2차 claim 이 성공한 뒤 턴에 들어가기 전에 난 예외나 크래시로 남은 새 행. 그 뒤의 재배달은 claim 에 실패해 1 과 같이 끝난다.
  3. 취소의 짝 전이가 실행을 `cancelled` 로 커밋한 뒤 `markNodeCancelled` 가 끝나기 전에 크래시해 남은 행.
  - `retryLastTurn` 이 새 행을 만든 뒤 재진입 작업을 잃은 경우도 모양이 같아 함께 닫힌다.
- **대가**: 이 단계는 부팅 때만 돈다. 그래서 다음 부팅 스캔 전까지 그 행은 타임라인과 진행률 집계에 `running` 으로 보인다. 재부팅이 없으면 계속 남는다. 마지막 턴 재시도가 claim 에 실패한 배달을 버리는 결정은 그대로다. 결정 근거는 [Rationale](#종결된-실행-아래-남은-running-노드-행은-부팅-스캔이-닫는다-2026-11-12-cle-t-cceqec) 에 있다.

## Rationale

### 워커 크래시 복구를 stalled 재배달로 일원화 (2026-06-04 결정)

별도 heartbeat 채널(워커 5초 emit + 중앙 검사)을 **포기하고 BullMQ 내장 stalled 검출로 일원화**한다. 옛 초안의 "heartbeat 미응답으로 판정" 전제는 폐기했다. 세그먼트가 이미 BullMQ 작업이므로 워커 크래시는 곧 작업 stall 이다. BullMQ stalled 검출이 그 작업을 다른 워커에 다시 배달하고 그 워커가 rehydration 으로 세그먼트를 이어 간다. 별도 heartbeat 발신·검사 인프라는 이 메커니즘과 **기능이 겹쳐** YAGNI 다.

- stalled 재배달은 **세그먼트 작업에만** 걸린다. 입력 대기는 작업이 없으므로 stall, 재발행, 만료에 걸리지 않고 기한 없이 park 한다.
- 절대 시간 방식은 (a) 정상적으로 오래 도는 실행을 일찍 실패시키는 오탐과 (b) 입력 대기 실행을 일괄 종결하는 운영 회귀의 원인이었다. stalled 는 "워커가 실제로 죽었을 때만" 다시 배달하므로 둘 다 사라진다. 살아 있는 워커의 긴 세그먼트는 stall 로 판정되지 않는다.
- 부팅 복구 스캔의 "절대 시간 30분 일괄 실패" 는 PR3(2026-07-04)에서 제어된 재구동으로 바뀌었다. PR4(2026-07-04)에서 운영 중 즉시 재배달(`maxStalledCount:1`)이 더해졌다. 부팅 복구 스캔은 은퇴하지 않고 함께 둔다.
- `WORKER_HEARTBEAT_TIMEOUT` 코드는 유지하되 PR4 에서 뜻을 바꿨다. "30분 절대 stale" 이 아니라 "세그먼트가 stalled 재배달 시도를 모두 소진함(워커 쪽 최종 실패)" 이다. 재구동이 불가하면 `RESUME_CHECKPOINT_MISSING` 이다.

### 크래시 세그먼트는 실패 대신 제어된 재구동 (PR3, 2026-07-04)

크래시나 재시작으로 멈춘 `running`(입력 대기가 아닌) 세그먼트를 부팅 복구 스캔이 원자 re-claim 한 뒤 case B rehydration 으로 **재구동**하도록 바꿨다. 옛 "일괄 `failed` 표시" 를 대체한다. 사용자 결정(2026-07-03): Q1 = 제어된 재구동(당시 BullMQ 자동 stalled 는 끔), Q2 = 에러 처리 정책 `continue` 는 미룸.

- **재구동인 이유**: 체크포인트 기반 재개는 "재시작 때 `running` 을 체크포인트에서 이어 간다" 고 이미 약속했는데 부팅 복구 스캔이 **일괄 실패** 처리해 약속을 어기고 있었다. 입력 대기 재개(`dispatchResumeTurn`)는 이미 모든 노드 타입으로 일반화돼 있었다. 크래시 세그먼트는 dispatch 도중의 `running` 이라 turn 핸들러가 아닌 그래프 진행으로 재구동해야 했다. `rehydrateContext` 와 `runNodeDispatchLoop` 가 노드 타입을 가리지 않아 다룰 만했다. 노드 단위 큐를 다시 들이는 것이 아니며 "한 세그먼트 = 한 프로세스" 전제는 유지한다.
- **PR3 에서 stalled 자동 재배달을 켜지 않은 이유(PR4 로 분리)**: `maxStalledCount>0` 자동 재배달은 **poison 이나 비멱등 세그먼트를 운영 중 사람 없이 다시 실행**시켜 크래시 시점의 통합 노드 부수효과를 자동으로 불릴 위험이 있다. PR3 는 제어된 트리거(부팅 스캔)로 먼저 들어가 멱등 재구동 메커니즘과 경계를 검증했다.
- **세그먼트 직렬화 불변식 재검증(필수)**: 크래시 재구동은 원래 작업이 끝나지 않은 채 같은 실행에 새 세그먼트를 시작하는 재진입 경로다. 정상 경우(원래 워커가 정말 죽음)에는 `jobId=executionId` 중복 제거, `started_at` re-claim, 노드 실행별 `completed` 건너뛰기로 같은 턴 이중 실행 0 이 유지된다. 남은 한계는 [남은 zombie race](#남은-zombie-race) 에 있다.
- **종결 경계(무한 재구동 방지)**: 1차 경계는 실행 시간 한도가 아니라 **트리거 자체**다. 부팅 때 한 번 도는 스캔이므로 poison 세그먼트는 부팅마다 최대 1회만 재구동된다. 빠른 반복이 아니며 배포가 버그를 고칠 수도 있다. 실행 시간 한도(`active_running_ms` 누적)는 크래시 때 시간이 덜 세어지므로 **best-effort 2차** 경계로만 작동한다. rehydration 자체가 불가하면 `RESUME_CHECKPOINT_MISSING` 으로 끝낸다.
- **새 마이그레이션 없음**: re-claim 은 기존 `started_at`(부팅 복구 스캔 stale 판정과 같은 컬럼) 조건부 UPDATE 다. 완료 노드 건너뛰기는 기존 노드 실행 순서 로그(V035/V036), 2차 경계는 기존 `active_running_ms`(V083)를 쓴다.
- **at-least-once 경계**: 엔진은 완료 노드 미재실행(exactly-once)만 보장하고 크래시 시점 미완료 노드는 at-least-once 로 다시 실행한다. 통합 노드의 멱등을 노드 설정에 맡기는 기존 모델과 맞는다.
- **에러 처리 정책 `continue` 세그먼트 재개는 하지 않는다**: PR3 당시 안전 종료 절차의 `continue` 분기에는 장애물이 셋 있었다(에러 처리 정책 스키마 노출 선행 미충족, `continue` 가 실제 enum 에 없음, 인스턴스 사이 재개 인프라 부재). 셋 다 크래시 재구동과 관계가 없어 PR3 는 이 분기를 따로 미뤘다. 2026-11-14 결정(CLE-T-GQ7WHS)으로 그 약속 자체를 거뒀다([안전 종료와 영속 재개 큐](CLE-EXEC-RECOVERY-SHUTDOWN.md#안전-종료)).
- **기각한 대안**: (a) 새 owner·heartbeat 컬럼으로 정확히 크래시를 검출: 마이그레이션과 heartbeat 인프라 비용이 크고 BullMQ stalled 가 같은 역할을 표준으로 주므로 PR4 로 흡수했다. (b) 복구 반복문에 주기 스캔 추가: 부팅 트리거로 재시작 재개는 성립하고 운영 중 크래시는 PR4 stalled 가 본래 담당이라 범위 밖이다.

### 운영 중 stalled 자동 재배달은 한 번만 (PR4, 2026-07-04)

PR3 로 멱등 재구동 메커니즘을 검증한 뒤 운영 중 워커 크래시를 다른 워커가 바로 이어받는 **BullMQ 기본 stalled 재배달**을 켰다. 사용자 결정(2026-07-03): Q1 = 진행(횟수 제한), Q2 = 세그먼트 시작 시각 영속은 미룸(마이그레이션 없이).

- **기본 stalled 는 같은 jobId 재처리라 seq·재발행이 필요 없다**: 처음 스케치는 크래시 재개를 `<executionId>:run:<seq>` 재발행으로 그렸다. BullMQ stalled 검출은 lock 이 만료된 **같은 작업을 그대로 다시 처리**한다(새 발행이 아니다). 그래서 `exec:run:seq` 키는 쓰지 않고 jobId=executionId 를 유지한다. `runExecutionFromQueue` 는 다시 처리하는 작업의 실행이 이미 `running` 이면 case B 재구동으로 나눈다(`pending` = 첫 실행, 종료 상태 = ack 후 버림과 함께 세 갈래).
- **`maxStalledCount=1`(피해 범위를 묶는다)**: `maxStalledCount>1` 은 poison·비멱등 세그먼트를 운영 중 사람 없이 여러 번 다시 실행해 크래시 시점 통합 노드의 중복 부수효과를 키운다. 1이면 재배달은 정확히 1회다. 소진하면 `onFailed → finalizeStalledExhausted` 가 `status='running'` 조건부로 `failed` + `WORKER_HEARTBEAT_TIMEOUT` 으로 DLQ 에 보낸다. setup 단계 throw 경로는 이미 종료 상태라 affected=0 no-op 이다. 관측은 `ExecutionRunDlqMonitorService`(재개 큐 DLQ 모니터와 같은 구조, failed ≥ 임계 경고 + cooldown)가 한다.
- **부팅 복구 스캔은 은퇴하지 않는다**: stalled 재배달은 **stall 된 작업이 있을 때만** 동작한다. 전체 재시작(재배달할 살아 있는 워커가 없음), Redis 비영속(작업 자체 소실), 작업 유실은 stall 된 작업이 없다. 그래서 부팅 때 한 번 도는 스캔을 둔다. 지식 저장소 파이프라인(`graph-extraction` stalled + `stuck-document-recovery` 부팅 스캔)도 두 메커니즘을 함께 두는 선례다.
- **DLQ 마감의 원자성(2026-08-15 원자화)**: `finalizeStalledExhausted` 는 실행 `FAILED` UPDATE 와 자식 `running` 노드 실행 cascade UPDATE **둘**을 쓴다. 둘이 각각 autocommit 이면 **일부만 커밋될 때 자식이 영원히 `running` 으로 남을** 수 있었다. 같은 두 테이블 쓰기를 하는 `cancelParkedExecution` · `markWebChatIdleTimeout` 은 이미 `dataSource.transaction` 으로 원자화돼 있었고 **이 경로만 열려 있었다.** 트랜잭션 하나로 통일했다(트랜잭션 안에서 두 UPDATE, 커밋 뒤 발행).
- **`updateExecutionStatus` else 분기 원자화(2026-08-30)는 위 DLQ 건과 목적이 다르다**: DLQ 마감 원자화는 두 테이블의 부분 커밋을 막는다. else 분기 원자화는 결과 확인 코드의 throw 가 자기 UPDATE 를 되돌리게 한다. 결정은 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) Rationale 의 "짝 없는 직접 마감도 트랜잭션 안에서 한다" 에 있다.
- **at-least-once 경계는 PR3 모델을 이어받는다**: PR4 는 완료 노드 exactly-once · 미완료 노드 at-least-once 경계를 바꾸지 않는다.
- **Q2 미룸, 시간 과소 계산은 남는다**: 세그먼트 시작 시각 영속(`active_running_ms` 정밀 flush)은 마이그레이션이 필요해 PR4 범위에서 뺐다. [안전 종료와 영속 재개 큐](CLE-EXEC-RECOVERY-SHUTDOWN.md#rationale) 의 시간 과소 계산 항목 참조.
- **남은 zombie race**: 본문 [남은 zombie race](#남은-zombie-race) 참조. 같은 종류의 좁은 race 가 하나 더 있다. `finalizeStalledExhausted` 가 발동하는 순간 부팅 복구 스캔이 같은 stale `running` 을 re-claim 해 재구동 중이면 조건부 UPDATE(`WHERE status='running'`)가 정상 재구동을 `WORKER_HEARTBEAT_TIMEOUT` 으로 잘못 마감할 수 있다. "작업 stalled 소진" 과 "부팅 스캔" 이 겹치는 아주 좁은 창에 한정되며 노드 실행별 건너뛰기로 완료 노드는 보존된다. 완전한 차단은 세그먼트 시작 시각·owner 토큰 영속(미룸)에 달려 있다.

### 작업을 잃은 대기 중 실행은 부팅 스캔이 취소한다 (2026-07-04)

동시 실행 제한에 걸려 지연 재발행된 작업은 jobId 없는 자동 id 다. Redis 비영속이나 eviction 으로 **사라지면 다시 가져갈 작업이 없어** 그 `pending` 행이 영원히 남는다. 큐 대기 한도는 소비자가 작업을 가져갈 때만 검사하므로 이런 실행은 검사를 받지 못한다. 이 틈을 부팅 복구 스캔(`recoverOrphanPendingExecutions`)으로 막는다.

- **같은 함수와 트리거를 다시 쓴다(별도 스캐너·주기 tick 없음)**: 부팅 복구 스캔(`onApplicationBootstrap` 1회 + 전역 lock)에 `pending` 스캔을 더한다. "heartbeat 대신 stalled 로 일원화, 새 주기 스캐너는 두지 않는다" 원칙을 유지한다. 별도 lock·env·마이그레이션이 없다.
  - **원칙의 범위는 작업이 있는 엔진 복구에 한정된다**: "새 주기 스캐너를 두지 않는다" 는 BullMQ 작업이 있는 `running`/`pending` 의 엔진 복구에 대한 원칙이다(stalled 재배달이 본래 담당이라 주기 스캔이 필요 없다). 입력 대기 park 의 클라이언트 이탈 회수(공개 위젯 토큰 영구 만료, EIA-RL-07)는 이 원칙과 **관계없다.** park 는 정의상 작업이 없어 엔진 복구 대상이 아니다. 그 회수는 EIA 계층의 토큰 수명 반복 sweep(EIA-RL-06 의 짝, `execution_token` 만료 기반)이 맡는다. 원칙의 예외가 아니라 원칙이 다루지 않는 다른 층·다른 신호의 작업이다.
- **`pending` 은 취소, `running` 은 재구동(상태마다 다름)**: `running` stale 은 부분 완료 노드라는 **진행 흔적**이 있어 case B 로 손실 없이 재구동한다. `pending` 은 첫 세그먼트도 시작하지 않아 재구동할 흔적이 없고 큐 대기 한도를 **이미 넘었다.** 그래서 큐 대기 한도의 `cancelled`(`EXECUTION_QUEUE_WAIT_TIMEOUT`)를 그대로 적용한다. 소비자가 가져갔을 때의 결과(재발행 → 재검사 → 취소)와 같으므로 바로 취소하는 편이 단순하고 안전하다. 오래된 실행을 `running` 으로 되살리지 않는다.
- **멱등하고 race 에 안전하다**: 대상은 `queued_at < now − EXECUTION_QUEUE_WAIT_TIMEOUT_MS` 인 `pending` 뿐이다. 회수는 기존 `markQueueWaitTimeout` 을 다시 쓴다. 동시에 소비자가 들이거나 취소해도 affected=0 no-op 으로 끝난다.
- **한도 안쪽의 작업 없는 실행**: 아직 한도 전인 실행은 다음 부팅 스캔에서 회수한다. 운영 중 필요할 때 도는 복구 트리거는 PR4 관측성과 함께 따로 검토한다.

### 종결된 실행 아래 남은 running 노드 행은 부팅 스캔이 닫는다 (2026-11-12, CLE-T-CCEQEC)

실행이 이미 끝났는데 노드 실행 행만 `running` 으로 남는 경로가 셋 있었다(본문 「덮는 출처」). case B 의 옛 행 마감은 실행이 `running` 일 때만 돌아서 이 셋에 닿지 않았고 이 행들은 타임라인과 진행률 집계에 계속 `running` 으로 보였다. 사람 결정(2026-11-12, 질문 `01a1d022-3e40-73d0-8e98-624fd8f2033e`)으로 부팅 복구 스캔에 (d) 단계를 더했다.

- **한 조건으로 닫는다**: 세 경로는 모두 「부모 실행 종결 + 노드 실행 행 `running`」 이다. 경로마다 정리 코드를 두지 않고 이 조건 하나로 닫는다.
- **임계는 30분이다**: 실행 단위 stale 판정의 `STUCK_RECOVERY_STALE_MS` 를 다시 쓴다. 새 설정 값은 두지 않는다. 이 임계는 실행이 이미 종결된 노드 실행 행에만 적용한다. 그래서 [2026-06-04 결정](#워커-크래시-복구를-stalled-재배달로-일원화-2026-06-04-결정) 이 지적한 오탐(정상적으로 오래 도는 실행, 입력 대기 실행)과 대상이 겹치지 않는다.
- **Background 본문 행은 뺀다**: Background 본문은 부모 실행이 끝난 뒤에도 돌고 `maxDurationMs` 가 0 이면 끝나는 시각도 없어 30분 임계로는 살아 있는 본문 행을 가를 수 없다. 대가로 크래시로 남은 본문 행은 이 단계가 닫지 못한다.
- **상태는 `failed` 다**: 사용자가 취소한 것이 아니고 서버 쪽 비정상 종료다. case B 의 옛 행 마감도 `failed` 로 닫으므로 그와 맞췄다.
- **마지막 턴 재시도의 버림 결정은 그대로 둔다**: claim 에 실패한 배달은 계속 버린다. 이전 방식은 claim 앞에서 `_retryState` 가 없으면 손상으로 보고 행을 `failed` 로 표시했다. 그 방식은 다른 배달이 처리 중인 살아 있는 행까지 `failed` 로 만들었다. 남은 행은 버림을 되돌리지 않고 이 단계가 나중에 닫는다.
- **기각: 주기 스윕**: 재부팅 없이도 행이 닫힌다는 이점이 있다. 대신 새 BullMQ 반복 작업과 Redis 키 등재가 필요해 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 까지 바뀐다. 이점에 비해 바뀌는 표면이 커서 택하지 않았다.
- **기각: 30분보다 짧은 임계**: 마지막 턴 재시도의 재진입 턴은 실행이 `failed` 인 채 새 행이 `running` 으로 돈다. 남은 행과 모양이 같다. 임계를 줄이면 살아 있는 재진입 턴의 행을 닫을 위험이 커진다.
- **대가**: 부팅 때만 돌므로 다음 부팅 스캔 전까지 그 행은 `running` 으로 보이고 재부팅이 없으면 계속 남는다. 재진입 턴이 예외로 끝나는 경우는 `closeSpawnedRowIfRunning` 이 바로 닫는다. 그래서 이 대가는 크래시와 턴 진입 전 예외에만 남는다.

### 최상위 행에 닿은 체인의 행만 닫는다 (2026-11-14, CLE-T-EC9VFJ)

(d) 단계는 Background 조상이 있는 행을 빼려고 부모 체인을 깊이 64까지 따라간다. 처음 구현은 한도 안에서 Background 행을 찾지 못하면 그 행을 닫았다. 그래서 Background 행이 65번째 이후 조상이면 살아 있는 본문 행도 닫힐 수 있었다.

- **최상위 도달을 확인한 행만 닫는다**: 부모가 없는 행, 또는 한도 안의 조상 가운데 부모가 없는 행이 있는 행만 닫는다. 한도를 넘는 체인, 순환하는 체인, 없는 행을 가리키는 부모 포인터는 모두 닫지 않는다. 체인이 한도 안에 드는 행은 결과가 바뀌지 않는다.
- **대가**: 체인은 서브 워크플로우 호출(재귀 한도 10)과 컨테이너 · Background 중첩으로 길어진다. 컨테이너 중첩에는 한도가 없어 64 를 넘는 체인도 만들 수는 있다. 그런 체인 끝에 크래시로 남은 행은 이 단계가 닫지 못하고 다음 부팅에도 `running` 으로 남는다. 살아 있는 본문 행을 닫는 쪽보다 남기는 쪽을 골랐다.
- **부모 행이 지워진 체인은 가르지 못한다**: `parent_node_execution_id` 는 `ON DELETE SET NULL` 이다(V012). 실행 중에 워크플로우 저장이나 노드 삭제로 서브 워크플로우 · 컨테이너 · Background 노드가 지워지면 `node_execution.node_id` 의 `ON DELETE CASCADE` 로 그 노드의 실행 행도 지워지고 자식 행의 부모 포인터는 NULL 이 된다. 이 행은 DB 에서 진짜 최상위 행과 구별되지 않는다. 노드의 `container_id` 도 `ON DELETE SET NULL` 이라 노드 그래프로도 원래 부모를 찾을 수 없다. 그래서 이런 행이 30분 넘게 `running` 이면 이 단계가 닫는다. 닫히는 것은 실행 내역의 행 표시뿐이고 돌고 있는 본문은 멈추지 않는다. 노드가 끝나면 엔진이 그 행을 다시 저장해 표시가 돌아온다. 인스턴스가 하나면 부팅 전에 본문도 이미 멈췄다.
- **기각: FK 를 RESTRICT 나 CASCADE 로 바꾸기**: RESTRICT 는 실행 이력이 있는 노드를 지우지 못하게 해 워크플로우 편집이 막힌다. CASCADE 는 실행 이력의 자식 행까지 지운다. V012 가 SET NULL 을 고른 이유(부모 행이 지워져도 자식 기록을 남긴다)와도 어긋난다.
- **기각: 노드 그래프 대조**: 지워진 노드는 그래프에 남지 않고 `container_id` 도 NULL 이 돼 원래 부모를 되찾을 수 없다.
- **기각: 실행 중 노드 삭제 막기**: 워크플로우 편집 규칙을 바꾸는 큰 변경이고 얻는 것은 표시 한 줄이다.

## 구현 위치

- `codebase/backend/src/modules/execution-engine/recovery/stuck-execution-recovery.service.ts` (`StuckExecutionRecoveryService` — 부팅 복구 스캔 `recoverStuckExecutions` 와 단계 `recoverOrphanPendingExecutions` · `closeOrphanRunningNodeExecutions`)
- `codebase/backend/src/modules/execution-engine/recovery/orphan-running-node-executions.sql.ts` (종결된 실행 아래 남은 노드 실행 행을 고르는 SQL)
- `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts` (stalled 재배달 설정과 소진 처리)
