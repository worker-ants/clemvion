# Cross-Spec 일관성 검토 결과

대상: `plan/in-progress/spec-draft-conversation-ui-contract.md`
검토 기준: `spec/**` 기존 문서와의 충돌 여부
검토일: 2026-05-19

---

## 발견사항

### 1. [INFO] §9.7 store mutation 표에서 WS 이벤트 type prefix 불일치

- **target 위치**: §9.7 — WS 이벤트 → store 변환 계약 표 (이벤트 열)
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.1, §4.4
- **상세**: target §9.7 표는 이벤트를 `tool_call_started`, `tool_call_completed`, `ai_message`, `waiting_for_input` 로 기재한다. WebSocket protocol spec §4.1 의 공식 이벤트 타입은 `execution.tool_call_started`, `execution.tool_call_completed`, `execution.ai_message`, `execution.waiting_for_input` 처럼 `execution.` prefix 를 사용한다. spec 전체에서 이 prefix 는 일관되게 유지된다(§4.2 명령 타입도 `execution.*`). §9.7 의 축약 표기가 구현 단계에서 오인될 소지가 있다.
- **제안**: §9.7 표의 이벤트 열을 `execution.tool_call_started` 등 공식 type 으로 교정하거나, 표 상단에 "이하 `execution.` prefix 생략" 주석을 명시한다.

---

### 2. [INFO] §9.7 `waiting_for_input` 조건절이 WS spec 의 `interactionType` 분기와 미정합

- **target 위치**: §9.7 표 4행 — `waiting_for_input (interactionType=ai_conversation)`
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.4 — `interactionType` 값 목록
- **상세**: WebSocket spec §4.4 는 `interactionType` 가능값을 `form` / `buttons` / `ai_conversation` 세 가지로 정의한다. target §9.7 은 `ai_conversation` 만 명시해 REPLACE + MERGE orphan 정책을 적용한다고 기술하는데, 이것은 의미적으로 정확하다. 다만 `form` / `buttons` interactionType 으로 도착하는 `waiting_for_input` 이 store 에 미치는 영향(conversation timeline 관점)이 §9.7 에 언급되지 않아, 향후 구현자가 세 interactionType 을 모두 고려해야 하는지 모를 수 있다. WS spec §4.4.5 는 `conversationThread` 가 "모든 interactionType" 에 선택적으로 동봉될 수 있다고 명시한다.
- **제안**: §9.7 표에 주석 1줄 추가 — "form / buttons interactionType 의 경우 conversationThread 가 동봉된 때만 REPLACE 적용; store 의 tool live row 는 보존" — 또는 행을 분리해 세 interactionType 을 명시한다.

---

### 3. [INFO] §9.A `threadTurnsToConversationItems` 사용처에 `parseHistoryMessages` 미언급

- **target 위치**: §9.A — 세 변환 path 의 책임 표 (`threadTurnsToConversationItems` 행 "사용처" 열)
- **충돌 대상**: `spec/conventions/conversation-thread.md` §9.5 — "적용 진입점" 목록
- **상세**: 기존 §9.5 는 `threadTurnsToConversationItems` 의 strip 적용 진입점으로 (1) `messagesToConversationItems`, (2) `threadTurnsToConversationItems`, (3) `parseHistoryMessages` 세 곳을 열거한다. target §9.A 의 세 변환 path 표에서 `threadTurnsToConversationItems` 의 "사용처" 는 `handleWaitingForInput (live 1차 source)` 만 기재하고 `parseHistoryMessages` 가 누락돼 있다. §9.5 와 §9.A 사이에 진입점 목록이 불일치한다.
- **제안**: §9.A 표의 `threadTurnsToConversationItems` 사용처 열에 `parseHistoryMessages (history rebuild)` 를 추가한다.

---

### 4. [INFO] §9.6 parent 판별 조건 `toolCalls?.length ≥ 1` — ConversationTurn 스키마와 표기 불일치

- **target 위치**: §9.6 — parent 분류 조건 2항
- **충돌 대상**: `spec/conventions/conversation-thread.md` §1.2 — `ConversationTurn.toolCalls` 필드 정의
- **상세**: `conversation-thread.md` §1.2 는 `toolCalls?` 를 `Array<{id,name,arguments}>` 로 정의한다. target §9.6 은 `toolCalls?.length ≥ 1` 로 참조해 동일 필드를 사용하는 것으로 보이나, `≥ 1` 표기가 TypeScript 가 아닌 수학 기호여서 구현 레퍼런스로서의 명확성이 낮다. 표기 방식만의 문제이며 의미 충돌은 없다.
- **제안**: `toolCalls?.length >= 1` 또는 `toolCalls != null && toolCalls.length > 0` 으로 표기를 통일하거나, "§1.2 의 `toolCalls` 배열이 존재하고 비어있지 않은 경우" 처럼 자연어로 서술한다.

---

### 5. [INFO] §9.6 children 흡수 범위 기준에서 `assistantToolCalls.length` 출처 불명

- **target 위치**: §9.6 — "같은 turn 의 후행 `ai_tool` turn 들 … `assistantToolCalls.length` 개까지 **children** 으로 흡수"
- **충돌 대상**: `spec/conventions/conversation-thread.md` §1.2
- **상세**: §1.2 의 `ConversationTurn` 에는 `assistantToolCalls` 라는 필드가 없다. 존재하는 필드는 `toolCalls?` (source='ai_assistant' 한정) 이다. target §9.6 이 참조하는 `assistantToolCalls` 가 `turn.toolCalls` 를 의미하는 것으로 추정되나, 이름이 달라 혼동 여지가 있다.
- **제안**: `assistantToolCalls.length` 를 `turn.toolCalls.length` (§1.2 필드명) 으로 교정하여 스키마와 일치시킨다.

---

### 6. [INFO] §9.7 carry-over 대상 필드(`toolStatus`, `durationMs`, `error`) 가 ConversationTurn 스키마에 미정의

- **target 위치**: §9.7 — `ai_message` REPLACE 행의 carry-over 항목
- **충돌 대상**: `spec/conventions/conversation-thread.md` §1.2
- **상세**: §1.2 의 `ConversationTurn` 필드 목록에는 `toolStatus`, `durationMs`, `error` 가 없다. 이 필드들은 store 의 내부 표현(ConversationItem 또는 tool row) 에 존재하는 것으로 보이며, WebSocket spec §4.4 의 `tool_call_completed` payload 에는 `status`, `durationMs`, `error?` 가 있다. §9.7 이 "store 의 prev 항목에서 carry-over" 라고 기술하므로, carry-over 대상은 ConversationTurn 이 아닌 UI store item 임을 추정할 수 있다. 그러나 이 distinction 이 §9.7 본문에 명시되지 않아, 구현자가 ConversationTurn 스키마를 확장해야 하는지 오인할 수 있다.
- **제안**: §9.7 에 "(carry-over 대상은 store 내부 ConversationItem 의 runtime 필드이며, §1.2 의 ConversationTurn 스키마 확장은 불필요)" 라는 주석을 추가한다.

---

### 7. [INFO] §9 prologue 의 `waiting_for_input` payload 에서 `conversationThread` 가 always-present 처럼 묘사

- **target 위치**: §9 prologue — mermaid sequenceDiagram 의 `BE->>FE: waiting_for_input (thread snapshot)` 노트
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.4.5 — `conversationThread` 선택적 동봉
- **상세**: WS spec §4.4.5 는 `conversationThread` 가 `waiting_for_input` payload 에 **선택적으로(optional)** 동봉된다고 명시한다. target 의 sequenceDiagram 은 `waiting_for_input` 이 항상 thread snapshot 을 포함하는 것처럼 묘사되어 선택성이 가려진다. 다이어그램은 설명을 위한 happy-path 묘사이므로 실질 충돌은 아니지만, optional 여부를 다이어그램 노트에 병기하면 오인을 줄일 수 있다.
- **제안**: 다이어그램 note 에 "(conversationThread: optional)" 표기를 추가한다.

---

### 8. [INFO] §9.10 S5 시나리오에서 "thinking text + tool_use" 처리가 §9.6 의 조건과 alignment 필요

- **target 위치**: §9.10 시나리오 표 S5 — "LLM 이 thinking text + tool_use 동시 emit"
- **충돌 대상**: target §9.6 — parent 분류 조건 3항 `isAssistantContentBlank(text)`
- **상세**: §9.6 은 세 조건을 모두 만족해야 parent 로 분류한다고 명시한다. S5 에서 "thinking text" 는 `isAssistantContentBlank` 가 false 를 반환하므로 parent 가 아닌 표준 chat bubble + ToolCallBadge 가 된다. S5 의 "기댓값" 기술("parent 그룹 아님 — 본문 + ToolCallBadge 동시 노출")은 §9.6 과 일치한다. 그러나 "thinking text" 가 `text` 필드에 담기는지, 아니면 별도 content block 에 담기는지(Anthropic extended_thinking API 의 경우)가 §1.2 ConversationTurn 스키마에 명시되지 않아, `isAssistantContentBlank` 입력값의 출처가 불명확하다.
- **제안**: §9.8 `isAssistantContentBlank` 사용처 1(그룹 분류)에 "입력은 `turn.text`" 임을 명시한다. 또한 Anthropic extended_thinking 처럼 `text` 와 별도 content block 이 공존하는 케이스의 처리 방침(turn.text 에 thinking text 가 이미 반영됨 또는 별도 필드)을 §1.2 또는 §9.8 에 주석으로 남긴다.

---

## 요약

target 문서 (§9.6 ~ §9.A 신설) 는 기존 `spec/conventions/conversation-thread.md` §9 를 자연스럽게 확장하며, `spec/5-system/6-websocket-protocol.md` 의 이벤트 정의 및 `conversationThread` 선택성과 근본적인 모순은 없다. 발견된 8건은 모두 INFO 등급으로, WS 이벤트 type prefix 축약 표기·carry-over 대상 필드의 스키마 귀속 미명시·`assistantToolCalls` 필드명 불일치 등 구현 단계 혼동을 야기할 수 있는 표현 비일관성이다. 데이터 모델 충돌, API 계약 모순, 요구사항 ID 충돌, 상태 머신 불일치, RBAC 충돌, 계층 책임 이탈은 발견되지 않았다. target 을 채택하면 기존 spec 을 그대로 유지하면서 UI 계약 공백을 메울 수 있다.

---

## 위험도

LOW
