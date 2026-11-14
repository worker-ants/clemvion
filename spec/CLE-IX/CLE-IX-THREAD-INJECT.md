---
id: "CLE-IX-THREAD-INJECT"
title: "대화 스레드 — 텍스트 변환과 AI 노드 주입"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-IX-THREAD"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-IX-THREAD"]
area: "CLE-IX"
content_hash: "4646eae3b10b3da44f361bc7923d91352fb61aab1009fb64f6d1f6b618e5e8a5"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "1fc7adb30f6d1a48ca7249e4146a063870fd3c0b19f6138054122d343916c0f5"
etag: "sha256-61185d0a1a25b03b9c22d05200f0310538b67df013f83fff894cb5a7f4827285"
---
## 개요

이 문서는 [대화 스레드](CLE-IX-THREAD.md) 의 하위 문서로 항목 `text` 변환 규칙, 출처 접두와 사용자 입력 마커, AI 노드의 스레드 주입, `$thread` 표현식을 정한다. 마커·접두의 공통 규칙은 부모의 [규칙](CLE-IX-THREAD.md#규칙) 이 정본이다.

## 텍스트 변환 규칙

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

## 출처 접두

messages 모드의 `[from <nodeLabel>] ` 접두와 system_text 모드의 스레드 렌더 헤더는 LLM payload 빌더(`mapTurnsToChatMessages`, `renderThreadAsSystemText`)가 붙인다. 항목은 다른 프로바이더나 포매터에서도 다시 쓸 수 있는 원문 본문을 보관한다.

- **저장·발행 형태**: 접두는 한 번 붙은 뒤 LLM 호출 메시지 기록의 일부로 쌓여 `output.result.messages` 에 함께 저장되고, WebSocket `ai_message.messages[]`·`waiting_for_input.conversationConfig.messages[]` 에도 그대로 나간다. LLM 이 다음 턴에서도 출처를 알려면 접두가 메시지 기록 안에 있어야 하기 때문이다. 이 발행 메시지에는 전송 출처 표시 `source: 'injected'` 가 함께 붙는다([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)).
- **UI 노출 피하기**: [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md#데이터-소스) 는 접두가 든 발행 메시지 대신 접두 없는 스레드 스냅샷(원문 `turn.text`)을 1차 소스로 써서 사용자 오인을 막는다. 발행 메시지는 LLM 디버그 패널(Request·Response·LLM Usage) 전용이고, 거기서는 "Raw payload" 토글로 원문임을 밝힌다.

## 사용자 입력 마커

`renderInteractionText`(백엔드 `thread-renderer.ts`)는 프롬프트 주입을 막으려고 사용자 출처 텍스트(폼 제출값·버튼 라벨·URL)를 `[user-input]…[/user-input]` 마커로 감싼다.

| 항목 | 정책 | 비고 |
|---|---|---|
| `[user-input]…[/user-input]` | LLM 쪽 의무(`presentation_user` 한정). Presentation 노드의 사용자 출처 텍스트를 감싼다. `ai_user` 는 감싸지 않는다 | system_text 모드 sanitize 의 일부 |
| 마커가 든 `turn.text`·`output.result.messages[].content` | 그대로 저장·발행 | LLM 기록 보존이 1차 목적 |
| UI 노출 | 사용자에게 보이기 전에 정규식으로 지운다 | 사용자는 마커를 보지 않는다. 지우는 위치는 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) |
| 출처 접두 밖의 임의 인라인 마커 | 새로 들이지 않는다([규칙](CLE-IX-THREAD.md#규칙) 6) | 필요하면 이 규약을 먼저 고친다 |
| 라벨·이벤트·메타 | `turn.data` 일급 필드가 기준([규칙](CLE-IX-THREAD.md#규칙) 7) | 카드 본문 렌더 규칙 |

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

## 구현 위치

- `codebase/backend/src/shared/conversation-thread/thread-renderer.ts` (`renderInteractionText`·`applyCap`)
- `codebase/backend/src/nodes/ai/shared/conversation-context-injection.ts`, `conversation-context-schema.ts`
- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`, `ai-agent.schema.ts`
- 전체 목록은 상위 문서 [대화 스레드](CLE-IX-THREAD.md) 의 「구현 위치」에 있다.

## Rationale

### 출처 접두를 `turn.text` 에 넣지 않는다

LLM payload 표현(접두가 붙음)과 스레드 본문(원문)은 층이 다르다. `text` 에 넣으면 세 가지 문제가 생긴다. (1) UI 가 원문을 보여 줄 때 사용자가 오인한다. (2) 스레드를 다른 LLM 프로바이더나 포매터로 보낼 때 접두를 걷어 내는 후처리가 필요하다. (3) DB 저장 형태에도 접두가 박혀 나중에 정리하기 어렵다. 빌더 단계에서 붙이면 셋 다 피한다.

### 사용자 입력 마커는 저장하고 화면에서만 지운다

마커는 프롬프트 주입 방어용이라 저장하고 발행하는 텍스트에 그대로 둔다. 버튼 라벨 같은 일급 데이터는 `data.buttonLabel` 같은 필드로 따로 보장한다. 마커를 없애지 않고 화면에서만 지우는 근거는 [대화 미리보기 §렌더 규칙을 데이터 모델과 분리한다](../CLE-EXEC/CLE-EXEC-PREVIEW.md#렌더-규칙을-데이터-모델과-분리한다) 에 있다.
