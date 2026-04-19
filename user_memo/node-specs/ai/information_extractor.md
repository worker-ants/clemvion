# Information Extractor (`information_extractor`)

> 텍스트(혹은 대화)로부터 사용자 정의 스키마에 따라 구조화된 필드를 추출합니다. 단일 호출(`single_turn`) 모드와 누락된 필드를 사용자에게 대화로 되묻는 `multi_turn` 모드를 지원합니다.

- **카테고리**: `ai`
- **컨테이너**: no
- **Blocking**: yes (`multi_turn` 모드만, `status: "waiting_for_input"`)
- **동적 포트**: yes (`kind: "info-extractor-mode"`)

구현 위치: `backend/src/nodes/ai/information-extractor/`
- `information-extractor.schema.ts` / `information-extractor.handler.ts` / `information-extractor.component.ts`

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `llmConfigId` | string | no | (없음) | LLM Provider 설정 ID. 미지정 시 워크스페이스 기본값 | no |
| `model` | string | no | (없음) | 모델 오버라이드. 미지정 시 provider `defaultModel` | no |
| `inputField` | string (expression) | single_turn에서 필수, multi_turn에서는 선택 | (없음) | 추출 대상 텍스트. multi_turn에서 없으면 첫 LLM 호출 생략 후 바로 사용자 입력 대기 | yes |
| `outputSchema` | `FieldDef[]` | yes (≥ 1개) | `[]` | 추출할 필드 목록 | no |
| `examples` | `Example[]` | no | `[]` | Few-shot 예시. systemPrompt에 append됨 | no |
| `instructions` | string | no | (없음) | 추가 지시사항. systemPrompt에 append됨 | no |
| `mode` | `'single_turn' \| 'multi_turn'` | no | `'single_turn'` | 단일 추출 vs. 대화형 수집 | no |
| `maxTurns` | int | no | `10` | multi_turn 최대 턴 수 (`0` = 무제한). 음수 불가 | no |
| `maxCollectionRetries` | int (≥ 0) | no | `3` | multi_turn에서 LLM이 누락된 required 필드로 `finalize_extraction`을 호출했을 때 재시도 허용 횟수 (`0` = 무제한) | no |

`FieldDef`:

| 필드 | 타입 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| `name` | string | yes | - | 필드 이름 (결과 `extracted.<name>`로 매핑) |
| `type` | `'string' \| 'number' \| 'boolean' \| 'array' \| 'object'` | yes | - | 값 타입 (null 허용됨) |
| `description` | string | yes | - | LLM에게 이 필드가 무엇인지 설명 |
| `required` | boolean | no | `true` | `true`면 isComplete 판정 시 non-null 필수 |
| `enumValues` | string[] | no | (없음) | 허용 값 목록. LLM jsonSchema에 `enum: [...values, null]`로 반영 |

`Example`:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `input` | string | 예시 입력 텍스트 |
| `output` | `Record<string, unknown>` | 예상 추출 결과 JSON |

### Validate 규칙

- `outputSchema` 최소 1개 필요. 각 항목의 `name`과 `type` 필수.
- `mode !== 'multi_turn'` 이면 `inputField` 필수. (multi_turn은 UI 사용자 메시지로 대체 가능.)
- `mode === 'multi_turn'` 이고 `maxTurns < 0` → 거부.

## Ports

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | 주 입력 (실제 소스는 `inputField` expression) |
| Output | `out` | Output | system | (`single_turn`) 추출 성공 |
| Output | `completed` | Completed | system | (`multi_turn`) 모든 required 필드 수집 완료 |
| Output | `user_ended` | User Ended | system | (`multi_turn`) 사용자가 대화 종료 |
| Output | `max_turns` | Max Turns | system | (`multi_turn`) `maxTurns` 도달 |
| Output | `error` | Error | error | LLM 호출 실패, JSON 파싱 실패(single_turn 3회 시도 모두 실패), `max_retries` (multi_turn) 등 |

### 동적 포트 생성 규칙

컴포넌트 메타데이터 `dynamicPorts = { kind: 'info-extractor-mode', modeField: 'mode', multiTurnValue: 'multi_turn' }` 에 따라 `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` 의 `infoExtractorModePorts`가 다음과 같이 분기합니다.

- `mode === 'multi_turn'` → `[ completed (system), user_ended (system), max_turns (system), error (error) ]`
- 그 외 (`single_turn` 포함) → `[ out (system), error (error) ]`

## Input

핸들러는 `input` 파라미터를 직접 사용하지 않습니다. expression resolver가 `inputField` expression을 평가한 값을 LLM의 user 메시지로 사용합니다. `multi_turn`에서 이후 턴의 사용자 메시지는 엔진의 `processMultiTurnMessage(userMessage, state)` 호출로 들어옵니다. workspace 식별은 `context.variables.__workspaceId`.

## Output

> Information Extractor 핸들러는 **legacy 포트 선택자 모양** `{ port, data: { config, output, meta } }`을 반환합니다 (ai_agent와 또 다른 패턴). handler-output adapter가 `data`를 `output`으로 promote하므로, 후속 노드에서는 `$node["X"].output.output.extracted.<field>` 처럼 **한 단계 더 nested**된 경로로 접근합니다. 이 비대칭은 기존 계약 유지 목적으로 의도된 것입니다 (autocomplete schema 주석 참고).

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

- JSON 파싱이 실패하면 최대 2회까지 재시도 (총 3회 호출). 모두 실패하면 Case 5로 라우팅.

### Case 2: Multi-Turn 완료 (`completed`)

LLM이 `finalize_extraction` tool을 모든 required 필드 non-null로 호출하면 즉시 종료:

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
      "messages": [
        { "role": "system", "content": "..." },
        { "role": "user", "content": "John 입니다" },
        { "role": "assistant", "content": "주문번호?" },
        { "role": "user", "content": "ORD-123" },
        { "role": "assistant", "content": "", "toolCalls": [ { "id": "call-1", "name": "finalize_extraction", "arguments": "..." } ] }
      ],
      "endReason": "completed",
      "turnCount": 2,
      "collectionRetryCount": 0,
      "_turnDebugHistory": [
        { "turnIndex": 1, "llmCalls": [...], "totalDurationMs": 520 },
        { "turnIndex": 2, "llmCalls": [...], "totalDurationMs": 430 }
      ]
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

- `output.extracted`에는 **스키마의 모든 필드가 반드시 포함**됩니다. 미수집 값은 `null`로 채움 (downstream이 `$node.output.output.extracted.<field>`를 안전하게 참조 가능하도록).
- optional 필드가 LLM에서 `null`로 확정되어도 `completed` 포트로 라우팅.

### Case 3: Multi-Turn 대기 (`status: "waiting_for_input"`)

LLM이 content-only 응답(tool call 없음)을 했거나 `inputField`가 비어 첫 LLM 호출을 건너뛴 경우:

```json
{
  "type": "ai_conversation",
  "status": "waiting_for_input",
  "interactionType": "ai_conversation",
  "config": {
    "schema": [...],
    "mode": "multi_turn",
    "maxCollectionRetries": 3
  },
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

- `inputField`가 비어 LLM 호출을 생략할 때: `turnCount=0`, `conversationConfig.message=""`, `messages`는 system 메시지 1개, `partialResult={}`.
- Content-only 응답은 `partialResult`를 **건드리지 않습니다** — LLM은 반드시 `finalize_extraction` tool 호출로만 값을 채움.
- `extracted`는 스키마 전체 기반으로 항상 모든 필드를 포함 (미수집은 `null`).

**재개 contract**: 엔진이 사용자 입력을 받으면 `processMultiTurnMessage(userMessage, _multiTurnState)`를 호출. 다음 턴에서:
- 완료되면 Case 2 (`completed`).
- 아직 missing이면 다시 Case 3 (`waiting_for_input`, `turnCount`/`collectionRetryCount` 누적).
- `turnCount >= maxTurns` 이면 Case 4 (`max_turns`).
- LLM이 required 누락 상태로 `finalize_extraction`을 호출 → `maxCollectionRetries` 내에서는 동일 턴 안에서 LLM에 `tool_result` 메시지(`incomplete_extraction`, `missingRequiredFields`)를 보내 재시도. 초과 시 Case 5 (`error`, `endReason: 'max_retries'`).

### Case 4: Multi-Turn 종료 (`user_ended` / `max_turns`)

엔진이 사용자 종료 시그널을 보내거나 `maxTurns` 도달 시:

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

- `user_ended`는 엔진의 `endMultiTurnConversation(state, 'user_ended')` 경로, `max_turns`는 turn limit 도달 시.
- 부분 추출 결과(`partialResult`)가 `extracted`에 유지되며 미수집 필드는 `null`.

### Case 5: 에러

**Single-turn**: LLM 호출이 throw하거나 JSON 파싱이 3회 연속 실패한 경우:

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

**Multi-turn**: LLM 호출 예외 또는 `collectionRetryCount > maxCollectionRetries`:

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

- `endReason` 값: `max_retries`, `error`, `timeout` 모두 `error` 포트로 라우팅 (`portForEndReason` 구현).

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Order Extractor`라고 가정하고, `outputSchema = [ { name: "senderName", ... }, { name: "orderNumber", ... }, { name: "amount", required: false, ... } ]`.

### Single Turn 성공 (또는 Multi Turn `completed`)

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Order Extractor"].port }}` | `"out"` 또는 `"completed"` |
| `{{ $node["Order Extractor"].output.output.extracted.senderName }}` | `"John"` |
| `{{ $node["Order Extractor"].output.output.extracted.orderNumber }}` | `"ORD-123"` |
| `{{ $node["Order Extractor"].output.output.extracted.amount }}` | `null` |
| `{{ $node["Order Extractor"].output.output.endReason }}` | `"completed"` (multi_turn 만) |
| `{{ $node["Order Extractor"].output.output.turnCount }}` | `2` (multi_turn 만) |
| `{{ $node["Order Extractor"].output.output.messages }}` | 전체 대화 배열 (multi_turn 만) |
| `{{ $node["Order Extractor"].output.meta.model }}` | `"gpt-4o"` |
| `{{ $node["Order Extractor"].output.meta.totalTokens }}` | `310` |
| `{{ $node["Order Extractor"].output.config.schema }}` | `FieldDef[]` |

> 주의: `output`이 한 번 더 중첩되어 `$node["X"].output.output.extracted.*` 형태입니다 (autocomplete schema comment 참고 — `information-extractor.schema.ts`).

### Multi-Turn 대기 중

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Order Extractor"].status }}` | `"waiting_for_input"` |
| `{{ $node["Order Extractor"].output.status }}` | `"waiting_for_input"` |
| `{{ $node["Order Extractor"].output.conversationConfig.message }}` | `"주문번호를 알려주세요"` |
| `{{ $node["Order Extractor"].output.conversationConfig.turnCount }}` | `1` |
| `{{ $node["Order Extractor"].output.conversationConfig.missingFields }}` | `["orderNumber"]` |
| `{{ $node["Order Extractor"].output.conversationConfig.extracted.senderName }}` | `"John"` |
| `{{ $node["Order Extractor"].output.conversationConfig.collectionRetryCount }}` | `0` |

### Multi-Turn 종료 (`user_ended` / `max_turns` / `error`)

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Order Extractor"].port }}` | `"user_ended"` / `"max_turns"` / `"error"` |
| `{{ $node["Order Extractor"].output.output.endReason }}` | `"user_ended"` / `"max_turns"` / `"max_retries"` 등 |
| `{{ $node["Order Extractor"].output.output.extracted.senderName }}` | `"John"` (미수집이면 `null`) |
| `{{ $node["Order Extractor"].output.output.collectionRetryCount }}` | `3` |

### 에러 (single_turn)

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Order Extractor"].port }}` | `"error"` |
| `{{ $node["Order Extractor"].output.output.error }}` | `"API timeout"` |
| `{{ $node["Order Extractor"].output.output.originalInput }}` | `"Email from John..."` |

## 주의사항

- **LLM 비용**:
  - `single_turn`은 JSON response format으로 단일 호출 (파싱 실패 시 최대 3회 재시도).
  - `multi_turn`은 **function calling** (`finalize_extraction` tool) 기반이며 턴마다 여러 번 호출될 수 있음. 특히 LLM이 required 누락 상태로 finalize를 시도하면 `collectionRetryCount`만큼 **같은 턴 안에서** 추가 호출이 발생합니다.
- **Partial extraction**: multi_turn에서 사용자가 여러 턴에 걸쳐 정보를 나눠 줄 때마다 `partialResult`에 non-null 값만 누적(merge) 됩니다. 기존 값이 null/undefined로 덮어쓰이지 않음(`mergePartial`).
- **`completed` 판정**: `required !== false` 인 필드 모두가 non-null/non-empty-string일 때만 완료. `amount` 같은 optional(`required: false`)은 null이어도 완료로 간주.
- **`maxCollectionRetries`**: LLM이 required 필드가 누락된 채 `finalize_extraction`을 호출하면, 핸들러가 LLM에게 `tool_result` 메시지로 `{ error: "incomplete_extraction", missingRequiredFields, instruction }`를 보내 **같은 턴 안에서** 재시도. 초과 시 `endReason: "max_retries"` → `error` 포트. `0`이면 무제한.
- **Content-only 응답**: LLM이 tool call 없이 자연어 응답만 하면 `followUp` 질문으로 해석되어 `waiting_for_input` 반환. `partialResult`는 이때 절대 변경되지 않음.
- **필드 타입 nullable**: `buildJsonSchema`가 모든 field를 `type: [<field.type>, 'null']`로 선언하므로 LLM은 모르는 값을 null로 명시 가능. `enumValues`가 있으면 `enum: [...values, null]`.
- **Language policy (multi_turn)**: system prompt가 사용자의 최근 메시지 언어로 자동 응답하도록 강제. 한국어/영어 자동 스위칭, 다중 언어 혼합 금지.
- **Finalization separation (multi_turn)**: system prompt의 strict rules에 따라 LLM은 확인 메시지와 tool 호출을 같은 턴에 함께 하지 않도록 교육됨. 실제 `finalize_extraction` 호출은 사용자 명시적 확인 **이후** 턴에서만 일어나도록 프롬프트에 강제.
- **`_multiTurnState` 지속성**: 엔진이 blob으로 persist. 재개 시 `hydrateState`로 복원되며, `workspaceId`, `outputSchema`, `instructions`, `examples`, `maxCollectionRetries`, `turnDebugHistory` 등이 모두 보존됩니다.
- **비대칭 output 경로**: handler-output adapter로 인해 `$node["X"].output.output.extracted.<field>` 경로가 됩니다. ai_agent(flat) / text_classifier(flat)와 다른 nested 모양 — autocomplete schema의 주석 참고.
- **Frontend schema enrichment**: 실제 프런트엔드 autocomplete에서는 `config.outputSchema`의 사용자 정의 필드명이 `output.output.extracted.<fieldName>`에 동적으로 주입됩니다 (`enrichInfoExtractorOutputSchema`).
- **Workspace**: `context.variables.__workspaceId` 누락 시 `''`로 fallback되어 LLM config 해석이 workspace 기본값 없이 진행됩니다.
