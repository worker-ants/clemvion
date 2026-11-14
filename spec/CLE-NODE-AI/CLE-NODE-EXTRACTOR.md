---
id: "CLE-NODE-EXTRACTOR"
title: "정보 추출기 노드"
type: "feature"
version: 5
status: "approved"
requirements: ["REQ-EXTRACT-001", "REQ-EXTRACT-002", "REQ-EXTRACT-003", "REQ-EXTRACT-004", "REQ-EXTRACT-005", "REQ-EXTRACT-006", "REQ-EXTRACT-007", "REQ-EXTRACT-008", "REQ-EXTRACT-009", "REQ-EXTRACT-010", "REQ-EXTRACT-011", "REQ-EXTRACT-012", "REQ-EXTRACT-013", "REQ-EXTRACT-014", "REQ-EXTRACT-015", "REQ-EXTRACT-016", "REQ-EXTRACT-017", "REQ-EXTRACT-018", "REQ-EXTRACT-019", "REQ-EXTRACT-020", "REQ-EXTRACT-021", "REQ-EXTRACT-022", "REQ-EXTRACT-023", "REQ-EXTRACT-024", "REQ-EXTRACT-025", "REQ-EXTRACT-026", "REQ-EXTRACT-027", "REQ-EXTRACT-028", "REQ-EXTRACT-029", "REQ-EXTRACT-030"]
basis_superseded: false
parent: "CLE-NODE-AI"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-AI"]
area: "CLE-NODE-AI"
content_hash: "df0cc624d2752cddf4ecd45190bbf62b989cd64368f73e5cddf954eb773c50c4"
read_as: "approved_fallback"
task: "CLE-T-0VS826"
source_paths: ["spec/4-nodes/3-ai/3-information-extractor.md", "spec/4-nodes/3-ai/_product-overview.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "be3067647870e0f92bc47bc212adef7a50e7bfdb33eda44efb725d7bb9daf07b"
etag: "sha256-371016ce7ebbb5c9a538ca17d4cb4f6b6258dafecb43a685646c4588b2d80786"
---
> 구현 상태: 부분 구현 · 원문: `spec/4-nodes/3-ai/3-information-extractor.md`, `spec/4-nodes/3-ai/_product-overview.md` (§3.4), `spec/4-nodes/_product-overview.md` (§6.3) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

정보 추출기 노드(Information Extractor, `information_extractor`)는 LLM 으로 비정형 텍스트에서 출력 스키마(`outputSchema`)에 정의한 구조화 필드를 뽑는다. 캔버스 표시 이름은 "Info Extractor" 다. 단일 턴(`single_turn`)은 LLM 을 한 번 불러 JSON 응답을 받는다. 멀티턴(`multi_turn`)은 워크플로우 실행을 멈추고 사용자와 대화해 부족한 필드를 채우며, LLM 이 `finalize_extraction` 도구를 부르면 끝난다.

이 문서는 설정, 설정 화면, 실행 전 검증, 포트, 이 노드의 캔버스 요약 목표 문자열을 정한다. 실행 로직 · 에이전트 메모리 사용은 [실행 로직과 메모리](CLE-NODE-EXTRACTOR-EXEC.md), 출력 구조 · 에러 코드는 [출력 구조와 에러](CLE-NODE-EXTRACTOR-OUTPUT.md) 하위 문서가 정한다. 모델 선택, 멀티턴 차단 모드의 공통 동작, 출력 묶음(`output.result`·`output.error`·`output.interaction`), 대화 맥락 설정, 메모리 전략, 시스템 컨텍스트 접두, 캔버스 요약 형식은 [AI 노드 공통](CLE-NODE-AI-COMMON.md) 을 따른다. 에이전트 메모리 저장소·범위 키·추출·회수는 [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md), 입력 대기·재개 상태 전이는 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 가 정한다. 노드 취소 신호를 받았을 때의 동작은 [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md) 규약을 따른다.

## 요구사항

- REQ-EXTRACT-001 WHEN 노드가 실행되면 THE SYSTEM SHALL LLM 으로 비정형 텍스트에서 구조화된 정보를 추출한다. (원본: ND-IE-01)
- REQ-EXTRACT-002 WHEN 사용자가 추출 필드를 정의하면 THE SYSTEM SHALL 필드마다 이름·타입·설명을 받는다. (원본: ND-IE-02)
- REQ-EXTRACT-003 WHEN 출력 스키마를 정의하면 THE SYSTEM SHALL 필드 정의를 JSON Schema 로 바꿔 LLM 에 넘긴다. (원본: ND-IE-03)
- REQ-EXTRACT-004 WHEN 추출이 끝나면 THE SYSTEM SHALL 결과를 출력 스키마의 모든 필드를 담은 객체로 돌려주고 미수집 필드는 `null` 로 둔다. (원본: ND-IE-04)
- REQ-EXTRACT-005 WHEN 사용자가 모델을 고르면 THE SYSTEM SHALL 그 모델로 추출한다. (원본: ND-IE-05)
- REQ-EXTRACT-006 WHEN 사용자가 예시 입력·출력을 넣으면 THE SYSTEM SHALL few-shot 예시로 시스템 프롬프트에 넣는다. (원본: ND-IE-06)
- REQ-EXTRACT-007 WHEN 단일 턴이면 THE SYSTEM SHALL `inputField` 값을 사용자 메시지로 해 JSON 응답 형식으로 LLM 을 한 번 부른다.
- REQ-EXTRACT-008 IF 단일 턴 JSON 파싱에 실패하면 THE SYSTEM SHALL 최대 2번 다시 시도하고, 모두 실패하면 `LLM_RESPONSE_INVALID` 로 `error` 포트에 보낸다.
- REQ-EXTRACT-009 IF LLM 호출이 노드 취소가 아닌 예외를 던지면 THE SYSTEM SHALL `LLM_CALL_FAILED` 로 `error` 포트에 보낸다. 노드 취소로 끝난 호출은 REQ-EXTRACT-030 을 따른다.
- REQ-EXTRACT-010 WHEN 멀티턴이면 THE SYSTEM SHALL `finalize_extraction` 도구를 LLM 에 노출한다.
- REQ-EXTRACT-011 IF 멀티턴 첫 진입에서 `inputField` 가 비었으면 THE SYSTEM SHALL LLM 을 부르지 않고 `turnCount: 0` 으로 입력 대기에 들어간다.
- REQ-EXTRACT-012 WHEN LLM 이 `finalize_extraction` 을 부르면 THE SYSTEM SHALL 인자를 부분 결과에 병합하고 `null`·`undefined` 값은 기존 값을 유지한다.
- REQ-EXTRACT-013 IF `finalize_extraction` 호출 뒤에도 필수 필드가 비어 있으면 THE SYSTEM SHALL 누락 필드를 알리고 같은 턴에서 LLM 을 다시 부른다.
- REQ-EXTRACT-014 IF 수집 재시도 횟수가 `maxCollectionRetries`(0 이 아닐 때)를 넘으면 THE SYSTEM SHALL `MAX_COLLECTION_RETRIES_EXCEEDED` 로 `error` 포트에 보내고 부분 결과를 함께 싣는다.
- REQ-EXTRACT-015 WHEN 모든 필수 필드가 채워지면 THE SYSTEM SHALL `completed` 포트로 보낸다.
- REQ-EXTRACT-016 WHEN 멀티턴 턴 수가 `maxTurns`(0 보다 클 때)에 닿으면 THE SYSTEM SHALL `max_turns` 포트로 보낸다.
- REQ-EXTRACT-017 WHEN 사용자가 `execution.end_conversation` 을 보내면 THE SYSTEM SHALL 수집한 만큼의 결과로 `user_ended` 포트에 보낸다.
- REQ-EXTRACT-018 WHILE 멀티턴 사용자 응답을 기다리는 동안 THE SYSTEM SHALL 타임아웃 없이 기다린다.
- REQ-EXTRACT-019 WHEN LLM 이 도구 호출 없이 텍스트만 돌려주면 THE SYSTEM SHALL 후속 질문으로 보고 입력 대기에 들어간다.
- REQ-EXTRACT-020 WHEN 멀티턴 대화가 `completed`·`max_turns`·`user_ended` 로 끝나면 THE SYSTEM SHALL 최종 추출 스냅샷을 `ai_assistant` 턴으로 대화 스레드에 한 번 누적한다.
- REQ-EXTRACT-021 IF 멀티턴이 LLM 호출 실패(`error`)로 끝나면 THE SYSTEM SHALL 대화 스레드에 누적하지 않는다. 노드 취소로 끝난 멀티턴은 REQ-EXTRACT-030 을 따른다.
- REQ-EXTRACT-022 WHEN 사용자 메시지를 받아 멀티턴을 재개하면 THE SYSTEM SHALL 다음 턴 LLM 호출 전에 `status: 'resumed'` 스냅샷을 한 번 낸다.
- REQ-EXTRACT-023 WHEN `memoryStrategy` 가 `persistent` 면 THE SYSTEM SHALL 추출 LLM 호출 전에 에이전트 메모리를 한 번 회수해 시스템 메시지 뒤 안정 프리픽스에 넣는다.
- REQ-EXTRACT-024 WHEN `memoryStrategy` 가 `persistent` 이고 대화 스레드에 결과를 누적하면 THE SYSTEM SHALL 메모리 추출을 비동기로 넣는다.
- REQ-EXTRACT-025 WHILE `memoryStrategy` 가 `manual` 인 동안 THE SYSTEM SHALL 메모리 회수·추출을 부르지 않고 기존 동작과 같은 messages 와 출력을 낸다.
- REQ-EXTRACT-026 IF 메모리 회수에 실패하면 THE SYSTEM SHALL 빈 회수로 보고 추출을 계속한다.
- REQ-EXTRACT-027 WHEN `contextScope` 가 `none` 이 아니고 메모리 전략이 `manual` 이면 THE SYSTEM SHALL 단일 턴은 LLM 호출 직전, 멀티턴은 첫 진입 때 한 번 대화 스레드를 주입한다.
- REQ-EXTRACT-028 IF 출력 스키마가 비었거나 단일 턴인데 `inputField` 가 비었거나 모델이 설정되지 않았으면 THE SYSTEM SHALL 캔버스 경고를 낸다.
- REQ-EXTRACT-029 WHEN `mode` 를 바꾸면 THE SYSTEM SHALL 출력 포트를 모드에 맞게 다시 계산한다.
- REQ-EXTRACT-030 IF 노드 취소 신호(`context.abortSignal`)가 켜진 뒤 LLM 호출이 실패하면 THE SYSTEM SHALL `error` 포트로 보내지 않고 `AbortError` 로 엔진에 다시 던지고 멀티턴에서도 부분 결과(`output.result`)·대화 스레드 누적·메모리 추출을 만들지 않는다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md#노드-핸들러-의무) 규칙 3).

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `llmConfigId` | UUID? | | 없음 | 모델 설정 참조([AI 노드 공통](CLE-NODE-AI-COMMON.md)) |
| `model` | String? | | 모델 설정 기본값 | 모델 ID |
| `inputField` | 표현식? | 단일 턴 필수 | 없음 | 추출 대상 텍스트. 단일 턴이면 warningRule 이 강제한다. 멀티턴에서 비어 있으면 첫 LLM 호출을 건너뛰고 바로 사용자 입력을 기다린다 |
| `outputSchema` | FieldDef[] | ✓ | `[]` | 추출할 필드 정의. 비면 warningRule 이 발화한다 |
| `examples` | ExampleDef[] | | `[]` | few-shot 예시 |
| `instructions` | String? | | `''` | 추가 추출 지시(시스템 프롬프트에 넣음) |
| `mode` | `single_turn` / `multi_turn` | ✓ | `single_turn` | AI 실행 모드. 멀티턴 차단 동작은 [AI 노드 공통](CLE-NODE-AI-COMMON.md) |
| `maxTurns` | Integer? | | `10` | 멀티턴 최대 턴 수. `0` 은 무제한 |
| `maxCollectionRetries` | Integer? | | `3` | 수집 재시도. 멀티턴에서 LLM 이 `finalize_extraction` 을 불렀는데 필수 필드가 비었을 때 다시 묻는 횟수. `0` 은 무제한. 넘으면 `error` 포트와 `MAX_COLLECTION_RETRIES_EXCEEDED` |
| `memoryStrategy` | `manual` / `persistent` | | `manual` | 메모리 전략. `manual` 은 대화 맥락 설정을 그대로 쓴다. `persistent` 는 추출 LLM 호출 전 에이전트 메모리 회수와 턴 경계 비동기 추출을 한다. `summary_buffer` 값은 없다 |
| `memoryKey` | 표현식? | | 없음 | 메모리 범위 키. 같은 키는 실행을 넘어 같은 기억을 회수한다. 비우면 `executionId` 로 격리. AI 에이전트와 같은 범위 키 규칙([에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md)). `persistent` 일 때만 보인다 |
| `memoryTopK` | Integer? | | `5` | 회수 top-k(지식 저장소 Top-K 와 독립). `persistent` 일 때 보인다 |
| `memoryThreshold` | Float? | | `0.7` | 회수 최소 유사도(0~1, 지식 저장소 임계값과 독립). `persistent` 일 때 보인다 |
| `memoryTtlDays` | Integer? | | 없음 | 메모리 만료(일). 비우면 만료 없음. `persistent` 일 때 보인다 |
| `embeddingModelConfigId` | 모델 설정 선택? | | 없음 | 회수·추출 임베딩 설정 id. 범위 메모리와 차원이 맞아야 한다. `embedding-config-selector` 로 고르며 노드 `llmConfigId` 와 독립이다. 비우면 워크스페이스 기본 embedding 설정(`resolveEmbedding`). `persistent` 일 때 보인다. 메모리 임베딩 설정 출처는 문서마다 정의가 갈린다([에이전트 메모리 미결 사항](../CLE-AI/CLE-AI-MEMORY.md#미결-사항)) |
| `extractionModelConfigId` | 모델 설정 선택? | | 없음 | 메모리 추출 LLM 호출 전용 chat 설정 id. `chat-config-selector` 로 고르며 main LLM 과 독립이다. 비우면 노드 `llmConfigId` → 기본 모델. `persistent` 일 때 보인다 |
| `contextScope` | `none` / `thread` / `lastN` | | `none` | 대화 맥락 설정 범위. `manual` 일 때만 적용한다(`persistent` 면 숨김) |
| `contextScopeN` | Integer? | `lastN` 일 때 | `20` | 최근 N개 턴 |
| `contextInjectionMode` | `messages` / `system_text` | 범위가 `none` 이 아닐 때 | `messages` | 주입 형식 |
| `includeToolTurns` | Boolean? | | `false` | `ai_tool` 턴 누적 여부. `finalize_extraction` 도구 턴은 누적 대상이 아니며 주입 인터페이스를 맞추려고 둔다 |
| `excludeFromConversationThread` | Boolean? | | `false` | 이 노드 턴을 스레드에서 뺀다(opt-out) |
| `includeSystemContext` | Boolean? | | `true` | 시스템 컨텍스트 접두 |
| `systemContextSections` | String[]? | | `['time', 'timezone']` | 접두 섹션 |

- 설정 스키마의 단일 기준은 `information-extractor.schema.ts` 의 `informationExtractorNodeConfigSchema` 다.
- 노드 설정에는 temperature · max_tokens 가 없다. 노드의 LLM 호출(`traceChat`)은 모델 설정의 기본 파라미터를 쓰고, 모델 설정에도 값이 없으면 보내지 않는다. 에이전트 메모리 추출 호출에는 채우지 않는다. 규칙은 [LLM 서비스 「모델 설정 기본 파라미터 채우기」](../CLE-AI/CLE-AI-LLM-SERVICE.md#모델-설정-기본-파라미터-채우기), 기본값은 [모델 설정 「기본 파라미터 기본값」](../CLE-AI/CLE-AI-MODELS.md#기본-파라미터-기본값) 이 정한다.
- 대화 맥락 설정은 AI 에이전트와 같은 인터페이스다(`buildConversationContextSchemaFields()`, `injectConversationContext()`). 주입 시점은 [실행 로직과 메모리](CLE-NODE-EXTRACTOR-EXEC.md) 가 정한다(멀티턴은 `executeMultiTurn` 에서 초기 messages 를 만든 직후 한 번). `memoryStrategy = manual` 일 때만 적용하고, `persistent` 면 설정 화면에서 대화 맥락 필드를 숨기고 에이전트 메모리가 맥락을 맡는다(AI 에이전트의 `gateOnManualMemoryStrategy` 와 같음). 기본값이 `manual` + `none` 이라 기존 워크플로우 동작은 그대로다.

**FieldDef 구조** (`outputSchema[i]`)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `name` | String | ✓ | | 필드 이름(LLM 응답 JSON 의 키) |
| `type` | `string` / `number` / `boolean` / `array` / `object` | ✓ | | 필드 타입. JSON Schema 로 바꿔 LLM 에 넘긴다 |
| `description` | String | ✓ | | LLM 에 주는 필드 설명 |
| `required` | Boolean | | `true` | 필수 여부. 멀티턴에서 `false` 인 필드는 비어도 끝낼 수 있다 |
| `enumValues` | String[]? | | | 허용 값 목록. JSON Schema `enum` 으로 바꾼다(null 허용) |

**ExampleDef 구조** (`examples[i]`)

| 필드 | 타입 | 설명 |
|------|------|------|
| `input` | String | 예시 입력 텍스트 |
| `output` | Object | 예시 추출 결과(스키마와 같은 키 구성) |

## 설정 화면

| 영역 | 들어가는 요소 | 동작 |
|------|---------------|------|
| 모델 (맨 위) | "LLM Provider", "Model" 드롭다운 | 프로바이더를 고르면 모델 목록이 바뀐다 |
| 입력 | "Input Field"(예: `{{ $input.emailBody }}`) | 단일 턴일 때만 보인다 |
| 출력 스키마 | 필드 목록(이름·타입·필수 여부·설명·허용 값), "Add Field" 버튼 | 예: `senderName` String 필수 "발신자 이름", `amount` Number 선택 "관련 금액" |
| 예시 | "Add Example" 버튼 | few-shot |
| 지시 | "Instructions" 입력 | |
| 실행 모드 | "Single Turn" / "Multi Turn" 라디오 | |
| 멀티턴 설정 (맨 아래) | "Max Turns", "Max Collection Retries" | 멀티턴일 때만 보인다 |

## 실행 전 검증

[노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 3.1 에 따라 예외를 던진다.

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `model` 과 `llmConfigId` 가 모두 없음 | `LLM provider or model must be selected (auto-handled by the canvas when a workspace default provider is configured).` (`AI_NO_LLM_PROVIDER_MESSAGE`, `codebase/backend/src/nodes/ai/llm-provider-rule.ts`) | warningRule(캔버스 배지) + handler.validate |
| `outputSchema` 가 빈 배열 | `At least one extraction field must be defined.` | warningRule + handler.validate |
| 단일 턴인데 `inputField` 가 비었음 | `In Single Turn mode, Input Field must be entered.` | warningRule(캔버스 배지) |
| `outputSchema[i].name`·`outputSchema[i].type` 이 없음 | `Field {i+1}: name is required` / `type is required` | handler.validate |
| 멀티턴인데 `maxTurns` 가 음수이거나 숫자가 아님 | `maxTurns must be 0 (unlimited) or a positive integer` | handler.validate |

## 포트

### 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 추출 대상 데이터(`inputField` 표현식의 평가 컨텍스트) |

### 출력 포트 (모드에 따라 동적)

`isDynamicPorts: true`, `dynamicPorts.kind: 'info-extractor-mode'`. 프런트엔드 `resolveDynamicPorts` 가 `config.mode` 를 보고 포트 세트를 만든다.

**단일 턴**

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `out` | Output | system | true (모드에서 유도) | 추출 성공(`resolveDynamicPorts` 가 `system` 으로 발행) |
| `error` | Error | error | true (모드에서 유도) | LLM 호출 실패, JSON 파싱 재시도 소진. 노드 취소는 이 포트로 보내지 않는다 |

**멀티턴**

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `completed` | Completed | system | true (모드에서 유도) | 필수 필드를 모두 채워 자연 완료 |
| `user_ended` | User Ended | system | true (모드에서 유도) | 사용자가 `execution.end_conversation` 으로 종료 |
| `max_turns` | Max Turns | system | true (모드에서 유도) | `turnCount >= maxTurns` (`maxTurns > 0` 일 때) |
| `error` | Error | error | true (모드에서 유도) | LLM 호출 실패 또는 `MAX_COLLECTION_RETRIES_EXCEEDED`. 노드 취소는 이 포트로 보내지 않는다 |

- 모드를 바꾸면 동적 출력 포트를 바로 다시 계산한다.
- 사용자가 정의한 추출 필드는 포트가 아니라 결과 객체의 키가 된다.
- `out`·`completed`·`user_ended`·`max_turns`·`error` 는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 6 의 시스템 포트 예약어라 사용자가 같은 ID 를 쓸 수 없다.
- 포트 `type` 값 `system` 은 포트 정의 enum 에 없는 값이라 정의가 갈린다([AI 노드 공통](CLE-NODE-AI-COMMON.md) 미결 사항).

## 하위 문서

- [정보 추출기 노드 — 실행 로직과 메모리](CLE-NODE-EXTRACTOR-EXEC.md): 단일 턴 · 멀티턴 실행 흐름, 노드 취소 신호 처리, 에이전트 메모리 회수 · 추출. 요구사항 REQ-EXTRACT-001, 003, 006, 007, 008, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020, 021, 023, 024, 025, 026, 027, 030.
- [정보 추출기 노드 — 출력 구조와 에러](CLE-NODE-EXTRACTOR-OUTPUT.md): 설정 에코, 케이스별 출력(단일 턴 · 에러 · 입력 대기 · 재개 · 종결 4종), 에러 코드. 요구사항 REQ-EXTRACT-004, 008, 009, 014, 015, 016, 017, 022, 030.

## 캔버스 요약

형식은 [AI 노드 공통](CLE-NODE-AI-COMMON.md) 의 캔버스 요약 절이 정한다. 목표는 `{model} · {N} fields`(출력 스키마 필드 수)이고 멀티턴이면 앞에 `Multi Turn` 을 붙인다(예: `claude-sonnet-4-6 · 4 fields`, `Multi Turn · claude-sonnet-4-6 · 4 fields`). `summaryTemplate` 이 없어 지금은 표시되지 않는다(미구현).

## 미결 사항

- **설정 에코의 출력 스키마 키**: [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 7 은 설정 에코가 원본 필드명을 그대로 쓴다고 정한다. 이 노드는 `outputSchema` 를 `schema` 로 에코한다. 원문은 이를 알려진 결함(W-1)으로 적고, 문서 약 15곳과 표현식 예시에 걸쳐 있어 일괄 이름 변경을 뒤로 미뤘다. 표현식 작성자는 설정 화면과 다른 키를 써야 한다. 이름을 바꿀지(하위 호환 영향 있음), 이 노드를 Principle 7 예외로 등재할지 결정 필요.
- **재시도 가능 에러와 마지막 턴 재시도**: [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 은 `retryable=true` 면 화면이 [다시 시도] 버튼을 보인다고 정한다. 이 노드는 멀티턴 LLM 실패를 `retryable=true` 로 내지만 `_retryState` 를 만들지 않는다(현재 핸들러 주석: 정보 추출기는 `execution.retry_last_turn` 미지원). 현재 화면은 노드 유형으로 버튼을 막는다. 실시간 `system_error` 는 노드 유형이 `ai_agent` 이고 store 에 대화가 있을 때만 만든다(`use-execution-events.ts` 의 `isMultiTurnAiContext`). 내역 화면이 `output.error` 로 합성한 항목에는 `nodeExecutionId` 가 없어 버튼을 숨긴다. 그래서 정보 추출기에는 버튼이 보이지 않는다. 게이트 조건은 [대화 미리보기 §다시 시도 버튼 조건](../CLE-EXEC/CLE-EXEC-PREVIEW.md#다시-시도-버튼-조건) 이 정한다. 게이트가 없으면 버튼을 눌러도 `RETRY_STATE_NOT_FOUND` 가 난다. 이 노드에 마지막 턴 재시도를 들일지, `retryable=true` 인데 버튼이 없는 지금 상태를 규약의 예외로 적을지 결정 필요. 같은 문제가 [노드 출력 규약 미결 사항](../CLE-NODE/CLE-NODE-OUTPUT.md#미결-사항) 의 인증 실패 재시도 분류 항목에도 올라 있다.
- **인증 실패(401·403)의 재시도 가능 분류**: 이 노드는 `LLM_CALL_FAILED` 면 늘 `retryable: true` 로 고정한다. AI 에이전트·텍스트 분류기 문서와 규약은 `false` 로 정한다. [AI 노드 공통](CLE-NODE-AI-COMMON.md) 미결 사항 참조.

## 구현 위치

- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` (`buildMultiTurnSystemPrompt`, `buildFinalizationTool`, `buildErrorOutput`)
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.schema.ts` (`informationExtractorNodeConfigSchema`)
- `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts`
- `codebase/backend/src/nodes/ai/shared/agent-memory-schema.ts`
- `codebase/backend/src/nodes/ai/shared/llm-cancellation.ts` (`rethrowIfNodeCancelled`, 노드 취소 판정)
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` (멀티턴 재개 스냅샷 싣기 · 저장)
- `codebase/backend/src/modules/execution-engine/ai-conversation-helpers.ts` (`buildAiResumedSnapshot`)

## Rationale

이 노드의 결정 근거는 하위 문서의 Rationale 에 있다. 실행 · 노드 취소 · 메모리 결정은 [실행 로직과 메모리](CLE-NODE-EXTRACTOR-EXEC.md#rationale), 출력 형태 결정은 [출력 구조와 에러](CLE-NODE-EXTRACTOR-OUTPUT.md#rationale) 를 본다.

### 노드 취소는 `error` 포트로 보내지 않는다 (2026-10-31)

이 결정의 본문은 [실행 로직과 메모리 §노드 취소는 error 포트로 보내지 않는다](CLE-NODE-EXTRACTOR-EXEC.md#노드-취소는-error-포트로-보내지-않는다-2026-10-31) 로 옮겼다.
