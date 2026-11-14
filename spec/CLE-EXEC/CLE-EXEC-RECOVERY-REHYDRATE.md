---
id: "CLE-EXEC-RECOVERY-REHYDRATE"
title: "장애 복구와 안전 종료 — 체크포인트와 rehydration"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-RECOVERY"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-RECOVERY"]
area: "CLE-EXEC"
content_hash: "46e9c1ac1db18687ed2f41c58302c8583b4ad4964e059a7d430bf2efdb9fdb21"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "9116e3f1f7fa2484da0e29cdf7a44b73a7ba42a687324ecb1d26e9af49a4c16b"
etag: "sha256-c548378613c25774e0be39ec1e5865c5c2e769b6f31706ae7ecf9fb05081b048"
---
## 개요

이 문서는 [장애 복구와 안전 종료](CLE-EXEC-RECOVERY.md) 의 하위 문서로 체크포인트와 멱등성 계약, rehydration(`rehydrateContext`)의 두 진입 경우와 재개 절차, 중첩 서브 워크플로우 재개, 재개 진입 원자 claim, rehydration 실패, 재시도 층의 합산을 정한다. 재구동 트리거(stalled 재배달, 부팅 복구 스캔)는 [크래시 재구동과 부팅 복구 스캔](CLE-EXEC-RECOVERY-REDRIVE.md) 이 정한다.

## 체크포인트와 멱등성

### 체크포인트

노드가 완료될 때마다 체크포인트를 append-only 로 남긴다.

- 노드 실행 순서 로그(`execution_node_log`): 처리된 노드의 순서
- 완료 노드 실행의 `NodeExecution.outputData`: 노드별 출력
- 실행의 영속 컨텍스트: park 때 커밋하는 항목. 목록은 [실행 컨텍스트](CLE-EXEC-CONTEXT.md) 에 있다.

노드 실행 순서 로그의 스키마와 기록 시점은 [실행 데이터와 흐름](CLE-EXEC-DATA.md) 에 있다.

### 재구동 절차

크래시한 `running` 세그먼트(case B)는 다음 순서로 재구동한다.

1. 소유권을 얻는다. stalled 재배달은 BullMQ 가 같은 jobId 로 재배달한 작업을 받은 워커가, 부팅 복구 스캔은 `started_at` 조건부 re-claim 에서 affected=1 인 인스턴스가 맡는다.
2. `rehydrateContext` 가 같은 executionId 의 노드 실행 순서 로그로 `_executedNodes` Set 과 완료 노드 출력을 되살린다.
3. 도착한 입력이 없으므로 turn 핸들러(`dispatchResumeTurn`)를 거치지 않는다. `runNodeDispatchLoop` 를 마지막 완료 노드 다음부터 진행한다.
4. 완료 노드는 다시 실행하지 않는다(`_executedNodes` 기준).
5. 크래시 시점에 아직 완료되지 않은 노드는 다시 실행된다(at-least-once).
6. 재구동 도중 새 블로킹 노드에 닿으면 정상적으로 park 하고 세그먼트를 끝낸다.

이 절차는 노드 타입과 관계없다. `rehydrateContext` 와 `runNodeDispatchLoop` 가 이미 노드 타입을 가리지 않는다. 입력 대기 노드 재개(case A, `dispatchResumeTurn`)와 달리 도착 입력과 turn 핸들러를 거치지 않고 바로 그래프를 진행한다.

### 멱등성 계약

재개(case A)와 재구동(case B)에서 "같은 턴·세그먼트 이중 실행 0" 을 지키는 계약은 넷이다.

- **jobId 멱등**: 세그먼트·재개 작업의 jobId 는 `executionId`(시작 큐) 또는 `executionId:nodeExecutionId:seq`(재개 큐)다. BullMQ 가 중복 작업을 거른다.
- **재개 진입 원자 claim(affected=1)**: 입력 대기 재개는 `waiting_for_input → running`(`claimResumeEntry`)으로, 크래시 재구동은 `running → running` `started_at` 조건부 re-claim 으로 소유권을 얻는다. 둘 다 affected=1 인 워커나 인스턴스만 진행한다. `_retryState` 의 "affected=1 인 쪽만 진행" 방식을 일반화한 것이다.
- **완료 노드 미재실행(엔진 보장, exactly-once)**: 재개나 재구동 때 노드 실행 순서 로그와 완료 노드 출력으로 되살린 `_executedNodes` 로 완료 노드를 건너뛴다. 추가로 dispatch 직전 대상 노드 실행이 이미 `completed` 면 건너뛴다(메모리 Set 과 겹치는 DB 재확인 방어).
- **크래시 시점 미완료 노드는 at-least-once**: 크래시 때 아직 `completed` 가 아니던 노드는 재구동 때 **다시 실행된다.** 그 노드의 외부 부수효과(`send_email`, HTTP POST 같은 통합 쓰기)가 이미 일어났는지 엔진은 알 수 없다. 그래서 exactly-once 를 보장하지 않는다. 외부 API 를 부르는 통합 노드의 멱등성은 노드 설정에서 관리한다(idempotency key 등). 엔진 보장은 "완료 노드 미재실행" 까지다. 분산 트랜잭션 없이 무손실로 이어 가려면 피할 수 없는 대가다.
  - **남은 행 마감**: 다시 실행은 **새 노드 실행 행**으로 한다. 크래시 때의 옛 `running` 노드 실행 행은 case B 재구동에 들어갈 때 `failed` 로 마감한다(`failOrphanRunningNodeExecutions`). 완료 노드는 `completed` 라 대상이 아니다. 이 마감은 부모 실행이 끝난 뒤에도 `running` 노드가 타임라인과 진행률 집계에 남지 않게 한다.
  - **적용 범위**: 이 마감은 **case B 재구동에 들어가는 시점에만** 돌고 대상은 아직 `running` 인 실행 아래의 행이다. 실행이 이미 끝났는데 노드 실행 행만 `running` 으로 남은 경우(예: 마지막 턴 재시도 `retry_last_turn` 의 2차 claim 이 버린 새 행, 그때 실행은 이미 `failed`)는 부팅 복구 스캔의 (d) 단계가 닫는다([종결된 실행 아래 남은 노드 실행 행](CLE-EXEC-RECOVERY-REDRIVE.md#종결된-실행-아래-남은-노드-실행-행)).

## rehydration

### 두 진입 경우

rehydration 은 두 트리거로 들어온다. 둘 다 `rehydrateContext` 로 DB 에서 컨텍스트를 손실 없이 되살리고 affected=1 원자 claim 으로 소유권을 얻어 `runNodeDispatchLoop` 로 진행한다. 트리거와 도착 입력의 유무만 다르다.

- **case A, 입력 대기 노드 재개**: 입력 대기 상태에서 인스턴스가 내려간 뒤 **사용자 입력이 도착**한다. BullMQ 가 임의 인스턴스에 재개 큐 작업을 배달한다. `waiting_for_input → running` 원자 claim(`claimResumeEntry`) 뒤 rehydrate 한다. 도착 입력을 `dispatchResumeTurn`(form·button·ai turn 핸들러)으로 처리한 다음 진행한다.
- **case B, 크래시·재시작 `running` 세그먼트 재구동**: 도착 입력도 입력 대기 노드도 **없다.** 부팅 복구 스캔은 `running → running` `started_at` 조건부 re-claim 으로, 운영 중 stalled 재배달은 `runExecutionFromQueue` 가 `status==='running'` 을 보고 `recordRunningSegmentStart` + `redriveStuckExecution` 으로 들어온다. 이후는 [재구동 절차](#재구동-절차) 와 같다.

모든 재개는 rehydration 한 경로로 간다. 같은 인스턴스가 우연히 작업을 가져가도 마찬가지다. park 에서 코루틴을 바로 풀어 주므로 in-process resolver 가 없기 때문이다(Phase B).

### 재개 절차

case A 는 다음 순서로 재개한다. case B 는 8단계의 "도착 입력으로 turn 핸들러 호출" 만 "turn 핸들러를 건너뛰고 진행" 으로 바꾸고 나머지(claim, rehydrate, routing 재등록, 진행)를 공유한다.

1. 클라이언트의 재개 명령이 controller 나 WS gateway 에 들어오고 재개 큐에 들어간다. 발행 쪽 규칙은 [큐 워커와 동시 실행 제한](CLE-EXEC-WORKER.md) 에 있다.
2. 임의 워커가 작업을 가져가 **재개 진입 원자 claim** 을 한다. `waiting_for_input` 조건부 UPDATE 로 `running` 으로 바꾼다. affected=0 이면 작업을 ack 하고 버린다([재개 진입 원자 claim](#재개-진입-원자-claim)).
3. **outbound routing context 를 다시 등록한다**(`triggerId` 와 `workflowId` 가 있을 때). 영속된 실행 행의 `triggerId` / `workflowId` / `input_data.chatChannel` 로 `execute()` 최초 등록과 같은 형태로 등록한다(CCH-AD-05). 등록이 실패해도 warn 로그만 남기고 rehydration 은 계속한다(best-effort). 종료 이벤트를 발행할 때 저절로 해제된다.
4. `NodeExecution.outputData` 에서 원본 설정(`rawConfig`) 스냅샷과 멀티턴 AI 재개 체크포인트(`_resumeCheckpoint`)를 읽는다.
5. `Execution.conversation_thread` 에서 대화 스레드 스냅샷을 손실 없이 되살린다. 영속 규칙은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 에 있다.
6. `Execution.user_variables` 에서 사용자 정의 변수를 되살린다. 시스템 예약 변수(`__*`)는 여기 없고 따로 다시 넣는다.
7. 실행 컨텍스트를 **항상 DB 에서** 다시 만든다. park 가 세그먼트 종료이므로 메모리의 컨텍스트는 이미 사라졌다. Redis 컨텍스트 저장소도 없다. 같은 인스턴스가 우연히 컨텍스트를 아직 들고 있으면(`getContext` hit) 다시 쓰지만 이는 최적화일 뿐 정합성 전제가 아니다. 완료 노드 출력은 노드 실행 순서 로그와 `NodeExecution.outputData` 에서 되살린다.
8. `driveResumeAwaited`(최상위, await)나 `driveCallStackResume`(중첩)가 도착 입력으로 그 노드의 turn 핸들러를 부른다. form·buttons·ai 분기는 단일 진입점 `dispatchResumeTurn`(순서가 있는 `resumeTurnRegistry`, `resume-turn-dispatch.ts`)이 먼저 맞는 항목으로 보낸다. form 은 `processFormResumeTurn`, button 은 `processButtonResumeTurn`, AI 는 `handleAiResumeTurn` 을 거쳐 `processAiResumeTurn` 으로 간다. 메모리 resolver 등록이나 replay 없이 바로 구동한다.
9. 이후 그래프를 평소처럼 진행한다(`runNodeDispatchLoop`).

### 중첩 서브 워크플로우 재개

park 한 노드가 중첩 서브 워크플로우(`executeInline`) 안에 있으면 `Execution.resume_call_stack` 이 NULL 이 아니다. 이때는 단일 수준 재진입 대신 `driveCallStackResume` 이 호출 스택(`resume_call_stack`)을 따라 재개한다. 호출 체인은 park 커밋 때 영속되며 컬럼은 V087 이다.

1. **버전 확인**: `resume_call_stack.version` 이 `CALL_STACK_SCHEMA_VERSION` 보다 크면 `RESUME_INCOMPATIBLE_STATE` 로 안전하게 끝낸다. 롤링 배포 중 옛 인스턴스가 새 형식을 가져가는 경우를 막는다. AI 재개 체크포인트와 같은 방식이지만 **서로 다른 상수**다.
2. **frame 확인**: frame 마다 `workflowId` · `invokerNodeId` 가 비어 있지 않은 문자열인지 본다. 하나라도 비면 재개 진입 claim 뒤, 조회 전에 `RESUME_CHECKPOINT_MISSING` 으로 마감한다([rehydration 실패](#rehydration-실패)). 두 값은 재개 조회의 조건이라 비면 조회가 일반 예외로 끝나 원인이 흐려진다([데이터 모델 개요 §조회 조건의 null · undefined](../CLE-PLAT/CLE-PLAT-DATA.md#조회-조건의-null--undefined)).
3. **frame 단위 재진입(가장 안쪽부터, 바깥으로)**: `executeInline` 을 다시 부르지 않는다. `driveCallStackResume` 이 `frames` 를 직접 구동한다.
   - **가장 안쪽 frame**: 입력 대기 노드의 턴을 처리한다. 최상위와 같이 `dispatchResumeTurn` 으로 보낸다. 이어서 `driveResumeFrame` 이 그 frame 의 나머지 그래프를 `runNodeDispatchLoop` 로 진행한다.
   - **바깥 frame**: 안쪽 frame 이 끝나면 그 서브 워크플로우 출력을 부모 frame 의 호출 노드(Workflow 노드) 출력으로 넣고(`injectInvokerOutput`) `driveResumeFrame` 으로 부모 frame 의 나머지를 진행한다. `i = frames.length-2` 부터 `i=0` 까지 되풀이한다.
   - **최상위 진행**: 모든 frame 이 끝나면 `frames[0].invokerNodeId` 노드 출력을 넣고 최상위 그래프의 나머지를 진행한 뒤 실행을 `completed` 로 마감한다.
   - 진행 중에 새 블로킹 노드가 park 하면 `executeInline` 이 `ParkReleaseSignal` 을 던지고 `runNodeDispatchLoop` 가 `{parked:true}` 로 받아 세그먼트를 끝낸다. 실행은 입력 대기로 남고 새 호출 스택을 다시 영속한다. 다음 재개가 같은 절차로 이어 간다.
   - **완료 노드 목록**: 각 frame 의 완료 노드 집합(`executedNodes`)은 따로 노드 실행 순서 로그에서 읽지 않는다. `rehydrateContext` 가 되살린 `context._executedNodes` 를 다시 쓴다. 그 Set 도 같은 executionId 의 노드 실행 순서 로그에서 왔으므로 결과는 같다. 완료 노드는 다시 실행하지 않는다.

**선형 스택 불변식**: 컨테이너(Loop/ForEach/Map/Parallel) 본문에 블로킹 노드를 둘 수 없으므로 `frames` 는 항상 **선형**이다(분기나 반복 회차 상태가 없다). 금지 규칙은 [컨테이너 실행](CLE-EXEC-CONTAINER.md) 에 있다. 깊이는 `recursionDepth` 한도 안이다. `resume_call_stack IS NULL`(최상위 park, park 한 적 없는 실행, 배포 이전 행)이면 단일 수준 절차로 재개한다.

`exec-park D6` 라는 이름은 `exec-park-durable-resume` plan 의 결정 D6(중첩 호출 스택 영속)이다. AI 노드 문서의 같은 이름 `D6`(AI 노드 출력 경로 단일화)와 관계없다.

### 재개 진입 원자 claim

- BullMQ jobId 가 멱등 키다. 같은 jobId 의 중복 처리는 BullMQ 가 막는다.
- 워커는 처리 전에 재개 진입을 **DB 원자 claim** 으로 얻는다. 대상 행을 `waiting_for_input` 조건으로 `running` 으로 바꾸는 단일 UPDATE(`… WHERE status='waiting_for_input' RETURNING`)를 실행한다. **affected=1** 인 워커만 재개한다. **affected=0**(다른 워커가 이미 얻었거나 끝남)이면 바로 ack 하고 버린다.
- 이 claim 은 BullMQ 멱등성을 보완해 **정상 경로의 race 까지 기계적으로 막는다.** 비원자 SELECT 재확인과 달리 확인과 실행 사이 틈이 없다. 그래서 여러 인스턴스(인스턴스마다 동시성 1이어도 인스턴스끼리는 병렬)와 재개 큐 동시성 상향 양쪽에서 "같은 턴 이중 실행 0" 불변식이 유지된다.
- `waiting_for_input → running` 전이는 실행과 짝 노드 실행을 **단일 트랜잭션**으로 바꾼다. 원자성 규칙은 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) 에 있다.
- claim 을 얻은 **뒤**의 실패는 두 가지로 나뉜다.
  - **rehydration 과정 실패**(체크포인트 없음·손상, 시도 소진 등): [rehydration 실패](#rehydration-실패) 의 `RESUME_*` 종결(실행 `cancelled` + 노드 실행 `failed`)로 원자 마감한다.
  - **턴 처리 실패**(재개한 턴의 LLM throw: 429, timeout, connection): 노드 실행을 `running → failed` 로 끝낸다. claim 으로 이미 `running` 이므로 직접 `waiting_for_input → failed` 가 아니다.
- 두 경우 모두 `running` 을 남기지 않는다. claim 뒤 워커 크래시로 예외적으로 남은 `running` 은 부팅 복구 스캔이 회수한다. 실행이 아직 `running` 이면 (a) 단계가 re-claim 해 case B 로 재구동하고 옛 노드 실행 행을 마감한다. 실행이 이미 종결됐으면 (d) 단계가 노드 실행 행을 `failed` 로 닫는다. 정상 흐름에서는 claim 바로 뒤에 rehydration 이 이어지므로 30분 stale 창에 노출되는 것은 비정상 경우뿐이다.
- **case B 원자 re-claim**: 크래시 재구동은 대상이 이미 `running` 이므로 부팅 복구 스캔이 **`running → running` `started_at` 조건부 re-claim**([부팅 복구 스캔으로 재구동](CLE-EXEC-RECOVERY-REDRIVE.md#부팅-복구-스캔으로-재구동) 의 UPDATE)으로 소유권을 얻는다. 두 인스턴스(예: 늦은 부팅 스캔이 전역 lock 만료와 겹침)가 같은 stale 행을 동시에 잡아도 affected=1 인 쪽만 재구동한다. 상태 값이 아니라 소유권(`started_at`)이 옮겨 가는 것이라 상태 전이표는 바뀌지 않는다. claim 뒤 재구동 실패는 case A 와 같이 `RESUME_*` 종결로 원자 마감한다(**claim 뒤 `running` 잔류 금지**). 남은 한계는 [남은 zombie race](CLE-EXEC-RECOVERY-REDRIVE.md#남은-zombie-race) 에 있다.
- 재개 큐 작업 옵션(`removeOnComplete: true`, `removeOnFail: false`, `attempts: RESUME_BULLMQ_ATTEMPTS`)과 DLQ 처리는 [큐 워커와 동시 실행 제한](CLE-EXEC-WORKER.md) 에 있다. 모든 시도가 실패하면 실행을 `cancelled` + `error.code='RESUME_FAILED'` 로 표시한다. 실패 작업을 남기므로 DLQ 적재량을 관측할 수 있다.

### rehydration 실패

재개 진입 claim 을 얻은 **뒤** 아래 실패가 나면 `running` 으로 둔 상태를 그대로 두지 않는다. 반드시 `RESUME_*` 종결(실행 `cancelled` + 노드 실행 `failed`)로 원자 마감한다. 빠뜨리면 실행이 `running` 에 묶인다. 턴 처리 자체의 LLM throw 는 따로 `running → failed` 로 끝낸다.

| 경우 | 처리 |
| --- | --- |
| `NodeExecution.outputData` 가 없거나 손상 | 실행 `cancelled` + `error.code='RESUME_CHECKPOINT_MISSING'`, 짝 노드 실행 `failed` |
| 중첩 재개의 호출 스택이 손상: frame 목록이 비었거나 frame 의 `workflowId` · `invokerNodeId` 가 비었거나 그 호출 노드 또는 그 frame 에서 재개를 시작할 노드(가장 안쪽은 입력 대기 노드, 바깥은 호출 노드)가 그래프에 없음 | 실행 `cancelled` + `error.code='RESUME_CHECKPOINT_MISSING'`, 짝 노드 실행 `failed` |
| BullMQ 시도 소진 | 실행 `cancelled` + `error.code='RESUME_FAILED'`, 짝 노드 실행 `failed` |
| 멀티턴 AI 노드의 AI 재개 체크포인트가 **없음**(이 기능 배포 전에 들어간 입력 대기 행), **손상**(schema drift 로 `buildRetryReentryState` 재구성 실패), **미래 버전**(`schemaVersion` 이 현재 코드 `CHECKPOINT_SCHEMA_VERSION` 보다 큼, 롤링 배포 중 옛 인스턴스가 새 형식을 가져감) | 실행 `cancelled` + `error.code='RESUME_INCOMPATIBLE_STATE'`, 짝 노드 실행 `failed`. 체크포인트가 있고 버전이 맞으면 재구성에 성공해 재개하며 이 에러는 나지 않는다. |

- 표의 경우는 모두 워커 쪽 **비동기**(enqueue 뒤) 실패다. 동기 ack 가 아니라 뒤따르는 `execution.cancelled` 이벤트(`error.code = RESUME_*`)로 사용자에게 알린다. 동기 ack 에 실리는 실패는 세 가지다. 발행 전 사전 검증의 거부(`INVALID_EXECUTION_STATE`), 발행 경로의 에러, 재개 큐 적재 실패다. 진입점마다의 응답은 [큐 워커와 동시 실행 제한 「발행 결과와 ack 에러 표면」](CLE-EXEC-WORKER.md#발행-결과와-ack-에러-표면) 에 있다.
- 중첩 재개의 호출 스택은 두 코드가 나눠 맡는다. 버전이 지원 범위보다 크면 `RESUME_INCOMPATIBLE_STATE`([중첩 재개](#중첩-서브-워크플로우-재개) 1단계), 값이 비었거나 가리키는 노드가 없으면 `RESUME_CHECKPOINT_MISSING` 이다.
- 채팅 채널 어댑터는 세 코드 모두(`RESUME_*` 접두 코드 전부) raw 에러 대신 대화 세션 만료 안내(`sessionExpired`)를 보낸다. 사용자의 다음 메시지는 새 대화로 시작한다(텔레그램 등). 렌더 매핑은 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) 이 정한다.
- **채널 전달의 선행 조건**: `RESUME_*` 안내가 외부 채널(텔레그램 등)에 실제로 닿으려면 재개 절차 3단계(routing context 재등록)가 먼저 돼 있어야 한다. 재개는 다른 프로세스나 재시작 뒤의 워커가 가져가므로 routing context 가 사라진 상태다. 재등록 없이 `cancelled` 이벤트를 발행하면 conversationKey 가 없어 채널 dispatcher 가 outbound 를 건너뛴다.

### 재시도 층의 합산

- 재개 큐의 `attempts: 3` 은 **큐 전달 층**의 재시도다. 핸들러를 부르기 직전 단계의 인프라 재시도다.
- AI 핸들러의 재시도(예: 2회)는 **핸들러 안 LLM 호출 층**의 재시도다. 두 층은 따로 적용된다. 노드 재시도 규칙은 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 에 있다.
- **최악의 경우**: 재개 큐가 시도마다 다른 인스턴스로 배달하고 그 인스턴스가 LLM 호출 단계에서 죽으면 큐 3회 × LLM 2회 = 최대 6회 LLM 호출이 생길 수 있다. `NodeExecution.status` 확인이 결과 중복 저장을 막지만 **호출 비용은 생긴다.**
- 운영 관측: 재개 큐 DLQ 적재량이 임계를 넘으면 경고 로그를 남긴다. 임계는 재시도 비율이 아니라 DLQ(`failed`) 작업 건수다(`CONTINUATION_DLQ_ALARM_THRESHOLD`, 기본 50). 주기와 나머지 설정은 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 의 DLQ 모니터가 정한다.
- **AI 대화 노드의 비용**: rehydration 자체는 LLM 을 부르지 않는다. 사용자 메시지가 도착한 뒤 다음 턴부터 LLM 을 부른다. BullMQ 재시도가 메시지를 중복 배달해도 위 [멱등성 계약](#멱등성-계약) 의 확인이 LLM 중복 호출을 막는다. 핸들러 실행 중 워커가 죽는 경우는 위 최악의 경우에 해당한다.

## Rationale

### 재개 진입을 DB 원자 claim 으로 (2026-07-02)

옛 재확인 가드는 비원자 SELECT 로 확인한 뒤 실행하는 방식이라 여러 인스턴스와 재개 큐 동시성 상향에서 "같은 턴 이중 실행 0" 불변식을 **기계적으로 보장하지 못했다.** 확인과 실행 사이 틈에 두 워커가 함께 통과할 수 있었다. 재개 **진입**을 조건부 원자 UPDATE(affected=0 → ack 후 버림)로 막아 이 틈을 닫는다.

- **`running` 을 거치는 두 단계 전이를 기각했던 결정과의 관계**: [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) 의 "`waiting_for_input → failed` 전이 추가" 결정은 AI 턴 실패 마감에서 `running` 을 거치는 방식을 "쓸모없는 복잡성 + 두 트랜잭션 분리로 원자성 약화" 라며 기각했다. 그때는 `running` 을 거칠 **이득이 전혀 없었다.** 이 결정은 그 경유에 **새 이득**을 준다. 재개 진입의 동시성 race 안전이다.
- **원자성 우려에 대한 답**: claim 은 **단일 조건부 UPDATE** 다(두 트랜잭션 분리가 아니다). claim 뒤 실패와 크래시로 남은 `running` 의 처리는 본문 [재개 진입 원자 claim](#재개-진입-원자-claim) 과 같다.
- **결과**: 재개한 턴의 LLM throw 는 claim 뒤 `running → failed` 로 끝낸다. 옛 "직접 `waiting_for_input → failed`" 를 **재개 경로에 한해** 부분 수정한 것이다. claim 이 끼지 않는 마감 서술은 바뀌지 않는다.
- **기존 방식의 일반화**: 낙관적 claim 은 `_retryState` 소비("affected=1 인 쪽만 진행")에서 이미 쓰는 방식을 넓힌 것이지 새 동시성 프레임워크가 아니다. 동시성 1 전제를 유지하는 대안은 불변식을 운영 구성(단일 인스턴스)에 기대게 만든다. 동시성을 올릴 때 결국 이 변경이 필요해 비용만 뒤로 밀리므로 기각했다.
- **구현**: 재개 진입 claim 은 affected 기반 race 판정이 필요해 `updateExecutionStatus`/`assertTransition` choke point 를 **거치지 않는** raw 조건부 UPDATE 로 실행과 노드 실행을 `waiting_for_input → running` 짝 전이한다. `ALLOWED_TRANSITIONS` 는 실행 전용이고 `waiting_for_input → running` 은 이미 표에 있다. 새 전이를 더한 것이 아니라 claim 이 그 전이를 조건부·원자로 하는 것이다. 실행 짝 UPDATE 가 종료 상태(동시 취소 등) 때문에 affected=0 이면 노드 claim 도 트랜잭션을 롤백해 버린다.
- **착수 조건**: 같은 (executionId, nodeExecutionId) 를 동시에 두 번 재개하면 한쪽만 진행하는 unit 테스트와, form park 에 재개 작업 2건을 인위로 넣고 턴 이중 실행 0 을 확인하는 dockerized e2e. 사용자 승인 2026-07-02(Option A).

### 마지막 턴 재시도에도 원자 claim 을 둔다 (2026-07-28)

재개 claim 은 `waiting_for_input → running` 조건부 전이로 race 를 판정하지만 마지막 턴 재시도(`retry_last_turn`)는 대상이 이미 `running` 인 새 행이라 그 전이가 성립하지 않는다. 그래서 `applyRetryLastTurn` 이 새 행의 `inputData._retryState` 키를 조건부 UPDATE 로 원자 소비하는 배달 단위 claim 을 따로 둔다. 결정 경위, 대가(크래시 재배달 차단과 남는 `running` 행), 열린 범위는 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) Rationale 의 "마지막 턴 재시도에 배달 단위 claim 을 둔다" 에 있다.

2026-11-12 갱신: 남는 `running` 행과 열린 범위(claim 과 턴 진입 사이의 일반 예외)는 부팅 복구 스캔의 (d) 단계가 닫는다([종결된 실행 아래 남은 running 노드 행은 부팅 스캔이 닫는다](CLE-EXEC-RECOVERY-REDRIVE.md#종결된-실행-아래-남은-running-노드-행은-부팅-스캔이-닫는다-2026-11-12-cle-t-cceqec)).

### park 즉시 해제와 rehydration 단일 경로 (Phase B)

**배경, 코루틴이 쌓이는 위험**: 초기 모델은 park 뒤 `runExecution` 코루틴을 in-process 로 **살려 두고**(detached 코루틴 + `firstSegmentBarriers` 단발 배리어) 같은 인스턴스 재개는 메모리 `pendingContinuations` resolve 빠른 경로, 그 밖은 rehydration 느린 경로로 **나뉘어** 있었다. 사용자 입력 시점을 알 수 없어 **응답 없는 park 실행의 코루틴과 컨텍스트가 메모리에 끝없이 쌓이는** 운영 위험이 있었다.

**결정, park = 세그먼트 종료, 모든 재개 = rehydration**: park 때 영속한 뒤 `runExecution` 세그먼트를 **바로 반환하고 풀어 준다.** in-process resolver 가 없으므로 **모든 재개가 rehydration 한 경로**다. 효과는 두 가지다. (a) **메모리가 제한된다**: park 수와 관계없이 코루틴과 컨텍스트가 메모리를 쓰지 않는다. (b) **재개 경로가 하나다**: 빠른 경로와 느린 경로의 이원화를 없애 추론, 테스트, 운영이 단순해지고 여러 인스턴스·재시작·스케일 아웃에 똑같이 동작한다.

- **B1 과 B2 는 나눌 수 없다**: "코루틴 해제"(B1)는 park 에서 `await` 를 없애는 것이다. 그러면 코루틴을 깨울 메모리 resolve 가 사라져 "모든 재개 = rehydration"(B2)이 **강제된다.** `firstSegmentBarriers` / `armFirstSegmentBarrier` / `settleFirstSegment` / `signalParkBarrier` 와 `pendingContinuations` Map(워커 쪽 빠른 경로)은 필요 없어져 제거됐다(B3).
- **워커 쪽과 발행 쪽은 다르다**: [안전 종료와 영속 재개 큐](CLE-EXEC-RECOVERY-SHUTDOWN.md#영속-재개-큐와-안전-종료-durable-continuation) 의 sticky fast-path 제거는 **발행 쪽**("내 인스턴스에 키가 있으면 큐를 건너뜀")을 없앴다. 이 결정은 그 **워커 쪽** 짝(작업을 가져간 뒤 로컬 Map 에 키가 있으면 바로 resolve)을 마저 없애 "항상 rehydration" 을 완성한다.
- **손실 없는 재개의 전제, 영속(Phase A)**: 대화 스레드(`Execution.conversation_thread` V084, A1), 멀티턴 AI 재개 체크포인트(A2a, 정보 추출기 노드 A2b), 사용자 정의 변수(`Execution.user_variables` V085, A3)가 먼저 영속됐다. 그래서 모든 재개를 rehydration 으로 돌려도 상태를 잃지 않는다.
- **D4, 멀티턴은 턴 단위로 park 한다**: `runAiConversationLoop` 의 오래 도는 반복문을 **턴마다 입력 대기에서 풀어 준다.** 한 턴 처리가 한 세그먼트이고 다음 메시지가 오면 rehydration 으로 재개한다. 응답 없는 대화도 메모리를 쓰지 않는다. 기각한 대안("대화 전체를 한 입력 대기로 두고 코루틴 누적을 받아들임")은 메모리 제한 목표와 정면으로 부딪친다. 턴마다 rehydration 비용은 사람 속도라 받아들인다.
- **D3, 턴마다 새 설정**: 매 턴 rehydration 이 `node.config` 를 새로 유도하므로 park 중 편집이 다음 턴부터 반영된다. 결정과 기각한 대안은 [실행 컨텍스트](CLE-EXEC-CONTEXT.md) Rationale 의 "멀티턴 설정은 턴마다 새로 만든다 (D3)" 에 있다.
- **불변식은 유지된다**: 같은 턴 이중 실행 0(영속된 `WAITING_FOR_INPUT` + 재개 진입 **DB 원자 claim**, 비원자 재확인 가드를 대체), 재개 명령 유실 0(영속 재개 큐), 멱등(jobId). park → 워커 종료 → 손실 없는 재개는 dockerized e2e 회귀 테스트로 보증한다.
- **단계 적용(B1 → B2a → B2b, 2026-06-05/06, 완료)**: park 지점 단위로 "해제와 느린 경로를 함께" 적용했다. B1 은 form·button(`waitForFormSubmission` / `waitForButtonInteraction`), B2a 는 최상위 멀티턴 AI(`waitForAiConversation('release')` 첫 턴 park + `processAiResumeTurn` 재개 턴 처리와 재-park), B2b 는 중첩 `executeInline` 블로킹의 영속(아래 D6)과 메모리 머신 완전 제거(`pendingContinuations`, `firstSegmentBarriers` 일가, `firePayload` scheduler, `runAiConversationLoop`, detached)를 맡았다. 응답 없는 park 누적 차단이라는 핵심 이득은 단발 park 와 최상위 멀티턴이 대부분인 HITL 패턴에서 B1 + B2a 로 대부분 얻었고 B2b 가 중첩까지 넓혔다.
- **재개 turn 분기와 park 진입 분기의 registry 추출**: form·buttons·ai 분기를 순서 있는 registry 와 단일 진입점(`dispatchResumeTurn`·`dispatchParkEntry`)으로 뽑은 동작 보존 리팩터링이다. 결정은 [실행 엔진 개요와 그래프 순회](CLE-EXEC-ENGINE.md) Rationale 의 "입력 대기 분기를 registry 로 모은다 (#507, M-4)" 에 있다.
- **`runNodeDispatchLoop` 반환 계약**: park 로 끝났는지를 `{ parked: boolean }` 으로 돌려준다. 계약과 경위는 [실행 엔진 개요와 그래프 순회](CLE-EXEC-ENGINE.md) 에 있다.
- **exec-park D6, 중첩 서브 워크플로우 블로킹 영속(2026-06-06, 사용자 결정 "호출 스택 영속 정공법")**: 중첩 서브 워크플로우(`executeInline`) 안의 블로킹 노드도 park 해제 + rehydration 으로 모아 **메모리 의존을 완전히 없앴다.** 빠진 조각은 **호출 체인 구조뿐**이었다. 노드 출력은 같은 executionId 타임라인으로, 대화 스레드·변수는 V084/V085 로 DB 에 남는다. 그래서 새 `Execution.resume_call_stack jsonb`(V087)로 호출 체인을 영속하고 frame 단위로 재진입한다.
  - **선형 스택으로 충분한 이유**: 본문 「선형 스택 불변식」과 같다.
  - **`_continuationCheckpoint` 컬럼 기각과 다른 범주**: 저장 전략이 기각한 `_continuationCheckpoint` 는 재개 명령을 *운반*하는 컬럼이었다(운반은 영속 재개 큐가 맡는다). `resume_call_stack` 은 **park 시점의 중첩 실행 위치**(호출 체인)를 남긴다. 목적이 달라 그 기각을 뒤집은 것이 아니다.
  - **노드 단위 큐 기각과 다른 범주**: 기각된 것은 *모든 노드*를 워커로 나누는(노드마다 컨텍스트 전체를 직렬화하는) 노드 단위 큐다. D6 는 **park 지점에서만** 직렬화하는 "입력 대기 뒤 재개" 의 중첩 확장이다. 한 세그먼트 = 한 프로세스가 호출 스택을 **재귀 in-process** 로 구동하는 전제를 유지한다.
  - **함께 고친 틈**: 예전 `driveResumeAwaited` 는 `executeInline` 스택에 다시 들어가지 않아 중첩 블로킹은 재시작 뒤 재개할 수 없었다(같은 인스턴스 메모리 한정). D6 가 이 틈도 닫았다.
  - **직접 구동과 `executeInline` 재호출(W2)**: 가장 안쪽 frame 부터 직접 구동하는 이유다. `executeInline` 재호출은 frame 마다 `_callStack` push/pop, 서브 워크플로우 DB 조회, 재귀 깊이 증가 같은 초기화 비용이 들고 재진입 시점의 호출 스택 상태가 영속 스냅샷과 어긋나는 재진입 위험(중첩 park 스냅샷 시점 race)도 있다. `driveResumeFrame` 은 이미 rehydrate 된 컨텍스트와 영속된 frame 정보로 그래프만 진행하므로 더 안전하고 단순하다.

### rehydration 실패의 종결 상태는 실행 `cancelled`, 노드 실행 `failed`

rehydration 실패 3종(`RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE`)은 인프라 실패라 실행을 `cancelled` 로, 정상 완료하지 못한 짝 노드 실행을 `failed` 로 끝낸다. 상태 분류의 결정 근거와 기각한 대안은 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) Rationale 의 "rehydration 실패의 종결 상태를 실행 `cancelled`, 노드 실행 `failed` 로 나눈다" 에 있다.

### 호출 스택 frame 결손도 `RESUME_CHECKPOINT_MISSING` 으로 마감한다 (2026-10-04)

엔진은 빈 frame 목록, 호출 노드 부재, frame 에서 재개를 시작할 노드의 부재에 이미 이 코드를 냈다. frame 의 `workflowId` · `invokerNodeId` 결손은 확인하지 않았다. TypeORM 1 이 where 의 undefined 를 예외로 막은 뒤로 그 경우는 일반 실패 경로(실행 `failed`)로 끝났다. 그래서 재개 진입 claim 뒤, 조회 전에 확인해 [rehydration 실패](#rehydration-실패) 로 옮겼다.

- **새 코드를 만들지 않았다**: 네 경우 모두 park 때 커밋한 영속 컨텍스트([체크포인트](#체크포인트))가 깨져 재구동할 수 없다는 같은 뜻이다. 종결과 채팅 채널 처리도 같다. [에러 코드 규약](../CLE-API/CLE-API-ERRCODES.md) 규칙 6 과의 관계는 그 문서 Rationale 에 적었다.

## 구현 위치

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`rehydrateContext`, `driveCallStackResume`)
- `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` (재개 큐 소비자, 취소 경로)
- `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts` (재개 turn 분기)
- `codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts` (park 진입 분기)
- `codebase/backend/src/modules/execution-engine/call-stack-frame.ts` (`findBrokenCallStackFrame`, 중첩 재개 frame 확인)
- `codebase/backend/src/shared/execution-resume/**` (`ProcessTurnResult` 등 재개 공용 타입)
