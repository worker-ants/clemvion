---
id: llm-client
status: partial
pending_plans:
  - plan/in-progress/rag-rerank-followup.md
code:
  - codebase/backend/src/modules/llm/clients/*.ts
  - codebase/backend/src/modules/llm/llm-client.factory.ts
  - codebase/backend/src/modules/llm/interfaces/llm-client.interface.ts
  - codebase/backend/src/modules/llm/llm.service.ts
  - codebase/backend/src/modules/llm/embedding-input-type.ts
  - codebase/backend/src/modules/llm/llm-preview.service.ts
  - codebase/backend/src/modules/llm/llm-usage-log.service.ts
  - codebase/backend/src/modules/llm/rerank/rerank-client.factory.ts
  - codebase/backend/src/modules/llm/rerank/clients/*.ts
---

# Spec: LLM 클라이언트 추상화 계층

> 관련 문서: [PRD AI & 지식 저장소](../4-nodes/3-ai/_product-overview.md) · [Spec LLM Config UI](../2-navigation/6-config.md) · [데이터 모델 - LLMConfig](../1-data-model.md#216-llmconfig) · [Spec AI 노드](../4-nodes/3-ai/0-common.md)

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

위 표는 chat/embedding 프로바이더(LLMConfig)다. 리랭킹은 전용 `/rerank` 엔드포인트라 **별도 프로바이더 집합·별도 설정(RerankConfig)·별도 팩토리**로 분리한다 (§3.6, §4.1).

### 2.1 리랭크 프로바이더 (Planned)

| 프로바이더 | 지원 | 인증 | 비고 |
|-----------|------|------|------|
| TEI (자가호스팅) | **1차** | 없음 (선택) | HuggingFace Text-Embeddings-Inference 가 서빙하는 `bge-reranker-v2-m3` / `dragonkue/bge-reranker-v2-m3-ko`. self-host 우선 경로 |
| Cohere | **1차** | API Key | `rerank-3.5` 등. 외부 API 경로 |
| Jina | Planned | API Key | `jina-reranker-v2-base-multilingual` |
| Voyage | Planned | API Key | `rerank-2.5` |
| Local | Planned | 없음 (선택) | OpenAI-compatible `/rerank` (vLLM 등) |
| builtin | Planned | — | Transformers.js(onnxruntime-node) 인프로세스 추론 — 추론 컨테이너 없이 제로 인프라 self-host. worker thread·모델 캐시 필요 |

> **1차 지원**: `tei`(자가호스팅) + `cohere`(API) 2종. 나머지는 동일 `/rerank` HTTP 래퍼(builtin 은 인프로세스)라 후속 확장이 저렴.

> RerankConfig 엔티티: [Spec 데이터 모델 §2.16.1](../1-data-model.md#2161-rerankconfig). 검색 후처리 적용: [Spec RAG 검색 §3.3](./9-rag-search.md#33-검색-후처리--리랭킹-선택적).

---

## 3. 인터페이스

### 3.1 LLMClient

```typescript
interface LLMClient {
  /**
   * 채팅 완료 (Chat Completion).
   * `signal` 은 in-flight HTTP 요청을 abort 한다 (cancel-others-on-fail /
   * Workflow timeout / 사용자 cancel cleanup. SoT: spec/conventions/node-cancellation.md).
   */
  chat(params: ChatParams, signal?: AbortSignal): Promise<ChatResult>;

  /** 텍스트 임베딩 생성. 입력 텍스트 배열 → 벡터 배열만 반환 (메타데이터 없음).
   *  `inputType` 은 비대칭 임베딩 모델에서 query/document(passage)를 구분한다 (§3.3) */
  embed(
    texts: string[],
    model?: string,
    inputType?: "query" | "document",
  ): Promise<number[][]>;

  /** 사용 가능한 모델 목록 (`signal` 로 abort 가능) */
  listModels(signal?: AbortSignal): Promise<ModelInfo[]>;

  /** 연결 테스트 (모델 목록 조회 등 경량 API 호출) */
  testConnection(): Promise<boolean>;

  /**
   * 채팅 스트리밍 (선택). 미지원 프로바이더는 호출 시 동기적으로
   * `LLM_STREAMING_UNSUPPORTED` 를 throw. 상세는 §8.
   */
  stream?(params: ChatParams, signal?: AbortSignal): AsyncIterable<ChatStreamEvent>;
}
```

> 코드의 응답 타입 이름은 `ChatResult` (아래 §3.2 의 `ChatResponse` 와 동일 구조). `Message` 인터페이스명은 코드상 `ChatMessage`.

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
  thinkingTokens?: number;    // reasoning/thought 토큰 — OpenAI reasoning 모델·Gemini 2.5 에서만 채워짐
}
```

### 3.3 embed 시그니처 (LLMClient 인터페이스)

임베딩은 파라미터/응답 객체를 쓰지 않고 평탄한 시그니처를 사용한다. (서비스 계층 `LlmService.embed` 의 batch/opts 래퍼는 [§8.3](#83-서비스-레이어).) `inputType?` 같은 **plain scalar 위치 인자 추가는 객체화(파라미터/응답 객체 도입)가 아니므로 평탄한 시그니처 원칙 범위 내**다 — 원칙이 금지하는 것은 `EmbedParams`/`EmbedResponse` 같은 wrapper 객체이지 optional scalar 확장이 아니다 ([근거: ## Rationale](#rationale)).

```typescript
// embed(texts, model?, inputType?: 'query' | 'document'): Promise<number[][]>
//   texts     : 임베딩할 입력 배열 (배치)
//   model     : 모델 ID. 생략 시 클라이언트별 기본 임베딩 모델
//   inputType : 비대칭 검색 모델용 힌트. 생략 시 'document'(passage) — 적재 경로 기본값.
//               검색 query 경로만 'query' 를 명시한다. 대칭 모델은 무시.
//   반환      : 입력 순서에 대응하는 벡터 배열. usage/dimensions 등 메타데이터는 반환하지 않음
```

**inputType(비대칭 입력) 처리** — 일부 임베딩 모델은 query 와 document 를 다르게 인코딩해야 검색 품질이 나온다(asymmetric retrieval). 이를 누락하면 색인은 되지만 회수 품질이 조용히 떨어지는 silent bug 가 된다. provider/모델별 적용은 [`spec/5-system/8-embedding-pipeline.md §5.4`](./8-embedding-pipeline.md#54-비대칭-입력-inputtype--prefix) 가 SoT 이며, 매핑 순수함수는 `codebase/backend/src/modules/llm/embedding-input-type.ts`:
- **e5 계열**(multilingual-e5, e5-{small,base,large}): 입력 텍스트에 `query: ` / `passage: ` 접두사 적용(텍스트 변형). OpenAI 호환 경로에서 수행.
- **Google Gemini**: `embedContent` 의 `taskType`(RETRIEVAL_QUERY / RETRIEVAL_DOCUMENT) 파라미터로 전달(텍스트 불변).
- **대칭 모델**(OpenAI text-embedding-3, bge-m3 등): no-op. 미매칭 모델도 안전 기본값 no-op.

> **참고**: 토큰 사용량·차원 메타데이터를 함께 반환하는 `EmbedResponse` 형태는 현재 미구현(Planned). `inputType` 도 그와 같은 이유로 **응답 객체화 대신 위치 인자 확장**을 채택했다 — `EmbedResponse` 도입 시 옵션 객체로 통합 검토. 사용량 로깅이 필요한 임베딩 경로는 별도 토큰 추정에 의존한다.

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
  signature?: string;          // provider-opaque (Gemini 2.5+/3.x thought_signature). 후속 history 턴에 echo 필요
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

### 3.6 RerankClient

cross-encoder 리랭킹은 chat/embedding 과 API shape 가 달라 `LLMClient` 에 욱여넣지 않고 **별도 인터페이스**로 둔다 (RAG 검색 §3.3 후처리에서 호출).

```typescript
interface RerankClient {
  /**
   * (query, document) 쌍을 cross-encoder 로 점수화해 관련도 순 index+score 반환.
   * documents 순서와 무관하게 score 내림차순 정렬된 결과.
   */
  rerank(query: string, documents: string[], model?: string,
         opts?: { topK?: number }): Promise<{ index: number; score: number }[]>;
}
```

---

## 4. LLMClientFactory

`LLMConfig` 에서 평탄화한 옵션(`LLMClientCreateOptions`)으로부터 적절한 `LLMClient` 구현체를 생성한다. 팩토리는 엔티티 전체가 아니라 `{ provider, apiKey, defaultModel, baseUrl? }` 만 받아 클라이언트별 생성자 인자로 매핑한다.

```typescript
interface LLMClientCreateOptions {
  provider: string;
  apiKey: string;
  defaultModel: string;
  baseUrl?: string;
}

class LLMClientFactory {
  create(options: LLMClientCreateOptions): LLMClient {
    switch (options.provider) {
      case 'openai':    return new OpenAIClient(options.apiKey, options.defaultModel, options.baseUrl);
      case 'anthropic': return new AnthropicClient(options.apiKey, options.defaultModel);
      case 'google':    return new GoogleClient(options.apiKey, options.defaultModel);
      case 'azure':     // baseUrl 필수 — 누락 시 throw
                        return new AzureOpenAIClient(options.apiKey, options.defaultModel, options.baseUrl!);
      case 'local':     // baseUrl 필수 — 누락 시 throw. OpenAI-compatible
                        return new LocalClient(options.defaultModel, options.baseUrl!, options.apiKey);
      default:          throw new Error(`Unsupported LLM provider: ${options.provider}`);
    }
  }
}
```

> 클래스명은 코드상 `GoogleClient` (스펙 서술의 `GoogleAIClient` 와 매핑). 팩토리 자체는 `provider` 만 검증하며, azure/local 의 `baseUrl` 누락은 `Error` 로 throw — 호출 측(§5.5 preview)이 이를 `LLM_CONFIG_INVALID` 로 래핑한다.

### 4.1 RerankClientFactory

리랭커는 **별도 팩토리**로 분리해 `LLMClientFactory` 의 chat/embedding provider switch 를 오염시키지 않는다 (별개 provider 집합·별개 인터페이스). `RerankConfig` 에서 `{ provider, apiKey?, defaultModel, baseUrl? }` 를 받아 `RerankClient` 구현체를 생성한다.

```typescript
class RerankClientFactory {
  create(options: { provider: string; apiKey?: string; defaultModel: string; baseUrl?: string }): RerankClient {
    switch (options.provider) {
      // 1차 구현
      case 'tei':    // baseUrl 필수 (자가호스팅 HF TEI)
                     return new TeiRerankClient(options.baseUrl!, options.defaultModel, options.apiKey);
      case 'cohere': return new CohereRerankClient(options.apiKey!, options.defaultModel);
      // Planned(후속): jina / voyage / local(OpenAI-compatible /rerank) / builtin(Transformers.js 인프로세스)
      default:       throw new Error(`Unsupported rerank provider: ${options.provider}`);
    }
  }
}
```

> 미지원 provider 구성은 구성 시점 검증 실패이므로 기존 `LLM_CONFIG_INVALID` 계열로 래핑한다 — 런타임 전용 코드를 신설하지 않는다. SSRF 가드(`tei`/`local` 사설망 예외)는 §5.5 규칙을 재사용한다.

---

## 5. 프로바이더별 매핑

### 5.1 OpenAI

| 인터페이스 | OpenAI API |
|-----------|-----------|
| `chat()` | `POST /v1/chat/completions` |
| `embed()` | `POST /v1/embeddings`. e5 계열 모델(OpenAI 호환 self-host)이면 입력에 `query:`/`passage:` 접두사 적용, native 모델은 no-op |
| `listModels()` | `GET /v1/models` |
| `responseFormat: 'json'` | `response_format: { type: "json_schema", json_schema }` |
| `tools` | `tools` 파라미터 직접 매핑 |

### 5.2 Anthropic

| 인터페이스 | Anthropic API |
|-----------|-------------|
| `chat()` | `POST /v1/messages` |
| `embed()` | ❌ 미지원 (OpenAI 임베딩 모델 사용 필요) |
| `listModels()` | `client.models.list()` — Anthropic 모델 조회 API 실시간 호출 |
| `messages[].role` | `system` → 별도 `system` 파라미터로 분리 |
| `tools` | Anthropic tool_use 형식으로 변환 |
| `maxTokens` | `max_tokens` (필수 파라미터) |

### 5.3 Google AI

| 인터페이스 | Google API |
|-----------|-----------|
| `chat()` | `ai.models.generateContent()` (`@google/genai` SDK) |
| `embed()` | `ai.models.embedContent()` 배치 지원. `config.taskType` = RETRIEVAL_QUERY / RETRIEVAL_DOCUMENT (inputType 매핑) |
| `listModels()` | `ai.models.list()` — Gemini 모델 조회 API 실시간 호출. `supportedActions`에 `generateContent` 포함 시 chat, `embedContent` 포함 시 embedding 으로 분류 |
| `stream()` | `ai.models.generateContentStream()` (신 SDK는 flat AsyncGenerator 반환) |
| `tools` | `functionDeclarations` 로 매핑, 스키마는 OpenAPI 3.0 서브셋으로 sanitize |

### 5.4 Local (Ollama/vLLM)

- OpenAI-compatible API 사용 (`base_url` + OpenAI 클라이언트)
- `api_key`는 선택 (없으면 빈 문자열)
- 모델 목록: `GET {base_url}/v1/models` 또는 Ollama `GET /api/tags`

### 5.6 Rerank 프로바이더 매핑

| provider | rerank() 엔드포인트 | 단계 |
|----------|--------------------|------|
| TEI | `POST {base_url}/rerank` (HF Text-Embeddings-Inference) | 1차 |
| Cohere | `POST /v2/rerank` (`{ model, query, documents, top_n }` → `{ results: [{ index, relevance_score }] }`) | 1차 |
| Jina | `POST /rerank` | Planned |
| Voyage | `POST /v1/rerank` | Planned |
| Local | `POST {base_url}/rerank` (OpenAI-compatible) 또는 vLLM `/score` | Planned |
| builtin | (인프로세스 Transformers.js — onnxruntime-node, HTTP 없음) | Planned |

### 5.5 모델 목록 Preview (폼 자격증명 기반)

LLM Config UI의 **기본 모델 선택** 지원을 위해, 아직 저장되지 않은 자격증명으로 `listModels`를 실행하는 preview 경로를 제공한다.

- **경로**: `POST /api/llm-configs/preview-models`
- **Body**: `{ provider, apiKey, baseUrl? }`
- **동작**:
  - `LlmPreviewService.previewModels`(저장 설정 기반 `LlmService` 와 분리된 전용 서비스)가 `LLMClientFactory`로 임시 클라이언트를 생성하고 `client.listModels(signal)`를 1회 호출한다.
  - 반환값은 저장된 설정용 `GET /api/llm-configs/:id/models`와 동일한 `ModelInfo[]`.
  - 클라이언트 인스턴스는 per-config 캐시에 들어가지 않으며 요청 범위에서만 사용된다.
  - 30초 timeout 및 `@Throttle(10/60s)` Rate limit 적용.
- **권한**: `editor` 이상.
- **에러 처리**: 프로바이더 원본 에러는 §6 sanitize 규칙에 따라 가공해 `400 BAD_REQUEST`로 반환된다 (키/엔드포인트 원문 노출 금지). `local` 외 프로바이더에서 `apiKey`가 비어 있으면 `LLM_CREDENTIALS_REQUIRED`.
- **로깅 주의**: `apiKey`는 로그·응답·캐시 어디에도 기록하지 않는다.
  - 본 엔드포인트는 `apiKey` 를 request body 로 받는다. 운영 계약 상 **request body 는 로거·APM·에러 트래커가 캡처해서는 안 된다**. 향후 body logging 이 도입될 경우 `common/utils/mask-sensitive-fields.util.ts` 의 `maskSensitiveFields` 로 감싸 `apiKey`·`password`·`token` 계열 필드를 자동 마스킹해야 한다.
  - 계약의 완전한 분리(body 가 아닌 전용 헤더로 키 전송 + TTL 기반 임시 config 프록시) 는 별도 PR 범위. 현 단계는 "body 는 존재하나 어떤 경로에도 기록되지 않는다" 로 유지.
- **SSRF 가드**: `baseUrl` 이 loopback(`127.0.0.0/8`, `::1`), RFC1918(`10/8`·`172.16/12`·`192.168/16`), link-local(`169.254/16`, `fe80::/10`), IPv6 ULA(`fc00::/7`), IPv4-mapped IPv6, `0.0.0.0/8` 에 해당하면 `LLM_CONFIG_INVALID` 로 차단한다. 도메인 hostname 은 `dns.lookup` 으로 1차 해석 후 같은 규칙을 재적용 (DNS rebinding 1차 방어). **`local` 프로바이더는 예외** — self-hosted Ollama/vLLM 이 localhost·사설망에 있는 것이 정상 사용 사례. **한계**: DNS rebinding 2차(TTL 경과 후 재해석) 는 connect 시점 개입이 필요해 현재는 차단 대상 아님. 실차단이 필요하면 egress 방화벽·클라우드 네트워크 정책으로 보완한다.

---

## 6. 에러 처리

클라이언트 계층(`*.client.ts`)은 프로바이더 원본 에러를 아래 코드로 좁혀 매핑한다. 현재 구현은 **429 → `LLM_RATE_LIMIT`, 그 외 → `LLM_CONNECTION_ERROR`** 의 2분기를 기본으로 하며, OpenAI 계열 스트리밍에서 harmony 토큰 오염은 `LLM_OUTPUT_MALFORMED` 로 별도 분기한다. 인증/모델 미존재/컨텍스트 초과를 세분한 전용 코드는 **미구현(Planned)** — 현재는 모두 `LLM_CONNECTION_ERROR` 로 수렴한다.

| 에러 유형 | HTTP 상태 | 처리 |
|----------|----------|------|
| 속도 제한 | 429 | `LLM_RATE_LIMIT` — 재시도 (exponential backoff, 최대 3회. `withRetry`) |
| 네트워크/기타 오류 | - | `LLM_CONNECTION_ERROR` — 위 분기에 해당하지 않는 모든 클라이언트 호출 실패의 기본값 (인증 실패·모델 미존재·컨텍스트 초과 포함) |
| 출력 오염 | - | `LLM_OUTPUT_MALFORMED` — gpt-oss 계열 harmony 제어 토큰 노출 시 (OpenAI 스트리밍 경로). 사용자에게는 안내문으로 치환 |
| 자격증명 누락 | 400 | `LLM_CREDENTIALS_REQUIRED` — preview 요청에서 non-local 프로바이더에 apiKey 누락 시 |
| 프로바이더 설정 오류 | 400 | `LLM_CONFIG_INVALID` — 팩토리 생성 실패 (예: azure/local baseUrl 누락, 알 수 없는 provider) 또는 preview SSRF 차단 |
| 모델 목록 조회 실패 | 400 | `LLM_MODEL_LIST_FAILED` — preview/`:id/models` 호출 중 프로바이더 응답 실패. sanitize 된 메시지 노출 |
| 스트리밍 미지원 | - | `LLM_STREAMING_UNSUPPORTED` — 미지원 프로바이더에 `stream()` 호출 시 (§8.4) |

**미구현(Planned) — 세분화 에러 코드**: `LLM_AUTH_ERROR`(401), `LLM_MODEL_NOT_FOUND`(404), `LLM_CONTEXT_EXCEEDED`(400) 는 향후 클라이언트 계층에서 분기 예정이나 현재는 `LLM_CONNECTION_ERROR` 로 수렴한다. 타임아웃은 `withTimeout` 이 `AbortController` 로 in-flight 요청을 취소하고 "Request timed out after {ms}ms" 에러를 던지며, 전용 `LLM_TIMEOUT` 코드로 매핑되지 않는다(노드 실행 계층 `nodes/core/error-codes.ts` 의 `LLM_TIMEOUT` 은 별개의 노드 taxonomy).

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
| Google AI | ✅ | 신 `@google/genai` SDK 의 `ai.models.generateContentStream()` 단일 경로 사용 (별도 `ChatSession`/`GenerativeModel` 래퍼 없음). 각 chunk 의 `candidates[].content.parts`를 순회하여 `text` part → `text_delta`, `functionCall` part는 인자가 한 번에 완결된 JSON으로 도착하므로 `tool_call_delta`+`tool_call_end`를 즉시 같은 턴에 emit (OpenAI의 `arguments` 조각 누적 단계 불필요). usage는 `usageMetadata` 에서 1회 수집 |
| Azure OpenAI | ✅ | OpenAI 호환 SDK 의 스트리밍 SSE 그대로 사용. `AzureOpenAIClient`가 `OpenAIClient.stream` 을 상속하며 deployment name + `api-version` 만 base URL / 헤더에 매핑 |
| Local (Ollama/vLLM) | ✅ | OpenAI 호환 엔드포인트로 동일 코드 경로(`LocalClient extends OpenAIClient`) 사용. Ollama 11434 / vLLM OpenAI-compat 모드에서 스트리밍 검증 완료 |

### 8.3 서비스 레이어

```typescript
class LlmService {
  // 기존 chat / testConnection / resolveConfig 유지

  /** 배치 임베딩 — 20개 단위 chunking + 내부 재시도. §3.3 의 LLMClient.embed 래퍼.
   *  opts(timeoutMs/disableInnerRetry)는 서비스 래퍼 전용이라 §3.3 LLMClient
   *  인터페이스에는 없다. inputType 기본값 'document'(적재), 검색 query 만 'query'. */
  embed(
    config: LlmConfig,
    texts: string[],
    model?: string,
    opts?: Pick<LlmCallOptions, 'timeoutMs' | 'disableInnerRetry'>,
    inputType?: 'query' | 'document',   // 생략 시 'document'
  ): Promise<number[][]>;

  /** 스트리밍 chat — client.stream 위임. done 이벤트에서 llmUsageLogService.record() fire-and-forget */
  chatStream(
    config: LlmConfig,
    params: ChatParams,
    context?: LlmCallContext,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent>;
}
```

> `LlmCallOptions`(timeoutMs/disableInnerRetry/signal)는 코드가 SoT(`llm.service.ts`). `embed` 은 그중 `timeoutMs`/`disableInnerRetry` 만 받는다.
> **호출 예시**: `opts` 가 불필요하고 query 임베딩만 원할 때는 4번째 인자에 `undefined` 를 명시한다 — `embed(config, texts, model, undefined, 'query')`. (위치 인자라 `inputType` 단독 전달 시 `opts` 자리를 건너뛰어야 한다.)

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

---

## Rationale

- **왜 `LlmService.embed` 에 `opts`/`inputType` 을 위치 인자로 추가했나 (§8.3)**: §3.3 의 `LLMClient.embed` 인터페이스는 "평탄한 시그니처(파라미터/응답 객체 없음)" 원칙을 유지한다. 그러나 서비스 계층(`LlmService.embed`)은 배치 chunking·timeout·재시도 래퍼라 운영 옵션(`timeoutMs`/`disableInnerRetry`)이 필요하고, 비대칭 검색 모델(e5/Gemini)을 위한 `inputType('query'|'document')` 힌트도 필요하다. 이를 응답/옵션 객체로 객체화(`EmbedResponse`/`EmbedOptions`)하는 대신 **위치 인자 확장**을 택한 이유: (a) `EmbedResponse`(usage/dimensions 반환)가 아직 Planned 라 지금 객체화하면 두 번 리팩토링, (b) 기존 호출부 하위호환(`inputType` 생략 시 `'document'`)을 유지해 변경 표면 최소화. `EmbedOptions` 객체 통합은 `EmbedResponse` 도입 시 함께 검토한다. **trade-off**: 위치 인자라 `opts` 없이 `inputType` 만 전달할 때 4번째 자리에 `undefined` 를 명시해야 한다(`embed(config, texts, model, undefined, 'query')`) — 호출부 DX 가 다소 떨어지지만, 객체화 2회 리팩토링 회피·하위호환 유지가 그 비용을 상회한다고 판단했다. `inputType` 의 provider 별 적용·재임베딩 정합성은 [8-embedding-pipeline §5.4](./8-embedding-pipeline.md#54-비대칭-입력-inputtype--prefix) SoT.
- **왜 RerankClient 를 LLMClient 와 분리된 별도 인터페이스로 둔 것인가**: 리랭커 API shape 는 chat/embed 와 근본적으로 다르다 — `rerank(query, documents[])` 는 스코어 배열 반환이며, 스트리밍·system_prompt·tool_call 등 chat 개념이 없다. capability flag(`supportsReranking?: boolean`) 로 LLMClient 에 욱여넣으면 (a) 타입 안전성 저하 (b) 미구현 프로바이더의 런타임 throw 처리 복잡화 (c) provider switch 가 리랭크/chat/embed 를 함께 처리해 단일책임 위반. 별도 인터페이스 + 별도 팩토리가 명확하다.
- **왜 SSRF 가드·secret-store 는 재사용하는가**: 자가호스팅 `tei`/`local` 리랭커는 사설망 endpoint 를 받아 LLM 과 동일한 SSRF 공격 면이 있다. §5.5 의 `local`/`tei` 사설망 예외 규칙을 그대로 적용해 인프라를 중복 구현하지 않는다.
- **왜 LLMClientFactory 에 통합하지 않았나**: LLMConfig 와 RerankConfig 는 별개 DB 테이블·별개 워크스페이스 리소스다. LLMClientFactory 는 `provider`·`apiKey`·`defaultModel`·`baseUrl?` 의 flat 옵션을 받는데, 리랭크 프로바이더 집합(`tei`·`cohere`·jina/voyage 후속)은 chat 프로바이더 집합(`openai`·`anthropic`·`google`·`azure`·`local`)과 교집합이 없다. 같은 팩토리에 두면 switch 가 불필요하게 커지고 RerankConfig 의 타입이 LLMConfig 로 오염된다.
