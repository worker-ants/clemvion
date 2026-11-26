---
id: "CLE-PLAT-QUEUE"
title: "비동기 큐와 Redis 키 목록"
type: "design"
version: 13
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-PLAT"
ancestors: ["CLE-VISION", "CLE-PLAT"]
area: "CLE-PLAT"
content_hash: "4fca099fcb0aa3789ddecae50999c85c1607685342f1e858b0fc58c1656663f6"
read_as: "approved_fallback"
task: "CLE-T-BAXAN4"
source_paths: []
mirror_sha256: "2a68d2f09d2723dd8637f8c58dc9ae94f96f1049663eed0392dc8a59e5b434f5"
etag: "sha256-c8b2b38edd486d9417f729a2958428838c9e5d35b66b35a59ac20b7e1852ed35"
---
> 구현 상태: 구현됨 · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 Clemvion 이 쓰는 BullMQ 큐와 Redis 키의 단일 기준 목록이다. 큐마다 누가 넣고 누가 꺼내며 작업 하나가 무엇인지, Redis 키마다 어느 모듈이 무엇에 쓰는지를 적는다.

- 큐를 더하거나 빼면 먼저 이 문서의 [BullMQ 큐 목록](#bullmq-큐-목록) 을 고친다. 그다음 그 큐를 쓰는 영역 데이터 문서의 외부 의존 절과 코드의 큐 모니터링 레지스트리(`MONITORED_QUEUES`, `codebase/backend/src/modules/system-status/system-status.constants.ts`)를 맞춘다.
- Redis 키나 pub/sub 채널을 새로 만들면 [Redis 키 목록](#redis-키-목록) 에 한 줄을 더한다. 키 이름의 형태 규칙과 등재 의무는 [Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md) 이 정한다.

범위 밖: 큐를 쓰는 동작 자체는 각 큐의 상세 문서가 정한다. 실행 엔진 큐의 옵션과 DLQ 모니터링은 하위 문서 [실행 엔진 큐 옵션과 DLQ 모니터링](CLE-PLAT-QUEUE-ENGINE.md) 이 정한다. 시스템 상태 화면의 큐 그룹·동시 처리 수·건강도 판정은 [시스템 상태](../CLE-OBS/CLE-OBS-STATUS.md) 가 정한다. 큐와 Redis 가 전체 구성에서 차지하는 자리는 [시스템 아키텍처](CLE-PLAT-ARCH.md) 에 있다.

## BullMQ 큐 목록

현재 등록된 BullMQ 큐는 20개다. "반복 작업" 은 BullMQ job scheduler(`upsertJobScheduler`)로 주기 실행하는 내부 작업이다. 사용자가 만드는 스케줄과 다르다.

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
| `notification-digest` | `notifications.module.ts` | `NotificationDigestService` (반복 작업 1개 `notification-digest-daily`, 매일 `0 9 * * *` `PRODUCT_DEFAULT_TIMEZONE`(Asia/Seoul)) | 같은 서비스 (`@Processor`, 동시 처리 1) | 작업 1회가 일일 요약을 켠 수신자 전체에게 요약 메일을 보낸다. 수신자는 500명씩 나눠 읽는다. 사람마다 큐에 넣지 않는다 | [알림 — 알림 설정과 이메일 「일일 요약」](../CLE-OBS/CLE-OBS-NOTIFY-SETTINGS.md#일일-요약) |
| `cafe24-token-refresh` | `integrations.module.ts` · `cafe24.module.ts` | 다섯 곳: `Cafe24ApiClient` 의 호출 직전 갱신과 401 뒤 갱신(직접 넣고 `QueueEvents` 로 완료를 기다린다), `IntegrationExpiryScanner` 의 `cafe24-background-refresh` 반복 작업과 `connected-expiry` 당일 분기, `Cafe24McpToolProvider` 의 `expired` 자가 회복 | `Cafe24TokenRefreshProcessor` | Cafe24 통합 1건 토큰 갱신. source 별 jobId 전략과 보존 옵션은 상세 문서의 갱신 큐 표가 기준이다 | [OAuth 연결과 토큰 갱신 §갱신 큐](../CLE-INT/CLE-INT-OAUTH.md#갱신-큐) |
| `makeshop-token-refresh` | `makeshop.module.ts` | 세 곳: `MakeshopApiClient` 의 호출 직전 갱신과 401 뒤 갱신, `MakeshopMcpToolProvider` 의 `refreshTokenViaQueue` (source `background` 자가 회복). 스캐너 반복 작업은 없다. 리프레시 토큰 수명은 30~90일이다 | `MakeshopTokenRefreshProcessor` | MakeShop 통합 1건 토큰 갱신. source 별 jobId 전략과 보존 옵션은 상세 문서의 갱신 큐 표가 기준이다 | [OAuth 연결과 토큰 갱신 §갱신 큐](../CLE-INT/CLE-INT-OAUTH.md#갱신-큐) · [MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md) |
| `notification-webhook` | `external-interaction.module.ts` | `NotificationDispatcher` | `NotificationWebhookProcessor` | EIA 알림 웹훅 1건 발송 | [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) |
| `login-history-pruner` | `auth.module.ts` | `LoginHistoryPrunerService` (매일 반복 작업, `0 3 * * *` Asia/Seoul) | 같은 서비스 (`@Processor`) | 180일 지난 로그인 이력 정리 | [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md) |
| `audit-log-pruner` | `audit-logs.module.ts` | `AuditLogPrunerService` (매일 반복 작업, `30 3 * * *` Asia/Seoul) | 같은 서비스 (`@Processor`) | 보존 기간(기본 365일, `AUDIT_LOG_RETENTION_DAYS`)이 지난 감사 로그 정리 | [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md) |
| `workspace-invitations-pruner` | `workspaces.module.ts` | `WorkspaceInvitationsPrunerService` (매일 반복 작업, `0 4 * * *` Asia/Seoul) | 같은 서비스 (`@Processor`) | 만료·미수락 초대 정리 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) |
| `chat-channel-token-rotator` | `triggers.module.ts` | `ChatChannelTokenRotatorService` (매시간 반복 작업) | 같은 서비스 (`@Processor`) | `chat_channel_token_v2` 의 24시간 유예 정리 | [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md) |
| `notification-secret-rotator` | `triggers.module.ts` | `NotificationSecretRotatorService` (매시간 반복 작업). 회전 유예가 끝난 알림 서명 시크릿을 승격하는 스케줄러다. 알림 서명 시크릿(`wsk_*`)을 발급해 저장하는 `NotificationSigningSecretService` 와 다르다 | 같은 서비스 (`@Processor`) | `notification_secret_v2` 의 24시간 유예 뒤 승격 | [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) |
| `terminal-revoke-reconcile` | `external-interaction.module.ts` | `TerminalRevokeReconcilerService` (매분 반복 작업 `* * * * *`) | 같은 서비스 (`@Processor`, 동시 처리 1) | 종료된 실행에 남은 인터랙션 토큰을 훑어 폐기한다. 최소 1회 폐기를 보강한다(EIA-RL-06) | [External Interaction API](../CLE-IX/CLE-EIA.md) |
| `webchat-idle-reaper` | `external-interaction.module.ts` | `WebChatIdleReaperService` (매분 반복 작업 `* * * * *`) | 같은 서비스 (`@Processor`, 동시 처리 1) | 웹채팅 위젯 유휴 실행 회수. 공개 웹훅(`auth_config_id IS NULL`)이 시작한 입력 대기 실행 가운데 실행 토큰 행이 하나 이상 있고 가장 늦은 `execution_token.exp_at` 뒤로 유예 시간(`WEBCHAT_IDLE_REAP_GRACE_MS`)이 지난 실행을 `cancelled`(`WEBCHAT_IDLE_TIMEOUT`)로 회수하고 토큰을 폐기한다. 토큰 행이 없는 실행은 대상이 아니다. 버려진 위젯 세션의 마지막 안전장치다(EIA-RL-07) | [External Interaction API](../CLE-IX/CLE-EIA.md) · [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) |

모니터링 레지스트리 `MONITORED_QUEUES` 는 이 표를 기준으로 삼는다. 현재 구현은 레지스트리에 `agent-memory-extraction` 이 빠져 있다([시스템 상태](../CLE-OBS/CLE-OBS-STATUS.md)). `notification-digest` 는 레지스트리의 시스템(`system`) 그룹에 동시 처리 1로 들어 있다.

실행 엔진 큐(`execution-run` · `execution-continuation` · `background-execution`)의 재시도 · 작업 옵션과 DLQ 모니터링은 [실행 엔진 큐 옵션과 DLQ 모니터링](CLE-PLAT-QUEUE-ENGINE.md) 이 정한다.

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
| `integration:cache:invalidate` | `common/redis` | 통합 자격 증명을 교체하거나 삭제하면 모든 서버 인스턴스의 로컬 자격 증명 캐시(예: Database Query 노드 연결 풀)를 곧바로 비운다([Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md)). 페이로드는 통합 ID 평문이다. 워크스페이스와 무관한 전역 pub/sub 채널이다. 메시지를 못 받아도 핸들러가 자격 증명 해시(`credsHash`)를 비교해 비우므로 안전하게 강등된다. 구독은 전용 복제 연결로 한다(공유 명령 연결은 SUBSCRIBE 를 쓰지 않는다) |
| `chat-channel:listener` | `modules/chat-channel` | 채팅 채널의 트리거 단위 listener 레지스트리 변경을 모든 서버 인스턴스에 알린다([채팅 채널 「R8 트리거 단위 listener 정책」](../CLE-CHAT/CLE-CHAT-CORE.md#r8-트리거-단위-listener-정책)). 워크스페이스와 무관한 전역 pub/sub 채널이다. 놓친 등록은 구독을 다시 확립할 때만 DB 에서 다시 읽어 메운다. 구독이 끊긴 사이 놓친 해제와 구독이 이어진 동안 잃은 메시지는 메우지 않는다. 해시 비교로 놓친 메시지를 메우는 `integration:cache:invalidate` 와 달리 보정이 구독 재확립 때만 있는 예외다. 페이로드 형식은 [채팅 채널 데이터와 흐름 「Redis 키」](../CLE-CHAT/CLE-CHAT-DATA.md#redis-키) 가 정한다. 복원 · 유실 정책과 이 예외의 근거는 [채팅 채널 「R-CC-30 트리거 단위 listener 레지스트리의 변경을 Redis pub/sub 로 모든 서버 인스턴스에 알린다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-30-트리거-단위-listener-레지스트리의-변경을-redis-pubsub-로-모든-서버-인스턴스에-알린다) 에 있다 |
| `eia:sse:live:<executionId>` | `modules/external-interaction` | 실행별 EIA SSE 이벤트 채널이다. 실행 이벤트가 난 서버 인스턴스가 이 채널로 발행하고 그 실행의 SSE 구독자가 있는 서버 인스턴스만 구독한다. 그래서 구독자는 어느 서버 인스턴스에 붙어도 그 실행의 이벤트를 받는다. 페이로드와 실패 정책은 [EIA 데이터와 흐름 「Redis 와 BullMQ」](../CLE-IX/CLE-EIA-DATA.md#redis-와-bullmq) 가 정한다 |
| `eia:sse:close` | `modules/external-interaction` | 트리거 단위 토큰(`itk_*`)이 무효가 되면 그 트리거를 모든 서버 인스턴스에 알린다. 받은 서버 인스턴스는 그 토큰으로 연 SSE 스트림을 닫는다. 워크스페이스와 무관한 전역 pub/sub 채널이다. 페이로드와 실패 정책은 [EIA 데이터와 흐름 「Redis 와 BullMQ」](../CLE-IX/CLE-EIA-DATA.md#redis-와-bullmq) 가 정한다 |
| `ws:sio#/ws#` · `ws:sio#/ws#<채널>#` · `ws:sio-request#/ws#` · `ws:sio-response#/ws#[<서버 uid>#]` | `modules/websocket` (`ws-redis-adapter.ts`) | Socket.IO Redis adapter 채널이다. WebSocket 채널 발행을 다른 서버 인스턴스의 같은 채널 구독 소켓에 전달한다. 이름은 라이브러리가 `<접두>#<namespace>#[<채널>#]` 형식으로 만들고 접두만 `ws:sio` 로 정한다. 채널 하나로 보내는 패킷은 `ws:sio#/ws#<채널>#` 로 발행한다. 모든 서버 인스턴스가 `ws:sio#/ws#*` 를 패턴 구독하므로 그 채널의 구독자가 없는 서버 인스턴스도 받는다. 페이로드는 클라이언트가 받는 이벤트 봉투뿐이고 연결 상태는 싣지 않는다. 요청 · 응답 채널(`ws:sio-request#/ws#` · `ws:sio-response#/ws#[<서버 uid>#]`)은 라이브러리가 구독만 하고 지금 코드는 쓰지 않는다. 워크스페이스와 무관한 전역 pub/sub 채널이다. 전달 방식과 Redis 가 없거나 끊겼을 때의 실패 정책은 [WebSocket 연결과 채널 구독 — 메시지 · 구독 · 에러 「4.6 여러 서버 인스턴스에서의 전달」](../CLE-API/CLE-API-WS-MSG.md#46-여러-서버-인스턴스에서의-전달) 이 정한다 |

### 다른 모듈의 키

용도·TTL·실패 정책은 "상세" 열의 문서가 정한다.

| 키 | 소유 모듈 | 상세 |
| --- | --- | --- |
| `iext:blacklist:<jti>` · `interaction:idempotency:<executionId>:<route>:<key>` | `modules/external-interaction` | [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) |
| `eia:rl:interact:<executionId>` · `eia:rl:status:<executionId>` · `eia:notif:rl:<triggerId>` | `modules/external-interaction` | [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md). 한도는 [External Interaction API](../CLE-IX/CLE-EIA.md) |
| `eia:sse:buf:<executionId>` · `eia:sse:subs:<executionId>` | `modules/external-interaction` | [EIA 데이터와 흐름 「Redis 와 BullMQ」](../CLE-IX/CLE-EIA-DATA.md#redis-와-bullmq). `eia:sse:subs:<executionId>` 는 연결 슬롯(동시 연결 상한 계산용)이다 |
| `chat-channel:<triggerId>:<conversationKey>` · `chat-channel-lock:<triggerId>:<conversationKey>:formsubmit` | `modules/chat-channel` | [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md) |
| `cc:rl:<triggerId>:<conversationKey>` · `cc:dedup:<triggerId>:<idempotencyKey>` · `cc:sigfail:<triggerId>:<clientIp>` · `cc:startlock:<triggerId>:<conversationKey>` | `modules/chat-channel` | [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md). `cc:sigfail:<triggerId>:<clientIp>` 는 서명 검증 실패 한도의 고정 창 카운터(60초)이고 `cc:startlock:<triggerId>:<conversationKey>` 는 `/start` 의 대화 단위 시작 잠금(30초)이다. 둘의 정본은 [채팅 채널 데이터와 흐름 「Redis 키」](../CLE-CHAT/CLE-CHAT-DATA-STORE.md#redis-키) 다 |
| `wh:rl:min:<ip>` · `wh:rl:hour:<ip>` | `modules/hooks` | [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| `cafe24:install:fail:<ip>` · `cafe24:install:nonce:<mall_id>:<ts>:<hmac 앞 8자>` | `modules/integrations` | [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md) |
| `auth:webauthn-auth-challenge:<challenge>` | `modules/auth` | [가입과 로그인 — Passkey 로그인 인증과 counter 역행 「Passkey 인증 챌린지 기록」](../CLE-ACCT/CLE-ACCT-SIGNIN-PKAUTH.md#passkey-인증-챌린지-기록). 로그인 2단계 Passkey 인증 챌린지를 한 번만 쓰게 하는 기록이다 |
| `auth:password-recheck-failures:<userId>` | `modules/auth` | [HTTP API 규약 — 요청 빈도 제한 「비밀번호 재확인 실패 한도」](../CLE-API/CLE-API-CONV-RATE.md#7-요청-빈도-제한). 사용자별 비밀번호 재확인 실패 카운터다 |
| `throttle:hit:<key>` | `common/throttler` | [HTTP API 규약 — 요청 빈도 제한 「저장소」](../CLE-API/CLE-API-CONV-RATE.md#7-요청-빈도-제한). 요청 빈도 제한(`ThrottlerModule`)의 고정 창 요청 수다. TTL 은 그 한도의 창 길이(ttl)이고 창의 첫 요청에 건다. `<key>` 는 `@nestjs/throttler` 가드가 만든 SHA-256 hex 라 IP 와 사용자 id 원문이 없다. Redis 를 쓸 수 없으면 서버 인스턴스마다 메모리 저장소로 센다 |
| `throttle:block:<key>` | `common/throttler` | [HTTP API 규약 — 요청 빈도 제한 「저장소」](../CLE-API/CLE-API-CONV-RATE.md#7-요청-빈도-제한). 한도를 넘은 키의 차단 표시다. 값은 차단할 때의 요청 수이고 TTL 은 차단 시간(blockDuration)이다. Redis 를 쓸 수 없으면 서버 인스턴스마다 메모리 저장소로 센다 |

한 모듈이 접두를 여럿 쓴다. `external-interaction` 은 `iext:`·`interaction:`·`eia:` 를, `chat-channel` 은 긴 접두(`chat-channel:`·`chat-channel-lock:`)와 약어(`cc:`)를 함께 쓴다. `websocket` 은 `exec:seq`(이벤트 순번 키)와 `ws:sio`(adapter 채널 접두)를 함께 쓴다. `ws:sio` 는 라이브러리가 정하는 채널 이름의 접두라 예외로 둔다. 통일을 강제하지 않지만 모듈마다 접두가 더 늘지 않게 한다. 예외의 기준과 두 계열은 [Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md) 이 정한다.

### Redis 키가 아닌 것

다음은 이름 모양이 비슷하지만 Redis 키가 아니다. 이 목록에 넣지 않는다.

- Socket.IO 구독 채널(`execution:<id>`, `workflow:<id>`, `background:run:<id>`). 채널 이름은 Redis 키가 아니다. 서버 인스턴스가 여럿이면 위 pub/sub 채널 표의 adapter 채널 이름 `ws:sio#/ws#<채널>#` 안에 실려 Redis 를 지난다.
- 메모리 Map 라우팅 키(`bg:<executionId>:<backgroundRunId>`)
- PostgreSQL advisory lock 키(`trigger-config:<triggerId>`, `exec-cap:<workspaceId>`, `makeshop-pending:<workspaceId>:<client_id 해시>`)

BullMQ 내부 키(`bull:<queue>:*`)는 Redis 키지만 라이브러리가 이름을 정하므로 한 줄씩 올리지 않고 [BullMQ 큐 목록](#bullmq-큐-목록) 으로 대신한다([Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md)).

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
- `codebase/backend/src/modules/auth/webauthn/webauthn-auth-challenge.service.ts`
- `codebase/backend/src/modules/auth/password-recheck-failure-limiter.service.ts`
- `codebase/backend/src/modules/audit-logs/jobs/audit-log-pruner.service.ts`
- `codebase/backend/src/modules/notifications/jobs/notification-digest.service.ts` (`notification-digest` 큐의 반복 작업 등록과 처리)
- `codebase/backend/src/modules/websocket/execution-seq-allocator.service.ts`
- `codebase/backend/src/modules/websocket/ws-redis-adapter.ts`
- `codebase/backend/src/common/redis/**/*.ts`
- `codebase/backend/src/common/throttler/redis-throttler.storage.ts` (`throttle:hit:<key>` · `throttle:block:<key>`)
- `codebase/backend/src/modules/system-status/system-status.constants.ts` (`MONITORED_QUEUES`)

## Rationale

### 큐와 Redis 키 목록을 한 문서에 둔 이유

옛 문서 체계에서는 큐 목록이 데이터 흐름 개요 · 실행 엔진 문서 · Redis 키 규약 세 곳에 나뉘어 기준이 어긋났다. 이 문서는 전체 큐 목록을 한곳에 두어 목록을 하나로 모은다. 엔진 큐의 옵션은 하위 문서 [실행 엔진 큐 옵션과 DLQ 모니터링](CLE-PLAT-QUEUE-ENGINE.md) 이 정한다. Redis 키 목록도 여기로 모았다. 실행 엔진 키의 용도와 TTL 은 이 문서가, 다른 모듈 키의 상세는 각 소유 문서가 정한다.

### 작업 단위를 코드 동작 기준으로 적는 이유

세 반복 큐(`alerts-evaluator` · `integration-expiry-scanner` · `notification-digest`)는 작업 하나가 대상 전체를 일괄 처리한다. 소유 문서([알림 §알림 규칙 평가](../CLE-OBS/CLE-OBS-NOTIFY.md#알림-규칙-평가), [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md), [알림 — 알림 설정과 이메일](../CLE-OBS/CLE-OBS-NOTIFY-SETTINGS.md))의 서술에 맞춰 적는다.

### 일일 요약 큐는 Asia/Seoul 로 돈다

결정일: 2026-11-20

NERV Task `CLE-T-BAXAN4`. `alerts-evaluator` 와 `integration-expiry-scanner` 는 UTC 로 돈다. 주기만 맞으면 되는 내부 점검이라 사용자가 실행 시각을 보지 않는다. `notification-digest` 는 사용자가 받는 메일의 도착 시각이 곧 기능이다. 그래서 제품 기본 시간대 `PRODUCT_DEFAULT_TIMEZONE`(Asia/Seoul)의 오전 9시에 돈다. 같은 이유로 정리 작업 세 개(`login-history-pruner` · `audit-log-pruner` · `workspace-invitations-pruner`)도 Asia/Seoul 기준이다. 사용자별 시간대로 보내지 않는 이유는 [알림 — 알림 설정과 이메일](../CLE-OBS/CLE-OBS-NOTIFY-SETTINGS.md) 의 Rationale 에 있다.

### 지운 키 두 개 (2026-08-13)

실행 엔진 키 표는 "실제로 쓰는 키만" 적는다고 선언했는데, 코드에 없는 두 항목이 있어 지웠다.

- `core:{wsId}:rate:{userId}`(API 요청 빈도 제한): 그때 API 요청 빈도 제한은 `@nestjs/throttler` 를 storage 설정 없이 썼다. 기본값인 메모리 카운터라 Redis 키가 없었다. 2026-11-21 에 여러 서버 인스턴스가 함께 쓰는 분산 저장소를 들였다(NERV Task `CLE-T-JK1JFZ`). 지금 키는 [다른 모듈의 키](#다른-모듈의-키) 의 `throttle:hit:<key>` · `throttle:block:<key>` 이고 워크스페이스 세그먼트가 없다. 옛 이름 `core:{wsId}:rate:{userId}` 는 쓰지 않는다. 도입 이유는 [요청 빈도 제한 카운터를 Redis 에 두는 이유 (2026-11-21)](#요청-빈도-제한-카운터를-redis-에-두는-이유-2026-11-21) 에 있다.
- `ws:{wsId}:session:{connId}`(WebSocket 세션): 소켓은 한 프로세스에 고정돼 프로세스 로컬 상태가 기준이다(`ws-rate-limiter.service.ts` 가 "Redis 없이" 를 명시). 이 항목을 근거로 "WebSocket 세션이 인스턴스 사이에 공유된다" 고 읽으면 정반대 전제가 된다.

### 실행 상태를 Redis 에 두지 않은 이유

옛 설계는 `exec:{ws}:execution:{id}:context`(실행 컨텍스트), `:status`(실행 상태), `node:{id}:output`(노드 출력), `worker:{id}:heartbeat`(워커 건강 확인), `lock:{id}`(실행 잠금), `queue:priority`(우선순위 큐)를 Redis 에 두려 했다. 이 키들은 구현하지 않았고 코드에 없다. 실행 컨텍스트를 메모리에 두고 DB 에 영속하기로 한 결정과 경위는 [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) 의 Rationale 에 있다. 옛 키 패턴 `{service}:{workspaceId}:{resource}:{id}:{sub}` 을 코드에 맞춰 고친 근거는 [Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md) 에 있다.

### 순번 발급이 실패할 때 두 키가 다르게 동작하는 이유

`exec:cont:seq` 는 `INCR` 이 실패하면 발행을 멈추고(fail-fast), `exec:seq` 는 메모리 카운터로 강등한다. 의도한 비대칭이다. 재개 순번은 작업 ID 중복 제거 계약이 가용성보다 먼저다. 게다가 BullMQ 자체가 Redis 위에 있어, `INCR` 이 실패할 만한 장애에서는 바로 뒤의 `queue.add` 도 실패하므로 대체값의 실익이 거의 없다. 근거는 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 의 Rationale «발행 실패를 `queued:false` 하나로 알린다» 에 있다. 이벤트 순번의 강등 근거는 [WebSocket 연결과 채널 구독](../CLE-API/CLE-API-WS.md) 에 있다.

### WebSocket adapter 채널을 목록에 올린 이유 (2026-11-14)

NERV Task `CLE-T-GDR39Z`. 새 pub/sub 채널은 이 목록에 한 줄을 더한다는 [Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md) 규칙 7 을 따라 `ws:sio` 채널을 올렸다. 이 채널은 2026-08-13 에 지운 `ws:{wsId}:session:{connId}` 와 다르다([지운 키 두 개](#지운-키-두-개-2026-08-13)). 연결 상태는 지금도 Redis 에 두지 않는다는 그 결정을 유지하고 채널 발행 패킷만 `ws:sio` 채널로 전달한다. 전달 방식을 고른 근거는 [WebSocket 연결과 채널 구독 — 메시지 · 구독 · 에러 「여러 서버 인스턴스 전달에 Socket.IO Redis adapter 를 쓴 이유 (2026-11-14)」](../CLE-API/CLE-API-WS-MSG.md#여러-서버-인스턴스-전달에-socketio-redis-adapter-를-쓴-이유-2026-11-14) 에 있다.

### 요청 빈도 제한 카운터를 Redis 에 두는 이유 (2026-11-21)

NERV Task `CLE-T-JK1JFZ`. 그전에는 `@nestjs/throttler` 기본 메모리 저장소라 서버 인스턴스마다 따로 셌다. 인스턴스가 여럿이면 한 클라이언트가 받는 한도가 인스턴스 수만큼 늘 수 있었다. 이제 `RedisThrottlerStorage` 가 공유 Redis 에 Lua 스크립트 하나로 고정 창과 차단 상태를 센다. Redis 가 없거나 명령이 실패하거나 250ms 안에 답하지 않으면 서버 인스턴스마다 메모리로 센다.

- 기각: Redis 장애 때 제한을 끈다. 로그인 · 인증 라우트의 방어가 함께 사라진다.
- 기각: 외부 패키지(`@nest-lab/throttler-storage-redis` 등)를 쓴다. 새 의존성을 심사하는 부담이 커서 사람이 뺐다(2026-11-20).

250ms 상한과 실패 뒤 5초 대기의 근거는 [HTTP API 규약 — 요청 빈도 제한](../CLE-API/CLE-API-CONV-RATE.md#7-요청-빈도-제한) 의 「저장소」 에 있다.
