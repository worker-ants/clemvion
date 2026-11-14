---
id: "CLE-NODE-AGENT-OUTPUT-MULTI"
title: "AI 에이전트 노드 출력 — 멀티턴"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-AGENT-OUTPUT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-AI", "CLE-NODE-AGENT-OUTPUT"]
area: "CLE-NODE-AI"
content_hash: "e7a142c351b6e6e937633ba3f3c3572e72ff6f8a9c0b2e4503a16f0bde4c9d1f"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "6d77febe7e1403f682a433d027ca42040a31d35dc76fb75e260dfe2ff21e6a59"
etag: "sha256-b74092c0536f13fe84c47038babfc974d890f6100cad3d8e882709b25c1a396f"
---
## 개요

이 문서는 [AI 에이전트 노드 출력과 디버그](CLE-NODE-AGENT-OUTPUT.md) 의 하위 문서로 멀티턴 모드의 입력 대기 · 재개 스냅샷과 종결 출력(조건 매칭 · 사용자 종료 · 최대 턴 도달 · 에러), 마지막 턴 재시도를 정한다.

## 멀티턴 입력 대기 (`status: "waiting_for_input"`)

첫 진입 직후, 그리고 매 턴이 종료 조건 없이 끝난 뒤에 낸다. `output` 은 런타임 누적 대화 상태만 싣고 리터럴 설정은 에코하지 않는다(Principle 1.1).

```json
{
  "config": {
    "mode": "multi_turn",
    "model": "{{ vars.model }}",
    "systemPrompt": "You are a customer support assistant...",
    "maxTurns": 20,
    "maxToolCalls": 10,
    "knowledgeBases": ["kb-1"],
    "conditions": [
      { "id": "refund_request", "label": "Refund Request", "prompt": "..." }
    ]
  },
  "output": {
    "result": {
      "messages": [
        { "role": "user", "content": "안녕하세요" },
        { "role": "assistant", "content": "안녕하세요, 무엇을 도와드릴까요?" }
      ],
      "message": "안녕하세요, 무엇을 도와드릴까요?",
      "turnCount": 1
    }
  },
  "meta": {
    "durationMs": 1500,
    "model": "gpt-4o",
    "inputTokens": 100,
    "outputTokens": 30,
    "totalTokens": 130,
    "toolCalls": 0,
    "interactionType": "ai_conversation",
    "turnDebug": [ { "turnIndex": 1, "llmCalls": [], "totalDurationMs": 1500 } ]
  },
  "status": "waiting_for_input",
  "_resumeState": {
    "llmConfigId": "cfg-1",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 4096,
    "knowledgeBases": ["kb-1"],
    "ragThreshold": 0.7,
    "maxToolCalls": 10,
    "maxTurns": 20,
    "mcpServers": [],
    "conditions": [],
    "messages": [],
    "turnCount": 1,
    "totalInputTokens": 100,
    "totalOutputTokens": 30,
    "totalThinkingTokens": 0,
    "toolCalls": 0,
    "ragSources": [],
    "ragLastDiagnostics": { "attempted": false, "searchedKbCount": 0, "queriesUsed": [], "resultCount": 0 },
    "lastTurnDurationMs": 1500,
    "turnDebugHistory": []
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | 원본 에코 | Principle 7 | 첫 턴은 `context.rawConfig`, 후속 턴은 `state.rawConfig`. 고정 범위는 한 턴 |
| `output.result.messages` | ChatMessage[] | 런타임 누적 | 첫 턴은 빈 배열(LLM 호출 전). 후속 턴부터 system 을 뺀 user·assistant·tool 누적 |
| `output.result.message` | string | 핸들러 반환 | 현재 턴 assistant 응답. 첫 진입 때는 `""` |
| `output.result.turnCount` | number | 핸들러 반환 | 누적 턴 수(첫 진입 때 `0`). 진행률 분모 `maxTurns` 는 `config.maxTurns` 에서 읽고 출력에는 싣지 않는다(Principle 1.1) |
| `meta.interactionType` | `"ai_conversation"` | 핸들러 반환 | 실행 결과 화면의 대화 미리보기 탭 식별자. 노드 판별자(Principle 1.1.4)가 아니라 대기 표면 라벨이다. 탭 렌더 규칙은 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 가 정하며 1차 소스는 내보낸 messages 가 아니라 대화 스레드 스냅샷이다 |
| `meta.durationMs`·토큰·`turnDebug` | | 단일 턴과 같은 위치 | 진행 중 누적치를 실어 참조·LLM 사용량 탭이 동작한다. `turnDebug[].ragSources` 는 대화 미리보기의 보조 관찰성 레인(🔎 `rag` 행, 📚 칩)도 쓴다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md), [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md)). `rag` 행은 이 턴의 `kb_*` 도구 호출이 가져온 청크를 턴 단위로 모은 표시다([RAG 검색](../CLE-KB/CLE-KB-SEARCH.md)). `llmCalls` 는 디버그 탭 전용이다 |
| `status` | `"waiting_for_input"` | 핸들러 반환 | 엔진이 실행을 멈춘다 |
| `_resumeState` | object(최상위) | 핸들러 반환 | 다음 턴 처리용 내부 상태. 표현식 resolver 에 노출하지 않는다(Principle 4.2). DB 저장 때 지운다. 매 턴 재개를 위해 엔진이 자격 증명을 뺀 부분집합을 `_resumeCheckpoint` 로 `outputData` 에 영속한다 |
| `_resumeState.ragSources` | Array | `RagAccumulator`(상한) | 최근 `MAX_RESUME_RAG_SOURCES = 200` 건만 둔다. 긴 대화에서 `outputData` JSONB 비대화를 막는다. 잘린 청크는 이후 중복 제거에서 빠진다(의도한 절충) |
| `_resumeState.turnDebugHistory` | Array | 핸들러 반환 | 최근 `MAX_TURN_DEBUG_HISTORY = 50` 턴만 둔다 |
| `_resumeState.pendingFormToolCall` | object? | 핸들러 반환 | `render_form` 이 불려 폼 제출을 기다릴 때만 있다. 형태는 `{ toolCallId: string, formConfig: object }`. 다음 `execution.submit_form` 을 `toolCallId` 로 대조해 맞으면 tool_result 를 채워 LLM 을 다시 부르고 이 필드를 지운다. `interactionType: 'ai_form_render'` 진입과 이 필드 존재는 1:1 불변식이다. 엔진의 입력 대기 이벤트는 이 객체를 그대로 `conversationConfig.pendingFormToolCall` 로 싣는다([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)). 내부 형태와 wire 형태가 같다 |

`_resumeState` 는 `output` 밖 최상위 필드라 자격 증명 누락과 누적 비대화 우려로 표현식 자동완성에도 노출하지 않는다.

**세 내부 필드의 수명 주기** (모두 최상위 내부 필드, Principle 0 예외. 단일 기준은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 과 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md))

| 필드 | 수명 주기 | 영속 | 소비 |
| --- | --- | --- | --- |
| `_resumeState` | 한 턴 처리 구간 안에서만 있다. park 는 늘 코루틴·컨텍스트를 풀므로 턴 사이에 메모리에 남지 않는다. DB 영속 때 `stripControlFields()` 가 전체 상태를 무조건 지운다(자격 증명·rawConfig·턴 디버그를 담을 수 있음) | 비영속 | 다음 턴 재개 때 rehydration 이 `_resumeCheckpoint` 에서 다시 만든다. 턴 처리 뒤 새 `_resumeCheckpoint` 로 갱신한다 |
| `_resumeCheckpoint` (AI 에이전트·정보 추출기, 정보 추출기는 `partialResult`·`collectionRetryCount` 추가) | 입력 대기 진입과 매 턴 영속 시점에 엔진이 `_resumeState` 의 자격 증명을 뺀 부분집합을 싣는다. `stripControlFields()` 가 보존한다. `_retryState` 와 같은 배제 정책이지만 TTL(`expiresAt`)이 없고(대화는 오래 뒤에도 재개 가능) `lastUserMessage` 가 없다(재개 때 도착한 메시지를 그대로 처리) | `NodeExecution.outputData._resumeCheckpoint` | 매 턴 재개 때 엔진이 읽는다. 같은 인스턴스·재시작·다른 인스턴스 모두 rehydration 한 경로다. `schemaVersion` 검사 → 맥락 결합 필드 재유도(조작 필드는 `node.config` 재평가, 식별 필드 `workflowId`·`nodeExecutionId`·`workspaceId` 는 호출 측 컨텍스트) → `_resumeState` 재구성(핵심 필드가 없으면 기본값 보강) → 멀티턴 반복 재진입. 없거나 손상되거나 미래 버전이면 우아하게 초기화한다(`RESUME_INCOMPATIBLE_STATE`) |
| `_retryState` | 재시도 가능 에러로 끝날 때 `buildMultiTurnFinalOutput` 이 싣는다. `stripControlFields()` 가 보존한다 | `NodeExecution.outputData._retryState` | WS `execution.retry_last_turn` 이 `nodeExecutionId` 로 찾아 `expiresAt` 을 확인하고 새 NodeExecution 행을 만들어 멀티턴 반복에 다시 들어간다. TTL 이 지나거나 한 번 쓰면 `RETRY_STATE_NOT_FOUND` 로 응답한다 |

세 필드 모두 자격 증명과 맥락 결합 필드(`llmConfigId` 가 가리키는 provider secret, `workspaceId` 등)를 싣지 않는다. `buildRetryState`·`buildResumeState` 가 옮길 키를 열거하는 허용 목록 방식으로 애초에 뺀다. 재개할 때는 두 경로로 다시 유도한다. 조작 필드(`llmConfigId`·`maxTurns` 등)는 `node.config` 재평가로, 식별 필드(`workflowId`·`nodeExecutionId`·`workspaceId`)는 호출 측 컨텍스트에서 가져온다. 두 경로의 상세와 사용량 귀속 불변식은 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 에 있다. `_resumeCheckpoint` 와 `_retryState` 는 재구성 로직(`buildRetryReentryState`)을 함께 쓰고, 계기(재시작 재개 대 재시도 명령)와 수명(상시 대 에러 1회)만 다르다.

## 멀티턴 재개 (`status: "resumed"`, 일시)

사용자 메시지나 `render_form` 폼 제출을 받으면 엔진이 다음 턴 LLM 호출 전에 한 번 낸다. 이 스냅샷은 일시적이다. 엔진은 곧바로 다음 턴을 처리해 `waiting_for_input` 이나 `ended` 로 수렴한다. `resumed` 시점에는 연결선 라우팅이 없다.

엔진은 이 스냅샷을 노드 출력 캐시에 싣고 그 노드 실행 행의 `outputData` 에도 저장한다. 저장본에서는 `_resumeState` 를 빼고 체크포인트 대상 노드면 `_resumeCheckpoint` 를 싣는다. 행 상태가 `running` 이나 `waiting_for_input` 일 때만 저장하므로 그사이 취소로 종결된 행의 출력은 덮지 않는다. 엔진은 저장을 마친 뒤 LLM 을 부른다. LLM 응답이 오면 대기나 종결 출력이 두 곳을 다시 덮는다. 그래서 재개 턴의 LLM 호출 동안 REST 로 읽은 실행 상세에만 보인다. 그동안 행 상태는 `running` 이고 출력 상태는 `resumed` 다. REST 대기 정규화와 프런트 대기 판정은 `meta.interactionType` 이 `ai_conversation` 인 이 조합도 대기로 본다([실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md)).

스냅샷은 엔진이 직전 대기 스냅샷(노드 출력 캐시, 없으면 노드 실행 행의 `outputData`)을 이어 만든다. 핸들러는 만들지 않는다. 취소된 실행이면 내지 않는다.

**라이브 조기 노출(`execution.user_message`)**: 채팅 메시지 턴이면 엔진은 같은 수신 시점(다음 턴 LLM 호출 전)에 WS 이벤트 `execution.user_message` 를 한 번 보내 사용자 발화를 라이브 대화 화면에 바로 보여 준다([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)).

- 이 이벤트의 `nodeExecutionId` 는 그 시점에 `waiting_for_input` 이던 NodeExecution 행의 PK 다. 엔진의 `execution_id + node_id + status='waiting_for_input'` 단일 매칭과 같은 행이다.
- `receivedAt` 은 같은 턴 재개 스냅샷의 `output.interaction.receivedAt` 과 같은 값이다. 엔진이 한 번 만들어 두 곳에 쓴다. 중복 제거·재조정은 이 값의 일치에 기대지 않는다.
- 권위 출처는 여전히 턴 종료 `execution.ai_message.messages` 스냅샷이다. `user_message` 는 라이브 전용 비권위 진행 신호이며 영속 대상이 아니다. 재개 스냅샷 저장본의 `output.result.messages` 에도 이 발화가 들어가지만 그것은 노드 출력을 저장한 것이고 턴이 끝나면 대기나 종결 출력이 덮는다.
- 이 이벤트는 엔진의 멀티턴 메시지 턴 공통 경로에서 나가므로 노드 타입과 무관하다. 정보 추출기 등 다른 `ai_conversation` 재개 노드에도 똑같이 적용된다.

아래 예시는 노드 출력 캐시에 싣는 형태다. 노드 실행 행 저장본은 `_resumeState` 를 빼고 체크포인트 대상 노드면 `_resumeCheckpoint` 를 싣는다.

```json
{
  "config": { "mode": "multi_turn", "model": "gpt-4o", "maxTurns": 20 },
  "output": {
    "result": {
      "messages": [
        { "role": "user", "content": "환불 문의입니다" }
      ]
    },
    "interaction": {
      "type": "message_received",
      "data": { "content": "환불 문의입니다", "role": "user" },
      "receivedAt": "2026-05-10T06:42:01.123Z"
    }
  },
  "meta": { "durationMs": 0, "interactionType": "ai_conversation", "turnDebug": [] },
  "status": "resumed",
  "_resumeState": { "...": "(입력 대기와 같은 구조)" }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `config.*` | | 직전 대기 스냅샷의 설정 에코를 잇는다. 직전 스냅샷이 없으면(재시도로 다시 들어온 턴 등) 노드 설정을 쓴다 |
| `output.result.messages` | ChatMessage[] | 직전 대기의 누적 대화 끝에 사용자 메시지를 더한 값(모델 응답은 아직 없음). 폼 제출 턴은 더하지 않는다 |
| `output.result` 의 다른 키 | | 직전 대기 값을 그대로 잇는다 |
| `output.interaction.type` | `"message_received"` \| `"form_submitted"` | 사용자 입력 기록 종류(Principle 4.5). `render_form` 폼을 제출한 턴은 `form_submitted` 다 |
| `output.interaction.data` | object | 채팅은 `{ content, role: "user" }`, 폼은 제출 값 `{ <field>: value }` 다 |
| `output.interaction.receivedAt` | ISO8601 string | 엔진의 수신 시각. 같은 턴 `execution.user_message` 의 `receivedAt` 과 같다 |
| `meta.*` | | 직전 대기의 `meta` 를 잇는다. 진행 중 누적 토큰과 `turnDebug` 가 남는다. `contextInjection` 은 빼고 `durationMs` 는 `0` 이다 |
| `meta.interactionType` | `"ai_conversation"` | 늘 `ai_conversation` 이다. `render_form` 폼을 제출한 턴도 폼 입력을 더는 기다리지 않는다 |
| `status` | `"resumed"` | 1회성 일시 표지 |

## 멀티턴 조건 매칭 (`{condition.id}`)

LLM 이 조건 도구를 불렀을 때다. 형태는 단일 턴 조건 매칭과 같은 `output.result.*` 에 멀티턴 누적 메타를 더한 것이다.

```json
{
  "config": {
    "mode": "multi_turn",
    "model": "gpt-4o",
    "systemPrompt": "...",
    "maxTurns": 20,
    "maxToolCalls": 10,
    "conditions": [
      { "id": "refund_request", "label": "Refund Request", "prompt": "..." }
    ]
  },
  "output": {
    "result": {
      "response": "환불 요청을 확인했습니다",
      "endReason": "condition",
      "turnCount": 5,
      "messages": [
        { "role": "user", "content": "..." },
        { "role": "assistant", "content": "..." },
        "..."
      ],
      "condition": {
        "id": "refund_request",
        "label": "Refund Request",
        "reason": "사용자가 환불을 명시적으로 요청함"
      }
    }
  },
  "meta": {
    "durationMs": 3800,
    "model": "gpt-4o",
    "interactionType": "ai_conversation",
    "inputTokens": 3800,
    "outputTokens": 1200,
    "totalTokens": 5000,
    "toolCalls": 5,
    "ragSources": [],
    "turnDebug": [
      { "turnIndex": 1, "llmCalls": [], "totalDurationMs": 1500 },
      "..."
    ]
  },
  "port": "refund_request",
  "status": "ended"
}
```

`meta.inputTokens`·`outputTokens`·`totalTokens` 는 멀티턴 누적 합이다. 턴별 토큰은 `meta.turnDebug[i].llmCalls[j].responsePayload.usage` 에서 본다.

## 멀티턴 사용자 종료 (`user_ended`)

사용자가 `execution.end_conversation` 을 보냈을 때다(`endMultiTurnConversation` 진입점). 엔진이 누적된 `_resumeState` 로 `buildMultiTurnFinalOutput(..., 'user_ended')` 를 부른다.

```json
{
  "config": { "mode": "multi_turn", "model": "gpt-4o", "maxTurns": 20 },
  "output": {
    "result": {
      "response": "마지막 assistant 응답",
      "endReason": "user_ended",
      "turnCount": 3,
      "messages": [ "..." ]
    }
  },
  "meta": {
    "durationMs": 0,
    "model": "gpt-4o",
    "interactionType": "ai_conversation",
    "inputTokens": 1200,
    "outputTokens": 400,
    "totalTokens": 1600,
    "toolCalls": 0,
    "ragSources": [],
    "turnDebug": [ "..." ]
  },
  "port": "user_ended",
  "status": "ended"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `output.result.endReason` | `"user_ended"` | 종료 사유 |
| `output.result.response` | string | 마지막 메시지(보통 assistant). 메시지가 없으면 빈 문자열 |
| `output.result.messages` | ChatMessage[] | 누적 대화 |
| `port` | `"user_ended"` | 시스템 포트 |

## 멀티턴 최대 턴 도달 (`max_turns`)

`turnCount >= maxTurns` 를 채우면 `processMultiTurnMessage` 가 직접 `buildMultiTurnFinalOutput(..., 'max_turns')` 를 부른다(`endMultiTurnConversation` 경유 아님).

```json
{
  "config": { "mode": "multi_turn", "model": "gpt-4o", "maxTurns": 20 },
  "output": {
    "result": {
      "response": "마지막 assistant 응답",
      "endReason": "max_turns",
      "turnCount": 20,
      "messages": [ "..." ]
    }
  },
  "meta": {
    "durationMs": 1800,
    "model": "gpt-4o",
    "interactionType": "ai_conversation",
    "inputTokens": 8000,
    "outputTokens": 2400,
    "totalTokens": 10400,
    "toolCalls": 4,
    "ragSources": [ "..." ],
    "ragDiagnostics": { "attempted": true, "searchedKbCount": 1, "queriesUsed": [ "..." ], "resultCount": 8 },
    "turnDebug": [ "..." ]
  },
  "port": "max_turns",
  "status": "ended"
}
```

`maxTurns=0`(무제한)이면 이 케이스는 없고 사용자 종료·조건 매칭·에러로만 끝난다.

## 멀티턴 에러 (`error`)

타임아웃, rate limit, LLM API 오류 등 모든 오류에 쓴다. 형태는 단일 턴 에러와 같고 `meta` 가 멀티턴 누적치를 싣는다.

```json
{
  "config": { "mode": "multi_turn", "model": "claude-sonnet-4", "maxTurns": 20 },
  "output": {
    "result": {
      "messages": [ "...(부분 누적 messages 배열)" ],
      "turnCount": 3
    },
    "error": {
      "code": "LLM_RATE_LIMIT",
      "message": "429 status code (no body)",
      "details": { "retryable": true, "retryAfterSec": 30 }
    }
  },
  "meta": {
    "durationMs": 850,
    "model": "claude-sonnet-4",
    "interactionType": "ai_conversation",
    "inputTokens": 6000,
    "outputTokens": 1500,
    "totalTokens": 7500,
    "toolCalls": 2,
    "ragSources": [],
    "turnDebug": [ "..." ]
  },
  "port": "error",
  "status": "ended",
  "_retryState": {
    "...": "(retryable === true 일 때만 싣는다. _resumeState 부분집합 + expiresAt)",
    "messages": [ "...(핸들러가 보관한 LLM 이력)" ],
    "turnCount": 3,
    "totalInputTokens": 6000,
    "totalOutputTokens": 1500,
    "expiresAt": "2026-05-23T08:42:31.123Z"
  }
}
```

**`details` 표준 필드** ([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 LLM 계열 필수 필드)

| 필드 | 타입 | 뜻 |
| --- | --- | --- |
| `retryable` | boolean (필수) | 일시적이라 같은 호출을 다시 하면 성공할 수 있는지. 분류 규칙은 [AI 에이전트 노드](CLE-NODE-AGENT.md) 의 에러 코드 절 |
| `retryAfterSec` | number? | provider 가 `Retry-After` 나 같은 뜻의 신호를 준 경우. `retryable === true` 일 때만 싣는다 |

멀티턴 에러의 `details` 도 단일 턴 에러와 같은 분류 함수(`extractAiTurnErrorPayload`)로 만든다. 에러 객체가 실은 `details`(민감값 제거) 위에 `retryable` 과 `retryAfterSec` 를 얹은 것이라 provider·statusCode 같은 키는 에러 객체에 있을 때만 들어간다.

**`_retryState`**: `retryable === true` 일 때만 싣는다. 형태는 입력 대기의 `_resumeState` 부분집합에 `expiresAt`(ISO 8601, TTL 기본 60분)을 더한 것이다. 자격 증명은 허용 목록 방식으로 애초에 뺀다. 표현식 resolver·자동완성에 노출하지 않는다(Principle 4.2, 4.2.1). `retryable === false` 면 `_retryState` 를 내지 않아 재시도에 들어갈 수 없다.

멀티턴 에러 종결에서도 부분 결과(`output.result` 의 `messages`·`turnCount` 등)와 `output.error` 가 함께 있을 수 있다. 에러인지는 `output.error` 가 있는지로 판단한다.

**마지막 턴 재시도 진입**: 사용자가 대화 스레드의 `system_error` 항목 오른쪽 [다시 시도] 버튼을 누르면 WS 명령 `execution.retry_last_turn` 이 나간다([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)). 백엔드는 `_retryState` 를 찾아 `expiresAt` 을 확인하고 새 NodeExecution 행을 만든 뒤, 마지막 턴에 한 번 다시 들어가(`processAiResumeTurn`, 턴 단위 park 모델) 마지막 사용자 메시지부터 LLM 을 다시 부른다. 워크플로우 [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) 과 다르며, 같은 실행 안의 노드 단위 재시도다.

**재진입 때 설정 표현식 재평가**: 재진입은 노드 설정의 `{{ expression }}` 을 최선으로 다시 평가해 조작 필드(`llmConfigId`·`maxTurns` 등)를 정상 dispatch 와 같은 값으로 맞춘다. rehydration 한 컨텍스트 기준이라 `$node`·`$var`·`$thread`·`$execution`·`$now` 는 풀리지만, 원본 nodeInput 은 영속하지 않아 `$input.*` 는 풀리지 않는다(알려진 한계). `_retryState` 는 턴 직전 `_resumeState` 스냅샷에서 나오고 실패 턴의 nodeInput 을 담지 않기 때문이다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 보존 예외). 재평가에 실패하면 원본 설정으로 안전하게 되돌아가 정적 설정은 영향이 없다. 표현식 해석 단계는 [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md) 이 정한다. `output.config` 에코는 재평가 결과가 아니라 원본 값을 유지한다.

**재진입 턴이 계속될 때**: 아래는 재진입 턴이 대화를 끝낼 때의 이야기다. 턴이 대화를 끝내지 않으면(멀티턴에서 가장 흔함) 다운스트림으로 가지 않고 `waiting_for_input` 으로 다시 park 하고 구간을 끝낸다. 다음 사용자 입력이 오면 일반 재개 경로로 합류한다. 상태 전이는 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 의 `failed → waiting_for_input`(`allowRetryReentry` opt-in) 행을 따른다.

**재진입 종결 뒤 그래프 진행**: 재진입 턴이 성공으로 끝나면 새로 만든 NodeExecution 은 일반 노드 `COMPLETED` 와 같이 출력 포트의 다운스트림으로 그래프 진행을 잇는다. 종결 규칙과 순회는 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md), [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) 를 따른다. 재진입 턴이 다시 실패하면 일반 노드 `FAILED` 와 같이 처리하고 실행도 `FAILED` 로 마감한다. 재시도 단위는 "마지막 LLM 호출 재진입" 까지이고, 그 결과의 다운스트림 처리와 종결 정책은 일반 노드와 같다. 워크플로우 재실행과의 차이는 "같은 실행 안 노드 단위 재진입" 이지 "다운스트림 차단" 이 아니다.
## Rationale

### 마지막 턴 재시도 성공 뒤 다운스트림으로 진행하는 이유

**문제**: 처음 구현은 `retry_last_turn` 으로 재진입한 턴이 성공해도 실행을 바로 `COMPLETED` 로 마감해, 그 AI 노드의 다운스트림 노드(예: HTTP Request, Send Email)가 실행되지 않았다. "노드 단위 재시도" 라는 표현은 워크플로우 [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) 과 구분(실행 단위 대 노드 단위)하려는 뜻이었지만, 일부 독자는 "다운스트림도 일부러 막는다" 로 읽을 수 있었다.

**결정**: 재시도가 성공하면 새로 만든 NodeExecution 은 일반 노드 `COMPLETED` 와 같이 다운스트림으로 진행한다. 재시도 단위는 "마지막 LLM 호출 재진입" 까지이고 그 결과의 순회·종결 정책은 일반 노드와 같다. 이는 "성공한 노드는 출력 포트 다운스트림으로 진행한다" 는 엔진 기본 불변식을 그대로 적용한 것이지 새 정책이 아니다.

**기각한 대안**

- 다운스트림도 막기(처음 구현 유지): 재시도로 대화를 살린 뒤 나머지 분기를 따로 재실행해야 한다. "한 노드만 살리고 나머지 흐름은 그대로" 라는 재시도의 목적과 맞지 않는다.
- 별도 `execution.retry_last_turn_and_resume` 명령으로 나누기: 사용자가 두 재시도를 골라야 하는 부담이 생긴다. 재시도의 본질은 늘 "그 노드를 살리고 워크플로우를 정상 진행" 이라 나눌 이유가 없다.

### 멀티턴 에러 예시도 구현에 맞춘다 (2026-11-05)

멀티턴 에러 예시도 단일 턴 에러와 같은 기준으로 구현 값에 맞췄다. 멀티턴도 같은 분류 함수(`extractAiTurnErrorPayload`)를 거치며, 이 함수는 `details` 위에 `retryable` · `retryAfterSec` 만 얹고 `provider` · `statusCode` 를 만들어 넣지 않는다. 2026-11-01 정리([단일 턴 §Rationale](CLE-NODE-AGENT-OUTPUT-SINGLE.md#rationale))가 단일 턴 절만 고쳐 멀티턴 예시에 두 키가 남아 있었다.

### AI 대화 경로도 재개 스냅샷을 낸다 (2026-11-12)

form · buttons 경로만 `resumed` 스냅샷을 내던 계약을 사람 결정으로 AI 에이전트와 정보 추출기의 대화 턴 경로에도 적용했다.

- 스냅샷은 엔진이 만든다. 직전 대기 스냅샷을 잇고 사용자 메시지와 `output.interaction` 만 바꾼다. 핸들러는 다음 턴을 처리하기 전이라 새 값이 없다. 그래서 핸들러를 고치지 않고 두 노드가 같은 코드를 쓴다.
- 시점은 LLM 호출 전이다. [정보 추출기 노드](CLE-NODE-EXTRACTOR.md) 는 「다음 `waiting_for_input` 직전」이라고 적었지만 그때는 LLM 응답이 이미 와 있어 대기 출력이 바로 덮는다. 사용자 입력을 받은 순간을 남기려면 LLM 호출 전이어야 한다.
- `receivedAt` 은 엔진이 한 번 만들어 이 스냅샷과 `execution.user_message` 에 함께 쓴다. 예전 문서는 둘을 따로 만든다고 보고 ms 차이를 허용했다.
- `meta` 는 직전 대기 값을 잇는다. LLM 호출 동안에도 누적 토큰과 `turnDebug` 가 남아 LLM 사용량 탭이 비지 않는다. `contextInjection` 은 대기 스냅샷처럼 싣지 않는다.
- `meta.interactionType` 만은 직전 값과 상관없이 `ai_conversation` 으로 둔다. `render_form` 대기(`ai_form_render`)에서 폼을 제출하면 그 턴은 폼 입력을 더는 기다리지 않는다.
- `render_form` 폼 제출 턴도 같은 재개 경로를 지나므로 `form_submitted` 스냅샷을 낸다. [AI 에이전트 노드](CLE-NODE-AGENT.md) 의 재개 단계가 채팅과 폼을 함께 적고 있어서다.
- 노드 실행 행의 `outputData` 에도 저장한다(사람 결정). 메모리 캐시에만 실으면 LLM 응답이 곧 덮어 어디에서도 보이지 않는다.
- 저장하면 LLM 호출 동안 행 상태는 `running`, 출력 상태는 `resumed` 다. REST 대기 정규화(`reconcilePreParkWaitingStatus`)와 프런트 대기 판정(`isNodeWaitingForInput`)이 이 조합을 대기로 보지 않으면 실행 상세의 2초 폴링이 대화 화면을 비운다. 그래서 두 판정을 `meta.interactionType` 이 `ai_conversation` 인 재개 스냅샷까지 함께 넓혔다(사람 결정, [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md)).
- 저장본에는 체크포인트 대상 노드면 `_resumeCheckpoint` 를 싣는다. 직전 대기와 같은 재개 상태로 만들므로 LLM 호출 중 서버가 재시작해도 재개 체크포인트가 남는다.
- 저장은 행 상태가 `running` 이나 `waiting_for_input` 일 때만 하는 조건부 갱신이다. 엔티티를 통째로 저장하면 메모리에 있던 낡은 상태까지 써서 그사이 들어온 취소를 덮는다.
- 엔진은 저장을 마친 뒤 LLM 을 부른다. 기다리지 않으면 늦게 끝난 이 저장이 턴 끝의 대기 저장을 덮을 수 있다.
