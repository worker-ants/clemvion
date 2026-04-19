# AI Agent (`ai_agent`) — Output 일관성 개선안

- **카테고리**: `ai`
- **현재 스펙**: [`user_memo/node-specs/ai/ai_agent.md`](../../node-specs/ai/ai_agent.md)
- **공통 규칙**: [`CONVENTIONS.md`](../CONVENTIONS.md)
- **우선순위**: P0 (AI 카테고리 내 **가장 큰 브레이킹 서피스**를 가진 노드)

> AI Agent는 mode(`single_turn` / `multi_turn`)와 `conditions` 배열에 따라 **5개의 서로 다른 output shape**을 방출합니다. 각 shape이 서로 다른 네이밍/중첩/메트릭 위치를 사용하고 있어 `$node["<label>"].output.*` 경로가 case별로 달라지는, CONVENTIONS 위반이 **가장 복합적**으로 누적된 노드입니다.

---

## 1. 현재 Output 구조 요약

아래 JSON은 `user_memo/node-specs/ai/ai_agent.md`의 현행 contract를 `NodeHandlerOutput` 5-필드 관점에서 재조립한 것입니다(핸들러는 bare 객체를 반환하지만, adapter가 `output`으로 promote하므로 워크플로우 작성자 관점에서는 아래와 같은 모양으로 소비됩니다).

### Case 1: Single Turn 정상 완료

```json
{
  "config": { "mode": "single_turn", "model": "gpt-4o", "systemPrompt": "...", "conditions": [] },
  "output": {
    "response": "Hello! How can I help you?",
    "metadata": {
      "model": "gpt-4o",
      "inputTokens": 124,
      "outputTokens": 45,
      "totalTokens": 169,
      "thinkingTokens": 0,
      "toolCalls": 0,
      "ragSources": []
    },
    "_turnDebugHistory": [ { "turnIndex": 1, "llmCalls": [ ... ], "totalDurationMs": 1234 } ]
  },
  "port": "out"
}
```

### Case 2: Condition 매칭 (single 또는 multi에서 finalize)

```json
{
  "config": { "mode": "single_turn", "conditions": [{ "id": "refund_request", "label": "Refund Request", "prompt": "..." }] },
  "output": {
    "port": "refund_request",
    "data": {
      "interactionType": "ai_conversation",
      "response": "환불 요청을 확인했습니다",
      "messages": [ { "role": "user", "content": "I want a refund" }, { "role": "assistant", "content": "..." } ],
      "turnCount": 1,
      "endReason": "condition",
      "condition": { "id": "refund_request", "label": "Refund Request", "reason": "사용자가 환불을 명시적으로 요청함" },
      "metadata": {
        "model": "gpt-4o",
        "totalInputTokens": 200,
        "totalOutputTokens": 80,
        "totalTokens": 280,
        "thinkingTokens": 0,
        "toolCalls": 0,
        "ragSources": []
      },
      "_turnDebugHistory": [ ... ]
    }
  },
  "port": "refund_request"
}
```

> `output.port` 가 `output` 내부에도, `NodeHandlerOutput.port` 로도 중복 등장. 실제 본 데이터는 `output.data.*` 로 한 단계 더 깊게 묻혀 있음.

### Case 3: Multi-Turn 대기 (`status: "waiting_for_input"`)

```json
{
  "config": { "mode": "multi_turn", "maxTurns": 20, "maxToolCalls": 10 },
  "output": {
    "type": "ai_conversation",
    "status": "waiting_for_input",
    "interactionType": "ai_conversation",
    "conversationConfig": {
      "message": "안녕하세요, 무엇을 도와드릴까요?",
      "messages": [ { "role": "system", "content": "..." }, { "role": "assistant", "content": "..." } ],
      "turnCount": 1,
      "maxTurns": 20
    },
    "_multiTurnState": {
      "llmConfigId": "cfg-1",
      "model": "gpt-4o",
      "temperature": 0.7,
      "messages": [ ... ],
      "turnCount": 1,
      "totalInputTokens": 100,
      "totalOutputTokens": 30,
      "totalThinkingTokens": 0,
      "toolCalls": 0,
      "ragSources": [],
      "turnDebugHistory": [ ... ]
    }
  },
  "status": "waiting_for_input"
}
```

### Case 4: Multi-Turn 종료 (`user_ended` / `max_turns`)

```json
{
  "config": { "mode": "multi_turn", "maxTurns": 20 },
  "output": {
    "interactionType": "ai_conversation",
    "response": "마지막 assistant 응답",
    "messages": [ ... ],
    "turnCount": 5,
    "endReason": "max_turns",
    "metadata": {
      "model": "gpt-4o",
      "totalInputTokens": 1000,
      "totalOutputTokens": 400,
      "totalTokens": 1400,
      "thinkingTokens": 0,
      "toolCalls": 2,
      "ragSources": []
    },
    "_turnDebugHistory": [ ... ]
  },
  "port": "max_turns"
}
```

### Case 5: 에러 (LLM 예외)

핸들러 내부에 try/catch가 없어, **현재는 workflow engine이 exception을 catch해서 `error` 포트로 라우팅**합니다. `output.error` 표준 shape이 정의되어 있지 않습니다.

```json
{
  "output": {},
  "port": "error"
}
```

---

## 2. 식별된 불일치

| # | 위반 내용 | 관련 Principle | 심각도 |
| --- | --- | --- | --- |
| I1 | `output.response` (Case 1, 4) vs `output.data.response` (Case 2) — 같은 "LLM 응답 텍스트" 개념이 case별로 다른 경로 | **P8 (중첩 제거)**, P11 (문서화) | Critical |
| I2 | `output.port` 가 `output` 내부 필드로 존재 (Case 2) — `NodeHandlerOutput.port` 와 중복이며 `output` 은 도메인 데이터만 담아야 함 | **P5 (port 활성화 모델)**, P1, P8 | Critical |
| I3 | `output.metadata.{model, inputTokens, outputTokens, totalTokens, thinkingTokens, toolCalls, ragSources}` — 실행 메트릭이 `output` 하위에 있음 | **P2 (meta는 메트릭만)**, P1 | Critical |
| I4 | Case 2의 `output.data.metadata.totalInputTokens` / `totalOutputTokens` vs Case 1의 `output.metadata.inputTokens` / `outputTokens` — 누적 여부 prefix(`total`) 유무가 일관되지 않음 | P8, P11 | High |
| I5 | Multi-turn 대기 시 `_multiTurnState` 필드명이 다른 blocking 노드(`form`, `carousel`)의 `_resumeState` 제안과 맞지 않음 | **P4 (재개 contract 통일)** | High |
| I6 | Multi-turn 대기 시 `output.conversationConfig.*` 안에 `maxTurns` 같은 **리터럴 config** 이 echo 되고 있음 — config 는 `config` 에만 두어야 함 | **P1.1 (config↔output 직교성)**, P4.3 | High |
| I7 | Multi-turn 재개 후에도 `status: 'waiting_for_input'` 이 다시 반환되어 `resumed` 상태를 별도로 관찰할 수 없음 (사용자 메시지 수신 사실이 interaction payload로 노출되지 않음) | **P4.1** | High |
| I8 | `output.interactionType: 'ai_conversation'` 문자열이 Case 2/3/4 모두에 중복 — 노드 타입은 워크플로우 정의에서 식별되므로 불필요 판별자 | **P1.1.4 (판별자 금지)**, P8 | Medium |
| I9 | Case 5 에러에 `output.error.{code, message}` 표준 shape이 없음 | **P3.2 (에러 표준)** | High |
| I10 | `_turnDebugHistory` 가 `output` 에 있음 — 디버그 정보는 `meta.logs` 또는 `meta.turnDebug` 가 적절 | P2 | Medium |
| I11 | Case 2 `output.data.condition.reason` vs (미존재) single 종료 시 "왜 이 포트로 갔는가" 정보가 비대칭 | P8 | Low |
| I12 | `config.systemPrompt` echo 시 sanitize/size 제약이 문서화되지 않음 | **P7 (config echo)** | Low |

---

## 3. 제안된 Output 구조

**원칙**: "LLM 계열 노드는 `output.result` 아래에 도메인 결과를 모은다" (Principle 8). 모든 종료 case가 `output.result.response` 를 1차 응답 필드로 사용합니다.

**블로킹 대기 시 원칙** (Principle 1.1, 4.3): `output` 에는 **이 실행 시점에 계산된 런타임 값만** 담습니다. `maxTurns`, `maxToolCalls`, `systemPrompt`, `conditions` 등의 **리터럴 config 값은 echo 하지 않으며**, 후속 노드가 필요로 하면 `$node["X"].config.*` 으로 직접 참조합니다. `output.view` 래퍼 및 `view.type` 판별자는 **사용하지 않습니다**.

### Case 1 (After): Single Turn 정상 완료

```json
{
  "config": {
    "mode": "single_turn",
    "model": "gpt-4o",
    "systemPrompt": "...",
    "conditions": [],
    "responseFormat": "text"
  },
  "output": {
    "result": {
      "response": "Hello! How can I help you?",
      "endReason": "out",
      "turnCount": 1,
      "ragSources": []
    }
  },
  "meta": {
    "durationMs": 1234,
    "model": "gpt-4o",
    "inputTokens": 124,
    "outputTokens": 45,
    "totalTokens": 169,
    "thinkingTokens": 0,
    "toolCalls": 0,
    "turnDebug": [ { "turnIndex": 1, "llmCalls": [...], "totalDurationMs": 1234 } ]
  },
  "port": "out",
  "status": "ended"
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `output.result.response` | string | LLM 최종 응답 텍스트 |
| `output.result.endReason` | `"out"` | single turn 의 정상 종료 이유 |
| `output.result.turnCount` | number | single 은 항상 `1` |
| `output.result.ragSources` | `{chunkId, score, excerpt?}[]` | RAG 참조 출처 (후속 노드가 "출처 표시" 용으로 소비 가능) |

핵심 변화:
- `output.response` → `output.result.response` (P8, P1).
- `output.metadata.*` → `meta.*` (P2).
- `output.metadata.ragSources` → `output.result.ragSources` (비즈니스 데이터, 후속 노드가 참조 가능, P1).
- `_turnDebugHistory` → `meta.turnDebug` (P2).
- `status: 'ended'` 를 명시해 "흐름이 성공 종료됨"을 통일 (P0, P4).

### Case 2 (After): Condition 매칭

```json
{
  "config": {
    "mode": "single_turn",
    "conditions": [
      { "id": "refund_request", "label": "Refund Request", "prompt": "..." }
    ]
  },
  "output": {
    "result": {
      "response": "환불 요청을 확인했습니다",
      "endReason": "condition",
      "turnCount": 1,
      "condition": {
        "id": "refund_request",
        "label": "Refund Request",
        "reason": "사용자가 환불을 명시적으로 요청함"
      },
      "messages": [ { "role": "user", "content": "..." }, { "role": "assistant", "content": "..." } ],
      "ragSources": []
    }
  },
  "meta": {
    "durationMs": 2345,
    "model": "gpt-4o",
    "inputTokens": 200,
    "outputTokens": 80,
    "totalTokens": 280,
    "thinkingTokens": 0,
    "toolCalls": 0,
    "turnDebug": [ ... ]
  },
  "port": "refund_request",
  "status": "ended"
}
```

핵심 변화:
- `output.data.*` 한 단계 중첩 제거 → `output.result.*` (P8).
- `output.port` (본 객체 내부) 완전 제거 — 엔진은 `NodeHandlerOutput.port` 만 본다 (P5).
- `output.data.metadata.{totalInputTokens, totalOutputTokens, totalTokens}` → `meta.{inputTokens, outputTokens, totalTokens}`. 누적이든 단일 호출이든 LLM 계열 노드의 토큰 네이밍은 `inputTokens/outputTokens/totalTokens` 로 통일 (P2, P8, I4 해결).
- Single turn과 condition 종료가 `output.result.response` 로 동일 경로를 공유 (I1 해결).
- `endReason` 을 Single/Condition/Multi-turn 모두에서 통일 (`'out' | 'condition' | 'user_ended' | 'max_turns' | 'error'`).

### Case 3 (After): Multi-Turn 대기 (`status: "waiting_for_input"`)

```json
{
  "config": {
    "mode": "multi_turn",
    "model": "gpt-4o",
    "systemPrompt": "...",
    "maxTurns": 20,
    "maxToolCalls": 10,
    "conditions": []
  },
  "output": {
    "messages": [
      { "role": "assistant", "content": "안녕하세요, 무엇을 도와드릴까요?" }
    ]
  },
  "meta": {
    "durationMs": 1500,
    "model": "gpt-4o",
    "inputTokens": 100,
    "outputTokens": 30,
    "totalTokens": 130,
    "thinkingTokens": 0,
    "toolCalls": 0,
    "turnDebug": [ { "turnIndex": 1, "llmCalls": [...], "totalDurationMs": 1500 } ]
  },
  "status": "waiting_for_input",
  "_resumeState": {
    "llmConfigId": "cfg-1",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 2048,
    "workspaceId": "ws-1",
    "knowledgeBases": [],
    "ragTopK": 5,
    "ragThreshold": 0.7,
    "maxToolCalls": 10,
    "maxTurns": 20,
    "toolNodeIds": [],
    "toolOverrides": [],
    "conditions": [],
    "messages": [ ... ],
    "turnCount": 1,
    "totalInputTokens": 100,
    "totalOutputTokens": 30,
    "totalThinkingTokens": 0,
    "toolCalls": 0,
    "ragSources": [],
    "lastTurnDurationMs": 1500,
    "turnDebugHistory": [ ... ]
  }
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `output.messages` | `ChatMessage[]` | **런타임 누적 대화** (system 메시지 제외, assistant/user/tool 메시지만). 대기 시점까지 쌓인 스냅샷. |
| `_resumeState` | object | 엔진이 다음 턴을 처리하기 위해 보관하는 **internal state**. `NodeHandlerOutput` 의 top-level 필드이지만 expression autocomplete/resolver 에서는 노출하지 않음. |

핵심 변화:
- `output.type: 'ai_conversation'`, `output.interactionType`, `output.conversationConfig` 전부 제거. `output.view` 래퍼/`view.type` 판별자도 도입하지 않음 (P1.1, P1.1.4, I6, I8 해결).
- `output.messages` 만 런타임 필드로 남김. `maxTurns` 같은 리터럴 config 는 echo 하지 않음 (후속 노드는 `$node["X"].config.maxTurns` 참조).
- 현재 턴의 마지막 assistant 발화는 `output.messages[-1].content` 로 직접 접근 가능.
- `_multiTurnState` → `_resumeState` (P4.2). top-level 필드로 올리되 expression 레이어에서는 숨김 처리.
- `status: 'waiting_for_input'` 은 top-level 에만. `output.status` 중복 제거 (P0).

### Case 3b (After): Multi-Turn 재개 (`status: "resumed"`)

사용자 메시지를 받아 엔진이 `processMultiTurnMessage(userMessage, _resumeState)` 를 호출해 다음 턴을 시작하면, **종료 조건에 도달하지 않은 경우** 다시 대기로 돌아가기 전에 한 번 `resumed` 스냅샷을 방출합니다. 이 스냅샷은 `messages` + `interaction` 이 함께 포함되어 "사용자 입력이 수신되었음" 을 후속 observability 단계(예: timeline)에서 관찰 가능하게 합니다.

```json
{
  "config": { "mode": "multi_turn", "model": "gpt-4o", "maxTurns": 20 },
  "output": {
    "messages": [ ... ],
    "interaction": {
      "type": "message_received",
      "data": { "content": "환불 문의입니다", "role": "user" },
      "receivedAt": "2026-04-19T06:42:01.123Z"
    }
  },
  "meta": { "durationMs": 0, "turnDebug": [] },
  "status": "resumed",
  "_resumeState": { ... }
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `output.messages` | `ChatMessage[]` | 사용자 메시지가 append 된 직후의 누적 대화 (모델 응답은 아직 없음, 또는 append 된 직후) |
| `output.interaction.type` | `"message_received"` | interaction 종류 (Principle 4.5) |
| `output.interaction.data.content` | string | 사용자가 입력한 메시지 본문 |
| `output.interaction.data.role` | `"user"` | 고정값 |
| `output.interaction.receivedAt` | ISO8601 string | 수신 시각 |

> `resumed` 는 **순간 상태**(transient)입니다. 엔진은 곧바로 다음 턴 처리를 이어가 `waiting_for_input` / `ended` 중 하나로 수렴합니다. 이 순간 스냅샷은 run history/timeline 에만 기록되고, 후속 엣지 라우팅은 발생하지 않습니다 (I7 해결).

### Case 4 (After): Multi-Turn 종료

```json
{
  "config": { "mode": "multi_turn", "model": "gpt-4o", "maxTurns": 20 },
  "output": {
    "result": {
      "response": "마지막 assistant 응답",
      "endReason": "max_turns",
      "turnCount": 5,
      "messages": [ ... ],
      "ragSources": []
    }
  },
  "meta": {
    "durationMs": 12800,
    "model": "gpt-4o",
    "inputTokens": 1000,
    "outputTokens": 400,
    "totalTokens": 1400,
    "thinkingTokens": 0,
    "toolCalls": 2,
    "turnDebug": [ ... ]
  },
  "port": "max_turns",
  "status": "ended"
}
```

핵심 변화:
- 최종 종료 shape이 Case 1과 동일한 1차 네이밍(`output.result.response`, `output.result.endReason`, `output.result.turnCount`) 사용 (I1 해결).
- `output.interactionType` 제거 (I8).
- `port` 는 여전히 `user_ended` / `max_turns` / condition id 로 라우팅. condition 종료는 Case 2로 수렴 (`port: <condId>`, `endReason: 'condition'`).

### Case 5 (After): 에러

```json
{
  "config": { "mode": "single_turn", "model": "gpt-4o" },
  "output": {
    "error": {
      "code": "LLM_CALL_FAILED",
      "message": "OpenAI API returned 503 after 3 retries",
      "details": { "provider": "openai", "statusCode": 503, "attempt": 3 }
    }
  },
  "meta": {
    "durationMs": 15230,
    "model": "gpt-4o",
    "turnDebug": [ { "turnIndex": 1, "llmCalls": [...] } ]
  },
  "port": "error",
  "status": "ended"
}
```

`code` 값 가이드:
- `LLM_CALL_FAILED` — provider 호출 실패(HTTP 5xx, 타임아웃, 네트워크).
- `LLM_RATE_LIMITED` — 429.
- `LLM_RESPONSE_INVALID` — JSON 파싱 실패 (responseFormat=json 인 경우).
- `TOOL_EXECUTION_FAILED` — 연결된 tool node 실행 중 예외.
- `MAX_TOOL_CALLS_EXCEEDED` — `maxToolCalls` 초과로 강제 종료(현재 throw 대신 `error` 포트로 통일 권장).

---

## 4. 마이그레이션 영향도

### 4.1. Expression 경로 비교표

노드 라벨 `Support Bot` 기준, 현재 → 개선 후의 **모든** 변경 경로를 case별로 열거합니다.

#### Single Turn 완료

| 현재 | 개선 후 | 비고 |
| --- | --- | --- |
| `$node["Support Bot"].output.response` | `$node["Support Bot"].output.result.response` | P8 |
| `$node["Support Bot"].output.metadata.model` | `$node["Support Bot"].meta.model` | P2 |
| `$node["Support Bot"].output.metadata.inputTokens` | `$node["Support Bot"].meta.inputTokens` | P2 |
| `$node["Support Bot"].output.metadata.outputTokens` | `$node["Support Bot"].meta.outputTokens` | P2 |
| `$node["Support Bot"].output.metadata.totalTokens` | `$node["Support Bot"].meta.totalTokens` | P2 |
| `$node["Support Bot"].output.metadata.thinkingTokens` | `$node["Support Bot"].meta.thinkingTokens` | P2 |
| `$node["Support Bot"].output.metadata.toolCalls` | `$node["Support Bot"].meta.toolCalls` | P2 |
| `$node["Support Bot"].output.metadata.ragSources` | `$node["Support Bot"].output.result.ragSources` | 비즈니스 데이터 (P1) |
| `$node["Support Bot"].output._turnDebugHistory` | `$node["Support Bot"].meta.turnDebug` | P2 |
| (없음) | `$node["Support Bot"].output.result.endReason` | 신설 — `'out'` |
| (없음) | `$node["Support Bot"].output.result.turnCount` | 신설 — single은 `1` |
| (없음) | `$node["Support Bot"].status` | 신설 — `'ended'` |

#### Condition 매칭

| 현재 | 개선 후 | 비고 |
| --- | --- | --- |
| `$node["Support Bot"].port` | `$node["Support Bot"].port` | (불변) condition id |
| `$node["Support Bot"].output.port` | — | **삭제** (P5) |
| `$node["Support Bot"].output.data.response` | `$node["Support Bot"].output.result.response` | P8 (한 단계 + 네이밍 통일) |
| `$node["Support Bot"].output.data.endReason` | `$node["Support Bot"].output.result.endReason` | P8 |
| `$node["Support Bot"].output.data.turnCount` | `$node["Support Bot"].output.result.turnCount` | P8 |
| `$node["Support Bot"].output.data.messages` | `$node["Support Bot"].output.result.messages` | P8 |
| `$node["Support Bot"].output.data.condition.id` | `$node["Support Bot"].output.result.condition.id` | P8 |
| `$node["Support Bot"].output.data.condition.label` | `$node["Support Bot"].output.result.condition.label` | P8 |
| `$node["Support Bot"].output.data.condition.reason` | `$node["Support Bot"].output.result.condition.reason` | P8 |
| `$node["Support Bot"].output.data.metadata.totalInputTokens` | `$node["Support Bot"].meta.inputTokens` | P2 + 네이밍 통일 (`total` prefix 제거) |
| `$node["Support Bot"].output.data.metadata.totalOutputTokens` | `$node["Support Bot"].meta.outputTokens` | P2 |
| `$node["Support Bot"].output.data.metadata.totalTokens` | `$node["Support Bot"].meta.totalTokens` | P2 |
| `$node["Support Bot"].output.data.metadata.toolCalls` | `$node["Support Bot"].meta.toolCalls` | P2 |
| `$node["Support Bot"].output.data.metadata.ragSources` | `$node["Support Bot"].output.result.ragSources` | P1 |
| `$node["Support Bot"].output.data._turnDebugHistory` | `$node["Support Bot"].meta.turnDebug` | P2 |
| `$node["Support Bot"].output.data.interactionType` | — | **삭제** (I8) |

#### Multi-Turn 대기

| 현재 | 개선 후 | 비고 |
| --- | --- | --- |
| `$node["Support Bot"].status` | `$node["Support Bot"].status` | (불변) `'waiting_for_input'` |
| `$node["Support Bot"].output.status` | — | **삭제** (top-level과 중복, P0) |
| `$node["Support Bot"].output.type` | — | **삭제** (판별자 불필요, P1.1.4) |
| `$node["Support Bot"].output.interactionType` | — | **삭제** (판별자 불필요) |
| `$node["Support Bot"].output.conversationConfig.message` | `$node["Support Bot"].output.messages[-1].content` | 마지막 assistant 메시지로 직접 접근 |
| `$node["Support Bot"].output.conversationConfig.messages` | `$node["Support Bot"].output.messages` | P1.1 (런타임 필드 직접 배치) |
| `$node["Support Bot"].output.conversationConfig.turnCount` | `$node["Support Bot"].output.messages.length` (또는 `_resumeState.turnCount`) | 런타임 파생값 — config 리터럴이 아님에도 output 에 echo 하던 것을 제거. 필요 시 messages 길이로 재계산 가능. |
| `$node["Support Bot"].output.conversationConfig.maxTurns` | `$node["Support Bot"].config.maxTurns` | **P1.1** — 리터럴 config 는 config 만 참조 |
| `$node["Support Bot"].output._multiTurnState.*` | (expression 비노출) `_resumeState.*` | P4.2 — expression autocomplete에서 제외 |

> **중요**: 대기 상태에서 후속 노드(주로 presentation/UI 렌더러) 가 `maxTurns`, `maxToolCalls`, `systemPrompt` 등 **사용자 설정값**을 필요로 할 경우 `$node["Support Bot"].config.maxTurns` 처럼 `config` 경로를 사용합니다. 이전 초안이 제안했던 `output.view.maxTurns` 경로는 **폐기**되었습니다 (Principle 1.1).

#### Multi-Turn 재개 (신설)

| 현재 | 개선 후 | 비고 |
| --- | --- | --- |
| (없음) | `$node["Support Bot"].status` = `'resumed'` | 신설 |
| (없음) | `$node["Support Bot"].output.messages` | 신설 — 대기 시점 messages + 사용자 입력 append |
| (없음) | `$node["Support Bot"].output.interaction.type` = `'message_received'` | 신설 |
| (없음) | `$node["Support Bot"].output.interaction.data.content` | 신설 (사용자 메시지 본문) |
| (없음) | `$node["Support Bot"].output.interaction.data.role` = `'user'` | 신설 |
| (없음) | `$node["Support Bot"].output.interaction.receivedAt` | 신설 |

> `resumed` 스냅샷은 **run history/timeline** 전용입니다. 워크플로우 그래프 상의 다음 엣지로 라우팅되지 않으므로 일반적인 후속 expression 참조 대상이 아닙니다.

#### Multi-Turn 종료

| 현재 | 개선 후 | 비고 |
| --- | --- | --- |
| `$node["Support Bot"].port` | `$node["Support Bot"].port` | (불변) `user_ended` / `max_turns` / condId |
| `$node["Support Bot"].output.response` | `$node["Support Bot"].output.result.response` | P8 |
| `$node["Support Bot"].output.endReason` | `$node["Support Bot"].output.result.endReason` | P8 |
| `$node["Support Bot"].output.turnCount` | `$node["Support Bot"].output.result.turnCount` | P8 |
| `$node["Support Bot"].output.messages` | `$node["Support Bot"].output.result.messages` | P8 |
| `$node["Support Bot"].output.interactionType` | — | **삭제** |
| `$node["Support Bot"].output.metadata.totalInputTokens` | `$node["Support Bot"].meta.inputTokens` | P2 |
| `$node["Support Bot"].output.metadata.totalOutputTokens` | `$node["Support Bot"].meta.outputTokens` | P2 |
| `$node["Support Bot"].output.metadata.totalTokens` | `$node["Support Bot"].meta.totalTokens` | P2 |
| `$node["Support Bot"].output.metadata.toolCalls` | `$node["Support Bot"].meta.toolCalls` | P2 |
| `$node["Support Bot"].output.metadata.ragSources` | `$node["Support Bot"].output.result.ragSources` | P1 |
| `$node["Support Bot"].output._turnDebugHistory` | `$node["Support Bot"].meta.turnDebug` | P2 |
| (없음) | `$node["Support Bot"].status` = `'ended'` | 신설 |

#### Error

| 현재 | 개선 후 | 비고 |
| --- | --- | --- |
| (표준 shape 없음) | `$node["Support Bot"].output.error.code` | 신설 (P3.2) |
| (표준 shape 없음) | `$node["Support Bot"].output.error.message` | 신설 |
| (표준 shape 없음) | `$node["Support Bot"].output.error.details` | 신설 (선택) |
| `$node["Support Bot"].port` | `$node["Support Bot"].port` | (불변) `'error'` |

### 4.2. 영향 범위 요약

- **Breaking change 규모**: 개선 대상 경로 **40+개**. AI Agent 단독으로 workflow 예제 & 사용자 자동완성의 가장 큰 마이그레이션 서피스.
- **영향받는 프런트엔드 코드**:
  - `resolve-dynamic-ports.ts` (port 로직은 불변, output shape만).
  - autocomplete schema (`backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` 의 schema 주석) — output path 재설계 필요. 대기 상태에서 노출되는 런타임 필드는 `output.messages` 단 하나.
  - Run history timeline 렌더러 — `_multiTurnState` / `_resumeState` 필드명 변경 반영. 대기 UI 가 표시하던 `maxTurns` 등은 `config.maxTurns` 에서 취득.
  - LLM Information Tab — `_turnDebugHistory` / `_turnDebug` → `meta.turnDebug` 로 소스 변경.
- **영향받는 백엔드 코드**:
  - `ai-agent.handler.ts` — `execute()` / `processMultiTurnMessage()` / `buildMultiTurnFinalOutput()` / `endMultiTurnConversation()` 모두 반환 shape 변경.
  - handler-output adapter — `ai_agent` 특수 분기(conditional shape promote) **제거** (adapter 단순화 효과).

### 4.3. 하위호환(backward-compat) 전략

breaking surface가 크므로 **1 릴리스 동안 shim alias** 를 적용한 뒤 다음 릴리스에서 alias 제거를 권장합니다.

1. **Shim 배포 릴리스 (v1)** — 핸들러 반환값을 **개선 후 shape으로 재구성**하되, expression resolver 레벨에서 legacy path → new path alias를 주입.
   - `output.response` 접근 시 내부적으로 `output.result.response` 를 반환.
   - `output.metadata.*` 접근 시 `meta.*` 로 위임.
   - `output.data.*` 접근 시 `output.result.*` 로 위임.
   - `output.port` 접근 시 top-level `port` 반환.
   - `output.conversationConfig.messages` → `output.messages`, `output.conversationConfig.maxTurns` → `config.maxTurns` 위임.
   - 사용자 콘솔에 **1회 deprecation warning** 표시 (brand color + path before/after 제시).
2. **Migration CLI (v1)** — `pnpm workflow:migrate-ai-agent` 명령으로 기존 workflow JSON 파일을 새 expression 경로로 일괄 변환.
3. **Deprecation 제거 릴리스 (v2)** — shim 제거. legacy path 접근 시 autocomplete에서 숨김 처리 + runtime `undefined` 반환.

현재 `ai_agent` 만으로도 최소 2개 마이너 릴리스(또는 LTS 주기)를 기다려야 할 만큼 impact 가 큽니다.

---

## 5. 근거

### 5.1. CONVENTIONS와의 매핑

| Principle | 본 개선안이 해결하는 내용 |
| --- | --- |
| **P0** (5필드 invariant) | `status` / `port` / `meta` / `output` 이 case별 shape이 아닌 **공통 5필드** 의미로 통일. `output.status`, `output.port` 같은 중복 제거. |
| **P1** (output은 비즈니스 데이터) | LLM 실행 토큰/모델/디버그 이력이 모두 `output` 에서 `meta` 로 이동. 후속 노드는 순수 도메인 데이터(`output.result.response` 등)만 참조. |
| **P1.1** (config↔output 직교성) | 대기 상태에서 `maxTurns`, `maxToolCalls`, `systemPrompt`, `conditions`, `model` 등 **리터럴 config 값을 `output` 에 복사하지 않음**. 런타임 값인 `messages` 만 `output` 에 둠. 후속 노드/UI 는 config 값은 `config` 경로에서 직접 참조. |
| **P1.1.4** (판별자 금지) | `output.type: 'ai_conversation'`, `output.interactionType`, `output.view.type = 'chat'` 등 노드 식별용 판별자 전부 폐기. 노드 타입은 워크플로우 정의에서 이미 식별됨. |
| **P2** (meta는 실행 메트릭) | `output.metadata.*` 완전 폐지. `meta.{model, inputTokens, outputTokens, totalTokens, thinkingTokens, toolCalls, turnDebug, durationMs}` 로 통일. |
| **P3** (에러 컨트랙트) | Case 5의 `output.error.{code, message, details}` 표준 도입. `LLM_CALL_FAILED` / `LLM_RATE_LIMITED` / `LLM_RESPONSE_INVALID` / `TOOL_EXECUTION_FAILED` / `MAX_TOOL_CALLS_EXCEEDED` 예약어 제안. |
| **P4** (재개 contract) | `_multiTurnState` → `_resumeState`, `output.conversationConfig` 제거, `resumed` 상태 신설. `form` / `carousel` / `chart` / `table` / `template` / `information_extractor` 와 동일 모양 (공통 `interaction` 서브구조). |
| **P4.3** (waiting output 내용) | 대기 시 `output` 은 런타임 값(`messages`)만 담고 config 리터럴은 제외. |
| **P4.4/4.5** (resumed output & interaction) | 재개 시 `output.messages` + `output.interaction.{type:'message_received', data:{content, role:'user'}, receivedAt}` 공통 규격 준수. |
| **P5** (port 활성화) | `output.port` 제거. 엔진은 오직 `NodeHandlerOutput.port` 만 참조. condition 매칭 포트 ID 는 사용자 정의 `condition.id` 예약어 검증(P6) 유지. |
| **P6** (동적 포트 네이밍) | 시스템 예약어(`out`, `error`, `user_ended`, `max_turns`, `completed`, `fallback`) 와 사용자 `condition.id` 충돌 검증을 프런트 validate에 추가. |
| **P7** (config echo) | `config.systemPrompt` 는 크기 제한 없이 echo(디버깅 우선). `config.maxTurns`/`config.maxToolCalls`/`config.conditions`/`config.model` 모두 echo (후속 노드가 참조 가능). 단 `config.llmConfigId` 가 가리키는 provider credential 은 절대 echo 금지(이미 상위 레이어에서 보장). |
| **P8** (중첩 제거) | `output.data.*`, `output.metadata.*`, `output.interactionType`, `output.conversationConfig`, `output.view` 래퍼 모두 제거/이동. 단일 진입점 `output.result.*` (종료) 또는 `output.messages` + `output.interaction` (대기/재개). |
| **P11** (문서화) | 이 문서의 Case 1~5 JSON + 경로 표가 향후 node-specs/ai/ai_agent.md 의 표준 포맷이 됩니다. |

### 5.2. 디자인 결정 배경

- **`output.result` 를 "결과 wrapper"로 선택한 이유**: `output.response` 를 `output` 직하에 두는 안도 가능하지만, 그 경우 `output.endReason` / `output.turnCount` / `output.messages` / `output.condition` 등 부가 필드가 모두 루트에 펼쳐져 P1 위반("비즈니스 데이터만") 이 애매해집니다. `output.result.*` 하나로 묶으면 **도메인 결과 컨테이너**임이 이름으로 드러나고, `information_extractor` / `text_classifier` 와 동일 규약을 공유할 수 있어 **"LLM 계열 노드는 `output.result` 를 본다"** 한 문장으로 모든 노드가 커버됩니다.
- **대기 상태에서 `output.view` 래퍼를 쓰지 않는 이유**: 초기 초안은 `output.view = { type:'chat', messages, maxTurns, ... }` 를 제안했으나, Principle 1.1 에 따라 **리터럴 config(`maxTurns`, `type` 판별자) 를 output 에 echo 할 수 없습니다**. 그 결과 view 안에 남는 필드는 `messages` 뿐이므로 **wrapper 자체가 불필요**합니다. `output.messages` 로 직접 노출하는 것이 자연스럽고, 대기 UI 가 추가 설정값을 필요로 할 경우 `config` 경로를 사용합니다.
- **`resumed` 를 transient 상태로 두는 이유**: `message_received` 이벤트를 **라우팅 가능한 상태**로 승격하면 워크플로우 그래프에 "사용자 입력 이벤트 포트" 가 필요해지고, 대화가 길어질수록 그래프 복잡도가 폭발적으로 증가합니다. 현실적으로 필요한 건 **run history timeline** 에서 "여기에 사용자 메시지가 들어왔다" 는 observability 정보뿐이므로 transient 스냅샷으로 충분합니다 (다른 blocking 노드 `form`/`carousel` 도 동일 설계).
- **`_resumeState` 을 internal 필드로 유지하는 이유**: blob 크기가 커질 수 있고(대화 기록 누적), credential echo 리스크 가능성이 있으므로 autocomplete/expression resolver 레벨에서 숨김 처리합니다. 디버깅은 run history 의 raw payload 에서 수행. `_resumeState` 는 `output` 내부가 **아니라** `NodeHandlerOutput` top-level 에 위치합니다.
- **`output.result.ragSources` 위치**: RAG chunk 은 후속 노드가 "출처 표시" 에 활용할 수 있는 비즈니스 데이터이므로 `meta` 가 아닌 `output.result` 유지 (P1). `rag*` config 는 `config` echo 에 포함.

### 5.3. 비교 근거: 다른 LLM 계열 노드와의 일관성

| 개념 | `ai_agent` (After) | `text_classifier` (After) | `information_extractor` (After) |
| --- | --- | --- | --- |
| 결과 wrapper | `output.result` | `output.result` | `output.result` |
| 1차 응답/결과 | `result.response` | `result.category` / `result.categories` | `result.extracted` |
| 종료 이유 | `result.endReason` | — (포트로만 표현) | `result.endReason` |
| 턴 카운트 | `result.turnCount` | — | `result.turnCount` |
| 토큰 | `meta.{inputTokens, outputTokens, totalTokens}` | `meta.{inputTokens, outputTokens, totalTokens}` | `meta.{inputTokens, outputTokens, totalTokens}` |
| 에러 | `output.error.{code,message,details}` | `output.error.{code,message}` | `output.error.{code,message,details}` |
| 블로킹 런타임 필드 | `output.messages` | — | `output.messages` (+ optional `output.partial`) |
| 블로킹 resume | `_resumeState` (top-level) | — | `_resumeState` (top-level) |
| Resumed interaction | `output.interaction.{type:'message_received', data:{content,role}, receivedAt}` | — | `output.interaction.{type:'message_received', data:{content,role}, receivedAt}` |

3개 AI 노드가 문자열 수준으로 호환되는 shape 을 공유하게 되어, 신규 사용자는 노드 종류와 무관하게 `result.*` / `meta.*` / (대기 시) `messages` + `interaction` 만 기억하면 됩니다. 리터럴 설정값은 모두 `config.*` 에서 일관되게 조회합니다.
