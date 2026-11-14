---
id: "CLE-API-WS-EVENTS"
title: "WebSocket 이벤트와 명령"
type: "design"
version: 6
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API"
ancestors: ["CLE-VISION", "CLE-API"]
area: "CLE-API"
content_hash: "5594187cc44267a207164252e8074fa1f31146e4200abc9ee09b5689fa0bdecd"
read_as: "approved_fallback"
task: "CLE-T-GA8ZXQ"
source_paths: ["spec/5-system/6-websocket-protocol.md"]
mirror_sha256: "d1376d006a38321ff38ee03e4f2b6e51075ed51cfbfc63d015ae3dcfaca8b620"
etag: "sha256-95124e623afa536759c7e40f9f25bfe16cd9a37757ea9fd7a2fb7106f5d0a24f"
---
> 구현 상태: 구현됨 (브레이크포인트 관련 이벤트·명령은 미구현, 실행 시작·중단 명령은 비채택) · 원문: `spec/5-system/6-websocket-protocol.md` (§4, Rationale 일부) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 WebSocket 위를 오가는 실행 이벤트(execution events, `execution.*`)와 클라이언트 명령의 목록, 각 페이로드, 명령 ack 형태, 그리고 같은 이벤트·명령이 외부 External Interaction API(EIA) 표면에서 어떻게 보이는지의 매핑 표를 정한다. 실행 이벤트 외에 지식 저장소 문서 이벤트, 인앱 알림 이벤트, 시스템 이벤트, Background 본문 실행 이벤트도 다룬다.

**같은 실행을 두 표면이 보고한다.** 내부 WebSocket 과 외부 EIA 의 REST·SSE·EIA 알림 웹훅이다. §7 매핑 표가 두 표면의 명령·이벤트 매핑의 권위다. 외부 표면은 내부 WebSocket 경로를 facade 로 감싼 **단일 구현 경로**여야 하므로 이벤트나 명령의 형태를 고칠 때 한 표면만 보고 고치면 두 표면의 뜻이 갈린다. 다만 같은 페이로드를 보내지는 않는다. §7 표는 **선택적** 매핑이다. 명령 표는 "외부 미노출", "외부 미지원", "해당 없음" 으로 갈리고 이벤트 표의 EIA 알림 웹훅 열은 대부분 `—` 다. 디버그 필드(`llmCalls`, `requestPayload`, `responsePayload`)는 외부 수신자에게서 빠진다. 이 비대칭은 누락이 아니라 보안을 위한 결정이므로 두 표면을 맞추려고 지우지 않는다.

이 문서가 정하지 않는 것은 아래 문서가 정한다.

- 연결·인증·구독 채널·이벤트 봉투(`seq`, `timestamp`)·재연결·전송 계층 에러: [WebSocket 연결과 채널 구독](CLE-API-WS.md)
- 실행·노드 실행 상태 전이와 블로킹·재개 계약, 마지막 턴 재시도의 상태 전이: [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md)
- 재개 명령의 발행 쪽 사전 검증과 ack 에러 표면: [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md)
- 종결 이벤트 셋(`completed`, `failed`, `cancelled`)의 필드 집합과 행동 계약, 채널별 봉투: [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md)
- 외부 SSE 스트림, EIA REST 명령, 입력 대기 이벤트의 외부 소비 필드 매핑: [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md)
- 이벤트 페이로드의 자격 증명 마스킹과 외부 `nodeOutput` 허용 목록: [응답 자격 증명 마스킹](CLE-API-EGRESS.md)
- 에러 코드 카탈로그: [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md)
- 대화 스레드 자료구조: [대화 스레드](../CLE-IX/CLE-IX-THREAD.md). 화면이 이벤트를 store 로 바꾸는 규칙: [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md)

JSON 예시의 `{ "type", "id", "payload" }` 는 논리 구조 표기다. 실제 wire 는 이벤트 이름이 Socket.IO 이벤트 이름이고 서버 이벤트 페이로드는 평면 봉투다. 예시의 `id` 도 논리 표기라 wire 에 실리지 않는다([WebSocket 연결과 채널 구독 「기본 프레임 (논리 구조)」](CLE-API-WS.md#31-기본-프레임-논리-구조)).

## 하위 문서

이 문서는 실행 이벤트 목록(§1)과 외부 표면 매핑(§7)을 직접 정하고 나머지는 아래 하위 문서가 정한다. 이 문서에는 요구사항 줄이 없어 하위 문서가 맡는 요구사항 번호도 없다. 하위 문서로 옮긴 절 가운데 다른 문서가 앵커로 링크하는 절(§2.3, §2.4, Rationale 의 C2·C3 절과 `submit_form`·`click_button` 절)과 그 상위 §2 만 같은 제목에 링크 한 줄을 남겨 들어오는 링크가 끊기지 않게 했다.

- [WebSocket 이벤트와 명령 — 실행 제어 명령과 ack](CLE-API-WS-EVENTS-COMMANDS.md): 클라이언트 명령 목록, ack 이벤트 형태, 재개 명령 ack 공통 필드와 에러, 마지막 턴 재시도(`execution.retry_last_turn`).
- [WebSocket 이벤트와 명령 — 입력 대기 이벤트](CLE-API-WS-EVENTS-WAITING.md): `execution.waiting_for_input` 의 대기 표면별 payload, wire 필드 주의, `nodeOutput.nodeType` 층별 사실, 대화 스레드 스냅샷.
- [WebSocket 이벤트와 명령 — AI 대화 턴 이벤트](CLE-API-WS-EVENTS-AITURN.md): `execution.ai_message`, `execution.user_message`, 도구 호출 이벤트, 라이브 신호의 맞춤, `messages[].source` 표시.
- [WebSocket 이벤트와 명령 — 채널별 부가 이벤트](CLE-API-WS-EVENTS-CHANNELS.md): 지식 저장소 문서 이벤트, 인앱 알림 이벤트, 시스템 이벤트, Background 본문 실행 이벤트.

## 1. 실행 이벤트 (Server → Client)

구독 채널: `execution:{executionId}`

| 이벤트 | payload | 설명 |
|-------------|---------|------|
| `execution.started` | `{ executionId, workflowId, mode, startedAt }` | 실행 시작 |
| `execution.completed` | `{ executionId, …필드 집합, seq, timestamp }` | 실행 완료. 필드 집합은 아래 |
| `execution.failed` | `{ executionId, …필드 집합, seq, timestamp }` | 실행 실패 |
| `execution.cancelled` | `{ executionId, …필드 집합, seq, timestamp }` | 실행 취소 |
| `execution.resumed` | `{ executionId, status, seq, timestamp }` | 입력 대기에서 재개됨. 재개 명령 ack 이후 실제 재개를 알리는 후행 이벤트다([재개 명령 ack 의 공통 필드](CLE-API-WS-EVENTS-COMMANDS.md#22-재개-명령-ack-의-공통-필드)). 현재 구현은 폼·버튼·AI 재개 경로가 `{ status: 'running' }` 을 싣는다 |
| `execution.snapshot` | `{ executionId, execution, timestamp }` | 다시 구독할 때 보내는 1회성 현재 상태(실행 스냅샷 이벤트). `execution` 은 실행 상세 응답(`GET /api/executions/:id`)과 같은 객체이고(필드는 [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md) 의 API 절) 그 안에 `status`·`nodeExecutions[]` 등이 중첩된다. 최상위에 `status`·`nodeExecutions` 가 평면으로 있는 것이 아니라 `payload.execution.*` 다. 발행 시점은 [WebSocket 연결과 채널 구독](CLE-API-WS.md) 의 놓친 이벤트 복구. 중첩된 `execution.error` 와 `execution.nodeExecutions[].error` 는 `findById` 의 마스킹 관문을 이어받는다 |
| `execution.paused` _(계획, 미구현)_ | `{ executionId, nodeId, nodeName, reason }` | 브레이크포인트에서 일시 정지. 기능은 [에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md) 의 브레이크포인트 로드맵 소관이다. 구현할 때 `nodeLabel` 로 맞춘다 |
| `execution.node.started` | `{ executionId, nodeId, nodeExecutionId, nodeLabel, nodeType }` | 노드 실행 시작. `nodeExecutionId` 는 노드 실행(`NodeExecution`) 행의 PK 로, 컨테이너 본문 노드의 회차별 타임라인 행을 가르는 식별자다 |
| `execution.node.completed` | `{ executionId, nodeId, nodeExecutionId, nodeLabel, output, duration }` | 노드 실행 완료. wire 의 `output` 은 `NodeExecution.outputData` 전체, 즉 노드 출력(`NodeHandlerOutput`) 래퍼다. 도메인 값은 한 겹 아래 `output.output` 이고 노드 출력 규약의 `output.error` 는 wire 에서 **`output.output.error`** 다(예: AI 에이전트 멀티턴의 `port: 'error'` 종결). `details.retryable`·`retryAfterSec` 표준 필드는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이 정한다. fanout(외부)에서는 이 래퍼에 fail-closed 허용 목록이 걸린다 |
| `execution.node.failed` | `{ executionId, nodeId, nodeExecutionId, nodeLabel, error, output? }` | 노드 실행 실패. `error` 는 **문자열**(메시지만)이다. `output` 은 발행 경로에 따라 실린다(§1.2) |
| `execution.node.skipped` | `{ executionId, nodeId, nodeExecutionId, nodeLabel, reason }` | 노드 건너뜀 |
| `execution.node.cancelled` | `{ executionId, nodeId, nodeExecutionId, nodeLabel, error? }` | 노드 실행 중단. `NodeExecution.status = cancelled`([실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md), [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)). `error` 는 **선택**이다. 신호 경로(핸들러 `AbortError`)는 `{ code: 'AbortError', message }` 를 싣지만 DB 관측 가드 경로는 싣지 않는다(내부 메시지에 executionId 등이 있을 수 있어 클라이언트 노출을 막는다). 소비자는 `error` 부재를 방어적으로 다룬다. `failed` 와 별도 이벤트라 타임라인이 취소를 실패와 구분하고 `running` 에 남지 않는다. 생산자: Parallel `cancel-others-on-fail`, 사용자 취소, 엔진 DB 관측 가드(노드 경계, AI 턴 경계, park 짝 전이) |
| `execution.waiting_for_input` | `{ executionId, nodeId, nodeExecutionId, nodeType, interactionType, formConfig?, buttonConfig?, conversationConfig?, conversationThread? }` | Form 노드, 버튼이 설정된 Presentation 노드, AI 에이전트 멀티턴 노드의 입력 대기. 재개 뒤 `execution.node.completed` 도 같은 `nodeExecutionId` 로 나가 타임라인의 같은 행이 갱신된다. 상세는 [입력 대기 이벤트](CLE-API-WS-EVENTS-WAITING.md) |
| `execution.ai_message` | `{ executionId, nodeId, message, turnCount, messages, metadata?, llmCalls?, durationMs?, presentations? }` | AI 에이전트 멀티턴의 AI 응답. `messages` 는 system 을 뺀 user·assistant·tool 메시지의 권위 스냅샷이고 항목마다 `source` 표시가 있다. 상세는 [AI 대화 턴 이벤트](CLE-API-WS-EVENTS-AITURN.md) |
| `execution.tool_call_started` | `{ executionId, nodeId, turnIndex, toolCallId, name, arguments }` | AI 에이전트가 도구 프로바이더의 도구(지식 저장소, MCP 등)를 실행하기 시작함. 디버깅 타임라인이 턴이 끝나기 전에 대기 중인 도구 항목을 바로 보일 수 있게 보낸다 |
| `execution.tool_call_completed` | `{ executionId, nodeId, turnIndex, toolCallId, content, status, error?, durationMs }` | 도구 실행이 끝남. `status` 는 `'success' \| 'error'`. 프로바이더가 throw 하면 핸들러가 잡아 `status: 'error'` 와 `error` 를 채우고 LLM 에는 에러 content 를 그대로 넘겨 다음 턴에 회복할 기회를 준다 |
| `execution.message` | `{ executionId, nodeId, nodeType, presentations: [{ config, output }], seq?, timestamp? }` | 표시 메시지 이벤트. 표시 전용 Presentation 노드(`carousel`·`table`·`chart`·`template`)가 **버튼 없이 자동 진행**으로 끝날 때 보낸다. `presentations[i]` 는 위젯 `classifyPresentation` 입력인 `{config, output}` 이다. 모든 비차단 노드의 `execution.node.completed` 와 구분하며 EIA SSE 표면(웹채팅 위젯)은 비차단 Presentation 렌더를 이 이벤트에서만 받는다. EIA 알림 웹훅 허용 목록에는 없다. 정의 기준은 [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md), [External Interaction API](../CLE-IX/CLE-EIA.md) 의 R18 |
| `execution.user_message` | `{ executionId, nodeId, nodeExecutionId, message, receivedAt }` | AI 에이전트 멀티턴에서 사용자 발화를 받는 즉시(다음 턴 LLM 호출 전) 라이브로 보이는 비권위 진행 신호. 권위는 턴 종료 `execution.ai_message.messages` 스냅샷이다. `submit_message` 와 채널 텍스트 인바운드가 `message_received` 로 재개할 때만 보내고 폼 제출에는 보내지 않는다. 상세는 [AI 대화 턴 이벤트](CLE-API-WS-EVENTS-AITURN.md) |

- **노드 이벤트의 이름 필드는 `nodeLabel` 이다.** 엔진 발행은 모두 `nodeLabel: node.label ?? node.type` 이고 `nodeName` 발행은 0건이다. 미구현 `execution.paused` 행만 옛 표기다.
- **현재 구현은 노드 이벤트 다섯 가지 모두에 `nodeType` 과 `parentNodeExecutionId` 를 싣는다.** 원문 표는 `nodeType` 을 `started` 에만 적고 `parentNodeExecutionId` 는 적지 않는다. `parentNodeExecutionId` 는 노드가 인라인 [서브 워크플로우](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md)나 [Background](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) 본문 안에서 돌 때 호출 노드의 노드 실행 ID 이고 최상위 노드에서는 빠진다. 에디터는 이 값으로 타임라인 행을 호출 노드 아래에 묶는다. `status`·`input`·`startedAt`(종결 이벤트는 `finishedAt` 도)도 함께 실린다. `skipped` 의 `reason` 은 싣지 않는다. 에러 정책 `skip` 경로는 `error`(메시지 문자열)를 싣고 비활성 노드 경로는 둘 다 없다.
- **발행 시점에 자격 증명 값 패턴을 가린다.** 대상은 특정 필드가 아니라 payload 전체이고 내부 WebSocket wire 와 외부 fanout 양쪽이다. 예외는 `llmCalls` 하나다. `input`(노드 이벤트)과 REST `inputData` 는 같은 store 슬롯에 들어가므로 함께 가린다. 설정 에코에 자격 증명 패턴이 박혀 있으면 원본 echo 계약보다 마스킹이 우선한다. 범위·근거·잔여 갭은 [응답 자격 증명 마스킹](CLE-API-EGRESS.md) 이 정한다.
- **`execution.snapshot` 과 `execution.node.*` 의 마스킹 경로가 다르다.** 스냅샷은 `findById` 의 읽기 관문을 거치고 같은 소켓의 `execution.node.*` 발행은 그 관문을 거치지 않는 대신 발행 시점 값 마스킹을 받는다.

### 1.1 종결 이벤트의 필드 집합

종결 셋(`execution.completed`, `execution.failed`, `execution.cancelled`)의 필드와 행동 계약(`cancelledBy` 닫힌 union, `error.code` 매핑, 사용자 취소의 `error` 부재)은 [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) 이 기준이다. 두 곳에 적으면 어긋나므로 여기에 필드를 다시 나열하지 않는다.

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

→ [WebSocket 이벤트와 명령 — 실행 제어 명령과 ack](CLE-API-WS-EVENTS-COMMANDS.md#2-실행-제어-명령-client--server)

### 2.3 재개 명령의 에러

→ [WebSocket 이벤트와 명령 — 실행 제어 명령과 ack](CLE-API-WS-EVENTS-COMMANDS.md#23-재개-명령의-에러)

### 2.4 마지막 턴 재시도 (`execution.retry_last_turn`)

→ [WebSocket 이벤트와 명령 — 실행 제어 명령과 ack](CLE-API-WS-EVENTS-COMMANDS.md#24-마지막-턴-재시도-executionretry_last_turn)

## 7. 외부 표면 매핑 (External Interaction API)

[External Interaction API](../CLE-IX/CLE-EIA.md) 는 외부 호출자가 WebSocket 대신 REST·SSE·EIA 알림 웹훅으로 같은 명령과 이벤트를 주고받게 한다. 두 표면의 뜻이 갈리지 않도록 **이 절의 매핑 표가 권위**이고 EIA 쪽 매핑 표는 이 표와 맞아야 한다.

**Client → Server 명령 매핑**

| 내부 WebSocket 명령 | 외부 REST 명령 (`POST /api/external/executions/:id/interact` 의 `body.command`) | 비고 |
|---|---|---|
| `execution.submit_form` | `submit_form` | 본문의 `formData` 가 외부에서는 `data` |
| `execution.click_button` | `click_button` | 같은 페이로드 |
| `execution.submit_message` | `submit_message` | 같은 페이로드 |
| `execution.end_conversation` | `end_conversation` | 같은 페이로드 |
| `execution.retry_last_turn` | 외부 미노출 (앞으로 노출 예정) | 내부 화면 한정. 외부에 노출하려면 토큰 권한, EIA 알림 웹훅 정합, 재시도 횟수 제한을 따로 정해야 한다([마지막 턴 재시도](CLE-API-WS-EVENTS-COMMANDS.md#24-마지막-턴-재시도-executionretry_last_turn)) |
| `execution.stop` _(WebSocket 명령 비채택)_ | `cancel` (또는 별칭 `POST /api/external/executions/:id/cancel`) | WebSocket 명령은 채택하지 않았고 개념(실행 중단)만 매핑한다. 내부·외부 모두 REST 다. `force` 옵션은 외부에서 지원하지 않는다 |
| `execution.start` _(WebSocket 명령 비채택)_ | 외부 미지원 | 내부는 REST `POST /api/workflows/:id/execute`, 외부는 웹훅 트리거로 실행을 시작한다 |
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
- **5분 버퍼는 SSE 쪽에 있다.** `seq` 기반 5분 SSE 재전송 버퍼는 Redis Stream 이다(`sse-fanout.service.ts`). SSE 어댑터(`sse-adapter.service.ts`)가 외부 클라이언트의 `Last-Event-Id` 로 그 버퍼에서 `seq > Last-Event-Id` 인 이벤트를 다시 보낸다. 버퍼의 키와 수명은 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 이 정한다. native WebSocket 은 버퍼 없이 `execution.snapshot` 으로 대신한다. 두 전송은 같은 `seq` 공간만 공유하고 버퍼는 공유하지 않는다.
- **트랜잭션 커밋 뒤에 발행한다.** 실행 이벤트의 커밋 후 발행 규약은 SSE 와 EIA 알림 웹훅에도 그대로 적용된다([External Interaction API](../CLE-IX/CLE-EIA.md) 의 트랜잭션과 발송 순서).
- **단일 구현 경로**: 외부 표면은 내부 WebSocket 의 명령·이벤트 처리 경로를 facade 로 감싼 형태로만 구현한다. 두 표면이 갈라지면 유지 부담이 생긴다([External Interaction API](../CLE-IX/CLE-EIA.md) 의 R5).
- 외부 WebSocket 채널 신설은 v1 에서 보류했다. 보류 사유와 다시 논의할 조건은 [External Interaction API](../CLE-IX/CLE-EIA.md) 의 R5 에 있다.

## 구현 위치

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` (`ExecutionEventType`, `NodeEventType`, `BackgroundRunEventType`, `KbEventType`, `InAppNotificationEventType`)
- `codebase/backend/src/modules/websocket/websocket.service.ts` (`emitExecutionEvent`, `emitNodeEvent`, `toFanoutEnvelope`, `emitBackgroundRunEvent`, `maskWireEnvelope`)
- `codebase/backend/src/shared/utils/strip-external-only-fields.ts`
- `codebase/backend/src/shared/utils/redact-stored-error.ts`
- `codebase/backend/src/modules/executions/executions.service.ts` (`findById`, 스냅샷 페이로드)
- `codebase/backend/src/modules/external-interaction/sse-adapter.service.ts` (SSE 매핑, 재전송 판정)
- `codebase/backend/src/modules/external-interaction/sse-fanout.service.ts` (재전송 버퍼 Redis Stream, 인스턴스 사이 전달)

## Rationale

### WebSocket 이벤트 enum 이름은 `<도메인>EventType` (2026-08-30)

`websocket-events.types.ts` 의 이벤트 enum 은 **도메인을 접두로** 붙인다. `ExecutionEventType`, `NodeEventType`, `BackgroundRunEventType`, `KbEventType`, `InAppNotificationEventType` 이다. 도메인 없는 일반 이름(`NotificationEventType` 등)은 **다른 영역의 같은 이름 타입과 부딪히므로** 쓰지 않는다.

실제로 부딪혔다. `notification-config.dto.ts` 의 `NotificationEventType`(EIA 알림 웹훅 구독 허용 목록, `execution.*` 다섯 값)과 WebSocket 인앱 알림 벨 enum 이 같은 이름이었고 뒤의 것을 `InAppNotificationEventType` 으로 바꿔 풀었다. 그때까지는 구분용 JSDoc 으로만 막았는데 주석은 잘못된 import 를 막지 못한다. 자동 완성이 두 심볼을 같은 이름으로 보이면 잘못 고른 쪽도 컴파일된다.

WebSocket 쪽 이름을 바꾼 근거: 반대쪽은 [External Interaction API](../CLE-IX/CLE-EIA.md) 의 EIA-NX-02 외부 계약(구독 허용 목록)에 붙어 있고 이 모듈의 자매 enum 이 이미 위 규칙을 따르므로 도메인 접두는 그 규칙 안이다.

규약 문서로 따로 올리지 않은 이유: 이 규칙의 적용 범위가 **WebSocket 이벤트 enum 한 모듈**이다. 규약 문서는 여러 영역이 참조하는 규약의 자리이고 한 파일에만 걸리는 규칙을 올리면 저장소가 네 PR 을 들여 걷어낸 미러를 문서 층에 되살린다([응답 자격 증명 마스킹](CLE-API-EGRESS.md) 의 좌표계 문서를 둘 때 "새로 두는 것이 자동으로 옳지 않다" 는 같은 판단을 적었다). 적용 범위가 넓어지면 그때 올린다. 코드 쪽 근거는 `InAppNotificationEventType` JSDoc 이다. 같은 규칙이 두 곳에 있으므로 서로 가리켜 어긋남을 잡는다.

### `buttonConfig` 예시 정정: 타임아웃 제거와 `nodeOutput` 판별자 폐지 (2026-06-03, C2·C3)

→ [WebSocket 이벤트와 명령 — 입력 대기 이벤트](CLE-API-WS-EVENTS-WAITING.md#buttonconfig-예시-정정-타임아웃-제거와-nodeoutput-판별자-폐지-2026-06-03-c2c3)

### `submit_form`·`click_button` payload 와 ack 를 구현에 맞춘 이유 (2026-06-10)

→ [WebSocket 이벤트와 명령 — 실행 제어 명령과 ack](CLE-API-WS-EVENTS-COMMANDS.md#submit_formclick_button-payload-와-ack-를-구현에-맞춘-이유-2026-06-10)
