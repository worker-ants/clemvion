---
id: "CLE-NODE-AI-COMMON"
title: "AI 노드 공통"
type: "convention"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-NODE-AI"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-AI"]
area: "CLE-NODE-AI"
content_hash: "5024258472e58a93249cc8f2de845a4f80059c674c0bbb8ab0fb3be11ed54f75"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/3-ai/0-common.md", "spec/4-nodes/3-ai/_product-overview.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "3fe523d86483a1f34ddeb05c707d06650c3628c2ef1ab98b392d8c4d7f3be76f"
etag: "sha256-221c56c4592895282c4996c51bbbb11d54021916bba5871ece7eacb5282bdd95"
---
> 구현 상태: 구현됨 (캔버스 요약 일부 미구현) · 원문: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/_product-overview.md` (§4 기술 결정, §5 비기능 요구사항), `spec/4-nodes/_product-overview.md` (§6 머리말) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

AI 노드(AI nodes)는 LLM 을 부르는 세 노드다. [AI 에이전트 노드](CLE-NODE-AGENT.md)(AI Agent, `ai_agent`), [텍스트 분류기 노드](CLE-NODE-CLASSIFIER.md)(Text Classifier, `text_classifier`), [정보 추출기 노드](CLE-NODE-EXTRACTOR.md)(Information Extractor, `information_extractor`)가 여기에 속한다. 이 문서는 세 노드가 함께 따르는 규약을 정한다. 노드별 설정과 동작은 각 노드 문서가 정한다.

이 문서가 정하는 것은 다음과 같다. 모델 선택 필드, AI 에이전트 전용인 지식 저장소·MCP 연결 필드, 멀티턴 차단 모드의 공통 동작, 출력 형태와 에러 계약, 토큰 회계와 진단 누적, 캔버스 요약 형식, 출력 구조 색인, 대화 맥락 설정과 메모리 전략, 시스템 컨텍스트 접두, AI 영역의 기술 결정과 비기능 기준이다.

다음 주제는 다른 문서가 정한다.

- 노드 출력 5필드의 일반 규칙: [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md)
- 대화 스레드 자료구조·누적·영속화·주입 메커니즘: [대화 스레드](../CLE-IX/CLE-IX-THREAD.md)
- 에이전트 메모리 저장·추출·회수: [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md)
- 지식 저장소 검색 동작: [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md), [Graph RAG](../CLE-KB/CLE-KB-GRAPH.md)
- MCP 도구 노출·이름·실행 규칙: [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)
- 모델 설정 화면과 API: [모델 설정](../CLE-AI/CLE-AI-MODELS.md). LLM 호출 추상화: [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md)
- 입력 대기·재개 상태 전이: [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md)

## 규칙

1. AI 노드는 모두 `llmConfigId`(모델 설정 참조 필드)와 `model`(모델 ID) 두 필드로 LLM 호출 설정을 고른다.
2. 지식 저장소 연결 필드(`knowledgeBases`·`ragTopK`·`ragThreshold`)와 MCP 연결 필드(`mcpServers`·`maxToolCalls`)는 AI 에이전트 노드만 갖는다. 텍스트 분류기와 정보 추출기에는 이 필드가 없다.
3. 지식 저장소 검색은 LLM 이 지식 저장소 도구(`kb_*`)를 부를 때 실행한다. LLM 호출 전 자동 검색(prefill) 여부는 정의가 갈린다. [미결 사항](#미결-사항) 참조.
4. 멀티턴(`multi_turn`)은 AI 에이전트와 정보 추출기만 쓴다. 종료 조건을 채우지 못하면 `status: 'waiting_for_input'`, `interactionType: 'ai_conversation'` 으로 멈춘다.
5. 멀티턴의 사용자 응답 대기에는 타임아웃이 없다. 외부 취소만 대기를 끝낸다.
6. 도메인 결과는 `output.result.*`, 에러는 `output.error.{code, message, details?}`, 사용자 입력 기록은 `output.interaction.*` 에 둔다.
7. AI 노드의 에러는 `details.retryable: boolean` 을 반드시 싣는다. `details.retryAfterSec` 은 `retryable === true` 일 때만 싣는다.
8. 멀티턴이 에러로 끝나도 부분 결과(`output.result`)를 `output.error` 와 함께 남긴다. 에러인지는 `output.error` 가 있는지로 판단한다.
9. LLM 호출 결과의 `meta` 에는 `model`·`inputTokens`·`outputTokens`·`totalTokens`·`durationMs` 를 싣는다. `thinkingTokens` 와 `turnDebug` 는 있을 때만 싣는다.
10. provider 도구를 부른 노드는 `meta.ragSources`·`meta.ragDiagnostics`·`meta.mcpDiagnostics` 누적치를 싣는다. 멀티턴에서는 턴별 delta 의 합이 누적치와 같아야 한다.
11. 대화 맥락 설정의 기본값은 `contextScope: 'none'` 이다. 사용자가 명시적으로 켤 때만 주입한다.
12. 메모리 전략이 자동(`summary_buffer`·`persistent`)이면 범위 필드 4개(`contextScope`·`contextScopeN`·`contextInjectionMode`·`includeToolTurns`)는 무효다.
13. 시스템 컨텍스트 접두는 기본으로 켜져 있고(`includeSystemContext: true`), 항상 시스템 프롬프트 맨 앞에 붙는다.
14. 접두의 시간대는 워크스페이스 설정 → 서버 `process.env.TZ` → `UTC` 순서로 정한다.
15. 시스템 프롬프트 조립 순서의 단일 기준은 이 문서의 "시스템 프롬프트 조립 순서" 절이다.
16. `includeSystemContext`·`systemContextSections` 는 기본값과 같으면 설정 에코에서 뺀다.

## 모델 선택

세 노드 모두 다음 두 필드로 LLM 호출 설정을 고른다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `llmConfigId` | UUID | 사용할 모델 설정([모델 설정](../CLE-AI/CLE-AI-MODELS.md)) |
| `model` | String | 모델 ID (프로바이더별) |

설정 화면은 같은 패턴을 쓴다. 모델 프로바이더 드롭다운을 먼저 고르고, 그다음 모델 드롭다운을 고른다. 모델 목록은 고른 프로바이더에 따라 바뀐다.

## 지식 저장소 연결 (AI 에이전트 전용)

AI 에이전트 노드는 다음 필드로 지식 저장소 검색을 켠다. 텍스트 분류기와 정보 추출기에는 지식 저장소·RAG 설정 필드가 없다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `knowledgeBases` | UUID[] | 참조할 지식 저장소 ID 목록. 검색 모드(`vector`·`graph`)는 지식 저장소마다 다를 수 있고, 검색 서비스(`RagSearchService`)가 지식 저장소별로 흐름을 나눈다 |
| `ragTopK` | Integer | 주입 상한(선택). 비우면 동적 점수 컷이 주입 수를 정하고, 값을 주면 그 값이 상한이 된다. graph 모드 지식 저장소도 최종 주입 단계에 같은 동적 점수 컷을 적용한다 |
| `ragThreshold` | Float | 유사도 임계값. 기본 `0.7`. graph 모드 지식 저장소에서는 vector seed 단계에 적용한다. 리랭킹이 켜진 지식 저장소(`rerank_mode ≠ off`)에서는 리랭크 점수 임계로 해석한다 |

LLM 은 도구 호출 인자로 `ragTopK`·`ragThreshold` 를 덮어쓸 수 있다. 두 값의 의미, 동적 점수 컷, 리랭킹 해석, 도구 인터페이스와 이름 규칙은 [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) 에서 정한다.

LLM 호출 전에 엔진이 지식 저장소를 자동 검색하는지는 정의가 갈린다. [미결 사항](#미결-사항) 참조. 현재 구현은 LLM 이 지식 저장소 도구를 부를 때만 검색한다.

## MCP 서버 연결 (AI 에이전트 전용)

AI 에이전트 노드는 워크스페이스에 등록된 MCP 지원 통합(MCP-capable Integration)을 여러 개 골라 도구로 쓴다. MCP 지원 통합에는 외부 MCP 서버(`service_type='mcp'`)와 백엔드 안에서 도는 내부 MCP 브리지(Internal MCP Bridge)가 노출하는 통합(`service_type='cafe24'`·`'makeshop'`, 앞으로 늘어날 수 있음)이 모두 들어간다. 내부 MCP 브리지는 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) 에서 정한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `mcpServers` | McpServerRef[] | 쓸 MCP 지원 통합 목록. `service_type ∈ ('mcp', 'cafe24', 'makeshop')` 를 모두 받는다. 서버마다 노출 도구 목록과 resource·prompt 노출 여부를 정한다 |
| `maxToolCalls` | Integer | 도구 호출 한도. 기본 `10`. 지식 저장소·MCP·표시·일반 도구 호출을 모두 더한다. 조건 도구는 세지 않는다 |

**McpServerRef 구조**

| 필드 | 타입 | 설명 |
|------|------|------|
| `integrationId` | UUID | 통합 FK(`service_type ∈ ('mcp', 'cafe24', 'makeshop')`). 외부 HTTP MCP 서버 또는 내부 MCP 브리지를 쓰는 first-party 통합 |
| `enabledTools` | String[]? | 노출 도구 목록(bare operation id 배열). `['*']` 이거나 비우면 전체를 노출한다. 메타도구(resources·prompts)에는 영향이 없다. Cafe24 는 도구가 많아(2026-07-17 실측 485개, 전체 수의 단일 기준은 [Cafe24 API 카탈로그 §5 Coverage Matrix](CLE-C24-CATALOG#5-coverage-matrix)) 화면에서 Resource 단위로 묶어 보여 준다. 대형 카탈로그는 비워 두면 `AI_AGENT_TOOL_COUNT_MAX`(128)를 늘 넘으므로 목록 지정이 사실상 필수다([AI 에이전트 노드](CLE-NODE-AGENT.md) 의 도구 정의 크기 예산) |
| `includeResources` | Boolean? | 서버가 `resources` capability 를 보고할 때 메타도구를 노출할지. 기본 `true`. Cafe24 내부 브리지는 `resources` 를 보고하지 않아 영향이 없다 |
| `includePrompts` | Boolean? | 서버가 `prompts` capability 를 보고할 때 메타도구를 노출할지. 기본 `true`. Cafe24 도 같다 |
| `toolOverrides` | `{ toolName: string; description?: string }[]`? | 도구별 description 덮어쓰기. 이름은 바꿀 수 없다 |

도구 이름·메타도구·실행 모델·에러 격리 정책의 단일 기준은 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) 다. 이 표는 노드 설정 쪽 요약이다.

## 멀티턴 차단 모드

AI 에이전트와 정보 추출기의 멀티턴 모드는 워크플로우 실행을 멈추고(blocking) 사용자와 대화한다. Form 노드의 입력 대기 메커니즘을 넓힌 것이다.

- 첫 턴이나 후속 턴에서 종료 조건을 채우지 못하면 `status: 'waiting_for_input'`, `interactionType: 'ai_conversation'` 으로 멈춘다.
- 클라이언트가 `execution.submit_message` 명령으로 사용자 메시지를 보내면 재개한다. 사용자가 `execution.end_conversation` 명령을 보내면 대화를 끝낸다. 두 명령은 AI 에이전트와 정보 추출기가 함께 쓴다. 명령 정의는 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md), 외부 표면 매핑은 [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md), 대기 표면 값 집합은 [인터랙션 타입 레지스트리](../CLE-IX/CLE-IX-TYPES.md) 에서 정한다.
- 사용자 응답은 무제한으로 기다린다. 외부 취소 말고는 타임아웃이 없다.
- 재개할 때 `status: 'resumed'` 와 `output.interaction.{type, data, receivedAt}` 스냅샷을 한 번 내는 것이 목표 계약이다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md)). 현재 AI 대화 경로는 이 스냅샷을 내지 않는다(미구현). 같은 수신 시점의 WS `execution.user_message` 라이브 신호는 구현돼 있다.

종료 사유별 출력 포트는 각 노드 문서의 포트 절이 정한다. park 와 rehydration 은 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 에서 정한다.

## 출력 형태

AI 노드는 `output.result.*`·`output.error.*`·`output.interaction.*` 세 묶음을 함께 쓴다. 근거는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 Principle 1.1(설정·출력 직교), 3.2(에러 계약), 4.4~4.5(interaction 존재와 payload 형태), 8.2(result·category 1차 이름)다. Principle 11 은 출력 예시 문서화 서식 규칙이라 이 계약의 근거가 아니다.

| 묶음 | 용도 |
|------|------|
| `output.result.*` | 성공 시 도메인 결과(`extracted`, `response`, `category` 등) |
| `output.error.{code, message, details?}` | LLM 호출 실패, JSON 파싱 실패, 재시도 소진 등. `details.retryable: boolean` 필수, `details.retryAfterSec?: number` 선택 |
| `output.interaction.{type, data, receivedAt}` | 멀티턴 재개 직후 한 번 내는 사용자 입력 기록 |

멀티턴이 `max_retries` 같은 사유로 끝나면 `output.error` 와 `output.result` 가 함께 있을 수 있다. 후속 노드가 부분 결과를 쓸 수 있도록 둘 다 남긴다. 에러인지 정상인지는 `output.error` 가 있는지로 판단한다.

## 에러 계약

- AI 노드의 `output.error.details` 에는 재시도 가능 여부(`retryable: boolean`)가 반드시 있다. `retryAfterSec` 은 `retryable === true` 일 때만 싣는다. 이 필드의 의미와 분류 원칙은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 에서 정한다.
- 에러 코드 등록은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 가 맡는다. 노드별 코드 표는 각 노드 문서에 있다.
- 인증 실패(HTTP 401·403)를 재시도 가능으로 볼지는 노드마다 정의가 갈린다. [미결 사항](#미결-사항) 참조.
- 에러 출력에 싣는 `meta` 는 노드마다 다르다. [미결 사항](#미결-사항) 참조.

| 노드 | 쓰는 코드 |
|------|-----------|
| AI 에이전트 | `LLM_CALL_FAILED`, `LLM_RATE_LIMIT`, `LLM_RESPONSE_INVALID`, `TOOL_DEFINITION_PAYLOAD_EXCEEDED`, 예약 코드 `TOOL_EXECUTION_FAILED`·`MAX_TOOL_CALLS_EXCEEDED` |
| 텍스트 분류기 | `LLM_CALL_FAILED`, `LLM_RATE_LIMIT`, 예약 코드 `LLM_RESPONSE_INVALID` |
| 정보 추출기 | `LLM_CALL_FAILED`, `LLM_RATE_LIMIT`, `LLM_RESPONSE_INVALID`, `MAX_COLLECTION_RETRIES_EXCEEDED` |

## 토큰 회계

모든 AI 노드의 LLM 호출 결과 `meta` 에는 다음 필드가 들어간다.

| 필드 | 필수 여부 | 설명 |
|------|-----------|------|
| `meta.model` | 필수 | 실제로 부른 모델 ID |
| `meta.inputTokens` | 필수 | 입력 토큰 수 |
| `meta.outputTokens` | 필수 | 출력 토큰 수 |
| `meta.totalTokens` | 필수 | 입력과 출력의 합 |
| `meta.thinkingTokens` | 선택 | 모델이 thinking 토큰을 보고할 때 |
| `meta.durationMs` | 필수 | 실행 소요 시간 |
| `meta.turnDebug` | 선택 | 턴별 LLM 호출 기록. `[{ turnIndex, llmCalls, totalDurationMs, toolCalls?, ragSources?, ragDiagnostics?, mcpDiagnostics? }, ...]` |

텍스트 분류기는 `turnDebug` 대신 평면 배열 `meta.llmCalls` 에 호출 기록을 싣는다. 에러 출력의 `meta` 규칙은 노드마다 다르다. [미결 사항](#미결-사항) 참조.

**공통 타입의 단일 기준**: `LlmCallRecord` 와 `TurnDebugEntry` 의 타입 정의는 `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` 하나다. AI 에이전트와 정보 추출기가 함께 쓴다.

- `LlmCallRecord` 는 필드가 모두 선택인 상위 집합이다. `requestPayload?`·`responsePayload?`·`durationMs?`·`startedAt?`·`finishedAt?` 를 갖고, `startedAt`·`finishedAt` 은 ISO 8601 wall-clock 시각이다.
- `TurnDebugEntry` 의 기본형은 `{ turnIndex, llmCalls?, totalDurationMs? }` 다. AI 에이전트는 실행 중 여기에 턴별 진단 delta(`toolCalls?`·`ragSources?`·`ragDiagnostics?`·`mcpDiagnostics?`)를 더해 싣는다. 공유 타입은 기본형이고, 진단 필드는 AI 노드 런타임의 확장이다.

필드 의미는 [AI 에이전트 노드 출력과 디버그](CLE-NODE-AGENT-OUTPUT.md) 에서 정한다.

## 진단 누적

지식 저장소·MCP·일반 provider 도구 호출이 일어난 노드는 `meta.ragSources`·`meta.ragDiagnostics`·`meta.mcpDiagnostics` 누적치를 싣는다. 멀티턴에서는 턴 단위 delta 도 `meta.turnDebug[i].{ragSources, ragDiagnostics, mcpDiagnostics}` 에 따로 싣고, delta 의 합은 전체 누적과 같다. `mcpDiagnostics.serverSummaries[]` 는 도구 목록을 만든 결과의 정적 스냅샷이다. 노드 실행마다 한 번 정해지고 턴 delta 와 무관하다.

필드 의미는 다음 문서에서 정한다.

- RAG 진단(`ragSources`·`ragDiagnostics`): [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md)
- MCP 진단(`mcpDiagnostics`, `serverSummaries[].skipReason` 어휘 포함): [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)

필드마다 어느 조건에서 싣는지는 [AI 에이전트 노드](CLE-NODE-AGENT.md) 의 진단 메타 절에서 정한다.

## 캔버스 요약

> 구현 현황: 캔버스 요약은 `getConfigSummary`(`node-config-summary.ts`)가 노드 메타데이터의 `summaryTemplate`(mustache)을 렌더해 만든다. 지금은 텍스트 분류기만 `summaryTemplate` 을 갖는다. AI 에이전트와 정보 추출기는 요약이 표시되지 않는다(미구현). 아래 두 노드의 형식은 목표 계약이다. 조건부 세그먼트(`· {N} KB` 등)와 `Multi Turn` 접두어 조합은 현재 `summaryTemplate` DSL 로 표현할 수 없어, 전용 요약 빌더나 DSL 확장을 후속으로 남긴다.

| 노드 | 요약 형식 | 예시 |
|------|-----------|------|
| AI 에이전트 | 미구현. 목표는 `{mode} · {model}`. 지식 저장소를 연결하면 `· {N} KB`, MCP 지원 통합이 있으면 `· {N} MCP`, 조건이 있으면 `· {N} cond` 를 덧붙인다. 멀티턴이면 `Multi Turn` 을 표기한다. MCP 수는 외부 MCP 서버와 내부 브리지 통합을 합산한다 | (목표) `gpt-4o · 1 KB · 1 MCP · 3 cond` (단일 턴), `Multi Turn · gpt-4o · 1 KB · 2 MCP · 2 cond` (멀티턴) |
| 텍스트 분류기 | 구현됨(`summaryTemplate`). `{model} · {N} categories` | `gpt-4o-mini · 3 categories` |
| 정보 추출기 | 미구현. 목표는 `{model} · {N} fields`(출력 스키마 필드 수). 멀티턴이면 앞에 `Multi Turn` 을 붙인다 | (목표) `claude-sonnet · 4 fields`, `Multi Turn · claude-sonnet · 4 fields` |

MCP 수를 합산하는 이유는 사용자 입장에서 외부 MCP 서버와 내부 브리지가 모두 "AI 가 부르는 외부 도구 출처" 이기 때문이다. AI 에이전트 요약에 표시 도구 수 세그먼트를 넣을지는 [미결 사항](#미결-사항) 참조.

## 출력 구조 색인

AI 노드는 정상·분기·에러·입력 대기·재개·종결로 출력 케이스가 가장 다양하다. 모든 케이스는 이 문서의 "출력 형태" 절을 따른다.

| 노드 | 정상 | 분기 | 에러 | 입력 대기 / 재개 | 종결 |
|------|------|------|------|------------------|------|
| [AI 에이전트 단일 턴](CLE-NODE-AGENT-OUTPUT.md) | `out` | `<조건 id>` | `error` | 없음 | 없음 |
| [AI 에이전트 멀티턴](CLE-NODE-AGENT-OUTPUT.md) | 없음 | `<조건 id>` | `error` | `waiting_for_input` / `resumed`(일시) | `user_ended` / `max_turns` |
| [텍스트 분류기](CLE-NODE-CLASSIFIER.md) | 단일 레이블 `<카테고리 포트>` 또는 `fallback` | 다중 레이블 포트 배열(fan-out) 또는 `fallback` | `error` | 없음 | 없음 |
| [정보 추출기 단일 턴](CLE-NODE-EXTRACTOR.md) | `out` | 없음 | `error` | 없음 | 없음 |
| [정보 추출기 멀티턴](CLE-NODE-EXTRACTOR.md) | 없음 | 없음 | `error` | `waiting_for_input` / `resumed`(일시) | `completed` / `user_ended` / `max_turns` / `max_retries`(`error` 포트) |

## 대화 맥락 설정

세 AI 노드는 모두 대화 스레드(`ConversationThread`)에 최종 assistant 응답을 누적(push)하고, 대화 맥락 설정(Conversation Context, `contextScope`)에 따라 스레드를 LLM 입력에 자동 주입(inject)한다. 누적은 핸들러의 `pushClassifierTurn`·`pushExtractorTurn` 등이, 주입은 공유 유틸 `shared/conversation-context-injection.ts` 가 맡는다. 누적과 주입의 적용 범위 차이, 노드별 최종 assistant 텍스트 변환 규칙은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 에서 정한다.

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `contextScope` | `none` / `thread` / `lastN` | ✓ | `none` | 자동 주입할 스레드 범위 |
| `contextScopeN` | Integer | `lastN` 일 때 | `20` | `lastN` 일 때 최근 N개 턴 |
| `contextInjectionMode` | `messages` / `system_text` | 범위가 `none` 이 아닐 때 | `messages` | 주입 형식. LLM messages 배열 앞에 붙이거나 시스템 프롬프트 텍스트에 붙인다 |
| `includeToolTurns` | Boolean | | `false` | `ai_tool` 턴(지식 저장소·MCP·조건 결과)도 스레드에 누적할지. 자동 메모리 전략이면 주입 쪽에서는 무효지만 누적은 전략과 무관하게 유지한다 |
| `excludeFromConversationThread` | Boolean | | `false` | 이 노드의 user·assistant 턴을 스레드에서 뺀다(opt-out) |

- 기본값 `contextScope: 'none'` 이라 기존 워크플로우는 영향이 없다. 명시적으로 켤 때만 자동 주입한다.
- 위 5필드는 세 노드가 같은 인터페이스로 갖는다. 스키마는 공유 조각 `buildConversationContextSchemaFields()`(`shared/conversation-context-schema.ts`), 주입은 공유 유틸 `injectConversationContext()` 를 쓴다.
- 주입 시점은 노드마다 다르다. AI 에이전트 멀티턴은 매 턴 다시 주입한다. 정보 추출기 멀티턴은 첫 진입 때 한 번 주입하고 이후 턴은 `_resumeState.messages` 로 운반한다. 텍스트 분류기는 분류 LLM 호출 직전에 주입한다.
- 주입 위치·messages 매핑·길이 상한·영속화·로드맵은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 가 단일 기준이다.

## 메모리 전략

메모리 전략(`memoryStrategy`)은 대화 맥락을 어떻게 관리할지 정한다. 대화 맥락 설정이 "어느 범위를 넣을지" 라면 메모리 전략은 "어떻게 관리할지" 다.

| 노드 | 값 | 기본값 |
|------|----|--------|
| AI 에이전트 | `manual` / `summary_buffer` / `persistent` | `manual` |
| 정보 추출기 | `manual` / `persistent` | `manual` |
| 텍스트 분류기 | 필드 없음. 늘 `manual` 처럼 대화 맥락 설정만 적용 | 없음 |

- `manual` 은 대화 맥락 설정 필드를 그대로 쓴다.
- `summary_buffer` 는 한 실행 안에서 토큰 예산을 넘으면 오래된 턴을 롤링 요약(`runningSummary`)으로 줄인다. AI 에이전트만 쓴다. 정보 추출기는 짧은 수집 대화라 요약 이득이 없어 이 값이 없다.
- `persistent` 는 AI 에이전트에서 롤링 요약에 에이전트 메모리 회수·추출을 더한다. 정보 추출기에서는 회수와 추출만 쓴다. 정보 추출기와 AI 에이전트는 같은 메모리 범위 키 규칙을 써서 같은 키면 메모리를 공유한다.
- 텍스트 분류기는 단일 턴이고 상태가 없어 자동 메모리 대상이 아니다.

범위 필드 4개(`contextScope`·`contextScopeN`·`contextInjectionMode`·`includeToolTurns`)는 `manual` 일 때만 유효하다. 자동 전략이면 자동 전략이 맥락 구성을 대신해 이 4필드는 무효다. `excludeFromConversationThread` 는 스레드 누적 opt-out 이라 전략과 무관하게 유효하다. 설정 화면에서는 `gateOnManualMemoryStrategy` 가드로 자동 전략일 때 대화 맥락 필드 5개를 모두 숨긴다. 이 때문에 자동 전략에서 opt-out 을 설정할 방법이 없다. [미결 사항](#미결-사항) 참조.

노드별 메모리 필드는 다음과 같다. 값의 의미와 기본값은 각 노드 문서가 정한다.

| 필드 | AI 에이전트 | 정보 추출기 |
|------|:---:|:---:|
| `memoryTokenBudget` | ✓ | |
| `memoryKey` | ✓ | ✓ |
| `memoryTopK` | ✓ | ✓ |
| `memoryThreshold` | ✓ | ✓ |
| `memoryTtlDays` | ✓ | ✓ |
| `embeddingModelConfigId` | ✓ | ✓ |
| `summaryModelConfigId` | ✓ | |
| `extractionModelConfigId` | ✓ | ✓ |

롤링 요약 동작과 실행 단계 배치는 [AI 에이전트 노드](CLE-NODE-AGENT.md), 정보 추출기의 회수·추출 시점은 [정보 추출기 노드](CLE-NODE-EXTRACTOR.md), 에이전트 메모리의 저장·범위 키·추출·회수는 [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md) 가 정한다.

## 시스템 컨텍스트 접두

세 AI 노드는 시스템 프롬프트 앞에 현재 시각과 시간대 같은 실행 환경 정보를 자동으로 붙인다. 이를 시스템 컨텍스트 접두(`includeSystemContext`)라 부른다. LLM 이 "최근 7일", "오늘 자정", "어제 미발송" 같은 시각 추론을 할 때 시간대가 모호해 9시간 틀리는 회귀를 미리 막는다.

대화 맥락 설정과는 뜻이 다르다. 대화 맥락 설정은 과거 턴의 user·assistant 메시지를 messages 배열이나 시스템 프롬프트 끝에 붙인다. 시스템 컨텍스트 접두는 지금 시각과 시간대를 시스템 프롬프트 앞에 한 묶음으로 붙인다.

### 설정 필드

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `includeSystemContext` | Boolean | | `true` | 접두를 켤지. `false` 면 사용자 시스템 프롬프트만 LLM 에 보낸다 |
| `systemContextSections` | String[] | | `['time', 'timezone']` | 접두에 넣을 섹션. 허용 값은 `time`·`timezone`·`workspace`·`node`. 빈 배열은 `includeSystemContext: false` 와 같다 |

- 기본값이 켜짐이라 기존 워크플로우의 LLM 호출에도 시각·시간대 줄이 붙는다. 토큰 비용은 약 30토큰이다. 응답이 달라질까 걱정되는 워크플로우는 명시적으로 `false` 로 끄거나 섹션을 줄인다.
- 기존 행 해석: 이 필드가 생기기 전에 저장한 워크플로우는 설정에 두 필드가 없다. 백엔드는 두 필드가 없으면 기본값(`true`, `['time', 'timezone']`)으로 해석한다. DB 마이그레이션으로 `false` 를 박지 않는다. 회귀가 걱정되는 워크플로우만 사용자가 알고 끈다.

### 섹션별 내용

| 섹션 | 출력 한 줄 | 데이터 출처 |
|---|---|---|
| `time` | `Current time: <ISO8601 with TZ>` | `$now`(실행 단위로 고정, UTC). 접두 본문은 아래 시간대로 바꾼 ISO 값 |
| `timezone` | `Timezone: <IANA name> (UTC<offset>)` | 아래 "시간대 결정 순서" |
| `workspace` | `Workspace: <name> (id: <uuid>)` | `context.workspace.{id, name}` |
| `node` | `Node: <nodeLabel> (type: <nodeType>, id: <nodeId>)` | `context.currentNode.{id, label, type}` |

기본 섹션으로 KST 워크스페이스에서 만든 접두 예시:

```text
## System Context
- Current time: 2026-05-18T12:45:12+09:00
- Timezone: Asia/Seoul (UTC+9)
```

UTC 워크스페이스의 접두 예시:

```text
## System Context
- Current time: 2026-05-18T03:45:12Z
- Timezone: UTC
```

### 시간대 결정 순서

접두의 시간대는 다음 순서로 정한다.

1. 워크스페이스 설정 `Workspace.settings.timezone`(IANA). 워크스페이스 설정의 필수 항목이다(원본: NAV-SC-06, [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md)).
2. 서버 기본값 `process.env.TZ`(배포 환경 변수).
3. `UTC`.

각 단계의 IANA 이름은 `Intl.DateTimeFormat(...).resolvedOptions().timeZone` 으로 검증한다. 검증에 실패하면 다음 단계로 넘어간다. UTC offset 은 `$now` 시점 기준이다. DST 가 있는 시간대는 실행 시점의 offset 을 쓴다.

스케줄의 시간대는 cron 발화 기준이며 이 접두와 별개로 정한다([스케줄](../CLE-TRIG/CLE-TRIG-SCHEDULE.md)). AI 에이전트가 스케줄 트리거로 실행돼도 접두의 시간대는 워크스페이스 설정을 따른다.

### 시스템 프롬프트 조립 순서

시스템 프롬프트의 최종 본문은 다음 순서로 조립한다. 이 순서의 단일 기준은 이 절이다. 대화 스레드 주입의 책임은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md), 노드별 실행 단계는 각 노드 문서가 다룬다.

1. 시스템 컨텍스트 접두 (이 절)
2. 사용자 시스템 프롬프트
3. 지식 저장소 도구 안내 `KB_TOOL_GUIDANCE` (지식 저장소가 있을 때)
4. 조건 suffix (조건이 있을 때)
5. 메모리·스레드 주입 (안정 프리픽스)
    - 5a. 에이전트 메모리 회수 블록 (`memoryStrategy='persistent'` 일 때. `agent_memory` top-k 회수 결과)
    - 5b. 롤링 요약 블록 (`memoryStrategy ∈ {summary_buffer, persistent}` 일 때. `runningSummary`)
    - 5c. `manual` 스레드 주입 (`memoryStrategy='manual'`, `contextScope ≠ 'none'`, `contextInjectionMode='system_text'` 일 때만)
6. (휘발성 꼬리) 압축하지 않은 최근 원문 턴. 안정 프리픽스 1~5 보다 뒤에 둔다

- 5a·5b 는 안정 프리픽스다. 휘발성 최근 턴(6)보다 앞에 둔다. 요약·회수 블록은 임계치에 닿을 때만 갱신해 prompt cache 접두사 안정성을 지킨다. messages 모드에서는 최근 원문 턴(6)만 messages 배열 앞에 붙이고, 5a·5b 는 여전히 system_text 안정 프리픽스에 둔다.
- messages 모드의 `manual` 스레드 주입은 시스템 프롬프트가 아니라 messages 배열 앞에 붙이므로 5c 가 적용되지 않는다.
- `includeSystemContext: false` 면 1단계만 건너뛰고 나머지 순서는 유지한다.
- 1단계는 늘 맨 앞이다. 사용자 시스템 프롬프트가 시각 정보를 덮어쓰지 못하게 하기 위해서다. 시각을 다르게 넣고 싶으면 접두 뒤 본문에서 명시한다.
- 멀티턴 후속 턴에서도 접두는 시스템 프롬프트 앞에 유지한다. `$now` 가 실행 단위로 고정이라 턴마다 다시 계산해도 값이 같다.
- 현재 구현은 조건 suffix(4) 뒤에 표시 도구 안내 `PRESENTATION_TOOLS_GUIDANCE` 를 붙인다(표시 도구가 있을 때). 이 순서는 위 목록에 정식으로 올라 있지 않다.

### 토큰 비용

- 기본(`['time', 'timezone']`): 약 30토큰
- 전체(`['time', 'timezone', 'workspace', 'node']`): 약 60~80토큰
- `meta.inputTokens` 에 그대로 더한다. 별도 회계 필드는 없다.

### Cafe24 등 MCP 도구와의 관계

이 접두와 Cafe24 도구 description 자동 suffix([Cafe24 operation 메타데이터](CLE-C24-META))는 서로 보완한다.

- 시스템 프롬프트 접두: "어제 자정" 같은 일반 시각 추론의 기준
- 도구 description suffix: 특정 도구 인자(예: `since` 필드)가 어느 시간대인지

두 채널이 맞으면 LLM 은 `$now`(UTC), 접두(워크스페이스 시간대), Cafe24 도구(KST) 사이 변환을 정확히 한다. 한 채널만 있어도 동작은 하지만 두 채널을 함께 노출하는 편이 회귀 위험이 가장 작다.

### 설정 에코

두 필드(`includeSystemContext`·`systemContextSections`)는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 7 의 설정 에코 대상이다. 단 기본값과 같으면 뺀다. 사용자가 명시적으로 바꾼 경우에만 `config` 에 나온다. 각 노드의 출력 구조 표가 이를 따른다.

## AI 영역 기술 결정과 비기능 기준

AI 제품 정의에 있던 기술 결정과 비기능 요구사항이다. 항목마다 자세한 규칙은 소유 문서가 정한다.

| 항목 | 결정 | 근거 | 소유 문서 |
|------|------|------|-----------|
| 벡터 DB | pgvector (PostgreSQL 확장) | 기존 PostgreSQL 인프라를 쓰고 별도 서비스가 필요 없다 | [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) |
| 임베딩 처리 | BullMQ `document-embedding` 큐 | 처음 결정은 in-process 비동기였고 뒤에 큐로 바꿨다(Rationale) | [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) |
| 파일 저장소 | S3 호환 (AWS S3 / MinIO) | 기존 MinIO 인프라를 쓴다 | [파일 저장소](../CLE-PLAT/CLE-PLAT-STORAGE.md) |
| PDF 파싱 | pdf-parse | 가벼운 라이브러리이고 텍스트 추출에 충분하다 | [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) |
| API 키 암호화 | AES-256-GCM | 기존 encrypt·decrypt 유틸리티를 재사용한다 | [모델 설정](../CLE-AI/CLE-AI-MODELS.md) |

| ID | 요구사항 | 기준 | 소유 문서 |
|----|----------|------|-----------|
| NF-AI-01 | LLM API 호출 타임아웃 | 120초 (스트리밍 제외). 실제 정책과 어긋난다. [미결 사항](#미결-사항), [LLM 클라이언트 미결 사항](../CLE-AI/CLE-AI-LLM.md#미결-사항) 참조 | [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md), [AI 에이전트 노드](CLE-NODE-AGENT.md) |
| NF-AI-02 | 임베딩 처리 속도 | 100 청크/분 이상 | [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) |
| NF-AI-03 | RAG 검색 응답 시간 | 500ms 미만 (청크 1만 개 기준) | [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) |
| NF-AI-04 | API 키 저장 시 암호화 | AES-256-GCM 필수 | [모델 설정](../CLE-AI/CLE-AI-MODELS.md) |
| NF-AI-05 | 문서 업로드 크기 제한 | 파일당 50MB | [지식 저장소 관리](../CLE-KB/CLE-KB-MANAGE.md) |
| NF-AI-06 | 동시 임베딩 처리 | 최소 3건 병렬 | [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) |

LLM 프로바이더 관리 요구사항(LLM-01~07)은 [모델 설정](../CLE-AI/CLE-AI-MODELS.md), 지식 저장소 요구사항(KB-*)은 [지식 저장소 관리](../CLE-KB/CLE-KB-MANAGE.md), 워크플로우 AI 어시스턴트는 [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md) 가 정한다.

## 미결 사항

- **LLM 호출 전 지식 저장소 자동 검색(prefill) 여부**: AI 노드 문서와 [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) 의 검색 흐름 절은 지식 저장소 검색이 LLM 의 능동 호출(`kb_*` 도구)로만 일어나고 prefill 하지 않는다고 적는다. [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 의 관찰성 레인 정의와 [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) 의 `ragSources` 표시 절은 🔎 `rag` 행을 "엔진이 LLM 호출 전에 자동으로 한 검색" 으로 정의하고 LLM 이 부른 도구(`ai_tool`)와 인과가 다르다고 구분한다. 현재 구현은 검색 서비스를 지식 저장소 도구 경로와 디버그 컨트롤러에서만 부른다. 그래서 `rag` 행은 실제로는 LLM 도구 호출 결과를 "자동 검색" 으로 보여 준다. `rag` 행 정의를 "지식 저장소 도구 결과의 보조 표시" 로 고칠지, 자동 검색 기능을 새로 만들지 결정 필요.
- **인증 실패(401·403)의 재시도 가능 분류**: [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 과 [AI 에이전트 노드](CLE-NODE-AGENT.md)·[텍스트 분류기 노드](CLE-NODE-CLASSIFIER.md) 문서는 인증 실패를 `retryable: false` 로 정한다. [정보 추출기 노드](CLE-NODE-EXTRACTOR.md) 문서는 `LLM_CALL_FAILED` 면 무조건 `true` 로 고정한다. 코드도 갈린다. 정보 추출기 핸들러(`retryabilityDetails`)는 코드 기준이라 늘 `true` 이고, 텍스트 분류기 핸들러(`text-classifier.handler.ts` 234~241행)는 자기 문서와 달리 `LLM_CALL_FAILED` 를 늘 `true` 로 채운다. 같은 인증 실패에서 노드마다 [다시 시도] 버튼 노출이 달라진다. HTTP status 기준 분류로 통일할지, 정보 추출기의 코드 기준 예외를 규약에 적을지 결정 필요.
- **LLM 호출 타임아웃 기준**: NF-AI-01 은 LLM 호출 타임아웃을 120초(스트리밍 제외)로 요구한다. [AI 에이전트 노드](CLE-NODE-AGENT.md) 는 앱 레벨 기본값을 10분(`AI_AGENT_LLM_CALL_TIMEOUT_MS=600000`)으로 두고, 120초는 OpenAI·Anthropic·Azure·Local SDK 의 기본값일 뿐이라고 적는다. `LlmService` 는 `timeoutMs` 를 주지 않으면 앱 타임아웃이 없다. Google 처럼 SDK 기본값이 없는 프로바이더에서는 NF-AI-01 이 보장되지 않는다. 또 [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md) 는 NF-AI-01 을 근거로 스트리밍 턴에 120초와 `LLM_TIMEOUT` 을 약속하지만 NF-AI-01 은 스트리밍을 제외하고, [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) 는 타임아웃을 `LLM_TIMEOUT` 으로 매핑하지 않는다. 워크플로우 에디터 요구사항 ED-AI-32 도 NF-AI-01 을 "스트리밍 제외" 조건 없이 인용해 어시스턴트 단일 턴 타임아웃을 120초로 적는다. 어시스턴트는 스트리밍만 쓰므로 NF-AI-01 이 적용되는지부터 정해지지 않았다([워크플로우 AI 어시스턴트 미결 사항](../CLE-WF/CLE-WF-ASSIST.md#미결-사항), [LLM 클라이언트 미결 사항](../CLE-AI/CLE-AI-LLM.md#미결-사항)). NF-AI-01 을 호출 경로별 실제 정책으로 다시 적을지, 앱 레벨 기본값을 120초로 낮출지, 스트리밍에 타임아웃을 둘지 결정 필요.
- **자동 메모리 전략에서 opt-out 필드 노출**: 이 문서는 자동 전략에서 `excludeFromConversationThread` 가 유효하다고 정한다. 설정 화면은 자동 전략일 때 대화 맥락 필드 5개를 모두 숨긴다(`gateOnManualMemoryStrategy`). 원문 AI 에이전트 문서의 `memoryStrategy` 행과 원본 ND-AG-27 은 "`manual` 외 선택 시 5필드 무효" 라고 적었다. 자동 전략에서 opt-out 필드를 화면에 보일지 결정 필요.
- **에러 출력의 `meta` 필수 여부**: 토큰 회계 표는 `model`·토큰 필드를 필수로 둔다. 정보 추출기 에러는 `meta.model` 을 선택(호출이 일부라도 성공했을 때만)으로 두고 토큰을 생략한다. 텍스트 분류기 에러는 토큰을 `0` 으로 채운다. 텍스트 분류기는 `turnDebug` 대신 `meta.llmCalls` 평면 구조를 쓰는데 공통 규약에 없는 형태다. 에러 케이스 규칙(0 채움 여부)과 `llmCalls` 형태를 공통 규약에 적을지 결정 필요.
- **포트 type 표기**: [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md) 의 포트 정의 `type` enum 은 `data`·`control`·`error` 세 값이다. [정보 추출기 노드](CLE-NODE-EXTRACTOR.md) 는 시스템 포트에 `system` 을 쓴다. [AI 에이전트 노드](CLE-NODE-AGENT.md) 는 시스템 포트와 에러 포트를 `data` 로 적는다. [텍스트 분류기 노드](CLE-NODE-CLASSIFIER.md) 는 에러 포트를 `error` 로 적는다. 현재 프런트엔드 `resolve-dynamic-ports.ts` 는 `DynamicPortType` 에 `system` 을 두고 AI 에이전트 시스템 포트에도 `system` 을 쓴다. enum 에 `system` 을 더할지, 노드 포트 표를 어느 값으로 맞출지 결정 필요.
- **AI 에이전트 캔버스 요약의 표시 도구 세그먼트**: 원문 AI 에이전트 문서는 목표 형식에 표시 도구 수(`· {N} render`, 예: `Multi Turn · gpt-4o · 1 KB · 2 MCP · 2 cond · 3 render`)를 넣었다. 이 문서의 목표 형식에는 없다. 아직 구현 전이라 영향은 작다. 어느 쪽으로 맞출지 결정 필요.

## 구현 위치

- `codebase/backend/src/nodes/ai/shared/system-context-prefix.ts` (시스템 컨텍스트 접두)
- `codebase/backend/src/nodes/ai/shared/conversation-context-injection.ts` (대화 맥락 주입 공유 유틸)
- `codebase/backend/src/nodes/ai/shared/conversation-context-schema.ts` (대화 맥락 설정 공유 스키마 조각)
- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
- `codebase/backend/src/nodes/ai/text-classifier/text-classifier.handler.ts`
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts`
- `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` (`LlmCallRecord`·`TurnDebugEntry` 공통 타입)

## Rationale

### 시스템 컨텍스트 접두를 기본으로 켠 이유

**문제**: 세 AI 노드 어디에도 LLM 에게 지금 시각과 시간대를 자동으로 알려 주는 경로가 없었다. 사용자는 시스템 프롬프트에 `"오늘은 {{ $now }}"` 같은 표현식을 직접 넣어야 했다. 그마저 `$now` 가 UTC ISO8601 이라([실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md)) KST 사용자가 모르는 사이 9시간 어긋난 추론을 받을 수 있었다.

**결정**: 시스템 프롬프트 앞에 `Current time` 과 `Timezone` 을 자동으로 붙인다. 기본으로 켜고, 섹션 단위로 끌 수 있게 하고, 세 노드 공통 규약으로 둔다.

- 기본 섹션은 `['time', 'timezone']` 로 최소한만 넣는다. 워크스페이스·노드 정보는 디버깅 용도라 opt-in 이다.
- 시각 정보는 LLM 추론의 일반적인 접두 패턴이고 비용도 약 30토큰으로 작다. 그래서 opt-in 이 아니라 기본 켜짐으로 두어 시각 정보 누락 회귀가 쌓이지 않게 한다.
- suffix 가 아니라 prefix 인 이유는 사용자 시스템 프롬프트의 마지막 지시(`"답변은 JSON 으로"` 등)가 묻히지 않게 하기 위해서다.
- 노드별 필드가 아니라 공통 규약 한 곳에 정의한 이유는 세 노드가 같은 맥락을 필요로 해 정의가 어긋나는 것을 막기 위해서다.
- Cafe24 도구 description 자동 suffix([Cafe24 operation 메타데이터](CLE-C24-META))와 한 묶음으로 결정했다. 두 채널이 함께 노출돼야 LLM 이 `$now`(UTC), 접두(워크스페이스 시간대), Cafe24 도구(KST) 사이를 정확히 변환한다.
- 기존 워크플로우는 설정에 필드가 없으면 기본값으로 해석한다. DB 마이그레이션으로 `false` 를 박지 않고, 회귀가 걱정되는 워크플로우만 사용자가 알고 끈다.

### 대화 스레드를 1급 객체로 들이고 자동 주입한 이유

**문제**: AI 에이전트는 두 가지 맥락 격리에 갇혀 있었다.

1. Presentation 노드의 사용자 입력을 자동으로 알지 못했다. 사용자는 매번 `{{ $node["Form1"].output.interaction.data.email }}` 같은 식을 시스템 프롬프트에 직접 적어야 했다.
2. AI 에이전트 뒤에 또 AI 에이전트가 있으면 두 번째 노드가 첫 번째 노드의 멀티턴 messages 를 보지 못했다. `stripControlFields()` 가 `_resumeState` 를 지워 최종 응답 텍스트만 넘어갔다.

**결정**: 대화 스레드 모델을 1급 객체로 들인다. Presentation 입력과 AI 대화 턴을 한 스레드로 합치고, 노드 설정으로 자동 주입하며, messages·system_text 형식을 고르게 한다. 표현식 설탕(`$conversation`)이나 messages 노출 뒤 명시 주입하는 방식은 사용자가 매번 표현식으로 결합해야 하고, 텍스트로 요약하면 구조가 사라진다. 대화 스레드 모델은 실제 대화 흐름을 보존하고 자동으로 주입한다.

처음(v1) 경계는 단일 스레드, 문자 기반 길이 상한, 메모리 + NodeExecution 분산 저장(실행 내역) + `Execution.conversation_thread` durable park 스냅샷이었다. 자동 주입은 AI 에이전트만 했고 누적은 세 노드 모두 했다. 이후 텍스트 분류기와 정보 추출기 자동 주입이 채택돼 지금은 세 노드 모두 주입한다. 다중 스레드와 실행 내역 화면의 노드 간 스레드 뷰 재구성은 로드맵으로 남아 있다. 자세한 로드맵은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 에서 정한다.

### `conversationHistory` 필드를 지운 이유

옛 `conversationHistory: 'none' | 'last_n' | 'full'` 과 `historyCount` 필드는 스키마와 문서 표에 정의돼 있었지만 핸들러가 한 번도 읽지 않았다. 의도한 동작("이전 N개 대화 이력 보관")은 멀티턴 자체 messages 배열로 늘 누적됐으므로 사실상 아무 일도 하지 않았다. 대화 스레드를 들이면서 `contextScope`·`contextScopeN` 으로 완전히 바꿨고, 스키마·UI 메타·기본값 초기화 로직까지 모두 지웠다. 스키마가 `.passthrough()` 라 DB 의 옛 워크플로우 데이터에 두 키가 남아 있어도 조용히 통과한다.

### 메모리 전략을 `contextScope` 확장이 아니라 별도 필드로 둔 이유

**문제**: 자동 메모리(`summary_buffer`·`persistent`)를 들일 때 기존 `contextScope` enum 에 `auto` 값을 끼워 넣는 안이 자연스러워 보였다. 드롭다운 하나만 늘리면 되기 때문이다.

**결정**: 별도 1급 필드 `memoryStrategy` 를 둔다. `contextScope` 는 어느 범위의 스레드 턴을 넣을지(범위)이고, `memoryStrategy` 는 메모리를 어떻게 관리할지(관리)라 뜻이 다르다. enum 에 `auto` 를 섞으면 세 가지 문제가 생긴다. 한 필드에 두 뜻이 얽혀 설정 에코와 화면 `visibleWhen` 규칙이 서로 의존하게 된다. `auto` 일 때 `contextScopeN`·`contextInjectionMode`·`includeToolTurns` 의 뜻이 모호해진다. 하위 호환 에코가 복잡해진다. 별도 필드면 `manual`(기본) 경로가 기존 동작을 그대로 보존해 하위 호환 위험이 없고, 자동 전략은 직교 축으로 더해지며, `visibleWhen` 은 전략 값만 보면 된다. `manual` 이라는 단어가 `Trigger.type: 'manual'` 과 겉보기로 겹치지만 이름공간이 달라 뜻이 분명한 쪽을 택했다.

### 요약·회수 블록을 안정 프리픽스에 두는 순서

**문제**: 롤링 요약 블록과 에이전트 메모리 회수 블록을 LLM 입력 어디에 둘지 정해야 했다. messages 배열 안(휘발성 영역)과 시스템 프롬프트 안정 프리픽스 중 하나다.

**결정**: 둘 다 system_text 안정 프리픽스에 두고, 압축하지 않은 최근 원문 턴만 휘발성 꼬리로 둔다. prompt cache 는 접두사가 안정해야 맞는다. 매 턴 바뀌는 최근 원문이 앞에 오면 캐시가 매번 깨진다. 요약·회수 블록을 안정 프리픽스에 두고 임계치에 닿을 때만 갱신하면(매 턴 재요약·재회수 금지) 프리픽스가 오래 유지돼 캐시 적중이 가장 커진다. 원래 순서는 "접두 → 사용자 시스템 프롬프트 → 지식 저장소·조건 suffix → 스레드 주입" 이었다. 이 결정은 스레드 주입 단계 안에 "요약·회수 블록(안정) → 최근 원문 턴(휘발성)" 의 하위 순서를 더했다.

### 캔버스 요약의 `· {N} tools` 세그먼트 폐기

AI 에이전트 요약의 옛 `· {N} tools` 세그먼트는 도구 영역(Tool Area)을 제거하면서 폐기했다.

### 임베딩 처리를 in-process 에서 큐로 바꾼 이력

AI 제품 정의는 처음에 임베딩을 in-process 비동기로 처리하기로 했다(초기 단순화, 나중에 BullMQ 로 바꿀 수 있음). 지금은 BullMQ `document-embedding` 큐로 처리한다. 자세한 결정은 [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) 에 있다.
