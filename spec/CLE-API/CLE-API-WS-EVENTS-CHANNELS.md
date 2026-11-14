---
id: "CLE-API-WS-EVENTS-CHANNELS"
title: "WebSocket 이벤트와 명령 — 채널별 부가 이벤트"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-WS-EVENTS"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-WS-EVENTS"]
area: "CLE-API"
content_hash: "da97af190db6954e0409985aa75b9ab9eebe14f57fbb524565f68d209c3c966d"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "6e8aaad2c376dd7746a12559bbc0be1f6ca7e330f80c9e6bd1301c3b85bc6bdb"
etag: "sha256-1101cdb5dd0c038cfcae927f178754b24d0f0e540408791c3b3b39a6e2f217d6"
---
> 구현 상태: 구현됨 (`system.maintenance`·`auth.refreshed` 는 비채택) · 상위: [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md)

## 개요

이 문서는 [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) 의 하위 문서로 실행 채널 밖의 서버 이벤트를 정한다. 지식 저장소 문서 이벤트, 인앱 알림 이벤트, 시스템 이벤트, Background 본문 실행 이벤트다.

## 3. 지식 저장소 문서 이벤트 (Server → Client)

구독 채널: `kb:{documentId}` (지식 저장소 ID 가 아니라 **문서 ID** 가 키다). payload 에 `documentId` 와 `timestamp`(ISO 8601)가 자동으로 붙는다. 백엔드 권위 정의는 `websocket-events.types.ts` 의 `KbEventType` union(11개 = 임베딩 6 + 그래프 5)이고 프론트엔드 `useKbEvents`(`KB_EVENT_NAMES`)가 이 union 과 1:1 로 구독한다.

**임베딩 이벤트 (6개)**

| 이벤트 | payload | 설명 |
|-------------|---------|------|
| `document:embedding_started` | `{ documentId, knowledgeBaseId }` | 처리 시작 |
| `document:embedding_progress` | `{ documentId, progress: number }` | 청크 배치가 끝날 때마다 (0~100) |
| `document:embedding_completed` | `{ documentId, chunkCount }` | 완료 |
| `document:embedding_error` | `{ documentId, error: string }` | union 에 **선언돼 있으나 지금 발행 경로가 없다.** 일시 에러는 `embedding_status='error'` 전환과 함께 `_retry` 로 알린다. 앞으로를 위해 union 멤버로 남긴다. 최종 실패 신호로 쓰지 않는다 |
| `document:embedding_retry` | `{ documentId, attempt: number, maxAttempts: number, error: string }` | 일시 에러 뒤 재시도를 큐에 넣기 직전 |
| `document:embedding_failed` | `{ documentId, error: string }` | 재시도를 모두 쓰거나 재시도하지 않는 에러로 최종 실패 |

**그래프 추출 이벤트 (5개)**: `rag_mode = 'graph'` 지식 저장소의 문서에 같은 채널로 더 보낸다.

| 이벤트 | 설명 |
|-------------|------|
| `document:graph_started` / `_progress` / `_completed` / `_retry` / `_failed` | 임베딩과 달리 `_error` 이벤트가 없다(발행 경로가 없어 union 에서 뺐다. 일시 에러는 `_retry`, 최종 실패는 `_failed`). 페이로드 상세는 [Graph RAG](../CLE-KB/CLE-KB-GRAPH.md) |

상태 전이와 뜻은 [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) 의 상태 전이와 그대로 대응한다. 지식 저장소 단위 통계 이벤트(`kb:graph_stats_updated` 등)는 두지 않는다.

## 5. 인앱 알림 이벤트 (Server → Client)

구독 채널: `notifications:{userId}`. 이 채널 prefix 는 게이트웨이 `VALID_CHANNEL_PREFIXES` 에 등록돼 구독할 수 있다. `NotificationsService` 가 인앱 알림을 적재한 직후(`notify()`, `createMany`) `WebsocketService.emitNotificationEvent` 로 `notification.new` 를 보낸다(best-effort). 데이터 흐름은 [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) 에 있다.

| 이벤트 | payload | 설명 |
|-------------|---------|------|
| `notification.new` | `{ id, type, title, message, resourceType, resourceId }` | 새 인앱 알림(적재 직후 바로 보낸다) |

## 6. 시스템 이벤트

구독이 필요 없다. 연결 전체에 자동으로 보낸다.

| 이벤트 | payload | 설명 |
|-------------|---------|------|
| `auth.token_expired` | `{ message, expiresAt }` | 토큰 만료 **사전 통지**. 만료 60초 전에 1회 보내고 `exp` 에 서버가 `disconnect()` 한다([WebSocket 연결과 채널 구독](CLE-API-WS.md)). `expiresAt` 은 ISO 8601 문자열이고 **이 소켓이 강제로 끊기는 시각**이다. `_retryState.expiresAt`(마지막 턴 재시도 TTL, [마지막 턴 재시도](CLE-API-WS-EVENTS-COMMANDS.md#24-마지막-턴-재시도-executionretry_last_turn))·`auth.refreshed.expiresAt`(비채택)과 **별개**다. 에러 코드 `TOKEN_EXPIRED` 는 REST·JWT 검증 코드일 뿐 이 이벤트와 다르다 |
| `system.maintenance` _(비채택)_ | `{ message, scheduledAt }` | 예정된 유지보수 알림. **발화 주체가 없다.** 유지보수를 선언하는 관리자 API·설정·스케줄이 없고 계획에도 없다. `scheduledAt` 은 사람이 미래 시점을 선언해야 성립해 그 표면은 새 제품 기능이다(근거: [WebSocket 연결과 채널 구독](CLE-API-WS.md) 의 Rationale). 다시 들일 때를 대비해 payload 형태를 남긴다 |
| `error` | 인증 실패 `{ message }`. 등록되지 않은 이벤트 `{ code: 'UNKNOWN_TYPE', message }` | 두 경로가 같은 이벤트 이름을 쓴다. 핸드셰이크에서 토큰이 없거나 무효면 `handleConnection` 이 `{ message }` 를 보내고 연결을 끊는다. 연결된 소켓이 등록되지 않은 이벤트를 보내면 게이트웨이 `onAny` 가 `{ code: 'UNKNOWN_TYPE', message }` 를 보내고 연결은 유지된다. 이 경로도 소켓의 빈도 제한 예산을 쓰고 예산을 넘은 이벤트에는 보내지 않는다. 규칙은 [WebSocket 연결과 채널 구독 「에러 처리」](CLE-API-WS.md#7-에러-처리) |
| `exception` | `{ code: 'RATE_LIMITED', message }` | 소켓당 명령 빈도 제한([HTTP API 규약 「요청 빈도 제한」](CLE-API-CONV.md#7-요청-빈도-제한)) 초과. `WsRateLimitGuard` 가 `WsException` 을 던지면 NestJS 가 보내는 이벤트이고 그 명령의 핸들러는 실행되지 않는다. HTTP 429 의 `RATE_LIMITED` 와 같은 이름의 별개 발행이다(카탈로그는 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md)). 처리되지 않은 서버 예외도 같은 이름으로 나가고 `code` 가 없을 수 있다. 규칙은 [WebSocket 연결과 채널 구독 「에러 처리」](CLE-API-WS.md#7-에러-처리) |

## 8. Background 본문 실행 이벤트 (Server → Client)

구독 채널: `background:run:{backgroundRunId}`. 키는 Background 본문 실행 하나의 ID(`backgroundRunId`)다. 이 절이 이 채널의 이벤트, payload, 봉투 필드의 정본이다. 채널 격리, 본문이 끝난 뒤의 조회, 종결 `status` 의 뜻 같은 동작 규칙은 [Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) 의 「실시간 갱신」 이 정하고 구독 인가는 [WebSocket 연결과 채널 구독](CLE-API-WS.md) §4.4 가 정한다.

백엔드 권위 정의는 `websocket-events.types.ts` 의 `BackgroundRunEventType` enum(2개)이다. Background 큐 워커(`BackgroundExecutionProcessor`)가 `WebsocketService.emitBackgroundRunEvent` 로 보낸다. 본문 안 노드의 이벤트(`execution.node.*`)는 이 채널이 아니라 메인 실행의 `execution:{executionId}` 채널로 간다([실행 이벤트](CLE-API-WS-EVENTS.md#1-실행-이벤트-server--client)).

| 이벤트 | payload | 설명 |
|-------------|---------|------|
| `execution.background_run.started` | `{ executionId, parentNodeExecutionId, startedAt }` | 큐 워커가 본문 실행을 받아 시작할 때 |
| `execution.background_run.completed` | `{ executionId, parentNodeExecutionId, status: 'completed' \| 'failed', completedAt, durationMs, errorMessage? }` | 본문 실행이 끝날 때. `errorMessage` 는 `failed` 일 때만 있다 |

- `executionId`: Background 노드가 속한 메인 실행의 ID 다. 발행처가 payload 에 넣는 필드이고 봉투 필드가 아니다.
- `parentNodeExecutionId`: Background 노드의 `NodeExecution.id` 다. 메인 채널에서 본문 노드 이벤트를 거르는 키와 같다.
- `startedAt`·`completedAt` 은 ISO 8601 이다. `durationMs` 는 큐 워커가 본문 실행을 받은 때부터 끝날 때까지의 시간(ms)이다.
- `errorMessage` 는 `sanitizeErrorMessage` 로 정제한 문구다.

**봉투 필드**: 이 채널은 실행 이벤트 봉투([WebSocket 연결과 채널 구독](CLE-API-WS.md) §3.2)를 쓰지 않는다. 발행 관문 `emitBackgroundRunEvent` 가 payload 최상위에 아래 필드를 더해 평면 객체 하나로 보낸다.

| 필드 | 값 |
|------|----|
| `backgroundRunId` | 채널 키와 같은 본문 실행 ID. 늘 붙는다 |
| `timestamp` | 발행 시각(ISO 8601). 늘 붙는다 |
| `seq` | 보내지 않는다. 이벤트 순번은 `execution:` 채널에만 있다 |

예시는 `execution.background_run.started` 이벤트다.

```json
{
  "backgroundRunId": "…",
  "executionId": "…",
  "parentNodeExecutionId": "…",
  "startedAt": "2026-11-13T03:00:00.000Z",
  "timestamp": "2026-11-13T03:00:00.004Z"
}
```

- **마스킹**: 관문은 payload 에 키 이름 마스킹(`sanitizePayloadForWs`)을 건 뒤 봉투 전체에 `execution:` wire 와 같은 값 마스킹(`maskWireEnvelope`)을 건다. 뷰어도 이 채널을 구독할 수 있어 수신 인구가 `execution:` 과 같기 때문이다. 규칙은 [응답 자격 증명 마스킹](CLE-API-EGRESS.md) §3.11 이 정한다. 이 채널은 외부 fanout 으로 가지 않는다.
- **발행 실패**: 발행은 best-effort 다. 실패하면 경고 로그만 남기고 본문 실행과 실패 알림은 그대로 진행한다.
- **`backgroundRunId` 가 없는 본문 실행**: 채널 키가 없어 이벤트를 보내지 않는다. `backgroundRunId` 를 도입하기 전에 만든 노드 실행의 본문이 그렇다.

## 구현 위치

- `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts` (`BackgroundExecutionProcessor`. Background 본문 실행 이벤트 발행처)
- `codebase/backend/src/modules/websocket/ws-rate-limit.guard.ts` (`WsRateLimitGuard`. 명령 빈도 제한을 넘으면 `WsException` 을 던져 `exception` 이벤트가 나간다)
- `codebase/backend/src/modules/websocket/ws-rate-limiter.service.ts` (`WsRateLimiterService`. 소켓별 분당 예산. 게이트웨이 `onAny` 도 같은 예산을 쓴다)

## Rationale

### 지식 저장소 채널을 문서 단위로 바꾼 이유 (`embedding:{knowledgeBaseId}` → `kb:{documentId}`)

지식 저장소 임베딩 진행 상태는 **문서 단위 채널**로 보낸다(`WebsocketService.emitKbEvent`, union 정의는 `KbEventType`, `kb:${documentId}` 채널). 프론트엔드 `useKbEvents` 도 문서별로 구독한다.

- 문서별로 진행 상태를 따로 추적할 수 있어 진행 표시가 문서마다 갱신된다.
- 권한 검증을 문서 소유 지식 저장소 단위로 나누기 쉽다.
- 프론트엔드가 가진 문서 ID 만큼만 구독하므로 무관한 지식 저장소 이벤트의 잡음을 막는다.

이벤트 표기는 콜론과 밑줄(`document:embedding_started`)을 쓴다. 백엔드 타입 union 형식과 맞춘 것이다.
