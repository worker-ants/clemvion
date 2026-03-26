# Spec: AI 노드 상세 (3종)

> 관련 문서: [PRD 노드 시스템](../../prd/3-node-system.md#5-ai-노드) · [Spec 노드 개요](./0-overview.md) · [Spec Knowledge Base](../2-navigation/5-knowledge-base.md) · [Spec LLM Config](../2-navigation/6-config.md)

---

## 1. AI Agent

LLM 기반 AI Agent를 실행. 프롬프트, RAG, Tool Use를 지원.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| llmConfigId | UUID | 사용할 LLM 프로바이더 설정 |
| model | String | 모델 ID (프로바이더별) |
| systemPrompt | String | 시스템 프롬프트 (마크다운, 표현식 지원) |
| userPrompt | Expression | 사용자 프롬프트 (입력 데이터 참조) |
| temperature | Float? | 오버라이드 (없으면 LLMConfig 기본값) |
| maxTokens | Integer? | 오버라이드 |
| responseFormat | Enum | `text` / `json` |
| jsonSchema | JSONSchema? | responseFormat=json 시 출력 스키마 |
| knowledgeBases | UUID[] | 참조할 Knowledge Base ID 목록 |
| ragTopK | Integer | RAG 검색 결과 수 (기본: 5) |
| ragThreshold | Float | RAG 유사도 임계값 (기본: 0.7) |
| tools | ToolDef[] | 사용 가능한 도구 목록 |
| maxToolCalls | Integer | 최대 도구 호출 횟수 (기본: 10) |
| conversationHistory | Enum | `none` / `last_n` / `full` |
| historyCount | Integer? | last_n 시 보관 대화 수 |

### 설정 UI

```
┌──────────────────────────────────────────┐
│  AI Agent                                │
│  ──────────────────────────────────────  │
│                                          │
│  LLM Provider: [OpenAI ▼]               │
│  Model:        [gpt-4o ▼]               │
│                                          │
│  ── System Prompt ──                     │
│  ┌──────────────────────────────────────┐│
│  │ You are a helpful assistant that     ││
│  │ processes customer inquiries...      ││
│  └──────────────────────────────────────┘│
│                                          │
│  ── User Prompt ──                       │
│  ┌──────────────────────────────────────┐│
│  │ {{ $input.message }}                 ││
│  └──────────────────────────────────────┘│
│                                          │
│  ── Parameters ──                        │
│  Temperature: [0.7___]                   │
│  Max Tokens:  [2048__]                   │
│  Response:    ● Text  ○ JSON             │
│                                          │
│  ── Knowledge Base ──                    │
│  [+ Add Knowledge Base]                  │
│  📚 Customer FAQ        Top-K: 5         │
│                                          │
│  ── Tools ──                             │
│  [+ Add Tool]                            │
│  🔧 Create Ticket (→ Node "Ticket API") │
│  🔧 Search DB (→ Node "DB Query")       │
│                                          │
│  ── Conversation History ──              │
│  Mode: [Last N ▼]  Count: [10]          │
└──────────────────────────────────────────┘
```

### 포트
- 입력: `in` (1개)
- 출력: `out` (1개)

### Tool 정의 (ToolDef)

| 필드 | 타입 | 설명 |
|------|------|------|
| name | String | 도구 이름 (LLM에게 표시) |
| description | String | 도구 설명 |
| parameters | JSONSchema | 도구 파라미터 스키마 |
| targetNodeId | UUID | 도구 호출 시 실행할 노드 ID |
| inputMapping | MappingDef[] | 도구 파라미터 → 대상 노드 입력 매핑 |

### 실행 로직
1. Knowledge Base가 설정된 경우:
   a. userPrompt를 임베딩하여 유사 문서 검색 (Top-K, Threshold)
   b. 검색 결과를 컨텍스트에 추가
2. systemPrompt + 컨텍스트 + userPrompt로 LLM 호출
3. LLM이 도구 호출을 요청하면:
   a. targetNodeId의 노드를 실행
   b. 실행 결과를 LLM에 전달
   c. maxToolCalls 초과 전까지 반복
4. 최종 응답을 출력 형식에 맞게 변환
5. `out` 포트로 출력

### 출력 구조

```json
{
  "response": "AI의 텍스트 응답 또는 JSON 객체",
  "metadata": {
    "model": "gpt-4o",
    "inputTokens": 1250,
    "outputTokens": 350,
    "totalTokens": 1600,
    "toolCalls": 2,
    "ragSources": [
      { "documentId": "uuid", "chunk": "관련 텍스트...", "score": 0.92 }
    ]
  }
}
```

---

## 2. Text Classifier

LLM을 사용하여 입력 텍스트를 미리 정의된 카테고리로 분류.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| llmConfigId | UUID | 사용할 LLM 프로바이더 설정 |
| model | String | 모델 ID |
| inputField | Expression | 분류할 텍스트 필드 |
| categories | CategoryDef[] | 분류 카테고리 목록 |
| instructions | String? | 추가 분류 지시사항 |
| includeConfidence | Boolean | 신뢰도 점수 포함 여부 |

**CategoryDef 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| name | String | 카테고리 이름 (출력 포트 라벨) |
| description | String | 카테고리 설명 (LLM에게 제공) |
| examples | String[] | 예시 텍스트 목록 |

### 설정 UI

```
┌──────────────────────────────────────────┐
│  Text Classifier                         │
│  ──────────────────────────────────────  │
│                                          │
│  LLM Provider: [OpenAI ▼]               │
│  Model:        [gpt-4o-mini ▼]          │
│                                          │
│  Input: [{{ $input.text }}]              │
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
│                                          │
│  □ Include confidence score              │
└──────────────────────────────────────────┘
```

### 포트
- 입력: `in` (1개)
- 출력: `class_0`, `class_1`, ... (카테고리별 동적 포트)

### 실행 로직
1. 카테고리 정보를 포함한 분류 프롬프트 구성
2. LLM 호출
3. 응답에서 분류 결과 파싱
4. 해당 카테고리의 출력 포트로 데이터 전달

### 출력 구조

```json
{
  "category": "Billing",
  "confidence": 0.95,
  "originalInput": "환불 요청드립니다"
}
```

---

## 3. Information Extractor

LLM을 사용하여 비정형 텍스트에서 구조화된 정보 추출.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| llmConfigId | UUID | 사용할 LLM 프로바이더 설정 |
| model | String | 모델 ID |
| inputField | Expression | 추출 대상 텍스트 필드 |
| outputSchema | FieldDef[] | 추출할 필드 정의 |
| examples | ExampleDef[] | Few-shot 예시 (선택) |
| instructions | String? | 추가 추출 지시사항 |

**FieldDef 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| name | String | 필드 이름 |
| type | Enum | string / number / boolean / array / object |
| description | String | 필드 설명 (LLM에게 제공) |
| required | Boolean | 필수 여부 |
| enumValues | String[]? | 허용 값 목록 (있을 경우) |

**ExampleDef 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| input | String | 예시 입력 텍스트 |
| output | Object | 예시 추출 결과 |

### 설정 UI

```
┌──────────────────────────────────────────┐
│  Information Extractor                   │
│  ──────────────────────────────────────  │
│                                          │
│  LLM Provider: [Anthropic ▼]            │
│  Model:        [claude-sonnet-4-6 ▼]  │
│                                          │
│  Input: [{{ $input.emailBody }}]         │
│                                          │
│  ── Output Schema ──                     │
│  ┌──────────────────────────────────────┐│
│  │ senderName    String   ✅ Required   ││
│  │ "발신자 이름"                         ││
│  ├──────────────────────────────────────┤│
│  │ orderNumber   String   ✅ Required   ││
│  │ "주문 번호 (ORD-XXXXX 형식)"         ││
│  ├──────────────────────────────────────┤│
│  │ issueType     String   ✅ Required   ││
│  │ "문제 유형" [refund, exchange, ...]  ││
│  ├──────────────────────────────────────┤│
│  │ amount        Number   ☐ Optional    ││
│  │ "관련 금액"                           ││
│  └──────────────────────────────────────┘│
│  [+ Add Field]                           │
│                                          │
│  ── Examples (Few-shot) ──               │
│  [+ Add Example]                         │
└──────────────────────────────────────────┘
```

### 포트
- 입력: `in` (1개)
- 출력: `out` (1개)

### 실행 로직
1. outputSchema를 JSON Schema로 변환
2. 추출 프롬프트 구성 (스키마 + 예시 + 지시사항)
3. LLM 호출 (JSON 응답 형식 강제)
4. 응답 파싱 및 스키마 검증
5. 검증 통과 시 추출 결과를 `out` 포트로 전달
6. 검증 실패 시 재시도 (최대 2회) 또는 에러

### 출력 구조

```json
{
  "extracted": {
    "senderName": "김철수",
    "orderNumber": "ORD-12345",
    "issueType": "refund",
    "amount": 29900
  },
  "metadata": {
    "model": "claude-sonnet-4-6",
    "inputTokens": 450,
    "outputTokens": 80,
    "totalTokens": 530
  }
}
```
