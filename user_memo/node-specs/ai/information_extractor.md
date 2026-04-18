# Information Extractor (`information_extractor`)

> 텍스트(또는 대화)에서 정의된 스키마에 맞는 구조화된 정보를 추출합니다. single_turn은 1회 LLM 호출로 추출, multi_turn은 부족한 필드에 대해 사용자에게 추가 질문을 합니다.

- **카테고리**: `ai`
- **컨테이너**: no
- **Blocking**: yes (multi_turn 모드만)
- **동적 포트**: yes (`info-extractor-mode`)

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `llmConfigId` | string | no | (없음) | LLM Provider 설정 ID | no |
| `model` | string | no | (없음) | 모델 오버라이드 | no |
| `inputField` | string (expression) | yes (single만) | (없음) | 추출할 텍스트. multi_turn에서는 첫 메시지로 사용 | yes |
| `outputSchema` | `OutputField[]` | yes (1개 이상) | `[]` | 추출할 필드 정의 | no |
| `examples` | `Example[]` | no | `[]` | LLM에게 줄 입력/출력 예시 | no |
| `instructions` | string | no | (없음) | 추가 지시사항 | no |
| `mode` | `'single_turn' \| 'multi_turn'` | no | `'single_turn'` | 추출 모드 | no |
| `maxTurns` | int | no | `10` | (multi) 최대 대화 턴 (`0`=무제한) | no |
| `maxCollectionRetries` | int | no | `3` | (multi) finalize 시 필드 누락 발생 시 재요청 횟수 (`0`=무제한) | no |

`OutputField` 항목:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `name` | string | 필드명 |
| `type` | `'string' \| 'number' \| 'boolean' \| 'array' \| 'object'` | 값 타입 |
| `description` | string | LLM에게 줄 필드 설명 |
| `required` | boolean | 필수 여부 (기본 `true`) |
| `enumValues` | string[] | enum 제약 (선택) |

`Example` 항목:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `input` | string | 예시 입력 텍스트 |
| `output` | object | 추출 결과 예시 |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | (입력은 `inputField` expression으로) |
| Output | `out` | Output | (single_turn) 추출 성공 |
| Output | `error` | Error | 추출 실패 (LLM 호출 또는 JSON 파싱) |
| Output | `completed` | Completed | (multi_turn) 모든 필수 필드 수집 완료 |
| Output | `user_ended` | User Ended | (multi_turn) 사용자가 대화 종료 |
| Output | `max_turns` | Max Turns | (multi_turn) maxTurns 도달 |

> **동적 포트 생성 규칙** (`resolve-dynamic-ports.ts`):
>
> - single_turn: `[out, error]`
> - multi_turn: `[completed, user_ended, max_turns, error]`

## Output

> ⚠️ Information Extractor 핸들러도 AI Agent와 같은 패턴으로 `{ port, data }` 평탄 구조를 반환합니다 (NodeHandlerOutput 표준 모양 아님). expression-resolver의 호환 shim에 의해 후속 노드에서는 한 단계 nested 형태(`output.data.*`)로 보일 수 있습니다.

### Case 1: Single Turn 성공

```json
{
  "port": "out",
  "data": {
    "config": { "schema": [...] },
    "output": {
      "extracted": { "name": "Alice", "age": 30, "email": "a@b.com" },
      "_llmCalls": [{...}]
    },
    "meta": {
      "model": "claude-sonnet-4-6",
      "inputTokens": 200,
      "outputTokens": 80,
      "totalTokens": 280,
      "thinkingTokens": 0
    }
  }
}
```

### Case 2: Single Turn 실패 (LLM 호출 또는 JSON 파싱)

```json
{
  "port": "error",
  "data": {
    "config": { "schema": [...] },
    "output": {
      "error": "JSON parse failed: ...",
      "originalInput": "...",
      "_llmCalls": [{...}]
    },
    "meta": {}
  }
}
```

### Case 3: Multi-Turn 대기 (`waiting_for_input`)

```json
{
  "type": "ai_conversation",
  "status": "waiting_for_input",
  "interactionType": "ai_conversation",
  "config": { "schema": [...], "mode": "multi_turn", "maxCollectionRetries": 3 },
  "conversationConfig": {
    "message": "이메일 주소도 알려주실 수 있을까요?",
    "messages": [...],
    "turnCount": 1,
    "maxTurns": 10,
    "extracted": { "name": "Alice", "age": 30, "email": null },
    "missingFields": ["email"],
    "collectionRetryCount": 0,
    "maxCollectionRetries": 3
  },
  "_multiTurnState": {
    "outputSchema": [...],
    "messages": [...],
    "partialResult": { "name": "Alice", "age": 30 },
    "turnCount": 1,
    "totalInputTokens": 100,
    "totalOutputTokens": 30,
    ...
  }
}
```

### Case 4: Multi-Turn 종료 (`completed` / `user_ended` / `max_turns`)

```json
{
  "port": "completed",
  "data": {
    "config": { "schema": [...], "mode": "multi_turn" },
    "output": {
      "extracted": { "name": "Alice", "age": 30, "email": "a@b.com" },
      "messages": [...],
      "endReason": "completed",
      "turnCount": 3,
      "collectionRetryCount": 0,
      "_turnDebugHistory": [...]
    },
    "meta": {
      "model": "...",
      "inputTokens": 500,
      "outputTokens": 200,
      "totalTokens": 700,
      "thinkingTokens": 0,
      "interactionType": "ai_conversation"
    }
  }
}
```

`endReason: "max_retries"` 면 `port: "error"`.

| 필드 | 설명 |
| --- | --- |
| `data.output.extracted` | 추출된 객체 (스키마의 모든 필드 키 보장; 미수집은 `null`) |
| `data.output.endReason` | `"completed"`, `"user_ended"`, `"max_turns"`, `"max_retries"`, `"error"` |
| `data.output.turnCount` | (multi) 진행된 턴 수 |
| `data.output.collectionRetryCount` | (multi) finalize 재시도 횟수 |
| `data.output._turnDebugHistory` | LLM 호출 trace |
| `data.meta.totalTokens` | 누적 토큰 |

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Extract Profile`이라고 가정.

### Single-turn 성공:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Extract Profile"].output.data.output.extracted }}` | `{ name: "Alice", age: 30 }` | 추출된 객체 |
| `{{ $node["Extract Profile"].output.data.output.extracted.name }}` | `"Alice"` | 특정 필드 |
| `{{ $node["Extract Profile"].port }}` | `"out"` | 포트 |
| `{{ $node["Extract Profile"].output.data.meta.totalTokens }}` | `280` | 토큰 |

### Multi-turn 완료:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Extract Profile"].port }}` | `"completed"` | 종료 사유에 따른 포트 |
| `{{ $node["Extract Profile"].output.data.output.extracted }}` | `{...}` | 최종 추출 객체 |
| `{{ $node["Extract Profile"].output.data.output.endReason }}` | `"completed"` | 종료 사유 |
| `{{ $node["Extract Profile"].output.data.output.turnCount }}` | `3` | 진행된 턴 수 |

### Multi-turn 대기 중:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Extract Profile"].output.status }}` | `"waiting_for_input"` | 대기 상태 |
| `{{ $node["Extract Profile"].output.conversationConfig.extracted }}` | `{ name: "Alice", email: null }` | 현재까지 수집 |
| `{{ $node["Extract Profile"].output.conversationConfig.missingFields }}` | `["email"]` | 미수집 필드 |
| `{{ $node["Extract Profile"].output.conversationConfig.message }}` | `"이메일은요?"` | 봇이 이번 턴에 한 followup 질문 |

### Error:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Extract Profile"].output.data.output.error }}` | `"JSON parse failed"` | 에러 메시지 |
| `{{ $node["Extract Profile"].port }}` | `"error"` | error 포트 |

## 주의사항

- `outputSchema`에 최소 1개 필드 필요. 각 필드의 `name`, `type` 필수.
- single_turn에서 `inputField` 필수. multi_turn에서는 `inputField` 없으면 사용자가 첫 메시지를 보낼 때까지 즉시 대기.
- single_turn은 LLM 응답이 JSON 파싱 실패하면 최대 2회 재시도, 모두 실패하면 `error` 포트.
- multi_turn은 LLM에게 `finalize_extraction` 도구를 제공. LLM이 도구를 호출하면 추출 시도, 누락 필드 있으면 다시 사용자에게 질문 (`maxCollectionRetries`까지).
- **`extracted` 객체는 항상 모든 schema field 키를 포함**합니다. 미수집은 `null`로 채워지므로 후속 노드에서 안전하게 dot-access 가능.
- multi-turn 종료 사유:
  - `completed`: 모든 required 필드 수집됨
  - `user_ended`: 사용자가 명시적 종료
  - `max_turns`: 턴 상한 도달
  - `max_retries`: finalize 재시도 횟수 초과 (→ error 포트)
  - `error`: LLM 호출 실패 (→ error 포트)
- `__workspaceId`가 `context.variables`에 있어야 함.
