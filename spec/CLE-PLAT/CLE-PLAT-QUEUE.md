---
id: "CLE-PLAT-QUEUE"
title: "비동기 큐와 Redis 키 목록"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-PLAT"
ancestors: ["CLE-VISION", "CLE-PLAT"]
area: "CLE-PLAT"
content_hash: "903b0d3315d4f62dd36ba03d7be9227f03c7565fc8675238663aa56b840d8cde"
read_as: "approved_fallback"
task: "CLE-T-V22XN8"
source_paths: ["spec/5-system/4-execution-engine.md", "spec/conventions/redis-keys.md", "spec/data-flow/0-overview.md"]
mirror_sha256: "358809ef7442a62e38a44f97cbf48a418c0339c2a8e3ca4694bfc51f15f11078"
etag: "sha256-14f377c419556fff37cef1ccf5706a97aedb964fb86daa04b24ad0f5e7857f2c"
---
> 구현 상태: 구현됨 · 원문: `spec/data-flow/0-overview.md` (§4 BullMQ 큐 카탈로그), `spec/5-system/4-execution-engine.md` (§9 Redis 키 네이밍 컨벤션: §9.1~§9.3, Dead-letter 모니터링), `spec/conventions/redis-keys.md` (§3 전역 인벤토리) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 Clemvion 이 쓰는 BullMQ 큐와 Redis 키의 단일 기준 목록이다. 큐마다 누가 넣고 누가 꺼내며 작업 하나가 무엇인지, Redis 키마다 어느 모듈이 무엇에 쓰는지를 적는다.

- 큐를 더하거나 빼면 먼저 이 문서의 [BullMQ 큐 목록](#bullmq-큐-목록) 을 고친다. 그다음 그 큐를 쓰는 영역 데이터 문서의 외부 의존 절과 코드의 큐 모니터링 레지스트리(`MONITORED_QUEUES`, `codebase/backend/src/modules/system-status/system-status.constants.ts`)를 맞춘다.
- Redis 키나 pub/sub 채널을 새로 만들면 [Redis 키 목록](#redis-키-목록) 에 한 줄을 더한다. 키 이름의 형태 규칙과 등재 의무는 [Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md) 이 정한다.

범위 밖: 큐를 쓰는 동작 자체는 각 큐의 상세 문서가 정한다. 시스템 상태 화면의 큐 그룹·동시 처리 수·건강도 판정은 [시스템 상태](../CLE-OBS/CLE-OBS-STATUS.md) 가 정한다. 큐와 Redis 가 전체 구성에서 차지하는 자리는 [시스템 아키텍처](CLE-PLAT-ARCH.md) 에 있다.

## BullMQ 큐 목록

현재 등록된 BullMQ 큐는 18개다. "반복 작업" 은 BullMQ job scheduler(`upsertJobScheduler`)로 주기 실행하는 내부 작업이다. 사용자가 만드는 스케줄과 다르다.

| 큐 | 등록 모듈 | 생산자 | 소비자 | 작업 단위 | 상세 |
| --- | --- | --- | --- | --- | --- |
| `execution-run` | `execution-engine.module.ts` | `ExecutionEngineService.execute` (실행 행을 `pending` 으로 저장한 뒤 넣는다) | `ExecutionRunProcessor` (work-stealing, `runExecutionFromQueue`) | 실행의 첫 세그먼트(시작부터 첫 입력 대기나 종료까지). 시작 큐 | [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) |
| `execution-continuation` | `execution-engine.module.ts` | `ContinuationBusService.publish` (WebSocket 게이트웨이·REST 컨트롤러 경유) | `ContinuationExecutionProcessor` | 사용자 입력(폼·버튼·AI 메시지)으로 이어지는 재개 세그먼트. 재개 큐 | [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) · [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) |
| `background-execution` | `execution-engine.module.ts` | `ExecutionEngineService.scheduleBackgroundBody` | `BackgroundExecutionProcessor` | Background 노드의 본문 흐름 | [Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) |
| `document-embedding` | `knowledge-base.module.ts` | 지식 저장소 문서 업로드·재임베딩 API·실패 문서 재시도·부팅 시 처리 중 문서 회수 | `DocumentEmbeddingProcessor` (동시 처리 3) | 문서 1건 임베딩 | [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md). 생산자·소비자·payload 는 [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) |
| `graph-extraction` | `knowledge-base.module.ts` | 임베딩 완료 hook·재추출 API·실패 문서 재시도·부팅 시 처리 중 문서 회수 | `GraphExtractionProcessor` (동시 처리 2) | 문서 1건의 엔티티·관계 추출 | [Graph RAG](../CLE-KB/CLE-KB-GRAPH.md). 생산자·소비자·payload 는 [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) |
| `agent-memory-extraction` | `agent-memory.module.ts` | `AgentMemoryService.scheduleExtraction`. AI 에이전트·정보 추출기 노드의 `memoryStrategy: 'persistent'` 가 대화 턴 경계에서 비동기로 넣는다. 핫 경로를 막지 않고, 넣기 실패는 흡수한다 | `AgentMemoryExtractionProcessor` (동시 처리 2) | 대화 턴 1건의 메모리 추출. jobId 를 `agent-memory:<workspaceId>:<scopeKey>` 로 고정해 같은 범위의 추출을 직렬화한다. 고정 jobId 는 `removeOnComplete: true` 와 짝으로 둔다. payload 는 상세 문서에 있다 | [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md) |
| `schedule-execution` | `schedules.module.ts` | `ScheduleRunnerService` (스케줄마다 job scheduler 를 `upsertJobScheduler` 로 등록) | `ScheduleRunnerService` (`@Processor`) | 스케줄 1회 실행 트리거 | [스케줄](../CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| `alerts-evaluator` | `alerts.module.ts` | `AlertsEvaluatorService` (반복 작업 1개 `alerts-evaluator-5min`, 5분 주기 `*/5 * * * *` UTC) | 같은 서비스 | 작업 1회가 켜진(`enabled=true`) 알림 규칙 전체를 순회해 평가한다. 규칙마다 큐에 넣지 않는다 | [알림 §알림 규칙 평가](../CLE-OBS/CLE-OBS-NOTIFY.md#알림-규칙-평가) |
| `integration-expiry-scanner` | `integrations.module.ts` | `IntegrationExpiryScanner` (반복 작업 4종) | 같은 모듈의 처리기 | 작업 1회가 대상 통합 전체를 일괄 처리한다. `connected-expiry`·`pending-install-ttl`·`usage-log-prune` 은 매일 `0 0 * * *` UTC, `cafe24-background-refresh` 는 6시간마다 `0 */6 * * *` UTC | [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md) |
| `cafe24-token-refresh` | `integrations.module.ts` · `cafe24.module.ts` | 다섯 곳: `Cafe24ApiClient` 의 호출 직전 갱신과 401 뒤 갱신(직접 넣고 `QueueEvents` 로 완료를 기다린다), `IntegrationExpiryScanner` 의 `cafe24-background-refresh` 반복 작업과 `connected-expiry` 당일 분기, `Cafe24McpToolProvider` 의 `expired` 자가 회복 | `Cafe24TokenRefreshProcessor` | Cafe24 통합 1건 토큰 갱신. source 별 jobId 전략과 보존 옵션은 상세 문서의 갱신 큐 표가 기준이다 | [OAuth 연결과 토큰 갱신 §갱신 큐](../CLE-INT/CLE-INT-OAUTH.md#갱신-큐) |
| `makeshop-token-refresh` | `makeshop.module.ts` | 세 곳: `MakeshopApiClient` 의 호출 직전 갱신과 401 뒤 갱신, `MakeshopMcpToolProvider` 의 `refreshTokenViaQueue` (source `background` 자가 회복). 스캐너 반복 작업은 없다. 리프레시 토큰 수명은 30~90일이다 | `MakeshopTokenRefreshProcessor` | MakeShop 통합 1건 토큰 갱신. source 별 jobId 전략과 보존 옵션은 상세 문서의 갱신 큐 표가 기준이다 | [OAuth 연결과 토큰 갱신 §갱신 큐](../CLE-INT/CLE-INT-OAUTH.md#갱신-큐) · [MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md) |
| `notification-webhook` | `external-interaction.module.ts` | `NotificationDispatcher` | `NotificationWebhookProcessor` | EIA 알림 웹훅 1건 발송 | [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) |
| `login-history-pruner` | `auth.module.ts` | `LoginHistoryPrunerService` (매일 반복 작업, `0 3 * * *` Asia/Seoul) | 같은 서비스 (`@Processor`) | 180일 지난 로그인 이력 정리 | [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md) |
| `workspace-invitations-pruner` | `workspaces.module.ts` | `WorkspaceInvitationsPrunerService` (매일 반복 작업, `0 4 * * *` Asia/Seoul) | 같은 서비스 (`@Processor`) | 만료·미수락 초대 정리 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) |
| `chat-channel-token-rotator` | `triggers.module.ts` | `ChatChannelTokenRotatorService` (매시간 반복 작업) | 같은 서비스 (`@Processor`) | `chat_channel_token_v2` 의 24시간 유예 정리 | [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md) |
| `notification-secret-rotator` | `triggers.module.ts` | `NotificationSecretRotatorService` (매시간 반복 작업) | 같은 서비스 (`@Processor`) | `notification_secret_v2` 의 24시간 유예 뒤 승격 | [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) |
| `terminal-revoke-reconcile` | `external-interaction.module.ts` | `TerminalRevokeReconcilerService` (매분 반복 작업 `* * * * *`) | 같은 서비스 (`@Processor`, 동시 처리 1) | 종료된 실행에 남은 인터랙션 토큰을 훑어 폐기한다. 최소 1회 폐기를 보강한다(EIA-RL-06) | [External Interaction API](../CLE-IX/CLE-EIA.md) |
| `webchat-idle-reaper` | `external-interaction.module.ts` | `WebChatIdleReaperService` (매분 반복 작업 `* * * * *`) | 같은 서비스 (`@Processor`, 동시 처리 1) | 공개 위젯(`auth_config_id IS NULL`)의 익명 실행 단위 토큰이 모두 만료된 입력 대기 실행을 `cancelled`(`WEBCHAT_IDLE_TIMEOUT`)로 회수하고 토큰을 폐기한다. 버려진 위젯 세션의 마지막 안전장치다(EIA-RL-07) | [External Interaction API](../CLE-IX/CLE-EIA.md) |

모니터링 레지스트리 `MONITORED_QUEUES` 는 이 표를 기준으로 삼는다. 현재 구현은 레지스트리에 `agent-memory-extraction` 이 빠져 있다([시스템 상태](../CLE-OBS/CLE-OBS-STATUS.md)). BullMQ 가 안에서 만드는 Redis 키(`bull:<queue>:*`)는 라이브러리 표준이라 [Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md) 의 명명 규칙 밖이다.

### 실행 엔진 큐의 옵션

아래 표는 요약이다. 시작 큐·재개 큐의 계약(jobId, attempts, 작업 옵션)은 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 이 기준이다.

시작 큐와 재개 큐가 함께 실행 세그먼트를 운반한다. 입력 대기(`waiting_for_input`)는 두 세그먼트 사이에 큐 없이 DB 에만 남는 park 다. 한 세그먼트 안의 노드는 `runExecution` 의 같은 프로세스 반복문이 부른다. 노드 단위 작업 큐(`task-queue`)는 없다.

| 큐 | 역할 | 재시도 | 비고 |
| --- | --- | --- | --- |
| `execution-run` | 실행 시작. 첫 세그먼트를 워커에 work-stealing 으로 나눈다 | `attempts:1`, `maxStalledCount:1`, `stalledInterval:30초`. 워커가 죽으면 세그먼트를 한 번 더 배달하고, 멱등 rehydration 으로 다시 구동한다. 다 쓰면 `WORKER_HEARTBEAT_TIMEOUT` 으로 끝난다. 부팅 때 도는 `recoverStuckExecutions` 도 함께 있다 | `execute()` 의 같은 프로세스 비동기 호출을 대체했다. `removeOnComplete:true`, `removeOnFail:false`. **jobId = executionId** 로 실행 1건에 작업 1개를 넣는다. stalled 재배달은 같은 jobId 를 다시 처리하므로 다시 넣지 않고 순번도 쓰지 않는다. 작업 우선순위는 수동 실행(1) > 웹훅(2) > 스케줄(3) 이다(`ExecuteOptions.triggerType`, `executedBy` 가 있으면 수동 우선). 관측: `ExecutionRunDlqMonitorService`. 우선순위와 재배달의 세부는 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 과 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `execution-continuation` | 사용자 입력 전달과 AI 에이전트 마지막 턴 재시도의 재진입. 매 재개 세그먼트 | `RESUME_BULLMQ_ATTEMPTS` (기본 3) | 옛 Redis pub/sub 채널 `execution:continuation` 을 대체했다. 메시지 타입 6종: `continue` · `cancel` · `button_click` · `ai_message` · `ai_end_conversation` · `retry_last_turn`. 마지막 `retry_last_turn` 만 입력 대기 행이 아니라 새로 만든 실행 중(`running`) 행을 대상으로 한다([실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md)) |
| `background-execution` | Background 노드 본문 실행 | 코드 기본값(현재 `BACKGROUND_EXECUTION_QUEUE_DEFAULT_OPTS`) | [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md) |

### DLQ 모니터링

재개 큐는 `removeOnFail: false` 로 운영한다. 그래서 재시도(`RESUME_BULLMQ_ATTEMPTS`)를 다 쓴 작업이 `failed` 상태, 곧 DLQ 로 쌓인다. rehydration 이 구조적으로 실패하는 회귀는 DLQ 깊이 급증으로 나타난다. 배포 뒤 `_resumeCheckpoint` 스키마가 어긋나 `buildRetryReentryState` 재구성이 실패하거나 체크포인트가 손상된 경우가 그 예다. 그래서 다음을 둔다.

- **`ContinuationDlqMonitorService`**: DLQ 깊이(`failed`)와 재시도 적체(`delayed`)를 주기적으로 조회한다. 임계를 넘으면 구조화된 `logger.error` 경고를 cooldown 당 1회 남긴다. 임계 초과 경고는 로그 기반을 유지한다. 큐 깊이(waiting·active·delayed·failed)는 `registerQueueDepthProvider` 로 `clemvion.queue.depth` ObservableGauge 에도 노출한다(NF-OB-07, [비기능 요구사항](CLE-PLAT-NFR.md)). 관측(gauge)과 능동 통지(경고)를 나눈다.
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

## Redis 키 목록

지금 있는 Redis 키는 모두 워크스페이스 세그먼트가 없다. 실행 ID·트리거 ID 가 이미 전역에서 유일한 UUID 라 워크스페이스 세그먼트가 정보를 더하지 않는다. 키 형태 규칙과 워크스페이스 세그먼트를 넣는 조건은 [Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md) 이 정한다.

### 실행 엔진 키

실행 엔진과 WebSocket 모듈이 쓰는 키다. 이 표가 용도와 TTL 의 기준이다.

| 키 | 소유 모듈 | 용도 | TTL |
| --- | --- | --- | --- |
| `exec:recover:lock` | `modules/execution-engine` | 부팅 때 멈춘 실행 복구의 분산 잠금. 워크스페이스 단위가 아니라 전역이다. 인스턴스 하나만 복구 UPDATE 를 하게 한다([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)) | 60초 |
| `exec:cont:seq:<executionId>` | `modules/execution-engine` | 재개 발행의 단조 증가 순번(실행마다 Redis `INCR`). 재개 큐 작업 ID `${executionId}:${nodeExecutionId}:${seq}` 의 멱등 키다. 8바이트 미만. 매 발행(`nextSeq`)이 만료 시간을 갱신해 재개가 이어지는 동안 키가 남고, 실행이 끝나 발행이 멈추면 TTL 이 지나 사라진다. `INCR` 이 실패하면 임의 순번으로 대신하지 않고 `publish` 가 `null`(`queued:false`)을 돌려준다(fail-fast). 임의 순번은 멱등 키 계약을 어겨 작업 ID 중복 제거를 무력화한다 | `CONTINUATION_SEQ_TTL_SECONDS` (기본 86400초 = 24시간, 발행마다 갱신) |
| `exec:seq:<executionId>` | `modules/websocket` (`ExecutionSeqAllocator`). 접두는 `exec:` 지만 소유 모듈이 다르다 | 이벤트 순번(Redis `INCR`). WebSocket 이벤트 봉투의 `seq`, 외부 SSE `id:`, EIA 알림 웹훅 `seq` 가 함께 쓰는 실행별 단조 증가 카운터다([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)). `exec:cont:seq:` 와 네임스페이스를 나눈다. 발급마다 `INCR` 과 `EXPIRE` 를 한 파이프라인으로 보내 만료 시간을 갱신하고, 종료 이벤트를 보낸 뒤 가능하면 `DEL` 한다. Redis 를 쓸 수 없으면 인스턴스별 메모리 카운터로 강등한다. 이때 인스턴스를 넘는 단조 증가는 보장하지 않는다(받아들인 trade-off) | `EXECUTION_SEQ_TTL_SECONDS` (기본 86400초 = 24시간, 발급마다 갱신) |

**예약 키(지금은 쓰지 않음)**: `exec:run:seq:<executionId>` 는 시작 큐 작업의 단조 증가 순번으로 예약해 둔 이름이다. 지금 시작 큐는 **jobId = executionId** 를 그대로 쓰고, 워커 크래시 재개도 같은 jobId 를 다시 처리하는 BullMQ stalled 재배달이라 순번이 필요 없다. 순번 형식(`<executionId>:run:<seq>`)은 작업을 명시적으로 다시 넣는 변경이 들어올 때만 쓴다. 쓰게 되면 `exec:cont:seq` 와 네임스페이스(`run`·`cont`)를 나누고, TTL 은 `CONTINUATION_SEQ_TTL_SECONDS` 를 따르되 구현할 때 정한다.

### pub/sub 채널

키-값 저장이 아니라 한 번 보내고 끝나는 방송이라 TTL 이 없다.

| 채널 | 소유 모듈 | 용도 |
| --- | --- | --- |
| `integration:cache:invalidate` | `common/redis` | 통합 자격 증명을 교체하거나 삭제하면 모든 인스턴스의 로컬 자격 증명 캐시(예: Database Query 노드 연결 풀)를 곧바로 비운다([Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md)). 페이로드는 통합 ID 평문이다. 워크스페이스와 무관한 전역 채널이다. 메시지를 못 받아도 핸들러가 자격 증명 해시(`credsHash`)를 비교해 비우므로 안전하게 강등된다. 구독은 전용 복제 연결로 한다(공유 명령 연결은 SUBSCRIBE 를 쓰지 않는다) |

### 다른 모듈의 키

용도·TTL·실패 정책은 "상세" 열의 문서가 정한다.

| 키 | 소유 모듈 | 상세 |
| --- | --- | --- |
| `iext:blacklist:<jti>` · `interaction:idempotency:<executionId>:<route>:<key>` | `modules/external-interaction` | [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) |
| `eia:rl:interact:<executionId>` · `eia:rl:status:<executionId>` · `eia:notif:rl:<triggerId>` | `modules/external-interaction` | [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md). 한도는 [External Interaction API](../CLE-IX/CLE-EIA.md) |
| `chat-channel:<triggerId>:<conversationKey>` · `chat-channel-lock:<triggerId>:<conversationKey>:formsubmit` | `modules/chat-channel` | [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md) |
| `cc:rl:<triggerId>:<conversationKey>` · `cc:dedup:<triggerId>:<idempotencyKey>` | `modules/chat-channel` | [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md) |
| `wh:rl:min:<ip>` · `wh:rl:hour:<ip>` | `modules/hooks` | [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| `cafe24:install:fail:<ip>` · `cafe24:install:nonce:<mall_id>:<ts>:<hmac 앞 8자>` | `modules/integrations` | [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md) |

한 모듈이 접두를 여럿 쓴다. `external-interaction` 은 `iext:`·`interaction:`·`eia:` 를, `chat-channel` 은 긴 접두(`chat-channel:`·`chat-channel-lock:`)와 약어(`cc:`)를 함께 쓴다. 통일을 강제하지 않지만 모듈마다 접두가 더 늘지 않게 한다. 규칙의 예외 두 계열은 [Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md) 이 정한다.

### Redis 키가 아닌 것

다음은 이름 모양이 비슷하지만 Redis 를 거치지 않는다. 이 목록에 넣지 않는다.

- Socket.IO 구독 채널(`execution:<id>`, `workflow:<id>`, `background:run:<id>`)
- 메모리 Map 라우팅 키(`bg:<executionId>:<backgroundRunId>`)
- BullMQ 내부 키(`bull:<queue>:*`)
- PostgreSQL advisory lock 키(`trigger-config:<triggerId>`, `exec-cap:<workspaceId>`)

구분 기준과 advisory lock 키 공간 규칙은 [Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md) 에 있다.

### 실행 상태는 Redis 에 두지 않는다

실행 컨텍스트·실행 상태·노드 출력·워커 상태·실행 잠금·우선순위 큐는 Redis 키가 아니다. 지금 구조가 각각 다음으로 대신한다.

| 대상 | 지금 두는 곳 |
| --- | --- |
| 실행 컨텍스트 | 세그먼트 안의 메모리 `ExecutionContext`([실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md)) |
| 실행 상태 | PostgreSQL `Execution.status` |
| 노드 출력 | PostgreSQL `NodeExecution.outputData` 와 `execution_node_log` |
| 워커 건강 확인 | BullMQ stalled 작업 검출(별도 heartbeat 채널 없음) |
| 실행 잠금 | DB 원자 claim(별도 잠금 없음, [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)) |
| 우선순위 | BullMQ 기본 작업 우선순위([큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md)) |

## 구현 위치

- `codebase/backend/src/modules/execution-engine/**/*.ts`
- `codebase/backend/src/modules/external-interaction/**/*.ts`
- `codebase/backend/src/modules/chat-channel/**/*.ts`
- `codebase/backend/src/modules/hooks/**/*.ts`
- `codebase/backend/src/modules/integrations/**/*.ts`
- `codebase/backend/src/modules/websocket/execution-seq-allocator.service.ts`
- `codebase/backend/src/common/redis/**/*.ts`
- `codebase/backend/src/modules/system-status/system-status.constants.ts` (`MONITORED_QUEUES`)

## Rationale

### 큐와 Redis 키 목록을 한 문서에 둔 이유

옛 문서 체계에서는 큐 목록이 세 곳에 있었다. 데이터 흐름 개요가 18개 큐를 모두 적었고, 실행 엔진 문서는 엔진 큐 3개만 적으면서 "애플리케이션이 쓰는 큐" 라고 했고, Redis 키 규약은 큐 목록의 기준으로 실행 엔진 문서를 가리켰다. 코드 레지스트리는 데이터 흐름 개요의 표를 기준으로 삼았다. 이 문서는 전체 큐 목록과 엔진 큐의 옵션을 함께 두어 목록을 하나로 모은다. Redis 키 목록도 여기로 모았다. 실행 엔진 키의 용도와 TTL 은 이 문서가, 다른 모듈 키의 상세는 각 소유 문서가 정한다.

### 작업 단위를 코드 동작 기준으로 적는 이유

옛 큐 목록은 `alerts-evaluator` 의 작업 단위를 "규칙 1건 평가" 로, `integration-expiry-scanner` 를 "매일, 만료 후보 1건 처리" 로 적었다. 실제로는 알림 평가 반복 작업 1개가 켜진 규칙 전체를 순회하고, 만료 스캐너는 매일 3종과 6시간 1종, 모두 4종의 반복 작업이 대상 전체를 일괄 처리한다. 이 문서는 소유 문서([알림 §알림 규칙 평가](../CLE-OBS/CLE-OBS-NOTIFY.md#알림-규칙-평가), [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md))의 서술에 맞춰 적는다.

### 지운 키 두 개 (2026-08-13)

실행 엔진 키 표는 "실제로 쓰는 키만" 적는다고 선언했는데, 코드에 없는 두 항목이 있어 지웠다.

- `core:{wsId}:rate:{userId}`(API 요청 빈도 제한): API 요청 빈도 제한은 `@nestjs/throttler` 를 storage 설정 없이 쓴다. 기본값인 메모리 카운터라 Redis 키가 없다. 여러 인스턴스가 함께 쓰는 분산 카운터 저장소가 들어오면 비슷한 키가 다시 생긴다. "영원히 없다" 가 아니라 "지금은 메모리, 분산 저장소가 들어오면 재검토" 다.
- `ws:{wsId}:session:{connId}`(WebSocket 세션): 소켓은 한 프로세스에 고정돼 프로세스 로컬 상태가 기준이다(`ws-rate-limiter.service.ts` 가 "Redis 없이" 를 명시). 이 항목을 근거로 "WebSocket 세션이 인스턴스 사이에 공유된다" 고 읽으면 정반대 전제가 된다.

### 실행 상태를 Redis 에 두지 않은 이유

옛 설계는 `exec:{ws}:execution:{id}:context`(실행 컨텍스트), `:status`(실행 상태), `node:{id}:output`(노드 출력), `worker:{id}:heartbeat`(워커 건강 확인), `lock:{id}`(실행 잠금), `queue:priority`(우선순위 큐)를 Redis 에 두려 했다. 이 키들은 구현하지 않았고 코드에 없다. 실행 컨텍스트를 메모리에 두고 DB 에 영속하기로 한 결정과 경위는 [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) 의 Rationale 에 있다. 옛 키 패턴 `{service}:{workspaceId}:{resource}:{id}:{sub}` 을 코드에 맞춰 고친 근거는 [Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md) 에 있다.

### 순번 발급이 실패할 때 두 키가 다르게 동작하는 이유

`exec:cont:seq` 는 `INCR` 이 실패하면 발행을 멈추고(fail-fast), `exec:seq` 는 메모리 카운터로 강등한다. 의도한 비대칭이다. 재개 순번은 작업 ID 중복 제거 계약이 가용성보다 먼저다. 게다가 BullMQ 자체가 Redis 위에 있어, `INCR` 이 실패할 만한 장애에서는 바로 뒤의 `queue.add` 도 실패하므로 대체값의 실익이 거의 없다. 근거는 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 의 Rationale «발행 실패를 `queued:false` 하나로 알린다» 에 있다. 이벤트 순번의 강등 근거는 [WebSocket 연결과 채널 구독](../CLE-API/CLE-API-WS.md) 에 있다.

### DLQ 경고를 로그 기반으로 둔 이유

DLQ 임계 초과 경고는 구조화 로그로 남기고, 큐 깊이는 OTel gauge 로 따로 노출한다. 관측과 능동 통지를 나눈 것이다. 결정의 근거는 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 의 Rationale «DLQ 경고는 로그로 남긴다» 에 있다.
