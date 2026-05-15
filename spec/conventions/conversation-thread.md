# Conversation Thread (대화 스레드)

> 관련 문서: [Spec 실행 엔진 §6.1](../5-system/4-execution-engine.md#61-컨텍스트-구조) · [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md) · [Spec AI 공통 §11](../4-nodes/3-ai/0-common.md#11-conversation-context) · [CONVENTIONS Principle 4.5](./node-output.md#45-interactiondata-payload-규격) · [Spec 표현식 언어 §4.4](../5-system/5-expression-language.md#44-thread-속성)

워크플로우 한 실행 동안 발생하는 사용자 인터랙션과 AI 대화 turn 을 시간순으로 누적하는 1급 컨텍스트. AI Agent 노드가 노드 설정 (`contextScope`) 으로 자동 주입받는다.

---

## 1. 자료구조

### 1.1 ConversationTurnSource

| 값 | 발생원 |
|---|---|
| `presentation_user` | Form / Carousel / Table / Chart / Template 의 `output.interaction.{type}` 가 `form_submitted` / `button_click` / `button_continue` 일 때 |
| `ai_user` | AI Agent multi-turn 의 `output.interaction.type='message_received'` 시점 |
| `ai_assistant` | AI Agent (single·multi) 의 final assistant 응답 |
| `ai_tool` | KB / MCP / condition tool 결과 (opt-in 시 `includeToolTurns: true`) |
| `system` | 명시적으로 push 한 system text (예약, v1 자동 누적 없음). **주의**: AssistantMessage `role: 'system'` 과 무관 — 워크플로우 레벨의 수동 push 전용 (예: 초기 시스템 안내 turn) |

### 1.2 ConversationTurn

| 필드 | 타입 | 설명 |
|---|---|---|
| `seq` | Number | 단조 증가. append 순서 == 시간 순서. thread 내 unique |
| `nodeId` | UUID | turn 을 발생시킨 그래프 노드 |
| `nodeLabel` | String | append 시점의 라벨 snapshot (라벨 변경 후에도 표시 일관성) |
| `nodeType` | String | 예: `form`, `carousel`, `ai_agent` |
| `timestamp` | String (ISO 8601) | 서버 시각 |
| `source` | ConversationTurnSource | §1.1 |
| `text` | String | system_text injection 과 UI 의 1차 텍스트. 빈 문자열 가능 (구조화 데이터만 있는 경우) |
| `data?` | Object | 구조화 원본 — `output.interaction.data` snapshot |
| `toolCalls?` | Array<{id,name,arguments}> | `source='ai_assistant'` 한정. provider 호환성을 위해 messages 모드에서 drop 가능 |
| `toolCallId?` | String | `source='ai_tool'` 한정 |

### 1.3 ConversationThread

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | String | v1 고정값 `"default"` (multi-thread 는 v2). **port 예약어 `'default'` 와 무관** — namespace 분리. 코드에서 `DEFAULT_THREAD_ID = 'default'` 상수 추출 권장 |
| `nextSeq` | Number | 다음 append 시 부여될 seq (== `turns.length`) |
| `turns` | ConversationTurn[] | 시간순 누적 |
| `totalChars` | Number | append 시 갱신되는 누적 char 길이 캐시 (cap 빠른 경로) |

### 1.4 `text` 변환 규칙

| `interaction.type` | text |
|---|---|
| `form_submitted` | `name=John, age=30` (key=value 리스트, 200자 cap, value 가 객체/배열이면 JSON 직렬화) |
| `button_click` | `clicked: <buttonLabel>` (label 미존재 시 `<buttonId>`) |
| `button_continue` | `continued: <url>` (url 미존재 시 `continued`) |
| `message_received` (ai_user) | 메시지 본문 그대로 |
| `ai_agent` final assistant | `output.result.response` 그대로 (CONVENTIONS Principle 8.2 LLM 응답 텍스트 경로) |
| `text_classifier` final assistant (v2) | single-label: `output.result.category`. Multi-label: `output.result.categories.map(c => c.name).join(', ')` (categories 는 객체 배열이라 raw `.join` 불가). |
| `information_extractor` final assistant (v2) | `output.result.extracted` 를 항상 `JSON.stringify` 직렬화 (`responseFormat` 필드는 `ai_agent` 전용 — extractor 는 항상 구조화 출력). |

---

## 2. 자동 누적 컨트랙트

### 2.1 Presentation 노드

`status: 'resumed'` 직전, `output.interaction` 빌드 후 엔진이 자동 push:
- form `interaction.type='form_submitted'` → `source: 'presentation_user'`
- carousel/table/chart/template `interaction.type='button_click' | 'button_continue'` → `source: 'presentation_user'`

> 현재 실행 엔진의 presentation resume 코드는 `'submitted' / 'button_click' / 'button_continue'` 의 legacy status 값을 status 필드에 사용한다 (spec [실행 엔진 §1.3](../5-system/4-execution-engine.md#13-블로킹재개-컨트랙트-nodehandleroutput-status) 의 마이그레이션 노트 참조). 통일된 `'resumed'` 값으로의 마이그레이션은 별도 phase (presentation Principle 1.1 재작성) — 본 컨벤션은 status 값과 무관하게 `interaction.{type, data, receivedAt}` payload 가 emit 되는 시점에 push 가 발화함을 정의한다.

### 2.2 AI Agent

| 시점 | source |
|---|---|
| multi-turn user message 도착 (`output.interaction.type='message_received'`) | `ai_user` |
| multi-turn 매 turn 종료 시 final assistant 응답 (`output.result.response`) | `ai_assistant` |
| multi-turn condition route 시 assistant 응답 (`output.result.response`) | `ai_assistant` |
| single-turn `userPrompt` (resolved) | `ai_user` (1회) |
| single-turn 최종 `output.result.response` | `ai_assistant` (1회) |
| tool-loop 중 assistant + tool result | `ai_assistant` / `ai_tool` (opt-in `includeToolTurns: true` 시에만) |

### 2.3 v1 적용 범위 (push vs inject 구분)

| 동작 | v1 적용 범위 | v2 로드맵 |
|---|---|---|
| **Turn push (누적)** | `ai_agent` 만 — multi-turn user/assistant + single-turn final assistant 자동 push | `text_classifier` / `information_extractor` 도 final assistant push 추가 (§1.4 의 v2 표기 행) |
| **자동 주입 (inject — `contextScope` 활성화)** | `ai_agent` 만 | `text_classifier` / `information_extractor` 도 동일 인터페이스 |

> push 와 inject 를 분리해 정의하는 이유: 다른 AI 노드의 final 응답도 후속 AI Agent 가 thread 로 받게 하려는 의도였으나, 분류·추출 노드 핸들러는 final-assistant 의미 있는 시점이 ai_agent 와 다르고 (text_classifier 는 카테고리, information_extractor 는 구조화 데이터), §1.4 의 변환 규칙도 노드별로 갈라진다. v1 출하 기준은 ai_agent 만이며 (handler 코드에 push hook 존재), 다른 두 노드의 push 는 §1.4 의 변환 규칙이 합의된 v2 에서 활성화.

### 2.4 opt-out

각 노드에 공통 boolean config: `excludeFromConversationThread` (default `false`). `true` 면 해당 노드의 모든 push 가 silent skip. UI 그룹은 `Advanced > Conversation`.

---

## 3. 스코프 규칙

| 컨테이너 | 정책 |
|---|---|
| Sub-workflow (`executeInline`) | parent thread 상속·공유 |
| Background | enqueue 시점 turns 배열까지 복사한 snapshot — 격리 |
| Loop / ForEach / Map / Parallel | parent thread 상속·공유 |

### 3.1 Sub-workflow 상속 근거

`Workflow` 노드의 sync `executeInline` 경로는 부모 `ExecutionContext` 를 그대로 재사용한다 (`recursionDepth` 만 증가). 따라서 sub 안의 AI Agent 도 부모의 thread 를 본다. 사용자가 명시적으로 격리하고 싶으면 async mode 로 호출 (별도 Execution → 별도 thread).

### 3.2 Background 격리 근거

`scheduleBackgroundBody` 가 enqueue 시점에 thread 의 **turns 배열까지 함께 복사한 snapshot** 을 만든다 — 최소 `{ ...thread, turns: [...thread.turns] }` 형태. 단순 reference 복사가 아니라 새 array 인스턴스를 만들어, 백그라운드가 새 turn 을 push 해도 메인 thread 의 `turns` 가 변형되지 않음을 보장한다. ConversationTurn 객체 자체는 immutable (한 번 push 되면 수정되지 않음) 이라 깊은 복사까지 필요하지 않다.

→ 메인 흐름이 이후 발생시킨 turn 은 background 가 못 보고, background 안에서 발생한 turn 은 메인 thread 에 영향 없음. PRD 3 §4.11 ND-BG-05 ("백그라운드 실패가 메인 흐름의 Execution 상태에 영향을 주지 않음") 격리 원칙과 정합.

### 3.3 컨테이너 상속 근거

Loop / ForEach / Map / Parallel 컨테이너는 별도 ExecutionContext 를 만들지 않고 같은 context.nodeOutputCache 를 공유한다. thread 도 같은 정책. iteration 메타 (index 등) 는 thread 에 자동 주입하지 않으며, 필요시 사용자가 `{{ $loop.index }}` 등으로 명시.

---

### 2.5 nextSeq 원자성

`nextSeq` 의 단조 증가는 **단일 ExecutionContext 인스턴스 하에 직렬 실행** 보장에
의존한다. v1 의 in-memory + single-instance 환경에서는 한 execution 의 노드
처리가 한 번에 한 노드씩 진행되므로 (engine 의 `executeNode` 가 sequential)
`appendInternal` 의 `seq = thread.nextSeq; thread.nextSeq = seq + 1` 가
race-free.

다음 시나리오에서는 별도 보장이 필요:
- **Parallel 컨테이너**: 분기들이 같은 thread 에 동시 push 가능. v1 은 Parallel
  내부 thread 사용을 정의하지 않음 (관련 spec follow-up). v2 에서 분기별 child
  thread 또는 merge point 재통합 정책 결정.
- **Multi-instance / Redis 분산**: thread 가 Redis 로 옮겨가면 `INCR` 같은
  atomic operation 또는 lock 필요. v1 은 in-memory only.

---

## 4. 영속화

| 단계 | 저장소 | 비고 |
|---|---|---|
| 실행 중 | `ExecutionContext` (실행 엔진 §6.2 정책에 따라 Redis 포함 직렬화) | `ExecutionContextService.createContext` 가 빈 thread (`{ id: 'default', nextSeq: 0, turns: [], totalChars: 0 }`) 로 초기화. TTL 은 실행 타임아웃 × 2 (execution-engine §6.2) |
| 실행 후 | NodeExecution 분산 저장 | `output.interaction` (presentation, `interaction.type` ∈ form_submitted/button_click/button_continue), `output.messages` (AI 멀티턴 누적 — waiting/resumed 시), `output.result.response` (AI 최종 응답) 가 SoT. thread 자체는 재구성 가능한 derived view |
| WS payload | `EXECUTION_WAITING_FOR_INPUT` 의 `conversationThread` snapshot 동봉 (선택) | UI 가 라이브 thread 표시 가능 |

**v1 은 신규 DB 컬럼 도입 없음.** 향후 사용자 요구 명확해지면 `Execution.conversation_thread jsonb NULL` 컬럼 마이그레이션 검토.

---

## 5. AI Agent 자동 주입

`spec/4-nodes/3-ai/1-ai-agent.md` §1 의 5 신규 필드:

| 필드 | 타입 | 기본값 |
|---|---|---|
| `contextScope` | `none` / `thread` / `lastN` | `none` |
| `contextScopeN` | Integer | `20` |
| `contextInjectionMode` | `messages` / `system_text` | `messages` |
| `includeToolTurns` | Boolean | `false` |
| `excludeFromConversationThread` | Boolean | `false` |

주입 위치는 `processMultiTurnMessageInner` 의 매 turn `llmService.chat` 직전 (single-turn 은 첫 chat 직전). messages 배열을 매 turn `[system, ...injectedThread, ...selfHistory]` 로 재빌드 — `injectedThread` 에서 자기 노드가 발생시킨 turn 은 `getThreadExcludingNode` 로 제외해 중복 방지.

### 5.1 messages 모드 매핑

| turn.source | role | content prefix |
|---|---|---|
| `presentation_user` | `user` | `[from <nodeLabel>] ` |
| `ai_user` | `user` | (없음) |
| `ai_assistant` | `assistant` | (없음, `toolCalls` 보존 또는 drop) |
| `ai_tool` | `tool` | (없음, `toolCallId` 매칭) |
| `system` | `system` | (없음) — **Anthropic API 비호환**: messages 배열 내 `role: 'system'` 미지원. provider 가 anthropic 이면 `system_text` 모드 또는 별도 분기로 우회 필수. v1 자동 push 없으므로 현재 실질 문제 없음 (수동 push 도입 시 provider 분기 검증 필수). |

### 5.2 system_text 모드

`thread-renderer` 가 헤더 `[#seq · timestamp · label (type) · source]` + text 본문으로 렌더해 `finalSystemPrompt` 끝에 첨부. KB guidance / condition suffix 보다 뒤.

**Sanitization**: `turn.text` 가 사용자 입력 (form 제출, ai_user 메시지) 에서 유래한 경우 prompt injection 방어를 위해 `LlmService` 의 user content sanitizer 와 동일한 방식으로 sanitize 한다.

### 5.3 Cap (v1 — char 기반)

| 상수 | 값 | 동작 |
|---|---|---|
| `MAX_INJECTED_TURNS` | `100` | 초과 시 가장 오래된 turn 부터 drop, `[... N earlier turns omitted ...]` 마커 1줄 prepend |
| `MAX_TURN_TEXT_CHARS` | `4000` | 초과 시 truncate (`...` 접미사) |
| `MAX_INJECTED_CHARS` | `200_000` | 합산 char 추가 안전망 |

`meta.contextInjection: { appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }` 디버그 echo. `appliedScope`/`appliedMode` 는 config 값의 echo 가 아니라 **실제 적용 결과** 를 표기 (예: `contextScope='thread'` 더라도 thread 가 비어있으면 `appliedScope='none'`, cap 으로 잘리면 `injectedTurns < turns.length`). Principle 2 (meta = 런타임 측정값) 정합.

---

## 6. Expression 통합

`spec/5-system/5-expression-language.md` §4.4 의 `$thread` 변수:

| 표현식 | 반환 |
|---|---|
| `$thread.turns` | ConversationTurn[] (readonly) |
| `$thread.length` | Number |
| `$thread.text` | String — system_text 렌더 결과 |

자동 주입과 독립적으로 사용자가 명시 참조 가능 (예: 별도 `transform` 노드에서 thread 가공).

---

## 7. v2 로드맵

- **Multi-thread**: 사용자 지정 key 로 한 execution 안에서 여러 thread 운영. presentation 노드가 어느 thread 에 push 할지 명시할 수 있게.
- **Token-aware cap**: 현재 char-based cap (§5.3) 을 provider tokenizer 기반으로 — 모델별 정확한 토큰 budget 고려.
- **`text_classifier` / `information_extractor` 자동 push + 주입**: §1.4 의 변환 규칙이 합의된 후 두 노드 핸들러에 push hook 추가, contextScope 적용 확장.
- **DB 컬럼 신설**: `Execution.conversation_thread jsonb` 컬럼 마이그레이션 검토 — 현재는 NodeExecution 분산 저장이라 cross-node 조회가 N+1.
- **실행 이력 화면의 ConversationThread 크로스노드 뷰**: EH-DETAIL-06 과 함께 v2 UI spec 정의.
- **Parallel 컨테이너 + Thread 정책**: 현재 §2.5 가 "Parallel 내부 thread 사용을 정의하지 않음" 으로 명시. 분기별 child thread 또는 merge point 재통합 정책 결정 필요. 사용 케이스 정의 후 spec write.
- **`$thread.text` lazy 평가**: 현재 `buildExpressionContext` 가 호출마다 전체 thread 를 system_text 로 즉시 렌더 (성능 hot path). 측정 결과 비용이 크면 `Object.defineProperty` lazy getter 또는 `$thread.text` 를 별도 key 로 분리해 명시 요청 시만 렌더.
- **Service 모듈 위치 정리**: 현재 `backend/src/modules/execution-engine/conversation-thread/` 에 types/renderer/service 가 함께 있음. types/renderer 는 pure 라 향후 `src/shared/` 또는 별도 `@workflow/conversation-thread` 패키지로 분리해 nodes/ai → execution-engine 의 의존 그래프를 단순화 검토.
- **Storage cap evict 정책**: §STORAGE_MAX_TURNS=500 은 LRU style FIFO drop. 향후 사용자 인터랙션 우선 보존 등 정책 옵션 검토.

---

## 8. Rationale

설계 결정의 근거는 [Spec AI Agent §12](../4-nodes/3-ai/1-ai-agent.md#12-rationale) Rationale 섹션에 단일 인라인 — Conversation Thread 도입 동기, 선택지 비교, v1/v2 경계, `conversationHistory` deprecated 사유. 본 문서는 컨벤션의 단일 진실 공급원이며 동기·역사는 AI Agent 본문에 둔다.

---

## 9. CHANGELOG

| 일자 | 변경 |
|---|---|
| 2026-05-14 | 신규 작성 — Conversation Thread 정식 도입 |
