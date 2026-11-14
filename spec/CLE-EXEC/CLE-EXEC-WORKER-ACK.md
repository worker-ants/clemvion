---
id: "CLE-EXEC-WORKER-ACK"
title: "큐 워커 — 재개 ack 에러 표면"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-WORKER"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-WORKER"]
area: "CLE-EXEC"
content_hash: "ec3c26a416fdacfda489a5d61e9101d268151dbc2b5e9a7254704024d21e313c"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "9866f09b1e98d16b6088fb3d416901f65255ef23d6aebf4b73c128124364ef61"
etag: "sha256-7d3162482108a10d671f044836b81a8a1f99439a7aa7119c634b5ba0b07c34c8"
---
## 개요

이 문서는 [큐 워커와 동시 실행 제한](CLE-EXEC-WORKER.md) 의 하위 문서로 재개 명령의 발행 결과(`ContinuationPublishResult`), 큐 적재 실패 때 진입점별 응답, 동기 ack 의 뜻, 발행 경로 에러의 ack 변환을 정한다. 재개 큐 계약과 발행 전 사전 검증은 [큐 워커 — 재개 큐와 사전 검증](CLE-EXEC-WORKER-RESUME.md) 이 정한다.

## 발행 결과와 ack 에러 표면

**발행 결과**: 재개 진입점은 발행 결과 `ContinuationPublishResult`(`queued:false` 는 `jobId:null` 과 짝)를 호출자에게 돌려준다. 큐에 넣지 못했을 때(`queued:false`) 호출자에게 나가는 응답은 진입점마다 다르다.

| 진입점 | 큐 적재 실패 때의 응답 |
| --- | --- |
| WebSocket 재개 명령 4종(`execution.submit_form` / `click_button` / `submit_message` / `end_conversation`) | 실패 ack `{ success:false, error:'Continuation could not be queued. Please try again.' }`. `errorCode` 는 싣지 않는다. 성공 ack 에 `queued:false` 를 싣는 경우는 없다. ack 는 서버에 저장되지 않으므로 클라이언트는 같은 명령을 다시 보낸다. |
| WebSocket `execution.retry_last_turn` | 실패 ack 의 `error` 는 `{ code:'INTERNAL_ERROR', message }` 객체다. 새로 만든 `running` 행은 `failed` 로 마감한다. `_retryState` 는 이미 소비됐으므로 다시 보내면 `RETRY_STATE_NOT_FOUND` 가 온다. 형식은 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 에 있다. |
| REST `POST /executions/:id/stop` 의 입력 대기 취소 분기 | **503 `EXECUTION_ENQUEUE_FAILED`**. 안전 종료 중의 `SERVER_SHUTTING_DOWN` 503 과 같은 모양이다. 클라이언트는 다시 시도한다. |
| EIA `/interact` 재개 명령 4종과 입력 대기 실행의 `cancel`(별칭 `POST /api/external/executions/:id/cancel` 포함) | **503 `EXECUTION_ENQUEUE_FAILED`**. 이 응답은 멱등 캐시에 넣지 않는다. 같은 `Idempotency-Key` 로 다시 보내면 새로 처리한다. 503 을 받는 요청의 범위는 [EIA 수신 API와 SSE 「명령 에러」](../CLE-IX/CLE-EIA-INBOUND.md#명령-에러) 에 있다. |
| 채팅 채널 인바운드의 `/cancel` 과 진행 중인 대화의 입력(재개 명령) | `202` 로 답하고 채널 건강도를 `degraded` 로 둔다. 기준은 [채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약) 이다. |
| 채팅 채널 인바운드의 `/start`(기존 실행 취소) | 503 `EXECUTION_ENQUEUE_FAILED` 를 그대로 돌려주고 새 실행을 시작하지 않는다. 기준은 같은 채팅 채널 절이다. |

진입점마다 표면이 다른 이유는 [Rationale 「진입점마다 큐 적재 실패를 다르게 알린다」](#진입점마다-큐-적재-실패를-다르게-알린다-2026-10-17) 에 있다.

- 성공(`queued:true`) 직후 다시 조회하면 실행이 아직 `pending` 이나 `running` 일 수 있다. 최종 취소는 뒤따르는 `execution.cancelled` 이벤트로 확인한다.
- seq 발급(Redis INCR)이 실패하면 무작위 seq 로 대신하지 않는다. `publish` 가 `null`(`queued:false`)을 돌려준다(fail-fast).

**ack 의 뜻**: 성공 ack 의 `resumed` / `queued` 는 enqueue 수락 신호다. 동기 ack 가 싣는 실패는 세 가지다. [발행 전 사전 검증](CLE-EXEC-WORKER-RESUME.md#발행-전-사전-검증) 의 거부, 아래 「ack 에러 변환」 이 바꾼 발행 경로의 에러, 위 표의 큐 적재 실패다. 워커 쪽에서 나중에 실패하는 rehydration(`RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE`)은 뒤따르는 `execution.cancelled` 이벤트의 `error.code` 로 알린다.

**ack 에러 변환**: 재개 handler 4종(`execution.submit_form` / `click_button` / `submit_message` / `end_conversation`)은 발행 경로에서 던져진 에러를 공통 ack 빌더로 바꾼다. 변환은 에러 타입에 따라 둘로 갈린다. 클라이언트에 보여도 되는 표면과 내부 진단 정보를 나눈다.

- **typed `ExecutionError`**: 실행 엔진이 클라이언트 경계로 던지는 에러는 `ExecutionError` 추상 기반(`{ code, message, serverDetail? }`)을 따른다. `code` 는 중앙 `ErrorCode` enum 값(또는 prefix 없는 안정 시스템 코드)이다. `message` 는 고정된 client-safe 영문 문자열이다. `serverDetail` 은 서버 로그 전용 진단 정보이고 클라이언트에 보내지 않는다. ack 는 `{ success:false, error: <message>, errorCode: <code> }` 다. `InvalidExecutionStateError`, `RetryLastTurnError`, `ExecutionTimeLimitError`, `FormValidationError`(`submit_form` 필드 검증, code `VALIDATION_ERROR`)가 이 계약의 선례이며 차례로 `ExecutionError` 기반으로 옮긴다(code 값과 동작은 유지).
- **그 밖의 `Error` 나 알 수 없는 값**: DB 드라이버 예외, 서드파티 에러 원문, 내부 식별자를 담을 수 있다. 내부 `error.message` 를 클라이언트에 보내지 않는다. ack 는 호출부가 정한 고정 문구와 `errorCode: 'EXECUTION_INTERNAL_ERROR'` 로 내보낸다. 원래 `error.message` 와 stack 은 서버 로그(`logger.warn`)에만 남긴다. 스택 힌트, DB·서드파티 에러 원문, 내부 식별자의 누출을 이 규칙이 막는다.

| 에러 종류 | ack `error` | ack `errorCode` | 서버 로그 |
| --- | --- | --- | --- |
| `ExecutionError`(typed) | `error.message`(고정 client-safe) | `error.code` | `serverDetail`(있으면) |
| 그 밖의 `Error` / 알 수 없는 값 | 호출부가 정한 고정 문구 | `EXECUTION_INTERNAL_ERROR` | 원래 `message` + stack |

- 새 client-safe 코드는 새 prefix 를 만들지 않고 중앙 `ErrorCode` enum 의 `EXECUTION_*` 이름공간을 넓힌다. 예: `EXECUTION_INTERNAL_ERROR`(일반 대체 코드), `EXECUTION_MESSAGE_TOO_LONG`(`submit_message` 의 `message` 가 최대 **10000자**(`ExecutionEngineService.MAX_MESSAGE_LENGTH = 10_000`)를 넘음). 길이 수치는 클라이언트에 보내지 않고 서버 로그(`serverDetail`)에만 남긴다.
- `INVALID_EXECUTION_STATE`(prefix 없는 시스템 코드), 워커 쪽 `RESUME_*`, 마지막 턴 재시도 `RETRY_*` 는 안정성 정책에 따라 기존 이름을 유지한다. 명명 규칙은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 에 있다.
- 프론트엔드는 백엔드의 안정 code 를 `code → i18n key` 맵으로 표시한다(`integration-error-codes` 선례). 맵에 없는 code 는 일반 문구로 표시한다. 백엔드는 i18n 층을 두지 않는다. WS ack 표면은 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 의 재개 에러 코드 표와 맞춘다.
- **EIA 진입점 매핑**: 같은 `MessageTooLongError` 가 EIA `submit_message`(`interaction.service`)에서 나면 `400 Bad Request` + `MESSAGE_TOO_LONG` 으로 바꾼다. `InvalidExecutionStateError` → `STATE_MISMATCH`(409)와 같은 방식이다. 응답에는 고정 메시지만 싣고 길이 수치는 싣지 않는다. 규칙의 기준은 [External Interaction API](../CLE-IX/CLE-EIA.md) 의 R13 이다.
- 워커 쪽 비동기 실패(`RESUME_*`)는 이 동기 변환 밖이다. 뒤따르는 `execution.cancelled` 이벤트로 알리며 같은 누출 차단 원칙(내부 message 를 싣지 않고 code 만)을 그 이벤트 빌더에도 적용한다. 그 이벤트 빌더의 점검은 후속 항목이다.

## 구현 위치

- `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` (발행 결과 `ContinuationPublishResult`, seq 발급 fail-fast)

## Rationale

### 발행 실패를 `queued:false` 하나로 알린다

- **취소도 발행 결과를 돌려준다**: `cancelWaitingExecution` 은 원래 `void publish` 로 결과를 버렸다. 발행 실패가 호출자에게 닿지 않아 에러가 사라졌다. 다른 재개 메서드 4종은 이미 `ContinuationPublishResult` 를 돌려주므로 취소만 예외로 둘 근거가 없었다. 같은 방식으로 맞추고 REST `POST /executions/:id/stop` 의 입력 대기 취소 분기가 `queued:false` 를 알리게 했다.
  - HTTP 코드는 **503** 이다. Redis 의존성 장애는 상류를 쓸 수 없는 상태이므로 502(잘못된 게이트웨이 응답)가 아니라 503(일시적 불가, 재시도)이 맞다. `SERVER_SHUTTING_DOWN`(SIGTERM 뒤 새 실행 거부)이 같은 503 선례를 만들었다.
  - 취소는 WS ack 경로가 아니라 REST 중지 진입점이므로 새 코드 `EXECUTION_ENQUEUE_FAILED`(`EXECUTION_*` 이름공간)로 표기한다. 이 코드는 처음에 REST 중지 진입점 전용이었다. 2026-10-09 에 EIA `/interact` 의 재개 명령과 취소로 넓어졌다. 진입점별 표면은 [「진입점마다 큐 적재 실패를 다르게 알린다」](#진입점마다-큐-적재-실패를-다르게-알린다-2026-10-17) 에 있다.
  - "502 가 아니라 503" 판정은 **우리 의존성의 장애**에 한정된다. 외부 서드파티 API 호출 실패의 502 사용은 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 의 R-CC-23 이 정한다. 두 기준은 지금까지의 사례에서 모두 같은 결론을 낸다.
- **seq 발급 실패는 바로 실패로 처리한다**: `nextSeq` 의 Redis INCR 이 실패하면 쓰던 `Math.random` seq 대체를 없애고 fail-fast(INCR throw → `publish` 바깥 catch → `null`/`queued:false`)로 바꿨다. 무작위 seq 는 "seq = 멱등 키" 와 단조성 계약을 어겨 jobId 중복 제거를 무력화한다. BullMQ 자체가 Redis 위에서 돌기 때문에 INCR 이 실패하는 장애라면 바로 뒤의 `queue.add` 도 실패할 가능성이 크다. 대체의 가용성 이득이 사실상 없다. 이벤트 순번(`exec:seq`)은 분산 단조성 미보장을 받아들여 in-memory 대체를 두지만 재개 seq 는 jobId 중복 제거 계약이 우선이라 일부러 **비대칭**으로 둔다.

두 항목은 발행 실패를 `queued:false` 하나로 알린다는 점에서 같은 결정이다.

### `RESUME_*` 를 동기 ack 에 싣지 않는다 (2026-06-10)

- **옛 서술**: rehydration 실패 3종(`RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE`)이 "WS ack 에 `resumed: false` + error 로 나간다" 고 적혀 있었다. 사전 검증 절("`RESUME_*` 는 뒤따르는 `execution.cancelled` 이벤트이며 ack 동기 응답이 아니다")과 정면으로 모순이었다.
- **맞는 경로**: 항상 큐에 넣는 모델([시스템 아키텍처](../CLE-PLAT/CLE-PLAT-ARCH.md) 의 "실행 엔진: Redis 큐 + 분산 워커 풀" 결정) 이후 `RESUME_*` 는 enqueue 뒤 임의 워커가 처리하다 실패하는 **비동기** 종결이다. 재개 handler 4종은 enqueue 수락만 동기 ack(`resumed: true`/`queued`)로 돌려준다. 워커 쪽 실패는 뒤따르는 `execution.cancelled` 이벤트(`error.code = RESUME_*`)로 알린다. 코드에서도 4종 handler 는 `RESUME_*` 에 대해 `resumed: false` 를 내지 않는다.
- **정정**: rehydration 실패 설명을 사전 검증 절의 동기·비동기 분류에 맞췄다. WebSocket 쪽 정정은 [WebSocket 연결과 채널 구독](../CLE-API/CLE-API-WS.md) 의 Rationale "`resumed` 의미 재정의" 에 있다. 코드는 바뀌지 않았다(spec 을 코드 동작에 맞췄다).
- **2026-10-17 보강**: 처음 정정은 동기 ack 가 실패를 싣는 경우를 사전 검증(`INVALID_EXECUTION_STATE`)뿐이라고 적었는데 범위가 좁았다. 발행 경로의 에러(「ack 에러 변환」)와 큐 적재 실패도 동기 실패 ack 로 온다. 본문 「ack 의 뜻」 을 그에 맞게 고쳤다. `RESUME_*` 가 동기 ack 에 실리지 않는다는 결정은 그대로다.

### ack 에 내부 에러 메시지를 싣지 않는다 (2026-06-14 결정)

- **문제**: 재개 handler 4종의 공통 ack 빌더(`buildContinuationErrorAck`)가 `error instanceof Error ? error.message : fallback` 으로 **임의 `Error` 의 내부 message 를 그대로 ack 에 실었다**. `InvalidExecutionStateError` 만 `errorCode` 로 구분됐다. 그 밖의 에러(특히 DB 조회의 TypeORM 예외)는 스택 힌트, SQL 원문, 내부 식별자를 흘릴 수 있었다.
- **결정(네 가지, 2026-06-14 사용자 확정)**:
  1. **에러 코드 이름공간**: 새 `EXEC_*` prefix 를 만들지 않고 중앙 `ErrorCode` enum 의 `EXECUTION_*` 를 넓힌다. `EXEC_*` 는 기존 `EXECUTION_*` 과 이중 표기라 기각했다. `INVALID_EXECUTION_STATE`, `RESUME_*`, `RETRY_*` 는 안정성 정책상 이름을 유지한다.
  2. **client-safe 메시지**: 백엔드는 code 와 고정 영문 일반 메시지만 내보내고 내부 상세는 서버 로그에만 남긴다. 프론트엔드가 `code → i18n key` 맵으로 표시한다(`integration-error-codes` 선례). 백엔드 i18n 층 신설은 인프라가 없고 비용이 커 기각했다.
  3. **`ExecutionError` 전환 범위는 경계만**: `ExecutionError` 추상 기반을 도입한 뒤 클라이언트 경계에 닿는 throw 만 typed 로 바꾼다. 안쪽 깊은 `Error` 는 ack 경계에서 일반 대체로 처리한다. 전수 전환(약 15곳)은 크고 가치가 낮으며(다수가 클라이언트에 닿지 않는다) 회귀 위험이 있어 기각했다.
  4. **ack 변환**: 본문 「ack 에러 변환」 의 두 갈래(typed 는 `message` + `code`, 그 밖은 고정 문구 + `EXECUTION_INTERNAL_ERROR`)로 바꾼다. 이것이 누출 차단의 보안 관문이다.
- **선례와 맞춤**: `InvalidExecutionStateError`, `RetryLastTurnError`, `ExecutionTimeLimitError` 는 이미 "고정 client-safe message + 서버 전용 detail" 형태다. `ExecutionError` 기반으로 차례로 옮긴다(code 와 동작 유지). 워커 쪽 `RESUME_*`(`execution.cancelled` 이벤트)는 다른 경로라 이 변경 범위 밖이다. 같은 원칙을 적용할지는 후속 점검이다.

### 진입점마다 큐 적재 실패를 다르게 알린다 (2026-10-17)

재개 메시지를 큐에 넣지 못하면(`queued:false`) 진입점마다 다른 응답이 나간다. 목록은 「발행 결과와 ack 에러 표면」 의 표에 있다.

- **WebSocket**: 성공 ack 에 `queued:false` 를 싣지 않고 `errorCode` 없는 실패 ack 를 보내는 코드 동작에 문서를 맞췄다. ack 는 서버에 저장되지 않으므로 클라이언트는 실패를 보고 같은 명령을 다시 보내면 된다.
- **EIA `/interact`**: 503 `EXECUTION_ENQUEUE_FAILED` 를 쓴다(2026-10-09). EIA 는 `202` 응답을 멱등 캐시에 넣는다. 실패를 `202` 로 알리면 같은 키로 다시 보낸 요청도 그 실패를 돌려받는다. 근거는 [EIA 데이터와 흐름 「재검토에서 갈린 EIA 동작을 정한다」](../CLE-IX/CLE-EIA-DATA.md#재검토에서-갈린-eia-동작을-정한다-2026-10-09) 에 있다.
- **채팅 채널**: 인바운드는 `202` 고정 정책을 따른다(사람 결정). 그전에는 `/cancel` 이 `stop` 의 503 을 프로바이더에 그대로 돌려줬다. 이제 `/cancel` 과 진행 중인 대화의 입력은 `202` 로 답하고 채널 건강도를 `degraded` 로 둔다. `/start` 의 기존 실행 취소 실패만 503 이다. 근거는 [채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약) 에 있다.

기각한 대안은 모든 진입점의 응답을 한 모양으로 맞추는 안이다. WebSocket ack 에는 HTTP 상태가 없다. 채팅 채널은 non-2xx 응답이 이어지면 프로바이더가 웹훅을 끌 수 있다. 그래서 진입점마다 전송 방식의 제약에 맞는 표면을 고른다.
