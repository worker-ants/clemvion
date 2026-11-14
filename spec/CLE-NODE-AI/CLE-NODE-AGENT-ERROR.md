---
id: "CLE-NODE-AGENT-ERROR"
title: "AI 에이전트 노드 — 에러와 타임아웃"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-AGENT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-AI", "CLE-NODE-AGENT"]
area: "CLE-NODE-AI"
content_hash: "99b7777245d397960b84ca1a36fb378dd67bb73471864a674f7ca883cc88b1e8"
read_as: "approved_fallback"
task: "CLE-T-0R5SYN"
source_paths: []
mirror_sha256: "7152d756f953fe2b4917900908433334c00aa541e5ae245e6ba9283efa69127b"
etag: "sha256-86ac025b084125863de82bddaf9df2701b3998ae9846adcbd2b855c9907a0d5b"
---
## 개요

이 문서는 [AI 에이전트 노드](CLE-NODE-AGENT.md) 의 하위 문서로 단일 턴의 `error` 포트 범위, LLM 호출 타임아웃, 진단 메타 포함 조건, 에러 코드와 재시도 분류, 실행 전 설정 검증을 정한다. 에러 출력의 구조는 [AI 에이전트 노드 출력과 디버그](CLE-NODE-AGENT-OUTPUT.md) 가 정한다.

## 단일 턴의 error 포트

단일 턴은 LLM 호출(첫 호출과 도구 루프 호출)이 실패하거나 도구 정의 크기 예산을 넘으면 `error` 포트로 보낸다. 롤링 요약 호출(`summary_buffer`·`persistent` 전략)이 실패하거나 요약 모델 설정(`summaryModelConfigId`)을 조회(`resolveConfig`)하지 못해도 `error` 포트로 보낸다. 분류는 LLM 호출 실패와 같다([에러 코드](#에러-코드)).

- 두 실패로 나온 출력의 `meta` 토큰은 실패 전에 성공한 턴 응답 LLM 호출의 합이다. 기준은 [AI 노드 공통 §토큰 회계](CLE-NODE-AI-COMMON.md#토큰-회계) 에 있고 출력 형태는 [AI 에이전트 노드 출력과 디버그](CLE-NODE-AGENT-OUTPUT.md) 에 있다. 호출 경로별 앱 타임아웃은 [AI 노드 공통](CLE-NODE-AI-COMMON.md#llm-호출-경로별-타임아웃) 의 표에 있다.
- 노드 LLM 설정(`llmConfigId`)을 조회하지 못하면 단일 턴은 아직 에러 코드 없이 실패한다(throw). 멀티턴 재개는 같은 실패를 `error` 포트로 보낸다. LLM 오류의 `error` 포트 요구사항을 부분 구현으로 둔 것은 이 남은 범위 때문이다. 남은 범위는 NERV Task `CLE-T-T8FVCG` 가 맡는다.
- 노드 취소는 `error` 포트로 가지 않는다. 노드 signal 이 abort 된 뒤에 실패하면 AbortError 를 던지고 노드는 `cancelled` 로 끝난다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)).
- `error` 포트로 나온 실패에는 노드 에러 처리 정책(재시도 등)이 걸리지 않는다([노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md#1-에러-처리-정책-다섯-가지)). `error` 연결선이 없으면 `ERROR_PORT_FALLBACK` 으로 워크플로우가 멈춘다([노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md#2-에러-포트로-라우팅)).

## LLM 호출 타임아웃

턴 응답을 만드는 LLM `chat` 호출(단일 턴 2곳, 멀티턴 재개 2곳. 각각 첫 호출과 도구 루프 호출)에 호출당 앱 레벨 타임아웃을 건다. 마지막 턴 다시 시도도 재개 경로라 같은 타임아웃을 받는다. 롤링 요약(`summary_buffer`·`persistent` 전략)의 요약 호출도 같은 타임아웃을 받는다. 단일 턴의 요약 호출은 노드 취소 신호(`context.abortSignal`)도 받는다. 멀티턴 재개에는 신호 소스가 없다. 그래서 재개 턴의 요약 호출도 그 턴의 다른 `chat` 호출처럼 앱 타임아웃과 턴 경계의 취소 관측으로 끝난다. 요약 호출이 실패하면 그 턴이 실패한다. 다른 AI 노드와 그 밖의 호출 경로의 값은 [AI 노드 공통](CLE-NODE-AI-COMMON.md) 의 NF-AI-01 이 모아 적는다.

- 환경 변수 `AI_AGENT_LLM_CALL_TIMEOUT_MS`, 기본 600000ms(10분), `0` 이면 끈다. `0` 이면 `LlmService.chat` 의 기본값 10분도 걸리지 않는다. `LlmService.chat` 은 `opts.timeoutMs > 0` 이면 `withTimeout`(자체 `AbortController`)으로 경쟁시켜 넘으면 예외를 던진다. 새 에러 코드는 없다.
- 단일 턴과 멀티턴 재개 모두 공유 분류 모듈 `llm-error-payload.ts` 가 이 예외를 재시도 가능 `LLM_CALL_FAILED`(네트워크 타임아웃 계열)로 분류한다. AI 에이전트 경로는 `LLM_TIMEOUT` 을 내지 않는다. `error-codes.ts` 의 `LLM_TIMEOUT` 은 어느 경로도 내지 않는 별개 enum 이며 정리는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 소관이다.
- 단일 턴의 타임아웃도 `error` 포트로 간다. 노드 signal 이 abort 되지 않은 채 끝난 AbortError 는 타임아웃으로 분류한다. 1차 목적은 무기한 멈춤에 상한을 두는 것이다.
- 타임아웃은 노드 `abortSignal` 과 독립이다. 재개 경로에는 전파할 signal 이 없다. 사용자 중단은 `AbortController` 없이 Execution 행만 UPDATE 하고, `AbortController` 를 만드는 곳은 `parallel-executor.ts` 한 곳뿐이다. 그래서 재개 경로 취소는 턴 경계 DB 관측 가드가 맡는다(2026-07-27 구현, [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)). `ResumableMessageOptions.signal` 은 지금 늘 `undefined` 인 자리다.
- 프로바이더 SDK 요청 타임아웃과 나란히 걸려 먼저 발화하는 쪽이 실제 상한이다. SDK 타임아웃 값과 재전송은 [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md#호출-신뢰성-계약) 가 정한다. 앱 레벨은 SDK 타임아웃이 없는 구성의 긴 멈춤과 호출당 단일 손잡이 역할을 한다. 앱 레벨을 1차 상한으로 쓰려면 SDK 보다 낮게 준다. 모든 LLM 호출에 120초를 거는 공통 기준은 없다(2026-10-10 결정, [AI 노드 공통](CLE-NODE-AI-COMMON.md) NF-AI-01).
- `LlmService.chat` 은 내부 타임아웃 signal 을 호출자 `opts.signal` 과 `AbortSignal.any` 로 합쳐 SDK 요청에 넘긴다. 타임아웃이 나면 실제 HTTP 요청을 취소해 소켓이 남지 않는다(`listModels` 와 같은 패턴). Google 클라이언트도 `chat(params, signal)` 로 받은 signal 을 `generateContent` 의 `abortSignal` 로 넘긴다. `embed` 경로는 signal 을 받지 않아 이 배선 밖이다(후속).
- `AI_AGENT_LLM_CALL_TIMEOUT_MS` 는 AI 에이전트 전용이다. 텍스트 분류기·정보 추출기처럼 `timeoutMs` 를 넘기지 않는 호출에는 `LlmService.chat` 의 기본값 10분이 걸린다([AI 노드 공통](CLE-NODE-AI-COMMON.md#llm-호출-경로별-타임아웃)).

## 진단 메타 포함 조건

필드 의미는 [AI 노드 공통](CLE-NODE-AI-COMMON.md) 의 진단 누적 절을 따른다. 각 필드는 해당 provider 가 불린 노드에만 있다.

| 필드 | 조건 | 출처 |
|------|------|------|
| `meta.ragSources` | `knowledgeBases` 가 1개 이상 | `RagAccumulator.getSources()` (chunkId 중복 제거) |
| `meta.ragDiagnostics` | `knowledgeBases` 가 1개 이상 | `RagAccumulator.getDiagnostics()` |
| `meta.mcpDiagnostics` | `mcpServers` 가 1개 이상이거나 LLM 이 MCP 도구를 한 번 이상 부름 | MCP 프로바이더 |

## 에러 코드

단일 기준은 핸들러와 LLM provider 가 예외를 던지는 시점이다.

| code | 발생 조건 | retryable | 시점 |
|------|-----------|---|------|
| `LLM_CALL_FAILED` | provider HTTP 5xx | true | 실행 중 |
| `LLM_CALL_FAILED` | 네트워크 타임아웃 | true | 실행 중 |
| `LLM_CALL_FAILED` | provider HTTP 401·403 (인증) | false | 실행 중 |
| `LLM_CALL_FAILED` | 분류 불가 fallback. status·명시 code·네트워크 신호가 모두 없는 예외. 재시도 안전성을 확인할 수 없어 보수적으로 처리 | false | 실행 중 |
| `LLM_RATE_LIMIT` | provider HTTP 429. 5xx 와 뜻이 달라 하위 사례로 나눈다(`LLM_CALL_FAILED` 는 유지) | true | 실행 중 |
| `LLM_RESPONSE_INVALID` | 응답 형식 오류. `responseFormat=json` 파싱 실패는 현재 원문 문자열로 두므로 내지 않는다. 명시 code 로 들어오면 보존한다 | false | 실행 중 |
| `TOOL_EXECUTION_FAILED` | (예약) 일반 도구 실행 예외. 입력 경로를 다시 만든 뒤 쓴다. 지식 저장소·MCP 단일 호출 실패는 격리해 `meta.*Diagnostics.errors` 에 기록하고 대화를 계속한다 | false | 실행 중(예약) |
| `MAX_TOOL_CALLS_EXCEEDED` | (예약) `maxToolCalls` 초과로 강제 종결을 정한 경우. 지금은 `tool_call_budget_exceeded` 로 돌려주기만 해 발생하지 않는다. 호출 한도 정책이 바뀌면 쓴다 | false | 실행 중(예약) |
| `TOOL_DEFINITION_PAYLOAD_EXCEEDED` | 도구 정의 크기가 hard 예산(기본 256 KB)이나 개수 상한(기본 128)을 넘음. LLM 호출 전 점검이며 호출 횟수 축 코드와 실패 지점이 다르다. `details: { retryable: false, totalBytes, budgetBytes, toolCount, culpritProvider? }`. message 에 해결법(`mcpServers[].enabledTools` 지정, 서버 끄기)을 적는다 | false | LLM 호출 전 |

**재시도 가능 여부** ([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 LLM 계열 필수 필드)

- `true`: HTTP 429·5xx·네트워크 타임아웃. 멀티턴에서는 백엔드가 `_retryState` 를 싣고, 화면은 스레드 `system_error` 항목 오른쪽에 [다시 시도] 버튼과 `retryAfterSec` 카운트다운을 보인다. 단일 턴은 `_retryState` 를 만들지 않아 `retryable: true` 여도 [다시 시도] 버튼이 없다([대화 미리보기 §다시 시도 버튼 조건](../CLE-EXEC/CLE-EXEC-PREVIEW.md#다시-시도-버튼-조건)).
- `false`: 인증 실패(401·403), JSON 파싱 실패, 스키마 치명 오류, 분류 불가 fallback. `_retryState` 를 싣지 않고 버튼도 보이지 않는다.

인증 실패 분류는 AI 노드마다 다르다([AI 노드 공통](CLE-NODE-AI-COMMON.md) 미결 사항).

**분류는 HTTP status 기준이다.** 단일 턴과 멀티턴 재개의 `chat()` 경로는 같은 분류를 쓴다. 두 경로 모두 provider SDK 원시 에러의 최상위 `.status` 를 받는다. 429 는 `LLM_RATE_LIMIT`, 401·403 은 재시도 불가 `LLM_CALL_FAILED`, 5xx·네트워크·타임아웃은 재시도 가능 `LLM_CALL_FAILED` 다. 에러에 명시 `code` 가 있으면 등록 코드든 미등록 벤더 코드(`LLM_PROVIDER_QUOTA`·`LLM_API_ERROR` 등)든 그대로 두고 `retryable=false` 로 한다. `AI_*` 코드로 감싸지 않는다. status·code·네트워크 신호가 모두 없을 때만 재시도 불가 `LLM_CALL_FAILED` fallback 이다. 구현은 `codebase/backend/src/nodes/ai/shared/llm-error-payload.ts` 의 `extractAiTurnErrorPayload` 다.

**`retryAfterSec`**: provider 가 `Retry-After`(Anthropic·OpenAI)나 같은 뜻의 신호(Google Gemini `retryDelay`)를 주면 초 단위로 바꿔 넣는다. `retryable === true` 일 때만 넣는다.

**표시 도구 스키마 위반은 `error` 포트로 가지 않는다.** 처리는 [도구와 조건 §표시 도구](CLE-NODE-AGENT-TOOLS.md#표시-도구) 가 정한다.

### 실행 전 설정 검증

[노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 3.1 에 따라 예외를 던진다. 조건 검증 규칙(최대 20개, id·label·prompt 필수, 예약 포트 금지, prompt 2,000자 이하)은 이 표가 정본이다.

| 발생 조건 | 메시지 (warningRule id 또는 validateConfig) | 시점 |
|-----------|---------|------|
| `model` 과 `llmConfigId` 가 모두 없음 | `ai_agent:no-llm-provider` (`AI_NO_LLM_PROVIDER_MESSAGE`) | warningRule(캔버스 배지) + handler.validate |
| 멀티턴인데 `systemPrompt` 가 없음 | `Multi Turn 모드에서는 System Prompt 가 필요합니다.` | warningRule + handler.validate |
| 단일 턴인데 `systemPrompt`·`userPrompt` 가 모두 없음 | `System Prompt 또는 User Prompt 중 하나는 입력해야 합니다.` | warningRule + handler.validate |
| `conditions.length > 20` | `Conditions 는 최대 20개까지 추가할 수 있습니다.` | warningRule(`ai_agent:too-many-conditions`) + handler.validate |
| `conditions[i].id` 가 없거나 string 이 아님 | `conditions[${i}]: id is required` | handler.validate |
| `conditions[i].id` 가 예약 포트(`out`·`in`·`error`·`user_ended`·`max_turns`. 이 집합은 규약과 다르다, [미결 사항](CLE-NODE-AGENT.md#미결-사항)) | `conditions[${i}]: id '<id>' conflicts with reserved port name` | handler.validate |
| `conditions[i].label` 이 없음 | `conditions[${i}]: label is required` | handler.validate |
| `conditions[i].prompt` 가 없음 | `conditions[${i}]: prompt is required` | handler.validate |
| `conditions[i].prompt` 가 2,000자 초과 | `conditions[${i}]: prompt must be 2000 characters or less` | handler.validate |
| 멀티턴인데 `maxTurns < 0` 이거나 숫자가 아님 | `maxTurns must be 0 (unlimited) or a positive integer` | handler.validate |

프런트엔드 캔버스 경고는 `getConfigSummary`(`node-config-summary.ts`)가 백엔드 `warningRules` 를 평가해 만든다. `*:no-llm-provider` 는 `hasDefaultLlmConfig` 문맥 값에 달려 있어, 워크스페이스 기본 LLM 이 있으면 캔버스 배지에서만 뺀다. 백엔드는 이 문맥을 모르므로 두 필드가 모두 없으면 늘 발화한다.

## Rationale

### LLM 호출 앱 레벨 타임아웃을 둔 근거

도구 정의 크기 예산은 팽창에 의한 멈춤의 근본 원인을 막지만, 네트워크 지연이나 모델 stall 같은 다른 이유의 무기한 멈춤에는 앱 레벨 상한이 없었다. 이를 심층 방어로 보완한다. 기본값 10분은 정상적인 긴 생성(큰 출력, extended thinking)을 해치지 않으면서 무기한 멈춤만 끊는 값이다. 다만 SDK 에 약 120초 요청 타임아웃을 준 프로바이더(OpenAI 계열·Anthropic)에서는 SDK 쪽이 먼저 끊는다. 그래서 이 설명은 SDK 타임아웃이 없는 Google 과, SDK 재전송으로 늘어나는 누적 시간에만 맞는다(2026-10-23 정정, [AI 노드 공통](CLE-NODE-AI-COMMON.md) 의 Rationale). OpenAI·Anthropic SDK 라이브러리 기본 요청 타임아웃도 10분이다(이 앱은 SDK 클라이언트에 120초를 준다, NF-AI-01). AI 에이전트에만 둔 이유는 재개 다단계 도구 반복 때문에 멈춤 노출면이 가장 넓어서다. 2026-11-14 부터는 `timeoutMs` 를 넘기지 않는 다른 `chat` 호출에도 `LlmService.chat` 기본값 10분이 걸린다([AI 노드 공통 Rationale](CLE-NODE-AI-COMMON.md#앱-타임아웃이-없던-호출의-상한을-정한다-2026-11-14)).

2026-10-10 에 NF-AI-01 의 공통 120초 기준을 거두고 호출 경로별 현행 값을 적기로 했다. 이 노드의 10분 기본값은 그대로 둔다. 120초로 낮추면 Google 에서 긴 생성이 끊긴다. 다른 프로바이더에서는 SDK 타임아웃이 먼저 걸려 차이가 작다. 결정과 기각한 대안은 [AI 노드 공통](CLE-NODE-AI-COMMON.md) 의 Rationale 에 있다.

### 단일 턴 LLM 호출 실패를 `error` 포트로 보낸 이유 (2026-11-01)

이전에는 단일 턴의 일반 LLM `chat` 실패를 받지 않아 노드가 throw 로 끝났다. 엔진은 이를 분류 없는 `FAILED` 로 기록했다. 이제 `AiTurnExecutor.executeSingleTurn` 이 첫 호출과 도구 루프 호출의 실패를 받아 `error` 포트 출력으로 돌려준다(NERV Task `CLE-T-ZHBMAC`).

- **요구사항과 규약에 맞춘다.** 단일 턴도 요구사항대로 LLM 에러·타임아웃·rate limit 을 `error` 포트로 보내야 한다. [노드 출력 규약 3.1](../CLE-NODE/CLE-NODE-OUTPUT.md#31-분류) 도 외부 API 실패 같은 런타임 에러를 `port: 'error'` 와 `output.error` 로 내라고 정한다. 멀티턴은 이미 이 규칙을 따랐고 단일 턴만 어긋나 있었다.
- **분류를 의존이 없는 순수 모듈로 옮긴다.** 분류는 `NodeHandlerRegistry` 를 import 하는 엔진 서비스 `AiTurnOrchestrator` 의 정적 메서드에 있어, 단일 턴 경로(`ai-turn-executor.ts`)가 이를 import 하면 순환 import 가 생긴다. 그래서 분류 함수를 순수 모듈 `nodes/ai/shared/llm-error-payload.ts` 로 옮겨 두 경로가 함께 쓴다. 분류 규칙은 바꾸지 않았으므로 같은 실패는 두 모드에서 같은 `code` 와 `retryable` 로 나온다.
- **분류 함수를 `AiTurnOrchestrator` 에 두고 지연 참조(`forwardRef`)로 순환 import 를 푸는 안은 기각했다.** 지연 참조를 써도 순환 의존은 그대로 남는다. 분류 규칙은 상태가 없는 함수라 공용 모듈로 옮겼다.
- **단일 턴 전용 분류 함수를 따로 두는 안은 기각했다.** 단일 턴의 분류 규칙이 멀티턴과 갈라질 수 있다. 두 모드는 같은 요구사항을 따르고 [에러 코드](#에러-코드) 절도 두 모드가 같은 분류를 쓴다고 정한다.
- **롤링 요약 호출은 이번 범위에서 뺐다.** 이 호출을 같은 catch 에 넣으려면 설정 에코 조립과 호출 순서를 바꿔야 한다. 그래서 범위를 턴 응답을 만드는 LLM `chat` 두 곳으로 묶었다. 남은 범위는 NERV Task `CLE-T-Q38K9F` 가 마쳤다([2026-11-05 결정](#단일-턴-롤링-요약-실패도-error-포트로-보낸-이유-2026-11-05)).
- **노드 취소는 `error` 포트로 보내지 않는다.** [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) 규칙대로 AbortError 를 던져 노드를 `cancelled` 로 끝낸다. 취소를 `error` 포트로 보내면 노드가 `failed` 로 기록되고 `error` 연결선의 다음 노드가 실행된다([노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md#2-에러-포트로-라우팅)).
- **부분 결과를 `meta` 에 남긴다.** 실패 전에 성공한 LLM 호출의 토큰, 실행한 도구 호출 수, `turnDebug` 를 싣는다. 실패 전 호출에도 비용이 들었으므로 이를 버리면 비용 추적과 디버깅 단서를 잃는다. 정상 완료 출력의 토큰 기준은 2026-11-12 에 성공한 호출의 합으로 맞췄다([AI 노드 공통](CLE-NODE-AI-COMMON.md#rationale) Rationale 의 2026-11-12 항목).
- **사용자 발화는 남기고 응답 턴은 만들지 않는다.** `ai_user` 턴은 LLM 호출 전에 넣으므로 실패해도 남는다. 응답이 없으므로 마지막 assistant 턴은 넣지 않고 메모리 추출도 예약하지 않는다. 노드 취소는 이 결정의 범위가 아니다. 취소된 단일 턴에 `ai_user` 항목이 남는 것은 현재 구현의 동작이다. 취소된 노드가 대화 스레드에 결과를 쌓지 않는 [정보 추출기 노드](CLE-NODE-EXTRACTOR.md#노드-취소는-error-포트로-보내지-않는다-2026-10-31)의 결정과 맞출지는 [대화 스레드 §미결 사항](../CLE-IX/CLE-IX-THREAD.md#미결-사항) 에서 정한다.
- **동작이 바뀐다.** 전에는 throw 라서 노드 에러 처리 정책(재시도 등)이 걸렸다. 이제는 `error` 포트 출력이라 정책이 걸리지 않는다([노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md#1-에러-처리-정책-다섯-가지)). `error` 연결선이 있으면 그쪽으로 가고 없으면 `ERROR_PORT_FALLBACK` 으로 멈춘다. 근거는 [노드 에러 처리 정책 Rationale](../CLE-NODE/CLE-NODE-ERROR.md#error-포트로-돌려준-실패에-정책을-걸지-않는다-2026-11-01) 에 있다.

### 단일 턴 롤링 요약 실패도 `error` 포트로 보낸 이유 (2026-11-05)

이전에는 단일 턴의 자동 메모리 주입이 실패하면 노드가 throw 로 끝났다. 롤링 요약 `chat` 실패와 요약 모델 설정(`summaryModelConfigId`) 조회 실패가 그랬다. 이제 `AiTurnExecutor.executeSingleTurn` 이 이 실패를 받아 LLM 호출 실패와 같은 `error` 포트 출력으로 돌려준다(NERV Task `CLE-T-Q38K9F`).

- **멀티턴 재개와 맞춘다.** 멀티턴 재개는 요약 실패를 엔진의 턴 에러 처리(`handleAiTurnError`)로 받아 이미 `error` 포트로 보냈다. 단일 턴만 throw 라서 같은 실패가 모드에 따라 다르게 끝났다. 분류도 같은 함수(`extractAiTurnErrorPayload`)를 쓴다. 요약 호출의 provider 에러는 [에러 코드](#에러-코드) 의 HTTP status 기준으로 나뉜다. 요약 모델 설정을 찾지 못한 에러는 429·5xx·네트워크 신호가 없어 재시도 불가 `LLM_CALL_FAILED` 로 나온다.
- **요약을 건너뛰고 턴을 이어 가는 안은 기각했다.** 회수·중복 탐색 같은 메모리 보조 호출은 실패해도 턴을 이어 간다([에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md)). 요약도 그렇게 하면 노드가 덜 실패한다. 하지만 요약 없이 이어 가려면 예산을 넘은 원문 이력을 그대로 넣거나 잘라 넣어야 한다. 그대로 넣으면 메모리 토큰 예산(`memoryTokenBudget`)을 지키지 못한다. 잘라 넣으면 사용자 모르게 맥락을 잃는다. 멀티턴 재개도 요약 실패를 턴 실패로 다룬다. 그래서 두 모드를 맞추는 쪽을 골랐다.
- **동작이 바뀐다.** 이제는 `error` 포트 출력이라 노드 에러 처리 정책이 걸리지 않는다. 그때는 요약 호출에 앱 타임아웃이 없어서 응답이 오지 않는 호출은 이 처리로도 끝나지 않았다. 2026-11-14 에 요약 호출도 턴 응답 호출과 같은 앱 타임아웃을 받게 했다([AI 노드 공통 Rationale](CLE-NODE-AI-COMMON.md#앱-타임아웃이-없던-호출의-상한을-정한다-2026-11-14), NERV Task `CLE-T-0R5SYN`).
- **노드 취소는 `error` 포트로 보내지 않는다.** 노드 signal 이 abort 된 뒤에 요약이 실패하면 AbortError 를 던져 노드를 `cancelled` 로 끝낸다(`rethrowIfNodeCancelled`). 그때는 요약 호출에 signal 을 넘기지 않아 취소한 뒤에도 요약 요청이 응답이 올 때까지 남았다. 2026-11-14 부터는 단일 턴의 요약 호출에도 노드 취소 신호(`context.abortSignal`)를 넘겨 요청을 바로 끊는다(NERV Task `CLE-T-0R5SYN`). 멀티턴 재개에는 신호 소스가 없어서 재개 턴의 요약 요청은 그 턴의 다른 `chat` 호출처럼 앱 타임아웃이나 응답이 올 때까지 남는다. 그 턴의 취소는 턴 경계의 취소 관측이 처리한다.
- **호출 순서를 바꿨다.** 2026-11-01 에 이 범위를 뺀 이유가 설정 에코 조립과 호출 순서였다. 메모리 주입을 설정 에코 조립 뒤로 옮기고 주입만 감싸는 catch 를 두었다. 도구 목록 구성(`buildTools`)과 턴 응답 LLM 호출 경로는 바꾸지 않았다. `ai_user` 턴은 메모리 주입 전에 넣으므로 실패해도 남는다. 응답 턴과 메모리 추출은 만들지 않는다. 2026-11-01 결정과 같다.
- **`meta` 토큰은 0 이다.** `meta` 토큰은 턴 응답 LLM 호출만 센다. 요약 호출의 사용량은 정상 완료에서도 `meta` 토큰에 넣지 않는다.
- **노드 LLM 설정 조회 실패는 이번 범위에서 뺐다.** 단일 턴에서 노드 LLM 설정(`llmConfigId`)을 조회하지 못하면 아직 throw 로 끝난다. 이 조회는 실행 맨 앞에 있다. `error` 출력의 `meta.model` 과 설정 에코가 그 결과(모델 이름)를 쓴다. catch 를 넓히려면 모델을 모르는 `error` 출력의 모양부터 정해야 한다. 남은 범위는 NERV Task `CLE-T-T8FVCG` 가 맡는다.

### 단일 턴 `error` 포트 서술을 이웃 문서와 나눈다 (2026-11-05)

단일 턴 `error` 포트 동작을 이웃 문서에 맞추면서 같은 규칙을 여러 문서가 따로 적던 곳을 한 곳으로 모았다(NERV Task `CLE-T-KPDDKB`).

- **토큰 기준은 [AI 노드 공통 §토큰 회계](CLE-NODE-AI-COMMON.md#토큰-회계) 에 둔다.** 이 문서와 [AI 에이전트 노드 출력과 디버그](CLE-NODE-AGENT-OUTPUT.md) 는 링크와 한 줄 요약만 둔다. 세 문서가 따로 적으면 기준을 바꿀 때 한 곳이 낡는다.
- **롤링 요약 · 요약 모델 설정 조회 실패의 처리는 이 문서가 정한다.** [AI 노드 공통](CLE-NODE-AI-COMMON.md#llm-호출-경로별-타임아웃) 의 타임아웃 표는 결과만 한 줄로 적고 이 문서를 링크한다.
- **이웃 문서를 맞췄으므로 미결 항목을 지웠다.** [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) · [용어 사전 — 노드](../CLE-GLOSSARY-NODE.md) · [노드 포트와 설정 패널](../CLE-WF/CLE-WF-NODEPANEL.md) · [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) · [에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md) 이 단일 턴의 재시도 버튼 없음, 정책 미적용, `ended` 종료를 적는다.
