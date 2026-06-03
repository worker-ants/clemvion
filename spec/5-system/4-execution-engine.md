---
id: execution-engine
status: partial
code:
  - codebase/backend/src/modules/execution-engine/**
  - codebase/frontend/src/lib/websocket/use-execution-events.ts
  - codebase/frontend/src/lib/websocket/ws-client.ts
pending_plans:
  - plan/in-progress/execution-engine-residual-gaps.md
  - plan/in-progress/spec-sync-execution-engine-gaps.md
---

# Spec: 실행 엔진 상세

> 관련 문서: [Spec 아키텍처 개요](../0-overview.md) · [Spec 에러 처리](./3-error-handling.md) · [Spec 실행/디버깅](../3-workflow-editor/3-execution.md) · [데이터 모델 - Execution](../1-data-model.md#213-execution) · [Spec External Interaction API](./14-external-interaction-api.md)

---

## 1. 실행 상태 머신

### 1.1 Execution 상태

```
                    ┌─ cancelled
                    │
                    ├─ waiting_for_input ─┬─ running (재개)
pending → running ──┤                     └─ cancelled
                    ├─ completed
                    │
                    └─ failed ─ running (retry_last_turn 재진입, opt-in)
```

> ※ Rehydration (다른 인스턴스가 사용자 입력을 받아 재개) 은 `waiting_for_input` 의 **내부 transition** — 다이어그램상 self-loop 로 표시하지 않으나 §7.5 의 재개 경로가 이를 수행한다. 상태 enum 자체는 변경되지 않는다.
>
> ※ `failed → running` 은 **`execution.retry_last_turn` 재진입 전용** 전이다 (아래 표 · §1.3). AI Agent multi-turn 의 retryable error 종결로 `failed` 가 된 Execution 을, 동일 nodeId 의 **새 NodeExecution row** 를 구동(WS `node.started`/`node.completed` 발행)하기 위해 `running` 으로 되돌린다. **이것은 Execution entity 레벨 전이**이며, 동시에 §1.2 의 새 NodeExecution row 가 생성된다(기존 `failed` row 는 전이시키지 않음 — §1.2 비고). 일반 노드 실패 경로에는 적용되지 않고, 코드상 `allowRetryReentry` opt-in (state-machine) 으로만 허용해 실패 종결 실행의 우발적 부활을 차단한다.

| 상태 | 설명 | 전이 조건 |
|------|------|-----------|
| `pending` | 실행 요청됨, Worker 할당 대기 | 트리거/수동 실행 시 생성 |
| `running` | 실행 중 | Worker가 태스크 소비 시 |
| `waiting_for_input` | 사용자 입력 대기 중 — Form 노드, 버튼이 설정된 Presentation 노드, 또는 AI Agent Multi Turn 대화 입력 대기 | Form 노드 도달, 버튼이 설정된 Presentation 노드 도달, 또는 AI Agent Multi Turn 대화 턴 대기 시 |
| `completed` | 정상 완료 | 모든 노드 실행 완료 |
| `failed` | 실패 | 노드 에러 + Stop Workflow 정책, 또는 시스템 에러 |
| `cancelled` | 사용자 취소 | 사용자가 실행 중단 요청 |

> ※ **`skipped` 는 NodeExecution 전용** — Execution 레벨에는 `skipped` 상태가 없다(§1.2). 모든 노드가 `skipped`(노드 비활성 / 조건 분기 미선택 / 도달 불가)로 종료되어 에러 없이 dispatch 루프가 자연 종료되면 Execution 은 **`completed`** 로 마감한다(정상 종료 — 구현: dispatch 루프 종료 후 `ExecutionStatus.COMPLETED`). 따라서 실행 이력 화면([2-navigation/14-execution-history.md](../2-navigation/14-execution-history.md))의 필터에도 Execution 레벨 `skipped` 항목은 없으며, all-skipped 실행은 `completed` 로 표시된다.

**허용되는 상태 전이:**

| From | To | 조건 |
|------|----|------|
| pending | running | Worker 할당 |
| pending | cancelled | 큐 대기 중 취소 |
| running | completed | 정상 종료 |
| running | failed | 에러 발생 |
| running | cancelled | 사용자 취소 |
| running | waiting_for_input | Form 노드 도달, 버튼이 설정된 Presentation 노드 도달, 또는 AI Agent Multi Turn 대화 턴 대기 |
| waiting_for_input | running | 사용자 폼 제출, 버튼 클릭, 또는 AI 대화 메시지 수신/대화 종료 (실행 재개) |
| waiting_for_input | failed | AI Agent multi-turn turn 처리 중 LLM throw (429/timeout/connection) — `handleAiTurnError` 가 [§7.9](../4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트) shape (`port='error', status='ended'`) 으로 finalize |
| waiting_for_input | waiting_for_input | 다른 인스턴스에서 재개 (rehydration) — Execution.status enum 자체는 변하지 않고 `pendingContinuations` 가 새 인스턴스에 재등록 (§7.5) |
| waiting_for_input | cancelled | 사용자 취소, 타임아웃, 또는 rehydration 실패의 단말 케이스 (`RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE` — §7.5) |
| failed | running | **`execution.retry_last_turn` 재진입 전용** (`allowRetryReentry` opt-in) — AI Agent multi-turn retryable error 종결로 `failed` 가 된 Execution 을 동일 nodeId 의 새 NodeExecution row 구동을 위해 `running` 으로 전이. 성공 종결 시 다시 `completed`, 재실패 시 `failed`, replay 중 cancel 도달 시 `cancelled`. 일반 경로엔 없음 — [§1.3](#13-블로킹재개-컨트랙트-nodehandleroutput-status) / [6-websocket-protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) |

> **원자성 보장**: `running ↔ waiting_for_input` 전이는 짝이 되는 `NodeExecution` 상태 변경 (`waiting_for_input` / `completed`) 과 **단일 DB 트랜잭션** 으로 묶여 commit / rollback 된다. 서버가 두 save 사이에 크래시해도 `Execution` 과 `NodeExecution` 의 상태 불일치가 발생하지 않는다 (구현: `ExecutionEngineService.updateExecutionStatus` 의 `linkedNodeExec` 파라미터). WebSocket 이벤트 발행은 트랜잭션 commit 후 수행한다. `waiting_for_input → failed` 전이도 동일한 원자성 — `NodeExecution.status=FAILED` save + `Execution.status=FAILED` 가 단일 트랜잭션으로 묶이고, WS 이벤트 순서는 `NODE_FAILED` → `EXECUTION_FAILED`.

### 1.3 블로킹/재개 컨트랙트 (NodeHandlerOutput `status`)

개별 노드는 `NodeHandlerOutput.status` 로 엔진 흐름 제어 디렉티브를 표현한다. 공통 블로킹/재개 컨트랙트 (CONVENTIONS Principle 4):

| `status` | 의미 | 방출 시점 |
|-----------|------|-----------|
| `undefined` | 일반 완료 (대부분 노드) | 비블로킹 노드 최종 출력 |
| `waiting_for_input` | 사용자 입력 대기 | Form · Carousel(button) · Chart(button) · Table(button) · Template(button) · AI Agent multi-turn · Information Extractor multi-turn |
| `resumed` | 사용자 입력을 수신한 직후 | 재개 tick (observability-only, 라우팅 효과 없음) |
| `ended` | multi-turn 종료 | LLM 대화가 `completed` / `user_ended` / `max_turns` / `max_retries` / `error` 중 하나로 최종 정산 시 |
| `requires_integration` | 외부 통합이 연결되지 않아 준비 필요 | send_email 등 integration 미연결 시 (Stage 4) |
| `requires_playwright` | PDF 렌더러 필요 | PDF 노드 |

**재개 상태 (resumed) 구체 규약** — CONVENTIONS §4.1, 4.4, 4.5:

```
[노드 도달]
   ↓
 status: "waiting_for_input"
 output: <런타임 계산값 only — Principle 1.1>
   ↓ (사용자 입력 수신)
 status: "resumed"
 output: {
   ...waiting 시점 런타임 필드,
   interaction: {
     type: "form_submitted" | "button_click" | "button_continue" | "message_received",
     data: <type 별 payload>,
     receivedAt: ISO8601
   }
 }
   ↓ (multi-turn LLM 의 경우 종료 조건 도달 시)
 status: "ended"
 port: <end reason 기반 포트>
 output: { result: {...} } 또는 { error: {...} }
```

**재개 state 직렬화 필드** (`NodeHandlerOutput` top-level — `_resumeState`):

- AI 계열(ai_agent / information_extractor) multi-turn 핸들러가 다음 턴을 처리하기 위해 보관하는 내부 상태. CONVENTIONS Principle 0 의 5필드 외 허용 예외.
- 실행 엔진은 `_resumeState` 를 읽어 다음 턴을 재구성한다. 옛 `_multiTurnState` 키는 Stage 2 rename + Stage 5 제거가 완료되어 현재 코드·페이로드에 존재하지 않는다.
- expression resolver 는 이 필드를 expose 하지 않는다 (internal-only).
- 최종 출력 저장 시 엔진(`stripControlFields()`)이 `_resumeState` 를 제거한다. 옛 `_multiTurnState` 도 strip 대상에 남겨 두나 이는 구버전 페이로드 호환용 defensive guard 일 뿐, 현재 경로에서는 해당 키가 생성되지 않는다.

**보존 예외 — `_resumeCheckpoint`** (재시작 후 재개용 — §7.5 rehydration, **`ai_agent` 노드 한정**):

- **적용 범위**: `ai_agent` multi-turn 한정. checkpoint allow-list 와 재구성기(`buildRetryReentryState`)가 `ai_agent` 의 `_resumeState` shape 에 맞춰져 있다. 다른 `ai_conversation` 핸들러(`information_extractor`)는 고유 state 필드를 가지므로 checkpoint 를 영속하지 않으며, 재시작 후 재개 시 graceful reset (§7.5 `RESUME_INCOMPATIBLE_STATE`) — 이는 본 기능 도입 이전과 동일한 동작이다 (회귀 없음). `information_extractor` 의 rehydration 지원은 후속 작업.
- waiting_for_input 진입(`emitAiWaitingForInput`) 과 매 turn 영속(`handleAiMessageTurn`) 시점에 엔진이 `_resumeState` 의 **credential-strip 부분집합**을 `_resumeCheckpoint` 로 운반해 `NodeExecution.outputData._resumeCheckpoint` 에 DB 영속한다.
- **`stripControlFields()` 는 `_resumeCheckpoint` 를 보존** (downstream 노드 input 전달 시에는 `_resumeState` 와 함께 제거 — internal-only).
- shape: `_retryState` 와 동일 부분집합(messages / turnCount / model / temperature / maxTokens / knowledgeBases / RAG / MCP / pendingFormToolCall? 등)이되 **`expiresAt`(TTL) 없음** — 대화는 장시간 idle 후에도 재개 가능(waiting Execution 은 무기한 보존) — 과 **`lastUserMessage` 없음** — 재개 시 도착한 사용자 메시지(continuation payload)를 그대로 첫 turn 으로 처리. credential / context-binding 필드(`llmConfigId`/`workspaceId` 등)는 미동봉 (`maskSensitiveFields` 와 동일 정책), 재개 시 `node.config` 재평가로 재유도.
- 소비: §7.5 rehydration 이 `outputData._resumeCheckpoint` 로드 → `buildRetryReentryState`(`_retryState` 와 공유) 로 `_resumeState` 재구성 → `waitForAiConversation` 재진입 → continuation payload 가 다음 turn 으로 처리. `_resumeCheckpoint` 부재(이 기능 배포 이전 진입한 waiting row) 또는 손상 시 graceful reset (§7.5 `RESUME_INCOMPATIBLE_STATE`).

**보존 예외 — `_retryState`** (retryable error 종결 시):

- AI Agent multi-turn 이 retryable error (HTTP 429 / 5xx / network timeout — `output.error.details.retryable === true`) 로 종결될 때, `buildMultiTurnFinalOutput` 이 `_resumeState` snapshot 을 `_retryState` 로 운반한다 (top-level, Principle 0 예외).
- **`stripControlFields()` 는 `_retryState` 를 보존** — `NodeExecution.outputData._retryState` 로 DB 영속.
- `_retryState` shape: `_resumeState` 의 부분집합 + `expiresAt: ISO 8601` (TTL — 기본 60분, env `AI_RETRY_STATE_TTL_MINUTES` override). credential 제거 정책은 `_resumeState` 와 동일 (`maskSensitiveFields` boundary strip). expression resolver / autocomplete 비노출.
- 소비 (atomic): WS 명령 `execution.retry_last_turn` ([Spec WebSocket §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server)) 이 `nodeExecutionId` 로 `_retryState` 를 lookup → `expiresAt` 검증 → **동일 트랜잭션에서 `_retryState` 키 제거(소비) + 새 NodeExecution row spawn** → continuation 큐(`execution-continuation`)에 `retry_last_turn` job publish → **worker 가 spawn 된 row 를 `_retryState` 로 seed 해 multi-turn loop 재진입**. 키 제거가 affected=1 인 쪽만 진행해 동시 retry 중복 spawn 차단. TTL 만료 또는 이미 소비된 `_retryState` 는 `RETRY_STATE_NOT_FOUND`. (재진입은 worker 컨텍스트 필요 — WS gateway 동기 수행 불가하므로 continuation bus 로 handoff.)
- 상세 SoT: [CONVENTIONS node-output Principle 4.2.1](../conventions/node-output.md#421-보존-예외--_resumecheckpoint--_retrystate), [Spec AI Agent §7.9](../4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트).

**`interaction.data` payload 규격** (CONVENTIONS §4.5):

| `interaction.type` | `data` 형태 | 적용 노드 |
|---|---|---|
| `form_submitted` | `{ [fieldName]: value }` | `form` |
| `button_click` | `{ buttonId, buttonLabel, selectedItem? }` | `carousel` / `table` / `chart` / `template` |
| `button_continue` | `{ buttonId, buttonLabel, url }` | link 타입 버튼 |
| `message_received` | `{ content, role: "user" }` | `ai_agent` / `information_extractor` multi-turn |

> presentation 의 `interaction` 과 AI Agent multi-turn 의 `interaction.type='message_received'` 는 모두 [ConversationThread](../conventions/conversation-thread.md#22-ai-agent) 에 자동 push 되어 후속 AI Agent 가 자동 주입 받을 수 있다. push 시점은 nodeOutputCache 갱신과 같은 단일 트랜잭션.

> presentation 노드의 재개 상태는 `status: 'resumed'` 로 통일돼 있다 (Stage 3 presentation Principle 1.1 재작성 완료). 옛 `'submitted'` / `'button_click'` / `'button_continue'` 는 더 이상 status 값으로 쓰이지 않으며, 해당 의미는 `interaction.type` enum 으로만 표현된다.

### 1.2 NodeExecution 상태

```
                    ┌─ completed
                    │
pending → running ──┤─ failed
                    │
                    ├─ cancelled
                    │
                    ├─ skipped
                    │
                    └─ waiting_for_input ──┬─ completed (폼 제출, 버튼 클릭, AI 대화 정상 종료)
                                           │
                                           └─ failed   (AI Agent multi-turn turn 처리 중 LLM throw)
```

| 상태 | 설명 |
|------|------|
| `pending` | 실행 대기 (선행 노드 완료 대기) |
| `running` | 실행 중 |
| `waiting_for_input` | 사용자 입력 대기 중 — Form 노드, 버튼이 설정된 Presentation 노드, 또는 AI Agent Multi Turn 대화 입력 대기. turn 처리 중 LLM throw (429/timeout/connection) 시 `failed` 로 전이 (구현: `handleAiTurnError` — spec/4-nodes/3-ai/1-ai-agent.md §7.9 shape 으로 finalize). 또는 rehydration 실패(§7.5 의 `RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE` 세 케이스) 시에도 `failed` 로 전이 — 동반 Execution 은 `cancelled` 로 마감 |
| `completed` | 정상 완료 |
| `failed` | 실행 실패 (노드 핸들러 throw + Stop/route-error 정책, 또는 시스템 에러). **rehydration 인프라 실패도 `failed`** (§7.5) — 취소가 아닌 결함이므로 |
| `cancelled` | 외부 cancellation signal (`ExecutionContext.abortSignal`) 로 노드의 외부 I/O 가 중단됨 — 핸들러가 throw 한 `AbortError`(`error.name === 'AbortError'`)를 엔진이 `failed` 가 아닌 `cancelled` 로 분류. dispatch 직전 이미 abort 된 경우도 동일(핸들러 미실행). 생산자: Parallel `cancel-others-on-fail` / 사용자 cancel / (향후) Workflow timeout. 종료 시 `execution.node.cancelled` WS 이벤트 발행. SoT: [node-cancellation §5](../conventions/node-cancellation.md#5-aborterror-분류) |
| `skipped` | 건너뜀 (노드 비활성, Skip Node 정책, 조건 분기 미선택) |

> **`retry_last_turn` 재진입은 새 row 를 spawn 한다**: AI Agent multi-turn 의 retryable error 로 `failed` 가 된 NodeExecution row 는 **전이시키지 않고 그대로 둔다**. `execution.retry_last_turn` 은 동일 nodeId 의 **새 NodeExecution row 를 `running` 으로 생성**(`_retryState` seed)해 마지막 turn 을 replay 한다 — 따라서 한 nodeId 가 복수 row 를 가질 수 있고, WS 명령이 `nodeExecutionId` (nodeId 아님) 로 row 를 식별하는 이유다 ([6-websocket-protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server)). §1.1 의 `failed → running` 은 이 새 row 구동에 따른 **Execution entity** 전이이며, 기존 `failed` row 의 전이가 아니다.

---

## 2. 그래프 순회

### 2.1 토폴로지 정렬 기반 실행 (순환 참조 지원)

워크플로우 실행 시 노드 그래프를 토폴로지 정렬(Topological Sort)하여 실행 순서를 결정한다.
순환 참조(Cyclic Graph)를 지원하기 위해 **back-edge 기반 실행** 방식을 사용한다.

```
1. 워크플로우의 모든 노드와 엣지를 로드
2. 컨테이너 내부 노드(container_id != null)를 글로벌 그래프에서 제외
3. Tool Area 노드(tool_owner_id != null)를 글로벌 그래프에서 제외
4. DFS로 back-edge (순환을 형성하는 간선) 식별
5. back-edge를 제거한 forward-edge만으로 DAG 구성 → 토폴로지 정렬
6. pointer 기반 순차 실행:
   - 분기는 선택된 포트만 실행
   - 노드 실행 후 back-edge가 활성화(포트 매칭)되면 pointer를 되감아 재실행
   - 노드별 최대 반복 횟수 초과 시 실행 중단 (에러)
```

#### 순환 참조 제한

| 설정 | 환경 변수 | 기본값 | 설명 |
|------|-----------|--------|------|
| 노드별 최대 반복 횟수 | `MAX_NODE_ITERATIONS` | `100` | 단일 노드가 한 실행에서 반복될 수 있는 최대 횟수. `0` 설정 시 무제한. |

#### back-edge 활성화 조건

- 소스 노드의 출력에 `_selectedPort`가 있는 경우: back-edge의 `sourcePort`가 선택된 포트와 일치할 때만 활성화
- 소스 노드의 출력에 `_selectedPort`가 없는 경우: **항상 활성화** (무조건 루프백)
  - 따라서 `_selectedPort`를 출력하지 않는 일반 노드(pass-through)에 back-edge를 연결하면 탈출 불가능한 무한 루프가 됨
  - 이 경우 `MAX_NODE_ITERATIONS` 가드에 의해 최종적으로 실행이 중단됨
  - **순환 참조는 반드시 분기 노드(Switch, If/Else 등)의 특정 포트에서만 back-edge를 연결해야 안전함**
- 활성화된 back-edge가 있으면 해당 타겟 노드부터 재실행, 재실행 구간의 포트 라우팅 스킵 상태가 초기화됨

#### graph-level 순환 내 blocking 노드

컨테이너 body(Loop / ForEach / Map)는 blocking 노드(form / buttons / AI Agent multi-turn)를 금지하지만(§3.2 body 서브그래프 제약), **글로벌 그래프 레벨의 back-edge 순환은 blocking 노드를 포함하거나 타겟으로 가질 수 있다.** 이는 차단하지 않는다.

- 순환 본문에 blocking 노드가 있으면, 순환이 그 노드를 재방문할 때마다 노드가 **재실행되어 사용자에게 다시 입력을 요청한다**(`waiting_for_input` 재진입). 이는 이중 실행 결함이 아니라 **의도된 루프 시맨틱**이다 — 각 iteration 마다 새 `NodeExecution` 레코드가 생성되고, 직전 iteration 의 레코드는 그대로 `COMPLETED` 로 남는다.
- 재프롬프트 횟수는 `MAX_NODE_ITERATIONS` 가드로 bound 된다. 순환 탈출은 분기 노드(Switch / If·Else 등)의 포트 라우팅으로만 가능하므로, blocking 노드를 포함한 순환도 반드시 분기 노드의 특정 포트에서 back-edge 를 연결해야 한다(위 활성화 조건 참조).
- **`retry_last_turn` 재진입 경로**(WS §4.2 / `spec/4-nodes/3-ai/1-ai-agent.md §7.9`)도 동일 — 재시도 성공한 AI Agent 노드가 back-edge 소스이면, 재개된 순회는 일반 실행과 동일하게 순환에 재진입한다. 실패 이전에 이미 응답 완료된 blocking 노드가 순환 본문에 속해 있으면 다시 프롬프트된다. 이는 retry 특이 결함이 아니라 "재진입 종결 후 graph 진행은 일반 `COMPLETED` 노드와 동일" 정책의 귀결이다.

#### `_selectedPort` 메타데이터 처리

`_selectedPort`는 해당 노드의 엣지 라우팅에만 사용되는 내부 메타데이터이다. 다운스트림 노드의 input으로 전달될 때 자동으로 제거(strip)된다. 이를 통해 pass-through 노드(Variable, Set Variable 등)를 거쳐도 이후 노드가 잘못 skip되지 않는다.

### 2.2 컨테이너 내부 독립 정렬

컨테이너 노드(Loop, ForEach, Map) 내부의 자식 노드는 독립적으로 토폴로지 정렬한다. Background 는 컨테이너 멤버십(`container_id`) 모델을 사용하지 않고 `background` 포트 엣지로 본문을 식별한다 — §3.3 참조.

- 컨테이너 실행 시점에 내부 노드의 실행 순서를 별도 산출
- 내부 그래프는 글로벌 DAG 사이클 검사에서 제외 (반복 구조 허용)
- 컨테이너 경계를 넘는 엣지는 존재하지 않음 (포트를 통해서만 데이터 전달)

### 2.3 Tool Area 노드 처리

Tool Area에 등록된 노드(tool_owner_id != null)는 그래프 순회에 참여하지 않는다.

- AI Agent의 LLM이 도구 호출을 요청할 때만 **on-demand**로 실행
- 실행 결과는 AI Agent 노드의 tool call 컨텍스트로 반환
- NodeExecution 레코드는 정상 생성 (parent_execution_id = AI Agent의 NodeExecution)

---

## 3. 컨테이너 실행

컨테이너 노드(Loop / ForEach / Map)는 공통적으로 `body` 출력 포트로 진입하여 서브그래프를 반복 실행하고, body 내부 노드 중 **`emit` 입력 포트에 연결된 노드**의 출력을 각 반복의 결과로 수집하여 `done` 출력 포트로 배열을 내보낸다.

### 3.0 공통 수집 모델 — `emit` 포트

각 컨테이너는 `emit`이라는 **입력 포트**를 가진다. body 서브그래프의 한 노드가 그 출력을 container의 emit 포트로 연결하면, 해당 노드의 iter별 출력이 결과 배열 원소로 수집된다.

**검증 규칙 (엔진이 컨테이너 실행 시작 전에 강제)**
- emit 포트에 연결된 body 노드가 **0개** → `CONTAINER_MISSING_EMIT` 에러로 실행 실패.
- emit 포트에 연결된 body 노드가 **2개 이상** → `CONTAINER_MULTIPLE_EMIT` 에러로 실행 실패.
- emit source가 port routing으로 해당 iter에 도달하지 못한 경우 → 그 iter의 수집 값은 `undefined`.

### 3.1 Loop 실행

```
1. count 평가 → N회
2. plan = planContainerBody(loopNode, nodes, edges)  // emit 검증 포함
3. for i in 0..N:
   a. $loop.index = i, $loop.count = N 바인딩
   b. 컨테이너 내부 노드 그래프를 토폴로지 순서로 실행
   c. plan.emitSource의 출력을 results[i]로 수집
   d. breakCondition 평가 → 충족 시 조기 종료
4. results 배열을 done 포트로 전달
```

- 각 반복은 독립된 NodeExecution 세트 생성 (iteration 인덱스 기록).
- `maxIterations` 초과 시 `MAX_ITERATIONS_EXCEEDED` 에러.
- 중첩 Loop 시 외부 `$loop`가 자동으로 save/restore된다(`LoopExecutor`).

### 3.2 ForEach / Map 실행

ForEach와 Map은 동일한 `ForEachExecutor`를 공유한다. 시맨틱만 다르다(ForEach=side effect, Map=transform).

```
1. arrayField(또는 Map의 inputField) 평가 → 배열 추출
2. plan = planContainerBody(containerNode, nodes, edges)  // emit 검증 포함
3. for each item, index in array:
   a. $item = 현재 항목, $itemIndex = index 바인딩
   b. 컨테이너 내부 노드 그래프를 토폴로지 순서로 실행
   c. plan.emitSource의 출력을 results[index]로 수집
   d. errorPolicy에 따라 에러 처리:
      - stop    → 즉시 실패
      - skip    → results[index] = { _skipped: true, error: { code, message } }
      - continue → 동일. 에러 정보는 NodeExecution에도 기록
4. results 배열을 done 포트로 전달
```

- 결과 배열은 원본 배열과 **동일 인덱스**를 유지한다. 이를 통해 다운스트림에서 원본 ↔ 결과 매칭이 가능하다.
- 중첩 ForEach 시 외부 `$item` / `$itemIndex`가 자동으로 save/restore된다(`ForEachExecutor`).

#### body 서브그래프 제약

- **back-edge(순환)** 금지 — `Container body contains back-edges` 에러.
- **blocking 노드**(form / buttons / ai_conversation) 금지 — body 내부에서 사용자 대기 상태가 발생하면 iter 반복 의미가 모호해지므로 차단.
- body 내부에 또 다른 컨테이너 중첩은 허용. 스코프 체인은 §3.4 참조.

### 3.4 중첩 컨테이너 스코프

컨테이너가 중첩된 경우(예: Loop > ForEach), 내부 컨테이너는 **스코프 체인**을 통해 외부 컨텍스트를 참조할 수 있다.

#### 3.4.1 스코프 체인 규칙

| 규칙 | 설명 |
|------|------|
| 읽기 가능 | 내부 컨테이너에서 외부 컨테이너의 컨텍스트 변수를 읽을 수 있다 |
| 쓰기 불가 | 내부 컨테이너에서 외부 컨테이너의 컨텍스트 변수를 직접 수정할 수 없다 |
| Shadowing | 동명 변수가 존재하면 내부(현재 스코프)가 우선한다 |
| `$parent` 접근 | `$parent.loop`, `$parent.item`으로 한 단계 외부 컨테이너 컨텍스트에 명시적으로 접근 |

#### 3.4.2 예시: Loop > ForEach 중첩

```
Loop (외부)                    ForEach (내부)
──────────────                 ──────────────────
$loop.index = 2               $item = "current item"
$loop.count = 10              $item.index = 1
                               $parent.loop.index = 2  (외부 Loop 참조)
                               $parent.loop.count = 10
```

- 내부 ForEach에서 `$loop`를 참조하면 → 외부 Loop의 `$loop` (ForEach는 `$loop` 변수를 생성하지 않으므로 shadowing 없음)
- 내부 ForEach에서 `$item`을 참조하면 → ForEach 자신의 현재 항목
- 외부 Loop에 대해 명시적으로 `$parent.loop`로도 접근 가능

---

### 3.3 Background 실행

> **평면 구조 (PRD 3 §4.12 ND-BG-05)**: Background 는 컨테이너 멤버십(`container_id`) 모델을 사용하지 않는다. 대신 `background` 포트 엣지로 본문 진입점을 식별하고, 별도 BullMQ `background-execution` 큐 + 워커로 비동기 실행한다.

흐름:

```
1. main 포트로 입력 데이터를 즉시 pass-through (메인 흐름 계속)
2. 핸들러 실행 직후 ExecutionEngineService 의 scheduleBackgroundBody() 가
   현재 컨텍스트 스냅샷(variables 얕은 복사 + rawConfig + **conversationThread snapshot —
   `{ ...thread, turns: [...thread.turns] }` 형태로 turns 배열까지 새 인스턴스로 복사**)을 담아 본문 진입점들을
   `background-execution` 큐로 enqueue
3. 워커는 executeBackgroundSubgraph() 에서 background 포트 엣지로부터 forward-reachable
   한 서브그래프를 격리된 컨텍스트로 실행 (parentNodeExecutionId 그룹핑)
4. 백그라운드 완료/실패 시 설정에 따라 알림 — NotificationsService 통해
```

- 메인 Execution과 동일한 `execution_id`를 공유 (NodeExecution 그룹핑·WS 채널·권한 1차 키). 단 **in-memory ExecutionContext Map 키만** background 는 별도 `bg:<executionId>:<backgroundRunId>` 를 써서 부모 컨텍스트와 격리하고 `executeBackgroundSubgraph` 가 자체 finally 로 정리한다 ([Background §4 격리 컨트랙트](../4-nodes/1-logic/12-background.md#4-실행-로직), 분류 SoT [execution-context 규약 원칙 4](../conventions/execution-context.md#원칙-4--engine-internal-infrastructure-fields-_-prefix)). 본문 노드의 `parentNodeExecutionId` 가 Background 노드 자신의 NodeExecution id 를 가리킨다
- 백그라운드 실패가 메인 흐름의 Execution 상태에 영향을 주지 않음
- conversationThread 는 enqueue 시점 snapshot 으로 격리된다 — background 안에서 발생한 turn 은 메인 thread 에 영향 없고, 그 반대도 마찬가지. PRD §4.12 ND-BG-05 격리 원칙과 일관 ([Spec Conversation Thread §3.2](../conventions/conversation-thread.md#32-background-격리-근거))
- 백그라운드 실패 시 `notifyOnFailure=true`이면 **워크스페이스 Admin 에게 인앱 알림**:
  - Notification 엔티티 생성 (`type: background_failed`, 수신자: 워크스페이스 Admin, `channel: in_app`). 이메일 채널·실행자(executed_by) 수신은 현재 미지원 — 단일 boolean `notifyOnFailure` 로만 제어한다 ([Background 노드 §1](../4-nodes/1-logic/12-background.md) 이 SoT, 구현 `background-execution.processor.ts`).
- Execution 상세 화면에서 Background 실행 결과를 별도 섹션으로 표시 (성공/실패 불문) — 노드 카드는 메인 카드와 동일하되 [Run Results Drawer §10.15](../3-workflow-editor/3-execution.md#1015-background-본문-실행-결과) 의 본문 실행 결과 섹션을 펼쳐 본문 NodeExecution 타임라인을 확인. 본문 실행 모니터링 API 는 [Background 모니터링 API](../4-nodes/1-logic/12-background.md#8-모니터링-api) 참조

---

## 4. Worker 모델

> **구현 상태 — §4.1~4.3 은 미구현 (Planned)**: 아래 §4.1 아키텍처 다이어그램(별도 `Redis BQ (Task Queue)`)·§4.2 태스크 단위(1 Worker = 1 NodeExecution, `taskId`/`timeout`/`retryCount` 태스크 메시지)·§4.3 수평 확장(Worker 인스턴스 수 env, 큐 파티셔닝, 우선순위 큐)은 **목표 아키텍처(aspirational)** 이며 현재 코드에는 없다. 현 구현은 일반 노드를 별도 task-queue 없이 `runExecution` 의 **in-process while-loop 으로 직접 dispatch** 한다 (§2.1 / §9.3 — `task-queue` 미존재 확정). 별도 BullMQ 큐는 `background-execution`(§3.3) 과 `execution-continuation`(§7.4) 둘뿐이고, per-node Worker·heartbeat·우선순위 큐는 어느 것도 구현돼 있지 않다. §4.4 이벤트 발행 sink 정책만 현 구현과 일치한다. 본 절의 미구현 표면 추적: `plan/in-progress/execution-engine-residual-gaps.md` 및 `plan/in-progress/spec-sync-execution-engine-gaps.md`.

### 4.1 아키텍처 (미구현 — Planned)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Execution  │────→│  Redis BQ    │────→│  Worker 1   │
│  Engine     │     │  (Task Queue)│     │  Worker 2   │
│  (Producer) │     │              │     │  Worker N   │
└─────────────┘     └──────────────┘     └─────────────┘
```

### 4.2 태스크 단위 (미구현 — Planned)

- **1 Worker = 1 NodeExecution**: 각 Worker는 한 번에 하나의 노드 실행을 처리
- 태스크 메시지 형식:

```json
{
  "taskId": "uuid",
  "executionId": "uuid",
  "nodeId": "uuid",
  "nodeType": "ai_agent",
  "input": { ... },
  "context": {
    "variables": { ... },
    "loopContext": null,
    "itemContext": null
  },
  "timeout": 30000,
  "retryCount": 0
}
```

### 4.3 수평 확장 (미구현 — Planned)

| 항목 | 설명 |
|------|------|
| Worker 인스턴스 수 | 환경 변수로 설정 (기본: 4) |
| 스케일 아웃 | Worker 프로세스를 추가하여 처리량 증가 |
| 큐 파티셔닝 | 워크스페이스별 큐 분리 가능 (멀티테넌트 격리) |
| 우선순위 큐 | 수동 실행 > 트리거 실행 > 스케줄 실행 |

### 4.4 이벤트 발행 sink — `WebsocketService` 단일 sink 정책

> **결정**: 실행 엔진의 외부 이벤트 발행 (`NODE_STARTED` / `NODE_COMPLETED` / `EXECUTION_*` / `AI_MESSAGE` 등) sink 는 **`WebsocketService` 가 canonical** 이며, 별도 추상화 (`IExecutionEventEmitter` 같은 인터페이스 / Nest `EventEmitter2`) 를 도입하지 않는다.

근거:

- **단일 sink** — 본 시스템에서 외부 이벤트 소비자는 WebSocket 클라이언트 1종 뿐. 다중 sink 가 가시화되기 전까지 추상화는 YAGNI.
- **분산은 Continuation Bus (§7.4) 가 담당** — 인스턴스 간 fan-out 은 BullMQ 영속 큐 `execution-continuation` 이 처리하므로, 이벤트 발행 추상화와 분산 동작은 직교. 옛 Redis pub/sub 채널 `execution:continuation` 은 폐기 (§Rationale "Durable Continuation").
- **순환 의존 처리** — `ExecutionEngineService ↔ WebsocketService` 의 순환은 NestJS 표준 패턴인 `forwardRef(() => WebsocketService)` 로 해결. 이는 Nest 권장 패턴이며 회피해야 할 안티패턴이 아님.
- **테스트 격리** — Spec 테스트에서는 `Partial<WebsocketService>` mock 으로 충분. 추상화 인터페이스를 위한 별도 noop 구현체 불필요.

> 향후 외부 sink (Webhook 콜백, 텔레메트리 export 등) 가 실제로 추가될 때 본 결정을 재검토한다.

[Spec External Interaction API](./14-external-interaction-api.md) 의 Outbound Notification Webhook 과 외부 SSE 어댑터가 도입된 이후에도 **엔진 레벨 단일 sink 정책은 유지** ([Spec EIA §R10](./14-external-interaction-api.md#r10-websocketservice-단일-sink-정책의-확장)). NotificationDispatcher / SSE 어댑터는 모두 엔진 외부 facade 레이어에 위치시켜 엔진 코드가 외부 sink 종류를 알 필요가 없도록 분리한다.

---

## 5. 노드 핸들러 계약

### 5.1 NodeHandler 인터페이스

모든 노드 유형은 공통 핸들러 인터페이스를 구현한다.

```ts
interface NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult;
  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput>;
}

interface NodeHandlerOutput {
  /**
   * **원본(pre-evaluation) 입력 설정의 echo**. expression(`{{ ... }}`) 이 포함된 필드는
   * 평가 전 형태 그대로 echo 하고, 평가 결과는 `output.*` 에 둔다 (CONVENTIONS Principle 7).
   * 민감 정보(credential 본체) 는 포함하지 않는다.
   */
  config: Record<string, unknown>;

  /** 실제 생산된 결과값 — 배열/객체/primitive 모두 허용. */
  output: unknown;

  /** 부가 실행 정보. durationMs, statusCode, tokensUsed 등 관측 메타데이터. */
  meta?: Record<string, unknown>;

  /** 라우팅 디렉티브. 값은 노드 정의의 출력 포트 식별자. */
  port?: string;

  /** 엔진 흐름 제어. 'waiting_for_input' | 'requires_integration' | 'requires_playwright' 등. */
  status?: string;
}
```

| 메서드 | 설명 |
|--------|------|
| `validate(config)` | 노드 설정의 유효성 검사. 워크플로우 저장/실행 전에 호출. 에러 시 `{ valid: false, errors: [...] }` 반환 |
| `execute(input, config, context)` | 노드 실행. `config` 는 expression 평가 후 값. `context.rawConfig` 로 평가 전 원본을 함께 받는다. `NodeHandlerOutput` 을 반환한다 |

**config vs output 원칙** (CONVENTIONS Principle 1.1 / 7)

- `NodeHandlerOutput.config` 는 "노드가 **어떻게 설정됐는가**" — 워크플로 작성자가 입력한 **원본(pre-evaluation)** 형태. 후속 노드는 `$node["X"].config.<field>` 로 참조한다.
- `output` 은 "노드가 **무엇을 생산/사용했는가**" — expression 평가 결과·실행 결과. 후속 노드는 `$node["X"].output.<field>` 로 참조한다.
- 따라서 expression 이 포함된 필드는 두 영역에 서로 다른 값이 존재한다 (예: `config.subject = "Hello {{ name }}"`, `output.subject = "Hello Alice"`).
- `meta` 는 실행 부산물(시간, 외부 상태코드, 토큰 사용량). 비즈니스 로직이 아닌 관측 정보.
- `port`, `status` 는 엔진이 읽어 흐름을 결정하는 디렉티브 — 일반 downstream 참조는 권장하지 않는다.

**민감 정보 정책**

- `config`에는 `integrationId` UUID, 액션 이름, 파라미터만 echo한다.
- credentials 객체(access_token, password, api_key, private_key 등)는 handler 내부에서만 사용하고 반환값에 포함하지 않는다.
- AES-256-GCM으로 저장된 credential을 복호화해 외부 서비스에 전달한 뒤, 반환값을 구성할 때는 credential을 떨어뜨린다.

### 5.2 `$node` Expression 네임스페이스

Expression resolver는 각 노드의 `NodeHandlerOutput`을 그대로 `$node[nodeKey]`에 노출한다. Legacy `$node[key] = { output: ... }` wrapper는 제거되었다.

```ts
// expression-resolver.service.ts
$node[resolvedKey] = executionContext.nodeOutputCache[nodeId];
```

| 표현식 | 반환 |
|--------|------|
| `$node["SendEmail"].output.messageId` | 메일 전송 결과 messageId |
| `$node["SendEmail"].config.subject` | 노드 설정의 **원본** 제목 (예: `"Hello {{ name }}"` — expression 미평가 형태) |
| `$node["SendEmail"].output.subject` | 실제 발송된 제목 (예: `"Hello Alice"` — expression 평가 결과) |
| `$node["HTTP"].meta.statusCode` | HTTP 응답 상태코드 |
| `$node["HTTP"].output.response` | 응답 본문 |
| `$node["IfElse"].port` | 실행 시 선택된 포트 (`'true'` / `'false'`) |
| `$node["Form"].status` | `'waiting_for_input'` 등 엔진 디렉티브 |

expression 이 포함된 필드는 `.config.*` 에서 **원본** 을, `.output.*` 에서 **평가 결과** 를 얻는다. expression 이 포함되지 않은 필드(예: `mode`, `chartType`)는 두 영역의 값이 동일하므로 `.config.*` 만 사용해도 충분하다.

`nodeKey`는 노드 라벨(중복 시 `#N` suffix)과 노드 UUID 두 방식 모두 지원한다. `.output`·`.config`·`.meta`·`.port`·`.status` 외의 필드는 정의되지 않는다.

### 5.3 Port Selector 패턴

조건 분기 노드(`if-else`, `switch`, `text-classifier`, `http-request`, `ai-agent` 조건 라우팅)는 반환값에 `port` 필드를 함께 설정한다:

```ts
return {
  config: { condition: '...' },
  output: forwardedData,      // downstream으로 전달될 입력
  port: 'true' | 'false',     // 엔진이 이 포트의 엣지만 활성화
};
```

엔진의 `applyPortSelection(output)`은 `output.port`를 읽어 `_selectedPort`를 기록하고, downstream 노드의 input은 `output.output`이 된다.

Legacy `{ port, data }` 패턴은 제거되었으며, 이행 기간 호환성을 위해 `output.data`가 있으면 `output.output`으로 자동 보정한다.

### 5.4 NodeHandlerRegistry

```
interface NodeHandlerRegistry {
  register(nodeType: string, handler: NodeHandler) → void
  get(nodeType: string) → NodeHandler
}
```

- 시스템 시작 시 모든 빌트인 노드 핸들러를 레지스트리에 등록
- 마켓플레이스를 통해 설치된 커스텀 플러그인 노드도 동일 레지스트리에 등록
- 미등록 nodeType 조회 시 `UNKNOWN_NODE_TYPE` 에러

### 5.5 표현식 해석 단계

노드 실행 전, config 객체의 문자열 필드에 포함된 `{{ }}` 표현식을 해석한다. 엔진은 **원본(rawConfig) 과 평가 결과(resolvedConfig) 모두** 핸들러에 노출하여 핸들러가 echo 와 실행을 분리할 수 있게 한다.

```
1. handler.validate(rawConfig) → 원본 config의 구조 유효성 검사
2. resolvedConfig = ExpressionResolver.resolveConfig(rawConfig, exprContext, nodeType)
   - config 객체를 재귀 순회하며 문자열 값의 {{ }} 패턴을 evaluate()
   - 전체가 {{ expr }}인 경우: 평가 결과의 원래 타입 유지 (number, object 등)
   - 혼합 텍스트 + 표현식: 결과는 항상 string
   - number, boolean, null: 패스스루
   - 1회 패스만 수행 (재귀 해석 없음)
3. handler.execute(input, resolvedConfig, { ...context, rawConfig }) → output
```

`context.rawConfig` 는 평가 전 원본 config 의 reference 다. 핸들러가 `NodeHandlerOutput.config` echo 시 사용한다 (CONVENTIONS Principle 7). 핸들러는 평가된 값으로 동작하지만 echo 는 원본을 보존하여 후속 노드의 `$node["X"].config.*` / `$node["X"].output.*` 직교성을 유지한다.

**ExpressionContext 구성**:

| 변수 | 소스 |
|------|------|
| `$input` | 이전 노드 출력 (gatherNodeInput 결과). 트리거 노드에서는 `{ parameters, ...(트리거별 메타) }` |
| `$params` | `$input.parameters`의 축약형. Trigger 노드가 생성한 구조화된 입력 파라미터에 직접 접근 |
| `$node` | nodeMap + nodeOutputCache → 노드 라벨 키 맵. `$node["Label"].output` 형태로 접근 |
| `$var` | context.variables (Variable Declaration/Modification으로 관리) |
| `$execution` | `{ id, workflowId, startedAt, mode }` |
| `$now` | 실행 시점의 현재 시각 (ISO 8601, UTC). 같은 실행 안에서는 동일한 값으로 고정 |
| `$loop` | loopContext (Loop 컨테이너 내부) |
| `$item`, `$itemIndex` | itemContext (ForEach 컨테이너 내부) |
| `$thread` | context.conversationThread | ConversationThread readonly view ([Spec Conversation Thread](../conventions/conversation-thread.md)). v1 은 `turns` / `length` / `text` 만 노출 — 표현식 문법 상세는 [Spec 표현식 §4.4](./5-expression-language.md#44-thread-속성) 참조 |

**핸들러별 제외 규칙**:

| 핸들러 | 제외 키 | 사유 |
|--------|---------|------|
| `code` | `code` | 원시 JavaScript — 자체 런타임(`$input`, `$vars`, `$execution`) 사용 |
| `table` | `columns` | 컬럼 표현식은 `TableHandler` 내부에서 항목별(per-item) 평가 |
| `filter` | `conditions` | 조건은 표현식이 아닌 각 배열 항목 기준 field path |
| `loop` | `breakCondition` | iteration 마다 재평가 (현재 `$loop` / `$var` / `$node[...]` 참조). dispatch 시점 선평가는 `i=0` 으로 고정되고 첫 iteration 전 `$loop` 미정의로 throw |

> SoT: `codebase/backend/src/modules/execution-engine/expression/expression-exclusions.ts` (`EXPRESSION_EXCLUSIONS`). `template` 노드는 별도 제외 항목이 아니다 — 자체 `{{ }}` 파서를 쓰는 것은 핸들러 내부 동작이며 `EXPRESSION_EXCLUSIONS` 에 `template` 키는 등록돼 있지 않다.

> **상세**: 표현식 문법, 내장 함수, 타입 시스템은 [표현식 언어 스펙](./5-expression-language.md) 참조.

### 5.6 노드 실행 흐름

> 현 구현에서 이 흐름은 별도 task-queue 의 Worker 가 아니라 `runExecution` 의 **in-process dispatch loop** 가 노드마다 수행한다 (§4 미구현 banner / §2.1 / §9.3). step 1 의 "태스크 수신"·step 8 의 "태스크 생성" 은 §4 task-queue 모델이 도입되기 전까지 **dispatch loop 의 다음 노드 pointer 진행**으로 이해한다.

```
1. dispatch loop 이 다음 노드를 선택 (§4 task-queue 미도입 — pointer 기반 in-process 진행)
2. registry.get(nodeType) → handler 조회
3. handler.validate(rawConfig) → 유효하지 않으면 즉시 실패 (INVALID_NODE_CONFIG)
4. ExpressionResolver.resolveConfig(rawConfig) → resolvedConfig (§5.5)
5. handler.execute(input, resolvedConfig, { ...context, rawConfig }) → output
6. 출력 정규화: output이 JSON 직렬화 가능한지 확인
7. NodeExecution 레코드에 input, output, status 기록
8. 다음 노드로 진행 (그래프 순회에 따라 pointer 갱신)
```

### 5.7 노드 유형별 리트라이 정책

| 카테고리 | 기본 리트라이 | 설정 가능 | 비고 |
|----------|-------------|-----------|------|
| Integration | 최대 3회, 지수 백오프 | O (maxRetries, retryDelay) | 외부 서비스 일시 장애 대응 |
| AI | 최대 2회, 지수 백오프 | O | LLM 프로바이더 일시 장애 대응 |
| Logic | 리트라이 없음 | X | 결정론적 실행, 재시도 무의미 |
| Data | 리트라이 없음 | X | 결정론적 실행, 재시도 무의미 |
| Flow | 최대 1회 | O | 하위 워크플로우 호출 실패 시 |
| Presentation | 리트라이 없음 | X | UI 렌더링, 재시도 무의미 |

> 사용자가 노드 설정 패널의 에러 처리 정책에서 "Retry"를 선택하면 위 기본값을 오버라이드할 수 있다. [노드 공통 스펙 §2.4](../3-workflow-editor/1-node-common.md#24-에러-처리-정책) 참조.

---

## 6. 실행 컨텍스트

### 6.1 컨텍스트 구조

> 아래 JSON 예시는 핸들러 계약 표면 필드만 보인다. 엔진 내부 `_`-prefix 필드(`_contextKey`, `_executedNodes`, `_resumeState`, `_retryState` — [execution-context 규약 원칙 4](../conventions/execution-context.md#원칙-4--engine-internal-infrastructure-fields-_-prefix))는 핸들러가 소비하지 않으므로 생략한다.

```json
{
  "executionId": "uuid",
  "workflowId": "uuid",
  "nodeExecutionId": "uuid",
  "rawConfig": {
    "subject": "Hello {{ name }}",
    "body": "Welcome, {{ user.firstName }}!"
  },
  "variables": {
    "__workspaceId": "uuid",
    "myVar": "value"
  },
  "nodeOutputCache": {
    "node-uuid-1": { "field": "output data" },
    "node-uuid-2": { ... }
  },
  "loopContext": {
    "index": 3,
    "count": 10,
    "isFirst": false,
    "isLast": false
  },
  "itemContext": {
    "item": { ... },
    "index": 2,
    "isFirst": false,
    "isLast": false
  },
  "conversationThread": {
    "id": "default",
    "nextSeq": 2,
    "turns": [
      { "seq": 0, "nodeId": "...", "nodeType": "form", "source": "presentation_user", "text": "name=Alice, age=30", "timestamp": "2026-05-14T10:00:00.000Z" },
      { "seq": 1, "nodeId": "...", "nodeType": "ai_agent", "source": "ai_assistant", "text": "안녕하세요 Alice님", "timestamp": "2026-05-14T10:00:02.500Z" }
    ],
    "totalChars": 42
  }
}
```

| 필드 | 언제 설정되는가 | 용도 |
|------|----------------|------|
| `executionId` | 실행 시작 시 고정 | Execution/NodeExecution 귀속 |
| `workflowId` | 실행 시작 시 고정 | 표현식 컨텍스트, 사용처 확인 |
| `nodeExecutionId` | 엔진이 handler.execute 호출 직전 주입, 노드별 갱신 | Integration 핸들러가 `IntegrationUsageLog.node_execution_id`로 기록 |
| `rawConfig` | 엔진이 handler.execute 호출 직전 주입, 노드별 갱신 | 노드 정의에 저장된 **원본 config** (expression 미평가). 핸들러가 `NodeHandlerOutput.config` echo 에 사용 (Principle 7). Shallow `Object.freeze` 적용 — top-level mutation 차단, 중첩 객체는 read-only 로 다룬다 |
| `engineResolvedConfigCache` | 엔진이 expression 평가 직후, 노드별로 누적 갱신 | 노드별로 **expression 평가가 끝난 config** 의 snapshot. `runContainerInner` / `runParallel` 같이 핸들러 종료 후 별도 단계에서 동작 파라미터(Loop `count`, Parallel `branchCount`/`maxConcurrency`/`waitAll`, ForEach `errorPolicy` 등) 를 다시 읽어야 하는 경로가 사용한다. **expression 컨텍스트에는 노출하지 않는다** — `$node["X"].config` 는 여전히 raw echo 를 반환해야 한다 (Principle 7 보존). 핸들러가 raw 만 echo 하는 컨테이너의 동작 파라미터가 silent default fallback 되거나 `Number("{{...}}")` 가 NaN 이 되던 문제를 차단 |

**엔진 내부 Map 키 (`_contextKey`)**: `ExecutionContextService` 의 in-memory `Map<key, ExecutionContext>` 라우팅 키. `createContext(executionId, workflowId, options?: { initialVariables?, recursionDepth?, contextKey? })` 에서 Map 키 = `options?.contextKey ?? executionId` — 비-background 호출은 `contextKey` 를 생략해 항상 `executionId` 와 동일(동작 불변). background 본문만 `bg:<executionId>:<backgroundRunId>` 를 전달해 부모 컨텍스트와 키 격리한다 (§3.3, [Background §4](../4-nodes/1-logic/12-background.md#4-실행-로직)). **이 키는 in-memory 전용** — Redis 키 패턴(§9.1)과 무관하다. 결정 SoT: [execution-context 규약 §Rationale](../conventions/execution-context.md#rationale).

**Multi-turn 재개 시 `rawConfig` snapshot 정책**:
- 첫 turn 의 `executeNode` 가 `waiting_for_input` 으로 진입하면 엔진이 `state.rawConfig = Object.freeze({ ...node.config })` 을 자동 snapshot 한다.
- 후속 turn 의 `processMultiTurnMessage(message, state)` 는 state 만 받으므로 (ExecutionContext 미주입), 핸들러가 `state.rawConfig` 로 일관되게 접근한다.
- **의도된 차이**: `context.rawConfig` 는 매 노드 실행 시점의 fresh DB read, `state.rawConfig` 는 첫 turn 시점의 frozen snapshot. 단일 multi-turn 실행 도중 사용자가 워크플로 정의를 변경해도 후속 turn 은 첫 turn 시점의 정의로 일관되게 동작한다 — replay reproducibility.
| `variables.__workspaceId` | 실행 시작 시 주입 (workflow.workspaceId) | Integration 조회, AI LLM 설정 조회 등 워크스페이스 단위 리소스 해소 |
| `variables.*` (그 외) | 트리거·워크플로우 변수 | 표현식 `{{ $variables.X }}` 평가 |
| `conversationThread` | 실행 시작 시 빈 thread (`{ id: 'default', nextSeq: 0, turns: [], totalChars: 0 }`) 로 초기화, 노드 hook 에 의해 누적 | 사용자 인터랙션 + AI 대화 turn 의 단일 진실. `ConversationThreadService.append*` 가 mutation 단일 진입점. 핸들러는 직접 mutate 하지 않음. expression 컨텍스트에 `$thread` 로 노출. 상세: [Spec Conversation Thread](../conventions/conversation-thread.md) |

### 6.1.1 트리거 입력 파라미터 seeding

실행 엔진의 진입 API는 `execute(workflowId, input?, options?)` 시그니처이며, `input`은 트리거 종류와 무관하게 아래 규약을 따른다.

```typescript
type TriggerExecutionInput = {
  parameters?: Record<string, unknown>;
  // webhook 한정 추가 필드
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  method?: string;
};

type ExecuteOptions = {
  /** 수동 실행 시 사용자 UUID. 저장된 값은 `Execution.executed_by` 컬럼에 매핑. */
  executedBy?: string;
  /** schedule/webhook 트리거 발화 시 트리거 UUID. 저장된 값은 `Execution.trigger_id` 컬럼에 매핑. */
  triggerId?: string;
};
```

- **공통 유틸** `resolveTriggerParameters(workflow, rawValues)`:
  1. 워크플로우 그래프에서 `manual_trigger` 노드를 찾아 `config.parameters` 스키마 조회
  2. required 누락 시 `InvalidInputError` (호출측이 400/실행 실패로 매핑)
  3. 기본값(defaultValue) 적용
  4. `coerceToType`로 타입 강제 변환 (variable-declaration 공용 유틸)
- **Manual**: 컨트롤러가 `{ parameterValues }`를 수신 → `resolveTriggerParameters` 수행 → `{ parameters }` + `{ executedBy: user.sub }` 형태로 `execute()` 호출. 결과 Execution 행은 `executed_by` 컬럼이 채워져 출처가 `manual` 로 분류된다.
- **Webhook**: `HooksService`가 `body`를 raw source로 사용하여 `resolveTriggerParameters` 수행. 실패 시 `400 Bad Request` 후 Execution 생성하지 않음. 성공 시 `{ parameters, body, headers, query, method }` + `{ triggerId: trigger.id }` 로 `execute()` 호출. 결과 Execution 행은 `trigger_id` 컬럼이 채워져 출처가 `webhook` 으로 분류된다.
- **Schedule (cron 자동 발화)**: `ScheduleRunnerService.process()`가 `schedule.parameterValues`를 제한 컨텍스트(`{ $now, $schedule: { id, cronExpression, timezone } }`)로 ExpressionResolver에 통과시킨 뒤 `resolveTriggerParameters` 수행 → `{ parameters }` + `{ triggerId: schedule.triggerId }` 로 `execute()` 호출. `$node`, `$input`, `$var` 불가. 결과 Execution 행은 `trigger_id` 컬럼이 채워져 출처가 `schedule` 로 분류된다.
- **Schedule "지금 실행"**: 사용자가 수동으로 즉시 실행 버튼을 누른 경우는 Manual 경로와 동일하게 `{ executedBy: userId }` 로 호출 — 출처는 `manual`.

> 출처 분류 규칙(우선순위 + 라벨)은 [Spec 실행 내역 §2.4](../2-navigation/14-execution-history.md#24-테이블) 참조. 분류 헬퍼 구현은 `codebase/backend/src/modules/executions/utils/execution-trigger.ts` 의 `deriveExecutionTrigger`.

Manual Trigger 핸들러의 `execute()` 출력은 항상 다음 형태이다:

```json
{
  "config": { "parameters": [...] },
  "output": {
    "parameters": { "name": "test", "count": 3 },
    "body": "...(webhook 시)",
    "headers": "...(webhook 시)"
  }
}
```

다운스트림 표현식 해석 시 `$input.parameters === $params === context.parameters` 관계가 성립한다.

### 6.2 저장 전략

| 단계 | 저장소 | 설명 |
|------|--------|------|
| 실행 중 | Redis | 실행 컨텍스트를 Redis에 저장 (TTL: 실행 타임아웃 × 2) |
| 노드 완료 시 | Redis + PostgreSQL | nodeOutputCache 업데이트(Redis), NodeExecution 레코드 저장(PostgreSQL) |
| 노드 hook 시 | Redis (`ExecutionContext.conversationThread` 일부) | `ConversationThreadService.append*` 가 presentation `interaction` resume / AI Agent multi-turn message·assistant 발생 시 호출. NodeExecution.outputData (`output.interaction` / `output.messages` / `output.result.response`) 가 영구 SoT 이므로 별도 DB 컬럼 신설 없음 |
| waiting_for_input 진입 시 | PostgreSQL (`NodeExecution.outputData`) + Redis (`ExecutionContext`) | 다음 노드 재개에 필요한 모든 정보를 commit. (a) `interactionType` 과 노드의 `rawConfig` snapshot (§5.5), (b) multi-turn 의 경우 `_resumeState` 의 credential-strip 부분집합인 `_resumeCheckpoint` (§1.3 — `_resumeState` full 은 in-memory 만), (c) 누적된 `conversationThread` (`output.messages` 또는 `output.interaction`). **별도 `_continuationCheckpoint` 컬럼 신설하지 않는다** — 기존 SoT 인 `NodeExecution.outputData` 를 §7.5 rehydration 의 단일 진실로 활용 |
| 실행 완료 시 | PostgreSQL | 전체 컨텍스트를 PostgreSQL에 영구 저장, Redis에서 삭제 |

> **라이브 조기 노출 신호는 비영속**: multi-turn 재개 chokepoint(WS `execution.submit_message` 와 채널 텍스트 인바운드의 공통 경로 = [AI Agent §7.5](../4-nodes/3-ai/1-ai-agent.md#75-multi-turn-모드--사용자-메시지-수신-status-resumed-transient) `message_received` resume tick)는 다음 턴 LLM 호출 전에 WS `execution.user_message` 이벤트를 emit 해 사용자 발화를 라이브로 조기 노출한다 ([WebSocket §4.4](./6-websocket-protocol.md#44-실행-진행-이벤트)). 이는 `tool_call_*` 와 동형의 **라이브 전용 진행 신호로 영속 대상이 아니다** — `NodeExecution.outputData` 는 위 표대로 turn 경계에서만 저장(single-write 불변)되고, 사용자 발화의 영속 정합은 turn 종료 `execution.ai_message` 스냅샷(`output.result.messages`)이 보장한다. (§7 rehydration 의 "WS 신규 이벤트 도입 안 함" 원칙은 재개 사실이 `node.*` 이벤트로 이미 관측 가능한 *관측-중복* 이벤트(`resumed_after_restart`)를 특정 기각한 것이며, 본 라이브 진행 신호 — 수신 시점에 발화 내용을 싣는 이벤트가 기존에 부재 — 에는 적용되지 않는다.)

### 6.3 재실행/조회 정책 (Replay Policy)

저장된 실행 이력을 사용자가 다시 활용하는 시나리오의 정책. 의미가 다른 두 모드를 분리해 정의한다 — 한쪽은 외부 부수효과 0, 다른 쪽은 새 실행으로 부수효과 재트리거.

| 모드 | 의미 | 구현 상태 | 외부 부수효과 | expression 평가 |
|------|------|-----------|---------------|-----------------|
| **View** | 실행 이력 조회 — `NodeExecution.outputData` 를 그대로 표시 | ✅ 구현됨 (execution-history UI) | ❌ 없음 | ❌ 없음 |
| **Re-run** | 새 Execution 시작 — 현재 워크플로 정의의 raw config 를 다시 평가 | ✅ 정의됨 — 명세는 [`./13-replay-rerun.md`](./13-replay-rerun.md) | ✅ 재트리거 — 이메일 재발송, HTTP 재호출 등. dry-run 토글로 skip 가능 ([`./13-replay-rerun.md`](./13-replay-rerun.md) §7) | ✅ `$now` / `random()` 등 새 실행 시점 재고정 |
| **Multi-turn resume** | 같은 실행의 다음 turn 진행 — `state.rawConfig` frozen snapshot 사용 | ✅ 구현됨 (§1.3 / `executions/:id/continue`) | 해당 노드 한정 (`processMultiTurnMessage`) | 해당 노드 한정 |

**핵심 직교성**:
- **View 와 Multi-turn resume 은 replay 가 아니다**. View 는 historical record 조회, Multi-turn resume 은 진행 중 실행의 다음 turn.
- **Re-run 은 새 Execution row 를 생성**한다 — 기존 row 의 input 을 복사할 수 있으나, 실행 결과는 현재 워크플로 정의 + 현재 시각 + 외부 응답에 따라 달라진다.
- Re-run 의 외부 부수효과 가드는 [`./13-replay-rerun.md`](./13-replay-rerun.md) §6 RR-PL-01 (확인 모달 + dry-run 토글, A5) + §7 dry-run 모드 정의 참조. 본 spec 은 정책 ID 목록만 cross-link 한다.

**옛 NodeExecution row 호환성** (raw config exposure 도입 이전):
- 옛 row 는 `outputData.config` 가 expression **평가 후** 형태 (예: `{ subject: "Hello Alice" }`). 새 row 는 평가 **전** 형태 (예: `{ subject: "Hello {{ name }}" }`).
- 백필하지 않는다 — historical record 로 보존.
- expression 컨텍스트의 cross-execution 참조는 없다 (각 실행은 자기 nodeOutputCache 만 사용). 따라서 옛 row 의 의미 차이는 **UI 표시 차이만** — 실행 동작에는 영향 없음.
- View 는 best-effort — 옛 실행의 Send Email · HTTP Request 는 신규 `output.{subject, body, requestBody, responseHeaders, bodyTruncated}` 필드가 부재할 수 있다.

---

## 7. 장애 복구

### 7.1 Worker Heartbeat

> **구현 상태 — heartbeat 메커니즘 자체는 미구현 (Planned)**: 아래 표의 주기적 heartbeat(5초)·연속 미응답 판정(15초)·미응답 태스크 재큐는 **목표(aspirational)** 이며, 별도 Worker/task-queue 모델(§4 — 미구현)이 도입돼야 성립한다. 현 구현에는 worker 가 emit 하는 heartbeat 도, 그것을 검사하는 경로도 없다.
>
> **현 실제 동작**: 서버 재시작 시 `recoverStuckExecutions()` 가 `status='running' AND started_at < now() - STUCK_RECOVERY_STALE_MS(30분)` 인 Execution 을 일괄 `failed` 로 마킹한다 (`error.code='WORKER_HEARTBEAT_TIMEOUT'`). 즉 코드의 `WORKER_HEARTBEAT_TIMEOUT` 은 실제 heartbeat 검출이 아니라 **절대 시간(30분) 임계 기반 stale 검출**이며, 에러 코드 이름만 본 절을 선반영해 재사용한다 (`execution-engine.service.ts` `recoverStuckExecutions`, 상수 `STUCK_RECOVERY_STALE_MS`). 분산 lock·WAITING_FOR_INPUT 제외 등 recovery 동작은 §7.4 Recovery 가 SoT.

| 항목 | 값 | 구현 상태 |
|------|-----|-----------|
| Heartbeat 간격 | 5초 | 미구현 (Planned — §4 Worker 모델 의존) |
| 미응답 판정 | 3회 연속 미응답 (15초) | 미구현 (Planned). 현 임계는 절대 시간 `STUCK_RECOVERY_STALE_MS`(30분) |
| 미응답 시 동작 | 해당 태스크를 큐에 재발행 (재큐) | 미구현 (Planned). 현 동작은 Execution 일괄 `failed` 마킹 (재큐 아님) |

### 7.2 체크포인트 기반 Resume

```
1. 워크플로우 실행 중 각 노드 완료 시 체크포인트 저장
   - 완료된 노드 목록, 각 노드의 출력 데이터, 현재 실행 컨텍스트
2. Worker 장애 발생 시:
   a. 미완료 태스크(현재 실행 중이던 노드)를 재큐
   b. 새 Worker가 태스크 소비
   c. 해당 노드만 재실행 (이전 완료 노드는 재실행하지 않음)
3. 전체 Execution Engine 재시작 시:
   a. status=running인 Execution 목록 조회
   b. 각 Execution의 마지막 체크포인트에서 resume
```

> WAITING_FOR_INPUT 노드의 재개는 §7.5 Resume after Restart 에 별도 정의한다. 본 절은 RUNNING 노드의 재실행에만 해당.

### 7.3 멱등성 보장

- 각 NodeExecution에 고유 taskId 부여
- Worker는 실행 전 taskId 중복 확인 (이미 완료된 태스크는 스킵)
- 외부 API 호출 노드(Integration)의 멱등성은 노드 설정에서 관리

### 7.4 분산 실행 (Multi-instance)

LB 뒤에 backend 인스턴스 N개를 두는 수평 확장 환경에서의 실행 정합성 정책. 단일 인스턴스 환경에서도 모든 메커니즘이 동일하게 동작하므로 운영 토폴로지에 따른 분기는 없다.

**`execution_node_log` append-only 모델**

노드 실행 순서는 `execution_node_log` append-only 테이블로 기록한다. UUID 배열(`array_append()`) 모델은 다중 인스턴스 동시 INSERT 시 인스턴스 간 절대 순서를 보장하지 못하므로 BIGSERIAL 기반으로 대체한다.

- `execution_node_log (id BIGSERIAL, execution_id UUID, node_id UUID, created_at TIMESTAMPTZ)` 테이블에 노드 실행이 append.
- BIGSERIAL `id` 는 PostgreSQL sequence 가 부여하므로 인스턴스 동시성 안전. `(execution_id, id)` 정렬이 곧 실행 순서.
- `Execution.executionPath` 컬럼 제거. 외부 API 응답의 `executionPath: string[]` 시그니처는 유지 — `findById` 가 본 테이블의 정렬 쿼리로 채운다. 목록 조회 응답에서는 N+1 회피 위해 빈 배열로 반환한다.
- 이행 마이그레이션 두 단계로 분리 — V035 (테이블 생성 + `UNNEST WITH ORDINALITY` 이행, `executeInTransaction=false`) / V036 (컬럼 DROP, `lock_timeout=3s`). 운영 DB DDL lock 영향 최소화. Flyway 컨벤션상 alphanumeric suffix (V035a 등) 는 silent skip 되므로 항상 정수 prefix 사용.

**Continuation Bus (사용자 입력 fan-out)**

사용자 입력 fan-out 은 **영속 BullMQ 큐** 를 단일 진입으로 사용한다. 이전의 Redis pub/sub (`execution:continuation` 채널) 은 폐기 — at-most-once 의미론으로 인해 (a) 어느 인스턴스에도 메모리 resolver 가 없는 순간 메시지가 silent drop 되는 race 와, (b) 컨테이너 재시작 후 재개 불가 가 발생했다 (자세한 결정 근거는 §Rationale "Durable Continuation").

| 항목 | 값 |
|------|-----|
| BullMQ 큐 이름 | `execution-continuation` (`background-execution` 와 동일한 BullMQ infra 재사용) |
| 메시지 타입 | `continue` / `cancel` / `button_click` / `ai_message` / `ai_end_conversation` / `retry_last_turn` (`ContinuationType`, `continuation-bus.service.ts`). `retry_last_turn` 은 §1.3 / §1.2 의 AI Agent multi-turn 재진입(WS `execution.retry_last_turn`) 전용 — 대상 row 는 WAITING 이 아니라 spawn 된 RUNNING 이므로 WAITING_FOR_INPUT 사전검증을 거치지 않는다 |
| 메시지 스키마 | `{ type: ContinuationType, executionId: string, nodeExecutionId: string, payload?: unknown }` |
| jobId | `${executionId}:${nodeExecutionId}:${monotonic-seq}` (seq 는 Redis INCR per executionId — idempotency key) |
| 입력 receiver → enqueuer | controller / WS gateway 는 클라이언트 payload 의 `nodeId` 로 현재 `WAITING_FOR_INPUT` 상태의 NodeExecution row 를 DB lookup (`execution_id + node_id + status='waiting_for_input'`) 해 `nodeExecutionId` 를 채운 뒤 enqueue. 0건 또는 다중 row 이면 즉시 client 에 에러 (`INVALID_EXECUTION_STATE`) |
| 재시도 | `attempts: RESUME_BULLMQ_ATTEMPTS` (기본 3), exponential backoff (1s / 4s / 16s) |
| Dead-letter | 모든 attempt 소진 시 Execution `cancelled` + `error.code='RESUME_FAILED'` |
| 라우팅 원칙 | **모든 진입점은 항상 BullMQ enqueue**. 자기 인스턴스의 `pendingContinuations` 에 키가 있어도 마찬가지 — 옛 pub/sub 시대의 "항상 publish — 직접 dispatch 분기는 race window" 원칙을 BullMQ 로 그대로 계승. local resolve 의 microsecond 절약은 운영 단순성·디버깅 가능성보다 가치가 낮다 |
| Worker 동작 | 임의 인스턴스가 job 을 pick up. 로컬 `pendingContinuations` 에 키가 있으면 즉시 resolve (in-instance fast path). 없으면 §7.5 rehydration 경로 (slow path) |
| Worker 동시성 | `CONTINUATION_WORKER_CONCURRENCY` (기본 1 — 인스턴스당 직렬). 대량 동시 resume 의 setup (rehydration / 그래프 빌드) 직렬화 latency 가 관측되면 상향. 비양수·비정수·비숫자 입력은 1 로 fallback, 변경은 인스턴스 재시작 시 반영 (§11) |

```
[client] → controller / WS gateway
            ↓
    nodeId → DB lookup → nodeExecutionId
            ↓
        bus.add(msg, { jobId, attempts })
            ↓
   ─── BullMQ continuation-queue ───
            ↓
        임의 worker pick up
       /                   \
  pendingMap hit       pendingMap miss
  (fast path)          (slow path — §7.5 rehydration)
       ↓                       ↓
   resolve()              §7.5 rehydrate → resolve()
```

- `continueExecution` / `cancelWaitingExecution` / `continueButtonClick` / `continueAiConversation` / `endAiConversation` 모두 동일 패턴.
- "No pending continuation" 즉시 throw 는 단일 인스턴스에서 정확히 판단 불가하므로 폐기된다 (옛 pub/sub 시대 원칙 유지) — 키 없음은 §7.5 rehydration 경로로 자연 해소.
- WAITING_FOR_INPUT 상태의 사전 검증 (controller / WS gateway) 은 publisher 측 책임.

**Recovery (`recoverStuckExecutions`)**

다중 인스턴스에서 신규 기동한 인스턴스가 다른 인스턴스에서 정상 처리 중인 작업을 잘못 FAIL 시키지 않도록 보수적 가드.

- **분산 lock**: `redis SET 'exec:recover:lock' <hostname:uuid-token> EX 60 NX` — 60초 TTL. 획득 실패 시 본 인스턴스는 skip. 컨테이너에서 PID 가 충돌해도 `hostname + UUID` 로 owner 식별 보장.
- **명시적 release**: 작업 종료 시 owner 검증 Lua script 로 lock 을 즉시 해제 — TTL 만료 대기 없이 다음 인스턴스가 처리 가능. owner 가 다르면 (이미 expire 후 다른 인스턴스가 잡은 lock) 절대 삭제하지 않는다.
- **Stale 대상 한정**: `status='running'` 인 row 만 stuck recovery 대상. **`status='waiting_for_input'` 은 무기한 보존** — 사용자 입력은 며칠 후 도착할 수도 있고, 노드별 `formConfig.timeout` 등 워크플로우 정의된 별도 timeout 이 적용된다. 임계값 (`STUCK_RECOVERY_STALE_MS`, 현재 30분) 은 RUNNING 의 stale 검출에만 사용한다. (주의: 현 구현은 이 임계를 **절대 시간**(`started_at < now() - 30분`)으로 적용하며 §7.1 의 주기적 heartbeat 검출은 미구현 — §7.1 구현 상태 banner 참조. heartbeat 기반으로의 전환은 Planned.)
- **WAITING_FOR_INPUT 의 운명**: 부팅 시점에 `WAITING_FOR_INPUT` 인 Execution 은 본 함수에서 **무시**. 사용자 입력이 도착하면 §7.5 의 rehydration 경로로 자연스럽게 재개된다. 옛 동작 (WAITING_FOR_INPUT 일괄 FAIL) 의 운영 회귀는 §Rationale "Durable Continuation" 참조.

### 7.5 Resume after Restart (rehydration)

WAITING_FOR_INPUT 상태에서 인스턴스가 종료된 뒤 사용자 입력이 도착하면, BullMQ 가 임의의 인스턴스에 job 을 deliver 하고 그 인스턴스가 다음 절차로 실행을 재개한다.

```
[client] → controller / WS gateway
            ↓
    nodeId → DB lookup → nodeExecutionId
            ↓
        bus.add('execution-continuation', msg, { jobId, attempts })
            ↓
   ─── BullMQ continuation-queue ───
            ↓
    임의 worker pick up
       /                   \
  case 1: 로컬 pendingMap 키 있음
  → 즉시 resolve()  (fast path — §7.4)
       \
  case 2: 로컬 pendingMap 키 없음
  → rehydrate (slow path — 신규)
       ├─ Execution.status === 'waiting_for_input' 검증
       ├─ outbound routing context 재등록 (triggerId && workflowId 있는 경우)
       │   · 영속된 execution row 의 triggerId / workflowId / input_data.chatChannel
       │     서브 필드(§6.2 영속 항목)로 outbound routing context 를 재등록
       │     (execute() 진입 시 최초 등록과 동일 형태 — CCH-AD-05).
       │   · best-effort: 등록 실패 시 warn 로그만 남기고 rehydration 은 계속.
       │   · terminal event emit 시 자동 release (기존 동작).
       ├─ NodeExecution.outputData 에서 rawConfig snapshot /
       │   _resumeCheckpoint (multi-turn) / conversationThread 로드
       ├─ ExecutionContext 재구성 (Redis context 가 살아있으면
       │   그것 우선, 없으면 DB 에서 복원)
       ├─ 해당 노드의 waitForX() 메서드를 새로 invoke
       │   (in-memory resolver 등록)
       ├─ 즉시 같은 입력을 resolver() 에 전달
       └─ 이후 그래프 순회를 평소대로 진행
```

case 2 의 rehydration 경로는 §7.4 의 기존 원칙 "키 없음 → 즉시 throw 폐기" 의 자연스러운 확장이다. 옛 pub/sub 시대에는 "다른 인스턴스의 Map 에 있을 수도 있으니 silent skip" 했지만, BullMQ 로 영속화한 본 시대에는 "키 없음 = DB 에서 재구성" 으로 의미가 강화되어 §7.5 rehydration 경로가 된다.

**Rehydration 멱등성**

- BullMQ jobId 가 idempotency key — 동일 jobId 의 중복 처리는 BullMQ 가 차단.
- 추가로 worker 는 처리 전 `NodeExecution.status === 'waiting_for_input'` 인지 재검증. 이미 `COMPLETED` (다른 worker 가 먼저 처리) 면 즉시 ack-and-discard. 이 가드는 BullMQ 의 멱등성을 보완해 정상-경로 race 까지 닫는다.
- BullMQ `removeOnComplete: true` + `removeOnFail: false` + `attempts: RESUME_BULLMQ_ATTEMPTS` (기본 3) 로 두며, 모든 attempt 가 실패하면 dead-letter (Execution 을 `cancelled` 로 마킹 + `error.code='RESUME_FAILED'`). `removeOnFail: false` 로 실패 job 을 보존하므로 dead-letter depth 를 §9.3 "Dead-letter 모니터링" 이 관측할 수 있다.

**Rehydration 실패 케이스**

| 케이스 | 처리 |
| --- | --- |
| `NodeExecution.outputData` 가 부재 또는 손상 | Execution `cancelled` + `error.code='RESUME_CHECKPOINT_MISSING'`, 동반 NodeExecution `failed` |
| BullMQ attempts 소진 | Execution `cancelled` + `error.code='RESUME_FAILED'`, 동반 NodeExecution `failed` |
| Multi-turn AI 노드의 `_resumeCheckpoint` 가 **부재**(이 기능 배포 이전 진입한 waiting row) 또는 **손상**(schema drift 로 `buildRetryReentryState` 재구성 실패) | Execution `cancelled` + `error.code='RESUME_INCOMPATIBLE_STATE'`, 동반 NodeExecution `failed`. 채널 어댑터는 이를 raw 에러가 아닌 **graceful "대화 세션 만료 — 새로 시작" 안내**로 사용자에게 표시하고, 사용자의 다음 메시지는 새 대화로 시작한다 (텔레그램 등). **정상 경로** — `_resumeCheckpoint` 가 존재하면 재구성 성공으로 재개되며 본 에러는 발생하지 않는다 |

이 셋 모두 사용자에게는 [Spec WebSocket §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) 의 ack 에 `resumed: false` + `error` 객체로 노출된다.

> **채널 어댑터 전달의 선행 조건**: 위 `RESUME_INCOMPATIBLE_STATE` 의 graceful 안내가 외부 채널(텔레그램 등)에 실제로 도달하려면, 위 rehydration 시퀀스의 **outbound routing context 재등록** 단계가 선행돼야 한다. 재개는 다른 프로세스/재시작 후 worker 가 pick up 하므로 routing context 가 소실된 상태이며, 재등록 없이 `cancelled` 이벤트를 emit 하면 conversationKey 가 없어 채널 dispatcher 가 outbound 를 skip 한다 (§Rationale "Durable Continuation").

**리트라이 레이어 합산 — §5.7 LLM 핸들러 retry 와의 관계**

- BullMQ `attempts: 3` 은 **continuation-queue 전달 레이어** 의 재시도 — 핸들러 호출 직전 단계 인프라 재시도.
- §5.7 의 AI 핸들러 retry (예: 2회) 는 **핸들러 내부 LLM 호출 레이어** 의 재시도. 두 레이어는 독립 적용.
- **최악 시나리오**: continuation-queue 가 매 attempt 마다 다른 인스턴스로 deliver 하고 그 인스턴스가 LLM 호출 단계에서 죽는다면, 큐 3회 × LLM 2회 = 최대 6회 LLM 호출이 발생할 수 있다. `NodeExecution.status` 가드가 결과 중복 저장을 막지만 **호출 비용 자체는 발생**. 운영 모니터링: continuation-queue retry 율이 1% 를 넘으면 BullMQ DLQ 알람.

**AI Conversation 노드의 비용 영향**

- Rehydration 자체는 LLM 을 호출하지 않는다 — 사용자 메시지가 도착한 이후의 다음 turn 부터 LLM 호출.
- BullMQ retry 가 메시지를 중복 deliver 하더라도 위 멱등성 가드가 LLM 중복 호출을 차단 (단, 핸들러 실행 중 worker 가 죽는 경우는 위 "최악 시나리오" 참조).

### 7.5.1 Publisher 측 사전 검증 — `INVALID_EXECUTION_STATE`

§7.4 의 입력 receiver (controller / WS gateway) 가 publish 직전에 `nodeId → nodeExecutionId` DB lookup 을 수행하는 단계 (`execution_id + node_id + status='waiting_for_input'`). 다음 케이스는 BullMQ enqueue 를 **시도하지 않고** client 에 즉시 동기 응답한다.

| 케이스 | 응답 코드 (WS ack) | 원인 |
| --- | --- | --- |
| 매칭 row 0건 | `INVALID_EXECUTION_STATE` | Execution 이 다른 상태(`running` / `completed` / `cancelled` / `failed`)거나 nodeId 미일치 |
| 동일 매칭 row 2건 이상 (invariant 위반) | `INVALID_EXECUTION_STATE` + `logger.warn` | 일반적으로 발생 불가. race 또는 데이터 손상 의심 |

`INVALID_EXECUTION_STATE` 는 동일 의미를 표현하는 **두 layer 의 코드** 중 WS 쪽 — REST 진입점은 422 `INVALID_STATE` ([Spec 에러 처리 §3-error-handling.md](./3-error-handling.md)) 를 반환한다 (의도적 분리: WS ack 와 REST 422 의 routing 분기가 클라이언트에서 동일 코드를 다르게 처리해야 하는 혼동을 회피).

본 코드는 `waiting_for_input` 진입점 외에도 [`execution.retry_last_turn`](./6-websocket-protocol.md#42-실행-제어-명령-client--server) (`failed` 상태가 기대) 같은 다른 commands 에서도 "기대 상태가 아님" 의 범용 표현으로 재사용된다.

본 분류는 [§7.5 rehydration](#75-resume-after-restart-rehydration) 의 `RESUME_*` (worker 측 비동기 실패) 와 직교 — `INVALID_EXECUTION_STATE` 는 ack 동기 응답, `RESUME_*` 는 후행 `EXECUTION_CANCELLED` 이벤트.

> `resolveWaitingNodeExecutionId` 는 invalid lookup (0건 / 다중 row) 시 `InvalidExecutionStateError` 를 throw 하며, publisher 진입점이 이를 동기 surface 한다 — WS gateway 4개 handler 는 ack `errorCode='INVALID_EXECUTION_STATE'`, REST `POST :id/continue` 는 422 `INVALID_STATE`, EIA 외부 진입점(`interaction.service`)은 409 `STATE_MISMATCH`. DB lookup 자체의 infra 실패는 `INVALID_EXECUTION_STATE` 가 아닌 원본 에러로 전파(재시도 가능). `__no_node_exec__` sentinel 은 cancel 류(nodeExecutionId 부재) 및 deploy 전 enqueue 된 legacy job 호환을 위해 worker 측에만 잔존.

---

## 8. 동시 실행 제한 (미구현 — Planned)

> **구현 상태**: 본 절의 동시 실행/노드 수/실행 시간/큐 대기 제한은 **목표 정책(aspirational)** 이며 현재 엔진에 enforcement 코드가 없다. 워크스페이스/워크플로우 동시 Execution 카운트 가드, 단일 Execution 노드 수·최대 실행 시간 timeout, 큐 대기 cancel 어느 것도 구현돼 있지 않다 (`grep` 상 `EXECUTION_TIMEOUT` 은 `code` 노드의 스크립트 타임아웃과 chat-channel 실패 분류기 문자열로만 존재하며, 엔진 레벨 실행시간 timeout 이 아니다 — `nodes/data/code/code.handler.ts`, `chat-channel/shared/execution-failure-classifier.ts`). 본 절의 미구현 표면 추적: `plan/in-progress/spec-sync-execution-engine-gaps.md`.

| 제한 항목 | 기본값 | 설정 위치 |
|-----------|--------|-----------|
| 워크스페이스당 동시 Execution 수 | 10 | Workspace.settings |
| 워크플로우당 동시 Execution 수 | 3 | Workflow.settings |
| 단일 Execution 최대 노드 수 | 500 | 시스템 설정 |
| 단일 Execution 최대 실행 시간 | 30분 | Workflow.settings |
| 노드별 기본 타임아웃 | 30초 | Node.config |

**제한 초과 시 동작 (모두 Planned — 미구현):**
- 워크스페이스/워크플로우 제한 초과 → 새 Execution은 `pending` 상태로 큐 대기
- 최대 실행 시간 초과 → `EXECUTION_TIMEOUT` 에러 → Execution.status = `failed`
- 큐 대기 시간 제한 (기본: 5분) 초과 → `cancelled` 처리

---

## 9. Redis 키 네이밍 컨벤션

### 9.1 키 패턴

모든 Redis 키는 아래 패턴을 따른다:

```
{service}:{workspaceId}:{resource}:{id}:{sub}
```

| 세그먼트 | 설명 | 예시 |
|----------|------|------|
| `service` | 서비스 식별자 | `exec` (실행 엔진), `core` (Core API), `ws` (WebSocket) |
| `workspaceId` | 워크스페이스 UUID | `550e8400-...` |
| `resource` | 리소스 유형 | `execution`, `node`, `lock`, `rate`, `session` |
| `id` | 리소스 ID | UUID |
| `sub` | 하위 키 (선택) | `context`, `output`, `heartbeat` |

### 9.2 용도별 키 정의 및 TTL

| 키 패턴 | 용도 | TTL |
|---------|------|-----|
| `exec:{wsId}:execution:{execId}:context` | 실행 컨텍스트 (변수, nodeOutputCache) | 실행 타임아웃 × 2 |
| `exec:{wsId}:execution:{execId}:status` | 실행 상태 (running, waiting 등) | 실행 타임아웃 × 2 |
| `exec:{wsId}:node:{nodeExecId}:output` | 노드 실행 출력 캐시 | 실행 타임아웃 × 2 |
| `exec:{wsId}:worker:{workerId}:heartbeat` | Worker 헬스체크 | 15초 |
| `exec:{wsId}:lock:{execId}` | 실행 동시 접근 잠금 | 30초 (자동 갱신) |
| `core:{wsId}:rate:{userId}` | API Rate Limit 카운터 | 60초 |
| `ws:{wsId}:session:{connId}` | WebSocket 세션 정보 | 세션 유지 시간 |
| `exec:{wsId}:queue:priority` | 우선순위 큐 (Sorted Set) | 영구 (큐 소비 시 삭제) |
| `exec:recover:lock` | 부팅 시 stuck recovery 분산 lock — 워크스페이스 단위가 아닌 **전역**. 단일 인스턴스만 recovery UPDATE 를 수행하도록 보장 (§7.4 참조) | 60초 |
| `exec:cont:seq:<executionId>` | continuation publish 의 monotonic seq (Redis INCR per executionId) — BullMQ jobId (`${executionId}:${nodeExecutionId}:${seq}`) 의 idempotency key. executionId 는 UUID, 워크스페이스 단위가 아닌 **전역**. 8 bytes 미만. **sliding-window TTL** — 매 publish (`nextSeq`) 가 EXPIRE 를 갱신해 continuation 이 활성인 동안 키가 유지되고, executionId 종결 후 (publish 중단) TTL 경과 시 자연 소멸. seq 단조성은 활성 구간 내내 보존 | `CONTINUATION_SEQ_TTL_SECONDS` (기본 86400 = 24시간, 매 publish 갱신) |

> 전역 키 `exec:recover:lock` 및 `exec:cont:seq:<executionId>` 는 §9.1 의 `{service}:{workspaceId}:{resource}` 패턴을 따르지 않는다. 부팅 단일 진입 가드라는 **워크스페이스에 종속되지 않는** 책임을 가지므로 전역 키로 둔다. (옛 `execution:continuation` Redis pub/sub 채널은 BullMQ 큐 `execution-continuation` 로 교체되어 폐기 — §9.3 / §Rationale "Durable Continuation".)

### 9.3 BullMQ 큐 목록

애플리케이션이 사용하는 BullMQ 큐는 다음과 같다. BullMQ 가 내부적으로 사용하는 Redis 키 (`bull:<queue>:*`) 는 §9.1 의 `{service}:{workspaceId}:{resource}` 패턴 범위 밖이다 (BullMQ 라이브러리 표준).

| 큐 이름 | 역할 | attempts | 비고 |
|---------|------|----------|------|
| `execution-continuation` | 사용자 입력 fan-out + AI Agent retry 재진입 (§7.4 / §7.5) | `RESUME_BULLMQ_ATTEMPTS` (기본 3) | 옛 Redis pub/sub `execution:continuation` 채널 대체. 메시지 타입 6종 `continue` / `cancel` / `button_click` / `ai_message` / `ai_end_conversation` / `retry_last_turn` (§7.4) — 마지막 `retry_last_turn` 만 WAITING 이 아닌 spawn 된 RUNNING row 를 대상으로 한다 |
| `background-execution` | Background 노드 본문 실행 (§3.3) | 코드 기본값 (현재 `BACKGROUND_EXECUTION_QUEUE_DEFAULT_OPTS`) | 기존 |

> 일반 노드 실행은 별도 큐 없이 `runExecution` 의 in-process while-loop 에서 직접 dispatch (§2.1) — 별도 `task-queue` 는 존재하지 않는다.

#### Dead-letter 모니터링 (Phase 3.1)

`execution-continuation` 큐는 `removeOnFail: false` 로 운영되어 attempts (`RESUME_BULLMQ_ATTEMPTS`) 소진 job 이 `failed`(dead-letter) 상태로 누적된다. rehydration 이 구조적으로 실패하는 회귀(배포 후 `_resumeCheckpoint` schema drift — `buildRetryReentryState` 재구성 실패, 체크포인트 손상 등)는 dead-letter depth 급증으로 나타나므로 다음을 둔다:

- `ContinuationDlqMonitorService` — dead-letter(`failed`) depth 와 retry backlog(`delayed`)를 주기 polling, 임계 초과 시 structured `logger.error` 알람을 cooldown 1회로 발생. 메트릭 SDK 대신 로그 기반을 택한 근거는 [§Rationale "DLQ 모니터링 — 로그 기반 알람 선택"](#rationale) 참조.
- worker `onFailed` (`@OnWorkerEvent('failed')`) — 실패 1건마다 `RETRY`(attempts 잔여) / `DEAD-LETTER`(attempts 소진) 태그 + 시도 횟수 로깅.

| 환경변수 | 기본값 | 설명 |
|----------|--------|------|
| `CONTINUATION_DLQ_ALARM_THRESHOLD` | `50` | dead-letter(`failed`) job 수 알람 임계 |
| `CONTINUATION_DLQ_MONITOR_INTERVAL_MS` | `60000` | depth polling 주기 |
| `CONTINUATION_DLQ_ALARM_COOLDOWN_MS` | `300000` | 알람 재발 최소 간격 |
| `CONTINUATION_DLQ_MONITOR_ENABLED` | `true` | `'false'` 지정 시 모니터 비활성 |

---

## 10. Integration Handler 계약

Integration 노드(HTTP, Database, Send Email, 등)를 처리하는 핸들러는 공통 베이스(`IntegrationHandlerBase`)를 통해 credential을 해소하고 호출 이력을 기록한다. 노드별 세부 동작은 [Spec Integration 공통 §4](../4-nodes/4-integration/0-common.md#4-handler-실행-세멘틱) 참조.

### 10.1 IntegrationsService API (실행 엔진용)

```ts
class IntegrationsService {
  /**
   * 실행 엔진 전용 내부 조회. credentials는 AES-256-GCM transformer가
   * 복호화한 평문으로 반환된다 — 결과는 시크릿으로 취급할 것.
   */
  getForExecution(id: UUID, workspaceId: UUID): Promise<Integration>;

  /**
   * 노드 실행 완료 시 호출. 성공·실패 여부와 durationMs를 기록하고
   * integration.last_used_at / last_error 를 갱신한다.
   */
  logUsage(params: {
    integrationId: UUID;
    nodeExecutionId: UUID;
    workflowId: UUID;
    status: 'success' | 'failed';
    durationMs: number;
    error?: { code?: string; message?: string } | null;
  }): Promise<void>;
}
```

`logUsage`는 best-effort — 내부 예외를 swallow하므로 실행 흐름을 중단시키지 않는다.

### 10.2 IntegrationHandlerBase 계약

모든 Integration 핸들러는 다음 베이스를 상속 또는 동등한 로직을 수행한다:

```ts
class IntegrationHandlerBase {
  constructor(protected readonly integrationsService?: IntegrationsService) {}

  protected resolveIntegration(
    integrationId: UUID,
    context: ExecutionContext,
    expectedServiceType: string,
  ): Promise<Integration>;  // workspaceId / service_type / status 모두 검증

  protected logUsage(
    context: ExecutionContext,
    params: IntegrationUsageParams,
  ): Promise<void>;
}
```

`resolveIntegration` 실패 시 `IntegrationError(code, message)`를 throw하며 `code`는 [Spec Integration 공통 §4.2](../4-nodes/4-integration/0-common.md#42-공통-에러-코드) 공통 vocabulary를 사용한다.

---

## 11. Graceful Shutdown

SIGTERM 수신 시 동작 계약 — k8s 재배포 / Docker Compose `docker compose down` 등 모든 정상 종료 시점에 적용.

1. **새 Execution 시작 거부**. `POST /api/workflows/:id/execute` (HTTP) 및 WS [`execution.start`](./6-websocket-protocol.md#42-실행-제어-명령-client--server) 명령이 **503 Service Unavailable** 응답. response body 는 표준 API 에러 shape (`{ error: { code: 'SERVER_SHUTTING_DOWN', message: '...' } }`, [Spec API 규약](./2-api-convention.md)), `Retry-After: <ceil(SIGTERM_GRACE_MS / 1000)>` 헤더 동봉. LB drain 동안 traffic 이 다른 인스턴스로 라우팅.

   > **Phase 1 구현 범위**: HTTP 진입점 (`POST /api/workflows/:id/execute`) gate 만 구현됨. WS `execution.start` 명령은 spec [§8.2](../3-workflow-editor/3-execution.md#82-execution-제어-명령) 에 정의되어 있으나, 현재 backend WebSocket gateway 에 해당 핸들러가 미구현 상태로 본 gate 도 적용 대상 외. Phase 2 (continuation-queue 본구현) 에서 WS handler 신설 시 동일 gate 추가 예정.
2. BullMQ `execution-continuation` / `background-execution` 의 active job 처리 중인 worker 는 현재 노드를 완료까지 진행. 신규 job consume 중단. (일반 노드 실행은 큐 미경유, in-process while-loop 종결까지 대기 — §2.1 / §9.3)
3. **WAITING_FOR_INPUT 상태의 Execution 은 건드리지 않음** — DB 상태 그대로 두고 in-memory resolver 만 자연 소실. 사용자 입력 도착 시 §7.5 rehydration 으로 재개.
4. **RUNNING 상태의 노드** 는:
   - `SIGTERM_GRACE_MS` (기본 30초) 까지 완료 대기.
   - 완료 시: 평상시 흐름으로 다음 노드 enqueue. continuation-queue 가 영속이므로 다른 인스턴스가 pick up.
   - 미완료 시: 해당 NodeExecution 을 `failed` + `error.code='SERVER_INTERRUPTED'` 로 마킹 후 Execution 도 노드의 errorPolicy 에 따라 처리 (`stop` → Execution `failed`, `continue` → 다음 노드 enqueue). §7.2 체크포인트 기반 Resume 으로 다른 인스턴스가 미완료 task 를 재큐할 수도 있음 (기존 §7.2 동작).

   > **Phase 1 구현 범위**: errorPolicy 분기 없이 전체 `stop` 동등 처리 (NodeExecution + Execution 모두 `failed`). `continue` 정책 분기 (`다음 노드 enqueue`) 는 Phase 2 의 `execution-continuation` BullMQ 큐 (§7.4) 가 영속 상태로 enqueue 가능해진 뒤 추가 예정.
5. `SIGTERM_GRACE_MS` 경과 후 강제 종료.

| 환경 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `SIGTERM_GRACE_MS` | `30000` (30초) | k8s `terminationGracePeriodSeconds` 와 일관되게 설정. 셀프호스팅 Helm Chart 권장값은 `terminationGracePeriodSeconds = ceil(SIGTERM_GRACE_MS / 1000) + 5` (5초 = readiness drain 여유) |
| `RESUME_BULLMQ_ATTEMPTS` | `3` | continuation-queue 재시도 횟수 (§7.4 / §7.5) — `background-execution` 큐 `attempts` 와 동일한 관리 방식 유지 (현재 양쪽 모두 코드 상수, ENV 화는 후속) |
| `CONTINUATION_WORKER_CONCURRENCY` | `1` | continuation worker 가 인스턴스당 병렬 처리하는 resume/continuation job 수 (§7.4 "Worker 동시성"). 기본 직렬(1). 비양수·비정수·비숫자 입력은 1 로 fallback. 대량 동시 resume 의 setup 직렬화 latency 가 관측되면 상향 |

### 10.3 호출 순서

```
engine.runNode
  ├─ nodeExecution = createNodeExecution(execId, nodeId, RUNNING)
  ├─ context.nodeExecutionId = nodeExecution.id    # ← 엔진이 주입
  ├─ resolvedConfig = expressionResolver.resolve(config, ctx)
  ├─ handler.execute(input, resolvedConfig, context)
  │    ├─ integration = resolveIntegration(...)
  │    ├─ <외부 SDK 호출>
  │    └─ logUsage({ status, durationMs, error? })
  └─ nodeExecution.status = COMPLETED | FAILED
```

- `context.nodeExecutionId`는 각 노드 호출 직전 새로 배정되므로 순차 실행 모델에서 안전하다.
- `integrationsService`가 주입되지 않은 레거시/테스트 경로에서는 핸들러가 `status: 'requires_integration'` stub을 반환(엔진 단위 테스트 호환성).

### 10.4 Fallback / Degraded 모드

- `context.variables.__workspaceId`가 누락되면 핸들러는 `Missing workspace context` 오류를 throw하여 즉시 실패 처리.
- `integrationsService` 미주입 환경(예: 단순 샌드박스 실행)에서는 Integration 조회·Usage 로깅이 모두 skip된다 — 프로덕션 경로에서는 반드시 주입돼야 한다.

---

## Rationale

### `waiting_for_input → failed` 전이 추가

옛 정책은 `waiting_for_input` 종료를 `running` 또는 `cancelled` 로만 정의했다. AI Agent multi-turn 의 turn 처리가 LLM throw (429 / timeout / connection) 로 종결될 때, 엔진의 `handleAiTurnError` → `finalizeAiNode('FAILED')` 가 직접 Execution 을 `failed` 로 전이시켜야 spec [§7.9](../4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트) 의 `port='error', status='ended'` shape 으로 정상 finalize 된다.

**배경 회귀**: 본 전이 누락 시 `handleAiMessageTurn` 의 throw 가 `waitForAiConversation` 의 while loop 를 빠져나가지 못해 `finalizeAiNode` 호출 자체가 누락 — NodeExecution.status 는 WAITING_FOR_INPUT 으로 영구 잔류하고 Execution 만 `runExecution` top-level catch 로 FAILED 가 되어, frontend 가 헤더 "실패" + 노드 "Waiting" 의 모순 상태를 표시한다.

직접 `WFI → failed` 단일 전이 + NodeExecution.status=FAILED save + `NODE_FAILED` → `EXECUTION_FAILED` WS 이벤트 순서를 채택한다 — 단일 트랜잭션 commit 으로 §1.1 의 기존 원자성 정책과 동일하다. `WFI → running` 후 `running → failed` 의 두 단계 전이는 두 트랜잭션 분리로 단일 원자성이 깨져 더 복잡하므로 택하지 않는다.

구현: `state-machine.ts` `ALLOWED_TRANSITIONS`.

### retryable error 종결 시 `_retryState` 보존 (R1 채택)

retryable error (HTTP 429 / 5xx / network timeout) 종결을 처리하는 두 안 중 **R1 (status `ended` + `port: 'error'` 유지 + `_retryState` 동봉)** 을 채택한다 (§1.3 보존 예외).

- **R2 (status `waiting_for_retry` 신설) 기각**: `waiting_for_input` 패밀리 확장이라 §1.3 블로킹/재개 컨트랙트가 다른 노드에까지 번지고, Principle 5 port 활성화 모델과의 정합 재검토가 필요해 spec 면적이 커진다.
- R1 은 기존 `'ended'` + `port: 'error'` 의미를 그대로 두므로 `error` 포트 후속 노드(알림 등)의 의미가 변하지 않는다. retryable 여부는 `output.error.details.retryable` boolean 단일 신호로 충분히 전달되며, retry 는 `error` 라우팅 후의 별도 사용자 인터랙션(`execution.retry_last_turn`)으로 진입한다.
- `_retryState` 는 internal 필드로 `_resumeState` 와 동일하게 expression resolver 비노출·credential strip 정책을 따른다. TTL(`expiresAt`, 기본 60분)이 사실상 retry 상한 역할을 한다.

### Multi-turn 재시작 재개 — `_resumeCheckpoint` 보존 (옛 "WARN #6 미영속" 번복)

**배경 — 번복 대상 결정**: 도입 초기 결정(코드 주석 "WARN #6")은 multi-turn AI 의 `_resumeState` 를 **보안상 DB 에 영속하지 않고 in-memory 만 유지**했다. 근거는 `_resumeState` 가 `rawConfig`·turn debug·model state 등 잠재 credential 을 담을 수 있다는 우려였다. 그러나 이 결정은 **인스턴스 재시작(배포/오토스케일/크래시) 시 진행 중 multi-turn 대화가 영구 재개 불가**(`RESUME_INCOMPATIBLE_STATE`)가 되는 운영 결함을 낳았다 — 텔레그램 등 장수명 채널에서 "대화 중 백엔드가 한 번 배포되면 그 대화는 사망"하는 정상 사용 불가 상태. ([Durable Continuation] 이 Execution row 자체는 무기한 보존하지만, 재개에 필요한 `_resumeState` 가 사라져 무용이었다.)

**채택안 — credential-strip 부분집합 `_resumeCheckpoint` 평문 영속 (암호화 아님)**:

- **암호화(`ENCRYPTION_KEY` 기반 secret-store) 기각**: (a) 대화 messages 는 이미 `output.result.messages` 로 평문 영속 중이라 암호화의 추가 보호 효과가 제한적이고, (b) `_resumeState` 는 **raw secret 을 담지 않는다** — `llmConfigId` 등 **참조 ID** 만 가지며 provider secret 은 secret-store ref 로 분리돼 있다. (c) 매 turn secret-store rotate write + 대화 종료 시 GC 의 복잡도가 추가된다.
- **선례 일반화**: 이미 `_retryState`(위 R1)가 **동일한 일** — `_resumeState` 의 credential-strip 부분집합을 평문으로 `NodeExecution.outputData` 에 영속 + `node.config` 재평가로 재구성 — 을 retryable error 경로에서 검증된 채로 수행한다. `_resumeCheckpoint` 는 이 선례를 **상시(매 waiting turn) 경로로 일반화**한 것이다. credential / context-binding 필드(`llmConfigId`/`workspaceId`/`presentationTools`/`conditions`/`maxTurns` 등)는 동일하게 미동봉(`maskSensitiveFields` 와 동일 allow-list 정책; 정책 적용 경로는 §5.1)하고 재개 시 `node.config` 에서 재유도한다.
- **`stripControlFields()` 보존 예외**: `_retryState` 와 동일하게 `_resumeCheckpoint` 도 strip 예외로 보존하되, downstream 노드 input 전달 시에는 `_resumeState`/`_retryState` 와 함께 제거한다 (internal-only — 후속 노드가 이전 노드의 재개 상태를 보면 안 됨).
- **`buildRetryReentryState` 재구성기 공유**: `_resumeCheckpoint` 와 `_retryState` 는 credential-strip 부분집합 + `node.config` 재유도라는 **동일 재구성 형태**로 수렴하므로 재구성기(`buildRetryReentryState`)를 공유한다. 유일한 차이인 trigger(restart-resume vs. `execution.retry_last_turn` 명령)와 `lastUserMessage`/`expiresAt` 유무는 재구성 출력에 영향을 주지 않는다 — checkpoint 는 `lastUserMessage` 가 없어 replay 없이 도착한 continuation payload 를 다음 turn 으로 처리한다 (`resumeMode` 플래그로 retry 전용 warn 만 분기).
- **TTL 미포함**: `_retryState` 는 retry 어포던스 상한으로 `expiresAt`(60분)을 두지만, `_resumeCheckpoint` 는 **TTL 을 두지 않는다** — waiting Execution 은 무기한 보존되므로(§7.4) 대화는 장시간 idle 후에도 재개 가능해야 한다. 시간 경과 자체가 만료 요인이 되면 본 결함의 원형(장시간 후 재개 불가)이 재현된다.
- **`ai_agent` 한정**: checkpoint allow-list 와 재구성기가 `ai_agent` 의 `_resumeState` shape 전용이다. `information_extractor` 등 고유 state 필드를 갖는 다른 `ai_conversation` 핸들러는 checkpoint 를 영속하지 않고 재개 시 graceful reset — **번복 이전과 동일 동작이므로 회귀가 아니다**. 일반화는 후속 작업.
- **별도 `_continuationCheckpoint` 컬럼 신설 기각**: 기존 SoT 인 `NodeExecution.outputData` (JSONB) 에 키로 보존해 **DB 스키마 변경·마이그레이션을 회피**한다 (§6.2 — `_retryState` 와 동일 취급).

**부재/손상 시**: `_resumeCheckpoint` 가 부재(기능 배포 이전 진입한 waiting row)하거나 `buildRetryReentryState` 재구성이 실패(schema drift)하면 `RESUME_INCOMPATIBLE_STATE` 로 종결하되, 채널 어댑터가 raw 에러가 아닌 "대화 세션 만료 — 새로 시작" graceful 안내로 표시한다 (§7.5 실패 케이스 표).

### `failed → running` 재진입 전이 (R1 의 retry 실행 경로)

R1(위) 의 `execution.retry_last_turn` 이 실제로 실행되는 시점의 상태 전이 결정:

- retry 는 **새 NodeExecution row 를 spawn** 해 마지막 turn 을 replay 한다 (기존 `failed` row 는 보존). 새 row 의 turn 이 WS `node.started`/`node.completed` 를 발행하려면 Execution 이 `running` 이어야 하므로 §1.1 에 **`failed → running` 단일 전이**를 추가한다.
- 이 전이는 R2(`waiting_for_retry` 신설 — 기각) 와 무관한 별개 경로이고, `waiting_for_input → running → failed` 재개 흐름과도 다르다 (retry 는 입력 대기 없이 새 row 를 즉시 구동). 일반 노드 실패에 번지지 않도록 state-machine 의 `allowRetryReentry` opt-in 으로만 허용 — `failed` 종결 실행이 일반 `updateExecutionStatus` 경로로 우발 부활하는 것을 차단한다.
- 재진입 성공 시 Execution 은 `completed`, 재실패 시 `failed`(retryable 재실패면 새 `_retryState` 보존 → 재-retry 가능), replay 중 사용자 cancel 도달 시 `cancelled` 로 마감한다.

### 재진입 시 config expression 재평가

retry 재진입은 노드 config 의 `{{ expression }}` 을 best-effort 재평가해 operational 필드(`llmConfigId`/`maxTurns` 등)를 정상 dispatch 와 일치시킨다. 단 `_retryState` 는 turn 직전 `_resumeState` snapshot 에서 파생돼 원본 nodeInput 을 포함하지 않으므로 `$input.*` 는 미해소 — `$node`/`$var`/`$thread`/`$execution`/`$now` 만 rehydrated context 에서 해소된다 (documented limitation). 재평가 실패 시 raw config 로 fallback 하므로 static config 는 영향 없다. `output.config` echo 는 위 "Engine Raw Config Exposure" 결정대로 **항상 raw**(`rawConfig` frozen snapshot)를 유지하며, 재평가 값은 실행에만 쓰이고 echo 에는 반영되지 않는다 — replay reproducibility 와 config-echo 직교성을 모두 보존한다.

### Engine Raw Config Exposure

**결정 요약**:
- 엔진이 핸들러에 raw config (expression 평가 전 원본) 를 `ExecutionContext.rawConfig` / `state.rawConfig` (multi-turn) 로 노출한다.
- 핸들러는 `NodeHandlerOutput.config` 에 raw echo, expression 평가 결과는 `output.*` 에 둔다 (CONVENTIONS Principle 7 / 1.1.3).
- Replay 정책: View (저장된 evaluated 단순 조회) + Re-run (raw 재평가 + 새 실행) 분리. Multi-turn resume 은 replay 가 아님 (§6.3).
- config + output 양쪽에 같은 evaluated 값을 두는 안은 Principle 1.1 직교성 위반으로 기각한다.

**후속 항목**:
- AI Agent `buildMultiTurnFinalOutput` / `buildConditionOutput` 의 rawConfig plumbing (multi-turn cache lifecycle 영향 분석 필요).
- Information Extractor `multiTurnConfigEcho` 의 raw plumbing.
- Carousel / Table 의 256KB cap 적용 정책 결정.

### Durable Continuation & Graceful Shutdown

운영 회귀 — k8s 재배포 시 WAITING_FOR_INPUT 상태의 Execution 이 일괄 "Execution failed: server restarted while waiting for user input" 로 종결되던 문제. 원인은 (a) continuation resolver 가 in-memory only (`pendingContinuations: Map`), (b) `recoverStuckExecutions()` 가 WAITING_FOR_INPUT 도 stale 대상에 포함, (c) SIGTERM graceful shutdown 미구현.

**채택안 — BullMQ 영속 `execution-continuation` 큐 + §7.5 rehydration 경로**: 이미 `background-execution` 큐로 동일 패턴이 검증됐고 (§3.3), idempotency key + dead-letter 까지 BullMQ 내장이며 신규 인프라 도입이 없다. 이 결정은 "Engine Raw Config Exposure" 결정과 직교 — raw config 노출은 핸들러 계층, durable continuation 은 엔진 인프라 계층 결정이다.

검토 후 택하지 않은 방향:
- **Temporal / Inngest 같은 전용 워크플로우 엔진으로 이전** — 현재 엔진은 expression resolver / multi-turn / container / chat-channel trigger 등 도메인 특화 코드를 30+ 노드 핸들러에 분산해 두어 전면 이전 비용이 과도. 향후 durable timer / signal / child workflow 요구가 누적되면 재검토.
- **WAITING_FOR_INPUT → INTERRUPTED 신규 enum 도입** — Execution.status enum 확장은 DB migration / frontend status pill / 외부 API 응답 / Re-run / Execution History 필터 등 cross-spec drift 가 크다. 외부 상태는 그대로 두고 내부에서 rehydrate 하는 편이 변경 표면적이 작다.
- **Redis pub/sub 유지 + "Map 키 없으면 대기 후 재시도"** — 대기/재시도 튜닝이 워크로드별로 다르고 at-most-once 한계를 우회만 할 뿐 근본 해결이 아님.

**Sticky fast-path 제거 — "항상 publish" 원칙 보존**:

초기 검토안에서는 "publisher 가 자기 인스턴스에 key 가 있으면 BullMQ 우회하고 직접 resolve" 하는 sticky fast-path 를 포함했다. 그러나 옛 §7.4 가 명시한 "모든 진입점은 항상 publish — '내 Map 에 있으면 직접' 분기는 race window" 원칙과 정면 충돌. 본 채택안에서는 sticky fast-path 를 제거하고 "항상 BullMQ enqueue" 로 통일한다. local resolve 의 microsecond 절약은 운영 단순성·디버깅 가능성보다 가치가 낮다. 옛 원칙은 BullMQ 시대에도 그대로 유효.

**옛 "키 없음 즉시 throw 폐기" 원칙의 확장**:

옛 §7.4 가 "키 없음 → silent skip" 으로 정한 것은 "다른 인스턴스의 Map 에 있을 가능성" 때문이었다. BullMQ 시대에는 "키 없음 = DB 에서 재구성" 으로 의미가 강화되어 §7.5 rehydration 경로가 된다. 원칙 자체는 폐기되지 않고 자연스럽게 연장된다.

**WS 신규 이벤트 도입 안 함**:

`execution.resumed_after_restart` 신규 이벤트는 도입하지 않는다 — 기존 `execution.resumed` (transient) 와 의미상 유사하여 클라이언트 혼동 위험이 크고 SSE 매핑까지 추가 갱신해야 한다. 재개 사실은 평상시 흐름의 `execution.node.completed` / `execution.node.started` 이벤트로 충분히 관측 가능하며, 디버깅용 backend instance id 가 필요하면 백엔드 로그 또는 별도 텔레메트리 export 로 처리한다.

**재개 경로의 outbound routing context 재등록**:

slow-path 재개(§7.5)는 다른 프로세스/재시작 후 worker 가 pick up 하므로, `execute()` 진입 시 등록한 outbound routing context (triggerId / workflowId / chatChannel) 가 항상 소실돼 있다. 특히 `RESUME_INCOMPATIBLE_STATE` 는 "인스턴스 재시작으로 multi-turn in-memory 상태 소실" 케이스이므로, routing context 재등록 없이 cancel 을 마킹·emit 하면 graceful 안내(§7.5 line 858 의 채널 어댑터 의무 / CCH-AD-05)가 conversationKey 없이 나가 채널에 silent drop 된다 — 사용자가 "응답 없음" 후 다음 메시지가 새 대화로 시작되는 회귀. 따라서 §7.5 rehydration 은 execution row 검증 직후 영속된 triggerId / workflowId / input_data.chatChannel 로 routing context 를 재등록한다 (execute() 최초 등록과 동일 형태). 이는 신규 WS 이벤트 없이 기존 emit 경로의 fanout envelope 만 복원하므로 위 "WS 신규 이벤트 도입 안 함" 원칙과 정합한다.

- **best-effort trade-off**: 재등록 자체가 예외를 던져도 rehydration 은 차단하지 않고 warn 로그만 남기고 진행한다. 등록 실패는 "graceful 안내가 채널에 도달하지 못함" 의 부작용은 있으나, 그 자체로 execution 재개(또는 cancel 마킹)를 실패 처리할 사유는 아니기 때문이다 — 알림 전달성과 실행 정합성을 분리한다.

### Phase 2 cont 후속 정리

**1. `task-queue` 미존재 확정 (§9.3)**:

실제 BullMQ 큐는 `background-execution` 과 `execution-continuation` 두 개뿐이고, 일반 노드 실행은 `runExecution` 의 in-process while-loop 에서 직접 dispatch 한다. 별도 `task-queue` 는 존재하지 않으므로 §9.3 큐 목록과 §11 Graceful Shutdown 항목 2 모두 이를 전제로 한다.

**2. `INVALID_EXECUTION_STATE` (§7.5.1) — WS/REST 이름 분리 유지**:

publisher 측 사전 검증의 0건/다중 row 케이스는 WS 쪽에서 `INVALID_EXECUTION_STATE` 로 응답한다. 같은 의미를 표현하는 REST 의 422 `INVALID_STATE` ([Spec 에러 처리 §3-error-handling.md](./3-error-handling.md)) 와는 별 코드로 유지한다 — 두 layer 공통으로 `INVALID_STATE` 로 통일하면 WS ack 처리 클라이언트가 동일 코드를 다른 routing (sync ack 응답 vs subsequent event) 으로 분기하기 어렵기 때문이다. 별 이름을 유지하면 routing 분기를 코드 이름에서 즉시 인지할 수 있고, spec 본문에서 두 layer 가 같은 의미임을 cross-link 로 보강한다.

본 코드의 적용 범위는 `waiting_for_input` 진입점 (`execution.submit_form` / `execution.click_button` / `execution.submit_message` / `execution.end_conversation`) 외에 `execution.retry_last_turn` (기대 상태 = `failed`) 도 동일 의미로 재사용한다.

**3. heartbeat 기반 Recovery 전환 — 목표 방향 (현재 미구현)**:

> **현 구현 상태**: `recoverStuckExecutions` 의 stale 판정은 아직 **절대 시간**(`started_at < now() - STUCK_RECOVERY_STALE_MS(30분)`)이다. 아래의 **worker heartbeat 미응답 기반 판정**(§7.1)은 §4 Worker/task-queue 모델과 함께 도입될 **목표 방향(Planned)** 이며, 현재 코드는 heartbeat 을 emit·검사하지 않는다. WAITING_FOR_INPUT 제외와 분산 lock 은 절대 시간 방식에서도 이미 구현돼 있다.

목표상 `recoverStuckExecutions` 의 stale 판정 기준은 절대 시간이 아닌 **worker heartbeat 미응답** (§7.1 — 5초 간격, 3회 연속 미응답 = 15초) 으로 전환하려 한다. 절대 시간 방식은 (a) worker 가 정상 처리 중인 장시간 실행 (AI multi-turn, 외부 API 대기 등) 을 early-FAIL 하는 false positive 위험이 있고, (b) WAITING_FOR_INPUT 상태의 Execution 까지 stale 대상에 포함하면 사용자가 며칠 후 응답하는 케이스를 일괄 종결하는 운영 회귀의 근본 원인이 된다.

- (목표) STUCK_RECOVERY_STALE_MS 는 RUNNING 의 heartbeat 미응답 검출에만 적용. `status='waiting_for_input'` 은 무기한 보존 — 사용자 입력이 도착하면 §7.5 rehydration 으로 자연 재개 (이 제외 자체는 현 절대 시간 구현에도 이미 적용됨).
- (목표) false positive 임계: worker heartbeat 가 살아있으면 절대 시간과 무관하게 stuck 판정 불가 → 장시간 실행도 안전.
- WAITING_FOR_INPUT 의 운영 회귀는 WAITING_FOR_INPUT 을 stale 대상에서 명시 제외하여 이미 차단됨.

**4. rehydration 단말 상태 이분 — `cancelled` (Execution) vs `failed` (NodeExecution)**:

§7.5 rehydration 실패 케이스 (`RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE`) 에서 Execution 은 `cancelled`, 동반 NodeExecution 은 `failed` 로 종결하는 이분 정책의 결정 근거:

- **Execution `cancelled`**: 이 3개 코드는 모두 **인프라 실패** (checkpoint 손상, 큐 소진, schema 변경) 로 인한 종결이며 사용자의 의도적 취소(`cancel` 명령)와 의미가 다름에도, Re-run 진입 가능성을 열어두기 위해 `cancelled` 를 선택한다. `failed` 는 비즈니스/노드 에러로 워크플로우가 정상 종결된 경우이고, 인프라 실패는 "사용자가 다시 시도하면 성공할 수 있는" 범주이므로 `cancelled` 가 더 적합 — Re-run UI 가 `cancelled` 상태에서 활성화된다 ([Spec 실행 엔진 §6.3](./4-execution-engine.md#63-재실행조회-정책-replay-policy)).
- **NodeExecution `failed`**: 노드는 정상 완료하지 못했으므로 `completed` 로 둘 수 없다. NodeExecution `cancelled`(§1.2) 는 **abortSignal 경로 전용** (`AbortError` 분류 — [node-cancellation §5](../conventions/node-cancellation.md#5-aborterror-분류)) 이고, rehydration 실패는 abort 가 아닌 **인프라 결함**이므로 `cancelled` 가 아니라 `failed` 로 종결한다 — 두 단말의 의미(취소 vs 실패)를 구분한다.

Execution 도 `failed` 로 통일하는 안은 Re-run 진입점이 `failed` 원인 (인프라 vs 비즈니스) 을 코드 외부에서 판별해야 해 UX 복잡도가 커져 택하지 않는다. (NodeExecution `cancelled` enum 은 2026-06-03 abortSignal cancellation 경로용으로 신설됐으나 — §1.2 / [node-cancellation §5.1](../conventions/node-cancellation.md#5-aborterror-분류) — rehydration 실패는 그 경로가 아니므로 본 케이스의 NodeExecution 단말은 `failed` 로 유지한다.)

### DLQ 모니터링 — 로그 기반 알람 선택 (Phase 3.1)

§9.3 "Dead-letter 모니터링" 의 `ContinuationDlqMonitorService` 가 OTel 메트릭 대신 structured `logger.error` 알람을 쓰는 결정의 근거:

- **현 backend 는 OTel traces-only** (`instrumentation.ts` — MeterProvider / metrics exporter 미구성, custom Counter/Gauge 0건). DLQ depth 알람 하나를 위해 metrics SDK 파이프라인 전체를 도입하는 것은 Phase 3.1(선택적 후속 정리) 범위에 비해 과도.
- **로그 기반 알람은 기존 운영 인프라로 즉시 픽업 가능** — `logger.error('[DLQ ALARM] ...')` 는 로그 수집/알람 파이프라인(Sentry·로그 기반 alert)이 별도 코드 없이 트리거. cooldown 으로 알람 폭증 방지.
- 택하지 않은 방향: (a) OTel Meter Gauge 신설 — 메트릭 백엔드(수집기/대시보드) 부재 상태에서 소비처 없는 메트릭. metrics 파이프라인 구축 시 재검토. (b) `/health` endpoint 에 DLQ depth 노출 — readiness probe 가 DLQ 누적으로 unhealthy 가 되면 정상 트래픽까지 차단되는 부작용. depth 는 알람 대상이지 readiness 대상이 아님.
- env 4종(`CONTINUATION_DLQ_*`)은 `SHUTDOWN_GRACE_MS` 와 동일한 `useFactory` 주입 패턴을 따른다 (서비스가 `process.env` 직접 접근 안 함).
