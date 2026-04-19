# Information Extractor (`information_extractor`) — Output 일관성 개선안

- **카테고리**: `ai`
- **현재 스펙**: [`user_memo/node-specs/ai/information_extractor.md`](../../node-specs/ai/information_extractor.md)
- **공통 규칙**: [`CONVENTIONS.md`](../CONVENTIONS.md)
- **우선순위**: P0 (AI 카테고리 내 **`output.output.*` 이중 중첩**이라는 최악의 위반 사례)

> Information Extractor는 핸들러가 `{ port, data: { config, output, meta } }` 모양의 **legacy 포트 선택자 shape** 으로 반환하고, handler-output adapter가 `data` 를 `output` 으로 promote함에 따라 최종적으로 `$node["X"].output.output.extracted.*` 라는 **비대칭 이중 중첩** 경로가 생성되는 구조입니다. CONVENTIONS P8의 **가장 노골적인 위반 사례**로, 최우선 정리 대상입니다.

---

## 1. 현재 Output 구조 요약

### Case 1: Single Turn 성공

```json
{
  "port": "out",
  "data": {
    "config": {
      "schema": [
        { "name": "senderName", "type": "string", "description": "Sender name", "required": true },
        { "name": "orderNumber", "type": "string", "description": "Order number", "required": true }
      ]
    },
    "output": {
      "extracted": {
        "senderName": "John",
        "orderNumber": "ORD-123"
      },
      "_llmCalls": [ { "requestPayload": {...}, "responsePayload": {...}, "durationMs": 810 } ]
    },
    "meta": {
      "model": "gpt-4o",
      "inputTokens": 100,
      "outputTokens": 20,
      "totalTokens": 120,
      "thinkingTokens": 0
    }
  }
}
```

> adapter promote 후 `$node["X"].output` = 위 `data` 객체가 되어, **`$node["X"].output.output.extracted.senderName`** 이 실제 경로가 됩니다.

### Case 2: Multi-Turn 완료 (`completed`)

```json
{
  "port": "completed",
  "data": {
    "config": { "schema": [...], "mode": "multi_turn" },
    "output": {
      "extracted": {
        "senderName": "John",
        "orderNumber": "ORD-123",
        "amount": null
      },
      "messages": [ ... ],
      "endReason": "completed",
      "turnCount": 2,
      "collectionRetryCount": 0,
      "_turnDebugHistory": [ ... ]
    },
    "meta": {
      "model": "gpt-4o",
      "inputTokens": 250,
      "outputTokens": 60,
      "totalTokens": 310,
      "thinkingTokens": 0,
      "interactionType": "ai_conversation"
    }
  }
}
```

### Case 3: Multi-Turn 대기 (`status: "waiting_for_input"`)

```json
{
  "type": "ai_conversation",
  "status": "waiting_for_input",
  "interactionType": "ai_conversation",
  "config": { "schema": [...], "mode": "multi_turn", "maxCollectionRetries": 3 },
  "conversationConfig": {
    "message": "주문번호를 알려주세요",
    "messages": [ ... ],
    "turnCount": 1,
    "maxTurns": 10,
    "extracted": { "senderName": "John", "orderNumber": null, "amount": null },
    "missingFields": ["orderNumber"],
    "collectionRetryCount": 0,
    "maxCollectionRetries": 3
  },
  "_multiTurnState": {
    "llmConfigId": "cfg-1",
    "model": "gpt-4o",
    "workspaceId": "ws-1",
    "outputSchema": [...],
    "instructions": "",
    "examples": [],
    "messages": [ ... ],
    "partialResult": { "senderName": "John" },
    "turnCount": 1,
    "maxTurns": 10,
    "collectionRetryCount": 0,
    "maxCollectionRetries": 3,
    "totalInputTokens": 100,
    "totalOutputTokens": 20,
    "totalThinkingTokens": 0,
    "turnDebugHistory": [ ... ]
  }
}
```

### Case 4: Multi-Turn 종료 (`user_ended` / `max_turns`)

```json
{
  "port": "max_turns",
  "data": {
    "config": { "schema": [...], "mode": "multi_turn" },
    "output": {
      "extracted": { "senderName": "John", "orderNumber": null, "amount": null },
      "messages": [ ... ],
      "endReason": "max_turns",
      "turnCount": 5,
      "collectionRetryCount": 1,
      "_turnDebugHistory": [ ... ]
    },
    "meta": {
      "model": "gpt-4o",
      "inputTokens": 800,
      "outputTokens": 240,
      "totalTokens": 1040,
      "thinkingTokens": 0,
      "interactionType": "ai_conversation"
    }
  }
}
```

### Case 5: 에러

Single-turn:

```json
{
  "port": "error",
  "data": {
    "config": { "schema": [...] },
    "output": {
      "error": "API timeout",
      "originalInput": "Email from John...",
      "_llmCalls": [ ... ]
    },
    "meta": {}
  }
}
```

Multi-turn (`max_retries` 등):

```json
{
  "port": "error",
  "data": {
    "config": { "schema": [...], "mode": "multi_turn" },
    "output": {
      "extracted": { "senderName": "John", "orderNumber": null },
      "messages": [ ... ],
      "endReason": "max_retries",
      "turnCount": 3,
      "collectionRetryCount": 3,
      "_turnDebugHistory": [ ... ]
    },
    "meta": {
      "model": "gpt-4o",
      "inputTokens": 500,
      "outputTokens": 150,
      "totalTokens": 650,
      "thinkingTokens": 0,
      "interactionType": "ai_conversation"
    }
  }
}
```

---

## 2. 식별된 불일치

| # | 위반 내용 | 관련 Principle | 심각도 |
| --- | --- | --- | --- |
| I1 | **`output.output.extracted.*` 이중 중첩** — adapter promote 결과 실제 경로가 한 단계 더 깊어짐. 모든 필드(`extracted`, `messages`, `endReason`, `turnCount`, `collectionRetryCount`) 에 동일 문제 | **P8 (중첩 제거) — 최악의 위반** | Critical |
| I2 | Single-turn 에러 케이스에서 `output.output.error: string` — 에러 표준 shape 미준수 | **P3.2 (에러 표준)** | Critical |
| I3 | Multi-turn 에러(`max_retries`) 케이스에서 `output.output.error` 가 없고 `endReason: 'max_retries'` 만 — 에러 shape 비일관 | **P3**, P8 | Critical |
| I4 | `output.meta.interactionType: 'ai_conversation'` — `meta` 에 도메인 분류 문자열. `meta` 는 메트릭 전용 | **P2 (meta는 메트릭만)** | High |
| I5 | Multi-turn 대기 시 `_multiTurnState` 필드명이 공통 규약(`_resumeState`) 과 불일치 | **P4.2 (재개 contract)** | High |
| I6 | Multi-turn 대기 시 `output.conversationConfig` 내부에 `maxTurns`, `maxCollectionRetries` 같은 **리터럴 config** 값이 echo 되고 `output.type: 'ai_conversation'` 판별자가 붙어 있음 | **P1.1 (config↔output 직교성)**, **P1.1.4 (판별자 금지)**, P4.3 | High |
| I7 | 재개 직후 `resumed` 상태가 없음 — 곧바로 다음 `waiting_for_input` 으로 점프해 observability 부족 | **P4.1** | High |
| I8 | `output.output._turnDebugHistory` / `output.output._llmCalls` 가 비즈니스 데이터 영역에 존재 | P2, P1 | Medium |
| I9 | `output.output.collectionRetryCount` 는 실행 메트릭성 정보(retry count) — `meta` 로 이동이 자연스러움 | P2 | Medium |
| I10 | `ai_agent` 의 `response`(응답 텍스트) vs 본 노드의 `extracted`(구조화 필드) 개념 차이가 wrapper 없이 나열되어, 네이밍만 봐서는 "어떤 LLM 노드의 어떤 결과인지" 구분이 어려움 | P8 | Low |

---

## 3. 제안된 Output 구조

**원칙**: "LLM 계열 노드는 `output.result` 아래에 도메인 결과를 모은다" (P8). AI 카테고리 3개 노드가 동일한 `output.result` / `output.error` / `output.interaction` wrapper 를 공유.

**블로킹 대기 시 원칙** (Principle 1.1, 4.3): `output` 에는 **이 실행 시점에 계산된 런타임 값만** 담습니다. `maxTurns`, `maxCollectionRetries`, `schema`, `instructions` 등 **리터럴 config 값은 echo 하지 않으며**, 후속 노드 및 UI 렌더러는 `$node["X"].config.*` 을 직접 참조합니다. `output.view` 래퍼와 `view.type` 판별자는 **사용하지 않습니다**. 대기 시점에 변동하는 extraction 진행 상황은 `output.partial` 서브필드로 표현합니다 (런타임 계산값).

### Case 1 (After): Single Turn 성공

```json
{
  "config": {
    "mode": "single_turn",
    "model": "gpt-4o",
    "schema": [
      { "name": "senderName", "type": "string", "description": "Sender name", "required": true },
      { "name": "orderNumber", "type": "string", "description": "Order number", "required": true }
    ]
  },
  "output": {
    "result": {
      "extracted": {
        "senderName": "John",
        "orderNumber": "ORD-123"
      },
      "endReason": "out",
      "turnCount": 1,
      "originalInput": "Email from John..."
    }
  },
  "meta": {
    "durationMs": 810,
    "model": "gpt-4o",
    "inputTokens": 100,
    "outputTokens": 20,
    "totalTokens": 120,
    "thinkingTokens": 0,
    "turnDebug": [ { "turnIndex": 1, "llmCalls": [...], "totalDurationMs": 810 } ]
  },
  "port": "out",
  "status": "ended"
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `output.result.extracted` | `Record<string, unknown>` | schema 에 정의된 필드의 추출 결과. 미수집 required 필드는 null. |
| `output.result.endReason` | `"out"` | single turn 의 정상 종료 이유 |
| `output.result.turnCount` | number | single 은 항상 `1` |
| `output.result.originalInput` | string | 추출 대상 입력 (디버깅 & 후속 노드 참조용) |

핵심 변화:
- `output.output.extracted.*` → `output.result.extracted.*` (**I1 해결**: 이중 중첩 제거).
- `output.output._llmCalls` → `meta.turnDebug` (P2).
- `endReason: 'out'` 을 single-turn 에도 부여해 multi-turn 과 공통 스키마 제공.
- `originalInput` 을 `output.result` 에 유지 (디버깅 & 후속 노드의 "실제 LLM 입력" 참조용).

### Case 2 (After): Multi-Turn 완료 (`completed`)

```json
{
  "config": { "mode": "multi_turn", "schema": [...], "maxTurns": 10, "maxCollectionRetries": 3 },
  "output": {
    "result": {
      "extracted": {
        "senderName": "John",
        "orderNumber": "ORD-123",
        "amount": null
      },
      "endReason": "completed",
      "turnCount": 2,
      "messages": [ ... ]
    }
  },
  "meta": {
    "durationMs": 950,
    "model": "gpt-4o",
    "inputTokens": 250,
    "outputTokens": 60,
    "totalTokens": 310,
    "thinkingTokens": 0,
    "collectionRetryCount": 0,
    "turnDebug": [
      { "turnIndex": 1, "llmCalls": [...], "totalDurationMs": 520 },
      { "turnIndex": 2, "llmCalls": [...], "totalDurationMs": 430 }
    ]
  },
  "port": "completed",
  "status": "ended"
}
```

핵심 변화:
- `output.output.extracted` / `output.output.messages` / `output.output.endReason` / `output.output.turnCount` 모두 `output.result.*` 로 통일 (**I1**).
- `collectionRetryCount` → `meta.collectionRetryCount` (**I9**: 실행 메트릭).
- `_turnDebugHistory` → `meta.turnDebug` (**I8**).
- `meta.interactionType` 완전 제거 (**I4**).
- `status: 'ended'` 명시 (P0, P4).

### Case 3 (After): Multi-Turn 대기 (`status: "waiting_for_input"`)

```json
{
  "config": {
    "mode": "multi_turn",
    "schema": [...],
    "instructions": "",
    "examples": [],
    "model": "gpt-4o",
    "maxTurns": 10,
    "maxCollectionRetries": 3
  },
  "output": {
    "messages": [
      { "role": "assistant", "content": "주문번호를 알려주세요" }
    ],
    "partial": {
      "extracted": { "senderName": "John", "orderNumber": null, "amount": null },
      "missingFields": ["orderNumber"],
      "collectionRetryCount": 0
    }
  },
  "meta": {
    "durationMs": 1500,
    "model": "gpt-4o",
    "inputTokens": 100,
    "outputTokens": 20,
    "totalTokens": 120,
    "turnDebug": [ ... ]
  },
  "status": "waiting_for_input",
  "_resumeState": {
    "llmConfigId": "cfg-1",
    "model": "gpt-4o",
    "workspaceId": "ws-1",
    "outputSchema": [...],
    "instructions": "",
    "examples": [],
    "messages": [ ... ],
    "partialResult": { "senderName": "John" },
    "turnCount": 1,
    "maxTurns": 10,
    "collectionRetryCount": 0,
    "maxCollectionRetries": 3,
    "totalInputTokens": 100,
    "totalOutputTokens": 20,
    "totalThinkingTokens": 0,
    "turnDebugHistory": [ ... ]
  }
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `output.messages` | `ChatMessage[]` | **런타임 누적 대화** 스냅샷 (`ai_agent` 와 동일 구조). |
| `output.partial` | object? | **런타임 수집 상황** — 부분 추출이 존재할 때만 포함. |
| `output.partial.extracted` | `Record<string, unknown>` | schema 전체를 기준으로 한 현재까지의 값. 미수집은 null. 런타임에 LLM 호출 merge 결과로 계산됨. |
| `output.partial.missingFields` | `string[]` | 아직 수집되지 않은 required 필드 이름들. schema 와 현재 extracted 를 비교한 **런타임 계산값**. |
| `output.partial.collectionRetryCount` | number | LLM 이 `finalize_extraction` 을 잘못 호출해 누락 필드를 재질의한 횟수 누적. 런타임 메트릭이지만 UI 렌더링(진행률) 에 필요하므로 output 에도 노출. |
| `_resumeState` | object | 엔진이 다음 턴을 처리하기 위해 보관하는 **internal state**. top-level 필드이며 expression autocomplete/resolver 에서는 노출하지 않음. |

핵심 변화:
- `output.type: 'ai_conversation'`, `output.interactionType`, `output.conversationConfig` 전부 제거. `output.view` 래퍼/`view.type` 판별자도 도입하지 않음 (**I6** 해결, P1.1, P1.1.4).
- 런타임 필드는 `output` 최상위에 직접 배치: `messages`, `partial`. `maxTurns` / `maxCollectionRetries` / `schema` 등 리터럴 config 는 **echo 하지 않음** (후속 노드/UI 는 `$node["X"].config.maxTurns` 등을 참조).
- `output.partial` 는 `extracted` 중복 필드를 **런타임 계산값**으로만 담음: 스키마 전체를 기준으로 한 현재 스냅샷 (누락은 null) + `missingFields` 배열. 이는 config `schema` 와 `_resumeState.partialResult` 로부터 계산 가능한 파생값이지만 UI/후속 노드가 자주 참조하므로 명시.
- `_multiTurnState` → `_resumeState` (**I5**). top-level 유지, expression 레이어에서만 숨김.
- `output.status` 중복 제거 (top-level 에만).

> **참고**: 대기 UI 가 "진행률" 을 표시할 때 `$node["X"].output.partial.missingFields.length / $node["X"].config.schema.filter(f => f.required).length` 형태로 리터럴 config 와 런타임 값을 조합해 사용합니다.

### Case 3b (After): Multi-Turn 재개 (`status: "resumed"`) — 신설

사용자 메시지를 받아 엔진이 `processMultiTurnMessage(userMessage, _resumeState)` 를 호출한 직후, **종료 조건에 도달하지 않은 경우** 한 번 `resumed` 스냅샷을 방출(`ai_agent` 와 동일 패턴).

```json
{
  "config": { "mode": "multi_turn", "schema": [...], "maxTurns": 10, "maxCollectionRetries": 3 },
  "output": {
    "messages": [ ... ],
    "partial": {
      "extracted": { "senderName": "John", "orderNumber": "ORD-123", "amount": null },
      "missingFields": [],
      "collectionRetryCount": 0
    },
    "interaction": {
      "type": "message_received",
      "data": { "content": "ORD-123 입니다", "role": "user" },
      "receivedAt": "2026-04-19T06:45:12.480Z"
    }
  },
  "meta": { "durationMs": 0, "turnDebug": [] },
  "status": "resumed",
  "_resumeState": { ... }
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `output.messages` | `ChatMessage[]` | 사용자 메시지 append 직후의 누적 대화 |
| `output.partial` | object? | 직전 대기 시점의 partial 스냅샷 (이 시점에는 새 LLM 호출 전이므로 이전 턴의 결과를 그대로 유지) |
| `output.interaction.type` | `"message_received"` | interaction 종류 (Principle 4.5) |
| `output.interaction.data.content` | string | 사용자가 입력한 메시지 본문 |
| `output.interaction.data.role` | `"user"` | 고정값 |
| `output.interaction.receivedAt` | ISO8601 string | 수신 시각 |

> `resumed` 스냅샷은 run history / timeline observability 전용이며, 그래프 엣지 라우팅을 발생시키지 않습니다 (곧바로 다음 상태로 수렴).

### Case 4 (After): Multi-Turn 종료 (`user_ended` / `max_turns`)

```json
{
  "config": { "mode": "multi_turn", "schema": [...], "maxTurns": 10 },
  "output": {
    "result": {
      "extracted": { "senderName": "John", "orderNumber": null, "amount": null },
      "endReason": "max_turns",
      "turnCount": 5,
      "messages": [ ... ]
    }
  },
  "meta": {
    "durationMs": 7320,
    "model": "gpt-4o",
    "inputTokens": 800,
    "outputTokens": 240,
    "totalTokens": 1040,
    "thinkingTokens": 0,
    "collectionRetryCount": 1,
    "turnDebug": [ ... ]
  },
  "port": "max_turns",
  "status": "ended"
}
```

핵심 변화:
- Case 2(completed) 와 **동일한 shape** — 오직 `port` 와 `endReason` 만 다름.
- 부분 추출 결과(`extracted`)가 `output.result.extracted` 에 유지, 미수집 필드는 `null`.

### Case 5 (After): 에러

Single-turn (LLM 호출 throw 또는 JSON 파싱 3회 실패):

```json
{
  "config": { "mode": "single_turn", "schema": [...] },
  "output": {
    "error": {
      "code": "LLM_RESPONSE_INVALID",
      "message": "Failed to parse JSON after 3 attempts",
      "details": {
        "provider": "openai",
        "attempts": 3,
        "originalInput": "Email from John...",
        "lastResponse": "..."
      }
    }
  },
  "meta": {
    "durationMs": 3200,
    "model": "gpt-4o",
    "turnDebug": [ ... ]
  },
  "port": "error",
  "status": "ended"
}
```

Multi-turn (`max_retries`):

```json
{
  "config": { "mode": "multi_turn", "schema": [...], "maxCollectionRetries": 3 },
  "output": {
    "error": {
      "code": "MAX_COLLECTION_RETRIES_EXCEEDED",
      "message": "LLM attempted finalize_extraction 3 times with missing required fields",
      "details": {
        "extracted": { "senderName": "John", "orderNumber": null },
        "missingFields": ["orderNumber"],
        "turnCount": 3,
        "collectionRetryCount": 3
      }
    },
    "result": {
      "extracted": { "senderName": "John", "orderNumber": null },
      "endReason": "max_retries",
      "turnCount": 3,
      "messages": [ ... ]
    }
  },
  "meta": {
    "durationMs": 5600,
    "model": "gpt-4o",
    "inputTokens": 500,
    "outputTokens": 150,
    "totalTokens": 650,
    "collectionRetryCount": 3,
    "turnDebug": [ ... ]
  },
  "port": "error",
  "status": "ended"
}
```

`code` 예약어:
- `LLM_CALL_FAILED` — provider 네트워크/타임아웃/5xx.
- `LLM_RATE_LIMITED` — 429.
- `LLM_RESPONSE_INVALID` — JSON 파싱 재시도 모두 실패 (single-turn 전용).
- `MAX_COLLECTION_RETRIES_EXCEEDED` — multi-turn 에서 required 필드 누락 재시도 초과.

> **Multi-turn 에러 shape 특이점**: `output.error` 와 `output.result` 가 **동시에 존재**합니다. 부분 수집한 필드가 있으므로 후속 노드가 "에러지만 이만큼은 건졌다" 를 활용하려면 result 도 필요합니다. `output.error` 존재 여부로 에러/정상을 판단하고, `result` 는 부가 정보로 활용하는 규약. (Single-turn 에러는 부분 결과가 없으므로 `output.error` 만 존재.)

### 핵심 변화 요약

1. **이중 중첩 제거** (**최우선**): `output.output.*` → `output.result.*`. handler-output adapter 의 특수 분기 제거.
2. **블로킹 런타임 필드 직접 노출**: `output.conversationConfig` 제거, `output.messages` + `output.partial` 만 남김 (P1.1, P4.3). `view` 래퍼 및 `view.type` 판별자 **폐기**.
3. **재개 컨트랙트**: `_multiTurnState` → `_resumeState`, `resumed` 상태 신설 (P4).
4. **에러 표준**: `output.error.{code, message, details}` + multi-turn 의 경우 `output.error` + `output.result` 병존 (P3.2).
5. **메트릭 이동**: `meta.interactionType` 제거, `collectionRetryCount` → `meta`, `_turnDebugHistory` → `meta.turnDebug` (P2). 단 `output.partial.collectionRetryCount` 는 UI 렌더용으로 대기 output 에도 노출.

---

## 4. 마이그레이션 영향도

### 4.1. Expression 경로 비교표

노드 라벨 `Order Extractor` 기준, 현재 → 개선 후의 **모든** 변경 경로.

#### Single Turn 성공 / Multi-Turn Completed

| 현재 | 개선 후 | 비고 |
| --- | --- | --- |
| `$node["Order Extractor"].output.output.extracted` | `$node["Order Extractor"].output.result.extracted` | **I1** (이중 중첩 제거) |
| `$node["Order Extractor"].output.output.extracted.senderName` | `$node["Order Extractor"].output.result.extracted.senderName` | I1 |
| `$node["Order Extractor"].output.output.extracted.orderNumber` | `$node["Order Extractor"].output.result.extracted.orderNumber` | I1 |
| `$node["Order Extractor"].output.output.extracted.amount` | `$node["Order Extractor"].output.result.extracted.amount` | I1 |
| `$node["Order Extractor"].output.output.endReason` | `$node["Order Extractor"].output.result.endReason` | I1 |
| `$node["Order Extractor"].output.output.turnCount` | `$node["Order Extractor"].output.result.turnCount` | I1 |
| `$node["Order Extractor"].output.output.messages` | `$node["Order Extractor"].output.result.messages` | I1 |
| `$node["Order Extractor"].output.output.collectionRetryCount` | `$node["Order Extractor"].meta.collectionRetryCount` | **I9** (메트릭 이동) |
| `$node["Order Extractor"].output.output._turnDebugHistory` | `$node["Order Extractor"].meta.turnDebug` | **I8** |
| `$node["Order Extractor"].output.output._llmCalls` | `$node["Order Extractor"].meta.turnDebug` | I8 (통일) |
| `$node["Order Extractor"].output.meta.model` | `$node["Order Extractor"].meta.model` | adapter 제거 → top-level meta |
| `$node["Order Extractor"].output.meta.inputTokens` | `$node["Order Extractor"].meta.inputTokens` | 동일 |
| `$node["Order Extractor"].output.meta.outputTokens` | `$node["Order Extractor"].meta.outputTokens` | 동일 |
| `$node["Order Extractor"].output.meta.totalTokens` | `$node["Order Extractor"].meta.totalTokens` | 동일 |
| `$node["Order Extractor"].output.meta.thinkingTokens` | `$node["Order Extractor"].meta.thinkingTokens` | 동일 |
| `$node["Order Extractor"].output.meta.interactionType` | — | **I4** 삭제 |
| `$node["Order Extractor"].output.config.schema` | `$node["Order Extractor"].config.schema` | adapter 제거 |
| (없음) | `$node["Order Extractor"].meta.durationMs` | 신설 (P2 필수) |
| (없음) | `$node["Order Extractor"].status` = `'ended'` | 신설 |
| `$node["Order Extractor"].port` | `$node["Order Extractor"].port` | (불변) `out` / `completed` / `user_ended` / `max_turns` |

#### Multi-Turn 대기

| 현재 | 개선 후 | 비고 |
| --- | --- | --- |
| `$node["Order Extractor"].status` | `$node["Order Extractor"].status` | (불변) `waiting_for_input` |
| `$node["Order Extractor"].output.status` | — | **삭제** (top-level 과 중복) |
| `$node["Order Extractor"].output.type` | — | **삭제** (판별자 불필요, P1.1.4) |
| `$node["Order Extractor"].output.interactionType` | — | **삭제** (판별자 불필요) |
| `$node["Order Extractor"].output.conversationConfig.message` | `$node["Order Extractor"].output.messages[-1].content` | 마지막 assistant 메시지 |
| `$node["Order Extractor"].output.conversationConfig.messages` | `$node["Order Extractor"].output.messages` | P1.1 (런타임 필드 직접 배치) |
| `$node["Order Extractor"].output.conversationConfig.turnCount` | `$node["Order Extractor"].output.messages.length` 또는 `_resumeState.turnCount` | 파생값 — 필요 시 messages 길이로 계산 |
| `$node["Order Extractor"].output.conversationConfig.maxTurns` | `$node["Order Extractor"].config.maxTurns` | **P1.1** — 리터럴 config 는 config 경로 |
| `$node["Order Extractor"].output.conversationConfig.extracted` | `$node["Order Extractor"].output.partial.extracted` | 런타임 계산값 (partial 서브필드로 재배치) |
| `$node["Order Extractor"].output.conversationConfig.missingFields` | `$node["Order Extractor"].output.partial.missingFields` | 런타임 계산값 |
| `$node["Order Extractor"].output.conversationConfig.collectionRetryCount` | `$node["Order Extractor"].output.partial.collectionRetryCount` | 런타임 메트릭이지만 UI 표시용으로 output 노출 유지 |
| `$node["Order Extractor"].output.conversationConfig.maxCollectionRetries` | `$node["Order Extractor"].config.maxCollectionRetries` | **P1.1** — 리터럴 config 는 config 경로 |
| `$node["Order Extractor"].output._multiTurnState.*` | (expression 비노출) `_resumeState.*` | **I5** |

> **중요**: 대기 상태에서 후속 노드(주로 presentation/UI 렌더러) 가 `maxTurns`, `maxCollectionRetries`, `schema` 등 **사용자 설정값**을 필요로 할 경우 `$node["Order Extractor"].config.maxTurns` / `.maxCollectionRetries` / `.schema` 처럼 `config` 경로를 사용합니다. 이전 초안이 제안했던 `output.view.maxTurns` / `output.view.maxCollectionRetries` 경로는 **폐기**되었습니다 (Principle 1.1).

#### Multi-Turn 재개 (신설)

| 현재 | 개선 후 | 비고 |
| --- | --- | --- |
| (없음) | `$node["Order Extractor"].status` = `'resumed'` | 신설 |
| (없음) | `$node["Order Extractor"].output.messages` | 신설 — 대기 시점 + 사용자 입력 append |
| (없음) | `$node["Order Extractor"].output.partial.*` | 신설 — 직전 스냅샷 유지 |
| (없음) | `$node["Order Extractor"].output.interaction.type` = `'message_received'` | 신설 |
| (없음) | `$node["Order Extractor"].output.interaction.data.content` | 신설 (사용자 메시지 본문) |
| (없음) | `$node["Order Extractor"].output.interaction.data.role` = `'user'` | 신설 |
| (없음) | `$node["Order Extractor"].output.interaction.receivedAt` | 신설 |

#### Error

| 현재 | 개선 후 | 비고 |
| --- | --- | --- |
| `$node["Order Extractor"].output.output.error` (string, single_turn) | `$node["Order Extractor"].output.error.message` | **I2** (표준화) |
| `$node["Order Extractor"].output.output.originalInput` (single_turn) | `$node["Order Extractor"].output.error.details.originalInput` | I2 |
| `$node["Order Extractor"].output.output.endReason` (`'max_retries'`, multi_turn) | `$node["Order Extractor"].output.error.code` (`'MAX_COLLECTION_RETRIES_EXCEEDED'`) | **I3** |
| `$node["Order Extractor"].output.output.extracted` (multi_turn 에러) | `$node["Order Extractor"].output.result.extracted` | 부분 결과 보존 |
| `$node["Order Extractor"].output.output.messages` (multi_turn 에러) | `$node["Order Extractor"].output.result.messages` | 부분 결과 보존 |
| `$node["Order Extractor"].output.output.turnCount` (multi_turn 에러) | `$node["Order Extractor"].output.result.turnCount` | 부분 결과 보존 |
| `$node["Order Extractor"].output.output.collectionRetryCount` (multi_turn 에러) | `$node["Order Extractor"].meta.collectionRetryCount` | I9 |
| (없음) | `$node["Order Extractor"].output.error.code` | 신설 |
| (없음) | `$node["Order Extractor"].output.error.details` | 신설 |
| `$node["Order Extractor"].port` | `$node["Order Extractor"].port` | (불변) `'error'` |

### 4.2. 영향 범위 요약

- **Breaking change 규모**: 경로 **30+개** (AI Agent에 준함). 특히 **`output.output.*` → `output.result.*`** 는 기존 모든 workflow가 영향을 받음.
- **영향받는 백엔드**: `backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` — `execute()` / `processMultiTurnMessage()` / `endMultiTurnConversation()` 반환 shape 전면 재작성. handler-output adapter 의 info-extractor 특수 분기 **제거** (한 단계 promote 로직을 일반 regime 으로 통합).
- **영향받는 프런트엔드**:
  - autocomplete schema (`information-extractor.schema.ts` 주석 + `enrichInfoExtractorOutputSchema`) — `output.output.extracted.*` 동적 주입 로직을 `output.result.extracted.*` 로 변경. 대기 상태 노출 필드는 `output.messages`, `output.partial.extracted`, `output.partial.missingFields`, `output.partial.collectionRetryCount` 로 한정.
  - Run history timeline — `_multiTurnState` → `_resumeState` 반영 + `resumed` 스냅샷 렌더러 추가. 대기 UI 가 표시하던 `maxTurns`/`maxCollectionRetries` 등은 `config.*` 에서 취득.
  - LLM Information Tab — `_turnDebugHistory` → `meta.turnDebug`.

### 4.3. 하위호환(backward-compat) 전략

이 노드는 **`output.output.*`** 라는 가장 깊게 뿌리박힌 패턴이 이미 사용자 워크플로우 곳곳에 스며들어 있으므로, **2 릴리스 deprecation** 을 권장합니다.

1. **Shim 배포 릴리스 (v1)** — 핸들러를 새 shape 으로 재구성 + expression resolver 에 legacy alias 주입.
   - `output.output.extracted` → `output.result.extracted` 위임.
   - `output.output.endReason` → `output.result.endReason` 위임.
   - `output.output.turnCount` → `output.result.turnCount` 위임.
   - `output.output.messages` → `output.result.messages` 위임.
   - `output.output.collectionRetryCount` → `meta.collectionRetryCount` 위임.
   - `output.output._turnDebugHistory` / `_llmCalls` → `meta.turnDebug` 위임.
   - `output.output.error` (string) → `output.error.message` 위임.
   - `output.meta.*` → `meta.*` (top-level) 위임.
   - `output.conversationConfig.messages` → `output.messages`, `output.conversationConfig.extracted/missingFields/collectionRetryCount` → `output.partial.*`, `output.conversationConfig.maxTurns/maxCollectionRetries` → `config.*` 위임.
   - `output.type` 접근 시 autocomplete 에서 숨김 (판별자 폐기).
   - 각 legacy path 접근 시 1회 deprecation warning (workflow id + node id 컨텍스트 포함).
2. **Migration CLI (v1)** — `pnpm workflow:migrate-information-extractor` 명령으로 기존 workflow JSON 일괄 치환. 특히 `$node[...].output.output.` 패턴을 `$node[...].output.result.` 으로 일괄 sed 가능.
3. **Deprecation 제거 릴리스 (v2)** — shim 제거. autocomplete 에서 legacy path 완전 숨김 + runtime `undefined`.

### 4.4. Adapter 변경의 긍정적 부산물

handler-output adapter 에서 **information_extractor 전용 분기와 ai_agent conditional 전용 분기가 모두 제거** 되므로 adapter 코드베이스가 단순해지고, **신규 LLM 노드 추가 시의 규약이 명확** 해집니다. 장기적으로 handler-output adapter 는 오직 `NodeHandlerOutput` 의 5필드 통과(pass-through) + 기본 validation 만 수행하게 됩니다.

---

## 5. 근거

### 5.1. CONVENTIONS 매핑

| Principle | 본 개선안이 해결하는 내용 |
| --- | --- |
| **P0** (5필드 invariant) | `{config, output, meta, port, status}` 5필드만 반환. legacy `{port, data:{config,output,meta}}` shape 폐기. |
| **P1** (output은 비즈니스 데이터) | `_turnDebugHistory` / `_llmCalls` / `interactionType` 을 `output` 에서 제거. `collectionRetryCount` 는 `meta` 로 이동하되 UI 렌더용 복제본만 `output.partial` 에 런타임 필드로 유지. |
| **P1.1** (config↔output 직교성) | 대기 상태에서 `maxTurns`, `maxCollectionRetries`, `schema`, `instructions`, `examples`, `model` 등 **리터럴 config 값을 `output` 에 복사하지 않음**. 런타임 필드(`messages`, `partial`) 만 `output` 에 둠. 후속 노드/UI 는 `config.*` 참조. |
| **P1.1.4** (판별자 금지) | `output.type: 'ai_conversation'`, `output.interactionType`, `output.view.type` 등 노드 식별용 판별자 전부 폐기. |
| **P2** (meta는 실행 메트릭) | `meta.{model, inputTokens, outputTokens, totalTokens, thinkingTokens, durationMs, collectionRetryCount, turnDebug}` 로 통일. `meta.interactionType` 삭제. |
| **P3** (에러 컨트랙트) | `output.error.{code, message, details}` 표준 + multi-turn 의 경우 `output.error` + `output.result` 병존 패턴. `LLM_CALL_FAILED` / `LLM_RATE_LIMITED` / `LLM_RESPONSE_INVALID` / `MAX_COLLECTION_RETRIES_EXCEEDED` 예약어. |
| **P4** (재개 contract) | `_multiTurnState` → `_resumeState`. `output.conversationConfig` 제거 → `output.messages` + `output.partial` 런타임 직접 노출. `resumed` transient 상태 신설. `ai_agent` 와 완전히 동일한 재개 규약. |
| **P4.3** (waiting output 내용) | 대기 시 `output` 은 런타임 값(`messages`, `partial?`) 만. 리터럴 config 제외. |
| **P4.4/4.5** (resumed output & interaction) | 재개 시 `output.{messages, partial?, interaction:{type:'message_received', data:{content, role:'user'}, receivedAt}}` 공통 규격 준수. |
| **P5** (port 활성화) | `port: 'out' | 'completed' | 'user_ended' | 'max_turns' | 'error'`. `output` 내부에 port 정보 없음. |
| **P7** (config echo) | `config.schema` (outputSchema), `config.examples`, `config.instructions`, `config.mode`, `config.maxTurns`, `config.maxCollectionRetries`, `config.model`, `config.inputField` 모두 echo. 자격증명 없음. **모두 `output` 에는 echo 금지** (P1.1). |
| **P8** (중첩 제거) | **최상위 목표**. `output.output.*` 이중 중첩 완전 제거. `output.result.*` / `output.messages` / `output.partial.*` / `output.error.*` / `output.interaction.*` 의 1차 필드만 사용. |
| **P11** (문서화) | Case 1~5 JSON + 경로표 포맷이 node-specs/ai/information_extractor.md 의 표준 레이아웃. |

### 5.2. 디자인 결정 배경

- **`output.result.extracted` 를 선택한 이유**: `output.extracted` 직하에 두는 안과 비교하면, multi-turn 의 부가 필드(`endReason`, `turnCount`, `messages`)가 root 에 평탄히 쏟아져 `ai_agent` / `text_classifier` 와의 네이밍 일관성이 깨집니다. `result.*` wrapper 는 **"LLM 실행 결과 컨테이너"** 라는 공통 의미를 AI 3 노드 모두에 부여합니다.
- **Multi-turn 에러에서 `output.error` + `output.result` 를 함께 두는 이유**: `max_retries` / `max_turns` 도중 종료는 "실패" 이지만 부분 결과가 있습니다. 후속 노드가 `if output.error then 로그, else 처리` 로 분기하는 동시에, 로그 단계에서도 `output.result.extracted` 를 참조하여 "이만큼은 건졌다" 를 노출해야 하므로 둘 다 필요합니다. Single-turn 에러는 부분 결과가 없으므로 `output.error` 단독.
- **대기 상태에서 `output.view` 래퍼를 쓰지 않는 이유**: 초기 초안은 `output.view = { type:'chat', messages, maxTurns, maxCollectionRetries, partial }` 를 제안했으나, Principle 1.1 에 따라 **리터럴 config(`maxTurns`, `maxCollectionRetries`, `type` 판별자) 를 output 에 echo 할 수 없습니다**. 결과적으로 view 안에 남는 런타임 필드는 `messages` 와 `partial` 두 개뿐이므로 **wrapper 자체가 불필요**합니다. `output.messages` / `output.partial` 로 직접 노출하는 것이 자연스럽고, 대기 UI 가 리터럴 설정값을 필요로 할 경우 `config` 경로를 사용합니다.
- **`output.partial` sub-field 를 `output` 최상위에 두는 이유** (`ai_agent` 와의 차이): `ai_agent` 는 대기 시 `messages` 만 있으면 충분하지만, Extractor 는 **"현재까지 수집한 필드"** 와 **"미수집 필드"** 를 UI 에 표시해야 합니다. 이들은 schema(config) 와 내부 state 로부터 도출되는 **런타임 계산 스냅샷**이므로 `output.partial.{extracted, missingFields, collectionRetryCount}` 로 묶어 `output` 에 노출합니다. `ai_agent` 에 없는 Extractor 고유 필드이며, 기본 공통 필드(`messages`) 는 `ai_agent` 와 동일 구조 유지.
- **`_resumeState` 내부에 `outputSchema` 를 보존하는 이유**: schema 를 `config.schema` 에 두기만 하면 재개 시 config resolver 를 다시 호출해야 하는데, schema 는 expression 이 없는 정적 정의이므로 state 에 직접 동봉하는 편이 단순합니다. `config` echo 는 초기 호출 반환에만 포함되고, 재개 중 블로킹 반환에는 `config` 가 그대로 유지되므로 중복 아닙니다. `_resumeState` 는 expression 레이어에서 숨김.
- **`_multiTurnState.partialResult` 를 `output.partial.extracted` 와 분리한 이유**: `partialResult` 는 **merge 누적 내부 상태**(null overwrite 방지 로직 적용 대상), `output.partial.extracted` 는 **스키마 전체 기반의 "항상 모든 필드 포함" 뷰**(미수집은 null). 용도가 달라 둘을 별도로 관리하는 게 안전. 동일 내용처럼 보이나 `output.partial.extracted` 는 UI 렌더링 snapshot, `partialResult` 는 engine internal state.
- **`output.partial.collectionRetryCount` 의 중복 노출**: 엄밀히는 `meta.collectionRetryCount` 와 동일한 값이지만, 대기 UI 가 "retry N/max" 진행률을 렌더링하기 위해 자주 참조하는 런타임 값이므로 output 에도 노출합니다. `meta` 는 종료 후 누적값의 final 기록, `output.partial.collectionRetryCount` 는 대기 UI 에 보여줄 라이브 스냅샷으로 의미를 분리합니다.

### 5.3. AI 카테고리 3노드의 최종 일관성

| 개념 | `ai_agent` (After) | `text_classifier` (After) | `information_extractor` (After) |
| --- | --- | --- | --- |
| 결과 wrapper | `output.result` | `output.result` | `output.result` |
| 1차 결과 | `result.response` | `result.category` / `result.categories` | `result.extracted` |
| 종료 이유 | `result.endReason` | — (port 만) | `result.endReason` |
| 턴 카운트 | `result.turnCount` | — | `result.turnCount` |
| 블로킹 런타임 필드 | `output.messages` | — | `output.messages` + `output.partial.{extracted, missingFields, collectionRetryCount}` |
| 재개 state | `_resumeState` (top-level, expression 비노출) | — | `_resumeState` (top-level, expression 비노출) |
| 재개 스냅샷 | `status: 'resumed'` + `output.interaction` | — | `status: 'resumed'` + `output.interaction` |
| Interaction payload | `{type:'message_received', data:{content, role:'user'}, receivedAt}` | — | `{type:'message_received', data:{content, role:'user'}, receivedAt}` |
| 에러 | `output.error.{code,message,details}` | `output.error.{code,message,details}` | `output.error.{code,message,details}` (+ multi-turn 시 `output.result` 병존) |
| 토큰 | `meta.{inputTokens,outputTokens,totalTokens,thinkingTokens}` | `meta.{inputTokens,outputTokens,totalTokens,thinkingTokens}` | `meta.{inputTokens,outputTokens,totalTokens,thinkingTokens}` |
| Debug trace | `meta.turnDebug` | `meta.llmCalls` | `meta.turnDebug` |
| `meta.durationMs` | 필수 | 필수 | 필수 |
| 리터럴 config 접근 | `$node["X"].config.{maxTurns,systemPrompt,conditions,...}` | `$node["X"].config.{categories,...}` | `$node["X"].config.{schema,maxTurns,maxCollectionRetries,instructions,...}` |
| Port 예약어 | `out` / condId / `user_ended` / `max_turns` / `error` | `class_N` / `fallback` / `error` | `out` / `completed` / `user_ended` / `max_turns` / `error` |

→ 사용자는 AI 계열 노드에 대해 **단 하나의 mental model** 만 갖고 있으면 됩니다: "`output.result` 에서 결과 꺼내고, 블로킹이면 `output.messages` (+ extractor 의 경우 `output.partial`) 본다. 에러는 `output.error.code` 체크. 토큰은 `meta`. 리터럴 설정값은 `config`."
