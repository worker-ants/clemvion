---
id: "CLE-IX-THREAD"
title: "대화 스레드"
type: "convention"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-IX"
ancestors: ["CLE-VISION", "CLE-IX"]
area: "CLE-IX"
content_hash: "509a0cc1552234311d52b455dd451e147dd952af3218c2acabafb8d02a1a5451"
read_as: "approved"
task: null
source_paths: ["spec/conventions/conversation-thread.md"]
mirror_sha256: "e1c79d6f18aabe753bbc128a1ee304e36713332d034e9d4b64671d67fca03072"
etag: "sha256-bf03b8e9113aaa02f29885fc5d5ce433fef758df1f41508ef8132d2a2bd79d1e"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/conversation-thread.md` (§1~§8, 1–467행. §9 미리보기 렌더 규칙과 §8.1·§8.2·§8.5 근거는 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 에 있다) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

대화 스레드(ConversationThread)는 워크플로우 실행 하나 동안 생긴 사용자 인터랙션과 AI 대화를 시간순으로 쌓는 일급 컨텍스트다. AI 카테고리 세 노드(`ai_agent`·`text_classifier`·`information_extractor`)는 노드 설정의 대화 맥락 설정(`contextScope`)으로 이 스레드를 LLM 입력에 자동으로 받는다.

이 문서는 대화 스레드의 규약을 정한다. 자료구조(대화 기록 항목과 항목 출처), 자동 누적 계약, 유지 범위, 영속화, AI 노드 주입, 표현식 통합이 여기 있다.

범위 밖:

- 대화 미리보기와 실행 트리의 렌더 규칙·store 변환·UI 불변량은 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 가 정한다.
- 항목 출처 값이 코드 여러 곳에서 갈리는 위치 매트릭스는 [인터랙션 타입 레지스트리](CLE-IX-TYPES.md) 가 정한다.
- 대화 맥락 설정 필드의 정의와 기본값, 노드별 적용 차이는 [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md) 이 정한다.
- 자동 메모리 전략(`memoryStrategy`)과 세션 간 영속 메모리는 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 와 [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md) 가 정한다.
- 공개 경로로 나가는 스레드의 자격 증명 가리기는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다.
- 대화 스레드 도입 동기와 옛 `conversationHistory` 필드를 없앤 이유는 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 의 Rationale 에 있다.

## 규칙

1. 대화 기록 항목(`ConversationTurn`)은 한 번 쌓이면 바꾸지 않는다.
2. `seq` 는 스레드 안에서 단조 증가하고 유일하다. 쌓인 순서가 곧 시간 순서다. `nextSeq` 는 오래된 항목을 버린 뒤에도 줄지 않는다.
3. `turn.text` 에 출처 접두(`[from <nodeLabel>]`)를 넣지 않는다. LLM payload 빌더가 보낼 때만 붙인다.
4. Presentation 노드를 거친 사용자 출처 텍스트(폼 제출값·버튼 라벨·URL)는 LLM 쪽 텍스트에서 사용자 입력 마커(`[user-input]…[/user-input]`)로 감싼다. 마커 안에 마커 토큰이 다시 나오면 zero-width separator 로 escape 한다.
5. `ai_user`(AI Agent 멀티턴의 명시적 사용자 메시지)는 사용자 입력 마커로 감싸지 않는다.
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
| `ai_user` | AI Agent 멀티턴의 `output.interaction.type='message_received'` 시점 |
| `ai_assistant` | AI Agent(단일 턴·멀티턴)의 최종 어시스턴트 응답. `text_classifier`·`information_extractor` 의 최종 결과도 이 값으로 쌓는다(핸들러의 `pushClassifierTurn`·`pushExtractorTurn` 이 `appendAiAssistantMessage` 를 부름) |
| `ai_tool` | 지식 저장소·MCP·조건 도구 결과. `includeToolTurns: true` 일 때만 |
| `system` | 명시적으로 넣는 시스템 텍스트(예약. v1 에는 자동 누적 없음). 어시스턴트 메시지의 `role: 'system'` 과 관계없고, 워크플로우 수준에서 손으로 넣는 경우(예: 첫 시스템 안내) 전용이다 |

프런트엔드 항목 출처는 여기에 `system_error`·`rag` 를 더한 일곱 값이다(`conversation-utils.ts`). 두 값은 백엔드에 쌓이지 않고 프런트엔드가 합성한다. 값마다 코드가 갈리는 위치는 [인터랙션 타입 레지스트리](CLE-IX-TYPES.md) 에 있다.

#### `system_error`

`system_error` 는 프런트엔드 store 와 내역 화면 전용 출처다. AI Agent(단일 턴·멀티턴)가 `output.error` 와 함께 끝나면, WS `execution.node.failed` 나 `output.error` 가 설정된 `execution.node.completed` 를 받았을 때 store 와 내역 화면이 그 자리에 인라인 `system_error` 항목을 붙인다(`use-execution-events.ts`). 데이터 형태는 아래 [`system_error` 데이터](#system_error-데이터), 시각 규칙은 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 가 정한다.

#### `rag`

`rag` 도 프런트엔드가 합성하는 출처다. 대화 타임라인 위에 지식 저장소 검색을 일급 이벤트로 표시한다. 1차 소스는 `meta.turnDebug[].ragSources` 이고, 스레드 밖의 보조 관찰성 레인이다. 이 검색이 "엔진이 LLM 호출 전에 자동으로 한 검색" 인지, LLM 이 부른 지식 저장소 도구(`ai_tool`)의 결과인지는 정의가 갈린다. [미결 사항](#미결-사항) 참조.

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
| `text` | String | system_text 주입과 messages 모드의 user·assistant content 로 쓰는 LLM 쪽 1차 텍스트. 출처 접두는 빌더 단계에서 붙이므로 여기엔 없다. 사용자 출처 텍스트는 사용자 입력 마커로 감싸 저장한다(프롬프트 주입 방어용, UI 는 표시 전에 지운다). UI 는 `source`·`nodeLabel`·`data` 메타로 가르고 `text` 를 그대로 보여 주지 않는다. 구조화 데이터만 있으면 빈 문자열일 수 있다 |
| `data?` | Object | 구조화 원본. `output.interaction.data` 스냅샷이다. `interaction.type` 별 형태는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 사용자 입력 기록 규격을 따르고 여기서 다시 나열하지 않는다. UI 와 LLM payload 빌더는 원문 텍스트를 파싱하지 않고 이 메타로 그리거나 직렬화한다. 새 인라인 마커가 필요하면 [규칙](#규칙) 6 을 먼저 고친다. `system_error` 전용 형태는 아래에 있다 |
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

### 텍스트 변환 규칙

`text` 는 LLM 쪽 텍스트다. system_text 모드의 스레드 렌더 본문과 messages 모드의 user·assistant content 로 그대로 간다. UI 는 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 매핑을 먼저 따르며, `text` 의 동사 접두(`clicked:`·`continued:`)는 카드 헤더로 따로 보여 주고 본문에는 버튼 라벨이나 URL 만 남긴다.

| 입력 | text(LLM 쪽) | UI 카드 헤더(참고) | UI 카드 본문(참고) |
|---|---|---|---|
| `form_submitted` | `name=John, age=30`(key=value 목록, 200자 상한, 값이 객체·배열이면 JSON 직렬화) | `<nodeLabel> · form submitted` | `data` 가 `{ [fieldName]: value }` 평면 맵이라 UI 는 그 키·값을 표로 그린다 |
| `button_click` | `clicked: <buttonLabel>`(라벨이 없으면 `<buttonId>`) | `<nodeLabel> · button clicked` | `data.buttonLabel`(없으면 `data.buttonId`) |
| `button_continue` | `continued: <url>`(URL 이 없으면 `continued`) | `<nodeLabel> · link continue` | `data.url` |
| `message_received`(`ai_user`) | 메시지 본문 그대로. 마커로 감싸지 않는다(`appendAiUserMessage` 는 `renderInteractionText` 를 거치지 않는다) | 없음(채팅 말풍선) | `text` |
| `ai_agent` 최종 assistant | `output.result.response` 그대로(노드 출력 규약의 LLM 응답 텍스트 경로) | 없음(채팅 말풍선) | `text`(markdown) |
| `text_classifier` 최종(`ai_assistant`) | 단일 라벨: `output.result.category`. 다중 라벨: `output.result.categories.map(c => c.name).join(', ')`(객체 배열이라 그냥 `join` 할 수 없다). 구현 `pushClassifierTurn` | `<nodeLabel> · classified` | `text` |
| `information_extractor` 최종(`ai_assistant`) | `output.result.extracted` 를 늘 `JSON.stringify` 로 직렬화한다(`responseFormat` 은 `ai_agent` 전용이고 추출기는 늘 구조화 출력). 구현 `pushExtractorTurn`·`pushExtractorTurnTo`(단일 턴 최종과 멀티턴 종결에서 호출) | `<nodeLabel> · extracted` | `text`(JSON 들여쓰기) |

### 출처 접두

messages 모드의 `[from <nodeLabel>] ` 접두와 system_text 모드의 스레드 렌더 헤더는 LLM payload 빌더(`mapTurnsToChatMessages`, `renderThreadAsSystemText`)가 붙인다. `turn.text` 에는 접두가 없다. 항목은 다른 프로바이더나 포매터에서도 다시 쓸 수 있는 원문 본문을 보관한다.

- **저장·발행 형태**: 접두는 한 번 붙은 뒤 LLM 호출 메시지 기록의 일부로 쌓여 `output.result.messages` 에 함께 저장되고, WebSocket `ai_message.messages[]`·`waiting_for_input.conversationConfig.messages[]` 에도 그대로 나간다. LLM 이 다음 턴에서도 출처를 알려면 접두가 메시지 기록 안에 있어야 하기 때문이다. 이 발행 메시지에는 전송 출처 표시 `source: 'injected'` 가 함께 붙는다([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)).
- **UI 노출 피하기**: [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md#데이터-소스) 는 접두가 든 발행 메시지 대신 접두 없는 스레드 스냅샷(원문 `turn.text`)을 1차 소스로 써서 사용자 오인을 막는다. 발행 메시지는 LLM 디버그 패널(Request·Response·LLM Usage) 전용이고, 거기서는 "Raw payload" 토글로 원문임을 밝힌다.

### 사용자 입력 마커

`renderInteractionText`(백엔드 `thread-renderer.ts`)는 프롬프트 주입을 막으려고 사용자 출처 텍스트(폼 제출값·버튼 라벨·URL)를 `[user-input]…[/user-input]` 마커로 감싼다.

| 항목 | 정책 | 비고 |
|---|---|---|
| `[user-input]…[/user-input]` | LLM 쪽 의무(`presentation_user` 한정). Presentation 노드의 사용자 출처 텍스트를 감싼다. `ai_user` 는 감싸지 않는다 | system_text 모드 sanitize 의 일부 |
| 마커가 든 `turn.text`·`output.result.messages[].content` | 그대로 저장·발행 | LLM 기록 보존이 1차 목적 |
| UI 노출 | 사용자에게 보이기 전에 정규식으로 지운다 | 사용자는 마커를 보지 않는다. 지우는 위치는 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) |
| 출처 접두 밖의 임의 인라인 마커 | 새로 들이지 않는다 | 필요하면 이 규약을 먼저 고친다 |
| 라벨·이벤트·메타 | `turn.data` 일급 필드가 기준. UI 는 `data` 에서 바로 꺼내고 마커가 든 텍스트를 파싱하지 않는다 | 카드 본문 렌더 규칙 |

## 자동 누적

### Presentation 노드

재개 출력을 만들며 `output.interaction` 을 빌드한 뒤 엔진이 자동으로 쌓는다.

- Form 의 `interaction.type='form_submitted'` → `source: 'presentation_user'`
- Carousel·Table·Chart·Template 의 `interaction.type='button_click' | 'button_continue'` → `source: 'presentation_user'`

쌓는 시점은 `interaction.{ type, data, receivedAt }` payload 가 나오는 때다. 재개 출력의 `status` 값은 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 가 정한다.

Presentation 노드가 그린 표시물(`{ config, output }`)은 스레드에 저장하지 않는다. Presentation 노드가 쌓는 것은 위 `presentation_user` 항목(사용자 인터랙션 `data` 스냅샷)뿐이고, 표·차트·캐러셀·템플릿 자체는 항목의 최상위 `presentations[]` 에 들어가지 않는다. 그 필드는 `ai_assistant` 전용이고 AI Agent 표시 도구만 채운다. 차단 없이 진행하는 Presentation 노드의 표시물은 실행 중 이벤트(WS, SSE `execution.message`)로만 전달되므로, 영속 스레드를 1차 소스로 쓰는 복원 경로(새로고침·재접속)에는 나오지 않는다. 소비 쪽 서술은 [웹채팅 위젯](../CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) 에 있다. 이것을 스레드에 싣으려면 백엔드 다섯 출처 값이나 항목 필드를 넓혀야 하므로 v2 검토 사안이다.

### AI Agent

| 시점 | 출처 |
|---|---|
| 멀티턴 사용자 메시지 도착(`output.interaction.type='message_received'`) | `ai_user` |
| 멀티턴 매 턴 끝의 최종 어시스턴트 응답(`output.result.response`) | `ai_assistant` |
| 멀티턴 조건 라우팅 때의 어시스턴트 응답(`output.result.response`) | `ai_assistant` |
| 멀티턴 `render_form` 폼 제출 | `presentation_user`(`data.via: 'ai_render'`) |
| 단일 턴 `userPrompt`(resolve 된 값) | `ai_user`(한 번) |
| 단일 턴 최종 `output.result.response` | `ai_assistant`(한 번) |
| 도구 루프 중 어시스턴트와 도구 결과 | `ai_assistant`·`ai_tool`(`includeToolTurns: true` 일 때만) |

- **정보 추출기 종결 쌓기**: 추출 노드는 단일 턴 최종 응답 뒤와 멀티턴 종결 뒤에 최종 어시스턴트 항목을 한 번 쌓는다([텍스트 변환 규칙](#텍스트-변환-규칙) 의 `information_extractor` 행). 어느 종결 사유에서 쌓는지와 그 이유는 [정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) 가 정한다.
- **`ai_user` 쌓는 시점과 실시간 조기 표시**: 위 표의 `ai_user` 는 핸들러(`processMultiTurnMessageInner`)가 쌓으며 시점과 책임은 그대로다. 이와 별개로 엔진은 메시지를 받는 즉시(LLM 호출 전) WS `execution.user_message` 를 내, 실시간 대화 타임라인이 같은 논리적 턴의 `ai_user` 를 낙관적으로 먼저 보여 주게 한다. 맞춤의 권위 출처는 턴 끝의 `execution.ai_message.messages` 스냅샷이다. 새 항목 출처 값은 더하지 않는다. 낙관적 말풍선은 기존 `ai_user` 분기를 쓴다. 변환 계약은 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 에 있다.

### 적용 범위

| 동작 | 적용 노드(구현됨) |
|---|---|
| 항목 쌓기 | `ai_agent`(멀티턴 user·assistant, 단일 턴 최종 assistant) + `text_classifier`·`information_extractor` 최종 assistant |
| 자동 주입(대화 맥락 설정) | `ai_agent`·`text_classifier`·`information_extractor`. 세 노드가 같은 인터페이스(공유 유틸 `shared/conversation-context-injection.ts`)를 쓴다 |
| 자동 메모리 주입(`memoryStrategy`) | `ai_agent`(`summary_buffer`·`persistent`) + `information_extractor`(`persistent` 만). `text_classifier` 는 지원하지 않는다(단일 턴이고 상태가 없어 회수·추출할 대상이 없다) |

쌓기와 주입을 나눠 정의하는 것은 다른 AI 노드의 최종 응답도 뒤따르는 AI Agent 가 스레드로 받게 하려는 것이다. 분류·추출 노드는 의미 있는 최종 시점이 `ai_agent` 와 다르지만(분류기는 카테고리, 추출기는 구조화 데이터) [텍스트 변환 규칙](#텍스트-변환-규칙) 이 노드별로 정해져 세 노드 모두 쌓는다. 제외 설정은 `appendInternal` 에서 공통으로 적용한다. 노드별 적용 차이의 기준은 [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md), 자동 메모리 전략은 [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md) 와 [정보 추출기 노드](../CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) 가 정한다.

### 제외 설정

노드마다 공통 boolean 설정 `excludeFromConversationThread`(기본 `false`)가 있다. `true` 면 그 노드의 모든 쌓기를 조용히 건너뛴다(`appendInternal` 의 공통 게이트). UI 그룹은 `Conversation Context` 이고, 필드 정의는 세 AI 노드가 공유하는 조각 `shared/conversation-context-schema.ts` 의 `buildConversationContextSchemaFields` 가 기준이다. 각 노드 스키마는 이를 펼쳐 부르기만 한다.

게이트가 듣는 범위와 필드를 선언하는 범위는 다르다. 필드를 선언하는 노드는 AI 세 노드다. 그런데 런타임 게이트는 `appendInternal` 단일 진입점에 있어 노드 종류를 가리지 않는다. Presentation 노드처럼 조각을 쓰지 않는 노드도 설정에 값이 있으면 똑같이 건너뛴다(각 스키마가 `passthrough` 라 수동·API 설정이 남는다). Presentation 쪽 서술은 [Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) 에 있다.

### 순번 원자성

`nextSeq` 의 단조 증가는 실행 컨텍스트 하나에서 직렬로 실행된다는 보장에 기댄다. v1 의 메모리·단일 인스턴스 환경에서는 한 실행의 노드 처리가 한 번에 한 노드씩 진행되므로(엔진의 `executeNode` 가 순차) `appendInternal` 의 `seq = thread.nextSeq; thread.nextSeq = seq + 1` 에 경쟁이 없다.

다음 경우에는 따로 보장이 필요하다.

- **Parallel 컨테이너**: 분기들이 같은 스레드에 동시에 쌓을 수 있다. v1 은 Parallel 안의 스레드 사용을 정의하지 않는다. v2 에서 분기별 자식 스레드나 병합 지점 재통합 정책을 정한다.
- **여러 인스턴스·Redis 분산**: 스레드를 Redis 로 옮기면 `INCR` 같은 원자 연산이나 잠금이 필요하다. v1 은 메모리 전용이다.

## 유지 범위

| 컨테이너 | 정책 |
|---|---|
| 서브 워크플로우(`executeInline`) | 부모 스레드를 물려받아 함께 쓴다 |
| Background | 적재 시점의 `turns` 배열까지 복사한 스냅샷. 격리 |
| Loop·ForEach·Map·Parallel | 부모 스레드를 물려받아 함께 쓴다 |

- **서브 워크플로우**: 워크플로우 호출 노드의 동기 `executeInline` 경로는 부모 실행 컨텍스트를 그대로 쓴다(`recursionDepth` 만 늘어남). 그래서 서브 워크플로우 안의 AI Agent 도 부모 스레드를 본다. 격리하려면 비동기 모드로 호출한다(별도 실행, 별도 스레드).
- **Background**: `scheduleBackgroundBody` 가 적재할 때 스레드의 `turns` 배열까지 복사한 스냅샷을 만든다. 최소 `{ ...thread, turns: [...thread.turns] }` 형태다. 참조만 복사하지 않고 새 배열 인스턴스를 만들어, 백그라운드가 새 항목을 쌓아도 메인 스레드의 `turns` 가 바뀌지 않게 한다. 대화 기록 항목 자체는 바뀌지 않으므로 깊은 복사까지는 필요 없다. 그래서 메인 흐름이 이후 만든 항목은 백그라운드가 보지 못하고, 백그라운드 안의 항목은 메인 스레드에 영향이 없다. "백그라운드 실패가 메인 흐름의 실행 상태에 영향을 주지 않는다" 는 격리 원칙([Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md))과 맞는다.
- **컨테이너**: Loop·ForEach·Map·Parallel 은 별도 실행 컨텍스트를 만들지 않고 같은 `context.nodeOutputCache` 를 함께 쓴다. 스레드도 같은 정책이다. 반복 메타(인덱스 등)는 스레드에 자동으로 넣지 않는다. 필요하면 사용자가 `{{ $loop.index }}` 등으로 명시한다.

## 영속화

| 단계 | 저장소 | 비고 |
|---|---|---|
| 실행 중 | 실행 컨텍스트([실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md)) | `ExecutionContextService.createContext` 가 빈 스레드(`{ id: 'default', nextSeq: 0, turns: [], totalChars: 0 }`)로 시작한다. 재시작이나 다른 인스턴스의 재개 때 `rehydrateContext` 는 메모리의 스레드를 되살릴 수 없으므로, 손실 없는 재개는 아래 park 스냅샷에 기댄다 |
| 입력 대기(park) 진입 | PostgreSQL `Execution.conversation_thread jsonb NULL` | 영속 재개 스냅샷. park 직전(`waitForFormSubmission`·`waitForButtonInteraction`·`waitForAiConversation`)마다 `context.conversationThread` 전체(`runningSummary`·`summarizedUpToSeq` 포함)를 커밋한다. rehydration([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md))이 이 컬럼에서 손실 없이 되살린다. 소비처는 (a) rehydration(내부 무손실 재개), (b) SSE `waiting_for_input` 발행, (c) EIA 상태 조회 `GET /api/external/executions/:id`(읽기 전용) 세 곳이다. (b)·(c) 공개 경로는 `redactThreadForPublic` 로 가린다 |
| 실행 뒤(내역 화면) | 노드 실행에 흩어진 저장 | `output.interaction`(Presentation, `form_submitted`·`button_click`·`button_continue`), `output.result.messages`(AI 멀티턴 누적, 대기·재개 때), `output.result.response`(AI 최종 응답)가 실행 내역 화면의 기준이다. 이 경로의 스레드 보기는 다시 만들 수 있는 파생 보기이고, 영속 재개 스냅샷과 목적·소비처가 다르다 |
| WS payload | `execution.waiting_for_input` 에 `conversationThread` 스냅샷을 선택적으로 함께 싣는다 | UI 가 실시간 스레드를 보여 줄 수 있다 |

- **저장 상한**: 스레드는 최대 `STORAGE_MAX_TURNS`(500) 항목을 보관한다. 넘으면 가장 오래된 항목부터 버린다(FIFO). 버려도 `nextSeq` 는 줄지 않는다.
- **rehydration 방어 정규화**: park 스냅샷 복원은 `rehydrateConversationThread`(`conversation-thread.types.ts`) 한 진입점이 한다. 원본 jsonb 를 그대로 믿지 않고 방어적으로 정규화한다. (a) 손상된 항목은 건너뛴다(`seq` 는 음이 아닌 정수, `source` 는 enum, `text` 는 문자열인지 최소 검증). (b) `totalChars` 를 살아남은 항목으로 다시 계산한다. (c) `nextSeq` 는 저장값이 `turns.length` 이상이면 그대로 두고(버린 뒤에도 줄지 않는 불변식), 모자라거나 손상됐으면 `turns.length` 로 다시 정한다. (d) `runningSummary` 가 `MAX_RUNNING_SUMMARY_CHARS`(20,000)를 넘으면 자른다(비정상 DB 값의 프롬프트 주입·토큰 과소비 방어). 정상 jsonb 왕복에서는 손실이 없고, 정규화는 손상·어긋남에 대한 안전망이다.
- **자동 메모리 전략의 영속 경로**: `runningSummary`·`summarizedUpToSeq` 는 스레드의 일부라 park 스냅샷에 함께 커밋되고, 재시작이나 다른 인스턴스 재개 때 스레드와 함께 되살아난다. `persistent` 전략의 세션 간 영속 메모리는 스레드가 아닌 별도 테이블 `agent_memory`([에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md))에 저장된다. 대화 스레드와 분리된 저장소라 이 규약과 독립이다.
- 컬럼 정의는 [실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md), 커밋 절차는 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md), 공개 노출 정책은 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md) 와 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다.

## AI 노드 주입

세 AI 노드(`ai_agent`·`text_classifier`·`information_extractor`)는 대화 맥락 설정 다섯 필드(`contextScope`·`contextScopeN`·`contextInjectionMode`·`includeToolTurns`·`excludeFromConversationThread`)를 함께 쓴다. 필드 정의와 기본값은 [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md) 이 정한다. 스키마 조각은 `shared/conversation-context-schema.ts`, 주입 로직은 `shared/conversation-context-injection.ts` 다.

주입 위치는 LLM 호출 직전이다.

- `ai_agent`: `processMultiTurnMessageInner` 의 매 턴 `llmService.chat` 직전(단일 턴은 첫 chat 직전)
- `text_classifier`: 분류 LLM 호출 직전
- `information_extractor`: 단일 턴 LLM 호출 직전, 그리고 멀티턴 첫 진입(`executeMultiTurn`)의 초기 메시지를 만든 직후

메시지 배열은 `[system, ...injectedThread, ...selfHistory]` 로 만든다. `injectedThread` 에서 자기 노드가 만든 항목은 `getThreadExcludingNode` 로 빼 중복을 막는다.

자동 메모리 전략 경로는 이 공유 주입을 대신한다. `ai_agent` 의 `summary_buffer`·`persistent`, `information_extractor` 의 `persistent`(회수한 안정 접두 주입)가 그렇다. `text_classifier` 에는 `memoryStrategy` 필드가 없어 늘 이 경로를 쓴다. `information_extractor` 도 `memoryStrategy = manual`(기본)이면 이 경로를 쓴다.

system_text 모드의 systemPrompt 조립 순서(System Context Prefix → 사용자 systemPrompt → 지식 저장소·조건 접미 → 스레드 주입)의 기준은 [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md) 이다. 이 문서는 스레드 주입 단계만 다룬다. messages 모드는 스레드를 systemPrompt 본문이 아닌 메시지 배열 앞에 붙이므로 이 순서의 스레드 단계가 해당하지 않는다.

### messages 모드

| 항목 출처 | role | content 접두 |
|---|---|---|
| `presentation_user` | `user` | `[from <nodeLabel>] ` |
| `ai_user` | `user` | 없음 |
| `ai_assistant` | `assistant` | 없음(`toolCalls` 는 보존하거나 뺀다) |
| `ai_tool` | `tool` | 없음(`toolCallId` 로 맞춤) |
| `system` | `system` | 없음. Anthropic API 는 메시지 배열 안의 `role: 'system'` 을 지원하지 않는다. 프로바이더가 Anthropic 이면 system_text 모드나 별도 분기로 돌아가야 한다. v1 은 자동 추가가 없어 지금은 문제가 없고, 손으로 넣기를 도입할 때 프로바이더 분기를 반드시 검증한다 |

이 매핑으로 메시지 배열 앞에 붙은 항목은 발행 때 전송 출처 표시 `source: 'injected'` 를 함께 싣는다. AI Agent 핸들러가 실제 턴 처리 결과로 쌓는 user·assistant·tool 메시지는 `source: 'live'` 다. 이 표시는 WebSocket payload 전용 두 값이고 항목 출처(백엔드 다섯 값, 프런트엔드 일곱 값)와 다르다. 발행 단계에서 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 의 대응표에 따라 줄여 표시한다. 표시가 없을 때 `live` 로 보는 폴백도 그 문서가 정하며, 대화 기록 항목의 `source` 에는 해당하지 않는다.

### system_text 모드

`thread-renderer` 가 헤더 `[#seq · timestamp · label (type) · source]` 와 본문으로 렌더해 `finalSystemPrompt` 끝에 붙인다. 지식 저장소 안내와 조건 접미보다 뒤다.

`turn.text` 가 사용자 입력(폼 제출, `ai_user` 메시지)에서 왔으면 프롬프트 주입을 막으려고 `LlmService` 의 사용자 content sanitizer 와 같은 방식으로 정리한다.

### 주입 상한

| 상수 | 값 | 동작 |
|---|---|---|
| `MAX_INJECTED_TURNS` | `100` | 넘으면 가장 오래된 항목부터 조용히 버린다(앞쪽 잘라 내기). 본문에 잘림 표시를 넣지 않고(`applyCap`), 잘린 사실은 `meta.contextInjection.droppedTurns` 로만 알린다 |
| `MAX_TURN_TEXT_CHARS` | `4000` | 넘으면 자르고 `...` 을 붙인다 |
| `MAX_INJECTED_CHARS` | `200_000` | 합계 글자 수 안전망. 넘으면 오래된 항목부터 더 버린다 |

`meta.contextInjection: { appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }` 를 디버그용으로 남긴다. `appliedScope`·`appliedMode` 는 설정 값이 아닌 실제 적용 결과다. 예를 들어 `contextScope='thread'` 라도 스레드가 비었으면 `appliedScope='none'` 이고, 상한으로 잘리면 `injectedTurns < turns.length` 다. `meta` 는 런타임 측정값이라는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 원칙과 맞는다.

글자 수 상한 세 가지는 `memoryStrategy: 'manual'`(기본)에서만 쓴다. `summary_buffer`·`persistent` 는 글자 수 상한 대신 `memoryTokenBudget` 토큰 예산을 기준으로 오래된 항목부터 롤링 요약으로 압축한다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)). 두 방식은 서로 배타적이다.

## 표현식

[표현식 언어](../CLE-WF/CLE-WF-EXPR.md) 의 `$thread` 변수:

| 표현식 | 반환 |
|---|---|
| `$thread.turns` | ConversationTurn[](읽기 전용) |
| `$thread.length` | Number |
| `$thread.text` | String. system_text 렌더 결과 |

자동 주입과 관계없이 사용자가 명시적으로 참조할 수 있다(예: 별도 Transform 노드에서 스레드 가공).

## 앞으로의 과제

- **여러 스레드**: 사용자가 정한 키로 실행 하나에서 스레드를 여러 개 운영한다. Presentation 노드가 어느 스레드에 쌓을지 정할 수 있게 한다.
- **토큰 인식 상한**: 글자 수 상한의 토큰 인식화는 AI Agent `memoryStrategy`(`summary_buffer`·`persistent`, `memoryTokenBudget` 근사)로 일부 이뤘다. 근사 추정은 균일 char/3 에서 스크립트별 가중을 둔 언어 인식 휴리스틱으로 일부 나아졌다(메모리 예산 경로 한정, 글자 수 상한은 그대로). 프로바이더 tokenizer 기반의 정확한 계산은 v3 로 남는다. manual 모드의 글자 수 상한은 유지한다.
- **실행 내역 화면의 스레드 교차 노드 보기**: 노드 실행에 흩어진 저장에서 파생 보기를 N+1 없이 만드는 일은 실행 내역 상세(EH-DETAIL-12)와 함께 v2 UI 명세로 정한다.
- **Parallel 컨테이너와 스레드 정책**: 지금은 Parallel 안의 스레드 사용을 정의하지 않는다. 분기별 자식 스레드나 병합 지점 재통합 정책을 사용 사례를 정한 뒤 명세한다.
- **`$thread.text` 지연 평가**: 지금 `buildExpressionContext` 는 호출마다 스레드 전체를 system_text 로 바로 렌더한다(성능 핫패스). 측정해서 비용이 크면 `Object.defineProperty` 지연 getter 나 별도 키로 나눠 요청할 때만 렌더한다.
- **서비스 모듈 위치**: types·renderer 는 이미 `src/shared/conversation-thread/` 에 있고 서비스는 `modules/execution-engine/conversation-thread/` 에 있다. 앞으로 별도 패키지 `@workflow/conversation-thread` 로 나눠 `nodes/ai` → `execution-engine` 의존을 단순하게 할지 검토한다.
- **저장 상한 제거 정책**: `STORAGE_MAX_TURNS`(500)는 가장 오래된 것부터 버린다. 사용자 인터랙션 우선 보존 같은 선택지를 검토한다.
- **시각 회귀 인프라**: 회귀 시나리오 fixture 는 단위 테스트 입력만 제공한다. 시각 회귀를 자동화하려면 storybook 이나 playwright 스냅샷 통합이 필요하다.

## 미결 사항

- **`rag` 가 나타내는 검색이 무엇인가**: 이 문서와 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 는 🔎 `rag` 를 "엔진이 LLM 호출 전에 자동으로 한 지식 저장소 검색" 으로 정의하고 LLM 이 부른 지식 저장소 도구(`ai_tool`)와 인과가 다르다고 구분한다. 반면 [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md)·[AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)·[RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) 은 지식 저장소 검색이 LLM 의 도구 호출로만 일어나고 미리 채우지(prefill) 않는다고 적는다. 현재 구현에서 검색 서비스를 부르는 곳은 지식 저장소 도구(`kb_*`) 경로와 디버그 API 뿐이다(분석 단계 확인). 같은 충돌이 [RAG 검색 §미결 사항](../CLE-KB/CLE-KB-SEARCH.md#미결-사항) 에도 올라 있다. 그래서 `rag` 행은 실제로 LLM 도구 호출 결과를 자동 검색처럼 보여 줄 수 있다. `rag` 정의를 "도구 호출이 가져온 청크의 타임라인 표시" 로 고칠지, LLM 호출 전 자동 검색 기능을 새로 만들지 결정 필요.

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

대화 스레드를 도입한 동기, 선택지 비교, v1·v2 경계, 옛 `conversationHistory` 필드를 없앤 이유는 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 의 Rationale 에 있다. 이 절은 자료구조·영속화에 관한 결정만 다룬다. 렌더 규칙에 관한 결정은 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 에 있다.

### 출처 접두를 `turn.text` 에 넣지 않는다

LLM payload 표현(접두가 붙음)과 스레드 본문(원문)은 층이 다르다. `text` 에 넣으면 세 가지 문제가 생긴다. (1) UI 가 원문을 보여 줄 때 사용자가 오인한다. (2) 스레드를 다른 LLM 프로바이더나 포매터로 보낼 때 접두를 걷어 내는 후처리가 필요하다. (3) DB 저장 형태에도 접두가 박혀 나중에 정리하기 어렵다. 빌더 단계에서 붙이면 셋 다 피한다.

### 사용자 입력 마커는 저장하고 화면에서만 지운다

마커는 프롬프트 주입 방어용이라 저장하고 발행하는 텍스트에 그대로 둔다. 버튼 라벨 같은 일급 데이터는 `data.buttonLabel` 같은 필드로 따로 보장한다. 마커를 없애지 않고 화면에서만 지우는 근거는 [대화 미리보기 §렌더 규칙을 데이터 모델과 분리한다](../CLE-EXEC/CLE-EXEC-PREVIEW.md#렌더-규칙을-데이터-모델과-분리한다) 에 있다.

### `system_error` 를 별도 출처 값으로 둔다

멀티턴 AI Agent(나중에는 다른 LLM 노드도)가 `output.error` 와 함께 끝날 때 대화 스레드 안에 인라인으로 표시할 `system_error` 출처를 새로 뒀다. 이 값은 프런트엔드 store·내역 화면의 출처 값으로만 더한다(백엔드 다섯 값은 그대로). 백엔드가 별도 항목으로 쌓지 않고 프런트엔드가 WS 에러 이벤트(`node.failed`, 에러가 설정된 `node.completed`)로 그 자리에 합성한다. 기준은 `output.error` 하나다. 프런트엔드 렌더 층에서 출처 단독 분기를 유지하면서 스레드의 자연 순서를 지키고, `system` 행과 모양·뜻·조작이 모두 달라 별도 출처가 맞다.

- 기존 `system` 출처를 `data.kind` 판별자로 다시 쓰는 안: 출처의 1:1 시각 매핑을 1:N 으로 나눠 매핑표의 단순함을 잃는다. `system_error` 에는 재시도 버튼이 있어 읽기 전용 `system` 메모와 의미 부담도 다르다.
- 별도 store 필드로 나누는 안: 실시간 대화 스레드의 자연 순서를 잃고, 도구 호출 묶음 정책과의 상호작용을 다시 설계해야 한다.

값을 더할 때 모든 처리 분기 위치를 등록하는 것은 [인터랙션 타입 레지스트리](CLE-IX-TYPES.md) 가 강제한다. 변환 함수는 AST 가드가, 렌더 분기는 TS exhaustive switch 가 막는다. 실패해도 대화를 지우지 않는 store 정책(Inv-6)과 `system` 행과의 시각 구분 근거는 [대화 미리보기 §새 실행만 대화를 지운다](../CLE-EXEC/CLE-EXEC-PREVIEW.md#새-실행만-대화를-지운다-inv-6) 에 있다.

### `rag` 를 프런트엔드 합성 출처로 둔다

지식 저장소 검색을 대화 타임라인의 일급 이벤트로 보이기 위해 `rag` 출처를 프런트엔드 합성 값으로 뒀다. 백엔드 다섯 값은 그대로이고 1차 소스는 `meta.turnDebug[].ragSources` 다. 이 소스를 고른 이유, `ai_tool` 을 다시 쓰지 않는 이유, "대화 턴 1차 소스는 스레드" 원칙과의 관계, 옛 데이터 한계는 [대화 미리보기 §`rag` 줄을 보조 관찰성 레인으로 둔다](../CLE-EXEC/CLE-EXEC-PREVIEW.md#rag-줄을-보조-관찰성-레인으로-둔다) 에 있다. 이 검색이 무엇을 나타내는지는 [미결 사항](#미결-사항) 이다.

### 입력 대기 때 스레드를 실행 행에 저장한다

영속화의 "새 DB 컬럼 없음" 전제를 영속 park 재개에 한해 바꿔 `Execution.conversation_thread jsonb NULL` 컬럼을 새로 뒀다. park 직전 `context.conversationThread` 전체 스냅샷을 이 컬럼에 커밋하고 rehydration 이 여기서 손실 없이 되살린다.

- **풀려는 어긋남**: 실행 엔진과 이 규약은 rehydration 이 대화 스레드를 되살린다고 약속했으나, 실제 구현(`rehydrateContext`)은 빈 스레드(`createEmptyConversationThread()`)로 되돌려 park 뒤 재시작이나 다른 인스턴스 재개 때 스레드·`runningSummary`·멀티턴 누적이 사라졌다. 프로세스 안 실행 컨텍스트는 Redis 영속이 없어 재개하는 인스턴스가 되살릴 매체가 없었다. 이 컬럼이 그 매체를 준다.
- **실행 수준 컬럼 하나인 이유**: v1 스레드는 실행당 하나(`id: 'default'`)라 실행 범위 컬럼이 자연스럽다. 노드 실행에 흩어 저장하면 교차 노드 조회가 N+1 이다. park 마다 "지금 스레드 전체" 를 한 행에 덮어쓰면 마지막 쓰기가 곧 최신 스냅샷이라 재개 로드가 단순하다(O(1)).
- **기각한 대안: 컬럼 없이 파생 보기로 다시 만들기**: rehydration 이 노드 실행 저장(`output.interaction`·`output.result.messages`)에서 스레드를 다시 만드는 안이다. 여러 노드의 Presentation·AI 항목을 정확한 `seq`·timestamp·출처로 끼워 맞추는 정책은 실행 내역 보기용으로 v2 UI(EH-DETAIL-12)에 넘긴 미해결 과제다. `runningSummary`·`summarizedUpToSeq` 같은 스레드 메타는 노드별 출력에 저장되지 않아 손실 없이 되살릴 수 없다. 직접 스냅샷이 손실 없고 단순하다. 내역 화면용 파생 보기는 소비처가 달라 그대로 둔다.
- **"새 컬럼 없음" 원칙과의 관계**: 옛 원칙은 실행 내역 재구성에는 노드별 저장으로 충분하다는 판단이었고, 영속 재개 요구는 다루지 않았다. 이 컬럼은 채워지지 않았던 요구(손실 없는 재개)를 위한 별도 매체라 원칙을 뒤집지 않고 적용 범위를 나눈다.
- **공개 조회에 싣는 소비처가 늘었다(2026-07-09)**: 이 컬럼의 1차 목적은 영속 재개지만, EIA 상태 조회가 입력 대기일 때 이 스냅샷을 `context.conversationThread` 에 읽기 전용으로 싣는다. 임베드 웹채팅 위젯의 새로고침 기록 복원을 5분 SSE 버퍼나 서버 재시작과 관계없이 지원하려는 것이다([EIA 수신 API와 SSE](CLE-EIA-INBOUND.md)). 이미 SSE `waiting_for_input` 으로 공개 중인 데이터를 REST 로 다시 싣는 것이라 새 민감 표면이 아니다. 노드 핸들러가 항목 텍스트에 민감한 중간 결과를 남기지 않는다는 제약은 그대로이고, 이 불변식은 SSE 발행과 상태 조회가 함께 쓰는 `redactThreadForPublic` 가 출구에서 강제한다. 자유 텍스트(`turns[].text`·`runningSummary`)와 구조화 필드(`turns[].data`·`presentations[].payload` 는 깊은 가리기, `toolCalls[].arguments` 는 JSON 을 깨지 않는 가리기)를 가린다. 공개 경로 한정이고 내부 rehydration·LLM 주입은 원문을 쓴다. 적용 범위의 기준은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이다. 저장 목적은 park 재개이고, 소비처는 (a) rehydration, (b) SSE 입력 대기 발행, (c) 상태 조회 세 곳이다.
