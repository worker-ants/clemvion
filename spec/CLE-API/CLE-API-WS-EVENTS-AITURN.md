---
id: "CLE-API-WS-EVENTS-AITURN"
title: "WebSocket 이벤트와 명령 — AI 대화 턴 이벤트"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-WS-EVENTS"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-WS-EVENTS"]
area: "CLE-API"
content_hash: "a1cfdb787681c8a56eba476f9c7efbc4552dad2d34897acdf3505dee2955df36"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "0d689d3a1e45f81210ffcb4a79bac7072ba5cdfd0e8e70136516749498858710"
etag: "sha256-21e42709ff39df0cd8d2e61a10339197701684b459d9088d973fd944766174ec"
---
> 구현 상태: 구현됨 · 상위: [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md)

## 개요

이 문서는 [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) 의 하위 문서로 AI 에이전트 멀티턴의 턴 진행 이벤트(`execution.ai_message`, `execution.user_message`, 도구 호출 이벤트), 라이브 신호의 맞춤, 메시지 출처 표시 `messages[].source` 를 정한다.

## 4. AI 대화 턴 이벤트

원문 §4 의 번호를 그대로 쓴다. §4 머리와 §4.5 대화 스레드 스냅샷은 [WebSocket 이벤트와 명령 — 입력 대기 이벤트](CLE-API-WS-EVENTS-WAITING.md) 에 있다.

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

`llmCalls[].requestPayload`·`responsePayload` 는 원본 디버그 payload 다. 민감 데이터(시스템 프롬프트, 대화 이력, 도구 정의, 사용자 입력)를 담을 수 있어 에디터 디버깅 타임라인 같은 **개발자·에디터 표면** 전용이다. `llmCalls` 는 워크스페이스 인증·소유권으로 게이트된 내부 WebSocket 채널에만 실리고 모든 외부 fanout 수신자와 EIA 단발 상태 조회에서는 필드 이름 기준으로 어느 깊이에서든 빠진다. DB 영속 경로와 실행 내역 디버그 패널은 영향이 없다. 결정과 근거는 [응답 자격 증명 마스킹](CLE-API-EGRESS.md) 에 있다.

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
- **dedup 기준**: `receivedAt` 이 1차 dedup 키다(§4.4). `ai_message.messages` 스냅샷의 마지막 `source:'live'` 사용자 메시지와 맞추는 것은 폴백 경로다([대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md)).

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

실패 때는 `status: "error"` 와 `error`(메시지 문자열)가 실리고 `content` 에는 LLM 에 넘긴 에러 content 가 담긴다. 실패 예시:

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
- 대화 화면(대화 미리보기 탭, 대화 타임라인)은 대화 턴의 1차 출처로 발행 messages 가 아니라 `waiting_for_input.conversationThread.turns` 스냅샷([대화 스레드 스냅샷](CLE-API-WS-EVENTS-WAITING.md#45-대화-스레드-스냅샷-conversationthread))을 쓴다. 보조 관측 레인은 예외다(2026-07-17). 같은 화면이 `nodeOutput.meta.turnDebug[].ragSources` **한정**으로 지식 저장소 검색 표시(🔎 `rag` 행, 📚 참조 칩)를 함께 렌더한다. 턴을 대체하지 않고 더해지는 별개 축이다. 형제 필드 `llmCalls` 는 이 예외에 들지 않는다(디버그 탭 전용). `injected` 표시의 시각 규칙(아이콘, 컨테이너 형식, 칩을 동시에 적용)은 권장이 아니라 필수이며 기준은 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 다. LLM 디버그 패널(요청, 응답, LLM 사용량)만 발행 messages 의 원본 payload 를 쓰고 이때도 "Raw payload" 토글로 표시한다.
- `source` 가 없으면(옛 백엔드, 옛 DB 영속 페이로드 호환) `'live'` 로 본다. 내역 재구성 경로(`parseHistoryMessages`)도 같다.
- **라이브 조기 노출**(§4.2, §4.4)은 **라이브 전용 UX 성질**이다. 내역 화면(`parseHistoryMessages(outputData)`)은 턴이 끝난 뒤 질문과 답이 넣은 순서대로 함께 있어 따로 조기 노출이 없다. 턴이 만들어지는 도중 새로고침하면 노드는 `running` 으로 보이고 낙관적 사용자 말풍선은 되살아나지 않는다(스냅샷·`tool_call_started` 진행 신호가 라이브 전용인 것과 같다).

## Rationale

### 메시지 출처 표시 `messages[].source` 도입

`contextScope` 가 켜진 AI 에이전트는 턴마다 `[system, ...injectedThread, ...selfHistory]` 로 messages 를 다시 만들고 주입된 앞 노드의 항목도 payload 의 `messages` 스냅샷에 들어간다. 프론트엔드가 사용자 메시지 수로 턴 번호를 정하면 백엔드 권위 `turnCount` 와 어긋나 `llmCalls[]` 와 어시스턴트 메시지를 맞출 수 없고 응답·요청·LLM 사용량 탭이 비는 회귀가 났다. 그래서 `source: 'live' | 'injected'` 표시를 붙이고 소비 쪽이 `live` 만 센다. 출처가 늘어도 enum 값만 더하면 된다. 기각한 대안: `injectedContextLength` 만 싣는 안은 주입이 앞에 연속으로 붙는다는 가정이 필요해 중간 주입이나 여러 스레드 병합([대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 의 v2 로드맵)에서 깨진다. 어시스턴트 메시지에 `turnIndex` 를 싣는 안은 사용자 메시지의 턴 매핑을 풀지 못한다.

**영속 정책(미정)**: 이 표시는 전송 층 정의에 한정한다. `NodeExecution.outputData.messages` 영속 형태에 `source` 를 넣을지는 정하지 않았고 넣지 않아도 "없으면 `live`" 폴백으로 내역 재구성이 안전하다. 대화 스레드는 이미 durable 컬럼(`Execution.conversation_thread`, V084)에 영속된다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)). 그 컬럼이나 노드 출력 영속 형태가 이 표시를 담을지는 따로 정해야 한다.

### `user_message` 낙관적 말풍선의 도장 맞춤 분기

클라이언트가 **직접** 발화하는 경로는 보내는 즉시 로컬 낙관적 `ai_user` 말풍선을 클라이언트 시각으로 띄운다. 뒤이어 오는 `user_message` 의 dedup 키는 서버 `receivedAt` 이라 `receivedAt` dedup(§4.4)만으로는 로컬 말풍선을 잡지 못해 같은 발화가 두 말풍선으로 겹치는 회귀가 났다.

- **결정**: 되돌아온 이벤트가 같은 발화의 기존 낙관적 말풍선을 찾으면 새 항목을 붙이지 않고 기존 말풍선에 `receivedAt` 을 **찍어** 맞춘다. 로컬 말풍선이 없는 경로(채널 텍스트 인바운드 등)에서만 붙인다.
- **근거**: 보낸 사람의 즉시 피드백(로컬 낙관)과 WebSocket 되돌림 유실 내성을 지키면서 중복만 없앤다. 찍은 뒤 `receivedAt` 은 재발행·재구독 dedup 키로 계속 쓰이고 최종 정합은 턴 종료 `ai_message` 스냅샷 교체가 보장한다(도장은 그 앞의 보조 단계다). 프론트엔드 구현 식별자는 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 방침에 따라 여기 적지 않는다.

### 요소별 절대 발생 시각·소요 시간을 싣는 이유 (`startedAt`·`finishedAt`, 2026-06-03)

어시스턴트 LLM 응답과 도구 실행에는 시각 데이터가 없어(`durationMs` 만 있었다) 멀티턴 AI 노드 안 요소의 절대 발생 시각을 보일 수 없었다. `llmCalls[]` 와 `toolCalls[]` 에 `startedAt`·`finishedAt`(ISO8601)을 더해 라이브 이벤트와 `meta.turnDebug[]` 영속 양쪽에 싣는다. 엔진이 소요 시간을 재려고 이미 시작 시각을 잡고 있어 싣기만 하면 된다. DB 마이그레이션이 필요 없고(JSONB 안), 하위 호환 선택 필드이며 라이브와 영속이 같은 출처라 두 화면이 같은 시각을 보인다. 소요 시간만으로는 "언제" 를 되살릴 수 없다. **기각한 대안**: 노드 시작 시각에 누적 소요 시간을 더해 추정하는 안은 공백을 반영하지 못해 부정확하고 라이브 전용 클라이언트 도장 안은 실행 내역 화면에서 시각이 사라진다.
