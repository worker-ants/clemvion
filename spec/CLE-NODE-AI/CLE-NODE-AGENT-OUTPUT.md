---
id: "CLE-NODE-AGENT-OUTPUT"
title: "AI 에이전트 노드 출력과 디버그"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-AI"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-AI"]
area: "CLE-NODE-AI"
content_hash: "26d04b61f2205f9ce8dc3bfa1f558da0c83c3f1c922a0d06aa226a95c83c84ed"
read_as: "approved_fallback"
task: "CLE-T-RGZBCQ"
source_paths: ["spec/4-nodes/3-ai/1-ai-agent.md"]
mirror_sha256: "757be3207480ace8f65a580552d502244734af5bd5596789aa8c54fedeb53105"
etag: "sha256-3125d44ce6e6dea096734d9ba20dcba1c2dbaf838f8e2f4995a242ad1b2da7a3"
---
> 구현 상태: 부분 구현 · 원문: `spec/4-nodes/3-ai/1-ai-agent.md` (§7 출력 구조, §8 디버그 데이터) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 [AI 에이전트 노드](CLE-NODE-AGENT.md) 의 출력 구조를 케이스별로 정한다. 단일 턴·멀티턴 종결 출력, 멀티턴 입력 대기·재개 스냅샷, 표시 도구 페이로드 운반, LLM 호출 기록(`meta.turnDebug`)이 여기에 속한다.

노드 동작(도구·조건·실행 단계)은 [AI 에이전트 노드](CLE-NODE-AGENT.md) 가 정한다. 세 AI 노드가 함께 쓰는 출력 묶음(`output.result`·`output.error`·`output.interaction`)과 토큰 회계는 [AI 노드 공통](CLE-NODE-AI-COMMON.md), 노드 출력 5필드의 일반 규칙은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md), 입력 대기·재개·마지막 턴 재시도의 상태 전이는 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 가 정한다.

## 출력 케이스

출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 Principle 0~11 형식을 따른다. JSON 예시는 `undefined` 필드를 뺀다. 최상위 키는 5필드(`config`·`output`·`meta?`·`port?`·`status?`)만 쓴다. 예외로 `_resumeState`·`_resumeCheckpoint`·`_retryState` 는 멀티턴의 내부 전달·재개 필드라 최상위에 두지만 표현식 resolver 에는 노출하지 않는다(Principle 4.2, 4.2.1).

출력은 종결 6케이스와 멀티턴의 일시 재개 1케이스, 모두 7케이스다. 도메인 결과는 `output.result.*`, 에러는 `output.error.{code, message, details?}`, 사용자 입력 기록은 `output.interaction.{type, data, receivedAt}` 에 둔다.

| 절 | 모드 | 종결 사유 | port | status |
|---|---|---|---|---|
| 단일 턴 정상 완료 | 단일 턴 | 정상 완료 | `out` | `ended` |
| 단일 턴 조건 매칭 | 단일 턴 | 조건 매칭 | `{condition.id}` | `ended` |
| 단일 턴 에러 | 단일 턴 | 오류 | `error` | `ended` |
| 멀티턴 입력 대기 | 멀티턴 | 사용자 입력 대기 | 없음 | `waiting_for_input` |
| 멀티턴 재개 | 멀티턴 | 사용자 메시지 수신(일시) | 없음 | `resumed` |
| 멀티턴 조건 매칭 | 멀티턴 | 조건 매칭 | `{condition.id}` | `ended` |
| 멀티턴 사용자 종료 | 멀티턴 | 사용자 종료 | `user_ended` | `ended` |
| 멀티턴 최대 턴 도달 | 멀티턴 | 최대 턴 도달 | `max_turns` | `ended` |
| 멀티턴 에러 | 멀티턴 | 오류 | `error` | `ended` |
| 표시물 페이로드 운반 | 둘 다 | 표시 도구 페이로드(공통) | 없음 | 없음 |

## 종료 사유 값

종료 사유(`endReason`) 값 목록의 단일 기준은 패키지 [`@workflow/ai-end-reason`](../CLE-IX/CLE-IX-TYPES.md) 의 `AiAgentEndReason` 이다. 이 문서는 각 값의 뜻과 포트 매핑을 정하고, 값 목록 자체는 패키지가 정한다. 정보 추출기와 값 목록이 다른 것은 의도다(정보 추출기에는 `condition` 이 없다). 자세한 규칙은 [인터랙션 타입 레지스트리](../CLE-IX/CLE-IX-TYPES.md) 에 있다.

패키지 값은 멀티턴 종결 4값(`user_ended`·`max_turns`·`condition`·`error`)이다. 단일 턴 정상 완료의 `endReason: "out"` 은 일부러 패키지 밖에 둔다. 백엔드가 유니온으로 선언한 적 없이 그 자리에서 추론할 뿐이고, 단일 턴 정상 완료에는 `result.messages` 가 없어 대화 판정 대상이 아니다(대화 UI 게이트가 `messages` 부재로 먼저 거른다). `'out'` 이 `AiAgentEndReason` 에 없는 것은 누락이 아니므로 더하지 않는다. 근거는 `plan/complete/is-conversation-output-restructure.md` 의 유니온 분기 결정이다.

## 설정 에코 정책

[노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 7 에 따라 모든 종결 시점(`out`·`{condition.id}`·`user_ended`·`max_turns`·`error`)과 멀티턴 입력 대기·재개 시점에 `output.config` 는 사용자가 입력한 원본 값(템플릿 `{{ ... }}` 보존)을 에코한다. 엔진이 dispatch 직전 평가한 값이 아니다.

- 멀티턴 후속 턴도 `state.rawConfig` 로 같은 원본을 에코한다. 고정 범위는 한 턴 처리다. 매 턴 재개(rehydration) 때 엔진이 현재 `node.config` 에서 새로 유도해 다시 고정한다(D3 fresh-per-turn). park 중 워크플로우를 고치면 다음 턴부터 반영된다([실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md)).
- 후속 노드의 `$node["X"].config.{mode, model, systemPrompt, userPrompt, maxTurns, maxToolCalls, knowledgeBases, conditions, responseFormat, includeSystemContext?, systemContextSections?, memoryStrategy?, memoryTokenBudget?, memoryKey?, memoryTopK?, memoryThreshold?, memoryTtlDays?, embeddingModelConfigId?, summaryModelConfigId?, extractionModelConfigId?}` 는 노드 수명 내내 원본 값을 본다.
- `includeSystemContext`·`systemContextSections` 와 메모리 필드(`memoryStrategy`·`memoryTokenBudget`·`memoryKey`·`memoryTopK`·`memoryThreshold`·`memoryTtlDays`·`embeddingModelConfigId`·`summaryModelConfigId`·`extractionModelConfigId`)는 기본값이나 미설정과 같으면 에코에서 뺀다. 사용자가 명시적으로 바꾼 경우에만 나온다([AI 노드 공통](CLE-NODE-AI-COMMON.md) 과 같은 패턴).
- 멀티턴 종결·조건 출력의 `config.model` 도 `rawConfig.model` 이 템플릿이면 그대로 에코한다. 평가한 모델 ID 는 `meta.model` 에서 읽는다.
- 자격 증명(`llmConfigId` 가 가리키는 provider secret 등)은 에코를 조립할 때 애초에 넣지 않는다. 위 필드 목록이 곧 허용 목록이고 `llmConfigId` 는 거기 없다(`assembleSingleTurnConfigEcho`·`buildMultiTurnConfigEcho` 양쪽 실측 0건). 마스킹과는 무관하다.

## 단일 턴 정상 완료 (`out`)

```json
{
  "config": {
    "mode": "single_turn",
    "model": "{{ vars.model }}",
    "systemPrompt": "You are a helpful assistant...",
    "userPrompt": "{{ $input.message }}",
    "responseFormat": "text"
  },
  "output": {
    "result": {
      "response": "AI 의 텍스트 응답 또는 JSON 객체",
      "endReason": "out",
      "turnCount": 1
    }
  },
  "meta": {
    "durationMs": 1234,
    "model": "gpt-4o",
    "inputTokens": 1250,
    "outputTokens": 350,
    "totalTokens": 1600,
    "thinkingTokens": 0,
    "toolCalls": 2,
    "ragSources": [
      { "chunkId": "uuid", "documentId": "uuid", "documentName": "Refund Policy", "content": "관련 텍스트...", "score": 0.92, "origin": "seed" }
    ],
    "ragDiagnostics": {
      "attempted": true,
      "searchedKbCount": 1,
      "queriesUsed": ["refund window"],
      "resultCount": 1
    },
    "mcpDiagnostics": {
      "attempted": true,
      "serverCount": 1,
      "toolCalls": 1,
      "resourceReads": 0,
      "promptGets": 0,
      "serverSummaries": [
        { "integrationId": "uuid", "serviceType": "mcp", "status": "connected", "toolCount": 3 }
      ],
      "errors": []
    },
    "turnDebug": [
      {
        "turnIndex": 1,
        "llmCalls": [
          { "requestPayload": {}, "responsePayload": {}, "durationMs": 1234 }
        ],
        "totalDurationMs": 1234,
        "toolCalls": [
          { "toolCallId": "call_abc123", "name": "kb_workspace_main", "providerKey": "kb", "status": "success", "durationMs": 1240 }
        ],
        "ragSources": [],
        "ragDiagnostics": { "attempted": true, "searchedKbCount": 1, "queriesUsed": ["refund window"], "resultCount": 1 }
      }
    ]
  },
  "port": "out",
  "status": "ended"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | 사용자 입력 원본 | 설정 에코(Principle 7) | `mode`·`model`·`systemPrompt`·`userPrompt`·`responseFormat`·`conditions?`·`knowledgeBases?` 등. 표현식 `{{ }}` 보존 |
| `output.result.response` | string \| object | 핸들러 반환 | LLM 최종 응답. `responseFormat=json` 이면 파싱한 객체(파싱 실패 시 원문 문자열) |
| `output.result.endReason` | `"out"` | 핸들러 반환 | 단일 턴 정상 종료 사유 |
| `output.result.turnCount` | number | 핸들러 반환 | 단일 턴은 늘 `1` |
| `output.result.presentations[]` | `PresentationPayload[]?` | 핸들러 반환 | 표시 도구 호출이 있었을 때만 싣는다("표시물 페이로드 운반" 절) |
| `meta.durationMs` | number | 엔진 + 핸들러 | 노드 실행 소요 시간(ms) |
| `meta.model` | string | LLM provider 응답 | 실제로 부른 모델 ID(`config.model` 평가 결과) |
| `meta.inputTokens`·`outputTokens`·`totalTokens` | number | LLM provider 응답 | 토큰 회계([AI 노드 공통](CLE-NODE-AI-COMMON.md)) |
| `meta.thinkingTokens` | number? | LLM provider 응답 | 모델이 thinking 토큰을 보고할 때만 |
| `meta.toolCalls` | number | 핸들러 누적 | 도구 호출 횟수 합산. 조건 도구는 뺀다. 현재 구현은 프로바이더(지식 저장소·MCP·표시) 실행 수와 일반 도구 stub 수를 더한다 |
| `meta.ragSources` | Array | `RagAccumulator` | 지식 저장소 도구가 가져온 청크 누적(chunkId 중복 제거). graph 모드 지식 저장소는 `origin: 'seed' \| 'expanded'` 를 붙인다. 스키마는 [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md), [Graph RAG](../CLE-KB/CLE-KB-GRAPH.md) |
| `meta.ragDiagnostics` | object | `RagAccumulator` | 검색 진단(`attempted`·`searchedKbCount`·`queriesUsed`·`resultCount`·`skipReason?`·`rerank?`). `rerank?` 는 리랭킹이 켜진 지식 저장소 호출 때만 싣는다. 스키마는 [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) |
| `meta.mcpDiagnostics` | object? | `McpDiagnostics` | `mcpServers` 가 1개 이상이거나 LLM 이 MCP 도구를 한 번 이상 불렀을 때만 싣는다. 필드는 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) |
| `meta.turnDebug[]` | Array | 핸들러 반환 | 턴 단위 LLM 호출 기록. 단일 턴은 길이 1 이며 멀티턴 출력 스키마와 맞춘다 |
| `meta.contextInjection` | object? | 핸들러 반환 | `contextScope ≠ 'none'` 이고 스레드가 비어 있지 않을 때만 싣는다. `{ appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }`. 적용 결과이지 설정 에코가 아니다(Principle 2). 자세한 규칙은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) |
| `meta.memory` | object? | 핸들러 반환 | `memoryStrategy ≠ 'manual'` 일 때만 싣는다. `{ strategy, summarized, recalledCount, tokenBudgetUsed, compactedMessages? }`. `strategy` 는 적용 전략, `summarized` 는 이번 턴에 롤링 요약이 일어났는지(Boolean), `recalledCount` 는 에이전트 메모리 회수 수(`summary_buffer` 는 `0`), `tokenBudgetUsed` 는 working-memory 추정 사용량, `compactedMessages?` 는 멀티턴 누적 messages 물리 압축으로 지운 메시지 수(없으면 생략). 적용 결과이지 설정 에코가 아니다. 단일 기준은 [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md) |
| `meta.presentationSchemaViolations` | Array? | 핸들러 반환 | 표시 도구 호출이 스키마나 1MB 상한 위반으로 버려진 경우만 싣는다. 항목은 `{toolName, toolCallId, issues, attempts}`. 턴은 정상 종료한다 |
| `port` | `"out"` | 핸들러 반환 | 정상 종료 분기 |
| `status` | `"ended"` | 핸들러 반환 | 노드 실행 완료 |

표시 도구 호출이 성공한 턴에서는 해당 `ai_assistant` 대화 기록 항목의 최상위 `presentations[]` 에 페이로드가 쌓이고, WebSocket `execution.ai_message` 누적 스냅샷에도 같은 구조가 나온다. 이는 `output.result.response` 와 직교한다. 텍스트는 `response`, 표·차트·캐러셀·템플릿 페이로드는 스레드의 `turn.presentations[]` 가 단일 기준이다. 다운스트림 노드가 페이로드를 직접 쓰려면 `$thread.turns[*].presentations` 로 접근한다.

`meta.turnDebug[].toolCalls` 는 그 턴에 실행한 provider 도구(지식 저장소·MCP)별 기록 `{ toolCallId, name, providerKey, status: 'success' | 'error', durationMs, startedAt?, finishedAt?, error? }` 다. `startedAt?`·`finishedAt?` 는 도구 실행 시작·종료 절대 시각(ISO8601, 둘 다 선택)이다([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 과 맞춤). 타입 단일 기준은 `ai-agent/ai-turn-executor.ts` 의 `interface ToolCallTrace` 다. provider 가 예외를 던져도 핸들러가 받아 `'error'` 로 표시하고, LLM 에는 정리한 에러 내용을 그대로 넘기며 턴은 계속한다. 조건 도구와 일반 도구 stub 은 바로 결과를 만들어 여기에 넣지 않는다. WS `execution.tool_call_started`·`execution.tool_call_completed` 가 유실돼도 클라이언트는 이 데이터로 복구할 수 있다. 대화 인스펙터 도구 항목의 성공·에러 배지의 권위 출처다.

## 단일 턴 조건 매칭 (`{condition.id}`)

```json
{
  "config": {
    "mode": "single_turn",
    "model": "gpt-4o",
    "systemPrompt": "You are a customer support assistant...",
    "responseFormat": "text",
    "conditions": [
      { "id": "refund_request", "label": "Refund Request", "prompt": "고객이 환불을 요청하거나 결제 취소를 원할 때" }
    ]
  },
  "output": {
    "result": {
      "response": "환불 요청을 확인했습니다",
      "endReason": "condition",
      "turnCount": 1,
      "messages": [
        { "role": "user", "content": "환불해주세요" },
        { "role": "assistant", "content": "환불 요청을 확인했습니다" }
      ],
      "condition": {
        "id": "refund_request",
        "label": "Refund Request",
        "reason": "사용자가 환불을 명시적으로 요청함"
      }
    }
  },
  "meta": {
    "durationMs": 2345,
    "model": "gpt-4o",
    "inputTokens": 200,
    "outputTokens": 80,
    "totalTokens": 280,
    "thinkingTokens": 0,
    "toolCalls": 0,
    "ragSources": [],
    "turnDebug": [ { "turnIndex": 1, "llmCalls": [], "totalDurationMs": 2345 } ]
  },
  "port": "refund_request",
  "status": "ended"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.conditions` | ConditionDef[] | 설정 에코 | 사용자가 정의한 원본 조건(id·label·prompt) |
| `output.result.response` | string | 핸들러 반환 | 조건 도구 호출 직전 마지막 assistant 메시지 |
| `output.result.endReason` | `"condition"` | 핸들러 반환 | 조건 매칭으로 끝났음 |
| `output.result.turnCount` | number | 핸들러 반환 | 단일 턴은 `1`. 멀티턴 조건 매칭은 누적 턴 수 |
| `output.result.messages` | ChatMessage[] | 핸들러 반환 | system 을 뺀 user·assistant·tool 메시지 누적 |
| `output.result.condition.id` | string | 핸들러 반환 | 매칭된 조건 ID(= `port`) |
| `output.result.condition.label` | string | 핸들러 반환 | 매칭된 조건 라벨 |
| `output.result.condition.reason` | string | 핸들러 반환(`extractConditionReason`) | LLM 이 조건 도구 `reason` 인자로 보낸 이유. 500자로 자른다 |
| `meta.*` | | 단일 턴 정상 완료와 같음 | |
| `port` | `condition.id` | 핸들러 반환 | 매칭된 조건의 동적 포트(UUID) |
| `status` | `"ended"` | 핸들러 반환 | |

## 단일 턴 에러 (`error`)

타임아웃, rate limit, LLM API 오류 등 모든 오류에 쓴다.

> 구현 현황: 이 출력 형태는 목표 계약이다. 현재 `executeSingleTurn` 의 일반 `llmService.chat` 호출(첫 호출과 도구 반복)은 try/catch 로 감싸지 않아, 단일 턴 LLM 호출 실패(타임아웃·rate limit·API 오류)는 이 포트로 가지 않고 엔진 레벨의 분류 없는 `FAILED` 로 끝난다(부분 구현). 예외로 도구 정의 크기 예산 초과(`ToolDefinitionPayloadExceededError`)만 `buildSingleTurnToolsOrError` 의 사전 점검 try/catch 가 받아 이 형태로 돌려준다. 일반 `chat` 실패 감싸기는 후속이며 `plan/in-progress/node-output-redesign/ai-agent.md` 가 추적한다. 멀티턴 에러 종결은 엔진 `handleAiTurnError` 공통 경로로 이미 구현돼 있다.

```json
{
  "config": { "mode": "single_turn", "model": "gpt-4o", "systemPrompt": "..." },
  "output": {
    "error": {
      "code": "LLM_CALL_FAILED",
      "message": "OpenAI API returned 503 after 3 retries",
      "details": { "retryable": true, "retryAfterSec": 30, "provider": "openai", "statusCode": 503, "attempt": 3 }
    }
  },
  "meta": {
    "durationMs": 15230,
    "model": "gpt-4o",
    "turnDebug": [ { "turnIndex": 1, "llmCalls": [], "totalDurationMs": 15230 } ]
  },
  "port": "error",
  "status": "ended"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `output.error.code` | string (UPPER_SNAKE_CASE) | 에러 분류. 코드 표는 [AI 에이전트 노드](CLE-NODE-AGENT.md) 의 에러 코드 절 |
| `output.error.message` | string | 사람이 읽는 메시지(로그·디버깅용 원문, 국제화 없음) |
| `output.error.details` | object? | 노드별 추가 맥락(provider·statusCode·attempt 등). 아래 두 키 포함 |
| `output.error.details.retryable` | boolean | 필수. 일시적 오류인지. `true` 는 HTTP 429·5xx·타임아웃 같은 일시 오류(예: 503), `false` 는 인증 실패·스키마 치명 오류·사용자 취소 |
| `output.error.details.retryAfterSec` | number? | 재시도 권장 대기 초(있을 때). 멀티턴 에러와 같은 형식 |
| `status` | `"ended"` | 에러 종결 상태 |
| `port` | `"error"` | |

## 멀티턴 입력 대기 (`status: "waiting_for_input"`)

첫 진입 직후, 그리고 매 턴이 종료 조건 없이 끝난 뒤에 낸다. `output` 은 런타임 누적 대화 상태만 싣고 리터럴 설정은 에코하지 않는다(Principle 1.1).

```json
{
  "config": {
    "mode": "multi_turn",
    "model": "{{ vars.model }}",
    "systemPrompt": "You are a customer support assistant...",
    "maxTurns": 20,
    "maxToolCalls": 10,
    "knowledgeBases": ["kb-1"],
    "conditions": [
      { "id": "refund_request", "label": "Refund Request", "prompt": "..." }
    ]
  },
  "output": {
    "result": {
      "messages": [
        { "role": "user", "content": "안녕하세요" },
        { "role": "assistant", "content": "안녕하세요, 무엇을 도와드릴까요?" }
      ],
      "message": "안녕하세요, 무엇을 도와드릴까요?",
      "turnCount": 1
    }
  },
  "meta": {
    "durationMs": 1500,
    "model": "gpt-4o",
    "inputTokens": 100,
    "outputTokens": 30,
    "totalTokens": 130,
    "toolCalls": 0,
    "interactionType": "ai_conversation",
    "turnDebug": [ { "turnIndex": 1, "llmCalls": [], "totalDurationMs": 1500 } ]
  },
  "status": "waiting_for_input",
  "_resumeState": {
    "llmConfigId": "cfg-1",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 4096,
    "knowledgeBases": ["kb-1"],
    "ragThreshold": 0.7,
    "maxToolCalls": 10,
    "maxTurns": 20,
    "mcpServers": [],
    "conditions": [],
    "messages": [],
    "turnCount": 1,
    "totalInputTokens": 100,
    "totalOutputTokens": 30,
    "totalThinkingTokens": 0,
    "toolCalls": 0,
    "ragSources": [],
    "ragLastDiagnostics": { "attempted": false, "searchedKbCount": 0, "queriesUsed": [], "resultCount": 0 },
    "lastTurnDurationMs": 1500,
    "turnDebugHistory": []
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | 원본 에코 | Principle 7 | 첫 턴은 `context.rawConfig`, 후속 턴은 `state.rawConfig`. 고정 범위는 한 턴 |
| `output.result.messages` | ChatMessage[] | 런타임 누적 | 첫 턴은 빈 배열(LLM 호출 전). 후속 턴부터 system 을 뺀 user·assistant·tool 누적 |
| `output.result.message` | string | 핸들러 반환 | 현재 턴 assistant 응답. 첫 진입 때는 `""` |
| `output.result.turnCount` | number | 핸들러 반환 | 누적 턴 수(첫 진입 때 `0`). 진행률 분모 `maxTurns` 는 `config.maxTurns` 에서 읽고 출력에는 싣지 않는다(Principle 1.1) |
| `meta.interactionType` | `"ai_conversation"` | 핸들러 반환 | 실행 결과 화면의 대화 미리보기 탭 식별자. 노드 판별자(Principle 1.1.4)가 아니라 대기 표면 라벨이다. 탭 렌더 규칙은 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 가 정하며 1차 소스는 내보낸 messages 가 아니라 대화 스레드 스냅샷이다 |
| `meta.durationMs`·토큰·`turnDebug` | | 단일 턴과 같은 위치 | 진행 중 누적치를 실어 참조·LLM 사용량 탭이 동작한다. `turnDebug[].ragSources` 는 대화 미리보기의 보조 관찰성 레인(🔎 `rag` 행, 📚 칩)도 쓴다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md), [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md)). `rag` 행이 엔진 자동 검색인지 도구 호출 결과인지는 정의가 갈린다([RAG 검색 미결 사항](../CLE-KB/CLE-KB-SEARCH.md#미결-사항)). `llmCalls` 는 디버그 탭 전용이다 |
| `status` | `"waiting_for_input"` | 핸들러 반환 | 엔진이 실행을 멈춘다 |
| `_resumeState` | object(최상위) | 핸들러 반환 | 다음 턴 처리용 내부 상태. 표현식 resolver 에 노출하지 않는다(Principle 4.2). DB 저장 때 지운다. 매 턴 재개를 위해 엔진이 자격 증명을 뺀 부분집합을 `_resumeCheckpoint` 로 `outputData` 에 영속한다 |
| `_resumeState.ragSources` | Array | `RagAccumulator`(상한) | 최근 `MAX_RESUME_RAG_SOURCES = 200` 건만 둔다. 긴 대화에서 `outputData` JSONB 비대화를 막는다. 잘린 청크는 이후 중복 제거에서 빠진다(의도한 절충) |
| `_resumeState.turnDebugHistory` | Array | 핸들러 반환 | 최근 `MAX_TURN_DEBUG_HISTORY = 50` 턴만 둔다 |
| `_resumeState.pendingFormToolCall` | object? | 핸들러 반환 | `render_form` 이 불려 폼 제출을 기다릴 때만 있다. 형태는 `{ toolCallId: string, formConfig: object }`. 다음 `execution.submit_form` 을 `toolCallId` 로 대조해 맞으면 tool_result 를 채워 LLM 을 다시 부르고 이 필드를 지운다. `interactionType: 'ai_form_render'` 진입과 이 필드 존재는 1:1 불변식이다. 엔진의 입력 대기 이벤트는 이 객체를 그대로 `conversationConfig.pendingFormToolCall` 로 싣는다([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)). 내부 형태와 wire 형태가 같다 |

`_resumeState` 는 `output` 밖 최상위 필드다. 자격 증명 누락과 누적 비대화 우려로 표현식 자동완성에 노출하지 않는다.

**세 내부 필드의 수명 주기** (모두 최상위 내부 필드, Principle 0 예외. 단일 기준은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 과 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md))

| 필드 | 수명 주기 | 영속 | 소비 |
| --- | --- | --- | --- |
| `_resumeState` | 한 턴 처리 구간 안에서만 있다. park 는 늘 코루틴·컨텍스트를 풀므로 턴 사이에 메모리에 남지 않는다. DB 영속 때 `stripControlFields()` 가 전체 상태를 무조건 지운다(자격 증명·rawConfig·턴 디버그를 담을 수 있음) | 비영속 | 다음 턴 재개 때 rehydration 이 `_resumeCheckpoint` 에서 다시 만든다. 턴 처리 뒤 새 `_resumeCheckpoint` 로 갱신한다 |
| `_resumeCheckpoint` (AI 에이전트·정보 추출기, 정보 추출기는 `partialResult`·`collectionRetryCount` 추가) | 입력 대기 진입과 매 턴 영속 시점에 엔진이 `_resumeState` 의 자격 증명을 뺀 부분집합을 싣는다. `stripControlFields()` 가 보존한다. `_retryState` 와 같은 배제 정책이지만 TTL(`expiresAt`)이 없고(대화는 오래 뒤에도 재개 가능) `lastUserMessage` 가 없다(재개 때 도착한 메시지를 그대로 처리) | `NodeExecution.outputData._resumeCheckpoint` | 매 턴 재개 때 엔진이 읽는다. 같은 인스턴스·재시작·다른 인스턴스 모두 rehydration 한 경로다. `schemaVersion` 검사 → 맥락 결합 필드 재유도(조작 필드는 `node.config` 재평가, 식별 필드 `workflowId`·`nodeExecutionId`·`workspaceId` 는 호출 측 컨텍스트) → `_resumeState` 재구성(핵심 필드가 없으면 기본값 보강) → 멀티턴 반복 재진입. 없거나 손상되거나 미래 버전이면 우아하게 초기화한다(`RESUME_INCOMPATIBLE_STATE`) |
| `_retryState` | 재시도 가능 에러로 끝날 때 `buildMultiTurnFinalOutput` 이 싣는다. `stripControlFields()` 가 보존한다 | `NodeExecution.outputData._retryState` | WS `execution.retry_last_turn` 이 `nodeExecutionId` 로 찾아 `expiresAt` 을 확인하고 새 NodeExecution 행을 만들어 멀티턴 반복에 다시 들어간다. TTL 이 지나거나 한 번 쓰면 `RETRY_STATE_NOT_FOUND` 로 응답한다 |

세 필드 모두 자격 증명과 맥락 결합 필드(`llmConfigId` 가 가리키는 provider secret, `workspaceId` 등)를 싣지 않는다. `buildRetryState`·`buildResumeState` 가 옮길 키를 열거하는 허용 목록 방식으로 애초에 뺀다. 재개할 때는 두 경로로 다시 유도한다. 조작 필드(`llmConfigId`·`maxTurns` 등)는 `node.config` 재평가로, 식별 필드(`workflowId`·`nodeExecutionId`·`workspaceId`)는 호출 측 컨텍스트에서 가져온다. 두 경로의 상세와 사용량 귀속 불변식은 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 에 있다. `_resumeCheckpoint` 와 `_retryState` 는 재구성 로직(`buildRetryReentryState`)을 함께 쓰고, 계기(재시작 재개 대 재시도 명령)와 수명(상시 대 에러 1회)만 다르다.

## 멀티턴 재개 (`status: "resumed"`, 일시)

사용자 메시지를 받은 직후, 다음 턴 LLM 호출 전에 한 번 낸다. 이 스냅샷은 일시적이다. 엔진은 곧바로 다음 턴을 처리해 `waiting_for_input` 이나 `ended` 로 수렴한다. `resumed` 시점에는 연결선 라우팅이 없고, 이 스냅샷은 실행 내역·타임라인 관찰에만 기록한다.

> 구현 현황: 구조화한 `resumed` 스냅샷은 목표 관찰 계약이며 AI 대화 경로에서는 아직 내지 않는다(미구현). 현재 엔진의 AI 대화 턴 경로(`ai-turn-orchestrator.service.ts` 의 `processAiResumeTurn` → `handleAiMessageTurn`)는 `message_received` interaction 과 `status:'resumed'` 스냅샷을 `setStructuredOutput` 으로 내지 않는다. `resumed` 스냅샷은 form·buttons 경로에만 있다. 대신 아래 라이브 조기 노출은 구현돼 있어 진행 신호는 유지된다. 구현하거나 이 절을 폐기할지는 `plan/in-progress/node-output-redesign/ai-agent.md` 가 추적한다. [정보 추출기 노드](CLE-NODE-EXTRACTOR.md) 도 같은 상태이며 함께 처리하기를 권한다.

**라이브 조기 노출(`execution.user_message`)**: 위 관찰 기록과 별개로, 엔진은 같은 수신 시점(다음 턴 LLM 호출 전)에 WS 이벤트 `execution.user_message` 를 한 번 보내 사용자 발화를 라이브 대화 화면에 바로 보여 준다([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)).

- 이 이벤트의 `nodeExecutionId` 는 그 시점에 `waiting_for_input` 이던 NodeExecution 행의 PK 다. 엔진의 `execution_id + node_id + status='waiting_for_input'` 단일 매칭과 같은 행이다.
- `receivedAt` 은 `output.interaction.receivedAt` 과 같은 수신 시점이다. 엔진과 핸들러가 각각 만들어 ms 차이가 날 수 있지만 중복 제거·재조정은 정확한 일치에 기대지 않는다.
- 권위 출처는 여전히 턴 종료 `execution.ai_message.messages` 스냅샷이다. `user_message` 는 라이브 전용 비권위 진행 신호이며 영속 대상이 아니다. `output.result.messages` 의 턴 경계 영속 정책은 바뀌지 않는다.
- 이 이벤트는 엔진의 멀티턴 메시지 턴 공통 경로에서 나가므로 노드 타입과 무관하다. 정보 추출기 등 다른 `ai_conversation` 재개 노드에도 똑같이 적용된다.

```json
{
  "config": { "mode": "multi_turn", "model": "gpt-4o", "maxTurns": 20 },
  "output": {
    "result": {
      "messages": [
        { "role": "user", "content": "환불 문의입니다" }
      ]
    },
    "interaction": {
      "type": "message_received",
      "data": { "content": "환불 문의입니다", "role": "user" },
      "receivedAt": "2026-05-10T06:42:01.123Z"
    }
  },
  "meta": { "durationMs": 0, "interactionType": "ai_conversation", "turnDebug": [] },
  "status": "resumed",
  "_resumeState": { "...": "(입력 대기와 같은 구조)" }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `output.result.messages` | ChatMessage[] | 사용자 메시지를 더한 직후의 누적 대화(모델 응답은 아직 없음) |
| `output.interaction.type` | `"message_received"` | 사용자 입력 기록 종류(Principle 4.5) |
| `output.interaction.data.content` | string | 사용자가 입력한 메시지 |
| `output.interaction.data.role` | `"user"` | 고정값 |
| `output.interaction.receivedAt` | ISO8601 string | 수신 시각 |
| `status` | `"resumed"` | 1회성 일시 표지 |

`maxTurns` 는 정적 설정 값이라 출력에 에코하지 않고 `config.maxTurns` 로만 노출한다(Principle 1.1). 사용자 입력 기록은 뜻을 나눠 `output.interaction.*` 에 둔다.

## 멀티턴 조건 매칭 (`{condition.id}`)

LLM 이 조건 도구를 불렀을 때다. 형태는 단일 턴 조건 매칭과 같은 `output.result.*` 에 멀티턴 누적 메타를 더한 것이다.

```json
{
  "config": {
    "mode": "multi_turn",
    "model": "gpt-4o",
    "systemPrompt": "...",
    "maxTurns": 20,
    "maxToolCalls": 10,
    "conditions": [
      { "id": "refund_request", "label": "Refund Request", "prompt": "..." }
    ]
  },
  "output": {
    "result": {
      "response": "환불 요청을 확인했습니다",
      "endReason": "condition",
      "turnCount": 5,
      "messages": [
        { "role": "user", "content": "..." },
        { "role": "assistant", "content": "..." },
        "..."
      ],
      "condition": {
        "id": "refund_request",
        "label": "Refund Request",
        "reason": "사용자가 환불을 명시적으로 요청함"
      }
    }
  },
  "meta": {
    "durationMs": 3800,
    "model": "gpt-4o",
    "interactionType": "ai_conversation",
    "inputTokens": 3800,
    "outputTokens": 1200,
    "totalTokens": 5000,
    "toolCalls": 5,
    "ragSources": [],
    "turnDebug": [
      { "turnIndex": 1, "llmCalls": [], "totalDurationMs": 1500 },
      "..."
    ]
  },
  "port": "refund_request",
  "status": "ended"
}
```

`meta.inputTokens`·`outputTokens`·`totalTokens` 는 멀티턴 누적 합이다. 턴별 토큰은 `meta.turnDebug[i].llmCalls[j].responsePayload.usage` 에서 본다.

## 멀티턴 사용자 종료 (`user_ended`)

사용자가 `execution.end_conversation` 을 보냈을 때다(`endMultiTurnConversation` 진입점). 엔진이 누적된 `_resumeState` 로 `buildMultiTurnFinalOutput(..., 'user_ended')` 를 부른다.

```json
{
  "config": { "mode": "multi_turn", "model": "gpt-4o", "maxTurns": 20 },
  "output": {
    "result": {
      "response": "마지막 assistant 응답",
      "endReason": "user_ended",
      "turnCount": 3,
      "messages": [ "..." ]
    }
  },
  "meta": {
    "durationMs": 0,
    "model": "gpt-4o",
    "interactionType": "ai_conversation",
    "inputTokens": 1200,
    "outputTokens": 400,
    "totalTokens": 1600,
    "toolCalls": 0,
    "ragSources": [],
    "turnDebug": [ "..." ]
  },
  "port": "user_ended",
  "status": "ended"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `output.result.endReason` | `"user_ended"` | 종료 사유 |
| `output.result.response` | string | 마지막 메시지(보통 assistant). 메시지가 없으면 빈 문자열 |
| `output.result.messages` | ChatMessage[] | 누적 대화 |
| `port` | `"user_ended"` | 시스템 포트 |

## 멀티턴 최대 턴 도달 (`max_turns`)

`turnCount >= maxTurns` 를 채우면 `processMultiTurnMessage` 가 직접 `buildMultiTurnFinalOutput(..., 'max_turns')` 를 부른다(`endMultiTurnConversation` 경유 아님).

```json
{
  "config": { "mode": "multi_turn", "model": "gpt-4o", "maxTurns": 20 },
  "output": {
    "result": {
      "response": "마지막 assistant 응답",
      "endReason": "max_turns",
      "turnCount": 20,
      "messages": [ "..." ]
    }
  },
  "meta": {
    "durationMs": 1800,
    "model": "gpt-4o",
    "interactionType": "ai_conversation",
    "inputTokens": 8000,
    "outputTokens": 2400,
    "totalTokens": 10400,
    "toolCalls": 4,
    "ragSources": [ "..." ],
    "ragDiagnostics": { "attempted": true, "searchedKbCount": 1, "queriesUsed": [ "..." ], "resultCount": 8 },
    "turnDebug": [ "..." ]
  },
  "port": "max_turns",
  "status": "ended"
}
```

`maxTurns=0`(무제한)이면 이 케이스는 없고 사용자 종료·조건 매칭·에러로만 끝난다.

## 멀티턴 에러 (`error`)

타임아웃, rate limit, LLM API 오류 등 모든 오류에 쓴다. 형태는 단일 턴 에러와 같고 `meta` 가 멀티턴 누적치를 싣는다.

```json
{
  "config": { "mode": "multi_turn", "model": "claude-sonnet-4", "maxTurns": 20 },
  "output": {
    "result": {
      "messages": [ "...(부분 누적 messages 배열)" ],
      "turnCount": 3
    },
    "error": {
      "code": "LLM_RATE_LIMIT",
      "message": "Anthropic API returned 429 (Too Many Requests)",
      "details": {
        "provider": "anthropic",
        "statusCode": 429,
        "retryable": true,
        "retryAfterSec": 30
      }
    }
  },
  "meta": {
    "durationMs": 850,
    "model": "claude-sonnet-4",
    "interactionType": "ai_conversation",
    "inputTokens": 6000,
    "outputTokens": 1500,
    "totalTokens": 7500,
    "toolCalls": 2,
    "ragSources": [],
    "turnDebug": [ "..." ]
  },
  "port": "error",
  "status": "ended",
  "_retryState": {
    "...": "(retryable === true 일 때만 싣는다. _resumeState 부분집합 + expiresAt)",
    "messages": [ "...(핸들러가 보관한 LLM 이력)" ],
    "turnCount": 3,
    "totalInputTokens": 6000,
    "totalOutputTokens": 1500,
    "expiresAt": "2026-05-23T08:42:31.123Z"
  }
}
```

**`details` 표준 필드** ([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 LLM 계열 필수 필드)

| 필드 | 타입 | 뜻 |
| --- | --- | --- |
| `retryable` | boolean (필수) | 일시적이라 같은 호출을 다시 하면 성공할 수 있는지. 분류 규칙은 [AI 에이전트 노드](CLE-NODE-AGENT.md) 의 에러 코드 절 |
| `retryAfterSec` | number? | provider 가 `Retry-After` 나 같은 뜻의 신호를 준 경우. `retryable === true` 일 때만 싣는다 |

**`_retryState`**: `retryable === true` 일 때만 싣는다. 형태는 입력 대기의 `_resumeState` 부분집합에 `expiresAt`(ISO 8601, TTL 기본 60분)을 더한 것이다. 자격 증명은 허용 목록 방식으로 애초에 뺀다. 표현식 resolver·자동완성에 노출하지 않는다(Principle 4.2, 4.2.1). `retryable === false` 면 `_retryState` 를 내지 않아 재시도에 들어갈 수 없다.

멀티턴 에러 종결에서도 부분 결과(`output.result` 의 `messages`·`turnCount` 등)와 `output.error` 가 함께 있을 수 있다. 에러인지는 `output.error` 가 있는지로 판단한다.

**마지막 턴 재시도 진입**: 사용자가 대화 스레드의 `system_error` 항목 오른쪽 [다시 시도] 버튼을 누르면 WS 명령 `execution.retry_last_turn` 이 나간다([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)). 백엔드는 `_retryState` 를 찾아 `expiresAt` 을 확인하고 새 NodeExecution 행을 만든 뒤, 마지막 턴에 한 번 다시 들어가(`processAiResumeTurn`, 턴 단위 park 모델) 마지막 사용자 메시지부터 LLM 을 다시 부른다. 워크플로우 [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) 과 다르며, 같은 실행 안의 노드 단위 재시도다.

**재진입 때 설정 표현식 재평가**: 재진입은 노드 설정의 `{{ expression }}` 을 최선으로 다시 평가해 조작 필드(`llmConfigId`·`maxTurns` 등)가 정상 dispatch 와 같은 평가 값을 갖게 한다. rehydration 한 컨텍스트 기준이라 `$node`·`$var`·`$thread`·`$execution`·`$now` 는 풀리지만, 원본 nodeInput 은 영속하지 않아 `$input.*` 는 풀리지 않는다(알려진 한계). `_retryState` 는 턴 직전 `_resumeState` 스냅샷에서 나오고 실패 턴의 nodeInput 을 담지 않기 때문이다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 보존 예외). 재평가에 실패하면 원본 설정으로 안전하게 되돌아가 정적 설정은 영향이 없다. 표현식 해석 단계는 [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md) 이 정한다. `output.config` 에코는 재평가 결과가 아니라 원본 값을 유지한다.

**재진입 턴이 계속될 때**: 아래는 재진입 턴이 대화를 끝낼 때의 이야기다. 턴이 대화를 끝내지 않으면(멀티턴에서 가장 흔함) 다운스트림으로 가지 않고 `waiting_for_input` 으로 다시 park 하고 구간을 끝낸다. 다음 사용자 입력이 오면 일반 재개 경로로 합류한다. 상태 전이는 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 의 `failed → waiting_for_input`(`allowRetryReentry` opt-in) 행을 따른다.

**재진입 종결 뒤 그래프 진행**: 재진입 턴이 성공으로 끝나면 새로 만든 NodeExecution 은 일반 노드 `COMPLETED` 와 같이 출력 포트의 다운스트림으로 그래프 진행을 잇는다. 종결 규칙과 순회는 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md), [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) 를 따른다. 재진입 턴이 다시 실패하면 일반 노드 `FAILED` 와 같이 처리하고 실행도 `FAILED` 로 마감한다. 재시도 단위는 "마지막 LLM 호출 재진입" 까지이고, 그 결과의 다운스트림 처리와 종결 정책은 일반 노드와 같다. 워크플로우 재실행과의 차이는 "같은 실행 안 노드 단위 재진입" 이지 "다운스트림 차단" 이 아니다.

## 표시물 페이로드 운반

`presentationTools` 가 설정되고 LLM 이 표시 도구를 부른 턴에서 나오는 페이로드 구조다. 어떤 종결 케이스에서도(단일 턴·멀티턴 무관) 같게 나오며, 대화 기록 항목의 최상위 `presentations[]` 한 경로로 운반한다. `data?` 필드 안이 아니다. `data?` 는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 `interaction.data` 스냅샷 단일 기준이라 뜻이 다른 데이터를 넣지 않는다.

**PresentationPayload 타입 (단일 기준)**

```ts
type PresentationPayload = {
  type: 'table' | 'chart' | 'carousel' | 'template' | 'form';
  toolCallId: string;               // LLM 의 tool_use block id — meta.presentationCalls[] 와 join key
  renderedAt: string;               // ISO 8601 UTC — server side timestamp
  payload: object;                  // 해당 presentation 노드 input schema 와 동일 shape (defaults overlay 후 최종값)
  truncation?: {                    // Carousel/Table 의 tail truncate 적용 시에만 set
    itemsTruncated?: boolean;
    rowsTruncated?: boolean;
    itemsTotalCount?: number;
    rowsTotalCount?: number;
  };
};
```

이 타입의 단일 기준 정의는 이 절이다. [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 는 교차 참조만 둔다.

```json
{
  "config": { "...": "(다른 케이스와 같음)" },
  "output": {
    "result": {
      "response": "비교 결과 표로 정리했어요. 영업이익률이 가장 높은 분기는 Q3 입니다.",
      "endReason": "out",
      "turnCount": 1,
      "presentations": [
        { "type": "table", "toolCallId": "call_t1", "renderedAt": "2026-05-22T03:00:00.000Z", "payload": { "...": "(table input schema 동일 shape)" } },
        { "type": "chart", "toolCallId": "call_c1", "renderedAt": "2026-05-22T03:00:00.500Z", "payload": { "...": "(chart input schema 동일 shape)" } }
      ]
    }
  },
  "meta": {
    "...": "(다른 케이스의 일반 메타)",
    "presentationCalls": [
      { "toolName": "render_table", "toolCallId": "call_t1", "status": "rendered", "bytes": 4823 },
      { "toolName": "render_chart", "toolCallId": "call_c1", "status": "rendered", "bytes": 12039 }
    ]
  },
  "port": "out",
  "status": "ended"
}
```

| 필드 | 타입 | 위치 | 설명 |
|---|---|---|---|
| `output.result.response` | string | 핸들러 반환 | LLM 텍스트 응답. 표시 도구 호출이 있어도 비어 있을 수 있다(예: 차트만 냄). 비면 `response: ""` |
| `output.result.presentations[]` | `PresentationPayload[]?` | 핸들러 반환 | 실행 내역 화면 복원용 에코. 종결 출력에 `metadata.allPresentations` 가 있을 때만 싣고, 없으면 키 자체를 뺀다. 단일 턴 정상 완료(위 예시), 멀티턴 종결(`buildMultiTurnFinalOutput`), 조건 출력(`buildConditionOutput`)이 모두 싣는다. 본문의 1차 단일 기준은 대화 기록 항목 `presentations[]` 이며 두 위치의 데이터는 같다 |
| `meta.presentationCalls[]` | Array | 핸들러 누적 | 표시 도구 호출 기록. `[{ toolName, toolCallId, status: 'rendered' \| 'schema_violation' \| 'dropped' \| 'form_pending' \| 'form_submitted', bytes? }]` (Principle 2 메트릭) |
| `meta.presentationSchemaViolations[]` | Array? | 핸들러 누적 | 스키마 위반으로 조용히 버린 경우만 싣는다. `[{ toolName, toolCallId, issues, attempts }]` |
| 대화 기록 항목 `presentations[]` | `PresentationPayload[]` | 스레드 누적(1차 단일 기준) | 최상위 독립 필드이며 `data?` 가 아니다. 실제 페이로드 |

**복원용 에코**: 페이로드 본문의 1차 단일 기준은 대화 기록 항목의 최상위 `presentations[]` 다. 그래도 `output.result.presentations[]` 에 같은 데이터를 에코한다. 라이브 스레드 스냅샷을 싣지 않는 REST 경로(`/executions/:id` → NodeExecution.outputData)에서 실행 내역 화면이 페이로드를 복원하려면 NodeExecution 행 안에 데이터가 있어야 하기 때문이다. 스레드는 영속 때 NodeExecution 에 나눠 저장돼 복원할 수는 있지만 노드 간 조회가 N+1 이라 비용이 크다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)). 두 위치는 의도한 에코이며 Principle 1.1 직교성의 예외다. 백엔드는 한 누적기(`metadata.allPresentations`)에서 두 표면으로 함께 넣어 어긋남을 막는다. `meta.presentationCalls[]` 는 기록·메트릭만이며 이 에코와 무관하다.

**다운스트림 접근**

- `$thread.turns` 에서 `source === 'ai_assistant'` 인 턴의 `presentations` 로 접근한다.
- 보통은 `output.result.response` 텍스트만 보면 된다. 후속 노드(예: Send Email)가 페이로드를 직접 다루려면 스레드 접근이 1차다.

**`render_form` 의 멀티턴 운반**: `render_form` 이 불린 턴은 입력 대기 형식을 따르되 `output.interaction` 이 폼 미리보기를 싣고 `_resumeState.pendingFormToolCall.toolCallId` 가 설정된다. 사용자가 제출하면 재개 스냅샷이 `output.interaction.{type:'form_submitted', data, receivedAt}` 로 나오고(AI 경로 스냅샷은 미구현), 다음 턴의 대화 기록 항목에 `source: 'presentation_user'` 누적이 일어난다(`ai_user` 가 아님).

## LLM 호출 기록 (`meta.turnDebug`)

실행 결과의 `meta.turnDebug` 배열에 들어가는 턴별 LLM 호출 기록이다. 프런트엔드 대화 인스펙터와 실행 상세의 Response·Request·LLM Usage 탭이 각 LLM 호출의 요청·응답·토큰 사용량을 보여 줄 때 쓴다. 옛 "LLM Information" 단일 탭은 이 세 탭으로 평탄화됐다([실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md)).

```json
"meta": {
  "turnDebug": [
    {
      "turnIndex": 1,
      "llmCalls": [
        {
          "requestPayload": { "model": "gpt-4o", "messages": [], "tools": [] },
          "responsePayload": { "model": "gpt-4o", "usage": { "inputTokens": 500, "outputTokens": 120 }, "toolCalls": [] },
          "durationMs": 1250
        },
        {
          "requestPayload": { "...tool result 포함...": "..." },
          "responsePayload": { "...최종 응답...": "..." },
          "durationMs": 800
        }
      ],
      "totalDurationMs": 2050,
      "toolCalls": [
        {
          "toolCallId": "call_abc123",
          "name": "kb_workspace_main",
          "providerKey": "kb",
          "status": "success",
          "durationMs": 1240
        }
      ],
      "ragSources": [
        { "documentId": "uuid", "chunkId": "uuid", "documentName": "Refund Policy", "content": "14-day refund window…", "score": 0.92 }
      ],
      "ragDiagnostics": {
        "attempted": true,
        "searchedKbCount": 1,
        "queriesUsed": ["refund window"],
        "resultCount": 1
      }
    }
  ]
}
```

- 한 턴에서 function calling 이 일어나면 `llmCalls` 에 항목이 여러 개 생긴다. 항목 하나가 LLM API 호출 하나다.
- 프런트엔드는 각 assistant 메시지를 그 턴의 N번째 LLM 호출과 짝지어 디버그 정보를 보여 준다.
- 실행 결과에 늘 들어간다. 워크플로우 소유자만 실행 결과를 조회할 수 있어 따로 접근 제어를 두지 않는다.
- `requestPayload` 에 시스템 프롬프트와 전체 대화 이력이 들어갈 수 있다. 자격 증명은 나가는 응답(REST·WS)에서 자동으로 마스킹한다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)). DB 와 표현식에는 원문이 남는다.
- 각 턴 항목의 `ragSources` 는 그 턴에 부른 지식 저장소 도구의 청크 delta, `ragDiagnostics` 는 그 턴 한정 진단이다. 노드 전체 누적은 `meta.ragSources`·`meta.ragDiagnostics` 이며 턴 delta 의 합이 전체 누적과 같다.
- MCP 도구를 부른 턴에는 같은 delta·누적 관계로 `mcpDiagnostics` 도 턴 단위로 싣는다. 노드 전체 누적은 `meta.mcpDiagnostics` 다.
- `toolCalls`(선택)는 그 턴에 실행한 provider 도구(지식 저장소·MCP)별 결과 메타다. 조건 도구와 일반 도구 stub 은 넣지 않는다. `status` 는 `'success' | 'error'` 이고, provider 가 예외를 던져도 핸들러가 받아 `'error'` 로 표시하며 턴은 계속한다. 대화 인스펙터 도구 배지의 권위 출처이며, WS 도구 호출 이벤트가 유실돼도 이 데이터로 복구한다.
- 멀티턴의 `turnDebugHistory` 는 최근 `MAX_TURN_DEBUG_HISTORY = 50` 턴만 둔다(DB JSONB 비대화 방지).
- 공통 타입: 각 `llmCalls[]` 항목은 공통 `LlmCallRecord`(`codebase/backend/src/shared/llm-tracing/llm-call-record.ts`, AI 에이전트와 정보 추출기 공유)다. `requestPayload`·`responsePayload`·`durationMs` 외에 `startedAt?`·`finishedAt?`(ISO 8601 wall-clock)도 가질 수 있고 모든 필드가 선택이다. 턴 항목은 기본 `TurnDebugEntry`(`{ turnIndex, llmCalls?, totalDurationMs? }`)에 진단 delta(`toolCalls?`·`ragSources?`·`ragDiagnostics?`·`mcpDiagnostics?`)를 더한 상위 집합이다([AI 노드 공통](CLE-NODE-AI-COMMON.md)).

## 구현 위치

- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (설정 에코, 단일 턴 출력(정상 · 조건 · 에러), 멀티턴 입력 대기와 종결 출력, 표시물 페이로드 운반, `meta.turnDebug`)
- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (멀티턴 사용자 종료와 최대 턴 도달의 진입점)
- `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` (조건 매칭의 `condition.reason`)
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` (멀티턴 에러와 재개 경로)
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (마지막 턴 재시도)
- `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` (재개 체크포인트와 재시도 상태 필드)
- `codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts` (표시물 페이로드 타입)
- `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` (LLM 호출 기록 타입)
- `codebase/frontend/src/components/editor/run-results/llm-call-trace.ts` (실행 결과 화면의 LLM 호출 기록 표시)
- `codebase/frontend/src/components/editor/run-results/output-shape.ts` (턴별 디버그 데이터 정규화)

## Rationale

### 대화 상태를 `output.result.*` 한 경로로 모은 이유 (D6)

입력 대기·재개의 `messages`·`message`·`turnCount` 를 종결 시점(`output.result.*`)과 한 경로로 통일했다. 옛 최상위 `output.messages`·`output.message`·`output.turnCount` 는 폐기했다. 다운스트림 표현식은 `$node["X"].output.result.messages` 처럼 한 경로로 접근한다. `maxTurns` 는 정적 설정이라 출력에 에코하지 않고 `config.maxTurns` 로만 노출한다(진행률 분모는 화면이 설정에서 읽는다). 사용자 입력 기록은 뜻을 나눠 `output.interaction.*` 에 둔다.

### 자격 증명을 허용 목록으로 배제하는 이유

설정 에코와 세 내부 필드(`_resumeState`·`_resumeCheckpoint`·`_retryState`)는 옮길 키를 열거하는 허용 목록 방식으로 자격 증명을 애초에 뺀다. 예전에는 `adaptHandlerReturn` 경계의 `maskSensitiveFields` 가 자동 마스킹한다고 적었지만, 그 경계는 2026-08-24 에 제거됐다([실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md)). 배제는 그 경계와 무관하게 허용 목록이 보장한다. `turnDebug` 의 자격 증명 마스킹도 같은 날 나가는 응답(REST·WS) 단계로 정정됐다.

### 마지막 턴 재시도 성공 뒤 다운스트림으로 진행하는 이유

**문제**: 처음 구현은 `retry_last_turn` 으로 재진입한 턴이 성공해도 실행을 바로 `COMPLETED` 로 마감해, 그 AI 노드의 다운스트림 노드(예: HTTP Request, Send Email)가 실행되지 않았다. "노드 단위 재시도" 라는 표현은 워크플로우 [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) 과 구분(실행 단위 대 노드 단위)하려는 뜻이었지만, 일부 독자는 "다운스트림도 일부러 막는다" 로 읽을 수 있었다.

**결정**: 재시도가 성공하면 새로 만든 NodeExecution 은 일반 노드 `COMPLETED` 와 같이 다운스트림으로 진행한다. 재시도 단위는 "마지막 LLM 호출 재진입" 까지이고 그 결과의 순회·종결 정책은 일반 노드와 같다. 이는 "성공한 노드는 출력 포트 다운스트림으로 진행한다" 는 엔진 기본 불변식을 그대로 적용한 것이지 새 정책이 아니다.

**기각한 대안**

- 다운스트림도 막기(처음 구현 유지): 재시도로 대화를 살린 뒤 나머지 분기를 따로 재실행해야 한다. "한 노드만 살리고 나머지 흐름은 그대로" 라는 재시도의 목적과 맞지 않는다.
- 별도 `execution.retry_last_turn_and_resume` 명령으로 나누기: 사용자가 두 재시도를 골라야 하는 부담이 생긴다. 재시도의 본질은 늘 "그 노드를 살리고 워크플로우를 정상 진행" 이라 나눌 이유가 없다.
