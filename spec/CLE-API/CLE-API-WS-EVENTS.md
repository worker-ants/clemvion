---
id: "CLE-API-WS-EVENTS"
title: "WebSocket 이벤트와 명령"
type: "design"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-API"
ancestors: ["CLE-VISION", "CLE-API"]
area: "CLE-API"
content_hash: "6cf7d775314c9a23b73e4101d4c22af90374ba59488a67ebd2e4e65d9358106d"
read_as: "approved"
task: null
source_paths: ["spec/5-system/6-websocket-protocol.md"]
mirror_sha256: "6478986182cb723f3b4fc818f3b8b50238b30769cd147ff867819c9deb146daa"
etag: "sha256-5ee1a1481f04ba17e3b7acb21cbf9b3de3f1f93370d832d525c179e2fef7ea92"
---
> 구현 상태: 구현됨 (브레이크포인트 관련 이벤트·명령은 미구현, 실행 시작·중단 명령은 비채택) · 원문: `spec/5-system/6-websocket-protocol.md` (§4, Rationale 일부) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 WebSocket 위를 오가는 실행 이벤트(execution events, `execution.*`)와 클라이언트 명령의 목록, 각 페이로드, 명령 ack 형태, 그리고 같은 이벤트·명령이 외부 External Interaction API(EIA) 표면에서 어떻게 보이는지의 매핑 표를 정한다. 실행 이벤트 외에 지식 저장소 문서 이벤트, 인앱 알림 이벤트, 시스템 이벤트도 다룬다.

**같은 실행을 두 표면이 보고한다.** 내부 WebSocket 과 외부 EIA 의 REST·SSE·EIA 알림 웹훅이다. §7 매핑 표가 두 표면의 명령·이벤트 매핑의 권위다. 외부 표면은 내부 WebSocket 경로를 facade 로 감싼 **단일 구현 경로**여야 하므로 이벤트나 명령의 형태를 고칠 때 한 표면만 보고 고치면 두 표면의 뜻이 갈린다. 다만 같은 실행을 보고한다는 것이 같은 페이로드를 보낸다는 뜻은 아니다. §7 표는 대칭이 아니라 **선택적** 매핑이다. 명령 표는 "외부 미노출", "외부 미지원", "해당 없음" 으로 갈리고 이벤트 표의 EIA 알림 웹훅 열은 대부분 `—` 다. 디버그 필드(`llmCalls`, `requestPayload`, `responsePayload`)는 외부 수신자에게서 빠진다. 이 비대칭은 누락이 아니라 보안을 위한 결정이므로 두 표면을 맞추려고 지우지 않는다.

이 문서가 정하지 않는 것은 아래 문서가 정한다.

- 연결·인증·구독 채널·이벤트 봉투(`seq`, `timestamp`)·재연결·전송 계층 에러: [WebSocket 연결과 채널 구독](CLE-API-WS.md)
- 실행·노드 실행 상태 전이와 블로킹·재개 계약, 마지막 턴 재시도의 상태 전이: [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md)
- 재개 명령의 발행 쪽 사전 검증과 ack 에러 표면: [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)
- 종결 이벤트 셋(`completed`, `failed`, `cancelled`)의 필드 집합과 행동 계약, 채널별 봉투: [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md)
- 외부 SSE 스트림, EIA REST 명령, 입력 대기 이벤트의 외부 소비 필드 매핑: [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md)
- 이벤트 페이로드의 자격 증명 마스킹과 외부 `nodeOutput` 허용 목록: [응답 자격 증명 마스킹](CLE-API-EGRESS.md)
- 에러 코드 카탈로그: [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md)
- 대화 스레드 자료구조: [대화 스레드](../CLE-IX/CLE-IX-THREAD.md). 화면이 이벤트를 store 로 바꾸는 규칙: [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md)

JSON 예시의 `{ "type", "id", "payload" }` 는 논리 구조 표기다. 실제 wire 는 이벤트 이름이 Socket.IO 이벤트 이름이고 서버 이벤트 페이로드는 평면 봉투다([WebSocket 연결과 채널 구독](CLE-API-WS.md)).

## 1. 실행 이벤트 (Server → Client)

구독 채널: `execution:{executionId}`

| 이벤트 | payload | 설명 |
|-------------|---------|------|
| `execution.started` | `{ executionId, workflowId, mode, startedAt }` | 실행 시작 |
| `execution.completed` | `{ executionId, …필드 집합, seq, timestamp }` | 실행 완료. 필드 집합은 아래 |
| `execution.failed` | `{ executionId, …필드 집합, seq, timestamp }` | 실행 실패 |
| `execution.cancelled` | `{ executionId, …필드 집합, seq, timestamp }` | 실행 취소 |
| `execution.resumed` | `{ executionId, status, seq, timestamp }` | 입력 대기에서 재개됨. 재개 명령 ack 이후 실제 재개를 알리는 후행 이벤트다(§2.2). 현재 구현은 폼·버튼·AI 재개 경로가 `{ status: 'running' }` 을 싣는다 |
| `execution.snapshot` | `{ executionId, execution, timestamp }` | 다시 구독할 때 보내는 1회성 현재 상태(실행 스냅샷 이벤트). `execution` 은 `ExecutionsService.findById` 의 **실행 전체 객체**이고 그 안에 `status`·`nodeExecutions[]` 등이 중첩된다. 최상위에 `status`·`nodeExecutions` 가 평면으로 있는 것이 아니라 `payload.execution.*` 다. 발행 시점은 [WebSocket 연결과 채널 구독](CLE-API-WS.md) 의 놓친 이벤트 복구. 중첩된 `execution.error` 와 `execution.nodeExecutions[].error` 는 `findById` 의 마스킹 관문을 이어받는다 |
| `execution.paused` _(계획, 미구현)_ | `{ executionId, nodeId, nodeName, reason }` | 브레이크포인트에서 일시 정지. 기능은 [에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md) 의 브레이크포인트 로드맵 소관이다. 구현할 때 `nodeLabel` 로 맞춘다 |
| `execution.node.started` | `{ executionId, nodeId, nodeExecutionId, nodeLabel, nodeType }` | 노드 실행 시작. `nodeExecutionId` 는 노드 실행(`NodeExecution`) 행의 PK 로, 컨테이너 본문 노드의 회차별 타임라인 행을 가르는 식별자다 |
| `execution.node.completed` | `{ executionId, nodeId, nodeExecutionId, nodeLabel, output, duration }` | 노드 실행 완료. wire 의 `output` 은 `NodeExecution.outputData` 전체, 즉 노드 출력(`NodeHandlerOutput`) 래퍼다. 도메인 값은 한 겹 아래 `output.output` 이고 노드 출력 규약의 `output.error` 는 wire 에서 **`output.output.error`** 다(예: AI 에이전트 멀티턴의 `port: 'error'` 종결). `details.retryable`·`retryAfterSec` 표준 필드는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이 정한다. fanout(외부)에서는 이 래퍼에 fail-closed 허용 목록이 걸린다 |
| `execution.node.failed` | `{ executionId, nodeId, nodeExecutionId, nodeLabel, error, output? }` | 노드 실행 실패. `error` 는 **문자열**(메시지만)이다. `output` 은 발행 경로에 따라 실린다(§1.2) |
| `execution.node.skipped` | `{ executionId, nodeId, nodeExecutionId, nodeLabel, reason }` | 노드 건너뜀 |
| `execution.node.cancelled` | `{ executionId, nodeId, nodeExecutionId, nodeLabel, error? }` | 노드 실행 중단. `NodeExecution.status = cancelled`([실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md), [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)). `error` 는 **선택**이다. 신호 경로(핸들러 `AbortError`)는 `{ code: 'AbortError', message }` 를 싣지만 DB 관측 가드 경로는 싣지 않는다(내부 메시지에 executionId 등이 있을 수 있어 클라이언트 노출을 막는다). 소비자는 `error` 부재를 방어적으로 다룬다. `failed` 와 별도 이벤트라 타임라인이 취소를 실패와 구분하고 `running` 에 남지 않는다. 생산자: Parallel `cancel-others-on-fail`, 사용자 취소, 엔진 DB 관측 가드(노드 경계, AI 턴 경계, park 짝 전이) |
| `execution.waiting_for_input` | `{ executionId, nodeId, nodeExecutionId, nodeType, interactionType, formConfig?, buttonConfig?, conversationConfig?, conversationThread? }` | Form 노드, 버튼이 설정된 Presentation 노드, AI 에이전트 멀티턴 노드의 입력 대기. 재개 뒤 `execution.node.completed` 도 같은 `nodeExecutionId` 로 나가 타임라인의 같은 행이 갱신된다. 상세는 §4 |
| `execution.ai_message` | `{ executionId, nodeId, message, turnCount, messages, metadata?, llmCalls?, durationMs?, presentations? }` | AI 에이전트 멀티턴의 AI 응답. `messages` 는 system 을 뺀 user·assistant·tool 메시지의 권위 스냅샷이고 항목마다 `source` 표시가 있다(§4.6). 상세는 §4.1 |
| `execution.tool_call_started` | `{ executionId, nodeId, turnIndex, toolCallId, name, arguments }` | AI 에이전트가 도구 프로바이더의 도구(지식 저장소, MCP 등)를 실행하기 시작함. 디버깅 타임라인이 턴이 끝나기 전에 대기 중인 도구 항목을 바로 보일 수 있게 보낸다 |
| `execution.tool_call_completed` | `{ executionId, nodeId, turnIndex, toolCallId, content, status, error?, durationMs }` | 도구 실행이 끝남. `status` 는 `'success' \| 'error'`. 프로바이더가 throw 하면 핸들러가 잡아 `status: 'error'` 와 `error` 를 채우고 LLM 에는 에러 content 를 그대로 넘겨 다음 턴에 회복할 기회를 준다 |
| `execution.message` | `{ executionId, nodeId, nodeType, presentations: [{ config, output }], seq?, timestamp? }` | 표시 메시지 이벤트. 표시 전용 Presentation 노드(`carousel`·`table`·`chart`·`template`)가 **버튼 없이 자동 진행**으로 끝날 때 보낸다. `presentations[i]` 는 위젯 `classifyPresentation` 입력인 `{config, output}` 이다. 모든 비차단 노드의 `execution.node.completed` 와 구분하며 EIA SSE 표면(웹채팅 위젯)은 비차단 Presentation 렌더를 이 이벤트에서만 받는다. EIA 알림 웹훅 허용 목록에는 없다. 정의 기준은 [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md), [External Interaction API](../CLE-IX/CLE-EIA.md) 의 R18 |
| `execution.user_message` | `{ executionId, nodeId, nodeExecutionId, message, receivedAt }` | AI 에이전트 멀티턴에서 사용자 발화를 받는 즉시(다음 턴 LLM 호출 전) 라이브로 보이는 비권위 진행 신호. 권위는 턴 종료 `execution.ai_message.messages` 스냅샷이다. `submit_message` 와 채널 텍스트 인바운드가 `message_received` 로 재개할 때만 보내고 폼 제출에는 보내지 않는다. 상세는 §4.2 |

- **노드 이벤트의 이름 필드는 `nodeLabel` 이다.** 엔진 발행은 모두 `nodeLabel: node.label ?? node.type` 이고 `nodeName` 발행은 0건이다(2026-08-16 실측으로 표를 구현에 맞췄다). 미구현 `execution.paused` 행만 옛 표기다.
- **현재 구현은 노드 이벤트 다섯 가지 모두에 `nodeType` 과 `parentNodeExecutionId` 를 싣는다.** 원문 표는 `nodeType` 을 `started` 에만 적고 `parentNodeExecutionId` 는 적지 않는다. `parentNodeExecutionId` 는 노드가 인라인 [서브 워크플로우](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md)나 [Background](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) 본문 안에서 돌 때 호출 노드의 노드 실행 ID 이고 최상위 노드에서는 빠진다. 에디터는 이 값으로 타임라인 행을 호출 노드 아래에 묶는다. `status`·`input`·`startedAt`(종결 이벤트는 `finishedAt` 도)도 함께 실린다. `skipped` 의 `reason` 은 싣지 않는다. 에러 정책 `skip` 경로는 `error`(메시지 문자열)를 싣고 비활성 노드 경로는 둘 다 없다.
- **발행 시점에 자격 증명 값 패턴을 가린다.** 대상은 특정 필드가 아니라 payload 전체이고 내부 WebSocket wire 와 외부 fanout 양쪽이다. 예외는 `llmCalls` 하나다. `input`(노드 이벤트)과 REST `inputData` 는 같은 store 슬롯에 들어가므로 함께 가린다. 설정 에코에 자격 증명 패턴이 박혀 있으면 원본 echo 계약보다 마스킹이 우선한다. 범위·근거·잔여 갭은 [응답 자격 증명 마스킹](CLE-API-EGRESS.md) 이 정한다.
- **`execution.snapshot` 과 `execution.node.*` 의 마스킹 경로가 다르다.** 스냅샷은 `findById` 의 읽기 관문을 거치고 같은 소켓의 `execution.node.*` 발행은 그 관문을 거치지 않는 대신 발행 시점 값 마스킹을 받는다.

### 1.1 종결 이벤트의 필드 집합

종결 셋(`execution.completed`, `execution.failed`, `execution.cancelled`)의 필드와 행동 계약(`cancelledBy` 닫힌 union, `error.code` 매핑, 사용자 취소의 `error` 부재)은 [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) 이 기준이다. 여기에 필드를 다시 나열하지 않는다. 두 곳에 적어 두었더니 실제로 어긋났다.

- WebSocket 봉투는 **평면**이다. 필드 집합이 `executionId`·`seq`·`timestamp` 와 같은 층에 펼쳐지고 웹훅의 `payload` 래퍼는 **없다**.
- 평면은 봉투 차원 이야기라 필드 집합 안쪽의 중첩은 유지된다. 취소 사유는 `result.cancelledBy` 이지 최상위 `cancelledBy` 가 아니다.
- 이 문서 계열은 `durationMs` 를 `duration` 으로 적어 왔다. 같은 값이며 표기 차이는 그대로 둔다.
- 시스템 취소로 끝나는 코드(`EXECUTION_QUEUE_WAIT_TIMEOUT`, `WEBCHAT_IDLE_TIMEOUT`, `RESUME_*`)는 `execution.cancelled` 의 `error.code` 로 온다([에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md)).

### 1.2 `execution.node.failed` 의 `error` 와 `output` (2026-08-24 실측)

- **`error` 는 문자열이다.** 발행 4곳 전수 실측 결과 최상위 `error` 는 늘 `string`(메시지만)이다. `execution-engine.service.ts` 3곳(사전 검증 throw, 에러 포트 종결, 컨테이너 실패)과 `ai-turn-orchestrator.service.ts` 1곳이다.
- **구조화 에러 객체는 `output.output.error` 에만 있다.** 클라이언트는 재시도 가능 여부(`details.retryable`)와 대기 시간(`retryAfterSec`)을 거기서 읽는다.
- **`output` 은 발행 경로에 따라 실린다.** 에러 포트 종결(`finalizeErrorPortNode`)과 AI 턴 종결 **2곳만** `output: <nodeExec>.outputData`(completed 와 같은 래퍼)를 싣는다. 일반 사전 검증 throw 와 컨테이너 실패 2곳은 키 자체가 없다. 실릴 때는 그 래퍼도 fanout 에서 같은 허용 목록을 지난다.
- 래퍼와 도메인 값의 구분은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 Principle 0 이 정본이다. wire 봉투의 `output`·`nodeOutput` 은 노드 출력 래퍼 전체이고 도메인 값은 한 겹 아래다.

## 2. 실행 제어 명령 (Client → Server)

**실행 시작과 중단은 REST 다.** `execution.start`·`execution.stop` WebSocket 명령은 **비채택**이다. 실행 시작은 REST `POST /workflows/:id/execute`, 중단은 REST `POST /executions/:id/stop` 이 정식 경로이고 진행 상황은 `execution:{executionId}` 구독으로 받는다(근거: [WebSocket 연결과 채널 구독](CLE-API-WS.md) 의 "raw WebSocket 전제·REST 대체 항목 비채택"). 게이트웨이의 `@SubscribeMessage` 핸들러는 `subscribe`, `unsubscribe`, `ping`, `execution.submit_form`, `execution.click_button`, `execution.submit_message`, `execution.end_conversation`, `execution.retry_last_turn` 여덟 개뿐이다.

| 명령 | payload | 설명 |
|-----------|---------|------|
| `execution.start` _(비채택, REST 대체)_ | `{ workflowId, input?, fromNodeId?, breakpoints? }` | 실행 시작 요청. 정식 경로는 REST `POST /workflows/:id/execute`. `breakpoints?` 는 브레이크포인트(미구현)용 계획 필드 |
| `execution.stop` _(비채택, REST 대체)_ | `{ executionId, force? }` | 실행 중단 요청. 정식 경로는 REST `POST /executions/:id/stop` |
| `execution.continue` _(계획, 미구현)_ | `{ executionId }` | 브레이크포인트 뒤 계속([에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md) 의 브레이크포인트 로드맵) |
| `execution.step` _(계획, 미구현)_ | `{ executionId }` | 노드 하나만 실행하고 다시 정지(같은 로드맵) |
| `execution.submit_form` | `{ executionId, formData }` | Form 노드에 사용자 입력 제출. `nodeId`·`toolCallId` 는 **클라이언트가 보내는 필드가 아니다.** 대기 노드는 서버가 조회하고([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 의 사전 검증), AI 에이전트 `render_form` 응답의 `toolCallId` 는 서버가 보관한 `pendingFormToolCall` 재개 상태로 맞춘다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)). 외부 wire 는 이 형태를 유지하고 내부 재개 버스만 `{type:'form_submitted', formData}` 로 감싼다([Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md)) |
| `execution.click_button` | `{ executionId, nodeId?, buttonId }` | 버튼이 설정된 Presentation 노드의 버튼 클릭. `buttonId` 는 port 타입 버튼의 UUID 또는 `__continue__`(link 전용일 때 Continue 동작). `nodeId` 는 선택이다. **보내면** 발행 쪽이 실제 대기 노드와 대조하고 보내지 않으면 `executionId` 와 상태 조회만으로 대기 노드를 찾는다(프론트엔드는 보내지 않아 실제로는 쓰이지 않는다) |
| `execution.submit_message` | `{ executionId, nodeId, message }` | AI 에이전트 멀티턴의 사용자 메시지 전송. **폼 우회**: `interactionType: 'ai_form_render'` 로 대기 중에 이 명령이 오면 서버가 `pendingFormToolCall.toolCallId` 와 맞는 `render_form` 도구의 tool_result 를 `{type:'cancelled', reason:'user_sent_message_instead'}` 로 채우고 `pendingFormToolCall` 을 비운 뒤 일반 `ai_user` 턴을 진행한다. LLM 의 다음 추론을 자유롭게 둔다. 화면의 메시지 입력은 늘 활성이다(폼 우회 허용) |
| `execution.end_conversation` | `{ executionId, nodeId }` | AI 에이전트 멀티턴 대화 종료 요청 |
| `execution.retry_last_turn` | `{ executionId, nodeExecutionId }` | 마지막 턴 재시도. AI 에이전트 멀티턴이 재시도 가능한 에러(`outputData.output.error.details.retryable === true`, 래퍼 한 겹 아래)로 끝난 뒤 같은 `nodeId` 의 새 노드 실행 행을 만들어 마지막 LLM 호출로 다시 들어간다. `nodeId` 대신 `nodeExecutionId` 를 쓰는 이유는 같은 `nodeId` 가 노드 실행 행을 여럿 가질 수 있어 행 단위 식별이 필요하기 때문이다. 워크플로우 [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) 과 다르다. 같은 실행 안에서 노드 단위로 다시 시도한다 |

### 2.1 ack 형태

실제 wire 에서 재개 명령 넷과 `retry_last_turn` 의 ack 는 Socket.IO ack callback 의 `{ event, data: { success, ... } }` 다(`handleClickButton` 등의 반환). 아래 예시 중 `{ type, id, payload }` 표기는 논리 형태다.

**버튼 클릭 응답** (Socket.IO ack callback):

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
  "type": "execution.form_submitted",
  "id": "req-uuid",
  "payload": { "executionId": "uuid", "resumed": true, "queued": true }
}
```

**메시지 전송 응답** (`execution.submit_message.ack`)과 **대화 종료 응답** (`execution.end_conversation.ack`)도 같은 형태다.

```json
{
  "type": "execution.submit_message.ack",
  "id": "req-uuid",
  "payload": { "executionId": "uuid", "resumed": true, "queued": true }
}
```

**실행 시작 응답 `execution.start.ack` 는 비채택이다.** 실행 시작은 REST 이고 그 REST 응답이 `executionId` 를 돌려준다. 참고용 형태만 남긴다.

```json
{
  "type": "execution.start.ack",
  "id": "req-003",
  "payload": { "executionId": "550e8400-e29b-41d4-a716-446655440000", "status": "pending" }
}
```

### 2.2 재개 명령 ack 의 공통 필드

네 명령(`click_button`, `submit_form`, `submit_message`, `end_conversation`)의 성공 ack 는 명령별 식별자만 다르고 `resumed`·`queued` 필드는 같다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `executionId` | uuid | 실행 ID (공통) |
| `resumed` | boolean | **재개 수락 여부(enqueue).** 정상적으로 큐에 넣으면 늘 `true` 이고 실패는 `queued: false` 로 드러난다. 모든 진입점이 늘 큐에 넣는 모델에서는 동기 ack 시점에 재개 성공을 알 수 없으므로 "재개 성공" 이 아니다. 최종 재개는 뒤따르는 `execution.resumed`·`execution.node.*` 이벤트로, rehydration 실패(`RESUME_*`)는 뒤따르는 `execution.cancelled` 이벤트로 확인한다. 이 ack 불리언 `resumed` 는 이름이 같은 재개 이벤트 `execution.resumed`, 노드 출력의 흐름 지시 상태 `resumed` 와 **별개**다 |
| `queued` | boolean | 재개 큐에 정상적으로 들어갔는지(`true` 정상, `false` Redis 장애 등 발행 실패). 관측·디버깅용이고 클라이언트 분기에 쓰지 않는다. `false` 면 다시 시도를 권한다 |
| 명령별 식별자 | 없음 | `buttonId`(`click_button`) / 없음(`submit_form`, `formData` 를 싣지 않음) / 없음(`submit_message`, `message` 를 싣지 않음) / 없음(`end_conversation`) |

- 클라이언트는 ack `resumed: true` 만으로 입력 대기 화면을 풀지 않는다. 동기 ack 시점에는 워커의 재개 처리가 아직 일어나지 않았다. 재개 큐의 동작은 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 가 정한다.
- ack data 에 `nodeId` 는 없다. 대기 노드는 서버가 조회(`execution_id + status='waiting_for_input'`)하고 클라이언트는 `executionId` 만으로 ack 를 맞춘다.
- 명령 본문에 `nodeId` 를 실은 경우(`submit_message`·`end_conversation` 은 프론트엔드가 대기 노드의 `nodeId` 를 싣는다) 서버는 조회로 찾은 대기 노드와 그 `nodeId` 를 **대조**해 다르면 `INVALID_EXECUTION_STATE` 로 거부한다. `nodeId` 는 조회 키가 아니라 낡거나 잘못 지정한 제출을 거르는 사후 검증 입력이다.

### 2.3 재개 명령의 에러

**실패 ack 형태**: 네 명령의 실패 ack 는 `{ success: false, error: string, errorCode?: string }` 다. `errorCode` 는 아래 표의 코드를 담는 **평면 필드**이고 기존 `error`(사람용 메시지)와 하위 호환되도록 형제로 더했다. `retry_last_turn` 의 중첩 `error: { code, message }` 와 층이 다른 것은 의도한 분리다. 네 명령은 처음부터 평면 `{ success, error }` 를 써 왔고 `errorCode` 는 그 위의 확장이다.

| 코드 | 설명 |
|------|------|
| `INVALID_BUTTON_ID` | 존재하지 않는 버튼 ID |
| `INVALID_EXECUTION_STATE` | 실행이 기대한 상태가 아님(네 명령은 입력 대기를, `retry_last_turn` 은 `failed` 를 기대). WebSocket 전용 코드다. REST 진입점은 422 `INVALID_STATE` 로 적는다(의도한 분리) |
| `INTERACTION_TIMEOUT` | 이미 타임아웃이 발생한 상태 |
| `EXECUTION_MESSAGE_TOO_LONG` | `submit_message` 메시지가 최대 길이(10000자)를 넘음. 발행 쪽 동기 검증(typed `MessageTooLongError`) |
| `VALIDATION_ERROR` | `submit_form` 필드 검증 실패(필수, 타입, minLength·maxLength, min·max, 정규식, select·radio 선택지, `type:'file'` MIME·크기·개수). 발행 쪽 `continueExecution` 관문이 노드 설정의 필드 정의로 동기 검증한다(typed `FormValidationError`). EIA REST 의 `400 VALIDATION_ERROR` 와 같은 뜻, 같은 검증 지점이다. 실행 상태는 유지되어 다시 제출할 수 있다. ack 는 평면 `{ success:false, error, errorCode:'VALIDATION_ERROR' }` 이고 **필드별 `details[]` 가 없다.** 필드별 상세(`{field,message,code}`)는 EIA REST 경로(`400` body `error.details[]`, [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md))에서만 준다. WebSocket 클라이언트는 사람용 `error` 문자열로 폼을 다시 보인다 |
| `EXECUTION_INTERNAL_ERROR` | 재개 처리 중 typed `ExecutionError` 가 아닌 내부 에러(DB, 서드파티, 예기치 못한 throw). ack `error` 는 **고정 일반 문자열**이고 내부 `error.message` 는 클라이언트에 보내지 않는다(서버 로그 전용) |

- **누출 차단(typed·plain 분기)**: ack 의 `error` 문자열은 에러 타입에 따라 채운다. typed `ExecutionError`(`InvalidExecutionStateError` 등)면 그 클래스의 고정된 클라이언트용 `message` 를, 그 밖의 plain `Error` 면 호출부가 정한 고정 일반 문자열을 담고 `errorCode='EXECUTION_INTERNAL_ERROR'` 로 드러낸다. 내부 메시지(스택 힌트, DB·서드파티 원문, 내부 식별자)는 서버 로그에만 남긴다. 계약과 근거는 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 의 ack 에러 표면 절이다.
- **rehydration 실패는 ack 가 아니다.** `RESUME_CHECKPOINT_MISSING`, `RESUME_FAILED`, `RESUME_INCOMPATIBLE_STATE` 는 워커 쪽 **비동기** 실패라 ack 가 아니라 뒤따르는 `execution.cancelled` 이벤트의 `error.code` 로 알린다. 동기 ack 에 실패가 담기는 경우는 발행 쪽 사전 검증뿐이다. 이 세 코드는 네 명령의 재개 경로에만 해당하고 `retry_last_turn` 은 rehydration 경로를 타지 않아 대상이 아니다(§2.4). 코드 뜻은 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 에 있다.

### 2.4 마지막 턴 재시도 (`execution.retry_last_turn`)

ack 는 `execution.click_button.ack` 의 `resumed` 패턴에 실패 시 `error` 객체를 더한 형태다.

```json
{
  "type": "execution.retry_last_turn.ack",
  "id": "req-uuid",
  "payload": { "executionId": "uuid", "nodeExecutionId": "uuid", "resumed": true }
}
```

실패 응답:

```json
{
  "type": "execution.retry_last_turn.ack",
  "id": "req-uuid",
  "payload": {
    "executionId": "uuid",
    "nodeExecutionId": "uuid",
    "resumed": false,
    "error": { "code": "RETRY_STATE_NOT_FOUND", "message": "..." }
  }
}
```

- ack 에 `nodeId` 는 없다. 클라이언트가 `nodeExecutionId` 만 보내고 ack 도 같은 식별자만 되돌려준다. `nodeId` 는 `nodeExecutionId` 로 서버가 찾을 수 있다.
- 실제 ack callback payload 는 재개 명령 넷과 같이 `success: boolean` 형제 필드를 담는다. 성공 `{ success: true, executionId, nodeExecutionId, resumed: true }`, 실패 `{ success: false, executionId, nodeExecutionId, resumed: false, error: { code, message } }` 다. §2.3 의 평면 `{ success, error }` 관례를 따르고 실패 때 평면 `errorCode` 대신 중첩 `error: { code, message }` 를 쓰는 것만 다르다.
- ack 의 `resumed: false` 는 네 명령과 달리 발행 쪽 **동기** 검증 실패(`failed` 상태 기대 불충족 등)를 반영한다. `RESUME_*` 비동기 경로와 무관하다.

| 코드 | 설명 |
|------|------|
| `RETRY_STATE_NOT_FOUND` | `NodeExecution.outputData._retryState` 가 DB 에 없거나 만료됨(`expiresAt` TTL 초과, 또는 다른 재시도가 이미 소비). 별도 토큰 필드는 payload 에 없다 |
| `NODE_NOT_RETRYABLE` | 대상 노드의 `outputData.output.error.details.retryable === false` 이거나 재시도 가능한 에러로 끝나지 않음(정상 종결, 조건 종결 등) |
| `RETRY_TOO_EARLY` | `outputData.output.error.details.retryAfterSec` 카운트다운이 끝나기 전 호출(서버 쪽 강제). 클라이언트가 버튼을 비활성으로 두면 정상적으로는 생기지 않는다 |
| `INVALID_EXECUTION_STATE` | 대상 노드 실행이 `FAILED` 가 아니거나 실행이 재시도에 들어갈 수 있는 상태가 아님(사전 검증 실패). 재개 명령의 같은 코드와 뜻을 공유한다(기대 상태만 다르다) |

**`_retryState` 소비 원자성과 TTL (구현 계약)**

- **한 번만 소비한다.** 재시도 처리는 `nodeExecutionId` 로 `_retryState` 를 조회하고 **같은 트랜잭션 안에서** `NodeExecution.outputData` 에서 `_retryState` 키를 지우며(JSONB `-` 연산) 새 노드 실행 행을 만든다. 키 제거가 affected=1 인 쪽만 진행해 동시 재시도가 행을 중복으로 만드는 것을 막는다. 한 번 소비하면 뒤 재시도는 `RETRY_STATE_NOT_FOUND` 다.
- **TTL**: `_retryState.expiresAt`(ISO 8601). 기본 60분이고 환경 변수 `AI_RETRY_STATE_TTL_MINUTES` 로 바꾼다. `now > expiresAt` 이면 `RETRY_STATE_NOT_FOUND` 다. 만료된 미소비 `_retryState` 는 행의 `outputData` 에 남아 있다가(별도 정리 작업 없음, 행 수명을 따른다) 다음 시도 때 만료로 거부된다.
- **재개 버스를 거쳐 워커로 넘긴다.** WebSocket 게이트웨이(다른 인스턴스일 수 있음)는 턴을 동기로 재개할 수 없다. 다시 들어가려면 살아 있는 실행 컨텍스트를 rehydrate 하고 `processAiResumeTurn`(단발 턴 처리기)을 돌려야 하는데 이는 **실행 워커 컨텍스트**에서만 된다. 그래서 검증, 원자 소비, 새 행 생성 뒤 재개 큐(`execution-continuation`)에 **새 job 종류 `retry_last_turn`** 을 넣어 워커로 넘긴다. 워커는 그 job 으로 새 행을 `_retryState`(`_resumeState` 형태)로 채운 채 `processAiResumeTurn`(retryReentry)으로 다시 들어간다. `submit_message` 등과 같은 WebSocket → 워커 다리를 쓰되 대기 행 재개가 아니라 **새 행 재개**라는 점만 다르다.
- **재시도 중 취소**: 다시 들어간 턴이 `running` 으로 도는 동안 사용자 중단(REST `POST /executions/:id/stop`)이 오면 진행 중인 턴을 즉시 끊지 않는다. 취소 기록은 바로 커밋되고 재시도는 다음 턴 경계에서 이를 관측해 끝낸다. park 에 닿으면 park 쪽 취소가 짝 행을 마감한다. 이때 `execution.cancelled` 가 나가고 `execution.completed`·`execution.failed` 는 나가지 않는다. 상세 규칙은 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 가 정한다.
- **다시 들어간 턴이 끝난 뒤 그래프 진행**: 성공하면 새 노드 실행은 일반 노드 `COMPLETED` 와 같이 출력 포트의 다음 노드로 그래프 진행이 이어진다([실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md), [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md)). 실패하면 일반 노드 `FAILED` 와 같이 끝난다(실행도 `FAILED`). **다시 들어간 턴이 대화를 끝내지 않으면**(가장 흔한 경우) 종결이 아니라 입력 대기로 **다시 park** 하고 세그먼트를 끝낸다. 다음 사용자 입력이 오면 일반 rehydration 재개 경로로 합류한다. 워크플로우 재실행과 갈리는 점은 "같은 실행 안 노드 단위 재진입" 이지 "다음 노드 진행 차단" 이 아니다. AI 에이전트 쪽 서술은 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 에 있다.

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

## 4. 입력 대기 이벤트 상세 (`execution.waiting_for_input`)

`interactionType`(대기 표면, `WaitingInteractionType`) 필드로 Form 노드, 버튼 Presentation 노드, AI 에이전트 멀티턴을 가른다.

**실제 wire 필드 이름 주의 (fanout 봉투)**: 아래 JSON 은 논리 구조 표기다.

- 서버가 보내는 평면 wire 는 대기 노드 ID 를 `nodeId` 가 아니라 **`waitingNodeId`**(대기 노드 ID)로 싣고 `waitingNodeType`·`waitingNodeLabel`·`nodeExecutionId`·`startedAt`(에디터 타임라인 관측용)을 평면으로 합친다.
- Form·AI 노드 설정은 최상위 `formConfig`·`conversationConfig` 가 아니라 **`nodeOutput`** 안에 중첩된다(예: `nodeOutput.conversationConfig`). `buttons` 는 최상위 `buttonConfig` 를 유지한다.
- 이 fanout 봉투는 내부 WebSocket store 와 EIA SSE 스트림이 함께 쓴다. 단 `nodeOutput`(과 `buttonConfig.nodeOutput`)의 키 집합은 함께 쓰지 않는다. 외부로 나가는 복제본에만 fail-closed 허용 목록이 걸려 엔진 내부 필드(`_retryState` 등)가 빠진다(2026-08-23). 내부 WebSocket 은 원문 그대로다. `execution.node.*` 의 `envelope.output` 도 2026-08-24 에 같은 목록으로 닫혔다. 허용 목록 표는 [응답 자격 증명 마스킹](CLE-API-EGRESS.md) 이 정본이다.
- **외부 클라이언트가 읽는 필드 매핑의 기준은 [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md)**(와 위젯 파서 `parseWaitingForInput`)다. WebSocket 내부 부가 식별자(`waitingNodeType`, `waitingNodeLabel`, `nodeExecutionId`, `startedAt`)는 이 절이 정한다. 발행 기준은 `form-interaction`·`button-interaction`·`ai-turn-orchestrator` 서비스의 `emitExecution(EXECUTION_WAITING_FOR_INPUT, …)` 이다.

**Form 노드 (`interactionType: "form"`)**

```json
{
  "type": "execution.waiting_for_input",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "nodeType": "form",
    "interactionType": "form",
    "formConfig": {
      "title": "Approval Request",
      "description": "Please review...",
      "fields": [ ... ],
      "submitLabel": "Submit",
      "timeout": 300
    }
  }
}
```

**버튼 Presentation 노드 (`interactionType: "buttons"`)**

```json
{
  "type": "execution.waiting_for_input",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "nodeType": "carousel",
    "interactionType": "buttons",
    "buttonConfig": {
      "buttons": [
        { "id": "uuid-1", "label": "승인", "type": "port", "style": "primary" },
        { "id": "uuid-2", "label": "상세보기", "type": "link", "url": "https://...", "style": "outline" }
      ],
      "nodeOutput": {
        "config": { "items": [ "..." ], "buttonConfig": { "...": "..." } },
        "output": { "items": [ "..." ] },
        "status": "waiting_for_input"
      }
    }
  }
}
```

| 필드 | 설명 |
|------|------|
| `interactionType` | `form`: Form 노드. `buttons`: 버튼이 설정된 Presentation 노드. `ai_conversation`: AI 에이전트 멀티턴 일반 대화. `ai_form_render`: AI 에이전트가 `render_form` 도구로 사용자 폼 제출을 기다림. 값 집합의 기준은 [인터랙션 타입 레지스트리](../CLE-IX/CLE-IX-TYPES.md) |
| `formConfig` | **`interactionType = form` 한정** 최상위 필드. 그래프 Form 노드의 폼 설정. `ai_form_render` 는 최상위에 없고 `conversationConfig.pendingFormToolCall.formConfig` 에 중첩된다(아래 행). 화면이 폼 출처를 한 위치에서 읽게 한다 |
| `buttonConfig` | `interactionType = buttons` 일 때 있다. 버튼 정의와 노드 렌더링 출력(`{ buttons, nodeOutput }`). 버튼을 누를 때까지 제한 없이 기다리며 타임아웃 필드가 없다([Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md)) |
| `buttonConfig.nodeOutput` | 노드의 구조화 출력(노드 출력 `{ config, output, meta?, port?, status }`). 클라이언트가 콘텐츠와 버튼을 함께 보인다. 노드 종류는 상위 `payload.nodeType` 으로 식별하고 `nodeOutput` 에 `type` 판별자 래퍼를 두지 않는다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md)). `nodeOutput.nodeType` 도 이 금지 대상이다(아래) |
| `conversationConfig` | `interactionType ∈ {ai_conversation, ai_form_render}` 일 때 있다. AI 에이전트 멀티턴 대화 설정 |
| `nodeOutput.meta.turnDebug` | `interactionType ∈ {ai_conversation, ai_form_render}` 일 때 있다. **진행 중 누적 관측 델타**다. `_resumeState` 의 누적치를 `meta.*` 로 펼쳐 실행 결과 화면의 참조·LLM 사용량 탭이 **대기 중에도** 동작하게 한다(`_resumeState` 자체는 시스템 프롬프트·`llmConfigId` 같은 내부 필드를 담아 클라이언트로 보내지 않는다). 항목 형태: `{ turnIndex, ragSources[], ragDiagnostics?, llmCalls?, toolCalls?, totalDurationMs? }`. **소비 경계**: `ragSources` 는 대화 미리보기의 보조 관측 레인(🔎 `rag` 행, 📚 칩)도 쓸 수 있고([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)), **`llmCalls` 는 디버그 탭 전용**(원본 요청·응답)이다. 발행 기준은 `ai-turn-orchestrator.service.ts` 의 `buildConversationMetaFromResumeState` 이고 내역 대응물은 영속된 `outputData.meta` 다. 두 표면이 같은 형태라 화면이 분기하지 않는다 |
| `conversationConfig.pendingFormToolCall` | **`interactionType = ai_form_render` 한정**. 형태 `{ toolCallId: string, formConfig: object }`. `toolCallId` 는 화면이 렌더할 폼 페이로드를 찾는 매칭 키다(제출 때 클라이언트가 되돌려 보내는 필드가 아니다. `submit_form` payload 는 `{ executionId, formData }` 뿐이고 서버가 보관한 값으로 맞춘다). `formConfig` 는 LLM 페이로드에 `presentationTools[*].defaults` 를 덮어쓴 결과(Form 노드 입력 스키마 형태)다. 화면의 `AssistantPresentationsBlock` 이 assistant 턴의 `presentations[*]` 중 `payload.toolCallId === pendingFormToolCall.toolCallId` 인 폼 페이로드를 입력 가능한 `DynamicFormUI` 로 렌더한다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)) |

**`nodeOutput.nodeType` 에 대해 (2026-08-24)**: 엔진은 `nodeType` 을 `nodeOutput` 안에 넣지 않는다. `nodeOutput` 안의 `nodeType` 은 값 공간이 `chart`·`table`·`carousel` 로 payload 의 노드 종류와 같다. 즉 Rationale "`buttonConfig` 예시 정정" 의 C3 가 "상위에서 이미 식별되므로 불필요하고 중복" 이라며 기각한 바로 그 판별자다.

| 층 | 상태 |
|---|---|
| 엔진(발행·영속) | `nodeOutput` 안에 `nodeType` 을 **넣지 않는다**(C3 준수). `nodeType:` 대입은 모두 봉투 수준이고 실 DB 조회(e2e 285건, `node_execution.output_data` object 84행)에서도 최상위 `nodeType` 은 0행이다 |
| 채팅 채널 렌더러 | `nodeOutput?.nodeType` 을 **읽는다**(프로바이더 셋). 옛 평탄 형태를 만나도 죽지 않으려는 방어적 읽기다 |
| fanout 허용 목록 | `nodeType` 을 통과 목록에 둔다. 그 방어를 깨지 않으려는 예방적 허용이지 계약 편입이 아니다 |

읽는 쪽이 있다고 넣어도 된다는 뜻은 아니다. 새 코드가 `nodeOutput.nodeType` 을 **쓰는** 것은 여전히 C3 위반이다. 노드 종류를 읽어야 하면 봉투 쪽을 쓰되 소비자에 따라 갈린다.

- **내부(에디터 WebSocket 타임라인)**: 입력 대기 이벤트의 실제 wire 필드 `waitingNodeType`.
- **외부 클라이언트(SSE, 채팅 채널, SDK)**: **`interactionType` 으로 분기한다.** [External Interaction API](../CLE-IX/CLE-EIA.md) 는 `node.type` 에 외부 소비 매핑이 없고 `waitingNodeType` 은 WebSocket 내부 부가 식별자라고 정한다.

**AI 에이전트 멀티턴 노드 (`interactionType: "ai_conversation"`)**

```json
{
  "type": "execution.waiting_for_input",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "nodeType": "ai_agent",
    "interactionType": "ai_conversation",
    "conversationConfig": {
      "message": "안녕하세요! 무엇을 도와드릴까요?",
      "messages": [
        { "role": "user", "content": "[from Template] clicked: 시작", "source": "injected" },
        { "role": "user", "content": "첫 번째 사용자 메시지", "source": "live" },
        { "role": "assistant", "content": "안녕하세요! 무엇을 도와드릴까요?", "source": "live" }
      ],
      "turnCount": 1,
      "maxTurns": 20
    }
  }
}
```

**사용자 메시지 전송 (`execution.submit_message`)**

```json
{
  "type": "execution.submit_message",
  "id": "req-uuid",
  "payload": { "executionId": "uuid", "nodeId": "uuid", "message": "주문 상태를 확인해주세요" }
}
```

**대화 종료 요청 (`execution.end_conversation`)**

```json
{
  "type": "execution.end_conversation",
  "id": "req-uuid",
  "payload": { "executionId": "uuid", "nodeId": "uuid" }
}
```

### 4.1 AI 응답 이벤트 (`execution.ai_message`)

서버가 LLM 응답을 처리한 뒤 보내는 이벤트다. 종료 조건을 채우지 못하면 `execution.waiting_for_input` 이 다시 나간다. 입력 대기로 이어지는 진행 중 발행과 대화 종료 뒤 최종 발행 두 분기가 같은 형태로 직렬화한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `executionId` | uuid | 실행 ID |
| `nodeId` | uuid | 응답을 낸 AI 노드 ID |
| `message` | string | 사용자에게 보일 어시스턴트 응답 텍스트 |
| `turnCount` | number | 지금까지의 user → assistant 사이클 수 |
| `messages` | object[] | system 을 뺀 user·assistant·tool 메시지 권위 스냅샷 |
| `messages[].source` | `'live' \| 'injected'` | 메시지 출처 표시(전송 출처 표시). `live` 는 이번 발행을 일으킨 AI 노드가 직접 처리·생성한 메시지, `injected` 는 대화 스레드 자동 주입으로 앞에 붙은 맥락 메시지다. 디버깅 타임라인의 턴 매칭이 백엔드 `turnCount` 와 맞으려면 필요하다. 정의는 §4.6 |
| `metadata.model` | string? | 마지막 호출에 쓴 모델 식별자 |
| `metadata.inputTokens` | number? | **대화 전체 누적** 입력 토큰(그 턴 단독 아님) |
| `metadata.outputTokens` | number? | **대화 전체 누적** 출력 토큰 |
| `llmCalls` | object[]? | 그 턴에 생긴 모든 LLM 호출(도구 루프 포함). 디버깅 타임라인의 응답·요청·LLM 사용량 탭이 어시스턴트 메시지 단위로 맞추는 데 쓴다 |
| `llmCalls[].requestPayload` | unknown? | LLM 프로바이더에 보낸 원본 요청(messages, tools, params) |
| `llmCalls[].responsePayload` | unknown? | LLM 프로바이더가 돌려준 원본 응답(content, model, usage, stopReason 등) |
| `llmCalls[].durationMs` | number? | **LLM 요청 하나**의 소요 시간 |
| `llmCalls[].startedAt` | ISO8601 string? | 그 LLM 호출을 **보낸 절대 시각**. 디버깅 타임라인이 어시스턴트 메시지(도구 호출만 있는 응답 포함)의 발생 시각을 보이는 1차 출처다. `finishedAt = startedAt + durationMs` 관계를 만족한다(엔진이 둘 다 직접 재므로 ms 단위 차이가 날 수 있다) |
| `llmCalls[].finishedAt` | ISO8601 string? | 그 LLM 호출의 응답을 **받은 절대 시각** |
| `durationMs` | number? | **턴 전체** 소요 시간(모든 LLM 호출과 도구 실행 합) |
| `presentations` | PresentationPayload[]? | AI 에이전트가 표시 도구(`render_*`)를 부른 턴에서만 싣는다. `ai_assistant` 대화 기록 항목의 최상위 `presentations[]` 스냅샷이다. 타입 정의 기준은 [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md). 클라이언트가 채팅 화면에서 텍스트와 함께 렌더한다 |

`llmCalls[].requestPayload`·`responsePayload` 는 원본 디버그 payload 다. 시스템 프롬프트, 대화 이력, 도구 정의, 사용자 입력 같은 민감 데이터를 담을 수 있어 에디터 디버깅 타임라인 같은 **개발자·에디터 표면** 전용이다. 그래서 `llmCalls` 는 워크스페이스 인증·소유권으로 게이트된 내부 WebSocket 채널에만 실리고 모든 외부 fanout 수신자와 EIA 단발 상태 조회에서는 필드 이름 기준으로 어느 깊이에서든 빠진다. DB 영속 경로와 실행 내역 디버그 패널은 영향이 없다. 결정과 근거는 [응답 자격 증명 마스킹](CLE-API-EGRESS.md) 에 있다.

```json
{
  "type": "execution.ai_message",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "message": "주문번호 ORD-12345는 현재 배송 중입니다.",
    "turnCount": 2,
    "messages": [
      { "role": "user", "content": "[from Template] clicked: 시작", "source": "injected" },
      { "role": "user", "content": "주문 ORD-12345 확인해줘", "source": "live" },
      { "role": "assistant", "content": "주문번호 ORD-12345는 현재 배송 중입니다.", "source": "live" }
    ],
    "metadata": { "model": "claude-sonnet-4-6", "inputTokens": 512, "outputTokens": 128 },
    "llmCalls": [
      {
        "requestPayload": { "messages": [ ... ], "tools": [ ... ] },
        "responsePayload": { "content": "...", "model": "...", "usage": { ... } },
        "durationMs": 842,
        "startedAt": "2026-05-10T06:42:01.500Z",
        "finishedAt": "2026-05-10T06:42:02.342Z"
      }
    ],
    "durationMs": 842
  }
}
```

### 4.2 사용자 발화 조기 노출 이벤트 (`execution.user_message`)

엔진이 사용자 메시지를 받아 멀티턴 노드를 재개하는 시점([AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md) 의 `message_received` 재개 tick, **다음 턴 LLM 호출 전**)에 1회 보낸다. 사용자 발화가 AI 응답 생성 전에 라이브 대화 화면에 바로 보이게 하는 것이 목적이다. WebSocket `submit_message` 와 채널 텍스트 인바운드(Telegram 등)가 함께 지나는 재개 관문에서 보내므로 채널에서 온 메시지도 자동으로 덮인다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `executionId` | uuid | 실행 ID |
| `nodeId` | uuid | 메시지를 받은 AI 노드 ID |
| `nodeExecutionId` | uuid | **이 시점에 입력 대기였던 노드 실행 행의 PK.** dedup·맞춤 때 턴 행 식별자다. 엔진의 `execution_id + node_id + status='waiting_for_input'` 단일 매칭과 같은 행이다 |
| `message` | string | 사용자가 보낸 발화. Presentation 노드 버튼의 `ButtonDef.userMessage`(버튼 클릭 발화 텍스트)와 무관하다 |
| `receivedAt` | ISO8601 string | 엔진이 메시지를 받은 시각. AI 에이전트 노드 출력의 `output.interaction.receivedAt` 과 **같은 수신 tick** 이다(엔진과 핸들러가 따로 만들어 ms 단위 차이가 날 수 있다. dedup 은 이 필드만, 맞춤은 `ai_message` 내용 기준이라 정확한 일치에 기대지 않는다) |

```json
{
  "type": "execution.user_message",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "nodeExecutionId": "uuid",
    "message": "주문 ORD-12345 확인해줘",
    "receivedAt": "2026-05-10T06:42:01.123Z"
  }
}
```

- 이 WebSocket 페이로드는 노드 출력의 사용자 입력 기록(`output.interaction`, `message_received` 형태, [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md))과 **별개 표면**이다. 뒤의 것은 관측·실행 내역 기록용 핸들러 출력 스냅샷이고 이것은 라이브 대화 화면용 가벼운 신호다. 같은 수신 사건의 두 전송이며 `receivedAt` 값을 함께 쓴다.
- **dedup 기준**: 클라이언트는 `receivedAt` 을 1차 dedup 키로 써서 낙관적 `ai_user` 말풍선이 겹치지 않게 한다. 뒤이어 오는 `ai_message.messages` 권위 스냅샷의 마지막 `source:'live'` 사용자 메시지와 맞추는 것은 폴백 경로다([대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md)).

### 4.3 도구 호출 이벤트

**도구 호출 시작 (`execution.tool_call_started`)**: AI 에이전트가 도구 프로바이더의 도구(지식 저장소, MCP 등)를 실행하기 직전에 보낸다. 디버깅 타임라인은 이 이벤트로 대기 중인 도구 항목을 바로 보여 진행 상황을 알린다. `arguments` 는 LLM 이 만든 JSON 문자열 그대로다(파싱은 클라이언트 책임). `startedAt` 은 도구 실행을 **시작한 절대 시각**(ISO8601)이고 타임라인이 라이브와 턴 종료 뒤 영속(`meta.turnDebug[].toolCalls[].startedAt`) 모두에서 같은 시각을 되살리도록 싣는다.

```json
{
  "type": "execution.tool_call_started",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "turnIndex": 1,
    "toolCallId": "call_abc123",
    "name": "kb_workspace_main",
    "arguments": "{\"query\":\"오늘의 날씨\"}",
    "startedAt": "2026-05-10T06:42:03.100Z"
  }
}
```

**도구 호출 완료 (`execution.tool_call_completed`)**: 도구 실행이 끝나면(성공·실패 무관) 보낸다. `status` 는 `success` 또는 `error` 다. 실패해도 핸들러가 LLM 에 에러 content 를 넘겨 회복 기회를 주므로 턴은 계속된다. 화면은 이 이벤트로 항목을 성공·에러 상태로 바꾼다. `startedAt`(대응 `tool_call_started.startedAt` 과 같음)·`finishedAt` 은 도구 실행의 시작·종료 절대 시각이고 `meta.turnDebug[].toolCalls[]` 에도 똑같이 영속돼 실행 내역 화면이 라이브와 같은 시각을 보인다.

```json
{
  "type": "execution.tool_call_completed",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "turnIndex": 1,
    "toolCallId": "call_abc123",
    "content": "{\"results\":[...]}",
    "status": "success",
    "durationMs": 1240,
    "startedAt": "2026-05-10T06:42:03.100Z",
    "finishedAt": "2026-05-10T06:42:04.340Z"
  }
}
```

실패 예시:

```json
{
  "type": "execution.tool_call_completed",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "turnIndex": 2,
    "toolCallId": "call_def456",
    "content": "{\"error\":\"MCP server timeout\"}",
    "status": "error",
    "error": "MCP server timeout",
    "durationMs": 30000,
    "startedAt": "2026-05-10T06:42:05.000Z",
    "finishedAt": "2026-05-10T06:42:35.000Z"
  }
}
```

### 4.4 라이브 신호의 맞춤과 시각 영속

- **맞춤(reconciliation)**: `tool_call_started`·`tool_call_completed`·`user_message` 가 손실돼도 턴 종료 때 오는 `execution.ai_message` 의 `messages` 스냅샷과 `meta.turnDebug[].toolCalls` 가 권위다. 클라이언트는 도구 항목을 `toolCallId`, 낙관적 사용자 말풍선을 `receivedAt` 으로 dedup 한다. 클라이언트가 직접 보내면서 바로 띄운 같은 발화 말풍선이 이미 있으면 `user_message` 는 새 말풍선을 더하지 않고 기존 말풍선에 `receivedAt` 을 찍어 맞춘다(이후 `receivedAt` 은 재발행의 dedup 키로 계속 쓰인다). 즉 `user_message` 는 사용자 발화의 조기 노출(라이브 UX)만 맡고 영속·내역 정합은 `ai_message` 스냅샷이 보장한다.
- **요소별 발생 시각·소요 시간 영속**: `llmCalls[].startedAt`·`finishedAt` 과 `toolCalls[].startedAt`·`finishedAt` 은 라이브 WebSocket 이벤트뿐 아니라 `meta.turnDebug[]` JSON(`NodeExecution.output_data`)에도 영속된다. 그래서 실행 내역 화면(라이브 이벤트 없이 영속 스냅샷에서 다시 만든다)도 어시스턴트 응답과 도구 실행의 절대 발생 시각을 라이브와 같게 보인다. 사용자 발화 시각은 `receivedAt`, Presentation·system 항목은 `ConversationThread.turns[].timestamp` 가 1차 출처다. 모두 하위 호환 선택 필드라 값이 없는 과거 데이터는 시각을 `—` 로 생략한다.

### 4.5 대화 스레드 스냅샷 (`conversationThread`)

`conversationThread` 는 모든 대기 표면(`form`, `buttons`, `ai_conversation`, `ai_form_render`)의 payload 에 선택적으로 실린다. 화면의 라이브 대화 패널이 워크플로우 실행 도중 쌓이는 대화 스레드를 보일 때 쓴다.

```json
{
  "type": "execution.waiting_for_input",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "interactionType": "ai_conversation",
    "conversationConfig": { },
    "conversationThread": {
      "id": "default",
      "nextSeq": 4,
      "turns": [
        { "seq": 0, "nodeId": "...", "nodeType": "form", "source": "presentation_user", "text": "name=Alice", "timestamp": "..." },
        { "seq": 1, "nodeId": "...", "nodeType": "ai_agent", "source": "ai_user", "text": "주문 상태 확인해줘", "timestamp": "..." },
        { "seq": 2, "nodeId": "...", "nodeType": "ai_agent", "source": "ai_assistant", "text": "어떤 주문 번호인가요?", "timestamp": "..." },
        { "seq": 3, "nodeId": "...", "nodeType": "ai_agent", "source": "ai_user", "text": "ORD-12345", "timestamp": "..." }
      ],
      "totalChars": 142
    }
  }
}
```

| 필드 | 설명 |
|------|------|
| `conversationThread.id` | v1 은 늘 `"default"` |
| `conversationThread.nextSeq` | 다음 항목에 붙을 순번. 평소에는 `turns.length` 와 같고 저장 상한 때문에 오래된 항목을 지운 뒤에는 더 클 수 있다(순번을 다시 쓰지 않으려고). 클라이언트는 `turns.length` 로 순번을 추정하지 않는다. 기준은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) |
| `conversationThread.turns[i]` | 대화 기록 항목(`ConversationTurn`). 형태 기준은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) |
| `conversationThread.totalChars` | 누적 글자 수(상한 판정용 빠른 경로. 클라이언트는 표시할 때 무시해도 된다) |

Background 본문에는 따로 떨어진 대화 스레드가 있다. 메인 흐름의 `execution.waiting_for_input` payload 에는 Background 본문의 항목이 들어가지 않는다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)).

### 4.6 `messages[].source` 표시

`waiting_for_input.conversationConfig.messages` 와 `ai_message.messages` 의 각 항목에는 아래 두 값 중 하나의 `source` 표시(전송 출처 표시)가 있다. 이 표시는 WebSocket 페이로드 전용 두 값이고 백엔드 내부의 항목 출처(`ConversationTurnSource`, [대화 스레드](../CLE-IX/CLE-IX-THREAD.md))와 다른 개념이다. 내부 값은 발행 단계에서 아래 매핑으로 두 값으로 줄어든다.

| 값 | 뜻 |
|---|---|
| `live` | 이번 발행을 일으킨 AI 노드가 이번 턴에 실제로 처리·생성한 메시지. `processMultiTurnMessageInner` 가 넣은 user·assistant·tool 메시지, 단일 턴의 userPrompt 와 최종 assistant 등이 모두 여기다 |
| `injected` | 대화 스레드 자동 주입(`contextScope: 'thread' \| 'lastN'`)이나 명시적 `$thread` 사용으로 messages 앞에 붙은 맥락 메시지. 앞 노드의 항목이 대화 스레드의 messages 모드 매핑으로 바뀐 결과다 |

**항목 출처 → `source` 매핑**

| 항목 출처 (내부) | 발행 시 `source` | 비고 |
|---|---|---|
| `presentation_user` | `injected` | 앞의 Form·Carousel·Template 등의 항목. `[from <nodeLabel>] ` prefix 가 붙은 `role: 'user'` 메시지 |
| `ai_user` (앞의 다른 AI 에이전트) | `injected` | 주입 경로로 앞에 붙은 다른 AI 에이전트의 사용자 항목 |
| `ai_user` (자기 노드의 처리 결과) | `live` | `processMultiTurnMessageInner` 가 넣은 현재 사용자 메시지 |
| `ai_assistant` (앞의 다른 AI 에이전트) | `injected` | 주입 경로로 앞에 붙은 다른 AI 에이전트의 어시스턴트 항목 |
| `ai_assistant` (자기 노드의 턴 결과) | `live` | 현재 노드가 LLM 호출로 만든 어시스턴트 응답 |
| `ai_tool` (앞의 노드) | `injected` | 주입으로 앞에 붙은 도구 결과(`includeToolTurns: true` 한정) |
| `ai_tool` (자기 노드의 도구 루프) | `live` | 이번 턴의 도구 호출 결과 |
| `system` | 해당 없음 | system 메시지는 `buildConversationConfigFromOutput` 에서 걸러져 발행 payload 에 없다 |

판정 기준은 이렇다. 발행 payload 를 만드는 시점에 그 메시지가 "이번 발행을 일으킨 AI 에이전트 노드 자신이 직접 처리·생성한 것" 이면 `live`, 그 밖(다른 노드 출처의 스레드 주입 결과)은 `injected` 다. 같은 항목 출처(`ai_user`·`ai_assistant`·`ai_tool`)라도 출처 노드가 자기인지에 따라 표시가 갈린다.

**소비 쪽 권장 동작**

- 디버깅 타임라인의 턴 세기(`llmCalls[]` 와 어시스턴트 메시지 매칭)는 `source === 'live'` 인 사용자 메시지만 세야 백엔드 `turnCount` 와 맞는다.
- 대화 화면(대화 미리보기 탭, 대화 타임라인)은 대화 턴의 1차 출처로 발행 messages 가 아니라 `waiting_for_input.conversationThread.turns` 스냅샷(§4.5)을 쓴다. 보조 관측 레인은 예외다(2026-07-17). 같은 화면이 `nodeOutput.meta.turnDebug[].ragSources` **한정**으로 지식 저장소 검색 표시(🔎 `rag` 행, 📚 참조 칩)를 함께 렌더한다. 턴을 대체하지 않고 더해지는 별개 축이다. 형제 필드 `llmCalls` 는 이 예외에 들지 않는다(디버그 탭 전용). `injected` 표시의 시각 규칙(아이콘, 컨테이너 형식, 칩을 동시에 적용)은 권장이 아니라 필수이며 기준은 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 다. LLM 디버그 패널(요청, 응답, LLM 사용량)만 발행 messages 의 원본 payload 를 쓰고 이때도 "Raw payload" 토글로 표시한다.
- `source` 가 없으면(옛 백엔드, 옛 DB 영속 페이로드 호환) `'live'` 로 본다. 내역 재구성 경로(`parseHistoryMessages`)도 같다.
- **라이브 조기 노출**: 라이브 대화 타임라인은 `execution.user_message` 를 받는 즉시 낙관적 `ai_user` 말풍선을 붙여 사용자 발화를 AI 응답 생성 전에 보이고 뒤의 `execution.ai_message.messages` 권위 스냅샷으로 맞춘다. 이 조기 노출은 **라이브 전용 UX 성질**이다. 내역 화면(`parseHistoryMessages(outputData)`)은 턴이 끝난 뒤 질문과 답이 넣은 순서대로 함께 있어 따로 조기 노출이 없다. 턴이 만들어지는 도중 새로고침하면 노드는 `running` 으로 보이고 낙관적 사용자 말풍선은 되살아나지 않는다(스냅샷·`tool_call_started` 진행 신호가 라이브 전용인 것과 같다).

## 5. 인앱 알림 이벤트 (Server → Client)

구독 채널: `notifications:{userId}`. 이 채널 prefix 는 게이트웨이 `VALID_CHANNEL_PREFIXES` 에 등록돼 구독할 수 있다. `NotificationsService` 가 인앱 알림을 적재한 직후(`notify()`, `createMany`) `WebsocketService.emitNotificationEvent` 로 `notification.new` 를 보낸다(best-effort). 데이터 흐름은 [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) 에 있다.

| 이벤트 | payload | 설명 |
|-------------|---------|------|
| `notification.new` | `{ id, type, title, message, resourceType, resourceId }` | 새 인앱 알림(적재 직후 바로 보낸다) |

## 6. 시스템 이벤트

구독이 필요 없다. 연결 전체에 자동으로 보낸다.

| 이벤트 | payload | 설명 |
|-------------|---------|------|
| `auth.token_expired` | `{ message, expiresAt }` | 토큰 만료 **사전 통지**. 만료 60초 전에 1회 보내고 `exp` 에 서버가 `disconnect()` 한다([WebSocket 연결과 채널 구독](CLE-API-WS.md)). `expiresAt` 은 ISO 8601 문자열이고 **이 소켓이 강제로 끊기는 시각**이다. `_retryState.expiresAt`(마지막 턴 재시도 TTL, §2.4)·`auth.refreshed.expiresAt`(비채택)과 **별개**다. 에러 코드 `TOKEN_EXPIRED` 는 REST·JWT 검증 코드일 뿐 이 이벤트와 다르다 |
| `system.maintenance` _(비채택)_ | `{ message, scheduledAt }` | 예정된 유지보수 알림. **발화 주체가 없다.** 유지보수를 선언하는 관리자 API·설정·스케줄이 없고 계획에도 없다. `scheduledAt` 은 사람이 미래 시점을 선언해야 성립하므로 그 표면을 만드는 것은 새 제품 기능이다. 근거는 [WebSocket 연결과 채널 구독](CLE-API-WS.md) 의 Rationale. 다시 들일 때를 대비해 payload 형태를 남긴다 |
| `error` | `{ message }` | 핸드셰이크·연결 수준 에러. 인증에 실패하면 `handleConnection` 이 `{ message }` 를 보내고 끊는다(`{ code, message }` 형태가 아니라 `message` 하나다) |

## 7. 외부 표면 매핑 (External Interaction API)

[External Interaction API](../CLE-IX/CLE-EIA.md) 는 외부 호출자가 WebSocket 대신 REST·SSE·EIA 알림 웹훅으로 같은 명령과 이벤트를 주고받게 한다. 두 표면의 뜻이 갈리지 않도록 **이 절의 매핑 표가 권위**이고 EIA 쪽 매핑 표는 이 표와 맞아야 한다.

**Client → Server 명령 매핑**

| 내부 WebSocket 명령 | 외부 REST 명령 (`POST /api/external/executions/:id/interact` 의 `body.command`) | 비고 |
|---|---|---|
| `execution.submit_form` | `submit_form` | 본문의 `formData` 가 외부에서는 `data` |
| `execution.click_button` | `click_button` | 같은 페이로드 |
| `execution.submit_message` | `submit_message` | 같은 페이로드 |
| `execution.end_conversation` | `end_conversation` | 같은 페이로드 |
| `execution.retry_last_turn` | 외부 미노출 (앞으로 노출 예정) | 내부 화면 한정. 외부에 노출하려면 토큰 권한, EIA 알림 웹훅 정합, 재시도 횟수 제한을 따로 정해야 한다(§2.4) |
| `execution.stop` _(WebSocket 명령 비채택)_ | `cancel` (또는 별칭 `POST /api/external/executions/:id/cancel`) | WebSocket 명령은 채택하지 않았고 개념(실행 중단)만 매핑한다. 내부·외부 모두 REST 다. `force` 옵션은 외부에서 지원하지 않는다 |
| `execution.start` _(WebSocket 명령 비채택)_ | 외부 미지원 | 내부는 REST `POST /workflows/:id/execute`, 외부는 웹훅 트리거로 실행을 시작한다 |
| `execution.continue` / `execution.step` | 외부 미지원 | 디버깅 전용이고 화면·내부 한정(브레이크포인트 로드맵, 미구현) |
| `auth.refresh` _(in-band 갱신 비채택)_ | 해당 없음 | 외부는 실행 단위 토큰 `iext_*` 전용 갱신 엔드포인트(`/refresh-token`)를 쓴다 |
| `subscribe` / `unsubscribe` | 해당 없음 | 외부는 실행 토큰 자체가 암묵적 구독이다 |

**Server → Client 이벤트 매핑**

| 내부 WebSocket 이벤트 | SSE 이벤트 이름 (`/api/external/executions/:id/stream`) | EIA 알림 웹훅 `type` |
|---|---|---|
| `execution.started` | `execution.started` | 없음 (외부 구독 불가, 잡음) |
| `execution.node.started` | `execution.node.started` | 없음 |
| `execution.node.completed` | `execution.node.completed` | 없음 |
| `execution.node.failed` | `execution.node.failed` | 없음 |
| `execution.node.skipped` | `execution.node.skipped` | 없음 |
| `execution.node.cancelled` | `execution.node.cancelled` | 없음 |
| `execution.paused` _(계획, 미구현)_ | `execution.paused` | 없음 (디버깅 전용) |
| `execution.waiting_for_input` | `execution.waiting_for_input` | `execution.waiting_for_input` |
| `execution.resumed` (일시 신호) | `execution.resumed` | 없음 (일시 신호라 보내지 않는다) |
| `execution.user_message` | `execution.user_message` | 없음 (라이브 조기 노출 신호, `tool_call_*` 와 같은 부류라 보내지 않는다) |
| `execution.ai_message` | `execution.ai_message` | `execution.ai_message` (선택 구독) |
| `execution.message` | `execution.message` | 없음 (허용 목록 밖. 보내지 않는다) |
| `execution.tool_call_started` | `execution.tool_call_started` | 없음 |
| `execution.tool_call_completed` | `execution.tool_call_completed` | 없음 |
| `execution.completed` | `execution.completed` | `execution.completed` |
| `execution.failed` | `execution.failed` | `execution.failed` |
| `execution.cancelled` | `execution.cancelled` | `execution.cancelled` |
| `replay.unavailable` _(native WebSocket 에는 없다. 버퍼 없이 `execution.snapshot` 으로 대신한다)_ | `execution.replay_unavailable` **(구현됨, SSE)** | 없음 |

- `execution.message` 는 엔진이 다른 실행 이벤트와 같은 발행 함수(`emitExecution`)로 보낸다. 현재 구현에서는 내부 WebSocket 채널에도 실리고 SSE 로 나간다.

**핵심 규약**

- **`seq` 를 함께 쓴다.** SSE 의 `id:` 필드와 EIA 알림 웹훅 페이로드의 `seq` 는 WebSocket 이벤트 봉투의 이벤트 순번과 같은 값이다([External Interaction API](../CLE-IX/CLE-EIA.md) 의 R7).
- **5분 버퍼는 SSE 어댑터에 있다.** `seq` 기반 5분 SSE 재전송 버퍼는 SSE 어댑터(`sse-adapter.service.ts`)에 있고 외부 클라이언트의 `Last-Event-Id` 로 그 버퍼에서 `seq > Last-Event-Id` 인 이벤트를 다시 보낸다. native WebSocket 은 버퍼 없이 `execution.snapshot` 으로 대신한다. 두 전송은 같은 `seq` 공간만 공유하고 버퍼는 공유하지 않는다.
- **트랜잭션 커밋 뒤에 발행한다.** 실행 이벤트의 커밋 후 발행 규약은 SSE 와 EIA 알림 웹훅에도 그대로 적용된다([External Interaction API](../CLE-IX/CLE-EIA.md) 의 트랜잭션과 발송 순서).
- **단일 구현 경로**: 외부 표면은 내부 WebSocket 의 명령·이벤트 처리 경로를 facade 로 감싼 형태로만 구현한다. 두 표면이 갈라지면 유지 부담이 생긴다([External Interaction API](../CLE-IX/CLE-EIA.md) 의 R5).
- 외부 WebSocket 채널 신설은 v1 에서 보류했다. 보류 사유와 다시 논의할 조건은 [External Interaction API](../CLE-IX/CLE-EIA.md) 의 R5 에 있다.

## 구현 위치

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` (`ExecutionEventType`, `NodeEventType`, `BackgroundRunEventType`, `KbEventType`, `InAppNotificationEventType`)
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` (명령 핸들러 여덟 개)
- `codebase/backend/src/modules/websocket/websocket.service.ts` (`emitExecutionEvent`, `emitNodeEvent`, `toFanoutEnvelope`)
- `codebase/backend/src/shared/utils/strip-external-only-fields.ts`
- `codebase/backend/src/shared/utils/redact-stored-error.ts`
- `codebase/backend/src/modules/executions/executions.service.ts` (`findById`, 스냅샷 페이로드)
- `codebase/backend/src/modules/external-interaction/sse-adapter.service.ts` (SSE 매핑, 재전송 버퍼)
- `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` (재개 명령 발신, `emitWithAck`)

## Rationale

### `buttonConfig` 예시 정정: 타임아웃 제거와 `nodeOutput` 판별자 폐지 (2026-06-03, C2·C3)

초기 §4 `buttonConfig` 예시는 `timeout: 300`·`timeoutAction: "cancel"` 과 `nodeOutput: { "type": "carousel", ... }` 를 담았다. 둘 다 다른 기준과 모순되는 낡은 예시였다.

- **C2 타임아웃 제거**: [Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) 은 버튼 클릭까지 "외부 취소·종료 외에는 제한 없이 대기" 를 정하고 엔진(`waitForButtonInteraction`)도 타이머 없이 무한 대기한다(`timeoutAction` 은 코드에 없다). 예시의 두 필드만 낡았으므로 지웠다. 기각한 대안: 공통 규약에 타임아웃 정책을 정식으로 들이기. 현 구현과 다른 문서가 모두 무제한 대기라 기각했다.
- **C3 `nodeOutput` 판별자 폐지**: 노드 출력 규약의 `type` 판별자 래퍼 금지에 따라 엔진은 `buttonConfig.nodeOutput` 으로 노드 출력(`{ config, output, meta?, port?, status }`)을 그대로 싣는다(`nodeOutputForEvent = structured ?? flatNodeOutput`). 노드 종류는 상위 `payload.nodeType` 으로 이미 식별되므로 `nodeOutput` 안의 `type` 판별자는 불필요하고 중복이다. 예시를 실제 다섯 필드 구조로 바꿨다. 기각한 대안: `nodeOutput` 전용 스키마를 따로 적기. 판별자 래퍼 금지와 충돌해 기각했다.
- 2026-08-24 에 `nodeOutput.nodeType` 을 "렌더 서브타입이라 별개" 로 적은 초판 각주가 C3 를 다시 해석해 되살리는 모양이 됐다(`16_41_05` rationale CRITICAL). 그런 구분은 코드에 없어 §4 의 층별 사실 표로 바로잡았다. 외부 클라이언트에 `waitingNodeType` 을 권한 초판 문구도 EIA 정책과 충돌해(`17_04_25` cross_spec) 소비자별로 갈라 적었다.

### 입력 대기 wire 필드: 예시를 다시 쓰지 않고 주의 문구와 소유 분리로 (2026-07-14)

§4 JSON 예시(`nodeId`, 최상위 `formConfig`·`conversationConfig`)는 논리 구조 표기인데 실제 fanout wire 는 `waitingNodeId` 와 `nodeOutput` 중첩이라 어긋나 있었다. JSON 전체를 실제 wire 로 바꾸지 않고(가독성 저하, 두 문서 불일치) 머리에 wire 필드 주의 문구를 두었다. 메시지 형식 절과 EIA 쪽이 이미 쓰던 방식이다. 전체 매핑을 세 문서에 복제하지 않도록 외부 소비 매핑은 EIA 쪽에, WebSocket 내부 부가 식별자는 §4 에 두었다. EIA 쪽 서술은 외부 소비 필드만 다루도록 범위를 좁혔으므로 "전체 기준" 으로 올리지 않았다.

2026-08-13 갱신: 채널별 봉투의 일반 규칙은 [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) 으로 올라갔고 입력 대기 쪽에는 필드 이름 매핑만 남았다. 종결 셋은 WebSocket 전용 부가 필드가 없어 나눌 것이 없으므로 단일 기준으로 모였다. 같은 규칙이 입력에 따라 다른 결론을 낸 것이지 번복이 아니다.

### 메시지 출처 표시 `messages[].source` 도입

`contextScope` 가 켜진 AI 에이전트는 턴마다 `[system, ...injectedThread, ...selfHistory]` 로 messages 를 다시 만들고 주입된 앞 노드의 항목도 payload 의 `messages` 스냅샷에 들어간다. 프론트엔드가 사용자 메시지 수로 턴 번호를 정하면 백엔드 권위 `turnCount` 와 어긋나 `llmCalls[]` 와 어시스턴트 메시지를 맞출 수 없고 응답·요청·LLM 사용량 탭이 비는 회귀가 났다. 그래서 `source: 'live' | 'injected'` 표시를 붙이고 소비 쪽이 `live` 만 센다. 출처가 늘어도 enum 값만 더하면 된다. 기각한 대안: `injectedContextLength` 만 싣는 안은 주입이 앞에 연속으로 붙는다는 가정이 필요해 중간 주입이나 여러 스레드 병합([대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 의 v2 로드맵)에서 깨진다. 어시스턴트 메시지에 `turnIndex` 를 싣는 안은 사용자 메시지의 턴 매핑을 풀지 못한다.

**영속 정책(미정)**: 이 표시는 전송 층 정의에 한정한다. `NodeExecution.outputData.messages` 영속 형태에 `source` 를 넣을지는 정하지 않았고 넣지 않아도 "없으면 `live`" 폴백으로 내역 재구성이 안전하다. 대화 스레드는 이미 durable 컬럼(`Execution.conversation_thread`, V084)에 영속된다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)). 그 컬럼이나 노드 출력 영속 형태가 이 표시를 담을지는 따로 정해야 한다.

### 지식 저장소 채널을 문서 단위로 바꾼 이유 (`embedding:{knowledgeBaseId}` → `kb:{documentId}`)

지식 저장소 임베딩 진행 상태는 **문서 단위 채널**로 보낸다(`WebsocketService.emitKbEvent`, union 정의는 `KbEventType`, `kb:${documentId}` 채널). 프론트엔드 `useKbEvents` 도 문서별로 구독한다.

- 문서별로 진행 상태를 따로 추적할 수 있어 진행 표시가 문서마다 갱신된다.
- 권한 검증을 문서 소유 지식 저장소 단위로 나누기 쉽다.
- 프론트엔드가 가진 문서 ID 만큼만 구독하므로 무관한 지식 저장소 이벤트의 잡음을 막는다.

이벤트 표기는 콜론과 밑줄(`document:embedding_started`)을 쓴다. 백엔드 타입 union 형식과 맞춘 것이다.

### `ai_form_render` 의 `formConfig` 위치를 하나로 모은 이유

`formConfig` 최상위 필드는 그래프 Form 노드(`interactionType: 'form'`)의 폼 설정을 싣는 자리다. AI 에이전트 멀티턴의 `render_form` 블로킹 흐름에서는 `interactionType: 'ai_form_render'` 의 폼 페이로드를 `conversationConfig.pendingFormToolCall.formConfig` 에 중첩한다(`execution-engine.service.ts` 발행, 프론트엔드도 같은 위치에서 읽는다). 화면이 폼 출처를 한 위치에서 읽게 하려는 것이고 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 의 store 변환 표와 맞는다. `pendingFormToolCall.formConfig` 로 중첩하면 `toolCallId` 와 함께 하나의 원자 단위로 운반돼 뜻이 분명하다. 근거는 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 의 `render_form` 타임라인 인라인 표현 절이다.

### `user_message` 낙관적 말풍선의 도장 맞춤 분기

`user_message` 는 `receivedAt` 을 dedup 키로 쓴다(§4.4). 그런데 클라이언트가 **직접** 발화하는 경로에서는 보내는 즉시 로컬 낙관적 `ai_user` 말풍선을 먼저 띄우는데 그 말풍선의 시각은 클라이언트 시각이고 뒤이어 오는 `user_message` 의 dedup 키는 서버 `receivedAt` 이라 서로 다르다. 그래서 `receivedAt` dedup 만으로는 로컬 말풍선을 잡지 못해 같은 발화가 두 말풍선으로 겹쳐 보이는 회귀가 났다.

- **결정**: 되돌아온 이벤트가 같은 발화의 기존 낙관적 말풍선을 찾으면 새 항목을 붙이지 않고 기존 말풍선에 `receivedAt` 을 **찍어** 맞춘다. 로컬 말풍선이 없는 경로(채널 텍스트 인바운드 등)에서만 붙인다.
- **근거**: 보낸 사람의 즉시 피드백(로컬 낙관)과 WebSocket 되돌림 유실 내성을 지키면서 중복만 없앤다. 찍은 뒤 `receivedAt` 은 재발행·재구독 dedup 키로 계속 쓰이고 최종 정합은 턴 종료 `ai_message` 스냅샷 교체가 보장한다(도장은 그 앞의 보조 단계다). 프론트엔드 구현 식별자는 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 방침에 따라 여기 적지 않는다.

### 마지막 턴 재시도의 그래프 진행: 재실행과의 경계

"노드 단위 재시도" 라는 표현 때문에 "다음 노드도 일부러 막는다" 로 읽힐 여지가 있었다. 뜻하는 것은 워크플로우 [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) 과의 단위 구분(실행 단위와 노드 단위)이지 다음 노드 진행 차단이 아니다. 다시 들어간 턴이 성공한 뒤의 그래프 진행은 일반 노드 `COMPLETED` 와 같은 엔진 기본 불변식이고 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 가 같은 결정 근거를 함께 쓴다.

### 요소별 절대 발생 시각·소요 시간을 싣는 이유 (`startedAt`·`finishedAt`, 2026-06-03)

어시스턴트 LLM 응답과 도구 실행에는 시각 데이터가 없어(`durationMs` 만 있었다) 멀티턴 AI 노드 안 요소의 절대 발생 시각을 보일 수 없었다. `llmCalls[]` 와 `toolCalls[]` 에 `startedAt`·`finishedAt`(ISO8601)을 더해 라이브 이벤트와 `meta.turnDebug[]` 영속 양쪽에 싣는다. 엔진이 소요 시간을 재려고 이미 시작 시각을 잡고 있어 싣기만 하면 된다. DB 마이그레이션이 필요 없고(JSONB 안), 하위 호환 선택 필드이며 라이브와 영속이 같은 출처라 두 화면이 같은 시각을 보인다. 소요 시간만으로는 "언제" 를 되살릴 수 없다. **기각한 대안**: 노드 시작 시각에 누적 소요 시간을 더해 추정하는 안은 공백을 반영하지 못해 부정확하고 라이브 전용 클라이언트 도장 안은 실행 내역 화면에서 시각이 사라진다.

### `submit_form`·`click_button` payload 와 ack 를 구현에 맞춘 이유 (2026-06-10)

- `submit_form` 을 `{ executionId, formData }`, `click_button` 을 `{ executionId, buttonId }` 로 고쳤다. 프론트엔드는 두 명령에 `nodeId` 를 싣지 않고 대기 노드는 서버가 조회한다. 이후 `click_button` 은 `nodeId?` 를 선택으로 받아 대조하도록 넓혔다(프론트엔드가 보내지 않아 실제로는 쓰이지 않는다). `submit_message`·`end_conversation` 의 `nodeId` 는 조회 키가 아니라 사후 검증 입력이다.
- 옛 클라이언트 `toolCallId?` 필드를 지웠다. `render_form` 응답은 서버가 보관한 `pendingFormToolCall` 로 맞춘다. 공통 ack 표에서 `nodeId` 행도 지웠다.
- **폼 제출 ack 이름 `execution.form_submitted`**: 다른 명령의 `<명령>.ack` 패턴과 다르다. 도입 초기 이름이 백엔드 반환과 프론트엔드 수신 양쪽에 굳은 역사적 이름이다. 이미 합의한 wire 계약이라 이름을 바꾸면 호환만 깨져 구현 현실을 옮겼다(v2 프로토콜 정리 때 다시 검토한다).

### ack 의 `resumed` 뜻을 "재개 성공" 에서 "재개 수락" 으로 바꾼 이유 (2026-06-10)

옛 공통 ack 표는 `resumed` 를 "재개 성공 여부" 로 적었다. 모든 진입점이 늘 BullMQ 에 넣는 모델([시스템 아키텍처](../CLE-PLAT/CLE-PLAT-ARCH.md))을 채택한 뒤 네 재개 핸들러는 큐에 넣으면 바로 `resumed: true` 를 돌려준다. 이 시점에는 어느 워커의 rehydration 도 일어나지 않아 동기 ack 로 재개 성공을 판정할 수 없다. 그래서 정의를 "재개 시작 수락(enqueue)" 으로 바꾸고 최종 확인은 뒤따르는 이벤트로 모았다. **기각한 대안**: 게이트웨이가 워커 처리를 동기로 기다리는 안. ack 지연을 워커에 묶어 큐를 들인 취지와 충돌한다. 코드는 바뀌지 않았다. 프론트엔드 `emitWithAck` 는 `success === false` 만 쓰고 `resumed` 로 상태를 바꾸지 않는다.

### WebSocket 이벤트 enum 이름은 `<도메인>EventType` (2026-08-30)

`websocket-events.types.ts` 의 이벤트 enum 은 **도메인을 접두로** 붙인다. `ExecutionEventType`, `NodeEventType`, `BackgroundRunEventType`, `KbEventType`, `InAppNotificationEventType` 이다. 도메인 없는 일반 이름(`NotificationEventType` 등)은 **다른 영역의 같은 이름 타입과 부딪히므로** 쓰지 않는다.

실제로 부딪혔다. `notification-config.dto.ts` 의 `NotificationEventType`(EIA 알림 웹훅 구독 허용 목록, `execution.*` 다섯 값)과 WebSocket 인앱 알림 벨 enum 이 같은 이름이었고 `#1238` 에서 뒤의 것을 `InAppNotificationEventType` 으로 바꿔 풀었다. 그때까지는 구분용 JSDoc 으로만 막았는데 주석은 잘못된 import 를 막지 못한다. 자동 완성이 두 심볼을 같은 이름으로 보이면 잘못 고른 쪽도 컴파일된다.

WebSocket 쪽 이름을 바꾼 근거: 반대쪽은 [External Interaction API](../CLE-IX/CLE-EIA.md) 의 EIA-NX-02 외부 계약(구독 허용 목록)에 붙어 있고 이 모듈의 자매 enum 이 이미 위 규칙을 따르므로 도메인 접두는 그 규칙 안이다.

규약 문서로 따로 올리지 않은 이유: 이 규칙의 적용 범위가 **WebSocket 이벤트 enum 한 모듈**이다. 규약 문서는 여러 영역이 참조하는 규약의 자리이고 한 파일에만 걸리는 규칙을 올리면 저장소가 네 PR 을 들여 걷어낸 미러를 문서 층에 되살린다([응답 자격 증명 마스킹](CLE-API-EGRESS.md) 의 좌표계 문서를 둘 때 "새로 두는 것이 자동으로 옳지 않다" 는 같은 판단을 적었다). 적용 범위가 넓어지면 그때 올린다. 코드 쪽 근거는 `InAppNotificationEventType` JSDoc 이다. 같은 규칙이 두 곳에 있으므로 서로 가리켜 어긋남을 잡는다.
