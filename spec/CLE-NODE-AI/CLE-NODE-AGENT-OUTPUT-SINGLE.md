---
id: "CLE-NODE-AGENT-OUTPUT-SINGLE"
title: "AI 에이전트 노드 출력 — 단일 턴"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-AGENT-OUTPUT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-AI", "CLE-NODE-AGENT-OUTPUT"]
area: "CLE-NODE-AI"
content_hash: "96cf5ec27e6669af3438deb343820809fe0accdacc8af460c727c45c380d3ccf"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "14b65252f99cc3bad5cc34470a371bf79c32e7838afec8f704f619064784c4ff"
etag: "sha256-57056212036509e1cb5dc0f2ec066d18eefcd208b74634c7ff4a6ebc7bba87a1"
---
## 개요

이 문서는 [AI 에이전트 노드 출력과 디버그](CLE-NODE-AGENT-OUTPUT.md) 의 하위 문서로 단일 턴 모드의 종결 출력 세 케이스(정상 완료 · 조건 매칭 · 에러)를 정한다.

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
| `output.result.presentations[]` | `PresentationPayload[]?` | 핸들러 반환 | 표시 도구 호출이 있었을 때만 싣는다([표시물 페이로드 운반](CLE-NODE-AGENT-OUTPUT-DEBUG.md#표시물-페이로드-운반)) |
| `meta.durationMs` | number | 엔진 + 핸들러 | 노드 실행 소요 시간(ms) |
| `meta.model` | string | LLM provider 응답 | 실제로 부른 모델 ID(`config.model` 평가 결과) |
| `meta.inputTokens`·`outputTokens`·`totalTokens` | number | LLM provider 응답 | 그 턴에서 성공한 LLM 호출 `usage` 의 합이다. 도구 루프로 여러 번 부르면 모두 더한다([AI 노드 공통 §토큰 회계](CLE-NODE-AI-COMMON.md#토큰-회계)) |
| `meta.thinkingTokens` | number | LLM provider 응답 | 성공한 호출의 합이다. 늘 싣고 모델이 보고하지 않으면 `0` 이다([AI 노드 공통 §토큰 회계](CLE-NODE-AI-COMMON.md#토큰-회계)) |
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

표시 도구 페이로드는 `output.result.response` 와 직교한다. 텍스트는 `response`, 표·차트·캐러셀·템플릿 페이로드는 스레드의 `turn.presentations[]` 가 단일 기준이고 다운스트림은 `$thread.turns[*].presentations` 로 접근한다. 운반 규칙은 [표시물 페이로드 운반](CLE-NODE-AGENT-OUTPUT-DEBUG.md#표시물-페이로드-운반) 에 있다.

`meta.turnDebug[].toolCalls`(provider 도구 실행 기록)의 형태와 규칙은 [LLM 호출 기록](CLE-NODE-AGENT-OUTPUT-DEBUG.md#llm-호출-기록-metaturndebug) 에 있다.

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

단일 턴의 첫 LLM 호출이나 도구 루프 안 LLM 호출이 실패하면 이 형태로 나온다. 자동 메모리 전략의 롤링 요약 호출이 실패하거나 요약 모델 설정(`summaryModelConfigId`)을 조회하지 못해도 같다. 이때는 턴 응답 LLM 호출 전이라 토큰이 0 이고 `turnDebug` 의 `llmCalls` 가 비어 있다. `contextInjection`·`memory` 도 싣지 않는다. `durationMs` 는 도구 정의 크기 예산 초과와 같이 단일 턴 실행 진입부터 잰다(LLM 호출 실패는 첫 LLM 호출 직전부터다). 노드 취소는 이 포트를 쓰지 않는다. 노드 signal 이 abort 된 뒤의 실패는 AbortError 로 던지고 노드는 `cancelled` 로 끝난다. 도구 정의 크기 예산 초과(`TOOL_DEFINITION_PAYLOAD_EXCEEDED`)도 이 형태로 나온다. 다만 LLM 을 부르기 전이라 `meta` 에는 `model`·`durationMs` 만 있다.

아래 예시는 지식 저장소 없이 설정한 노드의 첫 LLM 호출이 503 으로 실패한 경우다. 성공한 호출이 없어 `turnDebug[0].llmCalls` 는 빈 배열이고 토큰은 0 이다.

```json
{
  "config": { "mode": "single_turn", "model": "gpt-4o", "systemPrompt": "..." },
  "output": {
    "error": {
      "code": "LLM_CALL_FAILED",
      "message": "503 status code (no body)",
      "details": { "retryable": true }
    }
  },
  "meta": {
    "durationMs": 15230,
    "model": "gpt-4o",
    "inputTokens": 0,
    "outputTokens": 0,
    "totalTokens": 0,
    "thinkingTokens": 0,
    "toolCalls": 0,
    "ragSources": [],
    "ragDiagnostics": { "attempted": false, "searchedKbCount": 0, "queriesUsed": [], "resultCount": 0, "skipReason": "empty_kb_list" },
    "turnDebug": [
      {
        "turnIndex": 1,
        "llmCalls": [],
        "totalDurationMs": 15230,
        "ragSources": [],
        "ragDiagnostics": { "attempted": false, "searchedKbCount": 0, "queriesUsed": [], "resultCount": 0, "skipReason": "empty_kb_list" }
      }
    ]
  },
  "port": "error",
  "status": "ended"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `output.error.code` | string (UPPER_SNAKE_CASE) | 에러 분류. 코드 표는 [AI 에이전트 노드](CLE-NODE-AGENT.md) 의 에러 코드 절 |
| `output.error.message` | string | 사람이 읽는 메시지(로그·디버깅용 원문에서 민감값을 지운 것, 국제화 없음) |
| `output.error.details` | object | 에러 객체가 실은 `details`(민감값 제거) 위에 `retryable` 과 `retryAfterSec` 를 얹은 것. provider·statusCode·attempt 같은 키는 에러 객체에 있을 때만 들어간다. 예: 503 은 `{ "retryable": true }`, Retry-After 30초인 429 는 `{ "retryable": true, "retryAfterSec": 30 }` |
| `output.error.details.retryable` | boolean | 필수. 일시적 오류인지. `true` 는 HTTP 429·5xx·타임아웃 같은 일시 오류(예: 503), `false` 는 인증 실패·스키마 치명 오류. 단일 턴은 `_retryState` 를 만들지 않아 `true` 여도 [다시 시도] 버튼이 없다([대화 미리보기 §다시 시도 버튼 조건](../CLE-EXEC/CLE-EXEC-PREVIEW.md#다시-시도-버튼-조건)). |
| `output.error.details.retryAfterSec` | number? | 재시도 권장 대기 초(있을 때). 멀티턴 에러와 같은 형식 |
| `meta.*` | | 정상 완료와 같은 키를 실패 직전까지 모은 값으로 싣는다. `durationMs`(단일 턴 시작부터)·`model`·토큰·`toolCalls`·`ragSources`·`ragDiagnostics`·`mcpDiagnostics?`·`turnDebug` 가 들어간다. `presentationCalls`·`presentationSchemaViolations`·`contextInjection`·`memory` 는 있을 때만 싣는다. 도구 정의 크기 예산 초과는 `model`·`durationMs` 만 싣는다 |
| `meta.inputTokens`·`outputTokens`·`totalTokens` | number | 실패 전에 성공한 LLM 호출의 `usage` 합이다. 첫 호출이 실패하면 0 이다. 정상 완료 `out` 과 같은 기준이다([AI 노드 공통 §토큰 회계](CLE-NODE-AI-COMMON.md#토큰-회계)) |
| `meta.thinkingTokens` | number | 실패 전에 성공한 호출의 합이다. 늘 싣고 보고가 없으면 `0` 으로 두는 기준은 [AI 노드 공통 §토큰 회계](CLE-NODE-AI-COMMON.md#토큰-회계) 에 있다. 도구 정의 크기 예산 초과 에러에는 싣지 않는다(`meta.*` 행) |
| `meta.toolCalls` | number | 실패 전까지 실행한 도구 호출 수 |
| `meta.turnDebug[0].llmCalls` | Array | 성공한 LLM 호출만 담는다. 실패한 호출은 응답이 없어 넣지 않는다. 첫 호출이 실패하면 `[]` |
| `status` | `"ended"` | 에러 종결 상태 |
| `port` | `"error"` | |

## Rationale

### 단일 턴 에러 예시를 구현에 맞춘 이유 (2026-11-01)

단일 턴 에러 절의 JSON 예시와 `output.error.details` 설명을 구현이 실제로 내는 값에 맞췄다. 이전 판 예시의 `provider`·`statusCode`·`attempt` 와 메시지의 "after 3 retries" 는 구현이 내지 않는 목표 예시였다.
