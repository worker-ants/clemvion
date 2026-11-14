---
id: "CLE-NODE-AI-COMMON-OUTPUT"
title: "AI 노드 공통 — 출력 · 에러 · 토큰 회계"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-AI-COMMON"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-AI", "CLE-NODE-AI-COMMON"]
area: "CLE-NODE-AI"
content_hash: "5f644d111fdb8d6bf776ea588456b17e6e3d2e7ea34ae848c19f015ba223f8f1"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "b3da731660d9358c9e9c5f9b2097b0d8826fbd99e63a01c0f0f4744c12c872d9"
etag: "sha256-a77f687ef062d426771277713a6db3e9a92b4d62c07c4fdd0d8ac891e3ced643"
---
## 개요

이 문서는 [AI 노드 공통](CLE-NODE-AI-COMMON.md) 의 하위 문서로 세 AI 노드의 출력 묶음, 에러 계약, 토큰 회계, 진단 누적, 출력 구조 색인, 캔버스 요약 형식을 정한다.

## 출력 형태

AI 노드는 `output.result.*`·`output.error.*`·`output.interaction.*` 세 묶음을 함께 쓴다. 근거는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 Principle 1.1(설정·출력 직교), 3.2(에러 계약), 4.4~4.5(interaction 존재와 payload 형태), 8.2(result·category 1차 이름)다. Principle 11 은 출력 예시 문서화 서식 규칙이라 이 계약의 근거가 아니다.

| 묶음 | 용도 |
|------|------|
| `output.result.*` | 성공 시 도메인 결과(`extracted`, `response`, `category` 등) |
| `output.error.{code, message, details?}` | LLM 호출 실패, JSON 파싱 실패, 재시도 소진 등. `details.retryable: boolean` 필수, `details.retryAfterSec?: number` 선택 |
| `output.interaction.{type, data, receivedAt}` | 멀티턴 재개 직후 한 번 내는 사용자 입력 기록 |

멀티턴이 `max_retries` 같은 사유로 끝나면 후속 노드가 부분 결과를 쓸 수 있도록 `output.error` 와 `output.result` 를 함께 남긴다. 에러인지는 `output.error` 가 있는지로 판단한다.

## 에러 계약

- AI 노드의 `output.error.details` 에는 재시도 가능 여부(`retryable: boolean`)가 반드시 있다. `retryAfterSec` 은 `retryable === true` 일 때만 싣는다. 이 필드의 의미와 분류 원칙은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 에서 정한다.
- 에러 코드 등록은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 가 맡는다. 노드별 코드 표는 각 노드 문서에 있다.
- 인증 실패(HTTP 401·403)의 재시도 가능 분류와 에러 출력에 싣는 `meta` 는 노드마다 다르다. [미결 사항](CLE-NODE-AI-COMMON.md#미결-사항) 참조.

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
| `meta.thinkingTokens` | 선택 | 모델이 thinking 토큰을 보고할 때. AI 에이전트 단일 턴 예외는 아래 문단 |
| `meta.durationMs` | 필수 | 실행 소요 시간 |
| `meta.turnDebug` | 선택 | 턴별 LLM 호출 기록. `[{ turnIndex, llmCalls, totalDurationMs, toolCalls?, ragSources?, ragDiagnostics?, mcpDiagnostics? }, ...]` |

텍스트 분류기는 `turnDebug` 대신 평면 배열 `meta.llmCalls` 에 호출 기록을 싣는다. 에러 출력의 `meta` 규칙은 노드마다 다르다. [미결 사항](CLE-NODE-AI-COMMON.md#미결-사항) 참조.

AI 에이전트 단일 턴이 LLM 호출 단계까지 간 출력(정상 완료 `out`, 조건 분기 `<조건 id>`, LLM 호출 실패 `error`)은 `meta.inputTokens` · `meta.outputTokens` · `meta.totalTokens` · `meta.thinkingTokens` 네 값을 늘 싣는다. 보고가 없는 값은 구현이 `0` 으로 채워 출력 경로와 상관없이 같은 키를 싣는다. 그래서 단일 턴의 `thinkingTokens` 가 `0` 이면 모델이 0 을 보고했는지 보고하지 않았는지 가르지 않는다. 네 값은 그 턴에서 성공한 LLM 호출 usage 의 합이다. 도구 루프로 LLM 을 여러 번 부르면 앞선 호출도 모두 더한다. 정상 완료와 조건 분기는 마지막 호출까지 더한다. LLM 호출 실패는 실패 전에 성공한 호출만 더한다. 성공한 호출이 없으면 네 값은 모두 `0` 이다. 롤링 요약 호출의 사용량은 `meta` 토큰에 넣지 않는다. 그래서 롤링 요약 호출이 실패하거나 요약 모델 설정(`summaryModelConfigId`)을 조회하지 못해 나온 `error` 출력은 네 값을 싣되 모두 `0` 이다([AI 에이전트 노드 §출력 포트](CLE-NODE-AGENT.md#출력-포트)). 도구 정의 크기 예산 초과 에러(`TOOL_DEFINITION_PAYLOAD_EXCEEDED`)는 LLM 을 부르기 전에 끝나므로 토큰 필드 없이 `model` · `durationMs` 만 싣는다([미결 사항](CLE-NODE-AI-COMMON.md#미결-사항)).

이 절이 AI 에이전트 단일 턴 `meta` 토큰 기준의 정본이다. [AI 에이전트 노드](CLE-NODE-AGENT.md) 와 [AI 에이전트 노드 출력과 디버그](CLE-NODE-AGENT-OUTPUT.md) 는 링크와 한 줄 요약만 둔다.

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

## 출력 구조 색인

AI 노드는 정상·분기·에러·입력 대기·재개·종결로 출력 케이스가 가장 다양하다. 모든 케이스는 [출력 형태](#출력-형태) 절을 따른다.

| 노드 | 정상 | 분기 | 에러 | 입력 대기 / 재개 | 종결 |
|------|------|------|------|------------------|------|
| [AI 에이전트 단일 턴](CLE-NODE-AGENT-OUTPUT.md) | `out` | `<조건 id>` | `error` | 없음 | 없음 |
| [AI 에이전트 멀티턴](CLE-NODE-AGENT-OUTPUT.md) | 없음 | `<조건 id>` | `error` | `waiting_for_input` / `resumed`(일시) | `user_ended` / `max_turns` |
| [텍스트 분류기](CLE-NODE-CLASSIFIER.md) | 단일 레이블 `<카테고리 포트>` 또는 `fallback` | 다중 레이블 포트 배열(fan-out) 또는 `fallback` | `error` | 없음 | 없음 |
| [정보 추출기 단일 턴](CLE-NODE-EXTRACTOR.md) | `out` | 없음 | `error` | 없음 | 없음 |
| [정보 추출기 멀티턴](CLE-NODE-EXTRACTOR.md) | 없음 | 없음 | `error` | `waiting_for_input` / `resumed`(일시) | `completed` / `user_ended` / `max_turns` / `max_retries`(`error` 포트) |

## 캔버스 요약

> 구현 현황: 캔버스 요약은 `getConfigSummary`(`node-config-summary.ts`)가 노드 메타데이터의 `summaryTemplate`(mustache)을 렌더해 만든다. 지금은 텍스트 분류기만 `summaryTemplate` 을 갖는다. AI 에이전트와 정보 추출기는 요약이 표시되지 않는다(미구현). 아래 두 노드의 형식은 목표 계약이다. 조건부 세그먼트(`· {N} KB` 등)와 `Multi Turn` 접두어 조합은 현재 `summaryTemplate` DSL 로 표현할 수 없어, 전용 요약 빌더나 DSL 확장을 후속으로 남긴다.

| 노드 | 요약 형식 | 예시 |
|------|-----------|------|
| AI 에이전트 | 미구현. 목표는 `{mode} · {model}`. 지식 저장소를 연결하면 `· {N} KB`, MCP 지원 통합이 있으면 `· {N} MCP`, 조건이 있으면 `· {N} cond` 를 덧붙인다. 멀티턴이면 `Multi Turn` 을 표기한다. MCP 수는 외부 MCP 서버와 내부 브리지 통합을 합산한다 | (목표) `gpt-4o · 1 KB · 1 MCP · 3 cond` (단일 턴), `Multi Turn · gpt-4o · 1 KB · 2 MCP · 2 cond` (멀티턴) |
| 텍스트 분류기 | 구현됨(`summaryTemplate`). `{model} · {N} categories` | `gpt-4o-mini · 3 categories` |
| 정보 추출기 | 미구현. 목표는 `{model} · {N} fields`(출력 스키마 필드 수). 멀티턴이면 앞에 `Multi Turn` 을 붙인다 | (목표) `claude-sonnet · 4 fields`, `Multi Turn · claude-sonnet · 4 fields` |

MCP 수를 합산하는 이유는 사용자 입장에서 외부 MCP 서버와 내부 브리지가 모두 "AI 가 부르는 외부 도구 출처" 이기 때문이다. AI 에이전트 요약에 표시 도구 수 세그먼트를 넣을지는 [미결 사항](CLE-NODE-AI-COMMON.md#미결-사항) 참조.

## 구현 위치

- `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` (`LlmCallRecord`·`TurnDebugEntry` 공통 타입)

## Rationale

### 캔버스 요약의 `· {N} tools` 세그먼트 폐기

AI 에이전트 요약의 옛 `· {N} tools` 세그먼트는 도구 영역(Tool Area)을 제거하면서 폐기했다.

### 단일 턴 토큰 기준의 정본을 이 문서에 둔다 (2026-11-05)

AI 에이전트 단일 턴 `meta` 토큰 기준을 [AI 에이전트 노드](CLE-NODE-AGENT.md) · [AI 에이전트 노드 출력과 디버그](CLE-NODE-AGENT-OUTPUT.md) · [AI 노드 공통](CLE-NODE-AI-COMMON.md) 이 따로 적고 있었다. 정본을 [토큰 회계](#토큰-회계) 한 곳으로 정하고 두 문서는 링크와 한 줄 요약만 둔다. 반대로 롤링 요약 · 요약 모델 설정 조회 실패의 처리는 AI 에이전트 노드 문서가 정하고 [LLM 호출 경로별 타임아웃](CLE-NODE-AI-COMMON.md#llm-호출-경로별-타임아웃) 표는 결과만 적는다.

### 단일 턴 토큰을 성공한 호출의 합으로 맞춘다 (2026-11-12)

AI 에이전트 단일 턴의 정상 완료와 조건 분기는 마지막 LLM 호출 하나의 usage 만 `meta` 토큰에 실었다. LLM 호출 실패는 실패 전에 성공한 호출의 합을 실었다. 그래서 도구 루프로 LLM 을 여러 번 부르면 정상 완료 값이 실제 사용량보다 작았고 같은 노드의 출력끼리 기준이 달랐다. 세 출력 모두 성공한 호출의 합으로 맞췄다.

- 기각: 실패 출력도 마지막 호출 하나로 맞추는 안. 실패 전에 성공한 호출의 비용을 버리게 되어 [AI 에이전트 노드](CLE-NODE-AGENT.md) Rationale 의 «부분 결과를 `meta` 에 남긴다» 결정과 어긋난다.
- 기각: 정상 완료를 그대로 두고 차이를 문서로만 알리는 안. 사용자는 `meta` 토큰을 노드의 사용량으로 읽고 실행 결과의 LLM 사용량 탭도 이 값을 먼저 보여 준다. 과소 집계가 그대로 남는다.
- 사용량 통계와 비용 집계는 호출마다 남기는 LLM 사용 기록을 쓰므로 이 변경과 관계없다.
