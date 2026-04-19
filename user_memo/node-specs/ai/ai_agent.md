# AI Agent (`ai_agent`)

> LLM과 대화하는 노드. RAG, Tool 사용, 조건 기반 분기, multi-turn 대화를 지원합니다. mode와 conditions에 따라 output 구조가 크게 달라지는 가장 복잡한 노드 중 하나입니다.

- **카테고리**: `ai`
- **컨테이너**: no
- **Blocking**: yes (multi_turn 모드만, `status: "waiting_for_input"`)
- **동적 포트**: yes (`kind: "ai-agent-conditional"`)

구현 위치: `backend/src/nodes/ai/ai-agent/`
- `ai-agent.schema.ts` / `ai-agent.handler.ts` / `ai-agent.component.ts`

## Config 파라메터

### 기본

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `mode` | `'single_turn' \| 'multi_turn'` | no | `'single_turn'` | 단일 호출 vs. 대화(blocking) 모드 | no |
| `llmConfigId` | string | no | (없음) | LLM Provider 설정 ID. 미지정 시 워크스페이스 기본값 사용 | no |
| `model` | string (expression) | no | (없음) | 모델 오버라이드. 미지정 시 provider의 `defaultModel` | yes |
| `systemPrompt` | string (expression) | mode에 따라 (아래 validate 규칙 참고) | (없음) | 시스템 프롬프트 (markdown + expression 지원) | yes |
| `userPrompt` | string (expression) | single_turn에서 systemPrompt 없으면 필수. multi_turn에서는 선택 | (없음) | 사용자 프롬프트. multi_turn에서 없으면 첫 LLM 호출을 건너뛰고 바로 대기 | yes |
| `responseFormat` | `'text' \| 'json'` | no | `'text'` | `'json'`이면 응답을 JSON 파싱 (실패 시 raw string) | no |
| `jsonSchema` | object | no | (없음) | `responseFormat='json'`일 때 LLM에게 전달할 응답 스키마 | no |

### RAG (Knowledge Base)

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `knowledgeBases` | string[] | no | `[]` | 검색 대상 KB ID 목록 (비면 RAG 생략) | no |
| `ragTopK` | int | no | `5` | 가져올 chunk 수 | no |
| `ragThreshold` | number | no | `0.7` | 유사도 최소값 (0~1) | no |

### Conditions (조건 기반 분기)

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `conditions` | `ConditionDef[]` | no | `[]` | 최대 20개. 각 항목 `{ id, label, prompt }`; `prompt` ≤ 2000자 | no |

`ConditionDef`:
- `id`: 출력 포트 ID. 예약어 `out`, `in`, `error`, `user_ended`, `max_turns`와 충돌 불가.
- `label`: UI 라벨 (기본값 `""`).
- `prompt`: 이 조건을 트리거할 상황을 LLM에게 설명하는 텍스트 (기본값 `""`).

### Advanced

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `temperature` | number | no | (없음) | 0=결정적, 2=창의적 | no |
| `maxTokens` | int | no | (없음) | 응답 토큰 상한 | no |
| `maxToolCalls` | int | no | `10` | 일반 tool 호출 횟수 상한 (condition tool은 미집계) | no |
| `toolNodeIds` | string[] | no | `[]` | 도구로 노출할 노드 ID 목록 | no |
| `toolOverrides` | `ToolOverride[]` | no | `[]` | 각 도구의 `toolName`/`toolDescription`/`inputMapping` 오버라이드 | no |
| `conversationHistory` | `'none' \| 'last_n' \| 'full'` | no | `'none'` | 대화 이력 포함 정책 (UI hint; 핸들러 내부에서는 직접 사용하지 않음) | no |
| `historyCount` | int | no | (없음) | `conversationHistory='last_n'`일 때 메시지 수 | no |

### Multi Turn

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `maxTurns` | int | no | `20` | 최대 대화 턴 수 (`0` = 무제한). 음수 불가. | no |

### Validate 규칙 요약

- `mode = 'multi_turn'`: `systemPrompt` 필수. `maxTurns < 0` 거부.
- `mode = 'single_turn'` (기본): `systemPrompt` 또는 `userPrompt` 중 하나 필수.
- `conditions`: 최대 20개. 각 항목 `id`/`label`/`prompt` 모두 필수, `prompt ≤ 2000자`, `id`는 예약 포트명 사용 불가.

## Ports

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | 주 입력 (프롬프트 expression에서 `$input.*`로 참조) |
| Output | `<condition.id>` | (condition.label) | data | **동적** — 매칭된 condition으로 라우팅 (per condition) |
| Output | `out` | Output | system | (single_turn 또는 condition 없음 + single) 일반 응답 |
| Output | `user_ended` | User Ended | system | (multi_turn) 사용자가 대화 종료 시 |
| Output | `max_turns` | Max Turns | system | (multi_turn) `maxTurns` 도달 시 |
| Output | `error` | Error | error | 에러 |

### 동적 포트 생성 규칙

컴포넌트 메타데이터 `dynamicPorts = { kind: 'ai-agent-conditional', modeField: 'mode', conditionsField: 'conditions', multiTurnValue: 'multi_turn' }` 에 따라 `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` 의 `aiAgentConditionalPorts`가 다음과 같이 포트를 생성합니다.

- `conditions` 있음 + `mode='single_turn'` → `[…condition ports, out, error]`
- `conditions` 있음 + `mode='multi_turn'` → `[…condition ports, user_ended, max_turns, error]`
- `conditions` 없음 + `mode='single_turn'` → `[out, error]`
- `conditions` 없음 + `mode='multi_turn'` → `[user_ended, max_turns, error]`

condition 포트는 `{ id: condition.id, label: condition.label || "Condition", type: "data" }`로 생성되며, id가 빈 문자열인 항목은 스킵됩니다.

## Input

핸들러는 `input` 파라미터를 직접 사용하지 않습니다. expression resolver가 각 프롬프트/모델 필드(`systemPrompt`, `userPrompt`, `model` 등) 안의 `{{ $input.* }}` 표현식을 평가한 뒤 해석된 config를 핸들러에 전달합니다. workspace 식별을 위해 `context.variables.__workspaceId` 가 필요 (엔진이 주입).

## Output

> AI Agent 핸들러는 `execute()`에서 **표준 `NodeHandlerOutput` 래퍼가 아닌 bare 객체**를 반환합니다 (handler output adapter가 `output`으로 promote). 따라서 후속 노드에서는 아래 필드들이 `$node["AI"].output.<field>`로 노출됩니다. condition-routing 시에만 `{ port, data: {...} }` 2단 구조가 반환되며, 이 경우 실제 필드는 `data.*` 아래에 있습니다.

### Case 1: Single Turn 정상 완료

`port` 생략 → 엔진은 기본 `out` 포트로 라우팅. `config`/`meta`는 adapter가 채움.

```json
{
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
  "_turnDebugHistory": [
    {
      "turnIndex": 1,
      "llmCalls": [
        { "requestPayload": { "model": "gpt-4o", "messages": [...], "tools": [...] },
          "responsePayload": { "content": "Hello! ...", "usage": {...} },
          "durationMs": 1234 }
      ],
      "totalDurationMs": 1234
    }
  ]
}
```

- `responseFormat: 'json'` 이면 `response`는 JSON 객체로 파싱된 값. JSON 파싱 실패 시에만 raw string으로 fallback.
- `toolCalls`는 **normal tool** 호출 횟수 (condition tool은 집계되지 않음).

### Case 2: Condition 매칭 (single 또는 multi)

`conditions`가 있고 LLM이 `cond_<sanitized_id>` tool만 호출했거나, mixed 호출 이후 재평가에서 condition-only로 수렴한 경우:

```json
{
  "port": "refund_request",
  "data": {
    "interactionType": "ai_conversation",
    "response": "환불 요청을 확인했습니다",
    "messages": [
      { "role": "system", "content": "..." },
      { "role": "user", "content": "I want a refund" },
      { "role": "assistant", "content": "환불 요청을 확인했습니다" }
    ],
    "turnCount": 1,
    "endReason": "condition",
    "condition": {
      "id": "refund_request",
      "label": "Refund Request",
      "reason": "사용자가 환불을 명시적으로 요청함"
    },
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
  },
  "_turnDebug": { "llmCalls": [...], "totalDurationMs": 2345 }
}
```

엔진이 `port` 필드를 보고 매칭된 `condition.id` 포트로 라우팅합니다. **후속 노드는 한 단계 깊은 `output.data.*`로 접근**해야 합니다.

- `reason` 은 condition tool의 `arguments.reason`을 추출한 값 (최대 500자).
- 여러 condition tool이 동시에 호출되면 `conditions[]` 배열에서 **index가 가장 낮은** condition으로 라우팅.

### Case 3: Multi-Turn 대기 (`status: "waiting_for_input"`)

`mode='multi_turn'`에서 (a) `userPrompt`가 없으면 LLM 호출 전에 곧바로, (b) 있으면 첫 LLM 응답 후에 반환:

```json
{
  "type": "ai_conversation",
  "status": "waiting_for_input",
  "interactionType": "ai_conversation",
  "config": { "mode": "multi_turn", "maxTurns": 20, "maxToolCalls": 10 },
  "conversationConfig": {
    "message": "안녕하세요, 무엇을 도와드릴까요?",
    "messages": [ ... ],
    "turnCount": 1,
    "maxTurns": 20
  },
  "_multiTurnState": {
    "llmConfigId": "cfg-1",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 2048,
    "knowledgeBases": [],
    "ragTopK": 5,
    "ragThreshold": 0.7,
    "maxToolCalls": 10,
    "maxTurns": 20,
    "toolNodeIds": [],
    "toolOverrides": [],
    "conditions": [],
    "workspaceId": "ws-1",
    "messages": [ ... ],
    "turnCount": 1,
    "totalInputTokens": 100,
    "totalOutputTokens": 30,
    "totalThinkingTokens": 0,
    "toolCalls": 0,
    "ragSources": [],
    "lastTurnRequest": { ... },
    "lastTurnResponse": { ... },
    "lastTurnDurationMs": 1500,
    "turnDebugHistory": [ ... ]
  }
}
```

- `userPrompt`가 비었을 때: `turnCount=0`, `conversationConfig.message=""`, `messages`는 system 메시지 1개만 포함, `totalInputTokens=0`.
- 엔진은 `status: "waiting_for_input"`을 감지해 워크플로우 실행을 일시 중지하고, 사용자 입력이 들어오면 `processMultiTurnMessage(userMessage, _multiTurnState)` 를 호출해 다음 턴을 진행.

**재개 contract**: 다음 턴의 output은 동일한 `{ status: "waiting_for_input", conversationConfig, _multiTurnState }` 모양이며, 누적된 `turnCount` / `totalInputTokens` / `totalOutputTokens` / `turnDebugHistory`가 반영됩니다. Condition tool이 호출되면 Case 2로 즉시 라우팅, `maxTurns` 도달 시 Case 4로 종료.

### Case 4: Multi-Turn 종료 (`user_ended` / `max_turns` / `condition` via finalize)

엔진이 사용자 종료나 `max_turns` 도달 시 `buildMultiTurnFinalOutput`(또는 `endMultiTurnConversation`) 결과로 반환:

```json
{
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
}
```

`port` 필드가 없으므로 엔진이 `endReason`에 맞춰 `user_ended` 또는 `max_turns` 포트로 라우팅합니다. `endReason: "error"` 도 가능 (이때 엔진은 `error` 포트로).

### Case 5: 에러

`validate()`에서 실패하면 엔진이 노드 실행을 거부. LLM 호출 중 throw되면 엔진이 `error` 포트로 라우팅합니다 (핸들러 내부에는 try/catch 없음 — 예외 전파).

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Support Bot`이라고 가정합니다.

### Single Turn (텍스트)

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Support Bot"].output.response }}` | `"Hello! How can I help you?"` |
| `{{ $node["Support Bot"].output.metadata.model }}` | `"gpt-4o"` |
| `{{ $node["Support Bot"].output.metadata.inputTokens }}` | `124` |
| `{{ $node["Support Bot"].output.metadata.outputTokens }}` | `45` |
| `{{ $node["Support Bot"].output.metadata.totalTokens }}` | `169` |
| `{{ $node["Support Bot"].output.metadata.toolCalls }}` | `0` |
| `{{ $node["Support Bot"].output.metadata.ragSources }}` | `[{ chunkId, score, ... }]` |

### Single Turn (JSON)

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Support Bot"].output.response }}` | `{ "category": "billing", "priority": "high" }` |
| `{{ $node["Support Bot"].output.response.category }}` | `"billing"` |

### Condition 매칭

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Support Bot"].port }}` | `"refund_request"` |
| `{{ $node["Support Bot"].output.data.condition.id }}` | `"refund_request"` |
| `{{ $node["Support Bot"].output.data.condition.label }}` | `"Refund Request"` |
| `{{ $node["Support Bot"].output.data.condition.reason }}` | `"사용자가 환불을 명시적으로 요청함"` |
| `{{ $node["Support Bot"].output.data.response }}` | `"환불 요청을 확인했습니다"` |
| `{{ $node["Support Bot"].output.data.endReason }}` | `"condition"` |
| `{{ $node["Support Bot"].output.data.turnCount }}` | `1` |
| `{{ $node["Support Bot"].output.data.messages }}` | 전체 대화 배열 |
| `{{ $node["Support Bot"].output.data.metadata.totalTokens }}` | `280` |

### Multi-Turn 종료 (`user_ended` / `max_turns`)

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Support Bot"].output.endReason }}` | `"user_ended"` 또는 `"max_turns"` |
| `{{ $node["Support Bot"].output.response }}` | (마지막 assistant 메시지) |
| `{{ $node["Support Bot"].output.turnCount }}` | `5` |
| `{{ $node["Support Bot"].output.messages }}` | 전체 대화 배열 |
| `{{ $node["Support Bot"].output.metadata.totalTokens }}` | 누적 토큰 수 |
| `{{ $node["Support Bot"].output.metadata.toolCalls }}` | `2` |

### Multi-Turn 대기 중

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Support Bot"].status }}` | `"waiting_for_input"` |
| `{{ $node["Support Bot"].output.status }}` | `"waiting_for_input"` (nested copy) |
| `{{ $node["Support Bot"].output.conversationConfig.message }}` | (최근 봇 응답) |
| `{{ $node["Support Bot"].output.conversationConfig.turnCount }}` | `1` |
| `{{ $node["Support Bot"].output.conversationConfig.maxTurns }}` | `20` |

## 주의사항

- **LLM 비용**: 매 턴마다 실제 LLM API 호출이 일어나며 tool-calling loop로 한 턴 안에서도 여러 번 호출될 수 있습니다. `maxToolCalls`로 상한 설정.
- **Validate 규칙**: single_turn은 `systemPrompt` 또는 `userPrompt` 중 하나 필수, multi_turn은 `systemPrompt` 필수.
- **Conditions 제약**: 최대 20개. `id`는 예약어(`out`, `in`, `error`, `user_ended`, `max_turns`)와 충돌 불가. `label`/`prompt` 모두 필수, `prompt ≤ 2000자`.
- **Condition tool 이름**: 내부적으로 `cond_<sanitized_id>` (알파벳/숫자/underscore 외 문자는 `_`로 치환) 이름으로 LLM에 등록되며, 시스템 프롬프트 끝에 한국어 조건 안내문(`[조건 안내] ...`)이 자동 append됩니다.
- **Condition routing 동작**:
  - **condition-only 호출** → 즉시 해당 condition 포트로 라우팅 (normal tool은 실행 안 함).
  - **mixed (condition + normal)** → normal tool만 실행하고 condition tool에는 "확인되었습니다. 도구 실행 결과를 참고하여 최종 판단해주세요." deferral 메시지로 응답 → LLM이 다음 turn에 재평가.
  - **여러 condition 동시 호출** → `conditions[]` 배열에서 **index가 가장 낮은** 것을 선택.
  - `toolCallCount`는 normal tool에만 누적됨 (condition tool은 `maxToolCalls` 소진에 포함되지 않음 — single_turn의 경우. multi_turn에서는 둘 다 카운트).
- **RAG**:
  - single_turn은 `userPrompt`로, multi_turn 첫 턴은 `userPrompt`로, 이후 턴은 **사용자 메시지 본문**으로 검색. 결과를 systemPrompt 뒤에 append (multi_turn 이후 턴에서는 별도 system 메시지로 삽입).
  - `knowledgeBases`가 비어있으면 RAG 생략.
- **Multi-turn 상태 지속**: `_multiTurnState`는 엔진이 blob으로 persist하며, `processMultiTurnMessage(userMessage, state)` 호출 시 그대로 전달합니다. 필드: `messages`, `turnCount`, `totalInputTokens/OutputTokens/ThinkingTokens`, `toolCalls`, `ragSources`, `conditions`, `turnDebugHistory`, `lastTurn*` 등.
- **토큰 누적**: single_turn의 `metadata.*Tokens`는 마지막 LLM 호출 기준(tool loop의 최종 호출). multi_turn은 모든 턴/호출에 걸쳐 누적.
- **Workspace**: `context.variables.__workspaceId`가 없으면 `''`로 fallback되어 LLM config 해석이 workspace 기본값 없이 진행됩니다.
- **`_turnDebug` / `_turnDebugHistory`**: 각 LLM 호출의 request/response payload와 duration을 포함한 디버그 메타. Frontend LlmInformationTab이 사용.
