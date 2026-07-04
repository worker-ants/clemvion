---
id: execution-engine
status: partial
code:
  - codebase/backend/src/modules/execution-engine/**
  - codebase/backend/src/shared/execution-resume/**
  - codebase/frontend/src/lib/websocket/use-execution-events.ts
  - codebase/frontend/src/lib/websocket/ws-client.ts
pending_plans:
  - plan/in-progress/execution-engine-residual-gaps.md
  - plan/in-progress/spec-sync-execution-engine-gaps.md
  - plan/in-progress/exec-intake-followups.md
  - plan/in-progress/exec-park-durable-resume.md
---

# Spec: 실행 엔진 상세

> 관련 문서: [Spec 아키텍처 개요](../0-overview.md) · [Spec 에러 처리](./3-error-handling.md) · [Spec 실행/디버깅](../3-workflow-editor/3-execution.md) · [데이터 모델 - Execution](../1-data-model.md#213-execution) · [Spec External Interaction API](./14-external-interaction-api.md)

---

## Overview

실행 엔진은 워크플로우 그래프를 실제로 구동하는 백엔드 코어다 — 노드 dispatch·상태 전이·블로킹/재개·장애 복구의 단일 진실이다. 본 문서는 그 내부 계약을 정의한다.

- **상태 머신 (§1)** — Execution / NodeExecution 두 레이어의 상태와 전이, 노드 핸들러의 블로킹/재개 컨트랙트(`NodeHandlerOutput.status`).
- **그래프 순회 (§2) · 컨테이너 실행 (§3)** — 토폴로지 정렬 기반 실행(순환 지원), Loop / ForEach / Map / Background 컨테이너 모델과 중첩 스코프.
- **Worker 모델 (§4) · 노드 핸들러 계약 (§5) · 실행 컨텍스트 (§6)** — execution-level intake 큐 기반 워커, `NodeHandler` 인터페이스·표현식 해석, 컨텍스트 구조·저장·재실행 정책.
- **장애 복구 (§7)** — 워커 크래시 복구(BullMQ stalled-job), 체크포인트 기반 Resume, rehydration, 분산 실행, continuation ack 에러 표면(typed `ExecutionError`·내부 메시지 누출 차단, §7.5.2).
- **동시 실행 제한 (§8) · Redis 키 (§9) · Integration Handler 계약 (§10) · Graceful Shutdown (§11)** — 운영 인프라 계약.

> 외부(REST) 진입점 매핑·외부 표면은 [External Interaction API](./14-external-interaction-api.md), WS ack 표면은 [WebSocket 프로토콜 §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) 가 SoT. 에러 코드 어휘 규약은 [conventions/error-codes.md](../conventions/error-codes.md).

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

| 상태                | 설명                                                                                                      | 전이 조건                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `pending`           | 실행 요청됨, Worker 할당 대기                                                                             | 트리거/수동 실행 시 생성                                                                       |
| `running`           | 실행 중                                                                                                   | Worker가 태스크 소비 시                                                                        |
| `waiting_for_input` | 사용자 입력 대기 중 — Form 노드, 버튼이 설정된 Presentation 노드, 또는 AI Agent Multi Turn 대화 입력 대기 | Form 노드 도달, 버튼이 설정된 Presentation 노드 도달, 또는 AI Agent Multi Turn 대화 턴 대기 시 |
| `completed`         | 정상 완료                                                                                                 | 모든 노드 실행 완료                                                                            |
| `failed`            | 실패                                                                                                      | 노드 에러 + Stop Workflow 정책, 또는 시스템 에러                                               |
| `cancelled`         | 사용자 취소                                                                                               | 사용자가 실행 중단 요청                                                                        |

> ※ **`skipped` 는 NodeExecution 전용** — Execution 레벨에는 `skipped` 상태가 없다(§1.2). 모든 노드가 `skipped`(노드 비활성 / 조건 분기 미선택 / 도달 불가)로 종료되어 에러 없이 dispatch 루프가 자연 종료되면 Execution 은 **`completed`** 로 마감한다(정상 종료 — 구현: dispatch 루프 종료 후 `ExecutionStatus.COMPLETED`). 따라서 실행 이력 화면([2-navigation/14-execution-history.md](../2-navigation/14-execution-history.md))의 필터에도 Execution 레벨 `skipped` 항목은 없으며, all-skipped 실행은 `completed` 로 표시된다.

**허용되는 상태 전이:**

| From              | To                | 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pending           | running           | Worker 할당                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| pending           | cancelled         | 큐 대기 중 취소                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| running           | completed         | 정상 종료                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| running           | failed            | 에러 발생                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| running           | cancelled         | 사용자 취소                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| running           | waiting_for_input | Form 노드 도달, 버튼이 설정된 Presentation 노드 도달, 또는 AI Agent Multi Turn 대화 턴 대기                                                                                                                                                                                                                                                                                                                                                                                           |
| waiting_for_input | running           | 사용자 폼 제출, 버튼 클릭, 또는 AI 대화 메시지 수신/대화 종료 (실행 재개) — 재개 진입은 §7.5 의 **DB 원자 claim**(`… WHERE status='waiting_for_input' RETURNING`, affected=1 인 단일 worker)으로 조건부 수행돼 동시 재개 race 를 기계적으로 차단한다                                                                                                                                                                                                                        |
| waiting_for_input | failed            | AI Agent multi-turn turn 처리 중 LLM throw (429/timeout/connection) — `handleAiTurnError` 가 [§7.9](../4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트) shape (`port='error', status='ended'`) 으로 finalize. **재개 turn** 의 LLM throw 는 §7.5 claim 선행으로 이미 `running` 이므로 `running → failed`(§1.2)로 finalize 된다 — 본 직접 `waiting_for_input → failed` 는 claim 이 개입하지 않는 경로(§Rationale "재개 race … 부분 수정" 참조)                     |
| waiting_for_input | waiting_for_input | 재개 (rehydration) — Execution.status enum 자체는 변하지 않고, 사용자 입력 도착 시 임의 worker 가 §7.5 rehydration 으로 컨텍스트를 재구성해 다음 세그먼트를 시작 (Phase B: park 시 코루틴 해제로 모든 재개가 rehydration. 같은 인스턴스 우연 픽업이어도 동일 경로)                                                                                                                                                                                                                    |
| waiting_for_input | cancelled         | 사용자 취소, 타임아웃, 또는 rehydration 실패의 단말 케이스 (`RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE` — §7.5)                                                                                                                                                                                                                                                                                                                                       |
| failed            | running           | **`execution.retry_last_turn` 재진입 전용** (`allowRetryReentry` opt-in) — AI Agent multi-turn retryable error 종결로 `failed` 가 된 Execution 을 동일 nodeId 의 새 NodeExecution row 구동을 위해 `running` 으로 전이. 성공 종결 시 다시 `completed`, 재실패 시 `failed`. replay 가 RUNNING 으로 도는 중 도착한 cancel 은 graceful no-op 이며(full B3 — RUNNING resume/replay drive 에는 깨울 in-memory 코루틴이 없다), 취소는 다음 `waiting_for_input` park 에서 비로소 발효된다(`cancelParkedExecution` 의 WAITING 가드가 `cancelled` 로 마킹 — [§7.4](#74-분산-실행-multi-instance) Worker 동작의 취소 경로). 일반 경로엔 없음 — [§1.3](#13-블로킹재개-컨트랙트-nodehandleroutput-status) / [6-websocket-protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) |

> **원자성 보장**: `running ↔ waiting_for_input` 전이는 짝이 되는 `NodeExecution` 상태 변경 (`waiting_for_input` / `completed`) 과 **단일 DB 트랜잭션** 으로 묶여 commit / rollback 된다. 서버가 두 save 사이에 크래시해도 `Execution` 과 `NodeExecution` 의 상태 불일치가 발생하지 않는다 (구현: `ExecutionEngineService.updateExecutionStatus` 의 `linkedNodeExec` 파라미터). WebSocket 이벤트 발행은 트랜잭션 commit 후 수행한다. `waiting_for_input → failed` 전이도 동일한 원자성 — `NodeExecution.status=FAILED` save + `Execution.status=FAILED` 가 단일 트랜잭션으로 묶이고, WS 이벤트 순서는 `NODE_FAILED` → `EXECUTION_FAILED`. **재개 진입의 `waiting_for_input → running` claim(§7.5)도 이 원자성에 포함** — 조건부 UPDATE 가 짝 상태(Execution·NodeExecution)를 단일 트랜잭션으로 갱신하고, `affected=0` 이면 어느 쪽도 갱신하지 않는 no-op(ack-and-discard)이며, claim 후 rehydration 프로세스 실패는 `RESUME_*` terminal 로 원자 마감(§7.5)해 `running` 잔류를 남기지 않는다.

> **Pre-park read-window 정규화 (intra-row inconsistency)**: `executeNode` 의 blocking 분기는 핸들러 봉투 (`NodeHandlerOutput.status='waiting_for_input'`) 를 `NodeExecution.outputData` 에 **먼저** 저장하고 `NodeExecution.status` 컬럼은 `running` 으로 유지한 채, 직후 `waitForButtonInteraction` / `waitForFormSubmission` / `waitForAiConversation` 이 status 를 atomic 전이한다. 두 save 사이의 read window 에서 snapshot 이 조회되면 같은 row 가 `status='running'` 인데 `outputData.status='waiting_for_input'` 인 **intra-row inconsistent** 상태로 노출된다 — 위 cross-entity 원자성 보장(Execution.status ↔ NodeExecution.status)은 이 창을 막지 않는다. `findById` 의 REPEATABLE READ 트랜잭션도 두 컬럼의 cross-query straddle 만 막고 같은 row 안의 컬럼 vs 봉투 불일치는 잡지 못한다.
>
> 이 창은 두 레이어에서 방어된다:
>
> 1. **Backend read-side normalization** (`ExecutionsService.findById` — `reconcilePreParkWaitingStatus`): snapshot 응답 직전, `status` 가 `running`/`pending` 이면서 `outputData.status==='waiting_for_input'` 인 row 의 응답 status 를 `waiting_for_input` 으로 surface 한다. DB write 와 엔진 원자성은 불변(순수 read-side 정규화). 모든 snapshot 소비자(웹 앱·channel-web-chat·external-interaction-api)에 일관 적용된다.
> 2. **Frontend defense-in-depth** (`codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` — `isNodeWaitingForInput`): WS `execution.snapshot` 이벤트·read-replica·legacy 응답 shape 등 backend normalization 이 적용되지 않은 경로에서도 intra-row 를 탐지하도록, frontend 는 `ne.status` 단일 필드만 신뢰하지 않고 `ne.outputData.status==='waiting_for_input'` 봉투도 함께 확인한다 (`running`/`pending` row 한정, terminal row 제외).
>
> 두 레이어는 **의도적 중복 방어**이며, 판정 조건(노드 status·봉투 status·terminal 제외)을 한쪽만 변경하면 불일치 창이 재개방된다 — 변경 시 양측(`reconcilePreParkWaitingStatus` ↔ `isNodeWaitingForInput`)을 반드시 동기화한다.

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
                    └─ waiting_for_input ──┬─ running   (재개 진입 원자 claim §7.5 — affected=1 인 단일 worker)
                                           ├─ completed (폼 제출, 버튼 클릭, AI 대화 정상 종료)
                                           │
                                           └─ failed   (AI Agent multi-turn turn 처리 중 LLM throw)
```

| 상태                | 설명                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pending`           | 실행 대기 (선행 노드 완료 대기)                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `running`           | 실행 중                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `waiting_for_input` | 사용자 입력 대기 중 — Form 노드, 버튼이 설정된 Presentation 노드, 또는 AI Agent Multi Turn 대화 입력 대기. turn 처리 중 LLM throw (429/timeout/connection) 시 `failed` 로 전이 (구현: `handleAiTurnError` — spec/4-nodes/3-ai/1-ai-agent.md §7.9 shape 으로 finalize). 또는 rehydration 실패(§7.5 의 `RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE` 세 케이스) 시에도 `failed` 로 전이 — 동반 Execution 은 `cancelled` 로 마감                             |
| `completed`         | 정상 완료                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `failed`            | 실행 실패 (노드 핸들러 throw + Stop/route-error 정책, 또는 시스템 에러). **rehydration 인프라 실패도 `failed`** (§7.5) — 취소가 아닌 결함이므로                                                                                                                                                                                                                                                                                                                                         |
| `cancelled`         | 외부 cancellation signal (`ExecutionContext.abortSignal`) 로 노드의 외부 I/O 가 중단됨 — 핸들러가 throw 한 `AbortError`(`error.name === 'AbortError'`)를 엔진이 `failed` 가 아닌 `cancelled` 로 분류. dispatch 직전 이미 abort 된 경우도 동일(핸들러 미실행). 생산자: Parallel `cancel-others-on-fail` / 사용자 cancel / (향후) Workflow timeout. 종료 시 `execution.node.cancelled` WS 이벤트 발행. SoT: [node-cancellation §5](../conventions/node-cancellation.md#5-aborterror-분류) |
| `skipped`           | 건너뜀 (노드 비활성, Skip Node 정책, 조건 분기 미선택)                                                                                                                                                                                                                                                                                                                                                                                                                                  |

> **`retry_last_turn` 재진입은 새 row 를 spawn 한다**: AI Agent multi-turn 의 retryable error 로 `failed` 가 된 NodeExecution row 는 **전이시키지 않고 그대로 둔다**. `execution.retry_last_turn` 은 동일 nodeId 의 **새 NodeExecution row 를 `running` 으로 생성**(`_retryState` seed)해 마지막 turn 을 replay 한다 — 따라서 한 nodeId 가 복수 row 를 가질 수 있고, WS 명령이 `nodeExecutionId` (nodeId 아님) 로 row 를 식별하는 이유다 ([6-websocket-protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server)). §1.1 의 `failed → running` 은 이 새 row 구동에 따른 **Execution entity** 전이이며, 기존 `failed` row 의 전이가 아니다.

### 1.3 블로킹/재개 컨트랙트 (NodeHandlerOutput `status`)

개별 노드는 `NodeHandlerOutput.status` 로 엔진 흐름 제어 디렉티브를 표현한다. 공통 블로킹/재개 컨트랙트 (CONVENTIONS Principle 4):

| `status`               | 의미                                | 방출 시점                                                                                                                           |
| ---------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `undefined`            | 일반 완료 (대부분 노드)             | 비블로킹 노드 최종 출력                                                                                                             |
| `waiting_for_input`    | 사용자 입력 대기                    | Form · Carousel(button) · Chart(button) · Table(button) · Template(button) · AI Agent multi-turn · Information Extractor multi-turn |
| `resumed`              | 사용자 입력을 수신한 직후           | 재개 tick (observability-only, 라우팅 효과 없음)                                                                                    |
| `ended`                | multi-turn 종료                     | LLM 대화가 `completed` / `user_ended` / `max_turns` / `max_retries` / `error` 중 하나로 최종 정산 시                                |
| `requires_integration` | 외부 통합이 연결되지 않아 준비 필요 | send_email 등 integration 미연결 시 (Stage 4)                                                                                       |
| `requires_playwright`  | PDF 렌더러 필요                     | PDF 노드                                                                                                                            |

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

**보존 예외 — `_resumeCheckpoint`** (재시작 후 재개용 — §7.5 rehydration, **`ai_agent` · `information_extractor` 멀티턴 노드**):

- **적용 범위**: `ai_agent` 와 `information_extractor` 의 multi-turn (`ai_conversation`). checkpoint allow-list 는 두 핸들러 runtime state 의 합집합이다 — `ai_agent`: messages/turnCount/tokens/RAG/MCP·pendingFormToolCall; `information_extractor` 추가: `partialResult`·`collectionRetryCount` (둘 다 credential-free runtime 값). config 필드는 핸들러별로 다르되(`ai_agent`: llmConfigId/maxTurns/conditions/presentationTools; `information_extractor`: outputSchema/examples/instructions/maxCollectionRetries) 재구성 시 공통 generic `resolveRetryNodeConfig` 가 `node.config` 에서 재유도한다. `buildRetryReentryState` 는 두 shape 의 합집합을 채우고 각 핸들러의 `processMultiTurnMessage`(polymorphic)가 자기 필드만 읽는다. 그 외 `ai_conversation` 핸들러는 고유 runtime state 가 allow-list 에 미등록이므로 checkpoint 미영속 → 재시작 후 재개 시 graceful reset (§7.5 `RESUME_INCOMPATIBLE_STATE`).
- waiting_for_input 진입(`emitAiWaitingForInput`) 과 매 turn 영속(`handleAiMessageTurn`) 시점에 엔진이 `_resumeState` 의 **credential-strip 부분집합**을 `_resumeCheckpoint` 로 운반해 `NodeExecution.outputData._resumeCheckpoint` 에 DB 영속한다.
- **`stripControlFields()` 는 `_resumeCheckpoint` 를 보존** (downstream 노드 input 전달 시에는 `_resumeState` 와 함께 제거 — internal-only).
- shape: `_retryState` 와 동일 부분집합(messages / turnCount / model / temperature / maxTokens / knowledgeBases / RAG / MCP / pendingFormToolCall? 등)이되 **`expiresAt`(TTL) 없음** — 대화는 장시간 idle 후에도 재개 가능(waiting Execution 은 무기한 보존) — 과 **`lastUserMessage` 없음** — 재개 시 도착한 사용자 메시지(continuation payload)를 그대로 첫 turn 으로 처리. credential / context-binding 필드(`llmConfigId`/`workspaceId` 등)는 미동봉 (`maskSensitiveFields` 와 동일 정책), 재개 시 `node.config` 재평가로 재유도.
- **스키마 버전 (`schemaVersion`)**: checkpoint 는 `CHECKPOINT_SCHEMA_VERSION` 정수를 동봉해 스키마 진화에 대비한다. 재개 시: 버전 **부재**(기능 배포 이전 row) 또는 **현재 코드 버전 이하**면 누락 필드를 기본값으로 보강해 backward-compatible 재구성, **현재 코드 버전 초과**(롤링 배포 중 구 인스턴스가 신 포맷 checkpoint pickup)면 안전 재구성 불가로 graceful `RESUME_INCOMPATIBLE_STATE`.
- 소비: §7.5 rehydration 이 `outputData._resumeCheckpoint` 로드 → 버전 검사 → `buildRetryReentryState`(`_retryState` 와 공유) 로 `_resumeState` 재구성(핵심 필드 누락 시 기본값 보강) → `driveResumeAwaited`/`driveResumeFrame` 가 도착 continuation payload 를 `dispatchResumeTurn`(ordered `resumeTurnRegistry` — `resume-turn-dispatch.ts`) 경유로 `handleAiResumeTurn` → `processAiResumeTurn`(단발 turn 처리기)에 전달해 그 turn 을 처리. `_resumeCheckpoint` 부재(이 기능 배포 이전 진입한 waiting row)·손상·미래 버전 시 graceful reset (§7.5 `RESUME_INCOMPATIBLE_STATE`).

**보존 예외 — `_retryState`** (retryable error 종결 시):

- AI Agent multi-turn 이 retryable error (HTTP 429 / 5xx / network timeout — `output.error.details.retryable === true`) 로 종결될 때, `buildMultiTurnFinalOutput` 이 `_resumeState` snapshot 을 `_retryState` 로 운반한다 (top-level, Principle 0 예외).
- **`stripControlFields()` 는 `_retryState` 를 보존** — `NodeExecution.outputData._retryState` 로 DB 영속.
- `_retryState` shape: `_resumeState` 의 부분집합 + `expiresAt: ISO 8601` (TTL — 기본 60분, env `AI_RETRY_STATE_TTL_MINUTES` override). credential 제거 정책은 `_resumeState` 와 동일 (`maskSensitiveFields` boundary strip). expression resolver / autocomplete 비노출.
- 소비 (atomic): WS 명령 `execution.retry_last_turn` ([Spec WebSocket §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server)) 이 `nodeExecutionId` 로 `_retryState` 를 lookup → `expiresAt` 검증 → **동일 트랜잭션에서 `_retryState` 키 제거(소비) + 새 NodeExecution row spawn** → continuation 큐(`execution-continuation`)에 `retry_last_turn` job publish → **worker 가 spawn 된 row 를 `_retryState` 로 seed 해 multi-turn loop 재진입**. 키 제거가 affected=1 인 쪽만 진행해 동시 retry 중복 spawn 차단. TTL 만료 또는 이미 소비된 `_retryState` 는 `RETRY_STATE_NOT_FOUND`. (재진입은 worker 컨텍스트 필요 — WS gateway 동기 수행 불가하므로 continuation bus 로 handoff.)
- 상세 SoT: [CONVENTIONS node-output Principle 4.2.1](../conventions/node-output.md#421-보존-예외--_resumecheckpoint--_retrystate), [Spec AI Agent §7.9](../4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트).

**`interaction.data` payload 규격** (CONVENTIONS §4.5):

| `interaction.type` | `data` 형태                                | 적용 노드                                       |
| ------------------ | ------------------------------------------ | ----------------------------------------------- |
| `form_submitted`   | `{ [fieldName]: value }`                   | `form`                                          |
| `button_click`     | `{ buttonId, buttonLabel, selectedItem? }` | `carousel` / `table` / `chart` / `template`     |
| `button_continue`  | `{ buttonId, buttonLabel, url?, selectedItem? }` | link 타입 버튼 (CONVENTIONS §4.5)              |
| `message_received` | `{ content, role: "user" }`                | `ai_agent` / `information_extractor` multi-turn |

> presentation 의 `interaction` 과 AI Agent multi-turn 의 `interaction.type='message_received'` 는 모두 [ConversationThread](../conventions/conversation-thread.md#22-ai-agent) 에 자동 push 되어 후속 AI Agent 가 자동 주입 받을 수 있다. push 시점은 nodeOutputCache 갱신과 같은 단일 트랜잭션.

> presentation 노드의 재개 상태는 `status: 'resumed'` 로 통일돼 있다 (Stage 3 presentation Principle 1.1 재작성 완료). 옛 `'submitted'` / `'button_click'` / `'button_continue'` 는 더 이상 status 값으로 쓰이지 않으며, 해당 의미는 `interaction.type` enum 으로만 표현된다.

> **구현 위치 (C-1 분할 후)**: 위 블로킹/재개 컨트랙트의 처리 메서드는 엔진이 in-process `EngineDriver`(§Rationale "C-1 god-class strangler-fig 분할")로 협력 서비스에 위임한다 — AI 멀티턴(`emitAiWaitingForInput`·`handleAiMessageTurn`·`handleAiResumeTurn`·`processAiResumeTurn`)은 `AiTurnOrchestrator`, form/button park-resume(`waitForFormSubmission`/`processFormResumeTurn`, `waitForButtonInteraction`/`processButtonResumeTurn`)은 `FormInteractionService`/`ButtonInteractionService`, retry(`applyRetryLastTurn`·`resumeGraphAfterRetry` 등)는 `RetryTurnService`. **단 retry 진입점은 엔진이 위임하지 않고 외부(`websocket.gateway`·`continuation-execution.processor`)가 `RetryTurnService` 를 직접 호출**하며, `RetryTurnService` 가 `RetryEngineDriver` 로 엔진 그래프 루프를 역으로 구동한다(후속 ④ — engine→Retry 순환 DI 제거, §Rationale C-1). dispatch registry(`resume-turn-dispatch`)·체크포인트 빌더(`buildRetryReentryState`·`buildResumeCheckpoint`·`isCheckpointEligibleNodeType`)는 엔진 잔류(EngineDriver 멤버 — ISP 계층).

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

| 설정                  | 환경 변수             | 기본값 | 설명                                                                  |
| --------------------- | --------------------- | ------ | --------------------------------------------------------------------- |
| 노드별 최대 반복 횟수 | `MAX_NODE_ITERATIONS` | `100`  | 단일 노드가 한 실행에서 반복될 수 있는 최대 횟수. `0` 설정 시 무제한. 모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영 (§11 worker env 들과 동일 규약). |

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

### 3.4 중첩 컨테이너 스코프

컨테이너가 중첩된 경우(예: Loop > ForEach), 내부 컨테이너는 **스코프 체인**을 통해 외부 컨텍스트를 참조할 수 있다.

#### 3.4.1 스코프 체인 규칙

| 규칙           | 설명                                                                                |
| -------------- | ----------------------------------------------------------------------------------- |
| 읽기 가능      | 내부 컨테이너에서 외부 컨테이너의 컨텍스트 변수를 읽을 수 있다                      |
| 쓰기 불가      | 내부 컨테이너에서 외부 컨테이너의 컨텍스트 변수를 직접 수정할 수 없다               |
| Shadowing      | 동명 변수가 존재하면 내부(현재 스코프)가 우선한다                                   |
| `$parent` 접근 | `$parent.loop`, `$parent.item`으로 한 단계 외부 컨테이너 컨텍스트에 명시적으로 접근 |

#### 3.4.2 예시: Loop > ForEach 중첩

```
Loop (외부)                    ForEach (내부)
──────────────                 ──────────────────
$loop.index = 2               $item = "current item"
$loop.count = 10              $itemIndex = 1 ($itemIsFirst=false, $itemIsLast=…)
                               $parent.loop.index = 2  (외부 Loop 참조)
                               $parent.loop.count = 10
```

- 내부 ForEach에서 `$loop`를 참조하면 → 외부 Loop의 `$loop` (ForEach는 `$loop` 변수를 생성하지 않으므로 shadowing 없음)
- 내부 ForEach에서 `$item`을 참조하면 → ForEach 자신의 현재 항목
- ForEach 인덱스·first/last 는 top-level 변수 `$itemIndex` / `$itemIsFirst` / `$itemIsLast` 다. `$item.index` 는 별개 — `$item` 이 객체일 때 그 객체의 `index` 속성을 가리킬 뿐 ForEach 인덱스와 무관하다.
- 외부 Loop에 대해 명시적으로 `$parent.loop`로도 접근 가능

---

## 4. Worker 모델

> **구현 상태 — §4.1~4.3 PR1 구현 완료**: `execution-run` intake 큐·work-stealing·우선순위(§4.1–4.3)는 PR1(`impl-exec-intake-queue`)에서 구현됐다. `execute()` 는 Execution row 를 `pending` 으로 저장한 뒤 `execution-run` 큐에 job 을 발행하고 즉시 반환하며, `ExecutionRunProcessor` 가 work-stealing 으로 pick up 해 첫 active 세그먼트를 처리한다(`runExecutionFromQueue`). 세그먼트 내부 노드 dispatch 는 여전히 in-process (`runExecution` while-loop — §2.1, per-node task queue 없음). 별도 BullMQ 큐는 `execution-run`(본 절) · `background-execution`(§3.3) · `execution-continuation`(§7.4) 세 개. **§7.1 stalled-job 재배달(crash 재개)은 PR4 구현 완료(2026-07-04)** — `maxStalledCount:1` 로 크래시 세그먼트를 같은 jobId 로 1회 자동 재배달 → §7.5 case B 재구동. **§8 동시성 cap 은 PR2b 구현 완료**(advisory-lock admission gate — §8 참조), **우선순위 3-tier 도 구현 완료(2026-07-04, triggerType threading)** — `manual`>`webhook`>`schedule`(호출부가 `ExecuteOptions.triggerType` 전달, executedBy 우선, §4.3). 잔여 후속: `plan/in-progress/exec-intake-followups.md` · `plan/in-progress/execution-engine-residual-gaps.md`.
>
> **설계 모델 — "active 세그먼트 + durable park"**: 한 Execution 을 **active-running 세그먼트들의 연속**(노드를 실제로 전진시키는 작업 구간)과 그 사이의 **durable park**(`waiting_for_input`)로 본다. 두 BullMQ 큐가 active 세그먼트를 운반한다 — `execution-run`(첫 세그먼트: 시작→첫 BLOCK/완료)·`execution-continuation`(매 재개 세그먼트, §7.4 기존). `waiting_for_input` 은 큐에 들어가지 않는 DB park 다(§2 아래). per-node task queue(1 Worker = 1 NodeExecution)는 채택하지 않는다 — 근거는 [§Rationale "per-node → execution-level intake 큐"](#rationale).

### 4.1 아키텍처 (target — execution-level intake 큐)

```
┌─────────────┐     ┌────────────────────┐     ┌─────────────┐
│  execute()  │────→│  BullMQ            │────→│  Worker 1   │  각 워커 = 실행 1건의
│  (Producer) │     │  execution-run     │     │  Worker 2   │  active 세그먼트
│             │     │  (intake queue)    │     │  Worker N   │  (시작→첫 BLOCK/완료)
└─────────────┘     └────────────────────┘     └─────────────┘
```

- `execute()` 는 Execution row 를 `pending` 으로 저장한 뒤 (현 fire-and-forget in-process 호출 대신) `execution-run` 큐에 "실행 시작" job 을 발행하고 **즉시 반환(비동기)** 한다. N 개 backend/worker 인스턴스가 work-stealing 으로 consume 한다. intake 큐가 버스트(웹훅·이벤트 홍수)를 버퍼링해 backpressure 를 제공한다.
- 큐는 `background-execution`·`execution-continuation` 과 동일한 BullMQ infra 를 재사용한다.

### 4.2 작업 단위 — execution-level 세그먼트 (target)

- **1 Worker = 1 active 세그먼트**: 한 워커가 실행 1건을 통째로(시작/재개부터 다음 BLOCK 또는 완료까지) 처리한다. job 을 받은 워커는 기존 `runExecution` 의 **in-process dispatch loop** 를 그대로 수행하므로, 컨테이너(Loop/ForEach/Map)·중첩 스코프·back-edge·Parallel 의미론은 **무변경**(한 세그먼트 = 한 워커 프로세스). **한 세그먼트 내부의 노드 dispatch 는 여전히 in-process — per-node task queue 는 도입하지 않는다.**
- `execution-run` job 메시지 (PR1 구현):

```json
{
  "executionId": "uuid",
  "input": { ... }
}
```

> **PR1 jobId·triggerType 구현 메모**:
>
> - **jobId = `executionId`** (BullMQ `add` 옵션). PR1 은 Execution row 생성당 1회만 enqueue 하므로 executionId 자체가 유일 dedup 키이고 seq 가 불필요하다 — `<executionId>:run:<seq>` 일반형은 **BullMQ re-enqueue 로 crash 재개하는 PR4** 에서 활성화한다(§9.2 `exec:run:seq` 참조). **PR3 의 재시작 크래시 re-drive 는 re-enqueue 가 아니라 `recoverStuckExecutions` 의 in-process `started_at` re-claim + §7.5 case B 재구동**이라 seq 를 쓰지 않는다(§7.1).
> - **triggerType 은 payload 에 싣지 않는다.** 우선순위 계산(BullMQ `priority` 옵션)에만 쓰고 `ExecutionRunJob` payload 에는 포함하지 않는다. **3-tier(`manual`>`webhook`>`schedule`)는 구현 완료(2026-07-04, triggerType threading)**: `execute()` 는 **`executedBy` 우선 판정** — `executedBy` 존재 시 `manual`(수동 실행·schedule "지금 실행" `runNow` 포함), 그 외에는 호출부가 `ExecuteOptions.triggerType`(`Trigger.type` [§2.8](../1-data-model.md#28-trigger) 어휘: webhook/schedule)로 전달한 값(미전달 시 `webhook` fallback)을 `resolveExecutionRunPriority` 에 넘긴다. (본 `triggerType` 은 priority 계산 전용 — 실행 이력 표시용 `Execution.triggerSource` 5-way 와는 별개 필드.)
> - **active-running 직렬화 불변식 (PR2a)**: 위 `jobId = executionId` dedup 으로 **동일 Execution 의 active 세그먼트는 항상 1개**이며 두 세그먼트가 동시 실행되지 않는다. PR2a 의 active-running 누적 타임아웃(§8)은 `assertActiveTimeWithinLimit`(판정)과 `updateExecutionStatus`(누적) 사이에 잠금 없는 read-check-then-act 가 있으나, 이 불변식 덕에 두 연산 사이에 다른 세그먼트가 끼어드는 경로가 구조적으로 없어 실질 race 가 없다. **PR2b+ 재진입 경로**(예: `retry_last_turn` 으로 동시 active 세그먼트가 가능해지는 설계)가 추가되면 이 불변식이 깨질 수 있으므로 PR2b 착수 전 재검증한다([§Rationale](#rationale)).
>   세그먼트 종료: (a) Execution 완료/실패 → job 정상 ack, (b) 노드 BLOCK(`waiting_for_input`) → §2(아래 "waiting_for_input park") 처리 후 job 정상 ack.

### 4.3 수평 확장 (target)

| 항목               | 설명                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Worker 인스턴스 수 | backend 인스턴스 수로 결정 (LB 뒤 N 개)                                                                                     |
| per-worker 동시성  | `EXECUTION_RUN_WORKER_CONCURRENCY` (§11). 비양수·비정수·비숫자 입력 fallback 은 `CONTINUATION_WORKER_CONCURRENCY` 패턴 준용 |
| 스케일 아웃        | backend/worker 프로세스 추가로 처리량 증가 (work-stealing)                                                                  |
| 우선순위           | **BullMQ job priority** 로 `manual` > `webhook` > `schedule` (`triggerType` → priority 매핑)                                |
| 큐 파티셔닝        | 워크스페이스별 큐 분리는 **후속(P2)** — 초기엔 단일 `execution-run` 큐 + priority + concurrency                             |

### 4.x waiting_for_input park (intake 큐가 wait 의미를 바꾸지 않음)

> intake 큐 도입은 wait 의미를 전혀 바꾸지 않는다. `waiting_for_input` 은 active 세그먼트가 아니라 두 세그먼트 사이의 durable park 다.

- **BLOCK 진입 시**: 그 세그먼트를 운반하던 job(`execution-run` 또는 `execution-continuation`)은 "BLOCK/완료까지 전진" 이라는 자기 작업을 완수한 것 → **정상 ack/remove**(fail/retry 아님). Execution row 만 `waiting_for_input` 으로 남는다.
- **park 상태**: 큐 엔트리 없음 · heartbeat 없음 · TTL 없음 · §7.1 stalled 재큐 대상 아님 · §7.4 stuck-recovery 대상 아님(`waiting_for_input` 제외). DB 에 **무기한 보존**.
- **재개**: 오직 사용자 인터랙션 도착만이 `execution-continuation` job 을 만들어 다음 active 세그먼트를 시작한다(§7.4/§7.5 경로 무변경). 노드 자체의 워크플로 정의 timeout(예: `formConfig.timeout`)은 엔진 자원 가드와 별개로 유지.

> **구현 메모 — park = 세그먼트 종료 (Phase B, 구현 완료)**: 본 메모는 Phase B **최종 상태**를 기술하며, 이제 구현이 이 최종 상태와 일치한다. 단계 적용 현황(2026-06-06) — **PR-B1(form/button) 완료** + **PR-B2a(top-level 멀티턴 AI) 완료** + **PR-B2b(중첩 sub-workflow exec-park D6 + full B3) 완료**: 모든 park-site(단발 form/button, top-level·중첩 멀티턴 AI)가 park=세그먼트 종료로 전환됐다. PR-B2b 에서 중첩 `executeInline` blocking 이 durable 화됐고(call-stack 영속 `Execution.resume_call_stack` V087 + frame-by-frame rehydration `driveCallStackResume`/`driveResumeFrame` + `ParkReleaseSignal` 중첩 park 전파 + `executeInline` park-release), in-memory 머신(`pendingContinuations`/`firstSegmentBarriers` 일가/`firePayload` scheduler/`runAiConversationLoop` 장수 루프/detached)은 **완전 제거(full B3)**됐다 — 재개는 §7.5 rehydration 단일 경로로 일원화됐다. — 위 "BLOCK 진입 시 job 정상 ack" 는 **park 시 `runExecution` 세그먼트가 즉시 반환**해 달성한다 — 각 `waitForX`(form/button/AI 멀티턴)는 durable 영속(§6.2 — conversation_thread / user_variables / \_resumeCheckpoint / resume_call_stack) 후 대기 없이 반환하고, `runExecution` 은 그 세그먼트를 종료한다. 따라서 `runExecutionFromQueue`(worker `process()` 진입점)는 `runExecution` 의 반환만 직접 await 하면 job 을 ack/반환할 수 있어, park 동안 BullMQ 슬롯도 코루틴/컨텍스트 메모리도 점유되지 않는다(bounded 메모리). 재개는 §7.5 rehydration 이 임의 worker 에서 컨텍스트를 재구성해 다음 세그먼트를 구동한다. (이전의 detached coroutine + `firstSegmentBarriers` 단발 배리어 메커니즘은 park 가 곧 세그먼트 종료가 되어 불필요해져 제거됐다. §Rationale "park 즉시 해제 + slow-path 일원화".)
>
> **재개 경로 — slow-path 일원화 (Phase B, 구현 완료)**: park 시 `runExecution` 세그먼트가 즉시 반환하면 in-process 코루틴이 살아남지 않아 **모든 재개가 §7.5 rehydration(slow-path) 단일 경로**가 된다(같은 인스턴스 우연 픽업이어도 동일). **현황(2026-06-06)**: form/button(PR-B1)·top-level 멀티턴 AI(PR-B2a)·**중첩 `executeInline` blocking·중첩 멀티턴 AI(PR-B2b, exec-park D6)** 모두 이 단일 경로로 전환 완료 — fresh park 가 in-memory resolver 를 등록하지 않아 항상 rehydration 으로 재개한다. 멀티턴 AI = **turn-단위 park(D4)**: `processAiResumeTurn` 이 매 turn 입력 대기에서 코루틴을 해제해 한 turn = 한 세그먼트로, 응답 없는 대화도 메모리 0 점유한다. 중첩 케이스는 §7.5 의 `resume_call_stack`(V087) frame-by-frame 재진입으로 재개한다. 재개에 필요한 in-flight 상태는 park 시 durable 영속된다: `conversationThread`(요약 보관 필드 포함, `Execution.conversation_thread` V084 — A1), 사용자 정의 variables(`Execution.user_variables` V085 — A3), 멀티턴 AI `_resumeCheckpoint`(A2a/A2b), 중첩 호출 체인(`Execution.resume_call_stack` V087 — exec-park D6). rehydration 이 이들을 무손실 복원하고 `node.config` 를 fresh 재유도(D3: park 중 워크플로 편집은 다음 turn 부터 반영)해 다음 세그먼트를 구동한다. 멀티턴 `_resumeCheckpoint` 부재/손상/미래버전 시에만 `RESUME_INCOMPATIBLE_STATE` 종결(§7.5). (배경·대안 기각·단계 롤아웃: §Rationale "park 즉시 해제 + slow-path 일원화".)

### 4.4 이벤트 발행 sink — `WebsocketService` 단일 sink 정책

> **결정**: 실행 엔진의 외부 이벤트 발행 (`NODE_STARTED` / `NODE_COMPLETED` / `EXECUTION_*` / `AI_MESSAGE` 등) sink 는 **`WebsocketService` 가 canonical** 이며, 별도 추상화 (`IExecutionEventEmitter` 같은 인터페이스 / Nest `EventEmitter2`) 를 도입하지 않는다.

근거:

- **단일 sink** — 본 시스템에서 외부 이벤트 소비자는 WebSocket 클라이언트 1종 뿐. 다중 sink 가 가시화되기 전까지 추상화는 YAGNI.
- **분산은 Continuation Bus (§7.4) 가 담당** — 인스턴스 간 fan-out 은 BullMQ 영속 큐 `execution-continuation` 이 처리하므로, 이벤트 발행 추상화와 분산 동작은 직교. 옛 Redis pub/sub 채널 `execution:continuation` 은 폐기 (§Rationale "Durable Continuation").
- **순환 의존 처리** — `ExecutionEngineService ↔ WebsocketService` 의 순환은 NestJS 표준 패턴인 `forwardRef(() => WebsocketService)` 로 해결. 이는 Nest 권장 패턴이며 회피해야 할 안티패턴이 아님. 엔진 분할 후속 ④(engine→Retry 순환 DI 제거)에서 retry 진입점 재배선으로 노출된 `ws.service↔gateway↔retry↔event-emitter` ES-module 순환도 `ExecutionEventEmitter→WebsocketService` 를 `forwardRef` 로 지연 해석해 봉인했다 — `ExecutionEventEmitter` 는 발행 call-site 일원화를 위한 **동형 thin 래퍼**이지 본 절이 금지하는 외부 이벤트 sink **추상화 인터페이스**가 아니므로 단일 sink 정책의 예외가 아니다(§Rationale "C-1 god-class strangler-fig 분할").
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

| 메서드                            | 설명                                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `validate(config)`                | 노드 설정의 유효성 검사. 워크플로우 저장/실행 전에 호출. 에러 시 `{ valid: false, errors: [...] }` 반환                          |
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

| 표현식                                | 반환                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `$node["SendEmail"].output.messageId` | 메일 전송 결과 messageId                                                      |
| `$node["SendEmail"].config.subject`   | 노드 설정의 **원본** 제목 (예: `"Hello {{ name }}"` — expression 미평가 형태) |
| `$node["SendEmail"].output.subject`   | 실제 발송된 제목 (예: `"Hello Alice"` — expression 평가 결과)                 |
| `$node["HTTP"].meta.statusCode`       | HTTP 응답 상태코드                                                            |
| `$node["HTTP"].output.response`       | 응답 본문                                                                     |
| `$node["IfElse"].port`                | 실행 시 선택된 포트 (`'true'` / `'false'`)                                    |
| `$node["Form"].status`                | `'waiting_for_input'` 등 엔진 디렉티브                                        |

expression 이 포함된 필드는 `.config.*` 에서 **원본** 을, `.output.*` 에서 **평가 결과** 를 얻는다. expression 이 포함되지 않은 필드(예: `mode`, `chartType`)는 두 영역의 값이 동일하므로 `.config.*` 만 사용해도 충분하다.

`nodeKey`는 노드 라벨(중복 시 `#N` suffix)과 노드 UUID 두 방식 모두 지원한다. `.output`·`.config`·`.meta`·`.port`·`.status` 외의 필드는 정의되지 않는다.

### 5.3 Port Selector 패턴

조건 분기 노드(`if-else`, `switch`, `text-classifier`, `http-request`, `ai-agent` 조건 라우팅)는 반환값에 `port` 필드를 함께 설정한다:

```ts
return {
  config: { condition: "..." },
  output: forwardedData, // downstream으로 전달될 입력
  port: "true" | "false", // 엔진이 이 포트의 엣지만 활성화
};
```

엔진의 `applyPortSelection(output)`은 `output.port`를 읽어 `_selectedPort`를 기록하고, downstream 노드의 input은 `output.output`이 된다.

Legacy `{ port, data }` 패턴은 제거되었으며, 이행 기간 호환성을 위해 `output.data`가 있으면 `output.output`으로 자동 보정한다.

### 5.4 NodeHandlerRegistry

```
interface NodeHandlerRegistry {
  register(nodeType: string, handler: NodeHandler, metadata?: NodeTypeMetadata) → void
  get(nodeType: string) → NodeHandler
  getMetadata(nodeType: string) → NodeTypeMetadata   // 미등록 metadata 는 { kind: 'standard' } sentinel 반환
  assertConsistency() → void                          // 부팅 시 등록 일관성 검증
}
```

- 시스템 시작 시 모든 빌트인 노드 핸들러를 레지스트리에 등록
- 마켓플레이스를 통해 설치된 커스텀 플러그인 노드의 동일 레지스트리 등록은 **Planned** ([4-nodes 개요 §4](../4-nodes/0-overview.md) 마켓플레이스 로드맵과 동일 단계)
- 미등록 nodeType 조회 시 `UNKNOWN_NODE_TYPE` 에러

**`NodeTypeMetadata` 기반 dispatch** (`node-type-metadata.ts`): `register` 의 3번째 인자 `metadata` 는 엔진 dispatch 가 노드 타입별 특수 실행 경로를 선택하는 데 쓰는 discriminated union 이다 — 종전의 hard-coded 노드 타입 분기를 대체한다 (PR-G). `NodeTypeMetadata.kind` 는 핸들러 런타임 출력의 `executionMetadata.kind`(예: foreach 의 `'container'`) 와 동일 어휘를 쓰지만 **별개 객체·별개 소비처**(등록 시 static dispatch 선택 vs 실행 결과 메타) 다.

| `kind`       | 의미                                                                                                                                | 현재 등록 타입               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `standard`   | 일반 노드 — 특수 dispatch 없음                                                                                                      | 대부분 노드 (sentinel 기본) |
| `container`  | 컨테이너 — `containerId` 자식 그룹화 + iteration 별 body 재실행 (§3)                                                                | `foreach` / `loop` / `map`   |
| `background` | `background` 포트 sub-graph 를 비동기 큐 실행 (§3.3)                                                                                | `background`                 |
| `parallel`   | N branch 동시 실행 (`p-limit` semaphore)                                                                                            | `parallel`                   |
| `blocking`   | 정적으로 항상 blocking (`interaction: 'form'`) — buttons/ai_conversation 은 본 metadata 가 아니라 런타임 `meta.interactionType` 분기 | `form`                       |
| `trigger`    | 워크플로우 진입점                                                                                                                   | `manual_trigger`             |

- `getMetadata(type)` 는 metadata 미등록 타입에 sentinel `{ kind: 'standard' }` 를 반환한다 — dispatch 분기가 명시 분기 없이 안전 동작.
- **부팅 검증 `assertConsistency()`**: `onApplicationBootstrap` 시점에 등록 일관성(모든 등록 type 의 metadata 보유, dedicated executor 주입 등)을 검사한다 — **production 에서는 위반 시 throw**, 비-production 에서는 warn 로깅만 (테스트의 metadata 생략 등록 허용 — 이 경우 sentinel 로 안전 동작).

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

| 변수                                                 | 소스                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$input`                                             | 이전 노드 출력 (gatherNodeInput 결과). 트리거 노드에서는 `{ parameters, ...(트리거별 메타) }` |
| `$params`                                            | `$input.parameters`의 축약형. Trigger 노드가 생성한 구조화된 입력 파라미터에 직접 접근        |
| `$node`                                              | nodeMap + nodeOutputCache → 노드 라벨 키 맵. `$node["Label"].output` 형태로 접근              |
| `$var`                                               | context.variables (Variable Declaration/Modification으로 관리)                                |
| `$execution`                                         | `{ id, workflowId, startedAt, mode }`                                                         |
| `$now`                                               | 실행 시점의 현재 시각 (ISO 8601, UTC). 같은 실행 안에서는 동일한 값으로 고정                  |
| `$loop`                                              | loopContext (Loop 컨테이너 내부)                                                              |
| `$item`, `$itemIndex`, `$itemIsFirst`, `$itemIsLast` | itemContext (ForEach 컨테이너 내부)                                                           |
| `$thread`                                            | context.conversationThread                                                                    | ConversationThread readonly view ([Spec Conversation Thread](../conventions/conversation-thread.md)). v1 은 `turns` / `length` / `text` 만 노출 — 표현식 문법 상세는 [Spec 표현식 §4.4](./5-expression-language.md#44-thread-속성) 참조 |

> **Template 노드 예외 — 입력 root-spread**: `template` 노드에 한해, 입력(nodeInput)이 **비-배열 객체**이면 엔진이 `buildExpressionContext` 직후 그 최상위 키들을 위 컨텍스트의 root-level 변수로 spread 한다 — `{{ name }}` 이 `{{ $input.name }}` 과 동등. 단 `$`-builtin 등 기존 컨텍스트 키와 동명이면 기존 키 우선 (`Object.hasOwn` 가드, 덮어쓰지 않음). 입력이 배열·원시값이면 spread 하지 않는다. SoT: `execution-engine.service.ts` 의 `NODE_TYPES.TEMPLATE` 분기. 상세: [Spec Template §4 실행 로직](../4-nodes/6-presentation/5-template.md#4-실행-로직).

**핸들러별 제외 규칙**:

| 핸들러   | 제외 키          | 사유                                                                                                                                                 |
| -------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `code`   | `code`           | 원시 JavaScript — 자체 런타임(`$input`, `$vars`, `$execution`) 사용                                                                                  |
| `table`  | `columns`        | 컬럼 표현식은 `TableHandler` 내부에서 항목별(per-item) 평가                                                                                          |
| `filter` | `conditions`     | 조건은 표현식이 아닌 각 배열 항목 기준 field path                                                                                                    |
| `loop`   | `breakCondition` | iteration 마다 재평가 (현재 `$loop` / `$var` / `$node[...]` 참조). dispatch 시점 선평가는 `i=0` 으로 고정되고 첫 iteration 전 `$loop` 미정의로 throw |

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

| 카테고리     | 기본 리트라이         | 설정 가능                  | 비고                          |
| ------------ | --------------------- | -------------------------- | ----------------------------- |
| Integration  | 최대 3회, 지수 백오프 | O (maxRetries, retryDelay) | 외부 서비스 일시 장애 대응    |
| AI           | 최대 2회, 지수 백오프 | O                          | LLM 프로바이더 일시 장애 대응 |
| Logic        | 리트라이 없음         | X                          | 결정론적 실행, 재시도 무의미  |
| Data         | 리트라이 없음         | X                          | 결정론적 실행, 재시도 무의미  |
| Flow         | 최대 1회              | O                          | 하위 워크플로우 호출 실패 시  |
| Presentation | 리트라이 없음         | X                          | UI 렌더링, 재시도 무의미      |

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

| 필드                        | 언제 설정되는가                                    | 용도                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `executionId`               | 실행 시작 시 고정                                  | Execution/NodeExecution 귀속                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `workflowId`                | 실행 시작 시 고정                                  | 표현식 컨텍스트, 사용처 확인                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `nodeExecutionId`           | 엔진이 handler.execute 호출 직전 주입, 노드별 갱신 | Integration 핸들러가 `IntegrationUsageLog.node_execution_id`로 기록                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `rawConfig`                 | 엔진이 handler.execute 호출 직전 주입, 노드별 갱신 | 노드 정의에 저장된 **원본 config** (expression 미평가). 핸들러가 `NodeHandlerOutput.config` echo 에 사용 (Principle 7). Shallow `Object.freeze` 적용 — top-level mutation 차단, 중첩 객체는 read-only 로 다룬다                                                                                                                                                                                                                                                                                                                          |
| `engineResolvedConfigCache` | 엔진이 expression 평가 직후, 노드별로 누적 갱신    | 노드별로 **expression 평가가 끝난 config** 의 snapshot. `runContainerInner` / `runParallel` 같이 핸들러 종료 후 별도 단계에서 동작 파라미터(Loop `count`, Parallel `branchCount`/`maxConcurrency`/`waitAll`, ForEach `errorPolicy` 등) 를 다시 읽어야 하는 경로가 사용한다. **expression 컨텍스트에는 노출하지 않는다** — `$node["X"].config` 는 여전히 raw echo 를 반환해야 한다 (Principle 7 보존). 핸들러가 raw 만 echo 하는 컨테이너의 동작 파라미터가 silent default fallback 되거나 `Number("{{...}}")` 가 NaN 이 되던 문제를 차단 |

**엔진 내부 Map 키 (`_contextKey`)**: `ExecutionContextService` 의 in-memory `Map<key, ExecutionContext>` 라우팅 키. `createContext(executionId, workflowId, options?: { initialVariables?, recursionDepth?, contextKey?, conversationThread? })` 에서 Map 키 = `options?.contextKey ?? executionId` — `conversationThread?: MutableConversationThread` 는 §7.5 rehydration 이 `Execution.conversation_thread` 컬럼에서 복원한 thread 를 새 컨텍스트에 seed 하는 옵션 (PR-A1, §6.2/§7.5) — 비-background 호출은 `contextKey` 를 생략해 항상 `executionId` 와 동일(동작 불변). background 본문만 `bg:<executionId>:<backgroundRunId>` 를 전달해 부모 컨텍스트와 키 격리한다 (§3.3, [Background §4](../4-nodes/1-logic/12-background.md#4-실행-로직)). **이 키는 in-memory 전용** — Redis 키 패턴(§9.1)과 무관하다. 결정 SoT: [execution-context 규약 §Rationale](../conventions/execution-context.md#rationale).

**Multi-turn 재개 시 `rawConfig` snapshot 정책**:

- 첫 turn 의 `executeNode` 가 `waiting_for_input` 으로 진입하면 엔진이 `state.rawConfig = Object.freeze({ ...node.config })` 을 자동 snapshot 한다.
- 후속 turn 의 `processMultiTurnMessage(message, state)` 는 state 만 받으므로 (ExecutionContext 미주입), 핸들러가 `state.rawConfig` 로 일관되게 접근한다.
- **의도된 차이**: `context.rawConfig` 는 매 노드 실행 시점의 fresh DB read, `state.rawConfig` 는 한 turn 처리 동안 frozen snapshot.
- **Phase B turn-단위 park (D4) + fresh-config (D3)**: 멀티턴 AI 는 매 turn 입력 대기에서 코루틴을 해제하고(turn-단위 park), 다음 메시지에 §7.5 rehydration 으로 재개한다. 재개 시 `buildRetryReentryState` 가 **현재 `node.config` 에서 `rawConfig` 를 fresh 재유도·재freeze** 한다 — 따라서 frozen snapshot 은 *한 turn 처리 범위*로 한정되고, **park 중 워크플로 정의를 편집하면 다음 turn 부터 새 정의가 적용**된다(fresh-per-turn). 이는 Phase B 이전의 "대화 전체=첫 turn 정의 고정"(per-conversation frozen) 동작을 대체한다 — replay reproducibility 는 turn 단위로 약화되나, 모든 재개를 rehydration 으로 일원화(bounded 메모리)하기 위한 의도된 trade-off다(§Rationale, D3 결정).
  | `variables.__workspaceId` | 실행 시작 시 주입 (workflow.workspaceId) | Integration 조회, AI LLM 설정 조회 등 워크스페이스 단위 리소스 해소 |
  | `variables.*` (그 외) | 트리거·워크플로우 변수 (Variable Declaration / Modification 노드가 설정하는 사용자 정의 런타임 값) | 표현식 `{{ $variables.X }}` / `$var.X` 평가. **park 시 시스템 `__*` 제외 사용자분이 `Execution.user_variables`(V085)에 durable commit 되고 rehydration(§7.5)이 복원** — park 이전에 설정한 변수를 park 이후 노드가 무손실 참조한다 |
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

> 위 블록은 **출처 분류용 공통 옵션**만 보인다. 실제 `ExecuteOptions` 유니온에는 모드별 메타데이터 필드가 더 있으며 각자의 spec 이 SoT 다: re-run(`reRunOf`/`chainId`/`dryRun` — [§13](./13-replay-rerun.md)), webhook 호출 이력(`sourceIp`/`responseCode` — [config §A.3](../2-navigation/6-config.md)), **단일 노드 실행(`singleNodeId`/`previousExecutionId` — [3-execution §1.3](../3-workflow-editor/3-execution.md#13-단일-노드-테스트))**. 모두 `executedBy` variant(수동 실행)에 부가되며 `Execution` 컬럼으로 영속돼 큐 재조회 후 `runExecution` 이 읽는다.

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

| 단계                      | 저장소                                                                                                                              | 설명                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 실행 중                   | **in-memory** (`ExecutionContextService` segment-local Map)                                                                         | 실행 컨텍스트(변수 · nodeOutputCache · conversationThread 등)를 **인스턴스-로컬 in-memory `Map<contextKey, ExecutionContext>`** 에 보관한다. **세그먼트-로컬** — park(=세그먼트 종료, §4.x full B3) 또는 완료 시 소멸하며, 크래시/재시작·타 인스턴스 재개는 아래 durable 컬럼에서 §7.5 rehydration 이 재구성한다(Redis 영속 아님 — §Rationale "실행 컨텍스트 in-memory + DB durable"). |
| 노드 완료 시              | in-memory + PostgreSQL                                                                                                              | nodeOutputCache 갱신(in-memory context), NodeExecution 레코드 + `execution_node_log`(노드 순서, §7.4) 저장(PostgreSQL)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 노드 hook 시              | in-memory (`ExecutionContext.conversationThread` 일부)                                                                              | `ConversationThreadService.append*` 가 presentation `interaction` resume / AI Agent multi-turn message·assistant 발생 시 in-memory thread 를 갱신. 실행 이력 화면의 SoT 는 NodeExecution.outputData (`output.interaction` / `output.messages` / `output.result.response`) — durable resume 스냅샷(`Execution.conversation_thread`)은 아래 "waiting_for_input 진입 시" 행에서 별도 commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| waiting_for_input 진입 시 | PostgreSQL (`NodeExecution.outputData` + `Execution.conversation_thread` + `Execution.user_variables` + `Execution.resume_call_stack`) | 다음 노드 재개에 필요한 모든 정보를 commit. **in-memory ExecutionContext 는 park 시 소멸**(park=세그먼트 종료, §4.x full B3) — 재개는 아래 durable 컬럼에서 §7.5 rehydration 이 재구성한다(Redis 영속 없음). (a) `interactionType` 과 노드의 `rawConfig` snapshot (§5.5), (b) multi-turn 의 경우 `_resumeState` 의 credential-strip 부분집합인 `_resumeCheckpoint` (§1.3 — `_resumeState` full 은 in-memory 만), (c) 현재 `context.conversationThread` 전체 스냅샷을 **`Execution.conversation_thread jsonb`** 컬럼에 durable commit (last-write = 최신 스냅샷 — §7.5 rehydration 이 여기서 무손실 복원, [Spec Conversation Thread §4·§8.4](../conventions/conversation-thread.md#4-영속화)), (d) `context.variables` 중 시스템 `__*` 제외 사용자 정의분을 **`Execution.user_variables jsonb`**(V085)에 durable commit (§6.1 — rehydration 이 복원해 park 이전 변수를 park 이후 무손실 참조), (e) **중첩 sub-workflow(`executeInline`) 안에서 park 한 경우** executeInline 호출 체인(outermost→waiting inner 직전)을 **`Execution.resume_call_stack jsonb`**(V087, exec-park D6)에 durable commit — §7.5 rehydration 이 이 스택으로 sub-workflow 프레임을 frame-by-frame 재진입한다. top-level park(중첩 깊이 0)는 `NULL`. **(구현 상태 2026-06-06: 구현 완료 — PR-B2b. 컬럼 V087·타입·`CALL_STACK_SCHEMA_VERSION`, park 시 stage(`executeInline` park-release + `_callStack` 영속), §7.5 frame-by-frame 재진입(`driveCallStackResume`/`driveResumeFrame`) 모두 반영.)** `version` 은 `CALL_STACK_SCHEMA_VERSION`(checkpoint 와 독립 — 별도 진화). **별도 `_continuationCheckpoint` 컬럼은 신설하지 않는다** — (a)/(b) 는 기존 SoT 인 `NodeExecution.outputData` 를 §7.5 rehydration 의 단일 진실로 활용. (e) `resume_call_stack` 은 continuation **운반**(BullMQ 큐가 durable 운반)이 아니라 park 시점의 **중첩 실행 위상**(호출 체인) 영속이라 `_continuationCheckpoint` 기각과 다른 범주다(§Rationale exec-park D6). |
| 실행 완료 시              | PostgreSQL                                                                                                                          | 최종 출력·상태를 PostgreSQL 에 영구 저장, in-memory ExecutionContext 소멸(`finalizeRehydrationCleanup` / 세그먼트 종료)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

> **라이브 조기 노출 신호는 비영속**: multi-turn 재개 chokepoint(WS `execution.submit_message` 와 채널 텍스트 인바운드의 공통 경로 = [AI Agent §7.5](../4-nodes/3-ai/1-ai-agent.md#75-multi-turn-모드--사용자-메시지-수신-status-resumed-transient) `message_received` resume tick)는 다음 턴 LLM 호출 전에 WS `execution.user_message` 이벤트를 emit 해 사용자 발화를 라이브로 조기 노출한다 ([WebSocket §4.4](./6-websocket-protocol.md#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input)). 이는 `tool_call_*` 와 동형의 **라이브 전용 진행 신호로 영속 대상이 아니다** — `NodeExecution.outputData` 는 위 표대로 turn 경계에서만 저장(single-write 불변)되고, 사용자 발화의 영속 정합은 turn 종료 `execution.ai_message` 스냅샷(`output.result.messages`)이 보장한다. (§7 rehydration 의 "WS 신규 이벤트 도입 안 함" 원칙은 재개 사실이 `node.*` 이벤트로 이미 관측 가능한 _관측-중복_ 이벤트(`resumed_after_restart`)를 특정 기각한 것이며, 본 라이브 진행 신호 — 수신 시점에 발화 내용을 싣는 이벤트가 기존에 부재 — 에는 적용되지 않는다.)

### 6.3 재실행/조회 정책 (Replay Policy)

저장된 실행 이력을 사용자가 다시 활용하는 시나리오의 정책. 의미가 다른 두 모드를 분리해 정의한다 — 한쪽은 외부 부수효과 0, 다른 쪽은 새 실행으로 부수효과 재트리거.

| 모드                  | 의미                                                                | 구현 상태                                                         | 외부 부수효과                                                                                                             | expression 평가                               |
| --------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **View**              | 실행 이력 조회 — `NodeExecution.outputData` 를 그대로 표시          | ✅ 구현됨 (execution-history UI)                                  | ❌ 없음                                                                                                                   | ❌ 없음                                       |
| **Re-run**            | 새 Execution 시작 — 현재 워크플로 정의의 raw config 를 다시 평가    | ✅ 정의됨 — 명세는 [`./13-replay-rerun.md`](./13-replay-rerun.md) | ✅ 재트리거 — 이메일 재발송, HTTP 재호출 등. dry-run 토글로 skip 가능 ([`./13-replay-rerun.md`](./13-replay-rerun.md) §7) | ✅ `$now` / `random()` 등 새 실행 시점 재고정 |
| **Multi-turn resume** | 같은 실행의 다음 turn 진행 — `state.rawConfig` frozen snapshot 사용 (frozen 범위 = **한 turn** — D3, §6.1 rawConfig snapshot 정책·§Rationale) | ✅ 구현됨 (§1.3 / `executions/:id/continue`)                      | 해당 노드 한정 (`processMultiTurnMessage`)                                                                                | 해당 노드 한정                                |

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

### 7.1 워커 크래시 복구 — BullMQ stalled-job (target)

> **구현 상태 — 두 트리거 (둘 다 구현: PR3 부팅 backstop / PR4 운영 중 stalled)**: 크래시한 active 세그먼트의 재개는 두 트리거로 나뉜다.
> - **(부팅 backstop 트리거 — PR3 구현, 2026-07-04)**: 서버 부팅 시 `recoverStuckExecutions()` 가 `status='running' AND started_at < now() - STUCK_RECOVERY_STALE_MS(30분)` 인 Execution 을 발견하면, **일괄 `failed` 마킹이 아니라** 각 row 를 **원자 re-claim**(`UPDATE … SET started_at=now() WHERE status='running' AND started_at < :threshold RETURNING`; affected=1 인 인스턴스만 소유) 한 뒤 **§7.5 rehydration case B 로 재구동**(rehydrate + 완료 노드 이후부터 `runNodeDispatchLoop` forward)한다. 이는 §7.2 point 3(재시작 resume)을 **일반 노드 대상으로 실제 구현**한 것이다. 분산 lock·WAITING_FOR_INPUT 제외 등 recovery 동작은 §7.4 Recovery 가 SoT. **PR4 이후에도 은퇴하지 않고 backstop 으로 유지** — stalled job 자체가 없는 케이스(전체 재시작·Redis 비영속·job 유실)를 담당.
> - **(mid-operation stalled 트리거 — PR4 구현, 2026-07-04)**: 아래 표의 BullMQ stalled-job 자동 재배달(운영 중 크래시를 다른 워커가 즉시 이어받음)을 구현했다 — `execution-run` 큐 `maxStalledCount: 1` / `stalledInterval: 30초`. 워커 크래시 = job stall → BullMQ 가 **같은 jobId 로 1회 자동 재배달** → 픽업 워커의 `runExecutionFromQueue` **RUNNING 분기**(`recordRunningSegmentStart` + `redriveStuckExecution`)가 §7.5 case B 로 재구동한다(멱등: 완료 노드 skip). 재배달을 소진하면 `onFailed → finalizeStalledExhausted` 가 `WORKER_HEARTBEAT_TIMEOUT` 로 마감. ([§Rationale "크래시/재시작 RUNNING 세그먼트 제어된 re-drive" / "PR4 — BullMQ stalled 자동 재배달"](#rationale).)

별도 heartbeat 채널(워커가 5초마다 emit + 중앙 검사 경로)을 **신설하지 않는다.** active 세그먼트가 이미 BullMQ job 으로 표현되므로 워커 크래시 = job stall 이고, BullMQ 내장 **stalled-job 검출**이 이를 다른 워커에 재배달한다(PR4 구현) → 그 워커가 §7.5 rehydration / §7.2 checkpoint 로 세그먼트를 재개한다. (별도 heartbeat 인프라와 BullMQ stalled 메커니즘은 기능 중복 — [§Rationale "§7.1 heartbeat → stalled-job 일원화"](#rationale).)

| 항목                     | 동작                                                                                                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 부팅 backstop 재개 (**PR3 구현**) | 부팅 시 `recoverStuckExecutions()` 가 stale RUNNING 을 원자 re-claim → §7.5 rehydration case B 재구동(일반 노드). 트리거는 부팅 1회 스캔. **PR4 이후에도 유지** — stalled job 이 없는 케이스 담당 |
| mid-operation 크래시 검출 (**PR4 구현**) | BullMQ stalled-job 검출(`stalledInterval` 30초) — **active 세그먼트 job(`execution-run`/`execution-continuation`) 한정**                                                                                                                  |
| 미응답 시 동작 (**PR4 구현**) | stalled job 을 **같은 jobId 로 1회 자동 재배달**(`maxStalledCount:1`) → 픽업 워커 `runExecutionFromQueue` RUNNING 분기 → §7.5 rehydration 세그먼트 재개                                                                                                                                           |
| `waiting_for_input`      | **대상 아님** — job 이 없으므로 stalled/재큐/만료에 절대 걸리지 않음. 무기한 park(§4.x/§7.4)                                                                                                                      |
| terminal (재구동 불가) | 재구동 자체 불가(checkpoint 부재/손상) → `RESUME_CHECKPOINT_MISSING`(§7.5). 재구동은 되나 반복 실패하는 poison 세그먼트 → 부팅 트리거는 부팅당 최대 1회(자연 rate-limit), 운영 중 stalled 트리거는 `maxStalledCount:1` 이라 재배달 1회 후 `WORKER_HEARTBEAT_TIMEOUT` 로 dead-letter. 누적 시 §8 active-running 한도 초과로 `EXECUTION_TIME_LIMIT_EXCEEDED`(best-effort 2차 — under-count 주의, §Rationale) |
| attempts 소진 (**PR4 구현**) | active 세그먼트가 stalled 재배달 attempts 를 모두 소진하면 `onFailed → finalizeStalledExhausted` 가 `status='running'` 조건부로 Execution `failed` + `error.code='WORKER_HEARTBEAT_TIMEOUT'` (기존 코드 **유지·PR4 재정의 발효**: "절대 30분 stale 일괄 fail" → "stalled 재배달 소진". 부팅 backstop re-drive 는 이 코드 미사용. §2.13 동기화) |

> **PR3 → PR4 관계**: `recoverStuckExecutions()` 의 절대시간(30분) 스캔은 PR3 에서 "일괄 fail" → "제어된 re-drive" 로 전환됐고, PR4 에서 운영 중 즉시 재배달(BullMQ stalled)이 추가됐다. **단 `recoverStuckExecutions` 은 은퇴하지 않고 부팅 backstop 으로 병존**한다 — stalled job 이 없는 케이스(전체 재시작·Redis 비영속·job 유실)는 stalled 재배달로 커버 불가하기 때문(§Rationale "PR4 — BullMQ stalled 자동 재배달"). 관측성은 execution-run DLQ 모니터로 도입(§7.2/§7.4 와 통합).

### 7.2 체크포인트 기반 Resume

```
1. 워크플로우 실행 중 각 노드 완료 시 체크포인트 저장 (append-only)
   - execution_node_log(노드 실행 순서) + 완료 NodeExecution.outputData(노드별 출력) + Execution 영속 컨텍스트(§6.2)
2. Worker 장애 발생 시 — mid-operation (active 세그먼트 한정, PR4 구현):
   a. BullMQ 가 stalled active 세그먼트 job(`execution-run`/`execution-continuation`)을 같은 jobId 로 자동 재배달 (§7.1, `maxStalledCount:1`)
   b. 새 Worker가 §7.5 rehydration 으로 세그먼트를 재개
   c. 이전 완료 노드는 재실행하지 않음 (체크포인트 기준)
3. 전체 Execution Engine 재시작 시 (PR3 — 구현, 2026-07-04):
   a. status='running' AND stale(>STUCK_RECOVERY_STALE_MS, 30분) 인 Execution 을 부팅 시 원자 re-claim (§7.1/§7.4)
   b. 각 Execution 을 §7.5 rehydration **case B** 로 재구동 (node-type 무관 — 일반화):
      - rehydrateContext 가 execution_node_log(같은 executionId 타임라인)로 _executedNodes Set + 완료 노드 outputData 를 복원
      - 도착 payload 없음(§7.5 case A waiting 재개와 구분) — turn 핸들러(dispatchResumeTurn)를 거치지 않고 runNodeDispatchLoop 를 마지막 완료 노드 이후부터 forward
   c. 완료 노드는 재실행하지 않음 (executedNodes 기준 — §7.3 멱등)
   d. 크래시 시점 아직 완료되지 않았던(RUNNING-at-crash) 노드는 재실행됨 — at-least-once (§7.3)
```

> **일반화 (PR3 핵심)**: point 3 재구동은 `ai_agent` 한정이 아니라 **임의 노드 타입**을 커버한다 — `rehydrateContext`/`runNodeDispatchLoop` 는 이미 node-type-generic 이다. waiting 노드 재개(§7.5 case A, `dispatchResumeTurn`)와 달리 도착 payload·turn 핸들러를 거치지 않고 곧장 그래프 forward 로 재구동한다. (waiting 노드 rehydration 의 node-type 일반화는 별개로 full B3 에서 이미 완료 — §Rationale.)
> point 2(mid-operation stalled 재배달)는 **PR4 구현 완료(2026-07-04)** — 같은 재구동 경로(§7.5 case B)를 운영 중 stalled 트리거로도 진입한다. §7.1 참조.

> WAITING_FOR_INPUT 의 재개는 §7.5 Resume after Restart 에 별도 정의한다. 본 절은 RUNNING active 세그먼트의 재개(부팅 backstop re-drive + PR4 mid-operation stalled 재배달)에 해당하며, `waiting_for_input` park 는 대상이 아니다(§4.x).

### 7.3 멱등성 보장

재개·재구동(§7.5 case A waiting / case B 크래시)에서 "동일 turn/세그먼트 이중 실행 0" 를 지탱하는 4중 계약:

- **jobId 멱등** (§7.4): active 세그먼트/continuation job 은 `jobId=executionId`(execution-run) / `executionId:nodeExecutionId:seq`(continuation) 로 BullMQ 가 중복 job 을 dedup.
- **재개 진입 원자 claim** (affected=1): waiting 재개는 `waiting_for_input → running`(`claimResumeEntry`), 재시작 크래시 re-drive(case B)는 `running → running` **`started_at` 조건부 re-claim** — 둘 다 affected=1 인 worker/인스턴스만 진행(§7.5). §1.3 `_retryState` "affected=1 인 쪽만 진행" 패턴의 일반화.
- **완료 노드 미재실행** (엔진 보장, exactly-once): 재개/재구동 시 `execution_node_log` + 완료 `NodeExecution.outputData` 로 복원한 `_executedNodes` 로 완료 노드를 skip — 재방문 금지(§7.2c). 추가로 dispatch 직전 대상 NodeExecution 이 이미 COMPLETED 면 skip(per-node DB status 재검증 — in-memory Set 과 중복 defense-in-depth).
- **RUNNING-at-crash 노드 = at-least-once**: 크래시 시점 아직 COMPLETED 아니던 노드는 재구동 시 **재실행**된다. 그 노드의 외부 side-effect(Integration write: send_email·HTTP POST 등) 발생 여부를 엔진은 알 수 없으므로 **exactly-once 를 보장하지 않는다** — 외부 API 호출 노드(Integration)의 멱등성은 기존 원칙대로 **노드 설정에서 관리**(idempotency key 등). 엔진은 "완료 노드 미재실행"까지만 보장한다. (분산 트랜잭션 없이 무손실 재개를 달성하는 본질적 trade-off — §Rationale.)
  - **orphan row 마감**: 재실행은 **새 NodeExecution row** 로 수행하므로, 크래시 시점의 옛 `NodeExecution(status=running)` row 는 case B re-drive 진입 시 terminal(`failed`)로 마감한다(`failOrphanRunningNodeExecutions` — 완료 노드는 COMPLETED 라 대상 아님). 옛 stale-fail 모델의 자식 RUNNING cascade 마감을 re-drive 진입 시점으로 옮겨 보존한 것 — 부모 Execution 종결 후 유령 `running` 노드가 타임라인/진행률 집계에 남지 않게 한다.

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

| 항목                     | 값                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BullMQ 큐 이름           | `execution-continuation` (`background-execution` 와 동일한 BullMQ infra 재사용)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 메시지 타입              | `continue` / `cancel` / `button_click` / `ai_message` / `ai_end_conversation` / `retry_last_turn` (`ContinuationType`, `continuation-bus.service.ts`). `retry_last_turn` 은 §1.3 / §1.2 의 AI Agent multi-turn 재진입(WS `execution.retry_last_turn`) 전용 — 대상 row 는 WAITING 이 아니라 spawn 된 RUNNING 이므로 WAITING_FOR_INPUT 사전검증을 거치지 않는다                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 메시지 스키마            | `{ type: ContinuationType, executionId: string, nodeExecutionId: string, payload?: unknown }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| jobId                    | `${executionId}:${nodeExecutionId}:${monotonic-seq}` (seq 는 Redis INCR per executionId — idempotency key)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 입력 receiver → enqueuer | controller / WS gateway 는 클라이언트 payload 의 `nodeId` 로 현재 `WAITING_FOR_INPUT` 상태의 NodeExecution row 를 DB lookup (`execution_id + node_id + status='waiting_for_input'`) 해 `nodeExecutionId` 를 채운 뒤 enqueue. 0건 또는 다중 row 이면 즉시 client 에 에러 (`INVALID_EXECUTION_STATE`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 재시도                   | `attempts: RESUME_BULLMQ_ATTEMPTS` (기본 3), exponential backoff (1s / 4s / 16s)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Dead-letter              | 모든 attempt 소진 시 Execution `cancelled` + `error.code='RESUME_FAILED'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 라우팅 원칙              | **모든 진입점은 항상 BullMQ enqueue**. (full B3 으로 in-process `pendingContinuations` Map 은 제거됐으므로 같은-인스턴스 local resolve 분기 자체가 더 이상 존재하지 않는다.) 옛 pub/sub 시대의 "항상 publish — 직접 dispatch 분기는 race window" 원칙을 BullMQ 로 그대로 계승. local resolve 의 microsecond 절약은 운영 단순성·디버깅 가능성보다 가치가 낮다 — worker 는 어떤 인스턴스에서 pick up 하든 §7.5 rehydration 으로 재개한다 (Worker 동작 cell)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Worker 동작              | 임의 인스턴스가 job 을 pick up → **항상 §7.5 rehydration 경로**로 재개한다. park 시 코루틴을 즉시 해제하므로(§4.x — Phase B, full B3 완료) in-process resolver 가 일절 존재하지 않는다 — worker 는 `runExecution` 을 직접 await 하며(park=세그먼트 종료), 배리어(`firstSegmentBarriers`)도 `pendingContinuations` Map 도 없고 재개 경로는 slow-path(rehydration)로 일원화된다. (이는 §7.4 라우팅 원칙 "항상 BullMQ enqueue"(publisher-side)의 worker-side 대칭 완성이다.) **취소 경로**: in-memory 코루틴이 없으므로 park 취소 시 `ContinuationExecutionProcessor` 가 `await applyCancellation(executionId)` 를 호출하며, 이 안에서 `cancelParkedExecution` 이 Execution + 동반 WAITING NodeExecution 을 직접 CANCELLED 로 마킹한다 (DB-level terminal, coroutine 없이 동일 종착점 달성). |
| Worker 동시성            | `CONTINUATION_WORKER_CONCURRENCY` (기본 1 — 인스턴스당 직렬). 대량 동시 resume 의 setup (rehydration / 그래프 빌드) 직렬화 latency 가 관측되면 상향. 재개 진입이 §7.5 의 DB 원자 claim 으로 gate 되므로 **concurrency 상향·멀티 인스턴스에서도 "동일 turn 이중 실행 0" 불변식이 유지된다** — 이 기본값은 성능 파라미터이지 정합성 전제가 아니다. 비양수·비정수·비숫자 입력은 1 로 fallback, 변경은 인스턴스 재시작 시 반영 (§11)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

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
            ↓
   §7.5 rehydration (단일 경로 — Phase B)
            ↓
   rehydrate → turn 핸들러 직접 호출 (process{Form,Button,Ai}ResumeTurn)
```

- `continueExecution` / `cancelWaitingExecution` / `continueButtonClick` / `continueAiConversation` / `endAiConversation` 모두 동일 패턴.
- **publish 실패 동기 surface**: 위 진입점은 publish 결과(`ContinuationPublishResult` — `queued:false` ↔ `jobId:null`)를 caller 에 반환한다. 4종 WS continuation 핸들러(§7.5.2)는 `queued:false` 를 ack 로 표면하고, **REST `POST /executions/:id/stop` 의 WAITING cancel 분기**(WS ack 아님)는 `queued:false` 시 **503 `EXECUTION_ENQUEUE_FAILED`** 로 surface 해 클라이언트 재시도를 유도한다 — `SERVER_SHUTTING_DOWN` 503 선례(upstream 의존성 장애 → 503 + 재시도, §11)와 동형이다. 성공(`queued:true`) 시 즉시 re-fetch 는 아직 PENDING/RUNNING 일 수 있고 최종 cancel 은 후행 `execution.cancelled` 이벤트로 확인한다(§Rationale "continuation publish 실패 동기 surface 통일").
- "No pending continuation" 즉시 throw 는 단일 인스턴스에서 정확히 판단 불가하므로 폐기된다 (옛 pub/sub 시대 원칙 유지) — 키 없음은 §7.5 rehydration 경로로 자연 해소.
- WAITING_FOR_INPUT 상태의 사전 검증 (controller / WS gateway) 은 publisher 측 책임.

**Recovery (`recoverStuckExecutions`)**

다중 인스턴스에서 신규 기동한 인스턴스가 다른 인스턴스에서 정상 처리 중인 작업을 잘못 건드리지 않도록 보수적 가드. **PR3(2026-07-04)부터 stale RUNNING 을 일괄 `failed` 마킹이 아니라 §7.5 case B rehydration 으로 재구동**한다(재시작 크래시 resume, §7.1/§7.2 point 3).

- **분산 lock**: `redis SET 'exec:recover:lock' <hostname:uuid-token> EX 60 NX` — 60초 TTL. 획득 실패 시 본 인스턴스는 skip. 컨테이너에서 PID 가 충돌해도 `hostname + UUID` 로 owner 식별 보장. **전역 boot-lock 은 유지**되며(동시 스캔 시작 방지), 아래 row 단위 `started_at` 조건부 re-claim 은 그 안의 defense-in-depth(늦은 부팅 스캔·lock 만료 경합 등으로 스캔이 겹쳐도 개별 row 이중 재구동 방지) — 두 메커니즘은 계층이 달라 공존한다.
- **명시적 release**: 작업 종료 시 owner 검증 Lua script 로 lock 을 즉시 해제 — TTL 만료 대기 없이 다음 인스턴스가 처리 가능. owner 가 다르면 (이미 expire 후 다른 인스턴스가 잡은 lock) 절대 삭제하지 않는다.
- **Stale 대상 한정**: `status='running'` 인 row 만 stuck recovery 대상. **`status='waiting_for_input'` 은 무기한 보존** — 사용자 입력은 며칠 후 도착할 수도 있고, 노드별 `formConfig.timeout` 등 워크플로우 정의된 별도 timeout 이 적용된다. 임계값 (`STUCK_RECOVERY_STALE_MS`, 현재 30분) 은 RUNNING 의 stale 검출에만 사용한다. (주의: 현 구현은 이 임계를 **절대 시간**(`started_at < now() - 30분`)으로 적용하며 §7.1 의 주기적 heartbeat 검출은 미구현 — §7.1 구현 상태 banner 참조. heartbeat 기반으로의 전환은 Planned.)
- **WAITING_FOR_INPUT 의 운명**: 부팅 시점에 `WAITING_FOR_INPUT` 인 Execution 은 본 함수에서 **무시**. 사용자 입력이 도착하면 §7.5 의 rehydration 경로로 자연스럽게 재개된다. 옛 동작 (WAITING_FOR_INPUT 일괄 FAIL) 의 운영 회귀는 §Rationale "Durable Continuation" 참조.

### 7.5 Resume after Restart (rehydration)

rehydration 은 **두 진입 트리거**를 갖는다. 공통 기반(`rehydrateContext` 로 DB 에서 컨텍스트 무손실 복원 + affected=1 원자 claim + `runNodeDispatchLoop` forward)은 동일하고, 트리거·payload 유무만 다르다.

- **case A — waiting 노드 재개 (기존)**: `WAITING_FOR_INPUT` 상태에서 인스턴스가 종료된 뒤 **사용자 입력이 도착**하면, BullMQ 가 임의의 인스턴스에 continuation job 을 deliver → `waiting_for_input → running` 원자 claim(`claimResumeEntry`) → rehydrate → 도착 payload 를 `dispatchResumeTurn`(form/button/ai turn 핸들러)으로 처리 → forward. 아래 코드 블록이 이 절차다.
- **case B — 크래시/재시작 RUNNING 세그먼트 re-drive (PR3 부팅 backstop, 2026-07-04 / PR4 운영 중 stalled)**: 도착 payload·waiting 노드 **없음**. 두 트리거가 동일 재구동 로직으로 진입한다 — (i) **부팅 backstop**: `recoverStuckExecutions`(§7.1/§7.4)가 stale RUNNING 을 `running → running` `started_at` 조건부 re-claim(affected=1); (ii) **운영 중 stalled 재배달(PR4)**: BullMQ 가 같은 jobId 로 재배달한 job 을 `runExecutionFromQueue` 가 받아 `status==='running'` 을 감지하면 `recordRunningSegmentStart` + `redriveStuckExecution` 로 진입. 이후 공통: rehydrate(`rehydrateContext`) → **turn 핸들러(dispatchResumeTurn)를 우회**, `runNodeDispatchLoop` 를 마지막 완료 노드 이후부터 forward. 재구동 도중 새 blocking 노드 도달 시 정상 park(§4.x)로 세그먼트 종료. 임의 노드 타입 커버(§7.2 일반화).

아래 절차는 **case A** 기준이며(사용자 입력 도착), case B 는 "도착 payload 로 turn 핸들러 호출" 단계만 "turn 핸들러 우회 + forward" 로 대체하고 나머지(claim·rehydrate·routing 재등록·forward)를 공유한다.

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
            ↓
  rehydrate (단일 경로 — Phase B: park 시 코루틴 해제로
  in-process resolver 부재, 모든 재개가 rehydration)
       ├─ 재개 진입 원자 claim (waiting_for_input → running 조건부 UPDATE;
       │   affected=0 → ack-and-discard — "Rehydration 멱등성")
       ├─ outbound routing context 재등록 (triggerId && workflowId 있는 경우)
       │   · 영속된 execution row 의 triggerId / workflowId / input_data.chatChannel
       │     서브 필드(§6.2 영속 항목)로 outbound routing context 를 재등록
       │     (execute() 진입 시 최초 등록과 동일 형태 — CCH-AD-05).
       │   · best-effort: 등록 실패 시 warn 로그만 남기고 rehydration 은 계속.
       │   · terminal event emit 시 자동 release (기존 동작).
       ├─ NodeExecution.outputData 에서 rawConfig snapshot /
       │   _resumeCheckpoint (multi-turn) 로드
       ├─ Execution.conversation_thread 컬럼에서 conversationThread
       │   스냅샷 무손실 복원 (§6.2 park commit, conversation-thread §4/§8.4)
       ├─ Execution.user_variables 컬럼에서 사용자 정의 variables 복원
       │   (시스템 __* 제외분 — §6.2 park commit, §6.1)
       ├─ ExecutionContext 재구성 — **항상 DB 에서 복원**한다 (park=세그먼트 종료로
       │   in-memory context 는 이미 소멸; Redis context store 없음). 같은 인스턴스가
       │   우연히 context 를 아직 들고 있으면(`getContext` hit) 재사용하나 이는 최적화일
       │   뿐 정합성 전제 아님 — thread/variables 는 위 컬럼에서, 완료 노드 출력은
       │   execution_node_log + NodeExecution.outputData 에서 복원
       ├─ `driveResumeAwaited`(top-level, awaited)/`driveCallStackResume`(중첩)가
       │   도착한 입력 payload 로 해당 노드의 turn 핸들러를 호출 — form/buttons/ai
       │   분기는 `dispatchResumeTurn`(ordered `resumeTurnRegistry`,
       │   `resume-turn-dispatch.ts`) 단일 진입점으로 라우팅된다 (#507 추출,
       │   first-match-wins: form → `processFormResumeTurn`, button →
       │   `processButtonResumeTurn`, AI → `handleAiResumeTurn` 경유
       │   `processAiResumeTurn`) — in-memory resolver 등록·replay 없이 직접 구동
       └─ 이후 그래프 순회를 평소대로 진행 (`runNodeDispatchLoop` forward)
```

case 2 의 rehydration 경로는 §7.4 의 기존 원칙 "키 없음 → 즉시 throw 폐기" 의 자연스러운 확장이다. 옛 pub/sub 시대에는 "다른 인스턴스의 Map 에 있을 수도 있으니 silent skip" 했지만, BullMQ 로 영속화한 본 시대에는 "키 없음 = DB 에서 재구성" 으로 의미가 강화되어 §7.5 rehydration 경로가 된다.

**중첩 sub-workflow 재개 — `resume_call_stack` frame-by-frame 재진입 (exec-park D6 — 구현 완료, PR-B2b 2026-06-06)**

> **레이블 주의**: 본 절의 `exec-park D6` 는 `exec-park-durable-resume` plan 의 결정 D6(중첩 call stack 영속)이며, AI 노드 spec(`1-ai-agent.md` 등)의 동명 `D6`(AI 노드 output 경로 단일화)와 **무관**하다.
>
> **구현 상태(2026-06-06, PR-B2b)**: 본 절차는 구현 완료다. V087 컬럼·타입·`CALL_STACK_SCHEMA_VERSION`, park 시 call-stack stage(`executeInline` park-release + `_callStack` 영속), 아래 frame-by-frame 재진입 로직(`driveCallStackResume`/`driveResumeFrame`)이 모두 반영됐다.

park 한 노드가 중첩 sub-workflow(`executeInline`) 안에 있으면 (`Execution.resume_call_stack IS NOT NULL`), 위 단일-레벨 재진입(`waitForX` 직접 invoke) 대신 `driveCallStackResume` 이 다음을 수행한다 (exec-park D6 — 호출 체인 영속은 §6.2 park commit (e), 컬럼은 V087):

1. **버전 가드**: `resume_call_stack.version` 이 `CALL_STACK_SCHEMA_VERSION` 초과면 `RESUME_INCOMPATIBLE_STATE` 로 안전 종결 (롤링 배포 중 구 인스턴스가 신 포맷 pickup 방어 — `_resumeCheckpoint` 와 동일 패턴, checkpoint 와 **독립 상수**).
2. **frame-by-frame 재진입 (innermost-first + bubble-up)**: `executeInline` 을 재호출하지 않고 `driveCallStackResume` 이 `frames` 를 직접 구동한다.
   - **a. 최내(innermost) frame**: waiting 노드의 turn 을 처리한다 — top-level 과 동일하게 `dispatchResumeTurn`(ordered `resumeTurnRegistry`) 단일 진입점으로 라우팅 (form → `processFormResumeTurn`, button → `processButtonResumeTurn`, AI → `handleAiResumeTurn` 경유 `processAiResumeTurn`). 이어 `driveResumeFrame` 이 그 frame 의 나머지 그래프를 `runNodeDispatchLoop` 로 forward 한다.
   - **b. 외곽 frame (bubble-up)**: 최내 frame 이 완료되면 그 sub-workflow 출력을 부모 frame 의 invoker(Workflow) 노드 출력으로 `injectInvokerOutput` 주입하고, `driveResumeFrame` 으로 부모 frame 의 나머지를 forward 한다. `i = frames.length-2` 부터 `i=0` 까지 반복.
   - **c. top-level forward**: 모든 frame 이 완료되면 `frames[0].invokerNodeId` 노드 출력을 주입하고 top-level 그래프의 나머지를 forward 한 뒤 Execution 을 COMPLETED 로 마감한다.
   - forward 도중 새 blocking 노드가 fresh park 하면 `executeInline` 이 `ParkReleaseSignal` 을 throw 하고 `runNodeDispatchLoop` 가 `{parked:true}` 로 흡수해 세그먼트가 종료된다 (Execution WAITING 유지, 새 call-stack 재영속). 다음 continuation 이 같은 절차로 재개한다.
   - **completed-node seed**: 각 frame 의 이미 완료된 노드 집합(`executedNodes`)은 별도 `execution_node_log` seed 가 아니라 `rehydrateContext` 가 복원한 in-memory `context._executedNodes` 를 재사용한다 — `rehydrateContext` 단계에서 `execution_node_log`(같은 executionId 타임라인)로부터 이 Set 을 복원하므로 기능적으로 동등하며, 완료 노드는 **미재실행**(§7.2 멱등 — 완료 노드 재방문 금지, jobId 멱등 §7.3 과 합산)이다.

**선형 스택 불변식**: 컨테이너(Loop/ForEach/Map/Parallel) body 의 blocking 은 §3.2 로 금지되므로 `frames` 는 항상 **선형**(분기·iteration 상태 없음)이다 — 깊이는 `recursionDepth` cap 이내. `resume_call_stack IS NULL`(top-level park / park 한 적 없음 / 배포 이전 row)이면 위 기본 단일-레벨 절차로 재개한다(회귀 없음).

**Rehydration 멱등성**

- BullMQ jobId 가 idempotency key — 동일 jobId 의 중복 처리는 BullMQ 가 차단.
- 추가로 worker 는 처리 전 재개 진입을 **DB-level 원자 claim** 으로 획득한다: 대상 row 를 `waiting_for_input` 조건으로 `running` 전이시키는 단일 UPDATE(`… WHERE status='waiting_for_input' RETURNING`)를 실행해 **affected=1** 인 worker 만 재개를 진행하고, **affected=0**(다른 worker 가 이미 획득했거나 완료)이면 즉시 **ack-and-discard**. 이 원자 claim 이 BullMQ 멱등성(jobId)을 보완해 **정상-경로 race 까지 기계적으로 닫는다** — 비원자 SELECT 재검증과 달리 check-then-act 창이 없어 멀티 인스턴스(인스턴스당 concurrency=1 이어도 인스턴스 간 병렬)·§7.4 concurrency 상향 양쪽에서 "동일 turn 이중 실행 0" 불변식을 보장한다. claim 의 `waiting_for_input → running` 전이는 §1.1 원자성 보장에 따라 짝 상태(Execution ↔ NodeExecution)를 **단일 트랜잭션**으로 갱신한다. claim 획득 **후** 의 두 실패 경로는 구분된다:
  - **rehydration 프로세스 실패**(checkpoint 부재/손상·attempts 소진 등) → 아래 "Rehydration 실패 케이스" 의 `RESUME_*` terminal(Execution `cancelled` + NodeExecution `failed`).
  - **turn 처리 실패**(재개 turn 의 LLM throw 429/timeout/connection) → NodeExecution `running → failed`(§1.2) — claim 으로 이미 `running` 이므로 §Rationale "재개 race … 부분 수정" 대로 direct `WFI → failed` 가 아니라 `running → failed` 로 finalize.
  두 경로 모두 `running` 잔류를 남기지 않는다. claim 후 worker 크래시로 예외적으로 남은 `running` row 는 §7.4 `recoverStuckExecutions`(RUNNING 대상)가 회수한다(정상 흐름에선 claim 직후 rehydration 이 이어지므로 30분 stale 창 노출은 비정상 케이스 한정). 본 claim 은 §1.3 `_retryState` "affected=1 인 쪽만 진행" 패턴의 일반화다.
- **case B(크래시 re-drive) 원자 re-claim**: 위 claim 은 waiting 재개(case A, `waiting_for_input → running`)를 가정한다. 재시작 크래시 re-drive(case B)는 대상이 이미 `running` 이므로 `recoverStuckExecutions` 가 **`running → running` `started_at` 조건부 re-claim**(`UPDATE … SET started_at=now() WHERE status='running' AND started_at < :threshold RETURNING`)으로 소유권을 획득한다 — 두 인스턴스(예: 늦은 부팅 스캔이 전역 lock 만료와 겹침)가 같은 stale row 를 동시에 잡아도 affected=1 인 쪽만 재구동한다. 상태 enum 변화가 아니라 소유권 이전(started_at 갱신)이므로 §1.1 전이표 무변경. claim 후 재구동 실패는 case A 와 동일하게 `RESUME_*` terminal 원자 마감(**claim 후 `running` 잔류 금지**). ⚠️ **잔여 race(PR4 로 대폭 완화)**: PR4 로 BullMQ stalled 재배달이 켜졌다(§7.1, `maxStalledCount:1`) — 정상 크래시는 lock 만료 기반 재배달로 fencing 되나, 원 워커가 lock 만료 후 부활하는 zombie(hang/네트워크 단절 후 부활)는 완전히 배제되지 않아 stale 판정으로 두 세그먼트가 동시 구동될 수 있다. 이는 §4.2 직렬화 불변식이 예고한 재검증 대상이며, backstop boot 트리거·30분 stale·`maxStalledCount:1`(운영 중 무한 재배달 없음)·per-node COMPLETED skip 로 blast radius 를 bound 한다(현행 fail-path 도 동일 zombie 노출이라 신규 회귀 아님 — §Rationale).
- BullMQ `removeOnComplete: true` + `removeOnFail: false` + `attempts: RESUME_BULLMQ_ATTEMPTS` (기본 3) 로 두며, 모든 attempt 가 실패하면 dead-letter (Execution 을 `cancelled` 로 마킹 + `error.code='RESUME_FAILED'`). `removeOnFail: false` 로 실패 job 을 보존하므로 dead-letter depth 를 §9.3 "Dead-letter 모니터링" 이 관측할 수 있다.

**Rehydration 실패 케이스**

> 재개 진입 원자 claim(위 "Rehydration 멱등성") **획득 후** 아래 프로세스 실패가 발생하면, claim 으로 `running` 이 된 상태를 그대로 두지 않고 반드시 `RESUME_*` terminal(Execution `cancelled` + NodeExecution `failed`)로 원자 마감한다 — **claim 후 `running` 잔류 금지**(누락 시 stuck RUNNING). (turn 처리 자체의 LLM throw 는 별개로 `running → failed` finalize — "Rehydration 멱등성" 참조.)

| 케이스                                                                                                                                                                                                                                                                                   | 처리                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NodeExecution.outputData` 가 부재 또는 손상                                                                                                                                                                                                                                             | Execution `cancelled` + `error.code='RESUME_CHECKPOINT_MISSING'`, 동반 NodeExecution `failed`                                                                                                                                                                                                                                                                                       |
| BullMQ attempts 소진                                                                                                                                                                                                                                                                     | Execution `cancelled` + `error.code='RESUME_FAILED'`, 동반 NodeExecution `failed`                                                                                                                                                                                                                                                                                                   |
| Multi-turn AI 노드의 `_resumeCheckpoint` 가 **부재**(이 기능 배포 이전 진입한 waiting row)·**손상**(schema drift 로 `buildRetryReentryState` 재구성 실패)·**미래 버전**(`schemaVersion` 이 현재 코드 `CHECKPOINT_SCHEMA_VERSION` 초과 — 롤링 배포 중 구 인스턴스가 신 포맷 pickup, §1.3) | Execution `cancelled` + `error.code='RESUME_INCOMPATIBLE_STATE'`, 동반 NodeExecution `failed`. 채널 어댑터는 이를 raw 에러가 아닌 **graceful "대화 세션 만료 — 새로 시작" 안내**로 사용자에게 표시하고, 사용자의 다음 메시지는 새 대화로 시작한다 (텔레그램 등). **정상 경로** — `_resumeCheckpoint` 가 존재하고 버전이 호환되면 재구성 성공으로 재개되며 본 에러는 발생하지 않는다 |

이 셋 모두 worker 측 **비동기**(post-enqueue) 실패이므로 동기 ack 가 아니라 후행 `execution.cancelled` 이벤트(`error.code = RESUME_*`)로 사용자에게 통지된다 — [Spec WebSocket §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) 의 동기 ack 는 publisher 측 사전 검증(§7.5.1 `INVALID_EXECUTION_STATE`)만 담으며 `resumed`/`queued` 는 enqueue 수락 신호다. 이 직교 분류는 §7.5.1("`RESUME_*` 는 후행 `execution.cancelled` 이벤트") 과 일치한다 (§Rationale "`RESUME_*` 동기 ack 노출 폐기").

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

| 케이스                                  | 응답 코드 (WS ack)                        | 원인                                                                                       |
| --------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| 매칭 row 0건                            | `INVALID_EXECUTION_STATE`                 | Execution 이 다른 상태(`running` / `completed` / `cancelled` / `failed`)거나 nodeId 미일치 |
| 동일 매칭 row 2건 이상 (invariant 위반) | `INVALID_EXECUTION_STATE` + `logger.warn` | 일반적으로 발생 불가. race 또는 데이터 손상 의심                                           |

`INVALID_EXECUTION_STATE` 는 동일 의미를 표현하는 **두 layer 의 코드** 중 WS 쪽 — REST 진입점은 422 `INVALID_STATE` ([Spec 에러 처리 §3-error-handling.md](./3-error-handling.md)) 를 반환한다 (의도적 분리: WS ack 와 REST 422 의 routing 분기가 클라이언트에서 동일 코드를 다르게 처리해야 하는 혼동을 회피).

본 코드는 `waiting_for_input` 진입점 외에도 [`execution.retry_last_turn`](./6-websocket-protocol.md#42-실행-제어-명령-client--server) (`failed` 상태가 기대) 같은 다른 commands 에서도 "기대 상태가 아님" 의 범용 표현으로 재사용된다.

본 분류는 [§7.5 rehydration](#75-resume-after-restart-rehydration) 의 `RESUME_*` (worker 측 비동기 실패) 와 직교 — `INVALID_EXECUTION_STATE` 는 ack 동기 응답, `RESUME_*` 는 후행 `execution.cancelled` 이벤트.

> `resolveWaitingNodeExecutionId` 는 invalid lookup (0건 / 다중 row) 시 `InvalidExecutionStateError` 를 throw 하며, publisher 진입점이 이를 동기 surface 한다 — WS gateway 4개 handler 는 ack `errorCode='INVALID_EXECUTION_STATE'`, REST `POST :id/continue` 는 422 `INVALID_STATE`, EIA 외부 진입점(`interaction.service`)은 409 `STATE_MISMATCH`. DB lookup 자체의 infra 실패는 `INVALID_EXECUTION_STATE` 가 아닌 원본 에러로 전파(재시도 가능). `__no_node_exec__` sentinel 은 cancel 류(nodeExecutionId 부재) 및 deploy 전 enqueue 된 legacy job 호환을 위해 worker 측에만 잔존.

### 7.5.2 Continuation ack 에러 표면 — typed `ExecutionError` 와 내부 메시지 누출 차단

§7.4 의 4종 continuation 핸들러(`execution.submit_form` / `click_button` / `submit_message` / `end_conversation`)는 publish 경로에서 throw 된 에러를 공통 ack 빌더로 변환한다. 변환은 에러 타입에 따라 둘로 갈리며 **client-safe 표면과 내부 진단 정보를 분리**한다.

- **typed `ExecutionError`** — execution-engine 의 client 경계 에러는 `ExecutionError` 추상 기반(`{ code, message, serverDetail? }`)을 따른다. `code` 는 중앙 `ErrorCode` enum 값(또는 prefix 없는 안정 시스템 코드), `message` 는 **고정 client-safe 영문 문자열**, `serverDetail` 은 **서버 로그 전용** 진단 상세(client 미노출)다. ack 는 `{ success:false, error: <message>, errorCode: <code> }` 로 표면한다 — `InvalidExecutionStateError`(§7.5.1)·`RetryLastTurnError`(§4.2 retry)·`ExecutionTimeLimitError`(§8)·`FormValidationError`(`submit_form` field 검증, code `VALIDATION_ERROR`, [EIA §R13](./14-external-interaction-api.md#r13-ws-평면-ack-에러-코드--eia-rest-에러-코드-매핑-원칙))가 이 계약의 선례이며 점진적으로 `ExecutionError` 기반으로 흡수한다(code 값·동작 보존).
- **비-typed(plain) `Error` / unknown** — 위 계약을 따르지 않는 임의 에러(DB 드라이버 예외·서드파티 오류 원문·내부 식별자를 담을 수 있음)는 **내부 `error.message` 를 client 에 전달하지 않는다**. ack 는 호출부가 지정한 고정 generic 문자열 + `errorCode: 'EXECUTION_INTERNAL_ERROR'` 로 표면하고, 원본 `error.message`/stack 은 **서버 로그**(`logger.warn`)에만 기록한다. — 이것이 본 정책의 **보안 게이트**: 스택 힌트·DB/3rd-party 오류 원문·내부 식별자의 client 누출 차단.

| 에러 표면 | client ack `error` | client ack `errorCode` | 서버 로그 |
| --- | --- | --- | --- |
| `ExecutionError` (typed) | `error.message` (고정 client-safe) | `error.code` | `serverDetail` (존재 시) |
| plain `Error` / unknown | 고정 generic fallback (호출부 지정) | `EXECUTION_INTERNAL_ERROR` | 원본 `message` + stack |

신규 client-safe 코드는 신규 prefix 를 만들지 않고 중앙 `ErrorCode` enum 의 기존 `EXECUTION_*` 네임스페이스를 확장한다 (예: `EXECUTION_INTERNAL_ERROR` generic fallback, `EXECUTION_MESSAGE_TOO_LONG` — `submit_message` 의 `message` 가 최대 **10000자**(`ExecutionEngineService.MAX_MESSAGE_LENGTH = 10_000`) 초과. 내부 길이 수치는 client 미노출·서버 로그(`serverDetail`)에만 기록). `INVALID_EXECUTION_STATE`(prefix 없는 시스템 레벨 코드)·worker 측 `RESUME_*`·retry `RETRY_*` 는 안정성 정책상 기존 이름을 유지한다([conventions/error-codes.md](../conventions/error-codes.md)).

frontend 는 backend 의 안정 code 를 `code → i18n key` 맵으로 표시하며(`integration-error-codes` 선례), 미매핑 code 는 generic fallback 으로 graceful 처리한다 — backend 는 i18n 레이어를 두지 않는다. 본 정책의 WS ack 표면은 [§6-websocket-protocol §4.2 continuation 에러 코드 표](./6-websocket-protocol.md#42-실행-제어-명령-client--server)와 정합한다.

> **EIA(REST) 진입점 매핑**: 동일 `MessageTooLongError` 가 EIA `submit_message`(`interaction.service`)에서 발생하면 `400 Bad Request` + `MESSAGE_TOO_LONG` 으로 매핑한다 (publisher 측 동기 검증, [§14 EIA §5.1 에러 표](./14-external-interaction-api.md#51-인터랙션-명령-제출--post-apiexternalexecutionsexecutionidinteract)). `InvalidExecutionStateError`→`STATE_MISMATCH`(409, §7.5.1)와 동형의 EIA 진입점 매핑이며, WS 평면 ack `EXECUTION_MESSAGE_TOO_LONG` 와 같은 의미를 REST layer 코드로 표기한다. 내부 길이 수치는 응답 미노출(고정 메시지만) — 누출 차단 원칙 동일.

> worker 측 비동기 실패(`RESUME_*`, §7.5.1)는 본 동기 ack 변환 경로 밖이다 — 후행 `execution.cancelled` 이벤트로 통지되며, 동일 누출 차단 원칙(내부 message 미노출, code 만)은 그 이벤트 빌더에도 적용된다(별도 경로라 본 변경 범위 밖, 후속 점검 항목).

---

## 8. 동시 실행 제한

> **구현 상태**: **단일 Execution active-running 누적 타임아웃은 PR2a 구현 완료**(`impl-exec-concurrency-cap`). **워크스페이스/워크플로우 동시 실행 cap + 큐 대기 5분 cancel 은 PR2b 구현 완료**(settings 키·advisory-lock admission gate·`queued_at`·`EXECUTION_QUEUE_WAIT_TIMEOUT`·workspace settings write API — 본 절 + §2.13 + §3-error-handling §1.5). priority 3-tier 도 **구현 완료(2026-07-04, triggerType threading, §4.3)**. 단일 Execution 최대 노드 수(500)만 여전히 **Planned**. 잔여 후속: `plan/in-progress/exec-intake-followups.md`.

| 제한 항목                        | 기본값 | 설정 위치                                                                                                                                      | 비고                                                                                                          |
| -------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 워크스페이스당 동시 Execution 수 | 10     | `Workspace.settings.maxConcurrentExecutions` (Admin+ — `PATCH /api/workspaces/:id/settings`, [§2.2](../1-data-model.md#22-workspace))          | intake 큐 + admission gate 카운트 (PR2b)                                                                      |
| 워크플로우당 동시 Execution 수   | 3      | `Workflow.settings.maxConcurrentExecutions` (Editor+ — `PATCH /api/workflows/:id`, [§2.4](../1-data-model.md#24-workflow))                     | intake 큐 + admission gate 카운트 (PR2b)                                                                      |
| 단일 Execution 최대 노드 수      | 500    | 시스템 설정                                                                                                                                    |                                                                                                               |
| 단일 Execution 최대 실행 시간    | 30분   | **(1단계 PR2a)** 시스템 env `EXECUTION_MAX_ACTIVE_RUNNING_MS`(기본 `1800000`ms; `0`=무제한). **(2단계 후속)** per-workflow `Workflow.settings` | **active-running 누적 시간 기준** (wall-clock 아님, `waiting_for_input` 대기 제외). **1단계 구현 완료(PR2a)** |
| 노드별 기본 타임아웃             | 30초   | Node.config                                                                                                                                    |                                                                                                               |

> **타임아웃 기준 — active-running 누적**: "최대 실행 시간" 은 wall-clock 이 아니라 **active 세그먼트들의 누적 시간**으로 측정한다. `waiting_for_input` park 동안 흐른 시간은 제외한다 — 사용자 입력을 며칠 기다리는 정상 워크플로를 timeout 으로 죽이면 안 되기 때문이다([§Rationale "타임아웃을 active-running 누적 기준으로"](#rationale)). 설계상 active 세그먼트 job 은 active 구간에만 존재하므로(park 중 job 부재), 세그먼트 job 타임아웃 = 그 세그먼트의 active 시간이며, 누적은 세그먼트 active 시간들의 합으로 추적한다.

**제한 초과 시 동작:**

- 워크스페이스/워크플로우 cap 초과 → 새 Execution 은 `pending` 상태로 intake 큐 대기 → intake consumer(`runExecutionFromQueue`)가 **첫 세그먼트 시작(PENDING→RUNNING) 직전 원자적 admission gate** 로 `COUNT(status='running')` 를 workspace·workflow **양쪽** 검증하고 **둘 다 cap 미만일 때만** RUNNING 진입, 아니면 pending 유지 + delayed 재큐(백오프) — **PR2b 구현 완료**. (admission gate 는 **PENDING→RUNNING 최초 진입에만** 적용한다. stalled 재배달 RUNNING arm(§7.1)·park 재개(§7.5)는 이미 RUNNING/재진입이라 cap 재심사하지 않는다 — §4.2 `jobId=executionId` dedup 직렬화 불변식으로 동일 Execution 동시 active 세그먼트가 불가능하므로 이중 카운트 없음.)
- 누적 active-running 시간이 **한도 이상**(`activeNow >= maxActiveRunningMs`, 경계값 포함 — [§Rationale](#rationale) 참조) → **`EXECUTION_TIME_LIMIT_EXCEEDED`** 에러 → Execution.status = `failed` (엔진 레벨 누적 타임아웃 전용 코드. Code 노드 스크립트 타임아웃 `EXECUTION_TIMEOUT` 과 의미가 달라 코드 분리 — [§3-error-handling §1.4](./3-error-handling.md#14-워크플로우-실행-에러)) — **PR2a 구현 완료**
- 큐 대기(`now - queued_at`, [§2.13](../1-data-model.md#213-execution)) 시간이 기본 5분(시스템 env `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`, 기본 `300000`ms) 초과 → Execution.status = `cancelled` + `error.code='EXECUTION_QUEUE_WAIT_TIMEOUT'` (시스템 취소 — `cancelledBy='timeout'`, `execution.cancelled` 이벤트를 §7.5 rehydration-실패 cancel 과 동일 경로로 emit, [§3-error-handling §1.5](./3-error-handling.md#15-ws-commands-에러-코드-도메인-spec-참조) / [WS Protocol §4.1](./6-websocket-protocol.md#41-실행-이벤트-server--client)) — **PR2b 구현 완료**
  - **트리거 = admission 시점 검사(별도 스캐너 없음)**: consumer(`runExecutionFromQueue`)가 job 을 pick up 할 때 admission gate 이전에 `now - queued_at` 을 확인해 초과 시 재큐 대신 `cancelled` 로 마감한다. cap 초과로 delayed 재큐된 job 은 재시도 tick 마다 다시 pick up 되어 재검사되므로 대기 초과가 반드시 포착된다. **job 자체가 소실된 orphan `pending`(예: Redis 비영속) 회수는 후속** — `recoverStuckExecutions`(§7.4)는 stale `running` 만 스캔하며 `pending` 스캔 확장은 본 PR 스코프 아님(낮은 확률 엣지, best-effort).

> **admission gate 원자성(TOCTOU)**: 다수 consumer 가 동시에 같은 cap 슬롯을 두고 경쟁하므로 "카운트 → 비교 → 전이" 가 원자적이어야 한다(순진한 read-then-act 는 cap 초과 허용). 구현은 **per-workspace pg advisory lock(`pg_advisory_xact_lock`)으로 admission 을 직렬화**한 트랜잭션 안에서 조건부 UPDATE(`WHERE status='pending' AND (SELECT count …) < cap RETURNING`)한다. **조건부 UPDATE 단독은 불충분** — 서브쿼리 COUNT 가 스캔하는 다른 `running` 행에는 락이 없어, 서로 다른 execution 을 대상으로 한 두 admission 이 같은 COUNT 스냅샷을 보고 둘 다 통과(cap 초과)한다(ai-review CRITICAL 실증). advisory lock 이 같은 workspace 의 admission 을 순차화해 스냅샷을 안정화하고, 서로 다른 workspace 는 병렬 진행한다([§Rationale "동시성 cap admission gate"](#rationale)). **priority 3-tier(`ExecuteOptions.triggerType` threading)는 구현 완료** — `manual`(1) > `webhook`(2) > `schedule`(3) 로 세분화(§4.3); 호출부가 `Trigger.type` 을 threading 하고 execute() 가 `executedBy` 우선 판정한다.

---

## 9. Redis 키 네이밍 컨벤션

### 9.1 키 패턴

모든 Redis 키는 아래 패턴을 따른다:

```
{service}:{workspaceId}:{resource}:{id}:{sub}
```

| 세그먼트      | 설명              | 예시                                                    |
| ------------- | ----------------- | ------------------------------------------------------- |
| `service`     | 서비스 식별자     | `exec` (실행 엔진), `core` (Core API), `ws` (WebSocket) |
| `workspaceId` | 워크스페이스 UUID | `550e8400-...`                                          |
| `resource`    | 리소스 유형       | `execution`, `node`, `lock`, `rate`, `session`          |
| `id`          | 리소스 ID         | UUID                                                    |
| `sub`         | 하위 키 (선택)    | `seq`, `lock`, `session`                                |

### 9.2 용도별 키 정의 및 TTL

| 키 패턴                                   | 용도                                                                                                                                                                                                                                                                                                                                                                                                                               | TTL                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `core:{wsId}:rate:{userId}`               | API Rate Limit 카운터                                                                                                                                                                                                                                                                                                                                                                                                              | 60초                                                                  |
| `ws:{wsId}:session:{connId}`              | WebSocket 세션 정보                                                                                                                                                                                                                                                                                                                                                                                                                | 세션 유지 시간                                                        |
| `exec:recover:lock`                       | 부팅 시 stuck recovery 분산 lock — 워크스페이스 단위가 아닌 **전역**. 단일 인스턴스만 recovery UPDATE 를 수행하도록 보장 (§7.4 참조)                                                                                                                                                                                                                                                                                               | 60초                                                                  |
| `exec:cont:seq:<executionId>`             | continuation publish 의 monotonic seq (Redis INCR per executionId) — BullMQ jobId (`${executionId}:${nodeExecutionId}:${seq}`) 의 idempotency key. executionId 는 UUID, 워크스페이스 단위가 아닌 **전역**. 8 bytes 미만. **sliding-window TTL** — 매 publish (`nextSeq`) 가 EXPIRE 를 갱신해 continuation 이 활성인 동안 키가 유지되고, executionId 종결 후 (publish 중단) TTL 경과 시 자연 소멸. seq 단조성은 활성 구간 내내 보존. **INCR 실패 시 random fallback 없이 `publish` 가 `null`(`queued:false`) 을 반환한다 (fail-fast)** — random seq 는 idempotency key 계약을 위반(jobId dedup 무력화). `exec:seq`(emit-event)의 in-memory degraded fallback 과 **의도적 비대칭**: continuation seq 는 jobId dedup 계약 보존이 가용성보다 우선이며, BullMQ 자체가 Redis 라 INCR 실패 장애엔 직후 `queue.add` 도 실패해 fallback 실익이 사실상 없다 (§Rationale "continuation publish 실패 동기 surface 통일") | `CONTINUATION_SEQ_TTL_SECONDS` (기본 86400 = 24시간, 매 publish 갱신) |
| `exec:run:seq:<executionId>`              | (**PR1~PR4 미사용 — 미래 예약**) `execution-run` intake job 의 monotonic seq (Redis INCR per executionId). **jobId = executionId 직접 사용**(1:1 enqueue dedup). PR4 crash 재개는 **네이티브 BullMQ stalled 재배달(같은 jobId 재처리)** 을 쓰므로 re-enqueue 가 없어 seq 가 여전히 불필요하다(당초 "PR4 활성화" 스케치를 정정). seq 일반형(`<executionId>:run:<seq>`)은 **명시적 re-enqueue 를 도입하는 미래 변경**에서만 활성화한다. continuation seq 와 **namespace 분리**(`run` vs `cont`). executionId 는 UUID, **전역**                                 | `CONTINUATION_SEQ_TTL_SECONDS` 준용 (구현 시 결정)                    |
| `exec:seq:<executionId>`                  | emit-event seq (`ExecutionSeqAllocator`, Redis `INCR`) — WS envelope `seq`(§[6-websocket-protocol §2.2](./6-websocket-protocol.md#22-서버--클라이언트-이벤트-래퍼)) · 외부 SSE `id:` · Outbound Notification `seq` 가 **공유하는 execution 별 monotonic counter** ([Spec EIA §R7](./14-external-interaction-api.md#r7-seq-동일-공유--sse-와-notification) 의 "execution 별 atomic INCR" 구현체). `exec:cont:seq:` 와 namespace 분리. executionId 는 UUID, **전역**. **sliding-window TTL** — 매 발급(INCR+EXPIRE 단일 pipeline)이 EXPIRE 를 갱신, terminal event 발송 후 best-effort `DEL`. Redis 미가용 시 in-memory per-instance degraded fallback (분산 monotonic 미보장 — 수용된 trade-off, [6-websocket-protocol §Rationale](./6-websocket-protocol.md#rationale)) | `EXECUTION_SEQ_TTL_SECONDS` (기본 86400 = 24시간, 매 발급 갱신)       |

> **실행 상태는 Redis 키가 아니다 (Phase-1 설계 대체)**: 위 표는 실제 사용 중인 키만 나열한다. 옛 Phase-1 설계의 `exec:{ws}:execution:{id}:context`(실행 컨텍스트)·`:status`(실행 상태)·`node:{id}:output`(노드 출력)·`worker:{id}:heartbeat`(워커 헬스체크)·`lock:{id}`(실행 잠금)·`queue:priority`(우선순위 큐)는 **구현되지 않았고 코드에 존재하지 않는다** — 현 아키텍처가 각각 **in-memory segment-local ExecutionContext**(§6.2)·**PostgreSQL `Execution.status`**·**PostgreSQL `NodeExecution.outputData` + `execution_node_log`**·**BullMQ stalled-job 검출(별도 heartbeat 채널 없음, §7.1)**·**§7.5 DB 원자 claim(별도 실행 잠금 없음)**·**BullMQ 네이티브 job priority**(§7.4)로 대체했다. 근거·경위는 [§Rationale "실행 컨텍스트 in-memory + DB durable — Redis context store 미채택"](#rationale).

**Pub/sub 채널** (키-값 저장이 아닌 fire-and-forget broadcast — TTL 무관):

| 채널                           | 용도                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `integration:cache:invalidate` | integration 자격증명 회전·삭제 시 전 인스턴스의 인스턴스-로컬 자격증명 캐시(예: database-query 연결 풀)를 즉시 evict ([DB Query §4](../4-nodes/4-integration/2-database-query.md#4-실행-로직)). payload = integrationId 평문. 워크스페이스 비종속 **전역**. fail-safe — 미수신 시 핸들러의 credsHash 비교 evict 로 degrade. 구독은 전용 duplicate 연결(공유 command 연결은 SUBSCRIBE 미발행) |

> 전역 키 `exec:recover:lock`, `exec:cont:seq:<executionId>` 및 `exec:seq:<executionId>` 는 §9.1 의 `{service}:{workspaceId}:{resource}` 패턴을 따르지 않는다. **워크스페이스에 종속되지 않는** 책임(부팅 단일 진입 가드 / execution 단위 seq — executionId 가 이미 전역 유일 UUID)을 가지므로 전역 키로 둔다. pub/sub 채널 `integration:cache:invalidate` 도 워크스페이스 비종속이라 전역이다. (옛 `execution:continuation` Redis pub/sub 채널은 BullMQ 큐 `execution-continuation` 로 교체되어 폐기 — §9.3 / §Rationale "Durable Continuation".)

### 9.3 BullMQ 큐 목록

애플리케이션이 사용하는 BullMQ 큐는 다음과 같다. BullMQ 가 내부적으로 사용하는 Redis 키 (`bull:<queue>:*`) 는 §9.1 의 `{service}:{workspaceId}:{resource}` 패턴 범위 밖이다 (BullMQ 라이브러리 표준).

| 큐 이름                  | 역할                                                                                              | attempts                                                                                         | 비고                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `execution-run`          | execution intake — 첫 active 세그먼트(실행 시작→첫 BLOCK/완료) work-stealing 분산 (PR1 구현 완료) | `attempts:1`, `maxStalledCount:1`, `stalledInterval:30초` (**PR4** — 크래시 세그먼트 1회 자동 재배달 → §7.5 case B 멱등 rehydration 재구동, 소진 시 `WORKER_HEARTBEAT_TIMEOUT`. 부팅 backstop `recoverStuckExecutions` 는 병존, §7.1) | PR1 구현. `execute()` 의 fire-and-forget in-process 호출 대체. `removeOnComplete:true`, `removeOnFail:false`. **jobId = executionId** (1:1 enqueue; 네이티브 stalled 는 같은 jobId 재처리라 re-enqueue/seq 불요 — §9.2 `exec:run:seq` 미사용). BullMQ job priority 3-tier `manual`(1)>`webhook`(2)>`schedule`(3) (triggerType threading 구현 완료 2026-07-04 — 호출부 `ExecuteOptions.triggerType`, executedBy 우선). 관측: `ExecutionRunDlqMonitorService`(`EXECUTION_RUN_DLQ_ALARM_THRESHOLD`) |
| `execution-continuation` | 사용자 입력 fan-out + AI Agent retry 재진입 (§7.4 / §7.5) — 매 **재개** active 세그먼트           | `RESUME_BULLMQ_ATTEMPTS` (기본 3)                                                                | 옛 Redis pub/sub `execution:continuation` 채널 대체. 메시지 타입 6종 `continue` / `cancel` / `button_click` / `ai_message` / `ai_end_conversation` / `retry_last_turn` (§7.4) — 마지막 `retry_last_turn` 만 WAITING 이 아닌 spawn 된 RUNNING row 를 대상으로 한다                                                |
| `background-execution`   | Background 노드 본문 실행 (§3.3)                                                                  | 코드 기본값 (현재 `BACKGROUND_EXECUTION_QUEUE_DEFAULT_OPTS`)                                     | 기존                                                                                                                                                                                                                                                                                                             |

> `execution-run` 과 `execution-continuation` 은 함께 **active 세그먼트 운반자**다(§4). `waiting_for_input` 은 두 세그먼트 사이의 큐 없는 durable DB park (§4.x). **한 세그먼트 내부의 노드 dispatch 는 여전히 `runExecution` 의 in-process while-loop (§2.1) — per-node `task-queue` 는 존재하지 않는다.**

#### Dead-letter 모니터링 (Phase 3.1)

`execution-continuation` 큐는 `removeOnFail: false` 로 운영되어 attempts (`RESUME_BULLMQ_ATTEMPTS`) 소진 job 이 `failed`(dead-letter) 상태로 누적된다. rehydration 이 구조적으로 실패하는 회귀(배포 후 `_resumeCheckpoint` schema drift — `buildRetryReentryState` 재구성 실패, 체크포인트 손상 등)는 dead-letter depth 급증으로 나타나므로 다음을 둔다:

- `ContinuationDlqMonitorService` — dead-letter(`failed`) depth 와 retry backlog(`delayed`)를 주기 polling, 임계 초과 시 structured `logger.error` 알람을 cooldown 1회로 발생. **임계 초과 알람**은 log 기반을 유지(근거: [§Rationale "DLQ 모니터링 — 로그 기반 알람 선택"](#rationale) 참조). **큐 깊이(waiting/active/delayed/failed)**는 `registerQueueDepthProvider` 를 통해 `clemvion.queue.depth` ObservableGauge 로 NF-OB-07 에도 노출 — 관측(gauge)과 능동 통지(알람)를 분리한다.
- `ExecutionRunDlqMonitorService` (PR4) — `execution-run` 큐에 대한 `ContinuationDlqMonitorService` 미러. `EXECUTION_RUN_DLQ_*` env(useFactory 주입, 서비스가 `process.env` 직접 접근 안 함)로 임계·주기·cooldown 설정. stalled 재배달 소진(`WORKER_HEARTBEAT_TIMEOUT`)이 dead-letter 로 쌓이는 것을 관측.
- worker `onFailed` (`@OnWorkerEvent('failed')`) — 실패 1건마다 `RETRY`(attempts 잔여) / `DEAD-LETTER`(attempts 소진) 태그 + 시도 횟수 로깅.

| 환경변수                               | 기본값   | 설명                                   |
| -------------------------------------- | -------- | -------------------------------------- |
| `CONTINUATION_DLQ_ALARM_THRESHOLD`     | `50`     | dead-letter(`failed`) job 수 알람 임계 |
| `CONTINUATION_DLQ_MONITOR_INTERVAL_MS` | `60000`  | depth polling 주기                     |
| `CONTINUATION_DLQ_ALARM_COOLDOWN_MS`   | `300000` | 알람 재발 최소 간격                    |
| `CONTINUATION_DLQ_MONITOR_ENABLED`     | `true`   | `'false'` 지정 시 모니터 비활성        |
| `EXECUTION_RUN_DLQ_ALARM_THRESHOLD`    | `20`     | `execution-run` dead-letter(`failed`) job 수 알람 임계 (PR4 — `ExecutionRunDlqMonitorService`, continuation 미러) |
| `EXECUTION_RUN_DLQ_MONITOR_INTERVAL_MS`| `60000`  | `execution-run` depth polling 주기      |
| `EXECUTION_RUN_DLQ_ALARM_COOLDOWN_MS`  | `300000` | `execution-run` 알람 재발 최소 간격     |
| `EXECUTION_RUN_DLQ_MONITOR_ENABLED`    | `true`   | `'false'` 지정 시 `execution-run` 모니터 비활성 |

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
    status: "success" | "failed";
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
  ): Promise<Integration>; // workspaceId / service_type / status 모두 검증

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

1. **새 Execution 시작 거부**. 새 Execution 을 시작하는 HTTP 진입점(`POST /api/workflows/:id/execute`, 단일 노드 `POST /api/workflows/:id/nodes/:nodeId/execute`) 및 WS [`execution.start`](./6-websocket-protocol.md#42-실행-제어-명령-client--server) 명령이 **503 Service Unavailable** 응답. response body 는 표준 API 에러 shape (`{ error: { code: 'SERVER_SHUTTING_DOWN', message: '...' } }`, [Spec API 규약](./2-api-convention.md)), `Retry-After: <ceil(SIGTERM_GRACE_MS / 1000)>` 헤더 동봉. LB drain 동안 traffic 이 다른 인스턴스로 라우팅.

   > **Phase 1 구현 범위**: HTTP 진입점(`POST /api/workflows/:id/execute` + 단일 노드 `POST /api/workflows/:id/nodes/:nodeId/execute`) gate 가 구현됨. WS `execution.start` 명령은 spec [§8.2](../3-workflow-editor/3-execution.md#82-websocket-명령-클라이언트--서버) 에 정의되어 있으나, 현재 backend WebSocket gateway 에 해당 핸들러가 미구현 상태로 본 gate 도 적용 대상 외. Phase 2 (continuation-queue 본구현) 에서 WS handler 신설 시 동일 gate 추가 예정.

2. BullMQ `execution-run` / `execution-continuation` / `background-execution` 의 active job 처리 중인 worker 는 현재 세그먼트(노드)를 완료까지 진행. 신규 job consume 중단. (한 세그먼트 내부 노드 dispatch 는 큐 미경유 in-process while-loop — §2.1 / §9.3)
3. **WAITING_FOR_INPUT 상태의 Execution 은 건드리지 않음** — DB 상태 그대로 두고 in-memory resolver 만 자연 소실. 사용자 입력 도착 시 §7.5 rehydration 으로 재개.
4. **RUNNING 상태의 노드** 는:
   - `SIGTERM_GRACE_MS` (기본 30초) 까지 완료 대기.
   - 완료 시: 평상시 흐름으로 다음 노드 enqueue. continuation-queue 가 영속이므로 다른 인스턴스가 pick up.
   - 미완료 시: 해당 NodeExecution 을 `failed` + `error.code='SERVER_INTERRUPTED'` 로 마킹 후 Execution 도 노드의 errorPolicy 에 따라 처리 (`stop` → Execution `failed`, `continue` → 다음 노드 enqueue). §7.2 체크포인트 기반 Resume 으로 다른 인스턴스가 미완료 task 를 재큐할 수도 있음 (기존 §7.2 동작).

   > **Phase 1 구현 범위**: errorPolicy 분기 없이 전체 `stop` 동등 처리 (NodeExecution + Execution 모두 `failed`). `continue` 정책 분기 (`다음 노드 enqueue`) 는 Phase 2 의 `execution-continuation` BullMQ 큐 (§7.4) 가 영속 상태로 enqueue 가능해진 뒤 추가 예정.

5. `SIGTERM_GRACE_MS` 경과 후 강제 종료.

| 환경 변수                          | 기본값           | 설명                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SIGTERM_GRACE_MS`                 | `30000` (30초)   | k8s `terminationGracePeriodSeconds` 와 일관되게 설정. 셀프호스팅 Helm Chart 권장값은 `terminationGracePeriodSeconds = ceil(SIGTERM_GRACE_MS / 1000) + 5` (5초 = readiness drain 여유)                                                                                                                                                                                     |
| `RESUME_BULLMQ_ATTEMPTS`           | `3`              | continuation-queue 재시도 횟수 (§7.4 / §7.5) — `background-execution` 큐 `attempts` 와 동일한 관리 방식 유지 (현재 양쪽 모두 코드 상수, ENV 화는 후속)                                                                                                                                                                                                                    |
| `CONTINUATION_WORKER_CONCURRENCY`  | `1`              | continuation worker 가 인스턴스당 병렬 처리하는 resume/continuation job 수 (§7.4 "Worker 동시성"). 기본 직렬(1). 비양수·비정수·비숫자 입력은 1 로 fallback. 대량 동시 resume 의 setup 직렬화 latency 가 관측되면 상향                                                                                                                                                     |
| `EXECUTION_RUN_WORKER_CONCURRENCY` | `1`              | `execution-run` intake worker 가 인스턴스당 병렬 처리하는 active 세그먼트 수 (PR1 구현 완료). work-stealing 처리량·backpressure·§8 동시성 cap(PR2)의 토대. 기본 1(직렬). 비양수·비정수·비숫자·공백 전용 입력은 1 로 fallback(`resolveExecutionRunWorkerConcurrency`, `CONTINUATION_WORKER_CONCURRENCY` 패턴 준용). 모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영 |
| `EXECUTION_MAX_ACTIVE_RUNNING_MS`  | `1800000` (30분) | §8 단일 Execution 최대 **active-running 누적 시간**(ms). 초과 시 `EXECUTION_TIME_LIMIT_EXCEEDED`→`failed`. `0`=무제한. 비정수·음수·비숫자는 기본값 fallback(`resolveMaxActiveRunningMs`). `waiting_for_input` park 시간 제외. 모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영 (PR2a)                                                                               |

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

### continuation publish 실패 동기 surface 통일 (C-1·M-7)

**C-1** — `cancelWaitingExecution` 은 옛 `void publish` fire-and-forget 였다(publish 실패가 caller 에 닿지 않는 에러 유실). 다른 4종 continuation 메서드가 이미 `ContinuationPublishResult` 를 반환하므로 cancel 만 예외로 둘 근거가 없어 동일 패턴으로 정합화하고(§7.4), REST `POST /executions/:id/stop` 의 WAITING cancel 분기가 `queued:false` 를 surface 한다. HTTP 코드는 **503** 으로 정한다 — Redis 의존성 장애 = upstream 불가용이므로 502(잘못된 게이트웨이 응답)가 아니라 503(일시 불가·재시도)이 맞고, 이미 `SERVER_SHUTTING_DOWN`(SIGTERM 후 새 실행 거부)이 같은 503 선례를 확립했다. cancel 은 WS ack 경로(§7.5.2 의 4종 handler)가 아니라 REST stop 진입점이므로 신규 코드 `EXECUTION_ENQUEUE_FAILED`(`EXECUTION_*` 네임스페이스, §7.5.2)로 표기한다.

**M-7** — `nextSeq` 의 Redis INCR 실패 시 옛 `Math.random` seq fallback 을 제거하고 fail-fast(INCR throw → `publish` outer catch → `null`/`queued:false`)로 전환했다. random seq 는 §7.4 "seq = idempotency key"·§9.2 단조성 계약을 위반해 jobId 중복 dedup 을 무력화하며, BullMQ 자체가 Redis 라 INCR 가 실패하는 장애에선 직후 `queue.add` 도 실패할 공산이 커 fallback 의 가용성 실익이 사실상 없다. `exec:seq`(emit-event)는 분산 monotonic 미보장을 수용해 in-memory degraded fallback 을 두지만, continuation seq 는 jobId dedup 계약 보존이 우선이라 의도적으로 **비대칭**이다 (§9.2). 두 항목은 publish 실패를 `queued:false` 단일 표면으로 통일한다는 점에서 같은 결정이다.

### `waiting_for_input → failed` 전이 추가

옛 정책은 `waiting_for_input` 종료를 `running` 또는 `cancelled` 로만 정의했다. AI Agent multi-turn 의 turn 처리가 LLM throw (429 / timeout / connection) 로 종결될 때, 엔진의 `handleAiTurnError` → `finalizeAiNode('FAILED')` 가 직접 Execution 을 `failed` 로 전이시켜야 spec [§7.9](../4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트) 의 `port='error', status='ended'` shape 으로 정상 finalize 된다.

**배경 회귀**: 본 전이 누락 시 `handleAiMessageTurn` 의 throw 가 `waitForAiConversation` 의 while loop 를 빠져나가지 못해 `finalizeAiNode` 호출 자체가 누락 — NodeExecution.status 는 WAITING_FOR_INPUT 으로 영구 잔류하고 Execution 만 `runExecution` top-level catch 로 FAILED 가 되어, frontend 가 헤더 "실패" + 노드 "Waiting" 의 모순 상태를 표시한다.

직접 `WFI → failed` 단일 전이 + NodeExecution.status=FAILED save + `NODE_FAILED` → `EXECUTION_FAILED` WS 이벤트 순서를 채택한다 — 단일 트랜잭션 commit 으로 §1.1 의 기존 원자성 정책과 동일하다. `WFI → running` 후 `running → failed` 의 두 단계 전이는 두 트랜잭션 분리로 단일 원자성이 깨져 더 복잡하므로 택하지 않는다.

구현: `state-machine.ts` `ALLOWED_TRANSITIONS`.

### 재개 race 보장을 DB 원자 claim 으로 — 위 "running hop 회피" 결정의 부분 수정 (§7.5, 2026-07-02)

§7.5 는 "재검증 가드가 정상-경로 race 까지 닫는다"(불변식: 동일 turn 이중 실행 0)를 선언했으나, 그 가드는 비원자 SELECT check-then-act 라 멀티 인스턴스(인스턴스당 concurrency=1 이어도 인스턴스 간 병렬)·§7.4 가 예고한 concurrency 상향 시 불변식을 **기계적으로 보장하지 못했다**(check 와 act 사이 창에서 두 worker 동시 통과). 재개 **진입** 을 조건부 원자 UPDATE(`… WHERE status='waiting_for_input' RETURNING`, affected=0 → ack-and-discard)로 gate 해 갭을 닫는다.

**위 "`waiting_for_input → failed` 전이 추가" 소절이 기각한 "WFI→running→failed 2단계" 와의 관계 (정면 대응)**: 그 결정은 **AI turn 실패 finalization** 맥락에서 running hop 을 "무익한 복잡성 + 두 트랜잭션 분리로 원자성 약화" 로 기각했다 — 당시엔 running 을 경유할 **편익이 전무**했기 때문이다. 본 결정은 그 hop 에 **새 편익**을 부여한다: 재개 진입의 concurrency race-safety(멀티 인스턴스·상향에서 이중 실행 기계적 차단)로, 2026-06 결정이 가중치를 둘 필요가 없던 요구다. 원자성 우려도 **실질 대응**한다 — claim 은 **단일 조건부 UPDATE**(두 트랜잭션 분리가 아님)이고, claim 후 rehydration 프로세스 실패는 `RESUME_*` terminal 원자 마감(§7.5)으로 stuck RUNNING 을 남기지 않으며, 크래시 잔여 `running` row 는 `recoverStuckExecutions`(RUNNING 대상, §7.4)가 회수한다. 그 결과 **재개 turn 의 LLM throw 는 claim 후 `running → failed`(§1.2)로 finalize** 되며, 이는 2026-06 "직접 `WFI → failed`" 를 **재개 경로에 한해 부분 수정**한 것이다(claim 이 개입하지 않는 finalization 서술은 불변 — §1.1 표 `waiting_for_input → failed` 행 각주).

**기존 패턴의 일반화**: optimistic claim 은 §1.3 `_retryState` 소비("affected=1 인 쪽만 진행")로 이미 확립된 패턴의 일반화이지 새 동시성 프레임워크 도입이 아니다. concurrency=1 전제 유지(대안)는 불변식을 운영 구성(단일 인스턴스)에 의존시켜 §7.4 가 예고한 상향 시점에 결국 본 변경이 필요해 비용이 이연될 뿐이라 기각.

구현: 재개 진입 claim 은 조건부 원자성(affected 기반 race 결정)이 필요해 `updateExecutionStatus`/`assertTransition` choke point 를 **우회**하는 raw conditional UPDATE 로 Execution·NodeExecution 을 `waiting_for_input → running` 짝 전이한다 (`ALLOWED_TRANSITIONS` 는 Execution 전용이고 `waiting_for_input → running` 은 이미 표에 존재 — 신규 전이 추가가 아니라 claim 이 그 전이를 조건부·원자로 수행). claim 후 rehydration 실패는 `RESUME_*` terminal 롤백(WAITING/RUNNING 둘 다 대상). Execution 짝 UPDATE 가 terminal(동시 cancel 등)로 affected=0 이면 node claim 도 tx 롤백해 discard. 착수 조건: 동일 (executionId, nodeExecutionId) 2회 동시 재개 시 한쪽만 진행 unit + form park 에 continuation job 2건 인위 enqueue 후 turn 이중 실행 0 dockerized e2e. 추적: `plan/complete/refactor/06-concurrency.md` C-2 (Option A, 사용자 승인 2026-07-02).

### 크래시/재시작 RUNNING 세그먼트 제어된 re-drive (§7.1/§7.2/§7.5, PR3, 2026-07-04)

> heartbeat → BullMQ stalled-job 일원화의 근거는 아래 "Phase 2 cont 후속 정리" 항목 3 이 SoT다. 본 항목은 그 위에서 **PR3 재시작 크래시 re-drive**(stalled 인프라 도입 전 interim)를 정의한다.

크래시/재시작으로 중단된 RUNNING(non-waiting) active 세그먼트를, `recoverStuckExecutions` 가 부팅 시 원자 re-claim 후 §7.5 case B rehydration 으로 **재구동**하도록 전환한다(옛 "일괄 `failed` 마킹" 대체). 사용자 결정(2026-07-03): Q1=제어된 re-drive(BullMQ auto-stalled OFF 유지), Q2=errorPolicy='continue' defer.

- **왜 지금 recovery-loop re-drive 인가**: §7.2 point 3 은 "재시작 시 running 을 체크포인트에서 resume" 을 이미 약속했으나, `recoverStuckExecutions` 가 정반대로 **일괄 fail** 해 약속을 위반했다. PR3 는 이 위반을 해소한다(fail→re-drive). "일반 노드로의 일반화" 는 이미 full B3 로 완료된 waiting 재개(`dispatchResumeTurn`)와 달리 **크래시 세그먼트는 waiting 이 아니라 mid-dispatch RUNNING** 이므로 turn 핸들러가 아닌 그래프 forward 재구동이 필요했고, `rehydrateContext`/`runNodeDispatchLoop` 가 node-type-generic 이라 tractable 하다(per-node task queue 재도입 아님 — "한 세그먼트=한 프로세스" 전제 유지).
- **왜 PR3 에서 BullMQ stalled 자동 재배달을 켜지 않았는가 (PR4 로 분리)**: `maxStalledCount>0` 자동 재배달은 **poison/non-idempotent 세그먼트를 운영 중 무인 재실행**시켜 RUNNING-at-crash Integration 노드의 중복 side-effect 를 자동 증폭할 위험이 있다. PR3 는 제어된 트리거(부팅 스캔)로 먼저 landing 해 멱등 재구동 메커니즘·경계를 검증했다. **PR4(2026-07-04)는 자동 재배달을 `maxStalledCount:1`(재배달 1회 상한)로 도입하되 `recoverStuckExecutions` 을 은퇴시키지 않고 backstop 으로 유지**한다(관측성=execution-run DLQ 모니터). 상한을 1 로 둔 것은 poison 세그먼트의 무한 무인 재실행을 막기 위함이며, 1회 소진 시 `WORKER_HEARTBEAT_TIMEOUT` dead-letter 로 확정한다(§Rationale "PR4 — BullMQ stalled 자동 재배달").
- **§4.2 active-running 직렬화 불변식 재검증** (필수 이행 — §4.1 PR2a 메모가 "PR2b+ 재진입 경로 추가 시 재검증" 의무를 걸어둠): crash re-drive 는 원래 job 종료 없이 같은 Execution 에 새 active 세그먼트를 시작하는 재진입 경로다. 정상 경우(원 워커 진짜 사망) `jobId=executionId` dedup + `started_at` re-claim + per-node COMPLETED skip 로 동일 turn 이중 실행 0 이 유지된다. **잔여 race**: 원 워커가 실은 살아있는 zombie(hang/네트워크 단절 후 부활)면 stale 판정으로 두 세그먼트가 동시 구동될 수 있다. PR4 로 BullMQ stalled 재배달이 켜져(lock 만료 기반) 정상 크래시는 fencing 되나, lock 만료 후 부활하는 zombie 는 완전히 배제되지 않는다. 완화: (i) 부팅 backstop 은 부팅당 1회·운영 중 stalled 는 `maxStalledCount:1` 이라 어느 쪽도 tight-loop 재구동 없음, (ii) 30분 stale 임계(짧은 hang 은 backstop 미대상), (iii) per-node COMPLETED skip(이중 구동돼도 완료 노드는 재실행 안 됨). **이 zombie 노출은 현행 fail-path 도 동일**(현행도 zombie 의 execution 을 fail 마킹 → zombie 가 fail 된 row 를 계속 굴림)하므로 신규 도입 회귀가 아니며, blast radius 는 `maxStalledCount:1` + per-node skip 으로 bound 된다.
- **terminal 경계 (무한 re-drive 방지)**: 1차 bound 는 §8 누적 한도가 아니라 **트리거 자체**다 — 부팅 1회 스캔이라 poison 세그먼트는 부팅당 최대 1회 재구동(자연 rate-limit). §8 `active_running_ms` 누적 한도(`EXECUTION_TIME_LIMIT_EXCEEDED`)는 crash flush under-count(위 "Graceful Shutdown … under-count") 때문에 **best-effort 2차** 경계로만 작동한다. rehydration 자체 불가(checkpoint 부재/손상)는 `RESUME_CHECKPOINT_MISSING` terminal(§7.5). **PR3 기간 `WORKER_HEARTBEAT_TIMEOUT` 은 발동하지 않는다**(PR4 stalled 모델 예약어).
- **신규 마이그레이션 불요**: re-claim 은 기존 `started_at`(recoverStuckExecutions stale 판정과 동일 컬럼) 조건부 UPDATE, 완료 노드 skip 은 기존 `execution_node_log`(V035/V036), 2차 terminal 은 §8 `active_running_ms`(V083) 재사용.
- **at-least-once 경계**: 엔진은 완료 노드 미재실행(exactly-once)만 보장하고 RUNNING-at-crash 노드는 at-least-once 로 재실행한다 — §7.3 이 Integration 멱등을 노드 설정에 위임하는 기존 모델과 정합. 중복 실행 없이 무손실 재개는 분산 트랜잭션 없이는 불가한 본질적 trade-off.
- **errorPolicy='continue' 세그먼트 재개는 분리(defer)**: `execution-engine-residual-gaps.md` G2 의 3중 장애물(errorPolicy schema 노출 선행 미충족·spec 'continue' 용어가 실제 enum 에 부재·cross-instance 재개 인프라)은 크래시-재구동 인프라와 직교 — PR3 는 인프라 토대(멱등 re-drive)를 제공하되 G2 자체는 별건.
- **기각 대안**: (a) 신규 owner/heartbeat 컬럼으로 정확한 크래시 검출 — 마이그레이션·heartbeat 인프라 비용이 크고 BullMQ stalled 가 같은 역할을 표준 제공하므로 PR4 stalled 로 흡수. (b) recovery loop 주기적 스캔 추가 — 부팅 트리거로 재시작 resume 은 성립하고 운영 중 크래시는 PR4 stalled 가 본령이라 범위 밖.

### PR4 — BullMQ stalled 자동 재배달 (2026-07-04)

PR3 의 제어된 re-drive(부팅 backstop)로 멱등 재구동 메커니즘을 검증한 뒤, 운영 중 워커 크래시를 다른 워커가 즉시 이어받는 **BullMQ 네이티브 stalled 재배달**을 켰다. 사용자 결정(2026-07-03): Q1=진행(bounded), Q2=세그먼트-start 영속 defer(migration-free).

- **네이티브 stalled = 같은 jobId 재처리 → seq/re-enqueue 불요**: 당초 §9.2 스케치는 crash 재개를 `<executionId>:run:<seq>` re-enqueue 로 그렸으나, BullMQ 의 stalled 검출은 lock 만료된 **같은 job 을 그대로 재처리**한다(신규 enqueue 아님). 따라서 `exec:run:seq` 키는 PR4 에서도 미사용이고 jobId=executionId 가 유지된다 — 스케치 대비 순수 단순화. `runExecutionFromQueue` 는 재처리된 job 의 Execution 이 이미 `RUNNING` 임을 감지해 §7.5 case B 재구동으로 분기한다(PENDING=최초 실행, terminal=ack-discard 와 함께 3-way switch).
- **`maxStalledCount=1` (bounded blast radius)**: `maxStalledCount>1` 은 poison/non-idempotent 세그먼트를 운영 중 무인 다회 재실행시켜 RUNNING-at-crash Integration 노드의 중복 side-effect 를 증폭한다. 1 로 두면 재배달은 정확히 1회, 소진 시 `onFailed → finalizeStalledExhausted` 가 `status='running'` 조건부로 `failed`+`WORKER_HEARTBEAT_TIMEOUT` dead-letter(setup-throw 경로는 이미 terminal 이라 affected=0 no-op). blast radius = 재배달 1회로 확정. 관측은 `ExecutionRunDlqMonitorService`(continuation DLQ 모니터 미러 — failed≥threshold 알람+cooldown).
- **`recoverStuckExecutions` 은 은퇴하지 않는다 (backstop 병존)**: stalled 재배달은 **stall 된 job 이 존재할 때만** 동작한다. 전체 재시작(모든 워커 동시 종료 → 재배달할 살아있는 워커 없음)·Redis 비영속(job 자체 소실)·job 유실은 stalled job 이 없어 stalled 재배달로 커버 불가하다. 따라서 부팅 1회 스캔 backstop 을 유지한다. KB 파이프라인(`graph-extraction` stalled + `stuck-document-recovery` 부팅 backstop)도 동일하게 두 메커니즘을 병존시키는 선례다.
- **at-least-once 경계 = PR3 모델 계승**: 완료 노드는 skip(exactly-once), RUNNING-at-crash 노드는 재실행(at-least-once). Integration 노드의 재실행 멱등은 §7.3 대로 노드의 책임이다. PR4 는 이 경계를 바꾸지 않는다.
- **Q2 defer — under-count 미해소**: 세그먼트-start 영속(active_running_ms 정밀 flush)은 migration 이 필요해 PR4 scope 에서 제외했다(§Rationale "Graceful Shutdown … under-count 허용"). PR4 는 마이그레이션 없이 기존 컬럼만 재사용한다.
- **잔여 zombie race**: lock 만료 후 부활하는 zombie 워커는 stalled fencing 으로 완전히 배제되지 않으나, `maxStalledCount:1`(무한 재배달 없음) + per-node COMPLETED skip 으로 blast radius 가 bound 된다(§7.5 case B 각주). 현행 fail-path 도 동일 노출이라 신규 회귀 아님. 같은 class 의 narrow race 로, `finalizeStalledExhausted`(stalled 소진 dead-letter 마감)가 발동하는 순간 부팅 backstop `recoverStuckExecutions` 가 같은 stale RUNNING 을 re-claim 해 재구동 중이면 조건부 UPDATE(`WHERE status='running'`)가 정상 재구동을 `WORKER_HEARTBEAT_TIMEOUT` 로 잘못 마감할 수 있다("job stalled 소진 == 부팅 스캔" 이 겹치는 극히 좁은 창 한정, per-node skip 으로 완료 노드 보존). 완전 fencing 은 세그먼트-start/owner-token 영속(defer)에 의존한다.

### Pre-park read-window 정규화 — read-side 채택 + 양측 중복 방어

blocking 노드(carousel/form/AI)는 핸들러 봉투(`outputData.status='waiting_for_input'`)를 먼저 영속하고 `NodeExecution.status` 컬럼 전이는 직후 `waitForXxx` 의 atomic 트랜잭션에서 일어난다. 그 두 save 사이의 read window 에서 snapshot 이 조회되면 같은 row 가 `status='running'` + `outputData.status='waiting_for_input'` 인 **intra-row 불일치**로 노출된다. §1.1 cross-entity 원자성·`findById` 의 REPEATABLE READ 는 Execution↔NodeExecution 의 cross-query straddle 만 막아 이 창을 잡지 못한다.

**배경 회귀**: frontend `applyExecutionSnapshot` 이 `ne.status` 단일 필드를 waiting 판정의 진실로 신뢰했기에, 이 inconsistent snapshot 이 도착하면 waiting UI 가 hydrate 되지 않거나, 먼저 도착한 WS `waiting_for_input` 이벤트가 set 한 waiting 상태를 resume 으로 오인해 wipe → Carousel 버튼이 콜백 없이 disabled 로 stuck. turn-park(PR-B) 아키텍처 도입 후 read window 노출 빈도가 올라 재발했다.

**채택 — read-side 정규화 + 양측 defense-in-depth**:

- **write-side 전이를 앞당기지 않는다**: `executeNode` 의 봉투 persist 시점에 `NodeExecution.status` 를 곧장 `waiting_for_input` 으로 올리면, 동반 `Execution.status` 전이는 아직 `waitForXxx` 에서 일어나므로 그 사이 크래시 시 Execution=running/NodeExecution=waiting 의 cross-entity 불일치가 영속돼 §1.1 원자성 보장을 깬다. 따라서 write 경로·엔진 원자성은 불변으로 두고 **read 경로에서 봉투 status 를 surface** 한다.
- **backend `reconcilePreParkWaitingStatus` (1차, source)**: `findById` snapshot 응답에서 비terminal(`running`/`pending`) row 의 봉투가 waiting 이면 응답 status 를 surface — 모든 소비자(웹 앱·channel-web-chat·external-interaction-api)에 일관 적용. 이로써 snapshot 이 다시 (Execution=running, NodeExecution=waiting) 의 **기존 Phase-3 방어가 다루는 형태**로 정규화돼, 프론트의 검증된 reconcile 경로가 정상 작동한다.
- **frontend `isNodeWaitingForInput` (2차, defense-in-depth)**: WS `execution.snapshot`·read-replica·legacy 응답 등 backend 정규화가 적용되지 않을 수 있는 경로를 위해, 프론트도 `ne.outputData.status` 봉투를 함께 본다. 단일 레이어 의존의 단일 실패점을 제거한다.

두 레이어의 판정 규칙은 **의도적 중복**이므로(노드 status·봉투 status·terminal 제외 조건 동일), 한쪽만 변경하면 불일치 창이 재개방된다 — `reconcilePreParkWaitingStatus` 와 `isNodeWaitingForInput` 은 함께 변경한다.

> **후속(범위 외)**: read window 자체의 근본 제거(봉투 persist 와 status 전이를 단일 트랜잭션으로 묶기)는 별도 작업으로 둔다. 본 결정은 원자성 불변 + 소비자 견고화로 회귀를 차단하는 것이 목적이다.

구현: `ExecutionsService.findById` / `reconcilePreParkWaitingStatus` (backend), `apply-execution-snapshot.ts` / `isNodeWaitingForInput` (frontend).

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
- **`ai_agent` + `information_extractor` 지원** (초기 `ai_agent` 한정에서 확장): 초기 도입은 재구성기·allow-list 를 `ai_agent` shape 에 맞춰 `ai_agent` 한정으로 출하하고 일반화를 후속 작업으로 남겼다. 본 확장은 그 후속을 실현한다 — (a) 엔진 dispatch 가 이미 `handler.processMultiTurnMessage` 로 polymorphic 이고, (b) `resolveRetryNodeConfig`/`buildRetryReentryState` 가 node-type-generic 이라 config 재유도가 `information_extractor` 에도 그대로 동작하며, (c) IE 고유 runtime state(`partialResult`/`collectionRetryCount`)는 credential-free·소형이라 allow-list 합집합에 추가하는 비용이 낮다. 따라서 IE 도 restart/타 인스턴스 재개를 무손실 지원하고 graceful-reset 갭을 제거한다. 그 외 `ai_conversation` 핸들러는 여전히 미영속(graceful reset) — 신규 핸들러는 자기 runtime state 를 allow-list 에 등록해야 지원된다(원칙 번복이 아니라 점진 확장).
- **별도 `_continuationCheckpoint` 컬럼 신설 기각**: 기존 SoT 인 `NodeExecution.outputData` (JSONB) 에 키로 보존해 **DB 스키마 변경·마이그레이션을 회피**한다 (§6.2 — `_retryState` 와 동일 취급).

**부재/손상 시**: `_resumeCheckpoint` 가 부재(기능 배포 이전 진입한 waiting row)하거나 `buildRetryReentryState` 재구성이 실패(schema drift)하면 `RESUME_INCOMPATIBLE_STATE` 로 종결하되, 채널 어댑터가 raw 에러가 아닌 "대화 세션 만료 — 새로 시작" graceful 안내로 표시한다 (§7.5 실패 케이스 표).

### `failed → running` 재진입 전이 (R1 의 retry 실행 경로)

R1(위) 의 `execution.retry_last_turn` 이 실제로 실행되는 시점의 상태 전이 결정:

- retry 는 **새 NodeExecution row 를 spawn** 해 마지막 turn 을 replay 한다 (기존 `failed` row 는 보존). 새 row 의 turn 이 WS `node.started`/`node.completed` 를 발행하려면 Execution 이 `running` 이어야 하므로 §1.1 에 **`failed → running` 단일 전이**를 추가한다.
- 이 전이는 R2(`waiting_for_retry` 신설 — 기각) 와 무관한 별개 경로이고, `waiting_for_input → running → failed` 재개 흐름과도 다르다 (retry 는 입력 대기 없이 새 row 를 즉시 구동). 일반 노드 실패에 번지지 않도록 state-machine 의 `allowRetryReentry` opt-in 으로만 허용 — `failed` 종결 실행이 일반 `updateExecutionStatus` 경로로 우발 부활하는 것을 차단한다.
- 재진입 성공 시 Execution 은 `completed`, 재실패 시 `failed`(retryable 재실패면 새 `_retryState` 보존 → 재-retry 가능)로 마감한다. replay 가 RUNNING 으로 도는 도중 도착한 사용자 cancel 은 **graceful no-op** 이다(full B3 — RUNNING replay/resume drive 에는 즉시 깨울 in-memory 코루틴이 없으므로 즉시 `cancelled` 로 끊지 않는다). 취소는 replay 가 다음 `waiting_for_input` park 에 도달했을 때 `cancelParkedExecution` 의 `status = WAITING_FOR_INPUT` 가드가 Execution + 동반 WAITING NodeExecution 을 `cancelled` 로 마킹하면서 발효된다. (replay 가 park 없이 그 turn 에서 종결되면 cancel 은 무효과로 흘려보내진다.)

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

**Graceful Shutdown 시 active-running 시간 under-count 허용 (PR2a 결정)**:

active-running 누적 타임아웃(§8)은 세그먼트 진행 경과분을 in-memory `segmentStartMs` Map 에 들고 있다가 세그먼트 종료(`updateExecutionStatus` RUNNING 이탈) 시 `Execution.active_running_ms` 에 flush 한다. SIGTERM graceful shutdown 으로 진행 중 세그먼트가 중단되면 그 경과분은 DB 에 flush 되지 않은 채 소실될 수 있고, 해당 세그먼트가 stalled-job(§7.1)으로 다른 워커에 재배달되면 재배달 워커는 `segmentStartMs` 가 없어 그 구간을 누적하지 못해 **active 시간을 under-count** 한다. 이는 의도적으로 허용하는 trade-off 다:

- Graceful Shutdown 은 빈도 낮은 인프라 이벤트이고 단일 세그먼트 지속(초~분)이 총 한도(기본 30분)에 비해 작아 실질 enforcement bypass 효과는 미미하다.
- flush 훅(`OnModuleDestroy` + partial accumulate + DB save)을 추가하면 SIGTERM 경로 복잡도가 커지고 재배달 워커의 `segmentStart` 재기록과 경합한다.
- 경합 없는 flush(세그먼트 시작 시각을 Redis/DB 로 영속)는 세그먼트-start 영속에 의존한다. **PR4(2026-07-04)는 사용자 결정(Q2 defer)으로 migration-free 로 진행해 세그먼트-start 를 영속하지 않았다 — under-count 는 PR4 로도 해소되지 않으며 후속 candidate 로 남는다**(재배달된 세그먼트가 자기 시작 시각을 알아야 하므로 세그먼트-start 영속과 자연히 인접).

> **정정 (PR3, 2026-07-04)**: 이전 서술은 이 under-count 를 "PR3 에서 자연 해소" 로 예고했으나, **PR3 의 제어된 re-drive 는 세그먼트-start 를 영속하지 않으므로 under-count 를 해소하지 않는다**. PR3 의 crash re-drive(§7.1/§7.5 case B)도 crash 로 소실된 세그먼트 경과분을 `active_running_ms` 에 반영하지 못한다. 그 대신 PR3 는 무한 re-drive 방지의 **1차 bound 를 §8 누적 한도가 아니라 트리거 자체**로 둔다 — `recoverStuckExecutions` 는 **부팅 시 1회 스캔**이라 poison 세그먼트는 부팅당 최대 1회만 재구동되는 자연 rate-limit 이 걸린다(tight loop 아님; 배포가 버그를 고칠 수도 있다). §8 `active_running_ms` 누적 한도는 under-count 를 감안한 **best-effort 2차** 경계로만 작동한다. 정밀한 flush(1차 bound 를 §8 로 승격)는 PR4 세그먼트-start 영속에 의존한다. (under-count 방향은 "한도를 덜 적용" 이라 fail-open 이 아니라 conservative under-enforcement 이며 silent over-kill 위험은 없다.)

### 실행 컨텍스트 in-memory + DB durable — Redis context store 미채택 (§6.2/§9.2, 2026-07-04)

초기 Phase-1 설계는 실행 상태 전반을 Redis 에 두려 했다 — `ExecutionContext`(변수·nodeOutputCache)·실행 status·노드 output·worker heartbeat·실행 lock·priority 큐를 각각 Redis 키(`exec:{ws}:…:context`/`:status`/`:output`/`:heartbeat`/`:lock`/`queue:priority`)로. **이 설계는 구현되지 않았고**, 실제 아키텍처는 다음으로 수렴했다:

- **실행 컨텍스트 = in-memory segment-local** (`ExecutionContextService` 의 인스턴스-로컬 `Map<contextKey, ExecutionContext>`). park(=세그먼트 종료, full B3)·완료 시 소멸하고, 재개는 §7.5 rehydration 이 durable 컬럼(`Execution.conversation_thread`/`user_variables`/`resume_call_stack`)·`NodeExecution.outputData`·`execution_node_log` 에서 **DB 로부터 재구성**한다. **Redis context store 를 두지 않는 이유**: (a) **park-release 모델과 이중화** — park 시 durable 진실은 이미 PostgreSQL 이므로 Redis 사본은 rehydration 소스를 이원화(진실 갈림)해 park-release 설계를 흔든다. (b) **cross-instance 는 이미 아키텍처로 해소** — §4.2 `jobId=executionId` dedup 으로 active 세그먼트는 항상 1개, §7.4/§7.5 로 임의 인스턴스가 DB rehydration 으로 재개, PR3 case B 크래시 re-drive 도 DB 재구성. 세그먼트-로컬 in-memory 는 **의도된 설계**이지 결함이 아니다. (c) **성능·복잡도** — 매 노드 output 을 Redis 왕복시키는 비용 없이 세그먼트 내 in-memory 로 처리하고 경계(park/완료)에서만 DB commit.
- **실행 status = PostgreSQL `Execution.status`** (Redis 사본 없음). **노드 output = `NodeExecution.outputData` + 순서 `execution_node_log`**(§7.4). **worker heartbeat = 신설 안 함** — active 세그먼트가 BullMQ job 이라 크래시=job stall, BullMQ stalled-job 검출로 대체(§7.1). **실행 lock = §7.5 DB 원자 claim**(`WHERE status='waiting_for_input' RETURNING`)·부팅 recovery 는 전역 `exec:recover:lock` — 범용 실행 lock 은 불요. **priority = BullMQ 네이티브 job priority**(§7.4) — Redis sorted set 큐 미사용.

따라서 §6.2 저장 전략·§9.2 키 표에서 위 Redis 항목을 제거하고 실제 모델로 정정한다. 남는 실손실은 `segmentStartMs`(active-running 누적 tracking)의 in-memory 성이나, 이는 §Rationale "Graceful Shutdown … under-count 허용" 의 **수용된 trade-off** 다 — 세그먼트-start 영속은 **미확정 후속 candidate**로 남긴다. PR3(#795)의 제어된 re-drive 도, **PR4 의 stalled 자동 재배달도 세그먼트-start 를 영속하지 않아 under-count 를 해소하지 않는다**(PR4 는 Q2 defer 로 migration-free — 2026-07-04). 재배달된 세그먼트가 자기 시작 시각을 알아야 하므로 세그먼트-start 영속과 자연히 인접하나 아직 확정 scope 아님. **전면 Redis context store 는 채택하지 않는다**(이중화 위험). 분류 SoT: [execution-context 규약 원칙 4·§Rationale](../conventions/execution-context.md).

### park 즉시 해제 + slow-path 일원화 (Phase B)

**배경 — 코루틴 누적 위험**: 초기 모델(§4.x 옛 메모)은 park 후 `runExecution` 코루틴을 in-process 로 **살려 두고** detached coroutine + `firstSegmentBarriers` 단발 배리어로 worker job 만 ack 했다 — 같은 인스턴스 재개는 무손실 fast-path(in-memory `pendingContinuations` resolve), 재시작/타 인스턴스는 §7.5 rehydration slow-path 의 **이원화**. 그러나 유저 입력 시점이 불확정이라 **응답 없는 park execution 의 코루틴·컨텍스트가 메모리에 무한 누적**되는 운영 리스크가 있었다(#468 후속).

**결정 — park = 세그먼트 종료, 모든 재개 = rehydration**: park 시 durable 영속(아래) 후 `runExecution` 세그먼트를 **즉시 반환·해제**한다. 따라서 in-process resolver 가 존재하지 않고 **모든 재개가 §7.5 rehydration 단일 경로**(slow-path 일원화)다. 효과: (a) **bounded 메모리** — park 수와 무관하게 코루틴/컨텍스트 메모리 0 점유, (b) **단일 재개 경로** — fast/slow 이원화 제거로 추론·테스트·운영 단순화, 멀티인스턴스/재시작/스케일아웃에 균일.

- **B1·B2 분리 불가**: "코루틴 해제"(B1)는 park 시 `await` 제거를 요구하고, 그러면 코루틴을 깨울 in-memory resolve 가 사라져 "모든 재개 = rehydration"(B2)이 **강제**된다 — 한 덩어리 변경이다. `firstSegmentBarriers`/`armFirstSegmentBarrier`/`settleFirstSegment`/`signalParkBarrier`·`pendingContinuations` Map(worker-side fast-path)은 park 가 곧 세그먼트 종료가 되어 불필요해져 제거된다(B3).
- **worker-side ≠ publisher-side**: 위 "Sticky fast-path 제거"는 _publisher_ 측("내 인스턴스에 키 있으면 BullMQ 우회")을 제거한 것이고, 본 결정은 그 _worker_ 측 대칭(job pick up 후 로컬 Map 키 있으면 즉시 resolve)을 마저 제거해 §7.4 "항상 rehydration" 을 완성한다.
- **무손실 전제 — durable 영속 (Phase A)**: rehydration 무손실화의 전제가 먼저 충족됐다 — `conversationThread`(`Execution.conversation_thread` V084, A1), 멀티턴 `_resumeCheckpoint`(A2a + information_extractor A2b), 사용자 정의 `variables`(`Execution.user_variables` V085, A3). 그래서 모든 재개를 rehydration 으로 돌려도 상태 손실이 없다.
- **D4 — 멀티턴 turn-단위 park**: `runAiConversationLoop` 의 장수 루프를 **매 turn 입력 대기에서 해제** — 한 turn 처리 = 한 세그먼트, 다음 메시지에 rehydration 재개. 응답 없는 대화도 메모리 0 점유. 기각 대안("대화 전체 = 단일 waiting 유지 + 코루틴 누적 수용")은 bounded-메모리 목표와 정면 충돌이라 기각. turn 마다 rehydration 비용은 사람-페이스라 수용.
- **D3 — fresh-config-per-turn**: 매 turn rehydration 이 `buildRetryReentryState` 로 `node.config` 를 fresh 재유도하므로, park 중 워크플로 편집이 다음 turn 부터 반영된다(§6.2). 기각 대안("checkpoint 에 rawConfig 영속해 per-conversation frozen 유지")은 구현 복잡도를 더하고, fresh 재유도가 "최신 정의 반영" 으로 더 직관적이라 미채택 — replay reproducibility 의 turn 단위 약화는 수용된 trade-off다.
- **불변식 보존**: 동일 turn 이중 실행 0(durable `WAITING_FOR_INPUT` + 재개 진입 **DB 원자 claim** §7.5 — 비원자 재검증 가드를 대체), continuation 유실 0(durable BullMQ 큐 §7.4), 멱등(jobId). park→worker kill→무손실 재개는 dockerized e2e 회귀로 보증한다.
- **단계적 롤아웃 (B1 → B2a → B2b, 2026-06-05/06, 완료)**: 위 최종 모델은 **단계 적용**됐다(park-site 단위로 "release+slow-path 를 함께" — B1·B2 분리 불가 원칙 유지). **PR-B1(form/button)**: 단발 상호작용(`waitForFormSubmission`/`waitForButtonInteraction`)을 park-release+rehydration 으로 전환. 이들은 더 이상 in-memory resolver 를 등록하지 않으므로 그 재개는 항상 §7.5 rehydration 으로 간다. **PR-B2a(top-level 멀티턴 AI, 2026-06-06)**: `runAiConversationLoop` 장수 루프를 **top-level 한정** turn-단위 park(D4)로 전환 — `waitForAiConversation('release')`(첫 turn park) + `processAiResumeTurn`(재개 시 단발 turn 처리 + re-park). 응답 없는 top-level 멀티턴 대화도 코루틴/메모리 0 점유(bounded). **PR-B2b(중첩 exec-park D6 + full B3, 2026-06-06, 완료)**: 중첩 `executeInline` blocking 의 durable 화(call-stack 영속 `resume_call_stack` V087 + frame-by-frame rehydration `driveCallStackResume`/`driveResumeFrame`, exec-park D6)와, 그때 비로소 불필요해진 in-memory 머신(`pendingContinuations`·`firstSegmentBarriers` 일가·`firePayload` scheduler·`runAiConversationLoop`·detached) **완전 제거(full B3)**. 이로써 §7.4 "worker-side fast-path 제거"·`pendingContinuations` Map 제거 서술이 실제 코드와 일치하고, worker 는 `runExecution` 을 직접 await 한다. bounded-메모리의 핵심 수혜(응답 없는 park 누적 차단)는 단발 park + top-level 멀티턴이 압도적 다수인 HITL 패턴에서 PR-B1+B2a 로 대부분 달성됐고, PR-B2b 가 중첩 케이스까지 확장 완성했다.
  - **W1 — D6+full-B3 의 PR-B2b 내 착지 (Rationale 번경 기록)**: exec-park D6(중첩 durable resume)와 full B3(in-memory 머신 완전 제거)는 본래 "한 PR(PR-B2b)" 로 함께 수행하기로 계획됐으나(B1·B2 분리 불가 원칙의 연장 — D6 가 완성돼야 in-memory 머신을 안전히 제거 가능), 실제로는 같은 브랜치 위 두 커밋으로 순차 착지했다 — 먼저 **step-8(durable D6)** 커밋(call-stack 영속 + frame-by-frame rehydration), 이어 **full-B3** 커밋(in-memory 머신 제거 + worker 직접 await). 두 커밋 모두 PR-B2b 범위 안이며 본 spec flip 시점(2026-06-06)에 둘 다 완료됐다 — 과도기적 partial-B3(머신 잠정 잔존) 서술은 더 이상 유효하지 않다.
- **resume turn dispatch registry 추출 (#507, 2026-06-06)**: §7.5 의 form/buttons/ai turn 분기는 `driveResumeAwaited`(top-level)·`driveResumeFrame`(중첩) 두 곳의 하드코딩 분기에서 ordered `resumeTurnRegistry`(form → buttons → ai, first-match-wins) + 단일 진입점 `dispatchResumeTurn`(`resume-turn-dispatch.ts`)으로 추출됐다 — 동작 보존 리팩토링(핸들러 매핑·우선순위·에러코드 불변), 새 blocking 노드 타입은 registry 항목 1개 등록으로 plug-in 된다. 같은 변경에서 `PARK_RELEASED`/`ParkSignal`/`ProcessTurnResult` 도 `shared/execution-resume/process-turn-result.ts` 로 이관됐다.
- **park-entry dispatch registry 추출 (M-4, 2026-06-24)**: 위 resume 측(#507)과 **대칭**으로, **최초 park 진입**의 form/buttons/ai `waitForX` 선택 분기를 `runExecution`(메인 루프)·`executeInline`(중첩)·`runNodeDispatchLoop`(드라이브) 세 곳의 삼중복에서 ordered `parkEntryRegistry`(form → buttons → ai, first-match-wins) + 단일 진입점 `dispatchParkEntry`(`park-entry-dispatch.ts`)으로 추출했다 — behavior-preserving(우선순위·`waitForX` 인자·`PARK_RELEASED` 의미 불변, resume #507 동일 패턴 연속이라 Rationale 번복 아님). 단 **park 후 control-flow 반응이 사이트마다 다르므로**(메인 루프 = bare `return` / 중첩 = `ParkReleaseSignal` throw / 드라이브 = `{ parked: true }`) registry 는 `ProcessTurnResult` 만 반환하고 escape 는 각 호출 사이트가 보유한다. `ai_form_render` 는 resume 측과 동일하게 `ai_conversation` 경로를 공유. 새 blocking 노드 타입은 `buildParkEntryRegistry` 에 항목 1줄 추가로 plug-in.
- **`runNodeDispatchLoop` 반환 계약 (PR-B1, SPEC-DRIFT W3)**: `runNodeDispatchLoop` 는 `Promise<{ parked: boolean }>` 를 반환한다. `parked: true` = blocking node(`waitForX`)에서 PARK_RELEASED sentinel 을 수신해 park 로 루프 종료(top-level fresh park, caller 가 세그먼트 종료 처리). `parked: false` = 정상 완료(다음 노드 없음 등). Phase B 이전의 `Promise<void>` 에서 변경됐으며, 이 반환값으로 caller(`runExecution` / `driveResumeAwaited`) 가 세그먼트 종료 여부를 판단한다. (코드가 옳고 spec 이 따라온다 — SPEC-DRIFT.)
- **exec-park D6 — 중첩 sub-workflow blocking durable 영속 (2026-06-06, 사용자 결정 "call stack 영속화 정공법")** *(레이블: `exec-park-durable-resume` plan 결정 D6 — AI 노드 spec 의 동명 `D6` 와 무관)* *(구현 상태: 구현 완료 — PR-B2b. V087 컬럼·타입·`CALL_STACK_SCHEMA_VERSION`, park stage(`executeInline` park-release + `_callStack` 영속), §7.5 frame-by-frame rehydration(`driveCallStackResume`/`driveResumeFrame`), full B3 제거 모두 반영)*: 중첩 sub-workflow(`executeInline`) 안의 blocking 노드도 park-release + rehydration 으로 일원화해 **in-memory 의존을 완전히 제거**(full B3)했다. 빠졌던 조각은 **호출 체인 구조뿐**이라(노드 출력은 같은 executionId 타임라인으로 DB 영속, thread/variables 는 V084/V085 영속), 신규 `Execution.resume_call_stack jsonb`(V087)로 영속하고 §7.5 가 frame-by-frame 재진입한다.
  - **선형 스택으로 충분한 이유**: 컨테이너(Loop/ForEach/Map/Parallel) body blocking 은 §3.2 로 금지 → 남는 중첩은 sub-workflow 호출 체인뿐 = 선형(iteration/branch 상태 영속 불요).
  - **`_continuationCheckpoint` 컬럼 신설 기각과 다른 범주**: §6.2 가 기각한 `_continuationCheckpoint` 는 continuation *운반*용 컬럼(continuation 은 BullMQ 큐가 durable 운반하므로 불요)이다. `resume_call_stack` 은 운반이 아니라 **park 시점의 중첩 실행 위상**(호출 체인) 영속 — 직교한 목적이라 그 기각의 번복이 아니다.
  - **per-node task queue 기각(아래 §Phase 2 cont "per-node task-queue 미존재")과 다른 범주**: 기각된 건 *모든 노드*를 워커로 분산(노드마다 전체 context 직렬화)하는 per-node task queue다. exec-park D6 는 **park 지점(waiting node)에서만** 직렬화하는 "waiting 후 재개"의 중첩 확장이며, dispatch loop in-process 전제(한 세그먼트 = 한 프로세스가 call stack 을 **재귀 in-process** 구동)를 유지한다 — 따라서 그 기각 대안의 재도입이 아니다.
  - **현 gap 동반 수정**: 종전 `driveResumeAwaited` 는 executeInline 스택을 재진입하지 않아 중첩 blocking 은 재시작 후 재개 불가(same-instance in-memory 한정)였다 — exec-park D6 가 이 latent gap 도 닫았다. `version` 가드는 `CALL_STACK_SCHEMA_VERSION`(checkpoint 와 독립)으로 롤링 배포를 방어한다.
  - **direct-drive vs `executeInline` 재호출 (W2 SPEC-DRIFT)**: §7.5 재진입은 outermost→innermost 로 `executeInline` 을 재호출하는 방식이 아니라, `driveCallStackResume` 이 영속된 `frames` 를 따라 **innermost frame 부터 직접 구동(bubble-up)** 한다. `executeInline` 재호출은 frame 마다 `_callStack` push/pop + sub-workflow DB 조회 + 재귀 깊이 증분 등 초기화 비용이 있고, 재진입 시점에 call-stack 상태가 영속 스냅샷과 어긋나는 re-entrancy 위험(중첩 park snapshot 시점 race)이 있다. `driveResumeFrame` 은 이미 rehydrate 된 context + 영속된 frame 정보를 그대로 써 그래프만 forward 하므로 더 안전·단순하며, 완료 노드 seed 는 별도 DB seed 없이 `rehydrateContext` 가 복원한 `context._executedNodes`(`execution_node_log` 기원) 재사용으로 기능 동등하다.

### Phase 2 cont 후속 정리

**1. per-node `task-queue` 미존재 확정 (§9.3)**:

BullMQ 큐는 `execution-run`(PR1 intake, §4) · `background-execution` · `execution-continuation` **세 개**이며, 이들은 모두 **execution/세그먼트 단위** 작업을 나른다. 한 세그먼트 **내부의 노드** 실행은 `runExecution` 의 in-process while-loop 에서 직접 dispatch 하며, **per-node `task-queue`(1 Worker = 1 NodeExecution)는 존재하지 않는다**(§4.2 / Rationale "per-node → execution-level intake 큐"). §9.3 큐 목록과 §11 Graceful Shutdown 항목 2 모두 이를 전제로 한다. (PR1 이전에는 큐가 둘뿐이고 execution 시작이 in-process fire-and-forget 였으나, PR1 이 `execution-run` intake 큐를 도입해 execution 시작을 work-stealing 분산했다.)

**2. `INVALID_EXECUTION_STATE` (§7.5.1) — WS/REST 이름 분리 유지**:

publisher 측 사전 검증의 0건/다중 row 케이스는 WS 쪽에서 `INVALID_EXECUTION_STATE` 로 응답한다. 같은 의미를 표현하는 REST 의 422 `INVALID_STATE` ([Spec 에러 처리 §3-error-handling.md](./3-error-handling.md)) 와는 별 코드로 유지한다 — 두 layer 공통으로 `INVALID_STATE` 로 통일하면 WS ack 처리 클라이언트가 동일 코드를 다른 routing (sync ack 응답 vs subsequent event) 으로 분기하기 어렵기 때문이다. 별 이름을 유지하면 routing 분기를 코드 이름에서 즉시 인지할 수 있고, spec 본문에서 두 layer 가 같은 의미임을 cross-link 로 보강한다.

본 코드의 적용 범위는 `waiting_for_input` 진입점 (`execution.submit_form` / `execution.click_button` / `execution.submit_message` / `execution.end_conversation`) 외에 `execution.retry_last_turn` (기대 상태 = `failed`) 도 동일 의미로 재사용한다.

**3. 워커 크래시 복구 — BullMQ stalled-job 으로 일원화 (2026-06-04 결정, §7.1)**:

> **현 구현 상태**: `recoverStuckExecutions` 의 stale 판정은 아직 **절대 시간**(`started_at < now() - STUCK_RECOVERY_STALE_MS(30분)`)이다. 아래 stalled-job 방향은 §4 `execution-run`/`execution-continuation` 큐 모델과 함께 도입될 **목표(Planned)** 다. WAITING_FOR_INPUT 제외와 분산 lock 은 절대 시간 방식에서도 이미 구현돼 있다.

별도 heartbeat 채널(워커 5초 emit + 중앙 검사) 도입을 **포기하고 BullMQ 내장 stalled-job 으로 일원화**한다(구 초안의 "heartbeat 미응답 기반 판정" 전제는 폐기). 근거: active 세그먼트가 이미 BullMQ job 으로 표현되므로 워커 크래시 = job stall 이고, BullMQ stalled 검출이 이를 다른 워커에 재배달한다 → §7.5 rehydration 으로 세그먼트 재개. 별도 heartbeat emit/검사 인프라는 BullMQ stalled 메커니즘과 **기능 중복**이라 YAGNI.

- stalled 재배달은 **active 세그먼트 job 한정**. `status='waiting_for_input'` 은 job 이 없으므로 stalled/재큐/만료에 절대 걸리지 않고 무기한 park 된다(§4.x).
- 절대 시간 방식이 (a) 정상 장시간 실행을 early-FAIL 하던 false positive 와 (b) WAITING_FOR_INPUT 일괄 종결 운영 회귀의 근본 원인이었으나, stalled-job 은 "워커가 실제로 죽었을 때만 재배달" 하므로 둘 다 해소된다(살아있는 워커의 장시간 active 세그먼트는 stall 로 판정되지 않음).
- `recoverStuckExecutions` 의 절대시간 30분 일괄 fail 은 **PR3(2026-07-04)에서 "제어된 re-drive"(§7.5 case B rehydration)로 전환**됐고, **PR4(2026-07-04)에서 운영 중 즉시 재배달(BullMQ stalled, `maxStalledCount:1`)이 추가**됐다. **단 `recoverStuckExecutions` 은 은퇴하지 않고 부팅 backstop 으로 병존**한다(stalled job 이 없는 전체 재시작·Redis 비영속·job 유실 케이스 담당 — 아래 "PR4 — BullMQ stalled 자동 재배달" 참조). `WORKER_HEARTBEAT_TIMEOUT` 에러 코드는 **유지하되 PR4 에서 의미 재정의 발효** — "30분 절대 stale" → "active 세그먼트가 stalled 재배달 attempts 를 모두 소진(terminal worker failure)"; 부팅 backstop re-drive 는 이 코드 미사용(재구동 불가는 `RESUME_CHECKPOINT_MISSING`). §2.13 동기화.

**4. rehydration 단말 상태 이분 — `cancelled` (Execution) vs `failed` (NodeExecution)**:

§7.5 rehydration 실패 케이스 (`RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE`) 에서 Execution 은 `cancelled`, 동반 NodeExecution 은 `failed` 로 종결하는 이분 정책의 결정 근거:

- **Execution `cancelled`**: 이 3개 코드는 모두 **인프라 실패** (checkpoint 손상, 큐 소진, schema 변경) 로 인한 종결이며 사용자의 의도적 취소(`cancel` 명령)와 의미가 다름에도, Re-run 진입 가능성을 열어두기 위해 `cancelled` 를 선택한다. `failed` 는 비즈니스/노드 에러로 워크플로우가 정상 종결된 경우이고, 인프라 실패는 "사용자가 다시 시도하면 성공할 수 있는" 범주이므로 `cancelled` 가 더 적합 — Re-run UI 가 `cancelled` 상태에서 활성화된다 ([Spec 실행 엔진 §6.3](./4-execution-engine.md#63-재실행조회-정책-replay-policy)).
- **NodeExecution `failed`**: 노드는 정상 완료하지 못했으므로 `completed` 로 둘 수 없다. NodeExecution `cancelled`(§1.2) 는 **abortSignal 경로 전용** (`AbortError` 분류 — [node-cancellation §5](../conventions/node-cancellation.md#5-aborterror-분류)) 이고, rehydration 실패는 abort 가 아닌 **인프라 결함**이므로 `cancelled` 가 아니라 `failed` 로 종결한다 — 두 단말의 의미(취소 vs 실패)를 구분한다.

Execution 도 `failed` 로 통일하는 안은 Re-run 진입점이 `failed` 원인 (인프라 vs 비즈니스) 을 코드 외부에서 판별해야 해 UX 복잡도가 커져 택하지 않는다. (NodeExecution `cancelled` enum 은 2026-06-03 abortSignal cancellation 경로용으로 신설됐으나 — §1.2 / [node-cancellation §5.1](../conventions/node-cancellation.md#5-aborterror-분류) — rehydration 실패는 그 경로가 아니므로 본 케이스의 NodeExecution 단말은 `failed` 로 유지한다.)

### DLQ 모니터링 — 로그 기반 알람 선택 (Phase 3.1)

§9.3 "Dead-letter 모니터링" 의 `ContinuationDlqMonitorService` 가 OTel 메트릭 대신 structured `logger.error` **알람**을 쓰는 결정의 근거 (Phase 3.1 당시 판단):

- **(당시 전제 — 이후 변경됨)** Phase 3.1 시점의 backend 는 OTel traces-only 였다 (MeterProvider 미구성, custom 메트릭 0건). DLQ depth 알람 하나를 위해 metrics SDK 파이프라인 전체를 도입하는 것은 과도했다.
  > **현행화 (NF-OB-02 commit b9df69bf · NF-OB-07 이후)**: 이제 MeterProvider + PrometheusExporter 가 구성됐고, **큐 깊이(DLQ 의 `failed`/`delayed` 포함)는 `clemvion.queue.depth` ObservableGauge 로 노출**된다([5-system/_product-overview.md NF-OB-07](./_product-overview.md#nf-ob-07-메트릭-카탈로그)). 다만 `ContinuationDlqMonitorService` 의 **임계 초과 알람(능동 통지)** 은 여전히 log 기반을 유지한다 — gauge 는 "관측"이고 cooldown 알람은 "통지"라 역할이 다르며, 알람 룰은 Prometheus/Grafana 또는 로그 알람 어느 쪽으로도 구성 가능하다.
- **로그 기반 알람은 기존 운영 인프라로 즉시 픽업 가능** — `logger.error('[DLQ ALARM] ...')` 는 로그 수집/알람 파이프라인(Sentry·로그 기반 alert)이 별도 코드 없이 트리거. cooldown 으로 알람 폭증 방지.
- `/health` endpoint 에 DLQ depth 를 노출하지 않는다 — readiness probe 가 DLQ 누적으로 unhealthy 가 되면 정상 트래픽까지 차단되는 부작용. depth 는 (gauge 관측·알람) 대상이지 readiness 대상이 아님.
- env 4종(`CONTINUATION_DLQ_*`)은 `SHUTDOWN_GRACE_MS` 와 동일한 `useFactory` 주입 패턴을 따른다 (서비스가 `process.env` 직접 접근 안 함).

### per-node task queue → execution-level intake 큐 (§4 재정의, 2026-06-04 결정)

- **배경**: §4.1–4.3 은 본래 per-node task queue(1 Worker = 1 NodeExecution, 노드마다 `{taskId, nodeId, nodeType, input, context, timeout}` 태스크 발행)를 목표로 그렸으나 미구현(Planned)이었다. "성능·안정성·대량·분산 처리 신뢰성" 이 사용 방식과 무관한 기반 요건으로 확인되어 구현에 착수하면서 설계를 재검토했다.
- **기각 (per-node task queue)**: 현 in-process dispatch loop 는 컨테이너(Loop/ForEach/Map)·중첩 스코프 체인(`$parent`)·back-edge 순환·Parallel(`p-limit`+`allSettled`)을 **"한 실행이 한 프로세스 안에 있다"** 는 전제로 동작한다. 개별 노드를 워커로 분산하려면 노드마다 전체 ExecutionContext(변수·loop/item context·스코프 체인·conversation thread)를 직렬화/rehydration 해야 하고, 현 rehydration 인프라(§7.5)는 "waiting 후 재개" 용이지 "실행 중 노드 핸드오프" 용이 아니다 → 엔진 재작성급·고위험.
- **채택 (execution-level intake 큐)**: 워커가 실행 1건(active 세그먼트)을 통째로 처리한다(§4.2). 한 세그먼트 내부 노드 dispatch 는 여전히 in-process(per-node task queue 없음). n8n queue mode 와 동형이며 목표(수평 처리량·work-stealing·backpressure·§8 동시성 cap 토대)를 per-node 대비 훨씬 낮은 위험으로 달성한다. `background-execution`·`execution-continuation` 큐 패턴을 그대로 재사용.
- **세그먼트 모델의 정합성**: 이미 `execution-continuation`(§7.4)이 "재개 active 세그먼트" 를 운반하고 있었다. `execution-run` intake 큐는 그 대칭으로 "첫 active 세그먼트" 를 운반한다. 두 큐가 active 세그먼트를, `waiting_for_input` 이 그 사이 durable park 를 담당하는 구조가 자연 완성된다(§4.x). intake 큐 도입은 wait 의미를 전혀 바꾸지 않는다.
- **trade-off**: per-node 수준 세밀 분산(한 실행 내 노드들을 여러 워커로)은 포기한다. 단일 실행이 매우 무겁고 내부 분산이 실제로 필요해지면 후속 재검토(현 시점 그 요구 없음). 워크스페이스별 큐 파티셔닝도 후속(P2).

### 타임아웃을 active-running 누적 기준으로 (§8 재정의, 2026-06-04 결정)

- **배경**: §8 의 "단일 Execution 최대 실행 시간 30분" 이 wall-clock 인지 active 시간인지 미명시였다.
- **채택**: active-running 누적 시간 기준(`waiting_for_input` 대기 제외). wall-clock 이면 사용자 입력을 며칠 기다리는 정상 워크플로를 timeout 으로 죽이게 된다(과거 테스트에서 "늦게 돌아오니 세션 만료" 회귀로 확인된 안티패턴). park 동안의 노드별 워크플로 정의 timeout(`formConfig.timeout` 등)은 별개로 유지.
- **설계 정합**: active 세그먼트 job 이 active 구간에만 존재(park 중 job 부재)하므로 세그먼트 job 타임아웃이 곧 active 시간 측정이 되어 별도 시계 없이 자연 분리된다. 누적은 세그먼트 active 시간 합산.
- **에러 코드 분리**: 엔진 누적 타임아웃은 신규 `EXECUTION_TIME_LIMIT_EXCEEDED`. Code 노드 스크립트 타임아웃 `EXECUTION_TIMEOUT`(`nodes/data/code/code.handler.ts`)과 의미가 달라 분리한다(§3-error-handling §1.4 동기화, `error-codes.md §1·§2` 준수 — rename 아닌 의미 분리 신설).
- **한도 출처 — 1단계 env / 2단계 per-workflow (PR2a 구현)**: spec 표의 "설정 위치" 가 `Workflow.settings` 였으나, 그 설정 필드가 아직 없어 PR2a 는 **시스템 env 상수 `EXECUTION_MAX_ACTIVE_RUNNING_MS`(기본 30분, `0`=무제한)** 로 1단계 구현했다. per-workflow 설정 필드(+UI)는 2단계 후속(`exec-intake-queue-impl.md` PR2b 이후). 전역 상수부터 두는 이유: 멀티테넌트 폭주 보호라는 핵심 목적은 전역 한도로 즉시 달성되고, per-workflow 세분화는 DB 마이그레이션+UI 가 필요한 별도 범위다.
- **판정은 `>=` (경계 포함, 보수적 선택)**: 코드는 `activeNow >= maxActiveRunningMs` 로 한도와 정확히 같은 값도 "초과"로 간주한다(§8 본문). 한도에 도달한 세그먼트는 한도를 소진한 것이므로 종결이 타당하고, strict `>` 보다 `>=` 가 경계값 silent under-enforcement 위험이 없어 보수적으로 안전하다.
- **타임아웃 판정 비원자성 — BullMQ 직렬화 불변식으로 보호**: `assertActiveTimeWithinLimit`(DB 누적값 + in-progress 경과분을 읽어 판정)와 `updateExecutionStatus`(세그먼트 종료 시 누적 기록) 사이에는 잠금이 없다. 그러나 `jobId = executionId` dedup 으로 동일 Execution 의 active 세그먼트가 항상 1개이고 동시 실행되지 않으므로(§4.2) 이 read-check-then-act 는 현행 아키텍처에서 실질 race 를 일으키지 않는다. PR2b+ 재진입 경로 추가 시 재검증 필요(§4.2 "active-running 직렬화 불변식").

### 동시성 cap admission gate — consumer-side + cancelled(timeout) (PR2b, 2026-07-04)

워크스페이스/워크플로우 동시 실행 cap(§8)의 정책 정의. 사용자 결정(2026-07-04): spec 선행 분리 + 스코프 = cap + 5분 cancel(priority 3-tier 후속).

- **consumer-side gate(producer-side 아님)**: work-stealing 분산에서 어느 인스턴스가 실행할지는 job consume 시점에 결정된다. `execute()` 는 항상 `pending` enqueue 후 즉시 반환하는 fire-and-forget 계약(§4.1)을 유지하므로, cap 검증은 **consumer(`runExecutionFromQueue`)가 PENDING→RUNNING 전이 직전 원자 수행**해야 분산 정합이 맞다. producer-side(execute 시 카운트)는 다중 인스턴스 race + 즉시반환 계약 위반이라 기각.
- **`cancelled`(+`error.code`) vs `failed`**: 큐 대기 초과는 노드 실행이 **시작조차 안 됨** → "실패" 보다 "취소" 가 의미 정합. 기존 `cancelledBy` enum 의 **미사용 값 `'timeout'` 을 첫 실사용**하고, `error.code='EXECUTION_QUEUE_WAIT_TIMEOUT'` 로 user cancel 과 구분한다(§7.5 `RESUME_*` system-cancel 이 `execution.cancelled` 에 `error` 를 동행하는 기존 구조 재사용 — 신규 payload 필드 없음).
- **admission gate 는 PENDING→RUNNING 최초 진입에만**: §4.2 `jobId=executionId` dedup 직렬화 불변식으로 **동일 Execution 의 동시 active 세그먼트가 불가능**하므로, stalled 재배달(§7.1)·park 재개(§7.5)는 이미 RUNNING/재진입이라 cap 을 재심사하면 이중 카운트가 된다 → 재심사하지 않는다. (PR3 가 인정한 bounded zombie race 는 "같은 Execution 을 두 워커가 잠깐 굴릴 수 있음" 으로, cap 이 세는 "서로 다른 Execution N개" 동시성과는 별개 문제다.)
- **TOCTOU 원자화**: 다수 consumer 가 같은 cap 슬롯을 두고 경쟁하므로 순진한 read-then-act 는 cap 을 초과 허용한다. **per-workspace `pg_advisory_xact_lock` 으로 admission 을 직렬화**한 트랜잭션 안에서 조건부 UPDATE(`RETURNING`)로 "카운트→비교→전이" 한다. **조건부 UPDATE 단독은 불충분**했다 — 서브쿼리 COUNT 에 락이 없어 동시 admission 이 같은 스냅샷을 보고 cap 을 초과한다(ai-review 가 실 Postgres 로 재현). advisory lock 이 같은 scope 를 순차화하고 다른 workspace 는 병렬 유지한다.
- **`queued_at` 신규 컬럼(V104)**: 5분 판정은 큐 대기 진입 시각 기준. `started_at`(RUNNING 전이 시각)은 `recoverStuckExecutions` stale 판정에 쓰여 재사용 불가하므로 별도 컬럼 신설.
- **priority 3-tier 분리**: `ExecuteOptions.triggerType` threading 은 ExecuteOptions·trigger payload·queue option 3레이어 변경이라 cap gate 와 직교 → 별도 후속 PR 로 분리해 각 리뷰 집중(사용자 결정).

### `RESUME_*` 동기 ack 노출 폐기 — 후행 `execution.cancelled` 이벤트로 일원화 (2026-06-10 spec-sync, refactor 06 M-1)

- **옛 기술**: §7.5 의 rehydration 실패 3케이스(`RESUME_CHECKPOINT_MISSING`/`RESUME_FAILED`/`RESUME_INCOMPATIBLE_STATE`) 설명이 "이 셋 모두 WS §4.2 ack 에 `resumed: false` + error 로 노출된다" 고 기술했다 — 이는 동일 파일 §7.5.1("`RESUME_*` 는 후행 `execution.cancelled` 이벤트, ack 동기 응답 아님")과 **직접 모순**이었다.
- **올바른 경로**: `spec/0-overview.md §Rationale "실행 엔진: Redis 큐 + 분산 워커 풀"` 의 always-enqueue 모델 도입 이후, `RESUME_*` 는 enqueue 이후 임의 worker 가 처리하다 실패하는 **비동기** 종결이다. continuation 4종 핸들러는 enqueue 수락만 동기 ack(`resumed: true`/`queued`)로 반환하고, worker 측 실패는 후행 `execution.cancelled` 이벤트(`error.code = RESUME_*`)로 통지한다 — 코드상 4종 핸들러는 `RESUME_*` 에 대해 `resumed: false` 를 내지 않으므로 §7.5.1 이 authoritative 다.
- **정정**: §7.5 의 해당 문장을 §7.5.1 의 동기/비동기 직교 분류와 일치시켰다. 동기 ack 가 실패를 담는 경우는 publisher 측 사전 검증(`INVALID_EXECUTION_STATE`)뿐이다. WS 측 동반 정정은 [§6-websocket-protocol §Rationale "`resumed` 의미 재정의"](./6-websocket-protocol.md#rationale) 참조. 코드 변경 없음(spec 을 코드 실제 동작에 맞춤).

### Continuation ack client-safe typed error — 내부 메시지 누출 차단 (§7.5.2, 2026-06-14 결정)

- **문제**: continuation 4종 핸들러의 공통 ack 빌더(`buildContinuationErrorAck`)가 `error instanceof Error ? error.message : fallback` 로 **임의 plain `Error` 의 내부 message 를 그대로 client ack 에 전달**했다. `InvalidExecutionStateError` 만 `errorCode` 로 typed 하게 surface 되고, 그 외(특히 DB lookup 의 TypeORM 예외 등)는 스택 힌트·SQL 원문·내부 식별자가 누출될 수 있었다(PR #575 ai-review deferred, refactor 04 후속 A-1).
- **결정 (4점, 전부 옵션 A — 2026-06-14 사용자 확정)**:
  1. **에러 코드 네임스페이스** = 신규 `EXEC_*` prefix 를 만들지 않고 **중앙 `ErrorCode` enum 의 기존 `EXECUTION_*` 확장**. `EXEC_*` 는 기존 `EXECUTION_*` 과 이중 표기라 기각. `INVALID_EXECUTION_STATE`·`RESUME_*`·`RETRY_*` 는 안정성 정책상 기존 이름 유지([conventions/error-codes.md](../conventions/error-codes.md)).
  2. **client-safe 메시지 매핑** = backend 는 **code + 고정 영문 generic 메시지**만 emit, 내부 detail 은 서버 로그 전용. frontend 가 `code → i18n key` 맵으로 표시(`integration-error-codes` 선례). backend i18n 레이어 신설은 인프라 부재·비용으로 기각.
  3. **`ExecutionError` 전환 범위** = **경계(boundary)만**. `ExecutionError` 추상 기반(`{ code, message, serverDetail? }`) 도입 후 client 경계에 도달하는 throw 만 typed 화하고, 깊은 내부 plain Error 는 ack 경계에서 generic fallback 처리. 전수 전환(~15곳)은 대형·저가치(다수가 client 미도달)·회귀 위험으로 기각.
  4. **ack 변환** = typed `ExecutionError` → `error.message`(고정 client-safe) + `error.code`. 그 외 plain Error → 고정 generic fallback + `EXECUTION_INTERNAL_ERROR`, **내부 `error.message` 미전달**(서버 로그 전용). 이것이 누출 차단의 보안 게이트.
- **선례 정합**: `InvalidExecutionStateError`(§7.5.1)·`RetryLastTurnError`(§4.2)·`ExecutionTimeLimitError`(§8)는 이미 "고정 client-safe message + 서버 전용 detail" 패턴이므로 `ExecutionError` 기반으로 점진 흡수(code·동작 보존)한다. worker 측 `RESUME_*`(`execution.cancelled` 이벤트)는 별 경로라 본 변경 범위 밖(동일 원칙 적용 여부는 후속 점검).

### C-1 god-class strangler-fig 분할 (2026-06-18~19, PR #622·#625·#626·#627 + review-파생 후속 #629·#630·#631·#632·#637·#638)

- **결정**: `ExecutionEngineService`(9,670줄, 생성자 의존 ~20개·메서드 ~70개로 SRP 전면 위반 — refactor 02-architecture C-1 Critical)를 **옵션 A(strangler-fig 단계별 분할)** 로 4-PR 누적(#622·#625·#626·#627)해 5개 협력 서비스로 분리하고 엔진을 **9,670→7,035줄**로 슬림화했다. 모든 단계는 **behavior-preserving**(verbatim 이동)이며 각 PR 이 독립 e2e 게이트로 검증됐다(impl-done 4회 모두 `BLOCK: NO`). 본 분할은 **spec 무변** — 메서드 물리 위치는 spec 이 정의하지 않는 구현 재량 영역이고, 같은 방향의 선행 분리(`resume-turn-dispatch.ts` registry, PR #507)가 이미 "spec 변경 불요"로 착지한 선례의 연속이다.
- **추출 서비스** (전부 `codebase/backend/src/modules/execution-engine/` 내 — 엔진 spec `code:` glob 자동 커버):
  - `NodeBootstrapService` — 노드 컴포넌트 부팅. `onModuleInit` 이 `NodeComponentRegistry.bootstrap(ALL_NODE_COMPONENTS, …)` 을 호출(§[4-nodes/0-overview §1.0](../4-nodes/0-overview.md)).
  - `AiTurnOrchestrator` — AI 멀티턴 lifecycle. `waitForAiConversation`·`processAiResumeTurn`·`handleAiResumeTurn`·`handleAiMessageTurn`·`finalizeAiNode`·`emitAiWaitingForInput`.
  - `FormInteractionService` / `ButtonInteractionService` — form/button park-resume. `waitForFormSubmission`/`processFormResumeTurn`, `waitForButtonInteraction`/`processButtonResumeTurn`. `ButtonInteractionService` 는 추가로 순수함수 `resolveButtonInteraction`(payload→port/interaction 결정, 4 variant)·`buildResumedStructuredOutput` 과 `ButtonClickPayload` discriminated-union + `isButtonClickPayload` 가드를 co-locate 추출했다(행위보존 — 후속 ⑤ PR #631).
  - `RetryTurnService` — retry 실행. `retryLastTurn`·`applyRetryLastTurn`·`resumeGraphAfterRetry`·`completeRetryExecution`·`failRetryExecution`. **외부 진입점(`websocket.gateway`·`continuation-execution.processor`)이 `RetryTurnService` 를 직접 호출**한다 (후속 ④로 엔진의 thin forwarding delegator 와 `engine→Retry` 역방향 `forwardRef` 주입을 제거 — 아래 "engine→Retry 순환 DI 제거" bullet 참조).
  - **엔진 잔류**: registry(`resume-turn-dispatch`)·dispatch-loop·EngineDriver 멤버 집합(아래 ISP 계층의 **12 distinct 멤버** — `updateExecutionStatus`·`contextKeyOf`·`stageDurableResumeSnapshot`·`buildRetryReentryState`·`buildResumeCheckpoint`·`isCheckpointEligibleNodeType`·`applyPortSelection`·`rehydrateContext`·`loadAndBuildGraph`·`runNodeDispatchLoop`·`findActivatedBackEdge`·`clearLlmDefaultConfigCache`). `retryLastTurn`·`applyRetryLastTurn` 은 더 이상 엔진에 잔류하지 않는다(후속 ④).
- **엔진 내부 통신 = `EngineDriver`** (token `ENGINE_DRIVER`, `useExisting: ExecutionEngineService`): 추출 서비스가 엔진의 잔류 메서드를 호출하는 **엔진 내부 전용 계약**이다. **in-process 전제** — 분산 분리가 아니라 같은 프로세스 안의 클래스 경계 정리다. 후속 ④에서 이 단일 12-멤버 계약을 **ISP 부분 인터페이스 계층**으로 코드 분해했다(`engine-driver.interface.ts`): `CoreEngineDriver`(`updateExecutionStatus`·`contextKeyOf`) ⊂ `InteractionEngineDriver`(+`stageDurableResumeSnapshot`, Form/Button 소비); `ReentryStateDriver`(`buildRetryReentryState`, AiTurn·Retry 공유); `AiTurnEngineDriver`(= Interaction+Reentry+`buildResumeCheckpoint`·`isCheckpointEligibleNodeType`·`applyPortSelection`, 7멤버, AiTurnOrchestrator 소비); `RetryEngineDriver`(= Core+Reentry+`rehydrateContext`·`loadAndBuildGraph`·`runNodeDispatchLoop`·`findActivatedBackEdge`·`clearLlmDefaultConfigCache`, 8멤버 — 신규 5멤버 `@internal`, RetryTurnService 소비); `EngineDriver`(= AiTurn+Retry, **12 distinct**, 엔진만 implements). 각 소비자의 driver 필드를 slice 로 narrow 해 ISP 컴파일 계약을 실현한다 (이는 **코드 레벨 ISP 분해**이며 spec SoT 는 여전히 단일 `EngineDriver` 엔진-내부 계약 하나다). `WorkflowExecutor`(spec 상 engine↔**노드** 계약) **재사용은 기각** — 엔진 내부 통신에 재사용하면 그 계약의 의미가 과적된다. bootstrap 의 엔진 자기참조(`handlerDeps.build(this)`)는 별도 `WORKFLOW_EXECUTOR` 토큰화로 해소했다(이쪽은 `WorkflowExecutor` 계약의 정확한 용처라 의미 보존 — m-3, `nodes→engine` 역의존 제거).
- **이벤트 발행은 불변**: 추출 서비스도 `ExecutionEventEmitter` 직접 주입을 유지한다 — §4.4 단일 sink 정책이 금지하는 것은 외부 이벤트 sink **추상화**이지 엔진 내부 클래스 분할이 아니므로, 본 분할은 이벤트 경로에 추상화 레이어를 새로 도입하지 않는다.
- **engine→Retry 순환 DI 제거 (후속 ④, 2026-06-19, PR #638)**: 4 방향 엔진↔서비스 주입 중 **engine→Retry 만** 제거 가능했다 — AiTurn/Form/Button 은 dispatch-loop·resume-registry 가 그래프 순회 중 위임하는 **구조적 필수**라 잔류한다. 모듈이 `RetryTurnService` 를 export 하고 외부 진입점(`websocket.gateway.ts`·`continuation-execution.processor.ts`)이 이를 직접 호출하도록 재배선해, 엔진의 thin delegator(`retryLastTurn`·`applyRetryLastTurn`)와 `forwardRef(() => RetryTurnService)` 주입을 삭제했다 — 단방향 `Retry→engine`(`RetryEngineDriver`)으로 수렴. **이 결정은 위 "엔진 잔류" 의 `retryLastTurn`·`applyRetryLastTurn thin delegator` 항을 대체한다.** import 재배치로 노출된 `ws.service↔gateway↔retry↔event-emitter` ES-module 순환은 `ExecutionEventEmitter→WebsocketService` `forwardRef` 지연 해석으로 봉인했다(§4.4 동형 thin 래퍼 — 단일 sink 정책 예외 아님). behavior-preserving — 전수 ai-review(architecture·concurrency 포함)·dockerized e2e 35/205 통과.
- **sub-workflow workspace 격리 fail-closed (후속 ★, 2026-06-19, PR #637)**: sub-workflow 진입점(`executeInline`/`executeSync`/`executeAsync`)의 `assertSameWorkspace` workspace 격리를 fail-open(누락 시 로그 후 통과)→**fail-closed**(`callerWorkspaceId` 누락 시에도 `WORKFLOW_FORBIDDEN_WORKSPACE` deny)로 전환했다. 착수 전 프로덕션 3 호출처 전수 trace 로 workspace 컨텍스트 상시 공급을 입증해 blanket fail-closed 안전을 확정했다. 노드-facing 계약은 [workflow §2 W-6](../4-nodes/2-flow/1-workflow.md#2-설정-ui), 에러 surface 는 [§3-error-handling §1.4/§3.2](./3-error-handling.md#14-워크플로우-실행-에러). 차단은 typed `WorkflowForbiddenWorkspaceError`(message prefix 보존) → Sub-Workflow 핸들러가 `ErrorCode.WORKFLOW_FORBIDDEN_WORKSPACE` 로 error-port 에 surface 한다(후속 1b 에서 enum 등재 + `mapSubWorkflowError` 매핑 완료).
