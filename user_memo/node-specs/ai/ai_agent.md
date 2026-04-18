# AI Agent (`ai_agent`)

> LLM과 대화하는 노드. RAG, Tool 사용, 조건 기반 분기, multi-turn 대화를 지원합니다. 가장 복잡한 노드 중 하나로, mode와 conditions에 따라 output 구조가 크게 달라집니다.

- **카테고리**: `ai`
- **컨테이너**: no
- **Blocking**: yes (multi_turn 모드만, `status: "waiting_for_input"`)
- **동적 포트**: yes (`ai-agent-conditional`)

## Config 파라메터

### 기본

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `mode` | `'single_turn' \| 'multi_turn'` | no | `'single_turn'` | 단일/대화 모드 | no |
| `llmConfigId` | string | no | (없음) | LLM Provider 설정 ID. 미지정 시 워크스페이스 기본값 | no |
| `model` | string (expression) | no | (없음) | 모델 오버라이드. 미지정 시 provider의 default model | yes |
| `systemPrompt` | string (expression) | mode에 따라 | (없음) | 시스템 프롬프트 (markdown + expression 지원) | yes |
| `userPrompt` | string (expression) | single에서 system 없으면 필수 | (없음) | 사용자 프롬프트. multi_turn에서는 첫 LLM 호출 트리거 (없으면 사용자 입력 대기) | yes |
| `responseFormat` | `'text' \| 'json'` | no | `'text'` | 응답 형식 | no |
| `jsonSchema` | object | no | (없음) | `responseFormat='json'`일 때 응답 스키마 | no |

### RAG (Knowledge Base)

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `knowledgeBases` | string[] | no | `[]` | 검색 대상 KB ID 목록 | no |
| `ragTopK` | int | no | `5` | 가져올 chunk 수 | no |
| `ragThreshold` | number | no | `0.7` | 유사도 최소값 (0~1) | no |

### Conditions (조건 기반 분기)

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `conditions` | `ConditionDef[]` | no | `[]` | 조건별 분기 정의 (최대 20개). 각 항목: `{ id, label, prompt }` (prompt ≤ 2000자) | no |

`ConditionDef`:
- `id`: 출력 포트 ID (예약어 `out`, `in`, `error`, `user_ended`, `max_turns`와 충돌 불가)
- `label`: UI 라벨
- `prompt`: 이 조건을 트리거할 상황을 LLM에게 안내할 텍스트

### Advanced

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `temperature` | number | no | (없음) | 0=결정적, 2=창의적 | no |
| `maxTokens` | int | no | (없음) | 응답 토큰 상한 | no |
| `maxToolCalls` | int | no | `10` | 도구 호출 횟수 상한 | no |
| `toolNodeIds` | string[] | no | `[]` | 도구로 노출할 노드 ID 목록 | no |
| `toolOverrides` | `ToolOverride[]` | no | `[]` | 도구 이름/설명/매핑 오버라이드 | no |
| `conversationHistory` | `'none' \| 'last_n' \| 'full'` | no | `'none'` | 대화 이력 포함 정책 | no |
| `historyCount` | int | no | (없음) | `conversationHistory='last_n'`일 때 메시지 수 | no |

### Multi Turn

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `maxTurns` | int | no | `20` | 최대 대화 턴 수 (`0` = 무제한) | no |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | 입력 (프롬프트 expression에서 `$input.*` 참조) |
| Output | `<condition.id>` | (조건 라벨) | **동적** — 매칭된 조건으로 라우팅 (per condition) |
| Output | `out` | Output | (single_turn / no condition) 일반 응답 |
| Output | `user_ended` | User Ended | (multi_turn) 사용자가 대화 종료 |
| Output | `max_turns` | Max Turns | (multi_turn) maxTurns 도달 |
| Output | `error` | Error | 에러 |

> **동적 포트 생성 규칙** (`resolve-dynamic-ports.ts`):
>
> - condition 있음 + single_turn: `[<conditions>, out, error]`
> - condition 있음 + multi_turn: `[<conditions>, user_ended, max_turns, error]`
> - condition 없음 + single_turn: `[out, error]`
> - condition 없음 + multi_turn: `[user_ended, max_turns, error]`

## Input

핸들러는 input 자체를 직접 사용하지 않고, expression resolver가 `userPrompt`/`systemPrompt`/`model` 등 표현식 필드 안에서 `$input.*`을 평가한 결과로 사용합니다.

## Output

> ⚠️ AI Agent 핸들러는 표준 `NodeHandlerOutput` 모양이 아닌 **legacy 평탄 객체**를 반환합니다. expression-resolver의 호환 shim에 의해 후속 노드에서는 `$node["AI"].output.<위 필드>` 형태로 접근됩니다.

### Case 1: Single Turn 정상 완료

```json
{
  "response": "Hello! How can I help you?",
  "metadata": {
    "model": "claude-sonnet-4-6",
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
      "llmCalls": [{ "requestPayload": {...}, "responsePayload": {...}, "durationMs": 1234 }],
      "totalDurationMs": 1234
    }
  ]
}
```

`responseFormat: 'json'` 이면 `response`는 JSON 객체로 파싱된 값 (실패 시 raw string).

### Case 2: Condition 매칭 (single 또는 multi)

```json
{
  "port": "refund_request",
  "data": {
    "interactionType": "ai_conversation",
    "response": "환불 요청을 확인했습니다",
    "messages": [{ "role": "system", ... }, { "role": "user", ... }, ...],
    "turnCount": 1,
    "endReason": "condition",
    "condition": {
      "id": "refund_request",
      "label": "Refund Request",
      "reason": "사용자가 환불을 명시적으로 요청함"
    },
    "metadata": { "model": "...", "totalInputTokens": 200, "totalOutputTokens": 80, "totalTokens": 280, "thinkingTokens": 0, "toolCalls": 0, "ragSources": [] },
    "_turnDebugHistory": [...]
  },
  "_turnDebug": { "llmCalls": [...], "totalDurationMs": 2345 }
}
```

엔진이 `port` 필드를 보고 매칭된 condition.id 포트로 라우팅합니다. **후속 노드는 `data.*`로 접근**해야 합니다 (한 단계 깊은 구조).

### Case 3: Multi-Turn 대기 (`waiting_for_input`)

`userPrompt`가 없거나 첫 LLM 응답 후:

```json
{
  "type": "ai_conversation",
  "status": "waiting_for_input",
  "interactionType": "ai_conversation",
  "config": { "mode": "multi_turn", "maxTurns": 20, "maxToolCalls": 10 },
  "conversationConfig": {
    "message": "안녕하세요, 무엇을 도와드릴까요?",
    "messages": [...],
    "turnCount": 1,
    "maxTurns": 20
  },
  "_multiTurnState": {
    "llmConfigId": "...",
    "model": "...",
    "messages": [...],
    "turnCount": 1,
    "totalInputTokens": 100,
    "totalOutputTokens": 30,
    "totalThinkingTokens": 0,
    "toolCalls": 0,
    "ragSources": [],
    "lastTurnRequest": {...},
    "lastTurnResponse": {...},
    "lastTurnDurationMs": 1500,
    "turnDebugHistory": [...]
  }
}
```

엔진은 `status: "waiting_for_input"`을 보고 사용자 입력을 받을 때까지 일시 중지.

### Case 4: Multi-Turn 종료 (`user_ended` / `max_turns`)

엔진이 `endMultiTurnConversation`을 호출하면:

```json
{
  "interactionType": "ai_conversation",
  "response": "마지막 응답...",
  "messages": [...],
  "turnCount": 5,
  "endReason": "max_turns",
  "metadata": { "model": "...", "totalInputTokens": 1000, "totalOutputTokens": 400, "totalTokens": 1400, "thinkingTokens": 0, "toolCalls": 2, "ragSources": [...] },
  "_turnDebugHistory": [...]
}
```

엔진은 endReason에 맞게 `user_ended` 또는 `max_turns` 포트로 라우팅.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Support Bot`이라고 가정.

### Single Turn (텍스트):

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Support Bot"].output.response }}` | `"Hello! How can I help you?"` |
| `{{ $node["Support Bot"].output.metadata.model }}` | `"claude-sonnet-4-6"` |
| `{{ $node["Support Bot"].output.metadata.totalTokens }}` | `169` |
| `{{ $node["Support Bot"].output.metadata.toolCalls }}` | `0` |
| `{{ $node["Support Bot"].output.metadata.ragSources }}` | `[{...source}]` |

### Single Turn (JSON):

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Support Bot"].output.response }}` | `{ category: "billing", priority: "high" }` |
| `{{ $node["Support Bot"].output.response.category }}` | `"billing"` |

### Condition 매칭:

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Support Bot"].port }}` | `"refund_request"` |
| `{{ $node["Support Bot"].output.data.condition.label }}` | `"Refund Request"` |
| `{{ $node["Support Bot"].output.data.condition.reason }}` | `"사용자가 환불을..."` |
| `{{ $node["Support Bot"].output.data.response }}` | `"환불 요청을 확인했습니다"` |

### Multi-Turn 종료:

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Support Bot"].output.endReason }}` | `"user_ended"` 또는 `"max_turns"` |
| `{{ $node["Support Bot"].output.response }}` | (마지막 메시지) |
| `{{ $node["Support Bot"].output.turnCount }}` | `5` |
| `{{ $node["Support Bot"].output.messages }}` | `[{role, content, ...}]` 전체 대화 기록 |
| `{{ $node["Support Bot"].output.metadata.totalTokens }}` | (누적 토큰) |

### Multi-Turn 대기 중:

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Support Bot"].output.status }}` | `"waiting_for_input"` (`output`에 nested) |
| `{{ $node["Support Bot"].output.conversationConfig.turnCount }}` | `1` |
| `{{ $node["Support Bot"].output.conversationConfig.message }}` | (최근 봇 응답) |

> 엔진이 `status`를 hoist하는지(`$node["X"].status`)는 엔진 구현에 의존. 안전하게는 `output.status`로 접근.

## 주의사항

- **Single turn은 systemPrompt/userPrompt 중 적어도 하나 필수**, multi_turn은 systemPrompt 필수.
- conditions는 최대 20개. id는 예약어(`out`, `in`, `error`, `user_ended`, `max_turns`)와 충돌 불가. label/prompt 모두 필수, prompt ≤ 2000자.
- conditions가 있을 때 LLM에게 `cond_<id>` 도구가 자동 등록되며 시스템 프롬프트 끝에 한국어 안내가 붙습니다.
- Condition only 호출이면 즉시 해당 condition으로 라우팅. Mixed면 일반 도구만 실행하고 condition은 deferral 메시지로 응답하여 LLM이 다음 턴에 다시 판단.
- RAG는 `userPrompt`(또는 multi-turn에서 사용자 메시지) 텍스트로 검색 → 결과를 system prompt에 append.
- multi-turn에서 사용자 입력은 엔진의 `processMultiTurnMessage`로 전달되어 다음 턴 진행.
- workspace 식별을 위해 `context.variables.__workspaceId` 가 필요 (엔진이 주입).
- 토큰 사용량은 `metadata.totalInputTokens` + `totalOutputTokens` (single은 마지막 호출 기준, multi는 누적).
- `_turnDebugHistory`, `_turnDebug`는 디버그용 — 모든 LLM 호출의 request/response 페이로드 포함. UI Information Tab이 사용.
