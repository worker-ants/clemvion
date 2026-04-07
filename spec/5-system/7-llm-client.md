# Spec: LLM 클라이언트 추상화 계층

> 관련 문서: [PRD Phase 2](../../prd/6-phase2-ai.md) · [Spec LLM Config UI](../2-navigation/6-config.md) · [데이터 모델 - LLMConfig](../1-data-model.md#216-llmconfig) · [Spec AI 노드](../4-nodes/3-ai-nodes.md)

---

## 1. 개요

AI 노드(AI Agent, Text Classifier, Information Extractor)와 Knowledge Base 임베딩 파이프라인이 다양한 LLM 프로바이더를 통일된 인터페이스로 호출할 수 있도록 추상화 계층을 제공한다.

---

## 2. 지원 프로바이더

| 프로바이더 | Chat | Embedding | 인증 | 비고 |
|-----------|------|-----------|------|------|
| OpenAI | ✅ | ✅ | API Key | GPT-4o, text-embedding-3-small 등 |
| Anthropic | ✅ | ❌ | API Key | Claude 4.x, Messages API |
| Google AI | ✅ | ✅ | API Key | Gemini 시리즈 |
| Azure OpenAI | ✅ | ✅ | API Key + Endpoint | OpenAI 호환, 커스텀 배포 |
| Local (Ollama/vLLM) | ✅ | ✅ | 없음 (선택) | OpenAI-compatible API |

---

## 3. 인터페이스

### 3.1 LLMClient

```typescript
interface LLMClient {
  /** 채팅 완료 (Chat Completion) */
  chat(params: ChatParams): Promise<ChatResponse>;

  /** 텍스트 임베딩 생성 */
  embed(params: EmbedParams): Promise<EmbedResponse>;

  /** 사용 가능한 모델 목록 */
  listModels(): Promise<ModelInfo[]>;

  /** 연결 테스트 (모델 목록 조회 등 경량 API 호출) */
  testConnection(): Promise<boolean>;
}
```

### 3.2 ChatParams / ChatResponse

```typescript
interface ChatParams {
  model: string;
  messages: Message[];
  temperature?: number;       // 0.0 ~ 2.0
  maxTokens?: number;
  topP?: number;              // 0.0 ~ 1.0
  responseFormat?: 'text' | 'json';
  jsonSchema?: object;        // responseFormat=json 시 스키마
  tools?: ToolDef[];          // Function calling 도구 정의
  toolChoice?: 'auto' | 'required' | 'none';
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;        // role=tool 시 참조할 tool_call ID
  toolCalls?: ToolCall[];     // role=assistant 시 도구 호출 요청
}

interface ChatResponse {
  content: string | null;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  model: string;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}
```

### 3.3 EmbedParams / EmbedResponse

```typescript
interface EmbedParams {
  model: string;
  input: string | string[];   // 단일 또는 배치
}

interface EmbedResponse {
  embeddings: number[][];      // 벡터 배열
  usage: { totalTokens: number };
  model: string;
  dimensions: number;          // 벡터 차원 수
}
```

### 3.4 ToolDef / ToolCall

```typescript
interface ToolDef {
  name: string;
  description: string;
  parameters: object;          // JSON Schema
}

interface ToolCall {
  id: string;
  name: string;
  arguments: string;           // JSON string
}
```

### 3.5 ModelInfo

```typescript
interface ModelInfo {
  id: string;                  // 모델 식별자 (e.g., "gpt-4o")
  name: string;                // 표시 이름
  type: 'chat' | 'embedding'; // 용도
}
```

---

## 4. LLMClientFactory

`LLMConfig` 엔티티로부터 적절한 `LLMClient` 구현체를 생성한다.

```typescript
class LLMClientFactory {
  create(config: LLMConfig): LLMClient {
    switch (config.provider) {
      case 'openai':    return new OpenAIClient(config);
      case 'anthropic': return new AnthropicClient(config);
      case 'google':    return new GoogleAIClient(config);
      case 'azure':     return new AzureOpenAIClient(config);
      case 'local':     return new LocalClient(config);  // OpenAI-compatible
      default:          throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }
}
```

---

## 5. 프로바이더별 매핑

### 5.1 OpenAI

| 인터페이스 | OpenAI API |
|-----------|-----------|
| `chat()` | `POST /v1/chat/completions` |
| `embed()` | `POST /v1/embeddings` |
| `listModels()` | `GET /v1/models` |
| `responseFormat: 'json'` | `response_format: { type: "json_schema", json_schema }` |
| `tools` | `tools` 파라미터 직접 매핑 |

### 5.2 Anthropic

| 인터페이스 | Anthropic API |
|-----------|-------------|
| `chat()` | `POST /v1/messages` |
| `embed()` | ❌ 미지원 (OpenAI 임베딩 모델 사용 필요) |
| `listModels()` | 하드코딩 목록 반환 |
| `messages[].role` | `system` → 별도 `system` 파라미터로 분리 |
| `tools` | Anthropic tool_use 형식으로 변환 |
| `maxTokens` | `max_tokens` (필수 파라미터) |

### 5.3 Local (Ollama/vLLM)

- OpenAI-compatible API 사용 (`base_url` + OpenAI 클라이언트)
- `api_key`는 선택 (없으면 빈 문자열)
- 모델 목록: `GET {base_url}/v1/models` 또는 Ollama `GET /api/tags`

---

## 6. 에러 처리

| 에러 유형 | HTTP 상태 | 처리 |
|----------|----------|------|
| 인증 실패 | 401 | `LLM_AUTH_ERROR` — API 키 확인 안내 |
| 속도 제한 | 429 | `LLM_RATE_LIMIT` — 재시도 (exponential backoff, 최대 3회) |
| 모델 미존재 | 404 | `LLM_MODEL_NOT_FOUND` — 모델 ID 확인 안내 |
| 컨텍스트 초과 | 400 | `LLM_CONTEXT_EXCEEDED` — 입력 토큰 줄이기 안내 |
| 타임아웃 | - | `LLM_TIMEOUT` — 120초 초과 |
| 네트워크 오류 | - | `LLM_CONNECTION_ERROR` — 엔드포인트 확인 안내 |

---

## 7. API 키 보안

- **저장**: AES-256-GCM 암호화 (기존 `encrypt/decrypt` 유틸리티 사용)
- **암호화 키**: 환경변수 `ENCRYPTION_KEY`
- **API 응답**: 마스킹 처리 (`sk-...xxxx` 형태)
- **로그**: API 키 절대 로깅 금지
