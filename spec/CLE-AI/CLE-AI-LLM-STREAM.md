---
id: "CLE-AI-LLM-STREAM"
title: "LLM 클라이언트 — 에러 처리와 스트리밍"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-AI-LLM"
ancestors: ["CLE-VISION", "CLE-AI", "CLE-AI-LLM"]
area: "CLE-AI"
content_hash: "70c1944a462666885d819929797bd6066fe1d0343b3b54f48917c1e15f8135e6"
read_as: "approved_fallback"
task: "CLE-T-0R5SYN"
source_paths: []
mirror_sha256: "105fbbf8b7f9492d3e4e81af8be7097fa63af471601d88576b39a02d6a76ec5d"
etag: "sha256-62ca7add3d5823a07a4c86d66393e3ed7c4ca787bb4a24507116b912d7029b13"
---
## 개요

이 문서는 [LLM 클라이언트](CLE-AI-LLM.md) 의 하위 문서로 클라이언트 계층의 에러 매핑, harmony 제어 토큰 거르기, 스트리밍(`stream()`) 계약을 정한다.

## 에러 처리

클라이언트 계층(`*.client.ts`)은 프로바이더 원본 에러를 아래 코드로 좁혀 옮긴다. 기본은 429 → `LLM_RATE_LIMIT`, 그 밖의 실패 → `LLM_CONNECTION_ERROR` 두 갈래다.

| 에러 유형 | HTTP 상태 | 코드와 처리 |
|----------|----------|------|
| 속도 제한 | 429 | `LLM_RATE_LIMIT`. `chat` 은 지수 백오프로 최대 3회 재시도(`withRetry`). `chatStream` 은 [호출 신뢰성 계약](CLE-AI-LLM-SERVICE.md#호출-신뢰성-계약) 참조 |
| 네트워크·기타 실패 | 없음 | `LLM_CONNECTION_ERROR`. 위 분기에 들지 않는 모든 클라이언트 호출 실패의 기본값이다(인증 실패·모델 없음·컨텍스트 초과 포함) |
| 출력 오염 | 없음 | `LLM_OUTPUT_MALFORMED`. gpt-oss 계열 harmony 제어 토큰이 드러날 때(OpenAI 스트리밍 경로). `message` 는 고정 영문 진단 문장이고, 화면 문구는 호출하는 쪽이 코드로 고른다([harmony 제어 토큰 거르기](#harmony-제어-토큰-거르기)) |
| 자격 증명 누락 | 400 | `LLM_CREDENTIALS_REQUIRED`. 미리보기 요청에서 local 이 아닌 프로바이더의 `apiKey` 가 없을 때 |
| 프로바이더 설정 에러 | 400 | `MODEL_CONFIG_INVALID`. 팩토리 생성 실패(azure·local 의 `baseUrl` 누락, 알 수 없는 프로바이더) 또는 SSRF 차단 |
| 모델 목록 조회 실패 | 400 | `LLM_MODEL_LIST_FAILED`. 미리보기·`:id/models` 호출 중 프로바이더 응답이 실패할 때. sanitize 한 메시지를 싣는다 |
| 스트리밍 미지원 | 없음 | `LLM_STREAMING_UNSUPPORTED`. 클라이언트에 `stream()` 이 없을 때 `LlmService.chatStream` 이 스트림을 열기 전에 던지는 `BadRequestException` 의 응답 본문 `code` 다. `chatStream` 을 부르는 곳이 어시스턴트 스트림뿐이라 이 예외는 HTTP 응답으로 나가지 않는다. 어시스턴트가 대체 경로 없이 SSE `error` 이벤트로만 넘긴다([에러 코드 §6.17](../CLE-API/CLE-API-ERRCODES-LLM.md#617-llm-클라이언트-도메인-문서-참조)) |

- 세분화 코드 `LLM_AUTH_ERROR`(401), `LLM_MODEL_NOT_FOUND`(404), `LLM_CONTEXT_EXCEEDED`(400)는 미구현(Planned)이다. 지금은 모두 `LLM_CONNECTION_ERROR` 로 모인다.
- 타임아웃은 `withTimeout` 이 `AbortController` 로 진행 중인 요청을 취소하고 "Request timed out after {ms}ms" 에러를 던진다. 전용 `LLM_TIMEOUT` 코드로 옮기지 않는다. 노드 실행 계층(`nodes/core/error-codes.ts`)의 `LLM_TIMEOUT` 은 어느 호출 경로도 내지 않는다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md)).
- 노드 계층 에러 분류와 이 표의 대응은 [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md) 과 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 에서 다룬다.

### harmony 제어 토큰 거르기

gpt-oss 계열 모델(예: gpt-oss-120b)은 `<|channel|>final<|message|>...` 같은 harmony 제어 토큰을 응답에 드러낼 수 있다. 그대로 두면 OpenAI SDK 의 SSE 파서가 이 토큰을 파싱하다 "Failed to parse input at pos 0: ..." 예외를 던진다. 그러면 사용자에게 원시 `LLM_CONNECTION_ERROR` 가 보인다. `openai.client.ts` 는 이를 두 층으로 막는다.

1. 스트리밍 중에 `delta.content` 와 tool_call 인자에서 제어 토큰을 지운다(`stripHarmonyTokens`). 패턴은 두 개다.
   - `HARMONY_CHANNEL_PREAMBLE_REGEX = /<\|channel\|>[\s\S]*?<\|message\|>/g`: 채널 이름을 포함한 preamble 전체를 한 번에 지운다.
   - `HARMONY_STANDALONE_TOKEN_REGEX = /<\|(channel|start|end|message|return|constrain|...)\|>/g`: 남은 단독 토큰을 지운다.
2. catch 블록에서 에러 메시지가 harmony 패턴과 맞으면 `LLM_OUTPUT_MALFORMED` 로 분류한다. 스트림 `error` 이벤트의 `message` 에는 원시 메시지 대신 고정 영문 진단 문장(`HARMONY_OUTPUT_MALFORMED_MESSAGE`)을 싣고, 원시 메시지는 경고 로그에만 남긴다. 사용자에게 보일 문구는 클라이언트가 정하지 않는다. 호출하는 쪽이 `code` 로 고르고, 워크플로우 AI 어시스턴트는 코드별 고정 문구를 보낸다([워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md)).

새 제어 토큰이 관찰되면 `HARMONY_STANDALONE_TOKEN_REGEX` 의 선택지에 더한다. 어시스턴트 화면에서 렌더 직전에 한 번 더 거르는 규칙(`sanitizeAssistantText`)과 이 대응을 들인 경위는 [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md) 에서 다룬다.

## 스트리밍

워크플로우 AI 어시스턴트처럼 턴 지연이 사용 경험에 중요한 기능을 위해 `LLMClient` 는 선택적 `stream()` 메서드를 둔다. 시그니처는 [LLMClient](CLE-AI-LLM-IFACE.md#llmclient) 절과 같다. `chat()` 과 독립적으로 구현한다. `stream()` 을 두지 않은 클라이언트에 스트리밍을 요청하면 `LlmService.chatStream` 이 스트림을 열기 전에 `LLM_STREAMING_UNSUPPORTED` 를 던진다.

### 스트림 이벤트

```typescript
type ChatStreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call_delta'; id: string; name?: string; argumentsDelta: string }
  | { type: 'tool_call_end'; id: string; name: string; arguments: string;
      signature?: string }   // 완성된 tool call 전체를 싣는다. signature 는 ToolCall.signature 와 같다
  | { type: 'done'; usage: TokenUsage; model: string;
      finishReason: ChatResponse['finishReason'] | 'aborted' }   // 'aborted' = 클라이언트 취소
  | { type: 'error'; code: LlmStreamErrorCode; message: string };   // message 는 서버 로그용 진단 문구

type LlmStreamErrorCode = 'LLM_RATE_LIMIT' | 'LLM_CONNECTION_ERROR' | 'LLM_OUTPUT_MALFORMED';
```

| 이벤트 | 의미 |
|--------|------|
| `text_delta` | assistant 텍스트의 부분 증분 |
| `tool_call_delta` | tool_call 인자의 부분 증분. 같은 `id` 로 여러 번 나온 뒤 `tool_call_end` 로 끝난다 |
| `tool_call_end` | tool_call 한 건 완성. 완성된 `name`·`arguments`(+`signature?`)를 싣는다. 호출하는 쪽이 shadow 실행·검증을 시작할 시점이다 |
| `done` | 스트림 전체 종료. usage 는 LLM 응답에 들어 있을 때만 정확하고, 없으면 `0` 으로 보고한다 |
| `error` | 스트림 중단 사유. `code` 는 `LlmStreamErrorCode` 세 값 중 하나다. `message` 는 서버 로그용 진단 문구라 화면에 그대로 보이지 않는다. 대개 프로바이더나 SDK 의 원문이라 요청 내용이나 모델 출력이 섞일 수 있고, `LLM_OUTPUT_MALFORMED` 만 고정 영문 문장이다. 호출하는 쪽은 사용자에게 보일 문구를 `code` 로 고른다. 클라이언트는 이후 이벤트를 받지 않는다 |

### 프로바이더별 구현

| 프로바이더 | 지원 | 내부 매핑 |
|-----------|------|-----------|
| OpenAI | ✅ | `chat.completions.create({stream: true})`. `choices[0].delta.content` → `text_delta`, `choices[0].delta.tool_calls[].function.arguments` → `tool_call_delta`, `choices[0].finish_reason` → `done` |
| Anthropic | ✅ | `messages.stream()`. `content_block_delta`(text_delta/input_json_delta), `content_block_start`/`content_block_stop` 으로 `tool_call_end` 를 판정하고, `message_delta` 에서 usage 를 모은다 |
| Google AI | ✅ | 새 `@google/genai` SDK 의 `ai.models.generateContentStream()` 한 경로만 쓴다(별도 `ChatSession`·`GenerativeModel` 객체 없음). 스트림 조각마다 `candidates[].content.parts` 를 돌며 `text` part 는 `text_delta` 로 보낸다. `functionCall` part 는 인자가 완결된 JSON 으로 한 번에 오므로 `tool_call_delta` 와 `tool_call_end` 를 같은 자리에서 바로 보낸다(OpenAI 처럼 `arguments` 조각을 모으는 단계가 없다). usage 는 `usageMetadata` 에서 한 번 모은다 |
| Azure OpenAI | ✅ | OpenAI 호환 SDK 의 스트리밍 SSE 를 그대로 쓴다. `AzureOpenAIClient` 가 `OpenAIClient.stream` 을 상속하고 deployment name 과 `api-version` 만 base URL·헤더에 옮긴다 |
| Local (Ollama/vLLM) | ✅ | OpenAI 호환 엔드포인트로 같은 코드 경로(`LocalClient extends OpenAIClient`)를 쓴다. Ollama 11434, vLLM OpenAI 호환 모드에서 스트리밍을 검증했다 |

### 스트리밍 에러 매핑

| 경우 | 이벤트 | 비고 |
|--------|--------|------|
| 429 rate limit (스트리밍 시작 전) | `error` (code=`LLM_RATE_LIMIT`) | 모든 프로바이더가 같다. `chatStream` 은 앱 수준 재시도(`withRetry`)를 거치지 않는다. OpenAI 계열과 Anthropic 은 SDK 가 먼저 다시 보낸다([호출 신뢰성 계약](CLE-AI-LLM-SERVICE.md#호출-신뢰성-계약)) |
| 그 밖의 실패 (스트리밍 시작 전, 429 아님) | `error` (code=`LLM_CONNECTION_ERROR`) | 모든 프로바이더가 같다. 인증 실패나 모델 없음 같은 실패가 여기 든다 |
| 시작 뒤 네트워크 단절 | `error` (code=`LLM_CONNECTION_ERROR`) | 클라이언트가 다시 시작하도록 안내한다 |
| 클라이언트 취소 (사용자 Stop) | `done` (finishReason=`aborted`) | 서버는 usage 가 확인되는 만큼만 기록한다 |
| 스트림을 여는 중 클라이언트 취소 | `done` (finishReason=`aborted`) | 모든 프로바이더가 같다. usage 는 0 이고 `model` 은 요청한 모델이다. usage 가 0 이라 사용량을 기록하지 않는다 |
| `stream()` 이 없는 클라이언트에 스트리밍 요청 | `LlmService.chatStream` 이 스트림을 열기 전에 `LLM_STREAMING_UNSUPPORTED` 를 던진다(`BadRequestException`) | 어시스턴트는 non-streaming 대체 경로 없이 SSE `error` 이벤트로 넘긴다. 다섯 프로바이더 클라이언트가 모두 `stream()` 을 구현해 운영 환경의 발동 경로는 없다 |
| 응답 헤더가 오기 전 SDK 요청 타임아웃 | `error` (code=`LLM_CONNECTION_ERROR`) | OpenAI 계열과 Anthropic 이 해당한다. Google 은 SDK 타임아웃이 없다. `stream()` 에는 앱 타임아웃(`timeoutMs`)이 없다. 그래서 헤더가 온 뒤 토큰이 멈추면 어느 프로바이더에서도 잡지 못한다. 스트림 유휴 감지는 두지 않는다([Rationale](CLE-AI-LLM.md#llm-호출의-공통-상한을-정한다-2026-11-14)) |

세 클라이언트(OpenAI 계열 · Anthropic · Google)는 스트림을 열 때의 실패를 예외로 던지지 않는다. 도중의 실패와 같은 `error` 이벤트로 낸다. OpenAI 계열은 열 때의 실패도 도중 실패와 같은 함수(`streamErrorEvent`)로 분류한다. 스트림을 여는 중의 취소는 실패가 아니어서 도중 취소와 같은 `done` 이벤트로 끝낸다. 이 이벤트는 공통 헬퍼 `abortedBeforeOpen`(`clients/stream-open.ts`)이 만든다. 어느 클라이언트도 실패한 스트림을 다시 열지 않는다. `LlmService.chatStream` 이 스트림을 열기 전에 던지는 예외(스트리밍 미지원, 클라이언트 생성 실패)는 이 계약 밖이다. 결정과 기각한 대안은 [LLM 클라이언트 Rationale](CLE-AI-LLM.md#스트림-열기-실패를-모든-프로바이더에서-error-이벤트로-낸다-2026-11-14) 에 있다.

### chat() 과의 관계

- `chat()` 은 모든 프로바이더가 반드시 구현한다. 어시스턴트 밖의 AI 노드·임베딩·연결 테스트는 계속 `chat()` 을 쓴다.
- `stream()` 은 워크플로우 AI 어시스턴트 전용이다. AI 에이전트 노드의 스트리밍 응답 요구사항(`ND-AG-09`)이 필수가 되면 그때 넓혀 적용한다.

## Rationale

### 스트림 오류 `message` 는 진단용으로 둔다 (2026-11-13)

harmony 제어 토큰이 드러나면 `openai.client.ts` 는 처음에 `LLM_OUTPUT_MALFORMED` 의 `message` 에 사용자용 한국어 안내문을 실었다. 그런데 이 문구를 쓰는 유일한 소비자인 워크플로우 AI 어시스턴트는 클라이언트 `message` 를 로그에만 남기고 화면에는 코드별 고정 문구를 보낸다. 한국어 문장은 화면에 나가지 않은 채 다국어 규약의 하드코딩 한국어 점검에만 걸렸다. 그래서 클라이언트 계층은 사용자 문구를 정하지 않고, 스트림 `error` 의 `message` 는 어느 코드든 진단용으로 둔다. `LLM_OUTPUT_MALFORMED` 는 SDK 원문에 모델 출력이 섞일 수 있어 고정 영문 문장을 싣고 원문은 경고 로그에만 남긴다. 사용자에게 보일 문구를 클라이언트에서 정하는 안은 소비자마다 화면 언어와 안내 내용이 달라 택하지 않았다.
