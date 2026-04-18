# Text Classifier (`text_classifier`)

> 입력 텍스트를 사용자 정의 카테고리 중 하나(또는 multi-label 모드에서는 여러 개)로 LLM 기반 분류합니다. 매칭된 카테고리에 해당하는 동적 포트로 라우팅됩니다.

- **카테고리**: `ai`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: yes (`classifier-categories`)

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `llmConfigId` | string | no | (없음) | LLM Provider 설정 ID | no |
| `model` | string | no | (없음) | 모델 오버라이드 | no |
| `inputField` | string (expression) | yes | (없음) | 분류할 텍스트 (보통 `{{ $input.text }}` 같은 expression) | yes |
| `categories` | `Category[]` | yes (1개 이상) | `[]` | 분류 카테고리 목록 | no |
| `instructions` | string | no | (없음) | LLM에게 줄 추가 분류 지시 | no |
| `includeConfidence` | boolean | no | `false` | 응답에 confidence 점수 포함 | no |
| `multiLabel` | boolean | no | `false` | true면 여러 카테고리 동시 매칭 (multi-label) | no |

`Category` 항목:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `name` | string | 카테고리 이름 (`__none__`은 예약어로 사용 불가) |
| `description` | string | 카테고리 설명 (LLM에게 제공) |
| `examples` | string[] | 예시 텍스트 목록 (선택, LLM 프롬프트에 포함) |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | (실제 분류는 `inputField` expression으로 받음) |
| Output | `class_<index>` | (카테고리 이름) | **동적** — 매칭된 카테고리 포트 (`categories[i]`에 대응) |
| Output | `fallback` | Fallback | 어떤 카테고리에도 매칭되지 않을 때 (`__none__` 또는 빈 응답) |
| Output | `error` | Error | LLM 호출 실패 시 |

> **동적 포트 생성 규칙** (`resolve-dynamic-ports.ts`):
> `categories.map((c, i) => { id: "class_${i}", label: c.name, type: "data" })` + `[fallback, error]`

## Input

핸들러 자체는 input을 직접 사용하지 않고, `inputField` expression이 expression resolver에 의해 미리 평가된 값을 사용합니다. 일반적으로 `inputField: "{{ $input.message }}"` 형태로 설정합니다.

## Output

### Case 1: Single label 매칭 성공

config: `{ inputField: "환불 가능한가요?", categories: [{name:"refund"}, {name:"shipping"}], includeConfidence: true }`

```json
{
  "config": { "categories": [...], "inputField": "환불 가능한가요?", "multiLabel": false },
  "output": {
    "category": "refund",
    "confidence": 0.92,
    "originalInput": "환불 가능한가요?",
    "_llmCalls": [{ "requestPayload": {...}, "responsePayload": {...}, "durationMs": 800 }]
  },
  "meta": {
    "model": "claude-sonnet-4-6",
    "inputTokens": 200,
    "outputTokens": 30,
    "totalTokens": 230,
    "thinkingTokens": 0
  },
  "port": "class_0"
}
```

### Case 2: Single label 미매칭 → fallback

```json
{
  "config": { ... },
  "output": {
    "category": null,
    "originalInput": "...",
    "_llmCalls": [...]
  },
  "meta": { ... },
  "port": "fallback"
}
```

### Case 3: Multi-label 매칭

```json
{
  "config": { ..., "multiLabel": true },
  "output": {
    "categories": [
      { "name": "refund", "confidence": 0.85 },
      { "name": "shipping", "confidence": 0.6 }
    ],
    "originalInput": "환불하고 배송 추적도 같이 필요해요",
    "_llmCalls": [...]
  },
  "meta": { ... },
  "port": ["class_0", "class_1"]
}
```

### Case 4: LLM 호출 실패

```json
{
  "config": { ... },
  "output": {
    "error": "Network timeout",
    "originalInput": "...",
    "_llmCalls": [{ "requestPayload": {...}, "responsePayload": null, "durationMs": 5000 }]
  },
  "meta": {},
  "port": "error"
}
```

| 필드 | 설명 |
| --- | --- |
| `output.category` (single) | 매칭 카테고리 이름. `null`이면 fallback |
| `output.confidence` (single) | 0~1, `includeConfidence: true`일 때만 |
| `output.categories` (multi) | 매칭된 카테고리 객체 배열 |
| `output.originalInput` | 분류된 원본 텍스트 |
| `output._llmCalls` | LLM 호출 trace (디버그) |
| `meta.*` | 토큰 사용량, 모델 정보 |
| `port` | 매칭된 `class_<i>` 또는 `fallback` 또는 `error`. multi-label에서는 배열 |

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Intent Classify`라고 가정.

### Single-label:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Intent Classify"].output.category }}` | `"refund"` 또는 `null` | 분류 결과 |
| `{{ $node["Intent Classify"].output.confidence }}` | `0.92` | (includeConfidence: true일 때) |
| `{{ $node["Intent Classify"].output.originalInput }}` | `"환불 가능한가요?"` | 분류 대상 텍스트 |
| `{{ $node["Intent Classify"].port }}` | `"class_0"` 또는 `"fallback"` | 매칭 포트 ID |
| `{{ $node["Intent Classify"].meta.totalTokens }}` | `230` | 사용 토큰 |

### Multi-label:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Intent Classify"].output.categories }}` | `[{name:"refund", confidence: 0.85}, ...]` | 매칭 카테고리 배열 |
| `{{ $node["Intent Classify"].output.categories[0].name }}` | `"refund"` | 첫 매칭 카테고리 이름 |
| `{{ $node["Intent Classify"].port }}` | `["class_0", "class_1"]` | 활성화된 포트 배열 |

### Error:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Intent Classify"].output.error }}` | `"Network timeout"` | 에러 메시지 |
| `{{ $node["Intent Classify"].port }}` | `"error"` | error 포트 활성 |

## 주의사항

- `categories[].name`에 `__none__`은 사용 불가 (예약어). validation 실패.
- `inputField`가 없으면 validation 실패. 보통 expression으로 `{{ $input.text }}` 형식 사용.
- LLM 응답이 JSON 파싱 실패 시 fallback으로 카테고리 이름이 응답 텍스트에 포함되어 있는지 검사 (substring 매칭).
- multi-label에서 매칭 결과가 빈 배열이면 `port: "fallback"` (단일 문자열)로 라우팅.
- `port`가 multi-label에서 **배열**일 수 있음 — 여러 포트 동시 활성화. 이 경우 활성화된 모든 포트의 후속 노드들이 실행됨.
- `__workspaceId`가 `context.variables`에 있어야 LLM 설정이 워크스페이스별로 해석됨.
- LLM은 자체 `responseFormat: 'json'` + `jsonSchema` enum 강제로 카테고리 이름을 정확히 반환하도록 유도.
