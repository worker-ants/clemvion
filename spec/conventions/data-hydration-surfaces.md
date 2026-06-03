---
id: data-hydration-surfaces
status: implemented
code:
  - codebase/frontend/src/lib/conversation/__tests__/hydration-coverage.test.ts
  - codebase/frontend/src/lib/conversation/conversation-utils.ts
  - codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts
  - codebase/frontend/src/components/editor/run-results/result-timeline.tsx
---

# Data Hydration Surfaces

> 관련 문서: [Spec Conversation Thread §9.3](./conversation-thread.md#93-데이터-소스-선택) · [Spec WebSocket Protocol §4.4](../5-system/6-websocket-protocol.md) · [Spec AI Agent §7](../4-nodes/3-ai/1-ai-agent.md#7-출력-구조)

handler 의 output field 가 frontend 의 **여러 surface (live / waiting / execution-history / replay)** 에서 어떻게 hydration 되는지의 매트릭스. 실행 내역 페이지에서 presentations inline 렌더가 누락되는 류의 회귀를 spec/harness 양쪽에서 차단.

신규 output field 추가 시 본 문서 매트릭스에 행을 추가하고 표가 가리키는 모든 hydration 함수에 처리를 동시 적용한다 — hydration coverage 단위 테스트 (`codebase/frontend/src/lib/conversation/__tests__/hydration-coverage.test.ts`) 가 누락 fail.

---

## 1. Output field → hydration surface 매트릭스

### 1.1 AI Agent multi-turn / single-turn

| Field | Backend echo 위치 | Frontend hydration 함수 (필수 N) |
|---|---|---|
| `output.result.response` | single-turn out · multi-turn user_ended / max_turns / condition / error | (a) `messagesToConversationItems` (b) `parseHistoryMessages` (c) `applyExecutionSnapshot` waiting 분기 |
| `output.result.messages` | 모든 multi-turn 종결 + waiting tick | (a)~(c) + (d) `threadTurnsToConversationItems` (live thread snapshot 의 대체 fallback) |
| `output.result.turnCount` (+ `config.maxTurns`) | 동일 | (a)~(c) + `SummaryView`(`ConversationInspector`) 의 live turn counter — 분모 `M` 을 별도 prop `conversationConfig.maxTurns`(= 종결 출력 envelope 의 top-level `config.maxTurns`) 에서 읽는다 · `ResultTimeline` 의 "Turn N/M" 표기 — **현재 코드는 분모를 `output.conversationConfig.maxTurns` 에서 읽으나** handler 는 어떤 종결 분기에서도 `output.conversationConfig` 를 echo 하지 않아(top-level `config.maxTurns` 에만 존재) `ResultTimeline` 분모는 `0` fallback 으로 빠진다(`/M` 표기 숨김). `maxTurns` 는 static config 값이라 `output.result.*` 에 echo 안 함(Principle 1.1) — **`ResultTimeline` 의 reader 경로와 backend echo 위치가 불일치하는 코드 버그** (별도 추적) |
| `output.result.presentations` | spec §7.10 echo — single-turn `out` / multi-turn final / condition route (`buildMultiTurnFinalOutput` / `buildConditionOutput` 의 `metadata.allPresentations`) | (a) `parseHistoryMessages` 의 last-assistant attach (b) `threadTurnsToConversationItems` 의 turn-level presentations 부착 (c) `AssistantPresentationsBlock` 렌더 (d) `applyExecutionSnapshot` 의 conversation seed 경로 |
| `output.interaction` (resumed) | multi-turn `resumed` transient · `ai_form_render` waiting | (a) `pauseForConversation` 의 convConfig 부착 (b) WS handleAiMessage |
| `output.error` (multi-turn error 종결) | multi-turn `port: 'error'` — `buildMultiTurnFinalOutput` 의 `errorPayload` 경로 (single source — `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`). `details.retryable` / `retryAfterSec` 표준 필드는 [CONVENTIONS Principle 3.2.1](./node-output.md#321-details-의-공통-표준-필드-llm-계열-노드-한정-필수) | (a) `parseHistoryMessages` 가 `output.error` 가 set 된 multi-turn 종결 노드의 thread 마지막에 `system_error` ConversationItem 합성 (b) `threadTurnsToConversationItems` 의 `system_error` source 매핑 (`[Conversation Thread §9.1]`) (c) `applyExecutionSnapshot` 의 ended 분기 (d) WS `execution.node.failed` / `node.completed` (with error) → `useExecutionStore` APPEND ([Conversation Thread §9.7](./conversation-thread.md#97-ws-이벤트--store-변환-계약)) |
| `meta.interactionType` | 모든 multi-turn waiting | (a) `isConversationOutput` (b) `inferInteractionTypeFromNodeType` fallback (c) `applyExecutionSnapshot` 의 interactionType 분기 |
| `meta.presentationCalls` / `meta.presentationSchemaViolations` | spec §4.1·§7.10 — render_* trace | 디버그 패널 한정 (Conversation Inspector tool 항목) |

### 1.2 Presentation 노드 (Carousel / Table / Chart / Form / Template)

| Field | Backend echo 위치 | Frontend hydration |
|---|---|---|
| `output.items` / `output.rows` / `output.data` / `output.rendered` | presentation handler waiting/resumed | `PresentationContent` (Preview 탭) |
| `output.interaction` (form_submitted / button_click / button_continue) | resume tick | `inferInteractionTypeFromData` (`conversation-utils.ts`) + `submitForm`(`use-execution-interaction-commands.ts`) 의 인라인 `addConversationMessage` 로 optimistic `presentation_user` turn push — 이후 WS authoritative thread snapshot 이 override |

---

## 2. Surface 별 hydration 함수

### 2.1 Live (실행 중 WS)

| Trigger | 함수 |
|---|---|
| `execution.ai_message` event | `handleAiMessage` → `messagesToConversationItems` |
| `execution.waiting_for_input` event (ai_conversation / ai_form_render) | `handleWaitingForInput` → `threadTurnsToConversationItems` + `mergeOrphanToolItems` (thread snapshot 우선) |
| `execution.tool_call_started` / `_completed` event | `upsertToolItem` / `updateToolItem` |

### 2.2 Waiting reconcile (페이지 mount / WS 재구독)

| Trigger | 함수 |
|---|---|
| REST `/executions/:id` 응답 | `applyExecutionSnapshot` 의 waiting 분기 → `maybeSeedAiConversationMessages` + `pauseForConversation` |
| `execution.snapshot` event | 동일 |

### 2.3 Completed history (실행 내역 페이지)

| Trigger | 함수 |
|---|---|
| NodeExecution.outputData (REST fetch, no live thread) | `parseHistoryMessages` → `messagesToConversationItems` + last-assistant presentations attach. **`output.error` set + multi-turn**: 마지막에 `system_error` ConversationItem 합성 ([Conversation Thread §9.1 / §9.10 CT-S9](./conversation-thread.md#910-회귀-차단-시나리오)) |

### 2.4 Replay (예정 — v2)

| Trigger | 함수 |
|---|---|
| ConversationThread 재구성 view | EH-DETAIL-06 — 실행 이력의 thread 재구성 |

---

## 3. 신규 field 추가 절차

1. **본 매트릭스 §1 에 행 추가** — backend echo 위치 + frontend hydration 함수 N개 모두 나열.
2. **Backend**: handler 의 모든 종결 분기 (single-turn out, multi-turn user_ended/max_turns/condition/error, error envelope) 에 동일 field 동시 추가. resume state (`_resumeState`) 에 누적이 필요하면 캐리 패턴 (`state.allFoo`) 도 함께.
3. **Frontend**: 매트릭스가 가리키는 모든 hydration 함수에 처리 추가. exhaustive 패턴 (TypeScript `assertNever`) 또는 field optional chaining + log warn 으로 누락 알림.
4. **Unit test**: `hydration-coverage.test.ts` 가 매트릭스 행과 코드 grep 결과를 자동 비교 — 누락 fail.

---

## 4. Rationale

"실행 내역 페이지에서 presentations 가 안 보임" 회귀의 원인은 단순: backend 가 `ConversationTurn.presentations` 만 영속 → 실행 내역 페이지는 thread snapshot 을 fetch 하지 않음 → frontend 가 못 본다.

**근본 원인**: 같은 데이터 SoT 가 surface 별로 다른 hydration 경로를 거치는데, 신규 field 추가 시 "어느 경로에서 어떻게 surface 되어야 하는지" 가 spec 에 없어 개발자가 한 surface 만 update 하고 다른 surface 는 빠뜨림.

본 컨벤션은 매트릭스 + 가드로 N개 surface 의 동시 업데이트를 강제한다. spec §1.1 의 `output.result.presentations` 행이 그 첫 번째 적용 사례.
