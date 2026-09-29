---
id: "CLE-NODE-CLASSIFIER"
title: "텍스트 분류기 노드"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-CLASSIFY-001", "REQ-CLASSIFY-002", "REQ-CLASSIFY-003", "REQ-CLASSIFY-004", "REQ-CLASSIFY-005", "REQ-CLASSIFY-006", "REQ-CLASSIFY-007", "REQ-CLASSIFY-008", "REQ-CLASSIFY-009", "REQ-CLASSIFY-010", "REQ-CLASSIFY-011", "REQ-CLASSIFY-012", "REQ-CLASSIFY-013", "REQ-CLASSIFY-014", "REQ-CLASSIFY-015", "REQ-CLASSIFY-016", "REQ-CLASSIFY-017", "REQ-CLASSIFY-018", "REQ-CLASSIFY-019"]
basis_superseded: false
parent: "CLE-NODE-AI"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-AI"]
area: "CLE-NODE-AI"
content_hash: "f0b8465a4c7456eeeadb317e1780228e11913b98f35dcf983a6fad257b9456a6"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/3-ai/2-text-classifier.md", "spec/4-nodes/3-ai/_product-overview.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "2b5d720b94218c59f9fbd5d3f6061c170190158a45e5677c1b3f2333920b3756"
etag: "sha256-949d0310e263ade62ec20e2726d50332cdc6a1a18665e0306680457744538e4f"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/3-ai/2-text-classifier.md`, `spec/4-nodes/3-ai/_product-overview.md` (§3.3), `spec/4-nodes/_product-overview.md` (§6.2) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

텍스트 분류기 노드(Text Classifier, `text_classifier`)는 LLM 으로 입력 텍스트를 미리 정의한 분류 카테고리(`CategoryDef`)로 나누고 카테고리마다 출력 포트로 보낸다. 단일 레이블(정확히 한 카테고리 또는 매칭 없음)과 다중 레이블(해당하는 카테고리를 모두 동시에 켬) 두 방식을 지원한다. 단일 턴 노드이며 상태가 없다.

이 문서는 설정, 설정 화면, 포트, 실행 로직, 출력 구조, 에러 코드, 캔버스 요약을 정한다. 모델 선택, 대화 맥락 설정, 시스템 컨텍스트 접두, 출력 묶음과 에러 계약은 [AI 노드 공통](CLE-NODE-AI-COMMON.md) 을 따른다. 노드 출력 5필드의 일반 규칙은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이 정한다.

## 요구사항

- REQ-CLASSIFY-001 WHEN 노드가 실행되면 THE SYSTEM SHALL LLM 으로 입력 텍스트를 미리 정의한 카테고리로 분류한다. (원본: ND-TC-01)
- REQ-CLASSIFY-002 WHEN 사용자가 카테고리 목록을 정의하면 THE SYSTEM SHALL 그 목록을 분류 후보로 쓴다. (원본: ND-TC-02)
- REQ-CLASSIFY-003 WHEN 카테고리에 설명과 예시가 있으면 THE SYSTEM SHALL 그 내용을 LLM 프롬프트에 넣는다. (원본: ND-TC-03)
- REQ-CLASSIFY-004 WHEN 분류가 끝나면 THE SYSTEM SHALL 결과 카테고리의 출력 포트로 보낸다. (원본: ND-TC-04)
- REQ-CLASSIFY-005 WHEN `includeConfidence` 가 `true` 면 THE SYSTEM SHALL 신뢰도 점수를 출력에 싣는다. (원본: ND-TC-05)
- REQ-CLASSIFY-006 WHEN 사용자가 모델을 고르면 THE SYSTEM SHALL 그 모델로 분류한다. (원본: ND-TC-06)
- REQ-CLASSIFY-007 WHEN `multiLabel` 이 `false` 면 THE SYSTEM SHALL 매칭된 카테고리 하나의 포트를 단일 값으로 돌려준다.
- REQ-CLASSIFY-008 WHEN `multiLabel` 이 `true` 면 THE SYSTEM SHALL 매칭된 카테고리 포트를 모두 배열로 돌려준다(fan-out).
- REQ-CLASSIFY-009 IF 어떤 카테고리에도 매칭되지 않으면 THE SYSTEM SHALL `fallback` 포트로 보낸다.
- REQ-CLASSIFY-010 WHEN `includeEvidence` 가 `true` 면 THE SYSTEM SHALL 입력에서 발췌한 분류 근거를 최대 20개, 항목당 200자 이하로 싣는다.
- REQ-CLASSIFY-011 IF LLM 응답 JSON 파싱에 실패하면 THE SYSTEM SHALL 카테고리 이름 부분 문자열 매칭으로 대신 분류한다.
- REQ-CLASSIFY-012 IF LLM 호출이 예외를 던지면 THE SYSTEM SHALL `error` 포트로 `LLM_CALL_FAILED` 를 보낸다.
- REQ-CLASSIFY-013 IF provider 가 429 를 돌려주면 THE SYSTEM SHALL `LLM_RATE_LIMIT` 을 `retryable: true` 로 보낸다.
- REQ-CLASSIFY-014 IF 카테고리 `id` 가 없거나 비었거나 slug 형식이 아니면 THE SYSTEM SHALL 인덱스 기반 포트 ID `class_${i}` 를 쓴다.
- REQ-CLASSIFY-015 IF 카테고리 `name`·`id` 가 시스템 포트 예약어와 같거나 카테고리 간 `id` 가 겹치거나 `name` 이 `__none__` 이면 THE SYSTEM SHALL 설정을 거부한다.
- REQ-CLASSIFY-016 IF 카테고리가 비었거나 `inputField` 가 비었거나 모델이 설정되지 않았으면 THE SYSTEM SHALL 캔버스 경고를 내고 실행 전 검증에서 거부한다.
- REQ-CLASSIFY-017 WHEN `contextScope` 가 `none` 이 아니면 THE SYSTEM SHALL 분류 LLM 호출 직전에 대화 스레드를 주입한다.
- REQ-CLASSIFY-018 WHEN 에러로 끝나면 THE SYSTEM SHALL `details.originalInput` 을 500자로 잘라 싣고 토큰 필드를 `0` 으로 채운다.
- REQ-CLASSIFY-019 WHEN 캔버스에 노드를 그리면 THE SYSTEM SHALL `{model} · {N} categories` 요약을 보인다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `llmConfigId` | UUID | | 없음 | 모델 설정 참조([AI 노드 공통](CLE-NODE-AI-COMMON.md)) |
| `model` | String | | 없음 | 모델 ID(프로바이더별) |
| `inputField` | 표현식 | ✓ | 없음 | 분류할 텍스트(`{{ ... }}` 지원) |
| `categories` | CategoryDef[] | ✓ | `[]` | 분류 카테고리 목록. 1개 이상 필요 |
| `instructions` | String | | 없음 | 추가 분류 지시. LLM 시스템 프롬프트에 합친다 |
| `includeConfidence` | Boolean | | `false` | 신뢰도 점수를 넣을지 |
| `includeEvidence` | Boolean | | `false` | 분류 근거(입력에서 발췌한 단어·문장)를 넣을지 |
| `multiLabel` | Boolean | | `false` | 다중 레이블 방식 |
| `contextScope` | `none` / `thread` / `lastN` | | `none` | 대화 맥락 설정 범위([AI 노드 공통](CLE-NODE-AI-COMMON.md)) |
| `contextScopeN` | Integer | `lastN` 일 때 | `20` | 최근 N개 턴 |
| `contextInjectionMode` | `messages` / `system_text` | 범위가 `none` 이 아닐 때 | `messages` | messages 배열 앞에 붙이거나 시스템 프롬프트 텍스트에 붙인다 |
| `includeToolTurns` | Boolean | | `false` | `ai_tool` 턴 누적 여부. 이 노드는 도구 턴을 내지 않아 누적에는 영향이 없고 주입 인터페이스를 맞추려고 둔다 |
| `excludeFromConversationThread` | Boolean | | `false` | 이 노드 턴을 스레드에서 뺀다(opt-out) |
| `includeSystemContext` | Boolean | | `true` | 시스템 컨텍스트 접두([AI 노드 공통](CLE-NODE-AI-COMMON.md)) |
| `systemContextSections` | String[] | | `['time', 'timezone']` | 접두 섹션 |

- `llmConfigId` 와 `model` 은 스키마상 선택이지만 둘 다 비면 `text_classifier:no-llm-provider` warningRule 이 발화해 검증에 실패한다.
- 대화 맥락 설정 필드는 AI 에이전트와 같은 인터페이스다. 공유 스키마 조각 `buildConversationContextSchemaFields()` 와 공유 주입 유틸 `injectConversationContext()` 로 분류 LLM 호출 직전에 대화 스레드를 넣는다. 메모리 전략(`memoryStrategy`) 필드가 없어 늘 `contextScope` 가 적용된다. 기본 `contextScope: 'none'` 이라 기존 워크플로우 동작은 그대로다.
- 설정 스키마의 단일 기준은 `text-classifier.schema.ts` 의 `textClassifierNodeConfigSchema`·`validateTextClassifierConfig` 다.

**CategoryDef 구조**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | String? | | 카테고리 고정 id. 출력 포트 핸들(`source_port`)로 쓴다. 없거나 비었거나 slug 형식이 아니면 `class_${i}` 로 대신한다. 형식은 `[a-zA-Z0-9_-]+`, 최대 64자. 설정 화면에 보이지 않고 AI 어시스턴트가 자동으로 정한다. 카테고리 간 중복은 스키마 검증이 막는다 |
| `name` | String | ✓ | 카테고리 이름(LLM enum 값이자 출력 포트 라벨). `__none__` 은 예약어라 쓸 수 없다 |
| `description` | String | | 카테고리 설명(프롬프트에 포함) |
| `examples` | String[] | | 예시 텍스트 목록(프롬프트에 포함) |

기존 워크플로우의 카테고리에 나중에 `id` 를 더하면 출력 포트 id 가 `class_${i}` 에서 지정 id 로 바뀐다. 그 카테고리에 연결된 기존 연결선(`source_port: class_0` 등)은 끊기므로 다시 연결해야 한다. 새 카테고리에는 처음부터 `id` 를 지정해 두면 안전하다.

## 설정 화면

| 영역 | 들어가는 요소 | 동작 |
|------|---------------|------|
| 모델 (맨 위) | "LLM Provider", "Model" 드롭다운 | 프로바이더를 고르면 모델 목록이 바뀐다 |
| 입력 | "Input Field"(예: `{{ $input.text }}`) | 분류할 텍스트 표현식 |
| 지시 | "Instructions" 여러 줄 입력 | 선택. 추가 분류 가이드 |
| 옵션 | "Include Confidence", "Include Evidence", "Multi-label Classification" 체크박스 | |
| 카테고리 | 카테고리 목록(번호·이름·설명·예시), "Add Category" 버튼 | 예: Billing("결제, 환불, 구독 관련 문의"), Technical, General |

## 포트

### 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 평가 대상 데이터(1개 필수) |

### 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `<category.id>` 또는 `class_${i}` | `<category.name>` | data | true | 카테고리별 동적 포트. `category.id` 가 있으면 그대로 쓰고, 없거나 비었거나 slug 형식이 아니면 `class_0`·`class_1` 같은 인덱스 포트를 쓴다. resolver 와 핸들러가 같은 규칙으로 만든다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 6) |
| `fallback` | Fallback | data | false | 어느 카테고리에도 맞지 않을 때(단일 레이블: LLM 이 `__none__` 을 돌려주거나 매칭 실패, 다중 레이블: 빈 배열) |
| `error` | Error | error | false | LLM API 오류, 타임아웃, rate limit 등 |

- 다중 레이블이면 매칭된 카테고리 포트가 동시에 켜져 `port: string[]`(fan-out, Principle 5)로 돌려준다. 단일 레이블은 늘 단일 포트(`port: string`)다.
- 카테고리 `name`·`id` 가 시스템 포트 예약어(`out`·`error`·`default`·`done`·`user_ended`·`max_turns`·`completed`·`fallback`·`continue`)와 같으면 스키마가 거부한다. `validateTextClassifierConfig` 가 `RESERVED_PORT_WORDS`(`text-classifier.schema.ts`) 와의 충돌과 카테고리 간 `id` 중복을 모두 거부한다.
- 포트 `type` 표기는 AI 노드와 코드 사이에 정의가 갈린다([AI 노드 공통](CLE-NODE-AI-COMMON.md) 미결 사항).

## 실행 로직

1. **시스템 컨텍스트 접두**: `includeSystemContext !== false` 면 `systemContextSections` 에 따라 접두를 만들어 LLM 시스템 프롬프트 앞에 붙인다([AI 노드 공통](CLE-NODE-AI-COMMON.md)).
2. **프롬프트와 스키마 구성**: `categories` 로 시스템 프롬프트와 JSON Schema 를 만든다.
    - 단일 레이블: `enum = [...categoryNames, '__none__']`. LLM 이 매칭 없음을 명시할 수 있다.
    - 다중 레이블: `categories: { type: 'array', items: { name: enum, … } }`. 매칭 없음은 빈 배열이다.
3. **옵션 필드**: `includeConfidence`·`includeEvidence` 가 `true` 면 응답 스키마에 `confidence: number`·`evidence: string[]` 를 더하고 시스템 프롬프트에 필드 설명을 넣는다.
4. **대화 맥락 주입**: `contextScope ≠ none` 이면 `injectConversationContext()` 로 자기 노드 턴을 뺀 스레드를 `contextInjectionMode` 에 따라 messages 앞이나 시스템 프롬프트 뒤에 붙인다. `none`(기본)이면 바뀌지 않는다.
5. **LLM 호출**: `LlmService.chat` 을 부른다. 실패하면 `error` 포트로 `LLM_CALL_FAILED` 를 보낸다.
6. **응답 파싱**: JSON 응답을 파싱한다. 실패하면 카테고리 이름 부분 문자열 매칭으로 대신한다. 이 경우에도 지정 id 라우팅은 유지한다.
7. **결과 처리**
    - 단일 레이블: `category` 미반환·`__none__`·정의되지 않은 카테고리면 `port: 'fallback'`, `result.category: null`. 성공이면 `port: '<category.id>'` 또는 `class_${i}`.
    - 다중 레이블: 매칭된 카테고리 포트 배열(`['class_0', 'class_1', …]`). 매칭이 없으면 `port: 'fallback'`, `result.categories: []`.
8. **근거 정리**: `evidence` 는 `sanitizeEvidence` 로 검증한다. 문자열이 아닌 항목을 빼고, 최대 20개, 항목당 최대 200자로 자른다(DoS 방지).

## 출력 구조

출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 11 형식을 따른다. JSON 예시는 `undefined` 필드를 빼고 최상위 키는 5필드만 쓴다. 도메인 결과는 `output.result.*`, 에러는 `output.error.{code, message, details?}`(Principle 3.2), 토큰·모델 메트릭은 `meta.*`(Principle 2)에 둔다.

### 단일 레이블 (`<category.id>` 또는 `fallback`)

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
  "port": "class_0",
  "status": "ended"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.categories` | CategoryDef[] | 설정 에코(Principle 7) | 사용자가 입력한 원본 카테고리(id 포함, 없을 수 있음) |
| `config.inputField` | String | 설정 에코 | 원본 표현식(`{{ }}` 보존) |
| `config.multiLabel` | Boolean | 설정 에코 | `false` |
| `config.model`·`config.llmConfigId`·`config.instructions` | String? | 설정 에코 | 설정한 경우만 |
| `output.result.category` | String \| null | 핸들러 반환 | 매칭된 카테고리 `name`. 실패 시 `null`(`port: 'fallback'`) |
| `output.result.confidence` | number? | 핸들러 반환 | `includeConfidence: true` 일 때만. `0` 도 정상 값이라 falsy 처리하지 않는다 |
| `output.result.evidence` | string[]? | 핸들러 반환 | `includeEvidence: true` 일 때만. 매칭 실패나 LLM 미반환이면 `[]`. 최대 20개, 항목당 200자 이하 |
| `output.result.originalInput` | String | 핸들러 반환 | LLM 에 넣은 풀린 입력(디버깅용, `config.inputField` 원본과 직교) |
| `meta.durationMs` | number | 핸들러 반환 | `execute()` 진입부터 LLM 호출 완료 직후까지(ms). 모든 케이스가 같은 기준 |
| `meta.model` | String | 핸들러 반환 | 실제로 부른 모델 ID |
| `meta.{inputTokens, outputTokens, totalTokens}` | number | 핸들러 반환 | 토큰 사용량 |
| `meta.thinkingTokens` | number? | 핸들러 반환 | 모델이 보고할 때만 |
| `meta.llmCalls` | Array | 핸들러 반환 | LLM 호출 기록(`requestPayload`·`responsePayload`·`durationMs`). AI 에이전트·정보 추출기의 `turnDebug` 대신 쓰는 평면 구조다 |
| `meta.contextInjection` | object? | 핸들러 반환 | `contextScope ≠ 'none'` 이고 스레드가 비지 않았을 때만. `{ appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }`. 적용 결과이지 설정 에코가 아니다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)) |
| `port` | String | 핸들러 반환 | 성공이면 `<category.id>` 또는 `class_${i}`, 실패면 `'fallback'` |
| `status` | `'ended'` | 핸들러 반환 | 종결 상태(Principle 0) |

`fallback` 변형은 `output.result` 가 `{ "category": null, "confidence": 0.1, "evidence": [], "originalInput": "Random off-topic text" }` 이고 `port` 가 `"fallback"` 이다. 나머지 구조는 같다.

표현식 접근 예:

- `$node["Intent"].output.result.category` → `"Billing"` 또는 `null`
- `$node["Intent"].output.result.confidence` → `0.95`
- `$node["Intent"].port` → `"class_0"` / `"fallback"` / `"<custom.id>"`
- `$node["Intent"].meta.totalTokens` → `60`

### 다중 레이블 (포트 배열 또는 `fallback`)

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
  "port": ["class_0", "class_1"],
  "status": "ended"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.multiLabel` | Boolean | 설정 에코 | `true` |
| `output.result.categories` | Array<{name, confidence?, evidence?}> | 핸들러 반환 | 매칭된 카테고리 배열. 등록되지 않은 이름은 거른다. 매칭이 없으면 `[]` |
| `output.result.categories[i].name` | String | 핸들러 반환 | 카테고리 이름 |
| `output.result.categories[i].confidence` | number? | 핸들러 반환 | `includeConfidence: true` 일 때만 |
| `output.result.categories[i].evidence` | string[]? | 핸들러 반환 | `includeEvidence: true` 일 때만. 부분 문자열 대체 매칭이면 `[]` |
| `output.result.originalInput` | String | 핸들러 반환 | LLM 에 넣은 풀린 입력 |
| `meta.contextInjection` | object? | 핸들러 반환 | 단일 레이블과 같음 |
| `port` | string[] \| `'fallback'` | 핸들러 반환 | 매칭된 포트 id 배열(Principle 5 fan-out). 매칭이 없으면 `'fallback'` |
| `status` | `'ended'` | 핸들러 반환 | 종결 상태 |

`fallback` 변형은 `output.result` 가 `{ "categories": [], "originalInput": "Random off-topic text" }` 이고 `port` 가 `"fallback"` 이다.

표현식 접근 예:

- `$node["Intent"].output.result.categories` → `[{ name: "Billing", confidence: 0.9 }, …]`
- `$node["Intent"].output.result.categories[0].name` → `"Billing"`
- `$node["Intent"].port` → `["class_0", "class_1"]` 또는 `"fallback"`

### 에러 (`error`)

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
  "port": "error",
  "status": "ended"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `output.error.code` | String | 핸들러 반환 | `UPPER_SNAKE_CASE`. 아래 에러 코드 표 |
| `output.error.message` | String | 핸들러 반환 | 사람이 읽는 메시지(provider 원문 보존, 국제화 없음). 다운스트림이 사용자에게 보일 때 정리 책임은 호출자에게 있다 |
| `output.error.details.retryable` | boolean | 핸들러 반환 | [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 LLM 계열 필수 필드. 이 문서의 원문 정의는 `LLM_CALL_FAILED`(타임아웃·5xx)·`LLM_RATE_LIMIT`(429) 은 `true`, 인증 실패(401·403)는 `false` 다. 정의가 갈린다. [미결 사항](#미결-사항) 참조 |
| `output.error.details.retryAfterSec` | number? | 핸들러 반환 | provider 가 `Retry-After` 등을 줄 때의 권장 대기(초). `retryable === true` 일 때만 싣는다 |
| `output.error.details.originalInput` | String | 핸들러 반환 | LLM 에 넣은 입력. `truncateForErrorDetails` 로 500자로 자른다(PII·대용량 방지) |
| `meta.durationMs` | number | 핸들러 반환 | `execute()` 진입부터 catch 진입 직전까지. 성공 경로와 같은 기준 |
| `meta.model` | String | 핸들러 반환 | 부르려던 모델 ID(`config.model` 또는 `llmConfig.defaultModel`) |
| `meta.{inputTokens, outputTokens, totalTokens}` | number | 핸들러 반환 | 응답을 못 받아 모두 `0`. 표현식이 `undefined` 로 새지 않게 명시한다 |
| `meta.llmCalls` | Array | 핸들러 반환 | 실패한 호출 기록(`responsePayload: null`, `durationMs` 포함). 디버깅의 핵심이다 |
| `port` | `'error'` | 핸들러 반환 | |
| `status` | `'ended'` | 핸들러 반환 | |

JSON 파싱에 실패하면 부분 문자열 대체 매칭으로 회복하므로 `LLM_RESPONSE_INVALID` 는 나지 않는다. 대체 매칭에도 실패하면 `fallback` 케이스(`category: null`)로 정상 종료한다. `error` 포트는 LLM API 호출 자체의 예외만 받는다.

표현식 접근 예: `$node["Intent"].output.error.code` → `"LLM_CALL_FAILED"`, `$node["Intent"].port` → `"error"`.

## 에러 코드

| 코드 | 뜻 | 발생 조건 | 시점 |
|------|------|-----------|------|
| `LLM_CALL_FAILED` | LLM provider 호출 실패 | 네트워크·타임아웃·5xx·SDK 예외 | 실행 중(`error` 포트) |
| `LLM_RATE_LIMIT` | provider 429 | rate limit. `details.retryable: true`, `Retry-After` 신호가 있으면 `retryAfterSec` 도 싣는다 | 실행 중(`error` 포트) |
| `LLM_RESPONSE_INVALID` | 응답 형식 오류 | JSON 파싱과 부분 문자열 대체가 모두 실패. 지금은 대체로 회복해 나지 않는 예약 코드다 | 실행 중 |

**실행 전 검증** ([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 3.1, 스키마 warningRules + `validateTextClassifierConfig`)

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `model` 과 `llmConfigId` 가 모두 없음 | `AI_NO_LLM_PROVIDER_MESSAGE` | warningRule(캔버스 배지) + handler.validate |
| `categories` 가 빈 배열 | `At least one category must be added.` (warningRule 원문은 영문, 화면은 한국어로 렌더) | warningRule + handler.validate |
| `inputField` 가 빈 문자열 | `Input Field must be entered.` (위와 같음) | warningRule + handler.validate |
| `categories[i].name` 이 없음 | `Category {i+1}: name is required` | `validateTextClassifierConfig` |
| `categories[i].name === '__none__'` | `Category {i+1}: "__none__" is a reserved name` | `validateTextClassifierConfig` |
| `categories[i].id` 중복 | `Category {i+1}: duplicate id "<id>" — each category must have a unique id` | `validateTextClassifierConfig` (resolver 중복 제거로 조용히 오분류되는 것을 막는다) |

## 캔버스 요약

[AI 노드 공통](CLE-NODE-AI-COMMON.md) 의 텍스트 분류기 형식 `{model} · {N} categories`(예: `gpt-4o-mini · 3 categories`)를 `textClassifierNodeMetadata.summaryTemplate`(`{{model}} · {{categories.length}} categories`)으로 렌더한다(`node-config-summary.ts` 의 `getConfigSummary` → `renderSummaryTemplate(def.summaryTemplate, config)`). 세 AI 노드 중 요약이 구현된 노드는 이 노드뿐이다.

## 미결 사항

- **인증 실패(401·403)의 재시도 가능 분류**: 이 문서의 원문과 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 은 인증 실패를 `retryable: false` 로 정한다. 현재 핸들러(`text-classifier.handler.ts` 234~241행)는 `LLM_CALL_FAILED` 를 늘 `retryable: true` 로 채운다. 정보 추출기는 문서부터 늘 `true` 로 정한다. 세 노드 전체 쟁점은 [AI 노드 공통](CLE-NODE-AI-COMMON.md) 의 미결 사항에 있다. 문서와 코드 중 어느 쪽에 맞출지 결정 필요.
- **에러 출력의 `meta` 와 `llmCalls` 형태**: 이 노드는 에러 때 토큰을 `0` 으로 채우고 `turnDebug` 대신 평면 `meta.llmCalls` 를 쓴다. 공통 규약에 없는 형태다. [AI 노드 공통](CLE-NODE-AI-COMMON.md) 미결 사항 참조.

## 구현 위치

- `codebase/backend/src/nodes/ai/text-classifier/text-classifier.handler.ts`
- `codebase/backend/src/nodes/ai/text-classifier/text-classifier.schema.ts` (`textClassifierNodeConfigSchema`, `validateTextClassifierConfig`, `RESERVED_PORT_WORDS`)
- `codebase/frontend/src/lib/utils/node-config-summary.ts` (캔버스 요약)

## Rationale

### 노드 단독 결정이 없는 이유

이 노드는 공통 규약을 그대로 따른다. 출력 묶음·토큰 회계·대화 맥락 설정·시스템 컨텍스트 접두의 결정 근거는 [AI 노드 공통](CLE-NODE-AI-COMMON.md) 에 있다. `includeSystemContext`·`systemContextSections` 는 기본값과 같으면 설정 에코에서 뺀다.

### 메모리 전략이 없는 이유

단일 턴이고 상태가 없는 분류기라 회수할 이전 실행 사실도, 저장할 추출 사실도 정의되지 않는다. 그래서 에이전트 메모리 대상에서 빼고 대화 맥락 설정(수동 주입)만 둔다.

### `originalInput` 경로를 통일한 이유 (D6)

`originalInput` 은 정상(`output.result.originalInput`, 전체)과 에러(`output.error.details.originalInput`, 500자로 자름) 양쪽을 각각 한 경로로 통일했다. 최상위 `output.originalInput` 은 쓰지 않는다.
