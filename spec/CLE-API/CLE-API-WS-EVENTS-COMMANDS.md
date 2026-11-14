---
id: "CLE-API-WS-EVENTS-COMMANDS"
title: "WebSocket 이벤트와 명령 — 실행 제어 명령과 ack"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-WS-EVENTS"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-WS-EVENTS"]
area: "CLE-API"
content_hash: "5184a9b0091248e4133e83c0548780f38b7698e53c77bff6b0180273d4d091da"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "26bb942cde7141af8b153e6ba6c5dc624a9ab231d9f56d7eca35d55e9bbee5d1"
etag: "sha256-698a133269b2a5c2a6586aa67e4ab2fc1f30fc5ff62e11c2f1a32aabc5337aa9"
---
> 구현 상태: 구현됨 (브레이크포인트 명령 `execution.continue`·`execution.step` 은 미구현, 실행 시작·중단 명령은 비채택) · 상위: [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md)

## 개요

이 문서는 [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) 의 하위 문서로 클라이언트가 보내는 실행 제어 명령, 명령 ack 형태, 재개 명령과 마지막 턴 재시도의 에러를 정한다. 외부 REST 명령과의 매핑은 부모 문서의 [「7. 외부 표면 매핑」](CLE-API-WS-EVENTS.md#7-외부-표면-매핑-external-interaction-api) 이 정한다.

## 2. 실행 제어 명령 (Client → Server)

**실행 시작과 중단은 REST 다.** `execution.start`·`execution.stop` WebSocket 명령은 **비채택**이고(정식 경로는 아래 표) 진행 상황은 `execution:{executionId}` 구독으로 받는다(근거: [WebSocket 연결과 채널 구독](CLE-API-WS.md) 의 "raw WebSocket 전제·REST 대체 항목 비채택"). 게이트웨이의 `@SubscribeMessage` 핸들러는 `subscribe`, `unsubscribe`, `ping`, `execution.submit_form`, `execution.click_button`, `execution.submit_message`, `execution.end_conversation`, `execution.retry_last_turn` 여덟 개뿐이다.

| 명령 | payload | 설명 |
|-----------|---------|------|
| `execution.start` _(비채택, REST 대체)_ | `{ workflowId, input?, fromNodeId?, breakpoints? }` | 실행 시작 요청. 정식 경로는 REST `POST /api/workflows/:id/execute`. `breakpoints?` 는 브레이크포인트(미구현)용 계획 필드 |
| `execution.stop` _(비채택, REST 대체)_ | `{ executionId, force? }` | 실행 중단 요청. 정식 경로는 REST `POST /api/executions/:id/stop` |
| `execution.continue` _(계획, 미구현)_ | `{ executionId }` | 브레이크포인트 뒤 계속([에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md) 의 브레이크포인트 로드맵) |
| `execution.step` _(계획, 미구현)_ | `{ executionId }` | 노드 하나만 실행하고 다시 정지(같은 로드맵) |
| `execution.submit_form` | `{ executionId, formData }` | Form 노드에 사용자 입력 제출. `nodeId`·`toolCallId` 는 **클라이언트가 보내는 필드가 아니다.** 대기 노드는 서버가 조회하고([큐 워커와 동시 실행 제한 「발행 전 사전 검증」](../CLE-EXEC/CLE-EXEC-WORKER.md#발행-전-사전-검증)), AI 에이전트 `render_form` 응답의 `toolCallId` 는 서버가 보관한 `pendingFormToolCall` 재개 상태로 맞춘다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)). 외부 wire 는 이 형태를 유지하고 내부 재개 버스만 `{type:'form_submitted', formData}` 로 감싼다([Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md)) |
| `execution.click_button` | `{ executionId, nodeId?, buttonId }` | 버튼이 설정된 Presentation 노드의 버튼 클릭. `buttonId` 는 port 타입 버튼의 UUID 또는 `__continue__`(link 전용일 때 Continue 동작). `nodeId` 는 선택이다. **보내면** 발행 쪽이 실제 대기 노드와 대조하고 보내지 않으면 `executionId` 와 상태 조회만으로 대기 노드를 찾는다(프론트엔드는 보내지 않아 실제로는 쓰이지 않는다) |
| `execution.submit_message` | `{ executionId, nodeId, message }` | AI 에이전트 멀티턴의 사용자 메시지 전송. **폼 우회**: `interactionType: 'ai_form_render'` 로 대기 중에 이 명령이 오면 서버가 `pendingFormToolCall.toolCallId` 와 맞는 `render_form` 도구의 tool_result 를 `{type:'cancelled', reason:'user_sent_message_instead'}` 로 채우고 `pendingFormToolCall` 을 비운 뒤 일반 `ai_user` 턴을 진행한다. LLM 의 다음 추론을 자유롭게 둔다. 화면의 메시지 입력은 늘 활성이다(폼 우회 허용) |
| `execution.end_conversation` | `{ executionId, nodeId }` | AI 에이전트 멀티턴 대화 종료 요청 |
| `execution.retry_last_turn` | `{ executionId, nodeExecutionId }` | 마지막 턴 재시도. AI 에이전트 멀티턴이 재시도 가능한 에러(`outputData.output.error.details.retryable === true`, 래퍼 한 겹 아래)로 끝난 뒤 같은 `nodeId` 의 새 노드 실행 행을 만들어 마지막 LLM 호출로 다시 들어간다. `nodeId` 대신 `nodeExecutionId` 를 쓰는 이유는 같은 `nodeId` 가 노드 실행 행을 여럿 가질 수 있어 행 단위 식별이 필요하기 때문이다. 워크플로우 [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) 과 다르다. 같은 실행 안에서 노드 단위로 다시 시도한다 |

### 2.1 ack 형태

재개 명령 넷과 `retry_last_turn` 의 ack 는 명령 응답 이벤트(ack 이벤트)로 온다. 핸들러(`handleClickButton` 등)가 돌려준 `{ event, data: { success, ... } }` 는 `event` 필드 값을 이름으로 하는 Socket.IO 이벤트로 `data` 만 나간다. ack 이벤트의 정의와 전송 규칙은 [WebSocket 연결과 채널 구독 「전송 계층」](CLE-API-WS.md#1-전송-계층) 이 정한다. 재개 명령 넷과 `retry_last_turn` 의 ack 이벤트 이름은 `<명령>.ack` 이고 폼 제출만 `execution.form_submitted` 다. 구독과 ping 의 ack 이벤트(`subscribed`·`unsubscribed`·`pong`)는 [WebSocket 연결과 채널 구독](CLE-API-WS.md) 이 정한다. 클라이언트는 ack 이벤트 이름을 구독해 받는다(예: `socket.once('execution.click_button.ack', …)`).

**ack 이벤트는 요청별 짝짓기를 제공하지 않는다.** 같은 명령을 두 번 보내면 두 ack 는 이름이 같고 어느 요청의 응답인지 표시하는 필드가 없다. 성공 ack 와 `retry_last_turn` 의 ack 에는 `executionId` 가 있지만 재개 명령 넷의 실패 ack 에는 없다. 프론트엔드 로컬 헬퍼 `emitWithAck`(`use-execution-interaction-commands.ts`)는 이 값으로 맞추지 않는다. 명령을 한 번에 하나만 보낸다는 전제로 보내기 전에 그 ack 이벤트 이름에 일회성 리스너를 걸고 다음에 오는 ack 를 그 명령의 응답으로 본다. 실패인지는 `success === false` 로만 가른다.

아래 예시는 핸들러 반환 형태 `{ event, data }` 다. 비채택인 `execution.start.ack` 만 논리 구조 표기 `{ type, id, payload }` 로 남긴다.

**버튼 클릭 응답** (핸들러 반환. wire 는 ack 이벤트 `execution.click_button.ack` 와 payload `data`):

```json
{
  "event": "execution.click_button.ack",
  "data": {
    "success": true,
    "executionId": "uuid",
    "buttonId": "uuid",
    "resumed": true,
    "queued": true
  }
}
```

**폼 제출 응답** (ack 이벤트 이름 `execution.form_submitted`). 폼 제출만 `<명령>.ack` 패턴이 아니라 `execution.form_submitted` 를 쓴다(예외 등록 성격의 역사적 이름, Rationale 참조).

```json
{
  "event": "execution.form_submitted",
  "data": { "success": true, "executionId": "uuid", "resumed": true, "queued": true }
}
```

**메시지 전송 응답** (`execution.submit_message.ack`)과 **대화 종료 응답** (`execution.end_conversation.ack`)도 같은 형태다. 괄호 안이 ack 이벤트 이름이다. 아래는 메시지 전송 응답이고 대화 종료 응답은 `event` 값만 다르다.

```json
{
  "event": "execution.submit_message.ack",
  "data": { "success": true, "executionId": "uuid", "resumed": true, "queued": true }
}
```

**실행 시작 응답 `execution.start.ack` 는 비채택이다.** 실행 시작은 REST 이고 그 REST 응답이 `executionId` 를 돌려준다. 참고용 형태(논리 구조 표기)는 `{ "type": "execution.start.ack", "id": "req-003", "payload": { "executionId": "550e8400-e29b-41d4-a716-446655440000", "status": "pending" } }` 다.

### 2.2 재개 명령 ack 의 공통 필드

네 명령(`click_button`, `submit_form`, `submit_message`, `end_conversation`)의 성공 ack 는 명령별 식별자만 다르고 `success`·`resumed`·`queued` 필드는 같다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `success` | boolean | 성공 ack 에서는 늘 `true` 다. 실패 ack 의 형태는 §2.3 에 있다 |
| `executionId` | uuid | 실행 ID (공통) |
| `resumed` | boolean | **재개 수락 여부(enqueue).** 성공 ack 에서는 늘 `true` 다. 큐에 넣지 못하면 성공 ack 가 아니라 실패 ack 가 온다(§2.3). 모든 진입점이 늘 큐에 넣는 모델에서는 동기 ack 시점에 재개 성공을 알 수 없으므로 "재개 성공" 이 아니다. 최종 재개는 뒤따르는 `execution.resumed`·`execution.node.*` 이벤트로, rehydration 실패(`RESUME_*`)는 뒤따르는 `execution.cancelled` 이벤트로 확인한다. 이 ack 불리언 `resumed` 는 이름이 같은 재개 이벤트 `execution.resumed`, 노드 출력의 흐름 지시 상태 `resumed` 와 **별개**다 |
| `queued` | boolean | 재개 큐에 들어갔는지. 성공 ack 에서는 늘 `true` 다. 발행 실패(Redis 장애 등)는 이 필드가 아니라 §2.3 의 실패 ack 로 온다. 관측·디버깅용이고 클라이언트 분기에 쓰지 않는다 |
| 명령별 식별자 | 없음 | `buttonId`(`click_button`) / 없음(`submit_form`, `formData` 를 싣지 않음) / 없음(`submit_message`, `message` 를 싣지 않음) / 없음(`end_conversation`) |

- 클라이언트는 ack `resumed: true` 만으로 입력 대기 화면을 풀지 않는다. 동기 ack 시점에는 워커의 재개 처리가 아직 일어나지 않았다. 재개 큐의 동작은 [큐 워커와 동시 실행 제한 「재개 큐」](../CLE-EXEC/CLE-EXEC-WORKER.md#재개-큐) 가 정한다.
- ack data 에 `nodeId` 는 없다. 대기 노드는 서버가 조회(`execution_id + status='waiting_for_input'`)한다. 클라이언트가 ack 를 명령과 짝짓는 방식은 §2.1 에 있다.
- 명령 본문에 `nodeId` 를 실은 경우(`submit_message`·`end_conversation` 은 프론트엔드가 대기 노드의 `nodeId` 를 싣는다) 서버는 조회로 찾은 대기 노드와 그 `nodeId` 를 **대조**해 다르면 `INVALID_EXECUTION_STATE` 로 거부한다. `nodeId` 는 조회 키가 아니라 낡거나 잘못 지정한 제출을 거르는 사후 검증 입력이다.

### 2.3 재개 명령의 에러

**실패 ack 형태**: 네 명령의 실패 ack 는 `{ success: false, error: string, errorCode?: string }` 다. `errorCode` 는 아래 표의 코드를 담는 **평면 필드**이고 기존 `error`(사람용 메시지)와 하위 호환되도록 형제로 더했다. 큐 적재 실패의 실패 ack 에는 `errorCode` 가 없다(아래 「큐 적재 실패」). `retry_last_turn` 의 중첩 `error: { code, message }` 와 층이 다른 것은 의도한 분리다. 네 명령은 처음부터 평면 `{ success, error }` 를 써 왔고 `errorCode` 는 그 위의 확장이다.

| 코드 | 설명 |
|------|------|
| `INVALID_BUTTON_ID` | 존재하지 않는 버튼 ID |
| `INVALID_EXECUTION_STATE` | 실행이 기대한 상태가 아님(네 명령은 입력 대기를, `retry_last_turn` 은 `failed` 를 기대). WebSocket 전용 코드다. REST 진입점은 422 `INVALID_STATE` 로 적는다(의도한 분리) |
| `INTERACTION_TIMEOUT` | 이미 타임아웃이 발생한 상태 |
| `EXECUTION_MESSAGE_TOO_LONG` | `submit_message` 메시지가 최대 길이(10000자)를 넘음. 발행 쪽 동기 검증(typed `MessageTooLongError`) |
| `VALIDATION_ERROR` | `submit_form` 필드 검증 실패(필수, 타입, minLength·maxLength, min·max, 정규식, select·radio 선택지, `type:'file'` MIME·크기·개수). 발행 쪽 `continueExecution` 관문이 노드 설정의 필드 정의로 동기 검증한다(typed `FormValidationError`). EIA REST 의 `400 VALIDATION_ERROR` 와 같은 뜻, 같은 검증 지점이다. 실행 상태는 유지되어 다시 제출할 수 있다. ack 는 평면 `{ success:false, error, errorCode:'VALIDATION_ERROR' }` 이고 **필드별 `details[]` 가 없다.** 필드별 상세(`{field,message,code}`)는 EIA REST 경로(`400` body `error.details[]`, [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md))에서만 준다. WebSocket 클라이언트는 사람용 `error` 문자열로 폼을 다시 보인다 |
| `EXECUTION_INTERNAL_ERROR` | 재개 처리 중 typed `ExecutionError` 가 아닌 내부 에러(DB, 서드파티, 예기치 못한 throw). ack `error` 는 **고정 일반 문자열**이고 내부 `error.message` 는 클라이언트에 보내지 않는다(서버 로그 전용) |

**큐 적재 실패**: 재개 메시지를 재개 큐에 넣지 못하면(Redis 장애 등) 네 명령은 실패 ack `{ success: false, error: 'Continuation could not be queued. Please try again.' }` 를 돌려준다. `errorCode` 는 싣지 않는다. 실행은 입력 대기 그대로다. ack 는 서버에 저장되지 않으므로 클라이언트가 같은 명령을 다시 보내면 새로 처리된다. 같은 실패를 EIA REST 는 503 `EXECUTION_ENQUEUE_FAILED` 로 알린다. 503 을 받는 요청의 범위는 [EIA 수신 API와 SSE 「명령 에러」](../CLE-IX/CLE-EIA-INBOUND.md#명령-에러) 에 있다. `retry_last_turn` 의 큐 적재 실패는 §2.4 에 있다. 진입점별 표면의 기준은 [큐 워커와 동시 실행 제한 「발행 결과와 ack 에러 표면」](../CLE-EXEC/CLE-EXEC-WORKER.md#발행-결과와-ack-에러-표면) 이다.

- **누출 차단(typed·plain 분기)**: ack `error` 는 typed `ExecutionError`(`InvalidExecutionStateError` 등)면 그 클래스의 고정 클라이언트용 `message`, plain `Error` 면 호출부가 정한 고정 일반 문자열과 `errorCode='EXECUTION_INTERNAL_ERROR'` 다. 내부 메시지(스택 힌트, DB·서드파티 원문, 내부 식별자)는 서버 로그에만 남긴다. 계약과 근거는 [큐 워커와 동시 실행 제한 「발행 결과와 ack 에러 표면」](../CLE-EXEC/CLE-EXEC-WORKER.md#발행-결과와-ack-에러-표면) 이다.
- **rehydration 실패는 ack 가 아니다.** `RESUME_CHECKPOINT_MISSING`, `RESUME_FAILED`, `RESUME_INCOMPATIBLE_STATE` 는 워커 쪽 **비동기** 실패라 ack 가 아니라 뒤따르는 `execution.cancelled` 이벤트의 `error.code` 로 알린다. 동기 ack 에 담기는 실패는 발행 쪽 사전 검증, 발행 경로의 에러, 큐 적재 실패 세 가지다. 이 세 코드는 네 명령의 재개 경로에만 해당하고 `retry_last_turn` 은 rehydration 경로를 타지 않아 대상이 아니다(§2.4). 코드 뜻은 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 에 있다.

### 2.4 마지막 턴 재시도 (`execution.retry_last_turn`)

ack 는 `execution.click_button.ack` 의 `resumed` 패턴에 실패 시 `error` 객체를 더한 형태다.

```json
{
  "event": "execution.retry_last_turn.ack",
  "data": { "success": true, "executionId": "uuid", "nodeExecutionId": "uuid", "resumed": true }
}
```

실패 응답:

```json
{
  "event": "execution.retry_last_turn.ack",
  "data": {
    "success": false,
    "executionId": "uuid",
    "nodeExecutionId": "uuid",
    "resumed": false,
    "error": { "code": "RETRY_STATE_NOT_FOUND", "message": "..." }
  }
}
```

- ack 에 `nodeId` 는 없다. 클라이언트가 `nodeExecutionId` 만 보내고 ack 도 같은 식별자만 되돌려준다. `nodeId` 는 `nodeExecutionId` 로 서버가 찾을 수 있다.
- ack payload 는 재개 명령 넷과 같이 `success: boolean` 을 담는다. §2.3 의 평면 `{ success, error }` 관례를 따르고 실패 때 평면 `errorCode` 대신 중첩 `error: { code, message }` 를 쓰는 것만 다르다.
- ack 의 `resumed: false` 는 네 명령과 달리 발행 쪽 **동기** 실패를 반영한다. `failed` 상태 기대 불충족 같은 검증 실패와 큐 적재 실패(아래 표의 `INTERNAL_ERROR`)가 여기에 든다. `RESUME_*` 비동기 경로와 무관하다.

아래 표는 `retry_last_turn` 이 돌려주는 코드다. 전송 수준 코드 전체는 [WebSocket 연결과 채널 구독 「에러 코드」](CLE-API-WS.md#71-에러-코드) 에 있다. 코드의 출처는 셋이다. `RETRY_*` 는 `ErrorCode`(`nodes/core/error-codes.ts`)의 값이다. `INVALID_EXECUTION_STATE` 는 `InvalidExecutionStateError` 의 `code` 리터럴이다. `UNAUTHENTICATED`·`NOT_FOUND`·`INTERNAL_ERROR` 는 전송 수준 `WsErrorCode`(`ws-error-codes.ts`)다.

| 코드 | 설명 |
|------|------|
| `UNAUTHENTICATED` | 소켓에 사용자 ID 가 없음. 실행 소유 검증보다 먼저 본다 |
| `NOT_FOUND` | 실행이 없거나 토큰 클레임의 워크스페이스가 그 실행을 소유하지 않거나 소유 확인이 실패함(DB 에러 포함). `message` 는 `Execution not found` 다. 실행의 존재 여부를 추론하지 못하게 `FORBIDDEN` 대신 이 코드를 쓴다 |
| `RETRY_STATE_NOT_FOUND` | `NodeExecution.outputData._retryState` 가 DB 에 없거나 만료됨(`expiresAt` TTL 초과, 또는 다른 재시도가 이미 소비). 별도 토큰 필드는 payload 에 없다 |
| `NODE_NOT_RETRYABLE` | 대상 노드의 `outputData.output.error.details.retryable === false` 이거나 재시도 가능한 에러로 끝나지 않음(정상 종결, 조건 종결 등) |
| `RETRY_TOO_EARLY` | `outputData.output.error.details.retryAfterSec` 카운트다운이 끝나기 전 호출(서버 쪽 강제). 클라이언트가 버튼을 비활성으로 두면 정상적으로는 생기지 않는다 |
| `INVALID_EXECUTION_STATE` | 대상 노드 실행이 `FAILED` 가 아니거나 실행이 재시도에 들어갈 수 있는 상태가 아님(사전 검증 실패). 재개 명령의 같은 코드와 뜻을 공유한다(기대 상태만 다르다) |
| `INTERNAL_ERROR` | 새로 만든 재시도 턴을 재개 큐에 넣지 못함(Redis 장애 등). 새 노드 실행 행은 `failed` 로 마감한다. `_retryState` 는 이미 소비됐으므로 같은 명령을 다시 보내면 `RETRY_STATE_NOT_FOUND` 가 온다. typed 에러가 아닌 예외도 이 코드로 오고 이때 `message` 는 고정 문자열 `Retry failed` 다 |

**`_retryState` 소비 원자성과 TTL (구현 계약)**

- **한 번만 소비한다.** 재시도 처리는 `nodeExecutionId` 로 `_retryState` 를 조회하고 **같은 트랜잭션 안에서** `NodeExecution.outputData` 에서 `_retryState` 키를 지우며(JSONB `-` 연산) 새 노드 실행 행을 만든다. 키 제거가 affected=1 인 쪽만 진행해 동시 재시도가 행을 중복으로 만드는 것을 막는다. 한 번 소비하면 뒤 재시도는 `RETRY_STATE_NOT_FOUND` 다.
- **TTL**: `_retryState.expiresAt`(ISO 8601). 기본 60분이고 환경 변수 `AI_RETRY_STATE_TTL_MINUTES` 로 바꾼다. `now > expiresAt` 이면 `RETRY_STATE_NOT_FOUND` 다. 만료된 미소비 `_retryState` 는 행의 `outputData` 에 남아 있다가(별도 정리 작업 없음, 행 수명을 따른다) 다음 시도 때 만료로 거부된다.
- **재개 버스를 거쳐 워커로 넘긴다.** WebSocket 게이트웨이(다른 인스턴스일 수 있음)는 턴을 동기로 재개할 수 없다. 다시 들어가려면 살아 있는 실행 컨텍스트를 rehydrate 하고 `processAiResumeTurn`(단발 턴 처리기)을 돌려야 하는데 이는 **실행 워커 컨텍스트**에서만 된다. 그래서 검증, 원자 소비, 새 행 생성 뒤 재개 큐(`execution-continuation`)에 **새 job 종류 `retry_last_turn`** 을 넣어 워커로 넘긴다. 워커는 그 job 으로 새 행을 `_retryState`(`_resumeState` 형태)로 채운 채 `processAiResumeTurn` 에 `allowRetryReentry` opt-in 을 넘겨 다시 들어간다. `submit_message` 등과 같은 WebSocket → 워커 다리를 쓰되 대기 행 재개가 아니라 **새 행 재개**라는 점만 다르다.
- **재시도 중 취소**: 다시 들어간 턴이 `running` 으로 도는 동안 사용자 중단(REST `POST /api/executions/:id/stop`)이 오면 진행 중인 턴을 즉시 끊지 않는다. 취소 기록은 바로 커밋되고 재시도는 다음 턴 경계에서 이를 관측해 끝낸다. park 에 닿으면 park 쪽 취소가 짝 행을 마감한다. 이때 `execution.cancelled` 가 나가고 `execution.completed`·`execution.failed` 는 나가지 않는다. 상세 규칙은 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 가 정한다.
- **다시 들어간 턴이 끝난 뒤 그래프 진행**: 성공하면 새 노드 실행은 일반 노드 `COMPLETED` 와 같이 출력 포트의 다음 노드로 그래프 진행이 이어진다([실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md), [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md)). 실패하면 일반 노드 `FAILED` 와 같이 끝난다(실행도 `FAILED`). **다시 들어간 턴이 대화를 끝내지 않으면**(가장 흔한 경우) 종결이 아니라 입력 대기로 **다시 park** 하고 세그먼트를 끝낸다. 다음 사용자 입력이 오면 일반 rehydration 재개 경로로 합류한다. 워크플로우 재실행과 갈리는 점은 "같은 실행 안 노드 단위 재시도" 이지 "다음 노드 진행 차단" 이 아니다. AI 에이전트 쪽 서술은 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 에 있다.

## 구현 위치

- `codebase/backend/src/modules/websocket/websocket.gateway.ts` (명령 핸들러 여덟 개)
- `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` (재개 명령 발신. `emitWithAck` 는 ack 이벤트를 한 번 기다리는 로컬 헬퍼이고 Socket.IO 내장 `Socket#emitWithAck` 와 다르다)

## Rationale

### 마지막 턴 재시도의 그래프 진행: 재실행과의 경계

"노드 단위 재시도" 라는 표현 때문에 "다음 노드도 일부러 막는다" 로 읽힐 여지가 있었다. 뜻하는 것은 워크플로우 [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) 과의 단위 구분(실행 단위와 노드 단위)이지 다음 노드 진행 차단이 아니다. 다시 들어간 턴이 성공한 뒤의 그래프 진행은 일반 노드 `COMPLETED` 와 같은 엔진 기본 불변식이고 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 가 같은 결정 근거를 함께 쓴다.

### `submit_form`·`click_button` payload 와 ack 를 구현에 맞춘 이유 (2026-06-10)

- `submit_form` 을 `{ executionId, formData }`, `click_button` 을 `{ executionId, buttonId }` 로 고쳤다. 프론트엔드는 두 명령에 `nodeId` 를 싣지 않고 대기 노드는 서버가 조회한다. 이후 `click_button` 은 `nodeId?` 를 선택으로 받아 대조하도록 넓혔다.
- 옛 클라이언트 `toolCallId?` 필드를 지웠다. `render_form` 응답은 서버가 보관한 `pendingFormToolCall` 로 맞춘다. 공통 ack 표에서 `nodeId` 행도 지웠다.
- **폼 제출 ack 이름 `execution.form_submitted`**: 다른 명령의 `<명령>.ack` 패턴과 다르다. 도입 초기 이름이 백엔드 반환과 프론트엔드 수신 양쪽에 굳은 역사적 이름이다. 이미 합의한 wire 계약이라 이름을 바꾸면 호환만 깨져 구현 현실을 옮겼다(v2 프로토콜 정리 때 다시 검토한다). 이 ack 이벤트 이름은 [Presentation 노드 공통 「폼 제출 wire format」](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md#폼-제출-wire-format) 이 적은 `'form_submitted'` 문자열 네 층과 다른 다섯 번째 용법이다(2026-10-22 추가).

### ack 의 `resumed` 뜻을 "재개 성공" 에서 "재개 수락" 으로 바꾼 이유 (2026-06-10)

옛 공통 ack 표는 `resumed` 를 "재개 성공 여부" 로 적었다. 모든 진입점이 늘 BullMQ 에 넣는 모델([시스템 아키텍처](../CLE-PLAT/CLE-PLAT-ARCH.md))을 채택한 뒤 네 재개 핸들러는 큐에 넣으면 바로 `resumed: true` 를 돌려준다. 이 시점에는 어느 워커의 rehydration 도 일어나지 않아 동기 ack 로 재개 성공을 판정할 수 없다. 그래서 정의를 "재개 시작 수락(enqueue)" 으로 바꾸고 최종 확인은 뒤따르는 이벤트로 모았다. **기각한 대안**: 게이트웨이가 워커 처리를 동기로 기다리는 안. ack 지연을 워커에 묶어 큐를 들인 취지와 충돌한다. 코드는 바뀌지 않았다. 프론트엔드 `emitWithAck` 는 `success === false` 만 쓰고 `resumed` 로 상태를 바꾸지 않는다.

2026-10-17 정정: 이 문서는 큐 적재 실패가 성공 ack 의 `queued: false` 로 드러난다고 적었다. 코드는 그 경우 성공 ack 를 보내지 않고 `errorCode` 없는 실패 ack 를 보낸다. 문서를 코드에 맞춰 §2.2 와 §2.3 을 고쳤다. 기각한 대안은 코드를 바꿔 성공 ack 에 `queued: false` 를 싣는 안이다. 프론트엔드 `emitWithAck` 는 `success === false` 만 실패로 보므로 그 안에서는 실패가 화면에 보이지 않는다. 진입점마다 다른 표면의 근거는 [큐 워커와 동시 실행 제한 「진입점마다 큐 적재 실패를 다르게 알린다」](../CLE-EXEC/CLE-EXEC-WORKER.md#진입점마다-큐-적재-실패를-다르게-알린다-2026-10-17) 에 있다.

### ack callback 표기를 ack 이벤트로 바로잡은 이유 (2026-10-22)

이 문서는 재개 명령과 `retry_last_turn` 의 ack 를 Socket.IO ack callback 으로 적었으나 코드는 ack 이벤트로 보낸다. ack 이벤트 이름과 코드가 보내는 payload 필드는 그대로이고 문서만 코드에 맞췄다. 근거는 [WebSocket 연결과 채널 구독 「ack 이벤트 wire 와 HTTP 전용 전역 enhancer 를 바로잡은 경위 (2026-10-22)」](CLE-API-WS.md#ack-이벤트-wire-와-http-전용-전역-enhancer-를-바로잡은-경위-2026-10-22) 에 있다.

- ack 예시는 핸들러 반환 형태 `{ event, data }` 로 바꾸고 빠져 있던 `success` 를 실었다.
- «클라이언트는 `executionId` 만으로 ack 를 맞춘다» 는 프론트엔드 코드와 달라 지우고 실제 짝짓기 방식을 §2.1 에 적었다.
- 재시도 코드 표와 시스템 이벤트의 `error`·`exception` 행도 코드에 맞췄다(시스템 이벤트 표는 [WebSocket 이벤트와 명령 — 채널별 부가 이벤트 「시스템 이벤트」](CLE-API-WS-EVENTS-CHANNELS.md#6-시스템-이벤트) 에 있다).

기각한 대안은 둘이다. 핸들러가 `event` 없이 `data` 만 돌려 ack callback 으로 맞추는 안은 프론트엔드 로컬 헬퍼 `emitWithAck` 와 e2e 가 이미 ack 이벤트에 기대고 있어 호환만 깨진다. callback 과 이벤트를 함께 보내는 안은 callback 을 기다리는 소비자가 없고 응답 표면만 늘어 기각했다.
