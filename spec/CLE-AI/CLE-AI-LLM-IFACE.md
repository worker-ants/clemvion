---
id: "CLE-AI-LLM-IFACE"
title: "LLM 클라이언트 — 인터페이스와 프로바이더 매핑"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-AI-LLM"
ancestors: ["CLE-VISION", "CLE-AI", "CLE-AI-LLM"]
area: "CLE-AI"
content_hash: "648a435d767c6c00bc8d24fd5d67ab8118245d25b64b76bae2c64180be38a0da"
read_as: "approved_fallback"
task: "CLE-T-0VS826"
source_paths: []
mirror_sha256: "e341fc45befcd24ebd0384ad225fdf3d93b7d3d07816a2eea714ddf1ebd8154c"
etag: "sha256-c4a46e135e43c7ffb84c088b4aff3d9a8245c8e73b54061b9b3b6685e9719860"
---
## 개요

이 문서는 [LLM 클라이언트](CLE-AI-LLM.md) 의 하위 문서로 `LLMClient` · `RerankClient` 인터페이스, 클라이언트 팩토리, 프로바이더별 API 매핑을 정한다.

## 인터페이스

### LLMClient

```typescript
interface LLMClient {
  /**
   * 채팅 완료 (Chat Completion).
   * `signal` 은 진행 중인 HTTP 요청을 abort 한다
   * (cancel-others-on-fail / 워크플로우 타임아웃 / 사용자 취소 정리).
   */
  chat(params: ChatParams, signal?: AbortSignal): Promise<ChatResult>;

  /** 텍스트 임베딩 생성. 입력 텍스트 배열 → 벡터 배열만 반환 (메타데이터 없음).
   *  `inputType` 은 비대칭 임베딩 모델에서 query/document 를 구분한다 */
  embed(
    texts: string[],
    model?: string,
    inputType?: "query" | "document",
  ): Promise<number[][]>;

  /** 사용 가능한 모델 목록 (`signal` 로 abort 가능) */
  listModels(signal?: AbortSignal): Promise<ModelInfo[]>;

  /** 연결 테스트 (모델 목록 조회 등 가벼운 API 호출) */
  testConnection(): Promise<boolean>;

  /**
   * 채팅 스트리밍 (선택). 이 메서드가 없는 클라이언트에 스트리밍을 요청하면
   * `LlmService.chatStream` 이 `LLM_STREAMING_UNSUPPORTED` 를 throw 한다. 상세는 스트리밍 절.
   */
  stream?(params: ChatParams, signal?: AbortSignal): AsyncIterable<ChatStreamEvent>;
}
```

지금은 스트리밍을 지원하지 않는 클라이언트가 `stream()` 을 아예 두지 않는다(e2e 용 LLM 스텁). 그런 클라이언트에 스트리밍을 요청하면 `LlmService.chatStream` 이 스트림을 열기 전에 `LLM_STREAMING_UNSUPPORTED` 를 던진다. 다섯 프로바이더 클라이언트는 모두 `stream()` 을 구현한다. 상세는 [스트리밍 에러 매핑](CLE-AI-LLM-STREAM.md#스트리밍-에러-매핑) 에 있다.

코드의 응답 타입 이름은 `ChatResult` 이고 아래 `ChatResponse` 와 구조가 같다. `Message` 인터페이스는 코드에서 `ChatMessage` 다. 취소 신호 전파 규약은 [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) 에서 정한다.

### ChatParams / ChatResponse

```typescript
interface ChatParams {
  model: string;
  messages: Message[];
  temperature?: number;       // 0.0 ~ 2.0
  maxTokens?: number;
  topP?: number;              // 0.0 ~ 1.0
  responseFormat?: 'text' | 'json';
  jsonSchema?: object;        // responseFormat=json 일 때 스키마
  tools?: ToolDef[];          // function calling 도구 정의
  toolChoice?: 'auto' | 'required' | 'none';
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;        // role=tool 일 때 참조할 tool_call ID
  toolCalls?: ToolCall[];     // role=assistant 일 때 도구 호출 요청
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
  thinkingTokens?: number;    // reasoning/thought 토큰. OpenAI reasoning 모델·Gemini 2.5 에서만 채워진다
}
```

`temperature`·`topP` 를 프로바이더 요청에 어떻게 옮기는지는 [프로바이더별 매핑](#프로바이더별-매핑) 에서 정하고 Anthropic 에는 보내지 않는다.

### embed 시그니처

임베딩은 파라미터·응답 객체를 쓰지 않는 평탄한 시그니처를 쓴다. `inputType?` 처럼 선택적 스칼라 위치 인자를 더하는 것은 이 원칙 안이다. 원칙이 막는 것은 `EmbedParams`·`EmbedResponse` 같은 감싸는 객체다([Rationale](#embed-에-위치-인자를-더한-이유)). 서비스 계층 `LlmService.embed` 의 배치·옵션 래퍼는 [서비스 계층](CLE-AI-LLM-SERVICE.md#서비스-계층) 에서 정한다.

```typescript
// embed(texts, model?, inputType?: 'query' | 'document'): Promise<number[][]>
//   texts     : 임베딩할 입력 배열 (배치)
//   model     : 모델 ID. 생략하면 클라이언트별 기본 임베딩 모델
//   inputType : 비대칭 검색 모델용 힌트. 생략하면 'document'(적재 경로 기본값).
//               검색 query 경로만 'query' 를 명시한다. 대칭 모델은 무시한다.
//   반환      : 입력 순서대로의 벡터 배열. usage·dimensions 같은 메타데이터는 반환하지 않는다
```

입력 유형(`inputType`)을 빠뜨리면 색인은 되지만 검색 품질이 조용히 떨어진다. 모델별 적용 규칙(e5 접두사 · Gemini `taskType` · 대칭 모델은 그대로)은 [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) 이 정하고, 매핑 순수 함수는 `codebase/backend/src/modules/llm/embedding-input-type.ts` 에 있다. e5 접두사는 OpenAI 호환 경로에서 붙이고 Gemini 는 텍스트를 바꾸지 않는다.

토큰 사용량·차원 메타데이터를 함께 돌려주는 `EmbedResponse` 는 미구현(Planned)이다. 임베딩 호출의 사용량은 현재 기록하지 않는다([LLM 사용량 기록](CLE-AI-USAGE.md)).

### ToolDef / ToolCall

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
  signature?: string;          // 프로바이더 불투명 값 (Gemini 2.5+/3.x thought_signature). 다음 대화 기록 턴에 그대로 되돌려 보내야 한다
}
```

### ModelInfo

모델 목록 항목(`ModelInfo`)은 프로바이더 `listModels` 응답의 한 항목(DTO)이다. 저장된 프로바이더 설정 엔티티인 모델 설정(`ModelConfig`)과 접두어만 같고 다른 개념이다.

```typescript
interface ModelInfo {
  id: string;                  // 모델 식별자 (예: "gpt-4o")
  name: string;                // 표시 이름
  type: 'chat' | 'embedding';  // 용도
}
```

### RerankClient

cross-encoder 리랭킹은 Chat·Embedding 과 API 모양이 달라 `LLMClient` 에 넣지 않고 별도 인터페이스로 둔다. [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) 의 리랭킹 단계가 부른다.

```typescript
interface RerankClient {
  /**
   * (query, document) 쌍을 cross-encoder 로 점수화해 관련도 순 index+score 를 반환한다.
   * documents 순서와 상관없이 score 내림차순으로 정렬된 결과다.
   */
  rerank(query: string, documents: string[], model?: string,
         opts?: { topK?: number }): Promise<{ index: number; score: number }[]>;
}
```

`RerankService` 는 `rerank()` 를 부를 때 `topK = candidates.length` 로 후보 전체를 다시 점수화한다. 작은 `topK` 로 미리 줄이면 뒤따르는 동적 점수 컷이 의미가 없어지기 때문이다. 최종 주입 청크 수는 `RerankService` 의 동적 점수 컷(`applyDynamicCut`)이 정한다([RAG 검색](../CLE-KB/CLE-KB-SEARCH.md)). 따라서 `opts.topK` 는 클라이언트 수준 상한일 뿐이고 생성 주입 컷의 단일 기준이 아니다.

## 클라이언트 팩토리

설정은 한 테이블(`ModelConfig`)에 `kind` 로 구분해 두지만 팩토리는 `kind` 로 나뉜다. `kind='chat'|'embedding'` 은 `LLMClientFactory`, `kind='rerank'` 는 `RerankClientFactory` 가 맡는다. 리랭킹 호출의 `(query, docs[])` 입력, 점수 배열 출력, 스트리밍 없음 같은 모양 차이는 팩토리 층에서 흡수한다.

### LLMClientFactory

`LLMClientFactory` 는 Chat 종류 모델 설정에서 평탄하게 뽑은 옵션(`LLMClientCreateOptions`)으로 알맞은 `LLMClient` 구현체를 만든다. 엔티티 전체가 아니라 `{ provider, apiKey, defaultModel, baseUrl? }` 만 받아 클라이언트 클래스마다 필요한 인자로 옮긴다.

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
      case 'azure':     // baseUrl 필수. 없으면 throw
                        return new AzureOpenAIClient(options.apiKey, options.defaultModel, options.baseUrl!);
      case 'local':     // baseUrl 필수. 없으면 throw. OpenAI 호환
                        return new LocalClient(options.defaultModel, options.baseUrl!, options.apiKey);
      default:          throw new Error(`Unsupported LLM provider: ${options.provider}`);
    }
  }
}
```

- Google 클래스 이름은 코드에서 `GoogleClient` 다.
- 팩토리는 `provider` 만 검증한다. `azure`·`local` 의 `baseUrl` 이 없으면 `Error` 를 던지고, 미리보기 경로는 이를 `MODEL_CONFIG_INVALID` 로 감싼다.

### RerankClientFactory

리랭커는 별도 팩토리로 떼어 `LLMClientFactory` 의 Chat·Embedding 프로바이더 분기를 섞지 않는다. Rerank 종류 모델 설정에서 `{ provider, apiKey?, defaultModel, baseUrl? }` 를 받아 `RerankClient` 구현체를 만든다.

```typescript
class RerankClientFactory {
  create(options: { provider: string; apiKey?: string; defaultModel: string; baseUrl?: string }): RerankClient {
    switch (options.provider) {
      // tei 의 baseUrl, cohere 의 apiKey 가 없으면 팩토리가 명시적으로 Error 를 던진다
      case 'tei':    // baseUrl 필수 (자가호스팅 HF TEI)
                     return new TeiRerankClient(options.baseUrl!, options.defaultModel, options.apiKey);
      case 'cohere': // baseUrl 선택. 생략하면 기본 `https://api.cohere.com` (프록시·테스트 override 용)
                     return new CohereRerankClient(options.apiKey!, options.defaultModel, options.baseUrl);
      default:       throw new Error(`Unsupported rerank provider: ${options.provider}`);
    }
  }
}
```

지원하지 않는 프로바이더 구성은 구성 시점 검증 실패로 보고 `MODEL_CONFIG_INVALID` 계열로 감싼다. 클라이언트 계층에는 리랭킹 전용 런타임 에러 코드를 새로 두지 않는다. SSRF 가드는 [SSRF 가드](CLE-AI-LLM.md#ssrf-가드) 규칙을 그대로 쓴다.

리랭커 설정 에러 코드는 층마다 다르다.

| 층 | 코드 | 쓰는 때 |
|----|------|--------|
| 설정 CRUD(`/api/model-configs`) | `MODEL_CONFIG_INVALID`, `MODEL_CONFIG_NOT_FOUND` | 미지원 프로바이더·SSRF 차단 같은 구성 검증 실패, 없는 설정 |
| 검색 실행(리랭킹 호출) | `RERANK_CONFIG_INVALID` | 검색 중 Rerank 종류 설정이 없거나 프로바이더를 쓸 수 없을 때. 에러를 던지지 않고 그 지식 저장소를 코사인 경로로 강등한 뒤 검색 진단에 남긴다 |

`RERANK_CONFIG_INVALID` 는 검색 층 전용이고 `MODEL_CONFIG_*` 는 설정 CRUD 층 전용이다. 강등 규칙과 검색 진단 필드는 [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) 에서 정한다.

## 프로바이더별 매핑

### OpenAI

| 인터페이스 | OpenAI API |
|-----------|-----------|
| `chat()` | `POST /v1/chat/completions` |
| `embed()` | `POST /v1/embeddings`. e5 계열 모델(OpenAI 호환 자가호스팅)이면 입력에 `query:`/`passage:` 접두사를 붙이고, native 모델은 그대로 둔다 |
| `listModels()` | `GET /v1/models` |
| `responseFormat: 'json'` | `response_format: { type: "json_schema", json_schema }` |
| `tools` | `tools` 파라미터로 바로 옮긴다 |

### Anthropic

| 인터페이스 | Anthropic API |
|-----------|-------------|
| `chat()` | `POST /v1/messages` |
| `embed()` | ❌ 지원하지 않는다 (임베딩은 다른 프로바이더 모델을 써야 한다) |
| `listModels()` | `client.models.list()`. Anthropic 모델 조회 API 를 실시간으로 부른다 |
| `messages[].role` | `system` 은 별도 `system` 파라미터로 뺀다 |
| `tools` | Anthropic tool_use 형식으로 바꾼다 |
| `maxTokens` | `max_tokens` (필수 파라미터) |
| `temperature`·`topP` | 보내지 않는다. 값을 받아도 버리고 API 기본값(temperature 1.0)으로 샘플링한다. `top_k` 도 보내지 않는다([Rationale](#anthropic-에-샘플링-파라미터를-보내지-않는다-2026-11-12)) |

### Google AI

| 인터페이스 | Google API |
|-----------|-----------|
| `chat()` | `ai.models.generateContent()` (`@google/genai` SDK) |
| `embed()` | `ai.models.embedContent()` 배치 지원. `config.taskType` = RETRIEVAL_QUERY / RETRIEVAL_DOCUMENT (`inputType` 매핑) |
| `listModels()` | `ai.models.list()`. Gemini 모델 조회 API 를 실시간으로 부른다. `supportedActions` 에 `generateContent` 가 있으면 chat, `embedContent` 가 있으면 embedding 으로 나눈다 |
| `stream()` | `ai.models.generateContentStream()` (새 SDK 는 평탄한 AsyncGenerator 를 돌려준다) |
| `tools` | `functionDeclarations` 로 옮기고, 스키마는 OpenAPI 3.0 서브셋으로 정리한다 |

Gemini Developer API 버전은 SDK 기본값을 따르지 않고 `v1beta` 로 고정한다. `GoogleGenAI` 를 만들 때 `apiVersion` 인자로 넘긴다([Rationale](#gemini-api-버전을-v1beta-로-고정한다-2026-11-12)).

### Local (Ollama/vLLM)

- OpenAI 호환 API 를 쓴다(`base_url` + OpenAI 클라이언트).
- `api_key` 는 선택이다. 없으면 빈 문자열을 쓴다.
- 모델 목록은 `GET {base_url}/v1/models` 또는 Ollama `GET /api/tags` 로 가져온다.

### 리랭커

| 프로바이더 | `rerank()` 엔드포인트 | 상태 |
|----------|--------------------|------|
| TEI | `POST {base_url}/rerank` (HF Text-Embeddings-Inference). 모델은 서버에 고정 로드돼 있어 본문에 싣지 않는다(`defaultModel` 은 식별·로깅 용도). `opts.topK` 를 지원하지 않아 호출하는 쪽이 정렬한 뒤 자른다 | 구현됨 |
| Cohere | `POST {base_url}/v2/rerank` (`{ model, query, documents, top_n }` → `{ results: [{ index, relevance_score }] }`). `base_url` 을 생략하면 `https://api.cohere.com` | 구현됨 |

## Rationale

### embed 에 위치 인자를 더한 이유

`LLMClient.embed` 인터페이스는 파라미터·응답 객체가 없는 평탄한 시그니처를 지킨다. 그런데 서비스 계층 `LlmService.embed` 는 배치 분할·타임아웃·재시도를 감싼 계층이라서 운영 옵션(`timeoutMs`·`disableInnerRetry`)이 필요하다. 비대칭 검색 모델(e5·Gemini)을 위한 `inputType('query'|'document')` 힌트도 필요하다. 이를 옵션·응답 객체(`EmbedOptions`·`EmbedResponse`)로 묶지 않고 위치 인자로 더한 이유는 두 가지다.

- `EmbedResponse`(usage·dimensions 반환)가 아직 미구현이라 지금 객체로 바꾸면 리팩터링을 두 번 하게 된다.
- `inputType` 을 생략하면 `'document'` 가 되므로 기존 호출부가 그대로 동작하고 변경 범위가 가장 작다.

`EmbedOptions` 객체 통합은 `EmbedResponse` 를 도입할 때 함께 검토한다. 대가로 `opts` 없이 `inputType` 만 넘길 때 네 번째 자리에 `undefined` 를 적어야 한다. 호출부가 조금 불편해지지만 두 번 리팩터링하지 않고 하위 호환을 지키는 쪽이 낫다고 판단했다. `inputType` 의 프로바이더별 적용과 재임베딩 정합성은 [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) 에서 정한다.

### RerankClient 를 별도 인터페이스로 둔 이유

리랭커 API 모양은 chat·embed 와 근본적으로 다르다. `rerank(query, documents[])` 는 점수 배열을 돌려주고, 스트리밍·system prompt·tool call 같은 chat 개념이 없다. `supportsReranking?: boolean` 같은 기능 플래그로 `LLMClient` 에 넣으면 문제가 세 가지 생긴다.

- 타입 안전성이 떨어진다.
- 구현하지 않은 프로바이더의 런타임 throw 처리가 복잡해진다.
- 프로바이더 분기 하나가 리랭킹·chat·embed 를 함께 다뤄 단일 책임을 어긴다.

별도 인터페이스와 별도 팩토리가 더 명확하다.

### 설정 테이블을 합친 뒤에도 팩토리를 나눠 둔 이유

모델 설정은 한 테이블로 합쳤지만 리랭킹 호출은 입력 `(query, docs[])`·출력 점수 배열·스트리밍 없음이라는 점에서 chat·embedding 과 API 모양이 다르다. 그래서 `RerankClientFactory` 는 따로 두고 `ModelConfig.kind` 로 팩토리를 고른다. 테이블을 합친 이유는 [LLM 사용량 기록](CLE-AI-USAGE.md) 에 있다.

### 리랭커 프로바이더를 두 가지로 끝낸 이유

2026-06-05 사용자 결정이다. 1차 구현인 `tei`(자가호스팅)와 `cohere`(외부 API)가 자가호스팅과 외부 API 두 사용 경로를 이미 덮는다. 추가 프로바이더(`jina`·`voyage`·`local`·`builtin`)는 수요가 확인되지 않은 채 인증·에러 매핑·SSRF 예외 규칙 같은 유지보수 표면만 늘린다. 수요가 생기면 같은 `/rerank` HTTP 호출 패턴(builtin 은 Transformers.js 인프로세스 추론)이라 다시 시작하는 비용은 낮다. 이 결정은 구조 변경이 아니라 범위를 닫은 것이다.

### Anthropic 에 샘플링 파라미터를 보내지 않는다 (2026-11-12)

Anthropic 클라이언트의 `chat()`·`stream()` 은 `ChatParams` 의 `temperature`·`topP` 를 받아도 요청에 넣지 않는다. `top_k` 는 원래 보내지 않았다. 요청은 API 기본값(temperature 1.0)으로 샘플링한다. 다른 프로바이더(OpenAI · Google AI · Azure OpenAI · Local)의 요청은 바뀌지 않는다. NERV Task `CLE-T-GKZPKY` 에서 정했다.

- **API 버전 `2026-10-21` 이 세 필드를 거절한다.** 이 버전은 Messages 요청에 `temperature`·`top_p`·`top_k` 가 있으면 값이 기본값이어도 모든 모델에서 400 을 낸다. `@anthropic-ai/sdk` 1.0 부터 이 버전을 기본으로 보내고 SDK 1.x 요청 타입에서도 세 필드가 빠졌다. 그래서 SDK 를 1.x 로 올리려면 클라이언트가 이 필드를 보내지 않아야 한다. 근거는 [Anthropic API 마이그레이션 안내](https://platform.claude.com/docs/en/api/migration-2026-10-21) 에 있다.
- **이전 모델에서는 temperature 로 맞추던 일관성을 잃는다.** Claude 4.7 이후 모델은 원래 기본값만 받아서 달라지는 것이 없다. Sonnet 4.6 · Haiku 4.5 같은 이전 모델에서는 temperature 를 낮춰 얻던 일관성이 사라진다. 이를 대신할 설정은 없다.
- **2026-11-12 사용자가 temperature 제거를 정했다.** 이전 모델에서 temperature 0 의 효과가 사라지는 것도 받아들였다.
- **옛 API 버전 헤더를 고정해 이전 모델에 계속 보내는 안은 기각했다.** SDK 1.x 요청 타입에 세 필드가 없어서 타입을 우회해야 한다. 클라이언트도 옛 API 버전에 묶인다. 사용자가 제거를 택했다(2026-11-12).

[AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 설정 화면의 Temperature 필드 힌트(`ai-agent.schema.ts`)와 유저 가이드의 AI 노드 문서에 Anthropic 모델에는 이 값이 적용되지 않는다고 적었다.

### Gemini API 버전을 v1beta 로 고정한다 (2026-11-12)

`@google/genai` 3.0.0 에서 Gemini Developer API 의 기본 버전이 `v1beta` 에서 `v1` 로 바뀌었다. SDK 상수 `GOOGLE_AI_API_DEFAULT_VERSION` 은 2.32.0 에서 `'v1beta'` 이고 3.0.0 에서 `'v1'` 이다. 그래서 클라이언트 코드를 그대로 두고 SDK 만 3.0 으로 올려도 Google 클라이언트가 부르는 엔드포인트가 `v1` 로 바뀐다.

아래 기능이 `v1` 에서 되는지는 아직 확인하지 않았다.

- `embedContent` 의 `taskType` (기본 임베딩 모델 `text-embedding-004`)
- thoughtSignature 를 다음 턴에 그대로 되돌려 보내기 (`ToolCall.signature`)
- `functionCall.id` 와 `functionResponse.id` 왕복
- `*-latest` 별칭 모델 (`v1` 에는 없다고 알려져 있다)

단위 테스트는 SDK 를 mock 하거나 fetch 를 가로채므로 `v1` 지원 여부를 증명하지 못한다. 그래서 실제 키로 확인하기 전까지 API 버전을 `v1beta` 로 고정한다. `google.client.ts` 의 모듈 상수 `GEMINI_API_VERSION` 을 `new GoogleGenAI({ apiKey, apiVersion })` 의 `apiVersion` 으로 넘긴다. SDK 2.32 와 3.0 모두 최상위 옵션 `GoogleGenAIOptions.apiVersion` 을 받는다. 3.0 에서는 이 옵션이 `GOOGLE_GENAI_API_VERSION` 환경 변수보다 우선한다. NERV Task `CLE-T-FPVQPM` 에서 정했다.

기각한 대안은 두 가지다.

- SDK 기본값(`v1`)을 따른다. 위 기능이 `v1` 에서 되지 않으면 임베딩 품질이 조용히 떨어지거나 도구 호출 왕복이 깨질 수 있다. 단위 테스트로는 이를 잡지 못해서 기각했다.
- 환경 변수 `GOOGLE_GENAI_API_VERSION` 으로 정한다. SDK 2.32 는 이 변수를 읽지 않는다. 그러면 어느 API 버전을 부를지가 SDK 버전과 배포 설정에 달린다. 코드에 고정하면 SDK 2.32 와 3.0 어느 쪽에서도 같은 엔드포인트를 부른다. 그래서 기각했다.

`v1` 로 옮길지는 실제 키로 위 기능을 확인한 뒤 정한다. 확인은 NERV Task `CLE-T-752NN3` 에서 한다([미결 사항](CLE-AI-LLM.md#미결-사항)).
