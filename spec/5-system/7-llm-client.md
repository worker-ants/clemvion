# Spec: LLM 클라이언트 추상화 계층

> 관련 문서: [PRD AI & 지식 저장소](../../prd/6-phase2-ai.md) · [Spec LLM Config UI](../2-navigation/6-config.md) · [데이터 모델 - LLMConfig](../1-data-model.md#216-llmconfig) · [Spec AI 노드](../4-nodes/3-ai-nodes.md)

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

---

## 8. 스트리밍 (Streaming)

Workflow AI Assistant와 같이 **turn-level latency가 UX에 중요한 피처**를 위해, `LLMClient`는 선택적 `stream()` 메서드를 제공한다. 기존 `chat()`과 독립적으로 구현되며, 스트리밍 미지원 프로바이더는 해당 메서드 호출 시 명시적 에러를 던진다.

### 8.1 인터페이스 확장

```typescript
interface LLMClient {
  // 기존 chat / embed / listModels / testConnection 유지

  /** 채팅 스트리밍. 미지원 프로바이더는 LLM_STREAMING_UNSUPPORTED 에러 throw */
  stream?(params: ChatParams): AsyncIterable<ChatStreamEvent>;
}

type ChatStreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call_delta'; id: string; name?: string; argumentsDelta: string }
  | { type: 'tool_call_end'; id: string }
  | { type: 'done'; usage: TokenUsage; model: string; finishReason: ChatResponse['finishReason'] }
  | { type: 'error'; code: string; message: string };
```

| 이벤트 | 의미 |
|--------|------|
| `text_delta` | assistant 텍스트의 부분 증분 |
| `tool_call_delta` | tool_call 인자의 부분 증분. 같은 `id`로 여러 번 발행 후 최종 `tool_call_end`로 종료 |
| `tool_call_end` | tool_call 한 건 완성 — 호출자가 shadow 실행/검증을 시작할 시점 |
| `done` | 스트림 전체 종료. usage는 LLM 응답에 포함된 경우에만 정확, 누락 시 `0`으로 보고됨 |
| `error` | 스트림 중단 사유 — 클라이언트는 이후 이벤트 수신 중단 |

### 8.2 프로바이더별 구현

| 프로바이더 | 지원 | 내부 매핑 |
|-----------|------|-----------|
| OpenAI | ✅ | `chat.completions.create({stream: true})` — `choices[0].delta.content` → text_delta, `choices[0].delta.tool_calls[].function.arguments` → tool_call_delta, `choices[0].finish_reason` → done |
| Anthropic | ✅ | `messages.stream()` — `content_block_delta` (text_delta/input_json_delta), `content_block_start`/`content_block_stop`으로 tool_call_end 판정, `message_delta` 에서 usage 수집 |
| Google AI | ❌ | v1 스코프 밖. 호출 시 `LLM_STREAMING_UNSUPPORTED` throw |
| Azure OpenAI | ❌ | v1 스코프 밖. 동일 |
| Local (Ollama/vLLM) | 🚧 | OpenAI 호환 API 사용 시 자동 지원 가능하나 MVP 검증 범위 밖 |

### 8.3 서비스 레이어

```typescript
class LlmService {
  // 기존 chat / embed / testConnection / resolveConfig 유지

  /** 스트리밍 chat — client.stream 위임. done 이벤트에서 llmUsageLogService.record() fire-and-forget */
  chatStream(
    config: LlmConfig,
    params: ChatParams,
    context?: LlmCallContext,
  ): AsyncIterable<ChatStreamEvent>;
}
```

- 사용량 로깅(`llm_usage_log`)은 `done` 이벤트에서만 수행하며, 비동기 비차단.
- 재시도(rate limit)는 스트리밍 중에는 적용하지 않는다. 시작 전 네트워크 초기화 단계에서만 기존 exponential backoff 규칙을 적용.

### 8.4 에러 매핑

| 케이스 | 이벤트 | 비고 |
|--------|--------|------|
| 429 rate limit (스트리밍 시작 전) | `error` (code=`LLM_RATE_LIMIT`) | 재시도 정책 §6 재사용 |
| 시작 후 네트워크 단절 | `error` (code=`LLM_CONNECTION_ERROR`) | 클라이언트가 재시작하도록 안내 |
| 클라이언트 abort (사용자 Stop) | `done` (finishReason=`aborted`) | 서버는 usage 확인되는 만큼만 기록 |
| 미지원 프로바이더에 stream 요청 | throw `LLM_STREAMING_UNSUPPORTED` (스트림 시작 전) | 호출자가 non-streaming fallback 여부 판단 |

### 8.5 기존 `chat()`과의 관계

- `chat()`은 모든 프로바이더에서 그대로 필수 구현. Assistant 외 기존 AI 노드·임베딩·연결 테스트는 계속 `chat()` 사용.
- `stream()`은 Assistant 한정 기능이며, 향후 AI Agent 노드의 `ND-AG-09 (스트리밍 응답)` 요구사항이 필수화될 때 확장 적용.
