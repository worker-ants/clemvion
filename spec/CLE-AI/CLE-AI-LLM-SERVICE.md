---
id: "CLE-AI-LLM-SERVICE"
title: "LLM 클라이언트 — 서비스 계층과 모델 목록"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-AI-LLM"
ancestors: ["CLE-VISION", "CLE-AI", "CLE-AI-LLM"]
area: "CLE-AI"
content_hash: "f81a1d37fbc368b6d6d706a4e4d950e79d509c109da8a704ac6bd674b6b5db5e"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "76cbd17e20a09d0d0283c2508afc5bc035e98b3f3247b216eb23cdbbc50b0747"
etag: "sha256-5f9c32743de65409632b13573c771b327988c3fd680f1afaf2bd5d70da8df4f4"
---
## 개요

이 문서는 [LLM 클라이언트](CLE-AI-LLM.md) 의 하위 문서로 서비스 계층(`LlmService`)의 호출 계약 · 설정 해석 · 연결 테스트와 저장 전 모델 목록 미리보기 방식을 정한다.

## 서비스 계층

`LlmService` 는 모든 LLM 호출이 지나는 단일 창구다. 설정 해석(`resolveConfig`)·`chat`·`chatStream`·`embed`·`listModels`·`testConnection` 을 제공한다.

```typescript
class LlmService {
  // chat / embed / resolveConfig 유지. testConnection 은 kind 별 probe 분기(아래 표).

  /** 배치 임베딩. 20개 단위로 나눠 보내고 내부 재시도를 한다. LLMClient.embed 의 래퍼.
   *  opts(timeoutMs/disableInnerRetry)는 서비스 래퍼 전용이라 LLMClient 인터페이스에는 없다.
   *  inputType 기본값은 'document'(적재), 검색 query 만 'query'. */
  embed(
    config: LlmConfig,
    texts: string[],
    model?: string,
    opts?: Pick<LlmCallOptions, 'timeoutMs' | 'disableInnerRetry'>,
    inputType?: 'query' | 'document',   // 생략하면 'document'
  ): Promise<number[][]>;

  /** 스트리밍 chat. client.stream 에 넘기고, done 이벤트에서 llmUsageLogService.record() 를 fire-and-forget 으로 부른다 */
  chatStream(
    config: LlmConfig,
    params: ChatParams,
    context?: LlmCallContext,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent>;
}
```

- `LlmCallOptions`(`timeoutMs`·`disableInnerRetry`·`signal`)는 코드(`llm.service.ts`)가 기준이다. `embed` 는 그중 `timeoutMs`·`disableInnerRetry` 만 받는다.
- 호출 예: `opts` 없이 query 임베딩만 원하면 네 번째 인자에 `undefined` 를 명시한다. `embed(config, texts, model, undefined, 'query')`. 위치 인자라서 `inputType` 만 넘길 때는 `opts` 자리를 비워야 한다.

### 호출 신뢰성 계약

`chat` 호출은 `LlmCallOptions` 로 다음을 제어한다.

- `timeoutMs`: 0 이거나 없으면 타임아웃을 걸지 않는다. 값이 있으면 `withTimeout` race 로 건다.
- 프로바이더 SDK 에도 요청 타임아웃이 따로 있다. OpenAI·Anthropic·Azure OpenAI·Local(OpenAI 계열) 클라이언트는 SDK 를 만들 때 약 120초 요청 타임아웃이 들어간다. `timeoutMs` 는 이 SDK 타임아웃과 나란히 걸리고 먼저 발화하는 쪽이 실제 상한이다. 앱 레벨 값을 1차 상한으로 쓰려면 SDK 타임아웃보다 낮게 준다. Google 클라이언트는 SDK 를 만들 때 요청 타임아웃을 주지 않아(`new GoogleGenAI({ apiKey, apiVersion })`) SDK 타임아웃이 없다. SDK 요청 타이머는 응답 헤더가 오면 멈추고, OpenAI·Anthropic SDK 는 타임아웃 난 요청도 기본 2회(`maxRetries`) 다시 보낸다. 그래서 한 호출이 SDK 타임아웃만으로 끝나기까지는 120초보다 길 수 있다. 노드별 앱 레벨 기본값(예: `AI_AGENT_LLM_CALL_TIMEOUT_MS`)은 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 에서 정한다. 모든 호출에 거는 공통 앱 타임아웃은 없다. 호출 경로별 값은 [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md) 의 NF-AI-01 이 모아 적는다.
- `withTimeout` 은 콜백에 넘기는 내부 타임아웃 signal 을 호출자 `opts.signal` 과 `AbortSignal.any` 로 합쳐 SDK 요청에 넘긴다. 타임아웃이 나면 실제 프로바이더 HTTP 요청도 취소되므로 소켓이 남지 않는다(`listModels` 와 같은 방식). Google 클라이언트는 `chat(params, signal)` 로 받은 signal 을 `generateContent` 의 `abortSignal` 로 넘긴다. `embed` 경로는 `client.embed` 가 signal 을 받지 않아 이 배선 밖이다.
- `signal`: [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) 규약을 따른다. 취소되면 SDK 가 바로 throw 하고 재시도 대상이 아니다.
- `disableInnerRetry`: 호출하는 쪽에 자체 재시도 층(예: 지식 저장소의 `retryWithBackoff`)이 있으면 내부 재시도를 꺼서 호출이 불어나지 않게 한다.
- 내부 `withRetry` 는 rate limit(HTTP 429 또는 "rate limit") 에만 최대 3회 재시도한다. RFC 7231 `Retry-After` 헤더(delta-seconds 또는 HTTP-date)가 있으면 그 값을 따르되 상한은 60초다. 없으면 지수 백오프를 쓴다.
- `chatStream` 은 `withRetry` 를 거치지 않는다. 스트림을 열 때도 도중에도 앱이 다시 시도하지 않고 실패를 호출하는 쪽에 그대로 넘긴다.
- 호출하는 쪽이 메시지에 붙인 `source` 마커(WebSocket emit 메타)는 프로바이더로 보내기 전에 떼어 낸다.
- chat 계열 호출은 끝난 뒤 사용량을 fire-and-forget 으로 기록한다. `chatStream` 은 `done` 이벤트에서만 기록한다. 적재 규칙은 [LLM 사용량 기록](CLE-AI-USAGE.md) 에서 정한다.

### 설정 해석과 캐시

- `resolveConfig(llmConfigId?, workspaceId)` 는 지정한 모델 설정을 찾고, 없으면 워크스페이스의 Chat 종류 기본 설정을 찾는다. 돌려주는 엔티티의 `api_key` 는 암호문 그대로다.
- `createClient` 가 클라이언트를 만들기 직전에 `getDecryptedApiKey` 로 복호화하고, 만든 클라이언트는 설정별로 캐시한다.
- `listModels` 결과는 설정마다 5분 캐시한다(키 `${workspaceId}|${configId}`). 호출 타임아웃은 30초다.
- 모델 설정을 고치거나 지우면 `ModelConfigService` 가 `notifyInvalidated(id)` 로 통지한다. `LlmService` 는 `onModuleInit` 에서 `onConfigInvalidated` 를 구독해 두었다가 `clearClientCache(id)` 로 클라이언트 캐시와 `listModels` 캐시를 함께 지운다.

### testConnection

`LlmService.testConnection(configId, workspaceId)` 는 저장된 설정으로 연결을 확인한다. 설정은 `ModelConfigService.findEntity(configId, workspaceId)` 로 종류와 상관없이 찾는다([Rationale](#종류와-상관없이-설정을-찾는-이유)).

| 종류 | probe | 반환 |
|------|-------|------|
| chat | `client.testConnection()` (모델 목록 조회 같은 가벼운 호출) | `{ success: true }` |
| embedding | `client.embed(['connection test'], defaultModel)`. 실제 임베딩으로 연결과 모델 유효성을 함께 확인한다 | `{ success: true, dimension? }`. 반환 배열 첫 요소 길이(`vectors[0].length`)를 `dimension` 에 싣는다(0 이면 뺀다) |
| 실패(종류 무관) | 설정 조회 · 클라이언트 생성 · 위 probe 가운데 하나가 던졌다 | `{ success: false, message }` |

실패 응답 형식:

- 실패해도 예외를 던지지 않는다. HTTP 200 과 성공 봉투 `{ data: { success: false, message } }` 로 돌려준다. 원본 에러는 서버 로그(warn)에만 남긴다.
- `message` 는 `sanitizeLlmErrorMessage`(`utils/sanitize-error.util.ts`)가 원본 에러 문구를 보고 고른 고정 문구 여덟 개 가운데 하나다. 갈래는 인증 실패(401), 접근 거부(403), 모델이나 엔드포인트 없음(404), 속도 제한(429), 시간 초과, 연결 거부, 호스트 이름 해석 실패, 그 밖의 실패다. 프로바이더 원문 · 키 · 엔드포인트는 싣지 않는다.
- 결과 객체에 `code` 는 없다. 통합 연결 테스트의 `IntegrationTestResult` 와 다르다([통합 관리 「연결 테스트」](../CLE-INT/CLE-INT-MANAGE.md#연결-테스트)). 클라이언트 계층이 실패를 `LLM_RATE_LIMIT` 와 `LLM_CONNECTION_ERROR` 두 갈래로만 나누고 세분화 코드는 미구현이라([에러 처리](CLE-AI-LLM-STREAM.md#에러-처리)), 코드를 실어도 거의 늘 `LLM_CONNECTION_ERROR` 다. 원인 갈래는 `message` 의 고정 문구가 이미 나눠 보여 준다.
- 설정이 없거나 다른 워크스페이스의 설정이어도 404 가 아니라 같은 실패 모양이다. 설정 조회도 같은 `try` 안에 있어서 `MODEL_CONFIG_NOT_FOUND` 가 결과 객체로 바뀌고 `message` 는 «모델이나 엔드포인트 없음» 문구다. rerank 설정을 API 로 직접 부를 때도 클라이언트 생성이 실패해 같은 모양이다.
- 역할 거부(403)와 요청 빈도 초과(429)는 핸들러 앞의 가드가 내므로 에러 봉투다.

- `LLMClient.testConnection(): Promise<boolean>` 인터페이스는 바꾸지 않는다. 차원 추출은 서비스 계층 전용이다([Rationale](#testconnection-의-차원-추출이-embedresponse-와-따로-가는-이유)).
- 감지한 `dimension` 의 자동 저장과 폼의 읽기 전용 표시는 [모델 설정](CLE-AI-MODELS.md) 에서 정한다.
- `rerank` 는 표준 테스트 API 가 없어 연결 테스트를 제공하지 않는다.
- `POST /api/model-configs/:id/test` 는 편집자 이상만 부를 수 있다. 컨트롤러 `LlmModelConfigController.testConnection` 의 `@Roles('editor')` 가 강제한다. 근거는 [모델 설정](CLE-AI-MODELS.md) 의 Rationale 에 있다.

모듈 의존은 `LlmModule → ModelConfigModule` 한 방향이다. 모델 설정 부속 엔드포인트(`preview-models`·`:id/test`·`:id/models`)는 llm 모듈의 `LlmModelConfigController`(`@Controller('model-configs')`, 공개 경로는 그대로)가 맡는다. CRUD 는 `model-config.controller.ts` 에 남는다.

## 모델 목록 미리보기

모델 설정 화면에서 기본 모델을 고르려면 아직 저장하지 않은 자격 증명으로 `listModels` 를 불러야 한다. 이 경로는 저장된 설정을 쓰는 `LlmService` 와 떨어진 전용 서비스 `LlmPreviewService.previewModels` 가 맡는다. 엔드포인트(`POST /api/model-configs/preview-models`)·권한·rate limit 은 [모델 설정](CLE-AI-MODELS.md) 에서 정한다.

- 요청 본문 `{ provider, apiKey, baseUrl? }` 로 `LLMClientFactory` 가 임시 클라이언트를 만들고 `client.listModels(signal)` 을 한 번 부른다.
- 반환 값은 저장된 설정용 `GET /api/model-configs/:id/models` 와 같은 `ModelInfo[]` 다. 보안 계약도 같다.
- 임시 클라이언트는 설정별 캐시에 넣지 않고 요청 범위에서만 쓴다.
- 타임아웃은 30초다.
- `local` 이 아닌 프로바이더에서 `apiKey` 가 비어 있으면 `LLM_CREDENTIALS_REQUIRED` 로 거부한다.
- 프로바이더 원본 에러는 [에러 처리](CLE-AI-LLM-STREAM.md#에러-처리) 의 sanitize 규칙대로 가공해 400 `LLM_MODEL_LIST_FAILED` 로 돌려준다. 키와 엔드포인트 원문은 드러내지 않는다.
- 저장 전 `baseUrl` 은 [SSRF 가드](CLE-AI-LLM.md#ssrf-가드) 를 거친다.

### 모델 목록 결과 수 상한

프로바이더가 돌려준 모델 수는 방어적 상한 **500**(`MAX_MODEL_LIST_SIZE`, `llm/list-models-cap.ts`)에서 자른다. 미리보기와 저장된 설정의 `GET :id/models` 에 똑같이 적용한다. 정상 프로바이더(수십 개)에는 닿지 않는 값이다. 사용자가 지정한 `baseUrl`·local 처럼 비정상적으로 큰 응답에서 메모리와 페이로드를 지키려는 장치다. 넘치면 앞 500개만 남기고(프로바이더 순서 유지, 다시 정렬하지 않음) 경고 로그를 남긴다. 응답 계약(`ModelInfo[]`)은 바뀌지 않는다.

### API 키 로깅 금지

`apiKey` 는 로그·응답·캐시 어디에도 기록하지 않는다.

- 미리보기 엔드포인트는 `apiKey` 를 요청 본문으로 받는다. 운영 계약상 요청 본문은 로거·APM·에러 트래커가 캡처하면 안 된다.
- 나중에 요청 본문 로깅을 도입하면 `common/utils/mask-sensitive-fields.util.ts` 의 `maskSensitiveFields` 로 감싸 `apiKey`·`password`·`token` 계열 필드를 자동으로 가려야 한다.
- 키를 본문 대신 전용 헤더로 보내고 TTL 이 있는 임시 설정 프록시를 두는 완전한 분리는 별도 작업 범위다. 지금은 "본문에는 있지만 어느 경로에도 기록하지 않는다" 를 지킨다.

## Rationale

### testConnection 의 차원 추출이 EmbedResponse 와 따로 가는 이유

`EmbedResponse`(usage·`dimensions` 메타데이터 반환)는 아직 미구현이다. 그러나 Embedding 연결 테스트의 `dimension` 은 서비스 계층(`LlmService.testConnection`)이 평범한 `embed()` 반환 벡터의 길이(`vectors[0].length`)에서 뽑는다. 따라서 `LLMClient.embed`·`testConnection` 인터페이스를 바꾸지 않고 두 작업은 서로 독립이다. 단수 `dimension`(설정 한 건의 출력 차원)과 복수 `dimensions`(미구현 `EmbedResponse` 메타데이터)의 이름 차이는 의도한 것이다.

### LLM 호출 타임아웃을 호출 경로별로 적는다 (2026-10-10)

AI 제품 요구사항 NF-AI-01 은 LLM 호출 타임아웃을 120초(스트리밍 제외)로 요구했다. 클라이언트 계층은 `timeoutMs` 를 받지 않으면 앱 타임아웃을 걸지 않고, 120초는 일부 SDK 의 요청 타임아웃으로만 걸린다. 호출하는 쪽 값도 제각각이었다(AI 에이전트 10분, 어시스턴트 문서는 스트리밍 턴에 120초와 `LLM_TIMEOUT`).

2026-10-10 에 사람이 문서를 코드에 맞추기로 정했다. 클라이언트 계층은 지금처럼 호출자가 주는 `timeoutMs` 만 걸고 공통 기본값을 두지 않는다. 공통 기본값을 둘지는 이 결정에서 따지지 않았다(2026-10-23 정정, [미결 사항](CLE-AI-LLM.md#미결-사항)). 타임아웃을 `LLM_TIMEOUT` 으로 옮기지도 않는다. 호출 경로별 값은 [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md) 의 NF-AI-01 이 모아 적는다. AI 에이전트의 앱 기본값 10분을 120초로 낮추는 안과 스트리밍에 타임아웃을 두는 안을 기각한 근거도 그 문서의 Rationale 에 있다.

### 종류와 상관없이 설정을 찾는 이유

모델 설정 화면은 chat·embedding·rerank 어느 설정이든 테스트하고 모델을 불러온다. Chat 종류만 찾는 경로를 거치면 embedding·rerank 설정이 `MODEL_CONFIG_NOT_FOUND` 로 거부돼 연결 테스트와 모델 불러오기가 깨진다. 그래서 `testConnection`·`listModels` 는 `ModelConfigService.findEntity`(종류 무관)를 바로 쓴다.

모듈 순환도 함께 정리했다. 모델 설정 컨트롤러가 부속 엔드포인트를 위해 `LlmService`·`LlmPreviewService` 를 주입하고 `LlmService.clearClientCache` 를 직접 부르면 `LlmModule` 과 `ModelConfigModule` 이 서로 forwardRef 로 물린다. 부속 엔드포인트를 llm 모듈의 `LlmModelConfigController` 로 옮기고(공개 경로는 그대로), 캐시 무효화를 `ModelConfigService.onConfigInvalidated` 옵저버로 뒤집어 한 방향 의존으로 만들었다.

### 연결 테스트 실패는 200 결과 객체로 돌려준다 (2026-11-12)

「testConnection」 의 실패 응답 형식은 현행 구현을 적은 것이다. NERV Task `CLE-T-J6TZGK` 에서 정했다.

- 연결 테스트는 시험해 보고 결과를 알려 주는 요청이다. 외부 프로바이더의 거절은 시험 결과이고 요청 오류로 보지 않는다. 그래서 HTTP 200 결과 객체로 돌려준다. 통합의 연결 테스트(`:id/test`)도 같은 이유로 200 과 `IntegrationTestResult` 를 쓴다([통합 관리 「설치 대기 연결 테스트는 200 과 `success:false` 로 거절한다」](../CLE-INT/CLE-INT-MANAGE.md#설치-대기-연결-테스트는-200-과-successfalse-로-거절한다)).
- 200 결과 객체의 필드 이름은 에러 봉투와 겹치지 않게 둔다. 결과 객체는 성공 봉투의 `data` 안에 있고 `error` 키를 쓰지 않는다. 클라이언트는 먼저 상태 코드로 가른다. 2xx 면 `data.success` 를 본다. 2xx 가 아니면 에러 봉투의 `error.code` 를 본다([에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md)). 결과 객체에 `error` 를 두면 두 경로를 한 필드 이름으로 읽게 되어 클라이언트가 섞어 처리하기 쉽다.
- 저장을 함께 하는 요청은 다르다. 통합 자격 증명 교체는 안에서 연결 테스트를 하지만 실패하면 저장을 거절하므로 에러 봉투로 돌려준다([통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드)).
- `code` 를 두지 않은 이유는 「testConnection」 에 적었다. 세분화 코드(`LLM_AUTH_ERROR` 등)를 구현하면 결과 객체에 `code` 를 더하는 것을 다시 본다.
