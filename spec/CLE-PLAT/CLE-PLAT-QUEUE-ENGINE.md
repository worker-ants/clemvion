---
id: "CLE-PLAT-QUEUE-ENGINE"
title: "비동기 큐 — 실행 엔진 큐 옵션과 DLQ 모니터링"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-PLAT-QUEUE"
ancestors: ["CLE-VISION", "CLE-PLAT", "CLE-PLAT-QUEUE"]
area: "CLE-PLAT"
content_hash: "cd01babb81c6cca286854cc39cba5d61289af50e127cda85dd8fe0c49a6c45d6"
read_as: "approved_fallback"
task: "CLE-T-28MDF3"
source_paths: []
mirror_sha256: "3b6949ed598ea1c3de4f98cfec8829a99f9bb92f19a2277f569302536891f325"
etag: "sha256-30c4375f43121949299cec4db373be4c9fe8795c2f0d84205321ff203b6892ab"
---
> 구현 상태: 구현됨 · 상위: [비동기 큐와 Redis 키 목록](CLE-PLAT-QUEUE.md) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 [비동기 큐와 Redis 키 목록](CLE-PLAT-QUEUE.md) 의 하위 문서로 실행 엔진 큐 세 개(`execution-run` · `execution-continuation` · `background-execution`)의 재시도 · 작업 옵션과 DLQ 모니터링을 정한다. 전체 큐 목록은 상위 문서의 [BullMQ 큐 목록](CLE-PLAT-QUEUE.md#bullmq-큐-목록) 이 기준이다. 큐마다 누가 넣고 누가 꺼내는지도 그 표에 있다.

## 실행 엔진 큐의 옵션

아래 표는 요약이다. 시작 큐·재개 큐의 계약(jobId, attempts, 작업 옵션)은 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 이 기준이다.

시작 큐와 재개 큐가 함께 실행 세그먼트를 운반한다. 입력 대기(`waiting_for_input`)는 두 세그먼트 사이에 큐 없이 DB 에만 남는 park 다. 한 세그먼트 안의 노드는 `runExecution` 의 같은 프로세스 반복문이 부른다. 노드 단위 작업 큐(`task-queue`)는 없다.

| 큐 | 역할 | 재시도 | 비고 |
| --- | --- | --- | --- |
| `execution-run` | 실행 시작. 첫 세그먼트를 워커에 work-stealing 으로 나눈다 | `attempts:1`, `maxStalledCount:1`, `stalledInterval:30초`. 워커가 죽으면 세그먼트를 한 번 더 배달하고, 멱등 rehydration 으로 다시 구동한다. 다 쓰면 `WORKER_HEARTBEAT_TIMEOUT` 으로 끝난다. 부팅 때 도는 `recoverStuckExecutions` 도 함께 있다 | `execute()` 의 같은 프로세스 비동기 호출을 대체했다. `removeOnComplete:true`, `removeOnFail:false`. **jobId = executionId** 로 실행 1건에 작업 1개를 넣는다. stalled 재배달은 같은 jobId 를 다시 처리하므로 다시 넣지 않고 순번도 쓰지 않는다. 작업 우선순위는 수동 실행(1) > 웹훅(2) > 스케줄(3) 이다(`ExecuteOptions.triggerType`, `executedBy` 가 있으면 수동 우선). 관측: `ExecutionRunDlqMonitorService`. 우선순위와 재배달의 세부는 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 과 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `execution-continuation` | 사용자 입력 전달과 AI 에이전트 마지막 턴 재시도의 재진입. 매 재개 세그먼트 | `RESUME_BULLMQ_ATTEMPTS` (기본 3) | 옛 Redis pub/sub 채널 `execution:continuation` 을 대체했다. 메시지 타입 6종: `continue` · `cancel` · `button_click` · `ai_message` · `ai_end_conversation` · `retry_last_turn`. 마지막 `retry_last_turn` 만 입력 대기 행이 아니라 새로 만든 실행 중(`running`) 행을 대상으로 한다([실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md)) |
| `background-execution` | Background 노드 본문 실행 | 코드 기본값(현재 `BACKGROUND_EXECUTION_QUEUE_DEFAULT_OPTS`) | [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md) |

## DLQ 모니터링

재개 큐는 `removeOnFail: false` 로 운영한다. 그래서 재시도(`RESUME_BULLMQ_ATTEMPTS`)를 다 쓴 작업이 `failed` 상태, 곧 DLQ 로 쌓인다. rehydration 이 구조적으로 실패하는 회귀는 DLQ 깊이 급증으로 나타난다. 배포 뒤 `_resumeCheckpoint` 스키마가 어긋나 `buildRetryReentryState` 재구성이 실패하거나 체크포인트가 손상된 경우가 그 예다. 그래서 다음을 둔다.

- **`ContinuationDlqMonitorService`**: DLQ 깊이(`failed`)와 재시도 적체(`delayed`)를 주기적으로 조회한다. 임계를 넘으면 구조화된 `logger.error` 경고를 cooldown 당 1회 남긴다. 임계 초과 경고는 로그 기반을 유지한다. 큐 깊이(waiting·active·delayed·failed)는 `registerQueueDepthProvider` 로 `clemvion.queue.depth` ObservableGauge 에도 노출한다([비기능 요구사항 「관측성」](CLE-PLAT-NFR.md#관측성) REQ-NFR-036). 관측(gauge)과 능동 통지(경고)를 나눈다.
- **`ExecutionRunDlqMonitorService`**: 시작 큐에 대한 같은 모니터다. 환경 변수 `EXECUTION_RUN_DLQ_*` 를 주입받아 임계·주기·cooldown 을 정한다(서비스가 `process.env` 를 직접 읽지 않는다). stalled 재배달을 다 써서(`WORKER_HEARTBEAT_TIMEOUT`) DLQ 로 쌓이는 작업을 본다.
- **워커 `onFailed`**(`@OnWorkerEvent('failed')`): 실패 1건마다 `RETRY`(재시도 남음) 또는 `DEAD-LETTER`(재시도 소진) 태그와 시도 횟수를 로그에 남긴다.

경고를 OTel 메트릭이 아니라 로그로 남기는 결정의 근거는 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 의 Rationale «DLQ 경고는 로그로 남긴다» 에 있다.

| 환경 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `CONTINUATION_DLQ_ALARM_THRESHOLD` | `50` | 재개 큐 DLQ(`failed`) 작업 수 경고 임계 |
| `CONTINUATION_DLQ_MONITOR_INTERVAL_MS` | `60000` | 깊이 조회 주기 |
| `CONTINUATION_DLQ_ALARM_COOLDOWN_MS` | `300000` | 경고 재발 최소 간격 |
| `CONTINUATION_DLQ_MONITOR_ENABLED` | `true` | `'false'` 면 모니터를 끈다 |
| `EXECUTION_RUN_DLQ_ALARM_THRESHOLD` | `20` | 시작 큐 DLQ(`failed`) 작업 수 경고 임계 |
| `EXECUTION_RUN_DLQ_MONITOR_INTERVAL_MS` | `60000` | 시작 큐 깊이 조회 주기 |
| `EXECUTION_RUN_DLQ_ALARM_COOLDOWN_MS` | `300000` | 시작 큐 경고 재발 최소 간격 |
| `EXECUTION_RUN_DLQ_MONITOR_ENABLED` | `true` | `'false'` 면 시작 큐 모니터를 끈다 |

## 구현 위치

- `codebase/backend/src/modules/execution-engine/**/*.ts`

## Rationale

### DLQ 경고를 로그 기반으로 둔 이유

DLQ 임계 초과 경고는 구조화 로그로 남기고, 큐 깊이는 OTel gauge 로 따로 노출한다. 관측과 능동 통지를 나눈 것이다. 결정의 근거는 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 의 Rationale «DLQ 경고는 로그로 남긴다» 에 있다.

### 하위 문서로 나눈 이유

결정일: 2026-11-20

NERV Task `CLE-T-28MDF3`. 상위 문서 [비동기 큐와 Redis 키 목록](CLE-PLAT-QUEUE.md) 의 본문이 한도(20,000자)에 거의 찼다. 큐를 하나 더할 때마다 상위 문서의 큐 표에 한 줄이 늘어난다. 그래서 다른 문서가 절 링크로 가리키지 않는 엔진 큐 옵션 절과 DLQ 모니터링 절을 이 문서로 옮겼다. 다른 문서가 절 링크로 가리키는 Redis 키 절은 링크가 깨지지 않게 상위 문서에 남겼다. 옮긴 절의 문장은 바꾸지 않았다.
