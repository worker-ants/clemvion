# Text Classifier (`text_classifier`)

> 입력 텍스트를 사용자 정의 카테고리 중 하나(single-label) 또는 여러 개(multi-label)로 LLM 기반 분류합니다. 매칭된 카테고리에 해당하는 동적 포트로 라우팅됩니다.

- **카테고리**: `ai`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: yes (`kind: "classifier-categories"`)

구현 위치: `backend/src/nodes/ai/text-classifier/`
- `text-classifier.schema.ts` / `text-classifier.handler.ts` / `text-classifier.component.ts`

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `llmConfigId` | string | no | (없음) | LLM Provider 설정 ID. 미지정 시 워크스페이스 기본값 사용 | no |
| `model` | string | no | (없음) | 모델 오버라이드. 미지정 시 provider `defaultModel` | no |
| `inputField` | string (expression) | yes | (없음) | 분류할 텍스트. 보통 `{{ $input.text }}` 같은 expression 사용 | yes |
| `categories` | `Category[]` | yes (≥ 1개) | `[]` | 분류 카테고리 목록. 각 항목 `{ name, description, examples? }` | no |
| `instructions` | string | no | (없음) | LLM에게 줄 추가 분류 지시. systemPrompt에 append | no |
| `includeConfidence` | boolean | no | `false` | `true`면 각 매칭에 `confidence` (0~1) 포함 | no |
| `multiLabel` | boolean | no | `false` | `true`면 여러 카테고리 동시 매칭 (multi-label) | no |

`Category` 항목:

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `name` | string | yes | 카테고리 이름. `__none__`은 **예약어로 사용 불가** (single-label fallback sentinel) |
| `description` | string | yes | 카테고리 설명. LLM 프롬프트에 포함 |
| `examples` | string[] | no (기본 `[]`) | 예시 텍스트 목록. LLM 프롬프트 내 `Examples: ...` 섹션에 포함 |

### Validate 규칙

- `categories.length >= 1` 필수. 각 카테고리의 `name` 필수.
- `name === '__none__'` 거부 (`Category N: "__none__" is a reserved name`).
- `inputField` 필수.

## Ports

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | 주 입력 (실제 분류 대상은 `inputField` expression으로 받음) |
| Output | `class_<index>` | (categories[i].name) | data | **동적** — 매칭된 카테고리 포트 (`categories[i]`에 대응) |
| Output | `fallback` | Fallback | data | 어떤 카테고리에도 매칭되지 않을 때 (`__none__`, 빈 배열, 또는 매칭 실패) |
| Output | `error` | Error | error | LLM 호출 실패 시 |

### 동적 포트 생성 규칙

컴포넌트 메타데이터 `dynamicPorts = { kind: 'classifier-categories', fallbackId: 'fallback', errorId: 'error' }` 에 따라 `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` 의 `classifierCategoriesPorts`가 다음과 같이 포트를 생성합니다.

```
categories.map((c, i) => ({ id: `class_${i}`, label: c.name || `Category ${i+1}`, type: 'data' }))
  .concat([
    { id: 'fallback', label: 'Fallback', type: 'data' },
    { id: 'error',    label: 'Error',    type: 'error' },
  ])
```

## Input

핸들러는 `input` 파라미터를 직접 사용하지 않습니다. expression resolver가 `inputField` expression을 평가한 결과 문자열이 LLM의 user 메시지로 전달됩니다. workspace 식별을 위해 `context.variables.__workspaceId` 가 필요.

## Output

> 이 핸들러는 **표준 `NodeHandlerOutput` 모양** `{ config, output, meta, port }` 으로 반환합니다 (ai_agent와 다름). 따라서 후속 노드에서는 `$node["X"].output.<field>` / `$node["X"].meta.<field>` / `$node["X"].port` 로 각각 접근 가능합니다.

### Case 1: Single-label 매칭 성공

```json
{
  "config": {
    "categories": [{ "name": "Billing", "description": "Payment" }, { "name": "Tech", "description": "Technical" }],
    "inputField": "I need a refund",
    "multiLabel": false
  },
  "output": {
    "category": "Billing",
    "confidence": 0.95,
    "originalInput": "I need a refund",
    "_llmCalls": [ { "requestPayload": {...}, "responsePayload": {...}, "durationMs": 420 } ]
  },
  "meta": {
    "model": "gpt-4o-mini",
    "inputTokens": 50,
    "outputTokens": 10,
    "totalTokens": 60,
    "thinkingTokens": 0
  },
  "port": "class_0"
}
```

- `port = class_<index>` — matched category의 `categories` 배열 내 index로 결정.
- `confidence`는 `includeConfidence: true`일 때만 포함. `0` 값도 보존됨 (falsy 처리 X).
- JSON 파싱 실패 시 LLM 응답 텍스트 안에서 카테고리 이름을 substring 검색해 첫 매칭으로 fallback 추출.

### Case 2: Single-label Fallback

LLM이 `__none__`을 반환하거나, 모르는 카테고리를 반환했거나, JSON 파싱 후에도 매칭이 안 될 때:

```json
{
  "config": { "categories": [...], "inputField": "...", "multiLabel": false },
  "output": {
    "category": null,
    "confidence": 0.1,
    "originalInput": "Random off-topic text",
    "_llmCalls": [ ... ]
  },
  "meta": { "model": "gpt-4o-mini", "inputTokens": 50, "outputTokens": 10, "totalTokens": 60 },
  "port": "fallback"
}
```

- `output.category`는 `null`.

### Case 3: Multi-label 매칭

```json
{
  "config": {
    "categories": [
      { "name": "Billing", "description": "..." },
      { "name": "Tech", "description": "..." },
      { "name": "General", "description": "..." }
    ],
    "inputField": "I need a refund and the app is crashing",
    "multiLabel": true
  },
  "output": {
    "categories": [
      { "name": "Billing", "confidence": 0.9 },
      { "name": "Tech", "confidence": 0.85 }
    ],
    "originalInput": "I need a refund and the app is crashing",
    "_llmCalls": [ ... ]
  },
  "meta": { "model": "gpt-4o-mini", "inputTokens": 50, "outputTokens": 20, "totalTokens": 70 },
  "port": ["class_0", "class_1"]
}
```

- `port`는 **string 배열** — 엔진은 이 배열의 모든 포트를 동시에 fan-out 활성화 (`NodeHandlerOutput.port`가 `string[]`일 때의 의미).
- LLM이 반환한 카테고리 중 `config.categories` 에 존재하지 않는 이름은 필터링됨.
- `includeConfidence: false`면 각 항목에서 `confidence` 필드 생략.

### Case 4: Multi-label Fallback

LLM이 빈 배열을 반환하거나 모든 항목이 필터링된 경우:

```json
{
  "config": { "categories": [...], "inputField": "...", "multiLabel": true },
  "output": {
    "categories": [],
    "originalInput": "...",
    "_llmCalls": [ ... ]
  },
  "meta": { "model": "...", "inputTokens": 50, "outputTokens": 10, "totalTokens": 60 },
  "port": "fallback"
}
```

### Case 5: 에러 (LLM 호출 실패)

핸들러가 LLM 예외를 catch하고 `error` 포트로 라우팅:

```json
{
  "config": {
    "categories": [...],
    "inputField": "...",
    "multiLabel": false
  },
  "output": {
    "error": "API timeout",
    "originalInput": "...",
    "_llmCalls": [
      { "requestPayload": {...}, "responsePayload": null, "durationMs": 5020 }
    ]
  },
  "meta": {},
  "port": "error"
}
```

- `output.error`에 예외 메시지. `output.category` / `output.categories` 는 포함되지 않음.
- `meta`는 빈 객체 (LLM 응답이 없으므로 토큰 정보 없음).

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Intent Classifier`라고 가정합니다. `categories = [ { name: "Billing", ... }, { name: "Tech", ... } ]`.

### Single-label 성공

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Intent Classifier"].output.category }}` | `"Billing"` |
| `{{ $node["Intent Classifier"].output.confidence }}` | `0.95` |
| `{{ $node["Intent Classifier"].output.originalInput }}` | `"I need a refund"` |
| `{{ $node["Intent Classifier"].port }}` | `"class_0"` |
| `{{ $node["Intent Classifier"].meta.model }}` | `"gpt-4o-mini"` |
| `{{ $node["Intent Classifier"].meta.totalTokens }}` | `60` |
| `{{ $node["Intent Classifier"].config.multiLabel }}` | `false` |

### Single-label Fallback

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Intent Classifier"].output.category }}` | `null` |
| `{{ $node["Intent Classifier"].port }}` | `"fallback"` |

### Multi-label

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Intent Classifier"].output.categories }}` | `[ { name: "Billing", confidence: 0.9 }, { name: "Tech", confidence: 0.85 } ]` |
| `{{ $node["Intent Classifier"].output.categories[0].name }}` | `"Billing"` |
| `{{ $node["Intent Classifier"].port }}` | `["class_0", "class_1"]` |

### Error

| 표현식 | 값 예시 |
| --- | --- |
| `{{ $node["Intent Classifier"].output.error }}` | `"API timeout"` |
| `{{ $node["Intent Classifier"].port }}` | `"error"` |

## 주의사항

- **LLM 비용**: 매 실행마다 단일 LLM 호출이 발생합니다 (tool-calling 없음, JSON 응답 강제).
- **Single-label 의 fallback 전략**: LLM에게 주어지는 system prompt에는 자동으로 `"__none__"` sentinel이 enum에 추가되어, 모호할 때 `__none__` 반환하도록 안내됩니다. 이 경우 `output.category = null`, `port = "fallback"`.
- **Multi-label 빈 배열**: LLM이 명시적으로 빈 배열을 반환하거나, 알 수 없는 이름만 반환하여 필터링 후 비었을 때 `port = "fallback"`.
- **Confidence threshold 없음**: 핸들러는 confidence 점수를 기반으로 reject하거나 fallback으로 분기하지 않습니다. LLM이 반환한 값을 그대로 사용 (필요 시 후속 `If/Else` 노드에서 `output.confidence < 0.5` 등 체크).
- **JSON 파싱 실패 시 substring fallback**: `single-label`은 LLM 응답 텍스트에서 category 이름을 첫 번째로 포함하는 것을 추출. `multi-label`은 모든 포함된 이름을 `{ name, confidence: 0 }`으로 추출 (`includeConfidence`일 때).
- **예약어**: `__none__`은 카테고리 이름으로 사용 불가 (validate 실패).
- **Port 다중 활성화**: Multi-label에서 `port`가 `string[]`로 반환되며 엔진이 해당하는 모든 엣지를 동시에 활성화합니다 (NodeHandlerOutput contract).
- **`_llmCalls`** 배열은 디버그용 trace (request/response payload + duration). Frontend LlmInformationTab이 렌더링.
- **Workspace**: `context.variables.__workspaceId`가 없으면 `''`로 fallback되어 LLM config 해석이 workspace 기본값 없이 진행됩니다.
