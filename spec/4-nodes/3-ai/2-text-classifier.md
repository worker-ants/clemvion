---
id: text-classifier
status: spec-only
code: []
---

# Spec: Text Classifier

> 관련 문서: [AI 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec LLM Config](../../2-navigation/6-config.md) · [CONVENTIONS](../../conventions/node-output.md)

LLM 을 사용하여 입력 텍스트를 미리 정의된 카테고리로 분류한다. **Single-label** (정확히 한 카테고리 또는 매칭 없음) 또는 **Multi-label** (해당하는 모든 카테고리 동시 활성화) 모드를 지원한다.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| llmConfigId | UUID | | — | 사용할 LLM 프로바이더 설정. [공통 §1](./0-common.md#1-llm-모델config-선택) |
| model | String | | — | 모델 ID (프로바이더별) |
| inputField | Expression | ✓ | — | 분류할 텍스트 필드 (`{{ ... }}` 표현식 지원) |
| categories | CategoryDef[] | ✓ | `[]` | 분류 카테고리 목록. 1 개 이상 필요 |
| instructions | String | | — | 추가 분류 지시사항 (LLM 시스템 프롬프트에 합쳐짐) |
| includeConfidence | Boolean | | `false` | 신뢰도 점수 포함 여부 |
| includeEvidence | Boolean | | `false` | 분류 근거(입력에서 발췌한 단어/문장) 포함 여부 |
| multiLabel | Boolean | | `false` | Multi-label 분류 모드 |
| includeSystemContext | Boolean | | `true` | systemPrompt 앞에 시각·timezone prefix 자동 prepend. [공통 §11](./0-common.md#11-ai-노드-시스템-프롬프트-자동-prefix-system-context-prefix) |
| systemContextSections | String[] | | `['time', 'timezone']` | prefix 섹션. [공통 §11.1](./0-common.md#111-설정-필드-3-노드-공통) |

> `llmConfigId` 와 `model` 은 schema 상 optional 이지만, 둘 다 비어 있으면 `text_classifier:no-llm-provider` warningRule 이 발화하여 검증 실패한다.

**CategoryDef 구조:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | String? | | 카테고리 안정 id. 출력 포트 핸들(`source_port`)로 사용. 누락·공백·invalid slug 시 `class_${i}` index fallback. 형식: `[a-zA-Z0-9_-]+`, 최대 64자. **설정 UI 에 노출되지 않으며 (hidden) AI Assistant 가 자동 지정**. 카테고리 간 id 중복 금지 — schema validation 차단 |
| name | String | ✓ | 카테고리 이름 (LLM enum 값 + 출력 포트 라벨). `__none__` 은 예약어로 사용 불가 |
| description | String | | 카테고리 설명 (LLM 프롬프트에 포함) |
| examples | String[] | | 예시 텍스트 목록 (프롬프트에 포함) |

> ⚠ **마이그레이션 주의**: 기존 워크플로의 카테고리에 후속으로 `id` 를 추가하면 출력 포트 id 가 `class_${i}` → 사용자 지정 id 로 바뀐다. 그 카테고리에 연결된 기존 엣지(`source_port: class_0` 등)는 dangling 상태가 되므로 엣지를 수동 재연결해야 한다. 신규 카테고리에는 처음부터 `id` 를 지정해 두면 안전.

> Source of truth: `codebase/backend/src/nodes/ai/text-classifier/text-classifier.schema.ts` (export `textClassifierNodeConfigSchema` / `validateTextClassifierConfig`).

## 2. 설정 UI

```
┌──────────────────────────────────────────┐
│  Text Classifier                         │
│  ──────────────────────────────────────  │
│                                          │
│  LLM Provider: [OpenAI ▼]               │
│  Model:        [gpt-4o-mini ▼]          │
│                                          │
│  Input Field: [{{ $input.text }}]        │
│                                          │
│  Instructions:                           │
│  ┌──────────────────────────────────────┐│
│  │ (선택) 추가 분류 가이드              ││
│  └──────────────────────────────────────┘│
│                                          │
│  □ Include Confidence                    │
│  □ Include Evidence                      │
│  □ Multi-label Classification            │
│                                          │
│  ── Categories ──                        │
│  ┌──────────────────────────────────────┐│
│  │ 1. Billing                           ││
│  │    Desc: "결제, 환불, 구독 관련 문의" ││
│  │    Examples: "환불 요청", "결제 실패" ││
│  ├──────────────────────────────────────┤│
│  │ 2. Technical                         ││
│  │    Desc: "기술적 문제, 버그 리포트"   ││
│  │    Examples: "로그인 안됨", "에러"    ││
│  ├──────────────────────────────────────┤│
│  │ 3. General                           ││
│  │    Desc: "일반 문의, 기능 요청"       ││
│  └──────────────────────────────────────┘│
│  [+ Add Category]                        │
└──────────────────────────────────────────┘
```

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 평가 대상 데이터 (1개 필수) |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `<category.id>` 또는 `class_${i}` | `<category.name>` | data | **true** | 카테고리별 동적 포트. `category.id` 가 지정되어 있으면 그 값을 그대로 사용, 누락·공백·invalid slug 시 인덱스 기반 fallback (`class_0`, `class_1`, …). resolver/handler 모두 동일 규칙으로 발급 (CONVENTIONS Principle 6) |
| `fallback` | Fallback | data | false | 어떤 카테고리에도 매칭되지 않을 때 (single: LLM 이 `__none__` 반환 또는 매칭 실패 / multi: 빈 배열) |
| `error` | Error | error | false | LLM API 오류, 타임아웃, rate limit 등 발생 시 |

> Multi-label 모드에서는 매칭된 카테고리 포트들이 동시에 활성화되어 `port: string[]` (fan-out, CONVENTIONS Principle 5) 로 반환된다. Single-label 모드에서는 항상 단일 포트(`port: string`).

> 사용자 카테고리 이름·id 가 시스템 예약어 (`out`, `error`, `default`, `done`, `user_ended`, `max_turns`, `completed`, `fallback`, `continue`, `__none__`) 와 충돌하면 schema 가 거부한다.

## 4. 실행 로직

0.5. **System Context Prefix 빌드** ([공통 §11](./0-common.md#11-ai-노드-시스템-프롬프트-자동-prefix-system-context-prefix)) — `includeSystemContext !== false` (default `true`) 면 `systemContextSections` 에 따라 prefix 를 생성해 다음 단계의 LLM 시스템 프롬프트 앞에 prepend.
1. `categories` 배열로 LLM 시스템 프롬프트와 JSON Schema 를 구성한다 (모드별 분기).
   - **Single-label**: `enum = [...categoryNames, '__none__']` — LLM 이 매칭 없음을 명시적으로 표현 가능
   - **Multi-label**: `categories: { type: 'array', items: { name: enum, … } }` — 매칭 없음은 빈 배열로 표현
2. `includeConfidence` / `includeEvidence` 가 `true` 이면 응답 스키마에 `confidence: number` / `evidence: string[]` 을 추가하고 시스템 프롬프트에 해당 필드 설명을 주입한다.
3. `LlmService.chat` 호출. 실패 시 §5.3 (`error` 포트, `LLM_CALL_FAILED`).
4. JSON 응답을 파싱. 파싱 실패 시 카테고리 이름의 substring 매칭으로 fallback 한다 (review W-2: 텍스트 fallback 도 custom id 라우팅 유지).
5. 모드별 결과 처리:
   - **Single-label**: 매칭 실패(`category` 미반환·`__none__`·미정의 카테고리) → §5.1 fallback case (`port: 'fallback'`, `result.category: null`). 매칭 성공 → §5.1 정상 case (`port: '<category.id>'` 또는 `class_${i}`).
   - **Multi-label**: 매칭된 카테고리들에 대해 §5.2 정상 case (`port: ['class_0', 'class_1', …]`). 매칭 없음 → §5.2 fallback case (`port: 'fallback'`, `result.categories: []`).
6. `evidence` 는 `sanitizeEvidence` 로 검증한다: non-string 항목 제거, 최대 20개 항목, 각 항목 최대 200자 (DoS 방지).

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> LLM 3 노드 공통 규약 ([공통 §5](./0-common.md#5-응답-형식-규약-principle-11)) 에 따라 도메인 결과는 `output.result.*` wrapper 하위에 둔다. 에러는 `output.error.{code, message, details?}` 표준 shape (Principle 3.2). 토큰/모델 메트릭은 `meta.*` (Principle 2).

### 5.1 Case: Single-label 모드 (`<category.id>` 또는 `fallback` 포트)

```json
{
  "config": {
    "categories": [
      { "name": "Billing", "description": "Payment" },
      { "name": "Tech", "description": "Technical" }
    ],
    "inputField": "{{ $input.text }}",
    "multiLabel": false,
    "model": "gpt-4o-mini",
    "instructions": ""
  },
  "output": {
    "result": {
      "category": "Billing",
      "confidence": 0.95,
      "evidence": ["환불"],
      "originalInput": "환불 요청드립니다"
    }
  },
  "meta": {
    "durationMs": 420,
    "model": "gpt-4o-mini",
    "inputTokens": 50,
    "outputTokens": 10,
    "totalTokens": 60,
    "thinkingTokens": 0,
    "llmCalls": [
      { "requestPayload": {}, "responsePayload": {}, "durationMs": 420 }
    ]
  },
  "port": "class_0"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.categories` | CategoryDef[] | config echo (Principle 7) | 사용자가 입력한 raw 카테고리 정의 (id 포함, 누락 가능) |
| `config.inputField` | String | config echo | raw expression (`{{ }}` 보존) |
| `config.multiLabel` | Boolean | config echo | `false` |
| `config.model` / `config.llmConfigId` / `config.instructions` | String? | config echo | 설정된 경우만 echo |
| `output.result.category` | String \| null | handler return | 매칭된 카테고리 `name`. 매칭 실패 시 `null` (`port: 'fallback'`) |
| `output.result.confidence` | number? | handler return | `includeConfidence: true` 일 때만 포함. `0` 도 정상 값 (falsy 처리 금지) |
| `output.result.evidence` | string[]? | handler return | `includeEvidence: true` 일 때만 포함. 매칭 실패 또는 LLM 미반환 시 빈 배열 `[]`. 최대 20 항목, 각 항목 ≤200 자 |
| `output.result.originalInput` | String | handler return | LLM 에 투입된 resolved 입력 (디버깅용; `config.inputField` 의 raw 와 직교) |
| `meta.durationMs` | number | handler return | `execute()` 진입부터 LLM 호출 resolve 직후까지의 소요 시간 (ms). 모든 case 동일 측정 기준 (Principle 2) |
| `meta.model` | String | handler return | 실제 호출된 모델 ID |
| `meta.{inputTokens, outputTokens, totalTokens}` | number | handler return | 토큰 사용량 |
| `meta.thinkingTokens` | number? | handler return | 모델이 보고할 때만 |
| `meta.llmCalls` | Array | handler return | LLM 호출 디버그 트레이스 (`requestPayload` / `responsePayload` / `durationMs`) |
| `port` | String | handler return | 매칭 성공 시 `<category.id>` 또는 `class_${i}`. 매칭 실패 시 `'fallback'` |

**Fallback 변형** (port `fallback`):

```json
{
  "config": { "categories": [...], "inputField": "...", "multiLabel": false },
  "output": {
    "result": {
      "category": null,
      "confidence": 0.1,
      "evidence": [],
      "originalInput": "Random off-topic text"
    }
  },
  "meta": {
    "durationMs": 380,
    "model": "gpt-4o-mini",
    "inputTokens": 50,
    "outputTokens": 10,
    "totalTokens": 60,
    "llmCalls": [/* … */]
  },
  "port": "fallback"
}
```

**Expression 접근 예**:
- `$node["Intent"].output.result.category` → `"Billing"` 또는 `null`
- `$node["Intent"].output.result.confidence` → `0.95`
- `$node["Intent"].port` → `"class_0"` / `"fallback"` / `"<custom.id>"`
- `$node["Intent"].meta.totalTokens` → `60`

### 5.2 Case: Multi-label 모드 (`class_<i>` fan-out 또는 `fallback`)

```json
{
  "config": {
    "categories": [
      { "name": "Billing", "description": "Payment" },
      { "name": "Tech", "description": "Technical" },
      { "name": "General", "description": "General" }
    ],
    "inputField": "{{ $input.text }}",
    "multiLabel": true,
    "model": "gpt-4o-mini"
  },
  "output": {
    "result": {
      "categories": [
        { "name": "Billing", "confidence": 0.9, "evidence": ["환불"] },
        { "name": "Tech", "confidence": 0.85, "evidence": ["크래시"] }
      ],
      "originalInput": "환불 요청과 앱 크래시 동시 발생"
    }
  },
  "meta": {
    "durationMs": 510,
    "model": "gpt-4o-mini",
    "inputTokens": 50,
    "outputTokens": 20,
    "totalTokens": 70,
    "llmCalls": [/* … */]
  },
  "port": ["class_0", "class_1"]
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.multiLabel` | Boolean | config echo | `true` |
| `output.result.categories` | Array<{name, confidence?, evidence?}> | handler return | 매칭된 카테고리 배열. LLM 응답에서 등록되지 않은 이름은 필터링됨. 매칭 없음 시 `[]` |
| `output.result.categories[i].name` | String | handler return | 카테고리 이름 |
| `output.result.categories[i].confidence` | number? | handler return | `includeConfidence: true` 일 때만 |
| `output.result.categories[i].evidence` | string[]? | handler return | `includeEvidence: true` 일 때만. JSON 파싱 실패의 substring fallback 시 `[]` |
| `output.result.originalInput` | String | handler return | LLM 에 투입된 resolved 입력 |
| `port` | string[] \| `'fallback'` | handler return | 매칭된 카테고리들의 포트 id 배열 (Principle 5 fan-out). 매칭 없음 시 `'fallback'` |

**Fallback 변형** (port `fallback`):

```json
{
  "config": { "categories": [...], "inputField": "...", "multiLabel": true },
  "output": {
    "result": {
      "categories": [],
      "originalInput": "Random off-topic text"
    }
  },
  "meta": {
    "durationMs": 370,
    "model": "gpt-4o-mini",
    "inputTokens": 50,
    "outputTokens": 10,
    "totalTokens": 60,
    "llmCalls": [/* … */]
  },
  "port": "fallback"
}
```

**Expression 접근 예**:
- `$node["Intent"].output.result.categories` → `[{ name: "Billing", confidence: 0.9 }, …]`
- `$node["Intent"].output.result.categories[0].name` → `"Billing"`
- `$node["Intent"].port` → `["class_0", "class_1"]` (배열) 또는 `"fallback"`

### 5.3 Case: 에러 (`error` 포트)

```json
{
  "config": {
    "categories": [...],
    "inputField": "{{ $input.text }}",
    "multiLabel": false,
    "model": "gpt-4o-mini"
  },
  "output": {
    "error": {
      "code": "LLM_CALL_FAILED",
      "message": "OpenAI API timeout after 5020ms",
      "details": {
        "originalInput": "환불 요청드립니다 …(truncated)"
      }
    }
  },
  "meta": {
    "durationMs": 5021,
    "model": "gpt-4o-mini",
    "inputTokens": 0,
    "outputTokens": 0,
    "totalTokens": 0,
    "llmCalls": [
      { "requestPayload": {}, "responsePayload": null, "durationMs": 5020 }
    ]
  },
  "port": "error"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `output.error.code` | String | handler return | `UPPER_SNAKE_CASE`. 본 노드의 예약어: `LLM_CALL_FAILED` (네트워크/타임아웃/5xx), `LLM_RATE_LIMIT` (429), `LLM_RESPONSE_INVALID` (JSON 파싱 + substring fallback 모두 실패 — 현재 핸들러는 substring fallback 으로 회복하므로 이 코드는 reserved) |
| `output.error.message` | String | handler return | 사람이 읽는 메시지 (provider 원문 보존, 국제화 없음). 다운스트림에서 사용자에게 노출 시 sanitize 책임은 호출자 |
| `output.error.details.originalInput` | String | handler return | LLM 에 투입된 입력. `truncateForErrorDetails` 로 500 자 cap (에러 envelope 의 PII / 대용량 방지). D6 통일 — 정상은 `output.result.originalInput` (full), 에러는 본 필드 (truncated) 단일 경로 |
| `meta.durationMs` | number | handler return | `execute()` 진입부터 catch 블록 진입 직전까지의 소요 시간 (ms). 성공 경로와 동일 측정 기준 (Principle 2) |
| `meta.model` | String | handler return | 호출 시도된 모델 ID (`config.model` 또는 `llmConfig.defaultModel`) |
| `meta.{inputTokens, outputTokens, totalTokens}` | number | handler return | 에러 시 LLM 응답 미수신 → 모두 `0`. 표현식이 `undefined` 로 falling through 하지 않도록 명시 0 default |
| `meta.llmCalls` | Array | handler return | 실패한 호출의 trace (`responsePayload: null`, `durationMs` 동봉). 디버깅에 핵심 |
| `port` | `'error'` | handler return | 에러 분기 |

> 본 핸들러는 JSON 파싱 실패 시 substring fallback 으로 회복하므로 `LLM_RESPONSE_INVALID` 는 발화하지 않는다. fallback 매칭에도 실패하면 §5.1 fallback case (`port: 'fallback'`, `category: null`) 로 정상 종료된다. `error` 포트는 LLM API 호출 자체의 throw 만 라우팅한다.

> **D6 결정 (2026-05-17)**: 종전 top-level `output.originalInput` (full, truncation 없음) 은 폐기. 정상 (`output.result.originalInput`) / 에러 (`output.error.details.originalInput` truncated) 양쪽이 단일 경로로 통일. 에러 시 full 입력이 필요한 워크플로는 깨지므로 마이그레이션 필요 (truncated 버전만 surface). (plan/in-progress/node-output-redesign D6)

**Expression 접근 예**:
- `$node["Intent"].output.error.code` → `"LLM_CALL_FAILED"`
- `$node["Intent"].output.error.message` → 원문 메시지
- `$node["Intent"].port` → `"error"`

## 6. 에러 코드

| 코드 | 의미 | 발생 조건 | 시점 |
|------|------|-----------|------|
| `LLM_CALL_FAILED` | LLM provider 호출 실패 | 네트워크 / 타임아웃 / 5xx / SDK throw | runtime (`error` 포트) |
| `LLM_RATE_LIMIT` | provider 429 | rate limit (현재 핸들러는 `LLM_CALL_FAILED` 로 통합 — reserved) | runtime |
| `LLM_RESPONSE_INVALID` | 응답 형식 오류 | JSON 파싱 실패 + substring fallback 도 실패 (현재 핸들러는 fallback 으로 회복하므로 미발화 — reserved) | runtime |

**Pre-flight 검증** (CONVENTIONS Principle 3.1, schema warningRules + `validateTextClassifierConfig`):

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `model` 과 `llmConfigId` 모두 미설정 | `AI_NO_LLM_PROVIDER_MESSAGE` | warningRule (캔버스 배지) + handler.validate |
| `categories` 가 빈 배열 | `하나 이상의 카테고리를 추가해야 합니다.` | warningRule + handler.validate |
| `inputField` 가 빈 문자열 | `Input Field 를 입력해야 합니다.` | warningRule + handler.validate |
| `categories[i].name` 누락 | `Category {i+1}: name is required` | `validateTextClassifierConfig` |
| `categories[i].name === '__none__'` | `Category {i+1}: "__none__" is a reserved name` | `validateTextClassifierConfig` |
| `categories[i].id` 중복 | `Category {i+1}: duplicate id "<id>" — each category must have a unique id` | `validateTextClassifierConfig` (resolver dedupe → silent 오분류 방지, review W-4) |

## 7. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `Text Classifier` 행 인용. 포맷: `{model} · {N} categories` (예: `gpt-4o-mini · 3 categories`).

## 8. Rationale

설계 결정의 SoT 는 다음 참조 (본 노드 단독 결정 없음 — 공통 규약을 그대로 따른다):

- AI 카테고리 공통 규약: [공통 0-common.md](./0-common.md)
- 응답 wrapper / 토큰 회계 / Conversation Thread / System Context Prefix: [공통 §5](./0-common.md#5-응답-형식-규약-principle-11), [§6](./0-common.md#6-토큰-회계-meta), [§10](./0-common.md#10-conversation-context-자동-컨텍스트-주입), [§11](./0-common.md#11-ai-노드-시스템-프롬프트-자동-prefix-system-context-prefix)

`includeSystemContext` / `systemContextSections` config echo 는 default 값과 일치하면 생략한다 ([공통 §11.7](./0-common.md#117-config-echo)).

## 9. CHANGELOG

| 일자 | 변경 |
|------|------|
| 2026-05-18 (system-context) | §1 config 표에 `includeSystemContext` / `systemContextSections` 추가 + §4 실행 로직 0.5 단계 추가 + §8 Rationale stub 신설. 설계·결정 근거는 [공통 §11](./0-common.md#11-ai-노드-시스템-프롬프트-자동-prefix-system-context-prefix) 및 [공통 §Rationale](./0-common.md#rationale). [Cafe24 API Metadata §5.3](../../conventions/cafe24-api-metadata.md#53-ai-agent--mcp-도구-description-자동-suffix) 와 한 묶음 결정. consistency-check 세션: `review/consistency/2026/05/18/23_08_06/` (BLOCK: NO). |
