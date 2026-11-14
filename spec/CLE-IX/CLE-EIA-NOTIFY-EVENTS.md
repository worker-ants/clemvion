---
id: "CLE-EIA-NOTIFY-EVENTS"
title: "EIA 알림 웹훅 — 이벤트와 payload"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EIA-NOTIFY"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-EIA-NOTIFY"]
area: "CLE-IX"
content_hash: "98ea3b9157323f396190a7865c99cf810e8af83b6a8b951ead24b682fbc9d565"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "6e035f400c110cd1e1848c5934e633618d7d9cbdbe5e52f483866d27a40293a1"
etag: "sha256-3f0af8afb6902a12125aa8c22d8d002ecd9e6104a8f20b58e8ce112cf8172ad6"
---
## 개요

이 문서는 [EIA 알림 웹훅](CLE-EIA-NOTIFY.md) 의 하위 문서로 구독할 수 있는 이벤트, 이벤트 봉투와 알림 웹훅 페이로드, 종결 이벤트 필드 집합, `execution.cancelled` 행동 계약, 이벤트별 payload 를 정한다. 종결 이벤트 필드 집합과 이벤트 봉투는 SSE·WebSocket 도 이 문서를 기준으로 삼는다.

## 구독 이벤트

| 이벤트 | 기본 구독 예시 | 설명 |
|---|---|---|
| `execution.waiting_for_input` | 예 | 실행이 입력 대기에 들어갔다 |
| `execution.completed` | 예 | 실행이 완료됐다 |
| `execution.failed` | 예 | 실행이 실패했다 |
| `execution.cancelled` | 예 | 실행이 취소됐다 |
| `execution.ai_message` | 아니오 | AI 응답. 양이 많아 명시적으로 구독할 때만 보낸다 |

이 다섯 가지 밖의 이벤트(노드 이벤트, `execution.message` 등)는 알림 웹훅으로 보내지 않는다(`FANOUT_EVENTS` 화이트리스트). SSE 는 더 많은 이벤트를 보낸다. 대응은 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md) 에 있다.

## 이벤트 봉투

엔진이 만드는 이벤트는 하나지만 받는 경로마다 최종 형태가 다르다. `payload` 래퍼는 알림 웹훅에만 있다. WebSocket·SSE 의 형태는 이벤트 봉투, 알림 웹훅 요청 본문의 `payload` 틀은 알림 웹훅 페이로드라고 부른다([용어 사전 — 다의어 구분](../CLE-GLOSSARY-POLY.md)).

| 받는 경로 | 최종 형태 |
|---|---|
| WebSocket(에디터, 내부) | `{ executionId, …필드 집합, seq, timestamp }` 평면 |
| SSE | 위 평면 객체 + `triggerId`·`workflowId`. `payload` 래퍼 없음 |
| 알림 웹훅 | `{ type, executionId, triggerId, workflowId, seq, timestamp, payload: { …SSE 와 같은 평면 객체 } }` |

- 알림 웹훅 요청 본문에는 키 다섯 개(`executionId`·`seq`·`timestamp`·`triggerId`·`workflowId`)가 최상위와 `payload` 안에 두 번 나온다. 결함으로 보지 않는다. 지금 구조가 그렇다. 바깥 `workflowId` 는 트리거 행에서, 안쪽은 실행 라우팅 컨텍스트에서 온다.
- 알림 웹훅 페이로드(`payload` 래퍼)는 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 응답 봉투(`{ data }`)와 다른 것이다. 한 겹 감싸는 모양만 비슷하고 서로 참조하지 않는다.
- 평면은 이벤트 봉투 차원의 말이다. `executionId`·`seq`·`timestamp` 가 필드 집합과 같은 층에 온다는 뜻이지 필드 집합 안의 중첩을 펴라는 뜻이 아니다. `result.cancelledBy` 의 `result` 는 세 경로 모두에서 그대로다.
- 필드 집합·이벤트 봉투·알림 웹훅 페이로드·`cancelled` 행동 계약은 이 문서에만 두고 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)·[채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md)·[에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md) 은 여기를 가리킨다(근거: [EIA 알림 웹훅 「정본을 한 곳에 둔다」](CLE-EIA-NOTIFY.md#정본을-한-곳에-둔다)).

## 종결 이벤트 필드 집합

`execution.completed`·`execution.failed`·`execution.cancelled` 가 싣는 필드는 이 표가 전부다. 표에 없는 필드는 보내지 않는다.

| 필드 | 이벤트 | 상태 | 비고 |
|---|---|---|---|
| `status` | 세 가지 | 구현됨 | `completed` \| `failed` \| `cancelled` |
| `error` | `failed`, `cancelled`(시스템 취소만) | 구현됨 | `{ code, message, nodeId, details? }`. `code`·`nodeId` 는 `null` 일 수 있다. `failed` 는 모든 경로에서 객체다(`toTerminalErrorPayload` 로 일원화). `cancelled` 는 `{ code, message }` 를 손으로 만들어 `nodeId`·`details` 가 없다 |
| `result.cancelledBy` | `cancelled` | 구현됨 | 종결 발행 타입이 필수 필드로 강제한다. 세 이벤트의 필수 필드는 모두 타입이 강제한다 |
| `result.outputs` | `completed` | 미구현(Planned) | 발행 직전에 데이터가 있지만 payload 에 넣지 않는다 |
| `durationMs` | 세 가지 | 구현됨 | 밀리초. 알 수 없으면 `null`(형제 `error.code` 와 같은 부재 표현). 엔티티를 읽지 않는 취소 경로는 UPDATE 문 안에서 SQL 로 계산해 `RETURNING` 으로 받아 싣는다(DB 와 전송 값이 같다). `markQueueWaitTimeout` 의 값은 큐 대기 시간이다(`started_at` 이 admission 전 시각). WebSocket 문서는 같은 값을 `duration` 으로 적는다. 이름만 다르고 같은 값이다 |

`finalNodeId`·`finalPort`·`nodeCount`·`failedNodeId` 는 싣지 않는다. 엔진에 그런 개념 자체가 없다. 풍부한 종결 데이터가 필요하면 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md) 의 상태 조회를 쓴다.

## `execution.cancelled` 행동 계약

- `result.cancelledBy` 는 닫힌 세 값 union 이다. `"user"` \| `"system"` \| `"timeout"`. 넓히지 않는다. 새 사유는 새 값을 만들지 않고 `error.code` 로 나눈다.
- 시스템 취소에는 `error: { code, message }` 가 함께 온다. `message` 도 늘 있다. `cancelledBy` 만으로 가를 수 없는 사유를 `error.code` 가 나눈다.

  | `cancelledBy` | `error.code` | 사유 |
  |---|---|---|
  | `system` | `RESUME_*`(`CHECKPOINT_MISSING`·`FAILED`·`INCOMPATIBLE_STATE`) | rehydration 실패([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)) |
  | `timeout` | `EXECUTION_QUEUE_WAIT_TIMEOUT` | admission 큐 대기 5분 초과([큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md)) |
  | `timeout` | `WEBCHAT_IDLE_TIMEOUT` | 공개 위젯 입력 대기 회수([External Interaction API](CLE-EIA.md)) |

- 일반 사용자 취소에는 `error` 키가 없다. `null` 도 싣지 않는 부재다. `error` 는 시스템 취소의 사유를 더하는 부가 맥락이다. 사용자 취소는 `cancelledBy` 로 충분하므로 `error` 가 없는 것이 수신 측의 정상 경로다. 이 키 생략은 응답 바디 규칙인 [HTTP API 규약 §5.5](../CLE-API/CLE-API-CONV.md#55-부재-표현-null-과-키-생략) 의 기준 (b) 를 준용한다.
- 같은 취소 전이를 여러 종결자가 각자 관측하면 저마다 `execution.cancelled` 를 낸다. 단일 발행 관문이 없다. payload 값은 모두 DB 정본을 읽어 같으므로 모순은 없고 중복만 생긴다. 수신 측은 `executionId` 와 종결 여부로 멱등하게 처리한다.
- `cancelled` 의 `error` 는 자격 증명 가리기 대상이 아니다. 시스템 취소 경로가 `{ code, message }` 를 손으로 만들고 `toTerminalErrorPayload` 를 거치지 않기 때문이다. 지금은 모두 정적 상수 문자열이라 유출 위험이 없지만 구조적 보장은 아니다.

## 이벤트별 payload

### `execution.waiting_for_input`

아래는 논리 구조 표기다. 실제 필드 이름은 이어지는 대응 목록이 기준이다.

```jsonc
// 알림 웹훅 요청 본문 기준. SSE 는 payload 래퍼 없이 안쪽 객체가 그대로 온다
{
  "type":        "execution.waiting_for_input",
  "executionId": "uuid",
  "triggerId":   "uuid",
  "workflowId":  "uuid",
  "seq":         42,
  "timestamp":   "ISO8601",
  "payload": {
    "node": {
      "id":              "uuid",
      "type":            "form" | "carousel" | "table" | "chart" | "template" | "ai_agent" | "information_extractor",
      "interactionType": "form" | "buttons" | "ai_conversation"
    },
    // interaction 블록은 미구현(Planned). 아래 필드는 아직 싣지 않는다
    "interaction": {
      "submitUrl":  "/api/external/executions/{id}/interact",
      "streamUrl":  "/api/external/executions/{id}/stream",
      "statusUrl":  "/api/external/executions/{id}",
      "cancelUrl":  "/api/external/executions/{id}/cancel",
      "token":      "iext_<jwt>",     // per_execution 일 때만. per_trigger 면 생략
      "expiresAt":  "ISO8601",
      "expectedCommands": ["submit_form"]
                       | ["click_button"]
                       | ["submit_message", "end_conversation"]
    },
    "context": {
      "formConfig":         { /* form 노드일 때 */ },
      "buttonConfig":       { /* 버튼 노드일 때 */ },
      "conversationConfig": { /* AI 멀티턴일 때 */ },
      "conversationThread": { /* 선택. 대화 스레드 스냅샷 */ }
    }
  }
}
```

- `interaction` 블록은 미구현이다. URL 네 개·`token`·`expiresAt`·`expectedCommands` 를 지금은 어떤 발행 경로도 싣지 않는다. 클라이언트는 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md) 의 엔드포인트를 직접 구성해야 한다. URL 은 구현될 때의 형태를 상대 경로로 적었다. 절대 URL 이나 `/v1/` 버전 구간은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 위반이다.
- `interaction` 블록이 구현되면 `token` 은 실행 단위 토큰 전략(`per_execution`)일 때만 싣는다. 트리거 단위 토큰 전략(`per_trigger`)이면 키를 생략한다. 트리거 단위 토큰은 생성 · PATCH · 재발급 응답으로 이미 받은 영구 토큰이라([External Interaction API](CLE-EIA.md)) 키가 없는 것이 정상 경로다. 이 키 생략도 [HTTP API 규약 §5.5](../CLE-API/CLE-API-CONV.md#55-부재-표현-null-과-키-생략) 의 기준 (b) 를 준용한다.
- `expectedCommands` 는 "다음에 보낼 만한" 명령을 알려 주는 권장 힌트다. 서버가 강제하는 대기 표면별 허용 명령과 다를 수 있다. `ai_conversation`·`ai_form_render` 대기 중에는 서버가 네 명령을 모두 받지만(`render_form` 응답을 `submit_form` 으로, 낡은 `button_click` 은 다시 park, [Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md)), `expectedCommands` 는 그중 권장 명령만 나열한다. 서버 강제 매트릭스는 [큐 워커와 동시 실행 제한 「발행 전 사전 검증」](../CLE-EXEC/CLE-EXEC-WORKER.md#발행-전-사전-검증) 이 정한다(불일치는 `409 STATE_MISMATCH`).
- `formConfig`·`buttonConfig`·`conversationConfig`·`conversationThread` 의 모양은 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 의 입력 대기 이벤트와 같다. `conversationConfig.messages[].source` 가 없으면 `live` 로 보는 폴백도 그 문서가 정한다. 대화 스레드의 매핑 근거는 [대화 스레드](CLE-IX-THREAD.md) 다.
- 디버그 전용 필드(`nodeOutput.meta.turnDebug[].llmCalls` 등 원본 LLM 요청·응답)는 필드 이름 기준으로 깊이와 관계없이 빠진다. 입력 대기 `nodeOutput` 의 키 허용 목록과 값 가리기는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다.

**실제 필드 이름.** 필드 이름은 채널과 관계없이 같다. 알림 웹훅도 SSE 도 아래 오른쪽 이름을 싣는다. 두 채널의 차이는 `payload` 래퍼가 있느냐뿐이다. fanout 은 이름을 바꾸지 않는다(`notification-fanout.service.ts` 가 `payload: event.payload` 로 그대로 감싼다). 위젯과 SDK 는 어느 채널에서든 오른쪽을 읽는다.

| 논리 표기 | 실제 필드 |
|---|---|
| `node.id` | 대기 노드 ID(`waitingNodeId`, 평면). `submit_message` 의 `nodeId` 로 그대로 쓴다 |
| `node.interactionType` | `interactionType`(평면) |
| `context.conversationConfig` | `nodeOutput.conversationConfig` |
| `context.buttonConfig` | `buttonConfig`(평면) |
| `context.formConfig` | `nodeOutput.formConfig`(없으면 `nodeOutput` 자체) |
| `context.conversationThread` | `conversationThread`(평면) |
| 논리 표기에 없음 | `status`: 리터럴 `"waiting_for_input"` 이 평면으로 함께 온다 |

`node.type` 에는 외부 소비용 대응이 없다. `waitingNodeType` 이 평면으로 실리기는 하지만 내부 WebSocket 의 부가 식별자(에디터 타임라인 관측용)다. 외부 클라이언트는 노드 종류 대신 `interactionType` 으로 가른다. 참조 구현 `parseWaitingForInput`(`codebase/channel-web-chat/src/lib/eia-events.ts`)이 `waitingNodeType` 을 읽지 않는 것이 그 근거다(실제 소비처는 내부 에디터의 `use-execution-events.ts` 뿐). `waitingNodeType`·`waitingNodeLabel`·`nodeExecutionId`·`startedAt` 도 평면으로 실리지만 같은 이유로 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 이 정한다. 이 문서는 외부 클라이언트가 읽는 필드만 다룬다.

외부로 나가는 `interactionType` 은 세 값이다. 엔진 내부의 `ai_form_render` 가 알림 웹훅·SSE 에서 어떻게 보이는지는 [인터랙션 타입 레지스트리](CLE-IX-TYPES.md#미결-사항) 의 미결 사항이다.

### `execution.completed`

`status` 와 `durationMs` 를 싣는다. `result.outputs` 는 아직 싣지 않는다.

```jsonc
// 알림 웹훅 요청 본문 기준. SSE 는 payload 래퍼 없이 안쪽 객체가 그대로 온다
{
  "type":        "execution.completed",
  "executionId": "uuid",
  "triggerId":   "uuid",
  "workflowId":  "uuid",
  "seq":         99,
  "timestamp":   "ISO8601",
  "payload": {
    "status": "completed",
    // result.outputs: Planned
    "durationMs": 4242
  }
}
```

### `execution.failed`

`status`·`error`·`durationMs` 를 싣는다.

```jsonc
{
  "type": "execution.failed", /* …completed 와 같은 최상위 필드… */
  "payload": {
    "status": "failed",
    "error": {
      "code":    "EXECUTION_TIMEOUT" | "EXECUTION_TIME_LIMIT_EXCEEDED" | "MAX_ITERATIONS_EXCEEDED" | "CYCLE_DETECTED" | ... | null,
      "message": "사람이 읽는 메시지",
      "nodeId":  "uuid" | null,
      "details": { ... }    // 노드 종류별 상세
    },
    "durationMs": 4242
  }
}
```

- `error.code` 는 엔진 수준 에러 코드이거나 노드 수준 실패의 노드 에러 코드(예: `LLM_CALL_FAILED`)다. 엔진 코드 목록은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md), 노드 코드 목록은 `codebase/backend/src/nodes/core/error-codes.ts` 에 있다. `EXECUTION_TIMEOUT` 은 Code 노드 스크립트 타임아웃, `EXECUTION_TIME_LIMIT_EXCEEDED` 는 엔진의 누적 실행 시간 한도 초과다.
- `code` 는 `null` 일 수 있다. 코드를 만드는 경로는 여럿이다(sentinel `ErrorPortFallbackError`·`ExecutionTimeLimitError`, 늘 붙는 `WORKER_HEARTBEAT_TIMEOUT`, 취소 계열 `RESUME_*`·`EXECUTION_QUEUE_WAIT_TIMEOUT`·`WEBCHAT_IDLE_TIMEOUT`). 그러나 일반 `catch` 경로에는 분류할 코드가 없어 "항상 있다" 를 약속할 수 없다. 수신 측 처리는 정해져 있다. [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 은 `error.code === null` 을 내부 실패 안내로 대신한다.
- `failed` 의 `error` 는 모든 발행 경로에서 객체다(`toTerminalErrorPayload` 로 발행 네 곳을 일원화). 다만 배포 경계에서 다시 재생되는 옛 이벤트는 문자열을 실을 수 있다. 그래서 채팅 채널 디스패처와 에디터 프런트엔드는 문자열을 받는 분기를 일부러 남긴다. 그 분기는 지울 대상이 아니다.
- `message`·`details` 는 자격 증명 패턴(`Bearer …`, 자격 증명이 든 URI 등)을 `***` 로 가린다. `code`·`nodeId` 는 원문 그대로다. JSON 형태의 `message` 는 가린 뒤 다시 직렬화하므로 공백 같은 서식이 달라질 수 있다(파싱은 된다). 범위와 남은 갭은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다.

### `execution.cancelled`

알림 웹훅 요청 본문의 최상위 필드는 `completed` 와 같다. 알림 웹훅 페이로드(`payload`)에는 `status`·`result.cancelledBy`·`durationMs` 를 싣는다. 시스템 취소면 `error` 가 함께 온다. `cancelledBy` 값·`error.code` 대응·사용자 취소의 `error` 부재는 [`execution.cancelled` 행동 계약](#executioncancelled-행동-계약) 이 정한다.

- `durationMs`: 취소 경로 여섯 곳 중 네 곳은 엔티티를 읽지 않는 raw UPDATE 라 JS 로 계산할 수 없다. UPDATE 문 안에서 SQL 로 계산하고 `RETURNING` 으로 받아 싣는다. DB 와 전송 값이 같다. 알 수 없으면 `null` 이다.
- 마지막 턴 재시도 처리 중 사용자가 Stop 하면, CANCELLED 분기의 `COALESCE` UPDATE 에 `RETURNING` 을 붙여 DB 가 실제로 고른 값을 다시 읽어 싣는다. `COALESCE` 가 어느 쪽을 골랐는지는 DB 만 알기 때문이다.
- 검증 범위: 이 메커니즘은 mock 단위 테스트까지 확인했다. `COALESCE` 식이 실제 Postgres 에서 어느 값을 고르는지는 아직 실 DB 로 확인하지 않았다.
- 취소 경로의 값은 실행 시간보다 대기 시간에 가깝다. `EXECUTION_QUEUE_WAIT_TIMEOUT`(admission 전부터의 큐 대기), park 취소(기한 없는 대기), 공개 위젯 입력 대기 회수(유예 기본 1시간) 셋 다 그렇다. `started_at` 이 실행 시작 시각이 아닌 생성 시각이기 때문이다. "종결까지의 경과" 라는 정의와는 맞지만, 수신 측이 실행 소요 시간으로 읽으면 오해할 수 있다.

### `execution.ai_message`

[WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 의 `execution.ai_message` payload 를 담고, [이벤트 봉투](#이벤트-봉투) 절이 채널마다 정한 필드(`triggerId`·`workflowId`·`timestamp`·`seq`)만 더한다.

- WebSocket payload 의 `presentations?: PresentationPayload[]`(AI Agent `render_*` 표시 도구를 부른 턴에만 있음, [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md))도 그대로 전달한다. 외부 SDK 는 이 필드가 있으면 채팅 UI 에서 텍스트와 함께 인라인으로 그릴 수 있다.
- 디버그 전용 `llmCalls`(원본 LLM 요청·응답)는 fanout 지점에서 빠져 외부 수신자(SSE 포함)에게 가지 않는다. 인증된 내부 WS(에디터) 전용이다.
- 어시스턴트 텍스트는 `message` 필드로 온다(`text` 가 아니다). 그 밖에 `nodeId`·`turnCount`·`presentations?` 가 온다. 참조 구현은 `eia-events.ts` 의 `parseAiMessage` 다.
- AI 텍스트(`message`·`messages[]`·`presentations[]`)는 발행 지점에서 자격 증명 값을 가린다. 내부 WS·채팅 채널에도 같이 적용된다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)).

## 구현 위치

- `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts` (단일 싱크 구독, `FANOUT_EVENTS` 화이트리스트, 종료 시 토큰 폐기. `retry.maxAttempts` 를 큐 시도 횟수로 넘기는 일은 [서명과 발송](CLE-EIA-NOTIFY-DELIVERY.md#구현-위치))
- `codebase/backend/src/shared/utils/terminal-error-payload.ts` (`toTerminalErrorPayload`)
- `codebase/backend/src/shared/utils/terminal-duration.ts` (종결 이벤트 `durationMs`)
- `codebase/channel-web-chat/src/lib/eia-events.ts` (`parseWaitingForInput`·`parseAiMessage` 참조 구현)

## Rationale

### 종결 이벤트 필드를 약속한 만큼만 둔다

- `finalNodeId`·`finalPort`·`nodeCount`·`failedNodeId` 는 엔진에 개념 자체가 없다(발행 로직 0건). 설계된 적 없는 필드를 문서만 약속하고 있었다. 되살리지 않는다.
- `error.code` 를 억지로 채우는 대체 코드는 넣지 않는다. 의미 없는 코드가 의미 있는 코드와 같은 자리에 섞이면 수신 측이 가를 수 없기 때문이다. 그래서 "코드 없음" 을 부재로 전한다. 부재 표현은 형제 필드 `nodeId` 와 같은 `null` 이다([HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 부재 표현에서 키 생략과 택일하고 근거를 남긴다).
- 필드 집합 등을 이 문서 한 곳에만 두는 이유는 [EIA 알림 웹훅 「정본을 한 곳에 둔다」](CLE-EIA-NOTIFY.md#정본을-한-곳에-둔다) 에 있다.

### 시스템 취소 `error.message` 를 필수로 적는다 (2026-11-05)

시스템 취소 경로는 모두 `{ code, message }` 를 손으로 만들고 `message` 에 정적 상수 문자열을 넣는다([`execution.cancelled` 행동 계약](#executioncancelled-행동-계약)). 선택으로 적으면 수신 측이 실제로 생기지 않는 부재를 처리해야 한다. [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) 의 TypeScript 변형은 아직 `message?` 다. 그 문서는 어긋나면 이 문서를 따른다고 정해 두었고, 두 표기를 맞추는 일은 후속 NERV Task `CLE-T-M42X2A` 가 맡는다.
