# Text Classifier (`text_classifier`) — Output 일관성 개선안

- **카테고리**: `ai`
- **현재 스펙**: [`user_memo/node-specs/ai/text_classifier.md`](../../node-specs/ai/text_classifier.md)
- **공통 규칙**: [`CONVENTIONS.md`](../CONVENTIONS.md)
- **우선순위**: P1 (AI 카테고리 내에서는 상대적으로 위반이 적지만, `ai_agent` / `information_extractor` 와의 네이밍 통일을 위해 함께 정리)

> 이미 `meta` 에 토큰/모델이 올바르게 위치하고 있어 **P2 위반은 없음**. 주된 개선 포인트는 single-label vs multi-label 출력의 네이밍 비대칭(`category` vs `categories`) 을 `output.result` 하위로 통일하고, 에러 shape 을 표준화하는 것입니다.

---

## 1. 현재 Output 구조 요약

### Case 1: Single-label 매칭 성공

```json
{
  "config": {
    "categories": [{ "name": "Billing", "description": "Payment" }, { "name": "Tech", "description": "Technical" }],
    "inputField": "I need a refund",
    "multiLabel": false,
    "includeConfidence": true
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

### Case 2: Single-label Fallback

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

### Case 3: Multi-label 매칭

```json
{
  "config": { "categories": [...], "inputField": "...", "multiLabel": true },
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

### Case 4: Multi-label Fallback

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

```json
{
  "config": { "categories": [...], "inputField": "...", "multiLabel": false },
  "output": {
    "error": "API timeout",
    "originalInput": "...",
    "_llmCalls": [ { "requestPayload": {...}, "responsePayload": null, "durationMs": 5020 } ]
  },
  "meta": {},
  "port": "error"
}
```

---

## 2. 식별된 불일치

| # | 위반 내용 | 관련 Principle | 심각도 |
| --- | --- | --- | --- |
| I1 | Single-label은 `output.category` (string) + `output.confidence` (루트 평탄), Multi-label은 `output.categories` (`{name, confidence}[]`) — 같은 "분류 결과" 개념이 전혀 다른 shape | **P8 (중첩 제거/통일)** | High |
| I2 | `output._llmCalls` 가 디버그용임에도 `output` (비즈니스 데이터 영역) 에 위치 | **P2 (meta는 메트릭만)**, P1 | Medium |
| I3 | `output.error: string` — `output.error.{code, message}` 표준 shape 미준수 | **P3.2 (에러 표준)** | High |
| I4 | 에러 시 `meta: {}` 빈 객체 — `meta.durationMs` 최소 보장 규약 누락 | P2 | Medium |
| I5 | Single-label fallback 시 `output.confidence` 는 여전히 포함되지만 Multi-label fallback은 `categories: []` 만 → `confidence` 필드 유무가 비대칭 | P8 | Low |
| I6 | `originalInput` 은 사실상 `config.inputField` 의 resolved 값과 동일 → 중복 echo (경미) | P7 (config echo) | Low |

---

## 3. 제안된 Output 구조

**원칙**: "LLM 계열 노드는 `output.result` 아래에 도메인 결과를 모은다" (P8). Single/Multi 구분 없이 `output.result.*` 를 공유.

### Case 1 (After): Single-label 매칭 성공

```json
{
  "config": {
    "categories": [
      { "name": "Billing", "description": "Payment" },
      { "name": "Tech", "description": "Technical" }
    ],
    "inputField": "I need a refund",
    "multiLabel": false,
    "includeConfidence": true
  },
  "output": {
    "result": {
      "category": "Billing",
      "confidence": 0.95,
      "originalInput": "I need a refund"
    }
  },
  "meta": {
    "durationMs": 420,
    "model": "gpt-4o-mini",
    "inputTokens": 50,
    "outputTokens": 10,
    "totalTokens": 60,
    "thinkingTokens": 0,
    "llmCalls": [ { "requestPayload": {...}, "responsePayload": {...}, "durationMs": 420 } ]
  },
  "port": "class_0"
}
```

### Case 2 (After): Single-label Fallback

```json
{
  "config": { "categories": [...], "inputField": "...", "multiLabel": false, "includeConfidence": true },
  "output": {
    "result": {
      "category": null,
      "confidence": 0.1,
      "originalInput": "Random off-topic text"
    }
  },
  "meta": {
    "durationMs": 380,
    "model": "gpt-4o-mini",
    "inputTokens": 50,
    "outputTokens": 10,
    "totalTokens": 60,
    "llmCalls": [ ... ]
  },
  "port": "fallback"
}
```

### Case 3 (After): Multi-label 매칭

```json
{
  "config": {
    "categories": [
      { "name": "Billing", "description": "..." },
      { "name": "Tech", "description": "..." },
      { "name": "General", "description": "..." }
    ],
    "inputField": "I need a refund and the app is crashing",
    "multiLabel": true,
    "includeConfidence": true
  },
  "output": {
    "result": {
      "categories": [
        { "name": "Billing", "confidence": 0.9 },
        { "name": "Tech", "confidence": 0.85 }
      ],
      "originalInput": "I need a refund and the app is crashing"
    }
  },
  "meta": {
    "durationMs": 510,
    "model": "gpt-4o-mini",
    "inputTokens": 50,
    "outputTokens": 20,
    "totalTokens": 70,
    "llmCalls": [ ... ]
  },
  "port": ["class_0", "class_1"]
}
```

### Case 4 (After): Multi-label Fallback

```json
{
  "config": { "categories": [...], "inputField": "...", "multiLabel": true, "includeConfidence": true },
  "output": {
    "result": {
      "categories": [],
      "originalInput": "..."
    }
  },
  "meta": {
    "durationMs": 370,
    "model": "gpt-4o-mini",
    "inputTokens": 50,
    "outputTokens": 10,
    "totalTokens": 60,
    "llmCalls": [ ... ]
  },
  "port": "fallback"
}
```

### Case 5 (After): 에러

```json
{
  "config": { "categories": [...], "inputField": "...", "multiLabel": false },
  "output": {
    "error": {
      "code": "LLM_CALL_FAILED",
      "message": "OpenAI API timeout after 5020ms",
      "details": { "provider": "openai", "inputField": "...", "attempt": 1 }
    }
  },
  "meta": {
    "durationMs": 5020,
    "model": "gpt-4o-mini",
    "llmCalls": [ { "requestPayload": {...}, "responsePayload": null, "durationMs": 5020 } ]
  },
  "port": "error"
}
```

`code` 예약어:
- `LLM_CALL_FAILED` — provider 네트워크/타임아웃/5xx.
- `LLM_RATE_LIMITED` — 429.
- `LLM_RESPONSE_INVALID` — JSON 파싱 실패 + substring fallback 도 실패.

### 핵심 변화 요약

1. **네이밍 통일**: Single은 `output.result.category` (string|null), Multi는 `output.result.categories` (array). 모두 `output.result` wrapper 하위. `confidence` / `originalInput` 도 함께 `result` 하위로 이동 (P8).
2. **Debug trace 이동**: `output._llmCalls` → `meta.llmCalls` (P2). 디버그 정보는 `meta` 로 통일.
3. **에러 표준**: `output.error: string` → `output.error.{code, message, details?}` (P3.2).
4. **`meta.durationMs` 필수화**: 에러 case 포함 모든 경우에 `meta.durationMs` 보장 (P2).

---

## 4. 마이그레이션 영향도

노드 라벨 `Intent Classifier` 기준, 현재 → 개선 후 경로 대조표:

### Single-label 성공/Fallback

| 현재 | 개선 후 | 비고 |
| --- | --- | --- |
| `$node["Intent Classifier"].output.category` | `$node["Intent Classifier"].output.result.category` | P8 |
| `$node["Intent Classifier"].output.confidence` | `$node["Intent Classifier"].output.result.confidence` | P8 |
| `$node["Intent Classifier"].output.originalInput` | `$node["Intent Classifier"].output.result.originalInput` | P8 |
| `$node["Intent Classifier"].output._llmCalls` | `$node["Intent Classifier"].meta.llmCalls` | P2 |
| `$node["Intent Classifier"].port` | `$node["Intent Classifier"].port` | (불변) `class_N` / `fallback` |
| `$node["Intent Classifier"].meta.model` | `$node["Intent Classifier"].meta.model` | (불변) |
| `$node["Intent Classifier"].meta.inputTokens` | `$node["Intent Classifier"].meta.inputTokens` | (불변) |
| `$node["Intent Classifier"].meta.outputTokens` | `$node["Intent Classifier"].meta.outputTokens` | (불변) |
| `$node["Intent Classifier"].meta.totalTokens` | `$node["Intent Classifier"].meta.totalTokens` | (불변) |
| (없음) | `$node["Intent Classifier"].meta.durationMs` | 신설 (P2 필수) |

### Multi-label

| 현재 | 개선 후 | 비고 |
| --- | --- | --- |
| `$node["Intent Classifier"].output.categories` | `$node["Intent Classifier"].output.result.categories` | P8 |
| `$node["Intent Classifier"].output.categories[0].name` | `$node["Intent Classifier"].output.result.categories[0].name` | P8 |
| `$node["Intent Classifier"].output.categories[0].confidence` | `$node["Intent Classifier"].output.result.categories[0].confidence` | P8 |
| `$node["Intent Classifier"].output.originalInput` | `$node["Intent Classifier"].output.result.originalInput` | P8 |
| `$node["Intent Classifier"].output._llmCalls` | `$node["Intent Classifier"].meta.llmCalls` | P2 |
| `$node["Intent Classifier"].port` (string[]) | `$node["Intent Classifier"].port` (string[]) | (불변) |

### 에러

| 현재 | 개선 후 | 비고 |
| --- | --- | --- |
| `$node["Intent Classifier"].output.error` (string) | `$node["Intent Classifier"].output.error.message` | P3.2 |
| (없음) | `$node["Intent Classifier"].output.error.code` | 신설 |
| (없음) | `$node["Intent Classifier"].output.error.details` | 신설 |
| `$node["Intent Classifier"].output.originalInput` | `$node["Intent Classifier"].output.error.details.originalInput` (or config.inputField) | 에러 시 비즈니스 데이터 없음 |
| `$node["Intent Classifier"].output._llmCalls` | `$node["Intent Classifier"].meta.llmCalls` | P2 |
| (없음) | `$node["Intent Classifier"].meta.durationMs` | 신설 |

### 영향 범위 요약

- **Breaking change 규모**: 경로 **~10개**. `ai_agent` 대비 소규모. 대부분의 변경은 `output.*` → `output.result.*` 한 단계 중첩 추가이므로 단순 sed 치환으로도 대응 가능.
- **영향받는 백엔드**: `backend/src/nodes/ai/text-classifier/text-classifier.handler.ts` — 핸들러의 반환 객체 재구성 + `meta.durationMs` 계산 추가 + `output.error` 표준화.
- **영향받는 프런트엔드**: autocomplete schema (`text-classifier.schema.ts` 주석 또는 schema exports) — 새 경로 반영.

### 하위호환(backward-compat) 전략

1. **Shim 릴리스 (v1)**: expression resolver 에서 legacy path alias 주입.
   - `output.category` → `output.result.category` 위임.
   - `output.categories` → `output.result.categories` 위임.
   - `output.confidence` → `output.result.confidence` 위임.
   - `output.originalInput` → `output.result.originalInput` 위임.
   - `output._llmCalls` → `meta.llmCalls` 위임.
   - `output.error` 에 string 접근 시 `output.error.message` 반환.
   - 사용 시 1회 deprecation warning.
2. **Migration CLI**: `pnpm workflow:migrate-text-classifier` 로 기존 workflow JSON 일괄 치환.
3. **v2**: shim 제거.

---

## 5. 근거

### 5.1. CONVENTIONS 매핑

| Principle | 본 개선안이 해결하는 내용 |
| --- | --- |
| **P1** (output은 비즈니스 데이터) | `_llmCalls` 디버그 trace를 `meta` 로 이동. `output` 에는 분류 결과/입력만 남김. |
| **P2** (meta는 메트릭) | `meta.llmCalls` 로 trace 이동 + `meta.durationMs` 필수화. 기존의 모델/토큰 위치는 이미 준수 상태 유지. |
| **P3** (에러 컨트랙트) | `output.error: string` → `output.error.{code, message, details?}` 표준 shape. `LLM_CALL_FAILED` / `LLM_RATE_LIMITED` / `LLM_RESPONSE_INVALID` 예약어. |
| **P5** (port 활성화) | multi-label `port: string[]` fan-out 는 이미 P5 를 준수 — 유지. |
| **P6** (동적 포트 네이밍) | `class_<index>` + `fallback` + `error` 규칙 유지. 유일한 변경은 사용자 카테고리 이름이 시스템 예약어(`out`, `error`, `default`, `done`, `user_ended`, `max_turns`, `completed`, `fallback`, `continue`) 와 충돌할 경우 프런트 validate 거부 추가. |
| **P8** (중첩 제거/통일) | Single/Multi 모두 `output.result.*` wrapper 하위로 통일. `ai_agent` / `information_extractor` 와 동일한 "결과 wrapper" 규약 공유. |
| **P11** (문서화) | Case 1~5 JSON + 경로표 포맷이 향후 node-specs/ai/text_classifier.md 의 표준 레이아웃. |

### 5.2. 디자인 결정 배경

- **Single의 `category` 와 Multi의 `categories` 이름을 굳이 통일하지 않는 이유**: 두 case는 **타입이 다릅니다**(`string|null` vs `Array<{name,confidence}>`). 같은 이름을 쓰면 expression 작성자가 `output.result.category[0]` 을 Multi에서 쓰려 할 때 동작이 달라져 오류가 오히려 늘어납니다. **서로 다른 shape 은 서로 다른 이름** 을 유지하되 공통 wrapper(`output.result`) 하위에 두어 예측성을 확보하는 것이 더 낫다고 판단했습니다. (Principle 8의 "통일"은 경로 모양의 통일이지, 의미가 다른 필드의 이름 통일이 아님.)
- **`originalInput` 을 `config.inputField` 로 옮기지 않는 이유**: `config.inputField` 는 resolver **원문** (expression 포함), `output.result.originalInput` 은 **resolved 결과** 입니다. 디버깅 시 "실제 LLM에 들어간 텍스트" 를 보는 용도로 분리 유지. (P7 echo 대상과 별개.)
- **`confidence` 를 result 루트에 두는 이유 (Single)**: `result.confidence` 는 `result.category` 와 1:1 대응되는 동일 레벨 메타속성. `result.category.confidence` 는 Multi 의 항목 단위 confidence 와 혼동을 유발. Single 결과를 "스칼라 + 부가 스칼라" 로 두는 것이 자연스러움.
- **에러 시 `meta.llmCalls` 보존**: 실패한 call 의 request payload 는 디버깅에 핵심. `responsePayload: null` 로 실패를 표현 (기존 관습 유지).

### 5.3. `ai_agent` / `information_extractor` 와의 일관성

| 개념 | ai_agent | text_classifier | information_extractor |
| --- | --- | --- | --- |
| 결과 wrapper | `output.result` | `output.result` | `output.result` |
| 1차 결과 | `result.response` | `result.category` / `result.categories` | `result.extracted` |
| 에러 shape | `output.error.{code,message,details}` | `output.error.{code,message,details}` | `output.error.{code,message,details}` |
| 토큰 위치 | `meta.{inputTokens,outputTokens,totalTokens}` | `meta.{inputTokens,outputTokens,totalTokens}` | `meta.{inputTokens,outputTokens,totalTokens}` |
| Trace | `meta.turnDebug` | `meta.llmCalls` | `meta.turnDebug` |
| `meta.durationMs` | 필수 | 필수 | 필수 |

→ AI 카테고리 3개 노드가 **동일 네이밍 규약**을 공유합니다. 워크플로우 작성자는 "어떤 LLM 노드든 `output.result` 와 `meta` 만 기억하면 된다" 는 단일 mental model 로 수렴합니다.
