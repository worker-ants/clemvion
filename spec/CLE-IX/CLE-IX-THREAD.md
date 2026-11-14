---
id: "CLE-IX-THREAD"
title: "대화 스레드"
type: "convention"
version: 5
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-IX"
ancestors: ["CLE-VISION", "CLE-IX"]
area: "CLE-IX"
content_hash: "2282692221877610ec4965ae39fbab1db6ce93fc56f77b121eb6444561e85ac1"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/conventions/conversation-thread.md"]
mirror_sha256: "0e5b082952fe10ac54a767d753c4dc22dd9a8d9d017ff131661b7a3227108edc"
etag: "sha256-986763be1489f4b8ffbf2763f0c5727a935c610d332cdc5a445e133a26621d87"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/conversation-thread.md` (§1~§8, 1–467행. §9 미리보기 렌더 규칙과 §8.1·§8.2·§8.5 근거는 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 에 있다) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

대화 스레드(ConversationThread)는 워크플로우 실행 하나 동안 생긴 사용자 인터랙션과 AI 대화를 시간순으로 쌓는 일급 컨텍스트다. AI 카테고리 세 노드(`ai_agent`·`text_classifier`·`information_extractor`)는 노드 설정의 대화 맥락 설정(`contextScope`)으로 이 스레드를 LLM 입력에 자동으로 받는다.

이 문서는 대화 스레드 규약의 입구다. 공통 규칙과 자료구조(대화 기록 항목과 항목 출처)를 여기서 정하고, 자동 누적 · 유지 범위 · 영속화와 텍스트 변환 · AI 노드 주입 · 표현식은 [하위 문서](#하위-문서) 가 정한다.

범위 밖:

- 대화 미리보기와 실행 트리의 렌더 규칙·store 변환·UI 불변량은 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 가 정한다.
- 항목 출처 값이 코드 여러 곳에서 갈리는 위치 매트릭스는 [인터랙션 타입 레지스트리](CLE-IX-TYPES.md) 가 정한다.
- 대화 맥락 설정 필드의 정의와 기본값, 노드별 적용 차이는 [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md) 이 정한다.
- 자동 메모리 전략(`memoryStrategy`)과 세션 간 영속 메모리는 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 와 [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md) 가 정한다.
- 공개 경로로 나가는 스레드의 자격 증명 가리기는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다.
- 대화 스레드 도입 동기와 옛 `conversationHistory` 필드를 없앤 이유는 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 의 Rationale 에 있다.

## 하위 문서

| 문서 | 맡는 내용 | 요구사항 |
|---|---|---|
| [대화 스레드 — 누적과 영속화](CLE-IX-THREAD-STORE.md) | 자동 누적 시점·출처, 적용 범위, 제외 설정, 순번 원자성, 유지 범위, park 스냅샷 영속화 | 없음 |
| [대화 스레드 — 텍스트 변환과 AI 노드 주입](CLE-IX-THREAD-INJECT.md) | `turn.text` 변환, 출처 접두, 사용자 입력 마커, AI 노드 주입과 상한, `$thread` 표현식 | 없음 |

이 문서에는 요구사항 줄이 없고 [규칙](#규칙) 이 정본이다. 병렬 분기 컨텍스트의 출력 복사는 [Parallel 노드](../CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md#실행-로직) 의 REQ-PARALLEL-031 을 따른다.

## 규칙

1. 대화 기록 항목(`ConversationTurn`)은 한 번 쌓이면 바꾸지 않는다.
2. `seq` 는 스레드 안에서 단조 증가하고 유일하다. 쌓인 순서가 곧 시간 순서다. `nextSeq` 는 오래된 항목을 버린 뒤에도 줄지 않는다.
3. `turn.text` 에 출처 접두(`[from <nodeLabel>]`)를 넣지 않는다. LLM payload 빌더가 보낼 때만 붙인다.
4. Presentation 노드를 거친 사용자 출처 텍스트(폼 제출값·버튼 라벨·URL)는 LLM 쪽 텍스트에서 사용자 입력 마커(`[user-input]…[/user-input]`)로 감싼다. 마커 안에 마커 토큰이 다시 나오면 zero-width separator 로 escape 한다.
5. `ai_user`(AI 에이전트 멀티턴의 명시적 사용자 메시지와 단일 턴의 사용자 프롬프트)는 사용자 입력 마커로 감싸지 않는다.
6. 출처 접두와 사용자 입력 마커 말고 다른 인라인 마커(예: BBCode 풍 `[#…]`)를 새로 들이지 않는다. 새 보안 마커가 필요하면 이 규칙을 먼저 고친다.
7. 라벨·이벤트·메타(버튼 라벨, URL 등)는 `turn.data` 의 일급 필드가 기준이다. UI 와 LLM payload 빌더는 마커가 든 `text` 를 파싱하지 않는다.
8. UI 는 `turn.text` 를 원문 그대로 보여 주지 않는다. 출처별 렌더와 마커 지우기는 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 규칙을 따른다.
9. 노드 설정 `excludeFromConversationThread` 가 `true` 면 그 노드의 모든 쌓기를 조용히 건너뛴다. 게이트는 단일 진입점 `appendInternal` 에 있어 노드 종류를 가리지 않는다.
10. 입력 대기에 들어가기(park) 직전에 스레드 전체를 `Execution.conversation_thread` 에 커밋한다.
11. 공개 경로(SSE `waiting_for_input`, EIA 상태 조회)로 나가는 스레드는 `redactThreadForPublic` 로 가린다. 내부 소비처(LLM 주입, rehydration)는 원문을 쓴다.
12. 노드 핸들러는 항목 텍스트에 민감 정보(API 키, Bearer 토큰, Authorization 헤더 등)를 남기지 않는다.

일관성 검토의 규약 준수 검사는 다음을 위반으로 잡는다. (a) 백엔드가 LLM 쪽 텍스트에 마커 없이 사용자 출처 데이터를 넣음(방어 누락), (b) UI 가 emit 메시지의 원문 `content` 를 대화 미리보기에 그대로 보여 줌, (c) 이 문서에 없는 새 인라인 마커를 들임.

## 자료구조

### 항목 출처

백엔드 항목 출처(`ConversationTurnSource`)는 실제로 스레드에 쌓이는 다섯 값이다(`conversation-thread.types.ts`).

| 값 | 발생원 |
|---|---|
| `presentation_user` | Form·Carousel·Table·Chart·Template 의 `output.interaction.type` 이 `form_submitted`·`button_click`·`button_continue` 일 때. AI Agent `render_form` 폼을 사용자가 제출할 때도 이 값으로 쌓고 `data.via: 'ai_render'` 를 붙인다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)) |
| `ai_user` | AI Agent 멀티턴의 `output.interaction.type='message_received'` 시점. AI 에이전트 단일 턴은 LLM 호출 전 `userPrompt` 를 해석한 직후에 한 번 쌓는다 |
| `ai_assistant` | AI Agent(단일 턴·멀티턴)의 최종 어시스턴트 응답. `text_classifier`·`information_extractor` 의 최종 결과도 이 값으로 쌓는다(핸들러의 `pushClassifierTurn`·`pushExtractorTurn` 이 `appendAiAssistantMessage` 를 부름) |
| `ai_tool` | 지식 저장소·MCP·조건 도구 결과. `includeToolTurns: true` 일 때만 |
| `system` | 명시적으로 넣는 시스템 텍스트(예약. v1 에는 자동 누적 없음). 어시스턴트 메시지의 `role: 'system'` 과 관계없고, 워크플로우 수준에서 손으로 넣는 경우(예: 첫 시스템 안내) 전용이다 |

프런트엔드 항목 출처는 여기에 `system_error`·`rag` 를 더한 일곱 값이다(`conversation-utils.ts`). 두 값은 백엔드에 쌓이지 않고 프런트엔드가 합성한다. 값마다 코드가 갈리는 위치는 [인터랙션 타입 레지스트리](CLE-IX-TYPES.md) 에 있다.

#### `system_error`

`system_error` 는 프런트엔드 store 와 내역 화면 전용 출처다. 멀티턴 AI Agent 가 `output.error` 와 함께 끝나면 store 가 대화 끝에 인라인 `system_error` 항목을 붙인다. 실시간 경로는 WS `execution.node.failed` 나 `output.error` 가 설정된 `execution.node.completed` 를 받을 때 붙인다(`use-execution-events.ts`). 내역 화면은 영속된 대화 메시지(`output.result.messages`) 끝에 `output.error` 로 같은 항목을 합성한다(`parseHistoryMessages`).

단일 턴 AI Agent 의 실패 출력에도 `output.error` 가 있지만 실시간 `system_error` 는 붙이지 않는다. 조건은 [대화 미리보기 §다시 시도 버튼 조건](../CLE-EXEC/CLE-EXEC-PREVIEW.md#다시-시도-버튼-조건), 이유는 [대화 미리보기 §단일 턴 실패에는 `system_error` 를 붙이지 않는다](../CLE-EXEC/CLE-EXEC-PREVIEW.md#단일-턴-실패에는-system_error-를-붙이지-않는다-2026-11-01) 에 있다. 단일 턴 실패 출력에는 `output.result.messages` 가 없어서 대화형 출력(`isConversationOutput`)으로 보지 않고 내역 화면도 이 항목을 합성하지 않는다(`parseHistoryMessages` 가 빈 목록을 돌려준다). 데이터 형태는 아래 [`system_error` 데이터](#system_error-데이터), 시각 규칙은 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 가 정한다.

#### `rag`

`rag` 도 프런트엔드가 합성하는 출처다. 그 턴에 지식 저장소 도구(`kb_*`) 호출이 가져온 청크를 대화 타임라인 위에 일급 이벤트로 표시한다. 1차 소스는 `meta.turnDebug[].ragSources` 이고, 스레드 밖의 보조 관찰성 레인이다. 엔진은 LLM 호출 전에 지식 저장소를 미리 검색하지 않으므로 이 청크는 늘 LLM 이 부른 도구의 결과다([RAG 검색](../CLE-KB/CLE-KB-SEARCH.md)). 같은 호출은 대화 미리보기에서 도구 행(`ai_tool`)으로도 보인다. 도구 행은 호출 하나와 그 결과이고, `rag` 는 그 턴에 모인 청크를 `chunkId` 중복 없이 모은 것이다([대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md)).

`ragSources` 스키마와 UI 노출 정책은 [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) 이 정한다. 📚 참조 칩(assistant 말풍선 아래, 참조 탭으로 이동)은 그 문서가 이미 승인한 표현이고, 🔎 `rag` 행은 같은 데이터의 타임라인 표현이다.

### 대화 기록 항목

| 필드 | 타입 | 설명 |
|---|---|---|
| `seq` | Number | 단조 증가. 쌓인 순서가 곧 시간 순서다. 스레드 안에서 유일하다 |
| `nodeId` | UUID | 항목을 만든 그래프 노드 |
| `nodeLabel` | String | 쌓을 때의 노드 라벨 스냅샷(라벨을 바꿔도 표시가 같게) |
| `nodeType` | String | 예: `form`, `carousel`, `ai_agent` |
| `timestamp` | String(ISO 8601) | 서버 시각 |
| `source` | ConversationTurnSource | [항목 출처](#항목-출처) |
| `text` | String | LLM 쪽 1차 텍스트([변환 규칙](CLE-IX-THREAD-INJECT.md#텍스트-변환-규칙)). 출처 접두는 없다([규칙](#규칙) 3). 사용자 출처 텍스트는 사용자 입력 마커로 감싸 저장한다(UI 는 표시 전에 지운다). UI 는 `source`·`nodeLabel`·`data` 메타로 가른다. 구조화 데이터만 있으면 빈 문자열일 수 있다 |
| `data?` | Object | 구조화 원본. `output.interaction.data` 스냅샷이다. `interaction.type` 별 형태는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 사용자 입력 기록 규격을 따르고 여기서 다시 나열하지 않는다. UI 와 LLM payload 빌더는 이 메타로 그리거나 직렬화한다([규칙](#규칙) 7). `system_error` 전용 형태는 아래에 있다 |
| `toolCalls?` | Array<{id, name, arguments}> | `source='ai_assistant'` 전용. 프로바이더 호환을 위해 messages 모드에서 뺄 수 있다 |
| `toolCallId?` | String | `source='ai_tool'` 전용 |
| `presentations?` | PresentationPayload[] | `source='ai_assistant'` 전용. AI Agent 가 표시 도구(`render_*`)로 만든 표·차트·캐러셀·템플릿·폼 페이로드다. `data?` 와 별개인 최상위 필드다(`data?` 는 `output.interaction.data` 스냅샷 전용이라 다른 뜻의 값을 넣지 않는다). 타입 정의는 [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md) 가 정한다. `ai_form_render` 대기 중인 `type: 'form'` 페이로드는 활성 폼의 UI 기준이다. `pendingFormToolCall.toolCallId === payload.toolCallId` 면 interactive `DynamicFormUI`, 아니면 `FormSubmittedContent`(표시 전용)로 그린다([Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md)) |

#### `system_error` 데이터

`source: 'system_error'` 전용 `data?` 형태다. [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 사용자 입력 기록 규격 밖에서 따로 정한다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `code` | string | `output.error.code` 와 같다(기준은 `output.error`) |
| `message` | string | `output.error.message` 와 같다 |
| `retryable` | boolean | `output.error.details.retryable` 과 같다 |
| `retryAfterSec?` | number | `output.error.details.retryAfterSec` 과 같다. `retryable === true` 일 때만 |
| `nodeId` | UUID | `system_error` 를 낸 노드 식별자 스냅샷 |
| `nodeLabel` | string | 그 노드 라벨 스냅샷 |
| `nodeExecutionId?` | UUID | 노드 실행 행 PK. 마지막 턴 재시도(`execution.retry_last_turn`) 명령의 payload 키다. 실시간 화면의 WS payload 에는 있고, 내역 화면의 합성(`parseHistoryMessages`)에는 없다(UI 가 재시도 버튼을 자동으로 숨긴다) |

#### `rag` 데이터

`source: 'rag'` 전용 `data?` 형태다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `sources` | RagSource[] | `meta.turnDebug[].ragSources` 스냅샷. `RagSource` 스키마(`chunkId`·`documentId`·`documentName`·`content` 미리보기·`score`·`origin`)는 [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) 이 정하고 여기서 다시 나열하지 않는다 |

`turnIndex` 는 payload 에 두지 않는다. 화면용 항목(`ConversationItem`)에 이미 필수 최상위 필드 `turnIndex` 가 있다. payload 에 한 번 더 두면 두 값이 어긋날 때 무엇이 기준인지 모호해지므로 최상위 필드만 쓴다. `system_error` 가 `nodeId`·`nodeLabel` 을 payload 에 두는 것은 최상위에 대응 필드가 없어서라 중복이 아니다.

### 대화 스레드

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | String | v1 고정값 `"default"`(여러 스레드는 v2). 포트 예약어 `'default'` 와 관계없다. 코드는 상수 `DEFAULT_THREAD_ID = 'default'` 를 쓴다 |
| `nextSeq` | Number | 다음에 쌓을 항목의 `seq`. 단조 증가 카운터다. 평소에는 `turns.length` 와 같지만, 저장 상한(`STORAGE_MAX_TURNS`)으로 오래된 항목을 버린 뒤에도 줄지 않아 `turns.length` 보다 클 수 있다(`seq` 재사용 방지) |
| `turns` | ConversationTurn[] | 시간순 누적 |
| `totalChars` | Number | 쌓을 때 갱신하는 누적 글자 수 캐시(상한 빠른 판정용) |
| `runningSummary?` | String | 롤링 요약 본문. AI Agent 의 `memoryStrategy` 가 `summary_buffer`·`persistent` 일 때만 있다. `manual` 에는 없다 |
| `summarizedUpToSeq?` | Number | `runningSummary` 가 압축해 덮는 마지막 항목의 `seq`. 이 값 이하 항목은 요약으로 대신하고 그 뒤만 원문으로 둔다. `summary_buffer`·`persistent` 일 때만 있다 |

## 앞으로의 과제

- **여러 스레드**: 사용자가 정한 키로 실행 하나에서 스레드를 여러 개 운영한다. Presentation 노드가 어느 스레드에 쌓을지 정할 수 있게 한다.
- **토큰 인식 상한**: AI Agent `memoryStrategy`(`summary_buffer`·`persistent`)의 `memoryTokenBudget` 근사로 일부 이뤘다. 근사 추정은 균일 char/3 에서 스크립트별 가중을 둔 언어 인식 휴리스틱으로 나아졌다(메모리 예산 경로 한정). 프로바이더 tokenizer 기반의 정확한 계산은 v3 로 남고, manual 모드의 글자 수 상한은 유지한다.
- **실행 내역 화면의 스레드 교차 노드 보기**: 노드 실행에 흩어진 저장에서 파생 보기를 N+1 없이 만드는 일은 실행 내역 상세(EH-DETAIL-12)와 함께 v2 UI 명세로 정한다.
- **Parallel 컨테이너와 스레드 정책**: [순번 원자성](CLE-IX-THREAD-STORE.md#순번-원자성) 참고. 사용 사례를 정한 뒤 명세한다.
- **`$thread.text` 지연 평가**: 지금 `buildExpressionContext` 는 호출마다 스레드 전체를 system_text 로 바로 렌더한다(성능 핫패스). 측정해서 비용이 크면 `Object.defineProperty` 지연 getter 나 별도 키로 나눠 요청할 때만 렌더한다.
- **서비스 모듈 위치**: types·renderer 는 이미 `src/shared/conversation-thread/` 에 있고 서비스는 `modules/execution-engine/conversation-thread/` 에 있다. 앞으로 별도 패키지 `@workflow/conversation-thread` 로 나눠 `nodes/ai` → `execution-engine` 의존을 단순하게 할지 검토한다.
- **저장 상한 제거 정책**: `STORAGE_MAX_TURNS`(500)는 가장 오래된 것부터 버린다. 사용자 인터랙션 우선 보존 같은 선택지를 검토한다.
- **시각 회귀 인프라**: 회귀 시나리오 fixture 는 단위 테스트 입력만 제공한다. 시각 회귀를 자동화하려면 storybook 이나 playwright 스냅샷 통합이 필요하다.

## 미결 사항

- **실패하거나 취소된 단일 턴이 남긴 항목**: AI 에이전트 단일 턴이 실패하거나 취소되면 응답 없는 `ai_user` 항목이 남는다. 도구 기록을 켰으면 도구 항목도 남는다([누적과 영속화 > AI Agent](CLE-IX-THREAD-STORE.md#ai-agent)). 이 항목을 지울지 실패 표시를 붙일지 정하지 않았다. 어느 쪽이든 [규칙](#규칙) 1(쌓인 항목은 바꾸지 않는다)에 예외를 두거나 별도 항목을 더해야 한다. 취소된 경우는 [정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md#노드-취소는-error-포트로-보내지-않는다-2026-10-31) 의 결정과 맞출지도 함께 정한다. 정보 추출기는 취소되면 스레드에 아무것도 쌓지 않는다. 지금 영향이 보이는 곳은 다른 노드의 입력 대기 스냅샷([대화 미리보기 §단일 턴 실패에는 `system_error` 를 붙이지 않는다](../CLE-EXEC/CLE-EXEC-PREVIEW.md#단일-턴-실패에는-system_error-를-붙이지-않는다-2026-11-01) 의 알려진 한계), 사용자 메시지를 말풍선으로 그리는 [웹채팅 위젯](../CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md), 뒤따르는 AI 노드가 받는 대화 맥락이다.

## 구현 위치

- `codebase/backend/src/shared/conversation-thread/**` (`conversation-thread.types.ts` 의 출처 값·`PRESENTATION_TYPES`·`rehydrateConversationThread`·`DEFAULT_THREAD_ID`, `thread-renderer.ts` 의 `renderInteractionText`·`applyCap`)
- `codebase/backend/src/modules/execution-engine/conversation-thread/**` (`conversation-thread.service.ts` 의 `appendInternal`·`STORAGE_MAX_TURNS`)
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` (상태 조회의 스레드 싣기)
- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`, `ai-agent.schema.ts`
- `codebase/backend/src/nodes/ai/shared/conversation-context-injection.ts`, `conversation-context-schema.ts`
- `codebase/backend/src/nodes/ai/text-classifier/text-classifier.handler.ts` (`pushClassifierTurn`)
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` (`pushExtractorTurn`·`pushExtractorTurnTo`)
- `codebase/frontend/src/lib/conversation/conversation-utils.ts` (프런트엔드 출처 값)
- `codebase/frontend/src/lib/stores/execution-store.ts`, `codebase/frontend/src/lib/websocket/use-execution-events.ts`
- 대화 미리보기 렌더 컴포넌트(`conversation-inspector.tsx`·`result-timeline.tsx`·`conversation-timeline-item.tsx`·`assistant-presentations-block.tsx`)는 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 가 다룬다.

## Rationale

대화 스레드를 도입한 동기, 선택지 비교, v1·v2 경계, 옛 `conversationHistory` 필드를 없앤 이유는 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 의 Rationale 에 있다. 이 절은 자료구조에 관한 결정만 다룬다. 텍스트 변환·마커 결정은 [텍스트 변환과 AI 노드 주입](CLE-IX-THREAD-INJECT.md#rationale), 영속화 결정은 [누적과 영속화](CLE-IX-THREAD-STORE.md#rationale), 렌더 규칙 결정은 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 에 있다.

### `system_error` 를 별도 출처 값으로 둔다

멀티턴 AI Agent(나중에는 다른 LLM 노드도)가 `output.error` 와 함께 끝날 때 대화 스레드 안에 인라인으로 표시할 `system_error` 출처를 새로 뒀다. 이 값은 프런트엔드 store·내역 화면의 출처 값으로만 더한다(백엔드 다섯 값은 그대로). 백엔드가 별도 항목으로 쌓지 않고 프런트엔드가 WS 에러 이벤트(`node.failed`, 에러가 설정된 `node.completed`)로 그 자리에 합성한다. 기준은 `output.error` 하나다. 프런트엔드 렌더 층에서 출처 단독 분기를 유지하면서 스레드의 자연 순서를 지키고, `system` 행과 모양·뜻·조작이 모두 달라 별도 출처가 맞다.

- 기존 `system` 출처를 `data.kind` 판별자로 다시 쓰는 안: 출처의 1:1 시각 매핑을 1:N 으로 나눠 매핑표의 단순함을 잃는다. `system_error` 에는 재시도 버튼이 있어 읽기 전용 `system` 메모와 의미 부담도 다르다.
- 별도 store 필드로 나누는 안: 실시간 대화 스레드의 자연 순서를 잃고, 도구 호출 묶음 정책과의 상호작용을 다시 설계해야 한다.

값을 더할 때 모든 처리 분기 위치를 등록하는 것은 [인터랙션 타입 레지스트리](CLE-IX-TYPES.md) 가 강제한다. 변환 함수는 AST 가드가, 렌더 분기는 TS exhaustive switch 가 막는다. 실패해도 대화를 지우지 않는 store 정책(Inv-6)과 `system` 행과의 시각 구분 근거는 [대화 미리보기 §새 실행만 대화를 지운다](../CLE-EXEC/CLE-EXEC-PREVIEW.md#새-실행만-대화를-지운다-inv-6) 에 있다.

### `rag` 를 프런트엔드 합성 출처로 둔다

지식 저장소 검색을 대화 타임라인의 일급 이벤트로 보이기 위해 `rag` 출처를 프런트엔드 합성 값으로 뒀다. 백엔드 다섯 값은 그대로이고 1차 소스는 `meta.turnDebug[].ragSources` 다. 이 소스를 고른 이유, `ai_tool` 을 다시 쓰지 않는 이유, "대화 턴 1차 소스는 스레드" 원칙과의 관계, 옛 데이터 한계는 [대화 미리보기 §`rag` 줄을 보조 관찰성 레인으로 둔다](../CLE-EXEC/CLE-EXEC-PREVIEW.md#rag-줄을-보조-관찰성-레인으로-둔다) 에 있다. 2026-10-10 에 `rag` 를 «`kb_*` 도구 호출이 가져온 청크의 타임라인 표시» 로 정했다. LLM 호출 전 자동 검색을 새로 만드는 안을 기각한 근거는 [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) 의 Rationale 에 있다.
