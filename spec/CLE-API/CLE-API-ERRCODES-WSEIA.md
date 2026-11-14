---
id: "CLE-API-ERRCODES-WSEIA"
title: "에러 코드 카탈로그 — WebSocket · EIA · Background Runs"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-ERRCODES"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-ERRCODES"]
area: "CLE-API"
content_hash: "097a22c6fa75ef09fe384dbdb209195f0327fdb63877734c95a8262cd764294f"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "21e5ebf334631f33bc3066bc1044ff43720352264625387315f9af7ca8ac28e9"
etag: "sha256-04d17fd229d38900808c36e089b0459221a9e0ee7c54d44d0fac350e4935565a"
---
## 개요

이 문서는 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 의 하위 문서로 카탈로그 가운데 WebSocket 명령 코드(§6.7), WebSocket 전송 코드(§6.8), EIA REST 외부 표면 코드(§6.9), Background Runs REST 코드(§6.24)를 정한다.

## 6.7 WebSocket 명령: 재개 명령과 마지막 턴 재시도 (도메인 문서 참조)

주로 WebSocket ack 에 싣는 코드다. 예외는 `SERVER_SHUTTING_DOWN` 과 `EXECUTION_ENQUEUE_FAILED` 다. 두 코드는 ack 에 싣지 않고 HTTP 진입점에서만 503 으로 쓴다(진입점은 행마다 적는다). 설계 원칙은 [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) Rationale 의 `SERVER_SHUTTING_DOWN` 503 선례다. 두 코드를 이 절에 둔 이유는 [Rationale](#execution_enqueue_failed-를-eia-interact-재개-명령에도-쓴다-2026-10-09) 에 있다. 적용 명령 범위와 ack 형태는 [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) 이 정한다.

| 코드 | 설명 | 정의 문서 |
|------|------|-----------|
| `INVALID_EXECUTION_STATE` | 실행이 기대한 상태가 아님(재개 명령 넷(`submit_form` · `click_button` · `submit_message` · `end_conversation`)은 입력 대기, `retry_last_turn` 은 `failed` 를 기대). 동기 ack 응답이고 BullMQ 에 넣지 않는다 | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md), [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `INVALID_BUTTON_ID` | 존재하지 않는 버튼 ID(`click_button`) | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `INTERACTION_TIMEOUT` | 이미 타임아웃이 발생한 상태 | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `VALIDATION_ERROR` (ack) | `submit_form` 의 필드 검증 실패. ack 는 평면 `errorCode` 이고 필드별 `details[]` 가 없다. EIA REST 의 `400 VALIDATION_ERROR` 와 같은 뜻, 같은 검증 지점이다 | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `EXECUTION_MESSAGE_TOO_LONG` | `submit_message` 메시지가 최대 길이(10000자)를 넘음. 발행 쪽 동기 검증(typed `MessageTooLongError`) | [WebSocket 이벤트와 명령 「2.3 재개 명령의 에러」](CLE-API-WS-EVENTS.md#23-재개-명령의-에러), [큐 워커와 동시 실행 제한 「발행 결과와 ack 에러 표면」](../CLE-EXEC/CLE-EXEC-WORKER.md#발행-결과와-ack-에러-표면) |
| `EXECUTION_INTERNAL_ERROR` | 재개 처리 중 typed `ExecutionError` 가 아닌 내부 에러의 일반 fallback. ack `error` 는 고정 일반 문자열이고 내부 메시지는 클라이언트에 보내지 않는다(서버 로그 전용) | [WebSocket 이벤트와 명령 「2.3 재개 명령의 에러」](CLE-API-WS-EVENTS.md#23-재개-명령의-에러), [큐 워커와 동시 실행 제한 「발행 결과와 ack 에러 표면」](../CLE-EXEC/CLE-EXEC-WORKER.md#발행-결과와-ack-에러-표면) |
| `RESUME_CHECKPOINT_MISSING` | rehydration 때 재개에 필요한 영속 상태가 없거나 손상됨(예: `NodeExecution.outputData`, 중첩 재개의 호출 스택 frame). 실행이 `cancelled` 로 끝난다. ack 가 아니라 뒤따르는 `execution.cancelled` 의 `error.code` 로 알린다 | [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `RESUME_FAILED` | 재개 큐의 `RESUME_BULLMQ_ATTEMPTS` 소진. 실행이 `cancelled` 로 끝난다. 뒤따르는 `execution.cancelled` 의 `error.code` 로 알린다 | [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `RESUME_INCOMPATIBLE_STATE` | 멀티턴 AI 의 `_resumeCheckpoint` 가 없음(기능 배포 전에 들어간 대기 행), 손상됨(스키마 변경으로 재구성 실패), 미래 버전임(`schemaVersion` 이 현재 코드가 지원하는 버전보다 큼. 롤링 배포 중 옛 인스턴스가 새 형식을 가져간 경우). 실행이 `cancelled` 로 끝나고 채널에는 "세션 만료" 안내를 보낸다. 정상 경로(checkpoint 가 있고 버전이 호환)는 재구성해 재개하므로 생기지 않는다 | [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| `RETRY_STATE_NOT_FOUND` | `retry_last_turn` 대상 행의 `_retryState` 가 없거나 만료됨(TTL 초과 또는 다른 재시도가 이미 소비) | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `NODE_NOT_RETRYABLE` | 대상 노드가 재시도 가능한 에러로 끝나지 않음(`outputData.output.error.details.retryable === false`, 정상 종결, 조건 종결 등) | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `RETRY_TOO_EARLY` | `outputData.output.error.details.retryAfterSec` 카운트다운이 끝나기 전에 호출함(서버 쪽 강제) | [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `SERVER_SHUTTING_DOWN` | 서버가 SIGTERM 을 받은 뒤 새 실행을 시작할 수 없음. 새 실행을 시작하는 HTTP 진입점(`POST /api/workflows/:id/execute`, 단일 노드 실행 `POST /api/workflows/:id/nodes/:nodeId/execute`)이 503 으로 낸다 | [장애 복구와 안전 종료 「안전 종료」](../CLE-EXEC/CLE-EXEC-RECOVERY.md#안전-종료) |
| `EXECUTION_ENQUEUE_FAILED` | 입력 대기 실행에 보내는 취소와 재개 명령에서 재개 메시지 발행(BullMQ `queue.add`) 자체가 실패함. `publish` 가 `queued:false`(Redis 장애 등으로 큐에 들어가지 못함)를 돌려준 경우다. HTTP 진입점은 503 이고 실행은 입력 대기 상태를 유지한다(`failed` 아님). 다시 시도를 권한다. 이 코드를 내는 HTTP 진입점은 셋이다. REST `POST /executions/:id/stop`, External Interaction API `/interact`(별칭 `POST .../cancel` 포함), 채팅 채널 인바운드의 `/start` 다. External Interaction API 에서 어느 요청이 이 코드를 받는지는 [EIA 수신 API와 SSE 「명령 에러」](../CLE-IX/CLE-EIA-INBOUND.md#명령-에러) 가 정한다. 채팅 채널의 `/start` 는 활성 실행을 취소할 때 `ExecutionsService.stop` 을 직접 부르고 이 503 을 그대로 돌려준다. 이때 새 실행은 시작하지 않고 프로바이더는 non-2xx 를 받아 같은 update 를 다시 보낼 수 있다([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md)). 채팅 채널 인바운드의 `/cancel` 과 재개 입력은 이 코드를 내지 않는다. 큐에 넣지 못해도 `202` 로 응답하고 채널 건강도를 `degraded` 로 바꾼다([채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약)). WebSocket 재개 명령 4종은 이 코드를 싣지 않는다. 같은 발행 실패는 `errorCode` 없는 실패 ack(`success:false`)로 알린다. `SERVER_SHUTTING_DOWN` 503 선례와 같은 형태이고 큐에 들어간 뒤 재개가 실패하는 워커 쪽 비동기 실패(`RESUME_*`)와 구분한다 | [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md#발행-결과와-ack-에러-표면), [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md#인바운드-명령과-재개), [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) |

## 6.8 WebSocket 전송 (도메인 문서 참조)

`ws-error-codes.ts` 의 `WsErrorCode` 가 정의하는 전송·구독 층 코드다. 형태와 전달 경로는 [WebSocket 연결과 채널 구독](CLE-API-WS.md) 의 에러 절이 정한다.

| 코드 | 설명 | 정의 문서 |
|------|------|-----------|
| `UNAUTHENTICATED` | 소켓에 사용자 ID 가 없음(구독 ack 의 `code`) | [WebSocket 연결과 채널 구독](CLE-API-WS.md) |
| `FORBIDDEN` (WebSocket) | 권한 없음(일반) | [WebSocket 연결과 채널 구독](CLE-API-WS.md) |
| `NOT_FOUND` (WebSocket) | 리소스가 없거나 소유 검증 실패 | [WebSocket 연결과 채널 구독](CLE-API-WS.md) |
| `INTERNAL_ERROR` (WebSocket) | 서버·전송 내부 실패(큐 적재 실패 등). `retry_last_turn` 의 중첩 `error.code` 등에 쓴다. 재개 명령 평면 ack 의 `EXECUTION_INTERNAL_ERROR`(§6.7)와 별개 범위다 | [WebSocket 연결과 채널 구독](CLE-API-WS.md) |
| `INVALID_MESSAGE` | 구독 등 WebSocket 메시지의 채널이 유효하지 않거나 필수 필드가 없음. 구독 ack 의 `code`(평문 `error` 에 더해 싣는다) | [WebSocket 연결과 채널 구독](CLE-API-WS.md) |
| `UNKNOWN_TYPE` | 등록되지 않은 이벤트 이름. 게이트웨이 `onAny` 가 `error` 이벤트 `{ code, message }` 로 알린다(Socket.IO 가 조용히 버리는 것을 보완) | [WebSocket 연결과 채널 구독](CLE-API-WS.md) |
| `SUBSCRIPTION_LIMIT_EXCEEDED` | 소켓당 구독 한도(20) 초과. 구독 ack 의 `code` | [WebSocket 연결과 채널 구독](CLE-API-WS.md) |
| `RATE_LIMITED` (WebSocket) | WebSocket 명령 빈도 제한(소켓당 분당 60건) 초과. `WsRateLimitGuard` 가 `WsException` 을 던지고 클라이언트는 `exception` 이벤트 `{ code, message }` 로 받는다. EIA REST `/interact` 의 같은 이름 `RATE_LIMITED`(HTTP 429)와는 표면과 전송이 다른 별개 발행이다 | [WebSocket 연결과 채널 구독](CLE-API-WS.md) |

## 6.9 EIA REST 외부 표면 (도메인 문서 참조)

External Interaction API(`/api/external/*`) 전용 코드다. 외부 호출자 표면이라 [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) 의 기본 코드를 의도적으로 바꾼다.

| 코드 | HTTP | 설명 | 비고 | 정의 문서 |
|------|--------|------|------|-----------|
| `INVALID_COMMAND` | 400 | 지원하지 않는 command 이거나 필수 필드 누락 | 400 기본 `VALIDATION_ERROR` 대신 쓰는 명령 분기 전용 코드 | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |
| `MESSAGE_TOO_LONG` | 400 | `submit_message` 메시지가 최대 길이를 넘음 | 내부 길이 수치를 드러내지 않는다 | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |
| `STATE_MISMATCH` | 409 | 재개 명령이 현재 노드·실행 상태와 맞지 않음 | 발행 쪽 사전 검증 | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | 같은 멱등 키(`Idempotency-Key`)에 다른 본문 | | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |
| `EXECUTION_TERMINATED` | 410 | 실행이 이미 completed·failed·cancelled 다. 토큰 갱신(`POST .../refresh-token`)에서는 없는 실행도 이 코드로 합친다(404 아님) | | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |
| `TOKEN_REFRESH_NOT_IN_WINDOW` | 400 | 토큰 갱신 전용. 만료까지 30분(`IEXT_REFRESH_WINDOW_SEC`)보다 많이 남아 아직 갱신할 때가 아님 | | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |
| `TOKEN_REFRESH_FAILED` | 400 | 토큰 갱신 전용. 갱신이 토큰을 돌려주지 못함(안전망) | | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |
| `TOKEN_REFRESH_FORBIDDEN` | 403 | 토큰 갱신 전용. 트리거 단위 토큰(`itk_*`)은 영구 토큰이라 갱신 대상이 아님. 아래 401 통일의 **예외**다. 토큰 검증 실패가 아니라 검증을 통과한 토큰을 잘못된 표면에 쓴 경우다 | EIA 표면의 유일한 403 | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |
| `TOKEN_REVOKED` · `TOKEN_SCOPE_MISMATCH` · `TOKEN_AUDIENCE_MISMATCH` | 401 | 인터랙션 토큰(`iext_*`, `itk_*`) **검증** 실패. 모든 토큰 검증 실패는 정보 노출을 줄이려고 401 하나로 돌려준다. 여기서 "검증 실패" 는 `InteractionGuard` 가 핸들러 전에 판정하는 집합이고 위 `TOKEN_REFRESH_FORBIDDEN` 은 그 뒤 서비스 계층 판정이라 대상이 아니다. §6.2 의 워크스페이스 JWT 층 `TOKEN_INVALID`·`TOKEN_EXPIRED` 와 같은 문자열도 쓰지만 진입점(`/api/external/*`)과 토큰 family 로 층이 갈린다 | 폐기는 종결 시 즉시 무효화한다(최소 한 번, [External Interaction API 「종료 시 토큰 폐기」](../CLE-IX/CLE-EIA.md#종료-시-토큰-폐기)) | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) 의 「토큰 검증 실패는 모두 401」 Rationale |
| `EXECUTION_NOT_FOUND` (트리거 단위 토큰) | 401 | 트리거 단위 토큰(`itk_*`)으로 보낸 요청이나 연 스트림에서 실행이 없거나 그 실행의 트리거가 지워짐. 가드(`InteractionGuard`)가 핸들러 전에 판정해 401 로 돌려준다. 다른 엔드포인트의 404 `EXECUTION_NOT_FOUND` 와 뜻은 같고 상태만 다르다. 이 행을 둔 이유는 [Rationale](#트리거-단위-토큰-경로의-부재는-401-execution_not_found-로-적는다-2026-10-17) 에 있다 | EIA 전용 코드가 아니다. 표준 코드를 401 로 쓴다 | [EIA 수신 API와 SSE 「명령 에러」](../CLE-IX/CLE-EIA-INBOUND.md#명령-에러), [EIA 수신 API와 SSE 「스트림 연결 오류」](../CLE-IX/CLE-EIA-INBOUND.md#스트림-연결-오류) |
| `TOO_MANY_CONNECTIONS` | 429 | 실행당 SSE 동시 연결 상한 초과. 429 기본 `RATE_LIMITED` 와 별개인 EIA SSE 전용 코드 | | [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) |

`VALIDATION_ERROR`(`submit_form` 필드 검증), `EXECUTION_NOT_FOUND`(404 행은 §6.24, 트리거 단위 토큰 경로는 위 표의 401 행), `TOKEN_INVALID`·`TOKEN_EXPIRED`(401), `EXECUTION_ENQUEUE_FAILED`(503, §6.7)는 표준 코드를 그대로 다시 쓴다(EIA 전용 아님). EIA 에서 어느 요청이 `EXECUTION_ENQUEUE_FAILED` 를 받는지와 이 503 의 멱등 캐시 처리는 [EIA 수신 API와 SSE 「명령 에러」](../CLE-IX/CLE-EIA-INBOUND.md#명령-에러) 가 정한다. `/interact` · `/cancel` · 상태 조회의 빈도 제한 초과는 `RATE_LIMITED`(429)다. `/cancel` 은 `/interact` 와 같은 카운터를 세고 수치는 [HTTP API 규약 「7. 요청 빈도 제한」](CLE-API-CONV.md#7-요청-빈도-제한) 이 정한다.

## 6.24 Background Runs REST (도메인 문서 참조)

`GET /api/executions/:executionId/background-runs/:backgroundRunId`(`cursor` · `limit` query)가 내는 코드다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `INVALID_LIMIT` | 400 | `limit` 이 1~200 밖임. 이 경로에서는 요청 DTO 검증이 먼저 `VALIDATION_ERROR` 로 답한다. 지금 이 코드가 응답에 나가는 곳은 지식 저장소 그래프 시각화(`GET /api/knowledge-bases/:id/graph/visualization`)의 `limit` 검사다 | [Background 노드 「API 에러 코드」](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md#api-에러-코드), [Graph RAG 「API」](../CLE-KB/CLE-KB-GRAPH.md#api) |
| `INVALID_CURSOR` | 400 | `cursor` 를 해석하지 못함. 실행 소유권 검사보다 먼저 판정한다 | [Background 노드 「API 에러 코드」](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md#api-에러-코드) |
| `EXECUTION_NOT_FOUND` | 404 | 실행이 없거나 그 워크플로우가 요청자의 워크스페이스에 없음. EIA REST 도 같은 404 를 쓴다(§6.9 표 아래). 트리거 단위 토큰 경로의 401 은 §6.9 행이다 | [Background 노드 「API 에러 코드」](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md#api-에러-코드) |
| `BACKGROUND_RUN_NOT_FOUND` | 404 | `backgroundRunId` 가 그 실행에 없음 | [Background 노드 「API 에러 코드」](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md#api-에러-코드) |

## Rationale

### `EXECUTION_ENQUEUE_FAILED` 를 EIA `/interact` 재개 명령에도 쓴다 (2026-10-09)

이 코드의 행은 처음에 REST `POST /executions/:id/stop` 의 입력 대기 취소만 적었다. EIA `/interact` 의 `cancel` 과 그 별칭 `POST .../cancel` 도 같은 `ExecutionsService.stop` 을 불러 이미 이 코드를 냈다. 그때 코드에서 재개 명령 4종은 발행 결과(`queued`)를 보지 않고 202 `accepted:true` 를 냈다. 이 202 는 24시간 멱등 캐시에 들어간다. 그러면 같은 멱등 키로 다시 보내도 캐시된 202 가 돌아오고 명령은 끝내 재개 큐에 들어가지 못한다. 그래서 재개 명령 4종도 `cancel` 과 같이 503 `EXECUTION_ENQUEUE_FAILED` 로 응답하게 정했다. 이 결정은 기본값으로 정해 알린 뒤 진행했다. 503 은 멱등 캐시 대상(2xx·409·410)이 아니므로 다시 보내면 새로 처리한다. 결정 이력은 NERV Task `CLE-T-M6PERB` 에 있다.

- **새 코드를 만들지 않았다.** 조건의 뜻이 REST `stop` 과 같다. 두 경우 모두 발행 자체가 실패했고 실행은 입력 대기에 남는다. 클라이언트가 할 일도 다시 보내기 하나다. 그래서 규칙 6 의 새 조건이 아니다.
- **표면마다 코드를 나누지 않았다.** §6 머리말은 같은 뜻이라도 표면마다 다른 코드를 쓴다고 적는다. 그러나 EIA `cancel` 은 REST `stop` 과 같은 서비스 메서드를 부르므로 이 코드는 이미 두 표면에서 나가고 있었다. 재개 명령에 EIA 전용 코드를 주면 `/interact` 한 표면 안에서 같은 조건이 두 코드로 갈린다. 이 예외는 §6 머리말에도 적었다.
- **외부 API 를 내부 구현 식별자에 묶지 않는다는 원칙과 부딪치지 않는다(2026-10-17).** [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) 의 「WS 코드와 EIA 코드는 경로마다 다르게 쓴다」 Rationale 은 EIA REST 가 `EXECUTION_*` 를 그대로 드러내면 외부 API 가 내부 구현 식별자에 묶인다고 적는다. 그 Rationale 이 다루는 것은 WebSocket ack 와 EIA REST 가 함께 쓰는 실행 엔진 사전 검증의 코드다(`INVALID_EXECUTION_STATE` · `EXECUTION_MESSAGE_TOO_LONG`). `EXECUTION_ENQUEUE_FAILED` 는 그 부류가 아니다. WebSocket ack 에 싣지 않는 HTTP 진입점의 표준 코드이고 EIA `cancel` 이 먼저 내고 있었다. 뜻도 «명령을 큐에 넣지 못했으니 다시 보내라» 하나라 실행 엔진의 내부 상태나 typed error 를 드러내지 않는다. EIA REST 는 표준 코드 `EXECUTION_NOT_FOUND`(404)와 EIA 전용 `EXECUTION_TERMINATED`(410)도 이미 쓴다(§6.9). 그래서 `EXECUTION_` 접두어만으로 내부 식별자라고 보지 않는다.
- **202 의 `accepted: true` 는 큐에 들어간 명령에만 붙는다(2026-10-17).** [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) 의 「`interact`·`cancel` 은 202 와 ack 본문」 Rationale 은 `accepted: true` 가 큐 적재 성공을 명시한다고 적는다. 발행 결과를 보지 않고 202 를 내던 옛 재개 명령은 이 약속과 어긋났다. 큐에 넣지 못하면 503 으로 응답하므로 이제 202 와 `accepted: true` 가 큐 적재 성공과 맞는다.
- **WebSocket 재개 명령은 바꾸지 않았다.** 이 경로의 발행 실패는 `errorCode` 없는 실패 ack(`success:false`)로 바로 돌아간다. ack 는 요청마다 한 번 보내는 응답이라 어디에도 저장하지 않는다. 그래서 클라이언트는 실패를 보고 다시 보낼 수 있다. EIA REST 는 2xx 응답을 멱등 캐시에 넣으므로 실패를 2xx 로 알리면 재시도로 바로잡을 수 없다. 이 차이 때문에 EIA REST 만 HTTP 상태 코드(503)로 실패를 알린다.
- **채팅 채널 인바운드의 재개 명령은 이 코드를 내지 않는다.** 채팅 채널 인바운드는 서버 안에서 내부 신뢰 호출(`in_process_trusted`)로 같은 재개 명령을 부른다. 이 경로가 503 을 던지면 웹훅을 보낸 채널 프로바이더에게 5xx 가 나간다. 그 응답은 [채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약) 이 따로 정한다. 그래서 재개 명령의 503 은 HTTP 진입점의 응답으로 한정했다. 2026-10-17 에 사람이 이 경로의 큐 적재 실패를 `202` 와 채널 건강도 `degraded` 로 처리하기로 정했다(NERV Task `CLE-T-EQDYC1`).
- **예외는 채팅 채널 `/start` 의 기존 실행 취소다.** `/start` 는 활성 실행을 취소할 때 재개 명령을 거치지 않고 `ExecutionsService.stop` 을 직접 부른다. 그래서 취소 메시지를 큐에 넣지 못하면 이 503 을 그대로 돌려주고 새 실행은 시작하지 않는다([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md), NERV Task `CLE-T-V4WVF2`). 프로바이더는 non-2xx 를 받아 같은 update 를 다시 보낼 수 있다. 5xx 를 받아들인 이유는 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 의 「R-CC-27 활성 실행 중 /start 는 기존 실행을 취소하고 새로 시작한다」 Rationale 에 있다.
- **`/start` 의 취소 실패에도 새 코드를 만들지 않았다.** 조건의 뜻이 REST `stop` 과 같다. 취소 메시지 발행 자체가 실패했고 실행은 입력 대기에 남는다. 할 일도 다시 보내기 하나다. 그래서 규칙 6 의 새 조건이 아니다.
- **채팅 채널 `/cancel` 은 이 코드를 내지 않는다(2026-10-17).** `/cancel` 도 `/start` 처럼 `ExecutionsService.stop` 을 직접 부른다. 취소 메시지를 큐에 넣지 못하면 `stop` 이 이 503 을 던진다. 채팅 채널 인바운드는 이 503 을 프로바이더에 돌려주지 않고 `202` 로 응답한다. 채널 건강도는 `degraded` 가 되고 실행은 입력 대기에 그대로 있다. 응답과 건강도 규칙은 [채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약) 이 정한다(사람 결정, NERV Task `CLE-T-EQDYC1`). 기각한 대안은 `/start` 처럼 503 을 돌려주는 안이다. `/start` 의 503 은 옛 실행을 남긴 채 새 실행을 시작하지 않으려는 예외다. `/cancel` 에는 그런 이유가 없고 인바운드 응답의 `202` 고정 규칙에 예외만 늘어난다. 실패는 채널 건강도와 경고 로그에 남고 사용자는 `/cancel` 을 다시 보낼 수 있다.
- **WebSocket 재개 명령의 발행 실패는 실패 ack 로 알린다.** 코드(`websocket.gateway.ts`)는 `queued:false` 일 때 `errorCode` 없는 실패 ack(`success:false`)를 보낸다. 이 카탈로그는 처음부터 코드를 따랐고 [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) 과 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 도 2026-10-17 에 코드에 맞췄다.
- **이 코드를 쓰는 진입점이 넓어졌다.** [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 의 Rationale 「발행 실패를 `queued:false` 하나로 알린다 (C-1·M-7)」 은 취소가 WebSocket ack 경로가 아니라 REST 중지 진입점이라서 이 코드로 표기한다고 적는다. ack 가 아닌 HTTP 진입점이라는 근거는 `/interact` 에도 그대로 맞는다. 다만 이 코드가 모든 HTTP 진입점에 쓰이지는 않는다. 채팅 채널 인바운드의 `/cancel` 과 재개 입력에는 `202` 로 응답하고 채팅 채널에서 이 코드가 나가는 곳은 `/start` 뿐이다.
- **두 503 코드를 §6.7 에 둔 이유(2026-10-17).** `EXECUTION_ENQUEUE_FAILED` 와 `SERVER_SHUTTING_DOWN` 은 WebSocket ack 에 싣지 않는데 «WebSocket 명령» 절에 있다. `EXECUTION_ENQUEUE_FAILED` 는 재개 명령의 발행 결과를 알리는 코드다. 그래서 같은 명령의 다른 실패 코드(`INVALID_EXECUTION_STATE` · `RESUME_*`)와 한곳에서 찾게 했다. `SERVER_SHUTTING_DOWN` 은 이 절 머리말이 설계 원칙으로 가리키는 503 선례라 그 자리에 둔다. 대신 §6 머리말과 §6.7 머리말에 두 코드가 HTTP 진입점 전용이라고 적었다. 기각한 대안은 두 코드를 HTTP 진입점용 새 절로 옮기는 안이다. [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 이 이 코드를 §6.7 의 제목 앵커로 가리키므로 옮기면 그 링크가 끊긴다. 재개 명령의 실패 코드도 두 절로 나뉜다.
- **EIA 에서 이 코드를 받는 범위는 EIA 문서가 정한다(2026-10-17).** 이 카탈로그는 코드의 뜻과 이 코드를 내는 진입점만 적는다. §6.7 행과 §6.9 는 EIA 의 범위를 다시 적지 않고 [EIA 수신 API와 SSE 「명령 에러」](../CLE-IX/CLE-EIA-INBOUND.md#명령-에러) 를 가리킨다. 그 문서의 503 행은 코드의 정의를 이 카탈로그에 맡긴다. 같은 범위를 두 문서에 적으면 한쪽만 고쳤을 때 두 문서가 어긋난다. 그래서 각 문서가 맡는 몫을 나눠 서로를 기준으로 가리키지 않게 했다.

### 트리거 단위 토큰 경로의 부재는 401 `EXECUTION_NOT_FOUND` 로 적는다 (2026-10-17)

[EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) 는 트리거 단위 토큰(`itk_*`)으로 보낸 요청과 연 스트림에서 실행이 없거나 그 실행의 트리거가 지워졌으면 `EXECUTION_NOT_FOUND` 를 401 로 돌려준다고 적는다(「명령 에러」, 「스트림 연결 오류」). 가드가 핸들러 전에 이 판정을 한다. 이 카탈로그는 이 코드를 404 로만 적어 두 문서의 상태가 갈렸다. 2026-10-17 스펙 일관성 검토에서 드러난 어긋남이다. 그래서 §6.9 에 401 행을 더했다.

- **규칙 6 의 새 조건으로 보지 않았다.** 정의 문서는 이 401 도 부재(실행이 없거나 트리거가 지워짐)를 뜻한다고 적는다. 뜻은 404 와 같고 상태만 다르다. 워크스페이스 · 범위 경계 위반은 먼저 `TOKEN_SCOPE_MISMATCH`(401)가 되므로 이 코드에 들지 않는다.
- **[예외 · 내부 분류 · 은퇴 코드](CLE-API-ERRCODES-EXCEPT.md#모델-설정-코드-분리-model_config_not_found404와-model_config_default_missing400) 의 「모델 설정 코드 분리」 선례와 다르다.** 그 선례에서는 같은 코드가 두 상태를 가져 코드를 나눴다. 두 상태가 서로 다른 뜻(지정한 설정 없음, 기본값 미설정)을 담았기 때문이다. 이번에는 뜻이 하나다. 두 상태는 판정하는 자리만 다르다. 트리거 단위 토큰 경로에서는 핸들러가 아니라 가드가 부재를 판정한다.
- **`WORKSPACE_NOT_FOUND` 의 두 상태와도 다르다.** 그 코드의 404 와 401 은 뜻이 달라 「미결 사항」 에 올렸다(2026-11-12 에 401 을 새 코드로 나누기로 정했다). 이 코드의 두 상태는 뜻이 같아 미결로 올리지 않았다.
- **상태를 하나로 맞출지는 정의 문서가 정한다.** 카탈로그는 정의 문서를 따른다(규칙 8). 그래서 정의 문서의 401 을 그대로 적었다.
